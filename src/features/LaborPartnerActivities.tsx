import { withAppLockSuspended } from '@/core/auth/appLockSuspension';
import { PopupError } from '@/components/PopupError';
import { IgenWorkerEmptyState } from '@/components/EmptyStateIllustration';
import { FullScreenFormModal } from '@/components/FullScreenFormModal';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { CalendarDays, ChevronDown, UsersRound, X } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { DateTimeField } from '@/features/quotation/DateTimeField';
import {
  calculateLaborSettlement, createLaborAdjustment, createLaborPayout, createLaborReferral, exportLaborCommissionReport, getLaborPartnerOverview,
  getLaborSettlement, laborSettlementAction, listLaborKpi, listLaborReferrals, listLaborSettlements,
  listLaborWorkers, reverseLaborPayout, saveLaborKpi, updateLaborReferralStatus,
  type LaborCommissionPolicy, type LaborKpiRow, type LaborPartner, type LaborReferral, type LaborSettlement,
  type LaborSettlementDetail, type LaborWorker,
} from '@/features/laborPartnersApi';
import { saveAndShareExport } from '@/features/quotation/fileExport';

type Scope = { companyCode: string; branchId?: string };
type ActivityTab = 'referrals' | 'kpi' | 'settlements';
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
const monthStart = () => `${today().slice(0, 7)}-01`;
const cash = (amount = 0) => {
  const safe = Number.isFinite(Number(amount)) ? Math.round(Number(amount)) : 0;
  const sign = safe < 0 ? '-' : '';
  const digits = Math.abs(safe).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${digits} VND`;
};
const formatVndInput = (raw: string | number, allowNegative = false) => {
  const text = String(raw ?? '');
  const negative = allowNegative && text.trim().startsWith('-');
  const digits = text.replace(/\D/g, '');
  if (!digits) return negative ? '-' : '';
  return `${negative ? '-' : ''}${digits.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
};
const asId = (value: string | { _id: string } | null | undefined) => typeof value === 'string' ? value : value?._id || '';
const asName = (value: LaborReferral['workerId']) => typeof value === 'string' ? value : value?.fullName || 'Lao động';

export function LaborPartnerActivities({ scope, partners, policies, initialTab, canManage, canManageSettlements, canPayout }: {
  scope: Scope; partners: LaborPartner[]; policies: LaborCommissionPolicy[]; initialTab: ActivityTab;
  canManage: boolean; canManageSettlements: boolean; canPayout: boolean;
}) {
  const [tab, setTab] = useState<ActivityTab>(initialTab);
  useEffect(() => setTab(initialTab), [initialTab]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const [partnerId, setPartnerId] = useState(partners[0]?._id || ''); const [referrals, setReferrals] = useState<LaborReferral[]>([]);
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof getLaborPartnerOverview>> | null>(null);
  const [workers, setWorkers] = useState<LaborWorker[]>([]); const [workerPicker, setWorkerPicker] = useState(false);
  const [referralFormOpen, setReferralFormOpen] = useState(false);
  const [referralForm, setReferralForm] = useState({ workerId: '', policyId: '', commissionScheme: 'official_monthly' as 'official_monthly' | 'seasonal_hourly', referredAt: today(), employmentStartDate: today(), effectiveFrom: today(), note: '' });
  const [month, setMonth] = useState(monthStart()); const [kpi, setKpi] = useState<LaborKpiRow[]>([]); const [kpiDrafts, setKpiDrafts] = useState<Record<string, string>>({});
  const [settlements, setSettlements] = useState<LaborSettlement[]>([]); const [periodAnchor, setPeriodAnchor] = useState(today());
  const [settlementPartnerId, setSettlementPartnerId] = useState(''); const [settlementStatusFilter, setSettlementStatusFilter] = useState<LaborSettlement['status'] | 'all'>('all');
  const [settlementSchemeFilter, setSettlementSchemeFilter] = useState<'official_monthly' | 'seasonal_hourly' | 'all'>('all'); const [periodStartFilter, setPeriodStartFilter] = useState(''); const [periodEndFilter, setPeriodEndFilter] = useState('');
  const [entryValues, setEntryValues] = useState<Record<string, string>>({}); const [detail, setDetail] = useState<LaborSettlementDetail | null>(null);
  const [payoutOpen, setPayoutOpen] = useState(false); const [payoutAmount, setPayoutAmount] = useState(''); const [payoutMethod, setPayoutMethod] = useState<'cash' | 'bank_transfer'>('bank_transfer'); const [payoutReference, setPayoutReference] = useState('');
  const [adjustmentOpen, setAdjustmentOpen] = useState(false); const [adjustmentAmount, setAdjustmentAmount] = useState(''); const [adjustmentReason, setAdjustmentReason] = useState('');

  const currentPartner = partners.find((item) => item._id === partnerId);
  const activePolicies = useMemo(() => policies.filter((item) => item.status === 'active' && (item.official.enabled || item.seasonal.enabled)), [policies]);
  useEffect(() => { if (!partnerId && partners[0]) setPartnerId(partners[0]._id); }, [partnerId, partners]);
  const partnerReferrals = useCallback(async (id = partnerId) => {
    if (!id) { setReferrals([]); return; }
    try {
      const [items, summary] = await Promise.all([listLaborReferrals(scope, id), getLaborPartnerOverview(scope, id)]);
      setReferrals(items); setOverview(summary);
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được nguồn giới thiệu.'); }
  }, [partnerId, scope]);
  const loadWorkers = useCallback(async () => {
    try { setWorkers(await listLaborWorkers(scope)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được danh sách lao động.'); }
  }, [scope]);
  const loadKpi = useCallback(async () => {
    setBusy(true); setError('');
    try { const rows = await listLaborKpi(scope, `${month.slice(0, 7)}-01`); setKpi(rows); setKpiDrafts(Object.fromEntries(rows.map((row) => [row.partnerId, String(row.targetReferrals)]))); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được KPI.'); }
    finally { setBusy(false); }
  }, [scope, month]);
  const loadSettlements = useCallback(async () => {
    setBusy(true); setError('');
    try { setSettlements(await listLaborSettlements(scope, { partnerId: settlementPartnerId || undefined, status: settlementStatusFilter === 'all' ? undefined : settlementStatusFilter, scheme: settlementSchemeFilter === 'all' ? undefined : settlementSchemeFilter, periodStart: /^\d{4}-\d{2}-\d{2}$/.test(periodStartFilter) ? periodStartFilter : undefined, periodEnd: /^\d{4}-\d{2}-\d{2}$/.test(periodEndFilter) ? periodEndFilter : undefined })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được kỳ đối soát.'); }
    finally { setBusy(false); }
  }, [periodEndFilter, periodStartFilter, scope, settlementPartnerId, settlementSchemeFilter, settlementStatusFilter]);
  useEffect(() => {
    if (tab === 'referrals') { void partnerReferrals(); void loadWorkers(); }
    if (tab === 'kpi') void loadKpi();
    if (tab === 'settlements') { void loadSettlements(); void partnerReferrals(); void loadWorkers(); }
  }, [tab, partnerId, loadKpi, loadSettlements, loadWorkers, partnerReferrals]);

  function changePartner(id: string) { setPartnerId(id); setError(''); setMessage(''); setDetail(null); }
  function createReferral() {
    if (!partnerId) return;
    setReferralForm({ workerId: '', policyId: activePolicies[0]?._id || '', commissionScheme: 'official_monthly', referredAt: today(), employmentStartDate: today(), effectiveFrom: today(), note: '' });
    setReferralFormOpen(true);
  }
  async function saveReferral() {
    if (!partnerId || !referralForm.workerId || !referralForm.policyId) { setError('Chọn lao động và chính sách hoa hồng.'); return; }
    setBusy(true); setError('');
    try { await createLaborReferral(scope, partnerId, { ...referralForm, note: referralForm.note.trim(), confirmationSource: 'manual' }); setReferralFormOpen(false); setMessage('Đã tạo nguồn giới thiệu ở trạng thái chờ xác nhận.'); await partnerReferrals(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tạo được nguồn giới thiệu.'); }
    finally { setBusy(false); }
  }
  async function mutateReferral(referral: LaborReferral, action: 'confirm' | 'end') {
    if (!partnerId) return;
    const run = async () => { setBusy(true); setError(''); try { await updateLaborReferralStatus(scope, partnerId, referral._id, action, action === 'end' ? today() : undefined); await partnerReferrals(); setMessage(action === 'confirm' ? 'Đã xác nhận nguồn giới thiệu.' : 'Đã kết thúc nguồn giới thiệu.'); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không cập nhật được nguồn giới thiệu.'); } finally { setBusy(false); } };
    if (action === 'confirm') Alert.alert('Xác nhận nguồn giới thiệu?', `Xác nhận ${asName(referral.workerId)}?`, [{ text: 'Hủy', style: 'cancel' }, { text: 'Xác nhận', onPress: () => void run() }]);
    else Alert.alert('Kết thúc nguồn giới thiệu?', `Kết thúc hiệu lực từ ${today()}?`, [{ text: 'Hủy', style: 'cancel' }, { text: 'Kết thúc', style: 'destructive', onPress: () => void run() }]);
  }
  async function saveTarget(row: LaborKpiRow) {
    const target = Number(kpiDrafts[row.partnerId] || 0);
    if (!Number.isInteger(target) || target < 0) { setError('Chỉ tiêu KPI phải là số nguyên không âm.'); return; }
    setBusy(true); setError('');
    try { await saveLaborKpi(scope, row.partnerId, `${month.slice(0, 7)}-01`, target); setMessage(`Đã lưu chỉ tiêu cho ${row.partner.name}.`); await loadKpi(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không lưu được KPI.'); }
    finally { setBusy(false); }
  }
  async function openSettlement(id: string) {
    setBusy(true); setError('');
    try { const value = await getLaborSettlement(scope, id); setDetail(value); setPayoutAmount(formatVndInput(value.balanceAmount)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được chi tiết kỳ đối soát.'); }
    finally { setBusy(false); }
  }
  async function calculate() {
    const selectedPartnerId = settlementPartnerId;
    if (!selectedPartnerId) { setError('Chọn một đối tác cụ thể trước khi tính kỳ đối soát.'); return; }
    setBusy(true); setError('');
    try {
      const freshReferrals = await listLaborReferrals(scope, selectedPartnerId);
      setReferrals(freshReferrals);
      const active = freshReferrals.filter((item) => item.status === 'active');
      if (!active.length) { setError('Đối tác cần có nguồn giới thiệu đang hiệu lực trước khi tính kỳ.'); return; }
      const invalidEntry = active.some((item) => {
        const value = Number(entryValues[item._id] || 0);
        return !Number.isFinite(value) || value < 0 || (item.commissionScheme === 'official_monthly' && (!Number.isInteger(value) || value > 3));
      });
      if (invalidEntry) { setError('Tháng chính thức phải là số nguyên từ 0 đến 3; giờ thời vụ phải là số không âm.'); return; }
      const manualEntries = active.map((item) => item.commissionScheme === 'official_monthly'
        ? { referralId: item._id, officialMonths: Number(entryValues[item._id] || 0) }
        : { referralId: item._id, seasonalHours: Number(entryValues[item._id] || 0) });
      const result = await calculateLaborSettlement(scope, { partnerId: selectedPartnerId, periodAnchor, manualEntries });
      const settlement = result.settlement || result;
      setMessage(result.reused ? 'Kỳ đã tồn tại, mở lại dữ liệu hiện có.' : 'Đã tính kỳ đối soát.');
      await loadSettlements();
      if (settlement._id) await openSettlement(settlement._id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tính được kỳ đối soát.'); }
    finally { setBusy(false); }
  }
  async function runSettlementAction(action: 'recalculate' | 'approve' | 'void') {
    if (!detail) return;
    const run = async () => { setBusy(true); setError(''); try { await laborSettlementAction(scope, detail._id, action, detail.version); await openSettlement(detail._id); await loadSettlements(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không cập nhật được kỳ đối soát.'); } finally { setBusy(false); } };
    if (action === 'void') Alert.alert('Hủy kỳ đối soát?', 'Thao tác này được ghi nhận trên hệ thống.', [{ text: 'Để sau', style: 'cancel' }, { text: 'Hủy kỳ', style: 'destructive', onPress: () => void run() }]);
    else if (action === 'recalculate') Alert.alert('Tính lại kỳ?', 'Các dòng nháp sẽ được thay thế theo dữ liệu nguồn hiện tại.', [{ text: 'Để sau', style: 'cancel' }, { text: 'Tính lại', onPress: () => void run() }]);
    else await run();
  }
  async function savePayout() {
    if (!detail) return;
    const amount = Number(payoutAmount.replace(/\D/g, ''));
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > detail.balanceAmount) { setError(`Số tiền phải lớn hơn 0 và không vượt ${cash(detail.balanceAmount)}.`); return; }
    setBusy(true); setError('');
    try { await createLaborPayout(scope, detail._id, { amount, method: payoutMethod, reference: payoutReference.trim(), idempotencyKey: `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}` }); setPayoutOpen(false); await openSettlement(detail._id); await loadSettlements(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không ghi nhận được chi trả.'); }
    finally { setBusy(false); }
  }
  async function saveAdjustment() {
    if (!detail) return;
    const amount = Number(adjustmentAmount.replace(/[^\d-]/g, ''));
    if (!Number.isSafeInteger(amount) || amount === 0 || !adjustmentReason.trim()) { setError('Nhập số tiền điều chỉnh khác 0 và lý do.'); return; }
    setBusy(true); setError('');
    try { await createLaborAdjustment(scope, detail._id, { amount, reason: adjustmentReason.trim(), periodAnchor: today(), idempotencyKey: `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}` }); setAdjustmentOpen(false); setAdjustmentAmount(''); setAdjustmentReason(''); await loadSettlements(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tạo được điều chỉnh.'); }
    finally { setBusy(false); }
  }
  async function reversePayout(payoutId: string) {
    Alert.alert('Hoàn tác chi trả?', 'Giao dịch đảo sẽ được ghi nhận vào sổ đối soát.', [{ text: 'Hủy', style: 'cancel' }, { text: 'Hoàn tác', style: 'destructive', onPress: async () => { setBusy(true); try { await reverseLaborPayout(scope, payoutId); if (detail) await openSettlement(detail._id); await loadSettlements(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không hoàn tác được chi trả.'); } finally { setBusy(false); } } }]);
  }
  async function exportReport() {
    setBusy(true); setError('');
    try { const file = await exportLaborCommissionReport(scope, { partnerId: settlementPartnerId || undefined, status: settlementStatusFilter === 'all' ? undefined : settlementStatusFilter, scheme: settlementSchemeFilter === 'all' ? undefined : settlementSchemeFilter, periodStart: /^\d{4}-\d{2}-\d{2}$/.test(periodStartFilter) ? periodStartFilter : undefined, periodEnd: /^\d{4}-\d{2}-\d{2}$/.test(periodEndFilter) ? periodEndFilter : undefined }); await saveAndShareExport(file, 'bao-cao-hoa-hong-doi-tac-lao-dong.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không xuất được báo cáo hoa hồng.'); }
    finally { setBusy(false); }
  }
  async function downloadSettlementTemplate() {
    const active = referrals.filter((item) => item.status === 'active');
    const rows = [['Mã lao động', 'Họ tên tham chiếu', 'Cơ chế', 'Số giờ trong tháng', 'Số tháng đạt được'], ...active.map((item) => {
      const workerId = typeof item.workerId === 'string' ? item.workerId : item.workerId._id;
      const worker = workers.find((row) => row._id === workerId);
      return [workerId, worker?.fullName || (typeof item.workerId === 'string' ? item.workerId : item.workerId.fullName), item.commissionScheme === 'seasonal_hourly' ? 'Thời vụ' : 'Chính thức', '', ''];
    })];
    const csv = '\uFEFF' + rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    try { await saveAndShareExport(new TextEncoder().encode(csv), 'mau-nhap-so-cong-doi-soat.csv', 'text/csv;charset=utf-8'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tạo được file mẫu.'); }
  }
  async function importSettlementFile() {
    try {
      const picked = await withAppLockSuspended(() => DocumentPicker.getDocumentAsync({ type: ['text/csv'], copyToCacheDirectory: true }));
      if (picked.canceled) return;
      const asset = picked.assets[0];
      if (!asset || !/\.csv$/i.test(asset.name) || (asset.size ?? 0) > 5 * 1024 * 1024) throw new Error('Chọn file CSV tối đa 5 MB.');
      const response = await fetch(asset.uri); if (!response.ok) throw new Error('Không đọc được file trên thiết bị.');
      const text = new TextDecoder().decode(await response.arrayBuffer());
      const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false;
      for (let i = 0; i < text.length; i += 1) { const char = text[i]; if (char === '"' && quoted && text[i + 1] === '"') { cell += '"'; i += 1; } else if (char === '"') quoted = !quoted; else if (char === ',' && !quoted) { row.push(cell); cell = ''; } else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && text[i + 1] === '\n') i += 1; row.push(cell); rows.push(row); row = []; cell = ''; } else cell += char; }
      if (cell || row.length) { row.push(cell); rows.push(row); }
      const headers = (rows.shift() || []).map((value) => value.trim().toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd'));
      const idColumn = headers.findIndex((value) => ['ma lao dong', 'worker id', 'workerid', 'id'].includes(value));
      const hoursColumn = headers.findIndex((value) => value.includes('so gio') || value === 'hours');
      const monthsColumn = headers.findIndex((value) => value.includes('so thang') || value === 'months');
      if (idColumn < 0 || (hoursColumn < 0 && monthsColumn < 0)) throw new Error('File cần có cột Mã lao động và Số giờ hoặc Số tháng.');
      const active = referrals.filter((item) => item.status === 'active'); const byWorker = new Map(active.map((item) => [typeof item.workerId === 'string' ? item.workerId : item.workerId._id, item]));
      const values: Record<string, string> = {}; const errors: string[] = []; let matched = 0;
      rows.forEach((cells, index) => {
        const workerId = String(cells[idColumn] || '').trim(); if (!workerId) return;
        const referral = byWorker.get(workerId); if (!referral) { errors.push(`Dòng ${index + 2}: mã lao động không thuộc nguồn đang hiệu lực.`); return; }
        const valueColumn = referral.commissionScheme === 'seasonal_hourly' ? hoursColumn : monthsColumn;
        if (valueColumn < 0) { errors.push(`Dòng ${index + 2}: thiếu cột ${referral.commissionScheme === 'seasonal_hourly' ? 'Số giờ' : 'Số tháng'} cho cơ chế của đối tác.`); return; }
        const value = Number(String(cells[valueColumn] || '').trim().replace(',', '.'));
        if (!Number.isFinite(value) || value < 0 || (referral.commissionScheme === 'official_monthly' && (!Number.isInteger(value) || value > 3))) { errors.push(`Dòng ${index + 2}: số công không hợp lệ.`); return; }
        values[referral._id] = String(value); matched += 1;
      });
      setEntryValues((current) => ({ ...current, ...values })); setMessage(`Đã nạp ${matched} dòng${errors.length ? `. ${errors.slice(0, 3).join(' ')}` : '.'}`); setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không đọc được file nhập số công.'); }
  }

  return <View style={styles.container}>
    {error ? <PopupError error={error} /> : null}{message ? <Text style={styles.message}>{message}</Text> : null}
    {busy && <ActivityIndicator color={colors.primary} />}
    {tab === 'referrals' && <ScrollView contentContainerStyle={styles.content}>
      <PartnerPicker partners={partners} value={partnerId} onChange={changePartner} />
      {overview && <View style={styles.kpiSummary}><Metric label="Phát sinh" value={cash(overview.totals.accruedAmount)} /><Metric label="Đã chi" value={cash(overview.totals.paidAmount)} /><Metric label="Còn phải chi" value={cash(overview.totals.balanceAmount)} /></View>}
      <View style={styles.toolbar}><Text style={styles.meta}>{currentPartner?.code || ''} · {referrals.length} nguồn</Text>{canManage && <Action label="Thêm nguồn" onPress={createReferral} />}</View>
      {referrals.map((referral) => <View key={referral._id} style={styles.card}><View style={styles.row}><UsersRound size={15} color={colors.primary} /><Text style={styles.cardTitle}>{asName(referral.workerId)}</Text><StatusPill label={referral.status === 'pending' ? 'Chờ xác nhận' : referral.status === 'active' ? 'Đang hiệu lực' : referral.status === 'ended' ? 'Đã kết thúc' : 'Từ chối'} /></View><Text style={styles.meta}>{referral.commissionScheme === 'official_monthly' ? 'Chính thức · theo tháng' : 'Thời vụ · theo giờ'} · {referral.effectiveFrom}{referral.effectiveTo ? ` → ${referral.effectiveTo}` : ''}</Text><Text style={styles.meta}>Chính sách: {typeof referral.policyId === 'string' ? referral.policyId : `${referral.policyId?.name} v${referral.policyId?.version}`}</Text>{referral.note ? <Text style={styles.meta}>Ghi chú: {referral.note}</Text> : null}<View style={styles.rowEnd}>{canManage && referral.status === 'pending' && <Action label="Xác nhận" onPress={() => void mutateReferral(referral, 'confirm')} />}{canManage && referral.status === 'active' && <Action label="Kết thúc" destructive onPress={() => void mutateReferral(referral, 'end')} />}</View></View>)}
      {!busy && referrals.length === 0 ? <Empty text="Chưa có nguồn giới thiệu cho đối tác này." /> : null}
    </ScrollView>}

    {tab === 'kpi' && <ScrollView contentContainerStyle={styles.content}><Text style={styles.label}>Tháng (YYYY-MM)</Text><TextInput value={month.slice(0, 7)} onChangeText={(value) => setMonth(`${value.slice(0, 7)}-01`)} placeholder="2026-11" style={styles.input} /><View style={styles.kpiSummary}><Metric label="Chỉ tiêu" value={String(kpi.reduce((sum, row) => sum + row.targetReferrals, 0))} /><Metric label="Đã giới thiệu" value={String(kpi.reduce((sum, row) => sum + row.actualReferrals, 0))} /><Metric label="Đạt KPI" value={String(kpi.filter((row) => row.status === 'achieved').length)} /></View>{kpi.map((row) => <View style={styles.card} key={row.partnerId}><View style={styles.row}><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{row.partner.name}</Text><Text style={styles.meta}>{row.partner.code}</Text></View><Text style={styles.kpiRate}>{row.completionRate == null ? '—' : `${row.completionRate}%`}</Text></View><Text style={styles.meta}>Thực tế: {row.actualReferrals} · Còn thiếu: {row.remainingReferrals ?? '—'} · {row.status === 'achieved' ? 'Đạt KPI' : row.status === 'incomplete' ? 'Chưa đạt' : 'Chưa đặt'}</Text><View style={styles.row}><TextInput value={kpiDrafts[row.partnerId] || ''} onChangeText={(value) => setKpiDrafts((current) => ({ ...current, [row.partnerId]: value }))} keyboardType="numeric" editable={canManage} placeholder="Chỉ tiêu" style={[styles.input, { flex: 1 }]} />{canManage && <Action label="Lưu" onPress={() => void saveTarget(row)} />}</View></View>)}{!busy && !kpi.length ? <Empty text="Chưa có đối tác để theo dõi KPI." /> : null}</ScrollView>}

    {tab === 'settlements' && <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.toolbarEnd}><Action label="Xuất báo cáo" onPress={() => void exportReport()} /></View>
      <PartnerPicker partners={partners} value={settlementPartnerId} onChange={(id) => { setSettlementPartnerId(id); if (id) changePartner(id); }} allowAll />
      <View style={styles.kpiSummary}><Metric label="Phát sinh" value={cash(settlements.reduce((sum, item) => sum + item.totalAmount, 0))} /><Metric label="Đã duyệt" value={cash(settlements.filter((item) => ['approved', 'partially_paid', 'paid'].includes(item.status)).reduce((sum, item) => sum + item.totalAmount, 0))} /><Metric label="Đã chi" value={cash(settlements.reduce((sum, item) => sum + item.paidAmount, 0))} /><Metric label="Còn phải chi" value={cash(settlements.reduce((sum, item) => sum + item.balanceAmount, 0))} /></View>
      <DateTimeField label="Ngày thuộc kỳ" mode="date" value={periodAnchor} onChange={setPeriodAnchor} />
      <View style={styles.rowWrap}><Action label="Tải mẫu CSV" onPress={() => void downloadSettlementTemplate()} /><Action label="Nhập số công CSV" onPress={() => void importSettlementFile()} /></View>
      <Text style={styles.sectionTitle}>Lọc kỳ đối soát</Text><View style={styles.rowWrap}>{([{ value: 'all', label: 'Mọi trạng thái' }, { value: 'calculated', label: 'Đã tính' }, { value: 'approved', label: 'Đã duyệt' }, { value: 'partially_paid', label: 'Chi một phần' }, { value: 'paid', label: 'Đã chi đủ' }, { value: 'void', label: 'Đã hủy' }] as const).map((item) => <Pressable key={item.value} onPress={() => setSettlementStatusFilter(item.value)} style={[styles.option, settlementStatusFilter === item.value && styles.optionSelected]}><Text style={[styles.optionText, settlementStatusFilter === item.value && styles.optionTextSelected]}>{item.label}</Text></Pressable>)}</View>
      <View style={styles.rowWrap}>{([{ value: 'all', label: 'Mọi cơ chế' }, { value: 'official_monthly', label: 'Chính thức' }, { value: 'seasonal_hourly', label: 'Thời vụ' }] as const).map((item) => <Pressable key={item.value} onPress={() => setSettlementSchemeFilter(item.value)} style={[styles.option, settlementSchemeFilter === item.value && styles.optionSelected]}><Text style={[styles.optionText, settlementSchemeFilter === item.value && styles.optionTextSelected]}>{item.label}</Text></Pressable>)}</View>
      <View style={styles.row}><DateTimeField label="Từ ngày" mode="date" value={periodStartFilter} onChange={setPeriodStartFilter} allowClear /><DateTimeField label="Đến ngày" mode="date" value={periodEndFilter} onChange={setPeriodEndFilter} allowClear /></View>
      <Text style={styles.sectionTitle}>Số liệu nguồn đang hiệu lực · {settlementPartnerId ? currentPartner?.name || 'Chọn đối tác' : 'Chọn đối tác để nhập số liệu'}</Text>{(settlementPartnerId ? referrals.filter((item) => item.status === 'active') : []).map((referral) => <View style={styles.entryRow} key={referral._id}><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{asName(referral.workerId)}</Text><Text style={styles.meta}>{referral.commissionScheme === 'official_monthly' ? 'Tháng chính thức (0–3)' : 'Giờ thời vụ'}</Text></View><TextInput value={entryValues[referral._id] || ''} onChangeText={(value) => setEntryValues((current) => ({ ...current, [referral._id]: value }))} keyboardType="decimal-pad" placeholder="0" style={[styles.input, { width: 90, flex: 0 }]} /></View>)}
      {canManageSettlements && <Action label="Tính kỳ đối soát" onPress={() => void calculate()} />}
      {settlements.map((item) => <Pressable key={item._id} onPress={() => void openSettlement(item._id)} style={styles.card}><View style={styles.row}><CalendarDays size={15} color={colors.primary} /><Text style={styles.cardTitle}>{item.periodStart} – {item.periodEnd}</Text><StatusPill label={settlementStatus(item.status)} /></View><Text style={styles.meta}>Tổng {cash(item.totalAmount)} · Đã chi {cash(item.paidAmount)} · Còn {cash(item.balanceAmount)}</Text><Text style={styles.openDetail}>Xem chi tiết</Text></Pressable>)}
      {!busy && !settlements.length ? <Empty text="Không có kỳ đối soát theo bộ lọc." /> : null}
    </ScrollView>}

    <FullScreenFormModal
      visible={referralFormOpen}
      title="Thêm nguồn giới thiệu"
      onClose={() => setReferralFormOpen(false)}
      footer={<View style={styles.rowEnd}><Action label="Tạo nguồn" onPress={() => void saveReferral()} /></View>}
    >
      <View style={{ gap: 8 }}>
        <Text style={styles.label}>Người lao động *</Text><Pressable onPress={() => setWorkerPicker(true)} style={styles.select}><Text style={styles.selectText}>{workers.find((item) => item._id === referralForm.workerId)?.fullName || 'Chọn lao động'}</Text><ChevronDown size={15} color={colors.muted} /></Pressable>
        <Text style={styles.label}>Cơ chế hoa hồng</Text><View style={styles.row}>{([{ value: 'official_monthly', label: 'Chính thức' }, { value: 'seasonal_hourly', label: 'Thời vụ' }] as const).map((item) => <Pressable key={item.value} onPress={() => setReferralForm((form) => ({ ...form, commissionScheme: item.value, policyId: activePolicies.find((policy) => item.value === 'official_monthly' ? policy.official.enabled : policy.seasonal.enabled)?._id || '' }))} style={[styles.option, referralForm.commissionScheme === item.value && styles.optionSelected]}><Text style={[styles.optionText, referralForm.commissionScheme === item.value && styles.optionTextSelected]}>{item.label}</Text></Pressable>)}</View>
        <Text style={styles.label}>Chính sách đang hoạt động *</Text>{activePolicies.filter((policy) => referralForm.commissionScheme === 'official_monthly' ? policy.official.enabled : policy.seasonal.enabled).map((policy) => <Pressable key={policy._id} onPress={() => setReferralForm((form) => ({ ...form, policyId: policy._id }))} style={[styles.option, referralForm.policyId === policy._id && styles.optionSelected]}><Text style={[styles.optionText, referralForm.policyId === policy._id && styles.optionTextSelected]}>{policy.name} · v{policy.version}</Text></Pressable>)}
        {(['referredAt', 'employmentStartDate', 'effectiveFrom'] as const).map((key) => <DateTimeField key={key} label={key === 'referredAt' ? 'Ngày giới thiệu' : key === 'employmentStartDate' ? 'Ngày bắt đầu làm' : 'Hiệu lực từ'} mode="date" value={referralForm[key]} onChange={(value) => setReferralForm((form) => ({ ...form, [key]: value }))} />)}
        <Text style={styles.label}>Ghi chú</Text><TextInput value={referralForm.note} onChangeText={(note) => setReferralForm((form) => ({ ...form, note }))} style={styles.input} />
      </View>
    </FullScreenFormModal>

    <Modal visible={workerPicker} transparent animationType="fade" onRequestClose={() => setWorkerPicker(false)}><Pressable style={styles.backdrop} onPress={() => setWorkerPicker(false)}><Pressable style={styles.dialog} onPress={() => {}}><ModalHeader title="Chọn lao động" onClose={() => setWorkerPicker(false)} /><ScrollView style={{ maxHeight: 430 }}>{workers.length > 0 ? workers.map((worker) => <Pressable key={worker._id} onPress={() => { setReferralForm((form) => ({ ...form, workerId: worker._id })); setWorkerPicker(false); }} style={styles.option}><Text style={styles.optionText}>{worker.fullName}</Text><Text style={styles.meta}>{worker.code || worker.phone || worker._id}</Text></Pressable>) : <IgenWorkerEmptyState compact message="Chưa có lao động khả dụng." />}</ScrollView></Pressable></Pressable></Modal>

    <FullScreenFormModal
      visible={Boolean(detail)}
      title="Chi tiết kỳ đối soát"
      onClose={() => setDetail(null)}
    >
      <View style={{ gap: 10 }}>{detail && <>
        <View style={styles.card}><Text style={styles.cardTitle}>{partnerName(detail.partnerId)} · {settlementStatus(detail.status)}</Text><Text style={styles.meta}>{detail.periodStart} – {detail.periodEnd}</Text><Text style={styles.amount}>{cash(detail.totalAmount)}</Text><Text style={styles.meta}>Chính thức {cash(detail.officialAmount)} · Thời vụ {cash(detail.seasonalAmount)} · Điều chỉnh {cash(detail.adjustmentAmount)}</Text><Text style={styles.meta}>Đã chi {cash(detail.paidAmount)} · Còn lại {cash(detail.balanceAmount)}</Text></View>
        {detail.warnings?.map((warning, index) => <Text key={index} style={styles.error}>{warning.message}</Text>)}
        <Text style={styles.sectionTitle}>Dòng hoa hồng</Text>{detail.lines.map((line) => <View key={line._id} style={styles.card}><Text style={styles.cardTitle}>{line.workerId ? asName(line.workerId as LaborReferral['workerId']) : 'Điều chỉnh đối tác'} · {line.scheme === 'official_monthly' ? 'Chính thức' : line.scheme === 'seasonal_hourly' ? 'Thời vụ' : 'Điều chỉnh'}</Text><Text style={styles.meta}>{line.explanation}</Text><Text style={styles.amount}>{cash(line.amount)}</Text></View>)}
        <Text style={styles.sectionTitle}>Lịch sử chi trả</Text>{detail.payouts.map((payout) => <View key={payout._id} style={styles.card}><Text style={styles.cardTitle}>{cash(payout.amount)} · {payout.method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}</Text><Text style={styles.meta}>{payout.paidAt} · {payout.reference || 'Không có tham chiếu'}{payout.reversalOfPayoutId ? ' · Giao dịch đảo' : ''}</Text>{canPayout && !payout.reversalOfPayoutId && <Pressable onPress={() => void reversePayout(payout._id)}><Text style={styles.dangerLink}>Hoàn tác chi trả</Text></Pressable>}</View>)}
        <View style={styles.rowWrap}>{canManageSettlements && ['draft', 'calculated'].includes(detail.status) && <Action label="Tính lại" onPress={() => void runSettlementAction('recalculate')} />}{canManageSettlements && detail.status === 'calculated' && <Action label="Duyệt kỳ" onPress={() => void runSettlementAction('approve')} />}{canManageSettlements && ['draft', 'calculated'].includes(detail.status) && <Action label="Hủy kỳ" destructive onPress={() => void runSettlementAction('void')} />}{canManageSettlements && detail.status !== 'void' && <Action label="Điều chỉnh" onPress={() => setAdjustmentOpen(true)} />}{canPayout && ['approved', 'partially_paid'].includes(detail.status) && detail.balanceAmount > 0 && <Action label="Ghi nhận chi trả" onPress={() => { setPayoutAmount(formatVndInput(detail.balanceAmount)); setPayoutOpen(true); }} />}</View>
      </>}</View>
    </FullScreenFormModal>

    <FullScreenFormModal
      visible={payoutOpen}
      title="Ghi nhận chi trả"
      onClose={() => setPayoutOpen(false)}
      footer={<Action label="Lưu chi trả" onPress={() => void savePayout()} />}
    >
      <View style={{ gap: 10 }}>
        <Text style={styles.label}>Số tiền (VND)</Text><View style={styles.moneyInputWrap}><TextInput value={payoutAmount} onChangeText={(v) => setPayoutAmount(formatVndInput(v))} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.muted} style={styles.moneyInput} /><Text style={styles.currencySuffix}>VND</Text></View><Text style={styles.label}>Hình thức</Text><View style={styles.row}>{([{ value: 'bank_transfer', label: 'Chuyển khoản' }, { value: 'cash', label: 'Tiền mặt' }] as const).map((item) => <Pressable key={item.value} onPress={() => setPayoutMethod(item.value)} style={[styles.option, payoutMethod === item.value && styles.optionSelected]}><Text style={[styles.optionText, payoutMethod === item.value && styles.optionTextSelected]}>{item.label}</Text></Pressable>)}</View><Text style={styles.label}>Mã tham chiếu</Text><TextInput value={payoutReference} onChangeText={setPayoutReference} style={styles.input} />
      </View>
    </FullScreenFormModal>
    <FullScreenFormModal
      visible={adjustmentOpen}
      title="Điều chỉnh đối soát"
      onClose={() => setAdjustmentOpen(false)}
      footer={<Action label="Tạo điều chỉnh" onPress={() => void saveAdjustment()} />}
    >
      <View style={{ gap: 10 }}>
        <Text style={styles.meta}>Số dương: trả thêm · số âm: giảm trừ</Text><View style={styles.moneyInputWrap}><TextInput value={adjustmentAmount} onChangeText={(v) => setAdjustmentAmount(formatVndInput(v, true))} keyboardType="numbers-and-punctuation" placeholder="Số tiền" placeholderTextColor={colors.muted} style={styles.moneyInput} /><Text style={styles.currencySuffix}>VND</Text></View><TextInput value={adjustmentReason} onChangeText={setAdjustmentReason} placeholder="Lý do bắt buộc" placeholderTextColor={colors.muted} style={styles.input} />
      </View>
    </FullScreenFormModal>
  </View>;
}

function PartnerPicker({ partners, value, onChange, allowAll = false }: { partners: LaborPartner[]; value: string; onChange: (value: string) => void; allowAll?: boolean }) { return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>{allowAll && <Pressable key="all" onPress={() => onChange('')} style={[styles.option, value === '' && styles.optionSelected]}><Text style={[styles.optionText, value === '' && styles.optionTextSelected]}>{'T\u1ea5t c\u1ea3 \u0111\u1ed1i t\u00e1c'}</Text></Pressable>}{partners.map((partner) => <Pressable key={partner._id} onPress={() => onChange(partner._id)} style={[styles.option, value === partner._id && styles.optionSelected]}><Text style={[styles.optionText, value === partner._id && styles.optionTextSelected]}>{partner.code} · {partner.name}</Text></Pressable>)}</ScrollView>; }
function Action({ label, onPress, destructive = false }: { label: string; onPress: () => void; destructive?: boolean }) { return <Pressable onPress={onPress} style={[styles.action, destructive && styles.actionDanger]}><Text style={styles.actionText}>{label}</Text></Pressable>; }
function StatusPill({ label }: { label: string }) { return <Text style={styles.status}>{label}</Text>; }
function Empty({ text }: { text: string }) { return <View style={styles.empty}><IgenWorkerEmptyState message={text} /></View>; }
function Metric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.meta}>{label}</Text></View>; }
function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) { return <View style={styles.modalHeader}><Text style={styles.heading}>{title}</Text><Pressable onPress={onClose}><X size={19} color={colors.muted} /></Pressable></View>; }
function settlementStatus(status: LaborSettlement['status']) { return ({ draft: 'Nháp', calculated: 'Đã tính', approved: 'Đã duyệt', partially_paid: 'Chi một phần', paid: 'Đã chi đủ', void: 'Đã hủy' } as const)[status]; }
function partnerName(value: LaborSettlement['partnerId']) { return typeof value === 'string' ? value : `${value.code} · ${value.name}`; }

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingTop: 10, paddingBottom: 28, gap: 10 },
  heading: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  sectionTitle: { color: colors.ink, fontSize: 12, fontWeight: '800', marginTop: 6 },
  label: { color: colors.ink, fontSize: 10, fontWeight: '700', marginTop: 4 },
  meta: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  error: { marginHorizontal: 14, marginTop: 8, color: '#B42318', fontSize: 10 },
  message: { marginHorizontal: 14, marginTop: 8, color: '#16885A', fontSize: 10, fontWeight: '700' },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  toolbarEnd: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowEnd: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 6 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 },
  card: { padding: 13, gap: 5, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.white },
  cardTitle: { color: colors.ink, fontSize: 12, fontWeight: '800', flexShrink: 1 },
  status: { overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, color: '#695219', backgroundColor: '#FFF4D6', fontSize: 9, fontWeight: '800' },
  action: { minHeight: 38, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderRadius: 11, backgroundColor: colors.primary },
  actionDanger: { backgroundColor: '#B42318' },
  actionText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  input: { minHeight: 42, paddingHorizontal: 11, borderWidth: 1, borderColor: colors.border, borderRadius: 11, backgroundColor: colors.white, color: colors.ink, fontSize: 11 },
  moneyInputWrap: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 11, borderWidth: 1, borderColor: colors.border, borderRadius: 11, backgroundColor: colors.white },
  moneyInput: { flex: 1, color: colors.ink, fontSize: 11, fontWeight: '700', paddingVertical: 8 },
  currencySuffix: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  option: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 99, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  optionSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionText: { color: colors.ink, fontSize: 10, fontWeight: '700' },
  optionTextSelected: { color: colors.white },
  select: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 11, backgroundColor: colors.white },
  selectText: { color: colors.ink, fontSize: 11 },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.white },
  kpiSummary: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  metric: { flex: 1, minWidth: '45%', alignItems: 'center', padding: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  metricValue: { color: colors.ink, fontSize: 12, fontWeight: '800', textAlign: 'center' },
  kpiRate: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  amount: { color: '#16885A', fontSize: 13, fontWeight: '900' },
  openDetail: { color: colors.primary, fontSize: 10, fontWeight: '800', textAlign: 'right' },
  dangerLink: { alignSelf: 'flex-end', color: '#B42318', fontSize: 10, fontWeight: '800', padding: 5 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 18 },
  modalCard: { width: '100%', maxHeight: '88%', borderRadius: 24, overflow: 'hidden', backgroundColor: colors.background },
  modalHeader: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  form: { padding: 16, gap: 9 },
  modalActions: { alignItems: 'flex-end', padding: 14, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  backdrop: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: 'rgba(15,23,42,0.45)' },
  dialog: { gap: 10, padding: 18, borderRadius: 24, overflow: 'hidden', backgroundColor: colors.white },
});
