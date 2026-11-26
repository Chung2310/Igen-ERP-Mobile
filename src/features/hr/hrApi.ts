import type { DocumentPickerAsset } from 'expo-document-picker';
import { ApiError, apiRequest } from '@/core/network/apiClient';
import type {
  HrAttendanceRecord,
  HrAttendanceRosterEntry,
  HrBranch,
  HrCalendarEvent,
  HrContract,
  HrContractExpiryAlert,
  HrContractExtension,
  HrDepartment,
  HrEmployee,
  HrEmployeeWorkHoursRow,
  HrKanbanKpiReport,
  HrKanbanProject,
  HrKanbanTask,
  HrLeaveApplication,
  HrLeaveBalance,
  HrLeaveTemplate,
  HrPayrollAdjustment,
  HrPayrollPolicy,
  HrPayrollRun,
  HrPayslip,
  HrRecruitmentApplicant,
  HrRecruitmentHistory,
  HrRecruitmentInterview,
  HrRecruitmentJob,
  HrRecruitmentPipeline,
  HrShiftAssignmentEmployee,
  HrTrainingCourse,
  HrTrainingEnrollment,
  HrWorkCalendarDay,
  HrWorkCalendarDayType,
  HrWorkHoursConfig,
  HrWorkShift,
  HrWorkflow,
} from '@/features/hr/types';

function branchHeaders(branchId?: string): Record<string, string> | undefined {
  return branchId ? { 'x-branch-id': branchId } : undefined;
}

function payrollOperationHeaders(runId: string, expectedVersion: number, branchId?: string): Record<string, string> {
  return {
    ...(branchHeaders(branchId) ?? {}),
    'idempotency-key': `payroll-calculate:${runId}:${expectedVersion}`,
  };
}

function buildQuery(params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v);
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

// --- 1. Nhân sự & Sơ đồ tổ chức ---
export async function listHrEmployees(
  companyCode?: string,
  branchId?: string,
): Promise<HrEmployee[]> {
  const query = buildQuery({ companyCode, branchId });
  try {
    const res = await apiRequest<{ data?: HrEmployee[]; users?: HrEmployee[] } | HrEmployee[]>(
      `/auth/users${query}`,
      { headers: branchHeaders(branchId) },
    );
    const list = Array.isArray(res) ? res : (res?.data ?? res?.users ?? []);
    return list
      .filter((u) => u.role !== 'superadmin')
      .map((u) => ({
        ...u,
        id: u._id || u.uid || u.id,
        uid: u.uid || u._id || u.id,
      }));
  } catch (err) {
    // Fallback sang /auth/users/colleagues nếu tài khoản chỉ có quyền nhân viên thường
    const fallback = await apiRequest<{ data?: HrEmployee[]; users?: HrEmployee[] } | HrEmployee[]>(
      '/auth/users/colleagues',
    ).catch(() => null);
    if (!fallback) throw err;
    const list = Array.isArray(fallback) ? fallback : (fallback?.data ?? fallback?.users ?? []);
    return list
      .filter((u) => u.role !== 'superadmin')
      .map((u) => ({
        ...u,
        id: u._id || u.uid || u.id,
        uid: u.uid || u._id || u.id,
      }));
  }
}

export async function registerHrEmployee(payload: {
  displayName: string;
  email: string;
  password: string;
  role: 'user' | 'manager' | 'branch_owner' | 'admin';
  companyCode: string;
  companyName?: string;
  parentId?: string;
  level?: number;
  department?: string;
  division?: string;
  phone?: string;
  jobDescriptionLink?: string;
  branchId?: string;
  qualification?: string;
  monthlySalary?: number;
}): Promise<string> {
  const res = await apiRequest<{ data?: { _id?: string; id?: string } }>('/auth/register-user', {
    method: 'POST',
    body: payload,
    headers: branchHeaders(payload.branchId),
  });
  return res?.data?._id || res?.data?.id || '';
}

export async function updateHrEmployee(
  uid: string,
  updateData: Record<string, unknown>,
  branchId?: string,
): Promise<void> {
  await apiRequest(`/auth/users/${encodeURIComponent(uid)}`, {
    method: 'PATCH',
    body: updateData,
    headers: branchHeaders(branchId),
  });
}

export async function deleteHrEmployee(uid: string): Promise<void> {
  await apiRequest(`/auth/users/${encodeURIComponent(uid)}`, {
    method: 'DELETE',
  });
}

export async function getEmployeeLeaveBalance(
  employeeId: string,
  year = new Date().getFullYear(),
): Promise<HrLeaveBalance | null> {
  const query = buildQuery({ employeeId, year: String(year) });
  const res = await apiRequest<{ data?: HrLeaveBalance }>(`/leave/balance${query}`);
  return res?.data ?? null;
}

// --- 2. Chấm công ---
export async function listAttendanceRecords(
  date: string,
  branchId?: string,
): Promise<HrAttendanceRecord[]> {
  const query = buildQuery({ date });
  const res = await apiRequest<{ data?: HrAttendanceRecord[] }>(`/timekeeping/records${query}`, {
    headers: branchHeaders(branchId),
  });
  return res?.data ?? [];
}

export async function listMonthlyAttendanceLogs(params: {
  companyCode?: string;
  startDate: string;
  endDate: string;
  uid?: string;
  branchId?: string;
}): Promise<HrAttendanceRecord[]> {
  const qs = new URLSearchParams();
  if (params.companyCode) qs.set('companyCode', params.companyCode);
  qs.set('limit', '5000');
  qs.set('sort', 'date');
  qs.set('date[$gte]', params.startDate);
  qs.set('date[$lte]', params.endDate);
  if (params.uid) qs.set('uid', params.uid);
  type ApiAttendanceRecord = Omit<HrAttendanceRecord, 'checkIn' | 'checkOut'> & {
    checkIn?: string | { time?: string | null } | null;
    checkOut?: string | { time?: string | null } | null;
  };
  const res = await apiRequest<{ data?: ApiAttendanceRecord[] }>(
    `/crud/timekeeping-logs?${qs.toString()}`,
    { headers: branchHeaders(params.branchId) },
  );
  return (res?.data ?? []).map((log) => ({
    ...log,
    checkIn: typeof log.checkIn === 'object' && log.checkIn ? log.checkIn.time ?? null : log.checkIn,
    checkOut: typeof log.checkOut === 'object' && log.checkOut ? log.checkOut.time ?? null : log.checkOut,
  }));
}

export async function listAttendanceRoster(branchId?: string): Promise<HrAttendanceRosterEntry[]> {
  const query = buildQuery({ branchId });
  type ApiRosterUser = Partial<HrAttendanceRosterEntry> & { _id?: string; id?: string };
  const res = await apiRequest<{ data?: ApiRosterUser[] }>(
    `/auth/users${query}`,
    { headers: branchHeaders(branchId) },
  );
  return (res?.data ?? [])
    .map((user) => ({
      uid: user.uid || user._id || user.id || '',
      displayName: user.displayName || 'Nhân viên',
      branchId: user.branchId,
    }))
    .filter((user) => Boolean(user.uid));
}

