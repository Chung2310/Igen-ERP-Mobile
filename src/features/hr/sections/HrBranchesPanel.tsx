import { PopupError } from '@/components/PopupError';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import * as Location from 'expo-location';
import { AlertTriangle, CheckCircle2, ChevronRight, Info, LocateFixed, MapPin, Phone, Plus, Radio } from 'lucide-react-native';
import { Card } from '@/components/Card';
import { FullScreenFormModal } from '@/components/FullScreenFormModal';
import { HrFab } from '@/features/hr/components/HrFab';
import {
  createHrBranch,
  createHrBranchOwner,
  getHrCurrentIp,
  listHrBranches,
  listHrEmployees,
  updateHrBranch,
} from '@/features/hr/hrApi';
import type { HrBranch, HrBranchLocationConfig, HrEmployee } from '@/features/hr/types';
import { colors } from '@/theme/colors';

function expandIpv6(value: string): string[] | null {
  const address = value.trim().toLowerCase().replace(/\/\d+$/, '');
  if (!address.includes(':')) return null;
  const sides = address.split('::');
  if (sides.length > 2) return null;
  const left = sides[0] ? sides[0].split(':') : [];
  const right = sides[1] ? sides[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  if (missing < 0 || (sides.length === 1 && missing !== 0)) return null;
  const groups = [...left, ...Array(missing).fill('0'), ...right];
  if (groups.length !== 8 || groups.some((part) => !/^[0-9a-f]{1,4}$/.test(part || '0'))) {
    return null;
  }
  return groups.map((part) => Number.parseInt(part || '0', 16).toString(16));
}

function toAttendanceNetwork(value: string): string {
  const groups = expandIpv6(value);
  return groups ? `${groups.slice(0, 4).join(':')}::/64` : value.trim();
}

function parseLocationConfig(input: {
  latitude: string;
  longitude: string;
  allowedRadius: string;
  allowedPublicIps: string;
}): { config?: HrBranchLocationConfig; error?: string } {
  const latStr = input.latitude.trim();
  const lngStr = input.longitude.trim();
  const radStr = input.allowedRadius.trim();
  const ips = [
    ...new Set(
      input.allowedPublicIps
        .split(/[\n,]/)
        .map((v) => v.trim())
        .filter(Boolean)
        .map(toAttendanceNetwork),
    ),
  ];

  const hasAny = Boolean(latStr || lngStr || ips.length);
  if (!hasAny) {
    return { config: undefined };
  }

  const latitude = Number(latStr.replace(',', '.'));
  const longitude = Number(lngStr.replace(',', '.'));
  const allowedRadius = Number(radStr || '100');

  if (!latStr || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return { error: 'Vĩ độ không hợp lệ (phải nằm trong khoảng -90 đến 90).' };
  }
  if (!lngStr || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { error: 'Kinh độ không hợp lệ (phải nằm trong khoảng -180 đến 180).' };
  }
  if (!Number.isFinite(allowedRadius) || allowedRadius < 1) {
    return { error: 'Bán kính cho phép phải lớn hơn hoặc bằng 1 mét.' };
  }
  if (ips.length === 0) {
    return { error: 'Vui lòng nhập ít nhất 1 IP công cộng được phép.' };
  }

  return {
    config: {
      latitude,
      longitude,
      allowedRadius,
      allowedPublicIps: ips,
    },
  };
}

async function requestDevicePosition(): Promise<{ latitude: number; longitude: number }> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    throw new Error('Cần cấp quyền vị trí cho ERP Mobile để lấy tọa độ chi nhánh.');
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
}

type BranchNotice = {
  title: string;
  message: string;
  tone: 'info' | 'success' | 'error';
};

