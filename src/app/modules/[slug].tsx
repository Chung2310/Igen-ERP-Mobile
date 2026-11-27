import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { ModuleAppIcon } from '@/components/ModuleAppIcons';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/core/auth/AuthProvider';
import { getFeatureScreen } from '@/features/modules/featureScreenRegistry';
import { canAccessModule, getModuleBySlug } from '@/features/modules/moduleCatalog';
import { Check } from 'lucide-react-native';
import { colors } from '@/theme/colors';

export default function ModuleScaffoldScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { user, isLoading } = useAuth();
  const module = getModuleBySlug(slug);

  if (isLoading) {
    return <Screen><View style={styles.missing}><ActivityIndicator color={colors.primary} /></View></Screen>;
  }

  if (module && !canAccessModule(user, module.slug)) {
    return <Redirect href="/(tabs)/modules" />;
  }

  if (!module) {
    return <Screen><View style={styles.missing}><Text style={styles.title}>Không tìm thấy phân hệ</Text><Text style={styles.body}>Phân hệ này chưa được khai báo trong danh mục ứng dụng.</Text></View></Screen>;
  }

  const FeatureScreen = getFeatureScreen(module.slug);
  if (FeatureScreen) {
    return (
      <Screen edges={['quotes', 'inventory', 'repair-warranty', 'retail-sales', 'users', 'retail-partners', 'labor-partners', 'student-partners', 'worker-management', 'student-management', 'customer-management'].includes(module.slug) ? ['left', 'right'] : undefined}>
        <Stack.Screen options={module.slug === 'resources' ? { headerShown: false } : { headerShown: true, title: module.name, headerBackTitle: 'Trở lại', headerTintColor: colors.ink }} />
        <FeatureScreen module={module} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: module.name }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.icon}><ModuleAppIcon slug={module.slug} size={54} /></View>
        <Text style={styles.category}>{module.category.toLocaleUpperCase('vi')} · ĐỢT 1</Text>
        <Text style={styles.title}>{module.name}</Text>
        <Text style={styles.body}>{module.description}</Text>
        <Card style={styles.scaffoldCard}>
          <View style={styles.statusDot} />
          <View style={styles.statusCopy}><Text style={styles.statusTitle}>Đã có trong khung ứng dụng</Text><Text style={styles.statusBody}>Màn hình nghiệp vụ và kết nối dữ liệu sẽ được phát triển theo cấu trúc riêng của phân hệ này.</Text></View>
        </Card>
        <Text style={styles.sectionTitle}>Phạm vi dự kiến</Text>
        {module.capabilities.map((capability) => (
          <View key={capability} style={styles.capability}><Check size={14} color="#16885A" style={styles.check} /><Text style={styles.capabilityText}>{capability}</Text></View>
        ))}
        <Text style={styles.footer}>Các dữ liệu hiển thị ở bản khung chưa kết nối ERP thật.</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: 22 },
  missing: { flex: 1, justifyContent: 'center', padding: 24 },
  icon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  category: { color: colors.primary, fontSize: 9, fontWeight: '800', letterSpacing: 1.1, marginTop: 19 },
  title: { color: colors.ink, fontSize: 25, fontWeight: '800', marginTop: 6 },
  body: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 8 },
  scaffoldCard: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, marginTop: 22, backgroundColor: '#EEF4FF', borderColor: '#DDE9FF' },
  statusDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary, marginTop: 4 },
  statusCopy: { flex: 1, marginLeft: 10 },
  statusTitle: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  statusBody: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 5 },
  sectionTitle: { color: colors.ink, fontSize: 14, fontWeight: '800', marginTop: 26, marginBottom: 12 },
  capability: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 11 },
  check: { marginRight: 9, marginTop: 1 },
  capabilityText: { color: colors.ink, fontSize: 12, flex: 1, lineHeight: 18 },
  footer: { color: colors.muted, textAlign: 'center', fontSize: 10, lineHeight: 16, marginTop: 24, marginBottom: 20 },
});
