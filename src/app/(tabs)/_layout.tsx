import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { Bot, House, LayoutGrid, MessageSquare, Settings } from 'lucide-react-native';
import { useAuth } from '@/core/auth/AuthProvider';
import { canAccessOverview } from '@/features/overview/overviewCatalog';
import { colors } from '@/theme/colors';

const tabOptions = {
  headerShown: false,
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: colors.muted,
  tabBarStyle: { height: 76, paddingTop: 6, paddingBottom: 5, borderTopColor: colors.border, backgroundColor: colors.white },
  tabBarLabelStyle: { fontSize: 8, lineHeight: 10, fontWeight: '600' as const },
};

export default function TabLayout() {
  const { user } = useAuth();
  const showOverview = canAccessOverview(user);

  return (
    <Tabs screenOptions={tabOptions}>
      <Tabs.Screen
        name="index"
        options={{
          href: showOverview ? undefined : null,
          title: 'Tổng quan',
          tabBarLabel: 'Tổng quan',
          tabBarIcon: ({ color }) => <House size={19} color={color} />,
        }}
      />
      <Tabs.Screen name="modules" options={{ title: 'Danh mục', tabBarLabel: 'Danh mục', tabBarIcon: ({ color }) => <LayoutGrid size={19} color={color} /> }} />
      <Tabs.Screen name="inbox" options={{ title: 'Trò chuyện', tabBarLabel: 'Trò chuyện', tabBarIcon: ({ color }) => <MessageSquare size={19} color={color} /> }} />
      <Tabs.Screen name="ai-chat" options={{ title: 'Trò chuyện AI', tabBarLabel: 'Trò chuyện AI', tabBarIcon: ({ color }) => <Bot size={19} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Cài đặt cá nhân', tabBarLabel: ({ color }) => <Text style={{ color, fontSize: 8, lineHeight: 10, textAlign: 'center' }}>Cài đặt{'\n'}cá nhân</Text>, tabBarIcon: ({ color }) => <Settings size={19} color={color} /> }} />
    </Tabs>
  );
}
