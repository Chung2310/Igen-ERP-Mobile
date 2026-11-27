import { PopupError } from '@/components/PopupError';
import { FullScreenFormModal } from '@/components/FullScreenFormModal';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Eye, HandCoins, Landmark, Mail, Pencil, Phone, Plus, Search, Trash2, UsersRound, Wallet, X } from 'lucide-react-native';
import { useAuth } from '@/core/auth/AuthProvider';
import type { FeatureScreenProps } from '@/features/modules/featureScreenRegistry';
import { colors } from '@/theme/colors';
import { StudentPartnerDataTransfer } from '@/features/StudentPartnerDataTransfer';
import { getStudentPartner, listStudentCommissionLevels, listStudentPartners, payStudentPartner, removeStudentCommissionLevel, removeStudentPartner, saveStudentCommissionLevel, saveStudentPartner, type StudentCommissionLevel, type StudentPartner, type StudentPartnerInput } from '@/features/studentPartnersApi';

type PartnerForm = StudentPartnerInput;
const emptyForm = (): PartnerForm => ({ name: '', phone: '', email: '', bankName: '', bankAccountNo: '', bankAccountName: '', isActive: true, notes: '' });
const has = (values: string[] | undefined, key: string) => Boolean(values?.includes('*') || values?.includes(key));
const money = (value = 0) => {
  const safe = Number.isFinite(Number(value)) ? Math.round(Number(value)) : 0;
  const sign = safe < 0 ? '-' : '';
  const digits = Math.abs(safe).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${digits} VND`;
};
const formatVndInput = (raw: string | number) => {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};
const paymentDate = (value: string) => value.split('-').reverse().join('/');
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

export function StudentPartnersScreen(_props: FeatureScreenProps) {
  const { user, activeBranchId } = useAuth();
  const branchId = activeBranchId || user?.branchId;
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const canManage = isAdmin || has(user?.permissions, 'relationship:manage');
  const canRead = canManage || has(user?.permissions, 'relationship:read');
  const canManageLevels = canManage && Boolean(branchId);
  const [partners, setPartners] = useState<StudentPartner[]>([]);
  const [levels, setLevels] = useState<StudentCommissionLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [levelError, setLevelError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StudentPartner | null>(null);
  const [form, setForm] = useState<PartnerForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<StudentPartner | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [payoutPartner, setPayoutPartner] = useState<StudentPartner | null>(null);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMethod, setPayoutMethod] = useState<'Tiền mặt' | 'Chuyển khoản'>('Chuyển khoản');
  const [payoutNote, setPayoutNote] = useState('');
  const [payoutSaving, setPayoutSaving] = useState(false);
  const [area, setArea] = useState<'partners' | 'levels'>('partners');
  const [levelFormOpen, setLevelFormOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<StudentCommissionLevel | null>(null);
  const [levelForm, setLevelForm] = useState({ name: '', minTuition: '', commissionRate: '' });
  const [levelSaving, setLevelSaving] = useState(false);

  const load = useCallback(async (showLoading = true) => {
    if (!canRead) { setLoading(false); setRefreshing(false); return; }
    if (showLoading) setLoading(true);
    try {
      const [partnerResult, levelResult] = await Promise.allSettled([listStudentPartners(branchId), listStudentCommissionLevels(branchId)]);
      if (partnerResult.status === 'fulfilled') { setPartners(partnerResult.value); setError(''); }
      else setError(partnerResult.reason instanceof Error ? partnerResult.reason.message : 'Không tải được danh sách đối tác học viên từ IGen-ERP.');
      if (levelResult.status === 'fulfilled') { setLevels(levelResult.value); setLevelError(''); }
      else setLevelError(levelResult.reason instanceof Error ? levelResult.reason.message : 'Không tải được cấp hoa hồng học viên từ IGen-ERP.');
    } finally { setLoading(false); setRefreshing(false); }
  }, [branchId, canRead]);
  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('vi');
    return partners.filter((partner) => {
      const matchesSearch = !query || `${partner.name} ${partner.phone} ${partner.email || ''}`.toLocaleLowerCase('vi').includes(query);
      return matchesSearch && (statusFilter === 'all' || (statusFilter === 'active' ? partner.isActive : !partner.isActive));
    });
  }, [partners, search, statusFilter]);

  function openCreate() { setEditing(null); setForm(emptyForm()); setFormOpen(true); }
  function openCreateLevel() { setEditingLevel(null); setLevelForm({ name: '', minTuition: '', commissionRate: '' }); setLevelFormOpen(true); }
  function openEditLevel(level: StudentCommissionLevel) { setEditingLevel(level); setLevelForm({ name: level.name, minTuition: formatVndInput(level.minTuition), commissionRate: String(level.commissionRate) }); setLevelFormOpen(true); }
  function openEdit(partner: StudentPartner) {
    setEditing(partner);
    setForm({ name: partner.name || '', phone: partner.phone || '', email: partner.email || '', bankName: partner.bankName || '', bankAccountNo: partner.bankAccountNo || '', bankAccountName: partner.bankAccountName || '', isActive: partner.isActive !== false, notes: partner.notes || '' });
    setFormOpen(true);
  }

  async function save() {
    const input = { ...form, name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim().toLocaleLowerCase('vi'), bankName: form.bankName.trim(), bankAccountNo: form.bankAccountNo.trim(), bankAccountName: form.bankAccountName.trim(), notes: form.notes.trim() };
    if (!input.name || !input.phone) { Alert.alert('Thiếu thông tin', 'Tên và số điện thoại đối tác là bắt buộc.'); return; }
    if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) { Alert.alert('Email chưa hợp lệ', 'Kiểm tra lại địa chỉ email của đối tác.'); return; }
    setSaving(true);
    try { await saveStudentPartner(input, editing?._id, branchId); setFormOpen(false); await load(false); }
    catch (cause) { Alert.alert('Không lưu được đối tác', cause instanceof Error ? cause.message : 'IGen-ERP từ chối yêu cầu.'); }
    finally { setSaving(false); }
  }

  async function saveLevel() {
    const name = levelForm.name.trim();
    const minTuition = Number(levelForm.minTuition.replace(/\D/g, ''));
    const commissionRate = Number(levelForm.commissionRate.replace(',', '.'));
    if (!name || !Number.isFinite(minTuition) || minTuition < 0 || !Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 100) {
      Alert.alert('Thông tin cấp hoa hồng chưa hợp lệ', 'Nhập tên, doanh số học phí tối thiểu không âm và tỷ lệ từ 0% đến 100%.');
      return;
    }
    setLevelSaving(true);
    try { await saveStudentCommissionLevel({ name, minTuition, commissionRate }, editingLevel?._id, branchId); setLevelFormOpen(false); await load(false); }
    catch (cause) { Alert.alert('Không lưu được cấp hoa hồng', cause instanceof Error ? cause.message : 'IGen-ERP từ chối yêu cầu.'); }
    finally { setLevelSaving(false); }
  }

  function confirmRemoveLevel(level: StudentCommissionLevel) {
    Alert.alert('Xóa cấp hoa hồng?', `Xóa cấp “${level.name}”?`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: () => { void removeStudentCommissionLevel(level._id, branchId).then(() => load(false)).catch((cause) => Alert.alert('Không xóa được', cause instanceof Error ? cause.message : 'IGen-ERP từ chối yêu cầu.')); } },
    ]);
  }

  function confirmRemove(partner: StudentPartner) {
    Alert.alert('Xóa đối tác học viên?', `Xóa ${partner.name} khỏi danh sách đối tác?`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: () => { void removeStudentPartner(partner._id, branchId).then(() => load(false)).catch((cause) => Alert.alert('Không xóa được', cause instanceof Error ? cause.message : 'IGen-ERP từ chối yêu cầu.')); } },
    ]);
  }

  async function openDetail(partner: StudentPartner) {
    setDetailLoading(true);
    setDetail(partner);
    try { setDetail(await getStudentPartner(partner._id, branchId)); }
    catch (cause) { Alert.alert('Không tải được hồ sơ', cause instanceof Error ? cause.message : 'Không tải được chi tiết đối tác.'); setDetail(null); }
    finally { setDetailLoading(false); }
  }

  function openPayout(partner: StudentPartner) {
    setPayoutPartner(partner);
    setPayoutAmount(formatVndInput(Math.max(0, Math.floor(partner.unpaidBalance || 0))));
    setPayoutMethod('Chuyển khoản');
    setPayoutNote(`CHI TRA HOA HONG ${partner.name}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase());
  }

  async function savePayout() {
    if (!payoutPartner || payoutSaving) return;
    const amount = Number(payoutAmount.replace(/\D/g, ''));
    if (!Number.isSafeInteger(amount) || amount <= 0) { Alert.alert('Số tiền chưa hợp lệ', 'Số tiền chi trả phải là số nguyên lớn hơn 0.'); return; }
    if (amount > payoutPartner.unpaidBalance) { Alert.alert('Vượt số dư hoa hồng', `Chỉ có thể chi tối đa ${money(payoutPartner.unpaidBalance)}.`); return; }
    setPayoutSaving(true);
    try {
      await payStudentPartner(payoutPartner._id, { amount, date: paymentDate(today()), method: payoutMethod, note: payoutNote.trim() }, branchId);
      setPayoutPartner(null);
      await load(false);
      Alert.alert('Đã ghi nhận chi trả', `Đã ghi nhận ${money(amount)} cho ${payoutPartner.name}.`);
    } catch (cause) { Alert.alert('Không ghi nhận được chi trả', cause instanceof Error ? cause.message : 'IGen-ERP từ chối yêu cầu.'); }
    finally { setPayoutSaving(false); }
  }

  if (!canRead) return <State title="Chưa có quyền xem đối tác học viên" detail="Cần quyền relationship:read." icon={<UsersRound size={28} color={colors.primary} />} />;

  return <View style={styles.container}>
    <ScrollView horizontal style={styles.moduleNavigationScroll} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moduleNavigation}>
      {([{ key: 'partners', label: 'Đối tác', icon: UsersRound }, { key: 'levels', label: 'Cấp hoa hồng', icon: Landmark }] as const).map((item) => {
        const Icon = item.icon;
        const selected = area === item.key;
        return (
          <Pressable key={item.key} onPress={() => setArea(item.key)} style={[styles.moduleNavItem, selected && styles.moduleNavItemActive]}>
            <Icon size={15} color={selected ? colors.white : colors.muted} />
            <Text style={[styles.moduleNavText, selected && styles.moduleNavTextActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(false); }} tintColor={colors.primary} />} showsVerticalScrollIndicator={false}>
      {area === 'partners' ? <>
        <View style={styles.detailStats}><DetailMetric label="Đối tác" value={String(partners.length)} /><DetailMetric label="Học viên giới thiệu" value={String(partners.reduce((sum, partner) => sum + (partner.referredStudentsCount || 0), 0))} /><DetailMetric label="Tổng hoa hồng" value={money(partners.reduce((sum, partner) => sum + (partner.totalCommission || 0), 0))} /><DetailMetric label="Còn phải trả" value={money(partners.reduce((sum, partner) => sum + (partner.unpaidBalance || 0), 0))} /></View>
        <View style={styles.toolbar}><View style={styles.searchBox}><Search size={15} color={colors.muted} /><TextInput value={search} onChangeText={setSearch} placeholder="Tìm tên, điện thoại hoặc email" placeholderTextColor={colors.muted} style={styles.searchInput} />{search ? <Pressable onPress={() => setSearch('')}><X size={15} color={colors.muted} /></Pressable> : null}</View>{canManage && <Pressable accessibilityRole="button" onPress={openCreate} style={styles.addButton}><Plus size={15} color={colors.white} /><Text style={styles.addText}>Thêm đối tác</Text></Pressable>}</View>
        {canManage && <StudentPartnerDataTransfer partners={visible} centerId={user?.role === 'superadmin' ? user.companyCode : undefined} branchId={branchId} onImported={() => { void load(false); }} />}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{([{ value: 'all', label: 'Tất cả' }, { value: 'active', label: 'Đang hoạt động' }, { value: 'inactive', label: 'Ngừng hoạt động' }] as const).map((item) => <Pressable key={item.value} onPress={() => setStatusFilter(item.value)} style={[styles.filter, statusFilter === item.value && styles.filterSelected]}><Text style={[styles.filterText, statusFilter === item.value && styles.filterTextSelected]}>{item.label}</Text></Pressable>)}</ScrollView>
        {error ? <PopupError error={error} onRetry={() => void load()} /> : loading ? <State title="Đang tải đối tác học viên" detail="Đang kết nối với IGen-ERP…" loading /> : visible.length === 0 ? <State title={search ? 'Không tìm thấy đối tác' : 'Chưa có đối tác học viên'} detail={search ? 'Thử tên hoặc số điện thoại khác.' : 'Thêm đối tác để theo dõi học viên được giới thiệu và hoa hồng.'} /> : <View style={styles.list}>{visible.map((partner) => <StudentPartnerCard key={partner._id} partner={partner} canManage={canManage} onEdit={() => openEdit(partner)} onDelete={() => confirmRemove(partner)} onDetail={() => void openDetail(partner)} onPayout={() => openPayout(partner)} />)}</View>}
      </> : <>
        {canManage && !branchId ? <Text style={styles.branchHint}>Cần tài khoản được gán chi nhánh để cấu hình cấp hoa hồng.</Text> : null}
        <View style={styles.levelToolbar}><Text style={styles.levelCount}>{levels.length} cấp đang cấu hình</Text>{canManageLevels && <Pressable onPress={openCreateLevel} style={styles.addButton}><Plus size={14} color={colors.white} /><Text style={styles.addText}>Thêm cấp</Text></Pressable>}</View>
        {levelError ? <PopupError error={levelError} onRetry={() => void load()} /> : loading ? <State title="Đang tải cấp hoa hồng" detail="Đang kết nối với IGen-ERP…" loading /> : levels.length === 0 ? <State title="Chưa có cấp hoa hồng riêng" detail="Hệ thống hiện áp dụng mức mặc định. Có thể thêm các ngưỡng doanh số riêng cho trung tâm." /> : <View style={styles.list}>{levels.map((level) => <View key={level._id} style={styles.levelCard}><View style={styles.levelIcon}><Landmark size={16} color={colors.primary} /></View><View style={styles.levelCopy}><Text style={styles.levelName}>{level.name}</Text><Text style={styles.levelMeta}>Từ {money(level.minTuition)} học phí</Text></View><Text style={styles.rate}>{level.commissionRate}%</Text>{canManageLevels && <View style={styles.levelActions}><Pressable onPress={() => openEditLevel(level)} style={styles.iconButton}><Pencil size={13} color={colors.ink} /></Pressable><Pressable onPress={() => confirmRemoveLevel(level)} style={styles.iconButton}><Trash2 size={13} color="#B42318" /></Pressable></View>}</View>)}</View>}
      </>}
    </ScrollView>

    <FullScreenFormModal
      visible={formOpen}
      title={editing ? 'Sửa đối tác học viên' : 'Thêm đối tác học viên'}
      onClose={() => { if (!saving) setFormOpen(false); }}
      footer={
        <View style={styles.modalActionsInline}>
          <Pressable onPress={() => setFormOpen(false)} disabled={saving} style={styles.cancelButton}><Text style={styles.cancelText}>Hủy</Text></Pressable>
          <Pressable onPress={() => void save()} disabled={saving} style={[styles.saveButton, saving && styles.disabled]}>{saving ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.saveText}>{editing ? 'Lưu thay đổi' : 'Tạo đối tác'}</Text>}</Pressable>
        </View>
      }
    >
      <View style={{ gap: 10 }}>
        <Text style={styles.modalSubtitle}>Hoa hồng áp dụng theo cấp doanh số học phí của trung tâm.</Text>
        <Field label="Tên đối tác *" value={form.name} onChangeText={(name) => setForm((current) => ({ ...current, name }))} />
        <Field label="Số điện thoại *" value={form.phone} onChangeText={(phone) => setForm((current) => ({ ...current, phone }))} keyboardType="phone-pad" />
        <Field label="Email" value={form.email} onChangeText={(email) => setForm((current) => ({ ...current, email }))} keyboardType="email-address" autoCapitalize="none" />
        <Text style={styles.sectionLabel}>Tài khoản nhận chi trả</Text>
        <Field label="Ngân hàng" value={form.bankName} onChangeText={(bankName) => setForm((current) => ({ ...current, bankName }))} />
        <Field label="Số tài khoản" value={form.bankAccountNo} onChangeText={(bankAccountNo) => setForm((current) => ({ ...current, bankAccountNo }))} keyboardType="number-pad" />
        <Field label="Tên chủ tài khoản" value={form.bankAccountName} onChangeText={(bankAccountName) => setForm((current) => ({ ...current, bankAccountName }))} />
        <Text style={styles.fieldLabel}>Trạng thái</Text><View style={styles.statusOptions}>{([{ value: true, label: 'Đang hoạt động' }, { value: false, label: 'Ngừng hoạt động' }] as const).map((status) => <Pressable key={String(status.value)} onPress={() => setForm((current) => ({ ...current, isActive: status.value }))} style={[styles.statusOption, form.isActive === status.value && styles.statusOptionSelected]}><Text style={[styles.statusText, form.isActive === status.value && styles.statusTextSelected]}>{status.label}</Text></Pressable>)}</View>
        <Field label="Ghi chú" value={form.notes} onChangeText={(notes) => setForm((current) => ({ ...current, notes }))} multiline />
      </View>
    </FullScreenFormModal>

    <FullScreenFormModal
      visible={levelFormOpen}
      title={editingLevel ? 'Sửa cấp hoa hồng' : 'Thêm cấp hoa hồng'}
      onClose={() => { if (!levelSaving) setLevelFormOpen(false); }}
      footer={
        <View style={styles.modalActionsInline}>
          <Pressable onPress={() => setLevelFormOpen(false)} disabled={levelSaving} style={styles.cancelButton}><Text style={styles.cancelText}>Hủy</Text></Pressable>
          <Pressable onPress={() => void saveLevel()} disabled={levelSaving} style={[styles.saveButton, levelSaving && styles.disabled]}>{levelSaving ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.saveText}>{editingLevel ? 'Lưu thay đổi' : 'Tạo cấp'}</Text>}</Pressable>
        </View>
      }
    >
      <View style={{ gap: 10 }}>
        <Text style={styles.modalSubtitle}>Tên, ngưỡng học phí và tỷ lệ hoa hồng.</Text>
        <Field label="Tên cấp *" value={levelForm.name} onChangeText={(name) => setLevelForm((current) => ({ ...current, name }))} />
        <Field label="Doanh số học phí tối thiểu (VND) *" value={levelForm.minTuition} onChangeText={(minTuition) => setLevelForm((current) => ({ ...current, minTuition: formatVndInput(minTuition) }))} keyboardType="number-pad" />
        <Field label="Tỷ lệ hoa hồng (%) *" value={levelForm.commissionRate} onChangeText={(commissionRate) => setLevelForm((current) => ({ ...current, commissionRate }))} keyboardType="decimal-pad" />
      </View>
    </FullScreenFormModal>

    <FullScreenFormModal
      visible={Boolean(detail)}
      title={detail?.name ? `Hồ sơ · ${detail.name}` : 'Hồ sơ đối tác'}
      onClose={() => setDetail(null)}
    >
      {detailLoading ? <State title="Đang tải hồ sơ" detail="Đang tải giới thiệu và lịch sử chi trả…" loading /> : detail ? <View style={{ gap: 10 }}>
        <View style={styles.detailStats}><DetailMetric label="Học viên giới thiệu" value={String(detail.referredStudentsCount || 0)} /><DetailMetric label="Tổng hoa hồng" value={money(detail.totalCommission)} /><DetailMetric label="Đã chi trả" value={money(detail.totalPaid)} /><DetailMetric label="Còn phải trả" value={money(detail.unpaidBalance)} /></View>
        <View style={styles.detailHeader}><Text style={styles.sectionTitle}>Học viên được giới thiệu</Text><Text style={styles.sectionHint}>{detail.levelName || 'Mặc định'} · {detail.commissionValue || 0}% hoa hồng</Text></View>
        {detail.referredStudents?.length ? detail.referredStudents.map((student) => <View key={student._id} style={styles.detailRow}><View style={styles.detailRowIcon}><UsersRound size={14} color={colors.primary} /></View><View style={styles.detailRowCopy}><Text style={styles.detailName}>{student.fullName}</Text><Text style={styles.detailMeta}>{student.phone || 'Chưa có điện thoại'}{student.status?.length ? ` · ${student.status[0]}` : ''}</Text></View><Text style={styles.detailAmount}>{money(student.commission || 0)}</Text></View>) : <Text style={styles.emptyDetail}>Chưa có học viên được ghi nhận.</Text>}
        <View style={[styles.detailHeader, styles.payoutHeader]}><Text style={styles.sectionTitle}>Lịch sử chi trả</Text>{canManage && detail.unpaidBalance > 0 ? <Pressable onPress={() => { setDetail(null); openPayout(detail); }} style={styles.smallAction}><Plus size={13} color={colors.white} /><Text style={styles.smallActionText}>Chi trả</Text></Pressable> : null}</View>
        {detail.payoutHistory?.length ? detail.payoutHistory.map((payout) => <View key={payout.id} style={styles.payoutRow}><Wallet size={14} color="#16885A" /><View style={styles.detailRowCopy}><Text style={styles.detailName}>{money(payout.amount)}</Text><Text style={styles.detailMeta}>{payout.date} · {payout.method}</Text></View><Text numberOfLines={1} style={styles.noteText}>{payout.note || ''}</Text></View>) : <Text style={styles.emptyDetail}>Chưa có lần chi trả nào.</Text>}
      </View> : null}
    </FullScreenFormModal>

    <FullScreenFormModal
      visible={Boolean(payoutPartner)}
      title="Chi trả hoa hồng"
      onClose={() => { if (!payoutSaving) setPayoutPartner(null); }}
      footer={
        <View style={styles.modalActionsInline}>
          <Pressable onPress={() => setPayoutPartner(null)} style={styles.cancelButton}><Text style={styles.cancelText}>Hủy</Text></Pressable>
          <Pressable onPress={() => void savePayout()} disabled={payoutSaving} style={[styles.saveButton, payoutSaving && styles.disabled]}>{payoutSaving ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.saveText}>Ghi nhận chi trả</Text>}</Pressable>
        </View>
      }
    >
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={styles.payoutIcon}><HandCoins size={18} color={colors.primary} /></View>
          <Text style={styles.payoutSubtitle}>{payoutPartner?.name}</Text>
        </View>
        <View style={styles.balanceBox}><Text style={styles.balanceLabel}>Số dư có thể chi</Text><Text style={styles.balanceValue}>{money(payoutPartner?.unpaidBalance || 0)}</Text></View>
        <Field label="Số tiền (VND)" value={payoutAmount} onChangeText={(v) => setPayoutAmount(formatVndInput(v))} keyboardType="number-pad" />
        <Text style={styles.fieldLabel}>Phương thức</Text><View style={styles.statusOptions}>{(['Chuyển khoản', 'Tiền mặt'] as const).map((method) => <Pressable key={method} onPress={() => setPayoutMethod(method)} style={[styles.statusOption, payoutMethod === method && styles.statusOptionSelected]}><Text style={[styles.statusText, payoutMethod === method && styles.statusTextSelected]}>{method}</Text></Pressable>)}</View>
        <Field label="Ghi chú" value={payoutNote} onChangeText={setPayoutNote} />
      </View>
    </FullScreenFormModal>
  </View>;
}