export type TodayTimekeepingData = {
  log: {
    _id?: string;
    date?: string;
    status?: string;
    shiftName?: string;
    checkIn?: { time?: string; latitude?: number; longitude?: number; distance?: number } | null;
    checkOut?: { time?: string; latitude?: number; longitude?: number; distance?: number } | null;
  } | null;
  workCalendar: {
    date: string;
    isWorkingDay: boolean;
    label?: string;
  } | null;
};

export async function getTodayTimekeeping(params?: {
  uid?: string;
  companyCode?: string;
  branchId?: string;
}): Promise<TodayTimekeepingData> {
  const res = await apiRequest<{ data?: TodayTimekeepingData }>('/timekeeping/today', {
    headers: branchHeaders(params?.branchId),
  });
  const result: TodayTimekeepingData = res?.data ?? { log: null, workCalendar: null };

  // Backend /timekeeping/today chỉ trả về log đang hoạt động (chưa check-out).
  // Nếu đã check-out trong ngày, tra cứu thêm bản ghi hoàn tất của hôm nay.
  if (!result.log && params?.uid) {
    try {
      const now = new Date();
      const todayKey =
        result.workCalendar?.date ||
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const qs = new URLSearchParams();
      if (params.companyCode) qs.set('companyCode', params.companyCode);
      qs.set('uid', params.uid);
      qs.set('date', todayKey);
      qs.set('limit', '1');
      const fallback = await apiRequest<{ data?: Array<NonNullable<TodayTimekeepingData['log']>> }>(
        `/crud/timekeeping-logs?${qs.toString()}`,
        { headers: branchHeaders(params.branchId) },
      );
      if (fallback?.data?.[0]) {
        result.log = fallback.data[0];
      }
    } catch {
      // Bỏ qua nếu tài khoản không có quyền đọc crud/timekeeping-logs
    }
  }

  return result;
}

export async function submitCheckIn(
  branchId?: string,
  payload?: { latitude: number; longitude: number; deviceInfo?: string },
): Promise<{ message?: string; data?: TodayTimekeepingData['log'] }> {
  return apiRequest<{ message?: string; data?: TodayTimekeepingData['log'] }>('/timekeeping/check-in', {
    method: 'POST',
    body: payload ?? {},
    headers: branchHeaders(branchId),
  });
}

export async function submitCheckOut(
  branchId?: string,
  payload?: { latitude: number; longitude: number; deviceInfo?: string },
): Promise<{ message?: string; data?: TodayTimekeepingData['log'] }> {
  return apiRequest<{ message?: string; data?: TodayTimekeepingData['log'] }>('/timekeeping/check-out', {
    method: 'POST',
    body: payload ?? {},
    headers: branchHeaders(branchId),
  });
}

export async function updateAttendanceLog(
  logId: string,
  payload: {
    checkIn?: string | null;
    checkOut?: string | null;
    status?: string;
    note?: string;
    reason?: string;
  },
  branchId?: string,
): Promise<void> {
  await apiRequest(`/crud/timekeeping-logs/${encodeURIComponent(logId)}`, {
    method: 'PATCH',
    body: payload,
    headers: branchHeaders(branchId),
  });
}

// --- 2b. Lịch làm việc (Sự kiện lịch) ---
export async function listHrCalendarEvents(companyCode?: string): Promise<HrCalendarEvent[]> {
  const query = buildQuery({ companyCode });
  const res = await apiRequest<{ data?: Array<HrCalendarEvent & { _id?: string }> }>(
    `/crud/hr-calendar-events${query}`,
  );
  return (res?.data ?? []).map((e) => ({ ...e, id: e._id || e.id }));
}

export async function createHrCalendarEvent(payload: {
  companyCode: string;
  type: HrCalendarEvent['type'];
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  employeeId?: string;
  employeeName?: string;
  creatorId?: string;
}): Promise<HrCalendarEvent> {
  const res = await apiRequest<{ data: HrCalendarEvent & { _id?: string } }>(
    '/crud/hr-calendar-events',
    {
      method: 'POST',
      body: {
        ...payload,
        status: 'active',
        createdAt: new Date().toISOString(),
      },
    },
  );
  return { ...res.data, id: res.data._id || res.data.id };
}

export async function deleteHrCalendarEvent(eventId: string): Promise<void> {
  await apiRequest(`/crud/hr-calendar-events/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
  });
}

// --- 2c. Ca làm việc & Phân ca ---
export async function listHrWorkShifts(branchId?: string): Promise<HrWorkShift[]> {
  const res = await apiRequest<{ data?: HrWorkShift[] }>('/timekeeping/shifts', {
    headers: branchHeaders(branchId),
  });
  return res?.data ?? [];
}

export async function saveHrWorkShift(
  payload: Partial<HrWorkShift> & { code: string; name: string; startTime: string; endTime: string; workingDays: number[] },
  shiftId?: string,
  branchId?: string,
): Promise<HrWorkShift> {
  const path = shiftId ? `/timekeeping/shifts/${encodeURIComponent(shiftId)}` : '/timekeeping/shifts';
  const res = await apiRequest<{ data: HrWorkShift }>(path, {
    method: shiftId ? 'PATCH' : 'POST',
    body: payload,
    headers: branchHeaders(branchId),
  });
  return res.data;
}

export async function listHrShiftAssignments(branchId?: string): Promise<HrShiftAssignmentEmployee[]> {
  const res = await apiRequest<{ data?: HrShiftAssignmentEmployee[] }>(
    '/timekeeping/shift-assignments',
    { headers: branchHeaders(branchId) },
  );
  return res?.data ?? [];
}

export async function assignHrWorkShift(
  payload: {
    employeeIds: string[];
    shiftId: string;
    effectiveFrom: string;
    daysOfWeek: number[];
  },
  branchId?: string,
): Promise<void> {
  await apiRequest('/timekeeping/shift-assignments', {
    method: 'POST',
    body: payload,
    headers: branchHeaders(branchId),
  });
}

// --- 2d. Lịch nghỉ lễ & Ngày làm bù ---
export async function listHrWorkCalendar(
  year: number,
  appliedOnly = false,
): Promise<HrWorkCalendarDay[]> {
  const res = await apiRequest<{ data?: HrWorkCalendarDay[] }>(
    `/timekeeping/work-calendar?year=${year}&appliedOnly=${appliedOnly}`,
  );
  return res?.data ?? [];
}

export async function syncHrWorkCalendar(year: number): Promise<HrWorkCalendarDay[]> {
  const res = await apiRequest<{ data?: HrWorkCalendarDay[] }>('/timekeeping/work-calendar/sync', {
    method: 'POST',
    body: { year },
  });
  return res?.data ?? [];
}

export async function createHrWorkCalendarDay(payload: {
  date: string;
  name: string;
  dayType: HrWorkCalendarDayType;
}): Promise<HrWorkCalendarDay> {
  const res = await apiRequest<{ data: HrWorkCalendarDay }>('/timekeeping/work-calendar', {
    method: 'POST',
    body: payload,
  });
  return res.data;
}

export async function updateHrWorkCalendarDay(
  id: string,
  payload: Partial<Pick<HrWorkCalendarDay, 'date' | 'name' | 'dayType' | 'isApplied' | 'adminReason'>>,
): Promise<HrWorkCalendarDay> {
  const res = await apiRequest<{ data: HrWorkCalendarDay }>(
    `/timekeeping/work-calendar/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: payload },
  );
  return res.data;
}

