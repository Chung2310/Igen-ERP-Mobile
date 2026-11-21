import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/core/auth/AuthProvider';
import { HrConfirmHost } from '@/features/hr/components/HrConfirmModal';
import { colors } from '@/theme/colors';

export default function RootLayout() {
  return (
    <AuthProvider>
      <AuthenticatedRouter />
    </AuthProvider>
  );
}

function AuthenticatedRouter() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const isLoginRoute = segments[0] === 'login';
  const redirectPending = !isLoading && ((!user && !isLoginRoute) || (Boolean(user) && isLoginRoute));

  useEffect(() => {
    if (isLoading) return;
    if (!user && !isLoginRoute) router.replace('/login');
    else if (user && isLoginRoute) router.replace('/(tabs)');
  }, [user, isLoading, isLoginRoute, router]);

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="modules/[slug]" options={{ headerShown: true, title: 'Phân hệ', headerBackTitle: 'Trở lại', headerTintColor: colors.ink }} />
        <Stack.Screen name="profile/[section]" options={{ headerShown: true, title: 'Cài đặt cá nhân', headerBackTitle: 'Trở lại', headerTintColor: colors.ink }} />
      </Stack>
      {(isLoading || redirectPending) && <View style={styles.loadingOverlay}><ActivityIndicator size="small" color={colors.primary} /></View>}
      <HrConfirmHost />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loadingOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
