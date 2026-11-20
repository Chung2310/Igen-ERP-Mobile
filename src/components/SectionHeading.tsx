import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';

export function SectionHeading({ title, action, href }: { title: string; action?: string; href?: '/(tabs)/modules' }) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {action && href ? <Link href={href} style={styles.action}>{action} ›</Link> : action ? <Text style={styles.action}>{action} ›</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }, title: { color: colors.ink, fontSize: 15, fontWeight: '800' }, action: { color: colors.primary, fontSize: 10, fontWeight: '700' } });
