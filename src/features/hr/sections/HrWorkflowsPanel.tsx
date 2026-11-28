import { withAppLockSuspended } from '@/core/auth/appLockSuspension';
import { PopupError } from '@/components/PopupError';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Linking,
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
import * as DocumentPicker from 'expo-document-picker';
import { ArrowLeft, Check, ChevronDown, ChevronRight, ChevronUp, Ellipsis, Folder, Paperclip, Pencil, Plus, Trash2, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';
import { Card } from '@/components/Card';
import { IgenHrEmptyState } from '@/components/EmptyStateIllustration';
import { FullScreenFormModal, SlideInPage } from '@/components/FullScreenFormModal';
import {
  HrFormCustomRow,
  HrFormInputRow,
  HrFormSectionTitle,
  HrFormSelectRow,
} from '@/features/hr/components/HrFormFields';
import { HrFab } from '@/features/hr/components/HrFab';
import { showHrConfirm } from '@/features/hr/components/HrConfirmModal';
import { useAuth } from '@/core/auth/AuthProvider';
import {
  createHrWorkflow,
  createHrWorkflowCategory,
  deleteHrWorkflowCategory,
  deleteHrWorkflow,
  listHrWorkflowCategories,
  listHrWorkflows,
  updateHrWorkflowCategory,
  uploadHrWorkflowAttachment,
  updateHrWorkflow,
} from '@/features/hr/hrApi';
import type { HrWorkflow, HrWorkflowAttachment, HrWorkflowCategory, HrWorkflowStep, HrWorkflowSubTask } from '@/features/hr/types';
import { colors } from '@/theme/colors';

function makeId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function CategoryManageIcon({ size = 19, color = colors.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3.5" y="3.5" width="7" height="7" rx="2" stroke={color} strokeWidth="1.7" />
      <Rect x="13.5" y="3.5" width="7" height="7" rx="2" stroke={color} strokeWidth="1.7" />
      <Rect x="3.5" y="13.5" width="7" height="7" rx="2" stroke={color} strokeWidth="1.7" />
      <Path
        d="M17 13.75V20.25M13.75 17H20.25"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function HrWorkflowsPanel({
  companyCode,
  canManage = false,
}: {
  companyCode?: string;
  canManage?: boolean;
}) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const creatorUid = user?._id || user?.id || '';
  const [workflows, setWorkflows] = useState<HrWorkflow[]>([]);
  const [workflowCategories, setWorkflowCategories] = useState<HrWorkflowCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tất cả');
  const [categoryFilterOpen, setCategoryFilterOpen] = useState(false);

  // Detail view state
  const [selectedWorkflow, setSelectedWorkflow] = useState<HrWorkflow | null>(null);
  const [selectedStep, setSelectedStep] = useState<{ step: HrWorkflowStep; index: number } | null>(
    null,
  );
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [expandedStepIds, setExpandedStepIds] = useState<Record<string, boolean>>({});

  const toggleStepSubTasks = useCallback((stepKey: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedStepIds((prev) => ({ ...prev, [stepKey]: !prev[stepKey] }));
  }, []);

  // Add / Edit step modal
  const [stepModalOpen, setStepModalOpen] = useState(false);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [stepTitle, setStepTitle] = useState('');
  const [stepDesc, setStepDesc] = useState('');
  const [stepNote, setStepNote] = useState('');
  const [stepDeliverable, setStepDeliverable] = useState('');
  const [stepSubTasks, setStepSubTasks] = useState<HrWorkflowSubTask[]>([]);
  const [stepSubTaskDraft, setStepSubTaskDraft] = useState('');
  const [stepAttachments, setStepAttachments] = useState<HrWorkflowAttachment[]>([]);
  const [uploadingStepAttachments, setUploadingStepAttachments] = useState(false);
  const [savingStep, setSavingStep] = useState(false);

  // Create workflow modal
  const [createOpen, setCreateOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<HrWorkflow | null>(null);
  const [wfName, setWfName] = useState('');
  const [wfCategory, setWfCategory] = useState('');
  const [wfDesc, setWfDesc] = useState('');
  const [savingWf, setSavingWf] = useState(false);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [categoryManagerMode, setCategoryManagerMode] = useState<'list' | 'create' | 'rename'>('list');
  const [categoryEditFrom, setCategoryEditFrom] = useState<string | null>(null);
  const [categoryNameDraft, setCategoryNameDraft] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const [list, categoryList] = await Promise.all([
          listHrWorkflows(companyCode),
          listHrWorkflowCategories(companyCode).catch(() => [] as HrWorkflowCategory[]),
        ]);
        setWorkflows(list);
        setWorkflowCategories(categoryList);
        setSelectedWorkflow((curr) => (curr ? list.find((w) => w.id === curr.id) ?? curr : null));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không tải được quy trình nội bộ.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [companyCode],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const category of workflowCategories) {
      if (category.name?.trim()) set.add(category.name.trim());
    }
    for (const w of workflows) {
      if (w.category?.trim()) set.add(w.category.trim());
    }
    return ['Tất cả', ...Array.from(set).filter((category) => category !== 'Tất cả').sort((a, b) => a.localeCompare(b, 'vi'))];
  }, [workflowCategories, workflows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return workflows.filter((w) => {
      if (selectedCategory !== 'Tất cả' && (w.category || '').trim() !== selectedCategory) return false;
      if (!q) return true;
      const title = (w.name || w.title || '').toLowerCase();
      return (
        title.includes(q) ||
        (w.description || '').toLowerCase().includes(q) ||
        (w.category || '').toLowerCase().includes(q)
      );
    });
  }, [search, selectedCategory, workflows]);

  const openAddStep = useCallback(() => {
    const nextIdx = (selectedWorkflow?.steps?.length ?? 0) + 1;
    setEditingStepId(null);
    setStepTitle(`Bước ${nextIdx}`);
    setStepDesc('');
    setStepNote('');
    setStepDeliverable('');
    setStepSubTasks([]);
    setStepSubTaskDraft('');
    setStepAttachments([]);
    setStepModalOpen(true);
  }, [selectedWorkflow?.steps?.length]);

  const openEditStep = useCallback((step: HrWorkflowStep) => {
    setSelectedStep(null);
    setEditingStepId(step.id);
    setStepTitle(step.title || '');
    setStepDesc(step.description || '');
    setStepNote(step.note || '');
    setStepDeliverable(step.deliverable || '');
    setStepSubTasks((step.subTasks ?? []).map((task, index) => ({
      ...task,
      id: task.id || makeId(`sub${index}`),
    })));
    setStepSubTaskDraft('');
    setStepAttachments(step.attachments ?? []);
    setStepModalOpen(true);
  }, []);

  const addStepSubTask = useCallback(() => {
    const title = stepSubTaskDraft.trim();
    if (!title) return;
    setStepSubTasks((current) => [...current, { id: makeId('sub'), title }]);
    setStepSubTaskDraft('');
  }, [stepSubTaskDraft]);

  const removeStepSubTask = useCallback((id: string) => {
    setStepSubTasks((current) => current.filter((task) => task.id !== id));
  }, []);

  const pickStepAttachments = useCallback(async () => {
    try {
      const result = await withAppLockSuspended(() => DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
      }));
      if (result.canceled || !result.assets?.length) return;

      setUploadingStepAttachments(true);
      for (const asset of result.assets) {
        if (asset.size && asset.size > 25 * 1024 * 1024) {
          Alert.alert('Tệp quá lớn', `Tệp "${asset.name}" vượt quá giới hạn 25 MB.`);
          continue;
        }
        try {
          const uploaded = await uploadHrWorkflowAttachment(asset, companyCode);
          setStepAttachments((current) => [
            ...current,
            {
              id: makeId('att'),
              name: uploaded.name,
              url: uploaded.url,
              type: uploaded.type,
              size: uploaded.size,
            },
          ]);
        } catch (err) {
          Alert.alert(
            'Không tải được tệp',
            err instanceof Error ? `${asset.name}: ${err.message}` : `Không tải được tệp ${asset.name}.`,
          );
        }
      }
    } catch (err) {
      Alert.alert(
        'Lỗi chọn tệp',
        err instanceof Error ? err.message : 'Không mở được trình chọn tệp.',
      );
    } finally {
      setUploadingStepAttachments(false);
    }
  }, []);

  const onSaveStep = useCallback(async () => {
    if (!selectedWorkflow || savingStep || uploadingStepAttachments) return;
    if (!stepTitle.trim()) {
      Alert.alert('Thiếu tên bước', 'Vui lòng nhập tên bước thực hiện.');
      return;
    }
    const currentSteps = selectedWorkflow.steps ?? [];
    const nextStep: HrWorkflowStep = {
      id: editingStepId || makeId('step'),
      title: stepTitle.trim(),
      description: stepDesc.trim(),
      note: stepNote.trim(),
      deliverable: stepDeliverable.trim(),
      subTasks: stepSubTasks,
      attachments: stepAttachments,
    };
    const nextSteps = editingStepId
      ? currentSteps.map((s) => (s.id === editingStepId ? nextStep : s))
      : [...currentSteps, nextStep];

    setSavingStep(true);
    try {
      const updated = await updateHrWorkflow(selectedWorkflow.id, { steps: nextSteps });
      setSelectedWorkflow(updated);
      setWorkflows((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
      setStepModalOpen(false);
    } catch (err) {
      Alert.alert('Lỗi lưu bước', err instanceof Error ? err.message : 'Vui lòng thử lại.');
    } finally {
      setSavingStep(false);
    }
  }, [
    editingStepId,
    savingStep,
    selectedWorkflow,
    stepDeliverable,
    stepDesc,
    stepNote,
    stepAttachments,
    stepSubTasks,
    stepTitle,
    uploadingStepAttachments,
  ]);

  const onDeleteStep = useCallback(
    (step: HrWorkflowStep) => {
      if (!selectedWorkflow) return;
      showHrConfirm({
        title: 'Xóa bước này?',
        message: `Bạn chắc chắn muốn xóa bước "${step.title}"?`,
        confirmLabel: 'Xóa bước',
        onConfirm: async () => {
          try {
            const nextSteps = (selectedWorkflow.steps ?? []).filter((s) => s.id !== step.id);
            const updated = await updateHrWorkflow(selectedWorkflow.id, { steps: nextSteps });
            setSelectedWorkflow(updated);
            setWorkflows((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
            setSelectedStep(null);
          } catch (err) {
            Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể xóa bước.');
          }
        },
      });
    },
    [selectedWorkflow],
  );

  const openCreateWorkflow = useCallback(() => {
    setEditingWorkflow(null);
    setWfName('');
    setWfCategory('');
    setWfDesc('');
    setCreateOpen(true);
  }, []);

  const openEditWorkflow = useCallback((workflow: HrWorkflow) => {
    setEditingWorkflow(workflow);
    setWfName(workflow.name || workflow.title || '');
    setWfCategory(workflow.category || '');
    setWfDesc(workflow.description || '');
    setCreateOpen(true);
  }, []);

  const onCreateWorkflow = useCallback(async () => {
    if (!wfName.trim() || savingWf) {
      if (!wfName.trim()) Alert.alert('Thiếu tên quy trình', 'Hãy nhập tên quy trình.');
      return;
    }
    if (!creatorUid) {
      Alert.alert('Lỗi', 'Không xác định được người tạo quy trình.');
      return;
    }
    setSavingWf(true);
    try {
      const created = await createHrWorkflow({
        companyCode: companyCode || 'SYSTEM',
        creatorUid,
        name: wfName.trim(),
        category: wfCategory.trim() || 'Chung',
        description: wfDesc.trim(),
        steps: [],
      });
      setWorkflows((prev) => [created, ...prev]);
      setCreateOpen(false);
      setWfName('');
      setWfCategory('');
      setWfDesc('');
      setSelectedWorkflow(created);
    } catch (err) {
      Alert.alert('Lỗi tạo quy trình', err instanceof Error ? err.message : 'Vui lòng thử lại.');
    } finally {
      setSavingWf(false);
    }
  }, [companyCode, creatorUid, savingWf, wfCategory, wfDesc, wfName]);

  const onUpdateWorkflow = useCallback(async () => {
    if (!editingWorkflow || savingWf) return;
    const name = wfName.trim();
    if (!name) {
      Alert.alert('Thiếu tên quy trình', 'Hãy nhập tên quy trình.');
      return;
    }
    const payload = {
      name,
      category: wfCategory.trim() || 'Chung',
      description: wfDesc.trim(),
    };
    setSavingWf(true);
    try {
      await updateHrWorkflow(editingWorkflow.id, payload);
      const localUpdate = { ...payload, title: name };
      setWorkflows((prev) => prev.map((workflow) =>
        workflow.id === editingWorkflow.id ? { ...workflow, ...localUpdate } : workflow,
      ));
      setSelectedWorkflow((prev) => prev?.id === editingWorkflow.id ? { ...prev, ...localUpdate } : prev);
      setCreateOpen(false);
      setEditingWorkflow(null);
      Alert.alert('Đã lưu', 'Cập nhật quy trình thành công.');
    } catch (err) {
      Alert.alert('Lỗi cập nhật quy trình', err instanceof Error ? err.message : 'Vui lòng thử lại.');
    } finally {
      setSavingWf(false);
    }
  }, [editingWorkflow, savingWf, wfCategory, wfDesc, wfName]);

  const openCreateCategory = useCallback(() => {
    setCategoryEditFrom(null);
    setCategoryNameDraft('');
    setCategoryManagerMode('create');
  }, []);

  const openRenameCategory = useCallback((category: string) => {
    setCategoryEditFrom(category);
    setCategoryNameDraft(category);
    setCategoryManagerMode('rename');
  }, []);

  const onSaveCategory = useCallback(async () => {
    const nextName = categoryNameDraft.trim();
    if (!nextName || savingCategory) {
      if (!nextName) Alert.alert('Thiếu tên phân loại', 'Hãy nhập tên phân loại.');
      return;
    }
    if (nextName.toLocaleLowerCase('vi') === 'tất cả') {
      Alert.alert('Tên phân loại không hợp lệ', 'Tên "Tất cả" được dùng để xem mọi quy trình.');
      return;
    }
    const duplicate = categories.some(
      (category) => category !== 'Tất cả' && category !== categoryEditFrom && category.toLocaleLowerCase('vi') === nextName.toLocaleLowerCase('vi'),
    );
    if (duplicate) {
      Alert.alert('Phân loại đã tồn tại', 'Tên này đang được sử dụng. Hãy chọn tên khác.');
      return;
    }
    const comp = companyCode || user?.companyCode || 'SYSTEM';
    setSavingCategory(true);
    try {
      if (categoryManagerMode === 'create') {
        const created = await createHrWorkflowCategory({ companyCode: comp, name: nextName });
        setWorkflowCategories((prev) => [created, ...prev.filter((category) => category.id !== created.id)]);
      } else {
        const targets = workflows.filter((workflow) => workflow.category?.trim() === categoryEditFrom);
        await Promise.all(targets.map((workflow) => updateHrWorkflow(workflow.id, { category: nextName })));
        const currentCategory = workflowCategories.find((category) => category.name.trim() === categoryEditFrom);
        const updatedCategory = currentCategory
          ? await updateHrWorkflowCategory(currentCategory.id, { name: nextName })
          : await createHrWorkflowCategory({ companyCode: comp, name: nextName });
        const targetIds = new Set(targets.map((workflow) => workflow.id));
        setWorkflows((prev) => prev.map((workflow) => targetIds.has(workflow.id) ? { ...workflow, category: nextName } : workflow));
        setSelectedWorkflow((prev) => prev && targetIds.has(prev.id) ? { ...prev, category: nextName } : prev);
        setWorkflowCategories((prev) => [
          updatedCategory,
          ...prev.filter((category) => category.id !== updatedCategory.id && category.name.trim() !== categoryEditFrom),
        ]);
        if (categoryEditFrom && selectedCategory === categoryEditFrom) setSelectedCategory(nextName);
      }
      setCategoryManagerMode('list');
      setCategoryEditFrom(null);
    } catch (err) {
      Alert.alert('Không lưu được phân loại', err instanceof Error ? err.message : 'Vui lòng thử lại.');
      void load(true);
    } finally {
      setSavingCategory(false);
    }
  }, [categories, categoryEditFrom, categoryManagerMode, categoryNameDraft, companyCode, load, savingCategory, selectedCategory, user?.companyCode, workflowCategories, workflows]);

  const onDeleteCategory = useCallback((category: string) => {
    if (category === 'Chung') return;
    const targets = workflows.filter((workflow) => workflow.category?.trim() === category);
    showHrConfirm({
      title: 'Xóa phân loại?',
      message: targets.length
        ? `Các quy trình thuộc "${category}" sẽ được chuyển về phân loại "Chung".`
        : `Bạn có chắc muốn xóa phân loại "${category}"?`,
      confirmLabel: 'Xóa phân loại',
      onConfirm: async () => {
        setSavingCategory(true);
        try {
          const categoryRecord = workflowCategories.find((entry) => entry.name.trim() === category);
          await Promise.all(targets.map((workflow) => updateHrWorkflow(workflow.id, { category: 'Chung' })));
          if (categoryRecord) await deleteHrWorkflowCategory(categoryRecord.id);
          const targetIds = new Set(targets.map((workflow) => workflow.id));
          setWorkflows((prev) => prev.map((workflow) => targetIds.has(workflow.id) ? { ...workflow, category: 'Chung' } : workflow));
          setSelectedWorkflow((prev) => prev && targetIds.has(prev.id) ? { ...prev, category: 'Chung' } : prev);
          setWorkflowCategories((prev) => prev.filter((entry) => entry.name.trim() !== category));
          if (selectedCategory === category) setSelectedCategory('Tất cả');
        } catch (err) {
          Alert.alert('Không xóa được phân loại', err instanceof Error ? err.message : 'Vui lòng thử lại.');
          void load(true);
        } finally {
          setSavingCategory(false);
        }
      },
    });
  }, [load, selectedCategory, workflowCategories, workflows]);

  const onDeleteWorkflow = useCallback((wf: HrWorkflow) => {
    showHrConfirm({
      title: 'Xóa quy trình?',
      message: `Bạn chắc chắn muốn xóa quy trình "${wf.name || wf.title}"?`,
      confirmLabel: 'Xóa quy trình',
      onConfirm: async () => {
        try {
          await deleteHrWorkflow(wf.id);
          setWorkflows((prev) => prev.filter((w) => w.id !== wf.id));
          setSelectedWorkflow(null);
        } catch (err) {
          Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể xóa quy trình.');
        }
      },
    });
  }, []);

  function renderWorkflowFormModal() {
    const close = () => {
      if (savingWf) return;
      setCreateOpen(false);
      setEditingWorkflow(null);
    };
    return (
      <FullScreenFormModal
        visible={createOpen}
        title={editingWorkflow ? 'Sửa quy trình' : 'Tạo quy trình mới'}
        cancelLabel="Hủy"
        onSave={() => void (editingWorkflow ? onUpdateWorkflow() : onCreateWorkflow())}
        saving={savingWf}
        onClose={close}
      >
        <View>
          <HrFormSectionTitle title="Thông tin quy trình" />
          <HrFormInputRow
            label="Tên quy trình *"
            value={wfName}
            onChangeText={setWfName}
            placeholder="VD: Quy trình tiếp nhận nhân sự mới"
          />
          {categories.length > 1 ? (
            <HrFormSelectRow
              label="Danh mục"
              sheetTitle="Chọn danh mục quy trình"
              value={wfCategory}
              placeholder="Chọn danh mục"
              options={Array.from(
                new Set([
                  ...(wfCategory.trim() ? [wfCategory.trim()] : []),
                  ...categories.slice(1),
                ]),
              ).map((cat) => ({ value: cat, label: cat }))}
              onSelect={setWfCategory}
            />
          ) : (
            <HrFormInputRow
              label="Danh mục"
              value={wfCategory}
              onChangeText={setWfCategory}
              placeholder="VD: Nhân sự / Vận hành"
            />
          )}
          <HrFormInputRow
            label="Mô tả"
            value={wfDesc}
            onChangeText={setWfDesc}
            multiline
            placeholder="Mục đích và phạm vi áp dụng..."
            last
          />
        </View>
      </FullScreenFormModal>
    );
  }

  // --- Workflow Detail Screen ---
  if (selectedWorkflow) {
    const steps = selectedWorkflow.steps ?? [];
    return (
      <SlideInPage key={selectedWorkflow.id}>
      <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 108 }]}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.detailHero}>
          <Text style={styles.detailTitle}>
            {selectedWorkflow.name || selectedWorkflow.title || 'Quy trình nội bộ'}
          </Text>
          {selectedWorkflow.description ? (
            <Text style={styles.detailDesc}>{selectedWorkflow.description}</Text>
          ) : null}
        </Card>

        <View style={styles.sectionHeadingRow}>
          <Text style={styles.sectionHeading}>Sơ đồ các bước thực hiện</Text>
          {selectedWorkflow.category ? (
            <Text numberOfLines={1} ellipsizeMode="tail" style={styles.sectionCategoryBadge}>
              {selectedWorkflow.category}
            </Text>
          ) : null}
        </View>

        {steps.length === 0 ? (
          <Card style={styles.stateCard}>
            <Text style={styles.muted}>Quy trình này chưa có bước nào.</Text>
            {canManage ? (
              <Pressable onPress={openAddStep} style={styles.primaryBtn}>
                <View style={styles.iconButtonContent}><Plus size={13} color={colors.white} /><Text style={styles.primaryBtnText}>Thêm bước đầu tiên</Text></View>
              </Pressable>
            ) : null}
          </Card>
        ) : (
          <View style={styles.flowWrap}>
            {steps.map((step, idx) => {
              const isLast = idx === steps.length - 1;
              const stepKey = step.id || String(idx);
              const subTasks = step.subTasks ?? [];
              const hasSubTasks = subTasks.length > 0;
              const hasDetails = Boolean(
                step.description?.trim() || step.deliverable?.trim() || step.note?.trim() || hasSubTasks,
              );
              const isExpanded = Boolean(expandedStepIds[stepKey]);
              return (
                <View key={step.id || idx} style={styles.flowItem}>
                  <View style={styles.flowRail}>
                    <View style={styles.stepNumCircle}>
                      <Text style={styles.stepNumText}>{idx + 1}</Text>
                    </View>
                    {!isLast ? <View style={styles.flowLine} /> : null}
                  </View>
                  <Card
                    onPress={() => setSelectedStep({ step, index: idx })}
                    style={styles.stepCard}
                  >
                    <View style={styles.stepCardTop}>
                      <Text numberOfLines={2} style={styles.stepTitle}>
                        {step.title || `Bước ${idx + 1}`}
                      </Text>
                      {hasDetails ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={isExpanded ? 'Thu gọn chi tiết bước' : 'Xem chi tiết bước'}
                          onPress={(e) => {
                            e.stopPropagation();
                            toggleStepSubTasks(stepKey);
                          }}
                          hitSlop={10}
                          style={({ pressed }) => [styles.stepExpandBtn, pressed && { opacity: 0.6 }]}
                        >
                          {isExpanded ? (
                            <ChevronUp size={17} strokeWidth={1.8} color={colors.primary} />
                          ) : (
                            <ChevronDown size={17} strokeWidth={1.8} color="#64748B" />
                          )}
                        </Pressable>
                      ) : null}
                    </View>
                    {isExpanded && hasDetails ? (
                      <View style={styles.stepSubTasksWrap}>
                        {step.description ? (
                          <Text style={styles.muted}>
                            {step.description}
                          </Text>
                        ) : null}
                        {step.deliverable || step.note ? (
                          <View style={styles.stepMetaRow}>
                            {step.deliverable ? (
                              <View style={styles.stepTagRow}><Check size={12} color="#15803D" /><Text style={styles.stepTagGreen}>Có kết quả đầu ra</Text></View>
                            ) : null}
                            {step.note ? <Text style={styles.stepTagAmber}>! Có lưu ý</Text> : null}
                          </View>
                        ) : null}
                        {hasSubTasks ? (
                          <View style={{ gap: 6 }}>
                            {subTasks.map((sub, subIdx) => (
                              <View key={sub.id || subIdx} style={styles.stepSubTaskItem}>
                                <View style={styles.subDot} />
                                <Text style={styles.stepSubTaskText}>{sub.title}</Text>
                              </View>
                            ))}
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </Card>
                </View>
              );
            })}
          </View>
        )}

        {/* Step Detail Full-Screen Page */}
        <FullScreenFormModal
          visible={Boolean(selectedStep)}
          title={
            selectedStep
              ? `Bước ${selectedStep.index + 1}: ${selectedStep.step.title || `Bước ${selectedStep.index + 1}`}`
              : 'Chi tiết bước'
          }
          onClose={() => setSelectedStep(null)}
        >
          {selectedStep ? (
            <View style={{ gap: 12, paddingBottom: 12 }}>
              {selectedStep.step.description ? (
                <Text style={styles.bodyText}>{selectedStep.step.description}</Text>
              ) : (
                <Text style={styles.muted}>Chưa có mô tả chi tiết cho bước này.</Text>
              )}

              {selectedStep.step.note ? (
                <View style={styles.noteBox}>
                  <Text style={styles.noteTitle}>Lưu ý</Text>
                  <Text style={styles.noteText}>{selectedStep.step.note}</Text>
                </View>
              ) : null}

              {selectedStep.step.deliverable ? (
                <View style={styles.deliverableBox}>
                  <Text style={styles.deliverableTitle}>Kết quả cần đạt</Text>
                  <Text style={styles.deliverableText}>
                    {selectedStep.step.deliverable}
                  </Text>
                </View>
              ) : null}

              {selectedStep.step.subTasks?.length ? (
                <View style={{ gap: 6 }}>
                  <Text style={styles.subSectionLabel}>
                    Công việc con ({selectedStep.step.subTasks.length})
                  </Text>
                  {selectedStep.step.subTasks.map((sub, i) => (
                    <View key={sub.id || i} style={styles.subTaskRow}>
                      <View style={styles.subDot} />
                      <Text style={styles.subTaskText}>{sub.title}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {selectedStep.step.attachments?.length ? (
                <View style={{ gap: 6 }}>
                  <Text style={styles.subSectionLabel}>
                    Tệp đính kèm ({selectedStep.step.attachments.length})
                  </Text>
                  {selectedStep.step.attachments.map((att, i) => (
                    <Pressable
                      key={att.id || i}
                      onPress={() => {
                        if (att.url) void Linking.openURL(att.url);
                      }}
                      style={styles.attachBtn}
                    >
                      <View style={styles.attachBtnContent}>
                        <Paperclip size={14} color={colors.primary} />
                        <Text numberOfLines={1} style={styles.attachBtnText}>{att.name || 'Mở tệp đính kèm'}</Text>
                        <ChevronRight size={14} color={colors.primary} />
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {canManage ? (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                  <Pressable
                    onPress={() => openEditStep(selectedStep.step)}
                    style={[styles.submitBtn, { flex: 1 }]}
                  >
                    <Text style={styles.submitBtnText}>Chỉnh sửa bước</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => onDeleteStep(selectedStep.step)}
                    style={styles.deleteBtn}
                  >
                    <Text style={styles.deleteBtnText}>Xóa</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : null}
        </FullScreenFormModal>

        {/* Add / Edit Step Full-Screen Page */}
        <FullScreenFormModal
          visible={stepModalOpen}
          title={editingStepId ? 'Chỉnh sửa bước' : 'Thêm bước mới'}
          cancelLabel="Hủy"
          onSave={() => void onSaveStep()}
          saving={savingStep || uploadingStepAttachments}
          onClose={() => setStepModalOpen(false)}
        >
          <View>
            <HrFormSectionTitle title="Thông tin bước thực hiện" />
            <HrFormInputRow label="Tên bước *" value={stepTitle} onChangeText={setStepTitle} placeholder="Nhập tên bước..." />
            <HrFormInputRow label="Mô tả chi tiết" value={stepDesc} onChangeText={setStepDesc} multiline placeholder="Mô tả chi tiết..." />
            <HrFormInputRow label="Lưu ý quan trọng" value={stepNote} onChangeText={setStepNote} placeholder="Lưu ý quan trọng..." />
            <HrFormInputRow label="Kết quả cần đạt" value={stepDeliverable} onChangeText={setStepDeliverable} placeholder="Kết quả đầu ra..." />
            <HrFormCustomRow label={`Công việc con (${stepSubTasks.length})`}>
              <View style={{ gap: 6, marginTop: 4 }}>
                {stepSubTasks.map((task) => (
                  <View key={task.id} style={styles.subTaskEditRow}>
                    <View style={styles.subDot} />
                    <Text style={styles.subTaskText}>{task.title}</Text>
                    <Pressable
                      onPress={() => showHrConfirm({
                        title: 'Xóa công việc con?',
                        message: `Bạn có chắc muốn xóa công việc con "${task.title}"?`,
                        confirmLabel: 'Xóa',
                        onConfirm: () => removeStepSubTask(task.id),
                      })}
                      hitSlop={8}
                      accessibilityLabel={`Xóa công việc con ${task.title}`}
                    >
                      <X size={15} color={colors.muted} />
                    </Pressable>
                  </View>
                ))}
                <View style={styles.subTaskAddRow}>
                  <TextInput
                    value={stepSubTaskDraft}
                    onChangeText={setStepSubTaskDraft}
                    onSubmitEditing={addStepSubTask}
                    returnKeyType="done"
                    placeholder="Nhập tên công việc con..."
                    placeholderTextColor="#9CA3AF"
                    style={[styles.field, { flex: 1 }]}
                  />
                  <Pressable
                    onPress={addStepSubTask}
                    disabled={!stepSubTaskDraft.trim()}
                    style={[styles.subTaskAddBtn, !stepSubTaskDraft.trim() && styles.disabled]}
                  >
                    <Plus size={14} color={colors.primary} />
                    <Text style={styles.categoryAddText}>Thêm</Text>
                  </Pressable>
                </View>
              </View>
            </HrFormCustomRow>
            <HrFormCustomRow label={`Tệp đính kèm (${stepAttachments.length})`} last>
              <View style={{ gap: 8, marginTop: 6 }}>
                <Pressable
                  onPress={() => void pickStepAttachments()}
                  disabled={uploadingStepAttachments || savingStep}
                  style={[
                    styles.attachmentAddBtn,
                    { alignSelf: 'flex-start' },
                    (uploadingStepAttachments || savingStep) && styles.disabled,
                  ]}
                >
                  {uploadingStepAttachments ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Paperclip size={14} color={colors.primary} />
                  )}
                  <Text style={styles.attachmentAddText}>
                    {uploadingStepAttachments ? 'Đang tải...' : 'Thêm tệp'}
                  </Text>
                </Pressable>
                {stepAttachments.length ? (
                  <View style={{ gap: 6 }}>
                    {stepAttachments.map((attachment, index) => (
                      <View key={attachment.id || `${attachment.url}-${index}`} style={styles.attachmentRow}>
                        <Paperclip size={14} color={colors.primary} />
                        <Text numberOfLines={1} style={styles.attachmentName}>
                          {attachment.name || 'Tệp đính kèm'}
                        </Text>
                        <Pressable
                          onPress={() => showHrConfirm({
                            title: 'Xóa tệp đính kèm?',
                            message: `Bạn có chắc muốn xóa tệp "${attachment.name || 'Tệp đính kèm'}"?`,
                            confirmLabel: 'Xóa tệp',
                            onConfirm: () => setStepAttachments((current) =>
                              current.filter((_, itemIndex) => itemIndex !== index),
                            ),
                          })}
                          hitSlop={8}
                          accessibilityLabel={`Gỡ tệp ${attachment.name}`}
                        >
                          <X size={16} color={colors.muted} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.muted}>Chưa có tệp đính kèm.</Text>
                )}
              </View>
            </HrFormCustomRow>
          </View>
        </FullScreenFormModal>
        {renderWorkflowFormModal()}
      </ScrollView>

      {/* Floating action widget for workflow actions */}
      <HrFab
        label="Tùy chọn quy trình"
        icon={<Ellipsis size={24} strokeWidth={2.2} color={colors.white} />}
        onPress={() => setActionSheetOpen(true)}
      />

      {/* Bottom Sheet: Thao tác quy trình (Quay lại danh sách / Thêm bước / Sửa / Xóa) */}
      <Modal
        visible={actionSheetOpen}
        transparent
        statusBarTranslucent
        animationType="slide"
        onRequestClose={() => setActionSheetOpen(false)}
      >
        <Pressable
          style={styles.bottomSheetBackdrop}
          onPress={() => setActionSheetOpen(false)}
        >
          <Pressable
            style={[
              styles.bottomSheetCard,
              { paddingBottom: Math.max(insets.bottom + 14, 24) },
            ]}
            onPress={() => {}}
          >
            <View style={styles.bottomSheetHandle} />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Quay lại danh sách"
              onPress={() => {
                setActionSheetOpen(false);
                setExpandedStepIds({});
                setSelectedWorkflow(null);
              }}
              style={({ pressed }) => [
                styles.actionSheetRow,
                pressed && styles.actionSheetRowPressed,
              ]}
            >
              <ArrowLeft size={18} strokeWidth={1.6} color={colors.ink} />
              <Text style={styles.actionSheetRowText}>Quay lại danh sách</Text>
            </Pressable>

            {canManage ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Thêm bước"
                  onPress={() => {
                    setActionSheetOpen(false);
                    openAddStep();
                  }}
                  style={({ pressed }) => [
                    styles.actionSheetRow,
                    pressed && styles.actionSheetRowPressed,
                  ]}
                >
                  <Plus size={18} strokeWidth={1.6} color={colors.ink} />
                  <Text style={styles.actionSheetRowText}>Thêm bước</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Sửa quy trình"
                  onPress={() => {
                    setActionSheetOpen(false);
                    openEditWorkflow(selectedWorkflow);
                  }}
                  style={({ pressed }) => [
                    styles.actionSheetRow,
                    pressed && styles.actionSheetRowPressed,
                  ]}
                >
                  <Pencil size={18} strokeWidth={1.6} color={colors.ink} />
                  <Text style={styles.actionSheetRowText}>Sửa quy trình</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Xóa quy trình"
                  onPress={() => {
                    setActionSheetOpen(false);
                    onDeleteWorkflow(selectedWorkflow);
                  }}
                  style={({ pressed }) => [
                    styles.actionSheetRow,
                    pressed && styles.actionSheetRowPressed,
                  ]}
                >
                  <Trash2 size={18} strokeWidth={1.6} color={colors.ink} />
                  <Text style={styles.actionSheetRowText}>Xóa quy trình</Text>
                </Pressable>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
      </View>
      </SlideInPage>
    );
  }

  // --- Workflow List Screen ---
  return (
    <View style={{ flex: 1 }}>
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: 92 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load(true);
          }}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      {categories.length > 1 || canManage ? (
        <View style={styles.catTopBar}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setCategoryFilterOpen(true)}
            style={({ pressed }) => [styles.catTriggerBtn, pressed && { opacity: 0.65 }]}
          >
            <Folder size={17} strokeWidth={1.6} color={colors.ink} />
            <Text numberOfLines={1} style={styles.catTriggerText}>
              {selectedCategory === 'Tất cả' ? 'Tất cả phân loại' : selectedCategory}
            </Text>
            <ChevronDown size={15} strokeWidth={1.7} color="#64748B" />
          </Pressable>
          {canManage ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Quản lý phân loại quy trình"
              onPress={() => {
                setCategoryManagerMode('list');
                setCategoryManagerOpen(true);
              }}
              hitSlop={8}
              style={({ pressed }) => [styles.catManageIconBtn, pressed && { opacity: 0.6 }]}
            >
              <CategoryManageIcon size={19} color={colors.ink} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.searchRow}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Tìm quy trình nội bộ..."
          placeholderTextColor="#94A3B8"
          style={[styles.search, { flex: 1 }]}
        />
      </View>

      {loading ? (
        <Card style={styles.stateCard}>
          <ActivityIndicator size="small" color={colors.primary} />
        </Card>
      ) : error ? (
        <Card style={styles.stateCard}>
          <PopupError error={error} />
          <Pressable onPress={() => void load()} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Thử lại</Text>
          </Pressable>
        </Card>
      ) : !filtered.length ? (
        <View style={styles.stateCard}>
          <IgenHrEmptyState message="Chưa có quy trình nội bộ nào." />
        </View>
      ) : (
        <View style={styles.list}>
          {filtered.map((wf) => (
            <Card
              key={wf.id}
              onPress={() => setSelectedWorkflow(wf)}
              style={styles.wfCard}
            >
              <View style={styles.wfCardContentRow}>
                <Text numberOfLines={2} style={[styles.rowTitle, { flex: 1, marginTop: 0 }]}>
                  {wf.name || wf.title || 'Quy trình'}
                </Text>
                <View style={styles.stepCountRow}>
                  <Text style={styles.stepCountBadge}>{wf.steps?.length ?? 0} bước</Text>
                </View>
              </View>
            </Card>
          ))}
        </View>
      )}

      {/* Category filter bottom sheet matching Employee Directory */}
      <Modal
        visible={categoryFilterOpen}
        transparent
        statusBarTranslucent
        animationType="slide"
        onRequestClose={() => setCategoryFilterOpen(false)}
      >
        <Pressable style={styles.catSheetBackdrop} onPress={() => setCategoryFilterOpen(false)}>
          <Pressable
            style={[styles.catSheet, { paddingBottom: Math.max(insets.bottom, 20) + 16 }]}
            onPress={() => {}}
          >
            <View style={styles.catSheetHandle} />
            <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
              {categories.map((cat) => {
                const selected = selectedCategory === cat;
                return (
                  <Pressable
                    key={cat}
                    onPress={() => {
                      setSelectedCategory(cat);
                      setCategoryFilterOpen(false);
                    }}
                    style={[styles.catSheetRow, selected && styles.catSheetRowActive]}
                  >
                    <Text style={[styles.catSheetRowText, selected && styles.catSheetRowTextActive]}>
                      {cat === 'Tất cả' ? 'Tất cả phân loại' : cat}
                    </Text>
                    {selected ? <Check size={17} color={colors.primary} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {renderWorkflowFormModal()}
      <Modal
        visible={categoryManagerOpen}
        transparent
        statusBarTranslucent
        animationType="slide"
        onRequestClose={() => {
          if (savingCategory) return;
          if (categoryManagerMode === 'list') {
            setCategoryManagerOpen(false);
          } else {
            setCategoryManagerMode('list');
          }
        }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable
            style={styles.catSheetBackdrop}
            onPress={() => {
              if (savingCategory) return;
              Keyboard.dismiss();
              setCategoryManagerMode('list');
              setCategoryManagerOpen(false);
            }}
          >
            <Pressable
              style={[
                styles.catSheet,
                { paddingBottom: Math.max(insets.bottom, 16) + 12 },
              ]}
              onPress={() => {}}
            >
              <View style={styles.catSheetHandle} />
              {categoryManagerMode === 'list' ? (
                <View style={{ gap: 6 }}>
                  <Pressable
                    onPress={openCreateCategory}
                    style={({ pressed }) => [styles.catSheetAddRow, pressed && { opacity: 0.65 }]}
                  >
                    <Plus size={17} strokeWidth={1.8} color={colors.ink} />
                    <Text style={styles.catSheetAddRowText}>Thêm phân loại quy trình</Text>
                  </Pressable>
                  <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                    <View style={{ gap: 6 }}>
                      {categories.slice(1).length ? categories.slice(1).map((category) => {
                        const count = workflows.filter((workflow) => workflow.category?.trim() === category).length;
                        return (
                          <View key={category} style={styles.categoryRow}>
                            <View style={styles.categoryRowCopy}>
                              <Text style={styles.rowTitle}>{category}</Text>
                              <Text style={styles.muted}>{count} quy trình</Text>
                            </View>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`Đổi tên phân loại ${category}`}
                              onPress={() => openRenameCategory(category)}
                              hitSlop={6}
                              style={({ pressed }) => [styles.categoryIconBtn, pressed && { opacity: 0.6 }]}
                            >
                              <Pencil size={17} strokeWidth={1.6} color={colors.ink} />
                            </Pressable>
                            {category !== 'Chung' ? (
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`Xóa phân loại ${category}`}
                                disabled={savingCategory}
                                onPress={() => onDeleteCategory(category)}
                                hitSlop={6}
                                style={({ pressed }) => [styles.categoryIconBtn, pressed && { opacity: 0.6 }, savingCategory && styles.disabled]}
                              >
                                <Trash2 size={17} strokeWidth={1.6} color="#C74848" />
                              </Pressable>
                            ) : null}
                          </View>
                        );
                      }) : (
                        <Text style={styles.categoryEmpty}>Chưa có phân loại nào.</Text>
                      )}
                    </View>
                  </ScrollView>
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  <Text style={styles.label}>
                    {categoryManagerMode === 'rename' ? 'Đổi tên phân loại *' : 'Tên phân loại quy trình *'}
                  </Text>
                  <TextInput
                    value={categoryNameDraft}
                    onChangeText={setCategoryNameDraft}
                    placeholder="Ví dụ: Nhân sự / Vận hành"
                    placeholderTextColor={colors.muted}
                    style={styles.field}
                    autoFocus
                  />
                  {categoryManagerMode === 'rename' ? (
                    <Text style={styles.muted}>
                      Sẽ cập nhật cho tất cả {workflows.filter((workflow) => workflow.category?.trim() === categoryEditFrom).length} quy trình đang dùng phân loại này.
                    </Text>
                  ) : null}
                  <View style={styles.categoryFormActions}>
                    <Pressable
                      disabled={savingCategory}
                      onPress={() => setCategoryManagerMode('list')}
                      style={[styles.categoryCancelBtn, savingCategory && styles.disabled]}
                    >
                      <Text style={styles.categoryActionText}>Hủy</Text>
                    </Pressable>
                    <Pressable
                      disabled={savingCategory}
                      onPress={() => void onSaveCategory()}
                      style={[styles.submitBtn, styles.categorySaveBtn, savingCategory && styles.disabled]}
                    >
                      <Text style={styles.submitBtnText}>
                        {savingCategory ? 'Đang lưu...' : categoryManagerMode === 'rename' ? 'Lưu thay đổi' : 'Thêm phân loại'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
    {canManage ? <HrFab label="Thêm quy trình" onPress={openCreateWorkflow} /> : null}
    </View>
  );
}

const HAIRLINE_CARD = {
  backgroundColor: colors.white,
  borderRadius: 10,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: '#E5EAF2',
  shadowOpacity: 0,
  shadowRadius: 0,
  shadowOffset: { width: 0, height: 0 },
  elevation: 0,
} as const;

const styles = StyleSheet.create({
  content: { paddingHorizontal: 14, paddingBottom: 28, backgroundColor: colors.white },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  search: {
    backgroundColor: '#F6F8FC',
    borderColor: '#DCE5F2',
    borderWidth: 1,
    borderRadius: 99,
    paddingHorizontal: 14,
    height: 40,
    fontSize: 13.5,
    color: '#111827',
  },
  primaryBtn: { backgroundColor: colors.primary, minHeight: 40, paddingHorizontal: 13, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: colors.white, fontSize: 12.5, fontWeight: '600' },
  iconButtonContent: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  stepTagRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  attachBtnContent: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepCountRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  dangerSmallBtn: { backgroundColor: '#FCEBEC', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  dangerSmallText: { color: '#C74848', fontSize: 12, fontWeight: '600' },
  editSmallBtn: { backgroundColor: '#EAF2FF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  editSmallText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  catTopBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, paddingBottom: 12, gap: 10 },
  catTriggerBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 },
  catTriggerText: { color: colors.ink, fontSize: 15, fontWeight: '400', flexShrink: 1 },
  catManageIconBtn: { padding: 6, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  categoryIconBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  catSheetAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: colors.white,
    marginBottom: 4,
  },
  catSheetAddRowText: { color: colors.ink, fontSize: 14.5, fontWeight: '400' },
  catSheetBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.35)', justifyContent: 'flex-end' },
  catSheet: { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 26 },
  catFormDialog: { borderRadius: 20, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 18 },
  catSheetHandle: { width: 38, height: 4, borderRadius: 99, backgroundColor: '#D6DFEC', alignSelf: 'center', marginBottom: 12 },
  catSheetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 13, borderRadius: 12, marginBottom: 4 },
  catSheetRowActive: { backgroundColor: '#F0F6FF' },
  catSheetRowText: { color: colors.ink, fontSize: 14.5, fontWeight: '400' },
  catSheetRowTextActive: { color: colors.primary, fontWeight: '500' },
  categoryHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  categoryHeadingText: { color: '#111827', fontSize: 13.5, fontWeight: '700' },
  categoryManageBtn: { ...HAIRLINE_CARD, paddingHorizontal: 11, paddingVertical: 6 },
  categoryManageText: { color: colors.primary, fontSize: 11.5, fontWeight: '500' },
  catScroll: { flexGrow: 0, marginHorizontal: -14, marginBottom: 12 },
  catRow: { paddingHorizontal: 14, gap: 6 },
  catChip: { backgroundColor: colors.white, borderColor: '#E5EAF2', borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99 },
  catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catText: { color: '#6B7280', fontSize: 11.5, fontWeight: '500' },
  catTextActive: { color: colors.white, fontWeight: '600' },
  categorySuggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  list: {
    marginHorizontal: -14,
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#EEF2F7',
    gap: 0,
  },
  wfCardContentRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wfCardMain: { flex: 1, gap: 4 },
  workflowCardActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  workflowListEditBtn: { minHeight: 34, minWidth: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, borderRadius: 9, backgroundColor: '#EAF2FF' },
  wfCard: {
    backgroundColor: colors.white,
    borderRadius: 0,
    borderWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEF2F7',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
  },
  wfCardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  rowTitle: { color: '#111827', fontSize: 14, fontWeight: '600', marginTop: 3 },
  badge: { alignSelf: 'flex-start', color: colors.primary, backgroundColor: '#EAF2FF', fontSize: 10.5, fontWeight: '500', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
  stepCountBadge: { color: '#0E7490', backgroundColor: '#E8F7FA', fontSize: 10.5, fontWeight: '500', paddingHorizontal: 8, paddingVertical: 3.5, borderRadius: 8, overflow: 'hidden' },
  muted: { color: '#6B7280', fontSize: 12.5, fontWeight: '400', lineHeight: 18 },
  stateCard: { ...HAIRLINE_CARD, padding: 22, alignItems: 'center', gap: 10 },
  errorText: { color: '#B91C1C', fontSize: 12.5, textAlign: 'center' },

  // Detail screen
  detailTopBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  backBtn: { ...HAIRLINE_CARD, paddingHorizontal: 12, paddingVertical: 8 },
  backText: { color: '#111827', fontSize: 12.5, fontWeight: '600' },
  detailHero: { ...HAIRLINE_CARD, padding: 15, gap: 8, marginBottom: 14 },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailTitle: { color: '#111827', fontSize: 16, fontWeight: '700' },
  detailDesc: { color: '#6B7280', fontSize: 12.5, lineHeight: 19 },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  sectionHeading: { color: '#111827', fontSize: 14.5, fontWeight: '700', flexShrink: 0 },
  sectionCategoryBadge: {
    color: colors.primary,
    backgroundColor: '#EAF2FF',
    fontSize: 10.5,
    fontWeight: '500',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
    flexShrink: 1,
  },
  flowWrap: { gap: 2 },
  flowItem: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  flowRail: { alignItems: 'center', width: 28 },
  stepNumCircle: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  stepNumText: { color: colors.white, fontSize: 11.5, fontWeight: '600' },
  flowLine: { width: 1.5, flex: 1, backgroundColor: '#DCE5F2', marginTop: 4 },
  stepCard: { ...HAIRLINE_CARD, flex: 1, padding: 13, gap: 6, marginBottom: 10 },
  stepCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  stepTitle: { color: '#111827', fontSize: 14, fontWeight: '600', flex: 1 },
  stepExpandBtn: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  stepSubTasksWrap: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EEF2F7',
    gap: 6,
  },
  stepSubTaskItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepSubTaskText: { flex: 1, color: '#374151', fontSize: 12.5, lineHeight: 18 },
  bottomSheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
  },
  bottomSheetCard: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  bottomSheetHandle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    marginBottom: 12,
  },
  actionSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionSheetRowPressed: {
    backgroundColor: '#F8FAFC',
  },
  actionSheetRowText: {
    color: colors.ink,
    fontSize: 14.5,
    fontWeight: '400',
  },
  chevron: { color: colors.muted, fontSize: 18 },
  stepMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 2 },
  stepTagGreen: { backgroundColor: '#E9F8F1', color: '#16885A', fontSize: 10.5, fontWeight: '500', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
  stepTagAmber: { backgroundColor: '#FFF3E5', color: '#C27617', fontSize: 10.5, fontWeight: '500', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
  stepTagBlue: { backgroundColor: '#EAF2FF', color: colors.primary, fontSize: 10.5, fontWeight: '500', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },

  // Modals
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.35)', justifyContent: 'center', padding: 16 },
  sheet: { backgroundColor: colors.white, borderRadius: 20, overflow: 'hidden', padding: 18, maxHeight: '86%' },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, gap: 10 },
  categoryAddBtn: { backgroundColor: '#EAF2FF', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, marginBottom: 8, alignSelf: 'flex-start' },
  categoryAddText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EEF2F7' },
  categoryRowCopy: { flex: 1, gap: 2 },
  categoryActionBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, backgroundColor: '#EAF2FF' },
  categoryActionText: { color: colors.primary, fontSize: 11, fontWeight: '600' },
  categoryDeleteBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, backgroundColor: '#FCEBEC' },
  categoryDeleteText: { color: '#C74848', fontSize: 11, fontWeight: '600' },
  categoryEmpty: { color: '#6B7280', fontSize: 12.5, lineHeight: 18, paddingVertical: 12 },
  categoryFormActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  categoryCancelBtn: { minHeight: 44, paddingHorizontal: 18, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  categorySaveBtn: { flex: 1 },
  stepEyebrow: { color: colors.primary, fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  sheetTitle: { color: '#111827', fontSize: 16, fontWeight: '600', marginTop: 2 },
  closeText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  bodyText: { color: '#374151', fontSize: 13.5, lineHeight: 20 },
  noteBox: { backgroundColor: '#FFF8EB', borderColor: '#FDE2B8', borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12, gap: 4 },
  noteTitle: { color: '#B45309', fontSize: 12, fontWeight: '600' },
  noteText: { color: '#92400E', fontSize: 12.5, lineHeight: 18 },
  deliverableBox: { backgroundColor: '#E9F8F1', borderColor: '#BBEAD3', borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12, gap: 4 },
  deliverableTitle: { color: '#16885A', fontSize: 12, fontWeight: '600' },
  deliverableText: { color: '#14532D', fontSize: 12.5, lineHeight: 18 },
  subSectionLabel: { color: '#111827', fontSize: 12.5, fontWeight: '600' },
  subTaskRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  subTaskEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F6F8FC' },
  subTaskAddRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  subTaskAddBtn: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#EAF2FF' },
  subDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  subTaskText: { color: '#374151', fontSize: 13, flex: 1 },
  attachBtn: { backgroundColor: '#EAF2FF', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 },
  attachBtnText: { color: colors.primary, fontSize: 12.5, fontWeight: '600' },
  attachmentSection: { gap: 8, marginTop: 2, padding: 12, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5EAF2', backgroundColor: colors.white },
  attachmentHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  attachmentAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#EAF2FF' },
  attachmentAddText: { color: colors.primary, fontSize: 11.5, fontWeight: '600' },
  attachmentRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9, backgroundColor: '#F6F8FC' },
  attachmentName: { flex: 1, color: '#111827', fontSize: 12 },
  label: { color: '#374151', fontSize: 12.5, fontWeight: '500', marginTop: 4 },
  field: { backgroundColor: '#F6F8FC', borderColor: '#DCE5F2', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13.5, color: '#111827' },
  submitBtn: { backgroundColor: colors.primary, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  submitBtnText: { color: colors.white, fontSize: 13.5, fontWeight: '600' },
  deleteBtn: { backgroundColor: '#FCEBEC', minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  deleteBtnText: { color: '#C74848', fontSize: 13, fontWeight: '600' },
  disabled: { opacity: 0.45 },
});

