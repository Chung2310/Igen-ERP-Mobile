import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Check, ChevronDown, Coins, Gift, Plus, Search, ShoppingBag, SlidersHorizontal, Sparkles, Ticket, User, X } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { getAccessToken } from '@/core/auth/authSession';
import { DateTimeField } from '@/features/quotation/DateTimeField';
import {
  retailApi,
  type RetailAfterSale,
  type RetailCoupon,
  type RetailCouponAutomation,
  type RetailInvoice,
  type RetailOrder,
  type RetailPointCustomer,
  type RetailPointPolicy,
  type RetailReport,
  type RetailScope,
  type RetailSettings,
  type RetailShift,
  type RetailShiftCashier,
  type RetailShiftOpenInput,
  type RetailWarrantyRow,
} from '@/features/retail/retailApi';
import { repairApi } from '@/features/repairApi';
import type { PhoneWarrantyLookupResult, WarrantyLookupResult } from '@/features/repairApi';

export type RetailAuxTab = 'warranty' | 'returns' | 'invoices' | 'reports' | 'shifts' | 'finance' | 'settings' | 'coupons';
type Props = { tab: RetailAuxTab; scope: RetailScope; canManage: boolean; canManagePoints: boolean; terminalId: string; currentCashierId: string };

const money = (value?: number | null) => value == null ? '—' : `${Math.round(Number(value)).toLocaleString('vi-VN')} VND`;
const formatVndInput = (value: string | number | null | undefined) => {
  const digits = String(value ?? '').replace(/[^\d]/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('vi-VN');
};
const parseVndInput = (value: string) => Number(String(value || '').replace(/[^\d]/g, '')) || 0;
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const key = () => globalThis.crypto?.randomUUID?.() || `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const dateLabel = (value?: string) => value ? new Date(value).toLocaleDateString('vi-VN') : '—';

function paymentLabel(method?: string) {
  return ({
    cash: 'Tiền mặt',
    card: 'Thẻ',
    transfer: 'Chuyển khoản',
    ewallet: 'Ví điện tử',
  } as Record<string, string>)[method || ''] || method || '—';
}

function warrantyStatus(status: string) {
  return ({
    active: 'Còn bảo hành',
    expiring: 'Sắp hết hạn',
    expired: 'Hết bảo hành',
    pending: 'Chưa bắt đầu',
    none: 'Không áp dụng',
    unrecorded: 'Chưa ghi nhận',
  } as Record<string, string>)[status] || status;
}

function warrantyBadgeColors(status?: string) {
  switch (status) {
    case 'active':
      return { bg: '#ECFDF3', fg: '#027A48' };
    case 'expiring':
      return { bg: '#FFF7ED', fg: '#C2410C' };
    case 'expired':
      return { bg: '#FEF3F2', fg: '#B42318' };
    case 'pending':
      return { bg: '#EFF6FF', fg: '#1D4ED8' };
    default:
      return { bg: '#F1F5F9', fg: '#475569' };
  }
}

function shiftStatusMeta(status?: string) {
  switch (status) {
    case 'open':
      return { label: 'Đang mở', bg: '#ECFDF3', fg: '#027A48' };
    case 'closed':
      return { label: 'Đã đóng', bg: '#FFF7ED', fg: '#C2410C' };
    case 'reconciled':
      return { label: 'Đã đối soát', bg: '#EFF6FF', fg: '#1D4ED8' };
    default:
      return { label: status || '—', bg: '#F1F5F9', fg: '#475569' };
  }
}

function orderStatusLabel(status?: string) {
  return ({
    completed: 'Hoàn tất',
    confirmed: 'Đã xác nhận',
    cancelled: 'Đã hủy',
    draft: 'Nháp',
  } as Record<string, string>)[status || ''] || status || '—';
}

function paymentStatusLabel(status?: string) {
  return ({
    paid: 'Đã thanh toán',
    partial: 'Thanh toán một phần',
    unpaid: 'Chưa thanh toán',
    refunded: 'Đã hoàn tiền',
  } as Record<string, string>)[status || ''] || status || '—';
}

function costBearerLabel(value?: string) {
  return ({
    customer: 'Khách hàng',
    supplier: 'Nhà cung cấp',
    shop: 'Cửa hàng',
    company: 'Cửa hàng',
    store: 'Cửa hàng',
    shared: 'Chia sẻ',
    warranty: 'Bảo hành hãng',
  } as Record<string, string>)[(value || '').toLowerCase()] || value || '—';
}

function ledgerTypeLabel(type?: string) {
  return ({
    earn: 'Tích điểm',
    redeem: 'Tiêu điểm',
    adjust: 'Điều chỉnh',
    refund: 'Hoàn điểm',
    expire: 'Hết hạn',
  } as Record<string, string>)[type || ''] || type || '—';
}

export function RetailAuxPanel(props: Props) {
  switch (props.tab) {
    case 'warranty': return <WarrantyPanel scope={props.scope} />;
    case 'returns': return <ReturnsPanel scope={props.scope} canManage={props.canManage} />;
    case 'invoices': return <InvoicesPanel scope={props.scope} canManage={props.canManage} />;
    case 'reports': return <ReportsPanel scope={props.scope} />;
    case 'shifts': return <ShiftsPanel scope={props.scope} terminalId={props.terminalId} currentCashierId={props.currentCashierId} />;
    case 'finance': return <FinancePanel scope={props.scope} />;
    case 'settings': return <SettingsPanel scope={props.scope} />;
    case 'coupons': return <CouponsPanel scope={props.scope} canManagePoints={props.canManagePoints} />;
  }
}

export function RetailShiftOpenModal({
  visible,
  cashiers,
  cashiersLoading,
  saving,
  error,
  initialCashierId,
  onClose,
  onOpen,
}: {
  visible: boolean;
  cashiers: RetailShiftCashier[];
  cashiersLoading: boolean;
  saving: boolean;
  error: string;
  initialCashierId: string;
  onClose: () => void;
  onOpen: (input: RetailShiftOpenInput) => void;
}) {
  const [cashierId, setCashierId] = useState('');
  const [openingFloat, setOpeningFloat] = useState('0');
  const [cashierSearch, setCashierSearch] = useState('');
  const [cashierPickerOpen, setCashierPickerOpen] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setCashierId(initialCashierId);
    setOpeningFloat('0');
    setCashierSearch('');
    setCashierPickerOpen(false);
  }, [initialCashierId, visible]);

  const selectedCashier = cashiers.find((cashier) => cashier.id === cashierId);
  const filteredCashiers = cashiers.filter((cashier) => cashier.name.toLowerCase().includes(cashierSearch.trim().toLowerCase()));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { if (!saving) onClose(); }}>
      <Pressable style={s.modalBackdrop} onPress={() => { if (!saving) onClose(); }}>
        <Pressable style={s.modalSheet} onPress={() => { }}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Mở ca POS</Text>
            <Pressable accessibilityRole="button" disabled={saving} onPress={onClose} style={s.modalCloseBtn}>
              <X size={18} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingTop: 6, paddingBottom: 4 }}>
            <View style={{ gap: 6 }}>
              <Text style={s.label}>Nhân viên bán hàng</Text>
              <Pressable accessibilityRole="button" disabled={cashiersLoading || saving} onPress={() => setCashierPickerOpen((open) => !open)} style={s.selectField}>
                <Text style={[s.selectFieldText, !selectedCashier && s.selectPlaceholder]} numberOfLines={1}>
                  {selectedCashier?.name || (cashiersLoading ? 'Đang tải nhân viên…' : 'Chọn nhân viên POS')}
                </Text>
                {cashiersLoading ? <ActivityIndicator size="small" color={colors.primary} /> : <ChevronDown size={18} color={colors.muted} />}
              </Pressable>
              {cashierPickerOpen && (
                <View style={s.cashierPicker}>
                  <Field label="Tìm nhân viên" value={cashierSearch} onChangeText={setCashierSearch} placeholder="Nhập tên nhân viên" />
                  <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 210 }}>
                    {filteredCashiers.map((cashier) => {
                      const active = cashier.id === cashierId;
                      return (
                        <Pressable key={cashier.id} accessibilityRole="button" onPress={() => { setCashierId(cashier.id); setCashierPickerOpen(false); }} style={[s.cashierOption, active && s.cashierOptionSelected]}>
                          <Text style={[s.cashierOptionText, active && s.cashierOptionTextSelected]}>{cashier.name}</Text>
                          {active && <Check size={17} color={colors.primary} />}
                        </Pressable>
                      );
                    })}
                    {!cashiersLoading && !filteredCashiers.length && <Text style={s.copy}>Không tìm thấy nhân viên phù hợp.</Text>}
                  </ScrollView>
                </View>
              )}
              {!cashiersLoading && !cashiers.length && (
                <Text style={s.warn}>Chưa có nhân viên POS ở chi nhánh này. Trong Nhân sự, gán đúng chi nhánh và quyền POS cho tài khoản.</Text>
              )}
            </View>
            <Field label="Tiền nhận đầu ca (VND)" value={openingFloat} onChangeText={(value) => setOpeningFloat(formatVndInput(value))} keyboardType="numeric" placeholder="0" />
            <ErrorText>{error}</ErrorText>
            <View style={s.row}>
              <View style={{ flex: 1 }}><Action secondary disabled={saving} label="Hủy" onPress={onClose} /></View>
              <View style={{ flex: 1 }}><Action disabled={saving || cashiersLoading || !cashierId} label={saving ? 'Đang mở ca…' : 'Mở ca POS'} onPress={() => onOpen({ cashierId, openingFloat: parseVndInput(openingFloat) })} /></View>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Page({ children, refreshing, onRefresh }: { children: ReactNode; refreshing?: boolean; onRefresh?: () => void }) {
  return (
    <ScrollView
      style={s.page}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} /> : undefined}
    >
      {children}
    </ScrollView>
  );
}

function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'phone-pad';
  multiline?: boolean;
}) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[s.input, multiline && s.multiline]}
      />
    </View>
  );
}

function Action({
  label,
  onPress,
  secondary,
  danger,
  disabled,
  compact,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        s.action,
        compact && s.actionCompact,
        secondary && s.secondary,
        danger && s.danger,
        disabled && s.disabled,
      ]}
    >
      <Text style={[s.actionText, secondary && s.secondaryText]}>{label}</Text>
    </Pressable>
  );
}

function Card({ children, onPress, selected }: { children: ReactNode; onPress?: () => void; selected?: boolean }) {
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={[s.card, selected && s.cardSelected]}>
      {children}
    </Pressable>
  );
}

function Pill({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View style={[s.pill, { backgroundColor: bg }]}>
      <Text style={[s.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

function ErrorText({ children }: { children: string }) {
  return children ? <Text style={s.error}>{children}</Text> : null;
}

function Loading({ busy, error, onRetry }: { busy: boolean; error: string; onRetry: () => void }) {
  return (
    <>
      {busy && <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />}
      {!!error && (
        <View style={{ gap: 8 }}>
          <Text style={s.error}>{error}</Text>
          <Action label="Thử lại" secondary onPress={onRetry} />
        </View>
      )}
    </>
  );
}

function WarrantyPanel({ scope }: { scope: RetailScope }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [days, setDays] = useState(30);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftStatus, setDraftStatus] = useState('all');
  const [draftDays, setDraftDays] = useState(30);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<RetailWarrantyRow[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lookup, setLookup] = useState('');
  const [lookupType, setLookupType] = useState<'serial' | 'phone'>('serial');
  const [lookupResult, setLookupResult] = useState<WarrantyLookupResult | PhoneWarrantyLookupResult | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [selectedRow, setSelectedRow] = useState<RetailWarrantyRow | null>(null);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<RetailOrder | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [detailLookup, setDetailLookup] = useState<WarrantyLookupResult | null>(null);
  const [detailLookupBusy, setDetailLookupBusy] = useState(false);

  const openWarrantyDetail = async (row: RetailWarrantyRow) => {
    setSelectedRow(row);
    setSelectedOrderDetail(null);
    setDetailLookup(null);
    if (!row.orderId) return;
    setDetailBusy(true);
    try {
      const order = await retailApi.orderDetail(scope, row.orderId);
      setSelectedOrderDetail(order);
    } catch {
      setSelectedOrderDetail(null);
    } finally {
      setDetailBusy(false);
    }
  };

  const lookupSerialInDetail = async (serial: string) => {
    setDetailLookupBusy(true);
    try {
      setDetailLookup(await repairApi.lookupBySerial(scope, serial));
    } catch {
      Alert.alert('Không tra cứu được', 'Không thể tra cứu chi tiết thiết bị theo mã này.');
    } finally {
      setDetailLookupBusy(false);
    }
  };

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const result = await retailApi.warrantyOrders(scope, { q: q.trim() || undefined, status, days, page, limit: 30 });
      setRows(result.items || []);
      setTotal(result.total || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được danh sách bảo hành.');
    } finally {
      setBusy(false);
    }
  }, [days, page, q, scope, status]);

  useEffect(() => { void load(); }, [load]);

  const searchLookup = async () => {
    if (!lookup.trim()) {
      setLookupError('Nhập mã máy, IMEI hoặc số điện thoại để tra cứu.');
      return;
    }
    setLookupBusy(true);
    setLookupResult(null);
    setLookupError('');
    try {
      setLookupResult(
        lookupType === 'phone'
          ? await repairApi.lookupByPhone(scope, lookup.trim())
          : await repairApi.lookupBySerial(scope, lookup.trim()),
      );
    } catch (e) {
      setLookupError(e instanceof Error ? e.message : 'Không tra cứu được bảo hành.');
    } finally {
      setLookupBusy(false);
    }
  };

  const openFilter = () => {
    setDraftStatus(status);
    setDraftDays(days);
    setFilterOpen(true);
  };

  const applyFilter = () => {
    setStatus(draftStatus);
    setDays(draftDays);
    setPage(1);
    setFilterOpen(false);
  };

  const resetFilter = () => {
    setDraftStatus('all');
    setDraftDays(30);
    setStatus('all');
    setDays(30);
    setPage(1);
    setFilterOpen(false);
  };

  const activeFilterCount = (status !== 'all' ? 1 : 0) + (days !== 30 ? 1 : 0);
  const totalPages = Math.max(1, Math.ceil(total / 30));

  return (
    <Page refreshing={busy} onRefresh={() => void load()}>
      <Section title="Bảo hành đơn bán" right={<Pill label={`${total.toLocaleString('vi-VN')} dòng`} bg="#EFF6FF" fg={colors.primary} />}>
        <TextInput
          value={q}
          onChangeText={(v) => { setQ(v); setPage(1); }}
          placeholder="Tìm mã đơn, hóa đơn, khách hàng, SKU…"
          placeholderTextColor={colors.muted}
          style={s.input}
        />
        <View style={s.row}>
          <Pressable
            accessibilityRole="button"
            onPress={() => { setLookupError(''); setLookupOpen(true); }}
            style={[s.filterBtn, s.filterBtnActive, { flex: 1 }]}
          >
            <Search size={16} color="#FFFFFF" />
            <Text style={[s.filterBtnText, s.filterBtnTextActive]}>Tra cứu IMEI / SĐT</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={openFilter}
            style={[s.filterBtn, activeFilterCount > 0 && s.filterBtnActive, { flex: 1 }]}
          >
            <SlidersHorizontal size={16} color={activeFilterCount > 0 ? '#FFFFFF' : colors.ink} />
            <Text style={[s.filterBtnText, activeFilterCount > 0 && s.filterBtnTextActive]}>
              Bộ lọc{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Text>
          </Pressable>
        </View>
        {activeFilterCount > 0 && (
          <View style={s.activeFilterBar}>
            <Text style={s.copy}>
              Đang lọc: {status === 'all' ? 'Tất cả trạng thái' : warrantyStatus(status)} · Sắp hết {days} ngày
            </Text>
          </View>
        )}
        <Loading busy={busy} error={error} onRetry={() => void load()} />
        {rows.map((row) => {
          const badge = warrantyBadgeColors(row.status);
          return (
            <Card key={row.id} onPress={() => void openWarrantyDetail(row)}>
              <View style={s.cardTopRow}>
                <Text numberOfLines={2} style={[s.cardTitle, { flex: 1 }]}>{row.productName}</Text>
                <Pill label={`${warrantyStatus(row.status)}${row.daysLeft != null ? ` · ${row.daysLeft}d` : ''}`} bg={badge.bg} fg={badge.fg} />
              </View>
              <Text style={s.copy}>SKU: {row.sku || '—'} · SL {row.quantity} · Bán {dateLabel(row.soldAt)}</Text>
              <Text style={s.copy}>
                {row.orderCode}{row.invoiceNo ? ` · ${row.invoiceNo}` : ''} · {row.customerName || 'Khách lẻ'}{row.customerPhone ? ` · ${row.customerPhone}` : ''}
              </Text>
              <View style={s.cardFooterRow}>
                <Text style={[s.metaHighlight, { flex: 1 }]}>
                  BH: {row.warrantyStartAt && row.warrantyEndAt ? `${dateLabel(row.warrantyStartAt)} – ${dateLabel(row.warrantyEndAt)}${row.warrantyMonths ? ` (${row.warrantyMonths}T)` : ''}` : 'Chưa ghi nhận'}
                </Text>
                <Text style={[s.copy, { color: colors.primary, fontWeight: '700' }]}>Chi tiết ›</Text>
              </View>
            </Card>
          );
        })}
        {!busy && !rows.length && <Text style={s.empty}>Không có sản phẩm phù hợp.</Text>}
        <View style={s.pagination}>
          <Action secondary compact disabled={page <= 1} label="‹ Trước" onPress={() => setPage((v) => Math.max(1, v - 1))} />
          <Text style={s.pageLabel}>Trang {page} / {totalPages}</Text>
          <Action secondary compact disabled={page >= totalPages} label="Sau ›" onPress={() => setPage((v) => Math.min(totalPages, v + 1))} />
        </View>
      </Section>

      <Modal visible={Boolean(selectedRow)} transparent animationType="fade" onRequestClose={() => setSelectedRow(null)}>
        <Pressable style={s.modalBackdrop} onPress={() => setSelectedRow(null)}>
          <Pressable style={s.modalSheet} onPress={() => { }}>
            <View style={s.modalHeader}>
              <Text numberOfLines={1} ellipsizeMode="middle" style={[s.modalTitle, { flex: 1 }]}>Chi tiết bảo hành</Text>
              <Pressable accessibilityRole="button" onPress={() => setSelectedRow(null)} style={s.modalCloseBtn}>
                <X size={18} color={colors.muted} />
              </Pressable>
            </View>
            {selectedRow && (() => {
              const badge = warrantyBadgeColors(selectedRow.status);
              const matchedItem = selectedOrderDetail?.items.find((item) =>
                (selectedRow.sku && item.sku === selectedRow.sku) || item.productName === selectedRow.productName,
              );
              const deviceCodes = [
                ...(matchedItem?.serialNumbers || []),
                ...(matchedItem?.internalBarcodes || []),
              ];
              return (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingTop: 6 }}>
                  <View style={s.summaryBox}>
                    <View style={s.cardTopRow}>
                      <Text style={[s.cardTitle, { flex: 1 }]}>{selectedRow.productName}</Text>
                      <Pill label={warrantyStatus(selectedRow.status)} bg={badge.bg} fg={badge.fg} />
                    </View>
                    <Text style={s.copy}>SKU: {selectedRow.sku || '—'} · Số lượng: {selectedRow.quantity}</Text>
                    {selectedRow.daysLeft != null && (
                      <Text style={[s.metaHighlight, { color: badge.fg }]}>
                        {selectedRow.daysLeft >= 0 ? `Còn ${selectedRow.daysLeft} ngày bảo hành` : `Đã hết hạn ${Math.abs(selectedRow.daysLeft)} ngày`}
                      </Text>
                    )}
                  </View>

                  <View style={s.detailGroup}>
                    <Text style={s.subHeading}>Thời hạn bảo hành</Text>
                    <View style={s.kvRow}><Text style={s.copy}>Ngày bán</Text><Text style={s.kvVal}>{dateLabel(selectedRow.soldAt)}</Text></View>
                    <View style={s.kvRow}><Text style={s.copy}>Bắt đầu bảo hành</Text><Text style={s.kvVal}>{dateLabel(selectedRow.warrantyStartAt)}</Text></View>
                    <View style={s.kvRow}><Text style={s.copy}>Hết hạn bảo hành</Text><Text style={s.kvVal}>{dateLabel(selectedRow.warrantyEndAt)}</Text></View>
                    <View style={s.kvRow}><Text style={s.copy}>Thời gian bảo hành</Text><Text style={s.kvVal}>{selectedRow.warrantyMonths ? `${selectedRow.warrantyMonths} tháng` : 'Chưa ghi nhận'}</Text></View>
                  </View>

                  <View style={s.detailGroup}>
                    <Text style={s.subHeading}>Đơn hàng & khách hàng</Text>
                    <View style={s.kvRow}><Text style={s.copy}>Mã đơn bán</Text><Text style={s.kvVal}>{selectedRow.orderCode || '—'}</Text></View>
                    {!!selectedRow.invoiceNo && <View style={s.kvRow}><Text style={s.copy}>Số hóa đơn</Text><Text style={s.kvVal}>{selectedRow.invoiceNo}</Text></View>}
                    <View style={s.kvRow}><Text style={s.copy}>Khách hàng</Text><Text style={s.kvVal}>{selectedRow.customerName || 'Khách lẻ'}</Text></View>
                    {!!selectedRow.customerPhone && <View style={s.kvRow}><Text style={s.copy}>Số điện thoại</Text><Text style={s.kvVal}>{selectedRow.customerPhone}</Text></View>}
                    {matchedItem && (
                      <>
                        <View style={s.kvRow}><Text style={s.copy}>Đơn giá</Text><Text style={s.kvVal}>{money(matchedItem.unitPrice || 0)}</Text></View>
                        <View style={s.kvRow}><Text style={s.copy}>Thành tiền</Text><Text style={s.total}>{money(matchedItem.lineTotal)}</Text></View>
                      </>
                    )}
                  </View>

                  {detailBusy && <ActivityIndicator color={colors.primary} style={{ marginVertical: 4 }} />}

                  {deviceCodes.length > 0 && (
                    <View style={s.detailGroup}>
                      <Text style={s.subHeading}>IMEI / Serial / Mã máy ({deviceCodes.length})</Text>
                      <View style={s.chipRow}>
                        {deviceCodes.map((code) => (
                          <Chip
                            key={code}
                            label={detailLookupBusy ? 'Đang tra…' : code}
                            active={detailLookup?.serialNumber === code || detailLookup?.internalBarcode === code}
                            onPress={() => void lookupSerialInDetail(code)}
                          />
                        ))}
                      </View>
                      <Text style={s.copy}>Nhấn vào mã máy để kiểm tra bảo hành khách hàng & nhà cung cấp.</Text>
                    </View>
                  )}

                  {detailLookup && <WarrantyLookupCard result={detailLookup} />}

                  {!!selectedRow.customerPhone && (
                    <Action
                      secondary
                      label="Tra cứu tất cả thiết bị của khách này"
                      onPress={() => {
                        const phone = selectedRow.customerPhone || '';
                        setSelectedRow(null);
                        setLookupType('phone');
                        setLookup(phone);
                        setLookupResult(null);
                        setLookupError('');
                        setLookupOpen(true);
                      }}
                    />
                  )}
                </ScrollView>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={lookupOpen} transparent animationType="fade" onRequestClose={() => setLookupOpen(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setLookupOpen(false)}>
          <Pressable style={s.modalSheet} onPress={() => { }}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Tra cứu bảo hành</Text>
              <Pressable accessibilityRole="button" onPress={() => setLookupOpen(false)} style={s.modalCloseBtn}>
                <X size={18} color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingTop: 6 }}>
              <View style={s.chipRow}>
                <Chip label="IMEI / Serial / Mã máy" active={lookupType === 'serial'} onPress={() => { setLookupType('serial'); setLookupResult(null); setLookupError(''); }} />
                <Chip label="Số điện thoại" active={lookupType === 'phone'} onPress={() => { setLookupType('phone'); setLookupResult(null); setLookupError(''); }} />
              </View>
              <Field
                label={lookupType === 'phone' ? 'Số điện thoại khách hàng' : 'Mã máy / IMEI / Serial'}
                value={lookup}
                onChangeText={setLookup}
                placeholder={lookupType === 'phone' ? 'Nhập số điện thoại' : 'Nhập IMEI, serial hoặc mã máy'}
                keyboardType={lookupType === 'phone' ? 'phone-pad' : 'default'}
              />
              <Action label={lookupBusy ? 'Đang tra cứu…' : 'Tra cứu thời hạn'} disabled={lookupBusy} onPress={() => void searchLookup()} />
              <ErrorText>{lookupError}</ErrorText>
              {lookupResult && lookupType === 'serial' && <WarrantyLookupCard result={lookupResult as WarrantyLookupResult} />}
              {lookupResult && lookupType === 'phone' && <PhoneWarrantyCard result={lookupResult as PhoneWarrantyLookupResult} />}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={filterOpen} transparent animationType="fade" onRequestClose={() => setFilterOpen(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setFilterOpen(false)}>
          <Pressable style={s.modalSheet} onPress={() => { }}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Bộ lọc bảo hành</Text>
              <Pressable accessibilityRole="button" onPress={() => setFilterOpen(false)} style={s.modalCloseBtn}>
                <X size={18} color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingTop: 6 }}>
              <View style={{ gap: 8 }}>
                <Text style={s.label}>Trạng thái bảo hành</Text>
                <View style={s.chipRow}>
                  {['all', 'active', 'expiring', 'expired', 'pending', 'none', 'unrecorded'].map((value) => (
                    <Chip
                      key={value}
                      label={value === 'all' ? 'Tất cả' : warrantyStatus(value)}
                      active={draftStatus === value}
                      onPress={() => setDraftStatus(value)}
                    />
                  ))}
                </View>
              </View>
              <View style={{ gap: 8 }}>
                <Text style={s.label}>Mốc cảnh báo sắp hết hạn</Text>
                <View style={s.chipRow}>
                  {[7, 30, 60, 90].map((value) => (
                    <Chip
                      key={value}
                      label={`Trong ${value} ngày`}
                      active={draftDays === value}
                      onPress={() => setDraftDays(value)}
                    />
                  ))}
                </View>
              </View>
              <View style={s.row}>
                <View style={{ flex: 1 }}><Action secondary label="Đặt lại" onPress={resetFilter} /></View>
                <View style={{ flex: 1 }}><Action label="Áp dụng" onPress={applyFilter} /></View>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </Page>
  );
}

function WarrantyLookupCard({ result }: { result: WarrantyLookupResult }) {
  const badge = warrantyBadgeColors(result.status || 'unrecorded');
  return (
    <Card>
      <View style={s.cardTopRow}>
        <Text style={[s.cardTitle, { flex: 1 }]}>{result.found ? (result.product?.name || 'Đã tìm thấy thiết bị') : 'Không tìm thấy thiết bị'}</Text>
        <Pill label={warrantyStatus(result.status || 'unrecorded')} bg={badge.bg} fg={badge.fg} />
      </View>
      {result.product?.sku && <Text style={s.copy}>SKU: {result.product.sku}</Text>}
      <Text style={s.copy}>Mã máy: {result.serialNumber || result.internalBarcode || '—'}</Text>
      {result.sold && <Text style={s.copy}>Đơn {result.sold.orderCode || '—'} · {result.sold.customerName || 'Khách hàng'} · {dateLabel(result.sold.at)}</Text>}
      <Text style={s.copy}>
        Bảo hành khách: {result.customerWarranty?.covered ? `Còn hiệu lực đến ${dateLabel(result.customerWarranty.endAt)}${result.customerWarranty.daysLeft != null ? ` (còn ${result.customerWarranty.daysLeft} ngày)` : ''}` : 'Không còn hiệu lực'}
      </Text>
      <Text style={s.copy}>
        Bảo hành NCC: {result.supplierWarranty?.covered ? `Còn hiệu lực đến ${dateLabel(result.supplierWarranty.endAt)}${result.supplierWarranty.supplierName ? ` · ${result.supplierWarranty.supplierName}` : ''}` : 'Không còn hiệu lực'}
      </Text>
      <Text style={s.copy}>Đơn vị chịu phí: {costBearerLabel(result.costBearer)}</Text>
    </Card>
  );
}

function PhoneWarrantyCard({ result }: { result: PhoneWarrantyLookupResult }) {
  return (
    <Card>
      <View style={s.cardTopRow}>
        <Text style={[s.cardTitle, { flex: 1 }]}>{result.customer?.name || 'Kết quả theo số điện thoại'}</Text>
        <Pill label={`${result.totalDevices} thiết bị`} bg="#EFF6FF" fg={colors.primary} />
      </View>
      {result.devices.map((device, index) => {
        const badge = warrantyBadgeColors(device.status || 'unrecorded');
        return (
          <View key={`${device.serialNumber || device.internalBarcode || index}`} style={s.subItem}>
            <View style={s.cardTopRow}>
              <Text style={[s.cardTitle, { flex: 1 }]}>{device.product?.name || 'Thiết bị'}</Text>
              <Pill label={warrantyStatus(device.status || 'unrecorded')} bg={badge.bg} fg={badge.fg} />
            </View>
            <Text style={s.copy}>SKU: {device.product?.sku || '—'} · Mã {device.serialNumber || device.internalBarcode || '—'}</Text>
            <Text style={s.copy}>Đơn {device.sold?.orderCode || '—'} · {device.customerWarranty?.covered ? `Hạn đến ${dateLabel(device.customerWarranty.endAt)}` : 'Hết hạn bảo hành khách'}</Text>
          </View>
        );
      })}
    </Card>
  );
}

function ReturnsPanel({ scope, canManage }: { scope: RetailScope; canManage: boolean }) {
  const [rows, setRows] = useState<RetailAfterSale[]>([]);
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftQ, setDraftQ] = useState('');
  const [draftType, setDraftType] = useState('');
  const [orderQuery, setOrderQuery] = useState('');
  const [orders, setOrders] = useState<RetailOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<RetailOrder | null>(null);
  const [lineIndex, setLineIndex] = useState(0);
  const [kind, setKind] = useState<'return' | 'buyback'>('return');
  const [qty, setQty] = useState('1');
  const [amount, setAmount] = useState('');
  const [condition, setCondition] = useState('good');
  const [ids, setIds] = useState('');
  const [reason, setReason] = useState('');
  const [method, setMethod] = useState('cash');
  const [shift, setShift] = useState<RetailShift | null>(null);
  const [saving, setSaving] = useState(false);
  const afterSaleAttempt = useRef<{ fingerprint: string; key: string } | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const result = await retailApi.afterSales(scope, { q: q.trim() || undefined, type: type || undefined, page, limit: 20 });
      setRows(result.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được phiếu đổi trả.');
    } finally {
      setBusy(false);
    }
  }, [page, q, scope, type]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (canManage) void retailApi.currentShift(scope).then(setShift).catch(() => setShift(null)); }, [canManage, scope]);

  const openFilters = () => {
    setDraftQ(q);
    setDraftType(type);
    setFilterOpen(true);
  };
  const applyFilters = () => {
    setQ(draftQ.trim());
    setType(draftType);
    setPage(1);
    setFilterOpen(false);
  };
  const clearFilters = () => {
    setDraftQ('');
    setDraftType('');
    setQ('');
    setType('');
    setPage(1);
    setFilterOpen(false);
  };

  const findOrders = async () => {
    setError('');
    try {
      const result = await retailApi.orders(scope, orderQuery);
      setOrders(result.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tìm được đơn bán.');
    }
  };

  const chooseOrder = async (order: RetailOrder) => {
    setSelectedOrder(order);
    setLineIndex(0);
    setError('');
    try {
      setSelectedOrder(await retailApi.orderDetail(scope, order._id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được chi tiết đơn gốc.');
    }
  };

  const submit = async () => {
    if (!selectedOrder || !reason.trim()) { setError('Chọn đơn bán và nhập lý do.'); return; }
    const line = selectedOrder.items[lineIndex];
    const quantity = Number(qty);
    const unitAmount = parseVndInput(amount);
    if (!line || !Number.isSafeInteger(quantity) || quantity < 1) { setError('Số lượng không hợp lệ.'); return; }
    const serialNumbers = ids.split(/[\s,;]+/).filter(Boolean);
    if (kind === 'buyback' && (!Number.isSafeInteger(unitAmount) || unitAmount < 0)) { setError('Nhập giá thu mua hợp lệ cho từng sản phẩm.'); return; }
    if ((serialNumbers.length || line.serialNumbers?.length || line.internalBarcodes?.length) && serialNumbers.length !== quantity) {
      setError('Nhập đủ IMEI/serial/mã máy theo số lượng xử lý.');
      return;
    }
    const payload = {
      type: kind,
      orderId: selectedOrder._id,
      expectedVersion: selectedOrder.version,
      items: [{
        orderLineIndex: lineIndex,
        quantity,
        ...(kind === 'buyback' ? { unitAmount } : {}),
        condition,
        ...(line.serialNumbers?.length ? { serialNumbers } : {}),
        ...(line.internalBarcodes?.length ? { internalBarcodes: serialNumbers } : {}),
      }],
      paymentMethod: method,
      ...(method === 'cash' && shift?._id ? { cashSessionId: shift._id } : {}),
      reason: reason.trim(),
    };
    const fingerprint = JSON.stringify(payload);
    if (afterSaleAttempt.current?.fingerprint !== fingerprint) afterSaleAttempt.current = { fingerprint, key: key() };
    setSaving(true);
    setError('');
    try {
      await retailApi.createAfterSale(scope, { ...payload, idempotencyKey: afterSaleAttempt.current.key });
      afterSaleAttempt.current = null;
      Alert.alert('Đã tạo phiếu', 'Chứng từ đổi trả đã được ghi nhận.');
      setShowCreate(false);
      setSelectedOrder(null);
      setReason('');
      setIds('');
      setAmount('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tạo được phiếu đổi trả.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page refreshing={busy} onRefresh={() => void load()}>
      <Section
        title="Đổi trả & thu mua"
        right={(
          <View style={s.headerActions}>
            <Action compact secondary label={`Bộ lọc${q || type ? ' •' : ''}`} onPress={openFilters} />
            {canManage && <Action compact label="+ Tạo mới" onPress={() => setShowCreate(true)} />}
          </View>
        )}
      >
        {q || type ? (
          <View style={s.activeFilterBar}>
            <Text style={[s.copy, { flex: 1 }]} numberOfLines={2}>
              Đang lọc: {q ? `“${q}”` : ''}{q && type ? ' · ' : ''}{type === 'return' ? 'Khách trả hàng' : type === 'buyback' ? 'Thu mua hàng cũ' : ''}
            </Text>
            <Pressable accessibilityRole="button" onPress={clearFilters}><Text style={s.filterClearText}>Xóa</Text></Pressable>
          </View>
        ) : null}
        {canManage && <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => { if (!saving) setShowCreate(false); }}>
          <Pressable style={s.modalBackdrop} onPress={() => { if (!saving) setShowCreate(false); }}>
            <Pressable style={s.modalSheet} onPress={() => { }}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>Tạo phiếu đổi trả</Text>
                <Pressable accessibilityRole="button" disabled={saving} onPress={() => setShowCreate(false)} style={s.modalCloseBtn}>
                  <X size={18} color={colors.muted} />
                </Pressable>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingTop: 6, paddingBottom: 6 }}>
                <View style={s.formBox}>
                  <Text style={s.subHeading}>Tạo chứng từ hậu mãi</Text>
                  <View style={s.chipRow}>
                    <Chip label="Khách trả hàng" active={kind === 'return'} onPress={() => setKind('return')} />
                    <Chip label="Thu mua hàng cũ" active={kind === 'buyback'} onPress={() => setKind('buyback')} />
                  </View>
                  {selectedOrder ? (
                    <View style={s.cardTopRow}>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={s.label}>Đơn đã chọn</Text>
                        <Text numberOfLines={1} ellipsizeMode="middle" style={s.cardTitle}>{selectedOrder.orderCode || selectedOrder._id}</Text>
                        <Text style={s.copy}>
                          {selectedOrder.customerName || 'Khách lẻ'} · {paymentStatusLabel(selectedOrder.paymentStatus)} · {money(selectedOrder.grandTotal)}
                        </Text>
                      </View>
                      <Action compact secondary label="Đổi đơn" onPress={() => {
                        setSelectedOrder(null);
                        setLineIndex(0);
                        setQty('1');
                        setAmount('');
                        setIds('');
                      }} />
                    </View>
                  ) : (
                    <>
                      <Field label="Mã đơn bán" value={orderQuery} onChangeText={setOrderQuery} placeholder="Nhập mã đơn hoặc tên khách" />
                      <Action secondary label="Tìm đơn bán đã thanh toán" onPress={() => void findOrders()} />
                      {orders.map((order) => (
                        <Card key={order._id} onPress={() => void chooseOrder(order)}>
                          <View style={s.cardTopRow}>
                            <Text numberOfLines={1} ellipsizeMode="middle" style={[s.cardTitle, { flex: 1 }]}>{order.orderCode || order._id}</Text>
                            <Text style={s.total}>{money(order.grandTotal)}</Text>
                          </View>
                          <Text style={s.copy}>
                            {order.customerName || 'Khách lẻ'} · {paymentStatusLabel(order.paymentStatus)} · {orderStatusLabel(order.status)}
                          </Text>
                        </Card>
                      ))}
                    </>
                  )}
                  {selectedOrder && (
                    <>
                      <Text style={s.label}>Chọn sản phẩm trong đơn</Text>
                      {selectedOrder.items.map((line, index) => (
                        <Card key={`${line.sku}-${index}`} selected={index === lineIndex} onPress={() => setLineIndex(index)}>
                          <Text style={[s.cardTitle, index === lineIndex && s.accent]}>{line.productName} · {line.sku}</Text>
                          <Text style={s.copy}>SL {line.quantity} · {money(line.unitPrice || line.lineTotal)}</Text>
                        </Card>
                      ))}
                      <View style={s.row}>
                        <Field label="Số lượng" value={qty} onChangeText={(v) => setQty(v.replace(/[^\d]/g, ''))} keyboardType="numeric" />
                        {kind === 'buyback' && (
                          <Field label="Giá thu mua / SP (VND)" value={amount} onChangeText={(v) => setAmount(formatVndInput(v))} keyboardType="numeric" placeholder="0" />
                        )}
                      </View>
                      <Text style={s.label}>Tình trạng sản phẩm</Text>
                      <View style={s.chipRow}>
                        {[['like_new', 'Như mới'], ['good', 'Tốt'], ['fair', 'Trung bình'], ['poor', 'Cũ / lỗi']].map(([value, label]) => (
                          <Chip key={value} label={label} active={condition === value} onPress={() => setCondition(value)} />
                        ))}
                      </View>
                      {(selectedOrder.items[lineIndex]?.serialNumbers?.length || selectedOrder.items[lineIndex]?.internalBarcodes?.length) ? (
                        <Field label="IMEI / Serial / Mã máy" value={ids} onChangeText={setIds} placeholder="Mỗi mã cách nhau bằng dấu phẩy" multiline />
                      ) : null}
                      <Text style={s.label}>Phương thức hoàn / chi</Text>
                      <View style={s.chipRow}>
                        {[['cash', 'Tiền mặt'], ['card', 'Thẻ'], ['transfer', 'Chuyển khoản'], ['ewallet', 'Ví điện tử']].map(([value, label]) => (
                          <Chip key={value} label={label} active={method === value} onPress={() => setMethod(value)} />
                        ))}
                      </View>
                      {method === 'cash' && !shift && <Text style={s.warn}>Chưa có ca POS đang mở; chọn phương thức khác hoặc mở ca POS trước.</Text>}
                      <Field label="Lý do (bắt buộc)" value={reason} onChangeText={setReason} placeholder="Nhập lý do đổi trả hoặc thu mua" multiline />
                      <Action disabled={saving || (method === 'cash' && !shift)} label={saving ? 'Đang ghi phiếu…' : 'Xác nhận tạo phiếu'} onPress={() => void submit()} />
                      <ErrorText>{error}</ErrorText>
                    </>
                  )}
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>}

        <Loading busy={busy} error={error} onRetry={() => void load()} />
        {rows.map((row) => (
          <Card key={row._id}>
            <View style={s.cardTopRow}>
              <Text numberOfLines={1} ellipsizeMode="middle" style={[s.cardTitle, { flex: 1 }]}>{row.code}</Text>
              <Pill
                label={row.type === 'return' ? 'Khách trả hàng' : 'Thu mua hàng cũ'}
                bg={row.type === 'return' ? '#FFF7ED' : '#EFF6FF'}
                fg={row.type === 'return' ? '#C2410C' : '#1D4ED8'}
              />
            </View>
            <Text style={s.copy}>{row.orderCode} · {row.customerName || 'Khách lẻ'} · {dateLabel(row.createdAt)}</Text>
            <Text style={s.copy}>{row.items.map((line) => `${line.productName} × ${line.quantity}`).join(' · ')}</Text>
            <View style={s.cardFooterRow}>
              <Text style={s.copy}>{paymentLabel(row.paymentMethod)}</Text>
              <Text style={s.total}>{money(row.totalAmount)}</Text>
            </View>
            {!!row.reason && <Text style={s.copy}>Lý do: {row.reason}</Text>}
          </Card>
        ))}
        {!busy && !rows.length && <Text style={s.empty}>Chưa có chứng từ đổi trả.</Text>}
        <View style={s.pagination}>
          <Action secondary compact disabled={page <= 1} label="‹ Trước" onPress={() => setPage((v) => Math.max(1, v - 1))} />
          <Text style={s.pageLabel}>Trang {page}</Text>
          <Action secondary compact disabled={rows.length < 20} label="Sau ›" onPress={() => setPage((v) => v + 1)} />
        </View>
      </Section>
      <Modal visible={filterOpen} transparent animationType="fade" onRequestClose={() => setFilterOpen(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setFilterOpen(false)}>
          <Pressable style={s.modalSheet} onPress={() => { }}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Lọc chứng từ đổi trả</Text>
              <Pressable accessibilityRole="button" onPress={() => setFilterOpen(false)} style={s.modalCloseBtn}>
                <X size={18} color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingTop: 6 }}>
              <Field label="Tìm phiếu / đơn / khách hàng" value={draftQ} onChangeText={setDraftQ} placeholder="Nhập từ khóa" />
              <View style={{ gap: 8 }}>
                <Text style={s.label}>Loại chứng từ</Text>
                <View style={s.chipRow}>
                  {[['', 'Tất cả'], ['return', 'Khách trả'], ['buyback', 'Thu mua']].map(([value, label]) => (
                    <Chip key={value} label={label} active={draftType === value} onPress={() => setDraftType(value)} />
                  ))}
                </View>
              </View>
              <View style={s.row}>
                <View style={{ flex: 1 }}><Action secondary label="Xóa bộ lọc" onPress={clearFilters} /></View>
                <View style={{ flex: 1 }}><Action label="Áp dụng" onPress={applyFilters} /></View>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
      <ErrorText>{error}</ErrorText>
    </Page>
  );
}

function InvoicesPanel({ scope, canManage }: { scope: RetailScope; canManage: boolean }) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<RetailInvoice[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<RetailInvoice | null>(null);
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const result = await retailApi.invoices(scope, { q: q.trim() || undefined, page, limit: 20 });
      setRows(result.items || []);
      setTotal(result.total || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được hóa đơn.');
    } finally {
      setBusy(false);
    }
  }, [page, q, scope]);

  useEffect(() => { void load(); }, [load]);

  const open = async (invoice: RetailInvoice) => {
    setError('');
    try {
      setSelected(await retailApi.invoiceDetail(scope, invoice._id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được chi tiết hóa đơn.');
    }
  };

  const reprint = async () => {
    if (!selected || !canManage) return;
    try {
      setSelected(await retailApi.reprintInvoice(scope, selected._id));
      Alert.alert('Đã ghi nhận', 'ERP đã ghi nhận lượt in lại hóa đơn.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không in lại được hóa đơn.');
    }
  };

  const sharePdf = async () => {
    if (!selected || !canManage) return;
    if (Platform.OS === 'web') { setError('Chia sẻ PDF cần mở phân hệ này trên ứng dụng iOS hoặc Android.'); return; }
    const configured = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');
    if (!configured) { setError('Chưa cấu hình địa chỉ ERP để tải PDF.'); return; }
    const base = /\/api\/v1$/i.test(configured) ? configured : `${configured}/api/v1`;
    const query = new URLSearchParams({ companyCode: scope.companyCode, branchId: scope.branchId });
    const token = getAccessToken();
    if (!token) { setError('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại rồi thử tải PDF.'); return; }
    setPdfBusy(true);
    setError('');
    try {
      const root = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      if (!root) throw new Error('Không có thư mục lưu PDF trên thiết bị.');
      const filename = `${selected.invoiceNo.replace(/[^\p{L}\p{N}._-]/gu, '-') || 'hoa-don'}.pdf`;
      const result = await FileSystem.downloadAsync(
        `${base}/retail/invoices/${encodeURIComponent(selected._id)}/pdf?${query.toString()}`,
        `${root}${filename}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (result.status < 200 || result.status >= 300) throw new Error(`ERP không trả được PDF (HTTP ${result.status}).`);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(result.uri, { mimeType: 'application/pdf', dialogTitle: `Hóa đơn ${selected.invoiceNo}` });
      else Alert.alert('Đã tải PDF', result.uri);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải hoặc chia sẻ được PDF hóa đơn.');
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <Page refreshing={busy} onRefresh={() => void load()}>
      <Section title="Hóa đơn bán lẻ" right={<Pill label={`${total.toLocaleString('vi-VN')} hóa đơn`} bg="#EFF6FF" fg={colors.primary} />}>
        <Field label="Tìm hóa đơn / đơn bán / khách hàng" value={q} onChangeText={(v) => { setQ(v); setPage(1); }} placeholder="Mã hóa đơn, đơn hàng hoặc khách" />
        <Loading busy={busy} error={error} onRetry={() => void load()} />
        {rows.map((invoice) => (
          <Card key={invoice._id} onPress={() => void open(invoice)}>
            <View style={s.cardTopRow}>
              <Text numberOfLines={1} ellipsizeMode="middle" style={[s.cardTitle, { flex: 1 }]}>{invoice.invoiceNo}</Text>
              <Pill
                label={invoice.status === 'issued' ? 'Đã phát hành' : 'Đã hủy'}
                bg={invoice.status === 'issued' ? '#ECFDF3' : '#FEF3F2'}
                fg={invoice.status === 'issued' ? '#027A48' : '#B42318'}
              />
            </View>
            <Text style={s.copy}>{invoice.orderCode} · {invoice.snapshot.customerName} · {dateLabel(invoice.issuedAt)}</Text>
            <View style={s.cardFooterRow}>
              <Text style={s.copy}>Nhấn để xem chi tiết</Text>
              <Text style={s.total}>{money(invoice.snapshot.grandTotal)}</Text>
            </View>
          </Card>
        ))}
        {!busy && !rows.length && <Text style={s.empty}>Không tìm thấy hóa đơn.</Text>}
        <View style={s.pagination}>
          <Action secondary compact disabled={page <= 1} label="‹ Trước" onPress={() => setPage((v) => Math.max(1, v - 1))} />
          <Text style={s.pageLabel}>Trang {page}</Text>
          <Action secondary compact disabled={rows.length < 20} label="Sau ›" onPress={() => setPage((v) => v + 1)} />
        </View>
      </Section>

      <Modal visible={Boolean(selected)} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={s.modalBackdrop}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text numberOfLines={1} ellipsizeMode="middle" style={[s.modalTitle, { flex: 1 }]}>
                Hóa đơn {selected?.invoiceNo}
              </Text>
              <Pressable accessibilityRole="button" onPress={() => setSelected(null)} style={s.modalCloseBtn}>
                <X size={18} color={colors.muted} />
              </Pressable>
            </View>
            {selected && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingTop: 6 }}>
                <View style={s.summaryBox}>
                  <Text style={s.cardTitle}>{selected.snapshot.customerName} · {selected.orderCode}</Text>
                  <Text style={s.copy}>Thu ngân: {selected.snapshot.cashierName} · Ngày phát hành: {dateLabel(selected.issuedAt)}</Text>
                </View>

                <View style={s.detailGroup}>
                  <Text style={s.subHeading}>Chi tiết hàng hóa</Text>
                  {selected.snapshot.items.map((line, i) => (
                    <View key={`${line.sku}-${i}`} style={[s.listRow, i === selected.snapshot.items.length - 1 && { borderBottomWidth: 0 }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.cardTitle}>{line.productName}</Text>
                        <Text style={s.copy}>{line.sku} · SL {line.quantity}</Text>
                      </View>
                      <Text style={s.total}>{money(line.lineTotal)}</Text>
                    </View>
                  ))}
                </View>

                <View style={s.summaryBox}>
                  <View style={s.kvRow}><Text style={s.copy}>Tạm tính</Text><Text style={s.kvVal}>{money(selected.snapshot.subtotal)}</Text></View>
                  {!!selected.snapshot.orderDiscount && <View style={s.kvRow}><Text style={s.copy}>Giảm giá</Text><Text style={[s.kvVal, { color: '#027A48' }]}>−{money(selected.snapshot.orderDiscount)}</Text></View>}
                  {!!selected.snapshot.taxAmount && <View style={s.kvRow}><Text style={s.copy}>Thuế</Text><Text style={s.kvVal}>{money(selected.snapshot.taxAmount)}</Text></View>}
                  <View style={[s.kvRow, s.kvDivider]}><Text style={s.cardTitle}>Tổng cộng</Text><Text style={s.total}>{money(selected.snapshot.grandTotal)}</Text></View>
                  <View style={s.kvRow}><Text style={s.copy}>Đã thu</Text><Text style={[s.kvVal, { color: '#027A48' }]}>{money(selected.snapshot.paidAmount)}</Text></View>
                  {(selected.snapshot.dueAmount || 0) > 0 && <View style={s.kvRow}><Text style={s.copy}>Còn nợ</Text><Text style={[s.kvVal, { color: '#B42318' }]}>{money(selected.snapshot.dueAmount)}</Text></View>}
                </View>

                {selected.snapshot.payments.length > 0 && (
                  <View style={s.detailGroup}>
                    <Text style={s.subHeading}>Thanh toán</Text>
                    {selected.snapshot.payments.map((payment, i) => (
                      <View key={i} style={[s.listRow, i === selected.snapshot.payments.length - 1 && { borderBottomWidth: 0 }]}>
                        <Text style={s.copy}>{paymentLabel(payment.method)}{payment.reference ? ` · ${payment.reference}` : ''}</Text>
                        <Text style={s.kvVal}>{money(payment.amount)}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {canManage && (
                  <View style={s.row}>
                    <View style={{ flex: 1 }}><Action label={pdfBusy ? 'Đang tải…' : 'Chia sẻ PDF'} disabled={pdfBusy} onPress={() => void sharePdf()} /></View>
                    <View style={{ flex: 1 }}><Action secondary label="Ghi nhận in lại" onPress={() => void reprint()} /></View>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </Page>
  );
}

function ReportsPanel({ scope }: { scope: RetailScope }) {
  const [preset, setPreset] = useState<'7d' | '30d'>('7d');
  const [custom, setCustom] = useState(false);
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftPreset, setDraftPreset] = useState<'7d' | '30d'>('7d');
  const [draftCustom, setDraftCustom] = useState(false);
  const [draftFrom, setDraftFrom] = useState(today());
  const [draftTo, setDraftTo] = useState(today());
  const [draftSku, setDraftSku] = useState('');
  const [draftCategory, setDraftCategory] = useState('');
  const [draftBrand, setDraftBrand] = useState('');
  const [report, setReport] = useState<RetailReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const openFilters = () => {
    setDraftPreset(preset);
    setDraftCustom(custom);
    setDraftFrom(from);
    setDraftTo(to);
    setDraftSku(sku);
    setDraftCategory(category);
    setDraftBrand(brand);
    setError('');
    setFilterOpen(true);
  };

  const applyFilters = () => {
    if (draftCustom && (!draftFrom || !draftTo || draftFrom > draftTo)) {
      setError('Khoảng ngày không hợp lệ.');
      return;
    }
    setPreset(draftPreset);
    setCustom(draftCustom);
    setFrom(draftFrom);
    setTo(draftTo);
    setSku(draftSku.trim());
    setCategory(draftCategory.trim());
    setBrand(draftBrand.trim());
    setError('');
    setFilterOpen(false);
  };

  const clearFilters = () => {
    setPreset('7d');
    setCustom(false);
    setFrom(today());
    setTo(today());
    setSku('');
    setCategory('');
    setBrand('');
    setDraftPreset('7d');
    setDraftCustom(false);
    setDraftFrom(today());
    setDraftTo(today());
    setDraftSku('');
    setDraftCategory('');
    setDraftBrand('');
    setError('');
    setFilterOpen(false);
  };

  const hasExtraFilters = custom || preset !== '7d' || Boolean(sku || category || brand);

  const filters = useMemo(() => ({
    ...(custom ? { from, to } : { preset }),
    ...(sku.trim() ? { sku: sku.trim() } : {}),
    ...(category.trim() ? { category: category.trim() } : {}),
    ...(brand.trim() ? { brand: brand.trim() } : {}),
  }), [brand, category, custom, from, preset, sku, to]);

  const load = useCallback(async () => {
    if (custom && (!from || !to || from > to)) { setError('Khoảng ngày không hợp lệ.'); return; }
    setBusy(true);
    setError('');
    try {
      setReport(await retailApi.report(scope, filters));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được báo cáo bán lẻ.');
    } finally {
      setBusy(false);
    }
  }, [custom, filters, from, scope, to]);

  useEffect(() => { void load(); }, [load]);

  const exportReport = async () => {
    if (Platform.OS === 'web') { setError('Xuất Excel cần mở phân hệ trên ứng dụng iOS hoặc Android.'); return; }
    const configured = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');
    const token = getAccessToken();
    if (!configured || !token) { setError('Thiếu địa chỉ ERP hoặc phiên đăng nhập để xuất báo cáo.'); return; }
    const base = /\/api\/v1$/i.test(configured) ? configured : `${configured}/api/v1`;
    setExporting(true);
    setError('');
    try {
      const root = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      if (!root) throw new Error('Không có thư mục lưu báo cáo trên thiết bị.');
      const url = `${base}${retailApi.reportExportUrl(scope, filters)}`;
      const result = await FileSystem.downloadAsync(url, `${root}bao-cao-ban-hang.xlsx`, { headers: { Authorization: `Bearer ${token}` } });
      if (result.status < 200 || result.status >= 300) throw new Error(`ERP không xuất được báo cáo (HTTP ${result.status}).`);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(result.uri, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', dialogTitle: 'Báo cáo bán lẻ' });
      } else {
        Alert.alert('Đã tải báo cáo Excel', result.uri);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không xuất được báo cáo Excel.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Page refreshing={busy} onRefresh={() => void load()}>
      <Section
        title="Báo cáo bán lẻ"
        right={(
          <View style={s.headerActions}>
            <Action secondary compact label={`Bộ lọc${hasExtraFilters ? ' •' : ''}`} onPress={openFilters} />
            <Action compact disabled={exporting} label={exporting ? 'Đang xuất…' : 'Xuất Excel'} onPress={() => void exportReport()} />
          </View>
        )}
      >
        {hasExtraFilters && (
          <View style={s.activeFilterBar}>
            <Text style={[s.copy, { flex: 1 }]} numberOfLines={2}>
              Bộ lọc: {custom ? `${dateLabel(from)} – ${dateLabel(to)}` : preset === '30d' ? '30 ngày' : '7 ngày'}
              {sku ? ` · SKU ${sku}` : ''}{category ? ` · ${category}` : ''}{brand ? ` · ${brand}` : ''}
            </Text>
            <Pressable accessibilityRole="button" onPress={clearFilters}><Text style={s.filterClearText}>Xóa</Text></Pressable>
          </View>
        )}
        <Loading busy={busy} error={error} onRetry={() => void load()} />
      </Section>

      <Modal visible={filterOpen} transparent animationType="fade" onRequestClose={() => setFilterOpen(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setFilterOpen(false)}>
          <Pressable style={s.modalSheet} onPress={() => { }}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Lọc báo cáo bán lẻ</Text>
              <Pressable accessibilityRole="button" onPress={() => setFilterOpen(false)} style={s.modalCloseBtn}>
                <X size={18} color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingTop: 6 }}>
              <View style={{ gap: 8 }}>
                <Text style={s.label}>Thời gian</Text>
                <View style={s.chipRow}>
                  <Chip label="7 ngày" active={!draftCustom && draftPreset === '7d'} onPress={() => { setDraftCustom(false); setDraftPreset('7d'); }} />
                  <Chip label="30 ngày" active={!draftCustom && draftPreset === '30d'} onPress={() => { setDraftCustom(false); setDraftPreset('30d'); }} />
                  <Chip label="Khoảng ngày" active={draftCustom} onPress={() => setDraftCustom(true)} />
                </View>
              </View>
              {draftCustom && (
                <View style={s.row}>
                  <View style={{ flex: 1 }}><DateTimeField label="Từ ngày" value={draftFrom} onChange={setDraftFrom} mode="date" /></View>
                  <View style={{ flex: 1 }}><DateTimeField label="Đến ngày" value={draftTo} onChange={setDraftTo} mode="date" /></View>
                </View>
              )}
              <Field label="Lọc SKU" value={draftSku} onChangeText={setDraftSku} placeholder="Nhập mã SKU (không bắt buộc)" />
              <View style={s.row}>
                <Field label="Danh mục" value={draftCategory} onChangeText={setDraftCategory} placeholder="Tất cả" />
                <Field label="Thương hiệu" value={draftBrand} onChangeText={setDraftBrand} placeholder="Tất cả" />
              </View>
              <ErrorText>{error}</ErrorText>
              <View style={s.row}>
                <View style={{ flex: 1 }}><Action secondary label="Xóa bộ lọc" onPress={clearFilters} /></View>
                <View style={{ flex: 1 }}><Action label="Áp dụng" onPress={applyFilters} /></View>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {report && (
        <>
          <Section title={`Tổng quan (${dateLabel(report.range.from)} – ${dateLabel(report.range.to)})`}>
            <View style={s.metrics}>
              {[
                ['Doanh thu gộp', report.summary.grossSales],
                ['Hoàn tiền', report.summary.refunds],
                ['Doanh thu thuần', report.summary.netSales],
                ['Đơn bán', report.summary.orderCount],
                ['Giá trị đơn TB', report.summary.averageOrderValue],
                ['Đã thu', report.summary.collectedAmount],
                ['Công nợ', report.summary.dueAmount],
                ['Lãi gộp', report.summary.grossProfit],
              ]
                .filter(([, value]) => value !== undefined)
                .map(([label, value]) => (
                  <Metric key={String(label)} label={String(label)} value={label === 'Đơn bán' ? String(value) : money(Number(value))} />
                ))}
            </View>
          </Section>

          <Section title="Công nợ & thanh toán">
            <View style={s.summaryBox}>
              <View style={s.kvRow}><Text style={s.copy}>Tổng công nợ</Text><Text style={s.kvVal}>{money(report.debt.totalDebt)}</Text></View>
              <View style={s.kvRow}><Text style={s.copy}>Quá hạn</Text><Text style={[s.kvVal, { color: '#B42318' }]}>{money(report.debt.overdueDebt)}</Text></View>
              <View style={s.kvRow}><Text style={s.copy}>Đến hạn hôm nay</Text><Text style={s.kvVal}>{money(report.debt.dueTodayDebt)}</Text></View>
              <View style={s.kvRow}><Text style={s.copy}>Sắp đến hạn</Text><Text style={s.kvVal}>{money(report.debt.upcomingDebt)}</Text></View>
            </View>
            {report.paymentMix.map((item) => (
              <View key={item.method} style={s.listRow}>
                <Text style={s.cardTitle}>{paymentLabel(item.method)}</Text>
                <Text style={s.total}>{money(item.amount)}</Text>
              </View>
            ))}
          </Section>

          <Section title="Mặt hàng bán chạy">
            {report.products.slice(0, 20).map((item) => (
              <View key={item.sku} style={s.listRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{item.productName}</Text>
                  <Text style={s.copy}>{item.sku} · SL {item.netQuantity}</Text>
                </View>
                <Text style={s.total}>{money(item.netSales)}</Text>
              </View>
            ))}
            {!report.products.length && <Text style={s.empty}>Chưa có dữ liệu bán hàng.</Text>}
          </Section>

          {!!report.slowProducts?.length && (
            <Section title="Mặt hàng bán chậm">
              {report.slowProducts.slice(0, 20).map((item) => (
                <View key={`slow-${item.sku}`} style={s.listRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardTitle}>{item.productName}</Text>
                    <Text style={s.copy}>{item.sku} · SL {item.netQuantity}</Text>
                  </View>
                  <Text style={s.total}>{money(item.netSales)}</Text>
                </View>
              ))}
            </Section>
          )}

          {!!report.cashiers?.length && (
            <Section title="Hiệu quả theo thu ngân">
              {report.cashiers.map((item) => (
                <View key={item.cashierId} style={s.listRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardTitle}>{item.cashierName}</Text>
                    <Text style={s.copy}>{item.orderCount} đơn</Text>
                  </View>
                  <Text style={s.total}>{money(item.netSales)}</Text>
                </View>
              ))}
            </Section>
          )}

          {!!report.shifts?.length && (
            <Section title="Ca POS trong kỳ">
              {report.shifts.map((item) => (
                <View key={item.shiftId} style={s.listRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardTitle}>{item.shiftCode}</Text>
                    <Text style={s.copy}>{item.cashierName} · {dateLabel(item.businessDate)}</Text>
                  </View>
                  <Text style={s.total}>{money(item.grossSales)}</Text>
                </View>
              ))}
            </Section>
          )}

          <Section title="Doanh số theo ngày">
            {report.timeSeries.map((item) => (
              <View key={item.businessDate} style={s.listRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{dateLabel(item.businessDate)}</Text>
                  <Text style={s.copy}>{item.orderCount} đơn</Text>
                </View>
                <Text style={s.total}>{money(item.netSales)}</Text>
              </View>
            ))}
          </Section>
        </>
      )}
    </Page>
  );
}

function ShiftsPanel({ scope, terminalId, currentCashierId }: { scope: RetailScope; terminalId: string; currentCashierId?: string }) {
  const [rows, setRows] = useState<RetailShift[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [openingFloat, setOpeningFloat] = useState('0');
  const [counted, setCounted] = useState('');
  const [reason, setReason] = useState('');
  const [selected, setSelected] = useState<RetailShift | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('');
  const [movementType, setMovementType] = useState<'in' | 'out'>('in');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');
  const movementAttempt = useRef<{ fingerprint: string; key: string } | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const result = await retailApi.shifts(scope, { limit: 30, status: filter || undefined });
      setRows(result.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được danh sách ca.');
    } finally {
      setBusy(false);
    }
  }, [filter, scope]);

  useEffect(() => { void load(); }, [load]);

  const open = async () => {
    const amount = parseVndInput(openingFloat);
    if (!Number.isSafeInteger(amount) || amount < 0) { setError('Quỹ đầu ca phải là số nguyên không âm.'); return; }
    setSaving(true);
    setError('');
    try {
      const value = await retailApi.openShift(scope, { openingFloat: amount, cashierId: currentCashierId || '' });
      await retailApi.resumeShift(scope, value._id, value.terminalId || '');
      setOpeningFloat('0');
      await load();
      Alert.alert('Đã mở ca POS', value.shiftCode);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không mở được ca.');
    } finally {
      setSaving(false);
    }
  };

  const reconcile = async () => {
    if (!selected) return;
    setSaving(true);
    setError('');
    try {
      const value = await retailApi.reconcileShift(scope, selected._id, {
        countedCash: parseVndInput(counted),
        varianceReason: reason.trim() || undefined,
      });
      setSelected(value);
      await load();
      Alert.alert('Đã đối soát ca');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không đối soát được ca.');
    } finally {
      setSaving(false);
    }
  };

  const moveCash = async () => {
    if (!selected) return;
    const amount = parseVndInput(movementAmount);
    if (!Number.isSafeInteger(amount) || amount <= 0 || !movementReason.trim()) {
      setError('Nhập số tiền và lý do cho phát sinh tiền mặt.');
      return;
    }
    const payload = { type: movementType, amount, reason: movementReason.trim() };
    const fingerprint = JSON.stringify({ shiftId: selected._id, ...payload });
    if (movementAttempt.current?.fingerprint !== fingerprint) movementAttempt.current = { fingerprint, key: key() };
    setSaving(true);
    setError('');
    try {
      const value = await retailApi.moveShiftCash(scope, selected._id, { ...payload, idempotencyKey: movementAttempt.current.key });
      movementAttempt.current = null;
      setSelected(value);
      setMovementAmount('');
      setMovementReason('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không ghi được phát sinh tiền mặt. Hãy thử lại cùng nội dung.');
    } finally {
      setSaving(false);
    }
  };

  const resume = async (shift: RetailShift) => {
    setSaving(true);
    try {
      await retailApi.resumeShift(scope, shift._id, shift.terminalId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tiếp tục được ca.');
    } finally {
      setSaving(false);
    }
  };

  const pause = async (shift: RetailShift) => {
    setSaving(true);
    try {
      await retailApi.pauseShift(scope, shift._id, 'Tạm dừng từ ứng dụng mobile');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tạm dừng được ca.');
    } finally {
      setSaving(false);
    }
  };

  const close = async (shift: RetailShift) => {
    const countedCash = parseVndInput(counted);
    if (!shift._id || !Number.isSafeInteger(countedCash) || countedCash < 0) {
      setError('Nhập số tiền mặt đã kiểm đếm trước khi đóng ca.');
      return;
    }
    Alert.alert('Đóng ca POS?', 'Hãy chắc chắn đã kiểm đếm tiền mặt.', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Đóng ca',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setSaving(true);
            try {
              await retailApi.closeShift(scope, shift._id, { countedCash, varianceReason: reason.trim() || undefined });
              setSelected(null);
              await load();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Không đóng được ca.');
            } finally {
              setSaving(false);
            }
          })();
        },
      },
    ]);
  };

  return (
    <Page refreshing={busy} onRefresh={() => void load()}>
      <Section title="Mở ca trên máy này">
        <Field label="Quỹ đầu ca (VND)" value={openingFloat} onChangeText={(v) => setOpeningFloat(formatVndInput(v))} keyboardType="numeric" placeholder="0" />
        <Action disabled={saving || !terminalId} label={saving ? 'Đang mở ca…' : 'Mở ca POS'} onPress={() => void open()} />
      </Section>

      <Section title="Danh sách ca POS">
        <View style={s.chipRow}>
          {[['', 'Tất cả'], ['open', 'Đang mở'], ['closed', 'Đã đóng'], ['reconciled', 'Đã đối soát']].map(([value, label]) => (
            <Chip key={value} label={label} active={filter === value} onPress={() => setFilter(value)} />
          ))}
        </View>
        <Loading busy={busy} error={error} onRetry={() => void load()} />
        {rows.map((shift) => {
          const st = shiftStatusMeta(shift.status);
          return (
            <Card key={shift._id} onPress={() => { setSelected(shift); setCounted(shift.countedCash != null ? formatVndInput(shift.countedCash) : ''); setReason(''); }}>
              <View style={s.cardTopRow}>
                <Text numberOfLines={1} ellipsizeMode="middle" style={[s.cardTitle, { flex: 1 }]}>{shift.shiftCode}</Text>
                <Pill label={st.label} bg={st.bg} fg={st.fg} />
              </View>
              <Text style={s.copy}>{shift.cashierName} · {dateLabel(shift.businessDate)} · {shift.terminalId === terminalId ? 'Máy này' : 'Quầy khác'}</Text>
              <Text style={s.copy}>Đầu ca {money(shift.openingFloat)} · Doanh thu {money(shift.grossSales)}</Text>
              <Text style={s.metaHighlight}>Tiền dự kiến: {money(shift.expectedCash)}</Text>
              <View style={s.cardActionRow}>
                {shift.status === 'open' && (
                  <>
                    <View style={{ flex: 1 }}>
                      <Action
                        secondary
                        compact
                        label={shift.terminalId === terminalId ? 'Tạm dừng' : 'Tiếp tục máy này'}
                        onPress={() => void (shift.terminalId === terminalId ? pause(shift) : resume(shift))}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Action
                        secondary
                        compact
                        label="Chi tiết / Đóng ca"
                        onPress={() => { setSelected(shift); setCounted(shift.countedCash != null ? formatVndInput(shift.countedCash) : ''); setReason(''); }}
                      />
                    </View>
                  </>
                )}
                {shift.status === 'closed' && (
                  <View style={{ flex: 1 }}>
                    <Action
                      compact
                      label="Kiểm đếm / Đối soát"
                      onPress={() => { setSelected(shift); setCounted(shift.countedCash != null ? formatVndInput(shift.countedCash) : ''); setReason(''); }}
                    />
                  </View>
                )}
              </View>
            </Card>
          );
        })}
        {!busy && !rows.length && <Text style={s.empty}>Không có ca trong bộ lọc.</Text>}
      </Section>

      <Modal visible={Boolean(selected)} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={s.modalBackdrop}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text numberOfLines={1} ellipsizeMode="middle" style={[s.modalTitle, { flex: 1 }]}>
                Chi tiết ca {selected?.shiftCode}
              </Text>
              <Pressable accessibilityRole="button" onPress={() => setSelected(null)} style={s.modalCloseBtn}>
                <X size={18} color={colors.muted} />
              </Pressable>
            </View>
            {selected && (
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingTop: 6 }}>
                <View style={s.summaryBox}>
                  <View style={s.kvRow}><Text style={s.copy}>Thu ngân</Text><Text style={s.kvVal}>{selected.cashierName}</Text></View>
                  <View style={s.kvRow}><Text style={s.copy}>Đã thu</Text><Text style={s.kvVal}>{money(selected.collectedAmount)}</Text></View>
                  <View style={s.kvRow}><Text style={s.copy}>Hoàn tiền</Text><Text style={s.kvVal}>{money(selected.refundedAmount)}</Text></View>
                  <View style={s.kvRow}><Text style={s.copy}>Tiền dự kiến</Text><Text style={s.total}>{money(selected.expectedCash)}</Text></View>
                  <View style={s.kvRow}><Text style={s.copy}>Đã kiểm đếm</Text><Text style={s.kvVal}>{money(selected.countedCash)}</Text></View>
                  <View style={s.kvRow}><Text style={s.copy}>Chênh lệch</Text><Text style={[s.kvVal, selected.varianceAmount ? { color: '#B42318' } : undefined]}>{money(selected.varianceAmount)}</Text></View>
                </View>

                <ErrorText>{error}</ErrorText>

                {selected.status === 'open' && (
                  <>
                    <View style={s.formBox}>
                      <Text style={s.subHeading}>Phát sinh tiền mặt trong ca</Text>
                      <View style={s.chipRow}>
                        <Chip label="Thu vào" active={movementType === 'in'} onPress={() => setMovementType('in')} />
                        <Chip label="Chi ra" active={movementType === 'out'} onPress={() => setMovementType('out')} />
                      </View>
                      <Field label="Số tiền (VND)" value={movementAmount} onChangeText={(v) => setMovementAmount(formatVndInput(v))} keyboardType="numeric" placeholder="0" />
                      <Field label="Lý do" value={movementReason} onChangeText={setMovementReason} placeholder="Nhập lý do thu / chi" />
                      <Action disabled={saving} label="Ghi phát sinh" onPress={() => void moveCash()} />
                    </View>

                    <View style={s.formBox}>
                      <Text style={s.subHeading}>Đóng ca POS</Text>
                      <Field label="Tiền mặt kiểm đếm (VND)" value={counted} onChangeText={(v) => setCounted(formatVndInput(v))} keyboardType="numeric" placeholder="0" />
                      <Field label="Lý do chênh lệch (nếu có)" value={reason} onChangeText={setReason} placeholder="Nhập ghi chú chênh lệch" multiline />
                      <Action danger disabled={saving} label="Đóng ca đã kiểm đếm" onPress={() => void close(selected)} />
                    </View>
                  </>
                )}

                {selected.status === 'closed' && (
                  <View style={s.formBox}>
                    <Text style={s.subHeading}>Đối soát ca</Text>
                    <Field label="Tiền mặt kiểm đếm (VND)" value={counted} onChangeText={(v) => setCounted(formatVndInput(v))} keyboardType="numeric" placeholder="0" />
                    <Field label="Lý do chênh lệch" value={reason} onChangeText={setReason} placeholder="Nhập lý do chênh lệch (nếu có)" multiline />
                    <Action disabled={saving} label="Lưu đối soát" onPress={() => void reconcile()} />
                  </View>
                )}

                {Boolean(selected.cashMovements?.length) && (
                  <View style={s.detailGroup}>
                    <Text style={s.subHeading}>Lịch sử phát sinh tiền mặt</Text>
                    {selected.cashMovements?.map((movement, i) => (
                      <View key={`${movement.at}-${i}`} style={[s.listRow, i === (selected.cashMovements?.length || 1) - 1 && { borderBottomWidth: 0 }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.cardTitle}>{movement.reason}</Text>
                          <Text style={s.copy}>{movement.byName}</Text>
                        </View>
                        <Text style={[s.total, { color: movement.type === 'in' ? '#027A48' : '#B42318' }]}>
                          {movement.type === 'in' ? '+' : '−'}{money(movement.amount)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </Page>
  );
}

function SettingsPanel({ scope }: { scope: RetailScope }) {
  const [settings, setSettings] = useState<RetailSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      setSettings(await retailApi.settings(scope));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được cài đặt bán lẻ.');
    } finally {
      setBusy(false);
    }
  }, [scope]);

  useEffect(() => { void load(); }, [load]);

  const update = <K extends keyof RetailSettings>(k: K, v: RetailSettings[K]) =>
    setSettings((current) => current ? { ...current, [k]: v } : current);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    setError('');
    try {
      const { companyCode: _c, branchId: _b, ...input } = settings;
      setSettings(await retailApi.saveSettings(scope, input));
      Alert.alert('Đã lưu', 'Cấu hình bán lẻ được cập nhật.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không lưu được cài đặt.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page refreshing={busy} onRefresh={() => void load()}>
      <Section title="Cài đặt bán lẻ">
        <Loading busy={busy} error={error} onRetry={() => void load()} />
        {settings && (
          <>
            <View style={s.switchRow}>
              <Text style={s.switchLabel}>Cho phép tồn kho âm</Text>
              <Switch
                value={settings.allowNegativeStock}
                onValueChange={(v) => update('allowNegativeStock', v)}
                trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
                thumbColor={settings.allowNegativeStock ? colors.primary : '#F8FAFC'}
              />
            </View>
            <View style={s.row}>
              <Field label="Giảm giá tối đa (%)" value={String(settings.maxDiscountPercent)} onChangeText={(v) => update('maxDiscountPercent', Number(v.replace(/[^\d.]/g, '')) || 0)} keyboardType="numeric" />
              <Field label="Thuế mặc định (%)" value={String(settings.defaultTaxRate)} onChangeText={(v) => update('defaultTaxRate', Number(v.replace(/[^\d.]/g, '')) || 0)} keyboardType="numeric" />
            </View>
            <Field
              label="Ngưỡng yêu cầu lý do chênh lệch (VND)"
              value={formatVndInput(settings.varianceReasonThreshold)}
              onChangeText={(v) => update('varianceReasonThreshold', parseVndInput(v))}
              keyboardType="numeric"
            />
            <View style={s.row}>
              <Field label="Tiền tố đơn hàng" value={settings.orderPrefix} onChangeText={(v) => update('orderPrefix', v)} />
              <Field label="Tiền tố hóa đơn" value={settings.invoicePrefix} onChangeText={(v) => update('invoicePrefix', v)} />
            </View>
            <Text style={s.label}>Khổ hóa đơn</Text>
            <View style={s.chipRow}>
              {(['A4', 'A5', '80mm', '58mm'] as const).map((size) => (
                <Chip key={size} label={size} active={settings.invoicePaperSize === size} onPress={() => update('invoicePaperSize', size)} />
              ))}
            </View>
            <Field
              label="Hạng khách hàng (mỗi dòng: mã | tên | doanh số tối thiểu)"
              value={settings.customerTiers.map((tier) => `${tier.code} | ${tier.name} | ${tier.minSpend}`).join('\n')}
              onChangeText={(value) => update(
                'customerTiers',
                value.split('\n').filter(Boolean).map((line) => {
                  const [code = '', name = '', minSpend = '0'] = line.split('|').map((part) => part.trim());
                  return { code, name, minSpend: Number(minSpend) || 0 };
                }),
              )}
              multiline
            />
            <Action disabled={saving} label={saving ? 'Đang lưu…' : 'Lưu cài đặt'} onPress={() => void save()} />
          </>
        )}
      </Section>
    </Page>
  );
}

function CouponsPanel({ scope, canManagePoints }: { scope: RetailScope; canManagePoints: boolean }) {
  const [section, setSection] = useState<'coupons' | 'automations' | 'points'>('coupons');
  const [rows, setRows] = useState<RetailCoupon[]>([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<RetailCoupon | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [kind, setKind] = useState<'percent' | 'amount'>('percent');
  const [value, setValue] = useState('10');
  const [minSubtotal, setMinSubtotal] = useState('0');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [usageLimit, setUsageLimit] = useState('');

  const [automations, setAutomations] = useState<RetailCouponAutomation[]>([]);
  const [editingAutomation, setEditingAutomation] = useState<RetailCouponAutomation | null>(null);
  const [automationOpen, setAutomationOpen] = useState(false);
  const [automationName, setAutomationName] = useState('');
  const [automationTrigger, setAutomationTrigger] = useState<'birthday' | 'order_total'>('birthday');
  const [automationValue, setAutomationValue] = useState('10');
  const [automationMin, setAutomationMin] = useState('0');
  const [automationOrderMin, setAutomationOrderMin] = useState('');
  const [automationDays, setAutomationDays] = useState('7');

  const [policy, setPolicy] = useState<RetailPointPolicy | null>(null);
  const [pointSearch, setPointSearch] = useState('');
  const [pointMatches, setPointMatches] = useState<RetailPointCustomer[]>([]);
  const [pointCustomer, setPointCustomer] = useState<RetailPointCustomer | null>(null);
  const [pointBalance, setPointBalance] = useState(0);
  const [ledger, setLedger] = useState<Array<{ _id: string; type: string; points: number; balanceAfter: number; reason: string; createdAt: string }>>([]);
  const [pointChange, setPointChange] = useState('');
  const [pointReason, setPointReason] = useState('');
  const [pointBusy, setPointBusy] = useState(false);
  const pointAttempt = useRef<{ fingerprint: string; key: string } | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const result = await retailApi.coupons(scope);
      setRows(result.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được mã ưu đãi.');
    } finally {
      setBusy(false);
    }
  }, [scope]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (section !== 'automations') return;
    let current = true;
    setBusy(true);
    retailApi.couponAutomations(scope)
      .then((items) => { if (current) setAutomations(items || []); })
      .catch((e) => { if (current) setError(e instanceof Error ? e.message : 'Không tải được chương trình tự động.'); })
      .finally(() => { if (current) setBusy(false); });
    return () => { current = false; };
  }, [scope, section]);

  useEffect(() => {
    if (section !== 'points') return;
    let current = true;
    retailApi.pointPolicy(scope)
      .then((result) => { if (current) setPolicy(result); })
      .catch((e) => { if (current) setError(e instanceof Error ? e.message : 'Không tải được chính sách tích điểm.'); });
    return () => { current = false; };
  }, [scope, section]);

  useEffect(() => {
    if (section !== 'points' || !canManagePoints || pointCustomer || pointSearch.trim().length < 2) {
      setPointMatches([]);
      return;
    }
    let current = true;
    const timer = setTimeout(() => {
      void retailApi.pointCustomers(scope, pointSearch.trim())
        .then((result) => { if (current) setPointMatches(result || []); })
        .catch(() => { if (current) setPointMatches([]); });
    }, 250);
    return () => { current = false; clearTimeout(timer); };
  }, [canManagePoints, pointCustomer, pointSearch, scope, section]);

  const startEdit = (coupon?: RetailCoupon) => {
    setEditing(coupon || null);
    setFormOpen(true);
    setName(coupon?.name || '');
    setCode(coupon?.code || '');
    const nextKind = coupon?.discountType || 'percent';
    setKind(nextKind);
    setValue(nextKind === 'amount' ? formatVndInput(coupon?.value ?? 0) : String(coupon?.value ?? 10));
    setMinSubtotal(formatVndInput(coupon?.minSubtotal ?? 0));
    setMaxDiscount(coupon?.maxDiscount == null ? '' : formatVndInput(coupon.maxDiscount));
    setUsageLimit(coupon?.usageLimit == null ? '' : String(coupon.usageLimit));
  };

  const saveCoupon = async () => {
    if (!name.trim() || !code.trim()) { setError('Nhập tên và mã ưu đãi.'); return; }
    setSaving(true);
    setError('');
    try {
      await retailApi.saveCoupon(
        scope,
        {
          code: code.trim().toUpperCase(),
          name: name.trim(),
          discountType: kind,
          value: kind === 'amount' ? parseVndInput(value) : Number(value),
          minSubtotal: parseVndInput(minSubtotal),
          maxDiscount: maxDiscount.trim() ? parseVndInput(maxDiscount) : null,
          usageLimit: usageLimit.trim() ? Number(usageLimit) : null,
          startsAt: editing?.startsAt || new Date().toISOString(),
          endsAt: editing?.endsAt || new Date(Date.now() + 30 * 86400000).toISOString(),
          active: editing?.active ?? true,
          ...(editing ? { version: editing.version } : {}),
        },
        editing?._id,
      );
      setEditing(null);
      setFormOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không lưu được mã ưu đãi.');
    } finally {
      setSaving(false);
    }
  };

  const toggleCoupon = async (coupon: RetailCoupon) => {
    try {
      await retailApi.saveCoupon(scope, { ...coupon, active: !coupon.active }, coupon._id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không cập nhật được trạng thái mã.');
    }
  };

  const startAutomation = (item?: RetailCouponAutomation) => {
    setEditingAutomation(item || null);
    setAutomationOpen(true);
    setAutomationName(item?.name || '');
    setAutomationTrigger(item?.trigger || 'birthday');
    const nextKind = item?.discountType || 'percent';
    setKind(nextKind);
    setAutomationValue(nextKind === 'amount' ? formatVndInput(item?.value ?? 0) : String(item?.value ?? 10));
    setAutomationMin(formatVndInput(item?.minSubtotal ?? 0));
    setAutomationOrderMin(item?.orderMinTotal == null ? '' : formatVndInput(item.orderMinTotal));
    setAutomationDays(String(item?.validityDays ?? 7));
    setMaxDiscount(item?.maxDiscount == null ? '' : formatVndInput(item.maxDiscount));
  };

  const saveAutomation = async () => {
    if (!automationName.trim()) { setError('Nhập tên chương trình.'); return; }
    setSaving(true);
    setError('');
    try {
      const input = {
        name: automationName.trim(),
        trigger: automationTrigger,
        orderMinTotal: automationTrigger === 'order_total' ? parseVndInput(automationOrderMin) : null,
        enabled: editingAutomation?.enabled ?? true,
        discountType: kind,
        value: kind === 'amount' ? parseVndInput(automationValue) : Number(automationValue),
        minSubtotal: parseVndInput(automationMin),
        maxDiscount: maxDiscount.trim() ? parseVndInput(maxDiscount) : null,
        validityDays: Number(automationDays),
        ...(editingAutomation?.version != null ? { version: editingAutomation.version } : {}),
      };
      await retailApi.saveCouponAutomation(scope, input, editingAutomation?._id);
      setAutomationOpen(false);
      setEditingAutomation(null);
      setAutomations(await retailApi.couponAutomations(scope));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không lưu được chương trình tự động.');
    } finally {
      setSaving(false);
    }
  };

  const toggleAutomation = async (item: RetailCouponAutomation) => {
    try {
      await retailApi.saveCouponAutomation(scope, { ...item, enabled: !item.enabled }, item._id);
      setAutomations(await retailApi.couponAutomations(scope));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không cập nhật được chương trình.');
    }
  };

  const selectPointCustomer = async (customer: RetailPointCustomer) => {
    setPointCustomer(customer);
    setPointSearch(`${customer.name} · ${customer.phone}`);
    setPointMatches([]);
    try {
      const result = await retailApi.pointCustomer(scope, customer._id);
      setPointBalance(result.balance);
      setLedger(result.ledger || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được sổ điểm.');
    }
  };

  const savePolicy = async () => {
    if (!policy) return;
    setPointBusy(true);
    setError('');
    try {
      setPolicy(await retailApi.savePointPolicy(scope, policy));
      Alert.alert('Đã lưu chính sách điểm');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không lưu được chính sách điểm.');
    } finally {
      setPointBusy(false);
    }
  };

  const adjustPoints = async () => {
    if (!pointCustomer || !canManagePoints) return;
    const points = Number(pointChange);
    if (!Number.isSafeInteger(points) || !points || !pointReason.trim()) {
      setError('Nhập số điểm nguyên khác 0 và lý do điều chỉnh.');
      return;
    }
    const payload = { points, reason: pointReason.trim() };
    const fingerprint = JSON.stringify({ customerId: pointCustomer._id, ...payload });
    if (pointAttempt.current?.fingerprint !== fingerprint) pointAttempt.current = { fingerprint, key: key() };
    setPointBusy(true);
    setError('');
    try {
      await retailApi.adjustPoints(scope, pointCustomer._id, { ...payload, idempotencyKey: pointAttempt.current.key });
      pointAttempt.current = null;
      setPointChange('');
      setPointReason('');
      await selectPointCustomer(pointCustomer);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không điều chỉnh được điểm; hãy thử lại nguyên yêu cầu.');
    } finally {
      setPointBusy(false);
    }
  };

  const refresh = section === 'points'
    ? async () => {
      if (pointCustomer) await selectPointCustomer(pointCustomer);
      else if (policy) setPolicy(await retailApi.pointPolicy(scope));
    }
    : section === 'automations'
      ? async () => setAutomations(await retailApi.couponAutomations(scope))
      : load;

  const activeCouponsCount = rows.filter((c) => c.active).length;
  const totalCouponUses = rows.reduce((sum, c) => sum + (c.usedCount || 0), 0);
  const activeAutoCount = automations.filter((a) => a.enabled).length;

  return (
    <Page refreshing={busy} onRefresh={() => void refresh()}>
      <View style={s.segmentedBar}>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: section === 'coupons' }}
          onPress={() => { setError(''); setSection('coupons'); }}
          style={[s.segmentedTab, section === 'coupons' && s.segmentedTabActive]}
        >
          <Ticket size={15} color={section === 'coupons' ? colors.primary : '#64748B'} />
          <Text numberOfLines={1} style={[s.segmentedTabText, section === 'coupons' && s.segmentedTabTextActive]}>Mã giảm giá</Text>
        </Pressable>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: section === 'automations' }}
          onPress={() => { setError(''); setSection('automations'); }}
          style={[s.segmentedTab, section === 'automations' && s.segmentedTabActive]}
        >
          <Sparkles size={15} color={section === 'automations' ? colors.primary : '#64748B'} />
          <Text numberOfLines={1} style={[s.segmentedTabText, section === 'automations' && s.segmentedTabTextActive]}>Tự động</Text>
        </Pressable>
        {canManagePoints && (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: section === 'points' }}
            onPress={() => { setError(''); setSection('points'); }}
            style={[s.segmentedTab, section === 'points' && s.segmentedTabActive]}
          >
            <Coins size={15} color={section === 'points' ? colors.primary : '#64748B'} />
            <Text numberOfLines={1} style={[s.segmentedTabText, section === 'points' && s.segmentedTabTextActive]}>Điểm thưởng</Text>
          </Pressable>
        )}
      </View>

      {!!error && !formOpen && !automationOpen && <ErrorText>{error}</ErrorText>}

      {section === 'coupons' && (
        <>
          <View style={s.metrics}>
            <View style={[s.metric, { backgroundColor: '#EFF6FF', borderColor: '#DBEAFE' }]}>
              <Text style={s.metricLabel}>Mã đang hoạt động</Text>
              <Text style={s.metricValue}>{activeCouponsCount} / {rows.length}</Text>
            </View>
            <View style={[s.metric, { backgroundColor: '#ECFDF3', borderColor: '#D1FADF' }]}>
              <Text style={s.metricLabel}>Tổng lượt sử dụng</Text>
              <Text style={[s.metricValue, { color: '#027A48' }]}>{totalCouponUses.toLocaleString('vi-VN')}</Text>
            </View>
          </View>

          <Section
            title="Danh sách mã giảm giá"
            right={
              <Pressable accessibilityRole="button" onPress={() => startEdit()} style={s.inlinePrimaryBtn}>
                <Plus size={15} color="#FFFFFF" />
                <Text style={s.inlinePrimaryBtnText}>Tạo mã</Text>
              </Pressable>
            }
          >
            <Loading busy={busy} error="" onRetry={() => void load()} />
            {rows.map((coupon) => {
              const limitRatio = coupon.usageLimit && coupon.usageLimit > 0
                ? Math.min(100, Math.round((coupon.usedCount / coupon.usageLimit) * 100))
                : null;
              return (
                <View key={coupon._id} style={s.promoCard}>
                  <View style={s.cardTopRow}>
                    <View style={s.couponCodeBadge}>
                      <Ticket size={13} color={colors.primary} />
                      <Text style={s.couponCodeText}>{coupon.code}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={s.discountTag}>
                        <Text style={s.discountTagText}>
                          −{coupon.discountType === 'percent' ? `${coupon.value}%` : money(coupon.value)}
                        </Text>
                      </View>
                      <Pill
                        label={coupon.active ? 'Đang bật' : 'Đã tắt'}
                        bg={coupon.active ? '#ECFDF3' : '#F1F5F9'}
                        fg={coupon.active ? '#027A48' : '#64748B'}
                      />
                    </View>
                  </View>

                  <Text style={s.promoTitle}>{coupon.name}</Text>

                  <View style={s.promoMetaGrid}>
                    <View style={s.promoMetaCell}>
                      <Text style={s.promoMetaLabel}>Đơn tối thiểu</Text>
                      <Text style={s.promoMetaVal}>{money(coupon.minSubtotal)}</Text>
                    </View>
                    <View style={s.promoMetaCell}>
                      <Text style={s.promoMetaLabel}>Giảm tối đa</Text>
                      <Text style={s.promoMetaVal}>{coupon.maxDiscount != null ? money(coupon.maxDiscount) : 'Không giới hạn'}</Text>
                    </View>
                    <View style={s.promoMetaCell}>
                      <Text style={s.promoMetaLabel}>Hiệu lực</Text>
                      <Text style={s.promoMetaVal}>{dateLabel(coupon.startsAt)} – {dateLabel(coupon.endsAt)}</Text>
                    </View>
                    <View style={s.promoMetaCell}>
                      <Text style={s.promoMetaLabel}>Lượt sử dụng</Text>
                      <Text style={s.promoMetaVal}>
                        {coupon.usedCount}{coupon.usageLimit != null ? ` / ${coupon.usageLimit}` : ' (∞)'}
                      </Text>
                    </View>
                  </View>

                  {limitRatio !== null && (
                    <View style={s.progressTrack}>
                      <View style={[s.progressFill, { width: `${limitRatio}%` }]} />
                    </View>
                  )}

                  <View style={s.cardActionRow}>
                    <View style={{ flex: 1 }}><Action secondary compact label="Chỉnh sửa" onPress={() => startEdit(coupon)} /></View>
                    <View style={{ flex: 1 }}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => void toggleCoupon(coupon)}
                        style={[s.toggleBtn, coupon.active ? s.toggleBtnOff : s.toggleBtnOn]}
                      >
                        <Text style={[s.toggleBtnText, coupon.active ? s.toggleBtnTextOff : s.toggleBtnTextOn]}>
                          {coupon.active ? 'Tạm tắt' : 'Kích hoạt'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}
            {!busy && !rows.length && (
              <View style={s.emptyState}>
                <View style={s.emptyIconCircle}><Ticket size={24} color={colors.primary} /></View>
                <Text style={s.emptyStateTitle}>Chưa có mã giảm giá</Text>
                <Text style={s.emptyStateCopy}>Tạo mã ưu đãi để áp dụng trực tiếp tại quầy POS. Mã mới có hiệu lực mặc định 30 ngày.</Text>
              </View>
            )}
          </Section>

          <Modal visible={formOpen} transparent animationType="slide" onRequestClose={() => { if (!saving) { setFormOpen(false); setEditing(null); } }}>
            <Pressable style={s.modalBackdrop} onPress={() => { if (!saving) { setFormOpen(false); setEditing(null); } }}>
              <Pressable style={s.modalSheet} onPress={() => {}}>
                <View style={s.modalHeader}>
                  <Text style={s.modalTitle}>{editing ? 'Sửa mã ưu đãi' : 'Tạo mã ưu đãi'}</Text>
                  <Pressable accessibilityRole="button" disabled={saving} onPress={() => { setFormOpen(false); setEditing(null); }} style={s.modalCloseBtn}>
                    <X size={18} color={colors.muted} />
                  </Pressable>
                </View>
                <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingTop: 6, paddingBottom: 4 }}>
                  <Field label="Tên chương trình" value={name} onChangeText={setName} placeholder="VD: Khuyến mãi tháng 11" />
                  <Field label="Mã ưu đãi" value={code} onChangeText={setCode} placeholder="VD: SALE10" />
                  <View style={s.chipRow}>
                    <Chip label="Phần trăm (%)" active={kind === 'percent'} onPress={() => { setKind('percent'); setValue('10'); }} />
                    <Chip label="Số tiền (VND)" active={kind === 'amount'} onPress={() => { setKind('amount'); setValue(''); }} />
                  </View>
                  <Field
                    label={kind === 'percent' ? 'Mức giảm (%)' : 'Mức giảm (VND)'}
                    value={value}
                    onChangeText={(v) => setValue(kind === 'amount' ? formatVndInput(v) : v.replace(/[^\d.]/g, ''))}
                    keyboardType="numeric"
                  />
                  <View style={s.row}>
                    <Field label="Đơn tối thiểu (VND)" value={minSubtotal} onChangeText={(v) => setMinSubtotal(formatVndInput(v))} keyboardType="numeric" />
                    <Field label="Giảm tối đa (VND)" value={maxDiscount} onChangeText={(v) => setMaxDiscount(formatVndInput(v))} keyboardType="numeric" placeholder="Không giới hạn" />
                  </View>
                  <Field label="Số lượt sử dụng" value={usageLimit} onChangeText={(v) => setUsageLimit(v.replace(/[^\d]/g, ''))} keyboardType="numeric" placeholder="Bỏ trống nếu không giới hạn" />
                  <ErrorText>{error}</ErrorText>
                  <View style={s.row}>
                    <View style={{ flex: 1 }}><Action secondary disabled={saving} label="Hủy" onPress={() => { setFormOpen(false); setEditing(null); }} /></View>
                    <View style={{ flex: 1 }}><Action disabled={saving} label={saving ? 'Đang lưu…' : 'Lưu mã ưu đãi'} onPress={() => void saveCoupon()} /></View>
                  </View>
                </ScrollView>
              </Pressable>
            </Pressable>
          </Modal>
        </>
      )}

      {section === 'automations' && (
        <>
          <View style={s.metrics}>
            <View style={[s.metric, { backgroundColor: '#EFF6FF', borderColor: '#DBEAFE' }]}>
              <Text style={s.metricLabel}>Đang kích hoạt</Text>
              <Text style={s.metricValue}>{activeAutoCount} / {automations.length}</Text>
            </View>
            <View style={[s.metric, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}>
              <Text style={s.metricLabel}>Kịch bản sinh nhật</Text>
              <Text style={[s.metricValue, { color: '#C2410C' }]}>{automations.filter((a) => a.trigger === 'birthday').length}</Text>
            </View>
          </View>

          <Section
            title="Chương trình tự động"
            right={
              <Pressable accessibilityRole="button" onPress={() => startAutomation()} style={s.inlinePrimaryBtn}>
                <Plus size={15} color="#FFFFFF" />
                <Text style={s.inlinePrimaryBtnText}>Tạo mới</Text>
              </Pressable>
            }
          >
            <Loading busy={busy} error="" onRetry={() => void refresh()} />
            {automations.map((item) => {
              const isBirthday = item.trigger === 'birthday';
              return (
                <View key={item._id} style={s.promoCard}>
                  <View style={s.cardTopRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                      <View style={[s.autoIconBox, { backgroundColor: isBirthday ? '#FEF3C7' : '#EFF6FF' }]}>
                        {isBirthday ? <Gift size={18} color="#D97706" /> : <ShoppingBag size={18} color={colors.primary} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.promoTitle}>{item.name}</Text>
                        <Text style={s.copy}>{isBirthday ? 'Phát hành theo sinh nhật' : 'Phát hành theo giá trị đơn'}</Text>
                      </View>
                    </View>
                    <Pill
                      label={item.enabled ? 'Đang bật' : 'Đã tắt'}
                      bg={item.enabled ? '#ECFDF3' : '#F1F5F9'}
                      fg={item.enabled ? '#027A48' : '#64748B'}
                    />
                  </View>

                  <View style={s.promoMetaGrid}>
                    <View style={s.promoMetaCell}>
                      <Text style={s.promoMetaLabel}>Mức ưu đãi</Text>
                      <Text style={[s.promoMetaVal, { color: colors.primary }]}>
                        Giảm {item.discountType === 'percent' ? `${item.value}%` : money(item.value)}
                      </Text>
                    </View>
                    <View style={s.promoMetaCell}>
                      <Text style={s.promoMetaLabel}>Điều kiện kích hoạt</Text>
                      <Text style={s.promoMetaVal}>
                        {isBirthday ? 'Sinh nhật khách hàng' : `Đơn từ ${money(item.orderMinTotal)}`}
                      </Text>
                    </View>
                    <View style={s.promoMetaCell}>
                      <Text style={s.promoMetaLabel}>Đơn tối thiểu dùng mã</Text>
                      <Text style={s.promoMetaVal}>{money(item.minSubtotal)}</Text>
                    </View>
                    <View style={s.promoMetaCell}>
                      <Text style={s.promoMetaLabel}>Thời hạn sử dụng</Text>
                      <Text style={s.promoMetaVal}>{item.validityDays} ngày</Text>
                    </View>
                  </View>

                  <View style={s.cardActionRow}>
                    <View style={{ flex: 1 }}><Action secondary compact label="Chỉnh sửa" onPress={() => startAutomation(item)} /></View>
                    <View style={{ flex: 1 }}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => void toggleAutomation(item)}
                        style={[s.toggleBtn, item.enabled ? s.toggleBtnOff : s.toggleBtnOn]}
                      >
                        <Text style={[s.toggleBtnText, item.enabled ? s.toggleBtnTextOff : s.toggleBtnTextOn]}>
                          {item.enabled ? 'Tạm tắt' : 'Kích hoạt'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}
            {!busy && !automations.length && (
              <View style={s.emptyState}>
                <View style={s.emptyIconCircle}><Sparkles size={24} color={colors.primary} /></View>
                <Text style={s.emptyStateTitle}>Chưa có chương trình tự động</Text>
                <Text style={s.emptyStateCopy}>Thiết lập tự động tặng mã ưu đãi vào dịp sinh nhật hoặc khi khách đạt mốc đơn hàng.</Text>
              </View>
            )}
          </Section>

          <Modal visible={automationOpen} transparent animationType="slide" onRequestClose={() => { if (!saving) { setAutomationOpen(false); setEditingAutomation(null); } }}>
            <Pressable style={s.modalBackdrop} onPress={() => { if (!saving) { setAutomationOpen(false); setEditingAutomation(null); } }}>
              <Pressable style={s.modalSheet} onPress={() => {}}>
                <View style={s.modalHeader}>
                  <Text style={s.modalTitle}>{editingAutomation ? 'Sửa chương trình tự động' : 'Tạo chương trình tự động'}</Text>
                  <Pressable accessibilityRole="button" disabled={saving} onPress={() => { setAutomationOpen(false); setEditingAutomation(null); }} style={s.modalCloseBtn}>
                    <X size={18} color={colors.muted} />
                  </Pressable>
                </View>
                <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingTop: 6, paddingBottom: 4 }}>
                  <Field label="Tên chương trình" value={automationName} onChangeText={setAutomationName} placeholder="VD: Quà sinh nhật khách VIP" />
                  <View style={s.chipRow}>
                    <Chip label="Sinh nhật" active={automationTrigger === 'birthday'} onPress={() => setAutomationTrigger('birthday')} />
                    <Chip label="Đạt giá trị đơn" active={automationTrigger === 'order_total'} onPress={() => setAutomationTrigger('order_total')} />
                  </View>
                  {automationTrigger === 'order_total' && (
                    <Field label="Giá trị đơn tối thiểu (VND)" value={automationOrderMin} onChangeText={(v) => setAutomationOrderMin(formatVndInput(v))} keyboardType="numeric" />
                  )}
                  <View style={s.chipRow}>
                    <Chip label="Phần trăm (%)" active={kind === 'percent'} onPress={() => { setKind('percent'); setAutomationValue('10'); }} />
                    <Chip label="Số tiền (VND)" active={kind === 'amount'} onPress={() => { setKind('amount'); setAutomationValue(''); }} />
                  </View>
                  <View style={s.row}>
                    <Field
                      label={kind === 'percent' ? 'Mức giảm (%)' : 'Mức giảm (VND)'}
                      value={automationValue}
                      onChangeText={(v) => setAutomationValue(kind === 'amount' ? formatVndInput(v) : v.replace(/[^\d.]/g, ''))}
                      keyboardType="numeric"
                    />
                    <Field label="Số ngày hiệu lực" value={automationDays} onChangeText={(v) => setAutomationDays(v.replace(/[^\d]/g, ''))} keyboardType="numeric" />
                  </View>
                  <View style={s.row}>
                    <Field label="Đơn tối thiểu (VND)" value={automationMin} onChangeText={(v) => setAutomationMin(formatVndInput(v))} keyboardType="numeric" />
                    <Field label="Giảm tối đa (VND)" value={maxDiscount} onChangeText={(v) => setMaxDiscount(formatVndInput(v))} keyboardType="numeric" placeholder="Không giới hạn" />
                  </View>
                  <ErrorText>{error}</ErrorText>
                  <View style={s.row}>
                    <View style={{ flex: 1 }}><Action secondary disabled={saving} label="Hủy" onPress={() => { setAutomationOpen(false); setEditingAutomation(null); }} /></View>
                    <View style={{ flex: 1 }}><Action disabled={saving} label={saving ? 'Đang lưu…' : 'Lưu chương trình'} onPress={() => void saveAutomation()} /></View>
                  </View>
                </ScrollView>
              </Pressable>
            </Pressable>
          </Modal>
        </>
      )}

      {section === 'points' && (
        <>
          {policy && (
            <Section
              title="Chính sách tích & tiêu điểm"
              right={
                <Switch
                  value={policy.enabled}
                  onValueChange={(v) => setPolicy({ ...policy, enabled: v })}
                  trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
                  thumbColor={policy.enabled ? colors.primary : '#F8FAFC'}
                />
              }
            >
              <View style={s.metrics}>
                <View style={[s.metric, { backgroundColor: '#EFF6FF', borderColor: '#DBEAFE' }]}>
                  <Text style={s.metricLabel}>Tỷ lệ tích 1 điểm</Text>
                  <Text style={s.metricValue}>{money(policy.earnVndPerPoint)}</Text>
                </View>
                <View style={[s.metric, { backgroundColor: '#ECFDF3', borderColor: '#D1FADF' }]}>
                  <Text style={s.metricLabel}>Quy đổi 1 điểm</Text>
                  <Text style={[s.metricValue, { color: '#027A48' }]}>{money(policy.redeemVndPerPoint)}</Text>
                </View>
              </View>

              <View style={s.row}>
                <Field
                  label="VND tích 1 điểm"
                  value={formatVndInput(policy.earnVndPerPoint)}
                  onChangeText={(v) => setPolicy({ ...policy, earnVndPerPoint: parseVndInput(v) })}
                  keyboardType="numeric"
                />
                <Field
                  label="Giá trị 1 điểm (VND)"
                  value={formatVndInput(policy.redeemVndPerPoint)}
                  onChangeText={(v) => setPolicy({ ...policy, redeemVndPerPoint: parseVndInput(v) })}
                  keyboardType="numeric"
                />
              </View>
              <Field
                label="Tỷ lệ tiêu tối đa trên giá trị đơn (%)"
                value={String(policy.maxRedeemPercent)}
                onChangeText={(v) => setPolicy({ ...policy, maxRedeemPercent: Number(v.replace(/[^\d.]/g, '')) || 0 })}
                keyboardType="numeric"
              />
              {canManagePoints && (
                <Action disabled={pointBusy} label={pointBusy ? 'Đang lưu…' : 'Lưu chính sách điểm'} onPress={() => void savePolicy()} />
              )}
            </Section>
          )}

          {canManagePoints ? (
            <Section title="Sổ điểm khách hàng">
              <View style={s.searchInputWrap}>
                <Search size={17} color={colors.muted} />
                <TextInput
                  value={pointSearch}
                  onChangeText={(v) => { setPointSearch(v); setPointCustomer(null); setPointMatches([]); }}
                  placeholder="Tìm theo tên, số điện thoại hoặc mã khách"
                  placeholderTextColor={colors.muted}
                  style={s.searchInnerInput}
                />
                {!!pointSearch && (
                  <Pressable onPress={() => { setPointSearch(''); setPointCustomer(null); setPointMatches([]); setLedger([]); }} style={s.modalCloseBtn}>
                    <X size={15} color={colors.muted} />
                  </Pressable>
                )}
              </View>

              {pointMatches.length > 0 && (
                <View style={s.matchList}>
                  {pointMatches.map((customer) => (
                    <Pressable key={customer._id} onPress={() => void selectPointCustomer(customer)} style={s.matchRow}>
                      <View style={s.avatarCircle}><User size={16} color={colors.primary} /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.cardTitle}>{customer.name}</Text>
                        <Text style={s.copy}>{customer.phone} · {customer.customerCode}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}

              {pointCustomer ? (
                <>
                  <View style={s.loyaltyHeroCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={s.loyaltyCustomerName}>{pointCustomer.name}</Text>
                      <View style={s.loyaltyCodeBadge}><Text style={s.loyaltyCodeText}>{pointCustomer.customerCode}</Text></View>
                    </View>
                    <Text style={s.loyaltyCustomerPhone}>{pointCustomer.phone}</Text>
                    <View style={s.loyaltyBalanceRow}>
                      <View>
                        <Text style={s.loyaltyBalanceLabel}>SỐ DƯ HIỆN TẠI</Text>
                        <Text style={s.loyaltyBalanceValue}>{pointBalance.toLocaleString('vi-VN')} điểm</Text>
                      </View>
                      {policy && policy.redeemVndPerPoint > 0 && (
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={s.loyaltyBalanceLabel}>GIÁ TRỊ QUY ĐỔI</Text>
                          <Text style={s.loyaltyEquivValue}>≈ {money(pointBalance * policy.redeemVndPerPoint)}</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={s.formBox}>
                    <Text style={s.subHeading}>Điều chỉnh điểm thủ công</Text>
                    <View style={s.row}>
                      <Field label="Số điểm (+/-)" value={pointChange} onChangeText={setPointChange} keyboardType="numeric" placeholder="VD: 50 hoặc -20" />
                      <Field label="Lý do điều chỉnh" value={pointReason} onChangeText={setPointReason} placeholder="Nhập lý do" />
                    </View>
                    <Action disabled={pointBusy} label={pointBusy ? 'Đang cập nhật…' : 'Ghi điều chỉnh điểm'} onPress={() => void adjustPoints()} />
                  </View>

                  <Text style={s.subHeading}>Lịch sử điểm ({ledger.length})</Text>
                  {ledger.length > 0 ? ledger.map((entry) => (
                    <View key={entry._id} style={s.ledgerRow}>
                      <View style={{ flex: 1, gap: 3 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Pill
                            label={ledgerTypeLabel(entry.type)}
                            bg={entry.points >= 0 ? '#ECFDF3' : '#FEF3F2'}
                            fg={entry.points >= 0 ? '#027A48' : '#B42318'}
                          />
                          <Text style={s.copy}>{dateLabel(entry.createdAt)}</Text>
                        </View>
                        {!!entry.reason && <Text style={s.metaHighlight}>{entry.reason}</Text>}
                        <Text style={s.copy}>Số dư sau: {entry.balanceAfter.toLocaleString('vi-VN')} điểm</Text>
                      </View>
                      <Text style={[s.total, { color: entry.points >= 0 ? '#027A48' : '#B42318' }]}>
                        {entry.points > 0 ? `+${entry.points}` : entry.points}
                      </Text>
                    </View>
                  )) : (
                    <Text style={s.empty}>Chưa có lịch sử giao dịch điểm.</Text>
                  )}
                </>
              ) : (
                <View style={s.emptyState}>
                  <View style={s.emptyIconCircle}><Coins size={24} color={colors.primary} /></View>
                  <Text style={s.emptyStateTitle}>Tra cứu sổ điểm khách hàng</Text>
                  <Text style={s.emptyStateCopy}>Nhập tối thiểu 2 ký tự (tên, SĐT hoặc mã khách) để xem số dư và điều chỉnh điểm thưởng.</Text>
                </View>
              )}
            </Section>
          ) : (
            <Section title="Sổ điểm khách hàng">
              <Text style={s.copy}>Tài khoản này chỉ xem được chính sách điểm. Cần quyền retail-points:manage để tra cứu khách hàng và điều chỉnh điểm.</Text>
            </Section>
          )}
        </>
      )}
    </Page>
  );
}

function FinancePanel({ scope }: { scope: RetailScope }) {
  const [view, setView] = useState<'cash' | 'profit'>('cash');
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [cashbook, setCashbook] = useState<Awaited<ReturnType<typeof retailApi.cashbook>> | null>(null);
  const [profit, setProfit] = useState<Awaited<ReturnType<typeof retailApi.profit>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [account, setAccount] = useState<'cash' | 'bank'>('cash');
  const [direction, setDirection] = useState<'in' | 'out'>('out');
  const [profitCategory, setProfitCategory] = useState<'other' | 'expense'>('expense');
  const [voucherAmount, setVoucherAmount] = useState('');
  const [voucherReason, setVoucherReason] = useState('');
  const [voucherRef, setVoucherRef] = useState('');
  const [savingVoucher, setSavingVoucher] = useState(false);
  const voucherAttempt = useRef<{ fingerprint: string; key: string } | null>(null);

  const load = useCallback(async () => {
    if (!from || !to || from > to) { setError('Khoảng ngày không hợp lệ.'); return; }
    setBusy(true);
    setError('');
    try {
      if (view === 'cash') setCashbook(await retailApi.cashbook(scope, from, to));
      else setProfit(await retailApi.profit(scope, from, to));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được dữ liệu tài chính.');
    } finally {
      setBusy(false);
    }
  }, [from, scope, to, view]);

  useEffect(() => { void load(); }, [load]);

  const createVoucher = async () => {
    const amount = parseVndInput(voucherAmount);
    if (!Number.isSafeInteger(amount) || amount <= 0 || !voucherReason.trim()) {
      setError('Nhập số tiền và lý do hợp lệ cho phiếu thu chi.');
      return;
    }
    if (cashbook?.period) { setError('Kỳ quỹ đã chốt, không thể thêm phiếu.'); return; }
    const payload = {
      account,
      direction,
      profitCategory: direction === 'in' ? 'other' as const : profitCategory,
      amount,
      reason: voucherReason.trim(),
      ...(voucherRef.trim() ? { reference: voucherRef.trim() } : {}),
      businessDate: to,
    };
    const fingerprint = JSON.stringify({ scope, ...payload });
    if (voucherAttempt.current?.fingerprint !== fingerprint) voucherAttempt.current = { fingerprint, key: key() };
    setSavingVoucher(true);
    setError('');
    try {
      await retailApi.createCashVoucher(scope, { ...payload, idempotencyKey: voucherAttempt.current.key });
      voucherAttempt.current = null;
      setVoucherAmount('');
      setVoucherReason('');
      setVoucherRef('');
      await load();
      Alert.alert('Đã tạo phiếu thu chi');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không ghi được phiếu thu chi. Giữ nguyên nội dung và thử lại.');
    } finally {
      setSavingVoucher(false);
    }
  };

  const closePeriod = () => Alert.alert(
    'Chốt kỳ quỹ?',
    `Chốt sổ quỹ từ ${dateLabel(from)} đến ${dateLabel(to)}? Phiếu thu chi kỳ này sẽ không thể thêm.`,
    [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Chốt kỳ',
        onPress: () => {
          void retailApi.closeCashPeriod(scope, from, to)
            .then(() => load())
            .catch((e) => setError(e instanceof Error ? e.message : 'Không chốt được kỳ quỹ.'));
        },
      },
    ],
  );

  return (
    <Page refreshing={busy} onRefresh={() => void load()}>
      <Section title="Tài chính bán lẻ">
        <View style={s.chipRow}>
          <Chip label="Sổ quỹ" active={view === 'cash'} onPress={() => setView('cash')} />
          <Chip label="Lãi lỗ" active={view === 'profit'} onPress={() => setView('profit')} />
        </View>
        <View style={s.row}>
          <View style={{ flex: 1 }}><DateTimeField label="Từ ngày" value={from} onChange={setFrom} mode="date" /></View>
          <View style={{ flex: 1 }}><DateTimeField label="Đến ngày" value={to} onChange={setTo} mode="date" /></View>
        </View>
        <Loading busy={busy} error={error} onRetry={() => void load()} />
      </Section>

      {view === 'cash' && cashbook && (
        <>
          <Section
            title="Tổng hợp sổ quỹ"
            right={
              <Pill
                label={!cashbook.period ? 'Kỳ chưa chốt' : cashbook.balanced ? 'Đã chốt · Khớp' : 'Đã chốt · Cần đối soát'}
                bg={!cashbook.period ? '#FFF7ED' : cashbook.balanced ? '#ECFDF3' : '#FEF3F2'}
                fg={!cashbook.period ? '#C2410C' : cashbook.balanced ? '#027A48' : '#B42318'}
              />
            }
          >
            <View style={s.metrics}>
              <Metric label="Tiền mặt ròng" value={money(cashbook.summary.cashNet)} />
              <Metric label="Ngân hàng ròng" value={money(cashbook.summary.bankNet)} />
              <Metric label="Số phát sinh" value={String(cashbook.summary.count)} />
            </View>
          </Section>

          <Section title="Tạo phiếu thu chi">
            <View style={s.chipRow}>
              {[['cash', 'Tiền mặt'], ['bank', 'Ngân hàng']].map(([v, label]) => (
                <Chip key={v} label={label} active={account === v} onPress={() => setAccount(v as typeof account)} />
              ))}
            </View>
            <View style={s.chipRow}>
              {[['in', 'Phiếu thu'], ['out', 'Phiếu chi']].map(([v, label]) => (
                <Chip key={v} label={label} active={direction === v} onPress={() => { setDirection(v as typeof direction); if (v === 'in') setProfitCategory('other'); }} />
              ))}
            </View>
            {direction === 'out' && (
              <View style={s.chipRow}>
                <Chip label="Tính chi phí" active={profitCategory === 'expense'} onPress={() => setProfitCategory('expense')} />
                <Chip label="Không tính lãi lỗ" active={profitCategory === 'other'} onPress={() => setProfitCategory('other')} />
              </View>
            )}
            <Field label="Số tiền (VND)" value={voucherAmount} onChangeText={(v) => setVoucherAmount(formatVndInput(v))} keyboardType="numeric" placeholder="0" />
            <Field label="Lý do" value={voucherReason} onChangeText={setVoucherReason} placeholder="Nhập nội dung thu chi" />
            <Field label="Mã tham chiếu" value={voucherRef} onChangeText={setVoucherRef} placeholder="Không bắt buộc" />
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Action disabled={savingVoucher || Boolean(cashbook.period)} label={savingVoucher ? 'Đang ghi…' : 'Tạo phiếu'} onPress={() => void createVoucher()} />
              </View>
              <View style={{ flex: 1 }}>
                <Action secondary disabled={Boolean(cashbook.period)} label="Chốt kỳ quỹ" onPress={closePeriod} />
              </View>
            </View>
          </Section>

          <Section title="Phát sinh sổ quỹ">
            {cashbook.entries.map((entry, i) => (
              <View style={s.listRow} key={`${entry.sourceKey}-${i}`}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{entry.description}</Text>
                  <Text style={s.copy}>{entry.businessDate} · {entry.sourceKey} · {entry.account === 'cash' ? 'Tiền mặt' : 'Ngân hàng'}</Text>
                </View>
                <Text style={[s.total, { color: entry.direction === 'in' ? '#027A48' : '#B42318' }]}>
                  {entry.direction === 'in' ? '+' : '−'}{money(entry.amount)}
                </Text>
              </View>
            ))}
            {!cashbook.entries.length && <Text style={s.empty}>Chưa có phát sinh trong kỳ.</Text>}
          </Section>

          {cashbook.shiftsReconciliation.length > 0 && (
            <Section title="Đối soát ca tiền mặt">
              {cashbook.shiftsReconciliation.map((entry) => (
                <Card key={entry.shiftId}>
                  <Text style={s.cardTitle}>{entry.shiftCode} · {entry.businessDate}</Text>
                  <Text style={s.copy}>
                    Dự kiến {money(entry.expectedCash)} · Đếm {money(entry.countedCash)} · Lệch {money(entry.varianceAmount)}
                  </Text>
                </Card>
              ))}
            </Section>
          )}
        </>
      )}

      {view === 'profit' && profit && (
        <>
          <Section title="Báo cáo lãi lỗ">
            <View style={s.metrics}>
              <Metric label="Doanh thu" value={money(profit.summary.revenue)} />
              <Metric label="Giá vốn đã biết" value={money(profit.summary.knownCost)} />
              <Metric label="Lãi gộp" value={money(profit.summary.grossProfit)} />
              <Metric label="Lãi ròng" value={money(profit.summary.netProfit)} />
            </View>
            <View style={s.summaryBox}>
              <View style={s.kvRow}><Text style={s.copy}>Dòng thiếu giá vốn</Text><Text style={s.kvVal}>{profit.summary.missingCostCount}</Text></View>
              <View style={s.kvRow}><Text style={s.copy}>Dòng dưới giá vốn</Text><Text style={s.kvVal}>{profit.summary.belowCostCount}</Text></View>
              <View style={s.kvRow}><Text style={s.copy}>Chi phí vận hành</Text><Text style={s.kvVal}>{money(profit.summary.operatingExpense)}</Text></View>
              <View style={s.kvRow}><Text style={s.copy}>Hoa hồng</Text><Text style={s.kvVal}>{money(profit.summary.commissionExpense)}</Text></View>
            </View>
          </Section>

          <Section title="Lãi gộp theo sản phẩm">
            {profit.bySku.map((item) => (
              <View key={item.sku} style={s.listRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{item.productName}</Text>
                  <Text style={s.copy}>{item.sku} · DT {money(item.revenue)} · Vốn {item.missingCostCount ? 'Thiếu' : money(item.cost)}</Text>
                </View>
                <Text style={s.total}>{money(item.grossProfit)}</Text>
              </View>
            ))}
            {!profit.bySku.length && <Text style={s.empty}>Chưa có dữ liệu theo SKU.</Text>}
          </Section>
        </>
      )}
    </Page>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.metric}>
      <Text style={s.metricLabel}>{label}</Text>
      <Text style={s.metricValue}>{value}</Text>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, active && s.chipActive]}>
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 14, paddingBottom: 36, gap: 12 },
  section: {
    gap: 10,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    backgroundColor: colors.white,
    shadowColor: '#0F172A',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: '800', flexShrink: 1 },
  subHeading: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  formBox: { gap: 10, padding: 14, borderRadius: 14, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  detailGroup: { gap: 4, padding: 14, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  summaryBox: { gap: 6, padding: 14, borderRadius: 14, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  fieldWrap: { gap: 6, flex: 1 },
  label: { color: '#334155', fontSize: 12, fontWeight: '700' },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    color: colors.ink,
    fontSize: 14,
    backgroundColor: '#FFFFFF',
  },
  multiline: { minHeight: 80, textAlignVertical: 'top', paddingTop: 10 },
  action: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  actionCompact: { minHeight: 36, paddingHorizontal: 12, borderRadius: 10 },
  actionText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  secondary: { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1' },
  secondaryText: { color: colors.ink },
  danger: { backgroundColor: '#DC2626' },
  disabled: { opacity: 0.45 },
  card: {
    gap: 6,
    padding: 13,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  cardSelected: { borderColor: colors.primary, backgroundColor: '#F8FBFF' },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  cardFooterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  cardActionRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  cardTitle: { color: colors.ink, fontSize: 13.5, fontWeight: '800' },
  copy: { color: '#64748B', fontSize: 12.5, lineHeight: 18 },
  metaHighlight: { color: '#334155', fontSize: 12.5, fontWeight: '600' },
  total: { color: colors.primary, fontSize: 14, fontWeight: '900' },
  error: { color: '#B42318', fontSize: 12.5, lineHeight: 18, fontWeight: '600' },
  empty: { color: colors.muted, fontSize: 13, textAlign: 'center', paddingVertical: 18 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  chip: {
    minHeight: 34,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipText: { color: '#475569', fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: '#FFFFFF' },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pillText: { fontSize: 11, fontWeight: '800' },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 },
  pageLabel: { color: '#475569', fontSize: 12.5, fontWeight: '700' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  metric: { width: '48.5%', gap: 4, padding: 12, borderRadius: 14, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE' },
  metricLabel: { color: '#475569', fontSize: 11.5, fontWeight: '700' },
  metricValue: { color: colors.primary, fontSize: 15, fontWeight: '900' },
  row: { flexDirection: 'row', gap: 10 },
  listRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  subItem: { gap: 4, paddingTop: 10, marginTop: 6, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  switchLabel: { color: colors.ink, fontSize: 13.5, fontWeight: '700' },
  kvRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  kvVal: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  kvDivider: { marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#CBD5E1' },
  good: { color: '#027A48', fontSize: 12, fontWeight: '800' },
  warn: { color: '#B54708', fontSize: 12, fontWeight: '700', lineHeight: 17 },
  accent: { color: colors.primary },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: 'rgba(15,23,42,0.48)' },
  modalSheet: { maxHeight: '88%', padding: 18, borderRadius: 24, overflow: 'hidden', backgroundColor: colors.white },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingBottom: 12, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  modalTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  selectField: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, backgroundColor: '#FFFFFF' },
  selectFieldText: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: '600' },
  selectPlaceholder: { color: colors.muted, fontWeight: '400' },
  cashierPicker: { gap: 8, padding: 10, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, backgroundColor: '#F8FAFC' },
  cashierOption: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 10, borderRadius: 9 },
  cashierOptionSelected: { backgroundColor: '#EFF6FF' },
  cashierOptionText: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  cashierOptionTextSelected: { color: colors.primary, fontWeight: '800' },
  searchFilterRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterBtn: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  filterBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterBtnText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  filterBtnTextActive: { color: '#FFFFFF' },
  activeFilterBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE' },
  filterClearText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  segmentedBar: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 14, backgroundColor: '#E2E8F0' },
  segmentedTab: {
    flex: 1,
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 8,
    borderRadius: 11,
  },
  segmentedTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  segmentedTabText: { color: '#475569', fontSize: 12, fontWeight: '700' },
  segmentedTabTextActive: { color: colors.primary, fontWeight: '800' },
  inlinePrimaryBtn: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  inlinePrimaryBtnText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '800' },
  promoCard: {
    gap: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  couponCodeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#93C5FD',
  },
  couponCodeText: { color: colors.primary, fontSize: 13, fontWeight: '900', letterSpacing: 0.6 },
  discountTag: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: '#FEF2F2' },
  discountTagText: { color: '#DC2626', fontSize: 12, fontWeight: '900' },
  promoTitle: { color: colors.ink, fontSize: 14.5, fontWeight: '800' },
  promoMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 8,
    columnGap: 10,
    padding: 11,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  promoMetaCell: { width: '47%', gap: 2 },
  promoMetaLabel: { color: '#64748B', fontSize: 11, fontWeight: '600' },
  promoMetaVal: { color: colors.ink, fontSize: 12.5, fontWeight: '700' },
  progressTrack: { height: 6, borderRadius: 999, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: colors.primary },
  toggleBtn: { minHeight: 36, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderRadius: 10, borderWidth: 1 },
  toggleBtnOff: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  toggleBtnOn: { backgroundColor: '#ECFDF3', borderColor: '#A6F4C5' },
  toggleBtnText: { fontSize: 12.5, fontWeight: '800' },
  toggleBtnTextOff: { color: '#B42318' },
  toggleBtnTextOn: { color: '#027A48' },
  autoIconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  emptyState: { alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 22, paddingHorizontal: 16 },
  emptyIconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyStateTitle: { color: colors.ink, fontSize: 14.5, fontWeight: '800' },
  emptyStateCopy: { color: '#64748B', fontSize: 12.5, lineHeight: 18, textAlign: 'center' },
  searchInputWrap: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  searchInnerInput: { flex: 1, minWidth: 0, minHeight: 42, color: colors.ink, fontSize: 14, paddingVertical: 0 },
  matchList: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  avatarCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  loyaltyHeroCard: { gap: 4, padding: 16, borderRadius: 16, backgroundColor: colors.primary },
  loyaltyCustomerName: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  loyaltyCodeBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.2)' },
  loyaltyCodeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  loyaltyCustomerPhone: { color: '#DBEAFE', fontSize: 12.5, fontWeight: '600' },
  loyaltyBalanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.22)' },
  loyaltyBalanceLabel: { color: '#BFDBFE', fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  loyaltyBalanceValue: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', marginTop: 2 },
  loyaltyEquivValue: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', marginTop: 2 },
  ledgerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
});
