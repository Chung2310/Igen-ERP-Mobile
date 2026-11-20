import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/core/auth/AuthProvider';
import { checkErpConnection } from '@/core/auth/authApi';
import { colors } from '@/theme/colors';

type ConnectionState = 'checking' | 'connected' | 'unavailable';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>('checking');

  useEffect(() => {
    let active = true;
    void checkErpConnection()
      .then(() => { if (active) setConnection('connected'); })
      .catch(() => { if (active) setConnection('unavailable'); });
    return () => { active = false; };
  }, []);

  async function submit() {
    if (!email.trim() || !password) {
      setError('Nhập email và mật khẩu để tiếp tục.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await signIn(email, password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể đăng nhập vào ERP.');
    } finally {
      setBusy(false);
    }
  }

  const connectionLabel = connection === 'checking'
    ? 'Đang kiểm tra kết nối ERP…'
    : connection === 'connected' ? 'Đã kết nối máy chủ ERP' : 'Chưa kết nối được máy chủ ERP';

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brandMark}><Text style={styles.brandGlyph}>I</Text></View>
          <Text style={styles.brand}>IGEN ERP</Text>
          <Text style={styles.title}>Đăng nhập</Text>
          <Text style={styles.subtitle}>Đăng nhập bằng tài khoản doanh nghiệp ERP của bạn.</Text>

          <View style={styles.connection}><View style={[styles.connectionDot, connection === 'connected' && styles.connectedDot, connection === 'unavailable' && styles.unavailableDot]} /><Text style={styles.connectionText}>{connectionLabel}</Text></View>

          <View style={styles.form}>
            <Text style={styles.label}>Email</Text>
            <TextInput value={email} onChangeText={setEmail} placeholder="ten@congty.vn" placeholderTextColor={colors.muted} style={styles.input} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" returnKeyType="next" />
            <Text style={[styles.label, styles.passwordLabel]}>Mật khẩu</Text>
            <TextInput value={password} onChangeText={setPassword} placeholder="Nhập mật khẩu" placeholderTextColor={colors.muted} style={styles.input} secureTextEntry textContentType="password" returnKeyType="done" onSubmitEditing={() => { void submit(); }} />
            {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
            <Pressable disabled={busy} onPress={() => { void submit(); }} style={[styles.submit, busy && styles.submitDisabled]}>
              {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitText}>Đăng nhập vào ERP</Text>}
            </Pressable>
          </View>
          <Text style={styles.footer}>Kết nối bảo mật với hệ thống Igen ERP</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 36 },
  brandMark: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: colors.primary, alignSelf: 'center' },
  brandGlyph: { color: colors.white, fontSize: 30, fontWeight: '900' },
  brand: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 2.2, textAlign: 'center', marginTop: 13 },
  title: { color: colors.ink, fontSize: 25, fontWeight: '800', textAlign: 'center', marginTop: 27 },
  subtitle: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 7 },
  connection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.white, marginTop: 20 },
  connectionDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#D3983E', marginRight: 7 },
  connectedDot: { backgroundColor: '#16885A' },
  unavailableDot: { backgroundColor: '#C74848' },
  connectionText: { color: colors.muted, fontSize: 9, fontWeight: '600' },
  form: { marginTop: 27 },
  label: { color: colors.ink, fontSize: 10, fontWeight: '700', marginBottom: 7 },
  passwordLabel: { marginTop: 16 },
  input: { height: 47, paddingHorizontal: 14, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, color: colors.ink, fontSize: 11 },
  error: { color: '#B4232E', fontSize: 9, lineHeight: 14, marginTop: 11 },
  submit: { height: 47, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.primary, marginTop: 20 },
  submitDisabled: { opacity: 0.7 },
  submitText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  footer: { color: colors.muted, fontSize: 9, textAlign: 'center', marginTop: 30 },
});
