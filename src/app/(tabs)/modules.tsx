import { Link } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { moduleCatalog } from '@/features/modules/moduleCatalog';
import { colors } from '@/theme/colors';

const illustrations: Record<string, string> = {
  crm: '💬', knowledge: '📚', overview: '📊', integrations: '🔗', 'ai-plans': '✨', users: '👥',
  settings: '⚙️', hr: '🧑‍💼', resources: '📁', chat: '💭', partners: '🤝', quotes: '🧾',
  assistant: '✦', analytics: '📈', inventory: '📦',
};

const tileColors = ['#F0E5D9', '#E4DEF5', '#F7EAC5', '#DCE8FA', '#E3E3F5', '#F1E2D7', '#DBE8FB', '#DCEFD7'];

export default function ModulesScreen() {
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>IGEN ERP</Text>
            <Text style={styles.title}>Danh mục</Text>
          </View>
          <Text style={styles.more}>•••</Text>
        </View>
        <Text style={styles.subtitle}>Chọn chức năng cần dùng</Text>
        <View style={styles.grid}>
          {moduleCatalog.map((module, index) => (
            <Link key={module.slug} href={{ pathname: '/modules/[slug]', params: { slug: module.slug } }} asChild>
              <Card style={[styles.tile, { backgroundColor: tileColors[index % tileColors.length] }]}>
                <View style={styles.artCircle} />
                <Text style={styles.illustration}>{illustrations[module.slug] ?? module.icon}</Text>
                <Text numberOfLines={2} style={styles.moduleName}>{module.name}</Text>
              </Card>
            </Link>
          ))}
        </View>
        <Text style={styles.note}>Module hiển thị theo gói dịch vụ và quyền được cấp.</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 26 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { color: colors.primary, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  title: { color: colors.ink, fontSize: 25, fontWeight: '800', marginTop: 3 },
  more: { color: colors.ink, fontSize: 20, fontWeight: '700', paddingHorizontal: 8 },
  subtitle: { color: colors.muted, fontSize: 11, marginTop: 4, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 11 },
  tile: { width: '48.5%', height: 151, padding: 14, borderColor: 'transparent', overflow: 'hidden', justifyContent: 'flex-end' },
  artCircle: { position: 'absolute', width: 105, height: 105, borderRadius: 53, right: -19, top: -13, backgroundColor: 'rgba(255,255,255,0.32)' },
  illustration: { position: 'absolute', right: 20, top: 22, fontSize: 37 },
  moduleName: { color: '#263247', fontSize: 12, fontWeight: '700', lineHeight: 16, maxWidth: '94%' },
  note: { color: colors.muted, fontSize: 9, textAlign: 'center', marginTop: 16 },
});
