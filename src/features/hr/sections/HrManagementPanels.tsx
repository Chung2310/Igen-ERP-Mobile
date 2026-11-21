import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ChevronRight, Plus } from 'lucide-react-native';
import { Card } from '@/components/Card';
import { showHrConfirm } from '@/features/hr/components/HrConfirmModal';
import {
  createHrDepartment,
  deleteHrDepartment,
  getPayrollPeriodResults,
  listHrContracts,
  listHrDepartments,
  listHrEmployees,
  listHrWorkflows,
  listMyPayslips,
  listRecruitmentApplicants,
  listRecruitmentJobs,
  listTrainingCourses,
  updateHrDepartment,
} from '@/features/hr/hrApi';
import type {
  HrContract,
  HrDepartment,
  HrEmployee,
  HrPayslip,
  HrRecruitmentApplicant,
  HrRecruitmentJob,
  HrTrainingCourse,
  HrWorkflow,
} from '@/features/hr/types';
import { formatCompactMoney, getTodayKey } from '@/features/overview/overviewPeriod';
import { colors } from '@/theme/colors';

// --- 1. Contracts Panel ---
export function ContractsPanel({
  companyCode,
  branchId,
}: {
  companyCode?: string;
  branchId?: string;
}) {
  const [contracts, setContracts] = useState<HrContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setContracts(await listHrContracts(companyCode, branchId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách hợp đồng.');
    } finally {
      setLoading(false);
    }
  }, [branchId, companyCode]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Hợp đồng lao động ({contracts.length})</Text>
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
      ) : !contracts.length ? (
        <Card style={styles.stateCard}>
          <Text style={styles.muted}>Chưa có hợp đồng lao động nào.</Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {contracts.slice(0, 40).map((c) => (
            <Card key={c._id} style={styles.card}>
              <View style={styles.headRow}>
                <Text numberOfLines={1} style={[styles.rowTitle, { flex: 1 }]}>
                  {c.employeeName || c.employeeEmail || 'Nhân sự'}
                </Text>
                <Text style={styles.badge}>{c.status || 'Hiệu lực'}</Text>
              </View>
              <Text style={styles.muted}>
                {c.contractNumber ? `Số HĐ: ${c.contractNumber} · ` : ''}
                {c.contractType || 'Hợp đồng lao động'}
              </Text>
              <Text style={styles.subMeta}>
                {c.startDate ? `Từ ${c.startDate.slice(0, 10)}` : ''}
                {c.endDate ? ` đến ${c.endDate.slice(0, 10)}` : ' · Không xác định thời hạn'}
                {c.baseSalary ? ` · Lương: ${formatCompactMoney(c.baseSalary)}` : ''}
              </Text>
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// --- 2. Departments Panel (Xem chi tiết, Thêm, Sửa, Xóa) ---
export function DepartmentsPanel({
  companyCode,
  canManage,
}: {
  companyCode?: string;
  canManage: boolean;
}) {
  const [departments, setDepartments] = useState<HrDepartment[]>([]);
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Detail & Edit modal
  const [selectedDept, setSelectedDept] = useState<HrDepartment | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Create / Edit form fields
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [desc, setDesc] = useState('');
  const [managerUid, setManagerUid] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!companyCode) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [deptList, empList] = await Promise.all([
        listHrDepartments(companyCode),
        listHrEmployees(companyCode).catch(() => []),
      ]);
      setDepartments(deptList);
      setEmployees(empList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách phòng ban.');
    } finally {
      setLoading(false);
    }
  }, [companyCode]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return departments;
    return departments.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        (d.code || '').toLowerCase().includes(q) ||
        (d.managerName || '').toLowerCase().includes(q) ||
        (d.description || '').toLowerCase().includes(q),
    );
  }, [departments, search]);

  const selectedMembers = useMemo(() => {
    if (!selectedDept) return [];
    const target = selectedDept.name.trim().toLowerCase();
    return employees.filter((e) => (e.department || '').trim().toLowerCase() === target);
  }, [employees, selectedDept]);

  const openCreate = useCallback(() => {
    setName('');
    setCode('');
    setDesc('');
    setManagerUid('');
    setIsActive(true);
    setCreateOpen(true);
  }, []);

  const openDetail = useCallback((dept: HrDepartment) => {
    setSelectedDept(dept);
    setIsEditing(false);
  }, []);

  const startEdit = useCallback(() => {
    if (!selectedDept) return;
    setName(selectedDept.name || '');
    setCode(selectedDept.code || '');
    setDesc(selectedDept.description || '');
    setManagerUid(selectedDept.managerUid || '');
    setIsActive(selectedDept.isActive !== false);
    setIsEditing(true);
  }, [selectedDept]);

  const onCreate = useCallback(async () => {
    if (!companyCode || !name.trim()) {
      Alert.alert('Thiếu tên phòng ban', 'Hãy nhập tên phòng ban.');
      return;
    }
    setSaving(true);
    try {
      const created = await createHrDepartment(companyCode, {
        name: name.trim(),
        code: code.trim() || undefined,
        description: desc.trim() || undefined,
        managerUid: managerUid || undefined,
        isActive,
      });
      setDepartments((prev) => [created, ...prev]);
      setCreateOpen(false);
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể tạo phòng ban.');
    } finally {
      setSaving(false);
    }
  }, [code, companyCode, desc, isActive, managerUid, name]);

  const onSaveEdit = useCallback(async () => {
    if (!companyCode || !selectedDept || !name.trim() || saving) {
      if (!name.trim()) Alert.alert('Thiếu tên phòng ban', 'Hãy nhập tên phòng ban.');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateHrDepartment(companyCode, selectedDept.id, {
        name: name.trim(),
        code: code.trim() || undefined,
        description: desc.trim() || undefined,
        managerUid: managerUid || undefined,
        isActive,
      });
      setDepartments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      setSelectedDept(updated);
      setIsEditing(false);
      Alert.alert('Đã lưu', 'Cập nhật phòng ban thành công.');
    } catch (err) {
      Alert.alert('Lỗi cập nhật', err instanceof Error ? err.message : 'Không thể cập nhật phòng ban.');
    } finally {
      setSaving(false);
    }
  }, [code, companyCode, desc, isActive, managerUid, name, saving, selectedDept]);

  const onDelete = useCallback(
    (dept: HrDepartment) => {
      if (!companyCode) return;
      showHrConfirm({
        title: 'Xóa phòng ban?',
        message: `Bạn có chắc chắn muốn xóa phòng ban "${dept.name}"?`,
        confirmLabel: 'Xóa phòng ban',
        onConfirm: async () => {
          try {
            await deleteHrDepartment(companyCode, dept.id);
            setDepartments((prev) => prev.filter((d) => d.id !== dept.id));
            setSelectedDept(null);
          } catch (err) {
            Alert.alert('Không thể xóa', err instanceof Error ? err.message : 'Vui lòng thử lại.');
          }
        },
      });
    },
    [companyCode],
  );

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.searchRow}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Tìm theo tên, mã phòng ban, trưởng phòng..."
          placeholderTextColor={colors.muted}
          style={[styles.field, { flex: 1 }]}
        />
        {canManage ? (
          <Pressable onPress={openCreate} style={styles.primaryBtn}>
            <View style={styles.iconButtonContent}><Plus size={13} color={colors.white} /><Text style={styles.primaryBtnText}>Thêm</Text></View>
          </Pressable>
        ) : null}
      </View>

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
      ) : !filtered.length ? (
        <Card style={styles.stateCard}>
          <Text style={styles.muted}>Chưa có phòng ban nào phù hợp.</Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {filtered.map((dept) => (
            <Card key={dept.id} onPress={() => openDetail(dept)} style={styles.card}>
              <View style={styles.headRow}>
                <Text numberOfLines={1} style={[styles.rowTitle, { flex: 1 }]}>
                  {dept.name}
                  {dept.code ? ` (${dept.code})` : ''}
                </Text>
                <View style={styles.departmentCount}><Text style={styles.badge}>{dept.employeeCount ?? 0} nhân sự</Text><ChevronRight size={13} color={colors.muted} /></View>
              </View>
              {dept.managerName ? (
                <Text style={styles.muted}>Trưởng phòng: {dept.managerName}</Text>
              ) : null}
              {dept.description ? (
                <Text numberOfLines={2} style={styles.subMeta}>
                  {dept.description}
                </Text>
              ) : null}
            </Card>
          ))}
        </View>
      )}

      {/* Detail & Edit Department Modal */}
      <Modal
        visible={Boolean(selectedDept)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedDept(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setSelectedDept(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            {selectedDept ? (
              <>
                <View style={styles.headRow}>
                  <Text numberOfLines={1} style={[styles.sheetTitle, { flex: 1 }]}>
                    {isEditing ? 'Chỉnh sửa phòng ban' : selectedDept.name}
                  </Text>
                  <Pressable onPress={() => setSelectedDept(null)} hitSlop={8}>
                    <Text style={styles.closeText}>Đóng</Text>
                  </Pressable>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
                  {isEditing ? (
                    <View style={{ gap: 8, paddingBottom: 10 }}>
                      <Text style={styles.label}>Tên phòng ban *</Text>
                      <TextInput value={name} onChangeText={setName} style={styles.field} />

                      <Text style={styles.label}>Mã phòng ban</Text>
                      <TextInput value={code} onChangeText={setCode} placeholder="VD: PB-KD" placeholderTextColor={colors.muted} style={styles.field} />

                      <Text style={styles.label}>Trưởng phòng</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 4 }}>
                        <Pressable
                          onPress={() => setManagerUid('')}
                          style={[styles.chip, !managerUid && styles.chipActive]}
                        >
                          <Text style={[styles.chipText, !managerUid && styles.chipTextActive]}>Chưa chỉ định</Text>
                        </Pressable>
                        {employees.slice(0, 25).map((emp) => {
                          const uid = emp.uid || emp._id || emp.id || '';
                          const active = managerUid === uid;
                          return (
                            <Pressable
                              key={uid}
                              onPress={() => setManagerUid(uid)}
                              style={[styles.chip, active && styles.chipActive]}
                            >
                              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                                {emp.displayName}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>

                      <Text style={styles.label}>Mô tả chức năng</Text>
                      <TextInput
                        value={desc}
                        onChangeText={setDesc}
                        multiline
                        style={[styles.field, { minHeight: 70, textAlignVertical: 'top' }]}
                      />

                      <View style={styles.switchRow}>
                        <Text style={styles.label}>Đang hoạt động</Text>
                        <Switch
                          value={isActive}
                          onValueChange={setIsActive}
                          trackColor={{ true: colors.primary, false: '#CBD5E1' }}
                        />
                      </View>

                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                        <Pressable
                          onPress={() => setIsEditing(false)}
                          style={styles.cancelBtn}
                        >
                          <Text style={styles.cancelBtnText}>Hủy</Text>
                        </Pressable>
                        <Pressable
                          disabled={saving}
                          onPress={() => void onSaveEdit()}
                          style={[styles.submitBtn, { flex: 1, marginTop: 0 }, saving && styles.disabled]}
                        >
                          <Text style={styles.submitBtnText}>
                            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <View style={{ gap: 10, paddingBottom: 10 }}>
                      <View style={styles.infoRow}>
                        <Text style={styles.muted}>Mã phòng ban</Text>
                        <Text style={styles.infoVal}>{selectedDept.code || '—'}</Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.muted}>Trưởng phòng</Text>
                        <Text style={styles.infoVal}>{selectedDept.managerName || 'Chưa chỉ định'}</Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.muted}>Trạng thái</Text>
                        <Text style={styles.infoVal}>
                          {selectedDept.isActive === false ? 'Tạm ngưng' : 'Đang hoạt động'}
                        </Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.muted}>Sĩ số</Text>
                        <Text style={styles.infoVal}>
                          {selectedDept.employeeCount ?? selectedMembers.length} nhân sự
                        </Text>
                      </View>
                      {selectedDept.description ? (
                        <View style={{ gap: 4 }}>
                          <Text style={styles.label}>Mô tả chức năng</Text>
                          <Text style={styles.muted}>{selectedDept.description}</Text>
                        </View>
                      ) : null}

                      <View style={{ gap: 6, marginTop: 4 }}>
                        <Text style={styles.label}>
                          Nhân sự trong phòng ({selectedMembers.length})
                        </Text>
                        {selectedMembers.length > 0 ? (
                          selectedMembers.slice(0, 15).map((m, idx) => (
                            <View key={m.uid || m._id || idx} style={styles.memberItem}>
                              <Text style={styles.rowTitle}>{m.displayName}</Text>
                              <Text style={styles.subMeta}>
                                {m.jobTitle || m.position || m.role || 'Nhân viên'}
                                {m.email ? ` · ${m.email}` : ''}
                              </Text>
                            </View>
                          ))
                        ) : (
                          <Text style={styles.muted}>Chưa có nhân sự nào thuộc phòng ban này.</Text>
                        )}
                      </View>

                      {canManage ? (
                        <View style={{ gap: 8, marginTop: 8 }}>
                          <Pressable onPress={startEdit} style={styles.submitBtn}>
                            <Text style={styles.submitBtnText}>Chỉnh sửa phòng ban</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => onDelete(selectedDept)}
                            style={styles.deleteBtn}
                          >
                            <Text style={styles.deleteBtnText}>Xóa phòng ban</Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  )}
                </ScrollView>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Create Department Modal */}
      <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setCreateOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.headRow}>
              <Text style={styles.sheetTitle}>Thêm phòng ban mới</Text>
              <Pressable onPress={() => setCreateOpen(false)} hitSlop={8}>
                <Text style={styles.closeText}>Đóng</Text>
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              <View style={{ gap: 8 }}>
                <Text style={styles.label}>Tên phòng ban *</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Tên phòng ban"
                  placeholderTextColor={colors.muted}
                  style={styles.field}
                />
                <Text style={styles.label}>Mã phòng ban</Text>
                <TextInput
                  value={code}
                  onChangeText={setCode}
                  placeholder="Mã phòng ban (tùy chọn)"
                  placeholderTextColor={colors.muted}
                  style={styles.field}
                />
                <Text style={styles.label}>Trưởng phòng</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 4 }}>
                  <Pressable
                    onPress={() => setManagerUid('')}
                    style={[styles.chip, !managerUid && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, !managerUid && styles.chipTextActive]}>Chưa chỉ định</Text>
                  </Pressable>
                  {employees.slice(0, 25).map((emp) => {
                    const uid = emp.uid || emp._id || emp.id || '';
                    const active = managerUid === uid;
                    return (
                      <Pressable
                        key={uid}
                        onPress={() => setManagerUid(uid)}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {emp.displayName}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <Text style={styles.label}>Mô tả chức năng</Text>
                <TextInput
                  value={desc}
                  onChangeText={setDesc}
                  placeholder="Mô tả chức năng"
                  placeholderTextColor={colors.muted}
                  multiline
                  style={[styles.field, { minHeight: 70, textAlignVertical: 'top' }]}
                />
                <Pressable
                  disabled={saving}
                  onPress={() => void onCreate()}
                  style={[styles.submitBtn, saving && styles.disabled]}
                >
                  <Text style={styles.submitBtnText}>{saving ? 'Đang lưu...' : 'Tạo phòng ban'}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

// --- 3. Recruitment Panel ---
export function RecruitmentPanel({ branchId }: { branchId?: string }) {
  const [sub, setSub] = useState<'jobs' | 'applicants'>('jobs');
  const [jobs, setJobs] = useState<HrRecruitmentJob[]>([]);
  const [applicants, setApplicants] = useState<HrRecruitmentApplicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [j, a] = await Promise.all([
        listRecruitmentJobs(branchId),
        listRecruitmentApplicants(branchId),
      ]);
      setJobs(j);
      setApplicants(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được dữ liệu tuyển dụng.');
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Tuyển dụng</Text>
      <View style={styles.subTabs}>
        <Pressable
          onPress={() => setSub('jobs')}
          style={[styles.chip, sub === 'jobs' && styles.chipActive]}
        >
          <Text style={[styles.chipText, sub === 'jobs' && styles.chipTextActive]}>
            Vị trí ({jobs.length})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setSub('applicants')}
          style={[styles.chip, sub === 'applicants' && styles.chipActive]}
        >
          <Text style={[styles.chipText, sub === 'applicants' && styles.chipTextActive]}>
            Ứng viên ({applicants.length})
          </Text>
        </Pressable>
      </View>

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
      ) : sub === 'jobs' ? (
        !jobs.length ? (
          <Card style={styles.stateCard}>
            <Text style={styles.muted}>Chưa có tin tuyển dụng nào.</Text>
          </Card>
        ) : (
          <View style={styles.list}>
            {jobs.map((job) => (
              <Card key={job.id} style={styles.card}>
                <View style={styles.headRow}>
                  <Text numberOfLines={1} style={[styles.rowTitle, { flex: 1 }]}>
                    {job.title}
                  </Text>
                  <Text style={styles.badge}>{job.status || 'Đang mở'}</Text>
                </View>
                <Text style={styles.muted}>
                  {job.department || 'Phòng ban'}
                  {job.headcount ? ` · Tuyển ${job.headcount} người` : ''}
                  {job.applicantCount != null ? ` · ${job.applicantCount} ứng viên` : ''}
                </Text>
              </Card>
            ))}
          </View>
        )
      ) : !applicants.length ? (
        <Card style={styles.stateCard}>
          <Text style={styles.muted}>Chưa có hồ sơ ứng viên nào.</Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {applicants.slice(0, 40).map((app) => (
            <Card key={app.id} style={styles.card}>
              <View style={styles.headRow}>
                <Text numberOfLines={1} style={[styles.rowTitle, { flex: 1 }]}>
                  {app.fullName}
                </Text>
                <Text style={styles.badge}>{app.stageName || app.status || 'Mới'}</Text>
              </View>
              <Text style={styles.muted}>
                {app.jobTitle || 'Ứng tuyển'}
                {app.phone ? ` · ${app.phone}` : ''}
              </Text>
              {app.email ? <Text style={styles.subMeta}>{app.email}</Text> : null}
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// --- 4. Training Panel ---
export function TrainingPanel({ companyCode }: { companyCode?: string }) {
  const [courses, setCourses] = useState<HrTrainingCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCourses(await listTrainingCourses(companyCode));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được khóa đào tạo.');
    } finally {
      setLoading(false);
    }
  }, [companyCode]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Đào tạo nội bộ ({courses.length})</Text>
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
      ) : !courses.length ? (
        <Card style={styles.stateCard}>
          <Text style={styles.muted}>Chưa có khóa đào tạo nào.</Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {courses.map((course) => (
            <Card key={course.id} style={styles.card}>
              <View style={styles.headRow}>
                <Text numberOfLines={2} style={[styles.rowTitle, { flex: 1 }]}>
                  {course.title || course.name || 'Khóa học'}
                </Text>
                <Text style={styles.badge}>{course.lessons?.length ?? 0} bài</Text>
              </View>
              {course.description ? (
                <Text numberOfLines={2} style={styles.muted}>
                  {course.description}
                </Text>
              ) : null}
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// --- 5. Workflows Panel ---
export function HrWorkflowsPanel({ companyCode }: { companyCode?: string }) {
  const [workflows, setWorkflows] = useState<HrWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setWorkflows(await listHrWorkflows(companyCode));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được quy trình nội bộ.');
    } finally {
      setLoading(false);
    }
  }, [companyCode]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Quy trình nội bộ ({workflows.length})</Text>
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
      ) : !workflows.length ? (
        <Card style={styles.stateCard}>
          <Text style={styles.muted}>Chưa có quy trình nội bộ nào.</Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {workflows.map((wf) => (
            <Card key={wf.id} style={styles.card}>
              <View style={styles.headRow}>
                <Text numberOfLines={2} style={[styles.rowTitle, { flex: 1 }]}>
                  {wf.title || wf.name || 'Quy trình'}
                </Text>
                <Text style={styles.badge}>{wf.steps?.length ?? 0} bước</Text>
              </View>
              {wf.description ? (
                <Text numberOfLines={2} style={styles.muted}>
                  {wf.description}
                </Text>
              ) : null}
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// --- 6. Payroll & Payslips Panel ---
export function PayrollPanel({
  branchId,
  canViewAll,
}: {
  branchId?: string;
  canViewAll: boolean;
}) {
  const [scope, setScope] = useState<'mine' | 'period'>(canViewAll ? 'period' : 'mine');
  const [rows, setRows] = useState<HrPayslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentPeriod = getTodayKey().slice(0, 7);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list =
        scope === 'period' && canViewAll
          ? await getPayrollPeriodResults(currentPeriod, branchId)
          : await listMyPayslips();
      setRows(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được dữ liệu bảng lương.');
    } finally {
      setLoading(false);
    }
  }, [branchId, canViewAll, currentPeriod, scope]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Bảng lương & Phiếu lương</Text>
      {canViewAll ? (
        <View style={styles.subTabs}>
          <Pressable
            onPress={() => setScope('period')}
            style={[styles.chip, scope === 'period' && styles.chipActive]}
          >
            <Text style={[styles.chipText, scope === 'period' && styles.chipTextActive]}>
              Kỳ {currentPeriod}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setScope('mine')}
            style={[styles.chip, scope === 'mine' && styles.chipActive]}
          >
            <Text style={[styles.chipText, scope === 'mine' && styles.chipTextActive]}>
              Phiếu lương của tôi
            </Text>
          </Pressable>
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
      ) : !rows.length ? (
        <Card style={styles.stateCard}>
          <Text style={styles.muted}>Chưa có dữ liệu bảng lương trong kỳ này.</Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {rows.slice(0, 40).map((row, idx) => (
            <Card key={row._id || row.id || row.runId || idx} style={styles.card}>
              <View style={styles.headRow}>
                <Text numberOfLines={1} style={[styles.rowTitle, { flex: 1 }]}>
                  {row.employeeName || `Kỳ lương ${row.periodKey || currentPeriod}`}
                </Text>
                <Text style={styles.moneyVal}>{formatCompactMoney(row.netSalary ?? row.grossSalary)}</Text>
              </View>
              <Text style={styles.muted}>
                Tổng thu nhập: {formatCompactMoney(row.grossSalary)} · Khấu trừ:{' '}
                {formatCompactMoney(row.totalDeductions ?? 0)}
              </Text>
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingBottom: 28 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 },
  title: { color: colors.ink, fontSize: 16, fontWeight: '800', marginBottom: 10 },
  list: { gap: 9 },
  card: { padding: 13, gap: 4 },
  rowTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  subMeta: { color: colors.muted, fontSize: 10, marginTop: 2 },
  badge: { color: colors.primary, backgroundColor: '#EAF2FF', fontSize: 10, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, overflow: 'hidden' },
  moneyVal: { color: '#16885A', fontSize: 13, fontWeight: '800' },
  subTabs: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  chip: { backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 99 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  chipTextActive: { color: colors.white },
  primaryBtn: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  primaryBtnText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  iconButtonContent: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  departmentCount: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  stateCard: { padding: 20, alignItems: 'center', gap: 10 },
  errorText: { color: '#B91C1C', fontSize: 12, textAlign: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.42)', justifyContent: 'center', padding: 16 },
  sheet: { backgroundColor: colors.white, borderRadius: 24, overflow: 'hidden', padding: 18, gap: 10, maxHeight: '86%' },
  sheetTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  closeText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  label: { color: colors.ink, fontSize: 11, fontWeight: '700', marginTop: 4 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingBottom: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  infoVal: { color: colors.ink, fontSize: 12, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  memberItem: { backgroundColor: '#F8FAFD', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: colors.border },
  cancelBtn: { backgroundColor: '#F1F5F9', minHeight: 44, paddingHorizontal: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  deleteBtn: { backgroundColor: '#FCEBEC', minHeight: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { color: '#C74848', fontSize: 12, fontWeight: '700' },
  field: { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, fontSize: 12, color: colors.ink },
  submitBtn: { backgroundColor: colors.primary, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  submitBtnText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  disabled: { opacity: 0.45 },
});

