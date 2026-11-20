import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Card } from '@/components/Card';
import { colors } from '@/theme/colors';

type KnowledgeDocument = {
  id: string;
  name: string;
  fileName: string;
  category: string;
  mimeType: string;
  size: number | null;
  updatedAt: string;
  uri?: string;
};

const initialDocuments: KnowledgeDocument[] = [
  { id: 'doc-001', name: 'Chính sách bán hàng', fileName: 'Chinh-sach-ban-hang.pdf', category: 'Bán hàng', mimeType: 'application/pdf', size: 482_000, updatedAt: 'Hôm nay' },
  { id: 'doc-002', name: 'Bảng giá sản phẩm 2026', fileName: 'Bang-gia-san-pham-2026.xlsx', category: 'Sản phẩm', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 1_240_000, updatedAt: 'Hôm qua' },
  { id: 'doc-003', name: 'Quy trình tiếp nhận khách hàng', fileName: 'Quy-trinh-tiep-nhan.docx', category: 'Quy trình', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 326_000, updatedAt: '18/11/2026' },
];

const categories = ['Tất cả', 'Bán hàng', 'Sản phẩm', 'Quy trình', 'Khác'];

export function KnowledgeScreen() {
  const [documents, setDocuments] = useState(initialDocuments);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Tất cả');
  const [selected, setSelected] = useState<KnowledgeDocument | null>(null);
  const [editing, setEditing] = useState<KnowledgeDocument | null>(null);

  const visibleDocuments = useMemo(() => documents.filter((document) => {
    const matchesSearch = `${document.name} ${document.fileName} ${document.category}`.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'));
    return matchesSearch && (category === 'Tất cả' || document.category === category);
  }), [documents, query, category]);

  async function addDocuments() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain'],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const created: KnowledgeDocument[] = result.assets.map((asset, index) => ({
        id: `doc-${Date.now()}-${index}`,
        name: asset.name.replace(/\.[^.]+$/, ''),
        fileName: asset.name,
        category: 'Khác',
        mimeType: asset.mimeType ?? 'application/octet-stream',
        size: asset.size ?? null,
        updatedAt: 'Vừa thêm',
        uri: asset.uri,
      }));
      setDocuments((items) => [...created, ...items]);
    } catch {
      Alert.alert('Không mở được tài liệu', 'Vui lòng kiểm tra quyền truy cập tệp trên thiết bị.');
    }
  }

  function saveDocument() {
    if (!editing?.name.trim()) {
      Alert.alert('Thiếu tên tài liệu', 'Hãy nhập tên để lưu tài liệu.');
      return;
    }
    const updated = { ...editing, updatedAt: 'Vừa cập nhật' };
    setDocuments((items) => items.map((item) => item.id === editing.id ? updated : item));
    setSelected(updated);
    setEditing(null);
  }

  function deleteDocument(document: KnowledgeDocument) {
    Alert.alert('Xóa tài liệu?', `“${document.name}” sẽ bị gỡ khỏi danh sách trên thiết bị này.`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: () => { setDocuments((items) => items.filter((item) => item.id !== document.id)); setSelected(null); } },
    ]);
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>DỮ LIỆU AI</Text>
        <Text style={styles.title}>Kho tri thức</Text>
        <Text style={styles.subtitle}>Tài liệu dùng làm nguồn tra cứu và trả lời cho trợ lý AI.</Text>

        <View style={styles.summaryRow}>
          <Card style={styles.summaryCard}><Text style={styles.summaryValue}>{documents.length}</Text><Text style={styles.summaryLabel}>Tài liệu</Text></Card>
          <Card style={styles.summaryCard}><Text style={styles.summaryValue}>{new Set(documents.map((item) => item.category)).size}</Text><Text style={styles.summaryLabel}>Danh mục</Text></Card>
          <Card style={styles.summaryCard}><Text style={styles.summaryValue}>{documents.filter((item) => item.uri).length}</Text><Text style={styles.summaryLabel}>Mới thêm</Text></Card>
        </View>

        <Pressable onPress={() => { void addDocuments(); }} style={styles.uploadButton}>
          <Text style={styles.uploadGlyph}>＋</Text>
          <View style={styles.uploadCopy}><Text style={styles.uploadTitle}>Thêm tài liệu</Text><Text style={styles.uploadHint}>PDF, Word, Excel hoặc TXT</Text></View>
          <Text style={styles.uploadArrow}>›</Text>
        </Pressable>

        <TextInput value={query} onChangeText={setQuery} placeholder="Tìm tên hoặc nội dung tài liệu..." placeholderTextColor={colors.muted} style={styles.search} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {categories.map((item) => <Pressable key={item} onPress={() => setCategory(item)} style={[styles.filter, category === item && styles.filterActive]}><Text style={[styles.filterText, category === item && styles.filterTextActive]}>{item}</Text></Pressable>)}
        </ScrollView>

        <View style={styles.listHeading}><Text style={styles.listTitle}>Tài liệu</Text><Text style={styles.listCount}>{visibleDocuments.length} mục</Text></View>
        <View style={styles.documentList}>
          {visibleDocuments.map((document) => <DocumentRow key={document.id} document={document} onPress={() => setSelected(document)} />)}
          {visibleDocuments.length === 0 && <Text style={styles.empty}>Không tìm thấy tài liệu phù hợp.</Text>}
        </View>
        <Text style={styles.note}>Danh sách hiện là dữ liệu xem trước trên thiết bị. Đồng bộ tệp và chỉ mục AI cần API ERP.</Text>
      </ScrollView>

      <Modal visible={Boolean(selected)} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        {selected && <View style={styles.modalBackdrop}><View style={styles.detailSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}><Text style={styles.sheetTitle}>Chi tiết tài liệu</Text><Pressable onPress={() => setSelected(null)}><Text style={styles.close}>×</Text></Pressable></View>
          <View style={styles.fileHero}><Text style={styles.fileGlyph}>{fileType(selected.mimeType)}</Text><View style={styles.fileHeroCopy}><Text style={styles.documentName}>{selected.name}</Text><Text style={styles.fileName}>{selected.fileName}</Text></View></View>
          <InfoLine label="Danh mục" value={selected.category} />
          <InfoLine label="Kích thước" value={formatSize(selected.size)} />
          <InfoLine label="Cập nhật" value={selected.updatedAt} />
          <InfoLine label="Trạng thái" value={selected.uri ? 'Chưa đồng bộ ERP' : 'Tài liệu mẫu'} />
          <View style={styles.sheetActions}>
            <Pressable style={styles.secondaryButton} onPress={() => setEditing(selected)}><Text style={styles.secondaryButtonText}>Chỉnh sửa</Text></Pressable>
            <Pressable style={styles.deleteButton} onPress={() => deleteDocument(selected)}><Text style={styles.deleteButtonText}>Xóa tài liệu</Text></Pressable>
          </View>
        </View></View>}
      </Modal>

      <Modal visible={Boolean(editing)} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        {editing && <View style={styles.modalBackdrop}><View style={styles.editSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}><Text style={styles.sheetTitle}>Chỉnh sửa tài liệu</Text><Pressable onPress={() => setEditing(null)}><Text style={styles.close}>×</Text></Pressable></View>
          <Text style={styles.fieldLabel}>Tên hiển thị</Text>
          <TextInput value={editing.name} onChangeText={(value) => setEditing({ ...editing, name: value })} style={styles.fieldInput} />
          <Text style={styles.fieldLabel}>Danh mục</Text>
          <View style={styles.categoryOptions}>{categories.filter((item) => item !== 'Tất cả').map((item) => <Pressable key={item} onPress={() => setEditing({ ...editing, category: item })} style={[styles.categoryOption, editing.category === item && styles.categoryOptionActive]}><Text style={[styles.categoryOptionText, editing.category === item && styles.categoryOptionTextActive]}>{item}</Text></Pressable>)}</View>
          <Pressable onPress={saveDocument} style={styles.saveButton}><Text style={styles.saveButtonText}>Lưu thay đổi</Text></Pressable>
        </View></View>}
      </Modal>
    </View>
  );
}

