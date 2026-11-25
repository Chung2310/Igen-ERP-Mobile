import { PopupError } from '@/components/PopupError';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';

export type KpiItem = {
  id: string;
  label: string;
  value: string;
  delta?: string;
  helper?: string;
  accent: string;
  tone: string;
};

export function KpiGrid({ items }: { items: KpiItem[] }) {
  return (
    <View style={styles.kpiGrid}>
      {items.map((item) => (
        <View key={item.id} style={styles.kpiCard}>
          <View style={styles.kpiHeader}>
            <View style={[styles.kpiDotWrap, { backgroundColor: item.tone }]}>
              <View style={[styles.kpiDot, { backgroundColor: item.accent }]} />
            </View>
            {item.delta ? (
              <Text numberOfLines={1} style={[styles.kpiDelta, { color: item.accent }]}>
                {item.delta}
              </Text>
            ) : null}
          </View>
          <Text numberOfLines={2} style={styles.kpiLabel}>
            {item.label}
          </Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={styles.kpiValue}>
            {item.value}
          </Text>
          {item.helper ? (
            <Text numberOfLines={1} style={styles.kpiHelper}>
              {item.helper}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

export type BarDatum = {
  label: string;
  primary: number;
  secondary?: number;
};

export function VerticalBarChart({
  data,
  primaryLabel,
  secondaryLabel,
  primaryColor = '#18C93A',
  secondaryColor = '#2196F3',
  emptyText = 'Chưa có phát sinh trong kỳ đã chọn.',
}: {
  data: BarDatum[];
  primaryLabel: string;
  secondaryLabel?: string;
  primaryColor?: string;
  secondaryColor?: string;
  emptyText?: string;
}) {
  const hasAny = data.some((d) => d.primary > 0 || (d.secondary ?? 0) > 0);
  if (!data.length || !hasAny) {
    return (
      <View style={styles.chartCard}>
        <Text style={styles.emptyInline}>{emptyText}</Text>
      </View>
    );
  }

  const maxValue = Math.max(
    1,
    ...data.flatMap((d) => [Math.max(0, d.primary), Math.max(0, d.secondary ?? 0)]),
  );

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartAreaWrap}>
        {/* Subtle horizontal hairline gridlines */}
        <View pointerEvents="none" style={styles.chartGridLines}>
          <View style={styles.chartGridLine} />
          <View style={styles.chartGridLine} />
          <View style={styles.chartGridLine} />
          <View style={styles.chartGridLine} />
        </View>
        <View style={styles.chartArea}>
          {data.map((item, idx) => {
            const h1 = item.primary > 0 ? Math.max(6, Math.round((item.primary / maxValue) * 102)) : 2;
            const h2 =
              secondaryLabel !== undefined
                ? (item.secondary ?? 0) > 0
                  ? Math.max(6, Math.round(((item.secondary ?? 0) / maxValue) * 102))
                  : 2
                : 0;
            return (
              <View key={`${item.label}-${idx}`} style={styles.barGroup}>
                <View style={styles.barsRow}>
                  <View style={[styles.bar, { height: h1, backgroundColor: primaryColor }]} />
                  {secondaryLabel !== undefined ? (
                    <View style={[styles.bar, { height: h2, backgroundColor: secondaryColor }]} />
                  ) : null}
                </View>
                <Text numberOfLines={1} style={styles.barAxisLabel}>
                  {item.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
      <View style={styles.legendRow}>
        <View style={[styles.legendDot, { backgroundColor: primaryColor }]} />
        <Text style={styles.legendText}>{primaryLabel}</Text>
        {secondaryLabel ? (
          <>
            <View style={[styles.legendDot, { backgroundColor: secondaryColor, marginLeft: 16 }]} />
            <Text style={styles.legendText}>{secondaryLabel}</Text>
          </>
        ) : null}
      </View>
    </View>
  );
}

export type BreakdownRow = {
  label: string;
  value: number;
  displayValue: string;
  color: string;
};

export function BreakdownBars({
  rows,
  emptyText = 'Chưa có dữ liệu phân bổ.',
}: {
  rows: BreakdownRow[];
  emptyText?: string;
}) {
  const total = rows.reduce((sum, r) => sum + Math.max(0, r.value), 0);
  if (!rows.length || total <= 0) {
    return (
      <View style={styles.sectionCard}>
        <Text style={styles.emptyInline}>{emptyText}</Text>
      </View>
    );
  }

  return (
    <View style={styles.sectionCard}>
      <View style={styles.breakdownList}>
        {rows.map((row) => {
          const pct = Math.min(100, Math.round((Math.max(0, row.value) / total) * 100));
          return (
            <View key={row.label} style={styles.breakdownItem}>
              <View style={styles.breakdownHeader}>
                <View style={styles.breakdownLabelWrap}>
                  <View style={[styles.smallDot, { backgroundColor: row.color }]} />
                  <Text numberOfLines={1} style={styles.breakdownLabel}>
                    {row.label}
                  </Text>
                </View>
                <Text style={styles.breakdownValue}>
                  {row.displayValue} · {pct}%
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.max(pct, row.value > 0 ? 4 : 0)}%`, backgroundColor: row.color },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export type ListRowItem = {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  badgeTone?: string;
  dotColor?: string;
};

export function ListPanel({
  items,
  emptyText = 'Chưa có mục nào cần theo dõi.',
}: {
  items: ListRowItem[];
  emptyText?: string;
}) {
  if (!items.length) {
    return (
      <View style={styles.sectionCard}>
        <Text style={styles.emptyInline}>{emptyText}</Text>
      </View>
    );
  }

  return (
    <View style={styles.sectionCard}>
      {items.map((item, idx) => (
        <View key={item.id} style={[styles.listRow, idx > 0 && styles.listRowBorder]}>
          <View style={[styles.rowBullet, { backgroundColor: item.dotColor ?? colors.primary }]} />
          <View style={styles.rowBody}>
            <Text numberOfLines={1} style={styles.rowTitle}>
              {item.title}
            </Text>
            {item.subtitle ? (
              <Text numberOfLines={1} style={styles.rowSubtitle}>
                {item.subtitle}
              </Text>
            ) : null}
          </View>
          {item.badge ? (
            <View
              style={[
                styles.rowBadge,
                { backgroundColor: item.badgeTone ?? '#EAF2FF' },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[styles.rowBadgeText, { color: item.badgeColor ?? colors.primary }]}
              >
                {item.badge}
              </Text>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

export function OverviewLoading({ label }: { label: string }) {
  return (
    <View style={styles.stateCard}>
      <ActivityIndicator size="small" color={colors.primary} />
      <Text style={styles.stateText}>{label}</Text>
    </View>
  );
}

export function OverviewError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <PopupError error={message} title="Không tải được dữ liệu từ ERP" onRetry={onRetry} />;
}

export function NoticeStrip({ text }: { text: string }) {
  return (
    <View style={styles.noticeStrip}>
      <Text style={styles.noticeText}>{text}</Text>
    </View>
  );
}

/** Đồng bộ bảng màu biểu đồ từ web iGen ERP (dashboardPalette.ts & hr-analytics.css). */
export const CHART_COLORS = ['#18C93A', '#2196F3', '#F5D610', '#F44336', '#8B5CF6', '#00B8F4'];
export const CHART_TRACK_COLOR = '#E8EDF4';

const HAIRLINE_CARD = {
  backgroundColor: colors.white,
  borderRadius: 10,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: '#E5EAF2',
} as const;

const styles = StyleSheet.create({
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 9,
    marginBottom: 18,
  },
  kpiCard: {
    ...HAIRLINE_CARD,
    width: '48.5%',
    minHeight: 94,
    padding: 12,
  },
  kpiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  kpiDotWrap: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  kpiDelta: {
    fontSize: 9,
    fontWeight: '700',
    flexShrink: 1,
  },
  kpiLabel: {
    color: colors.muted,
    fontSize: 10.5,
    marginTop: 8,
  },
  kpiValue: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 3,
  },
  kpiHelper: {
    color: colors.muted,
    fontSize: 9.5,
    marginTop: 3,
  },
  chartCard: {
    ...HAIRLINE_CARD,
    padding: 14,
    marginBottom: 18,
  },
  chartAreaWrap: {
    position: 'relative',
  },
  chartGridLines: {
    position: 'absolute',
    top: 4,
    left: 0,
    right: 0,
    height: 104,
    justifyContent: 'space-between',
  },
  chartGridLine: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E8EDF4',
  },
  chartArea: {
    height: 128,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  barGroup: {
    alignItems: 'center',
    flex: 1,
  },
  barsRow: {
    height: 108,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  bar: {
    width: 11,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  barAxisLabel: {
    color: colors.muted,
    fontSize: 8.5,
    marginTop: 6,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    color: '#5B677B',
    fontSize: 10,
    fontWeight: '500',
  },
  sectionCard: {
    ...HAIRLINE_CARD,
    padding: 15,
    marginBottom: 18,
  },
  breakdownList: {
    gap: 15,
  },
  breakdownItem: {
    gap: 8,
  },
  breakdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  breakdownLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 7,
  },
  smallDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  breakdownLabel: {
    color: colors.ink,
    fontSize: 12.5,
    fontWeight: '600',
    flex: 1,
  },
  breakdownValue: {
    color: colors.ink,
    fontSize: 11.5,
    fontWeight: '700',
  },
  progressTrack: {
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E8EDF4',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    gap: 10,
  },
  listRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EDF2F8',
  },
  rowBullet: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  rowSubtitle: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 2,
  },
  rowBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    maxWidth: 110,
  },
  rowBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  emptyInline: {
    color: colors.muted,
    fontSize: 11,
    textAlign: 'center',
    paddingVertical: 14,
  },
  stateCard: {
    ...HAIRLINE_CARD,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 18,
  },
  stateText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  errorCard: {
    backgroundColor: '#FFF5F5',
    borderColor: '#FAD4D4',
  },
  errorTitle: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '800',
  },
  errorMessage: {
    color: '#7F1D1D',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
  retryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    marginTop: 4,
  },
  retryBtnText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  noticeStrip: {
    backgroundColor: '#FFF8EB',
    borderColor: '#FDE2B8',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 14,
  },
  noticeText: {
    color: '#9A5B13',
    fontSize: 10,
    lineHeight: 15,
  },
});

