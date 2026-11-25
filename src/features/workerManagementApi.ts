import { apiRequest } from '@/core/network/apiClient';

export type WorkerScope = { companyCode: string; branchId?: string };
export type WorkerStatus = 'active' | 'inactive' | 'placed';
export type WorkerLaborType = 'official' | 'seasonal' | 'foreign';
export type Worker = {
  _id: string; fullName: string; phone?: string; email?: string; idCard?: string; birthday?: string; address?: string;
  status: WorkerStatus; laborType?: WorkerLaborType; nationality?: string; workPermitNumber?: string; workPermitExpiry?: string;
  registrationDate?: string; note?: string; partnerCode?: string; partnerName?: string; projectIds?: string[]; customFields?: Record<string, unknown>;
};
export type WorkerInput = Omit<Worker, '_id' | 'partnerCode' | 'partnerName' | 'projectIds'> & { projectId?: string };
export type WorkerProjectStatus = 'planned' | 'active' | 'completed';
export type WorkerProject = {
  _id: string; code: string; name: string; quota: number; workerIds: string[]; daysOfWeek: number[]; startTime: string; endTime: string;
  location?: string; geoLocation?: { latitude: number; longitude: number; radiusMeters: number } | null;
  startDate: string; endDate: string; status: WorkerProjectStatus; note?: string;
};
export type WorkerProjectInput = Omit<WorkerProject, '_id'>;
export type LaborContractStatus = 'draft' | 'active' | 'renewed' | 'expired' | 'terminated';
export type LaborContract = {
  _id: string; workerId: string; code: string; clientName: string; startDate: string; endDate: string;
  status: LaborContractStatus; note?: string; rootContractId: string; previousContractId?: string | null; sequence: number;
  alertLevel?: 'ok' | 'expiring' | 'expired'; renewedAt?: string | null;
};
export type LaborContractInput = { workerId?: string; code: string; clientName: string; startDate: string; endDate: string; status?: LaborContractStatus; note?: string };
export type WorkerAttendance = {
  _id: string; workerId: string; projectId: string; date: string; status: string; workedMinutes?: number; note?: string;
  checkIn?: { time: string; distanceMeters?: number } | null; checkOut?: { time: string; distanceMeters?: number } | null;
};
export type WorkerNotification = { _id?: string; title?: string; content?: string; subject?: string; message?: string; createdAt?: string; sentAt?: string };
export type WorkerImportResult = { importedCount: number; skippedCount: number; errors: Array<{ row: number; name: string; phone: string; reason: string }>; referralErrors?: Array<{ workerId: string; partnerCode: string; reason: string }> };

function query(scope?: WorkerScope, extras: Record<string, string | number | undefined> = {}) {
  const params = new URLSearchParams();
  if (scope?.companyCode) params.set('companyCode', scope.companyCode);
  if (scope?.branchId) params.set('branchId', scope.branchId);
  for (const [key, value] of Object.entries(extras)) if (value != null && value !== '') params.set(key, String(value));
  const value = params.toString();
  return value ? `?${value}` : '';
}

type WorkerApiOptions = NonNullable<Parameters<typeof apiRequest>[1]>;

export function workerApiRequest<T>(path: string, scope?: WorkerScope, options: WorkerApiOptions = {}) {
  const headers = new Headers(options.headers);
  if (scope?.branchId) headers.set('x-branch-id', scope.branchId);
  return apiRequest<T>(path, { ...options, headers });
}

