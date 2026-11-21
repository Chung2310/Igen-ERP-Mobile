import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { BarcodeScanningResult } from 'expo-camera';
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, Barcode, Camera, Check, ChevronDown, ChevronRight, CircleAlert, ClipboardCheck, Eye, Package, Pencil, Plus, RefreshCw, Search, Settings2, SlidersHorizontal, Trash2, Truck, X } from 'lucide-react-native';
import { Card } from '@/components/Card';
import { colors } from '@/theme/colors';
import {
  inventoryApi,
  type CatalogProduct,
  type GoodsReceipt,
  type InventoryBalance,
  type InventoryCount,
  type InventoryTransfer,
  type ProductResource,
  type ProductVariant,
  type ReceiptItem,
  type ResourceKind,
  type SerialUnit,
  type StockLog,
  type Supplier,
  type TrackingMode,
  type TransferDestination,
  type Warehouse,
} from '@/features/inventory/inventoryApi';

type Props = { branchId?: string; canManage: boolean };
type ProductProps = Props;
type DraftLine = { product?: CatalogProduct; variant?: ProductVariant; quantity: string; amount: string; identifiers?: string };

function errorText(error: unknown) { return error instanceof Error ? error.message : 'Không thể hoàn tất thao tác với ERP.'; }
function money(value: number) { return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value || 0); }
function number(value: string) { const parsed = Number(value.trim().replace(/\s/g, '').replace(',', '.')); return Number.isFinite(parsed) ? parsed : 0; }
function permissionBranch(branchId?: string) { if (!branchId) { Alert.alert('Chưa chọn chi nhánh', 'Hãy chọn chi nhánh trước khi thao tác với kho.'); return false; } return true; }
function reportError(error: unknown) { Alert.alert('Không thể hoàn tất', errorText(error)); }

function PageHeading({ title, subtitle, action, actionLabel, icon: Icon = Plus }: { title: string; subtitle?: string; action?: () => void; actionLabel?: string; icon?: typeof Plus }) {
  return <View style={styles.pageHeading}><View style={styles.pageHeadingCopy}><Text style={styles.pageTitle}>{title}</Text>{subtitle ? <Text style={styles.pageSubtitle}>{subtitle}</Text> : null}</View>{action && actionLabel ? <Pressable onPress={action} style={styles.primaryIconButton}><Icon size={16} color={colors.white} /><Text style={styles.primaryIconButtonText}>{actionLabel}</Text></Pressable> : null}</View>;
}
function SearchField({ value, onChangeText, placeholder = 'Tìm kiếm' }: { value: string; onChangeText: (value: string) => void; placeholder?: string }) {
  return <View style={styles.searchField}><Search size={15} color={colors.muted} /><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.muted} style={styles.searchInput} autoCapitalize="none" /></View>;
}
function SearchFilterBar({ value, onChangeText, placeholder, filterCount, onOpenFilters }: { value: string; onChangeText: (value: string) => void; placeholder: string; filterCount: number; onOpenFilters: () => void }) {
  return <View style={styles.searchAndFilter}><View style={styles.searchGrow}><SearchField value={value} onChangeText={onChangeText} placeholder={placeholder} /></View><Pressable accessibilityRole="button" onPress={onOpenFilters} style={[styles.filterTrigger, filterCount > 0 && styles.filterTriggerActive]}><SlidersHorizontal size={16} color={filterCount > 0 ? colors.primary : '#52627A'} /><Text style={[styles.filterTriggerText, filterCount > 0 && styles.filterTriggerTextActive]}>Lọc</Text>{filterCount > 0 && <View style={styles.filterCount}><Text style={styles.filterCountText}>{filterCount}</Text></View>}</Pressable></View>;
}
function FilterOptions({ options, value, onChange }: { options: Array<{ value: string; label: string }>; value: string; onChange: (value: string) => void }) {
  return <View style={styles.filterChoices}>{options.map((option) => <Pressable key={option.value} onPress={() => onChange(option.value)} style={[styles.filterChoice, value === option.value && styles.filterChoiceSelected]}><Text style={[styles.filterChoiceText, value === option.value && styles.filterChoiceTextSelected]}>{option.label}</Text></Pressable>)}</View>;
}
function SectionLabel({ children, action, onAction }: { children: string; action?: string; onAction?: () => void }) {
  return <View style={styles.sectionLabelRow}><Text style={styles.sectionLabel}>{children}</Text>{action && onAction ? <Pressable onPress={onAction}><Text style={styles.linkText}>{action}</Text></Pressable> : null}</View>;
}
function StatusPill({ value, tone }: { value: string; tone?: 'green' | 'yellow' | 'red' | 'blue' }) {
  const color = tone === 'green' ? '#16885A' : tone === 'yellow' ? '#9A6500' : tone === 'red' ? '#B54745' : colors.primary;
  const bg = tone === 'green' ? '#E8F7F0' : tone === 'yellow' ? '#FFF4D8' : tone === 'red' ? '#FDEDEC' : '#EEF4FF';
  return <View style={[styles.statusPill, { backgroundColor: bg }]}><Text style={[styles.statusPillText, { color }]}>{value}</Text></View>;
}
function LoadingState() { return <View style={styles.loadingState}><ActivityIndicator color={colors.primary} /></View>; }
function EmptyState({ title, copy }: { title: string; copy?: string }) { return <Card style={styles.emptyCard}><Package size={22} color={colors.muted} /><Text style={styles.emptyTitle}>{title}</Text>{copy ? <Text style={styles.emptyCopy}>{copy}</Text> : null}</Card>; }
function Sheet({ visible, title, subtitle, onClose, children }: { visible: boolean; title: string; subtitle?: string; onClose: () => void; children: ReactNode }) {
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <KeyboardAvoidingView style={styles.sheetBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}><View style={{ flex: 1 }}><Text style={styles.sheetTitle}>{title}</Text>{subtitle ? <Text style={styles.sheetSubtitle}>{subtitle}</Text> : null}</View><Pressable onPress={onClose} style={styles.closeButton}><X size={17} color={colors.muted} /></Pressable></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetContent}>{children}</ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
function Field({ label, value, onChangeText, placeholder, keyboardType, multiline, editable = true }: { label: string; value: string; onChangeText?: (text: string) => void; placeholder?: string; keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'email-address' | 'phone-pad'; multiline?: boolean; editable?: boolean }) {
  return <View style={styles.fieldWrap}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.muted} keyboardType={keyboardType} editable={editable} multiline={multiline} style={[styles.input, multiline && styles.multilineInput, !editable && styles.readonlyInput]} /></View>;
}
function ChoiceField({ label, value, options, onChange, placeholder = 'Chọn' }: { label: string; value?: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  return <>
    <View style={styles.fieldWrap}><Text style={styles.fieldLabel}>{label}</Text><Pressable onPress={() => setOpen(true)} style={styles.choiceField}><Text style={[styles.choiceFieldText, !selected && styles.placeholderText]} numberOfLines={1}>{selected?.label ?? placeholder}</Text><ChevronDown size={15} color={colors.muted} /></Pressable></View>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}><Pressable style={styles.pickerBackdrop} onPress={() => setOpen(false)}><Pressable style={styles.pickerSheet} onPress={() => {}}><Text style={styles.pickerTitle}>{label}</Text><ScrollView style={{ maxHeight: 360 }}>{options.map((option) => <Pressable key={option.value} onPress={() => { onChange(option.value); setOpen(false); }} style={[styles.pickerOption, option.value === value && styles.pickerOptionSelected]}><Text style={[styles.pickerOptionText, option.value === value && styles.pickerOptionTextSelected]}>{option.label}</Text>{option.value === value && <Check size={16} color={colors.primary} />}</Pressable>)}</ScrollView></Pressable></Pressable></Modal>
  </>;
}
function ActionButton({ label, onPress, icon: Icon = Check, kind = 'primary', disabled = false }: { label: string; onPress: () => void; icon?: typeof Check; kind?: 'primary' | 'secondary' | 'danger'; disabled?: boolean }) {
  return <Pressable disabled={disabled} onPress={onPress} style={[styles.actionButton, kind === 'primary' && styles.actionButtonPrimary, kind === 'danger' && styles.actionButtonDanger, disabled && styles.disabled]}><Icon size={14} color={kind === 'primary' ? colors.white : kind === 'danger' ? '#B54745' : colors.ink} /><Text style={[styles.actionButtonText, kind === 'primary' && styles.actionButtonTextPrimary, kind === 'danger' && styles.actionButtonTextDanger]}>{label}</Text></Pressable>;
}
function LineItemsEditor({ products, lines, onChange, amountLabel = 'Đơn giá', amountPlaceholder = '0' }: { products: CatalogProduct[]; lines: DraftLine[]; onChange: (lines: DraftLine[]) => void; amountLabel?: string; amountPlaceholder?: string }) {
  const [pickLine, setPickLine] = useState<number | null>(null);
  const [busyIndex, setBusyIndex] = useState<number | null>(null);
  const add = () => onChange([...lines, { quantity: '1', amount: '', identifiers: '' }]);
  const choose = async (index: number, product: CatalogProduct) => {
    setBusyIndex(index);
    try {
      const detail = await inventoryApi.getProduct(product._id);
      const variant = detail.variants?.find((entry) => entry.status === 'active') ?? detail.variants?.[0];
      if (!variant) throw new Error('Sản phẩm chưa có biến thể/SKU hoạt động. Hãy thêm biến thể trong danh mục sản phẩm trước.');
      const next = [...lines]; next[index] = { ...next[index], product: detail, variant };
      onChange(next); setPickLine(null);
    } catch (error) { reportError(error); }
    finally { setBusyIndex(null); }
  };
  return <View style={styles.lineEditor}>
    <SectionLabel action="Thêm dòng" onAction={add}>Sản phẩm trong phiếu</SectionLabel>
    {lines.map((line, index) => <View key={index} style={styles.lineEditorCard}>
      <View style={styles.lineEditorHeading}><Text style={styles.lineEditorTitle}>Mặt hàng {index + 1}</Text>{lines.length > 1 && <Pressable onPress={() => onChange(lines.filter((_, i) => i !== index))}><X size={16} color="#B54745" /></Pressable>}</View>
      <Pressable disabled={busyIndex === index} onPress={() => setPickLine(index)} style={styles.choiceField}><Text numberOfLines={1} style={[styles.choiceFieldText, !line.product && styles.placeholderText]}>{busyIndex === index ? 'Đang tải biến thể…' : line.product ? `${line.product.name} · ${line.variant?.sku}` : 'Chọn sản phẩm và SKU'}</Text><ChevronDown size={15} color={colors.muted} /></Pressable>
      <View style={styles.twoColumns}><View style={{ flex: 1 }}><Field label="Số lượng" value={line.quantity} onChangeText={(quantity) => { const next = [...lines]; next[index] = { ...next[index], quantity }; onChange(next); }} keyboardType="decimal-pad" /></View><View style={{ flex: 1 }}><Field label={amountLabel} value={line.amount} onChangeText={(amount) => { const next = [...lines]; next[index] = { ...next[index], amount }; onChange(next); }} keyboardType="decimal-pad" placeholder={amountPlaceholder} /></View></View>
      {(line.variant?.trackingMode === 'serial' || line.variant?.trackingMode === 'unit_barcode') && <Field label="Serial / mã đơn vị (mỗi dòng một mã)" value={line.identifiers ?? ''} onChangeText={(identifiers) => { const next = [...lines]; next[index] = { ...next[index], identifiers }; onChange(next); }} multiline placeholder="SN001\nSN002" />}
    </View>)}
    <Modal visible={pickLine !== null} transparent animationType="fade" onRequestClose={() => setPickLine(null)}><Pressable style={styles.pickerBackdrop} onPress={() => setPickLine(null)}><Pressable style={styles.pickerSheet} onPress={() => {}}><Text style={styles.pickerTitle}>Chọn sản phẩm</Text><ScrollView style={{ maxHeight: 390 }}>{products.map((product) => <Pressable key={product._id} onPress={() => pickLine !== null && void choose(pickLine, product)} style={styles.productPickerRow}><View style={{ flex: 1 }}><Text style={styles.productPickerName}>{product.name}</Text><Text style={styles.productPickerMeta}>{product.productCode} · {product.categoryCode}</Text></View><ChevronRight size={15} color={colors.muted} /></Pressable>)}</ScrollView></Pressable></Pressable></Modal>
  </View>;
}
function ResourceManagerSheet({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const [kind, setKind] = useState<ResourceKind>('categories'); const [code, setCode] = useState(''); const [name, setName] = useState(''); const [saving, setSaving] = useState(false); const [items, setItems] = useState<ProductResource[]>([]); const [editingId, setEditingId] = useState('');
  const load = useCallback(async () => { try { setItems(await inventoryApi.listResources(kind)); } catch (error) { reportError(error); } }, [kind]);
  useEffect(() => { if (visible) void load(); }, [visible, load]);
  const resetForm = () => { setEditingId(''); setCode(''); setName(''); };
  const save = async () => { if (!code.trim() || !name.trim()) { Alert.alert('Thiếu thông tin', 'Nhập mã và tên danh mục.'); return; } setSaving(true); try { if (editingId) await inventoryApi.updateResource(kind, editingId, { code: code.trim().toUpperCase(), name: name.trim(), status: 'active' }); else await inventoryApi.createResource(kind, { code: code.trim().toUpperCase(), name: name.trim() }); resetForm(); await load(); onSaved(); } catch (error) { reportError(error); } finally { setSaving(false); } };
  const deactivate = () => { if (!editingId) return; Alert.alert('Ngừng sử dụng danh mục?', 'Sản phẩm hiện tại vẫn giữ mã danh mục đã lưu.', [{ text: 'Quay lại', style: 'cancel' }, { text: 'Ngừng sử dụng', style: 'destructive', onPress: () => void inventoryApi.updateResource(kind, editingId, { status: 'inactive' }).then(() => { resetForm(); return load(); }).then(onSaved).catch(reportError) }]); };
  return <Sheet visible={visible} title="Quản lý danh mục" subtitle="Nhóm sản phẩm, thương hiệu và đơn vị tính" onClose={onClose}>
    <View style={styles.choiceRow}>{(['categories', 'brands', 'units'] as ResourceKind[]).map((value) => <Pressable key={value} onPress={() => { setKind(value); resetForm(); }} style={[styles.choiceChip, kind === value && styles.choiceChipActive]}><Text style={[styles.choiceChipText, kind === value && styles.choiceChipTextActive]}>{value === 'categories' ? 'Danh mục' : value === 'brands' ? 'Thương hiệu' : 'Đơn vị'}</Text></Pressable>)}</View>
    <SectionLabel>{editingId ? 'Sửa mục đã chọn' : 'Mục đang hoạt động'}</SectionLabel>
    <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>{items.map((item) => <Pressable key={item._id} onPress={() => { setEditingId(item._id); setCode(item.code); setName(item.name); }} style={[styles.resourceRow, editingId === item._id && styles.pickerOptionSelected]}><View style={{ flex: 1 }}><Text style={styles.productName}>{item.name}</Text><Text style={styles.productMeta}>{item.code}</Text></View><ChevronRight size={15} color={colors.muted} /></Pressable>)}</ScrollView>
    <Field label="Mã" value={code} onChangeText={setCode} placeholder="VD: DIEN-01" />
    <Field label="Tên" value={name} onChangeText={setName} placeholder="Tên hiển thị" />
    <View style={styles.recordActions}><ActionButton label={saving ? 'Đang lưu…' : editingId ? 'Lưu thay đổi' : 'Tạo danh mục'} onPress={() => void save()} disabled={saving} />{editingId && <ActionButton label="Ngừng dùng" onPress={deactivate} kind="danger" />}{editingId && <ActionButton label="Mục mới" onPress={resetForm} icon={Plus} kind="secondary" />}</View>
  </Sheet>;
}

function ProductVariantsSheet({ visible, product, units, branchId, canManage, onClose, onSaved }: { visible: boolean; product?: CatalogProduct | null; units: ProductResource[]; branchId?: string; canManage: boolean; onClose: () => void; onSaved: () => void }) {
  const [variants, setVariants] = useState<ProductVariant[]>([]); const [prices, setPrices] = useState<Record<string, { sellingPrice: number; costPrice?: number }>>({}); const [detailsVariant, setDetailsVariant] = useState<ProductVariant | null>(null); const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null); const [editorOpen, setEditorOpen] = useState(false); const [deleteVariant, setDeleteVariant] = useState<ProductVariant | null>(null); const [loading, setLoading] = useState(true); const [deleting, setDeleting] = useState(false);
  const load = useCallback(async () => { if (!product) return; setLoading(true); try { const [detail, priceList] = await Promise.all([inventoryApi.getProduct(product._id), inventoryApi.listPrices(branchId, product._id)]); setVariants(detail.variants ?? []); setPrices(Object.fromEntries(priceList.map((price) => [price.variantId, { sellingPrice: price.sellingPrice, costPrice: price.costPrice }]))); } catch (error) { reportError(error); } finally { setLoading(false); } }, [product?._id, branchId]);
  useEffect(() => { if (visible) void load(); else { setDetailsVariant(null); setEditingVariant(null); setEditorOpen(false); setDeleteVariant(null); } }, [visible, load]);
  const saveComplete = () => { void load().then(onSaved); };
  const deleteSelectedVariant = async () => { if (!deleteVariant) return; setDeleting(true); try { await inventoryApi.deleteVariants([deleteVariant._id]); setDeleteVariant(null); await load(); onSaved(); } catch (error) { reportError(error); } finally { setDeleting(false); } };
  const closeAll = () => { setDetailsVariant(null); setEditingVariant(null); setEditorOpen(false); setDeleteVariant(null); onClose(); };
  return <>
    <Sheet visible={visible && !detailsVariant && !editorOpen && !deleteVariant} title="Biến thể và SKU" subtitle={product?.name} onClose={closeAll}>
      {canManage && <ActionButton label="Thêm biến thể / SKU" onPress={() => { setEditingVariant(null); setEditorOpen(true); }} icon={Plus} kind="secondary" />}
      {loading ? <LoadingState /> : !variants.length ? <EmptyState title="Chưa có biến thể" copy="Thêm SKU đầu tiên cho sản phẩm này." /> : variants.map((variant) => <Card key={variant._id} style={styles.variantCard}>
        <View style={styles.variantCardHeader}><View style={styles.variantCardCopy}><Text style={styles.variantName}>{variant.displayName || 'Biến thể mặc định'}</Text><Text style={styles.productMeta}>{variant.optionValues?.map((option) => `${option.code}: ${option.value}`).join(' · ') || 'Thông tin biến thể'}</Text></View><StatusPill value={variant.status === 'active' ? 'Đang dùng' : variant.status === 'inactive' ? 'Ngừng dùng' : 'Dừng kinh doanh'} tone={variant.status === 'active' ? 'green' : 'yellow'} /></View>
        <View style={styles.variantSkuRow}><Text style={styles.variantSkuLabel}>SKU</Text><Text selectable style={styles.variantSku}>{variant.sku}</Text></View>
        <View style={styles.variantInfoGrid}><View style={styles.variantInfoCell}><Text style={styles.variantInfoLabel}>MÃ VẠCH</Text><Text style={styles.variantInfoValue}>{variant.barcode || 'Chưa có'}</Text></View><View style={styles.variantInfoCell}><Text style={styles.variantInfoLabel}>ĐƠN VỊ</Text><Text style={styles.variantInfoValue}>{variant.unitCode || '—'}</Text></View><View style={styles.variantInfoCell}><Text style={styles.variantInfoLabel}>THEO DÕI TỒN</Text><Text style={styles.variantInfoValue}>{variant.trackingMode === 'serial' ? 'IMEI / Serial' : variant.trackingMode === 'unit_barcode' ? 'Mã từng đơn vị' : variant.trackingMode === 'lot' ? 'Theo lô' : variant.trackingMode === 'none' ? 'Không theo dõi' : 'Theo số lượng'}</Text></View></View>
        <View style={styles.variantPriceRow}><View><Text style={styles.variantInfoLabel}>GIÁ BÁN</Text><Text style={styles.variantSalePrice}>{money(prices[variant._id]?.sellingPrice ?? 0)}</Text></View><View><Text style={styles.variantInfoLabel}>GIÁ VỐN</Text><Text style={styles.variantInfoValue}>{money(prices[variant._id]?.costPrice ?? 0)}</Text></View></View>
        <View style={styles.variantActions}><Pressable accessibilityRole="button" onPress={() => setDetailsVariant(variant)} style={styles.variantActionButton}><Eye size={14} color={colors.primary} /><Text style={styles.variantActionText}>Chi tiết</Text></Pressable>{canManage && <Pressable accessibilityRole="button" onPress={() => { setEditingVariant(variant); setEditorOpen(true); }} style={styles.variantActionButton}><Pencil size={14} color={colors.primary} /><Text style={styles.variantActionText}>Sửa</Text></Pressable>}{canManage && <Pressable accessibilityRole="button" onPress={() => setDeleteVariant(variant)} style={styles.variantActionDanger}><Trash2 size={14} color="#B54745" /><Text style={styles.variantActionDangerText}>Xóa</Text></Pressable>}</View>
      </Card>)}
    </Sheet>
    <VariantDetailsSheet visible={visible && Boolean(detailsVariant)} productName={product?.name} variant={detailsVariant} price={detailsVariant ? prices[detailsVariant._id] : undefined} onClose={() => setDetailsVariant(null)} onEdit={canManage ? () => { setEditingVariant(detailsVariant); setDetailsVariant(null); setEditorOpen(true); } : undefined} />
    <VariantEditorSheet visible={visible && editorOpen} product={product} variant={editingVariant} units={units} branchId={branchId} onClose={() => { setEditorOpen(false); setEditingVariant(null); }} onSaved={saveComplete} />
    <Sheet visible={visible && Boolean(deleteVariant)} title="Xóa SKU?" subtitle={product?.name} onClose={() => !deleting && setDeleteVariant(null)}>
      <View style={styles.deleteSkuNotice}><Trash2 size={18} color="#B54745" /><Text style={styles.deleteSkuText}>SKU {deleteVariant?.sku} chỉ xóa được khi chưa có tồn kho hoặc lịch sử giao dịch và sản phẩm còn SKU khác. Thao tác này không thể hoàn tác.</Text></View>
      <View style={styles.filterFooter}><Pressable onPress={() => setDeleteVariant(null)} style={styles.clearFilterButton} disabled={deleting}><Text style={styles.clearFilterText}>Hủy</Text></Pressable><Pressable onPress={() => void deleteSelectedVariant()} style={styles.deleteSkuButton} disabled={deleting}><Trash2 size={15} color={colors.white} /><Text style={styles.deleteSkuButtonText}>{deleting ? 'Đang xóa…' : 'Xóa SKU'}</Text></Pressable></View>
    </Sheet>
  </>;
}

