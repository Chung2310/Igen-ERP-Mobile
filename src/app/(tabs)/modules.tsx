import { useCallback, useEffect, useState } from 'react';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Check, LockKeyhole } from 'lucide-react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { ModuleAppIcon } from '@/components/ModuleAppIcons';
import {
  IgenAssistantAvatarIcon,
  OverviewNotificationAvatarIcon,
} from '@/components/OverviewTabIcons';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/core/auth/AuthProvider';
import {
  getUserNotifications,
  subscribeUnreadNotificationCount,
} from '@/features/notifications/notificationsApi';
import {
  authenticateBiometric,
  biometricErrorMessage,
  getBiometricAvailability,
  isBiometricCancellation,
} from '@/core/auth/biometricAuth';
import {
  getTodayTimekeeping,
  listHrBranches,
  submitCheckIn,
  submitCheckOut,
  type TodayTimekeepingData,
} from '@/features/hr/hrApi';
import type { HrBranch } from '@/features/hr/types';
import {
  canAccessModule,
  isModuleVisibleForTenant,
  moduleCatalog,
  type ModuleDefinition,
} from '@/features/modules/moduleCatalog';
import { colors } from '@/theme/colors';

const COLUMNS = 4;

type GridTile =
  | { kind: 'attendance' }
  | { kind: 'module'; module: ModuleDefinition };

function chunkRows(items: GridTile[]): Array<Array<GridTile | null>> {
  const rows: Array<Array<GridTile | null>> = [];
  for (let index = 0; index < items.length; index += COLUMNS) {
    const slice: Array<GridTile | null> = items.slice(index, index + COLUMNS);
    while (slice.length < COLUMNS) {
      slice.push(null);
    }
    rows.push(slice);
  }
  return rows;
}

