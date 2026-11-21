import { View } from 'react-native';
import { SectionHeading } from '@/components/SectionHeading';
import {
  BreakdownBars,
  CHART_COLORS,
  KpiGrid,
  ListPanel,
  VerticalBarChart,
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
  DashboardSummaryData,
  HealthcareOverviewData,
  OverviewDateRange,
  WorkerOverviewData,
} from '@/features/overview/types';

// --- 1. Học viên & Đào tạo ---
export function StudentOverviewView({
  summary,
  previousSummary,
  range,
}: {
  summary: DashboardSummaryData;
  previousSummary: DashboardSummaryData | null;
  range: OverviewDateRange;
}) {
  const st = summary.students;
  const prevSt = previousSummary?.students;
  const batches = summary.batches;

  const kpis: KpiItem[] = [
    {
      id: 'st-total',
      label: 'Tổng học viên',
      value: formatInt(st.totalStudents),
      delta: `+${formatInt(st.newStudents)} mới`,
      accent: '#2463EB',
      tone: '#EAF2FF',
    },
    {
      id: 'st-tuition',
      label: 'Học phí thu trong kỳ',
      value: formatCompactMoney(st.tuitionRevenue),
      delta: formatDeltaBadge(computePercentDelta(st.tuitionRevenue, prevSt?.tuitionRevenue)),
      helper: `${formatInt(st.paymentCount)} giao dịch`,
      accent: '#16885A',
      tone: '#E9F8F1',
    },
    {
      id: 'st-debt',
      label: 'Học phí còn phải thu',
      value: formatCompactMoney(st.outstandingDebt),
      helper: `${formatInt(st.unpaidStudentCount ?? 0)} HV còn nợ`,
      accent: '#C27617',
      tone: '#FFF3E5',
    },
    {
      id: 'st-batches',
      label: 'Lớp đang hoạt động',
      value: formatInt(batches?.activeCount ?? st.activeBatches),
      helper: `${formatInt(st.activeCourses)} khóa học`,
      accent: '#7754C8',
      tone: '#F1EBFF',
    },
  ];

  const tuitionSplit = [
    {
      label: 'Thu trong kỳ',
      value: st.tuitionRevenue,
      displayValue: formatCompactMoney(st.tuitionRevenue),
      color: '#16885A',
    },
    {
      label: 'Còn phải thu',
      value: st.outstandingDebt,
      displayValue: formatCompactMoney(st.outstandingDebt),
      color: '#C27617',
    },
  ];

  const batchAlerts: ListRowItem[] = [];
  if (batches?.openingTodayCount) {
    batchAlerts.push({
      id: 'batch-open',
      title: 'Lớp khai giảng hôm nay',
      badge: `${formatInt(batches.openingTodayCount)} lớp`,
      badgeColor: '#2463EB',
      badgeTone: '#EAF2FF',
      dotColor: '#2463EB',
    });
  }
  if (batches?.missingInstructorCount) {
    batchAlerts.push({
      id: 'batch-teacher',
      title: 'Lớp chưa có giảng viên',
      subtitle: 'Cần bổ sung phân công giảng dạy',
      badge: `${formatInt(batches.missingInstructorCount)} lớp`,
      badgeColor: '#B91C1C',
      badgeTone: '#FEE2E2',
      dotColor: '#DC2626',
    });
  }
  if (batches?.endingSoonCount) {
    batchAlerts.push({
      id: 'batch-ending',
      title: 'Lớp sắp kết thúc',
      badge: `${formatInt(batches.endingSoonCount)} lớp`,
      badgeColor: '#C27617',
      badgeTone: '#FFF3E5',
      dotColor: '#C27617',
    });
  }

  return (
    <View>
      <SectionHeading title="Tình hình học viên & học phí" action={range.label} />
      <KpiGrid items={kpis} />

      <SectionHeading title="Cơ cấu học phí" />
      <BreakdownBars rows={tuitionSplit} emptyText="Chưa có số liệu học phí." />

      <SectionHeading title="Vận hành lớp học" />
      <ListPanel items={batchAlerts} emptyText="Các lớp học đang vận hành ổn định." />
    </View>
  );
}

