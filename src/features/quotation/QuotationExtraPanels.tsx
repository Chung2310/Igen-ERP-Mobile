import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { strToU8, zipSync } from 'fflate';
import { ArrowDownWideNarrow, BadgeCheck, BriefcaseBusiness, Check, ChevronLeft, ChevronRight, CircleAlert, CircleDollarSign, Download, FileSpreadsheet, FileText, Files, Package, Plus, RefreshCw, Search, Trash2, Upload, X } from 'lucide-react-native';
import { Card } from '@/components/Card';
import { showHrConfirm } from '@/features/hr/components/HrConfirmModal';
import {
  CATALOG_PAGE_SIZE,
  applyCatalogBulk,
  changeCatalogItemState,
  completeAcceptanceRecord,
  createAcceptanceRecord,
  createBudgetPlan,
  createCatalogItem,
  createContract,
  deleteQuotationTemplate,
  duplicateCatalogItem,
  downloadGeneratedFile,
  downloadPriceListFile,
  downloadQuotationTemplate,
  getAcceptanceRecord,
  getContract,
  getContractPrefill,
  getLatestGeneratedFile,
  listAcceptanceRecords,
  listAllQuoteTemplates,
  listBudgetPlans,
  listCatalogItems,
  listCatalogItemsPage,
  listContracts,
  listQuotes,
  loadDocumentTemplates,
  loadQuoteTemplates,
  loadPriceLists,
  moveQuotationTemplate,
  previewCatalogBulk,
  previewPriceList,
  importPriceList,
  queueAcceptanceFile,
  queueBudgetExport,
  queueContractFile,
  queueSettlementFile,
  signContract,
  updateAcceptanceRecord,
  updateContract,
  updateBudgetPlan,
  updateCatalogItem,
  uploadQuotationTemplate,
} from '@/features/quotation/quotationApi';
import type { PriceListColumnRole, PriceListSheetPreview } from '@/features/quotation/quotationApi';
import type {
  AcceptanceRecord,
  BudgetLine,
  CatalogItem,
  CompanyPrefill,
  QuotationContract,
  QuotationScope,
  QuotationTemplate,
  Quote,
  SavedBudgetPlan,
  TemplateCategory,
} from '@/features/quotation/types';
import { saveAndShareExport } from '@/features/quotation/fileExport';
import { colors } from '@/theme/colors';