function DocumentRow({ document, onPress }: { document: KnowledgeDocument; onPress: () => void }) {
  return <Card onPress={onPress} style={styles.documentRow}>
    <View style={styles.documentIcon}><Text style={styles.fileGlyphSmall}>{fileType(document.mimeType)}</Text></View>
    <View style={styles.documentCopy}><Text numberOfLines={1} style={styles.rowName}>{document.name}</Text><Text style={styles.rowMeta}>{document.category} · {formatSize(document.size)} · {document.updatedAt}</Text></View>
    <Text style={styles.rowArrow}>›</Text>
  </Card>;
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return <View style={styles.infoLine}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>;
}

function fileType(mimeType: string) {
  if (mimeType.includes('pdf')) return 'PDF';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'XLS';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'DOC';
  return 'TXT';
}

function formatSize(size: number | null) {
  if (size === null) return 'Chưa rõ dung lượng';
  return size >= 1_000_000 ? `${(size / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(size / 1_000))} KB`;
}

const styles = StyleSheet.create({
  container: { flex: 1 }, content: { padding: 18, paddingTop: 14, paddingBottom: 28 },
  eyebrow: { color: colors.primary, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 }, title: { color: colors.ink, fontSize: 24, fontWeight: '800', marginTop: 4 }, subtitle: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 5 },
  summaryRow: { flexDirection: 'row', gap: 8, marginTop: 17 }, summaryCard: { flex: 1, padding: 11, alignItems: 'center', borderRadius: 14 }, summaryValue: { color: colors.ink, fontSize: 17, fontWeight: '800' }, summaryLabel: { color: colors.muted, fontSize: 8, marginTop: 4 },
  uploadButton: { flexDirection: 'row', alignItems: 'center', marginTop: 14, padding: 12, borderRadius: 15, backgroundColor: '#EEF4FF', borderWidth: 1, borderColor: '#DDE9FF' }, uploadGlyph: { color: colors.white, backgroundColor: colors.primary, width: 31, height: 31, borderRadius: 11, textAlign: 'center', textAlignVertical: 'center', fontSize: 21, overflow: 'hidden' }, uploadCopy: { flex: 1, marginLeft: 10 }, uploadTitle: { color: colors.ink, fontSize: 10, fontWeight: '800' }, uploadHint: { color: colors.muted, fontSize: 8, marginTop: 3 }, uploadArrow: { color: colors.primary, fontSize: 23 },
  search: { height: 42, paddingHorizontal: 13, marginTop: 14, borderRadius: 13, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, color: colors.ink, fontSize: 10 }, filters: { gap: 7, paddingVertical: 11 }, filter: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 9, backgroundColor: colors.white }, filterActive: { backgroundColor: '#EAF2FF' }, filterText: { color: colors.muted, fontSize: 8, fontWeight: '700' }, filterTextActive: { color: colors.primary },
  listHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5, marginBottom: 9 }, listTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' }, listCount: { color: colors.muted, fontSize: 8 }, documentList: { gap: 8 }, documentRow: { flexDirection: 'row', alignItems: 'center', padding: 11, borderRadius: 15 }, documentIcon: { width: 38, height: 40, borderRadius: 12, backgroundColor: '#F1EBFF', alignItems: 'center', justifyContent: 'center' }, fileGlyphSmall: { color: '#7852C7', fontSize: 9, fontWeight: '900' }, documentCopy: { flex: 1, marginHorizontal: 10 }, rowName: { color: colors.ink, fontSize: 10, fontWeight: '800' }, rowMeta: { color: colors.muted, fontSize: 8, marginTop: 5 }, rowArrow: { color: colors.muted, fontSize: 20 }, empty: { color: colors.muted, textAlign: 'center', fontSize: 10, padding: 28 }, note: { color: colors.muted, textAlign: 'center', fontSize: 8, lineHeight: 13, marginTop: 16 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#10182866' }, detailSheet: { backgroundColor: colors.background, borderTopLeftRadius: 23, borderTopRightRadius: 23, paddingHorizontal: 20, paddingTop: 9, paddingBottom: 25 }, editSheet: { backgroundColor: colors.background, borderTopLeftRadius: 23, borderTopRightRadius: 23, paddingHorizontal: 20, paddingTop: 9, paddingBottom: 25 }, sheetHandle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 3, backgroundColor: '#CDD4E0', marginBottom: 14 }, sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 17 }, sheetTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' }, close: { color: colors.muted, fontSize: 25, lineHeight: 25 },
  fileHero: { flexDirection: 'row', alignItems: 'center', padding: 13, backgroundColor: colors.white, borderRadius: 15, marginBottom: 12 }, fileGlyph: { color: '#7852C7', backgroundColor: '#F1EBFF', width: 43, height: 43, borderRadius: 13, textAlign: 'center', textAlignVertical: 'center', fontSize: 10, fontWeight: '900', overflow: 'hidden' }, fileHeroCopy: { flex: 1, marginLeft: 11 }, documentName: { color: colors.ink, fontSize: 11, fontWeight: '800' }, fileName: { color: colors.muted, fontSize: 8, marginTop: 4 }, infoLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.border }, infoLabel: { color: colors.muted, fontSize: 9 }, infoValue: { color: colors.ink, fontSize: 9, fontWeight: '700' },
  sheetActions: { flexDirection: 'row', gap: 9, marginTop: 18 }, secondaryButton: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF2FF', borderRadius: 12 }, secondaryButtonText: { color: colors.primary, fontSize: 10, fontWeight: '800' }, deleteButton: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FCEBEC', borderRadius: 12 }, deleteButtonText: { color: '#B4232E', fontSize: 10, fontWeight: '800' },
  fieldLabel: { color: colors.ink, fontSize: 9, fontWeight: '700', marginBottom: 6 }, fieldInput: { height: 43, paddingHorizontal: 12, backgroundColor: colors.white, borderRadius: 12, borderColor: colors.border, borderWidth: 1, color: colors.ink, fontSize: 10, marginBottom: 15 }, categoryOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 19 }, categoryOption: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9, backgroundColor: colors.white }, categoryOptionActive: { backgroundColor: '#EAF2FF' }, categoryOptionText: { color: colors.muted, fontSize: 8, fontWeight: '700' }, categoryOptionTextActive: { color: colors.primary }, saveButton: { minHeight: 43, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: 12 }, saveButtonText: { color: colors.white, fontSize: 10, fontWeight: '800' },
});