export async function listWorkers(scope: WorkerScope) {
  const response = await workerApiRequest<{ workers?: Worker[] }>(`/worker-management/workers${query(scope)}`, scope);
  return response.workers || [];
}
export async function saveWorker(scope: WorkerScope, input: WorkerInput, id?: string) {
  const response = await workerApiRequest<{ worker?: Worker }>(`/worker-management/workers${id ? `/${encodeURIComponent(id)}` : ''}${query(scope)}`, scope, { method: id ? 'PATCH' : 'POST', body: input });
  if (!response.worker) throw new Error('IGen-ERP không trả về hồ sơ lao động đã lưu.');
  return response.worker;
}
export async function removeWorker(scope: WorkerScope, id: string) {
  await workerApiRequest(`/worker-management/workers/${encodeURIComponent(id)}${query(scope)}`, scope, { method: 'DELETE' });
}
export async function bulkImportWorkers(scope: WorkerScope, workers: Array<{ fullName: string; phone: string; partnerCode?: string; email?: string; idCard?: string; birthday?: string; address?: string; note?: string; registrationDate?: string; laborType?: WorkerLaborType; commissionScheme?: 'official_monthly' | 'seasonal_hourly'; nationality?: string; workPermitNumber?: string; workPermitExpiry?: string }>, projectId?: string) {
  return workerApiRequest<WorkerImportResult>(`/worker-management/workers/bulk${query(scope)}`, scope, { method: 'POST', body: { workers, ...(projectId ? { projectId } : {}) } });
}
export async function bulkRemoveWorkers(scope: WorkerScope, ids: string[]) {
  return workerApiRequest<{ deletedCount?: number }>(`/worker-management/workers/bulk-delete${query(scope)}`, scope, { method: 'POST', body: { ids } });
}

export async function listWorkerProjects(scope: WorkerScope, filters: { page?: number; limit?: number; search?: string; status?: string } = {}) {
  const response = await workerApiRequest<{ data?: WorkerProject[]; total?: number; page?: number; limit?: number }>(`/worker-management/projects${query(scope, filters)}`, scope);
  return response.data || [];
}
export async function saveWorkerProject(scope: WorkerScope, input: WorkerProjectInput, id?: string) {
  const response = await workerApiRequest<{ data?: WorkerProject }>(`/worker-management/projects${id ? `/${encodeURIComponent(id)}` : ''}${query(scope)}`, scope, { method: id ? 'PATCH' : 'POST', body: input });
  if (!response.data) throw new Error('IGen-ERP không trả về dự án lao động đã lưu.');
  return response.data;
}
export async function removeWorkerProject(scope: WorkerScope, id: string) {
  await workerApiRequest(`/worker-management/projects/${encodeURIComponent(id)}${query(scope)}`, scope, { method: 'DELETE' });
}
export async function addWorkersToProject(scope: WorkerScope, projectId: string, workerIds: string[]) {
  const response = await workerApiRequest<{ data?: WorkerProject }>(`/worker-management/projects/${encodeURIComponent(projectId)}/workers/bulk${query(scope)}`, scope, { method: 'POST', body: { workerIds } });
  return response.data;
}
export async function removeWorkerFromProject(scope: WorkerScope, projectId: string, workerId: string) {
  const response = await workerApiRequest<{ data?: WorkerProject }>(`/worker-management/projects/${encodeURIComponent(projectId)}/workers/${encodeURIComponent(workerId)}${query(scope)}`, scope, { method: 'DELETE' });
  return response.data;
}

export async function listLaborContracts(scope: WorkerScope, filters: { page?: number; limit?: number; search?: string; status?: string; alert?: 'expiring' | 'expired' | 'any'; clientName?: string } = {}) {
  return workerApiRequest<{ data?: LaborContract[]; total?: number; clients?: string[] }>(`/worker-management/labor-contracts${query(scope, filters)}`, scope);
}
export async function getLaborContractHistory(scope: WorkerScope, id: string) {
  const response = await workerApiRequest<{ data?: LaborContract[] }>(`/worker-management/labor-contracts/${encodeURIComponent(id)}/history${query(scope)}`, scope);
  return response.data || [];
}
export async function getLaborContractAlerts(scope: WorkerScope) {
  const response = await workerApiRequest<{ data?: { alertDays: number; expiringCount: number; expiredCount: number; items: LaborContract[] } }>(`/worker-management/labor-contracts/expiring-summary${query(scope)}`, scope);
  return response.data;
}
export async function saveLaborContract(scope: WorkerScope, input: LaborContractInput, id?: string) {
  const response = await workerApiRequest<{ data?: LaborContract }>(`/worker-management/labor-contracts${id ? `/${encodeURIComponent(id)}` : ''}${query(scope)}`, scope, { method: id ? 'PATCH' : 'POST', body: input });
  if (!response.data) throw new Error('IGen-ERP không trả về hợp đồng đã lưu.');
  return response.data;
}
export async function renewLaborContract(scope: WorkerScope, id: string, input: LaborContractInput) {
  const response = await workerApiRequest<{ data?: { previous: LaborContract; current: LaborContract } }>(`/worker-management/labor-contracts/${encodeURIComponent(id)}/renew${query(scope)}`, scope, { method: 'POST', body: input });
  if (!response.data) throw new Error('IGen-ERP không trả về kỳ gia hạn.');
  return response.data;
}
export async function removeLaborContract(scope: WorkerScope, id: string) {
  await workerApiRequest(`/worker-management/labor-contracts/${encodeURIComponent(id)}${query(scope)}`, scope, { method: 'DELETE' });
}

