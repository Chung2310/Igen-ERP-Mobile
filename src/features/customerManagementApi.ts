import { apiRequest } from '@/core/network/apiClient';

export type CustomerStatus = 'active' | 'inactive';
export type CustomerType = 'regular' | 'vat';
export type CustomerKind = 'individual' | 'business';
export type CustomerGender = 'male' | 'female' | 'other';

export type Customer = {
  _id: string;
  companyCode: string;
  customerCode: string;
  type: CustomerType;
  customerKind?: CustomerKind;
  contactName?: string;
  name: string;
  phone: string;
  email?: string;
  dateOfBirth?: string;
  gender?: CustomerGender;
  address?: string;
  notes?: string;
  status: CustomerStatus;
  source: 'manual' | 'pos' | 'import';
  tier?: { code: string; name: string; minGrossProfit?: number; minSpend?: number };
  tierGrossProfit?: number;
  createdByName?: string;
  version: number;
  createdAt?: string;
  updatedAt?: string;
};

export type CustomerInput = {
  name: string;
  phone: string;
  type?: CustomerType;
  customerKind?: CustomerKind;
  contactName?: string;
  email?: string;
  dateOfBirth?: string;
  gender?: CustomerGender;
  address?: string;
  notes?: string;
  allowSharedPhone?: boolean;
};

export type CustomerPage = { items: Customer[]; total: number; page: number; limit: number };
export type BillingProfile = { _id: string; legalName: string; taxId: string; address: string; invoiceEmail: string; contactName?: string; isDefault: boolean; status: CustomerStatus; version: number };
export type BillingProfileInput = Pick<BillingProfile, 'legalName' | 'taxId' | 'address' | 'invoiceEmail'> & Partial<Pick<BillingProfile, 'contactName' | 'isDefault'>>;
export type CustomerPurchaseHistory = {
  summary: { orderCount: number; totalPurchased: number; totalPaid: number; currentDebt: number; lastPurchaseAt?: string };
  items: Array<{ _id: string; orderCode?: string; status?: string; businessDate?: string; grandTotal: number; paidAmount: number; dueAmount: number; itemCount: number; salespersonName?: string }>;
  devices: Array<{ _id: string; productName: string; sku?: string; internalBarcode?: string; serialNumber?: string; soldAt?: string; orderCode?: string; warrantyStartAt?: string; warrantyEndAt?: string }>;
};
export type CustomerTransactionRow = { id: string; kind: 'sale' | 'repair' | 'sale_refund' | 'repair_refund' | 'buyback'; sourceId: string; eventId?: string; code: string; parentCode?: string; occurredAt: string; status: string; amount: number; paidAmount: number; dueAmount: number; description: string };
export type CustomerTransactions = {
  items: CustomerTransactionRow[];
  total: number;
  page: number;
  limit: number;
  repairsVisible: boolean;
  summary: { charged: number; received: number; refunded: number; buybackPaid: number; outstanding: number };
};
export type CustomerTransactionDetail = {
  item: CustomerTransactionRow;
  lines: Array<{ name: string; sku?: string; quantity: number; unitPrice: number; total: number; serials?: string[] }>;
  payments: Array<{ at?: string; amount: number; method?: string; reference?: string }>;
  refunds: Array<{ at?: string; amount: number; reason?: string; reference?: string }>;
  note?: string;
  adjustments?: Array<{ label: string; amount: number }>;
  device?: { name: string; serialNumber?: string; condition?: string; symptom?: string; diagnosis?: string };
  financeVoucherCode?: string;
};
export type CustomerPointPolicy = { enabled: boolean; earnVndPerPoint: number; redeemVndPerPoint: number; maxRedeemPercent: number; version: number };
export type CustomerPointEntry = { _id: string; type: string; points: number; balanceAfter: number; reason: string; createdAt: string; branchId?: string };
export type CustomerReceivableEntry = { _id: string; type: string; amount: number; signedAmount: number; runningBalance: number; reason?: string; createdAt: string; createdByName?: string };
export type CustomerTier = { code: string; name: string; minGrossProfit: number; minSpend?: number };
export type RepairHistoryItem = { _id: string; ticketCode: string; ticketType?: string; device: { name: string }; status: string; receivedAt: string; dueAmount: number };

type Envelope<T> = { data: T };
type CustomerScope = { companyCode: string; branchId: string };

function query(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  const text = params.toString();
  return text ? `?${text}` : '';
}

async function data<T>(path: string, options?: Parameters<typeof apiRequest>[1]): Promise<T> {
  const response = await apiRequest<Envelope<T>>(path, options);
  if (response?.data === undefined) throw new Error('ERP không trả về dữ liệu khách hàng.');
  return response.data;
}

