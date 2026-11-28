import { PrivacyControls } from "@/features/privacy/PrivacyControls";
import { PopupError } from '@/components/PopupError';
import { withAppLockSuspended } from '@/core/auth/appLockSuspension';
import { useCallback, useEffect, useState } from 'react';
import {
  AppState,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar as RnStatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import * as ExpoCamera from 'expo-camera';
import * as SecureStore from 'expo-secure-store';
import {
  Briefcase,
  Building2,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ExternalLink,
  Fingerprint,
  Globe,
  Images,
  Mail,
  Phone,
  RefreshCw,
  ShieldCheck,
  Smartphone,
} from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import {
  changeMyPassword,
  checkErpConnection,
  updateMyProfile,
  uploadMyAvatar,
  type ErpHealth,
} from '@/core/auth/authApi';
import { useAuth } from '@/core/auth/AuthProvider';
import {
  authenticateBiometric,
  biometricErrorMessage,
  getBiometricAvailability,
  isBiometricCancellation,
  type BiometricFeature,
} from '@/core/auth/biometricAuth';
import { ERP_PRIVACY_POLICY_URL, ERP_TERMS_OF_SERVICE_URL } from '@/core/network/erpWebLinks';
import { showHrConfirm } from '@/features/hr/components/HrConfirmModal';
import { colors } from '@/theme/colors';

const SECTION_TITLES: Record<string, string> = {
  account: 'Thông tin cá nhân',
  notifications: 'Thông báo',
  security: 'Bảo mật đăng nhập',
  permissions: 'Quyền ứng dụng',
  privacy: 'Quyền riêng tư',
  support: 'Trợ giúp và hỗ trợ',
};

const PREFS_KEY = 'igen_erp_mobile_prefs';

type LocalPrefs = {
  notifChat: boolean;
  notifTasks: boolean;
  notifLeaves: boolean;
  notifAttendance: boolean;
};

const DEFAULT_PREFS: LocalPrefs = {
  notifChat: true,
  notifTasks: true,
  notifLeaves: true,
  notifAttendance: true,
};

async function loadPrefs(): Promise<LocalPrefs> {
  try {
    const raw =
      Platform.OS === 'web'
        ? globalThis.localStorage?.getItem(PREFS_KEY)
        : await SecureStore.getItemAsync(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

async function savePrefs(prefs: LocalPrefs): Promise<void> {
  try {
    const raw = JSON.stringify(prefs);
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(PREFS_KEY, raw);
    } else {
      await SecureStore.setItemAsync(PREFS_KEY, raw);
    }
  } catch {
    // Ignore local storage errors
  }
}

export default function ProfileSectionScreen() {
  const { section } = useLocalSearchParams<{ section: string }>();
  const key = Array.isArray(section) ? section[0] : section || 'account';
  const title = SECTION_TITLES[key] || 'Cài đặt cá nhân';

  if (key === 'account') {
    return (
      <View style={styles.accountRoot}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScrollView contentContainerStyle={styles.accountScroll} showsVerticalScrollIndicator={false}>
          <AccountDetailSection />
        </ScrollView>
      </View>
    );
  }

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {key === 'notifications' ? (
          <NotificationsDetailSection />
        ) : key === 'security' ? (
          <SecurityDetailSection />
        ) : key === 'permissions' ? (
          <AppPermissionsDetailSection />
        ) : key === 'privacy' ? (
          <PrivacyDetailSection />
        ) : (
          <SupportDetailSection />
        )}
      </ScrollView>
    </Screen>
  );
}

type AppPermissionState = {
  granted: boolean;
  canAskAgain?: boolean;
};

function AppPermissionsDetailSection() {
  const [cameraPermission, setCameraPermission] = useState<AppPermissionState | null>(null);
  const [photoPermission, setPhotoPermission] = useState<AppPermissionState | null>(null);
  const [biometricStatus, setBiometricStatus] = useState<{ available: boolean; message?: string } | null>(null);
  const [busy, setBusy] = useState<'camera' | 'photos' | null>(null);

  const refreshPermissions = useCallback(async () => {
    try {
      const [camera, photos, biometrics] = await Promise.all([
        ExpoCamera.Camera.getCameraPermissionsAsync(),
        ImagePicker.getMediaLibraryPermissionsAsync(),
        getBiometricAvailability('loginEnabled'),
      ]);
      setCameraPermission(camera);
      setPhotoPermission(photos);
      setBiometricStatus(biometrics);
    } catch {
      setBiometricStatus({ available: false, message: 'Không kiểm tra được quyền trên thiết bị.' });
    }
  }, []);

  useEffect(() => {
    void refreshPermissions();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshPermissions();
    });
    return () => subscription.remove();
  }, [refreshPermissions]);

  const requestPermission = useCallback(async (kind: 'camera' | 'photos') => {
    if (busy) return;
    const current = kind === 'camera' ? cameraPermission : photoPermission;
    if (current?.granted || current?.canAskAgain === false) {
      try {
        await Linking.openSettings();
      } catch {
        Alert.alert('Không mở được Cài đặt', 'Hãy mở Cài đặt của thiết bị và cấp quyền cho ERP Mobile.');
      }
      return;
    }

    setBusy(kind);
    try {
      const next = kind === 'camera'
        ? await ExpoCamera.Camera.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (kind === 'camera') setCameraPermission(next);
      else setPhotoPermission(next);
    } catch (error) {
      Alert.alert('Không xin được quyền', error instanceof Error ? error.message : 'Hãy thử lại trong Cài đặt thiết bị.');
    } finally {
      setBusy(null);
    }
  }, [busy, cameraPermission, photoPermission]);

  const permissionLabel = (permission: AppPermissionState | null) => {
    if (!permission) return 'Đang kiểm tra';
    if (permission.granted) return 'Đã cấp';
    return permission.canAskAgain === false ? 'Cần bật trong Cài đặt' : 'Chưa cấp';
  };

  const permissionActionLabel = (permission: AppPermissionState | null) =>
    permission?.granted || permission?.canAskAgain === false ? 'Cài đặt' : 'Cho phép';

  return (
    <View style={styles.stack}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Quyền thiết bị</Text>
        <View style={styles.permissionRow}>
          <View style={styles.iconCircle}><Camera size={17} color={colors.primary} /></View>
          <View style={styles.permissionCopy}>
            <Text style={styles.rowTitle}>Camera</Text>
            <Text style={styles.muted}>Quét mã kiểm kê và chụp ảnh tài liệu khi dùng tính năng tương ứng.</Text>
            <Text style={[styles.permissionStatus, cameraPermission?.granted && styles.permissionGranted]}>{permissionLabel(cameraPermission)}</Text>
          </View>
          <Pressable disabled={busy !== null || Platform.OS === 'web'} onPress={() => void requestPermission('camera')} style={styles.permissionButton}>
            <Text style={styles.permissionButtonText}>{busy === 'camera' ? 'Đang xử lý…' : permissionActionLabel(cameraPermission)}</Text>
          </Pressable>
        </View>
        <View style={[styles.permissionRow, styles.lastRow]}>
          <View style={styles.iconCircle}><Images size={17} color={colors.primary} /></View>
          <View style={styles.permissionCopy}>
            <Text style={styles.rowTitle}>Ảnh và video</Text>
            <Text style={styles.muted}>Chọn ảnh đại diện hoặc hình ảnh từ thiết bị.</Text>
            <Text style={[styles.permissionStatus, photoPermission?.granted && styles.permissionGranted]}>{permissionLabel(photoPermission)}</Text>
          </View>
          <Pressable disabled={busy !== null || Platform.OS === 'web'} onPress={() => void requestPermission('photos')} style={styles.permissionButton}>
            <Text style={styles.permissionButtonText}>{busy === 'photos' ? 'Đang xử lý…' : permissionActionLabel(photoPermission)}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sinh trắc học</Text>
        <View style={[styles.permissionRow, styles.lastRow]}>
          <View style={styles.iconCircle}><Fingerprint size={17} color={colors.primary} /></View>
          <View style={styles.permissionCopy}>
            <Text style={styles.rowTitle}>Face ID, khuôn mặt hoặc vân tay</Text>
            <Text style={styles.muted}>
              {biometricStatus?.available ? 'Thiết bị đã sẵn sàng.' : biometricStatus?.message || 'Đang kiểm tra thiết bị.'}
              {' '}Quyền này được xác nhận bằng hộp thoại bảo mật của hệ điều hành, không có quyền Android riêng để cấp.
            </Text>
          </View>
        </View>
      </View>

      <BiometricSettingsCard />

      <Text style={styles.footerNote}>
        ERP Mobile chỉ xin quyền khi bạn mở tính năng cần dùng. Chọn tệp qua hộp thoại hệ thống không cần quyền lưu trữ riêng.
      </Text>
    </View>
  );
}

