import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { useAuth } from '@/core/auth/AuthProvider';
import { requestAiConsentPrompt } from '@/core/network/aiConsentPrompt';
import { privacyApi } from './privacyApi';
import { showHrConfirm } from '@/features/hr/components/HrConfirmModal';
import { Action, PrivacyTextField, privacyStyles as styles } from './PrivacyPrimitives';
import { PrivacyModerationPanel } from './PrivacyModerationPanel';
import { DeletionReviewsPanel } from './DeletionReviewsPanel';

export function PrivacyControls() {
  const { user, signOut } = useAuth();
  const [accepted, setAccepted] = useState<boolean | null>(null);
  const [blocks, setBlocks] = useState<Array<{ userId: string; displayName: string }>>([]);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof privacyApi.deletionPreview>> | null>(null);
  const [successorId, setSuccessorId] = useState('');
  const [deleting, setDeleting] = useState(false); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const canChat = user?.role === 'admin' || user?.role === 'superadmin' || user?.permissions?.some(code => code === '*' || code === 'chat:read');
  const canModerate = user?.role === 'admin' || user?.role === 'superadmin' || user?.permissions?.some(code => code === '*' || code === 'chat-moderation:manage');
  async function load() {
    setError('');
    const results = await Promise.allSettled([privacyApi.consent(), canChat ? privacyApi.blocks() : Promise.resolve([]), privacyApi.deletionPreview()]);
    if (results[0].status === 'fulfilled') setAccepted(results[0].value.accepted);
    if (results[1].status === 'fulfilled') setBlocks(results[1].value);
    if (results[2].status === 'fulfilled') setPreview(results[2].value);
    if (results.some(result => result.status === 'rejected')) setError('Không tải đủ thông tin quyền riêng tư. Hãy thử lại.');
  }
  useEffect(() => { void load(); }, [user?.id, user?._id, user?.companyCode]);
  async function action(work: () => Promise<unknown>) {
    if (busy) return; setBusy(true); setError('');
    try { await work(); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thực hiện được.'); }
    finally { setBusy(false); }
  }
  function confirmDeletion() {
    showHrConfirm({ title: 'Xóa tài khoản?', message: 'Yêu cầu xóa sẽ được ghi nhận và phiên đăng nhập bị thu hồi. Dữ liệu sẽ được xử lý theo thông tin đã hiển thị. Đây không phải thao tác tạm khóa tài khoản.', confirmLabel: 'Gửi yêu cầu xóa', destructive: true, onConfirm: async () => {
      if (busy) return; setBusy(true); setError('');
      try {
        const result = await privacyApi.requestDeletion(password, successorId || undefined); setPassword('');
        showHrConfirm({ title: 'Đã tiếp nhận yêu cầu xóa', message: `Mã yêu cầu: ${result.id}. Bạn sẽ được đăng xuất. Bộ phận hỗ trợ tiếp tục rà soát dữ liệu cần giữ và dữ liệu lưu ngoài hệ thống.`, confirmLabel: 'Đăng xuất', singleButton: true, onConfirm: async () => { try { await signOut(); } catch { /* local logout still completes */ } } });
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Chưa gửi được yêu cầu xóa.'); }
      finally { setBusy(false); }
    } });
  }
  return <View style={styles.stack}>
    {error ? <View><Text accessibilityRole="alert" style={styles.body}>{error}</Text><Action label="Thử lại" disabled={busy} onPress={() => void load()} /></View> : null}
    <Card style={[styles.stack, { padding: 16 }]}>
      <Text accessibilityRole="header" style={styles.title}>Chia sẻ dữ liệu AI</Text>
      <Text style={styles.body}>{accepted === null ? 'Đang tải trạng thái…' : accepted ? 'Bạn đã đồng ý với thông báo chia sẻ dữ liệu AI hiện tại.' : 'Bạn chưa đồng ý. Yêu cầu cần AI sẽ không được gửi đến dịch vụ AI.'}</Text>
      <Action label="Xem thông tin và đồng ý" disabled={busy} onPress={() => void action(async () => { await requestAiConsentPrompt(await privacyApi.disclosure()); })} />
      {accepted ? <Action label="Rút đồng ý chia sẻ AI" disabled={busy} onPress={() => showHrConfirm({ title: 'Rút đồng ý chia sẻ AI?', message: 'Các lần gọi AI tiếp theo sẽ bị chặn. Dữ liệu đã gửi trước đây không được thu hồi bằng thao tác này.', confirmLabel: 'Rút đồng ý', onConfirm: () => action(() => privacyApi.revoke()) })} /> : null}
    </Card>
    {canChat ? <Card style={[styles.stack, { padding: 16 }]}>
      <Text accessibilityRole="header" style={styles.title}>Người dùng đã chặn</Text>
      {blocks.length ? blocks.map(person => <View key={person.userId} style={styles.stack}><Text style={styles.body}>{person.displayName}</Text><Action label={`Bỏ chặn ${person.displayName}`} disabled={busy} onPress={() => showHrConfirm({ title: 'Bỏ chặn người dùng?', message: 'Hai người có thể liên hệ lại và nội dung của họ có thể xuất hiện trong nhóm chung.', confirmLabel: 'Bỏ chặn', onConfirm: () => action(() => privacyApi.unblock(person.userId)) })} /></View>) : <Text style={styles.body}>Bạn chưa chặn người dùng nào.</Text>}
    </Card> : null}
    <Card style={[styles.stack, { padding: 16 }]}>
      <Text accessibilityRole="header" style={styles.title}>Xóa tài khoản</Text>
      {preview ? <><Text style={styles.body}>{preview.deleted}</Text><Text style={styles.body}>{preview.retained}</Text><Text style={styles.body}>{preview.processing}</Text></> : <Text style={styles.body}>Cần tải thông tin xử lý dữ liệu trước khi yêu cầu xóa.</Text>}
      {!deleting ? <Action label="Yêu cầu xóa tài khoản" disabled={busy || !preview} onPress={() => setDeleting(true)} /> : <>
        {preview?.requiresSuccessor ? <View style={styles.stack}>
          <Text style={styles.body}>Bạn là quản trị viên cuối cùng. Chọn người tiếp nhận quyền quản trị:</Text>
          {preview.successors.map(person => <Action key={person.id} label={`${successorId === person.id ? 'Đã chọn: ' : ''}${person.displayName}`} disabled={busy} onPress={() => setSuccessorId(person.id)} />)}
        </View> : null}
        <Text style={styles.body}>Nhập mật khẩu hiện tại để xác nhận danh tính.</Text>
        <PrivacyTextField accessibilityLabel="Mật khẩu hiện tại để xác nhận xóa tài khoản" autoComplete="current-password" secureTextEntry value={password} onChangeText={setPassword} editable={!busy} style={styles.input} />
        <Action label={busy ? 'Đang gửi…' : 'Tiếp tục xóa tài khoản'} disabled={busy || !password || !preview || (preview.requiresSuccessor && !successorId)} onPress={confirmDeletion} />
        <Action label="Hủy" disabled={busy} onPress={() => { setDeleting(false); setPassword(''); }} />
      </>}
    </Card>
    {canModerate ? <PrivacyModerationPanel /> : null}
    {user?.role === 'admin' || user?.role === 'superadmin' || user?.permissions?.some(code => code === '*' || code === 'access:manage') ? <DeletionReviewsPanel /> : null}
  </View>;
}
