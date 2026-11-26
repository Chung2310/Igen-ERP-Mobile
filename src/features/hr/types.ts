export type HrTabId =
  | 'employees'
  | 'departments'
  | 'branches'
  | 'attendance'
  | 'tasks'
  | 'leaves'
  | 'contracts'
  | 'recruitment'
  | 'training'
  | 'workflows'
  | 'payroll';

export type HrBranchLocationConfig = {
  latitude: number;
  longitude: number;
  allowedRadius: number;
  allowedPublicIps: string[];
};

export type HrBranch = {
  _id: string;
  companyCode?: string;
  code: string;
  name: string;
  address?: string;
  phone?: string;
  managerId?: string;
  pendingOwnerSetup?: boolean;
  locationConfig?: HrBranchLocationConfig;
  isActive?: boolean;
  createdAt?: string;
};

export type HrEmployee = {
  _id?: string;
  id?: string;
  uid?: string;
  displayName: string;
  email?: string;
  phone?: string;
  role?: string;
  jobTitle?: string;
  department?: string;
  division?: string;
  position?: string;
  branchId?: string;
  companyCode?: string;
  parentId?: string | null;
  level?: number;
  isLeader?: boolean;
  qualification?: string;
  monthlySalary?: number;
  jobDescriptionLink?: string;
  photoURL?: string;
  status?: string;
  createdAt?: string;
};

export type HrLeaveBalance = {
  year?: number;
  entitlement?: number;
  used?: number;
  pending?: number;
  unexcused?: number;
  remaining?: number;
};

export type HrAttendanceRecord = {
  _id?: string;
  id?: string;
  uid?: string;
  employeeId?: string;
  employeeName?: string;
  displayName?: string;
  email?: string;
  department?: string;
  date?: string;
  checkIn?: string | null;
  checkOut?: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  attendanceStatus?: string;
  status?: string;
  note?: string;
  workHours?: number;
};

export type HrAttendanceRosterEntry = {
  uid: string;
  displayName: string;
  branchId?: string;
};

export type HrCalendarEventType = 'event' | 'leave' | 'wfh' | 'exception' | 'reminder';

export type HrCalendarEvent = {
  _id?: string;
  id: string;
  companyCode?: string;
  type: HrCalendarEventType;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  employeeId?: string;
  employeeName?: string;
  status?: string;
  creatorId?: string;
  createdAt?: string;
};

export type HrWorkShift = {
  _id: string;
  code: string;
  name: string;
  color: string;
  startTime: string;
  endTime: string;
  crossesMidnight?: boolean;
  workingDays: number[];
  allowedLateMinutes?: number;
  allowedEarlyLeaveMinutes?: number;
  isDefault?: boolean;
  isActive?: boolean;
  employeeCount?: number;
  breakPeriods?: Array<{ name: string; startTime: string; endTime: string; paid: boolean }>;
};

export type HrShiftAssignmentEmployee = {
  _id: string;
  displayName?: string;
  email?: string;
  department?: string;
  assignment?: {
    shiftId: string;
    effectiveFrom: string;
    effectiveTo?: string;
    daysOfWeek: number[];
  };
};

export type HrWorkCalendarDayType = 'holiday' | 'substitute_holiday' | 'working_override';

export type HrWorkCalendarDay = {
  _id: string;
  date: string;
  name: string;
  dayType: HrWorkCalendarDayType;
  source: 'system' | 'admin';
  sourceYear?: number;
  isApplied: boolean;
  adminReason?: string;
};

export type HrWorkHoursConfig = {
  useCustom: boolean;
  checkInLimit?: string;
  checkOutLimit?: string;
  lunchBreakStart?: string;
  lunchBreakEnd?: string;
  workingDays?: number[];
  annualLeaveDays?: number;
  employmentStatus?: 'official' | 'probation' | 'internship';
  officialDate?: string;
};

export type HrEmployeeWorkHoursRow = {
  _id: string;
  displayName?: string;
  fullName?: string;
  email?: string;
  role?: string;
  workHoursConfig?: HrWorkHoursConfig;
  employmentStatus?: 'official' | 'probation' | 'internship';
  officialDate?: string;
};

export type HrTaskStatus = 'Not Started' | 'In Progress' | 'Review/Testing' | 'Done' | 'todo' | 'doing' | 'done' | string;

export type HrKanbanProject = {
  _id?: string;
  id: string;
  name: string;
  companyCode?: string;
  branchId?: string;
  status?: string;
  priority?: string;
  startAt?: string | null;
  dueAt?: string | null;
  createdAt?: string;
};

export type HrKanbanAttachment = {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'video' | 'audio' | 'file' | 'link';
  size?: number;
  uploadToken?: string;
};

