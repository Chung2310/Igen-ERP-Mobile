import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '@/theme/colors';

const tabOptions = {
  headerShown: false,
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: colors.muted,
  tabBarStyle: { height: 66, paddingTop: 8, paddingBottom: 8, borderTopColor: colors.border, backgroundColor: colors.white },
  tabBarLabelStyle: { fontSize: 11, fontWeight: '600' as const },
};

export default function TabLayout() {
  return (
    <Tabs screenOptions={tabOptions}>
      <Tabs.Screen name="index" options={{ title: 'Tổng quan', tabBarLabel: 'Tổng quan', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 17 }}>⌂</Text> }} />
      <Tabs.Screen name="modules" options={{ title: 'Phân hệ', tabBarLabel: 'Phân hệ', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 16 }}>▦</Text> }} />
      <Tabs.Screen name="inbox" options={{ title: 'Hộp thư', tabBarLabel: 'Hộp thư', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 16 }}>▤</Text> }} />
      <Tabs.Screen name="profile" options={{ title: 'Tài khoản', tabBarLabel: 'Tài khoản', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 16 }}>♙</Text> }} />
    </Tabs>
  );
}
