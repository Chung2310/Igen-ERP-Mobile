import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  CalendarCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Users,
} from 'lucide-react-native';
import { Card } from '@/components/Card';
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
  listMonthlyAttendanceLogs,
  saveHrWorkShift,
  submitCheckIn,
  submitCheckOut,
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
        <WorkHolidaysSection />
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
  const [checking, setChecking] = useState<'in' | 'out' | null>(null);

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
  const [pickedDayKey, setPickedDayKey] = useState(today);

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
        const [evList, holList] = await Promise.all([
          listHrCalendarEvents(companyCode).catch(() => []),
          listHrWorkCalendar(calYear, true).catch(() => []),
        ]);
        setEvents(evList);
        setHolidays(holList);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không tải được lịch làm việc.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [calYear, companyCode],
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
            branchId,
          }),
          listAttendanceRoster(branchId).catch(() => []),
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
    [branchId, companyCode, histMonth, histYear],
  );

  useEffect(() => {
    if (mode === 'monthly') void loadMonthly();
    else void loadCalendar();
  }, [loadCalendar, loadMonthly, mode]);

  const onCheck = useCallback(
    async (type: 'in' | 'out') => {
      setChecking(type);
      try {
        const res = type === 'in' ? await submitCheckIn(branchId) : await submitCheckOut(branchId);
        Alert.alert(
          type === 'in' ? 'Check-in thành công' : 'Check-out thành công',
          res?.message || 'Đã ghi nhận chấm công.',
        );
        void loadMonthly(true);
      } catch (err) {
        Alert.alert('Chấm công thất bại', err instanceof Error ? err.message : 'Vui lòng thử lại.');
      } finally {
        setChecking(null);
      }
    },
    [branchId, loadMonthly],
  );

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
      });
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

  const holidayMap = useMemo(() => new Map(holidays.map((h) => [h.date, h])), [holidays]);

  const eventsForDay = useCallback(
    (dateKey: string) =>
      events.filter((ev) => {
        const s = (ev.startDate || '').slice(0, 10);
        const e = (ev.endDate || s).slice(0, 10);
        return dateKey >= s && dateKey <= e;
      }),
    [events],
  );

  const pickedEvents = useMemo(() => eventsForDay(pickedDayKey), [eventsForDay, pickedDayKey]);
  const pickedHoliday = holidayMap.get(pickedDayKey);

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
      const row = addOrGet(key, log.employeeName || log.displayName || 'Nhân viên');
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
          {/* Quick Check-in / Check-out */}
          <View style={styles.checkRow}>
            <Pressable
              disabled={checking !== null}
              onPress={() => void onCheck('in')}
              style={[styles.checkBtn, styles.checkInBtn, checking !== null && styles.disabled]}
            >
              <LogIn size={15} color={colors.white} />
              <Text style={styles.checkBtnText}>{checking === 'in' ? 'Đang gửi...' : 'Check-in'}</Text>
            </Pressable>
            <Pressable
              disabled={checking !== null}
              onPress={() => void onCheck('out')}
              style={[styles.checkBtn, styles.checkOutBtn, checking !== null && styles.disabled]}
            >
              <LogOut size={15} color={colors.white} />
              <Text style={styles.checkBtnText}>{checking === 'out' ? 'Đang gửi...' : 'Check-out'}</Text>
            </Pressable>
          </View>

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
              placeholderTextColor={colors.muted}
              style={[styles.field, { marginBottom: 10 }]}
            />
          ) : null}

          {loading ? (
            <Card style={styles.stateCard}>
              <ActivityIndicator size="small" color={colors.primary} />
            </Card>
          ) : error ? (
            <Card style={styles.stateCard}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable onPress={() => void loadMonthly()} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>Thử lại</Text>
              </Pressable>
            </Card>
          ) : !monthlyRows.length ? (
            <Card style={styles.stateCard}>
              <Text style={styles.muted}>
                Không có dữ liệu bảng công Tháng {histMonth}/{histYear}.
              </Text>
            </Card>
          ) : (
            <View style={styles.tableWrap}>
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

          <Text style={[styles.subMeta, { marginTop: 8, textAlign: 'center' }]}>
            Vuốt ngang bảng để xem các ngày 1–{daysInHistMonth}
            {canEditAttendance
              ? ' · Chạm ô có dữ liệu để xem / chỉnh sửa'
              : ' · Chi tiết chấm công của nhân sự khác được ẩn'}
          </Text>
        </>
      ) : (
        <>
          {/* Month Navigator + Add Event */}
          <View style={styles.headRow}>
            <Card style={[styles.dateBar, { flex: 1, marginBottom: 0 }]}>
              <Pressable
                onPress={() => setCalMonthDate(new Date(calYear, calMonth - 1, 1))}
                style={styles.iconBtn}
              >
                <ChevronLeft size={16} color={colors.primary} />
              </Pressable>
              <Text style={styles.dateBarText}>
                Tháng {calMonth + 1}/{calYear}
              </Text>
              <Pressable
                onPress={() => setCalMonthDate(new Date(calYear, calMonth + 1, 1))}
                style={styles.iconBtn}
              >
                <ChevronRight size={16} color={colors.primary} />
              </Pressable>
            </Card>
            <Pressable
              onPress={() => {
                setEvStart(pickedDayKey);
                setEvEnd(pickedDayKey);
                setEventModalOpen(true);
              }}
              style={styles.primaryBtn}
            >
              <Plus size={14} color={colors.white} />
              <Text style={styles.primaryBtnText}>Thêm lịch</Text>
            </Pressable>
          </View>

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
                return (
                  <Pressable
                    key={cell.key}
                    onPress={() => setPickedDayKey(cell.key)}
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
                      {hasHoliday ? <View style={[styles.dot, { backgroundColor: '#EF4444' }]} /> : null}
                      {dayEvs.length > 0 ? (
                        <View style={[styles.dot, { backgroundColor: isSelected ? colors.white : colors.primary }]} />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Card>

          {/* Picked day details */}
          <Text style={styles.sectionTitle}>Chi tiết ngày {formatViDate(pickedDayKey)}</Text>
          {pickedHoliday ? (
            <Card style={[styles.card, { backgroundColor: '#FEF2F2', borderColor: '#FECACA', marginBottom: 8 }]}>
              <Text style={[styles.rowTitle, { color: '#B91C1C' }]}>🎉 {pickedHoliday.name}</Text>
              <Text style={styles.subMeta}>{HOLIDAY_TYPE_LABELS[pickedHoliday.dayType]}</Text>
            </Card>
          ) : null}

          {!pickedEvents.length ? (
            <Card style={styles.stateCard}>
              <Text style={styles.muted}>Không có sự kiện hoặc lịch trình nào trong ngày này.</Text>
            </Card>
          ) : (
            <View style={styles.list}>
              {pickedEvents.map((ev) => (
                <Card key={ev.id} style={styles.card}>
                  <View style={styles.headRow}>
                    <Text style={styles.badgeInfo}>{EVENT_TYPE_LABELS[ev.type] || ev.type}</Text>
                    {canManageCalendar || ev.creatorId === (user?._id || user?.id) ? (
                      <Pressable onPress={() => onDeleteEvent(ev)} hitSlop={8}>
                        <Trash2 size={14} color="#B91C1C" />
                      </Pressable>
                    ) : null}
                  </View>
                  <Text style={styles.rowTitle}>{ev.title}</Text>
                  <Text style={styles.subMeta}>
                    {formatViDate(ev.startDate)}
                    {ev.endDate && ev.endDate !== ev.startDate ? ` → ${formatViDate(ev.endDate)}` : ''}
                  </Text>
                  {ev.description ? <Text style={styles.muted}>{ev.description}</Text> : null}
                </Card>
              ))}
            </View>
          )}
        </>
      )}

      {/* Edit attendance modal */}
      <Modal visible={Boolean(editingRec)} transparent animationType="slide" onRequestClose={() => setEditingRec(null)}>
        <Pressable style={styles.backdrop} onPress={() => setEditingRec(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.headRow}>
              <Text style={styles.sheetTitle}>Chỉnh sửa chấm công</Text>
              <Pressable onPress={() => setEditingRec(null)}>
                <Text style={styles.closeText}>Đóng</Text>
              </Pressable>
            </View>
            <Text style={styles.muted}>
              {editingRec?.employeeName || editingRec?.displayName} · {formatViDate(editingRec?.date)}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Giờ vào (HH:mm)</Text>
                <TextInput value={editIn} onChangeText={setEditIn} placeholder="08:30" style={styles.field} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Giờ ra (HH:mm)</Text>
                <TextInput value={editOut} onChangeText={setEditOut} placeholder="17:30" style={styles.field} />
              </View>
            </View>
            <Text style={styles.label}>Ghi chú</Text>
            <TextInput value={editNote} onChangeText={setEditNote} placeholder="Lý do điều chỉnh..." style={styles.field} />
            <Pressable
              disabled={savingRec}
              onPress={() => void onSaveRec()}
              style={[styles.submitBtn, savingRec && styles.disabled]}
            >
              <Text style={styles.submitBtnText}>{savingRec ? 'Đang lưu...' : 'Lưu điều chỉnh'}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Create Calendar Event Modal */}
      <Modal visible={eventModalOpen} transparent animationType="slide" onRequestClose={() => setEventModalOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setEventModalOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.headRow}>
              <Text style={styles.sheetTitle}>Thêm lịch làm việc</Text>
              <Pressable onPress={() => setEventModalOpen(false)}>
                <Text style={styles.closeText}>Đóng</Text>
              </Pressable>
            </View>
            <Text style={styles.label}>Loại lịch</Text>
            <View style={styles.wrapRow}>
              {(Object.keys(EVENT_TYPE_LABELS) as HrCalendarEventType[]).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setEvType(t)}
                  style={[styles.chip, evType === t && styles.chipActive]}
                >
                  <Text style={[styles.chipText, evType === t && styles.chipTextActive]}>
                    {EVENT_TYPE_LABELS[t]}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>Tiêu đề *</Text>
            <TextInput value={evTitle} onChangeText={setEvTitle} placeholder="VD: Họp giao ban đầu tuần" style={styles.field} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Từ ngày (YYYY-MM-DD)</Text>
                <TextInput value={evStart} onChangeText={setEvStart} style={styles.field} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Đến ngày</Text>
                <TextInput value={evEnd} onChangeText={setEvEnd} style={styles.field} />
              </View>
            </View>
            <Text style={styles.label}>Mô tả</Text>
            <TextInput
              value={evDesc}
              onChangeText={setEvDesc}
              multiline
              placeholder="Ghi chú chi tiết..."
              style={[styles.field, { minHeight: 56, textAlignVertical: 'top' }]}
            />
            <Pressable
              disabled={savingEv}
              onPress={() => void onCreateEvent()}
              style={[styles.submitBtn, savingEv && styles.disabled]}
            >
              <Text style={styles.submitBtnText}>{savingEv ? 'Đang lưu...' : 'Tạo lịch'}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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

  // Assignment
  const [assignShiftId, setAssignShiftId] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(() => getTodayKey());
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);

  const shiftMap = useMemo(() => new Map(shifts.map((s) => [s._id, s])), [shifts]);

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
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={[styles.headRow, { marginBottom: 10 }]}>
        <Text style={styles.sectionTitle}>Danh sách ca làm việc ({shifts.length})</Text>
        <Pressable onPress={() => openEditor()} style={styles.primaryBtn}>
          <Plus size={13} color={colors.white} />
          <Text style={styles.primaryBtnText}>Thêm ca</Text>
        </Pressable>
      </View>

      {loading ? (
        <Card style={styles.stateCard}>
          <ActivityIndicator size="small" color={colors.primary} />
        </Card>
      ) : !shifts.length ? (
        <Card style={styles.stateCard}>
          <Text style={styles.muted}>Chưa có ca làm việc nào. Giờ chung của công ty vẫn đang áp dụng.</Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {shifts.map((s) => (
            <Card key={s._id} style={styles.card}>
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
            <Text style={styles.label}>Hiệu lực từ (YYYY-MM-DD)</Text>
            <TextInput value={effectiveFrom} onChangeText={setEffectiveFrom} style={styles.field} />
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
              style={[styles.card, checked && { borderColor: colors.primary, backgroundColor: '#F0F7FF' }]}
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

      {/* Edit / Create Shift Modal */}
      <Modal visible={Boolean(editing)} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <Pressable style={styles.backdrop} onPress={() => setEditing(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.headRow}>
              <Text style={styles.sheetTitle}>
                {editing === 'new' ? 'Thêm ca làm việc' : 'Chỉnh sửa ca làm việc'}
              </Text>
              <Pressable onPress={() => setEditing(null)}>
                <Text style={styles.closeText}>Đóng</Text>
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Mã ca *</Text>
                    <TextInput value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="CA_SANG" style={styles.field} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Tên ca *</Text>
                    <TextInput value={name} onChangeText={setName} placeholder="Ca hành chính" style={styles.field} />
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Bắt đầu (HH:mm)</Text>
                    <TextInput value={startTime} onChangeText={setStartTime} style={styles.field} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Kết thúc (HH:mm)</Text>
                    <TextInput value={endTime} onChangeText={setEndTime} style={styles.field} />
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Nghỉ trưa từ</Text>
                    <TextInput value={lunchStart} onChangeText={setLunchStart} style={styles.field} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Đến</Text>
                    <TextInput value={lunchEnd} onChangeText={setLunchEnd} style={styles.field} />
                  </View>
                </View>
                <Text style={styles.label}>Ngày làm việc trong tuần</Text>
                <View style={styles.wrapRow}>
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
                <View style={styles.switchRow}>
                  <Text style={styles.label}>Đặt làm ca mặc định</Text>
                  <Switch value={isDefault} onValueChange={setIsDefault} trackColor={{ true: colors.primary, false: '#CBD5E1' }} />
                </View>
                <Pressable disabled={saving} onPress={() => void onSaveShift()} style={[styles.submitBtn, saving && styles.disabled]}>
                  <Text style={styles.submitBtnText}>{saving ? 'Đang lưu...' : 'Lưu ca làm việc'}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

// =========================================================================
// 3. LỊCH NGHỈ LỄ & NGÀY LÀM BÙ
// =========================================================================
function WorkHolidaysSection() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [days, setDays] = useState<HrWorkCalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fDate, setFDate] = useState(`${new Date().getFullYear()}-01-01`);
  const [fName, setFName] = useState('');
  const [fType, setFType] = useState<HrWorkCalendarDayType>('holiday');

  const [disableTarget, setDisableTarget] = useState<HrWorkCalendarDay | null>(null);
  const [disableReason, setDisableReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDays(await listHrWorkCalendar(year));
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không tải được lịch nghỉ lễ.');
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSync = async () => {
    setSyncing(true);
    try {
      setDays(await syncHrWorkCalendar(year));
      Alert.alert('Thành công', `Đã đồng bộ lịch nghỉ lễ năm ${year}.`);
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
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
          <Pressable
            onPress={() => {
              setEditingId(null);
              setFDate(`${year}-01-01`);
              setFName('');
              setFType('holiday');
              setFormOpen(true);
            }}
            style={styles.primaryBtn}
          >
            <Plus size={13} color={colors.white} />
            <Text style={styles.primaryBtnText}>Thêm ngày</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <Card style={styles.stateCard}>
          <ActivityIndicator size="small" color={colors.primary} />
        </Card>
      ) : !days.length ? (
        <Card style={styles.stateCard}>
          <Text style={styles.muted}>Chưa có ngày nghỉ lễ năm {year}. Bấm "Đồng bộ" để nạp lịch chuẩn.</Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {days.map((day) => (
            <Card key={day._id} style={[styles.card, !day.isApplied && { opacity: 0.55 }]}>
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
      <Modal visible={formOpen} transparent animationType="slide" onRequestClose={() => setFormOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setFormOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.headRow}>
              <Text style={styles.sheetTitle}>{editingId ? 'Sửa ngày công ty' : 'Thêm ngày công ty'}</Text>
              <Pressable onPress={() => setFormOpen(false)}>
                <Text style={styles.closeText}>Đóng</Text>
              </Pressable>
            </View>
            <Text style={styles.label}>Ngày (YYYY-MM-DD) *</Text>
            <TextInput value={fDate} onChangeText={setFDate} style={styles.field} />
            <Text style={styles.label}>Tên ngày *</Text>
            <TextInput value={fName} onChangeText={setFName} placeholder="VD: Tết Dương Lịch" style={styles.field} />
            <Text style={styles.label}>Loại ngày</Text>
            <View style={styles.wrapRow}>
              {(Object.keys(HOLIDAY_TYPE_LABELS) as HrWorkCalendarDayType[]).map((t) => (
                <Pressable key={t} onPress={() => setFType(t)} style={[styles.chip, fType === t && styles.chipActive]}>
                  <Text style={[styles.chipText, fType === t && styles.chipTextActive]}>
                    {HOLIDAY_TYPE_LABELS[t]}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={() => void onSaveDay()} style={styles.submitBtn}>
              <Text style={styles.submitBtnText}>Lưu thay đổi</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Disable Reason Modal */}
      <Modal visible={Boolean(disableTarget)} transparent animationType="slide" onRequestClose={() => setDisableTarget(null)}>
        <Pressable style={styles.backdrop} onPress={() => setDisableTarget(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.headRow}>
              <Text style={styles.sheetTitle}>Tắt áp dụng {disableTarget?.name}</Text>
              <Pressable onPress={() => setDisableTarget(null)}>
                <Text style={styles.closeText}>Đóng</Text>
              </Pressable>
            </View>
            <Text style={styles.label}>Lý do tắt áp dụng *</Text>
            <TextInput
              value={disableReason}
              onChangeText={setDisableReason}
              multiline
              placeholder="Nhập lý do chi tiết..."
              style={[styles.field, { minHeight: 72, textAlignVertical: 'top' }]}
            />
            <Pressable onPress={() => void onConfirmDisable()} style={styles.submitBtn}>
              <Text style={styles.submitBtnText}>Xác nhận</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
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
        placeholderTextColor={colors.muted}
        style={[styles.field, { marginBottom: 10 }]}
      />

      {loading ? (
        <Card style={styles.stateCard}>
          <ActivityIndicator size="small" color={colors.primary} />
        </Card>
      ) : !filtered.length ? (
        <Card style={styles.stateCard}>
          <Text style={styles.muted}>Không có nhân viên nào.</Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {filtered.map((emp) => {
            const custom = emp.workHoursConfig?.useCustom;
            return (
              <Card key={emp._id} onPress={() => openEdit(emp)} style={styles.card}>
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

      {/* Edit Work Hours Modal */}
      <Modal visible={Boolean(editing)} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <Pressable style={styles.backdrop} onPress={() => setEditing(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.headRow}>
              <Text numberOfLines={1} style={[styles.sheetTitle, { flex: 1 }]}>
                Giờ làm việc: {editing?.displayName || editing?.email}
              </Text>
              <Pressable onPress={() => setEditing(null)}>
                <Text style={styles.closeText}>Đóng</Text>
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 500 }}>
              <View style={{ gap: 8, paddingBottom: 10 }}>
                <View style={styles.switchRow}>
                  <Text style={styles.label}>Dùng giờ làm việc riêng</Text>
                  <Switch
                    value={form.useCustom}
                    onValueChange={(v) => setForm((f) => ({ ...f, useCustom: v }))}
                    trackColor={{ true: colors.primary, false: '#CBD5E1' }}
                  />
                </View>

                <Text style={styles.label}>Trạng thái nhân sự</Text>
                <View style={styles.wrapRow}>
                  {(['official', 'probation', 'internship'] as const).map((st) => (
                    <Pressable
                      key={st}
                      onPress={() => setForm((f) => ({ ...f, employmentStatus: st }))}
                      style={[styles.chip, form.employmentStatus === st && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, form.employmentStatus === st && styles.chipTextActive]}>
                        {EMPLOYMENT_STATUS_LABELS[st]}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Ngày chính thức</Text>
                    <TextInput
                      value={form.officialDate || ''}
                      onChangeText={(v) => setForm((f) => ({ ...f, officialDate: v }))}
                      placeholder="YYYY-MM-DD"
                      style={styles.field}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Phép năm riêng</Text>
                    <TextInput
                      value={form.annualLeaveDays != null ? String(form.annualLeaveDays) : ''}
                      onChangeText={(v) =>
                        setForm((f) => ({ ...f, annualLeaveDays: v.trim() === '' ? undefined : Number(v) }))
                      }
                      keyboardType="numeric"
                      placeholder="Theo công ty"
                      style={styles.field}
                    />
                  </View>
                </View>

                {form.useCustom ? (
                  <>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Giờ vào (HH:mm)</Text>
                        <TextInput
                          value={form.checkInLimit || ''}
                          onChangeText={(v) => setForm((f) => ({ ...f, checkInLimit: v }))}
                          style={styles.field}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Giờ ra (HH:mm)</Text>
                        <TextInput
                          value={form.checkOutLimit || ''}
                          onChangeText={(v) => setForm((f) => ({ ...f, checkOutLimit: v }))}
                          style={styles.field}
                        />
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Nghỉ trưa từ</Text>
                        <TextInput
                          value={form.lunchBreakStart || ''}
                          onChangeText={(v) => setForm((f) => ({ ...f, lunchBreakStart: v }))}
                          style={styles.field}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Đến</Text>
                        <TextInput
                          value={form.lunchBreakEnd || ''}
                          onChangeText={(v) => setForm((f) => ({ ...f, lunchBreakEnd: v }))}
                          style={styles.field}
                        />
                      </View>
                    </View>
                    <Text style={styles.label}>Ngày làm việc</Text>
                    <View style={styles.wrapRow}>
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
                  </>
                ) : (
                  <Text style={styles.muted}>Nhân viên này đang áp dụng giờ làm việc chung của công ty.</Text>
                )}

                <Pressable disabled={saving} onPress={() => void onSave()} style={[styles.submitBtn, saving && styles.disabled]}>
                  <Text style={styles.submitBtnText}>{saving ? 'Đang lưu...' : 'Lưu cấu hình'}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  subTabScroll: { flexGrow: 0, marginBottom: 10 },
  subTabRow: { paddingHorizontal: 18, gap: 6 },
  subTabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EAF2FF',
    borderColor: '#D6E5FF',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  subTabPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  subTabText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  subTabTextActive: { color: colors.white },

  content: { paddingHorizontal: 18, paddingBottom: 28 },
  segmentRow: { flexDirection: 'row', backgroundColor: '#E2E8F0', borderRadius: 11, padding: 3, marginBottom: 12 },
  segmentBtn: { flex: 1, paddingVertical: 7, borderRadius: 9, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: colors.white },
  segmentText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  segmentTextActive: { color: colors.ink },

  checkRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  checkBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 42, borderRadius: 12 },
  checkInBtn: { backgroundColor: '#16885A' },
  checkOutBtn: { backgroundColor: '#D97706' },
  checkBtnText: { color: colors.white, fontSize: 12, fontWeight: '800' },

  dateBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 8, marginBottom: 10 },
  dateBarText: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  iconBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' },

  kpiRow: { flexDirection: 'row', gap: 7, marginBottom: 12 },
  kpiBox: { flex: 1, backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, borderRadius: 11, paddingVertical: 8, alignItems: 'center' },
  kpiVal: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  kpiLabel: { color: colors.muted, fontSize: 9, fontWeight: '700', marginTop: 2 },

  calCard: { padding: 10, marginTop: 10, marginBottom: 12 },
  calHeaderRow: { flexDirection: 'row', marginBottom: 6 },
  calHeaderText: { width: '14.285%', textAlign: 'center', color: colors.muted, fontSize: 10, fontWeight: '700' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: '14.285%', height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  calCellToday: { backgroundColor: '#EAF2FF' },
  calCellSelected: { backgroundColor: colors.primary },
  calDayNum: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  dotRow: { flexDirection: 'row', gap: 3, marginTop: 2, height: 5 },
  dot: { width: 4, height: 4, borderRadius: 2 },

  list: { gap: 9 },
  card: { padding: 12, gap: 5 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  subMeta: { color: colors.muted, fontSize: 10 },
  sectionTitle: { color: colors.ink, fontSize: 13, fontWeight: '800', marginBottom: 8 },
  badgeInfo: { color: colors.primary, backgroundColor: '#EAF2FF', fontSize: 9, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },
  badgeNeutral: { color: colors.muted, backgroundColor: '#F1F5F9', fontSize: 9, fontWeight: '700', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  timeBadge: { color: colors.ink, backgroundColor: '#F8FAFC', borderColor: colors.border, borderWidth: 1, fontSize: 10, fontWeight: '700', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  modeToggle: { flexDirection: 'row', backgroundColor: '#E2E8F0', borderRadius: 9, padding: 2 },
  modeToggleBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 7 },
  modeToggleActive: { backgroundColor: colors.primary },
  modeToggleText: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  modeToggleTextActive: { color: colors.white },
  tableWrap: { flexDirection: 'row', backgroundColor: colors.white, borderColor: '#DCE7F4', borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  tableLeft: { width: 174, borderRightWidth: 1.5, borderRightColor: '#BCEAFF', backgroundColor: colors.white },
  tableHeaderRow: { flexDirection: 'row', alignItems: 'center', height: 46, backgroundColor: '#E8F7FF', borderBottomWidth: 1, borderBottomColor: '#DCE7F4' },
  tableHeaderLeft: { paddingLeft: 2 },
  thText: { color: '#007EB8', fontSize: 10, fontWeight: '800' },
  thTotalCol: { width: 44, textAlign: 'center', backgroundColor: '#D8F2FF', height: '100%', textAlignVertical: 'center', paddingTop: 15 },
  tableBodyRow: { flexDirection: 'row', alignItems: 'center', height: 48, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5EEF8', backgroundColor: colors.white },
  tableRowAlt: { backgroundColor: '#F8FBFF' },
  tdIndex: { width: 24, textAlign: 'center', color: colors.muted, fontSize: 10, fontWeight: '700' },
  tdNameWrap: { flex: 1, paddingHorizontal: 4 },
  tdName: { color: '#007EB8', fontSize: 11, fontWeight: '700' },
  tdSub: { color: colors.muted, fontSize: 9 },
  tdTotalCol: { width: 44, height: '100%', backgroundColor: '#F0FAFF', alignItems: 'center', justifyContent: 'center', borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: '#BCEAFF' },
  tdTotalVal: { color: '#008DCC', fontSize: 11, fontWeight: '800' },
  dayHeaderCell: { width: 48, height: 46, alignItems: 'center', justifyContent: 'center', borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: '#DCE7F4', backgroundColor: '#E8F7FF' },
  dayHeaderWeekend: { backgroundColor: '#F3F7FB' },
  dayHeaderToday: { backgroundColor: '#C8EEFF' },
  dayDowText: { color: '#007EB8', fontSize: 9, fontWeight: '700' },
  dayNumText: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  dayCell: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: '#E5EEF8', paddingHorizontal: 2 },
  dayCellWeekend: { backgroundColor: '#F3F7FB' },
  dayCellToday: { backgroundColor: '#F0FAFF' },
  dayCellDash: { color: '#94A3B8', fontSize: 11 },
  dayCellDot: { color: '#CBD5E1', fontSize: 14 },
  dayCellVal: { fontSize: 12, fontWeight: '800', lineHeight: 15 },
  dayCellStatus: { fontSize: 8.5, fontWeight: '700', marginTop: 1 },
  colorDot: { width: 12, height: 12, borderRadius: 6 },

  stateCard: { padding: 20, alignItems: 'center', gap: 10 },
  errorText: { color: '#B91C1C', fontSize: 12, textAlign: 'center' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10 },
  primaryBtnText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  outlineBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  outlineBtnText: { color: colors.primary, fontSize: 11, fontWeight: '700' },

  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.42)', justifyContent: 'center', padding: 16 },
  sheet: { backgroundColor: colors.white, borderRadius: 24, overflow: 'hidden', padding: 18, gap: 8, maxHeight: '88%' },
  sheetTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  closeText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  label: { color: colors.ink, fontSize: 11, fontWeight: '700', marginTop: 2 },
  field: { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8, fontSize: 12, color: colors.ink },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  chipTextActive: { color: colors.white },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  submitBtn: { backgroundColor: colors.primary, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  submitBtnText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  disabled: { opacity: 0.45 },
});

