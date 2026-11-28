import React, { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { colors } from '@/theme/colors';

export type ModuleSectionItem<T extends string = string> = {
  key: T;
  label: string;
  subtitle?: string;
  renderIcon: (size: number) => ReactNode;
};

type ModuleSectionSwitcherProps<T extends string> = {
  items: ReadonlyArray<ModuleSectionItem<T>>;
  activeKey: T;
  onChange: (nextKey: T, direction: -1 | 0 | 1) => void;
  modalTitle?: string;
  style?: StyleProp<ViewStyle>;
};

export function ModuleSectionSwitcher<T extends string>({
  items,
  activeKey,
  onChange,
  modalTitle = 'Chọn tính năng',
  style,
}: ModuleSectionSwitcherProps<T>) {
  const [open, setOpen] = useState(false);

  const currentIndex = useMemo(() => {
    const idx = items.findIndex((item) => item.key === activeKey);
    return idx >= 0 ? idx : 0;
  }, [items, activeKey]);

  const activeItem = items[currentIndex];
  const canSwitch = items.length > 1;
  const swipeX = useRef(new Animated.Value(0)).current;

  const step = (delta: -1 | 1) => {
    if (!canSwitch) return;
    const nextIndex = (currentIndex + delta + items.length) % items.length;
    const target = items[nextIndex];
    if (target) {
      swipeX.stopAnimation();
      swipeX.setValue(delta * 20);
      Animated.timing(swipeX, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start();
      onChange(target.key, delta);
    }
  };

  const stepRef = useRef(step);
  stepRef.current = step;
  const canSwitchRef = useRef(canSwitch);
  canSwitchRef.current = canSwitch;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) =>
        canSwitchRef.current &&
        Math.abs(gesture.dx) > 10 &&
        Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.25,
      onPanResponderMove: (_, gesture) => {
        swipeX.setValue(Math.max(-36, Math.min(36, gesture.dx * 0.45)));
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx <= -26 || gesture.vx <= -0.35) {
          stepRef.current(1);
        } else if (gesture.dx >= 26 || gesture.vx >= 0.35) {
          stepRef.current(-1);
        } else {
          Animated.spring(swipeX, {
            toValue: 0,
            useNativeDriver: true,
            speed: 24,
            bounciness: 6,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(swipeX, {
          toValue: 0,
          useNativeDriver: true,
          speed: 24,
          bounciness: 6,
        }).start();
      },
    }),
  ).current;

  const select = (key: T) => {
    setOpen(false);
    if (key !== activeKey) {
      onChange(key, 0);
    }
  };

  if (!activeItem) return null;

  return (
    <>
      <View {...panResponder.panHandlers} style={[styles.switcherBar, style]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tính năng trước"
          disabled={!canSwitch}
          onPress={() => step(-1)}
          style={({ pressed }) => [
            styles.navBtn,
            !canSwitch && styles.navBtnDisabled,
            pressed && styles.navBtnPressed,
          ]}
        >
          <ChevronLeft size={15} color={colors.ink} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={modalTitle}
          disabled={!canSwitch}
          onPress={() => setOpen(true)}
          style={({ pressed }) => [
            styles.center,
            pressed && canSwitch && styles.centerPressed,
          ]}
        >
          <Animated.View style={[styles.centerTrack, { transform: [{ translateX: swipeX }] }]}>
            <View style={styles.titleRow}>
              {activeItem.renderIcon(22)}
              <Text numberOfLines={1} style={styles.title}>
                {activeItem.label}
              </Text>
              {canSwitch ? <ChevronDown size={13} color={colors.muted} /> : null}
            </View>
            {activeItem.subtitle ? (
              <Text numberOfLines={1} style={styles.subtitle}>
                {activeItem.subtitle}
              </Text>
            ) : null}
          </Animated.View>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tính năng tiếp theo"
          disabled={!canSwitch}
          onPress={() => step(1)}
          style={({ pressed }) => [
            styles.navBtn,
            !canSwitch && styles.navBtnDisabled,
            pressed && styles.navBtnPressed,
          ]}
        >
          <ChevronRight size={15} color={colors.ink} />
        </Pressable>
      </View>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalList}>
              {items.map((item) => {
                const active = item.key === activeItem.key;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => select(item.key)}
                    style={[styles.modalRow, active && styles.modalRowActive]}
                  >
                    {item.renderIcon(38)}
                    <View style={styles.modalRowCopy}>
                      <Text style={styles.modalRowTitle}>{item.label}</Text>
                      {item.subtitle ? (
                        <Text numberOfLines={1} style={styles.modalRowSub}>
                          {item.subtitle}
                        </Text>
                      ) : null}
                    </View>
                    {active ? <Check size={17} color={colors.primary} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  switcherBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5EAF2',
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  navBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F8FD',
  },
  navBtnDisabled: {
    opacity: 0.35,
  },
  navBtnPressed: {
    backgroundColor: '#E8F0FC',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    overflow: 'hidden',
  },
  centerTrack: {
    width: '100%',
    alignItems: 'center',
  },
  centerPressed: {
    opacity: 0.72,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  title: {
    color: colors.ink,
    fontSize: 14.5,
    fontWeight: '700',
    flexShrink: 1,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 28,
    maxHeight: '78%',
  },
  modalHandle: {
    width: 38,
    height: 4,
    borderRadius: 99,
    backgroundColor: '#D6DFEC',
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  modalClose: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  modalList: {
    flexGrow: 0,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 11,
    borderRadius: 14,
    gap: 12,
    marginBottom: 6,
  },
  modalRowActive: {
    backgroundColor: '#F0F6FF',
  },
  modalRowCopy: {
    flex: 1,
  },
  modalRowTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  modalRowSub: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 2,
  },
});
