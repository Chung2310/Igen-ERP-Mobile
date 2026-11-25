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
                  <ModuleAppIcon slug={module.slug} size={46} />
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
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  gridCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingTop: 22,
    paddingBottom: 20,
    paddingHorizontal: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 20,
  },
  item: {
    width: '25%',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  itemPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.94 }],
  },
  moduleName: {
    marginTop: 7,
    color: '#2B3445',
    fontSize: 11.5,
    fontWeight: '400',
    lineHeight: 15,
    textAlign: 'center',
  },
  note: {
    color: colors.muted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 16,
  },
});
