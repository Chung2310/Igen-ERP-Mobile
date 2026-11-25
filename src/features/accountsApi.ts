import { apiRequest } from '@/core/network/apiClient';

export type ManagedAccount = {
  _id?: string;
  id?: string;
  uid?: string;
  displayName: string;
  email: string;
  phone?: string;
  department?: string;
  role: string;
  companyCode?: string;
  companyName?: string;
  branchId?: string;
  branchName?: string;
  photoURL?: string;
  enabledModules?: string[];
  permissions?: string[];
  isActive?: boolean;
  status?: string;
  createdAt?: string;
};

type AccountEnvelope = {
  data?: unknown;
  users?: ManagedAccount[];
  items?: ManagedAccount[];
};

function accountList(response: AccountEnvelope | ManagedAccount[]): ManagedAccount[] {
  if (Array.isArray(response)) return normalize(response);
  if (Array.isArray(response.data)) return normalize(response.data as ManagedAccount[]);
  if (response.data && typeof response.data === 'object') {
    const nested = response.data as { users?: ManagedAccount[]; items?: ManagedAccount[] };
    return normalize(nested.users ?? nested.items ?? []);
  }
  return normalize(response.users ?? response.items ?? []);
}

function normalize(rows: ManagedAccount[]) {
  return rows.map((account) => ({
    ...account,
    id: account._id || account.uid || account.id,
    uid: account.uid || account._id || account.id,
  }));
}

export async function listManagedAccounts(companyCode?: string, branchId?: string) {
  const query = new URLSearchParams();
  if (companyCode) query.set('companyCode', companyCode);
  if (branchId) query.set('branchId', branchId);
  const queryString = query.toString();
  const headers = branchId ? { 'x-branch-id': branchId } : undefined;
  const response = await apiRequest<AccountEnvelope | ManagedAccount[]>(
    `/auth/users${queryString ? `?${queryString}` : ''}`,
    { headers },
  );
  return accountList(response);
}

export type CreateManagedAccount = Pick<ManagedAccount, 'displayName' | 'email' | 'role'> & {
  password: string;
  companyCode: string;
  companyName?: string;
  branchId?: string;
  phone?: string;
  department?: string;
  enabledModules?: string[];
  permissions?: string[];
};

export async function createManagedAccount(payload: CreateManagedAccount) {
  const response = await apiRequest<{ data?: { _id?: string; id?: string }; user?: ManagedAccount }>(
    '/auth/register-user',
    {
      method: 'POST',
      body: payload,
      headers: payload.branchId ? { 'x-branch-id': payload.branchId } : undefined,
    },
  );
  return response.user ?? response.data;
}

export type UpdateManagedAccount = Pick<ManagedAccount, 'displayName' | 'role'> & {
  phone: string;
  department: string;
  enabledModules?: string[];
  permissions?: string[];
};

export async function updateManagedAccount(id: string, payload: UpdateManagedAccount, branchId?: string) {
  await apiRequest(`/auth/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: payload,
    headers: branchId ? { 'x-branch-id': branchId } : undefined,
  });
}

export async function deleteManagedAccount(id: string) {
  await apiRequest(`/auth/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
