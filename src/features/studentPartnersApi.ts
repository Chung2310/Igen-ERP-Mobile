import { apiRequest } from '@/core/network/apiClient';

export type StudentPartnerPayout = { id: string; amount: number; date: string; method: string; note?: string };
export type StudentReferredStudent = { _id: string; fullName: string; phone?: string; registrationDate?: string; status?: string[]; commission?: number };
export type StudentCommissionLevel = { _id: string; name: string; minTuition: number; commissionRate: number };

export type StudentPartner = {
  _id: string;
  ownerId?: string;
  name: string;
  phone: string;
  email?: string;
  commissionType: 'fixed' | 'percentage';
  commissionValue: number;
  bankName?: string;
  bankAccountNo?: string;
  bankAccountName?: string;
  isActive: boolean;
  notes?: string;
  referredStudentsCount: number;
  totalCommission: number;
  totalPaid: number;
  unpaidBalance: number;
  referredStudents?: StudentReferredStudent[];
  payoutHistory?: StudentPartnerPayout[];
  levelName?: string;
  totalReferredTuition?: number;
};

export type StudentPartnerInput = {
  name: string;
  phone: string;
  email: string;
  bankName: string;
  bankAccountNo: string;
  bankAccountName: string;
  isActive: boolean;
  notes: string;
};

type ApiResult<T> = { success?: boolean; data?: T; partners?: T };

function branchHeaders(branchId?: string) {
  return branchId ? { 'x-branch-id': branchId } : undefined;
}

function commissionBranchQuery(branchId?: string) {
  return branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
}

export async function listStudentPartners(branchId?: string) {
  const response = await apiRequest<ApiResult<StudentPartner[]>>('/partners', { headers: branchHeaders(branchId) });
  const partners = response?.partners ?? response?.data;
  if (!Array.isArray(partners)) throw new Error('IGen-ERP không trả về danh sách đối tác học viên.');
  return partners;
}

export async function getStudentPartner(id: string, branchId?: string) {
  const response = await apiRequest<ApiResult<StudentPartner>>(`/partners/${encodeURIComponent(id)}`, { headers: branchHeaders(branchId) });
  if (!response?.data) throw new Error('Không tải được hồ sơ đối tác học viên.');
  return response.data;
}

export async function saveStudentPartner(input: StudentPartnerInput, id?: string, branchId?: string) {
  const response = await apiRequest<ApiResult<StudentPartner>>(
    `/partners${id ? `/${encodeURIComponent(id)}` : ''}`,
    { method: id ? 'PATCH' : 'POST', headers: branchHeaders(branchId), body: input },
  );
  if (!response?.data) throw new Error('IGen-ERP không trả về đối tác đã lưu.');
  return response.data;
}

export async function removeStudentPartner(id: string, branchId?: string) {
  await apiRequest(`/partners/${encodeURIComponent(id)}`, { method: 'DELETE', headers: branchHeaders(branchId) });
}

export async function bulkCreateStudentPartners(partners: Array<{ name: string; phone: string; email: string; bankName: string; bankAccountNo: string; bankAccountName: string; isActive: boolean; notes: string }>, centerId?: string, branchId?: string) {
  const path = `/partners/bulk${centerId ? `?centerId=${encodeURIComponent(centerId)}` : ''}`;
  const response = await apiRequest<{ success?: boolean; importedCount?: number; skippedCount?: number; errors?: Array<{ row: number; name: string; phone: string; reason: string }> }>(path, { method: 'POST', headers: branchHeaders(branchId), body: { partners } });
  if (!response?.success) throw new Error('IGen-ERP không nhập được danh sách đối tác.');
  return { importedCount: response.importedCount || 0, skippedCount: response.skippedCount || 0, errors: response.errors || [] };
}

export async function payStudentPartner(id: string, input: { amount: number; date: string; method: 'Tiền mặt' | 'Chuyển khoản'; note: string }, branchId?: string) {
  await apiRequest(`/partners/${encodeURIComponent(id)}/payouts`, { method: 'POST', headers: branchHeaders(branchId), body: input });
}

export async function listStudentCommissionLevels(branchId?: string) {
  const response = await apiRequest<ApiResult<StudentCommissionLevel[]>>(`/partners/commission-levels${commissionBranchQuery(branchId)}`, { headers: branchHeaders(branchId) });
  if (!Array.isArray(response?.data)) throw new Error('IGen-ERP không trả về cấp hoa hồng học viên.');
  return response.data;
}

export async function saveStudentCommissionLevel(input: Omit<StudentCommissionLevel, '_id'>, id?: string, branchId?: string) {
  const response = await apiRequest<ApiResult<StudentCommissionLevel>>(
    `/partners/commission-levels${id ? `/${encodeURIComponent(id)}` : ''}${commissionBranchQuery(branchId)}`,
    { method: id ? 'PATCH' : 'POST', headers: branchHeaders(branchId), body: input },
  );
  if (!response?.data) throw new Error('IGen-ERP không trả về cấp hoa hồng đã lưu.');
  return response.data;
}

export async function removeStudentCommissionLevel(id: string, branchId?: string) {
  await apiRequest(`/partners/commission-levels/${encodeURIComponent(id)}${commissionBranchQuery(branchId)}`, { method: 'DELETE', headers: branchHeaders(branchId) });
}
