import { PopupError } from '@/components/PopupError';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Download, FilePlus2, Mic, Plus, Presentation, Sparkles, TrendingUp, X } from 'lucide-react-native';
import { Card } from '@/components/Card';
import { withAppLockSuspended } from '@/core/auth/appLockSuspension';
import {
  createStudioChart,
  createStudioImages,
  createStudioMindmap,
  createStudioSpeech,
  createAssistantMemory,
  createStudioSlideDeck,
  deleteAssistantMemory,
  editStudioImage,
  getAssistantSettings,
  listAssistantMemories,
  listAssistantWorkflows,
  listStudioAssets,
  resetAssistantWorkflow,
  saveAssistantSettings,
  saveAssistantWorkflow,
  transcribeStudioAudio,
  updateAssistantMemory,
  interpretAssistantWorkflow,
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
import { saveAndShareExport } from '@/features/quotation/fileExport';

const STUDIO_SPEECH_VOICES = [
  { id: 'sarah', label: 'Thu Hà' },
  { id: 'george', label: 'Tuấn Tài' },
  { id: 'alice', label: 'Minh Anh' },
  { id: 'adam', label: 'Adam' },
] as const;

async function assetToDataUrl(asset: DocumentPicker.DocumentPickerAsset) {
  const response = await fetch(asset.uri);
  if (!response.ok) throw new Error('Không đọc được ảnh đã chọn.');
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không chuyển được ảnh sang định dạng tải lên.'));
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '');
      if (!dataUrl.startsWith('data:')) reject(new Error('Ảnh không có dữ liệu hợp lệ.'));
      else resolve(dataUrl);
    };
    reader.readAsDataURL(blob);
  });
}

