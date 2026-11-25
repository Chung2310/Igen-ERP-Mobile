import { withAppLockSuspended } from '@/core/auth/appLockSuspension';
import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { strToU8, unzipSync, zipSync } from 'fflate';
import { ChevronDown, Download, FileUp, SlidersHorizontal, Upload, X } from 'lucide-react-native';
import { bulkCreateStudents, previewBulkStudents, type BulkStudentInput, type StudentManagementScope, type StudentRecord, type BatchRecord } from '@/features/studentManagementApi';
import { saveAndShareExport } from '@/features/quotation/fileExport';
import { colors } from '@/theme/colors';

type ImportRow = { input: BulkStudentInput; row: number; error: string; tuitionUpdate?: boolean };
type ImportResult = { importedCount: number; updatedFeeCount?: number; skippedCount: number; errors?: Array<{ row: number; name?: string; phone?: string; reason: string }> };

const headers = ['Họ và tên', 'Số điện thoại', 'Email', 'Ngày sinh', 'CCCD', 'Địa chỉ', 'Nguồn giới thiệu', 'Ngày đăng ký', 'Ngày nhập học', 'Học phí', 'Đã đóng', 'Còn nợ', 'Mã lớp'];
const normalize = (value: string) => value.replace(/^\uFEFF/, '').trim().toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
const xmlEscape = (value: unknown) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

function columnName(index: number) {
  let value = index + 1;
  let name = '';
  while (value > 0) { const remainder = (value - 1) % 26; name = String.fromCharCode(65 + remainder) + name; value = Math.floor((value - 1) / 26); }
  return name;
}

