import { useMemo, useRef } from 'react';
import { Tabs, useRouter, type Href } from 'expo-router';
import {
  type Animated,
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
  if (!visibleTabRoutes.includes(currentTabRef.current)) {
    currentTabRef.current = showOverview ? 'index' : (visibleTabRoutes[0] ?? 'modules');
  }
  const routerRef = useRef(router);
  routerRef.current = router;
  const tabNavRef = useRef<{ navigate: (name: string) => void } | null>(null);
  const screenWidthRef = useRef(screenWidth);
  screenWidthRef.current = screenWidth;
  const swipedInGestureRef = useRef(false);

  const navigateByDelta = (delta: -1 | 1) => {
    const active = currentTabRef.current;
    const routes = visibleTabRoutesRef.current;
    const idx = routes.indexOf(active);
    const nextIdx = idx + delta;
    if (idx < 0 || nextIdx < 0 || nextIdx >= routes.length) return false;
    const nextTab = routes[nextIdx];
    currentTabRef.current = nextTab;
    Keyboard.dismiss();
    if (tabNavRef.current) {
      tabNavRef.current.navigate(nextTab);
    } else {
      routerRef.current.navigate(TAB_HREFS[nextTab]);
    }
    return true;
  };
  const navigateByDeltaRef = useRef(navigateByDelta);
  navigateByDeltaRef.current = navigateByDelta;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => {
        const active = currentTabRef.current;
        const routes = visibleTabRoutesRef.current;
        if (!active || routes.length <= 1) return false;
        // Note: gesture.x0 is 0 before grant, so derive startX from moveX - dx
        const startX = gesture.moveX - gesture.dx;
        if (startX < 18 || startX > screenWidthRef.current - 18) return false;
        if (Math.abs(gesture.dx) <= 14 || Math.abs(gesture.dx) <= Math.abs(gesture.dy) * 1.4) {
          return false;
        }
        const idx = routes.indexOf(active);
        if (idx < 0) return false;
        if (gesture.dx > 0 && idx <= 0) return false;
        if (gesture.dx < 0 && idx >= routes.length - 1) return false;
        return true;
      },
      onPanResponderGrant: () => {
        swipedInGestureRef.current = false;
      },
      onPanResponderMove: (_, gesture) => {
        if (swipedInGestureRef.current) return;
        if (Math.abs(gesture.dx) >= 48 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2) {
          swipedInGestureRef.current = true;
          navigateByDeltaRef.current(gesture.dx < 0 ? 1 : -1);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (swipedInGestureRef.current) {
          swipedInGestureRef.current = false;
          return;
        }
        const isHorizontalFlick =
          (Math.abs(gesture.dx) >= 34 || (Math.abs(gesture.vx) >= 0.3 && Math.abs(gesture.dx) >= 20)) &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2;

        if (isHorizontalFlick) {
          navigateByDeltaRef.current(gesture.dx < 0 ? 1 : -1);
        }
      },
      onPanResponderTerminate: () => {
        swipedInGestureRef.current = false;
      },
    }),
  ).current;

  const tabOptions = useMemo(
    () => ({
      headerShown: false,
      freezeOnBlur: true,
      transitionSpec: {
        animation: 'timing' as const,
        config: {
          duration: 210,
          easing: Easing.out(Easing.cubic),
        },
      },
      sceneStyleInterpolator: ({
        current,
      }: {
        current: { progress: Animated.AnimatedInterpolation<number> };
      }) => ({
        sceneStyle: {
          transform: [
            {
              translateX: current.progress.interpolate({
                inputRange: [-1, 0, 1],
                outputRange: [-screenWidth, 0, screenWidth],
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
    () => ({
      route,
      navigation,
    }: {
      route: { name: string };
      navigation: { navigate: (name: string) => void };
    }) => ({
      focus: () => {
        tabNavRef.current = navigation;
        const routeName = route.name as TabRouteKey;
        if (visibleTabRoutesRef.current.includes(routeName)) {
          currentTabRef.current = routeName;
        }
      },
    }),
    [],
  );

  return (
    <View
      {...panResponder.panHandlers}
      style={{ flex: 1 }}
    >
      <Tabs
        backBehavior="initialRoute"
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
