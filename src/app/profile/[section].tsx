import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import {
  Camera,
  Check,
  CheckCircle2,
  ExternalLink,
  Mail,
  Phone,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Trash2,
} from 'lucide-react-native';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import {
  changeMyPassword,
  checkErpConnection,
  updateMyProfile,
  uploadMyAvatar,
  type ErpHealth,
} from '@/core/auth/authApi';
import { useAuth } from '@/core/auth/AuthProvider';
import { ERP_PRIVACY_POLICY_URL, ERP_TERMS_OF_SERVICE_URL } from '@/core/network/erpWebLinks';
import { showHrConfirm } from '@/features/hr/components/HrConfirmModal';
import { colors } from '@/theme/colors';

const SECTION_TITLES: Record<string, string> = {
  account: 'Thông tin cá nhân',
  notifications: 'Thông báo',
  security: 'Bảo mật đăng nhập',
  language: 'Ngôn ngữ',
  privacy: 'Quyền riêng tư',
  support: 'Trợ giúp và hỗ trợ',
};

const PREFS_KEY = 'igen_erp_mobile_prefs';

type LocalPrefs = {
  notifChat: boolean;
  notifTasks: boolean;
  notifLeaves: boolean;
  notifAttendance: boolean;
  language: 'vi' | 'en';
};

const DEFAULT_PREFS: LocalPrefs = {
  notifChat: true,
  notifTasks: true,
  notifLeaves: true,
  notifAttendance: true,
  language: 'vi',
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

  return (
    <Screen>
      <Stack.Screen options={{ title }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {key === 'account' ? (
          <AccountDetailSection />
        ) : key === 'notifications' ? (
          <NotificationsDetailSection />
        ) : key === 'security' ? (
          <SecurityDetailSection />
        ) : key === 'language' ? (
          <LanguageDetailSection />
        ) : key === 'privacy' ? (
          <PrivacyDetailSection />
        ) : (
          <SupportDetailSection />
        )}
      </ScrollView>
    </Screen>
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

// =========================================================================
// 1. THÔNG TIN CÁ NHÂN
// =========================================================================
function AccountDetailSection() {
  const { user, refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [photoURL, setPhotoURL] = useState(user?.photoURL || '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDisplayName(user?.displayName || '');
    setPhotoURL(user?.photoURL || '');
  }, [user?.displayName, user?.photoURL]);

  const onPickAvatar = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Chưa cấp quyền ảnh', 'Vui lòng cho phép ứng dụng truy cập thư viện ảnh để đổi ảnh đại diện.');
        return;
      }
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.75,
        base64: true,
      });
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
      Alert.alert('Lỗi đổi ảnh', err instanceof Error ? err.message : 'Không thể tải ảnh đại diện lên.');
    } finally {
      setUploadingAvatar(false);
    }
  }, [displayName, refreshUser, user?.displayName]);

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

  return (
    <View style={styles.stack}>
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Ảnh đại diện</Text>
        <View style={styles.avatarRow}>
          <View style={styles.avatarPreview}>
            {photoURL ? (
              <Image source={{ uri: photoURL }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarInitials}>{getInitials(displayName || user?.displayName)}</Text>
            )}
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            <Pressable
              disabled={uploadingAvatar}
              onPress={() => void onPickAvatar()}
              style={[styles.changePhotoBtn, uploadingAvatar && styles.disabled]}
            >
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Camera size={14} color={colors.white} />
                  <Text style={styles.primaryBtnText}>Thay đổi ảnh</Text>
                </>
              )}
            </Pressable>
            {photoURL ? (
              <Pressable
                disabled={uploadingAvatar || saving}
                onPress={() => setPhotoURL('')}
                style={styles.removePhotoBtn}
              >
                <Trash2 size={13} color="#C74848" />
                <Text style={styles.removePhotoText}>Gỡ ảnh đại diện</Text>
              </Pressable>
            ) : (
              <Text style={styles.muted}>Chọn ảnh vuông từ thư viện ảnh trên thiết bị.</Text>
            )}
          </View>
        </View>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Thông tin tài khoản ERP</Text>
        <View style={styles.infoRow}>
          <Text style={styles.muted}>Email đăng nhập</Text>
          <Text style={styles.infoVal}>{user?.email || '—'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.muted}>Doanh nghiệp</Text>
          <Text style={styles.infoVal}>{user?.companyName || user?.companyCode || '—'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.muted}>Chi nhánh</Text>
          <Text style={styles.infoVal}>{user?.branchName || 'Toàn công ty'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.muted}>Vai trò</Text>
          <Text style={styles.infoVal}>{user?.role || '—'}</Text>
        </View>
        {user?.department ? (
          <View style={styles.infoRow}>
            <Text style={styles.muted}>Phòng ban</Text>
            <Text style={styles.infoVal}>{user.department}</Text>
          </View>
        ) : null}
        {user?.phone ? (
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.muted}>Số điện thoại</Text>
            <Text style={styles.infoVal}>{user.phone}</Text>
          </View>
        ) : null}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Chỉnh sửa hồ sơ</Text>
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
      </Card>
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
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>Tùy chỉnh nhận thông báo</Text>
      {rows.map((r, idx) => (
        <View
          key={r.key}
          style={[styles.switchRow, idx === rows.length - 1 && { borderBottomWidth: 0 }]}
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
    </Card>
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
      <Card style={styles.card}>
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
      </Card>

      <Card style={styles.card}>
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
      </Card>
    </View>
  );
}

// =========================================================================
// 4. NGÔN NGỮ
// =========================================================================
function LanguageDetailSection() {
  const [prefs, setPrefs] = useState<LocalPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    void loadPrefs().then(setPrefs);
  }, []);

  const selectLang = (lang: 'vi' | 'en') => {
    const next = { ...prefs, language: lang };
    setPrefs(next);
    void savePrefs(next);
    Alert.alert(
      'Đã cập nhật ngôn ngữ',
      lang === 'vi'
        ? 'Ứng dụng đang sử dụng Tiếng Việt.'
        : 'Đã lưu tùy chọn English (một số mục nghiệp vụ ERP vẫn hiển thị theo ngôn ngữ dữ liệu doanh nghiệp).',
    );
  };

  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>Chọn ngôn ngữ hiển thị</Text>
      {(
        [
          { code: 'vi', label: 'Tiếng Việt', desc: 'Ngôn ngữ mặc định của hệ thống Igen ERP' },
          { code: 'en', label: 'English', desc: 'International interface preference' },
        ] as const
      ).map((item, idx) => {
        const active = prefs.language === item.code;
        return (
          <Pressable
            key={item.code}
            onPress={() => selectLang(item.code)}
            style={[
              styles.langRow,
              active && styles.langRowActive,
              idx === 0 && { marginBottom: 8 },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{item.label}</Text>
              <Text style={styles.muted}>{item.desc}</Text>
            </View>
            {active ? <Check size={18} color={colors.primary} /> : null}
          </Pressable>
        );
      })}
    </Card>
  );
}