function messageOf(error: unknown) { return error instanceof Error ? error.message : 'Không thể hoàn tất thao tác với ERP.'; }
function money(value: number, currency = 'VND') {
  try { return new Intl.NumberFormat('vi-VN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value || 0); }
  catch { return `${new Intl.NumberFormat('vi-VN').format(value || 0)} ${currency}`; }
}
function date(value?: string | null) {
  if (!value) return 'Chưa cập nhật';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 'Chưa cập nhật' : new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}
function today() { const value = new Date(); return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`; }
function messageAlert(title: string, cause: unknown) { Alert.alert(title, messageOf(cause)); }

function PanelTopAction({ action }: { action?: { label: string; onPress: () => void; disabled?: boolean } }) {
  if (!action) return null;
  return <View style={styles.panelTopAction}><Pressable disabled={action.disabled} onPress={action.onPress} style={[styles.headerAction, action.disabled && styles.disabled]}><Plus size={17} color={colors.white} /><Text style={styles.headerActionText}>{action.label}</Text></Pressable></View>;
}

function EmptyState({ text }: { text: string }) { return <View style={styles.empty}><FileText size={23} color={colors.muted} /><Text style={styles.emptyText}>{text}</Text></View>; }

export function GeneratedFileActions({ scope, sourceId, kind, updatedAt, canGenerate, blocked = false, label, onGenerate }: { scope: QuotationScope; sourceId: string; kind: 'budget' | 'contract' | 'acceptance' | 'settlement' | 'estimate' | 'estimate_draft'; updatedAt?: string; canGenerate: boolean; blocked?: boolean; label: string; onGenerate: () => Promise<unknown> }) {
  const [file, setFile] = useState<{ id: string; filename: string; mimeType?: string; createdAt?: string } | null>(null);
  const [status, setStatus] = useState<'queued' | 'running' | 'completed' | 'failed' | ''>('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const outdated = Boolean(file && updatedAt && (!file.createdAt || new Date(file.createdAt).getTime() < new Date(updatedAt).getTime()));
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      try {
        const result = await getLatestGeneratedFile(scope, sourceId, kind);
        if (!active) return;
        setFile(result.file); setStatus(result.job?.status ?? ''); setError(result.job?.error ?? '');
        if (result.job?.status === 'queued' || result.job?.status === 'running') timer = setTimeout(() => { void poll(); }, 2000);
      } catch (cause) { if (active) setError(messageOf(cause)); }
    }
    setFile(null); setStatus(''); setError(''); void poll();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [kind, scope, sourceId, refreshKey]);

  async function generate() {
    setBusy(true); setError('');
    try { await onGenerate(); setRefreshKey((value) => value + 1); }
    catch (cause) { setError(messageOf(cause)); }
    finally { setBusy(false); }
  }

  async function download() {
    if (!file) return;
    setBusy(true); setError('');
    try { const content = await downloadGeneratedFile(scope, file.id); await saveAndShareExport(content, file.filename, file.mimeType); }
    catch (cause) { setError(messageOf(cause)); }
    finally { setBusy(false); }
  }

  return <View style={styles.generatedFilePanel}>
    <View style={styles.warningHeading}><Files size={14} color={colors.primary} /><Text style={styles.rowTitle}>{label}</Text></View>
    <Text style={styles.mutedText}>{blocked ? 'Lưu thay đổi và tính lại dự toán trước khi tải hoặc tạo file.' : outdated ? 'Dữ liệu đã thay đổi sau lần xuất file gần nhất.' : file ? `Đã lưu: ${file.filename}` : status === 'queued' || status === 'running' ? 'ERP đang tạo file...' : status === 'failed' ? 'Lần tạo file gần nhất chưa thành công.' : 'Chưa có file đã lưu.'}</Text>
    {!!error && <Text style={styles.exportError}>{error}</Text>}
    <View style={styles.actionRow}>
      {file && !outdated && <Pressable disabled={busy || blocked} onPress={() => { void download(); }} style={[styles.secondaryButton, (busy || blocked) && styles.disabled]}><Files size={14} color={colors.primary} /><Text style={styles.secondaryText}>Tải / chia sẻ</Text></Pressable>}
      {canGenerate && <Pressable disabled={busy || blocked || status === 'queued' || status === 'running'} onPress={() => { void generate(); }} style={[styles.secondaryButton, (busy || blocked || status === 'queued' || status === 'running') && styles.disabled]}>{busy || status === 'queued' || status === 'running' ? <ActivityIndicator size="small" color={colors.primary} /> : <RefreshCw size={14} color={colors.primary} />}<Text style={styles.secondaryText}>{blocked ? 'Lưu thay đổi trước' : outdated ? 'Tạo file mới' : file ? 'Tạo lại file' : status === 'failed' ? 'Thử lại' : 'Tạo file'}</Text></Pressable>}
    </View>
  </View>;
}

export function BudgetPlannerPanel({ scope, canManage, canManageCatalog, canUseAi }: { scope: QuotationScope; canManage: boolean; canManageCatalog: boolean; canUseAi: boolean }) {
  const [plans, setPlans] = useState<SavedBudgetPlan[]>([]);
  const [selected, setSelected] = useState<SavedBudgetPlan | null>(null);
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [area, setArea] = useState('');
  const [floors, setFloors] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [answer, setAnswer] = useState<Record<string, string>>({});
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [assumptionEdits, setAssumptionEdits] = useState<Record<number, string>>({});
  const [missingSelections, setMissingSelections] = useState<Record<string, string>>({});
  const [missingQuantities, setMissingQuantities] = useState<Record<string, string>>({});
  const [newProducts, setNewProducts] = useState<Record<string, { sku: string; unit: string; price: string }>>({});
  const [exportTemplates, setExportTemplates] = useState<QuotationTemplate[]>([]);
  const [exportTemplateId, setExportTemplateId] = useState('none');
  const [filter, setFilter] = useState<'all' | 'in_budget' | 'over_budget'>('all');

  async function refresh() {
    setLoading(true);
    try { setPlans(await listBudgetPlans(scope)); setError(''); }
    catch (cause) { setError(messageOf(cause)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, [scope]);

  useEffect(() => {
    if (!selected) return;
    let live = true;
    void Promise.all([loadCatalog(scope), listAllQuoteTemplates(scope, 'estimate')]).then(([items, templates]) => {
      if (!live) return;
      setCatalog(items);
      setExportTemplates(templates);
      setExportTemplateId((current) => templates.some((item) => item.id === current) ? current : 'none');
    }).catch(() => { if (live) { setCatalog([]); setExportTemplates([]); } });
    return () => { live = false; };
  }, [scope, selected?.id]);

  const stats = useMemo(() => ({
    inBudget: plans.filter((plan) => plan.result.difference !== null && plan.result.difference >= 0).length,
    overBudget: plans.filter((plan) => plan.result.difference !== null && plan.result.difference < 0).length,
    totalBudget: plans.reduce((sum, plan) => sum + plan.input.budget, 0),
  }), [plans]);
  const visible = useMemo(() => plans.filter((plan) => {
    const contentMatches = `${plan.input.description} ${plan.result.scope} ${plan.id} ${plan.input.budget}`.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi'));
    const over = plan.result.difference !== null && plan.result.difference < 0;
    return contentMatches && (filter === 'all' || (filter === 'over_budget' ? over : plan.result.difference !== null && !over));
  }), [plans, search, filter]);

  async function create() {
    const amount = Number(budget.replace(/[,.\s]/g, ''));
    if (!canManage) { setError('Cần quyền quotation:manage để lập phương án.'); return; }
    const areaValue = area.trim() ? Number(area) : undefined;
    const floorValue = floors.trim() ? Number(floors) : undefined;
    if (!description.trim() || !Number.isFinite(amount) || amount <= 0 || (areaValue !== undefined && (!Number.isFinite(areaValue) || areaValue <= 0)) || (floorValue !== undefined && (!Number.isInteger(floorValue) || floorValue <= 0))) { setError('Nhập mô tả, ngân sách và quy mô hợp lệ.'); return; }
    setBusy('create'); setError('');
    try {
      const plan = await createBudgetPlan(scope, description.trim(), amount, areaValue, floorValue);
      setPlans((current) => [plan, ...current.filter((item) => item.id !== plan.id)]);
      setSelected(plan); setDescription(''); setBudget(''); setArea(''); setFloors('');
    } catch (cause) { setError(messageOf(cause)); }
    finally { setBusy(''); }
  }

  async function saveChange(key: string, change: Record<string, unknown>) {
    if (!selected) return;
    setBusy(key); setError('');
    try {
      const next = await updateBudgetPlan(scope, selected.id, change);
      setSelected(next); setPlans((current) => current.map((item) => item.id === next.id ? next : item));
      if (change.action === 'answer') setAnswer((current) => ({ ...current, [String(change.question)]: '' }));
    } catch (cause) { setError(messageOf(cause)); }
    finally { setBusy(''); }
  }

  return <View style={styles.container}>
    <ScrollView contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Card style={styles.formCard}>
        <Text style={styles.sectionTitle}>Lập phương án sơ bộ</Text>
        <TextInput value={description} onChangeText={setDescription} style={[styles.input, styles.multiline]} placeholder="Mô tả mục tiêu, phạm vi và yêu cầu..." placeholderTextColor={colors.muted} multiline maxLength={5000} />
        <TextInput value={budget} onChangeText={setBudget} style={styles.input} placeholder="Ngân sách dự kiến" placeholderTextColor={colors.muted} keyboardType="decimal-pad" />
        <View style={styles.twoColumns}><Field label="Diện tích (m², không bắt buộc)" value={area} onChangeText={setArea} keyboardType="decimal-pad" /><Field label="Số tầng (không bắt buộc)" value={floors} onChangeText={setFloors} keyboardType="number-pad" /></View>
        <Pressable disabled={!canManage || !canUseAi || busy === 'create'} onPress={() => { void create(); }} style={[styles.primaryButton, (!canManage || !canUseAi || busy === 'create') && styles.disabled]}>{busy === 'create' ? <ActivityIndicator size="small" color={colors.white} /> : <CircleDollarSign size={16} color={colors.white} />}<Text style={styles.primaryText}>{!canManage ? 'Cần quyền quotation:manage' : !canUseAi ? 'Cần quyền quotation-ai:manage' : busy === 'create' ? 'Đang tư vấn...' : 'Tạo phương án bằng AI'}</Text></Pressable>
      </Card>

      {!!error && <Card style={styles.errorCard}><CircleAlert size={16} color="#B54745" /><Text style={styles.errorText}>{error}</Text></Card>}

      {selected && <Card style={styles.detailCard}>
        <View style={styles.detailTitleRow}><View style={styles.detailTitleCopy}><Text style={styles.sectionTitle}>Phương án đang xem</Text><Text style={styles.mutedText}>{selected.input.description}</Text></View><Pressable onPress={() => { setSelected(null); }}><X size={18} color={colors.muted} /></Pressable></View>
        <View style={styles.budgetTotals}><View><Text style={styles.metaLabel}>Ngân sách</Text><Text style={styles.metric}>{money(selected.input.budget, selected.result.currency)}</Text></View><View><Text style={styles.metaLabel}>Dự toán</Text><Text style={styles.metric}>{selected.result.total === null ? 'Chưa đủ dữ liệu' : money(selected.result.total, selected.result.currency)}</Text></View><View><Text style={styles.metaLabel}>Chênh lệch</Text><Text style={[styles.metric, selected.result.difference !== null && selected.result.difference < 0 ? styles.dangerText : styles.successText]}>{selected.result.difference === null ? 'Chưa xác định' : money(selected.result.difference, selected.result.currency)}</Text></View></View>
        {selected.result.lines.map((line: BudgetLine) => <View key={line.catalogItemId} style={styles.budgetLine}><View style={styles.budgetLineCopy}><Text style={styles.rowTitle}>{line.name}</Text><Text style={styles.mutedText}>{line.sku} · {money(line.unitPrice, line.currency)} / {line.unit}</Text><Text style={styles.mutedText}>{line.reason}{line.quantityNote ? ` · ${line.quantityNote}` : ''}</Text></View><View style={styles.quantityEditor}><TextInput value={quantities[line.catalogItemId] ?? String(line.quantity ?? '')} onChangeText={(value) => setQuantities((current) => ({ ...current, [line.catalogItemId]: value }))} keyboardType="decimal-pad" style={styles.quantityInput} placeholder="SL" placeholderTextColor={colors.muted} /><Pressable disabled={!canManage || busy === line.catalogItemId} onPress={() => { void saveChange(line.catalogItemId, { action: 'quantity', catalogItemId: line.catalogItemId, quantity: Number(quantities[line.catalogItemId] ?? line.quantity) }); }} style={[styles.smallButton, !canManage && styles.disabled]}><Check size={14} color={colors.primary} /></Pressable></View><Text style={styles.lineTotal}>{line.lineTotal === null ? 'Chưa tính' : money(line.lineTotal, line.currency)}</Text></View>)}
        {!!selected.result.questions.length && <View style={styles.subSection}><Text style={styles.sectionTitle}>Cần bạn xác nhận</Text>{selected.result.questions.map((question) => <View key={question} style={styles.questionCard}><Text style={styles.rowTitle}>{question}</Text><TextInput value={answer[question] ?? ''} onChangeText={(value) => setAnswer((current) => ({ ...current, [question]: value }))} style={styles.input} placeholder="Nhập câu trả lời..." placeholderTextColor={colors.muted} /><Pressable disabled={!canManage || !canUseAi || !answer[question]?.trim() || Boolean(busy)} onPress={() => { void saveChange(question, { action: 'answer', question, answer: answer[question] }); }} style={[styles.secondaryButton, (!canManage || !canUseAi || !answer[question]?.trim() || Boolean(busy)) && styles.disabled]}><Text style={styles.secondaryText}>Lưu và tính lại bằng AI</Text></Pressable></View>)}</View>}
        {!!selected.result.missingProducts.length && <View style={styles.subSection}><Text style={styles.sectionTitle}>Cần bổ sung vào bảng giá</Text>{selected.result.missingProducts.map((name) => {
          const candidates = catalog.filter((item) => `${item.name} ${item.sku}`.toLocaleLowerCase('vi').includes(name.toLocaleLowerCase('vi').trim()) || name.toLocaleLowerCase('vi').includes(item.name.toLocaleLowerCase('vi'))).slice(0, 8);
          const selection = missingSelections[name] ?? '';
          const draft = newProducts[name] ?? { sku: '', unit: '', price: '' };
          return <View key={name} style={styles.questionCard}><Text style={styles.rowTitle}>{name}</Text>
            {!!candidates.length && <View style={styles.choiceList}>{candidates.map((item) => <Pressable key={item._id} onPress={() => setMissingSelections((current) => ({ ...current, [name]: item._id }))} style={[styles.choiceRow, selection === item._id && styles.choiceSelected]}><Text numberOfLines={1} style={styles.rowTitle}>{item.sku} · {item.name} · {money(item.price, item.currency)}</Text>{selection === item._id && <Check size={13} color={colors.primary} />}</Pressable>)}</View>}
            {!!selection && <TextInput value={missingQuantities[name] ?? ''} onChangeText={(value) => setMissingQuantities((current) => ({ ...current, [name]: value }))} keyboardType="decimal-pad" style={styles.input} placeholder="Số lượng (không bắt buộc)" placeholderTextColor={colors.muted} />}
            <Pressable disabled={!canManage || !selection || busy === `missing-${name}`} onPress={() => { void saveChange(`missing-${name}`, { action: 'missing', name, catalogItemId: selection, quantity: missingQuantities[name] ? Number(missingQuantities[name]) : null }); }} style={[styles.secondaryButton, (!canManage || !selection) && styles.disabled]}><Check size={14} color={colors.primary} /><Text style={styles.secondaryText}>Dùng sản phẩm đã có</Text></Pressable>
            {canManageCatalog && <View style={styles.subSection}><Text style={styles.mutedText}>Hoặc thêm sản phẩm mới vào bảng giá</Text><View style={styles.twoColumns}><Field label="SKU mới *" value={draft.sku} onChangeText={(value) => setNewProducts((current) => ({ ...current, [name]: { ...draft, sku: value } }))} /><Field label="Đơn vị *" value={draft.unit} onChangeText={(value) => setNewProducts((current) => ({ ...current, [name]: { ...draft, unit: value } }))} /></View><Field label="Đơn giá *" value={draft.price} onChangeText={(value) => setNewProducts((current) => ({ ...current, [name]: { ...draft, price: value } }))} keyboardType="decimal-pad" /><Pressable disabled={!canManage || !draft.sku.trim() || !draft.unit.trim() || !draft.price.trim() || Boolean(busy)} onPress={() => { void saveChange(`new-${name}`, { action: 'missing', name, quantity: missingQuantities[name] ? Number(missingQuantities[name]) : null, newProduct: { sku: draft.sku.trim(), name, unit: draft.unit.trim(), price: Number(draft.price), active: true } }); }} style={[styles.secondaryButton, (!draft.sku.trim() || !draft.unit.trim() || !draft.price.trim()) && styles.disabled]}><Plus size={14} color={colors.primary} /><Text style={styles.secondaryText}>Thêm vào bảng giá và phương án</Text></Pressable></View>}
          </View>;
        })}</View>}
        {!!selected.result.assumptions.length && <View style={styles.subSection}><Text style={styles.sectionTitle}>Xác nhận giả định</Text>{selected.result.assumptions.map((item, index) => <View key={`${index}-${item}`} style={styles.questionCard}><TextInput value={assumptionEdits[index] ?? item} onChangeText={(value) => setAssumptionEdits((current) => ({ ...current, [index]: value }))} style={styles.input} multiline placeholder="Giả định" placeholderTextColor={colors.muted} /><Pressable disabled={!canManage || Boolean(busy) || !(assumptionEdits[index] ?? item).trim() || (selected.result.assumptionConfirmations?.[index] === true && (assumptionEdits[index] ?? item) === item)} onPress={() => { void saveChange(`assumption-${index}`, { action: 'assumption', index, text: (assumptionEdits[index] ?? item).trim() }); }} style={[styles.secondaryButton, (!canManage || !(assumptionEdits[index] ?? item).trim()) && styles.disabled]}><Check size={14} color={colors.primary} /><Text style={styles.secondaryText}>{selected.result.assumptionConfirmations?.[index] ? 'Đã xác nhận' : 'Xác nhận giả định'}</Text></Pressable></View>)}</View>}
        <View style={styles.actionRow}><Pressable disabled={!canManage || !canUseAi || Boolean(busy)} onPress={() => { void saveChange('recalculate', { action: 'recalculate' }); }} style={[styles.secondaryButton, (!canManage || !canUseAi || Boolean(busy)) && styles.disabled]}><RefreshCw size={14} color={colors.primary} /><Text style={styles.secondaryText}>Tính lại bằng AI</Text></Pressable></View>
        <Text style={styles.fieldLabel}>Mẫu xuất</Text><View style={styles.choiceList}><Pressable onPress={() => setExportTemplateId('none')} style={[styles.choiceRow, exportTemplateId === 'none' && styles.choiceSelected]}><Text style={styles.rowTitle}>Mẫu mặc định (Excel)</Text>{exportTemplateId === 'none' && <Check size={13} color={colors.primary} />}</Pressable>{exportTemplates.map((item) => <Pressable key={item.id} onPress={() => setExportTemplateId(item.id)} style={[styles.choiceRow, exportTemplateId === item.id && styles.choiceSelected]}><Text style={styles.rowTitle}>{item.name || item.originalFilename}</Text>{exportTemplateId === item.id && <Check size={13} color={colors.primary} />}</Pressable>)}</View>
        <GeneratedFileActions key={`budget-${selected.id}`} scope={scope} sourceId={selected.id} kind="budget" updatedAt={selected.updatedAt} label="File phương án ngân sách" canGenerate={canUseAi} onGenerate={() => queueBudgetExport(scope, selected.id, exportTemplateId)} />
      </Card>}

      <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Lịch sử phương án ({plans.length})</Text><Text style={styles.mutedText}>Trong ngân sách: {stats.inBudget} · Vượt ngân sách: {stats.overBudget} · Tổng ngân sách: {money(stats.totalBudget)}</Text></View><Pressable onPress={() => { void refresh(); }}><RefreshCw size={16} color={colors.primary} /></Pressable></View>
      <View style={styles.searchBox}><Search size={15} color={colors.muted} /><TextInput value={search} onChangeText={setSearch} style={styles.searchInput} placeholder="Tìm phương án..." placeholderTextColor={colors.muted} /></View>
      <View style={styles.chipWrap}>{([{ value: 'all', label: 'Tất cả' }, { value: 'in_budget', label: 'Trong ngân sách' }, { value: 'over_budget', label: 'Vượt ngân sách' }] as const).map((item) => <Pressable key={item.value} onPress={() => setFilter(item.value)} style={[styles.chip, filter === item.value && styles.chipActive]}><Text style={[styles.chipText, filter === item.value && styles.chipTextActive]}>{item.label}</Text></Pressable>)}</View>
      {loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : visible.map((plan) => <Card key={plan.id} onPress={() => setSelected(plan)} style={styles.planRow}><View style={styles.rowIcon}><CircleDollarSign size={16} color={colors.primary} /></View><View style={styles.rowCopy}><Text numberOfLines={2} style={styles.rowTitle}>{plan.input.description}</Text><Text style={styles.mutedText}>{money(plan.input.budget, plan.result.currency)} · {date(plan.createdAt)}</Text></View><Text style={styles.rowMetric}>{plan.result.difference === null ? 'Đang xử lý' : plan.result.difference >= 0 ? 'Trong ngân sách' : 'Vượt ngân sách'}</Text><ChevronRight size={15} color={colors.muted} /></Card>)}
      {!loading && visible.length === 0 && <EmptyState text="Chưa có phương án ngân sách." />}
    </ScrollView>
  </View>;
}

const templateCategories: Array<{ value: TemplateCategory; label: string }> = [
  { value: 'quote', label: 'Báo giá' }, { value: 'estimate', label: 'Dự toán' }, { value: 'contract', label: 'Hợp đồng' }, { value: 'acceptance', label: 'Nghiệm thu' }, { value: 'settlement', label: 'Quyết toán' },
];

export function QuoteTemplatePanel({ scope, canManage }: { scope: QuotationScope; canManage: boolean }) {
  const [category, setCategory] = useState<TemplateCategory>('quote');
  const [templates, setTemplates] = useState<QuotationTemplate[]>([]);
  const [defaultTemplateId, setDefaultTemplateId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [movingId, setMovingId] = useState('');
  const [downloadingId, setDownloadingId] = useState('');

  async function refresh() {
    setLoading(true);
    try {
      if (category === 'quote' || category === 'estimate') {
        const result = await loadQuoteTemplates(scope, category);
        setTemplates(result.templates); setDefaultTemplateId(result.defaultTemplateId);
      } else {
        const items = await listAllQuoteTemplates(scope, category);
        setTemplates(items); setDefaultTemplateId(items[0]?.id ?? null);
      }
      setError('');
    }
    catch (cause) { setError(messageOf(cause)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, [scope, category]);

  const visible = useMemo(() => templates.filter((item) => `${item.name} ${item.originalFilename} ${item.extension}`.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi'))), [templates, search]);

  async function upload() {
    if (!canManage || busy) return;
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: category === 'contract' || category === 'acceptance' ? ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'] : ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], copyToCacheDirectory: true });
      if (picked.canceled) return;
      const asset = picked.assets[0];
      if (!asset || (asset.size && asset.size > 10 * 1024 * 1024)) { Alert.alert('File mẫu không hợp lệ', 'Chọn file Word, Excel hoặc PDF tối đa 10 MB.'); return; }
      setBusy(true); setError('');
      const blob = await fetch(asset.uri).then((response) => response.blob());
      const filename = asset.name || 'mau-bao-gia';
      const name = filename.replace(/\.[^.]+$/, '');
      await uploadQuotationTemplate(scope, { file: blob, filename, name, category });
      await refresh();
    } catch (cause) { setError(messageOf(cause)); }
    finally { setBusy(false); }
  }

  function remove(item: QuotationTemplate) {
    showHrConfirm({
      title: 'Xóa mẫu tài liệu?',
      message: `${item.name || item.originalFilename} sẽ bị xóa khỏi danh sách mẫu.`,
      confirmLabel: 'Xóa',
      onConfirm: async () => {
        try {
          await deleteQuotationTemplate(scope, item.id);
          await refresh();
        } catch (cause) {
          setError(messageOf(cause));
        }
      },
    });
  }

  async function move(item: QuotationTemplate, next: TemplateCategory) {
    setMovingId(item.id); setError('');
    try { await moveQuotationTemplate(scope, item.id, next); await refresh(); }
    catch (cause) { setError(messageOf(cause)); }
    finally { setMovingId(''); }
  }

  async function downloadTemplate(item: QuotationTemplate) {
    setDownloadingId(item.id); setError('');
    try { const blob = await downloadQuotationTemplate(scope, item.id); await saveAndShareExport(blob, item.originalFilename, blob.type); }
    catch (cause) { setError(messageOf(cause)); }
    finally { setDownloadingId(''); }
  }

  return <View style={styles.container}><ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
    <PanelTopAction action={canManage ? { label: busy ? 'Đang tải' : 'Tải mẫu', disabled: busy, onPress: () => { void upload(); } } : undefined} />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{templateCategories.map((item) => <Pressable key={item.value} onPress={() => { setCategory(item.value); setSearch(''); }} style={[styles.chip, category === item.value && styles.chipActive]}><Text style={[styles.chipText, category === item.value && styles.chipTextActive]}>{item.label}</Text></Pressable>)}</ScrollView>
    <View style={styles.searchBox}><Search size={15} color={colors.muted} /><TextInput value={search} onChangeText={setSearch} style={styles.searchInput} placeholder="Tìm theo tên file..." placeholderTextColor={colors.muted} /><Pressable onPress={() => { void refresh(); }}><RefreshCw size={15} color={colors.primary} /></Pressable></View>
    {!!error && <ErrorCard error={error} />}
    {loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : visible.map((item) => <View key={item.id} style={styles.templateRow}><View style={styles.rowIcon}><FileText size={16} color={colors.primary} /></View><View style={styles.rowCopy}><Text numberOfLines={1} style={styles.rowTitle}>{item.name || item.originalFilename}</Text><Text style={styles.mutedText}>{item.extension.toUpperCase()} · {Math.ceil((item.bytes ?? 0) / 1024)} KB · {date(item.createdAt)}</Text>{item.originalFilename !== item.name && <Text style={styles.mutedText}>{item.originalFilename}</Text>}{item.id === defaultTemplateId && <View style={styles.defaultBadge}><BadgeCheck size={12} color="#16885A" /><Text style={styles.defaultBadgeText}>{category === 'quote' ? 'Mặc định' : 'Mới nhất'}</Text></View>}</View><Pressable disabled={downloadingId === item.id} onPress={() => { void downloadTemplate(item); }} style={styles.iconButton}>{downloadingId === item.id ? <ActivityIndicator size="small" color={colors.primary} /> : <Download size={15} color={colors.primary} />}</Pressable>{canManage && <Pressable onPress={() => setMovingId(movingId === item.id ? '' : item.id)} style={styles.iconButton}><Files size={15} color={colors.muted} /></Pressable>}{canManage && <Pressable onPress={() => remove(item)} style={styles.iconButton}><Trash2 size={15} color="#B54745" /></Pressable>}</View>)}
    {movingId && templates.some((item) => item.id === movingId) && <Card style={styles.moveCard}><Text style={styles.rowTitle}>Chuyển mẫu sang nhóm</Text><View style={styles.chipWrap}>{templateCategories.filter((item) => item.value !== category).map((item) => <Pressable key={item.value} onPress={() => { const template = templates.find((entry) => entry.id === movingId); if (template) void move(template, item.value); }} style={styles.chip}><Text style={styles.chipText}>{item.label}</Text></Pressable>)}</View></Card>}
    {!loading && !visible.length && <EmptyState text="Chưa có mẫu trong nhóm này." />}
  </ScrollView></View>;
}

type CatalogStatus = 'all' | 'active' | 'upcoming' | 'expired' | 'inactive' | 'deleted';
type CatalogSort = 'default' | 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc';
const catalogStatuses: Array<{ value: CatalogStatus; label: string }> = [
  { value: 'all', label: 'Tất cả' }, { value: 'active', label: 'Đang áp dụng' }, { value: 'upcoming', label: 'Chưa hiệu lực' }, { value: 'expired', label: 'Hết hiệu lực' }, { value: 'inactive', label: 'Ngừng áp dụng' }, { value: 'deleted', label: 'Đã xóa' },
];
const catalogSortOptions: Array<{ value: CatalogSort; label: string }> = [
  { value: 'default', label: 'Mặc định' }, { value: 'name_asc', label: 'Tên A → Z' }, { value: 'name_desc', label: 'Tên Z → A' }, { value: 'price_asc', label: 'Giá thấp đến cao' }, { value: 'price_desc', label: 'Giá cao đến thấp' },
];
function catalogStatusKey(item: CatalogItem, currentDate: string): CatalogStatus {
  if (item.deletedAt) return 'deleted';
  if (!item.active) return 'inactive';
  if (item.effectiveFrom && item.effectiveFrom > currentDate) return 'upcoming';
  if (item.effectiveTo && item.effectiveTo < currentDate) return 'expired';
  return 'active';
}
function catalogStatusLabel(item: CatalogItem, currentDate: string) {
  return catalogStatuses.find((entry) => entry.value === catalogStatusKey(item, currentDate))?.label ?? 'Đang áp dụng';
}
function excelColumn(index: number) {
  let label = '';
  for (let current = index; current >= 0; current = Math.floor(current / 26) - 1) label = String.fromCharCode((current % 26) + 65) + label;
  return label;
}
function xmlText(value: unknown) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
function makeCatalogWorkbook(rows: Array<Record<string, string | number>>, headers: string[]) {
  const table = [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ''))];
  const columnWidths = headers.map((header) => Math.min(Math.max(header.length, ...rows.slice(0, 200).map((row) => String(row[header] ?? '').length)) + 2, 50));
  const columns = `<cols>${columnWidths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('')}</cols>`;
  const sheetRows = table.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => {
    const cellRef = `${excelColumn(columnIndex)}${rowIndex + 1}`;
    return typeof value === 'number' && Number.isFinite(value)
      ? `<c r="${cellRef}"><v>${value}</v></c>`
      : `<c r="${cellRef}" t="inlineStr"><is><t xml:space="preserve">${xmlText(value)}</t></is></c>`;
  }).join('')}</row>`).join('');
  const lastCell = `${excelColumn(Math.max(headers.length - 1, 0))}${table.length}`;
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
    'xl/workbook.xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Bảng giá" sheetId="1" r:id="rId1"/></sheets></workbook>'),
    'xl/_rels/workbook.xml.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'),
    'xl/worksheets/sheet1.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lastCell}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/>${columns}<sheetData>${sheetRows}</sheetData><autoFilter ref="A1:${lastCell}"/></worksheet>`),
  };
  return zipSync(files, { level: 6 });
}

