import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import {
  BarChart3,
  Check,
  ChevronDown,
  MapPinned,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Wrench,
  X,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { FullScreenFormModal } from '@/components/FullScreenFormModal';
import { useAuth } from '@/core/auth/AuthProvider';
import { fetchCompanyBranches, type ErpBranch } from '@/features/overview/overviewApi';
import { DateTimeField } from '@/features/quotation/DateTimeField';
import {
  repairApi,
  type PhoneWarrantyLookupResult,
  type RepairRevenueReport,
  type RepairScope,
  type RepairStatus,
  type RepairTechnician,
  type RepairTicket,
  type WarrantyLookupResult,
} from '@/features/repairApi';
import { colors } from '@/theme/colors';

type ModuleTab = 'warranty' | 'tickets' | 'reports';
type TicketFilter = 'all' | 'active' | 'delivered';
type ReportGroup = 'branch' | 'technician' | 'day';

const statusLabels: Record<RepairStatus, string> = {
  received: 'Tiếp nhận',
  diagnosing: 'Kiểm tra',
  quoted: 'Báo giá',
  approved: 'Đã duyệt',
  repairing: 'Đang sửa',
  waiting_parts: 'Chờ vật tư',
  waiting_supplier: 'Chờ nhà cung cấp',
  done: 'Hoàn tất',
  delivered: 'Đã giao',
  cancelled: 'Đã hủy',
  returned: 'Đã trả',
};

const activeStatuses: RepairStatus[] = [
  'received',
  'diagnosing',
  'quoted',
  'approved',
  'repairing',
  'waiting_parts',
  'waiting_supplier',
  'done',
];

const allStatuses: RepairStatus[] = [
  'received',
  'diagnosing',
  'quoted',
  'approved',
  'repairing',
  'waiting_parts',
  'waiting_supplier',
  'done',
  'delivered',
  'returned',
  'cancelled',
];

const allowedTransitions: Record<RepairStatus, RepairStatus[]> = {
  received: ['diagnosing', 'returned', 'cancelled'],
  diagnosing: ['quoted', 'repairing', 'returned', 'cancelled'],
  quoted: ['approved', 'cancelled'],
  approved: ['repairing', 'cancelled'],
  repairing: ['waiting_parts', 'waiting_supplier', 'done', 'returned'],
  waiting_parts: ['repairing', 'cancelled'],
  waiting_supplier: ['repairing', 'returned'],
  done: ['delivered', 'repairing'],
  delivered: [],
  cancelled: [],
  returned: [],
};

const money = (value?: number) => `${Math.round(Number(value || 0)).toLocaleString('vi-VN')} VND`;
const formatDate = (value?: string) => (value ? new Date(value).toLocaleDateString('vi-VN') : '—');
const monthRange = () => {
  const now = new Date();
  const day = (value: Date) =>
    `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  return { from: day(new Date(now.getFullYear(), now.getMonth(), 1)), to: day(now) };
};

function statusTone(status: RepairStatus): { bg: string; fg: string } {
  if (status === 'done' || status === 'delivered') return { bg: '#E9F8F1', fg: '#16885A' };
  if (status === 'cancelled' || status === 'returned') return { bg: '#FCEBEC', fg: '#C74848' };
  if (status === 'waiting_parts' || status === 'waiting_supplier' || status === 'quoted') {
    return { bg: '#FFF3E5', fg: '#C27617' };
  }
  return { bg: '#EAF2FF', fg: colors.primary };
}

export function RepairModuleScreen() {
  const { user, activeBranchId, setActiveBranchId } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const canRead =
    isAdmin || Boolean(user?.permissions?.some((item) => ['*', 'repair:read', 'repair:manage'].includes(item)));
  const canManage =
    isAdmin || Boolean(user?.permissions?.some((item) => ['*', 'repair:manage'].includes(item)));
  const canSwitchBranch = isAdmin || !user?.branchId;
  const [branches, setBranches] = useState<ErpBranch[]>([]);
  const [branchPicker, setBranchPicker] = useState(false);
  const [tab, setTab] = useState<ModuleTab>('warranty');

  useEffect(() => {
    if (!user?.companyCode || (!canSwitchBranch && user.branchId)) {
      if (user?.branchId) setActiveBranchId(user.branchId);
      return;
    }
    const controller = new AbortController();
    void fetchCompanyBranches(controller.signal, user.companyCode)
      .then((list) => {
        if (controller.signal.aborted) return;
        setBranches(list);
        setActiveBranchId((current) =>
          current && list.some((branch) => branch._id === current)
            ? current
            : user.branchId && list.some((branch) => branch._id === user.branchId)
              ? user.branchId
              : list[0]?._id ?? '',
        );
      })
      .catch(() => {});
    return () => controller.abort();
  }, [canSwitchBranch, setActiveBranchId, user?.branchId, user?.companyCode]);

  const branchId = activeBranchId || user?.branchId || '';
  const scope = useMemo<RepairScope>(
    () => ({ companyCode: user?.companyCode, branchId: branchId || undefined }),
    [branchId, user?.companyCode],
  );
  const branchName =
    branches.find((branch) => branch._id === branchId)?.name ||
    (branchId === user?.branchId ? user?.branchName : undefined) ||
    'Chọn chi nhánh';

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: 'Sửa chữa & bảo hành',
          headerRight:
            branches.length > 0 && canSwitchBranch
              ? () => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Chi nhánh: ${branchName}`}
                    onPress={() => setBranchPicker(true)}
                    style={styles.branchButton}
                  >
                    <Text numberOfLines={1} style={styles.branchButtonText}>
                      {branchName}
                    </Text>
                    <ChevronDown size={14} color={colors.primary} />
                  </Pressable>
                )
              : undefined,
        }}
      />

      {!canRead ? (
        <View style={styles.stateBox}>
          <Wrench size={28} color={colors.muted} />
          <Text style={styles.stateTitle}>Chưa có quyền truy cập</Text>
          <Text style={styles.stateCopy}>
            Tài khoản cần quyền repair:read hoặc repair:manage để xem thông tin sửa chữa và bảo hành.
          </Text>
        </View>
      ) : !user?.companyCode || !branchId ? (
        <View style={styles.stateBox}>
          <MapPinned size={28} color={colors.muted} />
          <Text style={styles.stateTitle}>Chọn chi nhánh</Text>
          <Text style={styles.stateCopy}>
            Phân hệ sửa chữa yêu cầu chọn chi nhánh để tải dữ liệu.
          </Text>
        </View>
      ) : (
        <>
          <ScrollView
            horizontal
            style={styles.navScroll}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.navContent}
          >
            <TabButton
              selected={tab === 'warranty'}
              label="Tra cứu bảo hành"
              icon={ShieldCheck}
              onPress={() => setTab('warranty')}
            />
            <TabButton
              selected={tab === 'tickets'}
              label="Phiếu sửa chữa"
              icon={Wrench}
              onPress={() => setTab('tickets')}
            />
            <TabButton
              selected={tab === 'reports'}
              label="Báo cáo"
              icon={BarChart3}
              onPress={() => setTab('reports')}
            />
          </ScrollView>

          <View style={styles.panel}>
            {tab === 'warranty' ? (
              <WarrantyPanel
                scope={scope}
                canManage={canManage}
                onCreated={() => setTab('tickets')}
              />
            ) : tab === 'tickets' ? (
              <TicketsPanel scope={scope} canManage={canManage} />
            ) : (
              <ReportsPanel scope={scope} />
            )}
          </View>
        </>
      )}

      <Modal
        visible={branchPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setBranchPicker(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setBranchPicker(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn chi nhánh</Text>
              <Pressable onPress={() => setBranchPicker(false)} style={styles.closeIconBtn}>
                <X size={17} color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 360 }}>
              {branches.map((branch) => {
                const selected = branch._id === branchId;
                return (
                  <Pressable
                    key={branch._id}
                    onPress={() => {
                      setActiveBranchId(branch._id);
                      setBranchPicker(false);
                    }}
                    style={[styles.branchOption, selected && styles.branchOptionActive]}
                  >
                    <Text
                      style={[styles.branchOptionText, selected && styles.branchOptionTextActive]}
                    >
                      {branch.name}
                    </Text>
                    {selected ? <Check size={16} color={colors.primary} /> : null}
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

function TabButton({
  selected,
  label,
  icon: Icon,
  onPress,
}: {
  selected: boolean;
  label: string;
  icon: LucideIcon;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.navChip, selected && styles.navChipActive]}
    >
      <Icon size={14} color={selected ? colors.white : colors.muted} />
      <Text style={[styles.navText, selected && styles.navTextActive]}>{label}</Text>
    </Pressable>
  );
}

function WarrantyPanel({
  scope,
  canManage,
  onCreated,
}: {
  scope: RepairScope;
  canManage: boolean;
  onCreated: () => void;
}) {
  const [mode, setMode] = useState<'serial' | 'phone'>('serial');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [serialResult, setSerialResult] = useState<WarrantyLookupResult | null>(null);
  const [phoneResult, setPhoneResult] = useState<PhoneWarrantyLookupResult | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<WarrantyLookupResult | null>(null);
  const [createTarget, setCreateTarget] = useState<WarrantyLookupResult | null>(null);

  const resetResults = () => {
    setSerialResult(null);
    setPhoneResult(null);
    setSelectedDevice(null);
    setError('');
  };

  const lookup = async (customerId?: string) => {
    const value = query.trim();
    if (!value) return;
    setBusy(true);
    resetResults();
    try {
      if (mode === 'serial') setSerialResult(await repairApi.lookupBySerial(scope, value));
      else {
        const result = await repairApi.lookupByPhone(scope, value, customerId);
        setPhoneResult(result);
        if (result.devices.length === 1) setSelectedDevice(result.devices[0]);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể tra cứu bảo hành.');
    } finally {
      setBusy(false);
    }
  };

  const result = selectedDevice || serialResult;

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.sectionCard}>
        <View style={styles.segmentedRow}>
          <ModeButton
            label="IMEI / Serial"
            selected={mode === 'serial'}
            onPress={() => {
              setMode('serial');
              resetResults();
            }}
          />
          <ModeButton
            label="Số điện thoại"
            selected={mode === 'phone'}
            onPress={() => {
              setMode('phone');
              resetResults();
            }}
          />
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Search size={15} color={colors.muted} />
            <TextInput
              accessibilityLabel={mode === 'serial' ? 'IMEI hoặc Serial' : 'Số điện thoại khách hàng'}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => void lookup()}
              placeholder={mode === 'serial' ? 'Nhập IMEI hoặc Serial thiết bị…' : 'Nhập số điện thoại khách hàng…'}
              placeholderTextColor={colors.muted}
              keyboardType={mode === 'phone' ? 'phone-pad' : 'default'}
              autoCapitalize="characters"
              returnKeyType="search"
              style={styles.searchInput}
            />
            {query ? (
              <Pressable onPress={() => { setQuery(''); resetResults(); }}>
                <X size={15} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => void lookup()}
            disabled={busy || !query.trim()}
            style={[styles.searchButton, (busy || !query.trim()) && styles.disabled]}
          >
            {busy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.searchButtonText}>Tra cứu</Text>}
          </Pressable>
        </View>

        <Text style={styles.helperCopy}>
          Tra cứu thời hạn bảo hành cửa hàng và nhà cung cấp theo thiết bị hoặc số điện thoại khách hàng.
        </Text>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text accessibilityRole="alert" style={styles.errorText}>
            {error}
          </Text>
        </View>
      ) : null}

      {phoneResult?.candidates?.map((candidate) => (
        <Pressable
          key={candidate.customerId}
          onPress={() => void lookup(candidate.customerId)}
          style={styles.card}
        >
          <Text style={styles.cardTitle}>{candidate.name}</Text>
          <Text style={styles.mutedText}>{candidate.customerCode} · Chạm để chọn hồ sơ khách hàng</Text>
        </Pressable>
      ))}

      {phoneResult && !phoneResult.candidates?.length && !phoneResult.found ? (
        <EmptyState text="Không tìm thấy thiết bị đã bán gắn với thông tin này." />
      ) : null}

      {phoneResult?.devices.map((device, index) => {
        const covered = Boolean(device.customerWarranty?.covered || device.supplierWarranty?.covered);
        const active = selectedDevice === device;
        return (
          <Pressable
            key={`${device.serialNumber || device.internalBarcode || index}`}
            onPress={() => setSelectedDevice(device)}
            style={[styles.card, active && styles.cardActive]}
          >
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{device.product?.name || 'Thiết bị'}</Text>
                <Text style={styles.mutedText}>
                  Serial: {device.serialNumber || device.internalBarcode || '—'}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: covered ? '#E9F8F1' : '#FFF3E5' }]}>
                <Text style={[styles.badgeText, { color: covered ? '#16885A' : '#C27617' }]}>
                  {covered ? 'Còn hạn' : 'Hết hạn'}
                </Text>
              </View>
            </View>
            {canManage ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setCreateTarget(device)}
                style={styles.createFromWarrantyBtn}
              >
                <Plus size={15} color={colors.white} />
                <Text style={styles.primaryButtonText}>Tạo phiếu sửa chữa</Text>
              </Pressable>
            ) : null}
          </Pressable>
        );
      })}

      {serialResult && !serialResult.found ? (
        <EmptyState text="Không tìm thấy thông tin bảo hành cho IMEI/Serial này." />
      ) : null}

      {result && (selectedDevice || serialResult?.found) ? (
        <WarrantyCard
          result={result}
          canManage={canManage}
          onCreateTicket={() => setCreateTarget(result)}
        />
      ) : null}

      {phoneResult?.found && !phoneResult.devices.length ? (
        <EmptyState text="Khách hàng chưa có thiết bị đủ thông tin bảo hành." />
      ) : null}

      <CreateRepairTicketModal
        device={createTarget}
        fallbackCustomer={phoneResult?.customer}
        scope={scope}
        onClose={() => setCreateTarget(null)}
        onCreated={() => {
          setCreateTarget(null);
          onCreated();
        }}
      />
    </ScrollView>
  );
}

