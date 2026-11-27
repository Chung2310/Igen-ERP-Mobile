import { CenteredPageLoader } from '@/components/BrandLoader';
import { IgenEmptyState } from '@/components/EmptyStateIllustration';
import { PopupError } from '@/components/PopupError';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ArrowLeft, Check, Hand, Heart, Paperclip, Pin, Plus, Search, Smile, ThumbsUp, X } from 'lucide-react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/core/auth/AuthProvider';
import {
  createChatRoom,
  deleteChatMessage,
  getChatColleagues,
  getChatMessages,
  getChatRooms,
  markChatRoomAsRead,
  reactToChatMessage,
  sendChatMessage,
  togglePinChatRoom,
} from '@/features/chat/chatApi';
import type { ChatColleague, ChatMessage, ChatRoom } from '@/features/chat/types';
import { colors } from '@/theme/colors';

type RoomFilter = 'all' | 'unread' | 'group';

const AVATAR_TONES = ['#E9F1FF', '#F1EBFF', '#FFF1E5', '#E9F8F1', '#E8F7FA', '#FCEBEC'];
const QUICK_REACTIONS = [
  { emoji: '👍', Icon: ThumbsUp },
  { emoji: '❤️', Icon: Heart },
  { emoji: '😂', Icon: Smile },
  { emoji: '👏', Icon: Hand },
];

function getUserId(user: { _id?: string; id?: string } | null): string {
  return user?._id || user?.id || '';
}

function getSenderId(msg: ChatMessage): string {
  return typeof msg.senderId === 'string' ? msg.senderId : msg.senderId?._id || '';
}

function getInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(-2)
      .map((part) => part[0]?.toLocaleUpperCase('vi'))
      .join('') || 'NV'
  );
}

function getRoomDisplayName(room: ChatRoom, myId: string): string {
  if (room.isGroup) return room.name?.trim() || 'Nhóm trò chuyện';
  const peer = room.members.find((m) => m.userId?._id && m.userId._id !== myId);
  return peer?.userId?.displayName || room.name || 'Đồng nghiệp';
}

function isRoomPinned(room: ChatRoom, myId: string): boolean {
  const me = room.members.find((m) => m.userId?._id === myId);
  return Boolean(me?.isPinned);
}