export function CatalogPanel({ scope, canManage }: { scope: QuotationScope; canManage: boolean }) {
  const [status, setStatus] = useState<CatalogStatus>('active');
  const [sortBy, setSortBy] = useState<CatalogSort>('default');
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [priceLists, setPriceLists] = useState<Array<{ _id: string; originalFilename: string; bytes: number; updatedAt?: string; productCount?: number; skippedRows?: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<CatalogItem | 'new' | null>(null);
  const [duplicateSource, setDuplicateSource] = useState<CatalogItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkPriceOpen, setBulkPriceOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<{ filename: string; file: Blob; sheets: Array<PriceListSheetPreview & { included: boolean; roles: PriceListColumnRole[] }> } | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [downloadingPriceList, setDownloadingPriceList] = useState('');
  const [exporting, setExporting] = useState(false);

  async function refresh() {
    setLoading(true);
    setLoadingMore(false);
    try {
      const [catalog, lists] = await Promise.all([listCatalogItemsPage(scope, 1, 'all', true), loadPriceLists(scope)]);
      setItems(catalog.items); setNextPage(catalog.nextPage); setPriceLists(lists); setError(''); setSelectedIds([]);
    } catch (cause) { setError(messageOf(cause)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, [scope]);

  async function loadMore() {
    if (loading || loadingMore || nextPage === null) return;
    setLoadingMore(true);
    setError('');
    try {
      const result = await listCatalogItemsPage(scope, nextPage, 'all', true);
      setItems((current) => {
        const loadedIds = new Set(current.map((item) => item._id));
        return [...current, ...result.items.filter((item) => !loadedIds.has(item._id))];
      });
      setNextPage(result.nextPage);
    } catch (cause) { setError(messageOf(cause)); }
    finally { setLoadingMore(false); }
  }

  const currentDate = today();
  const filtered = useMemo(() => {
    let result = items.filter((item) => status === 'deleted' ? Boolean(item.deletedAt) : !item.deletedAt);
    if (status !== 'all') result = result.filter((item) => catalogStatusKey(item, currentDate) === status);
    const query = search.trim().toLocaleLowerCase('vi');
    if (query) result = result.filter((item) => `${item.sku} ${item.name} ${item.description ?? ''} ${item.unit} ${Object.entries(item.attributes ?? {}).flat().join(' ')}`.toLocaleLowerCase('vi').includes(query));
    if (sortBy === 'name_asc') result = [...result].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    if (sortBy === 'name_desc') result = [...result].sort((a, b) => b.name.localeCompare(a.name, 'vi'));
    if (sortBy === 'price_asc') result = [...result].sort((a, b) => a.price - b.price);
    if (sortBy === 'price_desc') result = [...result].sort((a, b) => b.price - a.price);
    return result;
  }, [currentDate, items, search, sortBy, status]);
  useEffect(() => { setSelectedIds([]); }, [search, sortBy, status]);

  function chooseSort() {
    Alert.alert('Sắp xếp sản phẩm', 'Chọn cách hiển thị bảng giá.', [
      ...catalogSortOptions.map((item) => ({ text: `${sortBy === item.value ? '✓ ' : ''}${item.label}`, onPress: () => setSortBy(item.value) })),
      { text: 'Hủy', style: 'cancel' },
    ]);
  }

  async function exportExcel(selectionOnly = false) {
    if (exporting) return;
    setExporting(true); setError('');
    try {
      const source = selectionOnly ? filtered.filter((item) => selectedIds.includes(item._id)) : await listCatalogItems(scope, 'all', true);
      let exportedProducts = source.filter((item) => status === 'deleted' ? Boolean(item.deletedAt) : !item.deletedAt);
      if (status !== 'all') exportedProducts = exportedProducts.filter((item) => catalogStatusKey(item, currentDate) === status);
      const query = search.trim().toLocaleLowerCase('vi');
      if (query) exportedProducts = exportedProducts.filter((item) => `${item.sku} ${item.name} ${item.description ?? ''} ${item.unit} ${Object.entries(item.attributes ?? {}).flat().join(' ')}`.toLocaleLowerCase('vi').includes(query));
      if (sortBy === 'name_asc') exportedProducts = [...exportedProducts].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
      if (sortBy === 'name_desc') exportedProducts = [...exportedProducts].sort((a, b) => b.name.localeCompare(a.name, 'vi'));
      if (sortBy === 'price_asc') exportedProducts = [...exportedProducts].sort((a, b) => a.price - b.price);
      if (sortBy === 'price_desc') exportedProducts = [...exportedProducts].sort((a, b) => b.price - a.price);
      if (!exportedProducts.length) { Alert.alert('Không có sản phẩm', 'Không có sản phẩm phù hợp với bộ lọc hiện tại.'); return; }
      const attributeKeys = [...new Set(exportedProducts.flatMap((item) => Object.keys(item.attributes ?? {})))];
      const headers = ['Mã hàng', 'Tên sản phẩm', 'Quy cách / mô tả', 'Đơn vị', 'Đơn giá', 'Tiền tệ', 'Trạng thái', 'Hiệu lực từ', 'Hiệu lực đến', ...attributeKeys.map((key) => `Thuộc tính: ${key}`)];
      const rows: Array<Record<string, string | number>> = exportedProducts.map((item) => ({
        'Mã hàng': item.sku, 'Tên sản phẩm': item.name, 'Quy cách / mô tả': item.description ?? '', 'Đơn vị': item.unit,
        'Đơn giá': item.price, 'Tiền tệ': item.currency, 'Trạng thái': catalogStatusLabel(item, currentDate),
        'Hiệu lực từ': item.effectiveFrom ?? '', 'Hiệu lực đến': item.effectiveTo ?? '',
        ...Object.fromEntries(attributeKeys.map((key) => [`Thuộc tính: ${key}`, item.attributes?.[key] ?? ''])),
      }));
      const bytes = makeCatalogWorkbook(rows, headers);
      const filename = `bang-gia-${currentDate}${selectionOnly ? '-da-chon' : ''}.xlsx`;
      await saveAndShareExport(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      Alert.alert('Đã xuất Excel', `${exportedProducts.length} sản phẩm đã được xuất theo bộ lọc hiện tại.`);
    } catch (cause) { setError(messageOf(cause)); }
    finally { setExporting(false); }
  }

  async function saveDraft(draft: CatalogDraft) {
    setError('');
    try {
      const parsedAttributes = Object.fromEntries(draft.attributes.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => { const [key, ...value] = line.split('='); return [key.trim(), value.join('=').trim()]; }).filter(([key, value]) => key && value));
      const values = { sku: draft.sku.trim(), name: draft.name.trim(), description: draft.description.trim(), unit: draft.unit.trim(), price: Number(draft.price), currency: draft.currency.trim().toUpperCase() || 'VND', active: duplicateSource ? false : draft.active, effectiveFrom: draft.effectiveFrom || undefined, effectiveTo: draft.effectiveTo || undefined, attributes: parsedAttributes };
      if (!values.sku || !values.name || !values.unit || !Number.isFinite(values.price) || values.price < 0) throw new Error('Nhập mã, tên, đơn vị và đơn giá hợp lệ.');
      if (duplicateSource) await duplicateCatalogItem(scope, duplicateSource, values);
      else if (editor !== 'new' && editor?._id) await updateCatalogItem(scope, editor, values);
      else await createCatalogItem(scope, values);
      setEditor(null); setDuplicateSource(null); await refresh();
    } catch (cause) { setError(messageOf(cause)); }
  }

  function remove(item: CatalogItem) {
    showHrConfirm({
      title: 'Xóa mềm sản phẩm?',
      message: `${item.sku} · ${item.name} sẽ được chuyển sang mục Đã xóa.`,
      confirmLabel: 'Xóa',
      onConfirm: async () => {
        try {
          await changeCatalogItemState(scope, item, 'delete');
          await refresh();
        } catch (cause) {
          setError(messageOf(cause));
        }
      },
    });
  }

  async function toggleActive(item: CatalogItem) {
    try { await updateCatalogItem(scope, item, { active: !item.active }); await refresh(); }
    catch (cause) { setError(messageOf(cause)); }
  }

  async function restore(item: CatalogItem) {
    try { await changeCatalogItemState(scope, item, 'restore'); await refresh(); }
    catch (cause) { setError(messageOf(cause)); }
  }

  async function runBulkAction(action: 'activate' | 'deactivate' | 'delete' | 'restore' | 'price', adjustment?: { mode: 'amount' | 'percent'; value: number }) {
    const selected = filtered.filter((item) => selectedIds.includes(item._id));
    if (!selected.length) return;
    setBulkBusy(true); setError('');
    try {
      const preview = await previewCatalogBulk(scope, action, selected, adjustment);
      const changes = preview.rows.slice(0, 4).map((row) => `${row.sku}: ${money(Number(row.before.price), row.currency)} → ${money(Number(row.after.price), row.currency)}`).join('\n');
      const labels = { activate: 'sẽ được kích hoạt', deactivate: 'sẽ ngừng áp dụng', delete: 'sẽ chuyển vào mục đã xóa', restore: 'sẽ được khôi phục', price: 'sẽ được điều chỉnh giá' };
      Alert.alert('Xem trước thao tác', `${preview.rows.length} sản phẩm ${labels[action]}.${changes ? `\n\n${changes}${preview.rows.length > 4 ? '\n…' : ''}` : ''}`, [
        { text: 'Hủy', style: 'cancel', onPress: () => setBulkBusy(false) },
        { text: 'Áp dụng', style: action === 'delete' ? 'destructive' : 'default', onPress: () => { void applyCatalogBulk(scope, action, selected, preview.previewHash, adjustment).then(async () => { await refresh(); Alert.alert('Đã cập nhật bảng giá', `${selected.length} sản phẩm đã được cập nhật.`); }).catch((cause) => setError(messageOf(cause))).finally(() => setBulkBusy(false)); } },
      ]);
    } catch (cause) { setError(messageOf(cause)); setBulkBusy(false); }
  }

  async function choosePriceList() {
    if (!canManage || importBusy) return;
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'], copyToCacheDirectory: true });
      if (picked.canceled) return;
      const asset = picked.assets[0];
      if (!asset || (asset.size && asset.size > 5 * 1024 * 1024) || !/\.(csv|xlsx|xls)$/i.test(asset?.name ?? '')) { Alert.alert('File bảng giá không hợp lệ', 'Chọn file CSV, XLSX hoặc XLS tối đa 5 MB.'); return; }
      setImportBusy(true); setError('');
      const blob = await fetch(asset.uri).then((response) => response.blob());
      const result = await previewPriceList(scope, blob, asset.name);
      const sheets = result.preview.sheets.map((sheet) => {
        const header = sheet.headerRows.find((row) => row.row === sheet.headerRow);
        const roles = header?.roles ?? [];
        return { ...sheet, roles, included: roles.includes('name') && roles.includes('price') };
      });
      if (!sheets.length) throw new Error('Không tìm thấy sheet có thể nhập trong file này.');
      setPendingImport({ filename: asset.name, file: blob, sheets });
    } catch (cause) { setError(messageOf(cause)); }
    finally { setImportBusy(false); }
  }

  async function downloadPriceList(file: { _id: string; originalFilename: string }) {
    setDownloadingPriceList(file._id); setError('');
    try { const blob = await downloadPriceListFile(scope, file._id); await saveAndShareExport(blob, file.originalFilename, blob.type); }
    catch (cause) { setError(messageOf(cause)); }
    finally { setDownloadingPriceList(''); }
  }

  function updateImportSheet(sheetName: string, update: (sheet: PriceListSheetPreview & { included: boolean; roles: PriceListColumnRole[] }) => PriceListSheetPreview & { included: boolean; roles: PriceListColumnRole[] }) {
    setPendingImport((current) => current ? { ...current, sheets: current.sheets.map((sheet) => sheet.sheet === sheetName ? update(sheet) : sheet) } : current);
  }

  async function confirmPriceListImport() {
    if (!pendingImport || importBusy || !canManage) return;
    const selected = pendingImport.sheets.filter((sheet) => sheet.included);
    if (!selected.length || selected.some((sheet) => {
      const requiredRoles = sheet.roles.filter((role) => role === 'name' || role === 'price');
      const uniqueRoles = sheet.roles.filter((role) => role !== 'attribute' && role !== 'ignore');
      return requiredRoles.filter((role) => role === 'name').length !== 1 || requiredRoles.filter((role) => role === 'price').length !== 1 || new Set(uniqueRoles).size !== uniqueRoles.length || sheet.roles.filter((role) => role === 'attribute').length > 50;
    })) { Alert.alert('Cần ghép cột bảng giá', 'Chọn ít nhất một sheet, ghép đúng một cột tên và đơn giá; mỗi cột dữ liệu chỉ dùng một lần.'); return; }
    setImportBusy(true); setError('');
    try {
      const result = await importPriceList(scope, pendingImport.file, pendingImport.filename, selected.map((sheet) => ({ sheet: sheet.sheet, headerRow: sheet.headerRow, roles: sheet.roles })));
      setPendingImport(null);
      await refresh();
      Alert.alert('Đã nhập bảng giá', `Thêm ${result.imported.inserted}, cập nhật ${result.imported.updated}${result.imported.skippedRows ? `, bỏ qua ${result.imported.skippedRows} dòng` : ''}.`);
    } catch (cause) { setError(messageOf(cause)); }
    finally { setImportBusy(false); }
  }

  return <View style={styles.container}><ScrollView contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
    <View style={styles.catalogToolbar}>
      {canManage && <Pressable onPress={() => { setDuplicateSource(null); setEditor('new'); }} style={styles.secondaryButton}><Plus size={14} color={colors.primary} /><Text style={styles.secondaryText}>Thêm sản phẩm</Text></Pressable>}
      <Pressable disabled={exporting || loading} onPress={() => { void exportExcel(); }} style={[styles.secondaryButton, (exporting || loading) && styles.disabled]}>{exporting ? <ActivityIndicator size="small" color={colors.primary} /> : <FileSpreadsheet size={14} color={colors.primary} />}<Text style={styles.secondaryText}>{exporting ? 'Đang xuất...' : 'Xuất Excel'}</Text></Pressable>
      <Pressable onPress={chooseSort} style={styles.secondaryButton}><ArrowDownWideNarrow size={14} color={colors.primary} /><Text style={styles.secondaryText}>{catalogSortOptions.find((item) => item.value === sortBy)?.label ?? 'Sắp xếp'}</Text></Pressable>
      {canManage && <Pressable disabled={importBusy} onPress={() => { void choosePriceList(); }} style={[styles.secondaryButton, importBusy && styles.disabled]}><Upload size={14} color={colors.primary} /><Text style={styles.secondaryText}>{importBusy ? 'Đang đọc bảng giá...' : 'Nhập Excel / CSV'}</Text></Pressable>}
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{catalogStatuses.map((item) => <Pressable key={item.value} onPress={() => setStatus(item.value)} style={[styles.chip, status === item.value && styles.chipActive]}><Text style={[styles.chipText, status === item.value && styles.chipTextActive]}>{item.label}</Text></Pressable>)}</ScrollView>
    <View style={styles.searchBox}><Search size={15} color={colors.muted} /><TextInput value={search} onChangeText={setSearch} style={styles.searchInput} placeholder="Tìm mã, tên, đơn vị, mô tả hoặc thuộc tính..." placeholderTextColor={colors.muted} /><Pressable onPress={() => { void refresh(); }} accessibilityLabel="Tải lại bảng giá"><RefreshCw size={15} color={colors.primary} /></Pressable></View>
    {canManage && <Pressable disabled={!filtered.length || loading || loadingMore} onPress={() => {
      const filteredIds = filtered.map((item) => item._id);
      const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.includes(id));
      if (allSelected) { setSelectedIds((current) => current.filter((id) => !filteredIds.includes(id))); return; }
      const nextIds = [...selectedIds, ...filteredIds.filter((id) => !selectedIds.includes(id))];
      if (nextIds.length > 200) { Alert.alert('Giới hạn chọn sản phẩm', 'Có thể chọn tối đa 200 sản phẩm cho mỗi thao tác.'); return; }
      setSelectedIds(nextIds);
    }} style={styles.pageSelectButton}><View style={[styles.checkbox, filtered.length > 0 && filtered.every((item) => selectedIds.includes(item._id)) && styles.checkboxActive]}>{filtered.length > 0 && filtered.every((item) => selectedIds.includes(item._id)) && <Check size={12} color={colors.white} />}</View><Text style={styles.secondaryText}>{filtered.length > 0 && filtered.every((item) => selectedIds.includes(item._id)) ? 'Bỏ chọn sản phẩm đã tải' : 'Chọn sản phẩm đã tải'}</Text></Pressable>}
    {!!selectedIds.length && canManage && <View style={styles.bulkActions}><View style={styles.catalogToolbar}><Text style={styles.mutedText}>{selectedIds.length} / 200 sản phẩm đã chọn</Text><Pressable disabled={exporting || !filtered.some((item) => selectedIds.includes(item._id))} onPress={() => { void exportExcel(true); }} style={[styles.secondaryButton, (exporting || !filtered.some((item) => selectedIds.includes(item._id))) && styles.disabled]}><FileSpreadsheet size={13} color={colors.primary} /><Text style={styles.secondaryText}>Xuất đã chọn</Text></Pressable></View><View style={styles.chipWrap}>{status === 'deleted' ? <Pressable disabled={bulkBusy} onPress={() => { void runBulkAction('restore'); }} style={styles.secondaryButton}><RefreshCw size={13} color={colors.primary} /><Text style={styles.secondaryText}>Khôi phục</Text></Pressable> : <><Pressable disabled={bulkBusy} onPress={() => { void runBulkAction('activate'); }} style={styles.secondaryButton}><Check size={13} color={colors.primary} /><Text style={styles.secondaryText}>Kích hoạt</Text></Pressable><Pressable disabled={bulkBusy} onPress={() => { void runBulkAction('deactivate'); }} style={styles.secondaryButton}><X size={13} color={colors.primary} /><Text style={styles.secondaryText}>Ngừng áp dụng</Text></Pressable><Pressable disabled={bulkBusy} onPress={() => setBulkPriceOpen(true)} style={styles.secondaryButton}><CircleDollarSign size={13} color={colors.primary} /><Text style={styles.secondaryText}>Điều chỉnh giá</Text></Pressable><Pressable disabled={bulkBusy} onPress={() => { void runBulkAction('delete'); }} style={[styles.secondaryButton, styles.dangerButton]}><Trash2 size={13} color="#B54745" /><Text style={[styles.secondaryText, styles.dangerText]}>Xóa</Text></Pressable></>}</View></View>}
    {!!error && <ErrorCard error={error} />}
    {loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : filtered.map((item) => <View key={item._id} style={styles.catalogRow}>
      {canManage && <Pressable onPress={() => { if (selectedIds.includes(item._id)) setSelectedIds((ids) => ids.filter((id) => id !== item._id)); else if (selectedIds.length >= 200) Alert.alert('Giới hạn chọn sản phẩm', 'Có thể chọn tối đa 200 sản phẩm cho mỗi thao tác.'); else setSelectedIds((ids) => [...ids, item._id]); }} style={[styles.checkbox, selectedIds.includes(item._id) && styles.checkboxActive]}>{selectedIds.includes(item._id) && <Check size={12} color={colors.white} />}</Pressable>}
      <Pressable onPress={() => { if (canManage && status !== 'deleted') { setDuplicateSource(null); setEditor(item); } }} style={styles.rowCopy}><Text style={styles.rowTitle}>{item.name}</Text><Text style={styles.mutedText}>{item.sku} · {item.unit} · {money(item.price, item.currency)}</Text><Text style={styles.mutedText}>{catalogStatusLabel(item, currentDate)} · Hiệu lực {item.effectiveFrom || 'ngay'} đến {item.effectiveTo || 'không thời hạn'}</Text>{Boolean(Object.keys(item.attributes ?? {}).length) && <Text numberOfLines={2} style={styles.mutedText}>{Object.entries(item.attributes ?? {}).map(([key, value]) => `${key}: ${value}`).join(' · ')}</Text>}</Pressable>
      {canManage && status === 'deleted' && <Pressable onPress={() => { void restore(item); }} style={styles.iconButton}><RefreshCw size={15} color={colors.primary} /></Pressable>}
      {canManage && status !== 'deleted' && <Pressable onPress={() => { void toggleActive(item); }} style={styles.iconButton}><BadgeCheck size={15} color={item.active ? '#16885A' : colors.muted} /></Pressable>}
      {canManage && status !== 'deleted' && <Pressable onPress={() => { setDuplicateSource(item); setEditor('new'); }} style={styles.iconButton}><Files size={15} color={colors.primary} /></Pressable>}
      {canManage && status !== 'deleted' && <Pressable onPress={() => remove(item)} style={styles.iconButton}><Trash2 size={15} color="#B54745" /></Pressable>}
    </View>)}
    {!loading && !filtered.length && <EmptyState text={nextPage !== null ? 'Chưa tìm thấy sản phẩm trong phần đã tải. Hãy tải thêm để tìm tiếp.' : 'Không có sản phẩm trong nhóm này.'} />}
    {!loading && (items.length > 0 || nextPage !== null) && <View style={styles.catalogPagination}>
      <View><Text style={styles.mutedText}>Đã tải {items.length} sản phẩm{filtered.length !== items.length ? ` · ${filtered.length} phù hợp bộ lọc` : ''}</Text></View>
      {nextPage !== null ? <Pressable disabled={loadingMore} onPress={() => { void loadMore(); }} style={[styles.secondaryButton, loadingMore && styles.disabled]}>{loadingMore ? <ActivityIndicator size="small" color={colors.primary} /> : <Plus size={14} color={colors.primary} />}<Text style={styles.secondaryText}>{loadingMore ? 'Đang tải...' : `Tải thêm ${CATALOG_PAGE_SIZE} sản phẩm`}</Text></Pressable> : <Text style={styles.mutedText}>Đã tải hết sản phẩm</Text>}
    </View>}
    <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Bảng giá đã nạp ({priceLists.length})</Text></View>
    {priceLists.map((file) => <Card key={file._id} style={styles.fileRow}><FileText size={15} color={colors.primary} /><View style={styles.rowCopy}><Text style={styles.rowTitle}>{file.originalFilename}</Text><Text style={styles.mutedText}>{date(file.updatedAt)} · {Math.ceil(file.bytes / 1024)} KB{file.productCount !== undefined ? ` · ${file.productCount} sản phẩm` : ''}{file.skippedRows ? ` · bỏ qua ${file.skippedRows} dòng` : ''}</Text></View><Pressable disabled={downloadingPriceList === file._id} onPress={() => { void downloadPriceList(file); }} style={styles.iconButton}>{downloadingPriceList === file._id ? <ActivityIndicator size="small" color={colors.primary} /> : <Download size={15} color={colors.primary} />}</Pressable></Card>)}
  </ScrollView>
  {pendingImport && <PriceListImportSheet pending={pendingImport} busy={importBusy} error={error} onClose={() => { if (!importBusy) setPendingImport(null); }} onUpdate={updateImportSheet} onConfirm={() => { void confirmPriceListImport(); }} />}
  <BulkPriceAdjustmentSheet visible={bulkPriceOpen} busy={bulkBusy} onClose={() => setBulkPriceOpen(false)} onApply={(adjustment) => { setBulkPriceOpen(false); void runBulkAction('price', adjustment); }} />
  <CatalogEditor visible={editor !== null} item={editor !== 'new' ? editor : null} duplicate={duplicateSource} onClose={() => { setEditor(null); setDuplicateSource(null); }} onSave={saveDraft} />
  </View>;
}

const priceListRoleLabels: Array<{ value: PriceListColumnRole; label: string }> = [
  { value: 'ignore', label: 'Bỏ qua' }, { value: 'sku', label: 'Mã hàng' }, { value: 'name', label: 'Tên sản phẩm' },
  { value: 'unit', label: 'Đơn vị' }, { value: 'price', label: 'Đơn giá' }, { value: 'currency', label: 'Tiền tệ' },
  { value: 'description', label: 'Mô tả' }, { value: 'effectiveFrom', label: 'Hiệu lực từ' },
  { value: 'effectiveTo', label: 'Hiệu lực đến' }, { value: 'attribute', label: 'Thuộc tính riêng' },
];

function PriceListImportSheet({ pending, busy, error, onClose, onUpdate, onConfirm }: {
  pending: { filename: string; file: Blob; sheets: Array<PriceListSheetPreview & { included: boolean; roles: PriceListColumnRole[] }> };
  busy: boolean;
  error: string;
  onClose: () => void;
  onUpdate: (sheetName: string, update: (sheet: PriceListSheetPreview & { included: boolean; roles: PriceListColumnRole[] }) => PriceListSheetPreview & { included: boolean; roles: PriceListColumnRole[] }) => void;
  onConfirm: () => void;
}) {
  return <Modal visible transparent animationType="slide" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.importSheet}><View style={styles.sheetHandle} /><View style={styles.sheetHeader}><View style={styles.rowCopy}><Text style={styles.sheetTitle}>Nhập bảng giá</Text><Text style={styles.sheetSubtitle}>{pending.filename}</Text></View><Pressable disabled={busy} onPress={onClose}><X size={18} color={colors.muted} /></Pressable></View><ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
    <Text style={styles.mutedText}>Chọn sheet, dòng tiêu đề và ghép cột trước khi ghi sản phẩm vào bảng giá.</Text>
    {pending.sheets.map((sheet) => {
      const header = sheet.headerRows.find((row) => row.row === sheet.headerRow);
      const samples = sheet.rows.filter((row) => row.row > sheet.headerRow).slice(0, 2);
      return <Card key={sheet.sheet} style={styles.importSheetCard}>
        <Pressable onPress={() => onUpdate(sheet.sheet, (current) => ({ ...current, included: !current.included }))} style={styles.workflowTop}><View style={[styles.checkbox, sheet.included && styles.checkboxActive]}>{sheet.included && <Check size={12} color={colors.white} />}</View><View style={styles.rowCopy}><Text style={styles.rowTitle}>{sheet.sheet}</Text><Text style={styles.mutedText}>{sheet.rows.length} dòng · tiêu đề dòng {sheet.headerRow}</Text></View></Pressable>
        <Text style={styles.fieldLabel}>Dòng tiêu đề</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{sheet.headerRows.map((row) => <Pressable key={row.row} onPress={() => onUpdate(sheet.sheet, (current) => ({ ...current, headerRow: row.row, roles: row.roles, included: current.included || (row.roles.includes('name') && row.roles.includes('price')) }))} style={[styles.chip, sheet.headerRow === row.row && styles.chipActive]}><Text style={[styles.chipText, sheet.headerRow === row.row && styles.chipTextActive]}>Dòng {row.row}: {row.cells.filter(Boolean).join(' · ').slice(0, 50)}</Text></Pressable>)}</ScrollView>
        {header?.cells.map((cell, index) => <View key={`${index}-${cell}`} style={styles.mappingColumn}><Text numberOfLines={2} style={styles.rowTitle}>{cell || `Cột ${index + 1}`}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roleOptions}>{priceListRoleLabels.map((role) => <Pressable key={role.value} onPress={() => onUpdate(sheet.sheet, (current) => ({ ...current, roles: current.roles.map((value, roleIndex) => roleIndex === index ? role.value : value) }))} style={[styles.chip, sheet.roles[index] === role.value && styles.chipActive]}><Text style={[styles.chipText, sheet.roles[index] === role.value && styles.chipTextActive]}>{role.label}</Text></Pressable>)}</ScrollView></View>)}
        {!!samples.length && <View style={styles.subSection}><Text style={styles.fieldLabel}>Dữ liệu mẫu</Text>{samples.map((row) => <Text key={row.row} style={styles.mutedText}>{row.cells.map((cell, index) => sheet.roles[index] === 'ignore' ? '' : `${header?.cells[index] || `Cột ${index + 1}`}: ${cell}`).filter(Boolean).join(' · ')}</Text>)}</View>}
      </Card>;
    })}
    {!!error && <ErrorCard error={error} />}
    <View style={styles.modalActions}><Pressable disabled={busy} onPress={onClose} style={styles.cancelButton}><Text style={styles.cancelText}>Hủy</Text></Pressable><Pressable disabled={busy} onPress={onConfirm} style={[styles.primaryButton, busy && styles.disabled]}>{busy ? <ActivityIndicator size="small" color={colors.white} /> : <Check size={15} color={colors.white} />}<Text style={styles.primaryText}>{busy ? 'Đang nhập...' : 'Xác nhận nhập'}</Text></Pressable></View>
  </ScrollView></View></View></Modal>;
}