function makeXlsx(rows: unknown[][]) {
  const sheetRows = rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => `<c r="${columnName(columnIndex)}${rowIndex + 1}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`).join('')}</row>`).join('');
  return zipSync({
    '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
    'xl/workbook.xml': strToU8('<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="HocVien" sheetId="1" r:id="rId1"/></sheets></workbook>'),
    'xl/_rels/workbook.xml.rels': strToU8('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'),
    'xl/worksheets/sheet1.xml': strToU8(`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`),
  });
}

function parseCsv(text: string): string[][] {
  text = text.replace(/^\uFEFF/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  let delimiter = ','; let highestCount = -1;
  for (const candidate of [',', ';', '\t']) {
    let quoted = false; let count = 0;
    for (let index = 0; index < firstLine.length; index += 1) {
      const char = firstLine[index];
      if (char === '"' && quoted && firstLine[index + 1] === '"') index += 1;
      else if (char === '"') quoted = !quoted;
      else if (char === candidate && !quoted) count += 1;
    }
    if (count > highestCount) { delimiter = candidate; highestCount = count; }
  }
  const rows: string[][] = []; let row: string[] = []; let value = ''; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') { value += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { row.push(value); value = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && text[index + 1] === '\n') index += 1; row.push(value); rows.push(row); row = []; value = ''; }
    else value += char;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows;
}

function xmlText(value: string) { return value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'"); }
function columnIndex(ref: string) { const letters = ref.replace(/\d/g, ''); return [...letters].reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0) - 1; }
function parseXlsx(bytes: Uint8Array): string[][] {
  const files = unzipSync(bytes); const decoder = new TextDecoder();
  const sharedXml = files['xl/sharedStrings.xml'] ? decoder.decode(files['xl/sharedStrings.xml']) : '';
  const shared = [...sharedXml.matchAll(/<si[^>]*>([\s\S]*?)<\/si>/g)].map((item) => [...item[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((part) => xmlText(part[1])).join(''));
  const sheet = Object.keys(files).find((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
  if (!sheet) throw new Error('Không tìm thấy trang tính trong file XLSX.');
  const xml = decoder.decode(files[sheet]);
  return [...xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map((rowMatch) => {
    const row: string[] = [];
    for (const cell of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const ref = cell[1].match(/\br="([A-Z]+\d+)"/)?.[1]; if (!ref) continue;
      const index = columnIndex(ref); const type = cell[1].match(/\bt="([^"]+)"/)?.[1];
      const raw = cell[2].match(/<v[^>]*>([\s\S]*?)<\/v>/)?.[1] ?? [...cell[2].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((part) => part[1]).join('');
      row[index] = type === 's' ? (shared[Number(raw)] || '') : xmlText(raw);
    }
    return row;
  });
}

function excelDate(value: string) {
  if (!/^\d{4,6}(\.\d+)?$/.test(value)) return value;
  const date = new Date(Date.UTC(1899, 11, 30) + Number(value) * 86400000);
  return Number.isNaN(date.getTime()) ? value : `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${date.getUTCFullYear()}`;
}
function formatPhone(value: string) { return value.replace(/\D/g, '').replace(/^84(?=\d{9})/, '0'); }
function amount(value: string) { const raw = value.replace(/(?:vnđ|vnd|₫|đ)/gi, '').replace(/\s/g, '').trim(); if (!raw) return 0; if (!/^\d+$/.test(raw) && !/^\d{1,3}(?:[.,]\d{3})+$/.test(raw)) return null; const parsed = Number(raw.replace(/[.,]/g, '')); return Number.isSafeInteger(parsed) ? parsed : null; }

function mapHeaders(row: string[]) {
  const result: Record<string, number> = {};
  row.forEach((value, index) => {
    const key = normalize(value);
    if (key.includes('ho va ten') || key.includes('ho ten') || key.includes('ten hoc vien') || key === 'fullname' || key === 'name') result.fullName = index;
    else if (key.includes('dien thoai') || key === 'phone' || key === 'sdt') result.phone = index;
    else if (key.includes('email')) result.email = index;
    else if (key.includes('ngay sinh') || key === 'birthday') result.birthday = index;
    else if (key.includes('cccd') || key.includes('cmnd') || key === 'idcard') result.idCard = index;
    else if (key === 'dia chi' || key === 'address') result.address = index;
    else if (key.includes('nguon gioi thieu') || key === 'referral') result.referral = index;
    else if (key.includes('ngay dang ky') || key === 'registrationdate') result.registrationDate = index;
    else if (key.includes('ngay nhap hoc') || key === 'enrollmentdate') result.enrollmentDate = index;
    else if (key === 'hoc phi' || key === 'fee') result.fee = index;
    else if (key.includes('da dong') || key === 'paidamount') result.paidAmount = index;
    else if (key.includes('con no') || key === 'remainingamount') result.remainingAmount = index;
    else if (key === 'ma lop' || key === 'batchcode') result.batchCode = index;
  });
  return result;
}

function parseRows(rows: string[][]): ImportRow[] {
  if (rows.length < 2) throw new Error('File chưa có dữ liệu hoặc thiếu tiêu đề cột.');
  const map = mapHeaders(rows[0]);
  if (map.fullName == null || map.phone == null) throw new Error('File cần có tối thiểu cột Họ và tên và Số điện thoại.');
  const seenPhones = new Set<string>(); const seenEmails = new Set<string>();
  return rows.slice(1).flatMap((values, offset) => {
    if (!values.some((value) => String(value || '').trim())) return [];
    const cell = (key: string) => map[key] == null ? '' : String(values[map[key]] ?? '').trim();
    const fullName = cell('fullName'); const phone = formatPhone(cell('phone')); const email = cell('email').toLowerCase();
    const feeCell = cell('fee'); const paidCell = cell('paidAmount'); const remainingCell = cell('remainingAmount');
    const fee = amount(feeCell); const paidAmount = amount(paidCell); const remaining = amount(remainingCell);
    const feeProvided = Boolean(feeCell || remainingCell);
    const errors: string[] = [];
    if (!fullName) errors.push('Thiếu họ và tên.');
    if (!phone) errors.push('Thiếu số điện thoại.');
    else if (!/^0[35789]\d{8}$/.test(phone)) errors.push('Số điện thoại cần 10 chữ số, bắt đầu bằng 03, 05, 07, 08 hoặc 09.');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Email không đúng định dạng.');
    if (!email && !feeProvided) errors.push('Thiếu email.');
    if (phone && seenPhones.has(phone)) errors.push('Số điện thoại bị trùng trong file.'); else if (phone) seenPhones.add(phone);
    if (email && seenEmails.has(email)) errors.push('Email bị trùng trong file.'); else if (email) seenEmails.add(email);
    if (fee === null || paidAmount === null || remaining === null) errors.push('Học phí, đã đóng và còn nợ phải là số nguyên không âm.');
    const feeValue = feeCell ? fee : remaining != null ? (paidAmount || 0) + remaining : 0;
    if (feeValue != null && paidAmount != null && paidAmount > feeValue) errors.push('Số tiền đã đóng không được vượt quá học phí.');
    if (feeCell && remainingCell && fee != null && paidAmount != null && remaining != null && fee !== paidAmount + remaining) errors.push('Học phí phải bằng số đã đóng cộng số còn nợ.');
    const input: BulkStudentInput = {
      fullName, phone, email, birthday: excelDate(cell('birthday')), idCard: cell('idCard'), address: cell('address'), referral: cell('referral'),
      registrationDate: excelDate(cell('registrationDate')), enrollmentDate: excelDate(cell('enrollmentDate')),
      fee: String(feeValue ?? 0), feeProvided, paidAmount: paidAmount ?? 0, batchCode: cell('batchCode'), sourceRow: offset + 2,
    };
    return [{ input, row: offset + 2, error: errors.join(' ') }];
  });
}

export function StudentDataTransfer({ students, batches, scope, onImported, filterLabel, hasActiveFilter = false, onFilterPress }: { students: StudentRecord[]; batches: BatchRecord[]; scope: StudentManagementScope; onImported: () => void; filterLabel?: string; hasActiveFilter?: boolean; onFilterPress?: () => void }) {
  const [open, setOpen] = useState(false); const [rows, setRows] = useState<ImportRow[]>([]); const [busy, setBusy] = useState(false); const [result, setResult] = useState<ImportResult | null>(null);

  async function exportStudents(data: StudentRecord[], filename: string) {
    const body = data.map((student) => {
      const fee = Number(String(student.fee || '').replace(/\D/g, '')) || 0; const paid = Number(student.paidAmount || 0);
      return [student.fullName, student.phone, student.email, student.birthday, student.idCard, student.address, student.referral, student.registrationDate, student.enrollmentDate, fee, paid, Math.max(0, fee - paid), student.batchCode || batches.find((batch) => (batch.learnerIds || []).includes(student.id))?.code || ''];
    });
    await saveAndShareExport(makeXlsx([headers, ...body]), filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }

  async function chooseImport() {
    setResult(null); setRows([]);
    try {
      const picked = await withAppLockSuspended(() => DocumentPicker.getDocumentAsync({ type: ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], copyToCacheDirectory: true }));
      if (picked.canceled) return;
      const asset = picked.assets[0];
      if (!asset || !/\.(csv|xlsx)$/i.test(asset.name) || (asset.size ?? 0) > 5 * 1024 * 1024) throw new Error('Chọn file CSV hoặc XLSX tối đa 5 MB.');
      setBusy(true);
      const response = await fetch(asset.uri);
      if (!response.ok) throw new Error('Không đọc được file trên thiết bị.');
      const bytes = new Uint8Array(await response.arrayBuffer());
      const parsed = parseRows(/\.xlsx$/i.test(asset.name) ? parseXlsx(bytes) : parseCsv(new TextDecoder().decode(bytes)));
      const valid = parsed.filter((item) => !item.error);
      if (valid.length > 0) {
        const preview = await previewBulkStudents(valid.map((item) => item.input), scope);
        for (const conflict of preview.errors || []) {
          const candidate = valid[Number(conflict.index)];
          if (candidate && conflict.reason) candidate.error = [candidate.error, conflict.reason].filter(Boolean).join(' ');
        }
        for (const update of preview.feeUpdates || []) {
          const candidate = valid[Number(update.index)]; if (candidate) candidate.tuitionUpdate = true;
        }
      }
      setRows(parsed); setOpen(true);
    } catch (cause) { Alert.alert('Không đọc được file nhập', cause instanceof Error ? cause.message : 'Chọn lại file CSV/XLSX rồi thử lại.'); }
    finally { setBusy(false); }
  }

  async function importRows() {
    const valid = rows.filter((row) => !row.error);
    if (!valid.length) { Alert.alert('Không có dòng hợp lệ', 'Kiểm tra các lỗi trong file trước khi nhập.'); return; }
    setBusy(true);
    try {
      const response = await bulkCreateStudents(valid.map((row) => row.input), scope);
      setResult(response); onImported();
    } catch (cause) { Alert.alert('Không nhập được danh sách học viên', cause instanceof Error ? cause.message : 'IGen-ERP từ chối thao tác.'); }
    finally { setBusy(false); }
  }

  return <>
    <View style={styles.actionsRow}>
      <Pressable onPress={() => void exportStudents(students, `danh_sach_hoc_vien_${new Date().toISOString().slice(0, 10)}.xlsx`)} style={[styles.button, styles.rowButton]}><Download size={12} color={colors.primary} /><Text numberOfLines={1} style={styles.buttonText}>Xuất Excel</Text></Pressable>
      <Pressable onPress={() => void exportStudents([], 'mau_import_hoc_vien.xlsx')} style={[styles.button, styles.rowButton]}><Download size={12} color={colors.primary} /><Text numberOfLines={1} style={styles.buttonText}>Tải mẫu</Text></Pressable>
      <Pressable disabled={busy} onPress={() => void chooseImport()} style={[styles.button, styles.rowButton]}><Upload size={12} color={colors.primary} />{busy ? <ActivityIndicator size="small" color={colors.primary} /> : <Text numberOfLines={1} style={styles.buttonText}>Nhập CSV/XLSX</Text>}</Pressable>
      {onFilterPress ? <Pressable onPress={onFilterPress} style={[styles.button, styles.rowButton, hasActiveFilter && styles.filterButtonActive]}><SlidersHorizontal size={12} color={colors.primary} /><Text numberOfLines={1} style={styles.buttonText}>{filterLabel || 'Bộ lọc'}</Text><ChevronDown size={11} color={colors.primary} /></Pressable> : null}
    </View>
    <Modal visible={open} animationType="slide" onRequestClose={() => { if (!busy) setOpen(false); }}>
      <View style={styles.modal}>
        <View style={styles.header}><View style={{ flex: 1 }}><Text style={styles.title}>{result ? 'Kết quả nhập học viên' : 'Kiểm tra file nhập học viên'}</Text><Text style={styles.meta}>CSV/XLSX · Họ tên, điện thoại, email, học phí, ngày sinh, mã lớp</Text></View><Pressable disabled={busy} onPress={() => setOpen(false)}><X size={19} color={colors.ink} /></Pressable></View>
        {result ? <ScrollView contentContainerStyle={styles.preview}><Text style={styles.title}>Đã thêm {result.importedCount} học viên</Text>{result.updatedFeeCount ? <Text style={styles.meta}>Đã cập nhật học phí: {result.updatedFeeCount}</Text> : null}<Text style={styles.meta}>Bỏ qua: {result.skippedCount} · Lỗi: {result.errors?.length || 0}</Text>{result.errors?.slice(0, 30).map((item, index) => <Text key={`${item.row}-${index}`} style={styles.error}>Dòng {item.row}: {item.reason}</Text>)}</ScrollView> : <>
          <View style={styles.summary}><Text style={styles.meta}>Hợp lệ: {rows.filter((row) => !row.error).length}</Text><Text style={styles.meta}>Lỗi: {rows.filter((row) => Boolean(row.error)).length}</Text><Text style={styles.meta}>Cập nhật học phí: {rows.filter((row) => row.tuitionUpdate).length}</Text></View>
          <ScrollView contentContainerStyle={styles.preview}>{rows.slice(0, 100).map((row) => <View key={`${row.row}-${row.input.phone}`} style={styles.previewRow}><Text style={styles.rowTitle}>Dòng {row.row} · {row.input.fullName || 'Thiếu họ tên'}</Text><Text style={styles.meta}>{row.input.phone} · {row.input.email || 'Không có email'}{row.tuitionUpdate ? ' · Cập nhật học phí' : ''}</Text>{row.error ? <Text style={styles.error}>{row.error}</Text> : null}</View>)}{rows.length > 100 ? <Text style={styles.meta}>Đang hiển thị 100/{rows.length} dòng đầu.</Text> : null}</ScrollView>
          <View style={styles.footer}><Pressable disabled={busy} onPress={() => setOpen(false)} style={styles.button}><Text style={styles.buttonText}>Đóng</Text></Pressable><Pressable disabled={busy || !rows.some((row) => !row.error)} onPress={() => void importRows()} style={[styles.button, styles.primary]}><FileUp size={13} color={colors.white} />{busy ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.primaryText}>Nhập {rows.filter((row) => !row.error).length} dòng</Text>}</Pressable></View>
        </>}
      </View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, marginBottom: 10 }, button: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 9, backgroundColor: colors.white }, rowButton: { flexGrow: 1, flexShrink: 1, minWidth: 0 }, filterButtonActive: { borderColor: colors.primary, backgroundColor: '#EFF6FF' }, buttonText: { color: colors.primary, fontSize: 9, fontWeight: '800', flexShrink: 1 }, modal: { flex: 1, backgroundColor: colors.background }, header: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderColor: colors.border }, title: { color: colors.ink, fontSize: 13, fontWeight: '800' }, meta: { color: colors.muted, fontSize: 9, lineHeight: 15 }, summary: { flexDirection: 'row', justifyContent: 'space-around', padding: 10, backgroundColor: colors.white, borderBottomWidth: 1, borderColor: colors.border }, preview: { gap: 6, padding: 12 }, previewRow: { padding: 9, borderWidth: 1, borderColor: colors.border, borderRadius: 9, backgroundColor: colors.white }, rowTitle: { color: colors.ink, fontSize: 10, fontWeight: '800' }, error: { color: '#B42318', fontSize: 9, lineHeight: 14 }, footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 7, padding: 12, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.white }, primary: { backgroundColor: colors.primary, borderColor: colors.primary }, primaryText: { color: colors.white, fontSize: 10, fontWeight: '800' },
});