export function HrBranchesPanel({
  companyCode,
  canManage,
  onBranchesChanged,
}: {
  companyCode?: string;
  canManage: boolean;
  onBranchesChanged?: () => void;
}) {
  const [branches, setBranches] = useState<HrBranch[]>([]);
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState<BranchNotice | null>(null);
  const [locationPermissionPrompt, setLocationPermissionPrompt] = useState(false);

  // Detail & Edit modal
  const [selectedBranch, setSelectedBranch] = useState<HrBranch | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Create / Edit fields
  const [createOpen, setCreateOpen] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [managerId, setManagerId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [allowedRadius, setAllowedRadius] = useState('100');
  const [allowedPublicIps, setAllowedPublicIps] = useState('');
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  const showNotice = useCallback((title: string, message: string, tone?: BranchNotice['tone']) => {
    const normalizedTitle = title.toLocaleLowerCase();
    const inferredTone = tone ?? (/^(đã|thành công)/.test(normalizedTitle)
      ? 'success'
      : /^(lỗi|không|thiếu|chưa|cấu hình|mã chi nhánh)/.test(normalizedTitle)
        ? 'error'
        : 'info');
    setNotice({ title, message, tone: inferredTone });
  }, []);

  // Create branch owner modal
  const [ownerModalOpen, setOwnerModalOpen] = useState(false);
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [savingOwner, setSavingOwner] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const [branchList, empList] = await Promise.all([
          listHrBranches(),
          companyCode ? listHrEmployees(companyCode).catch(() => []) : Promise.resolve([]),
        ]);
        setBranches(branchList);
        setEmployees(empList);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không tải được danh sách chi nhánh.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [companyCode],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const employeeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of employees) {
      const id = e.uid || e._id || e.id;
      if (id) map.set(id, e.displayName);
    }
    return map;
  }, [employees]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return branches;
    return branches.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.code.toLowerCase().includes(q) ||
        (b.address || '').toLowerCase().includes(q) ||
        (b.phone || '').toLowerCase().includes(q),
    );
  }, [branches, search]);

  const openCreate = useCallback(() => {
    setCode('');
    setName('');
    setAddress('');
    setPhone('');
    setManagerId('');
    setIsActive(true);
    setLatitude('');
    setLongitude('');
    setAllowedRadius('100');
    setAllowedPublicIps('');
    setCreateOpen(true);
  }, []);

  const openDetail = useCallback((branch: HrBranch) => {
    setSelectedBranch(branch);
    setIsEditing(false);
  }, []);

  const startEdit = useCallback(() => {
    if (!selectedBranch) return;
    const cfg = selectedBranch.locationConfig;
    setCode(selectedBranch.code || '');
    setName(selectedBranch.name || '');
    setAddress(selectedBranch.address || '');
    setPhone(selectedBranch.phone || '');
    setManagerId(selectedBranch.managerId || '');
    setIsActive(selectedBranch.isActive !== false);
    setLatitude(cfg?.latitude != null ? String(cfg.latitude) : '');
    setLongitude(cfg?.longitude != null ? String(cfg.longitude) : '');
    setAllowedRadius(cfg?.allowedRadius != null ? String(cfg.allowedRadius) : '100');
    setAllowedPublicIps(cfg?.allowedPublicIps?.join('\n') || '');
    setIsEditing(true);
  }, [selectedBranch]);

  const handleLatitudeChange = useCallback((val: string) => {
    // Hỗ trợ dán nhanh tọa độ dạng "21.0285, 105.8542" từ Google Maps
    const pair = val.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (pair) {
      setLatitude(pair[1]);
      setLongitude(pair[2]);
      return;
    }
    setLatitude(val);
  }, []);

  const captureLocationAndIp = useCallback(async () => {
    if (locating) return;
    setLocating(true);
    const [posRes, ipRes] = await Promise.allSettled([
      requestDevicePosition(),
      getHrCurrentIp(),
    ]);

    let gotPos = false;
    let gotIp = false;

    if (posRes.status === 'fulfilled') {
      setLatitude(String(posRes.value.latitude));
      setLongitude(String(posRes.value.longitude));
      gotPos = true;
    }
    if (ipRes.status === 'fulfilled' && ipRes.value) {
      const normalized = toAttendanceNetwork(ipRes.value);
      setAllowedPublicIps((prev) => {
        const existing = prev
          .split(/[\n,]/)
          .map((item) => item.trim())
          .filter(Boolean);
        return [...new Set([...existing, normalized])].join('\n');
      });
      gotIp = true;
    }

    setLocating(false);

    if (gotPos && gotIp) {
      showNotice('Đã cập nhật', 'Đã lấy thành công vị trí GPS và IP mạng hiện tại.');
    } else if (!gotPos && gotIp) {
      const reason =
        posRes.status === 'rejected' && posRes.reason instanceof Error
          ? posRes.reason.message + ' Bạn có thể nhập tọa độ vĩ độ, kinh độ thủ công.'
          : 'Không thể lấy vị trí GPS. Bạn có thể nhập tọa độ vĩ độ, kinh độ thủ công.';
      showNotice('Đã lấy IP mạng hiện tại', reason);
    } else if (gotPos && !gotIp) {
      showNotice('Đã lấy vị trí GPS', 'Không thể lấy IP mạng hiện tại từ máy chủ.');
    } else {
      showNotice('Không thể lấy tự động', 'Không lấy được vị trí GPS và IP mạng hiện tại. Bạn có thể nhập thủ công.');
    }
  }, [locating, showNotice]);

  const requestLocationCapture = useCallback(async () => {
    if (locating) return;
    try {
      const permission = await Location.getForegroundPermissionsAsync();
      if (permission.status === 'granted') {
        void captureLocationAndIp();
      } else {
        setLocationPermissionPrompt(true);
      }
    } catch {
      showNotice('Không kiểm tra được quyền vị trí', 'Hãy thử lại sau hoặc nhập tọa độ chi nhánh thủ công.', 'error');
    }
  }, [captureLocationAndIp, locating, showNotice]);

  const onCreate = useCallback(async () => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode || !name.trim()) {
      showNotice('Thiếu thông tin', 'Hãy nhập Mã chi nhánh và Tên chi nhánh.');
      return;
    }
    if (!/^[A-Za-z0-9_-]+$/.test(cleanCode)) {
      showNotice('Mã chi nhánh không hợp lệ', 'Chỉ dùng chữ, số, dấu gạch ngang (-) hoặc gạch dưới (_).');
      return;
    }
    const { config: locationConfig, error: locErr } = parseLocationConfig({
      latitude,
      longitude,
      allowedRadius,
      allowedPublicIps,
    });
    if (locErr) {
      showNotice('Cấu hình chấm công chưa hợp lệ', locErr);
      return;
    }
    setSaving(true);
    try {
      const created = await createHrBranch({
        code: cleanCode,
        name: name.trim(),
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        managerId: managerId || undefined,
        locationConfig,
        isActive,
      });
      setBranches((prev) => [created, ...prev]);
      setCreateOpen(false);
      onBranchesChanged?.();
      showNotice('Thành công', `Đã tạo chi nhánh "${created.name}".`);
    } catch (err) {
      showNotice('Lỗi tạo chi nhánh', err instanceof Error ? err.message : 'Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  }, [address, allowedPublicIps, allowedRadius, code, isActive, latitude, longitude, managerId, name, onBranchesChanged, phone, showNotice]);

  const onSaveEdit = useCallback(async () => {
    if (!selectedBranch || !name.trim() || saving) {
      if (!name.trim()) showNotice('Thiếu tên chi nhánh', 'Hãy nhập tên chi nhánh.');
      return;
    }
    const cleanCode = code.trim().toUpperCase();
    if (cleanCode && !/^[A-Za-z0-9_-]+$/.test(cleanCode)) {
      showNotice('Mã chi nhánh không hợp lệ', 'Chỉ dùng chữ, số, dấu gạch ngang (-) hoặc gạch dưới (_).');
      return;
    }
    const { config: locationConfig, error: locErr } = parseLocationConfig({
      latitude,
      longitude,
      allowedRadius,
      allowedPublicIps,
    });
    if (locErr) {
      showNotice('Cấu hình chấm công chưa hợp lệ', locErr);
      return;
    }
    setSaving(true);
    try {
      const updated = await updateHrBranch(selectedBranch._id, {
        code: cleanCode || undefined,
        name: name.trim(),
        address: address.trim(),
        phone: phone.trim(),
        managerId: managerId || '',
        locationConfig,
        isActive,
      });
      setBranches((prev) => prev.map((b) => (b._id === updated._id ? updated : b)));
      setSelectedBranch(updated);
      setIsEditing(false);
      onBranchesChanged?.();
      showNotice('Đã lưu', 'Cập nhật thông tin chi nhánh thành công.');
    } catch (err) {
      showNotice('Lỗi cập nhật', err instanceof Error ? err.message : 'Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  }, [address, allowedPublicIps, allowedRadius, code, isActive, latitude, longitude, managerId, name, onBranchesChanged, phone, saving, selectedBranch, showNotice]);

  const onCreateOwner = useCallback(async () => {
    if (!selectedBranch || savingOwner) return;
    if (!ownerName.trim() || !ownerEmail.trim() || ownerPassword.length < 6) {
      showNotice('Thiếu thông tin', 'Nhập Họ tên, Email và Mật khẩu (tối thiểu 6 ký tự).');
      return;
    }
    setSavingOwner(true);
    try {
      await createHrBranchOwner(selectedBranch._id, {
        displayName: ownerName.trim(),
        email: ownerEmail.trim(),
        password: ownerPassword,
        phone: ownerPhone.trim() || undefined,
      });
      setOwnerModalOpen(false);
      setOwnerName('');
      setOwnerEmail('');
      setOwnerPassword('');
      setOwnerPhone('');
      showNotice('Thành công', 'Đã tạo tài khoản Quản lý chi nhánh.');
      void load(true);
    } catch (err) {
      showNotice('Lỗi', err instanceof Error ? err.message : 'Không thể tạo tài khoản quản lý chi nhánh.');
    } finally {
      setSavingOwner(false);
    }
  }, [load, ownerEmail, ownerName, ownerPassword, ownerPhone, savingOwner, selectedBranch, showNotice]);

  const renderLocationConfigEditor = () => (
    <View style={styles.locationBox}>
      <View style={styles.locationHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.locationTitle}>Cấu hình chấm công</Text>
          <Text style={styles.locationHint}>Bắt buộc để nhân viên chấm công theo vị trí & IP.</Text>
        </View>
        <Pressable
          disabled={locating}
          onPress={() => void requestLocationCapture()}
          style={[styles.locateBtn, locating && styles.disabled]}
        >
          <View style={styles.iconButtonContent}>
            {!locating ? <LocateFixed size={14} color={colors.primary} /> : null}
            <Text style={styles.locateBtnText}>{locating ? 'Đang lấy...' : 'Vị trí & IP'}</Text>
          </View>
        </Pressable>
      </View>

      <View style={styles.coordRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.smallLabel}>Vĩ độ</Text>
          <TextInput
            value={latitude}
            onChangeText={handleLatitudeChange}
            keyboardType="numbers-and-punctuation"
            placeholder="21.0285"
            placeholderTextColor={colors.muted}
            style={styles.locationField}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.smallLabel}>Kinh độ</Text>
          <TextInput
            value={longitude}
            onChangeText={setLongitude}
            keyboardType="numbers-and-punctuation"
            placeholder="105.8542"
            placeholderTextColor={colors.muted}
            style={styles.locationField}
          />
        </View>
        <View style={{ width: 84 }}>
          <Text style={styles.smallLabel}>Bán kính (m)</Text>
          <TextInput
            value={allowedRadius}
            onChangeText={setAllowedRadius}
            keyboardType="numeric"
            placeholder="100"
            placeholderTextColor={colors.muted}
            style={styles.locationField}
          />
        </View>
      </View>

      <Text style={[styles.smallLabel, { marginTop: 8 }]}>IP công cộng được phép</Text>
      <TextInput
        value={allowedPublicIps}
        onChangeText={setAllowedPublicIps}
        multiline
        numberOfLines={3}
        placeholder="Mỗi IP một dòng (VD: 113.190.232.10)"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.locationField, styles.ipInput]}
      />
      <Text style={styles.ipHint}>
        IPv4 được kiểm tra chính xác; IPv6 dùng chung mạng /64 cho các thiết bị cùng Wi-Fi.
      </Text>
    </View>
  );

  const NoticeIcon = notice?.tone === 'success' ? CheckCircle2 : notice?.tone === 'error' ? AlertTriangle : Info;
  const noticeColor = notice?.tone === 'success' ? '#16885A' : notice?.tone === 'error' ? '#DC2626' : colors.primary;
  const noticeIconBackground = notice?.tone === 'success' ? '#E9F8F1' : notice?.tone === 'error' ? '#FEF2F2' : '#EAF2FF';

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
      <View style={styles.searchRow}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Tìm theo tên, mã chi nhánh, địa chỉ..."
          placeholderTextColor="#94A3B8"
          style={styles.searchField}
        />
      </View>

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
          <Text style={styles.muted}>Chưa có chi nhánh nào.</Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {filtered.map((branch) => {
            const isMain = branch.code?.toUpperCase() === 'MAIN';
            const active = branch.isActive !== false;
            const managerName = branch.managerId ? employeeNameById.get(branch.managerId) : undefined;
            const cfg = branch.locationConfig;
            return (
              <Card key={branch._id} onPress={() => openDetail(branch)} style={styles.card}>
                <View style={styles.headRow}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.badgeRow}>
                      <Text style={styles.codeBadge}>{branch.code}</Text>
                      {isMain ? <Text style={styles.mainBadge}>Trụ sở chính</Text> : null}
                      <Text style={[styles.statusBadge, !active && styles.statusInactive]}>
                        {active ? 'Hoạt động' : 'Tạm ngưng'}
                      </Text>
                    </View>
                    <Text numberOfLines={1} style={styles.rowTitle}>
                      {branch.name}
                    </Text>
                  </View>
                  <ChevronRight size={16} color={colors.muted} />
                </View>
                {branch.address ? (
                  <View style={styles.metaRow}><MapPin size={13} color={colors.muted} /><Text numberOfLines={2} style={styles.muted}>{branch.address}</Text></View>
                ) : null}
                <View style={styles.metaRow}>
                  <Phone size={13} color={colors.muted} />
                  <Text style={styles.subMeta}>{branch.phone || 'Chưa có SĐT'}{managerName ? ` · QL: ${managerName}` : ''}</Text>
                </View>
                <View style={styles.metaRow}>
                  {cfg ? <Radio size={13} color="#16885A" /> : <AlertTriangle size={13} color="#B45309" />}
                  <Text style={[styles.subMeta, cfg ? styles.configOk : styles.configMissing]}>
                    {cfg ? `Chấm công: bán kính ${cfg.allowedRadius}m · ${cfg.allowedPublicIps?.length || 0} IP` : 'Chưa cấu hình vị trí & IP chấm công'}
                  </Text>
                </View>
              </Card>
            );
          })}
        </View>
      )}

      {/* Detail & Edit Branch Full-Screen Page */}
      <FullScreenFormModal
        visible={Boolean(selectedBranch)}
        title={isEditing ? 'Chỉnh sửa chi nhánh' : selectedBranch?.name || 'Chi tiết chi nhánh'}
        cancelLabel={isEditing ? 'Hủy' : undefined}
        onSave={isEditing ? () => void onSaveEdit() : undefined}
        saving={saving}
        onClose={() => {
          if (isEditing) setIsEditing(false);
          else setSelectedBranch(null);
        }}
      >
        {selectedBranch ? (
          isEditing ? (
            <View style={{ gap: 8, paddingBottom: 12 }}>
              <Text style={styles.label}>Mã chi nhánh *</Text>
              <TextInput
                value={code}
                editable={false}
                autoCapitalize="characters"
                style={[styles.field, styles.readonlyField]}
              />

              <Text style={styles.label}>Tên chi nhánh *</Text>
              <TextInput value={name} onChangeText={setName} style={styles.field} />

              <Text style={styles.label}>Địa chỉ</Text>
              <TextInput value={address} onChangeText={setAddress} style={styles.field} />

              <Text style={styles.label}>Số điện thoại</Text>
              <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={styles.field} />

              <Text style={styles.label}>Quản lý chi nhánh</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 4 }}>
                <Pressable
                  onPress={() => setManagerId('')}
                  style={[styles.chip, !managerId && styles.chipActive]}
                >
                  <Text style={[styles.chipText, !managerId && styles.chipTextActive]}>Chưa chỉ định</Text>
                </Pressable>
                {employees.slice(0, 25).map((emp) => {
                  const uid = emp.uid || emp._id || emp.id || '';
                  const active = managerId === uid;
                  return (
                    <Pressable
                      key={uid}
                      onPress={() => setManagerId(uid)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {emp.displayName}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {renderLocationConfigEditor()}

              <View style={styles.switchRow}>
                <Text style={styles.label}>Đang hoạt động</Text>
                <Switch
                  value={isActive}
                  onValueChange={setIsActive}
                  trackColor={{ true: colors.primary, false: '#CBD5E1' }}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                <Pressable onPress={() => setIsEditing(false)} style={styles.cancelBtn}>
                  <Text style={styles.cancelBtnText}>Hủy</Text>
                </Pressable>
                <Pressable
                  disabled={saving}
                  onPress={() => void onSaveEdit()}
                  style={[styles.submitBtn, { flex: 1, marginTop: 0 }, saving && styles.disabled]}
                >
                  <Text style={styles.submitBtnText}>
                    {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={{ gap: 10, paddingBottom: 10 }}>
              <View style={styles.infoRow}>
                <Text style={styles.muted}>Mã chi nhánh</Text>
                <Text style={styles.infoVal}>{selectedBranch.code}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.muted}>Trạng thái</Text>
                <Text style={styles.infoVal}>
                  {selectedBranch.isActive === false ? 'Tạm ngưng' : 'Đang hoạt động'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.muted}>Điện thoại</Text>
                <Text style={styles.infoVal}>{selectedBranch.phone || 'Chưa cập nhật'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.muted}>Quản lý</Text>
                <Text style={styles.infoVal}>
                  {(selectedBranch.managerId && employeeNameById.get(selectedBranch.managerId)) ||
                    'Chưa chỉ định'}
                </Text>
              </View>
              <View style={{ gap: 4 }}>
                <Text style={styles.label}>Địa chỉ</Text>
                <Text style={styles.muted}>
                  {selectedBranch.address || 'Chưa cập nhật địa chỉ.'}
                </Text>
              </View>

              <View style={styles.locationBox}>
                <Text style={styles.locationTitle}>Cấu hình chấm công</Text>
                {selectedBranch.locationConfig ? (
                  <View style={{ gap: 6, marginTop: 4 }}>
                    <View style={styles.infoRow}>
                      <Text style={styles.muted}>Tọa độ (Vĩ độ, Kinh độ)</Text>
                      <Text style={styles.infoVal}>
                        {selectedBranch.locationConfig.latitude}, {selectedBranch.locationConfig.longitude}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.muted}>Bán kính cho phép</Text>
                      <Text style={styles.infoVal}>{selectedBranch.locationConfig.allowedRadius} m</Text>
                    </View>
                    <View style={{ gap: 4 }}>
                      <Text style={styles.muted}>IP công cộng được phép</Text>
                      <View style={styles.ipChipWrap}>
                        {(selectedBranch.locationConfig.allowedPublicIps || []).map((ip) => (
                          <Text key={ip} style={styles.ipChip}>
                            {ip}
                          </Text>
                        ))}
                      </View>
                    </View>
                  </View>
                ) : (
                  <Text style={[styles.muted, { marginTop: 4 }]}>
                    Chưa cấu hình vị trí GPS và IP mạng cho chi nhánh này.
                  </Text>
                )}
              </View>

              {canManage ? (
                <View style={{ gap: 8, marginTop: 8 }}>
                  <Pressable onPress={startEdit} style={styles.submitBtn}>
                    <Text style={styles.submitBtnText}>Chỉnh sửa chi nhánh</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setOwnerModalOpen(true)}
                    style={styles.secondaryBtn}
                  >
                    <View style={styles.iconButtonContent}><Plus size={13} color={colors.primary} /><Text style={styles.secondaryBtnText}>Tạo tài khoản Quản lý chi nhánh</Text></View>
                  </Pressable>
                </View>
              ) : null}
            </View>
          )
        ) : null}
      </FullScreenFormModal>

      {/* Create Branch Full-Screen Page */}
      <FullScreenFormModal
        visible={createOpen}
        title="Thêm chi nhánh mới"
        cancelLabel="Hủy"
        onSave={() => void onCreate()}
        saving={saving}
        onClose={() => setCreateOpen(false)}
      >
        <View style={{ gap: 8, paddingBottom: 12 }}>
          <Text style={styles.label}>Mã chi nhánh *</Text>
          <TextInput
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            placeholder="VD: CN_HN"
            placeholderTextColor={colors.muted}
            style={styles.field}
          />
          <Text style={styles.label}>Tên chi nhánh *</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="VD: Chi nhánh Hà Nội"
            placeholderTextColor={colors.muted}
            style={styles.field}
          />
          <Text style={styles.label}>Địa chỉ</Text>
          <TextInput
            value={address}
            onChangeText={setAddress}
            placeholder="Số nhà, đường, quận/huyện..."
            placeholderTextColor={colors.muted}
            style={styles.field}
          />
          <Text style={styles.label}>Số điện thoại</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="0987654321"
            placeholderTextColor={colors.muted}
            style={styles.field}
          />

          {renderLocationConfigEditor()}

          <Pressable
            disabled={saving}
            onPress={() => void onCreate()}
            style={[styles.submitBtn, saving && styles.disabled]}
          >
            <Text style={styles.submitBtnText}>{saving ? 'Đang tạo...' : 'Tạo chi nhánh'}</Text>
          </Pressable>
        </View>
      </FullScreenFormModal>

      {/* Create Branch Owner Full-Screen Page */}
      <FullScreenFormModal
        visible={ownerModalOpen}
        title="Tạo Quản lý chi nhánh"
        cancelLabel="Hủy"
        onSave={() => void onCreateOwner()}
        saving={savingOwner}
        onClose={() => setOwnerModalOpen(false)}
      >
        <View style={{ gap: 8 }}>
          <Text style={styles.label}>Họ và tên *</Text>
          <TextInput value={ownerName} onChangeText={setOwnerName} placeholder="Nguyễn Văn A" placeholderTextColor={colors.muted} style={styles.field} />
          <Text style={styles.label}>Email đăng nhập *</Text>
          <TextInput value={ownerEmail} onChangeText={setOwnerEmail} keyboardType="email-address" autoCapitalize="none" placeholder="quanly@congty.vn" placeholderTextColor={colors.muted} style={styles.field} />
          <Text style={styles.label}>Mật khẩu (≥ 6 ký tự) *</Text>
          <TextInput value={ownerPassword} onChangeText={setOwnerPassword} secureTextEntry placeholder="••••••" placeholderTextColor={colors.muted} style={styles.field} />
          <Text style={styles.label}>Số điện thoại</Text>
          <TextInput value={ownerPhone} onChangeText={setOwnerPhone} keyboardType="phone-pad" placeholder="0987654321" placeholderTextColor={colors.muted} style={styles.field} />
          <Pressable
            disabled={savingOwner}
            onPress={() => void onCreateOwner()}
            style={[styles.submitBtn, savingOwner && styles.disabled]}
          >
            <Text style={styles.submitBtnText}>
              {savingOwner ? 'Đang tạo...' : 'Tạo tài khoản'}
            </Text>
          </Pressable>
        </View>
      </FullScreenFormModal>

      <Modal
        visible={locationPermissionPrompt}
        transparent
        animationType="fade"
        onRequestClose={() => setLocationPermissionPrompt(false)}
      >
        <Pressable style={styles.dialogBackdrop} onPress={() => setLocationPermissionPrompt(false)}>
          <Pressable style={styles.dialogCard} onPress={() => {}}>
            <View style={[styles.dialogIconWrap, { backgroundColor: '#EAF2FF' }]}>
              <MapPin size={22} color={colors.primary} />
            </View>
            <Text style={styles.dialogTitle}>Cho phép truy cập vị trí</Text>
            <Text style={styles.dialogMessage}>
              ERP Mobile cần vị trí hiện tại để tự điền vĩ độ và kinh độ cho chi nhánh. Sau khi tiếp tục, hệ thống sẽ hỏi quyền truy cập vị trí. Tọa độ chỉ được dùng để cấu hình chấm công.
            </Text>
            <View style={styles.dialogActions}>
              <Pressable onPress={() => setLocationPermissionPrompt(false)} style={styles.dialogSecondaryBtn}>
                <Text style={styles.dialogSecondaryText}>Để sau</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setLocationPermissionPrompt(false);
                  void captureLocationAndIp();
                }}
                style={styles.dialogPrimaryBtn}
              >
                <Text style={styles.dialogPrimaryText}>Tiếp tục</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={Boolean(notice)} transparent animationType="fade" onRequestClose={() => setNotice(null)}>
        <Pressable style={styles.dialogBackdrop} onPress={() => setNotice(null)}>
          <Pressable style={styles.dialogCard} onPress={() => {}}>
            <View style={[styles.dialogIconWrap, { backgroundColor: noticeIconBackground }]}>
              <NoticeIcon size={22} color={noticeColor} />
            </View>
            <Text style={styles.dialogTitle}>{notice?.title}</Text>
            <Text style={styles.dialogMessage}>{notice?.message}</Text>
            <Pressable onPress={() => setNotice(null)} style={styles.dialogPrimaryBtn}>
              <Text style={styles.dialogPrimaryText}>Đóng</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
    {canManage ? <HrFab label="Thêm chi nhánh" onPress={openCreate} /> : null}
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
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  searchField: { flex: 1, backgroundColor: '#F6F8FC', borderColor: '#DCE5F2', borderWidth: 1, borderRadius: 99, paddingHorizontal: 14, height: 40, fontSize: 13.5, color: '#111827' },
  primaryBtn: { backgroundColor: colors.primary, minHeight: 40, paddingHorizontal: 13, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: colors.white, fontSize: 12.5, fontWeight: '600' },
  iconButtonContent: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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
    gap: 4,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  codeBadge: { color: colors.primary, backgroundColor: '#EAF2FF', fontSize: 10.5, fontWeight: '500', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
  mainBadge: { color: '#B45309', backgroundColor: '#FFF3E5', fontSize: 10.5, fontWeight: '500', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
  statusBadge: { color: '#16885A', backgroundColor: '#E9F8F1', fontSize: 10.5, fontWeight: '500', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
  statusInactive: { color: '#64748B', backgroundColor: '#F1F5F9' },
  rowTitle: { color: '#111827', fontSize: 14, fontWeight: '600' },
  muted: { color: '#6B7280', fontSize: 12.5, fontWeight: '400', lineHeight: 18 },
  subMeta: { color: '#6B7280', fontSize: 11.5, fontWeight: '400', marginTop: 2 },
  configOk: { color: '#16885A', fontWeight: '500' },
  configMissing: { color: '#B45309', fontWeight: '500' },
  chevron: { color: colors.muted, fontSize: 20 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.35)', justifyContent: 'center', padding: 16 },
  dialogBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.42)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  dialogCard: { width: '100%', maxWidth: 360, backgroundColor: colors.white, borderRadius: 20, overflow: 'hidden', padding: 22, alignItems: 'center', gap: 10 },
  dialogIconWrap: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  dialogTitle: { color: '#111827', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  dialogMessage: { color: '#6B7280', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  dialogActions: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 8 },
  dialogSecondaryBtn: { flex: 1, minHeight: 44, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  dialogSecondaryText: { color: '#374151', fontSize: 13, fontWeight: '600' },
  dialogPrimaryBtn: { width: '100%', minHeight: 44, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  dialogPrimaryText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  sheet: { backgroundColor: colors.white, borderRadius: 20, overflow: 'hidden', padding: 18, gap: 10, maxHeight: '90%' },
  sheetTitle: { color: '#111827', fontSize: 16, fontWeight: '600' },
  closeText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  label: { color: '#374151', fontSize: 12.5, fontWeight: '500', marginTop: 4 },
  smallLabel: { color: '#374151', fontSize: 11.5, fontWeight: '500', marginBottom: 4 },
  field: { backgroundColor: '#F6F8FC', borderColor: '#DCE5F2', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13.5, color: '#111827' },
  readonlyField: { backgroundColor: '#F1F5F9', color: '#6B7280' },
  locationBox: { backgroundColor: '#F5F9FF', borderColor: '#DCE7F7', borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12, marginTop: 6 },
  locationHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 },
  locationTitle: { color: '#111827', fontSize: 13, fontWeight: '600' },
  locationHint: { color: '#6B7280', fontSize: 11, marginTop: 2 },
  locateBtn: { backgroundColor: colors.primary, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 8 },
  locateBtnText: { color: colors.white, fontSize: 11.5, fontWeight: '600' },
  coordRow: { flexDirection: 'row', gap: 8 },
  locationField: { backgroundColor: colors.white, borderColor: '#DCE5F2', borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8, fontSize: 12.5, color: '#111827' },
  ipInput: { minHeight: 68, textAlignVertical: 'top', fontFamily: 'monospace' },
  ipHint: { color: '#6B7280', fontSize: 11, lineHeight: 16, marginTop: 5 },
  ipChipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  ipChip: { backgroundColor: colors.white, borderColor: '#DCE5F2', borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, fontSize: 11, color: '#111827', fontWeight: '500' },
  chip: { backgroundColor: colors.white, borderColor: '#E5EAF2', borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: '#6B7280', fontSize: 11.5, fontWeight: '500' },
  chipTextActive: { color: colors.white, fontWeight: '600' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EEF2F7' },
  infoVal: { color: '#111827', fontSize: 13.5, fontWeight: '500', flexShrink: 1, textAlign: 'right' },
  submitBtn: { backgroundColor: colors.primary, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  submitBtnText: { color: colors.white, fontSize: 13.5, fontWeight: '600' },
  secondaryBtn: { backgroundColor: '#EAF2FF', minHeight: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  cancelBtn: { backgroundColor: '#F1F5F9', minHeight: 44, paddingHorizontal: 18, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { color: '#374151', fontSize: 13, fontWeight: '600' },
  disabled: { opacity: 0.45 },
});