function StudentPartnerCard({ partner, canManage, onEdit, onDelete, onDetail, onPayout }: { partner: StudentPartner; canManage: boolean; onEdit: () => void; onDelete: () => void; onDetail: () => void; onPayout: () => void }) {
  return <View style={styles.card}>
    <View style={styles.cardHeader}><View style={styles.partnerIcon}><UsersRound size={17} color={colors.primary} /></View><View style={styles.partnerIdentity}><Text numberOfLines={1} style={styles.partnerName}>{partner.name}</Text><Text style={styles.partnerMeta}><Phone size={10} color={colors.muted} /> {partner.phone}</Text>{partner.email ? <Text style={styles.partnerMeta}><Mail size={10} color={colors.muted} /> {partner.email}</Text> : null}</View><Text style={[styles.badge, partner.isActive ? styles.activeBadge : styles.inactiveBadge]}>{partner.isActive ? 'Đang hoạt động' : 'Ngừng hoạt động'}</Text></View>
    <View style={styles.commissionPanel}><View style={styles.metricCell}><Text style={styles.metricValue}>{partner.referredStudentsCount || 0}</Text><Text style={styles.metricLabel}>Học viên</Text></View><View style={styles.metricCell}><Text style={styles.metricValue}>{partner.levelName || 'Mặc định'}</Text><Text style={styles.metricLabel}>Cấp hoa hồng · {partner.commissionValue || 0}%</Text></View><View style={styles.metricCell}><Text style={[styles.metricValue, partner.unpaidBalance > 0 && styles.balanceWarning]}>{money(partner.unpaidBalance)}</Text><Text style={styles.metricLabel}>Còn phải trả</Text></View></View>
    <View style={styles.cardActions}><Pressable onPress={onDetail} style={styles.secondaryButton}><Eye size={13} color={colors.primary} /><Text style={styles.secondaryText}>Chi tiết</Text></Pressable>{canManage && partner.unpaidBalance > 0 ? <Pressable onPress={onPayout} style={styles.payoutButton}><Wallet size={13} color="#16885A" /><Text style={styles.payoutButtonText}>Chi trả</Text></Pressable> : null}{canManage ? <><Pressable onPress={onEdit} style={styles.iconButton}><Pencil size={13} color={colors.ink} /></Pressable><Pressable onPress={onDelete} style={styles.iconButton}><Trash2 size={13} color="#B42318" /></Pressable></> : null}</View>
  </View>;
}

