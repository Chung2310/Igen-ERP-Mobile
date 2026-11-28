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
};

/**
 * Horizontal chip/filter bar that smoothly scrolls the selected item into
 * the horizontal center of the viewport whenever the selection changes.
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
}: CenteringChipBarProps<T>) {
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const containerWidthRef = useRef(0);
  const contentWidthRef = useRef(0);
  const itemLayoutsRef = useRef<Record<string, { x: number; width: number }>>({});
  const hasScrolledOnceRef = useRef(false);

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
    const frame = requestAnimationFrame(() => centerItem(activeKey, animated));
    return () => cancelAnimationFrame(frame);
  }, [activeKey, centerItem]);

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
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      onLayout={handleContainerLayout}
      onContentSizeChange={handleContentSizeChange}
      style={style}
      contentContainerStyle={contentContainerStyle}
    >
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <Pressable
            key={item.key}
            onLayout={(e) => {
              const { x, width } = e.nativeEvent.layout;
              itemLayoutsRef.current[item.key] = { x, width };
              if (item.key === activeKey && containerWidthRef.current > 0) {
                centerItem(activeKey, hasScrolledOnceRef.current);
              }
            }}
            onPress={() => {
              onSelect(item.key);
              centerItem(item.key, true);
            }}
            style={({ pressed }) => [
              chipStyle,
              item.renderPrefix ? styles.rowChip : null,
              active && chipActiveStyle,
              pressed && styles.chipPressed,
            ]}
          >
            {item.renderPrefix ? item.renderPrefix(active) : null}
            <Text style={[textStyle, active && textActiveStyle]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
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
 * Segmented filter bar with a smooth sliding indicator pill behind the active tab.
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
  const layoutsRef = useRef<Record<string, { x: number; width: number; height: number }>>({});
  const indicatorX = useRef(new Animated.Value(0)).current;
  const indicatorW = useRef(new Animated.Value(0)).current;
  const [indicatorReady, setIndicatorReady] = useState(false);
  const initializedRef = useRef(false);

  const moveIndicator = useCallback(
    (key: string, animated: boolean) => {
      const target = layoutsRef.current[key];
      if (!target || target.width <= 0) return;

      if (!animated || !initializedRef.current) {
        initializedRef.current = true;
        indicatorX.setValue(target.x);
        indicatorW.setValue(target.width);
        setIndicatorReady(true);
        return;
      }

      Animated.parallel([
        Animated.timing(indicatorX, {
          toValue: target.x,
          duration: 210,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(indicatorW, {
          toValue: target.width,
          duration: 210,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ]).start();
    },
    [indicatorW, indicatorX],
  );

  useEffect(() => {
    moveIndicator(activeKey, initializedRef.current);
  }, [activeKey, items.length, moveIndicator]);

  return (
    <View style={[styles.segmentWrap, style]}>
      {indicatorReady ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.segmentIndicator,
            indicatorStyle,
            { left: indicatorX, width: indicatorW },
          ]}
        />
      ) : null}
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <Pressable
            key={item.key}
            onLayout={(e) => {
              const { x, width, height } = e.nativeEvent.layout;
              layoutsRef.current[item.key] = { x, width, height };
              if (item.key === activeKey) {
                moveIndicator(activeKey, initializedRef.current);
              }
            }}
            onPress={() => onSelect(item.key)}
            style={({ pressed }) => [itemStyle, pressed && styles.segmentPressed]}
          >
            <Text numberOfLines={1} style={[textStyle, active && textActiveStyle]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rowChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  chipPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.96 }],
  },
  segmentWrap: {
    position: 'relative',
  },
  segmentIndicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
  },
  segmentPressed: {
    opacity: 0.75,
  },
});

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
    opacity.setValue(0.15);
    translateY.setValue(8);
    const anim = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 210,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 210,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [opacity, transitionKey, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}
