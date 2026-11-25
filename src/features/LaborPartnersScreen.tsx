import { PopupError } from '@/components/PopupError';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BriefcaseBusiness, FileSliders, Pencil, Plus, Search, Trash2, UsersRound, X } from 'lucide-react-native';
import { useAuth } from '@/core/auth/AuthProvider';
import type { FeatureScreenProps } from '@/features/modules/featureScreenRegistry';
import { colors } from '@/theme/colors';
import { DateTimeField } from '@/features/quotation/DateTimeField';
import { LaborPartnerActivities } from '@/features/LaborPartnerActivities';
import { createLaborCommissionPolicy, listLaborCommissionPolicies, listLaborPartners, removeLaborCommissionPolicy, removeLaborPartner, saveLaborPartner, setLaborCommissionPolicyStatus, updateLaborCommissionPolicy, type LaborCommissionPolicy, type LaborPartner, type LaborPartnerInput } from '@/features/laborPartnersApi';

type PartnerForm = {
  code: string; name: string; phone: string; email: string; taxCode: string; representative: string;
  address: string; bankName: string; bankAccountNo: string; bankAccountName: string;
  defaultPolicyId: string; defaultOfficialPolicyId: string; defaultSeasonalPolicyId: string;
  status: 'active' | 'inactive'; note: string;
};
type PolicySlot = 'defaultPolicyId' | 'defaultOfficialPolicyId' | 'defaultSeasonalPolicyId';
type PolicyForm = {
  name: string; effectiveFrom: string; cycle: 'calendar_month' | 'cutoff_day'; cutoffDay: string;
  officialEnabled: boolean; maxMonths: 1 | 2 | 3; amounts: string[];
  milestoneRules: Array<{ eligibilityRule: 'contract_active' | 'manual_confirmation' | 'attendance_threshold'; minWorkedDays: string; minWorkedHours: string }>;
  seasonalEnabled: boolean; tierMode: 'flat' | 'progressive'; aggregationScope: 'partner_period' | 'partner_project_period';
  minHoursPerWorker: string; maxEligibleHoursPerWorker: string; hourRoundingUnit: 1 | 5 | 15 | 30 | 60; hourRoundingMode: 'floor' | 'nearest' | 'ceil';
  moneyRoundingUnit: string; moneyRoundingMode: 'floor' | 'nearest' | 'ceil';
  tiers: Array<{ minHours: string; maxHours: string; hourlyRate: string }>;
};
const emptyForm = (): PartnerForm => ({ code: '', name: '', phone: '', email: '', taxCode: '', representative: '', address: '', bankName: '', bankAccountNo: '', bankAccountName: '', defaultPolicyId: '', defaultOfficialPolicyId: '', defaultSeasonalPolicyId: '', status: 'active', note: '' });
const emptyPolicyForm = (): PolicyForm => ({ name: '', effectiveFrom: new Date().toISOString().slice(0, 10), cycle: 'calendar_month', cutoffDay: '', officialEnabled: true, maxMonths: 1, amounts: [''], milestoneRules: [{ eligibilityRule: 'contract_active', minWorkedDays: '', minWorkedHours: '' }, { eligibilityRule: 'contract_active', minWorkedDays: '', minWorkedHours: '' }, { eligibilityRule: 'contract_active', minWorkedDays: '', minWorkedHours: '' }], seasonalEnabled: false, tierMode: 'flat', aggregationScope: 'partner_period', minHoursPerWorker: '', maxEligibleHoursPerWorker: '', hourRoundingUnit: 1, hourRoundingMode: 'nearest', moneyRoundingUnit: '1', moneyRoundingMode: 'nearest', tiers: [{ minHours: '0', maxHours: '', hourlyRate: '' }] });
const permission = (values: string[] | undefined, key: string) => Boolean(values?.includes('*') || values?.includes(key));
const relationId = (value: string | { _id: string } | null | undefined) => typeof value === 'string' ? value : value?._id || '';
const formatVndInput = (raw: string | number) => {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

export function LaborPartnersScreen(_props: FeatureScreenProps) {
  const { user, activeBranchId } = useAuth();
  const isSuperAdmin = user?.role === 'superadmin';
  const branchId = isSuperAdmin ? (activeBranchId || user?.branchId) : user?.branchId;
  const scope = useMemo(() => user?.companyCode ? { companyCode: user.companyCode, ...(branchId ? { branchId } : {}) } : undefined, [branchId, user?.companyCode]);
  const isAdmin = user?.role === 'admin' || isSuperAdmin;
  const canRead = isAdmin || permission(user?.permissions, 'labor-partner:read') || permission(user?.permissions, 'labor-partner:manage');
  const canManage = isAdmin || permission(user?.permissions, 'labor-partner:manage');
  const canManagePolicies = isAdmin || permission(user?.permissions, 'labor-partner-policy:manage');
  const canManageSettlements = isAdmin || permission(user?.permissions, 'labor-partner-settlement:manage');
  const canPayout = isAdmin || permission(user?.permissions, 'labor-partner-payout:manage');
  const [tab, setTab] = useState<'partners' | 'policies' | 'referrals' | 'kpi' | 'settlements'>('partners');
  const [partners, setPartners] = useState<LaborPartner[]>([]);
  const [policies, setPolicies] = useState<LaborCommissionPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LaborPartner | null>(null);
  const [form, setForm] = useState<PartnerForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState<PolicySlot | null>(null);
  const [policyFormOpen, setPolicyFormOpen] = useState(false);
  const [policyForm, setPolicyForm] = useState<PolicyForm>(emptyPolicyForm);
  const [editingPolicy, setEditingPolicy] = useState<LaborCommissionPolicy | null>(null);
  const [savingPolicy, setSavingPolicy] = useState(false);

  const load = useCallback(async (showLoading = true) => {
    if (!scope) { setError('Tài khoản chưa có mã công ty để tải đối tác lao động.'); setLoading(false); setRefreshing(false); return; }
    if (!canRead) { setLoading(false); setRefreshing(false); return; }
    if (showLoading) setLoading(true);
    try {
      const [partnerRows, policyRows] = await Promise.all([listLaborPartners(scope), listLaborCommissionPolicies(scope)]);
      setPartners(partnerRows);
      setPolicies(policyRows);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được dữ liệu đối tác lao động từ IGen-ERP.');
    } finally { setLoading(false); setRefreshing(false); }
  }, [canManagePolicies, canRead, scope]);

  useEffect(() => { void load(); }, [load]);
  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('vi');
    return partners.filter((partner) => !query || `${partner.code} ${partner.name} ${partner.phone} ${partner.email || ''}`.toLocaleLowerCase('vi').includes(query));
  }, [partners, search]);

  function openCreate() { setEditing(null); setForm(emptyForm()); setFormOpen(true); }
  function openEdit(partner: LaborPartner) {
    setEditing(partner);
    setForm({
      code: partner.code || '', name: partner.name || '', phone: partner.phone || '', email: partner.email || '', taxCode: partner.taxCode || '', representative: partner.representative || '',
      address: partner.address || '', bankName: partner.bankName || '', bankAccountNo: partner.bankAccountNo || '', bankAccountName: partner.bankAccountName || '',
      defaultPolicyId: relationId(partner.defaultPolicyId), defaultOfficialPolicyId: relationId(partner.defaultOfficialPolicyId), defaultSeasonalPolicyId: relationId(partner.defaultSeasonalPolicyId),
      status: partner.status || 'active', note: partner.note || '',
    });
    setFormOpen(true);
  }

  async function save() {
    if (!scope || saving) return;
    const input: LaborPartnerInput = {
      ...form,
      code: form.code.trim().toLocaleUpperCase('vi'), name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim().toLocaleLowerCase('vi'),
      taxCode: form.taxCode.trim(), representative: form.representative.trim(), address: form.address.trim(), bankName: form.bankName.trim(),
      bankAccountNo: form.bankAccountNo.trim(), bankAccountName: form.bankAccountName.trim(), note: form.note.trim(),
    };
    if (!input.code || !input.name || !input.phone) { Alert.alert('Thiếu thông tin', 'Mã, tên và số điện thoại đối tác là bắt buộc.'); return; }
    if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) { Alert.alert('Email chưa hợp lệ', 'Kiểm tra lại địa chỉ email của đối tác.'); return; }
    setSaving(true);
    try { await saveLaborPartner(scope, input, editing?._id); setFormOpen(false); await load(false); }
    catch (cause) { Alert.alert('Không lưu được đối tác', cause instanceof Error ? cause.message : 'IGen-ERP từ chối yêu cầu.'); }
    finally { setSaving(false); }
  }

  async function savePolicy() {
    if (!scope || savingPolicy) return;
    const amounts = policyForm.amounts.slice(0, policyForm.maxMonths).map((value) => Number(value.replace(/\D/g, '')));
    const tiers = policyForm.tiers.map((tier) => ({ minHours: Number(tier.minHours), maxHours: tier.maxHours.trim() ? Number(tier.maxHours) : null, hourlyRate: Number(tier.hourlyRate.replace(/\D/g, '')) }));
    const cutoffDay = Number(policyForm.cutoffDay);
    const minimumWorkerHours = policyForm.minHoursPerWorker.trim() ? Number(policyForm.minHoursPerWorker) : null;
    const maximumWorkerHours = policyForm.maxEligibleHoursPerWorker.trim() ? Number(policyForm.maxEligibleHoursPerWorker) : null;
    const moneyRoundingUnit = Number(policyForm.moneyRoundingUnit.replace(/\D/g, ''));
    if (!policyForm.name.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(policyForm.effectiveFrom)) { Alert.alert('Thiếu thông tin', 'Nhập tên chính sách và ngày hiệu lực theo dạng YYYY-MM-DD.'); return; }
    if (policyForm.cycle === 'cutoff_day' && (!Number.isInteger(cutoffDay) || cutoffDay < 1 || cutoffDay > 28)) { Alert.alert('Ngày chốt kỳ chưa hợp lệ', 'Nhập ngày từ 1 đến 28.'); return; }
    if (!policyForm.officialEnabled && !policyForm.seasonalEnabled) { Alert.alert('Chưa chọn cơ chế', 'Bật hoa hồng chính thức hoặc thời vụ.'); return; }
    if (policyForm.officialEnabled && (policyForm.amounts.slice(0, policyForm.maxMonths).some((value) => !value.trim()) || amounts.some((amount) => !Number.isSafeInteger(amount) || amount < 0))) { Alert.alert('Thiếu mức hoa hồng', 'Nhập số tiền VND cho từng mốc tháng chính thức.'); return; }
    if (policyForm.officialEnabled && policyForm.milestoneRules.slice(0, policyForm.maxMonths).some((rule) => rule.eligibilityRule === 'attendance_threshold' && ((rule.minWorkedDays.trim() && (!Number.isInteger(Number(rule.minWorkedDays)) || Number(rule.minWorkedDays) < 0)) || (rule.minWorkedHours.trim() && (!Number.isFinite(Number(rule.minWorkedHours)) || Number(rule.minWorkedHours) < 0))))) { Alert.alert('Điều kiện chấm công chưa hợp lệ', 'Số ngày phải là số nguyên không âm; số giờ phải không âm.'); return; }
    if (policyForm.seasonalEnabled && (policyForm.tiers.some((row, index) => !row.minHours.trim() || !row.hourlyRate.trim() || (index < policyForm.tiers.length - 1 && !row.maxHours.trim())) || tiers.some((tier) => !Number.isFinite(tier.minHours) || tier.minHours < 0 || !Number.isSafeInteger(tier.hourlyRate) || tier.hourlyRate < 0 || (tier.maxHours !== null && (!Number.isFinite(tier.maxHours) || tier.maxHours <= tier.minHours))))) { Alert.alert('Bậc thời vụ chưa hợp lệ', 'Kiểm tra giờ bắt đầu, giờ kết thúc và đơn giá của mỗi bậc. Bậc cuối có thể để trống giờ kết thúc.'); return; }
    if (policyForm.seasonalEnabled && ((minimumWorkerHours !== null && (!Number.isFinite(minimumWorkerHours) || minimumWorkerHours < 0)) || (maximumWorkerHours !== null && (!Number.isFinite(maximumWorkerHours) || maximumWorkerHours < 0)) || !Number.isSafeInteger(moneyRoundingUnit) || moneyRoundingUnit < 1)) { Alert.alert('Cấu hình làm tròn chưa hợp lệ', 'Kiểm tra ngưỡng giờ mỗi lao động và đơn vị làm tròn tiền dương.'); return; }
    setSavingPolicy(true);
    try {
      const input: Parameters<typeof createLaborCommissionPolicy>[1] = {
        name: policyForm.name.trim(), effectiveFrom: policyForm.effectiveFrom,
        settlementCycle: { type: policyForm.cycle, cutoffDay: policyForm.cycle === 'cutoff_day' ? cutoffDay : null },
        official: {
          enabled: policyForm.officialEnabled, maxMonths: policyForm.officialEnabled ? policyForm.maxMonths : null,
          milestones: policyForm.officialEnabled ? amounts.map((amount, index) => {
            const rule = policyForm.milestoneRules[index] || { eligibilityRule: 'contract_active' as const, minWorkedDays: '', minWorkedHours: '' };
            return { month: (index + 1) as 1 | 2 | 3, amount, eligibilityRule: rule.eligibilityRule, minWorkedDays: rule.eligibilityRule === 'attendance_threshold' && rule.minWorkedDays.trim() ? Number(rule.minWorkedDays) : null, minWorkedHours: rule.eligibilityRule === 'attendance_threshold' && rule.minWorkedHours.trim() ? Number(rule.minWorkedHours) : null };
          }) : [],
        },
        seasonal: {
          enabled: policyForm.seasonalEnabled, aggregationScope: policyForm.seasonalEnabled ? policyForm.aggregationScope : null,
          tierMode: policyForm.seasonalEnabled ? policyForm.tierMode : null,
          minHoursPerWorker: policyForm.seasonalEnabled ? minimumWorkerHours : null,
          maxEligibleHoursPerWorker: policyForm.seasonalEnabled ? maximumWorkerHours : null,
          hourRounding: { unitMinutes: policyForm.hourRoundingUnit, mode: policyForm.hourRoundingMode },
          moneyRounding: { unitVnd: policyForm.seasonalEnabled ? moneyRoundingUnit : 1, mode: policyForm.moneyRoundingMode },
          tiers: policyForm.seasonalEnabled ? tiers : [],
        },
      };
      if (editingPolicy) await updateLaborCommissionPolicy(scope, editingPolicy._id, input);
      else await createLaborCommissionPolicy(scope, input);
      setPolicyFormOpen(false); setEditingPolicy(null); setPolicyForm(emptyPolicyForm()); await load(false);
    } catch (cause) { Alert.alert('Không lưu được chính sách', cause instanceof Error ? cause.message : 'IGen-ERP từ chối yêu cầu.'); }
    finally { setSavingPolicy(false); }
  }

  function openPolicyEdit(policy: LaborCommissionPolicy) {
    setEditingPolicy(policy);
    setPolicyForm({
      name: policy.name, effectiveFrom: policy.effectiveFrom.slice(0, 10),
      cycle: policy.settlementCycle?.type || 'calendar_month', cutoffDay: policy.settlementCycle?.cutoffDay == null ? '' : String(policy.settlementCycle.cutoffDay),
      officialEnabled: policy.official.enabled,
      maxMonths: (policy.official.maxMonths || Math.max(1, policy.official.milestones?.length || 1)) as 1 | 2 | 3,
      amounts: policy.official.milestones?.map((item) => formatVndInput(item.amount)) || [''],
      milestoneRules: Array.from({ length: 3 }, (_, index) => { const item = policy.official.milestones?.[index]; return { eligibilityRule: item?.eligibilityRule || 'contract_active', minWorkedDays: item?.minWorkedDays == null ? '' : String(item.minWorkedDays), minWorkedHours: item?.minWorkedHours == null ? '' : String(item.minWorkedHours) }; }),
      seasonalEnabled: policy.seasonal.enabled, tierMode: policy.seasonal.tierMode || 'flat', aggregationScope: policy.seasonal.aggregationScope || 'partner_period',
      minHoursPerWorker: policy.seasonal.minHoursPerWorker == null ? '' : String(policy.seasonal.minHoursPerWorker), maxEligibleHoursPerWorker: policy.seasonal.maxEligibleHoursPerWorker == null ? '' : String(policy.seasonal.maxEligibleHoursPerWorker),
      hourRoundingUnit: policy.seasonal.hourRounding?.unitMinutes || 1, hourRoundingMode: policy.seasonal.hourRounding?.mode || 'nearest',
      moneyRoundingUnit: formatVndInput(policy.seasonal.moneyRounding?.unitVnd || 1), moneyRoundingMode: policy.seasonal.moneyRounding?.mode || 'nearest',
      tiers: policy.seasonal.tiers?.map((item) => ({ minHours: String(item.minHours), maxHours: item.maxHours == null ? '' : String(item.maxHours), hourlyRate: formatVndInput(item.hourlyRate) })) || [{ minHours: '0', maxHours: '', hourlyRate: '' }],
    });
    setPolicyFormOpen(true);
  }
  function confirmRemovePolicy(policy: LaborCommissionPolicy) {
    Alert.alert('Xóa chính sách hoa hồng?', `Xóa “${policy.name}”? Chính sách đã được dùng cho nguồn giới thiệu có thể không xóa được.`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: () => { if (!scope) return; void removeLaborCommissionPolicy(scope, policy._id).then(() => load(false)).catch((cause) => Alert.alert('Không xóa được chính sách', cause instanceof Error ? cause.message : 'IGen-ERP từ chối yêu cầu.')); } },
    ]);
  }

  function changePolicyStatus(policy: LaborCommissionPolicy, action: 'activate' | 'retire') {
    const message = action === 'retire' ? `Ngừng áp dụng chính sách ${policy.name}?` : `Kích hoạt chính sách ${policy.name}?`;
    Alert.alert(message, undefined, [
      { text: 'Hủy', style: 'cancel' },
      { text: action === 'retire' ? 'Ngừng' : 'Kích hoạt', onPress: () => { if (!scope) return; void setLaborCommissionPolicyStatus(scope, policy._id, action).then(() => load(false)).catch((cause) => Alert.alert('Không cập nhật được', cause instanceof Error ? cause.message : 'IGen-ERP từ chối yêu cầu.')); } },
    ]);
  }

  function confirmRemove(partner: LaborPartner) {
    Alert.alert('Xóa đối tác lao động?', `Xóa ${partner.name}? Đối tác có nguồn giới thiệu đang chờ hoặc hiệu lực sẽ không thể xóa.`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: () => { if (!scope) return; void removeLaborPartner(scope, partner._id).then(() => load(false)).catch((cause) => Alert.alert('Không xóa được', cause instanceof Error ? cause.message : 'IGen-ERP từ chối yêu cầu.')); } },
    ]);
  }

  const activePolicies = policies.filter((policy) => policy.status === 'active');
  const policyForSlot = (slot: PolicySlot) => activePolicies.filter((policy) => slot === 'defaultPolicyId' || (slot === 'defaultOfficialPolicyId' ? policy.official.enabled : policy.seasonal.enabled));
  const policyName = (id: string) => policies.find((policy) => policy._id === id)?.name || 'Chưa gắn chính sách';
  const selectedId = picker ? form[picker] : '';

  if (!canRead) return <PermissionState title="Chưa có quyền xem đối tác lao động" detail="Cần quyền labor-partner:read hoặc labor-partner:manage." />;

  return <View style={styles.container}>
    <ScrollView horizontal style={styles.moduleNavigationScroll} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moduleNavigation}>
      <Tab label="Đối tác" icon={<BriefcaseBusiness size={14} color={tab === 'partners' ? colors.white : colors.muted} />} active={tab === 'partners'} onPress={() => setTab('partners')} />
      <Tab label="Chính sách hoa hồng" icon={<FileSliders size={14} color={tab === 'policies' ? colors.white : colors.muted} />} active={tab === 'policies'} onPress={() => setTab('policies')} />
      <Tab label="Nguồn giới thiệu" icon={<UsersRound size={14} color={tab === 'referrals' ? colors.white : colors.muted} />} active={tab === 'referrals'} onPress={() => setTab('referrals')} />
      <Tab label="KPI" icon={<UsersRound size={14} color={tab === 'kpi' ? colors.white : colors.muted} />} active={tab === 'kpi'} onPress={() => setTab('kpi')} />
      <Tab label="Đối soát" icon={<BriefcaseBusiness size={14} color={tab === 'settlements' ? colors.white : colors.muted} />} active={tab === 'settlements'} onPress={() => setTab('settlements')} />
    </ScrollView>
    {(tab === 'partners' || tab === 'policies') && <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(false); }} tintColor={colors.primary} />} showsVerticalScrollIndicator={false}>
      {tab === 'partners' ? <>
        <View style={styles.toolbar}>
          <View style={styles.searchBox}><Search size={15} color={colors.muted} /><TextInput value={search} onChangeText={setSearch} placeholder="Tìm mã, tên hoặc điện thoại" placeholderTextColor={colors.muted} style={styles.searchInput} />{search ? <Pressable onPress={() => setSearch('')}><X size={15} color={colors.muted} /></Pressable> : null}</View>
          {canManage && <Pressable accessibilityRole="button" onPress={openCreate} style={styles.addButton}><Plus size={16} color={colors.white} /><Text style={styles.addText}>Thêm đối tác</Text></Pressable>}
        </View>
        {error ? <PopupError error={error} onRetry={() => void load()} /> : loading ? <LoadingState /> : visible.length === 0 ? <InlineState title={search ? 'Không tìm thấy đối tác' : 'Chưa có đối tác lao động'} detail={search ? 'Thử tên, mã hoặc số điện thoại khác.' : 'Thêm đối tác để gắn nguồn giới thiệu lao động và chính sách hoa hồng.'} /> : <View style={styles.list}>{visible.map((partner) => <LaborPartnerCard key={partner._id} partner={partner} policies={policies} canManage={canManage} onEdit={() => openEdit(partner)} onDelete={() => confirmRemove(partner)} />)}</View>}
      </> : <>
        {canManagePolicies && <Pressable onPress={() => { setEditingPolicy(null); setPolicyForm(emptyPolicyForm()); setPolicyFormOpen(true); }} style={styles.policyCreate}><Plus size={14} color={colors.white} /><Text style={styles.addText}>Tạo chính sách hoa hồng</Text></Pressable>}
        {error ? <PopupError error={error} onRetry={() => void load()} /> : loading ? <LoadingState /> : policies.length === 0 ? <InlineState title="Chưa có chính sách hoa hồng" detail="Tạo chính sách trước khi gắn chính sách vào đối tác hoặc nguồn giới thiệu." /> : <View style={styles.list}>{policies.map((policy) => <PolicyCard key={policy._id} policy={policy} canManage={canManagePolicies} onEdit={() => openPolicyEdit(policy)} onDelete={() => confirmRemovePolicy(policy)} onActivate={() => changePolicyStatus(policy, 'activate')} onRetire={() => changePolicyStatus(policy, 'retire')} />)}</View>}
      </>}
    </ScrollView>}
    {scope && (tab === 'referrals' || tab === 'kpi' || tab === 'settlements') && <LaborPartnerActivities scope={scope} partners={partners} policies={policies} initialTab={tab} canManage={canManage} canManageSettlements={canManageSettlements} canPayout={canPayout} />}

    <Modal visible={formOpen} transparent animationType="fade" onRequestClose={() => { if (!saving) setFormOpen(false); }}>
      <Pressable style={styles.modalBackdrop} onPress={() => { if (!saving) setFormOpen(false); }}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={styles.modalHeader}><View style={{ flex: 1 }}><Text style={styles.modalTitle}>{editing ? 'Sửa đối tác lao động' : 'Thêm đối tác lao động'}</Text><Text style={styles.modalSubtitle}>Mã, tên và số điện thoại là bắt buộc.</Text></View><Pressable onPress={() => { if (!saving) setFormOpen(false); }} style={styles.closeButton}><X size={18} color={colors.muted} /></Pressable></View>
          <ScrollView style={styles.formScroll} contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Field label="Mã đối tác *" value={form.code} onChangeText={(code) => setForm((current) => ({ ...current, code }))} autoCapitalize="characters" editable={!editing} />
            <Field label="Tên đối tác *" value={form.name} onChangeText={(name) => setForm((current) => ({ ...current, name }))} />
            <Field label="Số điện thoại *" value={form.phone} onChangeText={(phone) => setForm((current) => ({ ...current, phone }))} keyboardType="phone-pad" />
            <Field label="Email" value={form.email} onChangeText={(email) => setForm((current) => ({ ...current, email }))} keyboardType="email-address" autoCapitalize="none" />
            <Field label="Mã số thuế" value={form.taxCode} onChangeText={(taxCode) => setForm((current) => ({ ...current, taxCode }))} />
            <Field label="Người đại diện" value={form.representative} onChangeText={(representative) => setForm((current) => ({ ...current, representative }))} />
            <Field label="Địa chỉ" value={form.address} onChangeText={(address) => setForm((current) => ({ ...current, address }))} />
            <Text style={styles.sectionLabel}>Tài khoản nhận chi trả</Text>
            <Field label="Ngân hàng" value={form.bankName} onChangeText={(bankName) => setForm((current) => ({ ...current, bankName }))} />
            <Field label="Số tài khoản" value={form.bankAccountNo} onChangeText={(bankAccountNo) => setForm((current) => ({ ...current, bankAccountNo }))} keyboardType="number-pad" />
            <Field label="Tên chủ tài khoản" value={form.bankAccountName} onChangeText={(bankAccountName) => setForm((current) => ({ ...current, bankAccountName }))} />
            <Text style={styles.sectionLabel}>Chính sách hoa hồng</Text>
            <PolicyPicker label="Chính sách mặc định" value={policyName(form.defaultPolicyId)} onPress={() => setPicker('defaultPolicyId')} />
            <PolicyPicker label="Lao động chính thức" value={policyName(form.defaultOfficialPolicyId)} onPress={() => setPicker('defaultOfficialPolicyId')} />
            <PolicyPicker label="Lao động thời vụ" value={policyName(form.defaultSeasonalPolicyId)} onPress={() => setPicker('defaultSeasonalPolicyId')} />
            <Text style={styles.fieldHint}>Chính sách theo loại lao động phải đang hiệu lực và bật đúng cơ chế hoa hồng.</Text>
            <Text style={styles.fieldLabel}>Trạng thái</Text>
            <View style={styles.statusOptions}>{(['active', 'inactive'] as const).map((status) => <Pressable key={status} onPress={() => setForm((current) => ({ ...current, status }))} style={[styles.statusOption, form.status === status && styles.statusOptionSelected]}><Text style={[styles.statusOptionText, form.status === status && styles.statusOptionTextSelected]}>{status === 'active' ? 'Đang hoạt động' : 'Ngừng hoạt động'}</Text></Pressable>)}</View>
            <Field label="Ghi chú" value={form.note} onChangeText={(note) => setForm((current) => ({ ...current, note }))} multiline />
          </ScrollView>
          <View style={styles.modalActions}><Pressable onPress={() => setFormOpen(false)} disabled={saving} style={styles.cancelButton}><Text style={styles.cancelText}>Hủy</Text></Pressable><Pressable onPress={() => void save()} disabled={saving} style={[styles.saveButton, saving && styles.disabled]}>{saving ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.saveText}>{editing ? 'Lưu thay đổi' : 'Tạo đối tác'}</Text>}</Pressable></View>
        </Pressable>
      </Pressable>
    </Modal>
    <Modal visible={policyFormOpen} transparent animationType="fade" onRequestClose={() => { if (!savingPolicy) setPolicyFormOpen(false); }}>
      <Pressable style={styles.modalBackdrop} onPress={() => { if (!savingPolicy) setPolicyFormOpen(false); }}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={styles.modalHeader}><View style={{ flex: 1 }}><Text style={styles.modalTitle}>{editingPolicy ? 'Sửa chính sách hoa hồng' : 'Tạo chính sách hoa hồng'}</Text><Text style={styles.modalSubtitle}>{editingPolicy ? `Phiên bản ${editingPolicy.version} · ${editingPolicy.status}` : 'Chính sách mới được lưu ở trạng thái nháp.'}</Text></View><Pressable onPress={() => { if (!savingPolicy) setPolicyFormOpen(false); }} style={styles.closeButton}><X size={18} color={colors.muted} /></Pressable></View>
          <ScrollView style={styles.formScroll} contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionLabel}>Chu kỳ chốt đối soát</Text><View style={styles.statusOptions}>{([{ value: 'calendar_month', label: 'Tháng dương lịch' }, { value: 'cutoff_day', label: 'Ngày chốt cố định' }] as const).map((item) => <Pressable key={item.value} onPress={() => setPolicyForm((current) => ({ ...current, cycle: item.value }))} style={[styles.statusOption, policyForm.cycle === item.value && styles.statusOptionSelected]}><Text style={[styles.statusOptionText, policyForm.cycle === item.value && styles.statusOptionTextSelected]}>{item.label}</Text></Pressable>)}</View>{policyForm.cycle === 'cutoff_day' && <Field label="Ngày chốt (1–28) *" value={policyForm.cutoffDay} onChangeText={(cutoffDay) => setPolicyForm((current) => ({ ...current, cutoffDay }))} keyboardType="number-pad" />}
            <Field label="Tên chính sách *" value={policyForm.name} onChangeText={(name) => setPolicyForm((current) => ({ ...current, name }))} />
            <DateTimeField label="Ngày hiệu lực *" mode="date" value={policyForm.effectiveFrom} onChange={(effectiveFrom) => setPolicyForm((current) => ({ ...current, effectiveFrom }))} />
            <Text style={styles.sectionLabel}>Hoa hồng lao động chính thức</Text><View style={styles.statusOptions}><Pressable onPress={() => setPolicyForm((current) => ({ ...current, officialEnabled: !current.officialEnabled }))} style={[styles.statusOption, policyForm.officialEnabled && styles.statusOptionSelected]}><Text style={[styles.statusOptionText, policyForm.officialEnabled && styles.statusOptionTextSelected]}>{policyForm.officialEnabled ? 'Đang bật' : 'Đang tắt'}</Text></Pressable>{policyForm.officialEnabled && [1, 2, 3].map((months) => <Pressable key={months} onPress={() => setPolicyForm((current) => ({ ...current, maxMonths: months as 1 | 2 | 3, amounts: Array.from({ length: months }, (_, index) => current.amounts[index] || '') }))} style={[styles.statusOption, policyForm.maxMonths === months && styles.statusOptionSelected]}><Text style={[styles.statusOptionText, policyForm.maxMonths === months && styles.statusOptionTextSelected]}>{months} tháng</Text></Pressable>)}</View>
            {policyForm.officialEnabled && policyForm.amounts.slice(0, policyForm.maxMonths).map((amount, index) => <Field key={index} label={`Hoa hồng mốc tháng ${index + 1} (VND) *`} value={amount} onChangeText={(value) => setPolicyForm((current) => ({ ...current, amounts: current.amounts.map((old, i) => i === index ? formatVndInput(value) : old) }))} keyboardType="number-pad" />)}
            {policyForm.officialEnabled && policyForm.amounts.slice(0, policyForm.maxMonths).map((_, index) => <View key={`eligibility-${index}`} style={styles.tierForm}><Text style={styles.tierLabel}>Điều kiện mốc tháng {index + 1}</Text><View style={styles.statusOptions}>{([{ value: 'contract_active', label: 'Hợp đồng còn hiệu lực' }, { value: 'manual_confirmation', label: 'Xác nhận thủ công' }, { value: 'attendance_threshold', label: 'Ngưỡng chấm công' }] as const).map((item) => <Pressable key={item.value} onPress={() => setPolicyForm((current) => ({ ...current, milestoneRules: current.milestoneRules.map((rule, ruleIndex) => ruleIndex === index ? { ...rule, eligibilityRule: item.value } : rule) }))} style={[styles.statusOption, policyForm.milestoneRules[index]?.eligibilityRule === item.value && styles.statusOptionSelected]}><Text style={[styles.statusOptionText, policyForm.milestoneRules[index]?.eligibilityRule === item.value && styles.statusOptionTextSelected]}>{item.label}</Text></Pressable>)}</View>{policyForm.milestoneRules[index]?.eligibilityRule === 'attendance_threshold' && <><Field label="Số ngày làm tối thiểu" value={policyForm.milestoneRules[index]?.minWorkedDays || ''} onChangeText={(value) => setPolicyForm((current) => ({ ...current, milestoneRules: current.milestoneRules.map((rule, ruleIndex) => ruleIndex === index ? { ...rule, minWorkedDays: value } : rule) }))} keyboardType="number-pad" /><Field label="Số giờ làm tối thiểu" value={policyForm.milestoneRules[index]?.minWorkedHours || ''} onChangeText={(value) => setPolicyForm((current) => ({ ...current, milestoneRules: current.milestoneRules.map((rule, ruleIndex) => ruleIndex === index ? { ...rule, minWorkedHours: value } : rule) }))} keyboardType="decimal-pad" /></>}</View>)}
            <Text style={styles.sectionLabel}>Hoa hồng lao động thời vụ</Text><View style={styles.statusOptions}><Pressable onPress={() => setPolicyForm((current) => ({ ...current, seasonalEnabled: !current.seasonalEnabled }))} style={[styles.statusOption, policyForm.seasonalEnabled && styles.statusOptionSelected]}><Text style={[styles.statusOptionText, policyForm.seasonalEnabled && styles.statusOptionTextSelected]}>{policyForm.seasonalEnabled ? 'Đang bật' : 'Đang tắt'}</Text></Pressable>{policyForm.seasonalEnabled && (['flat', 'progressive'] as const).map((mode) => <Pressable key={mode} onPress={() => setPolicyForm((current) => ({ ...current, tierMode: mode }))} style={[styles.statusOption, policyForm.tierMode === mode && styles.statusOptionSelected]}><Text style={[styles.statusOptionText, policyForm.tierMode === mode && styles.statusOptionTextSelected]}>{mode === 'flat' ? 'Một bậc' : 'Lũy tiến'}</Text></Pressable>)}</View>
            {policyForm.seasonalEnabled && <View style={styles.tierForm}><Text style={styles.tierLabel}>Phạm vi và giới hạn giờ</Text><View style={styles.statusOptions}>{([{ value: 'partner_period', label: 'Cộng toàn kỳ của đối tác' }, { value: 'partner_project_period', label: 'Theo dự án và kỳ' }] as const).map((item) => <Pressable key={item.value} onPress={() => setPolicyForm((current) => ({ ...current, aggregationScope: item.value }))} style={[styles.statusOption, policyForm.aggregationScope === item.value && styles.statusOptionSelected]}><Text style={[styles.statusOptionText, policyForm.aggregationScope === item.value && styles.statusOptionTextSelected]}>{item.label}</Text></Pressable>)}</View><Field label="Giờ tối thiểu mỗi lao động (để trống nếu không áp dụng)" value={policyForm.minHoursPerWorker} onChangeText={(minHoursPerWorker) => setPolicyForm((current) => ({ ...current, minHoursPerWorker }))} keyboardType="decimal-pad" /><Field label="Giờ tối đa mỗi lao động (để trống nếu không giới hạn)" value={policyForm.maxEligibleHoursPerWorker} onChangeText={(maxEligibleHoursPerWorker) => setPolicyForm((current) => ({ ...current, maxEligibleHoursPerWorker }))} keyboardType="decimal-pad" /><Text style={styles.tierLabel}>Làm tròn giờ</Text><View style={styles.statusOptions}>{([1, 5, 15, 30, 60] as const).map((unit) => <Pressable key={unit} onPress={() => setPolicyForm((current) => ({ ...current, hourRoundingUnit: unit }))} style={[styles.statusOption, policyForm.hourRoundingUnit === unit && styles.statusOptionSelected]}><Text style={[styles.statusOptionText, policyForm.hourRoundingUnit === unit && styles.statusOptionTextSelected]}>{unit} phút</Text></Pressable>)}</View><View style={styles.statusOptions}>{(['floor', 'nearest', 'ceil'] as const).map((mode) => <Pressable key={mode} onPress={() => setPolicyForm((current) => ({ ...current, hourRoundingMode: mode }))} style={[styles.statusOption, policyForm.hourRoundingMode === mode && styles.statusOptionSelected]}><Text style={[styles.statusOptionText, policyForm.hourRoundingMode === mode && styles.statusOptionTextSelected]}>{mode === 'floor' ? 'Làm xuống' : mode === 'ceil' ? 'Làm lên' : 'Gần nhất'}</Text></Pressable>)}</View><Text style={styles.tierLabel}>Làm tròn tiền</Text><Field label="Đơn vị VND (số nguyên dương)" value={policyForm.moneyRoundingUnit} onChangeText={(moneyRoundingUnit) => setPolicyForm((current) => ({ ...current, moneyRoundingUnit: formatVndInput(moneyRoundingUnit) }))} keyboardType="number-pad" /><View style={styles.statusOptions}>{(['floor', 'nearest', 'ceil'] as const).map((mode) => <Pressable key={mode} onPress={() => setPolicyForm((current) => ({ ...current, moneyRoundingMode: mode }))} style={[styles.statusOption, policyForm.moneyRoundingMode === mode && styles.statusOptionSelected]}><Text style={[styles.statusOptionText, policyForm.moneyRoundingMode === mode && styles.statusOptionTextSelected]}>{mode === 'floor' ? 'Làm xuống' : mode === 'ceil' ? 'Làm lên' : 'Gần nhất'}</Text></Pressable>)}</View></View>}
            {policyForm.seasonalEnabled && policyForm.tiers.map((tier, index) => <View key={index} style={styles.tierForm}><Text style={styles.tierLabel}>Bậc {index + 1}{index === policyForm.tiers.length - 1 ? ' · bậc cuối có thể không giới hạn' : ''}</Text><Field label="Từ giờ" value={tier.minHours} onChangeText={(value) => setPolicyForm((current) => ({ ...current, tiers: current.tiers.map((old, i) => i === index ? { ...old, minHours: value } : old) }))} keyboardType="decimal-pad" /><Field label="Đến giờ (để trống nếu không giới hạn)" value={tier.maxHours} onChangeText={(value) => setPolicyForm((current) => ({ ...current, tiers: current.tiers.map((old, i) => i === index ? { ...old, maxHours: value } : old) }))} keyboardType="decimal-pad" /><Field label="Đơn giá (VND/giờ)" value={tier.hourlyRate} onChangeText={(value) => setPolicyForm((current) => ({ ...current, tiers: current.tiers.map((old, i) => i === index ? { ...old, hourlyRate: formatVndInput(value) } : old) }))} keyboardType="number-pad" /></View>)}
            {policyForm.seasonalEnabled && <Pressable onPress={() => setPolicyForm((current) => ({ ...current, tiers: [...current.tiers, { minHours: '', maxHours: '', hourlyRate: '' }] }))} style={styles.addTier}><Plus size={13} color={colors.primary} /><Text style={styles.addTierText}>Thêm bậc giờ</Text></Pressable>}
          </ScrollView>
          <View style={styles.modalActions}><Pressable onPress={() => { if (!savingPolicy) { setPolicyFormOpen(false); setEditingPolicy(null); } }} disabled={savingPolicy} style={styles.cancelButton}><Text style={styles.cancelText}>Hủy</Text></Pressable><Pressable onPress={() => void savePolicy()} disabled={savingPolicy} style={[styles.saveButton, savingPolicy && styles.disabled]}>{savingPolicy ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.saveText}>{editingPolicy ? 'Lưu thay đổi' : 'Lưu bản nháp'}</Text>}</Pressable></View>
        </Pressable>
      </Pressable>
    </Modal>
    <Modal visible={picker !== null} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
      <Pressable style={styles.pickerBackdrop} onPress={() => setPicker(null)}><View style={styles.pickerCard}>
        <Text style={styles.pickerTitle}>{picker === 'defaultPolicyId' ? 'Chọn chính sách mặc định' : picker === 'defaultOfficialPolicyId' ? 'Chọn chính sách chính thức' : 'Chọn chính sách thời vụ'}</Text>
        <ScrollView style={styles.pickerList}>
          <Pressable style={styles.pickerOption} onPress={() => { if (picker) setForm((current) => ({ ...current, [picker]: '' })); setPicker(null); }}><Text style={styles.pickerOptionName}>Không gắn chính sách</Text></Pressable>
          {picker && policyForSlot(picker).map((policy) => <Pressable key={policy._id} style={styles.pickerOption} onPress={() => { setForm((current) => ({ ...current, [picker]: policy._id })); setPicker(null); }}><Text style={styles.pickerOptionName}>{policy.name} · v{policy.version}</Text><Text style={styles.pickerOptionDetail}>Hiệu lực từ {policy.effectiveFrom}</Text></Pressable>)}
          {picker && policyForSlot(picker).length === 0 && <Text style={styles.emptyPicker}>Chưa có chính sách phù hợp đang hiệu lực.</Text>}
        </ScrollView>
      </View></Pressable>
    </Modal>
  </View>;
}

