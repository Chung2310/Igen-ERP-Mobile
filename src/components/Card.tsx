import { PropsWithChildren } from 'react';
import { Pressable, PressableProps, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '@/theme/colors';

type CardProps = Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle> };

export function Card({ children, style, ...pressableProps }: PropsWithChildren<CardProps>) {
  return (
    <Pressable
      {...pressableProps}
      style={({ pressed }) => [styles.card, style, pressed && pressableProps.onPress ? styles.pressed : null]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, borderRadius: 18, shadowColor: '#132442', shadowOpacity: 0.035, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  pressed: { opacity: 0.82 },
});
