import { Tabs } from 'expo-router';
import { Text } from 'react-native';
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

const tabOptions = {
  headerShown: false,
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: TAB_INACTIVE_COLOR,
  tabBarStyle: {
    height: 78,
    paddingTop: 7,
    paddingBottom: 6,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
  tabBarLabelStyle: { fontSize: 9.5, lineHeight: 12, fontWeight: '600' as const, marginTop: 2 },
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
          tabBarIcon: ({ color, focused }) => (
            <OverviewTabIcon color={color} focused={focused} size={23} />
          ),
        }}
      />
      <Tabs.Screen
        name="modules"
        options={{
          title: 'Danh mục',
          tabBarLabel: 'Danh mục',
          tabBarIcon: ({ color, focused }) => (
            <ModulesTabIcon color={color} focused={focused} size={23} />
          ),
        }}
      />
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
          title: 'Trò chuyện AI',
          tabBarLabel: 'Trò chuyện AI',
          tabBarIcon: ({ color, focused }) => (
            <AiChatTabIcon color={color} focused={focused} size={23} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Cài đặt cá nhân',
          tabBarLabel: ({ color }) => (
            <Text
              style={{
                color,
                fontSize: 9.5,
                lineHeight: 11,
                fontWeight: '600',
                textAlign: 'center',
                marginTop: 2,
              }}
            >
              Cài đặt{'\n'}cá nhân
            </Text>
          ),
          tabBarIcon: ({ color, focused }) => (
            <ProfileTabIcon color={color} focused={focused} size={23} />
          ),
        }}
      />
    </Tabs>
  );
}
