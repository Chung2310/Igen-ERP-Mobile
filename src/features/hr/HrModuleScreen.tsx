import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Building2, CalendarDays, Check, ChevronDown, ClipboardList, FileText, GraduationCap, MapPinned, Network, NotebookText, Target, Wallet, Workflow } from 'lucide-react-native';
import { useAuth } from '@/core/auth/AuthProvider';
import { HrBranchesPanel } from '@/features/hr/sections/HrBranchesPanel';
import { HrContractsPanel } from '@/features/hr/sections/HrContractsPanel';
import { HrLeavesPanel } from '@/features/hr/sections/HrLeavesPanel';
import { HrPayrollPanel } from '@/features/hr/sections/HrPayrollPanel';
import { HrRecruitmentPanel } from '@/features/hr/sections/HrRecruitmentPanel';
import { HrSchedulePanel } from '@/features/hr/sections/HrSchedulePanel';
import { KanbanTasksPanel } from '@/features/hr/sections/KanbanTasksPanel';
import { OrgChartPanel } from '@/features/hr/sections/OrgChartPanel';
import {
  DepartmentsPanel,
} from '@/features/hr/sections/HrManagementPanels';
import { HrTrainingPanel } from '@/features/hr/sections/HrTrainingPanel';
import { HrWorkflowsPanel } from '@/features/hr/sections/HrWorkflowsPanel';
import type { HrTabId } from '@/features/hr/types';
import { fetchCompanyBranches, type ErpBranch } from '@/features/overview/overviewApi';
import { colors } from '@/theme/colors';

const HR_TABS: Array<{ key: HrTabId; label: string; icon: LucideIcon; readPermissions?: string[] }> = [
  { key: 'employees', label: 'Sơ đồ tổ chức', icon: Network },
  { key: 'departments', label: 'Phòng ban', icon: Building2, readPermissions: ['hr:read', 'access:read', 'hr:manage', 'access:manage'] },
  { key: 'branches', label: 'Chi nhánh', icon: MapPinned, readPermissions: ['access:read', 'hr:read'] },
  { key: 'training', label: 'Đào tạo', icon: GraduationCap, readPermissions: ['hr:read', 'hr:manage'] },
  { key: 'workflows', label: 'Quy trình', icon: Workflow, readPermissions: ['hr:read', 'hr:manage'] },
  { key: 'tasks', label: 'Giao việc', icon: ClipboardList },
  { key: 'attendance', label: 'Lịch & Chấm công', icon: CalendarDays },
  { key: 'leaves', label: 'Đơn từ', icon: NotebookText },
  { key: 'contracts', label: 'Hợp đồng', icon: FileText },
  { key: 'payroll', label: 'Bảng lương', icon: Wallet },
  { key: 'recruitment', label: 'Tuyển dụng', icon: Target },
];

