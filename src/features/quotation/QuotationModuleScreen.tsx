import { withAppLockSuspended } from '@/core/auth/appLockSuspension';
import { PopupError } from '@/components/PopupError';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  ArrowLeft,
  BriefcaseBusiness,
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleDollarSign,
  Clock3,
  FileText,
  Files,
  Mail,
  Package,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Trash2,
  UserRound,
  X,
  Paperclip,
} from 'lucide-react-native';
import { Stack } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Card } from '@/components/Card';
import { showAppAlert, showHrConfirm } from '@/features/hr/components/HrConfirmModal';
import { useAuth } from '@/core/auth/AuthProvider';
import { fetchCompanyBranches, type ErpBranch } from '@/features/overview/overviewApi';
import {
  analyzeQuoteRequest,
  approveQuote,
  createCustomerQuote,
  createEstimateFromCustomerQuote,
  suggestCustomerQuote,
  createEstimate,
  createQuoteRequest,
  deleteQuote,
  downloadGeneratedFile,
  getLatestGeneratedFile,
  getQuote,
  listQuotes,
  loadCatalog,
  loadQuoteTemplates,
  queueDraftEstimateExport,
  queueEstimateExport,
  rejectQuote,
  retryCustomerQuoteExport,
  searchErpQuotationCustomers,
  submitQuoteForReview,
  uploadQuoteRequestFile,
  updateQuote,
} from '@/features/quotation/quotationApi';
import type {
  AnalysisItem,
  CatalogItem,
  Quote,
  QuoteAnalysis,
  QuoteKind,
  QuoteListStats,
  QuoteStatus,
  QuoteTemplate,
  QuotationScope,
} from '@/features/quotation/types';
import { saveAndShareExport } from '@/features/quotation/fileExport';
import { DateTimeField } from '@/features/quotation/DateTimeField';
import { BudgetPlannerPanel, CatalogPanel, ContractWorkflowPanel, GeneratedFileActions, QuoteTemplatePanel } from '@/features/quotation/QuotationExtraPanels';
import { colors } from '@/theme/colors';

const emptyStats: QuoteListStats = {
  total: 0,
  drafts: 0,
  pending: 0,
  approved: 0,
  needsInfo: 0,
  rejected: 0,
  approvedRevenue: 0,
};

const filters: Array<{ label: string; value?: QuoteStatus }> = [
  { label: 'Tất cả' },
  { label: 'Bản nháp', value: 'draft' },
  { label: 'Chờ duyệt', value: 'pending_review' },
  { label: 'Cần bổ sung', value: 'needs_info' },
  { label: 'Đã duyệt', value: 'approved' },
  { label: 'Đã trả lại', value: 'rejected' },
];

function hasPermission(permissions: string[] | undefined, permission: string) {
  return Boolean(permissions?.includes('*') || permissions?.includes(permission)
    || (permission.endsWith(':read') && permissions?.includes(permission.replace(/:read$/, ':manage'))));
}

function makeIdempotencyKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

function statusLabel(status: QuoteStatus) {
  const labels: Record<QuoteStatus, string> = {
    draft: 'Bản nháp',
    needs_info: 'Cần bổ sung',
    pending_review: 'Chờ duyệt',
    approved: 'Đã duyệt',
    rejected: 'Đã trả lại',
  };
  return labels[status] ?? status;
}

function statusColor(status: QuoteStatus) {
  if (status === 'approved') return { color: '#16885A', backgroundColor: '#E8F7F0' };
  if (status === 'pending_review') return { color: '#9A6500', backgroundColor: '#FFF4D8' };
  if (status === 'needs_info' || status === 'rejected') return { color: '#B54745', backgroundColor: '#FDEDEC' };
  return { color: '#52627A', backgroundColor: '#EEF1F6' };
}

function normalizedMissingInformation(value: string) {
  return value.toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
}

function isSupplementalQuestion(value: string) {
  return normalizedMissingInformation(value).trim().startsWith('cau hoi bo sung:');
}

function isTaxMissingInformation(value: string) {
  return !isSupplementalQuestion(value) && /\b(vat|thue|tax)\b/.test(normalizedMissingInformation(value));
}

function isShippingMissingInformation(value: string) {
  return !isSupplementalQuestion(value) && /\b(van chuyen|shipping|phi giao hang|delivery fee)\b/.test(normalizedMissingInformation(value));
}

function isSupplementalProductInformation(value: string) {
  const text = normalizedMissingInformation(value);
  return !text.startsWith('cau hoi bo sung:') && /\b(san pham|mat hang|hang muc|nhan cong|vat tu|don gia|gia|ma hang|ma san pham|product|item|labor|material|sku|price|pricing|mosaic|op lat|gach|trang tri|decoration|finishing|installation|thi cong|lap dat)\b/.test(text);
}

