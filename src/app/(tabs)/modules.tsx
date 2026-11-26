import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LockKeyhole } from 'lucide-react-native';
import { ModuleAppIcon } from '@/components/ModuleAppIcons';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/core/auth/AuthProvider';
import {
  canAccessModule,
  isModuleVisibleForTenant,
  moduleCatalog,
  type ModuleDefinition,
} from '@/features/modules/moduleCatalog';
import { colors } from '@/theme/colors';

const COLUMNS = 4;

function chunkRows(items: ModuleDefinition[]): Array<Array<ModuleDefinition | null>> {
  const rows: Array<Array<ModuleDefinition | null>> = [];
  for (let index = 0; index < items.length; index += COLUMNS) {
    const slice: Array<ModuleDefinition | null> = items.slice(index, index + COLUMNS);
    while (slice.length < COLUMNS) {
      slice.push(null);
    }
    rows.push(slice);
  }
  return rows;
}

export default function ModulesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const visibleModules = moduleCatalog.filter((module) =>
    isModuleVisibleForTenant(user, module.slug),
  );
  const rows = chunkRows(visibleModules);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Tính năng</Text>
        </View>

        <View style={styles.gridCard}>
          {rows.map((row, rowIndex) => (
            <View
              key={`row-${rowIndex}`}
              style={[styles.row, rowIndex < rows.length - 1 && styles.rowSpacing]}
            >
              {row.map((module, colIndex) => {
                if (!module) {
                  return <View key={`empty-${rowIndex}-${colIndex}`} style={styles.cell} />;
                }

                const label = module.shortName ?? module.name;
                const locked = !canAccessModule(user, module.slug);
                return (
                  <View key={module.slug} style={styles.cell}>
                    <Pressable
                      disabled={locked}
                      onPress={() =>
                        router.push({ pathname: '/modules/[slug]', params: { slug: module.slug } })
                      }
                      style={({ pressed }) => [
                        styles.itemButton,
                        locked && styles.itemLocked,
                        pressed && !locked && styles.itemPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={module.name}
                    >
                      <View style={styles.iconWrap}>
                        <ModuleAppIcon slug={module.slug} size={48} />
                        {locked ? (
                          <View style={styles.lockBadge}>
                            <LockKeyhole size={11} color={colors.muted} />
                          </View>
                        ) : null}
                      </View>
                      <Text numberOfLines={2} style={styles.moduleName}>
                        {label}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
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
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5EAF2',
    paddingTop: 22,
    paddingBottom: 20,
    paddingHorizontal: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
  },
  rowSpacing: {
    marginBottom: 24,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  itemButton: {
    width: '100%',
    alignItems: 'center',
  },
  itemLocked: {
    opacity: 0.55,
  },
  itemPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.94 }],
  },
  iconWrap: {
    position: 'relative',
  },
  lockBadge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DCE3EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleName: {
    marginTop: 8,
    width: '100%',
    color: '#2B3445',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    textAlign: 'center',
  },
});
