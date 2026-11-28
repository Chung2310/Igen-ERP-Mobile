import { useCallback, useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { colors } from '@/theme/colors';

export type ChipBarItem<T extends string = string> = {
  key: T;
  label: string;
  renderPrefix?: (active: boolean) => ReactNode;
};

type CenteringChipBarProps<T extends string> = {
  items: ReadonlyArray<ChipBarItem<T>>;
  activeKey: T;
  onSelect: (key: T) => void;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  chipStyle?: StyleProp<ViewStyle>;
  chipActiveStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  textActiveStyle?: StyleProp<TextStyle>;
  showUnderline?: boolean;
};

/**
 * Clean underline horizontal tab/filter bar (reference style with app primary color).
 * Smoothly glides the bottom underline indicator to the selected item and centers
 * the selected tab inside the horizontal ScrollView.
 */
export function CenteringChipBar<T extends string>({
  items,
  activeKey,
  onSelect,
  style,
  contentContainerStyle,
  chipStyle,
  chipActiveStyle,
  textStyle,
  textActiveStyle,
  showUnderline = true,
}: CenteringChipBarProps<T>) {
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const containerWidthRef = useRef(0);
  const contentWidthRef = useRef(0);
  const itemLayoutsRef = useRef<Record<string, { x: number; width: number }>>({});
  const hasScrolledOnceRef = useRef(false);

  const indicatorX = useRef(new Animated.Value(0)).current;
  const [indicatorWidth, setIndicatorWidth] = useState(0);
  const indicatorInitRef = useRef(false);

  const moveIndicator = useCallback(
    (key: string, animated: boolean) => {
      if (!showUnderline) return;
      const layout = itemLayoutsRef.current[key];
      if (!layout || layout.width <= 0) return;

      setIndicatorWidth(layout.width);
      if (!animated || !indicatorInitRef.current) {
        indicatorInitRef.current = true;
        indicatorX.setValue(layout.x);
        return;
      }

      indicatorX.stopAnimation();
      Animated.spring(indicatorX, {
        toValue: layout.x,
        useNativeDriver: true,
        speed: 28,
        bounciness: 2,
      }).start();
    },
    [indicatorX, showUnderline],
  );

  const centerItem = useCallback((key: string, animated: boolean) => {
    const layout = itemLayoutsRef.current[key];
    const containerW = containerWidthRef.current;
    if (!layout || containerW <= 0) return;

    const targetX = layout.x + layout.width / 2 - containerW / 2;
    const maxScroll = Math.max(0, contentWidthRef.current - containerW);
    const clampedX = Math.max(0, Math.min(maxScroll, targetX));
    scrollRef.current?.scrollTo({ x: clampedX, animated });
  }, []);

  useEffect(() => {
    const animated = hasScrolledOnceRef.current;
    hasScrolledOnceRef.current = true;
    moveIndicator(activeKey, animated);
    const frame = requestAnimationFrame(() => centerItem(activeKey, animated));
    return () => cancelAnimationFrame(frame);
  }, [activeKey, centerItem, moveIndicator]);

  const handleContainerLayout = useCallback(
    (e: LayoutChangeEvent) => {
      containerWidthRef.current = e.nativeEvent.layout.width;
      centerItem(activeKey, false);
    },
    [activeKey, centerItem],
  );

  const handleContentSizeChange = useCallback(
    (w: number) => {
      contentWidthRef.current = w;
      centerItem(activeKey, false);
    },
    [activeKey, centerItem],
  );

  return (
    <View style={[styles.tabBarContainer, style]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onLayout={handleContainerLayout}
        onContentSizeChange={handleContentSizeChange}
        contentContainerStyle={[styles.tabBarContent, contentContainerStyle]}
      >
        {items.map((item) => {
          const active = item.key === activeKey;
          return (
            <Pressable
              key={item.key}
              onLayout={(e) => {
                const { x, width } = e.nativeEvent.layout;
                itemLayoutsRef.current[item.key] = { x, width };
                if (item.key === activeKey) {
                  moveIndicator(activeKey, indicatorInitRef.current);
                  if (containerWidthRef.current > 0) {
                    centerItem(activeKey, hasScrolledOnceRef.current);
                  }
                }
              }}
              onPress={() => {
                onSelect(item.key);
                moveIndicator(item.key, true);
                centerItem(item.key, true);
              }}
              style={({ pressed }) => [
                styles.tabItem,
                chipStyle,
                item.renderPrefix ? styles.rowChip : null,
                active && chipActiveStyle,
                pressed && styles.chipPressed,
              ]}
            >
              {item.renderPrefix ? item.renderPrefix(active) : null}
              <Text
                numberOfLines={1}
                style={[
                  styles.tabText,
                  textStyle,
                  active && styles.tabTextActive,
                  active && textActiveStyle,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
        {showUnderline && indicatorWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.underlineIndicator,
              { width: indicatorWidth, transform: [{ translateX: indicatorX }] },
            ]}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

type SlidingSegmentBarProps<T extends string> = {
  items: ReadonlyArray<{ key: T; label: string }>;
  activeKey: T;
  onSelect: (key: T) => void;
  style?: StyleProp<ViewStyle>;
  indicatorStyle?: StyleProp<ViewStyle>;
  itemStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  textActiveStyle?: StyleProp<TextStyle>;
};

/**
 * Evenly spaced underline tab bar with a smooth sliding primary-color bottom indicator.
 */
export function SlidingSegmentBar<T extends string>({
  items,
  activeKey,
  onSelect,
  style,
  indicatorStyle,
  itemStyle,
  textStyle,
  textActiveStyle,
}: SlidingSegmentBarProps<T>) {
  const layoutsRef = useRef<Record<string, { x: number; width: number }>>({});
  const indicatorX = useRef(new Animated.Value(0)).current;
  const [indicatorWidth, setIndicatorWidth] = useState(0);
  const initializedRef = useRef(false);

  const moveIndicator = useCallback(
    (key: string, animated: boolean) => {
      const target = layoutsRef.current[key];
      if (!target || target.width <= 0) return;

      setIndicatorWidth(target.width);
      if (!animated || !initializedRef.current) {
        initializedRef.current = true;
        indicatorX.setValue(target.x);
        return;
      }

      indicatorX.stopAnimation();
      Animated.spring(indicatorX, {
        toValue: target.x,
        useNativeDriver: true,
        speed: 28,
        bounciness: 2,
      }).start();
    },
    [indicatorX],
  );

  useEffect(() => {
    moveIndicator(activeKey, initializedRef.current);
  }, [activeKey, items.length, moveIndicator]);

  return (
    <View style={[styles.segmentWrap, style]}>
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <Pressable
            key={item.key}
            onLayout={(e) => {
              const { x, width } = e.nativeEvent.layout;
              layoutsRef.current[item.key] = { x, width };
              if (item.key === activeKey) {
                moveIndicator(activeKey, initializedRef.current);
              }
            }}
            onPress={() => onSelect(item.key)}
            style={({ pressed }) => [styles.segmentItem, itemStyle, pressed && styles.segmentPressed]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.tabText,
                textStyle,
                active && styles.tabTextActive,
                active && textActiveStyle,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
      {indicatorWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.underlineIndicator,
            indicatorStyle,
            { width: indicatorWidth, transform: [{ translateX: indicatorX }] },
          ]}
        />
      ) : null}
    </View>
  );
}

type AnimatedFilterContentProps = {
  transitionKey: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/**
 * Smooth fade + subtle upward slide transition whenever a filter/tab key changes,
 * so filtered content glides in rather than snapping abruptly.
 */
export function AnimatedFilterContent({
  transitionKey,
  style,
  children,
}: AnimatedFilterContentProps) {
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    opacity.stopAnimation();
    translateY.stopAnimation();
    opacity.setValue(0.45);
    translateY.setValue(6);
    let anim: Animated.CompositeAnimation | null = null;
    const raf = requestAnimationFrame(() => {
      anim = Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);
      anim.start();
    });
    return () => {
      cancelAnimationFrame(raf);
      anim?.stop();
    };
  }, [opacity, transitionKey, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5EAF2',
    flexGrow: 0,
  },
  tabBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  tabItem: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    color: '#374151',
    fontSize: 13.5,
    fontWeight: '400',
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  underlineIndicator: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  rowChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipPressed: {
    opacity: 0.68,
  },
  segmentWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5EAF2',
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentPressed: {
    opacity: 0.68,
  },
});
