import { workerApiRequest, type WorkerScope } from '@/features/workerManagementApi';

export type LaborPartnerStatus = 'active' | 'inactive';
export type LaborCommissionScheme = 'official_monthly' | 'seasonal_hourly';

export type LaborPartner = {
  _id: string;
  code: string;
  name: string;
  phone: string;
  email?: string;
  taxCode?: string;
  representative?: string;
  address?: string;
  bankName?: string;
  bankAccountNo?: string;
  bankAccountName?: string;
  status: LaborPartnerStatus;
  defaultPolicyId?: string | { _id: string } | null;
  defaultOfficialPolicyId?: string | { _id: string } | null;
  defaultSeasonalPolicyId?: string | { _id: string } | null;
  note?: string;
  referralSummary?: { active: number; pending?: number; official?: number; seasonal?: number; total: number };
};

export type LaborCommissionPolicy = {
  _id: string;
  name: string;
  version: number;
  status: 'draft' | 'active' | 'retired';
  effectiveFrom: string;
  settlementCycle?: { type: 'calendar_month' | 'cutoff_day'; cutoffDay?: number | null };
  official: { enabled: boolean; maxMonths?: 1 | 2 | 3 | null; milestones?: Array<{ month: 1 | 2 | 3; amount: number; eligibilityRule: 'contract_active' | 'manual_confirmation' | 'attendance_threshold'; minWorkedDays?: number | null; minWorkedHours?: number | null }> };
  seasonal: { enabled: boolean; aggregationScope?: 'partner_period' | 'partner_project_period' | null; tierMode?: 'flat' | 'progressive' | null; minHoursPerWorker?: number | null; maxEligibleHoursPerWorker?: number | null; hourRounding?: { unitMinutes: 1 | 5 | 15 | 30 | 60; mode: 'floor' | 'nearest' | 'ceil' }; moneyRounding?: { unitVnd: number; mode: 'floor' | 'nearest' | 'ceil' }; tiers?: Array<{ minHours: number; maxHours: number | null; hourlyRate: number }> };
};

export type LaborPartnerInput = Omit<LaborPartner, '_id' | 'referralSummary'>;
export type LaborWorker = { _id: string; code?: string; fullName: string; phone?: string };
export type LaborReferral = { _id: string; workerId: string | LaborWorker; policyId: string | { _id: string; name: string; version: number }; partnerId: string | { _id: string; code: string; name: string }; commissionScheme: LaborCommissionScheme; referredAt: string; employmentStartDate: string; effectiveFrom: string; effectiveTo?: string | null; status: 'pending' | 'active' | 'ended' | 'rejected'; confirmationSource: 'contract' | 'manual' | 'attendance'; note?: string };
export type LaborKpiRow = { partnerId: string; partner: { _id: string; code: string; name: string; status: LaborPartnerStatus }; periodStart: string; periodEnd: string; targetReferrals: number; actualReferrals: number; remainingReferrals: number | null; completionRate: number | null; status: 'not_set' | 'achieved' | 'incomplete'; note: string };
export type LaborSettlement = { _id: string; partnerId: string | { _id: string; code: string; name: string }; periodStart: string; periodEnd: string; status: 'draft' | 'calculated' | 'approved' | 'partially_paid' | 'paid' | 'void'; officialAmount: number; seasonalMinutes: number; seasonalAmount: number; adjustmentAmount: number; totalAmount: number; paidAmount: number; balanceAmount: number; version: number; warnings?: Array<{ code?: string; message: string }> };
export type LaborSettlementDetail = LaborSettlement & { lines: Array<{ _id: string; scheme: LaborCommissionScheme | 'adjustment'; status: 'draft' | 'approved' | 'void'; officialMilestone?: number | null; eligibleMinutes?: number | null; hourlyRate?: number | null; amount: number; explanation: string; workerId?: string | LaborWorker | null }>; payouts: Array<{ _id: string; amount: number; paidAt: string; method: 'cash' | 'bank_transfer'; reference?: string; note?: string; reversalOfPayoutId?: string | null }> };
type ApiResult<T> = { success?: boolean; data?: T };

function scopeQuery(scope: WorkerScope) {
  const params = new URLSearchParams({ companyCode: scope.companyCode });
  if (scope.branchId) params.set('branchId', scope.branchId);
  return `?${params.toString()}`;
}