// --- 2. Lao động ---
export function WorkerOverviewView({
  data,
  range,
}: {
  data: WorkerOverviewData;
  range: OverviewDateRange;
}) {
  const kpis: KpiItem[] = [
    {
      id: 'wk-total',
      label: 'Tổng lao động',
      value: formatInt(data.totalWorkers),
      helper: `${formatInt(data.activeWorkers)} đang hoạt động`,
      accent: '#2463EB',
      tone: '#EAF2FF',
    },
    {
      id: 'wk-placed',
      label: 'Đã bố trí dự án',
      value: formatInt(data.workersByStatus.placed),
      accent: '#16885A',
      tone: '#E9F8F1',
    },
    {
      id: 'wk-projects',
      label: 'Tổng dự án',
      value: formatInt(data.projects),
      helper: `${formatInt(data.projectsByStatus.active)} đang triển khai`,
      accent: '#7754C8',
      tone: '#F1EBFF',
    },
    {
      id: 'wk-alerts',
      label: 'HĐ sắp hết hạn / hết hạn',
      value: formatInt(
        (data.contractAlerts?.expiringCount ?? 0) + (data.contractAlerts?.expiredCount ?? 0),
      ),
      delta: data.contractAlerts?.expiredCount ? `${data.contractAlerts.expiredCount} đã hết hạn` : 'Trong hạn',
      accent: '#C27617',
      tone: '#FFF3E5',
    },
  ];

  const statusRows = [
    { label: 'Đang hoạt động', value: data.workersByStatus.active, displayValue: formatInt(data.workersByStatus.active), color: '#2463EB' },
    { label: 'Đã bố trí', value: data.workersByStatus.placed, displayValue: formatInt(data.workersByStatus.placed), color: '#16885A' },
    { label: 'Tạm ngưng', value: data.workersByStatus.inactive, displayValue: formatInt(data.workersByStatus.inactive), color: '#94A3B8' },
  ];

  const monthlyBars = (data.monthlyRegistrations ?? []).slice(-6).map((val, idx, arr) => ({
    label: `T${12 - arr.length + idx + 1}`,
    primary: val,
  }));

  const projectItems: ListRowItem[] = (data.topProjects ?? []).slice(0, 5).map((p, idx) => ({
    id: `proj-${p.name}-${idx}`,
    title: p.name,
    subtitle: p.quota > 0 ? `Chỉ tiêu: ${formatInt(p.quota)} lao động` : 'Không giới hạn chỉ tiêu',
    badge: p.quota > 0 ? `${formatInt(p.allocated)}/${formatInt(p.quota)}` : `${formatInt(p.allocated)} LĐ`,
    badgeColor: CHART_COLORS[idx % CHART_COLORS.length],
    badgeTone: '#EAF2FF',
    dotColor: CHART_COLORS[idx % CHART_COLORS.length],
  }));

  return (
    <View>
      <SectionHeading title="Tổng quan lao động" action={range.label} />
      <KpiGrid items={kpis} />

      <SectionHeading title="Hồ sơ tiếp nhận gần đây" />
      <VerticalBarChart data={monthlyBars} primaryLabel="Hồ sơ mới" primaryColor="#C27617" />

      <SectionHeading title="Cơ cấu trạng thái lao động" />
      <BreakdownBars rows={statusRows} />

      <SectionHeading title="Dự án nổi bật" />
      <ListPanel items={projectItems} emptyText="Chưa có dự án nào đang triển khai." />
    </View>
  );
}

// --- 3. Y tế ---
const APPT_STATUS: Record<string, string> = {
  scheduled: 'Đã đặt lịch',
  confirmed: 'Đã xác nhận',
  arrived: 'Đã đến',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
  no_show: 'Không đến',
};

export function HealthcareOverviewView({
  data,
  range,
}: {
  data: HealthcareOverviewData;
  range: OverviewDateRange;
}) {
  const patientMap = new Map(data.patientReferences.map((p) => [p._id, p]));

  const kpis: KpiItem[] = [
    {
      id: 'hc-patients',
      label: 'Tổng bệnh nhân',
      value: formatInt(data.patients),
      accent: '#BE123C',
      tone: '#FFE4E6',
    },
    {
      id: 'hc-visits',
      label: range.key === 'day' ? 'Lượt khám hôm nay' : 'Lượt khám trong kỳ',
      value: formatInt(data.visitCount),
      accent: '#2463EB',
      tone: '#EAF2FF',
    },
    {
      id: 'hc-appt',
      label: 'Lịch hẹn hôm nay',
      value: formatInt(data.appointmentCount),
      accent: '#16885A',
      tone: '#E9F8F1',
    },
    {
      id: 'hc-care',
      label: 'Việc chăm sóc đến hạn',
      value: formatInt(data.careCount),
      accent: '#C27617',
      tone: '#FFF3E5',
    },
  ];

  const apptItems: ListRowItem[] = data.todayAppointments.slice(0, 6).map((a) => {
    const patient = patientMap.get(a.patientId);
    const time = a.startsAt ? a.startsAt.slice(11, 16) : '';
    return {
      id: a._id,
      title: patient ? `${patient.code} · ${patient.name}` : 'Bệnh nhân',
      subtitle: time ? `Giờ hẹn: ${time}` : 'Lịch hẹn hôm nay',
      badge: APPT_STATUS[a.status] || a.status,
      badgeColor: '#2463EB',
      badgeTone: '#EAF2FF',
      dotColor: '#2463EB',
    };
  });

  const careItems: ListRowItem[] = data.dueCare.slice(0, 6).map((c) => {
    const patient = patientMap.get(c.patientId);
    return {
      id: c._id,
      title: c.title,
      subtitle: patient ? `${patient.code} · ${patient.name}` : 'Chăm sóc bệnh nhân',
      badge: c.dueOn || 'Đến hạn',
      badgeColor: '#C27617',
      badgeTone: '#FFF3E5',
      dotColor: '#C27617',
    };
  });

  return (
    <View>
      <SectionHeading title="Tổng quan y tế" action={range.label} />
      <KpiGrid items={kpis} />

      <SectionHeading title="Lịch hẹn hôm nay" />
      <ListPanel items={apptItems} emptyText="Hôm nay chưa có lịch hẹn nào đang chờ." />

      <SectionHeading title="Việc chăm sóc đến hạn" />
      <ListPanel items={careItems} emptyText="Chưa có việc chăm sóc đến hạn." />
    </View>
  );
}

