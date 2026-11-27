import { withAppLockSuspended } from '@/core/auth/appLockSuspension';
import { PopupError } from '@/components/PopupError';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Check, ChevronLeft, ChevronRight, Paperclip, Plus, X } from 'lucide-react-native';
import { Card } from '@/components/Card';
import { FullScreenFormModal } from '@/components/FullScreenFormModal';
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

export function HrWorkflowsPanel({
  companyCode,
  canManage = false,
}: {
  companyCode?: string;
  canManage?: boolean;
}) {
  const { user } = useAuth();
  const creatorUid = user?._id || user?.id || '';
  const [workflows, setWorkflows] = useState<HrWorkflow[]>([]);
  const [workflowCategories, setWorkflowCategories] = useState<HrWorkflowCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tất cả');

  // Detail view state
  const [selectedWorkflow, setSelectedWorkflow] = useState<HrWorkflow | null>(null);
  const [selectedStep, setSelectedStep] = useState<{ step: HrWorkflowStep; index: number } | null>(
    null,
  );

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
        <View style={{ gap: 8, paddingBottom: 12 }}>
          <Text style={styles.label}>Tên quy trình *</Text>
          <TextInput
            value={wfName}
            onChangeText={setWfName}
            placeholder="VD: Quy trình tiếp nhận nhân sự mới"
            placeholderTextColor={colors.muted}
            style={styles.field}
          />
          <Text style={styles.label}>Danh mục</Text>
          <TextInput
            value={wfCategory}
            onChangeText={setWfCategory}
            placeholder="VD: Nhân sự / Vận hành"
            placeholderTextColor={colors.muted}
            style={styles.field}
          />
          {categories.length > 1 ? (
            <View style={styles.categorySuggestions}>
              {categories.slice(1).map((category) => (
                <Pressable
                  key={category}
                  onPress={() => setWfCategory(category)}
                  style={[styles.catChip, wfCategory.trim() === category && styles.catChipActive]}
                >
                  <Text style={[styles.catText, wfCategory.trim() === category && styles.catTextActive]}>{category}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Text style={styles.label}>Mô tả</Text>
          <TextInput
            value={wfDesc}
            onChangeText={setWfDesc}
            multiline
            placeholder="Mục đích và phạm vi áp dụng..."
            placeholderTextColor={colors.muted}
            style={[styles.field, { minHeight: 74, textAlignVertical: 'top' }]}
          />
          <Pressable
            disabled={savingWf}
            onPress={() => void (editingWorkflow ? onUpdateWorkflow() : onCreateWorkflow())}
            style={[styles.submitBtn, savingWf && styles.disabled]}
          >
            <Text style={styles.submitBtnText}>
              {savingWf
                ? 'Đang lưu...'
                : editingWorkflow ? 'Lưu quy trình' : 'Tạo quy trình'}
            </Text>
          </Pressable>
        </View>
      </FullScreenFormModal>
    );
  }

  // --- Workflow Detail Screen ---
  if (selectedWorkflow) {
    const steps = selectedWorkflow.steps ?? [];
    return (
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.detailTopBar}>
          <Pressable onPress={() => setSelectedWorkflow(null)} style={styles.backBtn}>
            <View style={styles.iconButtonContent}><ChevronLeft size={15} color={colors.primary} /><Text style={styles.backText}>Danh sách</Text></View>
          </Pressable>
          {canManage ? (
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Pressable onPress={() => openEditWorkflow(selectedWorkflow)} style={styles.editSmallBtn}>
                <Text style={styles.editSmallText}>Sửa</Text>
              </Pressable>
              <Pressable onPress={openAddStep} style={styles.primaryBtn}>
                <View style={styles.iconButtonContent}><Plus size={13} color={colors.white} /><Text style={styles.primaryBtnText}>Bước</Text></View>
              </Pressable>
              <Pressable
                onPress={() => onDeleteWorkflow(selectedWorkflow)}
                style={styles.dangerSmallBtn}
              >
                <Text style={styles.dangerSmallText}>Xóa</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <Card style={styles.detailHero}>
          <View style={styles.heroMetaRow}>
            {selectedWorkflow.category ? (
              <Text style={styles.badge}>{selectedWorkflow.category}</Text>
            ) : null}
            <Text style={styles.stepCountBadge}>{steps.length} bước thực hiện</Text>
          </View>
          <Text style={styles.detailTitle}>
            {selectedWorkflow.name || selectedWorkflow.title || 'Quy trình nội bộ'}
          </Text>
          {selectedWorkflow.description ? (
            <Text style={styles.detailDesc}>{selectedWorkflow.description}</Text>
          ) : null}
        </Card>

        <Text style={styles.sectionHeading}>Sơ đồ các bước thực hiện</Text>

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
                      <ChevronRight size={16} color={colors.muted} />
                    </View>
                    {step.description ? (
                      <Text numberOfLines={2} style={styles.muted}>
                        {step.description}
                      </Text>
                    ) : null}
                    <View style={styles.stepMetaRow}>
                      {step.deliverable ? (
                        <View style={styles.stepTagRow}><Check size={12} color="#15803D" /><Text style={styles.stepTagGreen}>Có kết quả đầu ra</Text></View>
                      ) : null}
                      {step.note ? <Text style={styles.stepTagAmber}>! Có lưu ý</Text> : null}
                      {step.subTasks?.length ? (
                        <Text style={styles.stepTagBlue}>{step.subTasks.length} công việc con</Text>
                      ) : null}
                      {step.attachments?.length ? (
                        <View style={styles.stepTagRow}><Paperclip size={12} color={colors.primary} /><Text style={styles.stepTagBlue}>{step.attachments.length} tệp</Text></View>
                      ) : null}
                    </View>
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
          <View style={{ gap: 8, paddingBottom: 12 }}>
            <Text style={styles.label}>Tên bước *</Text>
            <TextInput value={stepTitle} onChangeText={setStepTitle} style={styles.field} />

            <Text style={styles.label}>Mô tả chi tiết</Text>
            <TextInput
              value={stepDesc}
              onChangeText={setStepDesc}
              multiline
              style={[styles.field, { minHeight: 74, textAlignVertical: 'top' }]}
            />

            <Text style={styles.label}>Lưu ý quan trọng</Text>
            <TextInput value={stepNote} onChangeText={setStepNote} style={styles.field} />

            <Text style={styles.label}>Kết quả cần đạt</Text>
            <TextInput
              value={stepDeliverable}
              onChangeText={setStepDeliverable}
              style={styles.field}
            />

            <Text style={styles.label}>Công việc con ({stepSubTasks.length})</Text>
            {stepSubTasks.map((task) => (
              <View key={task.id} style={styles.subTaskEditRow}>
                <View style={styles.subDot} />
                <Text style={styles.subTaskText}>{task.title}</Text>
                <Pressable
                  onPress={() => removeStepSubTask(task.id)}
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
                placeholderTextColor={colors.muted}
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

            <View style={styles.attachmentSection}>
              <View style={styles.attachmentHeading}>
                <Text style={styles.label}>Tệp đính kèm ({stepAttachments.length})</Text>
                <Pressable
                  onPress={() => void pickStepAttachments()}
                  disabled={uploadingStepAttachments || savingStep}
                  style={[
                    styles.attachmentAddBtn,
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
              </View>
              {stepAttachments.length ? (
                <View style={{ gap: 6 }}>
                  {stepAttachments.map((attachment, index) => (
                    <View key={attachment.id || `${attachment.url}-${index}`} style={styles.attachmentRow}>
                      <Paperclip size={14} color={colors.primary} />
                      <Text numberOfLines={1} style={styles.attachmentName}>
                        {attachment.name || 'Tệp đính kèm'}
                      </Text>
                      <Pressable
                        onPress={() =>
                          setStepAttachments((current) =>
                            current.filter((_, itemIndex) => itemIndex !== index),
                          )
                        }
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

            <Pressable
              disabled={savingStep || uploadingStepAttachments}
              onPress={() => void onSaveStep()}
              style={[
                styles.submitBtn,
                (savingStep || uploadingStepAttachments) && styles.disabled,
              ]}
            >
              <Text style={styles.submitBtnText}>
                {uploadingStepAttachments
                  ? 'Đang tải tệp...'
                  : savingStep
                    ? 'Đang lưu...'
                    : 'Lưu bước'}
              </Text>
            </Pressable>
          </View>
        </FullScreenFormModal>
        {renderWorkflowFormModal()}
      </ScrollView>
    );
  }

  // --- Workflow List Screen ---
  return (
    <ScrollView
      contentContainerStyle={styles.content}
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
      <View style={styles.searchRow}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Tìm quy trình nội bộ..."
          placeholderTextColor={colors.muted}
          style={[styles.search, { flex: 1 }]}
        />
        {canManage ? (
          <Pressable onPress={openCreateWorkflow} style={styles.primaryBtn}>
            <View style={styles.iconButtonContent}><Plus size={13} color={colors.white} /><Text style={styles.primaryBtnText}>Quy trình</Text></View>
          </Pressable>
        ) : null}
      </View>

      {categories.length > 1 || canManage ? (
        <>
          {canManage ? (
            <View style={styles.categoryHeading}>
              <Text style={styles.categoryHeadingText}>Phân loại quy trình</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Quản lý phân loại quy trình"
                onPress={() => {
                  setCategoryManagerMode('list');
                  setCategoryManagerOpen(true);
                }}
                style={styles.categoryManageBtn}
              >
                <Text style={styles.categoryManageText}>Quản lý phân loại</Text>
              </Pressable>
            </View>
          ) : null}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catRow}
            style={styles.catScroll}
          >
            {categories.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <Pressable
                  key={cat}
                  onPress={() => setSelectedCategory(cat)}
                  style={[styles.catChip, active && styles.catChipActive]}
                >
                  <Text style={[styles.catText, active && styles.catTextActive]}>{cat}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      ) : null}

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
        <Card style={styles.stateCard}>
          <Text style={styles.muted}>Chưa có quy trình nội bộ nào.</Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {filtered.map((wf) => (
            <Card key={wf.id} style={styles.wfCard}>
              <View style={styles.wfCardContentRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setSelectedWorkflow(wf)}
                  style={styles.wfCardMain}
                >
                  <View style={styles.wfCardTop}>
                    <View style={{ flex: 1 }}>
                      {wf.category ? <Text style={styles.badge}>{wf.category}</Text> : null}
                      <Text numberOfLines={2} style={styles.rowTitle}>
                        {wf.name || wf.title || 'Quy trình'}
                      </Text>
                    </View>
                  </View>
                  {wf.description ? (
                    <Text numberOfLines={2} style={styles.muted}>
                      {wf.description}
                    </Text>
                  ) : null}
                </Pressable>
                <View style={styles.workflowCardActions}>
                  <View style={styles.stepCountRow}>
                    <Text style={styles.stepCountBadge}>{wf.steps?.length ?? 0} bước</Text>
                    <ChevronRight size={13} color={colors.muted} />
                  </View>
                  {canManage ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Sửa quy trình ${wf.name || wf.title || ''}`}
                      onPress={() => openEditWorkflow(wf)}
                      style={styles.workflowListEditBtn}
                    >
                      <Text style={styles.editSmallText}>Sửa</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </Card>
          ))}
        </View>
      )}

      {renderWorkflowFormModal()}
      <FullScreenFormModal
        visible={categoryManagerOpen}
        title={
          categoryManagerMode === 'list'
            ? 'Quản lý phân loại'
            : categoryManagerMode === 'rename' ? 'Đổi tên phân loại' : 'Tạo phân loại'
        }
        cancelLabel={categoryManagerMode === 'list' ? undefined : 'Hủy'}
        onSave={categoryManagerMode === 'list' ? undefined : () => void onSaveCategory()}
        saving={savingCategory}
        onClose={() => {
          if (categoryManagerMode === 'list') {
            setCategoryManagerOpen(false);
          } else {
            setCategoryManagerMode('list');
          }
        }}
      >
        {categoryManagerMode === 'list' ? (
          <View style={{ gap: 8, paddingBottom: 12 }}>
            <Text style={styles.muted}>Tạo phân loại riêng và gán cho quy trình bất cứ lúc nào.</Text>
            <Pressable onPress={openCreateCategory} style={styles.categoryAddBtn}>
              <View style={styles.iconButtonContent}>
                <Plus size={14} color={colors.primary} />
                <Text style={styles.categoryAddText}>Tạo phân loại</Text>
              </View>
            </Pressable>
            {categories.slice(1).length ? categories.slice(1).map((category) => {
              const count = workflows.filter((workflow) => workflow.category?.trim() === category).length;
              return (
                <View key={category} style={styles.categoryRow}>
                  <View style={styles.categoryRowCopy}>
                    <Text style={styles.rowTitle}>{category}</Text>
                    <Text style={styles.muted}>{count} quy trình</Text>
                  </View>
                  <Pressable onPress={() => openRenameCategory(category)} style={styles.categoryActionBtn}>
                    <Text style={styles.categoryActionText}>Đổi tên</Text>
                  </Pressable>
                  {category !== 'Chung' ? (
                    <Pressable
                      disabled={savingCategory}
                      onPress={() => onDeleteCategory(category)}
                      style={styles.categoryDeleteBtn}
                    >
                      <Text style={styles.categoryDeleteText}>Xóa</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            }) : (
              <Text style={styles.categoryEmpty}>Chưa có phân loại. Bạn có thể tạo danh mục trước khi có quy trình.</Text>
            )}
          </View>
        ) : (
          <View style={{ gap: 8, paddingBottom: 12 }}>
            <Text style={styles.label}>Tên phân loại *</Text>
            <TextInput
              value={categoryNameDraft}
              onChangeText={setCategoryNameDraft}
              placeholder="Ví dụ: Nhân sự / Vận hành"
              placeholderTextColor={colors.muted}
              style={styles.field}
            />
            {categoryManagerMode === 'rename' ? (
              <Text style={styles.muted}>
                Tên phân loại sẽ được cập nhật cho tất cả {workflows.filter((workflow) => workflow.category?.trim() === categoryEditFrom).length} quy trình đang sử dụng.
              </Text>
            ) : (
              <Text style={styles.muted}>Phân loại sẽ được lưu riêng. Bạn có thể gán vào quy trình khi tạo hoặc cập nhật quy trình.</Text>
            )}
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
                  {savingCategory ? 'Đang lưu...' : categoryManagerMode === 'rename' ? 'Lưu thay đổi' : 'Tạo phân loại'}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </FullScreenFormModal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingBottom: 28 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  search: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 12,
    color: colors.ink,
  },
  primaryBtn: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 },
  primaryBtnText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  iconButtonContent: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  stepTagRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  attachBtnContent: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepCountRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  dangerSmallBtn: { backgroundColor: '#FCEBEC', paddingHorizontal: 11, paddingVertical: 9, borderRadius: 10 },
  dangerSmallText: { color: '#C74848', fontSize: 11, fontWeight: '700' },
  editSmallBtn: { backgroundColor: '#EAF2FF', paddingHorizontal: 11, paddingVertical: 9, borderRadius: 10 },
  editSmallText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  categoryHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 },
  categoryHeadingText: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  categoryManageBtn: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9 },
  categoryManageText: { color: colors.primary, fontSize: 10, fontWeight: '700' },
  catScroll: { marginHorizontal: -18, marginBottom: 12 },
  catRow: { paddingHorizontal: 18, gap: 6 },
  catChip: { backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99 },
  catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  catTextActive: { color: colors.white },
  categorySuggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  list: { gap: 10 },
  wfCardContentRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wfCardMain: { flex: 1, gap: 6 },
  workflowCardActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  workflowListEditBtn: { minHeight: 34, minWidth: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, borderRadius: 9, backgroundColor: '#EAF2FF' },
  wfCard: { padding: 13, gap: 6 },
  wfCardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  rowTitle: { color: colors.ink, fontSize: 13, fontWeight: '800', marginTop: 3 },
  badge: { alignSelf: 'flex-start', color: colors.primary, backgroundColor: '#EAF2FF', fontSize: 9, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, overflow: 'hidden' },
  stepCountBadge: { color: '#0E7490', backgroundColor: '#E8F7FA', fontSize: 10, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99, overflow: 'hidden' },
  muted: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  stateCard: { padding: 20, alignItems: 'center', gap: 10 },
  errorText: { color: '#B91C1C', fontSize: 12, textAlign: 'center' },

  // Detail screen
  detailTopBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  backBtn: { backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10 },
  backText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  detailHero: { padding: 15, gap: 8, marginBottom: 14 },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  detailDesc: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  sectionHeading: { color: colors.ink, fontSize: 13, fontWeight: '800', marginBottom: 10 },
  flowWrap: { gap: 2 },
  flowItem: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  flowRail: { alignItems: 'center', width: 28 },
  stepNumCircle: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  stepNumText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  flowLine: { width: 2, flex: 1, backgroundColor: '#CBD5E1', marginTop: 4 },
  stepCard: { flex: 1, padding: 12, gap: 6, marginBottom: 10 },
  stepCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  stepTitle: { color: colors.ink, fontSize: 13, fontWeight: '800', flex: 1 },
  chevron: { color: colors.muted, fontSize: 18 },
  stepMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 2 },
  stepTagGreen: { backgroundColor: '#E9F8F1', color: '#16885A', fontSize: 9, fontWeight: '700', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  stepTagAmber: { backgroundColor: '#FFF3E5', color: '#C27617', fontSize: 9, fontWeight: '700', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  stepTagBlue: { backgroundColor: '#EAF2FF', color: colors.primary, fontSize: 9, fontWeight: '700', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },

  // Modals
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.42)', justifyContent: 'center', padding: 16 },
  sheet: { backgroundColor: colors.white, borderRadius: 24, overflow: 'hidden', padding: 18, maxHeight: '86%' },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, gap: 10 },
  categoryAddBtn: { backgroundColor: '#EAF2FF', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, marginBottom: 8, alignSelf: 'flex-start' },
  categoryAddText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  categoryRowCopy: { flex: 1, gap: 2 },
  categoryActionBtn: { paddingHorizontal: 9, paddingVertical: 7, borderRadius: 8, backgroundColor: '#EAF2FF' },
  categoryActionText: { color: colors.primary, fontSize: 10, fontWeight: '700' },
  categoryDeleteBtn: { paddingHorizontal: 9, paddingVertical: 7, borderRadius: 8, backgroundColor: '#FCEBEC' },
  categoryDeleteText: { color: '#C74848', fontSize: 10, fontWeight: '700' },
  categoryEmpty: { color: colors.muted, fontSize: 11, lineHeight: 16, paddingVertical: 12 },
  categoryFormActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  categoryCancelBtn: { minHeight: 42, paddingHorizontal: 18, borderRadius: 11, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  categorySaveBtn: { flex: 1 },
  stepEyebrow: { color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  sheetTitle: { color: colors.ink, fontSize: 16, fontWeight: '800', marginTop: 2 },
  closeText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  bodyText: { color: colors.ink, fontSize: 13, lineHeight: 20 },
  noteBox: { backgroundColor: '#FFF8EB', borderColor: '#FDE2B8', borderWidth: 1, borderRadius: 12, padding: 12, gap: 4 },
  noteTitle: { color: '#B45309', fontSize: 11, fontWeight: '800' },
  noteText: { color: '#92400E', fontSize: 12, lineHeight: 18 },
  deliverableBox: { backgroundColor: '#E9F8F1', borderColor: '#BBEAD3', borderWidth: 1, borderRadius: 12, padding: 12, gap: 4 },
  deliverableTitle: { color: '#16885A', fontSize: 11, fontWeight: '800' },
  deliverableText: { color: '#14532D', fontSize: 12, lineHeight: 18 },
  subSectionLabel: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  subTaskRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  subTaskEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.background },
  subTaskAddRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  subTaskAddBtn: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 11, borderRadius: 10, backgroundColor: '#EAF2FF' },
  subDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
  subTaskText: { color: colors.ink, fontSize: 12, flex: 1 },
  attachBtn: { backgroundColor: '#EAF2FF', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 },
  attachBtnText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  attachmentSection: { gap: 8, marginTop: 2, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  attachmentHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  attachmentAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: '#EAF2FF' },
  attachmentAddText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  attachmentRow: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 9, backgroundColor: colors.background },
  attachmentName: { flex: 1, color: colors.ink, fontSize: 11 },
  label: { color: colors.ink, fontSize: 11, fontWeight: '700', marginTop: 4 },
  field: { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 9, fontSize: 12, color: colors.ink },
  submitBtn: { backgroundColor: colors.primary, minHeight: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  submitBtnText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  deleteBtn: { backgroundColor: '#FCEBEC', minHeight: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  deleteBtnText: { color: '#C74848', fontSize: 12, fontWeight: '700' },
  disabled: { opacity: 0.45 },
});

