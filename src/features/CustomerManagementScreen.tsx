import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ComponentProps } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import {
  ArrowLeft,
  AtSign,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Coins,
  CreditCard,
  FileText,
  History,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Settings,
  ShoppingBag,
  SlidersHorizontal,
  Trash2,
  UserRound,
  Users,
  Wrench,
  X,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useAuth } from '@/core/auth/AuthProvider';
import type { FeatureScreenProps } from '@/features/modules/featureScreenRegistry';
import { fetchCompanyBranches, type ErpBranch } from '@/features/overview/overviewApi';
import { DateTimeField } from '@/features/quotation/DateTimeField';
import { listWorkerCompanies } from '@/features/workerManagementApi';
import {
  customerManagementApi,
  type BillingProfile,
  type BillingProfileInput,
  type Customer,
  type CustomerInput,
  type CustomerPage,
  type CustomerPointPolicy,
  type CustomerStatus,
  type CustomerTier,
  type CustomerTransactionRow,
  type CustomerType,
} from '@/features/customerManagementApi';
import { colors } from '@/theme/colors';

type Tab = 'list' | 'settings';
type DetailTab = 'overview' | 'transactions' | 'purchases' | 'repairs' | 'receivables' | 'points' | 'billing';

const emptyPage: CustomerPage = { items: [], total: 0, page: 1, limit: 20 };
const emptyInput = (): CustomerInput => ({
  name: '',
  phone: '',
  customerKind: 'individual',
  contactName: '',
  type: 'regular',
  email: '',
  dateOfBirth: '',
  gender: undefined,
  address: '',
  notes: '',
});
const emptyBilling = (): BillingProfileInput => ({
  legalName: '',
  taxId: '',
  address: '',
  invoiceEmail: '',
  contactName: '',
  isDefault: true,
});
const customerInput = (customer: Customer): CustomerInput => ({
  name: customer.name,
  phone: customer.phone,
  type: customer.type,
  customerKind: customer.customerKind,
  contactName: customer.contactName || '',
  email: customer.email || '',
  dateOfBirth: customer.dateOfBirth?.slice(0, 10) || '',
  gender: customer.gender,
  address: customer.address || '',
  notes: customer.notes || '',
});

const money = (amount?: number) => `${Math.round(Number(amount || 0)).toLocaleString('vi-VN')} VND`;
const formatVndInput = (value: string | number | null | undefined) => {
  const digits = String(value ?? '').replace(/[^\d]/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('vi-VN');
};
const parseVndInput = (value: string) => Number(String(value || '').replace(/[^\d]/g, '')) || 0;

const dateLabel = (value?: string, withTime = false) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(
    'vi-VN',
    withTime ? { dateStyle: 'short', timeStyle: 'short' } : { dateStyle: 'short' },
  ).format(date);
};
const statusLabel = (status: CustomerStatus) => (status === 'active' ? 'Đang hoạt động' : 'Ngừng hoạt động');
const paymentMethodLabel = (method?: string) =>
  ({ cash: 'Tiền mặt', card: 'Thẻ', transfer: 'Chuyển khoản', ewallet: 'Ví điện tử' } as Record<string, string>)[
    method || ''
  ] ||
  method ||
  '—';

function hasPermission(permissions: string[] | undefined, values: string[]) {
  return Boolean(permissions?.some((permission) => permission === '*' || values.includes(permission)));
}

function Chip({
  label,
  selected,
  onPress,
  icon: Icon,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: LucideIcon;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      {Icon && <Icon size={14} color={selected ? colors.white : '#475569'} />}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function Action({
  label,
  onPress,
  primary,
  danger,
  compact,
  disabled,
  icon: Icon,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  danger?: boolean;
  compact?: boolean;
  disabled?: boolean;
  icon?: LucideIcon;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.action,
        compact && styles.actionCompact,
        primary && styles.actionPrimary,
        danger && styles.actionDanger,
        disabled && styles.disabled,
      ]}
    >
      {Icon && <Icon size={15} color={primary || danger ? colors.white : colors.primary} />}
      <Text
        numberOfLines={1}
        style={[styles.actionText, (primary || danger) && styles.actionTextPrimary]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Pill({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  ...inputProps
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
} & Omit<ComponentProps<typeof TextInput>, 'value' | 'onChangeText' | 'placeholder' | 'multiline'>) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[styles.input, multiline && styles.multiline, inputProps.editable === false && styles.inputDisabled]}
        {...inputProps}
      />
    </View>
  );
}

function SelectChips<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value?: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.chipWrap}>
        {options.map((item) => (
          <Chip key={item.value} label={item.label} selected={value === item.value} onPress={() => onChange(item.value)} />
        ))}
      </View>
    </View>
  );
}

function CustomerFormModal({
  target,
  companyCode,
  onClose,
  onSaved,
}: {
  target: Customer | 'new';
  companyCode: string;
  onClose: () => void;
  onSaved: (customer: Customer, warning?: string) => void;
}) {
  const [form, setForm] = useState<CustomerInput>(() => (target !== 'new' ? customerInput(target) : emptyInput()));
  const [billing, setBilling] = useState<BillingProfileInput>(emptyBilling());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const needsBilling = form.type === 'vat' && (target === 'new' || target.type !== 'vat');
  const setField = <K extends keyof CustomerInput>(key: K, value: CustomerInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      setError('Vui lòng nhập tên và số điện thoại.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const saved =
        target === 'new'
          ? await customerManagementApi.create(companyCode, form)
          : await customerManagementApi.update(target._id, companyCode, form, target.version);
      let warning: string | undefined;
      if (
        needsBilling &&
        billing.legalName.trim() &&
        billing.taxId.trim() &&
        billing.address.trim() &&
        billing.invoiceEmail.trim()
      ) {
        try {
          const result = await customerManagementApi.createBillingProfile(saved._id, companyCode, {
            ...billing,
            legalName: billing.legalName.trim(),
            taxId: billing.taxId.trim(),
            address: billing.address.trim(),
            invoiceEmail: billing.invoiceEmail.trim(),
          });
          warning = result.warnings[0]?.message;
        } catch (cause) {
          warning = `Đã lưu khách hàng nhưng chưa tạo hồ sơ VAT: ${
            cause instanceof Error ? cause.message : 'Có lỗi xảy ra.'
          }`;
        }
      } else if (needsBilling) {
        warning = 'Đã lưu khách hàng. Hồ sơ VAT chưa được tạo vì còn thiếu thông tin.';
      }
      onSaved(saved, warning);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không lưu được khách hàng.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => { if (!busy) onClose(); }}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {target === 'new' ? 'Thêm khách hàng' : 'Sửa hồ sơ khách hàng'}
            </Text>
            <Pressable
              accessibilityLabel="Đóng"
              disabled={busy}
              onPress={onClose}
              style={styles.modalCloseBtn}
            >
              <X size={18} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.modalBody}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <SelectChips
              label="Đối tượng khách hàng"
              value={form.customerKind || 'individual'}
              options={[
                { value: 'individual', label: 'Cá nhân' },
                { value: 'business', label: 'Doanh nghiệp / tổ chức' },
              ]}
              onChange={(value) => setField('customerKind', value)}
            />
            <Field
              label={`${form.customerKind === 'business' ? 'Tên doanh nghiệp / tổ chức' : 'Họ và tên'} *`}
              value={form.name}
              onChangeText={(value) => setField('name', value)}
              placeholder={form.customerKind === 'business' ? 'VD: Công ty TNHH ABC' : 'VD: Nguyễn Văn A'}
              autoCapitalize="words"
            />
            {form.customerKind === 'business' && (
              <Field
                label="Người liên hệ"
                value={form.contactName || ''}
                onChangeText={(value) => setField('contactName', value)}
                placeholder="Tên người đại diện liên hệ"
              />
            )}
            <Field
              label="Số điện thoại *"
              value={form.phone}
              onChangeText={(value) => setField('phone', value)}
              placeholder="09xx xxx xxx"
              keyboardType="phone-pad"
            />
            <Field
              label="Email"
              value={form.email || ''}
              onChangeText={(value) => setField('email', value)}
              placeholder="email@domain.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {form.customerKind !== 'business' && (
              <>
                <DateTimeField
                  label="Ngày sinh"
                  value={form.dateOfBirth || ''}
                  mode="date"
                  allowClear
                  onChange={(value) => setField('dateOfBirth', value)}
                />
                <SelectChips
                  label="Giới tính"
                  value={form.gender}
                  options={[
                    { value: 'male', label: 'Nam' },
                    { value: 'female', label: 'Nữ' },
                    { value: 'other', label: 'Khác' },
                  ]}
                  onChange={(value) => setField('gender', value)}
                />
              </>
            )}
            <SelectChips
              label="Chế độ hóa đơn"
              value={form.type || 'regular'}
              options={[
                { value: 'regular', label: 'Khách thường' },
                { value: 'vat', label: 'Khách xuất VAT' },
              ]}
              onChange={(value) => setField('type', value)}
            />
            <Field
              label="Địa chỉ"
              value={form.address || ''}
              onChangeText={(value) => setField('address', value)}
              placeholder="Số nhà, đường, quận/huyện, tỉnh/thành"
            />
            {needsBilling && (
              <View style={styles.subForm}>
                <Text style={styles.sectionTitle}>Thông tin xuất VAT</Text>
                <Text style={styles.muted}>Có thể thêm hồ sơ VAT mặc định dùng cho hóa đơn POS.</Text>
                <Field
                  label="Tên pháp nhân"
                  value={billing.legalName}
                  onChangeText={(value) => setBilling((current) => ({ ...current, legalName: value }))}
                />
                <Field
                  label="Mã số thuế"
                  value={billing.taxId}
                  onChangeText={(value) => setBilling((current) => ({ ...current, taxId: value }))}
                />
                <Field
                  label="Địa chỉ hóa đơn"
                  value={billing.address}
                  onChangeText={(value) => setBilling((current) => ({ ...current, address: value }))}
                />
                <Field
                  label="Email nhận hóa đơn"
                  value={billing.invoiceEmail}
                  onChangeText={(value) => setBilling((current) => ({ ...current, invoiceEmail: value }))}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <Field
                  label="Người liên hệ"
                  value={billing.contactName || ''}
                  onChangeText={(value) => setBilling((current) => ({ ...current, contactName: value }))}
                />
              </View>
            )}
            <Field
              label="Ghi chú"
              value={form.notes || ''}
              onChangeText={(value) => setField('notes', value)}
              placeholder="Ghi chú thêm về khách hàng…"
              multiline
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </ScrollView>
          <View style={styles.modalFooter}>
            <View style={{ flex: 1 }}>
              <Action label="Hủy" onPress={onClose} disabled={busy} />
            </View>
            <View style={{ flex: 1 }}>
              <Action
                label={busy ? 'Đang lưu…' : 'Lưu khách hàng'}
                onPress={() => void save()}
                primary
                disabled={busy}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: 'blue' | 'green' | 'amber' | 'red';
}) {
  const palette =
    accent === 'green'
      ? { bg: '#ECFDF3', border: '#D1FADF', fg: '#027A48' }
      : accent === 'amber'
        ? { bg: '#FFFBEB', border: '#FDE68A', fg: '#B45309' }
        : accent === 'red'
          ? { bg: '#FEF2F2', border: '#FECACA', fg: '#B42318' }
          : { bg: '#EFF6FF', border: '#DBEAFE', fg: colors.primary };
  return (
    <View style={[styles.summaryCard, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.summaryValue, { color: palette.fg }]}>
        {value}
      </Text>
      {hint ? <Text style={styles.muted}>{hint}</Text> : null}
    </View>
  );
}