export async function listWorkerAttendance(scope: WorkerScope | undefined, projectId: string, from?: string, to?: string) {
  return workerApiRequest<{ data?: WorkerAttendance[] }>(`/worker-management/attendance${query(undefined, { projectId, from, to })}`, scope);
}
export async function markWorkerAttendance(scope: WorkerScope | undefined, projectId: string, workerId: string) {
  const response = await workerApiRequest<{ data?: WorkerAttendance }>('/worker-management/attendance/mark', scope, { method: 'POST', body: { projectId, workerId } });
  return response.data;
}
export async function adjustWorkerAttendance(scope: WorkerScope | undefined, id: string, projectId: string, changes: { checkInAt?: string | null; checkOutAt?: string | null; note?: string }) {
  const response = await workerApiRequest<{ data?: WorkerAttendance }>(`/worker-management/attendance/${encodeURIComponent(id)}`, scope, { method: 'PATCH', body: { ...changes, projectId } });
  return response.data;
}
export async function createWorkerQrSession(scope: WorkerScope | undefined, projectId: string, date: string, durationMinutes = 60) {
  const response = await workerApiRequest<{ data?: { id: string; expiresAt: number } }>('/worker-management/qr-attendance/session', scope, { method: 'POST', body: { projectId, date, durationMinutes } });
  return response.data;
}
export async function getWorkerQrToken(scope: WorkerScope | undefined, sessionId: string) {
  const response = await workerApiRequest<{ data?: { token: string } }>(`/worker-management/qr-attendance/session/${encodeURIComponent(sessionId)}/token`, scope);
  if (!response.data?.token) throw new Error('IGen-ERP không trả về mã điểm danh QR.');
  return response.data;
}
export async function getWorkerQrStatus(scope: WorkerScope | undefined, sessionId: string) {
  const response = await workerApiRequest<{ data?: { checkedIn: number; closed: boolean; workers: Array<{ workerId: string; fullName: string; phone: string; checkinAt: number }> } }>(`/worker-management/qr-attendance/session/${encodeURIComponent(sessionId)}/status`, scope);
  return response.data;
}
export async function closeWorkerQrSession(scope: WorkerScope | undefined, sessionId: string) {
  await workerApiRequest(`/worker-management/qr-attendance/session/${encodeURIComponent(sessionId)}/close`, scope, { method: 'POST' });
}
export async function listWorkerNotifications(scope?: WorkerScope) {
  const response = await workerApiRequest<{ data?: WorkerNotification[] }>('/worker-management/notifications', scope);
  return response.data || [];
}
export async function createWorkerNotification(scope: WorkerScope | undefined, input: { title: string; content: string }) {
  const response = await workerApiRequest<{ data?: WorkerNotification }>('/worker-management/notifications', scope, { method: 'POST', body: input });
  return response.data;
}
export async function listWorkerCompanies() {
  const response = await apiRequest<{ data?: Array<{ code?: string; name?: string; uid?: string }> }>('/auth/companies');
  return response.data || [];
}