function VariantDetailsSheet({ visible, productName, variant, price, onClose, onEdit }: { visible: boolean; productName?: string; variant?: ProductVariant | null; price?: { sellingPrice: number; costPrice?: number }; onClose: () => void; onEdit?: () => void }) {
  if (!variant) return null;
  const rows = [{ label: 'Tên biến thể', value: variant.displayName || 'Biến thể mặc định' }, { label: 'Mã SKU', value: variant.sku }, { label: 'Mã vạch', value: variant.barcode || 'Chưa có' }, { label: 'Đơn vị tính', value: variant.unitCode || '—' }, { label: 'Theo dõi tồn', value: variant.trackingMode === 'serial' ? 'IMEI / Serial' : variant.trackingMode === 'unit_barcode' ? 'Mã từng đơn vị' : variant.trackingMode === 'lot' ? 'Theo lô' : variant.trackingMode === 'none' ? 'Không theo dõi' : 'Theo số lượng' }, { label: 'Giá bán', value: money(price?.sellingPrice ?? 0) }, { label: 'Giá vốn', value: money(price?.costPrice ?? 0) }, { label: 'Trạng thái', value: variant.status === 'active' ? 'Đang dùng' : variant.status === 'inactive' ? 'Ngừng dùng' : 'Dừng kinh doanh' }];
  return <Sheet visible={visible} title="Chi tiết SKU" subtitle={productName} onClose={onClose}>
    <View style={styles.variantDetailList}>{rows.map((row) => <View key={row.label} style={styles.variantDetailRow}><Text style={styles.variantInfoLabel}>{row.label}</Text><Text selectable style={styles.variantDetailValue}>{row.value}</Text></View>)}{variant.optionValues?.length ? <View style={styles.variantDetailRow}><Text style={styles.variantInfoLabel}>Thuộc tính</Text><Text style={styles.variantDetailValue}>{variant.optionValues.map((option) => `${option.code}: ${option.value}`).join(' · ')}</Text></View> : null}</View>
    {onEdit && <ActionButton label="Sửa SKU" onPress={onEdit} icon={Pencil} />}
  </Sheet>;
}

function VariantEditorSheet({ visible, product, variant, units, branchId, onClose, onSaved }: { visible: boolean; product?: CatalogProduct | null; variant?: ProductVariant | null; units: ProductResource[]; branchId?: string; onClose: () => void; onSaved: () => void }) {
  const [sku, setSku] = useState(''); const [barcode, setBarcode] = useState(''); const [displayName, setDisplayName] = useState(''); const [unitCode, setUnitCode] = useState(''); const [trackingMode, setTrackingMode] = useState<TrackingMode>('quantity'); const [variantStatus, setVariantStatus] = useState<'active' | 'inactive' | 'discontinued'>('active'); const [sellingPrice, setSellingPrice] = useState(''); const [costPrice, setCostPrice] = useState(''); const [saving, setSaving] = useState(false);
  useEffect(() => { if (!visible) return; setSku(variant?.sku ?? ''); setBarcode(variant?.barcode ?? ''); setDisplayName(variant?.displayName ?? ''); setUnitCode(variant?.unitCode ?? product?.baseUnitCode ?? units[0]?.code ?? ''); setTrackingMode(variant?.trackingMode ?? 'quantity'); setVariantStatus(variant?.status ?? 'active'); setSellingPrice(''); setCostPrice(''); if (variant && product) void inventoryApi.listPrices(branchId, product._id).then((prices) => { const price = prices.find((item) => item.variantId === variant._id); setSellingPrice(String(price?.sellingPrice ?? '')); setCostPrice(String(price?.costPrice ?? '')); }).catch(reportError); }, [visible, product?._id, variant?._id, branchId, units]);
  const save = async () => { if (!product || !sku.trim() || !unitCode) { Alert.alert('Thiếu thông tin', 'SKU và đơn vị tính là bắt buộc.'); return; } setSaving(true); try { const savedVariant = variant ? await inventoryApi.updateVariant(variant._id, { barcode: barcode.trim() || undefined, displayName: displayName.trim() || undefined, unitCode, trackingMode, status: variantStatus }) : await inventoryApi.createVariant(product._id, { sku: sku.trim(), barcode: barcode.trim() || undefined, displayName: displayName.trim() || undefined, unitCode, trackingMode, status: 'active' }); await inventoryApi.upsertPrice(savedVariant._id, branchId, Math.round(number(sellingPrice)), Math.round(number(costPrice))); onSaved(); onClose(); } catch (error) { reportError(error); } finally { setSaving(false); } };
  return <Sheet visible={visible} title={variant ? 'Sửa biến thể / SKU' : 'Thêm biến thể / SKU'} subtitle={product?.name} onClose={onClose}>
    <Field label="Tên biến thể" value={displayName} onChangeText={setDisplayName} placeholder="Ví dụ: Màu đen, 128GB" />
    <Field label="SKU *" value={sku} onChangeText={setSku} editable={!variant} />
    <Field label="Mã vạch" value={barcode} onChangeText={setBarcode} />
    <ChoiceField label="Đơn vị tính" value={unitCode} options={units.map((item) => ({ value: item.code, label: item.name }))} onChange={setUnitCode} />
    <ChoiceField label="Theo dõi tồn" value={trackingMode} options={[{ value: 'quantity', label: 'Theo số lượng' }, { value: 'serial', label: 'IMEI / Serial' }, { value: 'unit_barcode', label: 'Mã từng đơn vị' }, { value: 'lot', label: 'Theo lô' }, { value: 'none', label: 'Không theo dõi' }]} onChange={(value) => setTrackingMode(value as TrackingMode)} />
    {variant && <ChoiceField label="Trạng thái" value={variantStatus} options={[{ value: 'active', label: 'Đang bán' }, { value: 'inactive', label: 'Ngừng' }, { value: 'discontinued', label: 'Dừng kinh doanh' }]} onChange={(value) => setVariantStatus(value as typeof variantStatus)} />}
    <View style={styles.twoColumns}><View style={{ flex: 1 }}><Field label="Giá bán" value={sellingPrice} onChangeText={setSellingPrice} keyboardType="decimal-pad" /></View><View style={{ flex: 1 }}><Field label="Giá vốn" value={costPrice} onChangeText={setCostPrice} keyboardType="decimal-pad" /></View></View>
    <ActionButton label={saving ? 'Đang lưu…' : variant ? 'Lưu SKU' : 'Thêm SKU'} onPress={() => void save()} disabled={saving} icon={variant ? Check : Plus} />
  </Sheet>;
}