function InfoRow({ label, value, icon: Icon }: { label: string; value?: string; icon?: LucideIcon }) {
  return (
    <View style={styles.infoRow}>
      {Icon && (
        <View style={styles.infoIconWrap}>
          <Icon size={15} color={colors.primary} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || '—'}</Text>
      </View>
    </View>
  );
}

function CustomerDetail({
  customer,
  branchId,
  canManage,
  canRetailRead,
  canManagePoints,
  canRepairRead,
  onBack,
  onEdit,
  onStatusChange,
}: {
  customer: Customer;
  branchId?: string;
  canManage: boolean;
  canRetailRead: boolean;
  canManagePoints: boolean;
  canRepairRead: boolean;
  onBack: () => void;
  onEdit: () => void;
  onStatusChange: () => void;
}) {
  const [tab, setTab] = useState<DetailTab>('overview');
  const tabs: Array<{ key: DetailTab; label: string; icon: LucideIcon }> = [
    { key: 'overview', label: 'Tổng quan', icon: UserRound },
    { key: 'transactions', label: 'Lịch sử giao dịch', icon: History },
    { key: 'purchases', label: 'Mua hàng & bảo hành', icon: ShoppingBag },
    { key: 'repairs', label: 'Dịch vụ & bảo hành', icon: Wrench },
    { key: 'receivables', label: 'Công nợ', icon: CreditCard },
    { key: 'points', label: 'Điểm thưởng', icon: Coins },
    { key: 'billing', label: 'Hồ sơ VAT', icon: FileText },
  ];
  const isBusiness = customer.customerKind === 'business';
  return (
    <View style={styles.flex}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
        contentContainerStyle={styles.workspaceTabs}
      >
        {tabs.map(({ key, label, icon }) => (
          <Chip key={key} label={label} selected={tab === key} icon={icon} onPress={() => setTab(key)} />
        ))}
      </ScrollView>
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.detailHero}>
          <View style={styles.spaceBetween}>
            <Pressable accessibilityRole="button" onPress={onBack} style={styles.backPill}>
              <ArrowLeft size={15} color={colors.primary} />
              <Text style={styles.backPillText}>Danh sách</Text>
            </Pressable>
            <Pill
              label={statusLabel(customer.status)}
              bg={customer.status === 'active' ? '#ECFDF3' : '#F1F5F9'}
              fg={customer.status === 'active' ? '#027A48' : '#64748B'}
            />
          </View>

          <View style={styles.customerHeading}>
            <View style={[styles.customerAvatarLg, isBusiness && { backgroundColor: '#FEF3C7' }]}>
              {isBusiness ? (
                <Building2 size={22} color="#D97706" />
              ) : (
                <UserRound size={22} color={colors.primary} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.customerName}>{customer.name}</Text>
              <Text style={styles.customerMeta}>
                {customer.customerCode}
                {customer.phone ? ` · ${customer.phone}` : ''}
              </Text>
              <View style={[styles.rowWrap, { marginTop: 6 }]}>
                <Pill
                  label={isBusiness ? 'Doanh nghiệp' : 'Cá nhân'}
                  bg="#F1F5F9"
                  fg="#475569"
                />
                <Pill
                  label={customer.type === 'vat' ? 'Xuất VAT' : 'Khách thường'}
                  bg={customer.type === 'vat' ? '#EFF6FF' : '#F1F5F9'}
                  fg={customer.type === 'vat' ? colors.primary : '#475569'}
                />
                {customer.tier && (
                  <Pill label={customer.tier.name} bg="#F3E8FF" fg="#7E22CE" />
                )}
              </View>
            </View>
          </View>

          <View style={styles.detailActionRow}>
            {customer.phone ? (
              <View style={{ flex: 1 }}>
                <Action
                  compact
                  label="Gọi"
                  icon={Phone}
                  onPress={() => void Linking.openURL(`tel:${customer.phone}`).catch(() => undefined)}
                />
              </View>
            ) : null}
            {canManage && (
              <>
                <View style={{ flex: 1 }}>
                  <Action
                    compact
                    label={customer.status === 'active' ? 'Tạm ngừng' : 'Kích hoạt'}
                    onPress={onStatusChange}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Action compact label="Sửa hồ sơ" icon={Pencil} onPress={onEdit} primary />
                </View>
              </>
            )}
          </View>
        </View>

        {tab === 'overview' && <CustomerOverview customer={customer} branchId={branchId} />}
        {tab === 'transactions' && <TransactionsPanel customer={customer} branchId={branchId} />}
        {tab === 'purchases' && <PurchasesPanel customer={customer} branchId={branchId} />}
        {tab === 'repairs' && <RepairsPanel customer={customer} branchId={branchId} canRead={canRepairRead} />}
        {tab === 'receivables' && (
          <ReceivablesPanel customer={customer} branchId={branchId} canRead={canRetailRead} />
        )}
        {tab === 'points' && (
          <PointsPanel
            customer={customer}
            branchId={branchId}
            canRead={canRetailRead}
            canManage={canManagePoints}
          />
        )}
        {tab === 'billing' && <BillingPanel customer={customer} canManage={canManage} />}
      </ScrollView>
    </View>
  );
}

function CustomerOverview({ customer, branchId }: { customer: Customer; branchId?: string }) {
  const [history, setHistory] = useState<Awaited<ReturnType<typeof customerManagementApi.purchaseHistory>> | null>(
    null,
  );
  const [error, setError] = useState('');
  useEffect(() => {
    if (!branchId) {
      setHistory(null);
      return;
    }
    let active = true;
    void customerManagementApi
      .purchaseHistory(customer._id, { companyCode: customer.companyCode, branchId })
      .then((value) => {
        if (active) {
          setHistory(value);
          setError('');
        }
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Không tải được tổng quan mua hàng.');
      });
    return () => {
      active = false;
    };
  }, [branchId, customer._id, customer.companyCode]);

  const gender =
    customer.gender === 'male' ? 'Nam' : customer.gender === 'female' ? 'Nữ' : customer.gender === 'other' ? 'Khác' : '—';

  return (
    <View style={styles.sectionStack}>
      {!branchId ? (
        <Text style={styles.infoBanner}>Chọn chi nhánh ở góc trên để xem số liệu mua hàng và công nợ.</Text>
      ) : (
        <View style={styles.summaryGrid}>
          <SummaryCard label="Tổng đơn tại chi nhánh" value={history ? String(history.summary.orderCount) : '—'} accent="blue" />
          <SummaryCard
            label="Tổng giá trị mua"
            value={history ? money(history.summary.totalPurchased) : '—'}
            accent="green"
          />
          <SummaryCard
            label="Công nợ hiện tại"
            value={history ? money(history.summary.currentDebt) : '—'}
            accent={history && history.summary.currentDebt > 0 ? 'red' : 'amber'}
          />
          <SummaryCard label="Thiết bị đã mua" value={history ? String(history.devices.length) : '—'} accent="blue" />
        </View>
      )}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Thông tin hồ sơ</Text>
        <InfoRow label="Mã khách hàng" value={customer.customerCode} icon={UserRound} />
        <InfoRow
          label="Đối tượng khách hàng"
          value={
            customer.customerKind === 'business'
              ? 'Doanh nghiệp / tổ chức'
              : customer.customerKind === 'individual'
                ? 'Cá nhân'
                : 'Chưa phân loại'
          }
        />
        {customer.customerKind === 'business' && <InfoRow label="Người liên hệ" value={customer.contactName} />}
        <InfoRow label="Số điện thoại" value={customer.phone} icon={Phone} />
        <InfoRow label="Email" value={customer.email} icon={AtSign} />
        <InfoRow label="Ngày sinh" value={dateLabel(customer.dateOfBirth)} icon={CalendarDays} />
        <InfoRow label="Giới tính" value={gender} />
        <InfoRow label="Chế độ hóa đơn" value={customer.type === 'vat' ? 'Xuất VAT' : 'Thông thường'} />
        <InfoRow
          label="Hạng thành viên"
          value={
            customer.tier
              ? `${customer.tier.name}${
                  typeof customer.tierGrossProfit === 'number'
                    ? ` · lãi gộp ${money(customer.tierGrossProfit)}`
                    : ''
                }`
              : 'Chưa xếp hạng'
          }
          icon={Coins}
        />
        <InfoRow label="Địa chỉ" value={customer.address} icon={MapPin} />
        <InfoRow
          label="Nguồn hồ sơ"
          value={
            customer.source === 'pos'
              ? 'Tạo từ bán hàng'
              : customer.source === 'import'
                ? 'Nhập dữ liệu'
                : 'Tạo thủ công'
          }
        />
        {customer.notes ? (
          <View style={styles.notesBox}>
            <Text style={styles.infoLabel}>Ghi chú</Text>
            <Text style={styles.body}>{customer.notes}</Text>
          </View>
        ) : null}
        <InfoRow label="Ngày tạo hồ sơ" value={dateLabel(customer.createdAt, true)} />
        <InfoRow label="Người tạo" value={customer.createdByName} />
      </View>
    </View>
  );
}

function PurchasesPanel({ customer, branchId }: { customer: Customer; branchId?: string }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof customerManagementApi.purchaseHistory>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!branchId) {
      setData(null);
      return;
    }
    let active = true;
    setBusy(true);
    setError('');
    void customerManagementApi
      .purchaseHistory(customer._id, { companyCode: customer.companyCode, branchId })
      .then((value) => {
        if (active) setData(value);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Không tải được lịch sử mua hàng.');
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [branchId, customer._id, customer.companyCode]);

  if (!branchId) return <Text style={styles.infoBanner}>Chọn chi nhánh để xem lịch sử mua hàng.</Text>;
  if (busy) return <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />;
  if (error) return <Text style={styles.errorText}>{error}</Text>;
  if (!data) return null;

  return (
    <View style={styles.sectionStack}>
      <View style={styles.summaryGrid}>
        <SummaryCard label="Số đơn" value={String(data.summary.orderCount)} accent="blue" />
        <SummaryCard label="Tổng đã mua" value={money(data.summary.totalPurchased)} accent="blue" />
        <SummaryCard label="Đã thanh toán" value={money(data.summary.totalPaid)} accent="green" />
        <SummaryCard
          label="Công nợ hiện tại"
          value={money(data.summary.currentDebt)}
          accent={data.summary.currentDebt > 0 ? 'red' : 'amber'}
        />
      </View>
      <Text style={styles.muted}>Lần mua gần nhất: {dateLabel(data.summary.lastPurchaseAt)}</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Đơn hàng ({data.items.length})</Text>
        {data.items.length ? (
          data.items.map((order) => (
            <View key={order._id} style={styles.subCard}>
              <View style={styles.spaceBetween}>
                <Text numberOfLines={1} ellipsizeMode="middle" style={[styles.cardTitle, { flex: 1 }]}>
                  {order.orderCode || `Đơn treo #${order._id.slice(-6)}`}
                </Text>
                <Text style={styles.primaryValue}>{money(order.grandTotal)}</Text>
              </View>
              <Text style={styles.muted}>
                {dateLabel(order.businessDate)} ·{' '}
                {({ draft: 'Nháp', confirmed: 'Đã xác nhận', completed: 'Hoàn thành', cancelled: 'Đã hủy' } as Record<
                  string,
                  string
                >)[order.status || ''] ||
                  order.status ||
                  'Không rõ'}
              </Text>
              <Text style={styles.muted}>
                Đã thanh toán: {money(order.paidAmount)} · Còn nợ: {money(order.dueAmount)} · {order.itemCount} sản phẩm
              </Text>
              <Text style={styles.muted}>Nhân viên: {order.salespersonName || '—'}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.empty}>Chưa có đơn mua tại chi nhánh này.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Thiết bị đã mua ({data.devices.length})</Text>
        {data.devices.length ? (
          data.devices.map((device) => {
            const inWarranty = device.warrantyEndAt
              ? new Date(device.warrantyEndAt).getTime() >= Date.now()
              : false;
            return (
              <View key={device._id} style={styles.subCard}>
                <View style={styles.spaceBetween}>
                  <Text style={[styles.cardTitle, { flex: 1 }]}>{device.productName}</Text>
                  <Pill
                    label={
                      device.warrantyEndAt
                        ? inWarranty
                          ? 'Còn bảo hành'
                          : 'Hết bảo hành'
                        : 'Chưa cập nhật'
                    }
                    bg={inWarranty ? '#ECFDF3' : '#F1F5F9'}
                    fg={inWarranty ? '#027A48' : '#64748B'}
                  />
                </View>
                <Text style={styles.muted}>
                  SKU: {device.sku || '—'} · IMEI / Serial: {device.serialNumber || '—'}
                </Text>
                <Text style={styles.muted}>
                  Mã vạch: {device.internalBarcode || '—'} · Ngày bán: {dateLabel(device.soldAt)}
                </Text>
                <Text style={styles.muted}>
                  Hạn bảo hành: {dateLabel(device.warrantyEndAt)}
                  {device.orderCode ? ` · Đơn ${device.orderCode}` : ''}
                </Text>
              </View>
            );
          })
        ) : (
          <Text style={styles.empty}>Chưa có thiết bị có IMEI / serial tại chi nhánh này.</Text>
        )}
      </View>
    </View>
  );
}

function TransactionsPanel({ customer, branchId }: { customer: Customer; branchId?: string }) {
  const [filter, setFilter] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Awaited<ReturnType<typeof customerManagementApi.transactions>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<CustomerTransactionRow | null>(null);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof customerManagementApi.transactionDetail>> | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);

  const scope = useMemo(
    () => (branchId ? { companyCode: customer.companyCode, branchId } : null),
    [branchId, customer.companyCode],
  );

  useEffect(() => {
    if (!scope) {
      setResult(null);
      return;
    }
    const controller = new AbortController();
    setBusy(true);
    setError('');
    void customerManagementApi
      .transactions(customer._id, scope, { type: filter, from: from || undefined, to: to || undefined, page, limit: 20 }, controller.signal)
      .then(setResult)
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : 'Không tải được lịch sử giao dịch.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [customer._id, filter, from, page, scope, to]);

  useEffect(() => {
    if (!scope || !selected) {
      setDetail(null);
      return;
    }
    let active = true;
    setDetail(null);
    setDetailBusy(true);
    void customerManagementApi
      .transactionDetail(customer._id, scope, selected)
      .then((value) => {
        if (active) setDetail(value);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Không tải được chi tiết giao dịch.');
      })
      .finally(() => {
        if (active) setDetailBusy(false);
      });
    return () => {
      active = false;
    };
  }, [customer._id, scope, selected]);

  if (!branchId) return <Text style={styles.infoBanner}>Chọn chi nhánh để xem lịch sử giao dịch.</Text>;

  const kindLabel: Record<CustomerTransactionRow['kind'], string> = {
    sale: 'Mua hàng',
    repair: 'Sửa chữa / dịch vụ',
    sale_refund: 'Hoàn tiền mua hàng',
    repair_refund: 'Hoàn tiền sửa chữa',
    buyback: 'Thu mua lại',
  };
  const statusText: Record<string, string> = {
    draft: 'Nháp',
    confirmed: 'Đã xác nhận',
    completed: 'Hoàn tất',
    cancelled: 'Đã hủy',
    received: 'Tiếp nhận',
    diagnosing: 'Kiểm tra',
    quoted: 'Báo giá',
    approved: 'Đã duyệt',
    repairing: 'Đang sửa',
    waiting_parts: 'Chờ vật tư',
    done: 'Hoàn tất',
    delivered: 'Đã bàn giao',
    posted: 'Đã ghi sổ',
  };

  return (
    <View style={styles.sectionStack}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Lọc giao dịch</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.chipList}>
          {[
            { key: 'all', label: 'Tất cả' },
            { key: 'sale', label: 'Mua hàng' },
            ...(result?.repairsVisible === false ? [] : [{ key: 'repair', label: 'Sửa chữa' }]),
            { key: 'refund', label: 'Hoàn tiền' },
            { key: 'buyback', label: 'Thu mua lại' },
          ].map((item) => (
            <Chip
              key={item.key}
              label={item.label}
              selected={filter === item.key}
              onPress={() => {
                setFilter(item.key);
                setPage(1);
              }}
            />
          ))}
        </ScrollView>
        <View style={styles.dateFilters}>
          <View style={{ flex: 1 }}>
            <DateTimeField label="Từ ngày" value={from} mode="date" allowClear onChange={(value) => { setFrom(value); setPage(1); }} />
          </View>
          <View style={{ flex: 1 }}>
            <DateTimeField label="Đến ngày" value={to} mode="date" allowClear onChange={(value) => { setTo(value); setPage(1); }} />
          </View>
        </View>
      </View>

      {result && (
        <View style={styles.summaryGrid}>
          <SummaryCard label="Đã ghi nhận" value={money(result.summary.charged)} accent="blue" />
          <SummaryCard label="Đã thu" value={money(result.summary.received)} accent="green" />
          <SummaryCard label="Đã hoàn" value={money(result.summary.refunded)} accent="amber" />
          <SummaryCard
            label="Còn phải thu"
            value={money(result.summary.outstanding)}
            accent={result.summary.outstanding > 0 ? 'red' : 'green'}
          />
        </View>
      )}

      {busy ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 18 }} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : result?.items.length ? (
        result.items.map((item) => {
          const isNegative = item.kind.endsWith('_refund') || item.kind === 'buyback';
          return (
            <Pressable
              key={item.id}
              onPress={() => {
                setSelected(item);
                setError('');
              }}
              style={styles.card}
            >
              <View style={styles.spaceBetween}>
                <Pill
                  label={kindLabel[item.kind]}
                  bg={isNegative ? '#FFF7ED' : '#EFF6FF'}
                  fg={isNegative ? '#C2410C' : colors.primary}
                />
                <Text style={[styles.primaryValue, isNegative && { color: '#C2410C' }]}>
                  {isNegative ? '−' : ''}
                  {money(item.amount)}
                </Text>
              </View>
              <Text numberOfLines={1} ellipsizeMode="middle" style={styles.cardTitle}>
                {item.code}
              </Text>
              <Text style={styles.body}>{item.description}</Text>
              <View style={styles.cardFooterRow}>
                <Text style={styles.muted}>
                  {dateLabel(item.occurredAt)} · {statusText[item.status] || item.status}
                </Text>
                <Text style={styles.linkText}>Chi tiết ›</Text>
              </View>
            </Pressable>
          );
        })
      ) : (
        !busy && <Text style={styles.empty}>Chưa có giao dịch phù hợp.</Text>
      )}

      {result && result.total > result.limit && (
        <View style={styles.inlinePagination}>
          <Action compact label="‹ Trước" disabled={page <= 1} onPress={() => setPage((value) => value - 1)} />
          <Text style={styles.pageLabel}>
            Trang {result.page} / {Math.ceil(result.total / result.limit)}
          </Text>
          <Action
            compact
            label="Sau ›"
            disabled={page * result.limit >= result.total}
            onPress={() => setPage((value) => value + 1)}
          />
        </View>
      )}

      <Modal visible={Boolean(selected)} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSelected(null)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chi tiết giao dịch</Text>
              <Pressable onPress={() => setSelected(null)} style={styles.modalCloseBtn}>
                <X size={18} color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
              {detailBusy ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
              ) : detail ? (
                <>
                  <View style={styles.subCard}>
                    <Text style={styles.cardTitle}>
                      {selected?.code} · {kindLabel[selected?.kind || 'sale']}
                    </Text>
                    <Text style={styles.body}>{detail.item.description}</Text>
                  </View>
                  {detail.device && (
                    <View style={styles.subCard}>
                      <Text style={styles.sectionTitle}>{detail.device.name}</Text>
                      <Text style={styles.muted}>IMEI / Serial: {detail.device.serialNumber || '—'}</Text>
                      <Text style={styles.muted}>
                        Tình trạng: {detail.device.condition || '—'} · Triệu chứng: {detail.device.symptom || '—'}
                      </Text>
                      <Text style={styles.muted}>Chẩn đoán: {detail.device.diagnosis || '—'}</Text>
                    </View>
                  )}
                  {detail.lines.length > 0 && (
                    <View style={styles.subCard}>
                      <Text style={styles.sectionTitle}>Sản phẩm / hạng mục</Text>
                      {detail.lines.map((line, index) => (
                        <View
                          key={`${line.sku || line.name}-${index}`}
                          style={[styles.lineRow, index === detail.lines.length - 1 && { borderBottomWidth: 0 }]}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.cardTitle}>{line.name}</Text>
                            <Text style={styles.muted}>
                              {line.sku || '—'} · SL {line.quantity}
                              {line.serials?.length ? ` · ${line.serials.join(', ')}` : ''}
                            </Text>
                          </View>
                          <Text style={styles.primaryValue}>{money(line.total)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {detail.payments.map((payment, index) => (
                    <Text key={`p-${index}`} style={styles.muted}>
                      Đã thu {money(payment.amount)} · {paymentMethodLabel(payment.method)} ·{' '}
                      {dateLabel(payment.at, true)}
                    </Text>
                  ))}
                  {detail.refunds.map((refund, index) => (
                    <Text key={`r-${index}`} style={styles.muted}>
                      Hoàn {money(refund.amount)} · {refund.reason || '—'} · {dateLabel(refund.at, true)}
                    </Text>
                  ))}
                  {detail.note ? <Text style={styles.body}>Ghi chú: {detail.note}</Text> : null}
                </>
              ) : (
                <Text style={styles.empty}>Không tải được chi tiết giao dịch.</Text>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function RepairsPanel({ customer, branchId, canRead }: { customer: Customer; branchId?: string; canRead: boolean }) {
  const [items, setItems] = useState<Awaited<ReturnType<typeof customerManagementApi.repairs>> | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!branchId || !canRead) return;
    const controller = new AbortController();
    setBusy(true);
    setError('');
    void customerManagementApi
      .repairs(customer._id, { companyCode: customer.companyCode, branchId }, page, controller.signal)
      .then(setItems)
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : 'Không tải được lịch sử sửa chữa.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [branchId, canRead, customer._id, customer.companyCode, page]);

  if (!canRead) return <Text style={styles.infoBanner}>Tài khoản chưa có quyền xem lịch sử sửa chữa.</Text>;
  if (!branchId) return <Text style={styles.infoBanner}>Chọn chi nhánh để xem lịch sử sửa chữa và bảo hành.</Text>;

  const states: Record<string, string> = {
    received: 'Tiếp nhận',
    diagnosing: 'Kiểm tra',
    quoted: 'Báo giá',
    approved: 'Đã duyệt',
    repairing: 'Đang thực hiện',
    waiting_parts: 'Chờ vật tư',
    waiting_supplier: 'Chờ nhà cung cấp',
    done: 'Hoàn tất',
    delivered: 'Đã bàn giao',
    cancelled: 'Đã hủy',
    returned: 'Đã trả lại',
  };

  return (
    <View style={styles.sectionStack}>
      <Text style={styles.sectionTitle}>Sửa chữa và bảo hành</Text>
      {busy ? (
        <ActivityIndicator color={colors.primary} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : items?.items.length ? (
        items.items.map((item) => (
          <View key={item._id} style={styles.card}>
            <View style={styles.spaceBetween}>
              <Text numberOfLines={1} ellipsizeMode="middle" style={[styles.cardTitle, { flex: 1 }]}>
                {item.ticketCode}
              </Text>
              <Pill
                label={item.ticketType === 'service' ? 'Dịch vụ' : 'Bảo hành'}
                bg={item.ticketType === 'service' ? '#EFF6FF' : '#ECFDF3'}
                fg={item.ticketType === 'service' ? colors.primary : '#027A48'}
              />
            </View>
            <Text style={styles.body}>{item.device?.name || 'Thiết bị'}</Text>
            <Text style={styles.muted}>
              {states[item.status] || item.status} · {dateLabel(item.receivedAt)} · Còn thu {money(item.dueAmount)}
            </Text>
          </View>
        ))
      ) : (
        !busy && <Text style={styles.empty}>Chưa có phiếu sửa chữa hoặc bảo hành tại chi nhánh này.</Text>
      )}
      {items && items.total > items.limit && (
        <View style={styles.inlinePagination}>
          <Action compact label="‹ Trước" disabled={page <= 1} onPress={() => setPage((value) => value - 1)} />
          <Text style={styles.pageLabel}>
            Trang {page} / {Math.ceil(items.total / items.limit)}
          </Text>
          <Action
            compact
            label="Sau ›"
            disabled={page * items.limit >= items.total}
            onPress={() => setPage((value) => value + 1)}
          />
        </View>
      )}
    </View>
  );
}

function ReceivablesPanel({ customer, branchId, canRead }: { customer: Customer; branchId?: string; canRead: boolean }) {
  const [account, setAccount] = useState<Awaited<ReturnType<typeof customerManagementApi.receivables>> | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!branchId || !canRead) return;
    let active = true;
    setBusy(true);
    setError('');
    void customerManagementApi
      .receivables({ companyCode: customer.companyCode, branchId }, customer._id)
      .then((value) => {
        if (active) setAccount(value);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Không tải được sổ công nợ.');
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [branchId, canRead, customer._id, customer.companyCode]);

  if (!canRead) return <Text style={styles.infoBanner}>Tài khoản chưa có quyền xem dữ liệu bán lẻ.</Text>;
  if (!branchId) return <Text style={styles.infoBanner}>Chọn chi nhánh để xem sổ công nợ.</Text>;
  if (busy) return <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />;
  if (error) return <Text style={styles.errorText}>{error}</Text>;

  const label: Record<string, string> = {
    charge: 'Ghi nợ',
    payment: 'Thu tiền',
    adjustment: 'Điều chỉnh',
    reversal: 'Đảo bút toán',
    refund: 'Hoàn tiền',
    write_off: 'Xóa nợ',
    due_date_extension: 'Gia hạn',
  };

  return (
    <View style={styles.sectionStack}>
      <SummaryCard
        label="Công nợ hiện tại"
        value={money(account?.currentBalance)}
        hint="Sổ công nợ bán lẻ của chi nhánh đang chọn"
        accent={(account?.currentBalance || 0) > 0 ? 'red' : 'green'}
      />
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Sổ công nợ ({account?.items.length || 0})</Text>
        {account?.items.length ? (
          account.items.map((entry, idx) => (
            <View
              key={entry._id}
              style={[styles.ledgerRow, idx === account.items.length - 1 && { borderBottomWidth: 0 }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{label[entry.type] || entry.type}</Text>
                <Text style={styles.muted}>
                  {dateLabel(entry.createdAt, true)} · {entry.reason || '—'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text
                  style={[
                    styles.primaryValue,
                    { color: entry.signedAmount > 0 ? '#B42318' : '#027A48' },
                  ]}
                >
                  {entry.signedAmount > 0 ? '+' : '−'}
                  {money(Math.abs(entry.signedAmount))}
                </Text>
                <Text style={styles.muted}>Số dư {money(entry.runningBalance)}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.empty}>Khách chưa có phát sinh công nợ tại chi nhánh này.</Text>
        )}
      </View>
    </View>
  );
}

function PointsPanel({
  customer,
  branchId,
  canRead,
  canManage,
}: {
  customer: Customer;
  branchId?: string;
  canRead: boolean;
  canManage: boolean;
}) {
  const [account, setAccount] = useState<Awaited<ReturnType<typeof customerManagementApi.points>> | null>(null);
  const [policy, setPolicy] = useState<CustomerPointPolicy | null>(null);
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    if (!branchId || !canRead) return;
    setLoading(true);
    setError('');
    try {
      const scope = { companyCode: customer.companyCode, branchId };
      const [nextPolicy, nextAccount] = await Promise.all([
        customerManagementApi.pointPolicy(scope),
        customerManagementApi.points(scope, customer._id),
      ]);
      setPolicy(nextPolicy);
      setAccount(nextAccount);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được thông tin điểm thưởng.');
    } finally {
      setLoading(false);
    }
  }, [branchId, canRead, customer._id, customer.companyCode]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    const amount = Number(points);
    if (!branchId || !Number.isSafeInteger(amount) || amount === 0 || !reason.trim()) {
      setError('Nhập số điểm nguyên khác 0 và lý do điều chỉnh.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const key = `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await customerManagementApi.adjustPoints(
        { companyCode: customer.companyCode, branchId },
        customer._id,
        amount,
        reason.trim(),
        key,
      );
      setPoints('');
      setReason('');
      setMessage('Đã ghi điều chỉnh điểm vào sổ khách hàng.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không điều chỉnh được điểm.');
    } finally {
      setBusy(false);
    }
  };

  if (!canRead) return <Text style={styles.infoBanner}>Tài khoản chưa có quyền xem dữ liệu bán lẻ.</Text>;
  if (!branchId) return <Text style={styles.infoBanner}>Chọn chi nhánh để xem điểm thưởng của khách.</Text>;
  if (loading && !account) return <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />;

  const types: Record<string, string> = {
    earn: 'Tích từ đơn',
    redeem: 'Đã sử dụng',
    refund_earn: 'Đảo điểm tích',
    refund_redeem: 'Hoàn điểm',
    adjust: 'Điều chỉnh',
  };

  return (
    <View style={styles.sectionStack}>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {message ? <Text style={styles.successText}>{message}</Text> : null}

      <View style={styles.loyaltyHero}>
        <Text style={styles.loyaltyLabel}>SỐ DƯ ĐIỂM HIỆN TẠI</Text>
        <Text style={styles.loyaltyBigVal}>{(account?.balance || 0).toLocaleString('vi-VN')} điểm</Text>
        <View style={styles.loyaltySubRow}>
          <Text style={styles.loyaltySubText}>
            Đã tích: {(account?.totalEarned || 0).toLocaleString('vi-VN')}
          </Text>
          <Text style={styles.loyaltySubText}>
            Đã dùng: {(account?.totalRedeemed || 0).toLocaleString('vi-VN')}
          </Text>
        </View>
      </View>

      {policy && (
        <View style={styles.card}>
          <View style={styles.spaceBetween}>
            <Text style={styles.sectionTitle}>Chính sách tích điểm</Text>
            <Pill
              label={policy.enabled ? 'Đang bật' : 'Tạm dừng'}
              bg={policy.enabled ? '#ECFDF3' : '#F1F5F9'}
              fg={policy.enabled ? '#027A48' : '#64748B'}
            />
          </View>
          <Text style={styles.body}>
            {policy.enabled
              ? `Mua ${money(policy.earnVndPerPoint)} được 1 điểm. 1 điểm quy đổi ${money(
                  policy.redeemVndPerPoint,
                )}, tối đa ${policy.maxRedeemPercent}% giá trị đơn.`
              : 'Chương trình tích điểm và cấn trừ đang tạm dừng.'}
          </Text>
        </View>
      )}

      {canManage && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Điều chỉnh điểm thủ công</Text>
          <View style={styles.dateFilters}>
            <View style={{ flex: 1 }}>
              <Field label="Số điểm (+/-)" value={points} onChangeText={setPoints} placeholder="VD: 50 hoặc -20" keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Lý do" value={reason} onChangeText={setReason} placeholder="Nhập lý do" maxLength={300} />
            </View>
          </View>
          <Action label={busy ? 'Đang ghi…' : 'Ghi điều chỉnh điểm'} onPress={() => void submit()} primary disabled={busy} />
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Lịch sử điểm ({account?.ledger.length || 0})</Text>
        {account?.ledger.length ? (
          account.ledger.map((item, idx) => (
            <View
              key={item._id}
              style={[styles.ledgerRow, idx === account.ledger.length - 1 && { borderBottomWidth: 0 }]}
            >
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Pill
                    label={types[item.type] || item.type}
                    bg={item.points >= 0 ? '#ECFDF3' : '#FEF3F2'}
                    fg={item.points >= 0 ? '#027A48' : '#B42318'}
                  />
                  <Text style={styles.muted}>{dateLabel(item.createdAt, true)}</Text>
                </View>
                <Text style={styles.muted}>{item.reason}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.primaryValue, { color: item.points >= 0 ? '#027A48' : '#B42318' }]}>
                  {item.points > 0 ? '+' : ''}
                  {item.points.toLocaleString('vi-VN')}
                </Text>
                <Text style={styles.muted}>Còn {item.balanceAfter.toLocaleString('vi-VN')}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.empty}>Khách chưa có phát sinh điểm.</Text>
        )}
      </View>
    </View>
  );
}

function BillingPanel({ customer, canManage }: { customer: Customer; canManage: boolean }) {
  const [items, setItems] = useState<BillingProfile[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<BillingProfileInput>(emptyBilling());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await customerManagementApi.billingProfiles(customer._id, customer.companyCode));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được hồ sơ VAT.');
    } finally {
      setLoading(false);
    }
  }, [customer._id, customer.companyCode]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await customerManagementApi.createBillingProfile(customer._id, customer.companyCode, form);
      setItems((current) => [result.profile, ...current]);
      setShowForm(false);
      setForm(emptyBilling());
      setMessage(result.warnings[0]?.message || 'Đã thêm hồ sơ VAT.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thêm được hồ sơ VAT.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.sectionStack}>
      <View style={styles.card}>
        <View style={styles.spaceBetween}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Hồ sơ xuất VAT</Text>
            <Text style={styles.muted}>Thông tin pháp nhân dùng khi lập hóa đơn.</Text>
          </View>
          {canManage && (
            <Action
              compact
              label="Thêm hồ sơ"
              icon={Plus}
              onPress={() => {
                setError('');
                setShowForm(true);
              }}
              primary
            />
          )}
        </View>
        {error && !showForm ? <Text style={styles.errorText}>{error}</Text> : null}
        {message ? <Text style={styles.successText}>{message}</Text> : null}
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
        ) : items.length ? (
          items.map((item) => (
            <View key={item._id} style={styles.subCard}>
              <View style={styles.spaceBetween}>
                <Text style={[styles.cardTitle, { flex: 1 }]}>{item.legalName}</Text>
                {item.isDefault && <Pill label="Mặc định" bg="#ECFDF3" fg="#027A48" />}
              </View>
              <InfoRow label="Mã số thuế" value={item.taxId} />
              <InfoRow label="Email hóa đơn" value={item.invoiceEmail} />
              <InfoRow label="Địa chỉ hóa đơn" value={item.address} />
              <InfoRow label="Người liên hệ" value={item.contactName} />
            </View>
          ))
        ) : (
          <Text style={styles.empty}>
            Chưa có hồ sơ xuất VAT.{canManage ? ' Nhấn "Thêm hồ sơ" để tạo mới.' : ''}
          </Text>
        )}
      </View>

      <Modal visible={showForm} transparent animationType="fade" onRequestClose={() => { if (!busy) setShowForm(false); }}>
        <Pressable style={styles.modalBackdrop} onPress={() => !busy && setShowForm(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Thêm hồ sơ xuất VAT</Text>
              <Pressable disabled={busy} onPress={() => setShowForm(false)} style={styles.modalCloseBtn}>
                <X size={18} color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Field
                label="Tên pháp nhân *"
                value={form.legalName}
                onChangeText={(value) => setForm((current) => ({ ...current, legalName: value }))}
              />
              <Field
                label="Mã số thuế *"
                value={form.taxId}
                onChangeText={(value) => setForm((current) => ({ ...current, taxId: value }))}
              />
              <Field
                label="Địa chỉ hóa đơn *"
                value={form.address}
                onChangeText={(value) => setForm((current) => ({ ...current, address: value }))}
              />
              <Field
                label="Email nhận hóa đơn *"
                value={form.invoiceEmail}
                onChangeText={(value) => setForm((current) => ({ ...current, invoiceEmail: value }))}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Field
                label="Người liên hệ"
                value={form.contactName || ''}
                onChangeText={(value) => setForm((current) => ({ ...current, contactName: value }))}
              />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </ScrollView>
            <View style={styles.modalFooter}>
              <View style={{ flex: 1 }}>
                <Action label="Hủy" disabled={busy} onPress={() => setShowForm(false)} />
              </View>
              <View style={{ flex: 1 }}>
                <Action label={busy ? 'Đang lưu…' : 'Lưu hồ sơ VAT'} onPress={() => void save()} primary disabled={busy} />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function CustomerSettings({
  companyCode,
  branchId,
  canManage,
  canRetailRead,
  canManagePoints,
}: {
  companyCode: string;
  branchId?: string;
  canManage: boolean;
  canRetailRead: boolean;
  canManagePoints: boolean;
}) {
  const [tiers, setTiers] = useState<CustomerTier[]>([]);
  const [policy, setPolicy] = useState<CustomerPointPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [policyBusy, setPolicyBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const jobs: Array<Promise<unknown>> = [customerManagementApi.settings(companyCode)];
    if (branchId && canRetailRead) jobs.push(customerManagementApi.pointPolicy({ companyCode, branchId }));
    void Promise.allSettled(jobs)
      .then((results) => {
        if (!active) return;
        const tierResult = results[0];
        if (tierResult.status === 'fulfilled') {
          const result = tierResult.value as { customerTiers: CustomerTier[] };
          setTiers(
            (result.customerTiers || []).map((tier) => ({
              ...tier,
              minGrossProfit: Number(tier.minGrossProfit ?? tier.minSpend ?? 0),
            })),
          );
        } else {
          setError(
            tierResult.reason instanceof Error ? tierResult.reason.message : 'Không tải được cấu hình phân hạng.',
          );
        }
        const policyResult = results[1];
        if (policyResult?.status === 'fulfilled') setPolicy(policyResult.value as CustomerPointPolicy);
        else if (policyResult?.status === 'rejected') {
          setError(
            (current) =>
              current ||
              (policyResult.reason instanceof Error ? policyResult.reason.message : 'Không tải được chính sách điểm.'),
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [branchId, canRetailRead, companyCode]);

  const save = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await customerManagementApi.updateSettings(companyCode, tiers);
      setMessage('Đã lưu cấu hình phân hạng khách hàng.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không lưu được cấu hình khách hàng.');
    } finally {
      setBusy(false);
    }
  };

  const savePolicy = async () => {
    if (!policy || !branchId || !canManagePoints) return;
    setPolicyBusy(true);
    setError('');
    setMessage('');
    try {
      setPolicy(await customerManagementApi.updatePointPolicy({ companyCode, branchId }, policy));
      setMessage('Đã lưu chính sách tích điểm.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không lưu được chính sách tích điểm.');
    } finally {
      setPolicyBusy(false);
    }
  };

  const updateTier = (index: number, field: keyof CustomerTier, value: string) =>
    setTiers((current) =>
      current.map((tier, itemIndex) => {
        if (itemIndex !== index) return tier;
        if (field === 'code') return { ...tier, code: value.toLowerCase().replace(/[^a-z0-9-]/g, '') };
        if (field === 'name') return { ...tier, name: value };
        return { ...tier, minGrossProfit: parseVndInput(value) };
      }),
    );

  if (loading) return <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />;

  return (
    <View style={styles.sectionStack}>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {message ? <Text style={styles.successText}>{message}</Text> : null}

      <View style={styles.card}>
        <View style={styles.spaceBetween}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Phân hạng khách hàng</Text>
            <Text style={styles.muted}>Xếp hạng tự động theo lãi gộp tích lũy.</Text>
          </View>
          {canManage && (
            <Action
              compact
              label="Thêm bậc"
              icon={Plus}
              onPress={() =>
                setTiers((current) => [
                  ...current,
                  { code: `tier-${current.length + 1}`, name: `Hạng mới ${current.length + 1}`, minGrossProfit: 0 },
                ])
              }
            />
          )}
        </View>
        {tiers.map((tier, index) => (
          <View key={`${tier.code}-${index}`} style={styles.tierBox}>
            <View style={styles.spaceBetween}>
              <Pill label={`Bậc ${index + 1}`} bg="#F3E8FF" fg="#7E22CE" />
              {canManage && index > 0 && (
                <Pressable
                  onPress={() => setTiers((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  style={styles.iconDangerBtn}
                >
                  <Trash2 size={15} color="#DC2626" />
                </Pressable>
              )}
            </View>
            <View style={styles.dateFilters}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Mã hạng"
                  value={tier.code}
                  onChangeText={(value) => updateTier(index, 'code', value)}
                  editable={canManage}
                  autoCapitalize="none"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label="Tên hạng"
                  value={tier.name}
                  onChangeText={(value) => updateTier(index, 'name', value)}
                  editable={canManage}
                />
              </View>
            </View>
            <Field
              label="Lãi gộp tối thiểu (VND)"
              value={formatVndInput(tier.minGrossProfit)}
              onChangeText={(value) => updateTier(index, 'minGrossProfit', value)}
              keyboardType="numeric"
              editable={canManage && index > 0}
            />
          </View>
        ))}
        {!tiers.length && <Text style={styles.empty}>Chưa có cấu hình phân hạng.</Text>}
        {canManage && <Action label={busy ? 'Đang lưu…' : 'Lưu cấu hình phân hạng'} onPress={() => void save()} primary disabled={busy} />}
      </View>

      <View style={styles.card}>
        <View style={styles.spaceBetween}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Chính sách điểm thưởng</Text>
            <Text style={styles.muted}>Áp dụng tích & tiêu điểm tại POS.</Text>
          </View>
          {policy && (
            <Switch
              disabled={!canManagePoints}
              value={policy.enabled}
              onValueChange={(v) => setPolicy((current) => current && { ...current, enabled: v })}
              trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
              thumbColor={policy.enabled ? colors.primary : '#F8FAFC'}
            />
          )}
        </View>
        {!canRetailRead ? (
          <Text style={styles.muted}>Tài khoản chưa có quyền xem chính sách điểm thưởng.</Text>
        ) : !branchId ? (
          <Text style={styles.muted}>Chọn chi nhánh ở góc trên để tải chính sách điểm thưởng.</Text>
        ) : policy ? (
          <>
            <View style={styles.dateFilters}>
              <View style={{ flex: 1 }}>
                <Field
                  label="VND tích 1 điểm"
                  value={formatVndInput(policy.earnVndPerPoint)}
                  onChangeText={(value) =>
                    setPolicy((current) => current && { ...current, earnVndPerPoint: parseVndInput(value) })
                  }
                  keyboardType="numeric"
                  editable={canManagePoints}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label="Giá trị 1 điểm (VND)"
                  value={formatVndInput(policy.redeemVndPerPoint)}
                  onChangeText={(value) =>
                    setPolicy((current) => current && { ...current, redeemVndPerPoint: parseVndInput(value) })
                  }
                  keyboardType="numeric"
                  editable={canManagePoints}
                />
              </View>
            </View>
            <Field
              label="Cấn trừ tối đa trên đơn (%)"
              value={String(policy.maxRedeemPercent)}
              onChangeText={(value) =>
                setPolicy((current) => current && { ...current, maxRedeemPercent: Number(value.replace(/[^\d.]/g, '')) || 0 })
              }
              keyboardType="decimal-pad"
              editable={canManagePoints}
            />
            {canManagePoints && (
              <Action
                label={policyBusy ? 'Đang lưu…' : 'Lưu chính sách điểm'}
                onPress={() => void savePolicy()}
                primary
                disabled={policyBusy}
              />
            )}
          </>
        ) : (
          <Text style={styles.muted}>Không có dữ liệu chính sách điểm.</Text>
        )}
      </View>
    </View>
  );
}

export function CustomerManagementScreen(_props: FeatureScreenProps) {
  const { user, activeBranchId, setActiveBranchId } = useAuth();
  const permissions = user?.permissions;
  const admin = user?.role === 'admin' || user?.role === 'superadmin';
  const canSwitchBranch = admin || !user?.branchId;
  const canRead = admin || hasPermission(permissions, ['customer:read', 'customer:manage']);
  const canManage = admin || hasPermission(permissions, ['customer:manage']);
  const canRetailRead = admin || hasPermission(permissions, ['retail:read', 'retail:manage']);
  const canManagePoints = admin || hasPermission(permissions, ['retail-points:manage']);
  const canRepairRead = admin || hasPermission(permissions, ['repair:read', 'repair:manage']);

  const [companyChoices, setCompanyChoices] = useState<Array<{ code: string; name: string }>>([]);
  const [companyOverride, setCompanyOverride] = useState(() => user?.companyCode?.trim().toUpperCase() || '');
  const [companyPicker, setCompanyPicker] = useState(false);
  const [companyLoading, setCompanyLoading] = useState(false);
  const companyCode = companyOverride || user?.companyCode?.trim().toUpperCase() || '';
  const branchId = activeBranchId || user?.branchId;
  const [branches, setBranches] = useState<ErpBranch[]>([]);
  const [branchPicker, setBranchPicker] = useState(false);
  const [tab, setTab] = useState<Tab>('list');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [status, setStatus] = useState<CustomerStatus>('active');
  const [type, setType] = useState<'' | CustomerType>('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftStatus, setDraftStatus] = useState<CustomerStatus>('active');
  const [draftType, setDraftType] = useState<'' | CustomerType>('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<CustomerPage>(emptyPage);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [formTarget, setFormTarget] = useState<Customer | 'new' | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [branchLoading, setBranchLoading] = useState(false);

  useEffect(() => {
    if (user?.role !== 'superadmin') return;
    let active = true;
    setCompanyLoading(true);
    void listWorkerCompanies()
      .then((items) => {
        if (!active) return;
        const valid = items.flatMap((item) =>
          item.code ? [{ code: item.code.trim().toUpperCase(), name: item.name || item.code }] : [],
        );
        setCompanyChoices(valid);
        setCompanyOverride((current) =>
          current && valid.some((item) => item.code === current) ? current : valid[0]?.code || '',
        );
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Không tải được danh sách công ty.');
      })
      .finally(() => {
        if (active) setCompanyLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user?.role]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!companyCode) return;
    const controller = new AbortController();
    setBranchLoading(true);
    void fetchCompanyBranches(controller.signal, companyCode)
      .then((items) => {
        if (controller.signal.aborted) return;
        setBranches(items);
        if (canSwitchBranch && items.length && (!branchId || !items.some((item) => item._id === branchId))) {
          setActiveBranchId(items[0]._id);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!controller.signal.aborted) setBranchLoading(false);
      });
    return () => controller.abort();
  }, [branchId, canSwitchBranch, companyCode, setActiveBranchId]);

  useEffect(() => {
    if (!companyCode || !canRead || selected || tab !== 'list') {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void customerManagementApi
      .list(
        companyCode,
        { q: debouncedQuery || undefined, status, type: type || undefined, page, limit: 20 },
        controller.signal,
      )
      .then((value) => {
        if (!controller.signal.aborted) setResult(value);
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : 'Không tải được danh sách khách hàng.');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      });
    return () => controller.abort();
  }, [canRead, companyCode, debouncedQuery, page, selected, status, tab, type]);

  const refresh = () => {
    setRefreshing(true);
    if (tab === 'settings') {
      setRefreshing(false);
      return;
    }
    setLoading(true);
    setError('');
    if (companyCode && !selected) {
      void customerManagementApi
        .list(companyCode, { q: debouncedQuery || undefined, status, type: type || undefined, page, limit: 20 })
        .then(setResult)
        .catch((cause) => setError(cause instanceof Error ? cause.message : 'Không làm mới được danh sách.'))
        .finally(() => {
          setLoading(false);
          setRefreshing(false);
        });
    }
  };

  const openCustomer = async (customer: Customer) => {
    if (!companyCode) return;
    setError('');
    setLoading(true);
    try {
      setSelected(await customerManagementApi.detail(customer._id, companyCode));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được hồ sơ khách hàng.');
    } finally {
      setLoading(false);
    }
  };

  const changeStatus = () => {
    if (!selected || !companyCode) return;
    const next: CustomerStatus = selected.status === 'active' ? 'inactive' : 'active';
    Alert.alert(
      next === 'active' ? 'Kích hoạt khách hàng?' : 'Ngừng hoạt động?',
      `${selected.name} sẽ được chuyển sang trạng thái ${statusLabel(next).toLocaleLowerCase('vi')}.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xác nhận',
          onPress: () => {
            setError('');
            void customerManagementApi
              .setStatus(selected._id, companyCode, next, selected.version)
              .then((value) => {
                setSelected(value);
                setResult((current) =>
                  current.items.some((item) => item._id === value._id)
                    ? status === next
                      ? { ...current, items: current.items.map((item) => (item._id === value._id ? value : item)) }
                      : {
                          ...current,
                          total: Math.max(0, current.total - 1),
                          items: current.items.filter((item) => item._id !== value._id),
                        }
                    : current,
                );
              })
              .catch((cause) => setError(cause instanceof Error ? cause.message : 'Không cập nhật được trạng thái.'));
          },
        },
      ],
    );
  };

  const afterSave = (customer: Customer, warning?: string) => {
    setFormTarget(null);
    setSelected(customer);
    setNotice(warning || '');
    setError('');
    setPage(1);
  };

  const openFilterModal = () => {
    setDraftStatus(status);
    setDraftType(type);
    setFilterOpen(true);
  };

  const applyFilters = () => {
    setStatus(draftStatus);
    setType(draftType);
    setPage(1);
    setFilterOpen(false);
  };

  const resetFilters = () => {
    setDraftStatus('active');
    setDraftType('');
    setStatus('active');
    setType('');
    setPage(1);
    setFilterOpen(false);
  };

  const activeFilterCount = (status !== 'active' ? 1 : 0) + (type !== '' ? 1 : 0);
  const totalPages = Math.max(1, Math.ceil(result.total / (result.limit || 20)));
  const branchName =
    branches.find((branch) => branch._id === branchId)?.name ||
    (branchId === user?.branchId ? user?.branchName : undefined) ||
    'Chọn chi nhánh';

  if (!companyCode) {
    return (
      <View style={styles.center}>
        <Users size={28} color={colors.muted} />
        <Text style={styles.sectionTitle}>Quản lý khách hàng</Text>
        <Text style={styles.muted}>Tài khoản chưa có mã công ty để tải hồ sơ khách hàng.</Text>
      </View>
    );
  }
  if (!canRead) {
    return (
      <View style={styles.center}>
        <Users size={28} color={colors.muted} />
        <Text style={styles.sectionTitle}>Không có quyền truy cập</Text>
        <Text style={styles.muted}>Cần quyền customer:read hoặc customer:manage.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Quản lý khách hàng',
          headerRight:
            canSwitchBranch && (branches.length > 0 || branchLoading)
              ? () => (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      if (branches.length) setBranchPicker(true);
                      else if (!branchLoading) {
                        void fetchCompanyBranches(undefined, companyCode)
                          .then((items) => {
                            setBranches(items);
                            setBranchPicker(true);
                          })
                          .catch((cause) =>
                            setError(cause instanceof Error ? cause.message : 'Không tải được chi nhánh.'),
                          );
                      }
                    }}
                    style={styles.headerBranchBtn}
                  >
                    <Text numberOfLines={1} style={styles.headerBranchText}>
                      {branchLoading ? 'Đang tải…' : branchName}
                    </Text>
                    <ChevronDown size={14} color={colors.primary} />
                  </Pressable>
                )
              : undefined,
        }}
      />

      {!selected && (
        <View style={styles.topSection}>
          <View style={styles.segmentedBar}>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === 'list' }}
              onPress={() => setTab('list')}
              style={[styles.segmentedTab, tab === 'list' && styles.segmentedTabActive]}
            >
              <Users size={15} color={tab === 'list' ? colors.primary : '#64748B'} />
              <Text style={[styles.segmentedTabText, tab === 'list' && styles.segmentedTabTextActive]}>
                Danh sách
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === 'settings' }}
              onPress={() => setTab('settings')}
              style={[styles.segmentedTab, tab === 'settings' && styles.segmentedTabActive]}
            >
              <Settings size={15} color={tab === 'settings' ? colors.primary : '#64748B'} />
              <Text style={[styles.segmentedTabText, tab === 'settings' && styles.segmentedTabTextActive]}>
                Cài đặt
              </Text>
            </Pressable>
          </View>

          {user?.role === 'superadmin' && companyChoices.length > 1 && (
            <Pressable onPress={() => setCompanyPicker(true)} style={styles.companyStrip}>
              <Building2 size={15} color={colors.primary} />
              <Text numberOfLines={1} style={styles.companyStripText}>
                {companyLoading
                  ? 'Đang tải công ty…'
                  : companyChoices.find((item) => item.code === companyCode)?.name || companyCode}
              </Text>
              <ChevronDown size={15} color={colors.primary} />
            </Pressable>
          )}
        </View>
      )}

      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
      {notice ? (
        <Pressable onPress={() => setNotice('')} style={{ paddingHorizontal: 14, marginBottom: 8 }}>
          <Text style={styles.infoBanner}>{notice} · Nhấn để đóng</Text>
        </Pressable>
      ) : null}

      {selected ? (
        <CustomerDetail
          customer={selected}
          branchId={branchId}
          canManage={canManage}
          canRetailRead={canRetailRead}
          canManagePoints={canManagePoints}
          canRepairRead={canRepairRead}
          onBack={() => {
            setSelected(null);
            setNotice('');
          }}
          onEdit={() => setFormTarget(selected)}
          onStatusChange={changeStatus}
        />
      ) : tab === 'settings' ? (
        <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <CustomerSettings
            companyCode={companyCode}
            branchId={branchId}
            canManage={canManage}
            canRetailRead={canRetailRead}
            canManagePoints={canManagePoints}
          />
        </ScrollView>
      ) : (
        <>
          <View style={styles.toolbarStack}>
            <View style={styles.searchBox}>
              <Search size={17} color={colors.muted} />
              <TextInput
                value={query}
                onChangeText={(value) => {
                  setQuery(value);
                  setPage(1);
                }}
                placeholder="Tìm mã, tên, số điện thoại hoặc email"
                placeholderTextColor={colors.muted}
                style={styles.searchInput}
                returnKeyType="search"
              />
              {!!query && (
                <Pressable
                  onPress={() => {
                    setQuery('');
                    setPage(1);
                  }}
                  style={styles.clearBtn}
                >
                  <X size={15} color={colors.muted} />
                </Pressable>
              )}
            </View>

            <View style={styles.toolbarActions}>
              <Pressable
                accessibilityRole="button"
                onPress={openFilterModal}
                style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive, { flex: 1 }]}
              >
                <SlidersHorizontal size={15} color={activeFilterCount > 0 ? '#FFFFFF' : colors.ink} />
                <Text style={[styles.filterBtnText, activeFilterCount > 0 && styles.filterBtnTextActive]}>
                  Bộ lọc{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                </Text>
              </Pressable>
              {canManage && (
                <View style={{ flex: 1 }}>
                  <Action label="Thêm khách hàng" icon={Plus} onPress={() => setFormTarget('new')} primary />
                </View>
              )}
            </View>

            {activeFilterCount > 0 && (
              <View style={styles.activeFilterBar}>
                <Text style={[styles.muted, { flex: 1, color: '#1E40AF', fontWeight: '600' }]}>
                  {statusLabel(status)}
                  {type ? ` · ${type === 'vat' ? 'Xuất VAT' : 'Khách thường'}` : ''}
                </Text>
                <Pressable onPress={resetFilters}>
                  <Text style={styles.linkText}>Xóa lọc</Text>
                </Pressable>
              </View>
            )}
          </View>

          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          >
            {loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 36 }} />
            ) : result.items.length ? (
              result.items.map((customer) => {
                const isBusiness = customer.customerKind === 'business';
                return (
                  <Pressable
                    key={customer._id}
                    onPress={() => void openCustomer(customer)}
                    style={styles.customerCard}
                  >
                    <View style={styles.customerTop}>
                      <View style={[styles.customerAvatar, isBusiness && { backgroundColor: '#FEF3C7' }]}>
                        {isBusiness ? (
                          <Building2 size={18} color="#D97706" />
                        ) : (
                          <UserRound size={18} color={colors.primary} />
                        )}
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={styles.cardTitle}>
                          {customer.name}
                        </Text>
                        <Text numberOfLines={1} style={styles.customerMeta}>
                          {customer.customerCode} · {customer.phone}
                        </Text>
                      </View>
                      <Pill
                        label={customer.status === 'active' ? 'Hoạt động' : 'Ngừng'}
                        bg={customer.status === 'active' ? '#ECFDF3' : '#F1F5F9'}
                        fg={customer.status === 'active' ? '#027A48' : '#64748B'}
                      />
                    </View>

                    <View style={styles.rowWrap}>
                      <Pill
                        label={
                          isBusiness
                            ? 'Doanh nghiệp'
                            : customer.customerKind === 'individual'
                              ? 'Cá nhân'
                              : 'Chưa phân loại'
                        }
                        bg="#F1F5F9"
                        fg="#475569"
                      />
                      <Pill
                        label={customer.type === 'vat' ? 'Xuất VAT' : 'Khách thường'}
                        bg={customer.type === 'vat' ? '#EFF6FF' : '#F1F5F9'}
                        fg={customer.type === 'vat' ? colors.primary : '#475569'}
                      />
                      {customer.tier && <Pill label={customer.tier.name} bg="#F3E8FF" fg="#7E22CE" />}
                    </View>

                    <View style={styles.cardFooterRow}>
                      <Text numberOfLines={1} style={[styles.muted, { flex: 1 }]}>
                        {customer.email || customer.address || 'Chưa cập nhật email / địa chỉ'}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                        <Text style={styles.linkText}>Hồ sơ</Text>
                        <ChevronRight size={14} color={colors.primary} />
                      </View>
                    </View>
                  </Pressable>
                );
              })
            ) : (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconCircle}>
                  <Users size={26} color={colors.primary} />
                </View>
                <Text style={styles.emptyTitle}>Chưa có khách hàng phù hợp</Text>
                <Text style={styles.empty}>Thử thay đổi từ khóa tìm kiếm hoặc điều kiện bộ lọc.</Text>
              </View>
            )}
          </ScrollView>

          {!loading && (
            <View style={styles.pagination}>
              <Text style={styles.pageMeta}>{result.total.toLocaleString('vi-VN')} khách</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Action compact label="‹ Trước" disabled={page <= 1} onPress={() => setPage((current) => current - 1)} />
                <Text style={styles.pageLabel}>
                  {page} / {totalPages}
                </Text>
                <Action
                  compact
                  label="Sau ›"
                  disabled={page * result.limit >= result.total}
                  onPress={() => setPage((current) => current + 1)}
                />
              </View>
            </View>
          )}
        </>
      )}

      {formTarget && (
        <CustomerFormModal
          key={formTarget === 'new' ? 'new' : formTarget._id}
          target={formTarget}
          companyCode={companyCode}
          onClose={() => setFormTarget(null)}
          onSaved={afterSave}
        />
      )}

      <Modal visible={filterOpen} transparent animationType="fade" onRequestClose={() => setFilterOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setFilterOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Bộ lọc khách hàng</Text>
              <Pressable onPress={() => setFilterOpen(false)} style={styles.modalCloseBtn}>
                <X size={18} color={colors.muted} />
              </Pressable>
            </View>
            <View style={styles.modalBody}>
              <SelectChips
                label="Trạng thái hoạt động"
                value={draftStatus}
                options={[
                  { value: 'active', label: 'Đang hoạt động' },
                  { value: 'inactive', label: 'Ngừng hoạt động' },
                ]}
                onChange={setDraftStatus}
              />
              <SelectChips
                label="Chế độ hóa đơn"
                value={draftType || 'all'}
                options={[
                  { value: 'all', label: 'Mọi loại' },
                  { value: 'regular', label: 'Khách thường' },
                  { value: 'vat', label: 'Xuất VAT' },
                ]}
                onChange={(val) => setDraftType(val === 'all' ? '' : (val as CustomerType))}
              />
            </View>
            <View style={styles.modalFooter}>
              <View style={{ flex: 1 }}>
                <Action label="Đặt lại" onPress={resetFilters} />
              </View>
              <View style={{ flex: 1 }}>
                <Action label="Áp dụng" onPress={applyFilters} primary />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={branchPicker} transparent animationType="fade" onRequestClose={() => setBranchPicker(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setBranchPicker(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn chi nhánh</Text>
              <Pressable onPress={() => setBranchPicker(false)} style={styles.modalCloseBtn}>
                <X size={18} color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              {branches.map((branch) => {
                const isSelected = branch._id === branchId;
                return (
                  <Pressable
                    key={branch._id}
                    onPress={() => {
                      setActiveBranchId(branch._id);
                      setBranchPicker(false);
                    }}
                    style={[styles.pickerRow, isSelected && styles.pickerRowSelected]}
                  >
                    <Text style={[styles.pickerRowText, isSelected && styles.pickerRowTextSelected]}>
                      {branch.name}
                    </Text>
                    {isSelected && <Check size={17} color={colors.primary} />}
                  </Pressable>
                );
              })}
              {!branches.length && <Text style={styles.empty}>Chưa có chi nhánh khả dụng.</Text>}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={companyPicker} transparent animationType="fade" onRequestClose={() => setCompanyPicker(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setCompanyPicker(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn công ty</Text>
              <Pressable onPress={() => setCompanyPicker(false)} style={styles.modalCloseBtn}>
                <X size={18} color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              {companyChoices.map((company) => {
                const isSelected = company.code === companyCode;
                return (
                  <Pressable
                    key={company.code}
                    onPress={() => {
                      setCompanyOverride(company.code);
                      setActiveBranchId(undefined);
                      setBranches([]);
                      setPage(1);
                      setResult(emptyPage);
                      setSelected(null);
                      setCompanyPicker(false);
                    }}
                    style={[styles.pickerRow, isSelected && styles.pickerRowSelected]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.pickerRowText, isSelected && styles.pickerRowTextSelected]}>
                        {company.name}
                      </Text>
                      <Text style={styles.muted}>{company.code}</Text>
                    </View>
                    {isSelected && <Check size={17} color={colors.primary} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  flex: { flex: 1 },
  content: { padding: 14, gap: 12, paddingBottom: 32 },
  headerBranchBtn: {
    maxWidth: 155,
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  headerBranchText: { flexShrink: 1, color: colors.primary, fontSize: 12, fontWeight: '700' },
  topSection: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8, gap: 8 },
  segmentedBar: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 14, backgroundColor: '#E2E8F0' },
  segmentedTab: {
    flex: 1,
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
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
  segmentedTabText: { color: '#475569', fontSize: 13, fontWeight: '700' },
  segmentedTabTextActive: { color: colors.primary, fontWeight: '800' },
  companyStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  companyStripText: { flex: 1, color: colors.ink, fontSize: 13, fontWeight: '700' },
  tabsScroll: { flexGrow: 0, flexShrink: 0 },
  workspaceTabs: { alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8 },
  toolbarStack: { paddingHorizontal: 14, paddingBottom: 6, gap: 8 },
  toolbarActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchBox: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 12,
    backgroundColor: colors.white,
  },
  searchInput: { flex: 1, minWidth: 0, color: colors.ink, fontSize: 14, paddingVertical: 8 },
  clearBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  filterBtn: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  filterBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterBtnText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  filterBtnTextActive: { color: '#FFFFFF' },
  activeFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 36,
    paddingHorizontal: 13,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: colors.white,
  },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipText: { color: '#475569', fontSize: 12.5, fontWeight: '700' },
  chipTextSelected: { color: colors.white },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipList: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  action: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
  },
  actionCompact: { minHeight: 36, paddingHorizontal: 10, borderRadius: 10 },
  actionPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  actionDanger: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
  actionText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  actionTextPrimary: { color: colors.white },
  disabled: { opacity: 0.45 },
  pill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  pillText: { fontSize: 11, fontWeight: '800' },
  customerCard: {
    gap: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    backgroundColor: colors.white,
    shadowColor: '#0F172A',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  customerTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  customerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
  },
  customerAvatarLg: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
  },
  customerName: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  customerMeta: { marginTop: 2, color: '#64748B', fontSize: 12.5, fontWeight: '600' },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  linkText: { color: colors.primary, fontSize: 12.5, fontWeight: '800' },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: colors.white,
  },
  inlinePagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  pageMeta: { color: '#64748B', fontSize: 12.5, fontWeight: '700' },
  pageLabel: { color: colors.ink, fontSize: 13, fontWeight: '800', minWidth: 44, textAlign: 'center' },
  emptyState: { alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 36, paddingHorizontal: 20 },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  empty: { color: '#64748B', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 9, padding: 24, backgroundColor: '#F8FAFC' },
  errorBanner: {
    marginHorizontal: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    color: '#B42318',
    padding: 12,
    fontSize: 12.5,
    fontWeight: '600',
  },
  infoBanner: {
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    color: '#1E40AF',
    padding: 12,
    fontSize: 12.5,
    lineHeight: 18,
  },
  successText: {
    borderWidth: 1,
    borderColor: '#A6F4C5',
    borderRadius: 12,
    backgroundColor: '#ECFDF3',
    color: '#027A48',
    padding: 11,
    fontSize: 12.5,
    fontWeight: '600',
  },
  errorText: {
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    color: '#B42318',
    padding: 11,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '600',
  },
  detailHero: {
    gap: 12,
    padding: 15,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  backPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#EFF6FF',
  },
  backPillText: { color: colors.primary, fontSize: 12.5, fontWeight: '800' },
  customerHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  detailActionRow: { flexDirection: 'row', gap: 8, paddingTop: 4 },
  sectionStack: { gap: 12, paddingBottom: 16 },
  sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  dateFilters: { flexDirection: 'row', gap: 10 },
  summaryCard: {
    width: '48.5%',
    gap: 4,
    padding: 12,
    borderWidth: 1,
    borderRadius: 14,
  },
  summaryLabel: { color: '#475569', fontSize: 11.5, fontWeight: '700' },
  summaryValue: { fontSize: 15.5, fontWeight: '900' },
  muted: { color: '#64748B', fontSize: 12, lineHeight: 17 },
  body: { color: colors.ink, fontSize: 13.5, lineHeight: 19 },
  card: {
    gap: 10,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    backgroundColor: colors.white,
    shadowColor: '#0F172A',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  subCard: {
    gap: 5,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  primaryValue: { color: colors.primary, fontSize: 14, fontWeight: '900' },
  infoRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
  },
  infoIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: { color: '#64748B', fontSize: 11.5, fontWeight: '600' },
  infoValue: { color: colors.ink, fontSize: 13.5, fontWeight: '700', marginTop: 1 },
  notesBox: { gap: 4, padding: 12, borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  spaceBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  loyaltyHero: { gap: 4, padding: 18, borderRadius: 16, backgroundColor: colors.primary },
  loyaltyLabel: { color: '#BFDBFE', fontSize: 10.5, fontWeight: '800', letterSpacing: 0.7 },
  loyaltyBigVal: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', marginTop: 2 },
  loyaltySubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.22)',
  },
  loyaltySubText: { color: '#DBEAFE', fontSize: 12.5, fontWeight: '700' },
  field: { gap: 6 },
  fieldLabel: { color: '#334155', fontSize: 12, fontWeight: '700' },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    color: colors.ink,
    fontSize: 14,
  },
  inputDisabled: { backgroundColor: '#F1F5F9', color: colors.muted },
  multiline: { minHeight: 86, paddingTop: 10 },
  subForm: {
    gap: 10,
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  tierBox: {
    gap: 10,
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  iconDangerBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(15,23,42,0.48)',
  },
  modalSheet: {
    maxHeight: '88%',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.white,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: colors.white,
  },
  modalTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  modalBody: { padding: 16, gap: 12 },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: colors.white,
  },
  pickerRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  pickerRowSelected: { backgroundColor: '#EFF6FF' },
  pickerRowText: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  pickerRowTextSelected: { color: colors.primary, fontWeight: '800' },
});
