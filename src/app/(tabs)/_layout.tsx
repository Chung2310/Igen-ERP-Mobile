import { Tabs } from 'expo-router';
import { Platform, Pressable, type PressableProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AiChatTabIcon,
  InboxTabIcon,
  ModulesTabIcon,
  OverviewTabIcon,
  ProfileTabIcon,
} from '@/components/TabBarIcons';
import { useAuth } from '@/core/auth/AuthProvider';
import { canAccessOverview } from '@/features/overview/overviewCatalog';
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
  const insets = useSafeAreaInsets();
  const bottomInset =
    Platform.OS === 'android'
      ? Math.max(insets.bottom + 8, 24)
      : Math.max(insets.bottom, 12);

  const tabOptions = {
    headerShown: false,
    lazy: false,
    animation: 'fade' as const,
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
