import { withAppLockSuspended } from '@/core/auth/appLockSuspension';
import { PopupError } from '@/components/PopupError';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import {
  AlertTriangle,
  CalendarDays,
  ExternalLink,
  FileText,
  Pencil,
  Plus,
  RefreshCw,
  Settings,
  Upload,
} from 'lucide-react-native';
import { Card } from '@/components/Card';
import { IgenHrEmptyState } from '@/components/EmptyStateIllustration';
import { FullScreenFormModal } from '@/components/FullScreenFormModal';
import {
  HrFormCustomRow,
  HrFormInputRow,
  HrFormSectionTitle,
  HrFormSelectRow,
} from '@/features/hr/components/HrFormFields';
import { HrFab } from '@/features/hr/components/HrFab';
import {
  createHrContractExtension,
  fetchHrContractsOverview,
  listHrContractExtensions,
  saveHrContract,
  updateHrContractSettings,
  uploadHrContractFile,
} from '@/features/hr/hrApi';
import type {
  HrContract,
  HrContractExpiryAlert,
  HrContractExtension,
  HrContractStatus,
} from '@/features/hr/types';
import { getTodayKey } from '@/features/overview/overviewPeriod';
import { colors } from '@/theme/colors';

const STATUS_OPTIONS: Array<{ value: HrContractStatus; label: string }> = [
  { value: 'draft', label: 'Bản nháp' },
  { value: 'active', label: 'Còn hiệu lực' },
  { value: 'expired', label: 'Hết hạn' },
  { value: 'terminated', label: 'Đã chấm dứt' },
];

const CONTRACT_TYPES = [
  'Hợp đồng thử việc',
  'Hợp đồng xác định thời hạn',
  'Hợp đồng không xác định thời hạn',
  'Hợp đồng cộng tác viên',
];

function statusLabel(status?: string): string {
  return STATUS_OPTIONS.find((s) => s.value === status)?.label || status || 'Còn hiệu lực';
}