function listQuery(scope: WorkerScope, page: number, pageSize: number) {
  const params = new URLSearchParams({ companyCode: scope.companyCode, page: String(page), pageSize: String(pageSize) });
  if (scope.branchId) params.set('branchId', scope.branchId);
  return `?${params.toString()}`;
}

export async function listLaborPartners(scope: WorkerScope) {
  const response = await workerApiRequest<ApiResult<{ items: LaborPartner[]; page: number; pageSize: number; total: number }>>(
    `/worker-management/partners${listQuery(scope, 1, 100)}`,
    scope,
  );
  if (!response?.data || !Array.isArray(response.data.items)) throw new Error('IGen-ERP không trả về danh sách đối tác lao động.');
  const rows = [...response.data.items];
  const { total, pageSize } = response.data;
  for (let page = 2; pageSize > 0 && (page - 1) * pageSize < total; page += 1) {
    const next = await workerApiRequest<ApiResult<{ items: LaborPartner[]; page: number; pageSize: number; total: number }>>(`/worker-management/partners${listQuery(scope, page, pageSize)}`, scope);
    if (!Array.isArray(next?.data?.items)) break;
    rows.push(...next.data.items);
  }
  return rows;
}

export async function listLaborCommissionPolicies(scope: WorkerScope) {
  const response = await workerApiRequest<ApiResult<LaborCommissionPolicy[]>>(`/worker-management/partners/policies${scopeQuery(scope)}`, scope);
  return Array.isArray(response?.data) ? response.data : [];
}

export async function saveLaborPartner(scope: WorkerScope, input: LaborPartnerInput, id?: string) {
  const response = await workerApiRequest<ApiResult<LaborPartner>>(
    `/worker-management/partners${id ? `/${encodeURIComponent(id)}` : ''}${scopeQuery(scope)}`,
    scope,
    { method: id ? 'PATCH' : 'POST', body: input },
  );
  if (!response?.data) throw new Error('IGen-ERP không trả về đối tác đã lưu.');
  return response.data;
}

export async function removeLaborPartner(scope: WorkerScope, id: string) {
  await workerApiRequest(`/worker-management/partners/${encodeURIComponent(id)}${scopeQuery(scope)}`, scope, { method: 'DELETE' });
}

export type LaborCommissionPolicyInput = {
  name: string;
  effectiveFrom: string;
  settlementCycle: { type: 'calendar_month' | 'cutoff_day'; cutoffDay: number | null };
  official: { enabled: boolean; maxMonths: 1 | 2 | 3 | null; milestones: Array<{ month: number; amount: number; eligibilityRule: 'contract_active' | 'manual_confirmation' | 'attendance_threshold'; minWorkedDays: number | null; minWorkedHours: number | null }> };
  seasonal: { enabled: boolean; aggregationScope: 'partner_period' | 'partner_project_period' | null; tierMode: 'flat' | 'progressive' | null; minHoursPerWorker: number | null; maxEligibleHoursPerWorker: number | null; hourRounding: { unitMinutes: 1 | 5 | 15 | 30 | 60; mode: 'floor' | 'nearest' | 'ceil' }; moneyRounding: { unitVnd: number; mode: 'floor' | 'nearest' | 'ceil' }; tiers: Array<{ minHours: number; maxHours: number | null; hourlyRate: number }> };
};

export async function createLaborCommissionPolicy(scope: WorkerScope, input: LaborCommissionPolicyInput) {
  const response = await workerApiRequest<ApiResult<LaborCommissionPolicy>>(`/worker-management/partners/policies${scopeQuery(scope)}`, scope, { method: 'POST', body: input });
  if (!response?.data) throw new Error('IGen-ERP không trả về chính sách đã tạo.');
  return response.data;
}

export async function updateLaborCommissionPolicy(scope: WorkerScope, id: string, input: LaborCommissionPolicyInput) {
  const response = await workerApiRequest<ApiResult<LaborCommissionPolicy>>(`/worker-management/partners/policies/${encodeURIComponent(id)}${scopeQuery(scope)}`, scope, { method: 'PATCH', body: input });
  if (!response?.data) throw new Error('IGen-ERP khÃ´ng tráº£ vá» chÃ­nh sÃ¡ch Ä‘Ã£ cáº­p nháº­t.');
  return response.data;
}

