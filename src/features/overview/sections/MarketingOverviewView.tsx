import { View } from 'react-native';
import { SectionHeading } from '@/components/SectionHeading';
import {
  BreakdownBars,
  KpiGrid,
  ListPanel,
  NoticeStrip,
  type KpiItem,
  type ListRowItem,
} from '@/features/overview/OverviewWidgets';
import {
  computePercentDelta,
  formatCompactMoney,
  formatDeltaBadge,
  formatInt,
} from '@/features/overview/overviewPeriod';
import type {
  CrmLeadStage,
  MarketingOverviewData,
  OverviewDateRange,
} from '@/features/overview/types';

const STAGE_META: Array<{ key: CrmLeadStage; label: string; color: string }> = [
  { key: 'cold', label: 'Mới', color: '#2196F3' },
  { key: 'warm', label: 'Đang quan tâm', color: '#00B8F4' },
  { key: 'hot', label: 'Tiềm năng cao', color: '#F5D610' },
  { key: 'won', label: 'Đã chốt', color: '#18C93A' },
  { key: 'upsell', label: 'Bán thêm', color: '#8B5CF6' },
];

function toDateKey(input?: string): string | null {
  if (!input) return null;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function MarketingOverviewView({
  data,
  range,
}: {
  data: MarketingOverviewData;
  range: OverviewDateRange;
}) {
  const leads = data.leads ?? [];
  const counts: Record<CrmLeadStage, number> = { cold: 0, warm: 0, hot: 0, won: 0, upsell: 0 };
  let openCount = 0;
  let openValue = 0;
  let wonValue = 0;
  let newInPeriod = 0;
  let newInPrev = 0;

  for (const lead of leads) {
    const stage: CrmLeadStage = lead.status in counts ? lead.status : 'cold';
    counts[stage] += 1;
    const val = Number(lead.value) || 0;
    if (stage === 'won') {
      wonValue += val;
    } else {
      openCount += 1;
      openValue += val;
    }
    const createdKey = toDateKey(lead.createdAt);
    if (createdKey) {
      if (createdKey >= range.from && createdKey <= range.to) newInPeriod += 1;
      if (createdKey >= range.previousFrom && createdKey <= range.previousTo) newInPrev += 1;
    }
  }

  const winRate = leads.length > 0 ? Math.round((counts.won / leads.length) * 1000) / 10 : 0;

  const kpis: KpiItem[] = [
    {
      id: 'mkt-total',
      label: 'Tổng cơ hội CRM',
      value: data.leads ? formatInt(leads.length) : '—',
      helper: `${formatInt(openCount)} đang theo đuổi`,
      accent: '#2463EB',
      tone: '#EAF2FF',
    },
    {
      id: 'mkt-new',
      label: 'Cơ hội mới trong kỳ',
      value: data.leads ? formatInt(newInPeriod) : '—',
      delta: formatDeltaBadge(computePercentDelta(newInPeriod, newInPrev)),
      accent: '#0E7490',
      tone: '#E8F7FA',
    },
    {
      id: 'mkt-won',
      label: 'Đã chốt',
      value: data.leads ? formatInt(counts.won) : '—',
      delta: `Tỷ lệ ${winRate}%`,
      helper: `Giá trị: ${formatCompactMoney(wonValue)}`,
      accent: '#16885A',
      tone: '#E9F8F1',
    },
    {
      id: 'mkt-open-val',
      label: 'Giá trị đang theo đuổi',
      value: data.leads ? formatCompactMoney(openValue) : '—',
      accent: '#C27617',
      tone: '#FFF3E5',
    },
    {
      id: 'mkt-docs',
      label: 'Tài liệu kho tri thức',
      value: formatInt(data.knowledge?.documentsCount),
      helper: `${formatInt(data.knowledge?.chunksCount)} đoạn tri thức`,
      accent: '#7754C8',
      tone: '#F1EBFF',
    },
    {
      id: 'mkt-faq',
      label: 'FAQ chờ duyệt',
      value: formatInt(data.faq?.stats?.pending),
      helper: `${formatInt(data.faq?.stats?.approved)} đã duyệt`,
      accent: '#64748B',
      tone: '#F1F5F9',
    },
  ];

  const funnelRows = STAGE_META.map((stage) => ({
    label: stage.label,
    value: counts[stage.key],
    displayValue: `${formatInt(counts[stage.key])} cơ hội`,
    color: stage.color,
  }));

  const followUpItems: ListRowItem[] = leads
    .filter((l) => l.status !== 'won')
    .sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt || 0).getTime() -
        new Date(a.updatedAt || a.createdAt || 0).getTime(),
    )
    .slice(0, 6)
    .map((l) => {
      const stageMeta = STAGE_META.find((s) => s.key === l.status) ?? STAGE_META[0];
      return {
        id: l.id,
        title: l.customerName || 'Khách hàng',
        subtitle: `${stageMeta.label}${l.sourcePlatform ? ` · ${l.sourcePlatform.toUpperCase()}` : ''}`,
        badge: l.value ? formatCompactMoney(l.value) : stageMeta.label,
        badgeColor: stageMeta.color,
        badgeTone: '#EAF2FF',
        dotColor: stageMeta.color,
      };
    });

  return (
    <View>
      {data.partialError ? (
        <NoticeStrip text="Một số nguồn dữ liệu Marketing/Tri thức chưa tải được. Các khối khả dụng vẫn đang hiển thị." />
      ) : null}

      <SectionHeading title="Tình hình Marketing & CRM" action={range.label} />
      <KpiGrid items={kpis} />

      <SectionHeading title="Phễu cơ hội CRM" />
      <BreakdownBars rows={funnelRows} emptyText="Chưa có cơ hội CRM nào." />

      <SectionHeading title="Cơ hội cần theo dõi" />
      <ListPanel items={followUpItems} emptyText="Không có cơ hội đang mở cần theo dõi." />
    </View>
  );
}

