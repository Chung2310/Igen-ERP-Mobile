import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, type AlertButton, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { PopupStatusIcon, type PopupIconVariant } from '@/components/PopupStatusIcons';
import { colors } from '@/theme/colors';

export type HrConfirmTone = 'danger' | 'success' | 'info';

export type HrConfirmAction = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void | Promise<void>;
};

export type HrConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  tone?: HrConfirmTone;
  icon?: PopupIconVariant;
  singleButton?: boolean;
  actions?: HrConfirmAction[];
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
};

export type AppAlertOptions = {
  title: string;
  message: string;
  tone?: HrConfirmTone;
  icon?: PopupIconVariant;
  buttonLabel?: string;
};

type Listener = (options: HrConfirmOptions | null) => void;
let currentListener: Listener | null = null;
let alertPatched = false;

function detectTone(title: string, message?: string, buttons?: AlertButton[]): HrConfirmTone {
  if (buttons?.some((button) => button.style === 'destructive')) return 'danger';
  const combined = `${title} ${message ?? ''}`;
  if (/lỗi|không thể|không tải|không mở|không hợp lệ|không khớp|chưa |thiếu |quá ngắn|vượt |hết hạn|từ chối|thất bại/i.test(combined)) {
    return 'danger';
  }
  if (/thành công|đã lưu|đã tạo|đã cập nhật|đã gửi|đã xuất|đã nhập|đã tải|đã ghi nhận|đã đổi|đã tính|đã duyệt|đã ký|hoàn tất|xác nhận.*ký|duyệt báo giá/i.test(combined)) {
    return 'success';
  }
  return 'info';
}

function resolvePopupIcon(state: HrConfirmOptions | null, tone: HrConfirmTone): PopupIconVariant {
  if (state?.icon) return state.icon;
  if (tone === 'success') return 'success';
  const combined = `${state?.title ?? ''} ${state?.confirmLabel ?? ''} ${state?.message ?? ''}`;
  if (tone === 'danger') {
    const isDeleteConfirm =
      !state?.singleButton &&
      (/xóa|gỡ|hủy bỏ/i.test(combined) ||
        !/lỗi|không thể|thất bại|chưa |thiếu |không hợp lệ|không khớp|quá ngắn|vượt |hết hạn|từ chối/i.test(combined));
    return isDeleteConfirm ? 'delete' : 'error';
  }
  if (!state?.singleButton && /lưu|cập nhật|duyệt|ký|gửi|xác nhận|hoàn tất|bỏ qua|chuyển/i.test(combined)) {
    return 'save';
  }
  return 'info';
}

export function showHrConfirm(options: HrConfirmOptions) {
  currentListener?.(options);
}

export function showAppAlert({ title, message, tone = 'info', icon, buttonLabel = 'Đóng' }: AppAlertOptions) {
  currentListener?.({
    title,
    message,
    tone,
    icon,
    singleButton: true,
    destructive: tone === 'danger',
    confirmLabel: buttonLabel,
    onConfirm: () => {},
  });
}

function patchGlobalAlert() {
  if (alertPatched) return;
  alertPatched = true;
  const originalAlert = Alert.alert.bind(Alert);
  Alert.alert = (title: string, message?: string, buttons?: AlertButton[], options?) => {
    if (!currentListener) {
      originalAlert(title, message, buttons, options);
      return;
    }
    const text = message ?? '';
    const tone = detectTone(title, text, buttons);
    if (!buttons || buttons.length === 0) {
      showAppAlert({ title, message: text, tone });
      return;
    }
    if (buttons.length === 1) {
      const only = buttons[0];
      showHrConfirm({
        title,
        message: text,
        tone,
        singleButton: true,
        destructive: only.style === 'destructive' || tone === 'danger',
        confirmLabel: only.text || 'Đóng',
        onConfirm: () => only.onPress?.(),
      });
      return;
    }
    if (buttons.length === 2) {
      const cancelIndex = buttons.findIndex((button) => button.style === 'cancel');
      const cancelBtn = cancelIndex >= 0 ? buttons[cancelIndex] : buttons[0];
      const confirmBtn = cancelIndex >= 0 ? buttons[1 - cancelIndex] : buttons[1];
      showHrConfirm({
        title,
        message: text,
        tone: confirmBtn.style === 'destructive' ? 'danger' : tone,
        destructive: confirmBtn.style === 'destructive',
        cancelLabel: cancelBtn.text || 'Hủy',
        confirmLabel: confirmBtn.text || 'Xác nhận',
        onCancel: () => cancelBtn.onPress?.(),
        onConfirm: () => confirmBtn.onPress?.(),
      });
      return;
    }
    showHrConfirm({
      title,
      message: text,
      tone,
      actions: buttons.map((button) => ({
        text: button.text || 'Chọn',
        style: button.style,
        onPress: button.onPress ? () => { button.onPress?.(); } : undefined,
      })),
      onConfirm: () => {},
    });
  };
}

