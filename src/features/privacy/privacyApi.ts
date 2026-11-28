import { apiRequest } from '@/core/network/apiClient';
import type { AiDisclosure } from '@/core/network/aiConsentPrompt';
const data = async <T>(path: string, options?: Parameters<typeof apiRequest>[1]) => (await apiRequest<{ data: T }>(`/privacy${path}`, options)).data;
export const privacyApi = {
  disclosure: () => data<AiDisclosure>('/ai-disclosures'),
  consent: () => data<{ accepted: boolean; version: string }>('/ai-consents'),
  accept: (version: string) => data('/ai-consents', { method: 'POST', body: { version, accepted: true } }),
  revoke: () => data('/ai-consents', { method: 'DELETE' }),
  blocks: () => data<Array<{ userId: string; displayName: string }>>('/chat/blocks'),
  block: (userId: string) => data(`/chat/blocks/${encodeURIComponent(userId)}`, { method: 'PUT' }),
  unblock: (userId: string) => data(`/chat/blocks/${encodeURIComponent(userId)}`, { method: 'DELETE' }),
  report: (body: { roomId: string; messageId: string; reason: string; note: string }) => data('/chat/reports', { method: 'POST', body }),
  deletionPreview: () => data<{ deleted: string; retained: string; processing: string; requiresSuccessor: boolean; successors: Array<{ id: string; displayName: string }> }>('/account-deletion/preview'),
  requestDeletion: (password: string, successorId?: string) => data<{ id: string; status: string }>('/account-deletion/requests', { method: 'POST', body: { password, successorId, confirmed: true } }),
  deletionReviews: () => data<Array<{ _id: string; status: string; requestedAt: string; dueAt: string; completedAt?: string; requestedAtLabel: string; dueAtLabel: string; storageReviewItems: string[] }>>('/account-deletion/reviews'),
  completeDeletionReview: (id: string, note: string) => data(`/account-deletion/reviews/${id}`, { method: 'PATCH', body: { storageReviewed: true, businessRetentionReviewed: true, backupsReviewed: true, note } }),
  reports: () => data<Array<{ id: string; reason: string; note: string; status: string; resolution: string; createdAt: string; createdAtLabel: string; message?: { content: string; senderName: string } }>>('/chat/moderation/reports'),
  resolveReport: (id: string, action: 'hide' | 'dismiss', resolution: string) => data(`/chat/moderation/reports/${id}`, { method: 'PATCH', body: { action, resolution } }),
};