function BulkPriceAdjustmentSheet({ visible, busy, onClose, onApply }: {
  visible: boolean;
  busy: boolean;
  onClose: () => void;
  onApply: (adjustment: { mode: 'amount' | 'percent'; value: number }) => void;
}) {
  const [mode, setMode] = useState<'amount' | 'percent'>('percent');
  const [direction, setDirection] = useState<1 | -1>(1);
  const [value, setValue] = useState('');
  const amount = Number(value);
  const valid = value.trim() !== '' && Number.isFinite(amount) && amount >= 0 && (mode !== 'percent' || amount <= 100);
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.editorSheet}><View style={styles.sheetHandle} /><View style={styles.sheetHeader}><Text style={styles.sheetTitle}>Điều chỉnh giá hàng loạt</Text><Pressable disabled={busy} onPress={onClose}><X size={18} color={colors.muted} /></Pressable></View><ScrollView contentContainerStyle={styles.formContent}>
    <Text style={styles.mutedText}>Xem trước từng sản phẩm trước khi áp dụng thay đổi.</Text>
    <Text style={styles.fieldLabel}>Hướng điều chỉnh</Text><View style={styles.chipWrap}><Pressable onPress={() => setDirection(1)} style={[styles.chip, direction === 1 && styles.chipActive]}><Text style={[styles.chipText, direction === 1 && styles.chipTextActive]}>Tăng giá</Text></Pressable><Pressable onPress={() => setDirection(-1)} style={[styles.chip, direction === -1 && styles.chipActive]}><Text style={[styles.chipText, direction === -1 && styles.chipTextActive]}>Giảm giá</Text></Pressable></View>
    <Text style={styles.fieldLabel}>Cách tính</Text><View style={styles.chipWrap}><Pressable onPress={() => setMode('percent')} style={[styles.chip, mode === 'percent' && styles.chipActive]}><Text style={[styles.chipText, mode === 'percent' && styles.chipTextActive]}>Theo phần trăm (%)</Text></Pressable><Pressable onPress={() => setMode('amount')} style={[styles.chip, mode === 'amount' && styles.chipActive]}><Text style={[styles.chipText, mode === 'amount' && styles.chipTextActive]}>Theo số tiền</Text></Pressable></View>
    <Field label={mode === 'percent' ? 'Mức điều chỉnh (0–100%)' : 'Mức điều chỉnh'} value={value} onChangeText={setValue} keyboardType="decimal-pad" />
    <View style={styles.modalActions}><Pressable disabled={busy} onPress={onClose} style={styles.cancelButton}><Text style={styles.cancelText}>Hủy</Text></Pressable><Pressable disabled={busy || !valid} onPress={() => onApply({ mode, value: direction * amount })} style={[styles.primaryButton, (busy || !valid) && styles.disabled]}>{busy ? <ActivityIndicator size="small" color={colors.white} /> : <Check size={15} color={colors.white} />}<Text style={styles.primaryText}>Xem trước thay đổi</Text></Pressable></View>
  </ScrollView></View></View></Modal>;
}

