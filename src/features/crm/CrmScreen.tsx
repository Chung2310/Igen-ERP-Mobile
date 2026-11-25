import { PopupError } from '@/components/PopupError';
import { withAppLockSuspended } from '@/core/auth/appLockSuspension';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { LucideIcon } from 'lucide-react-native';
import { Camera, ChevronLeft, ChevronRight, Ellipsis, Info, MessageCircle, MessagesSquare, Music2, Paperclip, Plus, ScanLine, Send, Sparkles, Users, UserRound } from 'lucide-react-native';
import { Card } from '@/components/Card';
import { createErpLead, loadConversationMessages, loadCrmWorkspace, markConversationRead, resumeConversationAI, sendConversationReply } from '@/features/crm/crmApi';
import type { ConversationMode, CrmConversation, CrmLead, CrmLeadDraft, CrmMessage } from '@/features/crm/types';
import { colors } from '@/theme/colors';

type CrmSection = 'inbox' | 'leads' | 'automation';
type InboxFilter = 'all' | 'unread' | 'unassigned';

const channelIcon: Record<CrmConversation['channel'], LucideIcon> = {
  Zalo: MessageCircle, Facebook: Users, TikTok: Music2, Instagram: Camera, 'Web chat': MessagesSquare,
};

const emptyLead: CrmLeadDraft = { name: '', company: '', phone: '', email: '' };

