import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Mic, Plus, Presentation, Sparkles, TrendingUp } from 'lucide-react-native';
import { Card } from '@/components/Card';
import {
  createAssistantMemory,
  createStudioSlideDeck,
  deleteAssistantMemory,
  getAssistantSettings,
  listAssistantMemories,
  listAssistantWorkflows,
  listStudioAssets,
  saveAssistantSettings,
  saveAssistantWorkflow,
} from '@/features/assistant/assistantApi';
import type {
  AssistantChartHistoryItem,
  AssistantMemory,
  AssistantSettings,
  AssistantSlideHistoryItem,
  AssistantStudioTranscript,
  AssistantWorkflow,
} from '@/features/assistant/types';
import { colors } from '@/theme/colors';

// --- 1. Memory Panel ---
export function MemoryPanel() {
  const [memories, setMemories] = useState<AssistantMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMemories(await listAssistantMemories());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được bộ nhớ AI.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onAdd = useCallback(async () => {
    if (!draft.trim() || saving) return;
    setSaving(true);
    try {
      const item = await createAssistantMemory(draft.trim());
      setMemories((prev) => [item, ...prev]);
      setDraft('');
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể lưu ghi nhớ.');
    } finally {
      setSaving(false);
    }
  }, [draft, saving]);

  const onDelete = useCallback(async (id: string) => {
    try {
      await deleteAssistantMemory(id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể xóa ghi nhớ.');
    }
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Bộ nhớ dài hạn của Trợ lý</Text>
      <Text style={styles.mutedText}>
        Lưu các thông tin ngữ cảnh để Trợ lý ERP luôn ghi nhớ trong mọi hội thoại.
      </Text>

      <Card style={styles.addBox}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="VD: Luôn trình bày báo cáo theo đơn vị triệu đồng..."
          placeholderTextColor={colors.muted}
          multiline
          style={styles.input}
        />
        <Pressable
          disabled={saving || !draft.trim()}
          onPress={() => void onAdd()}
          style={[styles.primaryBtn, (saving || !draft.trim()) && styles.disabled]}
        >
          <View style={styles.iconButtonContent}>
            {!saving ? <Plus size={14} color={colors.white} /> : null}
            <Text style={styles.primaryBtnText}>{saving ? 'Đang lưu...' : 'Thêm ghi nhớ'}</Text>
          </View>
        </Pressable>
      </Card>

      {loading ? (
        <Card style={styles.stateCard}>
          <ActivityIndicator size="small" color={colors.primary} />
        </Card>
      ) : error ? (
        <Card style={styles.stateCard}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => void load()} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Thử lại</Text>
          </Pressable>
        </Card>
      ) : !memories.length ? (
        <Card style={styles.stateCard}>
          <Text style={styles.mutedText}>Chưa có ghi nhớ nào được lưu.</Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {memories.map((item) => (
            <Card key={item.id} style={styles.memCard}>
              <Text style={styles.memText}>{item.content}</Text>
              <View style={styles.memFooter}>
                <Text style={styles.badge}>
                  {item.source === 'automatic' ? 'Tự động' : 'Thủ công'}
                </Text>
                <Pressable onPress={() => void onDelete(item.id)} hitSlop={8}>
                  <Text style={styles.delText}>Xóa</Text>
                </Pressable>
              </View>
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// --- 2. Workflows Panel ---
export function WorkflowsPanel() {
  const [workflows, setWorkflows] = useState<AssistantWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setWorkflows(await listAssistantWorkflows());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được quy trình trợ lý.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onUpdate = useCallback(async (wf: AssistantWorkflow, patch: Partial<AssistantWorkflow>) => {
    setBusyId(wf.actionId);
    try {
      const updated = await saveAssistantWorkflow({ ...wf, ...patch });
      setWorkflows((prev) => prev.map((w) => (w.actionId === updated.actionId ? updated : w)));
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể cập nhật quy trình.');
    } finally {
      setBusyId(null);
    }
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Quy trình nghiệp vụ ERP</Text>
      <Text style={styles.mutedText}>
        Kiểm soát các nghiệp vụ Trợ lý được phép thực hiện và yêu cầu xác nhận trước khi chạy.
      </Text>

      {loading ? (
        <Card style={styles.stateCard}>
          <ActivityIndicator size="small" color={colors.primary} />
        </Card>
      ) : error ? (
        <Card style={styles.stateCard}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => void load()} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Thử lại</Text>
          </Pressable>
        </Card>
      ) : !workflows.length ? (
        <Card style={styles.stateCard}>
          <Text style={styles.mutedText}>Chưa có quy trình khả dụng cho tài khoản này.</Text>
        </Card>
      ) : (
        <View style={[styles.list, { marginTop: 12 }]}>
          {workflows.map((wf) => (
            <Card key={wf.actionId} style={styles.wfCard}>
              <View style={styles.wfTop}>
                <View style={styles.wfCopy}>
                  <Text style={styles.badge}>{wf.module}</Text>
                  <Text style={styles.cardTitle}>{wf.title}</Text>
                  <Text numberOfLines={2} style={styles.mutedText}>
                    {wf.description}
                  </Text>
                </View>
                <Switch
                  disabled={busyId === wf.actionId}
                  value={wf.enabled}
                  onValueChange={(enabled) => void onUpdate(wf, { enabled })}
                  trackColor={{ true: colors.primary, false: '#CBD5E1' }}
                />
              </View>
              <View style={styles.wfRow}>
                <Text style={styles.wfSubLabel}>Yêu cầu xác nhận trước khi thực hiện</Text>
                <Switch
                  disabled={busyId === wf.actionId || wf.confirmationLocked}
                  value={wf.requireConfirmation}
                  onValueChange={(requireConfirmation) =>
                    void onUpdate(wf, { requireConfirmation })
                  }
                  trackColor={{ true: colors.primary, false: '#CBD5E1' }}
                />
              </View>
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// --- 3. Studio Panel ---
export function StudioPanel() {
  const [slides, setSlides] = useState<AssistantSlideHistoryItem[]>([]);
  const [charts, setCharts] = useState<AssistantChartHistoryItem[]>([]);
  const [transcripts, setTranscripts] = useState<AssistantStudioTranscript[]>([]);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listStudioAssets();
      setSlides(data.slides);
      setCharts(data.charts);
      setTranscripts(data.transcripts);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreateSlide = useCallback(async () => {
    if (!prompt.trim() || creating) return;
    setCreating(true);
    try {
      await createStudioSlideDeck({
        prompt: prompt.trim(),
        pageCount: 6,
        style: 'modern',
      });
      setPrompt('');
      Alert.alert('Đã tạo Slide', 'Bộ slide mới đã được lưu vào lịch sử Studio của bạn.');
      void load();
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể tạo slide lúc này.');
    } finally {
      setCreating(false);
    }
  }, [creating, load, prompt]);

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>AI Studio</Text>
      <Text style={styles.mutedText}>
        Tạo nhanh bài thuyết trình (Slide) và xem lại các sản phẩm AI đã tạo trên ERP.
      </Text>

      <Card style={styles.addBox}>
        <Text style={styles.cardTitle}>Tạo nhanh bộ Slide (6 trang)</Text>
        <TextInput
          value={prompt}
          onChangeText={setPrompt}
          placeholder="Nhập chủ đề slide (VD: Báo cáo kế hoạch kinh doanh quý 4)..."
          placeholderTextColor={colors.muted}
          multiline
          style={styles.input}
        />
        <Pressable
          disabled={creating || !prompt.trim()}
          onPress={() => void onCreateSlide()}
          style={[styles.primaryBtn, (creating || !prompt.trim()) && styles.disabled]}
        >
          <View style={styles.iconButtonContent}>
            {creating ? null : <Sparkles size={14} color={colors.white} />}
            <Text style={styles.primaryBtnText}>{creating ? 'Đang tạo slide...' : 'Tạo Slide AI'}</Text>
          </View>
        </Pressable>
      </Card>

      {loading ? (
        <Card style={styles.stateCard}>
          <ActivityIndicator size="small" color={colors.primary} />
        </Card>
      ) : (
        <>
          <Text style={styles.subHeading}>Slide đã tạo ({slides.length})</Text>
          {slides.length ? (
            <View style={styles.list}>
              {slides.slice(0, 6).map((s) => (
                <Card key={s.id} style={styles.assetRow}>
                  <Presentation size={20} color={colors.primary} />
                  <View style={styles.wfCopy}>
                    <Text numberOfLines={1} style={styles.cardTitle}>
                      {s.title || 'Bộ slide AI'}
                    </Text>
                    <Text style={styles.mutedText}>
                      {s.pageCount ? `${s.pageCount} trang · ` : ''}
                      {s.createdAt?.slice(0, 10)}
                    </Text>
                  </View>
                </Card>
              ))}
            </View>
          ) : (
            <Card style={styles.stateCard}>
              <Text style={styles.mutedText}>Chưa có bộ slide nào.</Text>
            </Card>
          )}

          <Text style={styles.subHeading}>Biểu đồ đã tạo ({charts.length})</Text>
          {charts.length ? (
            <View style={styles.list}>
              {charts.slice(0, 6).map((c) => (
                <Card key={c.id} style={styles.assetRow}>
                  <TrendingUp size={20} color={colors.primary} />
                  <View style={styles.wfCopy}>
                    <Text numberOfLines={1} style={styles.cardTitle}>
                      {c.title || 'Biểu đồ dữ liệu'}
                    </Text>
                    <Text style={styles.mutedText}>{c.createdAt?.slice(0, 10)}</Text>
                  </View>
                </Card>
              ))}
            </View>
          ) : (
            <Card style={styles.stateCard}>
              <Text style={styles.mutedText}>Chưa có biểu đồ nào.</Text>
            </Card>
          )}

          {transcripts.length > 0 ? (
            <>
              <Text style={styles.subHeading}>Bản ghi âm / chép lời ({transcripts.length})</Text>
              <View style={styles.list}>
                {transcripts.slice(0, 4).map((t) => (
                  <Card key={t.id} style={styles.assetRow}>
                    <Mic size={20} color={colors.primary} />
                    <View style={styles.wfCopy}>
                      <Text numberOfLines={1} style={styles.cardTitle}>
                        {t.fileName}
                      </Text>
                      <Text numberOfLines={2} style={styles.mutedText}>
                        {t.text}
                      </Text>
                    </View>
                  </Card>
                ))}
              </View>
            </>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

// --- 4. Settings Panel ---
export function SettingsPanel() {
  const [settings, setSettings] = useState<AssistantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSettings(await getAssistantSettings());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được cài đặt trợ lý.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onSave = useCallback(async () => {
    if (!settings || saving) return;
    setSaving(true);
    try {
      const updated = await saveAssistantSettings(settings);
      setSettings(updated);
      Alert.alert('Đã lưu', 'Cài đặt Trợ lý ERP đã được cập nhật.');
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể lưu cài đặt.');
    } finally {
      setSaving(false);
    }
  }, [saving, settings]);

  if (loading) {
    return (
      <View style={styles.content}>
        <Card style={styles.stateCard}>
          <ActivityIndicator size="small" color={colors.primary} />
        </Card>
      </View>
    );
  }

  if (error || !settings) {
    return (
      <View style={styles.content}>
        <Card style={styles.stateCard}>
          <Text style={styles.errorText}>{error || 'Chưa tải được cài đặt.'}</Text>
          <Pressable onPress={() => void load()} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Thử lại</Text>
          </Pressable>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Cài đặt Trợ lý ERP</Text>
      <Text style={styles.mutedText}>Tùy chỉnh hành vi, chỉ dẫn và quyền xác nhận của Trợ lý.</Text>

      <Card style={[styles.wfCard, { marginTop: 12 }]}>
        <View style={styles.wfRow}>
          <Text style={styles.wfSubLabel}>Luôn xác nhận trước khi thực hiện thao tác</Text>
          <Switch
            value={settings.alwaysConfirm}
            onValueChange={(alwaysConfirm) => setSettings({ ...settings, alwaysConfirm })}
            trackColor={{ true: colors.primary, false: '#CBD5E1' }}
          />
        </View>
        <View style={styles.wfRow}>
          <Text style={styles.wfSubLabel}>Bật bộ nhớ dài hạn</Text>
          <Switch
            value={settings.memoryEnabled}
            onValueChange={(memoryEnabled) => setSettings({ ...settings, memoryEnabled })}
            trackColor={{ true: colors.primary, false: '#CBD5E1' }}
          />
        </View>
        <View style={styles.wfRow}>
          <Text style={styles.wfSubLabel}>Tự động ghi nhớ ngữ cảnh</Text>
          <Switch
            value={settings.autoMemoryEnabled}
            onValueChange={(autoMemoryEnabled) => setSettings({ ...settings, autoMemoryEnabled })}
            trackColor={{ true: colors.primary, false: '#CBD5E1' }}
          />
        </View>
      </Card>

      <Card style={[styles.addBox, { marginTop: 12 }]}>
        <Text style={styles.cardTitle}>Chỉ dẫn cá nhân</Text>
        <TextInput
          value={settings.instructions}
          onChangeText={(instructions) => setSettings({ ...settings, instructions })}
          placeholder="Nhập vai trò, ngữ cảnh doanh nghiệp hoặc ưu tiên riêng..."
          placeholderTextColor={colors.muted}
          multiline
          style={[styles.input, { minHeight: 80 }]}
        />

        <Text style={[styles.cardTitle, { marginTop: 6 }]}>Quy tắc phản hồi</Text>
        <TextInput
          value={settings.responseRules}
          onChangeText={(responseRules) => setSettings({ ...settings, responseRules })}
          placeholder="Quy tắc văn phong, định dạng trả lời..."
          placeholderTextColor={colors.muted}
          multiline
          style={[styles.input, { minHeight: 90 }]}
        />

        <Pressable
          disabled={saving}
          onPress={() => void onSave()}
          style={[styles.primaryBtn, { alignSelf: 'stretch', alignItems: 'center' }, saving && styles.disabled]}
        >
          <Text style={styles.primaryBtnText}>{saving ? 'Đang lưu...' : 'Lưu cài đặt'}</Text>
        </Pressable>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingBottom: 28 },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  subHeading: { color: colors.ink, fontSize: 13, fontWeight: '800', marginTop: 18, marginBottom: 8 },
  mutedText: { color: colors.muted, fontSize: 11, marginTop: 2, lineHeight: 16 },
  addBox: { padding: 13, gap: 10, marginTop: 12, marginBottom: 14 },
  input: { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 9, fontSize: 12, color: colors.ink, textAlignVertical: 'top', minHeight: 54 },
  primaryBtn: { backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, alignSelf: 'flex-end' },
  iconButtonContent: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  primaryBtnText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  stateCard: { padding: 20, alignItems: 'center', gap: 10 },
  errorText: { color: '#B91C1C', fontSize: 12, textAlign: 'center' },
  list: { gap: 10 },
  memCard: { padding: 12, gap: 8 },
  memText: { color: colors.ink, fontSize: 12, lineHeight: 18 },
  memFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { alignSelf: 'flex-start', color: colors.primary, fontSize: 9, fontWeight: '800', backgroundColor: '#EAF2FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, overflow: 'hidden', marginBottom: 3 },
  delText: { color: '#C74848', fontSize: 10, fontWeight: '700' },
  wfCard: { padding: 13, gap: 10 },
  wfTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  wfCopy: { flex: 1 },
  cardTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  wfRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  wfSubLabel: { color: colors.ink, fontSize: 11, fontWeight: '600', flex: 1 },
  assetRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
});

