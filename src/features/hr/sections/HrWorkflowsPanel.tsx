import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Check, ChevronLeft, ChevronRight, Paperclip, Plus } from 'lucide-react-native';
import { Card } from '@/components/Card';
import { showHrConfirm } from '@/features/hr/components/HrConfirmModal';
import {
  createHrWorkflow,
  deleteHrWorkflow,
  listHrWorkflows,
  updateHrWorkflow,
} from '@/features/hr/hrApi';
import type { HrWorkflow, HrWorkflowStep } from '@/features/hr/types';
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
  const [workflows, setWorkflows] = useState<HrWorkflow[]>([]);
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
  const [stepSubTasksText, setStepSubTasksText] = useState('');
  const [savingStep, setSavingStep] = useState(false);

  // Create workflow modal
  const [createOpen, setCreateOpen] = useState(false);
  const [wfName, setWfName] = useState('');
  const [wfCategory, setWfCategory] = useState('');
  const [wfDesc, setWfDesc] = useState('');
  const [savingWf, setSavingWf] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const list = await listHrWorkflows(companyCode);
        setWorkflows(list);
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
    for (const w of workflows) {
      if (w.category?.trim()) set.add(w.category.trim());
    }
    return ['Tất cả', ...Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'))];
  }, [workflows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return workflows.filter((w) => {
      if (selectedCategory !== 'Tất cả' && (w.category || '') !== selectedCategory) return false;
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
    setStepSubTasksText('');
    setStepModalOpen(true);
  }, [selectedWorkflow?.steps?.length]);

  const openEditStep = useCallback((step: HrWorkflowStep) => {
    setSelectedStep(null);
    setEditingStepId(step.id);
    setStepTitle(step.title || '');
    setStepDesc(step.description || '');
    setStepNote(step.note || '');
    setStepDeliverable(step.deliverable || '');
    setStepSubTasksText((step.subTasks ?? []).map((t) => t.title).join('\n'));
    setStepModalOpen(true);
  }, []);

  const onSaveStep = useCallback(async () => {
    if (!selectedWorkflow || savingStep) return;
    if (!stepTitle.trim()) {
      Alert.alert('Thiếu tên bước', 'Vui lòng nhập tên bước thực hiện.');
      return;
    }
    const subTasks = stepSubTasksText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((title) => ({ id: makeId('sub'), title }));

    const currentSteps = selectedWorkflow.steps ?? [];
    const existing = editingStepId ? currentSteps.find((s) => s.id === editingStepId) : undefined;
    const nextStep: HrWorkflowStep = {
      id: editingStepId || makeId('step'),
      title: stepTitle.trim(),
      description: stepDesc.trim(),
      note: stepNote.trim(),
      deliverable: stepDeliverable.trim(),
      subTasks,
      attachments: existing?.attachments ?? [],
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
    stepSubTasksText,
    stepTitle,
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

  const onCreateWorkflow = useCallback(async () => {
    if (!wfName.trim() || savingWf) {
      if (!wfName.trim()) Alert.alert('Thiếu tên quy trình', 'Hãy nhập tên quy trình.');
      return;
    }
    setSavingWf(true);
    try {
      const created = await createHrWorkflow({
        companyCode: companyCode || 'SYSTEM',
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
  }, [companyCode, savingWf, wfCategory, wfDesc, wfName]);

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
                        <Text style={styles.stepTagBlue}>{step.subTasks.length} giai đoạn con</Text>
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

        {/* Step Detail Modal */}
        <Modal
          visible={Boolean(selectedStep)}
          transparent
          animationType="slide"
          onRequestClose={() => setSelectedStep(null)}
        >
          <Pressable style={styles.backdrop} onPress={() => setSelectedStep(null)}>
            <Pressable style={styles.sheet} onPress={() => {}}>
              {selectedStep ? (
                <>
                  <View style={styles.modalHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.stepEyebrow}>BƯỚC {selectedStep.index + 1}</Text>
                      <Text style={styles.sheetTitle}>
                        {selectedStep.step.title || `Bước ${selectedStep.index + 1}`}
                      </Text>
                    </View>
                    <Pressable onPress={() => setSelectedStep(null)} hitSlop={8}>
                      <Text style={styles.closeText}>Đóng</Text>
                    </Pressable>
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 440 }}>
                    <View style={{ gap: 12, paddingBottom: 10 }}>
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
                            Giai đoạn con ({selectedStep.step.subTasks.length})
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
                  </ScrollView>
                </>
              ) : null}
            </Pressable>
          </Pressable>
        </Modal>

        {/* Add / Edit Step Modal */}
        <Modal
          visible={stepModalOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setStepModalOpen(false)}
        >
          <Pressable style={styles.backdrop} onPress={() => setStepModalOpen(false)}>
            <Pressable style={styles.sheet} onPress={() => {}}>
              <View style={styles.modalHeader}>
                <Text style={styles.sheetTitle}>
                  {editingStepId ? 'Chỉnh sửa bước' : 'Thêm bước mới'}
                </Text>
                <Pressable onPress={() => setStepModalOpen(false)} hitSlop={8}>
                  <Text style={styles.closeText}>Đóng</Text>
                </Pressable>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 440 }}>
                <View style={{ gap: 8, paddingBottom: 10 }}>
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

                  <Text style={styles.label}>Giai đoạn con (mỗi dòng 1 mục)</Text>
                  <TextInput
                    value={stepSubTasksText}
                    onChangeText={setStepSubTasksText}
                    multiline
                    placeholder={'Kiểm tra hồ sơ\nTrình quản lý duyệt'}
                    placeholderTextColor={colors.muted}
                    style={[styles.field, { minHeight: 70, textAlignVertical: 'top' }]}
                  />

                  <Pressable
                    disabled={savingStep}
                    onPress={() => void onSaveStep()}
                    style={[styles.submitBtn, savingStep && styles.disabled]}
                  >
                    <Text style={styles.submitBtnText}>
                      {savingStep ? 'Đang lưu...' : 'Lưu bước'}
                    </Text>
                  </Pressable>
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
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
          <Pressable onPress={() => setCreateOpen(true)} style={styles.primaryBtn}>
            <View style={styles.iconButtonContent}><Plus size={13} color={colors.white} /><Text style={styles.primaryBtnText}>Quy trình</Text></View>
          </Pressable>
        ) : null}
      </View>

      {categories.length > 1 ? (
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
      ) : null}

      {loading ? (
        <Card style={styles.stateCard}>
          <ActivityIndicator size="small" color={colors.primary} />
        </Card>
      ) : error ? (
        <Card style={styles.stateCard}>
          <Text style={styles.errorText}>{error}</Text>
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
            <Card key={wf.id} onPress={() => setSelectedWorkflow(wf)} style={styles.wfCard}>
              <View style={styles.wfCardTop}>
                <View style={{ flex: 1 }}>
                  {wf.category ? <Text style={styles.badge}>{wf.category}</Text> : null}
                  <Text numberOfLines={2} style={styles.rowTitle}>
                    {wf.name || wf.title || 'Quy trình'}
                  </Text>
                </View>
                <View style={styles.stepCountRow}><Text style={styles.stepCountBadge}>{wf.steps?.length ?? 0} bước</Text><ChevronRight size={13} color={colors.muted} /></View>
              </View>
              {wf.description ? (
                <Text numberOfLines={2} style={styles.muted}>
                  {wf.description}
                </Text>
              ) : null}
            </Card>
          ))}
        </View>
      )}

      {/* Create Workflow Modal */}
      <Modal
        visible={createOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setCreateOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.sheetTitle}>Tạo quy trình mới</Text>
              <Pressable onPress={() => setCreateOpen(false)} hitSlop={8}>
                <Text style={styles.closeText}>Đóng</Text>
              </Pressable>
            </View>
            <View style={{ gap: 8 }}>
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
                onPress={() => void onCreateWorkflow()}
                style={[styles.submitBtn, savingWf && styles.disabled]}
              >
                <Text style={styles.submitBtnText}>
                  {savingWf ? 'Đang tạo...' : 'Tạo quy trình'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  catScroll: { marginHorizontal: -18, marginBottom: 12 },
  catRow: { paddingHorizontal: 18, gap: 6 },
  catChip: { backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99 },
  catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  catTextActive: { color: colors.white },
  list: { gap: 10 },
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
  subDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
  subTaskText: { color: colors.ink, fontSize: 12, flex: 1 },
  attachBtn: { backgroundColor: '#EAF2FF', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 },
  attachBtnText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  label: { color: colors.ink, fontSize: 11, fontWeight: '700', marginTop: 4 },
  field: { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 9, fontSize: 12, color: colors.ink },
  submitBtn: { backgroundColor: colors.primary, minHeight: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  submitBtnText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  deleteBtn: { backgroundColor: '#FCEBEC', minHeight: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  deleteBtnText: { color: '#C74848', fontSize: 12, fontWeight: '700' },
  disabled: { opacity: 0.45 },
});

