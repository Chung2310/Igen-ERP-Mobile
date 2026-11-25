import { apiRequest } from '@/core/network/apiClient';

export type StudentRecord = {
  id: string;
  _id?: string;
  fullName: string;
  phone: string;
  email?: string;
  batchCode?: string;
  birthday?: string;
  idCard?: string;
  address?: string;
  referral?: string;
  partnerId?: string;
  registrationDate?: string;
  enrollmentDate?: string;
  courseId?: string;
  fee?: string;
  paidAmount?: number;
  status: string[] | string;
  ownerId?: string;
  centerId?: string;
  branchId?: string;
  __v?: number;
  customFields?: Record<string, unknown>;
};

export type CourseRecord = {
  id: string;
  _id?: string;
  code: string;
  title: string;
  category: string;
  fee?: string;
  duration: string;
  maxLearners?: number;
  activeBatches?: number;
  status?: string;
  __v?: number;
};

export type BatchAttendanceSession = {
  date: string;
  records?: Array<{ studentId: string; status: 'present' | 'absent' | 'excused' | 'late'; note?: string }>;
};

export type BatchRecord = {
  id: string;
  _id?: string;
  code: string;
  name?: string;
  courseId: string;
  courseCode?: string;
  courseTitle?: string;
  quota?: number | null;
  maxLearners?: number;
  learnerIds?: string[];
  daysOfWeek?: number[];
  startTime?: string;
  endTime?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  instructorId?: string;
  instructorName?: string;
  progress?: { doneSessions?: number; totalSessions?: number; remainingSessions?: number; missingAttendanceSessions?: number; progressLevel?: string };
  attendanceSessions?: BatchAttendanceSession[];
  cancelledSessionDates?: string[];
  roadmapId?: string | null;
  roadmapStepId?: string | null;
  __v?: number;
};

export type BatchAttachment = {
  name: string;
  url: string;
  type: string;
  uploadToken?: string;
};

export type BatchAssignmentRecord = {
  _id: string;
  id?: string;
  title: string;
  description?: string;
  dueDate?: string;
  maxScore: number;
  attachments?: BatchAttachment[];
  createdAt?: string;
};

export type BatchSubmissionRecord = {
  _id: string;
  assignmentId: string;
  studentId: string;
  attachments?: BatchAttachment[];
  studentNotes?: string;
  status: 'submitted' | 'graded' | 'late';
  score?: number;
  feedback?: string;
  submittedAt?: string;
  gradedAt?: string;
};

export type ProgressionIntent = 'continue' | 'pending' | 'stop' | 'preserve' | 'repeat';
export type ProgressionRow = {
  studentId: string;
  studentName: string;
  studentPhone: string;
  attendanceRate: number | null;
  assignmentRate: number | null;
  miniTestRate: number | null;
  examRate: number | null;
  eligible: boolean;
  eligibilityReasons: string[];
  intent: ProgressionIntent;
  teacherNote: string;
};
export type BatchProgression = { selectedRoadmapId: string; targetStep: { id: string; courseId: string; order: number } | null; rows: ProgressionRow[] };

export type ExamRecord = {
  id: string;
  _id?: string;
  name: string;
  status: string;
  rank?: string;
  tentativeDate?: string;
  officialDate?: string;
  location?: string;
  batchId?: string;
  batchCode?: string;
  maxScore?: number;
  passScore?: number;
  studentCount?: number;
  passCount?: number;
  failCount?: number;
  results?: Array<{ studentId: string; score?: number; outcome?: string; overallResult?: string }>;
  __v?: number;
};

export type PaymentRecord = {
  id?: string;
  _id?: string;
  studentId: string;
  studentName?: string;
  amount: number;
  date?: string;
  paidOn?: string;
  method?: string;
  note?: string;
};

