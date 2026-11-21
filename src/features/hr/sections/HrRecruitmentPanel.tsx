import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  BriefcaseBusiness,
  CalendarClock,
  ExternalLink,
  Pencil,
  Plus,
  Trash2,
  Users,
} from 'lucide-react-native';
import { Card } from '@/components/Card';
import { showHrConfirm } from '@/features/hr/components/HrConfirmModal';
import {
  changeRecruitmentJobStatus,
  createRecruitmentApplicant,
  createRecruitmentInterview,
  createRecruitmentJob,
  deleteRecruitmentApplicant,
  deleteRecruitmentInterview,
  deleteRecruitmentJob,
  getRecruitmentPipeline,
  listRecruitmentApplicantHistory,
  listRecruitmentApplicants,
  listRecruitmentInterviews,
  listRecruitmentJobs,
  transitionRecruitmentApplicant,
  updateRecruitmentApplicant,
  updateRecruitmentInterview,
  updateRecruitmentJob,
} from '@/features/hr/hrApi';
import type {
  HrRecruitmentApplicant,
  HrRecruitmentHistory,
  HrRecruitmentInterview,
  HrRecruitmentJob,
  HrRecruitmentJobStatus,
  HrRecruitmentPipeline,
} from '@/features/hr/types';
import { formatCompactMoney, getTodayKey } from '@/features/overview/overviewPeriod';
import { colors } from '@/theme/colors';

type RecruitmentView = 'jobs' | 'applicants' | 'interviews';

const JOB_STATUS_LABELS: Record<string, string> = {
  draft: 'Nháp',
  open: 'Đang tuyển',
  paused: 'Tạm dừng',
  closed: 'Đã đóng',
};

const OUTCOME_LABELS: Record<string, string> = {
  active: 'Đang xử lý',
  hired: 'Đã tuyển',
  rejected: 'Từ chối',
  withdrawn: 'Đã rút hồ sơ',
};

const WORKPLACE_LABELS = {
  onsite: 'Tại văn phòng',
  hybrid: 'Hybrid',
  remote: 'Từ xa',
} as const;

const INTERVIEW_FORMAT_LABELS = {
  onsite: 'Trực tiếp',
  online: 'Online',
  phone: 'Điện thoại',
} as const;

const INTERVIEW_STATUS_LABELS = {
  scheduled: 'Đã lên lịch',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
} as const;

