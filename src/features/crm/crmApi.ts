import { apiRequest } from '@/core/network/apiClient';
import type { ConversationChannel, CrmConversation, CrmLead, CrmLeadDraft, CrmMessage } from '@/features/crm/types';

type ApiRecord = Record<string, unknown>;
type ChannelKey = 'facebook' | 'zalo' | 'tiktok';

const channelLabels: Record<ChannelKey, ConversationChannel> = { facebook: 'Facebook', zalo: 'Zalo', tiktok: 'TikTok' };
const channelColors: Record<ChannelKey, string> = { facebook: '#EAF2FF', zalo: '#E9F8F1', tiktok: '#F1EBFF' };

function isRecord(value: unknown): value is ApiRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(record: ApiRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
}

function numberValue(record: ApiRecord, key: string) {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0;
}

function recordsFrom(payload: unknown, key?: string): ApiRecord[] {
  if (!isRecord(payload)) return [];
  const root = key && isRecord(payload[key]) ? payload[key] as ApiRecord : payload;
  const data = root.data;
  if (Array.isArray(data)) return data.filter(isRecord);
  if (isRecord(data) && Array.isArray(data.items)) return data.items.filter(isRecord);
  if (key && Array.isArray(root[key])) return (root[key] as unknown[]).filter(isRecord);
  if (Array.isArray(root.documents)) return root.documents.filter(isRecord);
  return [];
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(-2).map((part) => part[0]?.toLocaleUpperCase('vi')).join('') || '?';
}

function displayTime(value: unknown) {
  if (typeof value !== 'string' && !(value instanceof Date)) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }).format(date);
}

function timestampValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function mapConversation(raw: ApiRecord, channel: ChannelKey): CrmConversation {
  const backendId = stringValue(raw, '_id', 'id', 'conversationId');
  const contactName = stringValue(raw, 'senderName', 'contactName', 'name') || `Khách hàng ${channelLabels[channel]}`;
  const accountId = channel === 'facebook'
    ? stringValue(raw, 'pageId', 'accountId')
    : channel === 'zalo'
      ? stringValue(raw, 'oaId', 'accountId')
      : stringValue(raw, 'businessAccountId', 'accountId');
  const lastMessageAt = raw.lastMessageAt ?? raw.updatedAt;
  const pausedUntil = stringValue(raw, 'aiPausedUntil');
  const mode = pausedUntil && new Date(pausedUntil).getTime() > Date.now() ? 'human' : 'ai';
  return {
    id: `${channel}:${backendId}`,
    backendId,
    accountId: accountId || undefined,
    contactName,
    initials: initials(contactName),
    channel: channelLabels[channel],
    channelColor: channelColors[channel],
    recipientId: stringValue(raw, 'recipientId', 'openId') || undefined,
    lastMessage: stringValue(raw, 'lastMessageText') || 'Chưa có tin nhắn',
    updatedAt: displayTime(lastMessageAt),
    updatedAtTimestamp: timestampValue(lastMessageAt),
    unreadCount: numberValue(raw, 'unreadCount'),
    assignedTo: null,
    mode,
    messages: [],
  };
}

function mapMessage(raw: ApiRecord, index: number): CrmMessage {
  const direction = stringValue(raw, 'direction');
  const senderType = stringValue(raw, 'senderType');
  const sender = direction === 'inbound' ? 'customer' : senderType === 'ai' ? 'ai' : 'staff';
  return {
    id: stringValue(raw, '_id', 'id', 'messageId') || `message-${index}`,
    sender,
    text: stringValue(raw, 'text', 'content') || 'Tệp đính kèm',
    time: displayTime(raw.timestamp ?? raw.createdAt),
  };
}

function mapLead(raw: ApiRecord): CrmLead {
  const apiStatus = stringValue(raw, 'status').toLowerCase();
  const status: CrmLead['status'] = ['hot', 'won', 'upsell', 'qualified', 'converted'].includes(apiStatus)
    ? 'Đủ điều kiện'
    : ['warm', 'contacted', 'working'].includes(apiStatus) ? 'Đang chăm sóc' : 'Mới';
  const source = stringValue(raw, 'sourcePlatform', 'source', 'channel');
  return {
    id: stringValue(raw, '_id', 'id'),
    name: stringValue(raw, 'customerName', 'name') || 'Chưa có tên',
    company: stringValue(raw, 'company'),
    phone: stringValue(raw, 'phone'),
    email: stringValue(raw, 'email'),
    source: source || 'Nhập thủ công',
    status,
    createdAt: displayTime(raw.createdAt) || 'Vừa tạo',
  };
}

const conversationEndpoints: { channel: ChannelKey; path: string }[] = [
  { channel: 'facebook', path: '/facebook/messenger/conversations?limit=100' },
  { channel: 'zalo', path: '/zalo/conversations?limit=100' },
  { channel: 'tiktok', path: '/tiktok/messenger/conversations?limit=100' },
];

