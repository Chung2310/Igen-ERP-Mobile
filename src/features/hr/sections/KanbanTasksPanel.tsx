import { PopupError } from '@/components/PopupError';
import { FullScreenFormModal } from '@/components/FullScreenFormModal';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock3,
  Folder,
  FolderOpen,
  LifeBuoy,
  FileText,
  Link2,
  Mic,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  Sliders,
  Square,
  Target,
  UserRound,
  UserPlus,
  UserCheck,
  Video,
  CheckCircle2,
  X,
} from 'lucide-react-native';
import { Card } from '@/components/Card';
import { showHrConfirm } from '@/features/hr/components/HrConfirmModal';
import { useAuth } from '@/core/auth/AuthProvider';
import {
  createKanbanProject,
  createKanbanTask,
  deleteKanbanProject,
  deleteKanbanTask,
  getKanbanMonthlyKpi,
  listHrEmployees,
  listKanbanProjects,
  listKanbanTasks,
  updateKanbanProject,
  updateKanbanTaskActivity,
  updateKanbanTask,
  updateKanbanTaskStatus,
  uploadKanbanTaskAttachment,
} from '@/features/hr/hrApi';
import type { HrEmployee, HrKanbanAttachment, HrKanbanKpiReport, HrKanbanProject, HrKanbanTask } from '@/features/hr/types';
import { formatCompactMoney, getTodayKey } from '@/features/overview/overviewPeriod';
import { colors } from '@/theme/colors';

type BoardStatus = 'Not Started' | 'In Progress' | 'Review/Testing' | 'Done';
type ScopeFilter = 'all' | 'with_project' | 'no_project' | 'kpi';

const TASK_CATEGORIES = [
  'Hướng dẫn nhân viên mới',
  'Đào tạo',
  'Tuyển dụng',
  'Văn hóa',
  'Bán hàng',
] as const;

function getVietnamLocalDateTime(date = new Date()): string {
  const vn = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return vn.toISOString().slice(0, 16);
}

function getVietnamDateKey(date: Date): string {
  return getVietnamLocalDateTime(date).slice(0, 10);
}

function parseVietnamDateKey(value?: string): Date | undefined {
  const key = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? new Date(`${key}T12:00:00+07:00`) : undefined;
}

/** Khớp 100% logic parseVietnamTaskInstant & calculateTaskDeadlineKpi từ bản web ERP. */
function parseVietnamTaskInstant(value?: string): Date | undefined {
  const raw = String(value || '').trim();
  if (!raw || raw === 'Chưa cập nhật') return undefined;
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw);
  const normalized = hasZone
    ? raw
    : /^\d{4}-\d{2}-\d{2}$/.test(raw)
      ? `${raw}T23:59:59+07:00`
      : `${raw}+07:00`;
  const d = new Date(normalized);
  return Number.isNaN(d.valueOf()) ? undefined : d;
}