export function CrmScreen() {
  const [section, setSection] = useState<CrmSection>('inbox');
  const [conversations, setConversations] = useState<CrmConversation[]>([]);
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [query, setQuery] = useState('');
  const [messageDraft, setMessageDraft] = useState('');
  const [autoReply, setAutoReply] = useState(true);
  const [useKnowledge, setUseKnowledge] = useState(true);
  const [useRules, setUseRules] = useState(true);
  const [leadFormOpen, setLeadFormOpen] = useState(false);
  const [leadDraft, setLeadDraft] = useState<CrmLeadDraft>(emptyLead);
  const [leadSource, setLeadSource] = useState('Nhập thủ công');
  const [leadNotice, setLeadNotice] = useState('');
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [workspaceNotice, setWorkspaceNotice] = useState('');
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [conversationError, setConversationError] = useState('');
  const [sending, setSending] = useState(false);
  const [leadSaving, setLeadSaving] = useState(false);

  const activeConversation = conversations.find((conversation) => conversation.id === selectedId) ?? null;
  const visibleConversations = useMemo(() => conversations.filter((conversation) => {
    const matchesQuery = `${conversation.contactName} ${conversation.lastMessage} ${conversation.channel}`.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'));
    const matchesFilter = filter === 'all' || (filter === 'unread' && conversation.unreadCount > 0) || (filter === 'unassigned' && !conversation.assignedTo);
    return matchesQuery && matchesFilter;
  }), [conversations, filter, query]);

  async function refreshWorkspace() {
    setWorkspaceLoading(true);
    try {
      const result = await loadCrmWorkspace();
      setConversations(result.conversations);
      setLeads(result.leads);
      const notices = [
        result.unavailableChannels.length ? `Không tải được kênh: ${result.unavailableChannels.join(', ')}.` : '',
        result.leadsUnavailable ? 'Không tải được Lead từ ERP.' : '',
      ].filter(Boolean);
      setWorkspaceNotice(notices.join(' '));
    } catch (error) {
      setConversations([]);
      setLeads([]);
      setWorkspaceNotice(error instanceof Error ? error.message : 'Không tải được dữ liệu CRM từ ERP.');
    } finally {
      setWorkspaceLoading(false);
    }
  }

  useEffect(() => { void refreshWorkspace(); }, []);

  function updateConversation(id: string, update: Partial<CrmConversation>) {
    setConversations((items) => items.map((item) => item.id === id ? { ...item, ...update } : item));
  }

  async function openConversation(conversation: CrmConversation) {
    setSelectedId(conversation.id);
    setConversationError('');
    setMessagesLoading(true);
    updateConversation(conversation.id, { unreadCount: 0 });
    try {
      const messages = await loadConversationMessages(conversation);
      updateConversation(conversation.id, { messages });
      await markConversationRead(conversation);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không tải được tin nhắn.';
      setConversationError(message);
    } finally {
      setMessagesLoading(false);
    }
  }

  async function sendMessage() {
    if (!activeConversation || !messageDraft.trim()) return;
    const text = messageDraft.trim();
    setSending(true);
    try {
      await sendConversationReply(activeConversation, text);
      const newMessage: CrmMessage = { id: `sent-${Date.now()}`, sender: 'staff', text, time: 'Vừa xong' };
      updateConversation(activeConversation.id, {
        messages: [...activeConversation.messages, newMessage],
        lastMessage: text,
        updatedAt: 'Vừa xong',
        mode: 'human',
      });
      setMessageDraft('');
    } catch (error) {
      Alert.alert('Chưa gửi được tin nhắn', error instanceof Error ? error.message : 'ERP không gửi được tin nhắn.');
    } finally {
      setSending(false);
    }
  }

  async function setConversationMode(mode: ConversationMode) {
    if (!activeConversation) return;
    if (mode === 'human') {
      Alert.alert('Tiếp quản hội thoại', 'ERP hiện chưa có API tạm dừng AI riêng. Gửi tin nhắn với tư cách nhân viên để ERP tạm dừng AI cho hội thoại này.');
      return;
    }
    if (mode === 'ai') {
      try {
        await resumeConversationAI(activeConversation);
      } catch (error) {
        Alert.alert('Chưa bật lại được AI', error instanceof Error ? error.message : 'ERP không cập nhật được trạng thái AI.');
        return;
      }
    }
    updateConversation(activeConversation.id, { mode });
  }

  async function createLead() {
    if (!leadDraft.name.trim() || !leadDraft.phone.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên và số điện thoại của Lead.');
      return;
    }
    setLeadSaving(true);
    try {
      const created = await createErpLead(leadDraft);
      setLeads((items) => [created, ...items]);
      setLeadDraft(emptyLead);
      setLeadSource('Nhập thủ công');
      setLeadNotice('');
      setLeadFormOpen(false);
      setSection('leads');
    } catch (error) {
      Alert.alert('Chưa tạo được Lead', error instanceof Error ? error.message : 'ERP không lưu được Lead.');
    } finally {
      setLeadSaving(false);
    }
  }

  async function startOcr(camera: boolean) {
    try {
      const result = camera
        ? await withAppLockSuspended(() => ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 }))
        : await withAppLockSuspended(() => ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 }));
      if (result.canceled || !result.assets[0]) return;

      setLeadDraft(emptyLead);
      setLeadSource('Ảnh đã chọn');
      setLeadNotice('ERP hiện chưa có API OCR độc lập cho Lead. Hãy nhập thông tin bên dưới; ảnh chưa được tải lên máy chủ.');
      setLeadFormOpen(true);
    } catch {
      Alert.alert('Không mở được ảnh', 'Vui lòng kiểm tra quyền truy cập camera hoặc thư viện ảnh trong cài đặt thiết bị.');
    }
  }

  function chooseOcrSource() {
    Alert.alert('Chọn ảnh tài liệu', 'API ERP hiện chưa có OCR độc lập cho Lead. Bạn vẫn có thể chọn ảnh rồi nhập thông tin thủ công.', [
      { text: 'Chụp ảnh', onPress: () => { void startOcr(true); } },
      { text: 'Chọn từ thư viện', onPress: () => { void startOcr(false); } },
      { text: 'Hủy', style: 'cancel' },
    ]);
  }

  if (leadFormOpen) {
    return (
      <LeadEditor
        draft={leadDraft}
        source={leadSource}
        saving={leadSaving}
        notice={leadNotice}
        onChange={setLeadDraft}
        onCancel={() => { setLeadFormOpen(false); setLeadDraft(emptyLead); setLeadNotice(''); }}
        onSave={createLead}
      />
    );
  }

  if (activeConversation) {
    return (
      <ConversationDetail
        conversation={activeConversation}
        draft={messageDraft}
        loading={messagesLoading}
        sending={sending}
        error={conversationError}
        onDraftChange={setMessageDraft}
        onBack={() => { setSelectedId(null); setMessageDraft(''); }}
        onSend={sendMessage}
        onSetMode={setConversationMode}
        onAssign={() => Alert.alert('Chưa có API phân công', 'Dự án ERP hiện chưa cung cấp endpoint phân công hội thoại.')}
      />
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>KHÁCH HÀNG &amp; BÁN HÀNG</Text>
        <Text style={styles.title}>CRM &amp; Hộp thư</Text>
        <Text style={styles.subtitle}>Hộp thư, Lead và AI từ hệ thống ERP.</Text>
        {!!workspaceNotice && <PopupError error={workspaceNotice} />}

        <View style={styles.sectionTabs}>
          <SectionTab label={`Hộp thư ${unreadTotal(conversations)}`} active={section === 'inbox'} onPress={() => setSection('inbox')} />
          <SectionTab label={`Lead ${leads.length}`} active={section === 'leads'} onPress={() => setSection('leads')} />
          <SectionTab label="AI tự động" active={section === 'automation'} onPress={() => setSection('automation')} />
        </View>

        {section === 'inbox' && (
          <>
            <TextInput value={query} onChangeText={setQuery} placeholder="Tìm hội thoại..." placeholderTextColor={colors.muted} style={styles.search} />
            <View style={styles.filters}>
              <FilterChip label="Tất cả" active={filter === 'all'} onPress={() => setFilter('all')} />
              <FilterChip label="Chưa đọc" active={filter === 'unread'} onPress={() => setFilter('unread')} />
              <FilterChip label="Chưa phân công" active={filter === 'unassigned'} onPress={() => setFilter('unassigned')} />
            </View>
            <View style={styles.conversationList}>
              {visibleConversations.map((conversation) => (
                <ConversationRow key={conversation.id} conversation={conversation} onPress={() => openConversation(conversation)} />
              ))}
              {workspaceLoading && <ActivityIndicator color={colors.primary} style={styles.loading} />}
              {!workspaceLoading && visibleConversations.length === 0 && <Text style={styles.empty}>{query || filter !== 'all' ? 'Không có hội thoại phù hợp.' : 'Chưa có hội thoại từ các kênh đã kết nối ERP.'}</Text>}
            </View>
            <Text style={styles.demoNote}>Tin nhắn và trạng thái hội thoại được tải từ ERP.</Text>
          </>
        )}

        {section === 'leads' && (
          <>
            <View style={styles.leadActions}>
              <ActionButton icon={Plus} label="Tạo Lead" onPress={() => { setLeadDraft(emptyLead); setLeadSource('Nhập thủ công'); setLeadFormOpen(true); }} />
              <ActionButton icon={ScanLine} label="Ảnh / OCR" secondary onPress={chooseOcrSource} />
            </View>
            <Text style={styles.listCaption}>{leads.length} Lead gần đây</Text>
            <View style={styles.leadList}>
              {leads.map((lead) => <LeadRow key={lead.id} lead={lead} />)}
              {workspaceLoading && <ActivityIndicator color={colors.primary} style={styles.loading} />}
              {!workspaceLoading && leads.length === 0 && <Text style={styles.empty}>Chưa có Lead trong ERP.</Text>}
            </View>
            <Text style={styles.demoNote}>Lead được tải và lưu trên máy chủ ERP.</Text>
          </>
        )}

        {section === 'automation' && (
          <AutomationPanel
            enabled={autoReply}
            useKnowledge={useKnowledge}
            useRules={useRules}
            onEnabledChange={setAutoReply}
            onKnowledgeChange={setUseKnowledge}
            onRulesChange={setUseRules}
          />
        )}
      </ScrollView>
    </View>
  );
}