function ProductEditorSheet({ visible, product, categories, brands, units, branchId, onClose, onSaved }: { visible: boolean; product?: CatalogProduct | null; categories: ProductResource[]; brands: ProductResource[]; units: ProductResource[]; branchId?: string; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(''); const [productCode, setProductCode] = useState(''); const [productType, setProductType] = useState<'physical' | 'service' | 'bundle'>('physical');
  const [categoryCode, setCategoryCode] = useState(''); const [brandCode, setBrandCode] = useState(''); const [baseUnitCode, setBaseUnitCode] = useState(''); const [shortDescription, setShortDescription] = useState(''); const [sku, setSku] = useState(''); const [barcode, setBarcode] = useState(''); const [trackingMode, setTrackingMode] = useState<TrackingMode>('quantity'); const [sellingPrice, setSellingPrice] = useState(''); const [costPrice, setCostPrice] = useState('');
  const [variant, setVariant] = useState<ProductVariant | undefined>(); const [loading, setLoading] = useState(false); const [saving, setSaving] = useState(false);
  useEffect(() => { if (!visible) return; let current = true; setVariant(undefined); setName(product?.name ?? ''); setProductCode(product?.productCode ?? ''); setProductType(product?.productType ?? 'physical'); setCategoryCode(product?.categoryCode ?? categories[0]?.code ?? ''); setBrandCode(product?.brandCode ?? ''); setBaseUnitCode(product?.baseUnitCode ?? units[0]?.code ?? ''); setShortDescription(product?.shortDescription ?? ''); setSku(''); setBarcode(''); setSellingPrice(''); setCostPrice(''); setTrackingMode('quantity');
    if (product) { setLoading(true); void Promise.all([inventoryApi.getProduct(product._id), inventoryApi.listPrices(branchId, product._id)]).then(([detail, prices]) => { if (!current) return; const first = detail.variants?.[0]; setVariant(first); setSku(first?.sku ?? ''); setBarcode(first?.barcode ?? ''); setTrackingMode(first?.trackingMode ?? 'quantity'); const price = prices.find((item) => item.variantId === first?._id); setSellingPrice(price?.sellingPrice ? String(price.sellingPrice) : ''); setCostPrice(price?.costPrice ? String(price.costPrice) : ''); }).catch(reportError).finally(() => current && setLoading(false)); }
    return () => { current = false; };
  }, [visible, product?._id]);
  const save = async () => {
    if (!name.trim() || !categoryCode || !baseUnitCode || !sku.trim()) { Alert.alert('Thiếu thông tin', 'Tên, danh mục, đơn vị tính và SKU là bắt buộc.'); return; }
    setSaving(true);
    try {
      const selling = Math.round(number(sellingPrice)); const cost = Math.round(number(costPrice));
      if (product) {
        await inventoryApi.updateProduct(product._id, { name: name.trim(), productCode: productCode.trim() || product.productCode, productType, categoryCode, brandCode: brandCode || null, baseUnitCode, shortDescription: shortDescription.trim(), status: product.status });
        if (variant) {
          await inventoryApi.updateVariant(variant._id, { barcode: barcode.trim() || undefined, unitCode: baseUnitCode, trackingMode, status: variant.status });
          await inventoryApi.upsertPrice(variant._id, branchId, selling, cost);
        } else {
          const createdVariant = await inventoryApi.createVariant(product._id, { sku: sku.trim(), barcode: barcode.trim() || undefined, unitCode: baseUnitCode, trackingMode, status: 'active' });
          await inventoryApi.upsertPrice(createdVariant._id, branchId, selling, cost);
        }
      } else {
        const created = await inventoryApi.createProduct({ productCode: productCode.trim() || undefined, name: name.trim(), productType, categoryCode, brandCode: brandCode || undefined, baseUnitCode, shortDescription: shortDescription.trim(), status: 'active', variant: { sku: sku.trim(), barcode: barcode.trim() || undefined, unitCode: baseUnitCode, trackingMode, status: 'active' }, sellingPrice: selling, costPrice: cost }, branchId);
        const createdDetail = await inventoryApi.getProduct(created._id);
        const createdVariant = createdDetail.variants?.[0];
        if (createdVariant) await inventoryApi.upsertPrice(createdVariant._id, branchId, selling, cost);
      }
      onSaved(); onClose();
    } catch (error) { reportError(error); } finally { setSaving(false); }
  };
  return <Sheet visible={visible} title={product ? 'Sửa sản phẩm' : 'Tạo sản phẩm'} subtitle="Thông tin catalog, SKU và giá theo chi nhánh" onClose={onClose}>
    {loading ? <LoadingState /> : <>
      <Field label="Tên sản phẩm *" value={name} onChangeText={setName} placeholder="VD: Máy lọc nước" />
      <Field label="Mã sản phẩm" value={productCode} onChangeText={setProductCode} placeholder="Tự sinh nếu để trống" />
      <ChoiceField label="Loại sản phẩm" value={productType} options={[{ value: 'physical', label: 'Hàng hóa' }, { value: 'service', label: 'Dịch vụ' }, { value: 'bundle', label: 'Combo' }]} onChange={(value) => setProductType(value as typeof productType)} />
      <ChoiceField label="Danh mục *" value={categoryCode} options={categories.map((item) => ({ value: item.code, label: item.name }))} onChange={setCategoryCode} placeholder="Chọn danh mục" />
      <ChoiceField label="Thương hiệu" value={brandCode} options={[{ value: '', label: 'Không chọn' }, ...brands.map((item) => ({ value: item.code, label: item.name }))]} onChange={setBrandCode} placeholder="Chọn thương hiệu" />
      <ChoiceField label="Đơn vị tính *" value={baseUnitCode} options={units.map((item) => ({ value: item.code, label: item.symbol ? `${item.name} (${item.symbol})` : item.name }))} onChange={setBaseUnitCode} placeholder="Chọn đơn vị" />
      <Field label="Mô tả ngắn" value={shortDescription} onChangeText={setShortDescription} multiline />
      <SectionLabel>{product ? 'Biến thể chính' : 'SKU đầu tiên'}</SectionLabel>
      {variant && <Field label="Biến thể" value={variant.displayName || variant.sku} editable={false} />}
      <Field label="SKU *" value={sku} onChangeText={setSku} placeholder="Mã SKU" editable={!variant} />
      <Field label="Mã vạch" value={barcode} onChangeText={setBarcode} placeholder="Barcode" />
      <ChoiceField label="Theo dõi tồn" value={trackingMode} options={[{ value: 'quantity', label: 'Theo số lượng' }, { value: 'serial', label: 'IMEI / Serial' }, { value: 'unit_barcode', label: 'Mã vạch từng đơn vị' }, { value: 'lot', label: 'Theo lô' }, { value: 'none', label: 'Không theo dõi' }]} onChange={(value) => setTrackingMode(value as TrackingMode)} />
      <View style={styles.twoColumns}><View style={{ flex: 1 }}><Field label="Giá bán" value={sellingPrice} onChangeText={setSellingPrice} keyboardType="decimal-pad" placeholder="0" /></View><View style={{ flex: 1 }}><Field label="Giá vốn" value={costPrice} onChangeText={setCostPrice} keyboardType="decimal-pad" placeholder="0" /></View></View>
      <ActionButton label={saving ? 'Đang lưu…' : product ? 'Lưu thay đổi' : 'Tạo sản phẩm'} onPress={() => void save()} disabled={saving} />
    </>}
  </Sheet>;
}

export function InventoryProductsPanel({ branchId, canManage }: ProductProps) {
  const [items, setItems] = useState<CatalogProduct[]>([]); const [total, setTotal] = useState(0); const [page, setPage] = useState(1); const [search, setSearch] = useState(''); const [status, setStatus] = useState(''); const [productType, setProductType] = useState(''); const [categoryCode, setCategoryCode] = useState(''); const [brandCode, setBrandCode] = useState(''); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState('');
  const [categories, setCategories] = useState<ProductResource[]>([]); const [brands, setBrands] = useState<ProductResource[]>([]); const [units, setUnits] = useState<ProductResource[]>([]); const [editorOpen, setEditorOpen] = useState(false); const [editing, setEditing] = useState<CatalogProduct | null>(null); const [resourcesOpen, setResourcesOpen] = useState(false); const [variantProduct, setVariantProduct] = useState<CatalogProduct | null>(null); const [filterOpen, setFilterOpen] = useState(false);
  const [draftStatus, setDraftStatus] = useState(''); const [draftType, setDraftType] = useState(''); const [draftCategory, setDraftCategory] = useState(''); const [draftBrand, setDraftBrand] = useState('');
  const loadResources = useCallback(async () => { const [c, b, u] = await Promise.all([inventoryApi.listResources('categories'), inventoryApi.listResources('brands'), inventoryApi.listResources('units')]); setCategories(c); setBrands(b); setUnits(u); }, []);
  const load = useCallback(async (reset = true) => { setError(''); if (reset) setLoading(true); else setRefreshing(true); try { const result = await inventoryApi.listProducts({ q: search || undefined, status: status || undefined, productType: productType || undefined, categoryCode: categoryCode || undefined, brandCode: brandCode || undefined, branchId, page: 1, limit: 50 }); setItems(result.items ?? []); setTotal(result.total ?? 0); setPage(1); } catch (err) { setError(errorText(err)); } finally { setLoading(false); setRefreshing(false); } }, [branchId, search, status, productType, categoryCode, brandCode]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadResources().catch(() => {}); }, [loadResources]);
  const loadMore = async () => { if (items.length >= total) return; setRefreshing(true); try { const next = page + 1; const result = await inventoryApi.listProducts({ q: search || undefined, status: status || undefined, productType: productType || undefined, categoryCode: categoryCode || undefined, brandCode: brandCode || undefined, branchId, page: next, limit: 50 }); setItems((current) => [...current, ...(result.items ?? [])]); setPage(next); } catch (err) { reportError(err); } finally { setRefreshing(false); } };
  const changeStatus = (product: CatalogProduct) => Alert.alert('Ngừng kinh doanh sản phẩm?', `${product.name} sẽ không còn xuất hiện trong danh mục hoạt động.`, [{ text: 'Hủy', style: 'cancel' }, { text: 'Ngừng bán', style: 'destructive', onPress: () => void inventoryApi.updateProduct(product._id, { status: 'inactive' }).then(() => load()).catch(reportError) }]);
  const filterOptions = [{ label: 'Tất cả', value: '' }, { label: 'Đang bán', value: 'active' }, { label: 'Bản nháp', value: 'draft' }, { label: 'Ngừng bán', value: 'inactive' }];
  const typeOptions = [{ value: '', label: 'Mọi loại' }, { value: 'physical', label: 'Hàng hóa' }, { value: 'service', label: 'Dịch vụ' }, { value: 'bundle', label: 'Combo' }];
  const activeFilterCount = [status, productType, categoryCode, brandCode].filter(Boolean).length;
  const openFilters = () => { setDraftStatus(status); setDraftType(productType); setDraftCategory(categoryCode); setDraftBrand(brandCode); setFilterOpen(true); };
  const applyFilters = () => { setStatus(draftStatus); setProductType(draftType); setCategoryCode(draftCategory); setBrandCode(draftBrand); setFilterOpen(false); };
  const clearFilters = () => { setDraftStatus(''); setDraftType(''); setDraftCategory(''); setDraftBrand(''); setStatus(''); setProductType(''); setCategoryCode(''); setBrandCode(''); setFilterOpen(false); };
  return <View style={styles.panel}>
    <PageHeading title="Danh mục sản phẩm" subtitle={`${total.toLocaleString('vi-VN')} sản phẩm`} action={canManage ? () => { setEditing(null); setEditorOpen(true); } : undefined} actionLabel={canManage ? 'Tạo mới' : undefined} />
    <SearchFilterBar value={search} onChangeText={setSearch} placeholder="Tên, mã sản phẩm, SKU" filterCount={activeFilterCount} onOpenFilters={openFilters} />
    <Sheet visible={filterOpen} title="Lọc sản phẩm" subtitle="Chọn tiêu chí rồi áp dụng để cập nhật danh sách" onClose={() => setFilterOpen(false)}>
      <SectionLabel>Trạng thái</SectionLabel>
      <View style={styles.filterChoices}>{filterOptions.map((option) => <Pressable key={option.value} onPress={() => setDraftStatus(option.value)} style={[styles.filterChoice, draftStatus === option.value && styles.filterChoiceSelected]}><Text style={[styles.filterChoiceText, draftStatus === option.value && styles.filterChoiceTextSelected]}>{option.label}</Text></Pressable>)}</View>
      <SectionLabel>Loại sản phẩm</SectionLabel>
      <View style={styles.filterChoices}>{typeOptions.map((option) => <Pressable key={option.value} onPress={() => setDraftType(option.value)} style={[styles.filterChoice, draftType === option.value && styles.filterChoiceSelected]}><Text style={[styles.filterChoiceText, draftType === option.value && styles.filterChoiceTextSelected]}>{option.label}</Text></Pressable>)}</View>
      {categories.length > 0 && <ChoiceField label="Danh mục" value={draftCategory} options={[{ value: '', label: 'Tất cả danh mục' }, ...categories.map((item) => ({ value: item.code, label: item.name }))]} onChange={setDraftCategory} />}
      {brands.length > 0 && <ChoiceField label="Thương hiệu" value={draftBrand} options={[{ value: '', label: 'Tất cả thương hiệu' }, ...brands.map((item) => ({ value: item.code, label: item.name }))]} onChange={setDraftBrand} />}
      {canManage && <ActionButton label="Quản lý danh mục sản phẩm" onPress={() => { setFilterOpen(false); setResourcesOpen(true); }} icon={Settings2} kind="secondary" />}
      <View style={styles.filterFooter}><Pressable onPress={clearFilters} style={styles.clearFilterButton}><Text style={styles.clearFilterText}>Xóa bộ lọc</Text></Pressable><Pressable onPress={applyFilters} style={styles.applyFilterButton}><Check size={15} color={colors.white} /><Text style={styles.applyFilterText}>Áp dụng</Text></Pressable></View>
    </Sheet>
    {error ? <Pressable onPress={() => void load()} style={styles.errorBanner}><CircleAlert size={15} color="#B54745" /><Text style={styles.errorBannerText}>{error}</Text><Text style={styles.linkText}>Tải lại</Text></Pressable> : null}
    {loading ? <LoadingState /> : <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(false)} tintColor={colors.primary} />} contentContainerStyle={styles.listContent}>
      {!items.length ? <EmptyState title="Chưa có sản phẩm" copy="Tạo sản phẩm hoặc kiểm tra bộ lọc đang chọn." /> : items.map((product) => <Card key={product._id} style={styles.productCard}>
        <View style={styles.productCardTop}><View style={styles.productGlyph}><Package size={17} color={colors.primary} /></View><View style={styles.productCardCopy}><Text style={styles.productName}>{product.name}</Text><Text style={styles.productMeta}>{product.productCode || 'Chưa có mã'} · {product.categoryCode || 'Chưa phân loại'}</Text></View><StatusPill value={product.status === 'active' ? 'Đang bán' : product.status === 'draft' ? 'Bản nháp' : product.status === 'archived' ? 'Đã lưu trữ' : 'Ngừng bán'} tone={product.status === 'active' ? 'green' : product.status === 'draft' ? 'yellow' : 'red'} /></View>
        <View style={styles.productDetailsRow}><Text style={styles.productDetailText}>{product.productType === 'service' ? 'Dịch vụ' : product.productType === 'bundle' ? 'Combo' : 'Hàng hóa'}</Text><Text style={styles.dot}>·</Text><Text style={styles.productDetailText}>ĐVT {product.baseUnitCode || '—'}</Text><Text style={styles.dot}>·</Text><Text style={styles.productDetailText}>Thương hiệu {product.brandCode || '—'}</Text></View>
        <View style={styles.productActions}>{canManage && <Pressable style={styles.smallAction} onPress={() => { setEditing(product); setEditorOpen(true); }}><Text style={styles.smallActionText}>Sửa</Text></Pressable>}{canManage && <Pressable style={styles.smallAction} onPress={() => setVariantProduct(product)}><Text style={styles.smallActionText}>Biến thể / SKU</Text></Pressable>}{canManage && product.status === 'active' && <Pressable style={styles.smallActionDanger} onPress={() => changeStatus(product)}><Text style={styles.smallActionDangerText}>Ngừng bán</Text></Pressable>}</View>
      </Card>)}
      {items.length < total && <ActionButton label={refreshing ? 'Đang tải…' : `Tải thêm 50 (${items.length}/${total})`} onPress={() => void loadMore()} icon={ChevronDown} kind="secondary" disabled={refreshing} />}
    </ScrollView>}
    <ProductEditorSheet visible={editorOpen} product={editing} categories={categories} brands={brands} units={units} branchId={branchId} onClose={() => setEditorOpen(false)} onSaved={() => { void load(); }} />
    <ProductVariantsSheet visible={Boolean(variantProduct)} product={variantProduct} units={units} branchId={branchId} canManage={canManage} onClose={() => setVariantProduct(null)} onSaved={() => { void load(); }} />
    <ResourceManagerSheet visible={resourcesOpen} onClose={() => setResourcesOpen(false)} onSaved={() => { void loadResources(); }} />
  </View>;
}