function WarrantyCard({
  result,
  canManage,
  onCreateTicket,
}: {
  result: WarrantyLookupResult;
  canManage: boolean;
  onCreateTicket: () => void;
}) {
  const customerCovered = Boolean(result.customerWarranty?.covered);
  const supplierCovered = Boolean(result.supplierWarranty?.covered);
  const anyCovered = customerCovered || supplierCovered;

  return (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{result.product?.name || 'Thiết bị'}</Text>
          <Text style={styles.mutedText}>
            Serial: {result.serialNumber || result.internalBarcode || '—'}
            {result.product?.sku ? ` · SKU ${result.product.sku}` : ''}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: anyCovered ? '#E9F8F1' : '#FFF3E5' }]}>
          <Text style={[styles.badgeText, { color: anyCovered ? '#16885A' : '#C27617' }]}>
            {anyCovered ? 'Còn bảo hành' : 'Hết bảo hành'}
          </Text>
        </View>
      </View>

      <View style={styles.infoGrid}>
        <InfoCell
          label="Khách hàng"
          value={
            result.sold?.customerName
              ? `${result.sold.customerName}${result.sold.customerPhone ? ` · ${result.sold.customerPhone}` : ''}`
              : '—'
          }
        />
        <InfoCell label="Ngày bán" value={formatDate(result.sold?.at)} />
        <InfoCell
          label="Bảo hành cửa hàng"
          value={customerCovered ? `Còn ${result.customerWarranty?.daysLeft || 0} ngày` : 'Hết hạn'}
          valueColor={customerCovered ? '#16885A' : '#C27617'}
        />
        <InfoCell
          label="Bảo hành nhà cung cấp"
          value={supplierCovered ? `Còn ${result.supplierWarranty?.daysLeft || 0} ngày` : 'Hết hạn'}
          valueColor={supplierCovered ? '#16885A' : '#C27617'}
        />
      </View>

      <View style={styles.footerMetaRow}>
        <Text style={styles.mutedText}>Bên chịu phí</Text>
        <Text style={styles.detailStrong}>
          {result.costBearer === 'supplier'
            ? 'Nhà cung cấp'
            : result.costBearer === 'shop'
              ? 'Cửa hàng'
              : 'Khách hàng'}
        </Text>
      </View>

      {canManage ? (
        <Pressable
          accessibilityRole="button"
          onPress={onCreateTicket}
          style={styles.createFromWarrantyBtn}
        >
          <Plus size={15} color={colors.white} />
          <Text style={styles.primaryButtonText}>Tạo phiếu sửa chữa</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function CreateRepairTicketModal({
  device,
  fallbackCustomer,
  scope,
  onClose,
  onCreated,
}: {
  device: WarrantyLookupResult | null;
  fallbackCustomer?: PhoneWarrantyLookupResult['customer'];
  scope: RepairScope;
  onClose: () => void;
  onCreated: () => void;
}) {
  const customerCovered = Boolean(device?.customerWarranty?.covered);
  const [ticketType, setTicketType] = useState<'warranty' | 'service'>('service');
  const [condition, setCondition] = useState('');
  const [accessories, setAccessories] = useState('');
  const [symptom, setSymptom] = useState('');
  const [promisedDate, setPromisedDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!device) return;
    setTicketType(device.customerWarranty?.covered ? 'warranty' : 'service');
    setCondition('');
    setAccessories('');
    setSymptom('');
    setPromisedDate('');
  }, [device]);

  if (!device) return null;

  const customerId =
    device.sold?.customerId ||
    device.sold?.customerCode ||
    fallbackCustomer?.customerId ||
    fallbackCustomer?.customerCode ||
    '';
  const customerLabel =
    device.sold?.customerName ||
    fallbackCustomer?.name ||
    'Chưa xác định khách hàng';
  const customerPhone = device.sold?.customerPhone || fallbackCustomer?.phone || '';
  const serial = device.serialNumber || device.internalBarcode || '';

  const submit = async () => {
    if (!customerId) {
      Alert.alert('Thiếu thông tin khách hàng', 'Thiết bị này chưa gắn hồ sơ khách hàng để lập phiếu.');
      return;
    }
    if (!condition.trim()) {
      Alert.alert('Thiếu tình trạng máy', 'Vui lòng nhập tình trạng thiết bị khi tiếp nhận.');
      return;
    }
    if (!symptom.trim()) {
      Alert.alert('Thiếu mô tả lỗi', 'Vui lòng nhập mô tả lỗi hoặc yêu cầu sửa chữa.');
      return;
    }
    setSaving(true);
    try {
      const idempotencyKey = `mob_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const accessoryList = accessories
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      const created = await repairApi.createTicket(scope, {
        idempotencyKey,
        ticketType,
        subjectType: 'equipment',
        intakeSource: 'company_sale',
        customerId,
        symptom: symptom.trim(),
        ...(promisedDate ? { promisedAt: new Date(`${promisedDate}T17:00:00+07:00`).toISOString() } : {}),
        device: {
          ...(device.product?.productId ? { productId: device.product.productId } : {}),
          serialNumber: serial,
          name: device.product?.name || 'Thiết bị',
          condition: condition.trim(),
          accessories: accessoryList,
        },
      });
      Alert.alert(
        'Đã tạo phiếu sửa chữa',
        `Phiếu ${created.ticketCode || ''} đã được tiếp nhận thành công.`,
      );
      onCreated();
    } catch (cause) {
      Alert.alert(
        'Không tạo được phiếu',
        cause instanceof Error ? cause.message : 'Vui lòng kiểm tra lại thông tin và thử lại.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <FullScreenFormModal
      visible
      title="Tạo phiếu sửa chữa"
      onClose={() => { if (!saving) onClose(); }}
    >
      <View style={styles.modalBody}>
        <Text numberOfLines={1} style={styles.mutedText}>
          {device.product?.name || 'Thiết bị'}{serial ? ` · ${serial}` : ''}
        </Text>
            <View style={styles.infoGrid}>
              <InfoCell label="Khách hàng" value={`${customerLabel}${customerPhone ? ` · ${customerPhone}` : ''}`} />
              <InfoCell
                label="Bảo hành cửa hàng"
                value={customerCovered ? `Còn ${device.customerWarranty?.daysLeft || 0} ngày` : 'Hết hạn'}
                valueColor={customerCovered ? '#16885A' : '#C27617'}
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Loại phiếu</Text>
              <View style={styles.segmentedRow}>
                <ModeButton
                  label="Bảo hành"
                  selected={ticketType === 'warranty'}
                  onPress={() => setTicketType('warranty')}
                />
                <ModeButton
                  label="Sửa dịch vụ"
                  selected={ticketType === 'service'}
                  onPress={() => setTicketType('service')}
                />
              </View>
            </View>

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Tình trạng thiết bị khi nhận *</Text>
              <TextInput
                value={condition}
                onChangeText={setCondition}
                placeholder="VD: Nguyên vẹn, trầy nhẹ viền, không vào nguồn…"
                placeholderTextColor={colors.muted}
                style={styles.transitionNoteInput}
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Mô tả lỗi / Yêu cầu sửa chữa *</Text>
              <TextInput
                value={symptom}
                onChangeText={setSymptom}
                placeholder="Nhập triệu chứng lỗi, yêu cầu của khách hàng…"
                placeholderTextColor={colors.muted}
                multiline
                textAlignVertical="top"
                style={[styles.transitionNoteInput, { minHeight: 82 }]}
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Phụ kiện đi kèm (cách nhau dấu phẩy)</Text>
              <TextInput
                value={accessories}
                onChangeText={setAccessories}
                placeholder="VD: Sạc, cáp, hộp máy"
                placeholderTextColor={colors.muted}
                style={styles.transitionNoteInput}
              />
            </View>

            <DateTimeField
              label="Ngày hẹn trả (không bắt buộc)"
              mode="date"
              value={promisedDate}
              onChange={setPromisedDate}
              allowClear
            />

            <View style={styles.modalActionsRow}>
              <Pressable disabled={saving} onPress={onClose} style={styles.cancelActionBtn}>
                <Text style={styles.cancelActionText}>Hủy</Text>
              </Pressable>
              <Pressable
                disabled={saving}
                onPress={() => void submit()}
                style={[styles.submitActionBtn, saving && styles.disabled]}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>Tạo phiếu</Text>
                )}
              </Pressable>
            </View>
      </View>
    </FullScreenFormModal>
  );
}

function ModeButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.modeButton, selected && styles.modeButtonSelected]}
    >
      <Text numberOfLines={1} style={[styles.modeText, selected && styles.modeTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

function TicketsPanel({ scope, canManage }: { scope: RepairScope; canManage: boolean }) {
  const [filter, setFilter] = useState<TicketFilter>('active');
  const [search, setSearch] = useState('');
  const [allItems, setAllItems] = useState<RepairTicket[]>([]);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<RepairTicket | null>(null);

  const load = useCallback(
    async (refresh = false) => {
      setBusy(!refresh);
      setRefreshing(refresh);
      setError('');
      try {
        const board = await repairApi.board(scope);
        const all = Object.values(board)
          .flatMap((tickets) => tickets || [])
          .sort((left, right) => right.receivedAt.localeCompare(left.receivedAt));
        setAllItems(all);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Không thể tải phiếu sửa chữa.');
      } finally {
        setBusy(false);
        setRefreshing(false);
      }
    },
    [scope],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('vi-VN');
    return allItems.filter((ticket) => {
      const matchesStatus =
        filter === 'all' ||
        (filter === 'delivered'
          ? ticket.status === 'delivered'
          : activeStatuses.includes(ticket.status));
      const matchesQuery =
        !needle ||
        [
          ticket.ticketCode,
          ticket.customerName,
          ticket.customerPhone,
          ticket.device.name,
          ticket.device.serialNumber,
          ticket.device.imei,
        ].some((value) => value?.toLocaleLowerCase('vi-VN').includes(needle));
      return matchesStatus && matchesQuery;
    });
  }, [allItems, search, filter]);

  return (
    <View style={styles.panelFlex}>
      <View style={styles.ticketsToolbar}>
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Search size={15} color={colors.muted} />
            <TextInput
              accessibilityLabel="Tìm mã phiếu, khách hàng hoặc serial"
              value={search}
              onChangeText={setSearch}
              placeholder="Tìm mã phiếu, khách hàng, serial…"
              placeholderTextColor={colors.muted}
              returnKeyType="search"
              style={styles.searchInput}
            />
            {search ? (
              <Pressable onPress={() => setSearch('')}>
                <X size={15} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tải lại danh sách"
            onPress={() => void load(true)}
            style={styles.refreshIconBtn}
          >
            <RefreshCw size={16} color={colors.primary} />
          </Pressable>
        </View>

        <View style={styles.segmentedRow}>
          {(
            [
              { key: 'active', label: 'Đang xử lý' },
              { key: 'all', label: 'Tất cả' },
              { key: 'delivered', label: 'Đã bàn giao' },
            ] as const
          ).map((option) => (
            <ModeButton
              key={option.key}
              label={option.label}
              selected={filter === option.key}
              onPress={() => setFilter(option.key)}
            />
          ))}
        </View>
      </View>

      {busy ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => void load()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Thử lại</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.ticketList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load(true)}
              tintColor={colors.primary}
            />
          }
        >
          <Text style={styles.countMeta}>
            {items.length.toLocaleString('vi-VN')} phiếu sửa chữa
          </Text>
          {items.map((ticket) => (
            <TicketCard key={ticket._id} ticket={ticket} onPress={() => setSelected(ticket)} />
          ))}
          {!items.length ? <EmptyState text="Không có phiếu phù hợp." /> : null}
        </ScrollView>
      )}

      <TicketDetailModal
        ticket={selected}
        scope={scope}
        canManage={canManage}
        onUpdated={(updated) => {
          setSelected(updated);
          setAllItems((current) =>
            current.map((item) => (item._id === updated._id ? updated : item)),
          );
          void load(true);
        }}
        onClose={() => setSelected(null)}
      />
    </View>
  );
}

function TicketCard({ ticket, onPress }: { ticket: RepairTicket; onPress: () => void }) {
  const tone = statusTone(ticket.status);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Xem phiếu ${ticket.ticketCode}`}
      onPress={onPress}
      style={styles.card}
    >
      <View style={styles.rowBetween}>
        <Text numberOfLines={1} ellipsizeMode="middle" style={styles.ticketCode}>{ticket.ticketCode}</Text>
        <View style={[styles.badge, { backgroundColor: tone.bg, flexShrink: 0 }]}>
          <Text numberOfLines={1} style={[styles.badgeText, { color: tone.fg }]}>{statusLabels[ticket.status]}</Text>
        </View>
      </View>
      <Text numberOfLines={2} style={styles.cardTitle}>{ticket.device.name}</Text>
      <Text style={styles.mutedText}>
        {ticket.customerName} · {ticket.customerPhone || 'Chưa có SĐT'}
      </Text>
      <Text style={styles.mutedText}>
        Serial: {ticket.device.serialNumber || '—'} ·{' '}
        {ticket.ticketType === 'warranty' ? 'Bảo hành' : 'Sửa dịch vụ'}
      </Text>
      <View style={styles.ticketFooter}>
        <Text style={styles.mutedText}>Nhận: {formatDate(ticket.receivedAt)}</Text>
        <Text style={ticket.dueAmount > 0 ? styles.dueText : styles.paidText}>
          {ticket.dueAmount > 0 ? `Còn nợ ${money(ticket.dueAmount)}` : money(ticket.totalAmount)}
        </Text>
      </View>
    </Pressable>
  );
}

