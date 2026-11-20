import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
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
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>TÀI KHOẢN CỦA BẠN</Text>
        <Text style={styles.title}>Cài đặt cá nhân</Text>
        <Card style={styles.profileCard}>
          <View style={styles.avatar}><Text style={styles.avatarText}>AN</Text></View>
          <View><Text style={styles.name}>Anh Nguyễn</Text><Text style={styles.email}>anh.nguyen@igen.vn</Text><Text style={styles.company}>Igen Technology · Quản trị viên</Text></View>
        </Card>
        <Text style={styles.section}>TÀI KHOẢN &amp; ỨNG DỤNG</Text>
        <View style={styles.list}>
          {settings.map((item) => (
            <Card key={item.label} style={styles.row}><View style={styles.rowIcon}><Text style={styles.rowIconText}>{item.icon}</Text></View><View style={styles.rowCopy}><Text style={styles.rowLabel}>{item.label}</Text><Text style={styles.rowDetail}>{item.detail}</Text></View><Text style={styles.arrow}>›</Text></Card>
          ))}
        </View>
        <Text style={styles.signOut}>Đăng xuất</Text>
        <Text style={styles.version}>ERP Mobile · Khung giao diện 1.0</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: 18 },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  title: { color: colors.ink, fontSize: 25, fontWeight: '800', marginTop: 5, marginBottom: 18 },
  profileCard: { flexDirection: 'row', alignItems: 'center', padding: 16 },
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
  signOut: { color: '#C74848', fontSize: 11, fontWeight: '700', textAlign: 'center', marginTop: 24 },
  version: { color: colors.muted, fontSize: 10, textAlign: 'center', marginTop: 22 },
});
