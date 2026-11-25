import { Link } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Building2, Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/core/auth/AuthProvider';
import {
  fetchCompanyBranches,
  fetchDashboardSummary,
  fetchFinanceOverview,
  fetchHealthcareOverview,
  fetchMarketingOverview,
  fetchQuotationOverview,
  fetchRetailOverview,
  fetchWorkerOverview,
  type ErpBranch,
} from '@/features/overview/overviewApi';
import { resolveAllowedOverviewPages } from '@/features/overview/overviewCatalog';
import {
  formatDisplayDate,
  getOverviewDateRange,
  OVERVIEW_PERIOD_OPTIONS,
} from '@/features/overview/overviewPeriod';
import {
  OverviewError,
  OverviewLoading,
} from '@/features/overview/OverviewWidgets';
import {
  HealthcareOverviewView,
  StudentOverviewView,
  WorkerOverviewView,
} from '@/features/overview/sections/DomainOverviewViews';
import { FinanceOverviewView } from '@/features/overview/sections/FinanceOverviewView';
import { HrOverviewView } from '@/features/overview/sections/HrOverviewView';
import { MarketingOverviewView } from '@/features/overview/sections/MarketingOverviewView';
import { QuotationOverviewView } from '@/features/overview/sections/QuotationOverviewView';
import { RetailOverviewView } from '@/features/overview/sections/RetailOverviewView';
import type {
  DashboardSummaryData,
  FinanceOverviewReport,
  HealthcareOverviewData,
  MarketingOverviewData,
  OverviewPageId,
  OverviewPeriodKey,
  QuotationOverviewData,
  RetailOverviewReport,
  WorkerOverviewData,
} from '@/features/overview/types';
import { colors } from '@/theme/colors';

type PagePayload =
  | { kind: 'finance'; report: FinanceOverviewReport; previous: FinanceOverviewReport | null }
  | { kind: 'hr'; summary: DashboardSummaryData; previous: DashboardSummaryData | null }
  | { kind: 'quotation'; data: QuotationOverviewData; previous: QuotationOverviewData | null }
  | { kind: 'retail'; report: RetailOverviewReport }
  | { kind: 'marketing'; data: MarketingOverviewData }
  | { kind: 'student'; summary: DashboardSummaryData; previous: DashboardSummaryData | null }
  | { kind: 'worker'; data: WorkerOverviewData }
  | { kind: 'healthcare'; data: HealthcareOverviewData };

type CacheEntry = { payload: PagePayload; fetchedAt: number };

function getInitials(name?: string) {
  return (
    name
      ?.trim()
      .split(/\s+/)
      .slice(-2)
      .map((part) => part[0]?.toLocaleUpperCase('vi'))
      .join('') || 'ERP'
  );
}

