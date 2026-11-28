import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FullScreenFormModal } from '@/components/FullScreenFormModal';
import { privacyApi } from './privacyApi';
import { colors } from '@/theme/colors';
import { PrivacyTextField } from './PrivacyPrimitives';
const reasons = [['harassment', 'Quấy rối hoặc bắt nạt'], ['sexual', 'Nội dung tình dục'], ['violence', 'Bạo lực hoặc đe dọa'], ['fraud', 'Lừa đảo hoặc spam'], ['other', 'Lý do khác']] as const;
export function ChatReportForm({ target, onClose }: { target: { roomId: string; messageId: string } | null; onClose: () => void }) {
  const [reason, setReason] = useState(''); const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [sent, setSent] = useState(false);
  useEffect(() => { setReason(''); setNote(''); setError(''); setSent(false); }, [target]);
  async function submit() {
    if (!target || !reason || busy) return; setBusy(true); setError('');
    try { await privacyApi.report({ ...target, reason, note }); setSent(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không gửi được báo cáo.'); }
    finally { setBusy(false); }
  }
  return <FullScreenFormModal visible={Boolean(target)} title="Báo cáo vi phạm" onClose={onClose}>
    <View style={styles.stack}>
      {sent ? <><Text accessibilityRole="alert" style={styles.body}>Đã tiếp nhận báo cáo. Người phụ trách kiểm duyệt sẽ xem xét và xử lý.</Text><Pressable accessibilityRole="button" onPress={onClose} style={styles.action}><Text style={styles.actionText}>Đóng</Text></Pressable></> : <>
        <Text style={styles.body}>Chọn lý do báo cáo. Chỉ người có quyền kiểm duyệt trong doanh nghiệp được xem thông tin báo cáo.</Text>
        {reasons.map(([value, label]) => <Pressable key={value} accessibilityRole="button" aria-pressed={reason === value} accessibilityState={{ selected: reason === value }} disabled={busy} onPress={() => setReason(value)} style={[styles.choice, reason === value && styles.selected]}><Text style={styles.body}>{reason === value ? '● ' : '○ '}{label}</Text></Pressable>)}
        <Text style={styles.body}>Ghi chú (tùy chọn)</Text><PrivacyTextField accessibilityLabel="Ghi chú báo cáo, tùy chọn" value={note} onChangeText={setNote} maxLength={1000} multiline editable={!busy} style={styles.input} />
        <Text style={styles.body}>Không đưa mật khẩu hoặc dữ liệu nhạy cảm không liên quan vào ghi chú.</Text>
        {error ? <Text accessibilityRole="alert" style={styles.body}>{error}</Text> : null}
        {!reason ? <Text style={styles.body}>Chọn một lý do để gửi báo cáo.</Text> : null}
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: !reason || busy, busy }} disabled={!reason || busy} onPress={() => void submit()} style={[styles.action, (!reason || busy) && styles.disabled]}><Text style={styles.actionText}>{busy ? 'Đang gửi…' : 'Gửi báo cáo'}</Text></Pressable>
      </>}
    </View>
  </FullScreenFormModal>;
}
const styles = StyleSheet.create({ stack: { padding: 20, gap: 12 }, body: { color: colors.ink, fontSize: 14, lineHeight: 22 }, choice: { minHeight: 48, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 12 }, selected: { borderColor: colors.primary }, input: { borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 96, color: colors.ink, fontSize: 14 }, action: { minHeight: 48, padding: 12, backgroundColor: colors.primary, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, actionText: { color: colors.white, fontSize: 14, fontWeight: '600' }, disabled: { opacity: 0.5 } });