function unreadTotal(conversations: CrmConversation[]) {
  return conversations.reduce((total, conversation) => total + conversation.unreadCount, 0);
}

function SectionTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.sectionTab, active && styles.sectionTabActive]}><Text numberOfLines={1} style={[styles.sectionTabText, active && styles.sectionTabTextActive]}>{label}</Text></Pressable>;
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}><Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text></Pressable>;
}

function ConversationRow({ conversation, onPress }: { conversation: CrmConversation; onPress: () => void }) {
  const ChannelIcon = channelIcon[conversation.channel];
  return (
    <Card onPress={onPress} style={styles.conversationRow}>
      <View style={[styles.contactAvatar, { backgroundColor: conversation.channelColor }]}><Text style={styles.contactInitials}>{conversation.initials}</Text><View style={styles.channelBadge}><ChannelIcon size={13} color={colors.white} /></View></View>
      <View style={styles.conversationCopy}>
        <View style={styles.conversationHeader}><Text numberOfLines={1} style={styles.contactName}>{conversation.contactName}</Text><Text style={styles.time}>{conversation.updatedAt}</Text></View>
        <Text numberOfLines={1} style={styles.lastMessage}>{conversation.lastMessage}</Text>
        <View style={styles.conversationMeta}><Text style={styles.channelName}>{conversation.channel}</Text><Text style={styles.metaDot}>·</Text><Text style={styles.modeLabel}>{conversation.mode === 'ai' ? 'AI đang xử lý' : conversation.assignedTo ?? 'Chưa phân công'}</Text></View>
      </View>
      {conversation.unreadCount > 0 && <View style={styles.unreadBadge}><Text style={styles.unreadCount}>{conversation.unreadCount}</Text></View>}
    </Card>
  );
}

