import { PopupError } from '@/components/PopupError';
import { FullScreenFormModal } from '@/components/FullScreenFormModal';
import {
  HrFormCustomRow,
  HrFormInputRow,
  HrFormSectionTitle,
  HrFormSelectRow,
} from '@/features/hr/components/HrFormFields';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import Svg, { Circle, Path } from 'react-native-svg';
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
  Trash2,
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
import { IgenHrEmptyState } from '@/components/EmptyStateIllustration';
import { showHrConfirm } from '@/features/hr/components/HrConfirmModal';
import { HrFab } from '@/features/hr/components/HrFab';
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

function formatDateDDMMYYYY(value?: string): string {
  const key = String(value || '').slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  const date = parseVietnamTaskInstant(value);
  if (!date) return '';
  const vnKey = getVietnamDateKey(date);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(vnKey);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : vnKey;
}

function formatTaskDateTime(value?: string): string {
  const date = parseVietnamTaskInstant(value);
  if (!date) return '';
  const local = getVietnamLocalDateTime(date);
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})$/.exec(local);
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}` : formatDateDDMMYYYY(value);
}

function normalizeTaskDateTime(value?: string): string {
  const date = parseVietnamTaskInstant(value);
  return date ? getVietnamLocalDateTime(date) : '';
}

function formatProjectDate(value?: string): string {
  return formatDateDDMMYYYY(value);
}

function progressColor(percent: number): string {
  if (percent > 80) return '#16A34A';
  if (percent >= 50) return colors.primary;
  return '#DC2626';
}

function getInitials(name?: string): string {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function AddTaskIcon({ size = 18, color = colors.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 4.5H7.2C5.98 4.5 5 5.48 5 6.7V18.3C5 19.52 5.98 20.5 7.2 20.5H12.5"
        stroke={color}
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M15 4.5H16.8C18.02 4.5 19 5.48 19 6.7V11.5"
        stroke={color}
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9.5 3.25H14.5C15.05 3.25 15.5 3.7 15.5 4.25V5.75C15.5 6.3 15.05 6.75 14.5 6.75H9.5C8.95 6.75 8.5 6.3 8.5 5.75V4.25C8.5 3.7 8.95 3.25 9.5 3.25Z"
        stroke={color}
        strokeWidth="1.6"
      />
      <Path
        d="M8.5 11H14.5M8.5 14.75H12"
        stroke={color}
        strokeWidth="1.65"
        strokeLinecap="round"
      />
      <Path
        d="M17.5 14.25V20.25M14.5 17.25H20.5"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function TaskItemIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6.2 3.75H14.4L18.5 7.85V18.1C18.5 19.3 17.55 20.25 16.35 20.25H6.2C5 20.25 4.05 19.3 4.05 18.1V5.9C4.05 4.7 5 3.75 6.2 3.75Z"
        fill="#DBEAFE"
        stroke="#1E7CE8"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M14.2 3.75V8.05H18.5"
        fill="#FFFFFF"
        stroke="#1E7CE8"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M7.6 11.5H13.6M7.6 15.2H11.4"
        stroke="#1E7CE8"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <Circle cx="17.2" cy="17" r="4.3" fill="#FFFFFF" stroke="#1E7CE8" strokeWidth="1.5" />
      <Path
        d="M15.4 17.05L16.65 18.3L19.1 15.85"
        stroke="#1E7CE8"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ReportProgressIcon({ size = 18, color = '#1E7CE8' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4.5 19.5H19.5"
        stroke={color}
        strokeWidth="1.65"
        strokeLinecap="round"
      />
      <Path
        d="M7 16V12.5M12 16V9.5M17 16V6.5"
        stroke={color}
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <Path
        d="M14.5 6.5H17V9"
        stroke={color}
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function RequestHelpIcon({ size = 18, color = '#C74848' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="8.25" stroke={color} strokeWidth="1.65" />
      <Circle cx="12" cy="12" r="3.6" stroke={color} strokeWidth="1.6" />
      <Path
        d="M6.2 6.2L9.4 9.4M14.6 14.6L17.8 17.8M17.8 6.2L14.6 9.4M9.4 14.6L6.2 17.8"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function ResolveHelpIcon({ size = 18, color = '#16A34A' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="8.25" stroke={color} strokeWidth="1.65" />
      <Path
        d="M8.5 12.2L10.9 14.6L15.7 9.6"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function JoinHelpIcon({ size = 18, color = '#1E7CE8' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="9.5" cy="8" r="3.25" stroke={color} strokeWidth="1.65" />
      <Path
        d="M3.75 18.75C4.5 15.6 6.75 14 9.5 14C12.25 14 14.5 15.6 15.25 18.75"
        stroke={color}
        strokeWidth="1.65"
        strokeLinecap="round"
      />
      <Path
        d="M18 10.5V15.5M15.5 13H20.5"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function OnTimeIcon({ size = 12, color = '#15803D' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="8.5" stroke={color} strokeWidth="1.8" />
      <Path
        d="M8.5 12.2L10.9 14.6L15.8 9.6"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function LateDeadlineIcon({ size = 12, color = '#B91C1C' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12.5" r="8" stroke={color} strokeWidth="1.8" />
      <Path d="M12 8.2V12.5L14.8 14.2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M5.2 5.8L7.8 3.6M18.8 5.8L16.2 3.6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

function WithinEstimateIcon({ size = 12, color = colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 4H17M7 20H17M8.5 4V7.2C8.5 8.8 10.1 10.1 12 11.5C13.9 10.1 15.5 8.8 15.5 7.2V4M8.5 20V16.8C8.5 15.2 10.1 13.9 12 12.5C13.9 13.9 15.5 15.2 15.5 16.8V20"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function OverEstimateIcon({ size = 12, color = '#B91C1C' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4.5 17.5L10 12L13.5 15.5L19.5 7.5"
        stroke={color}
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M15.2 7.5H19.5V11.8"
        stroke={color}
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function SosAlertIcon({ size = 14, color = '#B42318' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6.5 18.5V13.5C6.5 10.46 8.96 8 12 8C15.04 8 17.5 10.46 17.5 13.5V18.5"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <Path d="M4.5 18.5H19.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path
        d="M12 3.2V5.2M5.2 6.2L6.6 7.6M18.8 6.2L17.4 7.6M3.2 12.5H5M19 12.5H20.8"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </Svg>
  );
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
  const isManagerRole = ['admin', 'superadmin', 'manager', 'branch_owner'].includes(String(user?.role || '').toLowerCase());
  const hasPermission = (permission: string) => permissions.includes('*') || permissions.includes(permission);
  const canReadWork = isManagerRole || hasPermission('work:read');
  const canManageTasks = isManagerRole || hasPermission('work:manage');
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
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

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
    setExpandedGroups((prev) => {
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

  const renderTaskRow = (task: HrKanbanTask, index: number, list: HrKanbanTask[]) => {
    const st = getStatusMeta(task.status);
    const pr = getPriorityMeta(task.priority);
    const deadlineKpi = calculateTaskDeadlineKpi(task);
    const estProgress = calculateEstimatedTimeProgress(task);
    const progress = taskProgress(task);
    const assigneeLabel = task.assignee || task.assigneeName || 'Chưa phân công';
    const assigneeEmp = employees.find(
      (emp) =>
        (task.assigneeUid && (emp.uid === task.assigneeUid || emp._id === task.assigneeUid || emp.id === task.assigneeUid)) ||
        (assigneeLabel !== 'Chưa phân công' && emp.displayName === assigneeLabel),
    );
    const assigneeAvatar = assigneeEmp?.photoURL?.trim() || '';
    const closed = task.status === 'Archived';
    const isActivityOwner = canManageTasks || task.assigneeUid === currentUid;
    const canJoinHelp = task.helpRequested
      && !closed
      && (!task.requestedHelperUid || task.requestedHelperUid === currentUid)
      && task.assigneeUid !== currentUid
      && !task.helpers?.some((helper) => helper.uid === currentUid);
    const isLast = index === list.length - 1;
    return (
      <Pressable
        key={task.id}
        onPress={canManageTasks ? () => openEditTask(task) : undefined}
        style={[styles.taskRow, isLast && styles.taskRowLast]}
      >
        <View style={styles.taskRowTop}>
          <View style={styles.taskTitleWrap}>
            <View style={styles.taskIconWrap}>
              <TaskItemIcon size={18} />
            </View>
            <Text numberOfLines={1} ellipsizeMode="tail" style={styles.taskTitle}>
              {task.title}
            </Text>
          </View>
          <View style={styles.taskAssigneeInline}>
            {assigneeAvatar ? (
              <Image source={{ uri: assigneeAvatar }} style={styles.taskAvatarImg} />
            ) : (
              <View style={styles.taskAvatarFallback}>
                <Text style={styles.taskAvatarInitials}>{getInitials(assigneeLabel)}</Text>
              </View>
            )}
            <Text numberOfLines={1} style={styles.taskAssigneeNameText}>{assigneeLabel}</Text>
          </View>
        </View>
        <View style={styles.taskRowMeta}>
          <View style={styles.taskBadgesRow}>
            {canManageTasks ? (
              <Pressable
                hitSlop={6}
                onPress={() => void onQuickAdvanceStatus(task)}
                style={[styles.statusBadge, { backgroundColor: st.tone }]}
              >
                <Text style={[styles.statusBadgeText, { color: st.color }]}>{st.label}</Text>
              </Pressable>
            ) : (
              <View style={[styles.statusBadge, { backgroundColor: st.tone }]}>
                <Text style={[styles.statusBadgeText, { color: st.color }]}>{st.label}</Text>
              </View>
            )}
            <Text style={[styles.priorityTag, { color: pr.color, backgroundColor: pr.tone }]}>
              {pr.label}
            </Text>
          </View>
          {task.dueDate && task.dueDate !== 'Chưa cập nhật' ? (
            <View style={styles.taskDueWrap}>
              <CalendarDays size={12} color={colors.muted} />
              <Text numberOfLines={1} style={styles.taskDueText}>Hạn{'\u00A0'}{formatDateDDMMYYYY(task.dueDate)}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.taskProgressSummary}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: progressColor(progress) }]} />
          </View>
          {task.progressNote ? <Text numberOfLines={2} style={styles.progressNote}>💬 {task.progressNote}</Text> : null}
        </View>
        {task.helpRequested ? (
          <View style={styles.helpNotice}>
            <SosAlertIcon size={14} color="#B42318" />
            <Text style={styles.helpNoticeText}>
              Đang cần trợ giúp{task.helpReason ? `: ${task.helpReason}` : ''}
            </Text>
          </View>
        ) : null}
        {task.helpers?.length ? (
          <View style={styles.helpersLine}>
            <UserCheck size={12} color={colors.primary} />
            <Text style={styles.taskMetaText}>Người hỗ trợ: {task.helpers.map((helper) => helper.name).join(', ')}</Text>
          </View>
        ) : null}
        <View style={styles.taskFooterRow}>
          <View style={styles.taskActivityActions}>
            {isActivityOwner && !closed ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Báo cáo tiến độ"
                  hitSlop={6}
                  onPress={(event) => { event.stopPropagation(); openTaskActivity(task, 'progress'); }}
                  style={({ pressed }) => [styles.taskActionLinkBtn, pressed && { opacity: 0.55 }]}
                >
                  <ReportProgressIcon size={15} />
                  <Text style={styles.taskActionLinkBlue}>Tiến độ</Text>
                </Pressable>
                {!task.helpRequested && progress < 100 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Yêu cầu trợ giúp"
                    hitSlop={6}
                    onPress={(event) => { event.stopPropagation(); openTaskActivity(task, 'help'); }}
                    style={({ pressed }) => [styles.taskActionLinkBtn, pressed && { opacity: 0.55 }]}
                  >
                    <RequestHelpIcon size={15} />
                    <Text style={styles.taskActionLinkRed}>Trợ giúp</Text>
                  </Pressable>
                ) : null}
                {task.helpRequested ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Đã giải quyết trợ giúp"
                    hitSlop={6}
                    onPress={(event) => { event.stopPropagation(); void runTaskActivity(task, 'resolve'); }}
                    disabled={savingActivity}
                    style={({ pressed }) => [styles.taskActionLinkBtn, pressed && { opacity: 0.55 }, savingActivity && styles.disabled]}
                  >
                    <ResolveHelpIcon size={15} />
                    <Text style={styles.taskActionLinkGreen}>Đã xong</Text>
                  </Pressable>
                ) : null}
              </>
            ) : null}
            {canJoinHelp ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tham gia hỗ trợ"
                hitSlop={6}
                onPress={(event) => { event.stopPropagation(); void runTaskActivity(task, 'join'); }}
                disabled={savingActivity}
                style={({ pressed }) => [styles.taskActionLinkBtn, pressed && { opacity: 0.55 }, savingActivity && styles.disabled]}
              >
                <JoinHelpIcon size={15} />
                <Text style={styles.taskActionLinkBlue}>Hỗ trợ</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.taskFooterRight}>
            {task.salesKpiTarget && task.salesKpiTarget > 0 ? (
              <View style={styles.salesKpiInlineWrap}>
                <Target size={12} color={colors.primary} />
                <Text numberOfLines={1} style={styles.salesKpiInlineText}>
                  {formatCompactMoney(task.salesKpiTarget)}
                </Text>
              </View>
            ) : null}
            {canManageTasks ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Sửa công việc ${task.title}`}
                  hitSlop={6}
                  onPress={(event) => {
                    event.stopPropagation();
                    openEditTask(task);
                  }}
                  style={({ pressed }) => [styles.tinyIconBtn, pressed && { opacity: 0.55 }]}
                >
                  <Pencil size={14} strokeWidth={1.65} color={colors.ink} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Xóa công việc ${task.title}`}
                  hitSlop={6}
                  onPress={(event) => {
                    event.stopPropagation();
                    onDeleteTask(task);
                  }}
                  style={({ pressed }) => [styles.tinyIconBtn, pressed && { opacity: 0.55 }]}
                >
                  <Trash2 size={14} strokeWidth={1.65} color="#C74848" />
                </Pressable>
              </>
            ) : null}
            <Text style={[styles.taskProgressPercent, { color: progressColor(progress) }]}>{progress}%</Text>
          </View>
        </View>
        {deadlineKpi ? (
          <View style={styles.kpiTagRow}>
            <View style={[styles.kpiTagBox, deadlineKpi.status === 'ontime' ? styles.kpiTagOk : styles.kpiTagLate]}>
              {deadlineKpi.status === 'ontime' ? <OnTimeIcon size={12} /> : <LateDeadlineIcon size={12} />}
              <Text style={[styles.kpiTag, deadlineKpi.status === 'ontime' ? styles.kpiTagOkText : styles.kpiTagLateText]}>{deadlineKpi.text}</Text>
            </View>
          </View>
        ) : null}
      </Pressable>
    );
  };

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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tạo dự án mới"
            onPress={openCreateProject}
            style={({ pressed }) => [styles.addProjectIconBtn, pressed && { opacity: 0.7 }]}
          >
            <Svg width={21} height={21} viewBox="0 0 24 24" fill="none">
              <Path
                d="M3.5 6.8C3.5 5.55 4.5 4.5 5.8 4.5H9.4C10.1 4.5 10.75 4.82 11.18 5.38L12.1 6.6H18.2C19.5 6.6 20.5 7.62 20.5 8.9V17.2C20.5 18.48 19.5 19.5 18.2 19.5H5.8C4.5 19.5 3.5 18.48 3.5 17.2V6.8Z"
                fill="#DBEAFE"
                stroke="#1E7CE8"
                strokeWidth="1.65"
                strokeLinejoin="round"
              />
              <Circle cx="17.5" cy="17" r="4.6" fill="#FFFFFF" stroke="#1E7CE8" strokeWidth="1.5" />
              <Path
                d="M17.5 14.9V19.1M15.4 17H19.6"
                stroke="#1E7CE8"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </Svg>
          </Pressable>
        ) : null}
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
            <Text style={styles.groupTitle}>KPI</Text>
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
            <View style={styles.stateCard}>
              <IgenHrEmptyState message="Chưa có dữ liệu KPI nhân viên trong tháng này." />
            </View>
          ) : (
            (() => {
              const q = search.trim().toLowerCase();
              const visibleRows = q
                ? kpiReport.rows.filter((r) => r.employeeName.toLowerCase().includes(q))
                : kpiReport.rows;

              return (
                <>
                  <View style={styles.kpiList}>
                    {!visibleRows.length ? (
                      <View style={styles.stateCard}>
                        <IgenHrEmptyState compact message="Không tìm thấy nhân sự phù hợp." />
                      </View>
                    ) : (
                      visibleRows.map((row) => {
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
                            <Text style={[styles.kpiPctText, pct == null && styles.kpiEmptyText, { color: pctColor }]}>
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
                    })
                    )}
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
          {scopeFilter === 'with_project' && !projectGroups.length ? (
            <View style={styles.stateCard}>
              <IgenHrEmptyState message="Chưa có dự án nào phù hợp." />
            </View>
          ) : null}
          {scopeFilter !== 'no_project'
            ? projectGroups.map(({ project, tasks: projTasks, totalCount, doneCount, progress }) => {
                const expanded = expandedGroups.has(project.id);
                return (
                  <View key={project.id} style={styles.groupCard}>
                    <Pressable
                      onPress={() => toggleGroup(project.id)}
                      style={styles.groupHeader}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={styles.groupTitle}>
                          {project.name}
                        </Text>
                        {project.dueAt ? (
                          <Text numberOfLines={1} style={styles.groupSubDue}>
                            Hạn{'\u00A0'}{formatDateDDMMYYYY(project.dueAt)}
                          </Text>
                        ) : null}
                        <Text numberOfLines={1} style={styles.groupSubDue}>
                          Số công việc: {doneCount}/{totalCount}{' '}
                          <Text style={{ color: progressColor(progress), fontWeight: '400' }}>({progress}%)</Text>
                        </Text>
                        <View style={styles.progressTrack}>
                          <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: progressColor(progress) }]} />
                        </View>
                      </View>
                      <View style={styles.groupHeaderRight}>
                        {canManageTasks ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Thêm công việc vào dự án"
                            hitSlop={6}
                            onPress={() => openCreateTask(project.id)}
                            style={({ pressed }) => [styles.tinyIconBtn, pressed && { opacity: 0.55 }]}
                          >
                            <AddTaskIcon size={18} color={colors.ink} />
                          </Pressable>
                        ) : null}
                        {canManageTasks ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Sửa dự án"
                            hitSlop={6}
                            onPress={() => openEditProject(project)}
                            style={({ pressed }) => [styles.tinyIconBtn, pressed && { opacity: 0.55 }]}
                          >
                            <Pencil size={15} strokeWidth={1.65} color={colors.ink} />
                          </Pressable>
                        ) : null}
                        {expanded ? <ChevronUp size={15} color={colors.muted} /> : <ChevronDown size={15} color={colors.muted} />}
                      </View>
                    </Pressable>

                    {expanded ? (
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
                <View style={{ flex: 1 }}>
                  <Text style={styles.groupTitle}>{canReadWork ? 'Công việc không thuộc dự án' : 'Việc của tôi'}</Text>
                  <Text style={styles.groupSub}>
                    {unassignedTasks.length} {canReadWork ? 'công việc độc lập' : 'công việc'}
                  </Text>
                </View>
                <View style={styles.groupHeaderRight}>
                  {canManageTasks ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Thêm công việc độc lập"
                      hitSlop={6}
                      onPress={() => openCreateTask('')}
                      style={({ pressed }) => [styles.tinyIconBtn, pressed && { opacity: 0.55 }]}
                    >
                      <AddTaskIcon size={18} color={colors.ink} />
                    </Pressable>
                  ) : null}
                  {expandedGroups.has('__UNASSIGNED__') ? <ChevronUp size={15} color={colors.muted} /> : <ChevronDown size={15} color={colors.muted} />}
                </View>
              </Pressable>

              {expandedGroups.has('__UNASSIGNED__') ? (
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
        <View>
          <HrFormSectionTitle title="Thông tin công việc" />
          <HrFormInputRow
            label="Tên công việc *"
            value={taskTitle}
            onChangeText={setTaskTitle}
            placeholder="Nhập tiêu đề công việc..."
          />
          <HrFormSelectRow
            label="Thuộc dự án"
            sheetTitle="Chọn dự án"
            value={taskProjectId}
            placeholder="Không thuộc dự án"
            options={[
              { value: '', label: 'Không thuộc dự án' },
              ...projects.map((p) => ({ value: p.id, label: p.name })),
            ]}
            onSelect={setTaskProjectId}
          />
          <HrFormSelectRow
            label="Trạng thái"
            sheetTitle="Chọn trạng thái"
            value={taskStatus}
            options={STATUS_META.map((st) => ({ value: st.key, label: st.label }))}
            onSelect={(val) => setTaskStatus(val as typeof taskStatus)}
          />
          <HrFormSelectRow
            label="Độ ưu tiên"
            sheetTitle="Chọn độ ưu tiên"
            value={taskPriority}
            options={PRIORITY_OPTIONS.map((p) => ({ value: p.key, label: p.label }))}
            onSelect={(val) => setTaskPriority(val as typeof taskPriority)}
          />
          <HrFormSelectRow
            label="Người thực hiện"
            sheetTitle="Chọn người thực hiện"
            value={taskAssigneeUid}
            placeholder="Chọn nhân sự"
            options={employees.map((emp) => ({
              value: emp.uid || emp._id || emp.id || '',
              label: emp.displayName,
              subtitle: [emp.jobTitle || emp.position, emp.department].filter(Boolean).join(' · ') || undefined,
            }))}
            onSelect={setTaskAssigneeUid}
          />
          <HrFormSelectRow
            label="Phân loại"
            sheetTitle="Chọn phân loại"
            value={taskCategory}
            options={TASK_CATEGORIES.map((cat) => ({ value: cat, label: cat }))}
            onSelect={setTaskCategory}
          />
          {taskCategory === 'Bán hàng' ? (
            <HrFormInputRow
              label="Chỉ tiêu doanh số KPI (VNĐ)"
              value={taskSalesKpiTarget}
              onChangeText={setTaskSalesKpiTarget}
              keyboardType="numeric"
              placeholder="VD: 50000000"
            />
          ) : null}
          <HrFormCustomRow label="Hạn chót *">
            <Pressable
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 }}
              onPress={() => openDatePicker('taskDue')}
            >
              <Text numberOfLines={1} style={{ color: taskDueDate ? '#111827' : '#9CA3AF', fontSize: 15, fontWeight: taskDueDate ? '500' : '400', flex: 1 }}>
                {taskDueDate ? formatTaskDateTime(taskDueDate) : 'Chọn ngày và giờ'}
              </Text>
              <CalendarDays size={16} color="#9CA3AF" />
            </Pressable>
          </HrFormCustomRow>
          <HrFormCustomRow label="Thời gian bắt đầu">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pressable
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 }}
                onPress={() => openDatePicker('taskStart')}
              >
                <Text numberOfLines={1} style={{ color: taskStartTime ? '#111827' : '#9CA3AF', fontSize: 15, fontWeight: taskStartTime ? '500' : '400', flex: 1 }}>
                  {taskStartTime ? formatTaskDateTime(taskStartTime) : 'Chọn ngày và giờ'}
                </Text>
                <Clock3 size={16} color="#9CA3AF" />
              </Pressable>
              {taskStartTime ? (
                <Pressable onPress={() => setTaskStartTime('')} hitSlop={8} accessibilityLabel="Xóa thời gian bắt đầu">
                  <X size={16} color="#9CA3AF" />
                </Pressable>
              ) : null}
            </View>
          </HrFormCustomRow>
          <HrFormInputRow
            label="Giờ dự tính"
            value={taskEstTime}
            onChangeText={setTaskEstTime}
            keyboardType="numeric"
            placeholder="VD: 4"
          />
          <HrFormInputRow
            label="Link / Ghi chú"
            value={taskLinkNote}
            onChangeText={setTaskLinkNote}
            placeholder="Link tài liệu hoặc ghi chú..."
          />
          <HrFormCustomRow label="Tệp đính kèm" last>
            <View style={{ gap: 8, marginTop: 6 }}>
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
                    onPress={() => showHrConfirm({
                      title: 'Xóa tệp đính kèm?',
                      message: `Bạn có chắc muốn xóa tệp "${attachment.name}"?`,
                      confirmLabel: 'Xóa tệp',
                      onConfirm: () => setTaskAttachments((current) => current.filter((item) => item.id !== attachment.id)),
                    })}
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
                  placeholderTextColor="#9CA3AF"
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
            </View>
          </HrFormCustomRow>

          {editingTask && canManageTasks ? (
            <Pressable
              onPress={() => onDeleteTask(editingTask)}
              style={[styles.deleteBtn, { marginTop: 12 }]}
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
        <View>
          <HrFormSectionTitle title={activityTask?.title || 'Thông tin cập nhật'} />
          {activityMode === 'progress' ? (
            <>
              <HrFormInputRow
                label={`Tiến độ hoàn thành (${activityProgress}%)`}
                value={String(activityProgress)}
                onChangeText={(value) => {
                  const digits = value.replace(/[^0-9]/g, '').slice(0, 3);
                  if (!digits) { setActivityProgress(0); return; }
                  setActivityProgress(Math.min(100, Number(digits)));
                }}
                keyboardType="number-pad"
                maxLength={3}
                selectTextOnFocus
              />
              <HrFormCustomRow label="Chọn nhanh">
                <View style={[styles.wrapRow, { marginTop: 6 }]}>
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
              </HrFormCustomRow>
              <HrFormInputRow
                label={`Nội dung báo cáo * (${activityNote.length}/2000)`}
                value={activityNote}
                onChangeText={setActivityNote}
                multiline
                maxLength={2000}
                placeholder="Mô tả kết quả đã hoàn thành hoặc vướng mắc..."
                last
              />
            </>
          ) : (
            <>
              <HrFormSelectRow
                label="Người hỗ trợ"
                sheetTitle="Chọn người hỗ trợ"
                value={activityHelperUid}
                placeholder="Cả nhóm"
                options={[
                  { value: '', label: 'Cả nhóm', subtitle: 'Gửi thông báo tới tất cả thành viên' },
                  ...employees
                    .filter((employee) => {
                      const uid = employee.id || employee._id || employee.uid || '';
                      return uid && uid !== currentUid && uid !== activityTask?.assigneeUid;
                    })
                    .map((employee) => ({
                      value: employee.id || employee._id || employee.uid || '',
                      label: employee.displayName,
                      subtitle: [employee.jobTitle || employee.position, employee.department].filter(Boolean).join(' · ') || undefined,
                    })),
                ]}
                onSelect={setActivityHelperUid}
              />
              <HrFormInputRow
                label={`Nguyên nhân cần trợ giúp * (${activityNote.length}/2000)`}
                value={activityNote}
                onChangeText={setActivityNote}
                multiline
                maxLength={2000}
                placeholder="Mô tả vướng mắc hoặc hỗ trợ bạn cần..."
                last
              />
            </>
          )}
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
        <View>
          <HrFormSectionTitle title="Thông tin dự án" />
          <HrFormInputRow
            label="Tên dự án *"
            value={projName}
            onChangeText={setProjName}
            placeholder="VD: Triển khai ERP Q4"
          />
          <HrFormSelectRow
            label="Độ ưu tiên"
            sheetTitle="Chọn độ ưu tiên"
            value={projPriority}
            options={[
              { value: 'high', label: 'Cao' },
              { value: 'medium', label: 'Trung bình' },
              { value: 'low', label: 'Thấp' },
            ]}
            onSelect={(val) => setProjPriority(val as typeof projPriority)}
          />
          <HrFormCustomRow label="Hạn hoàn thành" last>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pressable
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 }}
                onPress={() => openDatePicker('projectDue')}
              >
                <Text numberOfLines={1} style={{ color: projDueAt ? '#111827' : '#9CA3AF', fontSize: 15, fontWeight: projDueAt ? '500' : '400', flex: 1 }}>
                  {projDueAt ? formatProjectDate(projDueAt) : 'Chọn ngày'}
                </Text>
                <CalendarDays size={16} color="#9CA3AF" />
              </Pressable>
              {projDueAt ? (
                <Pressable onPress={() => setProjDueAt('')} hitSlop={8} accessibilityLabel="Xóa hạn hoàn thành">
                  <X size={16} color="#9CA3AF" />
                </Pressable>
              ) : null}
            </View>
          </HrFormCustomRow>

          {editingProject && canManageTasks ? (
            <Pressable
              onPress={() => onDeleteProject(editingProject)}
              style={[styles.deleteBtn, { marginTop: 12 }]}
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
    {canManageTasks ? <HrFab label="Thêm công việc" onPress={() => openCreateTask('')} /> : null}
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
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  search: {
    flex: 1,
    backgroundColor: '#F6F8FC',
    borderColor: '#DCE5F2',
    borderWidth: 1,
    borderRadius: 99,
    paddingHorizontal: 14,
    height: 40,
    fontSize: 13.5,
    color: '#111827',
  },
  primaryBtn: { backgroundColor: colors.primary, minHeight: 40, paddingHorizontal: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: colors.white, fontSize: 12.5, fontWeight: '600' },
  iconButtonContent: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  secondaryActionBtn: { ...HAIRLINE_CARD, minHeight: 40, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center' },
  addProjectIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DCE5F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  scopeBar: { flexDirection: 'row', backgroundColor: '#EAF1FA', borderRadius: 10, padding: 3, gap: 3, marginBottom: 10 },
  scopeBtn: { flex: 1, paddingVertical: 7.5, borderRadius: 8, alignItems: 'center' },
  scopeBtnActive: { backgroundColor: colors.white },
  scopeText: { color: '#6B7280', fontSize: 11.5, fontWeight: '500' },
  scopeTextActive: { color: colors.primary, fontWeight: '600' },
  chipScroll: { flexGrow: 0, marginHorizontal: -14, marginBottom: 12 },
  chipRow: { paddingHorizontal: 14, gap: 6 },
  chip: { backgroundColor: colors.white, borderColor: '#E5EAF2', borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: '#6B7280', fontSize: 11.5, fontWeight: '500' },
  chipTextActive: { color: colors.white, fontWeight: '600' },
  stateCard: { ...HAIRLINE_CARD, padding: 22, alignItems: 'center', gap: 10 },
  muted: { color: '#6B7280', fontSize: 12.5, fontWeight: '400' },
  errorText: { color: '#B91C1C', fontSize: 12.5, textAlign: 'center' },
  groupsWrap: {
    marginHorizontal: -14,
    gap: 0,
  },
  groupCard: {
    backgroundColor: colors.white,
    borderRadius: 0,
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#E8EDF2',
    overflow: 'hidden',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    backgroundColor: colors.white,
  },
  folderIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#EAF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupTitle: { color: '#111827', fontSize: 14, fontWeight: '600' },
  groupSub: { color: '#6B7280', fontSize: 11.5, fontWeight: '400', marginTop: 2 },
  progressTrack: { height: 5, borderRadius: 99, backgroundColor: '#E8EDF4', marginTop: 6, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#16885A', borderRadius: 99 },
  groupHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  tinyAddBtn: { backgroundColor: '#EAF2FF', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  tinyAddText: { color: colors.primary, fontSize: 11, fontWeight: '600' },
  tinyIconBtn: { width: 24, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  tinyIconText: { color: '#374151', fontSize: 12, fontWeight: '600' },
  caret: { color: '#6B7280', fontSize: 14, fontWeight: '600', paddingHorizontal: 2 },
  groupBody: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EDF2F8' },
  emptyGroupText: { color: '#6B7280', fontSize: 12, textAlign: 'center', paddingVertical: 14 },
  taskTimelineWrap: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.white,
    paddingLeft: 14,
  },
  taskTimelineRail: {
    width: 24,
    alignItems: 'center',
    marginRight: 8,
  },
  taskTimelineLine: {
    flex: 1,
    width: 1.5,
    backgroundColor: '#93C5FD',
  },
  taskTimelineLineHidden: {
    opacity: 0,
  },
  taskStepCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskStepNum: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '600',
  },
  taskRow: {
    paddingLeft: 28,
    paddingRight: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#DCE3EC',
    backgroundColor: colors.white,
    gap: 6,
  },
  taskRowLast: {
    borderBottomWidth: 0,
  },
  taskRowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  taskTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1, minWidth: 0 },
  taskIconWrap: { flexShrink: 0 },
  taskTitle: { color: '#111827', fontSize: 13.5, fontWeight: '500', flex: 1, lineHeight: 19 },
  taskAssigneeInline: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '42%', flexShrink: 0 },
  taskAssigneeNameText: { color: '#6B7280', fontSize: 11.5, flexShrink: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3.5, borderRadius: 8 },
  statusBadgeText: { fontSize: 10.5, fontWeight: '400' },
  taskRowMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  taskMetaGroup: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  taskAssigneeWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 },
  taskAvatarImg: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#E8EDF4' },
  taskAvatarFallback: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' },
  taskAvatarInitials: { color: colors.primary, fontSize: 9, fontWeight: '600' },
  taskBadgesRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 },
  taskDueWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  taskMetaText: { color: '#6B7280', fontSize: 11.5, flexShrink: 1 },
  taskDueText: { color: '#6B7280', fontSize: 11.5, flexShrink: 0 },
  groupSubRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 2 },
  groupTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  groupPercent: { color: colors.primary, fontSize: 12, fontWeight: '600', flexShrink: 0 },
  groupSubDue: { color: '#6B7280', fontSize: 11.5, flexShrink: 0, marginTop: 2 },
  priorityTag: { fontSize: 10, fontWeight: '400', paddingHorizontal: 8, paddingVertical: 2.5, borderRadius: 8, overflow: 'hidden' },
  taskProgressSummary: { gap: 2, marginTop: 1 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  taskProgressLabel: { color: '#6B7280', fontSize: 10.5, fontWeight: '500' },
  taskProgressPercent: { color: colors.primary, fontSize: 11.5, fontWeight: '400' },
  progressNote: { color: '#6B7280', fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  helpNotice: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  helpNoticeTitle: { color: '#B42318', fontSize: 11.5, fontWeight: '400' },
  helpNoticeText: { color: '#B42318', fontSize: 11.5, fontWeight: '400', lineHeight: 16, flex: 1 },
  helpersLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  taskFooterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 2 },
  taskFooterRight: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  salesKpiInlineWrap: { flexDirection: 'row', alignItems: 'center', gap: 3, marginRight: 2 },
  salesKpiInlineText: { color: colors.primary, fontSize: 11, fontWeight: '400' },
  taskActivityActions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, flex: 1 },
  taskActionIconBtn: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  taskActionLinkBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  taskActionLinkBlue: { color: '#1E7CE8', fontSize: 11.5, fontWeight: '400' },
  taskActionLinkRed: { color: '#C74848', fontSize: 11.5, fontWeight: '400' },
  taskActionLinkGreen: { color: '#16A34A', fontSize: 11.5, fontWeight: '400' },
  taskActivityBtn: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#EAF2FF' },
  taskActivityBtnText: { color: colors.primary, fontSize: 10.5, fontWeight: '600' },
  taskHelpBtn: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#FFF1F0' },
  taskHelpBtnText: { color: '#B42318', fontSize: 10.5, fontWeight: '600' },
  taskResolveBtn: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#E9F8F1' },
  taskResolveBtnText: { color: '#16885A', fontSize: 10.5, fontWeight: '600' },
  taskJoinBtn: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#B42318' },
  taskJoinBtnText: { color: colors.white, fontSize: 10.5, fontWeight: '600' },
  kpiTagRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 5, marginTop: 2 },
  kpiTagBox: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7 },
  kpiTag: { fontSize: 10, fontWeight: '400' },
  kpiTagOk: { backgroundColor: '#DCFCE7' },
  kpiTagOkText: { color: '#15803D' },
  kpiTagLate: { backgroundColor: '#FEE2E2' },
  kpiTagLateText: { color: '#B91C1C' },
  kpiTagInfo: { backgroundColor: '#EAF2FF' },
  kpiTagInfoText: { color: colors.primary },

  // Monthly KPI
  kpiWrap: { gap: 9 },
  kpiBar: { ...HAIRLINE_CARD, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, gap: 10 },
  monthNav: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  monthBtn: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  monthBtnText: { color: '#111827', fontSize: 16, fontWeight: '600', lineHeight: 18 },
  monthLabelBox: { paddingHorizontal: 6, height: 30, alignItems: 'center', justifyContent: 'center' },
  monthLabelText: { color: '#111827', fontSize: 13, fontWeight: '400' },
  kpiList: {
    marginHorizontal: -14,
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#EEF2F7',
  },
  kpiRowCard: {
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
  kpiPctText: { fontSize: 14, fontWeight: '600' },
  kpiEmptyText: { fontSize: 12.5, fontWeight: '400' },
  kpiRowMetrics: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  kpiMetricText: { color: '#6B7280', fontSize: 11, fontWeight: '500' },

  // Modals
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.35)', justifyContent: 'center', padding: 16 },
  sheet: { backgroundColor: colors.white, borderRadius: 20, overflow: 'hidden', padding: 18, maxHeight: '86%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  activityModalHeading: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  activityTaskTitle: { color: '#6B7280', fontSize: 12, marginBottom: 6 },
  progressEditorSummary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressEditorPercent: { color: colors.primary, fontSize: 22, fontWeight: '600' },
  progressPercentInput: { minHeight: 44, borderWidth: 1, borderColor: '#DCE5F2', borderRadius: 10, backgroundColor: '#F6F8FC', textAlign: 'center', color: '#111827', fontSize: 18, fontWeight: '600', paddingVertical: 6 },
  activityNoteField: { minHeight: 92, textAlignVertical: 'top' },
  activityCharCount: { color: '#6B7280', textAlign: 'right', fontSize: 10.5 },
  helpHint: { color: '#6B7280', fontSize: 11.5, lineHeight: 16 },
  sheetTitle: { color: '#111827', fontSize: 16, fontWeight: '600', flex: 1 },
  closeText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  form: { gap: 8, paddingBottom: 10 },
  label: { color: '#374151', fontSize: 12.5, fontWeight: '500', marginTop: 4 },
  field: { backgroundColor: '#F6F8FC', borderColor: '#DCE5F2', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13.5, color: '#111827' },
  attachmentRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5EAF2', borderRadius: 10, backgroundColor: '#FAFBFD' },
  attachmentNameButton: { flex: 1, minWidth: 0 },
  attachmentName: { color: '#111827', fontSize: 12.5, fontWeight: '500' },
  attachmentMeta: { color: '#6B7280', fontSize: 10.5, marginTop: 2 },
  attachmentRemove: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF1F0' },
  attachmentActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  attachmentAction: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, borderWidth: 1, borderColor: '#DCE5F2', borderRadius: 9, backgroundColor: colors.white },
  attachmentActionText: { color: colors.primary, fontSize: 11.5, fontWeight: '500' },
  recordingAction: { backgroundColor: '#FFF1F0', borderColor: '#FECACA' },
  recordingActionText: { color: '#B42318' },
  attachmentLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  attachmentLinkInput: { flex: 1 },
  addAttachmentLink: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.primary },
  addAttachmentLinkText: { color: colors.white, fontSize: 11.5, fontWeight: '600' },
  attachmentUploading: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateTimeField: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F6F8FC', borderColor: '#DCE5F2', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  dateTimeInputRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dateTimeClear: { width: 32, height: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  dateTimeValue: { flex: 1, color: '#111827', fontSize: 13.5 },
  dateTimePlaceholder: { flex: 1, color: '#94A3B8', fontSize: 13.5 },
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.42)', justifyContent: 'center', padding: 20 },
  pickerSheet: { backgroundColor: colors.white, borderRadius: 20, overflow: 'hidden', padding: 16 },
  pickerTitle: { color: '#111827', fontSize: 15.5, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  pickerActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  pickerCancelBtn: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 10, backgroundColor: '#F1F5F9' },
  pickerCancelText: { color: '#374151', fontSize: 13, fontWeight: '600' },
  pickerConfirmBtn: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 10, backgroundColor: colors.primary },
  pickerConfirmText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  submitBtn: { backgroundColor: colors.primary, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  submitBtnText: { color: colors.white, fontSize: 13.5, fontWeight: '600' },
  deleteBtn: { backgroundColor: '#FCEBEC', minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  deleteBtnText: { color: '#C74848', fontSize: 13, fontWeight: '600' },
  disabled: { opacity: 0.45 },
});

