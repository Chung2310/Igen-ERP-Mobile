import { Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronDown } from 'lucide-react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { HrTabIcon } from '@/components/HrTabIcons';
import {
  ModuleSectionSwitcher,
  useModuleSectionTransition,
  type ModuleSectionItem,
} from '@/components/ModuleSectionSwitcher';
import { BranchAppIcon } from '@/components/OverviewTabIcons';
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

type HrTabMeta = {
  key: HrTabId;
  label: string;
  subtitle: string;
  readPermissions?: string[];
};

const HR_TABS: HrTabMeta[] = [
  { key: 'employees', label: 'Danh sách nhân sự', subtitle: 'Danh bạ, hồ sơ & liên hệ nhân sự' },
  { key: 'departments', label: 'Phòng ban', subtitle: 'Cơ cấu & quản lý các phòng ban', readPermissions: ['hr:read', 'access:read', 'hr:manage', 'access:manage'] },
  { key: 'branches', label: 'Chi nhánh', subtitle: 'Danh sách trụ sở & chi nhánh', readPermissions: ['access:read', 'hr:read'] },
  { key: 'training', label: 'Đào tạo', subtitle: 'Khóa học & tiến độ đào tạo nội bộ', readPermissions: ['hr:read', 'hr:manage'] },
  { key: 'workflows', label: 'Quy trình', subtitle: 'Quy trình vận hành & biểu mẫu HR', readPermissions: ['hr:read', 'hr:manage'] },
  { key: 'tasks', label: 'Giao việc', subtitle: 'Bảng công việc & theo dõi tiến độ' },
  { key: 'attendance', label: 'Lịch & Chấm công', subtitle: 'Lịch làm việc & dữ liệu chấm công' },
  { key: 'leaves', label: 'Đơn từ', subtitle: 'Nghỉ phép, tăng ca & phê duyệt' },
  { key: 'contracts', label: 'Hợp đồng', subtitle: 'Hợp đồng lao động & gia hạn' },
  { key: 'payroll', label: 'Bảng lương', subtitle: 'Kỳ lương, phiếu lương & thanh toán' },
  { key: 'recruitment', label: 'Tuyển dụng', subtitle: 'Tin tuyển dụng & hồ sơ ứng viên' },
];

