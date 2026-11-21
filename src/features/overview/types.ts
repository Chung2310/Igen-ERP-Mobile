export type OverviewPeriodKey = 'day' | 'week' | 'month' | 'quarter' | 'year';

export type OverviewPageId =
  | 'executive'
  | 'finance'
  | 'hr'
  | 'quotation'
  | 'retail'
  | 'marketing'
  | 'student'
  | 'worker'
  | 'healthcare';

export type OverviewDateRange = {
  key: OverviewPeriodKey;
  label: string;
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  comparisonLabel: string;
};

export type OverviewPageDefinition = {
  id: OverviewPageId;
  label: string;
  shortLabel: string;
  subtitle: string;
  icon: LucideIcon;
  accent: string;
  tone: string;
  moduleSlug?: string;
};

// --- Business Overview (/dashboard/business-overview) ---
export type OverviewSectionKey =
  | 'education'
  | 'labor'
  | 'retail'
  | 'partners'
  | 'hr'
  | 'inventory'
  | 'repair'
  | 'finance'
  | 'customer';

export type OverviewPoint = { date: string; value: number };
export type OverviewStatus = { label: string; value: number };
export type OverviewProject = {
  id: string;
  name: string;
  status: string;
  allocated: number;
  quota: number;
};

export type BusinessOverviewData = {
  businessType: 'education' | 'labor';
  primary?: 'education' | 'labor' | 'retail' | null;
  range: { from: string; to: string };
  comparisonRange?: { from: string; to: string };
  scopeLabel?: string;
  generatedAt: string;
  access: Record<OverviewSectionKey, boolean>;
  errors: OverviewSectionKey[];
  education: null | {
    students: number;
    newStudents: number;
    activeClasses: number;
    tuition: number;
    previousTuition: number;
    todayTuition?: number;
    yesterdayTuition?: number;
    series: OverviewPoint[];
    classes: OverviewStatus[];
    topClasses: OverviewProject[];
    missingTeachers: number;
    unpaidStudents: number;
  };
  labor: null | {
    workers: number;
    newWorkers: number;
    previousNewWorkers: number;
    activeWorkers: number;
    placedWorkers: number;
    activeProjects: number;
    series: OverviewPoint[];
    statuses: OverviewStatus[];
    topProjects: OverviewProject[];
    unfilledProjects: number;
  };
  retail?: null | {
    todaySales: number;
    yesterdaySales: number;
    netSales: number;
    previousSales: number;
    orderCount: number;
    refunds: number;
    series: OverviewPoint[];
    products: Array<{ productId: string; sku: string; productName: string; netSales: number }>;
  };
  partners: null | { active: number; payable: number; pendingSettlements: number };
  hr: null | {
    employees: number;
    checkedIn: number | null;
    late: number | null;
    approvedLeave?: number | null;
    absent?: number | null;
    contracts?: Array<{ id: string; employeeName: string; endDate: string }>;
    tasks: { todo: number; doing: number; done: number; total: number };
    overdueTasks: number;
    pendingApprovals: number;
    expiringContracts: number;
  };
  inventory: null | { quantity: number; lowStock: number };
  repair: null | { open: number; overdue: number; waitingParts: number };
  finance: null | { receivable: number; overdue: number };
  customer: null | { total: number; newCustomers: number };
};

// --- Dashboard Summary (/dashboard/summary) ---
export type DashboardSummaryData = {
  range: { start: string; end: string; filter: string };
  projects: {
    activeProjects: number;
    tasks: { todo: number; doing: number; done: number; total: number };
    overdueTasks: number;
  };
  students: {
    totalStudents: number;
    newStudents: number;
    tuitionRevenue: number;
    paymentCount: number;
    outstandingDebt: number;
    activeCourses: number;
    activeBatches: number;
    expiringStudentCount?: number;
    unpaidStudentCount?: number;
    revenueToday?: number;
  };
  batches?: {
    activeCount: number;
    openingTodayCount: number;
    endingSoonCount: number;
    missingInstructorCount: number;
    frequentAbsentStudents: number;
  };
  timekeeping: {
    checkedInToday: number;
    lateToday: number;
    totalEmployees: number;
    employeesExistingAtRangeEnd?: number | null;
    date: string;
    onApprovedLeaveToday?: number;
    absentWithoutLeave?: number;
  };
  receivables?: {
    overdueAmount: number;
    overdueCount: number;
    dueTodayAmount: number;
    collectedTodayAmount: number;
  };
  chat: { unreadMessages: number; roomCount: number };
  resources: { fileCount: number; recentUploads: number; totalSize: number };
  training: {
    totalCourses: number;
    ongoingCourses: number;
    enrollments: {
      notStarted: number;
      inProgress: number;
      completed: number;
      total: number;
    };
  };
  personnelNow?: {
    expiringContractCount: number;
    expiringContracts: Array<{ id: string; employeeName: string; endDate: string }>;
    departmentHeadcounts: Array<{ name: string; value: number }>;
    activeContractEmployeeCount: number;
    withoutContractCount: number;
    renewedEmployeeCount: number;
    pendingTaskCount: number;
    inProgressTaskCount: number;
    inProgressTasks: Array<{ id: string; title: string; assignee: string; dueDate: string }>;
    pendingApprovalCount: number;
    pendingApprovals: Array<{ id: string; employeeName: string; type: string }>;
  };
};

