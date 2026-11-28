import { PopupError } from '@/components/PopupError';
import { FullScreenFormModal, SlideInPage } from '@/components/FullScreenFormModal';
import {
  HrFormCustomRow,
  HrFormInputRow,
  HrFormSectionTitle,
  HrFormSelectRow,
  HrFormSwitchRow,
} from '@/features/hr/components/HrFormFields';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  Ellipsis,
  Eye,
  FileText,
  Paperclip,
  Pencil,
  Play,
  Plus,
  Trash2,
  UserRound,
  Video,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';
import { Card } from '@/components/Card';
import { IgenHrEmptyState } from '@/components/EmptyStateIllustration';
import { showHrConfirm } from '@/features/hr/components/HrConfirmModal';
import { HrFab } from '@/features/hr/components/HrFab';
import { HrNoticeHost, showHrNotice } from '@/features/hr/components/HrNoticeModal';
import { useAuth } from '@/core/auth/AuthProvider';
import { ApiError } from '@/core/network/apiClient';
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

function IntroCourseIcon({ size = 17, color = colors.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Clean course overview card with info dot & structured intro lines */}
      <Rect
        x="3.5"
        y="4"
        width="17"
        height="16"
        rx="3"
        stroke={color}
        strokeWidth="1.65"
      />
      {/* Top header divider */}
      <Path d="M3.5 9H20.5" stroke={color} strokeWidth="1.5" />
      {/* Mini header dots */}
      <Path d="M6.8 6.5H7.2" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path d="M9.8 6.5H10.2" stroke={color} strokeWidth="2" strokeLinecap="round" />
      {/* Small info "i" mark on left + intro text lines on right */}
      <Path d="M7.5 12.2H7.55" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path d="M7.5 14.6V17" stroke={color} strokeWidth="1.65" strokeLinecap="round" />
      <Path d="M11 13H17.2" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <Path d="M11 16.3H15.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

function LessonCountIcon({ size = 14, color = colors.muted }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Stacked book / lesson cover with bookmark & page detail lines */}
      <Rect
        x="4"
        y="3.5"
        width="16"
        height="17"
        rx="2.4"
        stroke={color}
        strokeWidth="1.85"
      />
      {/* Left binding spine */}
      <Path d="M8 3.5V20.5" stroke={color} strokeWidth="1.75" />
      {/* Bookmark tab at top-right */}
      <Path
        d="M14.5 3.5V9.2L16.25 7.9L18 9.2V3.5"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Crisp lesson text lines */}
      <Path d="M11 12.2H17" stroke={color} strokeWidth="1.65" strokeLinecap="round" />
      <Path d="M11 15.6H15.5" stroke={color} strokeWidth="1.65" strokeLinecap="round" />
    </Svg>
  );
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
  const insets = useSafeAreaInsets();
  const [selectedCourse, setSelectedCourse] = useState<HrTrainingCourse | null>(null);
  const [activeIndex, setActiveIndex] = useState<number>(-1); // -1 = intro, 0..n-1 = lesson, n = quiz
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
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
  const [contentEditorOpen, setContentEditorOpen] = useState(false);
  const [contentEditorKind, setContentEditorKind] = useState<'lesson' | 'quiz'>('lesson');
  const [editingContentIndex, setEditingContentIndex] = useState<number | null>(null);
  const [lessonDraft, setLessonDraft] = useState<HrTrainingLesson>({ title: '', type: 'text', url: '', content: '' });
  const [quizDraft, setQuizDraft] = useState<HrTrainingQuiz>({ question: '', options: ['', ''], correctOptionIndex: 0 });
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
          showHrNotice('Chúc mừng', `Bạn đã hoàn thành khóa học "${selectedCourse.title || selectedCourse.name}"!`);
          setSelectedCourse(null);
          void load(true);
        }
      } catch (err) {
        showHrNotice('Lỗi', err instanceof Error ? err.message : 'Không thể lưu tiến độ bài học.');
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
      showHrNotice('Chưa hoàn tất', 'Vui lòng trả lời đầy đủ tất cả các câu hỏi trắc nghiệm.');
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
      showHrNotice('Chưa đạt', 'Có câu trả lời chưa đúng. Hãy kiểm tra lại các câu được đánh dấu đỏ.');
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
      showHrNotice('Xuất sắc!', 'Bạn đã trả lời đúng 100% các câu hỏi trắc nghiệm!');
    } catch (err) {
      if (err instanceof ApiError && [502, 503, 504].includes(err.status)) {
        showHrNotice('ERP đang tạm thời gián đoạn', 'Câu trả lời của bạn vẫn được giữ lại. Hãy thử nộp lại sau giây lát.', 'error');
      } else {
        showHrNotice('Lỗi', err instanceof Error ? err.message : 'Không thể lưu kết quả bài thi.', 'error');
      }
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
      showHrNotice('Hoàn thành', `Đã đánh dấu hoàn thành khóa học "${selectedCourse.title || selectedCourse.name}".`);
      setSelectedCourse(null);
      void load(true);
    } catch (err) {
      showHrNotice('Lỗi', err instanceof Error ? err.message : 'Không thể hoàn thành khóa học.');
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
    setContentEditorOpen(false);
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
    setContentEditorOpen(false);
    setFormOpen(true);
  }, []);

  const openLessonEditor = useCallback((index?: number) => {
    const lesson = typeof index === 'number' ? formLessons[index] : undefined;
    setContentEditorKind('lesson');
    setEditingContentIndex(typeof index === 'number' ? index : null);
    setLessonDraft(lesson ? { ...lesson } : { title: '', type: 'text', url: '', content: '' });
    setContentEditorOpen(true);
  }, [formLessons]);

  const openQuizEditor = useCallback((index?: number) => {
    const quiz = typeof index === 'number' ? formQuizzes[index] : undefined;
    setContentEditorKind('quiz');
    setEditingContentIndex(typeof index === 'number' ? index : null);
    setQuizDraft(quiz ? { ...quiz, options: [...quiz.options] } : { question: '', options: ['', ''], correctOptionIndex: 0 });
    setContentEditorOpen(true);
  }, [formQuizzes]);

  const saveLessonDraft = useCallback(() => {
    const title = lessonDraft.title.trim();
    if (!title) {
      showHrNotice('Thiếu tên bài giảng', 'Vui lòng nhập tên bài giảng.');
      return;
    }
    const lesson = {
      ...lessonDraft,
      title,
      url: lessonDraft.url?.trim() || '',
      content: lessonDraft.content?.trim() || '',
    };
    setFormLessons((prev) =>
      editingContentIndex == null
        ? [...prev, lesson]
        : prev.map((item, index) => (index === editingContentIndex ? lesson : item)),
    );
    setContentEditorOpen(false);
  }, [editingContentIndex, lessonDraft]);

  const saveQuizDraft = useCallback(() => {
    const question = quizDraft.question.trim();
    const validOptions = quizDraft.options
      .map((option, index) => ({ text: option.trim(), index }))
      .filter((option) => option.text);
    if (!question) {
      showHrNotice('Thiếu câu hỏi', 'Vui lòng nhập nội dung câu hỏi.');
      return;
    }
    if (validOptions.length < 2) {
      showHrNotice('Thiếu đáp án', 'Mỗi câu hỏi cần ít nhất hai đáp án.');
      return;
    }
    const correctOptionIndex = Math.max(0, validOptions.findIndex((option) => option.index === quizDraft.correctOptionIndex));
    const quiz = {
      question,
      options: validOptions.map((option) => option.text),
      correctOptionIndex,
    };
    setFormQuizzes((prev) =>
      editingContentIndex == null
        ? [...prev, quiz]
        : prev.map((item, index) => (index === editingContentIndex ? quiz : item)),
    );
    setContentEditorOpen(false);
  }, [editingContentIndex, quizDraft]);

  const handleSaveCourse = useCallback(async () => {
    if (!formTitle.trim() || savingCourse) {
      if (!formTitle.trim()) showHrNotice('Thiếu tên khóa học', 'Vui lòng nhập tên khóa học.');
      return;
    }
    const comp = companyCode || user?.companyCode || '';
    if (!comp) {
      showHrNotice('Lỗi', 'Không xác định được mã doanh nghiệp.');
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
        showHrNotice('Đã lưu', 'Cập nhật khóa học thành công.');
      } else {
        const created = await createTrainingCourse({
          ...payload,
          icon: 'book',
          creatorUid: currentUid,
          enrolledCount: 0,
          companyProgress: 0,
        });
        setCourses((prev) => [created, ...prev]);
        showHrNotice('Thành công', `Đã tạo khóa học "${created.title}".`);
      }
      setFormOpen(false);
    } catch (err) {
      showHrNotice('Lỗi lưu khóa học', err instanceof Error ? err.message : 'Vui lòng thử lại.');
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
            showHrNotice('Lỗi xóa', err instanceof Error ? err.message : 'Không thể xóa khóa học.');
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
      <SlideInPage key={selectedCourse.id}>
      <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 108 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Course Header, Syllabus & Overview (hidden once learning starts) */}
        {activeIndex === -1 ? (
          <>
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
                  style={({ pressed }) => [styles.startCourseBtn, pressed && { opacity: 0.72 }]}
                >
                  <Text style={styles.startCourseBtnText}>Bỏ qua</Text>
                </Pressable>
              ) : null}
            </Card>

            {/* Full inline syllabus list (read-only overview; use "Bắt đầu học" to start) */}
            <Text style={styles.sectionTitle}>Mục lục khóa học</Text>
            <View style={styles.syllabusCard}>
              <View style={styles.syllabusListRow}>
                <IntroCourseIcon size={17} color={colors.ink} />
                <Text
                  numberOfLines={1}
                  style={styles.syllabusSheetRowText}
                >
                  Giới thiệu
                </Text>
              </View>

              {lessons.map((les, idx) => {
                const done = completedLessons.includes(`lesson_${idx}`);
                const isLast = idx === lessons.length - 1 && quizzes.length === 0;
                return (
                  <View
                    key={idx}
                    style={[
                      styles.syllabusListRow,
                      isLast && styles.syllabusListRowLast,
                    ]}
                  >
                    {done ? (
                      <CircleCheck size={17} strokeWidth={1.6} color="#16885A" />
                    ) : les.type === 'video' || les.type === 'youtube' ? (
                      <Video size={17} strokeWidth={1.6} color={colors.ink} />
                    ) : (
                      <FileText size={17} strokeWidth={1.6} color={colors.ink} />
                    )}
                    <Text
                      numberOfLines={2}
                      style={styles.syllabusSheetRowText}
                    >
                      Bài {idx + 1}: {les.title}
                    </Text>
                  </View>
                );
              })}

              {quizzes.length > 0 ? (
                <View
                  style={[
                    styles.syllabusListRow,
                    styles.syllabusListRowLast,
                    !isLessonsDone && styles.disabled,
                  ]}
                >
                  {isQuizPassed ? (
                    <CircleCheck size={17} strokeWidth={1.6} color="#16885A" />
                  ) : (
                    <ClipboardList size={17} strokeWidth={1.6} color={colors.ink} />
                  )}
                  <Text
                    numberOfLines={1}
                    style={styles.syllabusSheetRowText}
                  >
                    Thi trắc nghiệm ({quizzes.length})
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Section 1: Overview / Intro */}
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
                    showHrNotice('Thông báo', 'Khóa học chưa có nội dung bài giảng.');
                  }
                }}
                style={({ pressed }) => [styles.startCourseBtn, pressed && { opacity: 0.72 }]}
              >
                <View style={styles.iconButtonContent}><Play size={14} color={colors.ink} /><Text style={styles.startCourseBtnText}>Bắt đầu học</Text></View>
              </Pressable>
            </Card>
          </>
        ) : null}

        {/* Section 2: Active Lesson */}
        {activeIndex >= 0 && activeIndex < lessons.length ? (() => {
          const les = lessons[activeIndex];
          const isVideo = les.type === 'video' || les.type === 'youtube';
          return (
            <View style={styles.lessonFlatWrap}>
              <View style={styles.lessonHeaderBar}>
                <View style={styles.lessonHeaderLeft}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Quay lại bài trước"
                    onPress={() => setActiveIndex((prev) => prev - 1)}
                    hitSlop={10}
                    style={({ pressed }) => [styles.lessonBackBtn, pressed && { opacity: 0.6 }]}
                  >
                    <ChevronLeft size={18} strokeWidth={1.8} color={colors.ink} />
                  </Pressable>
                  <Text numberOfLines={2} style={styles.lessonHeaderTitle}>
                    {les.title}
                  </Text>
                </View>

                <Pressable
                  accessibilityRole="button"
                  disabled={submittingProgress}
                  onPress={() => void handleMarkLessonComplete(activeIndex)}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.lessonNextBtn,
                    submittingProgress && styles.disabled,
                    pressed && { opacity: 0.65 },
                  ]}
                >
                  <Text style={styles.lessonNextText}>
                    {submittingProgress ? 'Đang lưu...' : 'Tiếp theo'}
                  </Text>
                  {!submittingProgress ? (
                    <ChevronRight size={18} strokeWidth={1.8} color={colors.primary} />
                  ) : null}
                </Pressable>
              </View>

              {les.url ? (
                <Pressable
                  onPress={() => void Linking.openURL(les.url!)}
                  style={styles.resourceBox}
                >
                  <View style={styles.iconButtonContent}>
                    {isVideo ? (
                      <Video size={15} color={colors.primary} />
                    ) : (
                      <Paperclip size={15} color={colors.primary} />
                    )}
                    <Text style={styles.resourceTitle}>
                      {isVideo ? 'Mở video bài giảng' : 'Mở tài liệu đính kèm'}
                    </Text>
                  </View>
                  <Text numberOfLines={2} style={styles.resourceUrl}>
                    {les.fileName || les.url}
                  </Text>
                </Pressable>
              ) : null}

              {les.content ? (
                <Text style={styles.lessonBodyText}>{les.content}</Text>
              ) : !les.url ? (
                <Text style={styles.muted}>Bài giảng này chưa có nội dung hoặc tài liệu đính kèm.</Text>
              ) : null}
            </View>
          );
        })() : null}

        {/* Section 3: Quiz */}
        {activeIndex === lessons.length && quizzes.length > 0 ? (
          <View style={styles.lessonFlatWrap}>
            <View style={styles.lessonHeaderBar}>
              <View style={styles.lessonHeaderLeft}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Quay lại"
                  onPress={() => setActiveIndex(lessons.length > 0 ? lessons.length - 1 : -1)}
                  hitSlop={10}
                  style={({ pressed }) => [styles.lessonBackBtn, pressed && { opacity: 0.6 }]}
                >
                  <ChevronLeft size={18} strokeWidth={1.8} color={colors.ink} />
                </Pressable>
                <Text numberOfLines={2} style={styles.lessonHeaderTitle}>
                  Bài thi cuối khóa
                </Text>
              </View>

              {isQuizPassed ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setSelectedCourse(null);
                    void load(true);
                  }}
                  hitSlop={8}
                  style={({ pressed }) => [styles.lessonNextBtn, pressed && { opacity: 0.65 }]}
                >
                  <Text style={[styles.lessonNextText, { color: '#16885A' }]}>Hoàn thành</Text>
                  <ChevronRight size={18} strokeWidth={1.8} color="#16885A" />
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  disabled={submittingProgress}
                  onPress={() => void handleSubmitQuiz()}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.lessonNextBtn,
                    submittingProgress && styles.disabled,
                    pressed && { opacity: 0.65 },
                  ]}
                >
                  <Text style={styles.lessonNextText}>
                    {submittingProgress ? 'Đang chấm...' : 'Nộp bài'}
                  </Text>
                  {!submittingProgress ? (
                    <ChevronRight size={18} strokeWidth={1.8} color={colors.primary} />
                  ) : null}
                </Pressable>
              )}
            </View>

            <Text style={styles.muted}>
              Trả lời đúng 100% số câu hỏi ({quizzes.length} câu) để hoàn thành khóa học.
            </Text>

            <View style={{ gap: 4 }}>
              {quizzes.map((q, qIdx) => {
                const isErr = quizSubmitted && quizErrors[qIdx];
                const isLast = qIdx === quizzes.length - 1;
                return (
                  <View
                    key={qIdx}
                    style={[styles.quizFlatItem, isLast && styles.quizFlatItemLast]}
                  >
                    <Text style={[styles.quizQuestion, isErr && { color: '#B91C1C' }]}>
                      Câu {qIdx + 1}: {q.question}
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
                      <Text style={styles.quizErrorText}>Câu trả lời chưa đúng</Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {renderCourseFormModal()}
        <HrNoticeHost />
      </ScrollView>

      {/* Floating action widget for course actions */}
      <HrFab
        label="Tùy chọn khóa học"
        icon={<Ellipsis size={24} strokeWidth={2.2} color={colors.white} />}
        onPress={() => setActionSheetOpen(true)}
      />

      {/* Bottom Sheet: Thao tác khóa học (Quay lại danh sách / Sửa / Xóa) */}
      <Modal
        visible={actionSheetOpen}
        transparent
        statusBarTranslucent
        animationType="slide"
        onRequestClose={() => setActionSheetOpen(false)}
      >
        <Pressable
          style={styles.bottomSheetBackdrop}
          onPress={() => setActionSheetOpen(false)}
        >
          <Pressable
            style={[
              styles.bottomSheetCard,
              { paddingBottom: Math.max(insets.bottom + 14, 24) },
            ]}
            onPress={() => {}}
          >
            <View style={styles.bottomSheetHandle} />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Quay lại danh sách"
              onPress={() => {
                setActionSheetOpen(false);
                setSelectedCourse(null);
              }}
              style={({ pressed }) => [
                styles.actionSheetRow,
                pressed && styles.actionSheetRowPressed,
              ]}
            >
              <ArrowLeft size={18} strokeWidth={1.6} color={colors.ink} />
              <Text style={styles.actionSheetRowText}>Quay lại danh sách</Text>
            </Pressable>

            {canEditThis ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Sửa khóa học"
                  onPress={() => {
                    setActionSheetOpen(false);
                    openEditCourse(selectedCourse);
                  }}
                  style={({ pressed }) => [
                    styles.actionSheetRow,
                    pressed && styles.actionSheetRowPressed,
                  ]}
                >
                  <Pencil size={18} strokeWidth={1.6} color={colors.ink} />
                  <Text style={styles.actionSheetRowText}>Sửa khóa học</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Xóa khóa học"
                  onPress={() => {
                    setActionSheetOpen(false);
                    handleDeleteCourse(selectedCourse);
                  }}
                  style={({ pressed }) => [
                    styles.actionSheetRow,
                    pressed && styles.actionSheetRowPressed,
                  ]}
                >
                  <Trash2 size={18} strokeWidth={1.6} color={colors.ink} />
                  <Text style={styles.actionSheetRowText}>Xóa khóa học</Text>
                </Pressable>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
      </View>
      </SlideInPage>
    );
  }

  // ================= CREATE / EDIT COURSE MODAL =================
  function renderCourseFormModal() {
    return (
      <>
      <FullScreenFormModal
        visible={formOpen}
        title={editingCourse ? 'Cập nhật khóa học' : 'Tạo khóa học mới'}
        cancelLabel="Hủy"
        onSave={() => void handleSaveCourse()}
        saving={savingCourse}
        onClose={() => setFormOpen(false)}
      >
        <View>
          <HrFormSectionTitle title="Thông tin khóa học" />
          <HrFormInputRow
            label="Tên khóa học *"
            value={formTitle}
            onChangeText={setFormTitle}
            placeholder="VD: Quy chế bảo mật & văn hóa công ty"
          />
          <HrFormInputRow
            label="Mô tả tóm tắt"
            value={formDesc}
            onChangeText={setFormDesc}
            multiline
            placeholder="Nội dung chính khóa học..."
          />
          <HrFormSelectRow
            label="Danh mục đào tạo"
            sheetTitle="Chọn danh mục đào tạo"
            value={formCategory}
            options={CATEGORIES.map((cat) => ({ value: cat, label: cat }))}
            onSelect={setFormCategory}
          />
          <HrFormInputRow
            label="Thời lượng học"
            value={formDuration}
            onChangeText={setFormDuration}
            placeholder="VD: 2 giờ 30 phút"
          />
          <HrFormSwitchRow
            label="Khóa học bắt buộc"
            value={formRequired}
            onValueChange={setFormRequired}
          />
          <HrFormSwitchRow
            label="Tự động giao khi có nhân sự mới"
            value={formAutoOnboarding}
            onValueChange={setFormAutoOnboarding}
          />

          {/* Lessons builder */}
          <View style={[styles.builderHeader, { marginTop: 12 }]}>
            <Text style={styles.label}>Bài giảng ({formLessons.length})</Text>
            <Pressable
              onPress={() => openLessonEditor()}
              style={styles.addSmallBtn}
            >
              <View style={styles.iconButtonContent}><Plus size={13} color={colors.primary} /><Text style={styles.addSmallBtnText}>Thêm bài</Text></View>
            </Pressable>
          </View>
          {formLessons.map((les, idx) => (
            <View key={`lesson-${idx}`} style={[styles.builderEntry, { marginTop: 8 }]}>
              <Pressable onPress={() => openLessonEditor(idx)} style={[styles.builderCard, styles.builderEntryMain]}>
                <View style={styles.headRow}>
                  <Text style={styles.codeBadge}>Bài {idx + 1}</Text>
                  <Text style={styles.addSmallBtnText}>Chỉnh sửa</Text>
                </View>
                <Text numberOfLines={1} style={styles.rowTitle}>{les.title || 'Chưa có tên bài giảng'}</Text>
                <Text numberOfLines={1} style={styles.muted}>
                  {les.type === 'video' || les.type === 'youtube' ? 'Video' : 'Văn bản / Tài liệu'}
                  {les.url ? ` · ${les.url}` : ''}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setFormLessons((prev) => prev.filter((_, i) => i !== idx))}
                style={styles.deleteEntryBtn}
              >
                <Text style={styles.smallDelBtnText}>Xóa</Text>
              </Pressable>
            </View>
          ))}

          {/* Quiz builder */}
          <View style={[styles.builderHeader, { marginTop: 14 }]}>
            <Text style={styles.label}>Trắc nghiệm MCQ ({formQuizzes.length})</Text>
            <Pressable
              onPress={() => openQuizEditor()}
              style={styles.addSmallBtn}
            >
              <View style={styles.iconButtonContent}><Plus size={13} color={colors.primary} /><Text style={styles.addSmallBtnText}>Thêm câu hỏi</Text></View>
            </Pressable>
          </View>
          {formQuizzes.map((q, qIdx) => (
            <View key={`quiz-${qIdx}`} style={[styles.builderEntry, { marginTop: 8 }]}>
              <Pressable onPress={() => openQuizEditor(qIdx)} style={[styles.builderCard, styles.builderEntryMain]}>
                <View style={styles.headRow}>
                  <Text style={styles.codeBadge}>Câu {qIdx + 1}</Text>
                  <Text style={styles.addSmallBtnText}>Chỉnh sửa</Text>
                </View>
                <Text numberOfLines={2} style={styles.rowTitle}>{q.question || 'Chưa có nội dung câu hỏi'}</Text>
                <Text numberOfLines={1} style={styles.muted}>
                  {q.options.filter((option) => option.trim()).length} đáp án
                  {q.options[q.correctOptionIndex]?.trim() ? ` · Đúng: ${q.options[q.correctOptionIndex].trim()}` : ''}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setFormQuizzes((prev) => prev.filter((_, i) => i !== qIdx))}
                style={styles.deleteEntryBtn}
              >
                <Text style={styles.smallDelBtnText}>Xóa</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </FullScreenFormModal>
      <FullScreenFormModal
        visible={contentEditorOpen}
        title={
          contentEditorKind === 'lesson'
            ? editingContentIndex == null ? 'Thêm bài giảng' : 'Cập nhật bài giảng'
            : editingContentIndex == null ? 'Thêm câu trắc nghiệm' : 'Cập nhật câu trắc nghiệm'
        }
        cancelLabel="Hủy"
        onSave={contentEditorKind === 'lesson' ? saveLessonDraft : saveQuizDraft}
        onClose={() => setContentEditorOpen(false)}
      >
        {contentEditorKind === 'lesson' ? (
          <View>
            <HrFormSectionTitle title="Nội dung bài giảng" />
            <HrFormInputRow
              label="Tên bài giảng *"
              value={lessonDraft.title}
              onChangeText={(title) => setLessonDraft((prev) => ({ ...prev, title }))}
              placeholder="Ví dụ: Quy trình an toàn lao động"
            />
            <HrFormSelectRow
              label="Loại bài giảng"
              sheetTitle="Chọn loại bài giảng"
              value={lessonDraft.type === 'video' || lessonDraft.type === 'youtube' ? 'video' : 'text'}
              options={[
                { value: 'text', label: 'Văn bản / Tài liệu' },
                { value: 'video', label: 'Video' },
              ]}
              onSelect={(type) => setLessonDraft((prev) => ({ ...prev, type: type as 'text' | 'video' }))}
            />
            <HrFormInputRow
              label={lessonDraft.type === 'video' || lessonDraft.type === 'youtube' ? 'Link video' : 'Link tài liệu (tùy chọn)'}
              value={lessonDraft.url || ''}
              onChangeText={(url) => setLessonDraft((prev) => ({ ...prev, url }))}
              placeholder={lessonDraft.type === 'video' || lessonDraft.type === 'youtube' ? 'Link YouTube / video...' : 'https://...'}
              autoCapitalize="none"
              last={lessonDraft.type === 'video' || lessonDraft.type === 'youtube'}
            />
            {lessonDraft.type !== 'video' && lessonDraft.type !== 'youtube' ? (
              <HrFormInputRow
                label="Nội dung bài giảng"
                value={lessonDraft.content || ''}
                onChangeText={(content) => setLessonDraft((prev) => ({ ...prev, content }))}
                multiline
                placeholder="Nhập nội dung lý thuyết..."
                last
              />
            ) : null}
          </View>
        ) : (
          <View>
            <HrFormSectionTitle title="Nội dung câu hỏi" />
            <HrFormInputRow
              label="Nội dung câu hỏi *"
              value={quizDraft.question}
              onChangeText={(question) => setQuizDraft((prev) => ({ ...prev, question }))}
              multiline
              placeholder="Nhập câu hỏi trắc nghiệm..."
            />
            <HrFormCustomRow label="Các đáp án · Chọn nút tròn cạnh đáp án đúng" last>
              <View style={{ gap: 8, marginTop: 6 }}>
                {quizDraft.options.map((option, optionIndex) => {
                  const isCorrect = quizDraft.correctOptionIndex === optionIndex;
                  return (
                    <View key={`option-${optionIndex}`} style={styles.quizEditorOptionRow}>
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityState={{ checked: isCorrect }}
                        onPress={() => setQuizDraft((prev) => ({ ...prev, correctOptionIndex: optionIndex }))}
                        style={[styles.radioOuter, isCorrect && styles.radioOuterActive]}
                      >
                        {isCorrect ? <View style={styles.radioInner} /> : null}
                      </Pressable>
                      <TextInput
                        value={option}
                        onChangeText={(value) => setQuizDraft((prev) => {
                          const options = [...prev.options];
                          options[optionIndex] = value;
                          return { ...prev, options };
                        })}
                        placeholder={`Đáp án ${optionIndex + 1}`}
                        placeholderTextColor="#9CA3AF"
                        style={[styles.field, styles.quizEditorOptionField]}
                      />
                      {quizDraft.options.length > 2 ? (
                        <Pressable
                          onPress={() => setQuizDraft((prev) => {
                            const options = prev.options.filter((_, index) => index !== optionIndex);
                            const correctOptionIndex = prev.correctOptionIndex === optionIndex
                              ? Math.min(optionIndex, options.length - 1)
                              : prev.correctOptionIndex > optionIndex
                                ? prev.correctOptionIndex - 1
                                : prev.correctOptionIndex;
                            return { ...prev, options, correctOptionIndex };
                          })}
                          hitSlop={8}
                        >
                          <Text style={styles.smallDelBtnText}>Xóa</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })}
                <Pressable onPress={() => setQuizDraft((prev) => ({ ...prev, options: [...prev.options, ''] }))}>
                  <View style={styles.iconButtonContent}>
                    <Plus size={13} color={colors.primary} />
                    <Text style={styles.addSmallBtnText}>Thêm đáp án</Text>
                  </View>
                </Pressable>
              </View>
            </HrFormCustomRow>
          </View>
        )}
      </FullScreenFormModal>
      </>
    );
  }

  // ================= COURSE CATALOG LIST =================
  const monitoredEmployee = monitorUid
    ? employees.find((e) => (e.uid || e._id || e.id) === monitorUid)
    : undefined;

  return (
    <View style={{ flex: 1 }}>
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: 92 }]}
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
      {isSupervisor ? (
        <View style={styles.monitorBar}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setMonitorModalOpen(true)}
            style={({ pressed }) => [styles.monitorTriggerBtn, pressed && { opacity: 0.65 }]}
          >
            <Eye size={17} strokeWidth={1.6} color={colors.ink} />
            <Text numberOfLines={1} style={styles.monitorTriggerText}>
              {monitoredEmployee ? `Tiến độ: ${monitoredEmployee.displayName}` : 'Giám sát tiến độ nhân viên'}
            </Text>
            <ChevronDown size={15} strokeWidth={1.7} color="#64748B" />
          </Pressable>
          {monitorUid ? (
            <Pressable onPress={() => setMonitorUid('')} hitSlop={8} style={styles.clearMonitorBtn}>
              <Text style={styles.clearMonitorText}>Xem của tôi</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.searchRow}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Tìm theo tên, danh mục, giảng viên..."
          placeholderTextColor="#94A3B8"
          style={styles.searchField}
        />
      </View>

      {loading ? (
        <Card style={styles.stateCard}>
          <ActivityIndicator size="small" color={colors.primary} />
        </Card>
      ) : error ? (
        <Card style={styles.stateCard}>
          <PopupError error={error} />
          <Pressable onPress={() => void load()} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Thử lại</Text>
          </Pressable>
        </Card>
      ) : !filteredCourses.length ? (
        <View style={styles.stateCard}>
          <IgenHrEmptyState message="Chưa có khóa học đào tạo nào." />
        </View>
      ) : (
        <View style={styles.list}>
          {filteredCourses.map((course) => {
            const enroll = findEnrollment(course.id);
            const progress = enroll?.progress ?? 0;
            const isDone = enroll?.status === 'completed';
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
                  <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.rowTitle, { flex: 1 }]}>
                    {course.title || course.name}
                  </Text>
                  <View style={styles.badgeRow}>
                    <Text style={styles.categoryBadge}>{course.category || 'Đào tạo'}</Text>
                    {course.isRequired ? <Text style={styles.requiredBadge}>Bắt buộc</Text> : null}
                    {isDone ? <View style={styles.iconButtonContent}><Check size={12} color="#16885A" /><Text style={styles.doneBadge}>Hoàn thành</Text></View> : null}
                  </View>
                </View>

                <View style={styles.headRow}>
                  <View style={[styles.courseMetaRow, { flex: 1 }]}>
                    <LessonCountIcon size={14} color={colors.muted} /><Text style={styles.subMeta}>{course.lessons?.length ?? 0} bài học</Text>
                    {(course.quizzes?.length ?? 0) > 0 ? <><ClipboardList size={13} color={colors.muted} /><Text style={styles.subMeta}>{course.quizzes?.length} câu thi</Text></> : null}
                  </View>
                  {createdLabel ? <Text style={styles.subMeta}>{createdLabel}</Text> : null}
                </View>

                <View style={styles.cardFooter}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${Math.min(100, progress)}%` }]} />
                    </View>
                  </View>
                  <Text style={styles.subMeta}>{progress}%</Text>
                </View>
              </Card>
            );
          })}
        </View>
      )}

      {/* Employee monitor picker bottom sheet matching Employee Directory */}
      <Modal
        visible={monitorModalOpen}
        transparent
        statusBarTranslucent
        animationType="slide"
        onRequestClose={() => setMonitorModalOpen(false)}
      >
        <Pressable style={styles.monitorSheetBackdrop} onPress={() => setMonitorModalOpen(false)}>
          <Pressable style={styles.monitorSheet} onPress={() => {}}>
            <View style={styles.monitorSheetHandle} />
            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              <Pressable
                onPress={() => {
                  setMonitorUid('');
                  setMonitorModalOpen(false);
                }}
                style={[styles.monitorSheetRow, !monitorUid && styles.monitorSheetRowActive]}
              >
                <Text style={[styles.monitorSheetRowText, !monitorUid && styles.monitorSheetRowTextActive]}>
                  Khóa học của tôi
                </Text>
                {!monitorUid ? <Check size={17} color={colors.primary} /> : null}
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
                    style={[styles.monitorSheetRow, selected && styles.monitorSheetRowActive]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.monitorSheetRowText, selected && styles.monitorSheetRowTextActive]}>
                        {emp.displayName}
                      </Text>
                      <Text style={styles.subMeta}>{emp.jobTitle || emp.role || 'Nhân viên'}</Text>
                    </View>
                    {selected ? <Check size={17} color={colors.primary} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {renderCourseFormModal()}
      <HrNoticeHost />
    </ScrollView>
    {isSupervisor ? <HrFab label="Thêm khóa học" onPress={openCreateCourse} /> : null}
    </View>
  );
}

const HAIRLINE_CARD = {
  backgroundColor: colors.white,
  borderRadius: 10,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: '#E5EAF2',
  shadowOpacity: 0,
  shadowRadius: 0,
  shadowOffset: { width: 0, height: 0 },
  elevation: 0,
} as const;

const styles = StyleSheet.create({
  content: { paddingHorizontal: 14, paddingBottom: 28, backgroundColor: colors.white },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  searchField: { flex: 1, backgroundColor: '#F6F8FC', borderColor: '#DCE5F2', borderWidth: 1, borderRadius: 99, paddingHorizontal: 14, height: 40, fontSize: 13.5, color: '#111827' },
  monitorBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, paddingBottom: 12, gap: 10 },
  monitorTriggerBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 },
  monitorTriggerText: { color: colors.ink, fontSize: 15, fontWeight: '400', flexShrink: 1 },
  monitorChip: { backgroundColor: colors.white, borderColor: '#DCE5F2', borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99 },
  monitorChipText: { color: colors.primary, fontSize: 12, fontWeight: '500' },
  clearMonitorBtn: { paddingVertical: 4, paddingLeft: 8 },
  clearMonitorText: { color: colors.primary, fontSize: 13.5, fontWeight: '500' },
  monitorSheetBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.35)', justifyContent: 'flex-end' },
  monitorSheet: { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 26 },
  monitorSheetHandle: { width: 38, height: 4, borderRadius: 99, backgroundColor: '#D6DFEC', alignSelf: 'center', marginBottom: 12 },
  monitorSheetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 13, borderRadius: 12, marginBottom: 4, gap: 10 },
  monitorSheetRowActive: { backgroundColor: '#F0F6FF' },
  monitorSheetRowText: { color: colors.ink, fontSize: 14.5, fontWeight: '400' },
  monitorSheetRowTextActive: { color: colors.primary, fontWeight: '500' },
  primaryBtn: { backgroundColor: colors.primary, minHeight: 40, paddingHorizontal: 13, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: colors.white, fontSize: 12.5, fontWeight: '600' },
  iconButtonContent: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  courseMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 },
  stateCard: { ...HAIRLINE_CARD, padding: 22, alignItems: 'center', gap: 10 },
  errorText: { color: '#B91C1C', fontSize: 12.5, textAlign: 'center' },
  list: {
    marginHorizontal: -14,
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#EEF2F7',
    gap: 0,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 0,
    borderWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEF2F7',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 5,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 },
  categoryBadge: { color: colors.primary, backgroundColor: '#EAF2FF', fontSize: 10.5, fontWeight: '500', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
  requiredBadge: { color: '#B45309', backgroundColor: '#FFF3E5', fontSize: 10.5, fontWeight: '500', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
  doneBadge: { color: '#16885A', backgroundColor: '#E9F8F1', fontSize: 10.5, fontWeight: '500', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
  codeBadge: { color: colors.primary, backgroundColor: '#EAF2FF', fontSize: 10.5, fontWeight: '500', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
  rowTitle: { color: '#111827', fontSize: 14, fontWeight: '600' },
  muted: { color: '#6B7280', fontSize: 12.5, fontWeight: '400', lineHeight: 18 },
  subMeta: { color: '#6B7280', fontSize: 11.5, fontWeight: '400' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  progressTrack: { height: 6, backgroundColor: '#E8EDF4', borderRadius: 99, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 99 },
  actionBtn: { backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 9 },
  actionBtnDone: { backgroundColor: '#16885A' },
  actionBtnText: { color: colors.white, fontSize: 12, fontWeight: '600' },

  // Detail / Study Room
  detailTopBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  backBtn: { ...HAIRLINE_CARD, paddingHorizontal: 12, paddingVertical: 8 },
  backBtnText: { color: '#111827', fontSize: 12.5, fontWeight: '600' },
  smallEditBtn: { backgroundColor: '#EAF2FF', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9 },
  smallEditBtnText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  smallDelBtn: { backgroundColor: '#FEE2E2', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9 },
  smallDelBtnText: { color: '#B91C1C', fontSize: 12, fontWeight: '600' },
  heroCard: { ...HAIRLINE_CARD, padding: 14, gap: 6, marginBottom: 12 },
  heroTitle: { color: '#111827', fontSize: 15.5, fontWeight: '700', lineHeight: 22 },
  progressSection: { gap: 5, marginTop: 4 },
  progressLabel: { color: '#374151', fontSize: 12, fontWeight: '500' },
  progressPct: { color: colors.primary, fontSize: 12.5, fontWeight: '600' },
  bypassBtn: { marginTop: 6, borderColor: '#E5EAF2', borderWidth: 1, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  bypassBtnText: { color: '#6B7280', fontSize: 12, fontWeight: '500' },
  sectionTitle: { color: '#111827', fontSize: 14, fontWeight: '700', marginBottom: 8 },
  syllabusPill: { backgroundColor: colors.white, borderColor: '#E5EAF2', borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, maxWidth: 190 },
  syllabusPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  syllabusText: { color: '#111827', fontSize: 12, fontWeight: '500' },
  syllabusTextActive: { color: colors.white, fontWeight: '600' },
  syllabusTrigger: {
    ...HAIRLINE_CARD,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 12,
    gap: 10,
  },
  syllabusTriggerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  syllabusTriggerCaption: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '400',
  },
  syllabusTriggerValue: {
    color: '#111827',
    fontSize: 13.5,
    fontWeight: '600',
    marginTop: 1,
  },
  bottomSheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
  },
  bottomSheetCard: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  bottomSheetHandle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    marginBottom: 12,
  },
  bottomSheetTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '600',
    paddingHorizontal: 6,
    marginBottom: 8,
  },
  syllabusCard: {
    ...HAIRLINE_CARD,
    overflow: 'hidden',
    marginBottom: 12,
  },
  syllabusListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEF2F7',
  },
  syllabusListRowLast: {
    borderBottomWidth: 0,
  },
  syllabusSheetRowText: {
    flex: 1,
    color: colors.ink,
    fontSize: 14.5,
    fontWeight: '400',
  },
  actionSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionSheetRowPressed: {
    backgroundColor: '#F8FAFC',
  },
  actionSheetRowText: {
    color: colors.ink,
    fontSize: 14.5,
    fontWeight: '400',
  },
  studyCard: { ...HAIRLINE_CARD, padding: 15, gap: 10 },
  lessonCounter: { color: colors.primary, fontSize: 11.5, fontWeight: '600' },
  studyHeading: { color: '#111827', fontSize: 15, fontWeight: '600', lineHeight: 21 },
  studyBody: { color: '#374151', fontSize: 13, lineHeight: 20 },
  overviewBox: { backgroundColor: '#F6F8FC', borderColor: '#E5EAF2', borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12, gap: 5 },
  overviewTitle: { color: '#111827', fontSize: 13, fontWeight: '600' },
  overviewBullet: { color: '#6B7280', fontSize: 12.5 },
  overviewBulletRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  resourceBox: { backgroundColor: '#F5F9FF', borderColor: '#DCE7F7', borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12, gap: 4 },
  resourceTitle: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  resourceUrl: { color: '#6B7280', fontSize: 11.5 },
  lessonContentBox: { backgroundColor: '#F6F8FC', borderColor: '#E5EAF2', borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12 },
  lessonFlatWrap: { gap: 12, paddingTop: 2 },
  lessonHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5EAF2',
  },
  lessonHeaderLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  lessonBackBtn: { paddingVertical: 2, paddingRight: 2 },
  lessonHeaderTitle: { flex: 1, color: '#111827', fontSize: 16, fontWeight: '600', lineHeight: 22 },
  lessonNextBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 4, paddingLeft: 6 },
  lessonNextText: { color: colors.primary, fontSize: 14, fontWeight: '400' },
  lessonBodyText: { color: '#1F2937', fontSize: 14.5, lineHeight: 23 },
  studyFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EEF2F7' },

  // Quiz
  quizTag: { color: '#16885A', fontSize: 10.5, fontWeight: '600', letterSpacing: 0.3 },
  quizBox: { backgroundColor: '#F6F8FC', borderColor: '#E5EAF2', borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12 },
  quizBoxError: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  quizFlatItem: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EEF2F7' },
  quizFlatItemLast: { borderBottomWidth: 0 },
  quizQuestion: { color: '#111827', fontSize: 13, fontWeight: '600', lineHeight: 19 },
  quizOption: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.white, borderColor: '#E5EAF2', borderWidth: 1, borderRadius: 10, padding: 10 },
  quizOptionActive: { backgroundColor: '#EAF2FF', borderColor: colors.primary },
  quizOptionText: { color: '#111827', fontSize: 12.5, flex: 1 },
  quizOptionTextActive: { color: colors.primary, fontWeight: '600' },
  quizErrorText: { color: '#B91C1C', fontSize: 11.5, fontWeight: '500', marginTop: 6 },
  radioOuter: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' },
  radioOuterActive: { borderColor: colors.primary },
  radioInner: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary },

  // Modal & Form
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.35)', justifyContent: 'center', padding: 16 },
  sheet: { backgroundColor: colors.white, borderRadius: 20, overflow: 'hidden', padding: 18, gap: 10, maxHeight: '90%' },
  sheetTitle: { color: '#111827', fontSize: 16, fontWeight: '600' },
  closeText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  label: { color: '#374151', fontSize: 12.5, fontWeight: '500', marginTop: 4 },
  field: { backgroundColor: '#F6F8FC', borderColor: '#DCE5F2', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13.5, color: '#111827' },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: colors.white, borderColor: '#E5EAF2', borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: '#6B7280', fontSize: 11.5, fontWeight: '500' },
  chipTextActive: { color: colors.white, fontWeight: '600' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  builderHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EEF2F7' },
  builderCard: { backgroundColor: '#F6F8FC', borderColor: '#E5EAF2', borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 11, gap: 7 },
  builderEntry: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  builderEntryMain: { flex: 1 },
  deleteEntryBtn: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 8 },
  editorForm: { gap: 8, paddingBottom: 14 },
  editorTextArea: { minHeight: 90, textAlignVertical: 'top' },
  editorActionRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  editorAction: { flex: 1 },
  quizEditorOptionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  quizEditorOptionField: { flex: 1 },
  addSmallBtn: { backgroundColor: '#EAF2FF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  addSmallBtnText: { color: colors.primary, fontSize: 11.5, fontWeight: '600' },
  pickerRow: { padding: 12, borderRadius: 10, backgroundColor: '#F6F8FC', marginBottom: 6 },
  pickerRowActive: { backgroundColor: '#EAF2FF' },
  submitBtn: { backgroundColor: colors.primary, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 6, paddingHorizontal: 14 },
  submitBtnText: { color: colors.white, fontSize: 13.5, fontWeight: '600' },
  startCourseBtn: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minHeight: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    paddingHorizontal: 12,
  },
  startCourseBtnText: { color: colors.ink, fontSize: 12.5, fontWeight: '500' },
  cancelBtn: { backgroundColor: '#F1F5F9', minHeight: 44, paddingHorizontal: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { color: '#374151', fontSize: 13, fontWeight: '600' },
  disabled: { opacity: 0.45 },
});

