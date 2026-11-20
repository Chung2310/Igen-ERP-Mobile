import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/core/auth/AuthProvider';
import { colors } from '@/theme/colors';

const settings = [
  { label: 'Thông tin cá nhân', icon: '◉', detail: 'Họ tên, email, số điện thoại' },
  { label: 'Thông báo', icon: '♧', detail: 'Tin nhắn, công việc và nhắc hạn' },
  { label: 'Bảo mật đăng nhập', icon: '◇', detail: 'Mật khẩu và thiết bị đăng nhập' },
  { label: 'Ngôn ngữ', icon: '文', detail: 'Tiếng Việt' },
  { label: 'Quyền riêng tư', icon: '⌑', detail: 'Dữ liệu cá nhân và yêu cầu xóa' },
  { label: 'Trợ giúp và hỗ trợ', icon: '?', detail: 'Liên hệ bộ phận hỗ trợ' },
];

export default function ProfileScreen() {
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
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>TÀI KHOẢN CỦA BẠN</Text>
        <Text style={styles.title}>Cài đặt cá nhân</Text>
        <Card style={styles.profileCard}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{getInitials(user?.displayName)}</Text></View>
          <View style={styles.profileCopy}><Text numberOfLines={1} style={styles.name}>{user?.displayName ?? 'Người dùng ERP'}</Text><Text numberOfLines={1} style={styles.email}>{user?.email ?? ''}</Text><Text numberOfLines={1} style={styles.company}>{user?.companyName || user?.companyCode || 'Igen ERP'} · {user?.role ?? ''}</Text></View>
        </Card>
        <Text style={styles.section}>TÀI KHOẢN &amp; ỨNG DỤNG</Text>
        <View style={styles.list}>
          {settings.map((item) => (
            <Card key={item.label} style={styles.row}><View style={styles.rowIcon}><Text style={styles.rowIconText}>{item.icon}</Text></View><View style={styles.rowCopy}><Text style={styles.rowLabel}>{item.label}</Text><Text style={styles.rowDetail}>{item.detail}</Text></View><Text style={styles.arrow}>›</Text></Card>
          ))}
        </View>
        <Pressable accessibilityRole="button" disabled={signingOut} onPress={() => { void onSignOut(); }} style={styles.signOutButton}>
          {signingOut ? <ActivityIndicator size="small" color="#C74848" /> : <Text style={styles.signOut}>Đăng xuất</Text>}
        </Pressable>
        <Text style={styles.version}>ERP Mobile · Kết nối Igen ERP</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: 18 },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  title: { color: colors.ink, fontSize: 25, fontWeight: '800', marginTop: 5, marginBottom: 18 },
  profileCard: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  profileCopy: { flex: 1 },
  avatar: { width: 54, height: 54, borderRadius: 18, backgroundColor: '#DCE8FF', alignItems: 'center', justifyContent: 'center', marginRight: 13 },
  avatarText: { color: colors.primary, fontWeight: '800', fontSize: 15 },
  name: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  email: { color: colors.muted, fontSize: 11, marginTop: 3 },
  company: { color: colors.primary, fontSize: 10, fontWeight: '600', marginTop: 6 },
  section: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1, marginTop: 24, marginBottom: 10 },
  list: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  rowIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#F0F4FA', alignItems: 'center', justifyContent: 'center' },
  rowIconText: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  rowCopy: { flex: 1, marginLeft: 11 },
  rowLabel: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  rowDetail: { color: colors.muted, fontSize: 9, marginTop: 4 },
  arrow: { color: colors.muted, fontSize: 22 },
  signOutButton: { minHeight: 46, justifyContent: 'center', marginTop: 14, borderRadius: 13, backgroundColor: '#FCEBEC' },
  signOut: { color: '#C74848', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  version: { color: colors.muted, fontSize: 10, textAlign: 'center', marginTop: 22 },
});

function getInitials(name?: string) {
  return name?.trim().split(/\s+/).slice(-2).map((part) => part[0]?.toLocaleUpperCase('vi')).join('') || 'ERP';
}