type CatalogDraft = { sku: string; name: string; description: string; unit: string; price: string; currency: string; active: boolean; effectiveFrom: string; effectiveTo: string; attributes: string };

function CatalogEditor({ visible, item, duplicate, onClose, onSave }: { visible: boolean; item: CatalogItem | null; duplicate: CatalogItem | null; onClose: () => void; onSave: (draft: CatalogDraft) => Promise<void> }) {
  const [draft, setDraft] = useState<CatalogDraft>({ sku: '', name: '', description: '', unit: '', price: '', currency: 'VND', active: true, effectiveFrom: '', effectiveTo: '', attributes: '' });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const source = item ?? duplicate;
    setDraft(source ? { sku: duplicate ? `${source.sku}-COPY` : source.sku, name: duplicate ? `${source.name} (bản sao)` : source.name, description: source.description ?? '', unit: source.unit, price: String(source.price), currency: source.currency, active: source.active, effectiveFrom: source.effectiveFrom ?? '', effectiveTo: source.effectiveTo ?? '', attributes: Object.entries(source.attributes ?? {}).map(([key, value]) => `${key}=${value}`).join('\n') } : { sku: '', name: '', description: '', unit: '', price: '', currency: 'VND', active: true, effectiveFrom: '', effectiveTo: '', attributes: '' });
  }, [item, duplicate, visible]);
  function update<K extends keyof CatalogDraft>(key: K, value: CatalogDraft[K]) { setDraft((current) => ({ ...current, [key]: value })); }
  async function submit() { setSaving(true); try { await onSave(draft); } finally { setSaving(false); } }
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.editorSheet}><View style={styles.sheetHandle} /><View style={styles.sheetHeader}><Text style={styles.sheetTitle}>{duplicate ? 'Nhân bản sản phẩm' : item ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}</Text><Pressable onPress={onClose}><X size={18} color={colors.muted} /></Pressable></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.formContent}>
    <Field label="Mã SKU *" value={draft.sku} onChangeText={(value) => update('sku', value)} />
    <Field label="Tên sản phẩm *" value={draft.name} onChangeText={(value) => update('name', value)} />
    <Field label="Mô tả" value={draft.description} onChangeText={(value) => update('description', value)} multiline />
    <View style={styles.twoColumns}><Field label="Đơn vị *" value={draft.unit} onChangeText={(value) => update('unit', value)} /><Field label="Đơn giá *" value={draft.price} onChangeText={(value) => update('price', value)} keyboardType="decimal-pad" /></View>
    <View style={styles.twoColumns}><Field label="Tiền tệ" value={draft.currency} onChangeText={(value) => update('currency', value)} /><Field label="Hiệu lực từ (YYYY-MM-DD)" value={draft.effectiveFrom} onChangeText={(value) => update('effectiveFrom', value)} /></View>
    <Field label="Hiệu lực đến (YYYY-MM-DD)" value={draft.effectiveTo} onChangeText={(value) => update('effectiveTo', value)} />
    <Field label="Thuộc tính (mỗi dòng: tên=giá trị)" value={draft.attributes} onChangeText={(value) => update('attributes', value)} multiline />
    <View style={styles.modalActions}><Pressable onPress={onClose} style={styles.cancelButton}><Text style={styles.cancelText}>Hủy</Text></Pressable><Pressable disabled={saving} onPress={() => { void submit(); }} style={[styles.primaryButton, saving && styles.disabled]}>{saving ? <ActivityIndicator size="small" color={colors.white} /> : <Check size={15} color={colors.white} />}<Text style={styles.primaryText}>{saving ? 'Đang lưu...' : 'Lưu sản phẩm'}</Text></Pressable></View>
  </ScrollView></View></View></Modal>;
}

