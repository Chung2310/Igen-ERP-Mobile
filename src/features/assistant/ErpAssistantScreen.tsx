import { CenteredPageLoader } from '@/components/BrandLoader';
import { PopupError } from '@/components/PopupError';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Keyboard,
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
import {
  ArrowLeftRight,
  ArrowUp,
  BookMarked,
  Bot,
  CalendarCheck,
  CalendarMinus,
  Check,
  ChevronDown,
  ClipboardCheck,
  ExternalLink,
  FileText,
  FolderOpen,
  Mail,
  MessageSquare,
  Mic,
  NotebookPen,
  PackagePlus,
  Palette,
  PenLine,
  Plus,
  Search,
  Settings,
  Sparkles,
  Square,
  SquarePen,
  Trash2,
  WandSparkles,
  X,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/core/auth/AuthProvider';
import {
  deleteAssistantConversation,
  generateUuidV4,
  getAssistantConversationState,
  getAssistantSettings,
  listAssistantConversations,
  sendAssistantTurn,
} from '@/features/assistant/assistantApi';
import {
  MemoryPanel,
  SettingsPanel,
  StudioPanel,
  WorkflowsPanel,
} from '@/features/assistant/sections/MemoryWorkflowSettingsPanels';
import { AgentsPanel } from '@/features/assistant/sections/AgentsPanel';
import { AssistantToolsPanel } from '@/features/assistant/sections/AssistantToolsPanel';
import { MeetingNotesPanel } from '@/features/assistant/sections/MeetingNotesPanel';
import { NotebookPanel } from '@/features/assistant/sections/NotebookPanel';
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
  AssistantSettings,
  AssistantTurnInput,
} from '@/features/assistant/types';
import { fetchCompanyBranches } from '@/features/overview/overviewApi';
import { colors } from '@/theme/colors';

const MODULE_TABS: Array<{ key: AssistantModuleTab; label: string; icon: LucideIcon }> = [
  { key: 'chat', label: 'Trò chuyện', icon: Sparkles },
  { key: 'erp', label: 'Thao tác', icon: Bot },
  { key: 'agents', label: 'Agent AI', icon: Bot },
  { key: 'projects', label: 'Dự án', icon: FolderOpen },
  { key: 'prompts', label: 'Thư viện', icon: BookMarked },
  { key: 'studio', label: 'Studio', icon: Palette },
  { key: 'notebook', label: 'Notebook', icon: NotebookPen },
  { key: 'meeting', label: 'Ghi chép họp', icon: Mic },
  { key: 'tools', label: 'Công cụ', icon: WandSparkles },
  { key: 'memory', label: 'Ghi nhớ', icon: FileText },
  { key: 'workflows', label: 'Quy trình', icon: Settings },
  { key: 'settings', label: 'Cài đặt', icon: Settings },
];

const CHAT_SUGGESTIONS: Array<{ text: string; Icon: LucideIcon }> = [
  { text: 'Giải thích một khái niệm mới theo cách dễ hiểu', Icon: PenLine },
  { text: 'Tóm tắt nội dung này thành các ý chính', Icon: FileText },
  { text: 'Soạn email chuyên nghiệp giúp tôi', Icon: Mail },
  { text: 'Đề xuất kế hoạch cho tuần làm việc', Icon: CalendarCheck },
];

const ACTION_SUGGESTIONS: Array<{ text: string; Icon: LucideIcon }> = [
  { text: 'Tạo phiếu nhập hàng', Icon: PackagePlus },
  { text: 'Lập phiếu kiểm kê kho', Icon: ClipboardCheck },
  { text: 'Tạo đề nghị nghỉ phép', Icon: CalendarMinus },
  { text: 'Tạo phiếu điều chuyển kho', Icon: ArrowLeftRight },
];

function IgenSparkleMark({ size = 34 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <Defs>
        <LinearGradient id="igenSparkleGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#38BDF8" />
          <Stop offset="45%" stopColor="#2463EB" />
          <Stop offset="78%" stopColor="#7C3AED" />
          <Stop offset="100%" stopColor="#22C55E" />
        </LinearGradient>
      </Defs>
      <Path
        d="M18 2C19.6 11.4 24.6 16.4 34 18C24.6 19.6 19.6 24.6 18 34C16.4 24.6 11.4 19.6 2 18C11.4 16.4 16.4 11.4 18 2Z"
        fill="url(#igenSparkleGrad)"
      />
    </Svg>
  );
}