function ConversationDetail({
  conversation, draft, loading, sending, error, onDraftChange, onBack, onSend, onSetMode, onAssign,
}: {
  conversation: CrmConversation;
  draft: string;
  loading: boolean;
  sending: boolean;
  error: string;
  onDraftChange: (value: string) => void;
  onBack: () => void;
  onSend: () => void;
  onSetMode: (mode: ConversationMode) => void;
  onAssign: () => void;
}) {
  return (
    <View style={styles.detailContainer}>
      <View style={styles.detailHeader}>
        <Pressable onPress={onBack} style={styles.backButton}><ChevronLeft size={21} color={colors.primary} /></Pressable>
        <View style={[styles.contactAvatar, styles.detailAvatar, { backgroundColor: conversation.channelColor }]}><Text style={styles.contactInitials}>{conversation.initials}</Text></View>
        <View style={styles.detailContact}><Text numberOfLines={1} style={styles.contactName}>{conversation.contactName}</Text><Text style={styles.channelName}>{conversation.channel}</Text></View>
        <Ellipsis size={21} color={colors.muted} />
      </View>

      <View style={styles.modeToolbar}>
        <Pressable onPress={() => onSetMode('ai')} style={[styles.modeButton, conversation.mode === 'ai' && styles.modeButtonActive]}><View style={styles.modeButtonContent}><Sparkles size={12} color={conversation.mode === 'ai' ? colors.primary : colors.muted} /><Text style={[styles.modeButtonText, conversation.mode === 'ai' && styles.modeButtonTextActive]}>AI trả lời</Text></View></Pressable>
        <Pressable onPress={() => onSetMode('human')} style={[styles.modeButton, conversation.mode === 'human' && styles.modeButtonActive]}><Text style={[styles.modeButtonText, conversation.mode === 'human' && styles.modeButtonTextActive]}>Nhân viên tiếp quản</Text></Pressable>
      </View>

      <Card style={styles.assignmentCard}>
        <View style={styles.assignmentIcon}><UserRound size={15} color={colors.primary} /></View>
        <View style={styles.assignmentCopy}><Text style={styles.assignmentLabel}>Người phụ trách</Text><Text style={styles.assignmentName}>{conversation.assignedTo ?? 'Chưa phân công'}</Text></View>
        <Pressable onPress={onAssign} style={styles.assignButton}><Text style={styles.assignText}>Phân công</Text></Pressable>
      </Card>

      <ScrollView contentContainerStyle={styles.messageList} showsVerticalScrollIndicator={false}>
        <Text style={styles.dayLabel}>HÔM NAY</Text>
        {loading && <ActivityIndicator color={colors.primary} style={styles.loading} />}
        {!!error && <PopupError error={error} />}
        {conversation.messages.map((message) => <MessageBubble key={message.id} message={message} />)}
        {conversation.mode === 'ai' && <View style={styles.aiStatusRow}><Sparkles size={12} color={colors.primary} /><Text style={styles.aiStatus}>AI đang trả lời dựa trên tài liệu và kịch bản đã bật</Text></View>}
        {conversation.mode === 'human' && <Text style={styles.handoverHint}>Để ERP tạm dừng AI, hãy gửi tin nhắn với tư cách nhân viên.</Text>}
      </ScrollView>

      <View style={styles.composer}>
        <Pressable style={styles.attachButton} onPress={() => Alert.alert('Đính kèm', 'Dự án ERP hiện chưa cung cấp API gửi tệp đính kèm từ ứng dụng mobile.') }><Paperclip size={16} color={colors.primary} /></Pressable>
        <TextInput value={draft} onChangeText={onDraftChange} placeholder="Nhập tin nhắn..." placeholderTextColor={colors.muted} style={styles.messageInput} multiline />
        <Pressable disabled={sending || !draft.trim()} onPress={onSend} style={[styles.sendButton, (!draft.trim() || sending) && styles.sendButtonDisabled]}>{sending ? <ActivityIndicator size="small" color={colors.white} /> : <Send size={15} color={colors.white} />}</Pressable>
      </View>
    </View>
  );
}