async function fetchConversations() {
  const results = await Promise.all(conversationEndpoints.map(async (endpoint) => ({
    ...endpoint,
    payload: await apiRequest<unknown>(endpoint.path),
  })).map((request) => request.catch((error: unknown) => ({ error }))));

  const conversations: CrmConversation[] = [];
  const unavailableChannels: string[] = [];
  for (let index = 0; index < results.length; index++) {
    const result = results[index];
    const endpoint = conversationEndpoints[index];
    if (isRecord(result) && 'error' in result) {
      unavailableChannels.push(channelLabels[endpoint.channel]);
      continue;
    }
    const payload = isRecord(result) ? result.payload : undefined;
    conversations.push(...recordsFrom(payload).map((record) => mapConversation(record, endpoint.channel)));
  }

  if (unavailableChannels.length === conversationEndpoints.length) {
    throw new Error('Không tải được hộp thư ERP. Kiểm tra quyền omni-inbox và kết nối API.');
  }
  conversations.sort((a, b) => (b.updatedAtTimestamp ?? 0) - (a.updatedAtTimestamp ?? 0));
  return { conversations, unavailableChannels };
}

async function fetchLeads() {
  const payload = await apiRequest<unknown>('/omni-inbox/leads?limit=100');
  return recordsFrom(payload).map(mapLead);
}

export async function loadCrmWorkspace() {
  const [conversationResult, leadResult] = await Promise.allSettled([fetchConversations(), fetchLeads()]);
  if (conversationResult.status === 'rejected' && leadResult.status === 'rejected') {
    const error = leadResult.reason ?? conversationResult.reason;
    throw error instanceof Error ? error : new Error('Không tải được dữ liệu CRM từ ERP.');
  }
  return {
    conversations: conversationResult.status === 'fulfilled' ? conversationResult.value.conversations : [],
    unavailableChannels: conversationResult.status === 'fulfilled' ? conversationResult.value.unavailableChannels : ['Hộp thư'],
    leads: leadResult.status === 'fulfilled' ? leadResult.value : [],
    leadsUnavailable: leadResult.status === 'rejected',
  };
}

function conversationPath(conversation: CrmConversation, action: 'messages' | 'mark-read' | 'resume-ai') {
  if (!conversation.backendId) throw new Error('Hội thoại này chưa có mã ERP.');
  const id = encodeURIComponent(conversation.backendId);
  const accountQuery = conversation.accountId ? `?accountId=${encodeURIComponent(conversation.accountId)}` : '';
  if (conversation.channel === 'Facebook') {
    const pageQuery = conversation.accountId ? `?pageId=${encodeURIComponent(conversation.accountId)}` : '';
    return `/facebook/messenger/conversations/${id}/${action}${pageQuery}`;
  }
  if (conversation.channel === 'Zalo') return `/zalo/conversations/${id}/${action}${accountQuery}`;
  if (conversation.channel === 'TikTok') return `/tiktok/messenger/conversations/${id}/${action}${accountQuery}`;
  throw new Error('Kênh hội thoại này chưa được kết nối ERP.');
}

export async function loadConversationMessages(conversation: CrmConversation) {
  const payload = await apiRequest<unknown>(conversationPath(conversation, 'messages'));
  return recordsFrom(payload).map(mapMessage);
}

export async function markConversationRead(conversation: CrmConversation) {
  return apiRequest(conversationPath(conversation, 'mark-read'), { method: 'POST' });
}

export async function resumeConversationAI(conversation: CrmConversation) {
  return apiRequest(conversationPath(conversation, 'resume-ai'), { method: 'POST' });
}

export async function sendConversationReply(conversation: CrmConversation, text: string) {
  const id = conversation.backendId;
  if (!id) throw new Error('Hội thoại này chưa có mã ERP.');
  if (conversation.channel === 'Facebook') {
    return apiRequest('/facebook/messenger/reply', { method: 'POST', body: { conversationId: id, recipientId: conversation.recipientId || id, text, pageId: conversation.accountId } });
  }
  if (conversation.channel === 'Zalo') {
    return apiRequest('/zalo/reply', { method: 'POST', body: { conversationId: id, recipientId: conversation.recipientId || id, text, accountId: conversation.accountId } });
  }
  if (conversation.channel === 'TikTok') {
    return apiRequest('/tiktok/messenger/reply', { method: 'POST', body: { conversationId: id, recipientId: conversation.recipientId || id, text, accountId: conversation.accountId } });
  }
  throw new Error('Kênh hội thoại này chưa được kết nối ERP.');
}

export async function createErpLead(draft: CrmLeadDraft) {
  const payload = await apiRequest<unknown>('/omni-inbox/leads', {
    method: 'POST',
    body: {
      customerName: draft.name.trim(),
      company: draft.company.trim(),
      value: 0,
      phone: draft.phone.trim(),
      avatar: initials(draft.name),
      email: draft.email.trim(),
      productOfChoice: '',
      status: 'cold',
      lastInteraction: 'Tạo từ ứng dụng ERP Mobile',
    },
  });
  const raw = isRecord(payload) && isRecord(payload.data) ? payload.data : isRecord(payload) ? payload : {};
  return mapLead(raw);
}