export function InventoryWarehousePanel({ branchId, canManage }: Props) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]); const [balances, setBalances] = useState<InventoryBalance[]>([]); const [warehouseId, setWarehouseId] = useState(''); const [search, setSearch] = useState(''); const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'zero'>('all'); const [draftStockFilter, setDraftStockFilter] = useState<'all' | 'low' | 'zero'>('all'); const [filterOpen, setFilterOpen] = useState(false); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [selected, setSelected] = useState<InventoryBalance | null>(null); const [minStock, setMinStock] = useState('0'); const [maxStock, setMaxStock] = useState(''); const [saving, setSaving] = useState(false);
  const load = useCallback(async () => { setLoading(true); try { if (!permissionBranch(branchId)) { setLoading(false); return; } const warehouseList = await inventoryApi.listWarehouses(branchId); setWarehouses(warehouseList); const chosen = warehouseId && warehouseList.some((item) => item._id === warehouseId) ? warehouseId : warehouseList.find((item) => item.isDefault)?._id ?? warehouseList[0]?._id ?? ''; setWarehouseId(chosen); setBalances(chosen ? await inventoryApi.listBalances(branchId, chosen, true) : []); } catch (error) { reportError(error); } finally { setLoading(false); setRefreshing(false); } }, [branchId, warehouseId]);
  useEffect(() => { void load(); }, [branchId]);
  const refresh = async () => { setRefreshing(true); try { const list = await inventoryApi.listBalances(branchId, warehouseId, true); setBalances(list); } catch (error) { reportError(error); } finally { setRefreshing(false); } };
  const selectWarehouse = async (id: string) => { setWarehouseId(id); setLoading(true); try { setBalances(await inventoryApi.listBalances(branchId, id, true)); } catch (error) { reportError(error); } finally { setLoading(false); } };
  const visibleBalances = useMemo(() => balances.filter((balance) => `${balance.productName} ${balance.variantName} ${balance.sku}`.toLowerCase().includes(search.toLowerCase())).filter((balance) => stockFilter === 'all' || (stockFilter === 'zero' ? balance.quantity === 0 : balance.minStock !== undefined && balance.quantity <= balance.minStock)), [balances, search, stockFilter]);
  const onHand = balances.reduce((sum, balance) => sum + (balance.quantity || 0), 0); const reserved = balances.reduce((sum, balance) => sum + (balance.reservedQuantity || 0), 0); const value = balances.reduce((sum, balance) => sum + balance.quantity * balance.averageCost, 0);
  const stockFilterOptions = [{ value: 'all', label: 'Tất cả' }, { value: 'low', label: 'Dưới ngưỡng' }, { value: 'zero', label: 'Hết hàng' }];
  const openStockFilters = () => { setDraftStockFilter(stockFilter); setFilterOpen(true); };
  const saveThreshold = async () => { if (!selected) return; setSaving(true); try { await inventoryApi.updateThresholds(selected._id, { minStock: number(minStock), maxStock: maxStock ? number(maxStock) : undefined }, branchId); setSelected(null); await refresh(); } catch (error) { reportError(error); } finally { setSaving(false); } };
  return <View style={styles.panel}>
    <PageHeading title="Tồn kho theo kho" subtitle={`${warehouses.length} kho hoạt động`} icon={Settings2} />
    {warehouses.length > 1 && <ChoiceField label="Kho đang xem" value={warehouseId} options={warehouses.map((item) => ({ value: item._id, label: `${item.name}${item.isDefault ? ' · Mặc định' : ''}` }))} onChange={(id) => void selectWarehouse(id)} />}
    <View style={styles.metricsRow}><MetricCard label="Tồn thực tế" value={onHand.toLocaleString('vi-VN')} /><MetricCard label="Đang giữ" value={reserved.toLocaleString('vi-VN')} /><MetricCard label="Giá trị tồn" value={money(value)} compact /></View>
    <SearchFilterBar value={search} onChangeText={setSearch} placeholder="Tìm theo sản phẩm hoặc SKU" filterCount={stockFilter === 'all' ? 0 : 1} onOpenFilters={openStockFilters} />
    <Sheet visible={filterOpen} title="Lọc tồn kho" subtitle="Chọn nhóm hàng cần xem" onClose={() => setFilterOpen(false)}><FilterOptions options={stockFilterOptions} value={draftStockFilter} onChange={(value) => setDraftStockFilter(value as typeof stockFilter)} /><View style={styles.filterFooter}><Pressable onPress={() => { setDraftStockFilter('all'); setStockFilter('all'); setFilterOpen(false); }} style={styles.clearFilterButton}><Text style={styles.clearFilterText}>Xóa bộ lọc</Text></Pressable><Pressable onPress={() => { setStockFilter(draftStockFilter); setFilterOpen(false); }} style={styles.applyFilterButton}><Check size={15} color={colors.white} /><Text style={styles.applyFilterText}>Áp dụng</Text></Pressable></View></Sheet>
    {loading ? <LoadingState /> : <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />} contentContainerStyle={styles.listContent}>
      {!visibleBalances.length ? <EmptyState title="Kho chưa có mặt hàng" copy="Sản phẩm có theo dõi tồn sẽ xuất hiện tại đây." /> : visibleBalances.map((balance) => {
        const available = balance.quantity - balance.reservedQuantity; const low = balance.minStock !== undefined && balance.quantity <= balance.minStock;
        return <Card key={balance._id} style={styles.balanceCard}>
          <View style={styles.balanceTop}><View style={styles.productGlyph}><Package size={16} color={colors.primary} /></View><View style={styles.productCardCopy}><Text style={styles.productName}>{balance.productName || balance.sku}</Text><Text style={styles.productMeta}>{balance.variantName || balance.sku} · {balance.trackingMode || 'Theo số lượng'}</Text></View>{low && <StatusPill value="Sắp hết" tone="red" />}</View>
          <View style={styles.balanceStats}><View><Text style={styles.balanceLabel}>Tồn</Text><Text style={styles.balanceValue}>{balance.quantity.toLocaleString('vi-VN')}</Text></View><View><Text style={styles.balanceLabel}>Khả dụng</Text><Text style={[styles.balanceValue, available < 0 && { color: '#B54745' }]}>{available.toLocaleString('vi-VN')}</Text></View><View><Text style={styles.balanceLabel}>Giá trị</Text><Text style={styles.balanceValue}>{money(balance.quantity * balance.averageCost)}</Text></View></View>
          <View style={styles.balanceFooter}><Text style={styles.productMeta}>Tối thiểu {balance.minStock ?? 0}{balance.maxStock !== undefined ? ` · Tối đa ${balance.maxStock}` : ''}</Text>{canManage && <Pressable onPress={() => { setSelected(balance); setMinStock(String(balance.minStock ?? 0)); setMaxStock(balance.maxStock === undefined ? '' : String(balance.maxStock)); }}><Text style={styles.linkText}>Mức tồn</Text></Pressable>}</View>
        </Card>;
      })}
    </ScrollView>}
    <Sheet visible={Boolean(selected)} title="Ngưỡng cảnh báo tồn" subtitle={selected?.productName} onClose={() => setSelected(null)}><Field label="Tồn tối thiểu" value={minStock} onChangeText={setMinStock} keyboardType="decimal-pad" /><Field label="Tồn tối đa" value={maxStock} onChangeText={setMaxStock} keyboardType="decimal-pad" placeholder="Không giới hạn" /><ActionButton label={saving ? 'Đang lưu…' : 'Lưu ngưỡng'} onPress={() => void saveThreshold()} disabled={saving} /></Sheet>
  </View>;
}
function MetricCard({ label, value, compact }: { label: string; value: string; compact?: boolean }) { return <Card style={styles.metricCard}><Text style={styles.metricLabel}>{label}</Text><Text numberOfLines={1} style={[styles.metricValue, compact && styles.metricValueCompact]}>{value}</Text></Card>; }