export function HrModuleScreen() {
  const {
    user,
    activeBranchId: selectedBranchId,
    setActiveBranchId: setSelectedBranchId,
  } = useAuth();
  const [activeTab, setActiveTab] = useState<HrTabId>('employees');

  const isAdmin = user?.role === 'superadmin' || user?.role === 'admin';
  const isManager = isAdmin || user?.role === 'manager';
  const perms = user?.permissions ?? [];
  const hasPerm = (code: string) => isAdmin || perms.includes('*') || perms.includes(code);

  const canSwitchBranch = isAdmin || !user?.branchId;
  const [branches, setBranches] = useState<ErpBranch[]>([]);
  const [branchReloadTick, setBranchReloadTick] = useState(0);
  const [branchModalOpen, setBranchModalOpen] = useState(false);

  useEffect(() => {
    if (!user?.companyCode || (!canSwitchBranch && user.branchId)) {
      if (user?.branchId) setSelectedBranchId(user.branchId);
      return;
    }
    const controller = new AbortController();
    void fetchCompanyBranches(controller.signal)
      .then((list) => {
        if (controller.signal.aborted) return;
        setBranches(list);
        setSelectedBranchId((current) => {
          if (current && list.some((b) => b._id === current)) return current;
          if (user.branchId && list.some((b) => b._id === user.branchId)) return user.branchId;
          return list[0]?._id ?? '';
        });
      })
      .catch(() => {});
    return () => controller.abort();
  }, [branchReloadTick, canSwitchBranch, user?.branchId, user?.companyCode]);

  const activeBranchId = selectedBranchId || user?.branchId || undefined;
  const activeBranchName = activeBranchId
    ? branches.find((b) => b._id === activeBranchId)?.name || (activeBranchId === user?.branchId ? user?.branchName : undefined) || 'Chọn chi nhánh'
    : 'Chọn chi nhánh';

  const canApproveLeaves = isManager || hasPerm('hr:manage') || hasPerm('timekeeping:manage');
  const canManageDepartments = isAdmin || hasPerm('hr:manage') || hasPerm('access:manage');
  const canViewAllAttendance =
    isManager ||
    hasPerm('hr:manage') ||
    hasPerm('timekeeping:manage') ||
    hasPerm('timekeeping:edit') ||
    hasPerm('payroll-period:manage');
  const canViewAllPayroll =
    isAdmin || hasPerm('payroll-period:read') || hasPerm('payroll-period:manage');
  const canViewPayrollPolicies = isAdmin || hasPerm('payroll-policy:read') || hasPerm('payroll-policy:manage');
  const canManagePayrollPayments = isAdmin || hasPerm('payroll-payment:manage');
  const visibleTabs = HR_TABS.filter((tab) => !tab.readPermissions || tab.readPermissions.some(hasPerm));
  const activeVisibleTab = visibleTabs.some((tab) => tab.key === activeTab)
    ? activeTab
    : visibleTabs[0]?.key ?? activeTab;

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          headerRight:
            branches.length > 0 && canSwitchBranch
              ? () => (
                  <Pressable onPress={() => setBranchModalOpen(true)} style={styles.headerBranchBtn}>
                    <View style={styles.branchBtnContent}>
                      <Text numberOfLines={1} style={styles.branchBtnText}>{activeBranchName}</Text>
                      <ChevronDown size={14} color={colors.primary} />
                    </View>
                  </Pressable>
                )
              : undefined,
        }}
      />

      {/* Horizontal HR sub-module navigation */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsRow}
        style={styles.tabsScroll}
      >
        {visibleTabs.map((tab) => {
          const active = activeVisibleTab === tab.key;
          const Icon = tab.icon;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setActiveTab(tab.key)}
              style={[styles.tabPill, active && styles.tabPillActive]}
            >
              <Icon size={15} color={active ? colors.primary : colors.muted} />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Active panel */}
      <View style={styles.body}>
        {/* These reference panels use companyCode without activeBranchId by design. */}
        {activeVisibleTab === 'employees' ? (
          <OrgChartPanel companyCode={user?.companyCode} />
        ) : activeVisibleTab === 'attendance' ? (
          <HrSchedulePanel
            companyCode={user?.companyCode}
            branchId={activeBranchId}
            canManageTimekeeping={isManager || hasPerm('timekeeping:manage') || hasPerm('hr:manage')}
            canManageCalendar={isManager || hasPerm('hr:manage') || hasPerm('timekeeping:manage')}
            canViewAllAttendance={canViewAllAttendance}
            canEditAttendance={isManager || hasPerm('timekeeping:manage') || hasPerm('timekeeping:edit')}
          />
        ) : activeVisibleTab === 'tasks' ? (
          <KanbanTasksPanel companyCode={user?.companyCode} branchId={activeBranchId} />
        ) : activeVisibleTab === 'leaves' ? (
          <HrLeavesPanel
            companyCode={user?.companyCode}
            branchId={activeBranchId}
            canApprove={canApproveLeaves}
          />
        ) : activeVisibleTab === 'contracts' ? (
          <HrContractsPanel
            companyCode={user?.companyCode}
            branchId={activeBranchId}
            canManage={isManager || canManageDepartments || hasPerm('hr-contract:manage')}
          />
        ) : activeVisibleTab === 'departments' ? (
          <DepartmentsPanel companyCode={user?.companyCode} canManage={canManageDepartments} />
        ) : activeVisibleTab === 'branches' ? (
          <HrBranchesPanel
            companyCode={user?.companyCode}
            canManage={isAdmin || hasPerm('access:manage')}
            onBranchesChanged={() => setBranchReloadTick((t) => t + 1)}
          />
        ) : activeVisibleTab === 'recruitment' ? (
          <HrRecruitmentPanel
            companyCode={user?.companyCode}
            branchId={activeBranchId}
            canManage={isManager || canManageDepartments || hasPerm('recruitment:manage')}
          />
        ) : activeVisibleTab === 'training' ? (
          <HrTrainingPanel
            companyCode={user?.companyCode}
            canManage={isManager || user?.role === 'branch_owner' || canManageDepartments || hasPerm('training:manage')}
          />
        ) : activeVisibleTab === 'workflows' ? (
          <HrWorkflowsPanel
            companyCode={user?.companyCode}
            canManage={hasPerm('hr:manage')}
          />
        ) : (
          <HrPayrollPanel
            companyCode={user?.companyCode}
            branchId={activeBranchId}
            canViewAll={canViewAllPayroll}
            canManage={isAdmin || hasPerm('payroll-period:manage')}
            canViewPolicies={canViewPayrollPolicies}
            canPublishPayslips={canManagePayrollPayments}
            canMarkPaid={canManagePayrollPayments}
          />
        )}
      </View>

      {/* Branch picker modal */}
      <Modal
        visible={branchModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setBranchModalOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setBranchModalOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Chọn chi nhánh</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {branches.map((branch) => {
                const selected = branch._id === activeBranchId;
                return (
                  <Pressable
                    key={branch._id}
                    onPress={() => {
                      setSelectedBranchId(branch._id);
                      setBranchModalOpen(false);
                    }}
                    style={[styles.branchRow, selected && styles.branchRowActive]}
                  >
                    <Text style={styles.branchRowTitle}>{branch.name}</Text>
                    {selected ? <Check size={17} color={colors.primary} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingTop: 8 },
  headerBranchBtn: {
    backgroundColor: '#EAF2FF',
    borderColor: '#D6E5FF',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
    maxWidth: 155,
  },
  branchBtnContent: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  branchBtnText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  tabsScroll: { flexGrow: 0, marginBottom: 10 },
  tabsRow: { paddingHorizontal: 18, gap: 7 },
  tabPill: {
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
  tabPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  tabTextActive: { color: colors.white },
  body: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.42)', justifyContent: 'center', padding: 16 },
  sheet: { backgroundColor: colors.white, borderRadius: 24, overflow: 'hidden', padding: 18, gap: 10 },
  sheetTitle: { color: colors.ink, fontSize: 16, fontWeight: '800', marginBottom: 4 },
  branchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 12, marginBottom: 6, backgroundColor: '#F8FAFD' },
  branchRowActive: { backgroundColor: '#EAF2FF' },
  branchRowTitle: { color: colors.ink, fontSize: 13, fontWeight: '700' },
});

