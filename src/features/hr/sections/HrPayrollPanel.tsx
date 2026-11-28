import { PopupError } from '@/components/PopupError';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Lock,
  Play,
  Plus,
  Send,
  XCircle,
} from 'lucide-react-native';
import { Card } from '@/components/Card';
import { IgenHrEmptyState } from '@/components/EmptyStateIllustration';
import { FullScreenFormModal } from '@/components/FullScreenFormModal';
import {
  HrFormInputRow,
  HrFormSectionTitle,
  HrFormSelectRow,
} from '@/features/hr/components/HrFormFields';
import { HrFab } from '@/features/hr/components/HrFab';
import {
  approvePayrollAdjustment,
  closePayrollRun,
  closePayrollPeriod,
  calculatePayrollRun,
  createPayrollAdjustment,
  getPayrollMonthlyKpi,
  getPayrollPeriodResults,
  getPayrollRun,
  listHrEmployees,
  listMyPayslips,
  listPayrollAdjustments,
  listPayrollPolicies,
  markPayrollRunPaid,
  processPayrollPeriod,
  publishPayrollPayslips,
  rejectPayrollAdjustment,
  reopenPayrollRun,
  requestMyPayslipReview,
  reviewPayrollPeriod,
  reviewPayrollRun,
} from '@/features/hr/hrApi';
import type {
  HrEmployee,
  HrPayrollAdjustment,
  HrPayrollLine,
  HrPayrollPolicy,
  HrPayrollRun,
  HrPayslip,
} from '@/features/hr/types';
import { formatCompactMoney } from '@/features/overview/overviewPeriod';
import { colors } from '@/theme/colors';

type PayrollSection = 'overview' | 'adjustments' | 'policies' | 'mine';

const STEPS = [
  { key: 'draft', label: 'Chuẩn bị' },
  { key: 'review', label: 'Kiểm tra' },
  { key: 'closed', label: 'Chốt' },
  { key: 'paid', label: 'Đã trả' },
] as const;

const ADJ_KINDS = [
  { value: 'bonus', label: 'Thưởng' },
  { value: 'allowance', label: 'Phụ cấp' },
  { value: 'deduction', label: 'Khấu trừ' },
  { value: 'advance', label: 'Tạm ứng' },
] as const;

function formatVnd(val?: number): string {
  const n = Number(val ?? 0);
  if (!Number.isFinite(n)) return '0 ₫';
  return `${Math.round(n).toLocaleString('vi-VN')} ₫`;
}

function firstNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function shiftPeriod(periodKey: string, deltaMonths: number): string {
  const [y, m] = periodKey.split('-').map(Number);
  const d = new Date(y, (m || 1) - 1 + deltaMonths, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function HrPayrollPanel({
  companyCode,
  branchId,
  canViewAll,
  canManage,
  canViewPolicies = canViewAll,
  canPublishPayslips = canManage,
  canMarkPaid = canManage,
}: {
  companyCode?: string;
  branchId?: string;
  canViewAll: boolean;
  canManage: boolean;
  canViewPolicies?: boolean;
  canPublishPayslips?: boolean;
  canMarkPaid?: boolean;
}) {
  const [section, setSection] = useState<PayrollSection>(canViewAll ? 'overview' : 'mine');
  const previousCanViewAll = useRef(canViewAll);
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [run, setRun] = useState<HrPayrollRun | null>(null);
  const [results, setResults] = useState<HrPayslip[]>([]);
  const [kpiByEmp, setKpiByEmp] = useState<Record<string, number | null>>({});
  const [adjustments, setAdjustments] = useState<HrPayrollAdjustment[]>([]);
  const [policies, setPolicies] = useState<HrPayrollPolicy[]>([]);
  const [myPayslips, setMyPayslips] = useState<HrPayslip[]>([]);
  const [employees, setEmployees] = useState<HrEmployee[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Detail modals
  const [selectedSlip, setSelectedSlip] = useState<HrPayslip | null>(null);
  const [selectedAdj, setSelectedAdj] = useState<HrPayrollAdjustment | null>(null);
  const [selectedPolicy, setSelectedPolicy] = useState<HrPayrollPolicy | null>(null);
  const [reviewMsg, setReviewMsg] = useState('');
  const [sendingReview, setSendingReview] = useState(false);

  // Reopen modal
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');

  // Create adjustment modal
  const [adjOpen, setAdjOpen] = useState(false);
  const [adjEmpId, setAdjEmpId] = useState('');
  const [adjKind, setAdjKind] = useState<string>('bonus');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjReason, setAdjReason] = useState('');

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        if (section === 'mine' || !canViewAll) {
          setMyPayslips(await listMyPayslips(branchId));
        } else if (section === 'policies') {
          setPolicies(canViewPolicies ? await listPayrollPolicies(branchId) : []);
        } else if (section === 'adjustments') {
          const [adjList, empList] = await Promise.all([
            listPayrollAdjustments(period, branchId).catch(() => []),
            companyCode ? listHrEmployees(companyCode, branchId).catch(() => []) : Promise.resolve([]),
          ]);
          setAdjustments(adjList);
          setEmployees(empList);
        } else {
          const [r, lines, kpi] = await Promise.all([
            getPayrollRun(period, branchId),
            getPayrollPeriodResults(period, branchId).catch(() => []),
            getPayrollMonthlyKpi(period, branchId).catch(() => ({})),
          ]);
          setRun(r);
          setResults(lines);
          setKpiByEmp(kpi);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không tải được dữ liệu bảng lương.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [branchId, canViewAll, canViewPolicies, companyCode, period, section],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!canViewAll) setSection('mine');
    else if (!previousCanViewAll.current) setSection('overview');
    previousCanViewAll.current = canViewAll;
  }, [canViewAll]);

  useEffect(() => {
    if (!canViewPolicies && section === 'policies') setSection(canViewAll ? 'overview' : 'mine');
  }, [canViewAll, canViewPolicies, section]);

  const payrollRows = useMemo<HrPayslip[]>(() => {
    if (!run) return results;
    if (run.effectiveError) return [];
    const lines: HrPayrollLine[] = run.effectiveLines?.length ? run.effectiveLines : (run.lines ?? []);
    if (!lines.length) return [];
    const attendanceByEmployee = new Map(results.map((row) => [String(row.employeeId || ''), row]));
    return lines.map((line) => {
      const attendance = attendanceByEmployee.get(String(line.employeeId));
      const calculation = line.calculation ?? {};
      const values = line.effectiveValues ?? line.systemValues ?? {};
      const netSalary = firstNumber(line.netSalary, line.net, calculation.net);
      const totalDeductions = firstNumber(line.totalDeductions, line.deductionTotal, line.deductions, calculation.deductions);
      return {
        _id: line._id ?? attendance?._id,
        id: line.id ?? attendance?.id,
        runId: run._id,
        periodKey: run.periodKey,
        employeeId: line.employeeId,
        employeeName: line.employeeName ?? attendance?.employeeName,
        department: attendance?.department,
        baseSalary: firstNumber(line.baseSalary, values.baseSalary, calculation.monthlySalary, attendance?.baseSalary, attendance?.monthlySalary),
        grossSalary: firstNumber(line.grossSalary, line.gross, calculation.gross)
          ?? (netSalary !== undefined && totalDeductions !== undefined ? netSalary + totalDeductions : undefined),
        netSalary,
        totalDeductions,
        deductions: totalDeductions,
        actualWorkDays: attendance?.actualWorkDays ?? attendance?.workedDays,
        standardWorkDays: attendance?.standardWorkDays,
        workedDays: attendance?.workedDays,
        shortageDays: attendance?.shortageDays,
        workedMinutes: attendance?.workedMinutes,
        shortageMinutes: attendance?.shortageMinutes,
        status: run.status,
      };
    });
  }, [results, run]);

  const filteredResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return payrollRows;
    return payrollRows.filter(
      (r) =>
        (r.employeeName || '').toLowerCase().includes(q) ||
        (r.department || '').toLowerCase().includes(q) ||
        (r.employeeCode || '').toLowerCase().includes(q),
    );
  }, [payrollRows, search]);

  const totals = useMemo(() => {
    const sum = (getValue: (row: HrPayslip) => unknown) => payrollRows.reduce((total, row) => total + (firstNumber(getValue(row)) ?? 0), 0);
    const runTotals = run?.totals;
    return {
      count: payrollRows.length,
      gross: firstNumber(runTotals?.grossPay, run?.totalGross) ?? sum((row) => row.grossSalary),
      net: firstNumber(runTotals?.netPay, run?.totalNet) ?? sum((row) => row.netSalary),
      ded: firstNumber(runTotals?.deductions, run?.totalDeductions) ?? sum((row) => row.totalDeductions ?? row.deductions),
      base: sum((row) => row.baseSalary ?? row.monthlySalary),
      workedDays: sum((row) => row.actualWorkDays ?? row.workedDays),
      shortageEmployees: payrollRows.filter((row) => (firstNumber(row.shortageDays) ?? 0) > 0 || (firstNumber(row.shortageMinutes) ?? 0) > 0).length,
    };
  }, [payrollRows, run]);

  const runAction = useCallback(
    async (fn: () => Promise<void>, successMsg: string) => {
      setActionLoading(true);
      try {
        await fn();
        Alert.alert('Thành công', successMsg);
        void load(true);
      } catch (err) {
        Alert.alert('Lỗi', err instanceof Error ? err.message : 'Thao tác thất bại.');
      } finally {
        setActionLoading(false);
      }
    },
    [load],
  );

  const onCreateAdjustment = useCallback(async () => {
    const amountNum = Number(adjAmount.replace(/[^\d.-]/g, ''));
    if (!adjEmpId || !Number.isFinite(amountNum) || amountNum <= 0 || !adjReason.trim()) {
      Alert.alert('Thiếu thông tin', 'Hãy chọn nhân viên, nhập số tiền hợp lệ và lý do.');
      return;
    }
    await runAction(async () => {
      await createPayrollAdjustment(
        period,
        { employeeId: adjEmpId, kind: adjKind, amount: amountNum, reason: adjReason.trim() },
        branchId,
      );
      setAdjOpen(false);
      setAdjAmount('');
      setAdjReason('');
    }, 'Đã thêm khoản điều chỉnh lương.');
  }, [adjAmount, adjEmpId, adjKind, adjReason, branchId, period, runAction]);

  const onSendReviewRequest = useCallback(async () => {
    if (!selectedSlip?.runId || !reviewMsg.trim()) {
      Alert.alert('Thiếu nội dung', 'Hãy nhập nội dung thắc mắc / đối soát.');
      return;
    }
    setSendingReview(true);
    try {
      await requestMyPayslipReview(selectedSlip.runId, reviewMsg.trim(), branchId);
      setReviewMsg('');
      Alert.alert('Đã gửi', 'Yêu cầu đối soát phiếu lương đã được gửi tới bộ phận Nhân sự.');
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể gửi yêu cầu đối soát.');
    } finally {
      setSendingReview(false);
    }
  }, [branchId, reviewMsg, selectedSlip?.runId]);

  const stepIndex = run ? STEPS.findIndex((s) => s.key === run.status) : results.length ? 0 : -1;
  const effectiveDataAvailable = !run?.effectiveError;
  const subSections: Array<{ key: PayrollSection; label: string }> = [
    { key: 'overview', label: 'Bảng lương' },
    { key: 'adjustments', label: 'Điều chỉnh' },
    ...(canViewPolicies ? [{ key: 'policies' as const, label: 'Chính sách' }] : []),
    { key: 'mine', label: 'Phiếu lương tôi' },
  ];

  return (
    <View style={{ flex: 1 }}>
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: 92 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load(true);
          }}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      {/* Sub-tabs */}
      {canViewAll ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, marginBottom: 10 }}
        >
          {subSections.map((item) => {
            const active = section === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setSection(item.key)}
                style={[styles.subTabPill, active && styles.subTabPillActive]}
              >
                <Text style={[styles.subTabText, active && styles.subTabTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {/* Period switcher (for overview & adjustments) */}
      {canViewAll && (section === 'overview' || section === 'adjustments') ? (
        <Card style={styles.dateBar}>
          <Pressable onPress={() => setPeriod((p) => shiftPeriod(p, -1))} style={styles.iconBtn}>
            <ChevronLeft size={16} color={colors.primary} />
          </Pressable>
          <Text style={styles.dateBarText}>Kỳ lương {period}</Text>
          <Pressable onPress={() => setPeriod((p) => shiftPeriod(p, 1))} style={styles.iconBtn}>
            <ChevronRight size={16} color={colors.primary} />
          </Pressable>
        </Card>
      ) : null}

      {loading ? (
        <Card style={styles.stateCard}>
          <ActivityIndicator size="small" color={colors.primary} />
        </Card>
      ) : error ? (
        <Card style={styles.stateCard}>
          <PopupError error={error} />
          <Pressable onPress={() => void load()} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Thử lại</Text>
          </Pressable>
        </Card>
      ) : section === 'mine' || !canViewAll ? (
        // ================= MY PAYSLIPS =================
        !myPayslips.length ? (
          <View style={styles.stateCard}>
            <IgenHrEmptyState message="Chưa có phiếu lương nào được phát hành cho bạn." />
          </View>
        ) : (
          <View style={styles.list}>
            {myPayslips.map((slip, idx) => (
              <Card
                key={slip._id || slip.id || slip.runId || idx}
                onPress={() => setSelectedSlip(slip)}
                style={styles.card}
              >
                <View style={styles.headRow}>
                  <Text style={styles.rowTitle}>Kỳ lương {slip.periodKey || period}</Text>
                  <Text style={styles.moneyVal}>{formatVnd(slip.netSalary ?? slip.grossSalary)}</Text>
                </View>
                <Text style={styles.subMeta}>
                  Thu nhập: {formatCompactMoney(slip.grossSalary)} · Khấu trừ:{' '}
                  {formatCompactMoney(slip.totalDeductions ?? slip.deductions ?? 0)}
                </Text>
                <Text style={[styles.subMeta, { color: colors.primary }]}>Chạm để xem chi tiết phiếu lương ›</Text>
              </Card>
            ))}
          </View>
        )
      ) : section === 'policies' ? (
        // ================= POLICIES =================
        !policies.length ? (
          <View style={styles.stateCard}>
            <IgenHrEmptyState message="Chưa có chính sách lương nào." />
          </View>
        ) : (
          <View style={styles.list}>
            {policies.map((pol) => (
              <Card key={pol._id} onPress={() => setSelectedPolicy(pol)} style={styles.card}>
                <View style={styles.headRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{pol.name}</Text>
                    <Text style={styles.subMeta}>{pol.code}</Text>
                  </View>
                  <Text
                    style={[
                      styles.badge,
                      pol.status === 'active' && styles.badgeGreen,
                      pol.status === 'retired' && styles.badgeGray,
                    ]}
                  >
                    {pol.status === 'active'
                      ? 'Đang áp dụng'
                      : pol.status === 'retired'
                        ? 'Ngừng dùng'
                        : 'Bản nháp'}
                  </Text>
                </View>
                {pol.effectiveFrom ? (
                  <Text style={styles.subMeta}>
                    Hiệu lực: {pol.effectiveFrom.slice(0, 10)}
                    {pol.effectiveTo ? ` → ${pol.effectiveTo.slice(0, 10)}` : ''}
                  </Text>
                ) : null}
              </Card>
            ))}
          </View>
        )
      ) : section === 'adjustments' ? (
        // ================= ADJUSTMENTS =================
        <>
          {!adjustments.length ? (
            <View style={styles.stateCard}>
              <IgenHrEmptyState message={`Chưa có khoản thưởng / phụ cấp / khấu trừ nào kỳ ${period}.`} />
            </View>
          ) : (
            <View style={styles.list}>
              {adjustments.map((adj) => {
                const kindLabel = ADJ_KINDS.find((k) => k.value === adj.kind)?.label || adj.kind;
                const isPending = adj.status === 'pending';
                return (
                  <Card key={adj._id} onPress={() => setSelectedAdj(adj)} style={styles.card}>
                    <View style={styles.headRow}>
                      <Text style={styles.rowTitle}>{adj.employeeName || 'Nhân viên'}</Text>
                      <Text style={styles.moneyVal}>{formatVnd(adj.amount)}</Text>
                    </View>
                    <View style={styles.headRow}>
                      <Text style={styles.badge}>{kindLabel}</Text>
                      <Text
                        style={[
                          styles.badge,
                          adj.status === 'approved' && styles.badgeGreen,
                          adj.status === 'rejected' && styles.badgeRed,
                        ]}
                      >
                        {adj.status === 'approved'
                          ? 'Đã duyệt'
                          : adj.status === 'rejected'
                            ? 'Từ chối'
                            : 'Chờ duyệt'}
                      </Text>
                    </View>
                    {adj.reason ? <Text style={styles.muted}>{adj.reason}</Text> : null}
                    {canManage && isPending ? (
                      <View style={styles.decideRow}>
                        <Pressable
                          disabled={actionLoading}
                          onPress={() =>
                            void runAction(
                              () => approvePayrollAdjustment(period, adj._id, branchId),
                              'Đã phê duyệt điều chỉnh lương.',
                            )
                          }
                          style={styles.approveBtn}
                        >
                          <Check size={13} color={colors.white} />
                          <Text style={styles.decideText}>Duyệt</Text>
                        </Pressable>
                        <Pressable
                          disabled={actionLoading}
                          onPress={() =>
                            void runAction(
                              () => rejectPayrollAdjustment(period, adj._id, branchId),
                              'Đã từ chối điều chỉnh lương.',
                            )
                          }
                          style={styles.rejectBtn}
                        >
                          <XCircle size={13} color={colors.white} />
                          <Text style={styles.decideText}>Từ chối</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </Card>
                );
              })}
            </View>
          )}
        </>
      ) : (
        // ================= OVERVIEW (PERIOD RUN & RESULTS) =================
        <>
          {/* 4-step Payroll Pipeline */}
          <View style={styles.stepsRow}>
            {STEPS.map((st, idx) => {
              const reached = stepIndex >= idx;
              const current = stepIndex === idx;
              return (
                <View
                  key={st.key}
                  style={[
                    styles.stepPill,
                    reached && styles.stepPillDone,
                    current && styles.stepPillCurrent,
                  ]}
                >
                  <Text
                    style={[
                      styles.stepText,
                      reached && styles.stepTextDone,
                      current && styles.stepTextCurrent,
                    ]}
                  >
                    {idx + 1}. {st.label}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Summary KPI Grid */}
          {run?.effectiveError ? (
            <PopupError error={`Không thể xác thực số liệu bảng lương. Dữ liệu bị ẩn để tránh hiển thị sai. (${run.effectiveError.code || 'PAYROLL_EFFECTIVE_UNAVAILABLE'})`} />
          ) : <View style={styles.kpiGrid}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Nhân sự</Text>
              <Text style={styles.kpiVal}>{totals.count}</Text>
            </View>
            {run ? <>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Tổng thu nhập</Text>
                <Text style={styles.kpiVal}>{formatCompactMoney(totals.gross)}</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Khấu trừ</Text>
                <Text style={[styles.kpiVal, { color: '#B91C1C' }]}>{formatCompactMoney(totals.ded)}</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Thực lĩnh</Text>
                <Text style={[styles.kpiVal, { color: '#16885A' }]}>{formatCompactMoney(totals.net)}</Text>
              </View>
            </> : <>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Tổng lương cơ bản</Text>
                <Text style={styles.kpiVal}>{formatCompactMoney(totals.base)}</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Tổng ngày công</Text>
                <Text style={styles.kpiVal}>{totals.workedDays.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Nhân sự thiếu công</Text>
                <Text style={[styles.kpiVal, { color: '#B91C1C' }]}>{totals.shortageEmployees}</Text>
              </View>
            </>}
          </View>}

          {/* Manager workflow actions */}
          {canManage ? (
            <View style={styles.actionWrap}>
              {!run || run.status === 'draft' ? (
                <Pressable
                  disabled={actionLoading}
                  onPress={() =>
                    void runAction(
                      () => run?.activeRevisionId
                        ? calculatePayrollRun(run._id, run.version, branchId)
                        : processPayrollPeriod(period, branchId),
                      `Đã tính bảng lương kỳ ${period}.`,
                    )
                  }
                  style={[styles.primaryBtn, actionLoading && styles.disabled]}
                >
                  <Play size={12} color={colors.white} />
                  <Text style={styles.primaryBtnText}>Tính / Xử lý lương</Text>
                </Pressable>
              ) : null}

              {run?.status === 'draft' ? (
                <Pressable
                  disabled={actionLoading}
                  onPress={() =>
                    void runAction(
                      () => run.activeRevisionId
                        ? reviewPayrollRun(run._id, run.version, branchId)
                        : reviewPayrollPeriod(period, branchId),
                      'Đã chuyển bảng lương sang bước Kiểm tra.',
                    )
                  }
                  style={[styles.outlineBtn, actionLoading && styles.disabled]}
                >
                  <Text style={styles.outlineBtnText}>Chuyển Kiểm tra</Text>
                </Pressable>
              ) : null}

              {run?.status === 'review' ? (
                <Pressable
                  disabled={actionLoading || !effectiveDataAvailable}
                  onPress={() =>
                    void runAction(
                      () => run.activeRevisionId
                        ? closePayrollRun(run._id, run.version, branchId)
                        : closePayrollPeriod(period, branchId),
                      'Đã chốt bảng lương kỳ này.',
                    )
                  }
                  style={[styles.primaryBtn, { backgroundColor: '#0F766E' }, (actionLoading || !effectiveDataAvailable) && styles.disabled]}
                >
                  <Lock size={12} color={colors.white} />
                  <Text style={styles.primaryBtnText}>Chốt bảng lương</Text>
                </Pressable>
              ) : null}

              {run?.status === 'closed' ? (
                <>
                  {canPublishPayslips && effectiveDataAvailable ? <Pressable
                    disabled={actionLoading}
                    onPress={() =>
                      void runAction(
                        () => publishPayrollPayslips(run._id, branchId),
                        'Đã phát hành phiếu lương cho nhân viên.',
                      )
                    }
                    style={[styles.outlineBtn, actionLoading && styles.disabled]}
                  >
                    <Send size={12} color={colors.primary} />
                    <Text style={styles.outlineBtnText}>Phát hành phiếu</Text>
                  </Pressable> : null}
                  {canMarkPaid ? <Pressable
                    disabled={actionLoading}
                    onPress={() =>
                      void runAction(
                        () => markPayrollRunPaid(run._id, run.version, branchId),
                        'Đã đánh dấu trả lương hoàn tất.',
                      )
                    }
                    style={[styles.primaryBtn, { backgroundColor: '#16885A' }, actionLoading && styles.disabled]}
                  >
                    <Check size={12} color={colors.white} />
                    <Text style={styles.primaryBtnText}>Đánh dấu đã trả</Text>
                  </Pressable> : null}
                  <Pressable
                    onPress={() => {
                      setReopenReason('');
                      setReopenOpen(true);
                    }}
                    style={styles.outlineBtn}
                  >
                    <Text style={[styles.outlineBtnText, { color: '#B45309' }]}>Mở lại kỳ</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          ) : null}

          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Tìm nhân viên trong bảng lương..."
            placeholderTextColor="#94A3B8"
            style={[styles.searchField, { marginBottom: 12 }]}
          />

          {run?.effectiveError ? null : !filteredResults.length ? (
            <View style={styles.stateCard}>
              <IgenHrEmptyState
                message={`Chưa có kết quả bảng lương kỳ ${period}.${!run && canManage ? ' Bấm "Tính / Xử lý lương" để khởi tạo.' : run?.status === 'draft' && canManage ? ' Bấm "Tính / Xử lý lương" để cập nhật kỳ nháp.' : ''}`}
              />
            </View>
          ) : (
            <View style={styles.list}>
              {filteredResults.map((row, idx) => {
                const kpi = row.employeeId ? kpiByEmp[row.employeeId] : undefined;
                return (
                  <Card
                    key={row._id || row.id || row.employeeId || idx}
                    onPress={() => setSelectedSlip(row)}
                    style={styles.card}
                  >
                    <View style={styles.headRow}>
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={styles.rowTitle}>
                          {row.employeeName || 'Nhân viên'}
                        </Text>
                        <Text style={styles.subMeta}>
                          {row.department || '—'}
                          {row.actualWorkDays != null ? ` · Công: ${row.actualWorkDays}` : ''}
                          {typeof kpi === 'number' ? ` · KPI: ${kpi.toFixed(1)}%` : ''}
                        </Text>
                      </View>
                      <Text style={styles.moneyVal}>
                        {run
                          ? formatVnd(row.netSalary ?? row.grossSalary)
                          : formatVnd(row.monthlySalary ?? row.baseSalary)}
                      </Text>
                    </View>
                    <Text style={styles.subMeta}>
                      {run
                        ? `Tổng thu nhập: ${formatCompactMoney(row.grossSalary)} · Khấu trừ: ${formatCompactMoney(row.totalDeductions ?? row.deductions ?? 0)}`
                        : `Lương cơ bản: ${formatCompactMoney(row.monthlySalary ?? row.baseSalary)} · Công: ${row.workedDays ?? row.actualWorkDays ?? 0} · Thiếu công: ${row.shortageDays ?? 0}`}
                    </Text>
                  </Card>
                );
              })}
            </View>
          )}
        </>
      )}

      {/* Payslip Detail Full-Screen Page */}
      <FullScreenFormModal
        visible={Boolean(selectedSlip)}
        title="Chi tiết phiếu lương"
        onClose={() => setSelectedSlip(null)}
      >
        {selectedSlip ? (
          <View style={{ gap: 8, paddingBottom: 12 }}>
            <View style={styles.infoRow}>
              <Text style={styles.muted}>Nhân viên</Text>
              <Text style={styles.infoVal}>{selectedSlip.employeeName || 'Tôi'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.muted}>Kỳ lương</Text>
              <Text style={styles.infoVal}>{selectedSlip.periodKey || period}</Text>
            </View>
            {selectedSlip.actualWorkDays != null ? (
              <View style={styles.infoRow}>
                <Text style={styles.muted}>Ngày công thực tế</Text>
                <Text style={styles.infoVal}>
                  {selectedSlip.actualWorkDays}
                  {selectedSlip.standardWorkDays ? ` / ${selectedSlip.standardWorkDays}` : ''}
                </Text>
              </View>
            ) : null}
            {selectedSlip.baseSalary != null ? (
              <View style={styles.infoRow}>
                <Text style={styles.muted}>Lương cơ bản</Text>
                <Text style={styles.infoVal}>{formatVnd(selectedSlip.baseSalary)}</Text>
              </View>
            ) : null}
            {selectedSlip.allowances ? (
              <View style={styles.infoRow}>
                <Text style={styles.muted}>Phụ cấp</Text>
                <Text style={styles.infoVal}>{formatVnd(selectedSlip.allowances)}</Text>
              </View>
            ) : null}
            {selectedSlip.bonus ? (
              <View style={styles.infoRow}>
                <Text style={styles.muted}>Thưởng</Text>
                <Text style={styles.infoVal}>{formatVnd(selectedSlip.bonus)}</Text>
              </View>
            ) : null}
            <View style={styles.infoRow}>
              <Text style={styles.muted}>Tổng thu nhập (Gross)</Text>
              <Text style={styles.infoVal}>{formatVnd(selectedSlip.grossSalary)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.muted}>Tổng khấu trừ</Text>
              <Text style={[styles.infoVal, { color: '#B91C1C' }]}>
                -{formatVnd(selectedSlip.totalDeductions ?? selectedSlip.deductions ?? 0)}
              </Text>
            </View>
            <View style={[styles.infoRow, { borderBottomWidth: 0, paddingTop: 4 }]}>
              <Text style={[styles.rowTitle, { color: '#16885A' }]}>Thực lĩnh (Net)</Text>
              <Text style={[styles.rowTitle, { color: '#16885A', fontSize: 15 }]}>
                {formatVnd(selectedSlip.netSalary ?? selectedSlip.grossSalary)}
              </Text>
            </View>

            {selectedSlip.runId && section === 'mine' ? (
              <View style={styles.reviewBox}>
                <Text style={styles.label}>Gửi thắc mắc / yêu cầu đối soát</Text>
                <TextInput
                  value={reviewMsg}
                  onChangeText={setReviewMsg}
                  multiline
                  placeholder="Nhập nội dung cần kiểm tra lại..."
                  placeholderTextColor={colors.muted}
                  style={[styles.field, { minHeight: 60, textAlignVertical: 'top' }]}
                />
                <Pressable
                  disabled={sendingReview}
                  onPress={() => void onSendReviewRequest()}
                  style={[styles.submitBtn, sendingReview && styles.disabled]}
                >
                  <Text style={styles.submitBtnText}>
                    {sendingReview ? 'Đang gửi...' : 'Gửi yêu cầu đối soát'}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}
      </FullScreenFormModal>

      {/* Create Adjustment Full-Screen Page */}
      <FullScreenFormModal
        visible={adjOpen}
        title="Thêm điều chỉnh lương"
        cancelLabel="Hủy"
        onSave={() => void onCreateAdjustment()}
        saving={actionLoading}
        onClose={() => setAdjOpen(false)}
      >
        <View>
          <HrFormSectionTitle title="Thông tin điều chỉnh" />
          <HrFormSelectRow
            label="Nhân viên *"
            sheetTitle="Chọn nhân viên"
            value={adjEmpId}
            placeholder="Chọn nhân viên"
            options={employees.map((emp) => ({
              value: emp.uid || emp._id || emp.id || '',
              label: emp.displayName,
              subtitle: [emp.jobTitle || emp.position, emp.department].filter(Boolean).join(' · ') || undefined,
            }))}
            onSelect={setAdjEmpId}
          />
          <HrFormSelectRow
            label="Loại điều chỉnh"
            sheetTitle="Chọn loại điều chỉnh"
            value={adjKind}
            options={ADJ_KINDS.map((k) => ({ value: k.value, label: k.label }))}
            onSelect={(val) => setAdjKind(val as typeof adjKind)}
          />
          <HrFormInputRow
            label="Số tiền (VNĐ) *"
            value={adjAmount}
            onChangeText={setAdjAmount}
            keyboardType="numeric"
            placeholder="VD: 500000"
          />
          <HrFormInputRow
            label="Lý do *"
            value={adjReason}
            onChangeText={setAdjReason}
            placeholder="VD: Thưởng hoàn thành dự án..."
            last
          />
        </View>
      </FullScreenFormModal>

      {/* Reopen Run Full-Screen Page */}
      <FullScreenFormModal
        visible={reopenOpen}
        title={`Mở lại kỳ lương ${period}`}
        cancelLabel="Hủy"
        onSave={() => {
          if (!run || !reopenReason.trim()) return;
          void runAction(async () => {
            await reopenPayrollRun(run._id, run.version, reopenReason.trim(), branchId);
            setReopenOpen(false);
          }, 'Đã mở lại kỳ lương.');
        }}
        saveLabel="Xác nhận"
        saving={actionLoading}
        onClose={() => setReopenOpen(false)}
      >
        <View>
          <HrFormSectionTitle title="Thông tin mở lại kỳ lương" />
          <HrFormInputRow
            label="Lý do mở lại *"
            value={reopenReason}
            onChangeText={setReopenReason}
            multiline
            placeholder="Nhập lý do mở lại bảng lương..."
            last
          />
        </View>
      </FullScreenFormModal>

      {/* Adjustment Detail Full-Screen Page */}
      <FullScreenFormModal
        visible={Boolean(selectedAdj)}
        title="Chi tiết điều chỉnh lương"
        onClose={() => setSelectedAdj(null)}
      >
        {selectedAdj ? (
          <View style={{ gap: 8, paddingBottom: 12 }}>
            <View style={styles.infoRow}>
              <Text style={styles.muted}>Nhân viên</Text>
              <Text style={styles.infoVal}>{selectedAdj.employeeName || 'Nhân viên'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.muted}>Loại điều chỉnh</Text>
              <Text style={styles.infoVal}>
                {ADJ_KINDS.find((k) => k.value === selectedAdj.kind)?.label || selectedAdj.kind}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.muted}>Số tiền</Text>
              <Text style={[styles.infoVal, { color: '#16885A' }]}>{formatVnd(selectedAdj.amount)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.muted}>Trạng thái</Text>
              <Text style={styles.infoVal}>
                {selectedAdj.status === 'approved'
                  ? 'Đã duyệt'
                  : selectedAdj.status === 'rejected'
                    ? 'Từ chối'
                    : 'Chờ duyệt'}
              </Text>
            </View>
            {selectedAdj.reason ? (
              <>
                <Text style={styles.label}>Lý do</Text>
                <Text style={styles.muted}>{selectedAdj.reason}</Text>
              </>
            ) : null}
            {canManage && selectedAdj.status === 'pending' ? (
              <View style={styles.decideRow}>
                <Pressable
                  onPress={() => {
                    const id = selectedAdj._id;
                    setSelectedAdj(null);
                    void runAction(
                      () => approvePayrollAdjustment(period, id, branchId),
                      'Đã phê duyệt điều chỉnh lương.',
                    );
                  }}
                  style={styles.approveBtn}
                >
                  <Check size={13} color={colors.white} />
                  <Text style={styles.decideText}>Duyệt</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    const id = selectedAdj._id;
                    setSelectedAdj(null);
                    void runAction(
                      () => rejectPayrollAdjustment(period, id, branchId),
                      'Đã từ chối điều chỉnh lương.',
                    );
                  }}
                  style={styles.rejectBtn}
                >
                  <XCircle size={13} color={colors.white} />
                  <Text style={styles.decideText}>Từ chối</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}
      </FullScreenFormModal>

      {/* Policy Detail Full-Screen Page */}
      <FullScreenFormModal
        visible={Boolean(selectedPolicy)}
        title="Chi tiết chính sách lương"
        onClose={() => setSelectedPolicy(null)}
      >
        {selectedPolicy ? (
          <View style={{ gap: 8, paddingBottom: 12 }}>
            <View style={styles.infoRow}>
              <Text style={styles.muted}>Mã chính sách</Text>
              <Text style={styles.infoVal}>{selectedPolicy.code}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.muted}>Tên chính sách</Text>
              <Text style={styles.infoVal}>{selectedPolicy.name}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.muted}>Trạng thái</Text>
              <Text style={styles.infoVal}>
                {selectedPolicy.status === 'active'
                  ? 'Đang áp dụng'
                  : selectedPolicy.status === 'retired'
                    ? 'Ngừng dùng'
                    : 'Bản nháp'}
              </Text>
            </View>
            {selectedPolicy.effectiveFrom ? (
              <View style={styles.infoRow}>
                <Text style={styles.muted}>Hiệu lực</Text>
                <Text style={styles.infoVal}>
                  {selectedPolicy.effectiveFrom.slice(0, 10)}
                  {selectedPolicy.effectiveTo ? ` → ${selectedPolicy.effectiveTo.slice(0, 10)}` : ''}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </FullScreenFormModal>
    </ScrollView>
    {canManage && section === 'adjustments' ? (
      <HrFab
        label="Thêm điều chỉnh lương"
        onPress={() => {
          setAdjEmpId(employees[0]?.uid || employees[0]?._id || '');
          setAdjOpen(true);
        }}
      />
    ) : null}
    </View>
  );
}

const HAIRLINE_CARD = {
  backgroundColor: colors.white,
  borderRadius: 10,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: '#E5EAF2',
  shadowOpacity: 0,
  shadowRadius: 0,
  shadowOffset: { width: 0, height: 0 },
  elevation: 0,
} as const;

const styles = StyleSheet.create({
  content: { paddingHorizontal: 14, paddingBottom: 28, backgroundColor: colors.white },
  subTabPill: { backgroundColor: colors.white, borderColor: '#E5EAF2', borderWidth: StyleSheet.hairlineWidth, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 7 },
  subTabPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  subTabText: { color: '#6B7280', fontSize: 12, fontWeight: '500' },
  subTabTextActive: { color: colors.white, fontWeight: '600' },

  dateBar: { ...HAIRLINE_CARD, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 8, marginBottom: 10 },
  dateBarText: { color: '#111827', fontSize: 13.5, fontWeight: '600' },
  iconBtn: { width: 32, height: 32, borderRadius: 9, backgroundColor: '#F5F8FD', alignItems: 'center', justifyContent: 'center' },

  stepsRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  stepPill: { flex: 1, backgroundColor: '#F1F5F9', borderRadius: 8, paddingVertical: 6.5, alignItems: 'center' },
  stepPillDone: { backgroundColor: '#E9F8F1' },
  stepPillCurrent: { backgroundColor: '#EAF2FF', borderColor: colors.primary, borderWidth: StyleSheet.hairlineWidth },
  stepText: { color: '#6B7280', fontSize: 10, fontWeight: '500' },
  stepTextDone: { color: '#16885A', fontWeight: '600' },
  stepTextCurrent: { color: colors.primary, fontWeight: '600' },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 9, marginBottom: 12 },
  kpiCard: { ...HAIRLINE_CARD, width: '48.5%', padding: 12 },
  kpiLabel: { color: colors.muted, fontSize: 10.5, fontWeight: '400' },
  kpiVal: { color: '#111827', fontSize: 16, fontWeight: '600', marginTop: 3 },

  actionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 10 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: colors.primary, minHeight: 38, paddingHorizontal: 12, borderRadius: 10 },
  primaryBtnText: { color: colors.white, fontSize: 12, fontWeight: '600' },
  outlineBtn: { ...HAIRLINE_CARD, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: 38, paddingHorizontal: 12 },
  outlineBtnText: { color: colors.primary, fontSize: 12, fontWeight: '600' },

  searchField: { backgroundColor: '#F6F8FC', borderColor: '#DCE5F2', borderWidth: 1, borderRadius: 99, paddingHorizontal: 14, height: 40, fontSize: 13.5, color: '#111827' },
  stateCard: { ...HAIRLINE_CARD, padding: 22, alignItems: 'center', gap: 10 },
  errorText: { color: '#B91C1C', fontSize: 12.5, textAlign: 'center' },
  list: {
    marginHorizontal: -14,
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#EEF2F7',
    gap: 0,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 0,
    borderWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEF2F7',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowTitle: { color: '#111827', fontSize: 14, fontWeight: '600' },
  muted: { color: '#6B7280', fontSize: 12.5, fontWeight: '400', lineHeight: 18 },
  subMeta: { color: '#6B7280', fontSize: 11.5, fontWeight: '400' },
  moneyVal: { color: '#16885A', fontSize: 14, fontWeight: '600' },
  badge: { color: colors.primary, backgroundColor: '#EAF2FF', fontSize: 10.5, fontWeight: '500', paddingHorizontal: 8, paddingVertical: 3.5, borderRadius: 8, overflow: 'hidden' },
  badgeGreen: { color: '#16885A', backgroundColor: '#E9F8F1' },
  badgeRed: { color: '#B91C1C', backgroundColor: '#FEE2E2' },
  badgeGray: { color: '#64748B', backgroundColor: '#F1F5F9' },

  decideRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  approveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#16885A', minHeight: 38, borderRadius: 9 },
  rejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#B91C1C', minHeight: 38, borderRadius: 9 },
  decideText: { color: colors.white, fontSize: 12, fontWeight: '600' },

  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.35)', justifyContent: 'center', padding: 16 },
  sheet: { backgroundColor: colors.white, borderRadius: 20, overflow: 'hidden', padding: 18, gap: 8, maxHeight: '88%' },
  sheetTitle: { color: '#111827', fontSize: 16, fontWeight: '600' },
  closeText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EEF2F7' },
  infoVal: { color: '#111827', fontSize: 13.5, fontWeight: '500', textAlign: 'right' },
  reviewBox: { marginTop: 8, backgroundColor: '#F5F9FF', borderColor: '#DCE7F7', borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12, gap: 6 },
  label: { color: '#374151', fontSize: 12.5, fontWeight: '500', marginTop: 4 },
  field: { backgroundColor: '#F6F8FC', borderColor: '#DCE5F2', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13.5, color: '#111827' },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: colors.white, borderColor: '#E5EAF2', borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: '#6B7280', fontSize: 11.5, fontWeight: '500' },
  chipTextActive: { color: colors.white, fontWeight: '600' },
  submitBtn: { backgroundColor: colors.primary, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  submitBtnText: { color: colors.white, fontSize: 13.5, fontWeight: '600' },
  disabled: { opacity: 0.45 },
});

