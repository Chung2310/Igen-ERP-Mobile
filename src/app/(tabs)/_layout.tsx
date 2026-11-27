import { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { AppState, Platform, Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AiChatTabIcon,
  InboxTabIcon,
  ModulesTabIcon,
  NotificationsTabIcon,
  OverviewTabIcon,
  ProfileTabIcon,
} from '@/components/TabBarIcons';
import { useAuth } from '@/core/auth/AuthProvider';
import { canAccessOverview } from '@/features/overview/overviewCatalog';
import { canAccessModule } from '@/features/modules/moduleCatalog';
import { getUserNotifications, subscribeUnreadNotificationCount } from '@/features/notifications/notificationsApi';
import { colors } from '@/theme/colors';

const TAB_INACTIVE_COLOR = '#4B5565';

function NoRippleTabButton({
  ref: _ref,
  android_ripple: _ripple,
  ...props
}: Record<string, unknown>) {
  return (
    <Pressable
      {...(props as PressableProps)}
      android_ripple={undefined}
    />
  );
}

export default function TabLayout() {
  const { user } = useAuth();
  const showOverview = canAccessOverview(user);
  const showChat = canAccessModule(user, 'chat');
  const [unreadCount, setUnreadCount] = useState(0);
  const insets = useSafeAreaInsets();
  const bottomInset =
    Platform.OS === 'android'
      ? Math.max(insets.bottom + 8, 24)
      : Math.max(insets.bottom, 12);

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

  const tabOptions = {
    headerShown: false,
    lazy: false,
    animation: 'none' as const,
    sceneStyle: { backgroundColor: colors.white },
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: TAB_INACTIVE_COLOR,
    tabBarButton: (props: Record<string, unknown>) => <NoRippleTabButton {...props} />,
    tabBarStyle: {
      height: 60 + bottomInset,
      paddingTop: 8,
      paddingBottom: bottomInset,
      borderTopColor: colors.border,
      backgroundColor: colors.white,
    },
    tabBarLabelStyle: { fontSize: 9.5, lineHeight: 12, fontWeight: '600' as const, marginTop: 2 },
  };

  return (
    <Tabs detachInactiveScreens={false} screenOptions={tabOptions}>
      <Tabs.Screen
        name="inbox"
        options={{
          href: showChat ? undefined : null,
          title: 'Trò chuyện',
          tabBarLabel: 'Trò chuyện',
          tabBarIcon: ({ color, focused }) => (
            <InboxTabIcon color={color} focused={focused} size={23} />
          ),
        }}
      />
      <Tabs.Screen
        name="ai-chat"
        options={{
          href: showChat ? undefined : null,
          title: 'iGenAI',
          tabBarLabel: 'iGenAI',
          tabBarIcon: ({ color, focused }) => (
            <AiChatTabIcon color={color} focused={focused} size={23} />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          href: showOverview ? undefined : null,
          title: 'Tổng quan',
          tabBarLabel: 'Tổng quan',
          tabBarIcon: ({ color, focused }) => (
            <OverviewTabIcon color={color} focused={focused} size={23} />
          ),
        }}
      />
      <Tabs.Screen
        name="modules"
        options={{
          title: 'Tính năng',
          tabBarLabel: 'Tính năng',
          tabBarIcon: ({ color, focused }) => (
            <ModulesTabIcon color={color} focused={focused} size={23} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
          title: 'Thông báo',
          tabBarLabel: 'Thông báo',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.notificationTabIcon}>
              <NotificationsTabIcon color={color} focused={focused} size={23} />
              {unreadCount > 0 ? (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              ) : null}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Cài đặt',
          tabBarLabel: 'Cài đặt',
          tabBarIcon: ({ color, focused }) => (
            <ProfileTabIcon color={color} focused={focused} size={23} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  notificationTabIcon: { position: 'relative', width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  notificationBadge: { position: 'absolute', top: -3, right: -8, minWidth: 14, height: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderRadius: 7, backgroundColor: '#D92D20', borderWidth: 1, borderColor: colors.white },
  notificationBadgeText: { color: colors.white, fontSize: 7, lineHeight: 9, fontWeight: '800' },
});
