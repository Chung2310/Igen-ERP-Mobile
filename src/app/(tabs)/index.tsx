import { Link } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { SectionHeading } from '@/components/SectionHeading';
import { moduleCatalog } from '@/features/modules/moduleCatalog';
import { colors } from '@/theme/colors';

const metrics = [
  { label: 'Tin chưa đọc', value: '08', tone: '#EAF2FF', ink: '#2463EB' },
  { label: 'Lead mới', value: '12', tone: '#E9F8F1', ink: '#16885A' },
  { label: 'Công việc', value: '05', tone: '#FFF3E5', ink: '#C27617' },
];

export default function OverviewScreen() {
  const quickModules = moduleCatalog.slice(0, 4);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topLine}>
          <View>
            <Text style={styles.eyebrow}>IGEN ERP · DOANH NGHIỆP</Text>
            <Text style={styles.greeting}>Chào buổi sáng 👋</Text>
          </View>
          <View style={styles.avatar}><Text style={styles.avatarText}>AN</Text></View>
        </View>

        <Card style={styles.aiCard}>
          <View style={styles.aiIcon}><Text style={styles.aiIconText}>✦</Text></View>
          <View style={styles.aiCopy}>
            <Text style={styles.aiTitle}>Trợ lý ERP</Text>
            <Text style={styles.aiSubtitle}>Hỏi nhanh về công việc và dữ liệu của bạn</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </Card>

        <SectionHeading title="Tình hình hôm nay" action="Xem báo cáo" />
        <View style={styles.metrics}>
          {metrics.map((item) => (
            <Card key={item.label} style={styles.metricCard}>
              <View style={[styles.metricDot, { backgroundColor: item.tone }]}><View style={[styles.dot, { backgroundColor: item.ink }]} /></View>
              <Text style={styles.metricValue}>{item.value}</Text>
              <Text style={styles.metricLabel}>{item.label}</Text>
            </Card>
          ))}
        </View>

        <SectionHeading title="Truy cập nhanh" action="Tất cả" href="/(tabs)/modules" />
        <View style={styles.quickGrid}>
          {quickModules.map((module) => (
            <Link key={module.slug} href={{ pathname: '/modules/[slug]', params: { slug: module.slug } }} asChild>
              <Card style={styles.quickCard}>
                <View style={[styles.moduleIcon, { backgroundColor: module.color }]}><Text style={styles.moduleIconText}>{module.icon}</Text></View>
                <Text numberOfLines={1} style={styles.quickTitle}>{module.name}</Text>
                <Text style={styles.quickSubtitle}>{module.shortDescription}</Text>
              </Card>
            </Link>
          ))}
        </View>

        <SectionHeading title="Việc cần chú ý" />
        <Card style={styles.noticeCard}>
          <View style={styles.noticeMark} />
          <View style={styles.noticeCopy}>
            <Text style={styles.noticeTitle}>Có 3 báo giá chờ duyệt</Text>
            <Text style={styles.noticeSubtitle}>Cập nhật lúc 09:42 · Hôm nay</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </Card>
        <Text style={styles.demoNote}>Dữ liệu trên màn hình hiện là dữ liệu mẫu.</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: 14, paddingBottom: 28 },
  topLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 },
  eyebrow: { color: colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1.1 },
  greeting: { color: colors.ink, fontSize: 25, fontWeight: '800', marginTop: 6 },
  avatar: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#DCE8FF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primary, fontWeight: '800' },
  aiCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, borderColor: colors.primary, padding: 16, marginBottom: 24 },
  aiIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#FFFFFF2B', alignItems: 'center', justifyContent: 'center' },
  aiIconText: { color: colors.white, fontSize: 22 },
  aiCopy: { flex: 1, marginLeft: 13 },
  aiTitle: { color: colors.white, fontSize: 15, fontWeight: '800' },
  aiSubtitle: { color: '#DCE8FF', fontSize: 11, marginTop: 4 },
  arrow: { fontSize: 27, color: colors.muted, marginLeft: 8 },
  metrics: { flexDirection: 'row', gap: 10, marginBottom: 22 },
  metricCard: { flex: 1, padding: 13 },
  metricDot: { width: 25, height: 25, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  metricValue: { color: colors.ink, fontSize: 22, fontWeight: '800', marginTop: 12 },
  metricLabel: { color: colors.muted, fontSize: 10, marginTop: 3 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 22 },
  quickCard: { flexGrow: 1, flexBasis: '40%', minWidth: 130, minHeight: 118, padding: 13 },
  moduleIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  moduleIconText: { fontSize: 16 },
  quickTitle: { color: colors.ink, fontSize: 12, fontWeight: '700', marginTop: 10 },
  quickSubtitle: { color: colors.muted, fontSize: 10, marginTop: 4 },
  noticeCard: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  noticeMark: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#FFF2E6', borderWidth: 8, borderColor: '#FFF8F1' },
  noticeCopy: { flex: 1, marginLeft: 12 },
  noticeTitle: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  noticeSubtitle: { color: colors.muted, fontSize: 10, marginTop: 5 },
  demoNote: { color: colors.muted, fontSize: 10, textAlign: 'center', marginTop: 18 },
});
