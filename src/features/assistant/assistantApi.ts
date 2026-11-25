import { apiRequest } from '@/core/network/apiClient';
import type {
  AgentChatMessage,
  AssistantChartHistoryItem,
  AssistantConversationPage,
  AssistantConversationState,
  AssistantMemory,
  AssistantProject,
  AssistantPromptTemplate,
  AssistantReply,
  AssistantSettings,
  AssistantSlideHistoryItem,
  AssistantStudioTranscript,
  AssistantTurnInput,
  AssistantWorkflow,
  UserAssistantAgent,
} from '@/features/assistant/types';

type AssistantScope = {
  branchId?: string;
  signal?: AbortSignal;
};

function scopeHeaders(branchId?: string): Record<string, string> | undefined {
  return branchId ? { 'x-branch-id': branchId } : undefined;
}

/** Tạo UUID v4 hợp lệ cho conversationId, requestId, agentId, projectId (tương thích Hermes/RN). */
export function generateUuidV4(): string {
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// --- Core Chat Turns & Conversations ---
export async function listAssistantConversations(
  search?: string,
  options: AssistantScope = {},
): Promise<AssistantConversationPage> {
  const qs = new URLSearchParams({ limit: '30' });
  if (search?.trim()) qs.set('search', search.trim());
  const res = await apiRequest<{ success?: boolean; data?: AssistantConversationPage }>(
    `/chatbot/assistant/conversations?${qs.toString()}`,
    { headers: scopeHeaders(options.branchId), signal: options.signal },
  );
  return res?.data ?? { items: [], nextCursor: null };
}

export async function getAssistantConversationState(
  conversationId: string,
  options: AssistantScope = {},
): Promise<AssistantConversationState> {
  const res = await apiRequest<{ success?: boolean; data?: AssistantConversationState }>(
    `/chatbot/assistant/conversations/${encodeURIComponent(conversationId)}`,
    { headers: scopeHeaders(options.branchId), signal: options.signal },
  );
  return res?.data ?? { messages: [], lastReply: null, busy: false };
}

export async function deleteAssistantConversation(
  conversationId: string,
  options: AssistantScope = {},
): Promise<void> {
  await apiRequest(`/chatbot/assistant/conversations/${encodeURIComponent(conversationId)}`, {
    method: 'DELETE',
    headers: scopeHeaders(options.branchId),
    signal: options.signal,
  });
}

export async function sendAssistantTurn(
  input: AssistantTurnInput,
  options: AssistantScope = {},
): Promise<AssistantReply> {
  const res = await apiRequest<{ success?: boolean; data?: AssistantReply; message?: string }>(
    '/chatbot/assistant/turns',
    {
      method: 'POST',
      body: input,
      headers: scopeHeaders(options.branchId),
      signal: options.signal,
    },
  );
  if (!res?.data) {
    throw new Error(res?.message || 'Trợ lý ERP không trả về phản hồi.');
  }
  return res.data;
}

// --- Custom AI Agents (/chatbot/agents) ---
export async function listAssistantAgents(signal?: AbortSignal): Promise<UserAssistantAgent[]> {
  const res = await apiRequest<{ data?: { agents?: UserAssistantAgent[] } }>('/chatbot/agents', {
    signal,
  });
  return res?.data?.agents ?? [];
}

export async function createAssistantAgent(agent: UserAssistantAgent): Promise<UserAssistantAgent> {
  const res = await apiRequest<{ data: UserAssistantAgent }>('/chatbot/agents', {
    method: 'POST',
    body: agent,
  });
  return res.data;
}

export async function updateAssistantAgent(
  agentId: string,
  agent: Omit<UserAssistantAgent, 'id'>,
): Promise<UserAssistantAgent> {
  const res = await apiRequest<{ data: UserAssistantAgent }>(
    `/chatbot/agents/${encodeURIComponent(agentId)}`,
    { method: 'PUT', body: agent },
  );
  return res.data;
}

export async function extractAssistantAgentLink(url: string): Promise<{ title: string; text: string }> {
  const res = await apiRequest<{ data?: { title?: string; text?: string } }>(
    '/chatbot/agents/extract-link',
    { method: 'POST', body: { url } },
  );
  return { title: res?.data?.title || url, text: res?.data?.text || '' };
}

export async function extractAssistantAgentFile(asset: {
  uri: string;
  name: string;
  mimeType?: string | null;
}): Promise<{ fileName: string; text: string }> {
  const form = new FormData();
  form.append('file', {
    uri: asset.uri,
    name: asset.name,
    type: asset.mimeType || 'application/octet-stream',
  } as unknown as Blob);
  const res = await apiRequest<{ data?: { fileName?: string; text?: string } }>(
    '/chatbot/agents/extract',
    { method: 'POST', body: form },
  );
  return { fileName: res?.data?.fileName || asset.name, text: res?.data?.text || '' };
}

export async function setAssistantAgentFavorite(
  agentId: string,
  favorite: boolean,
): Promise<UserAssistantAgent> {
  const res = await apiRequest<{ data: UserAssistantAgent }>(
    `/chatbot/agents/${encodeURIComponent(agentId)}/favorite`,
    { method: 'PATCH', body: { favorite } },
  );
  return res.data;
}

export async function deleteAssistantAgent(agentId: string): Promise<void> {
  await apiRequest(`/chatbot/agents/${encodeURIComponent(agentId)}`, { method: 'DELETE' });
}

export async function chatWithAssistantAgent(
  agent: UserAssistantAgent,
  messages: AgentChatMessage[],
): Promise<string> {
  const res = await apiRequest<{ data?: { reply?: string } }>('/chatbot/agents/chat', {
    method: 'POST',
    body: {
      instructions: agent.instructions,
      avoid: agent.avoid || '',
      tone: agent.tone || 'Tự động',
      knowledge: (agent.knowledge ?? []).map(({ title, kind, content }) => ({
        title,
        kind,
        content,
      })),
      messages: messages.slice(-20),
    },
  });
  return res?.data?.reply || 'Trợ lý chưa có phản hồi.';
}

// --- Projects (/chatbot/assistant/projects) ---
export async function listAssistantProjects(
  options: AssistantScope = {},
): Promise<AssistantProject[]> {
  const res = await apiRequest<{ data?: AssistantProject[] }>('/chatbot/assistant/projects', {
    headers: scopeHeaders(options.branchId),
    signal: options.signal,
  });
  return res?.data ?? [];
}

export async function saveAssistantProjects(
  projects: AssistantProject[],
  options: AssistantScope = {},
): Promise<AssistantProject[]> {
  const res = await apiRequest<{ data?: AssistantProject[] }>('/chatbot/assistant/projects', {
    method: 'PUT',
    body: { projects },
    headers: scopeHeaders(options.branchId),
    signal: options.signal,
  });
  return res?.data ?? projects;
}

export async function uploadAssistantProjectFile(
  projectId: string,
  asset: { uri: string; name: string; mimeType?: string | null },
  options: AssistantScope = {},
): Promise<AssistantProject['files'][number]> {
  const form = new FormData();
  form.append('file', {
    uri: asset.uri,
    name: asset.name,
    type: asset.mimeType || 'application/octet-stream',
  } as unknown as Blob);
  const res = await apiRequest<{ data: AssistantProject['files'][number] }>(
    `/chatbot/assistant/projects/${encodeURIComponent(projectId)}/files`,
    { method: 'POST', body: form, headers: scopeHeaders(options.branchId), signal: options.signal },
  );
  return res.data;
}

export async function downloadAssistantProjectFile(
  projectId: string,
  fileId: string,
  options: AssistantScope = {},
): Promise<Blob> {
  return apiRequest<Blob>(
    `/chatbot/assistant/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}`,
    { responseType: 'blob', headers: scopeHeaders(options.branchId), signal: options.signal },
  );
}

// --- Prompt Library (/chatbot/assistant/prompt-templates) ---
export async function listPromptTemplates(
  signal?: AbortSignal,
): Promise<{ templates: AssistantPromptTemplate[]; favoriteIds: string[] }> {
  const res = await apiRequest<{
    data?: { templates?: AssistantPromptTemplate[]; favoriteIds?: string[] };
  }>('/chatbot/assistant/prompt-templates', { signal });
  return {
    templates: res?.data?.templates ?? [],
    favoriteIds: res?.data?.favoriteIds ?? [],
  };
}

export async function createPromptTemplate(
  data: Omit<AssistantPromptTemplate, 'id' | 'owner'>,
): Promise<AssistantPromptTemplate> {
  const res = await apiRequest<{ data: AssistantPromptTemplate }>(
    '/chatbot/assistant/prompt-templates',
    { method: 'POST', body: data },
  );
  return res.data;
}

export async function togglePromptTemplateFavorite(
  id: string,
  favorite: boolean,
): Promise<boolean> {
  const res = await apiRequest<{ data?: { favorite?: boolean } }>(
    `/chatbot/assistant/prompt-templates/${encodeURIComponent(id)}/favorite`,
    { method: 'PATCH', body: { favorite } },
  );
  return Boolean(res?.data?.favorite);
}

// --- Memory (/chatbot/assistant/memory) ---
export async function listAssistantMemories(signal?: AbortSignal): Promise<AssistantMemory[]> {
  const res = await apiRequest<{ data?: AssistantMemory[] }>('/chatbot/assistant/memory', {
    signal,
  });
  return res?.data ?? [];
}

export async function createAssistantMemory(content: string): Promise<AssistantMemory> {
  const res = await apiRequest<{ data: { item: AssistantMemory } }>('/chatbot/assistant/memory', {
    method: 'POST',
    body: { content },
  });
  return res.data.item;
}

export async function updateAssistantMemory(id: string, content: string): Promise<AssistantMemory> {
  const res = await apiRequest<{ data: AssistantMemory }>(
    `/chatbot/assistant/memory/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: { content } },
  );
  return res.data;
}

export async function deleteAssistantMemory(id: string): Promise<void> {
  await apiRequest(`/chatbot/assistant/memory/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// --- Workflows (/chatbot/assistant/workflows) ---
export async function listAssistantWorkflows(signal?: AbortSignal): Promise<AssistantWorkflow[]> {
  const res = await apiRequest<{ data?: AssistantWorkflow[] }>('/chatbot/assistant/workflows', {
    signal,
  });
  return res?.data ?? [];
}

export async function saveAssistantWorkflow(
  workflow: AssistantWorkflow,
): Promise<AssistantWorkflow> {
  const res = await apiRequest<{ data: AssistantWorkflow }>(
    `/chatbot/assistant/workflows/${encodeURIComponent(workflow.actionId)}`,
    {
      method: 'PATCH',
      body: {
        version: workflow.version,
        enabled: workflow.enabled,
        instructions: workflow.instructions,
        requireConfirmation: workflow.requireConfirmation,
        fields: workflow.fields.map((f) => ({
          key: f.key,
          required: Boolean(f.required),
          ...(f.defaultValue !== undefined ? { defaultValue: f.defaultValue } : {}),
        })),
      },
    },
  );
  return res.data;
}

export async function interpretAssistantWorkflow(
  actionId: string,
  version: number,
  text: string,
): Promise<AssistantWorkflow> {
  const res = await apiRequest<{ data: AssistantWorkflow }>(
    `/chatbot/assistant/workflows/${encodeURIComponent(actionId)}/interpret`,
    { method: 'POST', body: { version, text } },
  );
  return res.data;
}

export async function resetAssistantWorkflow(actionId: string, version: number): Promise<AssistantWorkflow> {
  const res = await apiRequest<{ data: AssistantWorkflow }>(
    `/chatbot/assistant/workflows/${encodeURIComponent(actionId)}/reset`,
    { method: 'POST', body: { version } },
  );
  return res.data;
}

// --- Settings (/chatbot/assistant/settings) ---
export async function getAssistantSettings(signal?: AbortSignal): Promise<AssistantSettings> {
  const res = await apiRequest<{ data: AssistantSettings }>('/chatbot/assistant/settings', {
    signal,
  });
  return res.data;
}

export async function saveAssistantSettings(
  settings: AssistantSettings,
): Promise<AssistantSettings> {
  const res = await apiRequest<{ data: AssistantSettings }>('/chatbot/assistant/settings', {
    method: 'PATCH',
    body: settings,
  });
  return res.data;
}

// --- Studio (/chatbot/assistant/studio/*) ---
export async function listStudioAssets(signal?: AbortSignal): Promise<{
  slides: AssistantSlideHistoryItem[];
  charts: AssistantChartHistoryItem[];
  transcripts: AssistantStudioTranscript[];
}> {
  const [slidesRes, chartsRes, transRes] = await Promise.allSettled([
    apiRequest<{ data?: AssistantSlideHistoryItem[] }>('/chatbot/assistant/studio/slides', {
      signal,
    }),
    apiRequest<{ data?: AssistantChartHistoryItem[] }>('/chatbot/assistant/studio/charts', {
      signal,
    }),
    apiRequest<{ data?: AssistantStudioTranscript[] }>(
      '/chatbot/assistant/studio/transcriptions',
      { signal },
    ),
  ]);
  return {
    slides: slidesRes.status === 'fulfilled' ? (slidesRes.value?.data ?? []) : [],
    charts: chartsRes.status === 'fulfilled' ? (chartsRes.value?.data ?? []) : [],
    transcripts: transRes.status === 'fulfilled' ? (transRes.value?.data ?? []) : [],
  };
}

export async function createStudioSlideDeck(input: {
  prompt: string;
  pageCount: number;
  style: 'rewrite' | 'preserve' | 'shorten';
  file?: { uri: string; name: string; mimeType?: string | null };
}): Promise<{ id: string; title?: string }> {
  if (input.file) {
    const form = new FormData();
    form.append('prompt', input.prompt);
    form.append('pageCount', String(input.pageCount));
    form.append('style', input.style);
    form.append('document', {
      uri: input.file.uri,
      name: input.file.name,
      type: input.file.mimeType || 'application/octet-stream',
    } as unknown as Blob);
    const res = await apiRequest<{ data: { id: string; title?: string } }>(
      '/chatbot/assistant/studio/slides',
      { method: 'POST', body: form },
    );
    return res.data;
  }
  const res = await apiRequest<{ data: { id: string; title?: string } }>(
    '/chatbot/assistant/studio/slides',
    { method: 'POST', body: input },
  );
  return res.data;
}

export async function createStudioMindmap(input: {
  prompt: string;
  sourceType: 'text' | 'document';
  file?: { uri: string; name: string; mimeType?: string | null };
  locale?: 'vi' | 'en' | 'ja';
  writeMode?: 'ai' | 'preserve';
}): Promise<{ id?: string; title?: string }> {
  const form = new FormData();
  form.append('sourceType', input.sourceType);
  form.append('prompt', input.prompt);
  form.append('locale', input.locale || 'vi');
  form.append('writeMode', input.writeMode || 'ai');
  if (input.file) {
    form.append('document', {
      uri: input.file.uri,
      name: input.file.name,
      type: input.file.mimeType || 'application/octet-stream',
    } as unknown as Blob);
  }
  const res = await apiRequest<{ data?: { id?: string; title?: string } }>(
    '/chatbot/assistant/studio/mindmaps',
    { method: 'POST', body: form },
  );
  return res?.data ?? {};
}

export async function createStudioChart(input: {
  file: { uri: string; name: string; mimeType?: string | null };
  prompt: string;
  chartType: string;
}): Promise<{ id?: string; title?: string }> {
  const form = new FormData();
  form.append('file', {
    uri: input.file.uri,
    name: input.file.name,
    type: input.file.mimeType || 'application/octet-stream',
  } as unknown as Blob);
  form.append('prompt', input.prompt);
  form.append('chartType', input.chartType);
  const res = await apiRequest<{ data?: { id?: string; title?: string } }>(
    '/chatbot/assistant/studio/charts',
    { method: 'POST', body: form },
  );
  return res?.data ?? {};
}

export async function transcribeStudioAudio(asset: {
  uri: string;
  name: string;
  mimeType?: string | null;
}): Promise<AssistantStudioTranscript> {
  const form = new FormData();
  form.append('audio', {
    uri: asset.uri,
    name: asset.name,
    type: asset.mimeType || 'audio/mpeg',
  } as unknown as Blob);
  const res = await apiRequest<{ data: AssistantStudioTranscript }>(
    '/chatbot/assistant/studio/transcriptions',
    { method: 'POST', body: form },
  );
  return res.data;
}

export async function createStudioImages(input: {
  prompt: string;
  aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '3:2' | '2:3';
  count: number;
  referenceImage?: string;
}): Promise<{ images: Array<{ url: string }>; model?: string; aspectRatio?: string }> {
  const res = await apiRequest<{ data?: { images?: Array<{ url: string }>; model?: string; aspectRatio?: string } }>(
    '/chatbot/assistant/studio/images',
    { method: 'POST', body: input },
  );
  return { images: res?.data?.images ?? [], model: res?.data?.model, aspectRatio: res?.data?.aspectRatio };
}

export async function editStudioImage(input: {
  sourceImage: string;
  prompt: string;
  mode: 'custom' | 'erase' | 'remove-background' | 'change-background' | 'enhance';
}): Promise<{ image: { url: string }; model?: string }> {
  const res = await apiRequest<{ data?: { image?: { url?: string }; model?: string } }>(
    '/chatbot/assistant/studio/images/edit',
    { method: 'POST', body: input },
  );
  if (!res?.data?.image?.url) throw new Error('Trợ lý chưa trả về ảnh đã chỉnh sửa.');
  return { image: { url: res.data.image.url }, model: res.data.model };
}

export async function createStudioSpeech(input: { text: string; voice?: string }): Promise<Blob> {
  return apiRequest<Blob>('/chatbot/assistant/speech', {
    method: 'POST',
    body: input,
    responseType: 'blob',
  });
}
