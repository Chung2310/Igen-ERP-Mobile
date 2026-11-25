import { withAppLockSuspended } from '@/core/auth/appLockSuspension';
import { PopupError } from '@/components/PopupError';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { strToU8, unzipSync, zipSync } from 'fflate';
import { Download, FileUp, Upload, X } from 'lucide-react-native';
import { bulkCreateStudentPartners, type StudentPartner } from '@/features/studentPartnersApi';
import { saveAndShareExport } from '@/features/quotation/fileExport';
import { colors } from '@/theme/colors';

type ImportRow = { name: string; phone: string; email: string; bankName: string; bankAccountNo: string; bankAccountName: string; isActive: boolean; notes: string };
type Preview = { fileName: string; rows: ImportRow[]; invalid: Array<{ row: number; reason: string }>; duplicates: number };
const headers = ['Tên đối tác', 'Số điện thoại', 'Email', 'Ngân hàng', 'Số tài khoản', 'Tên chủ tài khoản', 'Trạng thái', 'Ghi chú'];
const exportHeaders = [...headers, 'Số học viên giới thiệu', 'Tổng học phí giới thiệu', 'Tổng hoa hồng', 'Đã chi trả', 'Còn phải trả', 'Cấp hoa hồng', 'Owner ID'];
const xmlEscape = (value: unknown) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
function columnName(index: number) { let value = index + 1; let name = ''; while (value > 0) { const remainder = (value - 1) % 26; name = String.fromCharCode(65 + remainder) + name; value = Math.floor((value - 1) / 26); } return name; }
function makeXlsx(rows: unknown[][]) {
  const sheetRows = rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => `<c r="${columnName(columnIndex)}${rowIndex + 1}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`).join('')}</row>`).join('');
  return zipSync({
    '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
    'xl/workbook.xml': strToU8('<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="DoiTac" sheetId="1" r:id="rId1"/></sheets></workbook>'),
    'xl/_rels/workbook.xml.rels': strToU8('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'),
    'xl/worksheets/sheet1.xml': strToU8(`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`),
  });
}
const normalize = (value: string) => value.replace(/^\uFEFF/, '').trim().toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');

function parseCsv(text: string): string[][] {
  text = text.replace(/^\uFEFF/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const delimiters = [',', ';', '\t'];
  let delimiter = ','; let highestCount = -1;
  for (const candidate of delimiters) {
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
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') { value += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { row.push(value); value = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && text[i + 1] === '\n') i += 1; row.push(value); rows.push(row); row = []; value = ''; }
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
  const sheetName = Object.keys(files).find((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
  if (!sheetName) throw new Error('Không tìm thấy trang tính trong file XLSX.');
  const xml = decoder.decode(files[sheetName]);
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

function previewRows(fileName: string, rows: string[][]): Preview {
  if (rows.length < 2) throw new Error('File không có dữ liệu hoặc thiếu tiêu đề cột.');
  const map: Record<string, number> = {};
  rows[0].forEach((header, index) => {
    const key = normalize(header);
    if (key.includes('ten doi tac') || key.includes('ten cong tac vien') || key === 'ten' || key === 'name') map.name = index;
    else if (key.includes('so dien thoai') || key.includes('dien thoai') || key === 'phone' || key === 'sdt') map.phone = index;
    else if (key.includes('email')) map.email = index;
    else if (key.includes('ngan hang') || key === 'bank') map.bankName = index;
    else if (key.includes('so tai khoan') || key === 'stk' || key.includes('account no')) map.bankAccountNo = index;
    else if (key.includes('chu tai khoan') || key.includes('account name')) map.bankAccountName = index;
    else if (key.includes('trang thai') || key === 'status') map.isActive = index;
    else if (key.includes('ghi chu') || key === 'notes') map.notes = index;
  });
  if (map.name == null || map.phone == null) throw new Error('File cần có cột Tên đối tác và Số điện thoại.');
  const valid: ImportRow[] = []; const invalid: Preview['invalid'] = []; const seen = new Set<string>(); let duplicates = 0;
  rows.slice(1).forEach((row, offset) => {
    if (!row.some((cell) => String(cell || '').trim())) return;
    const get = (key: string) => map[key] == null ? '' : String(row[map[key]] ?? '').trim();
    const phone = get('phone').replace(/[^\d+]/g, ''); const name = get('name'); const email = get('email'); const reasons: string[] = [];
    if (!name) reasons.push('Thiếu tên đối tác'); if (!phone) reasons.push('Thiếu số điện thoại');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) reasons.push('Email không hợp lệ');
    if (phone && seen.has(phone)) { reasons.push('Số điện thoại trùng trong file'); duplicates += 1; } else if (phone) seen.add(phone);
    if (reasons.length) invalid.push({ row: offset + 2, reason: reasons.join('; ') });
    else { const status = normalize(get('isActive')); valid.push({ name, phone, email, bankName: get('bankName'), bankAccountNo: get('bankAccountNo').replace(/\D/g, ''), bankAccountName: get('bankAccountName'), isActive: !['ngung hoat dong', 'inactive', 'false', '0'].includes(status), notes: get('notes') }); }
  });
  return { fileName, rows: valid, invalid, duplicates };
}

export function StudentPartnerDataTransfer({ partners, centerId, branchId, onImported }: { partners: StudentPartner[]; centerId?: string; branchId?: string; onImported: () => void }) {
  const [open, setOpen] = useState(false); const [preview, setPreview] = useState<Preview | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [result, setResult] = useState<{ importedCount: number; skippedCount: number; errors: Array<{ row: number; name: string; phone: string; reason: string }> } | null>(null);
  async function exportRows(rows: StudentPartner[], fileName: string) {
    const content = [exportHeaders, ...rows.map((row) => [row.name, row.phone, row.email, row.bankName, row.bankAccountNo, row.bankAccountName, row.isActive ? 'Đang hoạt động' : 'Ngừng hoạt động', row.notes, row.referredStudentsCount, row.totalReferredTuition, row.totalCommission, row.totalPaid, row.unpaidBalance, row.levelName, row.ownerId])];
    await saveAndShareExport(makeXlsx(content), fileName, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }
  async function chooseImport() {
    setError(''); setResult(null);
    try {
      const picked = await withAppLockSuspended(() => DocumentPicker.getDocumentAsync({ type: ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], copyToCacheDirectory: true }));
      if (picked.canceled) return;
      const asset = picked.assets[0]; if (!asset || !/\.(csv|xlsx)$/i.test(asset.name) || (asset.size ?? 0) > 5 * 1024 * 1024) throw new Error('Chọn file CSV hoặc XLSX tối đa 5 MB.');
      setBusy(true); const response = await fetch(asset.uri);
      if (!response.ok) throw new Error('Không đọc được file trên thiết bị.');
      const bytes = new Uint8Array(await response.arrayBuffer());
      const rows = /\.xlsx$/i.test(asset.name) ? parseXlsx(bytes) : parseCsv(new TextDecoder().decode(bytes));
      setPreview(previewRows(asset.name, rows)); setOpen(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không đọc được file nhập.'); }
    finally { setBusy(false); }
  }
  async function importRows() {
    if (!preview?.rows.length) { setError('Không có dòng hợp lệ để nhập.'); return; }
    setBusy(true); setError('');
    try { const imported = await bulkCreateStudentPartners(preview.rows, centerId, branchId); setResult(imported); onImported(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không nhập được đối tác.'); }
    finally { setBusy(false); }
  }
  return <>
    <View style={styles.row}><Pressable onPress={() => void exportRows(partners, `danh_sach_doi_tac_${new Date().toISOString().slice(0, 10)}.xlsx`)} style={styles.button}><Download size={13} color={colors.primary} /><Text style={styles.buttonText}>Xuất Excel</Text></Pressable><Pressable onPress={() => void saveAndShareExport(makeXlsx([headers, ['Nguyễn Văn A', '0912345678', 'nguyenvana@example.com', 'MB Bank', '0123456789', 'NGUYEN VAN A', 'Đang hoạt động', 'Ghi chú']]), 'mau_import_doi_tac.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')} style={styles.button}><Download size={13} color={colors.primary} /><Text style={styles.buttonText}>Tải mẫu</Text></Pressable><Pressable disabled={busy} onPress={() => void chooseImport()} style={styles.button}><Upload size={13} color={colors.primary} />{busy ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={styles.buttonText}>Nhập CSV/XLSX</Text>}</Pressable></View>
    {error ? <PopupError error={error} /> : null}
    <Modal visible={open} animationType="slide" onRequestClose={() => { if (!busy) setOpen(false); }}><View style={styles.modal}><View style={styles.header}><View style={{ flex: 1 }}><Text style={styles.title}>{result ? 'Kết quả nhập' : 'Xem trước dữ liệu nhập'}</Text><Text style={styles.meta}>{preview?.fileName}</Text></View><Pressable onPress={() => setOpen(false)}><X size={19} color={colors.ink} /></Pressable></View>
      {result ? <View style={styles.result}><Text style={styles.title}>Đã nhập {result.importedCount} đối tác</Text><Text style={styles.meta}>Bỏ qua: {result.skippedCount} dòng · Lỗi: {result.errors.length}</Text>{result.errors.slice(0, 20).map((item, index) => <Text key={index} style={styles.error}>Dòng {item.row}: {item.reason}</Text>)}</View> : <><View style={styles.summary}><Text style={styles.meta}>Hợp lệ: <Text style={styles.strong}>{preview?.rows.length || 0}</Text></Text><Text style={styles.meta}>Lỗi: <Text style={styles.strong}>{preview?.invalid.length || 0}</Text></Text><Text style={styles.meta}>Trùng SĐT: <Text style={styles.strong}>{preview?.duplicates || 0}</Text></Text></View><ScrollView contentContainerStyle={styles.previewRows}>{preview?.rows.slice(0, 30).map((row, index) => <View key={`${row.phone}-${index}`} style={styles.previewRow}><Text style={styles.strong}>{row.name}</Text><Text style={styles.meta}>{row.phone} · {row.email || 'Không có email'}</Text></View>)}{preview?.invalid.slice(0, 20).map((row) => <Text key={row.row} style={styles.error}>Dòng {row.row}: {row.reason}</Text>)}</ScrollView><View style={styles.footer}><Pressable onPress={() => setOpen(false)} style={styles.button}><Text style={styles.buttonText}>Đóng</Text></Pressable><Pressable disabled={busy || !preview?.rows.length} onPress={() => void importRows()} style={[styles.button, styles.primary]}><FileUp size={13} color={colors.white} /><Text style={styles.primaryText}>{busy ? 'Đang nhập…' : `Nhập ${preview?.rows.length || 0} dòng hợp lệ`}</Text></Pressable></View></>}
    </View></Modal>
  </>;
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 7 }, button: { minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 9, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.white }, buttonText: { color: colors.primary, fontSize: 8, fontWeight: '800' }, error: { color: '#B42318', fontSize: 8, lineHeight: 13 }, modal: { flex: 1, backgroundColor: colors.background }, header: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderBottomWidth: 1, borderColor: colors.border }, title: { color: colors.ink, fontSize: 12, fontWeight: '800' }, meta: { color: colors.muted, fontSize: 8, lineHeight: 13 }, summary: { flexDirection: 'row', justifyContent: 'space-around', padding: 11, backgroundColor: colors.white }, strong: { color: colors.ink, fontSize: 9, fontWeight: '800' }, previewRows: { gap: 5, padding: 12 }, previewRow: { padding: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.white }, footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 7, padding: 12, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.white }, primary: { backgroundColor: colors.primary, borderColor: colors.primary }, primaryText: { color: colors.white, fontSize: 8, fontWeight: '800' }, result: { padding: 18, gap: 8 } });
