import { PopupError } from '@/components/PopupError';
import { FullScreenFormModal } from '@/components/FullScreenFormModal';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ComponentProps } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BadgePercent, Handshake, Package, Search, Store, UserRound, UserRoundPlus, UsersRound, X } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Card } from '@/components/Card';
import { useAuth } from '@/core/auth/AuthProvider';
import {
  listPartnerCustomerOptions,
  listPartnerSupplierOptions,
  listPartnerUserOptions,
  listRetailPartners,
  saveRetailPartner,
  type PartnerCustomerOption,
  type PartnerSupplierOption,
  type PartnerUserOption,
  type RetailPartner,
  type RetailPartnerInput,
  type RetailPartnerRole,
  type RetailPartnerStatus,
} from '@/features/partnersApi';
import type { FeatureScreenProps } from '@/features/modules/featureScreenRegistry';
import { colors } from '@/theme/colors';
import { RetailPartnerOperations, RetailPartnerStatementPanel } from '@/features/RetailPartnerOperations';
import { getRetailPartnerCommissionBalances } from '@/features/partnersApi';

type PartnerForm = {
  code: string;
  name: string;
  role: RetailPartnerRole;
  phone: string;
  email: string;
  address: string;
  status: RetailPartnerStatus;
  userId: string;
  supplierId: string;
  customerId: string;
};

type PickerKind = 'user' | 'supplier' | 'customer';
type PickerOption = { value: string; label: string; detail?: string };

const roles: { value: RetailPartnerRole; label: string; shortLabel: string; detail: string; icon: LucideIcon }[] = [
  { value: 'collaborator', label: 'Cộng tác viên bán lẻ', shortLabel: 'Cộng tác viên', detail: 'Có thể liên kết tài khoản để xem sao kê và hoa hồng.', icon: UsersRound },
  { value: 'dealer', label: 'Đại lý', shortLabel: 'Đại lý', detail: 'Có thể liên kết khách hàng dùng cho công nợ.', icon: Store },
  { value: 'supplier', label: 'Nhà cung cấp', shortLabel: 'Nhà cung cấp', detail: 'Có thể liên kết hồ sơ nhà cung cấp trong Kho.', icon: Handshake },
];

const emptyForm = (): PartnerForm => ({
  code: '', name: '', role: 'collaborator', phone: '', email: '', address: '', status: 'active',
  userId: '', supplierId: '', customerId: '',
});

function partnerRole(partner: RetailPartner): RetailPartnerRole {
  if (partner.userId && partner.roles.includes('collaborator')) return 'collaborator';
  if (partner.supplierId && partner.roles.includes('supplier')) return 'supplier';
  return partner.roles[0] || 'collaborator';
}

function roleName(role: RetailPartnerRole) {
  return roles.find((item) => item.value === role)?.label || role;
}

function userOptionLabel(user: PartnerUserOption) {
  return user.displayName || user.email;
}