function MessageBubble({ message }: { message: CrmMessage }) {
  const outgoing = message.sender === 'staff';
  return (
    <View style={[styles.messageLine, outgoing && styles.messageLineOutgoing]}>
      <View style={[styles.messageBubble, outgoing && styles.messageBubbleOutgoing, message.sender === 'ai' && styles.messageBubbleAi]}>
        {message.sender === 'ai' && <View style={styles.aiMessageLabelRow}><Sparkles size={11} color={colors.primary} /><Text style={styles.aiMessageLabel}>AI trả lời</Text></View>}
        <Text style={[styles.messageText, outgoing && styles.messageTextOutgoing]}>{message.text}</Text>
        <Text style={[styles.messageTime, outgoing && styles.messageTimeOutgoing]}>{message.time}</Text>
      </View>
    </View>
  );
}

function LeadRow({ lead }: { lead: CrmLead }) {
  const statusColor = lead.status === 'Mới' ? '#2463EB' : lead.status === 'Đủ điều kiện' ? '#16885A' : '#C27617';
  return (
    <Card style={styles.leadRow}>
      <View style={styles.leadAvatar}><Text style={styles.leadInitials}>{lead.name.split(' ').slice(-2).map((part) => part[0]).join('')}</Text></View>
      <View style={styles.leadCopy}>
        <View style={styles.leadTitleLine}><Text numberOfLines={1} style={styles.leadName}>{lead.name}</Text><Text style={[styles.leadStatus, { color: statusColor, backgroundColor: `${statusColor}18` }]}>{lead.status}</Text></View>
        <Text numberOfLines={1} style={styles.leadCompany}>{lead.company || 'Chưa có công ty'}</Text>
        <Text style={styles.leadSource}>{lead.phone} · {lead.source} · {lead.createdAt}</Text>
      </View>
      <ChevronRight size={17} color={colors.muted} />
    </Card>
  );
}

function ActionButton({ label, onPress, secondary = false, icon: Icon }: { label: string; onPress: () => void; secondary?: boolean; icon?: LucideIcon }) {
  return <Pressable onPress={onPress} style={[styles.actionButton, secondary && styles.actionButtonSecondary]}>{Icon ? <Icon size={14} color={secondary ? colors.primary : colors.white} /> : null}<Text style={[styles.actionButtonText, secondary && styles.actionButtonTextSecondary]}>{label}</Text></Pressable>;
}

