import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, type TextInputProps } from 'react-native';
import { colors } from '@/theme/colors';
export function Action({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.action, disabled && styles.disabled]}><Text style={styles.actionText}>{label}</Text></Pressable>;
}
export function PrivacyTextField({ style, onFocus, onBlur, ...props }: TextInputProps) {
  const [focused, setFocused] = useState(false);
  return <TextInput {...props} onFocus={event => { setFocused(true); onFocus?.(event); }} onBlur={event => { setFocused(false); onBlur?.(event); }} style={[styles.input, style, { outlineWidth: 0, outlineStyle: 'solid' }, focused && { borderColor: colors.primary }]} />;
}
export const privacyStyles = StyleSheet.create({ stack: { gap: 12 }, title: { fontSize: 16, fontWeight: '600', color: colors.ink }, body: { fontSize: 14, lineHeight: 22, color: colors.ink }, input: { minHeight: 48, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 12, color: colors.ink }, action: { minHeight: 48, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 12, justifyContent: 'center' }, actionText: { color: colors.primary, fontSize: 14 }, disabled: { opacity: 0.5 } });
const styles = privacyStyles;