export async function deleteHrWorkCalendarDay(id: string): Promise<void> {
  await apiRequest(`/timekeeping/work-calendar/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// --- 2e. Giờ làm việc riêng ---
export async function listHrEmployeeWorkHours(branchId?: string): Promise<HrEmployeeWorkHoursRow[]> {
  const res = await apiRequest<{ data?: HrEmployeeWorkHoursRow[] }>('/timekeeping/work-hours', {
    headers: branchHeaders(branchId),
  });
  return res?.data ?? [];
}

export async function updateHrEmployeeWorkHours(
  employeeId: string,
  config: HrWorkHoursConfig,
  branchId?: string,
): Promise<void> {
  await apiRequest(`/timekeeping/work-hours/${encodeURIComponent(employeeId)}`, {
    method: 'PATCH',
    body: config,
    headers: branchHeaders(branchId),
  });
}

// --- 3. Giao việc / Kanban (Dự án & Công việc) ---
export async function listKanbanProjects(branchId?: string): Promise<HrKanbanProject[]> {
  const query = buildQuery({ branchId });
  const res = await apiRequest<{ data?: Array<HrKanbanProject & { _id?: string }> }>(
    `/kanban/projects${query}`,
    { headers: branchHeaders(branchId) },
  );
  return (res?.data ?? []).map((p) => ({ ...p, id: p._id || p.id }));
}

export async function createKanbanProject(
  payload: {
    name: string;
    companyCode: string;
    branchId?: string;
    creatorUid?: string;
    status?: string;
    priority?: string;
    startAt?: string;
    dueAt?: string;
  },
): Promise<HrKanbanProject> {
  const res = await apiRequest<{ data: HrKanbanProject & { _id?: string } }>('/kanban/projects', {
    method: 'POST',
    body: {
      ...payload,
      status: payload.status || 'not_started',
      priority: payload.priority || 'medium',
      createdAt: new Date().toISOString(),
    },
    headers: branchHeaders(payload.branchId),
  });
  return { ...res.data, id: res.data._id || res.data.id };
}

export async function updateKanbanProject(
  projectId: string,
  payload: Record<string, unknown>,
  branchId?: string,
): Promise<HrKanbanProject> {
  const res = await apiRequest<{ data: HrKanbanProject & { _id?: string } }>(
    `/kanban/projects/${encodeURIComponent(projectId)}`,
    {
      method: 'PATCH',
      body: payload,
      headers: branchHeaders(branchId),
    },
  );
  return { ...res.data, id: res.data._id || res.data.id };
}

export async function deleteKanbanProject(projectId: string, branchId?: string): Promise<void> {
  await apiRequest(`/kanban/projects/${encodeURIComponent(projectId)}`, {
    method: 'DELETE',
    headers: branchHeaders(branchId),
  });
}

export async function listKanbanTasks(branchId?: string): Promise<HrKanbanTask[]> {
  const query = buildQuery({ branchId });
  const res = await apiRequest<{ data?: Array<HrKanbanTask & { _id?: string }> }>(
    `/kanban/tasks${query}`,
    { headers: branchHeaders(branchId) },
  );
  return (res?.data ?? []).map((t) => ({ ...t, id: t._id || t.id }));
}

export async function createKanbanTask(
  payload: {
    title: string;
    companyCode?: string;
    description?: string;
    priority?: string;
    status?: string;
    projectId?: string;
    assigneeUid?: string;
    assignee?: string;
    dueDate?: string;
    startTime?: string;
    endTime?: string;
    estTime?: number;
    actualTime?: number;
    category?: string;
    salesKpiTarget?: number;
    linkNote?: string;
  },
  branchId?: string,
): Promise<HrKanbanTask> {
  const res = await apiRequest<{ data: HrKanbanTask & { _id?: string } }>('/kanban/tasks', {
    method: 'POST',
    body: {
      title: payload.title,
      companyCode: payload.companyCode,
      description: payload.description || '',
      priority: payload.priority || 'Medium',
      status: payload.status || 'Not Started',
      projectId: payload.projectId || '',
      assigneeUid: payload.assigneeUid || '',
      assignee: payload.assignee || 'Chưa phân công',
      dueDate: payload.dueDate || new Date(Date.now() + 86_400_000).toISOString().slice(0, 16),
      startTime: payload.startTime || undefined,
      endTime: payload.endTime || undefined,
      estTime: payload.estTime,
      actualTime: payload.actualTime,
      category: payload.category || 'Hướng dẫn nhân viên mới',
      salesKpiTarget: payload.salesKpiTarget ?? 0,
      linkNote: payload.linkNote || '',
      createdAt: new Date().toISOString(),
      ...(branchId ? { branchId } : {}),
    },
    headers: branchHeaders(branchId),
  });
  return { ...res.data, id: res.data._id || res.data.id };
}

export async function updateKanbanTask(
  taskId: string,
  payload: Record<string, unknown>,
  branchId?: string,
): Promise<HrKanbanTask> {
  const res = await apiRequest<{ data: HrKanbanTask & { _id?: string } }>(
    `/kanban/tasks/${encodeURIComponent(taskId)}`,
    {
      method: 'PATCH',
      body: payload,
      headers: branchHeaders(branchId),
    },
  );
  return { ...res.data, id: res.data._id || res.data.id };
}

export async function updateKanbanTaskStatus(
  taskId: string,
  status: string,
  branchId?: string,
): Promise<HrKanbanTask> {
  return updateKanbanTask(taskId, { status }, branchId);
}

export async function deleteKanbanTask(taskId: string, branchId?: string): Promise<void> {
  await apiRequest(`/kanban/tasks/${encodeURIComponent(taskId)}`, {
    method: 'DELETE',
    headers: branchHeaders(branchId),
  });
}

export async function getKanbanMonthlyKpi(
  period: string,
  branchId?: string,
): Promise<HrKanbanKpiReport> {
  const query = buildQuery({ period, branchId });
  const res = await apiRequest<{ data?: HrKanbanKpiReport }>(`/kanban/kpi/monthly${query}`, {
    headers: branchHeaders(branchId),
  });
  return (
    res?.data ?? {
      periodKey: period,
      periodStatus: 'provisional',
      closedAt: null,
      rows: [],
    }
  );
}

// --- 4. Đơn nghỉ phép / Đề xuất ---
export async function listLeaveApplications(
  companyCode?: string,
  branchId?: string,
): Promise<HrLeaveApplication[]> {
  const query = buildQuery({ companyCode });
  const res = await apiRequest<{ data?: Array<HrLeaveApplication & { _id?: string }> }>(
    `/crud/hr-leave-applications${query}`,
    { headers: branchHeaders(branchId) },
  );
  return (res?.data ?? []).map((item) => ({ ...item, id: item._id || item.id }));
}

export async function createLeaveApplication(
  payload: {
    companyCode?: string;
    employeeId?: string;
    employeeName?: string;
    type?: string;
    leaveType?: string;
    requestKind?: HrLeaveApplication['requestKind'];
    startDate: string;
    endDate: string;
    reason: string;
    uploadedFileUrl?: string;
    uploadedFileName?: string;
    attachments?: HrLeaveApplication['attachments'];
  },
  branchId?: string,
): Promise<HrLeaveApplication> {
  const res = await apiRequest<{ data: HrLeaveApplication & { _id?: string } }>(
    '/crud/hr-leave-applications',
    {
      method: 'POST',
      body: {
        ...payload,
        type: payload.type || payload.leaveType || 'leave',
        requestKind: payload.requestKind || 'leave',
        status: 'pending',
      },
      headers: branchHeaders(branchId),
    },
  );
  return { ...res.data, id: res.data._id || res.data.id };
}

export async function updateLeaveStatus(
  appId: string,
  status: 'approved' | 'rejected',
  branchId?: string,
  extra?: {
    rejectReason?: string;
    approvedBy?: string;
    approvalType?: string;
  },
): Promise<HrLeaveApplication> {
  const res = await apiRequest<{ data: HrLeaveApplication & { _id?: string } }>(
    `/crud/hr-leave-applications/${encodeURIComponent(appId)}`,
    {
      method: 'PATCH',
      body: { status, ...(extra || {}) },
      headers: branchHeaders(branchId),
    },
  );
  return { ...res.data, id: res.data._id || res.data.id };
}

export async function deleteLeaveApplication(appId: string): Promise<void> {
  await apiRequest(`/crud/hr-leave-applications/${encodeURIComponent(appId)}`, {
    method: 'DELETE',
  });
}

export async function listLeaveTemplates(companyCode?: string): Promise<HrLeaveTemplate[]> {
  const query = buildQuery({ companyCode });
  const res = await apiRequest<{ data?: Array<HrLeaveTemplate & { _id?: string }> }>(
    `/crud/hr-leave-templates${query}`,
  );
  return (res?.data ?? []).map((t) => ({ ...t, id: t._id || t.id }));
}

async function assetToDataUrl(asset: DocumentPickerAsset): Promise<string> {
  const response = await fetch(asset.uri);
  if (!response.ok) throw new Error('Không đọc được tệp đã chọn trên thiết bị.');
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không chuyển được tệp sang định dạng tải lên.'));
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '');
      if (!dataUrl.startsWith('data:')) reject(new Error('Tệp không có dữ liệu hợp lệ.'));
      else resolve(dataUrl);
    };
    reader.readAsDataURL(blob);
  });
}

export async function uploadHrMediaFile(
  asset: DocumentPickerAsset,
  sourceType = 'hr.leave',
): Promise<{
  url: string;
  uploadToken?: string;
  name: string;
  mimeType?: string;
  size?: number;
}> {
  const file = await assetToDataUrl(asset);
  const res = await apiRequest<{ url?: string; uploadToken?: string; data?: { url?: string; uploadToken?: string } }>(
    '/media/upload',
    {
      method: 'POST',
      body: {
        file,
        sourceType,
        fileName: asset.name,
        mimeType: asset.mimeType || 'application/octet-stream',
        size: asset.size || 0,
      },
    },
  );
  const url = res?.url || res?.data?.url;
  const uploadToken = res?.uploadToken || res?.data?.uploadToken;
  if (!url) throw new Error('Máy chủ không trả về đường dẫn tệp đã tải lên.');
  return {
    url,
    uploadToken,
    name: asset.name,
    mimeType: asset.mimeType || 'application/octet-stream',
    size: asset.size || 0,
  };
}

export async function uploadHrWorkflowAttachment(asset: DocumentPickerAsset, companyCode?: string): Promise<{
  url: string;
  name: string;
  mimeType: string;
  size: number;
  type: 'image' | 'video' | 'audio' | 'file';
}> {
  const maxSize = 25 * 1024 * 1024;
  const size = asset.size || 0;
  if (size > maxSize) throw new Error('Tệp đính kèm không được vượt quá 25 MB.');

  const mimeType = asset.mimeType || 'application/octet-stream';
  type SignedUpload = {
    signature: string;
    timestamp: number;
    folder: string;
    publicId: string;
    apiKey: string;
    cloudName: string;
  };
  let signedData: SignedUpload;
  try {
    const signed = await apiRequest<{
      status?: string;
      data?: SignedUpload;
    }>('/media/sign-workflow-attachment-upload', {
      method: 'POST',
      body: { fileName: asset.name, mimeType, size },
    });
    if (!signed?.data) throw new Error('ERP không trả về thông tin xác thực tải tệp.');
    signedData = signed.data;
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) throw error;
    const tenantFolder = String(companyCode || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!tenantFolder) throw new Error('Không xác định được doanh nghiệp để tải tệp lên.');
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `igen_erp/managed/${tenantFolder}/workflow/attachments`;
    const extension = asset.name.match(/\.[a-zA-Z0-9]{1,10}$/)?.[0] || '';
    const publicId = `workflow_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}${extension}`;
    const signed = await apiRequest<{
      signature?: string;
      apiKey?: string;
      cloudName?: string;
    }>('/media/sign-upload', {
      method: 'POST',
      body: { paramsToSign: { timestamp, folder, public_id: publicId } },
    });
    if (!signed.signature || !signed.apiKey || !signed.cloudName) {
      throw new Error('ERP không trả về thông tin xác thực tải tệp.');
    }
    signedData = { ...signed, timestamp, folder, publicId } as SignedUpload;
  }

  const localFile = await fetch(asset.uri);
  if (!localFile.ok) throw new Error('Không đọc được tệp đã chọn trên thiết bị.');
  const blob = await localFile.blob();
  const resourceType = mimeType.startsWith('image/')
    ? 'image'
    : mimeType.startsWith('video/') || mimeType.startsWith('audio/')
      ? 'video'
      : 'raw';
  const form = new FormData();
  form.append('file', blob, asset.name);
  form.append('api_key', signedData.apiKey);
  form.append('timestamp', String(signedData.timestamp));
  form.append('folder', signedData.folder);
  form.append('public_id', signedData.publicId);
  form.append('signature', signedData.signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(signedData.cloudName)}/${resourceType}/upload`,
    { method: 'POST', body: form },
  );
  const payload = await response.json().catch(() => ({})) as {
    secure_url?: string;
    error?: { message?: string };
  };
  if (!response.ok || !payload.secure_url) {
    throw new Error(payload.error?.message || `Cloudinary từ chối tải tệp (HTTP ${response.status}).`);
  }

  const type = mimeType.startsWith('image/')
    ? 'image'
    : mimeType.startsWith('video/')
      ? 'video'
      : mimeType.startsWith('audio/')
        ? 'audio'
        : 'file';
  return { url: payload.secure_url, name: asset.name, mimeType, size, type };
}

