export type AssistantMode = 'work' | 'qa';

export type AssistantModuleTab =
  | 'chat'
  | 'agents'
  | 'projects'
  | 'prompts'
  | 'studio'
  | 'settings';

export type AssistantValue = string | number | boolean;

export type AssistantGeneratedFile = {
  id: string;
  documentId: string;
  conversationId: string;
  version: number;
  fileName: string;
  format: string;
  mimeType: string;
  size: number;
};

export type AssistantSource = {
  title: string;
  url: string;
};

export type AssistantReferenceSelection = {
  key: string;
  label: string;
  required: boolean;
  multiple: boolean;
  options: Array<{ label: string; value: string }>;
};

export type AssistantPendingAction = {
  id: string;
  title: string;
  requiresPassword?: boolean;
  values: Array<{ label: string; value: AssistantValue; defaulted?: boolean }>;
};

export type AssistantReply = {
  reply: string;
  status:
    | 'collecting'
    | 'confirmation'
    | 'completed'
    | 'cancelled'
    | 'unsupported'
    | 'failed'
    | 'processing'
    | 'uncertain';
  action?: AssistantPendingAction;
  referenceSelections?: AssistantReferenceSelection[];
  files?: AssistantGeneratedFile[];
  sources?: AssistantSource[];
  link?: string;
};

export type AssistantChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
  files?: AssistantGeneratedFile[];
  sources?: AssistantSource[];
};

export type AssistantConversationSummary = {
  conversationId: string;
  mode?: AssistantMode;
  title: string;
  preview: string;
  messageCount: number;
  updatedAt: string;
};

export type AssistantConversationPage = {
  items: AssistantConversationSummary[];
  nextCursor: { before: string; beforeId: string } | null;
};

export type AssistantConversationState = {
  messages: AssistantChatMessage[];
  lastReply: AssistantReply | null;
  busy: boolean;
  mode?: AssistantMode;
  requestId?: string;
};

export type AssistantTurnInput = {
  conversationId: string;
  requestId: string;
  projectId?: string;
  mode?: AssistantMode;
  text?: string;
  referenceSelections?: Record<string, string[]>;
  decision?: { id: string; confirmed: boolean; password?: string };
};

// --- Custom Agents (/chatbot/agents) ---
export type AgentKnowledge = {
  id?: string;
  title: string;
  kind: 'text' | 'link' | 'file';
  content: string;
  createdAt?: string;
};

export type UserAssistantAgent = {
  id: string;
  name: string;
  description: string;
  instructions: string;
  avoid: string;
  tone: string;
  avatar: number;
  favorite: boolean;
  openingQuestions: string[];
  knowledge: Array<AgentKnowledge & { id: string; createdAt: string }>;
};

export type AgentChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

// --- Projects (/chatbot/assistant/projects) ---
export type AssistantProject = {
  id: string;
  name: string;
  icon: string;
  tone: 'primary' | 'secondary' | 'tertiary' | 'error';
  favorite: boolean;
  instructions: string;
  model: 'iGenAI';
  conversations: Array<{
    id: string;
    title: string;
    preview: string;
    createdAt: string;
    updatedAt?: string;
    sourceConversationId?: string;
    sourceMode?: AssistantMode;
  }>;
  files: Array<{
    id: string;
    name: string;
    size: number;
    updatedAt: string;
  }>;
  createdAt: string;
};

// --- Prompt Library (/chatbot/assistant/prompt-templates) ---
export type AssistantPromptTemplate = {
  id: string;
  title: string;
  description: string;
  category: string;
  prompt: string;
  owner: 'igen' | 'user';
};

// --- Memory (/chatbot/assistant/memory) ---
export type AssistantMemory = {
  id: string;
  content: string;
  source?: 'explicit' | 'manual' | 'automatic';
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string | null;
};

// --- Workflows (/chatbot/assistant/workflows) ---
export type AssistantWorkflow = {
  actionId: string;
  title: string;
  module: string;
  description: string;
  fields: Array<{ key: string; label: string; required?: boolean; defaultValue?: AssistantValue }>;
  enabled: boolean;
  instructions: string;
  requireConfirmation: boolean;
  confirmationLocked: boolean;
  version: number;
};

// --- Settings (/chatbot/assistant/settings) ---
export type AssistantSettings = {
  version: number;
  windowMode: 'window' | 'fullscreen';
  enterToSend: boolean;
  showSuggestions: boolean;
  instructions: string;
  responseRules: string;
  alwaysConfirm: boolean;
  speakReplies: boolean;
  speechVoice: string;
  wakeWordEnabled: boolean;
  memoryEnabled: boolean;
  autoMemoryEnabled: boolean;
};

// --- Studio (/chatbot/assistant/studio/*) ---
export type AssistantSlideHistoryItem = {
  id: string;
  title: string;
  pageCount?: number;
  style?: string;
  createdAt: string;
};

export type AssistantChartHistoryItem = {
  id: string;
  title: string;
  chartType?: string;
  createdAt: string;
};

export type AssistantStudioTranscript = {
  id: string;
  fileName: string;
  text: string;
  createdAt: string;
};
