import { CenteredPageLoader } from '@/components/BrandLoader';
import { PopupError } from '@/components/PopupError';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ComponentProps } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ChevronDown, Search, ShieldCheck, UserRound, UserRoundPlus, X } from 'lucide-react-native';
import { useAuth } from '@/core/auth/AuthProvider';
import { showHrConfirm } from '@/features/hr/components/HrConfirmModal';
import { listHrDepartments } from '@/features/hr/hrApi';
import {
  createManagedAccount,
  deleteManagedAccount,
  listManagedAccounts,
  updateManagedAccount,
  type ManagedAccount,
} from '@/features/accountsApi';
import type { FeatureScreenProps } from '@/features/modules/featureScreenRegistry';
import { colors } from '@/theme/colors';

const assignableRoles = [
  { value: 'user', label: 'Nhân viên' },
  { value: 'manager', label: 'Quản lý' },
  { value: 'branch_owner', label: 'Quản lý chi nhánh' },
  { value: 'admin', label: 'Admin' },
] as const;

type AccountForm = {
  displayName: string;
  email: string;
  password: string;
  phone: string;
  department: string;
  role: string;
  enabledModules: string;
  permissions: string;
};

const blankForm = (): AccountForm => ({
  displayName: '', email: '', password: '', phone: '', department: '', role: 'user', enabledModules: '', permissions: '',
});

const splitValues = (value: string) => [...new Set(value.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean))];

function roleLabel(role?: string) {
  return assignableRoles.find((item) => item.value === role)?.label ?? role ?? 'Chưa gán vai trò';
}

function accountIsActive(account: ManagedAccount) {
  return account.isActive !== false && !['inactive', 'disabled', 'suspended'].includes(account.status?.toLowerCase() || '');
}

function accountId(account: ManagedAccount) {
  return account._id || account.uid || account.id || '';
}

function toForm(account: ManagedAccount): AccountForm {
  return {
    displayName: account.displayName || '',
    email: account.email || '',
    password: '',
    phone: account.phone || '',
    department: account.department || '',
    role: account.role || 'user',
    enabledModules: (account.enabledModules || []).join(', '),
    permissions: (account.permissions || []).join(', '),
  };
}