function DetailMetric({ label, value }: { label: string; value: string }) { return <View style={styles.detailMetric}><Text style={styles.detailMetricValue}>{value}</Text><Text style={styles.detailMetricLabel}>{label}</Text></View>; }
function Field({ label, value, onChangeText, multiline, ...props }: { label: string; value: string; onChangeText: (value: string) => void; multiline?: boolean } & Omit<ComponentProps<typeof TextInput>, 'value' | 'onChangeText' | 'multiline'>) { return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} placeholderTextColor={colors.muted} style={[styles.input, multiline && styles.multiline]} {...props} /></View>; }
function State({ title, detail, icon, loading, onRetry }: { title: string; detail: string; icon?: ReactNode; loading?: boolean; onRetry?: () => void }) { return <View style={styles.state}>{loading ? <ActivityIndicator size="small" color={colors.primary} /> : icon}{title ? <Text style={styles.stateTitle}>{title}</Text> : null}<Text style={styles.stateCopy}>{detail}</Text>{onRetry ? <Pressable onPress={onRetry} style={styles.retry}><Text style={styles.retryText}>Tải lại</Text></Pressable> : null}</View>; }

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  moduleNavigationScroll: { flexGrow: 0, flexShrink: 0, height: 42, marginTop: 4 },
  moduleNavigation: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16 },
  moduleNavItem: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 7 },
  moduleNavItemActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  moduleNavText: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  moduleNavTextActive: { color: colors.white },
  content: { padding: 16, paddingTop: 10, paddingBottom: 28 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  searchBox: { flex: 1, minHeight: 43, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 13, backgroundColor: colors.white },
  searchInput: { flex: 1, minWidth: 0, color: colors.ink, fontSize: 11, paddingVertical: 8 },
  addButton: { minHeight: 43, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 12, borderRadius: 13, backgroundColor: colors.primary },
  addText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  filters: { flexDirection: 'row', gap: 7, paddingVertical: 10 },
  filter: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  filterSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  filterTextSelected: { color: colors.white },
  list: { gap: 10 },
  card: { padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.white },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  partnerIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#EAF2FF' },
  partnerIdentity: { flex: 1, minWidth: 0, gap: 4 },
  partnerName: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  partnerMeta: { flexDirection: 'row', alignItems: 'center', color: colors.muted, fontSize: 10 },
  badge: { overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, fontSize: 9, fontWeight: '800' },
  activeBadge: { color: '#16885A', backgroundColor: '#E8F7EF' },
  inactiveBadge: { color: '#667085', backgroundColor: '#F0F2F5' },
  commissionPanel: { flexDirection: 'row', gap: 6, marginTop: 11, padding: 9, borderRadius: 11, backgroundColor: '#F7F9FC' },
  metricCell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  metricValue: { color: colors.ink, fontSize: 10, fontWeight: '800', textAlign: 'center' },
  metricLabel: { color: colors.muted, fontSize: 8, marginTop: 3, textAlign: 'center' },
  balanceWarning: { color: '#B54708' },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: '#F0F2F6' },
  secondaryButton: { minHeight: 33, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#EEF4FF' },
  secondaryText: { color: colors.primary, fontSize: 10, fontWeight: '700' },
  payoutButton: { minHeight: 33, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#E8F7EF' },
  payoutButtonText: { color: '#16885A', fontSize: 10, fontWeight: '700' },
  iconButton: { width: 33, height: 33, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#F0F3F8' },
  state: { minHeight: 200, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 26, gap: 8 },
  stateTitle: { color: colors.ink, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  stateCopy: { color: colors.muted, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  retry: { marginTop: 4, paddingHorizontal: 15, paddingVertical: 9, borderRadius: 11, backgroundColor: '#EAF2FF' },
  retryText: { color: colors.primary, fontSize: 11, fontWeight: '800' },
  levelIntro: { marginBottom: 10 },
  branchHint: { marginTop: 5, color: '#9A6700', fontSize: 9, fontWeight: '700' },
  levelToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  levelCount: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  levelCard: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.white },
  levelIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#EAF2FF' },
  levelCopy: { flex: 1 },
  levelName: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  levelMeta: { color: colors.muted, fontSize: 10, marginTop: 3 },
  rate: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  levelActions: { flexDirection: 'row', gap: 5 },
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
  statusOptions: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statusOption: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  statusOptionSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  statusText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  statusTextSelected: { color: colors.white },
  modalActions: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 15, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.white },
  cancelButton: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#EEF1F6' },
  cancelText: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  saveButton: { flex: 1.4, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.primary },
  saveText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  disabled: { opacity: 0.6 },
  detailContent: { padding: 16, paddingBottom: 24 },
  detailStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 10, borderRadius: 15, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  detailMetric: { width: '47%', padding: 8 },
  detailMetricValue: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  detailMetricLabel: { color: colors.muted, fontSize: 9, marginTop: 3 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7, marginTop: 16, marginBottom: 7 },
  sectionTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  sectionHint: { color: colors.muted, fontSize: 9 },
  detailRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EDF0F4' },
  detailRowIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#EAF2FF' },
  detailRowCopy: { flex: 1, minWidth: 0 },
  detailName: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  detailMeta: { color: colors.muted, fontSize: 9, marginTop: 3 },
  detailAmount: { color: colors.primary, fontSize: 10, fontWeight: '800' },
  emptyDetail: { paddingVertical: 14, color: colors.muted, fontSize: 10, textAlign: 'center' },
  payoutHeader: { marginTop: 18 },
  smallAction: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, borderRadius: 10, backgroundColor: colors.primary },
  smallActionText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  payoutRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#EDF0F4' },
  noteText: { maxWidth: 96, color: colors.muted, fontSize: 9 },
  payoutBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(15,23,42,0.45)' },
  payoutCard: { width: '100%', maxWidth: 430, padding: 18, borderRadius: 24, overflow: 'hidden', backgroundColor: colors.background },
  payoutTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  payoutIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#EAF2FF' },
  payoutTitle: { marginTop: 10, color: colors.ink, fontSize: 16, fontWeight: '800' },
  payoutSubtitle: { color: colors.muted, fontSize: 10, marginTop: 2 },
  balanceBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 12, padding: 12, borderWidth: 1, borderColor: '#D7E5FF', borderRadius: 12, backgroundColor: '#EFF5FF' },
  balanceLabel: { color: colors.ink, fontSize: 10, fontWeight: '700' },
  balanceValue: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  modalActionsInline: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
});
