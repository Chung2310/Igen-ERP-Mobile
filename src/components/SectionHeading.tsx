import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { colors } from '@/theme/colors';

export function SectionHeading({ title, action, href }: { title: string; action?: string; href?: '/(tabs)/modules' }) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {action && href ? (
        <Link href={href} asChild>
          <Pressable>
            <View style={styles.actionRow}>
              <Text style={styles.action}>{action}</Text>
              <ChevronRight size={14} color={colors.primary} />
            </View>
          </Pressable>
        </Link>
      ) : action ? (
        <View style={styles.actionRow}>
          <Text style={styles.action}>{action}</Text>
          <ChevronRight size={14} color={colors.primary} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  action: { color: colors.primary, fontSize: 10, fontWeight: '700' },
});