export const customerManagementApi = {
  list(companyCode: string, params: { q?: string; status?: CustomerStatus; type?: CustomerType; page?: number; limit?: number }, signal?: AbortSignal) {
    return data<CustomerPage>(`/customers${query({ companyCode, ...params })}`, { signal });
  },
  detail(id: string, companyCode: string) {
    return data<Customer>(`/customers/${encodeURIComponent(id)}${query({ companyCode })}`);
  },
  create(companyCode: string, input: CustomerInput) {
    return data<Customer>(`/customers${query({ companyCode })}`, { method: 'POST', body: input });
  },
  update(id: string, companyCode: string, input: CustomerInput, version: number) {
    return data<Customer>(`/customers/${encodeURIComponent(id)}${query({ companyCode })}`, { method: 'PATCH', body: { ...input, version } });
  },
  setStatus(id: string, companyCode: string, status: CustomerStatus, version: number) {
    return data<Customer>(`/customers/${encodeURIComponent(id)}/${status === 'active' ? 'activate' : 'deactivate'}${query({ companyCode })}`, { method: 'POST', body: { version } });
  },
  purchaseHistory(id: string, scope: CustomerScope) {
    return data<CustomerPurchaseHistory>(`/customers/${encodeURIComponent(id)}/purchase-history${query(scope)}`);
  },
  billingProfiles(id: string, companyCode: string) {
    return data<BillingProfile[]>(`/customers/${encodeURIComponent(id)}/billing-profiles${query({ companyCode })}`);
  },
  createBillingProfile(id: string, companyCode: string, input: BillingProfileInput) {
    return data<{ profile: BillingProfile; warnings: Array<{ code: string; message: string }> }>(`/customers/${encodeURIComponent(id)}/billing-profiles${query({ companyCode })}`, { method: 'POST', body: input });
  },
  settings(companyCode: string) {
    return data<{ companyCode: string; customerTiers: CustomerTier[] }>(`/customers/settings${query({ companyCode })}`);
  },
  updateSettings(companyCode: string, customerTiers: CustomerTier[]) {
    return data<{ companyCode: string; customerTiers: CustomerTier[] }>(`/customers/settings${query({ companyCode })}`, { method: 'PATCH', body: { customerTiers: customerTiers.map(({ code, name, minGrossProfit }) => ({ code, name, minGrossProfit })) } });
  },
  transactions(id: string, scope: CustomerScope, params: { type: string; from?: string; to?: string; page: number; limit: number }, signal?: AbortSignal) {
    return data<CustomerTransactions>(`/customers/${encodeURIComponent(id)}/transactions${query({ ...scope, ...params })}`, { signal, headers: { 'x-branch-id': scope.branchId } });
  },
  transactionDetail(id: string, scope: CustomerScope, row: CustomerTransactionRow) {
    return data<CustomerTransactionDetail>(`/customers/${encodeURIComponent(id)}/transactions/${row.kind}/${encodeURIComponent(row.sourceId)}${query({ ...scope, eventId: row.eventId })}`, { headers: { 'x-branch-id': scope.branchId } });
  },
  repairs(id: string, scope: CustomerScope, page = 1, signal?: AbortSignal, limit = 50) {
    return data<{ items: RepairHistoryItem[]; total: number; page: number; limit: number }>(`/customers/${encodeURIComponent(id)}/repairs${query({ ...scope, page, limit })}`, { signal });
  },
  pointPolicy(scope: CustomerScope) {
    return data<CustomerPointPolicy>(`/retail/points/policy${query(scope)}`);
  },
  updatePointPolicy(scope: CustomerScope, policy: CustomerPointPolicy) {
    return data<CustomerPointPolicy>(`/retail/points/policy${query(scope)}`, { method: 'PUT', body: policy });
  },
  points(scope: CustomerScope, customerId: string) {
    return data<{ balance: number; totalEarned: number; totalRedeemed: number; ledger: CustomerPointEntry[] }>(`/retail/points/customers/${encodeURIComponent(customerId)}${query(scope)}`);
  },
  adjustPoints(scope: CustomerScope, customerId: string, points: number, reason: string, idempotencyKey: string) {
    return apiRequest(`/retail/points/customers/${encodeURIComponent(customerId)}/adjust${query(scope)}`, { method: 'POST', body: { points, reason, idempotencyKey } });
  },
  receivables(scope: CustomerScope, customerId: string) {
    return data<{ items: CustomerReceivableEntry[]; total: number; page: number; limit: number; currentBalance: number }>(`/retail/receivables/customers/${encodeURIComponent(customerId)}${query({ ...scope, limit: 100 })}`);
  },
};
