import { apiRequest } from '@/core/network/apiClient';
import type {
  BusinessOverviewData,
  DashboardActionItemsData,
  DashboardSummaryData,
  ErpCrmLead,
  FaqStatsSummary,
  FinanceOverviewReport,
  HealthcareOverviewData,
  KnowledgeHealthSummary,
  MarketingOverviewData,
  QuotationOverviewData,
  RetailOverviewReport,
  WorkerOverviewData,
} from '@/features/overview/types';

type ScopeOptions = {
  branchId?: string;
  companyCode?: string;
  signal?: AbortSignal;
};

function branchHeaders(branchId?: string): Record<string, string> | undefined {
  return branchId ? { 'x-branch-id': branchId } : undefined;
}

function buildQuery(params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) qs.set(key, value);
  }
  const str = qs.toString();
  return str ? `?${str}` : '';
}

export async function fetchBusinessOverview(
  from: string,
  to: string,
  options: ScopeOptions = {},
): Promise<BusinessOverviewData> {
  const query = buildQuery({ filter: 'custom', startDate: from, endDate: to });
  const res = await apiRequest<{ data?: BusinessOverviewData }>(`/dashboard/business-overview${query}`, {
    headers: branchHeaders(options.branchId),
    signal: options.signal,
  });
  if (!res?.data) throw new Error('Không nhận được dữ liệu tổng quan doanh nghiệp.');
  return res.data;
}

export async function fetchDashboardSummary(
  from: string,
  to: string,
  options: ScopeOptions = {},
): Promise<DashboardSummaryData> {
  const query = buildQuery({ filter: 'custom', startDate: from, endDate: to });
  const res = await apiRequest<{ data?: DashboardSummaryData }>(`/dashboard/summary${query}`, {
    headers: branchHeaders(options.branchId),
    signal: options.signal,
  });
  if (!res?.data) throw new Error('Không nhận được dữ liệu tổng hợp hệ thống.');
  return res.data;
}

export async function fetchDashboardActionItems(
  options: ScopeOptions = {},
): Promise<DashboardActionItemsData> {
  const res = await apiRequest<{ data?: DashboardActionItemsData }>('/dashboard/action-items', {
    headers: branchHeaders(options.branchId),
    signal: options.signal,
  });
  return (
    res?.data ?? {
      overdueTasks: [],
      pendingApprovals: [],
      lowStockAlerts: [],
    }
  );
}

export type ErpBranch = {
  _id: string;
  code?: string;
  name: string;
  isActive?: boolean;
};

export async function fetchCompanyBranches(signal?: AbortSignal, companyCode?: string): Promise<ErpBranch[]> {
  const query = companyCode ? `?companyCode=${encodeURIComponent(companyCode)}` : '';
  const res = await apiRequest<{ data?: ErpBranch[]; branches?: ErpBranch[] } | ErpBranch[]>(
    `/auth/branches${query}`,
    { signal },
  );
  const list = Array.isArray(res) ? res : (res?.data ?? res?.branches ?? []);
  return list.filter((b) => b && b._id && b.isActive !== false);
}

export async function fetchFinanceOverview(
  from: string,
  to: string,
  options: ScopeOptions = {},
): Promise<FinanceOverviewReport> {
  const query = buildQuery({
    from,
    to,
    branchId: options.branchId,
    companyCode: options.companyCode,
  });
  const res = await apiRequest<{ data?: FinanceOverviewReport }>(`/finance/management/report${query}`, {
    headers: branchHeaders(options.branchId),
    signal: options.signal,
  });
  if (!res?.data) throw new Error('Không nhận được báo cáo tài chính.');
  return res.data;
}

export async function fetchQuotationOverview(
  from: string,
  to: string,
  options: ScopeOptions = {},
): Promise<QuotationOverviewData> {
  const query = buildQuery({ from, to, companyCode: options.companyCode });
  const res = await apiRequest<QuotationOverviewData>(`/quotation/overview${query}`, {
    headers: branchHeaders(options.branchId),
    signal: options.signal,
  });
  if (!res?.quotes) throw new Error('Không nhận được thống kê báo giá.');
  return res;
}

export async function fetchRetailOverview(
  from: string,
  to: string,
  options: ScopeOptions = {},
): Promise<RetailOverviewReport> {
  const query = buildQuery({
    companyCode: options.companyCode,
    branchId: options.branchId,
    from,
    to,
  });
  const res = await apiRequest<{ data?: RetailOverviewReport }>(`/retail/reports/summary${query}`, {
    headers: branchHeaders(options.branchId),
    signal: options.signal,
  });
  if (!res?.data) throw new Error('Không nhận được báo cáo bán lẻ.');
  return res.data;
}

export async function fetchMarketingOverview(
  options: ScopeOptions = {},
): Promise<MarketingOverviewData> {
  const [leadsRes, knowledgeRes, faqRes] = await Promise.allSettled([
    apiRequest<{ data?: Array<ErpCrmLead & { _id?: string }> }>('/omni-inbox/leads?limit=500', {
      headers: branchHeaders(options.branchId),
      signal: options.signal,
    }),
    apiRequest<KnowledgeHealthSummary>('/company-knowledge/health', {
      headers: branchHeaders(options.branchId),
      signal: options.signal,
    }),
    apiRequest<FaqStatsSummary>('/company-knowledge/faq-candidates', {
      headers: branchHeaders(options.branchId),
      signal: options.signal,
    }),
  ]);

  const leads =
    leadsRes.status === 'fulfilled'
      ? (leadsRes.value?.data ?? []).map((item) => ({
          ...item,
          id: item._id || item.id,
        }))
      : null;

  const knowledge = knowledgeRes.status === 'fulfilled' ? knowledgeRes.value : null;
  const faq = faqRes.status === 'fulfilled' ? faqRes.value : null;
  const partialError = [leadsRes, knowledgeRes, faqRes].some((r) => r.status === 'rejected');

  if (!leads && !knowledge && !faq) {
    throw new Error('Không thể tải dữ liệu Marketing & CRM từ máy chủ ERP.');
  }

  return { leads, knowledge, faq, partialError };
}

export async function fetchWorkerOverview(
  options: ScopeOptions = {},
): Promise<WorkerOverviewData> {
  const query = buildQuery({
    companyCode: options.companyCode,
    branchId: options.branchId,
  });
  const res = await apiRequest<{ data?: WorkerOverviewData }>(`/worker-management/dashboard${query}`, {
    headers: branchHeaders(options.branchId),
    signal: options.signal,
  });
  if (!res?.data) throw new Error('Không nhận được thống kê lao động.');
  return res.data;
}

export async function fetchHealthcareOverview(
  from: string,
  to: string,
  options: ScopeOptions = {},
): Promise<HealthcareOverviewData> {
  const query = buildQuery({ from, to });
  const res = await apiRequest<HealthcareOverviewData | { data?: HealthcareOverviewData }>(
    `/healthcare/overview${query}`,
    {
      headers: branchHeaders(options.branchId),
      signal: options.signal,
    },
  );
  const payload = 'data' in res && res.data ? res.data : (res as HealthcareOverviewData);
  if (typeof payload?.patients !== 'number') {
    throw new Error('Không nhận được thống kê y tế.');
  }
  return payload;
}

