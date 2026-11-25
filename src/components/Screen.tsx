import { PropsWithChildren } from 'react';
import { Platform, StatusBar, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';

export function Screen({
  children,
  edges = ['top', 'left', 'right'],
  backgroundColor = colors.background,
}: PropsWithChildren<{ edges?: Edge[]; backgroundColor?: string }>) {
  const insets = useSafeAreaInsets();
  const androidStatusBarHeight = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0;

  const paddingTop = edges.includes('top')
    ? Math.max(insets.top, androidStatusBarHeight) + 4
    : 0;
  const paddingBottom = edges.includes('bottom') ? insets.bottom : 0;
  const paddingLeft = edges.includes('left') ? insets.left : 0;
  const paddingRight = edges.includes('right') ? insets.right : 0;

  return (
    <View
      style={[
        styles.safe,
        {
          backgroundColor,
          paddingTop,
          paddingBottom,
          paddingLeft,
          paddingRight,
        },
      ]}
    >
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1 },
});
