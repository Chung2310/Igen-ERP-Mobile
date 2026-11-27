import React, { useMemo, useState, type ReactNode } from 'react';
import {
  Modal,
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

  const step = (delta: -1 | 1) => {
    if (!canSwitch) return;
    const nextIndex = (currentIndex + delta + items.length) % items.length;
    const target = items[nextIndex];
    if (target) onChange(target.key, delta);
  };

  const select = (key: T) => {
    setOpen(false);
    if (key !== activeKey) {
      onChange(key, 0);
    }
  };

  if (!activeItem) return null;

  return (
    <>
      <View style={[styles.switcherBar, style]}>
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
          <ChevronLeft size={18} color={colors.ink} />
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
          <View style={styles.titleRow}>
            {activeItem.renderIcon(24)}
            <Text numberOfLines={1} style={styles.title}>
              {activeItem.label}
            </Text>
            {canSwitch ? <ChevronDown size={15} color={colors.muted} /> : null}
          </View>
          {activeItem.subtitle ? (
            <Text numberOfLines={1} style={styles.subtitle}>
              {activeItem.subtitle}
            </Text>
          ) : null}
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
          <ChevronRight size={18} color={colors.ink} />
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
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{modalTitle}</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <Text style={styles.modalClose}>Đóng</Text>
              </Pressable>
            </View>
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
    paddingVertical: 8,
  },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
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
