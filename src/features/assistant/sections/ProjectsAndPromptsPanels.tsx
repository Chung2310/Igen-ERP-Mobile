import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ChevronRight, Folder, Plus, Star } from 'lucide-react-native';
import { Card } from '@/components/Card';
import {
  createPromptTemplate,
  generateUuidV4,
  listAssistantProjects,
  listPromptTemplates,
  saveAssistantProjects,
  togglePromptTemplateFavorite,
} from '@/features/assistant/assistantApi';
import type { AssistantProject, AssistantPromptTemplate } from '@/features/assistant/types';
import { colors } from '@/theme/colors';

// --- 1. Projects Panel ---
export function ProjectsPanel({
  branchId,
  onOpenProjectChat,
}: {
  branchId?: string;
  onOpenProjectChat: (project: AssistantProject) => void;
}) {
  const [projects, setProjects] = useState<AssistantProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listAssistantProjects({ branchId });
      setProjects(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách dự án.');
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreate = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert('Thiếu tên dự án', 'Hãy nhập tên dự án mới.');
      return;
    }
    setSaving(true);
    try {
      const next: AssistantProject = {
        id: generateUuidV4(),
        name: name.trim(),
        icon: 'folder',
        tone: 'primary',
        favorite: false,
        instructions: instructions.trim(),
        model: 'iGenAI',
        conversations: [],
        files: [],
        createdAt: new Date().toISOString(),
      };
      const updated = await saveAssistantProjects([next, ...projects], { branchId });
      setProjects(updated);
      setCreateOpen(false);
      setName('');
      setInstructions('');
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể lưu dự án.');
    } finally {
      setSaving(false);
    }
  }, [branchId, instructions, name, projects]);

  const onDelete = useCallback(
    async (projectId: string) => {
      try {
        const updated = await saveAssistantProjects(
          projects.filter((p) => p.id !== projectId),
          { branchId },
        );
        setProjects(updated);
      } catch (err) {
        Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể xóa dự án.');
      }
    },
    [branchId, projects],
  );

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.sectionHead}>
        <View style={styles.headCopy}>
          <Text style={styles.sectionTitle}>Dự án Trợ lý</Text>
          <Text style={styles.mutedText}>Nhóm hội thoại và chỉ dẫn theo từng dự án riêng.</Text>
        </View>
        <Pressable onPress={() => setCreateOpen(true)} style={styles.primaryBtn}>
          <View style={styles.iconButtonContent}><Plus size={14} color={colors.white} /><Text style={styles.primaryBtnText}>Tạo dự án</Text></View>
        </Pressable>
      </View>

      {loading ? (
        <Card style={styles.stateCard}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.mutedText}>Đang tải dự án...</Text>
        </Card>
      ) : error ? (
        <Card style={styles.stateCard}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => void load()} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Thử lại</Text>
          </Pressable>
        </Card>
      ) : !projects.length ? (
        <Card style={styles.stateCard}>
          <Text style={styles.mutedText}>
            Chưa có dự án nào. Tạo dự án để tổ chức hội thoại và chỉ dẫn riêng cho từng đầu việc.
          </Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {projects.map((project) => (
            <Card
              key={project.id}
              onPress={() => onOpenProjectChat(project)}
              style={styles.cardRow}
            >
              <View style={styles.iconBox}>
                <Folder size={19} color={colors.primary} />
              </View>
              <View style={styles.cardCopy}>
                <Text numberOfLines={1} style={styles.cardTitle}>
                  {project.name}
                </Text>
                <Text numberOfLines={2} style={styles.cardDesc}>
                  {project.instructions || 'Chưa có chỉ dẫn riêng cho dự án này.'}
                </Text>
                <Text style={styles.cardMeta}>
                  {project.conversations.length} hội thoại · {project.files.length} tệp
                </Text>
              </View>
              <Pressable onPress={() => void onDelete(project.id)} hitSlop={8}>
                <Text style={styles.delText}>Xóa</Text>
              </Pressable>
            </Card>
          ))}
        </View>
      )}

      <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setCreateOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Tạo dự án mới</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Tên dự án (VD: Kế hoạch quý 4)"
              placeholderTextColor={colors.muted}
              style={styles.field}
            />
            <TextInput
              value={instructions}
              onChangeText={setInstructions}
              placeholder="Chỉ dẫn ngữ cảnh cho Trợ lý khi làm việc trong dự án này..."
              placeholderTextColor={colors.muted}
              multiline
              style={[styles.field, styles.fieldMulti]}
            />
            <Pressable
              disabled={saving}
              onPress={() => void onCreate()}
              style={[styles.submitBtn, saving && styles.disabled]}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.submitBtnText}>Tạo dự án</Text>
              )}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