export async function createLeaveTemplate(payload: {
  companyCode?: string;
  name: string;
  requestKind: HrLeaveTemplate['requestKind'];
  fileUrl?: string;
  fileName?: string;
  uploadToken?: string;
  uploadedBy?: string;
}): Promise<HrLeaveTemplate> {
  const res = await apiRequest<{ data: HrLeaveTemplate & { _id?: string } }>(
    '/crud/hr-leave-templates',
    {
      method: 'POST',
      body: payload,
    },
  );
  return { ...res.data, id: res.data._id || res.data.id };
}

export async function deleteLeaveTemplate(tplId: string): Promise<void> {
  await apiRequest(`/crud/hr-leave-templates/${encodeURIComponent(tplId)}`, {
    method: 'DELETE',
  });
}

// --- 5. Hợp đồng ---
export async function listHrContracts(
  companyCode?: string,
  branchId?: string,
): Promise<HrContract[]> {
  const query = buildQuery({ companyCode, branchId });
  const res = await apiRequest<{ data?: HrContract[]; contracts?: HrContract[] } | HrContract[]>(
    `/hr-contracts${query}`,
    { headers: branchHeaders(branchId) },
  );
  return Array.isArray(res) ? res : (res?.data ?? res?.contracts ?? []);
}

export async function fetchHrContractsOverview(params: {
  companyCode?: string;
  branchId?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{
  contracts: HrContract[];
  expiryAlerts: HrContractExpiryAlert[];
  expiryAlertTotal: number;
  expiryAlertDays: number;
  employees: Array<{ _id: string; displayName?: string; email?: string; department?: string }>;
  withoutContractEmployees: Array<{ id: string; name: string }>;
  total: number;
}> {
  const query = buildQuery({
    companyCode: params.companyCode,
    branchId: params.branchId,
    search: params.search,
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 50),
  });
  const res = await apiRequest<{
    data?: {
      contracts?: HrContract[];
      expiryAlerts?: HrContractExpiryAlert[];
      expiryAlertTotal?: number;
      expiryAlertDays?: number;
      employees?: Array<{ _id: string; displayName?: string; email?: string; department?: string }>;
      withoutContractEmployees?: Array<{ id: string; name: string }>;
      total?: number;
    };
  }>(`/hr-contracts${query}`, { headers: branchHeaders(params.branchId) });
  return {
    contracts: res?.data?.contracts ?? [],
    expiryAlerts: res?.data?.expiryAlerts ?? [],
    expiryAlertTotal: res?.data?.expiryAlertTotal ?? 0,
    expiryAlertDays: res?.data?.expiryAlertDays ?? 20,
    employees: res?.data?.employees ?? [],
    withoutContractEmployees: res?.data?.withoutContractEmployees ?? [],
    total: res?.data?.total ?? 0,
  };
}

export async function listHrContractExtensions(
  companyCode?: string,
  branchId?: string,
): Promise<HrContractExtension[]> {
  const query = buildQuery({ companyCode, branchId });
  const res = await apiRequest<{ data?: HrContractExtension[] }>(
    `/hr-contracts/extensions/list${query}`,
    { headers: branchHeaders(branchId) },
  );
  return res?.data ?? [];
}

export async function saveHrContract(
  payload: Record<string, unknown>,
  contractId?: string,
  companyCode?: string,
  branchId?: string,
): Promise<HrContract> {
  const query = buildQuery({ companyCode, branchId });
  const path = contractId
    ? `/hr-contracts/${encodeURIComponent(contractId)}${query}`
    : `/hr-contracts${query}`;
  const res = await apiRequest<{ data: HrContract }>(path, {
    method: contractId ? 'PATCH' : 'POST',
    body: payload,
    headers: branchHeaders(branchId),
  });
  return res.data;
}

export async function createHrContractExtension(
  contractId: string,
  payload: Record<string, unknown>,
  companyCode?: string,
  branchId?: string,
): Promise<HrContractExtension> {
  const query = buildQuery({ companyCode, branchId });
  const res = await apiRequest<{ data: HrContractExtension }>(
    `/hr-contracts/${encodeURIComponent(contractId)}/extensions${query}`,
    {
      method: 'POST',
      body: payload,
      headers: branchHeaders(branchId),
    },
  );
  return res.data;
}

export async function updateHrContractSettings(
  expiryAlertDays: number,
  companyCode?: string,
  branchId?: string,
): Promise<number> {
  const query = buildQuery({ companyCode, branchId });
  const res = await apiRequest<{ data?: { expiryAlertDays?: number } }>(
    `/hr-contracts/settings${query}`,
    {
      method: 'PUT',
      body: { expiryAlertDays },
      headers: branchHeaders(branchId),
    },
  );
  return res?.data?.expiryAlertDays ?? expiryAlertDays;
}

export async function uploadHrContractFile(
  asset: DocumentPickerAsset,
  kind: 'contract' | 'signed' | 'electronicSignature' | 'extension' | 'extensionSigned',
  companyCode?: string,
  branchId?: string,
): Promise<{
  url: string;
  name: string;
  mimeType: string;
  size: number;
  uploadToken?: string;
}> {
  const file = await assetToDataUrl(asset);
  const query = buildQuery({ companyCode, branchId });
  const res = await apiRequest<{
    data?: { url?: string; name?: string; mimeType?: string; size?: number; uploadToken?: string };
    url?: string;
    uploadToken?: string;
  }>(`/hr-contracts/upload${query}`, {
    method: 'POST',
    body: {
      file,
      name: asset.name,
      mimeType: asset.mimeType || 'application/octet-stream',
      size: asset.size || 0,
      kind,
    },
    headers: branchHeaders(branchId),
  });
  const url = res?.data?.url || res?.url;
  if (!url) throw new Error('Máy chủ không trả về đường dẫn tệp hợp đồng.');
  return {
    url,
    name: res?.data?.name || asset.name,
    mimeType: res?.data?.mimeType || asset.mimeType || 'application/octet-stream',
    size: res?.data?.size || asset.size || 0,
    uploadToken: res?.data?.uploadToken || res?.uploadToken,
  };
}

// --- 6. Phòng ban ---
export async function listHrDepartments(companyCode: string): Promise<HrDepartment[]> {
  const query = buildQuery({ companyCode });
  const res = await apiRequest<{ data?: HrDepartment[] }>(`/hr/departments${query}`);
  return (res?.data ?? []).map((d) => ({ ...d, id: d.id || d._id || d.name }));
}

export async function createHrDepartment(
  companyCode: string,
  input: { name: string; code?: string; description?: string; managerUid?: string; isActive?: boolean },
): Promise<HrDepartment> {
  const res = await apiRequest<{ data: HrDepartment }>('/hr/departments/', {
    method: 'POST',
    body: { companyCode, ...input },
  });
  return { ...res.data, id: res.data.id || res.data._id || res.data.name };
}

export async function updateHrDepartment(
  companyCode: string,
  id: string,
  input: { name: string; code?: string; description?: string; managerUid?: string; isActive?: boolean },
): Promise<HrDepartment> {
  const query = buildQuery({ companyCode });
  const res = await apiRequest<{ data: HrDepartment }>(
    `/hr/departments/${encodeURIComponent(id)}${query}`,
    {
      method: 'PATCH',
      body: { companyCode, ...input },
    },
  );
  return { ...res.data, id: res.data.id || res.data._id || id };
}

export async function deleteHrDepartment(companyCode: string, id: string): Promise<void> {
  const query = buildQuery({ companyCode });
  await apiRequest(`/hr/departments/${encodeURIComponent(id)}${query}`, {
    method: 'DELETE',
  });
}

// --- 6b. Chi nhánh ---
export async function getHrCurrentIp(): Promise<string> {
  const res = await apiRequest<{ data?: { ip?: string }; ip?: string }>('/auth/current-ip');
  return String(res?.data?.ip ?? res?.ip ?? '').trim();
}

export async function listHrBranches(): Promise<HrBranch[]> {
  const res = await apiRequest<{ data?: HrBranch[]; branches?: HrBranch[] } | HrBranch[]>(
    '/auth/branches',
  );
  return Array.isArray(res) ? res : (res?.data ?? res?.branches ?? []);
}

export async function createHrBranch(input: {
  code: string;
  name: string;
  address?: string;
  phone?: string;
  managerId?: string;
  locationConfig?: HrBranch['locationConfig'];
  isActive?: boolean;
}): Promise<HrBranch> {
  const res = await apiRequest<{ data: HrBranch }>('/auth/branches', {
    method: 'POST',
    body: input,
  });
  return res.data;
}

export async function updateHrBranch(
  branchId: string,
  input: {
    code?: string;
    name?: string;
    address?: string;
    phone?: string;
    managerId?: string;
    locationConfig?: HrBranch['locationConfig'];
    isActive?: boolean;
  },
): Promise<HrBranch> {
  const res = await apiRequest<{ data: HrBranch }>(
    `/auth/branches/${encodeURIComponent(branchId)}`,
    {
      method: 'PATCH',
      body: input,
    },
  );
  return res.data;
}

export async function createHrBranchOwner(
  branchId: string,
  input: {
    displayName: string;
    email: string;
    password: string;
    phone?: string;
    qualification?: string;
  },
): Promise<void> {
  await apiRequest(`/auth/branches/${encodeURIComponent(branchId)}/owner`, {
    method: 'POST',
    body: input,
  });
}

// --- 7. Tuyển dụng ---
export async function listRecruitmentJobs(branchId?: string): Promise<HrRecruitmentJob[]> {
  const res = await apiRequest<{ data?: Array<HrRecruitmentJob & { _id?: string }> }>(
    '/recruitment/jobs',
    { headers: branchHeaders(branchId) },
  );
  const list = Array.isArray(res) ? res : (res?.data ?? []);
  return list.map((j) => ({ ...j, id: j._id || j.id }));
}

export async function createRecruitmentJob(
  payload: Record<string, unknown>,
  branchId?: string,
): Promise<HrRecruitmentJob> {
  const res = await apiRequest<{ data: HrRecruitmentJob & { _id?: string } }>('/recruitment/jobs', {
    method: 'POST',
    body: payload,
    headers: branchHeaders(branchId),
  });
  return { ...res.data, id: res.data._id || res.data.id };
}

export async function updateRecruitmentJob(
  jobId: string,
  payload: Record<string, unknown> & { version: number },
  branchId?: string,
): Promise<HrRecruitmentJob> {
  const res = await apiRequest<{ data: HrRecruitmentJob & { _id?: string } }>(
    `/recruitment/jobs/${encodeURIComponent(jobId)}`,
    { method: 'PATCH', body: payload, headers: branchHeaders(branchId) },
  );
  return { ...res.data, id: res.data._id || res.data.id };
}

export async function changeRecruitmentJobStatus(
  jobId: string,
  version: number,
  status: string,
  branchId?: string,
): Promise<HrRecruitmentJob> {
  const res = await apiRequest<{ data: HrRecruitmentJob & { _id?: string } }>(
    `/recruitment/jobs/${encodeURIComponent(jobId)}/status`,
    { method: 'POST', body: { version, status }, headers: branchHeaders(branchId) },
  );
  return { ...res.data, id: res.data._id || res.data.id };
}

export async function deleteRecruitmentJob(
  jobId: string,
  version: number,
  branchId?: string,
): Promise<void> {
  await apiRequest(`/recruitment/jobs/${encodeURIComponent(jobId)}/delete`, {
    method: 'POST',
    body: { version },
    headers: branchHeaders(branchId),
  });
}

export async function getRecruitmentPipeline(branchId?: string): Promise<HrRecruitmentPipeline | null> {
  try {
    const res = await apiRequest<{ data?: HrRecruitmentPipeline } | HrRecruitmentPipeline>(
      '/recruitment/pipeline',
      { headers: branchHeaders(branchId) },
    );
    const data = res && 'data' in res ? res.data : res;
    return data && 'stages' in data ? (data as HrRecruitmentPipeline) : null;
  } catch {
    return null;
  }
}

export async function listRecruitmentApplicants(
  branchId?: string,
): Promise<HrRecruitmentApplicant[]> {
  const res = await apiRequest<{ data?: Array<HrRecruitmentApplicant & { _id?: string }> }>(
    '/recruitment/applicants',
    { headers: branchHeaders(branchId) },
  );
  const list = Array.isArray(res) ? res : (res?.data ?? []);
  return list.map((a) => ({ ...a, id: a._id || a.id }));
}

export async function createRecruitmentApplicant(
  payload: Record<string, unknown>,
  branchId?: string,
): Promise<HrRecruitmentApplicant> {
  const res = await apiRequest<{ data: HrRecruitmentApplicant & { _id?: string } }>(
    '/recruitment/applicants',
    { method: 'POST', body: payload, headers: branchHeaders(branchId) },
  );
  return { ...res.data, id: res.data._id || res.data.id };
}

export async function updateRecruitmentApplicant(
  applicantId: string,
  payload: Record<string, unknown> & { version: number },
  branchId?: string,
): Promise<HrRecruitmentApplicant> {
  const res = await apiRequest<{ data: HrRecruitmentApplicant & { _id?: string } }>(
    `/recruitment/applicants/${encodeURIComponent(applicantId)}`,
    { method: 'PATCH', body: payload, headers: branchHeaders(branchId) },
  );
  return { ...res.data, id: res.data._id || res.data.id };
}

export async function deleteRecruitmentApplicant(
  applicantId: string,
  version: number,
  branchId?: string,
): Promise<void> {
  await apiRequest(`/recruitment/applicants/${encodeURIComponent(applicantId)}/delete`, {
    method: 'POST',
    body: { version },
    headers: branchHeaders(branchId),
  });
}

export async function transitionRecruitmentApplicant(
  applicantId: string,
  version: number,
  stageId: string,
  note = '',
  branchId?: string,
): Promise<HrRecruitmentApplicant> {
  const res = await apiRequest<{ data: HrRecruitmentApplicant & { _id?: string } }>(
    `/recruitment/applicants/${encodeURIComponent(applicantId)}/transition`,
    { method: 'POST', body: { version, stageId, note }, headers: branchHeaders(branchId) },
  );
  return { ...res.data, id: res.data._id || res.data.id };
}

export async function listRecruitmentApplicantHistory(
  applicantId: string,
): Promise<HrRecruitmentHistory[]> {
  const res = await apiRequest<{ data?: HrRecruitmentHistory[] } | HrRecruitmentHistory[]>(
    `/recruitment/applicants/${encodeURIComponent(applicantId)}/history`,
  );
  return Array.isArray(res) ? res : (res?.data ?? []);
}

export async function listRecruitmentInterviews(branchId?: string): Promise<HrRecruitmentInterview[]> {
  const res = await apiRequest<{ data?: Array<HrRecruitmentInterview & { _id?: string }> }>(
    '/recruitment/interviews',
    { headers: branchHeaders(branchId) },
  );
  const list = Array.isArray(res) ? res : (res?.data ?? []);
  return list.map((iv) => ({ ...iv, id: iv._id || iv.id }));
}

export async function createRecruitmentInterview(
  payload: Record<string, unknown>,
  branchId?: string,
): Promise<HrRecruitmentInterview> {
  const res = await apiRequest<{ data: HrRecruitmentInterview & { _id?: string } }>(
    '/recruitment/interviews',
    { method: 'POST', body: payload, headers: branchHeaders(branchId) },
  );
  return { ...res.data, id: res.data._id || res.data.id };
}

export async function updateRecruitmentInterview(
  interviewId: string,
  payload: Record<string, unknown> & { version: number },
  branchId?: string,
): Promise<HrRecruitmentInterview> {
  const res = await apiRequest<{ data: HrRecruitmentInterview & { _id?: string } }>(
    `/recruitment/interviews/${encodeURIComponent(interviewId)}`,
    { method: 'PATCH', body: payload, headers: branchHeaders(branchId) },
  );
  return { ...res.data, id: res.data._id || res.data.id };
}

export async function deleteRecruitmentInterview(
  interviewId: string,
  version: number,
  branchId?: string,
): Promise<void> {
  await apiRequest(`/recruitment/interviews/${encodeURIComponent(interviewId)}/delete`, {
    method: 'POST',
    body: { version },
    headers: branchHeaders(branchId),
  });
}

// --- 8. Đào tạo ---
export async function listTrainingCourses(companyCode?: string): Promise<HrTrainingCourse[]> {
  const query = buildQuery({ companyCode });
  const res = await apiRequest<{ data?: Array<HrTrainingCourse & { _id?: string }> }>(
    `/crud/training-courses${query}`,
  );
  return (res?.data ?? []).map((c) => ({ ...c, id: c._id || c.id }));
}

export async function createTrainingCourse(
  payload: Partial<HrTrainingCourse> & { title: string; companyCode: string; icon: string },
): Promise<HrTrainingCourse> {
  const res = await apiRequest<{ data: HrTrainingCourse & { _id?: string } }>(
    '/crud/training-courses',
    {
      method: 'POST',
      body: {
        ...payload,
        createdAt: new Date().toISOString(),
      },
    },
  );
  return { ...res.data, id: res.data._id || res.data.id };
}

export async function updateTrainingCourse(
  courseId: string,
  payload: Partial<HrTrainingCourse>,
): Promise<HrTrainingCourse> {
  const res = await apiRequest<{ data: HrTrainingCourse & { _id?: string } }>(
    `/crud/training-courses/${encodeURIComponent(courseId)}`,
    {
      method: 'PATCH',
      body: payload,
    },
  );
  return { ...res.data, id: res.data._id || res.data.id };
}

export async function deleteTrainingCourse(courseId: string): Promise<void> {
  await apiRequest(`/crud/training-courses/${encodeURIComponent(courseId)}`, {
    method: 'DELETE',
  });
}

export async function listTrainingEnrollments(params: {
  uid?: string;
  companyCode?: string;
}): Promise<HrTrainingEnrollment[]> {
  const query = buildQuery(params);
  const res = await apiRequest<{ data?: Array<HrTrainingEnrollment & { _id?: string }> }>(
    `/crud/training-enrollments${query}`,
  );
  return (res?.data ?? []).map((e) => ({ ...e, id: e._id || e.id }));
}

export async function createTrainingEnrollment(payload: {
  courseId: string;
  courseTitle: string;
  uid: string;
  userName: string;
  companyCode?: string;
}): Promise<HrTrainingEnrollment> {
  const now = new Date().toISOString();
  const res = await apiRequest<{ data: HrTrainingEnrollment & { _id?: string } }>(
    '/crud/training-enrollments',
    {
      method: 'POST',
      body: {
        ...payload,
        progress: 0,
        status: 'in_progress',
        startedAt: now,
        createdAt: now,
        completedLessons: [],
        quizPassed: false,
      },
    },
  );
  return { ...res.data, id: res.data._id || res.data.id };
}

async function retryTrainingUpdateOnGatewayFailure<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (error) {
    if (!(error instanceof ApiError) || ![502, 503, 504].includes(error.status)) throw error;
    // Enrollment updates are idempotent, so retry once after a transient ERP proxy failure.
    await new Promise((resolve) => setTimeout(resolve, 700));
    return request();
  }
}