export type StudentNotification = {
  id?: string;
  _id?: string;
  title: string;
  content: string;
  recipients?: string;
  recipientCount?: number;
  channels?: string[];
  status?: string;
  createdAt?: string;
  studentIds?: string[];
  installmentPlan?: { installmentNo: number; percent: number; label?: string; dueDate?: string };
};

export type StudentResource = {
  id: string;
  _id?: string;
  name: string;
  type: string;
  identifier: string;
  capacity: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE';
  bookings?: Array<{ id?: string; _id?: string; purpose: string; by: string; date: string; startTime: string; endTime: string }>;
  __v?: number;
};
export type StudentResourceCategory = { id: string; _id?: string; name: string };

export type QualityRow = {
  id: string;
  batchId: string;
  batchCode: string;
  courseTitle: string;
  studentId: string;
  studentName: string;
  studentPhone?: string;
  attendance: { attended: number; total: number; rate: number | null; absent?: number; late?: number };
  assignments: { completed: number; total: number; rate: number | null };
  attitudeNote?: string;
  teacherAssessment?: string;
  latestMiniTest?: { title: string; score: number | null; maxScore: number } | null;
  warningLevel: 'risk' | 'watch' | 'good' | 'unrated';
};
export type QualityAssignment = { id: string; title: string; status: 'not_submitted' | 'submitted' | 'graded' | 'late'; score: number | null; maxScore: number; feedback: string; dueDate?: string | null };
export type QualityMiniTest = { id: string; title: string; date: string; score: number | null; maxScore: number; note?: string };
export type StudentQualityDetail = QualityRow & { assignments: QualityRow['assignments'] & { items: QualityAssignment[] }; miniTests: QualityMiniTest[]; examResults: Array<{ id?: string; name?: string; date?: string; result?: { overall?: string; theory?: number | string; practice?: number | string; simulation?: number | string } }> };
export type StudentQualityThresholds = { riskAttendance: number; riskAssignment: number; riskMiniTest: number; watchAttendance: number; watchAssignment: number; watchMiniTest: number; assignmentMaxScore: number };
export type StudentLearningHistory = {
  summary?: { totalClasses: number; totalCourses: number };
  entries?: Array<{ id: string; batchCode: string; courseId: string; courseTitle: string; instructorName: string; status: 'active' | 'removed' | 'completed'; batchStatus?: string; enrolledAt: string | null; leftAt: string | null; enrollmentStatus: string; suspensionReason: string; expectedReturnAt: string | null; roadmap?: { id: string; name: string; code: string; stepId: string; stepOrder: number | null; totalSteps: number } | null }>;
  completedCourses?: Array<{ id: string; title: string; code: string }>;
};

export type StudentManagementScope = { branchId?: string; ownerFilter?: string };
type BranchScope = StudentManagementScope;
type Envelope = Record<string, unknown>;
export type BulkStudentInput = Partial<StudentRecord> & {
  fullName: string;
  phone: string;
  sourceRow?: number;
  feeProvided?: boolean;
  paidAmount?: number;
  batchCode?: string;
};

function request<T>(path: string, scope?: BranchScope, init: NonNullable<Parameters<typeof apiRequest>[1]> = {}) {
  const headers = new Headers(init.headers);
  if (scope?.branchId) headers.set('x-branch-id', scope.branchId);
  const requestPath = scope?.ownerFilter ? (() => {
    const [pathname, query = ''] = path.split('?');
    const search = new URLSearchParams(query);
    search.set('ownerFilter', scope.ownerFilter!);
    return `${pathname}?${search.toString()}`;
  })() : path;
  return apiRequest<T>(requestPath, { ...init, headers });
}

