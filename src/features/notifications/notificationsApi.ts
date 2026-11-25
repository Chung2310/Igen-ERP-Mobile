import { DeviceEventEmitter } from 'react-native';
import { apiRequest } from '@/core/network/apiClient';

export type NotificationType = 'kho' | 'task' | 'training' | 'he-thong';

export type UserNotification = {
  _id: string;
  title: string;
  body: string;
  type: NotificationType;
  companyCode: string;
  recipientUid: string;
  read: boolean;
  action?: { tab: string; subTab?: string };
  createdAt: string;
};

export type UserNotificationPage = {
  status: string;
  data: UserNotification[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
};

const unreadCountEvent = 'user-notifications-unread-count-changed';

export function emitUnreadNotificationCount(count: number) {
  DeviceEventEmitter.emit(unreadCountEvent, Math.max(0, count));
}

export function subscribeUnreadNotificationCount(listener: (count: number) => void) {
  return DeviceEventEmitter.addListener(unreadCountEvent, listener);
}

export async function getUserNotifications(params: {
  page?: number;
  limit?: number;
  read?: boolean;
  type?: NotificationType;
} = {}): Promise<UserNotificationPage> {
  const query = new URLSearchParams();
  if (params.page != null) query.set('page', String(params.page));
  if (params.limit != null) query.set('limit', String(params.limit));
  if (params.read != null) query.set('read', String(params.read));
  if (params.type) query.set('type', params.type);
  const queryString = query.toString();
  const suffix = queryString ? `?${queryString}` : '';
  return apiRequest<UserNotificationPage>(`/notifications${suffix}`);
}

export async function markUserNotificationRead(id: string): Promise<UserNotification> {
  const response = await apiRequest<{ data: UserNotification }>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' });
  return response.data;
}

export async function markAllUserNotificationsRead(): Promise<void> {
  await apiRequest('/notifications/read-all', { method: 'PATCH' });
}

export async function deleteUserNotification(id: string): Promise<void> {
  await apiRequest(`/notifications/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
