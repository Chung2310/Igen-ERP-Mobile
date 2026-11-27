import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Heart, Search, WandSparkles } from 'lucide-react-native';
import { Card } from '@/components/Card';
import { colors } from '@/theme/colors';

type AssistantTool = { id: string; category: string; title: string; description: string; prompt: string };
const tools: AssistantTool[] = [
  { id: 'excel', category: 'Kinh doanh', title: 'Giải thích công thức Excel', description: 'Giải thích từng thành phần và cách dùng công thức.', prompt: 'Giải thích công thức Excel sau, nêu từng thành phần và cho ví dụ: [dán công thức]' },
  { id: 'plan', category: 'Kinh doanh', title: 'Lập kế hoạch kinh doanh', description: 'Lập mục tiêu, chiến lược và các bước triển khai.', prompt: 'Lập kế hoạch kinh doanh cho [sản phẩm/thị trường], gồm mục tiêu, khách hàng, hoạt động, ngân sách và chỉ số đo lường.' },
  { id: 'persona', category: 'Kinh doanh', title: 'Nghiên cứu chân dung khách hàng', description: 'Xác định nhu cầu, hành vi và rào cản của khách hàng.', prompt: 'Tạo chân dung khách hàng cho [sản phẩm/dịch vụ], gồm nhu cầu, hành vi, động lực, rào cản và thông điệp phù hợp.' },
  { id: 'feedback', category: 'Kinh doanh', title: 'Phân tích phản hồi khách hàng', description: 'Tổng hợp review, khảo sát và phản hồi.', prompt: 'Phân tích phản hồi khách hàng dưới đây, nhóm chủ đề, nêu xu hướng, vấn đề ưu tiên và đề xuất cải thiện: [dán dữ liệu]' },
  { id: 'sales-email', category: 'Kinh doanh', title: 'Soạn email bán hàng', description: 'Viết email giới thiệu sản phẩm hoặc thúc đẩy mua hàng.', prompt: 'Soạn email bán hàng cho [đối tượng], giới thiệu [sản phẩm], giọng điệu chuyên nghiệp và có lời kêu gọi hành động.' },
  { id: 'budget', category: 'Tài chính', title: 'Tóm tắt ngân sách', description: 'Làm rõ các khoản thu chi và điểm cần theo dõi.', prompt: 'Tóm tắt ngân sách sau thành khoản mục, tổng thu chi, chênh lệch và điểm cần theo dõi: [dán dữ liệu]' },
  { id: 'job', category: 'Nhân sự', title: 'Soạn mô tả công việc', description: 'Phác thảo nhiệm vụ, yêu cầu và quyền lợi.', prompt: 'Soạn mô tả công việc cho vị trí [tên vị trí], gồm mục tiêu, nhiệm vụ, yêu cầu và quyền lợi.' },
  { id: 'meeting', category: 'Văn phòng', title: 'Tóm tắt cuộc họp', description: 'Sắp xếp nội dung thảo luận và việc cần làm.', prompt: 'Tóm tắt nội dung cuộc họp sau thành nội dung chính, quyết định, việc cần làm, người phụ trách và hạn nếu được nêu: [dán nội dung]' },
  { id: 'strategy', category: 'Chiến lược', title: 'Phác thảo chiến lược', description: 'Sắp xếp mục tiêu, ưu tiên và bước thực hiện.', prompt: 'Phác thảo chiến lược cho [mục tiêu], gồm bối cảnh, ưu tiên, sáng kiến, rủi ro và các bước triển khai.' },
  { id: 'technical', category: 'CNTT', title: 'Viết yêu cầu kỹ thuật', description: 'Tóm tắt bối cảnh, nhu cầu và tiêu chí nghiệm thu.', prompt: 'Viết yêu cầu kỹ thuật cho [nhu cầu], gồm bối cảnh, phạm vi, luồng chính, ràng buộc và tiêu chí nghiệm thu.' },
];
const categories = ['Tất cả', ...Array.from(new Set(tools.map((tool) => tool.category)))];
const favoritesStorageKey = 'igen-assistant-tool-favorites';

