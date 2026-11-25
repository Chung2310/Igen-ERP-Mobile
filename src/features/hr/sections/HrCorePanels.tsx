import { PopupError } from '@/components/PopupError';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LogIn, LogOut, Plus, RefreshCw } from 'lucide-react-native';
import { Card } from '@/components/Card';
import {
  createKanbanTask,
  createLeaveApplication,
  listAttendanceRecords,
  listHrEmployees,
  listKanbanTasks,
  listLeaveApplications,
  submitCheckIn,
  submitCheckOut,
  updateKanbanTaskStatus,
  updateLeaveStatus,
} from '@/features/hr/hrApi';
import type {
  HrAttendanceRecord,
  HrEmployee,
  HrKanbanTask,
  HrLeaveApplication,
} from '@/features/hr/types';
import { getTodayKey } from '@/features/overview/overviewPeriod';
import { colors } from '@/theme/colors';

function getInitials(name?: string) {
  return (
    name
      ?.trim()
      .split(/\s+/)
      .slice(-2)
      .map((p) => p[0]?.toLocaleUpperCase('vi'))
      .join('') || 'NV'
  );
}

// --- 1. Employees Panel ---
export function EmployeesPanel({
  companyCode,
  branchId,
}: {
  companyCode?: string;
  branchId?: string;
}) {
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEmployees(await listHrEmployees(companyCode, branchId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách nhân sự.');
    } finally {
      setLoading(false);
    }
  }, [branchId, companyCode]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.displayName?.toLowerCase().includes(q) ||
        e.email?.toLowerCase().includes(q) ||
        e.department?.toLowerCase().includes(q) ||
        e.position?.toLowerCase().includes(q),
    );
  }, [employees, search]);

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Danh sách nhân sự ({employees.length})</Text>
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Tìm theo tên, email, phòng ban..."
        placeholderTextColor={colors.muted}
        style={styles.search}
      />

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
      ) : !filtered.length ? (
        <Card style={styles.stateCard}>
          <Text style={styles.muted}>Không tìm thấy nhân sự phù hợp.</Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {filtered.map((emp, idx) => (
            <Card key={emp._id || emp.id || emp.email || idx} style={styles.rowCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(emp.displayName)}</Text>
              </View>
              <View style={styles.copy}>
                <Text numberOfLines={1} style={styles.rowTitle}>
                  {emp.displayName}
                </Text>
                <Text numberOfLines={1} style={styles.muted}>
                  {emp.position || emp.role || 'Nhân viên'}
                  {emp.department ? ` · ${emp.department}` : ''}
                </Text>
                {emp.email ? (
                  <Text numberOfLines={1} style={styles.subMeta}>
                    {emp.email}
                  </Text>
                ) : null}
              </View>
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// --- 2. Attendance Panel ---
export function AttendancePanel({ branchId }: { branchId?: string }) {
  const [records, setRecords] = useState<HrAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState<'in' | 'out' | null>(null);
  const today = useMemo(() => getTodayKey(), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRecords(await listAttendanceRecords(today, branchId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được dữ liệu chấm công.');
    } finally {
      setLoading(false);
    }
  }, [branchId, today]);

  useEffect(() => {
    void load();
  }, [load]);

  const onCheck = useCallback(
    async (type: 'in' | 'out') => {
      setChecking(type);
      try {
        const res = type === 'in' ? await submitCheckIn(branchId) : await submitCheckOut(branchId);
        Alert.alert(
          type === 'in' ? 'Chấm công vào thành công' : 'Chấm công ra thành công',
          res?.message || 'Đã ghi nhận lên hệ thống ERP.',
        );
        void load();
      } catch (err) {
        Alert.alert(
          'Chưa thể chấm công',
          err instanceof Error ? err.message : 'Vui lòng kiểm tra cấu hình chấm công.',
        );
      } finally {
        setChecking(null);
      }
    },
    [branchId, load],
  );

  const checkedInCount = records.filter((r) => Boolean(r.checkIn)).length;
  const lateCount = records.filter((r) => r.attendanceStatus?.includes('muộn')).length;

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Chấm công hôm nay ({today})</Text>

      <View style={styles.checkActions}>
        <Pressable
          disabled={checking !== null}
          onPress={() => void onCheck('in')}
          style={[styles.checkInBtn, checking !== null && styles.disabled]}
        >
          <View style={styles.iconButtonContent}>
            {checking === 'in' ? null : <LogIn size={15} color={colors.white} />}
            <Text style={styles.checkBtnText}>{checking === 'in' ? 'Đang gửi...' : 'Chấm công vào'}</Text>
          </View>
        </Pressable>
        <Pressable
          disabled={checking !== null}
          onPress={() => void onCheck('out')}
          style={[styles.checkOutBtn, checking !== null && styles.disabled]}
        >
          <View style={styles.iconButtonContent}>
            {checking === 'out' ? null : <LogOut size={15} color={colors.primary} />}
            <Text style={styles.checkOutText}>{checking === 'out' ? 'Đang gửi...' : 'Chấm công ra'}</Text>
          </View>
        </Pressable>
      </View>

      <View style={styles.statRow}>
        <Card style={styles.statBox}>
          <Text style={styles.statVal}>{checkedInCount}</Text>
          <Text style={styles.muted}>Đã chấm công</Text>
        </Card>
        <Card style={styles.statBox}>
          <Text style={[styles.statVal, { color: '#C27617' }]}>{lateCount}</Text>
          <Text style={styles.muted}>Đi muộn</Text>
        </Card>
        <Card style={styles.statBox}>
          <Text style={styles.statVal}>{records.length}</Text>
          <Text style={styles.muted}>Tổng bản ghi</Text>
        </Card>
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
      ) : !records.length ? (
        <Card style={styles.stateCard}>
          <Text style={styles.muted}>Chưa có dữ liệu chấm công trong ngày.</Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {records.slice(0, 40).map((rec, idx) => (
            <Card key={rec._id || rec.id || idx} style={styles.rowCard}>
              <View style={styles.copy}>
                <Text numberOfLines={1} style={styles.rowTitle}>
                  {rec.employeeName || rec.displayName || 'Nhân sự'}
                </Text>
                <Text style={styles.muted}>
                  Vào: {rec.checkIn ? rec.checkIn.slice(11, 16) : '—'} · Ra:{' '}
                  {rec.checkOut ? rec.checkOut.slice(11, 16) : '—'}
                </Text>
              </View>
              <Text style={styles.pillBadge}>{rec.attendanceStatus || 'Chưa chấm'}</Text>
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// --- 3. Kanban Tasks Panel ---
const TASK_STATUSES = [
  { key: 'all', label: 'Tất cả' },
  { key: 'todo', label: 'Cần làm' },
  { key: 'in_progress', label: 'Đang làm' },
  { key: 'done', label: 'Hoàn thành' },
] as const;

function nextStatus(status: string): string {
  if (status === 'todo') return 'in_progress';
  if (status === 'in_progress' || status === 'doing') return 'done';
  return 'todo';
}

function statusLabel(status: string): string {
  if (status === 'todo') return 'Cần làm';
  if (status === 'in_progress' || status === 'doing') return 'Đang làm';
  if (status === 'done') return 'Hoàn thành';
  return status;
}

export function TasksPanel({ branchId }: { branchId?: string }) {
  const [tasks, setTasks] = useState<HrKanbanTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTasks(await listKanbanTasks(branchId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách công việc.');
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onAdvance = useCallback(
    async (task: HrKanbanTask) => {
      const target = nextStatus(task.status);
      try {
        const updated = await updateKanbanTaskStatus(task.id, target, branchId);
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      } catch (err) {
        Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể đổi trạng thái.');
      }
    },
    [branchId],
  );

  const onCreate = useCallback(async () => {
    if (!title.trim()) {
      Alert.alert('Thiếu tiêu đề', 'Hãy nhập tên công việc.');
      return;
    }
    setSaving(true);
    try {
      const created = await createKanbanTask({ title: title.trim(), description: desc.trim() }, branchId);
      setTasks((prev) => [created, ...prev]);
      setCreateOpen(false);
      setTitle('');
      setDesc('');
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể tạo công việc.');
    } finally {
      setSaving(false);
    }
  }, [branchId, desc, title]);

  const filtered = useMemo(() => {
    if (filter === 'all') return tasks;
    if (filter === 'in_progress') {
      return tasks.filter((t) => t.status === 'in_progress' || t.status === 'doing');
    }
    return tasks.filter((t) => t.status === filter);
  }, [filter, tasks]);

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.headRow}>
        <Text style={styles.title}>Giao việc ({tasks.length})</Text>
        <Pressable onPress={() => setCreateOpen(true)} style={styles.primaryBtn}>
          <View style={styles.iconButtonContent}><Plus size={13} color={colors.white} /><Text style={styles.primaryBtnText}>Giao việc</Text></View>
        </Pressable>
      </View>

      <View style={styles.chipRow}>
        {TASK_STATUSES.map((st) => {
          const active = filter === st.key;
          return (
            <Pressable
              key={st.key}
              onPress={() => setFilter(st.key)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{st.label}</Text>
            </Pressable>
          );
        })}
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
      ) : !filtered.length ? (
        <Card style={styles.stateCard}>
          <Text style={styles.muted}>Chưa có công việc nào trong mục này.</Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {filtered.slice(0, 40).map((task) => (
            <Card key={task.id} style={styles.taskCard}>
              <View style={styles.headRow}>
                <Text numberOfLines={2} style={[styles.rowTitle, { flex: 1 }]}>
                  {task.title}
                </Text>
                <Pressable onPress={() => void onAdvance(task)} style={styles.statusTap}>
                  <View style={styles.iconButtonContent}><Text style={styles.pillBadge}>{statusLabel(task.status)}</Text><RefreshCw size={12} color={colors.primary} /></View>
                </Pressable>
              </View>
              {task.description ? (
                <Text numberOfLines={2} style={styles.muted}>
                  {task.description}
                </Text>
              ) : null}
              <Text style={styles.subMeta}>
                {task.assigneeName || task.assignee || 'Chưa phân công'}
                {task.dueDate ? ` · Hạn: ${task.dueDate.slice(0, 10)}` : ''}
              </Text>
            </Card>
          ))}
        </View>
      )}

      <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setCreateOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Tạo công việc mới</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Tên công việc..."
              placeholderTextColor={colors.muted}
              style={styles.field}
            />
            <TextInput
              value={desc}
              onChangeText={setDesc}
              placeholder="Mô tả chi tiết..."
              placeholderTextColor={colors.muted}
              multiline
              style={[styles.field, { minHeight: 80, textAlignVertical: 'top' }]}
            />
            <Pressable
              disabled={saving}
              onPress={() => void onCreate()}
              style={[styles.submitBtn, saving && styles.disabled]}
            >
              <Text style={styles.submitBtnText}>{saving ? 'Đang tạo...' : 'Tạo công việc'}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

// --- 4. Leave Applications Panel ---
export function LeavesPanel({
  companyCode,
  branchId,
  canApprove,
}: {
  companyCode?: string;
  branchId?: string;
  canApprove: boolean;
}) {
  const [apps, setApps] = useState<HrLeaveApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [leaveType, setLeaveType] = useState('Nghỉ phép năm');
  const [startDate, setStartDate] = useState(() => getTodayKey());
  const [endDate, setEndDate] = useState(() => getTodayKey());
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setApps(await listLeaveApplications(companyCode, branchId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách đơn từ.');
    } finally {
      setLoading(false);
    }
  }, [branchId, companyCode]);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreate = useCallback(async () => {
    if (!reason.trim()) {
      Alert.alert('Thiếu lý do', 'Hãy nhập lý do xin nghỉ / đề xuất.');
      return;
    }
    setSaving(true);
    try {
      const created = await createLeaveApplication(
        { companyCode, leaveType, startDate, endDate, reason: reason.trim() },
        branchId,
      );
      setApps((prev) => [created, ...prev]);
      setCreateOpen(false);
      setReason('');
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể gửi đơn.');
    } finally {
      setSaving(false);
    }
  }, [branchId, companyCode, endDate, leaveType, reason, startDate]);

  const onDecide = useCallback(
    async (id: string, status: 'approved' | 'rejected') => {
      try {
        const updated = await updateLeaveStatus(id, status, branchId);
        setApps((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      } catch (err) {
        Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể cập nhật đơn.');
      }
    },
    [branchId],
  );

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.headRow}>
        <Text style={styles.title}>Đơn nghỉ phép & đề xuất</Text>
        <Pressable onPress={() => setCreateOpen(true)} style={styles.primaryBtn}>
          <View style={styles.iconButtonContent}><Plus size={13} color={colors.white} /><Text style={styles.primaryBtnText}>Tạo đơn</Text></View>
        </Pressable>
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
      ) : !apps.length ? (
        <Card style={styles.stateCard}>
          <Text style={styles.muted}>Chưa có đơn nghỉ phép nào.</Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {apps.slice(0, 30).map((app) => {
            const pending = !app.status || app.status === 'pending';
            return (
              <Card key={app.id} style={styles.taskCard}>
                <View style={styles.headRow}>
                  <Text numberOfLines={1} style={[styles.rowTitle, { flex: 1 }]}>
                    {app.employeeName || app.applicantName || 'Nhân sự'}
                  </Text>
                  <Text style={styles.pillBadge}>
                    {app.status === 'approved'
                      ? 'Đã duyệt'
                      : app.status === 'rejected'
                        ? 'Từ chối'
                        : 'Chờ duyệt'}
                  </Text>
                </View>
                <Text style={styles.muted}>
                  {app.leaveType || app.templateName || 'Đơn nghỉ phép'}
                  {app.startDate ? ` · ${app.startDate.slice(0, 10)}` : ''}
                  {app.endDate && app.endDate !== app.startDate ? ` đến ${app.endDate.slice(0, 10)}` : ''}
                </Text>
                {app.reason ? <Text style={styles.subMeta}>{app.reason}</Text> : null}
                {canApprove && pending ? (
                  <View style={styles.approveRow}>
                    <Pressable
                      onPress={() => void onDecide(app.id, 'rejected')}
                      style={styles.rejectBtn}
                    >
                      <Text style={styles.rejectBtnText}>Từ chối</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void onDecide(app.id, 'approved')}
                      style={styles.approveBtn}
                    >
                      <Text style={styles.approveBtnText}>Phê duyệt</Text>
                    </Pressable>
                  </View>
                ) : null}
              </Card>
            );
          })}
        </View>
      )}

      <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setCreateOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Tạo đơn nghỉ phép</Text>
            <TextInput
              value={leaveType}
              onChangeText={setLeaveType}
              placeholder="Loại đơn (VD: Nghỉ phép năm)"
              placeholderTextColor={colors.muted}
              style={styles.field}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                value={startDate}
                onChangeText={setStartDate}
                placeholder="Từ ngày (YYYY-MM-DD)"
                placeholderTextColor={colors.muted}
                style={[styles.field, { flex: 1 }]}
              />
              <TextInput
                value={endDate}
                onChangeText={setEndDate}
                placeholder="Đến ngày (YYYY-MM-DD)"
                placeholderTextColor={colors.muted}
                style={[styles.field, { flex: 1 }]}
              />
            </View>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Lý do..."
              placeholderTextColor={colors.muted}
              multiline
              style={[styles.field, { minHeight: 74, textAlignVertical: 'top' }]}
            />
            <Pressable
              disabled={saving}
              onPress={() => void onCreate()}
              style={[styles.submitBtn, saving && styles.disabled]}
            >
              <Text style={styles.submitBtnText}>{saving ? 'Đang gửi...' : 'Gửi đơn'}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingBottom: 28 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  title: { color: colors.ink, fontSize: 16, fontWeight: '800', marginBottom: 8 },
  search: { backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, fontSize: 12, color: colors.ink, marginBottom: 12 },
  list: { gap: 9 },
  rowCard: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 11 },
  taskCard: { padding: 13, gap: 6 },
  avatar: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#DCE8FF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  copy: { flex: 1 },
  rowTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 11, marginTop: 2 },
  subMeta: { color: colors.muted, fontSize: 10, marginTop: 3 },
  pillBadge: { color: colors.primary, backgroundColor: '#EAF2FF', fontSize: 10, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99, overflow: 'hidden' },
  statusTap: { flexShrink: 0 },
  primaryBtn: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  primaryBtnText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  iconButtonContent: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  stateCard: { padding: 20, alignItems: 'center', gap: 10 },
  errorText: { color: '#B91C1C', fontSize: 12, textAlign: 'center' },
  checkActions: { flexDirection: 'row', gap: 9, marginBottom: 12 },
  checkInBtn: { flex: 1, backgroundColor: '#16885A', minHeight: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  checkOutBtn: { flex: 1, backgroundColor: '#FFF3E5', borderColor: '#F6D1A2', borderWidth: 1, minHeight: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  checkBtnText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  checkOutText: { color: '#C27617', fontSize: 12, fontWeight: '700' },
  statRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statBox: { flex: 1, padding: 11, alignItems: 'center' },
  statVal: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 },
  chip: { backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 99 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  chipTextActive: { color: colors.white },
  approveRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  rejectBtn: { flex: 1, minHeight: 36, borderRadius: 10, backgroundColor: '#FCEBEC', alignItems: 'center', justifyContent: 'center' },
  rejectBtnText: { color: '#C74848', fontSize: 11, fontWeight: '700' },
  approveBtn: { flex: 1, minHeight: 36, borderRadius: 10, backgroundColor: '#16885A', alignItems: 'center', justifyContent: 'center' },
  approveBtnText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.42)', justifyContent: 'center', padding: 16 },
  sheet: { backgroundColor: colors.white, borderRadius: 24, overflow: 'hidden', padding: 18, gap: 10 },
  sheetTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  field: { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, fontSize: 12, color: colors.ink },
  submitBtn: { backgroundColor: colors.primary, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  submitBtnText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  disabled: { opacity: 0.45 },
});