export function ContractWorkflowPanel({ scope, view, initialQuote, onInitialQuoteHandled, canReadContracts, canReadAcceptances, canReadTemplates, canManage, canManageAcceptance, canUseAi }: { scope: QuotationScope; view: 'contracts' | 'acceptances'; initialQuote?: Quote | null; onInitialQuoteHandled?: () => void; canReadContracts: boolean; canReadAcceptances: boolean; canReadTemplates: boolean; canManage: boolean; canManageAcceptance: boolean; canUseAi: boolean }) {
  const [contracts, setContracts] = useState<QuotationContract[]>([]);
  const [records, setRecords] = useState<AcceptanceRecord[]>([]);
  const [approvedQuotes, setApprovedQuotes] = useState<Quote[]>([]);
  const [templates, setTemplates] = useState<QuotationTemplate[]>([]);
  const [acceptanceTemplates, setAcceptanceTemplates] = useState<QuotationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [preselectedQuoteId, setPreselectedQuoteId] = useState('');
  const [selected, setSelected] = useState<QuotationContract | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<AcceptanceRecord | null>(null);
  const [recordContract, setRecordContract] = useState<QuotationContract | null>(null);
  const [acceptanceContractToCreate, setAcceptanceContractToCreate] = useState<QuotationContract | null>(null);
  const [recordFormOpen, setRecordFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [company, setCompany] = useState<CompanyPrefill | null>(null);
  const handledInitialQuote = useRef('');

  async function refresh() {
    setLoading(true); setError('');
    try {
      const [contractList, recordList] = await Promise.all([
        canReadContracts ? listContracts(scope) : Promise.resolve([] as QuotationContract[]),
        canReadAcceptances ? listAcceptanceRecords(scope) : Promise.resolve([] as AcceptanceRecord[]),
      ]);
      setContracts(contractList); setRecords(recordList);
      if (view === 'contracts') {
        const [quotes, docTemplates, acceptTemplates, settlementTemplates] = await Promise.all([
          listQuotes(scope, { kind: 'estimate', status: 'approved', page: 1 }),
          canReadTemplates ? loadDocumentTemplates(scope, 'contract') : Promise.resolve([] as QuotationTemplate[]),
          canReadTemplates ? loadDocumentTemplates(scope, 'acceptance') : Promise.resolve([] as QuotationTemplate[]),
          canReadTemplates ? loadDocumentTemplates(scope, 'settlement') : Promise.resolve([] as QuotationTemplate[]),
        ]);
        setApprovedQuotes(quotes.quotes.filter((quote) => quote.lines.length > 0)); setTemplates(docTemplates);
        setAcceptanceTemplates([...acceptTemplates, ...settlementTemplates]);
      } else {
        const [acceptanceTemplates, settlementTemplates] = await Promise.all([
          canReadTemplates ? loadDocumentTemplates(scope, 'acceptance') : Promise.resolve([] as QuotationTemplate[]),
          canReadTemplates ? loadDocumentTemplates(scope, 'settlement') : Promise.resolve([] as QuotationTemplate[]),
        ]);
        setTemplates([...acceptanceTemplates, ...settlementTemplates]); setAcceptanceTemplates([...acceptanceTemplates, ...settlementTemplates]);
      }
    } catch (cause) { setError(messageOf(cause)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, [scope, view, canReadContracts, canReadAcceptances, canReadTemplates]);

  useEffect(() => {
    if (view !== 'contracts' || !initialQuote) return;
    setApprovedQuotes((current) => current.some((quote) => quote._id === initialQuote._id) ? current : [initialQuote, ...current]);
    if (loading || handledInitialQuote.current === initialQuote._id) return;
    handledInitialQuote.current = initialQuote._id;
    void getContractPrefill(scope).then((details) => {
      setCompany(details);
      setPreselectedQuoteId(initialQuote._id);
      setCreating(true);
    }).catch((cause) => setError(messageOf(cause))).finally(() => onInitialQuoteHandled?.());
  }, [initialQuote, loading, onInitialQuoteHandled, scope, view]);

  async function openCreateContract() {
    if (!canManage) return;
    try { setPreselectedQuoteId(''); setCompany(await getContractPrefill(scope)); setCreating(true); }
    catch (cause) { setError(messageOf(cause)); }
  }

  async function openContract(id: string) {
    try { setSelected(await getContract(scope, id)); }
    catch (cause) { setError(messageOf(cause)); }
  }

  async function openAcceptanceRecord(id: string) {
    try {
      const detail = await getAcceptanceRecord(scope, id);
      setSelectedRecord(detail.record); setRecordContract(detail.contract);
    } catch (cause) { setError(messageOf(cause)); }
  }

  async function saveContract(form: Record<string, string>, quote: Quote, templateId: string) {
    setBusy(true); setError('');
    try {
      const contract = await createContract(scope, { ...form, quoteId: quote._id, templateId: templateId || undefined, depositAmount: Number(form.depositAmount || 0) });
      try { await queueContractFile(scope, contract._id); } catch (cause) { Alert.alert('Đã lưu hợp đồng', `Hợp đồng đã được lưu; chưa xếp được file: ${messageOf(cause)}`); }
      setCreating(false); await refresh(); setSelected(await getContract(scope, contract._id));
    } catch (cause) { setError(messageOf(cause)); }
    finally { setBusy(false); }
  }

  async function saveContractDraft(form: ContractForm, contract: QuotationContract) {
    setBusy(true); setError('');
    try { const updated = await updateContract(scope, contract, contractPayload(form)); setSelected(updated); setContracts((items) => items.map((item) => item._id === updated._id ? updated : item)); Alert.alert('Đã lưu hợp đồng', 'Bản nháp đã được cập nhật.'); }
    catch (cause) { setError(messageOf(cause)); }
    finally { setBusy(false); }
  }

  async function signDraft(form: ContractForm, contract: QuotationContract) {
    Alert.alert('Xác nhận hợp đồng đã ký?', `${contract.contractNumber} sẽ được khóa nội dung.`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xác nhận đã ký', onPress: () => { setBusy(true); setError(''); void updateContract(scope, contract, contractPayload(form)).then((saved) => signContract(scope, saved, form.signedDate || today())).then(async (updated) => { try { await queueContractFile(scope, updated._id); } catch {} await refresh(); setSelected(updated); }).catch((cause) => setError(messageOf(cause))).finally(() => setBusy(false)); } },
    ]);
  }

  async function saveAcceptance(form: AcceptanceForm, contract: QuotationContract, templateId: string) {
    setBusy(true); setError('');
    try {
      const record = await createAcceptanceRecord(scope, { ...form, contractId: contract._id, templateId: templateId || undefined, settlementAmount: Number(form.settlementAmount), amountPaid: Number(form.amountPaid), paymentDueDays: form.paymentDueDays ? Number(form.paymentDueDays) : null, lines: form.lines.map((line) => ({ ...line, acceptedQuantity: Number(line.acceptedQuantity) })) });
      try { await queueAcceptanceFile(scope, record._id); } catch (cause) { Alert.alert('Đã lưu nghiệm thu', `Biên bản đã được lưu; chưa xếp được file: ${messageOf(cause)}`); }
      setRecordFormOpen(false); setSelected(null); setAcceptanceContractToCreate(null); await refresh(); await openAcceptanceRecord(record._id);
    } catch (cause) { setError(messageOf(cause)); }
    finally { setBusy(false); }
  }

  async function saveAcceptanceDraft(form: AcceptanceForm, record: AcceptanceRecord) {
    setBusy(true); setError('');
    try {
      const updated = await updateAcceptanceRecord(scope, record, acceptancePayload(form));
      setSelectedRecord(updated); setRecords((items) => items.map((item) => item._id === updated._id ? updated : item));
      Alert.alert('Đã lưu nghiệm thu', 'Bản nháp đã được cập nhật.');
    } catch (cause) { setError(messageOf(cause)); }
    finally { setBusy(false); }
  }

  async function completeAcceptance(form: AcceptanceForm, record: AcceptanceRecord) {
    Alert.alert('Hoàn tất nghiệm thu?', `${record.acceptanceNumber} sẽ được khóa để đối chiếu.`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Hoàn tất', onPress: () => {
        setBusy(true); setError('');
        void updateAcceptanceRecord(scope, record, acceptancePayload(form)).then((saved) => completeAcceptanceRecord(scope, saved)).then(async (completed) => {
          setSelectedRecord(completed); setRecords((items) => items.map((item) => item._id === completed._id ? completed : item));
          try { await queueAcceptanceFile(scope, completed._id); } catch {}
        }).catch((cause) => setError(messageOf(cause))).finally(() => setBusy(false));
      } },
    ]);
  }

  const signedContractsWithoutRecord = contracts.filter((contract) => contract.status === 'signed' && !records.some((record) => record.contractId === contract._id));
  const createAcceptanceFor = async (contract: QuotationContract) => {
    if (!canManageAcceptance || !canReadContracts) return;
    try { const detail = await getContract(scope, contract._id); setAcceptanceContractToCreate(detail); setRecordFormOpen(true); }
    catch (cause) { setError(messageOf(cause)); }
  };

  return <View style={styles.container}><ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
    <View style={styles.sectionHeader}><Text style={styles.mutedText}>{view === 'contracts' ? `${contracts.length} hợp đồng` : `${records.length} biên bản`}</Text><View style={styles.sectionHeaderActions}>{view === 'contracts' && canManage && <Pressable onPress={() => { void openCreateContract(); }} style={styles.secondaryButton}><Plus size={13} color={colors.primary} /><Text style={styles.secondaryText}>Tạo hợp đồng</Text></Pressable>}{view === 'acceptances' && canManageAcceptance && signedContractsWithoutRecord.length > 0 && <Pressable onPress={() => setRecordFormOpen(true)} style={styles.secondaryButton}><Plus size={13} color={colors.primary} /><Text style={styles.secondaryText}>Tạo nghiệm thu</Text></Pressable>}<Pressable onPress={() => { void refresh(); }} accessibilityLabel="Tải lại danh sách"><RefreshCw size={16} color={colors.primary} /></Pressable></View></View>
    {!!error && <ErrorCard error={error} />}
    {loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : view === 'contracts' ? contracts.map((contract) => <Card key={contract._id} style={styles.workflowCard}><View style={styles.workflowTop}><BriefcaseBusiness size={17} color={colors.primary} /><View style={styles.rowCopy}><Text style={styles.rowTitle}>{contract.contractNumber}</Text><Text style={styles.mutedText}>{contract.quoteNumber} · {contract.customerName}</Text></View><StatusPill label={contract.status === 'signed' ? 'Đã ký' : 'Bản nháp'} complete={contract.status === 'signed'} /></View><View style={styles.workflowMeta}><Text style={styles.mutedText}>{contract.projectName || 'Chưa có tên dự án'}</Text><Text style={styles.metric}>{money(contract.total, contract.currency)}</Text></View><View style={styles.actionRow}><Pressable onPress={() => { void openContract(contract._id); }} style={styles.secondaryButton}><FileText size={14} color={colors.primary} /><Text style={styles.secondaryText}>Mở hồ sơ</Text></Pressable>{contract.status === 'signed' && canManageAcceptance && !records.some((record) => record.contractId === contract._id) && <Pressable onPress={() => { void createAcceptanceFor(contract); }} style={styles.secondaryButton}><BadgeCheck size={14} color={colors.primary} /><Text style={styles.secondaryText}>Tạo nghiệm thu</Text></Pressable>}</View></Card>) : records.map((record) => <Card key={record._id} style={styles.workflowCard}><View style={styles.workflowTop}><BadgeCheck size={17} color={colors.primary} /><View style={styles.rowCopy}><Text style={styles.rowTitle}>{record.acceptanceNumber}</Text><Text style={styles.mutedText}>Hợp đồng {record.contractNumber} · {date(record.acceptedDate)}</Text></View><StatusPill label={record.status === 'completed' ? 'Hoàn tất' : 'Bản nháp'} complete={record.status === 'completed'} /></View><View style={styles.workflowMeta}><Text style={styles.mutedText}>{record.location} · {record.result}</Text><Text style={styles.metric}>{money(record.settlementAmount)}</Text></View><View style={styles.actionRow}><Pressable onPress={() => { void openAcceptanceRecord(record._id); }} style={styles.secondaryButton}><FileText size={14} color={colors.primary} /><Text style={styles.secondaryText}>Mở biên bản</Text></Pressable>{record.status === 'draft' && canManageAcceptance && <Pressable disabled={busy} onPress={() => { void openAcceptanceRecord(record._id); }} style={styles.secondaryButton}><Check size={14} color={colors.primary} /><Text style={styles.secondaryText}>Sửa / hoàn tất</Text></Pressable>}</View></Card>)}
    {!loading && (view === 'contracts' ? contracts.length === 0 : records.length === 0) && <EmptyState text={view === 'contracts' ? 'Chưa có hợp đồng.' : 'Chưa có biên bản nghiệm thu.'} />}
    {view === 'acceptances' && canReadContracts && signedContractsWithoutRecord.length > 0 && <View style={styles.subSection}><Text style={styles.sectionTitle}>Hợp đồng đã ký, chưa nghiệm thu</Text>{signedContractsWithoutRecord.map((contract) => <Pressable key={contract._id} onPress={() => { void createAcceptanceFor(contract); }} style={styles.choiceRow}><Text style={styles.rowTitle}>{contract.contractNumber} · {contract.customerName}</Text>{canManageAcceptance && <ChevronRight size={15} color={colors.muted} />}</Pressable>)}</View>}
  </ScrollView>

  {view === 'contracts' && <ContractCreateSheet visible={creating} quotes={approvedQuotes} preselectedQuoteId={preselectedQuoteId} templates={templates} company={company} busy={busy} error={error} onClose={() => setCreating(false)} onSave={saveContract} />}
  <AcceptanceCreateSheet visible={recordFormOpen} contracts={signedContractsWithoutRecord} selectedContract={acceptanceContractToCreate ?? (view === 'acceptances' ? selected : null)} templates={acceptanceTemplates.length ? acceptanceTemplates : templates} busy={busy} error={error} onClose={() => { setRecordFormOpen(false); setSelected(null); setAcceptanceContractToCreate(null); }} onSave={saveAcceptance} />
  {view === 'contracts' && selected && <ContractDetailSheet scope={scope} contract={selected} canManage={canManage} canManageAcceptance={canManageAcceptance} canUseAi={canUseAi} busy={busy} error={error} onClose={() => setSelected(null)} onSave={saveContractDraft} onSign={signDraft} onCreateAcceptance={() => createAcceptanceFor(selected)} />}
  {selectedRecord && recordContract && <AcceptanceDetailSheet scope={scope} record={selectedRecord} contract={recordContract} canManage={canManageAcceptance} canUseAi={canUseAi} busy={busy} error={error} onClose={() => { setSelectedRecord(null); setRecordContract(null); }} onSave={saveAcceptanceDraft} onComplete={completeAcceptance} />}
  </View>;
}

function contractPayload(form: ContractForm) {
  return { scope: form.scope ?? '', projectName: form.projectName ?? '', projectAddress: form.projectAddress ?? '', deliverables: form.deliverables ?? '', depositAmount: Number(form.depositAmount || 0), bankDetails: form.bankDetails ?? '', otherTerms: form.otherTerms ?? '', paymentTerms: form.paymentTerms ?? '', deliveryTerms: form.deliveryTerms ?? '', signingPlace: form.signingPlace ?? '', signedDate: form.signedDate || today() };
}

function acceptancePayload(form: AcceptanceForm) {
  return { acceptedDate: form.acceptedDate, startTime: form.startTime, endTime: form.endTime, location: form.location, result: form.result, handoverDetails: form.handoverDetails, qualityAssessment: form.qualityAssessment, settlementAmount: Number(form.settlementAmount), amountPaid: Number(form.amountPaid), paymentDueDays: form.paymentDueDays ? Number(form.paymentDueDays) : null, notes: form.notes, lines: form.lines.map((line) => ({ lineIndex: line.lineIndex, acceptedQuantity: Number(line.acceptedQuantity || 0), acceptedDetails: line.acceptedDetails })) };
}

function ContractDetailSheet({ scope, contract, canManage, canManageAcceptance, canUseAi, busy, error, onClose, onSave, onSign, onCreateAcceptance }: {
  scope: QuotationScope;
  contract: QuotationContract;
  canManage: boolean;
  canManageAcceptance: boolean;
  canUseAi: boolean;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (form: ContractForm, contract: QuotationContract) => Promise<void>;
  onSign: (form: ContractForm, contract: QuotationContract) => void;
  onCreateAcceptance: () => void;
}) {
  const [form, setForm] = useState<ContractForm>({});
  const editable = canManage && contract.status === 'draft';
  useEffect(() => setForm({
    scope: contract.scope ?? '', projectName: contract.projectName ?? '', projectAddress: contract.projectAddress ?? '', deliverables: contract.deliverables ?? '',
    depositAmount: String(contract.depositAmount ?? 0), bankDetails: contract.bankDetails ?? '', otherTerms: contract.otherTerms ?? '', paymentTerms: contract.paymentTerms ?? '',
    deliveryTerms: contract.deliveryTerms ?? '', signingPlace: contract.signingPlace ?? '', signedDate: contract.signedDate ?? today(),
  }), [contract._id, contract.updatedAt]);
  function set(key: string, value: string) { setForm((current) => ({ ...current, [key]: value })); }
  const fields: Array<[string, string, boolean?]> = [
    ['projectName', 'Tên công trình / dự án *'], ['projectAddress', 'Địa điểm thực hiện *'], ['signingPlace', 'Địa điểm ký *'],
    ['signedDate', 'Ngày ký dự kiến (YYYY-MM-DD) *'], ['scope', 'Phạm vi công việc *', true], ['deliverables', 'Hồ sơ / sản phẩm bàn giao *', true],
    ['depositAmount', 'Tiền đặt cọc / tạm ứng'], ['bankDetails', 'Thông tin tài khoản'], ['paymentTerms', 'Điều khoản thanh toán *', true],
    ['deliveryTerms', 'Tiến độ và bàn giao *', true], ['otherTerms', 'Điều khoản bổ sung', true],
  ];
  return <Modal visible transparent animationType="slide" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.detailSheet}><View style={styles.sheetHandle} /><View style={styles.sheetHeader}><View><Text style={styles.sheetTitle}>{contract.contractNumber}</Text><Text style={styles.sheetSubtitle}>{contract.customerName} · Dự toán {contract.quoteNumber}</Text></View><Pressable onPress={onClose}><X size={18} color={colors.muted} /></Pressable></View><ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
    <View style={styles.budgetTotals}><View><Text style={styles.metaLabel}>Giá trị hợp đồng</Text><Text style={styles.metric}>{money(contract.total, contract.currency)}</Text></View><View><Text style={styles.metaLabel}>Đặt cọc</Text><Text style={styles.metric}>{money(contract.depositAmount ?? 0, contract.currency)}</Text></View><StatusPill label={contract.status === 'signed' ? 'Đã ký' : 'Bản nháp'} complete={contract.status === 'signed'} /></View>
    <Text style={styles.sectionTitle}>Thông tin hai bên</Text>
    {[['Khách hàng', contract.customerName], ['Địa chỉ khách hàng', contract.customerAddress], ['Người đại diện', contract.customerRepresentative], ['Email / điện thoại', [contract.customerEmail, contract.customerPhone].filter(Boolean).join(' · ')], ['Đơn vị thực hiện', contract.companyName], ['Đại diện bên thực hiện', contract.companyRepresentative], ['Địa chỉ đơn vị', contract.companyAddress], ['MST đơn vị', contract.companyTaxId]].map(([label, value]) => <InfoRow key={label} label={label} value={value} />)}
    <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Hạng mục hợp đồng ({contract.lines.length})</Text></View>
    {contract.lines.map((line, index) => <View key={`${line.catalogItemId}-${index}`} style={styles.budgetLine}><View style={styles.budgetLineCopy}><Text style={styles.rowTitle}>{line.name}</Text><Text style={styles.mutedText}>{line.quantity} {line.unit} · {money(line.unitPrice, line.currency)}</Text></View><Text style={styles.lineTotal}>{money(line.lineTotal, line.currency)}</Text></View>)}
    <View style={styles.subSection}><Text style={styles.sectionTitle}>Điều khoản</Text>{fields.map(([key, label, multiline]) => editable ? <Field key={key} label={label} value={form[key] ?? ''} onChangeText={(value) => set(key, value)} multiline={multiline} keyboardType={key === 'depositAmount' ? 'decimal-pad' : undefined} /> : <InfoRow key={key} label={label.replace(' *', '')} value={key === 'depositAmount' ? money(contract.depositAmount ?? 0, contract.currency) : form[key] ?? ''} />)}</View>
    {!!contract.template && <InfoRow label="Mẫu sử dụng" value={contract.template.name || contract.template.originalFilename} />}
    {!!error && <ErrorCard error={error} />}
    {canUseAi && <GeneratedFileActions scope={scope} sourceId={contract._id} kind="contract" updatedAt={contract.updatedAt} label="File hợp đồng" canGenerate onGenerate={() => queueContractFile(scope, contract._id)} />}
    <View style={styles.actionRow}>{contract.status === 'signed' && canManageAcceptance && <Pressable disabled={busy} onPress={onCreateAcceptance} style={styles.secondaryButton}><BadgeCheck size={14} color={colors.primary} /><Text style={styles.secondaryText}>Tạo nghiệm thu</Text></Pressable>}{editable && <Pressable disabled={busy} onPress={() => { void onSave(form, contract); }} style={[styles.secondaryButton, busy && styles.disabled]}><Check size={14} color={colors.primary} /><Text style={styles.secondaryText}>Lưu nội dung</Text></Pressable>}</View>
    {editable && <Pressable disabled={busy} onPress={() => onSign(form, contract)} style={[styles.primaryButton, busy && styles.disabled]}><BadgeCheck size={15} color={colors.white} /><Text style={styles.primaryText}>Xác nhận đã ký</Text></Pressable>}
  </ScrollView></View></View></Modal>;
}