export function HrConfirmHost() {
  const [state, setState] = useState<HrConfirmOptions | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    currentListener = setState;
    patchGlobalAlert();
    return () => {
      if (currentListener === setState) currentListener = null;
    };
  }, []);

  const close = () => {
    if (busy) return;
    const cancel = state?.onCancel;
    setState(null);
    cancel?.();
  };

  const handleConfirm = async () => {
    if (!state || busy) return;
    setBusy(true);
    try {
      await state.onConfirm();
      setState(null);
    } finally {
      setBusy(false);
    }
  };

  const handleAction = async (action: HrConfirmAction) => {
    if (busy) return;
    if (action.style === 'cancel') {
      setState(null);
      action.onPress?.();
      return;
    }
    setBusy(true);
    try {
      await action.onPress?.();
      setState(null);
    } finally {
      setBusy(false);
    }
  };

  const tone: HrConfirmTone = state?.tone ?? (state?.destructive === false ? 'info' : 'danger');
  const iconVariant = resolvePopupIcon(state, tone);
  const confirmBg = tone === 'success' ? '#16A34A' : tone === 'info' ? colors.primary : '#DC2626';

  return (
    <Modal visible={Boolean(state)} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.iconWrap}>
            <PopupStatusIcon variant={iconVariant} size={46} />
          </View>
          <Text style={styles.title}>{state?.title}</Text>
          {!!state?.message && <Text style={styles.message}>{state.message}</Text>}

          {state?.actions?.length ? (
            <View style={styles.actionStack}>
              {state.actions.map((action, index) => (
                <Pressable
                  key={`${action.text}-${index}`}
                  disabled={busy}
                  onPress={() => void handleAction(action)}
                  style={[
                    styles.actionStackBtn,
                    action.style === 'cancel'
                      ? styles.cancelBtnFull
                      : action.style === 'destructive'
                        ? styles.destructiveBtnFull
                        : styles.primaryBtnFull,
                    busy && styles.disabled,
                  ]}
                >
                  <Text
                    style={
                      action.style === 'cancel'
                        ? styles.cancelText
                        : styles.confirmText
                    }
                  >
                    {action.text}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.btnRow}>
              {!state?.singleButton ? (
                <Pressable disabled={busy} onPress={close} style={[styles.cancelBtn, busy && styles.disabled]}>
                  <Text style={styles.cancelText}>{state?.cancelLabel || 'Hủy'}</Text>
                </Pressable>
              ) : null}
              <Pressable
                disabled={busy}
                onPress={() => void handleConfirm()}
                style={[
                  styles.confirmBtn,
                  { backgroundColor: confirmBg },
                  busy && styles.disabled,
                ]}
              >
                {busy ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.confirmText}>{state?.confirmLabel || (state?.singleButton ? 'Đóng' : 'Xóa')}</Text>
                )}
              </Pressable>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.white,
    borderRadius: 24,
    overflow: 'hidden',
    padding: 20,
    alignItems: 'center',
    gap: 10,
    elevation: 10,
    shadowColor: '#0F172A',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  title: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  message: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  confirmBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  actionStack: {
    width: '100%',
    gap: 8,
    marginTop: 8,
  },
  actionStackBtn: {
    width: '100%',
    minHeight: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  primaryBtnFull: {
    backgroundColor: colors.primary,
  },
  destructiveBtnFull: {
    backgroundColor: '#DC2626',
  },
  cancelBtnFull: {
    backgroundColor: '#F1F5F9',
  },
  disabled: { opacity: 0.5 },
});

