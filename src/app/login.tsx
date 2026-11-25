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
  StatusBar as RnStatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Eye, EyeOff, Fingerprint, Lock, Mail } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useAuth } from '@/core/auth/AuthProvider';
import {
  ERP_PRIVACY_POLICY_URL,
  ERP_TERMS_OF_SERVICE_URL,
} from '@/core/network/erpWebLinks';
import { colors } from '@/theme/colors';

const IGEN_FULL_LOGO = require('../../assets/images/logo-igenerp-transparent.png');

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const {
    signIn,
    signInWithBiometrics,
    canSignInWithBiometrics,
    biometricSettings,
    sessionNotice,
    clearSessionNotice,
  } = useAuth();
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
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

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
      setError(
        'Không còn phiên ERP đã lưu. Hãy đăng nhập bằng mật khẩu trước; lần mở ứng dụng sau có thể dùng sinh trắc học.',
      );
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

  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? (RnStatusBar.currentHeight ?? 24) : 0,
  );
  const bottomInset = Math.max(insets.bottom + 18, 28);

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      {/* Soft luminous icy-blue / lavender pastel canvas matching the reference */}
      <Svg pointerEvents="none" width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="loginCanvasBg" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#EBF3FD" />
            <Stop offset="45%" stopColor="#F3F6FD" />
            <Stop offset="100%" stopColor="#EDF5F9" />
          </LinearGradient>
          <RadialGradient id="loginGlowTopLeft" cx="12%" cy="12%" rx="55%" ry="35%">
            <Stop offset="0%" stopColor="#DCEBFF" stopOpacity="0.8" />
            <Stop offset="100%" stopColor="#DCEBFF" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="loginGlowMidRight" cx="92%" cy="46%" rx="50%" ry="35%">
            <Stop offset="0%" stopColor="#E4E7FF" stopOpacity="0.65" />
            <Stop offset="100%" stopColor="#E4E7FF" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="loginGlowBottom" cx="50%" cy="94%" rx="65%" ry="28%">
            <Stop offset="0%" stopColor="#E2F4FA" stopOpacity="0.6" />
            <Stop offset="100%" stopColor="#E2F4FA" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#loginCanvasBg)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#loginGlowTopLeft)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#loginGlowMidRight)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#loginGlowBottom)" />
      </Svg>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: topInset + 14,
              paddingBottom: bottomInset + (Platform.OS === 'android' ? keyboardHeight : 0),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Top-left brand logo */}
          <View style={styles.topBar}>
            <Image source={IGEN_FULL_LOGO} style={styles.topLogo} resizeMode="contain" />
          </View>

          {/* Centered white login card */}
          <View style={styles.cardStage}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Đăng nhập vào iGen ERP</Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Email</Text>
                <View
                  style={[
                    styles.inputWrap,
                    focusedField === 'email' && styles.inputWrapFocused,
                  ]}
                >
                  <Mail
                    size={17}
                    strokeWidth={1.8}
                    color={focusedField === 'email' ? '#0A74F5' : '#94A3B8'}
                  />
                  <TextInput
                    value={email}
                    onChangeText={(value) => {
                      setEmail(value);
                      if (error) setError('');
                    }}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField((prev) => (prev === 'email' ? null : prev))}
                    placeholder="Nhập địa chỉ email"
                    placeholderTextColor="#94A3B8"
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
                    strokeWidth={1.8}
                    color={focusedField === 'password' ? '#0A74F5' : '#94A3B8'}
                  />
                  <TextInput
                    ref={passwordInputRef}
                    value={password}
                    onChangeText={(value) => {
                      setPassword(value);
                      if (error) setError('');
                    }}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField((prev) => (prev === 'password' ? null : prev))}
                    placeholder="Nhập mật khẩu"
                    placeholderTextColor="#94A3B8"
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
                      <EyeOff size={18} color="#64748B" />
                    ) : (
                      <Eye size={18} color="#64748B" />
                    )}
                  </Pressable>
                </View>
              </View>

              {!!error && <PopupError error={error} title="Không thể đăng nhập" />}

              {/* Pill gradient primary submit button */}
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
                <Svg pointerEvents="none" width="100%" height="100%" style={StyleSheet.absoluteFill}>
                  <Defs>
                    <LinearGradient id="loginSubmitBrandGrad" x1="0" y1="0" x2="1" y2="0.6">
                      <Stop offset="0%" stopColor="#0D8EF4" />
                      <Stop offset="35%" stopColor="#0B7FF1" />
                      <Stop offset="70%" stopColor="#0F71EC" />
                      <Stop offset="100%" stopColor="#1664E6" />
                    </LinearGradient>
                  </Defs>
                  <Rect x="0" y="0" width="100%" height="100%" fill="url(#loginSubmitBrandGrad)" />
                </Svg>
                {busy ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.submitText}>Đăng nhập</Text>
                )}
              </Pressable>

              {biometricSettings.loginEnabled && Platform.OS !== 'web' ? (
                <>
                  <View style={styles.orRow}>
                    <View style={styles.orLine} />
                    <Text style={styles.orText}>Hoặc</Text>
                    <View style={styles.orLine} />
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => {
                      void submitBiometric();
                    }}
                    style={({ pressed }) => [
                      styles.biometricSubmit,
                      busy && styles.submitDisabled,
                      pressed && !busy && styles.biometricPressed,
                    ]}
                  >
                    {busy ? (
                      <ActivityIndicator size="small" color="#0A66E8" />
                    ) : (
                      <Fingerprint size={17} color="#0A66E8" />
                    )}
                    <Text style={styles.biometricSubmitText}>
                      {Platform.OS === 'ios'
                        ? 'Đăng nhập bằng Face ID / Touch ID'
                        : 'Đăng nhập bằng khuôn mặt / vân tay'}
                    </Text>
                  </Pressable>
                </>
              ) : null}
            </View>

            <Text style={styles.signupPrompt}>
              Bạn chưa có tài khoản?{' '}
              <Text style={styles.signupLink}>Tạo tài khoản</Text>
            </Text>
          </View>

          {/* Footer: Chính sách, Điều khoản & Copyright chữ nét mảnh */}
          <View style={styles.footer}>
            <View style={styles.legalWrap}>
              <Pressable
                hitSlop={6}
                onPress={() => void openExternalLink(ERP_PRIVACY_POLICY_URL, 'Chính sách & Bảo mật')}
              >
                <Text style={styles.footerLightText}>Chính sách &amp; Bảo mật</Text>
              </Pressable>
              <Text style={styles.footerLightText}>·</Text>
              <Pressable
                hitSlop={6}
                onPress={() => void openExternalLink(ERP_TERMS_OF_SERVICE_URL, 'Điều khoản sử dụng')}
              >
                <Text style={styles.footerLightText}>Điều khoản sử dụng</Text>
              </Pressable>
            </View>
            <Text style={styles.copyright}>Copyright © 2026 iGen Technology</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: {
    flex: 1,
    backgroundColor: '#EEF3FC',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 18,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 0,
    marginBottom: 20,
  },
  topLogo: {
    width: 110,
    height: 24,
  },
  cardStage: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5ECF6',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
    gap: 16,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 4,
  },
  fieldGroup: {
    gap: 7,
  },
  label: {
    color: '#1E293B',
    fontSize: 14.5,
    fontWeight: '400',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  inputWrapFocused: {
    borderColor: '#0A74F5',
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
  submit: {
    height: 48,
    borderRadius: 999,
    backgroundColor: '#067AF0',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  submitDisabled: { opacity: 0.7 },
  submitPressed: { opacity: 0.88 },
  submitText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 2,
  },
  orLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E2E8F0',
  },
  orText: {
    color: '#64748B',
    fontSize: 12.5,
    fontWeight: '400',
  },
  biometricSubmit: {
    height: 46,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#0A66E8',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  biometricPressed: {
    backgroundColor: '#F0F6FF',
  },
  biometricSubmitText: {
    color: '#0A66E8',
    fontSize: 13.5,
    fontWeight: '500',
  },
  signupPrompt: {
    marginTop: 20,
    textAlign: 'center',
    color: '#475569',
    fontSize: 13.5,
    fontWeight: '400',
  },
  signupLink: {
    color: '#0A66E8',
    fontWeight: '600',
  },
  footer: {
    paddingTop: 28,
    alignItems: 'center',
    gap: 6,
  },
  legalWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  footerLightText: {
    fontSize: 11.5,
    fontWeight: '300',
    color: '#64748B',
    letterSpacing: 0.2,
  },
  copyright: {
    fontSize: 11.5,
    fontWeight: '300',
    color: '#94A3B8',
    letterSpacing: 0.3,
  },
});