// --- 1. Memory Panel ---
export function MemoryPanel() {
  const [memories, setMemories] = useState<AssistantMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

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
    Alert.alert('Xóa ghi nhớ?', 'Thông tin này sẽ không còn được dùng làm ngữ cảnh cho trợ lý.', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: () => { void deleteMemory(id); } },
    ]);
  }, []);

  const deleteMemory = useCallback(async (id: string) => {
    try {
      await deleteAssistantMemory(id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể xóa ghi nhớ.');
    }
  }, []);

  const onSaveEdit = useCallback(async (id: string) => {
    if (!editingContent.trim()) return;
    setSaving(true);
    try {
      const updated = await updateAssistantMemory(id, editingContent.trim());
      setMemories((prev) => prev.map((item) => item.id === id ? updated : item));
      setEditingId(null);
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể sửa ghi nhớ.');
    } finally {
      setSaving(false);
    }
  }, [editingContent]);

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
          <PopupError error={error} />
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
              {editingId === item.id ? (
                <TextInput value={editingContent} onChangeText={setEditingContent} multiline style={[styles.input, styles.memoryEdit]} />
              ) : <Text style={styles.memText}>{item.content}</Text>}
              <View style={styles.memFooter}>
                <Text style={styles.badge}>
                  {item.source === 'automatic' ? 'Tự động' : 'Thủ công'}
                </Text>
                <View style={styles.memoryActions}>
                  {editingId === item.id ? (
                    <>
                      <Pressable disabled={saving} onPress={() => void onSaveEdit(item.id)} hitSlop={8}><Text style={styles.editText}>{saving ? 'Đang lưu…' : 'Lưu'}</Text></Pressable>
                      <Pressable onPress={() => setEditingId(null)} hitSlop={8}><Text style={styles.mutedText}>Hủy</Text></Pressable>
                    </>
                  ) : (
                    <Pressable onPress={() => { setEditingId(item.id); setEditingContent(item.content); }} hitSlop={8}><Text style={styles.editText}>Sửa</Text></Pressable>
                  )}
                  <Pressable onPress={() => onDelete(item.id)} hitSlop={8}><Text style={styles.delText}>Xóa</Text></Pressable>
                </View>
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [instructionsDraft, setInstructionsDraft] = useState('');
  const [interpretation, setInterpretation] = useState('');

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

  const onInterpret = useCallback(async (wf: AssistantWorkflow) => {
    if (!interpretation.trim()) return;
    setBusyId(wf.actionId);
    try {
      const updated = await interpretAssistantWorkflow(wf.actionId, wf.version, interpretation.trim());
      setWorkflows((prev) => prev.map((item) => item.actionId === updated.actionId ? updated : item));
      setInterpretation('');
      setEditingId(null);
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể áp dụng yêu cầu cho quy trình.');
    } finally {
      setBusyId(null);
    }
  }, [interpretation]);

  const onReset = useCallback((wf: AssistantWorkflow) => {
    Alert.alert('Khôi phục quy trình?', `Khôi phục cấu hình mặc định cho “${wf.title}”.`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Khôi phục', onPress: () => { void (async () => {
        setBusyId(wf.actionId);
        try {
          const updated = await resetAssistantWorkflow(wf.actionId, wf.version);
          setWorkflows((prev) => prev.map((item) => item.actionId === updated.actionId ? updated : item));
        } catch (err) {
          Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể khôi phục quy trình.');
        } finally {
          setBusyId(null);
        }
      })(); } },
    ]);
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
          <PopupError error={error} />
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
              <View style={styles.workflowActions}>
                <Pressable
                  onPress={() => {
                    const next = editingId === wf.actionId ? null : wf.actionId;
                    setEditingId(next);
                    setInstructionsDraft(next ? wf.instructions : '');
                    setInterpretation('');
                  }}
                  hitSlop={6}
                ><Text style={styles.editText}>{editingId === wf.actionId ? 'Đóng chỉnh sửa' : 'Chỉnh sửa'}</Text></Pressable>
                <Pressable disabled={busyId === wf.actionId} onPress={() => onReset(wf)} hitSlop={6}>
                  <Text style={styles.mutedText}>Mặc định</Text>
                </Pressable>
              </View>
              {editingId === wf.actionId ? (
                <View style={styles.workflowEditor}>
                  <Text style={styles.fieldLabel}>Chỉ dẫn cho quy trình</Text>
                  <TextInput value={instructionsDraft} onChangeText={setInstructionsDraft} multiline style={[styles.input, styles.workflowInput]} placeholder="Nhập yêu cầu và quy tắc xử lý" placeholderTextColor={colors.muted} />
                  <Text style={styles.fieldLabel}>Thông tin quy trình cần thu thập</Text>
                  {wf.fields.map((field) => (
                    <View key={field.key} style={styles.wfRow}>
                      <Text style={styles.wfSubLabel}>{field.label}</Text>
                      <Switch
                        value={Boolean(field.required)}
                        disabled={busyId === wf.actionId}
                        onValueChange={(required) => void onUpdate(wf, { fields: wf.fields.map((item) => item.key === field.key ? { ...item, required } : item) })}
                        trackColor={{ true: colors.primary, false: '#CBD5E1' }}
                      />
                    </View>
                  ))}
                  <Pressable disabled={busyId === wf.actionId} onPress={() => void onUpdate(wf, { instructions: instructionsDraft })} style={[styles.primaryBtn, busyId === wf.actionId && styles.disabled]}>
                    <Text style={styles.primaryBtnText}>{busyId === wf.actionId ? 'Đang lưu…' : 'Lưu chỉ dẫn'}</Text>
                  </Pressable>
                  <Text style={styles.fieldLabel}>Hoặc mô tả thay đổi để AI thiết lập</Text>
                  <TextInput value={interpretation} onChangeText={setInterpretation} multiline style={[styles.input, styles.workflowInput]} placeholder="Ví dụ: Bắt buộc nhập mã dự án và luôn yêu cầu xác nhận" placeholderTextColor={colors.muted} />
                  <Pressable disabled={busyId === wf.actionId || !interpretation.trim()} onPress={() => void onInterpret(wf)} style={[styles.secondaryBtn, (busyId === wf.actionId || !interpretation.trim()) && styles.disabled]}>
                    <Text style={styles.secondaryBtnText}>{busyId === wf.actionId ? 'Đang xử lý…' : 'Áp dụng bằng AI'}</Text>
                  </Pressable>
                </View>
              ) : null}
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// --- 3. Studio Panel ---
function resolveStudioImageUrl(value: string) {
  if (/^(https?:|data:|file:)/i.test(value)) return value;
  const configured = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '') || '';
  const origin = configured.replace(/\/api\/v1$/i, '');
  return `${origin}${value.startsWith('/') ? value : `/${value}`}`;
}

