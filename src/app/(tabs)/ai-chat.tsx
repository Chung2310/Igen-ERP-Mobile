import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { colors } from '@/theme/colors';

const suggestions = [
  'Tóm tắt doanh thu tháng này',
  'Khoản công nợ nào sắp đến hạn?',
  'Mặt hàng nào cần nhập thêm?',
];

export default function AiChatScreen() {
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>TRỢ LÝ DOANH NGHIỆP</Text>
        <Text style={styles.title}>Trò chuyện AI</Text>
        <Text style={styles.subtitle}>Hỏi đáp và tra cứu dữ liệu ERP theo quyền của bạn.</Text>

        <Card style={styles.assistantCard}>
          <View style={styles.assistantIcon}><Text style={styles.assistantGlyph}>✦</Text></View>
          <Text style={styles.assistantTitle}>Trợ lý Igen</Text>
          <Text style={styles.assistantText}>Có thể giúp bạn tóm tắt số liệu, tìm thông tin và hướng dẫn thao tác trong ERP.</Text>
        </Card>

        <Text style={styles.sectionTitle}>Bạn có thể hỏi</Text>
        <View style={styles.suggestions}>
          {suggestions.map((suggestion) => (
            <Card key={suggestion} style={styles.suggestion}>
              <Text style={styles.suggestionText}>{suggestion}</Text>
              <Text style={styles.arrow}>›</Text>
            </Card>
          ))}
        </View>

        <View style={styles.spacer} />
        <Card style={styles.composer}>
          <TextInput editable={false} placeholder="Nhắn câu hỏi cho trợ lý..." placeholderTextColor={colors.muted} style={styles.input} />
          <View style={styles.sendButton}><Text style={styles.sendGlyph}>↑</Text></View>
        </Card>
        <Text style={styles.note}>Bản khung giao diện · cần kết nối dịch vụ AI trước khi gửi câu hỏi hoặc thực hiện nghiệp vụ.</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 18, paddingTop: 16, paddingBottom: 20 },
  eyebrow: { color: colors.primary, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  title: { color: colors.ink, fontSize: 25, fontWeight: '800', marginTop: 5 },
  subtitle: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 6 },
  assistantCard: { alignItems: 'center', padding: 20, marginTop: 22, backgroundColor: '#EEF4FF', borderColor: '#DDE9FF' },
  assistantIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: '#DCE8FF', alignItems: 'center', justifyContent: 'center' },
  assistantGlyph: { color: colors.primary, fontSize: 26 },
  assistantTitle: { color: colors.ink, fontSize: 15, fontWeight: '800', marginTop: 12 },
  assistantText: { color: colors.muted, fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 7, maxWidth: 250 },
  sectionTitle: { color: colors.ink, fontSize: 13, fontWeight: '800', marginTop: 24, marginBottom: 10 },
  suggestions: { gap: 8 },
  suggestion: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 12 },
  suggestionText: { color: colors.ink, fontSize: 10, flex: 1 },
  arrow: { color: colors.primary, fontSize: 20, marginLeft: 8 },
  spacer: { flexGrow: 1, minHeight: 40 },
  composer: { flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 17 },
  input: { color: colors.ink, flex: 1, paddingHorizontal: 9, fontSize: 11 },
  sendButton: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendGlyph: { color: colors.white, fontSize: 18, fontWeight: '700' },
  note: { color: colors.muted, fontSize: 8, lineHeight: 13, textAlign: 'center', marginTop: 10 },
});
