import { withAppLockSuspended } from '@/core/auth/appLockSuspension';
import { CenteredPageLoader } from '@/components/BrandLoader';
import { IgenWorkerEmptyState } from '@/components/EmptyStateIllustration';
import {
  ModuleSectionSwitcher,
  useModuleSectionTransition,
  type ModuleSectionItem,
} from '@/components/ModuleSectionSwitcher';
import { BranchAppIcon } from '@/components/OverviewTabIcons';
import { PASTEL_BACKDROP_TOP_COLOR } from '@/components/PastelBackdrop';
import { PopupError } from '@/components/PopupError';
import { FullScreenFormModal } from '@/components/FullScreenFormModal';
import { HrFab } from '@/features/hr/components/HrFab';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import type { FeatureScreenProps } from '@/features/modules/featureScreenRegistry';
import { Stack } from 'expo-router';
import { ActivityIndicator, Alert, Animated, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import * as DocumentPicker from 'expo-document-picker';
import QRCode from 'react-native-qrcode-svg';
import { Bell, Briefcase, Check, ChevronDown, Download, FileText, FileUp, Pencil, Plus, QrCode, Search, Send, SlidersHorizontal, Trash2, Users, X } from 'lucide-react-native';
import { useAuth } from '@/core/auth/AuthProvider';
import { getErpWebUrl } from '@/core/network/erpWebLinks';
import { colors } from '@/theme/colors';
import { DateTimeField } from '@/features/quotation/DateTimeField';
import { createLaborReferral, listLaborCommissionPolicies, listLaborPartners, listLaborReferralsForWorker, updateLaborReferralStatus, type LaborCommissionPolicy, type LaborPartner, type LaborReferral } from '@/features/laborPartnersApi';
import { fetchCompanyBranches, type ErpBranch } from '@/features/overview/overviewApi';
import { saveAndShareExport } from '@/features/quotation/fileExport';
import {
  addWorkersToProject, adjustWorkerAttendance, bulkImportWorkers, bulkRemoveWorkers, closeWorkerQrSession, createWorkerNotification, createWorkerQrSession,
  getLaborContractAlerts, getLaborContractHistory, getWorkerQrStatus, getWorkerQrToken, listLaborContracts, listWorkerAttendance, listWorkerCompanies, listWorkerNotifications,
  listWorkerProjects, listWorkers, markWorkerAttendance, removeLaborContract, removeWorker, removeWorkerFromProject, removeWorkerProject, renewLaborContract,
  saveLaborContract, saveWorker, saveWorkerProject,
  type LaborContract, type LaborContractInput, type LaborContractStatus, type Worker, type WorkerAttendance, type WorkerInput,
  type WorkerLaborType, type WorkerNotification, type WorkerProject, type WorkerProjectInput, type WorkerScope,
} from '@/features/workerManagementApi';

type Tab = 'projects' | 'workers' | 'contracts' | 'notifications';

const WORKER_TAB_PALETTES: Record<Tab, { from: string; to: string; accent: string }> = {
  projects: { from: '#3E7EFF', to: '#1E54E8', accent: '#2860EE' },
  workers: { from: '#86DA1C', to: '#4BB60B', accent: '#5DC210' },
  contracts: { from: '#8E63FA', to: '#5E38E8', accent: '#6C42EE' },
  notifications: { from: '#FF9E2C', to: '#EB6209', accent: '#F27814' },
};

function WorkerTabIcon({ id, size = 24 }: { id: Tab; size?: number }) {
  const palette = WORKER_TAB_PALETTES[id];
  const gradId = `worker_tab_bg_${id}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56" fill="none">
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor={palette.from} />
          <Stop offset="100%" stopColor={palette.to} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="56" height="56" rx="15.5" fill={`url(#${gradId})`} />
      {id === 'projects' ? (
        <>
          <Path
            d="M22 18.8V16.8C22 15.1 23.4 13.8 25 13.8H31C32.6 13.8 34 15.1 34 16.8V18.8"
            stroke="#FFFFFF"
            strokeOpacity={0.82}
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
          <Rect x="13" y="18.8" width="30" height="22.4" rx="5.5" fill="#FFFFFF" />
          <Path d="M13 27.6H43" stroke={palette.accent} strokeOpacity={0.3} strokeWidth="2.2" />
          <Rect x="24.2" y="25.2" width="7.6" height="5.2" rx="2.2" fill={palette.accent} />
        </>
      ) : id === 'workers' ? (
        <>
          <Path
            d="M16.5 28.5V26.2C16.5 20.1 21.4 15.2 27.5 15.2H28.5C34.6 15.2 39.5 20.1 39.5 26.2V28.5H16.5Z"
            fill="#FFFFFF"
          />
          <Rect x="26.1" y="13.5" width="3.8" height="10.5" rx="1.9" fill="#FFFFFF" />
          <Rect x="13.2" y="27.2" width="29.6" height="4.1" rx="2.05" fill="#FFFFFF" />
          <Path
            d="M18.2 34.8C20.5 38.4 24 40.3 28 40.3C32 40.3 35.5 38.4 37.8 34.8"
            stroke="#FFFFFF"
            strokeOpacity={0.88}
            strokeWidth="3.6"
            strokeLinecap="round"
            fill="none"
          />
        </>
      ) : id === 'contracts' ? (
        <>
          <Path
            d="M16 17.2C16 14.6 18.1 12.5 20.7 12.5H31.2L39.5 20.8V38.8C39.5 41.4 37.4 43.5 34.8 43.5H20.7C18.1 43.5 16 41.4 16 38.8V17.2Z"
            fill="#FFFFFF"
          />
          <Path
            d="M31.2 12.5V18.3C31.2 19.7 32.3 20.8 33.7 20.8H39.5L31.2 12.5Z"
            fill={palette.accent}
            fillOpacity={0.35}
          />
          <Rect x="20.8" y="24" width="13.4" height="2.7" rx="1.35" fill={palette.accent} />
          <Rect x="20.8" y="29.5" width="9.5" height="2.7" rx="1.35" fill={palette.accent} fillOpacity={0.72} />
          <Rect x="20.8" y="35" width="6.5" height="2.7" rx="1.35" fill={palette.accent} fillOpacity={0.5} />
        </>
      ) : (
        <>
          <Path
            d="M28 13.5C22.8 13.5 19 17.4 19 22.5V28.4L16.3 32.4C15.7 33.3 16.3 34.5 17.4 34.5H38.6C39.7 34.5 40.3 33.3 39.7 32.4L37 28.4V22.5C37 17.4 33.2 13.5 28 13.5Z"
            fill="#FFFFFF"
          />
          <Path
            d="M24.2 37.5C24.8 39.6 26.3 41 28 41C29.7 41 31.2 39.6 31.8 37.5H24.2Z"
            fill="#FFFFFF"
            fillOpacity={0.86}
          />
          <Circle cx="35.8" cy="18.2" r="3.4" fill={palette.accent} />
          <Circle cx="35.8" cy="18.2" r="2.2" fill="#FFFFFF" />
        </>
      )}
    </Svg>
  );
}

const workerSections: ReadonlyArray<ModuleSectionItem<Tab>> = [
  {
    key: 'projects',
    label: 'Dự án',
    subtitle: 'Dự án, phân công & điểm danh QR',
    renderIcon: (size) => <WorkerTabIcon id="projects" size={size} />,
  },
  {
    key: 'workers',
    label: 'Lao động',
    subtitle: 'Hồ sơ, phân loại & nhập xuất CSV',
    renderIcon: (size) => <WorkerTabIcon id="workers" size={size} />,
  },
  {
    key: 'contracts',
    label: 'Hợp đồng',
    subtitle: 'Hợp đồng, gia hạn & cảnh báo',
    renderIcon: (size) => <WorkerTabIcon id="contracts" size={size} />,
  },
  {
    key: 'notifications',
    label: 'Thông báo',
    subtitle: 'Thông báo gửi tới lao động',
    renderIcon: (size) => <WorkerTabIcon id="notifications" size={size} />,
  },
];
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
function shiftDateKey(value: string, days: number) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return today();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
function addCalendarYear(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (![year, month, day].every(Number.isFinite)) return today();
  const targetYear = year + 1;
  const lastDay = new Date(Date.UTC(targetYear, month, 0)).getUTCDate();
  return `${targetYear}-${String(month).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}
const workerStatusLabel = (value: string) => ({ active: 'Đang tuyển', inactive: 'Ngừng xử lý', placed: 'Đã trúng tuyển' } as Record<string, string>)[value] || value;
const laborTypeLabel = (value?: string) => ({ official: 'Chính thức', seasonal: 'Thời vụ', foreign: 'Người nước ngoài' } as Record<string, string>)[value || ''] || 'Chưa phân loại';
const contractStatusLabel = (value: LaborContractStatus) => ({ draft: 'Nháp', active: 'Đang hiệu lực', renewed: 'Đã gia hạn', expired: 'Hết hạn', terminated: 'Đã chấm dứt' } as const)[value];
function formatNotificationDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}
const blankWorker = (): WorkerInput => ({ fullName: '', phone: '', email: '', idCard: '', birthday: '', address: '', status: 'active', laborType: 'official', nationality: '', workPermitNumber: '', workPermitExpiry: '', registrationDate: today(), note: '' });
const blankProject = (): WorkerProjectInput => ({ code: '', name: '', quota: 0, workerIds: [], daysOfWeek: [1, 2, 3, 4, 5], startTime: '08:00', endTime: '17:00', location: '', geoLocation: null, startDate: today(), endDate: today(), status: 'planned', note: '' });
const blankContract = (): LaborContractInput => ({ workerId: '', code: '', clientName: '', startDate: today(), endDate: today(), status: 'draft', note: '' });
const normalize = (value: string) => value.trim().toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');

function parseCsv(text: string) {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') { cell += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && text[i + 1] === '\n') i += 1; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
function csv(rows: unknown[][]) { return '\uFEFF' + rows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n'); }

export function WorkerManagementScreen(_props: FeatureScreenProps) {
  const { user, activeBranchId, setActiveBranchId } = useAuth();
  const canManage = Boolean(user?.role === 'admin' || user?.role === 'superadmin' || user?.permissions?.includes('*') || user?.permissions?.includes('people:manage'));
  const canRead = canManage || Boolean(user?.permissions?.includes('people:read'));
  const isSuperAdmin = user?.role === 'superadmin';
  const canSwitchBranch = user?.role === 'admin' || isSuperAdmin;
  const [companies, setCompanies] = useState<Array<{ code: string; name: string }>>([]);
  const [companyCode, setCompanyCode] = useState(user?.companyCode || '');
  const [companyPickerOpen, setCompanyPickerOpen] = useState(false);
  const [branches, setBranches] = useState<ErpBranch[]>([]);
  const [branchPickerOpen, setBranchPickerOpen] = useState(false);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const branchId = activeBranchId || user?.branchId || undefined;
  const branchName = branchId
    ? branches.find((branch) => branch._id === branchId)?.name || (branchId === user?.branchId ? user?.branchName : undefined) || 'Chọn chi nhánh'
    : 'Chọn chi nhánh';
  const scope = useMemo<WorkerScope | undefined>(() => companyCode ? { companyCode, ...(activeBranchId || user?.branchId ? { branchId: activeBranchId || user?.branchId } : {}) } : undefined, [activeBranchId, companyCode, user?.branchId]);
  const [tab, setTab] = useState<Tab>('projects');
  const sectionTransition = useModuleSectionTransition(tab);
  const handleTabChange = useCallback((nextTab: Tab) => {
    setTab(nextTab);
  }, []);
  const [workers, setWorkers] = useState<Worker[]>([]); const [projects, setProjects] = useState<WorkerProject[]>([]);
  const [contracts, setContracts] = useState<LaborContract[]>([]); const [notifications, setNotifications] = useState<WorkerNotification[]>([]);
  const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState(''); const [statusFilter, setStatusFilter] = useState('all'); const [laborTypeFilter, setLaborTypeFilter] = useState('all'); const [workerProjectFilter, setWorkerProjectFilter] = useState('all');
  const [projectStatusSheetOpen, setProjectStatusSheetOpen] = useState(false);
  const [registrationFrom, setRegistrationFrom] = useState(''); const [registrationTo, setRegistrationTo] = useState('');
  const [workerFiltersOpen, setWorkerFiltersOpen] = useState(false);
  const [workerModal, setWorkerModal] = useState(false); const [editingWorker, setEditingWorker] = useState<Worker | null>(null); const [workerForm, setWorkerForm] = useState<WorkerInput>(blankWorker()); const [workerDetail, setWorkerDetail] = useState<Worker | null>(null);
  const [laborPartners, setLaborPartners] = useState<LaborPartner[]>([]); const [laborPartnerPolicies, setLaborPartnerPolicies] = useState<LaborCommissionPolicy[]>([]); const [laborPartnersLoading, setLaborPartnersLoading] = useState(false); const [laborPartnerLoadError, setLaborPartnerLoadError] = useState(''); const [workerPartnerId, setWorkerPartnerId] = useState(''); const [laborPartnerPickerOpen, setLaborPartnerPickerOpen] = useState(false); const [laborPartnerSearch, setLaborPartnerSearch] = useState(''); const [workerFormError, setWorkerFormError] = useState('');
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]); const [importProjectId, setImportProjectId] = useState(''); const [importPreview, setImportPreview] = useState<Array<{ row: number; worker: { fullName: string; phone: string; partnerCode?: string; email?: string; idCard?: string; birthday?: string; address?: string; note?: string; registrationDate?: string; laborType?: WorkerLaborType; commissionScheme?: 'official_monthly' | 'seasonal_hourly'; nationality?: string; workPermitNumber?: string; workPermitExpiry?: string }; error?: string }> | null>(null);
  const [projectModal, setProjectModal] = useState(false); const [editingProject, setEditingProject] = useState<WorkerProject | null>(null); const [projectForm, setProjectForm] = useState<WorkerProjectInput>(blankProject()); const [projectDetail, setProjectDetail] = useState<WorkerProject | null>(null); const [projectWorkerPicker, setProjectWorkerPicker] = useState(false); const [projectWorkerSelection, setProjectWorkerSelection] = useState<string[]>([]);
  const [projectSearch, setProjectSearch] = useState(''); const [projectStatusFilter, setProjectStatusFilter] = useState('all');
  const [attendanceProject, setAttendanceProject] = useState<WorkerProject | null>(null); const [attendance, setAttendance] = useState<WorkerAttendance[]>([]); const [attendanceFrom, setAttendanceFrom] = useState(today().slice(0, 7) + '-01'); const [attendanceTo, setAttendanceTo] = useState(today()); const [attendanceEdit, setAttendanceEdit] = useState<WorkerAttendance | null>(null); const [attendanceCheckIn, setAttendanceCheckIn] = useState(''); const [attendanceCheckOut, setAttendanceCheckOut] = useState(''); const [attendanceNote, setAttendanceNote] = useState(''); const [qrSession, setQrSession] = useState<{ id: string; checkinUrl: string; expiresAt: number } | null>(null); const [qrCheckedIn, setQrCheckedIn] = useState(0); const [qrWorkers, setQrWorkers] = useState<Array<{ workerId: string; fullName: string; phone: string; checkinAt: number }>>([]);
  const [contractSearch, setContractSearch] = useState(''); const [contractStatus, setContractStatus] = useState('all'); const [contractAlertOnly, setContractAlertOnly] = useState(false); const [contractClient, setContractClient] = useState('all'); const [contractClients, setContractClients] = useState<string[]>([]); const [contractAlerts, setContractAlerts] = useState<{ expiringCount: number; expiredCount: number } | null>(null);
  const [contractFiltersOpen, setContractFiltersOpen] = useState(false);
  const [contractModal, setContractModal] = useState<'create' | 'edit' | 'renew' | null>(null); const [editingContract, setEditingContract] = useState<LaborContract | null>(null); const [contractForm, setContractForm] = useState<LaborContractInput>(blankContract()); const [contractHistory, setContractHistory] = useState<LaborContract[] | null>(null);
  const [notificationTitle, setNotificationTitle] = useState(''); const [notificationContent, setNotificationContent] = useState(''); const [notificationModal, setNotificationModal] = useState(false); const [notificationError, setNotificationError] = useState('');

  useEffect(() => {
    if (!isSuperAdmin) { setCompanyCode(user?.companyCode || ''); return; }
    let alive = true;
    void listWorkerCompanies().then((items) => {
      if (!alive) return;
      const valid = items.filter((item): item is { code: string; name: string } => Boolean(item.code)).map((item) => ({ code: item.code!, name: item.name || item.code! }));
      setCompanies(valid); setCompanyCode((current) => current || user?.companyCode || valid[0]?.code || '');
    }).catch((cause) => { if (alive) setError(cause instanceof Error ? cause.message : 'Không tải được danh sách cơ sở.'); });
    return () => { alive = false; };
  }, [isSuperAdmin, user?.companyCode]);

  useEffect(() => {
    if (!canSwitchBranch || !companyCode) {
      setBranches([]);
      return;
    }
    const controller = new AbortController();
    setBranchesLoading(true);
    void fetchCompanyBranches(controller.signal, companyCode).then((list) => {
      if (controller.signal.aborted) return;
      setBranches(list);
      setActiveBranchId((current) => {
        if (current && list.some((branch) => branch._id === current)) return current;
        if (user?.branchId && list.some((branch) => branch._id === user.branchId)) return user.branchId;
        return list[0]?._id;
      });
    }).catch((cause) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Không tải được danh sách chi nhánh.');
    }).finally(() => {
      if (!controller.signal.aborted) setBranchesLoading(false);
    });
    return () => controller.abort();
  }, [canSwitchBranch, companyCode, setActiveBranchId, user?.branchId]);

  const loadWorkers = useCallback(async () => { if (!scope) return; setWorkers(await listWorkers(scope)); }, [scope]);
  const loadProjects = useCallback(async () => { if (!scope) return; setProjects(await listWorkerProjects(scope, { page: 1, limit: 100 })); }, [scope]);
  const loadContracts = useCallback(async () => {
    if (!scope) return;
    const [list, alerts] = await Promise.all([listLaborContracts(scope, { page: 1, limit: 100, search: contractSearch || undefined, status: contractStatus === 'all' ? undefined : contractStatus, alert: contractAlertOnly ? 'any' : undefined, clientName: contractClient === 'all' ? undefined : contractClient }), getLaborContractAlerts(scope)]);
    setContracts(list.data || []); setContractClients(list.clients || []); setContractAlerts(alerts ? { expiringCount: alerts.expiringCount, expiredCount: alerts.expiredCount } : null);
  }, [contractAlertOnly, contractClient, contractSearch, contractStatus, scope]);
  const loadNotifications = useCallback(async () => setNotifications(await listWorkerNotifications(scope)), [scope]);
  const loadActive = useCallback(async (showSpinner = true) => {
    if (!canRead) { setLoading(false); setRefreshing(false); return; }
    if (!scope && tab !== 'notifications') { setError(isSuperAdmin ? 'Chọn cơ sở để tải dữ liệu lao động.' : 'Tài khoản chưa có mã công ty.'); setLoading(false); setRefreshing(false); return; }
    if (showSpinner) setLoading(true); setError('');
    try {
      if (tab === 'workers') await Promise.all([loadWorkers(), loadProjects()]);
      else if (tab === 'projects') await Promise.all([loadProjects(), loadWorkers()]);
      else if (tab === 'contracts') { await Promise.all([loadContracts(), loadWorkers()]); }
      else await loadNotifications();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được dữ liệu phân hệ Lao động.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [canRead, isSuperAdmin, loadContracts, loadNotifications, loadProjects, loadWorkers, scope, tab]);
  useEffect(() => { void loadActive(); }, [loadActive]);
  useEffect(() => {
    if (!qrSession) return;
    let active = true;
    const poll = async () => {
      try {
        const status = await getWorkerQrStatus(scope, qrSession.id);
        if (active && status) { setQrCheckedIn(status.checkedIn || 0); setQrWorkers(status.workers || []); if (status.closed) setQrSession(null); }
      } catch { /* Poll errors should not interrupt the active QR session. */ }
    };
    void poll();
    const timer = setInterval(() => { void poll(); }, 4000);
    const expiry = setTimeout(() => { if (active) { setQrSession(null); setQrCheckedIn(0); setQrWorkers([]); } }, Math.max(0, qrSession.expiresAt - Date.now()));
    return () => { active = false; clearInterval(timer); clearTimeout(expiry); };
  }, [qrSession, scope]);
  const refresh = () => { setRefreshing(true); void loadActive(false); };

  const activeLaborPartners = useMemo(() => laborPartners.filter((partner) => partner.status === 'active'), [laborPartners]);
  const selectedLaborPartner = activeLaborPartners.find((partner) => partner._id === workerPartnerId);
  useEffect(() => {
    if (!workerModal) return;
    if (!scope) { setLaborPartners([]); setLaborPartnerPolicies([]); setLaborPartnerLoadError('Chưa chọn phạm vi công ty/chi nhánh.'); return; }
    let alive = true;
    setLaborPartnersLoading(true);
    setLaborPartnerLoadError('');
    void Promise.all([listLaborPartners(scope), listLaborCommissionPolicies(scope)]).then(([partners, policies]) => {
      if (!alive) return;
      setLaborPartners(partners);
      setLaborPartnerPolicies(policies);
    }).catch((cause) => {
      if (alive) { setLaborPartners([]); setLaborPartnerPolicies([]); setLaborPartnerLoadError(cause instanceof Error ? cause.message : 'Không tải được danh sách đối tác lao động.'); }
    }).finally(() => { if (alive) setLaborPartnersLoading(false); });
    return () => { alive = false; };
  }, [scope, workerModal]);
  useEffect(() => {
    if (!workerModal) return;
    if (!editingWorker) { setWorkerPartnerId(''); return; }
    const partner = laborPartners.find((item) => item.code === editingWorker.partnerCode || item.name === editingWorker.partnerName);
    setWorkerPartnerId(partner?._id || '');
  }, [editingWorker, laborPartners, workerModal]);
  const visibleWorkers = useMemo(() => workers.filter((worker) => {
    const query = search.trim().toLocaleLowerCase('vi');
    const matchesSearch = !query || `${worker.fullName} ${worker.phone || ''} ${worker.email || ''} ${worker.idCard || ''}`.toLocaleLowerCase('vi').includes(query);
    const matchesProject = workerProjectFilter === 'all' || worker.projectIds?.includes(workerProjectFilter);
    const registrationDate = worker.registrationDate?.slice(0, 10) || '';
    const matchesDate = (!registrationFrom || registrationDate >= registrationFrom) && (!registrationTo || registrationDate <= registrationTo);
    return matchesSearch && matchesProject && matchesDate && (statusFilter === 'all' || worker.status === statusFilter) && (laborTypeFilter === 'all' || worker.laborType === laborTypeFilter);
  }), [laborTypeFilter, registrationFrom, registrationTo, search, statusFilter, workerProjectFilter, workers]);
  const visibleProjects = useMemo(() => projects.filter((project) => {
    const query = projectSearch.trim().toLocaleLowerCase('vi');
    return (!query || `${project.code} ${project.name} ${project.location || ''}`.toLocaleLowerCase('vi').includes(query)) && (projectStatusFilter === 'all' || project.status === projectStatusFilter);
  }), [projectSearch, projectStatusFilter, projects]);
  const contractWorkersAvailable = useMemo(() => {
    if (contractModal !== 'create') return workers;
    const todayValue = today();
    const assigned = new Set(contracts.filter((contract) => ['draft', 'active'].includes(contract.status) && contract.endDate.slice(0, 10) >= todayValue).map((contract) => contract.workerId));
    return workers.filter((worker) => !assigned.has(worker._id));
  }, [contractModal, contracts, workers]);

  function openWorkerCreate() { setEditingWorker(null); setWorkerForm(blankWorker()); setWorkerPartnerId(''); setWorkerFormError(''); setWorkerModal(true); }
  function openWorkerEdit(worker: Worker) { const { _id, partnerCode, partnerName, projectIds, ...input } = worker; void _id; void partnerCode; void partnerName; void projectIds; setWorkerDetail(null); setEditingWorker(worker); setWorkerForm({ ...blankWorker(), ...input, projectId: '' }); setWorkerFormError(''); setWorkerModal(true); }
  async function saveWorkerForm() {
    if (!scope || !workerForm.fullName.trim() || !workerForm.phone?.trim()) { setWorkerFormError('Nhập họ tên và số điện thoại lao động.'); return; }
    const selectedPartner = workerPartnerId ? activeLaborPartners.find((partner) => partner._id === workerPartnerId) : undefined;
    if (workerPartnerId && !selectedPartner) { setWorkerFormError('Đối tác giới thiệu không còn hoạt động hoặc không tồn tại.'); return; }
    setBusy(true);
    setWorkerFormError('');
    setError('');
    try {
      let currentReferral: LaborReferral | undefined;
      let currentPartnerId = '';
      if (editingWorker && !laborPartnerLoadError) {
        const referrals = await listLaborReferralsForWorker(scope, editingWorker._id);
        currentReferral = referrals.find((referral) => referral.status === 'pending' || referral.status === 'active');
        if (currentReferral) currentPartnerId = typeof currentReferral.partnerId === 'string' ? currentReferral.partnerId : currentReferral.partnerId._id;
      }
      const nextPartnerId = selectedPartner?._id || '';
      const referralChanged = editingWorker ? !laborPartnerLoadError && currentPartnerId !== nextPartnerId : Boolean(selectedPartner);
      let referralSettings: { policyId: string; commissionScheme: 'official_monthly' | 'seasonal_hourly' } | undefined;
      if (selectedPartner && referralChanged) {
        const commissionScheme = workerForm.laborType === 'seasonal' ? 'seasonal_hourly' : 'official_monthly';
        const configuredPolicy = (commissionScheme === 'seasonal_hourly' ? selectedPartner.defaultSeasonalPolicyId : selectedPartner.defaultOfficialPolicyId) || selectedPartner.defaultPolicyId;
        const configuredPolicyId = typeof configuredPolicy === 'string' ? configuredPolicy : configuredPolicy?._id || '';
        const compatiblePolicy = laborPartnerPolicies.find((policy) => policy._id === configuredPolicyId && policy.status === 'active' && (commissionScheme === 'seasonal_hourly' ? policy.seasonal.enabled : policy.official.enabled));
        if (!compatiblePolicy) {
          setWorkerFormError('Đối tác chưa có chính sách hoa hồng đang hoạt động phù hợp với loại lao động này. Hãy cấu hình chính sách trước.');
          return;
        }
        referralSettings = { policyId: compatiblePolicy._id, commissionScheme };
      }
      const savedWorker = await saveWorker(scope, { ...workerForm, fullName: workerForm.fullName.trim(), phone: workerForm.phone.trim() }, editingWorker?._id);
      let referralError = '';
      if (referralChanged) {
        try {
          if (currentReferral && currentPartnerId) {
            const currentEffectiveFrom = currentReferral.effectiveFrom.slice(0, 10);
            const effectiveTo = today() < currentEffectiveFrom ? currentEffectiveFrom : today();
            await updateLaborReferralStatus(scope, currentPartnerId, currentReferral._id, 'end', effectiveTo);
          }
          if (selectedPartner && referralSettings) {
            const effectiveDate = (workerForm.registrationDate || today()).slice(0, 10);
            await createLaborReferral(scope, selectedPartner._id, { workerId: savedWorker._id, policyId: referralSettings.policyId, commissionScheme: referralSettings.commissionScheme, referredAt: effectiveDate, employmentStartDate: effectiveDate, effectiveFrom: effectiveDate, confirmationSource: 'manual' });
          }
        } catch (cause) {
          referralError = cause instanceof Error ? cause.message : 'Không cập nhật được đối tác giới thiệu.';
        }
      }
      if (referralError && !editingWorker) {
        setWorkerModal(false);
        setEditingWorker(null);
        await Promise.all([loadWorkers(), loadProjects()]).catch(() => undefined);
        Alert.alert('Đã lưu hồ sơ lao động', `Hồ sơ đã được tạo nhưng chưa gắn được đối tác giới thiệu: ${referralError}`);
        return;
      }
      if (referralError) {
        setWorkerFormError(`Hồ sơ đã lưu nhưng chưa cập nhật được đối tác giới thiệu: ${referralError}`);
        await Promise.all([loadWorkers(), loadProjects()]).catch(() => undefined);
        return;
      }
      setWorkerModal(false);
      setEditingWorker(null);
      setWorkerPartnerId('');
      await Promise.all([loadWorkers(), loadProjects()]);
    } catch (cause) {
      setWorkerFormError(cause instanceof Error ? cause.message : 'Không lưu được hồ sơ lao động.');
    } finally {
      setBusy(false);
    }
  }
  function confirmWorkerDelete(worker: Worker) { Alert.alert('Xóa hồ sơ lao động?', `Xóa ${worker.fullName}?`, [{ text: 'Hủy', style: 'cancel' }, { text: 'Xóa', style: 'destructive', onPress: async () => { if (!scope) return; setBusy(true); try { await removeWorker(scope, worker._id); setWorkerDetail(null); await loadWorkers(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không xóa được hồ sơ.'); } finally { setBusy(false); } } }]); }
  async function deleteSelectedWorkers() {
    if (!scope || !selectedWorkerIds.length) return;
    Alert.alert('Xóa lao động đã chọn?', `Xóa ${selectedWorkerIds.length} hồ sơ?`, [{ text: 'Hủy', style: 'cancel' }, { text: 'Xóa', style: 'destructive', onPress: async () => { setBusy(true); try { await bulkRemoveWorkers(scope, selectedWorkerIds); setSelectedWorkerIds([]); await loadWorkers(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không xóa được các hồ sơ đã chọn.'); } finally { setBusy(false); } } }]);
  }
  async function exportWorkers() {
    const header = ['Họ tên', 'Điện thoại', 'Mã đối tác giới thiệu', 'Ngày sinh', 'CCCD/CMND', 'Email', 'Địa chỉ', 'Ngày tiếp nhận', 'Loại lao động', 'Quốc tịch', 'Số GPLĐ/visa', 'Ngày hết hạn GPLĐ/visa', 'Ghi chú', 'Trạng thái'];
    await saveAndShareExport(new TextEncoder().encode(csv([header, ...visibleWorkers.map((worker) => [worker.fullName, worker.phone, worker.partnerCode, worker.birthday, worker.idCard, worker.email, worker.address, worker.registrationDate, laborTypeLabel(worker.laborType), worker.nationality, worker.workPermitNumber, worker.workPermitExpiry, worker.note, workerStatusLabel(worker.status)])])), 'danh-sach-lao-dong.csv', 'text/csv;charset=utf-8');
  }
  async function exportWorkerTemplate() {
    const header = ['Họ và tên', 'Số điện thoại', 'Mã đối tác giới thiệu', 'Ngày sinh', 'CCCD / CMND', 'Email', 'Địa chỉ', 'Ngày tiếp nhận', 'Loại lao động', 'Cơ chế hoa hồng (tùy chọn)', 'Quốc tịch', 'Số GPLĐ / visa', 'Ngày hết hạn GPLĐ / visa', 'Ghi chú'];
    await saveAndShareExport(new TextEncoder().encode(csv([header])), 'mau-nhap-lao-dong.csv', 'text/csv;charset=utf-8');
  }
  async function chooseWorkerImport() {
    if (!scope) return;
    try {
      const picked = await withAppLockSuspended(() => DocumentPicker.getDocumentAsync({ type: ['text/csv'], copyToCacheDirectory: true }));
      if (picked.canceled) return;
      const asset = picked.assets[0]; if (!asset || !/\.csv$/i.test(asset.name)) throw new Error('Chọn tệp CSV để nhập lao động.');
      const response = await fetch(asset.uri); if (!response.ok) throw new Error('Không đọc được tệp trên thiết bị.');
      const rows = parseCsv(new TextDecoder().decode(await response.arrayBuffer())); const headers = (rows.shift() || []).map(normalize);
      const findColumn = (...names: string[]) => headers.findIndex((value) => names.includes(value));
      const nameIndex = findColumn('ho ten', 'ho va ten', 'ten lao dong', 'full name', 'fullname');
      const phoneIndex = findColumn('dien thoai', 'so dien thoai', 'phone', 'sdt');
      if (nameIndex < 0 || phoneIndex < 0) throw new Error('File cần cột Họ tên và Điện thoại.');
      const columns = {
        partnerCode: findColumn('ma doi tac gioi thieu', 'ma doi tac', 'partner code'), email: findColumn('email', 'thu dien tu'),
        idCard: findColumn('cccd', 'cmnd', 'cccd cmnd', 'so giay to'), birthday: findColumn('ngay sinh', 'birthday'),
        address: findColumn('dia chi', 'address'), registrationDate: findColumn('ngay tiep nhan', 'ngay dang ky', 'registration date'),
        laborType: findColumn('loai lao dong', 'labor type'), commissionScheme: findColumn('co che hoa hong', 'commission scheme'),
        nationality: findColumn('quoc tich', 'nationality'), workPermitNumber: findColumn('so gpld visa', 'so gpld', 'giay phep lao dong', 'visa'),
        workPermitExpiry: findColumn('ngay het han gpld visa', 'han gpld', 'ngay het han', 'work permit expiry'), note: findColumn('ghi chu', 'note'),
      };
      const cell = (row: string[], index: number) => index < 0 ? '' : String(row[index] || '').trim();
      const preview = rows.map((row, index) => {
        const laborTypeRaw = normalize(cell(row, columns.laborType));
        const laborType = laborTypeRaw.includes('thoi vu') || laborTypeRaw === 'seasonal' ? 'seasonal' : laborTypeRaw.includes('nuoc ngoai') || laborTypeRaw === 'foreign' ? 'foreign' : 'official';
        const commissionRaw = normalize(cell(row, columns.commissionScheme));
        const commissionInvalid = Boolean(commissionRaw) && !['chinh thuc', 'official_monthly', 'thoi vu', 'seasonal_hourly'].some((value) => commissionRaw.includes(value));
        const commissionScheme = commissionRaw ? (commissionRaw.includes('thoi vu') || commissionRaw === 'seasonal_hourly' ? 'seasonal_hourly' : 'official_monthly') : undefined;
        const worker = {
          fullName: cell(row, nameIndex), phone: cell(row, phoneIndex), partnerCode: cell(row, columns.partnerCode).toUpperCase(),
          email: cell(row, columns.email), idCard: cell(row, columns.idCard), birthday: cell(row, columns.birthday), address: cell(row, columns.address),
          registrationDate: cell(row, columns.registrationDate), laborType, ...(commissionScheme ? { commissionScheme } : {}), nationality: cell(row, columns.nationality),
          workPermitNumber: cell(row, columns.workPermitNumber), workPermitExpiry: cell(row, columns.workPermitExpiry), note: cell(row, columns.note),
        };
        return { row: index + 2, worker, error: !worker.fullName || !worker.phone ? 'Thiếu họ tên hoặc số điện thoại.' : commissionInvalid ? 'Cơ chế hoa hồng chỉ nhận Chính thức hoặc Thời vụ.' : undefined };
      }).filter((item) => item.worker.fullName || item.worker.phone);
      setImportProjectId('');
      setImportPreview(preview);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không đọc được tệp nhập.'); }
  }
  async function commitWorkerImport() {
    if (!scope || !importPreview) return;
    const valid = importPreview.filter((item) => !item.error).map((item) => item.worker);
    if (!valid.length) return;
    setBusy(true);
    try {
      const result = await bulkImportWorkers(scope, valid, importProjectId || undefined);
      setImportPreview(null);
      const details = [
        `Đã nhập ${result.importedCount}; bỏ qua ${result.skippedCount}; lỗi ${result.errors?.length || 0}.`,
        ...(result.errors || []).slice(0, 4).map((item) => `Dòng ${item.row}: ${item.reason}`),
        ...(result.referralErrors || []).slice(0, 3).map((item) => `Đối tác ${item.partnerCode}: ${item.reason}`),
      ].join('\n');
      Alert.alert('Kết quả nhập lao động', details);
      await loadWorkers();
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không nhập được danh sách lao động.'); }
    finally { setBusy(false); }
  }

  function openProjectCreate() { setEditingProject(null); setProjectForm(blankProject()); setProjectModal(true); }
  function openProjectEdit(project: WorkerProject) {
    setProjectDetail(null);
    setEditingProject(project);
    setProjectForm({
      ...blankProject(),
      code: project.code,
      name: project.name,
      quota: project.quota,
      workerIds: Array.isArray(project.workerIds) ? project.workerIds : [],
      daysOfWeek: Array.isArray(project.daysOfWeek) ? project.daysOfWeek : blankProject().daysOfWeek,
      startTime: project.startTime || '08:00',
      endTime: project.endTime || '17:00',
      location: project.location || '',
      geoLocation: project.geoLocation || null,
      startDate: project.startDate || today(),
      endDate: project.endDate || today(),
      status: project.status || 'planned',
      note: project.note || '',
    });
    setProjectModal(true);
  }
  async function saveProjectForm() {
    if (!scope || !projectForm.code.trim() || !projectForm.name.trim()) { setError('Mã và tên dự án là bắt buộc.'); return; }
    setBusy(true); setError('');
    try { await saveWorkerProject(scope, { ...projectForm, code: projectForm.code.trim(), name: projectForm.name.trim(), quota: Number(projectForm.quota) || 0 }, editingProject?._id); setProjectModal(false); await loadProjects(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không lưu được dự án.'); }
    finally { setBusy(false); }
  }
  async function saveProjectWorkers() {
    if (!scope || !projectDetail || !projectWorkerSelection.length) return;
    setBusy(true);
    try { const updated = await addWorkersToProject(scope, projectDetail._id, projectWorkerSelection); if (updated) setProjectDetail(updated); setProjectWorkerPicker(false); setProjectWorkerSelection([]); await Promise.all([loadProjects(), loadWorkers()]); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thêm được lao động vào dự án.'); }
    finally { setBusy(false); }
  }
  async function detachWorker(project: WorkerProject, workerId: string) {
    if (!scope) return;
    try { const updated = await removeWorkerFromProject(scope, project._id, workerId); if (updated) setProjectDetail(updated); await Promise.all([loadProjects(), loadWorkers()]); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không gỡ được lao động khỏi dự án.'); }
  }
  function confirmProjectDelete(project: WorkerProject) { Alert.alert('Xóa dự án?', `Xóa dự án ${project.name}?`, [{ text: 'Hủy', style: 'cancel' }, { text: 'Xóa', style: 'destructive', onPress: async () => { if (!scope) return; try { await removeWorkerProject(scope, project._id); setProjectDetail(null); await loadProjects(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không xóa được dự án.'); } } }]); }
  async function openAttendance(project: WorkerProject) { setAttendanceProject(project); setQrSession(null); setQrCheckedIn(0); setQrWorkers([]); await loadAttendance(project._id); }
  async function loadAttendance(projectId = attendanceProject?._id) {
    if (!projectId) return;
    try { const response = await listWorkerAttendance(scope, projectId, attendanceFrom, attendanceTo); setAttendance(response.data || []); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được chấm công dự án.'); }
  }
  function openAttendanceEdit(log: WorkerAttendance) { setAttendanceEdit(log); setAttendanceCheckIn(log.checkIn?.time || ''); setAttendanceCheckOut(log.checkOut?.time || ''); setAttendanceNote(log.note || ''); }
  async function saveAttendanceEdit() {
    if (!attendanceEdit || !attendanceProject) return;
    setBusy(true);
    try { await adjustWorkerAttendance(scope, attendanceEdit._id, attendanceProject._id, { checkInAt: attendanceCheckIn || null, checkOutAt: attendanceCheckOut || null, note: attendanceNote }); setAttendanceEdit(null); await loadAttendance(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không cập nhật được chấm công.'); }
    finally { setBusy(false); }
  }
  async function manualCheckIn(workerId: string) {
    if (!attendanceProject) return;
    setBusy(true);
    try { await markWorkerAttendance(scope, attendanceProject._id, workerId); await loadAttendance(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không ghi nhận được chấm công.'); }
    finally { setBusy(false); }
  }
  async function startQrSession(project: WorkerProject | null = attendanceProject) {
    if (!project) return;
    setBusy(true);
    try {
      setError('');
      if (qrSession) await closeWorkerQrSession(scope, qrSession.id);
      const created = await createWorkerQrSession(scope, project._id, today(), 60);
      if (!created?.id) throw new Error('IGen-ERP không trả về phiên điểm danh QR.');
      try {
        const { token } = await getWorkerQrToken(scope, created.id);
        const checkinUrl = getErpWebUrl(`worker/checkin/${encodeURIComponent(token)}`);
        if (!checkinUrl) throw new Error('Chưa cấu hình địa chỉ web IGen-ERP để tạo liên kết điểm danh.');
        setQrCheckedIn(0); setQrWorkers([]); setQrSession({ id: created.id, checkinUrl, expiresAt: created.expiresAt });
        Alert.alert('Link chấm công', checkinUrl, [
          { text: 'Đóng', style: 'cancel' },
          { text: 'Mở link', onPress: () => { void Linking.openURL(checkinUrl).catch(() => setError('Không mở được link chấm công trên thiết bị.')); } },
          { text: 'Chia sẻ', onPress: () => { void Share.share({ message: checkinUrl }); } },
        ]);
      } catch (cause) {
        await closeWorkerQrSession(scope, created.id).catch(() => undefined);
        throw cause;
      }
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tạo được phiên QR.'); }
    finally { setBusy(false); }
  }
  async function stopQrSession() {
    if (!qrSession) return;
    try { await closeWorkerQrSession(scope, qrSession.id); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không đóng được phiên QR.'); }
    finally { setQrSession(null); setQrCheckedIn(0); setQrWorkers([]); }
  }
  async function openQrCheckinLink() {
    if (!qrSession?.checkinUrl) return;
    try { await Linking.openURL(qrSession.checkinUrl); }
    catch { setError('Không mở được link chấm công trên thiết bị.'); }
  }
  async function closeAttendance() {
    if (qrSession) await stopQrSession();
    setAttendanceProject(null);
  }
  async function openProjectQr(project: WorkerProject) {
    await openAttendance(project);
    await startQrSession(project);
  }

  function openContractCreate() { setEditingContract(null); setContractForm(blankContract()); setContractModal('create'); }
  function openContractEdit(contract: LaborContract) { setEditingContract(contract); setContractForm({ workerId: contract.workerId, code: contract.code, clientName: contract.clientName, startDate: contract.startDate.slice(0, 10), endDate: contract.endDate.slice(0, 10), status: contract.status, note: contract.note || '' }); setContractModal('edit'); }
  function openContractRenew(contract: LaborContract) { const startDate = shiftDateKey(contract.endDate, 1); setEditingContract(contract); setContractForm({ workerId: contract.workerId, code: '', clientName: contract.clientName, startDate, endDate: addCalendarYear(startDate), status: 'draft', note: '' }); setContractModal('renew'); }
  async function saveContractForm() {
    if (!scope || !contractForm.workerId || !contractForm.code.trim() || !contractForm.clientName.trim() || contractForm.startDate > contractForm.endDate) { setError('Kiểm tra lao động, mã hợp đồng, đơn vị sử dụng và thời hạn hợp đồng.'); return; }
    if (contractModal === 'renew' && editingContract) {
      const currentEndDate = editingContract.endDate.slice(0, 10);
      if (contractForm.startDate <= currentEndDate || contractForm.endDate <= currentEndDate) { setError('Kỳ gia hạn phải bắt đầu và kết thúc sau ngày kết thúc hợp đồng hiện tại.'); return; }
    }
    setError('');
    setBusy(true);
    try { if (contractModal === 'renew' && editingContract) await renewLaborContract(scope, editingContract._id, contractForm); else await saveLaborContract(scope, contractForm, contractModal === 'edit' ? editingContract?._id : undefined); setContractModal(null); await loadContracts(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không lưu được hợp đồng.'); }
    finally { setBusy(false); }
  }
  async function showContractHistory(contract: LaborContract) {
    if (!scope) return;
    try { setContractHistory(await getLaborContractHistory(scope, contract.rootContractId || contract._id)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được lịch sử hợp đồng.'); }
  }
  function confirmContractDelete(contract: LaborContract) { Alert.alert('Xóa hợp đồng?', `Xóa hợp đồng ${contract.code}?`, [{ text: 'Hủy', style: 'cancel' }, { text: 'Xóa', style: 'destructive', onPress: async () => { if (!scope) return; try { await removeLaborContract(scope, contract._id); await loadContracts(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không xóa được hợp đồng.'); } } }]); }
  async function exportContracts() { await saveAndShareExport(new TextEncoder().encode(csv([['Mã hợp đồng', 'Người lao động', 'Khách hàng/đơn vị', 'Ngày bắt đầu', 'Ngày kết thúc', 'Trạng thái', 'Ghi chú'], ...contracts.map((contract) => [contract.code, workers.find((worker) => worker._id === contract.workerId)?.fullName || contract.workerId, contract.clientName, contract.startDate, contract.endDate, contractStatusLabel(contract.status), contract.note])])), 'hop-dong-lao-dong.csv', 'text/csv;charset=utf-8'); }
  async function sendNotification() {
    if (!notificationTitle.trim() || !notificationContent.trim()) {
      setNotificationError('Nhập tiêu đề và nội dung thông báo.');
      return;
    }
    setBusy(true);
    setNotificationError('');
    try {
      await createWorkerNotification(scope, { title: notificationTitle.trim(), content: notificationContent.trim() });
      setNotificationTitle('');
      setNotificationContent('');
      setNotificationModal(false);
      setNotificationError('');
      try {
        await loadNotifications();
      } catch (cause) {
        setError(cause instanceof Error ? `Đã gửi thông báo, nhưng không tải lại được danh sách: ${cause.message}` : 'Đã gửi thông báo, nhưng không tải lại được danh sách.');
      }
    } catch (cause) {
      setNotificationError(cause instanceof Error ? cause.message : 'Không gửi được thông báo.');
    } finally {
      setBusy(false);
    }
  }

  if (!canRead) return <View style={styles.center}><Users color={colors.primary} size={28} /><Text style={styles.heading}>Bạn chưa được cấp quyền sử dụng module Lao động</Text><Text style={styles.muted}>Cần quyền people:read hoặc people:manage.</Text></View>;
  if (!scope && tab !== 'notifications') return <ScrollView contentContainerStyle={styles.center}><Text style={styles.heading}>Chọn cơ sở lao động</Text><Text style={styles.muted}>Cần có mã công ty để tải hồ sơ, dự án và hợp đồng.</Text>{isSuperAdmin ? companies.map((item) => <Pressable key={item.code} style={[styles.card, { alignSelf: 'stretch' }]} onPress={() => setCompanyCode(item.code)}><Text style={styles.cardTitle}>{item.name}</Text><Text style={styles.muted}>{item.code}</Text></Pressable>) : null}{isSuperAdmin && !companies.length && <Text style={styles.muted}>{error || 'Đang tải danh sách cơ sở…'}</Text>}</ScrollView>;

  const workerFilterSummary = useMemo(() => {
    const parts: string[] = [];
    if (statusFilter !== 'all') parts.push(workerStatusLabel(statusFilter));
    if (laborTypeFilter !== 'all') parts.push(laborTypeLabel(laborTypeFilter));
    if (workerProjectFilter !== 'all') {
      const pName = projects.find((p) => p._id === workerProjectFilter)?.name;
      if (pName) parts.push(pName);
    }
    if (registrationFrom || registrationTo) parts.push('Theo ngày tiếp nhận');
    return parts.length ? parts.join(' · ') : 'Tất cả trạng thái & bộ lọc';
  }, [laborTypeFilter, projects, registrationFrom, registrationTo, statusFilter, workerProjectFilter]);

  const contractFilterSummary = useMemo(() => {
    const parts: string[] = [];
    if (contractStatus !== 'all') parts.push(contractStatusLabel(contractStatus as LaborContractStatus));
    if (contractAlertOnly) parts.push('Cần chú ý');
    if (contractClient !== 'all') parts.push(contractClient);
    return parts.length ? parts.join(' · ') : 'Tất cả trạng thái hợp đồng';
  }, [contractAlertOnly, contractClient, contractStatus]);

  return <View style={styles.container}>
    <View pointerEvents="none" style={styles.topZoneBackdrop}>
      <Svg width="100%" height="100%" viewBox="0 0 360 96" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="workerTopBg" x1="0" y1="0" x2="0.15" y2="1">
            <Stop offset="0" stopColor="#D8EFFC" stopOpacity="1" />
            <Stop offset="0.45" stopColor="#EAF3FC" stopOpacity="1" />
            <Stop offset="1" stopColor="#F5FAFE" stopOpacity="1" />
          </LinearGradient>
          <RadialGradient id="workerGlowTR" cx="86%" cy="10%" rx="52%" ry="42%">
            <Stop offset="0" stopColor="#8FD3FA" stopOpacity="0.48" />
            <Stop offset="1" stopColor="#8FD3FA" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="360" height="96" fill="url(#workerTopBg)" />
        <Rect x="0" y="0" width="360" height="96" fill="url(#workerGlowTR)" />
        <Path d="M 190 96 C 242 66, 298 58, 360 36 L 360 96 Z" fill="#2463EB" fillOpacity={0.04} />
        <Circle cx="328" cy="14" r="54" fill="none" stroke="#2463EB" strokeOpacity={0.075} strokeWidth={1.2} />
        <Circle cx="328" cy="14" r="32" fill="none" stroke="#2463EB" strokeOpacity={0.065} strokeWidth={1} />
        <Circle cx="246" cy="18" r="2.1" fill="#2463EB" fillOpacity={0.11} />
        <Circle cx="260" cy="12" r="1.7" fill="#2463EB" fillOpacity={0.08} />
        <Circle cx="258" cy="26" r="1.5" fill="#2463EB" fillOpacity={0.09} />
      </Svg>
    </View>
    {isSuperAdmin && <Pressable style={styles.companySelect} onPress={() => setCompanyPickerOpen(true)}><Text style={styles.muted}>Cơ sở: </Text><Text style={styles.companyName}>{companies.find((item) => item.code === companyCode)?.name || companyCode || 'Chọn cơ sở'}</Text></Pressable>}
    <Stack.Screen options={{
      headerStyle: { backgroundColor: PASTEL_BACKDROP_TOP_COLOR },
      headerShadowVisible: false,
      headerRight: branches.length > 0 && canSwitchBranch ? () => (
        <Pressable
          disabled={branches.length <= 1}
          onPress={() => setBranchPickerOpen(true)}
          style={({ pressed }) => [styles.headerBranchBtn, pressed && branches.length > 1 && { opacity: 0.72 }]}
          accessibilityRole="button"
          accessibilityLabel="Chọn chi nhánh để xem dữ liệu lao động"
        >
          <View style={styles.branchBtnContent}>
            <BranchAppIcon size={22} />
            <Text numberOfLines={1} style={styles.branchBtnText}>{branchesLoading ? 'Đang tải…' : branchName}</Text>
            {branches.length > 1 ? <ChevronDown size={14} color={colors.ink} /> : null}
          </View>
        </Pressable>
      ) : undefined,
    }} />
    <ModuleSectionSwitcher
      items={workerSections}
      activeKey={tab}
      transition={sectionTransition}
      onChange={handleTabChange}
      modalTitle="Chọn tính năng Lao động"
      style={styles.switcherBarWrap}
    />
    {error ? <PopupError error={error} /> : null}{busy ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 5 }} /> : null}

    <Animated.View style={[{ flex: 1 }, sectionTransition.animatedStyle]}>
    {tab === 'workers' && <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 92 }]} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <View style={styles.filterTopBar}>
        <Pressable accessibilityRole="button" onPress={() => setWorkerFiltersOpen(true)} style={({ pressed }) => [styles.filterTriggerBtn, pressed && { opacity: 0.65 }]}>
          <SlidersHorizontal size={17} strokeWidth={1.6} color={colors.ink} />
          <Text numberOfLines={1} style={styles.filterTriggerText}>{workerFilterSummary}</Text>
          <ChevronDown size={15} strokeWidth={1.7} color="#64748B" />
        </Pressable>
      </View>
      <View style={styles.toolbar}><View style={styles.search}><Search color="#94A3B8" size={16} strokeWidth={1.6} /><TextInput value={search} onChangeText={setSearch} placeholder="Tìm tên, điện thoại, email" placeholderTextColor="#94A3B8" style={styles.searchInput} />{search ? <Pressable onPress={() => setSearch('')}><X size={14} color={colors.muted} /></Pressable> : null}</View></View>
      <View style={styles.actions}><Action label="Xuất CSV" icon={<Download size={13} color={colors.primary} />} onPress={() => void exportWorkers()} /><Action label="Tải mẫu CSV" icon={<Download size={13} color={colors.primary} />} onPress={() => void exportWorkerTemplate()} /><Action label="Nhập CSV" icon={<FileUp size={13} color={colors.primary} />} onPress={() => void chooseWorkerImport()} disabled={!canManage} />{selectedWorkerIds.length > 0 && canManage && <Action label={`Xóa đã chọn (${selectedWorkerIds.length})`} icon={<Trash2 size={13} color="#B42318" />} onPress={() => void deleteSelectedWorkers()} />}</View>

      {loading ? <Loading /> : visibleWorkers.length > 0 ? <View style={styles.listFlat}>{visibleWorkers.map((worker) => <View key={worker._id} style={styles.listItem}><View style={styles.row}><Pressable disabled={!canManage} onPress={() => setSelectedWorkerIds((current) => current.includes(worker._id) ? current.filter((id) => id !== worker._id) : [...current, worker._id])} style={[styles.checkbox, selectedWorkerIds.includes(worker._id) && styles.checkboxSelected]}>{selectedWorkerIds.includes(worker._id) && <Check size={13} color={colors.white} />}</Pressable><Pressable style={{ flex: 1 }} onPress={() => setWorkerDetail(worker)}><Text style={styles.cardTitle}>{worker.fullName}</Text><Text style={styles.muted}>{worker.phone || '—'} · {laborTypeLabel(worker.laborType)}</Text><Text style={styles.muted}>{worker.email || worker.idCard || 'Chưa có thông tin định danh'}</Text></Pressable><StatusPill label={workerStatusLabel(worker.status)} /></View><View style={styles.cardActions}><Action label="Chi tiết" onPress={() => setWorkerDetail(worker)} /><Action label="Sửa" onPress={() => openWorkerEdit(worker)} disabled={!canManage} /><Action label="Xóa" danger onPress={() => confirmWorkerDelete(worker)} disabled={!canManage} /></View></View>)}</View> : <Empty text="Chưa có hồ sơ lao động phù hợp." />}
    </ScrollView>}

    {tab === 'projects' && <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 92 }]} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      {!canManage && <Text style={styles.muted}>Tài khoản hiện có quyền xem. Cần quyền people:manage để quản lý dự án và tạo QR chấm công.</Text>}
      <View style={styles.filterTopBar}>
        <Pressable accessibilityRole="button" onPress={() => setProjectStatusSheetOpen(true)} style={({ pressed }) => [styles.filterTriggerBtn, pressed && { opacity: 0.65 }]}>
          <Briefcase size={17} strokeWidth={1.6} color={colors.ink} />
          <Text numberOfLines={1} style={styles.filterTriggerText}>{projectStatusFilter === 'all' ? 'Mọi trạng thái' : projectStatusLabel(projectStatusFilter)}</Text>
          <ChevronDown size={15} strokeWidth={1.7} color="#64748B" />
        </Pressable>
      </View>
      <View style={styles.toolbar}><View style={styles.search}><Search color="#94A3B8" size={16} strokeWidth={1.6} /><TextInput value={projectSearch} onChangeText={setProjectSearch} placeholder="Tìm mã, tên, địa điểm dự án" placeholderTextColor="#94A3B8" style={styles.searchInput} /></View></View>
      {loading ? <Loading /> : visibleProjects.length > 0 ? <View style={styles.listFlat}>{visibleProjects.map((project) => <View key={project._id} style={styles.listItem}><Pressable onPress={() => setProjectDetail(project)}><View style={styles.row}><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{project.name}</Text><Text style={styles.muted}>{project.code} · {project.location || 'Chưa có địa điểm'}</Text></View><StatusPill label={projectStatusLabel(project.status)} /></View><Text style={styles.muted}>{project.startDate} – {project.endDate} · {project.workerIds.length}/{project.quota || '∞'} lao động · {project.startTime}–{project.endTime}</Text></Pressable><View style={styles.cardActions}><Action label="Chi tiết" onPress={() => setProjectDetail(project)} /><Action label="Tạo QR chấm công" icon={<QrCode size={13} color={colors.primary} />} onPress={() => void openProjectQr(project)} disabled={!canManage || busy} /><Action label="Sửa" icon={<Pencil size={13} color={colors.primary} />} onPress={() => openProjectEdit(project)} disabled={!canManage} /><Action label="Xóa" danger onPress={() => confirmProjectDelete(project)} disabled={!canManage} /></View></View>)}</View> : <Empty text="Không có dự án phù hợp." />}
    </ScrollView>}

    {tab === 'contracts' && <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 92 }]} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <View style={styles.filterTopBar}>
        <Pressable accessibilityRole="button" onPress={() => setContractFiltersOpen(true)} style={({ pressed }) => [styles.filterTriggerBtn, pressed && { opacity: 0.65 }]}>
          <FileText size={17} strokeWidth={1.6} color={colors.ink} />
          <Text numberOfLines={1} style={styles.filterTriggerText}>{contractFilterSummary}</Text>
          <ChevronDown size={15} strokeWidth={1.7} color="#64748B" />
        </Pressable>
      </View>
      <View style={styles.toolbar}><View style={styles.search}><Search color="#94A3B8" size={16} strokeWidth={1.6} /><TextInput value={contractSearch} onChangeText={setContractSearch} placeholder="Tìm mã, lao động, khách hàng" placeholderTextColor="#94A3B8" style={styles.searchInput} /></View></View>
      <View style={styles.summaryRow}><Metric label="Sắp hết hạn" value={String(contractAlerts?.expiringCount || 0)} /><Metric label="Đã hết hạn" value={String(contractAlerts?.expiredCount || 0)} /></View>
      <View style={styles.actions}><Action label="Xuất CSV" icon={<Download size={13} color={colors.primary} />} onPress={() => void exportContracts()} /></View>
      {loading ? <Loading /> : contracts.length > 0 ? <View style={styles.listFlat}>{contracts.map((contract) => <View key={contract._id} style={styles.listItem}><View style={styles.row}><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{contract.code} · {workers.find((worker) => worker._id === contract.workerId)?.fullName || contract.workerId}</Text><Text style={styles.muted}>{contract.clientName}</Text></View><StatusPill label={contractStatusLabel(contract.status)} /></View><Text style={styles.muted}>{contract.startDate.slice(0, 10)} – {contract.endDate.slice(0, 10)}{contract.alertLevel === 'expiring' ? ' · Sắp hết hạn' : contract.alertLevel === 'expired' ? ' · Đã hết hạn' : ''}</Text><View style={styles.cardActions}><Action label="Lịch sử" onPress={() => void showContractHistory(contract)} /><Action label="Sửa" onPress={() => { if (canManage) openContractEdit(contract); }} disabled={!canManage} /><Action label="Gia hạn" onPress={() => { if (canManage) openContractRenew(contract); }} disabled={!canManage} /><Action label="Xóa" danger onPress={() => confirmContractDelete(contract)} disabled={!canManage} /></View></View>)}</View> : <Empty text="Không có hợp đồng phù hợp bộ lọc." />}
    </ScrollView>}

    {tab === 'notifications' && <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 92 }]} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <View style={styles.notificationToolbar}><View style={{ flex: 1, gap: 2 }}><Text style={styles.heading}>Thông báo</Text><Text style={styles.muted}>{notifications.length} thông báo</Text></View></View>
      {loading ? <Loading /> : notifications.length > 0 ? <View style={styles.listFlat}>{notifications.map((item, index) => <View key={item._id || `${item.title}-${index}`} style={styles.listItem}><View style={styles.notificationHeader}><View style={styles.notificationIcon}><Bell size={16} strokeWidth={1.7} color={colors.primary} /></View><View style={{ flex: 1, gap: 2 }}><Text style={styles.cardTitle}>{item.title || item.subject || 'Thông báo'}</Text><Text style={styles.notificationDate}>{formatNotificationDate(item.sentAt || item.createdAt) || 'Chưa ghi nhận thời gian'}</Text></View></View><Text style={styles.notificationBody}>{item.content || item.message || 'Không có nội dung.'}</Text></View>)}</View> : <Empty text="Chưa có thông báo." />}
    </ScrollView>}
    </Animated.View>

    {canManage ? (
      <HrFab
        label={tab === 'projects' ? 'Thêm dự án' : tab === 'workers' ? 'Thêm lao động' : tab === 'contracts' ? 'Tạo hợp đồng' : 'Gửi thông báo'}
        onPress={() => {
          if (tab === 'projects') openProjectCreate();
          else if (tab === 'workers') openWorkerCreate();
          else if (tab === 'contracts') openContractCreate();
          else { setNotificationError(''); setNotificationModal(true); }
        }}
      />
    ) : null}

    <Modal visible={projectStatusSheetOpen} transparent statusBarTranslucent animationType="slide" onRequestClose={() => setProjectStatusSheetOpen(false)}>
      <Pressable style={styles.sheetBackdrop} onPress={() => setProjectStatusSheetOpen(false)}>
        <Pressable style={styles.sheetModal} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }}>
            {(['all', 'planned', 'active', 'completed'] as const).map((value) => {
              const selected = projectStatusFilter === value;
              return (
                <Pressable key={value} onPress={() => { setProjectStatusFilter(value); setProjectStatusSheetOpen(false); }} style={[styles.filterSheetRow, selected && styles.sheetRowActive]}>
                  <Text style={[styles.filterSheetRowText, selected && styles.filterSheetRowTextActive]}>{value === 'all' ? 'Mọi trạng thái' : projectStatusLabel(value)}</Text>
                  {selected ? <Check size={17} color={colors.primary} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
    <Modal visible={branchPickerOpen} transparent animationType="slide" onRequestClose={() => setBranchPickerOpen(false)}>
      <Pressable style={styles.sheetBackdrop} onPress={() => setBranchPickerOpen(false)}>
        <Pressable style={styles.sheetModal} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }}>{branches.map((branch) => {
            const selected = branch._id === branchId;
            return <Pressable key={branch._id} onPress={() => {
              if (!selected) {
                setActiveBranchId(branch._id);
                setWorkers([]); setProjects([]); setContracts([]); setNotifications([]); setAttendance([]);
                setWorkerDetail(null); setProjectDetail(null); setAttendanceProject(null); setQrSession(null);
                setError('');
              }
              setBranchPickerOpen(false);
            }} style={[styles.sheetRow, selected && styles.sheetRowActive]}>
              <BranchAppIcon size={38} />
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetRowTitle}>{branch.name}</Text>
                {branch.code ? <Text numberOfLines={1} style={styles.sheetRowSub}>Mã chi nhánh: {branch.code}</Text> : null}
              </View>
              {selected ? <Check size={17} color={colors.primary} /> : null}
            </Pressable>;
          })}</ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
    <Modal visible={companyPickerOpen} transparent animationType="fade" onRequestClose={() => setCompanyPickerOpen(false)}><View style={styles.backdrop}><View style={styles.dialog}><ModalHeader title="Chọn cơ sở lao động" onClose={() => setCompanyPickerOpen(false)} /><ScrollView style={{ maxHeight: 420 }}>{companies.map((item) => <Pressable key={item.code} onPress={() => { setCompanyCode(item.code); setCompanyPickerOpen(false); }} style={styles.option}><Text style={styles.cardTitle}>{item.name}</Text><Text style={styles.muted}>{item.code}</Text></Pressable>)}</ScrollView></View></View></Modal>
    <Modal visible={contractFiltersOpen} transparent statusBarTranslucent animationType="slide" onRequestClose={() => setContractFiltersOpen(false)}>
      <Pressable style={styles.sheetBackdrop} onPress={() => setContractFiltersOpen(false)}>
        <Pressable style={styles.sheetModal} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ gap: 10, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
            <Text style={styles.section}>Trạng thái</Text><View style={styles.chips}>{(['all', 'draft', 'active', 'renewed', 'expired', 'terminated'] as const).map((value) => <Chip key={value} label={value === 'all' ? 'Mọi trạng thái' : contractStatusLabel(value)} selected={contractStatus === value} onPress={() => setContractStatus(value)} />)}</View>
            <Chip label={contractAlertOnly ? 'Chỉ hợp đồng cần chú ý' : 'Hợp đồng cần chú ý'} selected={contractAlertOnly} onPress={() => setContractAlertOnly((value) => !value)} />
            {contractClients.length > 0 && <View style={{ gap: 6 }}><Text style={styles.section}>Khách hàng</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.chips}><Chip label="Mọi khách hàng" selected={contractClient === 'all'} onPress={() => setContractClient('all')} />{contractClients.map((client) => <Chip key={client} label={client} selected={contractClient === client} onPress={() => setContractClient(client)} />)}</ScrollView></View>}
          </ScrollView>
          <View style={[styles.toolbar, { marginTop: 10 }]}><Action label="Xóa bộ lọc" onPress={() => { setContractStatus('all'); setContractAlertOnly(false); setContractClient('all'); }} /><View style={{ flex: 1 }} /><Action label="Xong" onPress={() => setContractFiltersOpen(false)} primary /></View>
        </Pressable>
      </Pressable>
    </Modal>
    <Modal visible={workerFiltersOpen} transparent statusBarTranslucent animationType="slide" onRequestClose={() => setWorkerFiltersOpen(false)}>
      <Pressable style={styles.sheetBackdrop} onPress={() => setWorkerFiltersOpen(false)}>
        <Pressable style={styles.sheetModal} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ gap: 10, paddingBottom: 8 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.section}>Trạng thái</Text><View style={styles.chips}>{['all', 'active', 'inactive', 'placed'].map((value) => <Chip key={value} label={value === 'all' ? 'Tất cả' : workerStatusLabel(value)} selected={statusFilter === value} onPress={() => setStatusFilter(value)} />)}</View>
            <Text style={styles.section}>Loại lao động</Text><View style={styles.chips}>{(['all', 'official', 'seasonal', 'foreign'] as const).map((value) => <Chip key={value} label={value === 'all' ? 'Mọi loại' : laborTypeLabel(value)} selected={laborTypeFilter === value} onPress={() => setLaborTypeFilter(value)} />)}</View>
            <Text style={styles.section}>Dự án</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.chips}><Chip label="Mọi dự án" selected={workerProjectFilter === 'all'} onPress={() => setWorkerProjectFilter('all')} />{projects.map((project) => <Chip key={project._id} label={project.name} selected={workerProjectFilter === project._id} onPress={() => setWorkerProjectFilter(project._id)} />)}</ScrollView>
            <View style={styles.row}><DateTimeField label="Tiếp nhận từ" mode="date" value={registrationFrom} onChange={setRegistrationFrom} allowClear /><DateTimeField label="Đến ngày" mode="date" value={registrationTo} onChange={setRegistrationTo} allowClear /></View>
          </ScrollView>
          <View style={[styles.toolbar, { marginTop: 10 }]}><Action label="Xóa bộ lọc" onPress={() => { setStatusFilter('all'); setLaborTypeFilter('all'); setWorkerProjectFilter('all'); setRegistrationFrom(''); setRegistrationTo(''); }} /><View style={{ flex: 1 }} /><Action label="Xong" onPress={() => setWorkerFiltersOpen(false)} primary /></View>
        </Pressable>
      </Pressable>
    </Modal>
    <FullScreenFormModal
      visible={workerModal}
      title={editingWorker ? 'Cập nhật hồ sơ lao động' : 'Thêm lao động'}
      onClose={() => setWorkerModal(false)}
      footer={<Action label={busy ? 'Đang lưu…' : 'Lưu hồ sơ'} onPress={() => void saveWorkerForm()} disabled={!canManage || busy || laborPartnersLoading} primary />}
    >
      <View style={{ gap: 10 }}>
        <Field label="Họ và tên *" value={workerForm.fullName} onChangeText={(value) => setWorkerForm((current) => ({ ...current, fullName: value }))} /><Field label="Số điện thoại *" value={workerForm.phone || ''} onChangeText={(value) => setWorkerForm((current) => ({ ...current, phone: value }))} keyboardType="phone-pad" /><Field label="Email" value={workerForm.email || ''} onChangeText={(value) => setWorkerForm((current) => ({ ...current, email: value }))} keyboardType="email-address" /><Text style={styles.label}>Đối tác giới thiệu (tùy chọn)</Text><Pressable disabled={laborPartnersLoading || activeLaborPartners.length === 0} onPress={() => { setLaborPartnerSearch(''); setLaborPartnerPickerOpen(true); }} style={[styles.partnerSelect, (laborPartnersLoading || activeLaborPartners.length === 0) && styles.disabled]}><Text numberOfLines={1} style={styles.partnerSelectText}>{selectedLaborPartner ? `${selectedLaborPartner.code} · ${selectedLaborPartner.name}` : laborPartnersLoading ? 'Đang tải đối tác...' : 'Không chọn đối tác'}</Text><ChevronDown size={14} color={colors.muted} /></Pressable>{laborPartnerLoadError ? <PopupError error={laborPartnerLoadError} /> : !laborPartnersLoading && activeLaborPartners.length === 0 ? <Text style={styles.muted}>Chưa có đối tác lao động đang hoạt động.</Text> : null}<Field label="CCCD/CMND" value={workerForm.idCard || ''} onChangeText={(value) => setWorkerForm((current) => ({ ...current, idCard: value }))} /><DateTimeField label="Ngày sinh" mode="date" value={workerForm.birthday || ''} onChange={(value) => setWorkerForm((current) => ({ ...current, birthday: value }))} allowClear /><Field label="Địa chỉ" value={workerForm.address || ''} onChangeText={(value) => setWorkerForm((current) => ({ ...current, address: value }))} /><DateTimeField label="Ngày đăng ký" mode="date" value={workerForm.registrationDate || ''} onChange={(value) => setWorkerForm((current) => ({ ...current, registrationDate: value }))} />
        <Text style={styles.label}>Loại lao động</Text><View style={styles.chips}>{(['official', 'seasonal', 'foreign'] as const).map((value) => <Chip key={value} label={laborTypeLabel(value)} selected={workerForm.laborType === value} onPress={() => setWorkerForm((current) => ({ ...current, laborType: value }))} />)}</View><Text style={styles.label}>Trạng thái</Text><View style={styles.chips}>{(['active', 'inactive', 'placed'] as const).map((value) => <Chip key={value} label={workerStatusLabel(value)} selected={workerForm.status === value} onPress={() => setWorkerForm((current) => ({ ...current, status: value }))} />)}</View>
        <Field label="Quốc tịch" value={workerForm.nationality || ''} onChangeText={(value) => setWorkerForm((current) => ({ ...current, nationality: value }))} /><Field label="Số giấy phép lao động" value={workerForm.workPermitNumber || ''} onChangeText={(value) => setWorkerForm((current) => ({ ...current, workPermitNumber: value }))} /><DateTimeField label="Hạn giấy phép" mode="date" value={workerForm.workPermitExpiry || ''} onChange={(value) => setWorkerForm((current) => ({ ...current, workPermitExpiry: value }))} allowClear /><Field label="Ghi chú" value={workerForm.note || ''} onChangeText={(value) => setWorkerForm((current) => ({ ...current, note: value }))} multiline />
        {workerFormError ? <PopupError error={workerFormError} /> : null}
      </View>
    </FullScreenFormModal>
    <Modal visible={laborPartnerPickerOpen} transparent animationType="fade" onRequestClose={() => setLaborPartnerPickerOpen(false)}><View style={styles.backdrop}><View style={styles.dialog}><ModalHeader title="Chọn đối tác giới thiệu" onClose={() => setLaborPartnerPickerOpen(false)} /><Field label="Tìm mã hoặc tên đối tác" value={laborPartnerSearch} onChangeText={setLaborPartnerSearch} placeholder="Nhập mã hoặc tên đối tác" /><ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled"><Pressable onPress={() => { setWorkerPartnerId(''); setLaborPartnerPickerOpen(false); }} style={[styles.branchOption, !workerPartnerId && styles.branchOptionSelected]}><View style={{ flex: 1 }}><Text style={styles.cardTitle}>Không chọn đối tác</Text></View>{!workerPartnerId && <Check size={17} color={colors.primary} />}</Pressable>{activeLaborPartners.filter((partner) => !laborPartnerSearch.trim() || normalize(`${partner.code} ${partner.name} ${partner.phone}`).includes(normalize(laborPartnerSearch))).map((partner) => { const selected = workerPartnerId === partner._id; return <Pressable key={partner._id} onPress={() => { setWorkerPartnerId(partner._id); setWorkerFormError(''); setLaborPartnerPickerOpen(false); }} style={[styles.branchOption, selected && styles.branchOptionSelected]}><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{partner.code} · {partner.name}</Text><Text style={styles.muted}>{partner.phone}</Text></View>{selected && <Check size={17} color={colors.primary} />}</Pressable>; })}{!activeLaborPartners.some((partner) => !laborPartnerSearch.trim() || normalize(`${partner.code} ${partner.name} ${partner.phone}`).includes(normalize(laborPartnerSearch))) && <Empty compact text="Không tìm thấy đối tác phù hợp." />}</ScrollView></View></View></Modal>
    <FullScreenFormModal
      visible={workerDetail !== null}
      title="Chi tiết lao động"
      onClose={() => setWorkerDetail(null)}
      footer={workerDetail && canManage ? <Action label="Chỉnh sửa" onPress={() => openWorkerEdit(workerDetail)} primary /> : undefined}
    >
      <View style={{ gap: 10 }}>{workerDetail && <><Text style={styles.cardTitle}>{workerDetail.fullName}</Text><Detail label="Trạng thái" value={workerStatusLabel(workerDetail.status)} /><Detail label="Loại lao động" value={laborTypeLabel(workerDetail.laborType)} /><Detail label="Điện thoại" value={workerDetail.phone} /><Detail label="Email" value={workerDetail.email} /><Detail label="CCCD/CMND" value={workerDetail.idCard} /><Detail label="Ngày sinh" value={workerDetail.birthday?.slice(0, 10)} /><Detail label="Địa chỉ" value={workerDetail.address} /><Detail label="Quốc tịch" value={workerDetail.nationality} /><Detail label="Giấy phép" value={workerDetail.workPermitNumber} /><Detail label="Hạn giấy phép" value={workerDetail.workPermitExpiry?.slice(0, 10)} /><Detail label="Ngày đăng ký" value={workerDetail.registrationDate?.slice(0, 10)} /><Detail label="Đối tác giới thiệu" value={workerDetail.partnerName || workerDetail.partnerCode} />{Object.entries(workerDetail.customFields || {}).map(([key, value]) => <Detail key={key} label={key} value={typeof value === 'string' ? value : JSON.stringify(value)} />)}<Detail label="Ghi chú" value={workerDetail.note} /></>}</View>
    </FullScreenFormModal>
    <FullScreenFormModal
      visible={importPreview !== null}
      title="Xem trước nhập lao động"
      onClose={() => setImportPreview(null)}
      footer={<View style={styles.cardActions}><Action label="Đóng" onPress={() => setImportPreview(null)} /><Action label={`Nhập ${importPreview?.filter((item) => !item.error).length || 0} dòng hợp lệ`} onPress={() => void commitWorkerImport()} primary disabled={!importPreview?.some((item) => !item.error) || busy} /></View>}
    >
      <View style={{ gap: 10 }}>
        <Text style={styles.label}>Gán dự án cho lao động vừa nhập</Text>
        <ScrollView horizontal contentContainerStyle={styles.chips}><Chip label="Không gán" selected={!importProjectId} onPress={() => setImportProjectId('')} />{projects.map((project) => <Chip key={project._id} label={project.name} selected={importProjectId === project._id} onPress={() => setImportProjectId(project._id)} />)}</ScrollView>
        {importPreview?.map((item) => <View key={item.row} style={styles.card}><Text style={styles.cardTitle}>Dòng {item.row}: {item.worker.fullName || 'Thiếu tên'}</Text><Text style={item.error ? styles.error : styles.muted}>{item.error || `${item.worker.phone}${item.worker.partnerCode ? ` · Đối tác ${item.worker.partnerCode}` : ''}`}</Text><Text style={styles.muted}>{item.worker.email || item.worker.idCard || item.worker.address || ''}</Text></View>)}
      </View>
    </FullScreenFormModal>

    <FullScreenFormModal
      visible={projectModal}
      title={editingProject ? 'Sửa dự án' : 'Tạo dự án'}
      onClose={() => setProjectModal(false)}
      footer={<Action label="Lưu dự án" onPress={() => void saveProjectForm()} primary disabled={!canManage || busy} />}
    >
      <View style={{ gap: 10 }}>
        <Field label="Mã dự án *" value={projectForm.code} onChangeText={(value) => setProjectForm((current) => ({ ...current, code: value }))} /><Field label="Tên dự án *" value={projectForm.name} onChangeText={(value) => setProjectForm((current) => ({ ...current, name: value }))} /><Field label="Số lao động tối đa" value={String(projectForm.quota)} onChangeText={(value) => setProjectForm((current) => ({ ...current, quota: Number(value.replace(/\D/g, '')) || 0 }))} keyboardType="number-pad" /><Field label="Địa điểm" value={projectForm.location || ''} onChangeText={(value) => setProjectForm((current) => ({ ...current, location: value }))} /><View style={styles.row}><Text style={styles.label}>Chấm công theo vị trí GPS</Text><Chip label={projectForm.geoLocation ? 'Đang bật' : 'Đã tắt'} selected={Boolean(projectForm.geoLocation)} onPress={() => setProjectForm((current) => ({ ...current, geoLocation: current.geoLocation ? null : { latitude: 0, longitude: 0, radiusMeters: 100 } }))} /></View>{projectForm.geoLocation && <View style={styles.row}><Field label="Vĩ độ" value={String(projectForm.geoLocation.latitude)} onChangeText={(value) => setProjectForm((current) => ({ ...current, geoLocation: current.geoLocation ? { ...current.geoLocation, latitude: Number(value) || 0 } : null }))} keyboardType="decimal-pad" /><Field label="Kinh độ" value={String(projectForm.geoLocation.longitude)} onChangeText={(value) => setProjectForm((current) => ({ ...current, geoLocation: current.geoLocation ? { ...current.geoLocation, longitude: Number(value) || 0 } : null }))} keyboardType="decimal-pad" /><Field label="Bán kính (m)" value={String(projectForm.geoLocation.radiusMeters)} onChangeText={(value) => setProjectForm((current) => ({ ...current, geoLocation: current.geoLocation ? { ...current.geoLocation, radiusMeters: Number(value) || 0 } : null }))} keyboardType="number-pad" /></View>}<DateTimeField label="Ngày bắt đầu" mode="date" value={projectForm.startDate} onChange={(value) => setProjectForm((current) => ({ ...current, startDate: value }))} /><DateTimeField label="Ngày kết thúc" mode="date" value={projectForm.endDate} onChange={(value) => setProjectForm((current) => ({ ...current, endDate: value }))} /><View style={styles.row}><DateTimeField label="Giờ bắt đầu" mode="time" value={projectForm.startTime} onChange={(value) => setProjectForm((current) => ({ ...current, startTime: value }))} /><DateTimeField label="Giờ kết thúc" mode="time" value={projectForm.endTime} onChange={(value) => setProjectForm((current) => ({ ...current, endTime: value }))} /></View>
        <Text style={styles.label}>Ngày làm trong tuần</Text><View style={styles.chips}>{['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((label, day) => <Chip key={day} label={label} selected={projectForm.daysOfWeek.includes(day)} onPress={() => setProjectForm((current) => ({ ...current, daysOfWeek: current.daysOfWeek.includes(day) ? current.daysOfWeek.filter((value) => value !== day) : [...current.daysOfWeek, day].sort() }))} />)}</View>
        <Text style={styles.label}>Trạng thái</Text><View style={styles.chips}>{(['planned', 'active', 'completed'] as const).map((value) => <Chip key={value} label={projectStatusLabel(value)} selected={projectForm.status === value} onPress={() => setProjectForm((current) => ({ ...current, status: value }))} />)}</View><Field label="Ghi chú" value={projectForm.note || ''} onChangeText={(value) => setProjectForm((current) => ({ ...current, note: value }))} multiline />
      </View>
    </FullScreenFormModal>
    <FullScreenFormModal
      visible={projectDetail !== null}
      title={projectDetail?.name || 'Chi tiết dự án'}
      onClose={() => setProjectDetail(null)}
    >
      <View style={{ gap: 10 }}>{projectDetail && <>
        <Detail label="Mã dự án" value={projectDetail.code} /><Detail label="Trạng thái" value={projectStatusLabel(projectDetail.status)} /><Detail label="Địa điểm" value={projectDetail.location} /><Detail label="Thời gian" value={`${projectDetail.startDate} – ${projectDetail.endDate} · ${projectDetail.startTime}–${projectDetail.endTime}`} /><Detail label="Sức chứa" value={`${projectDetail.workerIds.length}/${projectDetail.quota || '∞'}`} /><Detail label="Ngày làm" value={projectDetail.daysOfWeek.map((day) => ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][day]).join(', ')} />{projectDetail.geoLocation && <Detail label="Vùng chấm công GPS" value={`${projectDetail.geoLocation.latitude}, ${projectDetail.geoLocation.longitude} · bán kính ${projectDetail.geoLocation.radiusMeters} m`} />}
        <Text style={styles.section}>Lao động trong dự án</Text>{projectDetail.workerIds.length > 0 ? projectDetail.workerIds.map((id) => { const worker = workers.find((item) => item._id === id); return <View key={id} style={styles.row}><Text style={[styles.muted, { flex: 1 }]}>{worker?.fullName || id} · {worker?.phone || ''}</Text>{canManage && <Pressable onPress={() => void detachWorker(projectDetail, id)}><X size={16} color="#B42318" /></Pressable>}</View>; }) : <Empty compact text="Chưa có lao động trong dự án." />}
        <View style={styles.cardActions}><Action label="Chấm công / QR" icon={<QrCode size={13} color={colors.primary} />} onPress={() => void openAttendance(projectDetail)} /><Action label="Thêm lao động" onPress={() => { setProjectWorkerSelection([]); setProjectWorkerPicker(true); }} disabled={!canManage} /><Action label="Sửa" icon={<Pencil size={13} color={colors.primary} />} onPress={() => openProjectEdit(projectDetail)} disabled={!canManage} /><Action label="Xóa" danger onPress={() => confirmProjectDelete(projectDetail)} disabled={!canManage} /></View>
      </>}</View>
    </FullScreenFormModal>
    <Modal visible={projectWorkerPicker} transparent animationType="fade" onRequestClose={() => setProjectWorkerPicker(false)}><View style={styles.backdrop}><View style={styles.dialog}><ModalHeader title="Thêm lao động vào dự án" onClose={() => setProjectWorkerPicker(false)} /><ScrollView style={{ maxHeight: 400 }}>{workers.filter((worker) => !projectDetail?.workerIds.includes(worker._id)).length > 0 ? workers.filter((worker) => !projectDetail?.workerIds.includes(worker._id)).map((worker) => <Pressable key={worker._id} onPress={() => setProjectWorkerSelection((current) => current.includes(worker._id) ? current.filter((id) => id !== worker._id) : [...current, worker._id])} style={styles.row}><View style={[styles.checkbox, projectWorkerSelection.includes(worker._id) && styles.checkboxSelected]}>{projectWorkerSelection.includes(worker._id) && <Check color={colors.white} size={13} />}</View><Text style={styles.cardTitle}>{worker.fullName} · {worker.phone}</Text></Pressable>) : <Empty compact text="Không còn lao động khả dụng để thêm." />}</ScrollView><Action label={`Thêm ${projectWorkerSelection.length} người`} onPress={() => void saveProjectWorkers()} disabled={!projectWorkerSelection.length || busy} primary /></View></View></Modal>

    <FullScreenFormModal
      visible={attendanceProject !== null}
      title={`Chấm công · ${attendanceProject?.code || ''}`}
      onClose={() => void closeAttendance()}
    >
      <View style={{ gap: 10 }}>
        <View style={styles.row}>
          <Field label="Từ ngày" value={attendanceFrom} onChangeText={setAttendanceFrom} />
          <Field label="Đến ngày" value={attendanceTo} onChangeText={setAttendanceTo} />
        </View>
        <View style={styles.cardActions}>
          <Action label="Tải chấm công" onPress={() => void loadAttendance()} />
          <Action label={busy ? 'Đang tạo QR…' : qrSession ? 'Tạo phiên QR mới' : 'Tạo QR 60 phút'} icon={<QrCode size={13} color={colors.primary} />} onPress={() => void startQrSession()} disabled={!canManage || busy} />
        </View>
        {error ? <PopupError error={error} /> : null}
        {qrSession && <View style={[styles.card, { alignItems: 'center' }]}>
          <Text style={styles.cardTitle}>Điểm danh QR · Đã chấm công: {qrCheckedIn}</Text>
          <QRCode value={qrSession.checkinUrl} size={168} backgroundColor={colors.white} color={colors.ink} />
          <Pressable onPress={() => void openQrCheckinLink()} style={styles.qrLinkBox} accessibilityRole="link" accessibilityLabel="Mở link chấm công">
            <Text style={styles.qrLinkLabel}>Link chấm công · chạm để mở</Text>
            <Text selectable style={styles.qrLinkText}>{qrSession.checkinUrl}</Text>
          </Pressable>
          <Text style={styles.muted}>Hết hạn: {new Date(qrSession.expiresAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</Text>
          <View style={styles.cardActions}>
            <Action label="Chia sẻ liên kết" onPress={() => void Share.share({ message: qrSession.checkinUrl })} />
            <Action label="Đóng phiên" danger onPress={() => void stopQrSession()} />
          </View>
          {qrWorkers.map((worker) => <View key={worker.workerId} style={[styles.row, { alignSelf: 'stretch', justifyContent: 'space-between' }]}>
            <Text style={styles.muted}>{worker.fullName} · {worker.phone}</Text>
            <Text style={styles.muted}>{new Date(worker.checkinAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</Text>
          </View>)}
        </View>}
        <Text style={styles.section}>Chấm công thủ công</Text>
        {attendanceProject?.workerIds.map((workerId) => {
          const worker = workers.find((item) => item._id === workerId);
          const log = attendance.find((item) => item.workerId === workerId);
          return <View key={workerId} style={[styles.card, styles.row]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{worker?.fullName || workerId}</Text>
              <Text style={styles.muted}>{worker?.phone || 'Chưa có số điện thoại'}</Text>
            </View>
            <Action label={log?.checkIn ? 'Ghi nhận tiếp' : 'Check-in'} onPress={() => void manualCheckIn(workerId)} disabled={!canManage || busy} />
          </View>;
        })}
        {attendance.map((item) => <View key={item._id} style={styles.card}>
          <Text style={styles.cardTitle}>{workers.find((worker) => worker._id === item.workerId)?.fullName || item.workerId} · {item.date}</Text>
          <Text style={styles.muted}>Vào {item.checkIn?.time || '—'} · Ra {item.checkOut?.time || '—'} · {attendanceLabel(item.status)} · {item.workedMinutes ?? 0} phút</Text>
          {canManage && <Action label="Sửa chấm công" onPress={() => openAttendanceEdit(item)} />}
        </View>)}
        {!attendance.length && <Empty compact text="Không có dữ liệu chấm công trong khoảng ngày." />}
      </View>
    </FullScreenFormModal>
    <FullScreenFormModal
      visible={attendanceEdit !== null}
      title="Điều chỉnh chấm công"
      onClose={() => setAttendanceEdit(null)}
      footer={<Action label="Lưu điều chỉnh" onPress={() => void saveAttendanceEdit()} primary disabled={busy} />}
    >
      <View style={{ gap: 10 }}>
        <Field label="Giờ vào" value={attendanceCheckIn} onChangeText={setAttendanceCheckIn} /><Field label="Giờ ra" value={attendanceCheckOut} onChangeText={setAttendanceCheckOut} /><Field label="Ghi chú" value={attendanceNote} onChangeText={setAttendanceNote} multiline />
      </View>
    </FullScreenFormModal>

    <FullScreenFormModal
      visible={contractModal !== null}
      title={contractModal === 'renew' ? 'Gia hạn hợp đồng' : contractModal === 'edit' ? 'Sửa hợp đồng' : 'Tạo hợp đồng'}
      onClose={() => setContractModal(null)}
      footer={<Action label={contractModal === 'renew' ? 'Tạo kỳ gia hạn' : 'Lưu hợp đồng'} onPress={() => void saveContractForm()} primary disabled={!canManage || busy} />}
    >
      <View style={{ gap: 10 }}>
        <Text style={styles.label}>Người lao động *</Text><ScrollView horizontal>{contractWorkersAvailable.map((worker) => <Chip key={worker._id} label={worker.fullName} selected={contractForm.workerId === worker._id} onPress={() => setContractForm((current) => ({ ...current, workerId: worker._id }))} />)}</ScrollView>{contractModal === 'create' && contractWorkersAvailable.length === 0 && <Text style={styles.muted}>Không còn lao động đủ điều kiện lập hợp đồng mới.</Text>}<Field label="Mã hợp đồng *" value={contractForm.code} onChangeText={(value) => setContractForm((current) => ({ ...current, code: value }))} /><Field label="Khách hàng / đơn vị sử dụng *" value={contractForm.clientName} onChangeText={(value) => setContractForm((current) => ({ ...current, clientName: value }))} /><DateTimeField label="Ngày bắt đầu" mode="date" value={contractForm.startDate} onChange={(value) => setContractForm((current) => ({ ...current, startDate: value }))} /><DateTimeField label="Ngày kết thúc" mode="date" value={contractForm.endDate} onChange={(value) => setContractForm((current) => ({ ...current, endDate: value }))} /><Field label="Ghi chú" value={contractForm.note || ''} onChangeText={(value) => setContractForm((current) => ({ ...current, note: value }))} multiline />
      </View>
    </FullScreenFormModal>
    <FullScreenFormModal
      visible={contractHistory !== null}
      title="Lịch sử hợp đồng"
      onClose={() => setContractHistory(null)}
    >
      <View style={{ gap: 10 }}>{contractHistory?.length ? contractHistory.map((item) => <View key={item._id} style={styles.card}><Text style={styles.cardTitle}>{item.code} · kỳ {item.sequence}</Text><Text style={styles.muted}>{item.startDate.slice(0, 10)} – {item.endDate.slice(0, 10)} · {contractStatusLabel(item.status)}</Text><Text style={styles.muted}>{item.clientName}</Text></View>) : <Empty compact text="Chưa có lịch sử hợp đồng." />}</View>
    </FullScreenFormModal>
    <FullScreenFormModal
      visible={notificationModal}
      title="Gửi thông báo"
      onClose={() => { setNotificationModal(false); setNotificationError(''); }}
      footer={<Action label={busy ? 'Đang gửi...' : 'Gửi thông báo'} icon={busy ? <ActivityIndicator size="small" color={colors.white} /> : <Send size={13} color={colors.white} />} onPress={() => void sendNotification()} primary disabled={!notificationTitle.trim() || !notificationContent.trim() || busy} />}
    >
      <View style={{ gap: 10 }}>
        <Field label="Tiêu đề" value={notificationTitle} onChangeText={(value) => { setNotificationTitle(value); setNotificationError(''); }} placeholder="Nhập tiêu đề thông báo" maxLength={120} /><Field label="Nội dung" value={notificationContent} onChangeText={(value) => { setNotificationContent(value); setNotificationError(''); }} placeholder="Nhập nội dung thông báo" multiline maxLength={4000} />{notificationError ? <PopupError error={notificationError} /> : null}
      </View>
    </FullScreenFormModal>
    {importPreview && <Text style={styles.muted}>Tệp nhập đã sẵn sàng.</Text>}
  </View>;
}

function projectStatusLabel(value: string) { return ({ planned: 'Sắp triển khai', active: 'Đang hoạt động', completed: 'Hoàn thành' } as Record<string, string>)[value] || value; }
function attendanceLabel(value: string) { return ({ present: 'Có mặt', late: 'Đi muộn', 'left-early': 'Về sớm', 'late-left-early': 'Muộn, về sớm', 'missing-checkout': 'Thiếu giờ ra' } as Record<string, string>)[value] || value; }
function Action({ label, icon, onPress, disabled = false, danger = false, primary = false }: { label: string; icon?: ReactNode; onPress: () => void; disabled?: boolean; danger?: boolean; primary?: boolean }) { return <Pressable disabled={disabled} onPress={onPress} style={[styles.action, primary && styles.primaryButton, danger && styles.dangerButton, disabled && styles.disabled]}>{icon}<Text style={[styles.actionText, primary && styles.primaryText, danger && styles.dangerText]}>{label}</Text></Pressable>; }
function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}><Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text></Pressable>; }
function Field({ label, value, onChangeText, multiline, ...props }: { label: string; value: string; onChangeText: (value: string) => void; multiline?: boolean } & Omit<ComponentProps<typeof TextInput>, 'value' | 'onChangeText' | 'multiline'>) { return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} placeholderTextColor={colors.muted} style={[styles.input, multiline && styles.multiline]} {...props} /></View>; }
function StatusPill({ label }: { label: string }) { return <Text style={styles.statusPill}>{label}</Text>; }
function Metric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.muted}>{label}</Text></View>; }
function Detail({ label, value }: { label: string; value?: string | null }) { return <View style={styles.detailRow}><Text style={styles.muted}>{label}</Text><Text style={styles.detailText}>{value || '—'}</Text></View>; }
function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) { return <View style={styles.modalHeader}><Text style={styles.heading}>{title}</Text><Pressable onPress={onClose} style={styles.close}><X size={18} color={colors.ink} /></Pressable></View>; }
function Loading() { return <CenteredPageLoader />; }
function Empty({ text, compact = false }: { text: string; compact?: boolean }) { return <View style={compact ? styles.emptyCompact : styles.center}><IgenWorkerEmptyState message={text} compact={compact} /></View>; }

const styles = StyleSheet.create({
  topZoneBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, height: 78, overflow: 'hidden' },
  headerBranchBtn: { paddingVertical: 4, paddingLeft: 4, maxWidth: 190 },
  branchBtnContent: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  branchBtnText: { color: colors.ink, fontSize: 13, fontWeight: '700', flexShrink: 1 },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.35)', justifyContent: 'flex-end' },
  sheetModal: { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 28, maxHeight: '78%' },
  sheetHandle: { width: 38, height: 4, borderRadius: 99, backgroundColor: '#D6DFEC', alignSelf: 'center', marginBottom: 12 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitle: { color: '#111827', fontSize: 16, fontWeight: '600' },
  sheetClose: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  sheetRow: { flexDirection: 'row', alignItems: 'center', padding: 11, borderRadius: 14, gap: 12, marginBottom: 6 },
  sheetRowActive: { backgroundColor: '#F0F6FF' },
  sheetRowTitle: { color: '#111827', fontSize: 13.5, fontWeight: '600' },
  sheetRowSub: { color: '#6B7280', fontSize: 11, marginTop: 2 },
  filterTopBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4, paddingBottom: 10, gap: 10 },
  filterTriggerBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 },
  filterTriggerText: { color: colors.ink, fontSize: 15, fontWeight: '400', flexShrink: 1 },
  filterSheetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 13, borderRadius: 12, marginBottom: 4 },
  filterSheetRowText: { color: colors.ink, fontSize: 14.5, fontWeight: '400' },
  filterSheetRowTextActive: { color: colors.primary, fontWeight: '500' },
  qrLinkBox: { alignSelf: 'stretch', gap: 5, padding: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: '#DCE7F7', borderRadius: 10, backgroundColor: '#F5F9FF' },
  qrLinkLabel: { color: colors.primary, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  qrLinkText: { color: '#111827', fontSize: 11.5, lineHeight: 17, textAlign: 'center' },
  branchOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#EEF2F7' },
  branchOptionSelected: { backgroundColor: '#F0F6FF', borderRadius: 10 },
  container: { flex: 1, backgroundColor: colors.white },
  content: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 28, gap: 10, backgroundColor: colors.white },
  switcherBarWrap: { marginHorizontal: 14, marginTop: 4, marginBottom: 10 },
  partnerSelect: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: '#DCE5F2', borderRadius: 10, backgroundColor: '#F6F8FC' },
  partnerSelectText: { flex: 1, color: '#111827', fontSize: 13.5, fontWeight: '400' },
  companySelect: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 6 },
  companyName: { color: '#111827', fontSize: 12.5, fontWeight: '600' },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  search: { height: 40, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: '#DCE5F2', borderRadius: 99, backgroundColor: '#F6F8FC' },
  searchInput: { flex: 1, minWidth: 0, color: '#111827', fontSize: 13.5, paddingVertical: 0 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, backgroundColor: colors.white, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5EAF2' },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: '#6B7280', fontSize: 11.5, fontWeight: '500' },
  chipTextSelected: { color: colors.white, fontWeight: '600' },
  listFlat: { marginHorizontal: -14, backgroundColor: colors.white, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#EEF2F7' },
  listItem: { paddingHorizontal: 16, paddingVertical: 12, gap: 5, backgroundColor: colors.white, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EEF2F7' },
  notificationToolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 4 },
  notificationCard: { padding: 14, gap: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5EAF2', borderRadius: 10, backgroundColor: colors.white },
  notificationHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  notificationIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#EAF2FF' },
  notificationDate: { color: '#6B7280', fontSize: 11 },
  notificationBody: { color: '#374151', fontSize: 12.5, lineHeight: 18 },
  card: { padding: 14, gap: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5EAF2', borderRadius: 10, backgroundColor: colors.white },
  cardTitle: { color: '#111827', fontSize: 14, fontWeight: '600' },
  heading: { color: '#111827', fontSize: 15, fontWeight: '700' },
  section: { marginTop: 4, color: '#111827', fontSize: 13, fontWeight: '600' },
  muted: { color: '#6B7280', fontSize: 12.5, fontWeight: '400', lineHeight: 18 },
  detailText: { color: '#111827', fontSize: 13.5, fontWeight: '500', lineHeight: 19 },
  openDetail: { alignSelf: 'flex-end', color: colors.primary, fontSize: 12, fontWeight: '600' },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  action: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 11, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5EAF2', borderRadius: 8, backgroundColor: '#F6F8FC' },
  actionText: { color: colors.primary, fontSize: 11.5, fontWeight: '600' },
  primaryButton: { borderColor: colors.primary, backgroundColor: colors.primary },
  primaryText: { color: colors.white },
  dangerButton: { borderColor: '#FECACA', backgroundColor: '#FFF1F0' },
  dangerText: { color: '#B42318' },
  disabled: { opacity: 0.45 },
  error: { marginHorizontal: 12, color: '#B42318', fontSize: 12 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3.5, borderRadius: 8, backgroundColor: '#EAF2FF', color: colors.primary, fontSize: 10.5, fontWeight: '500', overflow: 'hidden' },
  checkbox: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 6 },
  checkboxSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  summaryRow: { flexDirection: 'row', gap: 8 },
  metric: { flex: 1, alignItems: 'center', padding: 11, borderRadius: 10, backgroundColor: '#F6F8FC', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5EAF2' },
  metricValue: { color: '#111827', fontSize: 16, fontWeight: '600' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EEF2F7' },
  field: { flex: 1, gap: 4, marginBottom: 7 },
  label: { color: '#374151', fontSize: 12.5, fontWeight: '500' },
  input: { minHeight: 42, paddingHorizontal: 12, borderWidth: 1, borderColor: '#DCE5F2', borderRadius: 10, backgroundColor: '#F6F8FC', color: '#111827', fontSize: 13.5 },
  multiline: { minHeight: 74, paddingTop: 10 },
  form: { padding: 14, gap: 8 },
  modal: { flex: 1, backgroundColor: colors.white },
  modalHeader: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EEF2F7', backgroundColor: colors.white },
  close: { padding: 6 },
  backdrop: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: 'rgba(15,23,42,0.35)' },
  dialog: { maxHeight: '88%', padding: 16, borderRadius: 20, backgroundColor: colors.white, gap: 8 },
  option: { padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#EEF2F7' },
  center: { flex: 1, minHeight: 320, alignItems: 'center', justifyContent: 'center', padding: 24, paddingBottom: 160, gap: 8 },
  emptyCompact: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  primaryButtonWide: { alignSelf: 'stretch' },
});