function formatClock(timestamp: number) {
  const d = new Date(timestamp);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function OverviewHubScreen({ embedded = false }: { embedded?: boolean } = {}) {
  const {
    user,
    activeBranchId: selectedBranchId,
    setActiveBranchId: setSelectedBranchId,
  } = useAuth();
  const allowedPages = useMemo(() => resolveAllowedOverviewPages(user), [user]);

  const [selectedPageId, setSelectedPageId] = useState<OverviewPageId | null>(
    () => allowedPages[0]?.id ?? null,
  );
  const [periodKey, setPeriodKey] = useState<OverviewPeriodKey>('month');
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [branchPickerOpen, setBranchPickerOpen] = useState(false);

  const canSwitchBranch = user?.role === 'admin' || user?.role === 'superadmin' || !user?.branchId;
  const [branches, setBranches] = useState<ErpBranch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(Boolean(canSwitchBranch && user?.companyCode));
  useEffect(() => {
    if (!user?.companyCode) {
      setBranches([]);
      setBranchesLoading(false);
      return;
    }
    if (!canSwitchBranch && user.branchId) {
      setSelectedBranchId(user.branchId);
      setBranchesLoading(false);
      return;
    }
    const controller = new AbortController();
    setBranchesLoading(true);
    void fetchCompanyBranches(controller.signal)
      .then((list) => {
        if (controller.signal.aborted) return;
        setBranches(list);
        setSelectedBranchId((current) => {
          if (current && list.some((b) => b._id === current)) return current;
          if (user.branchId && list.some((b) => b._id === user.branchId)) return user.branchId;
          return list[0]?._id ?? user.branchId ?? '';
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setSelectedBranchId((current) => current || user.branchId || '');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setBranchesLoading(false);
      });
    return () => controller.abort();
  }, [canSwitchBranch, user?.branchId, user?.companyCode]);

  const activeBranchId = selectedBranchId || user?.branchId || undefined;
  const activeBranchName =
    branches.find((b) => b._id === activeBranchId)?.name || user?.branchName;

  const activePage = useMemo(
    () => allowedPages.find((p) => p.id === selectedPageId) ?? allowedPages[0],
    [allowedPages, selectedPageId],
  );
  const activePageId: OverviewPageId | null = activePage?.id ?? null;

  const range = useMemo(() => getOverviewDateRange(periodKey), [periodKey]);

  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const [reloadTick, setReloadTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<PagePayload | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const scopeKey = `${user?.companyCode ?? ''}:${activeBranchId ?? ''}`;
  const requestKey = `${scopeKey}:${activePageId}:${range.from}:${range.to}`;

  const loadActivePage = useCallback(
    async (force: boolean, signal: AbortSignal) => {
      if (!activePageId) {
        setPayload(null);
        setError(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (branchesLoading && !activeBranchId) {
        setLoading(true);
        return;
      }
      const cached = cacheRef.current.get(requestKey);
      if (!force && cached && Date.now() - cached.fetchedAt < 60_000) {
        setPayload(cached.payload);
        setUpdatedAt(cached.fetchedAt);
        setError(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (!force) {
        setLoading(true);
      }
      setError(null);

      const scope = {
        branchId: activeBranchId,
        companyCode: user?.companyCode,
        signal,
      };

      try {
        let next: PagePayload;

        switch (activePageId) {
          case 'finance': {
            const [currRes, prevRes] = await Promise.allSettled([
              fetchFinanceOverview(range.from, range.to, scope),
              fetchFinanceOverview(range.previousFrom, range.previousTo, scope),
            ]);
            if (currRes.status === 'rejected') throw currRes.reason;
            next = {
              kind: 'finance',
              report: currRes.value,
              previous: prevRes.status === 'fulfilled' ? prevRes.value : null,
            };
            break;
          }
          case 'hr': {
            const [currRes, prevRes] = await Promise.allSettled([
              fetchDashboardSummary(range.from, range.to, scope),
              fetchDashboardSummary(range.previousFrom, range.previousTo, scope),
            ]);
            if (currRes.status === 'rejected') throw currRes.reason;
            next = {
              kind: 'hr',
              summary: currRes.value,
              previous: prevRes.status === 'fulfilled' ? prevRes.value : null,
            };
            break;
          }
          case 'quotation': {
            const [currRes, prevRes] = await Promise.allSettled([
              fetchQuotationOverview(range.from, range.to, scope),
              fetchQuotationOverview(range.previousFrom, range.previousTo, scope),
            ]);
            if (currRes.status === 'rejected') throw currRes.reason;
            next = {
              kind: 'quotation',
              data: currRes.value,
              previous: prevRes.status === 'fulfilled' ? prevRes.value : null,
            };
            break;
          }
          case 'retail': {
            const report = await fetchRetailOverview(range.from, range.to, scope);
            next = { kind: 'retail', report };
            break;
          }
          case 'marketing': {
            const data = await fetchMarketingOverview(scope);
            next = { kind: 'marketing', data };
            break;
          }
          case 'student': {
            const [currRes, prevRes] = await Promise.allSettled([
              fetchDashboardSummary(range.from, range.to, scope),
              fetchDashboardSummary(range.previousFrom, range.previousTo, scope),
            ]);
            if (currRes.status === 'rejected') throw currRes.reason;
            next = {
              kind: 'student',
              summary: currRes.value,
              previous: prevRes.status === 'fulfilled' ? prevRes.value : null,
            };
            break;
          }
          case 'worker': {
            const data = await fetchWorkerOverview(scope);
            next = { kind: 'worker', data };
            break;
          }
          case 'healthcare': {
            const data = await fetchHealthcareOverview(range.from, range.to, scope);
            next = { kind: 'healthcare', data };
            break;
          }
        }

        if (signal.aborted) return;
        const now = Date.now();
        cacheRef.current.set(requestKey, { payload: next, fetchedAt: now });
        setPayload(next);
        setUpdatedAt(now);
      } catch (err) {
        if (signal.aborted) return;
        const message =
          err instanceof Error
            ? err.message
            : 'Không thể kết nối máy chủ ERP để tải dữ liệu tổng quan.';
        setError(message);
      } finally {
        if (!signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [activePageId, activeBranchId, branchesLoading, range.from, range.to, range.previousFrom, range.previousTo, requestKey, user?.companyCode],
  );

  useEffect(() => {
    const controller = new AbortController();
    const force = reloadTick > 0;
    void loadActivePage(force, controller.signal);
    return () => controller.abort();
  }, [loadActivePage, reloadTick]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setReloadTick((t) => t + 1);
  }, []);

  const onRetry = useCallback(() => {
    setReloadTick((t) => t + 1);
  }, []);

  const onSelectPage = useCallback((id: OverviewPageId) => {
    setSelectedPageId(id);
    setSwitcherOpen(false);
  }, []);

  const currentPageIndex = useMemo(
    () => Math.max(0, allowedPages.findIndex((p) => p.id === activePageId)),
    [allowedPages, activePageId],
  );

  const onStepPage = useCallback(
    (delta: -1 | 1) => {
      if (allowedPages.length <= 1) return;
      const nextIndex = (currentPageIndex + delta + allowedPages.length) % allowedPages.length;
      const target = allowedPages[nextIndex];
      if (target) setSelectedPageId(target.id);
    },
    [allowedPages, currentPageIndex],
  );

  const renderSection = () => {
    if (!activePageId) {
      return (
        <Card>
          <Text style={styles.subtitle}>
            Tài khoản hiện chưa có trang tổng quan phân hệ nào được kích hoạt.
          </Text>
        </Card>
      );
    }
    if (loading && (!payload || payload.kind !== activePageId)) {
      return <OverviewLoading label={`Đang tải ${activePage?.label ?? 'tổng quan'} từ ERP...`} />;
    }
    if (error && (!payload || payload.kind !== activePageId)) {
      return <OverviewError message={error} onRetry={onRetry} />;
    }
    if (!payload || payload.kind !== activePageId) {
      return null;
    }

    switch (payload.kind) {
      case 'finance':
        return (
          <FinanceOverviewView
            report={payload.report}
            previousReport={payload.previous}
            range={range}
          />
        );
      case 'hr':
        return (
          <HrOverviewView
            summary={payload.summary}
            previousSummary={payload.previous}
            range={range}
          />
        );
      case 'quotation':
        return (
          <QuotationOverviewView
            data={payload.data}
            previous={payload.previous}
            range={range}
          />
        );
      case 'retail':
        return <RetailOverviewView report={payload.report} range={range} />;
      case 'marketing':
        return <MarketingOverviewView data={payload.data} range={range} />;
      case 'student':
        return (
          <StudentOverviewView
            summary={payload.summary}
            previousSummary={payload.previous}
            range={range}
          />
        );
      case 'worker':
        return <WorkerOverviewView data={payload.data} range={range} />;
      case 'healthcare':
        return <HealthcareOverviewView data={payload.data} range={range} />;
    }
  };

  const content = (
    <View style={styles.backdropWrap}>
      {/* Soft luminous icy-sky pastel gradient background matching the reference style */}
      <Svg pointerEvents="none" width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="overviewBg" x1="0" y1="0" x2="0.15" y2="1">
            <Stop offset="0" stopColor="#DFF3FC" stopOpacity="1" />
            <Stop offset="0.32" stopColor="#EAF2FB" stopOpacity="1" />
            <Stop offset="0.7" stopColor="#F1F5FB" stopOpacity="1" />
            <Stop offset="1" stopColor="#F5F7FC" stopOpacity="1" />
          </LinearGradient>
          <RadialGradient id="overviewGlowTopRight" cx="85%" cy="8%" rx="55%" ry="28%">
            <Stop offset="0" stopColor="#BCEAFB" stopOpacity="0.6" />
            <Stop offset="1" stopColor="#BCEAFB" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="overviewGlowMidLeft" cx="10%" cy="42%" rx="48%" ry="26%">
            <Stop offset="0" stopColor="#E4DCFF" stopOpacity="0.35" />
            <Stop offset="1" stopColor="#E4DCFF" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#overviewBg)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#overviewGlowTopRight)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#overviewGlowMidLeft)" />
      </Svg>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Top bar: Company / Branch + Profile Avatar */}
        <View style={styles.topLine}>
          <Pressable
            disabled={branches.length <= 1}
            onPress={() => setBranchPickerOpen(true)}
            style={styles.companyWrap}
          >
            <Text style={styles.eyebrow}>IGEN ERP</Text>
            <View style={styles.companyValueRow}>
              <Text numberOfLines={1} style={styles.company}>
                {user?.companyName || user?.companyCode || 'Doanh nghiệp ERP'}
                {activeBranchName ? ` · ${activeBranchName}` : ''}
              </Text>
              {branches.length > 1 ? <ChevronDown size={14} color={colors.ink} /> : null}
            </View>
          </Pressable>
          <Link href="/(tabs)/profile" asChild>
            <Pressable accessibilityRole="button" style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(user?.displayName)}</Text>
            </Pressable>
          </Link>
        </View>

        {/* Top Overview Tab Switcher Bar: Left / Center Dropdown / Right */}
        {allowedPages.length > 0 ? (
          <View style={styles.switcherBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Trang tổng quan trước"
              disabled={allowedPages.length <= 1}
              onPress={() => onStepPage(-1)}
              style={({ pressed }) => [
                styles.switcherNavBtn,
                allowedPages.length <= 1 && styles.switcherNavBtnDisabled,
                pressed && styles.switcherNavBtnPressed,
              ]}
            >
              <ChevronLeft size={18} color={colors.ink} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mở danh sách trang tổng quan"
              disabled={allowedPages.length <= 1}
              onPress={() => setSwitcherOpen(true)}
              style={({ pressed }) => [
                styles.switcherCenter,
                pressed && allowedPages.length > 1 && styles.switcherCenterPressed,
              ]}
            >
              <View style={styles.switcherTitleRow}>
                {activePage ? (
                  <View style={[styles.switcherIconBadge, { backgroundColor: activePage.tone }]}>
                    <activePage.icon size={14} color={activePage.accent} />
                  </View>
                ) : null}
                <Text numberOfLines={1} style={styles.switcherTitle}>
                  {activePage?.label ?? 'Tổng quan'}
                </Text>
                {allowedPages.length > 1 ? (
                  <ChevronDown size={15} color={colors.muted} />
                ) : null}
              </View>
              {activePage?.subtitle ? (
                <Text numberOfLines={1} style={styles.switcherSubtitle}>
                  {activePage.subtitle}
                </Text>
              ) : null}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Trang tổng quan tiếp theo"
              disabled={allowedPages.length <= 1}
              onPress={() => onStepPage(1)}
              style={({ pressed }) => [
                styles.switcherNavBtn,
                allowedPages.length <= 1 && styles.switcherNavBtnDisabled,
                pressed && styles.switcherNavBtnPressed,
              ]}
            >
              <ChevronRight size={18} color={colors.ink} />
            </Pressable>
          </View>
        ) : null}

        {/* Period filter bar */}
        <View style={styles.periodCard}>
          <View style={styles.periodHeader}>
            <Text style={styles.periodLabel}>Kỳ thống kê</Text>
            <Text style={styles.periodRange}>
              {formatDisplayDate(range.from)} – {formatDisplayDate(range.to)}
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.periodChipsRow}
          >
            {OVERVIEW_PERIOD_OPTIONS.map((opt) => {
              const active = opt.key === periodKey;
              return (
                <Pressable
                  key={opt.key}
                  accessibilityRole="button"
                  onPress={() => setPeriodKey(opt.key)}
                  style={[styles.periodChip, active && styles.periodChipActive]}
                >
                  <Text style={[styles.periodChipText, active && styles.periodChipTextActive]}>
                    {opt.label}
                  </Text>
                  {active ? <View style={styles.periodChipUnderline} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
          <Text style={styles.comparisonText}>{range.comparisonLabel}</Text>
        </View>

        {/* Active overview page body */}
        {renderSection()}

        {/* Footer */}
        <Text style={styles.footerNote}>
          Nguồn dữ liệu trực tiếp từ Igen ERP
          {updatedAt ? ` · Cập nhật lúc ${formatClock(updatedAt)}` : ''}
        </Text>
      </ScrollView>

      {/* Bottom sheet modal to choose among all overview pages */}
      <Modal
        visible={switcherOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSwitcherOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSwitcherOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn trang tổng quan</Text>
              <Pressable onPress={() => setSwitcherOpen(false)} hitSlop={8}>
                <Text style={styles.modalClose}>Đóng</Text>
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalList}>
              {allowedPages.map((page) => {
                const active = page.id === activePageId;
                const PageIcon = page.icon;
                return (
                  <Pressable
                    key={page.id}
                    onPress={() => onSelectPage(page.id)}
                    style={[styles.modalRow, active && styles.modalRowActive]}
                  >
                    <View style={[styles.modalIcon, { backgroundColor: page.tone }]}>
                      <PageIcon size={18} color={page.accent} />
                    </View>
                    <View style={styles.modalRowCopy}>
                      <Text style={styles.modalRowTitle}>{page.label}</Text>
                      <Text numberOfLines={1} style={styles.modalRowSub}>
                        {page.subtitle}
                      </Text>
                    </View>
                    {active ? <Check size={17} color={colors.primary} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
      {/* Bottom sheet modal to switch active branch */}
      <Modal
        visible={branchPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setBranchPickerOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setBranchPickerOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn chi nhánh</Text>
              <Pressable onPress={() => setBranchPickerOpen(false)} hitSlop={8}>
                <Text style={styles.modalClose}>Đóng</Text>
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalList}>
              {branches.map((branch) => {
                const active = branch._id === activeBranchId;
                return (
                  <Pressable
                    key={branch._id}
                    onPress={() => {
                      setSelectedBranchId(branch._id);
                      setBranchPickerOpen(false);
                    }}
                    style={[styles.modalRow, active && styles.modalRowActive]}
                  >
                    <View style={[styles.modalIcon, { backgroundColor: '#EAF2FF' }]}>
                      <Building2 size={18} color={colors.primary} />
                    </View>
                    <View style={styles.modalRowCopy}>
                      <Text style={styles.modalRowTitle}>{branch.name}</Text>
                      {branch.code ? (
                        <Text numberOfLines={1} style={styles.modalRowSub}>
                          Mã chi nhánh: {branch.code}
                        </Text>
                      ) : null}
                    </View>
                    {active ? <Check size={17} color={colors.primary} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );

  return embedded ? content : <Screen backgroundColor="#DFF3FC">{content}</Screen>;
}

export function EmbeddedOverviewScreen() {
  return <OverviewHubScreen embedded />;
}

const styles = StyleSheet.create({
  backdropWrap: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 28,
  },
  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 2,
    gap: 12,
  },
  companyWrap: {
    flex: 1,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  company: {
    color: colors.ink,
    fontSize: 12.5,
    fontWeight: '700',
    marginTop: 3,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D5E4F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 12.5,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 3,
  },
  companyValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  switcherBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5EAF2',
    paddingHorizontal: 6,
    paddingVertical: 8,
    marginBottom: 12,
  },
  switcherNavBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F8FD',
  },
  switcherNavBtnDisabled: {
    opacity: 0.35,
  },
  switcherNavBtnPressed: {
    backgroundColor: '#E8F0FC',
  },
  switcherCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  switcherCenterPressed: {
    opacity: 0.72,
  },
  switcherTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  switcherIconBadge: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switcherTitle: {
    color: colors.ink,
    fontSize: 14.5,
    fontWeight: '700',
    flexShrink: 1,
  },
  switcherSubtitle: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  periodCard: {
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5EAF2',
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 10,
    marginBottom: 16,
    gap: 8,
  },
  periodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  periodLabel: {
    color: colors.ink,
    fontSize: 11.5,
    fontWeight: '700',
  },
  periodRange: {
    color: colors.primary,
    fontSize: 10.5,
    fontWeight: '600',
  },
  periodChipsRow: {
    gap: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E9EFF7',
  },
  periodChip: {
    paddingHorizontal: 2,
    paddingTop: 4,
    paddingBottom: 8,
    position: 'relative',
  },
  periodChipActive: {},
  periodChipText: {
    color: '#6C788C',
    fontSize: 11.5,
    fontWeight: '500',
  },
  periodChipTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  periodChipUnderline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  comparisonText: {
    color: colors.muted,
    fontSize: 9,
  },
  footerNote: {
    color: colors.muted,
    fontSize: 9,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 6,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 28,
    maxHeight: '78%',
  },
  modalHandle: {
    width: 38,
    height: 4,
    borderRadius: 99,
    backgroundColor: '#D6DFEC',
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  modalClose: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  modalList: {
    flexGrow: 0,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 11,
    borderRadius: 14,
    gap: 12,
    marginBottom: 6,
  },
  modalRowActive: {
    backgroundColor: '#F0F6FF',
  },
  modalIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalRowCopy: {
    flex: 1,
  },
  modalRowTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  modalRowSub: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 2,
  },
});
