import { useCallback, useEffect, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowLeft, Download, FileAudio, FilePlus2, Mic, Sparkles } from 'lucide-react-native';
import { Card } from '@/components/Card';
import { withAppLockSuspended } from '@/core/auth/appLockSuspension';
import { chatWithAssistantAgent, generateUuidV4, listStudioAssets, transcribeStudioAudio } from '@/features/assistant/assistantApi';
import type { AssistantStudioTranscript, UserAssistantAgent } from '@/features/assistant/types';
import { saveAndShareExport } from '@/features/quotation/fileExport';
import { colors } from '@/theme/colors';

export function MeetingNotesPanel() {
  const [history, setHistory] = useState<AssistantStudioTranscript[]>([]);
  const [selected, setSelected] = useState<AssistantStudioTranscript | null>(null);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [summarizing, setSummarizing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const assets = await listStudioAssets();
      setHistory(assets.transcripts);
    } catch (err) {
      Alert.alert('Không tải được lịch sử', err instanceof Error ? err.message : 'Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const onTranscribe = useCallback(async () => {
    try {
      const picked = await withAppLockSuspended(() => DocumentPicker.getDocumentAsync({ type: ['audio/*'], copyToCacheDirectory: true }));
      if (picked.canceled || !picked.assets[0]) return;
      const asset = picked.assets[0];
      if (asset.size && asset.size > 50 * 1024 * 1024) {
        Alert.alert('Tệp quá lớn', 'Tệp âm thanh không được vượt quá 50 MB.');
        return;
      }
      setLoading(true);
      const transcript = await transcribeStudioAudio(asset);
      setSelected(transcript);
      setMeetingTitle(transcript.fileName.replace(/\.[^.]+$/, ''));
      setSummary('');
      setNotes('');
      setHistory((prev) => [transcript, ...prev.filter((item) => item.id !== transcript.id)]);
    } catch (err) {
      Alert.alert('Không chép được âm thanh', err instanceof Error ? err.message : 'Vui lòng chọn tệp âm thanh khác.');
    } finally {
      setLoading(false);
    }
  }, []);

  const onSummarize = useCallback(async () => {
    if (!selected || summarizing) return;
    setSummarizing(true);
    try {
      const agent: UserAssistantAgent = {
        id: generateUuidV4(),
        name: 'Trợ lý biên bản cuộc họp',
        description: 'Tạo biên bản cuộc họp',
        instructions: 'Tóm tắt cuộc họp theo các mục: Mục tiêu, Nội dung chính, Quyết định, Việc cần làm (người phụ trách và hạn nếu được nêu), Vấn đề chưa thống nhất. Chỉ dùng thông tin có trong bản chép lời và ghi chú; thiếu thông tin thì ghi Chưa ghi nhận.',
        avoid: 'Không tự suy đoán tên, quyết định, người phụ trách hoặc thời hạn.',
        tone: 'Rõ ràng, chuyên nghiệp',
        avatar: 0,
        favorite: false,
        openingQuestions: [],
        knowledge: [],
      };
      const reply = await chatWithAssistantAgent(agent, [{ role: 'user', content: `Tạo biên bản cho cuộc họp “${meetingTitle.trim() || selected.fileName}”.${notes.trim() ? `\n\nGhi chú của người dùng:\n${notes.trim().slice(0, 1500)}` : ''}\n\nBản chép lời:\n${selected.text.slice(0, 18000)}` }]);
      setSummary(reply);
    } catch (err) {
      Alert.alert('Không tạo được biên bản', err instanceof Error ? err.message : 'Vui lòng thử lại.');
    } finally {
      setSummarizing(false);
    }
  }, [meetingTitle, notes, selected, summarizing]);

  const onDownload = useCallback(async () => {
    if (!selected) return;
    try {
      const content = summary ? `${meetingTitle}\n\n${summary}\n\nBẢN CHÉP LỜI\n${selected.text}` : selected.text;
      const fileName = `${(meetingTitle || selected.fileName).replace(/[\\/:*?"<>|]/g, '-')}.txt`;
      await saveAndShareExport(new Blob([content], { type: 'text/plain;charset=utf-8' }), fileName, 'text/plain');
    } catch (err) {
      Alert.alert('Không lưu được bản ghi', err instanceof Error ? err.message : 'Vui lòng thử lại.');
    }
  }, [meetingTitle, selected, summary]);

  if (selected) return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Lịch sử cuộc họp" onPress={() => setSelected(null)} style={styles.backButton}><ArrowLeft size={16} color={colors.primary} /></Pressable>
        <TextInput value={meetingTitle} onChangeText={setMeetingTitle} placeholder="Tên cuộc họp" placeholderTextColor={colors.muted} style={[styles.input, styles.titleInput]} />
      </View>
      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Phân tích và biên bản</Text><Pressable disabled={summarizing} onPress={() => void onSummarize()} style={[styles.secondaryButton, summarizing && styles.disabled]}><View style={styles.iconRow}><Sparkles size={14} color={colors.primary} /><Text style={styles.secondaryText}>{summarizing ? 'Đang phân tích…' : summary ? 'Tạo lại' : 'Tạo biên bản'}</Text></View></Pressable></View>
        <TextInput value={notes} onChangeText={setNotes} placeholder="Ghi chú bổ sung cho AI (không bắt buộc)" placeholderTextColor={colors.muted} multiline style={[styles.input, styles.notesInput]} />
        {summarizing ? <View style={styles.busy}><ActivityIndicator size="small" color={colors.primary} /><Text style={styles.muted}>Đang tạo biên bản…</Text></View> : summary ? <Text selectable style={styles.transcript}>{summary}</Text> : <Text style={styles.muted}>Chưa có biên bản. Tạo biên bản để trích xuất quyết định và việc cần làm.</Text>}
      </Card>
      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Bản chép lời</Text><Pressable onPress={() => void onDownload()} style={styles.secondaryButton}><View style={styles.iconRow}><Download size={14} color={colors.primary} /><Text style={styles.secondaryText}>Tải .txt</Text></View></Pressable></View>
        <Text selectable style={styles.transcript}>{selected.text}</Text>
      </Card>
    </ScrollView>
  );

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Ghi chép cuộc họp</Text>
      <Text style={styles.muted}>Chọn bản ghi âm để chép lời, thêm ghi chú và tạo biên bản có các quyết định, việc cần làm.</Text>
      <Pressable disabled={loading} onPress={() => void onTranscribe()} style={[styles.primaryButton, loading && styles.disabled]}>
        {loading ? <ActivityIndicator size="small" color={colors.white} /> : <FilePlus2 size={15} color={colors.white} />}
        <Text style={styles.primaryButtonText}>{loading ? 'Đang xử lý…' : 'Tải bản ghi âm'}</Text>
      </Pressable>
      <View style={styles.historyHeader}><Mic size={16} color={colors.primary} /><Text style={styles.sectionTitle}>Lịch sử ghi chép ({history.length})</Text></View>
      {history.map((item) => (
        <Card key={item.id} onPress={() => { setSelected(item); setMeetingTitle(item.fileName.replace(/\.[^.]+$/, '')); setSummary(''); setNotes(''); }} style={styles.historyCard}>
          <FileAudio size={19} color={colors.primary} />
          <View style={styles.historyCopy}><Text numberOfLines={1} style={styles.cardTitle}>{item.fileName}</Text><Text style={styles.muted}>{new Date(item.createdAt).toLocaleString('vi-VN')}</Text></View>
        </Card>
      ))}
      {!loading && !history.length ? <Card style={styles.empty}><Text style={styles.muted}>Chưa có bản ghi âm nào.</Text></Card> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 30, gap: 10 },
  sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  primaryButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 10, marginTop: 8 },
  primaryButtonText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  historyHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 14 },
  historyCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  historyCopy: { flex: 1, gap: 3 },
  cardTitle: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  empty: { padding: 16, alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#EAF2FF' },
  titleInput: { flex: 1, fontWeight: '700' },
  sectionCard: { padding: 12, gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  secondaryButton: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  secondaryText: { color: colors.primary, fontSize: 10, fontWeight: '700' },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.white, paddingHorizontal: 11, paddingVertical: 9, color: colors.ink, fontSize: 12 },
  notesInput: { minHeight: 64, textAlignVertical: 'top' },
  transcript: { color: colors.ink, fontSize: 12, lineHeight: 19 },
  busy: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  disabled: { opacity: 0.45 },
});
