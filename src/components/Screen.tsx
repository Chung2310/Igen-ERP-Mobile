import { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';

export function Screen({ children, edges = ['top', 'left', 'right'] }: PropsWithChildren<{ edges?: Edge[] }>) {
  return <SafeAreaView edges={edges} style={styles.safe}><View style={styles.content}>{children}</View></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.background }, content: { flex: 1 } });
