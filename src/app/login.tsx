import { PopupError } from '@/components/PopupError';
import { type ComponentRef, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  Fingerprint,
  Lock,
  Mail,
} from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '@/core/auth/AuthProvider';
import {
  ERP_PRIVACY_POLICY_URL,
  ERP_TERMS_OF_SERVICE_URL,
} from '@/core/network/erpWebLinks';
import { colors } from '@/theme/colors';

const IGEN_ROBOT_ILLUSTRATION = require('../../assets/images/login-igen-operator.png');
const IGEN_FULL_LOGO = require('../../assets/images/logo-igenerp.png');

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, signInWithBiometrics, canSignInWithBiometrics, biometricSettings, sessionNotice, clearSessionNotice } = useAuth();
  const scrollViewRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const passwordInputRef = useRef<ComponentRef<typeof TextInput>>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (sessionNotice) setError(sessionNotice);
  }, [sessionNotice]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 60);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  function handleFieldFocus(field: 'email' | 'password') {
    setFocusedField(field);
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 120);
  }

  async function openExternalLink(url: string | null, label: string) {
    if (!url) {
      Alert.alert('Chưa có đường dẫn', `Không tìm thấy trang ${label}.`);
      return;
    }
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) throw new Error('unsupported');
      await Linking.openURL(url);
    } catch {
      Alert.alert('Không thể mở liên kết', `Không thể mở trang ${label} lúc này.`);
    }
  }

  async function submit() {
    if (!email.trim() || !password) {
      setError('Vui lòng nhập đầy đủ email và mật khẩu để tiếp tục.');
      return;
    }
    setBusy(true);
    setError('');
    clearSessionNotice();
    try {
      await signIn(email.trim(), password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể đăng nhập vào ERP.');
    } finally {
      setBusy(false);
    }
  }

  async function submitBiometric() {
    if (!canSignInWithBiometrics) {
      setError('Không còn phiên ERP đã lưu. Hãy đăng nhập bằng mật khẩu trước; lần mở ứng dụng sau có thể dùng sinh trắc học.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await signInWithBiometrics();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể đăng nhập bằng sinh trắc học.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingBottom:
                Math.max(insets.bottom, 20) + 16 + (Platform.OS === 'android' ? keyboardHeight : 0),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Banner đồng bộ giao diện bản Web */}
          <View style={[styles.banner, { paddingTop: insets.top + 18 }]}>
            <View pointerEvents="none" style={styles.bannerGlowTop} />
            <View pointerEvents="none" style={styles.bannerGlowBottom} />

            <View style={styles.bannerBadgeRow}>
              <View style={styles.bannerBadgeIcon}>
                <Building2 size={16} color="#9CF3FF" />
              </View>
              <Text style={styles.bannerBadgeText}>Nền tảng quản trị doanh nghiệp</Text>
            </View>

            <Text style={styles.bannerTitle}>
              ĐIỀU HÀNH DOANH NGHIỆP{'\n'}TRONG MỘT HỆ THỐNG
            </Text>

            <View style={styles.illustrationWrap}>
              <Image
                source={IGEN_ROBOT_ILLUSTRATION}
                style={styles.illustrationImage}
                resizeMode="contain"
              />
            </View>
          </View>

          {/* Thẻ form đăng nhập */}
          <View style={styles.body}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Image
                  source={IGEN_FULL_LOGO}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
                <Text style={styles.title}>Đăng nhập</Text>
                <Text style={styles.subtitle}>Chào mừng bạn quay lại iGen ERP</Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Địa chỉ email</Text>
                <View
                  style={[
                    styles.inputWrap,
                    focusedField === 'email' && styles.inputWrapFocused,
                  ]}
                >
                  <Mail
                    size={17}
                    color={focusedField === 'email' ? '#0667EF' : colors.muted}
                  />
                  <TextInput
                    value={email}
                    onChangeText={(value) => {
                      setEmail(value);
                      if (error) setError('');
                    }}
                    onFocus={() => handleFieldFocus('email')}
                    onBlur={() => setFocusedField((prev) => (prev === 'email' ? null : prev))}
                    placeholder="ten@congty.vn"
                    placeholderTextColor="#9AA7BC"
                    style={styles.input}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="emailAddress"
                    returnKeyType="next"
                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Mật khẩu</Text>
                <View
                  style={[
                    styles.inputWrap,
                    focusedField === 'password' && styles.inputWrapFocused,
                  ]}
                >
                  <Lock
                    size={17}
                    color={focusedField === 'password' ? '#0667EF' : colors.muted}
                  />
                  <TextInput
                    ref={passwordInputRef}
                    value={password}
                    onChangeText={(value) => {
                      setPassword(value);
                      if (error) setError('');
                    }}
                    onFocus={() => handleFieldFocus('password')}
                    onBlur={() => setFocusedField((prev) => (prev === 'password' ? null : prev))}
                    placeholder="Nhập mật khẩu"
                    placeholderTextColor="#9AA7BC"
                    style={styles.input}
                    secureTextEntry={!showPassword}
                    textContentType="password"
                    returnKeyType="done"
                    onSubmitEditing={() => {
                      void submit();
                    }}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    hitSlop={8}
                    onPress={() => setShowPassword((prev) => !prev)}
                    style={styles.eyeButton}
                  >
                    {showPassword ? (
                      <EyeOff size={17} color={colors.muted} />
                    ) : (
                      <Eye size={17} color={colors.muted} />
                    )}
                  </Pressable>
                </View>
              </View>

              {!!error && <PopupError error={error} title="Không thể đăng nhập" />}

              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => {
                  void submit();
                }}
                style={({ pressed }) => [
                  styles.submit,
                  busy && styles.submitDisabled,
                  pressed && !busy && styles.submitPressed,
                ]}
              >
                {busy ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <View style={styles.submitInner}>
                    <ArrowRight size={17} color={colors.white} />
                    <Text style={styles.submitText}>Đăng nhập</Text>
                  </View>
                )}
              </Pressable>

              {biometricSettings.loginEnabled && Platform.OS !== 'web' ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => { void submitBiometric(); }}
                  style={[styles.biometricSubmit, busy && styles.submitDisabled]}
                >
                  {busy ? <ActivityIndicator color="#0667EF" /> : <Fingerprint size={17} color="#0667EF" />}
                  <Text style={styles.biometricSubmitText}>
                    {Platform.OS === 'ios' ? 'Đăng nhập bằng Face ID / Touch ID' : 'Đăng nhập bằng khuôn mặt / vân tay'}
                  </Text>
                </Pressable>
              ) : null}

              {/* Liên kết Chính sách & Bảo mật */}
              <View style={styles.legalWrap}>
                <Pressable
                  hitSlop={6}
                  onPress={() => void openExternalLink(ERP_PRIVACY_POLICY_URL, 'Chính sách & Bảo mật')}
                >
                  <Text style={styles.legalLink}>Chính sách &amp; Bảo mật</Text>
                </Pressable>
                <Text style={styles.legalDivider}>•</Text>
                <Pressable
                  hitSlop={6}
                  onPress={() => void openExternalLink(ERP_TERMS_OF_SERVICE_URL, 'Điều khoản sử dụng')}
                >
                  <Text style={styles.legalLink}>Điều khoản sử dụng</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1 },
  banner: {
    width: '100%',
    backgroundColor: '#0577E7',
    paddingHorizontal: 22,
    paddingBottom: 42,
    overflow: 'hidden',
  },
  bannerGlowTop: {
    position: 'absolute',
    top: -90,
    right: -80,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(103, 232, 249, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  bannerGlowBottom: {
    position: 'absolute',
    bottom: -110,
    left: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(6, 79, 196, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  bannerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bannerBadgeIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: 'rgba(7, 88, 184, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(165, 243, 252, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerBadgeText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  bannerTitle: {
    color: colors.white,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 18,
    letterSpacing: 0.3,
  },
  illustrationWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  illustrationImage: {
    width: '100%',
    maxWidth: 260,
    height: 152,
  },
  body: {
    flex: 1,
    paddingHorizontal: 18,
    marginTop: -24,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 20,
    borderWidth: 1,
    borderColor: '#E6ECF5',
    shadowColor: '#10203E',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
    gap: 15,
  },
  cardHeader: {
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  logoImage: {
    width: 176,
    height: 48,
    marginBottom: 4,
  },
  title: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  fieldGroup: { gap: 7 },
  label: { color: colors.ink, fontSize: 12, fontWeight: '700', marginLeft: 2 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 13,
    borderWidth: 1.2,
    borderColor: colors.border,
    backgroundColor: '#F8FAFD',
    gap: 10,
  },
  inputWrapFocused: {
    borderColor: '#0667EF',
    backgroundColor: colors.white,
  },
  input: {
    flex: 1,
    color: colors.ink,
    fontSize: 14,
    paddingVertical: 0,
  },
  eyeButton: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  errorIcon: { marginTop: 1 },
  errorText: {
    flex: 1,
    color: '#B4232E',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  submit: {
    height: 48,
    borderRadius: 13,
    backgroundColor: '#0667EF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: '#0667EF',
    shadowOpacity: 0.26,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  submitDisabled: { opacity: 0.7 },
  submitPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  submitInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  submitText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  biometricSubmit: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 13, borderWidth: 1, borderColor: '#0667EF', backgroundColor: colors.white, marginTop: 10 },
  biometricSubmitText: { color: '#0667EF', fontSize: 12, fontWeight: '800' },
  legalWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F7',
  },
  legalLink: {
    color: '#0667EF',
    fontSize: 12,
    fontWeight: '600',
  },
  legalDivider: {
    color: colors.muted,
    fontSize: 12,
  },
});