export function InventoryReceivingPanel({ branchId, canManage }: Props) {
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]); const [suppliers, setSuppliers] = useState<Supplier[]>([]); const [warehouses, setWarehouses] = useState<Warehouse[]>([]); const [products, setProducts] = useState<CatalogProduct[]>([]); const [search, setSearch] = useState(''); const [status, setStatus] = useState(''); const [draftStatus, setDraftStatus] = useState(''); const [filterOpen, setFilterOpen] = useState(false); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [creating, setCreating] = useState(false); const [editingReceipt, setEditingReceipt] = useState<GoodsReceipt | null>(null); const [supplierId, setSupplierId] = useState(''); const [warehouseId, setWarehouseId] = useState(''); const [notes, setNotes] = useState(''); const [lines, setLines] = useState<DraftLine[]>([{ quantity: '1', amount: '', identifiers: '' }]); const [saving, setSaving] = useState(false); const [supplierFormOpen, setSupplierFormOpen] = useState(false); const [supplierEditingId, setSupplierEditingId] = useState(''); const [supplierName, setSupplierName] = useState(''); const [supplierPhone, setSupplierPhone] = useState(''); const [supplierEmail, setSupplierEmail] = useState(''); const [supplierTaxCode, setSupplierTaxCode] = useState('');
  const load = useCallback(async () => { if (!permissionBranch(branchId)) { setLoading(false); return; } setLoading(true); try { const [receiptPage, suppliersResult, warehouseResult, productPage] = await Promise.all([inventoryApi.listReceipts(branchId, { page: 1, limit: 50, status: status || undefined, q: search || undefined }), inventoryApi.listSuppliers(), inventoryApi.listWarehouses(branchId), inventoryApi.listProducts({ branchId, status: 'active', page: 1, limit: 50 })]); setReceipts(receiptPage.items ?? []); setSuppliers(suppliersResult ?? []); setWarehouses(warehouseResult ?? []); setProducts(productPage.items ?? []); setWarehouseId((current) => current && warehouseResult.some((warehouse) => warehouse._id === current) ? current : warehouseResult.find((warehouse) => warehouse.isDefault)?._id ?? warehouseResult[0]?._id ?? ''); } catch (error) { reportError(error); } finally { setLoading(false); setRefreshing(false); } }, [branchId, status, search]);
  useEffect(() => { void load(); }, [load]);
  const editReceipt = async (receipt: GoodsReceipt) => { setSaving(true); try { const drafts = await Promise.all((receipt.items || []).map(async (item) => { const base = products.find((product) => product._id === item.productId); const detail = base ? await inventoryApi.getProduct(base._id) : await inventoryApi.getProduct(item.productId); const selectedVariant = detail.variants?.find((entry) => entry._id === item.variantId) ?? detail.variants?.[0]; return { product: detail, variant: selectedVariant, quantity: String(item.quantity), amount: String(item.unitCost), identifiers: item.serialNumbers?.join('\n') ?? item.unitDetails?.map((unit) => unit.internalBarcode || unit.serialNumber || '').filter(Boolean).join('\n') ?? '' }; })); setEditingReceipt(receipt); setSupplierId(receipt.supplierId); setWarehouseId(receipt.warehouseId); setNotes(receipt.notes ?? ''); setLines(drafts); setCreating(true); } catch (error) { reportError(error); } finally { setSaving(false); } };
  const create = async () => { if (!permissionBranch(branchId)) return; if (!supplierId || !warehouseId || !lines.length || lines.some((line) => !line.product || !line.variant || number(line.quantity) <= 0)) { Alert.alert('Thiếu thông tin', 'Chọn nhà cung cấp, kho và sản phẩm có số lượng hợp lệ.'); return; } if (lines.some((line) => ['serial', 'unit_barcode'].includes(line.variant?.trackingMode || '') && line.identifiers?.split(/\r?\n|,/).filter((value) => value.trim()).length !== number(line.quantity))) { Alert.alert('Thiếu mã đơn vị', 'Mỗi sản phẩm theo IMEI/Serial cần đủ mã cho đúng số lượng.'); return; } setSaving(true); try { const items: ReceiptItem[] = lines.map((line) => { const ids = line.identifiers?.split(/\r?\n|,/).map((value) => value.trim()).filter(Boolean) ?? []; return { productId: line.product!._id, variantId: line.variant!._id, sku: line.variant!.sku, productName: line.product!.name, displayName: line.variant!.displayName, quantity: number(line.quantity), unitCost: Math.round(number(line.amount)), trackingMode: line.variant!.trackingMode, ...(line.variant!.trackingMode === 'serial' ? { serialNumbers: ids } : line.variant!.trackingMode === 'unit_barcode' ? { unitDetails: ids.map((internalBarcode) => ({ internalBarcode })) } : {}) }; }); if (editingReceipt) await inventoryApi.updateReceipt(editingReceipt._id, branchId, { supplierId, notes: notes.trim(), items }); else await inventoryApi.createReceipt(branchId, { supplierId, warehouseId, notes: notes.trim(), items }); setCreating(false); setEditingReceipt(null); setLines([{ quantity: '1', amount: '', identifiers: '' }]); setNotes(''); await load(); } catch (error) { reportError(error); } finally { setSaving(false); } };
  const runAction = (receipt: GoodsReceipt, action: 'submit' | 'start-receiving' | 'confirm' | 'cancel') => { const verb = action === 'submit' ? 'gửi duyệt' : action === 'start-receiving' ? 'bắt đầu nhận' : action === 'confirm' ? 'xác nhận nhập kho' : 'hủy'; Alert.alert(`Xác nhận ${verb}?`, `${receipt.receiptCode} · ${receipt.supplierName}`, [{ text: 'Quay lại', style: 'cancel' }, { text: 'Xác nhận', onPress: () => void inventoryApi.receiptAction(receipt._id, action, branchId).then(() => load()).catch(reportError) }]); };
  const resetSupplierForm = () => { setSupplierEditingId(''); setSupplierName(''); setSupplierPhone(''); setSupplierEmail(''); setSupplierTaxCode(''); };
  const createSupplier = async () => { if (!supplierName.trim()) { Alert.alert('Thiếu tên', 'Nhập tên nhà cung cấp.'); return; } setSaving(true); try { const payload = { name: supplierName.trim(), phone: supplierPhone.trim(), email: supplierEmail.trim(), taxCode: supplierTaxCode.trim(), status: 'active' as const }; const supplier = supplierEditingId ? await inventoryApi.updateSupplier(supplierEditingId, payload) : await inventoryApi.createSupplier(payload); setSuppliers((current) => supplierEditingId ? current.map((item) => item._id === supplier._id ? supplier : item) : [supplier, ...current]); if (supplier.status === 'active') setSupplierId(supplier._id); resetSupplierForm(); setSupplierFormOpen(false); } catch (error) { reportError(error); } finally { setSaving(false); } };
  const deactivateSupplier = () => { if (!supplierEditingId) return; Alert.alert('Ngừng sử dụng nhà cung cấp?', 'Nhà cung cấp có phiếu cũ vẫn được giữ trong lịch sử.', [{ text: 'Quay lại', style: 'cancel' }, { text: 'Ngừng sử dụng', style: 'destructive', onPress: () => void inventoryApi.updateSupplier(supplierEditingId, { status: 'inactive' }).then((supplier) => { setSuppliers((current) => current.map((item) => item._id === supplier._id ? supplier : item)); resetSupplierForm(); }).catch(reportError) }]); };
  const filters = [{ value: '', label: 'Tất cả' }, { value: 'draft', label: 'Nháp' }, { value: 'pending', label: 'Chờ duyệt' }, { value: 'receiving', label: 'Đang nhận' }, { value: 'confirmed', label: 'Đã nhập' }];
  const openFilters = () => { setDraftStatus(status); setFilterOpen(true); };
  return <View style={styles.panel}>
    <PageHeading title="Nhập hàng" subtitle="Phiếu nhập, nhà cung cấp và xác nhận hàng về" action={canManage ? () => setCreating(true) : undefined} actionLabel={canManage ? 'Tạo phiếu' : undefined} icon={ArrowDownToLine} />
    <SearchFilterBar value={search} onChangeText={setSearch} placeholder="Tìm theo mã phiếu hoặc nhà cung cấp" filterCount={status ? 1 : 0} onOpenFilters={openFilters} />
    <Sheet visible={filterOpen} title="Lọc phiếu nhập" subtitle="Chọn trạng thái phiếu cần xem" onClose={() => setFilterOpen(false)}><FilterOptions options={filters} value={draftStatus} onChange={setDraftStatus} /><View style={styles.filterFooter}><Pressable onPress={() => { setDraftStatus(''); setStatus(''); setFilterOpen(false); }} style={styles.clearFilterButton}><Text style={styles.clearFilterText}>Xóa bộ lọc</Text></Pressable><Pressable onPress={() => { setStatus(draftStatus); setFilterOpen(false); }} style={styles.applyFilterButton}><Check size={15} color={colors.white} /><Text style={styles.applyFilterText}>Áp dụng</Text></Pressable></View></Sheet>
    {loading ? <LoadingState /> : <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.primary} />} contentContainerStyle={styles.receiptsListContent}>
      {!receipts.length ? <EmptyState title="Chưa có phiếu nhập" copy="Tạo phiếu để ghi nhận hàng mua, hàng trả hoặc hàng thu hồi." /> : receipts.map((receipt) => <Card key={receipt._id} style={styles.receiptCard}>
        <View style={styles.recordHeader}><View style={styles.productGlyph}><ArrowDownToLine size={16} color={colors.primary} /></View><View style={styles.productCardCopy}><Text style={styles.productName}>{receipt.receiptCode}</Text><Text style={styles.productMeta}>{receipt.supplierName} · {receipt.items?.length ?? 0} mặt hàng</Text></View><StatusPill value={receipt.status === 'draft' ? 'Bản nháp' : receipt.status === 'pending' ? 'Chờ duyệt' : receipt.status === 'receiving' ? 'Đang nhận' : receipt.status === 'confirmed' ? 'Đã nhập' : 'Đã hủy'} tone={receipt.status === 'confirmed' ? 'green' : receipt.status === 'receiving' ? 'blue' : receipt.status === 'cancelled' ? 'red' : 'yellow'} /></View>
        <View style={styles.receiptMetaRow}><Text style={styles.productMeta}>{receipt.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0} sản phẩm</Text><Text style={styles.productMeta}>{money(receipt.subtotal || 0)}</Text><Text style={styles.productMeta}>{new Date(receipt.createdAt).toLocaleDateString('vi-VN')}</Text></View>
        {canManage && <View style={styles.receiptActions}>{receipt.status === 'draft' && <Pressable onPress={() => void editReceipt(receipt)} style={styles.smallAction}><Text style={styles.smallActionText}>Sửa phiếu</Text></Pressable>}{receipt.status === 'draft' && <Pressable onPress={() => runAction(receipt, 'submit')} style={styles.smallAction}><Text style={styles.smallActionText}>Gửi duyệt</Text></Pressable>}{receipt.status === 'pending' && <Pressable onPress={() => runAction(receipt, 'start-receiving')} style={styles.smallAction}><Text style={styles.smallActionText}>Bắt đầu nhận</Text></Pressable>}{receipt.status === 'receiving' && <Pressable onPress={() => runAction(receipt, 'confirm')} style={styles.smallAction}><Text style={styles.smallActionText}>Xác nhận nhập kho</Text></Pressable>}{['draft', 'pending', 'receiving'].includes(receipt.status) && <Pressable onPress={() => runAction(receipt, 'cancel')} style={styles.smallActionDanger}><Text style={styles.smallActionDangerText}>Hủy</Text></Pressable>}</View>}
      </Card>)}
    </ScrollView>}
    <Sheet visible={creating} title={editingReceipt ? 'Sửa phiếu nhập' : 'Tạo phiếu nhập'} subtitle="Chọn nhà cung cấp, kho và các mặt hàng" onClose={() => { setCreating(false); setEditingReceipt(null); }}>
      <View style={styles.sectionLabelRow}><Text style={styles.sectionLabel}>Nhà cung cấp</Text>{canManage && <View style={styles.inlineActions}><Pressable onPress={() => { resetSupplierForm(); setSupplierFormOpen(true); }}><Text style={styles.linkText}>+ Thêm mới</Text></Pressable><Pressable onPress={() => setSupplierFormOpen(true)}><Text style={styles.linkText}>Quản lý</Text></Pressable></View>}</View>
      <ChoiceField label="Nhà cung cấp *" value={supplierId} options={suppliers.filter((item) => item.status === 'active').map((item) => ({ value: item._id, label: `${item.name}${item.code ? ` · ${item.code}` : ''}` }))} onChange={setSupplierId} placeholder="Chọn nhà cung cấp" />
      <ChoiceField label="Kho nhận *" value={warehouseId} options={warehouses.map((item) => ({ value: item._id, label: item.name }))} onChange={setWarehouseId} placeholder="Chọn kho" />
      <LineItemsEditor products={products} lines={lines} onChange={setLines} amountLabel="Giá vốn / đơn vị" />
      <Field label="Ghi chú" value={notes} onChangeText={setNotes} multiline placeholder="Số hóa đơn, thông tin giao nhận…" />
      <ActionButton label={saving ? 'Đang lưu…' : editingReceipt ? 'Lưu phiếu nhập' : 'Tạo phiếu nhập'} onPress={() => void create()} icon={ArrowDownToLine} disabled={saving} />
    </Sheet>
    <Sheet visible={supplierFormOpen} title={supplierEditingId ? 'Sửa nhà cung cấp' : 'Quản lý nhà cung cấp'} subtitle="Chọn nhà cung cấp để sửa thông tin hoặc tạo mới" onClose={() => { setSupplierFormOpen(false); resetSupplierForm(); }}>
      <SectionLabel action="+ Tạo mới" onAction={resetSupplierForm}>Danh sách nhà cung cấp</SectionLabel>
      <ScrollView style={{ maxHeight: 170 }} nestedScrollEnabled>{suppliers.map((supplier) => <Pressable key={supplier._id} onPress={() => { setSupplierEditingId(supplier._id); setSupplierName(supplier.name); setSupplierPhone(supplier.phone ?? ''); setSupplierEmail(supplier.email ?? ''); setSupplierTaxCode(supplier.taxCode ?? ''); }} style={[styles.resourceRow, supplierEditingId === supplier._id && styles.pickerOptionSelected]}><View style={{ flex: 1 }}><Text style={styles.productName}>{supplier.name}</Text><Text style={styles.productMeta}>{supplier.code} · {supplier.status === 'active' ? 'Đang hoạt động' : 'Ngừng sử dụng'}</Text></View><ChevronRight size={15} color={colors.muted} /></Pressable>)}</ScrollView>
      <Field label="Tên nhà cung cấp *" value={supplierName} onChangeText={setSupplierName} /><View style={styles.twoColumns}><View style={{ flex: 1 }}><Field label="Số điện thoại" value={supplierPhone} onChangeText={setSupplierPhone} keyboardType="phone-pad" /></View><View style={{ flex: 1 }}><Field label="Mã số thuế" value={supplierTaxCode} onChangeText={setSupplierTaxCode} /></View></View><Field label="Email" value={supplierEmail} onChangeText={setSupplierEmail} keyboardType="email-address" />
      <View style={styles.recordActions}><ActionButton label={saving ? 'Đang lưu…' : supplierEditingId ? 'Lưu thay đổi' : 'Tạo nhà cung cấp'} onPress={() => void createSupplier()} disabled={saving} />{supplierEditingId && suppliers.find((item) => item._id === supplierEditingId)?.status === 'active' && <ActionButton label="Ngừng dùng" onPress={deactivateSupplier} kind="danger" />}</View>
    </Sheet>
  </View>;
}

export function InventoryTransfersPanel({ branchId, canManage }: Props) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]); const [balances, setBalances] = useState<InventoryBalance[]>([]); const [destinations, setDestinations] = useState<TransferDestination[]>([]); const [transfers, setTransfers] = useState<InventoryTransfer[]>([]); const [transferTotal, setTransferTotal] = useState(0); const [transferPage, setTransferPage] = useState(1); const [fromWarehouseId, setFromWarehouseId] = useState(''); const [creating, setCreating] = useState(false); const [destinationId, setDestinationId] = useState(''); const [balanceId, setBalanceId] = useState(''); const [quantity, setQuantity] = useState('1'); const [identifiers, setIdentifiers] = useState(''); const [reason, setReason] = useState(''); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const load = useCallback(async () => { if (!permissionBranch(branchId)) { setLoading(false); return; } setLoading(true); try { const [warehouseList, destinationList, transferPageResult] = await Promise.all([inventoryApi.listWarehouses(branchId), inventoryApi.listDestinations(branchId!), inventoryApi.listTransfers(branchId!, 1)]); setWarehouses(warehouseList); setDestinations(destinationList); setTransfers(transferPageResult.items ?? []); setTransferTotal(transferPageResult.total ?? 0); setTransferPage(1); const from = warehouseList.find((item) => item._id === fromWarehouseId)?._id ?? warehouseList.find((item) => item.isDefault)?._id ?? warehouseList[0]?._id ?? ''; setFromWarehouseId(from); setBalances(from ? await inventoryApi.listBalances(branchId, from, false) : []); } catch (error) { reportError(error); } finally { setLoading(false); } }, [branchId, fromWarehouseId]);
  useEffect(() => { void load(); }, [branchId]);
  const chooseFrom = async (id: string) => { setFromWarehouseId(id); try { setBalances(await inventoryApi.listBalances(branchId, id, false)); } catch (error) { reportError(error); } };
  const selectedDestination = destinations.find((item) => item._id === destinationId);
  const selectedBalance = balances.find((item) => item._id === balanceId);
  const loadMoreTransfers = async () => { try { const next = transferPage + 1; const result = await inventoryApi.listTransfers(branchId!, next); setTransfers((current) => [...current, ...(result.items ?? [])]); setTransferPage(next); } catch (error) { reportError(error); } };
  const create = async () => { if (!permissionBranch(branchId)) return; if (!selectedDestination || !selectedBalance || number(quantity) <= 0) { Alert.alert('Thiếu thông tin', 'Chọn kho nhận, sản phẩm và số lượng hợp lệ.'); return; } if (selectedBalance.trackingMode === 'serial' && !identifiers.trim()) { Alert.alert('Cần mã serial', 'Nhập serial/IMEI tương ứng với số lượng điều chuyển.'); return; } setSaving(true); try { await inventoryApi.createTransfer(branchId!, { fromWarehouseId, toBranchId: selectedDestination.branchId, toWarehouseId: selectedDestination._id, reason: reason.trim(), idempotencyKey: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, items: [{ productId: selectedBalance.productId, variantId: selectedBalance.variantId, sku: selectedBalance.sku, quantity: number(quantity), unitIdentifiers: identifiers.split(/\r?\n|,/).map((value) => value.trim()).filter(Boolean) }] }); setCreating(false); setReason(''); setIdentifiers(''); await load(); } catch (error) { reportError(error); } finally { setSaving(false); } };
  const runAction = (transfer: InventoryTransfer, action: 'accept' | 'cancel') => Alert.alert(action === 'accept' ? 'Nhận hàng điều chuyển?' : 'Hủy điều chuyển?', transfer.transferCode, [{ text: 'Quay lại', style: 'cancel' }, { text: 'Xác nhận', style: action === 'cancel' ? 'destructive' : 'default', onPress: () => void inventoryApi.transferAction(branchId!, transfer._id, action, action === 'cancel' ? 'Hủy điều chuyển theo yêu cầu' : undefined).then(() => load()).catch(reportError) }]);
  return <View style={styles.panel}>
    <PageHeading title="Điều chuyển kho" subtitle="Gửi hàng giữa các kho và chi nhánh" action={canManage ? () => setCreating(true) : undefined} actionLabel={canManage ? 'Tạo phiếu' : undefined} icon={ArrowLeftRight} />
    {loading ? <LoadingState /> : <ScrollView contentContainerStyle={styles.listContent}>
      {!transfers.length ? <EmptyState title="Chưa có phiếu điều chuyển" copy="Tạo phiếu để chuyển hàng sang kho thuộc chi nhánh khác." /> : transfers.map((transfer) => <Card key={transfer._id} style={styles.recordCard}>
        <View style={styles.recordHeader}><View style={styles.productGlyph}><Truck size={16} color={colors.primary} /></View><View style={styles.productCardCopy}><Text style={styles.productName}>{transfer.transferCode}</Text><Text style={styles.productMeta}>{transfer.fromWarehouseName} → {transfer.toWarehouseName}</Text></View><StatusPill value={transfer.status === 'in_transit' ? 'Đang vận chuyển' : transfer.status === 'received' ? 'Đã nhận' : 'Đã hủy'} tone={transfer.status === 'received' ? 'green' : transfer.status === 'cancelled' ? 'red' : 'yellow'} /></View>
        <Text style={styles.recordDescription}>{transfer.items?.map((item) => `${item.productName} · ${item.quantity}`).join('  /  ')}</Text>
        {canManage && transfer.status === 'in_transit' && <View style={styles.recordActions}><Pressable onPress={() => runAction(transfer, 'accept')} style={styles.smallAction}><Text style={styles.smallActionText}>Xác nhận nhận hàng</Text></Pressable><Pressable onPress={() => runAction(transfer, 'cancel')} style={styles.smallActionDanger}><Text style={styles.smallActionDangerText}>Hủy phiếu</Text></Pressable></View>}
      </Card>)}
      {transfers.length < transferTotal && <ActionButton label="Xem thêm phiếu" onPress={() => void loadMoreTransfers()} icon={ChevronDown} kind="secondary" />}
    </ScrollView>}
    <Sheet visible={creating} title="Tạo phiếu điều chuyển" subtitle="Số lượng khả dụng được lấy từ tồn kho nguồn" onClose={() => setCreating(false)}>
      <ChoiceField label="Kho xuất" value={fromWarehouseId} options={warehouses.map((item) => ({ value: item._id, label: item.name }))} onChange={(value) => void chooseFrom(value)} />
      <ChoiceField label="Kho nhận *" value={destinationId} options={destinations.map((item) => ({ value: item._id, label: `${item.branchName} · ${item.name}` }))} onChange={setDestinationId} placeholder="Chọn kho nhận" />
      <ChoiceField label="Sản phẩm *" value={balanceId} options={balances.filter((item) => item.quantity > 0).map((item) => ({ value: item._id, label: `${item.productName} · ${item.sku} · khả dụng ${item.quantity - item.reservedQuantity}` }))} onChange={setBalanceId} placeholder="Chọn hàng hóa đang có tồn" />
      <Field label="Số lượng" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" />
      {selectedBalance?.trackingMode === 'serial' || selectedBalance?.trackingMode === 'unit_barcode' ? <Field label="Serial / mã đơn vị (mỗi dòng một mã)" value={identifiers} onChangeText={setIdentifiers} multiline placeholder="SN001\nSN002" /> : null}
      <Field label="Lý do điều chuyển" value={reason} onChangeText={setReason} multiline placeholder="Bổ sung hàng cho chi nhánh…" />
      <ActionButton label={saving ? 'Đang tạo…' : 'Tạo phiếu điều chuyển'} onPress={() => void create()} icon={ArrowLeftRight} disabled={saving} />
    </Sheet>
  </View>;
}

