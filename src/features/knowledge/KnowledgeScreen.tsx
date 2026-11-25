import { withAppLockSuspended } from '@/core/auth/appLockSuspension';
import { PopupError } from '@/components/PopupError';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { ChevronRight, File, FileImage, FileSpreadsheet, FileText, Plus, Upload, X } from 'lucide-react-native';
import { Card } from '@/components/Card';
import { showHrConfirm } from '@/features/hr/components/HrConfirmModal';
import { deleteKnowledgeDocument, listKnowledgeDocuments, updateKnowledgeDocumentType, uploadKnowledgeDocument, type ErpKnowledgeDocument, type KnowledgeDocumentType } from '@/features/knowledge/knowledgeApi';
import { colors } from '@/theme/colors';

type KnowledgeDocument = ErpKnowledgeDocument & { name: string; fileName: string; category: string; mimeType: string };

const categories: { label: string; value: KnowledgeDocumentType | 'all' }[] = [
  { label: 'Tất cả', value: 'all' },
  { label: 'Doanh nghiệp', value: 'company_profile' },
  { label: 'Sản phẩm', value: 'product' },
  { label: 'Bảng giá', value: 'pricing' },
  { label: 'Chính sách', value: 'policy' },
  { label: 'FAQ', value: 'faq' },
  { label: 'Kịch bản', value: 'scenario' },
  { label: 'Tài liệu', value: 'general' },
];

function categoryLabel(type: KnowledgeDocumentType) {
  return categories.find((item) => item.value === type)?.label ?? 'Tài liệu';
}

function toKnowledgeDocument(document: ErpKnowledgeDocument): KnowledgeDocument {
  return {
    ...document,
    name: document.title,
    fileName: document.title,
    category: categoryLabel(document.documentType),
    mimeType: mimeFromName(document.title),
  };
}

