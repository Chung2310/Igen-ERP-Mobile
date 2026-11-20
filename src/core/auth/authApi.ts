import { apiRequest } from '@/core/network/apiClient';
import { clearAccessToken, saveAccessToken } from '@/core/auth/authSession';

export type ErpUser = {
  _id?: string;
  id?: string;
  displayName: string;
  email: string;
  role: string;
  companyCode?: string;
  companyName?: string;
  branchId?: string;
  branchName?: string;
  businessType?: string;
  photoURL?: string;
  enabledModules?: string[];
  permissions?: string[];
};

type LoginResponse = {
  status: 'success' | 'challenge_required' | 'error';
  message?: string;
  accessToken?: string;
  user?: ErpUser;
  challengeId?: string;
};

type MeResponse = { status: string; user: ErpUser };

export type ErpHealth = {
  status: string;
  services?: { server?: string; database?: string };
};

export async function checkErpConnection() {
  return apiRequest<ErpHealth>('/health', { skipAuth: true, skipRefresh: true });
}

export async function signInToErp(email: string, password: string) {
  const result = await apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { email: email.trim(), password },
    skipAuth: true,
    skipRefresh: true,
  });

  if (result.status === 'challenge_required') {
    throw new Error('Tài khoản cần bước xác thực bổ sung. Hiện ứng dụng mobile chưa hỗ trợ bước này.');
  }
  if (!result.accessToken) throw new Error(result.message || 'ERP không trả về access token.');

  await saveAccessToken(result.accessToken);
  try {
    return await getCurrentErpUser();
  } catch (error) {
    await clearAccessToken();
    throw error;
  }
}

export async function getCurrentErpUser() {
  const result = await apiRequest<MeResponse>('/auth/me');
  return result.user;
}

export async function signOutFromErp() {
  try {
    await apiRequest('/auth/logout', { method: 'POST', skipRefresh: true });
  } finally {
    await clearAccessToken();
  }
}
