import { CenteredPageLoader } from '@/components/BrandLoader';
import { PopupError } from '@/components/PopupError';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { BookMarked, Bot, ChevronRight, ExternalLink, FileText, FolderOpen, Palette, Plus, Send, Settings, Sparkles, X } from 'lucide-react-native';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/core/auth/AuthProvider';
import {
  deleteAssistantConversation,
  generateUuidV4,
  getAssistantConversationState,
  listAssistantConversations,
  sendAssistantTurn,
} from '@/features/assistant/assistantApi';
import {
  SettingsPanel,
  StudioPanel,
} from '@/features/assistant/sections/MemoryWorkflowSettingsPanels';
import {
  ProjectsPanel,
  PromptLibraryPanel,
} from '@/features/assistant/sections/ProjectsAndPromptsPanels';
import type {
  AssistantChatMessage,
  AssistantConversationSummary,
  AssistantMode,
  AssistantModuleTab,
  AssistantProject,
  AssistantReply,
  AssistantTurnInput,
} from '@/features/assistant/types';
import { fetchCompanyBranches } from '@/features/overview/overviewApi';
import { colors } from '@/theme/colors';

const MODULE_TABS: Array<{ key: AssistantModuleTab; label: string; icon: LucideIcon }> = [
  { key: 'chat', label: 'Trò chuyện', icon: Sparkles },
  { key: 'agents', label: 'Trợ lý AI', icon: Bot },
  { key: 'projects', label: 'Dự án', icon: FolderOpen },
  { key: 'prompts', label: 'Thư viện', icon: BookMarked },
  { key: 'studio', label: 'Studio', icon: Palette },
  { key: 'settings', label: 'Cài đặt', icon: Settings },
];

const CHAT_SUGGESTIONS = [
  'Giải thích một khái niệm mới theo cách dễ hiểu',
  'Tóm tắt nội dung này thành các ý chính',
  'Soạn email chuyên nghiệp giúp tôi',
  'Đề xuất kế hoạch cho tuần làm việc',
];

const ACTION_SUGGESTIONS = [
  'Tạo phiếu nhập hàng',
  'Lập phiếu kiểm kê kho',
  'Tạo đề nghị nghỉ phép',
  'Tạo phiếu điều chuyển kho',
];