function mimeFromName(name: string) {
  const extension = name.toLocaleLowerCase('vi').split('.').pop();
  if (extension === 'pdf') return 'application/pdf';
  if (extension === 'xlsx' || extension === 'xls') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (extension === 'docx' || extension === 'doc') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return 'text/plain';
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function statusLabel(status: string) {
  if (status === 'active') return 'Đã đồng bộ';
  if (status === 'syncing') return 'Đang xử lý';
  if (status === 'failed') return 'Lỗi xử lý';
  return status;
}

export function KnowledgeScreen() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<KnowledgeDocumentType | 'all'>('all');
  const [selected, setSelected] = useState<KnowledgeDocument | null>(null);
  const [editing, setEditing] = useState<KnowledgeDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function refreshDocuments(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      const rows = await listKnowledgeDocuments();
      setDocuments(rows.map(toKnowledgeDocument));
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được tài liệu từ ERP.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refreshDocuments(); }, []);

  const visibleDocuments = useMemo(() => documents.filter((document) => {
    const matchesSearch = `${document.name} ${document.fileName} ${document.category}`.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'));
    return matchesSearch && (category === 'all' || document.documentType === category);
  }), [documents, query, category]);
  const SelectedIcon = selected ? fileIcon(selected.mimeType) : null;

  function confirmAddDocuments() {
    Alert.alert('Nạp tài liệu vào Kho tri thức?', 'ERP sẽ trích xuất nội dung và lập chỉ mục AI. Thao tác này có thể sử dụng lượt AI của doanh nghiệp.', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Tiếp tục', onPress: () => { void addDocuments(); } },
    ]);
  }

  async function addDocuments() {
    try {
      const result = await withAppLockSuspended(() => DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain'],
        multiple: true,
        copyToCacheDirectory: true,
      }));
      if (result.canceled) return;

      setSaving(true);
      let uploaded = 0;
      for (const asset of result.assets) {
        await uploadKnowledgeDocument(asset);
        uploaded++;
      }
      await refreshDocuments(false);
      Alert.alert('Đã nạp tài liệu', `${uploaded} tài liệu đã được gửi đến ERP để xử lý.`);
    } catch (cause) {
      Alert.alert('Chưa nạp được tài liệu', cause instanceof Error ? cause.message : 'ERP không xử lý được tệp đã chọn.');
    } finally {
      setSaving(false);
    }
  }

  async function saveDocument() {
    if (!editing) return;
    setSaving(true);
    try {
      await updateKnowledgeDocumentType(editing, editing.documentType);
      const updated = { ...editing, category: categoryLabel(editing.documentType), updatedAt: new Date().toISOString() };
      setDocuments((items) => items.map((item) => item.id === editing.id ? updated : item));
      setSelected(updated);
      setEditing(null);
    } catch (cause) {
      Alert.alert('Chưa cập nhật được tài liệu', cause instanceof Error ? cause.message : 'ERP không lưu được thay đổi.');
    } finally {
      setSaving(false);
    }
  }

  function deleteDocument(document: KnowledgeDocument) {
    setSelected(null);
    showHrConfirm({
      title: 'Xóa tài liệu?',
      message: `“${document.name}” sẽ bị xóa khỏi Kho tri thức ERP.`,
      confirmLabel: 'Xóa',
      onConfirm: async () => {
        try {
          await deleteKnowledgeDocument(document.id);
          setDocuments((items) => items.filter((item) => item.id !== document.id));
        } catch (cause: unknown) {
          Alert.alert('Chưa xóa được tài liệu', cause instanceof Error ? cause.message : 'ERP không xóa được tài liệu.');
        }
      },
    });
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>DỮ LIỆU AI</Text>
        <Text style={styles.title}>Kho tri thức</Text>
        <Text style={styles.subtitle}>Tài liệu doanh nghiệp được quản lý trực tiếp trong ERP.</Text>
        {!!error && <PopupError error={error} />}

        <View style={styles.summaryRow}>
          <Card style={styles.summaryCard}><Text style={styles.summaryValue}>{documents.length}</Text><Text style={styles.summaryLabel}>Tài liệu</Text></Card>
          <Card style={styles.summaryCard}><Text style={styles.summaryValue}>{new Set(documents.map((item) => item.category)).size}</Text><Text style={styles.summaryLabel}>Danh mục</Text></Card>
          <Card style={styles.summaryCard}><Text style={styles.summaryValue}>{documents.filter((item) => item.sourceType === 'manual').length}</Text><Text style={styles.summaryLabel}>Tệp đã nạp</Text></Card>
        </View>

        <Pressable disabled={saving} onPress={confirmAddDocuments} style={[styles.uploadButton, saving && styles.uploadDisabled]}>
          <View style={styles.uploadIcon}>{saving ? <ActivityIndicator color={colors.white} /> : <Upload size={17} color={colors.white} />}</View>
          <View style={styles.uploadCopy}><Text style={styles.uploadTitle}>Thêm tài liệu</Text><Text style={styles.uploadHint}>PDF, Word, Excel hoặc TXT</Text></View>
          <ChevronRight size={18} color={colors.primary} />
        </Pressable>

        <TextInput value={query} onChangeText={setQuery} placeholder="Tìm tên tài liệu..." placeholderTextColor={colors.muted} style={styles.search} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {categories.map((item) => <Pressable key={item.value} onPress={() => setCategory(item.value)} style={[styles.filter, category === item.value && styles.filterActive]}><Text style={[styles.filterText, category === item.value && styles.filterTextActive]}>{item.label}</Text></Pressable>)}
        </ScrollView>

        <View style={styles.listHeading}><Text style={styles.listTitle}>Tài liệu</Text><Text style={styles.listCount}>{visibleDocuments.length} mục</Text></View>
        <View style={styles.documentList}>
          {visibleDocuments.map((document) => <DocumentRow key={document.id} document={document} onPress={() => setSelected(document)} />)}
          {loading && <ActivityIndicator color={colors.primary} style={styles.loading} />}
          {!loading && visibleDocuments.length === 0 && <Text style={styles.empty}>{query || category !== 'all' ? 'Không tìm thấy tài liệu phù hợp.' : 'Chưa có tài liệu trong Kho tri thức ERP.'}</Text>}
        </View>
        <Text style={styles.note}>Tệp được xử lý trên ERP; thêm, phân loại và xóa yêu cầu quyền quản lý Kho tri thức.</Text>
      </ScrollView>

      <Modal visible={Boolean(selected)} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        {selected && <View style={styles.modalBackdrop}><View style={styles.detailSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}><Text style={styles.sheetTitle}>Chi tiết tài liệu</Text><Pressable style={styles.closeButton} onPress={() => setSelected(null)}><X size={19} color={colors.muted} /></Pressable></View>
          <View style={styles.fileHero}><View style={styles.fileIcon}>{SelectedIcon && <SelectedIcon size={21} color="#7852C7" />}</View><View style={styles.fileHeroCopy}><Text style={styles.documentName}>{selected.name}</Text><Text style={styles.fileName}>{selected.fileName}</Text></View></View>
          <InfoLine label="Danh mục" value={selected.category} />
          <InfoLine label="Phạm vi kênh" value={selected.channelScope.join(', ')} />
          <InfoLine label="Mục đích AI" value={selected.purposeScope.join(', ')} />
          <InfoLine label="Số đoạn tri thức" value={String(selected.chunksCount)} />
          <InfoLine label="Cập nhật" value={formatDate(selected.updatedAt)} />
          <InfoLine label="Trạng thái" value={statusLabel(selected.status)} />
          <View style={styles.sheetActions}>
            <Pressable style={styles.secondaryButton} onPress={() => setEditing(selected)}><Text style={styles.secondaryButtonText}>Chỉnh sửa</Text></Pressable>
            <Pressable style={styles.deleteButton} onPress={() => deleteDocument(selected)}><Text style={styles.deleteButtonText}>Xóa tài liệu</Text></Pressable>
          </View>
        </View></View>}
      </Modal>

      <Modal visible={Boolean(editing)} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        {editing && <View style={styles.modalBackdrop}><View style={styles.editSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}><Text style={styles.sheetTitle}>Chỉnh sửa tài liệu</Text><Pressable style={styles.closeButton} onPress={() => setEditing(null)}><X size={19} color={colors.muted} /></Pressable></View>
          <Text style={styles.fieldLabel}>Tài liệu</Text>
          <Text style={styles.editDocumentName}>{editing.name}</Text>
          <Text style={styles.fieldLabel}>Phân loại tri thức</Text>
          <View style={styles.categoryOptions}>{categories.filter((item) => item.value !== 'all').map((item) => <Pressable key={item.value} onPress={() => setEditing({ ...editing, documentType: item.value as KnowledgeDocumentType, category: item.label })} style={[styles.categoryOption, editing.documentType === item.value && styles.categoryOptionActive]}><Text style={[styles.categoryOptionText, editing.documentType === item.value && styles.categoryOptionTextActive]}>{item.label}</Text></Pressable>)}</View>
          <Pressable disabled={saving} onPress={() => { void saveDocument(); }} style={[styles.saveButton, saving && styles.uploadDisabled]}><Text style={styles.saveButtonText}>{saving ? 'Đang lưu...' : 'Lưu thay đổi'}</Text></Pressable>
        </View></View>}
      </Modal>
    </View>
  );
}

