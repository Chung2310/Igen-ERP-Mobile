import { withAppLockSuspended } from '@/core/auth/appLockSuspension';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import {
  BarChart2,
  CalendarCheck,
  Check,
  ChevronRight,
  ClipboardList,
  Paperclip,
  Plus,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react-native';
import { uploadHrMediaFile } from '@/features/hr/hrApi';
import { DateTimeField } from '@/features/quotation/DateTimeField';
import {
  createBatchAssignment,
  gradeAssignmentSubmission,
  listAssignmentSubmissions,
  listBatchAssignments,
  type BatchAssignmentRecord,
  type BatchAttachment,
  type BatchRecord,
  type BatchSubmissionRecord,
  type StudentManagementScope,
  type StudentRecord,
} from '@/features/studentManagementApi';
import { colors } from '@/theme/colors';

const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function formatDays(days?: number[]) {
  return DAY_ORDER.filter((d) => (days || []).includes(d))
    .map((d) => DAY_LABELS[d])
    .join(', ') || '—';
}

function formatViDate(dateStr?: string) {
  if (!dateStr) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : dateStr;
}

function getLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getScheduledDates(startDateStr?: string, endDateStr?: string, daysOfWeek?: number[]): string[] {
  const dates: string[] = [];
  if (!startDateStr || !endDateStr || !daysOfWeek?.length) return dates;
  const [sy, sm, sd] = startDateStr.split('-').map(Number);
  const [ey, em, ed] = endDateStr.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return dates;
  const cursor = new Date(start);
  let limit = 0;
  while (cursor <= end && limit < 200) {
    if (daysOfWeek.includes(cursor.getDay())) dates.push(getLocalDateStr(cursor));
    cursor.setDate(cursor.getDate() + 1);
    limit += 1;
  }
  return dates;
}

function attendanceStatusVi(status?: string) {
  return ({ present: 'Có mặt', late: 'Đi muộn', excused: 'Có phép', absent: 'Vắng' } as Record<string, string>)[status || ''] || 'Chưa điểm danh';
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <View style={styles.modalHeader}>
      <Text numberOfLines={1} style={styles.modalTitle}>{title}</Text>
      <Pressable onPress={onClose} style={styles.closeButton}>
        <X size={18} color={colors.muted} />
      </Pressable>
    </View>
  );
}