function formatDateLabel(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function ErpAssistantScreen({ embedded = false }: { embedded?: boolean } = {}) {
  const {
    user,
    activeBranchId: branchId,
    setActiveBranchId: setBranchId,
  } = useAuth();

  // Resolve active branchId (important for admin users whose /auth/me has no branchId)
  useEffect(() => {
    const canSwitchBranch = user?.role === 'admin' || user?.role === 'superadmin' || !user?.branchId;
    if (!canSwitchBranch && user?.branchId) {
      if (branchId !== user.branchId) setBranchId(user.branchId);
      return;
    }
    if (branchId) return;
    if (!user?.companyCode) return;
    const controller = new AbortController();
    void fetchCompanyBranches(controller.signal)
      .then((list) => {
        if (!controller.signal.aborted && list[0]?._id) {
          setBranchId(list[0]._id);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [branchId, setBranchId, user?.branchId, user?.companyCode, user?.role]);

  const [activeTab, setActiveTab] = useState<AssistantModuleTab>('chat');
  const [activeProject, setActiveProject] = useState<AssistantProject | null>(null);
  const [conversationId, setConversationId] = useState<string>(() => generateUuidV4());
  const [mode, setMode] = useState<AssistantMode>('qa');
  const [messages, setMessages] = useState<AssistantChatMessage[]>([]);
  const [lastReply, setLastReply] = useState<AssistantReply | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Confirmation password & reference selections state
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedRefs, setSelectedRefs] = useState<Record<string, string[]>>({});

  // History modal state
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyMode, setHistoryMode] = useState<AssistantMode>('qa');
  const [conversations, setConversations] = useState<AssistantConversationSummary[]>([]);

  const listRef = useRef<FlatList<AssistantChatMessage>>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  const startNewConversation = useCallback(() => {
    setConversationId(generateUuidV4());
    setMessages([]);
    setLastReply(null);
    setErrorBanner(null);
    setSelectedRefs({});
    setConfirmPassword('');
    setDraft('');
  }, []);

  const switchModuleTab = useCallback((tab: AssistantModuleTab) => {
    if (sending) return;
    if (tab === 'chat' || tab === 'agents') {
      const nextMode: AssistantMode = tab === 'agents' ? 'work' : 'qa';
      if (nextMode !== mode) {
        startNewConversation();
        setMode(nextMode);
      }
    }
    setActiveTab(tab);
  }, [mode, sending, startNewConversation]);

  const loadHistory = useCallback(
    async (query?: string, filterMode: AssistantMode = mode) => {
      setHistoryLoading(true);
      try {
        const page = await listAssistantConversations(query, { branchId });
        setConversations(page.items.filter((item) => (item.mode ?? 'work') === filterMode));
      } catch (err) {
        Alert.alert(
          'Không tải được lịch sử',
          err instanceof Error ? err.message : 'Vui lòng thử lại.',
        );
      } finally {
        setHistoryLoading(false);
      }
    },
    [branchId, mode],
  );

  const openHistory = useCallback(() => {
    const selectedMode: AssistantMode = activeTab === 'agents' ? 'work' : 'qa';
    setHistoryMode(selectedMode);
    setHistoryOpen(true);
    void loadHistory(historySearch, selectedMode);
  }, [activeTab, historySearch, loadHistory]);

  const selectConversation = useCallback(
    async (item: AssistantConversationSummary) => {
      setHistoryOpen(false);
      setConversationId(item.conversationId);
      setMode(historyMode);
      setLoadingConversation(true);
      setErrorBanner(null);
      setSelectedRefs({});
      setConfirmPassword('');
      try {
        const state = await getAssistantConversationState(item.conversationId, { branchId });
        setMessages(state.messages ?? []);
        setLastReply(state.lastReply ?? null);
        scrollToBottom();
      } catch (err) {
        setErrorBanner(
          err instanceof Error ? err.message : 'Không thể tải nội dung cuộc trò chuyện.',
        );
      } finally {
        setLoadingConversation(false);
      }
    },
    [branchId, historyMode, scrollToBottom],
  );

  const onDeleteConversation = useCallback(
    async (item: AssistantConversationSummary) => {
      try {
        await deleteAssistantConversation(item.conversationId, { branchId });
        setConversations((prev) =>
          prev.filter((c) => c.conversationId !== item.conversationId),
        );
        if (item.conversationId === conversationId) {
          startNewConversation();
        }
      } catch (err) {
        Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể xóa hội thoại.');
      }
    },
    [branchId, conversationId, startNewConversation],
  );

  const executeTurn = useCallback(
    async (payload: Omit<AssistantTurnInput, 'conversationId' | 'requestId' | 'mode'>, optimisticUserText?: string) => {
      if (sending) return;
      setSending(true);
      setErrorBanner(null);

      if (optimisticUserText) {
        setMessages((prev) => [
          ...prev,
          { role: 'user', content: optimisticUserText, createdAt: new Date().toISOString() },
        ]);
        scrollToBottom();
      }

      try {
        const reply = await sendAssistantTurn(
          {
            conversationId,
            requestId: generateUuidV4(),
            mode,
            ...(activeProject ? { projectId: activeProject.id } : {}),
            ...payload,
          },
          { branchId },
        );

        setLastReply(reply);
        setSelectedRefs({});
        setConfirmPassword('');
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: reply.reply || 'Đã xử lý yêu cầu.',
            createdAt: new Date().toISOString(),
            files: reply.files,
            sources: reply.sources,
          },
        ]);
        scrollToBottom();
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Không thể kết nối Trợ lý ERP. Vui lòng thử lại.';
        setErrorBanner(msg);
      } finally {
        setSending(false);
      }
    },
    [activeProject, branchId, conversationId, mode, scrollToBottom, sending],
  );

  const onSendText = useCallback(
    (overrideText?: string) => {
      const content = (overrideText ?? draft).trim();
      if (!content || sending) return;
      if (!overrideText) setDraft('');
      void executeTurn({ text: content }, content);
    },
    [draft, executeTurn, sending],
  );

  const onConfirmDecision = useCallback(
    (confirmed: boolean) => {
      if (!lastReply?.action || sending) return;
      if (confirmed && lastReply.action.requiresPassword && !confirmPassword.trim()) {
        Alert.alert('Cần mật khẩu xác nhận', 'Hãy nhập mật khẩu tài khoản để xác nhận thao tác.');
        return;
      }
      void executeTurn(
        {
          decision: {
            id: lastReply.action.id,
            confirmed,
            ...(confirmed && lastReply.action.requiresPassword
              ? { password: confirmPassword }
              : {}),
          },
        },
        confirmed ? `Xác nhận: ${lastReply.action.title}` : `Hủy: ${lastReply.action.title}`,
      );
    },
    [confirmPassword, executeTurn, lastReply, sending],
  );

  const toggleRefOption = useCallback((key: string, value: string, multiple: boolean) => {
    setSelectedRefs((prev) => {
      const current = prev[key] ?? [];
      if (!multiple) {
        return { ...prev, [key]: current[0] === value ? [] : [value] };
      }
      return {
        ...prev,
        [key]: current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value],
      };
    });
  }, []);

  const onSubmitReferences = useCallback(() => {
    if (!lastReply?.referenceSelections?.length || sending) return;
    const missing = lastReply.referenceSelections.find(
      (group) => group.required && !(selectedRefs[group.key]?.length > 0),
    );
    if (missing) {
      Alert.alert('Thiếu lựa chọn', `Vui lòng chọn mục "${missing.label}".`);
      return;
    }
    const summaryLabels = lastReply.referenceSelections
      .flatMap((group) => {
        const picked = selectedRefs[group.key] ?? [];
        return group.options.filter((o) => picked.includes(o.value)).map((o) => o.label);
      })
      .join(', ');
    void executeTurn(
      { referenceSelections: selectedRefs },
      summaryLabels ? `Đã chọn: ${summaryLabels}` : 'Gửi lựa chọn',
    );
  }, [executeTurn, lastReply, selectedRefs, sending]);

  const body = (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 84 : 0}
    >
      {/* Header */}
      <View style={styles.topBar}>
        <View style={styles.topCopy}>
          <Text style={styles.eyebrow}>MODULE TRỢ LÝ ERP</Text>
          <Text style={styles.title}>{activeTab === 'chat' ? 'Trò chuyện AI' : 'Trợ lý AI'}</Text>
        </View>
        {activeTab === 'chat' || activeTab === 'agents' ? (
          <View style={styles.topActions}>
            <Pressable accessibilityRole="button" disabled={sending} onPress={openHistory} style={styles.headerBtn}>
              <Text style={styles.headerBtnText}>Lịch sử</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={sending}
              onPress={startNewConversation}
              style={[styles.headerBtn, styles.headerBtnPrimary]}
            >
              <View style={styles.headerBtnPrimaryContent}><Plus size={15} color={colors.white} /><Text style={styles.headerBtnPrimaryText}>Mới</Text></View>
            </Pressable>
          </View>
        ) : null}
      </View>

      {/* Module Horizontal Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.moduleTabsRow}
        style={styles.moduleTabsScroll}
      >
        {MODULE_TABS.map((tab) => {
          const active = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              disabled={sending}
              onPress={() => switchModuleTab(tab.key)}
              style={[styles.moduleTabPill, active && styles.moduleTabPillActive]}
            >
              <Icon size={15} color={active ? colors.primary : colors.muted} />
              <Text style={[styles.moduleTabText, active && styles.moduleTabTextActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {activeTab === 'projects' ? (
        <ProjectsPanel
          branchId={branchId}
          onOpenProjectChat={(project) => {
            setActiveProject(project);
            startNewConversation();
            setMode('qa');
            setActiveTab('chat');
          }}
        />
      ) : activeTab === 'prompts' ? (
        <PromptLibraryPanel
          onUsePrompt={(promptText) => {
            startNewConversation();
            setDraft(promptText);
            setMode('qa');
            setActiveTab('chat');
          }}
        />
      ) : activeTab === 'studio' ? (
        <StudioPanel />
      ) : activeTab === 'settings' ? (
        <SettingsPanel />
      ) : (
        <>
          {/* Active Project Badge */}
          {activeProject ? (
            <View style={styles.projectBanner}>
              <View style={styles.projectBannerContent}><FolderOpen size={15} color={colors.primary} /><Text numberOfLines={1} style={styles.projectBannerText}>Dự án: {activeProject.name}</Text></View>
              <Pressable onPress={() => setActiveProject(null)} hitSlop={8}>
                <X size={16} color={colors.primary} />
              </Pressable>
            </View>
          ) : null}

      {errorBanner ? (
        <PopupError error={errorBanner} />
      ) : null}

      {/* Conversation Area */}
      {loadingConversation ? (
        <View style={styles.centered}>
          <CenteredPageLoader />
        </View>
      ) : messages.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContent}
          showsVerticalScrollIndicator={false}
        >
          <Card style={styles.assistantCard}>
            <View style={styles.assistantIcon}>
              <Sparkles size={25} color={colors.primary} />
            </View>
            <Text style={styles.assistantTitle}>{activeTab === 'agents' ? 'Thao tác cùng ERP' : 'Hỏi đáp chung'}</Text>
            <Text style={styles.assistantText}>{activeTab === 'agents'
              ? 'Mô tả nghiệp vụ cần thực hiện. Trợ lý sẽ kiểm tra dữ liệu, hỏi thông tin còn thiếu và yêu cầu xác nhận trước khi cập nhật ERP.'
              : 'Đặt câu hỏi, nhờ giải thích, tóm tắt hoặc soạn nội dung. Chế độ này chỉ dùng để hỏi đáp chung.'}</Text>
          </Card>

          <Text style={styles.sectionTitle}>{activeTab === 'agents' ? 'Gợi ý thao tác ERP' : 'Gợi ý hỏi đáp'}</Text>
          <View style={styles.suggestions}>
            {(activeTab === 'agents' ? ACTION_SUGGESTIONS : CHAT_SUGGESTIONS).map((suggestion) => (
              <Card
                key={suggestion}
                onPress={() => onSendText(suggestion)}
                style={styles.suggestion}
              >
                <Text style={styles.suggestionText}>{suggestion}</Text>
                <ChevronRight size={17} color={colors.primary} />
              </Card>
            ))}
          </View>
        </ScrollView>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(_, index) => `${conversationId}-${index}`}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isUser = item.role === 'user';
            return (
              <View style={[styles.msgRow, isUser && styles.msgRowUser]}>
                {!isUser ? <View style={styles.botLabelRow}><Sparkles size={12} color={colors.primary} /><Text style={styles.botLabel}>{activeTab === 'agents' ? 'Trợ lý ERP' : 'Trợ lý AI'}</Text></View> : null}
                <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
                  <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
                    {item.content}
                  </Text>

                  {item.files?.length ? (
                    <View style={styles.metaBox}>
                      {item.files.map((file) => (
                        <View key={file.id} style={styles.metaRow}><FileText size={13} color={colors.primary} /><Text numberOfLines={1} style={styles.metaLink}>{file.fileName}</Text></View>
                      ))}
                    </View>
                  ) : null}

                  {item.sources?.length ? (
                    <View style={styles.metaBox}>
                      {item.sources.slice(0, 3).map((src, idx) => (
                        <View key={`${src.url}-${idx}`} style={styles.metaRow}><ExternalLink size={13} color={colors.primary} /><Text numberOfLines={1} style={styles.metaSource}>{src.title || src.url}</Text></View>
                      ))}
                    </View>
                  ) : null}
                </View>
              </View>
            );
          }}
          ListFooterComponent={
            <View style={styles.footerWrap}>
              {sending ? (
                <View style={styles.thinkingRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.thinkingText}>{activeTab === 'agents' ? 'Trợ lý ERP đang xử lý...' : 'Trợ lý AI đang trả lời...'}</Text>
                </View>
              ) : null}

              {/* Pending Action Confirmation Card */}
              {activeTab === 'agents' && !sending && lastReply?.status === 'confirmation' && lastReply.action ? (
                <Card style={styles.actionCard}>
                  <Text style={styles.actionTitle}>Xác nhận thao tác ERP</Text>
                  <Text style={styles.actionSubtitle}>{lastReply.action.title}</Text>
                  <View style={styles.actionValues}>
                    {lastReply.action.values.map((v, idx) => (
                      <View key={`${v.label}-${idx}`} style={styles.actionValueRow}>
                        <Text style={styles.actionValueLabel}>{v.label}</Text>
                        <Text style={styles.actionValueText}>{String(v.value)}</Text>
                      </View>
                    ))}
                  </View>
                  {lastReply.action.requiresPassword ? (
                    <TextInput
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Nhập mật khẩu để xác nhận..."
                      placeholderTextColor={colors.muted}
                      secureTextEntry
                      style={styles.passwordInput}
                    />
                  ) : null}
                  <View style={styles.actionButtons}>
                    <Pressable
                      onPress={() => onConfirmDecision(false)}
                      style={styles.cancelActionBtn}
                    >
                      <Text style={styles.cancelActionText}>Hủy bỏ</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => onConfirmDecision(true)}
                      style={styles.confirmActionBtn}
                    >
                      <Text style={styles.confirmActionText}>Xác nhận</Text>
                    </Pressable>
                  </View>
                </Card>
              ) : null}

              {/* Reference Selection Card */}
              {activeTab === 'agents' && !sending && lastReply?.referenceSelections?.length ? (
                <Card style={styles.actionCard}>
                  <Text style={styles.actionTitle}>Chọn thông tin tham chiếu</Text>
                  {lastReply.referenceSelections.map((group) => (
                    <View key={group.key} style={styles.refGroup}>
                      <Text style={styles.refLabel}>
                        {group.label}
                        {group.required ? ' *' : ''}
                      </Text>
                      <View style={styles.refOptions}>
                        {group.options.slice(0, 12).map((opt) => {
                          const picked = (selectedRefs[group.key] ?? []).includes(opt.value);
                          return (
                            <Pressable
                              key={opt.value}
                              onPress={() =>
                                toggleRefOption(group.key, opt.value, group.multiple)
                              }
                              style={[styles.refChip, picked && styles.refChipActive]}
                            >
                              <Text
                                numberOfLines={1}
                                style={[styles.refChipText, picked && styles.refChipTextActive]}
                              >
                                {opt.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ))}
                  <Pressable onPress={onSubmitReferences} style={styles.confirmActionBtn}>
                    <Text style={styles.confirmActionText}>Gửi lựa chọn</Text>
                  </Pressable>
                </Card>
              ) : null}
            </View>
          }
        />
      )}

      {/* Composer */}
      <View style={styles.composerWrap}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={activeTab === 'agents' ? 'Mô tả thao tác cần thực hiện trên ERP...' : 'Hỏi bất kỳ điều gì...'}
          placeholderTextColor={colors.muted}
          multiline
          editable={!sending}
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          disabled={sending || !draft.trim()}
          onPress={() => onSendText()}
          style={[styles.sendButton, (sending || !draft.trim()) && styles.sendButtonDisabled]}
        >
          {sending ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Send size={17} color={colors.white} />
          )}
        </Pressable>
      </View>
        </>
      )}

      {/* History Modal */}
      <Modal
        visible={historyOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setHistoryOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setHistoryOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{historyMode === 'qa' ? 'Lịch sử Trò chuyện AI' : 'Lịch sử thao tác ERP'}</Text>
              <Pressable onPress={() => setHistoryOpen(false)} hitSlop={8}>
                <Text style={styles.modalClose}>Đóng</Text>
              </Pressable>
            </View>

            <View style={styles.searchRow}>
              <TextInput
                value={historySearch}
                onChangeText={setHistorySearch}
                onSubmitEditing={() => {
                  void loadHistory(historySearch, historyMode);
                }}
                placeholder="Tìm hội thoại..."
                placeholderTextColor={colors.muted}
                style={styles.searchInput}
              />
              <Pressable
                onPress={() => {
                  void loadHistory(historySearch, historyMode);
                }}
                style={styles.searchBtn}
              >
                <Text style={styles.searchBtnText}>Tìm</Text>
              </Pressable>
            </View>

            {historyLoading ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : (
              <ScrollView style={styles.historyList} showsVerticalScrollIndicator={false}>
                {conversations.map((item) => {
                  const active = item.conversationId === conversationId;
                  return (
                    <View
                      key={item.conversationId}
                      style={[styles.historyRow, active && styles.historyRowActive]}
                    >
                      <Pressable
                        onPress={() => {
                          void selectConversation(item);
                        }}
                        style={styles.historyCopy}
                      >
                        <Text numberOfLines={1} style={styles.historyTitle}>
                          {item.title || 'Cuộc trò chuyện'}
                        </Text>
                        <Text numberOfLines={1} style={styles.historyPreview}>
                          {item.preview || `${item.messageCount} tin nhắn`}
                        </Text>
                        <Text style={styles.historyTime}>{formatDateLabel(item.updatedAt)}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          void onDeleteConversation(item);
                        }}
                        hitSlop={8}
                        style={styles.deleteBtn}
                      >
                        <Text style={styles.deleteBtnText}>Xóa</Text>
                      </Pressable>
                    </View>
                  );
                })}
                {!conversations.length ? (
                  <Text style={styles.emptyHistoryText}>Chưa có lịch sử trò chuyện nào.</Text>
                ) : null}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );

  return embedded ? body : <Screen>{body}</Screen>;
}