function TwoLineMenuIcon({ color = colors.ink }: { color?: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path d="M3 7.5H17" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
      <Path d="M3 12.5H17" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  );
}

function AiThinkingBubble() {
  const spinAnim = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0.35)).current;
  const dot2 = useRef(new Animated.Value(0.35)).current;
  const dot3 = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const spinLoop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1350,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    const makeDotPulse = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.timing(val, { toValue: 0.35, duration: 320, useNativeDriver: true }),
          Animated.delay(Math.max(0, 380 - delay)),
        ]),
      );

    const p1 = makeDotPulse(dot1, 0);
    const p2 = makeDotPulse(dot2, 140);
    const p3 = makeDotPulse(dot3, 280);

    spinLoop.start();
    p1.start();
    p2.start();
    p3.start();

    return () => {
      spinLoop.stop();
      p1.stop();
      p2.stop();
      p3.stop();
    };
  }, [dot1, dot2, dot3, spinAnim]);

  const rotate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.thinkingGlowStage}>
      {/* Orbiting Gaussian-style backlit glow behind the pure white pill */}
      <Animated.View
        pointerEvents="none"
        renderToHardwareTextureAndroid
        shouldRasterizeIOS
        style={[styles.thinkingOuterHaloWrap, { transform: [{ rotate }] }]}
      >
        <Svg width={94} height={94} viewBox="0 0 94 94" fill="none">
          <Defs>
            <RadialGradient id="thinkingBacklightBlue" cx="50%" cy="68%" r="28%">
              <Stop offset="0%" stopColor="#3B82F6" stopOpacity="0.52" />
              <Stop offset="32%" stopColor="#60A5FA" stopOpacity="0.32" />
              <Stop offset="65%" stopColor="#93C5FD" stopOpacity="0.11" />
              <Stop offset="100%" stopColor="#93C5FD" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="thinkingBacklightViolet" cx="66%" cy="60%" r="25%">
              <Stop offset="0%" stopColor="#818CF8" stopOpacity="0.34" />
              <Stop offset="40%" stopColor="#A5B4FC" stopOpacity="0.18" />
              <Stop offset="75%" stopColor="#C7D2FE" stopOpacity="0.06" />
              <Stop offset="100%" stopColor="#C7D2FE" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="94" height="94" fill="url(#thinkingBacklightBlue)" />
          <Rect x="0" y="0" width="94" height="94" fill="url(#thinkingBacklightViolet)" />
        </Svg>
      </Animated.View>

      {/* Pure solid white pill on top — zero border, cleanly reveals only the backlit glow */}
      <View style={styles.thinkingBubbleSolid}>
        <Animated.View style={[styles.thinkingDot, { opacity: dot1 }]} />
        <Animated.View style={[styles.thinkingDot, { opacity: dot2 }]} />
        <Animated.View style={[styles.thinkingDot, { opacity: dot3 }]} />
      </View>
    </View>
  );
}