// =========================================================================
// 5. QUYỀN RIÊNG TƯ
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
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Dữ liệu cá nhân trong Igen ERP</Text>
        <Text style={styles.muted}>
          Tài khoản {user?.email || ''} thuộc doanh nghiệp{' '}
          {user?.companyName || user?.companyCode || 'Igen ERP'}. Dữ liệu hồ sơ nhân sự, chấm công,
          đơn từ, tài liệu và tin nhắn nội bộ được lưu trữ và phân quyền truy cập theo chính sách của
          doanh nghiệp.
        </Text>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Quyền truy cập thiết bị</Text>
        <View style={styles.infoRow}>
          <Text style={styles.muted}>Bộ nhớ & Tệp</Text>
          <Text style={styles.infoVal}>Tải tệp đơn từ, hợp đồng, tài nguyên</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.muted}>Vị trí & Mạng</Text>
          <Text style={styles.infoVal}>Cấu hình chi nhánh & chấm công</Text>
        </View>
        <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.muted}>Phiên đăng nhập</Text>
          <Text style={styles.infoVal}>Mã hóa bằng SecureStore</Text>
        </View>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Yêu cầu xuất hoặc xóa dữ liệu</Text>
        <Text style={styles.muted}>
          Để yêu cầu trích xuất bản sao dữ liệu hoặc xóa tài khoản khỏi hệ thống, vui lòng gửi yêu
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
      </Card>
    </View>
  );
}

// =========================================================================
// 6. TRỢ GIÚP VÀ HỖ TRỢ
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
      <Card style={styles.card}>
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
          <Text style={styles.errorText}>{healthErr}</Text>
        ) : (
          <View style={styles.healthRow}>
            <CheckCircle2 size={18} color="#16885A" />
            <Text style={[styles.rowTitle, { color: '#16885A' }]}>Kết nối ổn định</Text>
          </View>
        )}
      </Card>

      <Card style={styles.card}>
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
          style={[styles.contactRow, { borderBottomWidth: 0 }]}
        >
          <Phone size={16} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Số điện thoại hỗ trợ</Text>
            <Text style={styles.muted}>0815971508</Text>
          </View>
        </Pressable>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Thông tin ứng dụng</Text>
        <View style={styles.infoRow}>
          <Text style={styles.muted}>Ứng dụng</Text>
          <Text style={styles.infoVal}>Igen ERP Mobile</Text>
        </View>
        <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.muted}>Phiên bản</Text>
          <Text style={styles.infoVal}>1.0.0</Text>
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 32 },
  stack: { gap: 12 },
  card: { padding: 15, gap: 10 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarPreview: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: '#DCE8FF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: 76, height: 76 },
  avatarInitials: { color: colors.primary, fontSize: 22, fontWeight: '800' },
  changePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    minHeight: 40,
    borderRadius: 11,
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
  removePhotoText: { color: '#C74848', fontSize: 11, fontWeight: '700' },
  cardTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowTitle: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  label: { color: colors.ink, fontSize: 11, fontWeight: '700', marginTop: 2 },
  field: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    color: colors.ink,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  infoVal: { color: colors.ink, fontSize: 12, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  deviceRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EAF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  langRowActive: { backgroundColor: '#EAF2FF', borderColor: colors.primary },
  healthRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
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
  refreshText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  primaryBtn: {
    backgroundColor: colors.primary,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryBtnText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EAF2FF',
    minHeight: 42,
    borderRadius: 12,
    marginTop: 2,
  },
  outlineBtnText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  dangerBtn: {
    backgroundColor: '#FCEBEC',
    minHeight: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  dangerBtnText: { color: '#C74848', fontSize: 12, fontWeight: '700' },
  errorText: { color: '#B91C1C', fontSize: 12 },
  disabled: { opacity: 0.45 },
});

