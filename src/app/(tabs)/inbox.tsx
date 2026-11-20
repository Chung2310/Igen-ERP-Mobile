import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { colors } from '@/theme/colors';

const conversations = [
  { initials: 'ML', name: 'Minh Long Trading', message: 'Bên mình cần báo giá cho đơn hàng tháng này...', time: '09:42', color: '#E9F1FF', unread: true },
  { initials: 'TH', name: 'Thu Hà Nguyễn', message: 'Cảm ơn bạn, tôi sẽ xem lại thông tin.', time: '08:16', color: '#FFF1E5', unread: true },
  { initials: 'NP', name: 'Nội thất Phú An', message: 'Đã nhận được tài liệu, xin cảm ơn.', time: 'Hôm qua', color: '#E9F8F1', unread: false },
];

export default function InboxScreen() {
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>CRM & CHĂM SÓC KHÁCH HÀNG</Text>
        <Text style={styles.title}>Hộp thư</Text>
        <Text style={styles.subtitle}>Hội thoại từ các kênh được kết nối.</Text>
        <View style={styles.filters}><Text style={styles.activeFilter}>Tất cả 08</Text><Text style={styles.filter}>Chưa đọc 02</Text><Text style={styles.filter}>Đang xử lý</Text></View>
        <View style={styles.list}>
          {conversations.map((item) => (
            <Card key={item.name} style={styles.row}>
              <View style={[styles.avatar, { backgroundColor: item.color }]}><Text style={styles.initials}>{item.initials}</Text></View>
              <View style={styles.copy}>
                <View style={styles.nameLine}><Text style={styles.name}>{item.name}</Text><Text style={styles.time}>{item.time}</Text></View>
                <Text numberOfLines={1} style={styles.message}>{item.message}</Text>
              </View>
              {item.unread && <View style={styles.unread} />}
            </Card>
          ))}
        </View>
        <Text style={styles.note}>Màn hình hộp thư hiện dùng dữ liệu mẫu; kết nối kênh sẽ được bổ sung theo API.</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: 18 },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  title: { color: colors.ink, fontSize: 27, fontWeight: '800', marginTop: 5 },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 6 },
  filters: { flexDirection: 'row', gap: 8, marginTop: 20, marginBottom: 14 },
  activeFilter: { color: colors.white, backgroundColor: colors.primary, overflow: 'hidden', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, fontSize: 10, fontWeight: '700' },
  filter: { color: colors.muted, backgroundColor: colors.white, overflow: 'hidden', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, fontSize: 10, fontWeight: '600' },
  list: { gap: 9 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  avatar: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  initials: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  copy: { flex: 1, marginLeft: 12 },
  nameLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  time: { color: colors.muted, fontSize: 9 },
  message: { color: colors.muted, fontSize: 10, marginTop: 6 },
  unread: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary, marginLeft: 8 },
  note: { textAlign: 'center', color: colors.muted, fontSize: 10, lineHeight: 16, paddingHorizontal: 12, marginTop: 20 },
});
