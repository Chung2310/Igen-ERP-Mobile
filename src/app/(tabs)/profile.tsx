import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import * as Location from 'expo-location';
import {
  Bell,
  Building2,
  ChevronRight,
  CircleHelp,
  Clock,
  Eye,
  Fingerprint,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react-native';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/core/auth/AuthProvider';
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
import { colors } from '@/theme/colors';

const settings = [
  { key: 'notifications', label: 'Thông báo', icon: Bell, detail: 'Tin nhắn, công việc và nhắc hạn' },
  { key: 'security', label: 'Bảo mật đăng nhập', icon: ShieldCheck, detail: 'Mật khẩu và thiết bị đăng nhập' },
  { key: 'permissions', label: 'Quyền ứng dụng', icon: Fingerprint, detail: 'Camera, ảnh và sinh trắc học' },
  { key: 'privacy', label: 'Quyền riêng tư', icon: Eye, detail: 'Dữ liệu cá nhân và yêu cầu xóa' },
  { key: 'support', label: 'Trợ giúp và hỗ trợ', icon: CircleHelp, detail: 'Liên hệ bộ phận hỗ trợ' },
] as const;

function formatCheckTime(value?: string | null): string {
  if (!value) return '--:--';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatTodayVi(): string {
  const now = new Date();
  const weekdays = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${weekdays[now.getDay()]}, ${day}/${month}/${now.getFullYear()}`;
}

function getAttendanceBadge(data: TodayTimekeepingData | null): {
  label: string;
  bg: string;
  text: string;
} {
  const log = data?.log;
  const hasIn = Boolean(log?.checkIn?.time);
  const hasOut = Boolean(log?.checkOut?.time);
  if (hasIn && hasOut) {
    return { label: 'Đã hoàn thành', bg: '#EAF2FF', text: colors.primary };
  }
  if (hasIn) {
    if (log?.status === 'Late') {
      return { label: 'Đã check-in (Muộn)', bg: '#FFF3E5', text: '#C27617' };
    }
    return { label: 'Đã check-in', bg: '#E9F8F1', text: '#16885A' };
  }
  if (data?.workCalendar && !data.workCalendar.isWorkingDay) {
    return { label: data.workCalendar.label || 'Ngày nghỉ', bg: '#F0F4FA', text: colors.muted };
  }
  return { label: 'Chưa chấm công', bg: '#FCEBEC', text: '#C74848' };
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut, activeBranchId, setActiveBranchId, biometricSettings } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const [branches, setBranches] = useState<HrBranch[]>([]);
  const [attendance, setAttendance] = useState<TodayTimekeepingData | null>(null);
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checking, setChecking] = useState<'in' | 'out' | null>(null);

  const isBranchSelectable = user?.role === 'admin' && !user?.branchId;
  const effectiveBranchId = user?.branchId || activeBranchId || branches[0]?._id;

  useEffect(() => {
    if (!isBranchSelectable) return;
    let active = true;
    listHrBranches()
      .then((items) => {
        if (!active) return;
        const activeBranches = items.filter((b) => b.isActive !== false);
        setBranches(activeBranches);
        if (activeBranches.length > 0 && (!activeBranchId || !activeBranches.some((b) => b._id === activeBranchId))) {
          setActiveBranchId(activeBranches[0]._id);
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [activeBranchId, isBranchSelectable, setActiveBranchId]);

  const userId = user?.id || user?._id;

  const loadAttendance = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoadingAttendance(true);
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
    } finally {
      setLoadingAttendance(false);
      setRefreshing(false);
    }
  }, [effectiveBranchId, user?.companyCode, userId]);

  useEffect(() => {
    void loadAttendance();
  }, [loadAttendance]);

  const handleAttendanceAction = useCallback(
    async (type: 'in' | 'out') => {
      setChecking(type);
      try {
        if (biometricSettings.attendanceEnabled) {
          const availability = await getBiometricAvailability('attendanceEnabled');
          if (!availability.available) throw new Error(availability.message || 'Thiết bị chưa sẵn sàng cho xác thực chấm công.');

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
        setChecking(null);
      }
    },
    [biometricSettings.attendanceEnabled, effectiveBranchId, loadAttendance],
  );

  async function onSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      Alert.alert('Đã đăng xuất trên thiết bị', 'Không thể xác nhận đăng xuất với máy chủ ERP.');
    } finally {
      setSigningOut(false);
    }
  }

  const hasCheckIn = Boolean(attendance?.log?.checkIn?.time);
  const hasCheckOut = Boolean(attendance?.log?.checkOut?.time);
  const badge = getAttendanceBadge(attendance);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadAttendance(true)}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={styles.title}>Cài đặt cá nhân</Text>
        <Card
          onPress={() => router.push('/profile/account' as Href)}
          style={styles.profileCard}
        >
          <View style={styles.avatar}>
            {user?.photoURL ? (
              <Image source={{ uri: user.photoURL }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{getInitials(user?.displayName)}</Text>
            )}
          </View>
          <View style={styles.profileCopy}>
            <Text numberOfLines={1} style={styles.name}>{user?.displayName ?? 'Người dùng ERP'}</Text>
            <Text numberOfLines={1} style={styles.email}>{user?.email ?? ''}</Text>
            <Text numberOfLines={1} style={styles.company}>
              {user?.companyName || user?.companyCode || 'Igen ERP'} · {user?.role ?? ''}
            </Text>
          </View>
          <ChevronRight size={17} color={colors.muted} />
        </Card>

        <Text style={styles.section}>CHẤM CÔNG HÔM NAY</Text>
        <Card style={styles.attendanceCard}>
          <View style={styles.attendanceHeader}>
            <View style={styles.attendanceTitleRow}>
              <View style={styles.attendanceIcon}>
                <Clock size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.attendanceDate}>{formatTodayVi()}</Text>
                {attendance?.log?.shiftName ? (
                  <Text numberOfLines={1} style={styles.attendanceShift}>
                    Ca: {attendance.log.shiftName}
                  </Text>
                ) : null}
              </View>
            </View>
            <View style={styles.attendanceHeaderRight}>
              <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                <Text style={[styles.statusBadgeText, { color: badge.text }]}>{badge.label}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tải lại trạng thái chấm công"
                disabled={loadingAttendance || checking !== null}
                onPress={() => void loadAttendance()}
                style={styles.refreshIconBtn}
              >
                {loadingAttendance ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <RefreshCw size={14} color={colors.muted} />
                )}
              </Pressable>
            </View>
          </View>

          {isBranchSelectable && branches.length > 0 ? (
            <View style={styles.branchPickerRow}>
              <View style={styles.branchPickerLabelRow}>
                <Building2 size={12} color={colors.muted} />
                <Text style={styles.branchPickerLabel}>Chi nhánh chấm công:</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.branchChips}>
                {branches.map((branch) => {
                  const selected = branch._id === effectiveBranchId;
                  return (
                    <Pressable
                      key={branch._id}
                      onPress={() => setActiveBranchId(branch._id)}
                      style={[styles.branchChip, selected && styles.branchChipActive]}
                    >
                      <Text style={[styles.branchChipText, selected && styles.branchChipTextActive]}>
                        {branch.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          <View style={styles.timeGrid}>
            <View style={styles.timeBox}>
              <Text style={styles.timeLabel}>Giờ vào</Text>
              <Text style={styles.timeValue}>
                {formatCheckTime(attendance?.log?.checkIn?.time)}
              </Text>
            </View>
            <View style={styles.timeBox}>
              <Text style={styles.timeLabel}>Giờ ra</Text>
              <Text style={styles.timeValue}>
                {formatCheckTime(attendance?.log?.checkOut?.time)}
              </Text>
            </View>
          </View>

          <View style={styles.checkActions}>
            <Pressable
              accessibilityRole="button"
              disabled={checking !== null || hasCheckIn}
              onPress={() => void handleAttendanceAction('in')}
              style={[
                styles.checkInBtn,
                (checking !== null || hasCheckIn) && styles.btnDisabled,
              ]}
            >
              {checking === 'in' ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <LogIn size={15} color={colors.white} />
              )}
              <Text numberOfLines={1} style={[styles.checkInText, biometricSettings.attendanceEnabled && styles.biometricCheckText]}>
                {checking === 'in'
                  ? 'Đang xử lý...'
                  : hasCheckIn
                    ? 'Đã Check-in'
                    : biometricSettings.attendanceEnabled
                      ? Platform.OS === 'ios' ? 'Check-in · Face ID' : 'Check-in · Khuôn mặt'
                      : 'Check-in'}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={checking !== null || !hasCheckIn || hasCheckOut}
              onPress={() => void handleAttendanceAction('out')}
              style={[
                styles.checkOutBtn,
                (checking !== null || !hasCheckIn || hasCheckOut) && styles.btnDisabled,
              ]}
            >
              {checking === 'out' ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <LogOut size={15} color={colors.primary} />
              )}
              <Text numberOfLines={1} style={[styles.checkOutText, biometricSettings.attendanceEnabled && styles.biometricCheckText]}>
                {checking === 'out'
                  ? 'Đang xử lý...'
                  : hasCheckOut
                    ? 'Đã Check-out'
                    : biometricSettings.attendanceEnabled
                      ? Platform.OS === 'ios' ? 'Check-out · Face ID' : 'Check-out · Khuôn mặt'
                      : 'Check-out'}
              </Text>
            </Pressable>
          </View>
        </Card>

        <Text style={styles.section}>TÀI KHOẢN &amp; ỨNG DỤNG</Text>
        <View style={styles.list}>
          {settings.map((item) => {
            const Icon = item.icon;
            return (
              <Card
                key={item.key}
                onPress={() => router.push(`/profile/${item.key}` as Href)}
                style={styles.row}
              >
                <View style={styles.rowIcon}>
                  <Icon size={17} color={colors.primary} />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowLabel}>{item.label}</Text>
                  <Text style={styles.rowDetail}>{item.detail}</Text>
                </View>
                <ChevronRight size={17} color={colors.muted} />
              </Card>
            );
          })}
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={signingOut}
          onPress={() => { void onSignOut(); }}
          style={styles.signOutButton}
        >
          {signingOut ? (
            <ActivityIndicator size="small" color="#C74848" />
          ) : (
            <Text style={styles.signOut}>Đăng xuất</Text>
          )}
        </Pressable>
        <Text style={styles.version}>ERP Mobile · Kết nối Igen ERP</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: 14, paddingBottom: 28 },
  title: { color: colors.ink, fontSize: 25, fontWeight: '800', marginBottom: 16 },
  profileCard: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  profileCopy: { flex: 1 },
  avatar: { width: 54, height: 54, borderRadius: 18, backgroundColor: '#DCE8FF', alignItems: 'center', justifyContent: 'center', marginRight: 13, overflow: 'hidden' },
  avatarImage: { width: 54, height: 54 },
  avatarText: { color: colors.primary, fontWeight: '800', fontSize: 15 },
  name: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  email: { color: colors.muted, fontSize: 11, marginTop: 3 },
  company: { color: colors.primary, fontSize: 10, fontWeight: '600', marginTop: 6 },
  section: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1, marginTop: 22, marginBottom: 10 },
  attendanceCard: { padding: 14, gap: 12 },
  attendanceHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  attendanceTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  attendanceIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' },
  attendanceDate: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  attendanceShift: { color: colors.muted, fontSize: 10, marginTop: 2 },
  attendanceHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },
  refreshIconBtn: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F7FC' },
  branchPickerRow: { gap: 6 },
  branchPickerLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  branchPickerLabel: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  branchChips: { gap: 6 },
  branchChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: '#F0F4FA', borderWidth: 1, borderColor: 'transparent' },
  branchChipActive: { backgroundColor: '#EAF2FF', borderColor: colors.primary },
  branchChipText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  branchChipTextActive: { color: colors.primary, fontWeight: '700' },
  timeGrid: { flexDirection: 'row', gap: 10 },
  timeBox: { flex: 1, backgroundColor: '#F6F8FC', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  timeLabel: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  timeValue: { color: colors.ink, fontSize: 16, fontWeight: '800', marginTop: 3 },
  checkActions: { flexDirection: 'row', gap: 10 },
  checkInBtn: { flex: 1, minHeight: 42, borderRadius: 12, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  checkInText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  biometricCheckText: { fontSize: 10 },
  checkOutBtn: { flex: 1, minHeight: 42, borderRadius: 12, backgroundColor: '#EAF2FF', borderWidth: 1, borderColor: '#C9DDFD', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  checkOutText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  btnDisabled: { opacity: 0.45 },
  list: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  rowIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#F0F4FA', alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, marginLeft: 11 },
  rowLabel: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  rowDetail: { color: colors.muted, fontSize: 10, marginTop: 3 },
  signOutButton: { minHeight: 46, justifyContent: 'center', marginTop: 16, borderRadius: 13, backgroundColor: '#FCEBEC' },
  signOut: { color: '#C74848', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  version: { color: colors.muted, fontSize: 10, textAlign: 'center', marginTop: 22 },
});

function getInitials(name?: string) {
  return name?.trim().split(/\s+/).slice(-2).map((part) => part[0]?.toLocaleUpperCase('vi')).join('') || 'ERP';
}