// --- 2. Prompt Library Panel ---
const PROMPT_CATEGORIES = [
  'Tất cả',
  'Yêu thích',
  'Kinh doanh',
  'Tài chính',
  'Nhân sự',
  'Marketing',
  'Công nghệ thông tin',
];

export function PromptLibraryPanel({
  onUsePrompt,
}: {
  onUsePrompt: (prompt: string) => void;
}) {
  const [templates, setTemplates] = useState<AssistantPromptTemplate[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState('Tất cả');
  const [search, setSearch] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [newCategory, setNewCategory] = useState('Kinh doanh');
  const [promptText, setPromptText] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listPromptTemplates();
      setTemplates(res.templates);
      setFavoriteIds(res.favoriteIds);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được thư viện câu lệnh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onToggleFav = useCallback(
    async (id: string) => {
      const isFav = favoriteIds.includes(id);
      try {
        await togglePromptTemplateFavorite(id, !isFav);
        setFavoriteIds((prev) =>
          isFav ? prev.filter((item) => item !== id) : [...prev, id],
        );
      } catch {
        // Ignore
      }
    },
    [favoriteIds],
  );

  const onCreate = useCallback(async () => {
    if (!title.trim() || !promptText.trim()) {
      Alert.alert('Thiếu thông tin', 'Hãy nhập tiêu đề và nội dung câu lệnh.');
      return;
    }
    setSaving(true);
    try {
      const created = await createPromptTemplate({
        title: title.trim(),
        description: desc.trim() || title.trim(),
        category: newCategory,
        prompt: promptText.trim(),
      });
      setTemplates((prev) => [created, ...prev]);
      setCreateOpen(false);
      setTitle('');
      setDesc('');
      setPromptText('');
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể lưu câu lệnh.');
    } finally {
      setSaving(false);
    }
  }, [desc, newCategory, promptText, title]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((item) => {
      if (category === 'Yêu thích' && !favoriteIds.includes(item.id)) return false;
      if (category !== 'Tất cả' && category !== 'Yêu thích' && item.category !== category) {
        return false;
      }
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.prompt.toLowerCase().includes(q)
      );
    });
  }, [category, favoriteIds, search, templates]);

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.sectionHead}>
        <View style={styles.headCopy}>
          <Text style={styles.sectionTitle}>Thư viện câu lệnh</Text>
          <Text style={styles.mutedText}>Chọn mẫu câu lệnh chuyên sâu để dùng ngay.</Text>
        </View>
        <Pressable onPress={() => setCreateOpen(true)} style={styles.primaryBtn}>
          <View style={styles.iconButtonContent}><Plus size={14} color={colors.white} /><Text style={styles.primaryBtnText}>Thêm mẫu</Text></View>
        </Pressable>
      </View>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Tìm mẫu câu lệnh..."
        placeholderTextColor={colors.muted}
        style={styles.searchField}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catRow}
        style={styles.catScroll}
      >
        {PROMPT_CATEGORIES.map((cat) => {
          const active = category === cat;
          return (
            <Pressable
              key={cat}
              onPress={() => setCategory(cat)}
              style={[styles.catChip, active && styles.catChipActive]}
            >
              <Text style={[styles.catText, active && styles.catTextActive]}>{cat}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <Card style={styles.stateCard}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.mutedText}>Đang tải thư viện câu lệnh...</Text>
        </Card>
      ) : error ? (
        <Card style={styles.stateCard}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => void load()} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Thử lại</Text>
          </Pressable>
        </Card>
      ) : !filtered.length ? (
        <Card style={styles.stateCard}>
          <Text style={styles.mutedText}>Không có mẫu câu lệnh phù hợp.</Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {filtered.slice(0, 40).map((item) => {
            const isFav = favoriteIds.includes(item.id);
            return (
              <Card key={item.id} style={styles.promptCard}>
                <View style={styles.promptTop}>
                  <Text style={styles.promptBadge}>{item.category}</Text>
                  <Pressable onPress={() => void onToggleFav(item.id)} hitSlop={8}>
                    <Star size={17} color={isFav ? '#D97706' : colors.muted} fill={isFav ? '#D97706' : 'transparent'} />
                  </Pressable>
                </View>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text numberOfLines={2} style={styles.cardDesc}>
                  {item.description}
                </Text>
                <Pressable
                  onPress={() => onUsePrompt(item.prompt)}
                  style={styles.usePromptBtn}
                >
                  <View style={styles.usePromptContent}><Text style={styles.usePromptText}>Dùng câu lệnh này</Text><ChevronRight size={14} color={colors.primary} /></View>
                </Pressable>
              </Card>
            );
          })}
        </View>
      )}

      <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setCreateOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Thêm mẫu câu lệnh</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Tiêu đề mẫu câu lệnh"
              placeholderTextColor={colors.muted}
              style={styles.field}
            />
            <TextInput
              value={desc}
              onChangeText={setDesc}
              placeholder="Mô tả ngắn"
              placeholderTextColor={colors.muted}
              style={styles.field}
            />
            <TextInput
              value={newCategory}
              onChangeText={setNewCategory}
              placeholder="Danh mục (Kinh doanh, Tài chính, Nhân sự...)"
              placeholderTextColor={colors.muted}
              style={styles.field}
            />
            <TextInput
              value={promptText}
              onChangeText={setPromptText}
              placeholder="Nội dung câu lệnh chi tiết..."
              placeholderTextColor={colors.muted}
              multiline
              style={[styles.field, styles.fieldMulti]}
            />
            <Pressable
              disabled={saving}
              onPress={() => void onCreate()}
              style={[styles.submitBtn, saving && styles.disabled]}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.submitBtnText}>Lưu mẫu câu lệnh</Text>
              )}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingBottom: 24 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 10 },
  headCopy: { flex: 1 },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  mutedText: { color: colors.muted, fontSize: 11, marginTop: 2 },
  primaryBtn: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  iconButtonContent: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  primaryBtnText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  searchField: { backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, fontSize: 12, color: colors.ink, marginBottom: 10 },
  catScroll: { marginHorizontal: -18, marginBottom: 12 },
  catRow: { paddingHorizontal: 18, gap: 6 },
  catChip: { backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 99 },
  catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  catTextActive: { color: colors.white },
  stateCard: { padding: 20, alignItems: 'center', gap: 10 },
  errorText: { color: '#B91C1C', fontSize: 12, textAlign: 'center' },
  list: { gap: 10 },
  cardRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 11 },
  iconBox: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' },
  cardCopy: { flex: 1 },
  cardTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  cardDesc: { color: colors.muted, fontSize: 11, marginTop: 3, lineHeight: 16 },
  cardMeta: { color: colors.primary, fontSize: 9, fontWeight: '700', marginTop: 4 },
  delText: { color: '#C74848', fontSize: 10, fontWeight: '700' },
  promptCard: { padding: 13, gap: 4 },
  promptTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  promptBadge: { color: colors.primary, fontSize: 9, fontWeight: '800', backgroundColor: '#EAF2FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, overflow: 'hidden' },
  usePromptBtn: { marginTop: 8, alignSelf: 'flex-start' },
  usePromptContent: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  usePromptText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 28, gap: 10 },
  sheetTitle: { color: colors.ink, fontSize: 16, fontWeight: '800', marginBottom: 4 },
  field: { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, fontSize: 12, color: colors.ink },
  fieldMulti: { minHeight: 86, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: colors.primary, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  submitBtnText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  disabled: { opacity: 0.45 },
});

