import { PopupError } from '@/components/PopupError';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Pencil, Plus, RotateCcw, Save, Search, Smartphone, X } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { DateTimeField } from '@/features/quotation/DateTimeField';
import { getRetailPartnerStatement, getRetailProductCommissions, listRetailCommissionPolicies, saveRetailCommissionPolicy, saveRetailProductCommission, type RetailCommissionPolicy, type RetailLegacyPolicy, type RetailPartner, type RetailPartnerStatementData, type RetailProductCommissionData } from '@/features/partnersApi';

type Tab = 'policies' | 'products';
const money = (value: number) => {
  const safe = Number.isFinite(value) ? Math.round(value) : 0;
  const sign = safe < 0 ? '-' : '';
  const digits = Math.abs(safe).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${digits} VND`;
};
const formatVndInput = (raw: string | number) => {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};
const parseVndInput = (raw: string) => Number(String(raw ?? '').replace(/\D/g, ''));
const field = (value: string, onChangeText: (value: string) => void, placeholder: string, keyboardType: 'default' | 'numeric' = 'default') => <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.muted} keyboardType={keyboardType} style={styles.input} />;

export function RetailPartnerStatementPanel({ companyCode }: { companyCode: string }) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [statement, setStatement] = useState<RetailPartnerStatementData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) { setError('Khoảng ngày không hợp lệ.'); return; }
    setLoading(true); setError('');
    try { setStatement(await getRetailPartnerStatement(companyCode, from, to)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được sao kê.'); }
    finally { setLoading(false); }
  }, [companyCode, from, to]);
  useEffect(() => { void load(); }, [load]);
  const rows = [...(statement?.entries || []).map((entry) => ({ id: entry._id, date: entry.businessDate, code: entry.sourceCode, amount: entry.amount, label: entry.amount < 0 ? 'Đảo hoa hồng' : 'Hoa hồng' })), ...(statement?.payouts || []).map((payout) => ({ id: payout._id, date: payout.businessDate, code: payout.reference, amount: -payout.amount, label: 'Chi trả' }))].sort((a, b) => b.date.localeCompare(a.date));
  return <View style={styles.container}><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.dateRow}>
      <DateTimeField label="Từ ngày" mode="date" value={from} onChange={setFrom} />
      <DateTimeField label="Đến ngày" mode="date" value={to} onChange={setTo} />
    </View>
    <Pressable onPress={() => void load()} style={styles.action}><Text style={styles.actionText}>Xem sao kê</Text></Pressable>
    {loading ? <ActivityIndicator color={colors.primary} /> : null}{error ? <PopupError error={error} /> : null}
    {statement && <><View style={styles.card}><Text style={styles.meta}>{statement.partner.name} ({statement.partner.code})</Text><Text style={styles.heading}>Số dư hiện tại: {money(statement.balance)}</Text></View>{rows.map((row) => <View key={row.id} style={styles.productRow}><View style={styles.productCopy}><Text style={styles.cardTitle}>{row.label}</Text><Text style={styles.meta}>{row.date} · {row.code}</Text></View><Text style={[styles.cardTitle, { color: row.amount < 0 ? '#B42318' : '#16885A' }]}>{money(row.amount)}</Text></View>)}{rows.length === 0 ? <Text style={styles.empty}>Chưa có phát sinh trong khoảng ngày này.</Text> : null}</>}
  </ScrollView></View>;
}

export function RetailPartnerOperations({ companyCode, partners, initialTab = 'policies' }: { companyCode: string; partners: RetailPartner[]; initialTab?: Tab }) {
  const tab = initialTab;
  const [policies, setPolicies] = useState<RetailCommissionPolicy[]>([]);
  const [legacy, setLegacy] = useState<RetailLegacyPolicy[]>([]);
  const [productData, setProductData] = useState<RetailProductCommissionData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [policyForm, setPolicyForm] = useState<RetailCommissionPolicy | null | 'new'>(null);
  const [policyFields, setPolicyFields] = useState({ partnerId: '', effectiveAt: '', phone: '200000', accessory: '10', repair: '10' });
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [commissionForm, setCommissionForm] = useState<{ skus: string[]; kind: 'phone' | 'accessory'; value: string } | null>(null);
  const [productFilter, setProductFilter] = useState<'all' | 'configured' | 'default'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const load = useCallback(async () => {
    setBusy(true); setError('');
    try {
      if (tab === 'policies') {
        const result = await listRetailCommissionPolicies(companyCode);
        setPolicies(result.items); setLegacy(result.legacy);
      } else setProductData(await getRetailProductCommissions(companyCode));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được dữ liệu hoa hồng.'); }
    finally { setBusy(false); }
  }, [companyCode, tab]);
  useEffect(() => { void load(); }, [load]);

  function openPolicy(policy?: RetailCommissionPolicy) {
    setPolicyFields(policy ? {
      partnerId: policy.partnerId || '', effectiveAt: policy.effectiveAt ? new Date(policy.effectiveAt).toISOString().slice(0, 16) : '',
      phone: formatVndInput(policy.config.phoneAmount), accessory: String(policy.config.accessoryBps / 100), repair: String(policy.config.repairBps / 100),
    } : { partnerId: '', effectiveAt: '', phone: formatVndInput(200000), accessory: '10', repair: '10' });
    setPolicyForm(policy || 'new');
  }

  async function savePolicy() {
    if (!policyForm || busy) return;
    const phoneAmount = parseVndInput(policyFields.phone), accessory = Number(policyFields.accessory), repair = Number(policyFields.repair);
    if (!Number.isFinite(phoneAmount) || phoneAmount < 150000 || phoneAmount > 300000 || accessory < 10 || accessory > 15 || repair < 10 || repair > 15 || (policyFields.effectiveAt && Number.isNaN(new Date(policyFields.effectiveAt).valueOf()))) { setError('Kiểm tra ngày hiệu lực; mức điện thoại phải từ 150.000 - 300.000 VND, phụ kiện và sửa chữa từ 10 - 15%.'); return; }
    setBusy(true); setError('');
    try {
      await saveRetailCommissionPolicy(companyCode, {
        partnerId: policyFields.partnerId,
        ...(policyFields.effectiveAt ? { effectiveAt: policyForm !== 'new' && policyForm.effectiveAt && new Date(policyFields.effectiveAt).toISOString() === new Date(policyForm.effectiveAt).toISOString() ? policyForm.effectiveAt : new Date(`${policyFields.effectiveAt}:00+07:00`).toISOString() } : {}),
        config: { phoneAmount, accessoryBps: Math.round(accessory * 100), repairBps: Math.round(repair * 100) },
      }, policyForm === 'new' ? undefined : policyForm._id);
      setPolicyForm(null); setMessage('Đã lưu phiên bản chính sách hoa hồng.'); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không lưu được chính sách.'); }
    finally { setBusy(false); }
  }

  const visibleVariants = useMemo(() => {
    const search = query.trim().toLocaleLowerCase('vi');
    return (productData?.variants || []).filter((variant) => {
      const product = productData?.products.find((item) => item._id === variant.productId);
      const rule = productData?.configurations.find((item) => item.sku === variant.sku)?.rule;
      return (!search || `${product?.name || ''} ${variant.displayName || ''} ${variant.sku}`.toLocaleLowerCase('vi').includes(search)) && (categoryFilter === 'all' || product?.categoryCode === categoryFilter) && (productFilter === 'all' || (productFilter === 'configured' ? Boolean(rule) : !rule));
    });
  }, [categoryFilter, productData, productFilter, query]);
  const configured = useMemo(() => new Map(productData?.configurations.map((item) => [item.sku, item.rule]) || []), [productData]);

  function openCommission(skus: string[]) {
    if (!skus.length || skus.length > 500) { setError('Mỗi lần chỉ cấu hình tối đa 500 SKU.'); return; }
    const rule = configured.get(skus[0]);
    const variant = productData?.variants.find((item) => item.sku === skus[0]);
    const kind = rule?.kind || (variant?.trackingMode === 'serial' ? 'phone' : 'accessory');
    setCommissionForm({ skus, kind, value: rule ? (rule.kind === 'phone' ? formatVndInput(rule.amount) : String(rule.rateBps / 100)) : kind === 'phone' ? formatVndInput(200000) : '10' });
  }

  async function saveCommission(rule: { kind: 'phone'; amount: number } | { kind: 'accessory'; rateBps: number } | null) {
    if (!commissionForm || busy) return;
    const numericVal = commissionForm.kind === 'phone' ? parseVndInput(commissionForm.value) : Number(commissionForm.value);
    if (rule && (!Number.isFinite(numericVal) || numericVal <= 0 || (commissionForm.kind === 'accessory' && numericVal > 100) || commissionForm.skus.length > 500)) { setError('Mức riêng phải lớn hơn 0, tỷ lệ không quá 100% và tối đa 500 SKU mỗi lần.'); return; }
    setBusy(true); setError('');
    try { await saveRetailProductCommission(companyCode, commissionForm.skus, rule); setCommissionForm(null); setSelected([]); setMessage(rule ? 'Đã lưu mức hoa hồng theo SKU.' : 'Đã xóa mức riêng, SKU dùng chính sách chung.'); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không lưu được hoa hồng sản phẩm.'); }
    finally { setBusy(false); }
  }

  return <View style={styles.container}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {message ? <Text style={styles.message}>{message}</Text> : null}{error ? <PopupError error={error} onRetry={() => void load()} /> : null}
      {busy && !policies.length && !productData ? <ActivityIndicator color={colors.primary} /> : null}
      {tab === 'policies' ? <>
        <View style={styles.toolbarEnd}><Pressable onPress={() => openPolicy()} style={styles.action}><Plus size={15} color={colors.white} /><Text style={styles.actionText}>Tạo mới</Text></Pressable></View>
        {busy && policies.length === 0 ? <ActivityIndicator color={colors.primary} /> : policies.length === 0 ? <Text style={styles.empty}>Chưa có phiên bản chính sách.</Text> : policies.map((policy) => <View key={policy._id} style={styles.card}><View style={styles.rowBetween}><Text style={styles.cardTitle}>{policy.partnerId ? partners.find((partner) => partner._id === policy.partnerId)?.name || 'CTV đã ngừng' : 'Toàn công ty'}</Text><Pressable onPress={() => openPolicy(policy)} style={styles.iconAction}><Pencil size={14} color={colors.primary} /><Text style={styles.link}>Sửa</Text></Pressable></View><Text style={styles.meta}>Hiệu lực: {new Date(policy.effectiveAt).toLocaleString('vi-VN')}</Text><Text style={styles.detail}>Điện thoại {money(policy.config.phoneAmount)} · Phụ kiện {policy.config.accessoryBps / 100}% · Sửa chữa {policy.config.repairBps / 100}%</Text></View>)}
        {legacy.length > 0 && <><Text style={styles.heading}>Cấu hình hoa hồng cũ</Text>{legacy.map((row) => <View style={styles.card} key={row._id}><Text style={styles.cardTitle}>{partners.find((p) => p._id === row.partnerId)?.name || row.partnerId}</Text><Text style={styles.meta}>{row.kind === 'repair' ? 'Sửa chữa' : 'Bán sản phẩm'} · {row.sku} · {row.ratePercent}% · {row.active ? 'Đang áp dụng' : 'Ngừng áp dụng'}</Text></View>)}</>}
      </> : <>
        <View style={styles.searchBox}><Search size={15} color={colors.muted} /><TextInput value={query} onChangeText={setQuery} placeholder="Tìm sản phẩm hoặc SKU" placeholderTextColor={colors.muted} style={styles.searchInput} /></View>
        <View style={styles.inline}>{([{ value: 'all', label: 'Tất cả SKU' }, { value: 'configured', label: 'Có mức riêng' }, { value: 'default', label: 'Dùng chính sách' }] as const).map((item) => <Pressable key={item.value} onPress={() => setProductFilter(item.value)} style={[styles.choice, productFilter === item.value && styles.choiceSelected]}><Text style={[styles.choiceText, productFilter === item.value && styles.choiceTextSelected]}>{item.label}</Text></Pressable>)}</View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={styles.inline}><Pressable onPress={() => setCategoryFilter('all')} style={[styles.choice, categoryFilter === 'all' && styles.choiceSelected]}><Text style={[styles.choiceText, categoryFilter === 'all' && styles.choiceTextSelected]}>Mọi danh mục</Text></Pressable>{productData?.categories.map((category) => <Pressable key={category.code} onPress={() => setCategoryFilter(category.code)} style={[styles.choice, categoryFilter === category.code && styles.choiceSelected]}><Text style={[styles.choiceText, categoryFilter === category.code && styles.choiceTextSelected]}>{category.name}</Text></Pressable>)}</View></ScrollView>
        <View style={styles.rowBetween}><Text style={styles.meta}>{selected.length} SKU đã chọn</Text><View style={styles.inline}><Pressable disabled={!selected.length} onPress={() => openCommission(selected)} style={styles.smallAction}><Text style={styles.link}>Cấu hình</Text></Pressable><Pressable onPress={() => setSelected(visibleVariants.map((item) => item.sku))} style={styles.smallAction}><Text style={styles.link}>Chọn kết quả</Text></Pressable></View></View>
        {visibleVariants.map((variant) => { const product = productData?.products.find((item) => item._id === variant.productId); const rule = configured.get(variant.sku); const legacy = productData?.legacyRules.filter((item) => item.sku === variant.sku) || []; const checked = selected.includes(variant.sku); const rateLabel = rule ? rule.kind === 'phone' ? `Riêng: ${money(rule.amount)}/máy` : `Riêng: ${rule.rateBps / 100}%` : legacy.length ? `Cấu hình cũ: ${legacy.map((item) => `${item.ratePercent}%`).join(', ')} · dùng khi chưa có chính sách mới` : 'Dùng chính sách chung'; return <View key={variant._id} style={styles.productRow}><Pressable onPress={() => setSelected((current) => checked ? current.filter((sku) => sku !== variant.sku) : [...current, variant.sku])} style={[styles.check, checked && styles.checked]}><Text style={styles.checkText}>{checked ? '✓' : ''}</Text></Pressable><View style={styles.productCopy}><Text style={styles.cardTitle}>{variant.displayName || product?.name || variant.sku}</Text><Text style={styles.meta}>{variant.sku} · {rateLabel}</Text></View><Pressable onPress={() => openCommission([variant.sku])} style={styles.iconAction}><Text style={styles.link}>Cấu hình</Text></Pressable></View>; })}
        {!busy && visibleVariants.length === 0 && <Text style={styles.empty}>Không có SKU phù hợp.</Text>}
      </>}
    </ScrollView>

    <Modal visible={Boolean(policyForm)} transparent animationType="fade" onRequestClose={() => { if (!busy) setPolicyForm(null); }}>
      <Pressable style={styles.backdrop} onPress={() => { if (!busy) setPolicyForm(null); }}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <Text style={styles.heading}>{policyForm === 'new' ? 'Tạo chính sách hoa hồng' : 'Sửa chính sách hoa hồng'}</Text>
            <Pressable onPress={() => setPolicyForm(null)} style={styles.closeBtn}><X size={18} color={colors.muted} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Áp dụng cho (để trống = toàn công ty)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>{[{ _id: '', name: 'Toàn công ty' }, ...partners.filter((p) => p.roles.includes('collaborator'))].map((p) => <Pressable key={p._id} onPress={() => setPolicyFields((f) => ({ ...f, partnerId: p._id }))} style={[styles.choice, policyFields.partnerId === p._id && styles.choiceSelected]}><Text style={[styles.choiceText, policyFields.partnerId === p._id && styles.choiceTextSelected]}>{p.name}</Text></Pressable>)}</ScrollView>
            <DateTimeField
              label="Ngày hiệu lực (để trống = ngay)"
              mode="date"
              value={policyFields.effectiveAt ? policyFields.effectiveAt.slice(0, 10) : ''}
              onChange={(dateVal) => setPolicyFields((f) => ({ ...f, effectiveAt: dateVal ? `${dateVal}T${f.effectiveAt.slice(11, 16) || '00:00'}` : '' }))}
              allowClear
            />
            <Text style={styles.label}>Điện thoại / thiết bị (VND mỗi máy)</Text>
            <View style={styles.moneyInputWrap}>
              <TextInput
                value={policyFields.phone}
                onChangeText={(phone) => setPolicyFields((f) => ({ ...f, phone: formatVndInput(phone) }))}
                placeholder="200.000"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                style={styles.moneyInput}
              />
              <Text style={styles.currencySuffix}>VND</Text>
            </View>
            <Text style={styles.label}>Phụ kiện (% doanh thu)</Text>{field(policyFields.accessory, (accessory) => setPolicyFields((f) => ({ ...f, accessory })), '10', 'numeric')}
            <Text style={styles.label}>Công sửa chữa (%)</Text>{field(policyFields.repair, (repair) => setPolicyFields((f) => ({ ...f, repair })), '10', 'numeric')}
          </ScrollView>
          <View style={styles.modalActions}>
            <Pressable onPress={() => setPolicyForm(null)} style={styles.secondary}><Text style={styles.secondaryText}>Hủy</Text></Pressable>
            <Pressable onPress={() => void savePolicy()} style={styles.action}><Save size={14} color={colors.white} /><Text style={styles.actionText}>{busy ? 'Đang lưu…' : 'Lưu'}</Text></Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
    <Modal visible={Boolean(commissionForm)} transparent animationType="fade" onRequestClose={() => setCommissionForm(null)}>
      <Pressable style={styles.backdrop} onPress={() => setCommissionForm(null)}>
        <Pressable style={styles.dialog} onPress={() => {}}>
          <View style={styles.rowBetween}><Text style={styles.heading}>Cấu hình {commissionForm?.skus.length} SKU</Text><Pressable onPress={() => setCommissionForm(null)} style={styles.closeBtn}><X size={18} color={colors.muted} /></Pressable></View>
          <View style={styles.inline}>
            <Pressable onPress={() => setCommissionForm((f) => f && ({ ...f, kind: 'phone', value: formatVndInput(200000) }))} style={[styles.choice, commissionForm?.kind === 'phone' && styles.choiceSelected]}><Smartphone size={14} color={commissionForm?.kind === 'phone' ? colors.white : colors.primary} /><Text style={[styles.choiceText, commissionForm?.kind === 'phone' && styles.choiceTextSelected]}>Theo máy</Text></Pressable>
            <Pressable onPress={() => setCommissionForm((f) => f && ({ ...f, kind: 'accessory', value: '10' }))} style={[styles.choice, commissionForm?.kind === 'accessory' && styles.choiceSelected]}><Text style={[styles.choiceText, commissionForm?.kind === 'accessory' && styles.choiceTextSelected]}>Theo %</Text></Pressable>
          </View>
          <Text style={styles.label}>Mức riêng {commissionForm?.kind === 'phone' ? '(VND/máy)' : '(%)'}</Text>
          {commissionForm?.kind === 'phone' ? (
            <View style={styles.moneyInputWrap}>
              <TextInput
                value={commissionForm.value}
                onChangeText={(value) => setCommissionForm((f) => f && ({ ...f, value: formatVndInput(value) }))}
                placeholder="200.000"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                style={styles.moneyInput}
              />
              <Text style={styles.currencySuffix}>VND</Text>
            </View>
          ) : field(commissionForm?.value || '', (value) => setCommissionForm((f) => f && ({ ...f, value })), 'Nhập mức', 'numeric')}
          <View style={styles.inline}>
            <Pressable onPress={() => void saveCommission(commissionForm?.kind === 'phone' ? { kind: 'phone', amount: parseVndInput(commissionForm.value) } : { kind: 'accessory', rateBps: Math.round(Number(commissionForm?.value) * 100) })} style={styles.action}><Save size={14} color={colors.white} /><Text style={styles.actionText}>Lưu mức riêng</Text></Pressable>
            <Pressable onPress={() => void saveCommission(null)} style={styles.secondary}><RotateCcw size={14} color={colors.ink} /><Text style={styles.secondaryText}>Dùng chính sách chung</Text></Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingTop: 10, paddingBottom: 28, gap: 10 },
  dateRow: { flexDirection: 'row', gap: 8 },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  toolbarEnd: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8 },
  heading: { color: colors.ink, fontWeight: '800', fontSize: 14, flexShrink: 1 },
  action: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 13, borderRadius: 11, backgroundColor: colors.primary },
  actionText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  count: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  card: { padding: 13, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.white, gap: 5 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  cardTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  detail: { color: colors.ink, fontSize: 11, lineHeight: 16 },
  iconAction: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6 },
  link: { color: colors.primary, fontWeight: '700', fontSize: 10 },
  smallAction: { padding: 5 },
  input: { minHeight: 42, flex: 1, paddingHorizontal: 11, borderWidth: 1, borderColor: colors.border, borderRadius: 11, backgroundColor: colors.white, color: colors.ink, fontSize: 11 },
  moneyInputWrap: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 11, borderWidth: 1, borderColor: colors.border, borderRadius: 11, backgroundColor: colors.white },
  moneyInput: { flex: 1, color: colors.ink, fontSize: 11, fontWeight: '700', paddingVertical: 8 },
  currencySuffix: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  searchBox: { minHeight: 43, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 11, borderWidth: 1, borderColor: colors.border, borderRadius: 13, backgroundColor: colors.white },
  searchInput: { flex: 1, color: colors.ink, fontSize: 11, paddingVertical: 8 },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 10, paddingHorizontal: 11, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  productCopy: { flex: 1, gap: 3 },
  check: { width: 21, height: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 6 },
  checked: { borderColor: colors.primary, backgroundColor: colors.primary },
  checkText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  empty: { padding: 22, color: colors.muted, fontSize: 11, textAlign: 'center' },
  message: { color: '#16885A', fontSize: 10, fontWeight: '700' },
  error: { color: '#B42318', fontSize: 10, lineHeight: 15 },
  retry: { color: colors.primary, textDecorationLine: 'underline' },
  modalCard: { width: '100%', maxHeight: '86%', borderRadius: 24, overflow: 'hidden', backgroundColor: colors.background },
  modalHeader: { minHeight: 54, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, borderBottomWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  closeBtn: { width: 32, height: 32, borderRadius: 11, backgroundColor: '#EEF1F6', alignItems: 'center', justifyContent: 'center' },
  form: { padding: 16, gap: 8 },
  label: { color: colors.ink, fontSize: 10, fontWeight: '700', marginTop: 4 },
  choice: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, marginRight: 6, borderRadius: 99, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  choiceSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  choiceText: { color: colors.ink, fontSize: 10, fontWeight: '700' },
  choiceTextSelected: { color: colors.white },
  modalActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: 14, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  secondary: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 11, backgroundColor: '#EEF1F6' },
  secondaryText: { color: colors.ink, fontSize: 10, fontWeight: '700' },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(15,23,42,0.45)' },
  dialog: { width: '100%', gap: 10, padding: 18, borderRadius: 24, overflow: 'hidden', backgroundColor: colors.white },
});