function BiometricSettingsCard() {
  const { biometricSettings, updateBiometricSettings } = useAuth();
  const [biometricBusy, setBiometricBusy] = useState<BiometricFeature | null>(null);

  const biometricRows: Array<{ key: BiometricFeature; title: string; description: string }> = [
    {
      key: 'loginEnabled',
      title: 'Đăng nhập bằng Face ID / vân tay',
      description: 'Dùng sinh trắc học để mở phiên ERP đã lưu.',
    },
    {
      key: 'attendanceEnabled',
      title: 'Xác thực khi chấm công',
      description: Platform.OS === 'android'
        ? 'Dùng nhận diện khuôn mặt Android trước khi check-in hoặc check-out.'
        : 'Dùng Face ID trước khi check-in hoặc check-out.',
    },
    {
      key: 'appLockEnabled',
      title: 'Khóa ứng dụng bằng sinh trắc học',
      description: Platform.OS === 'android'
        ? 'Yêu cầu vân tay hoặc sinh trắc học cấp mạnh nếu ERP Mobile ở nền liên tục 5 phút.'
        : 'Yêu cầu Face ID hoặc Touch ID nếu ERP Mobile ở nền liên tục 5 phút.',
    },
  ];

  const toggleBiometric = useCallback(async (feature: BiometricFeature) => {
    if (biometricBusy) return;
    const enabling = !biometricSettings[feature];
    if (!enabling) {
      try {
        await updateBiometricSettings({ ...biometricSettings, [feature]: false });
      } catch (error) {
        Alert.alert('Không lưu được cài đặt', error instanceof Error ? error.message : 'Hãy thử lại.');
      }
      return;
    }

    const availability = await getBiometricAvailability(feature);
    if (!availability.available) {
      Alert.alert('Chưa thể bật', availability.message || 'Thiết bị chưa sẵn sàng cho sinh trắc học.');
      return;
    }

    setBiometricBusy(feature);
    try {
      const prompt = feature === 'loginEnabled'
        ? 'Xác nhận bật đăng nhập sinh trắc học'
        : feature === 'attendanceEnabled'
          ? 'Xác nhận bật xác thực chấm công'
          : 'Xác nhận bật khóa ứng dụng';
      const result = await authenticateBiometric(feature, prompt);
      if (!result.success) {
        if (!isBiometricCancellation(result)) Alert.alert('Không xác thực được', biometricErrorMessage(result.error));
        return;
      }
      await updateBiometricSettings({ ...biometricSettings, [feature]: true });
    } catch (error) {
      Alert.alert('Không bật được sinh trắc học', error instanceof Error ? error.message : 'Hãy thử lại.');
    } finally {
      setBiometricBusy(null);
    }
  }, [biometricBusy, biometricSettings, updateBiometricSettings]);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Bật / tắt sinh trắc học</Text>
      {biometricRows.map((row, idx) => (
        <View key={row.key} style={[styles.switchRow, idx === biometricRows.length - 1 && styles.lastRow]}>
          <View style={styles.iconCircle}><Fingerprint size={17} color={colors.primary} /></View>
          <View style={{ flex: 1, paddingHorizontal: 10 }}>
            <Text style={styles.rowTitle}>{row.title}</Text>
            <Text style={styles.muted}>{row.description}</Text>
          </View>
          <Switch
            disabled={biometricBusy !== null || Platform.OS === 'web'}
            value={biometricSettings[row.key]}
            onValueChange={() => { void toggleBiometric(row.key); }}
            trackColor={{ true: colors.primary, false: '#CBD5E1' }}
          />
        </View>
      ))}
      <Text style={styles.helperText}>Sinh trắc học được kiểm tra bởi hệ điều hành và không gửi mẫu lên máy chủ ERP.</Text>
    </View>
  );
}