function DocumentRow({ document, onPress }: { document: KnowledgeDocument; onPress: () => void }) {
  const Icon = fileIcon(document.mimeType);
  return <Card onPress={onPress} style={styles.documentRow}>
    <View style={styles.documentIcon}><Icon size={19} color="#7852C7" /></View>
    <View style={styles.documentCopy}><Text numberOfLines={1} style={styles.rowName}>{document.name}</Text><Text style={styles.rowMeta}>{document.category} · {statusLabel(document.status)} · {formatDate(document.updatedAt)}</Text></View>
    <ChevronRight size={17} color={colors.muted} />
  </Card>;
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return <View style={styles.infoLine}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>;
}

function fileIcon(mimeType: string) {
  if (mimeType.includes('image')) return FileImage;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return FileSpreadsheet;
  if (mimeType.includes('pdf') || mimeType.includes('word') || mimeType.includes('document')) return FileText;
  return File;
}

const styles = StyleSheet.create({
  container: { flex: 1 }, content: { padding: 18, paddingTop: 14, paddingBottom: 28 },
  eyebrow: { color: colors.primary, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 }, title: { color: colors.ink, fontSize: 24, fontWeight: '800', marginTop: 4 }, subtitle: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 5 },
  summaryRow: { flexDirection: 'row', gap: 8, marginTop: 17 }, summaryCard: { flex: 1, padding: 11, alignItems: 'center', borderRadius: 14 }, summaryValue: { color: colors.ink, fontSize: 17, fontWeight: '800' }, summaryLabel: { color: colors.muted, fontSize: 8, marginTop: 4 },
  uploadButton: { flexDirection: 'row', alignItems: 'center', marginTop: 14, padding: 12, borderRadius: 15, backgroundColor: '#EEF4FF', borderWidth: 1, borderColor: '#DDE9FF' }, uploadIcon: { width: 31, height: 31, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, uploadCopy: { flex: 1, marginLeft: 10 }, uploadTitle: { color: colors.ink, fontSize: 10, fontWeight: '800' }, uploadHint: { color: colors.muted, fontSize: 8, marginTop: 3 },
  search: { height: 42, paddingHorizontal: 13, marginTop: 14, borderRadius: 13, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, color: colors.ink, fontSize: 10 }, filters: { gap: 7, paddingVertical: 11 }, filter: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 9, backgroundColor: colors.white }, filterActive: { backgroundColor: '#EAF2FF' }, filterText: { color: colors.muted, fontSize: 8, fontWeight: '700' }, filterTextActive: { color: colors.primary },
  listHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5, marginBottom: 9 }, listTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' }, listCount: { color: colors.muted, fontSize: 8 }, documentList: { gap: 8 }, documentRow: { flexDirection: 'row', alignItems: 'center', padding: 11, borderRadius: 15 }, documentIcon: { width: 38, height: 40, borderRadius: 12, backgroundColor: '#F1EBFF', alignItems: 'center', justifyContent: 'center' }, documentCopy: { flex: 1, marginHorizontal: 10 }, rowName: { color: colors.ink, fontSize: 10, fontWeight: '800' }, rowMeta: { color: colors.muted, fontSize: 8, marginTop: 5 }, empty: { color: colors.muted, textAlign: 'center', fontSize: 10, padding: 28 }, note: { color: colors.muted, textAlign: 'center', fontSize: 8, lineHeight: 13, marginTop: 16 },
  loading: { padding: 24 }, errorCard: { padding: 11, marginTop: 12, backgroundColor: '#FFF1F0', borderColor: '#F6D6D4' }, errorText: { color: '#A43B36', fontSize: 8, lineHeight: 13 }, uploadDisabled: { opacity: 0.65 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#10182866' }, detailSheet: { backgroundColor: colors.background, borderTopLeftRadius: 23, borderTopRightRadius: 23, paddingHorizontal: 20, paddingTop: 9, paddingBottom: 25 }, editSheet: { backgroundColor: colors.background, borderTopLeftRadius: 23, borderTopRightRadius: 23, paddingHorizontal: 20, paddingTop: 9, paddingBottom: 25 }, sheetHandle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 3, backgroundColor: '#CDD4E0', marginBottom: 14 }, sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 17 }, sheetTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' }, closeButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  fileHero: { flexDirection: 'row', alignItems: 'center', padding: 13, backgroundColor: colors.white, borderRadius: 15, marginBottom: 12 }, fileIcon: { backgroundColor: '#F1EBFF', width: 43, height: 43, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, fileHeroCopy: { flex: 1, marginLeft: 11 }, documentName: { color: colors.ink, fontSize: 11, fontWeight: '800' }, fileName: { color: colors.muted, fontSize: 8, marginTop: 4 }, infoLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.border }, infoLabel: { color: colors.muted, fontSize: 9 }, infoValue: { color: colors.ink, fontSize: 9, fontWeight: '700' },
  sheetActions: { flexDirection: 'row', gap: 9, marginTop: 18 }, secondaryButton: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF2FF', borderRadius: 12 }, secondaryButtonText: { color: colors.primary, fontSize: 10, fontWeight: '800' }, deleteButton: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FCEBEC', borderRadius: 12 }, deleteButtonText: { color: '#B4232E', fontSize: 10, fontWeight: '800' },
  fieldLabel: { color: colors.ink, fontSize: 9, fontWeight: '700', marginBottom: 6 }, fieldInput: { height: 43, paddingHorizontal: 12, backgroundColor: colors.white, borderRadius: 12, borderColor: colors.border, borderWidth: 1, color: colors.ink, fontSize: 10, marginBottom: 15 }, categoryOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 19 }, categoryOption: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9, backgroundColor: colors.white }, categoryOptionActive: { backgroundColor: '#EAF2FF' }, categoryOptionText: { color: colors.muted, fontSize: 8, fontWeight: '700' }, categoryOptionTextActive: { color: colors.primary }, saveButton: { minHeight: 43, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: 12 }, saveButtonText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  editDocumentName: { color: colors.ink, fontSize: 10, lineHeight: 15, padding: 12, borderRadius: 12, backgroundColor: colors.white, marginBottom: 15 },
});