export type HrKanbanTask = {
  _id?: string;
  id: string;
  title: string;
  description?: string;
  status: HrTaskStatus;
  priority?: string;
  assigneeUid?: string;
  assigneeName?: string;
  assignee?: string;
  dueDate?: string;
  startTime?: string;
  endTime?: string;
  completedAt?: string;
  projectId?: string;
  category?: string;
  salesKpiTarget?: number;
  linkNote?: string;
  attachments?: HrKanbanAttachment[];
  estTime?: number;
  actualTime?: number;
  actualStartTime?: string;
  progress?: number;
  progressNote?: string;
  helpRequested?: boolean;
  helpReason?: string;
  requestedHelperUid?: string;
  helpers?: Array<{ uid: string; name: string }>;
  revision?: number;
  tags?: string[];
  createdAt?: string;
};

export type HrKanbanKpiRow = {
  employeeId: string;
  employeeName: string;
  employeeAvatar?: string;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  percent: number | null;
};

export type HrKanbanKpiReport = {
  periodKey: string;
  periodStatus: 'provisional' | 'closed';
  closedAt: string | null;
  rows: HrKanbanKpiRow[];
};

export type HrRequestKind = 'event' | 'leave' | 'wfh' | 'exception';

export type HrLeaveAttachment = {
  url: string;
  name?: string;
  mimeType?: string;
  size?: number;
  uploadToken?: string;
};

export type HrLeaveTemplate = {
  _id?: string;
  id: string;
  name: string;
  requestKind?: HrRequestKind;
  fileUrl?: string;
  fileName?: string;
  uploadedBy?: string;
  createdAt?: string;
};

export type HrLeaveApplication = {
  _id?: string;
  id: string;
  employeeId?: string;
  employeeName?: string;
  applicantName?: string;
  type?: string;
  leaveType?: string;
  requestKind?: HrRequestKind;
  templateName?: string;
  reason?: string;
  note?: string;
  rejectReason?: string;
  approvalType?: string;
  approvedBy?: string;
  uploadedFileUrl?: string;
  uploadedFileName?: string;
  attachments?: HrLeaveAttachment[];
  startDate?: string;
  endDate?: string;
  status?: string;
  createdAt?: string;
};

export type HrContractStatus = 'draft' | 'active' | 'expired' | 'terminated';

export type HrContract = {
  _id: string;
  employeeId?: string;
  employeeName?: string;
  employeeEmail?: string;
  contractNumber?: string;
  contractType?: string;
  startDate?: string;
  endDate?: string;
  status?: HrContractStatus | string;
  baseSalary?: number;
  contractFileUrl?: string;
  contractFileName?: string;
  contractFileMimeType?: string;
  contractFileSize?: number;
  signedImageUrl?: string;
  signedImageName?: string;
  signedImageMimeType?: string;
  signedImageSize?: number;
  electronicSignatureUrl?: string;
  electronicSignatureName?: string;
  note?: string;
};

export type HrContractExpiryAlert = {
  id: string;
  employeeName: string;
  endDate: string;
  daysRemaining: number;
};

export type HrContractExtension = {
  _id: string;
  contractId: string;
  employeeName: string;
  previousEndDate: string;
  newEndDate: string;
  extensionDate: string;
  reason?: string;
  extensionFileUrl?: string;
  extensionFileName?: string;
  signedImageUrl?: string;
  signedImageName?: string;
};

export type HrDepartment = {
  id: string;
  _id?: string;
  name: string;
  code?: string;
  description?: string;
  employeeCount?: number;
  managerUid?: string;
  managerName?: string;
  sortOrder?: number;
  isActive?: boolean;
};

export type HrRecruitmentJobStatus = 'draft' | 'open' | 'paused' | 'closed';
export type HrApplicantOutcome = 'active' | 'hired' | 'rejected' | 'withdrawn';

export type HrRecruitmentJob = {
  _id?: string;
  id: string;
  code?: string;
  title: string;
  department?: string;
  location?: string;
  employmentType?: string;
  workplaceType?: 'onsite' | 'hybrid' | 'remote';
  description?: string;
  requirements?: string;
  benefits?: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  showSalary?: boolean;
  applicationDeadline?: string | null;
  status?: HrRecruitmentJobStatus | string;
  headcount?: number;
  applicantCount?: number;
  version?: number;
  jdFileUrl?: string;
  createdAt?: string;
};

export type HrRecruitmentStage = {
  id: string;
  name: string;
  color: string;
  position: number;
  isActive: boolean;
  terminalOutcome?: Exclude<HrApplicantOutcome, 'active'> | null;
};

export type HrRecruitmentPipeline = {
  _id: string;
  stages: HrRecruitmentStage[];
  version: number;
};

export type HrRecruitmentApplicant = {
  _id?: string;
  id: string;
  jobId?: string;
  stageId?: string;
  stageName?: string;
  fullName: string;
  email?: string;
  phone?: string;
  birthDate?: string | null;
  address?: string;
  experience?: string;
  education?: string;
  skills?: string[];
  expectedSalary?: number | null;
  availableDate?: string | null;
  source?: string;
  notes?: string;
  outcome?: HrApplicantOutcome | string;
  jobTitle?: string;
  status?: string;
  version?: number;
  cvUrl?: string;
  createdAt?: string;
};

