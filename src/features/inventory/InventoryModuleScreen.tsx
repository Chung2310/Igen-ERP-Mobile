import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import { Archive, ArrowLeftRight, Barcode, Boxes, Check, ChevronDown, ClipboardCheck, MapPinned, Package, ReceiptText, Warehouse as WarehouseIcon } from 'lucide-react-native';
import { useAuth } from '@/core/auth/AuthProvider';
import { fetchCompanyBranches, type ErpBranch } from '@/features/overview/overviewApi';
import { colors } from '@/theme/colors';
import {
  InventoryCountsPanel,
  InventoryProductsPanel,
  InventoryReceivingPanel,
  InventorySerialsPanel,
  InventoryTransactionsPanel,
  InventoryTransfersPanel,
  InventoryWarehousePanel,
} from '@/features/inventory/InventoryPanels';

type InventoryTab = 'products' | 'warehouse' | 'receiving' | 'transfers' | 'transactions' | 'serials' | 'counts';
const tabs: Array<{ key: InventoryTab; label: string; icon: LucideIcon }> = [
  { key: 'products', label: 'Sản phẩm', icon: Package },
  { key: 'warehouse', label: 'Kho hàng', icon: WarehouseIcon },
  { key: 'receiving', label: 'Nhập hàng', icon: ReceiptText },
  { key: 'transfers', label: 'Điều chuyển', icon: ArrowLeftRight },
  { key: 'transactions', label: 'Giao dịch kho', icon: Archive },
  { key: 'serials', label: 'IMEI / Serial', icon: Barcode },
  { key: 'counts', label: 'Kiểm kê', icon: ClipboardCheck },
];

