import { PopupError } from '@/components/PopupError';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { ArrowLeft, FilePlus2, Link2, Pencil, Plus, Send, Sparkles, Star, Trash2, X } from 'lucide-react-native';
import { Card } from '@/components/Card';
import { withAppLockSuspended } from '@/core/auth/appLockSuspension';
import {
  chatWithAssistantAgent,
  createAssistantAgent,
  deleteAssistantAgent,
  extractAssistantAgentFile,
  extractAssistantAgentLink,
  generateUuidV4,
  listAssistantAgents,
  setAssistantAgentFavorite,
  updateAssistantAgent,
} from '@/features/assistant/assistantApi';
import type { AgentChatMessage, AgentKnowledge, UserAssistantAgent } from '@/features/assistant/types';
import { colors } from '@/theme/colors';

const TONE_OPTIONS = ['Tự động', 'Chuyên nghiệp', 'Thân thiện', 'Ngắn gọn', 'Phân tích'];

export function AgentsPanel() {
  const [agents, setAgents] = useState<UserAssistantAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active agent chat
  const [activeAgent, setActiveAgent] = useState<UserAssistantAgent | null>(null);
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  // Agent editor
  const [createOpen, setCreateOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<UserAssistantAgent | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [avoid, setAvoid] = useState('');
  const [tone, setTone] = useState('Chuyên nghiệp');
  const [openingQuestions, setOpeningQuestions] = useState('');
  const [knowledge, setKnowledge] = useState<UserAssistantAgent['knowledge']>([]);
  const [knowledgeTitle, setKnowledgeTitle] = useState('');
  const [knowledgeContent, setKnowledgeContent] = useState('');
  const [knowledgeLink, setKnowledgeLink] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listAssistantAgents();
      setAgents(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách trợ lý.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openEditor = useCallback((agent?: UserAssistantAgent) => {
    setEditingAgent(agent ?? null);
    setName(agent?.name ?? '');
    setDescription(agent?.description ?? '');
    setInstructions(agent?.instructions ?? '');
    setAvoid(agent?.avoid ?? '');
    setTone(agent?.tone || 'Chuyên nghiệp');
    setOpeningQuestions(agent?.openingQuestions?.join('\n') ?? '');
    setKnowledge(agent?.knowledge ?? []);
    setKnowledgeTitle('');
    setKnowledgeContent('');
    setKnowledgeLink('');
    setCreateOpen(true);
  }, []);

  const onSaveAgent = useCallback(async () => {
    if (!name.trim() || !instructions.trim()) {
      Alert.alert('Thiếu thông tin', 'Hãy nhập tên trợ lý và chỉ dẫn hoạt động.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || 'Trợ lý AI tùy chỉnh',
        instructions: instructions.trim(),
        avoid: avoid.trim(),
        tone,
        avatar: editingAgent?.avatar ?? Math.floor(Math.random() * 6),
        favorite: editingAgent?.favorite ?? false,
        openingQuestions: openingQuestions.split('\n').map((item) => item.trim()).filter(Boolean).slice(0, 4),
        knowledge,
      };
      const saved = editingAgent
        ? await updateAssistantAgent(editingAgent.id, payload)
        : await createAssistantAgent({ id: generateUuidV4(), ...payload });
      setAgents((prev) => editingAgent
        ? prev.map((agent) => agent.id === saved.id ? saved : agent)
        : [saved, ...prev]);
      setCreateOpen(false);
      if (editingAgent?.id === activeAgent?.id) setActiveAgent(saved);
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể lưu trợ lý.');
    } finally {
      setSaving(false);
    }
  }, [activeAgent?.id, avoid, description, editingAgent, instructions, knowledge, name, openingQuestions, tone]);

  const addKnowledge = useCallback((item: AgentKnowledge) => {
    setKnowledge((prev) => [...prev, { ...item, id: generateUuidV4(), createdAt: new Date().toISOString() }]);
    setKnowledgeTitle('');
    setKnowledgeContent('');
    setKnowledgeLink('');
  }, []);

  const onAddKnowledgeLink = useCallback(async () => {
    if (!knowledgeLink.trim() || extracting) return;
    setExtracting(true);
    try {
      const result = await extractAssistantAgentLink(knowledgeLink.trim());
      if (!result.text.trim()) throw new Error('Không trích xuất được nội dung từ liên kết này.');
      addKnowledge({ title: result.title, kind: 'link', content: result.text.slice(0, 10000) });
    } catch (err) {
      Alert.alert('Không tải được liên kết', err instanceof Error ? err.message : 'Vui lòng thử lại.');
    } finally {
      setExtracting(false);
    }
  }, [addKnowledge, extracting, knowledgeLink]);

  const onAddKnowledgeFile = useCallback(async () => {
    try {
      const picked = await withAppLockSuspended(() => DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/plain', 'text/markdown', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      }));
      if (picked.canceled || !picked.assets[0]) return;
      setExtracting(true);
      const result = await extractAssistantAgentFile(picked.assets[0]);
      if (!result.text.trim()) throw new Error('Tệp không có nội dung để lưu làm kiến thức.');
      addKnowledge({ title: result.fileName, kind: 'file', content: result.text.slice(0, 10000) });
    } catch (err) {
      Alert.alert('Không đọc được tệp', err instanceof Error ? err.message : 'Vui lòng thử lại.');
    } finally {
      setExtracting(false);
    }
  }, [addKnowledge]);
  const onToggleFav = useCallback(async (agent: UserAssistantAgent) => {
    try {
      const updated = await setAssistantAgentFavorite(agent.id, !agent.favorite);
      setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể cập nhật trạng thái yêu thích.');
    }
  }, []);

  const deleteAgent = useCallback(async (agent: UserAssistantAgent) => {
    try {
      await deleteAssistantAgent(agent.id);
      setAgents((prev) => prev.filter((a) => a.id !== agent.id));
      if (activeAgent?.id === agent.id) setActiveAgent(null);
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể xóa trợ lý.');
    }
  }, [activeAgent?.id]);

  const onDelete = useCallback((agent: UserAssistantAgent) => {
    Alert.alert('Xóa trợ lý?', `Trợ lý “${agent.name}” và dữ liệu trò chuyện trên thiết bị sẽ bị xóa.`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: () => { void deleteAgent(agent); } },
    ]);
  }, [deleteAgent]);
  const onSendAgentMsg = useCallback(async () => {
    if (!activeAgent || !draft.trim() || sending) return;
    const text = draft.trim();
    const nextMessages: AgentChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setDraft('');
    setSending(true);
    try {
      const reply = await chatWithAssistantAgent(activeAgent, nextMessages);
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Trợ lý chưa thể trả lời.');
    } finally {
      setSending(false);
    }
  }, [activeAgent, draft, messages, sending]);

  if (activeAgent) {
    return (
      <View style={styles.chatWrap}>
        <View style={styles.chatHeader}>
          <Pressable
            onPress={() => {
              setActiveAgent(null);
              setMessages([]);
            }}
            style={styles.backBtn}
          >
            <ArrowLeft size={17} color={colors.primary} />
          </Pressable>
          <View style={styles.chatHeaderCopy}>
            <Text numberOfLines={1} style={styles.chatTitle}>
              {activeAgent.name}
            </Text>
            <Text numberOfLines={1} style={styles.chatSub}>
              {activeAgent.tone || 'Tự động'} · {activeAgent.description}
            </Text>
          </View>
          <Pressable accessibilityLabel="Sửa trợ lý" onPress={() => openEditor(activeAgent)} style={styles.headerAction}>
            <Pencil size={15} color={colors.primary} />
          </Pressable>
        </View>

        <FlatList
          data={messages}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.msgList}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={styles.emptyText}>Bắt đầu trò chuyện với trợ lý “{activeAgent.name}”.</Text>
              {activeAgent.openingQuestions?.map((question) => (
                <Pressable key={question} style={styles.questionChip} onPress={() => setDraft(question)}>
                  <Text style={styles.questionText}>{question}</Text>
                </Pressable>
              ))}
            </View>
          }
          renderItem={({ item }) => {
            const isUser = item.role === 'user';
            return (
              <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
                <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
                  {item.content}
                </Text>
              </View>
            );
          }}
          ListFooterComponent={
            sending ? (
              <View style={styles.thinking}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.mutedText}>Đang trả lời...</Text>
              </View>
            ) : undefined
          }
        />

        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={`Nhắn cho ${activeAgent.name}...`}
            placeholderTextColor={colors.muted}
            style={styles.composerInput}
          />
          <Pressable
            disabled={sending || !draft.trim()}
            onPress={() => {
              void onSendAgentMsg();
            }}
            style={[styles.sendBtn, (sending || !draft.trim()) && styles.disabled]}
          >
            <Send size={16} color={colors.white} />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.sectionHead}>
        <View style={styles.headCopy}>
          <Text style={styles.sectionTitle}>Trợ lý AI tùy chỉnh</Text>
          <Text style={styles.mutedText}>Tạo trợ lý theo vai trò và tri thức riêng.</Text>
        </View>
        <Pressable onPress={() => openEditor()} style={styles.primaryBtn}>
          <View style={styles.iconButtonContent}><Plus size={14} color={colors.white} /><Text style={styles.primaryBtnText}>Tạo mới</Text></View>
        </Pressable>
      </View>

      {loading ? (
        <Card style={styles.stateCard}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.mutedText}>Đang tải trợ lý AI...</Text>
        </Card>
      ) : error ? (
        <Card style={styles.stateCard}>
          <PopupError error={error} />
          <Pressable onPress={() => void load()} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Thử lại</Text>
          </Pressable>
        </Card>
      ) : !agents.length ? (
        <Card style={styles.stateCard}>
          <Text style={styles.mutedText}>
            Chưa có trợ lý tùy chỉnh nào. Bấm "Tạo mới" để tạo trợ lý đầu tiên.
          </Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {agents.map((agent) => (
            <Card
              key={agent.id}
              onPress={() => {
                setActiveAgent(agent);
                setMessages([]);
              }}
              style={styles.cardRow}
            >
              <View style={styles.agentIcon}>
                <Sparkles size={20} color={colors.primary} />
              </View>
              <View style={styles.cardCopy}>
                <Text numberOfLines={1} style={styles.cardTitle}>
                  {agent.name}
                </Text>
                <Text numberOfLines={2} style={styles.cardDesc}>
                  {agent.description || agent.instructions}
                </Text>
                <Text style={styles.cardMeta}>
                  {agent.tone || 'Tự động'} · {agent.knowledge?.length ?? 0} tài liệu
                </Text>
              </View>
              <View style={styles.cardActions}>
                <Pressable onPress={() => void onToggleFav(agent)} hitSlop={8}>
                  <Star size={18} color={agent.favorite ? '#D97706' : colors.muted} fill={agent.favorite ? '#D97706' : 'transparent'} />
                </Pressable>
                <Pressable accessibilityLabel={`Sửa ${agent.name}`} onPress={() => openEditor(agent)} hitSlop={8}>
                  <Pencil size={16} color={colors.primary} />
                </Pressable>
                <Pressable onPress={() => void onDelete(agent)} hitSlop={8}>
                  <Trash2 size={16} color="#C74848" />
                </Pressable>
              </View>
            </Card>
          ))}
        </View>
      )}

      <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{editingAgent ? 'Sửa Trợ lý AI' : 'Tạo Trợ lý AI mới'}</Text>
              <Pressable accessibilityLabel="Đóng" onPress={() => setCreateOpen(false)} hitSlop={8}><X size={19} color={colors.muted} /></Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.editorFields}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Tên trợ lý (VD: Chuyên viên báo giá)"
              placeholderTextColor={colors.muted}
              style={styles.field}
            />
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Mô tả ngắn"
              placeholderTextColor={colors.muted}
              style={styles.field}
            />
            <TextInput
              value={instructions}
              onChangeText={setInstructions}
              placeholder="Chỉ dẫn vai trò và cách trả lời..."
              placeholderTextColor={colors.muted}
              multiline
              style={[styles.field, styles.fieldMulti]}
            />
            <TextInput
              value={avoid}
              onChangeText={setAvoid}
              placeholder="Những điều trợ lý không được làm"
              placeholderTextColor={colors.muted}
              multiline
              style={[styles.field, styles.fieldMulti]}
            />
            <Text style={styles.fieldLabel}>Câu hỏi mở đầu (mỗi dòng một câu, tối đa 4)</Text>
            <TextInput
              value={openingQuestions}
              onChangeText={setOpeningQuestions}
              placeholder="Ví dụ: Giúp tôi lập kế hoạch tuần này"
              placeholderTextColor={colors.muted}
              multiline
              style={[styles.field, styles.openingField]}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toneRow}>
              {TONE_OPTIONS.map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setTone(t)}
                  style={[styles.toneChip, tone === t && styles.toneChipActive]}
                >
                  <Text style={[styles.toneText, tone === t && styles.toneTextActive]}>{t}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.fieldLabel}>Kiến thức của trợ lý ({knowledge.length})</Text>
            <TextInput value={knowledgeTitle} onChangeText={setKnowledgeTitle} placeholder="Tên tài liệu hoặc ghi chú" placeholderTextColor={colors.muted} style={styles.field} />
            <TextInput value={knowledgeContent} onChangeText={setKnowledgeContent} placeholder="Nội dung kiến thức" placeholderTextColor={colors.muted} multiline style={[styles.field, styles.knowledgeField]} />
            <Pressable
              disabled={!knowledgeTitle.trim() || !knowledgeContent.trim()}
              onPress={() => {
                if (!knowledgeTitle.trim() || !knowledgeContent.trim()) return;
                addKnowledge({ title: knowledgeTitle.trim(), kind: 'text', content: knowledgeContent.trim().slice(0, 10000) });
              }}
              style={[styles.secondaryBtn, (!knowledgeTitle.trim() || !knowledgeContent.trim()) && styles.disabled]}
            ><Text style={styles.secondaryBtnText}>Thêm ghi chú kiến thức</Text></Pressable>
            <TextInput value={knowledgeLink} onChangeText={setKnowledgeLink} placeholder="https:// liên kết tài liệu" placeholderTextColor={colors.muted} autoCapitalize="none" keyboardType="url" style={styles.field} />
            <View style={styles.knowledgeActions}>
              <Pressable disabled={extracting || !knowledgeLink.trim()} onPress={() => void onAddKnowledgeLink()} style={[styles.secondaryBtn, (extracting || !knowledgeLink.trim()) && styles.disabled]}>
                <View style={styles.iconButtonContent}><Link2 size={14} color={colors.primary} /><Text style={styles.secondaryBtnText}>{extracting ? 'Đang đọc...' : 'Thêm liên kết'}</Text></View>
              </Pressable>
              <Pressable disabled={extracting} onPress={() => void onAddKnowledgeFile()} style={[styles.secondaryBtn, extracting && styles.disabled]}>
                <View style={styles.iconButtonContent}><FilePlus2 size={14} color={colors.primary} /><Text style={styles.secondaryBtnText}>Tải tài liệu</Text></View>
              </Pressable>
            </View>
            {knowledge.map((item) => (
              <View key={item.id} style={styles.knowledgeRow}>
                <View style={styles.cardCopy}><Text numberOfLines={1} style={styles.knowledgeName}>{item.title}</Text><Text style={styles.cardMeta}>{item.kind === 'file' ? 'Tệp' : item.kind === 'link' ? 'Liên kết' : 'Ghi chú'}</Text></View>
                <Pressable accessibilityLabel={`Xóa ${item.title}`} onPress={() => setKnowledge((prev) => prev.filter((row) => row.id !== item.id))} hitSlop={8}><Trash2 size={15} color="#C74848" /></Pressable>
              </View>
            ))}
            </ScrollView>
            <Pressable
              disabled={saving || extracting}
              onPress={() => void onSaveAgent()}
              style={[styles.submitBtn, (saving || extracting) && styles.disabled]}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.submitBtnText}>{editingAgent ? 'Lưu thay đổi' : 'Lưu trợ lý'}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingBottom: 24 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 10 },
  headCopy: { flex: 1 },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  mutedText: { color: colors.muted, fontSize: 11, marginTop: 2 },
  primaryBtn: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  iconButtonContent: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  primaryBtnText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  stateCard: { padding: 20, alignItems: 'center', gap: 10 },
  errorText: { color: '#B91C1C', fontSize: 12, textAlign: 'center' },
  list: { gap: 10 },
  cardRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 11 },
  agentIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' },
  cardCopy: { flex: 1 },
  cardTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  cardDesc: { color: colors.muted, fontSize: 11, marginTop: 2, lineHeight: 16 },
  cardMeta: { color: colors.primary, fontSize: 9, fontWeight: '700', marginTop: 4 },
  cardActions: { alignItems: 'flex-end', gap: 8 },
  delText: { color: '#C74848', fontSize: 10, fontWeight: '700' },
  chatWrap: { flex: 1 },
  chatHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' },
  headerAction: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' },
  chatHeaderCopy: { flex: 1 },
  chatTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  chatSub: { color: colors.muted, fontSize: 10 },
  msgList: { padding: 16, gap: 10, flexGrow: 1 },
  emptyText: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 32 },
  emptyChat: { alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  questionChip: { maxWidth: '100%', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  questionText: { color: colors.primary, fontSize: 11, textAlign: 'center' },
  bubble: { borderRadius: 15, paddingHorizontal: 13, paddingVertical: 10, maxWidth: '86%' },
  bubbleBot: { alignSelf: 'flex-start', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  bubbleUser: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  bubbleText: { color: colors.ink, fontSize: 13, lineHeight: 19 },
  bubbleTextUser: { color: colors.white },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border },
  composerInput: { flex: 1, backgroundColor: colors.background, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: colors.ink },
  sendBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.45 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 28, gap: 10, maxHeight: '92%' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  editorFields: { gap: 10, paddingBottom: 8 },
  sheetTitle: { color: colors.ink, fontSize: 16, fontWeight: '800', marginBottom: 4 },
  fieldLabel: { color: colors.ink, fontSize: 11, fontWeight: '700', marginTop: 3 },
  field: { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, fontSize: 12, color: colors.ink },
  fieldMulti: { minHeight: 86, textAlignVertical: 'top' },
  openingField: { minHeight: 70, textAlignVertical: 'top' },
  knowledgeField: { minHeight: 72, textAlignVertical: 'top' },
  knowledgeActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  secondaryBtn: { alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8 },
  secondaryBtnText: { color: colors.primary, fontSize: 10, fontWeight: '700' },
  knowledgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, backgroundColor: colors.background },
  knowledgeName: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  toneRow: { gap: 6, paddingVertical: 4 },
  toneChip: { backgroundColor: '#F3F6FB', paddingHorizontal: 11, paddingVertical: 6, borderRadius: 99 },
  toneChipActive: { backgroundColor: '#EAF2FF', borderWidth: 1, borderColor: colors.primary },
  toneText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  toneTextActive: { color: colors.primary, fontWeight: '700' },
  submitBtn: { backgroundColor: colors.primary, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  submitBtnText: { color: colors.white, fontSize: 13, fontWeight: '700' },
});