function formatDateLabel(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function ErpAssistantScreen({
  embedded = false,
  chatOnly = false,
  onClose,
}: {
  embedded?: boolean;
  chatOnly?: boolean;
  onClose?: () => void;
} = {}) {
  const insets = useSafeAreaInsets();
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
  const [assistantSettings, setAssistantSettings] = useState<AssistantSettings | null>(null);

  // Confirmation password & reference selections state
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedRefs, setSelectedRefs] = useState<Record<string, string[]>>({});

  // History modal & mode dropdown state
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historySearchOpen, setHistorySearchOpen] = useState(false);
  const [historyMode, setHistoryMode] = useState<AssistantMode>('qa');
  const [conversations, setConversations] = useState<AssistantConversationSummary[]>([]);
  const [historyActionItem, setHistoryActionItem] = useState<AssistantConversationSummary | null>(null);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const keyboardVisible = keyboardHeight > 0;

  const listRef = useRef<FlatList<AssistantChatMessage>>(null);
  const activeTurnAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (event) => {
      const rawHeight = event.endCoordinates?.height ?? 0;
      setKeyboardHeight(rawHeight);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [chatOnly, insets.bottom]);

  useEffect(() => {
    const controller = new AbortController();
    void getAssistantSettings(controller.signal).then(setAssistantSettings).catch(() => {});
    return () => controller.abort();
  }, []);

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
    if (tab === 'chat' || tab === 'erp') {
      const nextMode: AssistantMode = tab === 'erp' ? 'work' : 'qa';
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
    const selectedMode: AssistantMode = activeTab === 'erp' ? 'work' : 'qa';
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

  const stopCurrentTurn = useCallback(() => {
    if (!activeTurnAbortRef.current) return;
    activeTurnAbortRef.current.abort();
    activeTurnAbortRef.current = null;
    setSending(false);
  }, []);

  const executeTurn = useCallback(
    async (payload: Omit<AssistantTurnInput, 'conversationId' | 'requestId' | 'mode'>, optimisticUserText?: string) => {
      if (sending) return;
      const controller = new AbortController();
      activeTurnAbortRef.current = controller;
      setSending(true);
      setErrorBanner(null);
      setDraft('');
      Keyboard.dismiss();

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
          { branchId, signal: controller.signal },
        );

        if (controller.signal.aborted) return;

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
        if (controller.signal.aborted) return;
        const msg =
          err instanceof Error ? err.message : 'Không thể kết nối Trợ lý ERP. Vui lòng thử lại.';
        setErrorBanner(msg);
      } finally {
        if (activeTurnAbortRef.current === controller) {
          activeTurnAbortRef.current = null;
          setSending(false);
        }
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

  const isChatSurface = chatOnly || activeTab === 'chat' || activeTab === 'erp';
  const greetingName = user?.displayName?.trim() || '';

  const body = (
    <KeyboardAvoidingView
      style={[
        styles.root,
        isChatSurface && styles.rootChat,
        Platform.OS === 'android' && keyboardHeight > 0 ? { paddingBottom: keyboardHeight } : null,
      ]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? (chatOnly ? 0 : 84) : 0}
    >
      {/* Header */}
      {isChatSurface ? (
        <View style={styles.geminiTopBar}>
          <View style={styles.geminiTopLeft}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mở lịch sử trò chuyện"
              disabled={sending}
              onPress={openHistory}
              hitSlop={10}
              style={({ pressed }) => [styles.geminiIconBtn, pressed && styles.geminiBtnPressed]}
            >
              <TwoLineMenuIcon color={colors.ink} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Chọn chế độ trò chuyện"
              disabled={sending}
              onPress={() => setModeMenuOpen(true)}
              style={({ pressed }) => [styles.geminiBrandTrigger, pressed && styles.geminiBtnPressed]}
            >
              <Text style={styles.geminiBrandTitle}>iGen AI</Text>
              <Text style={styles.geminiBrandMode}>
                {activeTab === 'erp' ? 'Thao tác' : 'Trò chuyện'}
              </Text>
              <ChevronDown size={15} strokeWidth={1.8} color="#64748B" />
            </Pressable>
          </View>
          <View style={styles.geminiTopRight}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cuộc trò chuyện mới"
              disabled={sending}
              onPress={startNewConversation}
              hitSlop={10}
              style={({ pressed }) => [styles.geminiIconBtn, pressed && styles.geminiBtnPressed]}
            >
              <SquarePen size={20} strokeWidth={1.7} color={colors.ink} />
            </Pressable>
            {chatOnly && onClose ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đóng trò chuyện"
                onPress={onClose}
                hitSlop={10}
                style={({ pressed }) => [styles.geminiIconBtn, pressed && styles.geminiBtnPressed]}
              >
                <X size={21} strokeWidth={1.8} color={colors.ink} />
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : (
        <View style={styles.topBar}>
          <View style={styles.topCopy}>
            <Text style={styles.eyebrow}>MODULE TRỢ LÝ ERP</Text>
            <Text style={styles.title}>Trợ lý AI</Text>
          </View>
        </View>
      )}

      {/* Module Horizontal Tabs (hidden in focused chatOnly mode) */}
      {!chatOnly ? (
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
                <Icon size={14} strokeWidth={1.7} color={active ? colors.white : colors.muted} />
                <Text style={[styles.moduleTabText, active && styles.moduleTabTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {!chatOnly && activeTab === 'projects' ? (
        <ProjectsPanel
          branchId={branchId}
          onOpenProjectChat={(project) => {
            setActiveProject(project);
            startNewConversation();
            setMode('qa');
            setActiveTab('chat');
          }}
        />
      ) : !chatOnly && activeTab === 'prompts' ? (
        <PromptLibraryPanel
          onUsePrompt={(promptText) => {
            startNewConversation();
            setDraft(promptText);
            setMode('qa');
            setActiveTab('chat');
          }}
        />
      ) : !chatOnly && activeTab === 'studio' ? (
        <StudioPanel />
      ) : !chatOnly && activeTab === 'notebook' ? (
        <NotebookPanel />
      ) : !chatOnly && activeTab === 'meeting' ? (
        <MeetingNotesPanel />
      ) : !chatOnly && activeTab === 'tools' ? (
        <AssistantToolsPanel onUsePrompt={(prompt) => {
          startNewConversation();
          setDraft(prompt);
          setMode('qa');
          setActiveTab('chat');
        }} />
      ) : !chatOnly && activeTab === 'memory' ? (
        <MemoryPanel />
      ) : !chatOnly && activeTab === 'workflows' ? (
        <WorkflowsPanel />
      ) : !chatOnly && activeTab === 'settings' ? (
        <SettingsPanel onSettingsSaved={setAssistantSettings} />
      ) : !chatOnly && activeTab === 'agents' ? (
        <AgentsPanel />
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
          contentContainerStyle={styles.geminiEmptyContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.geminiHero}>
            <IgenSparkleMark size={36} />
            <Text style={styles.geminiGreeting}>
              {greetingName ? `Xin chào ${greetingName},` : 'Xin chào,'}
              {'\n'}
              {activeTab === 'erp' ? 'bạn muốn thao tác gì?' : 'hôm nay bạn cần gì?'}
            </Text>
          </View>

          {assistantSettings?.showSuggestions !== false ? (
            <View style={styles.geminiSuggestions}>
              {(activeTab === 'erp' ? ACTION_SUGGESTIONS : CHAT_SUGGESTIONS).map(({ text, Icon }) => (
                <Pressable
                  key={text}
                  accessibilityRole="button"
                  onPress={() => onSendText(text)}
                  style={({ pressed }) => [
                    styles.geminiSuggestionRow,
                    pressed && styles.geminiSuggestionPressed,
                  ]}
                >
                  <View style={styles.geminiSuggestionIcon}>
                    <Icon size={18} strokeWidth={1.6} color="#334155" />
                  </View>
                  <Text style={styles.geminiSuggestionText}>{text}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </ScrollView>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(_, index) => `${conversationId}-${index}`}
          contentContainerStyle={styles.messagesContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isUser = item.role === 'user';
            return (
              <View style={[styles.msgRow, isUser && styles.msgRowUser]}>
                {!isUser ? (
                  <View style={styles.botLabelRow}>
                    <IgenSparkleMark size={16} />
                    <Text style={styles.botLabel}>
                      {activeTab === 'erp' ? 'iGen AI · Thao tác' : 'iGen AI'}
                    </Text>
                  </View>
                ) : null}
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
              {sending ? <AiThinkingBubble /> : null}

              {/* Pending Action Confirmation Card */}
              {activeTab === 'erp' && !sending && lastReply?.status === 'confirmation' && lastReply.action ? (
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
              {activeTab === 'erp' && !sending && lastReply?.referenceSelections?.length ? (
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

      {/* Gemini-style bottom aura (welcome only) + 2-mode pill toggle + floating rounded pill composer */}
      <View style={[styles.geminiBottomDock, keyboardVisible && styles.geminiBottomDockKeyboard]}>
        {messages.length === 0 ? (
          <Svg
            pointerEvents="none"
            width="100%"
            height="100%"
            viewBox="0 0 360 140"
            preserveAspectRatio="none"
            style={StyleSheet.absoluteFill}
          >
            <Defs>
              <LinearGradient id="geminiBottomGlow" x1="0.5" y1="0" x2="0.5" y2="1">
                <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
                <Stop offset="42%" stopColor="#EAF3FF" stopOpacity="0.88" />
                <Stop offset="100%" stopColor="#DCEBFF" stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="360" height="140" fill="url(#geminiBottomGlow)" />
          </Svg>
        ) : null}

        {/* Centered 2-mode toggle: Trò chuyện | Thao tác (hidden while typing or sending like Gemini) */}
        {!keyboardVisible && !sending ? (
          <View style={styles.modeToggleRow}>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'chat' }}
              disabled={sending}
              onPress={() => switchModuleTab('chat')}
              style={[styles.modeToggleBtn, activeTab === 'chat' && styles.modeToggleBtnActive]}
            >
              <Text style={[styles.modeToggleText, activeTab === 'chat' && styles.modeToggleTextActive]}>
                Trò chuyện
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'erp' }}
              disabled={sending}
              onPress={() => switchModuleTab('erp')}
              style={[styles.modeToggleBtn, activeTab === 'erp' && styles.modeToggleBtnActive]}
            >
              <Text style={[styles.modeToggleText, activeTab === 'erp' && styles.modeToggleTextActive]}>
                Thao tác
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Floating white pill composer */}
        <View style={styles.geminiComposerPill}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tạo hội thoại mới"
            disabled={sending}
            onPress={startNewConversation}
            hitSlop={8}
            style={({ pressed }) => [styles.geminiPlusBtn, pressed && styles.geminiBtnPressed]}
          >
            <Plus size={21} strokeWidth={1.7} color="#334155" />
          </Pressable>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={activeTab === 'erp' ? 'Yêu cầu thao tác ERP...' : 'Hỏi iGen AI'}
            placeholderTextColor="#8A96A8"
            multiline
            submitBehavior={assistantSettings?.enterToSend ? 'submit' : 'newline'}
            returnKeyType={assistantSettings?.enterToSend ? 'send' : 'default'}
            onSubmitEditing={() => {
              if (assistantSettings?.enterToSend) onSendText(draft);
            }}
            editable={!sending}
            style={styles.geminiInput}
          />
          {sending ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dừng phản hồi"
              onPress={stopCurrentTurn}
              style={({ pressed }) => [styles.geminiStopBtn, pressed && styles.geminiBtnPressed]}
            >
              <Square size={14} strokeWidth={1.9} color="#1F2937" />
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Gửi tin nhắn"
              disabled={!draft.trim()}
              onPress={() => onSendText()}
              style={[
                styles.geminiSendBtn,
                draft.trim() ? styles.geminiSendBtnReady : styles.geminiSendBtnIdle,
              ]}
            >
              <ArrowUp
                size={19}
                strokeWidth={2}
                color={draft.trim() ? colors.white : colors.primary}
              />
            </Pressable>
          )}
        </View>
      </View>
        </>
      )}

      {/* Floating Mode Dropdown Popover (Gemini style) */}
      <Modal
        visible={modeMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setModeMenuOpen(false)}
      >
        <Pressable style={styles.modePopoverBackdrop} onPress={() => setModeMenuOpen(false)}>
          <Pressable style={styles.modePopoverCard} onPress={() => {}}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setModeMenuOpen(false);
                switchModuleTab('chat');
              }}
              style={({ pressed }) => [
                styles.modePopoverItem,
                pressed && styles.modePopoverItemPressed,
              ]}
            >
              <View style={styles.modePopoverIconCol}>
                {activeTab === 'chat' ? <Check size={17} strokeWidth={2} color={colors.ink} /> : null}
              </View>
              <View style={styles.modePopoverCopy}>
                <Text style={styles.modePopoverTitle}>Trò chuyện</Text>
                <Text style={styles.modePopoverSub}>Hỏi đáp chung, giải thích & soạn nội dung</Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setModeMenuOpen(false);
                switchModuleTab('erp');
              }}
              style={({ pressed }) => [
                styles.modePopoverItem,
                pressed && styles.modePopoverItemPressed,
              ]}
            >
              <View style={styles.modePopoverIconCol}>
                {activeTab === 'erp' ? <Check size={17} strokeWidth={2} color={colors.ink} /> : null}
              </View>
              <View style={styles.modePopoverCopy}>
                <Text style={styles.modePopoverTitle}>Thao tác</Text>
                <Text style={styles.modePopoverSub}>Thực hiện nghiệp vụ & cập nhật dữ liệu ERP</Text>
              </View>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Full-screen Gemini-style History Modal */}
      <Modal
        visible={historyOpen}
        statusBarTranslucent
        animationType="fade"
        onRequestClose={() => {
          setHistoryActionItem(null);
          setHistorySearchOpen(false);
          setHistoryOpen(false);
        }}
      >
        <View style={styles.historyModalRoot}>
          <Screen backgroundColor={colors.white} edges={['top', 'left', 'right']}>
            <View style={styles.historyScreen}>
              {/* Top Bar: iGen AI + Search + Close */}
              <View style={styles.historyTopBar}>
                {historySearchOpen ? (
                  <View style={styles.historyInlineSearchWrap}>
                    <Search size={18} strokeWidth={1.6} color="#64748B" />
                    <TextInput
                      value={historySearch}
                      onChangeText={setHistorySearch}
                      onSubmitEditing={() => {
                        void loadHistory(historySearch, historyMode);
                      }}
                      placeholder="Tìm cuộc trò chuyện..."
                      placeholderTextColor="#94A3B8"
                      autoFocus
                      returnKeyType="search"
                      style={styles.historyInlineSearchInput}
                    />
                    {historySearch ? (
                      <Pressable
                        hitSlop={8}
                        onPress={() => {
                          setHistorySearch('');
                          void loadHistory('', historyMode);
                        }}
                      >
                        <X size={17} strokeWidth={1.7} color="#64748B" />
                      </Pressable>
                    ) : null}
                  </View>
                ) : (
                  <Text style={styles.historyBrand}>iGen AI</Text>
                )}

                <View style={styles.historyTopActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Tìm lịch sử"
                    hitSlop={10}
                    onPress={() => {
                      if (historySearchOpen) {
                        void loadHistory(historySearch, historyMode);
                      } else {
                        setHistorySearchOpen(true);
                      }
                    }}
                    style={({ pressed }) => [styles.historyIconBtn, pressed && styles.geminiBtnPressed]}
                  >
                    <Search size={20} strokeWidth={1.4} color="#334155" />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Đóng lịch sử"
                    hitSlop={10}
                    onPress={() => {
                      setHistoryActionItem(null);
                      setHistorySearchOpen(false);
                      setHistoryOpen(false);
                    }}
                    style={({ pressed }) => [styles.historyIconBtn, pressed && styles.geminiBtnPressed]}
                  >
                    <X size={21} strokeWidth={1.4} color="#334155" />
                  </Pressable>
                </View>
              </View>

              {/* Clean minimalist conversation list */}
              {historyLoading ? (
                <View style={styles.historyLoadingWrap}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : (
                <ScrollView
                  style={styles.historyListFlex}
                  contentContainerStyle={styles.historyListContent}
                  showsVerticalScrollIndicator={false}
                >
                  {conversations.map((item) => {
                    const active = item.conversationId === conversationId;
                    return (
                      <Pressable
                        key={item.conversationId}
                        accessibilityRole="button"
                        onPress={() => {
                          setHistorySearchOpen(false);
                          void selectConversation(item);
                        }}
                        onLongPress={() => setHistoryActionItem(item)}
                        delayLongPress={260}
                        style={({ pressed }) => [
                          styles.historyItemRow,
                          active && styles.historyItemRowActive,
                          pressed && styles.historyItemRowPressed,
                        ]}
                      >
                        <Text
                          numberOfLines={1}
                          style={[styles.historyItemTitle, active && styles.historyItemTitleActive]}
                        >
                          {item.title || 'Cuộc trò chuyện'}
                        </Text>
                      </Pressable>
                    );
                  })}
                  {!conversations.length ? (
                    <Text style={styles.emptyHistoryText}>
                      {historyMode === 'qa'
                        ? 'Chưa có lịch sử trò chuyện nào.'
                        : 'Chưa có lịch sử thao tác ERP nào.'}
                    </Text>
                  ) : null}
                </ScrollView>
              )}

              {/* Bottom user profile footer (respects safe-area above Android nav bar) */}
              <View
                style={[
                  styles.historyFooter,
                  { paddingBottom: Math.max(insets.bottom, 12) + 8 },
                ]}
              >
                <View style={styles.historyUserRow}>
                  <View style={styles.historyAvatarRing}>
                    <View style={styles.historyAvatarInner}>
                      <Text style={styles.historyAvatarInitial}>
                        {(greetingName || 'U').slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.historyUserCopy}>
                    <Text numberOfLines={1} style={styles.historyUserName}>
                      {greetingName || 'Người dùng ERP'}
                    </Text>
                    <Text numberOfLines={1} style={styles.historyUserBadge}>
                      {historyMode === 'qa' ? 'TRÒ CHUYỆN' : 'THAO TÁC ERP'}
                    </Text>
                  </View>
                </View>
                {!chatOnly ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Cài đặt trợ lý"
                    hitSlop={10}
                    onPress={() => {
                      setHistorySearchOpen(false);
                      setHistoryOpen(false);
                      switchModuleTab('settings');
                    }}
                    style={({ pressed }) => [styles.historyIconBtn, pressed && styles.geminiBtnPressed]}
                  >
                    <Settings size={20} strokeWidth={1.6} color="#475569" />
                  </Pressable>
                ) : null}
              </View>
            </View>
          </Screen>

          {/* Long-press Bottom Action Sheet covering full screen edge-to-edge */}
          {historyActionItem ? (
            <Pressable
              style={styles.historySheetOverlay}
              onPress={() => setHistoryActionItem(null)}
            >
              <Pressable
                style={[
                  styles.historyActionSheet,
                  { paddingBottom: Math.max(insets.bottom, 14) + 10 },
                ]}
                onPress={() => {}}
              >
                <View style={styles.historySheetHandle} />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    const target = historyActionItem;
                    setHistoryActionItem(null);
                    setHistorySearchOpen(false);
                    void selectConversation(target);
                  }}
                  style={({ pressed }) => [
                    styles.historySheetItem,
                    pressed && styles.historySheetItemPressed,
                  ]}
                >
                  <MessageSquare size={19} strokeWidth={1.6} color={colors.ink} />
                  <Text style={styles.historySheetItemText}>Mở cuộc trò chuyện</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    const target = historyActionItem;
                    setHistoryActionItem(null);
                    void onDeleteConversation(target);
                  }}
                  style={({ pressed }) => [
                    styles.historySheetItem,
                    pressed && styles.historySheetItemPressed,
                  ]}
                >
                  <Trash2 size={19} strokeWidth={1.6} color={colors.ink} />
                  <Text style={styles.historySheetItemText}>Xóa</Text>
                </Pressable>
              </Pressable>
            </Pressable>
          ) : null}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );

  return embedded ? (
    body
  ) : (
    <Screen
      backgroundColor={isChatSurface ? colors.white : colors.background}
      edges={chatOnly ? ['top', 'bottom', 'left', 'right'] : ['top', 'left', 'right']}
    >
      {body}
    </Screen>
  );
}

export function EmbeddedErpAssistantScreen() {
  return <ErpAssistantScreen embedded />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  rootChat: { backgroundColor: colors.white },
  geminiTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: colors.white,
  },
  geminiTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  geminiTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  geminiIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  geminiBtnPressed: {
    opacity: 0.6,
  },
  geminiBrandTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  geminiBrandTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  geminiBrandMode: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '400',
  },
  geminiEmptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 26,
    paddingBottom: 24,
  },
  geminiHero: {
    alignItems: 'center',
    marginBottom: 42,
    gap: 16,
  },
  geminiGreeting: {
    color: colors.ink,
    fontSize: 25,
    lineHeight: 34,
    fontWeight: '400',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  geminiSuggestions: {
    gap: 18,
    paddingHorizontal: 4,
  },
  geminiSuggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 4,
  },
  geminiSuggestionPressed: {
    opacity: 0.55,
  },
  geminiSuggestionIcon: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  geminiSuggestionText: {
    flex: 1,
    color: '#1E293B',
    fontSize: 14.5,
    lineHeight: 20.5,
    fontWeight: '400',
  },
  geminiBottomDock: {
    paddingTop: 14,
    paddingBottom: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  geminiBottomDockKeyboard: {
    paddingTop: 8,
    paddingBottom: 10,
  },
  modeToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  modeToggleBtn: {
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 99,
  },
  modeToggleBtnActive: {
    backgroundColor: colors.white,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  modeToggleText: {
    color: '#475569',
    fontSize: 13.5,
    fontWeight: '400',
  },
  modeToggleTextActive: {
    color: colors.ink,
    fontWeight: '500',
  },
  geminiComposerPill: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.white,
    borderRadius: 28,
    paddingLeft: 10,
    paddingRight: 8,
    paddingVertical: 7,
    gap: 6,
    shadowColor: '#0F172A',
    shadowOpacity: 0.09,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5ECF6',
  },
  geminiPlusBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  geminiInput: {
    flex: 1,
    minHeight: 36,
    maxHeight: 112,
    paddingHorizontal: 4,
    paddingVertical: 7,
    fontSize: 15,
    color: colors.ink,
    fontWeight: '400',
  },
  geminiSendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  geminiSendBtnIdle: {
    backgroundColor: '#E8F2FF',
  },
  geminiSendBtnReady: {
    backgroundColor: colors.primary,
  },
  geminiStopBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F3F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modePopoverBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.12)',
  },
  modePopoverCard: {
    position: 'absolute',
    top: 62,
    left: 24,
    right: 24,
    maxWidth: 300,
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingVertical: 10,
    shadowColor: '#0F172A',
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8EEF6',
  },
  modePopoverItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  modePopoverItemPressed: {
    backgroundColor: '#F4F8FF',
  },
  modePopoverIconCol: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modePopoverCopy: {
    flex: 1,
    gap: 2,
  },
  modePopoverTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '500',
  },
  modePopoverSub: {
    color: '#64748B',
    fontSize: 12.5,
    fontWeight: '400',
  },
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
  messagesContent: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 18, gap: 16 },
  msgRow: { alignItems: 'flex-start', maxWidth: '94%' },
  msgRowUser: { alignSelf: 'flex-end', alignItems: 'flex-end', maxWidth: '84%' },
  botLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  botLabel: { color: '#475569', fontSize: 12, fontWeight: '500' },
  bubble: { borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, maxWidth: '100%' },
  bubbleBot: { backgroundColor: 'transparent', paddingHorizontal: 2, paddingVertical: 2 },
  bubbleUser: { backgroundColor: '#EDF4FF' },
  bubbleText: { color: colors.ink, fontSize: 14.5, lineHeight: 22, fontWeight: '400' },
  bubbleTextUser: { color: colors.ink },
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
  thinkingGlowStage: {
    width: 82,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
    marginTop: -2,
    overflow: 'visible',
  },
  thinkingOuterHaloWrap: {
    position: 'absolute',
    width: 94,
    height: 94,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thinkingBubbleSolid: {
    width: 62,
    height: 38,
    borderRadius: 19,
    borderTopLeftRadius: 6,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4.5,
  },
  thinkingDot: {
    width: 4.5,
    height: 4.5,
    borderRadius: 2.25,
    backgroundColor: '#111827',
  },
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

  // Full-screen Gemini-style History modal
  historyModalRoot: {
    flex: 1,
    backgroundColor: colors.white,
  },
  historyScreen: {
    flex: 1,
    backgroundColor: colors.white,
  },
  historyTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 10,
    gap: 10,
  },
  historyBrand: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: '400',
    letterSpacing: -0.2,
  },
  historyInlineSearchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F6FA',
    borderRadius: 99,
    borderWidth: 1,
    borderColor: '#DCE5F2',
    paddingHorizontal: 14,
    height: 40,
    gap: 8,
  },
  historyInlineSearchInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#111827',
    paddingVertical: 0,
  },
  historyTopActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyLoadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyListFlex: {
    flex: 1,
  },
  historyListContent: {
    paddingTop: 4,
    paddingBottom: 24,
  },
  historyItemRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    marginHorizontal: 8,
  },
  historyItemRowActive: {
    backgroundColor: '#F3F5F8',
  },
  historyItemRowPressed: {
    backgroundColor: '#F4F7FB',
  },
  historyItemTitle: {
    color: '#2B3445',
    fontSize: 14.5,
    lineHeight: 21,
    fontWeight: '400',
  },
  historyItemTitleActive: {
    color: '#111827',
    fontWeight: '400',
  },
  emptyHistoryText: {
    color: colors.muted,
    fontSize: 13.5,
    fontWeight: '400',
    textAlign: 'center',
    paddingVertical: 48,
  },
  historyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F0F3F7',
    backgroundColor: colors.white,
  },
  historyUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  historyAvatarRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyAvatarInner: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyAvatarInitial: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '400',
  },
  historyUserCopy: {
    flex: 1,
    gap: 1,
  },
  historyUserName: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '400',
  },
  historyUserBadge: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 0.4,
  },
  historySheetOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.34)',
    justifyContent: 'flex-end',
  },
  historyActionSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 10,
  },
  historySheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 99,
    backgroundColor: '#94A3B8',
    alignSelf: 'center',
    marginBottom: 10,
  },
  historySheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 14,
  },
  historySheetItemPressed: {
    backgroundColor: '#F3F6FA',
  },
  historySheetItemText: {
    color: colors.ink,
    fontSize: 15.5,
    fontWeight: '400',
  },
});

