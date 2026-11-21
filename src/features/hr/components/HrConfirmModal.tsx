import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { colors } from '@/theme/colors';

export type HrConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
};

type Listener = (options: HrConfirmOptions | null) => void;
let currentListener: Listener | null = null;

export function showHrConfirm(options: HrConfirmOptions) {
  currentListener?.(options);
}

export function HrConfirmHost() {
  const [state, setState] = useState<HrConfirmOptions | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    currentListener = setState;
    return () => {
      if (currentListener === setState) currentListener = null;
    };
  }, []);

  const close = () => {
    if (!busy) setState(null);
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

  return (
    <Modal visible={Boolean(state)} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.iconWrap}>
            <AlertTriangle size={22} color="#DC2626" />
          </View>
          <Text style={styles.title}>{state?.title}</Text>
          <Text style={styles.message}>{state?.message}</Text>

          <View style={styles.btnRow}>
            <Pressable disabled={busy} onPress={close} style={[styles.cancelBtn, busy && styles.disabled]}>
              <Text style={styles.cancelText}>{state?.cancelLabel || 'Hủy'}</Text>
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={() => void handleConfirm()}
              style={[
                styles.confirmBtn,
                state?.destructive === false && { backgroundColor: colors.primary },
                busy && styles.disabled,
              ]}
            >
              {busy ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.confirmText}>{state?.confirmLabel || 'Xóa'}</Text>
              )}
            </Pressable>
          </View>
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
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEE2E2',
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
  disabled: { opacity: 0.5 },
});

