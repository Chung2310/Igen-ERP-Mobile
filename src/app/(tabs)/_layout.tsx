import { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { Bell, Bot, House, LayoutGrid, MessageSquare, Settings } from 'lucide-react-native';
import { useAuth } from '@/core/auth/AuthProvider';
import { canAccessOverview } from '@/features/overview/overviewCatalog';
import { canAccessModule } from '@/features/modules/moduleCatalog';
import { getUserNotifications, subscribeUnreadNotificationCount } from '@/features/notifications/notificationsApi';
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
  const showChat = canAccessModule(user, 'chat');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let active = true;
    const refreshUnreadCount = async () => {
      try {
        const result = await getUserNotifications({ page: 1, limit: 1 });
        if (!active) return;
        setUnreadCount(result.unreadCount || 0);
      } catch {
        // Notifications are optional for accounts without a company notification feed.
      }
    };
    void refreshUnreadCount();
    const interval = setInterval(() => void refreshUnreadCount(), 60_000);
    const subscription = subscribeUnreadNotificationCount(setUnreadCount);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshUnreadCount();
    });
    return () => {
      active = false;
      clearInterval(interval);
      subscription.remove();
      appStateSubscription.remove();
    };
  }, [user?.id, user?._id]);

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
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Thông báo',
          tabBarLabel: 'Thông báo',
          tabBarIcon: ({ color }) => (
            <View style={styles.notificationTabIcon}>
              <Bell size={19} color={color} />
              {unreadCount > 0 ? (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              ) : null}
            </View>
          ),
        }}
      />
      <Tabs.Screen name="inbox" options={{ href: showChat ? undefined : null, title: 'Trò chuyện', tabBarLabel: 'Trò chuyện', tabBarIcon: ({ color }) => <MessageSquare size={19} color={color} /> }} />
      <Tabs.Screen name="ai-chat" options={{ href: showChat ? undefined : null, title: 'Trò chuyện AI', tabBarLabel: 'Trò chuyện AI', tabBarIcon: ({ color }) => <Bot size={19} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Cài đặt cá nhân', tabBarLabel: ({ color }) => <Text style={{ color, fontSize: 8, lineHeight: 10, textAlign: 'center' }}>Cài đặt{'\n'}cá nhân</Text>, tabBarIcon: ({ color }) => <Settings size={19} color={color} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  notificationTabIcon: { position: 'relative', width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  notificationBadge: { position: 'absolute', top: -3, right: -8, minWidth: 14, height: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderRadius: 7, backgroundColor: '#D92D20', borderWidth: 1, borderColor: colors.white },
  notificationBadgeText: { color: colors.white, fontSize: 7, lineHeight: 9, fontWeight: '800' },
});