export function HrModuleScreen() {
  const insets = useSafeAreaInsets();
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
  const canViewAllPayroll =
    isAdmin || hasPerm('payroll-period:read') || hasPerm('payroll-period:manage');
  const canViewPayrollPolicies = isAdmin || hasPerm('payroll-policy:read') || hasPerm('payroll-policy:manage');
  const canManagePayrollPayments = isAdmin || hasPerm('payroll-payment:manage');
  const visibleTabs = HR_TABS.filter((tab) => !tab.readPermissions || tab.readPermissions.some(hasPerm));
  const activeVisibleTab = visibleTabs.some((tab) => tab.key === activeTab)
    ? activeTab
    : visibleTabs[0]?.key ?? activeTab;
  const hrSwitcherItems = useMemo<ModuleSectionItem<HrTabId>[]>(
    () =>
      visibleTabs.map((t) => ({
        key: t.key,
        label: t.label,
        subtitle: t.subtitle,
        renderIcon: (size) => <HrTabIcon id={t.key} size={size} />,
      })),
    [visibleTabs],
  );
  const sectionTransition = useModuleSectionTransition(activeVisibleTab);

  return (
    <View style={[styles.root, styles.rootWhite]}>
      <Stack.Screen
        options={{
          headerStyle: { backgroundColor: '#D8EFFC' },
          headerShadowVisible: false,
          headerRight:
            branches.length > 0 && canSwitchBranch
              ? () => (
                  <Pressable
                    onPress={() => setBranchModalOpen(true)}
                    hitSlop={8}
                    style={({ pressed }) => [styles.headerBranchBtn, pressed && { opacity: 0.65 }]}
                  >
                    <View style={styles.branchBtnContent}>
                      <BranchAppIcon size={22} />
                      <Text numberOfLines={1} style={styles.branchBtnText}>{activeBranchName}</Text>
                      <ChevronDown size={14} color={colors.ink} />
                    </View>
                  </Pressable>
                )
              : undefined,
        }}
      />

      {/* Soft icy-sky pastel top-zone gradient matching Overview & Employee Directory */}
      <View pointerEvents="none" style={styles.topZoneBackdrop}>
        <Svg width="100%" height="100%" viewBox="0 0 360 96" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="hrBg" x1="0" y1="0" x2="0.15" y2="1">
              <Stop offset="0" stopColor="#D8EFFC" stopOpacity="1" />
              <Stop offset="0.45" stopColor="#EAF3FC" stopOpacity="1" />
              <Stop offset="1" stopColor="#F5FAFE" stopOpacity="1" />
            </LinearGradient>
            <RadialGradient id="hrGlowTopRight" cx="86%" cy="10%" rx="52%" ry="42%">
              <Stop offset="0" stopColor="#8FD3FA" stopOpacity="0.48" />
              <Stop offset="1" stopColor="#8FD3FA" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="360" height="96" fill="url(#hrBg)" />
          <Rect x="0" y="0" width="360" height="96" fill="url(#hrGlowTopRight)" />
          <Path
            d="M 190 96 C 242 66, 298 58, 360 36 L 360 96 Z"
            fill="#2463EB"
            fillOpacity={0.04}
          />
          <Circle
            cx="328"
            cy="14"
            r="54"
            fill="none"
            stroke="#2463EB"
            strokeOpacity={0.075}
            strokeWidth={1.2}
          />
          <Circle
            cx="328"
            cy="14"
            r="32"
            fill="none"
            stroke="#2463EB"
            strokeOpacity={0.065}
            strokeWidth={1}
          />
          <Circle cx="246" cy="18" r="2.1" fill="#2463EB" fillOpacity={0.11} />
          <Circle cx="260" cy="12" r="1.7" fill="#2463EB" fillOpacity={0.08} />
          <Circle cx="258" cy="26" r="1.5" fill="#2463EB" fillOpacity={0.09} />
        </Svg>
      </View>

      {/* Compact Overview-style HR sub-module switcher bar */}
      <ModuleSectionSwitcher
        items={hrSwitcherItems}
        activeKey={activeVisibleTab}
        transition={sectionTransition}
        onChange={(nextKey) => setActiveTab(nextKey)}
        modalTitle="Chọn mục nhân sự"
        style={styles.switcherBarWrap}
      />

      {/* Active panel */}
      <Animated.View style={[styles.body, sectionTransition.animatedStyle]}>
        {/* These reference panels use companyCode without activeBranchId by design. */}
        {activeVisibleTab === 'employees' ? (
          <OrgChartPanel companyCode={user?.companyCode} />
        ) : activeVisibleTab === 'attendance' ? (
          <HrSchedulePanel
            companyCode={user?.companyCode}
            branchId={activeBranchId}
            canManageTimekeeping={isManager || hasPerm('timekeeping:manage') || hasPerm('hr:manage')}
            canManageCalendar={isManager || hasPerm('hr:manage') || hasPerm('timekeeping:manage')}
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
      </Animated.View>

      {/* Branch picker modal matching Overview style */}
      <Modal
        visible={branchModalOpen}
        transparent
        statusBarTranslucent
        animationType="slide"
        onRequestClose={() => setBranchModalOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setBranchModalOpen(false)}>
          <Pressable
            style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 16) + 10 }]}
            onPress={() => {}}
          >
            <View style={styles.modalHandle} />
            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalList}>
              {branches.map((branch) => {
                const selected = branch._id === activeBranchId;
                return (
                  <Pressable
                    key={branch._id}
                    onPress={() => {
                      setSelectedBranchId(branch._id);
                      setBranchModalOpen(false);
                    }}
                    style={[styles.modalRow, selected && styles.modalRowActive]}
                  >
                    <BranchAppIcon size={38} />
                    <View style={styles.modalRowCopy}>
                      <Text style={styles.modalRowTitle}>{branch.name}</Text>
                      {branch.code ? (
                        <Text numberOfLines={1} style={styles.modalRowSub}>
                          Mã chi nhánh: {branch.code}
                        </Text>
                      ) : null}
                    </View>
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
  root: { flex: 1, backgroundColor: '#D8EFFC' },
  rootWhite: { backgroundColor: colors.white },
  topZoneBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 78,
    overflow: 'hidden',
  },
  headerBranchBtn: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    maxWidth: 185,
  },
  branchBtnContent: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  branchBtnText: { color: colors.ink, fontSize: 13, fontWeight: '700', flexShrink: 1 },
  switcherBarWrap: { marginHorizontal: 14, marginTop: 4, marginBottom: 10 },
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
    maxHeight: '78%',
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
  modalTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  modalClose: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  modalList: {
    flexGrow: 0,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 11,
    borderRadius: 14,
    gap: 12,
    marginBottom: 6,
  },
  modalRowActive: {
    backgroundColor: '#F0F6FF',
  },
  modalRowCopy: {
    flex: 1,
  },
  modalRowTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  modalRowSub: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 2,
  },
  body: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.42)', justifyContent: 'center', padding: 16 },
  sheet: { backgroundColor: colors.white, borderRadius: 24, overflow: 'hidden', padding: 18, gap: 10 },
  sheetTitle: { color: colors.ink, fontSize: 16, fontWeight: '800', marginBottom: 4 },
  branchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 12, marginBottom: 6, backgroundColor: '#F8FAFD' },
  branchRowActive: { backgroundColor: '#EAF2FF' },
  branchRowTitle: { color: colors.ink, fontSize: 13, fontWeight: '700' },
});

