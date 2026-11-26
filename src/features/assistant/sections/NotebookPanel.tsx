import { useCallback, useEffect, useMemo, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { ArrowLeft, FilePlus2, Heart, Link2, Plus, Send, Trash2 } from 'lucide-react-native';
import { Card } from '@/components/Card';
import { PopupError } from '@/components/PopupError';
import { withAppLockSuspended } from '@/core/auth/appLockSuspension';
import { chatWithAssistantAgent, extractAssistantAgentFile, extractAssistantAgentLink, generateUuidV4 } from '@/features/assistant/assistantApi';
import type { AgentChatMessage, AgentKnowledge } from '@/features/assistant/types';
import { colors } from '@/theme/colors';

type NotebookKind = 'analysis' | 'research';
type NotebookSource = AgentKnowledge & { id: string; createdAt: string; selected: boolean };
type NotebookRecord = { id: string; name: string; kind: NotebookKind; sources: NotebookSource[]; messages: AgentChatMessage[]; favorite: boolean; updatedAt: string };
const notebookFile = Platform.OS === 'web' ? null : new File(Paths.document, 'igen-ai-notebooks.json');
async function readNotebookRecords(): Promise<NotebookRecord[]> {
  const raw = Platform.OS === 'web'
    ? localStorage.getItem('igen-ai-notebooks')
    : notebookFile?.exists ? await notebookFile.text() : null;
  if (!raw) return [];
  const saved: unknown = JSON.parse(raw);
  return Array.isArray(saved) ? saved as NotebookRecord[] : [];
}
async function saveNotebookRecords(items: NotebookRecord[]) {
  const serialized = JSON.stringify(items);
  if (Platform.OS === 'web') {
    localStorage.setItem('igen-ai-notebooks', serialized);
    return;
  }
  if (!notebookFile) return;
  if (!notebookFile.exists) notebookFile.create({ intermediates: true });
  await notebookFile.write(serialized);
}
const quickPrompts = [
  'Tóm tắt các nguồn đã chọn thành những ý chính.',
  'Đối chiếu các nguồn và nêu điểm giống, khác nhau.',
  'Trích xuất thông tin quan trọng, chỉ rõ nguồn tương ứng.',
  'Phân tích dữ liệu và nêu các điểm cần kiểm tra thêm.',
];

export function NotebookPanel() {
  const [notebooks, setNotebooks] = useState<NotebookRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sourceKind, setSourceKind] = useState<'text' | 'link'>('text');
  const [sourceTitle, setSourceTitle] = useState('');
  const [sourceContent, setSourceContent] = useState('');
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const saved = await readNotebookRecords();
        if (active) setNotebooks(saved);
      } catch {
        if (active) setError('Không đọc được sổ Notebook đã lưu trên thiết bị.');
      } finally {
        if (active) setLoaded(true);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    void (async () => {
      try {
        await saveNotebookRecords(notebooks);
      } catch {
        setError('Không lưu được Notebook vào thiết bị. Hãy kiểm tra dung lượng bộ nhớ.');
      }
    })();
  }, [loaded, notebooks]);

  const activeNotebook = notebooks.find((item) => item.id === activeId) ?? null;
  const visibleNotebooks = useMemo(() => notebooks.filter((item) => item.name.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi'))), [notebooks, search]);

  const createNotebook = useCallback((kind: NotebookKind) => {
    const item: NotebookRecord = {
      id: generateUuidV4(),
      name: kind === 'analysis' ? 'Sổ phân tích mới' : 'Sổ nghiên cứu mới',
      kind,
      sources: [],
      messages: [],
      favorite: false,
      updatedAt: new Date().toISOString(),
    };
    setNotebooks((prev) => [item, ...prev]);
    setActiveId(item.id);
    setError(null);
  }, []);

  const updateNotebook = useCallback((id: string, update: Partial<NotebookRecord>) => {
    setNotebooks((prev) => prev.map((item) => item.id === id ? { ...item, ...update, updatedAt: new Date().toISOString() } : item));
  }, []);

  const addSource = useCallback((source: Omit<NotebookSource, 'id' | 'createdAt' | 'selected'>) => {
    if (!activeNotebook) return;
    updateNotebook(activeNotebook.id, { sources: [...activeNotebook.sources, { ...source, id: generateUuidV4(), createdAt: new Date().toISOString(), selected: true }] });
    setSourceTitle('');
    setSourceContent('');
  }, [activeNotebook, updateNotebook]);

  const onAddSource = useCallback(async () => {
    if (!sourceTitle.trim() || !sourceContent.trim()) {
      Alert.alert('Thiếu nội dung', 'Nhập tên và nội dung nguồn trước khi thêm.');
      return;
    }
    setBusy(true);
    try {
      const content = sourceKind === 'link'
        ? (await extractAssistantAgentLink(sourceContent.trim())).text
        : sourceContent.trim();
      if (!content.trim()) throw new Error('Không tìm thấy nội dung để thêm vào Notebook.');
      addSource({ title: sourceTitle.trim(), kind: sourceKind, content: content.slice(0, 10000) });
    } catch (cause) {
      Alert.alert('Không thêm được nguồn', cause instanceof Error ? cause.message : 'Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }, [addSource, sourceContent, sourceKind, sourceTitle]);

  const onAddFile = useCallback(async () => {
    try {
      const picked = await withAppLockSuspended(() => DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'text/plain', 'text/markdown', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], copyToCacheDirectory: true }));
      if (picked.canceled || !picked.assets[0]) return;
      setBusy(true);
      const result = await extractAssistantAgentFile(picked.assets[0]);
      if (!result.text.trim()) throw new Error('Tệp không có nội dung để phân tích.');
      addSource({ title: result.fileName, kind: 'file', content: result.text.slice(0, 10000) });
    } catch (cause) {
      Alert.alert('Không đọc được tệp', cause instanceof Error ? cause.message : 'Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }, [addSource]);

  const onAsk = useCallback(async (text = question) => {
    if (!activeNotebook || !text.trim() || busy) return;
    const sources = activeNotebook.sources.filter((source) => source.selected);
    if (!sources.length) {
      Alert.alert('Chưa chọn nguồn', 'Chọn ít nhất một tài liệu hoặc ghi chú để hỏi Notebook.');
      return;
    }
    const userMessage: AgentChatMessage = { role: 'user', content: text.trim() };
    const nextMessages = [...activeNotebook.messages, userMessage];
    updateNotebook(activeNotebook.id, { messages: nextMessages });
    setQuestion('');
    setBusy(true);
    setError(null);
    try {
      const agent = {
        id: activeNotebook.id,
        name: activeNotebook.name,
        description: activeNotebook.kind === 'analysis' ? 'Notebook phân tích dữ liệu' : 'Notebook nghiên cứu tài liệu',
        instructions: activeNotebook.kind === 'analysis'
          ? 'Phân tích, tính toán và chỉ ra xu hướng dựa trên nguồn được chọn. Không tự suy đoán dữ liệu.'
          : 'Nghiên cứu, giải thích và trích xuất thông tin chỉ dựa trên các nguồn được chọn. Nêu rõ khi nguồn không đủ bằng chứng.',
        avoid: 'Không bịa thông tin hoặc viện dẫn nguồn không có trong Notebook.',
        tone: 'Rõ ràng, chuyên nghiệp',
        avatar: 0,
        favorite: activeNotebook.favorite,
        openingQuestions: [],
        knowledge: sources.map(({ id, title, kind, content, createdAt }) => ({ id, title, kind, content, createdAt })),
      };
      const reply = await chatWithAssistantAgent(agent, nextMessages);
      updateNotebook(activeNotebook.id, { messages: [...nextMessages, { role: 'assistant', content: reply }] });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Notebook chưa thể trả lời.');
    } finally {
      setBusy(false);
    }
  }, [activeNotebook, busy, question, updateNotebook]);

  if (!loaded) return <View style={styles.loading}><ActivityIndicator size="small" color={colors.primary} /></View>;

  if (!activeNotebook) return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Notebook AI</Text>
      <Text style={styles.muted}>Tập hợp nhiều nguồn, đặt câu hỏi và lưu sổ ngay trên thiết bị.</Text>
      <PopupError error={error} />
      <View style={styles.createRow}>
        <Pressable style={styles.primaryButton} onPress={() => createNotebook('analysis')}><Plus size={15} color={colors.white} /><Text style={styles.primaryButtonText}>Phân tích dữ liệu</Text></Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => createNotebook('research')}><Plus size={15} color={colors.primary} /><Text style={styles.secondaryText}>Nghiên cứu tài liệu</Text></Pressable>
      </View>
      <TextInput value={search} onChangeText={setSearch} placeholder="Tìm sổ Notebook" placeholderTextColor={colors.muted} style={styles.input} />
      {visibleNotebooks.map((item) => (
        <Card key={item.id} style={styles.notebookCard}>
          <Pressable style={styles.notebookOpen} onPress={() => setActiveId(item.id)}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.muted}>{item.kind === 'analysis' ? 'Phân tích dữ liệu' : 'Nghiên cứu tài liệu'} · {item.sources.length} nguồn · {item.messages.length} tin nhắn</Text>
          </Pressable>
          <View style={styles.actionRow}>
            <Pressable onPress={() => updateNotebook(item.id, { favorite: !item.favorite })}><Heart size={16} color={item.favorite ? '#D97706' : colors.muted} fill={item.favorite ? '#D97706' : 'transparent'} /></Pressable>
            <Pressable onPress={() => Alert.alert('Xóa Notebook?', `Xóa sổ “${item.name}” trên thiết bị?`, [{ text: 'Hủy', style: 'cancel' }, { text: 'Xóa', style: 'destructive', onPress: () => setNotebooks((prev) => prev.filter((row) => row.id !== item.id)) }])}><Trash2 size={16} color="#C74848" /></Pressable>
          </View>
        </Card>
      ))}
      {!visibleNotebooks.length ? <Card style={styles.empty}><Text style={styles.muted}>Chưa có Notebook phù hợp. Hãy tạo sổ đầu tiên.</Text></Card> : null}
    </ScrollView>
  );

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Danh sách Notebook" onPress={() => setActiveId(null)} style={styles.backButton}><ArrowLeft size={16} color={colors.primary} /></Pressable>
        <TextInput value={activeNotebook.name} onChangeText={(name) => updateNotebook(activeNotebook.id, { name })} style={[styles.input, styles.nameInput]} />
        <Text style={styles.muted}>{activeNotebook.kind === 'analysis' ? 'Phân tích' : 'Nghiên cứu'}</Text>
      </View>
      <Card style={styles.addSourceCard}>
        <Text style={styles.cardTitle}>Thêm nguồn</Text>
        <View style={styles.actionRow}>
          {(['text', 'link'] as const).map((kind) => <Pressable key={kind} onPress={() => setSourceKind(kind)} style={[styles.kindChip, sourceKind === kind && styles.kindChipActive]}><Text style={[styles.kindText, sourceKind === kind && styles.kindTextActive]}>{kind === 'text' ? 'Ghi chú' : 'Liên kết'}</Text></Pressable>)}
          <Pressable disabled={busy} onPress={() => void onAddFile()} style={[styles.kindChip, busy && styles.disabled]}><View style={styles.iconRow}><FilePlus2 size={13} color={colors.primary} /><Text style={styles.kindText}>Tệp</Text></View></Pressable>
        </View>
        <TextInput value={sourceTitle} onChangeText={setSourceTitle} placeholder="Tên nguồn" placeholderTextColor={colors.muted} style={styles.input} />
        <TextInput value={sourceContent} onChangeText={setSourceContent} placeholder={sourceKind === 'link' ? 'https://...' : 'Dán ghi chú hoặc nội dung cần nghiên cứu'} placeholderTextColor={colors.muted} multiline style={[styles.input, styles.multiline]} />
        <Pressable disabled={busy || !sourceTitle.trim() || !sourceContent.trim()} onPress={() => void onAddSource()} style={[styles.secondaryButton, (busy || !sourceTitle.trim() || !sourceContent.trim()) && styles.disabled]}><View style={styles.iconRow}><Link2 size={14} color={colors.primary} /><Text style={styles.secondaryText}>{busy ? 'Đang xử lý…' : sourceKind === 'link' ? 'Đọc liên kết' : 'Thêm ghi chú'}</Text></View></Pressable>
      </Card>

      <Text style={styles.sectionTitle}>Nguồn trong sổ ({activeNotebook.sources.length})</Text>
      {activeNotebook.sources.map((source) => (
        <Card key={source.id} style={styles.sourceRow}>
          <Switch value={source.selected} onValueChange={(selected) => updateNotebook(activeNotebook.id, { sources: activeNotebook.sources.map((item) => item.id === source.id ? { ...item, selected } : item) })} trackColor={{ true: colors.primary, false: '#CBD5E1' }} />
          <View style={styles.sourceCopy}><Text numberOfLines={1} style={styles.cardTitle}>{source.title}</Text><Text style={styles.muted}>{source.kind === 'file' ? 'Tệp' : source.kind === 'link' ? 'Liên kết' : 'Ghi chú'} · {source.content.length.toLocaleString()} ký tự</Text></View>
          <Pressable accessibilityLabel={`Xóa nguồn ${source.title}`} onPress={() => updateNotebook(activeNotebook.id, { sources: activeNotebook.sources.filter((item) => item.id !== source.id) })}><Trash2 size={15} color="#C74848" /></Pressable>
        </Card>
      ))}

      <Text style={styles.sectionTitle}>Hỏi Notebook</Text>
      <View style={styles.quickPromptRow}>{quickPrompts.map((prompt) => <Pressable key={prompt} onPress={() => void onAsk(prompt)} style={styles.questionChip}><Text style={styles.questionText}>{prompt}</Text></Pressable>)}</View>
      {activeNotebook.messages.map((message, index) => (
        <View key={`${activeNotebook.id}-${index}`} style={[styles.message, message.role === 'user' ? styles.userMessage : styles.assistantMessage]}><Text style={styles.messageText}>{message.content}</Text></View>
      ))}
      {busy ? <View style={styles.loadingInline}><ActivityIndicator size="small" color={colors.primary} /><Text style={styles.muted}>Đang phân tích…</Text></View> : null}
      <PopupError error={error} />
      <View style={styles.composer}><TextInput value={question} onChangeText={setQuestion} placeholder="Hỏi về các nguồn đã chọn" placeholderTextColor={colors.muted} multiline style={[styles.input, styles.questionInput]} /><Pressable disabled={busy || !question.trim()} onPress={() => void onAsk()} style={[styles.sendButton, (busy || !question.trim()) && styles.disabled]}><Send size={15} color={colors.white} /></Pressable></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 10 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  sectionTitle: { marginTop: 8, color: colors.ink, fontSize: 14, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  cardTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.white, paddingHorizontal: 11, paddingVertical: 9, color: colors.ink, fontSize: 12 },
  createRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 4 },
  primaryButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  primaryButtonText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  secondaryButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9 },
  secondaryText: { color: colors.primary, fontSize: 10, fontWeight: '700' },
  notebookCard: { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  notebookOpen: { flex: 1, gap: 4 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  empty: { padding: 16, alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#EAF2FF' },
  nameInput: { flex: 1, fontWeight: '700' },
  addSourceCard: { padding: 12, gap: 9 },
  kindChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6 },
  kindChipActive: { borderColor: colors.primary, backgroundColor: '#EAF2FF' },
  kindText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  kindTextActive: { color: colors.primary },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  multiline: { minHeight: 68, textAlignVertical: 'top' },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 },
  sourceCopy: { flex: 1 },
  quickPromptRow: { gap: 7 },
  questionChip: { alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: colors.white },
  questionText: { color: colors.primary, fontSize: 10 },
  message: { maxWidth: '92%', padding: 11, borderRadius: 13 },
  userMessage: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  assistantMessage: { alignSelf: 'flex-start', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  messageText: { color: colors.ink, fontSize: 12, lineHeight: 18 },
  loadingInline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  questionInput: { flex: 1, minHeight: 42, maxHeight: 100, textAlignVertical: 'top' },
  sendButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: 12 },
  disabled: { opacity: 0.45 },
});