export function EmbeddedErpAssistantScreen() {
  return <ErpAssistantScreen embedded />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  topCopy: { flex: 1 },
  eyebrow: { color: colors.primary, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  title: { color: colors.ink, fontSize: 23, fontWeight: '800', marginTop: 3 },
  topActions: { flexDirection: 'row', gap: 7 },
  headerBtn: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
  },
  headerBtnText: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  headerBtnPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  headerBtnPrimaryContent: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  headerBtnPrimaryText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  moduleTabsScroll: { flexGrow: 0, marginBottom: 10 },
  moduleTabsRow: { paddingHorizontal: 18, gap: 7 },
  moduleTabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 99,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  moduleTabPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  moduleTabText: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  moduleTabTextActive: { color: colors.white },
  projectBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 18,
    marginBottom: 8,
    backgroundColor: '#EAF2FF',
    borderColor: '#BFD7FF',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 7,
    gap: 8,
  },
  projectBannerText: { color: colors.primary, fontSize: 11, fontWeight: '700', flex: 1 },
  projectBannerContent: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 7 },
  errorStrip: {
    marginHorizontal: 18,
    marginBottom: 8,
    backgroundColor: '#FFF5F5',
    borderColor: '#FAD4D4',
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  errorStripText: { color: '#B91C1C', fontSize: 11, lineHeight: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  stateText: { color: colors.muted, fontSize: 11 },
  emptyContent: { paddingHorizontal: 18, paddingBottom: 20 },
  assistantCard: {
    alignItems: 'center',
    padding: 20,
    marginTop: 8,
    backgroundColor: '#EEF4FF',
    borderColor: '#DDE9FF',
  },
  assistantIcon: {
    width: 50,
    height: 50,
    borderRadius: 17,
    backgroundColor: '#DCE8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  assistantTitle: { color: colors.ink, fontSize: 15, fontWeight: '800', marginTop: 10 },
  assistantText: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 280,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 20,
    marginBottom: 10,
  },
  suggestions: { gap: 8 },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  suggestionText: { color: colors.ink, fontSize: 11, fontWeight: '600', flex: 1 },
  messagesContent: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 18, gap: 12 },
  msgRow: { alignItems: 'flex-start', maxWidth: '88%' },
  msgRowUser: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  botLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4, marginLeft: 4 },
  botLabel: { color: colors.primary, fontSize: 10, fontWeight: '800' },
  bubble: { borderRadius: 16, paddingHorizontal: 13, paddingVertical: 10, maxWidth: '100%' },
  bubbleBot: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  bubbleUser: { backgroundColor: colors.primary },
  bubbleText: { color: colors.ink, fontSize: 13, lineHeight: 20 },
  bubbleTextUser: { color: colors.white },
  metaBox: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 4,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaLink: { flex: 1, color: colors.primary, fontSize: 11, fontWeight: '700' },
  metaSource: { color: colors.muted, fontSize: 10 },
  footerWrap: { gap: 10, marginTop: 8 },
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  thinkingText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  actionCard: {
    padding: 14,
    backgroundColor: '#F8FBFF',
    borderColor: '#CFE0FF',
    gap: 10,
  },
  actionTitle: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  actionSubtitle: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  actionValues: { gap: 6 },
  actionValueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingBottom: 5,
  },
  actionValueLabel: { color: colors.muted, fontSize: 11 },
  actionValueText: { color: colors.ink, fontSize: 11, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  passwordInput: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 8,
    fontSize: 12,
    color: colors.ink,
  },
  actionButtons: { flexDirection: 'row', gap: 8 },
  cancelActionBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 11,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelActionText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  confirmActionBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmActionText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  refGroup: { gap: 6 },
  refLabel: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  refOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  refChip: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  refChipActive: { backgroundColor: '#EAF2FF', borderColor: colors.primary },
  refChipText: { color: colors.ink, fontSize: 11 },
  refChipTextActive: { color: colors.primary, fontWeight: '700' },
  composerWrap: {
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
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { opacity: 0.45 },

  // History modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 26,
    maxHeight: '80%',
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
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  searchInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 12,
    color: colors.ink,
  },
  searchBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  modalLoading: { paddingVertical: 30, alignItems: 'center' },
  historyList: { maxHeight: 360 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 11,
    borderRadius: 13,
    gap: 10,
    marginBottom: 6,
    backgroundColor: '#F8FAFD',
  },
  historyRowActive: { backgroundColor: '#EAF2FF' },
  historyCopy: { flex: 1 },
  historyTitle: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  historyPreview: { color: colors.muted, fontSize: 11, marginTop: 2 },
  historyTime: { color: colors.muted, fontSize: 9, marginTop: 4 },
  deleteBtn: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: '#FCEBEC' },
  deleteBtnText: { color: '#C74848', fontSize: 10, fontWeight: '700' },
  emptyHistoryText: { color: colors.muted, fontSize: 11, textAlign: 'center', paddingVertical: 24 },
});

