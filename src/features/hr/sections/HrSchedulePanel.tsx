import { PopupError } from '@/components/PopupError';
import { FullScreenFormModal } from '@/components/FullScreenFormModal';
import {
  HrFormCustomRow,
  HrFormInputRow,
  HrFormSectionTitle,
  HrFormSelectRow,
  HrFormSwitchRow,
} from '@/features/hr/components/HrFormFields';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import {
  CalendarCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Users,
} from 'lucide-react-native';
import { Card } from '@/components/Card';
import { IgenHrEmptyState } from '@/components/EmptyStateIllustration';
import { HrFab } from '@/features/hr/components/HrFab';
import { showHrConfirm } from '@/features/hr/components/HrConfirmModal';
import { useAuth } from '@/core/auth/AuthProvider';
import {
  assignHrWorkShift,
  createHrCalendarEvent,
  createHrWorkCalendarDay,
  deleteHrCalendarEvent,
  deleteHrWorkCalendarDay,
  listHrCalendarEvents,
  listAttendanceRoster,
  listHrEmployeeWorkHours,
  listHrShiftAssignments,
  listHrWorkCalendar,
  listHrWorkShifts,
  listLeaveApplications,
  listMonthlyAttendanceLogs,
  saveHrWorkShift,
  syncHrWorkCalendar,
  updateAttendanceLog,
  updateHrEmployeeWorkHours,
  updateHrWorkCalendarDay,
} from '@/features/hr/hrApi';
import type {
  HrAttendanceRecord,
  HrAttendanceRosterEntry,
  HrCalendarEvent,
  HrCalendarEventType,
  HrEmployeeWorkHoursRow,
  HrLeaveApplication,
  HrShiftAssignmentEmployee,
  HrWorkCalendarDay,
  HrWorkCalendarDayType,
  HrWorkHoursConfig,
  HrWorkShift,
} from '@/features/hr/types';
import { getTodayKey } from '@/features/overview/overviewPeriod';
import { colors } from '@/theme/colors';

type ScheduleSubTab = 'attendance' | 'shifts' | 'holidays' | 'hours';

const DAYS_OF_WEEK = [
  { v: 1, l: 'T2' },
  { v: 2, l: 'T3' },
  { v: 3, l: 'T4' },
  { v: 4, l: 'T5' },
  { v: 5, l: 'T6' },
  { v: 6, l: 'T7' },
  { v: 0, l: 'CN' },
];

const EVENT_TYPE_LABELS: Record<HrCalendarEventType, string> = {
  event: 'Sự kiện',
  leave: 'Nghỉ phép',
  wfh: 'WFH',
  exception: 'Ngoại lệ',
  reminder: 'Nhắc nhở',
};

const EVENT_TYPE_COLORS: Record<HrCalendarEventType, { dot: string; bg: string; fg: string }> = {
  event: { dot: '#2563EB', bg: '#EFF6FF', fg: '#1D4ED8' },
  leave: { dot: '#E11D48', bg: '#FFF1F2', fg: '#BE123C' },
  wfh: { dot: '#0D9488', bg: '#F0FDFA', fg: '#0F766E' },
  exception: { dot: '#7C3AED', bg: '#F5F3FF', fg: '#6D28D9' },
  reminder: { dot: '#D97706', bg: '#FFFBEB', fg: '#B45309' },
};

function normalizeDateKey(val?: string | null): string {
  if (!val) return '';
  const raw = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
  }
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(raw);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  return raw.slice(0, 10);
}

