import { useState } from 'react';
import { Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { privacyApi } from './privacyApi';
import { Action, PrivacyTextField, privacyStyles as styles } from './PrivacyPrimitives';
import { showHrConfirm } from '@/features/hr/components/HrConfirmModal';

const items = [['storage', 'Đã xóa hoặc xác định căn cứ giữ tệp ngoài hệ thống, tệp dùng chung và dữ liệu dẫn xuất.'], ['business', 'Đã rà soát chứng từ, dữ liệu cá nhân và ghi căn cứ, thời hạn giữ phần còn lại.'], ['backups', 'Đã xác định thời hạn backup và cách áp dụng lại yêu cầu khi khôi phục.']] as const;
export function DeletionReviewsPanel() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof privacyApi.deletionReviews>>>([]);
  const [busy, setBusy] = useState(false); const [loaded, setLoaded] = useState(false); const [error, setError] = useState('');
  const [checks, setChecks] = useState<Record<string, boolean>>({}); const [notes, setNotes] = useState<Record<string, string>>({});
  async function load() { setBusy(true); setError(''); try { setRows(await privacyApi.deletionReviews()); setLoaded(true); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được yêu cầu.'); } finally { setBusy(false); } }
  async function complete(id: string) { setBusy(true); setError(''); try { await privacyApi.completeDeletionReview(id, notes[id]); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không lưu được kết quả.'); } finally { setBusy(false); } }
  return <Card style={[styles.stack, { padding: 16 }]}>
    <Text accessibilityRole="header" style={styles.title}>Rà soát yêu cầu xóa tài khoản</Text>
    <Text style={styles.body}>Chỉ đánh dấu hoàn tất sau khi thực sự xử lý dữ liệu và ghi căn cứ lưu trữ. Mã yêu cầu có thể đối chiếu với mã người dùng đã nhận.</Text>
    <Action label={busy ? 'Đang tải…' : 'Tải yêu cầu xóa'} disabled={busy} onPress={() => void load()} />
    {error ? <Text accessibilityRole="alert" style={styles.body}>{error}</Text> : null}
    {loaded && !rows.length ? <Text style={styles.body}>Chưa có yêu cầu xóa tài khoản.</Text> : null}
    {rows.map(row => <View key={row._id} style={styles.stack}>
      <Text style={styles.body}>Mã yêu cầu: {row._id}</Text>
      <Text style={styles.body}>Tiếp nhận: {row.requestedAtLabel}. Dự kiến xử lý trước: {row.dueAtLabel}.</Text>
      {row.storageReviewItems?.length ? <Text style={styles.body}>Tệp cần xử lý thủ công: {row.storageReviewItems.join(", ")}</Text> : null}
      <Text style={styles.body}>{({ pending: 'Đã tiếp nhận', processing: 'Đang xử lý', review_required: 'Chờ rà soát dữ liệu còn lại', failed_retryable: 'Cần kiểm tra lỗi xử lý tự động', completed: 'Đã hoàn tất' } as Record<string, string>)[row.status]}</Text>
      {row.status === 'review_required' ? <>
        {items.map(([key, label]) => <Action key={key} label={`${checks[`${row._id}:${key}`] ? 'Đã xác nhận: ' : 'Chưa xác nhận: '}${label}`} disabled={busy} onPress={() => setChecks(value => ({ ...value, [`${row._id}:${key}`]: !value[`${row._id}:${key}`] }))} />)}
        <PrivacyTextField accessibilityLabel="Kết quả rà soát, căn cứ và thời hạn lưu trữ, bắt buộc ít nhất hai mươi ký tự" value={notes[row._id] || ''} onChangeText={value => setNotes(current => ({ ...current, [row._id]: value }))} placeholder="Ghi kết quả, căn cứ và thời hạn lưu trữ" multiline maxLength={2000} style={styles.input} />
        <Action label="Xác nhận đã xử lý hoàn tất" disabled={busy || items.some(([key]) => !checks[`${row._id}:${key}`]) || (notes[row._id]?.trim().length || 0) < 20} onPress={() => showHrConfirm({ title: 'Hoàn tất yêu cầu xóa?', message: 'Bạn xác nhận đã thực hiện đủ ba bước rà soát và xử lý dữ liệu còn lại. Kết quả được lưu vào lịch sử.', confirmLabel: 'Xác nhận hoàn tất', onConfirm: () => complete(row._id) })} />
      </> : null}
    </View>)}
  </Card>;
}
