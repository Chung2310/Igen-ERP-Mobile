import { apiRequest } from '@/core/network/apiClient';
import type {
  ChatAttachment,
  ChatColleague,
  ChatMessage,
  ChatRoom,
} from '@/features/chat/types';

export async function getChatRooms(signal?: AbortSignal): Promise<ChatRoom[]> {
  const res = await apiRequest<{ data?: ChatRoom[] }>('/chat/rooms', { signal });
  return res?.data ?? [];
}

export async function getChatRoomById(roomId: string, signal?: AbortSignal): Promise<ChatRoom> {
  const res = await apiRequest<{ data: ChatRoom }>(`/chat/rooms/${encodeURIComponent(roomId)}`, {
    signal,
  });
  return res.data;
}

export async function createChatRoom(payload: {
  isGroup: boolean;
  memberIds: string[];
  name?: string;
}): Promise<ChatRoom> {
  const res = await apiRequest<{ data: ChatRoom }>('/chat/rooms', {
    method: 'POST',
    body: payload,
  });
  return res.data;
}

export async function getChatMessages(
  roomId: string,
  limit = 40,
  beforeDate?: string,
  signal?: AbortSignal,
): Promise<ChatMessage[]> {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (beforeDate) qs.set('beforeDate', beforeDate);
  const res = await apiRequest<{ data?: ChatMessage[] }>(
    `/chat/rooms/${encodeURIComponent(roomId)}/messages?${qs.toString()}`,
    { signal },
  );
  return res?.data ?? [];
}

export async function sendChatMessage(
  roomId: string,
  content: string,
  options: { attachments?: ChatAttachment[]; replyTo?: string } = {},
): Promise<ChatMessage> {
  const res = await apiRequest<{ data: ChatMessage }>(
    `/chat/rooms/${encodeURIComponent(roomId)}/messages`,
    {
      method: 'POST',
      body: {
        content,
        attachments: options.attachments,
        replyTo: options.replyTo,
      },
    },
  );
  return res.data;
}

export async function markChatRoomAsRead(roomId: string): Promise<void> {
  try {
    await apiRequest(`/chat/rooms/${encodeURIComponent(roomId)}/read`, {
      method: 'POST',
    });
  } catch {
    // Non-blocking: server read marker failure should not break chat UI.
  }
}

export async function togglePinChatRoom(roomId: string): Promise<ChatRoom> {
  const res = await apiRequest<{ data: ChatRoom }>(
    `/chat/rooms/${encodeURIComponent(roomId)}/toggle-pin`,
    { method: 'POST' },
  );
  return res.data;
}

export async function deleteChatMessage(roomId: string, messageId: string): Promise<ChatMessage> {
  const res = await apiRequest<{ data: ChatMessage }>(
    `/chat/rooms/${encodeURIComponent(roomId)}/messages/${encodeURIComponent(messageId)}`,
    { method: 'DELETE' },
  );
  return res.data;
}

export async function reactToChatMessage(
  roomId: string,
  messageId: string,
  emoji: string,
): Promise<ChatMessage> {
  const res = await apiRequest<{ data: ChatMessage }>(
    `/chat/rooms/${encodeURIComponent(roomId)}/messages/${encodeURIComponent(messageId)}/react`,
    {
      method: 'POST',
      body: { emoji },
    },
  );
  return res.data;
}

export async function getChatColleagues(signal?: AbortSignal): Promise<ChatColleague[]> {
  const res = await apiRequest<{ data?: ChatColleague[]; users?: ChatColleague[] }>(
    '/auth/users/colleagues',
    { signal },
  );
  return res?.data ?? res?.users ?? [];
}