function formatEventClock(val?: string | null): string {
  if (!val) return '';
  const raw = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return '';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  const hh = parsed.getHours();
  const mm = parsed.getMinutes();
  if (hh === 0 && mm === 0) return '';
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function mapLeaveAppToCalendarEvent(app: HrLeaveApplication): HrCalendarEvent {
  const rawKind = String(app.requestKind || app.type || app.leaveType || 'leave').toLowerCase();
  const type: HrCalendarEventType = rawKind.includes('wfh')
    ? 'wfh'
    : rawKind.includes('exception') || rawKind.includes('ngoại lệ')
      ? 'exception'
      : 'leave';
  const empName = app.employeeName || 'Nhân sự';
  const defaultTitle = type === 'wfh' ? `WFH · ${empName}` : type === 'exception' ? `Ngoại lệ · ${empName}` : `Nghỉ phép · ${empName}`;
  return {
    id: `leave_app_${app.id}`,
    type,
    title: app.reason ? `${defaultTitle} (${app.reason})` : defaultTitle,
    description: app.reason,
    startDate: app.startDate || app.createdAt || '',
    endDate: app.endDate || app.startDate || app.createdAt || '',
    employeeId: app.employeeId,
    employeeName: app.employeeName,
    status: app.status,
  };
}

const HOLIDAY_TYPE_LABELS: Record<HrWorkCalendarDayType, string> = {
  holiday: 'Ngày nghỉ lễ',
  substitute_holiday: 'Ngày nghỉ bù',
  working_override: 'Ngày làm bù',
};

const EMPLOYMENT_STATUS_LABELS = {
  official: 'Chính thức',
  probation: 'Thử việc',
  internship: 'Thực tập',
} as const;

function shiftDateKey(dateKey: string, delta: number): string {
  const d = new Date(`${dateKey}T00:00:00`);
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatViDate(dateKey?: string): string {
  if (!dateKey) return '—';
  const parts = dateKey.slice(0, 10).split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateKey;
}

function formatTime(val?: string | null): string {
  if (!val) return '--:--';
  if (/^\d{2}:\d{2}/.test(val)) return val.slice(0, 5);
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return val;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function HrSchedulePanel({
  companyCode,
  branchId,
  canManageTimekeeping,
  canManageCalendar,
  canEditAttendance,
}: {
  companyCode?: string;
  branchId?: string;
  canManageTimekeeping: boolean;
  canManageCalendar: boolean;
  canEditAttendance: boolean;
}) {
  const [subTab, setSubTab] = useState<ScheduleSubTab>('attendance');

  const tabs = useMemo(
    () =>
      [
        { key: 'attendance' as const, label: 'Chấm công & Lịch', Icon: CalendarCheck, visible: true },
        { key: 'shifts' as const, label: 'Ca làm việc', Icon: Clock3, visible: canManageTimekeeping },
        { key: 'holidays' as const, label: 'Lịch nghỉ lễ', Icon: CalendarDays, visible: canManageCalendar },
        { key: 'hours' as const, label: 'Giờ làm việc riêng', Icon: Users, visible: canManageTimekeeping },
      ].filter((t) => t.visible),
    [canManageCalendar, canManageTimekeeping],
  );

  return (
    <View style={styles.root}>
      {/* Sub-navigation matching web HrScheduleTab */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.subTabScroll}
        contentContainerStyle={styles.subTabRow}
      >
        {tabs.map(({ key, label, Icon }) => {
          const active = subTab === key;
          return (
            <Pressable
              key={key}
              onPress={() => setSubTab(key)}
              style={[styles.subTabPill, active && styles.subTabPillActive]}
            >
              <Icon size={13} color={active ? colors.white : colors.primary} />
              <Text style={[styles.subTabText, active && styles.subTabTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {subTab === 'attendance' ? (
        <AttendanceAndCalendarSection
          companyCode={companyCode}
          branchId={branchId}
          canEditAttendance={canEditAttendance}
          canManageCalendar={canManageCalendar}
        />
      ) : subTab === 'shifts' ? (
        <WorkShiftsSection branchId={branchId} />
      ) : subTab === 'holidays' ? (
        <WorkHolidaysSection branchId={branchId} />
      ) : (
        <EmployeeWorkHoursSection branchId={branchId} />
      )}
    </View>
  );
}

function shortAttendanceStatus(status?: string): string {
  const s = String(status || '').trim();
  const low = s.toLowerCase();
  if (!s) return '';
  if (low === 'present' || low.includes('đúng giờ') || low.includes('đủ')) return 'Đủ';
  if (low === 'late' || low.includes('muộn')) return 'Muộn';
  if (low === 'left-early' || low === 'early' || low.includes('sớm')) return 'Sớm';
  if (low === 'half-day' || low.includes('nửa')) return '0.5';
  if (low === 'incomplete' || low.includes('thiếu chấm')) return 'Thiếu';
  if (low === 'partial' || low.includes('thiếu công')) return 'Thiếu';
  if (low.includes('wfh') || low.includes('tại nhà')) return 'WFH';
  if (low.includes('leave') || low.includes('nghỉ')) return 'Nghỉ';
  if (low === 'absent' || low.includes('vắng')) return 'Vắng';
  return s.slice(0, 6);
}

function calcLogCoeff(log?: HrAttendanceRecord): number {
  if (!log) return 0;
  const st = String(log.attendanceStatus || log.status || '').toLowerCase();
  if (st === 'absent' || st.includes('vắng')) return 0;
  if (st === 'half-day' || st.includes('nửa')) return 0.5;
  if (st.includes('approved-leave') || st.includes('approved-wfh')) return 1;
  if (typeof log.workHours === 'number' && Number.isFinite(log.workHours) && log.workHours > 0) {
    if (log.workHours >= 7) return 1;
    if (log.workHours >= 3.5) return 0.5;
    return Number((log.workHours / 8).toFixed(2));
  }
  if (log.checkIn || log.checkInTime) {
    if (st === 'incomplete') return 0.5;
    return 1;
  }
  return 0;
}

const DOW_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const;

// =========================================================================
// 1. CHẤM CÔNG & LỊCH LÀM VIỆC
// =========================================================================
function AttendanceAndCalendarSection({
  companyCode,
  branchId,
  canEditAttendance,
  canManageCalendar,
}: {
  companyCode?: string;
  branchId?: string;
  canEditAttendance: boolean;
  canManageCalendar: boolean;
}) {
  const { user } = useAuth();
  const [mode, setMode] = useState<'monthly' | 'calendar'>('monthly');
  const today = useMemo(() => getTodayKey(), []);
  const [monthlyLogs, setMonthlyLogs] = useState<HrAttendanceRecord[]>([]);
  const [monthlyEmployees, setMonthlyEmployees] = useState<HrAttendanceRosterEntry[]>([]);
  const [monthlyDate, setMonthlyDate] = useState(() => new Date());
  const [monthlySearch, setMonthlySearch] = useState('');
  const [cellMode, setCellMode] = useState<'coeff' | 'hours'>('coeff');
  const [events, setEvents] = useState<HrCalendarEvent[]>([]);
  const [holidays, setHolidays] = useState<HrWorkCalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const histYear = monthlyDate.getFullYear();
  const histMonth = monthlyDate.getMonth() + 1; // 1-12
  const daysInHistMonth = useMemo(() => new Date(histYear, histMonth, 0).getDate(), [histMonth, histYear]);
  const dayColumns = useMemo(
    () => Array.from({ length: daysInHistMonth }, (_, idx) => idx + 1),
    [daysInHistMonth],
  );

  // Calendar month state
  const [calMonthDate, setCalMonthDate] = useState(() => new Date());
  const calYear = calMonthDate.getFullYear();
  const calMonth = calMonthDate.getMonth(); // 0-11
  const holidaySyncAttempts = useRef(new Set<string>());
  const [pickedDayKey, setPickedDayKey] = useState(today);
  const [calFilterType, setCalFilterType] = useState<'all' | HrCalendarEventType>('all');
  const [calListScope, setCalListScope] = useState<'day' | 'month'>('month');

  const navigateCalMonth = useCallback(
    (delta: number) => {
      const next = new Date(calYear, calMonth + delta, 1);
      setCalMonthDate(next);
      const nextYm = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
      setPickedDayKey(today.startsWith(nextYm) ? today : `${nextYm}-01`);
    },
    [calMonth, calYear, today],
  );

  // Create calendar event modal
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [evTitle, setEvTitle] = useState('');
  const [evType, setEvType] = useState<HrCalendarEventType>('event');
  const [evStart, setEvStart] = useState(today);
  const [evEnd, setEvEnd] = useState(today);
  const [evDesc, setEvDesc] = useState('');
  const [savingEv, setSavingEv] = useState(false);

  // Edit attendance modal
  const [editingRec, setEditingRec] = useState<HrAttendanceRecord | null>(null);
  const [editIn, setEditIn] = useState('');
  const [editOut, setEditOut] = useState('');
  const [editNote, setEditNote] = useState('');
  const [savingRec, setSavingRec] = useState(false);

  const loadCalendar = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const [evList, holResult, leaveApps] = await Promise.all([
          listHrCalendarEvents(companyCode, branchId).catch(() => [] as HrCalendarEvent[]),
          listHrWorkCalendar(calYear, false, branchId).catch(() => null),
          listLeaveApplications(companyCode, branchId).catch(() => [] as HrLeaveApplication[]),
        ]);

        let holList = holResult ?? [];
        const isCalendarAdmin = user?.role === 'admin' || user?.role === 'superadmin';
        const syncKey = `system-holidays-v2:${companyCode || ''}:${calYear}`;
        if (
          holResult !== null &&
          !holResult.some((day) => day.source === 'system') &&
          companyCode &&
          isCalendarAdmin &&
          !holidaySyncAttempts.current.has(syncKey)
        ) {
          holidaySyncAttempts.current.add(syncKey);
          try {
            const synced = await syncHrWorkCalendar(calYear, branchId);
            const refreshed = await listHrWorkCalendar(calYear, false, branchId).catch(() => []);
            const merged = new Map<string, HrWorkCalendarDay>();
            for (const day of [...refreshed, ...synced]) {
              merged.set(day._id || `${day.date}:${day.source}:${day.name}`, day);
            }
            holList = [...merged.values()];
            if (!holList.some((day) => day.source === 'system')) {
              throw new Error(`API đồng bộ không trả về ngày nghỉ lễ hệ thống cho năm ${calYear}.`);
            }
          } catch (syncError) {
            holidaySyncAttempts.current.delete(syncKey);
            Alert.alert(
              'Không đồng bộ được lịch nghỉ lễ',
              syncError instanceof Error ? syncError.message : 'Vui lòng thử lại sau.',
            );
          }
        }

        // Exclude unapproved / rejected / cancelled calendar items (matching Web ERP)
        const activeEvents = evList.filter((ev) => {
          const st = String(ev.status || '').toLowerCase();
          return st !== 'pending' && st !== 'rejected' && st !== 'cancelled';
        });

        // Merge approved leave/WFH applications that are not already in hr-calendar-events
        const seenKeys = new Set(
          activeEvents.map((ev) =>
            `${ev.employeeId || ''}|${ev.type}|${normalizeDateKey(ev.startDate)}|${normalizeDateKey(ev.endDate || ev.startDate)}`,
          ),
        );
        const mergedEvents: HrCalendarEvent[] = [...activeEvents];
        for (const app of leaveApps) {
          if (String(app.status || '').toLowerCase() !== 'approved') continue;
          const mapped = mapLeaveAppToCalendarEvent(app);
          const sKey = normalizeDateKey(mapped.startDate);
          const eKey = normalizeDateKey(mapped.endDate || mapped.startDate);
          if (!sKey) continue;
          const dedupeKey = `${mapped.employeeId || ''}|${mapped.type}|${sKey}|${eKey}`;
          if (!seenKeys.has(dedupeKey)) {
            seenKeys.add(dedupeKey);
            mergedEvents.push(mapped);
          }
        }

        setEvents(mergedEvents);
        setHolidays(holList);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không tải được lịch làm việc.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [branchId, calYear, companyCode, user?.role],
  );

  const loadMonthly = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const mStr = String(histMonth).padStart(2, '0');
        const lastDay = new Date(histYear, histMonth, 0).getDate();
        const startDate = `${histYear}-${mStr}-01`;
        const endDate = `${histYear}-${mStr}-${String(lastDay).padStart(2, '0')}`;
        const [list, empList, holList] = await Promise.all([
          listMonthlyAttendanceLogs({
            companyCode,
            startDate,
            endDate,
            uid: canEditAttendance ? undefined : user?._id || user?.id,
            branchId,
          }),
          canEditAttendance ? listAttendanceRoster(branchId).catch(() => []) : Promise.resolve([]),
          listHrWorkCalendar(histYear, true).catch(() => []),
        ]);
        setMonthlyLogs(list);
        setMonthlyEmployees(empList);
        setHolidays(holList);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không tải được lịch sử chấm công tháng.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [branchId, canEditAttendance, companyCode, histMonth, histYear, user?._id, user?.id],
  );

  useEffect(() => {
    if (mode === 'monthly') void loadMonthly();
    else void loadCalendar();
  }, [loadCalendar, loadMonthly, mode]);

  const onSaveRec = useCallback(async () => {
    if (!editingRec?._id || savingRec) return;
    setSavingRec(true);
    try {
      await updateAttendanceLog(
        editingRec._id,
        {
          checkIn: editIn.trim() || null,
          checkOut: editOut.trim() || null,
          note: editNote.trim(),
        },
        branchId,
      );
      setEditingRec(null);
      Alert.alert('Đã lưu', 'Cập nhật bản ghi chấm công thành công.');
      void loadMonthly(true);
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể cập nhật chấm công.');
    } finally {
      setSavingRec(false);
    }
  }, [branchId, editIn, editNote, editOut, editingRec?._id, loadMonthly, savingRec]);

  const onCreateEvent = useCallback(async () => {
    if (!evTitle.trim() || !companyCode || savingEv) {
      if (!evTitle.trim()) Alert.alert('Thiếu tiêu đề', 'Hãy nhập tiêu đề sự kiện / lịch.');
      return;
    }
    setSavingEv(true);
    try {
      const created = await createHrCalendarEvent({
        companyCode,
        type: evType,
        title: evTitle.trim(),
        description: evDesc.trim() || undefined,
        startDate: evStart || today,
        endDate: evEnd || evStart || today,
        creatorId: user?._id || user?.id,
      }, branchId);
      setEvents((prev) => [created, ...prev]);
      setEventModalOpen(false);
      setEvTitle('');
      setEvDesc('');
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể tạo lịch.');
    } finally {
      setSavingEv(false);
    }
  }, [companyCode, evDesc, evEnd, evStart, evTitle, evType, savingEv, today, user?._id, user?.id]);

  const onDeleteEvent = useCallback((ev: HrCalendarEvent) => {
    showHrConfirm({
      title: 'Xóa mục lịch?',
      message: `Bạn có chắc muốn xóa "${ev.title}"?`,
      confirmLabel: 'Xóa',
      onConfirm: async () => {
        try {
          await deleteHrCalendarEvent(ev.id);
          setEvents((prev) => prev.filter((item) => item.id !== ev.id));
        } catch (err) {
          Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể xóa.');
        }
      },
    });
  }, []);

  // Calendar grid cells (Monday-first)
  const calendarDays = useMemo(() => {
    const firstOfMonth = new Date(calYear, calMonth, 1);
    const startDow = (firstOfMonth.getDay() + 6) % 7; // 0 = Monday
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells: Array<{ key: string; day: number | null }> = [];
    for (let i = 0; i < startDow; i++) cells.push({ key: `pad_${i}`, day: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ key: dateKey, day: d });
    }
    return cells;
  }, [calMonth, calYear]);

  const holidayMap = useMemo(() => {
    const map = new Map<string, HrWorkCalendarDay>();
    for (const h of holidays) {
      const k = normalizeDateKey(h.date);
      if (!k) continue;
      // Prefer applied holiday if multiple exist on the same date (used by monthly attendance table)
      if (!map.has(k) || h.isApplied) map.set(k, h);
    }
    return map;
  }, [holidays]);

  const holidaysByDate = useMemo(() => {
    const map = new Map<string, HrWorkCalendarDay[]>();
    for (const h of holidays) {
      const k = normalizeDateKey(h.date);
      if (!k) continue;
      const list = map.get(k);
      if (list) list.push(h);
      else map.set(k, [h]);
    }
    return map;
  }, [holidays]);

  const filteredCalendarEvents = useMemo(
    () => (calFilterType === 'all' ? events : events.filter((ev) => ev.type === calFilterType)),
    [calFilterType, events],
  );

  const eventsForDay = useCallback(
    (dateKey: string) =>
      filteredCalendarEvents.filter((ev) => {
        const s = normalizeDateKey(ev.startDate);
        const e = normalizeDateKey(ev.endDate) || s;
        if (!s) return false;
        return dateKey >= s && dateKey <= e;
      }),
    [filteredCalendarEvents],
  );

  const calMonthStartKey = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-01`;
  const calMonthEndKey = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(new Date(calYear, calMonth + 1, 0).getDate()).padStart(2, '0')}`;

  const monthAllEvents = useMemo(() => {
    return events
      .filter((ev) => {
        const s = normalizeDateKey(ev.startDate);
        const e = normalizeDateKey(ev.endDate) || s;
        if (!s) return false;
        return s <= calMonthEndKey && e >= calMonthStartKey;
      })
      .sort((a, b) => normalizeDateKey(a.startDate).localeCompare(normalizeDateKey(b.startDate)));
  }, [calMonthEndKey, calMonthStartKey, events]);

  const monthFilteredEvents = useMemo(
    () => (calFilterType === 'all' ? monthAllEvents : monthAllEvents.filter((ev) => ev.type === calFilterType)),
    [calFilterType, monthAllEvents],
  );

  const monthHolidays = useMemo(
    () =>
      holidays
        .filter((h) => {
          const d = normalizeDateKey(h.date);
          return d >= calMonthStartKey && d <= calMonthEndKey;
        })
        .sort((a, b) => normalizeDateKey(a.date).localeCompare(normalizeDateKey(b.date))),
    [calMonthEndKey, calMonthStartKey, holidays],
  );

  const monthTypeCounts = useMemo(() => {
    const counts: Record<HrCalendarEventType, number> = {
      event: 0,
      leave: 0,
      wfh: 0,
      exception: 0,
      reminder: 0,
    };
    for (const ev of monthAllEvents) {
      if (counts[ev.type] !== undefined) counts[ev.type] += 1;
    }
    return counts;
  }, [monthAllEvents]);

  const pickedEvents = useMemo(() => eventsForDay(pickedDayKey), [eventsForDay, pickedDayKey]);
  const pickedHolidays = useMemo(() => holidaysByDate.get(pickedDayKey) ?? [], [holidaysByDate, pickedDayKey]);
  const monthlyRows = useMemo(() => {
    type Row = {
      key: string;
      name: string;
      byDate: Map<string, HrAttendanceRecord>;
      totalCoeff: number;
      totalHours: number;
    };
    const map = new Map<string, Row>();
    const addOrGet = (key: string, name: string): Row => {
      let row = map.get(key);
      if (!row) {
        row = { key, name, byDate: new Map(), totalCoeff: 0, totalHours: 0 };
        map.set(key, row);
      }
      return row;
    };

    for (const emp of monthlyEmployees) {
      const uid = emp.uid || '';
      if (!uid) continue;
      addOrGet(uid, emp.displayName || 'Nhân viên');
    }

    for (const log of monthlyLogs) {
      const key = log.uid || log.employeeId || log.employeeName || 'unknown';
      if (!canEditAttendance && key !== (user?._id || user?.id)) continue;
      const row = addOrGet(
        key,
        log.employeeName || log.displayName || 'Nhân viên',
      );
      const dateKey = (log.date || '').slice(0, 10);
      if (dateKey) row.byDate.set(dateKey, log);
    }

    // Nếu nhân viên thường chưa có log nào, vẫn hiện chính họ
    if (!canEditAttendance && map.size === 0 && user) {
      const uid = user._id || user.id || 'self';
      addOrGet(uid, user.displayName || 'Tôi');
    }

    const q = monthlySearch.trim().toLowerCase();
    const list: Row[] = [];
    for (const row of map.values()) {
      if (
        q &&
        !row.name.toLowerCase().includes(q)
      ) {
        continue;
      }
      let coeffSum = 0;
      let hoursSum = 0;
      for (const log of row.byDate.values()) {
        coeffSum += calcLogCoeff(log);
        if (typeof log.workHours === 'number' && Number.isFinite(log.workHours)) {
          hoursSum += log.workHours;
        }
      }
      row.totalCoeff = Number(coeffSum.toFixed(2));
      row.totalHours = Number(hoursSum.toFixed(1));
      list.push(row);
    }
    return list.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [canEditAttendance, monthlyEmployees, monthlyLogs, monthlySearch, user]);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            if (mode === 'monthly') void loadMonthly(true);
            else void loadCalendar(true);
          }}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      {/* Toggle between Lịch sử tháng (Bảng công) & Lịch tháng */}
      <View style={styles.segmentRow}>
        <Pressable
          onPress={() => setMode('monthly')}
          style={[styles.segmentBtn, mode === 'monthly' && styles.segmentBtnActive]}
        >
          <Text style={[styles.segmentText, mode === 'monthly' && styles.segmentTextActive]}>
            Lịch sử chấm công
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode('calendar')}
          style={[styles.segmentBtn, mode === 'calendar' && styles.segmentBtnActive]}
        >
          <Text style={[styles.segmentText, mode === 'calendar' && styles.segmentTextActive]}>
            Lịch tháng
          </Text>
        </Pressable>
      </View>

      {mode === 'monthly' ? (
        <>
          {/* Month Navigator + Coeff/Hours toggle */}
          <View style={[styles.headRow, { marginBottom: 10 }]}>
            <Card style={[styles.dateBar, { flex: 1, marginBottom: 0 }]}>
              <Pressable
                onPress={() => setMonthlyDate(new Date(histYear, histMonth - 2, 1))}
                style={styles.iconBtn}
              >
                <ChevronLeft size={16} color={colors.primary} />
              </Pressable>
              <Text style={styles.dateBarText}>
                Tháng {histMonth}/{histYear}
              </Text>
              <Pressable
                onPress={() => setMonthlyDate(new Date(histYear, histMonth, 1))}
                style={styles.iconBtn}
              >
                <ChevronRight size={16} color={colors.primary} />
              </Pressable>
            </Card>
            <View style={styles.modeToggle}>
              <Pressable
                onPress={() => setCellMode('coeff')}
                style={[styles.modeToggleBtn, cellMode === 'coeff' && styles.modeToggleActive]}
              >
                <Text style={[styles.modeToggleText, cellMode === 'coeff' && styles.modeToggleTextActive]}>
                  Công
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setCellMode('hours')}
                style={[styles.modeToggleBtn, cellMode === 'hours' && styles.modeToggleActive]}
              >
                <Text style={[styles.modeToggleText, cellMode === 'hours' && styles.modeToggleTextActive]}>
                  Giờ
                </Text>
              </Pressable>
            </View>
          </View>

          {canEditAttendance ? (
            <TextInput
              value={monthlySearch}
              onChangeText={setMonthlySearch}
              placeholder="Tìm nhân viên theo tên..."
              placeholderTextColor="#94A3B8"
              style={[styles.searchField, { marginBottom: 12 }]}
            />
          ) : null}

          {loading ? (
            <Card style={styles.stateCard}>
              <ActivityIndicator size="small" color={colors.primary} />
            </Card>
          ) : error ? (
            <Card style={styles.stateCard}>
              <PopupError error={error} />
              <Pressable onPress={() => void loadMonthly()} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>Thử lại</Text>
              </Pressable>
            </Card>
          ) : !monthlyRows.length ? (
            <View style={styles.stateCard}>
              <IgenHrEmptyState message={`Không có dữ liệu bảng công Tháng ${histMonth}/${histYear}.`} />
            </View>
          ) : (
            <View style={[styles.tableWrap, styles.tableContentRow]}>
              {/* Frozen Left Columns: # | Họ và Tên | Số công */}
              <View style={styles.tableLeft}>
                <View style={[styles.tableHeaderRow, styles.tableHeaderLeft]}>
                  <Text style={[styles.thText, { width: 24, textAlign: 'center' }]}>#</Text>
                  <Text style={[styles.thText, { flex: 1, paddingHorizontal: 4 }]} numberOfLines={1}>
                    Họ và Tên
                  </Text>
                  <Text style={[styles.thText, styles.thTotalCol]}>
                    {cellMode === 'coeff' ? 'Công' : 'Giờ'}
                  </Text>
                </View>

                {monthlyRows.map((row, rIdx) => (
                  <View
                    key={row.key}
                    style={[styles.tableBodyRow, rIdx % 2 === 1 && styles.tableRowAlt]}
                  >
                    <Text style={styles.tdIndex}>{rIdx + 1}</Text>
                    <View style={styles.tdNameWrap}>
                      <Text numberOfLines={1} style={styles.tdName}>
                        {row.name}
                      </Text>
                    </View>
                    <View style={styles.tdTotalCol}>
                      <Text style={styles.tdTotalVal}>
                        {cellMode === 'coeff' ? row.totalCoeff : `${row.totalHours}h`}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* Scrollable Day Columns 1..daysInMonth */}
              <ScrollView
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator
                style={{ flex: 1 }}
              >
                  {/* Day Columns 1..daysInMonth */}
                  <View>
                    {/* Day Header Row */}
                    <View style={styles.tableHeaderRow}>
                      {dayColumns.map((day) => {
                        const dObj = new Date(histYear, histMonth - 1, day);
                        const dow = dObj.getDay();
                        const dateStr = `${histYear}-${String(histMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const hol = holidayMap.get(dateStr);
                        const isWeekend =
                          hol && hol.isApplied
                            ? hol.dayType !== 'working_override'
                            : dow === 0 || dow === 6;
                        const isToday = dateStr === today;
                        return (
                          <View
                            key={day}
                            style={[
                              styles.dayHeaderCell,
                              isWeekend && styles.dayHeaderWeekend,
                              isToday && styles.dayHeaderToday,
                            ]}
                          >
                            <Text style={[styles.dayDowText, isToday && { color: colors.primary }]}>
                              {DOW_SHORT[dow]}
                            </Text>
                            <Text
                              style={[
                                styles.dayNumText,
                                isWeekend && { color: '#64748B' },
                                isToday && { color: colors.primary },
                              ]}
                            >
                              {day}
                            </Text>
                          </View>
                        );
                      })}
                    </View>

                    {/* Employee Day Rows */}
                    {monthlyRows.map((row, rIdx) => (
                      <View
                        key={row.key}
                        style={[styles.tableBodyRow, rIdx % 2 === 1 && styles.tableRowAlt]}
                      >
                        {dayColumns.map((day) => {
                          const dObj = new Date(histYear, histMonth - 1, day);
                          const dow = dObj.getDay();
                          const dateStr = `${histYear}-${String(histMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                          const hol = holidayMap.get(dateStr);
                          const isWeekend =
                            hol && hol.isApplied
                              ? hol.dayType !== 'working_override'
                              : dow === 0 || dow === 6;
                          const isFuture = dateStr > today;
                          const isToday = dateStr === today;
                          const log = row.byDate.get(dateStr);

                          if (isWeekend && !log) {
                            return (
                              <View key={day} style={[styles.dayCell, styles.dayCellWeekend]}>
                                <Text style={styles.dayCellDash}>—</Text>
                              </View>
                            );
                          }
                          if (isFuture && !log) {
                            return (
                              <View key={day} style={[styles.dayCell, isToday && styles.dayCellToday]}>
                                <Text style={styles.dayCellDot}>·</Text>
                              </View>
                            );
                          }

                          const coeff = calcLogCoeff(log);
                          const isFull = coeff >= 1;
                          const isAbsent = coeff === 0;
                          const statusTxt = shortAttendanceStatus(log?.attendanceStatus || log?.status);
                          const cellColor = isAbsent
                            ? '#DC2626'
                            : isFull
                              ? '#059669'
                              : '#D97706';

                          return (
                            <Pressable
                              key={day}
                              disabled={!canEditAttendance && row.key !== (user?._id || user?.id)}
                              onPress={() => {
                                if (!log) return;
                                const ci = formatTime(log.checkIn || log.checkInTime);
                                const co = formatTime(log.checkOut || log.checkOutTime);
                                if (canEditAttendance && log._id) {
                                  setEditingRec(log);
                                  setEditIn(ci === '--:--' ? '' : ci);
                                  setEditOut(co === '--:--' ? '' : co);
                                  setEditNote(log.note || '');
                                } else if (canEditAttendance || row.key === (user?._id || user?.id)) {
                                  Alert.alert(
                                    `${row.name} · ${formatViDate(dateStr)}`,
                                    `Giờ vào: ${ci}\nGiờ ra: ${co}\nTrạng thái: ${log.attendanceStatus || log.status || '—'}\nHệ số công: ${coeff}`,
                                  );
                                }
                              }}
                              style={[styles.dayCell, isToday && styles.dayCellToday]}
                            >
                              <Text style={[styles.dayCellVal, { color: cellColor }]}>
                                {cellMode === 'coeff'
                                  ? coeff === 1
                                    ? '1'
                                    : coeff === 0
                                      ? '0'
                                      : String(coeff)
                                  : log?.workHours && log.workHours > 0
                                    ? `${log.workHours}h`
                                    : isFull
                                      ? '8h'
                                      : '0h'}
                              </Text>
                              {statusTxt ? (
                                <Text numberOfLines={1} style={[styles.dayCellStatus, { color: cellColor }]}>
                                  {statusTxt}
                                </Text>
                              ) : null}
                            </Pressable>
                          );
                        })}
                      </View>
                    ))}
                  </View>
              </ScrollView>
            </View>
          )}
        </>
      ) : (
        <>
          {/* Month Navigator */}
          <View style={styles.headRow}>
            <Card style={[styles.dateBar, { flex: 1, marginBottom: 0 }]}>
              <Pressable
                onPress={() => navigateCalMonth(-1)}
                style={styles.iconBtn}
              >
                <ChevronLeft size={16} color={colors.primary} />
              </Pressable>
              <Text style={styles.dateBarText}>
                Tháng {calMonth + 1}/{calYear}
              </Text>
              <Pressable
                onPress={() => navigateCalMonth(1)}
                style={styles.iconBtn}
              >
                <ChevronRight size={16} color={colors.primary} />
              </Pressable>
            </Card>
          </View>

          {/* Monthly Type Filter & Count Pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, marginTop: 10 }}
            contentContainerStyle={{ gap: 6, paddingRight: 4 }}
          >
            <Pressable
              onPress={() => setCalFilterType('all')}
              style={[styles.chip, calFilterType === 'all' && styles.chipActive]}
            >
              <Text style={[styles.chipText, calFilterType === 'all' && styles.chipTextActive]}>
                Tất cả ({monthAllEvents.length})
              </Text>
            </Pressable>
            {(['event', 'leave', 'wfh', 'exception', 'reminder'] as const).map((t) => {
              const active = calFilterType === t;
              const palette = EVENT_TYPE_COLORS[t];
              return (
                <Pressable
                  key={t}
                  onPress={() => setCalFilterType(t)}
                  style={[
                    styles.chip,
                    { flexDirection: 'row', alignItems: 'center', gap: 5 },
                    active && styles.chipActive,
                  ]}
                >
                  <View style={[styles.dot, { backgroundColor: active ? colors.white : palette.dot, width: 6, height: 6, borderRadius: 3 }]} />
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {EVENT_TYPE_LABELS[t]} ({monthTypeCounts[t]})
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* 7-column Calendar Grid */}
          <Card style={styles.calCard}>
            <View style={styles.calHeaderRow}>
              {DAYS_OF_WEEK.map((d) => (
                <Text key={d.v} style={styles.calHeaderText}>
                  {d.l}
                </Text>
              ))}
            </View>
            <View style={styles.calGrid}>
              {calendarDays.map((cell) => {
                if (!cell.day) return <View key={cell.key} style={styles.calCell} />;
                const isSelected = cell.key === pickedDayKey;
                const isToday = cell.key === today;
                const hasHoliday = holidayMap.has(cell.key);
                const dayEvs = eventsForDay(cell.key);
                const uniqueTypes = Array.from(new Set(dayEvs.map((ev) => ev.type))).slice(0, 3);
                return (
                  <Pressable
                    key={cell.key}
                    onPress={() => {
                      setPickedDayKey(cell.key);
                      setCalListScope('day');
                    }}
                    style={[
                      styles.calCell,
                      isToday && styles.calCellToday,
                      isSelected && styles.calCellSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.calDayNum,
                        hasHoliday && !isSelected && { color: '#DC2626' },
                        isSelected && { color: colors.white },
                      ]}
                    >
                      {cell.day}
                    </Text>
                    <View style={styles.dotRow}>
                      {hasHoliday ? <View style={[styles.dot, { backgroundColor: isSelected ? '#FECACA' : '#EF4444' }]} /> : null}
                      {uniqueTypes.map((type) => (
                        <View
                          key={type}
                          style={[
                            styles.dot,
                            { backgroundColor: isSelected ? colors.white : (EVENT_TYPE_COLORS[type]?.dot || colors.primary) },
                          ]}
                        />
                      ))}
                      {dayEvs.length > 3 ? (
                        <Text style={[styles.calMoreText, isSelected && { color: colors.white }]}>+</Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Card>

          {/* Scope switcher: Picked Day vs Full Month */}
          <View style={styles.segmentRow}>
            <Pressable
              onPress={() => setCalListScope('month')}
              style={[styles.segmentBtn, calListScope === 'month' && styles.segmentBtnActive]}
            >
              <Text style={[styles.segmentText, calListScope === 'month' && styles.segmentTextActive]}>
                Cả tháng {calMonth + 1}/{calYear} ({monthFilteredEvents.length + monthHolidays.length})
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setCalListScope('day')}
              style={[styles.segmentBtn, calListScope === 'day' && styles.segmentBtnActive]}
            >
              <Text style={[styles.segmentText, calListScope === 'day' && styles.segmentTextActive]}>
                Ngày {formatViDate(pickedDayKey)} ({pickedEvents.length + pickedHolidays.length})
              </Text>
            </Pressable>
          </View>

          {(() => {
            const visibleHolidays = calListScope === 'month' ? monthHolidays : pickedHolidays;
            const visibleEvents = calListScope === 'month' ? monthFilteredEvents : pickedEvents;
            if (!visibleHolidays.length && !visibleEvents.length) {
              return (
                <View style={styles.stateCard}>
                  <IgenHrEmptyState
                    message={
                      calListScope === 'month'
                        ? `Không có lịch trình hoặc sự kiện nào trong tháng ${calMonth + 1}/${calYear}.`
                        : `Không có sự kiện hoặc lịch trình nào trong ngày ${formatViDate(pickedDayKey)}.`
                    }
                  />
                </View>
              );
            }
            return (
              <View style={styles.list}>
                {visibleHolidays.map((hol) => (
                  <Card
                    key={hol._id || `${hol.date}-${hol.name}`}
                    style={[
                      styles.listItem,
                      { backgroundColor: '#FEF2F2' },
                      !hol.isApplied && { opacity: 0.65 },
                    ]}
                  >
                    <View style={styles.headRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.badgeInfo, { backgroundColor: '#FEE2E2', color: '#B91C1C' }]}>
                          {HOLIDAY_TYPE_LABELS[hol.dayType]}
                        </Text>
                        <Text style={styles.badgeNeutral}>
                          {hol.source === 'system' ? 'Hệ thống' : 'Admin'}
                        </Text>
                        {!hol.isApplied ? (
                          <Text style={styles.badgeNeutral}>Đã tắt</Text>
                        ) : null}
                      </View>
                      <Text style={[styles.subMeta, { color: '#B91C1C', fontWeight: '700' }]}>{formatViDate(hol.date)}</Text>
                    </View>
                    <Text style={[styles.rowTitle, { color: '#991B1B' }]}>{hol.name}</Text>
                  </Card>
                ))}
                {visibleEvents.map((ev) => {
                  const palette = EVENT_TYPE_COLORS[ev.type] || EVENT_TYPE_COLORS.event;
                  const sKey = normalizeDateKey(ev.startDate);
                  const eKey = normalizeDateKey(ev.endDate) || sKey;
                  const sClock = formatEventClock(ev.startDate);
                  const eClock = formatEventClock(ev.endDate);
                  const clockText = sClock ? (eClock && eClock !== sClock ? `${sClock} – ${eClock}` : sClock) : '';
                  const isMergedLeave = ev.id.startsWith('leave_app_');
                  return (
                    <Card key={ev.id} style={styles.listItem}>
                      <View style={styles.headRow}>
                        <Text style={[styles.badgeInfo, { backgroundColor: palette.bg, color: palette.fg }]}>
                          {EVENT_TYPE_LABELS[ev.type] || ev.type}
                        </Text>
                        {!isMergedLeave && (canManageCalendar || ev.creatorId === (user?._id || user?.id)) ? (
                          <Pressable onPress={() => onDeleteEvent(ev)} hitSlop={8}>
                            <Trash2 size={14} color="#B91C1C" />
                          </Pressable>
                        ) : null}
                      </View>
                      <Text style={styles.rowTitle}>{ev.title}</Text>
                      <Text style={styles.subMeta}>
                        {formatViDate(sKey)}
                        {eKey && eKey !== sKey ? ` → ${formatViDate(eKey)}` : ''}
                        {clockText ? ` · ${clockText}` : ''}
                        {ev.employeeName ? ` · ${ev.employeeName}` : ''}
                      </Text>
                      {ev.description ? <Text style={styles.muted}>{ev.description}</Text> : null}
                    </Card>
                  );
                })}
              </View>
            );
          })()}
        </>
      )}

      {/* Edit attendance full-screen page */}
      <FullScreenFormModal
        visible={Boolean(editingRec)}
        title="Chỉnh sửa chấm công"
        cancelLabel="Hủy"
        onSave={() => void onSaveRec()}
        saving={savingRec}
        onClose={() => setEditingRec(null)}
      >
        <View>
          <HrFormSectionTitle title="Thông tin chấm công" />
          <View style={{ paddingVertical: 10 }}>
            <Text style={styles.muted}>
              {editingRec?.employeeName || editingRec?.displayName} · {formatViDate(editingRec?.date)}
            </Text>
          </View>
          <HrFormInputRow label="Giờ vào (HH:mm)" value={editIn} onChangeText={setEditIn} placeholder="08:30" />
          <HrFormInputRow label="Giờ ra (HH:mm)" value={editOut} onChangeText={setEditOut} placeholder="17:30" />
          <HrFormInputRow label="Ghi chú" value={editNote} onChangeText={setEditNote} placeholder="Lý do điều chỉnh..." last />
        </View>
      </FullScreenFormModal>

      {/* Create Calendar Event full-screen page */}
      <FullScreenFormModal
        visible={eventModalOpen}
        title="Thêm lịch làm việc"
        cancelLabel="Hủy"
        onSave={() => void onCreateEvent()}
        saving={savingEv}
        onClose={() => setEventModalOpen(false)}
      >
        <View>
          <HrFormSectionTitle title="Thông tin lịch làm việc" />
          <HrFormSelectRow
            label="Loại lịch"
            sheetTitle="Chọn loại lịch"
            value={evType}
            options={(Object.keys(EVENT_TYPE_LABELS) as HrCalendarEventType[]).map((t) => ({
              value: t,
              label: EVENT_TYPE_LABELS[t],
            }))}
            onSelect={(val) => setEvType(val as HrCalendarEventType)}
          />
          <HrFormInputRow label="Tiêu đề *" value={evTitle} onChangeText={setEvTitle} placeholder="VD: Họp giao ban đầu tuần" />
          <HrFormInputRow label="Từ ngày (YYYY-MM-DD)" value={evStart} onChangeText={setEvStart} placeholder="YYYY-MM-DD" />
          <HrFormInputRow label="Đến ngày (YYYY-MM-DD)" value={evEnd} onChangeText={setEvEnd} placeholder="YYYY-MM-DD" />
          <HrFormInputRow label="Mô tả" value={evDesc} onChangeText={setEvDesc} multiline placeholder="Ghi chú chi tiết..." last />
        </View>
      </FullScreenFormModal>

    </ScrollView>
  );
}

// =========================================================================
// 2. CA LÀM VIỆC & PHÂN CA
// =========================================================================
function WorkShiftsSection({ branchId }: { branchId?: string }) {
  const [shifts, setShifts] = useState<HrWorkShift[]>([]);
  const [employees, setEmployees] = useState<HrShiftAssignmentEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<HrWorkShift | 'new' | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('17:00');
  const [lunchStart, setLunchStart] = useState('12:00');
  const [lunchEnd, setLunchEnd] = useState('13:00');
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTimePicker, setActiveTimePicker] = useState<{
    target: 'startTime' | 'endTime' | 'lunchStart' | 'lunchEnd';
    value: Date;
  } | null>(null);

  // Assignment
  const [assignShiftId, setAssignShiftId] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(() => getTodayKey());
  const [activeEffectiveDatePicker, setActiveEffectiveDatePicker] = useState<Date | null>(null);
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);

  const shiftMap = useMemo(() => new Map(shifts.map((s) => [s._id, s])), [shifts]);

  const openShiftTimePicker = (target: 'startTime' | 'endTime' | 'lunchStart' | 'lunchEnd') => {
    const currentValue = { startTime, endTime, lunchStart, lunchEnd }[target];
    const [hour, minute] = currentValue.split(':').map(Number);
    const value = new Date();
    value.setHours(Number.isFinite(hour) ? hour : 8, Number.isFinite(minute) ? minute : 0, 0, 0);

    if (Platform.OS !== 'android') {
      setActiveTimePicker({ target, value });
      return;
    }

    DateTimePickerAndroid.open({
      value,
      mode: 'time',
      display: 'clock',
      is24Hour: true,
      onChange: (event, selectedTime) => {
        if (event.type !== 'set' || !selectedTime) return;
        const formattedTime = `${String(selectedTime.getHours()).padStart(2, '0')}:${String(selectedTime.getMinutes()).padStart(2, '0')}`;
        if (target === 'startTime') setStartTime(formattedTime);
        else if (target === 'endTime') setEndTime(formattedTime);
        else if (target === 'lunchStart') setLunchStart(formattedTime);
        else setLunchEnd(formattedTime);
      },
    });
  };

  const savePickedShiftTime = () => {
    if (!activeTimePicker) return;
    const { target, value } = activeTimePicker;
    const formattedTime = `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
    if (target === 'startTime') setStartTime(formattedTime);
    else if (target === 'endTime') setEndTime(formattedTime);
    else if (target === 'lunchStart') setLunchStart(formattedTime);
    else setLunchEnd(formattedTime);
    setActiveTimePicker(null);
  };

  const openEffectiveDatePicker = () => {
    const [year, month, day] = effectiveFrom.split('-').map(Number);
    const hasValidDate = /^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom);
    const value = hasValidDate ? new Date(year, month - 1, day, 12) : new Date();

    if (Platform.OS !== 'android') {
      setActiveEffectiveDatePicker(value);
      return;
    }

    DateTimePickerAndroid.open({
      value,
      mode: 'date',
      display: 'calendar',
      onChange: (event, selectedDate) => {
        if (event.type === 'set' && selectedDate) setEffectiveFrom(toDateKey(selectedDate));
      },
    });
  };

  const savePickedEffectiveDate = () => {
    if (!activeEffectiveDatePicker) return;
    setEffectiveFrom(toDateKey(activeEffectiveDatePicker));
    setActiveEffectiveDatePicker(null);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sList, eList] = await Promise.all([
        listHrWorkShifts(branchId),
        listHrShiftAssignments(branchId),
      ]);
      setShifts(sList);
      setEmployees(eList);
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không tải được ca làm việc.');
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openEditor = (shift?: HrWorkShift) => {
    setEditing(shift || 'new');
    setCode(shift?.code || '');
    setName(shift?.name || '');
    setStartTime(shift?.startTime || '08:00');
    setEndTime(shift?.endTime || '17:00');
    setLunchStart(shift?.breakPeriods?.[0]?.startTime || '12:00');
    setLunchEnd(shift?.breakPeriods?.[0]?.endTime || '13:00');
    setWorkingDays(shift?.workingDays?.length ? shift.workingDays : [1, 2, 3, 4, 5]);
    setIsDefault(Boolean(shift?.isDefault));
  };

  const onSaveShift = async () => {
    if (!code.trim() || !name.trim() || !workingDays.length) {
      Alert.alert('Thiếu thông tin', 'Nhập Mã ca, Tên ca và chọn ít nhất 1 ngày làm việc.');
      return;
    }
    setSaving(true);
    try {
      await saveHrWorkShift(
        {
          code: code.trim().toUpperCase(),
          name: name.trim(),
          color: editing !== 'new' && editing ? editing.color : '#2563EB',
          startTime,
          endTime,
          crossesMidnight: endTime <= startTime,
          workingDays,
          isDefault,
          isActive: true,
          breakPeriods:
            lunchStart && lunchEnd
              ? [{ name: 'Nghỉ giữa ca', startTime: lunchStart, endTime: lunchEnd, paid: false }]
              : [],
        },
        editing !== 'new' && editing ? editing._id : undefined,
        branchId,
      );
      setEditing(null);
      Alert.alert('Thành công', 'Đã lưu ca làm việc.');
      void load();
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể lưu ca làm việc.');
    } finally {
      setSaving(false);
    }
  };

  const onAssign = async () => {
    if (!assignShiftId || !selectedEmpIds.length) {
      Alert.alert('Thiếu thông tin', 'Hãy chọn ca làm việc và ít nhất 1 nhân viên.');
      return;
    }
    const shift = shiftMap.get(assignShiftId);
    if (!shift) return;
    setAssigning(true);
    try {
      await assignHrWorkShift(
        {
          employeeIds: selectedEmpIds,
          shiftId: assignShiftId,
          effectiveFrom,
          daysOfWeek: shift.workingDays,
        },
        branchId,
      );
      setSelectedEmpIds([]);
      Alert.alert('Thành công', `Đã phân ca cho ${selectedEmpIds.length} nhân viên.`);
      void load();
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể phân ca.');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 92 }]} showsVerticalScrollIndicator={false}>
      <View style={[styles.headRow, { marginBottom: 10 }]}>
        <Text style={styles.sectionTitle}>Danh sách ca làm việc ({shifts.length})</Text>
      </View>

      {loading ? (
        <Card style={styles.stateCard}>
          <ActivityIndicator size="small" color={colors.primary} />
        </Card>
      ) : !shifts.length ? (
        <View style={styles.stateCard}>
          <IgenHrEmptyState message="Chưa có ca làm việc nào. Giờ chung của công ty vẫn đang áp dụng." />
        </View>
      ) : (
        <View style={styles.list}>
          {shifts.map((s) => (
            <Card key={s._id} style={styles.listItem}>
              <View style={styles.headRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <View style={[styles.colorDot, { backgroundColor: s.color || colors.primary }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{s.name}</Text>
                    <Text style={styles.subMeta}>
                      {s.code}
                      {s.isDefault ? ' · MẶC ĐỊNH' : ''}
                    </Text>
                  </View>
                </View>
                <Pressable onPress={() => openEditor(s)} style={styles.iconBtn}>
                  <Pencil size={14} color={colors.primary} />
                </Pressable>
              </View>
              <Text style={styles.muted}>
                ⏱ {s.startTime} – {s.endTime}
                {s.crossesMidnight ? ' (+1 ngày)' : ''} · 👥 {s.employeeCount || 0} nhân viên
              </Text>
            </Card>
          ))}
        </View>
      )}

      {/* Phân ca nhân viên */}
      <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Phân ca nhân viên</Text>
      <Card style={[styles.card, { gap: 8, marginBottom: 10 }]}>
        <Text style={styles.label}>Chọn ca áp dụng</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {shifts
            .filter((s) => s.isActive !== false)
            .map((s) => (
              <Pressable
                key={s._id}
                onPress={() => setAssignShiftId(s._id)}
                style={[styles.chip, assignShiftId === s._id && styles.chipActive]}
              >
                <Text style={[styles.chipText, assignShiftId === s._id && styles.chipTextActive]}>
                  {s.name}
                </Text>
              </Pressable>
            ))}
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Hiệu lực từ</Text>
            <Pressable
              accessibilityRole="button"
              onPress={openEffectiveDatePicker}
              style={styles.pickerField}
            >
              <Text style={styles.pickerFieldText}>{formatViDate(effectiveFrom)}</Text>
              <CalendarDays size={15} color={colors.primary} />
            </Pressable>
          </View>
          <Pressable
            disabled={assigning || !selectedEmpIds.length || !assignShiftId}
            onPress={() => void onAssign()}
            style={[
              styles.primaryBtn,
              { minHeight: 38, justifyContent: 'center' },
              (assigning || !selectedEmpIds.length || !assignShiftId) && styles.disabled,
            ]}
          >
            <Text style={styles.primaryBtnText}>
              {assigning ? 'Đang gán...' : `Gán (${selectedEmpIds.length})`}
            </Text>
          </Pressable>
        </View>
        <View style={styles.wrapRow}>
          <Pressable
            onPress={() => setSelectedEmpIds(employees.map((e) => e._id))}
            style={styles.chip}
          >
            <Text style={styles.chipText}>Chọn tất cả ({employees.length})</Text>
          </Pressable>
          <Pressable
            onPress={() => setSelectedEmpIds(employees.filter((e) => !e.assignment).map((e) => e._id))}
            style={styles.chip}
          >
            <Text style={styles.chipText}>Chưa có ca</Text>
          </Pressable>
          {selectedEmpIds.length > 0 ? (
            <Pressable onPress={() => setSelectedEmpIds([])} style={styles.chip}>
              <Text style={[styles.chipText, { color: '#B91C1C' }]}>Bỏ chọn</Text>
            </Pressable>
          ) : null}
        </View>
      </Card>

      <View style={styles.list}>
        {employees.map((emp) => {
          const checked = selectedEmpIds.includes(emp._id);
          const currentShift = emp.assignment ? shiftMap.get(emp.assignment.shiftId)?.name : 'Ca mặc định';
          return (
            <Card
              key={emp._id}
              onPress={() =>
                setSelectedEmpIds((prev) =>
                  prev.includes(emp._id) ? prev.filter((id) => id !== emp._id) : [...prev, emp._id],
                )
              }
              style={[styles.listItem, checked && { backgroundColor: '#F0F7FF' }]}
            >
              <View style={styles.headRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{emp.displayName || emp.email}</Text>
                  <Text style={styles.subMeta}>
                    {emp.department || 'Chưa phân phòng'} · {currentShift}
                  </Text>
                </View>
                <Text style={{ color: checked ? colors.primary : colors.muted, fontWeight: '800' }}>
                  {checked ? '☑' : '☐'}
                </Text>
              </View>
            </Card>
          );
        })}
      </View>

      {/* Edit / Create Shift Full-Screen Page */}
      <FullScreenFormModal
        visible={Boolean(editing)}
        title={editing === 'new' ? 'Thêm ca làm việc' : 'Chỉnh sửa ca làm việc'}
        cancelLabel="Hủy"
        onSave={() => void onSaveShift()}
        saving={saving}
        onClose={() => setEditing(null)}
      >
        <View>
          <HrFormSectionTitle title="Thông tin ca làm việc" />
          <HrFormInputRow label="Mã ca *" value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="CA_SANG" />
          <HrFormInputRow label="Tên ca *" value={name} onChangeText={setName} placeholder="Ca hành chính" />
          <HrFormCustomRow label="Giờ bắt đầu">
            <Pressable accessibilityRole="button" onPress={() => openShiftTimePicker('startTime')} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 }}>
              <Text style={{ color: '#111827', fontSize: 15, fontWeight: '500' }}>{startTime}</Text>
              <Clock3 size={16} color="#9CA3AF" />
            </Pressable>
          </HrFormCustomRow>
          <HrFormCustomRow label="Giờ kết thúc">
            <Pressable accessibilityRole="button" onPress={() => openShiftTimePicker('endTime')} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 }}>
              <Text style={{ color: '#111827', fontSize: 15, fontWeight: '500' }}>{endTime}</Text>
              <Clock3 size={16} color="#9CA3AF" />
            </Pressable>
          </HrFormCustomRow>
          <HrFormCustomRow label="Nghỉ trưa từ">
            <Pressable accessibilityRole="button" onPress={() => openShiftTimePicker('lunchStart')} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 }}>
              <Text style={{ color: '#111827', fontSize: 15, fontWeight: '500' }}>{lunchStart}</Text>
              <Clock3 size={16} color="#9CA3AF" />
            </Pressable>
          </HrFormCustomRow>
          <HrFormCustomRow label="Nghỉ trưa đến">
            <Pressable accessibilityRole="button" onPress={() => openShiftTimePicker('lunchEnd')} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 }}>
              <Text style={{ color: '#111827', fontSize: 15, fontWeight: '500' }}>{lunchEnd}</Text>
              <Clock3 size={16} color="#9CA3AF" />
            </Pressable>
          </HrFormCustomRow>
          <HrFormCustomRow label="Ngày làm việc trong tuần">
            <View style={[styles.wrapRow, { marginTop: 6 }]}>
              {DAYS_OF_WEEK.map((d) => {
                const active = workingDays.includes(d.v);
                return (
                  <Pressable
                    key={d.v}
                    onPress={() =>
                      setWorkingDays((prev) =>
                        prev.includes(d.v) ? prev.filter((x) => x !== d.v) : [...prev, d.v],
                      )
                    }
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{d.l}</Text>
                  </Pressable>
                );
              })}
            </View>
          </HrFormCustomRow>
          <HrFormSwitchRow label="Đặt làm ca mặc định" value={isDefault} onValueChange={setIsDefault} last />
        </View>
      </FullScreenFormModal>

      {Platform.OS !== 'android' && activeTimePicker ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setActiveTimePicker(null)}
        >
          <Pressable style={styles.backdrop} onPress={() => setActiveTimePicker(null)}>
            <Pressable style={[styles.sheet, styles.timePickerSheet]} onPress={() => {}}>
              <Text style={styles.sheetTitle}>Chọn giờ</Text>
              <DateTimePicker
                value={activeTimePicker.value}
                mode="time"
                display="spinner"
                locale="vi-VN"
                is24Hour
                onChange={(_event, selectedTime) => {
                  if (selectedTime) {
                    setActiveTimePicker((current) =>
                      current ? { ...current, value: selectedTime } : current,
                    );
                  }
                }}
              />
              <View style={styles.timePickerActions}>
                <Pressable onPress={() => setActiveTimePicker(null)} style={styles.outlineBtn}>
                  <Text style={styles.outlineBtnText}>Hủy</Text>
                </Pressable>
                <Pressable onPress={savePickedShiftTime} style={styles.primaryBtn}>
                  <Text style={styles.primaryBtnText}>Xác nhận</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {Platform.OS !== 'android' && activeEffectiveDatePicker ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setActiveEffectiveDatePicker(null)}
        >
          <Pressable style={styles.backdrop} onPress={() => setActiveEffectiveDatePicker(null)}>
            <Pressable style={[styles.sheet, styles.timePickerSheet]} onPress={() => {}}>
              <Text style={styles.sheetTitle}>Chọn ngày hiệu lực</Text>
              <DateTimePicker
                value={activeEffectiveDatePicker}
                mode="date"
                display="spinner"
                locale="vi-VN"
                onChange={(_event, selectedDate) => {
                  if (selectedDate) setActiveEffectiveDatePicker(selectedDate);
                }}
              />
              <View style={styles.timePickerActions}>
                <Pressable
                  onPress={() => setActiveEffectiveDatePicker(null)}
                  style={styles.outlineBtn}
                >
                  <Text style={styles.outlineBtnText}>Hủy</Text>
                </Pressable>
                <Pressable onPress={savePickedEffectiveDate} style={styles.primaryBtn}>
                  <Text style={styles.primaryBtnText}>Xác nhận</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </ScrollView>
    <HrFab label="Thêm ca làm việc" onPress={() => openEditor()} />
    </View>
  );
}

// =========================================================================
// 3. LỊCH NGHỈ LỄ & NGÀY LÀM BÙ
// =========================================================================
function WorkHolidaysSection({ branchId }: { branchId?: string }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [days, setDays] = useState<HrWorkCalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fDate, setFDate] = useState(`${new Date().getFullYear()}-01-01`);
  const [fName, setFName] = useState('');
  const [fType, setFType] = useState<HrWorkCalendarDayType>('holiday');
  const [activeHolidayDatePicker, setActiveHolidayDatePicker] = useState<Date | null>(null);

  const [disableTarget, setDisableTarget] = useState<HrWorkCalendarDay | null>(null);
  const [disableReason, setDisableReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDays(await listHrWorkCalendar(year, false, branchId));
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không tải được lịch nghỉ lễ.');
    } finally {
      setLoading(false);
    }
  }, [branchId, year]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSync = async () => {
    setSyncing(true);
    try {
      const synced = await syncHrWorkCalendar(year, branchId);
      const fresh = await listHrWorkCalendar(year, false, branchId).catch(() => synced);
      setDays(fresh.length ? fresh : synced);
      Alert.alert('Thành công', `Đã đồng bộ ${fresh.length || synced.length} ngày nghỉ lễ năm ${year}.`);
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể đồng bộ.');
    } finally {
      setSyncing(false);
    }
  };

  const onToggle = async (day: HrWorkCalendarDay) => {
    if (day.isApplied) {
      setDisableTarget(day);
      setDisableReason('');
      return;
    }
    try {
      await updateHrWorkCalendarDay(day._id, { isApplied: true });
      void load();
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể cập nhật.');
    }
  };

  const onConfirmDisable = async () => {
    if (!disableTarget || !disableReason.trim()) {
      Alert.alert('Thiếu lý do', 'Vui lòng nhập lý do tắt áp dụng.');
      return;
    }
    try {
      await updateHrWorkCalendarDay(disableTarget._id, {
        isApplied: false,
        adminReason: disableReason.trim(),
      });
      setDisableTarget(null);
      void load();
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể tắt áp dụng.');
    }
  };

  const onSaveDay = async () => {
    if (!fDate.trim() || !fName.trim()) {
      Alert.alert('Thiếu thông tin', 'Nhập Ngày và Tên ngày nghỉ/làm bù.');
      return;
    }
    try {
      if (editingId) {
        await updateHrWorkCalendarDay(editingId, { date: fDate.trim(), name: fName.trim(), dayType: fType });
      } else {
        await createHrWorkCalendarDay({ date: fDate.trim(), name: fName.trim(), dayType: fType });
      }
      setFormOpen(false);
      setEditingId(null);
      void load();
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể lưu ngày.');
    }
  };

  const openHolidayDatePicker = () => {
    const [year, month, day] = fDate.split('-').map(Number);
    const hasValidDate = /^\d{4}-\d{2}-\d{2}$/.test(fDate);
    const value = hasValidDate ? new Date(year, month - 1, day, 12) : new Date();

    if (Platform.OS !== 'android') {
      setActiveHolidayDatePicker(value);
      return;
    }

    DateTimePickerAndroid.open({
      value,
      mode: 'date',
      display: 'calendar',
      onChange: (event, selectedDate) => {
        if (event.type === 'set' && selectedDate) setFDate(toDateKey(selectedDate));
      },
    });
  };

  const savePickedHolidayDate = () => {
    if (!activeHolidayDatePicker) return;
    setFDate(toDateKey(activeHolidayDatePicker));
    setActiveHolidayDatePicker(null);
  };

  const onDeleteDay = (day: HrWorkCalendarDay) => {
    showHrConfirm({
      title: 'Xóa ngày nghỉ lễ?',
      message: `Xóa "${day.name}" (${formatViDate(day.date)}) khỏi lịch công ty?`,
      confirmLabel: 'Xóa ngày',
      onConfirm: async () => {
        try {
          await deleteHrWorkCalendarDay(day._id);
          setDays((prev) => prev.filter((d) => d._id !== day._id));
        } catch (err) {
          Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể xóa.');
        }
      },
    });
  };

  return (
    <View style={{ flex: 1 }}>
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 92 }]} showsVerticalScrollIndicator={false}>
      <View style={[styles.headRow, { marginBottom: 10 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Pressable onPress={() => setYear((y) => y - 1)} style={styles.iconBtn}>
            <ChevronLeft size={15} color={colors.primary} />
          </Pressable>
          <Text style={styles.dateBarText}>{year}</Text>
          <Pressable onPress={() => setYear((y) => y + 1)} style={styles.iconBtn}>
            <ChevronRight size={15} color={colors.primary} />
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Pressable disabled={syncing} onPress={() => void onSync()} style={styles.outlineBtn}>
            <RefreshCw size={13} color={colors.primary} />
            <Text style={styles.outlineBtnText}>{syncing ? '...' : 'Đồng bộ'}</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <Card style={styles.stateCard}>
          <ActivityIndicator size="small" color={colors.primary} />
        </Card>
      ) : !days.length ? (
        <View style={styles.stateCard}>
          <IgenHrEmptyState message={`Chưa có ngày nghỉ lễ năm ${year}. Bấm "Đồng bộ" để nạp lịch chuẩn.`} />
        </View>
      ) : (
        <View style={styles.list}>
          {days.map((day) => (
            <Card key={day._id} style={[styles.listItem, !day.isApplied && { opacity: 0.55 }]}>
              <View style={styles.headRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{day.name}</Text>
                  <Text style={styles.subMeta}>
                    {formatViDate(day.date)} · {HOLIDAY_TYPE_LABELS[day.dayType]} ·{' '}
                    {day.source === 'system' ? 'Hệ thống' : 'Admin'}
                  </Text>
                </View>
                <Switch
                  value={day.isApplied}
                  onValueChange={() => void onToggle(day)}
                  trackColor={{ true: colors.primary, false: '#CBD5E1' }}
                />
              </View>
              {day.source === 'admin' ? (
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                  <Pressable
                    onPress={() => {
                      setEditingId(day._id);
                      setFDate(day.date);
                      setFName(day.name);
                      setFType(day.dayType);
                      setFormOpen(true);
                    }}
                  >
                    <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>Sửa</Text>
                  </Pressable>
                  <Pressable onPress={() => onDeleteDay(day)}>
                    <Text style={{ color: '#B91C1C', fontSize: 11, fontWeight: '700' }}>Xóa</Text>
                  </Pressable>
                </View>
              ) : null}
            </Card>
          ))}
        </View>
      )}

      {/* Create / Edit Holiday Modal */}
      <FullScreenFormModal
        visible={formOpen}
        title={editingId ? 'Sửa ngày công ty' : 'Thêm ngày công ty'}
        cancelLabel="Hủy"
        onSave={() => void onSaveDay()}
        onClose={() => setFormOpen(false)}
      >
        <View>
          <HrFormSectionTitle title="Thông tin ngày công ty" />
          <HrFormCustomRow label="Ngày *">
            <Pressable accessibilityRole="button" onPress={openHolidayDatePicker} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 }}>
              <Text style={{ color: '#111827', fontSize: 15, fontWeight: '500' }}>{formatViDate(fDate)}</Text>
              <CalendarDays size={16} color="#9CA3AF" />
            </Pressable>
          </HrFormCustomRow>
          <HrFormInputRow label="Tên ngày *" value={fName} onChangeText={setFName} placeholder="VD: Tết Dương Lịch" />
          <HrFormSelectRow
            label="Loại ngày"
            sheetTitle="Chọn loại ngày"
            value={fType}
            options={(Object.keys(HOLIDAY_TYPE_LABELS) as HrWorkCalendarDayType[]).map((t) => ({
              value: t,
              label: HOLIDAY_TYPE_LABELS[t],
            }))}
            onSelect={(val) => setFType(val as HrWorkCalendarDayType)}
            last
          />
        </View>
      </FullScreenFormModal>

      {Platform.OS !== 'android' && activeHolidayDatePicker ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setActiveHolidayDatePicker(null)}
        >
          <Pressable style={styles.backdrop} onPress={() => setActiveHolidayDatePicker(null)}>
            <Pressable style={[styles.sheet, styles.timePickerSheet]} onPress={() => {}}>
              <Text style={styles.sheetTitle}>Chọn ngày</Text>
              <DateTimePicker
                value={activeHolidayDatePicker}
                mode="date"
                display="spinner"
                locale="vi-VN"
                onChange={(_event, selectedDate) => {
                  if (selectedDate) setActiveHolidayDatePicker(selectedDate);
                }}
              />
              <View style={styles.timePickerActions}>
                <Pressable
                  onPress={() => setActiveHolidayDatePicker(null)}
                  style={styles.outlineBtn}
                >
                  <Text style={styles.outlineBtnText}>Hủy</Text>
                </Pressable>
                <Pressable onPress={savePickedHolidayDate} style={styles.primaryBtn}>
                  <Text style={styles.primaryBtnText}>Xác nhận</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {/* Disable Reason Full-Screen Page */}
      <FullScreenFormModal
        visible={Boolean(disableTarget)}
        title={`Tắt áp dụng ${disableTarget?.name || ''}`}
        cancelLabel="Hủy"
        onSave={() => void onConfirmDisable()}
        saveLabel="Xác nhận"
        onClose={() => setDisableTarget(null)}
      >
        <View>
          <HrFormSectionTitle title="Thông tin tắt áp dụng" />
          <HrFormInputRow
            label="Lý do tắt áp dụng *"
            value={disableReason}
            onChangeText={setDisableReason}
            multiline
            placeholder="Nhập lý do chi tiết..."
            last
          />
        </View>
      </FullScreenFormModal>
    </ScrollView>
    <HrFab
      label="Thêm ngày nghỉ"
      onPress={() => {
        setEditingId(null);
        setFDate(`${year}-01-01`);
        setFName('');
        setFType('holiday');
        setFormOpen(true);
      }}
    />
    </View>
  );
}

// =========================================================================
// 4. GIỜ LÀM VIỆC RIÊNG CỦA NHÂN VIÊN
// =========================================================================
function EmployeeWorkHoursSection({ branchId }: { branchId?: string }) {
  const [rows, setRows] = useState<HrEmployeeWorkHoursRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<HrEmployeeWorkHoursRow | null>(null);
  const [form, setForm] = useState<HrWorkHoursConfig>({
    useCustom: false,
    checkInLimit: '08:30',
    checkOutLimit: '17:30',
    lunchBreakStart: '12:00',
    lunchBreakEnd: '13:00',
    workingDays: [1, 2, 3, 4, 5],
    employmentStatus: 'official',
    officialDate: '',
  });
  const [saving, setSaving] = useState(false);
  const [activeWorkHoursPicker, setActiveWorkHoursPicker] = useState<{
    target: 'officialDate' | 'checkInLimit' | 'checkOutLimit' | 'lunchBreakStart' | 'lunchBreakEnd';
    value: Date;
  } | null>(null);

  const applyPickedWorkHoursValue = (
    target: 'officialDate' | 'checkInLimit' | 'checkOutLimit' | 'lunchBreakStart' | 'lunchBreakEnd',
    date: Date,
  ) => {
    const value = target === 'officialDate'
      ? toDateKey(date)
      : `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    setForm((current) => ({ ...current, [target]: value }));
  };

  const openWorkHoursPicker = (
    target: 'officialDate' | 'checkInLimit' | 'checkOutLimit' | 'lunchBreakStart' | 'lunchBreakEnd',
  ) => {
    const isDatePicker = target === 'officialDate';
    let value: Date;

    if (isDatePicker) {
      const dateKey = (form.officialDate || '').slice(0, 10);
      const [year, month, day] = dateKey.split('-').map(Number);
      value = /^\d{4}-\d{2}-\d{2}$/.test(dateKey)
        ? new Date(year, month - 1, day, 12)
        : new Date();
    } else {
      const defaults = {
        checkInLimit: '08:30',
        checkOutLimit: '17:30',
        lunchBreakStart: '12:00',
        lunchBreakEnd: '13:00',
      };
      const currentValue = form[target] || defaults[target];
      const [hour, minute] = currentValue.split(':').map(Number);
      value = new Date();
      value.setHours(Number.isFinite(hour) ? hour : 8, Number.isFinite(minute) ? minute : 0, 0, 0);
    }

    if (Platform.OS !== 'android') {
      setActiveWorkHoursPicker({ target, value });
      return;
    }

    DateTimePickerAndroid.open({
      value,
      mode: isDatePicker ? 'date' : 'time',
      display: isDatePicker ? 'calendar' : 'clock',
      is24Hour: true,
      onChange: (event, selectedValue) => {
        if (event.type === 'set' && selectedValue) {
          applyPickedWorkHoursValue(target, selectedValue);
        }
      },
    });
  };

  const savePickedWorkHoursValue = () => {
    if (!activeWorkHoursPicker) return;
    applyPickedWorkHoursValue(activeWorkHoursPicker.target, activeWorkHoursPicker.value);
    setActiveWorkHoursPicker(null);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listHrEmployeeWorkHours(branchId));
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không tải được giờ làm việc riêng.');
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.displayName || r.fullName || '').toLowerCase().includes(q) ||
        (r.email || '').toLowerCase().includes(q),
    );
  }, [rows, search]);

  const openEdit = (emp: HrEmployeeWorkHoursRow) => {
    setEditing(emp);
    setForm({
      useCustom: Boolean(emp.workHoursConfig?.useCustom),
      checkInLimit: emp.workHoursConfig?.checkInLimit || '08:30',
      checkOutLimit: emp.workHoursConfig?.checkOutLimit || '17:30',
      lunchBreakStart: emp.workHoursConfig?.lunchBreakStart || '12:00',
      lunchBreakEnd: emp.workHoursConfig?.lunchBreakEnd || '13:00',
      workingDays: emp.workHoursConfig?.workingDays?.length ? emp.workHoursConfig.workingDays : [1, 2, 3, 4, 5],
      annualLeaveDays: emp.workHoursConfig?.annualLeaveDays,
      employmentStatus: emp.employmentStatus || emp.workHoursConfig?.employmentStatus || 'official',
      officialDate: emp.officialDate || emp.workHoursConfig?.officialDate || '',
    });
  };

  const onSave = async () => {
    if (!editing || saving) return;
    if (form.useCustom && (!form.workingDays || !form.workingDays.length)) {
      Alert.alert('Thiếu ngày làm việc', 'Chọn ít nhất một ngày làm việc.');
      return;
    }
    setSaving(true);
    try {
      await updateHrEmployeeWorkHours(editing._id, form, branchId);
      setRows((prev) => prev.map((r) => (r._id === editing._id ? { ...r, workHoursConfig: form } : r)));
      setEditing(null);
      Alert.alert('Đã lưu', 'Cập nhật giờ làm việc riêng thành công.');
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể lưu giờ làm việc.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Tìm nhân viên theo tên hoặc email..."
        placeholderTextColor="#94A3B8"
        style={[styles.searchField, { marginBottom: 12 }]}
      />

      {loading ? (
        <Card style={styles.stateCard}>
          <ActivityIndicator size="small" color={colors.primary} />
        </Card>
      ) : !filtered.length ? (
        <View style={styles.stateCard}>
          <IgenHrEmptyState message="Không có nhân viên nào." />
        </View>
      ) : (
        <View style={styles.list}>
          {filtered.map((emp) => {
            const custom = emp.workHoursConfig?.useCustom;
            return (
              <Card key={emp._id} onPress={() => openEdit(emp)} style={styles.listItem}>
                <View style={styles.headRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{emp.displayName || emp.fullName || emp.email}</Text>
                    <Text style={styles.subMeta}>{emp.email || '—'}</Text>
                  </View>
                  <Text style={custom ? styles.badgeInfo : styles.badgeNeutral}>
                    {custom
                      ? `${emp.workHoursConfig?.checkInLimit} – ${emp.workHoursConfig?.checkOutLimit}`
                      : 'Theo công ty'}
                  </Text>
                </View>
              </Card>
            );
          })}
        </View>
      )}

      {/* Edit Work Hours Full-Screen Page */}
      <FullScreenFormModal
        visible={Boolean(editing)}
        title={`Giờ làm việc: ${editing?.displayName || editing?.email || ''}`}
        cancelLabel="Hủy"
        onSave={() => void onSave()}
        saving={saving}
        onClose={() => setEditing(null)}
      >
        <View>
          <HrFormSectionTitle title="Cấu hình giờ làm việc" />
          <HrFormSwitchRow
            label="Dùng giờ làm việc riêng"
            value={form.useCustom}
            onValueChange={(v) => setForm((f) => ({ ...f, useCustom: v }))}
          />
          <HrFormSelectRow
            label="Trạng thái nhân sự"
            sheetTitle="Chọn trạng thái nhân sự"
            value={form.employmentStatus || 'official'}
            options={(['official', 'probation', 'internship'] as const).map((st) => ({
              value: st,
              label: EMPLOYMENT_STATUS_LABELS[st],
            }))}
            onSelect={(val) => setForm((f) => ({ ...f, employmentStatus: val as typeof f.employmentStatus }))}
          />
          <HrFormCustomRow label="Ngày chính thức">
            <Pressable accessibilityRole="button" onPress={() => openWorkHoursPicker('officialDate')} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 }}>
              <Text style={{ color: form.officialDate ? '#111827' : '#9CA3AF', fontSize: 15, fontWeight: form.officialDate ? '500' : '400' }}>
                {form.officialDate ? formatViDate(form.officialDate) : 'Chọn ngày'}
              </Text>
              <CalendarDays size={16} color="#9CA3AF" />
            </Pressable>
          </HrFormCustomRow>
          <HrFormInputRow
            label="Phép năm riêng"
            value={form.annualLeaveDays != null ? String(form.annualLeaveDays) : ''}
            onChangeText={(v) =>
              setForm((f) => ({ ...f, annualLeaveDays: v.trim() === '' ? undefined : Number(v) }))
            }
            keyboardType="numeric"
            placeholder="Theo công ty"
            last={!form.useCustom}
          />

          {form.useCustom ? (
            <>
              <HrFormCustomRow label="Giờ vào">
                <Pressable accessibilityRole="button" onPress={() => openWorkHoursPicker('checkInLimit')} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 }}>
                  <Text style={{ color: '#111827', fontSize: 15, fontWeight: '500' }}>{form.checkInLimit || '08:30'}</Text>
                  <Clock3 size={16} color="#9CA3AF" />
                </Pressable>
              </HrFormCustomRow>
              <HrFormCustomRow label="Giờ ra">
                <Pressable accessibilityRole="button" onPress={() => openWorkHoursPicker('checkOutLimit')} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 }}>
                  <Text style={{ color: '#111827', fontSize: 15, fontWeight: '500' }}>{form.checkOutLimit || '17:30'}</Text>
                  <Clock3 size={16} color="#9CA3AF" />
                </Pressable>
              </HrFormCustomRow>
              <HrFormCustomRow label="Nghỉ trưa từ">
                <Pressable accessibilityRole="button" onPress={() => openWorkHoursPicker('lunchBreakStart')} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 }}>
                  <Text style={{ color: '#111827', fontSize: 15, fontWeight: '500' }}>{form.lunchBreakStart || '12:00'}</Text>
                  <Clock3 size={16} color="#9CA3AF" />
                </Pressable>
              </HrFormCustomRow>
              <HrFormCustomRow label="Nghỉ trưa đến">
                <Pressable accessibilityRole="button" onPress={() => openWorkHoursPicker('lunchBreakEnd')} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 }}>
                  <Text style={{ color: '#111827', fontSize: 15, fontWeight: '500' }}>{form.lunchBreakEnd || '13:00'}</Text>
                  <Clock3 size={16} color="#9CA3AF" />
                </Pressable>
              </HrFormCustomRow>
              <HrFormCustomRow label="Ngày làm việc" last>
                <View style={[styles.wrapRow, { marginTop: 6 }]}>
                  {DAYS_OF_WEEK.map((d) => {
                    const list = form.workingDays || [];
                    const active = list.includes(d.v);
                    return (
                      <Pressable
                        key={d.v}
                        onPress={() =>
                          setForm((f) => ({
                            ...f,
                            workingDays: active ? list.filter((x) => x !== d.v) : [...list, d.v],
                          }))
                        }
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{d.l}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </HrFormCustomRow>
            </>
          ) : (
            <Text style={[styles.muted, { marginTop: 8 }]}>Nhân viên này đang áp dụng giờ làm việc chung của công ty.</Text>
          )}
        </View>
      </FullScreenFormModal>

      {Platform.OS !== 'android' && activeWorkHoursPicker ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setActiveWorkHoursPicker(null)}
        >
          <Pressable style={styles.backdrop} onPress={() => setActiveWorkHoursPicker(null)}>
            <Pressable style={[styles.sheet, styles.timePickerSheet]} onPress={() => {}}>
              <Text style={styles.sheetTitle}>
                {activeWorkHoursPicker.target === 'officialDate'
                  ? 'Chọn ngày chính thức'
                  : 'Chọn giờ'}
              </Text>
              <DateTimePicker
                value={activeWorkHoursPicker.value}
                mode={activeWorkHoursPicker.target === 'officialDate' ? 'date' : 'time'}
                display="spinner"
                locale="vi-VN"
                is24Hour
                onChange={(_event, selectedValue) => {
                  if (selectedValue) {
                    setActiveWorkHoursPicker((current) =>
                      current ? { ...current, value: selectedValue } : current,
                    );
                  }
                }}
              />
              <View style={styles.timePickerActions}>
                <Pressable
                  onPress={() => setActiveWorkHoursPicker(null)}
                  style={styles.outlineBtn}
                >
                  <Text style={styles.outlineBtnText}>Hủy</Text>
                </Pressable>
                <Pressable onPress={savePickedWorkHoursValue} style={styles.primaryBtn}>
                  <Text style={styles.primaryBtnText}>Xác nhận</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

    </ScrollView>
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
  root: { flex: 1, backgroundColor: colors.white },
  subTabScroll: { flexGrow: 0, marginBottom: 10 },
  subTabRow: { paddingHorizontal: 14, gap: 6 },
  subTabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.white,
    borderColor: '#E5EAF2',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  subTabPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  subTabText: { color: '#6B7280', fontSize: 12, fontWeight: '500' },
  subTabTextActive: { color: colors.white, fontWeight: '600' },

  content: { paddingHorizontal: 14, paddingBottom: 28, backgroundColor: colors.white },
  segmentRow: { flexDirection: 'row', backgroundColor: '#EAF1FA', borderRadius: 10, padding: 3, marginBottom: 12 },
  segmentBtn: { flex: 1, paddingVertical: 7.5, borderRadius: 8, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: colors.white },
  segmentText: { color: '#6B7280', fontSize: 12, fontWeight: '500' },
  segmentTextActive: { color: '#111827', fontWeight: '600' },

  dateBar: { ...HAIRLINE_CARD, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 8, marginBottom: 10 },
  dateBarText: { color: '#111827', fontSize: 13.5, fontWeight: '600' },
  iconBtn: { width: 32, height: 32, borderRadius: 9, backgroundColor: '#F5F8FD', alignItems: 'center', justifyContent: 'center' },

  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  kpiBox: { ...HAIRLINE_CARD, flex: 1, paddingVertical: 10, alignItems: 'center' },
  kpiVal: { color: '#111827', fontSize: 16, fontWeight: '600' },
  kpiLabel: { color: colors.muted, fontSize: 10.5, fontWeight: '400', marginTop: 2 },

  calCard: { ...HAIRLINE_CARD, padding: 12, marginTop: 10, marginBottom: 12 },
  calHeaderRow: { flexDirection: 'row', marginBottom: 6 },
  calHeaderText: { width: '14.285%', textAlign: 'center', color: '#6B7280', fontSize: 11, fontWeight: '500' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: '14.285%', height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  calCellToday: { backgroundColor: '#EAF2FF' },
  calCellSelected: { backgroundColor: colors.primary },
  calDayNum: { color: '#111827', fontSize: 12.5, fontWeight: '500' },
  dotRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2, height: 8 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  calMoreText: { fontSize: 8.5, fontWeight: '600', color: colors.primary, lineHeight: 8 },

  list: {
    marginHorizontal: -14,
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#EEF2F7',
    gap: 0,
  },
  listItem: {
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
    gap: 4,
  },
  card: { ...HAIRLINE_CARD, padding: 14, gap: 5 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowTitle: { color: '#111827', fontSize: 14, fontWeight: '600' },
  muted: { color: '#6B7280', fontSize: 12.5, fontWeight: '400', lineHeight: 18 },
  subMeta: { color: '#6B7280', fontSize: 11.5, fontWeight: '400' },
  sectionTitle: { color: '#111827', fontSize: 15, fontWeight: '700', marginBottom: 10 },
  badgeInfo: { color: colors.primary, backgroundColor: '#EAF2FF', fontSize: 10.5, fontWeight: '500', paddingHorizontal: 8, paddingVertical: 3.5, borderRadius: 8, overflow: 'hidden' },
  badgeNeutral: { color: '#64748B', backgroundColor: '#F1F5F9', fontSize: 10.5, fontWeight: '500', paddingHorizontal: 8, paddingVertical: 3.5, borderRadius: 8, overflow: 'hidden' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  timeBadge: { color: '#111827', backgroundColor: '#F6F8FC', borderColor: '#E5EAF2', borderWidth: StyleSheet.hairlineWidth, fontSize: 11, fontWeight: '500', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7 },
  modeToggle: { flexDirection: 'row', backgroundColor: '#EAF1FA', borderRadius: 9, padding: 2 },
  modeToggleBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 7 },
  modeToggleActive: { backgroundColor: colors.primary },
  modeToggleText: { color: '#6B7280', fontSize: 11, fontWeight: '600' },
  modeToggleTextActive: { color: colors.white },
  tableWrap: { ...HAIRLINE_CARD, borderColor: '#DCE7F4', overflow: 'hidden' },
  tableContentRow: { flexDirection: 'row' },
  tableLeft: { width: 174, borderRightWidth: 1, borderRightColor: '#DCE7F4', backgroundColor: colors.white },
  tableHeaderRow: { flexDirection: 'row', alignItems: 'center', height: 46, backgroundColor: '#EEF6FF', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#DCE7F4' },
  tableHeaderLeft: { paddingLeft: 2 },
  thText: { color: '#1D4ED8', fontSize: 10.5, fontWeight: '600' },
  thTotalCol: { width: 44, textAlign: 'center', backgroundColor: '#E2EFFD', height: '100%', textAlignVertical: 'center', paddingTop: 15 },
  tableBodyRow: { flexDirection: 'row', alignItems: 'center', height: 48, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EDF2F8', backgroundColor: colors.white },
  tableRowAlt: { backgroundColor: '#FAFBFD' },
  tdIndex: { width: 24, textAlign: 'center', color: '#6B7280', fontSize: 10.5, fontWeight: '500' },
  tdNameWrap: { flex: 1, paddingHorizontal: 4 },
  tdName: { color: '#1D4ED8', fontSize: 11.5, fontWeight: '600' },
  tdSub: { color: '#6B7280', fontSize: 9.5 },
  tdTotalCol: { width: 44, height: '100%', backgroundColor: '#F5F9FF', alignItems: 'center', justifyContent: 'center', borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: '#DCE7F4' },
  tdTotalVal: { color: colors.primary, fontSize: 11.5, fontWeight: '600' },
  dayHeaderCell: { width: 48, height: 46, alignItems: 'center', justifyContent: 'center', borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: '#DCE7F4', backgroundColor: '#EEF6FF' },
  dayHeaderWeekend: { backgroundColor: '#F6F8FC' },
  dayHeaderToday: { backgroundColor: '#DBEAFE' },
  dayDowText: { color: '#1D4ED8', fontSize: 9.5, fontWeight: '500' },
  dayNumText: { color: '#111827', fontSize: 12, fontWeight: '600' },
  dayCell: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: '#EDF2F8', paddingHorizontal: 2 },
  dayCellWeekend: { backgroundColor: '#F8FAFC' },
  dayCellToday: { backgroundColor: '#F0F7FF' },
  dayCellDash: { color: '#94A3B8', fontSize: 11 },
  dayCellDot: { color: '#CBD5E1', fontSize: 14 },
  dayCellVal: { fontSize: 12, fontWeight: '600', lineHeight: 15 },
  dayCellStatus: { fontSize: 9, fontWeight: '500', marginTop: 1 },
  colorDot: { width: 12, height: 12, borderRadius: 6 },

  searchField: { backgroundColor: '#F6F8FC', borderColor: '#DCE5F2', borderWidth: 1, borderRadius: 99, paddingHorizontal: 14, height: 40, fontSize: 13.5, color: '#111827' },
  stateCard: { ...HAIRLINE_CARD, padding: 22, alignItems: 'center', gap: 10 },
  errorText: { color: '#B91C1C', fontSize: 12.5, textAlign: 'center' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: colors.primary, minHeight: 38, paddingHorizontal: 12, borderRadius: 10 },
  primaryBtnText: { color: colors.white, fontSize: 12, fontWeight: '600' },
  outlineBtn: { ...HAIRLINE_CARD, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 38, paddingHorizontal: 11 },
  outlineBtnText: { color: colors.primary, fontSize: 12, fontWeight: '600' },

  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.35)', justifyContent: 'center', padding: 16 },
  sheet: { backgroundColor: colors.white, borderRadius: 20, overflow: 'hidden', padding: 18, gap: 8, maxHeight: '88%' },
  sheetTitle: { color: '#111827', fontSize: 16, fontWeight: '600' },
  closeText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  label: { color: '#374151', fontSize: 12.5, fontWeight: '500', marginTop: 4 },
  field: { backgroundColor: '#F6F8FC', borderColor: '#DCE5F2', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13.5, color: '#111827' },
  pickerField: { backgroundColor: '#F6F8FC', borderColor: '#DCE5F2', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerFieldText: { color: '#111827', fontSize: 13.5 },
  timePickerSheet: { alignItems: 'center' },
  timePickerActions: { flexDirection: 'row', justifyContent: 'flex-end', alignSelf: 'stretch', gap: 8, marginTop: 8 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: colors.white, borderColor: '#E5EAF2', borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: '#6B7280', fontSize: 11.5, fontWeight: '500' },
  chipTextActive: { color: colors.white, fontWeight: '600' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  submitBtn: { backgroundColor: colors.primary, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  submitBtnText: { color: colors.white, fontSize: 13.5, fontWeight: '600' },
  disabled: { opacity: 0.45 },
});

