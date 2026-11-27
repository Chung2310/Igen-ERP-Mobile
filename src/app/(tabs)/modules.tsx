import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LockKeyhole } from 'lucide-react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
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
    <Screen backgroundColor="#D8EFFC">
      <View style={styles.backdropWrap}>
        <Svg
          pointerEvents="none"
          width="100%"
          height="100%"
          viewBox="0 0 360 760"
          preserveAspectRatio="none"
          style={StyleSheet.absoluteFill}
        >
          <Defs>
            <LinearGradient id="modulesBg" x1="0" y1="0" x2="0.15" y2="1">
              <Stop offset="0" stopColor="#D8EFFC" stopOpacity="1" />
              <Stop offset="0.32" stopColor="#EAF2FB" stopOpacity="1" />
              <Stop offset="0.7" stopColor="#F1F5FB" stopOpacity="1" />
              <Stop offset="1" stopColor="#F5F7FC" stopOpacity="1" />
            </LinearGradient>
            <RadialGradient id="modulesGlowTopRight" cx="86%" cy="7%" rx="52%" ry="24%">
              <Stop offset="0" stopColor="#8FD3FA" stopOpacity="0.48" />
              <Stop offset="1" stopColor="#8FD3FA" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="modulesGlowMidLeft" cx="10%" cy="42%" rx="48%" ry="26%">
              <Stop offset="0" stopColor="#E4DCFF" stopOpacity="0.32" />
              <Stop offset="1" stopColor="#E4DCFF" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="360" height="760" fill="url(#modulesBg)" />
          <Rect x="0" y="0" width="360" height="760" fill="url(#modulesGlowTopRight)" />
          <Rect x="0" y="0" width="360" height="760" fill="url(#modulesGlowMidLeft)" />
          <Path
            d="M 180 155 C 235 112, 294 102, 360 74 L 360 155 Z"
            fill="#2463EB"
            fillOpacity={0.04}
          />
          <Circle
            cx="328"
            cy="22"
            r="62"
            fill="none"
            stroke="#2463EB"
            strokeOpacity={0.075}
            strokeWidth={1.2}
          />
          <Circle
            cx="328"
            cy="22"
            r="38"
            fill="none"
            stroke="#2463EB"
            strokeOpacity={0.065}
            strokeWidth={1}
          />
          <Circle cx="242" cy="26" r="2.2" fill="#2463EB" fillOpacity={0.11} />
          <Circle cx="256" cy="18" r="1.8" fill="#2463EB" fillOpacity={0.08} />
          <Circle cx="254" cy="34" r="1.6" fill="#2463EB" fillOpacity={0.09} />
          <Circle cx="268" cy="28" r="2" fill="#2463EB" fillOpacity={0.07} />
          <Circle
            cx="22"
            cy="318"
            r="52"
            fill="none"
            stroke="#7C3AED"
            strokeOpacity={0.045}
            strokeWidth={1.1}
          />
        </Svg>
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
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backdropWrap: {
    flex: 1,
  },
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