export async function updateTrainingEnrollment(
  enrollmentId: string,
  payload: Partial<HrTrainingEnrollment>,
): Promise<HrTrainingEnrollment> {
  const res = await retryTrainingUpdateOnGatewayFailure(() =>
    apiRequest<{ data: HrTrainingEnrollment & { _id?: string } }>(
      `/crud/training-enrollments/${encodeURIComponent(enrollmentId)}`,
      {
        method: 'PATCH',
        body: payload,
      },
    ),
  );
  return { ...res.data, id: res.data._id || res.data.id };
}

// --- 9. Quy trình ---
export async function listHrWorkflows(companyCode?: string): Promise<HrWorkflow[]> {
  const query = buildQuery({ companyCode });
  const res = await apiRequest<{ data?: Array<HrWorkflow & { _id?: string }> }>(
    `/crud/workflows${query}`,
  );
  return (res?.data ?? []).map((w) => ({ ...w, id: w._id || w.id }));
}

export async function createHrWorkflow(payload: {
  companyCode: string;
  creatorUid: string;
  name: string;
  category?: string;
  description?: string;
  steps: HrWorkflow['steps'];
}): Promise<HrWorkflow> {
  const res = await apiRequest<{ data: HrWorkflow & { _id?: string } }>('/crud/workflows', {
    method: 'POST',
    body: {
      ...payload,
      title: payload.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  });
  return { ...res.data, id: res.data._id || res.data.id };
}

export async function updateHrWorkflow(
  workflowId: string,
  payload: Partial<HrWorkflow>,
): Promise<HrWorkflow> {
  const res = await apiRequest<{ data: HrWorkflow & { _id?: string } }>(
    `/crud/workflows/${encodeURIComponent(workflowId)}`,
    {
      method: 'PATCH',
      body: {
        ...payload,
        updatedAt: new Date().toISOString(),
      },
    },
  );
  return { ...res.data, id: res.data._id || res.data.id };
}

export async function deleteHrWorkflow(workflowId: string): Promise<void> {
  await apiRequest(`/crud/workflows/${encodeURIComponent(workflowId)}`, {
    method: 'DELETE',
  });
}

// --- 10. Bảng lương / Phiếu lương ---
export async function listMyPayslips(branchId?: string): Promise<HrPayslip[]> {
  const res = await apiRequest<{ data?: HrPayslip[] } | HrPayslip[]>(
    '/payroll/employee/me/payslips',
    { headers: branchHeaders(branchId) },
  );
  return Array.isArray(res) ? res : (res?.data ?? []);
}

export async function requestMyPayslipReview(runId: string, message: string, branchId?: string): Promise<void> {
  await apiRequest(`/payroll/employee/me/payslips/${encodeURIComponent(runId)}/review-requests`, {
    method: 'POST',
    body: { message },
    headers: branchHeaders(branchId),
  });
}

export async function getPayrollRun(
  periodKey: string,
  branchId?: string,
): Promise<HrPayrollRun | null> {
  try {
    const res = await apiRequest<{ data?: HrPayrollRun } | HrPayrollRun>(
      `/payroll/periods/${encodeURIComponent(periodKey)}/run`,
      { headers: branchHeaders(branchId) },
    );
    const data = res && 'data' in res ? res.data : res;
    return data && '_id' in data ? (data as HrPayrollRun) : null;
  } catch (error) {
    const details = error instanceof ApiError && typeof error.details === 'object' && error.details !== null
      ? error.details as { code?: unknown }
      : undefined;
    if (error instanceof ApiError && error.status === 404 && details?.code === 'PAYROLL_RUN_NOT_FOUND') {
      return null;
    }
    throw error;
  }
}

export async function getPayrollPeriodResults(
  periodKey: string,
  branchId?: string,
): Promise<HrPayslip[]> {
  const res = await apiRequest<{ data?: HrPayslip[] | { lines?: HrPayslip[] } }>(
    `/payroll/periods/${encodeURIComponent(periodKey)}/results`,
    { headers: branchHeaders(branchId) },
  );
  if (Array.isArray(res?.data)) return res.data;
  if (res?.data && 'lines' in res.data && Array.isArray(res.data.lines)) return res.data.lines;
  return [];
}

export async function getPayrollMonthlyKpi(
  periodKey: string,
  branchId?: string,
): Promise<Record<string, number | null>> {
  try {
    const res = await apiRequest<{
      data?: { rows?: Array<{ employeeId: string; percent?: number | null }> };
      rows?: Array<{ employeeId: string; percent?: number | null }>;
    }>(`/payroll/periods/${encodeURIComponent(periodKey)}/kpi`, {
      headers: branchHeaders(branchId),
    });
    const rows = res?.data?.rows ?? res?.rows ?? [];
    const map: Record<string, number | null> = {};
    for (const r of rows) {
      map[String(r.employeeId)] = typeof r.percent === 'number' ? r.percent : null;
    }
    return map;
  } catch {
    return {};
  }
}

export async function processPayrollPeriod(periodKey: string, branchId?: string): Promise<void> {
  try {
    await apiRequest(`/payroll/periods/${encodeURIComponent(periodKey)}/process`, {
      method: 'POST',
      body: {},
      headers: branchHeaders(branchId),
    });
  } catch (error) {
    const details = error instanceof ApiError && typeof error.details === 'object' && error.details !== null
      ? error.details as { code?: unknown; stage?: unknown }
      : undefined;
    if (
      !(error instanceof ApiError)
      || error.status !== 409
      || details?.code !== 'PAYROLL_PROCESSING_FAILED'
      || details.stage !== 'sync_attendance'
    ) {
      throw error;
    }

    // The attendance snapshot is already locked, so calculate from it without syncing it again.
    await apiRequest(`/payroll/periods/${encodeURIComponent(periodKey)}/run`, {
      method: 'POST',
      body: {},
      headers: branchHeaders(branchId),
    });
  }
}

export async function calculatePayrollRun(runId: string, expectedVersion: number, branchId?: string): Promise<void> {
  await apiRequest(`/payroll/runs/${encodeURIComponent(runId)}/calculate`, {
    method: 'POST',
    body: { expectedVersion },
    headers: payrollOperationHeaders(runId, expectedVersion, branchId),
  });
}

export async function reviewPayrollPeriod(periodKey: string, branchId?: string): Promise<void> {
  await apiRequest(`/payroll/periods/${encodeURIComponent(periodKey)}/approve`, {
    method: 'POST',
    body: {},
    headers: branchHeaders(branchId),
  });
}

export async function closePayrollPeriod(periodKey: string, branchId?: string): Promise<void> {
  await apiRequest(`/payroll/periods/${encodeURIComponent(periodKey)}/close`, {
    method: 'POST',
    body: {},
    headers: branchHeaders(branchId),
  });
}

export async function reviewPayrollRun(
  runId: string,
  expectedVersion: number,
  branchId?: string,
): Promise<void> {
  await apiRequest(`/payroll/runs/${encodeURIComponent(runId)}/review`, {
    method: 'POST',
    body: { expectedVersion },
    headers: branchHeaders(branchId),
  });
}

export async function closePayrollRun(
  runId: string,
  expectedVersion: number,
  branchId?: string,
): Promise<void> {
  await apiRequest(`/payroll/runs/${encodeURIComponent(runId)}/close`, {
    method: 'POST',
    body: { expectedVersion },
    headers: branchHeaders(branchId),
  });
}

export async function markPayrollRunPaid(
  runId: string,
  expectedVersion: number,
  branchId?: string,
): Promise<void> {
  await apiRequest(`/payroll/runs/${encodeURIComponent(runId)}/mark-paid`, {
    method: 'POST',
    body: { expectedVersion },
    headers: branchHeaders(branchId),
  });
}

export async function reopenPayrollRun(
  runId: string,
  expectedVersion: number,
  reason: string,
  branchId?: string,
): Promise<void> {
  await apiRequest(`/payroll/runs/${encodeURIComponent(runId)}/reopen`, {
    method: 'POST',
    body: { expectedVersion, reason },
    headers: branchHeaders(branchId),
  });
}

export async function publishPayrollPayslips(runId: string, branchId?: string): Promise<void> {
  await apiRequest(`/payroll/runs/${encodeURIComponent(runId)}/payslips/publish`, {
    method: 'POST',
    body: {},
    headers: branchHeaders(branchId),
  });
}

export async function listPayrollAdjustments(
  periodKey: string,
  branchId?: string,
): Promise<HrPayrollAdjustment[]> {
  const res = await apiRequest<{ data?: HrPayrollAdjustment[] } | HrPayrollAdjustment[]>(
    `/payroll/periods/${encodeURIComponent(periodKey)}/adjustments`,
    { headers: branchHeaders(branchId) },
  );
  return Array.isArray(res) ? res : (res?.data ?? []);
}

export async function createPayrollAdjustment(
  periodKey: string,
  payload: { employeeId: string; kind: string; amount: number; reason: string },
  branchId?: string,
): Promise<void> {
  await apiRequest(`/payroll/periods/${encodeURIComponent(periodKey)}/adjustments`, {
    method: 'POST',
    body: payload,
    headers: branchHeaders(branchId),
  });
}

export async function approvePayrollAdjustment(
  periodKey: string,
  adjustmentId: string,
  branchId?: string,
): Promise<void> {
  await apiRequest(
    `/payroll/periods/${encodeURIComponent(periodKey)}/adjustments/${encodeURIComponent(adjustmentId)}/approve`,
    { method: 'POST', body: {}, headers: branchHeaders(branchId) },
  );
}

export async function rejectPayrollAdjustment(
  periodKey: string,
  adjustmentId: string,
  branchId?: string,
): Promise<void> {
  await apiRequest(
    `/payroll/periods/${encodeURIComponent(periodKey)}/adjustments/${encodeURIComponent(adjustmentId)}/reject`,
    { method: 'POST', body: {}, headers: branchHeaders(branchId) },
  );
}

export async function listPayrollPolicies(branchId?: string): Promise<HrPayrollPolicy[]> {
  const res = await apiRequest<{ data?: HrPayrollPolicy[] } | HrPayrollPolicy[]>(
    '/payroll/policies',
    { headers: branchHeaders(branchId) },
  );
  return Array.isArray(res) ? res : (res?.data ?? []);
}

