import { BrandLoader } from '@/components/BrandLoader';
import { IgenEmptyState } from '@/components/EmptyStateIllustration';
import { PopupError } from '@/components/PopupError';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
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

function formatChartNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs === 0) return '0';
  if (abs >= 1e9) {
    return `${(value / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}tỉ`;
  }
  if (abs >= 1e6) {
    return `${(value / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}tr`;
  }
  if (abs >= 1e3) {
    return `${(value / 1e3).toLocaleString('vi-VN', { maximumFractionDigits: 0 })}K`;
  }
  return Math.round(value).toLocaleString('vi-VN');
}

function computeNiceCeiling(rawMax: number): number {
  if (rawMax <= 0) return 4;
  const roughStep = rawMax / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const residual = roughStep / magnitude;
  const niceResidual =
    residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 2.5 ? 2.5 : residual <= 5 ? 5 : 10;
  return niceResidual * magnitude * 4;
}

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
        <IgenEmptyState message={emptyText} compact />
      </View>
    );
  }

  const rawMax = Math.max(
    1,
    ...data.flatMap((d) => [Math.max(0, d.primary), Math.max(0, d.secondary ?? 0)]),
  );
  const ceiling = computeNiceCeiling(rawMax);
  const yTicks = [ceiling, ceiling * 0.75, ceiling * 0.5, ceiling * 0.25, 0];
  const plotHeight = 132;
  const barWidth = secondaryLabel !== undefined ? 11 : 16;

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartMainRow}>
        {/* Y-axis scale ticks */}
        <View style={[styles.yAxisCol, { height: plotHeight }]}>
          {yTicks.map((tick, idx) => (
            <Text key={`yt-${idx}`} numberOfLines={1} style={styles.yAxisText}>
              {formatChartNumber(tick)}
            </Text>
          ))}
        </View>

        {/* Gridlines + square bars + X-axis labels */}
        <View style={styles.chartPlotWrap}>
          <View style={[styles.chartPlotArea, { height: plotHeight }]}>
            <View pointerEvents="none" style={styles.chartGridLines}>
              {yTicks.map((_, idx) => (
                <View
                  key={`gl-${idx}`}
                  style={[
                    styles.chartGridLine,
                    idx === yTicks.length - 1 && styles.chartBaseline,
                  ]}
                />
              ))}
            </View>

            <View style={styles.chartBarsRow}>
              {data.map((item, idx) => {
                const pVal = Math.max(0, item.primary);
                const sVal = Math.max(0, item.secondary ?? 0);
                const h1 = pVal > 0 ? Math.max(3, Math.round((pVal / ceiling) * plotHeight)) : 0;
                const h2 =
                  secondaryLabel !== undefined && sVal > 0
                    ? Math.max(3, Math.round((sVal / ceiling) * plotHeight))
                    : 0;

                return (
                  <View key={`${item.label}-${idx}`} style={styles.barGroup}>
                    <View style={styles.barsRow}>
                      <View style={styles.singleBarCol}>
                        {pVal > 0 ? (
                          <Text numberOfLines={1} style={styles.barValueLabel}>
                            {formatChartNumber(pVal)}
                          </Text>
                        ) : null}
                        <View
                          style={[
                            styles.bar,
                            { width: barWidth, height: h1, backgroundColor: primaryColor },
                          ]}
                        />
                      </View>
                      {secondaryLabel !== undefined ? (
                        <View style={styles.singleBarCol}>
                          {sVal > 0 ? (
                            <Text numberOfLines={1} style={styles.barValueLabel}>
                              {formatChartNumber(sVal)}
                            </Text>
                          ) : null}
                          <View
                            style={[
                              styles.bar,
                              { width: barWidth, height: h2, backgroundColor: secondaryColor },
                            ]}
                          />
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.xAxisRow}>
            {data.map((item, idx) => (
              <Text key={`xl-${item.label}-${idx}`} numberOfLines={1} style={styles.barAxisLabel}>
                {item.label}
              </Text>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.legendRow}>
        <View style={[styles.legendDot, { backgroundColor: primaryColor }]} />
        <Text style={styles.legendText}>{primaryLabel}</Text>
        {secondaryLabel ? (
          <>
            <View style={[styles.legendDot, { backgroundColor: secondaryColor, marginLeft: 20 }]} />
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
        <IgenEmptyState message={emptyText} compact />
      </View>
    );
  }

  const size = 112;
  const strokeWidth = 9;
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const positiveRows = rows.filter((r) => r.value > 0);
  const gap = positiveRows.length > 1 ? 2.5 : 0;

  let accumulatedLength = 0;
  const segments = positiveRows.map((row) => {
    const fraction = Math.max(0, row.value) / total;
    const rawLength = fraction * circumference;
    const visibleLength = Math.max(2, rawLength - gap);
    const dashOffset = -accumulatedLength;
    accumulatedLength += rawLength;
    return {
      key: row.label,
      color: row.color,
      visibleLength,
      dashOffset,
    };
  });

  const leadingRow = positiveRows.reduce(
    (best, cur) => (cur.value > best.value ? cur : best),
    positiveRows[0],
  );
  const leadingPct = Math.min(100, Math.round((Math.max(0, leadingRow.value) / total) * 100));

  return (
    <View style={styles.sectionCard}>
      <View style={styles.donutContainer}>
        <View style={styles.donutChartWrap}>
          <Svg width={size} height={size}>
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke={CHART_TRACK_COLOR}
              strokeWidth={strokeWidth}
              fill="none"
            />
            <G rotation={-90} origin={`${center}, ${center}`}>
              {segments.map((seg) => (
                <Circle
                  key={seg.key}
                  cx={center}
                  cy={center}
                  r={radius}
                  stroke={seg.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${seg.visibleLength} ${circumference}`}
                  strokeDashoffset={seg.dashOffset}
                  strokeLinecap="butt"
                  fill="none"
                />
              ))}
            </G>
          </Svg>
          <View pointerEvents="none" style={styles.donutCenter}>
            <Text style={styles.donutCenterPct}>{leadingPct}%</Text>
            <Text numberOfLines={1} style={styles.donutCenterLabel}>
              {leadingRow.label}
            </Text>
          </View>
        </View>

        <View style={styles.donutLegend}>
          {rows.map((row) => {
            const pct = Math.min(100, Math.round((Math.max(0, row.value) / total) * 100));
            return (
              <View key={row.label} style={styles.donutLegendRow}>
                <View style={styles.breakdownLabelWrap}>
                  <View style={[styles.smallDot, { backgroundColor: row.color }]} />
                  <Text numberOfLines={1} style={styles.breakdownLabel}>
                    {row.label}
                  </Text>
                </View>
                <View style={styles.donutValueWrap}>
                  <Text style={styles.breakdownSubValue}>{row.displayValue}</Text>
                  <Text style={styles.breakdownPct}>{pct}%</Text>
                </View>
              </View>
            );
          })}
        </View>
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
        <IgenEmptyState message={emptyText} compact />
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
      <BrandLoader size={42} label={label} />
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
    fontSize: 9.5,
    fontWeight: '500',
    flexShrink: 1,
  },
  kpiLabel: {
    color: colors.muted,
    fontSize: 10.5,
    fontWeight: '400',
    marginTop: 8,
  },
  kpiValue: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 3,
  },
  kpiHelper: {
    color: colors.muted,
    fontSize: 9.5,
    fontWeight: '400',
    marginTop: 3,
  },
  chartCard: {
    ...HAIRLINE_CARD,
    paddingHorizontal: 12,
    paddingTop: 22,
    paddingBottom: 14,
    marginBottom: 18,
  },
  chartMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  yAxisCol: {
    width: 34,
    paddingRight: 6,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  yAxisText: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '400',
    lineHeight: 11,
  },
  chartPlotWrap: {
    flex: 1,
  },
  chartPlotArea: {
    position: 'relative',
  },
  chartGridLines: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  chartGridLine: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#EDF2F8',
  },
  chartBaseline: {
    backgroundColor: '#CBD5E1',
  },
  chartBarsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingHorizontal: 2,
  },
  barGroup: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  singleBarCol: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barValueLabel: {
    color: colors.ink,
    fontSize: 8.5,
    fontWeight: '400',
    marginBottom: 3,
  },
  bar: {
    borderRadius: 0,
  },
  xAxisRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 6,
    paddingHorizontal: 2,
  },
  barAxisLabel: {
    flex: 1,
    textAlign: 'center',
    color: '#5B677B',
    fontSize: 9.5,
    fontWeight: '400',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    marginRight: 6,
  },
  legendText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '400',
  },
  sectionCard: {
    ...HAIRLINE_CARD,
    padding: 14,
    marginBottom: 18,
  },
  donutContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  donutChartWrap: {
    width: 112,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenter: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  donutCenterPct: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '600',
  },
  donutCenterLabel: {
    color: colors.muted,
    fontSize: 9.5,
    fontWeight: '400',
    marginTop: 1,
  },
  donutLegend: {
    flex: 1,
    gap: 10,
  },
  donutLegendRow: {
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
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  breakdownLabel: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '400',
    flex: 1,
  },
  donutValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  breakdownSubValue: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '400',
  },
  breakdownPct: {
    color: colors.ink,
    fontSize: 11.5,
    fontWeight: '500',
    minWidth: 28,
    textAlign: 'right',
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
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '500',
  },
  rowSubtitle: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '400',
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
    fontWeight: '500',
  },
  emptyInline: {
    color: colors.muted,
    fontSize: 11,
    textAlign: 'center',
    paddingVertical: 14,
  },
  stateCard: {
    minHeight: 280,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 18,
  },
  stateText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '400',
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

