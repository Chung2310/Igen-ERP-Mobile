import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ModuleAppIcon } from '@/components/ModuleAppIcons';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/core/auth/AuthProvider';
import { canAccessModule, moduleCatalog } from '@/features/modules/moduleCatalog';
import { colors } from '@/theme/colors';

export default function ModulesScreen() {
  const { user } = useAuth();
  const visibleModules = moduleCatalog.filter((module) => canAccessModule(user, module.slug));

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Danh mục</Text>
        </View>

        <View style={styles.gridCard}>
          <View style={styles.grid}>
            {visibleModules.map((module) => (
              <Link
                key={module.slug}
                href={{ pathname: '/modules/[slug]', params: { slug: module.slug } }}
                asChild
              >
                <Pressable
                  style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
                  accessibilityRole="button"
                  accessibilityLabel={module.name}
                >
                  <View style={styles.iconShadow}>
                    <ModuleAppIcon slug={module.slug} size={54} />
                  </View>
                  <Text numberOfLines={2} style={styles.moduleName}>
                    {module.name}
                  </Text>
                </Pressable>
              </Link>
            ))}
          </View>
        </View>

        <Text style={styles.note}>Module hiển thị theo gói dịch vụ và quyền được cấp.</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 28,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 14,
  },
  title: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  gridCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingTop: 22,
    paddingBottom: 20,
    paddingHorizontal: 8,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 22,
  },
  item: {
    width: '25%',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  itemPressed: {
    opacity: 0.76,
    transform: [{ scale: 0.94 }],
  },
  iconShadow: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    borderRadius: 16,
  },
  moduleName: {
    marginTop: 9,
    color: '#1F2937',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    textAlign: 'center',
  },
  note: {
    color: colors.muted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 16,
  },
});