function formatDate(value?: string | null) {
  if (!value) return 'Chưa cập nhật';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa cập nhật';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function formatMoney(amount: number, _currency = 'VND') {
  const num = Number(amount ?? 0);
  const safe = Number.isFinite(num) ? Math.round(num) : 0;
  const sign = safe < 0 ? '-' : '';
  const digits = Math.abs(safe).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${digits} VND`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Không thể hoàn tất thao tác với ERP.';
}

type QuotationSection = 'budget' | 'customerQuotes' | 'estimates' | 'contracts' | 'acceptance' | 'templates' | 'catalog';

export function QuotationModuleScreen() {
  const {
    user,
    activeBranchId: selectedBranchId,
    setActiveBranchId: setSelectedBranchId,
  } = useAuth();
  const [quoteForContract, setQuoteForContract] = useState<Quote | null>(null);
  const isAdmin = user?.role === 'superadmin' || user?.role === 'admin';
  const userBranchId = user?.branchId;
  const companyCode = user?.companyCode;
  const canSwitchBranch = isAdmin || !userBranchId;
  const [branches, setBranches] = useState<ErpBranch[]>([]);
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  useEffect(() => {
    if (!companyCode || (!canSwitchBranch && userBranchId)) {
      if (userBranchId) setSelectedBranchId(userBranchId);
      return;
    }
    const controller = new AbortController();
    void fetchCompanyBranches(controller.signal).then((list) => {
      if (controller.signal.aborted) return;
      setBranches(list);
      setSelectedBranchId((current) => {
        if (current && list.some((branch) => branch._id === current)) return current;
        if (userBranchId && list.some((branch) => branch._id === userBranchId)) return userBranchId;
        return list[0]?._id ?? '';
      });
    }).catch(() => {});
    return () => controller.abort();
  }, [canSwitchBranch, userBranchId, companyCode]);
  const permissions = user?.permissions;
  const allNavigation: Array<{ key: QuotationSection; label: string; permission: string; icon: typeof FileText }> = [
    { key: 'budget', label: 'Ngân sách', permission: 'quotation:read', icon: CircleDollarSign },
    { key: 'customerQuotes', label: 'Báo giá khách', permission: 'quotation:read', icon: Package },
    { key: 'estimates', label: 'Dự toán', permission: 'quotation:read', icon: FileText },
    { key: 'contracts', label: 'Hợp đồng', permission: 'quotation-contract:read', icon: BriefcaseBusiness },
    { key: 'acceptance', label: 'Nghiệm thu', permission: 'quotation-acceptance:read', icon: Check },
    { key: 'templates', label: 'Mẫu tài liệu', permission: 'quotation-template:read', icon: Files },
    { key: 'catalog', label: 'Bảng giá', permission: 'quotation-price-book:read', icon: Package },
  ];
  const navigation = allNavigation.filter((item) => hasPermission(permissions, item.permission));
  const [section, setSection] = useState<QuotationSection>('estimates');
  const activeSection = navigation.some((item) => item.key === section) ? section : navigation[0]?.key ?? 'estimates';
  const activeBranchId = selectedBranchId || user?.branchId || undefined;
  const activeBranchName = activeBranchId
    ? branches.find((branch) => branch._id === activeBranchId)?.name || (activeBranchId === user?.branchId ? user?.branchName : undefined) || 'Chọn chi nhánh'
    : 'Chọn chi nhánh';
  const scope = useMemo<QuotationScope>(() => ({ companyCode: user?.companyCode, branchId: activeBranchId }), [activeBranchId, user?.companyCode]);
  const sectionTitles: Record<QuotationSection, string> = {
    budget: 'Ngân sách', customerQuotes: 'Báo giá khách', estimates: 'Dự toán', contracts: 'Hợp đồng', acceptance: 'Nghiệm thu', templates: 'Mẫu tài liệu', catalog: 'Bảng giá',
  };
  return <View style={styles.moduleContainer}>
    <Stack.Screen
      options={{
        title: 'Báo giá',
        headerBackTitle: 'Trở lại',
        headerTintColor: colors.ink,
        headerRight: branches.length > 0 && canSwitchBranch
          ? () => (
              <Pressable onPress={() => setBranchModalOpen(true)} style={styles.headerBranchBtn}>
                <View style={styles.branchBtnContent}>
                  <Text numberOfLines={1} style={styles.branchBtnText}>{activeBranchName}</Text>
                  <ChevronDown size={14} color={colors.primary} />
                </View>
              </Pressable>
            )
          : undefined,
      }}
    />
    <ScrollView horizontal style={styles.moduleNavigationScroll} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moduleNavigation}>
      {navigation.map((item) => {
        const Icon = item.icon;
        const active = activeSection === item.key;
        return <Pressable key={item.key} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => setSection(item.key)} style={[styles.moduleNavItem, active && styles.moduleNavItemActive]}><Icon size={15} color={active ? colors.white : colors.muted} /><Text style={[styles.moduleNavText, active && styles.moduleNavTextActive]}>{item.label}</Text></Pressable>;
      })}
    </ScrollView>
    <View style={styles.moduleContent}>
      {activeSection === 'estimates' && <QuoteWorkspaceScreen kind="estimate" scope={scope} onCreateContract={(quote) => { setQuoteForContract(quote); setSection('contracts'); }} />}
      {activeSection === 'customerQuotes' && <QuoteWorkspaceScreen kind="customer" scope={scope} onEstimateCreated={() => setSection('estimates')} />}
      {activeSection === 'budget' && <BudgetPlannerPanel scope={scope} canManage={hasPermission(permissions, 'quotation:manage')} canManageCatalog={hasPermission(permissions, 'quotation-price-book:manage')} canUseAi={hasPermission(permissions, 'quotation-ai:manage')} />}
      {activeSection === 'contracts' && <ContractWorkflowPanel scope={scope} view="contracts" initialQuote={quoteForContract} onInitialQuoteHandled={() => setQuoteForContract(null)} canReadContracts={hasPermission(permissions, 'quotation-contract:read')} canReadAcceptances={hasPermission(permissions, 'quotation-acceptance:read')} canReadTemplates={hasPermission(permissions, 'quotation-template:read')} canManage={hasPermission(permissions, 'quotation-contract:manage')} canManageAcceptance={hasPermission(permissions, 'quotation-acceptance:manage')} canUseAi={hasPermission(permissions, 'quotation-ai:manage')} />}
      {activeSection === 'acceptance' && <ContractWorkflowPanel scope={scope} view="acceptances" canReadContracts={hasPermission(permissions, 'quotation-contract:read')} canReadAcceptances={hasPermission(permissions, 'quotation-acceptance:read')} canReadTemplates={hasPermission(permissions, 'quotation-template:read')} canManage={hasPermission(permissions, 'quotation-acceptance:manage')} canManageAcceptance={hasPermission(permissions, 'quotation-acceptance:manage')} canUseAi={hasPermission(permissions, 'quotation-ai:manage')} />}
      {activeSection === 'templates' && <QuoteTemplatePanel scope={scope} canManage={hasPermission(permissions, 'quotation-template:manage')} />}
      {activeSection === 'catalog' && <CatalogPanel scope={scope} canManage={hasPermission(permissions, 'quotation-price-book:manage')} />}
      {!navigation.length && <View style={styles.permissionState}><FileText size={25} color={colors.primary} /><Text style={styles.permissionTitle}>{sectionTitles[activeSection]}</Text><Text style={styles.permissionCopy}>Tài khoản chưa được cấp quyền truy cập các mục Báo giá.</Text></View>}
    </View>
    <Modal visible={branchModalOpen} transparent animationType="slide" onRequestClose={() => setBranchModalOpen(false)}>
      <Pressable style={styles.branchBackdrop} onPress={() => setBranchModalOpen(false)}>
        <Pressable style={styles.branchSheet} onPress={() => {}}>
          <View style={styles.branchSheetHeader}>
            <Text style={styles.branchSheetTitle}>Chọn chi nhánh</Text>
            <Pressable onPress={() => setBranchModalOpen(false)} style={styles.branchCloseButton} accessibilityLabel="Đóng chọn chi nhánh"><X size={18} color={colors.muted} /></Pressable>
          </View>
          <ScrollView style={styles.branchList}>
            {branches.map((branch) => {
              const selected = branch._id === activeBranchId;
              return (
                <Pressable
                  key={branch._id}
                  onPress={() => { setSelectedBranchId(branch._id); setBranchModalOpen(false); }}
                  style={[styles.branchRow, selected && styles.branchRowActive]}
                >
                  <Text numberOfLines={1} style={styles.branchRowTitle}>{branch.name}</Text>
                  {selected ? <Check size={17} color={colors.primary} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  </View>;
}

function QuoteWorkspaceScreen({ kind, scope, onEstimateCreated, onCreateContract }: { kind: QuoteKind; scope: QuotationScope; onEstimateCreated?: () => void; onCreateContract?: (quote: Quote) => void }) {
  const { user } = useAuth();
  const scopeReady = Boolean(scope.companyCode && scope.branchId);
  const permissions = user?.permissions;
  const canRead = hasPermission(permissions, 'quotation:read');
  const canManage = hasPermission(permissions, 'quotation:manage');
  const canApprove = hasPermission(permissions, 'quotation-approval:manage');
  const canUseAi = hasPermission(permissions, 'quotation-ai:manage');
  const canManageContract = hasPermission(permissions, 'quotation-contract:manage');
  const canCreate = canManage
    && hasPermission(permissions, 'quotation-ai:manage')
    && hasPermission(permissions, 'quotation-template:read')
    && hasPermission(permissions, 'quotation-price-book:read');
  const canSelectErpCustomers = Boolean(user?.enabledModules?.includes('customer') && hasPermission(permissions, 'customer:read'));

  const [status, setStatus] = useState<QuoteStatus | undefined>();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<QuoteListStats>(emptyStats);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailQuote, setDetailQuote] = useState<Quote | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [creatingEstimateFromQuote, setCreatingEstimateFromQuote] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    if (!canRead || !user || !scopeReady) {
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    setError('');
    void listQuotes(scope, { kind, status, search: debouncedSearch, page })
      .then((result) => {
        if (!active) return;
        setQuotes(result.quotes ?? []);
        setPage(result.page || 1);
        setTotalPages(result.totalPages || 1);
        setTotal(result.total || 0);
        setStats(result.stats ?? emptyStats);
      })
      .catch((cause) => { if (active) setError(errorMessage(cause)); })
      .finally(() => { if (active) { setLoading(false); setRefreshing(false); } });
    return () => { active = false; };
  }, [canRead, debouncedSearch, kind, page, reloadKey, scope, scopeReady, status, user]);

  useEffect(() => {
    if (!selectedId) {
      setDetailQuote(null);
      setDetailLoading(false);
      return;
    }
    let active = true;
    setDetailLoading(true);
    void getQuote(scope, selectedId)
      .then((quote) => { if (active) setDetailQuote(quote); })
      .catch((cause) => { if (active) showAppAlert({ title: 'Không tải được báo giá', message: errorMessage(cause), tone: 'danger' }); })
      .finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [scope, selectedId, reloadKey]);

  function refresh() {
    setRefreshing(true);
    setReloadKey((value) => value + 1);
  }

  async function runQuoteAction(action: 'submit' | 'approve' | 'reject' | 'delete', reason?: string, changes?: Record<string, unknown>) {
    if (!detailQuote) return;
    setActionBusy(true);
    try {
      if (action === 'submit') await submitQuoteForReview(scope, detailQuote);
      if (action === 'approve') {
        const target = changes ? await updateQuote(scope, detailQuote, changes) : detailQuote;
        await approveQuote(scope, target);
      }
      if (action === 'reject') await rejectQuote(scope, detailQuote, reason || '');
      if (action === 'delete') await deleteQuote(scope, detailQuote);
      setReloadKey((value) => value + 1);
      if (action === 'delete') setSelectedId(null);
    } catch (cause) {
      showAppAlert({ title: 'Chưa cập nhật được báo giá', message: errorMessage(cause), tone: 'danger' });
    } finally {
      setActionBusy(false);
    }
  }

  async function saveQuoteChanges(changes: Record<string, unknown>, recalculateWithAi = false) {
    if (!detailQuote) return;
    setActionBusy(true);
    try {
      const updated = await updateQuote(scope, detailQuote, { ...changes, ...(recalculateWithAi ? { recalculateWithAi: true } : {}) });
      setDetailQuote(updated);
      setReloadKey((value) => value + 1);
      showAppAlert({
        title: recalculateWithAi ? 'Đã tính lại dự toán' : 'Đã lưu báo giá',
        message: recalculateWithAi ? 'AI đã cập nhật dự toán theo thông tin mới.' : 'Các thay đổi đã được lưu vào ERP.',
        tone: 'success',
      });
    } catch (cause) { showAppAlert({ title: 'Chưa lưu được báo giá', message: errorMessage(cause), tone: 'danger' }); }
    finally { setActionBusy(false); }
  }

  function confirmDelete() {
    showHrConfirm({
      title: 'Xóa báo giá?',
      message: `Báo giá ${detailQuote?.quoteNumber ?? ''} sẽ bị xóa khỏi ERP.`,
      confirmLabel: 'Xóa',
      onConfirm: async () => {
        await runQuoteAction('delete');
      },
    });
  }

  if (!canRead) {
    return <View style={styles.permissionState}><FileText size={26} color={colors.primary} /><Text style={styles.permissionTitle}>Chưa có quyền xem Báo giá</Text><Text style={styles.permissionCopy}>Liên hệ quản trị ERP để được cấp quyền quotation:read.</Text></View>;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <View style={styles.statsRow}>
          <Card style={styles.statCard}><Text style={styles.statValue}>{stats.total}</Text><Text numberOfLines={2} style={styles.statLabel}>Tổng số</Text></Card>
          <Card style={styles.statCard}><Text style={styles.statValue}>{stats.pending}</Text><Text numberOfLines={2} style={styles.statLabel}>Chờ duyệt</Text></Card>
          <Card style={styles.statCard}><Text numberOfLines={1} adjustsFontSizeToFit style={styles.statValueSmall}>{formatMoney(stats.approvedRevenue)}</Text><Text numberOfLines={2} style={styles.statLabel}>Doanh thu đã duyệt</Text></Card>
        </View>

        <View style={styles.searchBox}><Search size={17} color={colors.muted} /><TextInput value={search} onChangeText={(value) => { setSearch(value); setPage(1); }} placeholder="Tìm mã báo giá, khách hàng..." placeholderTextColor={colors.muted} style={styles.searchInput} returnKeyType="search" /><Pressable onPress={refresh} style={styles.refreshButton} accessibilityLabel="Tải lại danh sách"><RefreshCw size={16} color={colors.primary} /></Pressable></View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {filters.map((item) => <Pressable key={item.label} onPress={() => { setStatus(item.value); setPage(1); }} style={[styles.filterChip, status === item.value && styles.filterChipActive]}><Text style={[styles.filterText, status === item.value && styles.filterTextActive]}>{item.label}</Text></Pressable>)}
        </ScrollView>

        <View style={styles.listHeading}><View><Text style={styles.listTitle}>{kind === 'estimate' ? 'Danh sách dự toán' : 'Danh sách báo giá khách'}</Text><Text style={styles.listSubtitle}>{total} chứng từ trong ERP</Text></View><View style={styles.listHeadingActions}>{canCreate && <Pressable onPress={() => setCreating(true)} style={styles.primaryIconButton} accessibilityLabel="Tạo báo giá"><Plus size={19} color={colors.white} /></Pressable>}<Text style={styles.pageLabel}>{page}/{totalPages}</Text></View></View>

        {!scopeReady && <PopupError error="Chưa xác định được doanh nghiệp hoặc chi nhánh làm việc trong ERP." title="Chưa có phạm vi làm việc" />}
        {!!error && <PopupError error={error} title="Không tải được báo giá" onRetry={refresh} />}

        {loading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : quotes.map((quote) => <QuoteRow key={quote._id} quote={quote} onPress={() => setSelectedId(quote._id)} />)}
        {scopeReady && !loading && !error && quotes.length === 0 && <Card style={styles.emptyCard}><FileText size={24} color={colors.muted} /><Text style={styles.emptyTitle}>Chưa có báo giá</Text><Text style={styles.emptyCopy}>{search || status ? 'Thử đổi bộ lọc hoặc từ khóa tìm kiếm.' : 'Báo giá được tạo trên ERP sẽ xuất hiện tại đây.'}</Text>{canCreate && <Pressable style={styles.emptyButton} onPress={() => setCreating(true)}><Plus size={15} color={colors.primary} /><Text style={styles.emptyButtonText}>Tạo báo giá</Text></Pressable>}</Card>}

        {totalPages > 1 && <View style={styles.pagination}><Pressable disabled={page <= 1} onPress={() => setPage((value) => Math.max(1, value - 1))} style={[styles.pageButton, page <= 1 && styles.disabledButton]}><ChevronLeft size={17} color={page <= 1 ? '#B7C0CF' : colors.ink} /><Text style={styles.pageButtonText}>Trước</Text></Pressable><Text style={styles.pageLabel}>Trang {page} / {totalPages}</Text><Pressable disabled={page >= totalPages} onPress={() => setPage((value) => Math.min(totalPages, value + 1))} style={[styles.pageButton, page >= totalPages && styles.disabledButton]}><Text style={styles.pageButtonText}>Sau</Text><ChevronRight size={17} color={page >= totalPages ? '#B7C0CF' : colors.ink} /></Pressable></View>}
      </ScrollView>

      <Modal visible={creating} transparent animationType="slide" onRequestClose={() => setCreating(false)}>
        <NewQuoteSheet kind={kind} scope={scope} canSelectErpCustomers={canSelectErpCustomers} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); setPage(1); setReloadKey((value) => value + 1); }} />
      </Modal>

      <Modal visible={Boolean(selectedId)} transparent animationType="slide" onRequestClose={() => setSelectedId(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.detailSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}><Text style={styles.sheetTitle}>Chi tiết báo giá</Text><Pressable onPress={() => setSelectedId(null)} style={styles.closeButton}><X size={19} color={colors.muted} /></Pressable></View>
            {detailLoading || !detailQuote ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : <QuoteDetail
              quote={detailQuote}
              scope={scope}
              canManage={canManage}
              canApprove={canApprove}
              canManageContract={canManageContract}
              canUseAi={canUseAi}
              busy={actionBusy}
              onCreateEstimate={() => setCreatingEstimateFromQuote(true)}
              onCreateContract={() => { if (detailQuote) onCreateContract?.(detailQuote); }}
              onSave={(changes) => saveQuoteChanges(changes)}
              onRecalculate={(changes) => saveQuoteChanges(changes, true)}
              onSubmit={() => { void runQuoteAction('submit'); }}
              onApprove={(changes) => { void runQuoteAction('approve', undefined, changes); }}
              onReject={(reason) => { void runQuoteAction('reject', reason); }}
              onDelete={confirmDelete}
            />}
          </View>
        </View>
      </Modal>

      {kind === 'customer' && detailQuote && <Modal visible={creatingEstimateFromQuote} transparent animationType="slide" onRequestClose={() => setCreatingEstimateFromQuote(false)}>
        <EstimateFromCustomerQuoteSheet scope={scope} quote={detailQuote} onClose={() => setCreatingEstimateFromQuote(false)} onCreated={() => { setCreatingEstimateFromQuote(false); setSelectedId(null); onEstimateCreated?.(); }} />
      </Modal>}
    </View>
  );
}

function QuoteRow({ quote, onPress }: { quote: Quote; onPress: () => void }) {
  const badge = statusColor(quote.status);
  return <Card onPress={onPress} style={styles.quoteRow}>
    <View style={styles.quoteRowTop}>
      <View style={styles.quoteDocIcon}><FileText size={18} color={colors.primary} /></View>
      <View style={styles.quoteRowCopy}>
        <View style={styles.quoteHeading}>
          <Text numberOfLines={1} style={styles.quoteNumber}>{quote.quoteNumber}</Text>
          <View style={[styles.statusBadge, { backgroundColor: badge.backgroundColor }]}>
            <Text numberOfLines={1} style={[styles.statusText, { color: badge.color }]}>{statusLabel(quote.status)}</Text>
          </View>
        </View>
        <Text numberOfLines={2} style={styles.customerName}>{quote.customerName || 'Khách hàng chưa xác định'}</Text>
      </View>
    </View>

    <View style={styles.quoteMetaRow}>
      <View style={styles.metaChip}><CalendarDays size={13} color={colors.muted} /><Text style={styles.metaText}>{formatDate(quote.createdAt)}</Text></View>
      <View style={styles.metaChip}><Package size={13} color={colors.muted} /><Text style={styles.metaText}>{quote.lines?.length ?? 0} mặt hàng</Text></View>
    </View>

    <View style={styles.quoteRowBottom}>
      <View style={styles.quoteTotalBlock}>
        <Text style={styles.quoteTotalLabel}>Tổng báo giá</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit style={styles.quoteTotal}>{formatMoney(quote.total, quote.currency)}</Text>
      </View>
      <View style={styles.quoteChevron}><ChevronRight size={17} color={colors.primary} /></View>
    </View>
  </Card>;
}

function QuoteDetail({
  quote,
  scope,
  canManage,
  canApprove,
  canManageContract,
  canUseAi,
  busy,
  onCreateEstimate,
  onCreateContract,
  onSubmit,
  onApprove,
  onReject,
  onDelete,
  onSave,
  onRecalculate,
}: {
  quote: Quote;
  scope: QuotationScope;
  canManage: boolean;
  canApprove: boolean;
  canManageContract: boolean;
  canUseAi: boolean;
  busy: boolean;
  onCreateEstimate: () => void;
  onCreateContract: () => void;
  onSubmit: () => void;
  onApprove: (changes?: Record<string, unknown>) => void;
  onReject: (reason: string) => void;
  onDelete: () => void;
  onSave: (changes: Record<string, unknown>) => void;
  onRecalculate: (changes: Record<string, unknown>) => void;
}) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [supplementalProducts, setSupplementalProducts] = useState<Array<{ id: string; informationField?: string; name: string; description: string; unit: string; quantity: string; unitPrice: string; priceUnavailable?: boolean }>>([]);
  const [customerName, setCustomerName] = useState(quote.customerName);
  const [customerEmail, setCustomerEmail] = useState(quote.customerEmail);
  const [customerPhone, setCustomerPhone] = useState(quote.customerPhone ?? '');
  const [taxRate, setTaxRate] = useState(String((quote.taxRate ?? 0) * 100));
  const [taxConfirmed, setTaxConfirmed] = useState(quote.taxRateConfirmed ?? !quote.informationNeeded.some(isTaxMissingInformation));
  const [shippingMode, setShippingMode] = useState<'unconfirmed' | 'free' | 'paid'>(quote.shippingFeeConfirmed === false || quote.shippingFeeConfirmed === undefined && quote.shippingFee == null && quote.informationNeeded.some(isShippingMissingInformation) ? 'unconfirmed' : (quote.shippingFee ?? 0) > 0 ? 'paid' : 'free');
  const [shippingFee, setShippingFee] = useState(quote.shippingFee == null ? '' : String(quote.shippingFee));
  const [validityDays, setValidityDays] = useState(quote.validityDays == null ? '' : String(quote.validityDays));
  const [completionDate, setCompletionDate] = useState(quote.completionDate ?? '');
  const [additionalInformation, setAdditionalInformation] = useState<Record<string, string>>(quote.additionalInformation ?? {});
  const [revisionRequirements, setRevisionRequirements] = useState(quote.revisionRequirements ?? '');
  const [savedExport, setSavedExport] = useState<{ id: string; filename: string; mimeType?: string; createdAt?: string } | null>(null);
  const [exportJobStatus, setExportJobStatus] = useState<'queued' | 'running' | 'completed' | 'failed' | ''>('');
  const [exportError, setExportError] = useState('');
  const [exportBusy, setExportBusy] = useState(false);
  const [exportRefresh, setExportRefresh] = useState(0);
  const badge = statusColor(quote.status);
  const canApproveThis = canApprove && (quote.status === 'draft' || quote.status === 'needs_info' || quote.status === 'pending_review' || (quote.kind === 'customer' && quote.status === 'rejected'));
  const editable = canManage && (quote.status === 'draft' || quote.status === 'needs_info' || quote.status === 'pending_review' || quote.status === 'rejected');
  const hasUnpricedSupplemental = supplementalProducts.some((item) => item.priceUnavailable || !item.unitPrice.trim());
  const customerExportOutdated = Boolean(savedExport && (!savedExport.createdAt || new Date(savedExport.createdAt).getTime() < new Date(quote.updatedAt).getTime()));
  const hasIncompleteSupplementalProduct = supplementalProducts.some((item) => {
    const hasContent = Boolean(item.name.trim() || item.description.trim() || item.unit.trim() || item.quantity.trim() || item.unitPrice.trim());
    if (!hasContent) return false;
    const quantity = Number(item.quantity);
    const price = Number(item.unitPrice);
    return !item.name.trim() || !item.unit.trim() || !Number.isFinite(quantity) || quantity <= 0
      || (!item.unitPrice.trim() && !canUseAi) || (item.unitPrice.trim() && (!Number.isFinite(price) || price < 0));
  });
  const unresolvedInformation = quote.informationNeeded.filter((field) => {
    if (isTaxMissingInformation(field) || isShippingMissingInformation(field)) return false;
    if (isSupplementalProductInformation(field)) return !supplementalProducts.some((item) => item.informationField === field
      && item.name.trim() && item.unit.trim() && Number(item.quantity) > 0 && item.unitPrice.trim() && Number.isFinite(Number(item.unitPrice)) && Number(item.unitPrice) >= 0);
    return !additionalInformation[field]?.trim();
  });
  const savedTaxConfirmed = quote.taxRateConfirmed ?? !quote.informationNeeded.some(isTaxMissingInformation);
  const savedShippingConfirmed = quote.shippingFeeConfirmed ?? (quote.shippingFee != null || !quote.informationNeeded.some(isShippingMissingInformation));
  const shippingFeeIsConfirmed = shippingMode === 'free' || (shippingMode === 'paid' && Boolean(shippingFee.trim()) && Number.isFinite(Number(shippingFee)) && Number(shippingFee) > 0);
  const savedShippingFee = savedShippingConfirmed ? quote.shippingFee ?? 0 : null;
  const currentShippingFee = shippingMode === 'unconfirmed' ? null : shippingMode === 'free' ? 0 : shippingFee.trim() ? Number(shippingFee) : null;
  const additionalInformationChanged = [...new Set([...Object.keys(quote.additionalInformation ?? {}), ...Object.keys(additionalInformation)])]
    .some((field) => (quote.additionalInformation?.[field] ?? '').trim() !== (additionalInformation[field] ?? '').trim());
  const supplementalSnapshot = (items: typeof supplementalProducts) => items.filter((item) => item.name.trim() || item.description.trim() || item.unit.trim() || item.quantity.trim() || item.unitPrice.trim())
    .map((item) => ({ informationField: item.informationField ?? '', name: item.name.trim(), description: item.description.trim(), unit: item.unit.trim(), quantity: item.quantity.trim(), unitPrice: item.unitPrice.trim() }));
  const savedSupplementalProducts = quote.lines.filter((line) => line.source === 'supplemental').map((line, index) => ({
    id: line.catalogItemId || `saved-${index}`, informationField: line.supplementalFor, name: line.name, description: line.description ?? '', unit: line.unit,
    quantity: String(line.quantity), unitPrice: line.priceUnavailable ? '' : String(line.unitPrice), priceUnavailable: line.priceUnavailable,
  }));
  const hasUnsavedChanges = quote.lines.some((line) => line.source !== 'supplemental' && String(quantities[line.catalogItemId] ?? line.quantity) !== String(line.quantity))
    || JSON.stringify(supplementalSnapshot(supplementalProducts)) !== JSON.stringify(supplementalSnapshot(savedSupplementalProducts))
    || customerName !== quote.customerName || customerEmail !== quote.customerEmail || customerPhone !== (quote.customerPhone ?? '')
    || Number(taxRate || 0) !== (quote.taxRate ?? 0) * 100 || taxConfirmed !== savedTaxConfirmed
    || shippingFeeIsConfirmed !== savedShippingConfirmed || currentShippingFee !== savedShippingFee
    || (validityDays.trim() ? Number(validityDays) : null) !== (quote.validityDays ?? null)
    || (completionDate || null) !== (quote.completionDate ?? null) || additionalInformationChanged
    || revisionRequirements.trim() !== (quote.revisionRequirements ?? '');
  const needsAiRecalculation = quote.requiresAiRecalculation === true || additionalInformationChanged || revisionRequirements.trim() !== (quote.revisionRequirements ?? '');
  const approvalBlockers = quote.kind !== 'customer' && (
    unresolvedInformation.some((field) => !isSupplementalQuestion(field)) || !taxConfirmed || !taxRate.trim()
    || !shippingFeeIsConfirmed || needsAiRecalculation || hasUnpricedSupplemental || quote.lines.some((line) => line.priceUnavailable && line.source !== 'supplemental')
  );
  const hasUnresolvedInformation = unresolvedInformation.length > 0 || !taxConfirmed || !taxRate.trim() || !shippingFeeIsConfirmed || needsAiRecalculation || hasUnpricedSupplemental;
  const liveSubtotal = quote.lines.filter((line) => line.source !== 'supplemental').reduce((sum, line) => {
    const quantity = Number(quantities[line.catalogItemId] ?? line.quantity) || 0;
    return sum + Math.round((quantity * line.unitPrice + Number.EPSILON) * 100) / 100;
  }, 0) + supplementalProducts.reduce((sum, item) => {
    const quantity = Number(item.quantity), unitPrice = Number(item.unitPrice);
    return sum + (quantity > 0 && Number.isFinite(quantity) && unitPrice >= 0 && Number.isFinite(unitPrice) ? Math.round((quantity * unitPrice + Number.EPSILON) * 100) / 100 : 0);
  }, 0);
  const liveTax = taxConfirmed && taxRate.trim() ? Math.round((liveSubtotal * Number(taxRate) / 100 + Number.EPSILON) * 100) / 100 : 0;
  const liveShipping = shippingFeeIsConfirmed && shippingMode === 'paid' ? Number(shippingFee) : 0;
  const liveTotal = liveSubtotal + liveTax + liveShipping;
  const editableInformationFields = [...new Set([...quote.informationNeeded, ...Object.keys(additionalInformation)])]
    .filter((field) => !isTaxMissingInformation(field) && !isShippingMissingInformation(field) && !isSupplementalProductInformation(field));
  const approvalItems = [...unresolvedInformation.filter((field) => !isSupplementalQuestion(field)),
  ...(!taxConfirmed || !taxRate.trim() ? ['VAT'] : []), ...(!shippingFeeIsConfirmed ? ['Phí vận chuyển'] : []),
  ...(needsAiRecalculation ? ['Cần tính lại dự toán bằng AI'] : []),
  ...(hasUnpricedSupplemental ? ['Một số hạng mục chưa có đơn giá; nhập giá hoặc tính lại bằng AI'] : [])];

  useEffect(() => {
    setQuantities(Object.fromEntries(quote.lines.filter((line) => line.source !== 'supplemental').map((line) => [line.catalogItemId, String(line.quantity)])));
    const productDrafts = quote.lines.filter((line) => line.source === 'supplemental').map((line, index) => ({ id: line.catalogItemId || `saved-${index}`, informationField: line.supplementalFor, name: line.name, description: line.description ?? '', unit: line.unit, quantity: String(line.quantity), unitPrice: line.priceUnavailable ? '' : String(line.unitPrice), priceUnavailable: line.priceUnavailable }));
    for (const field of [...new Set(quote.informationNeeded.filter(isSupplementalProductInformation))]) {
      if (productDrafts.some((item) => item.informationField === field)) continue;
      const suggestion = quote.suggestedProducts?.find((item) => item.informationField === field);
      productDrafts.push({ id: `new-${Date.now()}-${productDrafts.length}`, informationField: field, name: suggestion?.name ?? '', description: suggestion?.description ?? '', unit: suggestion?.unit ?? '', quantity: suggestion?.quantity && suggestion.quantity > 0 ? String(suggestion.quantity) : '', unitPrice: '', priceUnavailable: true });
    }
    setSupplementalProducts(productDrafts);
    setCustomerName(quote.customerName); setCustomerEmail(quote.customerEmail); setCustomerPhone(quote.customerPhone ?? '');
    setTaxRate(String((quote.taxRate ?? 0) * 100)); setTaxConfirmed(quote.taxRateConfirmed ?? !quote.informationNeeded.some(isTaxMissingInformation));
    setShippingMode(quote.shippingFeeConfirmed === false || quote.shippingFeeConfirmed === undefined && quote.shippingFee == null && quote.informationNeeded.some(isShippingMissingInformation) ? 'unconfirmed' : (quote.shippingFee ?? 0) > 0 ? 'paid' : 'free');
    setShippingFee(quote.shippingFee == null ? '' : String(quote.shippingFee)); setValidityDays(quote.validityDays == null ? '' : String(quote.validityDays));
    setCompletionDate(quote.completionDate ?? ''); setAdditionalInformation(quote.additionalInformation ?? {}); setRevisionRequirements(quote.revisionRequirements ?? '');
  }, [quote._id, quote.updatedAt]);

  function quoteEditPayload(recalculateWithAi = false) {
    const products = supplementalProducts.filter((item) => item.name.trim() || item.description.trim() || item.unit.trim() || item.quantity.trim() || item.unitPrice.trim());
    const tax = Number(taxRate || 0);
    if (!Number.isFinite(tax) || tax < 0 || tax > 100) throw new Error('Thuế suất phải nằm trong khoảng 0–100%.');
    if (validityDays.trim() && (!Number.isInteger(Number(validityDays)) || Number(validityDays) < 1 || Number(validityDays) > 3650)) throw new Error('Thời hạn báo giá phải từ 1 đến 3.650 ngày.');
    if (quote.lines.some((line) => line.source !== 'supplemental' && (!Number.isFinite(Number(quantities[line.catalogItemId] ?? line.quantity)) || Number(quantities[line.catalogItemId] ?? line.quantity) <= 0))) throw new Error('Số lượng từng sản phẩm phải lớn hơn 0.');
    if (shippingMode === 'paid' && shippingFee.trim() && (!Number.isFinite(Number(shippingFee)) || Number(shippingFee) <= 0)) throw new Error('Phí vận chuyển phải lớn hơn 0; chọn miễn phí nếu không thu phí.');
    if (products.some((item) => !item.name.trim() || !item.unit.trim() || !Number(item.quantity) || Number(item.quantity) <= 0 || (!recalculateWithAi && (item.priceUnavailable || !item.unitPrice.trim())))) {
      throw new Error('Mỗi hạng mục bổ sung cần tên, đơn vị, số lượng và đơn giá hợp lệ; để AI xác định đơn giá, chọn “Tính lại bằng AI”.');
    }
    return {
      items: quote.lines.filter((line) => line.source !== 'supplemental').map((line) => ({ catalogItemId: line.catalogItemId, quantity: Number(quantities[line.catalogItemId] ?? line.quantity) })),
      supplementalProducts: products.map((item) => ({ ...(item.id.startsWith('supplemental:') ? { id: item.id } : {}), ...(item.informationField ? { informationField: item.informationField } : {}), name: item.name.trim(), description: item.description.trim(), unit: item.unit.trim(), quantity: Number(item.quantity), unitPrice: item.unitPrice.trim() ? Number(item.unitPrice) : 0, ...(recalculateWithAi && (item.priceUnavailable || !item.unitPrice.trim()) ? { priceUnavailable: true } : {}) })),
      taxRate: tax / 100, taxRateConfirmed: taxConfirmed && Boolean(taxRate.trim()),
      shippingFee: shippingMode === 'unconfirmed' ? null : shippingMode === 'free' ? 0 : shippingFee.trim() ? Number(shippingFee) : null,
      shippingFeeConfirmed: shippingMode !== 'unconfirmed' && (shippingMode === 'free' || (Boolean(shippingFee.trim()) && Number(shippingFee) > 0)),
      validityDays: validityDays.trim() ? Number(validityDays) : null, completionDate: completionDate || null,
      additionalInformation: Object.fromEntries(Object.entries(additionalInformation).filter(([, value]) => value.trim()).map(([key, value]) => [key, value.trim()])),
      revisionRequirements: revisionRequirements.trim(), customerName: customerName.trim(), customerEmail: customerEmail.trim(), customerPhone: customerPhone.trim(),
      ...(recalculateWithAi ? { informationConfirmed: false } : {}),
    };
  }

  function saveEdits(recalculateWithAi = false) {
    try { void (recalculateWithAi ? onRecalculate(quoteEditPayload(true)) : onSave(quoteEditPayload(false))); }
    catch (cause) { showAppAlert({ title: 'Thông tin chưa hợp lệ', message: errorMessage(cause), tone: 'danger' }); }
  }

  function approveCurrentQuote() {
    if (approvalBlockers || hasIncompleteSupplementalProduct) {
      showAppAlert({
        title: 'Cần hoàn tất thông tin',
        message: approvalItems.concat(hasIncompleteSupplementalProduct ? ['Hoàn thiện tên, đơn vị, số lượng và đơn giá cho hạng mục bổ sung'] : []).join('\n'),
        tone: 'info',
      });
      return;
    }
    try {
      const changes = hasUnsavedChanges ? quoteEditPayload(false) : undefined;
      showHrConfirm({
        title: 'Duyệt báo giá?',
        message: `${quote.quoteNumber} · ${quote.customerName}\nTổng tạm tính: ${formatMoney(liveTotal, quote.currency)}${changes ? '\nCác thay đổi sẽ được lưu trước khi duyệt.' : ''}`,
        confirmLabel: 'Duyệt báo giá',
        destructive: false,
        tone: 'success',
        onConfirm: () => onApprove(changes),
      });
    }
    catch (cause) { showAppAlert({ title: 'Thông tin chưa hợp lệ', message: errorMessage(cause), tone: 'danger' }); }
  }

  function updateSupplemental(index: number, changes: Partial<(typeof supplementalProducts)[number]>) {
    setSupplementalProducts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item));
  }

  useEffect(() => {
    if (quote.kind !== 'customer') return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      try {
        const result = await getLatestGeneratedFile(scope, quote._id, 'customer_quote');
        if (!active) return;
        setSavedExport(result.file);
        setExportJobStatus(result.job?.status ?? '');
        setExportError(result.job?.error ?? '');
        if (result.job?.status === 'queued' || result.job?.status === 'running') timer = setTimeout(() => { void poll(); }, 2000);
      } catch (cause) {
        if (active) setExportError(errorMessage(cause));
      }
    }
    setSavedExport(null); setExportJobStatus(''); setExportError('');
    void poll();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [quote._id, quote.updatedAt, quote.kind, scope, exportRefresh]);

  async function createOrRetryExport() {
    setExportBusy(true); setExportError('');
    try {
      const result = await retryCustomerQuoteExport(scope, quote._id);
      setExportJobStatus(result.status); setSavedExport(null); setExportRefresh((value) => value + 1);
    } catch (cause) { setExportError(errorMessage(cause)); }
    finally { setExportBusy(false); }
  }

  async function downloadExport() {
    if (!savedExport || customerExportOutdated) return;
    setExportBusy(true); setExportError('');
    try {
      const blob = await downloadGeneratedFile(scope, savedExport.id);
      await saveAndShareExport(blob, savedExport.filename, savedExport.mimeType);
    } catch (cause) { setExportError(errorMessage(cause)); }
    finally { setExportBusy(false); }
  }
  return <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
    <View style={styles.detailHero}><View style={styles.detailIcon}><FileText size={20} color={colors.primary} /></View><View style={styles.detailHeroCopy}><Text style={styles.detailNumber}>{quote.quoteNumber}</Text><View style={[styles.statusBadge, { backgroundColor: badge.backgroundColor }]}><Text style={[styles.statusText, { color: badge.color }]}>{statusLabel(quote.status)}</Text></View></View></View>
    <Card style={styles.infoCard}><InfoLine icon={UserRound} label="Khách hàng" value={quote.customerName || 'Chưa xác định'} /><InfoLine icon={Mail} label="Email" value={quote.customerEmail || 'Chưa cập nhật'} /><InfoLine icon={Phone} label="Điện thoại" value={quote.customerPhone || 'Chưa cập nhật'} /><InfoLine icon={CalendarDays} label="Ngày tạo" value={formatDate(quote.createdAt)} /><InfoLine icon={Clock3} label="Cập nhật" value={formatDate(quote.updatedAt)} />{quote.sourceQuote && <InfoLine icon={FileText} label="Từ báo giá khách" value={quote.sourceQuote.quoteNumber} />}</Card>
    {editable && <Card style={styles.editCard}>
      <Text style={styles.sectionTitle}>Thông tin có thể chỉnh sửa</Text>
      <Text style={styles.fieldLabel}>Khách hàng</Text><TextInput editable={!busy} value={customerName} onChangeText={setCustomerName} style={styles.input} placeholder="Tên khách hàng *" placeholderTextColor={colors.muted} />
      <View style={styles.twoInputs}><TextInput editable={!busy} value={customerEmail} onChangeText={setCustomerEmail} style={[styles.input, styles.halfInput]} placeholder="Email" placeholderTextColor={colors.muted} keyboardType="email-address" autoCapitalize="none" /><TextInput editable={!busy} value={customerPhone} onChangeText={setCustomerPhone} style={[styles.input, styles.halfInput]} placeholder="Điện thoại" placeholderTextColor={colors.muted} keyboardType="phone-pad" /></View>
      <Text style={styles.fieldLabel}>VAT (%)</Text><View style={styles.twoInputs}><TextInput editable={!busy} value={taxRate} onChangeText={setTaxRate} style={[styles.input, styles.halfInput]} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.muted} /><Pressable onPress={() => setTaxConfirmed((value) => !value)} style={[styles.confirmChip, taxConfirmed && styles.confirmChipActive]}><Check size={13} color={taxConfirmed ? '#16885A' : colors.muted} /><Text style={styles.confirmChipText}>{taxConfirmed ? 'Đã xác nhận' : 'Cần xác nhận'}</Text></Pressable></View>
      <Text style={styles.fieldLabel}>Vận chuyển</Text><View style={styles.customerModeTabs}><Pressable onPress={() => setShippingMode('unconfirmed')} style={[styles.customerModeTab, shippingMode === 'unconfirmed' && styles.customerModeTabActive]}><Text style={styles.customerModeText}>Chưa chốt</Text></Pressable><Pressable onPress={() => setShippingMode('free')} style={[styles.customerModeTab, shippingMode === 'free' && styles.customerModeTabActive]}><Text style={styles.customerModeText}>Miễn phí</Text></Pressable><Pressable onPress={() => setShippingMode('paid')} style={[styles.customerModeTab, shippingMode === 'paid' && styles.customerModeTabActive]}><Text style={styles.customerModeText}>Có phí</Text></Pressable></View>
      {shippingMode === 'paid' && <TextInput editable={!busy} value={shippingFee} onChangeText={setShippingFee} style={[styles.input, styles.topInput]} keyboardType="decimal-pad" placeholder="Phí vận chuyển" placeholderTextColor={colors.muted} />}
      <View style={styles.twoInputs}><View style={styles.halfInput}><Text style={styles.fieldLabel}>Hiệu lực (ngày)</Text><TextInput editable={!busy} value={validityDays} onChangeText={setValidityDays} style={styles.input} keyboardType="number-pad" placeholder="Không giới hạn" placeholderTextColor={colors.muted} /></View><View style={styles.halfInput}><Text style={styles.fieldLabel}>Ngày hoàn thành</Text><DateTimeField mode="date" value={completionDate} onChange={setCompletionDate} disabled={busy} allowClear placeholder="Chọn ngày" /></View></View>
      {!!editableInformationFields.length && <View style={styles.subSection}><Text style={styles.sectionTitle}>Thông tin còn thiếu hoặc cần xác nhận</Text>{editableInformationFields.map((field) => <View key={field}><Text style={styles.mutedText}>{field}</Text><TextInput editable={!busy} value={additionalInformation[field] ?? ''} onChangeText={(value) => setAdditionalInformation((current) => ({ ...current, [field]: value }))} style={styles.input} placeholder="Nhập thông tin bổ sung" placeholderTextColor={colors.muted} /></View>)}</View>}
      {quote.kind !== 'customer' && <><Text style={styles.fieldLabel}>Yêu cầu chỉnh sửa để AI tính lại</Text><TextInput editable={!busy} value={revisionRequirements} onChangeText={setRevisionRequirements} style={[styles.input, styles.multilineInput]} placeholder="Mô tả thay đổi về quy cách, số lượng, thời gian hoặc phạm vi..." placeholderTextColor={colors.muted} multiline maxLength={10000} /></>}
    </Card>}

    <View style={styles.sectionHeading}><Package size={16} color={colors.primary} /><Text style={styles.sectionTitle}>Hạng mục ({quote.lines?.length ?? 0})</Text></View>
    <Card style={styles.linesCard}>{quote.lines?.length ? quote.lines.map((line, index) => {
      const supplementalIndex = supplementalProducts.findIndex((item) => item.id === line.catalogItemId);
      if (editable && line.source === 'supplemental' && supplementalIndex >= 0) {
        const item = supplementalProducts[supplementalIndex];
        return <View key={`${line.catalogItemId}-${index}`} style={[styles.lineEditCard, index > 0 && styles.lineBorder]}><View style={styles.editLineHeader}><Text style={styles.lineName}>{item.informationField || 'Hạng mục bổ sung'}</Text><Pressable onPress={() => setSupplementalProducts((current) => current.filter((_, itemIndex) => itemIndex !== supplementalIndex))}><X size={15} color="#B54745" /></Pressable></View><TextInput value={item.name} onChangeText={(value) => updateSupplemental(supplementalIndex, { name: value })} style={styles.input} placeholder="Tên sản phẩm *" placeholderTextColor={colors.muted} /><View style={styles.twoInputs}><TextInput value={item.unit} onChangeText={(value) => updateSupplemental(supplementalIndex, { unit: value })} style={[styles.input, styles.halfInput]} placeholder="Đơn vị *" placeholderTextColor={colors.muted} /><TextInput value={item.quantity} onChangeText={(value) => updateSupplemental(supplementalIndex, { quantity: value })} style={[styles.input, styles.halfInput]} keyboardType="decimal-pad" placeholder="Số lượng *" placeholderTextColor={colors.muted} /></View><View style={styles.twoInputs}><TextInput value={item.unitPrice} onChangeText={(value) => updateSupplemental(supplementalIndex, { unitPrice: value, priceUnavailable: false })} style={[styles.input, styles.halfInput]} keyboardType="decimal-pad" placeholder="Đơn giá *" placeholderTextColor={colors.muted} /><Text style={[styles.lineAmount, styles.halfInput]}>{item.unitPrice ? formatMoney(Number(item.unitPrice) * Number(item.quantity), quote.currency) : 'Chưa có giá'}</Text></View></View>;
      }
      const quantity = quantities[line.catalogItemId] ?? String(line.quantity);
      return <View key={`${line.catalogItemId}-${index}`} style={[styles.lineRow, index > 0 && styles.lineBorder]}><View style={styles.lineCopy}><Text style={styles.lineName}>{line.name}</Text><Text style={styles.lineMeta}>{line.sku} · {quantity} {line.unit} · {formatMoney(line.unitPrice, line.currency)}</Text></View>{editable && line.source !== 'supplemental' ? <View style={styles.quantityAmount}><TextInput value={quantity} onChangeText={(value) => setQuantities((current) => ({ ...current, [line.catalogItemId]: value }))} style={styles.quantityInput} keyboardType="decimal-pad" /><Text style={styles.lineAmount}>{formatMoney((Number(quantity) || 0) * line.unitPrice, line.currency)}</Text></View> : <Text style={styles.lineAmount}>{formatMoney(line.lineTotal, line.currency)}</Text>}</View>;
    }) : <Text style={styles.emptyLine}>Chưa có dòng hàng trong báo giá.</Text>}
      {editable && <Pressable onPress={() => setSupplementalProducts((current) => [...current, { id: `new-${Date.now()}`, name: '', description: '', unit: '', quantity: '1', unitPrice: '' }])} style={styles.addSupplementalButton}><Plus size={14} color={colors.primary} /><Text style={styles.secondaryText}>Thêm hạng mục bổ sung</Text></Pressable>}
      <View style={styles.totalLine}><Text style={styles.totalLabel}>Tạm tính</Text><Text style={styles.totalValue}>{formatMoney(liveSubtotal, quote.currency)}</Text></View>{(quote.taxAmount > 0 || Number(taxRate) > 0) && <View style={styles.totalLine}><Text style={styles.totalLabel}>Thuế</Text><Text style={styles.totalValue}>{formatMoney(liveTax, quote.currency)}</Text></View>}{(liveShipping > 0 || shippingMode === 'paid') && <View style={styles.totalLine}><Text style={styles.totalLabel}>Vận chuyển</Text><Text style={styles.totalValue}>{formatMoney(liveShipping, quote.currency)}</Text></View>}<View style={styles.grandTotal}><Text style={styles.grandTotalLabel}>Tổng cộng tạm tính</Text><Text style={styles.grandTotalValue}>{formatMoney(liveTotal, quote.currency)}</Text></View></Card>
    {!!quote.missingProducts?.length && <Card style={styles.warningCard}><Text style={styles.warningTitle}>Sản phẩm chưa có trong bảng giá</Text>{quote.missingProducts.map((item) => <Text key={item} style={styles.warningItem}>• {item}</Text>)}</Card>}

    {!!(hasUnresolvedInformation || hasIncompleteSupplementalProduct) && <Card style={styles.warningCard}><View style={styles.warningHeading}><CircleAlert size={16} color="#9A6500" /><Text style={styles.warningTitle}>{approvalBlockers || hasIncompleteSupplementalProduct ? 'Cần xác nhận trước khi duyệt' : 'Thông tin cần bổ sung'}</Text></View>{[...new Set([...approvalItems, ...unresolvedInformation.filter(isSupplementalQuestion), ...(hasIncompleteSupplementalProduct ? ['Hoàn thiện các hạng mục bổ sung'] : [])])].map((item, index) => <View key={`${item}-${index}`} style={styles.warningListItem}><CircleAlert size={12} color="#9A6500" /><Text style={styles.warningItem}>{item}</Text></View>)}{needsAiRecalculation && <Text style={styles.helperText}>Lưu và tính lại bằng AI để áp dụng các câu trả lời hoặc yêu cầu chỉnh sửa.</Text>}</Card>}
    {!!quote.rejectionReason && <Card style={styles.rejectionCard}><Text style={styles.rejectionTitle}>Lý do trả lại</Text><Text style={styles.rejectionCopy}>{quote.rejectionReason}</Text></Card>}
    {!!(quote.requestText || quote.requestFile) && <Card style={styles.requestCard}><Text style={styles.requestTitle}>Yêu cầu ban đầu</Text><Text style={styles.requestCopy}>{quote.requestText?.trim() || `Yêu cầu được gửi kèm file: ${quote.requestFile?.originalFilename}`}</Text></Card>}
    {quote.kind === 'customer' && <Card style={styles.exportCard}>
      <View style={styles.warningHeading}><Files size={15} color={colors.primary} /><Text style={styles.sectionTitle}>File báo giá theo mẫu</Text></View>
      <Text style={styles.mutedText}>{hasUnsavedChanges ? 'Lưu thay đổi trước khi tạo hoặc tải file báo giá.' : customerExportOutdated ? 'Báo giá đã thay đổi sau lần xuất file gần nhất. Hãy tạo lại file trước khi gửi khách.' : savedExport ? `Đã lưu: ${savedExport.filename}` : exportJobStatus === 'queued' || exportJobStatus === 'running' ? 'ERP đang điền mẫu và tạo file...' : exportJobStatus === 'failed' ? 'Lần tạo file gần nhất chưa thành công.' : 'Chưa có file báo giá đã lưu.'}</Text>
      {!!exportError && <PopupError error={exportError} title="Không xuất được tệp" />}
      <View style={styles.actionRow}>
        {savedExport && !customerExportOutdated && <Pressable disabled={exportBusy || hasUnsavedChanges} onPress={() => { void downloadExport(); }} style={[styles.secondaryButton, (exportBusy || hasUnsavedChanges) && styles.disabled]}>{exportBusy ? <ActivityIndicator size="small" color={colors.primary} /> : <Files size={14} color={colors.primary} />}<Text style={styles.secondaryText}>Tải / chia sẻ file</Text></Pressable>}
        {canUseAi && <Pressable disabled={exportBusy || hasUnsavedChanges || exportJobStatus === 'queued' || exportJobStatus === 'running'} onPress={() => { void createOrRetryExport(); }} style={[styles.secondaryButton, (exportBusy || hasUnsavedChanges || exportJobStatus === 'queued' || exportJobStatus === 'running') && styles.disabled]}>{exportBusy || exportJobStatus === 'queued' || exportJobStatus === 'running' ? <ActivityIndicator size="small" color={colors.primary} /> : <RefreshCw size={14} color={colors.primary} />}<Text style={styles.secondaryText}>{hasUnsavedChanges ? 'Lưu thay đổi trước' : customerExportOutdated ? 'Tạo file mới' : savedExport ? 'Tạo lại file' : exportJobStatus === 'failed' ? 'Thử lại tạo file' : 'Tạo file báo giá'}</Text></Pressable>}
      </View>
    </Card>}
    {quote.kind !== 'customer' && <GeneratedFileActions scope={scope} sourceId={quote._id} kind={quote.status === 'approved' ? 'estimate' : 'estimate_draft'} updatedAt={quote.updatedAt} label="File dự toán theo mẫu" canGenerate={canUseAi} blocked={hasUnsavedChanges || needsAiRecalculation} onGenerate={() => queueEstimateExport(scope, quote._id, quote.status !== 'approved')} />}

    <View style={styles.detailActions}>
      {quote.kind === 'customer' && canManage && canUseAi && <ActionButton icon={FileText} label="Tạo dự toán" onPress={onCreateEstimate} busy={busy} />}
      {quote.status === 'approved' && quote.kind !== 'customer' && canManageContract && <ActionButton icon={BriefcaseBusiness} label="Tạo / xem hợp đồng" onPress={onCreateContract} busy={busy} primary />}
      {editable && <ActionButton icon={Check} label="Lưu thay đổi" onPress={() => saveEdits(false)} busy={busy} />}
      {editable && quote.kind !== 'customer' && canUseAi && <ActionButton icon={RefreshCw} label="Tính lại bằng AI" onPress={() => saveEdits(true)} busy={busy} />}
      {canManage && quote.status === 'draft' && <ActionButton icon={Send} label="Gửi duyệt" onPress={onSubmit} busy={busy} primary />}
      {canApproveThis && <ActionButton icon={BadgeCheck} label="Duyệt báo giá" onPress={approveCurrentQuote} busy={busy || approvalBlockers || hasIncompleteSupplementalProduct} primary />}
      {canApprove && quote.status === 'pending_review' && <ActionButton icon={ArrowLeft} label="Trả lại" onPress={() => setRejectOpen((value) => !value)} busy={busy} />}
      {canManage && quote.status !== 'approved' && <ActionButton icon={Trash2} label="Xóa" onPress={onDelete} busy={busy} destructive />}
    </View>
    {rejectOpen && <View style={styles.rejectEditor}><Text style={styles.fieldLabel}>Lý do trả lại</Text><TextInput value={reason} onChangeText={setReason} style={[styles.input, styles.multilineInput]} placeholder="Nhập nội dung cần chỉnh sửa..." placeholderTextColor={colors.muted} multiline maxLength={1000} /><Pressable disabled={!reason.trim() || busy} onPress={() => { onReject(reason.trim()); setRejectOpen(false); }} style={[styles.secondaryAction, (!reason.trim() || busy) && styles.buttonDisabled]}><Text style={styles.secondaryActionText}>{busy ? 'Đang gửi...' : 'Gửi lý do'}</Text></Pressable></View>}
  </ScrollView>;
}

function EstimateFromCustomerQuoteSheet({ scope, quote, onClose, onCreated }: { scope: QuotationScope; quote: Quote; onClose: () => void; onCreated: () => void }) {
  const [templates, setTemplates] = useState<QuoteTemplate[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [requirements, setRequirements] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [idempotencyKey] = useState(makeIdempotencyKey);

  useEffect(() => {
    let active = true;
    void loadQuoteTemplates(scope, 'estimate').then((result) => {
      if (!active) return;
      setTemplates(result.templates);
      setTemplateId(result.templates.find((item) => item.id === result.defaultTemplateId)?.id ?? result.templates[0]?.id ?? '');
    }).catch((cause) => { if (active) setError(errorMessage(cause)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [scope]);

  async function create() {
    if (!templateId || !requirements.trim()) { setError('Chọn mẫu dự toán và nhập yêu cầu cụ thể để AI tính dự toán.'); return; }
    setBusy(true); setError('');
    try {
      const estimate = await createEstimateFromCustomerQuote(scope, { sourceQuoteId: quote._id, templateId, sourceRequirements: requirements.trim(), idempotencyKey });
      let exportWarning = '';
      try { await queueDraftEstimateExport(scope, estimate._id); } catch (cause) { exportWarning = errorMessage(cause); }
      if (exportWarning) showAppAlert({ title: 'Đã tạo dự toán', message: `Dự toán đã được lưu. Chưa xếp được file dự thảo: ${exportWarning}`, tone: 'info' });
      else showAppAlert({ title: 'Đã tạo dự toán', message: `${estimate.quoteNumber} đã được tạo từ ${quote.quoteNumber}.`, tone: 'success' });
      onCreated();
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  return <View style={styles.modalBackdrop}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetKeyboard}><View style={styles.createSheet}>
    <View style={styles.sheetHandle} /><View style={styles.sheetHeader}><View><Text style={styles.sheetTitle}>Tạo dự toán từ báo giá khách</Text><Text style={styles.sheetSubtitle}>{quote.quoteNumber} · {quote.customerName}</Text></View><Pressable onPress={onClose} disabled={busy} style={styles.closeButton}><X size={19} color={colors.muted} /></Pressable></View>
    <ScrollView contentContainerStyle={styles.createContent} keyboardShouldPersistTaps="handled">
      <Card style={styles.sourceQuoteCard}><FileText size={16} color={colors.primary} /><View style={styles.rowCopy}><Text style={styles.rowTitle}>{quote.quoteNumber}</Text><Text style={styles.mutedText}>{quote.lines.length + (quote.missingProducts?.length ?? 0)} hạng mục · {formatMoney(quote.total, quote.currency)}</Text></View></Card>
      <Text style={styles.fieldLabel}>Yêu cầu cụ thể để tính dự toán *</Text><TextInput value={requirements} onChangeText={setRequirements} style={[styles.input, styles.multilineInput]} placeholder="Nêu số lượng, quy cách, vật liệu, lắp đặt hoặc thời hạn cần đáp ứng..." placeholderTextColor={colors.muted} multiline maxLength={10000} />
      <Text style={styles.helperText}>AI sẽ điều chỉnh hạng mục và đơn giá theo yêu cầu; nội dung vẫn cần được kiểm tra trước khi gửi khách.</Text>
      <Text style={styles.fieldLabel}>Mẫu dự toán</Text>{loading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : templates.length ? templates.map((item) => <Pressable key={item.id} onPress={() => setTemplateId(item.id)} style={[styles.choiceRow, templateId === item.id && styles.choiceSelected]}><Text numberOfLines={1} style={styles.rowTitle}>{item.name || item.originalFilename} · {item.extension?.toUpperCase()}</Text>{templateId === item.id && <Check size={14} color={colors.primary} />}</Pressable>) : <Text style={styles.emptyCopy}>Chưa có mẫu dự toán trong ERP.</Text>}
      {!!error && <View style={styles.formError}><CircleAlert size={15} color="#B54745" /><PopupError error={error} /></View>}
      <View style={styles.footerActions}><Pressable onPress={onClose} disabled={busy} style={styles.cancelButton}><Text style={styles.cancelText}>Hủy</Text></Pressable><Pressable onPress={() => { void create(); }} disabled={busy || loading || !templateId || !requirements.trim()} style={[styles.primaryButton, (busy || loading || !templateId || !requirements.trim()) && styles.buttonDisabled]}>{busy ? <ActivityIndicator size="small" color={colors.white} /> : <Check size={15} color={colors.white} />}<Text style={styles.primaryButtonText}>{busy ? 'Đang tạo...' : 'Tạo dự toán'}</Text></Pressable></View>
    </ScrollView>
  </View></KeyboardAvoidingView></View>;
}

function InfoLine({ icon: Icon, label, value }: { icon: typeof UserRound; label: string; value: string }) {
  return <View style={styles.infoLine}><Icon size={14} color={colors.muted} /><Text style={styles.infoLabel}>{label}</Text><Text numberOfLines={2} style={styles.infoValue}>{value}</Text></View>;
}

function ActionButton({ icon: Icon, label, onPress, busy, primary, destructive }: { icon: typeof Send; label: string; onPress: () => void; busy: boolean; primary?: boolean; destructive?: boolean }) {
  return <Pressable disabled={busy} onPress={onPress} style={[styles.actionButton, primary && styles.actionPrimary, destructive && styles.actionDestructive, busy && styles.buttonDisabled]}><Icon size={15} color={primary ? colors.white : destructive ? '#B54745' : colors.ink} /><Text style={[styles.actionText, primary && styles.actionTextPrimary, destructive && styles.actionTextDestructive]}>{label}</Text></Pressable>;
}

function NewQuoteSheet({ kind, scope, canSelectErpCustomers, onClose, onCreated }: { kind: QuoteKind; scope: QuotationScope; canSelectErpCustomers: boolean; onClose: () => void; onCreated: () => void }) {
  const [templates, setTemplates] = useState<QuoteTemplate[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [requirements, setRequirements] = useState('');
  const [requestFile, setRequestFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [uploadedRequestFile, setUploadedRequestFile] = useState<{ uri: string; id: string } | null>(null);
  const [templateLoading, setTemplateLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(kind === 'customer');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedCatalogIds, setSelectedCatalogIds] = useState<string[]>([]);
  const [customerMode, setCustomerMode] = useState<'manual' | 'ai'>('manual');
  const [aiSuggested, setAiSuggested] = useState(false);
  const [aiSuggestedIds, setAiSuggestedIds] = useState<string[]>([]);
  const [manualPickerOpen, setManualPickerOpen] = useState(false);
  const [missingProducts, setMissingProducts] = useState<string[]>([]);
  const [suggestionNotes, setSuggestionNotes] = useState<string[]>([]);
  const [suggestionQuestions, setSuggestionQuestions] = useState<string[]>([]);
  const [requestId, setRequestId] = useState('');
  const [requestKey, setRequestKey] = useState(makeIdempotencyKey);
  const [quoteKey, setQuoteKey] = useState(makeIdempotencyKey);
  const [analysis, setAnalysis] = useState<QuoteAnalysis | null>(null);
  const [candidates, setCandidates] = useState<CatalogItem[]>([]);
  const [selectedAnalysisItems, setSelectedAnalysisItems] = useState<AnalysisItem[]>([]);

  useEffect(() => {
    let active = true;
    void loadQuoteTemplates(scope, kind === 'estimate' ? 'estimate' : 'quote')
      .then((result) => {
        if (!active) return;
        setTemplates(result.templates);
        setTemplateId(result.templates.find((item) => item.id === result.defaultTemplateId)?.id ?? result.templates[0]?.id ?? '');
      })
      .catch((cause) => { if (active) setError(errorMessage(cause)); })
      .finally(() => { if (active) setTemplateLoading(false); });
    if (kind === 'customer') {
      void loadCatalog(scope)
        .then((items) => { if (active) setCatalog(items); })
        .catch((cause) => { if (active) setError(errorMessage(cause)); })
        .finally(() => { if (active) setCatalogLoading(false); });
    }
    return () => { active = false; };
  }, [kind, scope]);

  const visibleCatalog = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('vi');
    return catalog.filter((item) => !query || `${item.sku} ${item.name} ${item.description ?? ''}`.toLocaleLowerCase('vi').includes(query)).slice(0, 100);
  }, [catalog, search]);

  const selectedCatalogItems = useMemo(
    () => catalog.filter((item) => selectedCatalogIds.includes(item._id)),
    [catalog, selectedCatalogIds],
  );

  function invalidateAnalysis() {
    setAnalysis(null);
    setRequestId('');
    setCandidates([]);
    setSelectedAnalysisItems([]);
    setRequestKey(makeIdempotencyKey());
    setQuoteKey(makeIdempotencyKey());
  }

  async function analyze() {
    if (!templateId || (!requirements.trim() && !requestFile)) {
      setError('Chọn mẫu dự toán và nhập yêu cầu hoặc tải file yêu cầu.');
      return;
    }
    if (requestFile && requestFile.size !== undefined && requestFile.size > 10 * 1024 * 1024) {
      setError('File yêu cầu không được vượt quá 10 MB.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      let requestFileId = uploadedRequestFile && requestFile && uploadedRequestFile.uri === requestFile.uri ? uploadedRequestFile.id : undefined;
      if (requestFile && !requestFileId) {
        const file = await fetch(requestFile.uri).then((response) => {
          if (!response.ok) throw new Error('Không đọc được file yêu cầu.');
          return response.blob();
        });
        const uploaded = await uploadQuoteRequestFile(scope, { file, filename: requestFile.name });
        requestFileId = uploaded.file.id;
        setUploadedRequestFile({ uri: requestFile.uri, id: requestFileId });
      }
      const created = await createQuoteRequest(scope, {
        templateId,
        requestText: requirements.trim(),
        ...(requestFileId ? { requestFileId } : {}),
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerPhone: customerPhone.trim(),
        idempotencyKey: requestKey,
      });
      setRequestId(created.request._id);
      const result = await analyzeQuoteRequest(scope, created.request._id);
      setAnalysis(result.analysis);
      setCandidates(result.candidates ?? []);
      setSelectedAnalysisItems(result.analysis.items ?? []);
      if (!customerName.trim() && result.analysis.customerName) setCustomerName(result.analysis.customerName);
      if (!customerEmail.trim() && result.analysis.customerEmail) setCustomerEmail(result.analysis.customerEmail);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  function toggleAnalysisItem(item: CatalogItem) {
    setSelectedAnalysisItems((current) => {
      const existing = current.find((line) => line.catalogItemId === item._id);
      if (existing) return current.filter((line) => line.catalogItemId !== item._id);
      const matched = analysis?.items.find((line) => line.catalogItemId === item._id);
      return [...current, matched ?? { catalogItemId: item._id, quantity: 1, unit: item.unit, attributes: {}, evidence: 'Chọn từ danh mục' }];
    });
  }

  function changeQuantity(id: string, value: string) {
    const quantity = Number(value);
    setSelectedAnalysisItems((current) => current.map((item) => item.catalogItemId === id ? { ...item, quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1 } : item));
  }

  async function saveEstimate() {
    if (!requestId || !analysis) return;
    if (!customerName.trim()) {
      setError('Nhập tên khách hàng trước khi tạo dự toán.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const quote = await createEstimate(scope, {
        requestId,
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerPhone: customerPhone.trim(),
        idempotencyKey: quoteKey,
        items: selectedAnalysisItems.map((line) => {
          const item = candidates.find((candidate) => candidate._id === line.catalogItemId);
          return {
            catalogItemId: line.catalogItemId,
            quantity: line.quantity,
            unit: line.unit,
            attributes: line.attributes,
            catalogUpdatedAt: item?.updatedAt || item?.createdAt || '',
          };
        }),
      });
      let exportWarning = '';
      try {
        await queueDraftEstimateExport(scope, quote._id);
      } catch (cause) {
        exportWarning = errorMessage(cause);
      }
      onCreated();
      if (exportWarning) showAppAlert({ title: 'Đã lưu dự toán', message: `Dự toán đã được lưu. Chưa tạo được file dự thảo: ${exportWarning}`, tone: 'info' });
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function saveCustomerQuote() {
    if (!customerName.trim() || !templateId) {
      setError('Nhập tên khách hàng và chọn mẫu báo giá.');
      return;
    }
    const selected = catalog.filter((item) => selectedCatalogIds.includes(item._id));
    if (!selected.length && !missingProducts.length) {
      setError('Chọn sản phẩm hoặc dùng AI để đề xuất hạng mục.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await createCustomerQuote(scope, {
        templateId,
        idempotencyKey: quoteKey,
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerPhone: customerPhone.trim(),
        sourceRequirements: requirements.trim(),
        missingProducts,
        items: selected.map((item) => ({
          catalogItemId: item._id,
          quantity: 1,
          unit: item.unit,
          catalogUpdatedAt: item.updatedAt || item.createdAt || '',
        })),
      });
      onCreated();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function suggestCustomerItems() {
    if (!requirements.trim()) { setError('Mô tả yêu cầu của khách trước khi dùng AI.'); return; }
    setBusy(true); setError('');
    try {
      const result = await suggestCustomerQuote(scope, requirements.trim());
      const matchedIds = result.items
        .map((item) => item.catalogItemId)
        .filter((id) => catalog.some((item) => item._id === id));
      setSelectedCatalogIds(matchedIds);
      setAiSuggestedIds(matchedIds);
      setAiSuggested(true);
      setManualPickerOpen(false);
      setSearch('');
      setMissingProducts(result.missingProducts ?? []);
      setSuggestionNotes(result.notes ?? []);
      setSuggestionQuestions(result.questions ?? []);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  async function chooseRequestFile() {
    try {
      const result = await withAppLockSuspended(() => DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv'],
        multiple: false,
        copyToCacheDirectory: true,
      }));
      if (result.canceled) return;
      const asset = result.assets[0];
      const extension = asset.name.split('.').pop()?.toLowerCase();
      if (asset.size === 0 || (asset.size !== undefined && asset.size > 10 * 1024 * 1024)) {
        setError('File yêu cầu phải có nội dung và không vượt quá 10 MB.');
        return;
      }
      if (!['pdf', 'docx', 'txt', 'xlsx', 'xls', 'csv'].includes(extension ?? '')) {
        setError('Chỉ nhận PDF, Word, TXT, Excel hoặc CSV.');
        return;
      }
      setRequestFile(asset);
      setUploadedRequestFile(null);
      setError('');
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  function toggleCatalogItem(item: CatalogItem) {
    const selected = selectedCatalogIds.includes(item._id);
    setSelectedCatalogIds((ids) => selected ? ids.filter((id) => id !== item._id) : [...ids, item._id]);
  }

  const visibleCandidates = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('vi');
    return candidates.filter((item) => !query || `${item.sku} ${item.name} ${item.description ?? ''}`.toLocaleLowerCase('vi').includes(query)).slice(0, 100);
  }, [candidates, search]);

  return <View style={styles.modalBackdrop}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetKeyboard}>
      <View style={styles.createSheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}><View><Text style={styles.sheetTitle}>{kind === 'estimate' ? 'Tạo dự toán' : 'Tạo báo giá khách'}</Text><Text style={styles.sheetSubtitle}>Lưu trực tiếp vào ERP</Text></View><Pressable onPress={onClose} disabled={busy} style={styles.closeButton}><X size={19} color={colors.muted} /></Pressable></View>
        <ScrollView style={styles.createScroll} contentContainerStyle={styles.createContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {templateLoading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : <>
            <Text style={styles.fieldLabel}>Mẫu tài liệu</Text>
            {templates.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templateOptions}>{templates.map((template) => <Pressable key={template.id} onPress={() => { setTemplateId(template.id); invalidateAnalysis(); }} style={[styles.templateOption, templateId === template.id && styles.templateOptionActive]}><FileText size={14} color={templateId === template.id ? colors.primary : colors.muted} /><Text numberOfLines={1} style={[styles.templateText, templateId === template.id && styles.templateTextActive]}>{template.name || template.originalFilename}</Text></Pressable>)}</ScrollView> : <Text style={styles.emptyCopy}>ERP chưa có mẫu phù hợp cho loại chứng từ này.</Text>}

            <Text style={styles.fieldLabel}>Khách hàng</Text>
            <ErpCustomerPicker enabled={canSelectErpCustomers} disabled={busy} scope={scope} onSelect={(customer) => { setCustomerName(customer.name); setCustomerEmail(customer.email ?? ''); setCustomerPhone(customer.phone ?? ''); }} />
            <TextInput value={customerName} onChangeText={setCustomerName} style={styles.input} placeholder="Tên khách hàng *" placeholderTextColor={colors.muted} autoCapitalize="words" />
            <View style={styles.twoInputs}><TextInput value={customerEmail} onChangeText={setCustomerEmail} style={[styles.input, styles.halfInput]} placeholder="Email" placeholderTextColor={colors.muted} keyboardType="email-address" autoCapitalize="none" /><TextInput value={customerPhone} onChangeText={setCustomerPhone} style={[styles.input, styles.halfInput]} placeholder="Điện thoại" placeholderTextColor={colors.muted} keyboardType="phone-pad" /></View>

            {kind === 'estimate' ? <>
              <Text style={styles.fieldLabel}>Yêu cầu khách hàng</Text>
              <TextInput value={requirements} onChangeText={(value) => { setRequirements(value); invalidateAnalysis(); }} style={[styles.input, styles.multilineInput]} placeholder="Mô tả nhu cầu, sản phẩm, số lượng và điều kiện..." placeholderTextColor={colors.muted} multiline maxLength={10000} />
              <View style={styles.requestFileRow}>
                <Pressable disabled={busy || Boolean(requestId)} onPress={() => { void chooseRequestFile(); }} style={[styles.secondaryButton, (busy || Boolean(requestId)) && styles.disabled]}><Paperclip size={14} color={colors.primary} /><Text style={styles.secondaryText}>{requestFile ? 'Thay file yêu cầu' : 'Đính kèm file yêu cầu'}</Text></Pressable>
                <Text numberOfLines={1} style={styles.requestFileName}>{requestFile?.name ?? 'PDF, DOCX, TXT, XLSX, XLS, CSV · tối đa 10 MB'}</Text>
                {!!requestFile && !requestId && <Pressable accessibilityLabel="Bỏ file yêu cầu" onPress={() => { setRequestFile(null); setUploadedRequestFile(null); }}><X size={16} color={colors.muted} /></Pressable>}
              </View>
              {!analysis ? <Pressable disabled={busy || templateLoading || !templates.length || (!requirements.trim() && !requestFile)} onPress={() => { void analyze(); }} style={[styles.primaryButton, (busy || !templates.length || (!requirements.trim() && !requestFile)) && styles.buttonDisabled]}>{busy ? <ActivityIndicator size="small" color={colors.white} /> : <Search size={16} color={colors.white} />}<Text style={styles.primaryButtonText}>{busy ? 'Đang phân tích...' : 'Phân tích yêu cầu'}</Text></Pressable> : <>
                <View style={styles.analysisHeading}><View><Text style={styles.sectionTitle}>Sản phẩm ghép được</Text><Text style={styles.helperText}>Chọn dòng hàng và kiểm tra số lượng trước khi lưu.</Text></View><Pressable onPress={invalidateAnalysis} style={styles.reanalyzeButton}><RefreshCw size={14} color={colors.primary} /><Text style={styles.reanalyzeText}>Phân tích lại</Text></Pressable></View>
                {!!analysis.missingFields?.length && <View style={styles.analysisNotice}><CircleAlert size={15} color="#9A6500" /><Text style={styles.analysisNoticeText}>{analysis.missingFields.join(' · ')}</Text></View>}
                <View style={styles.searchBox}><Search size={15} color={colors.muted} /><TextInput value={search} onChangeText={setSearch} style={styles.searchInput} placeholder="Tìm trong danh mục gợi ý..." placeholderTextColor={colors.muted} /></View>
                {visibleCandidates.map((item) => {
                  const chosen = selectedAnalysisItems.find((line) => line.catalogItemId === item._id);
                  return <Pressable key={item._id} onPress={() => toggleAnalysisItem(item)} style={styles.catalogRow}><View style={[styles.checkbox, chosen && styles.checkboxActive]}>{chosen && <Check size={13} color={colors.white} />}</View><View style={styles.catalogCopy}><Text style={styles.catalogName}>{item.name}</Text><Text style={styles.catalogMeta}>{item.sku} · {item.unit} · {formatMoney(item.price, item.currency)}</Text></View>{chosen ? <TextInput value={String(chosen.quantity)} onChangeText={(value) => changeQuantity(item._id, value)} keyboardType="decimal-pad" onPressIn={(event) => event.stopPropagation()} style={styles.quantityInput} /> : <ChevronRight size={15} color={colors.muted} />}</Pressable>;
                })}
                {!visibleCandidates.length && <Text style={styles.emptyCopy}>Không có sản phẩm khớp. Bạn vẫn có thể lưu yêu cầu để bổ sung sau.</Text>}
              </>}
            </> : <>
              {customerMode === 'manual' && <><Text style={styles.fieldLabel}>Nội dung báo giá (không bắt buộc)</Text><TextInput value={requirements} onChangeText={setRequirements} style={[styles.input, styles.requirementInput]} placeholder="Mô tả phạm vi hoặc lưu ý cho khách hàng..." placeholderTextColor={colors.muted} multiline maxLength={10000} /></>}
              <View style={styles.customerModeTabs}>
                <Pressable onPress={() => setCustomerMode('manual')} style={[styles.customerModeTab, customerMode === 'manual' && styles.customerModeTabActive]}><Package size={14} color={customerMode === 'manual' ? colors.primary : colors.muted} /><Text style={[styles.customerModeText, customerMode === 'manual' && styles.customerModeTextActive]}>Chọn sản phẩm</Text></Pressable>
                <Pressable onPress={() => setCustomerMode('ai')} style={[styles.customerModeTab, customerMode === 'ai' && styles.customerModeTabActive]}><Sparkles size={14} color={customerMode === 'ai' ? colors.primary : colors.muted} /><Text style={[styles.customerModeText, customerMode === 'ai' && styles.customerModeTextActive]}>AI gợi ý</Text></Pressable>
              </View>
              {customerMode === 'ai' ? <>
                <View style={styles.aiSuggestionCard}>
                  <Text style={styles.fieldLabel}>Mô tả sản phẩm khách cần</Text>
                  <TextInput value={requirements} onChangeText={setRequirements} style={[styles.input, styles.multilineInput]} placeholder="Ví dụ: lát nền phòng khách bằng gạch porcelain, gồm vật tư và nhân công..." placeholderTextColor={colors.muted} multiline maxLength={3000} />
                  <Pressable disabled={busy || !requirements.trim()} onPress={() => { void suggestCustomerItems(); }} style={[styles.secondaryButton, (busy || !requirements.trim()) && styles.disabled]}>{busy ? <ActivityIndicator size="small" color={colors.primary} /> : <Sparkles size={14} color={colors.primary} />}<Text style={styles.secondaryText}>{busy ? 'AI đang gợi ý...' : 'Gợi ý hạng mục'}</Text></Pressable>
                  {!!suggestionNotes.length && <Text style={styles.helperText}>{suggestionNotes.join(' · ')}</Text>}
                  {!!suggestionQuestions.length && <View style={styles.analysisNotice}><CircleAlert size={14} color="#9A6500" /><Text style={styles.analysisNoticeText}>AI cần thêm thông tin: {suggestionQuestions.join(' · ')}</Text></View>}
                  {!!missingProducts.length && <View style={styles.missingProductNotice}><Text style={styles.rowTitle}>Chưa có trong bảng giá</Text>{missingProducts.map((name) => <Text key={name} style={styles.mutedText}>• {name}</Text>)}</View>}
                </View>

                <View style={styles.sectionHeadingRow}>
                  <View style={styles.sectionHeadingLeft}>
                    <Package size={16} color={colors.primary} />
                    <Text style={styles.sectionTitle}>{aiSuggested ? 'Sản phẩm AI gợi ý' : 'Hạng mục đã chọn'}</Text>
                    <Text style={styles.countPill}>{selectedCatalogIds.length + missingProducts.length}</Text>
                  </View>
                  <Pressable onPress={() => { setSearch(''); setManualPickerOpen(true); }} style={styles.addProductButton}>
                    <Plus size={14} color={colors.primary} />
                    <Text style={styles.addProductButtonText}>Thêm sản phẩm</Text>
                  </Pressable>
                </View>

                {catalogLoading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : selectedCatalogItems.length ? selectedCatalogItems.map((item) => {
                  const isFromAi = aiSuggestedIds.includes(item._id);
                  return (
                    <View key={item._id} style={styles.catalogRow}>
                      <View style={[styles.checkbox, styles.checkboxActive]}><Check size={13} color={colors.white} /></View>
                      <View style={styles.catalogCopy}>
                        <View style={styles.catalogNameRow}>
                          <Text numberOfLines={2} style={styles.catalogName}>{item.name}</Text>
                          {isFromAi && <View style={styles.aiTag}><Sparkles size={10} color={colors.primary} /><Text style={styles.aiTagText}>AI</Text></View>}
                        </View>
                        <Text style={styles.catalogMeta}>{item.sku} · {item.unit} · {formatMoney(item.price, item.currency)}</Text>
                      </View>
                      <Pressable onPress={() => toggleCatalogItem(item)} style={styles.removeProductButton} accessibilityLabel={`Bỏ ${item.name}`}>
                        <X size={15} color="#B54745" />
                      </Pressable>
                    </View>
                  );
                }) : (
                  <View style={styles.emptySuggestionBox}>
                    <Text style={styles.emptyCopy}>
                      {aiSuggested
                        ? 'AI chưa tìm thấy sản phẩm khớp trong bảng giá. Bấm “Thêm sản phẩm” để chọn thủ công.'
                        : 'Bấm “Gợi ý hạng mục” để AI đề xuất sản phẩm, hoặc bấm “Thêm sản phẩm” để chọn thủ công.'}
                    </Text>
                  </View>
                )}
              </> : <>
                <View style={styles.sectionHeading}><Package size={16} color={colors.primary} /><Text style={styles.sectionTitle}>Hạng mục đã chọn</Text><Text style={styles.countPill}>{selectedCatalogIds.length + missingProducts.length}</Text></View>
                <View style={styles.searchBox}><Search size={15} color={colors.muted} /><TextInput value={search} onChangeText={setSearch} style={styles.searchInput} placeholder="Tìm tên hoặc mã sản phẩm..." placeholderTextColor={colors.muted} /></View>
                {catalogLoading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : visibleCatalog.map((item) => {
                  const chosen = selectedCatalogIds.includes(item._id);
                  return <Pressable key={item._id} onPress={() => toggleCatalogItem(item)} style={styles.catalogRow}><View style={[styles.checkbox, chosen && styles.checkboxActive]}>{chosen && <Check size={13} color={colors.white} />}</View><View style={styles.catalogCopy}><Text style={styles.catalogName}>{item.name}</Text><Text style={styles.catalogMeta}>{item.sku} · {item.unit} · {formatMoney(item.price, item.currency)}</Text></View>{chosen && <Check size={14} color={colors.primary} />}</Pressable>;
                })}
              </>}
            </>}
          </>}
          {!!error && <View style={styles.formError}><CircleAlert size={15} color="#B54745" /><PopupError error={error} /></View>}
          {(kind === 'customer' || analysis) && <View style={styles.footerActions}><Pressable onPress={onClose} disabled={busy} style={styles.cancelButton}><Text style={styles.cancelText}>Hủy</Text></Pressable><Pressable disabled={busy || templateLoading || !templates.length || (kind === 'estimate' && !analysis) || (kind === 'customer' && (catalogLoading || (!selectedCatalogIds.length && !missingProducts.length)))} onPress={() => { void (kind === 'estimate' ? saveEstimate() : saveCustomerQuote()); }} style={[styles.primaryButton, (busy || !templates.length || (kind === 'customer' && !selectedCatalogIds.length && !missingProducts.length)) && styles.buttonDisabled]}>{busy ? <ActivityIndicator size="small" color={colors.white} /> : <Check size={16} color={colors.white} />}<Text style={styles.primaryButtonText}>{busy ? 'Đang lưu...' : kind === 'estimate' ? 'Tạo dự toán' : 'Tạo báo giá'}</Text></Pressable></View>}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
    {manualPickerOpen && (
      <View style={styles.pickerOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setManualPickerOpen(false)} />
        <View style={styles.pickerCard}>
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Thêm sản phẩm</Text>
              <Text style={styles.sheetSubtitle}>Đã chọn {selectedCatalogIds.length} sản phẩm</Text>
            </View>
            <Pressable onPress={() => setManualPickerOpen(false)} style={styles.closeButton} accessibilityLabel="Đóng chọn sản phẩm">
              <X size={18} color={colors.muted} />
            </Pressable>
          </View>
          <View style={[styles.searchBox, styles.pickerSearch]}>
            <Search size={15} color={colors.muted} />
            <TextInput value={search} onChangeText={setSearch} style={styles.searchInput} placeholder="Tìm tên hoặc mã sản phẩm..." placeholderTextColor={colors.muted} />
          </View>
          <ScrollView style={styles.pickerList} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {catalogLoading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : visibleCatalog.length ? visibleCatalog.map((item) => {
              const chosen = selectedCatalogIds.includes(item._id);
              return (
                <Pressable key={item._id} onPress={() => toggleCatalogItem(item)} style={styles.catalogRow}>
                  <View style={[styles.checkbox, chosen && styles.checkboxActive]}>{chosen && <Check size={13} color={colors.white} />}</View>
                  <View style={styles.catalogCopy}>
                    <Text style={styles.catalogName}>{item.name}</Text>
                    <Text style={styles.catalogMeta}>{item.sku} · {item.unit} · {formatMoney(item.price, item.currency)}</Text>
                  </View>
                  {chosen && <Check size={14} color={colors.primary} />}
                </Pressable>
              );
            }) : <Text style={styles.emptyCopy}>Không tìm thấy sản phẩm phù hợp.</Text>}
          </ScrollView>
          <Pressable onPress={() => setManualPickerOpen(false)} style={styles.pickerDoneButton}>
            <Check size={15} color={colors.white} />
            <Text style={styles.primaryButtonText}>Xong ({selectedCatalogIds.length})</Text>
          </Pressable>
        </View>
      </View>
    )}
  </View>;
}

function ErpCustomerPicker({ enabled, disabled, scope, onSelect }: { enabled: boolean; disabled: boolean; scope: QuotationScope; onSelect: (customer: { _id: string; customerCode: string; name: string; phone: string; email?: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState<Array<{ _id: string; customerCode: string; name: string; phone: string; email?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !enabled) return;
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      void searchErpQuotationCustomers(scope, query).then((items) => {
        if (active) { setCustomers(items); setError(''); }
      }).catch((cause) => {
        if (active) { setCustomers([]); setError(errorMessage(cause)); }
      }).finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [enabled, open, query, scope]);

  if (!enabled) return null;
  return <View style={styles.customerPicker}>
    <Pressable disabled={disabled} onPress={() => setOpen((value) => !value)} style={styles.customerPickerToggle}>
      <UserRound size={14} color={colors.primary} />
      <Text style={styles.customerPickerToggleText}>{open ? 'Ẩn danh sách khách ERP' : 'Chọn khách hàng từ ERP'}</Text>
      <ChevronRight size={14} color={colors.muted} style={open ? styles.customerPickerChevronOpen : undefined} />
    </Pressable>
    {open && <View style={styles.customerPickerMenu}>
      <View style={styles.searchBox}><Search size={14} color={colors.muted} /><TextInput value={query} onChangeText={setQuery} style={styles.searchInput} placeholder="Tìm theo tên, mã hoặc điện thoại" placeholderTextColor={colors.muted} editable={!disabled} /></View>
      {loading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : customers.slice(0, 20).map((customer) => <Pressable key={customer._id} disabled={disabled} onPress={() => { onSelect(customer); setOpen(false); }} style={styles.customerResult}>
        <View style={styles.customerResultCopy}><Text numberOfLines={1} style={styles.rowTitle}>{customer.name}</Text><Text numberOfLines={1} style={styles.mutedText}>{[customer.customerCode, customer.phone, customer.email].filter(Boolean).join(' · ')}</Text></View>
        <ChevronRight size={14} color={colors.muted} />
      </Pressable>)}
      {!!error && <PopupError error={error} />}
      {!loading && !error && !customers.length && <Text style={styles.emptyCopy}>Không tìm thấy khách hàng phù hợp.</Text>}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  moduleContainer: { flex: 1, backgroundColor: colors.background },
  headerBranchBtn: { backgroundColor: '#EAF2FF', borderColor: '#D6E5FF', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, maxWidth: 155 },
  branchBtnContent: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  branchBtnText: { color: colors.primary, fontSize: 11, fontWeight: '700', flexShrink: 1 },
  branchBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.42)', justifyContent: 'center', padding: 16 },
  branchSheet: { backgroundColor: colors.white, borderRadius: 24, overflow: 'hidden', padding: 16, gap: 8, maxHeight: 300 },
  branchSheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  branchSheetTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  branchCloseButton: { width: 32, height: 32, borderRadius: 11, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center' },
  branchList: { flexGrow: 0, maxHeight: 200 },
  branchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 12, borderRadius: 12, marginBottom: 6, backgroundColor: '#F8FAFD' },
  branchRowActive: { backgroundColor: '#EAF2FF' },
  branchRowTitle: { flex: 1, color: colors.ink, fontSize: 13, fontWeight: '700' },
  moduleNavigationScroll: { flexGrow: 0, flexShrink: 0, height: 38, marginBottom: 0 },
  moduleNavigation: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 18 },
  moduleNavItem: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, borderRadius: 99, paddingHorizontal: 11, paddingVertical: 7 },
  moduleNavItemActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  moduleNavText: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  moduleNavTextActive: { color: colors.white },
  moduleContent: { flex: 1 },
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 28 },
  permissionState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  permissionTitle: { color: colors.ink, fontSize: 17, fontWeight: '800', marginTop: 12 },
  permissionCopy: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 6 },
  primaryIconButton: { width: 39, height: 39, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  kindTabs: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  kindTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: colors.border, borderRadius: 13, backgroundColor: colors.white, paddingVertical: 11 },
  kindTabActive: { backgroundColor: '#EEF4FF', borderColor: '#C9DAFF' },
  kindTabText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  kindTabTextActive: { color: colors.primary },
  statsRow: { flexDirection: 'row', gap: 9, marginBottom: 12 },
  statCard: { flex: 1, minWidth: 0, minHeight: 76, paddingHorizontal: 8, paddingVertical: 10, justifyContent: 'center', borderRadius: 14 },
  statValue: { color: colors.ink, fontSize: 19, fontWeight: '800', textAlign: 'center' },
  statValueSmall: { color: colors.ink, fontSize: 12, fontWeight: '800', textAlign: 'center' },
  statLabel: { color: colors.muted, fontSize: 9, lineHeight: 12, textAlign: 'center', marginTop: 5 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 43, paddingHorizontal: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 13 },
  searchInput: { flex: 1, color: colors.ink, fontSize: 11, paddingVertical: 9 },
  customerPicker: { marginBottom: 8 },
  customerPickerToggle: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, borderWidth: 1, borderColor: '#D5E2FA', borderRadius: 10, backgroundColor: '#F6F9FF' },
  customerPickerToggleText: { flex: 1, color: colors.primary, fontSize: 9, fontWeight: '700' },
  customerPickerChevronOpen: { transform: [{ rotate: '90deg' }] },
  customerPickerMenu: { marginTop: 6, padding: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 11, backgroundColor: colors.white, gap: 5 },
  customerResult: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, borderBottomWidth: 1, borderBottomColor: '#F0F2F6' },
  customerResultCopy: { flex: 1 },
  requestFileRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 7 },
  requestFileName: { flex: 1, color: colors.muted, fontSize: 8 },
  refreshButton: { padding: 4 },
  filters: { gap: 7, paddingVertical: 12 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.muted, fontSize: 9, fontWeight: '700' },
  filterTextActive: { color: colors.white },
  listHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 9 },
  listHeadingActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  listTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  listSubtitle: { color: colors.muted, fontSize: 9, marginTop: 2 },
  rowCopy: { flex: 1, marginHorizontal: 8 },
  rowTitle: { color: colors.ink, fontSize: 10, fontWeight: '800' },
  mutedText: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 3 },
  secondaryText: { color: colors.primary, fontSize: 9, fontWeight: '800' },
  pageLabel: { color: colors.muted, fontSize: 9, fontWeight: '700' },
  quoteRow: { padding: 14, marginBottom: 10, borderRadius: 16 },
  quoteRowTop: { flexDirection: 'row', alignItems: 'flex-start' },
  quoteDocIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EEF4FF', alignItems: 'center', justifyContent: 'center' },
  quoteRowCopy: { flex: 1, minWidth: 0, marginLeft: 11 },
  quoteHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  quoteNumber: { color: colors.ink, fontSize: 12, fontWeight: '800', flex: 1, minWidth: 0 },
  customerName: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 5 },
  statusBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10, flexShrink: 0 },
  statusText: { fontSize: 9, fontWeight: '800' },
  quoteMetaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 13 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F6F8FB', borderRadius: 9, paddingHorizontal: 9, paddingVertical: 6 },
  metaText: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  quoteRowBottom: { flexDirection: 'row', alignItems: 'center', marginTop: 13, paddingTop: 11, borderTopWidth: 1, borderTopColor: '#F0F2F6' },
  quoteTotalBlock: { flex: 1, minWidth: 0 },
  quoteTotalLabel: { color: colors.muted, fontSize: 9, fontWeight: '600', marginBottom: 3 },
  quoteTotal: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  quoteChevron: { width: 32, height: 32, borderRadius: 11, backgroundColor: '#EEF4FF', alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  loading: { paddingVertical: 26 },
  emptyCard: { alignItems: 'center', padding: 22, marginTop: 4 },
  emptyTitle: { color: colors.ink, fontSize: 13, fontWeight: '800', marginTop: 9 },
  emptyCopy: { color: colors.muted, fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 5 },
  emptyButton: { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 8, marginTop: 9 },
  emptyButtonText: { color: colors.primary, fontSize: 10, fontWeight: '800' },
  errorCard: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 11, marginBottom: 8, borderColor: '#F2D3D1' },
  errorText: { flex: 1, color: '#A33D3A', fontSize: 10, lineHeight: 15 },
  retryText: { color: colors.primary, fontSize: 10, fontWeight: '800' },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  pageButton: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 7 },
  pageButtonText: { color: colors.ink, fontSize: 10, fontWeight: '700' },
  disabledButton: { opacity: 0.45 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(12, 24, 45, 0.38)' },
  sheetKeyboard: { flex: 1, justifyContent: 'flex-end' },
  detailSheet: { maxHeight: '92%', minHeight: '65%', backgroundColor: colors.background, borderTopLeftRadius: 23, borderTopRightRadius: 23, paddingHorizontal: 16, paddingBottom: 24 },
  createSheet: { maxHeight: '94%', minHeight: '70%', backgroundColor: colors.background, borderTopLeftRadius: 23, borderTopRightRadius: 23, paddingHorizontal: 16, paddingBottom: 16 },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: '#CBD3DF', alignSelf: 'center', marginTop: 9, marginBottom: 10 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  sheetTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  sheetSubtitle: { color: colors.muted, fontSize: 9, marginTop: 3 },
  closeButton: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#EDF0F5', alignItems: 'center', justifyContent: 'center' },
  detailScroll: { flex: 1 },
  detailContent: { paddingTop: 13, paddingBottom: 12 },
  detailHero: { flexDirection: 'row', alignItems: 'center', marginBottom: 11 },
  detailIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' },
  detailHeroCopy: { flex: 1, marginLeft: 10, gap: 5 },
  detailNumber: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  infoCard: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 15 },
  infoLine: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: '#F1F3F7' },
  infoLabel: { width: 78, color: colors.muted, fontSize: 9 },
  infoValue: { flex: 1, color: colors.ink, fontSize: 10, fontWeight: '600', textAlign: 'right' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 15, marginBottom: 8 },
  sectionTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  linesCard: { paddingHorizontal: 12, paddingTop: 2, paddingBottom: 10, borderRadius: 15 },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  quantityAmount: { alignItems: 'flex-end', gap: 4 },
  lineBorder: { borderTopWidth: 1, borderTopColor: '#F1F3F7' },
  lineCopy: { flex: 1 },
  lineName: { color: colors.ink, fontSize: 10, fontWeight: '700' },
  lineMeta: { color: colors.muted, fontSize: 8, marginTop: 3 },
  lineAmount: { color: colors.ink, fontSize: 9, fontWeight: '700' },
  emptyLine: { color: colors.muted, fontSize: 10, paddingVertical: 12 },
  totalLine: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8 },
  totalLabel: { color: colors.muted, fontSize: 9 },
  totalValue: { color: colors.ink, fontSize: 9, fontWeight: '600' },
  grandTotal: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 9, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  grandTotalLabel: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  grandTotalValue: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  warningCard: { padding: 12, marginTop: 9, borderColor: '#F1D99B', backgroundColor: '#FFFCF2' },
  warningHeading: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  warningTitle: { color: '#805600', fontSize: 10, fontWeight: '800' },
  warningListItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 6 },
  warningItem: { flex: 1, color: '#805600', fontSize: 9, lineHeight: 15 },
  rejectionCard: { padding: 12, marginTop: 9, borderColor: '#F2D3D1', backgroundColor: '#FFF9F8' },
  rejectionTitle: { color: '#A33D3A', fontSize: 10, fontWeight: '800' },
  rejectionCopy: { color: '#7C3F3D', fontSize: 10, lineHeight: 16, marginTop: 5 },
  requestCard: { padding: 12, marginTop: 9 },
  requestTitle: { color: colors.ink, fontSize: 10, fontWeight: '800' },
  requestCopy: { color: colors.muted, fontSize: 9, lineHeight: 15, marginTop: 5 },
  exportCard: { padding: 11, marginTop: 9, gap: 8 },
  exportErrorText: { color: '#A33D3A', fontSize: 9, lineHeight: 14 },
  editCard: { padding: 11, marginTop: 10, gap: 5 },
  topInput: { marginTop: 8 },
  confirmChip: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: colors.border, borderRadius: 11, backgroundColor: colors.white },
  confirmChipActive: { borderColor: '#A7DEC5', backgroundColor: '#E8F7F0' },
  confirmChipText: { color: colors.ink, fontSize: 9, fontWeight: '700' },
  subSection: { marginTop: 10, gap: 7 },
  lineEditCard: { gap: 6, paddingVertical: 9 },
  editLineHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addSupplementalButton: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: '#F8FAFD' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  secondaryButton: { minHeight: 35, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  disabled: { opacity: 0.55 },
  detailActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  actionButton: { minHeight: 37, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 11, borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  actionPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  actionDestructive: { borderColor: '#F0CDCB', backgroundColor: '#FFF8F7' },
  actionText: { color: colors.ink, fontSize: 9, fontWeight: '800' },
  actionTextPrimary: { color: colors.white },
  actionTextDestructive: { color: '#B54745' },
  rejectEditor: { padding: 11, marginTop: 9, borderRadius: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  fieldLabel: { color: colors.ink, fontSize: 10, fontWeight: '800', marginTop: 12, marginBottom: 6 },
  input: { minHeight: 42, paddingHorizontal: 11, paddingVertical: 9, color: colors.ink, fontSize: 10, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 11 },
  multilineInput: { minHeight: 82, textAlignVertical: 'top' },
  secondaryAction: { alignSelf: 'flex-end', paddingHorizontal: 12, paddingVertical: 9, marginTop: 8, borderRadius: 10, backgroundColor: '#EEF4FF' },
  secondaryActionText: { color: colors.primary, fontSize: 9, fontWeight: '800' },
  buttonDisabled: { opacity: 0.55 },
  createScroll: { flex: 1 },
  createContent: { paddingTop: 1, paddingBottom: 14 },
  templateOptions: { gap: 7 },
  templateOption: { maxWidth: 210, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 9, borderWidth: 1, borderColor: colors.border, borderRadius: 11, backgroundColor: colors.white },
  templateOptionActive: { backgroundColor: '#EEF4FF', borderColor: '#C9DAFF' },
  templateText: { flexShrink: 1, color: colors.muted, fontSize: 9, fontWeight: '700' },
  templateTextActive: { color: colors.primary },
  twoInputs: { flexDirection: 'row', gap: 8, marginTop: 8 },
  halfInput: { flex: 1 },
  requirementInput: { minHeight: 66, textAlignVertical: 'top' },
  customerModeTabs: { flexDirection: 'row', gap: 7, marginTop: 12 },
  customerModeTab: { flex: 1, minHeight: 37, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 11, backgroundColor: colors.white },
  customerModeTabActive: { borderColor: '#C9DAFF', backgroundColor: '#EEF4FF' },
  customerModeText: { color: colors.muted, fontSize: 9, fontWeight: '700' },
  customerModeTextActive: { color: colors.primary },
  aiSuggestionCard: { padding: 10, marginTop: 8, borderWidth: 1, borderColor: '#D8E5FC', borderRadius: 13, backgroundColor: '#F7FAFF' },
  missingProductNotice: { padding: 9, marginTop: 8, borderRadius: 10, backgroundColor: '#FFF7E3' },
  sourceQuoteCard: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, marginTop: 10, borderRadius: 12 },
  choiceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7, padding: 9, marginTop: 5, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.white },
  choiceSelected: { borderColor: '#AFC7F6', backgroundColor: '#F5F8FF' },
  analysisHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 15, marginBottom: 8 },
  helperText: { color: colors.muted, fontSize: 8, marginTop: 3 },
  reanalyzeButton: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6 },
  reanalyzeText: { color: colors.primary, fontSize: 8, fontWeight: '800' },
  analysisNotice: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 9, marginBottom: 8, borderRadius: 10, backgroundColor: '#FFF7E3' },
  analysisNoticeText: { flex: 1, color: '#805600', fontSize: 8, lineHeight: 13 },
  catalogRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 10, paddingVertical: 8, marginTop: 6, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  checkbox: { width: 19, height: 19, borderRadius: 6, borderWidth: 1, borderColor: '#BBC5D3', alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  catalogCopy: { flex: 1 },
  catalogName: { color: colors.ink, fontSize: 9, fontWeight: '700' },
  catalogMeta: { color: colors.muted, fontSize: 8, marginTop: 3 },
  quantityInput: { width: 45, height: 31, color: colors.ink, fontSize: 9, textAlign: 'center', padding: 3, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  countPill: { minWidth: 19, overflow: 'hidden', color: colors.primary, backgroundColor: '#EAF2FF', fontSize: 8, fontWeight: '800', textAlign: 'center', paddingHorizontal: 5, paddingVertical: 3, borderRadius: 8 },
  formError: { flexDirection: 'row', gap: 6, padding: 9, marginTop: 10, borderRadius: 10, backgroundColor: '#FFF0EF' },
  formErrorText: { flex: 1, color: '#A33D3A', fontSize: 9, lineHeight: 14 },
  footerActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  cancelButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, marginTop: 10, borderRadius: 11, backgroundColor: '#E9EDF4' },
  cancelText: { color: colors.ink, fontSize: 9, fontWeight: '800' },
  primaryButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 13, marginTop: 10, borderRadius: 11, backgroundColor: colors.primary },
  primaryButtonText: { color: colors.white, fontSize: 9, fontWeight: '800' },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 15, marginBottom: 8 },
  sectionHeadingLeft: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 },
  addProductButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: '#EAF2FF', borderWidth: 1, borderColor: '#C9DAFF' },
  addProductButtonText: { color: colors.primary, fontSize: 9, fontWeight: '800' },
  catalogNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  aiTag: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99, backgroundColor: '#EAF2FF' },
  aiTagText: { color: colors.primary, fontSize: 8, fontWeight: '800' },
  removeProductButton: { width: 28, height: 28, borderRadius: 9, backgroundColor: '#FFF0EF', alignItems: 'center', justifyContent: 'center' },
  emptySuggestionBox: { padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, marginTop: 4 },
  pickerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', padding: 16, backgroundColor: 'rgba(12, 24, 45, 0.45)', zIndex: 20 },
  pickerCard: { maxHeight: '82%', backgroundColor: colors.background, borderRadius: 24, overflow: 'hidden', padding: 16 },
  pickerSearch: { marginTop: 10, marginBottom: 6 },
  pickerList: { maxHeight: 380 },
  pickerDoneButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, borderRadius: 12, backgroundColor: colors.primary },
});
