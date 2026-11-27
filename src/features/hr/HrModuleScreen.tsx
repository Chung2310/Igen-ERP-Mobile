import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { HrTabIcon } from '@/components/HrTabIcons';
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
  const [tabPickerOpen, setTabPickerOpen] = useState(false);

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
  const activeTabMeta = useMemo(
    () => visibleTabs.find((t) => t.key === activeVisibleTab) ?? visibleTabs[0],
    [activeVisibleTab, visibleTabs],
  );
  const currentTabIndex = useMemo(
    () => Math.max(0, visibleTabs.findIndex((t) => t.key === activeVisibleTab)),
    [activeVisibleTab, visibleTabs],
  );
  const onStepTab = useCallback(
    (delta: -1 | 1) => {
      if (visibleTabs.length <= 1) return;
      const nextIndex = (currentTabIndex + delta + visibleTabs.length) % visibleTabs.length;
      const target = visibleTabs[nextIndex];
      if (target) setActiveTab(target.key);
    },
    [currentTabIndex, visibleTabs],
  );

  return (
    <View style={[styles.root, activeVisibleTab === 'employees' && styles.rootWhite]}>
      <Stack.Screen
        options={{
          headerStyle: { backgroundColor: '#D8EFFC' },
          headerShadowVisible: false,
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

      {/* Soft icy-sky pastel gradient background with subtle geometric motifs matching Overview */}
      <View
        pointerEvents="none"
        style={activeVisibleTab === 'employees' ? styles.topZoneBackdrop : StyleSheet.absoluteFill}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox={activeVisibleTab === 'employees' ? '0 0 360 96' : '0 0 360 760'}
          preserveAspectRatio="none"
        >
          <Defs>
            <LinearGradient id="hrBg" x1="0" y1="0" x2="0.15" y2="1">
              <Stop offset="0" stopColor="#D8EFFC" stopOpacity="1" />
              <Stop offset="0.45" stopColor="#EAF3FC" stopOpacity="1" />
              <Stop offset="1" stopColor={activeVisibleTab === 'employees' ? '#F5FAFE' : '#F5F7FC'} stopOpacity="1" />
            </LinearGradient>
            <RadialGradient id="hrGlowTopRight" cx="86%" cy="10%" rx="52%" ry="42%">
              <Stop offset="0" stopColor="#8FD3FA" stopOpacity="0.48" />
              <Stop offset="1" stopColor="#8FD3FA" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect
            x="0"
            y="0"
            width="360"
            height={activeVisibleTab === 'employees' ? '96' : '760'}
            fill="url(#hrBg)"
          />
          <Rect
            x="0"
            y="0"
            width="360"
            height={activeVisibleTab === 'employees' ? '96' : '760'}
            fill="url(#hrGlowTopRight)"
          />
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
      {activeTabMeta ? (
        <View style={styles.switcherWrap}>
          <View style={styles.switcherBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mục nhân sự trước"
              disabled={visibleTabs.length <= 1}
              onPress={() => onStepTab(-1)}
              style={({ pressed }) => [
                styles.switcherNavBtn,
                visibleTabs.length <= 1 && styles.switcherNavBtnDisabled,
                pressed && styles.switcherNavBtnPressed,
              ]}
            >
              <ChevronLeft size={18} color={colors.ink} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Chọn mục nhân sự"
              disabled={visibleTabs.length <= 1}
              onPress={() => setTabPickerOpen(true)}
              style={({ pressed }) => [
                styles.switcherCenter,
                pressed && visibleTabs.length > 1 && styles.switcherCenterPressed,
              ]}
            >
              <View style={styles.switcherTitleRow}>
                <HrTabIcon id={activeTabMeta.key} size={24} />
                <Text numberOfLines={1} style={styles.switcherTitle}>
                  {activeTabMeta.label}
                </Text>
                {visibleTabs.length > 1 ? (
                  <ChevronDown size={15} color={colors.muted} />
                ) : null}
              </View>
              <Text numberOfLines={1} style={styles.switcherSubtitle}>
                {activeTabMeta.subtitle}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mục nhân sự tiếp theo"
              disabled={visibleTabs.length <= 1}
              onPress={() => onStepTab(1)}
              style={({ pressed }) => [
                styles.switcherNavBtn,
                visibleTabs.length <= 1 && styles.switcherNavBtnDisabled,
                pressed && styles.switcherNavBtnPressed,
              ]}
            >
              <ChevronRight size={18} color={colors.ink} />
            </Pressable>
          </View>
        </View>
      ) : null}

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

      {/* Bottom sheet modal to choose among HR sub-modules */}
      <Modal
        visible={tabPickerOpen}
        transparent
        statusBarTranslucent
        animationType="slide"
        onRequestClose={() => setTabPickerOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setTabPickerOpen(false)}>
          <Pressable
            style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 16) + 10 }]}
            onPress={() => {}}
          >
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn nghiệp vụ nhân sự</Text>
              <Pressable onPress={() => setTabPickerOpen(false)} hitSlop={8}>
                <Text style={styles.modalClose}>Đóng</Text>
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalList}>
              {visibleTabs.map((tab) => {
                const active = tab.key === activeVisibleTab;
                return (
                  <Pressable
                    key={tab.key}
                    onPress={() => {
                      setActiveTab(tab.key);
                      setTabPickerOpen(false);
                    }}
                    style={[styles.modalRow, active && styles.modalRowActive]}
                  >
                    <HrTabIcon id={tab.key} size={38} />
                    <View style={styles.modalRowCopy}>
                      <Text style={styles.modalRowTitle}>{tab.label}</Text>
                      <Text numberOfLines={1} style={styles.modalRowSub}>
                        {tab.subtitle}
                      </Text>
                    </View>
                    {active ? <Check size={17} color={colors.primary} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

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
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderColor: '#CBE0F6',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
    maxWidth: 155,
  },
  branchBtnContent: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  branchBtnText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  switcherWrap: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 10,
  },
  switcherBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5EAF2',
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  switcherNavBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F8FD',
  },
  switcherNavBtnDisabled: {
    opacity: 0.35,
  },
  switcherNavBtnPressed: {
    backgroundColor: '#E8F0FC',
  },
  switcherCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  switcherCenterPressed: {
    opacity: 0.72,
  },
  switcherTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  switcherTitle: {
    color: colors.ink,
    fontSize: 14.5,
    fontWeight: '700',
    flexShrink: 1,
  },
  switcherSubtitle: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
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