function AcceptanceDetailSheet({ scope, record, contract, canManage, canUseAi, busy, error, onClose, onSave, onComplete }: {
  scope: QuotationScope;
  record: AcceptanceRecord;
  contract: QuotationContract;
  canManage: boolean;
  canUseAi: boolean;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (form: AcceptanceForm, record: AcceptanceRecord) => Promise<void>;
  onComplete: (form: AcceptanceForm, record: AcceptanceRecord) => void;
}) {
  const [form, setForm] = useState<AcceptanceForm>({ acceptedDate: '', startTime: '', endTime: '', location: '', result: '', handoverDetails: '', qualityAssessment: '', settlementAmount: '', amountPaid: '', paymentDueDays: '', notes: '', lines: [] });
  const editable = canManage && record.status === 'draft';
  useEffect(() => setForm({
    acceptedDate: record.acceptedDate, startTime: record.startTime, endTime: record.endTime, location: record.location, result: record.result,
    handoverDetails: record.handoverDetails, qualityAssessment: record.qualityAssessment, settlementAmount: String(record.settlementAmount ?? contract.total),
    amountPaid: String(record.amountPaid ?? contract.depositAmount ?? 0), paymentDueDays: record.paymentDueDays == null ? '' : String(record.paymentDueDays), notes: record.notes,
    lines: contract.lines.map((line, index) => { const saved = record.lines.find((item) => item.lineIndex === index); return { lineIndex: index, acceptedQuantity: String(saved?.acceptedQuantity ?? 0), acceptedDetails: saved?.acceptedDetails ?? '' }; }),
  }), [record._id, record.updatedAt, contract._id]);
  function set(key: keyof Omit<AcceptanceForm, 'lines'>, value: string) { setForm((current) => ({ ...current, [key]: value })); }
  const due = Math.max(0, Number(form.settlementAmount || 0) - Number(form.amountPaid || 0));
  return <Modal visible transparent animationType="slide" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.detailSheet}><View style={styles.sheetHandle} /><View style={styles.sheetHeader}><View><Text style={styles.sheetTitle}>{record.acceptanceNumber}</Text><Text style={styles.sheetSubtitle}>Hợp đồng {contract.contractNumber} · {contract.customerName}</Text></View><Pressable onPress={onClose}><X size={18} color={colors.muted} /></Pressable></View><ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
    <View style={styles.budgetTotals}><View><Text style={styles.metaLabel}>Giá trị quyết toán</Text><Text style={styles.metric}>{money(record.settlementAmount, contract.currency)}</Text></View><View><Text style={styles.metaLabel}>Còn phải thu</Text><Text style={styles.metric}>{money(Math.max(0, record.settlementAmount - record.amountPaid), contract.currency)}</Text></View><StatusPill label={record.status === 'completed' ? 'Hoàn tất' : 'Bản nháp'} complete={record.status === 'completed'} /></View>
    {editable ? <>
      <View style={styles.twoColumns}><Field label="Ngày nghiệm thu (YYYY-MM-DD) *" value={form.acceptedDate} onChangeText={(value) => set('acceptedDate', value)} /><Field label="Địa điểm nghiệm thu *" value={form.location} onChangeText={(value) => set('location', value)} /></View>
      <View style={styles.twoColumns}><Field label="Giờ bắt đầu *" value={form.startTime} onChangeText={(value) => set('startTime', value)} /><Field label="Giờ kết thúc *" value={form.endTime} onChangeText={(value) => set('endTime', value)} /></View>
      <Field label="Kết quả nghiệm thu *" value={form.result} onChangeText={(value) => set('result', value)} multiline />
      <Field label="Hồ sơ / sản phẩm bàn giao *" value={form.handoverDetails} onChangeText={(value) => set('handoverDetails', value)} multiline />
      <Field label="Đánh giá chất lượng *" value={form.qualityAssessment} onChangeText={(value) => set('qualityAssessment', value)} multiline />
      <View style={styles.twoColumns}><Field label="Giá trị quyết toán *" value={form.settlementAmount} onChangeText={(value) => set('settlementAmount', value)} keyboardType="decimal-pad" /><Field label="Đã thanh toán *" value={form.amountPaid} onChangeText={(value) => set('amountPaid', value)} keyboardType="decimal-pad" /></View>
      <Field label="Hạn thanh toán còn lại (ngày)" value={form.paymentDueDays} onChangeText={(value) => set('paymentDueDays', value)} keyboardType="number-pad" />
      <Text style={styles.mutedText}>Còn phải thanh toán: {money(due, contract.currency)}</Text>
      <Field label="Ghi chú / tồn tại" value={form.notes} onChangeText={(value) => set('notes', value)} multiline />
    </> : <>
      {[["Ngày nghiệm thu", date(record.acceptedDate)], ["Địa điểm", record.location], ["Thời gian", `${record.startTime} – ${record.endTime}`], ["Kết quả", record.result], ["Hồ sơ bàn giao", record.handoverDetails], ["Đánh giá chất lượng", record.qualityAssessment], ["Giá trị quyết toán", money(record.settlementAmount, contract.currency)], ["Đã thanh toán", money(record.amountPaid, contract.currency)], ["Còn phải thanh toán", money(Math.max(0, record.settlementAmount - record.amountPaid), contract.currency)], ["Hạn thanh toán", record.paymentDueDays == null ? 'Chưa chốt' : `${record.paymentDueDays} ngày`], ["Ghi chú", record.notes]].map(([label, value]) => <InfoRow key={label} label={label} value={value} />)}
    </>}
    <View style={styles.subSection}><Text style={styles.sectionTitle}>Khối lượng nghiệm thu</Text>{contract.lines.map((line, index) => {
      const accepted = form.lines[index] ?? { lineIndex: index, acceptedQuantity: '0', acceptedDetails: '' };
      return <View key={`${line.catalogItemId}-${index}`} style={styles.acceptanceLine}><View style={styles.rowCopy}><Text style={styles.rowTitle}>{line.name}</Text><Text style={styles.mutedText}>Hợp đồng: {line.quantity} {line.unit} · {money(Number(accepted.acceptedQuantity || 0) * line.unitPrice, contract.currency)}</Text>{editable ? <TextInput value={accepted.acceptedDetails} onChangeText={(value) => setForm((current) => ({ ...current, lines: current.lines.map((item) => item.lineIndex === index ? { ...item, acceptedDetails: value } : item) }))} style={[styles.input, styles.lineDetailInput]} placeholder="Thông tin nghiệm thu" placeholderTextColor={colors.muted} /> : !!accepted.acceptedDetails && <Text style={styles.mutedText}>{accepted.acceptedDetails}</Text>}</View><TextInput editable={editable} value={accepted.acceptedQuantity} onChangeText={(value) => setForm((current) => ({ ...current, lines: current.lines.map((item) => item.lineIndex === index ? { ...item, acceptedQuantity: value } : item) }))} style={styles.quantityInput} keyboardType="decimal-pad" /></View>;
    })}</View>
    {!!record.template && <InfoRow label="Mẫu sử dụng" value={record.template.name || record.template.originalFilename} />}
    {!!error && <ErrorCard error={error} />}
    {canUseAi && <><GeneratedFileActions scope={scope} sourceId={record._id} kind="acceptance" updatedAt={record.updatedAt} label="File biên bản nghiệm thu" canGenerate onGenerate={() => queueAcceptanceFile(scope, record._id)} /><GeneratedFileActions scope={scope} sourceId={record._id} kind="settlement" updatedAt={record.updatedAt} label="File quyết toán" canGenerate onGenerate={() => queueSettlementFile(scope, record._id)} /></>}
    <View style={styles.actionRow}>{editable && <Pressable disabled={busy} onPress={() => { void onSave(form, record); }} style={[styles.secondaryButton, busy && styles.disabled]}><Check size={14} color={colors.primary} /><Text style={styles.secondaryText}>Lưu bản nháp</Text></Pressable>}</View>
    {editable && <Pressable disabled={busy || !form.lines.some((line) => Number(line.acceptedQuantity) > 0)} onPress={() => onComplete(form, record)} style={[styles.primaryButton, busy && styles.disabled]}><BadgeCheck size={15} color={colors.white} /><Text style={styles.primaryText}>Hoàn tất nghiệm thu</Text></Pressable>}
  </ScrollView></View></View></Modal>;
}

type ContractForm = Record<string, string>;
function ContractCreateSheet({ visible, quotes, preselectedQuoteId, templates, company, busy, error, onClose, onSave }: { visible: boolean; quotes: Quote[]; preselectedQuoteId: string; templates: QuotationTemplate[]; company: CompanyPrefill | null; busy: boolean; error: string; onClose: () => void; onSave: (form: ContractForm, quote: Quote, templateId: string) => Promise<void> }) {
  const [quoteId, setQuoteId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [form, setForm] = useState<ContractForm>({});
  useEffect(() => {
    const quote = quotes.find((item) => item._id === preselectedQuoteId) ?? quotes.find((item) => item._id === quoteId) ?? quotes[0];
    if (!visible || !quote) return;
    setQuoteId(quote._id); setTemplateId(templates[0]?.id ?? '');
    setForm({ customerName: quote.customerName, customerEmail: quote.customerEmail, customerPhone: quote.customerPhone ?? '', customerAddress: '', customerTaxId: '', customerRepresentative: '', companyName: company?.name ?? '', companyAddress: company?.address ?? '', companyTaxId: company?.taxId ?? '', companyRepresentative: company?.representativeName ?? '', companyPhone: company?.phone ?? '', companyEmail: company?.email ?? '', scope: '', projectName: '', projectAddress: '', deliverables: '', paymentTerms: '', deliveryTerms: '', signingPlace: '', signedDate: today(), depositAmount: '0', bankDetails: '', otherTerms: '' });
  }, [visible, quotes, templates, company, preselectedQuoteId]);
  const quote = quotes.find((item) => item._id === quoteId);
  function set(key: string, value: string) { setForm((current) => ({ ...current, [key]: value })); }
  const fields: Array<[string, string, boolean?]> = [['customerName', 'Tên khách hàng *', true], ['customerAddress', 'Địa chỉ khách hàng *', true], ['customerRepresentative', 'Người đại diện khách hàng *', true], ['customerTaxId', 'Mã số thuế khách hàng'], ['customerPhone', 'Điện thoại khách hàng'], ['customerEmail', 'Email khách hàng'], ['projectName', 'Tên công trình / dự án *', true], ['projectAddress', 'Địa điểm thực hiện *', true], ['signedDate', 'Ngày ký dự kiến (YYYY-MM-DD) *'], ['signingPlace', 'Địa điểm ký *', true], ['scope', 'Phạm vi công việc *', true], ['deliverables', 'Hồ sơ / sản phẩm bàn giao *', true], ['paymentTerms', 'Điều khoản thanh toán *', true], ['deliveryTerms', 'Tiến độ / điều khoản giao hàng *', true], ['depositAmount', 'Tiền đặt cọc'], ['bankDetails', 'Thông tin tài khoản'], ['otherTerms', 'Điều khoản bổ sung']];
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.editorSheet}><View style={styles.sheetHandle} /><View style={styles.sheetHeader}><Text style={styles.sheetTitle}>Tạo hợp đồng từ dự toán</Text><Pressable onPress={onClose}><X size={18} color={colors.muted} /></Pressable></View><ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
    <Text style={styles.fieldLabel}>Dự toán đã duyệt</Text>{quotes.map((item) => <Pressable key={item._id} onPress={() => { setQuoteId(item._id); setForm((current) => ({ ...current, customerName: item.customerName, customerEmail: item.customerEmail, customerPhone: item.customerPhone ?? '' })); }} style={[styles.choiceRow, quoteId === item._id && styles.choiceSelected]}><Text style={styles.rowTitle}>{item.quoteNumber} · {item.customerName} · {money(item.total, item.currency)}</Text>{quoteId === item._id && <Check size={14} color={colors.primary} />}</Pressable>)}
    <Text style={styles.fieldLabel}>Mẫu hợp đồng</Text>{templates.map((item) => <Pressable key={item.id} onPress={() => setTemplateId(item.id)} style={[styles.choiceRow, templateId === item.id && styles.choiceSelected]}><Text style={styles.rowTitle}>{item.name || item.originalFilename} · {item.extension.toUpperCase()}</Text>{templateId === item.id && <Check size={14} color={colors.primary} />}</Pressable>)}
    {fields.map(([key, label, multiline]) => <Field key={key} label={label} value={form[key] ?? ''} onChangeText={(value) => set(key, value)} multiline={multiline} keyboardType={key === 'depositAmount' ? 'decimal-pad' : undefined} />)}
    {!!error && <ErrorCard error={error} />}
    <View style={styles.modalActions}><Pressable onPress={onClose} style={styles.cancelButton}><Text style={styles.cancelText}>Hủy</Text></Pressable><Pressable disabled={busy || !quote} onPress={() => { if (quote) void onSave(form, quote, templateId); }} style={[styles.primaryButton, busy && styles.disabled]}>{busy ? <ActivityIndicator size="small" color={colors.white} /> : <Check size={15} color={colors.white} />}<Text style={styles.primaryText}>Tạo hợp đồng</Text></Pressable></View>
  </ScrollView></View></View></Modal>;
}