export type HrRecruitmentHistory = {
  _id: string;
  fromStageName?: string;
  toStageName: string;
  note?: string;
  actorId?: string;
  createdAt: string;
};

export type HrRecruitmentInterview = {
  _id?: string;
  id: string;
  applicantId: string;
  jobId: string;
  scheduledStart: string;
  scheduledEnd: string;
  format: 'onsite' | 'online' | 'phone';
  location?: string;
  meetingLink?: string;
  interviewerIds?: string[];
  status: 'scheduled' | 'completed' | 'cancelled';
  result?: string;
  notes?: string;
  version?: number;
};

export type HrTrainingLesson = {
  title: string;
  url?: string;
  type: 'youtube' | 'document' | 'other' | 'text' | 'video';
  content?: string;
  fileName?: string;
  uploadToken?: string;
};

export type HrTrainingQuiz = {
  question: string;
  options: string[];
  correctOptionIndex: number;
};

export type HrTrainingCourse = {
  _id?: string;
  id: string;
  icon?: string;
  title?: string;
  name?: string;
  category?: string;
  tags?: string[];
  isRequired?: boolean;
  autoAssignOnboarding?: boolean;
  duration?: string;
  instructor?: string;
  companyCode?: string;
  creatorUid?: string;
  enrolledCount?: number;
  companyProgress?: number;
  description?: string;
  status?: string;
  lessons?: HrTrainingLesson[];
  quizzes?: HrTrainingQuiz[];
  createdAt?: string;
};

export type HrTrainingEnrollment = {
  _id?: string;
  id: string;
  courseId: string;
  courseTitle?: string;
  uid: string;
  userName?: string;
  companyCode?: string;
  progress: number;
  status: 'not_started' | 'in_progress' | 'completed';
  startedAt?: string;
  completedAt?: string;
  createdAt?: string;
  completedLessons?: string[];
  quizPassed?: boolean;
};

export type HrWorkflowSubTask = {
  id: string;
  title: string;
};

export type HrWorkflowAttachment = {
  id?: string;
  name: string;
  url: string;
  type?: string;
  size?: number;
  uploadToken?: string;
};

export type HrWorkflowStep = {
  id: string;
  title: string;
  description?: string;
  note?: string;
  deliverable?: string;
  subTasks?: HrWorkflowSubTask[];
  attachments?: HrWorkflowAttachment[];
};

export type HrWorkflow = {
  _id?: string;
  id: string;
  title?: string;
  name?: string;
  category?: string;
  description?: string;
  status?: string;
  steps?: HrWorkflowStep[];
  updatedAt?: string;
  createdAt?: string;
};

export type HrWorkflowCategory = {
  _id?: string;
  id: string;
  companyCode?: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
};

export type HrPayrollRun = {
  _id: string;
  periodKey: string;
  status: 'draft' | 'review' | 'closed' | 'paid' | string;
  version: number;
  activeRevisionId?: string;
  lines?: HrPayrollLine[];
  effectiveLines?: HrPayrollLine[];
  totals?: { grossPay?: number; deductions?: number; netPay?: number };
  effectiveError?: { code?: string; message?: string };
  employeeCount?: number;
  totalGross?: number;
  totalNet?: number;
  totalDeductions?: number;
  publishedAt?: string;
  publishedEmployeeIds?: string[];
};

export type HrPayrollLine = {
  _id?: string;
  id?: string;
  employeeId: string;
  employeeName?: string;
  calculation?: Record<string, number | undefined>;
  effectiveValues?: Record<string, number | undefined>;
  systemValues?: Record<string, number | undefined>;
  baseSalary?: number;
  grossSalary?: number;
  netSalary?: number;
  gross?: number;
  net?: number;
  totalDeductions?: number;
  deductionTotal?: number;
  deductions?: number;
  [key: string]: unknown;
};

export type HrPayslip = {
  _id?: string;
  id?: string;
  runId?: string;
  periodKey?: string;
  employeeId?: string;
  employeeName?: string;
  employeeCode?: string;
  department?: string;
  baseSalary?: number;
  monthlySalary?: number;
  standardWorkDays?: number;
  actualWorkDays?: number;
  workedDays?: number;
  shortageDays?: number;
  workedMinutes?: number;
  shortageMinutes?: number;
  overtimeAmount?: number;
  allowances?: number;
  bonus?: number;
  deductions?: number;
  socialInsurance?: number;
  pit?: number;
  advanceAmount?: number;
  netSalary?: number;
  grossSalary?: number;
  totalDeductions?: number;
  status?: string;
  publishedAt?: string;
};

export type HrPayrollAdjustment = {
  _id: string;
  employeeId?: string;
  employeeName?: string;
  kind: 'bonus' | 'allowance' | 'deduction' | 'advance' | string;
  amount: number;
  reason?: string;
  status?: 'pending' | 'approved' | 'rejected' | string;
  createdAt?: string;
};

export type HrPayrollPolicy = {
  _id: string;
  code: string;
  name: string;
  status?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
};