// --- Action Items (/dashboard/action-items) ---
export type DashboardActionItemsData = {
  overdueTasks: Array<{ id: string; title: string; dueDate: string }>;
  pendingApprovals: Array<{ id: string; type: string; employeeName: string; since: string }>;
  lowStockAlerts: Array<{ id: string; name: string; sku: string; stock: number; minStockAlert: number }>;
};

// --- Finance Overview (/finance/management/report) ---
export type FinanceOverviewReport = {
  summary: Record<string, number | null>;
  trends?: Array<{ date: string; revenue: number; cost: number | null; expense: number }>;
  cash?: Array<{ date: string; kind: string; amount: number; method?: string; category?: string }>;
  expenses?: Array<{ category?: string; expenseClass?: string; amount: number }>;
  debts?: {
    receivables?: Array<{ customerName?: string; balance: number; daysUntil: number; dueDate: string }>;
    payables?: Array<{ supplierName?: string; balance: number; daysUntil: number; dueDate: string }>;
  };
  vat?: { input: number; output: number; payable: number; nextCarryforward: number };
};

// --- Quotation Overview (/quotation/overview) ---
export type QuotationOverviewData = {
  from: string;
  to: string;
  quotes: {
    total: number;
    byStatus: {
      draft: number;
      needs_info: number;
      pending_review: number;
      approved: number;
      rejected: number;
    };
    byKind: { customer: number; estimate: number };
    values: Array<{
      currency: string;
      customer: number;
      estimate: number;
      approvedCustomer: number;
      approvedEstimate: number;
    }>;
    trend: Array<{ date: string; count: number; approved: number }>;
    customers: Array<{ name: string; count: number }>;
    products: Array<{ name: string; quantity: number }>;
  };
  contracts: { total: number; draft: number; signed: number } | null;
  acceptances: { total: number; draft: number; completed: number } | null;
};

// --- Retail Overview (/retail/reports/summary) ---
export type RetailOverviewReport = {
  range: { from: string; to: string };
  summary: {
    grossSales: number;
    refunds: number;
    netSales: number;
    orderCount: number;
    averageOrderValue: number;
    collectedAmount: number;
    dueAmount: number;
    totalCost?: number;
    grossProfit?: number;
    grossMarginPercent?: number;
  };
  timeSeries: Array<{
    businessDate: string;
    grossSales: number;
    refunds: number;
    netSales: number;
    collectedAmount: number;
    orderCount: number;
  }>;
  paymentMix: Array<{ method: string; amount: number }>;
  cashiers: Array<{
    cashierId: string;
    cashierName: string;
    orderCount: number;
    netSales: number;
  }>;
  products?: Array<{
    productId: string;
    sku: string;
    productName: string;
    netQuantity: number;
    netSales: number;
  }>;
};

// --- Marketing & CRM Overview ---
export type CrmLeadStage = 'cold' | 'warm' | 'hot' | 'won' | 'upsell';

export type ErpCrmLead = {
  id: string;
  customerName?: string;
  status: CrmLeadStage;
  value?: number;
  createdAt?: string;
  updatedAt?: string;
  sourcePlatform?: string;
};

export type KnowledgeHealthSummary = {
  documentsCount: number;
  chunksCount: number;
  warnings?: unknown[];
  conflicts?: unknown[];
};

export type FaqStatsSummary = {
  stats?: { pending?: number; approved?: number; rejected?: number };
};

export type MarketingOverviewData = {
  leads: ErpCrmLead[] | null;
  knowledge: KnowledgeHealthSummary | null;
  faq: FaqStatsSummary | null;
  partialError: boolean;
};

// --- Worker Overview (/worker-management/dashboard) ---
export type WorkerOverviewData = {
  totalWorkers: number;
  activeWorkers: number;
  projects: number;
  workersByStatus: { active: number; inactive: number; placed: number };
  projectsByStatus: { planned: number; active: number; completed: number };
  monthlyRegistrations: number[];
  topProjects: Array<{ name: string; allocated: number; quota: number }>;
  contractAlerts?: { alertDays: number; expiringCount: number; expiredCount: number };
};

// --- Healthcare Overview (/healthcare/overview) ---
export type HealthcareOverviewData = {
  today: string;
  patients: number;
  visitCount: number | null;
  appointmentCount: number | null;
  careCount: number | null;
  todayAppointments: Array<{
    _id: string;
    patientId: string;
    startsAt: string;
    status: string;
  }>;
  dueCare: Array<{
    _id: string;
    patientId: string;
    dueOn: string;
    title: string;
  }>;
  patientReferences: Array<{ _id: string; code: string; name: string }>;
};

import type { LucideIcon } from 'lucide-react-native';

