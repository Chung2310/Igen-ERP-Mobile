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
  formatCompactMoney,
  formatInt,
  formatShortDate,
} from '@/features/overview/overviewPeriod';
import type { OverviewDateRange, RetailOverviewReport } from '@/features/overview/types';

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Tiền mặt',
  transfer: 'Chuyển khoản',
  card: 'Thẻ',
  qr: 'QR Pay',
  debt: 'Công nợ',
  other: 'Khác',
};

function buildRetailBars(report: RetailOverviewReport, maxBars = 6): BarDatum[] {
  const rows = report.timeSeries ?? [];
  if (!rows.length) return [];
  const chunkSize = Math.max(1, Math.ceil(rows.length / maxBars));
  const bars: BarDatum[] = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    const slice = rows.slice(i, i + chunkSize);
    bars.push({
      label: formatShortDate(slice[0].businessDate),
      primary: slice.reduce((sum, r) => sum + (r.netSales || 0), 0),
      secondary: slice.reduce((sum, r) => sum + (r.collectedAmount || 0), 0),
    });
  }
  return bars;
}

export function RetailOverviewView({
  report,
  range,
}: {
  report: RetailOverviewReport;
  range: OverviewDateRange;
}) {
  const s = report.summary;

  const kpis: KpiItem[] = [
    {
      id: 'ret-net',
      label: 'Doanh số thuần',
      value: formatCompactMoney(s.netSales),
      helper: `Gộp: ${formatCompactMoney(s.grossSales)}`,
      accent: '#2463EB',
      tone: '#EAF2FF',
    },
    {
      id: 'ret-orders',
      label: 'Đơn hàng',
      value: formatInt(s.orderCount),
      helper: `TB/đơn: ${formatCompactMoney(s.averageOrderValue)}`,
      accent: '#16885A',
      tone: '#E9F8F1',
    },
    {
      id: 'ret-collected',
      label: 'Thực thu',
      value: formatCompactMoney(s.collectedAmount),
      helper: s.dueAmount > 0 ? `Còn nợ: ${formatCompactMoney(s.dueAmount)}` : 'Thu đủ',
      accent: '#0E7490',
      tone: '#E8F7FA',
    },
    {
      id: 'ret-refunds',
      label: 'Hoàn trả',
      value: formatCompactMoney(s.refunds),
      delta: s.grossProfit != null ? `Lãi gộp ${formatCompactMoney(s.grossProfit)}` : undefined,
      accent: '#C27617',
      tone: '#FFF3E5',
    },
  ];

  const paymentRows = (report.paymentMix ?? [])
    .filter((p) => p.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .map((p, idx) => ({
      label: PAYMENT_LABELS[p.method] || p.method,
      value: p.amount,
      displayValue: formatCompactMoney(p.amount),
      color: CHART_COLORS[idx % CHART_COLORS.length],
    }));

  const cashierItems: ListRowItem[] = (report.cashiers ?? [])
    .slice()
    .sort((a, b) => b.netSales - a.netSales)
    .slice(0, 5)
    .map((c, idx) => ({
      id: c.cashierId || `cashier-${idx}`,
      title: c.cashierName || 'Thu ngân',
      subtitle: `${formatInt(c.orderCount)} đơn hàng`,
      badge: formatCompactMoney(c.netSales),
      badgeColor: '#2463EB',
      badgeTone: '#EAF2FF',
      dotColor: CHART_COLORS[idx % CHART_COLORS.length],
    }));

  const topProducts = (report.products ?? [])
    .filter((p) => p.netSales > 0)
    .sort((a, b) => b.netSales - a.netSales)
    .slice(0, 5)
    .map((p, idx) => ({
      label: p.productName,
      value: p.netSales,
      displayValue: formatCompactMoney(p.netSales),
      color: CHART_COLORS[idx % CHART_COLORS.length],
    }));

  return (
    <View>
      <SectionHeading title="Tổng quan bán lẻ & POS" action={range.label} />
      <KpiGrid items={kpis} />

      <SectionHeading title="Doanh số & thực thu theo kỳ" action={range.label} />
      <VerticalBarChart
        data={buildRetailBars(report)}
        primaryLabel="Doanh số thuần"
        secondaryLabel="Thực thu"
        primaryColor="#2463EB"
        secondaryColor="#16885A"
      />

      <SectionHeading title="Phương thức thanh toán" />
      <BreakdownBars rows={paymentRows} emptyText="Chưa có giao dịch thanh toán trong kỳ." />

      {topProducts.length > 0 ? (
        <>
          <SectionHeading title="Sản phẩm bán chạy" action="Top 5" />
          <BreakdownBars rows={topProducts} />
        </>
      ) : null}

      <SectionHeading title="Hiệu suất thu ngân" />
      <ListPanel items={cashierItems} emptyText="Chưa có dữ liệu thu ngân trong kỳ." />
    </View>
  );
}

