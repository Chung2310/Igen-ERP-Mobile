import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react-native';
import { colors } from '@/theme/colors';

type NoticeTone = 'info' | 'success' | 'error';
type NoticeState = { title: string; message: string; tone: NoticeTone };
type NoticeListener = (notice: NoticeState | null) => void;

let currentListener: NoticeListener | null = null;

export function showHrNotice(title: string, message: string, tone: NoticeTone = 'info') {
  currentListener?.({ title, message, tone });
}

export function HrNoticeHost() {
  const [notice, setNotice] = useState<NoticeState | null>(null);

  useEffect(() => {
    currentListener = setNotice;
    return () => {
      if (currentListener === setNotice) currentListener = null;
    };
  }, []);

  const Icon = notice?.tone === 'success' ? CheckCircle2 : notice?.tone === 'error' ? AlertTriangle : Info;
  const accent = notice?.tone === 'success' ? '#16885A' : notice?.tone === 'error' ? '#DC2626' : colors.primary;
  const iconBackground = notice?.tone === 'success' ? '#E9F8F1' : notice?.tone === 'error' ? '#FEF2F2' : '#EAF2FF';

  return (
    <Modal visible={Boolean(notice)} transparent animationType="fade" onRequestClose={() => setNotice(null)}>
      <Pressable style={styles.backdrop} onPress={() => setNotice(null)}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={[styles.iconWrap, { backgroundColor: iconBackground }]}>
            <Icon size={22} color={accent} />
          </View>
          <Text style={styles.title}>{notice?.title}</Text>
          <Text style={styles.message}>{notice?.message}</Text>
          <Pressable onPress={() => setNotice(null)} style={styles.button}>
            <Text style={styles.buttonText}>Đóng</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.48)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 360, backgroundColor: colors.white, borderRadius: 24, overflow: 'hidden', padding: 22, alignItems: 'center', gap: 10 },
  iconWrap: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  title: { color: colors.ink, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  message: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  button: { width: '100%', minHeight: 44, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  buttonText: { color: colors.white, fontSize: 12, fontWeight: '700' },
});