export function InventoryTransactionsPanel({ branchId, canManage, operatorName }: Props & { operatorName: string }) {
  const [logs, setLogs] = useState<StockLog[]>([]); const [warehouses, setWarehouses] = useState<Warehouse[]>([]); const [products, setProducts] = useState<CatalogProduct[]>([]); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [creating, setCreating] = useState(false); const [type, setType] = useState<'nhập' | 'xuất'>('nhập'); const [purpose, setPurpose] = useState('nội bộ'); const [warehouseId, setWarehouseId] = useState(''); const [title, setTitle] = useState(''); const [notes, setNotes] = useState(''); const [status, setStatus] = useState('Hoàn thành'); const [lines, setLines] = useState<DraftLine[]>([{ quantity: '1', amount: '' }]); const [saving, setSaving] = useState(false);
  const load = useCallback(async () => { if (!permissionBranch(branchId)) { setLoading(false); return; } setLoading(true); try { const [logList, warehouseList, productPage] = await Promise.all([inventoryApi.listStockLogs(branchId!), inventoryApi.listWarehouses(branchId), inventoryApi.listProducts({ branchId, status: 'active', page: 1, limit: 50 })]); setLogs(logList ?? []); setWarehouses(warehouseList); setProducts(productPage.items ?? []); setWarehouseId((current) => current && warehouseList.some((item) => item._id === current) ? current : warehouseList.find((item) => item.isDefault)?._id ?? warehouseList[0]?._id ?? ''); } catch (error) { reportError(error); } finally { setLoading(false); setRefreshing(false); } }, [branchId]);
  useEffect(() => { void load(); }, [load]);
  const create = async () => { if (!permissionBranch(branchId)) return; if (!title.trim() || !warehouseId || !lines.length || lines.some((line) => !line.product || !line.variant || number(line.quantity) <= 0)) { Alert.alert('Thiếu thông tin', 'Nhập tiêu đề, chọn kho và thêm ít nhất một mặt hàng.'); return; } if (lines.some((line) => line.variant?.trackingMode === 'serial' && line.identifiers?.split(/\r?\n|,/).filter((value) => value.trim()).length !== number(line.quantity))) { Alert.alert('Thiếu serial', 'Mỗi sản phẩm theo IMEI/Serial cần đủ mã cho đúng số lượng.'); return; } setSaving(true); try { const items = lines.map((line) => { const serialNumbers = line.identifiers?.split(/\r?\n|,/).map((value) => value.trim()).filter(Boolean); return { productId: line.product!._id, variantId: line.variant!._id, sku: line.variant!.sku, productName: line.product!.name, quantity: number(line.quantity), ...(type === 'nhập' ? { unitCost: number(line.amount) } : { unitPrice: number(line.amount) }), ...(serialNumbers?.length ? { serialNumbers, unitIdentifiers: serialNumbers } : {}) }; }); const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0); await inventoryApi.createStockLog(branchId!, { idempotencyKey: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, type, purpose: type === 'xuất' ? purpose : undefined, title: title.trim(), operatorName, notes: notes.trim(), status, items, sku: items[0].sku, productName: items[0].productName, quantity: totalQuantity, warehouseId, createdAt: new Date().toISOString() }); setCreating(false); setTitle(''); setNotes(''); setLines([{ quantity: '1', amount: '', identifiers: '' }]); await load(); } catch (error) { reportError(error); } finally { setSaving(false); } };
  const changeStatus = (log: StockLog, nextStatus: 'Đang xử lý' | 'Hoàn thành') => { const id = log._id || log.id; if (!id) return; Alert.alert('Cập nhật trạng thái phiếu?', `Chuyển sang “${nextStatus}”. Khi hoàn thành, ERP sẽ áp dụng thay đổi tồn kho.`, [{ text: 'Hủy', style: 'cancel' }, { text: 'Cập nhật', onPress: () => { const items = log.items || []; if (!items.length) { Alert.alert('Không thể cập nhật', 'Phiếu cũ này không có danh sách mặt hàng chi tiết.'); return; } const body = { type: log.type, purpose: log.purpose, title: log.title, operatorName: log.operatorName || operatorName, notes: log.notes || '', status: nextStatus, items, sku: items[0].sku, productName: items[0].productName, quantity: items.reduce((sum, item) => sum + item.quantity, 0), warehouseId: log.warehouseId }; void inventoryApi.updateStockLog(branchId!, id, body).then(() => load()).catch(reportError); } }]); };
  const remove = (log: StockLog) => Alert.alert('Xóa phiếu?', `${log.title || log.productName || 'Giao dịch kho'} sẽ bị xóa.`, [{ text: 'Hủy', style: 'cancel' }, { text: 'Xóa', style: 'destructive', onPress: () => void inventoryApi.deleteStockLog(branchId!, log._id || log.id || '').then(() => load()).catch(reportError) }]);
  const reverse = (log: StockLog) => Alert.alert('Đảo giao dịch xuất kho?', 'Hệ thống sẽ tạo bút toán hoàn kho theo nghiệp vụ ERP.', [{ text: 'Hủy', style: 'cancel' }, { text: 'Đảo giao dịch', onPress: () => void inventoryApi.reverseStockLog(branchId!, log._id || log.id || '', 'Điều chỉnh nghiệp vụ kho').then(() => load()).catch(reportError) }]);
  return <View style={styles.panel}>
    <PageHeading title="Giao dịch kho" subtitle="Phiếu nhập, xuất và lịch sử biến động" action={canManage ? () => setCreating(true) : undefined} actionLabel={canManage ? 'Tạo phiếu' : undefined} icon={ArrowUpFromLine} />
    {loading ? <LoadingState /> : <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.primary} />} contentContainerStyle={styles.listContent}>
      {!logs.length ? <EmptyState title="Chưa có giao dịch kho" copy="Tạo phiếu nhập hoặc xuất để ghi nhận biến động tồn." /> : logs.map((log, index) => <Card key={log._id || log.id || index} style={styles.recordCard}>
        <View style={styles.recordHeader}><View style={[styles.productGlyph, log.type === 'nhập' ? styles.greenGlyph : styles.orangeGlyph]}>{log.type === 'nhập' ? <ArrowDownToLine size={16} color="#16885A" /> : <ArrowUpFromLine size={16} color="#B76A00" />}</View><View style={styles.productCardCopy}><Text style={styles.productName}>{log.title || `${log.type} kho`}</Text><Text style={styles.productMeta}>{log.productName || log.items?.map((item) => item.productName).join(', ') || 'Nhiều mặt hàng'}</Text></View><StatusPill value={log.status || 'Hoàn thành'} tone={log.status === 'Hoàn thành' ? 'green' : 'yellow'} /></View>
        <View style={styles.recordMetaRow}><Text style={styles.productMeta}>{log.quantity ?? log.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0} sản phẩm</Text><Text style={styles.productMeta}>{new Date(log.createdAt).toLocaleDateString('vi-VN')}</Text><Text style={styles.productMeta}>{log.operatorName || '—'}</Text></View>
        {canManage && <View style={styles.recordActions}>{log.status === 'Đang chờ' && <Pressable onPress={() => changeStatus(log, 'Đang xử lý')} style={styles.smallAction}><Text style={styles.smallActionText}>Bắt đầu xử lý</Text></Pressable>}{log.status === 'Đang xử lý' && <Pressable onPress={() => changeStatus(log, 'Hoàn thành')} style={styles.smallAction}><Text style={styles.smallActionText}>Hoàn thành</Text></Pressable>}{log.type === 'xuất' && log.status === 'Hoàn thành' && <Pressable onPress={() => reverse(log)} style={styles.smallAction}><Text style={styles.smallActionText}>Đảo xuất kho</Text></Pressable>}{log.status !== 'Hoàn thành' && <Pressable onPress={() => remove(log)} style={styles.smallActionDanger}><Text style={styles.smallActionDangerText}>Xóa phiếu</Text></Pressable>}</View>}
      </Card>)}
    </ScrollView>}
    <Sheet visible={creating} title="Tạo giao dịch kho" subtitle="Giao dịch hoàn thành sẽ cập nhật tồn theo API ERP" onClose={() => setCreating(false)}>
      <View style={styles.choiceRow}>{(['nhập', 'xuất'] as const).map((value) => <Pressable key={value} onPress={() => setType(value)} style={[styles.choiceChip, type === value && styles.choiceChipActive]}><Text style={[styles.choiceChipText, type === value && styles.choiceChipTextActive]}>{value === 'nhập' ? 'Nhập kho' : 'Xuất kho'}</Text></Pressable>)}</View>
      <Field label="Tiêu đề phiếu *" value={title} onChangeText={setTitle} placeholder="VD: Nhập hàng nhà cung cấp" />
      <ChoiceField label="Kho" value={warehouseId} options={warehouses.map((item) => ({ value: item._id, label: item.name }))} onChange={setWarehouseId} />
      {type === 'xuất' && <ChoiceField label="Mục đích xuất" value={purpose} options={[{ value: 'bán', label: 'Bán hàng' }, { value: 'nội bộ', label: 'Dùng nội bộ' }, { value: 'hủy', label: 'Hủy hàng' }, { value: 'chuyển kho', label: 'Chuyển kho' }]} onChange={setPurpose} />}
      <ChoiceField label="Trạng thái" value={status} options={[{ value: 'Đang chờ', label: 'Đang chờ' }, { value: 'Đang xử lý', label: 'Đang xử lý' }, { value: 'Hoàn thành', label: 'Hoàn thành' }]} onChange={setStatus} />
      <LineItemsEditor products={products} lines={lines} onChange={setLines} amountLabel={type === 'nhập' ? 'Giá vốn / đơn vị' : 'Đơn giá xuất'} />
      <Field label="Ghi chú" value={notes} onChangeText={setNotes} multiline placeholder="Thông tin bổ sung" />
      <ActionButton label={saving ? 'Đang lưu…' : 'Lưu giao dịch'} onPress={() => void create()} icon={type === 'nhập' ? ArrowDownToLine : ArrowUpFromLine} disabled={saving} />
    </Sheet>
  </View>;
}

export function InventorySerialsPanel({ branchId, companyCode, canManage }: Props & { companyCode?: string }) {
  const [serials, setSerials] = useState<SerialUnit[]>([]); const [products, setProducts] = useState<CatalogProduct[]>([]); const [warehouses, setWarehouses] = useState<Warehouse[]>([]); const [search, setSearch] = useState(''); const [status, setStatus] = useState(''); const [draftStatus, setDraftStatus] = useState(''); const [filterOpen, setFilterOpen] = useState(false); const [loading, setLoading] = useState(true); const [creating, setCreating] = useState(false); const [selected, setSelected] = useState<SerialUnit | null>(null); const [productId, setProductId] = useState(''); const [variant, setVariant] = useState<ProductVariant | undefined>(); const [warehouseId, setWarehouseId] = useState(''); const [serialNumbers, setSerialNumbers] = useState(''); const [targetStatus, setTargetStatus] = useState('in_stock'); const [reason, setReason] = useState(''); const [saving, setSaving] = useState(false); const [page, setPage] = useState(1); const [total, setTotal] = useState(0);
  const load = useCallback(async () => { if (!permissionBranch(branchId)) { setLoading(false); return; } setLoading(true); try { const [result, productPage, warehouseList] = await Promise.all([inventoryApi.listSerials({ companyCode, branchId, serial: search || undefined, status: status || undefined, page: 1, limit: 50 }), inventoryApi.listProducts({ branchId, status: 'active', page: 1, limit: 50 }), inventoryApi.listWarehouses(branchId)]); setSerials(result.items ?? []); setTotal(result.total ?? 0); setPage(1); setProducts(productPage.items ?? []); setWarehouses(warehouseList); } catch (error) { reportError(error); } finally { setLoading(false); } }, [branchId, companyCode, search, status]);
  useEffect(() => { const timer = setTimeout(() => { void load(); }, 180); return () => clearTimeout(timer); }, [load]);
  const chooseProduct = async (id: string) => { setProductId(id); setVariant(undefined); try { const detail = await inventoryApi.getProduct(id); setVariant(detail.variants?.find((item) => item.status === 'active') ?? detail.variants?.[0]); } catch (error) { reportError(error); } };
  const importBatch = async () => { if (!variant || !serialNumbers.trim()) { Alert.alert('Thiếu dữ liệu', 'Chọn sản phẩm có biến thể và nhập danh sách serial.'); return; } const values = serialNumbers.split(/\r?\n|,/).map((value) => value.trim()).filter(Boolean); if (!values.length) return; setSaving(true); try { await inventoryApi.importSerials({ productId, variantId: variant._id, sku: variant.sku, productName: products.find((product) => product._id === productId)?.name || '', serialNumbers: values, warehouseId: warehouseId || undefined }, branchId); setCreating(false); setSerialNumbers(''); await load(); } catch (error) { reportError(error); } finally { setSaving(false); } };
  const transition = async () => { if (!selected) return; setSaving(true); try { await inventoryApi.transitionSerial(selected._id, targetStatus, reason || 'Cập nhật trạng thái trong ứng dụng', branchId); setSelected(null); setReason(''); await load(); } catch (error) { reportError(error); } finally { setSaving(false); } };
  const loadMore = async () => { try { const result = await inventoryApi.listSerials({ companyCode, branchId, serial: search || undefined, status: status || undefined, page: page + 1, limit: 50 }); setSerials((current) => [...current, ...(result.items ?? [])]); setPage((value) => value + 1); } catch (error) { reportError(error); } };
  const serialStatusOptions = [{ value: '', label: 'Tất cả' }, { value: 'in_stock', label: 'Trong kho' }, { value: 'in_transit', label: 'Đang chuyển' }, { value: 'sold', label: 'Đã bán' }, { value: 'defective', label: 'Lỗi' }, { value: 'repairing', label: 'Đang sửa' }];
  const openFilters = () => { setDraftStatus(status); setFilterOpen(true); };
  return <View style={styles.panel}>
    <PageHeading title="IMEI / Serial" subtitle={`${total.toLocaleString('vi-VN')} đơn vị được quản lý`} action={canManage ? () => setCreating(true) : undefined} actionLabel={canManage ? 'Nhập serial' : undefined} icon={Barcode} />
    <SearchFilterBar value={search} onChangeText={setSearch} placeholder="Tìm serial, IMEI hoặc mã nội bộ" filterCount={status ? 1 : 0} onOpenFilters={openFilters} />
    <Sheet visible={filterOpen} title="Lọc IMEI / Serial" subtitle="Chọn trạng thái cần tra cứu" onClose={() => setFilterOpen(false)}><FilterOptions options={serialStatusOptions} value={draftStatus} onChange={setDraftStatus} /><View style={styles.filterFooter}><Pressable onPress={() => { setDraftStatus(''); setStatus(''); setFilterOpen(false); }} style={styles.clearFilterButton}><Text style={styles.clearFilterText}>Xóa bộ lọc</Text></Pressable><Pressable onPress={() => { setStatus(draftStatus); setFilterOpen(false); }} style={styles.applyFilterButton}><Check size={15} color={colors.white} /><Text style={styles.applyFilterText}>Áp dụng</Text></Pressable></View></Sheet>
    {loading ? <LoadingState /> : <ScrollView contentContainerStyle={styles.listContent}>{!serials.length ? <EmptyState title="Chưa có IMEI / Serial" copy="Nhập danh sách serial từ lô hàng hoặc tìm theo bộ lọc." /> : serials.map((unit) => <Pressable key={unit._id} onPress={() => { setSelected(unit); setTargetStatus(unit.status); }}><Card style={styles.serialCard}><View style={styles.recordHeader}><View style={styles.productGlyph}><Barcode size={16} color={colors.primary} /></View><View style={styles.productCardCopy}><Text style={styles.productName}>{unit.serialNumber || unit.internalBarcode}</Text><Text style={styles.productMeta}>{unit.productName} · {unit.sku}</Text></View><StatusPill value={unit.status.replace('_', ' ')} tone={unit.status === 'in_stock' ? 'green' : unit.status === 'sold' ? 'blue' : unit.status === 'defective' || unit.status === 'lost' ? 'red' : 'yellow'} /></View><Text style={styles.productMeta}>Mã nội bộ {unit.internalBarcode}</Text></Card></Pressable>)}{serials.length < total && <ActionButton label="Tải thêm 50" onPress={() => void loadMore()} icon={ChevronDown} kind="secondary" />}</ScrollView>}
    <Sheet visible={creating} title="Nhập IMEI / Serial" subtitle="Mỗi mã một dòng, hoặc phân cách bằng dấu phẩy" onClose={() => setCreating(false)}>
      <ChoiceField label="Sản phẩm" value={productId} options={products.map((item) => ({ value: item._id, label: `${item.name} · ${item.productCode}` }))} onChange={(id) => void chooseProduct(id)} placeholder="Chọn sản phẩm" />
      {variant ? <View style={styles.inlineNotice}><Check size={14} color="#16885A" /><Text style={styles.inlineNoticeText}>SKU {variant.sku} · {variant.trackingMode}</Text></View> : null}
      <ChoiceField label="Kho" value={warehouseId} options={warehouses.map((item) => ({ value: item._id, label: item.name }))} onChange={setWarehouseId} placeholder="Chọn kho" />
      <Field label="Danh sách serial *" value={serialNumbers} onChangeText={setSerialNumbers} multiline placeholder="SN001\nSN002" />
      <ActionButton label={saving ? 'Đang nhập…' : 'Nhập serial'} onPress={() => void importBatch()} disabled={saving} icon={Barcode} />
    </Sheet>
    <Sheet visible={Boolean(selected)} title="Cập nhật serial" subtitle={`${selected?.productName} · ${selected?.serialNumber}`} onClose={() => setSelected(null)}>
      <ChoiceField label="Trạng thái mới" value={targetStatus} options={[{ value: 'in_stock', label: 'Trong kho' }, { value: 'internal_use', label: 'Đang sử dụng nội bộ' }, { value: 'returned', label: 'Hàng trả' }, { value: 'defective', label: 'Lỗi' }, { value: 'repairing', label: 'Đang sửa chữa' }, { value: 'scrapped', label: 'Đã thanh lý' }, { value: 'lost', label: 'Thất lạc' }]} onChange={setTargetStatus} />
      <Field label="Lý do" value={reason} onChangeText={setReason} multiline placeholder="Nhập lý do thay đổi" />
      <ActionButton label={saving ? 'Đang lưu…' : 'Lưu trạng thái'} onPress={() => void transition()} disabled={saving} />
    </Sheet>
  </View>;
}