function formatViDate(val?: string): string {
  if (!val) return '—';
  const raw = val.slice(0, 10);
  const parts = raw.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : raw;
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function daysUntilExpiry(endDate?: string): number | null {
  if (!endDate) return null;
  const exp = new Date(endDate);
  if (Number.isNaN(exp.getTime())) return null;
  const now = new Date();
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const expUtc = Date.UTC(exp.getFullYear(), exp.getMonth(), exp.getDate());
  return Math.ceil((expUtc - todayUtc) / 86_400_000);
}

export function HrContractsPanel({
  companyCode,
  branchId,
  canManage,
}: {
  companyCode?: string;
  branchId?: string;
  canManage: boolean;
}) {
  const [subTab, setSubTab] = useState<'contracts' | 'extensions'>('contracts');
  const [contracts, setContracts] = useState<HrContract[]>([]);
  const [extensions, setExtensions] = useState<HrContractExtension[]>([]);
  const [expiryAlerts, setExpiryAlerts] = useState<HrContractExpiryAlert[]>([]);
  const [expiryAlertDays, setExpiryAlertDays] = useState(20);
  const [employees, setEmployees] = useState<Array<{ _id: string; displayName?: string; email?: string; department?: string }>>([]);
  const [withoutContract, setWithoutContract] = useState<Array<{ id: string; name: string }>>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Detail modals
  const [detailContract, setDetailContract] = useState<HrContract | null>(null);
  const [detailExtension, setDetailExtension] = useState<HrContractExtension | null>(null);

  // Create / Edit Contract Modal
  const [editing, setEditing] = useState<HrContract | 'new' | null>(null);
  const [cType, setCType] = useState('Hợp đồng xác định thời hạn');
  const [cEmployeeId, setCEmployeeId] = useState('');
  const [cStartDate, setCStartDate] = useState(() => getTodayKey());
  const [cEndDate, setCEndDate] = useState('');
  const [activeContractDatePicker, setActiveContractDatePicker] = useState<{
    target: 'start' | 'end';
    value: Date;
  } | null>(null);
  const [cStatus, setCStatus] = useState<HrContractStatus>('active');
  const [cNote, setCNote] = useState('');
  const [cFileUrl, setCFileUrl] = useState('');
  const [cFileName, setCFileName] = useState('');
  const [cFileMime, setCFileMime] = useState('');
  const [cFileSize, setCFileSize] = useState(0);
  const [cFileToken, setCFileToken] = useState('');
  const [cSignedUrl, setCSignedUrl] = useState('');
  const [cSignedName, setCSignedName] = useState('');
  const [cSignedMime, setCSignedMime] = useState('');
  const [cSignedSize, setCSignedSize] = useState(0);
  const [cSignedToken, setCSignedToken] = useState('');
  const [uploadingKind, setUploadingKind] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const openContractDatePicker = (target: 'start' | 'end') => {
    const currentDate = target === 'start' ? cStartDate : cEndDate;
    const dateKey = currentDate.slice(0, 10);
    const [year, month, day] = dateKey.split('-').map(Number);
    const value = /^\d{4}-\d{2}-\d{2}$/.test(dateKey)
      ? new Date(year, month - 1, day, 12)
      : new Date();

    if (Platform.OS !== 'android') {
      setActiveContractDatePicker({ target, value });
      return;
    }

    DateTimePickerAndroid.open({
      value,
      mode: 'date',
      display: 'calendar',
      onChange: (event, selectedDate) => {
        if (event.type !== 'set' || !selectedDate) return;
        const selectedDateKey = toDateKey(selectedDate);
        if (target === 'start') setCStartDate(selectedDateKey);
        else setCEndDate(selectedDateKey);
      },
    });
  };

  const savePickedContractDate = () => {
    if (!activeContractDatePicker) return;
    const selectedDateKey = toDateKey(activeContractDatePicker.value);
    if (activeContractDatePicker.target === 'start') setCStartDate(selectedDateKey);
    else setCEndDate(selectedDateKey);
    setActiveContractDatePicker(null);
  };

  // Extension Modal
  const [extOpen, setExtOpen] = useState(false);
  const [extContractId, setExtContractId] = useState('');
  const [extDate, setExtDate] = useState(() => getTodayKey());
  const [extNewEndDate, setExtNewEndDate] = useState('');
  const [activeExtensionDatePicker, setActiveExtensionDatePicker] = useState<{
    target: 'extensionDate' | 'newEndDate';
    value: Date;
  } | null>(null);
  const [extReason, setExtReason] = useState('');
  const [extFileUrl, setExtFileUrl] = useState('');
  const [extFileName, setExtFileName] = useState('');
  const [extFileMime, setExtFileMime] = useState('');
  const [extFileSize, setExtFileSize] = useState(0);
  const [extFileToken, setExtFileToken] = useState('');

  const openExtensionDatePicker = (target: 'extensionDate' | 'newEndDate') => {
    const currentDate = target === 'extensionDate' ? extDate : extNewEndDate;
    const dateKey = currentDate.slice(0, 10);
    const [year, month, day] = dateKey.split('-').map(Number);
    const value = /^\d{4}-\d{2}-\d{2}$/.test(dateKey)
      ? new Date(year, month - 1, day, 12)
      : new Date();

    if (Platform.OS !== 'android') {
      setActiveExtensionDatePicker({ target, value });
      return;
    }

    DateTimePickerAndroid.open({
      value,
      mode: 'date',
      display: 'calendar',
      onChange: (event, selectedDate) => {
        if (event.type !== 'set' || !selectedDate) return;
        const selectedDateKey = toDateKey(selectedDate);
        if (target === 'extensionDate') setExtDate(selectedDateKey);
        else setExtNewEndDate(selectedDateKey);
      },
    });
  };

  const savePickedExtensionDate = () => {
    if (!activeExtensionDatePicker) return;
    const selectedDateKey = toDateKey(activeExtensionDatePicker.value);
    if (activeExtensionDatePicker.target === 'extensionDate') setExtDate(selectedDateKey);
    else setExtNewEndDate(selectedDateKey);
    setActiveExtensionDatePicker(null);
  };

  // Settings Modal
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingDaysStr, setSettingDaysStr] = useState('20');
  const [savingSettings, setSavingSettings] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const [overview, extList] = await Promise.all([
          fetchHrContractsOverview({ companyCode, branchId, search: search.trim() || undefined }),
          listHrContractExtensions(companyCode, branchId).catch(() => []),
        ]);
        setContracts(overview.contracts);
        setExpiryAlerts(overview.expiryAlerts);
        setExpiryAlertDays(overview.expiryAlertDays);
        setSettingDaysStr(String(overview.expiryAlertDays));
        setEmployees(overview.employees);
        setWithoutContract(overview.withoutContractEmployees);
        setExtensions(extList);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không tải được dữ liệu hợp đồng.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [branchId, companyCode, search],
  );

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  const openContractModal = useCallback((contract?: HrContract, presetEmployeeId?: string) => {
    setEditing(contract || 'new');
    setCType(contract?.contractType || 'Hợp đồng xác định thời hạn');
    setCEmployeeId(contract?.employeeId || presetEmployeeId || '');
    setCStartDate(contract?.startDate ? contract.startDate.slice(0, 10) : getTodayKey());
    setCEndDate(contract?.endDate ? contract.endDate.slice(0, 10) : '');
    setCStatus((contract?.status as HrContractStatus) || 'active');
    setCNote(contract?.note || '');
    setCFileUrl(contract?.contractFileUrl || '');
    setCFileName(contract?.contractFileName || '');
    setCFileMime(contract?.contractFileMimeType || '');
    setCFileSize(contract?.contractFileSize || 0);
    setCFileToken('');
    setCSignedUrl(contract?.signedImageUrl || '');
    setCSignedName(contract?.signedImageName || '');
    setCSignedMime(contract?.signedImageMimeType || '');
    setCSignedSize(contract?.signedImageSize || 0);
    setCSignedToken('');
  }, []);

  const pickAndUpload = useCallback(
    async (kind: 'contract' | 'signed' | 'extension') => {
      try {
        const result = await withAppLockSuspended(() => DocumentPicker.getDocumentAsync({
          multiple: false,
          copyToCacheDirectory: true,
        }));
        if (result.canceled || !result.assets?.[0]) return;
        const asset = result.assets[0];
        if ((asset.size ?? 0) > 10 * 1024 * 1024) {
          Alert.alert('Tệp quá lớn', 'Tệp tải lên không được vượt quá 10 MB.');
          return;
        }
        setUploadingKind(kind);
        const uploaded = await uploadHrContractFile(asset, kind, companyCode, branchId);
        if (kind === 'contract') {
          setCFileUrl(uploaded.url);
          setCFileName(uploaded.name);
          setCFileMime(uploaded.mimeType);
          setCFileSize(uploaded.size);
          setCFileToken(uploaded.uploadToken || '');
        } else if (kind === 'signed') {
          setCSignedUrl(uploaded.url);
          setCSignedName(uploaded.name);
          setCSignedMime(uploaded.mimeType);
          setCSignedSize(uploaded.size);
          setCSignedToken(uploaded.uploadToken || '');
        } else {
          setExtFileUrl(uploaded.url);
          setExtFileName(uploaded.name);
          setExtFileMime(uploaded.mimeType);
          setExtFileSize(uploaded.size);
          setExtFileToken(uploaded.uploadToken || '');
        }
        Alert.alert('Đã tải lên', `Đã tải "${uploaded.name}" thành công.`);
      } catch (err) {
        Alert.alert('Tải tệp thất bại', err instanceof Error ? err.message : 'Vui lòng thử lại.');
      } finally {
        setUploadingKind(null);
      }
    },
    [branchId, companyCode],
  );

  const onSaveContract = useCallback(async () => {
    if (!cEmployeeId || !cType.trim() || !cStartDate.trim() || !cEndDate.trim()) {
      Alert.alert('Thiếu thông tin', 'Hãy chọn Nhân viên, Loại hợp đồng, Ngày bắt đầu và Ngày kết thúc.');
      return;
    }
    setSaving(true);
    try {
      await saveHrContract(
        {
          contractType: cType.trim(),
          employeeId: cEmployeeId,
          startDate: cStartDate.trim(),
          endDate: cEndDate.trim(),
          status: cStatus,
          note: cNote.trim(),
          contractFileUrl: cFileUrl,
          contractFileName: cFileName,
          contractFileMimeType: cFileMime,
          contractFileSize: cFileSize,
          contractFileUploadToken: cFileToken,
          signedImageUrl: cSignedUrl,
          signedImageName: cSignedName,
          signedImageMimeType: cSignedMime,
          signedImageSize: cSignedSize,
          signedImageUploadToken: cSignedToken,
        },
        editing && editing !== 'new' ? editing._id : undefined,
        companyCode,
        branchId,
      );
      setEditing(null);
      Alert.alert('Thành công', 'Đã lưu hợp đồng lao động.');
      void load(true);
    } catch (err) {
      Alert.alert('Lỗi lưu hợp đồng', err instanceof Error ? err.message : 'Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  }, [
    branchId,
    cEmployeeId,
    cEndDate,
    cFileMime,
    cFileName,
    cFileSize,
    cFileToken,
    cFileUrl,
    cNote,
    cSignedMime,
    cSignedName,
    cSignedSize,
    cSignedToken,
    cSignedUrl,
    cStartDate,
    cStatus,
    cType,
    companyCode,
    editing,
    load,
  ]);

  const openExtendModal = useCallback((contract?: HrContract) => {
    setExtContractId(contract?._id || '');
    setExtDate(getTodayKey());
    setExtNewEndDate(contract?.endDate ? contract.endDate.slice(0, 10) : '');
    setExtReason('');
    setExtFileUrl('');
    setExtFileName('');
    setExtFileMime('');
    setExtFileSize(0);
    setExtFileToken('');
    setExtOpen(true);
  }, []);

  const onSaveExtension = useCallback(async () => {
    if (!extContractId || !extNewEndDate.trim()) {
      Alert.alert('Thiếu thông tin', 'Hãy chọn hợp đồng và ngày hết hạn mới.');
      return;
    }
    setSaving(true);
    try {
      await createHrContractExtension(
        extContractId,
        {
          extensionDate: extDate.trim() || getTodayKey(),
          newEndDate: extNewEndDate.trim(),
          reason: extReason.trim(),
          extensionFileUrl: extFileUrl,
          extensionFileName: extFileName,
          extensionFileMimeType: extFileMime,
          extensionFileSize: extFileSize,
          extensionFileUploadToken: extFileToken,
        },
        companyCode,
        branchId,
      );
      setExtOpen(false);
      Alert.alert('Thành công', 'Đã gia hạn hợp đồng.');
      void load(true);
    } catch (err) {
      Alert.alert('Lỗi gia hạn', err instanceof Error ? err.message : 'Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  }, [
    branchId,
    companyCode,
    extContractId,
    extDate,
    extFileMime,
    extFileName,
    extFileSize,
    extFileToken,
    extFileUrl,
    extNewEndDate,
    extReason,
    load,
  ]);

  const onSaveSettings = useCallback(async () => {
    const days = Number(settingDaysStr);
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      Alert.alert('Không hợp lệ', 'Số ngày báo trước phải là số nguyên từ 1 đến 365.');
      return;
    }
    setSavingSettings(true);
    try {
      const updated = await updateHrContractSettings(days, companyCode, branchId);
      setExpiryAlertDays(updated);
      setSettingsOpen(false);
      Alert.alert('Đã lưu', `Cảnh báo trước ${updated} ngày khi hợp đồng sắp hết hạn.`);
      void load(true);
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể lưu cài đặt.');
    } finally {
      setSavingSettings(false);
    }
  }, [branchId, companyCode, load, settingDaysStr]);

  const activeContracts = useMemo(
    () => contracts.filter((c) => c.status !== 'terminated'),
    [contracts],
  );

  return (
    <View style={{ flex: 1 }}>
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: 92 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load(true);
          }}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      {/* Sub-tabs: Hợp đồng | Lịch sử gia hạn */}
      <View style={styles.segmentRow}>
        <Pressable
          onPress={() => setSubTab('contracts')}
          style={[styles.segmentBtn, subTab === 'contracts' && styles.segmentBtnActive]}
        >
          <Text style={[styles.segmentText, subTab === 'contracts' && styles.segmentTextActive]}>
            Hợp đồng ({contracts.length})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setSubTab('extensions')}
          style={[styles.segmentBtn, subTab === 'extensions' && styles.segmentBtnActive]}
        >
          <Text style={[styles.segmentText, subTab === 'extensions' && styles.segmentTextActive]}>
            Gia hạn ({extensions.length})
          </Text>
        </Pressable>
      </View>

      {/* Search & actions */}
      <View style={styles.searchRow}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Tìm theo tên nhân viên, loại hợp đồng..."
          placeholderTextColor="#94A3B8"
          style={styles.searchField}
        />
        {canManage ? (
          <Pressable onPress={() => setSettingsOpen(true)} style={styles.iconActionBtn}>
            <Settings size={15} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>

      {/* Expiry alert banner */}
      {subTab === 'contracts' && expiryAlerts.length > 0 ? (
        <Card style={styles.alertBanner}>
          <View style={styles.headRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <AlertTriangle size={15} color="#B45309" />
              <Text style={styles.alertTitle}>
                {expiryAlerts.length} hợp đồng sắp hết hạn (trong {expiryAlertDays} ngày)
              </Text>
            </View>
          </View>
          {expiryAlerts.slice(0, 3).map((al) => (
            <Text key={al.id} style={styles.alertItem}>
              • {al.employeeName}: hết hạn {formatViDate(al.endDate)} (còn {al.daysRemaining} ngày)
            </Text>
          ))}
        </Card>
      ) : null}

      {/* Employees without contract */}
      {subTab === 'contracts' && canManage && withoutContract.length > 0 ? (
        <Card style={styles.missingBanner}>
          <Text style={styles.missingTitle}>
            Chưa có hợp đồng ({withoutContract.length} nhân sự) — chạm để tạo nhanh:
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 6 }}>
            {withoutContract.slice(0, 15).map((emp) => (
              <Pressable
                key={emp.id}
                onPress={() => openContractModal(undefined, emp.id)}
                style={styles.missingChip}
              >
                <Text style={styles.missingChipText}>+ {emp.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Card>
      ) : null}

      {loading ? (
        <Card style={styles.stateCard}>
          <ActivityIndicator size="small" color={colors.primary} />
        </Card>
      ) : error ? (
        <Card style={styles.stateCard}>
          <PopupError error={error} />
          <Pressable onPress={() => void load()} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Thử lại</Text>
          </Pressable>
        </Card>
      ) : subTab === 'contracts' ? (
        !contracts.length ? (
          <View style={styles.stateCard}>
            <IgenHrEmptyState message="Chưa có hợp đồng lao động nào." />
          </View>
        ) : (
          <View style={styles.list}>
            {contracts.map((c) => {
              const rem = daysUntilExpiry(c.endDate);
              const expiringSoon = c.status === 'active' && rem !== null && rem >= 1 && rem <= expiryAlertDays;
              return (
                <Card key={c._id} onPress={() => setDetailContract(c)} style={styles.card}>
                  <View style={styles.headRow}>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={styles.rowTitle}>
                        {c.employeeName || c.employeeEmail || 'Nhân sự'}
                      </Text>
                      <Text style={styles.subMeta}>{c.contractType || 'Hợp đồng lao động'}</Text>
                    </View>
                    <Text
                      style={[
                        styles.statusBadge,
                        c.status === 'active' && styles.statusActive,
                        c.status === 'expired' && styles.statusWarn,
                        c.status === 'terminated' && styles.statusDanger,
                      ]}
                    >
                      {statusLabel(c.status)}
                    </Text>
                  </View>

                  <Text style={styles.subMeta}>
                    📅 {formatViDate(c.startDate)} → {formatViDate(c.endDate)}
                    {expiringSoon ? ` · ⚠️ Còn ${rem} ngày` : ''}
                  </Text>

                  {c.note ? <Text style={styles.muted}>{c.note}</Text> : null}

                  {(c.contractFileUrl || c.signedImageUrl || c.electronicSignatureUrl) ? (
                    <View style={styles.wrapRow}>
                      {c.contractFileUrl ? (
                        <Pressable
                          onPress={() => void Linking.openURL(c.contractFileUrl!)}
                          style={styles.fileChip}
                        >
                          <FileText size={11} color={colors.primary} />
                          <Text numberOfLines={1} style={styles.fileChipText}>
                            {c.contractFileName || 'File hợp đồng'}
                          </Text>
                        </Pressable>
                      ) : null}
                      {c.signedImageUrl ? (
                        <Pressable
                          onPress={() => void Linking.openURL(c.signedImageUrl!)}
                          style={styles.fileChip}
                        >
                          <ExternalLink size={11} color="#16885A" />
                          <Text numberOfLines={1} style={[styles.fileChipText, { color: '#16885A' }]}>
                            Ảnh đã ký
                          </Text>
                        </Pressable>
                      ) : null}
                      {c.electronicSignatureUrl ? (
                        <Pressable
                          onPress={() => void Linking.openURL(c.electronicSignatureUrl!)}
                          style={styles.fileChip}
                        >
                          <ExternalLink size={11} color="#7C3AED" />
                          <Text numberOfLines={1} style={[styles.fileChipText, { color: '#7C3AED' }]}>
                            Chữ ký điện tử
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                </Card>
              );
            })}
          </View>
        )
      ) : !extensions.length ? (
        <View style={styles.stateCard}>
          <IgenHrEmptyState message="Chưa có lịch sử gia hạn hợp đồng nào." />
        </View>
      ) : (
        <View style={styles.list}>
          {extensions.map((ext) => (
            <Card key={ext._id} onPress={() => setDetailExtension(ext)} style={styles.card}>
              <View style={styles.headRow}>
                <Text style={[styles.rowTitle, { flex: 1 }]}>{ext.employeeName}</Text>
                <Text style={styles.subMeta}>Ngày GH: {formatViDate(ext.extensionDate)}</Text>
              </View>
              <Text style={styles.subMeta}>
                Hạn cũ: {formatViDate(ext.previousEndDate)} →{' '}
                <Text style={{ color: '#16885A', fontWeight: '800' }}>
                  Hạn mới: {formatViDate(ext.newEndDate)}
                </Text>
              </Text>
              {ext.reason ? <Text style={styles.muted}>Lý do: {ext.reason}</Text> : null}
              {ext.extensionFileUrl ? (
                <Pressable
                  onPress={() => void Linking.openURL(ext.extensionFileUrl!)}
                  style={[styles.fileChip, { alignSelf: 'flex-start' }]}
                >
                  <FileText size={11} color={colors.primary} />
                  <Text style={styles.fileChipText}>{ext.extensionFileName || 'Phụ lục gia hạn'}</Text>
                </Pressable>
              ) : null}
            </Card>
          ))}
        </View>
      )}

      {/* Create / Edit Contract Full-Screen Page */}
      <FullScreenFormModal
        visible={Boolean(editing)}
        title={editing === 'new' ? 'Thêm hợp đồng mới' : 'Chỉnh sửa hợp đồng'}
        cancelLabel="Hủy"
        onSave={() => void onSaveContract()}
        saving={saving || Boolean(uploadingKind)}
        onClose={() => setEditing(null)}
      >
        <View>
          <HrFormSectionTitle title="Thông tin hợp đồng" />
          <HrFormSelectRow
            label="Nhân viên *"
            sheetTitle="Chọn nhân viên"
            value={cEmployeeId}
            placeholder="Chọn nhân viên"
            options={employees.map((emp) => ({
              value: emp._id,
              label: emp.displayName || emp.email || emp._id,
              subtitle: [emp.department, emp.email].filter(Boolean).join(' · ') || undefined,
            }))}
            onSelect={setCEmployeeId}
          />
          <HrFormSelectRow
            label="Loại hợp đồng *"
            sheetTitle="Chọn loại hợp đồng"
            value={cType}
            placeholder="Chọn loại hợp đồng"
            options={CONTRACT_TYPES.map((t) => ({ value: t, label: t }))}
            onSelect={setCType}
          />
          <HrFormCustomRow label="Ngày bắt đầu *">
            <Pressable
              accessibilityRole="button"
              onPress={() => openContractDatePicker('start')}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 }}
            >
              <Text style={{ color: cStartDate ? '#111827' : '#9CA3AF', fontSize: 15, fontWeight: cStartDate ? '500' : '400' }}>
                {cStartDate ? formatViDate(cStartDate) : 'Chọn ngày'}
              </Text>
              <CalendarDays size={16} color="#9CA3AF" />
            </Pressable>
          </HrFormCustomRow>
          <HrFormCustomRow label="Ngày kết thúc *">
            <Pressable
              accessibilityRole="button"
              onPress={() => openContractDatePicker('end')}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 }}
            >
              <Text style={{ color: cEndDate ? '#111827' : '#9CA3AF', fontSize: 15, fontWeight: cEndDate ? '500' : '400' }}>
                {cEndDate ? formatViDate(cEndDate) : 'Chọn ngày'}
              </Text>
              <CalendarDays size={16} color="#9CA3AF" />
            </Pressable>
          </HrFormCustomRow>
          <HrFormSelectRow
            label="Trạng thái"
            sheetTitle="Chọn trạng thái hợp đồng"
            value={cStatus}
            options={STATUS_OPTIONS.map((st) => ({ value: st.value, label: st.label }))}
            onSelect={(val) => setCStatus(val as typeof cStatus)}
          />
          <HrFormCustomRow label="Tệp hợp đồng (PDF / DOC / DOCX)">
            <Pressable
              disabled={Boolean(uploadingKind)}
              onPress={() => void pickAndUpload('contract')}
              style={[styles.uploadBtn, { marginTop: 4 }]}
            >
              <Upload size={13} color={colors.primary} />
              <Text style={styles.uploadBtnText}>
                {uploadingKind === 'contract'
                  ? 'Đang tải tệp...'
                  : cFileName || (cFileUrl ? 'Đã có tệp hợp đồng (Bấm để thay)' : 'Tải tệp hợp đồng lên')}
              </Text>
            </Pressable>
          </HrFormCustomRow>
          <HrFormCustomRow label="Ảnh bản cứng đã ký (JPG / PNG)">
            <Pressable
              disabled={Boolean(uploadingKind)}
              onPress={() => void pickAndUpload('signed')}
              style={[styles.uploadBtn, { marginTop: 4 }]}
            >
              <Upload size={13} color={colors.primary} />
              <Text style={styles.uploadBtnText}>
                {uploadingKind === 'signed'
                  ? 'Đang tải ảnh...'
                  : cSignedName || (cSignedUrl ? 'Đã có ảnh đã ký (Bấm để thay)' : 'Tải ảnh đã ký lên')}
              </Text>
            </Pressable>
          </HrFormCustomRow>
          <HrFormInputRow
            label="Ghi chú"
            value={cNote}
            onChangeText={setCNote}
            multiline
            placeholder="Ghi chú thêm về hợp đồng..."
            last
          />
        </View>
      </FullScreenFormModal>

      {Platform.OS !== 'android' && activeContractDatePicker ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setActiveContractDatePicker(null)}
        >
          <Pressable style={styles.backdrop} onPress={() => setActiveContractDatePicker(null)}>
            <Pressable style={styles.sheet} onPress={() => {}}>
              <Text style={styles.sheetTitle}>
                {activeContractDatePicker.target === 'start'
                  ? 'Chọn ngày bắt đầu'
                  : 'Chọn ngày kết thúc'}
              </Text>
              <DateTimePicker
                value={activeContractDatePicker.value}
                mode="date"
                display="spinner"
                locale="vi-VN"
                onChange={(_event, selectedDate) => {
                  if (selectedDate) {
                    setActiveContractDatePicker((current) =>
                      current ? { ...current, value: selectedDate } : current,
                    );
                  }
                }}
              />
              <View style={styles.datePickerActions}>
                <Pressable
                  onPress={() => setActiveContractDatePicker(null)}
                  style={styles.outlineBtn}
                >
                  <Text style={styles.outlineBtnText}>Hủy</Text>
                </Pressable>
                <Pressable onPress={savePickedContractDate} style={styles.primaryBtn}>
                  <Text style={styles.primaryBtnText}>Xác nhận</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {/* Extend Contract Full-Screen Page */}
      <FullScreenFormModal
        visible={extOpen}
        title="Gia hạn hợp đồng"
        cancelLabel="Hủy"
        onSave={() => void onSaveExtension()}
        saving={saving || Boolean(uploadingKind)}
        onClose={() => setExtOpen(false)}
      >
        <View>
          <HrFormSectionTitle title="Thông tin gia hạn" />
          <HrFormSelectRow
            label="Chọn hợp đồng *"
            sheetTitle="Chọn hợp đồng cần gia hạn"
            value={extContractId}
            placeholder="Chọn hợp đồng"
            options={activeContracts.map((c) => ({
              value: c._id,
              label: c.employeeName || c._id,
              subtitle: `Hạn hiện tại: ${formatViDate(c.endDate)}`,
            }))}
            onSelect={(id) => {
              setExtContractId(id);
              const found = activeContracts.find((c) => c._id === id);
              if (!extNewEndDate && found?.endDate) setExtNewEndDate(found.endDate.slice(0, 10));
            }}
          />
          <HrFormCustomRow label="Ngày gia hạn">
            <Pressable
              accessibilityRole="button"
              onPress={() => openExtensionDatePicker('extensionDate')}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 }}
            >
              <Text style={{ color: '#111827', fontSize: 15, fontWeight: '500' }}>{formatViDate(extDate)}</Text>
              <CalendarDays size={16} color="#9CA3AF" />
            </Pressable>
          </HrFormCustomRow>
          <HrFormCustomRow label="Hạn mới *">
            <Pressable
              accessibilityRole="button"
              onPress={() => openExtensionDatePicker('newEndDate')}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 }}
            >
              <Text style={{ color: extNewEndDate ? '#111827' : '#9CA3AF', fontSize: 15, fontWeight: extNewEndDate ? '500' : '400' }}>
                {extNewEndDate ? formatViDate(extNewEndDate) : 'Chọn ngày'}
              </Text>
              <CalendarDays size={16} color="#9CA3AF" />
            </Pressable>
          </HrFormCustomRow>
          <HrFormInputRow
            label="Lý do gia hạn"
            value={extReason}
            onChangeText={setExtReason}
            multiline
            placeholder="Ghi chú lý do gia hạn..."
          />
          <HrFormCustomRow label="Phụ lục gia hạn (PDF / DOC)" last>
            <Pressable
              disabled={Boolean(uploadingKind)}
              onPress={() => void pickAndUpload('extension')}
              style={[styles.uploadBtn, { marginTop: 4 }]}
            >
              <Upload size={13} color={colors.primary} />
              <Text style={styles.uploadBtnText}>
                {uploadingKind === 'extension'
                  ? 'Đang tải...'
                  : extFileName || 'Tải file phụ lục gia hạn'}
              </Text>
            </Pressable>
          </HrFormCustomRow>
        </View>
      </FullScreenFormModal>

      {Platform.OS !== 'android' && activeExtensionDatePicker ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setActiveExtensionDatePicker(null)}
        >
          <Pressable style={styles.backdrop} onPress={() => setActiveExtensionDatePicker(null)}>
            <Pressable style={styles.sheet} onPress={() => {}}>
              <Text style={styles.sheetTitle}>
                {activeExtensionDatePicker.target === 'extensionDate'
                  ? 'Chọn ngày gia hạn'
                  : 'Chọn hạn mới'}
              </Text>
              <DateTimePicker
                value={activeExtensionDatePicker.value}
                mode="date"
                display="spinner"
                locale="vi-VN"
                onChange={(_event, selectedDate) => {
                  if (selectedDate) {
                    setActiveExtensionDatePicker((current) =>
                      current ? { ...current, value: selectedDate } : current,
                    );
                  }
                }}
              />
              <View style={styles.datePickerActions}>
                <Pressable
                  onPress={() => setActiveExtensionDatePicker(null)}
                  style={styles.outlineBtn}
                >
                  <Text style={styles.outlineBtnText}>Hủy</Text>
                </Pressable>
                <Pressable onPress={savePickedExtensionDate} style={styles.primaryBtn}>
                  <Text style={styles.primaryBtnText}>Xác nhận</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {/* Settings Full-Screen Page */}
      <FullScreenFormModal
        visible={settingsOpen}
        title="Cài đặt cảnh báo hết hạn"
        cancelLabel="Hủy"
        onSave={() => void onSaveSettings()}
        saving={savingSettings}
        onClose={() => setSettingsOpen(false)}
      >
        <View>
          <HrFormSectionTitle title="Cấu hình cảnh báo" />
          <HrFormInputRow
            label="Báo trước số ngày (1–365)"
            value={settingDaysStr}
            onChangeText={setSettingDaysStr}
            keyboardType="numeric"
            placeholder="30"
            last
          />
        </View>
      </FullScreenFormModal>

      {/* Contract Detail Full-Screen Page */}
      <FullScreenFormModal
        visible={Boolean(detailContract)}
        title="Chi tiết hợp đồng"
        onClose={() => setDetailContract(null)}
      >
        {detailContract ? (
          <View style={{ gap: 8, paddingBottom: 12 }}>
            <Text style={styles.rowTitle}>
              {detailContract.employeeName || detailContract.employeeEmail || 'Nhân sự'}
            </Text>
            <Text style={styles.subMeta}>
              Loại hợp đồng: {detailContract.contractType || 'Hợp đồng lao động'}
            </Text>
            <Text style={styles.subMeta}>
              Trạng thái: {statusLabel(detailContract.status)}
            </Text>
            <Text style={styles.subMeta}>
              Thời hạn: {formatViDate(detailContract.startDate)} →{' '}
              {formatViDate(detailContract.endDate)}
            </Text>
            {detailContract.note ? (
              <>
                <Text style={styles.label}>Ghi chú</Text>
                <Text style={styles.muted}>{detailContract.note}</Text>
              </>
            ) : null}
            {(detailContract.contractFileUrl ||
              detailContract.signedImageUrl ||
              detailContract.electronicSignatureUrl) ? (
              <>
                <Text style={styles.label}>Tệp đính kèm</Text>
                <View style={styles.wrapRow}>
                  {detailContract.contractFileUrl ? (
                    <Pressable
                      onPress={() => void Linking.openURL(detailContract.contractFileUrl!)}
                      style={styles.fileChip}
                    >
                      <FileText size={12} color={colors.primary} />
                      <Text style={styles.fileChipText}>
                        {detailContract.contractFileName || 'File hợp đồng'}
                      </Text>
                    </Pressable>
                  ) : null}
                  {detailContract.signedImageUrl ? (
                    <Pressable
                      onPress={() => void Linking.openURL(detailContract.signedImageUrl!)}
                      style={styles.fileChip}
                    >
                      <ExternalLink size={12} color="#16885A" />
                      <Text style={[styles.fileChipText, { color: '#16885A' }]}>
                        Ảnh đã ký
                      </Text>
                    </Pressable>
                  ) : null}
                  {detailContract.electronicSignatureUrl ? (
                    <Pressable
                      onPress={() =>
                        void Linking.openURL(detailContract.electronicSignatureUrl!)
                      }
                      style={styles.fileChip}
                    >
                      <ExternalLink size={12} color="#7C3AED" />
                      <Text style={[styles.fileChipText, { color: '#7C3AED' }]}>
                        Chữ ký điện tử
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </>
            ) : null}
            {canManage ? (
              <View style={styles.actionRow}>
                <Pressable
                  onPress={() => {
                    const target = detailContract;
                    setDetailContract(null);
                    openContractModal(target);
                  }}
                  style={[styles.submitBtn, { flex: 1, marginTop: 0 }]}
                >
                  <Text style={styles.submitBtnText}>Chỉnh sửa</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    const target = detailContract;
                    setDetailContract(null);
                    openExtendModal(target);
                  }}
                  style={[styles.submitBtn, { flex: 1, marginTop: 0, backgroundColor: '#16885A' }]}
                >
                  <Text style={styles.submitBtnText}>Gia hạn</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}
      </FullScreenFormModal>

      {/* Extension Detail Full-Screen Page */}
      <FullScreenFormModal
        visible={Boolean(detailExtension)}
        title="Chi tiết gia hạn hợp đồng"
        onClose={() => setDetailExtension(null)}
      >
        {detailExtension ? (
          <View style={{ gap: 8, paddingBottom: 12 }}>
            <Text style={styles.rowTitle}>{detailExtension.employeeName}</Text>
            <Text style={styles.subMeta}>
              Ngày gia hạn: {formatViDate(detailExtension.extensionDate)}
            </Text>
            <Text style={styles.subMeta}>
              Hạn cũ: {formatViDate(detailExtension.previousEndDate)} → Hạn mới:{' '}
              {formatViDate(detailExtension.newEndDate)}
            </Text>
            {detailExtension.reason ? (
              <Text style={styles.muted}>Lý do: {detailExtension.reason}</Text>
            ) : null}
            {detailExtension.extensionFileUrl ? (
              <Pressable
                onPress={() => void Linking.openURL(detailExtension.extensionFileUrl!)}
                style={[styles.fileChip, { alignSelf: 'flex-start' }]}
              >
                <FileText size={12} color={colors.primary} />
                <Text style={styles.fileChipText}>
                  {detailExtension.extensionFileName || 'Phụ lục gia hạn'}
                </Text>
              </Pressable>
            ) : null}
            {detailExtension.signedImageUrl ? (
              <Pressable
                onPress={() => void Linking.openURL(detailExtension.signedImageUrl!)}
                style={[styles.fileChip, { alignSelf: 'flex-start' }]}
              >
                <ExternalLink size={12} color="#16885A" />
                <Text style={[styles.fileChipText, { color: '#16885A' }]}>
                  Ảnh gia hạn đã ký
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </FullScreenFormModal>
    </ScrollView>
    {canManage ? (
      <HrFab
        label={subTab === 'extensions' ? 'Thêm gia hạn' : 'Thêm hợp đồng'}
        onPress={() => (subTab === 'extensions' ? openExtendModal() : openContractModal())}
      />
    ) : null}
    </View>
  );
}

const HAIRLINE_CARD = {
  backgroundColor: colors.white,
  borderRadius: 10,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: '#E5EAF2',
  shadowOpacity: 0,
  shadowRadius: 0,
  shadowOffset: { width: 0, height: 0 },
  elevation: 0,
} as const;

const styles = StyleSheet.create({
  content: { paddingHorizontal: 14, paddingBottom: 28, backgroundColor: colors.white },
  segmentRow: { flexDirection: 'row', backgroundColor: '#EAF1FA', borderRadius: 10, padding: 3, marginBottom: 10 },
  segmentBtn: { flex: 1, paddingVertical: 7.5, borderRadius: 8, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: colors.white },
  segmentText: { color: '#6B7280', fontSize: 12, fontWeight: '500' },
  segmentTextActive: { color: '#111827', fontWeight: '600' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  searchField: { flex: 1, backgroundColor: '#F6F8FC', borderColor: '#DCE5F2', borderWidth: 1, borderRadius: 99, paddingHorizontal: 14, height: 40, fontSize: 13.5, color: '#111827' },
  iconActionBtn: { ...HAIRLINE_CARD, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: colors.primary, minHeight: 40, paddingHorizontal: 12, borderRadius: 10 },
  primaryBtnText: { color: colors.white, fontSize: 12.5, fontWeight: '600' },
  alertBanner: { ...HAIRLINE_CARD, backgroundColor: '#FFFBEB', borderColor: '#FDE68A', padding: 12, marginBottom: 10, gap: 4 },
  alertTitle: { color: '#92400E', fontSize: 12.5, fontWeight: '600', flex: 1 },
  alertItem: { color: '#92400E', fontSize: 11.5 },
  missingBanner: { ...HAIRLINE_CARD, backgroundColor: '#F5F9FF', borderColor: '#DCE7F7', padding: 12, marginBottom: 10 },
  missingTitle: { color: '#111827', fontSize: 12.5, fontWeight: '600' },
  missingChip: { backgroundColor: colors.white, borderColor: '#DCE5F2', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 },
  missingChipText: { color: colors.primary, fontSize: 11.5, fontWeight: '500' },

  stateCard: { ...HAIRLINE_CARD, padding: 22, alignItems: 'center', gap: 10 },
  errorText: { color: '#B91C1C', fontSize: 12.5, textAlign: 'center' },
  list: {
    marginHorizontal: -14,
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#EEF2F7',
    gap: 0,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 0,
    borderWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEF2F7',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 5,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowTitle: { color: '#111827', fontSize: 14, fontWeight: '600' },
  muted: { color: '#6B7280', fontSize: 12.5, fontWeight: '400', lineHeight: 18 },
  subMeta: { color: '#6B7280', fontSize: 11.5, fontWeight: '400' },
  statusBadge: { color: '#475569', backgroundColor: '#F1F5F9', fontSize: 10.5, fontWeight: '500', paddingHorizontal: 8, paddingVertical: 3.5, borderRadius: 8, overflow: 'hidden' },
  statusActive: { color: '#16885A', backgroundColor: '#E9F8F1' },
  statusWarn: { color: '#B45309', backgroundColor: '#FFF3E5' },
  statusDanger: { color: '#B91C1C', backgroundColor: '#FEE2E2' },
  fileChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F5F9FF', borderColor: '#DCE7F7', borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  fileChipText: { color: colors.primary, fontSize: 11, fontWeight: '500', maxWidth: 150 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  smallEditBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EAF2FF', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  smallEditBtnText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  smallExtendBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E9F8F1', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  smallExtendBtnText: { color: '#16885A', fontSize: 12, fontWeight: '600' },

  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.35)', justifyContent: 'center', padding: 16 },
  sheet: { backgroundColor: colors.white, borderRadius: 20, overflow: 'hidden', padding: 18, gap: 8, maxHeight: '90%' },
  sheetTitle: { color: '#111827', fontSize: 16, fontWeight: '600' },
  closeText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  label: { color: '#374151', fontSize: 12.5, fontWeight: '500', marginTop: 4 },
  field: { backgroundColor: '#F6F8FC', borderColor: '#DCE5F2', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13.5, color: '#111827' },
  datePickerField: { backgroundColor: '#F6F8FC', borderColor: '#DCE5F2', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  datePickerText: { color: '#111827', fontSize: 13.5 },
  datePickerActions: { flexDirection: 'row', justifyContent: 'flex-end', alignSelf: 'stretch', gap: 8, marginTop: 8 },
  outlineBtn: { ...HAIRLINE_CARD, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 11, paddingVertical: 8 },
  outlineBtnText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: colors.white, borderColor: '#E5EAF2', borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: '#6B7280', fontSize: 11.5, fontWeight: '500' },
  chipTextActive: { color: colors.white, fontWeight: '600' },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#F5F9FF', borderColor: '#9BC5FF', borderWidth: 1, borderStyle: 'dashed', borderRadius: 10, paddingVertical: 11, paddingHorizontal: 12 },
  uploadBtnText: { color: colors.primary, fontSize: 12.5, fontWeight: '600' },
  submitBtn: { backgroundColor: colors.primary, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  submitBtnText: { color: colors.white, fontSize: 13.5, fontWeight: '600' },
  disabled: { opacity: 0.45 },
});

