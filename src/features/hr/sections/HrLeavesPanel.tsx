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
  CalendarDays,
  Check,
  ExternalLink,
  FileText,
  Paperclip,
  Plus,
  Send,
  Trash2,
  Upload,
  X,
  XCircle,
} from 'lucide-react-native';
import { Card } from '@/components/Card';
import { FullScreenFormModal } from '@/components/FullScreenFormModal';
import { showHrConfirm } from '@/features/hr/components/HrConfirmModal';
import { useAuth } from '@/core/auth/AuthProvider';
import {
  createLeaveApplication,
  createLeaveTemplate,
  deleteLeaveApplication,
  deleteLeaveTemplate,
  getEmployeeLeaveBalance,
  listHrEmployees,
  listLeaveApplications,
  listLeaveTemplates,
  updateLeaveStatus,
  uploadHrMediaFile,
} from '@/features/hr/hrApi';
import type {
  HrEmployee,
  HrLeaveApplication,
  HrLeaveBalance,
  HrLeaveTemplate,
  HrRequestKind,
} from '@/features/hr/types';
import { getTodayKey } from '@/features/overview/overviewPeriod';
import { colors } from '@/theme/colors';

const REQUEST_KINDS: Array<{ value: HrRequestKind; label: string }> = [
  { value: 'leave', label: 'Nghỉ phép' },
  { value: 'wfh', label: 'Làm tại nhà' },
  { value: 'event', label: 'Tạo sự kiện' },
  { value: 'exception', label: 'Ngoại lệ' },
];

function getKindLabel(kind?: string): string {
  return REQUEST_KINDS.find((k) => k.value === kind)?.label || 'Nghỉ phép';
}

