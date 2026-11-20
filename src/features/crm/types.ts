export type ConversationChannel = 'Zalo' | 'Facebook' | 'Instagram' | 'Web chat';
export type ConversationMode = 'ai' | 'human';

export type CrmMessage = {
  id: string;
  sender: 'customer' | 'staff' | 'ai';
  text: string;
  time: string;
};

export type CrmConversation = {
  id: string;
  contactName: string;
  initials: string;
  channel: ConversationChannel;
  channelColor: string;
  lastMessage: string;
  updatedAt: string;
  unreadCount: number;
  assignedTo: string | null;
  mode: ConversationMode;
  messages: CrmMessage[];
};

export type CrmLead = {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  source: string;
  status: 'Mới' | 'Đang chăm sóc' | 'Đủ điều kiện';
  createdAt: string;
};

export type CrmLeadDraft = Pick<CrmLead, 'name' | 'company' | 'phone' | 'email'>;
