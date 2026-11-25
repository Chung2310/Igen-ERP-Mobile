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
  formatInt,
  formatShortDate,
} from '@/features/overview/overviewPeriod';
import type { OverviewDateRange, QuotationOverviewData } from '@/features/overview/types';

function aggregateTrend(trend: QuotationOverviewData['quotes']['trend'], maxBars = 6): BarDatum[] {
  if (!trend.length) return [];
  const chunkSize = Math.max(1, Math.ceil(trend.length / maxBars));
  const bars: BarDatum[] = [];
  for (let i = 0; i < trend.length; i += chunkSize) {
    const slice = trend.slice(i, i + chunkSize);
    bars.push({
      label: formatShortDate(slice[0].date),
      primary: slice.reduce((sum, r) => sum + r.count, 0),
      secondary: slice.reduce((sum, r) => sum + r.approved, 0),
    });
  }
  return bars;
}

export function QuotationOverviewView({
  data,
  previous,
  range,
}: {
  data: QuotationOverviewData;
  previous: QuotationOverviewData | null;
  range: OverviewDateRange;
}) {
  const q = data.quotes;
  const primaryValue = q.values.find((v) => v.currency === 'VND') ?? q.values[0];
  const prevPrimaryValue = previous?.quotes.values.find(
    (v) => v.currency === primaryValue?.currency,
  );

  const kpis: KpiItem[] = [
    {
      id: 'q-total',
      label: 'Báo giá trong kỳ',
      value: formatInt(q.total),
      delta: formatDeltaBadge(computePercentDelta(q.total, previous?.quotes.total)),
      accent: '#2463EB',
      tone: '#EAF2FF',
    },
    {
      id: 'q-approved',
      label: 'Đã duyệt',
      value: formatInt(q.byStatus.approved),
      delta: formatDeltaBadge(
        computePercentDelta(q.byStatus.approved, previous?.quotes.byStatus.approved),
      ),
      accent: '#16885A',
      tone: '#E9F8F1',
    },
    {
      id: 'q-pending',
      label: 'Chờ duyệt',
      value: formatInt(q.byStatus.pending_review),
      helper: `${formatInt(q.byStatus.needs_info)} cần bổ sung`,
      accent: '#C27617',
      tone: '#FFF3E5',
    },
    {
      id: 'q-value',
      label: 'Giá trị báo giá (VND)',
      value: `${Math.round(primaryValue?.customer ?? 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} VND`,
      delta: formatDeltaBadge(
        computePercentDelta(primaryValue?.customer, prevPrimaryValue?.customer),
      ),
      helper: `Đã duyệt: ${Math.round(primaryValue?.approvedCustomer ?? 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} VND`,
      accent: '#7754C8',
      tone: '#F1EBFF',
    },
  ];

  if (data.contracts) {
    kpis.push({
      id: 'q-contracts',
      label: 'Hợp đồng',
      value: formatInt(data.contracts.total),
      helper: `${formatInt(data.contracts.signed)} đã ký`,
      accent: '#0E7490',
      tone: '#E8F7FA',
    });
  }
  if (data.acceptances) {
    kpis.push({
      id: 'q-acceptances',
      label: 'Nghiệm thu',
      value: formatInt(data.acceptances.total),
      helper: `${formatInt(data.acceptances.completed)} hoàn tất`,
      accent: '#16885A',
      tone: '#E9F8F1',
    });
  }

  const statusRows = [
    { label: 'Đã duyệt', value: q.byStatus.approved, displayValue: formatInt(q.byStatus.approved), color: '#16885A' },
    { label: 'Chờ duyệt', value: q.byStatus.pending_review, displayValue: formatInt(q.byStatus.pending_review), color: '#C27617' },
    { label: 'Bản nháp', value: q.byStatus.draft, displayValue: formatInt(q.byStatus.draft), color: '#2463EB' },
    { label: 'Thiếu thông tin', value: q.byStatus.needs_info, displayValue: formatInt(q.byStatus.needs_info), color: '#7754C8' },
    { label: 'Cần chỉnh sửa', value: q.byStatus.rejected, displayValue: formatInt(q.byStatus.rejected), color: '#DC2626' },
  ];

  const customerItems: ListRowItem[] = q.customers.slice(0, 5).map((c, idx) => ({
    id: `cust-${c.name}-${idx}`,
    title: c.name,
    subtitle: 'Khách hàng có nhiều báo giá trong kỳ',
    badge: `${formatInt(c.count)} BG`,
    badgeColor: CHART_COLORS[idx % CHART_COLORS.length],
    badgeTone: '#EAF2FF',
    dotColor: CHART_COLORS[idx % CHART_COLORS.length],
  }));

  return (
    <View>
      <SectionHeading title="Tình hình báo giá" action={range.label} />
      <KpiGrid items={kpis} />

      <SectionHeading title="Xu hướng tạo & duyệt báo giá" action={range.label} />
      <VerticalBarChart
        data={aggregateTrend(q.trend)}
        primaryLabel="Tổng tạo"
        secondaryLabel="Đã duyệt"
        primaryColor="#2463EB"
        secondaryColor="#16885A"
      />

      <SectionHeading title="Phân bổ theo trạng thái" />
      <BreakdownBars rows={statusRows} emptyText="Chưa có báo giá trong kỳ này." />

      <SectionHeading title="Khách hàng nổi bật" />
      <ListPanel items={customerItems} emptyText="Chưa có dữ liệu khách hàng trong kỳ." />
    </View>
  );
}