export async function removeLaborCommissionPolicy(scope: WorkerScope, id: string) {
  await workerApiRequest(`/worker-management/partners/policies/${encodeURIComponent(id)}${scopeQuery(scope)}`, scope, { method: 'DELETE' });
}

export async function setLaborCommissionPolicyStatus(scope: WorkerScope, id: string, action: 'activate' | 'retire') {
  const response = await workerApiRequest<ApiResult<LaborCommissionPolicy>>(`/worker-management/partners/policies/${encodeURIComponent(id)}/${action}${scopeQuery(scope)}`, scope, { method: 'POST' });
  if (!response?.data) throw new Error('IGen-ERP không trả về trạng thái chính sách.');
  return response.data;
}

export async function listLaborWorkers(scope: WorkerScope) {
  const response = await workerApiRequest<{ workers?: LaborWorker[]; data?: { workers?: LaborWorker[] } | LaborWorker[] }>(`/worker-management/workers${scopeQuery(scope)}`, scope);
  if (Array.isArray(response?.workers)) return response.workers;
  const data = response?.data;
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.workers)) return data.workers;
  throw new Error('IGen-ERP khÃ´ng tráº£ vá» danh sÃ¡ch lao Ä‘á»™ng.');
}

export async function getLaborPartnerOverview(scope: WorkerScope, id: string) {
  const response = await workerApiRequest<ApiResult<{ partner: LaborPartner; referrals: LaborReferral[]; settlements: LaborSettlement[]; payouts: LaborSettlementDetail['payouts']; totals: { accruedAmount: number; paidAmount: number; balanceAmount: number } }>>(`/worker-management/partners/${encodeURIComponent(id)}/overview${scopeQuery(scope)}`, scope);
  if (!response?.data) throw new Error('KhÃ´ng táº£i Ä‘Æ°á»£c tá»•ng quan Ä‘á»‘i tÃ¡c.');
  return response.data;
}

export async function listLaborReferrals(scope: WorkerScope, partnerId: string) {
  const response = await workerApiRequest<ApiResult<LaborReferral[]>>(`/worker-management/partners/${encodeURIComponent(partnerId)}/referrals${scopeQuery(scope)}`, scope);
  return Array.isArray(response?.data) ? response.data : [];
}

export async function createLaborReferral(scope: WorkerScope, partnerId: string, input: { workerId: string; policyId: string; commissionScheme: LaborCommissionScheme; referredAt: string; employmentStartDate: string; effectiveFrom: string; confirmationSource: 'manual'; note?: string }) {
  const response = await workerApiRequest<ApiResult<LaborReferral>>(`/worker-management/partners/${encodeURIComponent(partnerId)}/referrals${scopeQuery(scope)}`, scope, { method: 'POST', body: input });
  if (!response?.data) throw new Error('IGen-ERP khÃ´ng tráº£ vá» nguá»“n giá»›i thiá»‡u Ä‘Ã£ táº¡o.');
  return response.data;
}

export async function listLaborReferralsForWorker(scope: WorkerScope, workerId: string) {
  const response = await workerApiRequest<ApiResult<LaborReferral[]>>(`/worker-management/partners/workers/${encodeURIComponent(workerId)}/referral${scopeQuery(scope)}`, scope);
  return Array.isArray(response?.data) ? response.data : [];
}
export async function updateLaborReferralStatus(scope: WorkerScope, partnerId: string, referralId: string, action: 'confirm' | 'end', effectiveTo?: string) {
  const response = await workerApiRequest<ApiResult<LaborReferral>>(`/worker-management/partners/${encodeURIComponent(partnerId)}/referrals/${encodeURIComponent(referralId)}/${action}${scopeQuery(scope)}`, scope, { method: 'POST', body: action === 'end' ? { effectiveTo } : undefined });
  if (!response?.data) throw new Error('IGen-ERP khÃ´ng tráº£ vá» nguá»“n giá»›i thiá»‡u Ä‘Ã£ cáº­p nháº­t.');
  return response.data;
}

export async function listLaborKpi(scope: WorkerScope, periodAnchor: string) {
  const response = await workerApiRequest<ApiResult<{ items: LaborKpiRow[]; periodStart: string; periodEnd: string }>>(`/worker-management/partners/kpi${scopeQuery(scope)}&periodAnchor=${encodeURIComponent(periodAnchor)}`, scope);
  return response?.data?.items || [];
}

