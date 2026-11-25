import { apiRequest } from '@/core/network/apiClient';

export type RetailPartnerRole = 'collaborator' | 'dealer' | 'supplier';
export type RetailPartnerStatus = 'active' | 'inactive';

export type RetailPartner = {
  _id: string;
  code: string;
  name: string;
  roles: RetailPartnerRole[];
  phone?: string;
  email?: string;
  address?: string;
  status: RetailPartnerStatus;
  userId?: string;
  supplierId?: string;
  customerId?: string;
  supplier?: { name: string; code: string } | null;
};

export type PartnerUserOption = { _id: string; displayName?: string; email: string };
export type PartnerSupplierOption = { _id: string; code: string; name: string };
export type PartnerCustomerOption = { _id: string; customerCode: string; name: string; phone: string };
export type RetailCommissionPolicy = { _id: string; partnerId: string; effectiveAt: string; config: { phoneAmount: number; accessoryBps: number; repairBps: number } };
export type RetailLegacyPolicy = { _id: string; partnerId: string; kind: 'sale' | 'repair'; sku: string; ratePercent: number; effectiveFrom?: string; active: boolean };
export type RetailProductCommissionData = {
  products: Array<{ _id: string; name: string; categoryCode: string }>;
  variants: Array<{ _id: string; productId: string; sku: string; displayName?: string; trackingMode: string }>;
  categories: Array<{ code: string; name: string; parentCode?: string }>;
  configurations: Array<{ sku: string; rule: { kind: 'phone'; amount: number } | { kind: 'accessory'; rateBps: number } | null }>;
  legacyRules: Array<{ sku: string; partnerId: string; ratePercent: number; effectiveFrom?: string }>;
};
export type RetailPartnerStatementData = {
  partner: { code: string; name: string };
  entries: Array<{ _id: string; businessDate: string; sourceCode: string; amount: number }>;
  payouts: Array<{ _id: string; businessDate: string; reference: string; amount: number }>;
  balance: number;
};

type DataResponse<T> = { data?: T };

function companyQuery(companyCode: string) {
  return `?companyCode=${encodeURIComponent(companyCode)}`;
}

async function getData<T>(path: string): Promise<T> {
  const response = await apiRequest<DataResponse<T>>(path);
  if (response?.data === undefined) throw new Error('IGen-ERP không trả về dữ liệu đối tác.');
  return response.data;
}

export function listRetailPartners(companyCode: string) {
  return getData<RetailPartner[]>(`/retail/partners${companyQuery(companyCode)}`);
}

export function listPartnerSupplierOptions(companyCode: string) {
  return getData<PartnerSupplierOption[]>(`/retail/partners/suppliers${companyQuery(companyCode)}`);
}

export function listPartnerUserOptions(companyCode: string) {
  return getData<PartnerUserOption[]>(`/retail/partners/users${companyQuery(companyCode)}`);
}

export function listPartnerCustomerOptions(companyCode: string) {
  return getData<PartnerCustomerOption[]>(`/retail/partners/customers${companyQuery(companyCode)}`);
}

export type RetailPartnerInput = {
  code: string;
  name: string;
  roles: [RetailPartnerRole];
  phone: string;
  email: string;
  address: string;
  status: RetailPartnerStatus;
  userId: string;
  supplierId: string;
  customerId: string;
};

export async function saveRetailPartner(companyCode: string, input: RetailPartnerInput, id?: string) {
  const response = await apiRequest<DataResponse<RetailPartner>>(
    `/retail/partners${id ? `/${encodeURIComponent(id)}` : ''}${companyQuery(companyCode)}`,
    { method: id ? 'PATCH' : 'POST', body: input },
  );
  return response?.data;
}

export async function listRetailCommissionPolicies(companyCode: string) {
  const response = await apiRequest<DataResponse<{ items: RetailCommissionPolicy[]; legacy: RetailLegacyPolicy[] }>>(`/retail/partners/commission-policies${companyQuery(companyCode)}`);
  if (!response?.data) throw new Error('KhÃ´ng táº£i Ä‘Æ°á»£c chÃ­nh sÃ¡ch hoa há»“ng.');
  return response.data;
}

export async function saveRetailCommissionPolicy(companyCode: string, input: { partnerId: string; effectiveAt?: string; config: RetailCommissionPolicy['config'] }, id?: string) {
  const response = await apiRequest<DataResponse<RetailCommissionPolicy>>(`/retail/partners/commission-policies${id ? `/${encodeURIComponent(id)}` : ''}${companyQuery(companyCode)}`, { method: id ? 'PATCH' : 'POST', body: input });
  if (!response?.data) throw new Error('KhÃ´ng lÆ°u Ä‘Æ°á»£c chÃ­nh sÃ¡ch hoa há»“ng.');
  return response.data;
}

export async function getRetailProductCommissions(companyCode: string) {
  const response = await apiRequest<DataResponse<RetailProductCommissionData>>(`/retail/partners/product-commissions${companyQuery(companyCode)}`);
  if (!response?.data) throw new Error('KhÃ´ng táº£i Ä‘Æ°á»£c hoa há»“ng theo sáº£n pháº©m.');
  return response.data;
}

export async function saveRetailProductCommission(companyCode: string, skus: string[], rule: { kind: 'phone'; amount: number } | { kind: 'accessory'; rateBps: number } | null) {
  await apiRequest(`/retail/partners/product-commissions${companyQuery(companyCode)}`, { method: 'PUT', body: { skus, rule } });
}

export async function getRetailPartnerCommissionBalances(companyCode: string) {
  return getData<Array<{ partnerId: string; balance: number }>>(`/retail/finance/commission/balances${companyQuery(companyCode)}`);
}

export async function getRetailPartnerStatement(companyCode: string, from: string, to: string) {
  const response = await apiRequest<DataResponse<RetailPartnerStatementData>>(`/retail/finance/commission/me?companyCode=${encodeURIComponent(companyCode)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  if (!response?.data) throw new Error('KhÃ´ng táº£i Ä‘Æ°á»£c sao kÃª hoa há»“ng.');
  return response.data;
}