function formatVnd(amount: number) {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  const sign = safe < 0 ? '-' : '';
  const digits = Math.abs(safe).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${digits} VND`;
}

export function RetailPartnersScreen(_props: FeatureScreenProps) {
  const { user } = useAuth();
  const companyCode = user?.companyCode;
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const canManage = isAdmin || Boolean(user?.permissions?.includes('*') || user?.permissions?.includes('retail-partner:manage'));
  const canManagePolicies = isAdmin || Boolean(user?.permissions?.includes('*') || user?.permissions?.includes('retail-partner-policy:manage'));
  const canSelfRead = Boolean(user?.permissions?.includes('*') || user?.permissions?.includes('retail-partner-self:read') || user?.permissions?.includes('retail-partner-self:manage'));
  const canRead = canManage || canManagePolicies || Boolean(user?.permissions?.includes('retail-partner:read'));

  const [partners, setPartners] = useState<RetailPartner[]>([]);
  const [suppliers, setSuppliers] = useState<PartnerSupplierOption[]>([]);
  const [users, setUsers] = useState<PartnerUserOption[]>([]);
  const [customers, setCustomers] = useState<PartnerCustomerOption[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RetailPartnerRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<RetailPartnerStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [optionsError, setOptionsError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RetailPartner | null>(null);
  const [form, setForm] = useState<PartnerForm>(emptyForm);
  const [formError, setFormError] = useState('');
  const [pickerKind, setPickerKind] = useState<PickerKind | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [workspaceTab, setWorkspaceTab] = useState<'partners' | 'policies' | 'products'>('partners');
  const [commissionBalances, setCommissionBalances] = useState<Record<string, number>>({});
  const [commissionBalanceError, setCommissionBalanceError] = useState('');

  const load = useCallback(async (showSpinner = true) => {
    if (!companyCode) {
      setError('Tài khoản chưa có mã công ty để tải danh sách đối tác.');
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (!canRead) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (showSpinner) setLoading(true);
    try {
      const rows = await listRetailPartners(companyCode);
      setPartners(rows);
      if (canManagePolicies) {
        try {
          const balances = await getRetailPartnerCommissionBalances(companyCode);
          setCommissionBalances(Object.fromEntries(balances.map((item) => [item.partnerId, item.balance])));
          setCommissionBalanceError('');
        } catch (cause) { setCommissionBalanceError(cause instanceof Error ? cause.message : 'Không tải được số dư hoa hồng.'); }
      }
      setError('');
      if (canManage) {
        const [supplierResult, userResult, customerResult] = await Promise.allSettled([
          listPartnerSupplierOptions(companyCode),
          listPartnerUserOptions(companyCode),
          listPartnerCustomerOptions(companyCode),
        ]);
        setSuppliers(supplierResult.status === 'fulfilled' ? supplierResult.value : []);
        setUsers(userResult.status === 'fulfilled' ? userResult.value : []);
        setCustomers(customerResult.status === 'fulfilled' ? customerResult.value : []);
        const failed = [supplierResult, userResult, customerResult].filter((result) => result.status === 'rejected');
        setOptionsError(failed.length ? 'Một số danh sách liên kết chưa tải được. Có thể tạo đối tác chưa liên kết rồi thử lại sau.' : '');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được danh sách đối tác từ IGen-ERP.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canManage, canManagePolicies, canRead, companyCode]);

  useEffect(() => { void load(); }, [load]);

  const stats = useMemo(() => ({
    total: partners.length,
    active: partners.filter((partner) => partner.status === 'active').length,
    collaborators: partners.filter((partner) => partnerRole(partner) === 'collaborator').length,
  }), [partners]);

  const visiblePartners = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('vi');
    return partners.filter((partner) => {
      const role = partnerRole(partner);
      const matchesSearch = !query || `${partner.code} ${partner.name} ${partner.phone || ''} ${partner.email || ''}`.toLocaleLowerCase('vi').includes(query);
      return matchesSearch && (roleFilter === 'all' || role === roleFilter) && (statusFilter === 'all' || partner.status === statusFilter);
    });
  }, [partners, roleFilter, search, statusFilter]);

  const pickerOptions = useMemo<PickerOption[]>(() => {
    const options: PickerOption[] = [{ value: '', label: 'Chưa liên kết' }];
    if (pickerKind === 'supplier') return options.concat(suppliers.map((item) => ({ value: item._id, label: item.name, detail: item.code })));
    if (pickerKind === 'customer') return options.concat(customers.map((item) => ({ value: item._id, label: item.name, detail: `${item.customerCode}${item.phone ? ` · ${item.phone}` : ''}` })));
    if (pickerKind === 'user') return options.concat(users.map((item) => ({ value: item._id, label: userOptionLabel(item), detail: item.email })));
    return options;
  }, [customers, pickerKind, suppliers, users]);

  const filteredPickerOptions = useMemo(() => {
    const query = pickerSearch.trim().toLocaleLowerCase('vi');
    return pickerOptions.filter((option) => !query || `${option.label} ${option.detail || ''}`.toLocaleLowerCase('vi').includes(query));
  }, [pickerOptions, pickerSearch]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setFormError('');
    setFormOpen(true);
  }

  function openEdit(partner: RetailPartner) {
    setEditing(partner);
    setForm({
      code: partner.code,
      name: partner.name,
      role: partnerRole(partner),
      phone: partner.phone || '',
      email: partner.email || '',
      address: partner.address || '',
      status: partner.status,
      userId: partner.userId || '',
      supplierId: partner.supplierId || '',
      customerId: partner.customerId || '',
    });
    setFormError('');
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
    setPickerKind(null);
  }

  function setField<K extends keyof PartnerForm>(key: K, value: PartnerForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function selectionValue(kind: PickerKind) {
    return kind === 'supplier' ? form.supplierId : kind === 'customer' ? form.customerId : form.userId;
  }

  function setSelection(kind: PickerKind, value: string) {
    if (kind === 'supplier') setField('supplierId', value);
    else if (kind === 'customer') setField('customerId', value);
    else setField('userId', value);
    setPickerKind(null);
    setPickerSearch('');
  }

  function linkedLabel(kind: PickerKind) {
    const value = selectionValue(kind);
    if (!value) return 'Chưa liên kết';
    if (kind === 'supplier') return suppliers.find((item) => item._id === value)?.name || editing?.supplier?.name || 'Đã liên kết nhà cung cấp';
    if (kind === 'customer') return customers.find((item) => item._id === value)?.name || 'Đã liên kết khách hàng';
    return users.find((item) => item._id === value)?.displayName || users.find((item) => item._id === value)?.email || 'Đã liên kết tài khoản';
  }

  const switchingAwayFromLink = Boolean(
    (editing?.supplierId && form.role !== 'supplier') ||
    (editing?.userId && form.role !== 'collaborator') ||
    (editing?.customerId && form.role !== 'dealer'),
  );

  async function save() {
    if (!companyCode || saving) return;
    const code = form.code.trim().toUpperCase();
    const name = form.name.trim();
    if (!/^[A-Z0-9][A-Z0-9_-]{0,59}$/.test(code)) {
      setFormError('Mã đối tác bắt đầu bằng chữ hoặc số, chỉ dùng chữ, số, gạch nối, gạch dưới và tối đa 60 ký tự.');
      return;
    }
    if (!name || name.length > 200) {
      setFormError('Nhập tên đối tác, tối đa 200 ký tự.');
      return;
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setFormError('Địa chỉ email chưa hợp lệ.');
      return;
    }
    const input: RetailPartnerInput = {
      code,
      name,
      roles: [form.role],
      phone: form.phone.trim().slice(0, 30),
      email: form.email.trim().toLocaleLowerCase('vi').slice(0, 200),
      address: form.address.trim().slice(0, 500),
      status: form.status,
      supplierId: form.role === 'supplier' ? form.supplierId : '',
      userId: form.role === 'collaborator' ? form.userId : '',
      customerId: form.role === 'dealer' ? form.customerId : '',
    };
    setSaving(true);
    setFormError('');
    try {
      await saveRetailPartner(companyCode, input, editing?._id);
      setFormOpen(false);
      setEditing(null);
      await load(false);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'IGen-ERP không lưu được đối tác.');
    } finally {
      setSaving(false);
    }
  }

  if (!canRead && canSelfRead && companyCode) return <RetailPartnerStatementPanel companyCode={companyCode} />;

  if (!canRead) {
    return <View style={styles.permissionState}><Handshake size={30} color={colors.primary} /><Text style={styles.permissionTitle}>Chưa có quyền xem đối tác bán lẻ</Text><Text style={styles.permissionCopy}>Cần quyền retail-partner:read hoặc retail-partner:manage để xem danh sách.</Text></View>;
  }

  return (
    <View style={styles.container}>
      <ScrollView horizontal style={styles.moduleNavigationScroll} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moduleNavigation}>
        <WorkspaceTab icon={Handshake} label="Đối tác" selected={workspaceTab === 'partners'} onPress={() => setWorkspaceTab('partners')} />
        {canManagePolicies && (
          <>
            <WorkspaceTab icon={BadgePercent} label="Chính sách" selected={workspaceTab === 'policies'} onPress={() => setWorkspaceTab('policies')} />
            <WorkspaceTab icon={Package} label="Hoa hồng SKU" selected={workspaceTab === 'products'} onPress={() => setWorkspaceTab('products')} />
          </>
        )}
      </ScrollView>
      {workspaceTab !== 'partners' && companyCode && canManagePolicies ? <RetailPartnerOperations companyCode={companyCode} partners={partners} initialTab={workspaceTab} /> : <>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(false); }} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statsRow}>
          <Card style={styles.statCard}><Text style={styles.statValue}>{stats.total}</Text><Text style={styles.statLabel}>Tổng đối tác</Text></Card>
          <Card style={styles.statCard}><Text style={styles.statValue}>{stats.active}</Text><Text style={styles.statLabel}>Đang hoạt động</Text></Card>
          <Card style={styles.statCard}><Text style={styles.statValue}>{stats.collaborators}</Text><Text style={styles.statLabel}>Cộng tác viên</Text></Card>
        </View>

        <View style={styles.toolbar}>
          <View style={styles.searchBox}>
            <Search size={16} color={colors.muted} />
            <TextInput value={search} onChangeText={setSearch} placeholder="Tìm mã, tên, điện thoại hoặc email" placeholderTextColor={colors.muted} style={styles.searchInput} returnKeyType="search" />
            {search.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel="Xóa tìm kiếm" onPress={() => setSearch('')}><X size={16} color={colors.muted} /></Pressable>}
          </View>
          {canManage && <Pressable accessibilityRole="button" onPress={openCreate} style={styles.addButton}><UserRoundPlus size={16} color={colors.white} /><Text style={styles.addButtonText}>Thêm</Text></Pressable>}
        </View>

        <View style={styles.filterBlock}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {[{ value: 'all', label: 'Tất cả vai trò' }, ...roles.map((item) => ({ value: item.value, label: item.shortLabel }))].map((item) => <FilterChip key={item.value} label={item.label} selected={roleFilter === item.value} onPress={() => setRoleFilter(item.value as typeof roleFilter)} />)}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {[{ value: 'all', label: 'Mọi trạng thái' }, { value: 'active', label: 'Đang hoạt động' }, { value: 'inactive', label: 'Ngừng hoạt động' }].map((item) => <FilterChip key={item.value} label={item.label} selected={statusFilter === item.value} onPress={() => setStatusFilter(item.value as typeof statusFilter)} />)}
          </ScrollView>
        </View>

        {optionsError && canManage && <PopupError error={optionsError} title="Không tải được tùy chọn đối tác" />}
        {error ? <PopupError error={error} onRetry={() => void load()} /> : loading ? <View style={styles.state}><ActivityIndicator color={colors.primary} /><Text style={styles.stateText}>Đang tải đối tác từ IGen-ERP…</Text></View>
            : visiblePartners.length === 0 ? <View style={styles.state}><Handshake size={26} color={colors.muted} /><Text style={styles.emptyTitle}>{partners.length ? 'Không tìm thấy đối tác phù hợp' : 'Chưa có đối tác'}</Text><Text style={styles.stateText}>{partners.length ? 'Thử đổi từ khóa hoặc bộ lọc.' : 'Khai báo cộng tác viên, đại lý hoặc nhà cung cấp đầu tiên.'}</Text></View>
              : <View style={styles.list}>{visiblePartners.map((partner) => <PartnerCard key={partner._id} partner={partner} users={users} customers={customers} canManage={canManage} canManagePolicies={canManagePolicies} balance={commissionBalances[partner._id]} onEdit={() => openEdit(partner)} />)}</View>}
        {commissionBalanceError && canManagePolicies ? <PopupError error={commissionBalanceError} title="Không tải được số dư hoa hồng" /> : null}
      </ScrollView>

      <FullScreenFormModal
        visible={formOpen}
        title={editing ? 'Cập nhật đối tác' : 'Thêm đối tác'}
        onClose={closeForm}
        footer={
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
            <Pressable disabled={saving} onPress={closeForm} style={styles.cancelButton}><Text style={styles.cancelText}>Hủy</Text></Pressable>
            <Pressable disabled={saving} onPress={() => void save()} style={[styles.saveButton, saving && styles.buttonDisabled]}>{saving ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.saveText}>{editing ? 'Lưu thay đổi' : 'Tạo đối tác'}</Text>}</Pressable>
          </View>
        }
      >
        <View style={{ gap: 10 }}>
          <Text style={styles.modalSubtitle}>Mỗi đối tác có một vai trò bán lẻ.</Text>
          <Field label="Mã đối tác *" value={form.code} onChangeText={(value) => setField('code', value)} placeholder="VD: CTV-001" autoCapitalize="characters" maxLength={60} />
          <Field label="Tên đối tác *" value={form.name} onChangeText={(value) => setField('name', value)} placeholder="Tên cá nhân hoặc doanh nghiệp" maxLength={200} />
          <Field label="Số điện thoại" value={form.phone} onChangeText={(value) => setField('phone', value)} placeholder="Số điện thoại" keyboardType="phone-pad" maxLength={30} />
          <Field label="Email" value={form.email} onChangeText={(value) => setField('email', value)} placeholder="email@congty.vn" keyboardType="email-address" autoCapitalize="none" maxLength={200} />
          <Field label="Địa chỉ" value={form.address} onChangeText={(value) => setField('address', value)} placeholder="Địa chỉ liên hệ" maxLength={500} />

          <Text style={styles.sectionLabel}>Vai trò & liên kết</Text>
          <View style={styles.roleOptions}>
            {roles.map((role) => {
              const Icon = role.icon;
              const selected = form.role === role.value;
              return <Pressable key={role.value} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => setField('role', role.value)} style={[styles.roleOption, selected && styles.roleOptionSelected]}>
                <View style={styles.roleOptionTitle}><Icon size={16} color={selected ? colors.primary : colors.muted} /><Text style={[styles.roleOptionText, selected && styles.roleOptionTextSelected]}>{role.label}</Text></View>
                <Text style={styles.roleDetail}>{role.detail}</Text>
              </Pressable>;
            })}
          </View>

          {switchingAwayFromLink && <View style={styles.warning}><Text style={styles.warningText}>Đổi vai trò sẽ gỡ liên kết hiện tại. Liên kết đã gỡ không tự khôi phục khi đổi lại vai trò cũ.</Text></View>}

          {form.role === 'collaborator' && <PartnerPickerField label="Tài khoản xem sao kê" value={linkedLabel('user')} onPress={() => { setPickerKind('user'); setPickerSearch(''); }} locked={Boolean(editing?.userId)} hint={editing?.userId ? 'Tài khoản đã liên kết không thể đổi.' : 'Có thể để trống nếu chưa cần liên kết tài khoản.'} />}
          {form.role === 'dealer' && <PartnerPickerField label="Khách hàng liên kết công nợ" value={linkedLabel('customer')} onPress={() => { setPickerKind('customer'); setPickerSearch(''); }} locked={Boolean(editing?.customerId)} hint={editing?.customerId ? 'Khách hàng đã liên kết không thể đổi.' : 'Có thể để trống nếu đại lý chưa gắn hồ sơ khách hàng.'} />}
          {form.role === 'supplier' && <PartnerPickerField label="Nhà cung cấp trong Kho" value={linkedLabel('supplier')} onPress={() => { setPickerKind('supplier'); setPickerSearch(''); }} locked={Boolean(editing?.supplierId)} hint={editing?.supplierId ? 'Nhà cung cấp đã liên kết không thể đổi.' : 'Có thể để trống nếu chưa liên kết hồ sơ Kho.'} />}

          <Text style={styles.sectionLabel}>Trạng thái</Text>
          <View style={styles.statusOptions}>
            {([{ value: 'active', label: 'Đang hoạt động' }, { value: 'inactive', label: 'Ngừng hoạt động' }] as const).map((item) => <Pressable key={item.value} onPress={() => setField('status', item.value)} style={[styles.statusOption, form.status === item.value && styles.statusOptionSelected]}><Text style={[styles.statusOptionText, form.status === item.value && styles.statusOptionTextSelected]}>{item.label}</Text></Pressable>)}
          </View>
          {formError ? <PopupError error={formError} title="Thông tin chưa hợp lệ" /> : null}
        </View>
      </FullScreenFormModal>

      <Modal visible={Boolean(pickerKind)} transparent animationType="fade" onRequestClose={() => setPickerKind(null)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setPickerKind(null)}>
          <Pressable style={styles.pickerCard} onPress={() => {}}>
            <View style={styles.pickerHeader}><Text style={styles.pickerTitle}>{pickerKind === 'supplier' ? 'Chọn nhà cung cấp' : pickerKind === 'customer' ? 'Chọn khách hàng' : 'Chọn tài khoản'}</Text><Pressable accessibilityLabel="Đóng danh sách" onPress={() => setPickerKind(null)} style={styles.closeButton}><X size={18} color={colors.muted} /></Pressable></View>
            <View style={styles.pickerSearch}><Search size={15} color={colors.muted} /><TextInput value={pickerSearch} onChangeText={setPickerSearch} placeholder="Tìm trong danh sách" placeholderTextColor={colors.muted} style={styles.pickerSearchInput} /></View>
            <ScrollView style={styles.pickerList} keyboardShouldPersistTaps="handled">
              {filteredPickerOptions.map((option) => <Pressable key={option.value || 'none'} onPress={() => pickerKind && setSelection(pickerKind, option.value)} style={styles.pickerOption}><View style={{ flex: 1 }}><Text style={styles.pickerOptionLabel}>{option.label}</Text>{option.detail ? <Text style={styles.pickerOptionDetail}>{option.detail}</Text> : null}</View></Pressable>)}
              {filteredPickerOptions.length === 0 && <Text style={styles.pickerEmpty}>Không có kết quả phù hợp.</Text>}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
      </>}
    </View>
  );
}

function WorkspaceTab({ icon: Icon, label, selected, onPress }: { icon: LucideIcon; label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected }} onPress={onPress} style={[styles.moduleNavItem, selected && styles.moduleNavItemActive]}><Icon size={15} color={selected ? colors.white : colors.muted} /><Text style={[styles.moduleNavText, selected && styles.moduleNavTextActive]}>{label}</Text></Pressable>;
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.filterChip, selected && styles.filterChipSelected]}><Text style={[styles.filterText, selected && styles.filterTextSelected]}>{label}</Text></Pressable>;
}

function PartnerCard({ partner, users, customers, canManage, canManagePolicies, balance, onEdit }: { partner: RetailPartner; users: PartnerUserOption[]; customers: PartnerCustomerOption[]; canManage: boolean; canManagePolicies: boolean; balance?: number; onEdit: () => void }) {
  const role = partnerRole(partner);
  const Icon = roles.find((item) => item.value === role)?.icon || UserRound;
  const user = partner.userId ? users.find((item) => item._id === partner.userId) : undefined;
  const customer = partner.customerId ? customers.find((item) => item._id === partner.customerId) : undefined;
  const linkedLabel = role === 'supplier'
    ? partner.supplier ? `${partner.supplier.name} (${partner.supplier.code})` : partner.supplierId ? 'Đã liên kết nhà cung cấp trong Kho' : 'Chưa liên kết'
    : role === 'dealer'
      ? customer?.name || (partner.customerId ? 'Đã liên kết khách hàng công nợ' : 'Chưa liên kết')
      : user ? `${user.displayName || user.email}${user.displayName ? ` · ${user.email}` : ''}` : partner.userId ? 'Đã liên kết tài khoản xem sao kê' : 'Chưa liên kết';

  return <View style={styles.partnerCard}>
    <View style={styles.partnerHeader}>
      <View style={styles.partnerIdentity}>
        <View style={styles.partnerIcon}><Icon size={18} color={colors.primary} /></View>
        <View style={styles.partnerCopy}><Text numberOfLines={1} style={styles.partnerName}>{partner.name}</Text><Text style={styles.partnerCode}>{partner.code}</Text></View>
      </View>
      <View style={[styles.statusBadge, partner.status === 'active' ? styles.activeBadge : styles.inactiveBadge]}><Text style={[styles.statusBadgeText, partner.status === 'active' ? styles.activeText : styles.inactiveText]}>{partner.status === 'active' ? 'Đang hoạt động' : 'Ngừng hoạt động'}</Text></View>
    </View>
    <View style={styles.roleLine}><Text style={styles.rolePill}>{roleName(role)}</Text><Text numberOfLines={1} style={styles.linkedText}>{linkedLabel}</Text></View>
    {role === 'collaborator' && canManagePolicies ? <Text style={styles.commissionBalance}>Số dư hoa hồng: {typeof balance === 'number' ? formatVnd(balance) : '—'}</Text> : null}
    <View style={styles.contactGrid}>
      <View style={styles.contactCell}><Text style={styles.contactLabel}>Điện thoại</Text><Text numberOfLines={1} style={styles.contactValue}>{partner.phone || 'Chưa cập nhật'}</Text></View>
      <View style={styles.contactCell}><Text style={styles.contactLabel}>Email</Text><Text numberOfLines={1} style={styles.contactValue}>{partner.email || 'Chưa cập nhật'}</Text></View>
      {partner.address ? <View style={[styles.contactCell, styles.addressCell]}><Text style={styles.contactLabel}>Địa chỉ</Text><Text numberOfLines={2} style={styles.contactValue}>{partner.address}</Text></View> : null}
    </View>
    {canManage && <View style={styles.cardActions}><Pressable accessibilityRole="button" onPress={onEdit} style={styles.editButton}><Text style={styles.editButtonText}>Chỉnh sửa</Text></Pressable></View>}
  </View>;
}

function PartnerPickerField({ label, value, onPress, locked, hint }: { label: string; value: string; onPress: () => void; locked: boolean; hint: string }) {
  return <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: locked }} disabled={locked} onPress={onPress} style={[styles.pickerField, locked && styles.pickerFieldLocked]}>
      <Text numberOfLines={1} style={[styles.pickerFieldValue, !value && styles.placeholder]}>{value || 'Chọn liên kết nếu có'}</Text>
      {!locked && <Text style={styles.pickerFieldAction}>Chọn</Text>}
    </Pressable>
    <Text style={styles.fieldHint}>{hint}</Text>
  </View>;
}

function Field({ label, value, onChangeText, placeholder, multiline, ...inputProps }: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
} & Omit<ComponentProps<typeof TextInput>, 'value' | 'onChangeText' | 'placeholder' | 'multiline'>) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.muted} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} style={[styles.input, multiline && styles.multilineInput]} {...inputProps} /></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  moduleNavigationScroll: { flexGrow: 0, flexShrink: 0, height: 42, marginTop: 4 },
  moduleNavigation: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16 },
  moduleNavItem: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 7 },
  moduleNavItemActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  moduleNavText: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  moduleNavTextActive: { color: colors.white },
  statsRow: { flexDirection: 'row', gap: 9, marginBottom: 12 },
  statCard: { flex: 1, minWidth: 0, minHeight: 72, paddingHorizontal: 8, paddingVertical: 10, justifyContent: 'center', borderRadius: 14 },
  statValue: { color: colors.ink, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  statLabel: { color: colors.muted, fontSize: 9, lineHeight: 12, textAlign: 'center', marginTop: 4 },
  balanceError: { marginHorizontal: 4, marginTop: 8, color: '#B42318', fontSize: 10 },
  commissionBalance: { marginTop: 8, color: '#16885A', fontSize: 10, fontWeight: '800' },
  content: { padding: 16, paddingTop: 10, paddingBottom: 28 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchBox: { height: 40, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderRadius: 99, borderWidth: 1, borderColor: '#DCE5F2', backgroundColor: colors.white },
  searchInput: { flex: 1, minWidth: 0, color: '#111827', fontSize: 13.5, paddingVertical: 0 },
  addButton: { minHeight: 43, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 13, borderRadius: 13, backgroundColor: colors.primary },
  addButtonText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  filterBlock: { marginTop: 8, gap: 4 },
  filters: { flexDirection: 'row', gap: 7, paddingVertical: 3 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  filterChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  filterTextSelected: { color: colors.white },
  notice: { padding: 10, marginTop: 8, borderRadius: 12, backgroundColor: '#FFF7E6', borderWidth: 1, borderColor: '#F3DFB1' },
  noticeText: { color: '#8C5A0A', fontSize: 10, lineHeight: 15 },
  list: { gap: 10, marginTop: 10 },
  partnerCard: { padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  partnerHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  partnerIdentity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  partnerIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' },
  partnerCopy: { flex: 1, minWidth: 0 },
  partnerName: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  partnerCode: { color: colors.muted, fontSize: 10, marginTop: 2 },
  statusBadge: { maxWidth: 118, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  activeBadge: { backgroundColor: '#E8F7EF' },
  inactiveBadge: { backgroundColor: '#F0F2F5' },
  statusBadgeText: { fontSize: 9, fontWeight: '800' },
  activeText: { color: '#16885A' },
  inactiveText: { color: '#667085' },
  roleLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 11, padding: 9, borderRadius: 11, backgroundColor: '#F6F8FB' },
  rolePill: { overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, color: colors.primary, backgroundColor: '#EAF2FF', fontSize: 9, fontWeight: '700' },
  linkedText: { flex: 1, color: colors.ink, fontSize: 10, textAlign: 'right' },
  contactGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 9 },
  contactCell: { flex: 1, minWidth: '46%', padding: 9, borderRadius: 10, backgroundColor: '#FAFBFD' },
  addressCell: { flexBasis: '100%' },
  contactLabel: { color: colors.muted, fontSize: 9 },
  contactValue: { color: colors.ink, fontSize: 10, fontWeight: '600', marginTop: 3 },
  cardActions: { alignItems: 'flex-end', marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: '#F0F2F6' },
  editButton: { minHeight: 35, justifyContent: 'center', paddingHorizontal: 13, borderRadius: 10, backgroundColor: '#EEF4FF' },
  editButtonText: { color: colors.primary, fontSize: 10, fontWeight: '800' },
  state: { minHeight: 210, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 26, gap: 9 },
  stateText: { color: colors.muted, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  errorTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  emptyTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  retryButton: { marginTop: 4, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 11, backgroundColor: '#EAF2FF' },
  retryText: { color: colors.primary, fontSize: 11, fontWeight: '800' },
  permissionState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 26, gap: 10 },
  permissionTitle: { color: colors.ink, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  permissionCopy: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: 'center' },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: 'rgba(15,23,42,0.45)' },
  modalCard: { maxHeight: '88%', backgroundColor: colors.background, borderRadius: 24, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.white },
  modalTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  modalSubtitle: { color: colors.muted, fontSize: 10, marginTop: 3 },
  closeButton: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF1F6' },
  formScroll: { flexGrow: 0 },
  form: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 18 },
  field: { marginBottom: 12 },
  fieldLabel: { marginBottom: 5, color: colors.ink, fontSize: 10, fontWeight: '700' },
  input: { minHeight: 42, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 11, backgroundColor: colors.white, color: colors.ink, fontSize: 11 },
  multilineInput: { minHeight: 62, paddingTop: 9 },
  sectionLabel: { marginTop: 4, marginBottom: 8, color: colors.ink, fontSize: 11, fontWeight: '800' },
  roleOptions: { gap: 7, marginBottom: 13 },
  roleOption: { padding: 11, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  roleOptionSelected: { borderColor: '#AFC7FF', backgroundColor: '#F2F6FF' },
  roleOptionTitle: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  roleOptionText: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  roleOptionTextSelected: { color: colors.primary },
  roleDetail: { marginTop: 4, marginLeft: 23, color: colors.muted, fontSize: 9, lineHeight: 13 },
  warning: { padding: 10, marginBottom: 12, borderRadius: 11, backgroundColor: '#FFF7E6' },
  warningText: { color: '#8C5A0A', fontSize: 10, lineHeight: 15 },
  pickerField: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 11, backgroundColor: colors.white },
  pickerFieldLocked: { backgroundColor: '#F2F4F7' },
  pickerFieldValue: { flex: 1, color: colors.ink, fontSize: 11, fontWeight: '600' },
  placeholder: { color: colors.muted, fontWeight: '400' },
  pickerFieldAction: { color: colors.primary, fontSize: 10, fontWeight: '700' },
  fieldHint: { marginTop: 4, color: colors.muted, fontSize: 9, lineHeight: 13 },
  statusOptions: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statusOption: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  statusOptionSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  statusOptionText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  statusOptionTextSelected: { color: colors.white },
  formError: { marginTop: 2, color: '#B42318', fontSize: 10, lineHeight: 15 },
  modalActions: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 15, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.white },
  cancelButton: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#EEF1F6' },
  cancelText: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  saveButton: { flex: 1.4, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.primary },
  saveText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  buttonDisabled: { opacity: 0.65 },
  pickerBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18, backgroundColor: 'rgba(15,23,42,0.45)' },
  pickerCard: { width: '100%', maxWidth: 430, maxHeight: '82%', overflow: 'hidden', padding: 16, borderRadius: 24, backgroundColor: colors.white },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 11 },
  pickerTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  pickerSearch: { minHeight: 41, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, borderWidth: 1, borderColor: colors.border, borderRadius: 11, backgroundColor: '#FAFBFD' },
  pickerSearchInput: { flex: 1, color: colors.ink, fontSize: 11, paddingVertical: 7 },
  pickerList: { maxHeight: 380, marginTop: 8 },
  pickerOption: { minHeight: 47, flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0F2F5' },
  pickerOptionLabel: { color: colors.ink, fontSize: 11, fontWeight: '600' },
  pickerOptionDetail: { color: colors.muted, fontSize: 9, marginTop: 3 },
  pickerEmpty: { paddingVertical: 22, color: colors.muted, fontSize: 11, textAlign: 'center' },
});
