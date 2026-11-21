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
import { ArrowLeft, Plus, Send, Sparkles, Star } from 'lucide-react-native';
import { Card } from '@/components/Card';
import {
  chatWithAssistantAgent,
  createAssistantAgent,
  deleteAssistantAgent,
  generateUuidV4,
  listAssistantAgents,
  setAssistantAgentFavorite,
} from '@/features/assistant/assistantApi';
import type { AgentChatMessage, UserAssistantAgent } from '@/features/assistant/types';
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

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [tone, setTone] = useState('Chuyên nghiệp');
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

  const onCreate = useCallback(async () => {
    if (!name.trim() || !instructions.trim()) {
      Alert.alert('Thiếu thông tin', 'Hãy nhập tên trợ lý và chỉ dẫn hoạt động.');
      return;
    }
    setSaving(true);
    try {
      const created = await createAssistantAgent({
        id: generateUuidV4(),
        name: name.trim(),
        description: description.trim() || 'Trợ lý AI tùy chỉnh',
        instructions: instructions.trim(),
        avoid: '',
        tone,
        avatar: Math.floor(Math.random() * 6),
        favorite: false,
        openingQuestions: [],
        knowledge: [],
      });
      setAgents((prev) => [created, ...prev]);
      setCreateOpen(false);
      setName('');
      setDescription('');
      setInstructions('');
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể tạo trợ lý.');
    } finally {
      setSaving(false);
    }
  }, [description, instructions, name, tone]);

  const onToggleFav = useCallback(async (agent: UserAssistantAgent) => {
    try {
      const updated = await setAssistantAgentFavorite(agent.id, !agent.favorite);
      setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } catch {
      // Ignore
    }
  }, []);

  const onDelete = useCallback(async (agent: UserAssistantAgent) => {
    try {
      await deleteAssistantAgent(agent.id);
      setAgents((prev) => prev.filter((a) => a.id !== agent.id));
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể xóa trợ lý.');
    }
  }, []);

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
        </View>

        <FlatList
          data={messages}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.msgList}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              Bắt đầu trò chuyện với trợ lý "{activeAgent.name}".
            </Text>
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
        <Pressable onPress={() => setCreateOpen(true)} style={styles.primaryBtn}>
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
          <Text style={styles.errorText}>{error}</Text>
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
                <Pressable onPress={() => void onDelete(agent)} hitSlop={8}>
                  <Text style={styles.delText}>Xóa</Text>
                </Pressable>
              </View>
            </Card>
          ))}
        </View>
      )}

      <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setCreateOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Tạo Trợ lý AI mới</Text>
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
            <Pressable
              disabled={saving}
              onPress={() => void onCreate()}
              style={[styles.submitBtn, saving && styles.disabled]}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.submitBtnText}>Lưu trợ lý</Text>
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
  chatHeaderCopy: { flex: 1 },
  chatTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  chatSub: { color: colors.muted, fontSize: 10 },
  msgList: { padding: 16, gap: 10, flexGrow: 1 },
  emptyText: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 32 },
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
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 28, gap: 10 },
  sheetTitle: { color: colors.ink, fontSize: 16, fontWeight: '800', marginBottom: 4 },
  field: { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, fontSize: 12, color: colors.ink },
  fieldMulti: { minHeight: 86, textAlignVertical: 'top' },
  toneRow: { gap: 6, paddingVertical: 4 },
  toneChip: { backgroundColor: '#F3F6FB', paddingHorizontal: 11, paddingVertical: 6, borderRadius: 99 },
  toneChipActive: { backgroundColor: '#EAF2FF', borderWidth: 1, borderColor: colors.primary },
  toneText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  toneTextActive: { color: colors.primary, fontWeight: '700' },
  submitBtn: { backgroundColor: colors.primary, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  submitBtnText: { color: colors.white, fontSize: 13, fontWeight: '700' },
});