function getTypeLabel(type?: string): string {
  switch (type) {
    case 'leave':
      return 'Nghỉ phép';
    case 'late':
      return 'Đi trễ';
    case 'early':
      return 'Về sớm';
    case 'other':
      return 'Đơn khác';
    default:
      return type || 'Nghỉ phép';
  }
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

export function HrLeavesPanel({
  companyCode,
  branchId,
  canApprove,
}: {
  companyCode?: string;
  branchId?: string;
  canApprove: boolean;
}) {
  const { user } = useAuth();
  const currentUid = user?._id || user?.id || '';

  const [apps, setApps] = useState<HrLeaveApplication[]>([]);
  const [templates, setTemplates] = useState<HrLeaveTemplate[]>([]);
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [myBalance, setMyBalance] = useState<HrLeaveBalance | null>(null);
  const [formBalance, setFormBalance] = useState<HrLeaveBalance | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [kindFilter, setKindFilter] = useState<'' | HrRequestKind>('');

  // Detail modal
  const [detailApp, setDetailApp] = useState<HrLeaveApplication | null>(null);

  // Create application modal
  const [createOpen, setCreateOpen] = useState(false);
  const [appEmployeeId, setAppEmployeeId] = useState(currentUid);
  const [appRequestKind, setAppRequestKind] = useState<HrRequestKind>('leave');
  const [appType, setAppType] = useState('leave');
  const [startDate, setStartDate] = useState(() => getTodayKey());
  const [endDate, setEndDate] = useState(() => getTodayKey());
  const [activeApplicationDatePicker, setActiveApplicationDatePicker] = useState<{
    target: 'startDate' | 'endDate';
    value: Date;
  } | null>(null);
  const [reason, setReason] = useState('');
  const [appFiles, setAppFiles] = useState<DocumentPicker.DocumentPickerAsset[]>([]);
  const [saving, setSaving] = useState(false);

  const applyApplicationDate = (target: 'startDate' | 'endDate', date: Date) => {
    const value = toDateKey(date);
    if (target === 'startDate') setStartDate(value);
    else setEndDate(value);
  };

  const openApplicationDatePicker = (target: 'startDate' | 'endDate') => {
    const currentValue = target === 'startDate' ? startDate : endDate;
    const dateKey = currentValue.slice(0, 10);
    const [year, month, day] = dateKey.split('-').map(Number);
    const value = /^\d{4}-\d{2}-\d{2}$/.test(dateKey)
      ? new Date(year, month - 1, day, 12)
      : new Date();

    if (Platform.OS !== 'android') {
      setActiveApplicationDatePicker({ target, value });
      return;
    }

    DateTimePickerAndroid.open({
      value,
      mode: 'date',
      display: 'calendar',
      onChange: (event, selectedDate) => {
        if (event.type === 'set' && selectedDate) applyApplicationDate(target, selectedDate);
      },
    });
  };

  const savePickedApplicationDate = () => {
    if (!activeApplicationDatePicker) return;
    applyApplicationDate(activeApplicationDatePicker.target, activeApplicationDatePicker.value);
    setActiveApplicationDatePicker(null);
  };

  // Reject reason modal
  const [rejectTarget, setRejectTarget] = useState<HrLeaveApplication | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [decidingId, setDecidingId] = useState<string | null>(null);

  // Templates modal
  const [templatesModalOpen, setTemplatesModalOpen] = useState(false);
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false);
  const [tplName, setTplName] = useState('');
  const [tplKind, setTplKind] = useState<HrRequestKind>('leave');
  const [tplUrl, setTplUrl] = useState('');
  const [tplFile, setTplFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [savingTpl, setSavingTpl] = useState(false);

  const openTemplateEditor = () => {
    setTplName('');
    setTplKind('leave');
    setTplUrl('');
    setTplFile(null);
    setTemplatesModalOpen(false);
    setTemplateEditorOpen(true);
  };

  const closeTemplateEditor = () => {
    if (savingTpl) return;
    setTemplateEditorOpen(false);
    setTemplatesModalOpen(true);
  };

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const year = new Date().getFullYear();
        const [appList, tplList, empList, bal] = await Promise.all([
          listLeaveApplications(companyCode, branchId),
          listLeaveTemplates(companyCode).catch(() => []),
          canApprove && companyCode ? listHrEmployees(companyCode, branchId).catch(() => []) : Promise.resolve([]),
          currentUid ? getEmployeeLeaveBalance(currentUid, year).catch(() => null) : Promise.resolve(null),
        ]);
        setApps(appList);
        setTemplates(tplList);
        setEmployees(empList);
        setMyBalance(bal);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không tải được danh sách đơn từ.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [branchId, canApprove, companyCode, currentUid],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    for (const a of apps) {
      if (a.status === 'approved') approved++;
      else if (a.status === 'rejected') rejected++;
      else pending++;
    }
    return { all: apps.length, pending, approved, rejected };
  }, [apps]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return apps.filter((app) => {
      const st = app.status || 'pending';
      if (statusFilter !== 'all' && st !== statusFilter) return false;
      if (kindFilter && (app.requestKind || 'leave') !== kindFilter) return false;
      if (!q) return true;
      return (
        (app.employeeName || app.applicantName || '').toLowerCase().includes(q) ||
        getTypeLabel(app.type || app.leaveType || app.templateName).toLowerCase().includes(q) ||
        getKindLabel(app.requestKind).toLowerCase().includes(q) ||
        (app.reason || '').toLowerCase().includes(q) ||
        (app.rejectReason || '').toLowerCase().includes(q)
      );
    });
  }, [apps, kindFilter, search, statusFilter]);

  const openCreateModal = useCallback(() => {
    const firstTpl = templates[0];
    setAppEmployeeId(currentUid);
    setAppType(firstTpl ? firstTpl.name : 'other');
    setAppRequestKind(firstTpl?.requestKind || 'leave');
    const today = getTodayKey();
    setStartDate(today);
    setEndDate(today);
    setReason('');
    setAppFiles([]);
    setFormBalance(myBalance);
    setCreateOpen(true);
    if (currentUid) {
      void getEmployeeLeaveBalance(currentUid, new Date().getFullYear())
        .then(setFormBalance)
        .catch(() => {});
    }
  }, [currentUid, myBalance, templates]);

  const pickAppFiles = useCallback(async () => {
    try {
      const result = await withAppLockSuspended(() => DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
      }));
      if (!result.canceled && result.assets?.length) {
        setAppFiles((prev) => [...prev, ...result.assets]);
      }
    } catch (err) {
      Alert.alert('Lỗi chọn tệp', err instanceof Error ? err.message : 'Không mở được trình chọn tệp.');
    }
  }, []);

  const pickTplFile = useCallback(async () => {
    try {
      const result = await withAppLockSuspended(() => DocumentPicker.getDocumentAsync({
        multiple: false,
        copyToCacheDirectory: true,
      }));
      if (!result.canceled && result.assets?.[0]) {
        const picked = result.assets[0];
        setTplFile(picked);
        if (!tplName.trim()) {
          setTplName(picked.name.replace(/\.[^.]+$/, ''));
        }
      }
    } catch (err) {
      Alert.alert('Lỗi chọn tệp', err instanceof Error ? err.message : 'Không mở được trình chọn tệp.');
    }
  }, [tplName]);

  const handleSelectFormEmployee = useCallback(
    (empUid: string) => {
      setAppEmployeeId(empUid);
      const yr = Number(startDate.slice(0, 4)) || new Date().getFullYear();
      if (empUid) {
        void getEmployeeLeaveBalance(empUid, yr)
          .then(setFormBalance)
          .catch(() => setFormBalance(null));
      }
    },
    [startDate],
  );

  const onCreateApp = useCallback(async () => {
    if (!startDate.trim() || !endDate.trim()) {
      Alert.alert('Thiếu ngày', 'Vui lòng chọn đầy đủ Từ ngày và Đến ngày.');
      return;
    }
    const startDt = new Date(`${startDate.trim()}T00:00:00`);
    const endDt = new Date(`${endDate.trim()}T23:59:59`);
    if (Number.isNaN(startDt.getTime()) || Number.isNaN(endDt.getTime())) {
      Alert.alert('Ngày không hợp lệ', 'Vui lòng chọn ngày hợp lệ.');
      return;
    }
    if (endDt < startDt) {
      Alert.alert('Ngày không hợp lệ', 'Đến ngày phải lớn hơn hoặc bằng Từ ngày.');
      return;
    }

    setSaving(true);
    try {
      const uploadedAttachments = await Promise.all(
        appFiles.map((asset) => uploadHrMediaFile(asset, 'hr.leave')),
      );
      const targetEmp = employees.find((e) => (e.uid || e._id || e.id) === appEmployeeId);
      const created = await createLeaveApplication(
        {
          companyCode,
          employeeId: appEmployeeId || currentUid,
          employeeName: targetEmp?.displayName || user?.displayName || user?.email || 'Nhân viên',
          type: appType,
          requestKind: appRequestKind,
          startDate: startDt.toISOString(),
          endDate: endDt.toISOString(),
          reason: reason.trim() || `Đăng ký ${getKindLabel(appRequestKind).toLowerCase()}`,
          uploadedFileUrl: uploadedAttachments[0]?.url || '',
          uploadedFileName: uploadedAttachments[0]?.name || '',
          attachments: uploadedAttachments,
        },
        branchId,
      );
      setApps((prev) => [created, ...prev]);
      setAppFiles([]);
      setCreateOpen(false);
      Alert.alert('Thành công', `Đã gửi đơn "${getKindLabel(appRequestKind)}".`);
    } catch (err) {
      Alert.alert('Lỗi gửi đơn', err instanceof Error ? err.message : 'Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  }, [
    appEmployeeId,
    appFiles,
    appRequestKind,
    appType,
    branchId,
    companyCode,
    currentUid,
    employees,
    endDate,
    reason,
    startDate,
    user?.displayName,
    user?.email,
  ]);

  const onApprove = useCallback(
    async (app: HrLeaveApplication) => {
      setDecidingId(app.id);
      try {
        const updated = await updateLeaveStatus(app.id, 'approved', branchId, {
          approvalType: 'justified',
          approvedBy: currentUid,
        });
        setApps((prev) => prev.map((a) => (a.id === app.id ? { ...a, ...updated, status: 'approved' } : a)));
      } catch (err) {
        Alert.alert('Lỗi phê duyệt', err instanceof Error ? err.message : 'Không thể phê duyệt đơn.');
      } finally {
        setDecidingId(null);
      }
    },
    [branchId, currentUid],
  );

  const onConfirmReject = useCallback(async () => {
    if (!rejectTarget) return;
    if (!rejectReason.trim()) {
      Alert.alert('Thiếu lý do', 'Vui lòng nhập lý do từ chối đơn.');
      return;
    }
    setDecidingId(rejectTarget.id);
    try {
      const updated = await updateLeaveStatus(rejectTarget.id, 'rejected', branchId, {
        rejectReason: rejectReason.trim(),
        approvedBy: currentUid,
      });
      setApps((prev) =>
        prev.map((a) =>
          a.id === rejectTarget.id
            ? { ...a, ...updated, status: 'rejected', rejectReason: rejectReason.trim() }
            : a,
        ),
      );
      setRejectTarget(null);
      setRejectReason('');
    } catch (err) {
      Alert.alert('Lỗi từ chối', err instanceof Error ? err.message : 'Không thể từ chối đơn.');
    } finally {
      setDecidingId(null);
    }
  }, [branchId, currentUid, rejectReason, rejectTarget]);

  const onDeleteApp = useCallback((app: HrLeaveApplication) => {
    showHrConfirm({
      title: 'Xóa đơn từ?',
      message: 'Hành động này không thể hoàn tác.',
      confirmLabel: 'Xóa đơn',
      onConfirm: async () => {
        try {
          await deleteLeaveApplication(app.id);
          setApps((prev) => prev.filter((a) => a.id !== app.id));
        } catch (err) {
          Alert.alert('Lỗi xóa', err instanceof Error ? err.message : 'Không thể xóa đơn.');
        }
      },
    });
  }, []);

  const onCreateTemplate = useCallback(async () => {
    if (!tplName.trim()) {
      Alert.alert('Thiếu tên biểu mẫu', 'Hãy nhập tên biểu mẫu.');
      return;
    }
    if (!tplFile && !tplUrl.trim()) {
      Alert.alert('Thiếu tệp biểu mẫu', 'Hãy chọn tệp biểu mẫu từ thiết bị hoặc nhập link tệp.');
      return;
    }
    setSavingTpl(true);
    try {
      let fileUrl = tplUrl.trim() || undefined;
      let fileName = fileUrl ? tplName.trim() : undefined;
      let uploadToken: string | undefined;

      if (tplFile) {
        const uploaded = await uploadHrMediaFile(tplFile, 'hr.leave');
        fileUrl = uploaded.url;
        fileName = uploaded.name;
        uploadToken = uploaded.uploadToken;
      }

      const created = await createLeaveTemplate({
        companyCode,
        name: tplName.trim(),
        requestKind: tplKind,
        fileUrl,
        fileName,
        uploadToken,
        uploadedBy: currentUid,
      });
      setTemplates((prev) => [created, ...prev]);
      setTplName('');
      setTplUrl('');
      setTplFile(null);
      setTemplateEditorOpen(false);
      setTemplatesModalOpen(true);
      Alert.alert('Thành công', 'Đã tải lên biểu mẫu mới.');
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể tải lên biểu mẫu.');
    } finally {
      setSavingTpl(false);
    }
  }, [companyCode, currentUid, tplFile, tplKind, tplName, tplUrl]);

  const onDeleteTemplate = useCallback((tpl: HrLeaveTemplate) => {
    showHrConfirm({
      title: 'Xóa biểu mẫu?',
      message: `Bạn có chắc muốn xóa biểu mẫu "${tpl.name}"?`,
      confirmLabel: 'Xóa',
      onConfirm: async () => {
        try {
          await deleteLeaveTemplate(tpl.id);
          setTemplates((prev) => prev.filter((t) => t.id !== tpl.id));
        } catch (err) {
          Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể xóa biểu mẫu.');
        }
      },
    });
  }, []);

  const selectedTemplate = templates.find((t) => t.name === appType);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
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
      {/* Top search & actions */}
      <View style={styles.searchRow}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Tìm nhân viên, loại đơn, lý do..."
          placeholderTextColor={colors.muted}
          style={[styles.field, { flex: 1 }]}
        />
        <Pressable onPress={() => setTemplatesModalOpen(true)} style={styles.outlineBtn}>
          <FileText size={13} color={colors.primary} />
          <Text style={styles.outlineBtnText}>Mẫu ({templates.length})</Text>
        </Pressable>
        <Pressable onPress={openCreateModal} style={styles.primaryBtn}>
          <Plus size={13} color={colors.white} />
          <Text style={styles.primaryBtnText}>Nộp đơn</Text>
        </Pressable>
      </View>

      {/* Personal Leave Balance Banner */}
      {myBalance ? (
        <Card style={styles.balanceCard}>
          <Text style={styles.balanceTitle}>
            Phép năm {myBalance.year || new Date().getFullYear()}: Còn{' '}
            <Text style={{ color: colors.primary }}>{myBalance.remaining ?? 0}</Text> /{' '}
            {myBalance.entitlement ?? 0} ngày
          </Text>
          <Text style={styles.subMeta}>
            Đã dùng: {myBalance.used ?? 0} ngày · Chờ duyệt: {myBalance.pending ?? 0} ngày
          </Text>
        </Card>
      ) : null}

      {/* Status filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, marginBottom: 8 }}
      >
        {(
          [
            { key: 'all', label: `Tất cả (${counts.all})` },
            { key: 'pending', label: `Chờ duyệt (${counts.pending})` },
            { key: 'approved', label: `Đã duyệt (${counts.approved})` },
            { key: 'rejected', label: `Từ chối (${counts.rejected})` },
          ] as const
        ).map((item) => {
          const active = statusFilter === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setStatusFilter(item.key)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Request Kind filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, marginBottom: 12 }}
      >
        <Pressable
          onPress={() => setKindFilter('')}
          style={[styles.kindChip, !kindFilter && styles.kindChipActive]}
        >
          <Text style={[styles.kindChipText, !kindFilter && styles.kindChipTextActive]}>
            Tất cả loại
          </Text>
        </Pressable>
        {REQUEST_KINDS.map((k) => {
          const active = kindFilter === k.value;
          return (
            <Pressable
              key={k.value}
              onPress={() => setKindFilter(k.value)}
              style={[styles.kindChip, active && styles.kindChipActive]}
            >
              <Text style={[styles.kindChipText, active && styles.kindChipTextActive]}>
                {k.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

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
      ) : !filtered.length ? (
        <Card style={styles.stateCard}>
          <Text style={styles.muted}>Chưa có đơn từ phù hợp.</Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {filtered.map((app) => {
            const st = app.status || 'pending';
            const isPending = st === 'pending';
            const isApproved = st === 'approved';
            const isRejected = st === 'rejected';
            const isOwner = Boolean(currentUid && app.employeeId === currentUid);
            const attachments = app.attachments?.length
              ? app.attachments
              : app.uploadedFileUrl
                ? [{ url: app.uploadedFileUrl, name: app.uploadedFileName || 'Tệp đính kèm' }]
                : [];

            return (
              <Card key={app.id} onPress={() => setDetailApp(app)} style={styles.card}>
                <View style={styles.headRow}>
                  <View style={styles.badgeRow}>
                    <Text style={styles.kindBadge}>{getKindLabel(app.requestKind)}</Text>
                    <Text
                      style={[
                        styles.statusBadge,
                        isApproved && styles.statusApproved,
                        isRejected && styles.statusRejected,
                      ]}
                    >
                      {isApproved ? 'Đã duyệt' : isRejected ? 'Từ chối' : 'Chờ duyệt'}
                    </Text>
                  </View>
                  {canApprove || (isOwner && isPending) ? (
                    <Pressable onPress={() => onDeleteApp(app)} hitSlop={8}>
                      <Trash2 size={14} color="#B91C1C" />
                    </Pressable>
                  ) : null}
                </View>

                <Text style={styles.rowTitle}>
                  {app.employeeName || app.applicantName || 'Nhân viên'} ·{' '}
                  {getTypeLabel(app.type || app.leaveType || app.templateName)}
                </Text>

                <Text style={styles.subMeta}>
                  📅 {formatViDate(app.startDate)} → {formatViDate(app.endDate)}
                </Text>

                {app.reason ? <Text style={styles.muted}>{app.reason}</Text> : null}

                {isRejected && app.rejectReason ? (
                  <View style={styles.rejectBox}>
                    <Text style={styles.rejectBoxText}>Lý do từ chối: {app.rejectReason}</Text>
                  </View>
                ) : null}

                {attachments.length > 0 ? (
                  <View style={styles.attachWrap}>
                    {attachments.map((att, idx) => (
                      <Pressable
                        key={idx}
                        onPress={() => void Linking.openURL(att.url)}
                        style={styles.attachChip}
                      >
                        <Paperclip size={11} color={colors.primary} />
                        <Text numberOfLines={1} style={styles.attachText}>
                          {att.name || 'Xem tệp đính kèm'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                {canApprove && isPending ? (
                  <View style={styles.decideRow}>
                    <Pressable
                      disabled={decidingId === app.id}
                      onPress={() => void onApprove(app)}
                      style={[styles.approveBtn, decidingId === app.id && styles.disabled]}
                    >
                      <Check size={14} color={colors.white} />
                      <Text style={styles.decideBtnText}>Phê duyệt</Text>
                    </Pressable>
                    <Pressable
                      disabled={decidingId === app.id}
                      onPress={() => {
                        setRejectTarget(app);
                        setRejectReason('');
                      }}
                      style={[styles.rejectBtn, decidingId === app.id && styles.disabled]}
                    >
                      <XCircle size={14} color={colors.white} />
                      <Text style={styles.decideBtnText}>Từ chối</Text>
                    </Pressable>
                  </View>
                ) : null}
              </Card>
            );
          })}
        </View>
      )}

      {/* Create Application Full-Screen Page */}
      <FullScreenFormModal
        visible={createOpen}
        title="Nộp đơn từ mới"
        cancelLabel="Hủy"
        onSave={() => void onCreateApp()}
        saveLabel="Gửi"
        saving={saving}
        onClose={() => setCreateOpen(false)}
      >
        <View style={{ gap: 8, paddingBottom: 12 }}>
          {canApprove && employees.length > 0 ? (
            <>
              <Text style={styles.label}>Nhân viên đăng ký</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {employees.slice(0, 30).map((emp) => {
                  const uid = emp.uid || emp._id || emp.id || '';
                  const active = appEmployeeId === uid;
                  return (
                    <Pressable
                      key={uid}
                      onPress={() => handleSelectFormEmployee(uid)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {emp.displayName}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          ) : null}

          {formBalance ? (
            <View style={styles.inlineBalance}>
              <Text style={styles.subMeta}>
                Số dư phép năm: <Text style={{ color: colors.primary, fontWeight: '800' }}>{formBalance.remaining ?? 0}</Text> / {formBalance.entitlement ?? 0} ngày
              </Text>
            </View>
          ) : null}

          <Text style={styles.label}>Nhóm yêu cầu *</Text>
          <View style={styles.wrapRow}>
            {REQUEST_KINDS.map((k) => {
              const active = appRequestKind === k.value;
              return (
                <Pressable
                  key={k.value}
                  onPress={() => setAppRequestKind(k.value)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {k.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Loại đơn / Biểu mẫu</Text>
          <View style={styles.wrapRow}>
            {templates.map((tpl) => {
              const active = appType === tpl.name;
              return (
                <Pressable
                  key={tpl.id}
                  onPress={() => {
                    setAppType(tpl.name);
                    if (tpl.requestKind) setAppRequestKind(tpl.requestKind);
                  }}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {tpl.name}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => setAppType('other')}
              style={[styles.chip, appType === 'other' && styles.chipActive]}
            >
              <Text style={[styles.chipText, appType === 'other' && styles.chipTextActive]}>
                Đơn khác
              </Text>
            </Pressable>
          </View>

          {selectedTemplate?.fileUrl ? (
            <Pressable
              onPress={() => void Linking.openURL(selectedTemplate.fileUrl!)}
              style={styles.attachChip}
            >
              <ExternalLink size={12} color={colors.primary} />
              <Text style={styles.attachText}>
                Mở biểu mẫu: {selectedTemplate.fileName || selectedTemplate.name}
              </Text>
            </Pressable>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Từ ngày *</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => openApplicationDatePicker('startDate')}
                style={styles.datePickerField}
              >
                <Text style={styles.datePickerText}>{formatViDate(startDate)}</Text>
                <CalendarDays size={15} color={colors.primary} />
              </Pressable>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Đến ngày *</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => openApplicationDatePicker('endDate')}
                style={styles.datePickerField}
              >
                <Text style={styles.datePickerText}>{formatViDate(endDate)}</Text>
                <CalendarDays size={15} color={colors.primary} />
              </Pressable>
            </View>
          </View>

          <Text style={styles.label}>Lý do / Nội dung chi tiết</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            multiline
            placeholder="Nhập lý do xin nghỉ, WFH hoặc đề xuất..."
            placeholderTextColor={colors.muted}
            style={[styles.field, { minHeight: 74, textAlignVertical: 'top' }]}
          />

          <Text style={styles.label}>Tệp đính kèm (PDF, ảnh, Word...)</Text>
          <Pressable onPress={() => void pickAppFiles()} style={styles.uploadBtn}>
            <Upload size={14} color={colors.primary} />
            <Text style={styles.uploadBtnText}>Chọn tệp từ thiết bị</Text>
          </Pressable>
          {appFiles.length > 0 ? (
            <View style={styles.attachWrap}>
              {appFiles.map((file, idx) => (
                <View key={`${file.uri}_${idx}`} style={styles.attachChip}>
                  <Paperclip size={11} color={colors.primary} />
                  <Text numberOfLines={1} style={[styles.attachText, { maxWidth: 180 }]}>
                    {file.name}
                  </Text>
                  <Pressable
                    onPress={() => setAppFiles((prev) => prev.filter((_, i) => i !== idx))}
                    hitSlop={6}
                  >
                    <X size={12} color="#B91C1C" />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          <Pressable
            disabled={saving}
            onPress={() => void onCreateApp()}
            style={[styles.submitBtn, saving && styles.disabled]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Send size={14} color={colors.white} />
              <Text style={styles.submitBtnText}>
                {saving ? 'Đang tải tệp & gửi...' : 'Gửi đơn ngay'}
              </Text>
            </View>
          </Pressable>
        </View>
      </FullScreenFormModal>

      {Platform.OS !== 'android' && activeApplicationDatePicker ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setActiveApplicationDatePicker(null)}
        >
          <Pressable
            style={styles.backdrop}
            onPress={() => setActiveApplicationDatePicker(null)}
          >
            <Pressable style={styles.sheet} onPress={() => {}}>
              <Text style={styles.sheetTitle}>
                {activeApplicationDatePicker.target === 'startDate'
                  ? 'Chọn ngày bắt đầu'
                  : 'Chọn ngày kết thúc'}
              </Text>
              <DateTimePicker
                value={activeApplicationDatePicker.value}
                mode="date"
                display="spinner"
                locale="vi-VN"
                onChange={(_event, selectedDate) => {
                  if (selectedDate) {
                    setActiveApplicationDatePicker((current) =>
                      current ? { ...current, value: selectedDate } : current,
                    );
                  }
                }}
              />
              <View style={styles.datePickerActions}>
                <Pressable
                  onPress={() => setActiveApplicationDatePicker(null)}
                  style={styles.outlineBtn}
                >
                  <Text style={styles.outlineBtnText}>Hủy</Text>
                </Pressable>
                <Pressable onPress={savePickedApplicationDate} style={styles.primaryBtn}>
                  <Text style={styles.primaryBtnText}>Xác nhận</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {/* Reject Reason Full-Screen Page */}
      <FullScreenFormModal
        visible={Boolean(rejectTarget)}
        title="Từ chối đơn từ"
        cancelLabel="Hủy"
        onSave={() => void onConfirmReject()}
        saveLabel="Xác nhận"
        saving={Boolean(decidingId)}
        onClose={() => setRejectTarget(null)}
      >
        <View style={{ gap: 8, paddingBottom: 12 }}>
          <Text style={styles.muted}>
            Đơn của {rejectTarget?.employeeName || rejectTarget?.applicantName} (
            {formatViDate(rejectTarget?.startDate)} → {formatViDate(rejectTarget?.endDate)})
          </Text>
          <Text style={styles.label}>Lý do từ chối *</Text>
          <TextInput
            value={rejectReason}
            onChangeText={setRejectReason}
            multiline
            placeholder="Nhập lý do từ chối..."
            placeholderTextColor={colors.muted}
            style={[styles.field, { minHeight: 74, textAlignVertical: 'top' }]}
          />
          <Pressable
            disabled={Boolean(decidingId)}
            onPress={() => void onConfirmReject()}
            style={[styles.submitBtn, { backgroundColor: '#B91C1C' }, Boolean(decidingId) && styles.disabled]}
          >
            <Text style={styles.submitBtnText}>Xác nhận từ chối</Text>
          </Pressable>
        </View>
      </FullScreenFormModal>

      {/* Templates Full-Screen Page */}
      <FullScreenFormModal
        visible={templatesModalOpen}
        title={`Biểu mẫu đơn từ (${templates.length})`}
        onClose={() => setTemplatesModalOpen(false)}
        rightAction={
          canApprove ? (
            <Pressable onPress={openTemplateEditor} style={styles.primaryBtn}>
              <Plus size={13} color={colors.white} />
              <Text style={styles.primaryBtnText}>Thêm</Text>
            </Pressable>
          ) : undefined
        }
      >
        <View style={{ gap: 10, paddingBottom: 12 }}>
          {!templates.length ? (
            <Text style={styles.muted}>Chưa có biểu mẫu nào được tải lên.</Text>
          ) : (
            templates.map((tpl) => (
              <View key={tpl.id} style={styles.tplCard}>
                <View style={styles.headRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{tpl.name}</Text>
                    <Text style={styles.subMeta}>{getKindLabel(tpl.requestKind)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    {tpl.fileUrl ? (
                      <Pressable onPress={() => void Linking.openURL(tpl.fileUrl!)}>
                        <ExternalLink size={15} color={colors.primary} />
                      </Pressable>
                    ) : null}
                    {canApprove ? (
                      <Pressable onPress={() => onDeleteTemplate(tpl)}>
                        <Trash2 size={15} color="#B91C1C" />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </FullScreenFormModal>

      {/* Add template Full-Screen Page */}
      <FullScreenFormModal
        visible={templateEditorOpen}
        title="Thêm biểu mẫu mới"
        cancelLabel="Hủy"
        onSave={() => void onCreateTemplate()}
        saving={savingTpl}
        onClose={closeTemplateEditor}
      >
        <View style={{ gap: 8, paddingBottom: 12 }}>
          <Text style={styles.label}>Tên biểu mẫu *</Text>
          <TextInput
            value={tplName}
            onChangeText={setTplName}
            placeholder="VD: Đơn xin nghỉ phép năm"
            placeholderTextColor={colors.muted}
            style={styles.field}
          />
          <Text style={styles.label}>Nhóm yêu cầu</Text>
          <View style={styles.wrapRow}>
            {REQUEST_KINDS.map((kind) => (
              <Pressable
                key={kind.value}
                onPress={() => setTplKind(kind.value)}
                style={[styles.chip, tplKind === kind.value && styles.chipActive]}
              >
                <Text style={[styles.chipText, tplKind === kind.value && styles.chipTextActive]}>
                  {kind.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Tệp biểu mẫu *</Text>
          <Pressable onPress={() => void pickTplFile()} style={styles.uploadBtn}>
            <Upload size={14} color={colors.primary} />
            <Text style={styles.uploadBtnText}>
              {tplFile ? `Đã chọn: ${tplFile.name}` : 'Chọn tệp biểu mẫu từ thiết bị'}
            </Text>
          </Pressable>
          {tplFile ? (
            <Pressable onPress={() => setTplFile(null)} style={{ alignSelf: 'flex-start' }}>
              <Text style={{ color: '#B91C1C', fontSize: 10, fontWeight: '700' }}>
                Bỏ tệp đã chọn
              </Text>
            </Pressable>
          ) : null}
          <Text style={styles.label}>Hoặc dán link tệp (tùy chọn)</Text>
          <TextInput
            value={tplUrl}
            onChangeText={setTplUrl}
            autoCapitalize="none"
            placeholder="https://..."
            placeholderTextColor={colors.muted}
            style={styles.field}
          />
          <Pressable
            disabled={savingTpl}
            onPress={() => void onCreateTemplate()}
            style={[styles.submitBtn, savingTpl && styles.disabled]}
          >
            <Text style={styles.submitBtnText}>
              {savingTpl ? 'Đang tải lên...' : 'Tải lên biểu mẫu'}
            </Text>
          </Pressable>
        </View>
      </FullScreenFormModal>

      {/* Application Detail Full-Screen Page */}
      <FullScreenFormModal
        visible={Boolean(detailApp)}
        title="Chi tiết đơn từ"
        onClose={() => setDetailApp(null)}
      >
        {detailApp ? (
          <View style={{ gap: 8, paddingBottom: 12 }}>
            <Text style={styles.rowTitle}>
              {detailApp.employeeName || detailApp.applicantName || 'Nhân viên'}
            </Text>
            <Text style={styles.subMeta}>
              Nhóm yêu cầu: {getKindLabel(detailApp.requestKind)} · Loại đơn:{' '}
              {getTypeLabel(detailApp.type || detailApp.leaveType || detailApp.templateName)}
            </Text>
            <Text style={styles.subMeta}>
              Thời gian: {formatViDate(detailApp.startDate)} → {formatViDate(detailApp.endDate)}
            </Text>
            <Text style={styles.subMeta}>
              Trạng thái:{' '}
              {detailApp.status === 'approved'
                ? 'Đã duyệt'
                : detailApp.status === 'rejected'
                  ? 'Từ chối'
                  : 'Chờ duyệt'}
            </Text>
            {detailApp.reason ? (
              <>
                <Text style={styles.label}>Lý do / Nội dung</Text>
                <Text style={styles.muted}>{detailApp.reason}</Text>
              </>
            ) : null}
            {detailApp.status === 'rejected' && detailApp.rejectReason ? (
              <View style={styles.rejectBox}>
                <Text style={styles.rejectBoxText}>
                  Lý do từ chối: {detailApp.rejectReason}
                </Text>
              </View>
            ) : null}
            {((detailApp.attachments && detailApp.attachments.length > 0) ||
              detailApp.uploadedFileUrl) ? (
              <>
                <Text style={styles.label}>Tệp đính kèm</Text>
                <View style={styles.attachWrap}>
                  {(detailApp.attachments?.length
                    ? detailApp.attachments
                    : [
                        {
                          url: detailApp.uploadedFileUrl!,
                          name: detailApp.uploadedFileName || 'Tệp đính kèm',
                        },
                      ]
                  ).map((att, idx) => (
                    <Pressable
                      key={idx}
                      onPress={() => void Linking.openURL(att.url)}
                      style={styles.attachChip}
                    >
                      <Paperclip size={11} color={colors.primary} />
                      <Text style={styles.attachText}>
                        {att.name || 'Xem tệp đính kèm'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            {canApprove && (detailApp.status || 'pending') === 'pending' ? (
              <View style={styles.decideRow}>
                <Pressable
                  disabled={decidingId === detailApp.id}
                  onPress={() => {
                    const target = detailApp;
                    setDetailApp(null);
                    void onApprove(target);
                  }}
                  style={styles.approveBtn}
                >
                  <Check size={14} color={colors.white} />
                  <Text style={styles.decideBtnText}>Phê duyệt</Text>
                </Pressable>
                <Pressable
                  disabled={decidingId === detailApp.id}
                  onPress={() => {
                    const target = detailApp;
                    setDetailApp(null);
                    setRejectTarget(target);
                    setRejectReason('');
                  }}
                  style={styles.rejectBtn}
                >
                  <XCircle size={14} color={colors.white} />
                  <Text style={styles.decideBtnText}>Từ chối</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}
      </FullScreenFormModal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingBottom: 28 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  balanceCard: { padding: 11, marginBottom: 10, backgroundColor: '#F0F7FF', borderColor: '#CBE0FF', gap: 2 },
  balanceTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  inlineBalance: { backgroundColor: '#F0F7FF', borderColor: '#CBE0FF', borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 10 },
  primaryBtnText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  outlineBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 9, borderRadius: 10 },
  outlineBtnText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  stateCard: { padding: 20, alignItems: 'center', gap: 10 },
  errorText: { color: '#B91C1C', fontSize: 12, textAlign: 'center' },
  list: { gap: 10 },
  card: { padding: 13, gap: 6 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kindBadge: { color: colors.primary, backgroundColor: '#EAF2FF', fontSize: 9, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  statusBadge: { color: '#B45309', backgroundColor: '#FFF3E5', fontSize: 9, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  statusApproved: { color: '#16885A', backgroundColor: '#E9F8F1' },
  statusRejected: { color: '#B91C1C', backgroundColor: '#FEE2E2' },
  rowTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  subMeta: { color: colors.muted, fontSize: 10 },
  rejectBox: { backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 6 },
  rejectBoxText: { color: '#B91C1C', fontSize: 11, fontWeight: '600' },
  attachWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  attachChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F0F7FF', borderColor: '#CBE0FF', borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, maxWidth: '100%' },
  attachText: { color: colors.primary, fontSize: 10, fontWeight: '700', flexShrink: 1 },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#EAF2FF', borderColor: '#9BC5FF', borderWidth: 1, borderStyle: 'dashed', borderRadius: 11, paddingVertical: 10, paddingHorizontal: 12 },
  uploadBtnText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  decideRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  approveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#16885A', minHeight: 36, borderRadius: 9 },
  rejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#B91C1C', minHeight: 36, borderRadius: 9 },
  decideBtnText: { color: colors.white, fontSize: 11, fontWeight: '700' },

  chip: { backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  chipTextActive: { color: colors.white },
  kindChip: { backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  kindChipActive: { backgroundColor: '#EAF2FF', borderColor: colors.primary, borderWidth: 1 },
  kindChipText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  kindChipTextActive: { color: colors.primary },

  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.42)', justifyContent: 'center', padding: 16 },
  sheet: { backgroundColor: colors.white, borderRadius: 24, overflow: 'hidden', padding: 18, gap: 8, maxHeight: '90%' },
  sheetTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  closeText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  label: { color: colors.ink, fontSize: 11, fontWeight: '700', marginTop: 2 },
  field: { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8, fontSize: 12, color: colors.ink },
  datePickerField: { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 11, minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  datePickerText: { color: colors.ink, fontSize: 12 },
  datePickerActions: { flexDirection: 'row', justifyContent: 'flex-end', alignSelf: 'stretch', gap: 8, marginTop: 8 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tplCard: { backgroundColor: '#F8FAFC', borderColor: colors.border, borderWidth: 1, borderRadius: 11, padding: 11 },
  submitBtn: { backgroundColor: colors.primary, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  submitBtnText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  disabled: { opacity: 0.45 },
});

