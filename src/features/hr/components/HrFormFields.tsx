import React, { useState, type ComponentProps, type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronDown } from 'lucide-react-native';
import { colors } from '@/theme/colors';

export type HrSelectOption = {
  value: string;
  label: string;
  subtitle?: string;
};

export function HrFormSectionTitle({ title, style }: { title: string; style?: object }) {
  return <Text style={[styles.sectionTitle, style]}>{title}</Text>;
}

export function HrFormInputRow({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  last = false,
  ...rest
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  last?: boolean;
} & Omit<ComponentProps<typeof TextInput>, 'value' | 'onChangeText' | 'placeholder' | 'multiline'>) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[styles.input, multiline && styles.inputMultiline]}
        {...rest}
      />
    </View>
  );
}

export function HrFormSelectRow({
  label,
  value,
  displayValue,
  placeholder = 'Chọn...',
  sheetTitle,
  options,
  onSelect,
  disabled = false,
  last = false,
}: {
  label: string;
  value: string;
  displayValue?: string;
  placeholder?: string;
  sheetTitle?: string;
  options: ReadonlyArray<HrSelectOption>;
  onSelect: (value: string) => void;
  disabled?: boolean;
  last?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const resolvedLabel =
    displayValue ?? options.find((opt) => opt.value === value)?.label ?? '';

  return (
    <>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[styles.row, last && styles.rowLast, disabled && styles.disabled]}
      >
        <Text style={styles.label}>{label}</Text>
        <View style={styles.selectRow}>
          <Text
            numberOfLines={1}
            style={[styles.input, { flex: 1 }, !resolvedLabel && styles.placeholder]}
          >
            {resolvedLabel || placeholder}
          </Text>
          <ChevronDown size={16} color="#9CA3AF" />
        </View>
      </Pressable>

      <Modal
        visible={open}
        transparent
        statusBarTranslucent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) + 16 }]}
            onPress={() => {}}
          >
            <View style={styles.sheetHandle} />
            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              {options.length === 0 ? (
                <Text style={styles.emptyText}>Không có lựa chọn phù hợp.</Text>
              ) : (
                options.map((opt) => {
                  const selected = opt.value === value;
                  return (
                    <Pressable
                      key={opt.value || '__empty__'}
                      onPress={() => {
                        onSelect(opt.value);
                        setOpen(false);
                      }}
                      style={[styles.sheetRow, selected && styles.sheetRowActive]}
                    >
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text
                          style={[styles.sheetRowText, selected && styles.sheetRowTextActive]}
                        >
                          {opt.label}
                        </Text>
                        {opt.subtitle ? (
                          <Text numberOfLines={1} style={styles.sheetSubText}>
                            {opt.subtitle}
                          </Text>
                        ) : null}
                      </View>
                      {selected ? <Check size={17} color={colors.primary} /> : null}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export function HrFormSwitchRow({
  label,
  subtitle,
  value,
  onValueChange,
  last = false,
}: {
  label: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, styles.switchRow, last && styles.rowLast]}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={styles.switchLabel}>{label}</Text>
        {subtitle ? <Text style={styles.label}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: colors.primary, false: '#CBD5E1' }}
      />
    </View>
  );
}

export function HrFormCustomRow({
  label,
  last = false,
  children,
}: {
  label: string;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '600',
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEF2F7',
  },
  row: {
    paddingVertical: 12,
    gap: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEF2F7',
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    color: '#6B7280',
    fontSize: 12.5,
    fontWeight: '400',
  },
  input: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '500',
    paddingHorizontal: 0,
    paddingVertical: 2,
    backgroundColor: 'transparent',
  },
  inputMultiline: {
    minHeight: 60,
    lineHeight: 21,
  },
  placeholder: {
    color: '#9CA3AF',
    fontWeight: '400',
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '500',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 99,
    backgroundColor: '#D6DFEC',
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sheetTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
  },
  sheetClose: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 12,
    marginBottom: 4,
  },
  sheetRowActive: {
    backgroundColor: '#F0F6FF',
  },
  sheetRowText: {
    color: colors.ink,
    fontSize: 14.5,
    fontWeight: '400',
  },
  sheetRowTextActive: {
    color: colors.primary,
    fontWeight: '500',
  },
  sheetSubText: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 2,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 20,
  },
});