function InventoryBarcodeScanner({ visible, onClose, onScanned }: { visible: boolean; onClose: () => void; onScanned: (value: string) => void }) {
  const [permission, requestPermission] = useCameraPermissions(); const requested = useRef(false); const handled = useRef(false);
  useEffect(() => { if (!visible) { requested.current = false; handled.current = false; return; } if (!permission && !requested.current) { requested.current = true; void requestPermission(); } }, [visible, permission, requestPermission]);
  const handleBarcode = (result: BarcodeScanningResult) => { if (handled.current || !result.data.trim()) return; handled.current = true; onScanned(result.data.trim()); };
  const grantPermission = () => { requested.current = true; void requestPermission(); };
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <View style={styles.scannerRoot}>
      {permission?.granted && visible ? <>
        <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'code93', 'itf14', 'codabar', 'qr', 'datamatrix', 'pdf417', 'aztec'] }} onBarcodeScanned={handleBarcode} />
        <View style={styles.scannerOverlay}>
          <View style={styles.scannerHeader}><View style={{ flex: 1 }}><Text style={styles.scannerTitle}>Quét mã kiểm kê</Text><Text style={styles.scannerSubtitle}>Đưa mã vạch hoặc IMEI vào khung</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Đóng camera" onPress={onClose} style={styles.scannerClose}><X size={20} color={colors.white} /></Pressable></View>
          <View style={styles.scannerTarget}><View style={styles.scannerCornerTopLeft} /><View style={styles.scannerCornerTopRight} /><View style={styles.scannerCornerBottomLeft} /><View style={styles.scannerCornerBottomRight} /></View>
          <Text style={styles.scannerHint}>Camera sẽ tự nhận mã và ghi nhận vào phiếu</Text>
        </View>
      </> : <View style={styles.scannerPermission}><Camera size={32} color={colors.primary} /><Text style={styles.scannerTitleDark}>Cần quyền truy cập camera</Text><Text style={styles.scannerPermissionCopy}>{permission?.canAskAgain === false ? 'Hãy bật quyền Camera cho ERP Mobile trong phần Cài đặt của thiết bị.' : 'Cho phép ERP Mobile dùng camera để quét mã kiểm kê.'}</Text><Pressable onPress={() => permission?.canAskAgain === false ? void Linking.openSettings() : grantPermission()} style={styles.scannerPermissionButton}><Text style={styles.scannerPermissionButtonText}>{permission?.canAskAgain === false ? 'Mở Cài đặt' : permission ? 'Cho phép camera' : 'Đang kiểm tra quyền…'}</Text></Pressable><Pressable onPress={onClose} style={styles.scannerCancel}><Text style={styles.scannerCancelText}>Đóng</Text></Pressable></View>}
    </View>
  </Modal>;
}

export function InventoryCountsPanel({ branchId, canManage, canApprove }: Props & { canApprove: boolean }) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]); const [counts, setCounts] = useState<InventoryCount[]>([]); const [warehouseId, setWarehouseId] = useState(''); const [createWarehouseId, setCreateWarehouseId] = useState(''); const [createNotes, setCreateNotes] = useState(''); const [creating, setCreating] = useState(false); const [scannerOpen, setScannerOpen] = useState(false); const [lastScannedCode, setLastScannedCode] = useState(''); const [loading, setLoading] = useState(true); const [selected, setSelected] = useState<InventoryCount | null>(null); const [itemValues, setItemValues] = useState<Record<string, string>>({}); const [saving, setSaving] = useState(false);
  const load = useCallback(async () => { if (!permissionBranch(branchId)) { setLoading(false); return; } setLoading(true); try { const warehouseList = await inventoryApi.listWarehouses(branchId); setWarehouses(warehouseList); const chosen = warehouseId && warehouseList.some((item) => item._id === warehouseId) ? warehouseId : warehouseList.find((item) => item.isDefault)?._id ?? warehouseList[0]?._id ?? ''; setWarehouseId(chosen); setCounts(chosen ? await inventoryApi.listCounts(chosen, branchId) : []); } catch (error) { reportError(error); } finally { setLoading(false); } }, [branchId, warehouseId]);
  useEffect(() => { void load(); }, [branchId]);
  const selectWarehouse = async (id: string) => { setWarehouseId(id); setLoading(true); try { setCounts(await inventoryApi.listCounts(id, branchId)); } catch (error) { reportError(error); } finally { setLoading(false); } };
  const availableWarehouses = warehouses.filter((item) => item.isActive && item.kind !== 'transit');
  const openCreate = () => { const initialWarehouse = availableWarehouses.some((item) => item._id === warehouseId) ? warehouseId : availableWarehouses.find((item) => item.isDefault)?._id || availableWarehouses[0]?._id || ''; setCreateWarehouseId(initialWarehouse); setCreateNotes(''); setCreating(true); };
  const create = async () => { if (!permissionBranch(branchId)) return; if (!availableWarehouses.some((item) => item._id === createWarehouseId)) { Alert.alert('Chưa chọn kho', 'Chọn một kho đang hoạt động trước khi tạo phiếu.'); return; } setSaving(true); try { const result = await inventoryApi.createCount(createWarehouseId, branchId, createNotes.trim() || undefined); setWarehouseId(createWarehouseId); setCounts([result]); setCreating(false); setCreateNotes(''); setSelected(result); setItemValues(Object.fromEntries((result.items || []).map((item) => [item._id, String(item.countedQuantity)]))); try { setCounts(await inventoryApi.listCounts(createWarehouseId, branchId)); } catch (error) { reportError(error); } } catch (error) { reportError(error); } finally { setSaving(false); } };
  const openCount = (count: InventoryCount) => { setSelected(count); setItemValues(Object.fromEntries((count.items || []).map((item) => [item._id, String(item.countedQuantity)]))); };
  const doAction = async (count: InventoryCount, action: 'start' | 'submit' | 'approve' | 'cancel') => { setSaving(true); try { const body = action === 'approve' ? { expectedVersion: count.version, discrepancyConfirmed: true, reason: 'Đã đối chiếu số lượng kiểm kê.' , unexpectedScanResolutions: [] } : undefined; const result = await inventoryApi.countAction(count._id, action, branchId, body); setCounts((current) => current.map((item) => item._id === result._id ? result : item)); if (selected?._id === result._id) setSelected(result); } catch (error) { reportError(error); } finally { setSaving(false); } };
  const cancelCount = (count: InventoryCount) => Alert.alert('Hủy phiếu kiểm kê?', count.countCode, [{ text: 'Quay lại', style: 'cancel' }, { text: 'Hủy phiếu', style: 'destructive', onPress: () => void doAction(count, 'cancel') }]);
  const saveCountItem = async (count: InventoryCount, itemId: string) => { setSaving(true); try { const result = await inventoryApi.updateCountItem(count._id, itemId, number(itemValues[itemId] ?? '0'), count.version, branchId); setCounts((current) => current.map((item) => item._id === result._id ? result : item)); setSelected(result); } catch (error) { reportError(error); } finally { setSaving(false); } };
  const scan = async (code: string) => { if (!selected || !code.trim()) return; setLastScannedCode(code.trim()); setSaving(true); try { const result = await inventoryApi.scanCount(selected._id, code.trim(), branchId); const updated = result.count; setSelected(updated); setCounts((current) => current.map((item) => item._id === updated._id ? updated : item)); setItemValues(Object.fromEntries((updated.items || []).map((item) => [item._id, String(item.countedQuantity)]))); } catch (error) { reportError(error); } finally { setSaving(false); } };
  return <View style={styles.panel}>
    <PageHeading title="Kiểm kê kho" subtitle="Tạo phiếu, nhập số lượng đếm và gửi duyệt" action={canManage ? openCreate : undefined} actionLabel={canManage ? 'Tạo phiếu' : undefined} icon={ClipboardCheck} />
    {warehouses.length > 1 && <ChoiceField label="Kho kiểm kê" value={warehouseId} options={warehouses.map((item) => ({ value: item._id, label: item.name }))} onChange={(id) => void selectWarehouse(id)} />}
    {loading ? <LoadingState /> : <ScrollView contentContainerStyle={styles.listContent}>{!counts.length ? <EmptyState title="Chưa có phiếu kiểm kê" copy="Tạo phiếu để chụp tồn hệ thống và bắt đầu kiểm đếm." /> : counts.map((count) => <Pressable key={count._id} onPress={() => openCount(count)}><Card style={styles.recordCard}><View style={styles.recordHeader}><View style={styles.productGlyph}><ClipboardCheck size={16} color={colors.primary} /></View><View style={styles.productCardCopy}><Text style={styles.productName}>{count.countCode}</Text><Text style={styles.productMeta}>{count.items?.length ?? 0} mặt hàng · phiên bản {count.version}</Text></View><StatusPill value={count.status.replace('_', ' ')} tone={count.status === 'completed' ? 'green' : count.status === 'conflict' || count.status === 'cancelled' ? 'red' : 'yellow'} /></View><View style={styles.recordActions}>{canManage && count.status === 'draft' && <Pressable onPress={(event) => { event.stopPropagation(); void doAction(count, 'start'); }} style={styles.smallAction}><Text style={styles.smallActionText}>Bắt đầu</Text></Pressable>}{canManage && count.status === 'counting' && <Pressable onPress={(event) => { event.stopPropagation(); void doAction(count, 'submit'); }} style={styles.smallAction}><Text style={styles.smallActionText}>Gửi duyệt</Text></Pressable>}{canApprove && count.status === 'pending_approval' && <Pressable onPress={(event) => { event.stopPropagation(); void doAction(count, 'approve'); }} style={styles.smallAction}><Text style={styles.smallActionText}>Duyệt</Text></Pressable>}{canManage && ['draft', 'counting'].includes(count.status) && <Pressable onPress={(event) => { event.stopPropagation(); cancelCount(count); }} style={styles.smallActionDanger}><Text style={styles.smallActionDangerText}>Hủy</Text></Pressable>}</View></Card></Pressable>)}</ScrollView>}
    <Sheet visible={creating} title="Tạo phiếu kiểm kê" subtitle="Chọn kho và thêm ghi chú trước khi chụp tồn hệ thống" onClose={() => !saving && setCreating(false)}>
      {availableWarehouses.length ? <ChoiceField label="Kho kiểm kê *" value={createWarehouseId} options={availableWarehouses.map((item) => ({ value: item._id, label: `${item.name}${item.isDefault ? ' · Mặc định' : ''}` }))} onChange={setCreateWarehouseId} placeholder="Chọn kho cần kiểm kê" /> : <View style={styles.inlineNotice}><CircleAlert size={14} color="#B54745" /><Text style={[styles.inlineNoticeText, { color: '#B54745' }]}>Chi nhánh chưa có kho đang hoạt động để kiểm kê.</Text></View>}
      <Field label="Ghi chú" value={createNotes} onChangeText={setCreateNotes} multiline placeholder="Nội dung hoặc phạm vi kiểm kê" />
      <ActionButton label={saving ? 'Đang tạo…' : 'Tạo phiếu kiểm kê'} onPress={() => void create()} disabled={saving || !createWarehouseId || !availableWarehouses.length} icon={ClipboardCheck} />
    </Sheet>
    <Sheet visible={Boolean(selected)} title={selected?.countCode || 'Phiếu kiểm kê'} subtitle={`Trạng thái: ${selected?.status}`} onClose={() => setSelected(null)}>
      {selected?.status === 'draft' && canManage && <><View style={styles.inlineNotice}><ClipboardCheck size={14} color={colors.primary} /><Text style={styles.inlineNoticeText}>Phiếu đang ở trạng thái nháp. Bắt đầu đếm để mở các ô nhập số lượng thực tế.</Text></View><ActionButton label={saving ? 'Đang bắt đầu…' : 'Bắt đầu đếm hàng'} onPress={() => void doAction(selected, 'start')} disabled={saving} icon={ClipboardCheck} /></>}
      {selected?.status === 'counting' && canManage && <><Pressable accessibilityRole="button" onPress={() => setScannerOpen(true)} disabled={saving} style={[styles.cameraScanButton, saving && styles.disabled]}><Camera size={17} color={colors.white} /><Text style={styles.cameraScanButtonText}>{saving ? 'Đang ghi nhận mã…' : 'Mở camera quét mã'}</Text></Pressable>{lastScannedCode ? <View style={styles.lastScannedNotice}><Barcode size={14} color={colors.primary} /><Text style={styles.lastScannedText}>Mã vừa quét: {lastScannedCode}</Text></View> : <Text style={styles.scannerHelp}>Quét mã vạch hoặc IMEI/Serial để ghi nhận nhanh mặt hàng.</Text>}</>}
      {(selected?.items || []).map((item) => <View key={item._id} style={styles.countItem}><View style={{ flex: 1 }}><Text style={styles.productName}>{item.productName}</Text><Text style={styles.productMeta}>{item.sku} · Hệ thống {item.systemQuantity} · Chênh {item.quantityDelta}</Text></View>{selected?.status === 'counting' && canManage && <View style={styles.countInputWrap}><TextInput value={itemValues[item._id] ?? String(item.countedQuantity)} onChangeText={(value) => setItemValues((current) => ({ ...current, [item._id]: value }))} keyboardType="decimal-pad" style={styles.countInput} /><Pressable accessibilityRole="button" accessibilityLabel={`Lưu số đếm ${item.productName}`} onPress={() => void saveCountItem(selected, item._id)}><Check size={17} color={colors.primary} /></Pressable></View>}</View>)}
      {canManage && selected?.status === 'counting' && <ActionButton label={saving ? 'Đang gửi…' : 'Gửi duyệt kiểm kê'} onPress={() => void doAction(selected, 'submit')} disabled={saving} />}
      {canApprove && selected?.status === 'pending_approval' && <ActionButton label={saving ? 'Đang duyệt…' : 'Duyệt và áp dụng chênh lệch'} onPress={() => void doAction(selected, 'approve')} disabled={saving} />}
    </Sheet>
    <InventoryBarcodeScanner visible={scannerOpen} onClose={() => setScannerOpen(false)} onScanned={(code) => { setScannerOpen(false); void scan(code); }} />
  </View>;
}