function getInitials(name?: string) {
  return (
    name
      ?.trim()
      .split(/\s+/)
      .slice(-2)
      .map((part) => part[0]?.toLocaleUpperCase('vi'))
      .join('') || 'NV'
  );
}

function AvatarCameraDuotoneIcon({ size = 25 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4.5 7.5H7.2L8.7 5.2C9 4.75 9.5 4.5 10.05 4.5H13.95C14.5 4.5 15 4.75 15.3 5.2L16.8 7.5H19.5C20.6 7.5 21.5 8.4 21.5 9.5V17.5C21.5 18.6 20.6 19.5 19.5 19.5H4.5C3.4 19.5 2.5 18.6 2.5 17.5V9.5C2.5 8.4 3.4 7.5 4.5 7.5Z"
        fill="#DBEAFE"
        stroke="#1E7CE8"
        strokeWidth="1.65"
        strokeLinejoin="round"
      />
      <Circle
        cx="12"
        cy="13.2"
        r="3.4"
        fill="#FFFFFF"
        stroke="#1E7CE8"
        strokeWidth="1.65"
      />
      <Circle cx="17.7" cy="10.4" r="0.9" fill="#1E7CE8" />
    </Svg>
  );
}

function AvatarGalleryDuotoneIcon({ size = 25 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x="2.75"
        y="4"
        width="18.5"
        height="16"
        rx="3"
        fill="#EFF6FF"
        stroke="#1E7CE8"
        strokeWidth="1.65"
      />
      <Circle cx="16.2" cy="8.7" r="1.6" fill="#BFDBFE" stroke="#1E7CE8" strokeWidth="1.35" />
      <Path
        d="M3.5 17.6L8.4 11.7C8.95 11.05 9.95 11.05 10.5 11.7L14.2 16.1L16.1 14C16.65 13.4 17.6 13.42 18.12 14.05L20.6 17.2C20.9 17.6 20.95 18.15 20.7 18.6C20.42 19.15 19.85 19.5 19.2 19.5H4.8C3.9 19.5 3.2 18.6 3.5 17.6Z"
        fill="#BFDBFE"
        stroke="#1E7CE8"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// =========================================================================
// 1. THÔNG TIN CÁ NHÂN
// =========================================================================
function AccountDetailSection() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [photoURL, setPhotoURL] = useState(user?.photoURL || '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarSheetOpen, setAvatarSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? (RnStatusBar.currentHeight ?? 24) : 0,
  );

  useEffect(() => {
    setDisplayName(user?.displayName || '');
    setPhotoURL(user?.photoURL || '');
  }, [user?.displayName, user?.photoURL]);

  const onSelectAvatar = useCallback(
    async (source: 'camera' | 'library') => {
      setAvatarSheetOpen(false);
      try {
        if (source === 'camera') {
          const permission = await ImagePicker.requestCameraPermissionsAsync();
          if (!permission.granted) {
            Alert.alert(
              'Chưa cấp quyền camera',
              'Vui lòng cho phép ứng dụng truy cập camera để chụp ảnh đại diện.',
            );
            return;
          }
        } else {
          const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!permission.granted) {
            Alert.alert(
              'Chưa cấp quyền ảnh',
              'Vui lòng cho phép ứng dụng truy cập thư viện ảnh để đổi ảnh đại diện.',
            );
            return;
          }
        }

        const pickerOptions: ImagePicker.ImagePickerOptions = {
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.75,
          base64: true,
        };

        const picked = await withAppLockSuspended(() =>
          source === 'camera'
            ? ImagePicker.launchCameraAsync(pickerOptions)
            : ImagePicker.launchImageLibraryAsync(pickerOptions),
        );
        if (picked.canceled || !picked.assets?.[0]) return;
        const asset = picked.assets[0];
        const mimeType = asset.mimeType || 'image/jpeg';
        let dataUrl = '';
        if (asset.base64) {
          dataUrl = `data:${mimeType};base64,${asset.base64}`;
        } else {
          const res = await fetch(asset.uri);
          const blob = await res.blob();
          dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('Không đọc được tệp ảnh.'));
            reader.onload = () => resolve(String(reader.result ?? ''));
            reader.readAsDataURL(blob);
          });
        }
        setUploadingAvatar(true);
        const uploadedUrl = await uploadMyAvatar(
          dataUrl,
          asset.fileName || 'avatar.jpg',
          mimeType,
        );
        setPhotoURL(uploadedUrl);
        await updateMyProfile({
          displayName: displayName.trim() || user?.displayName,
          photoURL: uploadedUrl,
        });
        await refreshUser();
        Alert.alert('Thành công', 'Đã cập nhật ảnh đại diện mới.');
      } catch (err) {
        Alert.alert(
          'Lỗi đổi ảnh',
          err instanceof Error ? err.message : 'Không thể tải ảnh đại diện lên.',
        );
      } finally {
        setUploadingAvatar(false);
      }
    },
    [displayName, refreshUser, user?.displayName],
  );

  const onSave = useCallback(async () => {
    if (!displayName.trim()) {
      Alert.alert('Thiếu họ tên', 'Vui lòng nhập họ và tên hiển thị.');
      return;
    }
    setSaving(true);
    try {
      await updateMyProfile({
        displayName: displayName.trim(),
        photoURL: photoURL.trim(),
      });
      await refreshUser();
      Alert.alert('Đã lưu', 'Cập nhật thông tin cá nhân thành công.');
    } catch (err) {
      Alert.alert('Lỗi cập nhật', err instanceof Error ? err.message : 'Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  }, [displayName, photoURL, refreshUser]);

  const accountInfoRows = [
    { icon: Globe, label: 'Doanh nghiệp', value: user?.companyName || user?.companyCode || '—', accent: true },
    { icon: Building2, label: 'Chi nhánh', value: user?.branchName || 'Toàn công ty', accent: false },
    ...(user?.department ? [{ icon: Briefcase, label: 'Phòng ban', value: user.department, accent: false }] : []),
    { icon: ShieldCheck, label: 'Vai trò', value: user?.role || '—', accent: false },
    ...(user?.phone ? [{ icon: Smartphone, label: 'Số điện thoại', value: user.phone, accent: true }] : []),
    { icon: Mail, label: 'Email đăng nhập', value: user?.email || '—', accent: true },
  ];

  const coverHeight = topInset + 132;
  const bottomInset = Math.max(insets.bottom + 28, 48);

  return (
    <View style={[styles.accountContainer, { paddingBottom: bottomInset }]}>
      {/* Abstract fluid & geometric iGen brand cover header */}
      <View style={[styles.coverWrap, { height: coverHeight }]}>
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 400 180"
          preserveAspectRatio="xMidYMid slice"
          style={StyleSheet.absoluteFill}
        >
          <Defs>
            <LinearGradient id="profileCoverBase" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#D7ECFF" />
              <Stop offset="52%" stopColor="#E6EEFF" />
              <Stop offset="100%" stopColor="#D4F2FA" />
            </LinearGradient>
            <LinearGradient id="profileWaveA" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#38BDF8" />
              <Stop offset="100%" stopColor="#3B82F6" />
            </LinearGradient>
            <LinearGradient id="profileWaveB" x1="1" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#6366F1" />
              <Stop offset="100%" stopColor="#06B6D4" />
            </LinearGradient>
          </Defs>

          <Rect x="0" y="0" width="400" height="180" fill="url(#profileCoverBase)" />

          {/* Abstract sweeping silk ribbons */}
          <Path
            d="M-20 155 C 70 85, 165 160, 265 95 C 325 56, 375 68, 420 42 L 420 190 L -20 190 Z"
            fill="url(#profileWaveA)"
            fillOpacity={0.24}
          />
          <Path
            d="M-20 105 C 65 148, 175 45, 290 108 C 342 136, 385 112, 420 96 L 420 190 L -20 190 Z"
            fill="url(#profileWaveB)"
            fillOpacity={0.2}
          />

          {/* Soft translucent geometric orbs & minimal arc */}
          <Circle cx="336" cy="40" r="68" fill="#38BDF8" fillOpacity={0.18} />
          <Circle cx="312" cy="52" r="38" fill="#FFFFFF" fillOpacity={0.34} />
          <Circle cx="76" cy="36" r="46" fill="#6366F1" fillOpacity={0.1} />
          <Circle
            cx="200"
            cy="152"
            r="96"
            stroke="#FFFFFF"
            strokeOpacity={0.45}
            strokeWidth="1.4"
            fill="none"
          />
          <Circle
            cx="336"
            cy="40"
            r="84"
            stroke="#3B82F6"
            strokeOpacity={0.16}
            strokeWidth="1.2"
            fill="none"
          />
        </Svg>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Trở lại"
          onPress={() => router.back()}
          hitSlop={10}
          style={[styles.coverBackBtn, { top: topInset + 8 }]}
        >
          <ChevronLeft size={24} color="#334155" strokeWidth={2.2} />
        </Pressable>
      </View>

      {/* Main white profile sheet overlapping cover */}
      <View style={styles.profileSheet}>
        <View style={styles.avatarCenterWrap}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Thay đổi ảnh đại diện"
            disabled={uploadingAvatar}
            onPress={() => setAvatarSheetOpen(true)}
            style={styles.heroAvatarRing}
          >
            <View style={styles.heroAvatarInner}>
              {photoURL ? (
                <Image source={{ uri: photoURL }} style={styles.heroAvatarImage} />
              ) : (
                <Text style={styles.heroAvatarInitials}>
                  {getInitials(displayName || user?.displayName)}
                </Text>
              )}
            </View>
            <View style={[styles.avatarCameraBadge, uploadingAvatar && styles.disabled]}>
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color="#1F2937" />
              ) : (
                <Camera size={14} color="#1F2937" strokeWidth={2.1} />
              )}
            </View>
          </Pressable>

          <Text style={styles.heroName} numberOfLines={2}>
            {displayName.trim() || user?.displayName || 'Người dùng ERP'}
          </Text>
        </View>

        {/* Clean stacked icon + label/value rows */}
        <View style={styles.profileInfoList}>
          {accountInfoRows.map((row, idx) => {
            const Icon = row.icon;
            return (
              <View
                key={row.label}
                style={[
                  styles.profileInfoItem,
                  idx === accountInfoRows.length - 1 && styles.lastRow,
                ]}
              >
                <View style={styles.profileInfoIcon}>
                  <Icon size={19} color="#64748B" strokeWidth={1.7} />
                </View>
                <View style={styles.profileInfoCopy}>
                  <Text style={styles.profileInfoLabel}>{row.label}</Text>
                  <Text
                    style={[
                      styles.profileInfoValue,
                      row.accent && styles.profileInfoValueAccent,
                    ]}
                  >
                    {row.value}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* Subtle band separator */}
      <View style={styles.sectionBand} />

      {/* Existing edit display name section */}
      <View style={styles.editSection}>
        <Text style={styles.editSectionTitle}>Chỉnh sửa hồ sơ</Text>
        <Text style={styles.label}>Họ và tên hiển thị *</Text>
        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Nhập họ và tên..."
          placeholderTextColor={colors.muted}
          style={styles.field}
        />
        <Pressable
          disabled={saving || uploadingAvatar}
          onPress={() => void onSave()}
          style={[styles.primaryBtn, (saving || uploadingAvatar) && styles.disabled]}
        >
          <Text style={styles.primaryBtnText}>{saving ? 'Đang lưu...' : 'Lưu thay đổi'}</Text>
        </Pressable>
      </View>

      {/* Bottom sheet chọn nguồn ảnh đại diện */}
      <Modal
        visible={avatarSheetOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setAvatarSheetOpen(false)}
      >
        <View style={styles.avatarSheetOverlay}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đóng chọn ảnh đại diện"
            onPress={() => setAvatarSheetOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              styles.avatarSheetContainer,
              { paddingBottom: Math.max(insets.bottom + 14, 24) },
            ]}
          >
            <View style={styles.avatarSheetHandle} />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Chụp ảnh"
              onPress={() => void onSelectAvatar('camera')}
              style={({ pressed }) => [
                styles.avatarSheetOption,
                pressed && styles.avatarSheetOptionPressed,
              ]}
            >
              <AvatarCameraDuotoneIcon size={25} />
              <Text style={styles.avatarSheetOptionText}>Chụp ảnh</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Chọn ảnh từ thư viện"
              onPress={() => void onSelectAvatar('library')}
              style={({ pressed }) => [
                styles.avatarSheetOption,
                pressed && styles.avatarSheetOptionPressed,
              ]}
            >
              <AvatarGalleryDuotoneIcon size={25} />
              <Text style={styles.avatarSheetOptionText}>Chọn ảnh từ thư viện</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// =========================================================================
// 2. THÔNG BÁO
// =========================================================================
function NotificationsDetailSection() {
  const [prefs, setPrefs] = useState<LocalPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    void loadPrefs().then(setPrefs);
  }, []);

  const toggle = (field: 'notifChat' | 'notifTasks' | 'notifLeaves' | 'notifAttendance') => {
    setPrefs((prev) => {
      const next = { ...prev, [field]: !prev[field] };
      void savePrefs(next);
      return next;
    });
  };

  const rows: Array<{
    key: 'notifChat' | 'notifTasks' | 'notifLeaves' | 'notifAttendance';
    title: string;
    desc: string;
  }> = [
    {
      key: 'notifChat',
      title: 'Tin nhắn trò chuyện nội bộ',
      desc: 'Nhận thông báo khi có tin nhắn mới từ đồng nghiệp hoặc nhóm.',
    },
    {
      key: 'notifTasks',
      title: 'Công việc & hạn chót (KPI)',
      desc: 'Nhắc việc được giao, thay đổi trạng thái và sắp đến hạn.',
    },
    {
      key: 'notifLeaves',
      title: 'Đơn từ & phê duyệt',
      desc: 'Thông báo khi có đơn cần duyệt hoặc kết quả duyệt đơn.',
    },
    {
      key: 'notifAttendance',
      title: 'Chấm công & lịch làm việc',
      desc: 'Nhắc giờ vào/ra ca, lịch nghỉ lễ và lịch phỏng vấn.',
    },
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Tùy chỉnh nhận thông báo</Text>
      {rows.map((r, idx) => (
        <View
          key={r.key}
          style={[styles.switchRow, idx === rows.length - 1 && styles.lastRow]}
        >
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.rowTitle}>{r.title}</Text>
            <Text style={styles.muted}>{r.desc}</Text>
          </View>
          <Switch
            value={prefs[r.key]}
            onValueChange={() => toggle(r.key)}
            trackColor={{ true: colors.primary, false: '#CBD5E1' }}
          />
        </View>
      ))}
    </View>
  );
}

// =========================================================================
// 3. BẢO MẬT ĐĂNG NHẬP
// =========================================================================
function SecurityDetailSection() {
  const { user, signOut } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const onChangePassword = useCallback(async () => {
    if (newPassword.length < 6) {
      Alert.alert('Mật khẩu quá ngắn', 'Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Không khớp', 'Xác nhận mật khẩu mới không trùng khớp.');
      return;
    }
    setSaving(true);
    try {
      await changeMyPassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Thành công', 'Đã đổi mật khẩu đăng nhập thành công.');
    } catch (err) {
      Alert.alert('Lỗi đổi mật khẩu', err instanceof Error ? err.message : 'Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  }, [confirmPassword, newPassword]);

  return (
    <View style={styles.stack}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Đổi mật khẩu</Text>
        <Text style={styles.label}>Mật khẩu mới (tối thiểu 6 ký tự) *</Text>
        <TextInput
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor={colors.muted}
          style={styles.field}
        />
        <Text style={styles.label}>Nhập lại mật khẩu mới *</Text>
        <TextInput
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor={colors.muted}
          style={styles.field}
        />
        <Pressable
          disabled={saving}
          onPress={() => void onChangePassword()}
          style={[styles.primaryBtn, saving && styles.disabled]}
        >
          <Text style={styles.primaryBtnText}>
            {saving ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Thiết bị & phiên hiện tại</Text>
        <View style={styles.deviceRow}>
          <View style={styles.iconCircle}>
            <Smartphone size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>
              ERP Mobile ({Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'Web'})
            </Text>
            <Text style={styles.muted}>Đang đăng nhập với {user?.email}</Text>
          </View>
          <ShieldCheck size={18} color="#16885A" />
        </View>
        <Pressable
          onPress={() =>
            showHrConfirm({
              title: 'Đăng xuất thiết bị này?',
              message: 'Phiên đăng nhập hiện tại sẽ kết thúc và bạn cần đăng nhập lại.',
              confirmLabel: 'Đăng xuất',
              onConfirm: async () => {
                await signOut();
              },
            })
          }
          style={styles.dangerBtn}
        >
          <Text style={styles.dangerBtnText}>Đăng xuất khỏi thiết bị này</Text>
        </Pressable>
      </View>
    </View>
  );
}

// =========================================================================
// 4. QUYỀN RIÊNG TƯ
// =========================================================================
function PrivacyDetailSection() {
  const { user } = useAuth();
  const openErpPage = async (url: string | null, pageName: string) => {
    if (!url) {
      Alert.alert('Chưa cấu hình địa chỉ ERP', `Không tìm thấy địa chỉ website ERP để mở trang ${pageName}.`);
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Không mở được trang', `Hãy thử lại hoặc mở trang ${pageName} từ trình duyệt.`);
    }
  };

  return (
    <View style={styles.stack}>
      <PrivacyControls />
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Dữ liệu cá nhân trong Igen ERP</Text>
        <Text style={styles.muted}>
          Tài khoản {user?.email || ''} thuộc doanh nghiệp{' '}
          {user?.companyName || user?.companyCode || 'Igen ERP'}. Dữ liệu hồ sơ nhân sự, chấm công,
          đơn từ, tài liệu và tin nhắn nội bộ được lưu trữ và phân quyền truy cập theo chính sách của
          doanh nghiệp.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Quyền truy cập thiết bị</Text>
        <View style={styles.infoRow}>
          <Text style={styles.muted}>Bộ nhớ & Tệp</Text>
          <Text style={styles.infoVal}>Tải tệp đơn từ, hợp đồng, tài nguyên</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.muted}>Vị trí & Mạng</Text>
          <Text style={styles.infoVal}>Cấu hình chi nhánh & chấm công</Text>
        </View>
        <View style={[styles.infoRow, styles.lastRow]}>
          <Text style={styles.muted}>Phiên đăng nhập</Text>
          <Text style={styles.infoVal}>Mã hóa bằng SecureStore</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Yêu cầu xuất hoặc xóa dữ liệu</Text>
        <Text style={styles.muted}>
          Để xóa tài khoản, dùng mục Xóa tài khoản phía trên. Để trích xuất dữ liệu, vui lòng gửi yêu
          cầu tới quản trị viên doanh nghiệp hoặc bộ phận hỗ trợ Igen ERP.
        </Text>
        <Pressable
          onPress={() =>
            void Linking.openURL(
              `mailto:igentech1@gmail.com?subject=${encodeURIComponent(
                `Yêu cầu quyền riêng tư - ${user?.email || ''}`,
              )}`,
            )
          }
          style={styles.outlineBtn}
        >
          <Mail size={14} color={colors.primary} />
          <Text style={styles.outlineBtnText}>Gửi yêu cầu qua Email</Text>
        </Pressable>
        <Pressable onPress={() => void openErpPage(ERP_PRIVACY_POLICY_URL, 'quyền riêng tư')} style={styles.outlineBtn}>
          <ExternalLink size={14} color={colors.primary} />
          <Text style={styles.outlineBtnText}>Mở trang quyền riêng tư trên ERP</Text>
        </Pressable>
        <Pressable onPress={() => void openErpPage(ERP_TERMS_OF_SERVICE_URL, 'điều khoản sử dụng')} style={styles.outlineBtn}>
          <ExternalLink size={14} color={colors.primary} />
          <Text style={styles.outlineBtnText}>Mở điều khoản sử dụng trên ERP</Text>
        </Pressable>
      </View>
    </View>
  );
}

// =========================================================================
// 5. TRỢ GIÚP VÀ HỖ TRỢ
// =========================================================================
function SupportDetailSection() {
  const [health, setHealth] = useState<ErpHealth | null>(null);
  const [checking, setChecking] = useState(false);
  const [healthErr, setHealthErr] = useState<string | null>(null);

  const checkHealth = useCallback(async () => {
    setChecking(true);
    setHealthErr(null);
    try {
      setHealth(await checkErpConnection());
    } catch (err) {
      setHealth(null);
      setHealthErr(err instanceof Error ? err.message : 'Không kết nối được tới máy chủ ERP.');
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void checkHealth();
  }, [checkHealth]);

  return (
    <View style={styles.stack}>
      <View style={styles.card}>
        <View style={styles.headRow}>
          <Text style={styles.cardTitle}>Trạng thái kết nối ERP</Text>
          <Pressable disabled={checking} onPress={() => void checkHealth()} style={styles.refreshBtn}>
            <RefreshCw size={13} color={colors.primary} />
            <Text style={styles.refreshText}>{checking ? 'Đang kiểm tra...' : 'Kiểm tra'}</Text>
          </Pressable>
        </View>
        {checking && !health ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : healthErr ? (
          <PopupError error={healthErr} />
        ) : (
          <View style={styles.healthRow}>
            <CheckCircle2 size={18} color="#16885A" />
            <Text style={[styles.rowTitle, { color: '#16885A' }]}>Kết nối ổn định</Text>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Liên hệ bộ phận hỗ trợ</Text>
        <Pressable
          onPress={() => void Linking.openURL('mailto:igentech1@gmail.com')}
          style={styles.contactRow}
        >
          <Mail size={16} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Email hỗ trợ</Text>
            <Text style={styles.muted}>igentech1@gmail.com</Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => void Linking.openURL('tel:0815971508')}
          style={[styles.contactRow, styles.lastRow]}
        >
          <Phone size={16} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Số điện thoại hỗ trợ</Text>
            <Text style={styles.muted}>0815971508</Text>
          </View>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Thông tin ứng dụng</Text>
        <View style={styles.infoRow}>
          <Text style={styles.muted}>Ứng dụng</Text>
          <Text style={styles.infoVal}>Igen ERP Mobile</Text>
        </View>
        <View style={[styles.infoRow, styles.lastRow]}>
          <Text style={styles.muted}>Phiên bản</Text>
          <Text style={styles.infoVal}>1.0.0</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  accountRoot: { flex: 1, backgroundColor: colors.white },
  accountScroll: { flexGrow: 1, backgroundColor: colors.white, paddingBottom: 32 },
  accountContainer: { flex: 1, backgroundColor: colors.white },
  coverWrap: {
    width: '100%',
    backgroundColor: '#DCE2EC',
    position: 'relative',
    overflow: 'hidden',
  },
  coverBackBtn: {
    position: 'absolute',
    left: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    marginTop: -14,
    paddingBottom: 6,
  },
  avatarCenterWrap: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  heroAvatarRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    marginTop: -46,
    backgroundColor: colors.white,
    padding: 3.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarCameraBadge: {
    position: 'absolute',
    right: -1,
    bottom: 1,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  heroAvatarInner: {
    width: '100%',
    height: '100%',
    borderRadius: 43,
    backgroundColor: '#E5ECF6',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroAvatarImage: { width: '100%', height: '100%' },
  heroAvatarInitials: { color: colors.primary, fontSize: 26, fontWeight: '700' },
  heroName: {
    marginTop: 10,
    color: '#111827',
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
  },
  profileInfoList: {
    paddingHorizontal: 18,
    paddingTop: 4,
  },
  profileInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEF2F7',
  },
  profileInfoIcon: {
    width: 30,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  profileInfoCopy: {
    flex: 1,
    marginLeft: 6,
    gap: 3,
  },
  profileInfoLabel: {
    color: '#475569',
    fontSize: 12.5,
    fontWeight: '400',
  },
  profileInfoValue: {
    color: '#1F2937',
    fontSize: 14.5,
    fontWeight: '400',
  },
  profileInfoValueAccent: {
    color: '#1E6CEB',
  },
  sectionBand: {
    height: 8,
    backgroundColor: '#F3F6FA',
    marginTop: 8,
  },
  editSection: {
    backgroundColor: colors.white,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 8,
  },
  editSectionTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  content: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 32 },
  stack: { gap: 12 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5EAF2',
    padding: 16,
    gap: 8,
  },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4 },
  avatarPreview: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: '#DCE8FF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: 72, height: 72 },
  avatarInitials: { color: colors.primary, fontSize: 22, fontWeight: '700' },
  changePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    minHeight: 40,
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  removePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#FCEBEC',
    minHeight: 34,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  removePhotoText: { color: '#C74848', fontSize: 11.5, fontWeight: '600' },
  cardTitle: { color: colors.ink, fontSize: 14, fontWeight: '600', marginBottom: 2 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowTitle: { color: '#1F2937', fontSize: 13, fontWeight: '500' },
  muted: { color: colors.muted, fontSize: 11.5, lineHeight: 16.5 },
  helperText: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  footerNote: { color: colors.muted, fontSize: 11, lineHeight: 16, paddingHorizontal: 4 },
  label: { color: colors.ink, fontSize: 11.5, fontWeight: '600', marginTop: 4 },
  field: {
    backgroundColor: colors.background,
    borderColor: '#E5EAF2',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.ink,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEF2F7',
  },
  infoVal: { color: '#1F2937', fontSize: 12.5, fontWeight: '500', flexShrink: 1, textAlign: 'right' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEF2F7',
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEF2F7',
  },
  permissionCopy: { flex: 1, gap: 3 },
  permissionStatus: { color: '#A86B16', fontSize: 10.5, fontWeight: '600' },
  permissionGranted: { color: '#16885A' },
  permissionButton: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 11,
    borderRadius: 9,
    backgroundColor: '#EAF2FF',
  },
  permissionButtonText: { color: colors.primary, fontSize: 11, fontWeight: '600' },
  deviceRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 4 },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EAF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEF2F7',
  },
  lastRow: {
    borderBottomWidth: 0,
    paddingBottom: 2,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EAF2FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
  },
  refreshText: { color: colors.primary, fontSize: 11, fontWeight: '600' },
  primaryBtn: {
    backgroundColor: colors.primary,
    minHeight: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  primaryBtnText: { color: colors.white, fontSize: 12.5, fontWeight: '600' },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EAF2FF',
    minHeight: 40,
    borderRadius: 10,
    marginTop: 2,
  },
  outlineBtnText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  dangerBtn: {
    backgroundColor: '#FCEBEC',
    minHeight: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  dangerBtnText: { color: '#C74848', fontSize: 12, fontWeight: '600' },
  errorText: { color: '#B91C1C', fontSize: 12 },
  disabled: { opacity: 0.45 },
  avatarSheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
  },
  avatarSheetContainer: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
  },
  avatarSheetHandle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    marginBottom: 12,
  },
  avatarSheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 22,
    paddingVertical: 15,
  },
  avatarSheetOptionPressed: {
    backgroundColor: '#F8FAFC',
  },
  avatarSheetOptionText: {
    color: '#111827',
    fontSize: 15.5,
    fontWeight: '500',
  },
});

