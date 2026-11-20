import { Link } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { SectionHeading } from '@/components/SectionHeading';
import { colors } from '@/theme/colors';

const metrics = [
  { label: 'Doanh thu', value: '1,28 tỷ', delta: '↑ 12%', tone: '#EAF2FF', ink: '#2463EB' },
  { label: 'Chi phí', value: '680 tr', delta: '↓ 4%', tone: '#FFF3E5', ink: '#C27617' },
  { label: 'Lợi nhuận', value: '320 tr', delta: '↑ 8%', tone: '#E9F8F1', ink: '#16885A' },
  { label: 'Công nợ phải thu', value: '145 tr', delta: 'Cần theo dõi', tone: '#F1EBFF', ink: '#7754C8' },
];

const operations = [
  { label: 'Lead mới', value: '12', icon: '♧', color: '#16885A', background: '#E9F8F1' },
  { label: 'Tin chưa đọc', value: '08', icon: '▤', color: '#2463EB', background: '#EAF2FF' },
  { label: 'Công việc hôm nay', value: '05', icon: '✓', color: '#7754C8', background: '#F1EBFF' },
  { label: 'Cảnh báo tồn kho', value: '06', icon: '▦', color: '#C27617', background: '#FFF3E5' },
];

const monthly = [
  { month: 'T1', revenue: 48, cost: 29 }, { month: 'T2', revenue: 59, cost: 35 },
  { month: 'T3', revenue: 53, cost: 31 }, { month: 'T4', revenue: 70, cost: 42 },
  { month: 'T5', revenue: 64, cost: 39 }, { month: 'T6', revenue: 82, cost: 48 },
];

export default function OverviewScreen() {
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topLine}>
          <View>
            <Text style={styles.eyebrow}>IGEN ERP</Text>
            <Text style={styles.company}>Igen Technology⌄</Text>
          </View>
          <View style={styles.avatar}><Text style={styles.avatarText}>AN</Text></View>
        </View>
        <Text style={styles.greeting}>Tổng quan</Text>
        <Card style={styles.periodCard}><Text style={styles.periodLabel}>Kỳ báo cáo</Text><Text style={styles.periodValue}>Tháng này⌄</Text></Card>

        <SectionHeading title="Kết quả kinh doanh" />
        <View style={styles.metricGrid}>
          {metrics.map((item) => (
            <Card key={item.label} style={styles.metricCard}>
              <View style={styles.metricHeader}><View style={[styles.metricDot, { backgroundColor: item.tone }]}><View style={[styles.dot, { backgroundColor: item.ink }]} /></View><Text style={[styles.metricDelta, { color: item.ink }]}>{item.delta}</Text></View>
              <Text style={styles.metricLabel}>{item.label}</Text>
              <Text style={styles.metricValue}>{item.value}</Text>
            </Card>
          ))}
        </View>

        <SectionHeading title="Doanh thu & chi phí" action="6 tháng" />
        <Card style={styles.chartCard}>
          <View style={styles.chart}>
            {monthly.map((item) => (
              <View key={item.month} style={styles.barGroup}>
                <View style={styles.bars}><View style={[styles.bar, { height: item.revenue, backgroundColor: colors.primary }]} /><View style={[styles.bar, { height: item.cost, backgroundColor: '#F2B86D' }]} /></View>
                <Text style={styles.month}>{item.month}</Text>
              </View>
            ))}
          </View>
          <View style={styles.legend}><View style={[styles.legendDot, { backgroundColor: colors.primary }]} /><Text style={styles.legendText}>Doanh thu</Text><View style={[styles.legendDot, { backgroundColor: '#F2B86D', marginLeft: 14 }]} /><Text style={styles.legendText}>Chi phí</Text></View>
        </Card>

        <SectionHeading title="Vận hành hôm nay" action="Danh mục" href="/(tabs)/modules" />
        <View style={styles.operationGrid}>
          {operations.map((item) => (
            <Card key={item.label} style={styles.operationCard}>
              <View style={[styles.operationIcon, { backgroundColor: item.background }]}><Text style={{ color: item.color, fontSize: 15 }}>{item.icon}</Text></View>
              <View style={styles.operationText}><Text numberOfLines={1} style={styles.operationLabel}>{item.label}</Text><Text style={styles.operationValue}>{item.value}</Text></View>
            </Card>
          ))}
        </View>

        <Link href="/(tabs)/ai-chat" asChild>
          <Card style={styles.aiCard}>
            <View style={styles.aiIcon}><Text style={styles.aiIconText}>✦</Text></View>
            <View style={styles.aiCopy}><Text style={styles.aiTitle}>Trò chuyện AI</Text><Text style={styles.aiSubtitle}>Hạn mức còn 72% · Hỏi về dữ liệu ERP</Text></View>
            <Text style={styles.arrow}>›</Text>
          </Card>
        </Link>
        <Text style={styles.demoNote}>Số liệu minh họa · dữ liệu thật sẽ lấy theo kỳ, gói dịch vụ và quyền được cấp.</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 28 },
  topLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  eyebrow: { color: colors.primary, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  company: { color: colors.ink, fontSize: 12, fontWeight: '700', marginTop: 5 },
  greeting: { color: colors.ink, fontSize: 24, fontWeight: '800', marginBottom: 12 },
  avatar: { width: 42, height: 42, borderRadius: 15, backgroundColor: '#DCE8FF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primary, fontWeight: '800' },
  periodCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, marginBottom: 19 },
  periodLabel: { color: colors.muted, fontSize: 11 },
  periodValue: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 9, marginBottom: 20 },
  metricCard: { width: '48.5%', minHeight: 94, padding: 12 },
  metricHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metricDot: { width: 22, height: 22, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  metricDelta: { fontSize: 8, fontWeight: '700' },
  metricLabel: { color: colors.muted, fontSize: 9, marginTop: 8 },
  metricValue: { color: colors.ink, fontSize: 18, fontWeight: '800', marginTop: 2 },
  chartCard: { padding: 14, marginBottom: 20 },
  chart: { height: 112, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 3 },
  barGroup: { alignItems: 'center', flex: 1 },
  bars: { height: 92, flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  bar: { width: 9, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  month: { color: colors.muted, fontSize: 8, marginTop: 5 },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 11 },
  legendDot: { width: 7, height: 7, borderRadius: 4, marginRight: 5 },
  legendText: { color: colors.muted, fontSize: 8 },
  operationGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 9, marginBottom: 18 },
  operationCard: { width: '48.5%', flexDirection: 'row', alignItems: 'center', padding: 10 },
  operationIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  operationText: { flex: 1, marginLeft: 9 },
  operationLabel: { color: colors.muted, fontSize: 8 },
  operationValue: { color: colors.ink, fontSize: 16, fontWeight: '800', marginTop: 2 },
  aiCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EAF2FF', borderColor: '#DCE8FA', padding: 13, marginBottom: 2 },
  aiIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#D6E5FF', alignItems: 'center', justifyContent: 'center' },
  aiIconText: { color: colors.primary, fontSize: 22 },
  aiCopy: { flex: 1, marginLeft: 13 },
  aiTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  aiSubtitle: { color: colors.muted, fontSize: 9, marginTop: 4 },
  arrow: { fontSize: 23, color: colors.primary, marginLeft: 8 },
  demoNote: { color: colors.muted, fontSize: 8, textAlign: 'center', lineHeight: 13, marginTop: 14 },
});
