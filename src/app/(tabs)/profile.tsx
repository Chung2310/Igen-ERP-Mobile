import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { SettingsDuotoneIcon, type SettingsIconKey } from '@/components/SettingsIcons';
import { useAuth } from '@/core/auth/AuthProvider';
import { showHrConfirm } from '@/features/hr/components/HrConfirmModal';
import { colors } from '@/theme/colors';

const settings: ReadonlyArray<{ key: Exclude<SettingsIconKey, 'logout'>; label: string }> = [
  { key: 'notifications', label: 'Thông báo' },
  { key: 'security', label: 'Bảo mật đăng nhập' },
  { key: 'permissions', label: 'Quyền ứng dụng' },
  { key: 'privacy', label: 'Quyền riêng tư' },
  { key: 'support', label: 'Trợ giúp và hỗ trợ' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

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

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Text style={styles.title}>Cài đặt cá nhân</Text>
        </View>

        <Pressable
          onPress={() => router.push('/profile/account' as Href)}
          style={({ pressed }) => [styles.surfaceCard, styles.profileCard, pressed && styles.rowPressed]}
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
        </Pressable>

        <Text style={styles.section}>Tài khoản &amp; Ứng dụng</Text>
        <View style={[styles.surfaceCard, styles.menuCard]}>
          {settings.map((item, index) => (
            <View key={item.key}>
              <Pressable
                onPress={() => router.push(`/profile/${item.key}` as Href)}
                style={({ pressed }) => [styles.menuRow, pressed && styles.rowPressed]}
                accessibilityRole="button"
                accessibilityLabel={item.label}
              >
                <View style={styles.menuIconWrap}>
                  <SettingsDuotoneIcon name={item.key} size={22} />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
              </Pressable>
              {index < settings.length - 1 ? <View style={styles.divider} /> : null}
            </View>
          ))}
        </View>

        <View style={[styles.surfaceCard, styles.signOutCard]}>
          <Pressable
            accessibilityRole="button"
            disabled={signingOut}
            onPress={() =>
              showHrConfirm({
                title: 'Đăng xuất?',
                message: 'Bạn có chắc chắn muốn đăng xuất khỏi ERP Mobile?',
                confirmLabel: 'Đăng xuất',
                onConfirm: onSignOut,
              })
            }
            style={({ pressed }) => [styles.menuRow, pressed && styles.rowPressed]}
          >
            <View style={styles.menuIconWrap}>
              {signingOut ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <SettingsDuotoneIcon name="logout" size={22} />
              )}
            </View>
            <Text style={styles.menuLabel}>Đăng xuất</Text>
          </Pressable>
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
    paddingHorizontal: 4,
    marginBottom: 14,
  },
  title: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  surfaceCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5EAF2',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  profileCopy: { flex: 1 },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#DCE8FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImage: { width: 50, height: 50 },
  avatarText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  name: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  email: { color: colors.muted, fontSize: 11.5, marginTop: 2 },
  company: { color: colors.primary, fontSize: 10.5, fontWeight: '600', marginTop: 4 },
  section: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
    paddingHorizontal: 4,
    marginTop: 20,
    marginBottom: 10,
  },
  menuCard: {
    overflow: 'hidden',
  },
  signOutCard: {
    marginTop: 12,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  rowPressed: {
    backgroundColor: '#F6F8FC',
  },
  menuIconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    marginLeft: 14,
    color: '#1F2937',
    fontSize: 14.5,
    fontWeight: '400',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#EEF2F7',
    marginHorizontal: 16,
  },
});

function getInitials(name?: string) {
  return name?.trim().split(/\s+/).slice(-2).map((part) => part[0]?.toLocaleUpperCase('vi')).join('') || 'ERP';
}
