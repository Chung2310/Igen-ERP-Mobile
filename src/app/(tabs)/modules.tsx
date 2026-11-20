import { useMemo, useState } from 'react';
import { Link } from 'expo-router';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { moduleCatalog } from '@/features/modules/moduleCatalog';
import { colors } from '@/theme/colors';

export default function ModulesScreen() {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('vi');
    return moduleCatalog.filter((item) => `${item.name} ${item.category} ${item.shortDescription}`.toLocaleLowerCase('vi').includes(normalized));
  }, [query]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>KHÔNG GIAN LÀM VIỆC</Text>
        <Text style={styles.title}>Phân hệ</Text>
        <Text style={styles.subtitle}>Các chức năng theo gói dịch vụ và quyền được cấp.</Text>
        <TextInput value={query} onChangeText={setQuery} placeholder="Tìm phân hệ..." placeholderTextColor={colors.muted} style={styles.search} />
        <View style={styles.list}>
          {filtered.map((module) => (
            <Link key={module.slug} href={{ pathname: '/modules/[slug]', params: { slug: module.slug } }} asChild>
              <Card style={styles.item}>
                <View style={[styles.icon, { backgroundColor: module.color }]}><Text style={styles.iconText}>{module.icon}</Text></View>
                <View style={styles.copy}>
                  <View style={styles.titleLine}><Text style={styles.name}>{module.name}</Text><View style={styles.phasePill}><Text style={styles.phaseText}>ĐỢT 1</Text></View></View>
                  <Text numberOfLines={2} style={styles.description}>{module.shortDescription}</Text>
                </View>
                <Text style={styles.arrow}>›</Text>
              </Card>
            </Link>
          ))}
          {filtered.length === 0 && <Text style={styles.empty}>Không tìm thấy phân hệ phù hợp.</Text>}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: 18, paddingBottom: 28 },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 27, fontWeight: '800', marginTop: 5 },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 6 },
  search: { height: 46, backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, marginTop: 20, marginBottom: 15, fontSize: 13, color: colors.ink },
  list: { gap: 10 },
  item: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 18 },
  copy: { flex: 1, marginLeft: 12 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  name: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  phasePill: { backgroundColor: '#EAF2FF', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5 },
  phaseText: { color: colors.primary, fontSize: 8, fontWeight: '800' },
  description: { color: colors.muted, fontSize: 10, marginTop: 5, lineHeight: 15 },
  arrow: { fontSize: 25, color: colors.muted, marginLeft: 5 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 35, fontSize: 13 },
});