function formatCheckTime(value?: string | null): string {
  if (!value) return '--:--';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function ModulesScreen() {
  const router = useRouter();
  const { user, activeBranchId, setActiveBranchId, biometricSettings } = useAuth();
  const [branches, setBranches] = useState<HrBranch[]>([]);
  const [attendance, setAttendance] = useState<TodayTimekeepingData | null>(null);
  const [checking, setChecking] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    let active = true;
    void getUserNotifications({ page: 1, limit: 1 })
      .then((res) => {
        if (active) setUnreadNotifications(res.unreadCount || 0);
      })
      .catch(() => {});
    const sub = subscribeUnreadNotificationCount(setUnreadNotifications);
    return () => {
      active = false;
      sub.remove();
    };
  }, [user?.id, user?._id]);

  const isBranchSelectable = user?.role === 'admin' && !user?.branchId;
  const effectiveBranchId = user?.branchId || activeBranchId || branches[0]?._id;
  const userId = user?.id || user?._id;

  useEffect(() => {
    if (!isBranchSelectable) return;
    let active = true;
    listHrBranches()
      .then((items) => {
        if (!active) return;
        const activeBranches = items.filter((b) => b.isActive !== false);
        setBranches(activeBranches);
        if (
          activeBranches.length > 0 &&
          (!activeBranchId || !activeBranches.some((b) => b._id === activeBranchId))
        ) {
          setActiveBranchId(activeBranches[0]._id);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [activeBranchId, isBranchSelectable, setActiveBranchId]);

  const loadAttendance = useCallback(async () => {
    try {
      const data = await getTodayTimekeeping({
        uid: userId,
        companyCode: user?.companyCode,
        branchId: effectiveBranchId,
      });
      setAttendance((prev) => {
        if (!data.log && prev?.log?.checkOut?.time && prev.log.date === data.workCalendar?.date) {
          return { log: prev.log, workCalendar: data.workCalendar ?? prev.workCalendar };
        }
        return data;
      });
    } catch {
      // Giữ trạng thái hiện tại nếu tạm mất kết nối
    }
  }, [effectiveBranchId, user?.companyCode, userId]);

  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => {
        void loadAttendance();
      }, 220);
      return () => clearTimeout(timer);
    }, [loadAttendance]),
  );

  const hasCheckIn = Boolean(attendance?.log?.checkIn?.time);
  const hasCheckOut = Boolean(attendance?.log?.checkOut?.time);

  const onQuickAttendancePress = useCallback(async () => {
    if (checking) return;

    if (hasCheckIn && hasCheckOut) {
      Alert.alert(
        'Đã hoàn thành chấm công hôm nay',
        `Giờ vào: ${formatCheckTime(attendance?.log?.checkIn?.time)}\nGiờ ra: ${formatCheckTime(attendance?.log?.checkOut?.time)}`,
      );
      return;
    }

    const type: 'in' | 'out' = hasCheckIn ? 'out' : 'in';
    setChecking(true);
    try {
      if (biometricSettings.attendanceEnabled) {
        const availability = await getBiometricAvailability('attendanceEnabled');
        if (!availability.available) {
          throw new Error(availability.message || 'Thiết bị chưa sẵn sàng cho xác thực chấm công.');
        }

        const result = await authenticateBiometric(
          'attendanceEnabled',
          type === 'in' ? 'Xác thực khuôn mặt để check-in' : 'Xác thực khuôn mặt để check-out',
        );
        if (!result.success) {
          if (isBiometricCancellation(result)) return;
          throw new Error(biometricErrorMessage(result.error));
        }
      }

      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert(
          'Chưa có quyền vị trí',
          'Vui lòng cấp quyền truy cập vị trí (GPS) để thực hiện chấm công.',
        );
        return;
      }

      let position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      }).catch(() => null);

      if (!position) {
        position = await Location.getLastKnownPositionAsync().catch(() => null);
      }

      if (!position) {
        Alert.alert(
          'Không xác định được vị trí',
          'Không thể lấy tọa độ GPS hiện tại. Hãy bật định vị và thử lại.',
        );
        return;
      }

      const payload = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        deviceInfo: `ERP-Mobile (${Platform.OS} ${String(Platform.Version)})`,
      };

      const res =
        type === 'in'
          ? await submitCheckIn(effectiveBranchId, payload)
          : await submitCheckOut(effectiveBranchId, payload);

      if (res?.data) {
        setAttendance((prev) => ({
          log: res.data ?? prev?.log ?? null,
          workCalendar: prev?.workCalendar ?? null,
        }));
      }

      Alert.alert(
        type === 'in' ? 'Check-in thành công' : 'Check-out thành công',
        res?.message || 'Đã ghi nhận chấm công lên hệ thống ERP.',
      );
      await loadAttendance();
    } catch (err) {
      Alert.alert(
        type === 'in' ? 'Không thể check-in' : 'Không thể check-out',
        err instanceof Error ? err.message : 'Vui lòng kiểm tra vị trí, Wi-Fi chi nhánh và thử lại.',
      );
    } finally {
      setChecking(false);
    }
  }, [
    attendance?.log?.checkIn?.time,
    attendance?.log?.checkOut?.time,
    biometricSettings.attendanceEnabled,
    checking,
    effectiveBranchId,
    hasCheckIn,
    hasCheckOut,
    loadAttendance,
  ]);

  const visibleModules = moduleCatalog.filter((module) =>
    module.slug !== 'ai-plans' && isModuleVisibleForTenant(user, module.slug),
  );
  const tiles: GridTile[] = [
    { kind: 'attendance' },
    ...visibleModules.map((module): GridTile => ({ kind: 'module', module })),
  ];
  const rows = chunkRows(tiles);

  const attendanceLabel = checking
    ? 'Đang chấm...'
    : hasCheckIn && hasCheckOut
      ? 'Đã chấm công'
      : hasCheckIn
        ? 'Check-out'
        : 'Chấm công';

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
            <View style={styles.topRightActions}>
              <Link href="/assistant-chat" asChild>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Mở trợ lý iGen AI"
                  style={({ pressed }) => [styles.assistantBtn, pressed && styles.assistantBtnPressed]}
                >
                  <IgenAssistantAvatarIcon size={38} />
                </Pressable>
              </Link>
              <Link href="/notifications" asChild>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Mở thông báo"
                  style={({ pressed }) => [styles.notifBtn, pressed && styles.assistantBtnPressed]}
                >
                  <OverviewNotificationAvatarIcon size={38} />
                  {unreadNotifications > 0 ? (
                    <View style={styles.notifBadge}>
                      <Text style={styles.notifBadgeText}>
                        {unreadNotifications > 9 ? '9+' : unreadNotifications}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              </Link>
            </View>
          </View>

          <View style={styles.gridCard}>
            {rows.map((row, rowIndex) => (
              <View
                key={`row-${rowIndex}`}
                style={[styles.row, rowIndex < rows.length - 1 && styles.rowSpacing]}
              >
                {row.map((tile, colIndex) => {
                  if (!tile) {
                    return <View key={`empty-${rowIndex}-${colIndex}`} style={styles.cell} />;
                  }

                  if (tile.kind === 'attendance') {
                    return (
                      <View key="quick-attendance" style={styles.cell}>
                        <Pressable
                          disabled={checking}
                          onPress={() => void onQuickAttendancePress()}
                          style={({ pressed }) => [
                            styles.itemButton,
                            pressed && !checking && styles.itemPressed,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={attendanceLabel}
                        >
                          <View style={styles.iconWrap}>
                            <ModuleAppIcon slug="quick-attendance" size={48} />
                            {checking ? (
                              <View style={styles.checkingOverlay}>
                                <ActivityIndicator size="small" color={colors.white} />
                              </View>
                            ) : hasCheckIn ? (
                              <View
                                style={[
                                  styles.statusDotBadge,
                                  hasCheckOut ? styles.statusDotDone : styles.statusDotActive,
                                ]}
                              >
                                <Check size={10} color={colors.white} strokeWidth={2.8} />
                              </View>
                            ) : null}
                          </View>
                          <Text numberOfLines={2} style={styles.moduleName}>
                            {attendanceLabel}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  }

                  const { module } = tile;
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
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: -1,
    right: -2,
    minWidth: 17,
    height: 17,
    borderRadius: 8.5,
    paddingHorizontal: 4,
    backgroundColor: '#D92D20',
    borderWidth: 1.5,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBadgeText: {
    color: colors.white,
    fontSize: 9,
    lineHeight: 10.5,
    fontWeight: '700',
  },
  assistantBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assistantBtnPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.94 }],
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
  checkingOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 13,
    backgroundColor: 'rgba(15, 23, 42, 0.36)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDotBadge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDotActive: {
    backgroundColor: '#16A34A',
  },
  statusDotDone: {
    backgroundColor: colors.primary,
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