function LaborPartnerCard({ partner, policies, canManage, onEdit, onDelete }: { partner: LaborPartner; policies: LaborCommissionPolicy[]; canManage: boolean; onEdit: () => void; onDelete: () => void }) {
  const policyName = (value: LaborPartner['defaultPolicyId']) => { const id = relationId(value); return policies.find((item) => item._id === id)?.name; };
  return <View style={styles.card}>
    <View style={styles.cardHeader}><View style={styles.identity}><View style={styles.iconBox}><BriefcaseBusiness size={17} color={colors.primary} /></View><View style={styles.identityCopy}><Text style={styles.partnerName} numberOfLines={1}>{partner.name}</Text><Text style={styles.partnerMeta}>{partner.code} · {partner.phone}</Text></View></View><Text style={[styles.badge, partner.status === 'active' ? styles.activeBadge : styles.inactiveBadge]}>{partner.status === 'active' ? 'Đang hoạt động' : 'Ngừng hoạt động'}</Text></View>
    <View style={styles.summaryRow}><Summary label="Nguồn hiệu lực" value={partner.referralSummary?.active || 0} /><Summary label="Chờ xác nhận" value={partner.referralSummary?.pending || 0} /><Summary label="Tổng nguồn" value={partner.referralSummary?.total || 0} /></View>
    <View style={styles.policySummary}><Text style={styles.policyLabel}>Chính thức: <Text style={styles.policyValue}>{policyName(partner.defaultOfficialPolicyId) || policyName(partner.defaultPolicyId) || 'Chưa gắn'}</Text></Text><Text style={styles.policyLabel}>Thời vụ: <Text style={styles.policyValue}>{policyName(partner.defaultSeasonalPolicyId) || policyName(partner.defaultPolicyId) || 'Chưa gắn'}</Text></Text></View>
    {canManage && <View style={styles.cardActions}><Pressable onPress={onDelete} style={styles.iconButton}><Trash2 size={15} color="#B42318" /><Text style={styles.deleteText}>Xóa</Text></Pressable><Pressable onPress={onEdit} style={styles.editButton}><Pencil size={13} color={colors.primary} /><Text style={styles.editText}>Chỉnh sửa</Text></Pressable></View>}
  </View>;
}

