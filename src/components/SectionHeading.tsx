import { type ComponentRef, createContext, useContext, useRef } from 'react';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { colors } from '@/theme/colors';

export type PopoverAnchor = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type OverviewPeriodActionContextValue = {
  rangeLabel: string;
  openPeriodMenu: (anchor: PopoverAnchor) => void;
};

export const OverviewPeriodActionContext = createContext<OverviewPeriodActionContextValue | null>(
  null,
);

export function SectionHeading({
  title,
  action,
  href,
  onActionPress,
}: {
  title: string;
  action?: string;
  href?: '/(tabs)/modules';
  onActionPress?: (anchor?: PopoverAnchor) => void;
}) {
  const periodCtx = useContext(OverviewPeriodActionContext);
  const actionRef = useRef<ComponentRef<typeof View>>(null);

  const isPeriodTrigger = Boolean(!href && !onActionPress && periodCtx && action === periodCtx.rangeLabel);

  const handlePress = () => {
    const callback = onActionPress ?? (isPeriodTrigger ? periodCtx?.openPeriodMenu : undefined);
    if (!callback) return;
    const node = actionRef.current as
      | (ComponentRef<typeof View> & {
          measureInWindow?: (cb: (x: number, y: number, width: number, height: number) => void) => void;
        })
      | null;
    if (node?.measureInWindow) {
      node.measureInWindow((x, y, width, height) => {
        callback({ x, y, width, height });
      });
    } else {
      callback({ x: 0, y: 156, width: 0, height: 24 });
    }
  };

  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {action && href ? (
        <Link href={href} asChild>
          <Pressable hitSlop={8}>
            <View style={styles.actionRow}>
              <Text style={styles.action}>{action}</Text>
              <ChevronRight size={14} color={colors.primary} />
            </View>
          </Pressable>
        </Link>
      ) : action && (onActionPress || isPeriodTrigger) ? (
        <View ref={actionRef} collapsable={false}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Chọn bộ lọc ${action}`}
            hitSlop={8}
            onPress={handlePress}
            style={({ pressed }) => [styles.actionRow, pressed && styles.actionPressed]}
          >
            <Text style={styles.action}>{action}</Text>
            <ChevronDown size={13} color={colors.primary} />
          </Pressable>
        </View>
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
  title: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  actionPressed: { opacity: 0.6 },
  action: { color: colors.primary, fontSize: 11.5, fontWeight: '500' },
});