export function AssistantToolsPanel({ onUsePrompt }: { onUsePrompt: (prompt: string) => void }) {
  const [category, setCategory] = useState('Tất cả');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  const [search, setSearch] = useState('');
  useEffect(() => {
    void (async () => {
      try {
        const saved = Platform.OS === 'web' ? localStorage.getItem(favoritesStorageKey) : await SecureStore.getItemAsync(favoritesStorageKey);
        const parsed: unknown = saved ? JSON.parse(saved) : [];
        if (Array.isArray(parsed)) setFavorites(parsed.filter((item): item is string => typeof item === 'string'));
      } catch {
        setFavorites([]);
      } finally {
        setFavoritesLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!favoritesLoaded) return;
    const serialized = JSON.stringify(favorites);
    if (Platform.OS === 'web') {
      try { localStorage.setItem(favoritesStorageKey, serialized); } catch { /* Keep favorites in memory. */ }
    } else {
      void SecureStore.setItemAsync(favoritesStorageKey, serialized).catch(() => {});
    }
  }, [favorites, favoritesLoaded]);
  const filtered = useMemo(() => tools.filter((tool) =>
    (category === 'Tất cả' || tool.category === category)
    && (!favoritesOnly || favorites.includes(tool.id))
    && `${tool.title} ${tool.description}`.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')),
  ), [category, favorites, favoritesOnly, search]);

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Công cụ trợ lý</Text>
      <Text style={styles.muted}>Chọn một mẫu để đưa yêu cầu vào cuộc trò chuyện và chỉnh sửa trước khi gửi.</Text>
      <View style={styles.searchBox}><Search size={15} color={colors.muted} /><TextInput value={search} onChangeText={setSearch} placeholder="Tìm công cụ" placeholderTextColor={colors.muted} style={styles.searchInput} /></View>
      <View style={styles.filterRow}>
        {categories.map((item) => <Pressable key={item} onPress={() => { setCategory(item); setFavoritesOnly(false); }} style={[styles.chip, category === item && !favoritesOnly && styles.chipActive]}><Text style={[styles.chipText, category === item && !favoritesOnly && styles.chipTextActive]}>{item}</Text></Pressable>)}
        <Pressable onPress={() => setFavoritesOnly((value) => !value)} style={[styles.chip, favoritesOnly && styles.chipActive]}><Text style={[styles.chipText, favoritesOnly && styles.chipTextActive]}>Yêu thích</Text></Pressable>
      </View>
      {filtered.map((tool) => (
        <Card key={tool.id} style={styles.toolCard}>
          <View style={styles.toolIcon}><WandSparkles size={17} color={colors.primary} /></View>
          <View style={styles.toolCopy}>
            <Text style={styles.category}>{tool.category}</Text>
            <Text style={styles.toolTitle}>{tool.title}</Text>
            <Text style={styles.muted}>{tool.description}</Text>
            <Pressable onPress={() => onUsePrompt(tool.prompt)} style={styles.useButton}><Text style={styles.useText}>Dùng công cụ</Text></Pressable>
          </View>
          <Pressable accessibilityLabel={favorites.includes(tool.id) ? 'Bỏ yêu thích' : 'Yêu thích'} onPress={() => setFavorites((prev) => prev.includes(tool.id) ? prev.filter((id) => id !== tool.id) : [...prev, tool.id])} hitSlop={8}>
            <Heart size={17} color={favorites.includes(tool.id) ? '#D97706' : colors.muted} fill={favorites.includes(tool.id) ? '#D97706' : 'transparent'} />
          </Pressable>
        </Card>
      ))}
      {!filtered.length ? <Card style={styles.empty}><Text style={styles.muted}>{favoritesOnly ? 'Chưa có công cụ yêu thích.' : 'Không tìm thấy công cụ phù hợp.'}</Text></Card> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 30, gap: 10 },
  title: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, backgroundColor: colors.white, borderWidth: 1, borderColor: '#DCE5F2', borderRadius: 99, paddingHorizontal: 14 },
  searchInput: { flex: 1, color: '#111827', fontSize: 13.5, paddingVertical: 0 },
  filterRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 6 },
  chipActive: { backgroundColor: '#EAF2FF', borderColor: colors.primary },
  chipText: { color: colors.muted, fontSize: 9, fontWeight: '700' },
  chipTextActive: { color: colors.primary },
  toolCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 12 },
  toolIcon: { width: 33, height: 33, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#EAF2FF' },
  toolCopy: { flex: 1, gap: 3 },
  category: { color: colors.primary, fontSize: 9, fontWeight: '700' },
  toolTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  useButton: { alignSelf: 'flex-start', marginTop: 3 },
  useText: { color: colors.primary, fontSize: 10, fontWeight: '800' },
  empty: { padding: 16, alignItems: 'center' },
});