function params(values: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

function rows<T>(envelope: Envelope, keys: string[]): T[] {
  for (const key of keys) if (Array.isArray(envelope[key])) return envelope[key] as T[];
  if (Array.isArray(envelope.data)) return envelope.data as T[];
  return [];
}

function normalizeIds<T extends { id?: string; _id?: string }>(items: T[]) {
  return items.map((item) => ({ ...item, id: item.id || item._id || '' }));
}

async function listAllPages<T>(path: string, key: string, scope?: BranchScope, limit = 250) {
  const all: T[] = [];
  let expectedTotal: number | undefined;
  for (let page = 1; page <= 400; page += 1) {
    const response = await request<Envelope>(`${path}${params({ page, limit })}`, scope);
    const pageRows = rows<T>(response, [key]);
    const reportedTotal = Number(response.total ?? all.length + pageRows.length);
    if (!Number.isSafeInteger(reportedTotal) || reportedTotal < all.length + pageRows.length || (expectedTotal !== undefined && reportedTotal !== expectedTotal) || (!pageRows.length && all.length < reportedTotal)) {
      throw new Error('Danh sách vừa thay đổi hoặc chưa tải đủ. Vui lòng tải lại.');
    }
    expectedTotal = reportedTotal;
    all.push(...pageRows);
    if (all.length >= reportedTotal) return all;
  }
  throw new Error('Danh sách vượt quá giới hạn tải. Vui lòng lọc bớt dữ liệu rồi thử lại.');
}

export async function listStudents(scope?: BranchScope) {
  const items = await listAllPages<StudentRecord>('/students', 'students', scope);
  const normalized = normalizeIds(items).filter((item) => item.id);
  if (new Set(normalized.map((item) => item.id)).size !== normalized.length) throw new Error('Danh sách học viên thay đổi trong lúc tải. Vui lòng thử lại.');
  return normalized;
}

export async function saveStudent(input: Partial<StudentRecord> & { fullName: string; phone: string; email: string; registrationDate: string }, id?: string, scope?: BranchScope) {
  const response = await request<{ success?: boolean; data?: StudentRecord }>(`/students${id ? `/${encodeURIComponent(id)}` : ''}`, scope, {
    method: id ? 'PATCH' : 'POST', body: input,
  });
  if (!response.data) throw new Error('IGen-ERP không trả về hồ sơ học viên đã lưu.');
  return { ...response.data, id: response.data.id || response.data._id || id || '' };
}

export async function deleteStudent(id: string, scope?: BranchScope) {
  await request(`/students/${encodeURIComponent(id)}`, scope, { method: 'DELETE' });
}

export async function previewBulkStudents(students: BulkStudentInput[], scope?: BranchScope) {
  return request<{ success?: boolean; errors?: Array<{ index: number; row?: number; name?: string; phone?: string; reason: string }>; feeUpdates?: Array<{ index: number; row: number; name: string }> }>('/students/bulk-preview', scope, {
    method: 'POST',
    body: { students, ...(scope?.ownerFilter ? { centerId: scope.ownerFilter } : {}) },
  });
}

export async function bulkCreateStudents(students: BulkStudentInput[], scope?: BranchScope) {
  return request<{ success?: boolean; importedCount: number; updatedFeeCount?: number; skippedCount: number; errors?: Array<{ row: number; name: string; phone: string; reason: string }> }>('/students/bulk', scope, {
    method: 'POST',
    body: { students, ...(scope?.ownerFilter ? { centerId: scope.ownerFilter } : {}) },
  });
}

export async function getStudentInstallments(id: string, scope?: BranchScope) {
  const response = await request<Envelope>(`/students/${encodeURIComponent(id)}/installments`, scope);
  return rows<Record<string, unknown>>(response, ['installments']);
}

export async function createStudentInstallment(id: string, input: { amountDue: number; dueDate?: string }, scope?: BranchScope) {
  return request(`/students/${encodeURIComponent(id)}/installments`, scope, { method: 'POST', body: input });
}

export async function markStudentInstallmentPaid(id: string, no: number, scope?: BranchScope) {
  return request(`/students/${encodeURIComponent(id)}/installment/${no}/mark-paid`, scope, { method: 'PATCH' });
}

export async function listCourses(scope?: BranchScope) {
  const response = await request<Envelope>('/courses', scope);
  return normalizeIds(rows<CourseRecord>(response, ['courses'])).filter((item) => item.id);
}

export async function saveCourse(input: Partial<CourseRecord>, id?: string, scope?: BranchScope) {
  const response = await request<{ data?: CourseRecord; course?: CourseRecord }>(`/courses${id ? `/${encodeURIComponent(id)}` : ''}`, scope, { method: id ? 'PATCH' : 'POST', body: { ...input, ...(!id && scope?.ownerFilter ? { companyCode: scope.ownerFilter } : {}) } });
  const item = response.data || response.course;
  if (!item) throw new Error('IGen-ERP không trả về khóa học đã lưu.');
  return { ...item, id: item.id || item._id || id || '' };
}

export async function deleteCourse(id: string, scope?: BranchScope) {
  await request(`/courses/${encodeURIComponent(id)}`, scope, { method: 'DELETE' });
}

export async function listBatches(scope?: BranchScope) {
  const response = await request<Envelope>('/batches', scope);
  return normalizeIds(rows<BatchRecord>(response, ['batches'])).filter((item) => item.id);
}

export async function saveBatch(input: Partial<BatchRecord> & { code: string; courseId: string; daysOfWeek: number[]; startTime: string; endTime: string; startDate: string; endDate: string }, id?: string, scope?: BranchScope) {
  const response = await request<{ data?: BatchRecord; batch?: BatchRecord }>(`/batches${id ? `/${encodeURIComponent(id)}` : ''}`, scope, { method: id ? 'PATCH' : 'POST', body: { ...input, ...(!id && scope?.ownerFilter ? { companyCode: scope.ownerFilter } : {}) } });
  const item = response.data || response.batch;
  if (!item) throw new Error('IGen-ERP không trả về lớp học đã lưu.');
  return { ...item, id: item.id || item._id || id || '' };
}

export async function deleteBatch(id: string, scope?: BranchScope) {
  await request(`/batches/${encodeURIComponent(id)}`, scope, { method: 'DELETE' });
}

export async function getBatchEnrollments(id: string, scope?: BranchScope) {
  const response = await request<Envelope>(`/batches/${encodeURIComponent(id)}/enrollments`, scope);
  return rows<StudentRecord>(response, ['enrollments', 'students']);
}

export async function addStudentToBatch(batchId: string, studentId: string, scope?: BranchScope) {
  return request(`/batches/${encodeURIComponent(batchId)}/learners`, scope, { method: 'POST', body: { studentId } });
}

export async function removeStudentFromBatch(batchId: string, studentId: string, scope?: BranchScope) {
  return request(`/batches/${encodeURIComponent(batchId)}/learners/${encodeURIComponent(studentId)}`, scope, { method: 'DELETE' });
}

export async function updateEnrollmentStatus(batchId: string, studentId: string, input: { status: string; reason?: string; expectedReturnAt?: string; targetBatchId?: string; retakeFee?: number }, scope?: BranchScope) {
  return request(`/batches/${encodeURIComponent(batchId)}/learners/${encodeURIComponent(studentId)}/enrollment-status`, scope, { method: 'PATCH', body: input });
}

export async function listExams(scope?: BranchScope) {
  const response = await request<Envelope>('/exams', scope);
  return normalizeIds(rows<ExamRecord>(response, ['exams'])).filter((item) => item.id);
}

export async function saveExam(input: Partial<ExamRecord> & { name: string; status: string; tentativeDate: string; location: string; batchId: string }, id?: string, scope?: BranchScope) {
  const response = await request<{ data?: ExamRecord; exam?: ExamRecord }>(`/exams${id ? `/${encodeURIComponent(id)}` : ''}`, scope, { method: id ? 'PATCH' : 'POST', body: { ...input, ...(!id && scope?.ownerFilter ? { companyCode: scope.ownerFilter } : {}) } });
  const item = response.data || response.exam;
  if (!item) throw new Error('IGen-ERP không trả về kỳ thi đã lưu.');
  return { ...item, id: item.id || item._id || id || '' };
}

export async function deleteExam(id: string, scope?: BranchScope) {
  await request(`/exams/${encodeURIComponent(id)}`, scope, { method: 'DELETE' });
}

export async function getEligibleExamStudents(id: string, scope?: BranchScope) {
  const response = await request<Envelope>(`/exams/${encodeURIComponent(id)}/eligible-students`, scope);
  return rows<StudentRecord>(response, ['students']);
}

export async function assignExamStudents(id: string, studentIds: string[], scope?: BranchScope) {
  return request(`/exams/${encodeURIComponent(id)}/assign`, scope, { method: 'POST', body: { studentIds } });
}

export async function saveExamResults(id: string, results: Array<{ studentId: string; score: number }>, scope?: BranchScope) {
  return request(`/exams/${encodeURIComponent(id)}/results`, scope, { method: 'PATCH', body: { results } });
}

export async function setExamStudentOutcome(id: string, studentId: string, overallResult: 'Đậu' | 'Trượt' | 'Chưa có', scope?: BranchScope) {
  return request(`/exams/${encodeURIComponent(id)}/students/${encodeURIComponent(studentId)}/result`, scope, { method: 'POST', body: { overallResult } });
}

export async function unassignExamStudent(id: string, studentId: string, scope?: BranchScope) {
  return request(`/exams/${encodeURIComponent(id)}/unassign`, scope, { method: 'POST', body: { studentId } });
}

export async function listPayments(scope?: BranchScope, range?: { startDate?: string; endDate?: string }) {
  const all: PaymentRecord[] = [];
  let expectedTotal: number | undefined;
  for (let page = 1; page <= 400; page += 1) {
    const response = await request<Envelope>(`/payments${params({ page, limit: 250, startDate: range?.startDate, endDate: range?.endDate })}`, scope);
    const pageRows = rows<PaymentRecord>(response, ['payments']);
    const total = Number(response.total ?? all.length + pageRows.length);
    if (!Number.isSafeInteger(total) || total < all.length + pageRows.length || (expectedTotal !== undefined && total !== expectedTotal) || (!pageRows.length && all.length < total)) throw new Error('Giao dịch vừa thay đổi hoặc chưa tải đủ. Vui lòng thử lại.');
    expectedTotal = total;
    all.push(...pageRows);
    if (all.length >= total) return all;
  }
  throw new Error('Số giao dịch vượt quá giới hạn tải. Vui lòng lọc theo ngày rồi thử lại.');
}

export async function createPayment(input: { studentId: string; amount: number; method: 'Tiền mặt' | 'Chuyển khoản'; date: string; note?: string }, scope?: BranchScope) {
  return request('/payments', scope, { method: 'POST', body: input });
}

export async function updatePayment(id: string, input: { method?: 'Tiền mặt' | 'Chuyển khoản'; date?: string; note?: string }, scope?: BranchScope) {
  return request(`/payments/${encodeURIComponent(id)}`, scope, { method: 'PATCH', body: input });
}

export async function deletePayment(id: string, scope?: BranchScope) {
  await request(`/payments/${encodeURIComponent(id)}`, scope, { method: 'DELETE' });
}

export async function listStudentNotifications(scope?: BranchScope) {
  const response = await request<Envelope>('/student-notifications', scope);
  return normalizeIds(rows<StudentNotification>(response, ['notifications']));
}

export async function createStudentNotification(input: { title: string; content: string; recipients: string; recipientCount: number; channels: string[]; status: string; studentIds?: string[]; installmentPlan?: StudentNotification['installmentPlan'] }, scope?: BranchScope) {
  return request('/student-notifications', scope, { method: 'POST', body: input });
}

export async function deleteStudentNotification(id: string, scope?: BranchScope) {
  await request(`/student-notifications/${encodeURIComponent(id)}`, scope, { method: 'DELETE' });
}

export async function listStudentResources(scope?: BranchScope) {
  const response = await request<Envelope>('/student-resources', scope);
  return normalizeIds(rows<StudentResource>(response, ['resources']));
}

export async function listStudentResourceCategories(scope?: BranchScope) {
  const response = await request<Envelope>('/student-resources/categories', scope);
  return normalizeIds(rows<StudentResourceCategory>(response, ['data', 'categories'])).filter((item) => item.id);
}

export async function createStudentResourceCategory(name: string, scope?: BranchScope) {
  return request('/student-resources/categories', scope, { method: 'POST', body: { name } });
}

export async function deleteStudentResourceCategory(id: string, scope?: BranchScope) {
  await request(`/student-resources/categories/${encodeURIComponent(id)}`, scope, { method: 'DELETE' });
}

export async function createResourceBooking(id: string, input: { purpose: string; by: string; date: string; startTime: string; endTime: string }, scope?: BranchScope) {
  return request(`/student-resources/${encodeURIComponent(id)}/bookings`, scope, { method: 'POST', body: input });
}

export async function deleteResourceBooking(id: string, bookingId: string, scope?: BranchScope) {
  await request(`/student-resources/${encodeURIComponent(id)}/bookings/${encodeURIComponent(bookingId)}`, scope, { method: 'DELETE' });
}

export async function saveStudentResource(input: Partial<StudentResource>, id?: string, scope?: BranchScope) {
  const response = await request<{ data?: StudentResource; resource?: StudentResource }>(`/student-resources${id ? `/${encodeURIComponent(id)}` : ''}`, scope, { method: id ? 'PATCH' : 'POST', body: input });
  const item = response.data || response.resource;
  if (!item) throw new Error('IGen-ERP không trả về tài nguyên đã lưu.');
  return { ...item, id: item.id || item._id || id || '' };
}

export async function deleteStudentResource(id: string, scope?: BranchScope) {
  await request(`/student-resources/${encodeURIComponent(id)}`, scope, { method: 'DELETE' });
}

export async function listStudentQuality(scope?: BranchScope, search?: string, filters?: { batchId?: string; courseId?: string; warningLevel?: string }) {
  const all: QualityRow[] = [];
  let expectedTotal: number | undefined;
  for (let page = 1; page <= 400; page += 1) {
    const response = await request<Envelope>(`/student-quality${params({ page, limit: 100, search, batchId: filters?.batchId, courseId: filters?.courseId, warningLevel: filters?.warningLevel })}`, scope);
    const pageRows = rows<QualityRow>(response, ['items']);
    const total = Number(response.total ?? all.length + pageRows.length);
    if (!Number.isSafeInteger(total) || total < all.length + pageRows.length || (expectedTotal !== undefined && total !== expectedTotal) || (!pageRows.length && all.length < total)) throw new Error('Dữ liệu chất lượng thay đổi hoặc chưa tải đủ. Vui lòng thử lại.');
    expectedTotal = total;
    all.push(...pageRows);
    if (all.length >= total) return all;
  }
  throw new Error('Số học viên vượt quá giới hạn tải. Vui lòng lọc theo lớp hoặc khóa học.');
}

export async function updateStudentAssessment(batchId: string, studentId: string, input: { attitudeNote: string; teacherAssessment: string }, scope?: BranchScope) {
  return request(`/student-quality/batches/${encodeURIComponent(batchId)}/students/${encodeURIComponent(studentId)}`, scope, { method: 'PATCH', body: input });
}

export async function getStudentQualityDetail(batchId: string, studentId: string, scope?: BranchScope) {
  const response = await request<Envelope>(`/student-quality/batches/${encodeURIComponent(batchId)}/students/${encodeURIComponent(studentId)}`, scope);
  return (response.data || response) as unknown as StudentQualityDetail;
}

export async function createStudentMiniTest(batchId: string, studentId: string, input: { title: string; date: string; score: number; maxScore: number; note?: string }, scope?: BranchScope) {
  return request(`/student-quality/batches/${encodeURIComponent(batchId)}/students/${encodeURIComponent(studentId)}/mini-tests`, scope, { method: 'POST', body: input });
}

export async function deleteStudentMiniTest(batchId: string, studentId: string, miniTestId: string, scope?: BranchScope) {
  await request(`/student-quality/batches/${encodeURIComponent(batchId)}/students/${encodeURIComponent(studentId)}/mini-tests/${encodeURIComponent(miniTestId)}`, scope, { method: 'DELETE' });
}

export async function gradeStudentAssignment(batchId: string, studentId: string, assignmentId: string, input: { score: number; feedback?: string }, scope?: BranchScope) {
  return request(`/student-quality/batches/${encodeURIComponent(batchId)}/students/${encodeURIComponent(studentId)}/assignments/${encodeURIComponent(assignmentId)}`, scope, { method: 'PATCH', body: input });
}

export async function getStudentQualityThresholds(scope?: BranchScope) {
  const response = await request<Envelope>('/student-quality/settings/thresholds', scope);
  return (response.data || response) as unknown as StudentQualityThresholds;
}

export async function updateStudentQualityThresholds(input: StudentQualityThresholds, scope?: BranchScope) {
  return request('/student-quality/settings/thresholds', scope, { method: 'PATCH', body: input });
}

export async function getBatchAttendance(batchId: string, date: string, scope?: BranchScope) {
  return request<Envelope>(`/batches/${encodeURIComponent(batchId)}/attendance/learners${params({ date })}`, scope);
}

export async function saveBatchAttendance(batchId: string, input: { date: string; records: Array<{ studentId: string; status: 'present' | 'absent' | 'excused' | 'late' }> }, scope?: BranchScope) {
  return request(`/batches/${encodeURIComponent(batchId)}/attendance`, scope, { method: 'PUT', body: input });
}

export async function listLearningRoadmaps(scope?: BranchScope) {
  const response = await request<Envelope>('/learning-roadmaps', scope);
  return rows<Record<string, unknown>>(response, ['data']);
}

export async function listWaitlist(scope?: BranchScope) {
  return listAllPages<Record<string, unknown>>('/learning-roadmaps/waitlist', 'items', scope, 100);
}

export async function createLearningRoadmap(input: Record<string, unknown>, scope?: BranchScope) {
  return request('/learning-roadmaps', scope, { method: 'POST', body: input });
}

export async function updateLearningRoadmap(id: string, input: Record<string, unknown>, scope?: BranchScope) {
  return request(`/learning-roadmaps/${encodeURIComponent(id)}`, scope, { method: 'PATCH', body: input });
}

export async function getBatchProgression(batchId: string, roadmapId: string, scope?: BranchScope) {
  const response = await request<Envelope>(`/learning-roadmaps/batches/${encodeURIComponent(batchId)}/progression${params({ roadmapId })}`, scope);
  return (response.data || response) as unknown as BatchProgression;
}

export async function saveLearningProgression(batchId: string, studentId: string, input: { roadmapId: string; intent: ProgressionIntent; teacherNote: string }, scope?: BranchScope) {
  return request(`/learning-roadmaps/batches/${encodeURIComponent(batchId)}/students/${encodeURIComponent(studentId)}/progression`, scope, { method: 'PATCH', body: input });
}

export async function promoteRoadmapLearners(batchId: string, roadmapId: string, targetBatchId: string, studentIds: string[], scope?: BranchScope) {
  return request(`/learning-roadmaps/batches/${encodeURIComponent(batchId)}/promote`, scope, { method: 'POST', body: { roadmapId, targetBatchId, studentIds } });
}

export async function placeWaitlistEntries(batchId: string, entryIds: string[], scope?: BranchScope) {
  return request('/learning-roadmaps/waitlist/place', scope, { method: 'POST', body: { batchId, entryIds } });
}

export async function createStudentQrSession(batchId: string, date: string, durationMinutes = 5, scope?: BranchScope) {
  return request<{ success?: boolean; sessionId?: string; token?: string; expiresAt?: number; date?: string }>('/qr-attendance/session', scope, { method: 'POST', body: { batchId, date, durationMinutes } });
}

export async function getStudentQrStatus(sessionId: string, scope?: BranchScope) {
  return request<{ success?: boolean; checkedIn?: number; closed?: boolean; students?: Array<{ studentId: string; fullName: string; phone: string; checkinAt: number }> }>(`/qr-attendance/session/${encodeURIComponent(sessionId)}/status`, scope);
}

export async function closeStudentQrSession(sessionId: string, scope?: BranchScope) {
  return request(`/qr-attendance/session/${encodeURIComponent(sessionId)}/close`, scope, { method: 'POST' });
}

export async function getStudentLearningHistory(id: string, scope?: BranchScope) {
  const response = await request<Envelope>(`/students/${encodeURIComponent(id)}/learning-history`, scope);
  return (response.data || response) as unknown as StudentLearningHistory;
}

export type CourseCategoryRecord = {
  id: string;
  _id?: string;
  name: string;
};

export async function listCourseCategories(scope?: BranchScope): Promise<CourseCategoryRecord[]> {
  const response = await request<Envelope>('/courses/categories', scope);
  return rows<CourseCategoryRecord>(response, ['data', 'categories']).map((item) => ({
    ...item,
    id: String(item._id || item.id || ''),
    name: String(item.name || ''),
  })).filter((item) => Boolean(item.id && item.name));
}

export async function createCourseCategory(name: string, scope?: BranchScope) {
  return request('/courses/categories', scope, { method: 'POST', body: { name: name.trim() } });
}

export async function deleteCourseCategory(id: string, scope?: BranchScope) {
  return request(`/courses/categories/${encodeURIComponent(id)}`, scope, { method: 'DELETE' });
}

export async function listBatchAssignments(batchId: string, scope?: BranchScope): Promise<BatchAssignmentRecord[]> {
  const response = await request<Envelope>(`/assignments${params({ batchId })}`, scope);
  return rows<BatchAssignmentRecord>(response, ['data']);
}

export async function createBatchAssignment(
  input: { batchId: string; title: string; description?: string; dueDate?: string; maxScore: number; attachments?: BatchAttachment[] },
  scope?: BranchScope,
) {
  return request('/assignments', scope, { method: 'POST', body: { ...input, attachments: input.attachments ?? [] } });
}

export async function listAssignmentSubmissions(assignmentId: string, scope?: BranchScope): Promise<BatchSubmissionRecord[]> {
  const response = await request<Envelope>(`/assignments/${encodeURIComponent(assignmentId)}/submissions`, scope);
  return rows<BatchSubmissionRecord>(response, ['data']);
}

export async function gradeAssignmentSubmission(
  assignmentId: string,
  studentId: string,
  input: { score: number; feedback: string },
  scope?: BranchScope,
) {
  return request(`/assignments/${encodeURIComponent(assignmentId)}/students/${encodeURIComponent(studentId)}/grade`, scope, {
    method: 'POST',
    body: input,
  });
}

export async function createStudentPublicRegisterLink(
  input: { companyCode?: string; branchId?: string; entityPreset?: string },
  scope?: BranchScope,
) {
  const response = await request<{ data?: { registrationToken?: string }; registrationToken?: string }>(
    '/students/public-register-link',
    scope,
    { method: 'POST', body: input },
  );
  const registrationToken = response?.data?.registrationToken || response?.registrationToken;
  if (!registrationToken) throw new Error('IGen-ERP không trả về mã liên kết đăng ký.');
  return { registrationToken };
}
