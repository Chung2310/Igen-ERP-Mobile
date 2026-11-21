import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { ChevronRight, Sparkles } from 'lucide-react-native';
import { Card } from '@/components/Card';
import { SectionHeading } from '@/components/SectionHeading';
import {
  BreakdownBars,
  CHART_COLORS,
  KpiGrid,
  ListPanel,
  NoticeStrip,
  VerticalBarChart,
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
import type {
  BusinessOverviewData,
  DashboardActionItemsData,
  OverviewDateRange,
  OverviewPoint,
} from '@/features/overview/types';
import { colors } from '@/theme/colors';

function aggregateSeries(points: OverviewPoint[], maxBars = 7) {
  if (!points.length) return [];
  if (points.length <= maxBars) {
    return points.map((p) => ({ label: formatShortDate(p.date), primary: p.value }));
  }
  const chunkSize = Math.ceil(points.length / maxBars);
  const buckets: Array<{ label: string; primary: number }> = [];
  for (let i = 0; i < points.length; i += chunkSize) {
    const slice = points.slice(i, i + chunkSize);
    buckets.push({
      label: formatShortDate(slice[0].date),
      primary: slice.reduce((sum, p) => sum + p.value, 0),
    });
  }
  return buckets;
}

export function ExecutiveOverviewView({
  business,
  actions,
  range,
}: {
  business: BusinessOverviewData;
  actions: DashboardActionItemsData | null;
  range: OverviewDateRange;
}) {
  const kpis: KpiItem[] = [];

  if (business.retail) {
    kpis.push(
      {
        id: 'retail-net',
        label: 'Doanh số bán hàng',
        value: formatCompactMoney(business.retail.netSales),
        delta: formatDeltaBadge(computePercentDelta(business.retail.netSales, business.retail.previousSales)),
        helper: `${formatInt(business.retail.orderCount)} đơn trong kỳ`,
        accent: '#2463EB',
        tone: '#EAF2FF',
      },
      {
        id: 'retail-today',
        label: 'Doanh số hôm nay',
        value: formatCompactMoney(business.retail.todaySales),
        delta: formatDeltaBadge(computePercentDelta(business.retail.todaySales, business.retail.yesterdaySales)),
        helper: `Hôm qua: ${formatCompactMoney(business.retail.yesterdaySales)}`,
        accent: '#16885A',
        tone: '#E9F8F1',
      },
    );
  }

  if (business.education) {
    kpis.push(
      {
        id: 'edu-tuition',
        label: 'Học phí thực thu',
        value: formatCompactMoney(business.education.tuition),
        delta: formatDeltaBadge(computePercentDelta(business.education.tuition, business.education.previousTuition)),
        helper: `${formatInt(business.education.students)} học viên`,
        accent: '#7754C8',
        tone: '#F1EBFF',
      },
      {
        id: 'edu-classes',
        label: 'Lớp đang học',
        value: formatInt(business.education.activeClasses),
        delta: `+${formatInt(business.education.newStudents)} mới`,
        helper: `${formatInt(business.education.unpaidStudents)} còn học phí`,
        accent: '#2463EB',
        tone: '#EAF2FF',
      },
    );
  }

  if (business.labor) {
    kpis.push(
      {
        id: 'labor-workers',
        label: 'Tổng lao động',
        value: formatInt(business.labor.workers),
        delta: formatDeltaBadge(computePercentDelta(business.labor.newWorkers, business.labor.previousNewWorkers)),
        helper: `${formatInt(business.labor.placedWorkers)} đã bố trí`,
        accent: '#C27617',
        tone: '#FFF3E5',
      },
      {
        id: 'labor-projects',
        label: 'Dự án triển khai',
        value: formatInt(business.labor.activeProjects),
        delta: business.labor.unfilledProjects > 0 ? `${business.labor.unfilledProjects} thiếu chỉ tiêu` : 'Đủ chỉ tiêu',
        accent: '#0E7490',
        tone: '#E8F7FA',
      },
    );
  }

  if (business.finance) {
    kpis.push({
      id: 'fin-receivable',
      label: 'Công nợ phải thu',
      value: formatCompactMoney(business.finance.receivable),
      delta: business.finance.overdue > 0 ? `Quá hạn ${formatCompactMoney(business.finance.overdue)}` : 'Trong hạn',
      accent: '#7754C8',
      tone: '#F1EBFF',
    });
  }

  if (business.hr) {
    kpis.push({
      id: 'hr-attendance',
      label: business.hr.checkedIn != null ? 'Chấm công hôm nay' : 'Tổng nhân sự',
      value:
        business.hr.checkedIn != null
          ? `${formatInt(business.hr.checkedIn)}/${formatInt(business.hr.employees)}`
          : formatInt(business.hr.employees),
      delta: business.hr.late ? `${business.hr.late} đi muộn` : 'Đúng giờ',
      helper: `${formatInt(business.hr.tasks.doing)} việc đang làm`,
      accent: '#0E7490',
      tone: '#E8F7FA',
    });
  }

  if (business.inventory) {
    kpis.push({
      id: 'inv-stock',
      label: 'Tổng tồn kho',
      value: formatInt(business.inventory.quantity),
      delta: business.inventory.lowStock > 0 ? `${business.inventory.lowStock} sắp hết` : 'Ổn định',
      accent: '#C27617',
      tone: '#FFF3E5',
    });
  }

  if (business.customer) {
    kpis.push({
      id: 'cust-total',
      label: 'Khách hàng',
      value: formatInt(business.customer.total),
      delta: `+${formatInt(business.customer.newCustomers)} mới`,
      accent: '#16885A',
      tone: '#E9F8F1',
    });
  }

  const primarySeries =
    business.retail?.series ?? business.education?.series ?? business.labor?.series ?? [];
  const primaryChartTitle = business.retail
    ? 'Xu hướng doanh số bán hàng'
    : business.education
      ? 'Xu hướng thu học phí'
      : 'Hồ sơ lao động tạo mới';
  const primaryChartLegend = business.retail
    ? 'Doanh số'
    : business.education
      ? 'Học phí'
      : 'Hồ sơ mới';

  const alerts: ListRowItem[] = [];
  if (business.hr && business.hr.overdueTasks > 0) {
    alerts.push({
      id: 'overdue-tasks',
      title: 'Công việc quá hạn',
      subtitle: 'Công việc tạo trong kỳ cần ưu tiên xử lý',
      badge: `${formatInt(business.hr.overdueTasks)} việc`,
      badgeColor: '#B91C1C',
      badgeTone: '#FEE2E2',
      dotColor: '#DC2626',
    });
  }
  if (business.hr && business.hr.pendingApprovals > 0) {
    alerts.push({
      id: 'pending-approvals',
      title: 'Đơn từ chờ duyệt',
      subtitle: 'Đề nghị nghỉ phép / xác nhận của nhân sự',
      badge: `${formatInt(business.hr.pendingApprovals)} đơn`,
      badgeColor: '#C27617',
      badgeTone: '#FFF3E5',
      dotColor: '#C27617',
    });
  }
  if (business.hr && business.hr.expiringContracts > 0) {
    alerts.push({
      id: 'expiring-contracts',
      title: 'Hợp đồng nhân sự sắp hết hạn',
      subtitle: 'Trong vòng 30 ngày tới',
      badge: `${formatInt(business.hr.expiringContracts)} HĐ`,
      badgeColor: '#7754C8',
      badgeTone: '#F1EBFF',
      dotColor: '#7754C8',
    });
  }
  if (business.inventory && business.inventory.lowStock > 0) {
    alerts.push({
      id: 'low-stock',
      title: 'Tồn kho chạm ngưỡng tối thiểu',
      subtitle: 'Cần kiểm tra nhập bổ sung hàng hóa',
      badge: `${formatInt(business.inventory.lowStock)} mã`,
      badgeColor: '#C27617',
      badgeTone: '#FFF3E5',
      dotColor: '#C27617',
    });
  }
  if (business.repair && business.repair.overdue > 0) {
    alerts.push({
      id: 'repair-overdue',
      title: 'Phiếu sửa chữa quá hẹn trả',
      subtitle: `${formatInt(business.repair.open)} phiếu đang mở`,
      badge: `${formatInt(business.repair.overdue)} phiếu`,
      badgeColor: '#B91C1C',
      badgeTone: '#FEE2E2',
      dotColor: '#DC2626',
    });
  }
  if (actions?.overdueTasks.length && !alerts.some((a) => a.id === 'overdue-tasks')) {
    alerts.push({
      id: 'action-overdue',
      title: 'Công việc quá hạn hôm nay',
      subtitle: actions.overdueTasks[0]?.title,
      badge: `${formatInt(actions.overdueTasks.length)} việc`,
      badgeColor: '#B91C1C',
      badgeTone: '#FEE2E2',
      dotColor: '#DC2626',
    });
  }

  const topProducts =
    business.retail?.products
      .filter((p) => p.netSales > 0)
      .sort((a, b) => b.netSales - a.netSales)
      .slice(0, 5)
      .map((p, idx) => ({
        label: p.productName,
        value: p.netSales,
        displayValue: formatCompactMoney(p.netSales),
        color: CHART_COLORS[idx % CHART_COLORS.length],
      })) ?? [];

  return (
    <View>
      {business.errors.length > 0 ? (
        <NoticeStrip
          text={`Một số khối chưa tải được (${business.errors.join(', ')}). Các chỉ số khả dụng vẫn được hiển thị.`}
        />
      ) : null}

      <SectionHeading title="Chỉ số nổi bật" action={range.label} />
      {kpis.length > 0 ? (
        <KpiGrid items={kpis.slice(0, 6)} />
      ) : (
        <NoticeStrip text="Tài khoản chưa được cấp quyền xem các khối tổng hợp doanh nghiệp. Hãy chuyển sang từng trang tổng quan chuyên biệt phía trên." />
      )}

      {primarySeries.length > 0 ? (
        <>
          <SectionHeading title={primaryChartTitle} action={range.label} />
          <VerticalBarChart
            data={aggregateSeries(primarySeries)}
            primaryLabel={primaryChartLegend}
          />
        </>
      ) : null}

      {topProducts.length > 0 ? (
        <>
          <SectionHeading title="Sản phẩm bán chạy" action="Top 5" />
          <BreakdownBars rows={topProducts} />
        </>
      ) : null}

      <SectionHeading title="Cảnh báo & việc cần xử lý" action="Danh mục" href="/(tabs)/modules" />
      <ListPanel
        items={alerts}
        emptyText="Không có cảnh báo khẩn cấp trong các phân hệ được cấp quyền."
      />

      <Link href="/(tabs)/ai-chat" asChild>
        <Card style={styles.aiCard}>
          <View style={styles.aiIcon}>
            <Sparkles size={19} color={colors.primary} />
          </View>
          <View style={styles.aiCopy}>
            <Text style={styles.aiTitle}>Hỏi Trợ lý AI về số liệu ERP</Text>
            <Text style={styles.aiSubtitle}>Tra cứu nhanh báo cáo, công nợ, đơn hàng theo quyền của bạn</Text>
          </View>
          <ChevronRight size={18} color={colors.primary} />
        </Card>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  aiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAF2FF',
    borderColor: '#DCE8FA',
    padding: 13,
    marginBottom: 8,
  },
  aiIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#D6E5FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiIconText: {
    color: colors.primary,
    fontSize: 20,
  },
  aiCopy: {
    flex: 1,
    marginLeft: 12,
  },
  aiTitle: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '800',
  },
  aiSubtitle: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 3,
  },
  arrow: {
    fontSize: 22,
    color: colors.primary,
    marginLeft: 8,
  },
});

