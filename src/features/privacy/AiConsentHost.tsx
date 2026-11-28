import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { FullScreenFormModal } from '@/components/FullScreenFormModal';
import { useAuth } from '@/core/auth/AuthProvider';
import { cancelAiConsentPrompt, subscribeAiConsentPrompt, type AiDisclosure } from '@/core/network/aiConsentPrompt';
import { privacyApi } from './privacyApi';
import { colors } from '@/theme/colors';

export function AiConsentHost() {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState<{ disclosure?: AiDisclosure; resolve: (value: boolean) => void } | null>(null);
  const [disclosure, setDisclosure] = useState<AiDisclosure | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const identity = `${user?.companyCode}:${user?._id || user?.id}`;
  useEffect(() => { cancelAiConsentPrompt(); return subscribeAiConsentPrompt(setPrompt); }, [identity]);
  useEffect(() => {
    if (!prompt) { setDisclosure(null); return; }
    setError(''); let current = true;
    if (prompt.disclosure) setDisclosure(prompt.disclosure);
    else void privacyApi.disclosure().then(value => { if (current) setDisclosure(value); }).catch(() => { if (current) setError('Không tải được thông tin chia sẻ dữ liệu. Hãy đóng và thử lại.'); });
    return () => { current = false; };
  }, [prompt]);
  async function accept() {
    if (!disclosure || !prompt || busy) return;
    const activePrompt = prompt;
    setBusy(true); setError('');
    try { await privacyApi.accept(disclosure.version); activePrompt.resolve(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không lưu được đồng ý.'); }
    finally { setBusy(false); }
  }
  return <FullScreenFormModal visible={Boolean(prompt)} title="Chia sẻ dữ liệu AI" cancelLabel="Để sau" onClose={() => prompt?.resolve(false)}>
    <View style={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>{disclosure?.title || 'Đang tải thông tin…'}</Text>
      <Text style={styles.body}>{disclosure?.description}</Text>
      {disclosure?.providers.map(provider => <View key={provider.name} style={styles.provider}>
        <Text style={styles.title}>{provider.name}</Text><Text style={styles.body}>{provider.purpose}</Text>
        <Pressable accessibilityRole="link" accessibilityLabel={`Chính sách của ${provider.name}`} onPress={() => void Linking.openURL(provider.url).catch(() => setError('Không mở được chính sách.'))} style={styles.link}><Text style={styles.linkText}>Xem chính sách bảo mật</Text></Pressable>
      </View>)}
      <Text style={styles.body}>{disclosure?.withdrawal}</Text>
      <Text style={styles.body}>Bạn vẫn có thể dùng các nghiệp vụ không cần AI khi chọn Để sau.</Text>
      {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.body}>{error}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || !disclosure, busy }} disabled={busy || !disclosure} onPress={() => void accept()} style={[styles.button, (busy || !disclosure) && styles.disabled]}><Text style={styles.buttonText}>{busy ? 'Đang lưu…' : 'Đồng ý và tiếp tục'}</Text></Pressable>
    </View>
  </FullScreenFormModal>;
}
const styles = StyleSheet.create({
  content: { padding: 20, gap: 16 }, title: { fontSize: 16, fontWeight: '600', color: colors.ink },
  body: { fontSize: 14, lineHeight: 22, color: colors.ink }, provider: { gap: 6, borderWidth: 1, borderColor: colors.border, padding: 14, borderRadius: 12 },
  link: { minHeight: 44, justifyContent: 'center' }, linkText: { color: colors.primary, fontSize: 14 },
  button: { minHeight: 48, backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center' }, buttonText: { color: colors.white, fontSize: 14, fontWeight: '600' }, disabled: { opacity: 0.5 },
});