export function StudioPanel() {
  const [slides, setSlides] = useState<AssistantSlideHistoryItem[]>([]);
  const [charts, setCharts] = useState<AssistantChartHistoryItem[]>([]);
  const [transcripts, setTranscripts] = useState<AssistantStudioTranscript[]>([]);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [creating, setCreating] = useState(false);
  const [tool, setTool] = useState<'slide' | 'mindmap' | 'chart' | 'transcribe' | 'image' | 'editImage' | 'infographic' | 'speech'>('slide');
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [imageRatio, setImageRatio] = useState<'1:1' | '16:9' | '9:16'>('1:1');
  const [editMode, setEditMode] = useState<'custom' | 'erase' | 'remove-background' | 'change-background' | 'enhance'>('custom');
  const [voice, setVoice] = useState<string>('sarah');
  const [latestImage, setLatestImage] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState('6');
  const [slideStyle, setSlideStyle] = useState<'rewrite' | 'preserve' | 'shorten'>('rewrite');
  const [latestTranscript, setLatestTranscript] = useState<AssistantStudioTranscript | null>(null);
  const [latestResult, setLatestResult] = useState('');

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

  const onPickFile = useCallback(async () => {
    try {
      const picked = await withAppLockSuspended(() => DocumentPicker.getDocumentAsync({
        type: tool === 'transcribe'
          ? ['audio/*']
          : tool === 'image' || tool === 'editImage' || tool === 'infographic'
            ? ['image/*']
            : tool === 'chart'
              ? ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
              : ['application/pdf', 'text/plain', 'text/markdown', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        copyToCacheDirectory: true,
      }));
      if (!picked.canceled && picked.assets[0]) setFile(picked.assets[0]);
    } catch (err) {
      Alert.alert('Không mở được tệp', err instanceof Error ? err.message : 'Vui lòng thử lại.');
    }
  }, [tool]);

  const onCreate = useCallback(async () => {
    if (creating) return;
    if (tool === 'transcribe' && !file) {
      Alert.alert('Chưa chọn âm thanh', 'Chọn tệp âm thanh để tạo bản chép lời.');
      return;
    }
    if (tool !== 'transcribe' && tool !== 'chart' && !prompt.trim()) {
      Alert.alert('Thiếu nội dung', 'Nhập chủ đề hoặc yêu cầu cần tạo.');
      return;
    }
    if (tool === 'chart' && !file) {
      Alert.alert('Chưa chọn dữ liệu', 'Chọn tệp dữ liệu để tạo biểu đồ.');
      return;
    }
    if (tool === 'editImage' && !file) {
      Alert.alert('Chưa chọn ảnh', 'Chọn ảnh cần chỉnh sửa trước khi tiếp tục.');
      return;
    }
    setCreating(true);
    setLatestResult('');
    setLatestImage(null);
    try {
      if (tool === 'slide') {
        const result = await createStudioSlideDeck({ prompt: prompt.trim(), pageCount: Math.max(1, Math.min(30, Number(pageCount) || 6)), style: slideStyle, file: file ?? undefined });
        setLatestResult(result.title || 'Bộ slide đã được lưu vào lịch sử Studio.');
      } else if (tool === 'mindmap') {
        const result = await createStudioMindmap({ prompt: prompt.trim(), sourceType: file ? 'document' : 'text', file: file ?? undefined, locale: 'vi', writeMode: 'ai' });
        setLatestResult(result.title || 'Sơ đồ tư duy đã được tạo.');
      } else if (tool === 'chart' && file) {
        const result = await createStudioChart({ file, prompt: prompt.trim() || 'Tự phân tích dữ liệu trong tệp và chọn biểu đồ phù hợp.', chartType: 'Tự động' });
        setLatestResult(result.title || 'Biểu đồ đã được lưu vào lịch sử Studio.');
      } else if (tool === 'transcribe' && file) {
        const result = await transcribeStudioAudio(file);
        setLatestTranscript(result);
        setLatestResult(`Đã chép lời: ${result.fileName}`);
      } else if (tool === 'image' || tool === 'infographic') {
        const referenceImage = file ? await assetToDataUrl(file) : undefined;
        const imagePrompt = tool === 'infographic'
          ? `Tạo một infographic dọc, rõ ràng, dễ đọc từ nội dung sau. Dùng tiêu đề, các mục ngắn và bố cục trực quan. Nội dung: ${prompt.trim()}`
          : prompt.trim();
        const result = await createStudioImages({ prompt: imagePrompt, aspectRatio: imageRatio, count: 1, ...(referenceImage ? { referenceImage } : {}) });
        if (!result.images[0]?.url) throw new Error('Trợ lý chưa trả về hình ảnh.');
        setLatestImage(resolveStudioImageUrl(result.images[0].url));
      } else if (tool === 'editImage' && file) {
        const sourceImage = await assetToDataUrl(file);
        const result = await editStudioImage({ sourceImage, prompt: prompt.trim(), mode: editMode });
        setLatestImage(resolveStudioImageUrl(result.image.url));
      } else if (tool === 'speech') {
        const audio = await createStudioSpeech({ text: prompt.trim(), ...(voice.trim() ? { voice: voice.trim() } : {}) });
        await saveAndShareExport(audio, 'assistant-speech.mp3', 'audio/mpeg');
        setLatestResult('Đã tạo tệp giọng đọc MP3 và mở tuỳ chọn lưu/chia sẻ.');
      }
      setPrompt('');
      setFile(null);
      Alert.alert('Đã hoàn tất', 'Sản phẩm AI đã được tạo.');
      void load();
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể tạo sản phẩm AI lúc này.');
    } finally {
      setCreating(false);
    }
  }, [creating, editMode, file, imageRatio, load, pageCount, prompt, slideStyle, tool, voice]);

  const onSaveImage = useCallback(async () => {
    if (!latestImage) return;
    try {
      const response = await fetch(latestImage);
      if (!response.ok) throw new Error('Không tải được hình ảnh đã tạo.');
      const image = await response.blob();
      await saveAndShareExport(image, 'assistant-image.png', image.type || 'image/png');
    } catch (err) {
      Alert.alert('Không lưu được ảnh', err instanceof Error ? err.message : 'Vui lòng thử lại.');
    }
  }, [latestImage]);

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>AI Studio</Text>
      <Text style={styles.mutedText}>
        Tạo nhanh bài thuyết trình (Slide) và xem lại các sản phẩm AI đã tạo trên ERP.
      </Text>

      <Card style={styles.addBox}>
        <Text style={styles.cardTitle}>Chọn công cụ Studio</Text>
        <View style={styles.studioToolRow}>
          {([
            ['slide', 'Slide'],
            ['mindmap', 'Mindmap'],
            ['chart', 'Biểu đồ'],
            ['transcribe', 'Chép lời'],
            ['image', 'Tạo ảnh'],
            ['editImage', 'Sửa ảnh'],
            ['infographic', 'Infographic'],
            ['speech', 'Giọng đọc'],
          ] as const).map(([value, label]) => (
            <Pressable key={value} onPress={() => { setTool(value); setFile(null); setLatestResult(''); }} style={[styles.settingChoice, tool === value && styles.settingChoiceActive]}>
              <Text style={[styles.settingChoiceText, tool === value && styles.settingChoiceTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        {tool !== 'transcribe' ? (
          <TextInput
            value={prompt}
            onChangeText={setPrompt}
            placeholder={tool === 'slide' ? 'Nhập chủ đề slide hoặc nội dung cần trình bày…' : tool === 'mindmap' ? 'Nhập chủ đề hoặc yêu cầu tạo mindmap…' : tool === 'chart' ? 'Mô tả biểu đồ muốn tạo (không bắt buộc)…' : tool === 'editImage' ? 'Mô tả thay đổi cần thực hiện trên ảnh…' : tool === 'speech' ? 'Nhập văn bản cần chuyển thành giọng nói…' : tool === 'infographic' ? 'Nhập nội dung cần trình bày thành infographic…' : 'Mô tả hình ảnh cần tạo…'}
            placeholderTextColor={colors.muted}
            multiline
            style={styles.input}
          />
        ) : null}
        {tool === 'speech' ? (
          <View style={styles.slideStyleChoices}>
            <Text style={styles.fieldLabel}>Chọn giọng đọc</Text>
            <View style={styles.settingChoices}>
              {STUDIO_SPEECH_VOICES.map((item) => <Pressable key={item.id} onPress={() => setVoice(item.id)} style={[styles.settingChoice, voice === item.id && styles.settingChoiceActive]}><Text style={[styles.settingChoiceText, voice === item.id && styles.settingChoiceTextActive]}>{item.label}</Text></Pressable>)}
            </View>
          </View>
        ) : null}
        {tool === 'image' || tool === 'infographic' ? (
          <View style={styles.slideStyleChoices}>
            <Text style={styles.fieldLabel}>Tỷ lệ ảnh</Text>
            <View style={styles.settingChoices}>
              {(['1:1', '16:9', '9:16'] as const).map((ratio) => <Pressable key={ratio} onPress={() => setImageRatio(ratio)} style={[styles.settingChoice, imageRatio === ratio && styles.settingChoiceActive]}><Text style={[styles.settingChoiceText, imageRatio === ratio && styles.settingChoiceTextActive]}>{ratio}</Text></Pressable>)}
            </View>
          </View>
        ) : null}
        {tool === 'editImage' ? (
          <View style={styles.slideStyleChoices}>
            <Text style={styles.fieldLabel}>Cách chỉnh sửa</Text>
            <View style={styles.settingChoices}>
              {([
                ['custom', 'Tuỳ chỉnh'],
                ['erase', 'Xoá vật thể'],
                ['remove-background', 'Xoá nền'],
                ['change-background', 'Đổi nền'],
                ['enhance', 'Tăng chất lượng'],
              ] as const).map(([value, label]) => <Pressable key={value} onPress={() => setEditMode(value)} style={[styles.settingChoice, editMode === value && styles.settingChoiceActive]}><Text style={[styles.settingChoiceText, editMode === value && styles.settingChoiceTextActive]}>{label}</Text></Pressable>)}
            </View>
          </View>
        ) : null}
        {tool === 'slide' ? (
          <View style={styles.slideOptions}>
            <View style={styles.pageCountField}>
              <Text style={styles.fieldLabel}>Số trang</Text>
              <TextInput value={pageCount} onChangeText={(value) => setPageCount(value.replace(/[^0-9]/g, '').slice(0, 2))} keyboardType="number-pad" style={styles.input} />
            </View>
            <View style={styles.slideStyleChoices}>
              <Text style={styles.fieldLabel}>Xử lý nội dung</Text>
              <View style={styles.settingChoices}>
                {([
                  ['rewrite', 'Viết lại'],
                  ['preserve', 'Giữ nguyên'],
                  ['shorten', 'Rút gọn'],
                ] as const).map(([value, label]) => (
                  <Pressable key={value} onPress={() => setSlideStyle(value)} style={[styles.settingChoice, slideStyle === value && styles.settingChoiceActive]}>
                    <Text style={[styles.settingChoiceText, slideStyle === value && styles.settingChoiceTextActive]}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        ) : null}
        {tool !== 'speech' ? <View style={styles.studioFileRow}>
          <Pressable disabled={creating} onPress={() => void onPickFile()} style={[styles.secondaryBtn, creating && styles.disabled]}>
            <View style={styles.iconButtonContent}><FilePlus2 size={14} color={colors.primary} /><Text style={styles.secondaryBtnText}>{tool === 'transcribe' ? 'Chọn tệp âm thanh' : tool === 'chart' ? 'Chọn tệp dữ liệu' : tool === 'image' || tool === 'editImage' || tool === 'infographic' ? 'Chọn ảnh tham chiếu' : 'Thêm tài liệu (tuỳ chọn)'}</Text></View>
          </Pressable>
          {file ? <View style={styles.selectedFile}><Text numberOfLines={1} style={styles.mutedText}>{file.name}</Text><Pressable accessibilityLabel="Bỏ tệp" onPress={() => setFile(null)}><X size={15} color={colors.muted} /></Pressable></View> : null}
        </View> : null}
        {latestResult ? <Text style={styles.successText}>{latestResult}</Text> : null}
        {latestImage ? <View style={styles.generatedImageWrap}><Image source={{ uri: latestImage }} style={styles.generatedImage} resizeMode="contain" /><Pressable onPress={() => void onSaveImage()} style={styles.secondaryBtn}><View style={styles.iconButtonContent}><Download size={14} color={colors.primary} /><Text style={styles.secondaryBtnText}>Lưu/chia sẻ ảnh</Text></View></Pressable></View> : null}
        {latestTranscript ? <Card style={styles.transcriptCard}>
          <Text style={styles.cardTitle}>{latestTranscript.fileName}</Text>
          <Text selectable style={styles.transcriptText}>{latestTranscript.text}</Text>
        </Card> : null}
        <Pressable
          disabled={creating || (tool === 'transcribe' ? !file : tool === 'chart' || tool === 'editImage' ? !file : !prompt.trim())}
          onPress={() => void onCreate()}
          style={[styles.primaryBtn, styles.studioCreateBtn, (creating || (tool === 'transcribe' ? !file : tool === 'chart' || tool === 'editImage' ? !file : !prompt.trim())) && styles.disabled]}
        >
          <View style={styles.iconButtonContent}>
            {creating ? <ActivityIndicator size="small" color={colors.white} /> : <Sparkles size={14} color={colors.white} />}
            <Text style={styles.primaryBtnText}>{creating ? 'Đang xử lý…' : tool === 'slide' ? 'Tạo slide AI' : tool === 'mindmap' ? 'Tạo mindmap' : tool === 'chart' ? 'Tạo biểu đồ' : tool === 'transcribe' ? 'Chép lời âm thanh' : tool === 'editImage' ? 'Chỉnh sửa ảnh' : tool === 'infographic' ? 'Tạo infographic' : tool === 'speech' ? 'Tạo giọng đọc' : 'Tạo ảnh'}</Text>
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
export function SettingsPanel({ onSettingsSaved }: { onSettingsSaved?: (settings: AssistantSettings) => void }) {
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
      onSettingsSaved?.(updated);
      Alert.alert('Đã lưu', 'Cài đặt Trợ lý ERP đã được cập nhật.');
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể lưu cài đặt.');
    } finally {
      setSaving(false);
    }
  }, [onSettingsSaved, saving, settings]);

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
          <PopupError error={error || 'Chưa tải được cài đặt.'} />
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
        <View style={styles.settingsSection}>
          <Text style={styles.fieldLabel}>Chế độ hiển thị</Text>
          <View style={styles.settingChoices}>
            {(['window', 'fullscreen'] as const).map((windowMode) => (
              <Pressable key={windowMode} onPress={() => setSettings({ ...settings, windowMode })} style={[styles.settingChoice, settings.windowMode === windowMode && styles.settingChoiceActive]}>
                <Text style={[styles.settingChoiceText, settings.windowMode === windowMode && styles.settingChoiceTextActive]}>{windowMode === 'window' ? 'Cửa sổ' : 'Toàn màn hình'}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={styles.wfRow}>
          <Text style={styles.wfSubLabel}>Nhấn Enter để gửi tin nhắn</Text>
          <Switch value={settings.enterToSend} onValueChange={(enterToSend) => setSettings({ ...settings, enterToSend })} trackColor={{ true: colors.primary, false: '#CBD5E1' }} />
        </View>
        <View style={styles.wfRow}>
          <Text style={styles.wfSubLabel}>Hiển thị gợi ý câu hỏi</Text>
          <Switch value={settings.showSuggestions} onValueChange={(showSuggestions) => setSettings({ ...settings, showSuggestions })} trackColor={{ true: colors.primary, false: '#CBD5E1' }} />
        </View>
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
        <View style={styles.wfRow}>
          <Text style={styles.wfSubLabel}>Đọc câu trả lời thành tiếng</Text>
          <Switch value={settings.speakReplies} onValueChange={(speakReplies) => setSettings({ ...settings, speakReplies })} trackColor={{ true: colors.primary, false: '#CBD5E1' }} />
        </View>
        <View style={styles.wfRow}>
          <Text style={styles.wfSubLabel}>Bật nhận lệnh đánh thức trợ lý</Text>
          <Switch value={settings.wakeWordEnabled} onValueChange={(wakeWordEnabled) => setSettings({ ...settings, wakeWordEnabled })} trackColor={{ true: colors.primary, false: '#CBD5E1' }} />
        </View>
        <TextInput
          value={settings.speechVoice}
          onChangeText={(speechVoice) => setSettings({ ...settings, speechVoice })}
          placeholder="Giọng đọc (mã giọng)"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
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
  memoryActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  memoryEdit: { minHeight: 68, textAlignVertical: 'top' },
  badge: { alignSelf: 'flex-start', color: colors.primary, fontSize: 9, fontWeight: '800', backgroundColor: '#EAF2FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, overflow: 'hidden', marginBottom: 3 },
  delText: { color: '#C74848', fontSize: 10, fontWeight: '700' },
  editText: { color: colors.primary, fontSize: 10, fontWeight: '700' },
  wfCard: { padding: 13, gap: 10 },
  wfTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  wfCopy: { flex: 1 },
  cardTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  wfRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  wfSubLabel: { color: colors.ink, fontSize: 11, fontWeight: '600', flex: 1 },
  settingsSection: { gap: 8 },
  settingChoices: { flexDirection: 'row', gap: 8 },
  settingChoice: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8 },
  settingChoiceActive: { borderColor: colors.primary, backgroundColor: '#EAF2FF' },
  settingChoiceText: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  settingChoiceTextActive: { color: colors.primary, fontWeight: '800' },
  workflowActions: { flexDirection: 'row', alignItems: 'center', gap: 16, justifyContent: 'flex-end' },
  workflowEditor: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 10, gap: 9 },
  fieldLabel: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  workflowInput: { minHeight: 68, textAlignVertical: 'top' },
  secondaryBtn: { alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  secondaryBtnText: { color: colors.primary, fontSize: 10, fontWeight: '700' },
  studioToolRow: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' },
  slideOptions: { flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 },
  pageCountField: { width: 82, gap: 6 },
  slideStyleChoices: { flex: 1, minWidth: 210, gap: 6 },
  studioFileRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  selectedFile: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%', borderRadius: 9, backgroundColor: colors.background, paddingHorizontal: 9, paddingVertical: 6 },
  studioCreateBtn: { alignSelf: 'stretch', alignItems: 'center' },
  successText: { color: '#16794A', fontSize: 11, fontWeight: '700' },
  generatedImageWrap: { alignItems: 'flex-start', gap: 8 },
  generatedImage: { width: '100%', height: 260, borderRadius: 12, backgroundColor: colors.background },
  transcriptCard: { padding: 12, gap: 8 },
  transcriptText: { color: colors.ink, fontSize: 11, lineHeight: 17 },
  assetRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
});