function LeadEditor({
  draft, source, saving, notice, onChange, onCancel, onSave,
}: {
  draft: CrmLeadDraft;
  source: string;
  saving: boolean;
  notice: string;
  onChange: (draft: CrmLeadDraft) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const fields: { key: keyof CrmLeadDraft; label: string; placeholder: string; keyboardType?: 'default' | 'email-address' | 'phone-pad' }[] = [
    { key: 'name', label: 'Tên khách hàng *', placeholder: 'Nhập họ tên' },
    { key: 'company', label: 'Công ty', placeholder: 'Tên doanh nghiệp' },
    { key: 'phone', label: 'Số điện thoại *', placeholder: 'Nhập số điện thoại', keyboardType: 'phone-pad' },
    { key: 'email', label: 'Email', placeholder: 'name@company.vn', keyboardType: 'email-address' },
  ];
  return (
    <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
      <Pressable onPress={onCancel} style={styles.formBack}><ChevronLeft size={18} color={colors.primary} /><Text style={styles.formBackText}>Quay lại Lead</Text></Pressable>
      <Text style={styles.eyebrow}>CRM · LEAD</Text>
      <Text style={styles.title}>Tạo Lead</Text>
      <Text style={styles.subtitle}>Nguồn tạo: {source}</Text>
      {!!notice && <Card style={styles.ocrProgress}><Text style={styles.ocrProgressText}>{notice}</Text></Card>}
      {saving && <ActivityIndicator color={colors.primary} style={styles.loading} />}
      {fields.map((field) => (
        <View key={field.key} style={styles.formField}>
          <Text style={styles.fieldLabel}>{field.label}</Text>
          <TextInput
            value={draft[field.key]}
            onChangeText={(value) => onChange({ ...draft, [field.key]: value })}
            placeholder={field.placeholder}
            placeholderTextColor={colors.muted}
            keyboardType={field.keyboardType ?? 'default'}
            autoCapitalize={field.key === 'email' ? 'none' : 'words'}
            style={styles.fieldInput}
          />
        </View>
      ))}
      <Card style={styles.formHint}><Info size={16} color="#B47821" /><Text style={styles.formHintText}>Lead sẽ được lưu trực tiếp vào ERP.</Text></Card>
      <ActionButton label={saving ? 'Đang lưu Lead...' : 'Lưu Lead'} onPress={onSave} />
    </ScrollView>
  );
}

function AutomationPanel({
  enabled, useKnowledge, useRules, onEnabledChange, onKnowledgeChange, onRulesChange,
}: {
  enabled: boolean;
  useKnowledge: boolean;
  useRules: boolean;
  onEnabledChange: (value: boolean) => void;
  onKnowledgeChange: (value: boolean) => void;
  onRulesChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.automationContent}>
      <Card style={styles.automationMaster}>
        <View style={styles.automationIcon}><Sparkles size={18} color={colors.primary} /></View>
        <View style={styles.automationCopy}><Text style={styles.automationTitle}>AI trả lời tự động</Text><Text style={styles.automationHint}>Bật cho hội thoại chưa có nhân viên tiếp quản</Text></View>
        <Switch value={enabled} onValueChange={onEnabledChange} trackColor={{ false: '#DCE2EB', true: '#A9C5FF' }} thumbColor={enabled ? colors.primary : '#FFFFFF'} />
      </Card>
      <Text style={styles.sectionLabel}>NGUỒN TRẢ LỜI</Text>
      <Card style={styles.settingRow}><View style={styles.settingCopy}><Text style={styles.settingTitle}>Kho tri thức</Text><Text style={styles.settingHint}>Dùng tài liệu doanh nghiệp làm căn cứ trả lời</Text></View><Switch value={useKnowledge} onValueChange={onKnowledgeChange} disabled={!enabled} /></Card>
      <Card style={styles.scenarioCard}><Text style={styles.scenarioText}>Tài liệu được quản lý trong Kho tri thức ERP. Tùy chọn áp dụng tri thức trong màn hình này hiện là bản xem trước.</Text></Card>
      <Card style={styles.settingRow}><View style={styles.settingCopy}><Text style={styles.settingTitle}>Quy tắc và kịch bản</Text><Text style={styles.settingHint}>Áp dụng cách xưng hô, điều kiện và luồng chuyển nhân viên</Text></View><Switch value={useRules} onValueChange={onRulesChange} disabled={!enabled} /></Card>
      <Text style={styles.sectionLabel}>KỊCH BẢN ĐANG DÙNG</Text>
      <Card style={styles.scenarioCard}><Text style={styles.scenarioTitle}>Tư vấn sản phẩm</Text><Text style={styles.scenarioText}>Trả lời câu hỏi thường gặp bằng thông tin trong kho tri thức.</Text></Card>
      <Card style={styles.scenarioCard}><Text style={styles.scenarioTitle}>Chuyển nhân viên</Text><Text style={styles.scenarioText}>Chuyển tiếp khi khách yêu cầu gặp nhân viên hoặc câu hỏi ngoài phạm vi.</Text></Card>
      <Text style={styles.demoNote}>Thiết lập hiện lưu trong phiên xem trước; quy tắc thật sẽ đồng bộ qua API.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 18, paddingTop: 14, paddingBottom: 26 },
  eyebrow: { color: colors.primary, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  title: { color: colors.ink, fontSize: 24, fontWeight: '800', marginTop: 4 },
  subtitle: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 5 },
  sectionTabs: { flexDirection: 'row', backgroundColor: '#E9EDF4', padding: 4, borderRadius: 13, marginTop: 17, marginBottom: 13 },
  sectionTab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 34, paddingHorizontal: 4, borderRadius: 10 },
  sectionTabActive: { backgroundColor: colors.white, shadowColor: '#132442', shadowOpacity: 0.07, shadowRadius: 4, elevation: 1 },
  sectionTabText: { color: colors.muted, fontSize: 9, fontWeight: '700' },
  sectionTabTextActive: { color: colors.primary },
  search: { height: 42, backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, fontSize: 11, color: colors.ink },
  filters: { flexDirection: 'row', gap: 6, marginTop: 10, marginBottom: 12 },
  filterChip: { paddingHorizontal: 9, paddingVertical: 7, borderRadius: 9, backgroundColor: colors.white },
  filterChipActive: { backgroundColor: '#EAF2FF' },
  filterText: { color: colors.muted, fontSize: 8, fontWeight: '600' },
  filterTextActive: { color: colors.primary, fontWeight: '800' },
  conversationList: { gap: 8 },
  conversationRow: { flexDirection: 'row', alignItems: 'center', padding: 11, borderRadius: 16 },
  contactAvatar: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  contactInitials: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  channelBadge: { position: 'absolute', right: -3, bottom: -3, width: 17, height: 17, borderRadius: 9, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  conversationCopy: { flex: 1, marginLeft: 11 },
  conversationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  contactName: { color: colors.ink, fontSize: 11, fontWeight: '800', flex: 1, marginRight: 8 },
  time: { color: colors.muted, fontSize: 8 },
  lastMessage: { color: colors.muted, fontSize: 9, marginTop: 5 },
  conversationMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  channelName: { color: colors.primary, fontSize: 8, fontWeight: '700' },
  metaDot: { color: colors.muted, fontSize: 8, marginHorizontal: 5 },
  modeLabel: { color: colors.muted, fontSize: 8 },
  unreadBadge: { width: 19, height: 19, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginLeft: 7 },
  unreadCount: { color: colors.white, fontSize: 8, fontWeight: '800' },
  demoNote: { color: colors.muted, fontSize: 8, lineHeight: 13, textAlign: 'center', marginTop: 15 },
  apiNotice: { padding: 10, marginTop: 12, backgroundColor: '#FFF8EE', borderColor: '#F6E5C8' },
  apiNoticeText: { color: '#7D633A', fontSize: 8, lineHeight: 13 },
  loading: { padding: 22 },
  empty: { color: colors.muted, fontSize: 11, textAlign: 'center', padding: 30 },
  leadActions: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  actionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, flex: 1, minHeight: 42, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.primary },
  actionButtonSecondary: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  actionButtonText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  actionButtonTextSecondary: { color: colors.ink },
  listCaption: { color: colors.muted, fontSize: 9, fontWeight: '700', marginBottom: 9 },
  leadList: { gap: 8 },
  leadRow: { flexDirection: 'row', alignItems: 'center', padding: 11, borderRadius: 15 },
  leadAvatar: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' },
  leadInitials: { color: colors.primary, fontSize: 10, fontWeight: '800' },
  leadCopy: { flex: 1, marginLeft: 10 },
  leadTitleLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  leadName: { color: colors.ink, fontSize: 10, fontWeight: '800', flex: 1, marginRight: 5 },
  leadStatus: { fontSize: 7, fontWeight: '800', overflow: 'hidden', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  leadCompany: { color: colors.muted, fontSize: 8, marginTop: 4 },
  leadSource: { color: colors.muted, fontSize: 7, marginTop: 4 },
  detailContainer: { flex: 1 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.white },
  backButton: { width: 28, alignItems: 'flex-start', justifyContent: 'center' },
  detailAvatar: { width: 37, height: 37, borderRadius: 13 },
  detailContact: { flex: 1, marginLeft: 9 },
  modeToolbar: { flexDirection: 'row', gap: 7, paddingHorizontal: 14, paddingTop: 9 },
  modeButton: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  modeButtonContent: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  modeButtonActive: { backgroundColor: '#EAF2FF', borderColor: '#D7E5FF' },
  modeButtonText: { color: colors.muted, fontSize: 8, fontWeight: '700' },
  modeButtonTextActive: { color: colors.primary },
  assignmentCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 14, marginTop: 9, padding: 9, borderRadius: 13 },
  assignmentIcon: { width: 29, height: 29, borderRadius: 10, backgroundColor: '#F0F4FA', alignItems: 'center', justifyContent: 'center' },
  assignmentCopy: { flex: 1, marginLeft: 8 },
  assignmentLabel: { color: colors.muted, fontSize: 7 },
  assignmentName: { color: colors.ink, fontSize: 9, fontWeight: '700', marginTop: 2 },
  assignButton: { backgroundColor: '#EAF2FF', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8 },
  assignText: { color: colors.primary, fontSize: 8, fontWeight: '800' },
  messageList: { flexGrow: 1, paddingHorizontal: 14, paddingTop: 15, paddingBottom: 15 },
  dayLabel: { color: colors.muted, fontSize: 8, fontWeight: '700', textAlign: 'center', marginBottom: 13 },
  messageLine: { flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 9 },
  messageLineOutgoing: { justifyContent: 'flex-end' },
  messageBubble: { maxWidth: '82%', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  messageBubbleOutgoing: { backgroundColor: colors.primary, borderColor: colors.primary, borderBottomRightRadius: 5 },
  messageBubbleAi: { backgroundColor: '#EEF4FF', borderColor: '#DDE9FF' },
  messageText: { color: colors.ink, fontSize: 10, lineHeight: 15 },
  messageTextOutgoing: { color: colors.white },
  messageTime: { color: colors.muted, fontSize: 7, textAlign: 'right', marginTop: 4 },
  messageTimeOutgoing: { color: '#DCE8FF' },
  aiMessageLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 5 },
  aiMessageLabel: { color: colors.primary, fontSize: 8, fontWeight: '800' },
  aiStatusRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, marginTop: 4 },
  aiStatus: { color: colors.primary, fontSize: 8, textAlign: 'center' },
  composer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.white },
  attachButton: { width: 31, height: 31, borderRadius: 11, backgroundColor: '#F0F4FA', alignItems: 'center', justifyContent: 'center' },
  messageInput: { flex: 1, maxHeight: 76, paddingHorizontal: 10, color: colors.ink, fontSize: 10 },
  sendButton: { width: 31, height: 31, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendButtonDisabled: { opacity: 0.55 },
  handoverHint: { color: colors.muted, fontSize: 8, textAlign: 'center', marginTop: 8 },
  formContent: { padding: 18, paddingBottom: 30 },
  formBack: { flexDirection: 'row', alignItems: 'center', marginBottom: 17 },
  formBackText: { color: colors.primary, fontSize: 10, fontWeight: '700', marginLeft: 4 },
  formField: { marginTop: 14 },
  fieldLabel: { color: colors.ink, fontSize: 10, fontWeight: '700', marginBottom: 6 },
  fieldInput: { minHeight: 43, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, borderRadius: 12, color: colors.ink, fontSize: 11 },
  ocrProgress: { padding: 11, marginTop: 12, backgroundColor: '#EEF4FF', borderColor: '#DDE9FF' },
  ocrProgressText: { color: colors.primary, fontSize: 9, fontWeight: '700' },
  formHint: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 11, marginTop: 17, marginBottom: 12, backgroundColor: '#FFF8EE', borderColor: '#F6E5C8' },
  formHintText: { color: '#7D633A', fontSize: 9, flex: 1, lineHeight: 14 },
  automationContent: { gap: 10 },
  automationMaster: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#EEF4FF', borderColor: '#DDE9FF' },
  automationIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#DCE8FF', alignItems: 'center', justifyContent: 'center' },
  automationCopy: { flex: 1, marginLeft: 9, marginRight: 7 },
  automationTitle: { color: colors.ink, fontSize: 10, fontWeight: '800' },
  automationHint: { color: colors.muted, fontSize: 8, lineHeight: 12, marginTop: 4 },
  sectionLabel: { color: colors.muted, fontSize: 8, fontWeight: '800', letterSpacing: 0.8, marginTop: 8 },
  settingRow: { flexDirection: 'row', alignItems: 'center', padding: 11 },
  settingCopy: { flex: 1, marginRight: 8 },
  settingTitle: { color: colors.ink, fontSize: 10, fontWeight: '700' },
  settingHint: { color: colors.muted, fontSize: 8, lineHeight: 13, marginTop: 4 },
  knowledgeList: { gap: 5, paddingHorizontal: 8 },
  knowledgeItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  fileIcon: { color: colors.primary, fontSize: 12, marginRight: 7 },
  fileName: { color: colors.ink, fontSize: 8, flex: 1 },
  ready: { color: '#16885A', fontSize: 7, fontWeight: '700' },
  scenarioCard: { padding: 11 },
  scenarioTitle: { color: colors.ink, fontSize: 9, fontWeight: '800' },
  scenarioText: { color: colors.muted, fontSize: 8, lineHeight: 13, marginTop: 4 },
});
