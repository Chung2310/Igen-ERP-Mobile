import { useState } from 'react';
import { Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { privacyApi } from './privacyApi';
import { Action, PrivacyTextField, privacyStyles as styles } from './PrivacyPrimitives';
import { showHrConfirm } from '@/features/hr/components/HrConfirmModal';

export function PrivacyModerationPanel() {
  const [reports, setReports] = useState<Awaited<ReturnType<typeof privacyApi.reports>>>([]);
  const [loaded, setLoaded] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  async function load() {
    setBusy(true); setError('');
    try { setReports(await privacyApi.reports()); setLoaded(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được báo cáo.'); }
    finally { setBusy(false); }
  }
  async function resolve(id: string, action: 'hide' | 'dismiss') {
    setBusy(true); setError('');
    try { await privacyApi.resolveReport(id, action, notes[id]); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Chưa xử lý được báo cáo.'); }
    finally { setBusy(false); }
  }
  return <Card style={[styles.stack, { padding: 16 }]}>
    <Text accessibilityRole="header" style={styles.title}>Kiểm duyệt trò chuyện</Text>
    <Text style={styles.body}>Báo cáo trong doanh nghiệp. Cần quyền kiểm duyệt riêng để xem và xử lý.</Text>
    <Action label={busy ? 'Đang tải…' : loaded ? 'Tải lại báo cáo' : 'Xem báo cáo vi phạm'} disabled={busy} onPress={() => void load()} />
    {error ? <Text accessibilityRole="alert" style={styles.body}>{error}</Text> : null}
    {loaded && !reports.length ? <Text style={styles.body}>Chưa có báo cáo vi phạm.</Text> : null}
    {reports.map(report => <View key={report.id} style={styles.stack}>
      <Text style={styles.title}>{report.message?.senderName || 'Tài khoản đã xóa'}</Text>
      <Text style={styles.body}>{report.message?.content || 'Nội dung không còn khả dụng.'}</Text>
      <Text style={styles.body}>Tiếp nhận: {report.createdAtLabel}</Text>
      <Text style={styles.body}>Lý do: {({ harassment: 'Quấy rối', sexual: 'Tình dục', violence: 'Bạo lực', fraud: 'Lừa đảo', other: 'Khác' } as Record<string, string>)[report.reason] || report.reason}. {report.note}</Text>
      <Text style={styles.body}>Trạng thái: {({ pending: 'Chờ xử lý', reviewing: 'Đang xem xét', resolved: 'Đã xử lý', dismissed: 'Không xác nhận vi phạm' } as Record<string, string>)[report.status]}</Text>
      {['pending', 'reviewing'].includes(report.status) ? <>
        <PrivacyTextField accessibilityLabel="Kết quả xem xét, bắt buộc ít nhất ba ký tự" value={notes[report.id] || ''} onChangeText={value => setNotes(current => ({ ...current, [report.id]: value }))} placeholder="Kết quả xem xét (bắt buộc)" multiline maxLength={1000} style={styles.input} />
        <Action label="Ẩn nội dung vi phạm" disabled={busy || (notes[report.id]?.trim().length || 0) < 3} onPress={() => showHrConfirm({ title: 'Ẩn tin nhắn?', message: 'Nội dung sẽ bị ẩn khỏi cuộc trò chuyện. Kết quả xử lý được lưu lại.', confirmLabel: 'Ẩn nội dung', destructive: true, onConfirm: () => resolve(report.id, 'hide') })} />
        <Action label="Không xác nhận vi phạm" disabled={busy || (notes[report.id]?.trim().length || 0) < 3} onPress={() => void resolve(report.id, 'dismiss')} />
      </> : <Text style={styles.body}>{report.resolution}</Text>}
    </View>)}
  </Card>;
}