function formatTaskDateTime(value?: string): string {
  const date = parseVietnamTaskInstant(value);
  return date
    ? date.toLocaleString('vi-VN', {
        timeZone: 'Asia/Bangkok',
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '';
}

function normalizeTaskDateTime(value?: string): string {
  const date = parseVietnamTaskInstant(value);
  return date ? getVietnamLocalDateTime(date) : '';
}

function formatProjectDate(value?: string): string {
  const date = parseVietnamDateKey(value);
  return date
    ? date.toLocaleDateString('vi-VN', { timeZone: 'Asia/Bangkok', dateStyle: 'long' })
    : '';
}

type DatePickerTarget = 'taskDue' | 'taskStart' | 'projectDue';
type ActiveDatePicker = { target: DatePickerTarget; value: Date };

function calculateTaskDeadlineKpi(task: HrKanbanTask) {
  if (task.status !== 'Done' && task.status !== 'done') return null;
  const due = parseVietnamTaskInstant(task.dueDate);
  const completed = parseVietnamTaskInstant(task.endTime || task.completedAt || '');
  if (!due || !completed) return null;
  if (completed <= due) {
    return { status: 'ontime' as const, text: 'Đạt KPI', diff: 0 };
  }
  const diff = Math.max(0.1, Math.round((completed.getTime() - due.getTime()) / 360_000) / 10);
  return { status: 'late' as const, text: `Trễ hạn ${diff}h`, diff };
}

function calculateEstimatedTimeProgress(task: HrKanbanTask) {
  const started = parseVietnamTaskInstant(task.startTime);
  const ended = parseVietnamTaskInstant(task.endTime);
  const est = Number(task.estTime);
  if (!started || !ended || ended < started || !Number.isFinite(est) || est <= 0) return null;
  const actualHours = (ended.getTime() - started.getTime()) / 3_600_000;
  if (actualHours <= est) {
    return { status: 'within' as const, text: 'Trong giờ dự tính' };
  }
  const diff = Number((actualHours - est).toFixed(1));
  return { status: 'over' as const, text: `Vượt dự tính ${diff}h` };
}

function taskProgress(task: HrKanbanTask) {
  if (task.status === 'Done' || task.status === 'done') return 100;
  const explicit = Number(task.progress);
  if (Number.isFinite(explicit)) return Math.min(100, Math.max(0, explicit));
  return ['In Progress', 'doing', 'Review/Testing'].includes(task.status) ? 1 : 0;
}

function shiftMonth(period: string, delta: number): string {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(y, (m || 1) - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatPeriodLabel(period: string): string {
  const [y, m] = period.split('-');
  return `Tháng ${Number(m)}/${y}`;
}

const STATUS_META: Array<{ key: BoardStatus; label: string; color: string; tone: string }> = [
  { key: 'Not Started', label: 'Chưa bắt đầu', color: '#64748B', tone: '#F1F5F9' },
  { key: 'In Progress', label: 'Đang làm', color: '#2463EB', tone: '#EAF2FF' },
  { key: 'Review/Testing', label: 'Kiểm tra', color: '#7754C8', tone: '#F1EBFF' },
  { key: 'Done', label: 'Hoàn thành', color: '#16885A', tone: '#E9F8F1' },
];

const PRIORITY_OPTIONS = [
  { key: 'High', label: 'Cao', color: '#DC2626', tone: '#FEE2E2' },
  { key: 'Medium', label: 'Trung bình', color: '#C27617', tone: '#FFF3E5' },
  { key: 'Low', label: 'Thấp', color: '#16885A', tone: '#E9F8F1' },
] as const;

function normalizeStatus(status?: string): BoardStatus {
  const s = (status || '').toLowerCase();
  if (s === 'done') return 'Done';
  if (s === 'review/testing' || s === 'review') return 'Review/Testing';
  if (s === 'in progress' || s === 'in_progress' || s === 'doing') return 'In Progress';
  return 'Not Started';
}

function getStatusMeta(status?: string) {
  const norm = normalizeStatus(status);
  return STATUS_META.find((m) => m.key === norm) ?? STATUS_META[0];
}

function nextBoardStatus(status?: string): BoardStatus {
  const norm = normalizeStatus(status);
  const idx = STATUS_META.findIndex((m) => m.key === norm);
  return STATUS_META[(idx + 1) % STATUS_META.length].key;
}

function getPriorityMeta(priority?: string) {
  const p = (priority || 'medium').toLowerCase();
  if (p === 'high' || p === 'urgent') return PRIORITY_OPTIONS[0];
  if (p === 'low') return PRIORITY_OPTIONS[2];
  return PRIORITY_OPTIONS[1];
}

export function KanbanTasksPanel({
  companyCode,
  branchId,
}: {
  companyCode?: string;
  branchId?: string;
}) {
  const { user } = useAuth();
  const taskAudioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const permissions = user?.permissions ?? [];
  const hasPermission = (permission: string) => permissions.includes('*') || permissions.includes(permission);
  const canReadWork = hasPermission('work:read');
  const canManageTasks = hasPermission('work:manage');
  const currentUid = user?._id || user?.id || '';

  const [projects, setProjects] = useState<HrKanbanProject[]>([]);
  const [tasks, setTasks] = useState<HrKanbanTask[]>([]);
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & accordion state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | BoardStatus>('all');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Monthly KPI state
  const currentMonthKey = useMemo(() => getTodayKey().slice(0, 7), []);
  const [kpiPeriod, setKpiPeriod] = useState(currentMonthKey);
  const [kpiReport, setKpiReport] = useState<HrKanbanKpiReport | null>(null);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [kpiError, setKpiError] = useState<string | null>(null);

  // Task Modal (Create / Edit)
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<HrKanbanTask | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskProjectId, setTaskProjectId] = useState('');
  const [taskAssigneeUid, setTaskAssigneeUid] = useState('');
  const [taskStatus, setTaskStatus] = useState<BoardStatus>('Not Started');
  const [taskPriority, setTaskPriority] = useState('Medium');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskStartTime, setTaskStartTime] = useState('');
  const [taskEstTime, setTaskEstTime] = useState('');
  const [taskCategory, setTaskCategory] = useState<string>('Hướng dẫn nhân viên mới');
  const [taskSalesKpiTarget, setTaskSalesKpiTarget] = useState('');
  const [taskLinkNote, setTaskLinkNote] = useState('');
  const [taskAttachments, setTaskAttachments] = useState<HrKanbanAttachment[]>([]);
  const [taskAttachmentLinkDraft, setTaskAttachmentLinkDraft] = useState('');
  const [uploadingTaskAttachment, setUploadingTaskAttachment] = useState(false);
  const [recordingTaskAudio, setRecordingTaskAudio] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [activityTask, setActivityTask] = useState<HrKanbanTask | null>(null);
  const [activityMode, setActivityMode] = useState<'progress' | 'help' | null>(null);
  const [activityProgress, setActivityProgress] = useState(0);
  const [activityNote, setActivityNote] = useState('');
  const [activityHelperUid, setActivityHelperUid] = useState('');
  const [savingActivity, setSavingActivity] = useState(false);

  // Project Modal (Create / Edit)
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<HrKanbanProject | null>(null);
  const [projName, setProjName] = useState('');
  const [projPriority, setProjPriority] = useState('medium');
  const [projDueAt, setProjDueAt] = useState('');
  const [savingProj, setSavingProj] = useState(false);
  const [activeDatePicker, setActiveDatePicker] = useState<ActiveDatePicker | null>(null);

  const loadData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const [projList, taskList, empList] = await Promise.all([
          listKanbanProjects(branchId).catch(() => []),
          listKanbanTasks(branchId),
          listHrEmployees(companyCode, branchId).catch(() => []),
        ]);
        setProjects(
          projList.sort(
            (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
          ),
        );
        setTasks(taskList);
        setEmployees(empList);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không tải được dữ liệu giao việc.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [branchId, companyCode],
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const loadKpi = useCallback(async () => {
    setKpiLoading(true);
    setKpiError(null);
    try {
      const data = await getKanbanMonthlyKpi(kpiPeriod, branchId);
      setKpiReport(data);
    } catch (err) {
      setKpiError(err instanceof Error ? err.message : 'Không tải được KPI công việc theo tháng.');
    } finally {
      setKpiLoading(false);
    }
  }, [branchId, kpiPeriod]);

  useEffect(() => {
    if (scopeFilter === 'kpi' && canReadWork) {
      void loadKpi();
    }
  }, [canReadWork, loadKpi, scopeFilter]);

  useEffect(() => {
    if (!canReadWork && scopeFilter !== 'all') setScopeFilter('all');
  }, [canReadWork, scopeFilter]);

  const toggleGroup = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  const applyPickedDate = useCallback((target: DatePickerTarget, date: Date) => {
    if (target === 'projectDue') {
      setProjDueAt(getVietnamDateKey(date));
      return;
    }
    const value = getVietnamLocalDateTime(date);
    if (target === 'taskDue') setTaskDueDate(value);
    else setTaskStartTime(value);
  }, []);

  const openDatePicker = useCallback(
    (target: DatePickerTarget) => {
      const currentValue = target === 'taskDue'
        ? taskDueDate
        : target === 'taskStart'
          ? taskStartTime
          : projDueAt;
      const initialValue = target === 'projectDue'
        ? parseVietnamDateKey(currentValue) || new Date()
        : parseVietnamTaskInstant(currentValue) || new Date();

      if (Platform.OS !== 'android') {
        setActiveDatePicker({ target, value: initialValue });
        return;
      }

      DateTimePickerAndroid.open({
        value: initialValue,
        mode: 'date',
        display: 'calendar',
        timeZoneName: 'Asia/Bangkok',
        onChange: (event, selectedDate) => {
          if (event.type !== 'set' || !selectedDate) return;
          if (target === 'projectDue') {
            applyPickedDate(target, selectedDate);
            return;
          }

          const selectedDay = getVietnamDateKey(selectedDate);
          const initialTime = getVietnamLocalDateTime(initialValue).slice(11, 16);
          const timeValue = parseVietnamTaskInstant(`${selectedDay}T${initialTime}`) || selectedDate;
          DateTimePickerAndroid.open({
            value: timeValue,
            mode: 'time',
            display: 'clock',
            is24Hour: true,
            timeZoneName: 'Asia/Bangkok',
            onChange: (timeEvent, selectedTime) => {
              if (timeEvent.type === 'set' && selectedTime) applyPickedDate(target, selectedTime);
            },
          });
        },
      });
    }, [applyPickedDate, projDueAt, taskDueDate, taskStartTime],
  );

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (statusFilter !== 'all' && normalizeStatus(t.status) !== statusFilter) return false;
      if (!q) return true;
      return (
        t.title?.toLowerCase().includes(q) ||
        t.assignee?.toLowerCase().includes(q) ||
        t.assigneeName?.toLowerCase().includes(q) ||
        t.category?.toLowerCase().includes(q)
      );
    });
  }, [search, statusFilter, tasks]);

  const projectIdsSet = useMemo(() => new Set(projects.map((p) => p.id)), [projects]);

  const unassignedTasks = useMemo(
    () => filteredTasks.filter((t) => !t.projectId || !projectIdsSet.has(t.projectId)),
    [filteredTasks, projectIdsSet],
  );

  const projectGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects
      .map((proj) => {
        const projTasks = filteredTasks.filter((t) => t.projectId === proj.id);
        const allProjTasks = tasks.filter((t) => t.projectId === proj.id);
        const doneCount = allProjTasks.filter((t) => normalizeStatus(t.status) === 'Done').length;
        const progress = allProjTasks.length
          ? Math.round((doneCount / allProjTasks.length) * 100)
          : 0;
        return { project: proj, tasks: projTasks, totalCount: allProjTasks.length, doneCount, progress };
      })
      .filter((g) => {
        if (!q && statusFilter === 'all') return true;
        return g.tasks.length > 0 || (q && g.project.name.toLowerCase().includes(q));
      });
  }, [filteredTasks, projects, search, statusFilter, tasks]);

  const uploadTaskAssets = useCallback(async (assets: Array<{
    uri: string;
    name: string;
    mimeType?: string;
    size?: number;
  }>) => {
    if (taskAttachments.length + assets.length > 30) {
      Alert.alert('Đã đủ tệp đính kèm', 'Mỗi công việc có thể đính kèm tối đa 30 tệp.');
      return;
    }
    if (!assets.length) return;
    setUploadingTaskAttachment(true);
    try {
      const results = await Promise.allSettled(assets.map((asset) => uploadKanbanTaskAttachment(asset)));
      const uploaded = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
      if (uploaded.length) setTaskAttachments((current) => [...current, ...uploaded].slice(0, 30));
      const failures = results.filter((result) => result.status === 'rejected');
      if (failures.length) {
        const firstError = failures[0].status === 'rejected' ? failures[0].reason : undefined;
        Alert.alert(
          'Không tải được một số tệp',
          firstError instanceof Error ? firstError.message : `Đã tải ${uploaded.length}/${assets.length} tệp.`,
        );
      }
    } finally {
      setUploadingTaskAttachment(false);
    }
  }, [taskAttachments.length]);

  const pickTaskAttachments = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      await uploadTaskAssets(result.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType,
        size: asset.size,
      })));
    } catch (err) {
      Alert.alert('Không mở được tệp', err instanceof Error ? err.message : 'Vui lòng thử lại.');
    }
  }, [uploadTaskAssets]);

  const recordTaskAudio = useCallback(async () => {
    if (taskAttachments.length >= 30) {
      Alert.alert('Đã đủ tệp đính kèm', 'Mỗi công việc có thể đính kèm tối đa 30 tệp.');
      return;
    }
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Chưa có quyền micro', 'Hãy cho phép ERP Mobile dùng micro để ghi âm.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await taskAudioRecorder.prepareToRecordAsync();
      taskAudioRecorder.record();
      setRecordingTaskAudio(true);
    } catch (err) {
      Alert.alert('Không thể ghi âm', err instanceof Error ? err.message : 'Vui lòng kiểm tra quyền micro.');
    }
  }, [taskAttachments.length, taskAudioRecorder]);

  const stopTaskAudioRecording = useCallback(async () => {
    try {
      await taskAudioRecorder.stop();
      setRecordingTaskAudio(false);
      const uri = taskAudioRecorder.uri;
      if (!uri) throw new Error('Không tìm thấy tệp ghi âm vừa tạo.');
      const extension = uri.split('?')[0].split('.').pop()?.toLowerCase();
      const mimeType = extension === 'm4a' ? 'audio/mp4' : extension === 'caf' ? 'audio/x-caf' : 'audio/mpeg';
      await uploadTaskAssets([{
        uri,
        name: `Ghi âm ${new Date().toLocaleString('vi-VN')}.${extension || 'm4a'}`,
        mimeType,
      }]);
    } catch (err) {
      Alert.alert('Không lưu được bản ghi âm', err instanceof Error ? err.message : 'Vui lòng thử lại.');
    } finally {
      setRecordingTaskAudio(false);
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
    }
  }, [taskAudioRecorder, uploadTaskAssets]);

  const recordTaskVideo = useCallback(async () => {
    if (taskAttachments.length >= 30) {
      Alert.alert('Đã đủ tệp đính kèm', 'Mỗi công việc có thể đính kèm tối đa 30 tệp.');
      return;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['videos'],
        videoMaxDuration: 60,
        videoQuality: ImagePicker.UIImagePickerControllerQualityType.VGA640x480,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) return;
      await uploadTaskAssets([{
        uri: asset.uri,
        name: asset.fileName || `Ghi hình ${new Date().toLocaleString('vi-VN')}.mp4`,
        mimeType: asset.mimeType || 'video/mp4',
        size: asset.fileSize,
      }]);
    } catch (err) {
      Alert.alert('Không thể ghi hình', err instanceof Error ? err.message : 'Vui lòng kiểm tra quyền camera và micro.');
    }
  }, [taskAttachments.length, uploadTaskAssets]);

  const addTaskAttachmentLink = useCallback(() => {
    const raw = taskAttachmentLinkDraft.trim();
    if (!raw) return;
    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
      const parsed = new URL(normalized);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('invalid protocol');
      if (taskAttachments.length >= 30) {
        Alert.alert('Đã đủ tệp đính kèm', 'Mỗi công việc có thể đính kèm tối đa 30 tệp.');
        return;
      }
      setTaskAttachments((current) => [...current, {
        id: `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        name: `${parsed.host}${parsed.pathname}`,
        url: parsed.toString(),
        type: 'link',
      }]);
      setTaskAttachmentLinkDraft('');
    } catch {
      Alert.alert('Link không hợp lệ', 'Hãy nhập địa chỉ bắt đầu bằng http:// hoặc https://.');
    }
  }, [taskAttachmentLinkDraft, taskAttachments.length]);

  // --- Task Handlers ---
  const openCreateTask = useCallback(
    (presetProjectId = '') => {
      const nowVn = getVietnamLocalDateTime();
      const tomorrowVn = getVietnamLocalDateTime(new Date(Date.now() + 86_400_000));
      setEditingTask(null);
      setTaskTitle('');
      setTaskProjectId(presetProjectId);
      setTaskAssigneeUid(user?._id || user?.id || '');
      setTaskStatus('Not Started');
      setTaskPriority('Medium');
      setTaskStartTime(nowVn);
      setTaskDueDate(tomorrowVn);
      setTaskEstTime('');
      setTaskCategory('Hướng dẫn nhân viên mới');
      setTaskSalesKpiTarget('');
      setTaskLinkNote('');
      setTaskAttachments([]);
      setTaskAttachmentLinkDraft('');
      setTaskModalOpen(true);
    },
    [user?._id, user?.id],
  );

  const openEditTask = useCallback((task: HrKanbanTask) => {
    setEditingTask(task);
    setTaskTitle(task.title || '');
    setTaskProjectId(task.projectId || '');
    setTaskAssigneeUid(task.assigneeUid || '');
    setTaskStatus(normalizeStatus(task.status));
    setTaskPriority(task.priority || 'Medium');
    setTaskStartTime(task.startTime ? normalizeTaskDateTime(task.startTime) : '');
    setTaskDueDate(task.dueDate ? normalizeTaskDateTime(task.dueDate) : '');
    setTaskEstTime(task.estTime != null ? String(task.estTime) : '');
    setTaskCategory(task.category || 'Hướng dẫn nhân viên mới');
    setTaskSalesKpiTarget(task.salesKpiTarget ? String(task.salesKpiTarget) : '');
    setTaskLinkNote(task.linkNote || '');
    setTaskAttachments(task.attachments || []);
    setTaskAttachmentLinkDraft('');
    setTaskModalOpen(true);
  }, []);

  const onSaveTask = useCallback(async () => {
    if (!taskTitle.trim() || savingTask) {
      if (!taskTitle.trim()) Alert.alert('Thiếu tiêu đề', 'Hãy nhập tên công việc.');
      return;
    }
    const cleanDue = taskDueDate.trim();
    if (!cleanDue || !parseVietnamTaskInstant(cleanDue)) {
      Alert.alert('Thiếu hạn chót', 'Vui lòng chọn ngày và giờ hạn chót để tính KPI.');
      return;
    }
    const estNum = taskEstTime.trim() ? Number(taskEstTime) : undefined;
    const salesTarget =
      taskCategory === 'Bán hàng' && taskSalesKpiTarget.trim()
        ? Math.max(0, Math.round(Number(taskSalesKpiTarget) || 0))
        : 0;
    const finalEndTime =
      taskStatus === 'Done'
        ? editingTask?.endTime || getVietnamLocalDateTime()
        : editingTask?.endTime || '';
    const startedDate = parseVietnamTaskInstant(taskStartTime);
    const endedDate = parseVietnamTaskInstant(finalEndTime);
    const actualHours =
      startedDate && endedDate && endedDate >= startedDate
        ? Number(((endedDate.getTime() - startedDate.getTime()) / 3_600_000).toFixed(2))
        : editingTask?.actualTime;

    setSavingTask(true);
    try {
      const assignedEmp = employees.find((e) => (e.uid || e._id || e.id) === taskAssigneeUid);
      const assigneeName = assignedEmp?.displayName || user?.displayName || 'Chưa phân công';

      if (editingTask) {
        const updated = await updateKanbanTask(
          editingTask.id,
          {
            title: taskTitle.trim(),
            projectId: taskProjectId,
            assigneeUid: taskAssigneeUid,
            assignee: assigneeName,
            status: taskStatus,
            priority: taskPriority,
            dueDate: cleanDue,
            startTime: taskStartTime.trim() || undefined,
            endTime: finalEndTime || undefined,
            estTime: estNum,
            actualTime: actualHours,
            category: taskCategory,
            salesKpiTarget: salesTarget,
            linkNote: taskLinkNote.trim(),
            attachments: taskAttachments,
          },
          branchId,
        );
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      } else {
        const created = await createKanbanTask(
          {
            title: taskTitle.trim(),
            companyCode: companyCode || user?.companyCode,
            projectId: taskProjectId,
            assigneeUid: taskAssigneeUid,
            assignee: assigneeName,
            status: taskStatus,
            priority: taskPriority,
            dueDate: cleanDue,
            startTime: taskStartTime.trim() || undefined,
            endTime: finalEndTime || undefined,
            estTime: estNum,
            actualTime: actualHours,
            category: taskCategory,
            salesKpiTarget: salesTarget,
            linkNote: taskLinkNote.trim(),
            attachments: taskAttachments,
          },
          branchId,
        );
        setTasks((prev) => [created, ...prev]);
      }
      setTaskModalOpen(false);
    } catch (err) {
      Alert.alert('Lỗi lưu công việc', err instanceof Error ? err.message : 'Vui lòng thử lại.');
    } finally {
      setSavingTask(false);
    }
  }, [
    branchId,
    companyCode,
    editingTask,
    employees,
    savingTask,
    taskAssigneeUid,
    taskAttachments,
    taskCategory,
    taskDueDate,
    taskEstTime,
    taskLinkNote,
    taskPriority,
    taskProjectId,
    taskSalesKpiTarget,
    taskStartTime,
    taskStatus,
    taskTitle,
    user?.companyCode,
    user?.displayName,
  ]);

  const onQuickAdvanceStatus = useCallback(
    async (task: HrKanbanTask) => {
      const next = nextBoardStatus(task.status);
      const nowVn = getVietnamLocalDateTime();
      const patch: Record<string, unknown> = { status: next };
      if (next === 'Done') {
        const finalEnd = task.endTime || nowVn;
        patch.endTime = finalEnd;
        const startD = parseVietnamTaskInstant(task.startTime);
        const endD = parseVietnamTaskInstant(finalEnd);
        if (startD && endD && endD >= startD) {
          patch.actualTime = Number(((endD.getTime() - startD.getTime()) / 3_600_000).toFixed(2));
        }
      }
      try {
        const updated = await updateKanbanTask(task.id, patch, branchId);
        setTasks((prev) =>
          prev.map((t) =>
            t.id === updated.id
              ? { ...t, ...updated, status: next, endTime: (patch.endTime as string) ?? updated.endTime }
              : t,
          ),
        );
      } catch (err) {
        Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể đổi trạng thái.');
      }
    },
    [branchId],
  );

  const onDeleteTask = useCallback(
    (task: HrKanbanTask) => {
      showHrConfirm({
        title: 'Xóa công việc?',
        message: `Bạn chắc chắn muốn xóa "${task.title}"?`,
        confirmLabel: 'Xóa',
        onConfirm: async () => {
          try {
            await deleteKanbanTask(task.id, branchId);
            setTasks((prev) => prev.filter((t) => t.id !== task.id));
            setTaskModalOpen(false);
          } catch (err) {
            Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể xóa.');
          }
        },
      });
    },
    [branchId],
  );

  const openTaskActivity = useCallback((task: HrKanbanTask, mode: 'progress' | 'help') => {
    setActivityTask(task);
    setActivityMode(mode);
    setActivityProgress(taskProgress(task));
    setActivityNote('');
    setActivityHelperUid('');
  }, []);

  const saveTaskActivity = useCallback(async () => {
    if (!activityTask || !activityMode || savingActivity) return;
    const note = activityNote.trim();
    if (!note) {
      Alert.alert(activityMode === 'progress' ? 'Thiếu nội dung báo cáo' : 'Thiếu lý do trợ giúp', 'Vui lòng nhập nội dung trước khi lưu.');
      return;
    }
    if (note.length > 2000) {
      Alert.alert('Nội dung quá dài', 'Nội dung tối đa 2.000 ký tự.');
      return;
    }
    const helper = activityMode === 'help' && activityHelperUid
      ? employees.find((employee) => (employee.id || employee._id || employee.uid) === activityHelperUid)
      : undefined;
    setSavingActivity(true);
    try {
      const updated = await updateKanbanTaskActivity(
        activityTask.id,
        {
          action: activityMode,
          revision: activityTask.revision || 0,
          ...(activityMode === 'progress' ? { progress: activityProgress } : {}),
          note: activityMode === 'help' && helper ? `Nhờ ${helper.displayName} hỗ trợ: ${note}` : note,
          ...(activityMode === 'help' && helper
            ? { helper: { uid: helper.id || helper._id || helper.uid || '', name: helper.displayName } }
            : {}),
        },
        branchId,
      );
      setTasks((current) => current.map((task) => task.id === updated.id ? updated : task));
      setActivityTask(null);
      setActivityMode(null);
      setActivityNote('');
    } catch (err) {
      Alert.alert('Không cập nhật được công việc', err instanceof Error ? err.message : 'Vui lòng thử lại.');
      if ((err as { status?: number })?.status === 409) void loadData(true);
    } finally {
      setSavingActivity(false);
    }
  }, [activityHelperUid, activityMode, activityNote, activityProgress, activityTask, branchId, employees, loadData, savingActivity]);

  const runTaskActivity = useCallback(async (task: HrKanbanTask, action: 'join' | 'resolve') => {
    if (savingActivity) return;
    setSavingActivity(true);
    try {
      const updated = await updateKanbanTaskActivity(task.id, { action, revision: task.revision || 0 }, branchId);
      setTasks((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (err) {
      Alert.alert('Không cập nhật được công việc', err instanceof Error ? err.message : 'Vui lòng thử lại.');
      if ((err as { status?: number })?.status === 409) void loadData(true);
    } finally {
      setSavingActivity(false);
    }
  }, [branchId, loadData, savingActivity]);

  // --- Project Handlers ---
  const openCreateProject = useCallback(() => {
    setEditingProject(null);
    setProjName('');
    setProjPriority('medium');
    setProjDueAt('');
    setProjectModalOpen(true);
  }, []);

  const openEditProject = useCallback((project: HrKanbanProject) => {
    setEditingProject(project);
    setProjName(project.name || '');
    setProjPriority(project.priority || 'medium');
    setProjDueAt(project.dueAt ? project.dueAt.slice(0, 10) : '');
    setProjectModalOpen(true);
  }, []);

  const onSaveProject = useCallback(async () => {
    if (!projName.trim() || savingProj) {
      if (!projName.trim()) Alert.alert('Thiếu tên dự án', 'Hãy nhập tên dự án.');
      return;
    }
    setSavingProj(true);
    try {
      if (editingProject) {
        const updated = await updateKanbanProject(
          editingProject.id,
          {
            name: projName.trim(),
            priority: projPriority,
            dueAt: projDueAt.trim() || null,
          },
          branchId,
        );
        setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      } else {
        const created = await createKanbanProject({
          name: projName.trim(),
          companyCode: companyCode || user?.companyCode || 'SYSTEM',
          branchId,
          creatorUid: user?._id || user?.id,
          priority: projPriority,
          dueAt: projDueAt.trim() || undefined,
        });
        setProjects((prev) => [created, ...prev]);
      }
      setProjectModalOpen(false);
    } catch (err) {
      Alert.alert('Lỗi lưu dự án', err instanceof Error ? err.message : 'Vui lòng thử lại.');
    } finally {
      setSavingProj(false);
    }
  }, [branchId, companyCode, editingProject, projDueAt, projName, projPriority, savingProj, user?._id, user?.companyCode, user?.id]);

  const onDeleteProject = useCallback(
    (project: HrKanbanProject) => {
      showHrConfirm({
        title: 'Xóa dự án?',
        message: `Xóa dự án "${project.name}"? Các công việc bên trong sẽ chuyển sang nhóm Không thuộc dự án.`,
        confirmLabel: 'Xóa dự án',
        onConfirm: async () => {
          try {
            await deleteKanbanProject(project.id, branchId);
            setProjects((prev) => prev.filter((p) => p.id !== project.id));
            setTasks((prev) =>
              prev.map((t) => (t.projectId === project.id ? { ...t, projectId: '' } : t)),
            );
            setProjectModalOpen(false);
          } catch (err) {
            Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể xóa dự án.');
          }
        },
      });
    },
    [branchId],
  );

  const renderTaskRow = (task: HrKanbanTask) => {
    const st = getStatusMeta(task.status);
    const pr = getPriorityMeta(task.priority);
    const deadlineKpi = calculateTaskDeadlineKpi(task);
    const estProgress = calculateEstimatedTimeProgress(task);
    const progress = taskProgress(task);
    const closed = task.status === 'Archived';
    const isActivityOwner = canManageTasks || task.assigneeUid === currentUid;
    const canJoinHelp = task.helpRequested
      && !closed
      && (!task.requestedHelperUid || task.requestedHelperUid === currentUid)
      && task.assigneeUid !== currentUid
      && !task.helpers?.some((helper) => helper.uid === currentUid);
    return (
      <Pressable
        key={task.id}
        onPress={canManageTasks ? () => openEditTask(task) : undefined}
        style={styles.taskRow}
      >
        <View style={styles.taskRowTop}>
          <Text numberOfLines={2} style={styles.taskTitle}>
            {task.title}
          </Text>
          {canManageTasks ? (
            <Pressable
              hitSlop={6}
              onPress={() => void onQuickAdvanceStatus(task)}
              style={[styles.statusBadge, { backgroundColor: st.tone }]}
            >
              <View style={styles.iconButtonContent}>
                <Text style={[styles.statusBadgeText, { color: st.color }]}>{st.label}</Text>
                <RefreshCw size={11} color={st.color} />
              </View>
            </Pressable>
          ) : (
            <View style={[styles.statusBadge, { backgroundColor: st.tone }]}>
              <Text style={[styles.statusBadgeText, { color: st.color }]}>{st.label}</Text>
            </View>
          )}
        </View>
        <View style={styles.taskRowMeta}>
          <View style={styles.taskMetaGroup}>
            <UserRound size={12} color={colors.muted} />
            <Text numberOfLines={1} style={styles.taskMetaText}>{task.assignee || task.assigneeName || 'Chưa phân công'}</Text>
            {task.dueDate && task.dueDate !== 'Chưa cập nhật' ? (
              <View style={styles.taskMetaGroup}>
                <CalendarDays size={12} color={colors.muted} />
                <Text style={styles.taskMetaText}>{task.dueDate.slice(0, 10)}</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.priorityTag, { color: pr.color, backgroundColor: pr.tone }]}>
            {pr.label}
          </Text>
        </View>
        <View style={styles.taskProgressSummary}>
          <View style={styles.progressLabelRow}>
            <Text style={styles.taskProgressLabel}>Tiến độ</Text>
            <Text style={styles.taskProgressPercent}>{progress}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          {task.progressNote ? <Text numberOfLines={2} style={styles.progressNote}>💬 {task.progressNote}</Text> : null}
        </View>
        {task.helpRequested ? (
          <View style={styles.helpNotice}>
            <LifeBuoy size={13} color="#B42318" />
            <View style={{ flex: 1 }}>
              <Text style={styles.helpNoticeTitle}>Đang cần trợ giúp</Text>
              {task.helpReason ? <Text style={styles.helpNoticeText}>{task.helpReason}</Text> : null}
            </View>
          </View>
        ) : null}
        {task.helpers?.length ? (
          <View style={styles.helpersLine}>
            <UserCheck size={12} color={colors.primary} />
            <Text style={styles.taskMetaText}>Người hỗ trợ: {task.helpers.map((helper) => helper.name).join(', ')}</Text>
          </View>
        ) : null}
        {((isActivityOwner && !closed) || canJoinHelp) ? (
          <View style={styles.taskActivityActions}>
            {isActivityOwner && !closed ? (
              <>
                <Pressable
                  onPress={(event) => { event.stopPropagation(); openTaskActivity(task, 'progress'); }}
                  style={styles.taskActivityBtn}
                >
                  <Sliders size={13} color={colors.primary} />
                  <Text style={styles.taskActivityBtnText}>Báo cáo tiến độ</Text>
                </Pressable>
                {!task.helpRequested && progress < 100 ? (
                  <Pressable
                    onPress={(event) => { event.stopPropagation(); openTaskActivity(task, 'help'); }}
                    style={styles.taskHelpBtn}
                  >
                    <LifeBuoy size={13} color="#B42318" />
                    <Text style={styles.taskHelpBtnText}>Yêu cầu trợ giúp</Text>
                  </Pressable>
                ) : null}
                {task.helpRequested ? (
                  <Pressable
                    onPress={(event) => { event.stopPropagation(); void runTaskActivity(task, 'resolve'); }}
                    disabled={savingActivity}
                    style={styles.taskResolveBtn}
                  >
                    <CheckCircle2 size={13} color="#16885A" />
                    <Text style={styles.taskResolveBtnText}>Đã giải quyết</Text>
                  </Pressable>
                ) : null}
              </>
            ) : null}
            {canJoinHelp ? (
              <Pressable
                onPress={(event) => { event.stopPropagation(); void runTaskActivity(task, 'join'); }}
                disabled={savingActivity}
                style={styles.taskJoinBtn}
              >
                <UserPlus size={13} color={colors.white} />
                <Text style={styles.taskJoinBtnText}>Tham gia hỗ trợ</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {deadlineKpi || estProgress || (task.salesKpiTarget && task.salesKpiTarget > 0) ? (
          <View style={styles.kpiTagRow}>
            {deadlineKpi ? (
              <View style={[styles.kpiTagBox, deadlineKpi.status === 'ontime' ? styles.kpiTagOk : styles.kpiTagLate]}>
                {deadlineKpi.status === 'ontime' ? <Check size={11} color="#15803D" /> : <AlertTriangle size={11} color="#B91C1C" />}
                <Text style={[styles.kpiTag, deadlineKpi.status === 'ontime' ? styles.kpiTagOkText : styles.kpiTagLateText]}>{deadlineKpi.text}</Text>
              </View>
            ) : null}
            {estProgress ? (
              <View style={[styles.kpiTagBox, estProgress.status === 'within' ? styles.kpiTagInfo : styles.kpiTagLate]}>
                {estProgress.status === 'within' ? <Clock3 size={11} color={colors.primary} /> : <AlertTriangle size={11} color="#B91C1C" />}
                <Text style={[styles.kpiTag, estProgress.status === 'within' ? styles.kpiTagInfoText : styles.kpiTagLateText]}>{estProgress.text}</Text>
              </View>
            ) : null}
            {task.salesKpiTarget && task.salesKpiTarget > 0 ? (
              <View style={[styles.kpiTagBox, styles.kpiTagInfo]}>
                <Target size={11} color={colors.primary} />
                <Text style={[styles.kpiTag, styles.kpiTagInfoText]}>{formatCompactMoney(task.salesKpiTarget)}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void loadData(true);
          }}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      {/* Search + Action Buttons */}
      <View style={styles.topActions}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Tìm dự án, công việc, người làm..."
          placeholderTextColor={colors.muted}
          style={styles.search}
        />
        {canManageTasks ? (
          <Pressable onPress={openCreateProject} style={styles.secondaryActionBtn}>
            <View style={styles.iconButtonContent}><Plus size={13} color={colors.primary} /><Text style={styles.secondaryActionText}>Dự án</Text></View>
          </Pressable>
        ) : null}
        {canManageTasks && (
        <Pressable onPress={() => openCreateTask('')} style={styles.primaryBtn}>
          <View style={styles.iconButtonContent}><Plus size={13} color={colors.white} /><Text style={styles.primaryBtnText}>Việc</Text></View>
        </Pressable>
        )}
      </View>

      {/* Scope Filter: Tất cả | Theo dự án | Không dự án | KPI tháng */}
      <View style={styles.scopeBar}>
        {(
          [
            { key: 'all', label: `Tất cả` },
            { key: 'with_project', label: `Dự án (${projects.length})` },
            { key: 'no_project', label: `Không DA (${unassignedTasks.length})` },
            { key: 'kpi', label: 'KPI tháng' },
          ] as const
        ).filter((item) => canReadWork || item.key === 'all').map((item) => {
          const active = scopeFilter === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setScopeFilter(item.key)}
              style={[styles.scopeBtn, active && styles.scopeBtnActive]}
            >
              <Text numberOfLines={1} style={[styles.scopeText, active && styles.scopeTextActive]}>
                {item.key === 'all' && !canReadWork ? 'Việc của tôi' : item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {scopeFilter === 'kpi' && canReadWork ? (
        <View style={styles.kpiWrap}>
          {/* Month selector bar */}
          <Card style={styles.kpiBar}>
            <View style={{ flex: 1 }}>
              <Text style={styles.groupTitle}>KPI công việc theo tháng</Text>
              <Text style={styles.groupSub}>
                {kpiReport?.periodStatus === 'closed' ? 'Đã chốt kỳ KPI' : 'Số liệu tạm tính trong kỳ'}
              </Text>
            </View>
            <View style={styles.monthNav}>
              <Pressable
                onPress={() => setKpiPeriod((p) => shiftMonth(p, -1))}
                style={styles.monthBtn}
              >
                <ChevronLeft size={16} color={colors.ink} />
              </Pressable>
              <Pressable
                onPress={() => setKpiPeriod(currentMonthKey)}
                style={styles.monthLabelBox}
              >
                <Text style={styles.monthLabelText}>{formatPeriodLabel(kpiPeriod)}</Text>
              </Pressable>
              <Pressable
                disabled={kpiPeriod >= currentMonthKey}
                onPress={() => setKpiPeriod((p) => shiftMonth(p, 1))}
                style={[styles.monthBtn, kpiPeriod >= currentMonthKey && styles.disabled]}
              >
                <ChevronRight size={16} color={colors.ink} />
              </Pressable>
            </View>
          </Card>

          {kpiLoading ? (
            <Card style={styles.stateCard}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.muted}>Đang tải KPI tháng...</Text>
            </Card>
          ) : kpiError ? (
            <Card style={styles.stateCard}>
              <PopupError error={kpiError} />
              <Pressable onPress={() => void loadKpi()} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>Thử lại</Text>
              </Pressable>
            </Card>
          ) : !kpiReport?.rows.length ? (
            <Card style={styles.stateCard}>
              <Text style={styles.muted}>Chưa có dữ liệu KPI nhân viên trong tháng này.</Text>
            </Card>
          ) : (
            (() => {
              const q = search.trim().toLowerCase();
              const visibleRows = q
                ? kpiReport.rows.filter((r) => r.employeeName.toLowerCase().includes(q))
                : kpiReport.rows;
              const totalAll = visibleRows.reduce((s, r) => s + r.totalTasks, 0);
              const doneAll = visibleRows.reduce((s, r) => s + r.completedTasks, 0);
              const pendingAll = visibleRows.reduce((s, r) => s + r.pendingTasks, 0);
              const avgPct = totalAll > 0 ? Math.round((doneAll / totalAll) * 100) : 0;

              return (
                <>
                  <View style={styles.kpiSummaryRow}>
                    <Card style={styles.kpiSummaryBox}>
                      <Text style={styles.kpiSummaryVal}>{totalAll}</Text>
                      <Text style={styles.groupSub}>Tổng việc</Text>
                    </Card>
                    <Card style={styles.kpiSummaryBox}>
                      <Text style={[styles.kpiSummaryVal, { color: '#16885A' }]}>{doneAll}</Text>
                      <Text style={styles.groupSub}>Đạt KPI</Text>
                    </Card>
                    <Card style={styles.kpiSummaryBox}>
                      <Text style={[styles.kpiSummaryVal, { color: '#C27617' }]}>{pendingAll}</Text>
                      <Text style={styles.groupSub}>Chưa đạt</Text>
                    </Card>
                    <Card style={styles.kpiSummaryBox}>
                      <Text style={[styles.kpiSummaryVal, { color: colors.primary }]}>{avgPct}%</Text>
                      <Text style={styles.groupSub}>Tỷ lệ chung</Text>
                    </Card>
                  </View>

                  <View style={styles.groupsWrap}>
                    {visibleRows.map((row) => {
                      const pct = row.percent;
                      const pctColor =
                        pct == null
                          ? colors.muted
                          : pct >= 80
                            ? '#16885A'
                            : pct >= 50
                              ? colors.primary
                              : '#C27617';
                      return (
                        <Card key={row.employeeId} style={styles.kpiRowCard}>
                          <View style={styles.taskRowTop}>
                            <Text numberOfLines={1} style={styles.groupTitle}>
                              {row.employeeName}
                            </Text>
                            <Text style={[styles.kpiPctText, { color: pctColor }]}>
                              {pct == null ? 'Chưa có việc' : `${pct}%`}
                            </Text>
                          </View>
                          <View style={styles.progressTrack}>
                            <View
                              style={[
                                styles.progressFill,
                                {
                                  width: `${Math.min(100, Math.max(0, pct ?? 0))}%`,
                                  backgroundColor: pctColor,
                                },
                              ]}
                            />
                          </View>
                          <View style={styles.kpiRowMetrics}>
                            <Text style={[styles.kpiMetricText, { color: '#16885A' }]}>
                              Đạt KPI: {row.completedTasks}
                            </Text>
                            <Text style={styles.kpiMetricText}>Tổng: {row.totalTasks}</Text>
                            <Text style={[styles.kpiMetricText, { color: '#C27617' }]}>
                              Chưa đạt: {row.pendingTasks}
                            </Text>
                          </View>
                        </Card>
                      );
                    })}
                  </View>
                </>
              );
            })()
          )}
        </View>
      ) : (
        <>
          {/* Status Filter Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
            style={styles.chipScroll}
          >
            <Pressable
              onPress={() => setStatusFilter('all')}
              style={[styles.chip, statusFilter === 'all' && styles.chipActive]}
            >
              <Text style={[styles.chipText, statusFilter === 'all' && styles.chipTextActive]}>
                Mọi trạng thái
              </Text>
            </Pressable>
            {STATUS_META.map((st) => {
              const active = statusFilter === st.key;
              return (
                <Pressable
                  key={st.key}
                  onPress={() => setStatusFilter(st.key)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{st.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

      {loading ? (
        <Card style={styles.stateCard}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.muted}>Đang tải dự án & công việc...</Text>
        </Card>
      ) : error ? (
        <Card style={styles.stateCard}>
          <PopupError error={error} />
          <Pressable onPress={() => void loadData()} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Thử lại</Text>
          </Pressable>
        </Card>
      ) : (
        <View style={styles.groupsWrap}>
          {/* 1. Các nhóm theo Dự án */}
          {scopeFilter !== 'no_project'
            ? projectGroups.map(({ project, tasks: projTasks, totalCount, doneCount, progress }) => {
                const collapsed = collapsedGroups.has(project.id);
                return (
                  <View key={project.id} style={styles.groupCard}>
                    <Pressable
                      onPress={() => toggleGroup(project.id)}
                      style={styles.groupHeader}
                    >
                      <View style={styles.folderIcon}>
                        <Folder size={16} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={styles.groupTitle}>
                          {project.name}
                        </Text>
                        <Text style={styles.groupSub}>
                          {doneCount}/{totalCount} hoàn thành ({progress}%)
                          {project.dueAt ? ` · Hạn ${project.dueAt.slice(0, 10)}` : ''}
                        </Text>
                        <View style={styles.progressTrack}>
                          <View style={[styles.progressFill, { width: `${progress}%` }]} />
                        </View>
                      </View>
                      <View style={styles.groupHeaderRight}>
                        {canManageTasks ? <Pressable
                          hitSlop={6}
                          onPress={() => openCreateTask(project.id)}
                          style={styles.tinyAddBtn}
                        >
                          <View style={styles.iconButtonContent}><Plus size={11} color={colors.primary} /><Text style={styles.tinyAddText}>Việc</Text></View>
                        </Pressable> : null}
                        {canManageTasks ? (
                          <Pressable
                            hitSlop={6}
                            onPress={() => openEditProject(project)}
                            style={styles.tinyIconBtn}
                          >
                            <Pencil size={13} color={colors.muted} />
                          </Pressable>
                        ) : null}
                        {collapsed ? <ChevronDown size={15} color={colors.muted} /> : <ChevronUp size={15} color={colors.muted} />}
                      </View>
                    </Pressable>

                    {!collapsed ? (
                      <View style={styles.groupBody}>
                        {projTasks.length > 0 ? (
                          projTasks.map(renderTaskRow)
                        ) : (
                          <Text style={styles.emptyGroupText}>
                            Chưa có công việc nào trong dự án này.
                          </Text>
                        )}
                      </View>
                    ) : null}
                  </View>
                );
              })
            : null}

          {/* 2. Nhóm Công việc không thuộc dự án */}
          {scopeFilter !== 'with_project' ? (
            <View style={styles.groupCard}>
              <Pressable
                onPress={() => toggleGroup('__UNASSIGNED__')}
                style={styles.groupHeader}
              >
                <View style={[styles.folderIcon, { backgroundColor: '#F1F5F9' }]}>
                  <FolderOpen size={16} color={colors.muted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.groupTitle}>{canReadWork ? 'Công việc không thuộc dự án' : 'Việc của tôi'}</Text>
                  <Text style={styles.groupSub}>
                    {unassignedTasks.length} {canReadWork ? 'công việc độc lập' : 'công việc'}
                  </Text>
                </View>
                <View style={styles.groupHeaderRight}>
                  {canManageTasks ? <Pressable
                    hitSlop={6}
                    onPress={() => openCreateTask('')}
                    style={styles.tinyAddBtn}
                  >
                    <View style={styles.iconButtonContent}><Plus size={11} color={colors.primary} /><Text style={styles.tinyAddText}>Việc</Text></View>
                  </Pressable> : null}
                  {collapsedGroups.has('__UNASSIGNED__') ? <ChevronDown size={15} color={colors.muted} /> : <ChevronUp size={15} color={colors.muted} />}
                </View>
              </Pressable>

              {!collapsedGroups.has('__UNASSIGNED__') ? (
                <View style={styles.groupBody}>
                  {unassignedTasks.length > 0 ? (
                    unassignedTasks.map(renderTaskRow)
                  ) : (
                    <Text style={styles.emptyGroupText}>
                      Không có công việc độc lập nào.
                    </Text>
                  )}
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      )}
        </>
      )}

      {/* Create / Edit Task Full-Screen Page */}
      <FullScreenFormModal
        visible={taskModalOpen}
        title={editingTask ? 'Chi tiết & sửa công việc' : 'Giao việc mới'}
        cancelLabel="Hủy"
        onSave={() => void onSaveTask()}
        saving={savingTask || uploadingTaskAttachment || recordingTaskAudio}
        onClose={() => {
          if (!savingTask && !uploadingTaskAttachment && !recordingTaskAudio) setTaskModalOpen(false);
        }}
      >
        <View style={styles.form}>
          <Text style={styles.label}>Tên công việc *</Text>
          <TextInput
            value={taskTitle}
            onChangeText={setTaskTitle}
            placeholder="Nhập tiêu đề công việc..."
            placeholderTextColor={colors.muted}
            style={styles.field}
          />

          <Text style={styles.label}>Thuộc dự án</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, marginBottom: 4 }}
          >
            <Pressable
              onPress={() => setTaskProjectId('')}
              style={[styles.chip, !taskProjectId && styles.chipActive]}
            >
              <Text style={[styles.chipText, !taskProjectId && styles.chipTextActive]}>
                Không thuộc dự án
              </Text>
            </Pressable>
            {projects.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => setTaskProjectId(p.id)}
                style={[styles.chip, taskProjectId === p.id && styles.chipActive]}
              >
                <Text style={[styles.chipText, taskProjectId === p.id && styles.chipTextActive]}>
                  {p.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.label}>Trạng thái</Text>
          <View style={styles.wrapRow}>
            {STATUS_META.map((st) => (
              <Pressable
                key={st.key}
                onPress={() => setTaskStatus(st.key)}
                style={[styles.chip, taskStatus === st.key && styles.chipActive]}
              >
                <Text style={[styles.chipText, taskStatus === st.key && styles.chipTextActive]}>
                  {st.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Độ ưu tiên</Text>
          <View style={styles.wrapRow}>
            {PRIORITY_OPTIONS.map((p) => (
              <Pressable
                key={p.key}
                onPress={() => setTaskPriority(p.key)}
                style={[styles.chip, taskPriority === p.key && styles.chipActive]}
              >
                <Text style={[styles.chipText, taskPriority === p.key && styles.chipTextActive]}>
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Người thực hiện</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, marginBottom: 4 }}
          >
            {employees.slice(0, 25).map((emp) => {
              const uid = emp.uid || emp._id || emp.id || '';
              const active = taskAssigneeUid === uid;
              return (
                <Pressable
                  key={uid}
                  onPress={() => setTaskAssigneeUid(uid)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {emp.displayName}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.label}>Phân loại</Text>
          <View style={styles.wrapRow}>
            {TASK_CATEGORIES.map((cat) => (
              <Pressable
                key={cat}
                onPress={() => setTaskCategory(cat)}
                style={[styles.chip, taskCategory === cat && styles.chipActive]}
              >
                <Text style={[styles.chipText, taskCategory === cat && styles.chipTextActive]}>
                  {cat}
                </Text>
              </Pressable>
            ))}
          </View>

          {taskCategory === 'Bán hàng' ? (
            <>
              <Text style={styles.label}>Chỉ tiêu doanh số KPI (VNĐ)</Text>
              <TextInput
                value={taskSalesKpiTarget}
                onChangeText={setTaskSalesKpiTarget}
                keyboardType="numeric"
                placeholder="VD: 50000000"
                placeholderTextColor={colors.muted}
                style={styles.field}
              />
            </>
          ) : null}

          <Text style={styles.label}>Hạn chót *</Text>
          <Pressable style={styles.dateTimeField} onPress={() => openDatePicker('taskDue')}>
            <CalendarDays size={16} color={colors.primary} />
            <Text numberOfLines={1} style={taskDueDate ? styles.dateTimeValue : styles.dateTimePlaceholder}>
              {taskDueDate ? formatTaskDateTime(taskDueDate) : 'Chọn ngày và giờ'}
            </Text>
            <ChevronRight size={16} color={colors.muted} />
          </Pressable>

          <Text style={styles.label}>Thời gian bắt đầu</Text>
          <View style={styles.dateTimeInputRow}>
            <Pressable style={[styles.dateTimeField, { flex: 1 }]} onPress={() => openDatePicker('taskStart')}>
              <Clock3 size={16} color={colors.primary} />
              <Text numberOfLines={1} style={taskStartTime ? styles.dateTimeValue : styles.dateTimePlaceholder}>
                {taskStartTime ? formatTaskDateTime(taskStartTime) : 'Chọn ngày và giờ'}
              </Text>
              <ChevronRight size={16} color={colors.muted} />
            </Pressable>
            {taskStartTime ? (
              <Pressable onPress={() => setTaskStartTime('')} hitSlop={8} style={styles.dateTimeClear} accessibilityLabel="Xóa thời gian bắt đầu">
                <X size={15} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>

          <Text style={styles.label}>Giờ dự tính</Text>
          <TextInput
            value={taskEstTime}
            onChangeText={setTaskEstTime}
            keyboardType="numeric"
            placeholder="VD: 4"
            placeholderTextColor={colors.muted}
            style={styles.field}
          />

          <Text style={styles.label}>Link / Ghi chú</Text>
          <TextInput
            value={taskLinkNote}
            onChangeText={setTaskLinkNote}
            placeholder="Link tài liệu hoặc ghi chú..."
            placeholderTextColor={colors.muted}
            style={styles.field}
          />

          <Text style={styles.label}>Tệp đính kèm</Text>
          {taskAttachments.map((attachment) => (
            <View key={attachment.id} style={styles.attachmentRow}>
              {attachment.type === 'audio' ? <Mic size={15} color="#7754C8" /> : null}
              {attachment.type === 'video' ? <Video size={15} color="#B42318" /> : null}
              {attachment.type === 'link' ? <Link2 size={15} color={colors.primary} /> : null}
              {attachment.type === 'file' || attachment.type === 'image' ? <FileText size={15} color={colors.primary} /> : null}
              <Pressable
                style={styles.attachmentNameButton}
                onPress={() => void Linking.openURL(attachment.url).catch(() => Alert.alert('Không mở được tệp', 'Hãy thử lại sau.'))}
              >
                <Text numberOfLines={1} style={styles.attachmentName}>{attachment.name}</Text>
                <Text style={styles.attachmentMeta}>
                  {attachment.type.toUpperCase()}{attachment.size ? ` · ${(attachment.size / (1024 * 1024)).toFixed(1)} MB` : ''}
                </Text>
              </Pressable>
              <Pressable
                accessibilityLabel={`Gỡ ${attachment.name}`}
                hitSlop={8}
                onPress={() => setTaskAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                style={styles.attachmentRemove}
              >
                <X size={15} color="#B42318" />
              </Pressable>
            </View>
          ))}
          <View style={styles.attachmentActions}>
            <Pressable
              onPress={() => void pickTaskAttachments()}
              disabled={uploadingTaskAttachment || recordingTaskAudio}
              style={[styles.attachmentAction, (uploadingTaskAttachment || recordingTaskAudio) && styles.disabled]}
            >
              <Paperclip size={14} color={colors.primary} />
              <Text style={styles.attachmentActionText}>Chọn tệp</Text>
            </Pressable>
            <Pressable
              onPress={() => void (recordingTaskAudio ? stopTaskAudioRecording() : recordTaskAudio())}
              disabled={uploadingTaskAttachment}
              style={[styles.attachmentAction, recordingTaskAudio && styles.recordingAction, uploadingTaskAttachment && styles.disabled]}
            >
              {recordingTaskAudio ? <Square size={13} color="#B42318" /> : <Mic size={14} color={colors.primary} />}
              <Text style={[styles.attachmentActionText, recordingTaskAudio && styles.recordingActionText]}>
                {recordingTaskAudio ? 'Dừng ghi âm' : 'Ghi âm'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void recordTaskVideo()}
              disabled={uploadingTaskAttachment || recordingTaskAudio}
              style={[styles.attachmentAction, (uploadingTaskAttachment || recordingTaskAudio) && styles.disabled]}
            >
              <Video size={14} color={colors.primary} />
              <Text style={styles.attachmentActionText}>Ghi hình</Text>
            </Pressable>
          </View>
          <View style={styles.attachmentLinkRow}>
            <TextInput
              value={taskAttachmentLinkDraft}
              onChangeText={setTaskAttachmentLinkDraft}
              autoCapitalize="none"
              keyboardType="url"
              placeholder="Link tài liệu (https://...)"
              placeholderTextColor={colors.muted}
              style={[styles.field, styles.attachmentLinkInput]}
            />
            <Pressable
              onPress={addTaskAttachmentLink}
              disabled={uploadingTaskAttachment || recordingTaskAudio}
              style={[styles.addAttachmentLink, (uploadingTaskAttachment || recordingTaskAudio) && styles.disabled]}
            >
              <Link2 size={14} color={colors.white} />
              <Text style={styles.addAttachmentLinkText}>Thêm</Text>
            </Pressable>
          </View>
          {uploadingTaskAttachment ? (
            <View style={styles.attachmentUploading}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.attachmentMeta}>Đang tải tệp lên...</Text>
            </View>
          ) : null}

          <Pressable
            disabled={savingTask || uploadingTaskAttachment || recordingTaskAudio}
            onPress={() => void onSaveTask()}
            style={[styles.submitBtn, (savingTask || uploadingTaskAttachment || recordingTaskAudio) && styles.disabled]}
          >
            <Text style={styles.submitBtnText}>
              {savingTask ? 'Đang lưu...' : editingTask ? 'Lưu thay đổi' : 'Tạo công việc'}
            </Text>
          </Pressable>

          {editingTask && canManageTasks ? (
            <Pressable
              onPress={() => onDeleteTask(editingTask)}
              style={styles.deleteBtn}
            >
              <Text style={styles.deleteBtnText}>Xóa công việc</Text>
            </Pressable>
          ) : null}
        </View>
      </FullScreenFormModal>

      {/* Báo cáo tiến độ / yêu cầu trợ giúp */}
      <FullScreenFormModal
        visible={activityMode !== null}
        title={activityMode === 'progress' ? 'Báo cáo tiến độ công việc' : 'Yêu cầu trợ giúp công việc'}
        cancelLabel="Hủy"
        onSave={() => void saveTaskActivity()}
        saving={savingActivity}
        onClose={() => { if (!savingActivity) { setActivityMode(null); setActivityTask(null); } }}
      >
        <View style={styles.form}>
          {activityTask ? <Text numberOfLines={2} style={styles.activityTaskTitle}>{activityTask.title}</Text> : null}
          {activityMode === 'progress' ? (
            <>
              <View style={styles.progressEditorSummary}>
                <Text style={styles.label}>Tiến độ hoàn thành</Text>
                <Text style={styles.progressEditorPercent}>{activityProgress}%</Text>
              </View>
              <TextInput
                value={String(activityProgress)}
                onChangeText={(value) => {
                  const digits = value.replace(/[^0-9]/g, '').slice(0, 3);
                  if (!digits) { setActivityProgress(0); return; }
                  setActivityProgress(Math.min(100, Number(digits)));
                }}
                keyboardType="number-pad"
                maxLength={3}
                selectTextOnFocus
                accessibilityLabel="Tiến độ phần trăm"
                style={styles.progressPercentInput}
              />
              <View style={styles.wrapRow}>
                {[0, 25, 50, 75, 100].map((value) => (
                  <Pressable
                    key={value}
                    onPress={() => setActivityProgress(value)}
                    style={[styles.chip, activityProgress === value && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, activityProgress === value && styles.chipTextActive]}>{value}%</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.label}>Nội dung báo cáo *</Text>
              <TextInput
                value={activityNote}
                onChangeText={setActivityNote}
                multiline
                maxLength={2000}
                placeholder="Mô tả kết quả đã hoàn thành hoặc vướng mắc..."
                placeholderTextColor={colors.muted}
                style={[styles.field, styles.activityNoteField]}
              />
            </>
          ) : (
            <>
              <Text style={styles.label}>Chọn người hỗ trợ</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
                <Pressable
                  onPress={() => setActivityHelperUid('')}
                  style={[styles.chip, !activityHelperUid && styles.chipActive]}
                >
                  <Text style={[styles.chipText, !activityHelperUid && styles.chipTextActive]}>Cả nhóm</Text>
                </Pressable>
                {employees
                  .filter((employee) => {
                    const uid = employee.id || employee._id || employee.uid || '';
                    return uid && uid !== currentUid && uid !== activityTask?.assigneeUid;
                  })
                  .map((employee) => {
                    const uid = employee.id || employee._id || employee.uid || '';
                    const selected = activityHelperUid === uid;
                    return (
                      <Pressable
                        key={uid}
                        onPress={() => setActivityHelperUid(uid)}
                        style={[styles.chip, selected && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, selected && styles.chipTextActive]}>{employee.displayName}</Text>
                      </Pressable>
                    );
                  })}
              </ScrollView>
              <Text style={styles.helpHint}>Để cả nhóm nhận thông báo hoặc chọn một người hỗ trợ cụ thể.</Text>
              <Text style={styles.label}>Nguyên nhân cần trợ giúp *</Text>
              <TextInput
                value={activityNote}
                onChangeText={setActivityNote}
                multiline
                maxLength={2000}
                placeholder="Mô tả vướng mắc hoặc hỗ trợ bạn cần..."
                placeholderTextColor={colors.muted}
                style={[styles.field, styles.activityNoteField]}
              />
            </>
          )}
          <Text style={styles.activityCharCount}>{activityNote.length}/2000 ký tự</Text>
          <Pressable
            onPress={() => void saveTaskActivity()}
            disabled={savingActivity || !activityNote.trim()}
            style={[styles.submitBtn, (savingActivity || !activityNote.trim()) && styles.disabled]}
          >
            <Text style={styles.submitBtnText}>
              {savingActivity ? 'Đang lưu...' : activityMode === 'progress' ? 'Lưu báo cáo tiến độ' : 'Gửi yêu cầu trợ giúp'}
            </Text>
          </Pressable>
        </View>
      </FullScreenFormModal>

      {/* Create / Edit Project Full-Screen Page */}
      <FullScreenFormModal
        visible={projectModalOpen}
        title={editingProject ? 'Chỉnh sửa dự án' : 'Tạo dự án mới'}
        cancelLabel="Hủy"
        onSave={() => void onSaveProject()}
        saving={savingProj}
        onClose={() => setProjectModalOpen(false)}
      >
        <View style={styles.form}>
          <Text style={styles.label}>Tên dự án *</Text>
          <TextInput
            value={projName}
            onChangeText={setProjName}
            placeholder="VD: Triển khai ERP Q4"
            placeholderTextColor={colors.muted}
            style={styles.field}
          />

          <Text style={styles.label}>Độ ưu tiên</Text>
          <View style={styles.wrapRow}>
            {(['high', 'medium', 'low'] as const).map((p) => (
              <Pressable
                key={p}
                onPress={() => setProjPriority(p)}
                style={[styles.chip, projPriority === p && styles.chipActive]}
              >
                <Text style={[styles.chipText, projPriority === p && styles.chipTextActive]}>
                  {p === 'high' ? 'Cao' : p === 'low' ? 'Thấp' : 'Trung bình'}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Hạn hoàn thành</Text>
          <View style={styles.dateTimeInputRow}>
            <Pressable style={[styles.dateTimeField, { flex: 1 }]} onPress={() => openDatePicker('projectDue')}>
              <CalendarDays size={16} color={colors.primary} />
              <Text numberOfLines={1} style={projDueAt ? styles.dateTimeValue : styles.dateTimePlaceholder}>
                {projDueAt ? formatProjectDate(projDueAt) : 'Chọn ngày'}
              </Text>
              <ChevronRight size={16} color={colors.muted} />
            </Pressable>
            {projDueAt ? (
              <Pressable onPress={() => setProjDueAt('')} hitSlop={8} style={styles.dateTimeClear} accessibilityLabel="Xóa hạn hoàn thành">
                <X size={15} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>

          <Pressable
            disabled={savingProj}
            onPress={() => void onSaveProject()}
            style={[styles.submitBtn, savingProj && styles.disabled]}
          >
            <Text style={styles.submitBtnText}>
              {savingProj ? 'Đang lưu...' : editingProject ? 'Cập nhật dự án' : 'Tạo dự án'}
            </Text>
          </Pressable>

          {editingProject && canManageTasks ? (
            <Pressable
              onPress={() => onDeleteProject(editingProject)}
              style={styles.deleteBtn}
            >
              <Text style={styles.deleteBtnText}>Xóa dự án</Text>
            </Pressable>
          ) : null}
        </View>
      </FullScreenFormModal>

      {Platform.OS === 'ios' && activeDatePicker ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setActiveDatePicker(null)}
        >
          <Pressable style={styles.pickerBackdrop} onPress={() => setActiveDatePicker(null)}>
            <Pressable style={styles.pickerSheet} onPress={() => {}}>
              <Text style={styles.pickerTitle}>
                {activeDatePicker.target === 'taskDue'
                  ? 'Chọn hạn chót'
                  : activeDatePicker.target === 'taskStart'
                    ? 'Chọn thời gian bắt đầu'
                    : 'Chọn hạn hoàn thành'}
              </Text>
              <DateTimePicker
                value={activeDatePicker.value}
                mode={activeDatePicker.target === 'projectDue' ? 'date' : 'datetime'}
                display="spinner"
                locale="vi-VN"
                is24Hour
                timeZoneName="Asia/Bangkok"
                onChange={(_event, selectedDate) => {
                  if (selectedDate) {
                    setActiveDatePicker((current) => current ? { ...current, value: selectedDate } : current);
                  }
                }}
              />
              <View style={styles.pickerActions}>
                <Pressable onPress={() => setActiveDatePicker(null)} style={styles.pickerCancelBtn}>
                  <Text style={styles.pickerCancelText}>Hủy</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    applyPickedDate(activeDatePicker.target, activeDatePicker.value);
                    setActiveDatePicker(null);
                  }}
                  style={styles.pickerConfirmBtn}
                >
                  <Text style={styles.pickerConfirmText}>Xác nhận</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingBottom: 28 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  search: {
    flex: 1,
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 12,
    color: colors.ink,
  },
  primaryBtn: { backgroundColor: colors.primary, paddingHorizontal: 11, paddingVertical: 9, borderRadius: 10 },
  primaryBtnText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  iconButtonContent: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  secondaryActionBtn: { backgroundColor: '#EAF2FF', borderColor: '#D6E5FF', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 10 },
  secondaryActionText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  scopeBar: { flexDirection: 'row', backgroundColor: '#EAF0F8', borderRadius: 11, padding: 3, gap: 3, marginBottom: 10 },
  scopeBtn: { flex: 1, paddingVertical: 7, borderRadius: 9, alignItems: 'center' },
  scopeBtnActive: { backgroundColor: colors.white },
  scopeText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  scopeTextActive: { color: colors.primary },
  chipScroll: { marginHorizontal: -18, marginBottom: 12 },
  chipRow: { paddingHorizontal: 18, gap: 6 },
  chip: { backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  chipTextActive: { color: colors.white },
  stateCard: { padding: 20, alignItems: 'center', gap: 10 },
  muted: { color: colors.muted, fontSize: 11 },
  errorText: { color: '#B91C1C', fontSize: 12, textAlign: 'center' },
  groupsWrap: { gap: 12 },
  groupCard: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
    backgroundColor: '#FAFBFD',
  },
  folderIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#EAF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  groupSub: { color: colors.muted, fontSize: 10, marginTop: 2 },
  progressTrack: { height: 5, borderRadius: 99, backgroundColor: '#E5ECF5', marginTop: 6, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#16885A', borderRadius: 99 },
  groupHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tinyAddBtn: { backgroundColor: '#EAF2FF', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  tinyAddText: { color: colors.primary, fontSize: 10, fontWeight: '800' },
  tinyIconBtn: { width: 26, height: 26, borderRadius: 8, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  tinyIconText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  caret: { color: colors.muted, fontSize: 14, fontWeight: '800', paddingHorizontal: 2 },
  groupBody: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  emptyGroupText: { color: colors.muted, fontSize: 11, textAlign: 'center', paddingVertical: 14 },
  taskRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 6,
  },
  taskRowTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  taskTitle: { color: colors.ink, fontSize: 12, fontWeight: '700', flex: 1, lineHeight: 17 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99 },
  statusBadgeText: { fontSize: 9, fontWeight: '800' },
  taskRowMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  taskMetaGroup: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  taskMetaText: { color: colors.muted, fontSize: 10, flex: 1 },
  priorityTag: { fontSize: 9, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99, overflow: 'hidden' },
  taskProgressSummary: { gap: 2, marginTop: 1 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  taskProgressLabel: { color: colors.muted, fontSize: 9, fontWeight: '700' },
  taskProgressPercent: { color: colors.primary, fontSize: 10, fontWeight: '800' },
  progressNote: { color: colors.muted, fontSize: 9, lineHeight: 13, marginTop: 2 },
  helpNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, padding: 9, borderRadius: 10, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FFF1F0' },
  helpNoticeTitle: { color: '#B42318', fontSize: 10, fontWeight: '800' },
  helpNoticeText: { color: '#7F1D1D', fontSize: 10, lineHeight: 14, marginTop: 2 },
  helpersLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  taskActivityActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  taskActivityBtn: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, borderRadius: 9, backgroundColor: '#EAF2FF' },
  taskActivityBtnText: { color: colors.primary, fontSize: 9, fontWeight: '800' },
  taskHelpBtn: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, borderRadius: 9, backgroundColor: '#FFF1F0' },
  taskHelpBtnText: { color: '#B42318', fontSize: 9, fontWeight: '800' },
  taskResolveBtn: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, borderRadius: 9, backgroundColor: '#E9F8F1' },
  taskResolveBtnText: { color: '#16885A', fontSize: 9, fontWeight: '800' },
  taskJoinBtn: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, borderRadius: 9, backgroundColor: '#B42318' },
  taskJoinBtnText: { color: colors.white, fontSize: 9, fontWeight: '800' },
  kpiTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 2 },
  kpiTagBox: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  kpiTag: { fontSize: 9, fontWeight: '800' },
  kpiTagOk: { backgroundColor: '#DCFCE7' },
  kpiTagOkText: { color: '#15803D' },
  kpiTagLate: { backgroundColor: '#FEE2E2' },
  kpiTagLateText: { color: '#B91C1C' },
  kpiTagInfo: { backgroundColor: '#EAF2FF' },
  kpiTagInfoText: { color: colors.primary },

  // Monthly KPI
  kpiWrap: { gap: 10 },
  kpiBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, gap: 10 },
  monthNav: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  monthBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#F1F5FB', alignItems: 'center', justifyContent: 'center' },
  monthBtnText: { color: colors.ink, fontSize: 16, fontWeight: '800', lineHeight: 18 },
  monthLabelBox: { paddingHorizontal: 9, height: 28, borderRadius: 8, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' },
  monthLabelText: { color: colors.primary, fontSize: 10, fontWeight: '800' },
  kpiSummaryRow: { flexDirection: 'row', gap: 7 },
  kpiSummaryBox: { flex: 1, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center' },
  kpiSummaryVal: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  kpiRowCard: { padding: 12, gap: 6 },
  kpiPctText: { fontSize: 13, fontWeight: '800' },
  kpiRowMetrics: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  kpiMetricText: { color: colors.muted, fontSize: 10, fontWeight: '700' },

  // Modals
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.42)', justifyContent: 'center', padding: 16 },
  sheet: { backgroundColor: colors.white, borderRadius: 24, overflow: 'hidden', padding: 18, maxHeight: '86%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  activityModalHeading: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  activityTaskTitle: { color: colors.muted, fontSize: 11, marginBottom: 6 },
  progressEditorSummary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressEditorPercent: { color: colors.primary, fontSize: 22, fontWeight: '800' },
  progressPercentInput: { minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 11, backgroundColor: colors.background, textAlign: 'center', color: colors.ink, fontSize: 18, fontWeight: '800', paddingVertical: 6 },
  activityNoteField: { minHeight: 92, textAlignVertical: 'top' },
  activityCharCount: { color: colors.muted, textAlign: 'right', fontSize: 9 },
  helpHint: { color: colors.muted, fontSize: 10, lineHeight: 14 },
  sheetTitle: { color: colors.ink, fontSize: 16, fontWeight: '800', flex: 1 },
  closeText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  form: { gap: 8, paddingBottom: 10 },
  label: { color: colors.ink, fontSize: 11, fontWeight: '700', marginTop: 4 },
  field: { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 9, fontSize: 12, color: colors.ink },
  attachmentRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 9, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: '#FAFBFD' },
  attachmentNameButton: { flex: 1, minWidth: 0 },
  attachmentName: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  attachmentMeta: { color: colors.muted, fontSize: 9, marginTop: 2 },
  attachmentRemove: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF1F0' },
  attachmentActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  attachmentAction: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, borderWidth: 1, borderColor: colors.border, borderRadius: 9, backgroundColor: colors.white },
  attachmentActionText: { color: colors.primary, fontSize: 10, fontWeight: '700' },
  recordingAction: { backgroundColor: '#FFF1F0', borderColor: '#FECACA' },
  recordingActionText: { color: '#B42318' },
  attachmentLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  attachmentLinkInput: { flex: 1 },
  addAttachmentLink: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, borderRadius: 9, backgroundColor: colors.primary },
  addAttachmentLinkText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  attachmentUploading: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateTimeField: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, borderRadius: 11, paddingHorizontal: 11, paddingVertical: 8 },
  dateTimeInputRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dateTimeClear: { width: 30, height: 38, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  dateTimeValue: { flex: 1, color: colors.ink, fontSize: 12 },
  dateTimePlaceholder: { flex: 1, color: colors.muted, fontSize: 12 },
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.48)', justifyContent: 'center', padding: 20 },
  pickerSheet: { backgroundColor: colors.white, borderRadius: 22, overflow: 'hidden', padding: 16 },
  pickerTitle: { color: colors.ink, fontSize: 15, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  pickerActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  pickerCancelBtn: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 11, backgroundColor: '#F1F5F9' },
  pickerCancelText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  pickerConfirmBtn: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 11, backgroundColor: colors.primary },
  pickerConfirmText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  submitBtn: { backgroundColor: colors.primary, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  submitBtnText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  deleteBtn: { backgroundColor: '#FCEBEC', minHeight: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  deleteBtnText: { color: '#C74848', fontSize: 12, fontWeight: '700' },
  disabled: { opacity: 0.45 },
});