function TicketDetailModal({
  ticket,
  scope,
  canManage,
  onUpdated,
  onClose,
}: {
  ticket: RepairTicket | null;
  scope: RepairScope;
  canManage: boolean;
  onUpdated: (ticket: RepairTicket) => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState('');
  const [transitioning, setTransitioning] = useState<RepairStatus | null>(null);
  const [technicians, setTechnicians] = useState<RepairTechnician[]>([]);
  const [technicianId, setTechnicianId] = useState('');
  const [technicianSearch, setTechnicianSearch] = useState('');
  const [techniciansLoading, setTechniciansLoading] = useState(false);
  const [techniciansError, setTechniciansError] = useState('');

  useEffect(() => {
    setNote('');
    setTransitioning(null);
    setTechnicianId('');
    setTechnicianSearch('');
  }, [ticket?._id]);

  useEffect(() => {
    if (!ticket || ticket.status !== 'received') {
      setTechnicians([]);
      setTechniciansError('');
      setTechniciansLoading(false);
      return;
    }
    let active = true;
    setTechniciansLoading(true);
    setTechniciansError('');
    void repairApi.listTechnicians()
      .then((items) => { if (active) setTechnicians(items); })
      .catch((cause) => {
        if (active) setTechniciansError(cause instanceof Error ? cause.message : 'Không tải được danh sách kỹ thuật viên.');
      })
      .finally(() => { if (active) setTechniciansLoading(false); });
    return () => { active = false; };
  }, [ticket?._id, ticket?.status]);

  const matchingTechnicians = useMemo(() => {
    const query = technicianSearch.trim().toLocaleLowerCase('vi-VN');
    return technicians.filter((person) => !query || `${person.displayName || ''} ${person.email || ''}`.toLocaleLowerCase('vi-VN').includes(query));
  }, [technicianSearch, technicians]);

  if (!ticket) return null;
  const tone = statusTone(ticket.status);
  const nextStatuses = canManage ? allowedTransitions[ticket.status] || [] : [];

  const executeTransition = async (to: RepairStatus) => {
    const needsTechnician = ticket.status === 'received' && to === 'diagnosing';
    if (needsTechnician && !technicianId) {
      Alert.alert('Chưa chọn kỹ thuật viên', 'Chọn kỹ thuật viên tiếp nhận trước khi chuyển phiếu sang bước kiểm tra.');
      return;
    }
    setTransitioning(to);
    try {
      const updated = await repairApi.transitionStatus(scope, ticket._id, {
        to,
        note: note.trim() || undefined,
        ...(needsTechnician ? { technicianId } : {}),
      });
      setNote('');
      onUpdated(updated);
      Alert.alert('Đã cập nhật trạng thái', `Phiếu ${ticket.ticketCode} đã chuyển sang “${statusLabels[to]}”.`);
    } catch (cause) {
      Alert.alert(
        'Không đổi được trạng thái',
        cause instanceof Error ? cause.message : 'Vui lòng kiểm tra điều kiện chuyển trạng thái và thử lại.',
      );
    } finally {
      setTransitioning(null);
    }
  };

  const handleTransitionPress = (to: RepairStatus) => {
    if (transitioning) return;
    if (ticket.status === 'received' && to === 'diagnosing' && !technicianId) {
      Alert.alert('Chưa chọn kỹ thuật viên', 'Chọn kỹ thuật viên tiếp nhận trước khi chuyển phiếu sang bước kiểm tra.');
      return;
    }
    if (to === 'cancelled' || to === 'returned' || to === 'delivered') {
      Alert.alert(
        `Chuyển sang “${statusLabels[to]}”?`,
        `Xác nhận chuyển phiếu ${ticket.ticketCode} sang trạng thái ${statusLabels[to]}.`,
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Xác nhận',
            style: to === 'cancelled' ? 'destructive' : 'default',
            onPress: () => {
              void executeTransition(to);
            },
          },
        ],
      );
      return;
    }
    void executeTransition(to);
  };

  return (
    <FullScreenFormModal
      visible
      title={ticket.ticketCode}
      onClose={onClose}
      rightAction={
        <View style={[styles.badge, { backgroundColor: tone.bg, flexShrink: 0 }]}>
          <Text numberOfLines={1} style={[styles.badgeText, { color: tone.fg }]}>{statusLabels[ticket.status]}</Text>
        </View>
      }
    >
      <View style={styles.modalBody}>
        <Text numberOfLines={1} style={styles.mutedText}>{ticket.device.name}</Text>
            <View style={styles.infoGrid}>
              <InfoCell
                label="Khách hàng"
                value={`${ticket.customerName}${ticket.customerPhone ? ` · ${ticket.customerPhone}` : ''}`}
              />
              <InfoCell label="Mã khách hàng" value={ticket.customerCode || ticket.customerId || '—'} />
              <InfoCell label="IMEI / Serial" value={ticket.device.imei || ticket.device.serialNumber || '—'} />
              <InfoCell label="Kỹ thuật viên" value={ticket.technicianName || 'Chưa phân công'} />
              <InfoCell label="Ngày tiếp nhận" value={formatDate(ticket.receivedAt)} />
              <InfoCell label="Hẹn trả" value={formatDate(ticket.promisedAt)} />
            </View>

            <View style={styles.detailBlock}>
              <Text style={styles.detailHeading}>Bảo hành</Text>
              <View style={styles.footerMetaRow}>
                <Text style={styles.mutedText}>Cửa hàng</Text>
                <Text
                  style={[
                    styles.detailStrong,
                    { color: ticket.coverage.customer.covered ? '#16885A' : '#C27617' },
                  ]}
                >
                  {ticket.coverage.customer.covered
                    ? `Còn ${ticket.coverage.customer.daysLeft || 0} ngày`
                    : 'Hết hạn'}
                </Text>
              </View>
              <View style={styles.footerMetaRow}>
                <Text style={styles.mutedText}>Nhà cung cấp</Text>
                <Text
                  style={[
                    styles.detailStrong,
                    { color: ticket.coverage.supplier.covered ? '#16885A' : '#C27617' },
                  ]}
                >
                  {ticket.coverage.supplier.covered
                    ? `Còn ${ticket.coverage.supplier.daysLeft || 0} ngày`
                    : 'Hết hạn'}
                </Text>
              </View>
              <View style={styles.footerMetaRow}>
                <Text style={styles.mutedText}>Bên chịu phí</Text>
                <Text style={styles.detailStrong}>
                  {ticket.coverage.costBearer === 'supplier'
                    ? 'Nhà cung cấp'
                    : ticket.coverage.costBearer === 'shop'
                      ? 'Cửa hàng'
                      : 'Khách hàng'}
                </Text>
              </View>
            </View>

            <View style={styles.detailBlock}>
              <Text style={styles.detailHeading}>Yêu cầu / Chẩn đoán</Text>
              <Text style={styles.detailLine}>{ticket.symptom || 'Chưa có mô tả'}</Text>
              {ticket.diagnosis ? (
                <Text style={styles.mutedText}>Chẩn đoán: {ticket.diagnosis}</Text>
              ) : null}
            </View>

            <View style={styles.detailBlock}>
              <Text style={styles.detailHeading}>Chi phí</Text>
              <View style={styles.footerMetaRow}>
                <Text style={styles.mutedText}>Tổng chi phí</Text>
                <Text style={styles.detailStrong}>{money(ticket.totalAmount)}</Text>
              </View>
              <View style={styles.footerMetaRow}>
                <Text style={styles.mutedText}>Còn nợ</Text>
                <Text style={ticket.dueAmount > 0 ? styles.dueText : styles.paidText}>
                  {money(ticket.dueAmount)}
                </Text>
              </View>
            </View>

            {canManage ? (
              <View style={styles.detailBlock}>
                <Text style={styles.detailHeading}>Đổi trạng thái phiếu</Text>
                <Text style={styles.helperCopy}>
                  {ticket.status === 'received'
                    ? 'Chọn kỹ thuật viên tiếp nhận trước khi chuyển sang bước kiểm tra.'
                    : nextStatuses.length > 0
                      ? 'Chọn trạng thái kế tiếp hợp lệ theo quy trình (các bước chưa tới lượt được làm mờ).'
                    : 'Phiếu đã ở trạng thái kết thúc, không thể chuyển tiếp.'}
                </Text>
                {ticket.status === 'received' && nextStatuses.includes('diagnosing') ? (
                  <View style={{ gap: 8, marginTop: 10 }}>
                    <TextInput
                      value={technicianSearch}
                      onChangeText={setTechnicianSearch}
                      placeholder="Tìm kỹ thuật viên"
                      placeholderTextColor={colors.muted}
                      style={styles.transitionNoteInput}
                    />
                    {techniciansLoading ? <ActivityIndicator color={colors.primary} /> : null}
                    {techniciansError ? <Text style={styles.errorText}>{techniciansError}</Text> : null}
                    {!techniciansLoading && !techniciansError && !matchingTechnicians.length ? (
                      <Text style={styles.helperCopy}>Không tìm thấy kỹ thuật viên đang hoạt động trong công ty.</Text>
                    ) : null}
                    <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                      {matchingTechnicians.map((person) => {
                        const selected = technicianId === person._id;
                        return (
                          <Pressable
                            key={person._id}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: selected }}
                            onPress={() => setTechnicianId(person._id)}
                            style={{
                              minHeight: 42,
                              paddingHorizontal: 10,
                              borderBottomWidth: 1,
                              borderBottomColor: colors.border,
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              backgroundColor: selected ? '#EDF4FF' : colors.white,
                            }}
                          >
                            <View style={{ flex: 1 }}>
                              <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 11, fontWeight: '700' }}>
                                {person.displayName || person.email || person._id}
                              </Text>
                              {person.displayName && person.email ? <Text numberOfLines={1} style={styles.helperCopy}>{person.email}</Text> : null}
                            </View>
                            {selected ? <Check size={15} color={colors.primary} /> : null}
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                ) : null}
                {nextStatuses.length > 0 ? (
                  <TextInput
                    value={note}
                    onChangeText={setNote}
                    placeholder="Ghi chú chuyển trạng thái (không bắt buộc)…"
                    placeholderTextColor={colors.muted}
                    style={styles.transitionNoteInput}
                  />
                ) : null}
                <View style={styles.transitionRow}>
                  {allStatuses.map((statusOption) => {
                    const isCurrent = statusOption === ticket.status;
                    const requiresTechnician = ticket.status === 'received' && statusOption === 'diagnosing';
                    const isAllowed = nextStatuses.includes(statusOption) && (!requiresTechnician || Boolean(technicianId));
                    const optTone = statusTone(statusOption);
                    const isBusy = transitioning === statusOption;
                    return (
                      <Pressable
                        key={statusOption}
                        disabled={!isAllowed || transitioning !== null}
                        onPress={() => handleTransitionPress(statusOption)}
                        style={[
                          styles.transitionBtn,
                          isCurrent
                            ? { backgroundColor: optTone.fg, borderColor: optTone.fg }
                            : isAllowed
                              ? { backgroundColor: optTone.bg, borderColor: `${optTone.fg}55` }
                              : { backgroundColor: '#F3F5F9', borderColor: colors.border, opacity: 0.45 },
                          transitioning !== null && !isBusy && isAllowed && styles.disabled,
                        ]}
                      >
                        {isBusy ? (
                          <ActivityIndicator size="small" color={optTone.fg} />
                        ) : (
                          <Text
                            style={[
                              styles.transitionBtnText,
                              { color: isCurrent ? colors.white : isAllowed ? optTone.fg : colors.muted },
                            ]}
                          >
                            {isCurrent ? `✓ ${statusLabels[statusOption]}` : statusLabels[statusOption]}
                          </Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
      </View>
    </FullScreenFormModal>
  );
}

function ReportsPanel({ scope }: { scope: RepairScope }) {
  const [range, setRange] = useState(monthRange);
  const [groupBy, setGroupBy] = useState<ReportGroup>('technician');
  const [report, setReport] = useState<RepairRevenueReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!range.from || !range.to) return;
    setBusy(true);
    setError('');
    try {
      setReport(await repairApi.revenueReport(scope, { from: range.from, to: range.to, groupBy }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể tải báo cáo sửa chữa.');
    } finally {
      setBusy(false);
    }
  }, [groupBy, range.from, range.to, scope]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.sectionCard}>
        <View style={styles.dateRow}>
          <View style={styles.dateField}>
            <DateTimeField
              label="Từ ngày"
              mode="date"
              value={range.from}
              onChange={(from) => setRange((current) => ({ ...current, from }))}
            />
          </View>
          <View style={styles.dateField}>
            <DateTimeField
              label="Đến ngày"
              mode="date"
              value={range.to}
              onChange={(to) => setRange((current) => ({ ...current, to }))}
            />
          </View>
        </View>

        <View style={styles.segmentedRow}>
          {(
            [
              { key: 'technician', label: 'Kỹ thuật viên' },
              { key: 'day', label: 'Theo ngày' },
              { key: 'branch', label: 'Chi nhánh' },
            ] as const
          ).map((option) => (
            <ModeButton
              key={option.key}
              label={option.label}
              selected={groupBy === option.key}
              onPress={() => setGroupBy(option.key)}
            />
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => void load()}
          disabled={busy || !range.from || !range.to}
          style={[styles.primaryButton, (busy || !range.from || !range.to) && styles.disabled]}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Xem báo cáo</Text>
          )}
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text accessibilityRole="alert" style={styles.errorText}>
            {error}
          </Text>
        </View>
      ) : null}

      {report ? (
        <>
          <View style={styles.metricsRow}>
            <Metric label="Doanh thu" value={money(report.total?.revenue)} accent={colors.primary} />
            <Metric label="Đã thu" value={money(report.total?.collected)} accent="#16885A" />
          </View>
          <View style={styles.metricsRow}>
            <Metric
              label="Số phiếu"
              value={Number(report.total?.ticketCount || 0).toLocaleString('vi-VN')}
              accent={colors.ink}
            />
            <Metric
              label="Còn phải thu"
              value={money(report.total?.outstanding)}
              accent="#C74848"
            />
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.detailHeading}>Chi tiết theo nhóm</Text>
            {report.items.length === 0 ? (
              <EmptyState text="Không có dữ liệu trong khoảng ngày này." />
            ) : (
              report.items.map((item, index) => (
                <View
                  key={`${item.key}-${index}`}
                  style={[styles.reportRow, index === 0 && { borderTopWidth: 0, paddingTop: 4 }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{item.technicianName || item.key || '—'}</Text>
                    <Text style={styles.mutedText}>
                      {item.ticketCount} phiếu · {item.warrantyTicketCount} bảo hành
                    </Text>
                  </View>
                  <Text style={styles.reportAmount}>{money(item.revenue)}</Text>
                </View>
              ))
            )}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

function InfoCell({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.infoCell}>
      <Text style={styles.infoCellLabel}>{label}</Text>
      <Text style={[styles.infoCellValue, valueColor ? { color: valueColor } : undefined]}>
        {value}
      </Text>
    </View>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text numberOfLines={1} style={[styles.metricValue, { color: accent }]}>
        {value}
      </Text>
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  navScroll: { flexGrow: 0, flexShrink: 0, height: 46, marginTop: 4 },
  navContent: { alignItems: 'center', gap: 8, paddingHorizontal: 14 },
  navChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    backgroundColor: colors.white,
  },
  navChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  navText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  navTextActive: { color: colors.white },
  panel: { flex: 1 },
  panelFlex: { flex: 1 },
  scrollContent: { padding: 14, paddingTop: 6, paddingBottom: 28, gap: 10 },
  sectionCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    gap: 10,
  },
  ticketsToolbar: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 8, gap: 8 },
  segmentedRow: { flexDirection: 'row', gap: 7 },
  modeButton: {
    flex: 1,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 8,
    backgroundColor: '#F6F8FC',
  },
  modeButtonSelected: { borderColor: colors.primary, backgroundColor: '#EAF2FF' },
  modeText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  modeTextSelected: { color: colors.primary },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchBox: {
    flex: 1,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#DCE5F2',
    borderRadius: 99,
    backgroundColor: colors.white,
  },
  searchInput: { flex: 1, minWidth: 0, color: '#111827', fontSize: 13.5, paddingVertical: 0 },
  searchButton: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  searchButtonText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  refreshIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helperCopy: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  disabled: { opacity: 0.55 },
  card: {
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    borderRadius: 15,
    gap: 6,
  },
  cardActive: { borderColor: colors.primary, backgroundColor: '#F5F9FF' },
  cardTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  mutedText: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  detailLine: { color: colors.ink, fontSize: 12, lineHeight: 18 },
  detailStrong: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  infoCell: {
    width: '48%',
    padding: 10,
    borderRadius: 11,
    backgroundColor: '#F6F8FC',
    gap: 3,
  },
  infoCellLabel: { color: colors.muted, fontSize: 9, fontWeight: '700' },
  infoCellValue: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  footerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F0F3F8',
  },
  ticketList: { paddingHorizontal: 14, paddingBottom: 28, gap: 9 },
  countMeta: { color: colors.muted, fontSize: 10, fontWeight: '700', marginLeft: 2 },
  ticketCode: { flex: 1, minWidth: 0, color: colors.primary, fontSize: 12, fontWeight: '800' },
  ticketFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F3F8',
  },
  dueText: { color: '#C74848', fontSize: 11, fontWeight: '800' },
  paidText: { color: '#16885A', fontSize: 11, fontWeight: '800' },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  errorBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: { color: '#B4232E', fontSize: 11, lineHeight: 16, fontWeight: '600' },
  retryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#EAF2FF',
  },
  retryText: { color: colors.primary, fontSize: 11, fontWeight: '800' },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.white,
    padding: 20,
  },
  emptyText: { color: colors.muted, fontSize: 11, textAlign: 'center', lineHeight: 16 },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
  },
  modalCard: {
    borderRadius: 24,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  closeIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F1F3F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: { padding: 14, gap: 10, paddingBottom: 22 },
  detailBlock: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    gap: 6,
  },
  transitionNoteInput: {
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: '#F8FAFD',
    color: colors.ink,
    fontSize: 12,
  },
  transitionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  transitionBtn: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transitionBtnText: {
    fontSize: 11,
    fontWeight: '800',
  },
  detailHeading: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  dateRow: { flexDirection: 'row', gap: 8 },
  dateField: { flex: 1 },
  primaryButton: {
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  createFromWarrantyBtn: {
    minHeight: 40,
    borderRadius: 11,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 6,
  },
  formField: { gap: 6 },
  formLabel: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  modalActionsRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  cancelActionBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: '#F1F3F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelActionText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  submitActionBtn: {
    flex: 1.4,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricsRow: { flexDirection: 'row', gap: 9 },
  metricCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 13,
    backgroundColor: colors.white,
    gap: 4,
  },
  metricLabel: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  metricValue: { fontSize: 14, fontWeight: '800' },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F3F8',
    paddingVertical: 10,
  },
  reportAmount: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  branchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    maxWidth: 140,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  branchButtonText: { color: colors.primary, fontSize: 11, fontWeight: '700', maxWidth: 116 },
  stateBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    gap: 9,
  },
  stateTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  stateCopy: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  branchOption: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  branchOptionActive: { backgroundColor: '#F2F6FF' },
  branchOptionText: { color: colors.ink, fontSize: 13 },
  branchOptionTextActive: { color: colors.primary, fontWeight: '700' },
});
