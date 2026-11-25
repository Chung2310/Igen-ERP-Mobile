import { StyleSheet, Text, View } from 'react-native';
import { SectionHeading } from '@/components/SectionHeading';
import {
  BreakdownBars,
  CHART_COLORS,
  KpiGrid,
  ListPanel,
  type KpiItem,
  type ListRowItem,
} from '@/features/overview/OverviewWidgets';
import {
  computePercentDelta,
  formatDeltaBadge,
  formatInt,
} from '@/features/overview/overviewPeriod';
import type { DashboardSummaryData, OverviewDateRange } from '@/features/overview/types';
import { colors } from '@/theme/colors';

export function HrOverviewView({
  summary,
  previousSummary,
  range,
}: {
  summary: DashboardSummaryData;
  previousSummary: DashboardSummaryData | null;
  range: OverviewDateRange;
}) {
  const tk = summary.timekeeping;
  const tasks = summary.projects.tasks;
  const prevTasks = previousSummary?.projects.tasks;
  const enrollments = summary.training.enrollments;
  const personnel = summary.personnelNow;

  const totalEmployees =
    tk.employeesExistingAtRangeEnd ??
    (personnel?.departmentHeadcounts.length
      ? personnel.departmentHeadcounts.reduce((s, d) => s + d.value, 0)
      : tk.totalEmployees);

  const kpis: KpiItem[] = [
    {
      id: 'hr-emp',
      label: 'Tổng nhân sự',
      value: formatInt(totalEmployees),
      helper: `${formatInt(tk.checkedInToday)} đã chấm công hôm nay`,
      accent: '#2463EB',
      tone: '#EAF2FF',
    },
    {
      id: 'hr-tasks',
      label: 'Công việc trong kỳ',
      value: formatInt(tasks.total),
      delta: formatDeltaBadge(computePercentDelta(tasks.total, prevTasks?.total)),
      helper: `${formatInt(summary.projects.overdueTasks)} quá hạn`,
      accent: '#7754C8',
      tone: '#F1EBFF',
    },
    {
      id: 'hr-training',
      label: 'Lượt học đào tạo',
      value: formatInt(enrollments.total),
      helper: `${formatInt(summary.training.totalCourses)} khóa học`,
      accent: '#16885A',
      tone: '#E9F8F1',
    },
    {
      id: 'hr-approvals',
      label: 'Đơn từ chờ duyệt',
      value: formatInt(personnel?.pendingApprovalCount ?? 0),
      delta: (personnel?.expiringContractCount ?? 0) > 0 ? `${personnel?.expiringContractCount} HĐ sắp hết hạn` : 'Ổn định',
      accent: '#C27617',
      tone: '#FFF3E5',
    },
  ];

  const attendanceTiles = [
    { label: 'Có mặt', value: tk.checkedInToday, color: '#16885A', tone: '#E9F8F1' },
    { label: 'Đi muộn', value: tk.lateToday, color: '#C27617', tone: '#FFF3E5' },
    { label: 'Nghỉ phép', value: tk.onApprovedLeaveToday ?? 0, color: '#2463EB', tone: '#EAF2FF' },
    { label: 'Chưa chấm công', value: tk.absentWithoutLeave ?? 0, color: '#DC2626', tone: '#FEE2E2' },
  ];

  const taskRows = [
    { label: 'Hoàn thành', value: tasks.done, displayValue: `${formatInt(tasks.done)} việc`, color: '#18C93A' },
    { label: 'Đang thực hiện', value: tasks.doing, displayValue: `${formatInt(tasks.doing)} việc`, color: '#2196F3' },
    { label: 'Chưa bắt đầu', value: tasks.todo, displayValue: `${formatInt(tasks.todo)} việc`, color: '#F5D610' },
  ];

  const deptRows = (personnel?.departmentHeadcounts ?? [])
    .slice()
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
    .map((dept, idx) => ({
      label: dept.name || 'Chưa phân phòng ban',
      value: dept.value,
      displayValue: `${formatInt(dept.value)} NV`,
      color: CHART_COLORS[idx % CHART_COLORS.length],
    }));

  const contractItems: ListRowItem[] = (personnel?.expiringContracts ?? []).slice(0, 5).map((c) => {
    const due = new Date(c.endDate);
    const dueLabel = Number.isNaN(due.getTime()) ? c.endDate : due.toLocaleDateString('vi-VN');
    return {
      id: c.id,
      title: c.employeeName,
      subtitle: 'Hợp đồng nhân sự sắp đến hạn',
      badge: dueLabel,
      badgeColor: '#C27617',
      badgeTone: '#FFF3E5',
      dotColor: '#C27617',
    };
  });

  const activeTaskItems: ListRowItem[] = (personnel?.inProgressTasks ?? []).slice(0, 5).map((t) => ({
    id: t.id,
    title: t.title,
    subtitle: t.assignee || 'Chưa phân công',
    badge: t.dueDate && t.dueDate !== 'Chưa cập nhật' ? t.dueDate.slice(0, 10) : 'Đang làm',
    badgeColor: '#2463EB',
    badgeTone: '#EAF2FF',
    dotColor: '#2463EB',
  }));

  return (
    <View>
      <SectionHeading title="Tổng quan nhân sự" action={range.label} />
      <KpiGrid items={kpis} />

      <SectionHeading title="Chấm công hôm nay" />
      <View style={styles.attGrid}>
        {attendanceTiles.map((tile) => (
          <View key={tile.label} style={styles.attCard}>
            <View style={[styles.attBadge, { backgroundColor: tile.tone }]}>
              <Text style={[styles.attValue, { color: tile.color }]}>{formatInt(tile.value)}</Text>
            </View>
            <Text numberOfLines={1} style={styles.attLabel}>
              {tile.label}
            </Text>
          </View>
        ))}
      </View>

      <SectionHeading title="Tiến độ công việc trong kỳ" />
      <BreakdownBars rows={taskRows} emptyText="Chưa có công việc tạo trong kỳ này." />

      {deptRows.length > 0 ? (
        <>
          <SectionHeading title="Phân bổ theo phòng ban" />
          <BreakdownBars rows={deptRows} />
        </>
      ) : null}

      <SectionHeading title="Công việc đang thực hiện" />
      <ListPanel items={activeTaskItems} emptyText="Chưa có công việc đang thực hiện." />

      <SectionHeading title="Hợp đồng sắp hết hạn (30 ngày)" />
      <ListPanel items={contractItems} emptyText="Không có hợp đồng nhân sự sắp hết hạn." />
    </View>
  );
}

const styles = StyleSheet.create({
  attGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 9,
    marginBottom: 18,
  },
  attCard: {
    width: '48.5%',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5EAF2',
  },
  attBadge: {
    minWidth: 36,
    height: 32,
    borderRadius: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  attLabel: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
});

