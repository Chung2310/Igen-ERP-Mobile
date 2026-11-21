import { View } from 'react-native';
import { SectionHeading } from '@/components/SectionHeading';
import {
  BreakdownBars,
  CHART_COLORS,
  KpiGrid,
  ListPanel,
  VerticalBarChart,
  type BarDatum,
  type KpiItem,
  type ListRowItem,
} from '@/features/overview/OverviewWidgets';
import {
  computePercentDelta,
  formatCompactMoney,
  formatDeltaBadge,
  formatShortDate,
} from '@/features/overview/overviewPeriod';
import type { FinanceOverviewReport, OverviewDateRange } from '@/features/overview/types';

const EXPENSE_LABELS: Record<string, string> = {
  rent: 'Thuê mặt bằng',
  salary: 'Lương nhân sự',
  marketing: 'Marketing',
  utilities: 'Điện nước',
  repair: 'Sửa chữa',
  depreciation: 'Khấu hao',
  other_expense: 'Chi khác',
};

function buildFinanceBars(report: FinanceOverviewReport, maxBars = 6): BarDatum[] {
  const trends = report.trends ?? [];
  if (!trends.length) return [];
  const chunkSize = Math.max(1, Math.ceil(trends.length / maxBars));
  const bars: BarDatum[] = [];
  for (let i = 0; i < trends.length; i += chunkSize) {
    const slice = trends.slice(i, i + chunkSize);
    bars.push({
      label: formatShortDate(slice[0].date),
      primary: slice.reduce((sum, row) => sum + (row.revenue || 0), 0),
      secondary: slice.reduce((sum, row) => sum + (row.expense || 0) + (row.cost || 0), 0),
    });
  }
  return bars;
}

export function FinanceOverviewView({
  report,
  previousReport,
  range,
}: {
  report: FinanceOverviewReport;
  previousReport: FinanceOverviewReport | null;
  range: OverviewDateRange;
}) {
  const s = report.summary ?? {};
  const p = previousReport?.summary ?? {};
  const netCash = s.cashIn != null && s.cashOut != null ? s.cashIn - s.cashOut : null;
  const prevNetCash = p.cashIn != null && p.cashOut != null ? p.cashIn - p.cashOut : null;

  const kpis: KpiItem[] = [
    {
      id: 'fin-revenue',
      label: 'Doanh thu hàng hóa',
      value: formatCompactMoney(s.revenue),
      delta: formatDeltaBadge(computePercentDelta(s.revenue, p.revenue)),
      accent: '#2463EB',
      tone: '#EAF2FF',
    },
    {
      id: 'fin-gross',
      label: 'Lãi gộp',
      value: formatCompactMoney(s.grossProfit),
      delta: formatDeltaBadge(computePercentDelta(s.grossProfit, p.grossProfit)),
      accent: '#16885A',
      tone: '#E9F8F1',
    },
    {
      id: 'fin-net',
      label: 'Lãi ròng quản trị',
      value: formatCompactMoney(s.netProfit),
      delta: formatDeltaBadge(computePercentDelta(s.netProfit, p.netProfit)),
      accent: '#0E7490',
      tone: '#E8F7FA',
    },
    {
      id: 'fin-cash',
      label: 'Dòng tiền ròng',
      value: formatCompactMoney(netCash),
      delta: formatDeltaBadge(computePercentDelta(netCash, prevNetCash)),
      helper: `Thu ${formatCompactMoney(s.cashIn)} · Chi ${formatCompactMoney(s.cashOut)}`,
      accent: '#C27617',
      tone: '#FFF3E5',
    },
    {
      id: 'fin-cost',
      label: 'Giá vốn',
      value: formatCompactMoney(s.cost),
      delta: formatDeltaBadge(computePercentDelta(s.cost, p.cost)),
      accent: '#64748B',
      tone: '#F1F5F9',
    },
    {
      id: 'fin-overdue',
      label: 'Phải thu quá hạn',
      value: formatCompactMoney(s.overdue),
      delta: (s.overdue ?? 0) > 0 ? 'Cần thu hồi' : 'Ổn định',
      accent: '#DC2626',
      tone: '#FEE2E2',
    },
  ];

  // Cơ cấu chi phí
  const expenseMap = new Map<string, number>();
  for (const row of report.expenses ?? []) {
    const name = EXPENSE_LABELS[row.category ?? ''] || row.category || 'Khác';
    expenseMap.set(name, (expenseMap.get(name) ?? 0) + (row.amount || 0));
  }
  const expenseRows = [...expenseMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, value], idx) => ({
      label,
      value,
      displayValue: formatCompactMoney(value),
      color: CHART_COLORS[idx % CHART_COLORS.length],
    }));

  // Công nợ đến hạn / quá hạn trong 7 ngày
  const receivables = (report.debts?.receivables ?? []).map((d) => ({
    party: d.customerName || 'Khách hàng',
    type: 'Phải thu',
    balance: d.balance,
    daysUntil: d.daysUntil,
  }));
  const payables = (report.debts?.payables ?? []).map((d) => ({
    party: d.supplierName || 'Nhà cung cấp',
    type: 'Phải trả',
    balance: d.balance,
    daysUntil: d.daysUntil,
  }));
  const urgentDebts: ListRowItem[] = [...receivables, ...payables]
    .filter((d) => d.balance > 0 && d.daysUntil <= 7)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 5)
    .map((d, idx) => ({
      id: `${d.type}-${d.party}-${idx}`,
      title: d.party,
      subtitle: `${d.type} · ${d.daysUntil < 0 ? `Quá hạn ${Math.abs(d.daysUntil)} ngày` : d.daysUntil === 0 ? 'Đến hạn hôm nay' : `Còn ${d.daysUntil} ngày`}`,
      badge: formatCompactMoney(d.balance),
      badgeColor: d.daysUntil < 0 ? '#B91C1C' : '#C27617',
      badgeTone: d.daysUntil < 0 ? '#FEE2E2' : '#FFF3E5',
      dotColor: d.daysUntil < 0 ? '#DC2626' : '#C27617',
    }));

  const vatRows = report.vat
    ? [
        {
          label: 'VAT đầu ra',
          value: report.vat.output || 0,
          displayValue: formatCompactMoney(report.vat.output),
          color: CHART_COLORS[0],
        },
        {
          label: 'VAT đầu vào',
          value: report.vat.input || 0,
          displayValue: formatCompactMoney(report.vat.input),
          color: CHART_COLORS[1],
        },
      ]
    : [];

  return (
    <View>
      <SectionHeading title="Tình hình tài chính" action={range.label} />
      <KpiGrid items={kpis} />

      <SectionHeading title="Doanh thu & chi phí" action={range.label} />
      <VerticalBarChart
        data={buildFinanceBars(report)}
        primaryLabel="Doanh thu"
        secondaryLabel="Giá vốn & chi phí"
      />

      <SectionHeading title="Cơ cấu chi phí" />
      <BreakdownBars rows={expenseRows} emptyText="Chưa ghi nhận chi phí trong kỳ này." />

      {vatRows.some((r) => r.value > 0) ? (
        <>
          <SectionHeading title="Thuế VAT trong kỳ" />
          <BreakdownBars rows={vatRows} />
        </>
      ) : null}

      <SectionHeading title="Công nợ cần chú ý (≤ 7 ngày)" />
      <ListPanel items={urgentDebts} emptyText="Không có công nợ sắp đến hạn hoặc quá hạn." />
    </View>
  );
}

