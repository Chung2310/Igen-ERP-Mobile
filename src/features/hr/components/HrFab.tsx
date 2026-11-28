import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus } from 'lucide-react-native';
import { colors } from '@/theme/colors';

export function HrFab({
  label,
  onPress,
  icon,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  icon?: ReactNode;
  variant?: 'primary' | 'surface';
}) {
  const insets = useSafeAreaInsets();
  const isSurface = variant === 'surface';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        isSurface && styles.fabSurface,
        { bottom: Math.max(insets.bottom, 16) + 12 },
        pressed && styles.fabPressed,
      ]}
    >
      {icon ?? <Plus size={25} strokeWidth={2.3} color={isSurface ? colors.ink : colors.white} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 22,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 6,
  },
  fabSurface: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 5,
  },
  fabPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.96 }],
  },
});
