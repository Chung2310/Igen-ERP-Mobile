import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { CalendarDays, Clock3, X } from 'lucide-react-native';
import { colors } from '@/theme/colors';

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function parseDateValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec((value || '').trim());
  if (match) {
    const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function parseTimeValue(value: string) {
  const now = new Date();
  const match = /^(\d{1,2}):(\d{2})/.exec((value || '').trim());
  if (match) {
    const hours = Math.min(23, Math.max(0, Number(match[1])));
    const minutes = Math.min(59, Math.max(0, Number(match[2])));
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
  }
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0);
}

function formatIsoDate(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function formatDisplayDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec((value || '').trim());
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function formatTime(date: Date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function DateTimeField({
  label,
  value,
  mode,
  onChange,
  disabled = false,
  allowClear = false,
  placeholder,
}: {
  label?: string;
  value: string;
  mode: 'date' | 'time';
  onChange: (next: string) => void;
  disabled?: boolean;
  allowClear?: boolean;
  placeholder?: string;
}) {
  const [iosOpen, setIosOpen] = useState(false);
  const [iosDraft, setIosDraft] = useState<Date>(() => (mode === 'date' ? parseDateValue(value) : parseTimeValue(value)));

  const displayText = value
    ? mode === 'date'
      ? formatDisplayDate(value)
      : value
    : placeholder || (mode === 'date' ? 'Chọn ngày' : 'Chọn giờ');

  const handleOpen = () => {
    if (disabled) return;
    const current = mode === 'date' ? parseDateValue(value) : parseTimeValue(value);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode,
        is24Hour: true,
        display: mode === 'date' ? 'calendar' : 'clock',
        onChange: (event: DateTimePickerEvent, selectedDate?: Date) => {
          if (event.type !== 'set' || !selectedDate) return;
          onChange(mode === 'date' ? formatIsoDate(selectedDate) : formatTime(selectedDate));
        },
      });
      return;
    }
    setIosDraft(current);
    setIosOpen((open) => !open);
  };

  return (
    <View style={styles.wrap}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <Pressable
        disabled={disabled}
        onPress={handleOpen}
        style={[styles.trigger, disabled && styles.disabled]}
      >
        {mode === 'date' ? (
          <CalendarDays size={15} color={value ? colors.primary : colors.muted} />
        ) : (
          <Clock3 size={15} color={value ? colors.primary : colors.muted} />
        )}
        <Text numberOfLines={1} style={[styles.valueText, !value && styles.placeholderText]}>
          {displayText}
        </Text>
        {allowClear && !!value && !disabled && (
          <Pressable
            hitSlop={8}
            onPress={(event) => {
              event.stopPropagation();
              onChange('');
            }}
            accessibilityLabel="Xóa giá trị"
          >
            <X size={14} color={colors.muted} />
          </Pressable>
        )}
      </Pressable>

      {Platform.OS !== 'android' && iosOpen && (
        <View style={styles.iosPickerBox}>
          <DateTimePicker
            value={iosDraft}
            mode={mode}
            display="spinner"
            is24Hour
            locale="vi-VN"
            onChange={(_, selectedDate) => {
              if (selectedDate) setIosDraft(selectedDate);
            }}
          />
          <View style={styles.iosActions}>
            <Pressable onPress={() => setIosOpen(false)} style={styles.iosCancelBtn}>
              <Text style={styles.iosCancelText}>Hủy</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                onChange(mode === 'date' ? formatIsoDate(iosDraft) : formatTime(iosDraft));
                setIosOpen(false);
              }}
              style={styles.iosDoneBtn}
            >
              <Text style={styles.iosDoneText}>Chọn</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, marginBottom: 9 },
  label: { color: colors.ink, fontSize: 9, fontWeight: '700', marginBottom: 5 },
  trigger: {
    minHeight: 41,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.white,
  },
  valueText: { flex: 1, color: colors.ink, fontSize: 10, fontWeight: '600' },
  placeholderText: { color: colors.muted, fontWeight: '500' },
  disabled: { opacity: 0.55 },
  iosPickerBox: {
    marginTop: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    overflow: 'hidden',
    paddingBottom: 8,
  },
  iosActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
  },
  iosCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#EEF1F6',
  },
  iosCancelText: { color: colors.ink, fontSize: 10, fontWeight: '700' },
  iosDoneBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  iosDoneText: { color: colors.white, fontSize: 10, fontWeight: '700' },
});

