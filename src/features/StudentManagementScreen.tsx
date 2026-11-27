import { BrandLoader, CenteredPageLoader } from '@/components/BrandLoader';
import { FullScreenFormModal } from '@/components/FullScreenFormModal';
import { ModuleSectionSwitcher, type ModuleSectionItem } from '@/components/ModuleSectionSwitcher';
import { BranchAppIcon } from '@/components/OverviewTabIcons';
import { PASTEL_BACKDROP_TOP_COLOR, PastelBackdrop } from '@/components/PastelBackdrop';
import { StudentTabIcon } from '@/components/StudentTabIcons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityIndicator, Alert, Animated, Modal, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Banknote, BarChart2, Bell, BookOpen, Building2, CalendarCheck, CalendarDays, Check, ChevronDown, ChevronRight, ClipboardCheck, ClipboardList, Download, Eye, GraduationCap, PauseCircle, Pencil, Plus, QrCode, RefreshCw, Route, Search, Share2, SlidersHorizontal, Tag, Trash2, UsersRound, Wrench, X } from 'lucide-react-native';
import { useAuth } from '@/core/auth/AuthProvider';
import { getErpWebUrl } from '@/core/network/erpWebLinks';
import { ApiError } from '@/core/network/apiClient';
import { fetchCompanyBranches, type ErpBranch } from '@/features/overview/overviewApi';
import { listHrEmployees } from '@/features/hr/hrApi';
import type { HrEmployee } from '@/features/hr/types';
import { listWorkerCompanies } from '@/features/workerManagementApi';
import { DateTimeField } from '@/features/quotation/DateTimeField';
import { saveAndShareCsv } from '@/features/quotation/fileExport';
import { BatchAssignmentsModal, BatchAttendanceHistoryModal, BatchDetailModal } from '@/features/BatchExtraModals';
import { StudentDataTransfer } from '@/features/StudentDataTransfer';
import { listStudentPartners, type StudentPartner } from '@/features/studentPartnersApi';
import { colors } from '@/theme/colors';
import type { FeatureScreenProps } from '@/features/modules/featureScreenRegistry';
import {
  addStudentToBatch, assignExamStudents, closeStudentQrSession, createCourseCategory, createLearningRoadmap, createPayment, createStudentResourceCategory,
  createResourceBooking, createStudentMiniTest, createStudentNotification,
  createStudentQrSession, createStudentPublicRegisterLink, deleteBatch, deleteCourse, deleteCourseCategory, deleteExam, deletePayment, deleteResourceBooking,
  deleteStudent, deleteStudentMiniTest, deleteStudentNotification, deleteStudentResource, deleteStudentResourceCategory, getBatchAttendance, getBatchEnrollments,
  getEligibleExamStudents, getStudentInstallments, getStudentLearningHistory, getStudentQrStatus, getStudentQualityDetail, gradeStudentAssignment,
  listBatches, listCourseCategories, listCourses, listExams, listLearningRoadmaps, listPayments, listStudentNotifications,
  listStudentQuality, listStudentResources, listStudentResourceCategories, listStudents, listWaitlist, markStudentInstallmentPaid,
  getBatchProgression, placeWaitlistEntries, promoteRoadmapLearners, removeStudentFromBatch, saveBatch, saveBatchAttendance, saveCourse, saveExam,
  saveExamResults, saveLearningProgression, setExamStudentOutcome, unassignExamStudent, getStudentQualityThresholds, updateStudentQualityThresholds,
  saveStudent, saveStudentResource, updateEnrollmentStatus, updateStudentAssessment, updateLearningRoadmap,
  updatePayment,
  type BatchRecord, type CourseCategoryRecord, type CourseRecord, type ExamRecord, type PaymentRecord, type QualityRow,
  type BatchProgression, type ProgressionIntent, type QualityAssignment, type StudentLearningHistory, type StudentNotification, type StudentQualityDetail, type StudentQualityThresholds, type StudentRecord, type StudentResource, type StudentResourceCategory,
} from '@/features/studentManagementApi';

type Area = 'students' | 'courses' | 'batches' | 'quality' | 'exams' | 'fees' | 'retention' | 'roadmap' | 'notifications' | 'classrooms' | 'resources';
const NAV: Array<{ key: Area; label: string; subtitle: string; Icon: typeof UsersRound }> = [
  { key: 'students', label: 'Học viên', subtitle: 'Hồ sơ, trạng thái & lịch sử đào tạo', Icon: UsersRound },
  { key: 'courses', label: 'Khóa học', subtitle: 'Danh mục, thời lượng & học phí', Icon: BookOpen },
  { key: 'batches', label: 'Lớp học', subtitle: 'Lịch học, điểm danh & bài tập', Icon: GraduationCap },
  { key: 'quality', label: 'Chất lượng', subtitle: 'Chuyên cần, bài tập & đánh giá', Icon: ClipboardCheck },
  { key: 'exams', label: 'Lịch thi', subtitle: 'Kỳ thi, xếp thí sinh & kết quả', Icon: CalendarCheck },
  { key: 'fees', label: 'Học phí', subtitle: 'Công nợ, đợt thu & giao dịch', Icon: Banknote },
  { key: 'retention', label: 'Bảo lưu & học lại', subtitle: 'Theo dõi bảo lưu & xếp lớp lại', Icon: PauseCircle },
  { key: 'roadmap', label: 'Lộ trình & chờ lớp', subtitle: 'Chặng học tập & hàng chờ xếp lớp', Icon: Route },
  { key: 'notifications', label: 'Thông báo', subtitle: 'Gửi email & nhắc đợt học phí', Icon: Bell },
  { key: 'classrooms', label: 'Phòng học', subtitle: 'Quản lý phòng & lịch sử dụng', Icon: Building2 },
  { key: 'resources', label: 'Thiết bị', subtitle: 'Thiết bị đào tạo & bảo trì', Icon: Wrench },
];
const STUDENT_SECTIONS: ReadonlyArray<ModuleSectionItem<Area>> = NAV.map(({ key, label, subtitle }) => ({
  key,
  label,
  subtitle,
  renderIcon: (size) => <StudentTabIcon id={key} size={size} />,
}));
function getInitials(name?: string) {
  return (
    name
      ?.trim()
      .split(/\s+/)
      .slice(-2)
      .map((part) => part[0]?.toLocaleUpperCase('vi'))
      .join('') || 'HV'
  );
}
const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Thứ 2' },
  { value: 2, label: 'Thứ 3' },
  { value: 3, label: 'Thứ 4' },
  { value: 4, label: 'Thứ 5' },
  { value: 5, label: 'Thứ 6' },
  { value: 6, label: 'Thứ 7' },
  { value: 0, label: 'Chủ nhật' },
] as const;
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const normalize = (value: string) => value.trim().toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
const money = (value: unknown) => `${Math.round(Number(value) || 0).toLocaleString('vi-VN')} VND`;
const formatVndInput = (value: unknown) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits ? Number(digits).toLocaleString('vi-VN') : '';
};
const parseVndInput = (value: string) => Number(String(value || '').replace(/\D/g, '')) || 0;
const toDisplayDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '');
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
};
const toIsoDate = (value: string) => {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value || '');
  return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : value;
};
const dateKey = (value?: string) => {
  const input = String(value || '').trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(input);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const display = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input);
  return display ? `${display[3]}-${display[2].padStart(2, '0')}-${display[1].padStart(2, '0')}` : '';
};
const matchesDateRange = (value: string | undefined, from: string, to: string) => {
  const key = dateKey(value);
  return (!from || Boolean(key && key >= from)) && (!to || Boolean(key && key <= to));
};
const statusOf = (student: StudentRecord) => Array.isArray(student.status) ? student.status[0] || 'Đang học' : 'Đang học';
const hasStudentStatus = (student: StudentRecord, status: string) => Array.isArray(student.status) ? student.status.includes(status) : student.status === status;
const lifecycleStatuses = new Set(['Chờ nhập học', 'Đang học', 'Đang thi', 'Đã đậu', 'Thi lại', 'Bảo lưu', 'Chờ xếp học lại', 'Đã tốt nghiệp', 'Nghỉ học', 'Đã nghỉ']);
const statusListForSave = (selected: string, existing?: string[] | string) => [selected, ...(Array.isArray(existing) ? existing : existing ? [existing] : []).filter((value) => value !== selected && !lifecycleStatuses.has(value))];
const studentFee = (student: StudentRecord) => Number(String(student.fee || '').replace(/\D/g, '')) || 0;
const studentDue = (student: StudentRecord) => Math.max(0, studentFee(student) - Number(student.paidAmount || 0));

type PickOption = { value: string; label: string; detail?: string };
type FormField = { key: string; label: string; placeholder?: string; multiline?: boolean; keyboardType?: ComponentProps<typeof TextInput>['keyboardType']; mode?: 'date' | 'time'; options?: PickOption[] };
type WaitlistRecord = Record<string, unknown> & { id?: string; _id?: string; studentId?: string; studentName?: string; studentPhone?: string; sourceBatchCode?: string; roadmapName?: string; idValue?: string };
type RoadmapRecord = { id?: string; _id?: string; code?: string; name?: string; description?: string; status?: string; steps?: Array<Record<string, unknown>> };
type InstallmentRecord = Record<string, unknown> & { no?: number; amountDue?: number; amountPaid?: number; dueDate?: string; status?: string };
type EnrolledRecord = { studentId: string; batchId?: string; status?: string; suspensionReason?: string; expectedReturnAt?: string; allowedSessions?: number; attendedSessions?: number };
type QrSession = { sessionId: string; token: string; url: string; expiresAt?: number; checkedIn: number };
type ProgressionDraft = { intent: ProgressionIntent; teacherNote: string };
type ProgressionDialogState = { batch: BatchRecord; roadmaps: RoadmapRecord[]; roadmapId: string; data: BatchProgression | null; loading: boolean; targetBatchId: string };
type RoadmapStepRule = { minClassSize: string; maxClassSize: string; matchMode: 'all' | 'any'; minAttendanceRate: string; minAssignmentRate: string; minMiniTestRate: string; minExamRate: string };
const emptyRoadmapStepRule = (): RoadmapStepRule => ({ minClassSize: '', maxClassSize: '', matchMode: 'all', minAttendanceRate: '', minAssignmentRate: '', minMiniTestRate: '', minExamRate: '' });

const emptyDraft = () => ({
  fullName: '', phone: '', email: '', birthday: '', idCard: '', address: '', referralMode: 'none', partnerId: '', referral: '', registrationDate: today(), enrollmentDate: '', courseId: '', fee: '', status: 'Đang học',
  code: '', title: '', category: '', duration: '', maxLearners: '30', courseName: '', name: '', quota: '', instructorId: '', instructorName: '', learningMode: 'standalone', roadmapId: '', roadmapStepId: '', daysOfWeek: '1,3,5', startTime: '18:00', endTime: '20:00', location: '', startDate: today(), endDate: today(), batchId: '', tentativeDate: today(), officialDate: '', maxScore: '100', passScore: '50',
  studentId: '', amount: '', method: 'Chuyển khoản', date: today(), note: '', recipients: 'Tất cả học viên đang học', content: '', installmentReminder: 'Không', installmentNo: '1', installmentPercent: '30', installmentLabel: 'Đợt 1', installmentDueDate: '', resourceType: 'Phòng học', identifier: '', capacity: '30', resourceStatus: 'AVAILABLE', purpose: '', by: '', bookingDate: today(),
  roadmapStatus: 'active', expectedReturnAt: '', reason: '', targetBatchId: '', retakeFee: '', miniTestTitle: '', miniTestDate: today(), miniTestScore: '', miniTestMax: '10', miniTestNote: '', attitudeNote: '', teacherAssessment: '',
});
type Draft = ReturnType<typeof emptyDraft>;

