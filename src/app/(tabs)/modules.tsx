import { Link } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/core/auth/AuthProvider';
import { canAccessModule, isModuleVisibleForTenant, moduleCatalog } from '@/features/modules/moduleCatalog';
import { LockKeyhole } from 'lucide-react-native';
import { colors } from '@/theme/colors';

const tileColors = ['#F0E5D9', '#E4DEF5', '#F7EAC5', '#DCE8FA', '#E3E3F5', '#F1E2D7', '#DBE8FB', '#DCEFD7'];

export default function ModulesScreen() {
  const { user } = useAuth();
  const visibleModules = moduleCatalog.filter((module) => isModuleVisibleForTenant(user, module.slug));

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Danh mục</Text>
        <View style={styles.grid}>
          {visibleModules.map((module, index) => {
            const ModuleIcon = module.icon;
            const locked = !canAccessModule(user, module.slug);
            const tile = <Card key={module.slug} style={StyleSheet.flatten([styles.tile, { backgroundColor: tileColors[index % tileColors.length] }, locked && styles.lockedTile])}>
                <View style={styles.artCircle} />
                <ModuleIcon size={35} color={locked ? colors.muted : colors.primary} style={styles.illustration} />
                {locked ? <LockKeyhole size={14} color={colors.muted} style={styles.lockIcon} /> : null}
                <Text numberOfLines={2} style={styles.moduleName}>{module.name}</Text>
              </Card>;
            return locked ? tile : <Link key={module.slug} href={{ pathname: '/modules/[slug]', params: { slug: module.slug } }} asChild>{tile}</Link>;
          })}
        </View>
        <Text style={styles.note}>Module hiển thị theo gói dịch vụ và quyền được cấp.</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 26 },
  title: { color: colors.ink, fontSize: 25, fontWeight: '800', marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 11 },
  tile: { width: '48.5%', height: 151, padding: 14, borderColor: 'transparent', overflow: 'hidden', justifyContent: 'flex-end' },
  artCircle: { position: 'absolute', width: 105, height: 105, borderRadius: 53, right: -19, top: -13, backgroundColor: 'rgba(255,255,255,0.32)' },
  illustration: { position: 'absolute', right: 20, top: 22 },
  lockIcon: { position: 'absolute', left: 14, top: 14 },
  lockedTile: { opacity: 0.66 },
  moduleName: { color: '#263247', fontSize: 12, fontWeight: '700', lineHeight: 16, maxWidth: '94%' },
  note: { color: colors.muted, fontSize: 9, textAlign: 'center', marginTop: 16 },
});
