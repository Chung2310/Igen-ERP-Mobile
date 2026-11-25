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
import { useAuth } from '@/core/auth/AuthProvider';
import {
  ERP_PRIVACY_POLICY_URL,
  ERP_TERMS_OF_SERVICE_URL,
} from '@/core/network/erpWebLinks';
import { colors } from '@/theme/colors';

const IGEN_ROBOT_ILLUSTRATION = require('../../assets/images/login-igen-operator.png');
const IGEN_LOGO = require('../../assets/images/logo-igen.png');

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
              paddingBottom: bottomInset + (Platform.OS === 'android' ? keyboardHeight : 0),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Phần trên: Nền xanh + Robot iGen */}
          <View style={[styles.banner, { paddingTop: topInset + 18 }]}>
            <View pointerEvents="none" style={styles.bannerGlowTop} />
            <View pointerEvents="none" style={styles.bannerGlowBottom} />

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

          {/* Phần dưới: Nền trắng phẳng, form đăng nhập trực tiếp (không card bọc) */}
          <View style={styles.whiteSection}>
            <View style={styles.brandHeader}>
              <Image source={IGEN_LOGO} style={styles.logoImage} resizeMode="contain" />
              <Text style={styles.title}>Đăng nhập iGen ERP</Text>
            </View>

            <View style={styles.form}>
              <View
                style={[
                  styles.inputWrap,
                  focusedField === 'email' && styles.inputWrapFocused,
                ]}
              >
                <Mail
                  size={18}
                  strokeWidth={1.8}
                  color={focusedField === 'email' ? '#0A74F5' : '#94A3B8'}
                />
                <TextInput
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    if (error) setError('');
                  }}
                  onFocus={() => handleFieldFocus('email')}
                  onBlur={() => setFocusedField((prev) => (prev === 'email' ? null : prev))}
                  placeholder="Email"
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

              <View
                style={[
                  styles.inputWrap,
                  focusedField === 'password' && styles.inputWrapFocused,
                ]}
              >
                <Lock
                  size={18}
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
                  onFocus={() => handleFieldFocus('password')}
                  onBlur={() => setFocusedField((prev) => (prev === 'password' ? null : prev))}
                  placeholder="Mật khẩu"
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
                    <Eye size={19} color="#94A3B8" />
                  ) : (
                    <EyeOff size={19} color="#94A3B8" />
                  )}
                </Pressable>
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
                  <Text style={styles.submitText}>Đăng nhập</Text>
                )}
              </Pressable>

              {biometricSettings.loginEnabled && Platform.OS !== 'web' ? (
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
                    <ActivityIndicator size="small" color="#0A74F5" />
                  ) : (
                    <Fingerprint size={18} color="#0A74F5" />
                  )}
                  <Text style={styles.biometricSubmitText}>
                    {Platform.OS === 'ios'
                      ? 'Đăng nhập bằng Face ID / Touch ID'
                      : 'Đăng nhập bằng khuôn mặt / vân tay'}
                  </Text>
                </Pressable>
              ) : null}
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
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
  },
  banner: {
    width: '100%',
    backgroundColor: '#0577E7',
    paddingHorizontal: 22,
    paddingBottom: 22,
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
  bannerTitle: {
    color: colors.white,
    fontSize: 17.5,
    lineHeight: 24,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  illustrationWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  illustrationImage: {
    width: '100%',
    maxWidth: 240,
    height: 140,
  },
  whiteSection: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 26,
    paddingTop: 26,
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 22,
  },
  logoImage: {
    width: 112,
    height: 46,
    marginBottom: 10,
  },
  title: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  form: {
    gap: 13,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  inputWrapFocused: {
    borderColor: '#0A74F5',
  },
  input: {
    flex: 1,
    color: colors.ink,
    fontSize: 14.5,
    paddingVertical: 0,
  },
  eyeButton: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submit: {
    height: 48,
    borderRadius: 10,
    backgroundColor: '#0A74F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitDisabled: { opacity: 0.7 },
  submitPressed: { opacity: 0.88 },
  submitText: {
    color: colors.white,
    fontSize: 15.5,
    fontWeight: '700',
  },
  biometricSubmit: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  biometricPressed: {
    opacity: 0.7,
  },
  biometricSubmitText: {
    color: '#0A74F5',
    fontSize: 13.5,
    fontWeight: '600',
  },
  footer: {
    marginTop: 'auto',
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
    color: '#94A3B8',
    letterSpacing: 0.2,
  },
  copyright: {
    fontSize: 11.5,
    fontWeight: '300',
    color: '#94A3B8',
    letterSpacing: 0.3,
  },
});