function PolicyCard({ policy, canManage, onEdit, onDelete, onActivate, onRetire }: { policy: LaborCommissionPolicy; canManage: boolean; onEdit: () => void; onDelete: () => void; onActivate: () => void; onRetire: () => void }) {
  return <View style={styles.card}><View style={styles.cardHeader}><View style={styles.identity}><View style={[styles.iconBox, styles.policyIcon]}><FileSliders size={17} color="#7542C8" /></View><View style={styles.identityCopy}><Text style={styles.partnerName}>{policy.name}</Text><Text style={styles.partnerMeta}>Phiên bản {policy.version} · hiệu lực từ {policy.effectiveFrom}</Text></View></View><Text style={[styles.badge, policy.status === 'active' ? styles.activeBadge : policy.status === 'draft' ? styles.draftBadge : styles.inactiveBadge]}>{policy.status === 'active' ? 'Đang dùng' : policy.status === 'draft' ? 'Bản nháp' : 'Đã ngừng'}</Text></View><View style={styles.policyKinds}><Text style={[styles.schemePill, policy.official.enabled && styles.schemeEnabled]}>Chính thức {policy.official.enabled ? '· Bật' : '· Tắt'}</Text><Text style={[styles.schemePill, policy.seasonal.enabled && styles.schemeSeasonal]}>Thời vụ {policy.seasonal.enabled ? `· ${policy.seasonal.tierMode === 'progressive' ? 'Lũy tiến' : 'Theo bậc'}` : '· Tắt'}</Text></View>{canManage && <View style={styles.cardActions}><Pressable accessibilityLabel="Sửa chính sách" onPress={onEdit} style={styles.editButton}><Pencil size={12} color={colors.primary} /><Text style={styles.editText}>Sửa</Text></Pressable>{policy.status === 'active' ? <Pressable onPress={onRetire} style={[styles.policyAction, styles.retireAction]}><Text style={styles.retireText}>Ngừng áp dụng</Text></Pressable> : <Pressable onPress={onActivate} style={styles.policyAction}><Text style={styles.activateText}>{policy.status === 'retired' ? 'Dùng lại' : 'Kích hoạt'}</Text></Pressable>}<Pressable accessibilityLabel="Xóa chính sách" onPress={onDelete} style={styles.iconButton}><Trash2 size={13} color="#B42318" /><Text style={styles.deleteText}>Xóa</Text></Pressable></View>}</View>;
}