function formatDateTime(val?: string | null): string {
  if (!val) return '—';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return val;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function HrRecruitmentPanel({
  branchId,
  canManage,
}: {
  branchId?: string;
  canManage: boolean;
}) {
  const [view, setView] = useState<RecruitmentView>('jobs');
  const [jobs, setJobs] = useState<HrRecruitmentJob[]>([]);
  const [pipeline, setPipeline] = useState<HrRecruitmentPipeline | null>(null);
  const [applicants, setApplicants] = useState<HrRecruitmentApplicant[]>([]);
  const [interviews, setInterviews] = useState<HrRecruitmentInterview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [jobStatusFilter, setJobStatusFilter] = useState<string>('');
  const [stageFilter, setStageFilter] = useState<string>('');
  const [ivStatusFilter, setIvStatusFilter] = useState<string>('');

  // Job detail & editor
  const [selectedJob, setSelectedJob] = useState<HrRecruitmentJob | null>(null);
  const [jobModalMode, setJobModalMode] = useState<'new' | 'edit' | null>(null);
  const [jTitle, setJTitle] = useState('');
  const [jDept, setJDept] = useState('');
  const [jLocation, setJLocation] = useState('');
  const [jHeadcount, setJHeadcount] = useState('1');
  const [jWorkplace, setJWorkplace] = useState<'onsite' | 'hybrid' | 'remote'>('onsite');
  const [jDesc, setJDesc] = useState('');
  const [jReq, setJReq] = useState('');
  const [jBenefits, setJBenefits] = useState('');

  // Applicant detail & create/edit
  const [selectedApp, setSelectedApp] = useState<HrRecruitmentApplicant | null>(null);
  const [appHistory, setAppHistory] = useState<HrRecruitmentHistory[]>([]);
  const [transitionNote, setTransitionNote] = useState('');
  const [appModalOpen, setAppModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<HrRecruitmentApplicant | null>(null);
  const [aJobId, setAJobId] = useState('');
  const [aName, setAName] = useState('');
  const [aEmail, setAEmail] = useState('');
  const [aPhone, setAPhone] = useState('');
  const [aBirthDate, setABirthDate] = useState('');
  const [aAddress, setAAddress] = useState('');
  const [aExperience, setAExperience] = useState('');
  const [aEducation, setAEducation] = useState('');
  const [aSkills, setASkills] = useState('');
  const [aExpectedSalary, setAExpectedSalary] = useState('');
  const [aAvailableDate, setAAvailableDate] = useState('');
  const [aSource, setASource] = useState('LinkedIn');
  const [aNotes, setANotes] = useState('');

  // Interview detail / create / update
  const [selectedInterview, setSelectedInterview] = useState<HrRecruitmentInterview | null>(null);
  const [ivResultDraft, setIvResultDraft] = useState('');
  const [ivNotesDraft, setIvNotesDraft] = useState('');
  const [ivModalOpen, setIvModalOpen] = useState(false);
  const [ivApplicantId, setIvApplicantId] = useState('');
  const [ivDate, setIvDate] = useState(() => getTodayKey());
  const [ivStart, setIvStart] = useState('09:00');
  const [ivEnd, setIvEnd] = useState('10:00');
  const [ivFormat, setIvFormat] = useState<'onsite' | 'online' | 'phone'>('online');
  const [ivLocation, setIvLocation] = useState('');
  const [ivLink, setIvLink] = useState('');
  const [ivNotes, setIvNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const [jobList, pipe, appList, ivList] = await Promise.all([
          listRecruitmentJobs(branchId),
          getRecruitmentPipeline(branchId),
          listRecruitmentApplicants(branchId),
          listRecruitmentInterviews(branchId).catch(() => []),
        ]);
        setJobs(jobList);
        setPipeline(pipe);
        setApplicants(appList);
        setInterviews(ivList);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không tải được dữ liệu tuyển dụng.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [branchId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const jobMap = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);
  const appMap = useMemo(() => new Map(applicants.map((a) => [a.id, a])), [applicants]);
  const stages = useMemo(
    () => (pipeline?.stages || []).filter((s) => s.isActive).sort((a, b) => a.position - b.position),
    [pipeline],
  );
  const stageMap = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((j) => {
      if (jobStatusFilter && j.status !== jobStatusFilter) return false;
      if (!q) return true;
      return (
        j.title.toLowerCase().includes(q) ||
        (j.department || '').toLowerCase().includes(q) ||
        (j.location || '').toLowerCase().includes(q)
      );
    });
  }, [jobStatusFilter, jobs, search]);

  const filteredApplicants = useMemo(() => {
    const q = search.trim().toLowerCase();
    return applicants.filter((a) => {
      if (stageFilter && a.stageId !== stageFilter) return false;
      if (!q) return true;
      return (
        a.fullName.toLowerCase().includes(q) ||
        (a.email || '').toLowerCase().includes(q) ||
        (a.phone || '').toLowerCase().includes(q) ||
        (a.jobId && jobMap.get(a.jobId)?.title.toLowerCase().includes(q))
      );
    });
  }, [applicants, jobMap, search, stageFilter]);

  const filteredInterviews = useMemo(() => {
    return interviews.filter((iv) => !ivStatusFilter || iv.status === ivStatusFilter);
  }, [interviews, ivStatusFilter]);

  const openJobEditor = useCallback((job?: HrRecruitmentJob) => {
    setSelectedJob(job || null);
    setJobModalMode(job ? 'edit' : 'new');
    setJTitle(job?.title || '');
    setJDept(job?.department || '');
    setJLocation(job?.location || '');
    setJHeadcount(String(job?.headcount ?? 1));
    setJWorkplace(job?.workplaceType || 'onsite');
    setJDesc(job?.description || '');
    setJReq(job?.requirements || '');
    setJBenefits(job?.benefits || '');
  }, []);

  const onSaveJob = useCallback(async () => {
    if (!jTitle.trim() || saving) {
      if (!jTitle.trim()) Alert.alert('Thiếu tiêu đề', 'Hãy nhập tiêu đề vị trí tuyển dụng.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: jTitle.trim(),
        department: jDept.trim() || 'Chung',
        location: jLocation.trim() || 'Văn phòng',
        headcount: Math.max(1, Number(jHeadcount) || 1),
        workplaceType: jWorkplace,
        employmentType: 'full_time',
        description: jDesc.trim(),
        requirements: jReq.trim(),
        benefits: jBenefits.trim(),
      };
      if (jobModalMode === 'edit' && selectedJob) {
        const updated = await updateRecruitmentJob(
          selectedJob.id,
          { ...payload, version: selectedJob.version ?? 1 },
          branchId,
        );
        setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
        setSelectedJob(updated);
      } else {
        const created = await createRecruitmentJob(payload, branchId);
        setJobs((prev) => [created, ...prev]);
      }
      setJobModalMode(null);
      Alert.alert('Thành công', 'Đã lưu tin tuyển dụng.');
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể lưu tin tuyển dụng.');
    } finally {
      setSaving(false);
    }
  }, [branchId, jBenefits, jDept, jDesc, jHeadcount, jLocation, jReq, jTitle, jWorkplace, jobModalMode, saving, selectedJob]);

  const onChangeJobStatus = useCallback(
    async (job: HrRecruitmentJob, status: HrRecruitmentJobStatus) => {
      try {
        const updated = await changeRecruitmentJobStatus(job.id, job.version ?? 1, status, branchId);
        setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
        setSelectedJob(updated);
      } catch (err) {
        Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể đổi trạng thái tin.');
      }
    },
    [branchId],
  );

  const onDeleteJob = useCallback(
    (job: HrRecruitmentJob) => {
      showHrConfirm({
        title: 'Xóa tin tuyển dụng?',
        message: `Bạn có chắc muốn xóa tin "${job.title}"?`,
        confirmLabel: 'Xóa tin',
        onConfirm: async () => {
          try {
            await deleteRecruitmentJob(job.id, job.version ?? 1, branchId);
            setJobs((prev) => prev.filter((j) => j.id !== job.id));
            setSelectedJob(null);
          } catch (err) {
            Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể xóa tin.');
          }
        },
      });
    },
    [branchId],
  );

  const openApplicantDetail = useCallback((app: HrRecruitmentApplicant) => {
    setSelectedApp(app);
    setTransitionNote('');
    setAppHistory([]);
    void listRecruitmentApplicantHistory(app.id)
      .then(setAppHistory)
      .catch(() => setAppHistory([]));
  }, []);

  const openApplicantEditor = useCallback(
    (app?: HrRecruitmentApplicant) => {
      setEditingApp(app || null);
      setAJobId(app?.jobId || jobs[0]?.id || '');
      setAName(app?.fullName || '');
      setAEmail(app?.email || '');
      setAPhone(app?.phone || '');
      setABirthDate(app?.birthDate ? app.birthDate.slice(0, 10) : '');
      setAAddress(app?.address || '');
      setAExperience(app?.experience || '');
      setAEducation(app?.education || '');
      setASkills((app?.skills || []).join(', '));
      setAExpectedSalary(app?.expectedSalary != null ? String(app.expectedSalary) : '');
      setAAvailableDate(app?.availableDate ? app.availableDate.slice(0, 10) : '');
      setASource(app?.source || 'LinkedIn');
      setANotes(app?.notes || '');
      setAppModalOpen(true);
    },
    [jobs],
  );

  const onSaveApplicant = useCallback(async () => {
    if ((!editingApp && !aJobId) || !aName.trim() || saving) {
      Alert.alert('Thiếu thông tin', 'Hãy chọn Vị trí tuyển dụng và nhập Họ tên ứng viên.');
      return;
    }
    const skillsArr = aSkills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const salaryNum = aExpectedSalary.trim() ? Number(aExpectedSalary.replace(/[^\d.-]/g, '')) : null;
    setSaving(true);
    try {
      const commonPayload: Record<string, unknown> = {
        fullName: aName.trim(),
        email: aEmail.trim(),
        phone: aPhone.trim(),
        birthDate: aBirthDate.trim() || null,
        address: aAddress.trim(),
        experience: aExperience.trim(),
        education: aEducation.trim(),
        skills: skillsArr,
        expectedSalary: salaryNum !== null && Number.isFinite(salaryNum) ? salaryNum : null,
        availableDate: aAvailableDate.trim() || null,
        source: aSource.trim() || 'Khác',
        notes: aNotes.trim(),
      };

      if (editingApp) {
        const updated = await updateRecruitmentApplicant(
          editingApp.id,
          { ...commonPayload, version: editingApp.version ?? 1 },
          branchId,
        );
        setApplicants((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
        if (selectedApp?.id === updated.id) setSelectedApp(updated);
        Alert.alert('Đã lưu', 'Cập nhật thông tin ứng viên thành công.');
      } else {
        const created = await createRecruitmentApplicant(
          {
            ...commonPayload,
            jobId: aJobId,
            confirmDuplicate: true,
          },
          branchId,
        );
        setApplicants((prev) => [created, ...prev]);
        Alert.alert('Thành công', `Đã thêm ứng viên "${created.fullName}".`);
      }
      setAppModalOpen(false);
      setEditingApp(null);
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể lưu thông tin ứng viên.');
    } finally {
      setSaving(false);
    }
  }, [
    aAddress,
    aAvailableDate,
    aBirthDate,
    aEducation,
    aEmail,
    aExpectedSalary,
    aExperience,
    aJobId,
    aName,
    aNotes,
    aPhone,
    aSkills,
    aSource,
    branchId,
    editingApp,
    saving,
    selectedApp?.id,
  ]);

  const onDeleteApplicant = useCallback(
    (app: HrRecruitmentApplicant) => {
      showHrConfirm({
        title: 'Xóa hồ sơ ứng viên?',
        message: `Bạn có chắc muốn xóa ứng viên "${app.fullName}"?`,
        confirmLabel: 'Xóa ứng viên',
        onConfirm: async () => {
          try {
            await deleteRecruitmentApplicant(app.id, app.version ?? 1, branchId);
            setApplicants((prev) => prev.filter((a) => a.id !== app.id));
            if (selectedApp?.id === app.id) setSelectedApp(null);
          } catch (err) {
            Alert.alert('Lỗi xóa', err instanceof Error ? err.message : 'Không thể xóa ứng viên.');
          }
        },
      });
    },
    [branchId, selectedApp?.id],
  );

  const onTransitionApplicant = useCallback(
    async (stageId: string) => {
      if (!selectedApp || saving) return;
      setSaving(true);
      try {
        const updated = await transitionRecruitmentApplicant(
          selectedApp.id,
          selectedApp.version ?? 1,
          stageId,
          transitionNote.trim(),
          branchId,
        );
        setApplicants((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
        setSelectedApp(updated);
        setTransitionNote('');
        void listRecruitmentApplicantHistory(updated.id).then(setAppHistory).catch(() => {});
        Alert.alert('Đã chuyển vòng', `Ứng viên đã chuyển sang "${stageMap.get(stageId)?.name || stageId}".`);
      } catch (err) {
        Alert.alert('Lỗi chuyển vòng', err instanceof Error ? err.message : 'Vui lòng thử lại.');
      } finally {
        setSaving(false);
      }
    },
    [branchId, saving, selectedApp, stageMap, transitionNote],
  );

  const onCreateInterview = useCallback(async () => {
    const app = appMap.get(ivApplicantId);
    if (!app || !app.jobId || !ivDate.trim() || saving) {
      Alert.alert('Thiếu thông tin', 'Hãy chọn ứng viên và ngày phỏng vấn.');
      return;
    }
    setSaving(true);
    try {
      const created = await createRecruitmentInterview(
        {
          applicantId: app.id,
          jobId: app.jobId,
          scheduledStart: `${ivDate.trim()}T${ivStart.trim() || '09:00'}:00`,
          scheduledEnd: `${ivDate.trim()}T${ivEnd.trim() || '10:00'}:00`,
          format: ivFormat,
          location: ivLocation.trim(),
          meetingLink: ivLink.trim(),
          notes: ivNotes.trim(),
          interviewerIds: [],
        },
        branchId,
      );
      setInterviews((prev) => [created, ...prev]);
      setIvModalOpen(false);
      setIvNotes('');
      Alert.alert('Thành công', 'Đã tạo lịch phỏng vấn.');
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể tạo lịch phỏng vấn.');
    } finally {
      setSaving(false);
    }
  }, [appMap, branchId, ivApplicantId, ivDate, ivEnd, ivFormat, ivLink, ivLocation, ivNotes, ivStart, saving]);

  const onUpdateInterviewStatus = useCallback(
    async (iv: HrRecruitmentInterview, status: 'completed' | 'cancelled') => {
      try {
        const updated = await updateRecruitmentInterview(
          iv.id,
          { status, version: iv.version ?? 1 },
          branchId,
        );
        setInterviews((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      } catch (err) {
        Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể cập nhật lịch phỏng vấn.');
      }
    },
    [branchId],
  );

  const onDeleteInterview = useCallback(
    (iv: HrRecruitmentInterview) => {
      showHrConfirm({
        title: 'Xóa lịch phỏng vấn?',
        message: 'Thao tác này không thể hoàn tác.',
        confirmLabel: 'Xóa lịch',
        onConfirm: async () => {
          try {
            await deleteRecruitmentInterview(iv.id, iv.version ?? 1, branchId);
            setInterviews((prev) => prev.filter((item) => item.id !== iv.id));
          } catch (err) {
            Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể xóa lịch.');
          }
        },
      });
    },
    [branchId],
  );

  // ================= FULL PAGE: CHI TIẾT LỊCH PHỎNG VẤN =================
  if (selectedInterview) {
    const ivApp = appMap.get(selectedInterview.applicantId);
    const ivJob = jobMap.get(selectedInterview.jobId);
    return (
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.detailHeader}>
          <Pressable onPress={() => setSelectedInterview(null)} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Lịch phỏng vấn</Text>
          </Pressable>
          <Text
            style={[
              styles.badge,
              selectedInterview.status === 'completed' && styles.badgeGreen,
              selectedInterview.status === 'cancelled' && styles.badgeRed,
            ]}
          >
            {INTERVIEW_STATUS_LABELS[selectedInterview.status]}
          </Text>
        </View>

        <Card style={[styles.card, { marginBottom: 10 }]}>
          <Text style={styles.sheetTitle}>{ivApp?.fullName || 'Ứng viên'}</Text>
          <Text style={styles.subMeta}>
            Vị trí ứng tuyển: {ivJob?.title || ivApp?.jobTitle || '—'}
          </Text>
          {ivApp ? (
            <Pressable
              onPress={() => {
                setSelectedInterview(null);
                openApplicantDetail(ivApp);
              }}
              style={[styles.linkChip, { marginTop: 4 }]}
            >
              <Users size={12} color={colors.primary} />
              <Text style={styles.linkText}>Xem hồ sơ ứng viên ›</Text>
            </Pressable>
          ) : null}
        </Card>

        <Card style={[styles.card, { marginBottom: 10 }]}>
          <Text style={styles.label}>Thông tin buổi phỏng vấn</Text>
          <View style={styles.infoRow}>
            <Text style={styles.muted}>Bắt đầu</Text>
            <Text style={styles.infoVal}>{formatDateTime(selectedInterview.scheduledStart)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.muted}>Kết thúc</Text>
            <Text style={styles.infoVal}>{formatDateTime(selectedInterview.scheduledEnd)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.muted}>Hình thức</Text>
            <Text style={styles.infoVal}>{INTERVIEW_FORMAT_LABELS[selectedInterview.format]}</Text>
          </View>
          {selectedInterview.location ? (
            <View style={styles.infoRow}>
              <Text style={styles.muted}>Địa điểm</Text>
              <Text style={styles.infoVal}>{selectedInterview.location}</Text>
            </View>
          ) : null}
          {selectedInterview.meetingLink ? (
            <Pressable
              onPress={() => void Linking.openURL(selectedInterview.meetingLink!)}
              style={[styles.linkChip, { marginTop: 6 }]}
            >
              <ExternalLink size={12} color={colors.primary} />
              <Text style={styles.linkText}>Mở link phỏng vấn online</Text>
            </Pressable>
          ) : null}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.label}>Đánh giá & Kết quả phỏng vấn</Text>
          {canManage ? (
            <>
              <Text style={styles.subMeta}>Kết quả</Text>
              <TextInput
                value={ivResultDraft}
                onChangeText={setIvResultDraft}
                placeholder="VD: Đạt / Cần phỏng vấn vòng 2 / Không phù hợp..."
                placeholderTextColor={colors.muted}
                style={styles.field}
              />
              <Text style={styles.subMeta}>Ghi chú phỏng vấn</Text>
              <TextInput
                value={ivNotesDraft}
                onChangeText={setIvNotesDraft}
                multiline
                placeholder="Nhận xét chi tiết về ứng viên..."
                placeholderTextColor={colors.muted}
                style={[styles.field, { minHeight: 74, textAlignVertical: 'top' }]}
              />
              <Pressable
                disabled={saving}
                onPress={async () => {
                  setSaving(true);
                  try {
                    const updated = await updateRecruitmentInterview(
                      selectedInterview.id,
                      {
                        result: ivResultDraft.trim(),
                        notes: ivNotesDraft.trim(),
                        version: selectedInterview.version ?? 1,
                      },
                      branchId,
                    );
                    setInterviews((prev) =>
                      prev.map((it) => (it.id === updated.id ? updated : it)),
                    );
                    setSelectedInterview(updated);
                    Alert.alert('Đã lưu', 'Cập nhật kết quả phỏng vấn thành công.');
                  } catch (err) {
                    Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể cập nhật.');
                  } finally {
                    setSaving(false);
                  }
                }}
                style={[styles.submitBtn, saving && styles.disabled]}
              >
                <Text style={styles.submitBtnText}>{saving ? 'Đang lưu...' : 'Lưu đánh giá'}</Text>
              </Pressable>

              <View style={styles.actionRow}>
                {selectedInterview.status === 'scheduled' ? (
                  <>
                    <Pressable
                      onPress={() => {
                        void onUpdateInterviewStatus(selectedInterview, 'completed');
                        setSelectedInterview((cur) => (cur ? { ...cur, status: 'completed' } : cur));
                      }}
                      style={[styles.smallGreenBtn, { flex: 1, alignItems: 'center' }]}
                    >
                      <Text style={styles.smallGreenText}>Đánh dấu hoàn thành</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        void onUpdateInterviewStatus(selectedInterview, 'cancelled');
                        setSelectedInterview((cur) => (cur ? { ...cur, status: 'cancelled' } : cur));
                      }}
                      style={[styles.smallRedBtn, { flex: 1, alignItems: 'center' }]}
                    >
                      <Text style={styles.smallRedText}>Hủy lịch</Text>
                    </Pressable>
                  </>
                ) : null}
                <Pressable
                  onPress={() => {
                    onDeleteInterview(selectedInterview);
                    setSelectedInterview(null);
                  }}
                  style={styles.smallRedBtn}
                >
                  <Text style={styles.smallRedText}>Xóa</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.muted}>Kết quả</Text>
                <Text style={styles.infoVal}>{selectedInterview.result || 'Chưa có đánh giá'}</Text>
              </View>
              <Text style={styles.muted}>
                {selectedInterview.notes || 'Chưa có ghi chú phỏng vấn.'}
              </Text>
            </>
          )}
        </Card>
      </ScrollView>
    );
  }

  // ================= FULL PAGE: CHI TIẾT ỨNG VIÊN =================
  if (selectedApp) {
    const currentStage = selectedApp.stageId ? stageMap.get(selectedApp.stageId) : undefined;
    const appJob = selectedApp.jobId ? jobMap.get(selectedApp.jobId) : undefined;
    const linkedInterviews = interviews.filter((iv) => iv.applicantId === selectedApp.id);

    return (
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.detailHeader}>
          <Pressable onPress={() => setSelectedApp(null)} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Danh sách ứng viên</Text>
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {canManage ? (
              <>
                <Pressable onPress={() => openApplicantEditor(selectedApp)} style={styles.smallGreenBtn}>
                  <Text style={styles.smallGreenText}>Sửa</Text>
                </Pressable>
                <Pressable onPress={() => onDeleteApplicant(selectedApp)} style={styles.smallRedBtn}>
                  <Text style={styles.smallRedText}>Xóa</Text>
                </Pressable>
              </>
            ) : (
              <Text style={styles.badge}>
                {currentStage?.name || selectedApp.stageName || OUTCOME_LABELS[selectedApp.outcome || 'active'] || 'Đang xử lý'}
              </Text>
            )}
          </View>
        </View>

        {/* Hero Card */}
        <Card style={[styles.card, { marginBottom: 10 }]}>
          <Text style={styles.sheetTitle}>{selectedApp.fullName}</Text>
          <Text style={styles.subMeta}>
            Vị trí: {appJob?.title || selectedApp.jobTitle || 'Chưa gắn vị trí'} · Kết quả:{' '}
            {OUTCOME_LABELS[selectedApp.outcome || 'active'] || selectedApp.outcome}
          </Text>
          {selectedApp.cvUrl ? (
            <Pressable
              onPress={() => void Linking.openURL(selectedApp.cvUrl!)}
              style={[styles.linkChip, { marginTop: 4 }]}
            >
              <ExternalLink size={12} color={colors.primary} />
              <Text style={styles.linkText}>Mở CV ứng viên</Text>
            </Pressable>
          ) : null}
        </Card>

        {/* Thông tin cá nhân & liên hệ */}
        <Card style={[styles.card, { marginBottom: 10 }]}>
          <Text style={styles.label}>Thông tin cá nhân & liên hệ</Text>
          <View style={styles.infoRow}>
            <Text style={styles.muted}>Email</Text>
            <Text style={styles.infoVal}>{selectedApp.email || 'Chưa cập nhật'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.muted}>Số điện thoại</Text>
            <Text style={styles.infoVal}>{selectedApp.phone || 'Chưa cập nhật'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.muted}>Ngày sinh</Text>
            <Text style={styles.infoVal}>
              {selectedApp.birthDate ? selectedApp.birthDate.slice(0, 10) : 'Chưa cập nhật'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.muted}>Địa chỉ</Text>
            <Text style={styles.infoVal}>{selectedApp.address || 'Chưa cập nhật'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.muted}>Nguồn ứng viên</Text>
            <Text style={styles.infoVal}>{selectedApp.source || 'Khác'}</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.muted}>Ngày ứng tuyển</Text>
            <Text style={styles.infoVal}>{formatDateTime(selectedApp.createdAt)}</Text>
          </View>
        </Card>

        {/* Thông tin chuyên môn */}
        <Card style={[styles.card, { marginBottom: 10 }]}>
          <Text style={styles.label}>Hồ sơ chuyên môn</Text>
          <View style={styles.infoRow}>
            <Text style={styles.muted}>Kinh nghiệm</Text>
            <Text style={styles.infoVal}>{selectedApp.experience || 'Chưa cập nhật'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.muted}>Học vấn</Text>
            <Text style={styles.infoVal}>{selectedApp.education || 'Chưa cập nhật'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.muted}>Lương mong muốn</Text>
            <Text style={styles.infoVal}>
              {selectedApp.expectedSalary ? formatCompactMoney(selectedApp.expectedSalary) : 'Thỏa thuận'}
            </Text>
          </View>
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.muted}>Ngày nhận việc</Text>
            <Text style={styles.infoVal}>
              {selectedApp.availableDate ? selectedApp.availableDate.slice(0, 10) : 'Chưa cập nhật'}
            </Text>
          </View>
          {selectedApp.skills && selectedApp.skills.length > 0 ? (
            <View style={{ gap: 5, marginTop: 4 }}>
              <Text style={styles.muted}>Kỹ năng</Text>
              <View style={styles.wrapRow}>
                {selectedApp.skills.map((sk) => (
                  <Text key={sk} style={styles.skillChip}>
                    {sk}
                  </Text>
                ))}
              </View>
            </View>
          ) : null}
          {selectedApp.notes ? (
            <View style={{ gap: 3, marginTop: 4 }}>
              <Text style={styles.muted}>Ghi chú</Text>
              <Text style={styles.infoValLeft}>{selectedApp.notes}</Text>
            </View>
          ) : null}
        </Card>

        {/* Lịch phỏng vấn của ứng viên */}
        <Card style={[styles.card, { marginBottom: 10 }]}>
          <View style={styles.headRow}>
            <Text style={styles.label}>Lịch phỏng vấn ({linkedInterviews.length})</Text>
            {canManage ? (
              <Pressable
                onPress={() => {
                  setIvApplicantId(selectedApp.id);
                  setSelectedApp(null);
                  setView('interviews');
                  setIvModalOpen(true);
                }}
                style={styles.smallGreenBtn}
              >
                <Text style={styles.smallGreenText}>+ Lên lịch PV</Text>
              </Pressable>
            ) : null}
          </View>
          {!linkedInterviews.length ? (
            <Text style={styles.muted}>Chưa có lịch phỏng vấn nào cho ứng viên này.</Text>
          ) : (
            linkedInterviews.map((iv) => (
              <Pressable
                key={iv.id}
                onPress={() => {
                  setSelectedApp(null);
                  setSelectedInterview(iv);
                  setIvResultDraft(iv.result || '');
                  setIvNotesDraft(iv.notes || '');
                }}
                style={styles.historyRow}
              >
                <View style={styles.headRow}>
                  <Text style={styles.rowTitle}>{formatDateTime(iv.scheduledStart)}</Text>
                  <Text style={styles.badge}>{INTERVIEW_STATUS_LABELS[iv.status]}</Text>
                </View>
                <Text style={styles.subMeta}>
                  {INTERVIEW_FORMAT_LABELS[iv.format]}
                  {iv.location ? ` · ${iv.location}` : ''}
                </Text>
              </Pressable>
            ))
          )}
        </Card>

        {/* Chuyển vòng tuyển dụng */}
        {canManage && stages.length > 0 ? (
          <Card style={[styles.card, { marginBottom: 10 }]}>
            <Text style={styles.label}>Chuyển vòng tuyển dụng</Text>
            <TextInput
              value={transitionNote}
              onChangeText={setTransitionNote}
              placeholder="Ghi chú chuyển vòng (tùy chọn)..."
              placeholderTextColor={colors.muted}
              style={styles.field}
            />
            <View style={styles.wrapRow}>
              {stages.map((st) => {
                const current = selectedApp.stageId === st.id;
                return (
                  <Pressable
                    key={st.id}
                    disabled={current || saving}
                    onPress={() => void onTransitionApplicant(st.id)}
                    style={[styles.chip, current && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, current && styles.chipTextActive]}>
                      {st.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        ) : null}

        {/* Lịch sử chuyển vòng */}
        <Card style={styles.card}>
          <Text style={styles.label}>Lịch sử chuyển vòng ({appHistory.length})</Text>
          {!appHistory.length ? (
            <Text style={styles.muted}>Chưa có lịch sử chuyển vòng.</Text>
          ) : (
            appHistory.map((h) => (
              <View key={h._id} style={styles.historyRow}>
                <Text style={styles.subMeta}>
                  {h.fromStageName ? `${h.fromStageName} → ` : ''}
                  <Text style={{ color: colors.ink, fontWeight: '700' }}>{h.toStageName}</Text>
                </Text>
                {h.note ? <Text style={styles.muted}>{h.note}</Text> : null}
                <Text style={styles.subMeta}>{formatDateTime(h.createdAt)}</Text>
              </View>
            ))
          )}
        </Card>

        {renderApplicantModal()}
      </ScrollView>
    );
  }

  function renderApplicantModal() {
    return (
      <Modal
        visible={appModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setAppModalOpen(false);
          setEditingApp(null);
        }}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            setAppModalOpen(false);
            setEditingApp(null);
          }}
        >
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.headRow}>
              <Text style={styles.sheetTitle}>
                {editingApp ? 'Chỉnh sửa thông tin ứng viên' : 'Thêm ứng viên mới'}
              </Text>
              <Pressable
                onPress={() => {
                  setAppModalOpen(false);
                  setEditingApp(null);
                }}
              >
                <Text style={styles.closeText}>Đóng</Text>
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
              <View style={{ gap: 8, paddingBottom: 14 }}>
                {!editingApp ? (
                  <>
                    <Text style={styles.label}>Vị trí ứng tuyển *</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                      {jobs.map((j) => (
                        <Pressable
                          key={j.id}
                          onPress={() => setAJobId(j.id)}
                          style={[styles.chip, aJobId === j.id && styles.chipActive]}
                        >
                          <Text style={[styles.chipText, aJobId === j.id && styles.chipTextActive]}>
                            {j.title}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </>
                ) : null}
                <Text style={styles.label}>Họ và tên *</Text>
                <TextInput value={aName} onChangeText={setAName} placeholder="Nguyễn Văn A" style={styles.field} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput value={aEmail} onChangeText={setAEmail} keyboardType="email-address" autoCapitalize="none" style={styles.field} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Số điện thoại</Text>
                    <TextInput value={aPhone} onChangeText={setAPhone} keyboardType="phone-pad" style={styles.field} />
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Ngày sinh (YYYY-MM-DD)</Text>
                    <TextInput value={aBirthDate} onChangeText={setABirthDate} placeholder="1998-05-20" style={styles.field} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Ngày nhận việc</Text>
                    <TextInput value={aAvailableDate} onChangeText={setAAvailableDate} placeholder="YYYY-MM-DD" style={styles.field} />
                  </View>
                </View>
                <Text style={styles.label}>Địa chỉ</Text>
                <TextInput value={aAddress} onChangeText={setAAddress} placeholder="Quận/Huyện, Tỉnh/Thành..." style={styles.field} />
                <Text style={styles.label}>Kinh nghiệm</Text>
                <TextInput value={aExperience} onChangeText={setAExperience} placeholder="VD: 3 năm kinh doanh B2B" style={styles.field} />
                <Text style={styles.label}>Học vấn</Text>
                <TextInput value={aEducation} onChangeText={setAEducation} placeholder="VD: Đại học Kinh tế Quốc dân" style={styles.field} />
                <Text style={styles.label}>Kỹ năng (ngăn cách bằng dấu phẩy)</Text>
                <TextInput value={aSkills} onChangeText={setASkills} placeholder="Excel, Giao tiếp, Bán hàng..." style={styles.field} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Lương mong muốn (VNĐ)</Text>
                    <TextInput value={aExpectedSalary} onChangeText={setAExpectedSalary} keyboardType="numeric" placeholder="15000000" style={styles.field} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Nguồn ứng viên</Text>
                    <TextInput value={aSource} onChangeText={setASource} placeholder="LinkedIn / TopCV" style={styles.field} />
                  </View>
                </View>
                <Text style={styles.label}>Ghi chú</Text>
                <TextInput value={aNotes} onChangeText={setANotes} multiline style={[styles.field, { minHeight: 54, textAlignVertical: 'top' }]} />
                <Pressable disabled={saving} onPress={() => void onSaveApplicant()} style={[styles.submitBtn, saving && styles.disabled]}>
                  <Text style={styles.submitBtnText}>
                    {saving ? 'Đang lưu...' : editingApp ? 'Lưu thay đổi' : 'Thêm ứng viên'}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

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
      {/* 3 Sub-tabs matching web RecruitmentTab */}
      <View style={styles.segmentRow}>
        {(
          [
            { key: 'jobs', label: `Tin (${jobs.length})`, Icon: BriefcaseBusiness },
            { key: 'applicants', label: `Ứng viên (${applicants.length})`, Icon: Users },
            { key: 'interviews', label: `Phỏng vấn (${interviews.length})`, Icon: CalendarClock },
          ] as const
        ).map(({ key, label, Icon }) => {
          const active = view === key;
          return (
            <Pressable
              key={key}
              onPress={() => setView(key)}
              style={[styles.segmentBtn, active && styles.segmentBtnActive]}
            >
              <Icon size={12} color={active ? colors.primary : colors.muted} />
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Search + Create button */}
      <View style={styles.searchRow}>
        {view !== 'interviews' ? (
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={view === 'jobs' ? 'Tìm tin tuyển dụng...' : 'Tìm ứng viên, email, SĐT...'}
            placeholderTextColor={colors.muted}
            style={[styles.field, { flex: 1 }]}
          />
        ) : (
          <View style={{ flex: 1 }} />
        )}
        {canManage ? (
          <Pressable
            onPress={() => {
              if (view === 'jobs') openJobEditor();
              else if (view === 'applicants') {
                openApplicantEditor();
              } else {
                setIvApplicantId(applicants[0]?.id || '');
                setIvModalOpen(true);
              }
            }}
            style={styles.primaryBtn}
          >
            <Plus size={13} color={colors.white} />
            <Text style={styles.primaryBtnText}>
              {view === 'jobs' ? 'Tin mới' : view === 'applicants' ? 'Ứng viên' : 'Lịch PV'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* Sub-view filter chips */}
      {view === 'jobs' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 10 }}>
          <Pressable
            onPress={() => setJobStatusFilter('')}
            style={[styles.chip, !jobStatusFilter && styles.chipActive]}
          >
            <Text style={[styles.chipText, !jobStatusFilter && styles.chipTextActive]}>Tất cả</Text>
          </Pressable>
          {(['open', 'draft', 'paused', 'closed'] as const).map((st) => (
            <Pressable
              key={st}
              onPress={() => setJobStatusFilter(st)}
              style={[styles.chip, jobStatusFilter === st && styles.chipActive]}
            >
              <Text style={[styles.chipText, jobStatusFilter === st && styles.chipTextActive]}>
                {JOB_STATUS_LABELS[st]}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : view === 'applicants' && stages.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 10 }}>
          <Pressable
            onPress={() => setStageFilter('')}
            style={[styles.chip, !stageFilter && styles.chipActive]}
          >
            <Text style={[styles.chipText, !stageFilter && styles.chipTextActive]}>Tất cả vòng</Text>
          </Pressable>
          {stages.map((st) => (
            <Pressable
              key={st.id}
              onPress={() => setStageFilter(st.id)}
              style={[styles.chip, stageFilter === st.id && styles.chipActive]}
            >
              <Text style={[styles.chipText, stageFilter === st.id && styles.chipTextActive]}>
                {st.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : view === 'interviews' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 10 }}>
          <Pressable
            onPress={() => setIvStatusFilter('')}
            style={[styles.chip, !ivStatusFilter && styles.chipActive]}
          >
            <Text style={[styles.chipText, !ivStatusFilter && styles.chipTextActive]}>Tất cả</Text>
          </Pressable>
          {(['scheduled', 'completed', 'cancelled'] as const).map((st) => (
            <Pressable
              key={st}
              onPress={() => setIvStatusFilter(st)}
              style={[styles.chip, ivStatusFilter === st && styles.chipActive]}
            >
              <Text style={[styles.chipText, ivStatusFilter === st && styles.chipTextActive]}>
                {INTERVIEW_STATUS_LABELS[st]}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {loading ? (
        <Card style={styles.stateCard}>
          <ActivityIndicator size="small" color={colors.primary} />
        </Card>
      ) : error ? (
        <Card style={styles.stateCard}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => void load()} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Thử lại</Text>
          </Pressable>
        </Card>
      ) : view === 'jobs' ? (
        !filteredJobs.length ? (
          <Card style={styles.stateCard}>
            <Text style={styles.muted}>Chưa có tin tuyển dụng phù hợp.</Text>
          </Card>
        ) : (
          <View style={styles.list}>
            {filteredJobs.map((job) => (
              <Card key={job.id} onPress={() => setSelectedJob(job)} style={styles.card}>
                <View style={styles.headRow}>
                  <Text numberOfLines={2} style={[styles.rowTitle, { flex: 1 }]}>
                    {job.title}
                  </Text>
                  <Text
                    style={[
                      styles.badge,
                      job.status === 'open' && styles.badgeGreen,
                      job.status === 'closed' && styles.badgeGray,
                    ]}
                  >
                    {JOB_STATUS_LABELS[job.status || 'open'] || job.status}
                  </Text>
                </View>
                <Text style={styles.subMeta}>
                  {job.department || 'Chung'} · {job.location || 'Văn phòng'}
                  {job.workplaceType ? ` · ${WORKPLACE_LABELS[job.workplaceType]}` : ''}
                </Text>
                <Text style={styles.subMeta}>
                  Số lượng: {job.headcount ?? 1}
                  {job.showSalary && (job.salaryMin || job.salaryMax)
                    ? ` · Lương: ${formatCompactMoney(job.salaryMin ?? 0)}–${formatCompactMoney(job.salaryMax ?? 0)}`
                    : ''}
                </Text>
              </Card>
            ))}
          </View>
        )
      ) : view === 'applicants' ? (
        !filteredApplicants.length ? (
          <Card style={styles.stateCard}>
            <Text style={styles.muted}>Chưa có hồ sơ ứng viên phù hợp.</Text>
          </Card>
        ) : (
          <View style={styles.list}>
            {filteredApplicants.map((app) => {
              const stage = app.stageId ? stageMap.get(app.stageId) : undefined;
              const job = app.jobId ? jobMap.get(app.jobId) : undefined;
              return (
                <Card key={app.id} onPress={() => openApplicantDetail(app)} style={styles.card}>
                  <View style={styles.headRow}>
                    <Text numberOfLines={1} style={[styles.rowTitle, { flex: 1 }]}>
                      {app.fullName}
                    </Text>
                    <Text style={styles.badge}>
                      {stage?.name || app.stageName || OUTCOME_LABELS[app.outcome || 'active'] || 'Đang xử lý'}
                    </Text>
                  </View>
                  <Text style={styles.subMeta}>
                    {job?.title || app.jobTitle || 'Vị trí tuyển dụng'}
                    {app.source ? ` · Nguồn: ${app.source}` : ''}
                  </Text>
                  <Text style={styles.subMeta}>
                    {[app.email, app.phone].filter(Boolean).join(' · ') || 'Chưa có liên hệ'}
                  </Text>
                </Card>
              );
            })}
          </View>
        )
      ) : !filteredInterviews.length ? (
        <Card style={styles.stateCard}>
          <Text style={styles.muted}>Chưa có lịch phỏng vấn nào.</Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {filteredInterviews.map((iv) => {
            const app = appMap.get(iv.applicantId);
            const job = jobMap.get(iv.jobId);
            return (
              <Card
                key={iv.id}
                onPress={() => {
                  setSelectedInterview(iv);
                  setIvResultDraft(iv.result || '');
                  setIvNotesDraft(iv.notes || '');
                }}
                style={styles.card}
              >
                <View style={styles.headRow}>
                  <Text numberOfLines={1} style={[styles.rowTitle, { flex: 1 }]}>
                    {app?.fullName || 'Ứng viên'}
                  </Text>
                  <Text
                    style={[
                      styles.badge,
                      iv.status === 'completed' && styles.badgeGreen,
                      iv.status === 'cancelled' && styles.badgeRed,
                    ]}
                  >
                    {INTERVIEW_STATUS_LABELS[iv.status]}
                  </Text>
                </View>
                <Text style={styles.subMeta}>{job?.title || 'Vị trí tuyển dụng'}</Text>
                <Text style={styles.subMeta}>
                  🕒 {formatDateTime(iv.scheduledStart)} · {INTERVIEW_FORMAT_LABELS[iv.format]}
                </Text>
                {iv.location ? <Text style={styles.subMeta}>📍 {iv.location}</Text> : null}
                {iv.meetingLink ? (
                  <Pressable onPress={() => void Linking.openURL(iv.meetingLink!)} style={styles.linkChip}>
                    <ExternalLink size={11} color={colors.primary} />
                    <Text numberOfLines={1} style={styles.linkText}>
                      Mở link phỏng vấn
                    </Text>
                  </Pressable>
                ) : null}
                {iv.notes ? <Text style={styles.muted}>{iv.notes}</Text> : null}
                {canManage && iv.status === 'scheduled' ? (
                  <View style={styles.actionRow}>
                    <Pressable
                      onPress={() => void onUpdateInterviewStatus(iv, 'completed')}
                      style={styles.smallGreenBtn}
                    >
                      <Text style={styles.smallGreenText}>Hoàn thành</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void onUpdateInterviewStatus(iv, 'cancelled')}
                      style={styles.smallRedBtn}
                    >
                      <Text style={styles.smallRedText}>Hủy lịch</Text>
                    </Pressable>
                    <Pressable onPress={() => onDeleteInterview(iv)} style={{ marginLeft: 'auto', padding: 4 }}>
                      <Trash2 size={14} color="#B91C1C" />
                    </Pressable>
                  </View>
                ) : null}
              </Card>
            );
          })}
        </View>
      )}

      {/* Job Detail Modal */}
      <Modal
        visible={Boolean(selectedJob) && !jobModalMode}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedJob(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setSelectedJob(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            {selectedJob ? (
              <>
                <View style={styles.headRow}>
                  <Text numberOfLines={2} style={[styles.sheetTitle, { flex: 1 }]}>
                    {selectedJob.title}
                  </Text>
                  <Pressable onPress={() => setSelectedJob(null)}>
                    <Text style={styles.closeText}>Đóng</Text>
                  </Pressable>
                </View>
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 500 }}>
                  <View style={{ gap: 8, paddingBottom: 12 }}>
                    <Text style={styles.subMeta}>
                      {selectedJob.department} · {selectedJob.location} · SL: {selectedJob.headcount ?? 1}
                    </Text>
                    {selectedJob.description ? (
                      <>
                        <Text style={styles.label}>Mô tả công việc</Text>
                        <Text style={styles.muted}>{selectedJob.description}</Text>
                      </>
                    ) : null}
                    {selectedJob.requirements ? (
                      <>
                        <Text style={styles.label}>Yêu cầu</Text>
                        <Text style={styles.muted}>{selectedJob.requirements}</Text>
                      </>
                    ) : null}
                    {selectedJob.benefits ? (
                      <>
                        <Text style={styles.label}>Quyền lợi</Text>
                        <Text style={styles.muted}>{selectedJob.benefits}</Text>
                      </>
                    ) : null}
                    {selectedJob.jdFileUrl ? (
                      <Pressable
                        onPress={() => void Linking.openURL(selectedJob.jdFileUrl!)}
                        style={styles.linkChip}
                      >
                        <ExternalLink size={12} color={colors.primary} />
                        <Text style={styles.linkText}>Xem file JD đính kèm</Text>
                      </Pressable>
                    ) : null}

                    {canManage ? (
                      <>
                        <Text style={styles.label}>Đổi trạng thái tin</Text>
                        <View style={styles.wrapRow}>
                          {(['open', 'draft', 'paused', 'closed'] as const).map((st) => (
                            <Pressable
                              key={st}
                              onPress={() => void onChangeJobStatus(selectedJob, st)}
                              style={[styles.chip, selectedJob.status === st && styles.chipActive]}
                            >
                              <Text style={[styles.chipText, selectedJob.status === st && styles.chipTextActive]}>
                                {JOB_STATUS_LABELS[st]}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                        <View style={styles.actionRow}>
                          <Pressable
                            onPress={() => openJobEditor(selectedJob)}
                            style={[styles.submitBtn, { flex: 1, marginTop: 0 }]}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                              <Pencil size={13} color={colors.white} />
                              <Text style={styles.submitBtnText}>Chỉnh sửa</Text>
                            </View>
                          </Pressable>
                          <Pressable
                            onPress={() => onDeleteJob(selectedJob)}
                            style={styles.deleteBtn}
                          >
                            <Text style={styles.smallRedText}>Xóa</Text>
                          </Pressable>
                        </View>
                      </>
                    ) : null}
                  </View>
                </ScrollView>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Create / Edit Job Modal */}
      <Modal visible={Boolean(jobModalMode)} transparent animationType="slide" onRequestClose={() => setJobModalMode(null)}>
        <Pressable style={styles.backdrop} onPress={() => setJobModalMode(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.headRow}>
              <Text style={styles.sheetTitle}>
                {jobModalMode === 'edit' ? 'Sửa tin tuyển dụng' : 'Tạo tin tuyển dụng mới'}
              </Text>
              <Pressable onPress={() => setJobModalMode(null)}>
                <Text style={styles.closeText}>Đóng</Text>
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
              <View style={{ gap: 8, paddingBottom: 12 }}>
                <Text style={styles.label}>Tiêu đề vị trí *</Text>
                <TextInput value={jTitle} onChangeText={setJTitle} placeholder="VD: Chuyên viên Kinh doanh" style={styles.field} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Phòng ban</Text>
                    <TextInput value={jDept} onChangeText={setJDept} placeholder="Kinh doanh" style={styles.field} />
                  </View>
                  <View style={{ width: 90 }}>
                    <Text style={styles.label}>Số lượng</Text>
                    <TextInput value={jHeadcount} onChangeText={setJHeadcount} keyboardType="numeric" style={styles.field} />
                  </View>
                </View>
                <Text style={styles.label}>Địa điểm làm việc</Text>
                <TextInput value={jLocation} onChangeText={setJLocation} placeholder="Hà Nội / TP.HCM" style={styles.field} />
                <Text style={styles.label}>Hình thức làm việc</Text>
                <View style={styles.wrapRow}>
                  {(['onsite', 'hybrid', 'remote'] as const).map((wp) => (
                    <Pressable key={wp} onPress={() => setJWorkplace(wp)} style={[styles.chip, jWorkplace === wp && styles.chipActive]}>
                      <Text style={[styles.chipText, jWorkplace === wp && styles.chipTextActive]}>
                        {WORKPLACE_LABELS[wp]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.label}>Mô tả công việc</Text>
                <TextInput value={jDesc} onChangeText={setJDesc} multiline style={[styles.field, { minHeight: 56, textAlignVertical: 'top' }]} />
                <Text style={styles.label}>Yêu cầu ứng viên</Text>
                <TextInput value={jReq} onChangeText={setJReq} multiline style={[styles.field, { minHeight: 56, textAlignVertical: 'top' }]} />
                <Text style={styles.label}>Quyền lợi</Text>
                <TextInput value={jBenefits} onChangeText={setJBenefits} multiline style={[styles.field, { minHeight: 48, textAlignVertical: 'top' }]} />
                <Pressable disabled={saving} onPress={() => void onSaveJob()} style={[styles.submitBtn, saving && styles.disabled]}>
                  <Text style={styles.submitBtnText}>{saving ? 'Đang lưu...' : 'Lưu tin tuyển dụng'}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {renderApplicantModal()}

      {/* Create Interview Modal */}
      <Modal visible={ivModalOpen} transparent animationType="slide" onRequestClose={() => setIvModalOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setIvModalOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.headRow}>
              <Text style={styles.sheetTitle}>Lên lịch phỏng vấn</Text>
              <Pressable onPress={() => setIvModalOpen(false)}>
                <Text style={styles.closeText}>Đóng</Text>
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
              <View style={{ gap: 8 }}>
                <Text style={styles.label}>Chọn ứng viên *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {applicants.map((a) => (
                    <Pressable key={a.id} onPress={() => setIvApplicantId(a.id)} style={[styles.chip, ivApplicantId === a.id && styles.chipActive]}>
                      <Text style={[styles.chipText, ivApplicantId === a.id && styles.chipTextActive]}>{a.fullName}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <Text style={styles.label}>Ngày phỏng vấn (YYYY-MM-DD) *</Text>
                <TextInput value={ivDate} onChangeText={setIvDate} style={styles.field} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Bắt đầu (HH:mm)</Text>
                    <TextInput value={ivStart} onChangeText={setIvStart} style={styles.field} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Kết thúc (HH:mm)</Text>
                    <TextInput value={ivEnd} onChangeText={setIvEnd} style={styles.field} />
                  </View>
                </View>
                <Text style={styles.label}>Hình thức</Text>
                <View style={styles.wrapRow}>
                  {(['online', 'onsite', 'phone'] as const).map((f) => (
                    <Pressable key={f} onPress={() => setIvFormat(f)} style={[styles.chip, ivFormat === f && styles.chipActive]}>
                      <Text style={[styles.chipText, ivFormat === f && styles.chipTextActive]}>
                        {INTERVIEW_FORMAT_LABELS[f]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {ivFormat === 'online' ? (
                  <>
                    <Text style={styles.label}>Link phỏng vấn</Text>
                    <TextInput value={ivLink} onChangeText={setIvLink} autoCapitalize="none" placeholder="https://meet.google.com/..." style={styles.field} />
                  </>
                ) : (
                  <>
                    <Text style={styles.label}>Địa điểm</Text>
                    <TextInput value={ivLocation} onChangeText={setIvLocation} placeholder="Phòng họp tầng 3..." style={styles.field} />
                  </>
                )}
                <Text style={styles.label}>Ghi chú</Text>
                <TextInput value={ivNotes} onChangeText={setIvNotes} multiline style={[styles.field, { minHeight: 50, textAlignVertical: 'top' }]} />
                <Pressable disabled={saving} onPress={() => void onCreateInterview()} style={[styles.submitBtn, saving && styles.disabled]}>
                  <Text style={styles.submitBtnText}>{saving ? 'Đang tạo...' : 'Tạo lịch phỏng vấn'}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingBottom: 28 },
  segmentRow: { flexDirection: 'row', backgroundColor: '#E2E8F0', borderRadius: 11, padding: 3, marginBottom: 10 },
  segmentBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 7, borderRadius: 9 },
  segmentBtnActive: { backgroundColor: colors.white },
  segmentText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  segmentTextActive: { color: colors.ink },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary, paddingHorizontal: 11, paddingVertical: 9, borderRadius: 10 },
  primaryBtnText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  stateCard: { padding: 20, alignItems: 'center', gap: 10 },
  errorText: { color: '#B91C1C', fontSize: 12, textAlign: 'center' },
  list: { gap: 10 },
  card: { padding: 13, gap: 5 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  subMeta: { color: colors.muted, fontSize: 10 },
  badge: { color: colors.primary, backgroundColor: '#EAF2FF', fontSize: 9, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },
  badgeGreen: { color: '#16885A', backgroundColor: '#E9F8F1' },
  badgeRed: { color: '#B91C1C', backgroundColor: '#FEE2E2' },
  badgeGray: { color: '#64748B', backgroundColor: '#F1F5F9' },
  linkChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F0F7FF', borderColor: '#CBE0FF', borderWidth: 1, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, alignSelf: 'flex-start' },
  linkText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  smallGreenBtn: { backgroundColor: '#E9F8F1', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  smallGreenText: { color: '#16885A', fontSize: 11, fontWeight: '700' },
  smallRedBtn: { backgroundColor: '#FEE2E2', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  smallRedText: { color: '#B91C1C', fontSize: 11, fontWeight: '700' },
  deleteBtn: { backgroundColor: '#FEE2E2', minHeight: 44, paddingHorizontal: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  transitionBox: { backgroundColor: '#F0F7FF', borderColor: '#CBE0FF', borderWidth: 1, borderRadius: 12, padding: 11, gap: 8, marginTop: 4 },
  historyRow: { backgroundColor: '#F8FAFC', borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: 9, gap: 2 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  backBtn: { backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  backBtnText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingBottom: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  infoVal: { color: colors.ink, fontSize: 12, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  infoValLeft: { color: colors.ink, fontSize: 12, lineHeight: 18 },
  skillChip: { backgroundColor: '#EAF2FF', color: colors.primary, fontSize: 10, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, overflow: 'hidden' },

  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.42)', justifyContent: 'center', padding: 16 },
  sheet: { backgroundColor: colors.white, borderRadius: 24, overflow: 'hidden', padding: 18, gap: 8, maxHeight: '90%' },
  sheetTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  closeText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  label: { color: colors.ink, fontSize: 11, fontWeight: '700', marginTop: 2 },
  field: { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8, fontSize: 12, color: colors.ink },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  chipTextActive: { color: colors.white },
  submitBtn: { backgroundColor: colors.primary, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  submitBtnText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  disabled: { opacity: 0.45 },
});
