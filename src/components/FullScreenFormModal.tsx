import { type PropsWithChildren, type ReactNode, useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { colors } from '@/theme/colors';

export type FullScreenFormModalProps = PropsWithChildren<{
  visible: boolean;
  title: string;
  onClose: () => void;
  /** Optional left text label (e.g. "Hủy" in crimson for add/edit mode); defaults to "<" back icon. */
  cancelLabel?: string;
  /** Optional right save action rendered as clean blue text (e.g. "Lưu"). */
  onSave?: () => void;
  saveLabel?: string;
  saving?: boolean;
  rightAction?: ReactNode;
  footer?: ReactNode;
  /** Default true: wraps children in a full-height ScrollView. Set false if children manage their own ScrollView/FlatList. */
  scrollable?: boolean;
  /** Optional subtle gray band under header matching the detail/form reference style. Default true. */
  showHeaderBand?: boolean;
}>;

/**
 * Màn hình toàn trang (full-screen) nền trắng cho các form Thêm / Sửa / Xem chi tiết
 * thay thế cho popup dialog cũ, đồng bộ phong cách header `< / Hủy | Tiêu đề | Lưu / Edit`.
 */
export function FullScreenFormModal({
  visible,
  title,
  onClose,
  cancelLabel,
  onSave,
  saveLabel = 'Lưu',
  saving = false,
  rightAction,
  footer,
  scrollable = true,
  showHeaderBand = true,
  children,
}: FullScreenFormModalProps) {
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
      return;
    }
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  const topPad = Math.max(insets.top, Platform.OS === 'android' ? 28 : 16);
  const bottomPad = Math.max(insets.bottom, 16);

  return (
    <Modal
      visible={visible}
      statusBarTranslucent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={[
          styles.root,
          Platform.OS === 'android' && keyboardHeight > 0 ? { paddingBottom: keyboardHeight } : null,
        ]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top navigation header: < or Hủy | Centered Title | Lưu or Right Action */}
        <View style={[styles.header, { paddingTop: topPad }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={cancelLabel || 'Quay lại'}
            onPress={onClose}
            hitSlop={10}
            style={({ pressed }) => [
              cancelLabel ? styles.headerTextBtn : styles.headerSideBtn,
              pressed && styles.pressed,
            ]}
          >
            {cancelLabel ? (
              <Text style={styles.headerCancelText}>{cancelLabel}</Text>
            ) : (
              <ChevronLeft size={24} strokeWidth={1.9} color="#374151" />
            )}
          </Pressable>

          <Text numberOfLines={1} style={styles.headerTitle}>
            {title}
          </Text>

          <View style={styles.headerRightSlot}>
            {rightAction ??
              (onSave ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={saveLabel}
                  disabled={saving}
                  onPress={onSave}
                  hitSlop={10}
                  style={({ pressed }) => [
                    styles.headerTextBtn,
                    saving && { opacity: 0.45 },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.headerSaveText}>{saving ? 'Đang lưu...' : saveLabel}</Text>
                </Pressable>
              ) : null)}
          </View>
        </View>

        {showHeaderBand ? <View style={styles.headerBand} /> : null}

        {scrollable ? (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: footer ? 24 : bottomPad + 20 },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.nonScrollBody, !footer && { paddingBottom: bottomPad }]}>
            {children}
          </View>
        )}

        {footer ? (
          <View style={[styles.footer, { paddingBottom: bottomPad }]}>{footer}</View>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingBottom: 10,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8EDF4',
  },
  headerSideBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextBtn: {
    minWidth: 44,
    height: 40,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCancelText: {
    color: '#B91C1C',
    fontSize: 15,
    fontWeight: '500',
  },
  headerSaveText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '500',
  },
  pressed: {
    opacity: 0.55,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#111827',
    fontSize: 16.5,
    fontWeight: '600',
    letterSpacing: -0.2,
    paddingHorizontal: 6,
  },
  headerRightSlot: {
    minWidth: 40,
    height: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 4,
  },
  headerBand: {
    height: 8,
    backgroundColor: '#F4F6FA',
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  nonScrollBody: {
    flex: 1,
    backgroundColor: colors.white,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E8EDF4',
    backgroundColor: colors.white,
  },
});