export function InventoryModuleScreen() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const canRead = isAdmin || Boolean(user?.permissions?.some((permission) => ['*', 'inventory:read', 'inventory:manage'].includes(permission)));
  const canManage = isAdmin || Boolean(user?.permissions?.some((permission) => ['*', 'inventory:manage'].includes(permission)));
  const canSwitchBranch = isAdmin || !user?.branchId;
  const [branches, setBranches] = useState<ErpBranch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState(user?.branchId ?? '');
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<InventoryTab>('products');

  useEffect(() => {
    if (!user?.companyCode || (!canSwitchBranch && user.branchId)) {
      if (user?.branchId) setSelectedBranchId(user.branchId);
      return;
    }
    const controller = new AbortController();
    void fetchCompanyBranches(controller.signal).then((list) => {
      if (controller.signal.aborted) return;
      setBranches(list);
      setSelectedBranchId((current) => current && list.some((branch) => branch._id === current)
        ? current
        : user?.branchId && list.some((branch) => branch._id === user.branchId)
          ? user.branchId
          : list[0]?._id ?? '');
    }).catch(() => {});
    return () => controller.abort();
  }, [canSwitchBranch, user?.branchId, user?.companyCode]);

  const branchId = selectedBranchId || user?.branchId || undefined;
  const branchName = branchId
    ? branches.find((branch) => branch._id === branchId)?.name || (branchId === user?.branchId ? user?.branchName : undefined) || 'Chọn chi nhánh'
    : 'Chọn chi nhánh';
  const active = useMemo(() => tabs.find((tab) => tab.key === activeTab)?.key ?? 'products', [activeTab]);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{
        title: 'Kho & Sản phẩm',
        headerRight: branches.length > 0 && canSwitchBranch ? () => (
          <Pressable onPress={() => setBranchModalOpen(true)} style={styles.branchButton}>
            <Text numberOfLines={1} style={styles.branchButtonText}>{branchName}</Text>
            <ChevronDown size={14} color={colors.primary} />
          </Pressable>
        ) : undefined,
      }} />
      {!canRead ? (
        <View style={styles.permissionState}>
          <Boxes size={27} color={colors.muted} />
          <Text style={styles.permissionTitle}>Chưa có quyền truy cập kho</Text>
          <Text style={styles.permissionCopy}>Tài khoản cần quyền inventory:read để xem sản phẩm và nghiệp vụ kho.</Text>
        </View>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabsRow}>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const selected = active === tab.key;
              return (
                <Pressable key={tab.key} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => setActiveTab(tab.key)} style={[styles.tab, selected && styles.tabSelected]}>
                  <Icon size={15} color={selected ? colors.primary : colors.muted} />
                  <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{tab.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.content}>
            {active === 'products' ? <InventoryProductsPanel branchId={branchId} canManage={canManage} />
              : active === 'warehouse' ? <InventoryWarehousePanel branchId={branchId} canManage={canManage} />
                : active === 'receiving' ? <InventoryReceivingPanel branchId={branchId} canManage={canManage} />
                  : active === 'transfers' ? <InventoryTransfersPanel branchId={branchId} canManage={canManage} />
                    : active === 'transactions' ? <InventoryTransactionsPanel branchId={branchId} canManage={canManage} operatorName={user?.displayName || user?.email || ''} />
                      : active === 'serials' ? <InventorySerialsPanel branchId={branchId} companyCode={user?.companyCode} canManage={canManage} />
                        : <InventoryCountsPanel branchId={branchId} canManage={canManage} canApprove={isAdmin || Boolean(user?.permissions?.some((permission) => ['*', 'inventory-count-approval:manage'].includes(permission)))} />}
          </View>
        </>
      )}

      <Modal visible={branchModalOpen} transparent animationType="fade" onRequestClose={() => setBranchModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setBranchModalOpen(false)}>
          <Pressable style={styles.branchSheet} onPress={() => {}}>
            <View style={styles.branchSheetHeading}>
              <Text style={styles.branchSheetTitle}>Chọn chi nhánh</Text>
              <MapPinned size={16} color={colors.muted} />
            </View>
            <ScrollView style={{ maxHeight: 360 }}>
              {branches.map((branch) => {
                const selected = branch._id === branchId;
                return (
                  <Pressable key={branch._id} onPress={() => { setSelectedBranchId(branch._id); setBranchModalOpen(false); }} style={[styles.branchRow, selected && styles.branchRowSelected]}>
                    <Text style={[styles.branchRowText, selected && styles.branchRowTextSelected]}>{branch.name}</Text>
                    {selected && <Check size={16} color={colors.primary} />}
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
  root: { flex: 1, backgroundColor: colors.background },
  branchButton: { maxWidth: 160, minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, borderRadius: 20, backgroundColor: '#EEF4FF', borderWidth: 1, borderColor: '#D6E5FF' },
  branchButtonText: { flexShrink: 1, color: colors.primary, fontSize: 11, fontWeight: '700' },
  tabsScroll: { flexGrow: 0, flexShrink: 0, maxHeight: 49 },
  tabsRow: { alignItems: 'center', gap: 7, paddingHorizontal: 15, paddingVertical: 7 },
  tab: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  tabSelected: { backgroundColor: '#EEF4FF', borderColor: '#C9DAFF' },
  tabText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  tabTextSelected: { color: colors.primary },
  content: { flex: 1 },
  permissionState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  permissionTitle: { color: colors.ink, fontSize: 16, fontWeight: '800', marginTop: 12 },
  permissionCopy: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 6 },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 18, backgroundColor: 'rgba(15,23,42,0.42)' },
  branchSheet: { maxHeight: '75%', padding: 15, borderRadius: 20, backgroundColor: colors.white },
  branchSheetHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  branchSheetTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  branchRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 11, borderRadius: 11, marginBottom: 5, backgroundColor: '#F7F9FC' },
  branchRowSelected: { backgroundColor: '#EEF4FF' },
  branchRowText: { color: colors.ink, fontSize: 12, fontWeight: '600' },
  branchRowTextSelected: { color: colors.primary, fontWeight: '800' },
});