function Summary({ label, value }: { label: string; value: number }) { return <View style={styles.summary}><Text style={styles.summaryValue}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>; }
function Tab({ label, icon, active, onPress }: { label: string; icon: ReactNode; active: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>{icon}<Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text></Pressable>; }
function Field({ label, value, onChangeText, multiline, ...props }: { label: string; value: string; onChangeText: (value: string) => void; multiline?: boolean } & Omit<ComponentProps<typeof TextInput>, 'value' | 'onChangeText' | 'multiline'>) { return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} placeholderTextColor={colors.muted} style={[styles.input, multiline && styles.multiline]} {...props} /></View>; }
function PolicyPicker({ label, value, onPress }: { label: string; value: string; onPress: () => void }) { return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><Pressable onPress={onPress} style={styles.policyPicker}><Text numberOfLines={1} style={[styles.policyPickerValue, value === 'Chưa gắn chính sách' && styles.placeholder]}>{value}</Text><Text style={styles.pickerAction}>Chọn</Text></Pressable></View>; }
function InlineState({ title, detail, onRetry }: { title: string; detail: string; onRetry?: () => void }) { return <View style={styles.state}><Text style={styles.stateTitle}>{title}</Text><Text style={styles.stateCopy}>{detail}</Text>{onRetry && <Pressable onPress={onRetry} style={styles.retry}><Text style={styles.retryText}>Tải lại</Text></Pressable>}</View>; }
function LoadingState() { return <View style={styles.state}><ActivityIndicator color={colors.primary} /><Text style={styles.stateCopy}>Đang tải dữ liệu...</Text></View>; }
function PermissionState({ title, detail }: { title: string; detail: string }) { return <View style={styles.state}><UsersRound size={28} color={colors.primary} /><Text style={styles.stateTitle}>{title}</Text><Text style={styles.stateCopy}>{detail}</Text></View>; }

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingTop: 10, paddingBottom: 28 },
  moduleNavigationScroll: { flexGrow: 0, flexShrink: 0, height: 42, marginTop: 4 },
  moduleNavigation: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16 },
  tab: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 7 },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  tabTextActive: { color: colors.white },
  toolbar: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  searchBox: { flex: 1, minHeight: 43, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 13, backgroundColor: colors.white },
  searchInput: { flex: 1, minWidth: 0, color: colors.ink, fontSize: 11, paddingVertical: 8 },
  addButton: { minHeight: 43, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 12, borderRadius: 13, backgroundColor: colors.primary },
  addText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  list: { gap: 10, marginTop: 10 },
  card: { padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.white },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  identity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#EAF2FF' },
  identityCopy: { flex: 1, minWidth: 0 },
  partnerName: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  partnerMeta: { color: colors.muted, fontSize: 10, marginTop: 2 },
  badge: { overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, fontSize: 9, fontWeight: '800' },
  activeBadge: { color: '#16885A', backgroundColor: '#E8F7EF' },
  inactiveBadge: { color: '#667085', backgroundColor: '#F0F2F5' },
  draftBadge: { color: '#9A6700', backgroundColor: '#FFF4D6' },
  summaryRow: { flexDirection: 'row', gap: 7, marginTop: 11 },
  summary: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 11, backgroundColor: '#F7F9FC' },
  summaryValue: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  summaryLabel: { color: colors.muted, fontSize: 8, marginTop: 2, textAlign: 'center' },
  policySummary: { gap: 5, marginTop: 10, padding: 10, borderRadius: 11, backgroundColor: '#F8F6FC' },
  policyLabel: { color: colors.muted, fontSize: 10 },
  policyValue: { color: colors.ink, fontWeight: '700' },
  policyKinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  schemePill: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10, backgroundColor: '#F0F2F5', color: colors.muted, fontSize: 9, fontWeight: '700' },
  schemeEnabled: { color: '#126B54', backgroundColor: '#E4F5ED' },
  schemeSeasonal: { color: '#7542C8', backgroundColor: '#F1EBFF' },
  policyIcon: { backgroundColor: '#F1EBFF' },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: '#F0F2F6' },
  iconButton: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#FFF1F0' },
  deleteText: { color: '#B42318', fontSize: 10, fontWeight: '700' },
  editButton: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, borderRadius: 10, backgroundColor: '#EEF4FF' },
  editText: { color: colors.primary, fontSize: 10, fontWeight: '700' },
  sectionIntro: { marginBottom: 10 },
  sectionTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  sectionCopy: { marginTop: 4, color: colors.muted, fontSize: 10, lineHeight: 15 },
  policyCreate: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'flex-start', marginBottom: 8, paddingHorizontal: 13, borderRadius: 12, backgroundColor: colors.primary },
  policyAction: { minHeight: 34, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 11, borderRadius: 10, backgroundColor: '#E8F7EF' },
  activateText: { color: '#16885A', fontSize: 10, fontWeight: '700' },
  retireAction: { backgroundColor: '#FFF4E5' },
  retireText: { color: '#9A6700', fontSize: 10, fontWeight: '700' },
  tierForm: { marginBottom: 10, padding: 11, borderRadius: 12, backgroundColor: '#F7F9FC', borderWidth: 1, borderColor: colors.border },
  tierLabel: { marginBottom: 7, color: colors.ink, fontSize: 10, fontWeight: '800' },
  addTier: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 10, borderWidth: 1, borderColor: '#C9D9FF', borderRadius: 11, backgroundColor: '#F5F8FF' },
  addTierText: { color: colors.primary, fontSize: 10, fontWeight: '700' },
  state: { minHeight: 190, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 26, gap: 8 },
  stateTitle: { color: colors.ink, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  stateCopy: { color: colors.muted, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  retry: { marginTop: 4, paddingHorizontal: 15, paddingVertical: 9, borderRadius: 11, backgroundColor: '#EAF2FF' },
  retryText: { color: colors.primary, fontSize: 11, fontWeight: '800' },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: 'rgba(15,23,42,0.45)' },
  modalCard: { maxHeight: '88%', backgroundColor: colors.background, borderRadius: 24, overflow: 'hidden' },
  modalHeader: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.white },
  modalTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  modalSubtitle: { color: colors.muted, fontSize: 10, marginTop: 3 },
  closeButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#EEF1F6' },
  formScroll: { flexGrow: 0 },
  form: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 18 },
  field: { marginBottom: 11 },
  fieldLabel: { marginBottom: 5, color: colors.ink, fontSize: 10, fontWeight: '700' },
  input: { minHeight: 42, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 11, backgroundColor: colors.white, color: colors.ink, fontSize: 11 },
  multiline: { minHeight: 62, paddingTop: 9 },
  sectionLabel: { marginTop: 4, marginBottom: 8, color: colors.ink, fontSize: 11, fontWeight: '800' },
  policyPicker: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 11, backgroundColor: colors.white },
  policyPickerValue: { flex: 1, color: colors.ink, fontSize: 11, fontWeight: '600' },
  placeholder: { color: colors.muted },
  pickerAction: { color: colors.primary, fontSize: 10, fontWeight: '700' },
  fieldHint: { marginBottom: 11, color: colors.muted, fontSize: 9, lineHeight: 13 },
  statusOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 },
  statusOption: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  statusOptionSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  statusOptionText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  statusOptionTextSelected: { color: colors.white },
  modalActions: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 15, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.white },
  cancelButton: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#EEF1F6' },
  cancelText: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  saveButton: { flex: 1.4, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.primary },
  saveText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  disabled: { opacity: 0.6 },
  pickerBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18, backgroundColor: 'rgba(15,23,42,0.45)' },
  pickerCard: { width: '100%', maxWidth: 420, maxHeight: '78%', padding: 16, borderRadius: 24, overflow: 'hidden', backgroundColor: colors.white },
  pickerTitle: { color: colors.ink, fontSize: 15, fontWeight: '800', marginBottom: 8 },
  pickerList: { maxHeight: 400 },
  pickerOption: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F2F5' },
  pickerOptionName: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  pickerOptionDetail: { color: colors.muted, fontSize: 9, marginTop: 3 },
  emptyPicker: { padding: 16, color: colors.muted, fontSize: 11, textAlign: 'center' },
});