export function AccountManagementScreen(_props: FeatureScreenProps) {
  const { user, activeBranchId } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'superadmin';
  const [accounts, setAccounts] = useState<ManagedAccount[]>([]);
  const [departmentNames, setDepartmentNames] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<ManagedAccount | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [departmentOpen, setDepartmentOpen] = useState(false);
  const [form, setForm] = useState<AccountForm>(blankForm);

  const loadAccounts = useCallback(async (showSpinner = true) => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    if (showSpinner) setLoading(true);
    try {
      const [rows, departments] = await Promise.all([
        listManagedAccounts(user?.companyCode, activeBranchId || user?.branchId),
        listHrDepartments(user?.companyCode || 'SYSTEM').catch(() => []),
      ]);
      setAccounts(rows);
      setDepartmentNames(departments.filter((item) => item.isActive !== false).map((item) => item.name.trim()).filter(Boolean));
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được danh sách tài khoản từ IGen-ERP.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeBranchId, canManage, user?.branchId, user?.companyCode]);

  useEffect(() => { void loadAccounts(); }, [loadAccounts]);

  const roles = useMemo(() => {
    const values = new Set(accounts.map((account) => account.role).filter(Boolean));
    return ['all', ...[...values].sort()];
  }, [accounts]);

  const departmentOptions = useMemo(() => [...new Set([
    ...departmentNames,
    ...accounts.map((account) => account.department || ''),
    form.department,
  ].map((name) => name.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi')),
  [accounts, departmentNames, form.department]);

  const visibleAccounts = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase('vi');
    return accounts.filter((account) => {
      const matchesSearch = !normalized || [account.displayName, account.email, account.phone, account.department]
        .some((value) => value?.toLocaleLowerCase('vi').includes(normalized));
      return matchesSearch && (roleFilter === 'all' || account.role === roleFilter);
    });
  }, [accounts, roleFilter, search]);

  function openCreate() {
    setEditing(null);
    setForm(blankForm());
    setDepartmentOpen(false);
    setCreating(true);
  }

  function openEdit(account: ManagedAccount) {
    if (account.role === 'superadmin') {
      Alert.alert('Không thể sửa tài khoản Super Admin', 'Tài khoản Super Admin được bảo vệ khỏi thao tác quản trị tại đây.');
      return;
    }
    setEditing(account);
    setForm(toForm(account));
    setDepartmentOpen(false);
    setCreating(false);
  }

  function closeForm() {
    if (saving) return;
    setEditing(null);
    setCreating(false);
    setDepartmentOpen(false);
  }

  function setField<K extends keyof AccountForm>(key: K, value: AccountForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const editingSelf = Boolean(editing && accountId(editing) === (user?._id || user?.id));

  async function saveAccount() {
    if (!form.displayName.trim() || !form.email.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập họ tên và email.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      Alert.alert('Email chưa hợp lệ', 'Kiểm tra lại địa chỉ email.');
      return;
    }
    if (creating && form.password.length < 6) {
      Alert.alert('Mật khẩu chưa hợp lệ', 'Mật khẩu ban đầu cần có ít nhất 6 ký tự.');
      return;
    }
    if (creating && ['user', 'manager'].includes(form.role) && !form.department.trim()) {
      Alert.alert('Thiếu phòng ban', 'Vui lòng nhập phòng ban cho nhân viên hoặc quản lý.');
      return;
    }
    if (!creating && !editing) return;

    setSaving(true);
    try {
      if (creating) {
        await createManagedAccount({
          displayName: form.displayName.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
          companyCode: user?.companyCode || 'SYSTEM',
          companyName: user?.companyName,
          branchId: activeBranchId || user?.branchId,
          phone: form.phone.trim() || undefined,
          department: form.department.trim() || undefined,
          ...(form.enabledModules.trim() ? { enabledModules: splitValues(form.enabledModules) } : {}),
          ...(form.permissions.trim() ? { permissions: splitValues(form.permissions) } : {}),
        });
      } else {
        const id = accountId(editing);
        if (!id) throw new Error('Tài khoản không có mã định danh để cập nhật.');
        if (editingSelf && form.role !== editing.role) {
          Alert.alert('Không thể đổi vai trò của chính mình', 'Nhờ một quản trị viên khác cập nhật vai trò tài khoản này.');
          return;
        }
        const update: Parameters<typeof updateManagedAccount>[1] = {
          displayName: form.displayName.trim(),
          role: form.role,
          phone: form.phone.trim(),
          department: form.department.trim(),
        };
        if (!editingSelf && JSON.stringify(splitValues(form.enabledModules)) !== JSON.stringify(editing.enabledModules || [])) {
          update.enabledModules = splitValues(form.enabledModules);
        }
        if (!editingSelf && JSON.stringify(splitValues(form.permissions)) !== JSON.stringify(editing.permissions || [])) {
          update.permissions = splitValues(form.permissions);
        }
        await updateManagedAccount(id, update, activeBranchId || user?.branchId);
      }
      setEditing(null);
      setCreating(false);
      await loadAccounts(false);
    } catch (cause) {
      Alert.alert('Chưa lưu được tài khoản', cause instanceof Error ? cause.message : 'IGen-ERP không lưu được thay đổi.');
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(account: ManagedAccount) {
    if (account.role === 'superadmin' || accountId(account) === (user?._id || user?.id)) {
      Alert.alert('Không thể xóa tài khoản này', 'Tài khoản Super Admin và tài khoản đang đăng nhập được bảo vệ.');
      return;
    }
    const id = accountId(account);
    if (!id) return;
    showHrConfirm({
      title: 'Xóa tài khoản?',
      message: `Tài khoản ${account.displayName} (${account.email}) sẽ bị xóa khỏi doanh nghiệp.`,
      confirmLabel: 'Xóa tài khoản',
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteManagedAccount(id);
          await loadAccounts(false);
        } catch (cause) {
          Alert.alert('Chưa xóa được tài khoản', cause instanceof Error ? cause.message : 'IGen-ERP không xóa được tài khoản.');
        }
      },
    });
  }

  if (!canManage) {
    return (
      <View style={styles.permissionState}>
        <ShieldCheck size={30} color={colors.primary} />
        <Text style={styles.permissionTitle}>Chỉ quản trị viên mới được dùng chức năng này</Text>
        <Text style={styles.permissionCopy}>Tài khoản hiện tại cần vai trò Admin hoặc Super Admin để quản lý thành viên và quyền truy cập.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadAccounts(false); }} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.toolbar}>
          <View style={[styles.searchBox, styles.toolbarSearch]}>
            <Search size={17} color={colors.muted} />
            <TextInput value={search} onChangeText={setSearch} placeholder="Tìm tên, email, số điện thoại" placeholderTextColor={colors.muted} style={styles.searchInput} returnKeyType="search" />
            {search.length > 0 && <Pressable onPress={() => setSearch('')} accessibilityLabel="Xóa nội dung tìm kiếm"><X size={16} color={colors.muted} /></Pressable>}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Thêm tài khoản" onPress={openCreate} style={styles.addButton}>
            <UserRoundPlus size={16} color={colors.white} />
            <Text style={styles.addButtonText}>Thêm</Text>
          </Pressable>
        </View>

        {roles.length > 2 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {roles.map((role) => <Pressable key={role} onPress={() => setRoleFilter(role)} style={[styles.filterChip, roleFilter === role && styles.filterChipActive]}>
            <Text style={[styles.filterText, roleFilter === role && styles.filterTextActive]}>{role === 'all' ? 'Tất cả vai trò' : roleLabel(role)}</Text>
          </Pressable>)}
        </ScrollView>}

        {loading ? <CenteredPageLoader /> : error ? <PopupError error={error} onRetry={() => void loadAccounts()} /> : visibleAccounts.length === 0 ? (
          <View style={styles.state}><UserRound size={26} color={colors.muted} /><Text style={styles.emptyTitle}>{accounts.length ? 'Không tìm thấy tài khoản phù hợp' : 'Chưa có tài khoản'}</Text><Text style={styles.stateText}>{accounts.length ? 'Thử từ khóa hoặc bộ lọc vai trò khác.' : 'Thêm thành viên đầu tiên vào doanh nghiệp.'}</Text></View>
        ) : (
          <View style={styles.list}>
            {visibleAccounts.map((account) => {
              const protectedAccount = account.role === 'superadmin' || accountId(account) === (user?._id || user?.id);
              const active = accountIsActive(account);
              return <Pressable key={accountId(account) || account.email} onPress={() => openEdit(account)} style={({ pressed }) => [styles.accountCard, pressed && !protectedAccount && styles.cardPressed]}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{account.displayName.trim().split(/\s+/).slice(-2).map((part) => part[0]?.toLocaleUpperCase('vi')).join('') || 'IG'}</Text></View>
                <View style={styles.accountCopy}>
                  <View style={styles.nameRow}><Text numberOfLines={1} style={styles.accountName}>{account.displayName}</Text><View style={[styles.statusDot, { backgroundColor: active ? '#16885A' : '#C74848' }]} /></View>
                  <Text numberOfLines={1} style={styles.accountEmail}>{account.email}</Text>
                  <View style={styles.metaRow}><Text numberOfLines={1} style={styles.roleBadge}>{roleLabel(account.role)}</Text>{account.department ? <Text numberOfLines={1} style={styles.department}>{account.department}</Text> : null}</View>
                  <Text style={[styles.statusText, !active && styles.statusInactive]}>{active ? 'Đang hoạt động' : 'Đã tạm ngưng'}</Text>
                </View>
                {!protectedAccount && <Pressable hitSlop={10} accessibilityRole="button" accessibilityLabel={`Xóa tài khoản ${account.displayName}`} onPress={(event) => { event.stopPropagation(); confirmDelete(account); }} style={styles.deleteButton}><X size={16} color="#B34B55" /></Pressable>}
                {protectedAccount && <View style={styles.protectedTag}><ShieldCheck size={13} color={colors.muted} /></View>}
              </Pressable>;
            })}
          </View>
        )}
      </ScrollView>

      <Modal visible={creating || Boolean(editing)} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeForm}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}><Text style={styles.modalTitle}>{creating ? 'Thêm tài khoản' : 'Cập nhật tài khoản'}</Text><Text style={styles.modalSubtitle}>Thông tin sẽ được lưu trực tiếp vào IGen-ERP.</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Đóng biểu mẫu" disabled={saving} onPress={closeForm} style={styles.closeButton}><X size={19} color={colors.ink} /></Pressable>
          </View>
          <ScrollView style={styles.formScroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
            <Field label="Họ và tên *" value={form.displayName} onChangeText={(value) => setField('displayName', value)} placeholder="Nguyễn Văn An" />
            <Field label="Email *" value={form.email} onChangeText={(value) => setField('email', value)} placeholder="ten@congty.vn" keyboardType="email-address" autoCapitalize="none" editable={creating} />
            {creating && <Field label="Mật khẩu ban đầu *" value={form.password} onChangeText={(value) => setField('password', value)} placeholder="Ít nhất 6 ký tự" secureTextEntry autoCapitalize="none" />}
            <Field label="Số điện thoại" value={form.phone} onChangeText={(value) => setField('phone', value)} placeholder="090…" keyboardType="phone-pad" />
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Phòng ban</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Chọn phòng ban" accessibilityState={{ expanded: departmentOpen }} disabled={saving} onPress={() => setDepartmentOpen((open) => !open)} style={styles.departmentPicker}>
                <Text style={[styles.departmentPickerText, !form.department && styles.departmentPlaceholder]}>{form.department || 'Chọn phòng ban'}</Text>
                <ChevronDown size={15} color={colors.muted} />
              </Pressable>
              {departmentOpen ? <View style={styles.departmentMenu}>
                <ScrollView nestedScrollEnabled style={styles.departmentOptions} keyboardShouldPersistTaps="handled">
                  {departmentOptions.length ? departmentOptions.map((department) => <Pressable key={department} accessibilityRole="button" onPress={() => { setField('department', department); setDepartmentOpen(false); }} style={styles.departmentOption}>
                    <Text style={[styles.departmentOptionText, form.department === department && styles.departmentOptionSelected]}>{department}</Text>
                  </Pressable>) : <Text style={styles.departmentEmpty}>Chưa có phòng ban để chọn.</Text>}
                </ScrollView>
              </View> : null}
            </View>

            <Text style={styles.fieldLabel}>Vai trò</Text>
            <View style={styles.roleOptions}>
              {assignableRoles.map((role) => <Pressable key={role.value} disabled={editingSelf} onPress={() => setField('role', role.value)} style={[styles.roleOption, form.role === role.value && styles.roleOptionSelected, editingSelf && styles.optionDisabled]}>
                <Text style={[styles.roleOptionText, form.role === role.value && styles.roleOptionTextSelected]}>{role.label}</Text>
              </Pressable>)}
              {roles.filter((role) => role !== 'all' && role !== 'superadmin' && !assignableRoles.some((item) => item.value === role)).map((role) => <Pressable key={role} disabled={editingSelf} onPress={() => setField('role', role)} style={[styles.roleOption, form.role === role && styles.roleOptionSelected, editingSelf && styles.optionDisabled]}><Text style={[styles.roleOptionText, form.role === role && styles.roleOptionTextSelected]}>{roleLabel(role)}</Text></Pressable>)}
            </View>

            <Field label="Phân hệ được bật" value={form.enabledModules} onChangeText={(value) => setField('enabledModules', value)} placeholder="hr, inventory, quotation" hint={editingSelf ? 'Không thể thay đổi quyền phân hệ của tài khoản đang đăng nhập.' : 'Nhập module key, phân cách bằng dấu phẩy. Để trống khi tạo để dùng mặc định từ ERP.'} multiline editable={!editingSelf} />
            <Field label="Quyền thao tác" value={form.permissions} onChangeText={(value) => setField('permissions', value)} placeholder="hr:read, inventory:manage" hint={editingSelf ? 'Không thể thay đổi permission của tài khoản đang đăng nhập.' : 'Nhập permission key do IGen-ERP cấp, ví dụ inventory:read hoặc *. '} multiline editable={!editingSelf} />
          </ScrollView>
          <View style={styles.modalActions}>
            <Pressable disabled={saving} onPress={closeForm} style={styles.cancelButton}><Text style={styles.cancelText}>Hủy</Text></Pressable>
            <Pressable disabled={saving} onPress={() => void saveAccount()} style={[styles.saveButton, saving && styles.buttonDisabled]}>
              {saving ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.saveText}>{creating ? 'Tạo tài khoản' : 'Lưu thay đổi'}</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Field({
  label, value, onChangeText, placeholder, hint, multiline, ...inputProps
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  hint?: string;
  multiline?: boolean;
} & Omit<ComponentProps<typeof TextInput>, 'value' | 'onChangeText' | 'placeholder' | 'multiline'>) {
  return <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.muted} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} style={[styles.input, multiline && styles.multilineInput]} {...inputProps} />
    {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 0, paddingBottom: 30 },
  addButton: { minHeight: 45, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 13, borderRadius: 13, backgroundColor: colors.primary },
  addButtonText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  toolbarSearch: { flex: 1, marginTop: 0 },
  searchBox: { minHeight: 45, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, marginTop: 15, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, gap: 9 },
  searchInput: { flex: 1, color: colors.ink, fontSize: 12, paddingVertical: 8 },
  filters: { flexDirection: 'row', gap: 7, paddingVertical: 13 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#EDF1F7' },
  filterChipActive: { backgroundColor: '#E6EEFF' },
  filterText: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  filterTextActive: { color: colors.primary },
  list: { gap: 9, paddingTop: 2 },
  accountCard: { minHeight: 100, flexDirection: 'row', alignItems: 'center', padding: 13, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, gap: 11 },
  cardPressed: { opacity: 0.78 },
  avatar: { width: 43, height: 43, borderRadius: 15, backgroundColor: '#E6EEFF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  accountCopy: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  accountName: { color: colors.ink, fontSize: 12, fontWeight: '800', flexShrink: 1 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  accountEmail: { color: colors.muted, fontSize: 10, marginTop: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 7 },
  roleBadge: { color: colors.primary, backgroundColor: '#EDF3FF', overflow: 'hidden', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, fontSize: 8, fontWeight: '700' },
  department: { flexShrink: 1, color: colors.muted, fontSize: 9 },
  statusText: { color: '#16885A', fontSize: 8, fontWeight: '600', marginTop: 6 },
  statusInactive: { color: '#B34B55' },
  deleteButton: { width: 30, height: 34, alignItems: 'center', justifyContent: 'center' },
  protectedTag: { width: 28, alignItems: 'center' },
  state: { flex: 1, minHeight: 320, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 25, paddingBottom: 100, gap: 9 },
  stateText: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: 'center' },
  errorTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  emptyTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  retryButton: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, backgroundColor: '#E6EEFF', marginTop: 4 },
  retryText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  permissionState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 },
  permissionTitle: { color: colors.ink, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  permissionCopy: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: 'center' },
  modal: { flex: 1, backgroundColor: colors.background, paddingTop: 18 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 13, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  modalSubtitle: { color: colors.muted, fontSize: 10, marginTop: 4 },
  closeButton: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  formScroll: { flex: 1 },
  form: { flexGrow: 1, paddingHorizontal: 18, paddingTop: 15, paddingBottom: 24 },
  field: { marginBottom: 14 },
  fieldLabel: { color: colors.ink, fontSize: 10, fontWeight: '700', marginBottom: 6 },
  input: { minHeight: 43, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 11, backgroundColor: colors.white, color: colors.ink, fontSize: 12 },
  multilineInput: { minHeight: 65, paddingTop: 10 },
  fieldHint: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 5 },
  departmentPicker: { minHeight: 43, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 11, backgroundColor: colors.white },
  departmentPickerText: { color: colors.ink, fontSize: 12 },
  departmentPlaceholder: { color: colors.muted },
  departmentMenu: { maxHeight: 180, marginTop: 5, borderWidth: 1, borderColor: colors.border, borderRadius: 11, backgroundColor: colors.white, overflow: 'hidden' },
  departmentOptions: { maxHeight: 178 },
  departmentOption: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  departmentOptionText: { color: colors.ink, fontSize: 11 },
  departmentOptionSelected: { color: colors.primary, fontWeight: '700' },
  departmentEmpty: { color: colors.muted, fontSize: 10, padding: 12 },
  roleOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 15 },
  roleOption: { borderRadius: 18, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: '#EDF1F7', borderWidth: 1, borderColor: 'transparent' },
  roleOptionSelected: { backgroundColor: '#E6EEFF', borderColor: '#C6D7FF' },
  roleOptionText: { color: colors.muted, fontSize: 9, fontWeight: '600' },
  roleOptionTextSelected: { color: colors.primary },
  optionDisabled: { opacity: 0.65 },
  modalActions: { flexDirection: 'row', gap: 9, padding: 16, paddingBottom: 24, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.white },
  cancelButton: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#F0F3F8' },
  cancelText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  saveButton: { flex: 1.5, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.primary },
  saveText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  buttonDisabled: { opacity: 0.65 },
});
