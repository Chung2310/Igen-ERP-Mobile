import { useMemo, useRef } from 'react';
import { Tabs, useRouter, type Href } from 'expo-router';
import {
  Animated,
  Easing,
  Keyboard,
  PanResponder,
  Platform,
  Pressable,
  useWindowDimensions,
  View,
  type PressableProps,
} from 'react-native';
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
import { canAccessModule } from '@/features/modules/moduleCatalog';
import { colors } from '@/theme/colors';

const TAB_INACTIVE_COLOR = '#4B5565';

type TabRouteKey = 'inbox' | 'ai-chat' | 'index' | 'modules' | 'profile';

const TAB_HREFS: Record<TabRouteKey, Href> = {
  inbox: '/(tabs)/inbox',
  'ai-chat': '/(tabs)/ai-chat',
  index: '/(tabs)',
  modules: '/(tabs)/modules',
  profile: '/(tabs)/profile',
};

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

const renderNoRippleTabButton = (props: Record<string, unknown>) => (
  <NoRippleTabButton {...props} />
);

export default function TabLayout() {
  const { user } = useAuth();
  const router = useRouter();
  const showOverview = canAccessOverview(user);
  const showChat = canAccessModule(user, 'chat');
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const bottomInset =
    Platform.OS === 'android'
      ? Math.max(insets.bottom + 8, 24)
      : Math.max(insets.bottom, 12);

  const visibleTabRoutes = useMemo<TabRouteKey[]>(() => {
    const routes: TabRouteKey[] = [];
    if (showChat) routes.push('inbox', 'ai-chat');
    if (showOverview) routes.push('index');
    routes.push('modules', 'profile');
    return routes;
  }, [showChat, showOverview]);

  const visibleTabRoutesRef = useRef(visibleTabRoutes);
  visibleTabRoutesRef.current = visibleTabRoutes;
  const currentTabRef = useRef<TabRouteKey>(showOverview ? 'index' : 'modules');
  const routerRef = useRef(router);
  routerRef.current = router;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => {
        const active = currentTabRef.current;
        const routes = visibleTabRoutesRef.current;
        if (!active || routes.length <= 1) return false;
        if (Math.abs(gesture.dx) <= 18 || Math.abs(gesture.dx) <= Math.abs(gesture.dy) * 1.6) {
          return false;
        }
        const idx = routes.indexOf(active);
        if (idx < 0) return false;
        if (gesture.dx > 0 && idx <= 0) return false;
        if (gesture.dx < 0 && idx >= routes.length - 1) return false;
        return true;
      },
      onPanResponderRelease: (_, gesture) => {
        const active = currentTabRef.current;
        const routes = visibleTabRoutesRef.current;
        const idx = routes.indexOf(active);
        if (idx < 0) return;
        const isHorizontalSwipe =
          (Math.abs(gesture.dx) >= 54 || Math.abs(gesture.vx) >= 0.45) &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.3;
        if (!isHorizontalSwipe) return;

        const nextIdx = gesture.dx < 0 ? idx + 1 : idx - 1;
        if (nextIdx >= 0 && nextIdx < routes.length) {
          const nextTab = routes[nextIdx];
          currentTabRef.current = nextTab;
          Keyboard.dismiss();
          routerRef.current.navigate(TAB_HREFS[nextTab]);
        }
      },
    }),
  ).current;

  const tabOptions = useMemo(
    () => ({
      headerShown: false,
      lazy: false,
      freezeOnBlur: true,
      transitionSpec: {
        animation: 'timing' as const,
        config: {
          duration: 200,
          easing: Easing.out(Easing.cubic),
        },
      },
      sceneStyleInterpolator: ({
        current,
      }: {
        current: { progress: Animated.AnimatedInterpolation<number> };
      }) => ({
        sceneStyle: {
          opacity: current.progress.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [0, 1, 0],
            extrapolate: 'clamp',
          }),
          transform: [
            {
              translateX: current.progress.interpolate({
                inputRange: [-1, 0, 1],
                outputRange: [-screenWidth * 0.24, 0, screenWidth * 0.24],
                extrapolate: 'clamp',
              }),
            },
          ],
        },
      }),
      sceneStyle: { backgroundColor: colors.white },
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: TAB_INACTIVE_COLOR,
      tabBarButton: renderNoRippleTabButton,
      tabBarStyle: {
        height: 60 + bottomInset,
        paddingTop: 8,
        paddingBottom: bottomInset,
        borderTopColor: colors.border,
        backgroundColor: colors.white,
      },
      tabBarLabelStyle: { fontSize: 9.5, lineHeight: 12, fontWeight: '600' as const, marginTop: 2 },
    }),
    [bottomInset, screenWidth],
  );

  const screenListeners = useMemo(
    () => ({ route }: { route: { name: string } }) => ({
      focus: () => {
        const routeName = route.name as TabRouteKey;
        if (visibleTabRoutesRef.current.includes(routeName)) {
          currentTabRef.current = routeName;
        }
      },
    }),
    [],
  );

  return (
    <View {...panResponder.panHandlers} style={{ flex: 1 }}>
      <Tabs
        detachInactiveScreens={false}
        screenOptions={tabOptions}
        screenListeners={screenListeners}
      >
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
    </View>
  );
}
