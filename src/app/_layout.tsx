import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppSplashScreen } from '@/components/AppSplashScreen';
import { BrandLoader } from '@/components/BrandLoader';
import { AuthProvider, useAuth } from '@/core/auth/AuthProvider';
import { HrConfirmHost } from '@/features/hr/components/HrConfirmModal';
import { canAccessOverview } from '@/features/overview/overviewCatalog';
import { colors } from '@/theme/colors';
import { Fingerprint, LogOut, ShieldCheck } from 'lucide-react-native';

void SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AuthenticatedRouter />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function AuthenticatedRouter() {
  const { user, isLoading, isAppLocked } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const isLoginRoute = segments[0] === 'login';
  const showLockScreen = !isLoading && isAppLocked;
  const redirectPending = !isLoading && !showLockScreen && ((!user && !isLoginRoute) || (Boolean(user) && isLoginRoute));

  const [splashMinElapsed, setSplashMinElapsed] = useState(false);
  const [splashVisible, setSplashVisible] = useState(true);

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => {});
    const timer = setTimeout(() => setSplashMinElapsed(true), 1600);
    return () => clearTimeout(timer);
  }, []);

  const splashFadingOut = splashMinElapsed && !isLoading && !redirectPending;
  const handleSplashComplete = useCallback(() => {
    setSplashVisible(false);
  }, []);

  useEffect(() => {
    if (isLoading || showLockScreen) return;
    if (!user && !isLoginRoute) router.replace('/login');
    else if (user && isLoginRoute) router.replace(canAccessOverview(user) ? '/(tabs)' : '/(tabs)/modules');
  }, [user, isLoading, isLoginRoute, router, showLockScreen]);

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      {showLockScreen ? (
        <BiometricLockScreen />
      ) : (
        <>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
              animation: 'ios_from_right',
              animationDuration: 260,
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
            }}
          >
            <Stack.Screen
              name="login"
              options={{ headerShown: false, animation: 'fade', animationDuration: 220 }}
            />
            <Stack.Screen
              name="(tabs)"
              options={{ animation: 'fade', animationDuration: 220 }}
            />
            <Stack.Screen
              name="modules/[slug]"
              options={{
                headerShown: true,
                title: 'Phân hệ',
                headerBackTitle: 'Trở lại',
                headerTintColor: colors.ink,
                animation: 'ios_from_right',
              }}
            />
            <Stack.Screen
              name="profile/[section]"
              options={{
                headerShown: true,
                title: 'Cài đặt cá nhân',
                headerBackTitle: 'Trở lại',
                headerTintColor: colors.ink,
                animation: 'ios_from_right',
              }}
            />
          </Stack>
          <HrConfirmHost />
        </>
      )}
      {(isLoading || redirectPending) && !showLockScreen && !splashVisible && (
        <View style={styles.loadingOverlay}><BrandLoader size={52} /></View>
      )}
      {splashVisible && (
        <AppSplashScreen
          fadingOut={splashFadingOut}
          onFadeComplete={handleSplashComplete}
        />
      )}
    </View>
  );
}

function BiometricLockScreen() {
  const { unlockApp, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  const onUnlock = useCallback(async () => {
    setBusy(true);
    try {
      await unlockApp();
    } catch (error) {
      Alert.alert('Không thể mở khóa', error instanceof Error ? error.message : 'Hãy thử lại hoặc đăng nhập bằng mật khẩu.');
    } finally {
      setBusy(false);
    }
  }, [unlockApp]);

  useEffect(() => { void onUnlock(); }, [onUnlock]);

  async function onUsePassword() {
    try {
      await signOut();
    } catch {
      // signOut clears the local session even if ERP cannot confirm it.
    }
  }

  return (
    <View style={styles.lockScreen}>
      <View style={styles.lockIcon}><ShieldCheck size={28} color={colors.primary} /></View>
      <Text style={styles.lockTitle}>ERP Mobile đang khóa</Text>
      <Text style={styles.lockDescription}>Xác thực bằng sinh trắc học của thiết bị để tiếp tục.</Text>
      <Pressable disabled={busy} onPress={() => void onUnlock()} style={[styles.unlockButton, busy && styles.disabled]}>
        {busy ? <ActivityIndicator size="small" color={colors.white} /> : <Fingerprint size={18} color={colors.white} />}
        <Text style={styles.unlockButtonText}>{busy ? 'Đang xác thực...' : 'Mở khóa bằng sinh trắc học'}</Text>
      </Pressable>
      <Pressable onPress={() => void onUsePassword()} style={styles.passwordFallback}>
        <LogOut size={14} color={colors.muted} />
        <Text style={styles.passwordFallbackText}>Đăng xuất và dùng mật khẩu</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loadingOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  lockScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, backgroundColor: colors.background },
  lockIcon: { width: 68, height: 68, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F0FF' },
  lockTitle: { color: colors.ink, fontSize: 20, fontWeight: '800', marginTop: 18 },
  lockDescription: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 7, maxWidth: 290 },
  unlockButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 20, borderRadius: 14, backgroundColor: colors.primary, marginTop: 25 },
  unlockButtonText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  disabled: { opacity: 0.7 },
  passwordFallback: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 14, paddingHorizontal: 12 },
  passwordFallbackText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
});
