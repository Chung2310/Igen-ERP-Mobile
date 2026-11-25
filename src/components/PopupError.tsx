import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';

type PopupErrorProps = {
  error?: string | null;
  title?: string;
  onRetry?: () => void;
};

/** Displays runtime/API errors in a native popup instead of inline in a screen. */
export function PopupError({ error, title = 'Thông báo lỗi', onRetry }: PopupErrorProps) {
  const lastShownError = useRef<string | null>(null);

  useEffect(() => {
    const message = error?.trim();
    if (!message) {
      lastShownError.current = null;
      return;
    }
    if (lastShownError.current === message) return;

    lastShownError.current = message;
    Alert.alert(
      title,
      message,
      onRetry
        ? [
            { text: 'Đóng', style: 'cancel' },
            { text: 'Thử lại', onPress: onRetry },
          ]
        : [{ text: 'Đóng', style: 'default' }],
    );
  }, [error, onRetry, title]);

  return null;
}
