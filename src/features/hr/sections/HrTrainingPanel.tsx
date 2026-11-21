import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Circle,
  CircleCheck,
  ChevronDown,
  ClipboardList,
  Clock3,
  Eye,
  FileText,
  Paperclip,
  Play,
  Plus,
  UserRound,
  Video,
} from 'lucide-react-native';
import { Card } from '@/components/Card';
import { showHrConfirm } from '@/features/hr/components/HrConfirmModal';
import { useAuth } from '@/core/auth/AuthProvider';
import {
  createTrainingCourse,
  createTrainingEnrollment,
  deleteTrainingCourse,
  listHrEmployees,
  listTrainingCourses,
  listTrainingEnrollments,
  updateTrainingCourse,
  updateTrainingEnrollment,
} from '@/features/hr/hrApi';
import type {
  HrEmployee,
  HrTrainingCourse,
  HrTrainingEnrollment,
  HrTrainingLesson,
  HrTrainingQuiz,
} from '@/features/hr/types';
import { colors } from '@/theme/colors';

const CATEGORIES = ['Văn hóa', 'Kỹ thuật', 'Kinh doanh', 'Công nghệ'] as const;

function formatDate(value?: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('vi-VN');
}

export function HrTrainingPanel({
  companyCode,
  canManage,
}: {
  companyCode?: string;
  canManage: boolean;
}) {
  const { user } = useAuth();
  const currentUid = user?._id || user?.id || '';
  const userLevel = (user as { level?: number } | null)?.level;
  const roleLower = String(user?.role || '').toLowerCase();
  const isAdmin = roleLower === 'admin' || roleLower === 'superadmin';
  const isSupervisor =
    canManage ||
    isAdmin ||
    roleLower === 'manager' ||
    roleLower === 'branch_owner' ||
    (typeof userLevel === 'number' && userLevel <= 3);

  const [courses, setCourses] = useState<HrTrainingCourse[]>([]);
  const [myEnrollments, setMyEnrollments] = useState<HrTrainingEnrollment[]>([]);
  const [companyEnrollments, setCompanyEnrollments] = useState<HrTrainingEnrollment[]>([]);
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // List filters
  const [search, setSearch] = useState('');
  const [monitorUid, setMonitorUid] = useState<string>('');
  const [monitorModalOpen, setMonitorModalOpen] = useState(false);

  // Study / Detail screen state
  const [selectedCourse, setSelectedCourse] = useState<HrTrainingCourse | null>(null);
  const [activeIndex, setActiveIndex] = useState<number>(-1); // -1 = intro, 0..n-1 = lesson, n = quiz
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizErrors, setQuizErrors] = useState<Record<number, boolean>>({});
  const [submittingProgress, setSubmittingProgress] = useState(false);

  // Create / Edit Course modal
  const [formOpen, setFormOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<HrTrainingCourse | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formCategory, setFormCategory] = useState<string>('Văn hóa');
  const [formDuration, setFormDuration] = useState('');
  const [formRequired, setFormRequired] = useState(false);
  const [formAutoOnboarding, setFormAutoOnboarding] = useState(false);
  const [formLessons, setFormLessons] = useState<HrTrainingLesson[]>([]);
  const [formQuizzes, setFormQuizzes] = useState<HrTrainingQuiz[]>([]);
  const [savingCourse, setSavingCourse] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const [courseList, mine, compEnrolls, empList] = await Promise.all([
          listTrainingCourses(companyCode),
          currentUid ? listTrainingEnrollments({ uid: currentUid }).catch(() => []) : Promise.resolve([]),
          isSupervisor && companyCode
            ? listTrainingEnrollments({ companyCode }).catch(() => [])
            : Promise.resolve([]),
          isSupervisor && companyCode ? listHrEmployees(companyCode).catch(() => []) : Promise.resolve([]),
        ]);
        setCourses(courseList);
        setMyEnrollments(mine);
        setCompanyEnrollments(compEnrolls);
        setEmployees(empList);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không tải được dữ liệu đào tạo.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [companyCode, currentUid, isSupervisor],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const activeEnrollList = monitorUid ? companyEnrollments : myEnrollments;
  const targetUid = monitorUid || currentUid;

  const findEnrollment = useCallback(
    (courseId: string) => activeEnrollList.find((e) => e.courseId === courseId && e.uid === targetUid),
    [activeEnrollList, targetUid],
  );

  const filteredCourses = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter(
      (c) =>
        (c.title || c.name || '').toLowerCase().includes(q) ||
        (c.category || '').toLowerCase().includes(q) ||
        (c.instructor || '').toLowerCase().includes(q),
    );
  }, [courses, search]);

  const openCourseDetail = useCallback(
    async (course: HrTrainingCourse) => {
      setSelectedCourse(course);
      setQuizAnswers({});
      setQuizSubmitted(false);
      setQuizErrors({});

      const existing = myEnrollments.find((e) => e.courseId === course.id && e.uid === currentUid);
      if (!existing && !monitorUid && currentUid) {
        // Tự động ghi danh như bản web khi bấm vào học
        try {
          const created = await createTrainingEnrollment({
            courseId: course.id,
            courseTitle: course.title || course.name || 'Khóa học',
            uid: currentUid,
            userName: user?.displayName || user?.email || 'Nhân viên',
            companyCode: course.companyCode || companyCode,
          });
          setMyEnrollments((prev) => [...prev, created]);
          void updateTrainingCourse(course.id, {
            enrolledCount: (course.enrolledCount || 0) + 1,
          }).catch(() => undefined);
          setCourses((prev) =>
            prev.map((c) =>
              c.id === course.id ? { ...c, enrolledCount: (c.enrolledCount || 0) + 1 } : c,
            ),
          );
          setActiveIndex(-1);
        } catch {
          setActiveIndex(-1);
        }
        return;
      }

      if (existing) {
        const completed = existing.completedLessons || [];
        const lessons = course.lessons || [];
        let nextIdx = -1;
        for (let i = 0; i < lessons.length; i++) {
          if (!completed.includes(`lesson_${i}`)) {
            nextIdx = i;
            break;
          }
        }
        if (nextIdx === -1 && lessons.length > 0 && !existing.quizPassed && (course.quizzes?.length ?? 0) > 0) {
          nextIdx = lessons.length;
        }
        setActiveIndex(nextIdx);
      } else {
        setActiveIndex(-1);
      }
    },
    [companyCode, currentUid, monitorUid, myEnrollments, user?.displayName, user?.email],
  );

  const ensureMyEnrollment = useCallback(
    async (course: HrTrainingCourse): Promise<HrTrainingEnrollment | null> => {
      const existing = myEnrollments.find((e) => e.courseId === course.id && e.uid === currentUid);
      if (existing) return existing;
      if (!currentUid) return null;
      const created = await createTrainingEnrollment({
        courseId: course.id,
        courseTitle: course.title || course.name || 'Khóa học',
        uid: currentUid,
        userName: user?.displayName || user?.email || 'Nhân viên',
        companyCode: course.companyCode || companyCode,
      });
      setMyEnrollments((prev) => [...prev, created]);
      return created;
    },
    [companyCode, currentUid, myEnrollments, user?.displayName, user?.email],
  );

  const handleMarkLessonComplete = useCallback(
    async (lessonIdx: number) => {
      if (!selectedCourse || submittingProgress) return;
      const lessons = selectedCourse.lessons || [];
      const hasQuiz = (selectedCourse.quizzes?.length ?? 0) > 0;

      setSubmittingProgress(true);
      try {
        const enroll = await ensureMyEnrollment(selectedCourse);
        if (!enroll) return;
        const completed = enroll.completedLessons || [];
        const key = `lesson_${lessonIdx}`;

        if (!completed.includes(key)) {
          const nextCompleted = [...completed, key];
          const totalItems = lessons.length + (hasQuiz ? 1 : 0);
          const finishedItems = nextCompleted.length + (enroll.quizPassed ? 1 : 0);
          const progress = Math.round((finishedItems / (totalItems || 1)) * 100);
          const isDone = progress >= 100;
          const status = isDone ? 'completed' : 'in_progress';

          await updateTrainingEnrollment(enroll.id, {
            completedLessons: nextCompleted,
            progress,
            status,
            ...(isDone ? { completedAt: new Date().toISOString() } : {}),
          });

          setMyEnrollments((prev) =>
            prev.map((e) =>
              e.id === enroll.id ? { ...e, completedLessons: nextCompleted, progress, status } : e,
            ),
          );
        }

        if (lessonIdx < lessons.length - 1) {
          setActiveIndex(lessonIdx + 1);
        } else if (hasQuiz) {
          setActiveIndex(lessons.length);
        } else {
          Alert.alert('Chúc mừng', `Bạn đã hoàn thành khóa học "${selectedCourse.title || selectedCourse.name}"!`);
          setSelectedCourse(null);
          void load(true);
        }
      } catch (err) {
        Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể lưu tiến độ bài học.');
      } finally {
        setSubmittingProgress(false);
      }
    },
    [ensureMyEnrollment, load, selectedCourse, submittingProgress],
  );

  const handleSubmitQuiz = useCallback(async () => {
    if (!selectedCourse || submittingProgress) return;
    const quizzes = selectedCourse.quizzes || [];
    if (!quizzes.length) return;

    const unanswered = quizzes.some((_, idx) => quizAnswers[idx] === undefined);
    if (unanswered) {
      Alert.alert('Chưa hoàn tất', 'Vui lòng trả lời đầy đủ tất cả các câu hỏi trắc nghiệm.');
      return;
    }

    let allCorrect = true;
    const errs: Record<number, boolean> = {};
    for (let i = 0; i < quizzes.length; i++) {
      if (quizAnswers[i] !== quizzes[i].correctOptionIndex) {
        allCorrect = false;
        errs[i] = true;
      }
    }

    setQuizSubmitted(true);
    setQuizErrors(errs);

    if (!allCorrect) {
      Alert.alert('Chưa đạt', 'Có câu trả lời chưa đúng. Hãy kiểm tra lại các câu được đánh dấu đỏ.');
      return;
    }

    setSubmittingProgress(true);
    try {
      const enroll = await ensureMyEnrollment(selectedCourse);
      if (!enroll) return;
      const totalItems = (selectedCourse.lessons?.length ?? 0) + 1;
      const finishedItems = (enroll.completedLessons?.length ?? 0) + 1;
      const progress = Math.round((finishedItems / (totalItems || 1)) * 100);
      const isDone = progress >= 100;
      const status = isDone ? 'completed' : 'in_progress';

      await updateTrainingEnrollment(enroll.id, {
        quizPassed: true,
        progress,
        status,
        ...(isDone ? { completedAt: new Date().toISOString() } : {}),
      });

      setMyEnrollments((prev) =>
        prev.map((e) => (e.id === enroll.id ? { ...e, quizPassed: true, progress, status } : e)),
      );
      Alert.alert('Xuất sắc!', 'Bạn đã trả lời đúng 100% các câu hỏi trắc nghiệm!');
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể lưu kết quả bài thi.');
    } finally {
      setSubmittingProgress(false);
    }
  }, [ensureMyEnrollment, quizAnswers, selectedCourse, submittingProgress]);

  const handleCompleteDirectly = useCallback(async () => {
    if (!selectedCourse || submittingProgress) return;
    setSubmittingProgress(true);
    try {
      const enroll = await ensureMyEnrollment(selectedCourse);
      if (!enroll) return;
      await updateTrainingEnrollment(enroll.id, {
        progress: 100,
        status: 'completed',
        completedAt: new Date().toISOString(),
      });
      setMyEnrollments((prev) =>
        prev.map((e) => (e.id === enroll.id ? { ...e, progress: 100, status: 'completed' } : e)),
      );
      Alert.alert('Hoàn thành', `Đã đánh dấu hoàn thành khóa học "${selectedCourse.title || selectedCourse.name}".`);
      setSelectedCourse(null);
      void load(true);
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể hoàn thành khóa học.');
    } finally {
      setSubmittingProgress(false);
    }
  }, [ensureMyEnrollment, load, selectedCourse, submittingProgress]);

  const openCreateCourse = useCallback(() => {
    setEditingCourse(null);
    setFormTitle('');
    setFormDesc('');
    setFormCategory('Văn hóa');
    setFormDuration('');
    setFormRequired(false);
    setFormAutoOnboarding(false);
    setFormLessons([]);
    setFormQuizzes([]);
    setFormOpen(true);
  }, []);

  const openEditCourse = useCallback((course: HrTrainingCourse) => {
    setEditingCourse(course);
    setFormTitle(course.title || course.name || '');
    setFormDesc(course.description || '');
    setFormCategory(course.category || 'Văn hóa');
    setFormDuration(course.duration || '');
    setFormRequired(Boolean(course.isRequired));
    setFormAutoOnboarding(Boolean(course.autoAssignOnboarding));
    setFormLessons(course.lessons ? course.lessons.map((l) => ({ ...l })) : []);
    setFormQuizzes(
      course.quizzes ? course.quizzes.map((q) => ({ ...q, options: [...q.options] })) : [],
    );
    setFormOpen(true);
  }, []);

  const handleSaveCourse = useCallback(async () => {
    if (!formTitle.trim() || savingCourse) {
      if (!formTitle.trim()) Alert.alert('Thiếu tên khóa học', 'Vui lòng nhập tên khóa học.');
      return;
    }
    const comp = companyCode || user?.companyCode || '';
    if (!comp) {
      Alert.alert('Lỗi', 'Không xác định được mã doanh nghiệp.');
      return;
    }
    const cleanLessons = formLessons
      .filter((l) => l.title.trim())
      .map((l) => ({ ...l, title: l.title.trim(), url: (l.url || '').trim(), content: l.content || '' }));
    const cleanQuizzes = formQuizzes
      .filter((q) => q.question.trim() && q.options.filter((o) => o.trim()).length >= 2)
      .map((q) => ({
        question: q.question.trim(),
        options: q.options.map((o) => o.trim()),
        correctOptionIndex: Math.min(q.correctOptionIndex, q.options.length - 1),
      }));

    setSavingCourse(true);
    try {
      const payload = {
        title: formTitle.trim(),
        description: formDesc.trim(),
        category: formCategory,
        tags: formRequired ? ['Bắt buộc'] : [formCategory],
        isRequired: formRequired,
        autoAssignOnboarding: formAutoOnboarding,
        duration: formDuration.trim() || 'Chưa xác định',
        instructor: user?.displayName || user?.email || 'iGen Academy',
        companyCode: comp,
        lessons: cleanLessons,
        quizzes: cleanQuizzes,
      };

      if (editingCourse) {
        const updated = await updateTrainingCourse(editingCourse.id, payload);
        setCourses((prev) => prev.map((c) => (c.id === editingCourse.id ? { ...c, ...updated } : c)));
        if (selectedCourse?.id === editingCourse.id) {
          setSelectedCourse((prev) => (prev ? { ...prev, ...updated } : prev));
        }
        Alert.alert('Đã lưu', 'Cập nhật khóa học thành công.');
      } else {
        const created = await createTrainingCourse({
          ...payload,
          creatorUid: currentUid,
          enrolledCount: 0,
          companyProgress: 0,
        });
        setCourses((prev) => [created, ...prev]);
        Alert.alert('Thành công', `Đã tạo khóa học "${created.title}".`);
      }
      setFormOpen(false);
    } catch (err) {
      Alert.alert('Lỗi lưu khóa học', err instanceof Error ? err.message : 'Vui lòng thử lại.');
    } finally {
      setSavingCourse(false);
    }
  }, [
    companyCode,
    currentUid,
    editingCourse,
    formAutoOnboarding,
    formCategory,
    formDesc,
    formDuration,
    formLessons,
    formQuizzes,
    formRequired,
    formTitle,
    savingCourse,
    selectedCourse?.id,
    user?.companyCode,
    user?.displayName,
    user?.email,
  ]);

  const handleDeleteCourse = useCallback(
    (course: HrTrainingCourse) => {
      showHrConfirm({
        title: 'Xóa khóa học?',
        message: `Bạn có chắc muốn xóa "${course.title || course.name}"?`,
        confirmLabel: 'Xóa khóa học',
        onConfirm: async () => {
          try {
            await deleteTrainingCourse(course.id);
            setCourses((prev) => prev.filter((c) => c.id !== course.id));
            if (selectedCourse?.id === course.id) setSelectedCourse(null);
          } catch (err) {
            Alert.alert('Lỗi xóa', err instanceof Error ? err.message : 'Không thể xóa khóa học.');
          }
        },
      });
    },
    [selectedCourse?.id],
  );

  // ================= DETAIL / STUDY ROOM SCREEN =================
  if (selectedCourse) {
    const lessons = selectedCourse.lessons || [];
    const quizzes = selectedCourse.quizzes || [];
    const enroll = myEnrollments.find((e) => e.courseId === selectedCourse.id && e.uid === currentUid);
    const progress = enroll?.progress ?? 0;
    const completedLessons = enroll?.completedLessons || [];
    const isLessonsDone = lessons.every((_, idx) => completedLessons.includes(`lesson_${idx}`));
    const isQuizPassed = Boolean(enroll?.quizPassed);
    const canEditThis = isSupervisor;

    return (
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Top bar */}
        <View style={styles.detailTopBar}>
          <Pressable onPress={() => setSelectedCourse(null)} style={styles.backBtn}>
            <View style={styles.iconButtonContent}><ArrowLeft size={14} color={colors.ink} /><Text style={styles.backBtnText}>Danh sách</Text></View>
          </Pressable>
          {canEditThis ? (
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Pressable onPress={() => openEditCourse(selectedCourse)} style={styles.smallEditBtn}>
                <Text style={styles.smallEditBtnText}>Sửa</Text>
              </Pressable>
              <Pressable onPress={() => handleDeleteCourse(selectedCourse)} style={styles.smallDelBtn}>
                <Text style={styles.smallDelBtnText}>Xóa</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* Course Header & Progress Card */}
        <Card style={styles.heroCard}>
          <View style={styles.badgeRow}>
            <Text style={styles.categoryBadge}>{selectedCourse.category || 'Đào tạo'}</Text>
            {selectedCourse.isRequired ? <Text style={styles.requiredBadge}>Bắt buộc</Text> : null}
          </View>
          <Text style={styles.heroTitle}>{selectedCourse.title || selectedCourse.name}</Text>
          <View style={styles.courseMetaRow}>
            <UserRound size={13} color={colors.muted} />
            <Text style={styles.subMeta}>Giảng viên: {selectedCourse.instructor || 'Chưa cập nhật'}</Text>
            {selectedCourse.duration ? <><Clock3 size={13} color={colors.muted} /><Text style={styles.subMeta}>{selectedCourse.duration}</Text></> : null}
          </View>

          <View style={styles.progressSection}>
            <View style={styles.headRow}>
              <Text style={styles.progressLabel}>Tiến độ hoàn thành</Text>
              <Text style={styles.progressPct}>{progress}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.min(100, progress)}%` }]} />
            </View>
          </View>

          {isSupervisor && progress < 100 ? (
            <Pressable
              disabled={submittingProgress}
              onPress={() => void handleCompleteDirectly()}
              style={styles.bypassBtn}
            >
              <Text style={styles.bypassBtnText}>Bỏ qua & Hoàn thành học (Quản lý)</Text>
            </Pressable>
          ) : null}
        </Card>

        {/* Syllabus navigation pills */}
        <Text style={styles.sectionTitle}>Mục lục khóa học</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 7, paddingBottom: 10 }}
        >
          <Pressable
            onPress={() => {
              setActiveIndex(-1);
              setQuizSubmitted(false);
            }}
            style={[styles.syllabusPill, activeIndex === -1 && styles.syllabusPillActive]}
          >
            <View style={styles.iconButtonContent}><BookOpen size={13} color={activeIndex === -1 ? colors.white : colors.primary} /><Text style={[styles.syllabusText, activeIndex === -1 && styles.syllabusTextActive]}>Giới thiệu</Text></View>
          </Pressable>

          {lessons.map((les, idx) => {
            const done = completedLessons.includes(`lesson_${idx}`);
            const active = activeIndex === idx;
            return (
              <Pressable
                key={idx}
                onPress={() => {
                  setActiveIndex(idx);
                  setQuizSubmitted(false);
                }}
                style={[styles.syllabusPill, active && styles.syllabusPillActive]}
              >
                <View style={styles.iconButtonContent}>
                  {done ? <CircleCheck size={13} color={active ? colors.white : '#16885A'} /> : les.type === 'video' || les.type === 'youtube' ? <Video size={13} color={active ? colors.white : colors.primary} /> : <FileText size={13} color={active ? colors.white : colors.primary} />}
                  <Text style={[styles.syllabusText, active && styles.syllabusTextActive]} numberOfLines={1}>Bài {idx + 1}: {les.title}</Text>
                </View>
              </Pressable>
            );
          })}

          {quizzes.length > 0 ? (
            <Pressable
              onPress={() => {
                if (!isLessonsDone) {
                  Alert.alert('Chưa mở khóa', 'Bạn cần hoàn thành tất cả bài giảng trước khi thi sát hạch.');
                  return;
                }
                setActiveIndex(lessons.length);
              }}
              style={[
                styles.syllabusPill,
                activeIndex === lessons.length && styles.syllabusPillActive,
                !isLessonsDone && styles.disabled,
              ]}
            >
              <View style={styles.iconButtonContent}>
                {isQuizPassed ? <CircleCheck size={13} color={activeIndex === lessons.length ? colors.white : '#16885A'} /> : <ClipboardList size={13} color={activeIndex === lessons.length ? colors.white : colors.primary} />}
              <Text
                style={[
                  styles.syllabusText,
                  activeIndex === lessons.length && styles.syllabusTextActive,
                ]}
              >
                Thi trắc nghiệm ({quizzes.length})
              </Text>
              </View>
            </Pressable>
          ) : null}
        </ScrollView>

        {/* Section 1: Overview / Intro */}
        {activeIndex === -1 ? (
          <Card style={styles.studyCard}>
            <Text style={styles.studyHeading}>Giới thiệu khóa học</Text>
            <Text style={styles.studyBody}>
              {selectedCourse.description || 'Khóa học chưa có mô tả chi tiết.'}
            </Text>

            <View style={styles.overviewBox}>
              <Text style={styles.overviewTitle}>Nội dung học</Text>
              <View style={styles.overviewBulletRow}>
                <Circle size={5} color={colors.primary} fill={colors.primary} />
                <Text style={styles.overviewBullet}>{lessons.length} bài giảng</Text>
              </View>
              <View style={styles.overviewBulletRow}>
                <Circle size={5} color={colors.primary} fill={colors.primary} />
                <Text style={styles.overviewBullet}>
                  {quizzes.length > 0
                    ? `Đạt 100% bài kiểm tra trắc nghiệm (${quizzes.length} câu)`
                    : 'Hoàn thành tất cả bài giảng'}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => {
                if (lessons.length > 0) {
                  setActiveIndex(0);
                } else if (quizzes.length > 0) {
                  setActiveIndex(0);
                } else {
                  Alert.alert('Thông báo', 'Khóa học chưa có nội dung bài giảng.');
                }
              }}
              style={styles.submitBtn}
            >
              <View style={styles.iconButtonContent}><Play size={14} color={colors.white} /><Text style={styles.submitBtnText}>Bắt đầu học</Text></View>
            </Pressable>
          </Card>
        ) : null}

        {/* Section 2: Active Lesson */}
        {activeIndex >= 0 && activeIndex < lessons.length ? (() => {
          const les = lessons[activeIndex];
          const isCompleted = completedLessons.includes(`lesson_${activeIndex}`);
          const isVideo = les.type === 'video' || les.type === 'youtube';
          return (
            <Card style={styles.studyCard}>
              <View style={styles.courseMetaRow}>
                <Text style={styles.lessonCounter}>Bài giảng {activeIndex + 1} / {lessons.length}</Text>
                {isCompleted ? <View style={styles.iconButtonContent}><Check size={13} color="#16885A" /><Text style={styles.lessonCounter}>Đã hoàn thành</Text></View> : null}
              </View>
              <Text style={styles.studyHeading}>{les.title}</Text>

              {les.url ? (
                <Pressable
                  onPress={() => void Linking.openURL(les.url!)}
                  style={styles.resourceBox}
                >
                  <View style={styles.iconButtonContent}>{isVideo ? <Video size={15} color={colors.primary} /> : <Paperclip size={15} color={colors.primary} />}<Text style={styles.resourceTitle}>{isVideo ? 'Mở video bài giảng' : 'Mở tài liệu đính kèm'}</Text></View>
                  <Text numberOfLines={2} style={styles.resourceUrl}>
                    {les.fileName || les.url}
                  </Text>
                </Pressable>
              ) : null}

              {les.content ? (
                <View style={styles.lessonContentBox}>
                  <Text style={styles.studyBody}>{les.content}</Text>
                </View>
              ) : !les.url ? (
                <Text style={styles.muted}>Bài giảng này chưa có nội dung hoặc tài liệu đính kèm.</Text>
              ) : null}

              <View style={styles.studyFooter}>
                <Pressable
                  onPress={() => setActiveIndex((prev) => prev - 1)}
                  style={styles.cancelBtn}
                >
                  <View style={styles.iconButtonContent}><ArrowLeft size={14} color={colors.ink} /><Text style={styles.cancelBtnText}>Bài trước</Text></View>
                </Pressable>
                <Pressable
                  disabled={submittingProgress}
                  onPress={() => void handleMarkLessonComplete(activeIndex)}
                  style={[styles.submitBtn, { flex: 1, marginTop: 0 }, submittingProgress && styles.disabled]}
                >
                  <View style={styles.iconButtonContent}>
                    {!submittingProgress ? <>{activeIndex === lessons.length - 1 && quizzes.length === 0 ? <Check size={14} color={colors.white} /> : <ArrowRight size={14} color={colors.white} />}</> : null}
                    <Text style={styles.submitBtnText}>
                      {submittingProgress ? 'Đang lưu...' : activeIndex === lessons.length - 1 ? quizzes.length > 0 ? 'Hoàn thành & Làm bài thi' : 'Hoàn thành khóa học' : 'Hoàn thành bài & Tiếp tục'}
                    </Text>
                  </View>
                </Pressable>
              </View>
            </Card>
          );
        })() : null}

        {/* Section 3: Quiz */}
        {activeIndex === lessons.length && quizzes.length > 0 ? (
          <Card style={styles.studyCard}>
            <Text style={styles.quizTag}>ĐÁNH GIÁ SÁT HẠCH TRẮC NGHIỆM</Text>
            <Text style={styles.studyHeading}>Bài thi cuối khóa</Text>
            <Text style={styles.muted}>
              Trả lời đúng 100% số câu hỏi ({quizzes.length} câu) để hoàn thành khóa học.
            </Text>

            <View style={{ gap: 12, marginTop: 6 }}>
              {quizzes.map((q, qIdx) => {
                const isErr = quizSubmitted && quizErrors[qIdx];
                return (
                  <View key={qIdx} style={[styles.quizBox, isErr && styles.quizBoxError]}>
                    <Text style={styles.quizQuestion}>
                      Q{qIdx + 1}: {q.question}
                    </Text>
                    <View style={{ gap: 6, marginTop: 8 }}>
                      {q.options.map((opt, oIdx) => {
                        const chosen = quizAnswers[qIdx] === oIdx;
                        return (
                          <Pressable
                            key={oIdx}
                            disabled={isQuizPassed}
                            onPress={() => {
                              setQuizAnswers((prev) => ({ ...prev, [qIdx]: oIdx }));
                              if (quizSubmitted) {
                                setQuizErrors((prev) => ({ ...prev, [qIdx]: false }));
                              }
                            }}
                            style={[styles.quizOption, chosen && styles.quizOptionActive]}
                          >
                            <View style={[styles.radioOuter, chosen && styles.radioOuterActive]}>
                              {chosen ? <View style={styles.radioInner} /> : null}
                            </View>
                            <Text style={[styles.quizOptionText, chosen && styles.quizOptionTextActive]}>
                              {opt}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    {isErr ? (
                      <Text style={styles.quizErrorText}>Câu trả lời chưa chính xác. Vui lòng chọn lại.</Text>
                    ) : null}
                  </View>
                );
              })}
            </View>

            <View style={styles.studyFooter}>
              {lessons.length > 0 ? (
                <Pressable onPress={() => setActiveIndex(lessons.length - 1)} style={styles.cancelBtn}>
                  <View style={styles.iconButtonContent}><ArrowLeft size={14} color={colors.ink} /><Text style={styles.cancelBtnText}>Bài giảng</Text></View>
                </Pressable>
              ) : null}
              {isQuizPassed ? (
                <Pressable
                  onPress={() => {
                    setSelectedCourse(null);
                    void load(true);
                  }}
                  style={[styles.submitBtn, { flex: 1, marginTop: 0, backgroundColor: '#16885A' }]}
                >
                  <View style={styles.iconButtonContent}><Check size={14} color={colors.white} /><Text style={styles.submitBtnText}>Hoàn thành khóa học</Text></View>
                </Pressable>
              ) : (
                <Pressable
                  disabled={submittingProgress}
                  onPress={() => void handleSubmitQuiz()}
                  style={[styles.submitBtn, { flex: 1, marginTop: 0 }, submittingProgress && styles.disabled]}
                >
                  <View style={styles.iconButtonContent}>{!submittingProgress ? <ArrowRight size={14} color={colors.white} /> : null}<Text style={styles.submitBtnText}>{submittingProgress ? 'Đang chấm điểm...' : 'Nộp bài thi & Đánh giá'}</Text></View>
                </Pressable>
              )}
            </View>
          </Card>
        ) : null}

        {renderCourseFormModal()}
      </ScrollView>
    );
  }

  // ================= CREATE / EDIT COURSE MODAL =================
  function renderCourseFormModal() {
    return (
      <Modal visible={formOpen} transparent animationType="slide" onRequestClose={() => setFormOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setFormOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.headRow}>
              <Text style={styles.sheetTitle}>
                {editingCourse ? 'Cập nhật khóa học' : 'Tạo khóa học mới'}
              </Text>
              <Pressable onPress={() => setFormOpen(false)} hitSlop={8}>
                <Text style={styles.closeText}>Đóng</Text>
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 540 }}>
              <View style={{ gap: 8, paddingBottom: 14 }}>
                <Text style={styles.label}>Tên khóa học *</Text>
                <TextInput
                  value={formTitle}
                  onChangeText={setFormTitle}
                  placeholder="VD: Quy chế bảo mật & văn hóa công ty"
                  placeholderTextColor={colors.muted}
                  style={styles.field}
                />

                <Text style={styles.label}>Mô tả tóm tắt</Text>
                <TextInput
                  value={formDesc}
                  onChangeText={setFormDesc}
                  multiline
                  placeholder="Nội dung chính khóa học..."
                  placeholderTextColor={colors.muted}
                  style={[styles.field, { minHeight: 62, textAlignVertical: 'top' }]}
                />

                <Text style={styles.label}>Danh mục đào tạo</Text>
                <View style={styles.wrapRow}>
                  {CATEGORIES.map((cat) => {
                    const active = formCategory === cat;
                    return (
                      <Pressable
                        key={cat}
                        onPress={() => setFormCategory(cat)}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.label}>Thời lượng học</Text>
                <TextInput
                  value={formDuration}
                  onChangeText={setFormDuration}
                  placeholder="VD: 2 giờ 30 phút"
                  placeholderTextColor={colors.muted}
                  style={styles.field}
                />

                <View style={styles.switchRow}>
                  <Text style={styles.label}>Khóa học bắt buộc</Text>
                  <Switch
                    value={formRequired}
                    onValueChange={setFormRequired}
                    trackColor={{ true: colors.primary, false: '#CBD5E1' }}
                  />
                </View>
                <View style={styles.switchRow}>
                  <Text style={styles.label}>Tự động giao khi có nhân sự mới</Text>
                  <Switch
                    value={formAutoOnboarding}
                    onValueChange={setFormAutoOnboarding}
                    trackColor={{ true: colors.primary, false: '#CBD5E1' }}
                  />
                </View>

                {/* Lessons builder */}
                <View style={styles.builderHeader}>
                  <Text style={styles.label}>Bài giảng ({formLessons.length})</Text>
                  <Pressable
                    onPress={() =>
                      setFormLessons((prev) => [...prev, { title: '', type: 'text', url: '', content: '' }])
                    }
                    style={styles.addSmallBtn}
                  >
                    <View style={styles.iconButtonContent}><Plus size={13} color={colors.primary} /><Text style={styles.addSmallBtnText}>Thêm bài</Text></View>
                  </Pressable>
                </View>
                {formLessons.map((les, idx) => (
                  <View key={idx} style={styles.builderCard}>
                    <View style={styles.headRow}>
                      <Text style={styles.codeBadge}>Bài {idx + 1}</Text>
                      <Pressable
                        onPress={() => setFormLessons((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        <Text style={styles.smallDelBtnText}>Xóa</Text>
                      </Pressable>
                    </View>
                    <TextInput
                      value={les.title}
                      onChangeText={(v) =>
                        setFormLessons((prev) => prev.map((item, i) => (i === idx ? { ...item, title: v } : item)))
                      }
                      placeholder="Tên bài giảng *"
                      placeholderTextColor={colors.muted}
                      style={styles.field}
                    />
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {(['text', 'video'] as const).map((t) => (
                        <Pressable
                          key={t}
                          onPress={() =>
                            setFormLessons((prev) => prev.map((item, i) => (i === idx ? { ...item, type: t } : item)))
                          }
                          style={[styles.chip, les.type === t && styles.chipActive]}
                        >
                          <Text style={[styles.chipText, les.type === t && styles.chipTextActive]}>
                            {t === 'video' ? 'Video' : 'Văn bản / Tài liệu'}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <TextInput
                      value={les.url || ''}
                      onChangeText={(v) =>
                        setFormLessons((prev) => prev.map((item, i) => (i === idx ? { ...item, url: v } : item)))
                      }
                      placeholder={les.type === 'video' ? 'Link YouTube / Video...' : 'Link tài liệu (tùy chọn)'}
                      placeholderTextColor={colors.muted}
                      autoCapitalize="none"
                      style={styles.field}
                    />
                    {les.type !== 'video' ? (
                      <TextInput
                        value={les.content || ''}
                        onChangeText={(v) =>
                          setFormLessons((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, content: v } : item)),
                          )
                        }
                        multiline
                        placeholder="Nội dung lý thuyết..."
                        placeholderTextColor={colors.muted}
                        style={[styles.field, { minHeight: 54, textAlignVertical: 'top' }]}
                      />
                    ) : null}
                  </View>
                ))}

                {/* Quiz builder */}
                <View style={styles.builderHeader}>
                  <Text style={styles.label}>Trắc nghiệm MCQ ({formQuizzes.length})</Text>
                  <Pressable
                    onPress={() =>
                      setFormQuizzes((prev) => [
                        ...prev,
                        { question: '', options: ['', ''], correctOptionIndex: 0 },
                      ])
                    }
                    style={styles.addSmallBtn}
                  >
                    <View style={styles.iconButtonContent}><Plus size={13} color={colors.primary} /><Text style={styles.addSmallBtnText}>Thêm câu hỏi</Text></View>
                  </Pressable>
                </View>
                {formQuizzes.map((q, qIdx) => (
                  <View key={qIdx} style={styles.builderCard}>
                    <View style={styles.headRow}>
                      <Text style={styles.codeBadge}>Câu {qIdx + 1}</Text>
                      <Pressable
                        onPress={() => setFormQuizzes((prev) => prev.filter((_, i) => i !== qIdx))}
                      >
                        <Text style={styles.smallDelBtnText}>Xóa</Text>
                      </Pressable>
                    </View>
                    <TextInput
                      value={q.question}
                      onChangeText={(v) =>
                        setFormQuizzes((prev) => prev.map((item, i) => (i === qIdx ? { ...item, question: v } : item)))
                      }
                      placeholder="Nội dung câu hỏi *"
                      placeholderTextColor={colors.muted}
                      style={styles.field}
                    />
                    {q.options.map((opt, oIdx) => {
                      const isCorrect = q.correctOptionIndex === oIdx;
                      return (
                        <View key={oIdx} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Pressable
                            onPress={() =>
                              setFormQuizzes((prev) =>
                                prev.map((item, i) =>
                                  i === qIdx ? { ...item, correctOptionIndex: oIdx } : item,
                                ),
                              )
                            }
                            style={[styles.radioOuter, isCorrect && styles.radioOuterActive]}
                          >
                            {isCorrect ? <View style={styles.radioInner} /> : null}
                          </Pressable>
                          <TextInput
                            value={opt}
                            onChangeText={(v) =>
                              setFormQuizzes((prev) =>
                                prev.map((item, i) => {
                                  if (i !== qIdx) return item;
                                  const nextOpts = [...item.options];
                                  nextOpts[oIdx] = v;
                                  return { ...item, options: nextOpts };
                                }),
                              )
                            }
                            placeholder={`Đáp án ${oIdx + 1}`}
                            placeholderTextColor={colors.muted}
                            style={[styles.field, { flex: 1 }]}
                          />
                        </View>
                      );
                    })}
                    <Pressable
                      onPress={() =>
                        setFormQuizzes((prev) =>
                          prev.map((item, i) =>
                            i === qIdx ? { ...item, options: [...item.options, ''] } : item,
                          ),
                        )
                      }
                    >
                      <View style={styles.iconButtonContent}><Plus size={13} color={colors.primary} /><Text style={styles.addSmallBtnText}>Thêm đáp án</Text></View>
                    </Pressable>
                  </View>
                ))}

                <Pressable
                  disabled={savingCourse}
                  onPress={() => void handleSaveCourse()}
                  style={[styles.submitBtn, savingCourse && styles.disabled]}
                >
                  <Text style={styles.submitBtnText}>
                    {savingCourse
                      ? 'Đang lưu...'
                      : editingCourse
                        ? 'Cập nhật khóa học'
                        : 'Đăng tải khóa học'}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  // ================= COURSE CATALOG LIST =================
  const monitoredEmployee = monitorUid
    ? employees.find((e) => (e.uid || e._id || e.id) === monitorUid)
    : undefined;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load(true);
          }}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      <View style={styles.searchRow}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Tìm theo tên, danh mục, giảng viên..."
          placeholderTextColor={colors.muted}
          style={[styles.field, { flex: 1 }]}
        />
        {isSupervisor ? (
          <Pressable onPress={openCreateCourse} style={styles.primaryBtn}>
            <View style={styles.iconButtonContent}><Plus size={13} color={colors.white} /><Text style={styles.primaryBtnText}>Khóa học</Text></View>
          </Pressable>
        ) : null}
      </View>

      {isSupervisor ? (
        <View style={styles.monitorBar}>
          <Pressable onPress={() => setMonitorModalOpen(true)} style={styles.monitorChip}>
            <View style={styles.iconButtonContent}><Eye size={14} color={colors.primary} /><Text style={styles.monitorChipText}>{monitoredEmployee ? `Tiến độ: ${monitoredEmployee.displayName}` : 'Giám sát tiến độ nhân viên'}</Text>{!monitoredEmployee ? <ChevronDown size={13} color={colors.primary} /> : null}</View>
          </Pressable>
          {monitorUid ? (
            <Pressable onPress={() => setMonitorUid('')} style={styles.clearMonitorBtn}>
              <Text style={styles.clearMonitorText}>Xem của tôi</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {loading ? (
        <Card style={styles.stateCard}>
          <ActivityIndicator size="small" color={colors.primary} />
        </Card>
      ) : error ? (
        <Card style={styles.stateCard}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => void load()} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Thử lại</Text>
          </Pressable>
        </Card>
      ) : !filteredCourses.length ? (
        <Card style={styles.stateCard}>
          <Text style={styles.muted}>Chưa có khóa học đào tạo nào.</Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {filteredCourses.map((course) => {
            const enroll = findEnrollment(course.id);
            const progress = enroll?.progress ?? 0;
            const isDone = enroll?.status === 'completed';
            const actionLabel = !enroll ? 'Bắt đầu' : isDone ? 'Xem lại' : 'Tiếp tục';
            const createdLabel = formatDate(course.createdAt);
            return (
              <Card
                key={course.id}
                onPress={() => {
                  if (!monitorUid) void openCourseDetail(course);
                }}
                style={styles.card}
              >
                <View style={styles.headRow}>
                  <View style={styles.badgeRow}>
                    <Text style={styles.categoryBadge}>{course.category || 'Đào tạo'}</Text>
                    {course.isRequired ? <Text style={styles.requiredBadge}>Bắt buộc</Text> : null}
                    {isDone ? <View style={styles.iconButtonContent}><Check size={12} color="#16885A" /><Text style={styles.doneBadge}>Hoàn thành</Text></View> : null}
                  </View>
                  {createdLabel ? <Text style={styles.subMeta}>{createdLabel}</Text> : null}
                </View>

                <Text style={styles.rowTitle}>{course.title || course.name}</Text>

                {course.description ? (
                  <Text numberOfLines={2} style={styles.muted}>
                    {course.description}
                  </Text>
                ) : null}

                <View style={styles.courseMetaRow}>
                  <UserRound size={13} color={colors.muted} /><Text style={styles.subMeta}>{course.instructor || 'Chưa cập nhật'}</Text>
                  <BookOpen size={13} color={colors.muted} /><Text style={styles.subMeta}>{course.lessons?.length ?? 0} bài học</Text>
                  {(course.quizzes?.length ?? 0) > 0 ? <><ClipboardList size={13} color={colors.muted} /><Text style={styles.subMeta}>{course.quizzes?.length} câu thi</Text></> : null}
                </View>

                <View style={styles.cardFooter}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${Math.min(100, progress)}%` }]} />
                    </View>
                    <Text style={styles.subMeta}>Tiến độ: {progress}%</Text>
                  </View>
                  {!monitorUid ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {isSupervisor ? (
                        <>
                          <Pressable
                            onPress={(e) => {
                              e.stopPropagation?.();
                              openEditCourse(course);
                            }}
                            style={styles.smallEditBtn}
                          >
                            <Text style={styles.smallEditBtnText}>Sửa</Text>
                          </Pressable>
                          <Pressable
                            onPress={(e) => {
                              e.stopPropagation?.();
                              handleDeleteCourse(course);
                            }}
                            style={styles.smallDelBtn}
                          >
                            <Text style={styles.smallDelBtnText}>Xóa</Text>
                          </Pressable>
                        </>
                      ) : null}
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation?.();
                          void openCourseDetail(course);
                        }}
                        style={[styles.actionBtn, isDone && styles.actionBtnDone]}
                      >
                        <Text style={styles.actionBtnText}>{actionLabel}</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              </Card>
            );
          })}
        </View>
      )}

      {/* Employee monitor picker modal */}
      <Modal
        visible={monitorModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setMonitorModalOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setMonitorModalOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.headRow}>
              <Text style={styles.sheetTitle}>Giám sát tiến độ nhân viên</Text>
              <Pressable onPress={() => setMonitorModalOpen(false)} hitSlop={8}>
                <Text style={styles.closeText}>Đóng</Text>
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 360 }}>
              <Pressable
                onPress={() => {
                  setMonitorUid('');
                  setMonitorModalOpen(false);
                }}
                style={[styles.pickerRow, !monitorUid && styles.pickerRowActive]}
              >
                <Text style={styles.rowTitle}>Khóa học của tôi</Text>
              </Pressable>
              {employees.map((emp) => {
                const uid = emp.uid || emp._id || emp.id || '';
                const selected = monitorUid === uid;
                return (
                  <Pressable
                    key={uid}
                    onPress={() => {
                      setMonitorUid(uid);
                      setMonitorModalOpen(false);
                    }}
                    style={[styles.pickerRow, selected && styles.pickerRowActive]}
                  >
                    <Text style={styles.rowTitle}>{emp.displayName}</Text>
                    <Text style={styles.subMeta}>{emp.jobTitle || emp.role || 'Nhân viên'}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {renderCourseFormModal()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingBottom: 28 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  monitorBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  monitorChip: { backgroundColor: '#EAF2FF', borderColor: '#CBE0FF', borderWidth: 1, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 99 },
  monitorChipText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  clearMonitorBtn: { paddingHorizontal: 8, paddingVertical: 5 },
  clearMonitorText: { color: '#B91C1C', fontSize: 11, fontWeight: '700' },
  primaryBtn: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 },
  primaryBtnText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  iconButtonContent: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  courseMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 },
  stateCard: { padding: 20, alignItems: 'center', gap: 10 },
  errorText: { color: '#B91C1C', fontSize: 12, textAlign: 'center' },
  list: { gap: 10 },
  card: { padding: 13, gap: 6 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 },
  categoryBadge: { color: colors.primary, backgroundColor: '#EAF2FF', fontSize: 9, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  requiredBadge: { color: '#B45309', backgroundColor: '#FFF3E5', fontSize: 9, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  doneBadge: { color: '#16885A', backgroundColor: '#E9F8F1', fontSize: 9, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  codeBadge: { color: colors.primary, backgroundColor: '#EAF2FF', fontSize: 10, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  rowTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  subMeta: { color: colors.muted, fontSize: 10 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  progressTrack: { height: 6, backgroundColor: '#E2E8F0', borderRadius: 99, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 99 },
  actionBtn: { backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 9 },
  actionBtnDone: { backgroundColor: '#16885A' },
  actionBtnText: { color: colors.white, fontSize: 11, fontWeight: '700' },

  // Detail / Study Room
  detailTopBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  backBtn: { backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  backBtnText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  smallEditBtn: { backgroundColor: '#EAF2FF', paddingHorizontal: 11, paddingVertical: 7, borderRadius: 9 },
  smallEditBtnText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  smallDelBtn: { backgroundColor: '#FEE2E2', paddingHorizontal: 11, paddingVertical: 7, borderRadius: 9 },
  smallDelBtnText: { color: '#B91C1C', fontSize: 11, fontWeight: '700' },
  heroCard: { padding: 14, gap: 6, marginBottom: 12 },
  heroTitle: { color: colors.ink, fontSize: 16, fontWeight: '800', lineHeight: 22 },
  progressSection: { gap: 5, marginTop: 4 },
  progressLabel: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  progressPct: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  bypassBtn: { marginTop: 6, borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  bypassBtnText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  sectionTitle: { color: colors.ink, fontSize: 12, fontWeight: '800', marginBottom: 6 },
  syllabusPill: { backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8, maxWidth: 190 },
  syllabusPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  syllabusText: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  syllabusTextActive: { color: colors.white },
  studyCard: { padding: 15, gap: 10 },
  lessonCounter: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  studyHeading: { color: colors.ink, fontSize: 15, fontWeight: '800', lineHeight: 21 },
  studyBody: { color: colors.ink, fontSize: 12, lineHeight: 19 },
  overviewBox: { backgroundColor: '#F8FAFC', borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 12, gap: 5 },
  overviewTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  overviewBullet: { color: colors.muted, fontSize: 12 },
  overviewBulletRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  resourceBox: { backgroundColor: '#F0F7FF', borderColor: '#CBE0FF', borderWidth: 1, borderRadius: 12, padding: 12, gap: 4 },
  resourceTitle: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  resourceUrl: { color: colors.muted, fontSize: 11 },
  lessonContentBox: { backgroundColor: '#F8FAFC', borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 12 },
  studyFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },

  // Quiz
  quizTag: { color: '#16885A', fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  quizBox: { backgroundColor: '#F8FAFC', borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 12 },
  quizBoxError: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  quizQuestion: { color: colors.ink, fontSize: 12, fontWeight: '800', lineHeight: 18 },
  quizOption: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: 10 },
  quizOptionActive: { backgroundColor: '#EAF2FF', borderColor: colors.primary },
  quizOptionText: { color: colors.ink, fontSize: 12, flex: 1 },
  quizOptionTextActive: { color: colors.primary, fontWeight: '700' },
  quizErrorText: { color: '#B91C1C', fontSize: 11, fontWeight: '600', marginTop: 6 },
  radioOuter: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' },
  radioOuterActive: { borderColor: colors.primary },
  radioInner: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary },

  // Modal & Form
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.42)', justifyContent: 'center', padding: 16 },
  sheet: { backgroundColor: colors.white, borderRadius: 24, overflow: 'hidden', padding: 18, gap: 10, maxHeight: '90%' },
  sheetTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  closeText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  label: { color: colors.ink, fontSize: 11, fontWeight: '700', marginTop: 4 },
  field: { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 9, fontSize: 12, color: colors.ink },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  chipTextActive: { color: colors.white },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  builderHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  builderCard: { backgroundColor: '#F8FAFC', borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 10, gap: 7 },
  addSmallBtn: { backgroundColor: '#EAF2FF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  addSmallBtnText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  pickerRow: { padding: 12, borderRadius: 11, backgroundColor: '#F8FAFC', marginBottom: 6 },
  pickerRowActive: { backgroundColor: '#EAF2FF' },
  submitBtn: { backgroundColor: colors.primary, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 6, paddingHorizontal: 14 },
  submitBtnText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  cancelBtn: { backgroundColor: '#F1F5F9', minHeight: 44, paddingHorizontal: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  disabled: { opacity: 0.45 },
});