function formatMessageTime(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatLastMessagePreview(room: ChatRoom): string {
  const msg = room.lastMessage;
  if (!msg) return 'Chưa có tin nhắn nào';
  if (msg.isDeleted) return 'Tin nhắn đã được thu hồi';
  const prefix = room.isGroup && msg.senderName ? `${msg.senderName}: ` : '';
  if (msg.content?.trim()) return `${prefix}${msg.content.trim()}`;
  if (msg.attachments?.length) return `${prefix}[${msg.attachments.length} tệp đính kèm]`;
  return 'Tin nhắn mới';
}

export function InternalChatScreen({ embedded = false }: { embedded?: boolean } = {}) {
  const { user } = useAuth();
  const myId = getUserId(user);

  // --- Room list state ---
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsRefreshing, setRoomsRefreshing] = useState(false);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const [filter, setFilter] = useState<RoomFilter>('all');
  const [search, setSearch] = useState('');

  // --- Active room (thread) state ---
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [actionMessage, setActionMessage] = useState<ChatMessage | null>(null);

  // --- New chat modal state ---
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [colleagues, setColleagues] = useState<ChatColleague[]>([]);
  const [colleaguesLoading, setColleaguesLoading] = useState(false);
  const [colleagueSearch, setColleagueSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [creatingRoom, setCreatingRoom] = useState(false);

  const listRef = useRef<FlatList<ChatMessage>>(null);

  const loadRooms = useCallback(async (silent = false) => {
    if (!silent) setRoomsLoading(true);
    setRoomsError(null);
    try {
      const data = await getChatRooms();
      const nonBot = data.filter((r) => !r.isChatbot);
      setRooms(nonBot);
    } catch (err) {
      setRoomsError(err instanceof Error ? err.message : 'Không thể tải danh sách hội thoại.');
    } finally {
      setRoomsLoading(false);
      setRoomsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  // Auto-refresh room list every 15s while on the list view
  useEffect(() => {
    if (activeRoom) return;
    const timer = setInterval(() => {
      void loadRooms(true);
    }, 15_000);
    return () => clearInterval(timer);
  }, [activeRoom, loadRooms]);

  const loadMessages = useCallback(async (roomId: string, silent = false) => {
    if (!silent) setMessagesLoading(true);
    setMessagesError(null);
    try {
      const list = await getChatMessages(roomId, 40);
      setMessages(list);
      setHasOlder(list.length >= 40);
    } catch (err) {
      if (!silent) {
        setMessagesError(err instanceof Error ? err.message : 'Không thể tải lịch sử tin nhắn.');
      }
    } finally {
      if (!silent) setMessagesLoading(false);
    }
  }, []);

  const openRoom = useCallback(
    (room: ChatRoom) => {
      setActiveRoom(room);
      setMessages([]);
      setReplyTo(null);
      setDraft('');
      setHasOlder(false);
      void loadMessages(room._id);
      if ((room.unreadCount ?? 0) > 0) {
        void markChatRoomAsRead(room._id);
        setRooms((prev) =>
          prev.map((r) => (r._id === room._id ? { ...r, unreadCount: 0 } : r)),
        );
      }
    },
    [loadMessages],
  );

  // Poll active room every 5s for new messages
  useEffect(() => {
    if (!activeRoom) return;
    const roomId = activeRoom._id;
    const timer = setInterval(() => {
      void loadMessages(roomId, true);
    }, 5_000);
    return () => clearInterval(timer);
  }, [activeRoom, loadMessages]);

  const onLoadOlder = useCallback(async () => {
    if (!activeRoom || loadingOlder || !messages.length) return;
    const oldest = messages[0]?.createdAt;
    if (!oldest) return;
    setLoadingOlder(true);
    try {
      const older = await getChatMessages(activeRoom._id, 30, oldest);
      setHasOlder(older.length >= 30);
      if (older.length > 0) {
        setMessages((prev) => {
          const existing = new Set(prev.map((m) => m._id));
          const unique = older.filter((m) => !existing.has(m._id));
          return [...unique, ...prev];
        });
      }
    } catch {
      // Ignore silent pagination failure
    } finally {
      setLoadingOlder(false);
    }
  }, [activeRoom, loadingOlder, messages]);

  const onSend = useCallback(async () => {
    if (!activeRoom || sending) return;
    const content = draft.trim();
    if (!content) return;

    setSending(true);
    try {
      const created = await sendChatMessage(activeRoom._id, content, {
        replyTo: replyTo?._id,
      });
      setDraft('');
      setReplyTo(null);
      setMessages((prev) => (prev.some((m) => m._id === created._id) ? prev : [...prev, created]));
      setRooms((prev) =>
        prev.map((r) =>
          r._id === activeRoom._id
            ? { ...r, lastMessage: created, updatedAt: created.createdAt }
            : r,
        ),
      );
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    } catch (err) {
      Alert.alert(
        'Không gửi được tin nhắn',
        err instanceof Error ? err.message : 'Vui lòng thử lại.',
      );
    } finally {
      setSending(false);
    }
  }, [activeRoom, draft, replyTo, sending]);

  const onReact = useCallback(
    async (msg: ChatMessage, emoji: string) => {
      if (!activeRoom) return;
      setActionMessage(null);
      try {
        const updated = await reactToChatMessage(activeRoom._id, msg._id, emoji);
        setMessages((prev) => prev.map((m) => (m._id === updated._id ? updated : m)));
      } catch (err) {
        Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể thả cảm xúc.');
      }
    },
    [activeRoom],
  );

  const onRecallMessage = useCallback(
    async (msg: ChatMessage) => {
      if (!activeRoom) return;
      setActionMessage(null);
      try {
        const updated = await deleteChatMessage(activeRoom._id, msg._id);
        setMessages((prev) => prev.map((m) => (m._id === updated._id ? updated : m)));
      } catch (err) {
        Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể thu hồi tin nhắn.');
      }
    },
    [activeRoom],
  );

  const onTogglePin = useCallback(
    async (room: ChatRoom) => {
      try {
        const updated = await togglePinChatRoom(room._id);
        setRooms((prev) => prev.map((r) => (r._id === updated._id ? updated : r)));
        if (activeRoom?._id === updated._id) setActiveRoom(updated);
      } catch (err) {
        Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể ghim cuộc trò chuyện.');
      }
    },
    [activeRoom],
  );

  const openNewChatModal = useCallback(async () => {
    setNewChatOpen(true);
    setSelectedIds([]);
    setGroupName('');
    setColleagueSearch('');
    setColleaguesLoading(true);
    try {
      const list = await getChatColleagues();
      setColleagues(list.filter((c) => (c._id || c.id || c.uid) !== myId));
    } catch (err) {
      Alert.alert(
        'Không tải được danh sách đồng nghiệp',
        err instanceof Error ? err.message : 'Vui lòng thử lại.',
      );
    } finally {
      setColleaguesLoading(false);
    }
  }, [myId]);

  const toggleSelectColleague = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }, []);

  const onCreateRoom = useCallback(async () => {
    if (creatingRoom || selectedIds.length === 0) return;
    const isGroup = selectedIds.length > 1;
    if (isGroup && !groupName.trim()) {
      Alert.alert('Thiếu tên nhóm', 'Hãy nhập tên nhóm khi chọn nhiều thành viên.');
      return;
    }
    setCreatingRoom(true);
    try {
      const room = await createChatRoom({
        isGroup,
        memberIds: selectedIds,
        name: isGroup ? groupName.trim() : undefined,
      });
      setNewChatOpen(false);
      setRooms((prev) => [room, ...prev.filter((r) => r._id !== room._id)]);
      openRoom(room);
    } catch (err) {
      Alert.alert(
        'Không tạo được hội thoại',
        err instanceof Error ? err.message : 'Vui lòng thử lại.',
      );
    } finally {
      setCreatingRoom(false);
    }
  }, [creatingRoom, groupName, openRoom, selectedIds]);

  const filteredRooms = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...rooms]
      .filter((room) => {
        if (filter === 'unread' && !(room.unreadCount && room.unreadCount > 0)) return false;
        if (filter === 'group' && !room.isGroup) return false;
        if (!q) return true;
        const name = getRoomDisplayName(room, myId).toLowerCase();
        const preview = formatLastMessagePreview(room).toLowerCase();
        return name.includes(q) || preview.includes(q);
      })
      .sort((a, b) => {
        const pinDiff = Number(isRoomPinned(b, myId)) - Number(isRoomPinned(a, myId));
        if (pinDiff !== 0) return pinDiff;
        const timeA = new Date(a.lastMessage?.createdAt || a.updatedAt || 0).getTime();
        const timeB = new Date(b.lastMessage?.createdAt || b.updatedAt || 0).getTime();
        return timeB - timeA;
      });
  }, [filter, myId, rooms, search]);

  const filteredColleagues = useMemo(() => {
    const q = colleagueSearch.trim().toLowerCase();
    if (!q) return colleagues;
    return colleagues.filter(
      (c) =>
        c.displayName?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q),
    );
  }, [colleagueSearch, colleagues]);

  // --- Thread Detail View ---
  if (activeRoom) {
    const roomTitle = getRoomDisplayName(activeRoom, myId);
    const pinned = isRoomPinned(activeRoom, myId);
    const threadView = (
      <KeyboardAvoidingView
        style={styles.threadContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 84 : 0}
      >
        <View style={styles.threadHeader}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setActiveRoom(null);
              void loadRooms(true);
            }}
            style={styles.backBtn}
          >
            <ArrowLeft size={17} color={colors.primary} />
          </Pressable>
          <View style={styles.threadHeaderCopy}>
            <Text numberOfLines={1} style={styles.threadTitle}>
              {roomTitle}
            </Text>
            <Text numberOfLines={1} style={styles.threadSubtitle}>
              {activeRoom.isGroup
                ? `${activeRoom.members.length} thành viên`
                : 'Trò chuyện nội bộ'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void onTogglePin(activeRoom);
            }}
            style={styles.pinBtn}
          >
            <Text style={[styles.pinBtnText, pinned && styles.pinBtnTextActive]}>
              {pinned ? 'Đã ghim' : 'Ghim'}
            </Text>
          </Pressable>
        </View>

        {messagesLoading && !messages.length ? (
          <View style={styles.centered}>
            <CenteredPageLoader />
          </View>
        ) : messagesError && !messages.length ? (
          <View style={styles.centered}>
            <PopupError error={messagesError} />
            <Pressable
              onPress={() => {
                void loadMessages(activeRoom._id);
              }}
              style={styles.retryBtn}
            >
              <Text style={styles.retryBtnText}>Thử lại</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              hasOlder ? (
                <Pressable
                  disabled={loadingOlder}
                  onPress={() => {
                    void onLoadOlder();
                  }}
                  style={styles.loadOlderBtn}
                >
                  <Text style={styles.loadOlderText}>
                    {loadingOlder ? 'Đang tải thêm...' : 'Tải tin nhắn cũ hơn'}
                  </Text>
                </Pressable>
              ) : undefined
            }
            ListEmptyComponent={
              <Text style={styles.emptyThreadText}>
                Chưa có tin nhắn nào. Hãy bắt đầu cuộc trò chuyện!
              </Text>
            }
            renderItem={({ item }) => {
              const mine = getSenderId(item) === myId;
              const replyObj =
                item.replyTo && typeof item.replyTo === 'object' ? item.replyTo : null;
              const reactionCounts = (item.reactions ?? []).reduce<Record<string, number>>(
                (acc, r) => {
                  acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                  return acc;
                },
                {},
              );
              return (
                <Pressable
                  onLongPress={() => {
                    if (!item.isDeleted) setActionMessage(item);
                  }}
                  style={[styles.msgRow, mine && styles.msgRowMine]}
                >
                  {!mine && activeRoom.isGroup ? (
                    <Text style={styles.senderLabel}>{item.senderName}</Text>
                  ) : null}
                  <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                    {replyObj ? (
                      <View style={[styles.replyQuote, mine && styles.replyQuoteMine]}>
                        <Text
                          numberOfLines={1}
                          style={[styles.replyQuoteName, mine && styles.replyQuoteTextMine]}
                        >
                          {replyObj.senderName || 'Tin nhắn trước'}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={[styles.replyQuoteBody, mine && styles.replyQuoteTextMine]}
                        >
                          {replyObj.isDeleted ? 'Đã thu hồi' : replyObj.content || '[Tệp đính kèm]'}
                        </Text>
                      </View>
                    ) : null}

                    {item.isDeleted ? (
                      <Text style={[styles.deletedText, mine && styles.bubbleTextMine]}>
                        Tin nhắn đã được thu hồi
                      </Text>
                    ) : (
                      <>
                        {item.content ? (
                          <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>
                            {item.content}
                          </Text>
                        ) : null}
                        {item.attachments?.length ? (
                          <View style={styles.attachList}>
                            {item.attachments.map((att, idx) => (
                              <View
                                key={`${att.url}-${idx}`}
                                style={styles.attachChip}
                              >
                                <Paperclip size={13} color={mine ? colors.white : colors.primary} />
                                <Text numberOfLines={1} style={[styles.attachChipText, mine && styles.attachChipTextMine]}>{att.name || 'Tệp đính kèm'}</Text>
                              </View>
                            ))}
                          </View>
                        ) : null}
                      </>
                    )}
                    <Text style={[styles.msgTime, mine && styles.msgTimeMine]}>
                      {formatMessageTime(item.createdAt)}
                      {item.editedAt ? ' · đã sửa' : ''}
                    </Text>
                  </View>

                  {Object.keys(reactionCounts).length > 0 ? (
                    <View style={[styles.reactionRow, mine && styles.reactionRowMine]}>
                      {Object.entries(reactionCounts).map(([emoji, count]) => (
                        <Text key={emoji} style={styles.reactionPill}>
                          {emoji} {count}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </Pressable>
              );
            }}
          />
        )}

        {replyTo ? (
          <View style={styles.replyBanner}>
            <View style={styles.replyBannerCopy}>
              <Text numberOfLines={1} style={styles.replyBannerTitle}>
                Trả lời {replyTo.senderName}
              </Text>
              <Text numberOfLines={1} style={styles.replyBannerText}>
                {replyTo.content || '[Tệp đính kèm]'}
              </Text>
            </View>
            <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
              <X size={17} color={colors.muted} />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Nhập tin nhắn..."
            placeholderTextColor={colors.muted}
            multiline
            style={styles.input}
          />
          <Pressable
            accessibilityRole="button"
            disabled={sending || !draft.trim()}
            onPress={() => {
              void onSend();
            }}
            style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
          >
            {sending ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.sendBtnText}>Gửi</Text>
            )}
          </Pressable>
        </View>

        {/* Message action modal */}
        {actionMessage ? (
          <Modal
            visible
            transparent
            animationType="fade"
            onRequestClose={() => setActionMessage(null)}
          >
          <Pressable style={styles.modalBackdrop} onPress={() => setActionMessage(null)}>
            <Pressable style={styles.actionSheet} onPress={() => { }}>
              {actionMessage ? (
                <>
                  <View style={styles.emojiBar}>
                    {QUICK_REACTIONS.map(({ emoji, Icon }) => (
                      <Pressable
                        key={emoji}
                        onPress={() => {
                          void onReact(actionMessage, emoji);
                        }}
                        style={styles.emojiBtn}
                      >
                        <Icon size={18} color={emoji === '❤️' ? '#E5484D' : colors.primary} />
                      </Pressable>
                    ))}
                  </View>
                  <Pressable
                    onPress={() => {
                      setReplyTo(actionMessage);
                      setActionMessage(null);
                    }}
                    style={styles.actionRow}
                  >
                    <Text style={styles.actionRowText}>Trả lời tin nhắn</Text>
                  </Pressable>
                  {getSenderId(actionMessage) === myId ? (
                    <Pressable
                      onPress={() => {
                        void onRecallMessage(actionMessage);
                      }}
                      style={styles.actionRow}
                    >
                      <Text style={styles.actionRowDanger}>Thu hồi tin nhắn</Text>
                    </Pressable>
                  ) : null}
                </>
              ) : null}
            </Pressable>
          </Pressable>
        </Modal>
        ) : null}
      </KeyboardAvoidingView>
    );

    return embedded ? threadView : <Screen>{threadView}</Screen>;
  }

  // --- Room List View ---
  const listView = (
    <View style={styles.listRoot}>
      {/* Top pastel icy-aqua gradient backdrop with subtle geometric motifs */}
      <View pointerEvents="none" style={styles.topBackdrop}>
        <Svg width="100%" height="100%" viewBox="0 0 360 150" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="chatTopBg" x1="0" y1="0" x2="0.2" y2="1">
              <Stop offset="0%" stopColor="#D8EFFC" />
              <Stop offset="58%" stopColor="#E9F4FD" />
              <Stop offset="100%" stopColor="#F5FAFE" />
            </LinearGradient>
            <RadialGradient id="chatTopGlow" cx="88%" cy="14%" rx="50%" ry="68%">
              <Stop offset="0%" stopColor="#8FD3FA" stopOpacity="0.45" />
              <Stop offset="100%" stopColor="#8FD3FA" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="360" height="150" fill="url(#chatTopBg)" />
          <Rect x="0" y="0" width="360" height="150" fill="url(#chatTopGlow)" />
          <Path
            d="M 185 150 C 235 106, 294 98, 360 72 L 360 150 Z"
            fill="#2463EB"
            fillOpacity={0.045}
          />
          <Circle
            cx="326"
            cy="20"
            r="60"
            fill="none"
            stroke="#2463EB"
            strokeOpacity={0.08}
            strokeWidth={1.2}
          />
          <Circle
            cx="326"
            cy="20"
            r="36"
            fill="none"
            stroke="#2463EB"
            strokeOpacity={0.07}
            strokeWidth={1}
          />
          <Circle cx="244" cy="24" r="2.2" fill="#2463EB" fillOpacity={0.12} />
          <Circle cx="258" cy="16" r="1.8" fill="#2463EB" fillOpacity={0.09} />
          <Circle cx="256" cy="32" r="1.6" fill="#2463EB" fillOpacity={0.1} />
          <Circle cx="270" cy="26" r="2" fill="#2463EB" fillOpacity={0.08} />
        </Svg>
      </View>

      {/* Top header & pill filter chips on pastel sky area */}
      <View style={styles.topZone}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Trò chuyện</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cuộc trò chuyện mới"
            onPress={() => {
              void openNewChatModal();
            }}
            style={({ pressed }) => [styles.newChatBtn, pressed && styles.newChatBtnPressed]}
          >
            <Plus size={19} color={colors.white} strokeWidth={2.2} />
          </Pressable>
        </View>

        <View style={styles.filters}>
          {(
            [
              { key: 'all', label: 'Tất cả' },
              { key: 'unread', label: 'Chưa đọc' },
              { key: 'group', label: 'Nhóm' },
            ] as const
          ).map((tab) => {
            const active = filter === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setFilter(tab.key)}
                style={[styles.filterPill, active && styles.filterPillActive]}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Rounded white sheet containing search bar & flat conversation list */}
      <View style={styles.whiteSheet}>
        <View style={styles.searchWrap}>
          <Search size={17} color="#94A3B8" strokeWidth={1.9} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Tìm theo tên đồng nghiệp, nhóm..."
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
          />
        </View>

        <ScrollView
          contentContainerStyle={styles.sheetScrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={roomsRefreshing}
              onRefresh={() => {
                setRoomsRefreshing(true);
                void loadRooms(true);
              }}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {roomsLoading && !rooms.length ? (
            <CenteredPageLoader />
          ) : roomsError && !rooms.length ? (
            <View style={styles.stateBox}>
              <PopupError error={roomsError} />
              <Pressable
                onPress={() => {
                  void loadRooms();
                }}
                style={styles.retryBtn}
              >
                <Text style={styles.retryBtnText}>Thử tải lại</Text>
              </Pressable>
            </View>
          ) : !filteredRooms.length ? (
            <View style={styles.stateBox}>
              <IgenEmptyState
                message={
                  rooms.length
                    ? 'Không có hội thoại nào khớp bộ lọc.'
                    : 'Chưa có cuộc trò chuyện nội bộ nào. Bấm "Mới" để bắt đầu.'
                }
              />
            </View>
          ) : (
            <View style={styles.list}>
              {filteredRooms.map((room, idx) => {
                const name = getRoomDisplayName(room, myId);
                const unread = room.unreadCount ?? 0;
                const pinned = isRoomPinned(room, myId);
                return (
                  <Pressable
                    key={room._id}
                    onPress={() => openRoom(room)}
                    style={({ pressed }) => [
                      styles.row,
                      idx > 0 && styles.rowDivider,
                      pressed && styles.rowPressed,
                    ]}
                  >
                    <View
                      style={[
                        styles.avatar,
                        { backgroundColor: AVATAR_TONES[idx % AVATAR_TONES.length] },
                      ]}
                    >
                      <Text style={styles.initials}>{getInitials(name)}</Text>
                    </View>
                    <View style={styles.copy}>
                      <View style={styles.nameLine}>
                        <View style={styles.roomNameWrap}>
                          {pinned ? <Pin size={12} color={colors.primary} /> : null}
                          <Text numberOfLines={1} style={styles.name}>
                            {name}
                          </Text>
                        </View>
                        <Text style={styles.time}>
                          {formatMessageTime(room.lastMessage?.createdAt || room.updatedAt)}
                        </Text>
                      </View>
                      <View style={styles.previewLine}>
                        <Text
                          numberOfLines={1}
                          style={[styles.message, unread > 0 && styles.messageUnread]}
                        >
                          {formatLastMessagePreview(room)}
                        </Text>
                        {unread > 0 ? (
                          <View style={styles.unreadBadge}>
                            <Text style={styles.unreadBadgeText}>
                              {unread > 99 ? '99+' : unread}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>

      {/* New Chat Modal */}
      {newChatOpen ? (
        <Modal
          visible
          transparent
          animationType="slide"
          onRequestClose={() => setNewChatOpen(false)}
        >
        <Pressable style={styles.modalBackdrop} onPress={() => setNewChatOpen(false)}>
          <Pressable style={styles.newChatSheet} onPress={() => { }}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cuộc trò chuyện mới</Text>
              <Pressable onPress={() => setNewChatOpen(false)} hitSlop={8}>
                <Text style={styles.modalClose}>Đóng</Text>
              </Pressable>
            </View>

            {selectedIds.length > 1 ? (
              <TextInput
                value={groupName}
                onChangeText={setGroupName}
                placeholder="Nhập tên nhóm..."
                placeholderTextColor={colors.muted}
                style={styles.modalInput}
              />
            ) : null}

            <TextInput
              value={colleagueSearch}
              onChangeText={setColleagueSearch}
              placeholder="Tìm đồng nghiệp..."
              placeholderTextColor={colors.muted}
              style={styles.modalInput}
            />

            {colleaguesLoading ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : (
              <ScrollView style={styles.colleagueList} showsVerticalScrollIndicator={false}>
                {filteredColleagues.map((person) => {
                  const id = person._id || person.id || person.uid || '';
                  if (!id) return null;
                  const selected = selectedIds.includes(id);
                  return (
                    <Pressable
                      key={id}
                      onPress={() => toggleSelectColleague(id)}
                      style={[styles.colleagueRow, selected && styles.colleagueRowSelected]}
                    >
                      <View style={styles.colleagueAvatar}>
                        <Text style={styles.initials}>{getInitials(person.displayName)}</Text>
                      </View>
                      <View style={styles.colleagueCopy}>
                        <Text numberOfLines={1} style={styles.colleagueName}>
                          {person.displayName}
                        </Text>
                        {person.email ? (
                          <Text numberOfLines={1} style={styles.colleagueEmail}>
                            {person.email}
                          </Text>
                        ) : null}
                      </View>
                      {selected ? <Check size={17} color={colors.primary} /> : <View style={styles.checkPlaceholder} />}
                    </Pressable>
                  );
                })}
                {!filteredColleagues.length ? (
                  <Text style={styles.emptyColleagueText}>Không tìm thấy đồng nghiệp nào.</Text>
                ) : null}
              </ScrollView>
            )}

            <Pressable
              disabled={creatingRoom || selectedIds.length === 0}
              onPress={() => {
                void onCreateRoom();
              }}
              style={[
                styles.createBtn,
                (creatingRoom || selectedIds.length === 0) && styles.sendBtnDisabled,
              ]}
            >
              {creatingRoom ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.createBtnText}>
                  {selectedIds.length > 1
                    ? `Tạo nhóm (${selectedIds.length})`
                    : 'Bắt đầu trò chuyện'}
                </Text>
              )}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
      ) : null}
    </View>
  );

  return embedded ? listView : <Screen backgroundColor="#D8EFFC">{listView}</Screen>;
}

export function EmbeddedInternalChatScreen() {
  return <InternalChatScreen embedded />;
}

const styles = StyleSheet.create({
  listRoot: { flex: 1, backgroundColor: '#D8EFFC' },
  topBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, height: 150 },
  topZone: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { color: colors.ink, fontSize: 21, fontWeight: '700', letterSpacing: -0.2 },
  newChatBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newChatBtnPressed: { opacity: 0.82 },
  filters: { flexDirection: 'row', gap: 8, marginTop: 12 },
  filterPill: {
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 6.5,
    borderRadius: 999,
  },
  filterPillActive: { backgroundColor: colors.primary },
  filterText: { color: '#334155', fontSize: 12.5, fontWeight: '400' },
  filterTextActive: { color: colors.white, fontWeight: '500' },
  whiteSheet: {
    flex: 1,
    backgroundColor: colors.white,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 14,
    overflow: 'hidden',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F5F8',
    borderRadius: 12,
    height: 42,
    paddingHorizontal: 13,
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 9,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: colors.ink,
    paddingVertical: 0,
  },
  sheetScrollContent: { paddingBottom: 24, flexGrow: 1 },
  list: {},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    backgroundColor: colors.white,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F1F4F9',
  },
  rowPressed: { backgroundColor: '#F7F9FC' },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  copy: { flex: 1, marginLeft: 13 },
  nameLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  roomNameWrap: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { color: colors.ink, fontSize: 15, fontWeight: '500', flex: 1 },
  time: { color: '#8A96A8', fontSize: 12, fontWeight: '400' },
  previewLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  message: { flex: 1, color: '#64748B', fontSize: 13.5, fontWeight: '400' },
  messageUnread: { color: colors.ink, fontWeight: '500' },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: { color: colors.white, fontSize: 10.5, fontWeight: '600' },
  stateBox: { flex: 1, minHeight: 320, padding: 28, alignItems: 'center', justifyContent: 'center', gap: 10 },
  stateText: { color: colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  errorText: { color: '#B91C1C', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  retryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 4,
  },
  retryBtnText: { color: colors.white, fontSize: 12, fontWeight: '600' },

  // Thread view
  threadContainer: { flex: 1, backgroundColor: colors.background },
  threadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: '#F1F5FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadHeaderCopy: { flex: 1 },
  threadTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  threadSubtitle: { color: colors.muted, fontSize: 10, marginTop: 2 },
  pinBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: '#F1F5FB',
  },
  pinBtnText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  pinBtnTextActive: { color: colors.primary },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  messagesContent: { padding: 14, gap: 10, flexGrow: 1 },
  loadOlderBtn: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: '#EAF2FF',
    marginBottom: 8,
  },
  loadOlderText: { color: colors.primary, fontSize: 10, fontWeight: '700' },
  emptyThreadText: {
    color: colors.muted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 40,
  },
  msgRow: { alignItems: 'flex-start', maxWidth: '82%' },
  msgRowMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  senderLabel: { color: colors.muted, fontSize: 10, fontWeight: '700', marginBottom: 3, marginLeft: 4 },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
    maxWidth: '100%',
  },
  bubbleOther: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleMine: {
    backgroundColor: colors.primary,
  },
  bubbleText: { color: colors.ink, fontSize: 13, lineHeight: 19 },
  bubbleTextMine: { color: colors.white },
  deletedText: { color: colors.muted, fontSize: 12, fontStyle: 'italic' },
  msgTime: { color: colors.muted, fontSize: 9, marginTop: 4, alignSelf: 'flex-end' },
  msgTimeMine: { color: 'rgba(255,255,255,0.78)' },
  replyQuote: {
    borderLeftWidth: 2,
    borderLeftColor: colors.primary,
    paddingLeft: 8,
    marginBottom: 6,
    opacity: 0.9,
  },
  replyQuoteMine: { borderLeftColor: 'rgba(255,255,255,0.7)' },
  replyQuoteName: { color: colors.primary, fontSize: 10, fontWeight: '700' },
  replyQuoteBody: { color: colors.muted, fontSize: 10 },
  replyQuoteTextMine: { color: 'rgba(255,255,255,0.9)' },
  attachList: { gap: 4, marginTop: 4 },
  attachChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  attachChipText: { color: colors.primary, fontSize: 11, fontWeight: '600', flex: 1 },
  attachChipTextMine: { color: colors.white },
  reactionRow: { flexDirection: 'row', gap: 4, marginTop: 3 },
  reactionRowMine: { justifyContent: 'flex-end' },
  reactionPill: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 99,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 10,
    overflow: 'hidden',
  },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAF2FF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#D6E5FF',
    gap: 10,
  },
  replyBannerCopy: { flex: 1 },
  replyBannerTitle: { color: colors.primary, fontSize: 10, fontWeight: '800' },
  replyBannerText: { color: colors.ink, fontSize: 11, marginTop: 1 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 110,
    backgroundColor: colors.background,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 9,
    fontSize: 13,
    color: colors.ink,
  },
  sendBtn: {
    backgroundColor: colors.primary,
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.45 },
  sendBtnText: { color: colors.white, fontSize: 12, fontWeight: '700' },

  // Modals
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    paddingBottom: 28,
    gap: 8,
  },
  emojiBar: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8 },
  emojiBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F6FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: { fontSize: 20 },
  actionRow: { paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  actionRowText: { color: colors.ink, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  actionRowDanger: { color: '#C74848', fontSize: 14, fontWeight: '700', textAlign: 'center' },

  newChatSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 26,
    maxHeight: '82%',
  },
  modalHandle: {
    width: 38,
    height: 4,
    borderRadius: 99,
    backgroundColor: '#D6DFEC',
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  modalClose: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  modalInput: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    color: colors.ink,
    marginBottom: 10,
  },
  modalLoading: { paddingVertical: 30, alignItems: 'center' },
  colleagueList: { maxHeight: 300, marginBottom: 12 },
  colleagueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    gap: 10,
    marginBottom: 4,
  },
  colleagueRowSelected: { backgroundColor: '#EAF2FF' },
  colleagueAvatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#DCE8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colleagueCopy: { flex: 1 },
  colleagueName: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  colleagueEmail: { color: colors.muted, fontSize: 10, marginTop: 2 },
  checkPlaceholder: { width: 17, height: 17 },
  emptyColleagueText: { color: colors.muted, fontSize: 11, textAlign: 'center', paddingVertical: 20 },
  createBtn: {
    backgroundColor: colors.primary,
    minHeight: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtnText: { color: colors.white, fontSize: 13, fontWeight: '700' },
});