export function StudentManagementScreen(_props: FeatureScreenProps) {
  const insets = useSafeAreaInsets();
  const { user, activeBranchId, setActiveBranchId } = useAuth();
  const permissions = user?.permissions || [];
  const canManage = Boolean(user?.role === 'admin' || user?.role === 'superadmin' || permissions.includes('*') || permissions.includes('people:manage'));
  const canRead = canManage || permissions.includes('people:read');
  const canSwitchBranch = user?.role === 'admin' || user?.role === 'superadmin';
  const isSuperAdmin = user?.role === 'superadmin';
  const [companies, setCompanies] = useState<Array<{ code: string; name: string; uid?: string }>>([]);
  const [companyCode, setCompanyCode] = useState(user?.companyCode || '');
  const [companyPickerOpen, setCompanyPickerOpen] = useState(false);
  const [branches, setBranches] = useState<ErpBranch[]>([]);
  const [branchPickerOpen, setBranchPickerOpen] = useState(false);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const branchId = activeBranchId || user?.branchId;
  const selectedCompany = companies.find((item) => item.code === companyCode);
  const ownerFilter = isSuperAdmin ? selectedCompany?.uid || selectedCompany?.code : undefined;
  const scope = useMemo(() => ({ branchId, ...(ownerFilter ? { ownerFilter } : {}) }), [branchId, ownerFilter]);
  const companyName = selectedCompany?.name || companyCode || 'Chọn cơ sở';
  const branchName = branches.find((branch) => branch._id === branchId)?.name || user?.branchName || 'Chọn chi nhánh';

  const [area, setArea] = useState<Area>('students');
  const sectionOpacity = useRef(new Animated.Value(1)).current;
  const sectionTranslateX = useRef(new Animated.Value(0)).current;
  const transitionDirRef = useRef<number>(0);
  useEffect(() => {
    const startX = transitionDirRef.current === 0 ? 0 : transitionDirRef.current * 18;
    sectionOpacity.setValue(0.35);
    sectionTranslateX.setValue(startX);
    Animated.parallel([
      Animated.timing(sectionOpacity, {
        toValue: 1,
        duration: 210,
        useNativeDriver: true,
      }),
      Animated.timing(sectionTranslateX, {
        toValue: 0,
        duration: 210,
        useNativeDriver: true,
      }),
    ]).start();
  }, [area, sectionOpacity, sectionTranslateX]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [partners, setPartners] = useState<StudentPartner[]>([]);
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [courseCategories, setCourseCategories] = useState<CourseCategoryRecord[]>([]);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [instructors, setInstructors] = useState<HrEmployee[]>([]);
  const [viewingBatch, setViewingBatch] = useState<BatchRecord | null>(null);
  const [historyBatch, setHistoryBatch] = useState<BatchRecord | null>(null);
  const [assignmentsBatch, setAssignmentsBatch] = useState<BatchRecord | null>(null);
  const [exams, setExams] = useState<ExamRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [notifications, setNotifications] = useState<StudentNotification[]>([]);
  const [resources, setResources] = useState<StudentResource[]>([]);
  const [resourceCategories, setResourceCategories] = useState<StudentResourceCategory[]>([]);
  const [quality, setQuality] = useState<QualityRow[]>([]);
  const [roadmaps, setRoadmaps] = useState<RoadmapRecord[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('Tất cả');
  const [courseFilter, setCourseFilter] = useState('Tất cả');
  const [progressFilter, setProgressFilter] = useState('Tất cả');
  const [batchFilter, setBatchFilter] = useState('Tất cả');
  const [feeFilter, setFeeFilter] = useState('Tất cả học phí');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [resourceTypeFilter, setResourceTypeFilter] = useState('Tất cả');
  const [sortFilter, setSortFilter] = useState('newest');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [roadmapCourseIds, setRoadmapCourseIds] = useState<string[]>(['']);
  const [roadmapStepRules, setRoadmapStepRules] = useState<RoadmapStepRule[]>([emptyRoadmapStepRule()]);
  const [saving, setSaving] = useState(false);
  const [pickerField, setPickerField] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  const [studentDetail, setStudentDetail] = useState<StudentRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [installments, setInstallments] = useState<InstallmentRecord[]>([]);
  const [learningHistory, setLearningHistory] = useState<StudentLearningHistory | null>(null);
  const [paymentToEdit, setPaymentToEdit] = useState<PaymentRecord | null>(null);

  const [manageBatch, setManageBatch] = useState<BatchRecord | null>(null);
  const [enrollments, setEnrollments] = useState<EnrolledRecord[]>([]);
  const [batchBusy, setBatchBusy] = useState(false);
  const [attendanceBatch, setAttendanceBatch] = useState<BatchRecord | null>(null);
  const [attendanceDate, setAttendanceDate] = useState(today());
  const [attendanceDraft, setAttendanceDraft] = useState<Record<string, 'present' | 'absent' | 'excused' | 'late'>>({});
  const [attendanceLearners, setAttendanceLearners] = useState<EnrolledRecord[]>([]);
  const [qrSession, setQrSession] = useState<QrSession | null>(null);
  const [qrCreating, setQrCreating] = useState(false);
  const [registerQrOpen, setRegisterQrOpen] = useState(false);
  const [registerQrUrl, setRegisterQrUrl] = useState('');
  const [registerQrLoading, setRegisterQrLoading] = useState(false);
  const [qualityDetail, setQualityDetail] = useState<QualityRow | null>(null);
  const [qualityDetailData, setQualityDetailData] = useState<StudentQualityDetail | null>(null);
  const [qualityDetailLoading, setQualityDetailLoading] = useState(false);
  const [savingAssessment, setSavingAssessment] = useState(false);
  const [assignmentGrade, setAssignmentGrade] = useState<{ id: string; score: string; feedback: string } | null>(null);
  const [qualityThresholdDialog, setQualityThresholdDialog] = useState(false);
  const [qualityThresholds, setQualityThresholds] = useState<StudentQualityThresholds>({ riskAttendance: 70, riskAssignment: 50, riskMiniTest: 50, watchAttendance: 85, watchAssignment: 70, watchMiniTest: 70, assignmentMaxScore: 10 });
  const [assignmentDraft, setAssignmentDraft] = useState<{ exam: ExamRecord; candidates: StudentRecord[]; selected: string[] } | null>(null);
  const [scoreDialog, setScoreDialog] = useState<{ exam: ExamRecord; students: StudentRecord[] } | null>(null);
  const [scoreValues, setScoreValues] = useState<Record<string, string>>({});
  const [enrollmentAction, setEnrollmentAction] = useState<{ batch: BatchRecord; enrollment: EnrolledRecord; student?: StudentRecord } | null>(null);
  const [bookingResource, setBookingResource] = useState<StudentResource | null>(null);
  const [progressionDialog, setProgressionDialog] = useState<ProgressionDialogState | null>(null);
  const [progressionClassCreate, setProgressionClassCreate] = useState(false);
  const [progressionDrafts, setProgressionDrafts] = useState<Record<string, ProgressionDraft>>({});

  
  useEffect(() => {
    if (!isSuperAdmin) { setCompanyCode(user?.companyCode || ''); return; }
    let active = true;
    void listWorkerCompanies().then((items) => {
      if (!active) return;
      const valid = items.filter((item): item is { code: string; name: string; uid?: string } => Boolean(item.code)).map((item) => ({ code: item.code!, name: item.name || item.code!, uid: item.uid }));
      setCompanies(valid);
      setCompanyCode((current) => {
        if (current && valid.some((item) => item.code === current)) return current;
        const userCenter = user?.companyCode;
        return valid.find((item) => item.uid === userCenter || item.code === userCenter)?.code || valid[0]?.code || '';
      });
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Không tải được danh sách cơ sở.'); });
    return () => { active = false; };
  }, [isSuperAdmin, user?.companyCode]);

  useEffect(() => {
    const branchCompanyCode = isSuperAdmin ? companyCode : user?.companyCode;
    if (!canSwitchBranch || !branchCompanyCode) { setBranches([]); return; }
    const controller = new AbortController();
    setBranchesLoading(true);
    void fetchCompanyBranches(controller.signal, branchCompanyCode).then((list) => {
      if (controller.signal.aborted) return;
      setBranches(list);
      setActiveBranchId((current) => current && list.some((branch) => branch._id === current) ? current : user?.branchId && list.some((branch) => branch._id === user.branchId) ? user.branchId : list[0]?._id);
    }).catch((cause) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Không tải được danh sách chi nhánh.');
    }).finally(() => { if (!controller.signal.aborted) setBranchesLoading(false); });
    return () => controller.abort();
  }, [canSwitchBranch, companyCode, isSuperAdmin, setActiveBranchId, user?.branchId, user?.companyCode]);

  const load = useCallback(async (quiet = false) => {
    if (!canRead) { setLoading(false); setRefreshing(false); return; }
    if (canSwitchBranch && branchesLoading) { setLoading(true); setRefreshing(false); return; }
    if (isSuperAdmin && !ownerFilter) { setError('Chọn cơ sở để tải dữ liệu Học viên.'); setLoading(false); setRefreshing(false); return; }
    if (!quiet) setLoading(true);
    setError('');
    try {
      if (area === 'students') { const [nextStudents, nextCourses, nextBatches, nextPartners] = await Promise.all([listStudents(scope), listCourses(scope), listBatches(scope), listStudentPartners(branchId).catch(() => [] as StudentPartner[])]); setStudents(nextStudents); setCourses(nextCourses); setBatches(nextBatches); setPartners(nextPartners); }
      else if (area === 'courses') { const [nextCourses, nextCategories] = await Promise.all([listCourses(scope), listCourseCategories(scope).catch(() => [] as CourseCategoryRecord[])]); setCourses(nextCourses); setCourseCategories(nextCategories); }
      else if (area === 'batches') { const [nextBatches, nextCourses, nextStudents, nextRoadmaps, nextInstructors] = await Promise.all([listBatches(scope), listCourses(scope), listStudents(scope), listLearningRoadmaps(scope), listHrEmployees(companyCode || user?.companyCode, branchId).catch(() => [] as HrEmployee[])]); setBatches(nextBatches); setCourses(nextCourses); setStudents(nextStudents); setRoadmaps(nextRoadmaps as RoadmapRecord[]); setInstructors(nextInstructors); }
      else if (area === 'quality') setQuality(await listStudentQuality(scope, search || undefined));
      else if (area === 'exams') { const [nextExams, nextBatches, nextStudents] = await Promise.all([listExams(scope), listBatches(scope), listStudents(scope)]); setExams(nextExams); setBatches(nextBatches); setStudents(nextStudents); }
      else if (area === 'fees') { const [nextStudents, nextPayments] = await Promise.all([listStudents(scope), listPayments(scope)]); setStudents(nextStudents); setPayments(nextPayments); }
      else if (area === 'notifications') { const [nextNotifications, nextStudents, nextExams, nextCourses] = await Promise.all([listStudentNotifications(scope), listStudents(scope), listExams(scope), listCourses(scope)]); setNotifications(nextNotifications); setStudents(nextStudents); setExams(nextExams); setCourses(nextCourses); }
      else if (area === 'classrooms' || area === 'resources') {
        const [nextResources, nextCategories, nextBatches] = await Promise.all([listStudentResources(scope), listStudentResourceCategories(scope).catch(() => [] as StudentResourceCategory[]), area === 'classrooms' ? listBatches(scope) : Promise.resolve([] as BatchRecord[])]);
        setResources(nextResources); setResourceCategories(nextCategories); if (area === 'classrooms') setBatches(nextBatches);
      }
      else if (area === 'retention') {
        const [nextBatches, nextStudents] = await Promise.all([listBatches(scope), listStudents(scope)]);
        setBatches(nextBatches); setStudents(nextStudents);
        const results = await Promise.all(nextBatches.map(async (batch) => {
          const rows = await getBatchEnrollments(batch.id, scope);
          return rows.map((row) => ({ ...(row as unknown as EnrolledRecord), batchId: batch.id, studentId: String((row as unknown as Record<string, unknown>).studentId || (row as unknown as Record<string, unknown>)._id || '') }));
        }));
        setEnrollments(results.flat());
      } else {
        const [nextRoadmaps, nextWaitlist, nextBatches, nextCourses] = await Promise.all([listLearningRoadmaps(scope), listWaitlist(scope), listBatches(scope), listCourses(scope)]);
        setRoadmaps(nextRoadmaps as RoadmapRecord[]); setWaitlist(nextWaitlist as WaitlistRecord[]); setBatches(nextBatches); setCourses(nextCourses);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được dữ liệu phân hệ Học viên.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [area, branchesLoading, canRead, canSwitchBranch, isSuperAdmin, ownerFilter, scope, search]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!qrSession?.sessionId) return;
    const timer = setInterval(() => {
      void getStudentQrStatus(qrSession.sessionId, scope).then((result) => setQrSession((current) => current ? { ...current, checkedIn: result.checkedIn || result.students?.length || 0 } : current)).catch(() => { });
    }, 5000);
    return () => clearInterval(timer);
  }, [qrSession?.sessionId, scope]);

  const visibleStudents = useMemo(() => students.filter((student) => {
    const query = normalize(search);
    const text = normalize(`${student.fullName} ${student.phone} ${student.email || ''} ${student.idCard || ''}`);
    const assignedBatch = batches.find((batch) => batch.learnerIds?.includes(student.id) || batch.code === student.batchCode);
    const courseId = student.courseId || assignedBatch?.courseId;
    const totalFee = studentFee(student);
    const paid = Number(student.paidAmount || 0);
    const due = Math.max(0, totalFee - paid);
    const matchesFee = feeFilter === 'Tất cả học phí'
      || (feeFilter === 'Miễn phí' && totalFee === 0)
      || (feeFilter === 'Đã đóng đủ' && totalFee > 0 && due === 0)
      || (feeFilter === 'Chưa đóng' && totalFee > 0 && paid === 0)
      || (feeFilter === 'Còn thiếu' && paid > 0 && due > 0);
    return (!query || text.includes(query))
      && (area !== 'students' || statusFilter === 'Tất cả' || hasStudentStatus(student, statusFilter))
      && (area !== 'students' || courseFilter === 'Tất cả' || courseId === courseFilter)
      && (area !== 'students' || matchesFee)
      && (area !== 'students' || matchesDateRange(student.registrationDate || student.enrollmentDate, dateFromFilter, dateToFilter));
  }).sort((left, right) => {
    if (sortFilter === 'name-asc' || sortFilter === 'name-desc') {
      const compared = left.fullName.localeCompare(right.fullName, 'vi', { sensitivity: 'base' });
      return sortFilter === 'name-asc' ? compared : -compared;
    }
    const leftDate = dateKey(left.registrationDate || left.enrollmentDate);
    const rightDate = dateKey(right.registrationDate || right.enrollmentDate);
    return sortFilter === 'oldest' ? leftDate.localeCompare(rightDate) : rightDate.localeCompare(leftDate);
  }), [students, batches, search, statusFilter, courseFilter, feeFilter, dateFromFilter, dateToFilter, sortFilter, area]);
  const visibleCourses = useMemo(() => courses.filter((item) => (!search || normalize(`${item.code} ${item.title} ${item.category}`).includes(normalize(search))) && (courseFilter === 'Tất cả' || item.category === courseFilter) && (statusFilter === 'Tất cả' || (item.status || 'Hoạt động') === statusFilter)), [courses, search, statusFilter, courseFilter]);
  const visibleBatches = useMemo(() => batches.filter((item) => {
    const done = Number(item.progress?.doneSessions || 0);
    const total = Number(item.progress?.totalSessions || 0);
    const matchesProgress = progressFilter === 'Tất cả' || (progressFilter === 'Chưa bắt đầu' && done === 0) || (progressFilter === 'Có tiến độ' && done > 0 && (!total || done < total)) || (progressFilter === 'Hoàn thành' && total > 0 && done >= total);
    return (!search || normalize(`${item.code} ${item.name || ''} ${item.courseTitle || ''} ${item.instructorName || ''}`).includes(normalize(search))) && (statusFilter === 'Tất cả' || (item.status || 'Sắp khai giảng') === statusFilter) && (courseFilter === 'Tất cả' || item.courseId === courseFilter) && matchesProgress;
  }), [batches, search, statusFilter, courseFilter, progressFilter]);
  const visibleExams = useMemo(() => exams.filter((item) => (!search || normalize(`${item.name} ${item.location || ''} ${item.batchCode || ''}`).includes(normalize(search))) && (statusFilter === 'Tất cả' || item.status === statusFilter) && (batchFilter === 'Tất cả' || item.batchId === batchFilter) && matchesDateRange(item.tentativeDate || item.officialDate, dateFromFilter, dateToFilter)), [exams, search, statusFilter, batchFilter, dateFromFilter, dateToFilter]);
  const visibleQuality = useMemo(() => quality.filter((item) => (!search || normalize(`${item.studentName} ${item.studentPhone || ''} ${item.batchCode} ${item.courseTitle}`).includes(normalize(search))) && (statusFilter === 'Tất cả' || item.warningLevel === statusFilter) && (batchFilter === 'Tất cả' || item.batchId === batchFilter) && (courseFilter === 'Tất cả' || batches.find((batch) => batch.id === item.batchId)?.courseId === courseFilter)), [quality, search, statusFilter, batchFilter, courseFilter, batches]);
  const visiblePayments = useMemo(() => payments.filter((item) => {
    const student = students.find((row) => row.id === item.studentId);
    const name = item.studentName || student?.fullName || '';
    const due = student ? studentDue(student) : 0;
    const total = student ? studentFee(student) : 0;
    return (!search || normalize(`${name} ${student?.phone || ''} ${item.method || ''} ${item.note || ''}`).includes(normalize(search)))
      && matchesDateRange(item.date || item.paidOn, dateFromFilter, dateToFilter)
      && (feeFilter === 'Tất cả học phí' || (feeFilter === 'Còn nợ' && due > 0) || (feeFilter === 'Đã hoàn thành' && total > 0 && due === 0) || (feeFilter === 'Miễn phí' && total === 0));
  }), [payments, students, search, dateFromFilter, dateToFilter, feeFilter]);
  const visibleFeeStudents = useMemo(() => students.filter((student) => {
    const text = normalize(`${student.fullName} ${student.phone} ${student.email || ''}`);
    const due = studentDue(student);
    const total = studentFee(student);
    return (!search || text.includes(normalize(search)))
      && (feeFilter === 'Tất cả học phí' || feeFilter === 'Tất cả' || (feeFilter === 'Còn nợ' && due > 0) || (feeFilter === 'Đã hoàn thành' && total > 0 && due === 0) || (feeFilter === 'Miễn phí' && total === 0));
  }), [students, search, feeFilter]);
  const visibleNotifications = useMemo(() => notifications.filter((item) => (!search || normalize(`${item.title} ${item.content} ${item.recipients || ''}`).includes(normalize(search))) && (statusFilter === 'Tất cả' || item.status === statusFilter)), [notifications, search, statusFilter]);
  const visibleEnrollments = useMemo(() => enrollments.filter((item) => ['Bảo lưu', 'Chờ xếp học lại'].includes(item.status || '') && (!search || normalize(`${students.find((student) => student.id === item.studentId)?.fullName || ''} ${students.find((student) => student.id === item.studentId)?.phone || ''}`).includes(normalize(search))) && (statusFilter === 'Tất cả' || item.status === statusFilter)), [enrollments, students, search, statusFilter]);
  const visibleResources = useMemo(() => resources.filter((item) => (area === 'classrooms' ? normalize(item.type).includes('phong hoc') : !normalize(item.type).includes('phong hoc')) && (!search || normalize(`${item.name} ${item.identifier} ${item.type}`).includes(normalize(search))) && (statusFilter === 'Tất cả' || item.status === statusFilter) && (resourceTypeFilter === 'Tất cả' || item.type === resourceTypeFilter)), [resources, area, search, statusFilter, resourceTypeFilter]);
  const visibleResourceCategories = useMemo(() => resourceCategories.filter((item) => area === 'classrooms' ? normalize(item.name).includes('phong hoc') : !normalize(item.name).includes('phong hoc')), [area, resourceCategories]);
  const visibleRoadmaps = useMemo(() => roadmaps.filter((item) => (!search || normalize(`${item.code || ''} ${item.name || ''} ${item.description || ''}`).includes(normalize(search))) && (statusFilter === 'Tất cả' || (item.status === 'active' ? 'Đang áp dụng' : 'Tạm dừng') === statusFilter)), [roadmaps, search, statusFilter]);
  const visibleWaitlist = useMemo(() => waitlist.filter((item) => !search || normalize(`${item.studentName || ''} ${item.studentPhone || ''} ${item.sourceBatchCode || ''} ${item.roadmapName || ''}`).includes(normalize(search))), [waitlist, search]);

  useEffect(() => { setPage(1); }, [area, search, statusFilter, courseFilter, progressFilter, batchFilter, feeFilter, dateFromFilter, dateToFilter, resourceTypeFilter]);

  const resetFilters = () => { setStatusFilter('Tất cả'); setCourseFilter('Tất cả'); setProgressFilter('Tất cả'); setBatchFilter('Tất cả'); setFeeFilter('Tất cả học phí'); setDateFromFilter(''); setDateToFilter(''); setResourceTypeFilter('Tất cả'); setSortFilter('newest'); };
  const activeFilterCount = Number(statusFilter !== 'Tất cả') + Number(courseFilter !== 'Tất cả') + Number(progressFilter !== 'Tất cả') + Number(batchFilter !== 'Tất cả') + Number(feeFilter !== 'Tất cả học phí') + Number(Boolean(dateFromFilter || dateToFilter)) + Number(resourceTypeFilter !== 'Tất cả');
  const resultCount = area === 'students' ? visibleStudents.length : area === 'courses' ? visibleCourses.length : area === 'batches' ? visibleBatches.length : area === 'quality' ? visibleQuality.length : area === 'exams' ? visibleExams.length : area === 'fees' ? visiblePayments.length + visibleFeeStudents.length : area === 'retention' ? visibleEnrollments.length : area === 'notifications' ? visibleNotifications.length : area === 'roadmap' ? 0 : visibleResources.length;
  const pageCount = Math.max(1, Math.ceil(resultCount / pageSize));

  async function exportCurrentArea() {
    const csv = (headers: string[], rows: unknown[][]) => saveAndShareCsv(headers, rows, `hoc-vien-${area}-${today()}.csv`);
    try {
      if (area === 'courses') await csv(['Mã khóa', 'Tên khóa', 'Danh mục', 'Thời lượng', 'Học phí', 'Sĩ số tối đa', 'Trạng thái'], visibleCourses.map((item) => [item.code, item.title, item.category, item.duration, item.fee, item.maxLearners, item.status]));
      else if (area === 'batches') await csv(['Mã lớp', 'Tên lớp', 'Khóa học', 'Giảng viên', 'Ngày bắt đầu', 'Ngày kết thúc', 'Sĩ số', 'Trạng thái'], visibleBatches.map((item) => [item.code, item.name, item.courseTitle, item.instructorName, item.startDate, item.endDate, item.learnerIds?.length, item.status]));
      else if (area === 'quality') await csv(['Học viên', 'Điện thoại', 'Lớp', 'Khóa học', 'Chuyên cần (%)', 'Bài tập (%)', 'Mức đánh giá'], visibleQuality.map((item) => [item.studentName, item.studentPhone, item.batchCode, item.courseTitle, item.attendance.rate, item.assignments.rate, item.warningLevel]));
      else if (area === 'exams') await csv(['Kỳ thi', 'Lớp', 'Ngày dự kiến', 'Ngày chính thức', 'Địa điểm', 'Thí sinh', 'Đậu', 'Trượt', 'Trạng thái'], visibleExams.map((item) => [item.name, item.batchCode, item.tentativeDate, item.officialDate, item.location, item.studentCount, item.passCount, item.failCount, item.status]));
      else if (area === 'fees') await csv(['Học viên', 'Ngày thu', 'Số tiền', 'Phương thức', 'Ghi chú'], visiblePayments.map((item) => [item.studentName || students.find((student) => student.id === item.studentId)?.fullName, item.date || item.paidOn, item.amount, item.method, item.note]));
      else if (area === 'retention') await csv(['Học viên', 'Lớp', 'Trạng thái', 'Lý do', 'Ngày dự kiến quay lại'], visibleEnrollments.map((item) => [students.find((student) => student.id === item.studentId)?.fullName, batches.find((batch) => batch.id === item.batchId)?.code, item.status, item.suspensionReason, item.expectedReturnAt]));
      else if (area === 'roadmap') await csv(['Mã lộ trình', 'Tên lộ trình', 'Trạng thái', 'Mô tả'], visibleRoadmaps.map((item) => [item.code, item.name, item.status, item.description]));
      else if (area === 'notifications') await csv(['Tiêu đề', 'Thời gian', 'Đối tượng', 'Số người nhận', 'Trạng thái', 'Nội dung'], visibleNotifications.map((item) => [item.title, item.createdAt, item.recipients, item.recipientCount, item.status, item.content]));
      else await csv(['Tên', 'Loại', 'Mã định danh', 'Sức chứa', 'Trạng thái', 'Số lịch đặt'], visibleResources.map((item) => [item.name, item.type, item.identifier, item.capacity, resourceStatusLabel(item.status), item.bookings?.length || 0]));
    } catch (cause) { Alert.alert('Không xuất được dữ liệu', cause instanceof Error ? cause.message : 'Không tạo được tệp xuất.'); }
  }

  const openCreate = () => { setEditingId(undefined); setPaymentToEdit(null); setRoadmapCourseIds(['']); setRoadmapStepRules([emptyRoadmapStepRule()]); const defaultStatus = area === 'courses' ? 'Hoạt động' : area === 'batches' ? 'Sắp khai giảng' : area === 'exams' ? 'Sắp diễn ra' : 'Đang học'; setDraft({ ...emptyDraft(), status: defaultStatus, resourceType: area === 'classrooms' ? 'Phòng học' : area === 'resources' ? 'Thiết bị' : 'Phòng học' }); setFormOpen(true); };
  const openStudentPayment = (student: StudentRecord) => { setEditingId(undefined); setPaymentToEdit(null); setDraft({ ...emptyDraft(), studentId: student.id, date: today() }); setFormOpen(true); };
  const openProgressionClassForm = () => {
    const activeProgression = progressionDialog;
    const step = activeProgression?.data?.targetStep;
    if (!activeProgression || !step) return;
    const { batch, roadmapId } = activeProgression;
    const baseCode = `${batch.code}-L${step.order}`.slice(0, 46);
    const used = new Set(batches.map((item) => normalize(item.code)));
    let code = baseCode;
    let suffix = 2;
    while (used.has(normalize(code))) code = `${baseCode}-${suffix++}`.slice(0, 50);
    setEditingId(undefined); setPaymentToEdit(null); setProgressionClassCreate(true);
    setDraft({ ...emptyDraft(), status: 'Sắp khai giảng', code, learningMode: 'roadmap', roadmapId, roadmapStepId: step.id, courseId: step.courseId, instructorId: batch.instructorId || '', instructorName: batch.instructorName || '', daysOfWeek: (batch.daysOfWeek || [1, 3, 5]).join(','), startTime: batch.startTime || '18:00', endTime: batch.endTime || '20:00', location: batch.location || '', startDate: today(), endDate: today() });
    setFormOpen(true);
  };
  const openEdit = (item: StudentRecord | CourseRecord | BatchRecord | ExamRecord | StudentResource | PaymentRecord | RoadmapRecord) => {
    setEditingId(item.id || item._id);
    const base = emptyDraft(); setPaymentToEdit(null);
    if ('fullName' in item) Object.assign(base, { ...item, birthday: toIsoDate(item.birthday || ''), registrationDate: toIsoDate(item.registrationDate || '') || today(), enrollmentDate: toIsoDate(item.enrollmentDate || ''), status: statusOf(item), fee: formatVndInput(item.fee), partnerId: item.partnerId || '', referral: item.referral || '', referralMode: item.partnerId ? 'partner' : item.referral?.trim() ? 'custom' : 'none' });
    else if ('category' in item) Object.assign(base, { code: item.code, title: item.title, category: item.category, duration: item.duration, fee: formatVndInput(item.fee), maxLearners: String(item.maxLearners || 30), status: item.status || 'Hoạt động' });
    else if ('courseId' in item) Object.assign(base, { code: item.code, name: item.name || '', courseId: item.courseId, quota: item.quota != null ? String(item.quota) : '', instructorId: item.instructorId || '', instructorName: item.instructorName || '', learningMode: item.roadmapId ? 'roadmap' : 'standalone', roadmapId: item.roadmapId || '', roadmapStepId: item.roadmapStepId || '', location: item.location || '', startDate: item.startDate || today(), endDate: item.endDate || today(), startTime: item.startTime || '18:00', endTime: item.endTime || '20:00', status: item.status || 'Sắp khai giảng', daysOfWeek: (item.daysOfWeek || []).join(',') });
    else if ('tentativeDate' in item) Object.assign(base, { name: item.name, status: item.status, tentativeDate: toIsoDate(item.tentativeDate || '') || today(), officialDate: toIsoDate(item.officialDate || ''), location: item.location || '', batchId: item.batchId || '', maxScore: String(item.maxScore || 100), passScore: String(item.passScore ?? 50) });
    else if ('identifier' in item) Object.assign(base, { name: item.name, resourceType: item.type, identifier: item.identifier, capacity: item.capacity, resourceStatus: item.status });
    else if ('amount' in item) { setPaymentToEdit(item); Object.assign(base, { studentId: item.studentId, amount: formatVndInput(item.amount), method: item.method || 'Chuyển khoản', date: item.date || item.paidOn || today(), note: item.note || '' }); }
    else if ('steps' in item) Object.assign(base, { code: item.code || '', title: item.name || '', content: item.description || '', roadmapStatus: item.status || 'active' });
    setDraft(base); setFormOpen(true);
  };

  function formFields(): FormField[] {
    if (area === 'students') {
      const activePartners = partners.filter((item) => item.isActive !== false);
      return [
        { key: 'fullName', label: 'Họ và tên *', placeholder: 'Nhập họ tên' }, { key: 'phone', label: 'Số điện thoại *', keyboardType: 'phone-pad' }, { key: 'email', label: 'Email *', keyboardType: 'email-address' },
        { key: 'birthday', label: 'Ngày sinh', mode: 'date' }, { key: 'idCard', label: 'CCCD / giấy tờ tùy thân' }, { key: 'address', label: 'Địa chỉ', multiline: true },
        { key: 'referralMode', label: 'Nguồn giới thiệu', options: [{ value: 'none', label: 'Không có giới thiệu' }, { value: 'partner', label: 'Đối tác / CTV hệ thống' }, { value: 'custom', label: 'Nhập người giới thiệu khác' }] },
        ...(draft.referralMode === 'partner' ? [{ key: 'partnerId', label: 'Đối tác học viên *', options: activePartners.map((item) => ({ value: item._id, label: item.name, detail: item.phone || item.email || undefined })) }] : []),
        ...(draft.referralMode === 'custom' ? [{ key: 'referral', label: 'Tên người giới thiệu', placeholder: 'Nhập tên người giới thiệu...' }] : []),
        { key: 'registrationDate', label: 'Ngày đăng ký *', mode: 'date' }, { key: 'enrollmentDate', label: 'Ngày nhập học', mode: 'date' }, { key: 'batchId', label: 'Xếp vào lớp', options: batches.map((item) => ({ value: item.id, label: `${item.code} · ${item.courseTitle || item.name || ''}` })) },
      ];
    }
    if (area === 'courses') return [{ key: 'code', label: 'Mã khóa học *' }, { key: 'title', label: 'Tên khóa học *' }, courseCategories.length > 0 ? { key: 'category', label: 'Danh mục khóa học *', options: courseCategories.map((item) => ({ value: item.name, label: item.name })) } : { key: 'category', label: 'Danh mục khóa học *', placeholder: 'VD: Tiếng Anh' }, { key: 'duration', label: 'Số buổi / thời lượng *', placeholder: 'VD: 24 buổi' }, { key: 'fee', label: 'Học phí (VND)', keyboardType: 'number-pad' }, { key: 'maxLearners', label: 'Sĩ số tối đa', keyboardType: 'number-pad' }, { key: 'status', label: 'Trạng thái', options: ['Hoạt động', 'Tạm dừng'].map((value) => ({ value, label: value })) }];
    if (area === 'batches') {
      const selectedRoadmap = roadmaps.find((item) => String(item.id || item._id || '') === draft.roadmapId);
      const stepOptions = (selectedRoadmap?.steps || [])
        .slice()
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
        .map((step, index) => {
          const stepId = String(step.id || `step-${index + 1}`);
          const courseTitle = courses.find((c) => c.id === String(step.courseId || ''))?.title || 'Khóa học';
          return { value: stepId, label: `Chặng ${step.order || index + 1}: ${courseTitle}` };
        });
      return [
        { key: 'code', label: 'Mã lớp *' }, { key: 'name', label: 'Tên lớp' },
        { key: 'learningMode', label: 'Hình thức lớp', options: [{ value: 'standalone', label: 'Lớp độc lập' }, { value: 'roadmap', label: 'Theo lộ trình' }] },
        ...(draft.learningMode === 'roadmap'
          ? [
            { key: 'roadmapId', label: 'Lộ trình học *', options: roadmaps.filter((item) => item.status !== 'inactive').map((item) => ({ value: String(item.id || item._id || ''), label: item.name || item.code || 'Lộ trình' })) },
            { key: 'roadmapStepId', label: 'Chặng học *', options: stepOptions },
          ]
          : [{ key: 'courseId', label: 'Khóa học *', options: courses.map((item) => ({ value: item.id, label: `${item.code} · ${item.title}` })) }]),
        { key: 'quota', label: 'Sĩ số tối đa (để trống = theo khóa học)', keyboardType: 'number-pad', placeholder: 'VD: 30' },
        instructors.length > 0
          ? { key: 'instructorId', label: 'Giảng viên', options: [{ value: '', label: 'Chưa phân công' }, ...instructors.map((emp) => ({ value: String(emp.uid || emp._id || emp.id || ''), label: emp.displayName, detail: emp.email || emp.department || undefined })).filter((opt) => Boolean(opt.value))] }
          : { key: 'instructorName', label: 'Giảng viên', placeholder: 'Nhập tên giảng viên' },
        { key: 'daysOfWeek', label: 'Ngày học trong tuần *' }, { key: 'startTime', label: 'Giờ bắt đầu', mode: 'time' }, { key: 'endTime', label: 'Giờ kết thúc', mode: 'time' }, { key: 'startDate', label: 'Ngày khai giảng *', mode: 'date' }, { key: 'endDate', label: 'Ngày kết thúc *', mode: 'date' }, { key: 'location', label: 'Địa điểm' }, { key: 'status', label: 'Trạng thái', options: ['Sắp khai giảng', 'Đang học', 'Đã kết thúc', 'Đã hủy'].map((value) => ({ value, label: value })) },
      ];
    }
    if (area === 'exams') {
      const eligibleBatches = batches.filter((item) => item.status === 'Đang học' || item.id === draft.batchId);
      return [
        { key: 'name', label: 'Tên kỳ thi *' },
        { key: 'batchId', label: 'Lớp học (đang học) *', options: eligibleBatches.map((item) => ({ value: item.id, label: `${item.code} · ${item.courseTitle || item.name || ''}`, detail: item.endDate ? `Kết thúc: ${toDisplayDate(item.endDate)} · ${item.status || ''}` : item.status })) },
        { key: 'status', label: 'Trạng thái', options: ['Sắp diễn ra', 'Đã xác nhận', 'Đã hoàn thành', 'Đã hủy'].map((value) => ({ value, label: value })) },
        { key: 'tentativeDate', label: 'Ngày dự kiến *', mode: 'date' }, { key: 'officialDate', label: 'Ngày chính thức', mode: 'date' }, { key: 'location', label: 'Địa điểm thi *' }, { key: 'maxScore', label: 'Thang điểm', keyboardType: 'number-pad' }, { key: 'passScore', label: 'Điểm đạt', keyboardType: 'number-pad' },
      ];
    }
    if (area === 'fees') {
      const fields: FormField[] = [];
      if (!paymentToEdit) fields.push({ key: 'studentId', label: 'Học viên *', options: students.map((item) => ({ value: item.id, label: item.fullName, detail: item.phone })) }, { key: 'amount', label: 'Số tiền thu (VND) *', keyboardType: 'number-pad' });
      fields.push({ key: 'method', label: 'Phương thức', options: ['Chuyển khoản', 'Tiền mặt'].map((value) => ({ value, label: value })) }, { key: 'date', label: 'Ngày thanh toán *', mode: 'date' }, { key: 'note', label: 'Ghi chú' });
      return fields;
    }
    if (area === 'notifications') return [
      { key: 'title', label: 'Tiêu đề *' },
      { key: 'content', label: 'Nội dung email *', multiline: true },
      { key: 'recipients', label: 'Đối tượng nhận', options: ['Tất cả học viên đang học', 'Học viên sắp thi', 'Học viên còn nợ học phí', 'Học viên cần học lại', 'Tất cả học viên'].map((value) => ({ value, label: value })) },
      ...(draft.recipients === 'Học viên còn nợ học phí' ? [{ key: 'installmentReminder', label: 'Nhắc học phí theo đợt', options: [{ value: 'Không', label: 'Nhắc số tiền còn nợ' }, { value: 'Có', label: 'Tính theo phần trăm học phí' }] }] : []),
      ...(draft.recipients === 'Học viên còn nợ học phí' && draft.installmentReminder === 'Có' ? [{ key: 'installmentNo', label: 'Số đợt *', keyboardType: 'number-pad' as const }, { key: 'installmentPercent', label: 'Tỷ lệ học phí (%) *', keyboardType: 'decimal-pad' as const }, { key: 'installmentLabel', label: 'Tên đợt' }, { key: 'installmentDueDate', label: 'Hạn thanh toán', mode: 'date' as const }] : []),
    ];
    if (area === 'classrooms' || area === 'resources') {
      const defaultResourceType = area === 'classrooms' ? 'Phòng học' : 'Thiết bị';
      const resourceTypes = Array.from(new Set([defaultResourceType, ...resourceCategories.map((item) => item.name), ...resources.map((item) => item.type)]))
        .filter((value) => area === 'classrooms' ? normalize(value).includes('phong hoc') : !normalize(value).includes('phong hoc'));
      const fields: FormField[] = [
        { key: 'name', label: area === 'classrooms' ? 'Tên phòng học *' : 'Tên thiết bị *' },
        ...(area !== 'classrooms' || editingId ? [{ key: 'resourceType', label: area === 'classrooms' ? 'Loại phòng học *' : 'Loại thiết bị *', options: resourceTypes.map((value) => ({ value, label: value })) }] : []),
        { key: 'identifier', label: area === 'classrooms' ? 'Mã / số phòng *' : 'Mã thiết bị / serial *' },
        { key: 'capacity', label: 'Sức chứa *' },
      ];
      if (editingId) fields.push({ key: 'resourceStatus', label: 'Trạng thái', options: [{ value: 'AVAILABLE', label: 'Sẵn sàng' }, { value: 'OCCUPIED', label: 'Đang sử dụng' }, { value: 'MAINTENANCE', label: 'Bảo trì' }] });
      return fields;
    }
    if (area === 'roadmap') return [...(!editingId ? [{ key: 'code', label: 'Mã lộ trình *' }] : []), { key: 'title', label: 'Tên lộ trình *' }, { key: 'content', label: 'Mô tả', multiline: true }, { key: 'roadmapStatus', label: 'Trạng thái', options: [{ value: 'active', label: 'Đang áp dụng' }, { value: 'inactive', label: 'Tạm dừng' }] }];
    return [];
  }

  const setValue = (key: string, value: string) => setDraft((current) => {
    if (key === 'referralMode') {
      if (value === 'partner') {
        const activePartners = partners.filter((item) => item.isActive !== false);
        const existing = activePartners.find((item) => item._id === current.partnerId) || activePartners[0];
        return { ...current, referralMode: value, partnerId: existing?._id || '', referral: existing?.name || '' };
      }
      return { ...current, referralMode: value, partnerId: '', referral: '' };
    }
    if (key === 'partnerId') {
      const selectedPartner = partners.find((item) => item._id === value);
      return { ...current, partnerId: value, referral: selectedPartner?.name || '' };
    }
    if (key === 'learningMode') {
      return { ...current, learningMode: value, roadmapId: '', roadmapStepId: '', ...(value === 'roadmap' ? { courseId: '' } : {}) };
    }
    if (key === 'roadmapId') {
      return { ...current, roadmapId: value, roadmapStepId: '', courseId: '' };
    }
    if (key === 'roadmapStepId') {
      const selectedRoadmap = roadmaps.find((item) => String(item.id || item._id || '') === current.roadmapId);
      const step = (selectedRoadmap?.steps || []).find((entry, index) => String(entry.id || `step-${index + 1}`) === value);
      return { ...current, roadmapStepId: value, courseId: String(step?.courseId || '') };
    }
    if (key === 'batchId' && area === 'exams') {
      const selectedBatch = batches.find((item) => item.id === value);
      return {
        ...current,
        batchId: value,
        ...(selectedBatch?.endDate ? { tentativeDate: selectedBatch.endDate } : {}),
        ...(!current.location.trim() && selectedBatch?.location ? { location: selectedBatch.location } : {}),
      };
    }
    if (key === 'instructorId') {
      const emp = instructors.find((item) => String(item.uid || item._id || item.id || '') === value);
      return { ...current, instructorId: value, instructorName: emp?.displayName || '' };
    }
    if (key === 'fee' || key === 'amount') {
      return { ...current, [key]: formatVndInput(value) };
    }
    return { ...current, [key]: value };
  });
  const setRoadmapRule = (index: number, key: keyof RoadmapStepRule, value: string) => setRoadmapStepRules((current) => current.map((rule, ruleIndex) => ruleIndex === index ? { ...rule, [key]: value } : rule));
  const openPicker = (key: string) => { setPickerField(key); setPickerSearch(''); setPickerOpen(true); };
  const optionsForPicker = (): PickOption[] => {
    if (pickerField?.startsWith('roadmap-course-')) {
      const selectedIndex = Number(pickerField.slice('roadmap-course-'.length));
      const selectedElsewhere = new Set(roadmapCourseIds.filter((_, index) => index !== selectedIndex && _));
      return courses.filter((item) => !selectedElsewhere.has(item.id) && (!pickerSearch || normalize(`${item.code} ${item.title}`).includes(normalize(pickerSearch)))).map((item) => ({ value: item.id, label: `${item.code} · ${item.title}` }));
    }
    const field = formFields().find((item) => item.key === pickerField);
    return (field?.options || []).filter((item) => {
      if (pickerField === 'studentId' && paymentToEdit) return false;
      if (pickerField === 'courseId' && area === 'roadmap' && !item.value) return false;
      if (pickerField === 'studentId' && area === 'exams' && assignmentDraft) return !assignmentDraft.selected.includes(item.value);
      return !pickerSearch || normalize(`${item.label} ${item.detail || ''}`).includes(normalize(pickerSearch));
    });
  };

  async function saveForm() {
    if (!canManage || saving) return;
    setSaving(true);
    try {
      if (area === 'students') {
        if (!draft.fullName.trim() || !draft.phone.trim() || !draft.email.trim()) throw new Error('Họ tên, số điện thoại và email là bắt buộc.');
        if (draft.referralMode === 'partner' && !draft.partnerId) throw new Error('Vui lòng chọn đối tác học viên.');
        const selectedBatch = !editingId && draft.batchId ? batches.find((batch) => batch.id === draft.batchId) : undefined;
        if (!editingId && draft.batchId && !selectedBatch) throw new Error('Lớp đã chọn không còn trong danh sách. Hãy chọn lại lớp học.');
        if (selectedBatch && draft.courseId && selectedBatch.courseId !== draft.courseId) throw new Error('Khóa học của học viên phải trùng với khóa học của lớp đã chọn.');
        const courseId = draft.courseId || selectedBatch?.courseId || '';
        const payload = { fullName: draft.fullName.trim(), phone: draft.phone.trim(), email: draft.email.trim(), birthday: draft.birthday ? toDisplayDate(draft.birthday) : '', idCard: draft.idCard.trim(), address: draft.address.trim(), referral: draft.referralMode === 'none' ? '' : draft.referral.trim(), partnerId: draft.referralMode === 'partner' ? draft.partnerId : undefined, registrationDate: toDisplayDate(draft.registrationDate || today()), enrollmentDate: draft.enrollmentDate ? toDisplayDate(draft.enrollmentDate) : '', courseId, fee: draft.fee.replace(/\D/g, ''), status: statusListForSave(draft.status, editingId ? students.find((item) => item.id === editingId)?.status : undefined), ...(isSuperAdmin && ownerFilter ? { centerId: ownerFilter } : {}) };
        const saved = await saveStudent(payload, editingId, scope);
        if (draft.batchId && !editingId) {
          try { await addStudentToBatch(draft.batchId, saved.id, scope); }
          catch (cause) { setFormOpen(false); await load(true); Alert.alert('Đã tạo học viên', `Hồ sơ đã được tạo nhưng chưa xếp vào lớp: ${cause instanceof Error ? cause.message : 'Không thể cập nhật danh sách lớp.'}`); return; }
        }
      } else if (area === 'courses') {
        if (!draft.code.trim() || !draft.title.trim() || !draft.category.trim() || !draft.duration.trim()) throw new Error('Mã, tên, danh mục và thời lượng khóa học là bắt buộc.');
        await saveCourse({ code: draft.code.trim(), title: draft.title.trim(), category: draft.category.trim(), duration: draft.duration.trim(), fee: draft.fee.replace(/\D/g, ''), maxLearners: Math.max(1, Number(draft.maxLearners) || 30), status: ['Hoạt động', 'Tạm dừng'].includes(draft.status) ? draft.status : 'Hoạt động' }, editingId, scope);
      } else if (area === 'batches') {
        const days = draft.daysOfWeek.split(/[\s,;]+/).map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
        const selectedRoadmap = roadmaps.find((item) => String(item.id || item._id || '') === draft.roadmapId);
        const orderedSteps = (selectedRoadmap?.steps || []).slice().sort((left, right) => Number(left.order || 0) - Number(right.order || 0));
        const roadmapCourseId = orderedSteps.find((step, index) => String(step.id || `step-${index + 1}`) === draft.roadmapStepId)?.courseId;
        const courseId = draft.learningMode === 'roadmap' ? String(roadmapCourseId || '') : draft.courseId;
        if (draft.learningMode === 'roadmap' && (!draft.roadmapId || !draft.roadmapStepId || !courseId)) throw new Error('Chọn lộ trình và chặng học có khóa học hợp lệ.');
        if (!draft.code.trim() || !courseId || !days.length || !draft.startDate || !draft.endDate) throw new Error('Mã lớp, khóa học, lịch học và ngày bắt đầu/kết thúc là bắt buộc.');
        if (toIsoDate(draft.startDate).slice(0, 10) > toIsoDate(draft.endDate).slice(0, 10)) throw new Error('Ngày kết thúc lớp không được trước ngày khai giảng.');
        const savedBatch = await saveBatch({ code: draft.code.trim(), name: draft.name.trim(), courseId, ...(draft.quota.trim() ? { quota: Math.max(0, Number(draft.quota) || 0) } : { quota: null }), ...(draft.instructorId ? { instructorId: draft.instructorId, instructorName: draft.instructorName.trim() } : draft.instructorName.trim() ? { instructorName: draft.instructorName.trim() } : {}), ...(draft.learningMode === 'roadmap' ? { roadmapId: draft.roadmapId, roadmapStepId: draft.roadmapStepId } : { roadmapId: null, roadmapStepId: null }), daysOfWeek: [...new Set(days)], startTime: draft.startTime, endTime: draft.endTime, startDate: draft.startDate, endDate: draft.endDate, location: draft.location.trim(), status: draft.status }, editingId, scope);
        if (progressionClassCreate) setProgressionDialog((current) => current ? { ...current, targetBatchId: savedBatch.id } : current);
      } else if (area === 'exams') {
        if (!draft.name.trim() || !draft.batchId || !draft.tentativeDate || !draft.location.trim()) throw new Error('Tên, lớp, ngày dự kiến và địa điểm thi là bắt buộc.');
        const maxScore = Number(draft.maxScore);
        const passScore = Number(draft.passScore);
        if (!Number.isFinite(maxScore) || maxScore <= 0 || !Number.isFinite(passScore) || passScore < 0 || passScore > maxScore) throw new Error('Thang điểm phải lớn hơn 0 và điểm đạt phải nằm trong thang điểm.');
        const examStatus = ['Sắp diễn ra', 'Đã xác nhận', 'Đã hoàn thành', 'Đã hủy'].includes(draft.status) ? draft.status : 'Sắp diễn ra';
        await saveExam({ name: draft.name.trim(), status: examStatus, tentativeDate: toDisplayDate(draft.tentativeDate), officialDate: draft.officialDate ? toDisplayDate(draft.officialDate) : '', location: draft.location.trim(), batchId: draft.batchId, maxScore, passScore }, editingId, scope);
      } else if (area === 'fees') {
        if (paymentToEdit?.id || paymentToEdit?._id) await updatePayment(String(paymentToEdit.id || paymentToEdit._id), { method: draft.method as 'Tiền mặt' | 'Chuyển khoản', date: toDisplayDate(draft.date), note: draft.note.trim() }, scope);
        else {
          if (!draft.studentId || parseVndInput(draft.amount) <= 0) throw new Error('Chọn học viên và nhập số tiền thu lớn hơn 0.');
          await createPayment({ studentId: draft.studentId, amount: parseVndInput(draft.amount), method: draft.method as 'Tiền mặt' | 'Chuyển khoản', date: toDisplayDate(draft.date), note: draft.note.trim() }, scope);
        }
      } else if (area === 'classrooms' || area === 'resources') {
        if (!draft.name.trim() || !draft.resourceType.trim() || !draft.identifier.trim() || !draft.capacity.trim()) throw new Error('Tên, loại, mã định danh và sức chứa là bắt buộc.');
        await saveStudentResource({ name: draft.name.trim(), type: draft.resourceType.trim(), identifier: draft.identifier.trim(), capacity: draft.capacity.trim(), status: draft.resourceStatus as StudentResource['status'] }, editingId, scope);
      } else if (area === 'roadmap') {
        if (!draft.title.trim()) throw new Error('Tên lộ trình là bắt buộc.');
        if (editingId) await updateLearningRoadmap(editingId, { name: draft.title.trim(), description: draft.content.trim(), status: draft.roadmapStatus }, scope);
        else {
          const selectedCourses = roadmapCourseIds.filter(Boolean);
          if (!draft.code.trim() || !selectedCourses.length || selectedCourses.length !== roadmapCourseIds.length) throw new Error('Nhập mã lộ trình và chọn khóa học cho từng chặng.');
          if (new Set(selectedCourses).size !== selectedCourses.length) throw new Error('Mỗi khóa học chỉ được chọn một lần trong cùng lộ trình.');
          const invalidRule = roadmapStepRules.some((rule) => {
            const numeric = [rule.minClassSize, rule.maxClassSize, rule.minAttendanceRate, rule.minAssignmentRate, rule.minMiniTestRate, rule.minExamRate].filter(Boolean).map(Number);
            return numeric.some((value) => !Number.isFinite(value) || value < 0) || [rule.minAttendanceRate, rule.minAssignmentRate, rule.minMiniTestRate, rule.minExamRate].filter(Boolean).map(Number).some((value) => value > 100) || (rule.minClassSize && rule.maxClassSize && Number(rule.maxClassSize) < Number(rule.minClassSize));
          });
          if (invalidRule) throw new Error('Điều kiện từng chặng chưa hợp lệ; tỷ lệ phải từ 0 đến 100 và sĩ số tối đa không thấp hơn tối thiểu.');
          const steps = selectedCourses.map((courseId, index) => { const rule = roadmapStepRules[index] || emptyRoadmapStepRule(); const rate = (value: string) => value === '' ? null : Number(value); return { id: `step-${index + 1}`, courseId, order: index + 1, minClassSize: Number(rule.minClassSize) || 0, maxClassSize: Number(rule.maxClassSize) || 0, eligibilityPolicy: { matchMode: rule.matchMode, minAttendanceRate: rate(rule.minAttendanceRate), minAssignmentRate: rate(rule.minAssignmentRate), minMiniTestRate: rate(rule.minMiniTestRate), minExamRate: rate(rule.minExamRate) } }; });
          await createLearningRoadmap({ code: draft.code.trim(), name: draft.title.trim(), description: draft.content.trim(), status: draft.roadmapStatus, steps }, scope);
        }
      }
      setFormOpen(false); setPaymentToEdit(null); setProgressionClassCreate(false); await load(true);
    } catch (cause) { Alert.alert('Không lưu được thông tin', cause instanceof Error ? cause.message : 'IGen-ERP từ chối thao tác.'); }
    finally { setSaving(false); }
  }

  async function openStudentDetail(student: StudentRecord) {
    setStudentDetail(student); setDetailLoading(true); setInstallments([]); setLearningHistory(null);
    const [installmentResult, historyResult, paymentResult] = await Promise.allSettled([getStudentInstallments(student.id, scope), getStudentLearningHistory(student.id, scope), listPayments(scope)]);
    if (installmentResult.status === 'fulfilled') setInstallments(installmentResult.value as InstallmentRecord[]);
    if (historyResult.status === 'fulfilled') setLearningHistory(historyResult.value);
    if (paymentResult.status === 'fulfilled') setPayments(paymentResult.value);
    setDetailLoading(false);
    const failedSections = [
      installmentResult.status === 'rejected' ? 'đợt thu' : '',
      historyResult.status === 'rejected' ? 'lịch sử đào tạo' : '',
      paymentResult.status === 'rejected' ? 'giao dịch học phí' : '',
    ].filter(Boolean);
    if (failedSections.length) Alert.alert('Hồ sơ chưa tải đủ dữ liệu', `Không tải được ${failedSections.join(', ')}. Hãy thử mở lại hồ sơ sau.`);
  }

  function confirmDelete(label: string, action: () => Promise<unknown>) {
    Alert.alert(`Xóa ${label}?`, 'Thao tác này sẽ cập nhật dữ liệu trên IGen-ERP.', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: () => { void action().then(() => load(true)).catch((cause) => Alert.alert('Không xóa được', cause instanceof Error ? cause.message : 'IGen-ERP từ chối thao tác.')); } },
    ]);
  }

  async function openBatchManager(batch: BatchRecord) {
    setManageBatch(batch); setBatchBusy(true);
    try {
      const result = await getBatchEnrollments(batch.id, scope);
      setEnrollments(result.map((row) => { const value = row as unknown as Record<string, unknown>; return { ...(value as unknown as EnrolledRecord), studentId: String(value.studentId || value._id || '') }; }));
    } catch (cause) { Alert.alert('Không tải được danh sách lớp', cause instanceof Error ? cause.message : 'Không thể tải học viên của lớp.'); }
    finally { setBatchBusy(false); }
  }

  async function updateBatchLearner(batch: BatchRecord, student: StudentRecord, enrolled: boolean) {
    setBatchBusy(true);
    try {
      if (enrolled) await removeStudentFromBatch(batch.id, student.id, scope);
      else await addStudentToBatch(batch.id, student.id, scope);
      await openBatchManager(batch); await load(true);
    } catch (cause) { Alert.alert('Không cập nhật được lớp', cause instanceof Error ? cause.message : 'IGen-ERP từ chối thao tác.'); }
    finally { setBatchBusy(false); }
  }

  async function loadProgression(batch: BatchRecord, roadmapId: string, roadmapsForBatch: RoadmapRecord[]) {
    setProgressionDialog({ batch, roadmaps: roadmapsForBatch, roadmapId, data: null, loading: true, targetBatchId: '' });
    try {
      const data = await getBatchProgression(batch.id, roadmapId, scope);
      setProgressionDrafts(Object.fromEntries(data.rows.map((row) => [row.studentId, { intent: row.intent || 'pending', teacherNote: row.teacherNote || '' }])));
      setProgressionDialog({ batch, roadmaps: roadmapsForBatch, roadmapId, data, loading: false, targetBatchId: '' });
    } catch (cause) {
      setProgressionDialog({ batch, roadmaps: roadmapsForBatch, roadmapId, data: null, loading: false, targetBatchId: '' });
      Alert.alert('Không đối chiếu được lộ trình', cause instanceof Error ? cause.message : 'IGen-ERP từ chối yêu cầu.');
    }
  }

  async function openBatchProgression(batch: BatchRecord) {
    if (!batch.roadmapId) { Alert.alert('Lớp chưa gắn lộ trình', 'Chức năng mở lớp theo lộ trình chỉ áp dụng cho lớp đã gắn với lộ trình học.'); return; }
    const linked = roadmaps.find((item) => String(item.id || item._id || '') === batch.roadmapId);
    const options = linked ? [linked] : roadmaps.filter((item) => (item.steps || []).some((step) => String(step.courseId || '') === batch.courseId));
    if (!options.length) { Alert.alert('Chưa tìm thấy lộ trình', 'Không tìm thấy lộ trình gắn với lớp học này.'); return; }
    await loadProgression(batch, String(options[0].id || options[0]._id || ''), options);
  }

  async function chooseProgressionRoadmap(roadmapId: string) {
    if (!progressionDialog || roadmapId === progressionDialog.roadmapId) return;
    await loadProgression(progressionDialog.batch, roadmapId, progressionDialog.roadmaps);
  }

  async function saveProgressionDecision(studentId: string) {
    if (!progressionDialog) return;
    const decision = progressionDrafts[studentId];
    if (!decision) return;
    setSaving(true);
    try {
      await saveLearningProgression(progressionDialog.batch.id, studentId, { roadmapId: progressionDialog.roadmapId, ...decision }, scope);
      const data = await getBatchProgression(progressionDialog.batch.id, progressionDialog.roadmapId, scope);
      setProgressionDialog((current) => current ? { ...current, data } : current);
      setProgressionDrafts(Object.fromEntries(data.rows.map((row) => [row.studentId, { intent: row.intent || 'pending', teacherNote: row.teacherNote || '' }])));
      Alert.alert('Đã lưu quyết định', 'Quyết định học tập đã được cập nhật.');
    } catch (cause) { Alert.alert('Không lưu được quyết định', cause instanceof Error ? cause.message : 'IGen-ERP từ chối thao tác.'); }
    finally { setSaving(false); }
  }

  async function promoteProgressionStudents() {
    if (!progressionDialog?.data?.targetStep || !progressionDialog.targetBatchId) return;
    const studentIds = progressionDialog.data.rows.filter((row) => row.eligible && progressionDrafts[row.studentId]?.intent === 'continue').map((row) => row.studentId);
    if (!studentIds.length) { Alert.alert('Chưa có học viên đủ điều kiện', 'Chọn “Học tiếp” cho ít nhất một học viên đạt điều kiện lộ trình.'); return; }
    setSaving(true);
    try {
      await promoteRoadmapLearners(progressionDialog.batch.id, progressionDialog.roadmapId, progressionDialog.targetBatchId, studentIds, scope);
      await load(true);
      Alert.alert('Đã chuyển chặng', `${studentIds.length} học viên đã được chuyển vào lớp kế tiếp.`);
      setProgressionDialog(null);
    } catch (cause) { Alert.alert('Không chuyển được học viên', cause instanceof Error ? cause.message : 'IGen-ERP từ chối thao tác.'); }
    finally { setSaving(false); }
  }

  async function openAttendance(batch: BatchRecord) {
    setManageBatch(null);
    setAttendanceBatch(batch); setAttendanceDate(today()); setAttendanceDraft({}); setQrSession(null);
    try {
      const assigned = await getBatchEnrollments(batch.id, scope);
      setAttendanceLearners(assigned.map((row) => { const item = row as unknown as Record<string, unknown>; return { ...(item as unknown as EnrolledRecord), studentId: String(item.studentId || item._id || '') }; }));
    } catch (cause) {
      setAttendanceBatch(null);
      setAttendanceLearners([]);
      Alert.alert('Không tải được danh sách lớp', cause instanceof Error ? cause.message : 'Không thể tải học viên của lớp.');
      return;
    }
    try {
      const result = await getBatchAttendance(batch.id, today(), scope) as Record<string, unknown>;
      const data = (result.data || result) as Record<string, unknown>;
      const records = Array.isArray(data.records) ? data.records as Array<{ studentId: string; status: 'present' | 'absent' | 'excused' | 'late' }> : [];
      setAttendanceDraft(Object.fromEntries(records.map((record) => [record.studentId, record.status])));
    } catch (cause) {
      if (!(cause instanceof ApiError && cause.status === 404)) Alert.alert('Không tải được điểm danh', cause instanceof Error ? cause.message : 'Không thể tải dữ liệu điểm danh.');
    }
  }

  async function changeAttendanceDate(value: string) {
    setAttendanceDate(value); setAttendanceDraft({});
    if (!attendanceBatch) return;
    try {
      const result = await getBatchAttendance(attendanceBatch.id, value, scope) as Record<string, unknown>;
      const data = (result.data || result) as Record<string, unknown>;
      const records = Array.isArray(data.records) ? data.records as Array<{ studentId: string; status: 'present' | 'absent' | 'excused' | 'late' }> : [];
      setAttendanceDraft(Object.fromEntries(records.map((record) => [record.studentId, record.status])));
    } catch (cause) {
      if (!(cause instanceof ApiError && cause.status === 404)) Alert.alert('Không tải được điểm danh', cause instanceof Error ? cause.message : 'Không thể tải dữ liệu điểm danh.');
    }
  }

  async function saveAttendance() {
    if (!attendanceBatch || !Object.keys(attendanceDraft).length) { Alert.alert('Chưa có dữ liệu', 'Chọn trạng thái điểm danh cho ít nhất một học viên.'); return; }
    setBatchBusy(true);
    try { await saveBatchAttendance(attendanceBatch.id, { date: attendanceDate, records: Object.entries(attendanceDraft).map(([studentId, status]) => ({ studentId, status })) }, scope); setAttendanceBatch(null); Alert.alert('Đã lưu', 'Kết quả điểm danh đã được cập nhật.'); }
    catch (cause) { Alert.alert('Không lưu được điểm danh', cause instanceof Error ? cause.message : 'IGen-ERP từ chối thao tác.'); }
    finally { setBatchBusy(false); }
  }

  async function addCourseCategory() {
    const trimmed = newCategoryName.trim();
    if (!trimmed || categoryBusy) return;
    setCategoryBusy(true);
    try {
      await createCourseCategory(trimmed, scope);
      setNewCategoryName('');
      setCourseCategories(await listCourseCategories(scope));
    } catch (cause) {
      Alert.alert('Không thêm được danh mục', cause instanceof Error ? cause.message : 'Vui lòng thử lại.');
    } finally {
      setCategoryBusy(false);
    }
  }

  function removeCourseCategory(category: CourseCategoryRecord) {
    Alert.alert('Xóa danh mục khóa học?', `Bạn có chắc chắn muốn xóa danh mục "${category.name}"?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          setCategoryBusy(true);
          void deleteCourseCategory(category.id, scope)
            .then(() => listCourseCategories(scope))
            .then(setCourseCategories)
            .catch((cause) => Alert.alert('Không xóa được danh mục', cause instanceof Error ? cause.message : 'Vui lòng thử lại.'))
            .finally(() => setCategoryBusy(false));
        },
      },
    ]);
  }

  async function addResourceCategory() {
    const trimmed = newCategoryName.trim();
    if (!trimmed || categoryBusy) return;
    setCategoryBusy(true);
    try { await createStudentResourceCategory(trimmed, scope); setNewCategoryName(''); setResourceCategories(await listStudentResourceCategories(scope)); }
    catch (cause) { Alert.alert(`Không thêm được phân loại ${area === 'classrooms' ? 'phòng học' : 'thiết bị'}`, cause instanceof Error ? cause.message : 'Vui lòng thử lại.'); }
    finally { setCategoryBusy(false); }
  }

  function removeResourceCategory(category: StudentResourceCategory) {
    const categoryLabel = area === 'classrooms' ? 'phòng học' : 'thiết bị';
    Alert.alert(`Xóa phân loại ${categoryLabel}?`, `Bạn có chắc chắn muốn xóa phân loại "${category.name}"?`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: () => { setCategoryBusy(true); void deleteStudentResourceCategory(category.id, scope).then(() => listStudentResourceCategories(scope)).then(setResourceCategories).catch((cause) => Alert.alert(`Không xóa được phân loại ${categoryLabel}`, cause instanceof Error ? cause.message : 'Vui lòng thử lại.')).finally(() => setCategoryBusy(false)); } },
    ]);
  }

  const addActiveCategory = () => area === 'courses' ? addCourseCategory() : addResourceCategory();
  const removeActiveCategory = (category: CourseCategoryRecord | StudentResourceCategory) => area === 'courses' ? removeCourseCategory(category as CourseCategoryRecord) : removeResourceCategory(category as StudentResourceCategory);

  async function openRegisterQr() {
    setRegisterQrOpen(true);
    setRegisterQrUrl('');
    setRegisterQrLoading(true);
    try {
      const { registrationToken } = await createStudentPublicRegisterLink(
        { companyCode: companyCode || user?.companyCode, branchId, entityPreset: 'student' },
        scope,
      );
      const base = getErpWebUrl('public/dang-ky');
      if (!base) throw new Error('Chưa cấu hình địa chỉ web ERP để tạo liên kết đăng ký.');
      setRegisterQrUrl(`${base}?registrationToken=${encodeURIComponent(registrationToken)}`);
    } catch (cause) {
      Alert.alert('Không tạo được mã QR đăng ký', cause instanceof Error ? cause.message : 'IGen-ERP từ chối thao tác.');
    } finally {
      setRegisterQrLoading(false);
    }
  }

  async function startQrAttendance(batch: BatchRecord) {
    if (qrCreating) return;
    setQrCreating(true);
    try {
      const response = await createStudentQrSession(batch.id, attendanceDate || today(), 5, scope);
      if (!response.sessionId || !response.token) throw new Error('IGen-ERP không trả về phiên và mã QR.');
      const url = getErpWebUrl(`attendance/checkin/${encodeURIComponent(response.token)}`);
      if (!url) throw new Error('Chưa cấu hình địa chỉ trang ERP để tạo link điểm danh.');
      setQrSession({ sessionId: response.sessionId, token: response.token, url, expiresAt: response.expiresAt, checkedIn: 0 });
    } catch (cause) { Alert.alert('Không tạo được QR điểm danh', cause instanceof Error ? cause.message : 'IGen-ERP từ chối thao tác.'); }
    finally { setQrCreating(false); }
  }

  async function submitNotice() {
    const hasStatus = (student: StudentRecord, expected: string[]) => (Array.isArray(student.status) ? student.status : [student.status]).some((value) => expected.includes(value));
    const targets = students.filter((student) => {
      if (draft.recipients === 'Tất cả học viên') return true;
      if (draft.recipients === 'Học viên còn nợ học phí') return studentDue(student) > 0;
      if (draft.recipients === 'Học viên cần học lại') return hasStatus(student, ['Thi lại', 'Học lại', 'Cần học lại']);
      if (draft.recipients === 'Học viên sắp thi') return hasStatus(student, ['Đang thi']) || exams.some((exam) => exam.status === 'Sắp diễn ra' && (exam.results || []).some((result) => result.studentId === student.id));
      return hasStatus(student, ['Đang học']);
    });
    const emailTargets = targets.filter((student) => student.email);
    if (!draft.title.trim() || !draft.content.trim()) { Alert.alert('Thiếu thông tin', 'Nhập tiêu đề và nội dung thông báo.'); return; }
    if (!emailTargets.length) { Alert.alert('Không có người nhận', 'Nhóm nhận hiện không có học viên có email.'); return; }
    const useInstallment = draft.recipients === 'Học viên còn nợ học phí' && draft.installmentReminder === 'Có';
    const installmentNo = Number(draft.installmentNo);
    const installmentPercent = Number(draft.installmentPercent);
    if (useInstallment && (!Number.isInteger(installmentNo) || installmentNo < 1 || !Number.isFinite(installmentPercent) || installmentPercent <= 0 || installmentPercent > 100 || !draft.installmentLabel.trim())) {
      Alert.alert('Thông tin đợt thu chưa hợp lệ', 'Số đợt phải là số nguyên dương, tỷ lệ học phí từ 1 đến 100 và cần có tên đợt.'); return;
    }
    setSaving(true);
    let sent = 0;
    const sentStudentIds: string[] = [];
    for (const student of emailTargets) {
      const installmentAmount = useInstallment ? Math.round(studentFee(student) * installmentPercent / 100) : undefined;
      const personalize = (value: string) => value.replace(/\{\{\s*(studentName|fullName|tenHocVien|phone|email|dueAmount|paidAmount|courseName)\s*\}\}/gi, (_match, key: string) => {
        if (['studentName', 'fullName', 'tenHocVien'].includes(key)) return student.fullName;
        if (key === 'phone') return student.phone || '';
        if (key === 'email') return student.email || '';
        if (key === 'dueAmount') return money(studentDue(student));
        if (key === 'paidAmount') return money(student.paidAmount);
        if (key === 'courseName') return courses.find((course) => course.id === student.courseId)?.title || '';
        return '';
      }).replace(/\{\{\s*(installmentAmount|installmentPercent|installmentLabel|installmentDueDate)\s*\}\}/gi, (_match, key: string) => key === 'installmentAmount' ? useInstallment ? money(installmentAmount) : '' : key === 'installmentPercent' ? useInstallment ? String(installmentPercent) : '' : key === 'installmentLabel' ? useInstallment ? draft.installmentLabel : '' : useInstallment ? draft.installmentDueDate : '');
      const personalized = personalize(draft.content);
      const personalizedTitle = personalize(draft.title);
      try {
        await import('@/core/network/apiClient').then(({ apiRequest }) => apiRequest('/send-email', { method: 'POST', body: { to: student.email, subject: personalizedTitle, html: personalized.replace(/\n/g, '<br/>') } }));
        sent += 1;
        sentStudentIds.push(student.id);
      } catch { /* Keep processing other recipients and report the delivery count. */ }
    }
    try {
      await createStudentNotification({ title: draft.title.trim(), content: draft.content.trim(), recipients: draft.recipients, recipientCount: sent, channels: ['Email'], status: sent === emailTargets.length ? 'Đã gửi' : sent ? 'Đang gửi' : 'Thất bại', studentIds: sentStudentIds, ...(useInstallment ? { installmentPlan: { installmentNo, percent: installmentPercent, label: draft.installmentLabel.trim(), ...(draft.installmentDueDate ? { dueDate: draft.installmentDueDate } : {}) } } : {}) }, scope);
      setFormOpen(false); await load(true); Alert.alert('Đã xử lý gửi email', `Gửi thành công ${sent}/${emailTargets.length} email.`);
    } catch (cause) { Alert.alert('Không lưu được lịch sử gửi', cause instanceof Error ? cause.message : `Đã gửi ${sent}/${emailTargets.length} email nhưng không lưu được lịch sử.`); }
    finally { setSaving(false); }
  }

  async function openQualityReview(item: QualityRow) {
    setQualityDetail(item);
    setQualityDetailData(null);
    setQualityDetailLoading(true);
    setAssignmentGrade(null);
    setDraft((current) => ({ ...current, attitudeNote: item.attitudeNote || '', teacherAssessment: item.teacherAssessment || '', miniTestTitle: '', miniTestDate: today(), miniTestScore: '', miniTestMax: '10', miniTestNote: '' }));
    try { setQualityDetailData(await getStudentQualityDetail(item.batchId, item.studentId, scope)); }
    catch (cause) { Alert.alert('Không tải được tiến trình học tập', cause instanceof Error ? cause.message : 'IGen-ERP từ chối yêu cầu.'); }
    finally { setQualityDetailLoading(false); }
  }

  async function refreshQualityDetail() {
    if (!qualityDetail) return;
    try { setQualityDetailData(await getStudentQualityDetail(qualityDetail.batchId, qualityDetail.studentId, scope)); }
    catch (cause) { Alert.alert('Không làm mới được đánh giá', cause instanceof Error ? cause.message : 'IGen-ERP từ chối yêu cầu.'); }
  }

  async function openQualityThresholdSettings() {
    try { setQualityThresholds(await getStudentQualityThresholds(scope)); setQualityThresholdDialog(true); }
    catch (cause) { Alert.alert('Không tải được ngưỡng đánh giá', cause instanceof Error ? cause.message : 'IGen-ERP từ chối yêu cầu.'); }
  }

  async function saveQualityThresholdSettings() {
    const { assignmentMaxScore, ...rates } = qualityThresholds;
    if (Object.values(rates).some((value) => !Number.isFinite(value) || value < 0 || value > 100) || !Number.isFinite(assignmentMaxScore) || assignmentMaxScore <= 0) { Alert.alert('Ngưỡng chưa hợp lệ', 'Các ngưỡng phần trăm phải từ 0 đến 100 và thang điểm bài tập phải lớn hơn 0.'); return; }
    setSaving(true);
    try { await updateStudentQualityThresholds(qualityThresholds, scope); setQualityThresholdDialog(false); await load(true); }
    catch (cause) { Alert.alert('Không lưu được ngưỡng đánh giá', cause instanceof Error ? cause.message : 'IGen-ERP từ chối yêu cầu.'); }
    finally { setSaving(false); }
  }

  async function saveAssessment() {
    if (!qualityDetail || savingAssessment) return;
    setSavingAssessment(true);
    try {
      await updateStudentAssessment(qualityDetail.batchId, qualityDetail.studentId, { attitudeNote: draft.attitudeNote, teacherAssessment: draft.teacherAssessment }, scope);
      await refreshQualityDetail();
      await load(true);
      Alert.alert('Đã lưu nhận xét', 'Nhận xét học viên đã được cập nhật.');
    }
    catch (cause) { Alert.alert('Không lưu được nhận xét', cause instanceof Error ? cause.message : 'IGen-ERP từ chối thao tác.'); }
    finally { setSavingAssessment(false); }
  }

  async function saveMiniTest() {
    if (!qualityDetail) return;
    const score = Number(draft.miniTestScore); const maxScore = Number(draft.miniTestMax);
    if (!draft.miniTestTitle.trim() || !draft.miniTestScore.trim() || !Number.isFinite(score) || !Number.isFinite(maxScore) || score < 0 || maxScore <= 0 || score > maxScore) { Alert.alert('Thông tin bài kiểm tra chưa hợp lệ', 'Nhập tên bài, điểm hợp lệ và thang điểm lớn hơn hoặc bằng điểm đạt.'); return; }
    setSaving(true);
    try { await createStudentMiniTest(qualityDetail.batchId, qualityDetail.studentId, { title: draft.miniTestTitle.trim(), date: draft.miniTestDate, score, maxScore, note: draft.miniTestNote.trim() }, scope); setDraft((current) => ({ ...current, miniTestTitle: '', miniTestScore: '', miniTestNote: '' })); await refreshQualityDetail(); await load(true); }
    catch (cause) { Alert.alert('Không lưu được điểm', cause instanceof Error ? cause.message : 'IGen-ERP từ chối thao tác.'); }
    finally { setSaving(false); }
  }

  async function saveAssignmentGrade(assignment: QualityAssignment) {
    if (!qualityDetail) return;
    const score = Number(assignmentGrade?.score);
    if (!assignmentGrade || assignmentGrade.id !== assignment.id || !assignmentGrade.score.trim() || !Number.isFinite(score) || score < 0 || score > assignment.maxScore) { Alert.alert('Điểm bài tập chưa hợp lệ', `Nhập điểm từ 0 đến ${assignment.maxScore}.`); return; }
    setSaving(true);
    try { await gradeStudentAssignment(qualityDetail.batchId, qualityDetail.studentId, assignment.id, { score, feedback: assignmentGrade.feedback }, scope); setAssignmentGrade(null); await refreshQualityDetail(); await load(true); }
    catch (cause) { Alert.alert('Không lưu được điểm bài tập', cause instanceof Error ? cause.message : 'IGen-ERP từ chối thao tác.'); }
    finally { setSaving(false); }
  }

  function confirmDeleteMiniTest(test: { id: string; title: string }) {
    if (!qualityDetail) return;
    Alert.alert('Xóa điểm mini test?', `Xóa kết quả “${test.title}” của học viên này?`, [{ text: 'Hủy', style: 'cancel' }, { text: 'Xóa', style: 'destructive', onPress: () => { void deleteStudentMiniTest(qualityDetail.batchId, qualityDetail.studentId, test.id, scope).then(async () => { await refreshQualityDetail(); await load(true); }).catch((cause) => Alert.alert('Không xóa được mini test', cause instanceof Error ? cause.message : 'IGen-ERP từ chối thao tác.')); } }]);
  }

  async function openExamScores(exam: ExamRecord) {
    setSaving(true);
    try {
      const batch = batches.find((item) => item.id === exam.batchId);
      const enrolledRows = batch ? await getBatchEnrollments(batch.id, scope) : [];
      const assignedIds = new Set(enrolledRows.map((row) => { const value = row as unknown as Record<string, unknown>; return String(value.studentId || value.id || value._id || ''); }).filter(Boolean));
      for (const result of exam.results || []) assignedIds.add(result.studentId);
      const assigned = students.filter((student) => assignedIds.has(student.id));
      if (!assigned.length) { Alert.alert('Chưa có thí sinh', 'Xếp học viên vào kỳ thi trước khi nhập điểm.'); return; }
      setScoreValues(Object.fromEntries(assigned.map((student) => { const result = exam.results?.find((item) => item.studentId === student.id); return [student.id, result?.score == null ? '' : String(result.score)]; })));
      setScoreDialog({ exam, students: assigned });
    } catch (cause) { Alert.alert('Không tải được danh sách thí sinh', cause instanceof Error ? cause.message : 'IGen-ERP từ chối yêu cầu.'); }
    finally { setSaving(false); }
  }

  async function saveExamScores() {
    if (!scoreDialog) return;
    const maxScore = Number(scoreDialog.exam.maxScore || 100);
    const results = scoreDialog.students.flatMap((student) => {
      const value = scoreValues[student.id]?.trim();
      if (!value) return [];
      const score = Number(value);
      return Number.isFinite(score) && score >= 0 && score <= maxScore ? [{ studentId: student.id, score }] : [{ studentId: student.id, score: Number.NaN }];
    });
    if (!results.length) { Alert.alert('Chưa có điểm để lưu', 'Nhập điểm cho ít nhất một thí sinh trước khi lưu.'); return; }
    if (results.some((item) => !Number.isFinite(item.score))) { Alert.alert('Điểm chưa hợp lệ', `Nhập điểm từ 0 đến ${maxScore}.`); return; }
    setSaving(true);
    try { await saveExamResults(scoreDialog.exam.id, results, scope); setScoreDialog(null); await load(true); Alert.alert('Đã lưu điểm thi', `Cập nhật điểm cho ${results.length} học viên.`); }
    catch (cause) { Alert.alert('Không lưu được điểm thi', cause instanceof Error ? cause.message : 'IGen-ERP từ chối thao tác.'); }
    finally { setSaving(false); }
  }

  async function updateExamOutcome(exam: ExamRecord, student: StudentRecord, outcome: 'Đậu' | 'Trượt' | 'Chưa có') {
    try {
      await setExamStudentOutcome(exam.id, student.id, outcome, scope);
      setScoreDialog((current) => current && current.exam.id === exam.id ? { ...current, exam: { ...current.exam, results: [...(current.exam.results || []).filter((item) => item.studentId !== student.id), { studentId: student.id, outcome }] } } : current);
      await load(true);
    }
    catch (cause) { Alert.alert('Không cập nhật được kết quả thi', cause instanceof Error ? cause.message : 'IGen-ERP từ chối thao tác.'); }
  }

  function confirmUnassignExamStudent(exam: ExamRecord, student: StudentRecord) {
    Alert.alert('Gỡ thí sinh khỏi kỳ thi?', `${student.fullName} sẽ bị gỡ khỏi danh sách dự thi.`, [{ text: 'Hủy', style: 'cancel' }, { text: 'Gỡ học viên', style: 'destructive', onPress: () => { void unassignExamStudent(exam.id, student.id, scope).then(() => { setScoreDialog((current) => current ? { ...current, students: current.students.filter((item) => item.id !== student.id) } : current); return load(true); }).catch((cause) => Alert.alert('Không gỡ được thí sinh', cause instanceof Error ? cause.message : 'IGen-ERP từ chối thao tác.')); } }]);
  }

  async function openExamAssignment(exam: ExamRecord) {
    try {
      const candidates = await getEligibleExamStudents(exam.id, scope);
      setAssignmentDraft({ exam, candidates, selected: [] });
    } catch (cause) { Alert.alert('Không tải được học viên dự thi', cause instanceof Error ? cause.message : 'IGen-ERP từ chối yêu cầu.'); }
  }

  async function saveExamAssignment() {
    if (!assignmentDraft?.selected.length) { Alert.alert('Chưa chọn học viên', 'Chọn ít nhất một học viên để thêm vào kỳ thi.'); return; }
    setSaving(true);
    try { await assignExamStudents(assignmentDraft.exam.id, assignmentDraft.selected, scope); setAssignmentDraft(null); await load(true); Alert.alert('Đã cập nhật danh sách dự thi', 'Học viên đã được thêm vào kỳ thi.'); }
    catch (cause) { Alert.alert('Không cập nhật được', cause instanceof Error ? cause.message : 'IGen-ERP từ chối yêu cầu.'); }
    finally { setSaving(false); }
  }

  async function saveEnrollmentAction() {
    if (!enrollmentAction) return;
    const { batch, enrollment } = enrollmentAction;
    if (!draft.reason.trim()) { Alert.alert('Cần nhập lý do', 'Nhập lý do bảo lưu hoặc điều chỉnh tình trạng học.'); return; }
    setSaving(true);
    try {
      const isOnHold = enrollment.status === 'Bảo lưu' || enrollment.status === 'Chờ xếp học lại';
      const status = isOnHold ? (draft.targetBatchId ? 'Học lại' : 'Đang học') : 'Bảo lưu';
      if (enrollment.status === 'Chờ xếp học lại' && !draft.targetBatchId) { Alert.alert('Chọn lớp học lại', 'Chọn lớp học lại trước khi xác nhận.'); setSaving(false); return; }
      await updateEnrollmentStatus(batch.id, enrollment.studentId, { status, reason: draft.reason.trim(), ...(draft.expectedReturnAt ? { expectedReturnAt: draft.expectedReturnAt } : {}), ...(draft.targetBatchId ? { targetBatchId: draft.targetBatchId } : {}), ...(draft.targetBatchId ? { retakeFee: parseVndInput(draft.retakeFee) } : {}) }, scope);
      setEnrollmentAction(null); await load(true);
    } catch (cause) { Alert.alert('Không cập nhật được trạng thái', cause instanceof Error ? cause.message : 'IGen-ERP từ chối yêu cầu.'); }
    finally { setSaving(false); }
  }

  async function saveBooking() {
    if (!bookingResource || !draft.purpose.trim() || !draft.by.trim() || !draft.bookingDate || !draft.startTime || !draft.endTime) { Alert.alert('Thiếu thông tin lịch', 'Nhập mục đích, người đăng ký, ngày và khung giờ.'); return; }
    setSaving(true);
    try { await createResourceBooking(bookingResource.id, { purpose: draft.purpose.trim(), by: draft.by.trim(), date: draft.bookingDate, startTime: draft.startTime, endTime: draft.endTime }, scope); setBookingResource(null); await load(true); }
    catch (cause) { Alert.alert('Không tạo được lịch sử dụng', cause instanceof Error ? cause.message : 'IGen-ERP từ chối yêu cầu.'); }
    finally { setSaving(false); }
  }

  async function toggleResourceMaintenance(resource: StudentResource) {
    const status = resource.status === 'MAINTENANCE' ? 'AVAILABLE' : 'MAINTENANCE';
    try { await saveStudentResource({ status }, resource.id, scope); await load(true); Alert.alert('Đã cập nhật trạng thái', status === 'MAINTENANCE' ? `${resource.name} đã chuyển sang bảo trì.` : `${resource.name} đã sẵn sàng sử dụng.`); }
    catch (cause) { Alert.alert('Không cập nhật được trạng thái', cause instanceof Error ? cause.message : 'IGen-ERP từ chối thao tác.'); }
  }

  function markNotificationInstallmentPaid(notification: StudentNotification) {
    const plan = notification.installmentPlan;
    const studentIds = [...new Set(notification.studentIds || [])];
    if (!plan || !studentIds.length) { Alert.alert('Không có học viên để cập nhật', 'Thông báo này không lưu danh sách người nhận của đợt thu.'); return; }
    Alert.alert('Đánh dấu đã thu học phí?', `Cập nhật đợt ${plan.installmentNo} cho ${studentIds.length} học viên đã nhận thông báo?`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đánh dấu đã thu', onPress: () => { setSaving(true); void Promise.allSettled(studentIds.map((studentId) => markStudentInstallmentPaid(studentId, plan.installmentNo, scope))).then(async (results) => { await load(true); const failed = results.filter((item) => item.status === 'rejected').length; Alert.alert('Đã cập nhật đợt thu', failed ? `Thành công ${results.length - failed}/${results.length}; ${failed} học viên chưa cập nhật được.` : `Đã đánh dấu đã thu cho ${results.length} học viên.`); }).catch((cause) => Alert.alert('Không cập nhật được đợt thu', cause instanceof Error ? cause.message : 'Vui lòng thử lại.')).finally(() => setSaving(false)); } },
    ]);
  }

  async function placeWaitlistRow(entry: WaitlistRecord) {
    const entryId = String(entry.id || entry._id || '');
    const targetBatch = batches.find((item) => item.courseId === String(entry.targetCourseId || ''));
    if (!entryId || !targetBatch) { Alert.alert('Chưa có lớp phù hợp', 'Tạo lớp đang mở cho khóa học của bước lộ trình rồi thử xếp lại.'); return; }
    try { await placeWaitlistEntries(targetBatch.id, [entryId], scope); await load(true); Alert.alert('Đã xếp lớp', `${entry.studentName || 'Học viên'} được thêm vào lớp ${targetBatch.code}.`); }
    catch (cause) { Alert.alert('Không xếp được lớp', cause instanceof Error ? cause.message : 'IGen-ERP từ chối yêu cầu.'); }
  }

  const navLabel = NAV.find((item) => item.key === area)?.label || 'Học viên';
  const showAdd = canManage && ['students', 'courses', 'batches', 'exams', 'fees', 'notifications', 'classrooms', 'resources', 'roadmap'].includes(area);
  const actionButton = (label: string, Icon: typeof Plus, onPress: () => void, tone: 'primary' | 'secondary' | 'danger' = 'secondary') => <Pressable key={label} onPress={onPress} style={[styles.actionButton, tone === 'primary' && styles.primaryAction, tone === 'danger' && styles.dangerAction]}><Icon size={14} color={tone === 'primary' ? colors.white : tone === 'danger' ? '#B42318' : colors.primary} /><Text style={[styles.actionText, tone === 'primary' && styles.primaryActionText, tone === 'danger' && styles.dangerActionText]}>{label}</Text></Pressable>;

  if (!canRead) return <View style={styles.emptyState}><UsersRound size={28} color={colors.primary} /><Text style={styles.emptyTitle}>Chưa có quyền xem phân hệ Học viên</Text><Text style={styles.emptyText}>Cần quyền people:read để truy cập hồ sơ và nghiệp vụ đào tạo.</Text></View>;

  return <View style={styles.container}>
    <PastelBackdrop idPrefix="student" />
    <Stack.Screen
      options={{
        headerStyle: { backgroundColor: PASTEL_BACKDROP_TOP_COLOR },
        headerShadowVisible: false,
        headerRight: canSwitchBranch
          ? () => (
              <Pressable
                onPress={() => setBranchPickerOpen(true)}
                hitSlop={8}
                style={({ pressed }) => [styles.headerBranchBtn, pressed && { opacity: 0.65 }]}
              >
                <View style={styles.branchBtnContent}>
                  <BranchAppIcon size={22} />
                  <Text numberOfLines={1} style={styles.branchBtnText}>{branchesLoading ? 'Đang tải…' : branchName}</Text>
                  <ChevronDown size={14} color={colors.ink} />
                </View>
              </Pressable>
            )
          : undefined,
      }}
    />
    {isSuperAdmin ? <View style={styles.companyScopeRow}><Text style={styles.scopeLabel}>Cơ sở</Text><Pressable onPress={() => setCompanyPickerOpen(true)} style={styles.companyScopeButton}><Building2 size={15} color={colors.primary} /><Text numberOfLines={1} style={styles.companyScopeText}>{companyName}</Text><ChevronDown size={14} color={colors.ink} /></Pressable></View> : null}
    <ModuleSectionSwitcher
      items={STUDENT_SECTIONS}
      activeKey={area}
      onChange={(nextArea, direction) => {
        transitionDirRef.current = direction;
        setArea(nextArea);
        setSearch('');
        resetFilters();
      }}
      modalTitle="Chọn mục học viên & đào tạo"
      style={styles.switcherBarWrap}
    />

    <Animated.View style={{ flex: 1, opacity: sectionOpacity, transform: [{ translateX: sectionTranslateX }] }}>
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true); }} tintColor={colors.primary} />} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.toolbar}>
        <View style={styles.searchBox}><Search size={16} strokeWidth={1.7} color="#94A3B8" /><TextInput value={search} onChangeText={setSearch} placeholder={placeholderForArea(area)} placeholderTextColor="#94A3B8" style={styles.searchInput} />{search ? <Pressable onPress={() => setSearch('')} hitSlop={8}><X size={16} color="#94A3B8" /></Pressable> : null}</View>
        {area !== 'students' && area !== 'fees' && area !== 'classrooms' && area !== 'resources' && area !== 'roadmap' && area !== 'notifications' && filterOptions(area).length > 0 && <Pressable onPress={() => setFilterOpen(true)} style={[styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive]}><SlidersHorizontal size={14} color={colors.primary} /><Text style={styles.filterButtonText}>{activeFilterCount ? `Bộ lọc (${activeFilterCount})` : 'Bộ lọc'}</Text><ChevronDown size={13} color={colors.primary} /></Pressable>}
        {area !== 'students' && area !== 'courses' && area !== 'batches' && area !== 'fees' && area !== 'classrooms' && area !== 'resources' && area !== 'roadmap' && area !== 'notifications' ? <Pressable onPress={() => void exportCurrentArea()} style={styles.filterButton}><Download size={14} color={colors.primary} /><Text style={styles.filterButtonText}>Xuất CSV</Text></Pressable> : null}
        {area === 'quality' && canManage ? <Pressable onPress={() => void openQualityThresholdSettings()} style={styles.filterButton}><SlidersHorizontal size={14} color={colors.primary} /><Text style={styles.filterButtonText}>Ngưỡng</Text></Pressable> : null}
        {area === 'students' && canManage ? <Pressable accessibilityRole="button" accessibilityLabel="QR đăng ký học viên" onPress={() => void openRegisterQr()} style={styles.filterButton}><QrCode size={15} color={colors.primary} /><Text style={styles.filterButtonText}>QR</Text></Pressable> : null}
        {area === 'courses' && canManage ? <Pressable accessibilityRole="button" accessibilityLabel="Quản lý danh mục khóa học" onPress={() => setCategoryModalOpen(true)} style={styles.filterButton}><Tag size={14} color={colors.primary} /><Text style={styles.filterButtonText}>Danh mục</Text></Pressable> : null}
      </View>
      {(area === 'classrooms' || area === 'resources' || area === 'roadmap' || area === 'notifications') ? (
        <View style={styles.feesActionRow}>
          {filterOptions(area).length > 0 ? (
            <Pressable onPress={() => setFilterOpen(true)} style={[styles.filterButton, styles.feesActionBtn, activeFilterCount > 0 && styles.filterButtonActive]}>
              <SlidersHorizontal size={13} color={colors.primary} />
              <Text numberOfLines={1} style={styles.filterButtonText}>{activeFilterCount ? `Bộ lọc (${activeFilterCount})` : 'Bộ lọc'}</Text>
              <ChevronDown size={12} color={colors.primary} />
            </Pressable>
          ) : null}
          <Pressable onPress={() => void exportCurrentArea()} style={[styles.filterButton, styles.feesActionBtn]}>
            <Download size={13} color={colors.primary} />
            <Text numberOfLines={1} style={styles.filterButtonText}>Xuất CSV</Text>
          </Pressable>
          {(area === 'classrooms' || area === 'resources') && canManage ? (
            <Pressable accessibilityRole="button" accessibilityLabel={area === 'classrooms' ? 'Quản lý phân loại phòng học' : 'Quản lý phân loại thiết bị'} onPress={() => setCategoryModalOpen(true)} style={[styles.filterButton, styles.feesActionBtn]}>
              <Tag size={13} color={colors.primary} />
              <Text numberOfLines={1} style={styles.filterButtonText}>Phân loại</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {area === 'fees' ? (
        <View style={styles.feesActionRow}>
          <Pressable onPress={() => setFilterOpen(true)} style={[styles.filterButton, styles.feesActionBtn, activeFilterCount > 0 && styles.filterButtonActive]}>
            <SlidersHorizontal size={13} color={colors.primary} />
            <Text numberOfLines={1} style={styles.filterButtonText}>{activeFilterCount ? `Bộ lọc (${activeFilterCount})` : 'Bộ lọc'}</Text>
            <ChevronDown size={12} color={colors.primary} />
          </Pressable>
          <Pressable onPress={() => void exportCurrentArea()} style={[styles.filterButton, styles.feesActionBtn]}>
            <Download size={13} color={colors.primary} />
            <Text numberOfLines={1} style={styles.filterButtonText}>Xuất CSV</Text>
          </Pressable>
        </View>
      ) : null}
      {area === 'students' && canManage ? <StudentDataTransfer students={visibleStudents} batches={batches} scope={scope} onImported={() => { void load(true); }} filterLabel={activeFilterCount ? `Bộ lọc (${activeFilterCount})` : 'Bộ lọc'} hasActiveFilter={activeFilterCount > 0} onFilterPress={() => setFilterOpen(true)} /> : null}
      {area === 'students' && !canManage ? <Pressable onPress={() => setFilterOpen(true)} style={[styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive]}><SlidersHorizontal size={14} color={colors.primary} /><Text style={styles.filterButtonText}>{activeFilterCount ? `Bộ lọc (${activeFilterCount})` : 'Bộ lọc'}</Text><ChevronDown size={13} color={colors.primary} /></Pressable> : null}
      {error ? <LoadState title="Chưa có dữ liệu để hiển thị" detail="Đã mở thông báo lỗi. Hãy thử tải lại sau khi đóng thông báo." onRetry={() => void load()} /> : loading ? <LoadState title="Đang tải dữ liệu" detail={`Đang kết nối danh mục ${navLabel.toLocaleLowerCase('vi')} với IGen-ERP…`} busy /> : <>
      {renderArea(area, { students: area === 'fees' ? visibleFeeStudents : visibleStudents, courses: visibleCourses, batches: visibleBatches, allBatches: batches, exams: visibleExams, quality: visibleQuality, payments: visiblePayments, notifications: visibleNotifications, resources: visibleResources, roadmaps: visibleRoadmaps, waitlist: visibleWaitlist, enrollments: visibleEnrollments }, {
        canManage, page, pageSize, scheduleDate: dateFromFilter || today(), openStudentDetail, openStudentPayment, openEdit, updateRoadmap: (id, input) => updateLearningRoadmap(id, input, scope), toggleResourceMaintenance: (item) => void toggleResourceMaintenance(item), confirmDelete, deleteStudentRecord: (id) => deleteStudent(id, scope), deleteCourseRecord: (id) => deleteCourse(id, scope), deleteBatchRecord: (id) => deleteBatch(id, scope), deleteExamRecord: (id) => deleteExam(id, scope), deleteResourceRecord: (id) => deleteStudentResource(id, scope), openBatchDetail: (item) => setViewingBatch(item), openBatchManager, openBatchProgression, openAttendance, openBatchHistory: (item) => setHistoryBatch(item), openBatchAssignments: (item) => setAssignmentsBatch(item), setQualityDetail: openQualityReview, openExamAssignment, openExamScores,
        setEnrollmentAction: (batch, enrollment, student) => { setEnrollmentAction({ batch, enrollment, student }); setDraft((current) => ({ ...current, reason: enrollment.suspensionReason || '', expectedReturnAt: enrollment.expectedReturnAt || '', targetBatchId: '' })); }, openBooking: (resource) => { setBookingResource(resource); setDraft((current) => ({ ...current, purpose: '', by: user?.displayName || '', bookingDate: today(), startTime: '09:00', endTime: '10:00' })); },
        deleteNotification: (item) => confirmDelete('thông báo', () => deleteStudentNotification(String(item.id || item._id), scope)), markNotificationInstallmentPaid, deletePayment: (item) => confirmDelete('giao dịch thu học phí', () => deletePayment(String(item.id || item._id), scope)),
        placeWaitlistRow, cancelBooking: (resource, bookingId) => confirmDelete('lịch sử sử dụng', () => deleteResourceBooking(resource.id, bookingId, scope)), load,
      })}
      {resultCount > pageSize ? <View style={styles.pagination}><Text style={styles.paginationText}>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, resultCount)} / {resultCount}</Text><Pressable disabled={page <= 1} onPress={() => setPage((value) => Math.max(1, value - 1))} style={[styles.pageButton, page <= 1 && styles.disabled]}><Text style={styles.pageButtonText}>Trước</Text></Pressable><Text style={styles.paginationText}>{page}/{pageCount}</Text><Pressable disabled={page >= pageCount} onPress={() => setPage((value) => Math.min(pageCount, value + 1))} style={[styles.pageButton, page >= pageCount && styles.disabled]}><Text style={styles.pageButtonText}>Sau</Text></Pressable></View> : null}
      </>}
    </ScrollView>
    </Animated.View>

    {showAdd ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={area === 'students' ? 'Thêm học viên' : area === 'courses' ? 'Thêm khóa học' : area === 'batches' ? 'Thêm lớp' : area === 'exams' ? 'Thêm kỳ thi' : area === 'fees' ? 'Thu học phí' : area === 'notifications' ? 'Gửi thông báo' : area === 'roadmap' ? 'Tạo lộ trình' : area === 'classrooms' ? 'Thêm phòng học' : 'Thêm thiết bị'}
        onPress={openCreate}
        style={({ pressed }) => [styles.fab, { bottom: Math.max(insets.bottom, 16) + 12 }, pressed && styles.fabPressed]}
      >
        <Plus size={25} strokeWidth={2.3} color={colors.white} />
      </Pressable>
    ) : null}

    <FullScreenFormModal
      visible={formOpen}
      title={formTitle(area, Boolean(editingId), Boolean(paymentToEdit))}
      onClose={() => { if (!saving) { setFormOpen(false); setPaymentToEdit(null); setProgressionClassCreate(false); } }}
      footer={
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
          <Pressable onPress={() => { if (!saving) { setFormOpen(false); setPaymentToEdit(null); setProgressionClassCreate(false); } }} style={styles.cancelButton}><Text style={styles.cancelText}>Hủy</Text></Pressable>
          <Pressable onPress={() => area === 'notifications' ? void submitNotice() : void saveForm()} disabled={saving} style={[styles.saveButton, saving && styles.disabled]}>{saving ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.saveText}>{area === 'notifications' ? 'Gửi email' : editingId ? 'Lưu thay đổi' : 'Tạo mới'}</Text>}</Pressable>
        </View>
      }
    >
      <View style={{ gap: 10 }}>
        {area === 'notifications' ? <Text style={styles.helperText}>Biến cá nhân hóa: {'{{studentName}}'}, {'{{phone}}'}, {'{{courseName}}'}, {'{{dueAmount}}'}, {'{{paidAmount}}'}. Nhắc theo đợt: {'{{installmentAmount}}'}, {'{{installmentPercent}}'}, {'{{installmentLabel}}'}, {'{{installmentDueDate}}'}.</Text> : null}
        {formFields().filter((field) => !(area === 'students' && Boolean(editingId) && field.key === 'batchId')).map((field) => <View key={field.key} style={styles.fieldWrap}>
          {field.key === 'daysOfWeek' ? (() => {
            const selectedDays = new Set(draft.daysOfWeek.split(/[\s,;]+/).filter(Boolean).map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6));
            const toggleDay = (day: number) => {
              const next = new Set(selectedDays);
              if (next.has(day)) next.delete(day); else next.add(day);
              const ordered = WEEKDAY_OPTIONS.map((opt) => opt.value).filter((value) => next.has(value));
              setValue('daysOfWeek', ordered.join(','));
            };
            return <View>
              <Text style={styles.fieldLabel}>{field.label}</Text>
              <View style={styles.weekdayGrid}>
                {WEEKDAY_OPTIONS.map((option) => {
                  const active = selectedDays.has(option.value);
                  return <Pressable key={option.value} onPress={() => toggleDay(option.value)} style={[styles.weekdayChip, active && styles.weekdayChipActive]}>
                    <Text style={[styles.weekdayChipText, active && styles.weekdayChipTextActive]}>{option.label}</Text>
                  </Pressable>;
                })}
              </View>
            </View>;
          })() : field.mode ? <DateTimeField label={field.label} mode={field.mode} value={String(draft[field.key as keyof Draft] || '')} onChange={(value) => setValue(field.key, value)} allowClear={!field.label.includes('*')} /> : field.options ? <View><Text style={styles.fieldLabel}>{field.label}</Text><Pressable onPress={() => openPicker(field.key)} style={styles.selectField}><Text numberOfLines={2} style={[styles.selectValue, !draft[field.key as keyof Draft] && styles.placeholder]}>{field.options.find((option) => option.value === draft[field.key as keyof Draft])?.label || 'Chọn'}</Text><ChevronDown size={15} color={colors.muted} /></Pressable></View> : <Field label={field.label} value={String(draft[field.key as keyof Draft] || '')} onChangeText={(value) => setValue(field.key, value)} placeholder={field.placeholder} multiline={field.multiline} keyboardType={field.keyboardType} autoCapitalize={field.key === 'email' ? 'none' : 'sentences'} />}
        </View>)}
        {area === 'roadmap' && !editingId ? <View style={styles.roadmapStepsField}><Text style={styles.fieldLabel}>Các chặng khóa học *</Text>{roadmapCourseIds.map((courseId, index) => <View key={`roadmap-step-${index}`} style={styles.roadmapStepBlock}><View style={styles.roadmapStepRow}><Text style={styles.roadmapStepNumber}>{index + 1}</Text><Pressable onPress={() => openPicker(`roadmap-course-${index}`)} style={styles.selectField}><Text numberOfLines={2} style={[styles.selectValue, !courseId && styles.placeholder]}>{courses.find((item) => item.id === courseId)?.title || `Chọn khóa học cho chặng ${index + 1}`}</Text><ChevronDown size={14} color={colors.muted} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Xóa chặng ${index + 1}`} disabled={roadmapCourseIds.length === 1} onPress={() => { setRoadmapCourseIds((current) => current.filter((_, stepIndex) => stepIndex !== index)); setRoadmapStepRules((current) => current.filter((_, stepIndex) => stepIndex !== index)); }} style={[styles.removeStepButton, roadmapCourseIds.length === 1 && styles.disabled]}><X size={15} color="#B42318" /></Pressable></View><View style={styles.roadmapRulePanel}><Text style={styles.optionDetail}>Điều kiện chuyển chặng (để trống nếu không áp dụng)</Text><View style={styles.filters}>{([{ value: 'all', label: 'Đạt tất cả điều kiện' }, { value: 'any', label: 'Đạt một điều kiện' }] as const).map((option) => <Pressable key={option.value} onPress={() => setRoadmapRule(index, 'matchMode', option.value)} style={[styles.filterChip, roadmapStepRules[index]?.matchMode === option.value && styles.filterChipSelected]}><Text style={[styles.filterChipText, roadmapStepRules[index]?.matchMode === option.value && styles.filterChipTextSelected]}>{option.label}</Text></Pressable>)}</View><View style={styles.twoColumns}><Field label="Sĩ số tối thiểu" value={roadmapStepRules[index]?.minClassSize || ''} onChangeText={(value) => setRoadmapRule(index, 'minClassSize', value)} keyboardType="number-pad" /><Field label="Sĩ số tối đa" value={roadmapStepRules[index]?.maxClassSize || ''} onChangeText={(value) => setRoadmapRule(index, 'maxClassSize', value)} keyboardType="number-pad" /></View><View style={styles.twoColumns}><Field label="Chuyên cần tối thiểu (%)" value={roadmapStepRules[index]?.minAttendanceRate || ''} onChangeText={(value) => setRoadmapRule(index, 'minAttendanceRate', value)} keyboardType="decimal-pad" /><Field label="Bài tập tối thiểu (%)" value={roadmapStepRules[index]?.minAssignmentRate || ''} onChangeText={(value) => setRoadmapRule(index, 'minAssignmentRate', value)} keyboardType="decimal-pad" /></View><View style={styles.twoColumns}><Field label="Mini test tối thiểu (%)" value={roadmapStepRules[index]?.minMiniTestRate || ''} onChangeText={(value) => setRoadmapRule(index, 'minMiniTestRate', value)} keyboardType="decimal-pad" /><Field label="Điểm thi tối thiểu (%)" value={roadmapStepRules[index]?.minExamRate || ''} onChangeText={(value) => setRoadmapRule(index, 'minExamRate', value)} keyboardType="decimal-pad" /></View></View></View>)}<Pressable onPress={() => { setRoadmapCourseIds((current) => [...current, '']); setRoadmapStepRules((current) => [...current, emptyRoadmapStepRule()]); }} style={styles.addStepButton}><Plus size={14} color={colors.primary} /><Text style={styles.addStepText}>Thêm chặng tiếp theo</Text></Pressable></View> : null}
      </View>
    </FullScreenFormModal>

    <Modal visible={pickerOpen} transparent statusBarTranslucent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
      <Pressable style={styles.sheetBackdrop} onPress={() => setPickerOpen(false)}>
        <Pressable style={styles.sheetModal} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Chọn thông tin</Text>
            <Pressable onPress={() => setPickerOpen(false)} hitSlop={8}><Text style={styles.sheetClose}>Đóng</Text></Pressable>
          </View>
          <View style={[styles.searchBox, { flex: 0, marginBottom: 10 }]}>
            <Search size={16} strokeWidth={1.7} color="#94A3B8" />
            <TextInput value={pickerSearch} onChangeText={setPickerSearch} placeholder="Tìm kiếm..." placeholderTextColor="#94A3B8" style={styles.searchInput} />
          </View>
          <ScrollView style={{ flexGrow: 0, maxHeight: 420 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {optionsForPicker().map((option) => {
              const selected = !pickerField?.startsWith('roadmap-course-') && Boolean(pickerField && draft[pickerField as keyof Draft] === option.value);
              return (
                <Pressable key={option.value} onPress={() => { if (pickerField?.startsWith('roadmap-course-')) { const selectedIndex = Number(pickerField.slice('roadmap-course-'.length)); setRoadmapCourseIds((current) => current.map((value, index) => index === selectedIndex ? option.value : value)); } else if (pickerField) setValue(pickerField, option.value); setPickerOpen(false); }} style={[styles.sheetRow, selected && styles.sheetRowActive]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetRowTitle}>{option.label}</Text>
                    {option.detail ? <Text style={styles.sheetRowSub}>{option.detail}</Text> : null}
                  </View>
                  {pickerField?.startsWith('roadmap-course-') || selected ? <Check size={17} color={colors.primary} /> : null}
                </Pressable>
              );
            })}
            {optionsForPicker().length === 0 ? <Text style={styles.helperText}>Không tìm thấy lựa chọn phù hợp.</Text> : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>

    <FullScreenFormModal
      visible={Boolean(studentDetail)}
      title="Hồ sơ học viên"
      onClose={() => setStudentDetail(null)}
    >
      {detailLoading ? <LoadState title="Đang tải hồ sơ" detail="Đang lấy học phí và lịch sử đào tạo…" busy /> : studentDetail ? <View style={{ gap: 12 }}>
        <View style={styles.studentIdentity}><View style={styles.studentAvatar}><Text style={styles.studentAvatarText}>{getInitials(studentDetail.fullName)}</Text></View><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{studentDetail.fullName}</Text><Text style={styles.cardMeta}>{studentDetail.phone} · {studentDetail.email || 'Chưa có email'}</Text></View></View>
        <View style={styles.detailGrid}><Detail label="Ngày sinh" value={studentDetail.birthday || '—'} /><Detail label="CCCD" value={studentDetail.idCard || '—'} /><Detail label="Ngày đăng ký" value={studentDetail.registrationDate || '—'} /><Detail label="Địa chỉ" value={studentDetail.address || '—'} /></View>
        <View style={styles.detailSection}><Text style={styles.detailSectionTitle}>Học phí</Text><View style={styles.detailGrid}><Detail label="Đã thu" value={money(studentDetail.paidAmount)} /><Detail label="Còn nợ" value={money(studentDue(studentDetail))} /></View>
          {installments.map((item, index) => <View key={`${item.no || index}`} style={styles.installmentRow}><View style={{ flex: 1 }}><Text style={styles.optionTitle}>Đợt {item.no || index + 1} · {money(item.amountDue)}</Text><Text style={styles.optionDetail}>{item.dueDate || 'Chưa có hạn'} · {item.status || 'Chưa thanh toán'}</Text></View>{item.status !== 'Đã thanh toán' ? <Pressable onPress={() => void markStudentInstallmentPaid(studentDetail.id, Number(item.no || index + 1), scope).then(() => openStudentDetail(studentDetail)).catch((cause) => Alert.alert('Không cập nhật được', cause instanceof Error ? cause.message : 'Lỗi cập nhật.'))} style={styles.miniAction}><Check size={13} color={colors.primary} /><Text style={styles.miniActionText}>Đã thu</Text></Pressable> : null}</View>)}
        </View>
        <View style={styles.detailSection}><Text style={styles.detailSectionTitle}>Lịch sử giao dịch</Text>{payments.filter((payment) => payment.studentId === studentDetail.id).map((payment, index) => <View key={payment.id || payment._id || index} style={styles.installmentRow}><View style={{ flex: 1 }}><Text style={styles.optionTitle}>{money(payment.amount)} · {payment.method || '—'}</Text><Text style={styles.optionDetail}>{payment.date || payment.paidOn || '—'} {payment.note ? `· ${payment.note}` : ''}</Text></View></View>)}{!payments.some((payment) => payment.studentId === studentDetail.id) ? <Text style={styles.emptyHint}>Chưa có giao dịch thu học phí.</Text> : null}</View>
        {learningHistory ? <View style={styles.detailSection}><Text style={styles.detailSectionTitle}>Tiến trình đào tạo · {learningHistory.summary?.totalClasses || learningHistory.entries?.length || 0} lớp · {learningHistory.summary?.totalCourses || learningHistory.completedCourses?.length || 0} khóa</Text>{learningHistory.completedCourses?.length ? <View style={styles.filters}>{learningHistory.completedCourses.map((course) => <View key={course.id} style={styles.filterChipSelected}><Text style={styles.filterChipTextSelected}>{course.title}{course.code ? ` · ${course.code}` : ''}</Text></View>)}</View> : null}{learningHistory.entries?.map((entry) => <View key={entry.id} style={styles.installmentRow}><View style={{ flex: 1 }}><Text style={styles.optionTitle}>{entry.batchCode} · {entry.courseTitle}</Text><Text style={styles.optionDetail}>{entry.status === 'active' ? 'Đang học' : entry.status === 'completed' ? 'Hoàn thành' : 'Đã rời lớp'} · {entry.instructorName || 'Chưa phân công'} · {entry.enrolledAt ? toDisplayDate(entry.enrolledAt) : 'Chưa xác định'}{entry.leftAt ? ` → ${toDisplayDate(entry.leftAt)}` : ''}</Text>{entry.roadmap ? <Text style={styles.optionDetail}>{entry.roadmap.name} · Chặng {entry.roadmap.stepOrder || 1}/{entry.roadmap.totalSteps}</Text> : null}{entry.suspensionReason ? <Text style={styles.optionDetail}>Lý do bảo lưu: {entry.suspensionReason}{entry.expectedReturnAt ? ` · Dự kiến quay lại ${toDisplayDate(entry.expectedReturnAt)}` : ''}</Text> : null}</View><Badge label={entry.enrollmentStatus || entry.batchStatus || entry.status} /></View>)}{!learningHistory.entries?.length ? <Text style={styles.emptyHint}>Chưa có lịch sử lớp học.</Text> : null}</View> : null}
        {canManage && <View style={styles.detailActionRow}>{actionButton('Sửa hồ sơ', Pencil, () => { setStudentDetail(null); openEdit(studentDetail); }, 'primary')}{actionButton('Xóa hồ sơ', Trash2, () => { setStudentDetail(null); confirmDelete('hồ sơ học viên', () => deleteStudent(studentDetail.id, scope)); }, 'danger')}</View>}
      </View> : null}
    </FullScreenFormModal>

    <FullScreenFormModal
      visible={Boolean(manageBatch)}
      title={manageBatch ? `Danh sách lớp ${manageBatch.code}` : 'Danh sách lớp'}
      onClose={() => setManageBatch(null)}
    >
      <View style={{ gap: 10 }}>
        <View style={styles.detailActionRow}>{manageBatch && canManage && actionButton('Điểm danh / QR', ClipboardCheck, () => void openAttendance(manageBatch), 'primary')}</View>
        {batchBusy ? <LoadState title="Đang cập nhật lớp" detail="Đang đồng bộ danh sách học viên…" busy /> : <>
          <Text style={styles.detailSectionTitle}>Đã xếp lớp ({enrollments.length})</Text>{enrollments.map((enrollment) => { const student = students.find((item) => item.id === enrollment.studentId); return <View key={enrollment.studentId} style={styles.optionRow}><View style={{ flex: 1 }}><Text style={styles.optionTitle}>{student?.fullName || enrollment.studentId}</Text><Text style={styles.optionDetail}>{student?.phone || ''} · {enrollment.status || 'Đang học'}</Text></View>{canManage && student ? <Pressable onPress={() => void updateBatchLearner(manageBatch!, student, true)} style={styles.miniAction}><Trash2 size={13} color="#B42318" /><Text style={[styles.miniActionText, { color: '#B42318' }]}>Gỡ</Text></Pressable> : null}</View>; })}
          <Text style={[styles.detailSectionTitle, { marginTop: 18 }]}>Thêm học viên</Text>{students.filter((student) => !enrollments.some((entry) => entry.studentId === student.id)).slice(0, 80).map((student) => <Pressable key={student.id} onPress={() => void updateBatchLearner(manageBatch!, student, false)} disabled={!canManage || batchBusy} style={styles.optionRow}><View style={{ flex: 1 }}><Text style={styles.optionTitle}>{student.fullName}</Text><Text style={styles.optionDetail}>{student.phone} · {statusOf(student)}</Text></View><Plus size={16} color={colors.primary} /></Pressable>)}
        </>}
      </View>
    </FullScreenFormModal>

    <FullScreenFormModal
      visible={Boolean(attendanceBatch)}
      title={attendanceBatch ? `Điểm danh · ${attendanceBatch.code}` : 'Điểm danh lớp'}
      onClose={() => setAttendanceBatch(null)}
    >
      <View style={{ gap: 10 }}>
        <DateTimeField label="Ngày điểm danh" mode="date" value={attendanceDate} onChange={(value) => void changeAttendanceDate(value)} />
        <View style={[styles.twoColumns, { marginTop: 4, marginBottom: 4 }]}>
          <Pressable disabled={qrCreating} onPress={() => attendanceBatch && void startQrAttendance(attendanceBatch)} style={[styles.saveButton, { flex: 1, gap: 6 }, qrCreating && styles.disabled]}>
            {qrCreating ? <ActivityIndicator color={colors.white} size="small" /> : <QrCode size={14} color={colors.white} />}
            <Text style={styles.saveText}>{qrCreating ? 'Đang tạo QR…' : qrSession ? 'Tạo lại QR' : 'Tạo QR'}</Text>
          </Pressable>
          <Pressable disabled={batchBusy} onPress={() => void saveAttendance()} style={[styles.secondaryWide, { flex: 1, marginVertical: 0 }, batchBusy && styles.disabled]}>
            {batchBusy ? <ActivityIndicator color={colors.primary} size="small" /> : <Check size={14} color={colors.primary} />}
            <Text style={styles.secondaryWideText}>Lưu điểm danh</Text>
          </Pressable>
        </View>
        {qrSession ? (
          <View style={styles.qrPanel}>
            <QRCode value={qrSession.url} size={172} backgroundColor={colors.white} color={colors.ink} />
            <Text style={styles.optionTitle}>Đã điểm danh qua QR: {qrSession.checkedIn}</Text>
            <Text selectable style={styles.qrUrl}>{qrSession.url}</Text>
            <View style={[styles.twoColumns, { width: '100%', marginTop: 4 }]}>
              <Pressable onPress={() => void Share.share({ message: qrSession.url, url: qrSession.url })} style={[styles.secondaryWide, { flex: 1, marginVertical: 0 }]}>
                <Share2 size={14} color={colors.primary} />
                <Text style={styles.secondaryWideText}>Chia sẻ link</Text>
              </Pressable>
              <Pressable onPress={() => void closeStudentQrSession(qrSession.sessionId, scope).then(() => setQrSession(null)).catch((cause) => Alert.alert('Không đóng được', cause instanceof Error ? cause.message : 'Lỗi đóng phiên.'))} style={[styles.cancelButton, { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#FFF1F0' }]}>
                <X size={14} color="#B42318" />
                <Text style={[styles.cancelText, { color: '#B42318' }]}>Đóng phiên</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        <Text style={[styles.detailSectionTitle, { marginTop: 8 }]}>Danh sách học viên ({attendanceLearners.length})</Text>
        {attendanceLearners.length === 0 ? <Text style={styles.emptyHint}>Chưa có học viên nào trong lớp này.</Text> : null}
        {attendanceLearners.map((enrollment) => { const studentId = enrollment.studentId; const student = students.find((item) => item.id === studentId); if (!student) return null; const state = attendanceDraft[studentId]; const label = state ? attendanceStatusLabel(state) : 'Chưa điểm danh'; return <Pressable key={studentId} onPress={() => setAttendanceDraft((current) => ({ ...current, [studentId]: nextAttendanceStatus(current[studentId]) }))} style={styles.optionRow}><View style={{ flex: 1 }}><Text style={styles.optionTitle}>{student.fullName}</Text><Text style={styles.optionDetail}>{student.phone}</Text></View><Badge label={label} /></Pressable>; })}
      </View>
    </FullScreenFormModal>

    <FullScreenFormModal
      visible={Boolean(qualityDetail)}
      title={qualityDetail ? `Đánh giá · ${qualityDetail.studentName}` : 'Đánh giá học viên'}
      onClose={() => { setQualityDetail(null); setQualityDetailData(null); }}
      footer={!qualityDetailLoading ? <Pressable onPress={() => void saveAssessment()} disabled={savingAssessment} style={[styles.saveButton, savingAssessment && styles.disabled]}>{savingAssessment ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.saveText}>Lưu nhận xét</Text>}</Pressable> : undefined}
    >
      {qualityDetailLoading ? <LoadState title="Đang tải tiến trình học tập" detail="Đang lấy mini test, bài tập và kết quả thi…" busy /> : <View style={{ gap: 10 }}><View style={styles.detailGrid}><Detail label="Lớp / khóa" value={`${qualityDetail?.batchCode || ''} · ${qualityDetail?.courseTitle || ''}`} /><Detail label="Chuyên cần" value={`${qualityDetail?.attendance.attended || 0}/${qualityDetail?.attendance.total || 0} · ${qualityDetail?.attendance.rate ?? '—'}%`} /><Detail label="Bài tập" value={`${qualityDetail?.assignments.completed || 0}/${qualityDetail?.assignments.total || 0}`} /><Detail label="Cảnh báo" value={qualityDetail?.warningLevel || '—'} /></View><Field label="Thái độ học viên" value={draft.attitudeNote} onChangeText={(value) => setDraft((current) => ({ ...current, attitudeNote: value }))} multiline /><Field label="Nhận xét giáo viên" value={draft.teacherAssessment} onChangeText={(value) => setDraft((current) => ({ ...current, teacherAssessment: value }))} multiline /><Text style={styles.detailSectionTitle}>Thêm mini test</Text><Field label="Tên bài kiểm tra" value={draft.miniTestTitle} onChangeText={(value) => setDraft((current) => ({ ...current, miniTestTitle: value }))} /><View style={styles.twoColumns}><Field label="Điểm" value={draft.miniTestScore} onChangeText={(value) => setDraft((current) => ({ ...current, miniTestScore: value }))} keyboardType="decimal-pad" /><Field label="Thang điểm" value={draft.miniTestMax} onChangeText={(value) => setDraft((current) => ({ ...current, miniTestMax: value }))} keyboardType="decimal-pad" /></View><DateTimeField label="Ngày kiểm tra" mode="date" value={draft.miniTestDate} onChange={(value) => setDraft((current) => ({ ...current, miniTestDate: value }))} /><Field label="Nhận xét" value={draft.miniTestNote} onChangeText={(value) => setDraft((current) => ({ ...current, miniTestNote: value }))} /><Pressable onPress={() => void saveMiniTest()} disabled={saving} style={styles.secondaryWide}><Plus size={14} color={colors.primary} /><Text style={styles.secondaryWideText}>Lưu điểm mini test</Text></Pressable><Text style={styles.detailSectionTitle}>Lịch sử mini test</Text>{qualityDetailData?.miniTests.map((item) => <View key={item.id} style={styles.installmentRow}><View style={{ flex: 1 }}><Text style={styles.optionTitle}>{item.title} · {item.score == null ? 'Chưa chấm' : `${item.score}/${item.maxScore}`}</Text><Text style={styles.optionDetail}>{item.date}{item.note ? ` · ${item.note}` : ''}</Text></View><Pressable onPress={() => confirmDeleteMiniTest(item)}><Trash2 size={15} color="#B42318" /></Pressable></View>)}{!qualityDetailData?.miniTests.length ? <Text style={styles.emptyHint}>Chưa có mini test.</Text> : null}<Text style={styles.detailSectionTitle}>Bài tập đã giao</Text>{qualityDetailData?.assignments.items.map((item) => <View key={item.id} style={styles.progressionCard}><View style={styles.cardHead}><View style={{ flex: 1 }}><Text style={styles.optionTitle}>{item.title}</Text><Text style={styles.optionDetail}>{item.status === 'not_submitted' ? 'Chưa nộp' : item.status === 'graded' ? 'Đã chấm' : item.status === 'late' ? 'Nộp muộn' : 'Đã nộp'} · {item.score == null ? `Thang điểm ${item.maxScore}` : `${item.score}/${item.maxScore}`}</Text></View>{item.status !== 'not_submitted' ? <Pressable onPress={() => setAssignmentGrade((current) => current?.id === item.id ? null : { id: item.id, score: item.score == null ? '' : String(item.score), feedback: item.feedback || '' })}><Pencil size={15} color={colors.primary} /></Pressable> : null}</View>{item.feedback ? <Text style={styles.optionDetail}>Nhận xét: {item.feedback}</Text> : null}{assignmentGrade?.id === item.id ? <><View style={styles.twoColumns}><Field label={`Điểm / ${item.maxScore}`} value={assignmentGrade.score} onChangeText={(value) => setAssignmentGrade((current) => current ? { ...current, score: value } : current)} keyboardType="decimal-pad" /><Field label="Phản hồi" value={assignmentGrade.feedback} onChangeText={(value) => setAssignmentGrade((current) => current ? { ...current, feedback: value } : current)} /></View><Pressable onPress={() => void saveAssignmentGrade(item)} disabled={saving} style={styles.secondaryWide}><Check size={14} color={colors.primary} /><Text style={styles.secondaryWideText}>Lưu điểm bài tập</Text></Pressable></> : null}</View>)}{!qualityDetailData?.assignments.items.length ? <Text style={styles.emptyHint}>Lớp chưa giao bài tập.</Text> : null}<Text style={styles.detailSectionTitle}>Kết quả thi</Text>{qualityDetailData?.examResults.map((item, index) => <View key={item.id || `${item.name}-${index}`} style={styles.installmentRow}><View style={{ flex: 1 }}><Text style={styles.optionTitle}>{item.name || 'Kỳ thi'}</Text><Text style={styles.optionDetail}>{item.date || ''} · {item.result?.overall || 'Chưa có kết quả'}</Text></View></View>)}{!qualityDetailData?.examResults.length ? <Text style={styles.emptyHint}>Chưa có kết quả thi.</Text> : null}</View>}
    </FullScreenFormModal>

    <FullScreenFormModal
      visible={Boolean(scoreDialog)}
      title={`Điểm thi · ${scoreDialog?.exam.name || ''}`}
      onClose={() => setScoreDialog(null)}
      footer={<Pressable onPress={() => void saveExamScores()} disabled={saving} style={[styles.saveButton, saving && styles.disabled]}><Text style={styles.saveText}>Lưu điểm thi</Text></Pressable>}
    >
      <View style={{ gap: 10 }}>{scoreDialog?.students.map((student) => { const existing = scoreDialog.exam.results?.find((item) => item.studentId === student.id); const score = scoreValues[student.id] || ''; const outcome = existing?.outcome || existing?.overallResult || (existing?.score == null ? 'Chưa có' : existing.score >= (scoreDialog.exam.passScore ?? Math.ceil((scoreDialog.exam.maxScore || 100) / 2)) ? 'Đậu' : 'Trượt'); return <View key={student.id} style={styles.progressionCard}><View style={styles.cardHead}><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{student.fullName}</Text><Text style={styles.cardMeta}>{student.phone} · Kết quả: {outcome}</Text></View><Pressable onPress={() => confirmUnassignExamStudent(scoreDialog.exam, student)}><Trash2 size={16} color="#B42318" /></Pressable></View><View style={styles.row}><Text style={styles.fieldLabel}>Điểm (tối đa {scoreDialog.exam.maxScore || 100})</Text><TextInput value={score} onChangeText={(value) => setScoreValues((current) => ({ ...current, [student.id]: value }))} keyboardType="decimal-pad" placeholder="Chưa nhập" placeholderTextColor={colors.muted} style={[styles.input, { flex: 1 }]} /></View><View style={styles.filters}>{(['Đậu', 'Trượt', 'Chưa có'] as const).map((value) => <Pressable key={value} onPress={() => void updateExamOutcome(scoreDialog.exam, student, value)} style={[styles.filterChip, outcome === value && styles.filterChipSelected]}><Text style={[styles.filterChipText, outcome === value && styles.filterChipTextSelected]}>{value}</Text></Pressable>)}</View></View>; })}</View>
    </FullScreenFormModal>

    <FullScreenFormModal
      visible={Boolean(assignmentDraft)}
      title="Xếp học viên dự thi"
      onClose={() => setAssignmentDraft(null)}
      footer={<Pressable onPress={() => void saveExamAssignment()} disabled={saving} style={styles.saveButton}><Text style={styles.saveText}>Thêm {assignmentDraft?.selected.length || 0} học viên</Text></Pressable>}
    >
      <View style={{ gap: 8 }}>{assignmentDraft?.candidates.map((student) => { const selected = assignmentDraft.selected.includes(student.id); return <Pressable key={student.id} onPress={() => setAssignmentDraft((current) => current ? { ...current, selected: selected ? current.selected.filter((id) => id !== student.id) : [...current.selected, student.id] } : current)} style={styles.optionRow}><View style={{ flex: 1 }}><Text style={styles.optionTitle}>{student.fullName}</Text><Text style={styles.optionDetail}>{student.phone}</Text></View><View style={[styles.checkbox, selected && styles.checkboxSelected]}>{selected ? <Check size={13} color={colors.white} /> : null}</View></Pressable> })}{assignmentDraft?.candidates.length === 0 ? <Text style={styles.emptyHint}>Không có học viên đủ điều kiện dự thi.</Text> : null}</View>
    </FullScreenFormModal>

    <FullScreenFormModal
      visible={Boolean(progressionDialog) && !progressionClassCreate}
      title={`Mở lớp theo lộ trình · ${progressionDialog?.batch.code || ''}`}
      onClose={() => setProgressionDialog(null)}
    >
      <View style={{ gap: 10 }}>
        <Text style={styles.fieldLabel}>Lộ trình</Text>{progressionDialog?.roadmaps.map((item) => { const id = String(item.id || item._id || ''); return <Pressable key={id} onPress={() => void chooseProgressionRoadmap(id)} style={[styles.optionRow, progressionDialog.roadmapId === id && styles.optionSelected]}><View style={{ flex: 1 }}><Text style={styles.optionTitle}>{item.name || item.code || 'Lộ trình'}</Text><Text style={styles.optionDetail}>{(item.steps || []).map((step) => courses.find((course) => course.id === String(step.courseId || ''))?.title || '').filter(Boolean).join(' → ')}</Text></View>{progressionDialog.roadmapId === id ? <Check size={15} color={colors.primary} /> : null}</Pressable>; })}
        {progressionDialog?.loading ? <LoadState title="Đang tải dữ liệu lộ trình" detail="Đang tổng hợp chuyên cần, bài tập, mini test và kết quả thi…" busy inline /> : null}
        {progressionDialog?.data?.rows.map((row) => { const choice = progressionDrafts[row.studentId] || { intent: row.intent, teacherNote: row.teacherNote || '' }; return <View key={row.studentId} style={styles.progressionCard}><View style={styles.cardHead}><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{row.studentName}</Text><Text style={styles.cardMeta}>{row.studentPhone}</Text></View><Badge label={row.eligible ? 'Đạt điều kiện' : 'Chưa đạt'} /></View><View style={styles.detailGrid}><Detail label="Chuyên cần" value={`${row.attendanceRate ?? '—'}%`} /><Detail label="Bài tập" value={`${row.assignmentRate ?? '—'}%`} /><Detail label="Mini test" value={`${row.miniTestRate ?? '—'}%`} /><Detail label="Kết quả thi" value={`${row.examRate ?? '—'}%`} /></View>{row.eligibilityReasons?.length ? <Text style={styles.formError}>{row.eligibilityReasons.join(' · ')}</Text> : null}<Text style={styles.fieldLabel}>Quyết định</Text><View style={styles.filters}>{([{ value: 'continue', label: 'Học tiếp' }, { value: 'pending', label: 'Chờ xác nhận' }, { value: 'repeat', label: 'Học lại' }, { value: 'preserve', label: 'Bảo lưu' }, { value: 'stop', label: 'Dừng' }] as Array<{ value: ProgressionIntent; label: string }>).map((option) => <Pressable key={option.value} onPress={() => setProgressionDrafts((current) => ({ ...current, [row.studentId]: { ...choice, intent: option.value } }))} style={[styles.filterChip, choice.intent === option.value && styles.filterChipSelected]}><Text style={[styles.filterChipText, choice.intent === option.value && styles.filterChipTextSelected]}>{option.label}</Text></Pressable>)}</View><TextInput value={choice.teacherNote} onChangeText={(value) => setProgressionDrafts((current) => ({ ...current, [row.studentId]: { ...choice, teacherNote: value } }))} placeholder="Ghi chú điều phối" placeholderTextColor={colors.muted} style={styles.input} /><Pressable onPress={() => void saveProgressionDecision(row.studentId)} disabled={saving} style={styles.secondaryWide}><Check size={14} color={colors.primary} /><Text style={styles.secondaryWideText}>Lưu quyết định</Text></Pressable></View>; })}
        {progressionDialog?.data?.targetStep ? <View style={styles.progressionCard}><Text style={styles.detailSectionTitle}>Chuyển học viên đủ điều kiện sang chặng kế tiếp</Text><Text style={styles.helperText}>Khóa học tiếp theo: {courses.find((item) => item.id === progressionDialog.data?.targetStep?.courseId)?.title || progressionDialog.data.targetStep.courseId}</Text><Pressable onPress={openProgressionClassForm} disabled={!canManage} style={[styles.secondaryWide, !canManage && styles.disabled]}><Plus size={14} color={colors.primary} /><Text style={styles.secondaryWideText}>Tạo lớp kế tiếp</Text></Pressable>{batches.filter((item) => item.courseId === progressionDialog.data?.targetStep?.courseId && !['Đã hủy', 'Đã kết thúc'].includes(item.status || '')).map((item) => <Pressable key={item.id} onPress={() => setProgressionDialog((current) => current ? { ...current, targetBatchId: item.id } : current)} style={[styles.optionRow, progressionDialog.targetBatchId === item.id && styles.optionSelected]}><Text style={styles.optionTitle}>{item.code} · {item.startDate || 'Chưa có ngày khai giảng'}</Text>{progressionDialog.targetBatchId === item.id ? <Check size={15} color={colors.primary} /> : null}</Pressable>)}<Pressable onPress={() => void promoteProgressionStudents()} disabled={!canManage || saving || !progressionDialog.targetBatchId} style={[styles.saveButton, (!canManage || saving || !progressionDialog.targetBatchId) && styles.disabled]}><Text style={styles.saveText}>Chuyển học viên đã chọn học tiếp</Text></Pressable></View> : null}
      </View>
    </FullScreenFormModal>

    <FullScreenFormModal
      visible={Boolean(enrollmentAction)}
      title={enrollmentAction?.enrollment.status === 'Bảo lưu' ? 'Cập nhật tình trạng học' : enrollmentAction?.enrollment.status === 'Chờ xếp học lại' ? 'Xếp học viên học lại' : 'Bảo lưu học viên'}
      onClose={() => setEnrollmentAction(null)}
      footer={<Pressable onPress={() => void saveEnrollmentAction()} disabled={saving} style={styles.saveButton}><Text style={styles.saveText}>{enrollmentAction?.enrollment.status === 'Bảo lưu' ? 'Cho học lại' : enrollmentAction?.enrollment.status === 'Chờ xếp học lại' ? 'Xếp vào lớp học lại' : 'Xác nhận bảo lưu'}</Text></Pressable>}
    >
      <View style={{ gap: 10 }}>
        <Text style={styles.cardMeta}>{enrollmentAction?.student?.fullName} · {enrollmentAction?.batch.code}</Text>
        <Field label="Lý do *" value={draft.reason} onChangeText={(value) => setDraft((current) => ({ ...current, reason: value }))} multiline />
        <DateTimeField label="Ngày dự kiến quay lại" mode="date" value={draft.expectedReturnAt} onChange={(value) => setDraft((current) => ({ ...current, expectedReturnAt: value }))} allowClear />
        {enrollmentAction?.enrollment.status === 'Chờ xếp học lại' ? <><Text style={styles.fieldLabel}>Lớp học lại *</Text>{batches.filter((item) => item.id !== enrollmentAction.batch.id && item.status !== 'Đã hủy').map((item) => <Pressable key={item.id} onPress={() => setDraft((current) => ({ ...current, targetBatchId: item.id }))} style={[styles.optionRow, draft.targetBatchId === item.id && styles.optionSelected]}><Text style={styles.optionTitle}>{item.code} · {item.courseTitle || item.name || ''}</Text>{draft.targetBatchId === item.id ? <Check size={15} color={colors.primary} /> : null}</Pressable>)}<Field label="Lệ phí học lại (VND)" value={draft.retakeFee} onChangeText={(value) => setDraft((current) => ({ ...current, retakeFee: formatVndInput(value) }))} keyboardType="number-pad" /></> : enrollmentAction?.enrollment.status === 'Bảo lưu' ? <Text style={styles.helperText}>Xác nhận sẽ đưa học viên trở lại trạng thái đang học.</Text> : null}
      </View>
    </FullScreenFormModal>

    <FullScreenFormModal
      visible={Boolean(bookingResource)}
      title={`Đặt lịch · ${bookingResource?.name || ''}`}
      onClose={() => setBookingResource(null)}
      footer={<Pressable onPress={() => void saveBooking()} disabled={saving} style={styles.saveButton}><Text style={styles.saveText}>Xác nhận đặt lịch</Text></Pressable>}
    >
      <View style={{ gap: 10 }}>
        <Field label="Mục đích sử dụng *" value={draft.purpose} onChangeText={(value) => setDraft((current) => ({ ...current, purpose: value }))} />
        <Field label="Người đăng ký *" value={draft.by} onChangeText={(value) => setDraft((current) => ({ ...current, by: value }))} />
        <DateTimeField label="Ngày sử dụng" mode="date" value={draft.bookingDate} onChange={(value) => setDraft((current) => ({ ...current, bookingDate: value }))} />
        <View style={styles.twoColumns}><DateTimeField label="Từ" mode="time" value={draft.startTime} onChange={(value) => setDraft((current) => ({ ...current, startTime: value }))} /><DateTimeField label="Đến" mode="time" value={draft.endTime} onChange={(value) => setDraft((current) => ({ ...current, endTime: value }))} /></View>
      </View>
    </FullScreenFormModal>

    <FullScreenFormModal
      visible={qualityThresholdDialog}
      title="Ngưỡng cảnh báo chất lượng"
      onClose={() => setQualityThresholdDialog(false)}
      footer={<Pressable onPress={() => void saveQualityThresholdSettings()} disabled={saving} style={styles.saveButton}><Text style={styles.saveText}>Lưu ngưỡng</Text></Pressable>}
    >
      <View style={{ gap: 10 }}>
        <Text style={styles.helperText}>Đặt tỷ lệ tối thiểu cho chuyên cần, bài tập và mini test. Học viên thấp hơn ngưỡng rủi ro sẽ được đánh dấu để theo dõi.</Text>
        <View style={styles.twoColumns}><Field label="Rủi ro · chuyên cần (%)" value={String(qualityThresholds.riskAttendance)} onChangeText={(value) => setQualityThresholds((current) => ({ ...current, riskAttendance: Number(value) }))} keyboardType="decimal-pad" /><Field label="Theo dõi · chuyên cần (%)" value={String(qualityThresholds.watchAttendance)} onChangeText={(value) => setQualityThresholds((current) => ({ ...current, watchAttendance: Number(value) }))} keyboardType="decimal-pad" /></View>
        <View style={styles.twoColumns}><Field label="Rủi ro · bài tập (%)" value={String(qualityThresholds.riskAssignment)} onChangeText={(value) => setQualityThresholds((current) => ({ ...current, riskAssignment: Number(value) }))} keyboardType="decimal-pad" /><Field label="Theo dõi · bài tập (%)" value={String(qualityThresholds.watchAssignment)} onChangeText={(value) => setQualityThresholds((current) => ({ ...current, watchAssignment: Number(value) }))} keyboardType="decimal-pad" /></View>
        <View style={styles.twoColumns}><Field label="Rủi ro · mini test (%)" value={String(qualityThresholds.riskMiniTest)} onChangeText={(value) => setQualityThresholds((current) => ({ ...current, riskMiniTest: Number(value) }))} keyboardType="decimal-pad" /><Field label="Theo dõi · mini test (%)" value={String(qualityThresholds.watchMiniTest)} onChangeText={(value) => setQualityThresholds((current) => ({ ...current, watchMiniTest: Number(value) }))} keyboardType="decimal-pad" /></View>
        <Field label="Thang điểm mặc định cho bài tập" value={String(qualityThresholds.assignmentMaxScore)} onChangeText={(value) => setQualityThresholds((current) => ({ ...current, assignmentMaxScore: Number(value) }))} keyboardType="decimal-pad" />
      </View>
    </FullScreenFormModal>

    <FullScreenFormModal
      visible={categoryModalOpen}
      title={area === 'courses' ? 'Quản lý danh mục khóa học' : `Quản lý phân loại ${area === 'classrooms' ? 'phòng học' : 'thiết bị'}`}
      onClose={() => { if (!categoryBusy) setCategoryModalOpen(false); }}
    >
      <View style={{ gap: 10 }}>
        <View style={[styles.row, { marginBottom: 4 }]}>
          <TextInput
            value={newCategoryName}
            onChangeText={setNewCategoryName}
            placeholder={area === 'courses' ? 'Nhập tên danh mục mới...' : `Nhập phân loại ${area === 'classrooms' ? 'phòng học' : 'thiết bị'}...`}
            placeholderTextColor={colors.muted}
            style={[styles.input, { flex: 1 }]}
            returnKeyType="done"
            onSubmitEditing={() => { void addActiveCategory(); }}
          />
          <Pressable disabled={categoryBusy || !newCategoryName.trim()} onPress={() => void addActiveCategory()} style={[styles.saveButton, (categoryBusy || !newCategoryName.trim()) && styles.disabled]}>
            {categoryBusy ? <ActivityIndicator color={colors.white} size="small" /> : <><Plus size={14} color={colors.white} style={{ marginRight: 4 }} /><Text style={styles.saveText}>Thêm</Text></>}
          </Pressable>
        </View>
        {(area === 'courses' ? courseCategories : visibleResourceCategories).length === 0 ? (
          <Text style={styles.emptyHint}>{area === 'courses' ? 'Chưa có danh mục khóa học nào.' : `Chưa có phân loại ${area === 'classrooms' ? 'phòng học' : 'thiết bị'} nào.`}</Text>
        ) : (
          (area === 'courses' ? courseCategories : visibleResourceCategories).map((cat) => (
            <View key={cat.id} style={styles.optionRow}>
              <Tag size={14} color={colors.primary} />
              <Text style={[styles.optionTitle, { flex: 1 }]}>{cat.name}</Text>
              <Pressable disabled={categoryBusy} onPress={() => removeActiveCategory(cat)} style={styles.miniAction}>
                <Trash2 size={14} color="#B42318" />
              </Pressable>
            </View>
          ))
        )}
      </View>
    </FullScreenFormModal>

    <FullScreenFormModal
      visible={registerQrOpen}
      title="QR đăng ký học viên"
      onClose={() => setRegisterQrOpen(false)}
      footer={
        <View style={styles.detailActionRow}>
          <Pressable disabled={!registerQrUrl || registerQrLoading} onPress={() => void Share.share({ message: registerQrUrl, url: registerQrUrl })} style={[styles.saveButton, { flex: 1 }, (!registerQrUrl || registerQrLoading) && styles.disabled]}>
            <Share2 size={14} color={colors.white} style={{ marginRight: 6 }} />
            <Text style={styles.saveText}>Chia sẻ link</Text>
          </Pressable>
          <Pressable disabled={registerQrLoading} onPress={() => void openRegisterQr()} style={[styles.cancelButton, { flexDirection: 'row', alignItems: 'center', gap: 5 }, registerQrLoading && styles.disabled]}>
            <RefreshCw size={13} color={colors.ink} />
            <Text style={styles.cancelText}>Tạo lại</Text>
          </Pressable>
        </View>
      }
    >
      <View style={{ gap: 12 }}>
        <Text style={styles.helperText}>Học viên quét mã để tự điền hồ sơ, bản ghi sẽ về thẳng danh sách của bạn.</Text>
        <View style={styles.qrPanel}>
          {registerQrLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 64 }} />
          ) : registerQrUrl ? (
            <QRCode value={registerQrUrl} size={196} backgroundColor={colors.white} color={colors.ink} />
          ) : null}
          {registerQrUrl ? <Text selectable style={styles.qrUrl}>{registerQrUrl}</Text> : null}
        </View>
      </View>
    </FullScreenFormModal>

    <BatchDetailModal
      batch={viewingBatch}
      roadmapName={viewingBatch?.roadmapId ? roadmaps.find((rm) => String(rm.id || rm._id || '') === viewingBatch.roadmapId)?.name : undefined}
      canManage={canManage}
      onClose={() => setViewingBatch(null)}
      onOpenLearners={(item) => void openBatchManager(item)}
      onOpenAttendance={(item) => void openAttendance(item)}
      onOpenHistory={(item) => setHistoryBatch(item)}
      onOpenAssignments={(item) => setAssignmentsBatch(item)}
      onOpenProgression={(item) => void openBatchProgression(item)}
      onEdit={(item) => openEdit(item)}
      onDelete={(item) => confirmDelete('lớp học', () => deleteBatch(item.id, scope))}
    />
    <BatchAttendanceHistoryModal batch={historyBatch} students={students} onClose={() => setHistoryBatch(null)} />
    <BatchAssignmentsModal batch={assignmentsBatch} students={students} scope={scope} canManage={canManage} onClose={() => setAssignmentsBatch(null)} />

    <Modal visible={filterOpen} transparent statusBarTranslucent animationType="slide" onRequestClose={() => setFilterOpen(false)}>
      <Pressable style={styles.sheetBackdrop} onPress={() => setFilterOpen(false)}>
        <Pressable style={[styles.sheetModal, { maxHeight: '86%', paddingHorizontal: 0 }]} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <View style={[styles.sheetHeader, { paddingHorizontal: 18 }]}>
            <Text style={styles.sheetTitle}>Bộ lọc</Text>
            <Pressable onPress={() => setFilterOpen(false)} hitSlop={8}><Text style={styles.sheetClose}>Đóng</Text></Pressable>
          </View>
          <ScrollView style={{ maxHeight: 500 }} contentContainerStyle={styles.filterModalContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {filterOptions(area).length ? <FilterChoice title="Trạng thái" value={statusFilter} options={filterOptions(area)} onChange={setStatusFilter} /> : null}
          {area === 'students' ? <>
            <FilterChoice title="Khóa học" value={courseFilter} options={[{ value: 'Tất cả', label: 'Tất cả khóa học' }, ...courses.map((item) => ({ value: item.id, label: `${item.code} · ${item.title}` }))]} onChange={setCourseFilter} />
            <FilterChoice title="Tình trạng học phí" value={feeFilter} options={['Tất cả học phí', 'Miễn phí', 'Đã đóng đủ', 'Chưa đóng', 'Còn thiếu'].map((value) => ({ value, label: value }))} onChange={setFeeFilter} />
            <View style={styles.filterDateRow}><DateTimeField label="Đăng ký từ" mode="date" value={dateFromFilter} onChange={setDateFromFilter} allowClear /><DateTimeField label="Đến ngày" mode="date" value={dateToFilter} onChange={setDateToFilter} allowClear /></View>
            <FilterChoice title="Sắp xếp" value={sortFilter} options={[{ value: 'newest', label: 'Mới đăng ký trước' }, { value: 'oldest', label: 'Cũ nhất trước' }, { value: 'name-asc', label: 'Họ tên A–Z' }, { value: 'name-desc', label: 'Họ tên Z–A' }]} onChange={setSortFilter} />
          </> : null}
          {area === 'courses' ? <FilterChoice title="Danh mục khóa học" value={courseFilter} options={[{ value: 'Tất cả', label: 'Tất cả danh mục' }, ...Array.from(new Set([...courseCategories.map((item) => item.name), ...courses.map((item) => item.category)])).filter(Boolean).map((value) => ({ value, label: value }))]} onChange={setCourseFilter} /> : null}
          {area === 'batches' ? <><FilterChoice title="Khóa học" value={courseFilter} options={[{ value: 'Tất cả', label: 'Tất cả khóa học' }, ...courses.map((item) => ({ value: item.id, label: `${item.code} · ${item.title}` }))]} onChange={setCourseFilter} /><FilterChoice title="Tiến độ lớp" value={progressFilter} options={['Tất cả', 'Chưa bắt đầu', 'Có tiến độ', 'Hoàn thành'].map((value) => ({ value, label: value }))} onChange={setProgressFilter} /></> : null}
          {area === 'quality' ? <>
            <FilterChoice title="Lớp học" value={batchFilter} options={[{ value: 'Tất cả', label: 'Tất cả lớp' }, ...batches.map((item) => ({ value: item.id, label: `${item.code} · ${item.courseTitle || ''}` }))]} onChange={setBatchFilter} />
            <FilterChoice title="Khóa học" value={courseFilter} options={[{ value: 'Tất cả', label: 'Tất cả khóa học' }, ...courses.map((item) => ({ value: item.id, label: `${item.code} · ${item.title}` }))]} onChange={setCourseFilter} />
          </> : null}
          {area === 'exams' ? <>
            <FilterChoice title="Lớp học" value={batchFilter} options={[{ value: 'Tất cả', label: 'Tất cả lớp' }, ...batches.map((item) => ({ value: item.id, label: `${item.code} · ${item.courseTitle || ''}` }))]} onChange={setBatchFilter} />
            <View style={styles.filterDateRow}><DateTimeField label="Ngày thi từ" mode="date" value={dateFromFilter} onChange={setDateFromFilter} allowClear /><DateTimeField label="Đến ngày" mode="date" value={dateToFilter} onChange={setDateToFilter} allowClear /></View>
          </> : null}
          {area === 'fees' ? <>
            <FilterChoice title="Tình trạng học phí" value={feeFilter === 'Tất cả học phí' ? 'Tất cả' : feeFilter} options={['Tất cả', 'Còn nợ', 'Đã hoàn thành', 'Miễn phí'].map((value) => ({ value, label: value }))} onChange={(value) => setFeeFilter(value === 'Tất cả' ? 'Tất cả học phí' : value)} />
            <View style={styles.filterDateRow}><DateTimeField label="Ngày thu từ" mode="date" value={dateFromFilter} onChange={setDateFromFilter} allowClear /><DateTimeField label="Đến ngày" mode="date" value={dateToFilter} onChange={setDateToFilter} allowClear /></View>
          </> : null}
          {area === 'classrooms' || area === 'resources' ? <FilterChoice title={area === 'classrooms' ? 'Loại phòng học' : 'Loại thiết bị'} value={resourceTypeFilter} options={[{ value: 'Tất cả', label: 'Tất cả loại' }, ...Array.from(new Set(resources.filter((item) => area === 'classrooms' ? normalize(item.type).includes('phong hoc') : !normalize(item.type).includes('phong hoc')).map((item) => item.type))).map((value) => ({ value, label: value }))]} onChange={setResourceTypeFilter} /> : null}
          {area === 'classrooms' ? <View style={styles.filterDateRow}><DateTimeField label="Ngày xem lịch phòng" mode="date" value={dateFromFilter} onChange={setDateFromFilter} allowClear /></View> : null}
          </ScrollView>
          <View style={styles.filterModalFooter}><Text style={styles.filterModalHint}>{activeFilterCount ? `Đang áp dụng ${activeFilterCount} điều kiện lọc.` : 'Chưa áp dụng bộ lọc.'}</Text><Pressable onPress={() => resetFilters()} style={styles.clearFilterButton}><Text style={styles.clearFilterText}>Xóa lọc</Text></Pressable><Pressable onPress={() => { if (dateFromFilter && dateToFilter && dateFromFilter > dateToFilter) { Alert.alert('Khoảng ngày chưa hợp lệ', 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.'); return; } setFilterOpen(false); }} style={[styles.saveButton, { minHeight: 36, paddingHorizontal: 14 }]}><Text style={styles.saveText}>Áp dụng</Text></Pressable></View>
        </Pressable>
      </Pressable>
    </Modal>

    <Modal visible={companyPickerOpen} transparent statusBarTranslucent animationType="slide" onRequestClose={() => setCompanyPickerOpen(false)}>
      <Pressable style={styles.sheetBackdrop} onPress={() => setCompanyPickerOpen(false)}>
        <Pressable style={styles.sheetModal} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Chọn cơ sở đào tạo</Text>
            <Pressable onPress={() => setCompanyPickerOpen(false)} hitSlop={8}><Text style={styles.sheetClose}>Đóng</Text></Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }}>
            {companies.map((company) => {
              const selected = company.code === companyCode;
              return (
                <Pressable key={company.code} onPress={() => { if (!selected) { setCompanyCode(company.code); setActiveBranchId(undefined); setBranches([]); } setCompanyPickerOpen(false); }} style={[styles.sheetRow, selected && styles.sheetRowActive]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetRowTitle}>{company.name}</Text>
                    <Text numberOfLines={1} style={styles.sheetRowSub}>{company.code}</Text>
                  </View>
                  {selected ? <Check size={17} color={colors.primary} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>

    <Modal visible={branchPickerOpen} transparent statusBarTranslucent animationType="slide" onRequestClose={() => setBranchPickerOpen(false)}>
      <Pressable style={styles.sheetBackdrop} onPress={() => setBranchPickerOpen(false)}>
        <Pressable style={styles.sheetModal} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Chọn chi nhánh</Text>
            <Pressable onPress={() => setBranchPickerOpen(false)} hitSlop={8}><Text style={styles.sheetClose}>Đóng</Text></Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }}>
            {branches.map((branch) => {
              const selected = branch._id === branchId;
              return (
                <Pressable key={branch._id} onPress={() => { setActiveBranchId(branch._id); setBranchPickerOpen(false); }} style={[styles.sheetRow, selected && styles.sheetRowActive]}>
                  <BranchAppIcon size={38} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetRowTitle}>{branch.name}</Text>
                    {branch.code ? <Text numberOfLines={1} style={styles.sheetRowSub}>Mã chi nhánh: {branch.code}</Text> : null}
                  </View>
                  {selected ? <Check size={17} color={colors.primary} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  </View>;
}

type Lists = { students: StudentRecord[]; courses: CourseRecord[]; batches: BatchRecord[]; allBatches?: BatchRecord[]; exams: ExamRecord[]; quality: QualityRow[]; payments: PaymentRecord[]; notifications: StudentNotification[]; resources: StudentResource[]; roadmaps: RoadmapRecord[]; waitlist: WaitlistRecord[]; enrollments: EnrolledRecord[] };
type Actions = {
  canManage: boolean; page: number; pageSize: number; scheduleDate: string; openStudentDetail: (item: StudentRecord) => void; openStudentPayment: (item: StudentRecord) => void; openEdit: (item: StudentRecord | CourseRecord | BatchRecord | ExamRecord | StudentResource | PaymentRecord | RoadmapRecord) => void; updateRoadmap: (id: string, input: Record<string, unknown>) => Promise<unknown>; toggleResourceMaintenance: (item: StudentResource) => void; confirmDelete: (label: string, action: () => Promise<unknown>) => void;
  deleteStudentRecord: (id: string) => Promise<unknown>; deleteCourseRecord: (id: string) => Promise<unknown>; deleteBatchRecord: (id: string) => Promise<unknown>; deleteExamRecord: (id: string) => Promise<unknown>; deleteResourceRecord: (id: string) => Promise<unknown>;
  openBatchDetail: (item: BatchRecord) => void; openBatchManager: (item: BatchRecord) => void; openBatchProgression: (item: BatchRecord) => void; openAttendance: (item: BatchRecord) => void; openBatchHistory: (item: BatchRecord) => void; openBatchAssignments: (item: BatchRecord) => void; setQualityDetail: (item: QualityRow) => void; openExamAssignment: (item: ExamRecord) => void; openExamScores: (item: ExamRecord) => void;
  setEnrollmentAction: (batch: BatchRecord, enrollment: EnrolledRecord, student?: StudentRecord) => void; openBooking: (item: StudentResource) => void;
  deleteNotification: (item: StudentNotification) => void; markNotificationInstallmentPaid: (item: StudentNotification) => void; deletePayment: (item: PaymentRecord) => void; cancelBooking: (resource: StudentResource, bookingId: string) => void; placeWaitlistRow: (entry: WaitlistRecord) => void; load: (quiet?: boolean) => Promise<void>;
};

function renderArea(area: Area, lists: Lists, actions: Actions) {
  const { canManage } = actions;
  const pageRows = <T,>(items: T[]) => items.slice((actions.page - 1) * actions.pageSize, actions.page * actions.pageSize);
  const renderGrouped = (nodes: ReactNode[]) => (nodes.length ? <View style={styles.listGroup}>{nodes}</View> : null);

  if (area === 'students') {
    const rows = pageRows(lists.students);
    return <View style={styles.cardList}>{renderGrouped(rows.map((item, idx) => {
      const courseTitle = lists.courses.find((course) => course.id === item.courseId)?.title;
      return (
        <EntityCard
          key={item.id}
          isFirst={idx === 0}
          avatarInitials={getInitials(item.fullName)}
          title={item.fullName}
          subtitle={`${item.phone}${courseTitle ? ` · ${courseTitle}` : ''}`}
          badge={statusOf(item)}
          details={[]}
          onPress={() => actions.openStudentDetail(item)}
        />
      );
    }))}{empty(lists.students, 'Chưa có hồ sơ học viên.')}</View>;
  }
  if (area === 'courses') {
    const rows = pageRows(lists.courses);
    return <View style={styles.cardList}>{renderGrouped(rows.map((item, idx) => (
      <EntityCard
        key={item.id}
        isFirst={idx === 0}
        title={`${item.code} · ${item.title}`}
        subtitle={`${item.category} · ${item.duration}${item.fee ? ` · ${money(String(item.fee).replace(/\D/g, ''))}` : ''}`}
        badge={item.status || 'Hoạt động'}
        details={[]}
        onPress={canManage ? () => actions.openEdit(item) : undefined}
        iconActions={canManage ? [
          { label: 'Sửa', Icon: Pencil, onPress: () => actions.openEdit(item) },
          { label: 'Xóa', Icon: Trash2, onPress: () => actions.confirmDelete('khóa học', () => actions.deleteCourseRecord(item.id)), danger: true },
        ] : []}
      />
    )))}{empty(lists.courses, 'Chưa có khóa học.')}</View>;
  }
  if (area === 'batches') {
    const rows = pageRows(lists.batches);
    return <View style={styles.cardList}>{renderGrouped(rows.map((item, idx) => {
      const cap = item.quota ?? item.maxLearners;
      const days = (item.daysOfWeek || []).map((day) => ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][day]).join(', ');
      return (
        <EntityCard
          key={item.id}
          isFirst={idx === 0}
          title={`${item.code}${item.name ? ` · ${item.name}` : ''}`}
          subtitle={`${item.learnerIds?.length || 0}${cap ? `/${cap}` : ''} HV · ${item.progress?.doneSessions || 0}/${item.progress?.totalSessions || 0} buổi${days ? ` · ${days}` : ''}`}
          badge={item.status || 'Sắp khai giảng'}
          details={[]}
          onPress={() => actions.openBatchDetail(item)}
        />
      );
    }))}{empty(lists.batches, 'Chưa có lớp học.')}</View>;
  }
  if (area === 'quality') {
    const rows = pageRows(lists.quality);
    return <View style={styles.cardList}>{renderGrouped(rows.map((item, idx) => (
      <EntityCard
        key={item.id}
        isFirst={idx === 0}
        avatarInitials={getInitials(item.studentName)}
        title={item.studentName}
        subtitle={`${item.batchCode} · CC ${item.attendance.rate ?? '—'}% · BT ${item.assignments.rate ?? '—'}%`}
        badge={item.warningLevel === 'risk' ? 'Cần can thiệp' : item.warningLevel === 'watch' ? 'Cần theo dõi' : item.warningLevel === 'good' ? 'Ổn định' : 'Chưa đánh giá'}
        details={[]}
        onPress={canManage ? () => actions.setQualityDetail(item) : undefined}
      />
    )))}{empty(lists.quality, 'Chưa có dữ liệu đánh giá theo lớp.')}</View>;
  }
  if (area === 'exams') {
    const rows = pageRows(lists.exams);
    return <View style={styles.cardList}>{renderGrouped(rows.map((item, idx) => (
      <EntityCard
        key={item.id}
        isFirst={idx === 0}
        title={item.name}
        subtitle={`${item.batchCode || 'Chưa có lớp'} · ${item.officialDate || item.tentativeDate || '—'} · ${item.studentCount || 0} TS`}
        badge={item.status}
        details={[]}
        iconActions={canManage ? [
          { label: 'Sửa', Icon: Pencil, onPress: () => actions.openEdit(item) },
          { label: 'Xóa', Icon: Trash2, onPress: () => actions.confirmDelete('kỳ thi', () => actions.deleteExamRecord(item.id)), danger: true },
        ] : []}
        actions={canManage ? [
          { label: 'Xếp thí sinh', Icon: UsersRound, onPress: () => actions.openExamAssignment(item), primary: true },
          { label: 'Nhập điểm', Icon: ClipboardCheck, onPress: () => actions.openExamScores(item) },
        ] : []}
      />
    )))}{empty(lists.exams, 'Chưa có kỳ thi.')}</View>;
  }
  if (area === 'fees') {
    const feeStudents = pageRows(lists.students);
    const feePayments = pageRows(lists.payments.slice().sort((a, b) => String(b.paidOn || b.date || '').localeCompare(String(a.paidOn || a.date || ''))));
    return <View style={styles.cardList}>
      <Text style={styles.detailSectionTitle}>Tình trạng học phí học viên</Text>
      {renderGrouped(feeStudents.map((student, idx) => (
        <EntityCard
          key={student.id}
          isFirst={idx === 0}
          avatarInitials={getInitials(student.fullName)}
          title={student.fullName}
          subtitle={`Đã thu ${money(student.paidAmount)} · Nợ ${money(studentDue(student))}`}
          badge={studentDue(student) > 0 ? 'Còn nợ' : studentFee(student) > 0 ? 'Đã hoàn thành' : 'Miễn phí'}
          details={[]}
          onPress={() => actions.openStudentDetail(student)}
          iconActions={canManage ? [{ label: 'Ghi nhận thu', Icon: Banknote, onPress: () => actions.openStudentPayment(student) }] : []}
        />
      )))}
      {empty(lists.students, 'Chưa có học viên phù hợp với bộ lọc học phí.')}
      <Text style={[styles.detailSectionTitle, { marginTop: 8 }]}>Giao dịch gần đây</Text>
      {renderGrouped(feePayments.map((item, idx) => (
        <EntityCard
          key={item.id || item._id || idx}
          isFirst={idx === 0}
          title={item.studentName || lists.students.find((student) => student.id === item.studentId)?.fullName || 'Học viên'}
          subtitle={`${money(item.amount)} · ${item.date || item.paidOn || '—'} · ${item.method || '—'}`}
          details={[]}
          onPress={canManage ? () => actions.openEdit(item) : undefined}
          iconActions={canManage ? [
            { label: 'Sửa', Icon: Pencil, onPress: () => actions.openEdit(item) },
            { label: 'Xóa', Icon: Trash2, onPress: () => actions.deletePayment(item), danger: true },
          ] : []}
        />
      )))}
      {empty(lists.payments, 'Chưa có giao dịch học phí.')}
    </View>;
  }
  if (area === 'notifications') {
    const rows = pageRows(lists.notifications);
    return <View style={styles.cardList}>{renderGrouped(rows.map((item, idx) => (
      <EntityCard
        key={item.id || item._id || idx}
        isFirst={idx === 0}
        title={item.title}
        subtitle={`${item.recipients || '—'} (${item.recipientCount || 0}) · ${item.createdAt ? new Date(item.createdAt).toLocaleDateString('vi-VN') : '—'}`}
        badge={item.status || '—'}
        details={[]}
        iconActions={canManage ? [{ label: 'Xóa lịch sử', Icon: Trash2, onPress: () => actions.deleteNotification(item), danger: true }] : []}
        actions={canManage && item.installmentPlan && item.studentIds?.length ? [{ label: 'Đánh dấu đã thu', Icon: Check, onPress: () => actions.markNotificationInstallmentPaid(item), primary: true }] : []}
      />
    )))}{empty(lists.notifications, 'Chưa có lịch sử gửi thông báo.')}</View>;
  }
  if (area === 'classrooms' || area === 'resources') {
    const rows = pageRows(lists.resources);
    return <View style={styles.cardList}>{renderGrouped(rows.map((item, idx) => (
      <EntityCard
        key={item.id}
        isFirst={idx === 0}
        title={`${item.name} · ${item.identifier}`}
        subtitle={`${item.type} · SC ${item.capacity} · ${item.bookings?.length || 0} lịch đặt`}
        badge={resourceStatusLabel(item.status)}
        details={[]}
        iconActions={canManage ? [
          { label: 'Sửa', Icon: Pencil, onPress: () => actions.openEdit(item) },
          { label: 'Xóa', Icon: Trash2, onPress: () => actions.confirmDelete(area === 'classrooms' ? 'phòng học' : 'thiết bị', () => actions.deleteResourceRecord(item.id)), danger: true },
        ] : []}
        actions={[
          { label: 'Đặt lịch', Icon: CalendarDays, onPress: () => actions.openBooking(item), primary: true },
          ...(canManage ? [{ label: item.status === 'MAINTENANCE' ? 'Sẵn sàng' : 'Bảo trì', Icon: RefreshCw, onPress: () => actions.toggleResourceMaintenance(item) }] : []),
          ...(canManage && item.bookings?.[0]?.id ? [{ label: 'Hủy lịch', Icon: X, onPress: () => actions.cancelBooking(item, item.bookings![0].id!) }] : []),
        ]}
      />
    )))}{empty(lists.resources, area === 'classrooms' ? 'Chưa có phòng học.' : 'Chưa có thiết bị.')}</View>;
  }
  if (area === 'retention') {
    const rows = pageRows(lists.enrollments);
    return <View style={styles.cardList}>{renderGrouped(rows.map((item, idx) => {
      const batch = lists.batches.find((row) => row.id === String(item.batchId || ''));
      const student = lists.students.find((row) => row.id === item.studentId);
      return (
        <EntityCard
          key={`${item.studentId}-${item.batchId}-${idx}`}
          isFirst={idx === 0}
          avatarInitials={getInitials(student?.fullName)}
          title={student?.fullName || 'Học viên'}
          subtitle={`Lớp ${batch?.code || '—'} · ${item.suspensionReason || 'Chưa ghi nhận lý do'}`}
          badge={item.status || '—'}
          details={[]}
          onPress={canManage && batch ? () => actions.setEnrollmentAction(batch, item, student) : undefined}
        />
      );
    }))}{empty(lists.enrollments, 'Không có học viên đang bảo lưu hoặc chờ xếp học lại.')}</View>;
  }
  if (area === 'roadmap') {
    return <View style={styles.cardList}>
      <Text style={styles.detailSectionTitle}>Lộ trình đào tạo</Text>
      {renderGrouped(lists.roadmaps.map((item, idx) => (
        <EntityCard
          key={String(item.id || item._id || idx)}
          isFirst={idx === 0}
          title={`${item.code || ''} · ${item.name || 'Lộ trình'}`}
          subtitle={`${(item.steps || []).length} chặng${item.description ? ` · ${item.description}` : ''}`}
          badge={item.status === 'active' ? 'Đang áp dụng' : 'Tạm dừng'}
          details={[]}
          onPress={canManage ? () => actions.openEdit(item) : undefined}
          iconActions={canManage ? [
            { label: 'Sửa', Icon: Pencil, onPress: () => actions.openEdit(item) },
            { label: item.status === 'active' ? 'Tạm dừng' : 'Kích hoạt', Icon: PauseCircle, onPress: () => { void actions.updateRoadmap(String(item.id || item._id), { status: item.status === 'active' ? 'inactive' : 'active' }).then(() => actions.load(true)).catch((cause) => Alert.alert('Không cập nhật được', cause instanceof Error ? cause.message : 'Lỗi cập nhật.')); } },
          ] : []}
        />
      )))}
      {empty(lists.roadmaps, 'Chưa cấu hình lộ trình đào tạo.')}
      <Text style={[styles.detailSectionTitle, { marginTop: 8 }]}>Học viên chờ xếp lớp ({lists.waitlist.length})</Text>
      {renderGrouped(lists.waitlist.map((item, idx) => (
        <EntityCard
          key={String(item.id || item._id || `${item.studentId}-${idx}`)}
          isFirst={idx === 0}
          avatarInitials={getInitials(item.studentName)}
          title={item.studentName || 'Học viên'}
          subtitle={`${item.roadmapName || 'Lộ trình'} · Chờ ${String(item.waitingDays || 0)} ngày`}
          details={[]}
          onPress={canManage ? () => actions.placeWaitlistRow(item) : undefined}
        />
      )))}
    </View>;
  }
  return null;
}

function EntityCard({
  title,
  subtitle,
  badge,
  avatarInitials,
  details,
  actions = [],
  iconActions = [],
  onPress,
  isFirst = false,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  avatarInitials?: string;
  details: string[];
  actions?: Array<{ label: string; Icon: typeof Plus; onPress: () => void; primary?: boolean }>;
  iconActions?: Array<{ label: string; Icon: typeof Plus; onPress: () => void; danger?: boolean }>;
  onPress?: () => void;
  isFirst?: boolean;
}) {
  return (
    <View>
      {!isFirst ? <View style={[styles.listDivider, avatarInitials ? styles.listDividerInset : null]} /> : null}
      <Pressable
        disabled={!onPress}
        onPress={onPress}
        style={({ pressed }) => [styles.listRow, pressed && onPress && styles.listRowPressed]}
      >
        <View style={styles.cardHead}>
          {avatarInitials ? (
            <View style={styles.entityAvatar}>
              <Text style={styles.entityAvatarText}>{avatarInitials}</Text>
            </View>
          ) : null}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={styles.cardTitle}>{title}</Text>
            {subtitle ? <Text numberOfLines={1} style={styles.cardMeta}>{subtitle}</Text> : null}
            {details.filter(Boolean).map((line, index) => (
              <Text key={`${line}-${index}`} numberOfLines={2} style={styles.cardDetailLine}>{line}</Text>
            ))}
          </View>
          {iconActions.length > 0 ? (
            <View style={styles.inlineIconActions}>
              {iconActions.map((action) => (
                <Pressable
                  key={action.label}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  hitSlop={4}
                  onPress={(e) => { e.stopPropagation(); action.onPress(); }}
                  style={({ pressed }) => [styles.inlineIconBtn, action.danger && styles.inlineIconBtnDanger, pressed && { opacity: 0.6 }]}
                >
                  <action.Icon size={14} color={action.danger ? '#B42318' : colors.primary} />
                </Pressable>
              ))}
            </View>
          ) : onPress && !actions.length ? (
            <ChevronRight size={16} color="#94A3B8" style={{ alignSelf: 'center' }} />
          ) : null}
        </View>
        {actions.length ? (
          <View style={[styles.actionRow, avatarInitials ? { marginLeft: 50 } : null]}>
            {actions.map((action) => (
              <Pressable key={action.label} onPress={action.onPress} style={[styles.actionButton, action.primary && styles.primaryAction]}>
                <action.Icon size={12} color={action.primary ? colors.white : action.label === 'Xóa' || action.label === 'Xóa lịch sử' ? '#B42318' : colors.primary} />
                <Text style={[styles.actionText, action.primary && styles.primaryActionText, (action.label === 'Xóa' || action.label === 'Xóa lịch sử') && styles.dangerActionText]}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}
function FilterChoice({ title, value, options, onChange }: { title: string; value: string; options: PickOption[]; onChange: (value: string) => void }) {
  return <View style={styles.filterGroup}><Text style={styles.detailSectionTitle}>{title}</Text><View style={styles.filterChoiceList}>{options.map((option) => <Pressable key={option.value} onPress={() => onChange(option.value)} style={[styles.filterChoice, value === option.value && styles.filterChoiceActive]}><Text style={[styles.filterChoiceText, value === option.value && styles.filterChoiceTextActive]} numberOfLines={2}>{option.label}</Text>{value === option.value ? <Check size={13} color={colors.white} /> : null}</Pressable>)}</View></View>;
}
function Badge({ label }: { label: string }) { return <View style={styles.badge}><Text numberOfLines={1} style={styles.badgeText}>{label}</Text></View>; }
function Detail({ label, value }: { label: string; value: string }) { return <View style={styles.detailCell}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>; }
function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) { return <View style={styles.modalHeader}><Text style={styles.modalTitle}>{title}</Text><Pressable onPress={onClose} style={styles.closeButton}><X size={18} color={colors.muted} /></Pressable></View>; }
function Field({ label, value, onChangeText, multiline, ...props }: { label: string; value: string; onChangeText: (value: string) => void; multiline?: boolean } & Omit<ComponentProps<typeof TextInput>, 'value' | 'onChangeText' | 'multiline'>) { return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} placeholderTextColor={colors.muted} style={[styles.input, multiline && styles.multiline]} {...props} /></View>; }
function LoadState({ title, detail, busy, inline, onRetry }: { title: string; detail: string; busy?: boolean; inline?: boolean; onRetry?: () => void }) { if (busy && !inline) return <CenteredPageLoader />; return <View style={styles.loadState}>{busy ? <BrandLoader size={42} /> : <><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyText}>{detail}</Text>{onRetry ? <Pressable onPress={onRetry} style={styles.retryButton}><Text style={styles.retryText}>Tải lại</Text></Pressable> : null}</>}</View>; }
function empty<T>(rows: T[], label: string) { return rows.length ? null : <View style={styles.loadState}><Text style={styles.emptyTitle}>{label}</Text></View>; }
function placeholderForArea(area: Area) { return ({ students: 'Tìm tên, điện thoại, email hoặc CCCD', courses: 'Tìm mã, tên khóa học hoặc danh mục', batches: 'Tìm mã lớp, khóa học hoặc giảng viên', quality: 'Tìm học viên, lớp hoặc khóa học', exams: 'Tìm tên kỳ thi, lớp hoặc địa điểm', fees: 'Tìm giao dịch học phí', retention: 'Tìm học viên bảo lưu / học lại', roadmap: 'Tìm lộ trình hoặc học viên chờ lớp', notifications: 'Tìm tiêu đề thông báo', classrooms: 'Tìm tên phòng hoặc mã phòng', resources: 'Tìm tên, loại hoặc mã thiết bị' } as const)[area]; }
function formTitle(area: Area, editing: boolean, paymentEdit: boolean) { if (area === 'notifications') return 'Gửi thông báo qua email'; if (area === 'fees') return paymentEdit ? 'Sửa giao dịch học phí' : 'Ghi nhận thu học phí'; const label = ({ students: 'hồ sơ học viên', courses: 'khóa học', batches: 'lớp học', exams: 'kỳ thi', classrooms: 'phòng học', resources: 'thiết bị', roadmap: 'lộ trình' } as Partial<Record<Area, string>>)[area] || 'thông tin'; return `${editing ? 'Sửa' : 'Thêm'} ${label}`; }
function filterOptions(area: Area) {
  if (area === 'students') return ['Tất cả', 'Chờ nhập học', 'Đang học', 'Đang thi', 'Đã đậu', 'Thi lại', 'Bảo lưu', 'Chờ xếp học lại', 'Đã tốt nghiệp', 'Nghỉ học', 'Đã nghỉ', 'Đã nộp HS', 'Chờ KSK', 'Đã KSK', 'Nợ học phí'].map((value) => ({ value, label: value }));
  if (area === 'courses') return ['Tất cả', 'Hoạt động', 'Tạm dừng'].map((value) => ({ value, label: value }));
  if (area === 'batches') return ['Tất cả', 'Sắp khai giảng', 'Đang học', 'Đã kết thúc', 'Đã hủy'].map((value) => ({ value, label: value }));
  if (area === 'quality') return [{ value: 'Tất cả', label: 'Tất cả mức đánh giá' }, { value: 'risk', label: 'Cần can thiệp' }, { value: 'watch', label: 'Cần theo dõi' }, { value: 'good', label: 'Ổn định' }, { value: 'unrated', label: 'Chưa đánh giá' }];
  if (area === 'exams') return ['Tất cả', 'Sắp diễn ra', 'Đang diễn ra', 'Hoàn thành', 'Đã hủy'].map((value) => ({ value, label: value }));
  if (area === 'retention') return ['Tất cả', 'Bảo lưu', 'Chờ xếp học lại'].map((value) => ({ value, label: value }));
  if (area === 'roadmap') return [{ value: 'Tất cả', label: 'Tất cả lộ trình' }, { value: 'Đang áp dụng', label: 'Đang áp dụng' }, { value: 'Tạm dừng', label: 'Tạm dừng' }];
  if (area === 'notifications') return ['Tất cả', 'Đã gửi', 'Đang gửi', 'Thất bại'].map((value) => ({ value, label: value }));
  if (area === 'classrooms' || area === 'resources') return [{ value: 'Tất cả', label: 'Tất cả trạng thái' }, { value: 'AVAILABLE', label: 'Sẵn sàng' }, { value: 'OCCUPIED', label: 'Đang sử dụng' }, { value: 'MAINTENANCE', label: 'Bảo trì' }];
  return [];
}
function filterLabel(area: Area, value: string) { return filterOptions(area).find((option) => option.value === value)?.label || 'Bộ lọc'; }
function resourceStatusLabel(status: string) { return ({ AVAILABLE: 'Sẵn sàng', OCCUPIED: 'Đang sử dụng', MAINTENANCE: 'Bảo trì' } as Record<string, string>)[status] || status; }
function classroomScheduleDetails(resource: StudentResource, batches: BatchRecord[], date: string) {
  if (!normalize(resource.type).includes('phong hoc')) return [];
  const weekday = new Date(`${date}T12:00:00`).getDay();
  const sessions = batches.filter((batch) => batch.location === resource.name && batch.status !== 'Đã hủy' && !(batch.cancelledSessionDates || []).includes(date) && (!batch.startDate || batch.startDate <= date) && (!batch.endDate || batch.endDate >= date) && (batch.daysOfWeek || []).includes(weekday)).sort((left, right) => String(left.startTime || '').localeCompare(String(right.startTime || '')));
  const overlaps = sessions.some((left, index) => sessions.slice(index + 1).some((right) => String(left.startTime || '') < String(right.endTime || '') && String(right.startTime || '') < String(left.endTime || '')));
  return [`Lịch ${toDisplayDate(date)}: ${sessions.length ? sessions.map((item) => `${item.startTime || ''}-${item.endTime || ''} ${item.code}`).join(' · ') : 'Không có lớp'}`, ...(overlaps ? ['Cảnh báo: phòng có lớp trùng giờ.'] : [])];
}
function attendanceStatusLabel(status: string) { return ({ present: 'Có mặt', absent: 'Vắng', excused: 'Có phép', late: 'Đi muộn' } as Record<string, string>)[status] || status; }
function nextAttendanceStatus(current?: 'present' | 'absent' | 'excused' | 'late') { return current === undefined ? 'present' : current === 'present' ? 'late' : current === 'late' ? 'excused' : current === 'excused' ? 'absent' : 'present'; }

const HAIRLINE_CARD = {
  backgroundColor: colors.white,
  borderRadius: 10,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: '#E5EAF2',
} as const;

const styles = StyleSheet.create({
  headerBranchBtn: { paddingVertical: 4, paddingLeft: 4, maxWidth: 190 },
  branchBtnContent: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  branchBtnText: { color: colors.ink, fontSize: 13, fontWeight: '700', flexShrink: 1 },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.35)', justifyContent: 'flex-end' },
  sheetModal: { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 28, maxHeight: '78%' },
  sheetHandle: { width: 38, height: 4, borderRadius: 99, backgroundColor: '#D6DFEC', alignSelf: 'center', marginBottom: 12 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  sheetClose: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  sheetRow: { flexDirection: 'row', alignItems: 'center', padding: 11, borderRadius: 14, gap: 12, marginBottom: 6 },
  sheetRowActive: { backgroundColor: '#F0F6FF' },
  sheetRowTitle: { color: '#111827', fontSize: 13.5, fontWeight: '600' },
  sheetRowSub: { color: '#6B7280', fontSize: 11.5, marginTop: 2 },
  switcherBarWrap: { marginHorizontal: 14, marginTop: 10, marginBottom: 0 },
  container: { flex: 1, backgroundColor: PASTEL_BACKDROP_TOP_COLOR },
  companyScopeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 2 },
  scopeLabel: { color: '#6B7280', fontSize: 12, fontWeight: '500' },
  companyScopeButton: { flex: 1, minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#DCE5F2', borderRadius: 10, backgroundColor: colors.white },
  companyScopeText: { flex: 1, color: '#111827', fontSize: 13, fontWeight: '600' },
  content: { flexGrow: 1, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 92 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  searchBox: { height: 40, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: '#DCE5F2', borderRadius: 99, backgroundColor: colors.white },
  searchInput: { flex: 1, minWidth: 0, color: '#111827', fontSize: 13.5, fontWeight: '400', paddingVertical: 0 },
  filterButton: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: '#DCE5F2', borderRadius: 10, backgroundColor: colors.white },
  filterButtonActive: { borderColor: colors.primary, backgroundColor: '#EFF6FF' },
  filterButtonText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  addButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 13, borderRadius: 10, backgroundColor: colors.primary },
  addText: { color: colors.white, fontSize: 12.5, fontWeight: '600' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingBottom: 10 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 7, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5EAF2', borderRadius: 99, backgroundColor: colors.white },
  filterChipSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  filterChipText: { color: '#6B7280', fontSize: 12, fontWeight: '500' },
  filterChipTextSelected: { color: colors.white, fontWeight: '600' },
  cardList: { gap: 8, paddingBottom: 8 },
  listGroup: { backgroundColor: colors.white, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5EAF2', overflow: 'hidden' },
  listRow: { paddingHorizontal: 13, paddingVertical: 10, backgroundColor: colors.white },
  listRowPressed: { backgroundColor: '#F5F8FD' },
  listDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#EEF2F7', marginLeft: 13 },
  listDividerInset: { marginLeft: 63 },
  card: { ...HAIRLINE_CARD, padding: 13 },
  progressionCard: { ...HAIRLINE_CARD, padding: 13, gap: 8 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  entityAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E8F1FC', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  entityAvatarText: { color: colors.primary, fontSize: 13.5, fontWeight: '700', letterSpacing: 0.2 },
  cardTitle: { color: '#111827', fontSize: 14, fontWeight: '600', lineHeight: 19 },
  cardMeta: { color: '#6B7280', fontSize: 12, fontWeight: '400', lineHeight: 16.5, marginTop: 1 },
  cardDetailLine: { color: '#6B7280', fontSize: 11.5, fontWeight: '400', lineHeight: 16, marginTop: 1 },
  badge: { maxWidth: 116, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99, backgroundColor: '#EAF2FF', flexShrink: 0 },
  badgeText: { color: colors.primary, fontSize: 10, fontWeight: '600' },
  inlineIconActions: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 0 },
  inlineIconBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F3F7FD', alignItems: 'center', justifyContent: 'center' },
  inlineIconBtnDanger: { backgroundColor: '#FFF1F0' },
  cardDetails: { gap: 2, marginTop: 6 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 7 },
  actionButton: { minHeight: 27, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, borderRadius: 8, backgroundColor: '#F3F7FD' },
  actionText: { color: colors.primary, fontSize: 11, fontWeight: '600' },
  primaryAction: { backgroundColor: colors.primary },
  primaryActionText: { color: colors.white },
  dangerAction: { backgroundColor: '#FFF1F0' },
  dangerActionText: { color: '#B42318' },
  fab: { position: 'absolute', right: 18, bottom: 22, width: 54, height: 54, borderRadius: 27, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: '#1D4ED8', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 10, elevation: 6 },
  fabPressed: { opacity: 0.88, transform: [{ scale: 0.96 }] },
  emptyState: { flex: 1, minHeight: 270, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 25 },
  loadState: { flex: 1, minHeight: 300, alignItems: 'center', justifyContent: 'center', padding: 22, paddingBottom: 140, gap: 8 },
  emptyTitle: { color: '#111827', fontSize: 14.5, fontWeight: '600', textAlign: 'center' },
  emptyText: { color: '#6B7280', fontSize: 12.5, lineHeight: 18, textAlign: 'center' },
  retryButton: { marginTop: 4, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: colors.primary },
  retryText: { color: colors.white, fontSize: 12.5, fontWeight: '600' },
  backdrop: { flex: 1, justifyContent: 'center', padding: 14, backgroundColor: 'rgba(15, 23, 42, 0.35)' },
  dialog: { maxHeight: '92%', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5EAF2', borderRadius: 18, backgroundColor: colors.white, overflow: 'hidden' },
  detailDialog: { height: '92%' },
  pickerDialog: { maxHeight: '75%' },
  modalHeader: { minHeight: 53, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#E8EDF4', backgroundColor: colors.white },
  modalTitle: { flex: 1, color: '#111827', fontSize: 15.5, fontWeight: '600' },
  closeButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#F3F6FA' },
  formContent: { padding: 14, gap: 4 },
  fieldWrap: { marginBottom: 6 },
  roadmapStepsField: { gap: 8, marginTop: 6, marginBottom: 10 },
  roadmapStepBlock: { ...HAIRLINE_CARD, gap: 8, padding: 12 },
  roadmapRulePanel: { gap: 6, padding: 10, borderRadius: 10, backgroundColor: '#F6F8FC' },
  roadmapStepRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roadmapStepNumber: { width: 24, color: colors.primary, fontSize: 12.5, fontWeight: '700', textAlign: 'center' },
  removeStepButton: { width: 36, height: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F4C9C5', borderRadius: 10, backgroundColor: '#FFF1F0' },
  addStepButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: '#C9D9FF', borderRadius: 10, backgroundColor: '#EFF6FF' },
  addStepText: { color: colors.primary, fontSize: 12.5, fontWeight: '600' },
  field: { marginBottom: 10 },
  fieldLabel: { color: '#374151', fontSize: 12.5, fontWeight: '500', marginBottom: 6 },
  input: { minHeight: 42, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#DCE5F2', borderRadius: 10, backgroundColor: colors.white, color: '#111827', fontSize: 13.5 },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  selectField: { minHeight: 42, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 9, paddingHorizontal: 12, borderWidth: 1, borderColor: '#DCE5F2', borderRadius: 10, backgroundColor: colors.white },
  selectValue: { flex: 1, color: '#111827', fontSize: 13.5 },
  placeholder: { color: '#94A3B8' },
  formError: { color: '#B91C1C', fontSize: 12.5, lineHeight: 18, paddingVertical: 6 },
  helperText: { color: '#6B7280', fontSize: 12, lineHeight: 17, paddingHorizontal: 2, paddingVertical: 6 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, padding: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#E8EDF4', backgroundColor: colors.white },
  cancelButton: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 10, backgroundColor: '#F1F5F9' },
  cancelText: { color: '#374151', fontSize: 13, fontWeight: '600' },
  saveButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderRadius: 10, backgroundColor: colors.primary },
  saveText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  disabled: { opacity: 0.45 },
  optionRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EEF2F7' },
  optionSelected: { backgroundColor: '#F0F6FF', borderRadius: 10 },
  optionTitle: { color: '#111827', fontSize: 13.5, fontWeight: '600' },
  optionDetail: { color: '#6B7280', fontSize: 12, marginTop: 2 },
  pagination: { ...HAIRLINE_CARD, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 12, marginBottom: 8, padding: 9 },
  paginationText: { color: '#6B7280', fontSize: 12, fontWeight: '500' },
  pageButton: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 9, backgroundColor: '#EAF2FF' },
  pageButtonText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  filterDateRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, paddingTop: 10 },
  filterGroup: { paddingHorizontal: 18, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EEF2F7' },
  filterChoiceList: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  filterChoice: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5EAF2', borderRadius: 99, backgroundColor: colors.white },
  filterChoiceActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  filterChoiceText: { maxWidth: 220, color: '#6B7280', fontSize: 12, fontWeight: '500' },
  filterChoiceTextActive: { color: colors.white, fontWeight: '600' },
  filterModalContent: { paddingBottom: 6 },
  filterModalFooter: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 18, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EEF2F7', backgroundColor: colors.white },
  filterModalHint: { flex: 1, color: '#6B7280', fontSize: 12 },
  clearFilterButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F1F5F9' },
  clearFilterText: { color: colors.primary, fontSize: 12.5, fontWeight: '600' },
  detailContent: { padding: 14, paddingBottom: 26 },
  studentIdentity: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EEF2F7' },
  studentAvatar: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: '#1EA7E1' },
  studentAvatarText: { color: colors.white, fontSize: 16, fontWeight: '500', letterSpacing: 0.2 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  detailCell: { width: '48%', minHeight: 54, padding: 11, borderRadius: 10, backgroundColor: '#F6F8FC', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5EAF2' },
  detailLabel: { color: '#6B7280', fontSize: 11, fontWeight: '400' },
  detailValue: { color: '#111827', fontSize: 13, fontWeight: '600', marginTop: 4 },
  detailSection: { ...HAIRLINE_CARD, marginTop: 12, padding: 14 },
  detailSectionTitle: { color: '#111827', fontSize: 13.5, fontWeight: '600', marginBottom: 8 },
  installmentRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EEF2F7' },
  miniAction: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#EAF2FF' },
  miniActionText: { color: colors.primary, fontSize: 11.5, fontWeight: '600' },
  secondaryWide: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginVertical: 7, borderRadius: 10, backgroundColor: '#EAF2FF' },
  secondaryWideText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  emptyHint: { color: '#6B7280', fontSize: 12.5, paddingVertical: 10 },
  detailActionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  twoColumns: { flexDirection: 'row', gap: 8 },
  checkbox: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#DCE5F2', borderRadius: 6, backgroundColor: colors.white },
  checkboxSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  qrPanel: { ...HAIRLINE_CARD, alignItems: 'center', gap: 10, marginVertical: 9, padding: 14 },
  qrUrl: { color: colors.primary, fontSize: 11.5, textAlign: 'center' },
  weekdayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 2 },
  weekdayChip: { minHeight: 36, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5EAF2', borderRadius: 99, backgroundColor: colors.white },
  weekdayChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  weekdayChipText: { color: '#374151', fontSize: 12.5, fontWeight: '500' },
  weekdayChipTextActive: { color: colors.white, fontWeight: '600' },
  feesActionRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 2, marginBottom: 10 },
  feesActionBtn: { flex: 1, justifyContent: 'center', minHeight: 38 },
});
