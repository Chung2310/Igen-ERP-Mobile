import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F5F7FB' } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="modules/[slug]" options={{ headerShown: true, title: 'Phân hệ', headerBackTitle: 'Trở lại', headerTintColor: '#17233B' }} />
      </Stack>
    </>
  );
}
