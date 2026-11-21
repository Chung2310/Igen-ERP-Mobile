export type ChatAttachment = {
  url: string;
  name: string;
  type: string;
  size?: number;
  uploadToken?: string;
};

export type ChatSenderObj = {
  _id: string;
  displayName: string;
  photoURL?: string;
  email?: string;
};

export type ChatMessage = {
  _id: string;
  roomId: string;
  senderId: string | ChatSenderObj;
  senderName: string;
  senderPhoto?: string;
  content: string;
  attachments?: ChatAttachment[];
  readBy: string[];
  reactions?: Array<{ emoji: string; userId: string }>;
  replyTo?: ChatMessage | string | null;
  isDeleted?: boolean;
  editedAt?: string | null;
  createdAt: string;
};

export type ChatRoomMember = {
  userId: {
    _id: string;
    uid?: string;
    displayName: string;
    photoURL?: string;
    email?: string;
    role?: string;
    status?: 'online' | 'offline';
  };
  role: 'admin' | 'deputy' | 'member';
  joinedAt: string;
  isPinned?: boolean;
};

export type ChatRoom = {
  _id: string;
  name?: string;
  isGroup: boolean;
  companyCode: string;
  creatorId: string;
  members: ChatRoomMember[];
  lastMessage?: ChatMessage;
  avatarURL?: string;
  isChatbot?: boolean;
  unreadCount?: number;
  onlyAdminsCanMessage?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ChatColleague = {
  _id?: string;
  id?: string;
  uid?: string;
  displayName: string;
  email?: string;
  role?: string;
  photoURL?: string;
};

