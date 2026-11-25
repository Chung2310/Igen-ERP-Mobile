import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIOMETRIC_SETTINGS_KEY = 'igen-erp-mobile.biometric-settings';

export type BiometricSettings = {
  loginEnabled: boolean;
  attendanceEnabled: boolean;
  appLockEnabled: boolean;
};

export type BiometricFeature = 'loginEnabled' | 'attendanceEnabled' | 'appLockEnabled';

export const DEFAULT_BIOMETRIC_SETTINGS: BiometricSettings = {
  loginEnabled: false,
  attendanceEnabled: false,
  appLockEnabled: false,
};

export async function getBiometricSettings(): Promise<BiometricSettings> {
  try {
    const raw = Platform.OS === 'web'
      ? globalThis.localStorage?.getItem(BIOMETRIC_SETTINGS_KEY)
      : await SecureStore.getItemAsync(BIOMETRIC_SETTINGS_KEY);
    if (!raw) return DEFAULT_BIOMETRIC_SETTINGS;
    return { ...DEFAULT_BIOMETRIC_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_BIOMETRIC_SETTINGS;
  }
}

export async function saveBiometricSettings(settings: BiometricSettings): Promise<void> {
  const raw = JSON.stringify(settings);
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(BIOMETRIC_SETTINGS_KEY, raw);
    return;
  }
  await SecureStore.setItemAsync(BIOMETRIC_SETTINGS_KEY, raw);
}

export async function getBiometricAvailability(feature: BiometricFeature): Promise<{ available: boolean; message?: string }> {
  if (Platform.OS === 'web') {
    return { available: false, message: 'Xác thực sinh trắc học chỉ dùng được trên iOS và Android.' };
  }

  try {
    const [hasHardware, isEnrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);

    if (!hasHardware) {
      return { available: false, message: 'Thiết bị không có cảm biến sinh trắc học.' };
    }
    if (!isEnrolled) {
      return { available: false, message: 'Hãy đăng ký Face ID, khuôn mặt hoặc vân tay trong cài đặt thiết bị trước.' };
    }

    if (feature === 'attendanceEnabled' && !types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return {
        available: false,
        message: Platform.OS === 'android'
          ? 'Chấm công cần thiết bị Android hỗ trợ sinh trắc học khuôn mặt.'
          : 'Xác thực chấm công cần thiết bị có Face ID.',
      };
    }
    if (Platform.OS === 'android' && feature === 'appLockEnabled') {
      const enrolledLevel = await LocalAuthentication.getEnrolledLevelAsync();
      if (enrolledLevel < LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG) {
        return { available: false, message: 'Khóa ứng dụng cần vân tay hoặc sinh trắc học Android cấp mạnh đã đăng ký.' };
      }
    }
    if (!types.length) {
      return { available: false, message: 'Thiết bị chưa có phương thức sinh trắc học được hỗ trợ.' };
    }

    return { available: true };
  } catch {
    return { available: false, message: 'Không kiểm tra được sinh trắc học trên thiết bị.' };
  }
}

export async function authenticateBiometric(feature: BiometricFeature, promptMessage: string) {
  const options = {
    promptMessage,
    cancelLabel: 'Hủy',
    disableDeviceFallback: true,
    ...(Platform.OS === 'android'
      ? { biometricsSecurityLevel: feature === 'appLockEnabled' ? 'strong' as const : 'weak' as const }
      : {}),
  };
  return LocalAuthentication.authenticateAsync(options);
}

export function isBiometricCancellation(result: { success: boolean; error?: string }): boolean {
  return !result.success && ['user_cancel', 'app_cancel', 'system_cancel', 'user_fallback'].includes(result.error || '');
}

export function biometricErrorMessage(error?: string): string {
  switch (error) {
    case 'not_enrolled':
      return 'Hãy đăng ký sinh trắc học trong cài đặt thiết bị rồi thử lại.';
    case 'not_available':
      return 'Thiết bị không hỗ trợ xác thực sinh trắc học.';
    case 'lockout':
      return 'Sinh trắc học đang tạm khóa. Hãy thử lại sau.';
    case 'authentication_failed':
      return 'Không xác thực được. Hãy thử lại.';
    case 'user_cancel':
    case 'app_cancel':
    case 'system_cancel':
    case 'user_fallback':
      return 'Bạn đã hủy xác thực.';
    default:
      return 'Xác thực sinh trắc học thất bại. Hãy thử lại.';
  }
}
