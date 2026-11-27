import { FullScreenFormModal } from '@/components/FullScreenFormModal';
import { PopupError } from '@/components/PopupError';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Download, FilePlus2, ChevronRight, Folder, Pencil, Plus, Star, Trash2 } from 'lucide-react-native';
import { Card } from '@/components/Card';
import { withAppLockSuspended } from '@/core/auth/appLockSuspension';
import {
  createPromptTemplate,
  downloadAssistantProjectFile,
  generateUuidV4,
  listAssistantProjects,
  listPromptTemplates,
  saveAssistantProjects,
  togglePromptTemplateFavorite,
  uploadAssistantProjectFile,
} from '@/features/assistant/assistantApi';
import type { AssistantProject, AssistantPromptTemplate } from '@/features/assistant/types';
import { colors } from '@/theme/colors';
import { saveAndShareExport } from '@/features/quotation/fileExport';

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
  const [editingProject, setEditingProject] = useState<AssistantProject | null>(null);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [uploadingProjectId, setUploadingProjectId] = useState<string | null>(null);

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

  const openEditor = useCallback((project?: AssistantProject) => {
    setEditingProject(project ?? null);
    setName(project?.name ?? '');
    setInstructions(project?.instructions ?? '');
    setCreateOpen(true);
  }, []);

  const onCreate = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert('Thiếu tên dự án', 'Hãy nhập tên dự án mới.');
      return;
    }
    setSaving(true);
    try {
      const next: AssistantProject = editingProject
        ? { ...editingProject, name: name.trim(), instructions: instructions.trim() }
        : {
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
      const updated = await saveAssistantProjects(editingProject
        ? projects.map((project) => project.id === editingProject.id ? next : project)
        : [next, ...projects], { branchId });
      setProjects(updated);
      setCreateOpen(false);
      setName('');
      setInstructions('');
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể lưu dự án.');
    } finally {
      setSaving(false);
    }
  }, [branchId, editingProject, instructions, name, projects]);

  const onDelete = useCallback(
    async (projectId: string) => {
      Alert.alert('Xóa dự án?', 'Các cuộc hội thoại và tệp gắn với dự án này sẽ bị xóa khỏi danh sách dự án.', [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Xóa', style: 'destructive', onPress: () => { void (async () => {
      try {
        const updated = await saveAssistantProjects(
          projects.filter((p) => p.id !== projectId),
          { branchId },
        );
        setProjects(updated);
      } catch (err) {
        Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể xóa dự án.');
      }
        })(); } },
      ]);
    },
    [branchId, projects],
  );

  const onToggleFavorite = useCallback(async (project: AssistantProject) => {
    try {
      const updated = await saveAssistantProjects(projects.map((item) => item.id === project.id ? { ...item, favorite: !item.favorite } : item), { branchId });
      setProjects(updated);
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể cập nhật dự án.');
    }
  }, [branchId, projects]);

  const onUploadFile = useCallback(async (project: AssistantProject) => {
    try {
      const picked = await withAppLockSuspended(() => DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true }));
      if (picked.canceled || !picked.assets[0]) return;
      setUploadingProjectId(project.id);
      const uploaded = await uploadAssistantProjectFile(project.id, picked.assets[0], { branchId });
      setProjects((prev) => prev.map((item) => item.id === project.id ? { ...item, files: [...item.files, uploaded] } : item));
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể tải tệp lên dự án.');
    } finally {
      setUploadingProjectId(null);
    }
  }, [branchId]);

  const onDownloadFile = useCallback(async (project: AssistantProject, file: AssistantProject['files'][number]) => {
    try {
      const blob = await downloadAssistantProjectFile(project.id, file.id, { branchId });
      await saveAndShareExport(blob, file.name, blob.type || 'application/octet-stream');
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể tải tệp dự án.');
    }
  }, [branchId]);

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.sectionHead}>
        <View style={styles.headCopy}>
          <Text style={styles.sectionTitle}>Dự án Trợ lý</Text>
          <Text style={styles.mutedText}>Nhóm hội thoại và chỉ dẫn theo từng dự án riêng.</Text>
        </View>
        <Pressable onPress={() => openEditor()} style={styles.primaryBtn}>
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
          <PopupError error={error} />
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
            <View key={project.id} style={styles.projectItem}>
              <Card onPress={() => onOpenProjectChat(project)} style={styles.cardRow}>
                <View style={styles.iconBox}><Folder size={19} color={colors.primary} /></View>
                <View style={styles.cardCopy}>
                  <Text numberOfLines={1} style={styles.cardTitle}>{project.name}</Text>
                  <Text numberOfLines={2} style={styles.cardDesc}>{project.instructions || 'Chưa có chỉ dẫn riêng cho dự án này.'}</Text>
                  <Text style={styles.cardMeta}>{project.conversations.length} hội thoại · {project.files.length} tệp</Text>
                </View>
                <ChevronRight size={16} color={colors.muted} />
              </Card>
              <View style={styles.projectActions}>
                <Pressable accessibilityLabel={project.favorite ? 'Bỏ yêu thích' : 'Yêu thích'} onPress={() => void onToggleFavorite(project)} hitSlop={8}>
                  <Star size={16} color={project.favorite ? '#D97706' : colors.muted} fill={project.favorite ? '#D97706' : 'transparent'} />
                </Pressable>
                <Pressable accessibilityLabel={`Sửa ${project.name}`} onPress={() => openEditor(project)} hitSlop={8}><Pencil size={15} color={colors.primary} /></Pressable>
                <Pressable accessibilityLabel="Tệp dự án" onPress={() => setExpandedProject((current) => current === project.id ? null : project.id)} hitSlop={8}><FilePlus2 size={16} color={colors.primary} /></Pressable>
                <Pressable accessibilityLabel={`Xóa ${project.name}`} onPress={() => onDelete(project.id)} hitSlop={8}><Trash2 size={15} color="#C74848" /></Pressable>
              </View>
              {expandedProject === project.id ? (
                <Card style={styles.projectFiles}>
                  <View style={styles.fileHead}>
                    <Text style={styles.cardTitle}>Tệp dự án</Text>
                    <Pressable disabled={uploadingProjectId === project.id} onPress={() => void onUploadFile(project)} style={[styles.secondaryBtn, uploadingProjectId === project.id && styles.disabled]}>
                      <View style={styles.iconButtonContent}><FilePlus2 size={13} color={colors.primary} /><Text style={styles.secondaryBtnText}>{uploadingProjectId === project.id ? 'Đang tải…' : 'Tải tệp lên'}</Text></View>
                    </Pressable>
                  </View>
                  {project.files.length ? project.files.map((file) => (
                    <View key={file.id} style={styles.fileRow}>
                      <Text numberOfLines={1} style={styles.fileName}>{file.name}</Text>
                      <Pressable accessibilityLabel={`Tải ${file.name}`} onPress={() => void onDownloadFile(project, file)} hitSlop={8}><Download size={16} color={colors.primary} /></Pressable>
                    </View>
                  )) : <Text style={styles.mutedText}>Chưa có tệp nào trong dự án.</Text>}
                </Card>
              ) : null}
            </View>
          ))}
        </View>
      )}

      <FullScreenFormModal
        visible={createOpen}
        title={editingProject ? 'Sửa dự án' : 'Tạo dự án mới'}
        onClose={() => setCreateOpen(false)}
        footer={
          <Pressable
            disabled={saving}
            onPress={() => void onCreate()}
            style={[styles.submitBtn, saving && styles.disabled]}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.submitBtnText}>{editingProject ? 'Lưu thay đổi' : 'Tạo dự án'}</Text>
            )}
          </Pressable>
        }
      >
        <View style={styles.formBody}>
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
        </View>
      </FullScreenFormModal>
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
      } catch (err) {
        Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể cập nhật câu lệnh yêu thích.');
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
          <PopupError error={error} />
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

      <FullScreenFormModal
        visible={createOpen}
        title="Thêm mẫu câu lệnh"
        onClose={() => setCreateOpen(false)}
        footer={
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
        }
      >
        <View style={styles.formBody}>
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
        </View>
      </FullScreenFormModal>
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
  projectItem: { gap: 6 },
  cardRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 11 },
  projectActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 16, paddingHorizontal: 12, paddingBottom: 4 },
  projectFiles: { padding: 12, gap: 9 },
  fileHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  fileName: { flex: 1, color: colors.ink, fontSize: 11 },
  iconBox: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' },
  cardCopy: { flex: 1 },
  cardTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  cardDesc: { color: colors.muted, fontSize: 11, marginTop: 3, lineHeight: 16 },
  cardMeta: { color: colors.primary, fontSize: 9, fontWeight: '700', marginTop: 4 },
  delText: { color: '#C74848', fontSize: 10, fontWeight: '700' },
  secondaryBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  secondaryBtnText: { color: colors.primary, fontSize: 10, fontWeight: '700' },
  promptCard: { padding: 13, gap: 4 },
  promptTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  promptBadge: { color: colors.primary, fontSize: 9, fontWeight: '800', backgroundColor: '#EAF2FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, overflow: 'hidden' },
  usePromptBtn: { marginTop: 8, alignSelf: 'flex-start' },
  usePromptContent: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  usePromptText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  formBody: { gap: 10 },
  field: { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, fontSize: 12, color: colors.ink },
  fieldMulti: { minHeight: 86, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: colors.primary, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  disabled: { opacity: 0.45 },
});