export async function saveLaborKpi(scope: WorkerScope, partnerId: string, periodAnchor: string, targetReferrals: number) {
  await workerApiRequest(`/worker-management/partners/kpi/${encodeURIComponent(partnerId)}${scopeQuery(scope)}`, scope, { method: 'PUT', body: { periodAnchor, targetReferrals } });
}

export async function listLaborSettlements(scope: WorkerScope, filters: { partnerId?: string; status?: LaborSettlement['status']; scheme?: LaborCommissionScheme; periodStart?: string; periodEnd?: string } = {}) {
  const params = new URLSearchParams({ companyCode: scope.companyCode });
  if (scope.branchId) params.set('branchId', scope.branchId);
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  const response = await workerApiRequest<ApiResult<LaborSettlement[]>>(`/worker-management/partners/settlements?${params.toString()}`, scope);
  return Array.isArray(response?.data) ? response.data : [];
}

export async function getLaborSettlement(scope: WorkerScope, id: string) {
  const response = await workerApiRequest<ApiResult<LaborSettlementDetail>>(`/worker-management/partners/settlements/${encodeURIComponent(id)}${scopeQuery(scope)}`, scope);
  if (!response?.data) throw new Error('KhÃ´ng táº£i Ä‘Æ°á»£c chi tiáº¿t ká»³ Ä‘á»‘i soÃ¡t.');
  return response.data;
}

export async function calculateLaborSettlement(scope: WorkerScope, input: { partnerId: string; periodAnchor: string; manualEntries: Array<{ referralId: string; officialMonths?: number; seasonalHours?: number }> }) {
  const response = await workerApiRequest<ApiResult<{ settlement?: LaborSettlement; reused?: boolean } & Partial<LaborSettlement>>>(`/worker-management/partners/settlements/calculate${scopeQuery(scope)}`, scope, { method: 'POST', body: input });
  if (!response?.data) throw new Error('KhÃ´ng táº¡o Ä‘Æ°á»£c ká»³ Ä‘á»‘i soÃ¡t.');
  return response.data;
}

export async function laborSettlementAction(scope: WorkerScope, id: string, action: 'recalculate' | 'approve' | 'void', expectedVersion?: number, reason?: string) {
  const body = action === 'approve' || action === 'void' ? { expectedVersion, ...(reason ? { reason } : {}) } : undefined;
  await workerApiRequest(`/worker-management/partners/settlements/${encodeURIComponent(id)}/${action}${scopeQuery(scope)}`, scope, { method: 'POST', body });
}

export async function createLaborAdjustment(scope: WorkerScope, id: string, input: { amount: number; reason: string; periodAnchor: string; idempotencyKey: string }) {
  await workerApiRequest(`/worker-management/partners/settlements/${encodeURIComponent(id)}/adjustments${scopeQuery(scope)}`, scope, { method: 'POST', body: input });
}

export async function createLaborPayout(scope: WorkerScope, id: string, input: { amount: number; method: 'cash' | 'bank_transfer'; reference?: string; note?: string; idempotencyKey: string }) {
  await workerApiRequest(`/worker-management/partners/settlements/${encodeURIComponent(id)}/payouts${scopeQuery(scope)}`, scope, { method: 'POST', body: input });
}

export async function reverseLaborPayout(scope: WorkerScope, payoutId: string) {
  await workerApiRequest(`/worker-management/partners/payouts/${encodeURIComponent(payoutId)}/reverse${scopeQuery(scope)}`, scope, { method: 'POST' });
}

export async function exportLaborCommissionReport(scope: WorkerScope, filters: { partnerId?: string; status?: LaborSettlement['status']; scheme?: LaborCommissionScheme; periodStart?: string; periodEnd?: string } = {}) {
  const params = new URLSearchParams({ companyCode: scope.companyCode });
  if (scope.branchId) params.set('branchId', scope.branchId);
  if (filters.partnerId) params.set('partnerId', filters.partnerId);
  if (filters.status) params.set('status', filters.status);
  if (filters.scheme) params.set('scheme', filters.scheme);
  if (filters.periodStart) params.set('periodFrom', filters.periodStart);
  if (filters.periodEnd) params.set('periodTo', filters.periodEnd);
  return workerApiRequest<Blob>(`/worker-management/partners/reports/commission/export?${params.toString()}`, scope, { responseType: 'blob' });
}