const styles = StyleSheet.create({
  panel: { flex: 1, paddingHorizontal: 14, paddingTop: 12 },
  pageHeading: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  pageHeadingCopy: { flex: 1 },
  pageTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  pageSubtitle: { color: colors.muted, fontSize: 9, marginTop: 3 },
  primaryIconButton: { minHeight: 35, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 11, borderRadius: 11, backgroundColor: colors.primary },
  primaryIconButtonText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  searchField: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 11, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.white },
  searchInput: { flex: 1, minHeight: 40, paddingVertical: 7, color: colors.ink, fontSize: 11 },
  searchAndFilter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchGrow: { flex: 1, minWidth: 0 },
  filterTrigger: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 11, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.white },
  filterTriggerActive: { backgroundColor: '#EEF4FF', borderColor: '#C9DAFF' },
  filterTriggerText: { color: '#52627A', fontSize: 10, fontWeight: '800' },
  filterTriggerTextActive: { color: colors.primary },
  filterCount: { minWidth: 17, height: 17, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderRadius: 9, backgroundColor: colors.primary },
  filterCountText: { color: colors.white, fontSize: 8, fontWeight: '800' },
  filterChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  filterChoice: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.white },
  filterChoiceSelected: { borderColor: '#C9DAFF', backgroundColor: '#EEF4FF' },
  filterChoiceText: { color: '#52627A', fontSize: 10, fontWeight: '700' },
  filterChoiceTextSelected: { color: colors.primary },
  filterFooter: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 14 },
  clearFilterButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13, borderRadius: 11, backgroundColor: '#EDF0F5' },
  clearFilterText: { color: colors.ink, fontSize: 10, fontWeight: '800' },
  applyFilterButton: { flex: 1, minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 11, backgroundColor: colors.primary },
  applyFilterText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  listContent: { paddingTop: 2, paddingBottom: 24, gap: 9 },
  receiptsListContent: { paddingTop: 2, paddingBottom: 24, gap: 5 },
  productCard: { padding: 12, borderRadius: 15 },
  productCardTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  productGlyph: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#EEF4FF' },
  productCardCopy: { flex: 1, minWidth: 0 },
  productName: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  productMeta: { color: colors.muted, fontSize: 8, lineHeight: 13, marginTop: 3 },
  productDetailsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 10 },
  productDetailText: { color: colors.muted, fontSize: 8 },
  dot: { color: '#BCC5D2', fontSize: 10 },
  statusPill: { alignSelf: 'flex-start', flexShrink: 0, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 9 },
  statusPillText: { fontSize: 8, fontWeight: '800', textTransform: 'capitalize' },
  productActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end', marginTop: 9, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F0F2F6' },
  smallAction: { minHeight: 29, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 9, backgroundColor: '#EEF4FF' },
  smallActionText: { color: colors.primary, fontSize: 9, fontWeight: '800' },
  smallActionDanger: { minHeight: 29, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 9, backgroundColor: '#FFF3F2' },
  smallActionDangerText: { color: '#B54745', fontSize: 9, fontWeight: '800' },
  productActionsDanger: { color: '#B54745' },
  errorBanner: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, marginBottom: 6, borderRadius: 10, backgroundColor: '#FFF3F2' },
  errorBannerText: { flex: 1, color: '#A33D3A', fontSize: 9, lineHeight: 13 },
  linkText: { color: colors.primary, fontSize: 9, fontWeight: '800' },
  loadingState: { minHeight: 105, alignItems: 'center', justifyContent: 'center' },
  emptyCard: { minHeight: 145, alignItems: 'center', justifyContent: 'center', padding: 18, borderRadius: 15 },
  emptyTitle: { color: colors.ink, fontSize: 11, fontWeight: '800', marginTop: 8 },
  emptyCopy: { color: colors.muted, fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: 4 },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 7 },
  inlineActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionLabel: { color: colors.ink, fontSize: 10, fontWeight: '800' },
  metricCard: { flex: 1, minWidth: 0, minHeight: 66, justifyContent: 'center', paddingHorizontal: 9, paddingVertical: 8, borderRadius: 13 },
  metricsRow: { flexDirection: 'row', gap: 7, marginBottom: 10 },
  metricLabel: { color: colors.muted, fontSize: 8, fontWeight: '600' },
  metricValue: { color: colors.ink, fontSize: 15, fontWeight: '800', marginTop: 5 },
  metricValueCompact: { fontSize: 10 },
  balanceCard: { padding: 12, borderRadius: 15 },
  balanceTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  balanceStats: { flexDirection: 'row', justifyContent: 'space-between', gap: 6, marginTop: 13, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F0F2F6' },
  balanceLabel: { color: colors.muted, fontSize: 8 },
  balanceValue: { color: colors.ink, fontSize: 10, fontWeight: '800', marginTop: 4 },
  balanceFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  recordCard: { padding: 12, borderRadius: 15 },
  receiptCard: { padding: 9, borderRadius: 14 },
  recordHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  recordMetaRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 5, marginTop: 10 },
  receiptMetaRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 4, marginTop: 6 },
  recordDescription: { color: colors.muted, fontSize: 9, lineHeight: 15, marginTop: 10 },
  recordActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, justifyContent: 'flex-end', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F0F2F6' },
  receiptActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end', marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#F0F2F6' },
  greenGlyph: { backgroundColor: '#E8F7F0' },
  orangeGlyph: { backgroundColor: '#FFF3E5' },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.4)' },
  sheet: { maxHeight: '93%', minHeight: '35%', paddingHorizontal: 16, paddingBottom: 22, borderTopLeftRadius: 23, borderTopRightRadius: 23, backgroundColor: colors.background },
  sheetHandle: { width: 38, height: 4, alignSelf: 'center', marginTop: 9, marginBottom: 10, borderRadius: 2, backgroundColor: '#CBD3DF' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  sheetTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  sheetSubtitle: { color: colors.muted, fontSize: 9, marginTop: 3 },
  closeButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#EDF0F5' },
  sheetContent: { paddingTop: 4, paddingBottom: 12 },
  fieldWrap: { marginTop: 10 },
  fieldLabel: { color: colors.ink, fontSize: 9, fontWeight: '800', marginBottom: 5 },
  input: { minHeight: 40, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.white, color: colors.ink, fontSize: 10 },
  multilineInput: { minHeight: 72, textAlignVertical: 'top' },
  readonlyInput: { backgroundColor: '#F1F3F7' },
  choiceField: { minHeight: 41, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.white },
  choiceFieldText: { flex: 1, color: colors.ink, fontSize: 10, fontWeight: '600' },
  placeholderText: { color: colors.muted },
  pickerBackdrop: { flex: 1, justifyContent: 'center', padding: 18, backgroundColor: 'rgba(15,23,42,0.42)' },
  pickerSheet: { maxHeight: '80%', padding: 14, borderRadius: 18, backgroundColor: colors.white },
  pickerTitle: { color: colors.ink, fontSize: 14, fontWeight: '800', marginBottom: 9 },
  pickerOption: { minHeight: 43, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, marginBottom: 5, borderRadius: 10, backgroundColor: '#F7F9FC' },
  pickerOptionSelected: { backgroundColor: '#EEF4FF' },
  pickerOptionText: { flex: 1, color: colors.ink, fontSize: 10, fontWeight: '600' },
  pickerOptionTextSelected: { color: colors.primary, fontWeight: '800' },
  actionButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12, marginTop: 12, borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  actionButtonPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  actionButtonDanger: { backgroundColor: '#FFF3F2', borderColor: '#F0CDCB' },
  actionButtonText: { color: colors.ink, fontSize: 10, fontWeight: '800' },
  actionButtonTextPrimary: { color: colors.white },
  actionButtonTextDanger: { color: '#B54745' },
  disabled: { opacity: 0.6 },
  choiceRow: { flexDirection: 'row', gap: 7, marginTop: 11 },
  choiceChip: { flex: 1, minHeight: 35, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.white },
  choiceChipActive: { borderColor: '#C9DAFF', backgroundColor: '#EEF4FF' },
  choiceChipText: { color: colors.muted, fontSize: 9, fontWeight: '700' },
  choiceChipTextActive: { color: colors.primary, fontWeight: '800' },
  lineEditor: { marginTop: 2 },
  lineEditorCard: { padding: 10, marginTop: 7, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  lineEditorHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 },
  lineEditorTitle: { color: colors.ink, fontSize: 9, fontWeight: '800' },
  twoColumns: { flexDirection: 'row', gap: 8 },
  productPickerRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#F0F2F6' },
  productPickerName: { color: colors.ink, fontSize: 10, fontWeight: '800' },
  productPickerMeta: { color: colors.muted, fontSize: 8, marginTop: 3 },
  resourceRow: { minHeight: 43, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, borderRadius: 9, marginBottom: 4, backgroundColor: '#F7F9FC' },
  variantCard: { padding: 12, marginTop: 8, borderRadius: 14 },
  variantCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  variantCardCopy: { flex: 1, minWidth: 0 },
  variantName: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  variantSkuRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 8, marginTop: 10, borderRadius: 10, backgroundColor: '#F2F6FC' },
  variantSkuLabel: { color: colors.muted, fontSize: 8, fontWeight: '800' },
  variantSku: { color: colors.ink, fontFamily: 'monospace', fontSize: 12, fontWeight: '800' },
  variantInfoGrid: { flexDirection: 'row', gap: 8, marginTop: 10 },
  variantInfoCell: { flex: 1, minWidth: 0, padding: 8, borderRadius: 9, backgroundColor: '#F8FAFD' },
  variantInfoLabel: { color: colors.muted, fontSize: 7, fontWeight: '800' },
  variantInfoValue: { color: colors.ink, fontSize: 9, fontWeight: '700', marginTop: 4 },
  variantPriceRow: { flexDirection: 'row', gap: 20, paddingTop: 9, marginTop: 9, borderTopWidth: 1, borderTopColor: '#F0F2F6' },
  variantSalePrice: { color: colors.primary, fontSize: 11, fontWeight: '800', marginTop: 4 },
  variantActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 7, paddingTop: 9, marginTop: 9, borderTopWidth: 1, borderTopColor: '#F0F2F6' },
  variantActionButton: { minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 9, borderRadius: 9, backgroundColor: '#EEF4FF' },
  variantActionText: { color: colors.primary, fontSize: 9, fontWeight: '800' },
  variantActionDanger: { minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 9, borderRadius: 9, backgroundColor: '#FFF3F2' },
  variantActionDangerText: { color: '#B54745', fontSize: 9, fontWeight: '800' },
  variantDetailList: { overflow: 'hidden', borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.white },
  variantDetailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingHorizontal: 11, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F2F6' },
  variantDetailValue: { flex: 1, color: colors.ink, fontSize: 10, fontWeight: '700', textAlign: 'right' },
  deleteSkuNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 12, borderWidth: 1, borderColor: '#F0CDCB', borderRadius: 12, backgroundColor: '#FFF3F2' },
  deleteSkuText: { flex: 1, color: '#7A3331', fontSize: 10, lineHeight: 16 },
  deleteSkuButton: { flex: 1, minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 11, backgroundColor: '#B54745' },
  deleteSkuButtonText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  countItem: { minHeight: 55, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E9EDF4' },
  countInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  countInput: { width: 58, height: 34, textAlign: 'center', color: colors.ink, fontSize: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.white },
  cameraScanButton: { minHeight: 43, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8, borderRadius: 11, backgroundColor: colors.primary },
  cameraScanButtonText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  scannerHelp: { color: colors.muted, fontSize: 9, textAlign: 'center', marginTop: 7, marginBottom: 4 },
  lastScannedNotice: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 9, marginTop: 8, borderRadius: 9, backgroundColor: '#EEF4FF' },
  lastScannedText: { flex: 1, color: colors.primary, fontSize: 9, fontWeight: '700' },
  scannerRoot: { flex: 1, backgroundColor: '#000' },
  scannerOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between', alignItems: 'center', paddingTop: 52, paddingBottom: 44, paddingHorizontal: 20 },
  scannerHeader: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 12 },
  scannerTitle: { color: colors.white, fontSize: 17, fontWeight: '800' },
  scannerSubtitle: { color: '#E5E7EB', fontSize: 11, marginTop: 4 },
  scannerClose: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.5)' },
  scannerTarget: { width: '88%', height: 190, maxWidth: 360, borderRadius: 16 },
  scannerCornerTopLeft: { position: 'absolute', top: 0, left: 0, width: 30, height: 30, borderTopWidth: 4, borderLeftWidth: 4, borderColor: '#fff', borderTopLeftRadius: 13 },
  scannerCornerTopRight: { position: 'absolute', top: 0, right: 0, width: 30, height: 30, borderTopWidth: 4, borderRightWidth: 4, borderColor: '#fff', borderTopRightRadius: 13 },
  scannerCornerBottomLeft: { position: 'absolute', bottom: 0, left: 0, width: 30, height: 30, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: '#fff', borderBottomLeftRadius: 13 },
  scannerCornerBottomRight: { position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderBottomWidth: 4, borderRightWidth: 4, borderColor: '#fff', borderBottomRightRadius: 13 },
  scannerHint: { color: colors.white, fontSize: 11, textAlign: 'center', paddingHorizontal: 16 },
  scannerPermission: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, backgroundColor: colors.background },
  scannerTitleDark: { color: colors.ink, fontSize: 16, fontWeight: '800', marginTop: 14 },
  scannerPermissionCopy: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 8 },
  scannerPermissionButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, marginTop: 18, borderRadius: 11, backgroundColor: colors.primary },
  scannerPermissionButtonText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  scannerCancel: { padding: 12, marginTop: 6 },
  scannerCancelText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  serialCard: { padding: 11, gap: 8, borderRadius: 14 },
  inlineNotice: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 9, marginTop: 8, borderRadius: 9, backgroundColor: '#E8F7F0' },
  inlineNoticeText: { color: '#16885A', fontSize: 9, fontWeight: '700' },
});