// --- 1. Xem chi tiết lớp học ---
export function BatchDetailModal({
  batch,
  roadmapName,
  canManage,
  onClose,
  onOpenLearners,
  onOpenAttendance,
  onOpenHistory,
  onOpenAssignments,
}: {
  batch: BatchRecord | null;
  roadmapName?: string;
  canManage: boolean;
  onClose: () => void;
  onOpenLearners: (batch: BatchRecord) => void;
  onOpenAttendance: (batch: BatchRecord) => void;
  onOpenHistory: (batch: BatchRecord) => void;
  onOpenAssignments: (batch: BatchRecord) => void;
}) {
  if (!batch) return null;
  const done = batch.progress?.doneSessions || 0;
  const total = batch.progress?.totalSessions || 0;
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const maxCap = batch.quota ?? batch.maxLearners;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.dialog, { maxHeight: '88%' }]}>
          <ModalHeader title={`Chi tiết lớp · ${batch.code}`} onClose={onClose} />
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.infoCard}>
              <Text style={styles.title}>{batch.code}{batch.name ? ` · ${batch.name}` : ''}</Text>
              <Text style={styles.meta}>{batch.courseCode ? `${batch.courseCode} · ` : ''}{batch.courseTitle || 'Chưa gắn khóa học'}</Text>
              {roadmapName ? <Text style={styles.roadmapTag}>Lộ trình: {roadmapName}</Text> : null}
            </View>

            <View style={styles.grid}>
              <View style={styles.cell}><Text style={styles.cellLabel}>Trạng thái</Text><Text style={styles.cellValue}>{batch.status || 'Sắp khai giảng'}</Text></View>
              <View style={styles.cell}><Text style={styles.cellLabel}>Sĩ số</Text><Text style={styles.cellValue}>{batch.learnerIds?.length || 0}{maxCap ? `/${maxCap}` : ''} học viên</Text></View>
              <View style={styles.cell}><Text style={styles.cellLabel}>Giảng viên</Text><Text style={styles.cellValue}>{batch.instructorName || 'Chưa phân công'}</Text></View>
              <View style={styles.cell}><Text style={styles.cellLabel}>Địa điểm</Text><Text style={styles.cellValue}>{batch.location || 'Chưa cập nhật'}</Text></View>
              <View style={styles.cell}><Text style={styles.cellLabel}>Lịch học</Text><Text style={styles.cellValue}>{formatDays(batch.daysOfWeek)} · {batch.startTime || '--:--'}–{batch.endTime || '--:--'}</Text></View>
              <View style={styles.cell}><Text style={styles.cellLabel}>Thời gian</Text><Text style={styles.cellValue}>{formatViDate(batch.startDate)} → {formatViDate(batch.endDate)}</Text></View>
            </View>

            <View style={styles.infoCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.sectionTitle}>Tiến độ buổi học</Text>
                <Text style={styles.progressCount}>{done}/{total} buổi ({pct}%)</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${pct}%` }]} />
              </View>
              {batch.progress?.missingAttendanceSessions ? (
                <Text style={styles.warnText}>Còn {batch.progress.missingAttendanceSessions} buổi chưa điểm danh</Text>
              ) : null}
            </View>

            <View style={styles.quickGrid}>
              <Pressable onPress={() => { onClose(); onOpenLearners(batch); }} style={styles.quickBtn}>
                <UsersRound size={15} color={colors.primary} />
                <Text style={styles.quickBtnText}>Học viên</Text>
              </Pressable>
              {canManage ? (
                <Pressable onPress={() => { onClose(); onOpenAttendance(batch); }} style={styles.quickBtn}>
                  <CalendarCheck size={15} color={colors.primary} />
                  <Text style={styles.quickBtnText}>Điểm danh / QR</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => { onClose(); onOpenHistory(batch); }} style={styles.quickBtn}>
                <BarChart2 size={15} color={colors.primary} />
                <Text style={styles.quickBtnText}>Lịch sử điểm danh</Text>
              </Pressable>
              <Pressable onPress={() => { onClose(); onOpenAssignments(batch); }} style={styles.quickBtn}>
                <ClipboardList size={15} color={colors.primary} />
                <Text style={styles.quickBtnText}>Bài tập</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// --- 2. Lịch sử & Thống kê điểm danh lớp ---
export function BatchAttendanceHistoryModal({
  batch,
  students,
  onClose,
}: {
  batch: BatchRecord | null;
  students: StudentRecord[];
  onClose: () => void;
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const summary = useMemo(() => {
    if (!batch) return { allDates: [] as string[], takenCount: 0, missedCount: 0, totalAbsences: 0, topAbsentees: [] as Array<[string, number]> };
    const todayStr = getLocalDateStr(new Date());
    const cancelled = new Set(batch.cancelledSessionDates || []);
    const scheduled = getScheduledDates(batch.startDate, batch.endDate, batch.daysOfWeek).filter((d) => !cancelled.has(d));
    const extra = (batch.attendanceSessions || []).map((s) => s.date).filter((d) => !scheduled.includes(d) && !cancelled.has(d));
    const allDates = [...scheduled, ...extra].sort((a, b) => b.localeCompare(a));
    const sessions = batch.attendanceSessions || [];
    const takenCount = allDates.filter((d) => sessions.some((s) => s.date === d && (s.records?.length || 0) > 0)).length;
    const missedCount = allDates.filter((d) => d < todayStr && !sessions.some((s) => s.date === d && (s.records?.length || 0) > 0)).length;

    const absentMap: Record<string, number> = {};
    let totalAbsences = 0;
    sessions.forEach((session) => {
      (session.records || []).forEach((rec) => {
        if (rec.status === 'absent' || rec.status === 'excused') {
          absentMap[rec.studentId] = (absentMap[rec.studentId] || 0) + 1;
          totalAbsences += 1;
        }
      });
    });
    const topAbsentees = Object.entries(absentMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { allDates, takenCount, missedCount, totalAbsences, topAbsentees };
  }, [batch]);

  if (!batch) return null;
  const sessions = batch.attendanceSessions || [];
  const selectedSession = selectedDate ? sessions.find((s) => s.date === selectedDate) : null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => { setSelectedDate(null); onClose(); }}>
      <View style={styles.backdrop}>
        <View style={[styles.dialog, styles.tallDialog]}>
          <ModalHeader title={`Lịch sử điểm danh · ${batch.code}`} onClose={() => { setSelectedDate(null); onClose(); }} />
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.statRow}>
              <View style={[styles.statBox, { backgroundColor: '#EAF2FF' }]}>
                <Text style={[styles.statVal, { color: colors.primary }]}>{summary.takenCount}/{summary.allDates.length}</Text>
                <Text style={styles.statLabel}>Đã điểm danh</Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: '#FFF3E5' }]}>
                <Text style={[styles.statVal, { color: '#C27617' }]}>{summary.missedCount}</Text>
                <Text style={styles.statLabel}>Bỏ sót</Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: '#FCEBEC' }]}>
                <Text style={[styles.statVal, { color: '#C74848' }]}>{summary.totalAbsences}</Text>
                <Text style={styles.statLabel}>Lượt vắng</Text>
              </View>
            </View>

            {summary.topAbsentees.length > 0 ? (
              <View style={styles.infoCard}>
                <Text style={styles.sectionTitle}>Vắng nhiều nhất</Text>
                {summary.topAbsentees.map(([studentId, count]) => {
                  const st = students.find((item) => item.id === studentId);
                  return (
                    <View key={studentId} style={styles.listRow}>
                      <Text style={[styles.rowTitle, { flex: 1 }]}>{st?.fullName || studentId}</Text>
                      <Text style={[styles.badgeText, { color: '#B42318' }]}>{count} buổi</Text>
                    </View>
                  );
                })}
              </View>
            ) : null}

            <Text style={styles.sectionTitle}>Các buổi học ({summary.allDates.length})</Text>
            {summary.allDates.length === 0 ? (
              <Text style={styles.emptyText}>Chưa có lịch buổi học hoặc dữ liệu điểm danh.</Text>
            ) : (
              summary.allDates.map((dateKey) => {
                const session = sessions.find((s) => s.date === dateKey);
                const records = session?.records || [];
                const present = records.filter((r) => r.status === 'present' || r.status === 'late').length;
                const isSelected = selectedDate === dateKey;
                return (
                  <View key={dateKey} style={styles.sessionCard}>
                    <Pressable onPress={() => setSelectedDate(isSelected ? null : dateKey)} style={styles.rowBetween}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>{formatViDate(dateKey)}</Text>
                        <Text style={styles.meta}>
                          {records.length > 0 ? `Có mặt: ${present}/${records.length}` : 'Chưa điểm danh'}
                        </Text>
                      </View>
                      <ChevronRight size={16} color={colors.muted} />
                    </Pressable>
                    {isSelected && selectedSession?.records?.length ? (
                      <View style={styles.subList}>
                        {selectedSession.records.map((rec) => {
                          const st = students.find((item) => item.id === rec.studentId);
                          return (
                            <View key={rec.studentId} style={styles.listRow}>
                              <Text style={[styles.meta, { flex: 1, color: colors.ink }]}>{st?.fullName || rec.studentId}</Text>
                              <Text style={styles.badgeText}>{attendanceStatusVi(rec.status)}</Text>
                            </View>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// --- 3. Giao & Chấm bài tập lớp ---
export function BatchAssignmentsModal({
  batch,
  students,
  scope,
  canManage,
  onClose,
}: {
  batch: BatchRecord | null;
  students: StudentRecord[];
  scope: StudentManagementScope;
  canManage: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [assignments, setAssignments] = useState<BatchAssignmentRecord[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('20:00');
  const [maxScore, setMaxScore] = useState('10');
  const [attachments, setAttachments] = useState<BatchAttachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const [selected, setSelected] = useState<BatchAssignmentRecord | null>(null);
  const [submissions, setSubmissions] = useState<BatchSubmissionRecord[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [gradingStudentId, setGradingStudentId] = useState<string | null>(null);
  const [gradeScore, setGradeScore] = useState('');
  const [gradeFeedback, setGradeFeedback] = useState('');
  const [grading, setGrading] = useState(false);

  const loadAssignments = useCallback(async () => {
    if (!batch) return;
    setLoading(true);
    try {
      setAssignments(await listBatchAssignments(batch.id, scope));
    } catch (cause) {
      Alert.alert('Không tải được bài tập', cause instanceof Error ? cause.message : 'Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, [batch, scope]);

  useEffect(() => {
    if (batch) {
      setSelected(null);
      setShowCreate(false);
      void loadAssignments();
    }
  }, [batch, loadAssignments]);

  const openAssignment = async (item: BatchAssignmentRecord) => {
    setSelected(item);
    setGradingStudentId(null);
    setLoadingSubs(true);
    try {
      setSubmissions(await listAssignmentSubmissions(item._id, scope));
    } catch (cause) {
      Alert.alert('Không tải được bài nộp', cause instanceof Error ? cause.message : 'Vui lòng thử lại.');
    } finally {
      setLoadingSubs(false);
    }
  };

  const handlePickAttachments = async () => {
    if (uploading) return;
    try {
      const picked = await withAppLockSuspended(() => DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
        copyToCacheDirectory: true,
      }));
      if (picked.canceled || !picked.assets?.length) return;
      setUploading(true);
      for (const asset of picked.assets) {
        if (asset.size && asset.size > 20 * 1024 * 1024) {
          Alert.alert('Tệp quá lớn', `Tệp "${asset.name}" vượt quá giới hạn 20MB.`);
          continue;
        }
        const uploaded = await uploadHrMediaFile(asset, 'student.assignment');
        setAttachments((current) => [
          ...current,
          {
            name: uploaded.name,
            url: uploaded.url,
            type: uploaded.mimeType || 'application/octet-stream',
            uploadToken: uploaded.uploadToken,
          },
        ]);
      }
    } catch (cause) {
      Alert.alert('Không tải được tệp đính kèm', cause instanceof Error ? cause.message : 'Vui lòng thử lại.');
    } finally {
      setUploading(false);
    }
  };

  const handleCreate = async () => {
    if (!batch || !title.trim()) {
      Alert.alert('Thiếu tiêu đề', 'Nhập tiêu đề bài tập trước khi giao.');
      return;
    }
    let dueIso: string | undefined;
    if (dueDate) {
      const parsed = new Date(`${dueDate}T${dueTime || '20:00'}:00`);
      if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
        Alert.alert('Hạn nộp chưa hợp lệ', 'Hạn nộp phải là thời điểm trong tương lai.');
        return;
      }
      dueIso = parsed.toISOString();
    }
    const max = Math.max(1, Number(maxScore) || 10);
    setCreating(true);
    try {
      await createBatchAssignment(
        { batchId: batch.id, title: title.trim(), description: description.trim(), dueDate: dueIso, maxScore: max, attachments },
        scope,
      );
      setTitle('');
      setDescription('');
      setDueDate('');
      setDueTime('20:00');
      setAttachments([]);
      setShowCreate(false);
      await loadAssignments();
      Alert.alert('Đã giao bài tập', 'Bài tập mới đã được gửi tới lớp học.');
    } catch (cause) {
      Alert.alert('Không giao được bài tập', cause instanceof Error ? cause.message : 'Vui lòng thử lại.');
    } finally {
      setCreating(false);
    }
  };

  const handleGrade = async () => {
    if (!selected || !gradingStudentId) return;
    const max = selected.maxScore || 10;
    const num = Number(gradeScore);
    if (gradeScore.trim() === '' || !Number.isFinite(num) || num < 0 || num > max) {
      Alert.alert('Điểm chưa hợp lệ', `Nhập điểm từ 0 đến ${max}.`);
      return;
    }
    setGrading(true);
    try {
      await gradeAssignmentSubmission(selected._id, gradingStudentId, { score: num, feedback: gradeFeedback.trim() }, scope);
      setGradingStudentId(null);
      setGradeScore('');
      setGradeFeedback('');
      setSubmissions(await listAssignmentSubmissions(selected._id, scope));
      Alert.alert('Đã chấm điểm', 'Điểm số và nhận xét đã được lưu.');
    } catch (cause) {
      Alert.alert('Không chấm được điểm', cause instanceof Error ? cause.message : 'Vui lòng thử lại.');
    } finally {
      setGrading(false);
    }
  };

  if (!batch) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.dialog, styles.tallDialog]}>
          <ModalHeader title={`Bài tập · ${batch.code}`} onClose={onClose} />
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {selected ? (
              <>
                <Pressable onPress={() => setSelected(null)} style={styles.backBtn}>
                  <Text style={styles.backBtnText}>← Quay lại danh sách bài tập</Text>
                </Pressable>
                <View style={styles.infoCard}>
                  <Text style={styles.title}>{selected.title}</Text>
                  {selected.description ? <Text style={styles.meta}>{selected.description}</Text> : null}
                  <Text style={styles.meta}>
                    Thang điểm: {selected.maxScore || 10}
                    {selected.dueDate ? ` · Hạn nộp: ${new Date(selected.dueDate).toLocaleString('vi-VN')}` : ''}
                  </Text>
                  {selected.attachments?.length ? (
                    <View style={{ gap: 5, marginTop: 4 }}>
                      {selected.attachments.map((file, idx) => (
                        <Pressable key={`${file.url}-${idx}`} onPress={() => void Linking.openURL(file.url)} style={styles.attachmentRow}>
                          <Paperclip size={13} color={colors.primary} />
                          <Text numberOfLines={1} style={styles.attachmentLink}>{file.name}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>

                <Text style={styles.sectionTitle}>Bài nộp ({submissions.length})</Text>
                {loadingSubs ? (
                  <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
                ) : submissions.length === 0 ? (
                  <Text style={styles.emptyText}>Chưa có học viên nào nộp bài.</Text>
                ) : (
                  submissions.map((sub) => {
                    const st = students.find((item) => item.id === sub.studentId);
                    const isGrading = gradingStudentId === sub.studentId;
                    return (
                      <View key={sub._id} style={styles.sessionCard}>
                        <View style={styles.rowBetween}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.rowTitle}>{st?.fullName || sub.studentId}</Text>
                            <Text style={styles.meta}>
                              {sub.status === 'graded' ? `Đã chấm: ${sub.score}/${selected.maxScore || 10}` : sub.status === 'late' ? 'Nộp muộn' : 'Đã nộp'}
                              {sub.studentNotes ? ` · ${sub.studentNotes}` : ''}
                            </Text>
                            {sub.feedback ? <Text style={styles.meta}>Nhận xét: {sub.feedback}</Text> : null}
                          </View>
                          {canManage ? (
                            <Pressable
                              onPress={() => {
                                if (isGrading) {
                                  setGradingStudentId(null);
                                } else {
                                  setGradingStudentId(sub.studentId);
                                  setGradeScore(sub.score != null ? String(sub.score) : '');
                                  setGradeFeedback(sub.feedback || '');
                                }
                              }}
                              style={styles.miniAction}
                            >
                              <Text style={styles.miniActionText}>{isGrading ? 'Đóng' : 'Chấm điểm'}</Text>
                            </Pressable>
                          ) : null}
                        </View>
                        {isGrading ? (
                          <View style={styles.gradeForm}>
                            <TextInput
                              value={gradeScore}
                              onChangeText={setGradeScore}
                              placeholder={`Điểm (0 - ${selected.maxScore || 10})`}
                              placeholderTextColor={colors.muted}
                              keyboardType="decimal-pad"
                              style={styles.input}
                            />
                            <TextInput
                              value={gradeFeedback}
                              onChangeText={setGradeFeedback}
                              placeholder="Nhận xét của giảng viên..."
                              placeholderTextColor={colors.muted}
                              style={styles.input}
                            />
                            <Pressable disabled={grading} onPress={() => void handleGrade()} style={[styles.primaryBtn, grading && styles.disabled]}>
                              {grading ? <ActivityIndicator size="small" color={colors.white} /> : <Check size={14} color={colors.white} />}
                              <Text style={styles.primaryBtnText}>Lưu điểm</Text>
                            </Pressable>
                          </View>
                        ) : null}
                      </View>
                    );
                  })
                )}
              </>
            ) : (
              <>
                {canManage ? (
                  <Pressable onPress={() => setShowCreate((prev) => !prev)} style={styles.primaryBtn}>
                    <Plus size={15} color={colors.white} />
                    <Text style={styles.primaryBtnText}>{showCreate ? 'Đóng form giao bài' : 'Giao bài tập mới'}</Text>
                  </Pressable>
                ) : null}

                {showCreate ? (
                  <View style={styles.infoCard}>
                    <Text style={styles.fieldLabel}>Tiêu đề bài tập *</Text>
                    <TextInput value={title} onChangeText={setTitle} placeholder="VD: Bài tập buổi 3" placeholderTextColor={colors.muted} style={styles.input} />
                    <Text style={styles.fieldLabel}>Mô tả / Yêu cầu</Text>
                    <TextInput value={description} onChangeText={setDescription} placeholder="Hướng dẫn làm bài..." placeholderTextColor={colors.muted} multiline style={[styles.input, { minHeight: 72, textAlignVertical: 'top' }]} />
                    <View style={styles.twoCols}>
                      <View style={{ flex: 1 }}>
                        <DateTimeField label="Ngày hạn nộp" mode="date" value={dueDate} onChange={setDueDate} allowClear />
                      </View>
                      <View style={{ flex: 1 }}>
                        <DateTimeField label="Giờ hạn nộp" mode="time" value={dueTime} onChange={setDueTime} />
                      </View>
                    </View>
                    <Text style={styles.fieldLabel}>Thang điểm</Text>
                    <TextInput value={maxScore} onChangeText={setMaxScore} keyboardType="number-pad" placeholder="10" placeholderTextColor={colors.muted} style={styles.input} />
                    <Text style={styles.fieldLabel}>Tệp đính kèm (tối đa 20MB/tệp)</Text>
                    <Pressable disabled={uploading} onPress={() => void handlePickAttachments()} style={[styles.attachBtn, uploading && styles.disabled]}>
                      {uploading ? <ActivityIndicator size="small" color={colors.primary} /> : <Paperclip size={14} color={colors.primary} />}
                      <Text style={styles.attachBtnText}>{uploading ? 'Đang tải tệp lên…' : 'Chọn tệp đính kèm'}</Text>
                    </Pressable>
                    {attachments.length > 0 ? (
                      <View style={{ gap: 6 }}>
                        {attachments.map((file, idx) => (
                          <View key={`${file.url}-${idx}`} style={styles.attachmentRow}>
                            <Paperclip size={13} color={colors.primary} />
                            <Text numberOfLines={1} style={[styles.meta, { flex: 1, color: colors.ink }]}>{file.name}</Text>
                            <Pressable onPress={() => setAttachments((current) => current.filter((_, i) => i !== idx))} hitSlop={6}>
                              <Trash2 size={14} color="#B42318" />
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    ) : null}
                    <Pressable disabled={creating || uploading} onPress={() => void handleCreate()} style={[styles.primaryBtn, (creating || uploading) && styles.disabled]}>
                      {creating ? <ActivityIndicator size="small" color={colors.white} /> : <Check size={14} color={colors.white} />}
                      <Text style={styles.primaryBtnText}>Xác nhận giao bài</Text>
                    </Pressable>
                  </View>
                ) : null}

                <Text style={styles.sectionTitle}>Danh sách bài tập ({assignments.length})</Text>
                {loading ? (
                  <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
                ) : assignments.length === 0 ? (
                  <Text style={styles.emptyText}>Lớp chưa có bài tập nào được giao.</Text>
                ) : (
                  assignments.map((item) => (
                    <Pressable key={item._id} onPress={() => void openAssignment(item)} style={styles.sessionCard}>
                      <View style={styles.rowBetween}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowTitle}>{item.title}</Text>
                          <Text style={styles.meta}>
                            Thang điểm: {item.maxScore || 10}
                            {item.dueDate ? ` · Hạn: ${new Date(item.dueDate).toLocaleDateString('vi-VN')}` : ''}
                          </Text>
                        </View>
                        <ChevronRight size={16} color={colors.muted} />
                      </View>
                    </Pressable>
                  ))
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: 14, backgroundColor: 'rgba(19,30,48,0.48)' },
  dialog: { borderWidth: 1, borderColor: colors.border, borderRadius: 24, backgroundColor: colors.background, overflow: 'hidden' },
  tallDialog: { height: '90%' },
  modalHeader: { minHeight: 53, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  modalTitle: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: '800' },
  closeButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#F1F3F7' },
  content: { padding: 14, gap: 10, paddingBottom: 24 },
  infoCard: { padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, gap: 6 },
  title: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  roadmapTag: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: '48%', padding: 10, borderRadius: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  cellLabel: { color: colors.muted, fontSize: 9, fontWeight: '600' },
  cellValue: { color: colors.ink, fontSize: 11, fontWeight: '700', marginTop: 3 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sectionTitle: { color: colors.ink, fontSize: 12, fontWeight: '800', marginTop: 4 },
  progressCount: { color: colors.primary, fontSize: 11, fontWeight: '800' },
  progressTrack: { height: 7, borderRadius: 999, backgroundColor: '#E9EEF6', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: colors.primary },
  warnText: { color: '#C27617', fontSize: 10, fontWeight: '600' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  quickBtn: { width: '48%', minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, backgroundColor: '#EAF2FF', borderWidth: 1, borderColor: '#CFE0FF' },
  quickBtnText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  statRow: { flexDirection: 'row', gap: 8 },
  statBox: { flex: 1, padding: 12, borderRadius: 14, alignItems: 'center' },
  statVal: { fontSize: 16, fontWeight: '800' },
  statLabel: { color: colors.muted, fontSize: 10, fontWeight: '600', marginTop: 2 },
  sessionCard: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, gap: 6 },
  listRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 5, borderTopWidth: 1, borderTopColor: '#F0F3F8' },
  subList: { marginTop: 6, gap: 2 },
  rowTitle: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  badgeText: { color: colors.primary, fontSize: 10, fontWeight: '700' },
  emptyText: { color: colors.muted, fontSize: 11, textAlign: 'center', paddingVertical: 16 },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 4 },
  backBtnText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  miniAction: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#EAF2FF' },
  miniActionText: { color: colors.primary, fontSize: 10, fontWeight: '700' },
  gradeForm: { marginTop: 8, gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#EEF2F7' },
  fieldLabel: { color: colors.ink, fontSize: 10, fontWeight: '700', marginTop: 4 },
  input: { minHeight: 40, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: '#F8FAFD', color: colors.ink, fontSize: 12 },
  twoCols: { flexDirection: 'row', gap: 8 },
  primaryBtn: { minHeight: 40, borderRadius: 11, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 14 },
  primaryBtnText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  attachBtn: { minHeight: 38, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.primary, backgroundColor: '#F4F8FF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12 },
  attachBtnText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  attachmentRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 9, backgroundColor: '#F6F8FC', borderWidth: 1, borderColor: colors.border },
  attachmentLink: { flex: 1, color: colors.primary, fontSize: 11, fontWeight: '600' },
  disabled: { opacity: 0.6 },
});