type AcceptanceForm = { acceptedDate: string; startTime: string; endTime: string; location: string; result: string; handoverDetails: string; qualityAssessment: string; settlementAmount: string; amountPaid: string; paymentDueDays: string; notes: string; lines: Array<{ lineIndex: number; acceptedQuantity: string; acceptedDetails: string }> };
function AcceptanceCreateSheet({ visible, contracts, selectedContract, templates, busy, error, onClose, onSave }: { visible: boolean; contracts: QuotationContract[]; selectedContract: QuotationContract | null; templates: QuotationTemplate[]; busy: boolean; error: string; onClose: () => void; onSave: (form: AcceptanceForm, contract: QuotationContract, templateId: string) => Promise<void> }) {
  const [contractId, setContractId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [form, setForm] = useState<AcceptanceForm>({ acceptedDate: today(), startTime: '09:00', endTime: '17:00', location: '', result: '', handoverDetails: '', qualityAssessment: '', settlementAmount: '0', amountPaid: '0', paymentDueDays: '', notes: '', lines: [] });
  useEffect(() => {
    const contract = selectedContract || contracts.find((item) => item._id === contractId) || contracts[0];
    if (!visible || !contract) return;
    setContractId(contract._id); setTemplateId(templates.find((item) => item.extension === 'docx' || item.extension === 'xlsx')?.id ?? '');
    setForm((current) => ({ ...current, acceptedDate: today(), settlementAmount: String(contract.total), amountPaid: String(contract.depositAmount ?? 0), lines: contract.lines.map((_, index) => ({ lineIndex: index, acceptedQuantity: String(contract.lines[index]?.quantity ?? 0), acceptedDetails: '' })) }));
  }, [visible, selectedContract, contracts, templates]);
  const contract = selectedContract ?? contracts.find((item) => item._id === contractId) ?? undefined;
  function set(key: keyof Omit<AcceptanceForm, 'lines'>, value: string) { setForm((current) => ({ ...current, [key]: value })); }
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.editorSheet}><View style={styles.sheetHandle} /><View style={styles.sheetHeader}><Text style={styles.sheetTitle}>Tạo biên bản nghiệm thu</Text><Pressable onPress={onClose}><X size={18} color={colors.muted} /></Pressable></View><ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
    <Text style={styles.fieldLabel}>Hợp đồng đã ký</Text>{contracts.map((item) => <Pressable key={item._id} onPress={() => { setContractId(item._id); setForm((current) => ({ ...current, settlementAmount: String(item.total), amountPaid: String(item.depositAmount ?? 0), lines: item.lines.map((_, index) => ({ lineIndex: index, acceptedQuantity: String(item.lines[index]?.quantity ?? 0), acceptedDetails: '' })) })); }} style={[styles.choiceRow, contractId === item._id && styles.choiceSelected]}><Text style={styles.rowTitle}>{item.contractNumber} · {item.customerName}</Text>{contractId === item._id && <Check size={14} color={colors.primary} />}</Pressable>)}
    <Text style={styles.fieldLabel}>Mẫu nghiệm thu / quyết toán</Text>{templates.filter((item) => item.extension === 'docx' || item.extension === 'xlsx').map((item) => <Pressable key={item.id} onPress={() => setTemplateId(item.id)} style={[styles.choiceRow, templateId === item.id && styles.choiceSelected]}><Text style={styles.rowTitle}>{item.name || item.originalFilename}</Text>{templateId === item.id && <Check size={14} color={colors.primary} />}</Pressable>)}
    <Field label="Ngày nghiệm thu (YYYY-MM-DD) *" value={form.acceptedDate} onChangeText={(value) => set('acceptedDate', value)} />
    <View style={styles.twoColumns}><Field label="Bắt đầu (HH:mm) *" value={form.startTime} onChangeText={(value) => set('startTime', value)} /><Field label="Kết thúc (HH:mm) *" value={form.endTime} onChangeText={(value) => set('endTime', value)} /></View>
    <Field label="Địa điểm nghiệm thu *" value={form.location} onChangeText={(value) => set('location', value)} />
    <Field label="Kết quả nghiệm thu *" value={form.result} onChangeText={(value) => set('result', value)} multiline />
    <Field label="Hồ sơ bàn giao *" value={form.handoverDetails} onChangeText={(value) => set('handoverDetails', value)} multiline />
    <Field label="Đánh giá chất lượng *" value={form.qualityAssessment} onChangeText={(value) => set('qualityAssessment', value)} multiline />
    <View style={styles.twoColumns}><Field label="Giá trị quyết toán" value={form.settlementAmount} onChangeText={(value) => set('settlementAmount', value)} keyboardType="decimal-pad" /><Field label="Đã thanh toán" value={form.amountPaid} onChangeText={(value) => set('amountPaid', value)} keyboardType="decimal-pad" /></View>
    <Field label="Hạn thanh toán (ngày, để trống nếu chưa chốt)" value={form.paymentDueDays} onChangeText={(value) => set('paymentDueDays', value)} keyboardType="number-pad" />
    <Field label="Ghi chú" value={form.notes} onChangeText={(value) => set('notes', value)} multiline />
    {!!contract && <View style={styles.subSection}><Text style={styles.sectionTitle}>Khối lượng nghiệm thu</Text>{contract.lines.map((line, index) => <View key={`${line.catalogItemId}-${index}`} style={styles.acceptanceLine}><View style={styles.rowCopy}><Text style={styles.rowTitle}>{line.name}</Text><Text style={styles.mutedText}>Theo hợp đồng: {line.quantity} {line.unit}</Text></View><TextInput value={form.lines[index]?.acceptedQuantity ?? '0'} onChangeText={(value) => setForm((current) => ({ ...current, lines: current.lines.map((entry) => entry.lineIndex === index ? { ...entry, acceptedQuantity: value } : entry) }))} style={styles.quantityInput} keyboardType="decimal-pad" /></View>)}</View>}
    {!!error && <ErrorCard error={error} />}
    <View style={styles.modalActions}><Pressable onPress={onClose} style={styles.cancelButton}><Text style={styles.cancelText}>Hủy</Text></Pressable><Pressable disabled={busy || !contract} onPress={() => { if (contract) void onSave(form, contract, templateId); }} style={[styles.primaryButton, busy && styles.disabled]}>{busy ? <ActivityIndicator size="small" color={colors.white} /> : <Check size={15} color={colors.white} />}<Text style={styles.primaryText}>Lưu nghiệm thu</Text></Pressable></View>
  </ScrollView></View></View></Modal>;
}

function StatusPill({ label, complete }: { label: string; complete: boolean }) { return <View style={[styles.statusPill, complete && styles.statusPillComplete]}><Text style={[styles.statusPillText, complete && styles.statusPillTextComplete]}>{label}</Text></View>; }

function Field({ label, value, onChangeText, multiline, keyboardType }: { label: string; value: string; onChangeText: (value: string) => void; multiline?: boolean; keyboardType?: 'decimal-pad' | 'number-pad' | 'email-address' | 'phone-pad' | 'default' }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} style={[styles.input, multiline && styles.multiline]} placeholder={label.replace(/\s*\*$/, '')} placeholderTextColor={colors.muted} multiline={multiline} keyboardType={keyboardType} autoCapitalize={label.toLowerCase().includes('email') ? 'none' : undefined} />{multiline && <View style={styles.multilineSpacer} />}</View>;
}

function InfoRow({ label, value }: { label: string; value: string }) { return <View style={styles.infoRow}><Text style={styles.metaLabel}>{label}</Text><Text style={styles.infoValue}>{value || 'Chưa cập nhật'}</Text></View>; }
function ErrorCard({ error }: { error: string }) { return <Card style={styles.errorCard}><CircleAlert size={16} color="#B54745" /><Text style={styles.errorText}>{error}</Text></Card>; }

const styles = StyleSheet.create({
  container: { flex: 1 }, pageContent: { padding: 16, paddingBottom: 30 },
  panelTopAction: { alignItems: 'flex-end', marginBottom: 8 }, headerAction: { flexDirection: 'row', gap: 5, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 9, borderRadius: 11, backgroundColor: colors.primary }, headerActionText: { color: colors.white, fontSize: 9, fontWeight: '800' },
  formCard: { padding: 13, marginBottom: 13 }, sectionTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' }, input: { minHeight: 41, color: colors.ink, fontSize: 10, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.white }, multiline: { minHeight: 70, textAlignVertical: 'top' }, field: { flex: 1, marginBottom: 9 }, fieldLabel: { color: colors.ink, fontSize: 9, fontWeight: '700', marginBottom: 5 }, multilineSpacer: { height: 1 }, twoColumns: { flexDirection: 'row', gap: 8 }, primaryButton: { minHeight: 39, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 12, marginTop: 10, borderRadius: 10, backgroundColor: colors.primary }, primaryText: { color: colors.white, fontSize: 9, fontWeight: '800' }, secondaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: '#EEF4FF' }, secondaryText: { color: colors.primary, fontSize: 9, fontWeight: '800' }, cancelButton: { justifyContent: 'center', paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#E9EDF4' }, cancelText: { color: colors.ink, fontSize: 9, fontWeight: '800' }, disabled: { opacity: 0.5 },
  errorCard: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 10, marginVertical: 8, borderColor: '#F2D3D1' }, errorText: { flex: 1, color: '#A33D3A', fontSize: 9, lineHeight: 14 }, warningCard: { padding: 10, marginTop: 9, borderColor: '#F1D99B', backgroundColor: '#FFFCF2' }, warningHeading: { flexDirection: 'row', alignItems: 'center', gap: 6 }, warningTitle: { color: '#805600', fontSize: 10, fontWeight: '800', marginBottom: 5 }, dangerText: { color: '#B54745' }, successText: { color: '#16885A' }, mutedText: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 3 }, metaLabel: { color: colors.muted, fontSize: 8 }, metric: { color: colors.ink, fontSize: 10, fontWeight: '800', marginTop: 3 }, loader: { paddingVertical: 24 }, empty: { alignItems: 'center', padding: 20 }, emptyText: { color: colors.muted, fontSize: 10, textAlign: 'center', marginTop: 8 },
  detailCard: { padding: 12, marginBottom: 15, borderColor: '#D5E2FA' }, detailTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }, detailTitleCopy: { flex: 1 }, budgetTotals: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingVertical: 11, marginTop: 8, borderBottomWidth: 1, borderTopWidth: 1, borderColor: colors.border }, budgetLine: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, borderBottomWidth: 1, borderColor: '#F0F2F6' }, budgetLineCopy: { flex: 1 }, quantityEditor: { flexDirection: 'row', alignItems: 'center', gap: 4 }, quantityInput: { width: 48, minHeight: 32, textAlign: 'center', color: colors.ink, fontSize: 9, borderWidth: 1, borderColor: colors.border, borderRadius: 8 }, smallButton: { padding: 7 }, lineTotal: { color: colors.ink, fontSize: 9, fontWeight: '800' }, subSection: { marginTop: 13, gap: 7 }, questionCard: { padding: 9, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, borderRadius: 10, gap: 7 }, actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 11 }, planRow: { flexDirection: 'row', alignItems: 'center', padding: 11, marginBottom: 7, borderRadius: 14 }, rowIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF4FF', borderRadius: 10 }, rowCopy: { flex: 1, marginHorizontal: 8 }, rowTitle: { color: colors.ink, fontSize: 10, fontWeight: '800' }, rowMetric: { color: colors.muted, fontSize: 8, marginRight: 5 }, sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 8 }, sectionHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 7 }, searchBox: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 40, paddingHorizontal: 10, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 10 }, searchInput: { flex: 1, color: colors.ink, fontSize: 10, paddingVertical: 8 },
  chips: { gap: 7, paddingBottom: 10 }, chip: { paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: colors.white }, chipActive: { borderColor: '#C9DAFF', backgroundColor: '#EEF4FF' }, chipText: { color: colors.muted, fontSize: 8, fontWeight: '700' }, chipTextActive: { color: colors.primary }, chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, templateRow: { flexDirection: 'row', alignItems: 'center', padding: 10, marginTop: 7, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, borderRadius: 12 }, defaultBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 5, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 7, backgroundColor: '#E8F7F0' }, defaultBadgeText: { color: '#16885A', fontSize: 8, fontWeight: '700' }, iconButton: { padding: 7 }, moveCard: { padding: 10, marginTop: 8 },
  bulkBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7 }, bulkActions: { gap: 6, paddingVertical: 7 }, dangerButton: { backgroundColor: '#FFF8F7' }, catalogToolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 6 }, pageSelectButton: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 8 }, catalogPagination: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 5, paddingVertical: 10, marginTop: 6, borderTopWidth: 1, borderColor: colors.border }, pageSizeButton: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, backgroundColor: '#EEF4FF' }, paginationButtons: { flexDirection: 'row', alignItems: 'center', gap: 4 }, pageNumber: { color: colors.ink, fontSize: 9, fontWeight: '700' }, catalogRow: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 9, marginTop: 7, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.white }, checkbox: { width: 19, height: 19, borderWidth: 1, borderColor: '#BBC5D3', borderRadius: 6, alignItems: 'center', justifyContent: 'center' }, checkboxActive: { borderColor: colors.primary, backgroundColor: colors.primary }, fileRow: { flexDirection: 'row', gap: 7, alignItems: 'center', padding: 10, marginTop: 6 },
  workflowCard: { padding: 12, marginBottom: 8 }, workflowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 }, workflowMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderColor: colors.border }, statusPill: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: '#EEF1F6' }, statusPillComplete: { backgroundColor: '#E8F7F0' }, statusPillText: { color: '#52627A', fontSize: 8, fontWeight: '800' }, statusPillTextComplete: { color: '#16885A' }, alignStart: { alignSelf: 'flex-start', marginTop: 9 }, choiceList: { gap: 3, marginTop: 3 }, choiceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7, padding: 9, marginTop: 5, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.white }, choiceSelected: { borderColor: '#AFC7F6', backgroundColor: '#F5F8FF' }, lineDetailInput: { minHeight: 35, marginTop: 6, fontSize: 9 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(12,24,45,0.38)' }, editorSheet: { maxHeight: '94%', minHeight: '62%', backgroundColor: colors.background, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 15, paddingBottom: 20 }, detailSheet: { maxHeight: '90%', minHeight: '55%', backgroundColor: colors.background, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 15, paddingBottom: 18 }, importSheet: { maxHeight: '96%', minHeight: '74%', backgroundColor: colors.background, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 15, paddingBottom: 20 }, importSheetCard: { padding: 10, marginTop: 10 }, mappingColumn: { paddingTop: 8, marginTop: 8, borderTopWidth: 1, borderColor: colors.border }, roleOptions: { gap: 5, paddingVertical: 6 }, sheetHandle: { width: 38, height: 4, borderRadius: 3, alignSelf: 'center', marginVertical: 10, backgroundColor: '#CBD3DF' }, sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 11, borderBottomWidth: 1, borderColor: colors.border }, sheetTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' }, sheetSubtitle: { color: colors.muted, fontSize: 9, marginTop: 3 }, formContent: { paddingTop: 10, paddingBottom: 20 }, modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, paddingTop: 9 }, infoRow: { flexDirection: 'row', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderColor: '#EDF0F5' }, infoValue: { flex: 1, color: colors.ink, fontSize: 9, textAlign: 'right' }, acceptanceLine: { flexDirection: 'row', alignItems: 'center', padding: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 10 },
  generatedFilePanel: { padding: 10, marginTop: 10, borderWidth: 1, borderColor: '#DCE5F2', borderRadius: 12, backgroundColor: colors.white, gap: 5 }, exportError: { color: '#A33D3A', fontSize: 9, lineHeight: 14 },
});
