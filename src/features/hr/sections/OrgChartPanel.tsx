import { PopupError } from '@/components/PopupError';
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
import { ChevronDown, ChevronRight, Crown, FileText, Phone, Plus } from 'lucide-react-native';
import { Card } from '@/components/Card';
import { showHrConfirm } from '@/features/hr/components/HrConfirmModal';
import { useAuth } from '@/core/auth/AuthProvider';
import {
  deleteHrEmployee,
  getEmployeeLeaveBalance,
  listHrDepartments,
  listHrEmployees,
  registerHrEmployee,
  updateHrEmployee,
} from '@/features/hr/hrApi';
import type { HrDepartment, HrEmployee, HrLeaveBalance } from '@/features/hr/types';
import { colors } from '@/theme/colors';

type OrgNode = HrEmployee & {
  nodeId: string;
  resolvedParentId?: string;
  resolvedLevel: number;
};

type AddRole = 'user' | 'manager' | 'branch_owner' | 'admin';

const ROLE_WEIGHT: Record<string, number> = {
  superadmin: 4,
  admin: 3,
  branch_owner: 2.5,
  manager: 2,
  user: 1,
};

const ROLE_LEVEL: Record<string, number> = {
  superadmin: 0,
  admin: 1,
  branch_owner: 2,
  manager: 3,
  user: 4,
};

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Super Admin',
  admin: 'Giám đốc / Admin',
  branch_owner: 'Quản lý chi nhánh',
  manager: 'Trưởng phòng / Quản lý',
  user: 'Nhân viên',
};

const DIVISIONS = [
  'Khối Quản Trị',
  'Khối Tài Chính - Pháp Lý',
  'Khối Hệ Thống & Công Nghệ',
  'Khối Vận Hành - Sản Xuất',
  'Khối Kinh Doanh & Tiếp Thị',
  'Khối Hành Chính & Nhân Sự',
];

function normalizeText(value?: string | null): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function getInitials(name?: string) {
  return (
    name
      ?.trim()
      .split(/\s+/)
      .slice(-2)
      .map((p) => p[0]?.toLocaleUpperCase('vi'))
      .join('') || 'NV'
  );
}

function parseVndAmount(value: string): number | undefined {
  const digits = value.replace(/\D/g, '');
  if (!digits) return undefined;
  const amount = Number(digits);
  return Number.isSafeInteger(amount) ? amount : undefined;
}

function formatVndAmount(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${Math.round(value).toLocaleString('vi-VN')} ₫`;
}

const AVATAR_BG_COLORS = [
  '#1EA4E9',
  '#2563EB',
  '#0EA5A4',
  '#6366F1',
  '#0284C7',
  '#10B981',
];

function getAvatarBg(seed?: string): string {
  const str = seed || 'NV';
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) % AVATAR_BG_COLORS.length;
  }
  return AVATAR_BG_COLORS[Math.abs(hash) % AVATAR_BG_COLORS.length];
}

function getCategoryColor(division?: string, department?: string): { accent: string; tone: string } {
  const s = `${division || ''} ${department || ''}`.toLowerCase();
  if (/quản trị|giám đốc|ceo|coo|admin/.test(s)) return { accent: '#0F172A', tone: '#E2E8F0' };
  if (/tài chính|kế toán|pháp lý|finance/.test(s)) return { accent: '#16885A', tone: '#E9F8F1' };
  if (/kỹ thuật|công nghệ|hệ thống|it|phần mềm|tech/.test(s)) return { accent: '#4F46E5', tone: '#EEF2FF' };
  if (/vận hành|sản xuất|kho|logistics/.test(s)) return { accent: '#0E7490', tone: '#E8F7FA' };
  if (/kinh doanh|tiếp thị|sales|marketing/.test(s)) return { accent: '#C27617', tone: '#FFF3E5' };
  if (/nhân sự|hành chính|hr|tuyển dụng|đào tạo/.test(s)) return { accent: '#BE123C', tone: '#FFE4E6' };
  return { accent: '#2463EB', tone: '#EAF2FF' };
}

/** Xây dựng cây phân cấp giống arrangeOrgChartEmployees trong web ERP. */
function buildOrgNodes(employees: HrEmployee[]): OrgNode[] {
  const nodes: OrgNode[] = employees.map((emp, idx) => {
    const nodeId = emp.uid || emp._id || emp.id || `emp-${idx}`;
    const role = emp.role || 'user';
    return {
      ...emp,
      nodeId,
      resolvedParentId: emp.parentId || undefined,
      resolvedLevel: emp.level ?? ROLE_LEVEL[role] ?? 4,
    };
  });

  const byId = new Map(nodes.map((n) => [n.nodeId, n]));
  const superadmin = nodes.find((n) => n.role === 'superadmin');

  for (const node of nodes) {
    const role = node.role || 'user';
    if (role === 'superadmin') {
      node.resolvedParentId = undefined;
      continue;
    }
    if (role === 'admin') {
      node.resolvedParentId = superadmin?.nodeId;
      continue;
    }
    if (node.resolvedParentId && byId.has(node.resolvedParentId) && node.resolvedParentId !== node.nodeId) {
      continue;
    }
    const myLevel = ROLE_LEVEL[role] ?? 4;
    let parent: OrgNode | undefined;
    for (let targetLevel = myLevel - 1; targetLevel >= 0; targetLevel -= 1) {
      parent = nodes.find(
        (c) => c.nodeId !== node.nodeId && (ROLE_LEVEL[c.role || 'user'] ?? 4) === targetLevel,
      );
      if (parent) break;
    }
    node.resolvedParentId = parent?.nodeId;
  }

  return nodes;
}

function isDescendantOf(nodes: OrgNode[], ancestorId: string, candidateId: string): boolean {
  const map = new Map(nodes.map((n) => [n.nodeId, n]));
  const visited = new Set<string>();
  let curr = map.get(candidateId);
  while (curr?.resolvedParentId) {
    if (curr.resolvedParentId === ancestorId) return true;
    if (visited.has(curr.resolvedParentId)) return false;
    visited.add(curr.resolvedParentId);
    curr = map.get(curr.resolvedParentId);
  }
  return false;
}

export function OrgChartPanel({
  companyCode,
  branchId,
}: {
  companyCode?: string;
  branchId?: string;
}) {
  const { user } = useAuth();
  const currentUserId = user?._id || user?.id || '';
  const isAdmin = user?.role === 'superadmin' || user?.role === 'admin';
  const isManager = isAdmin || user?.role === 'manager' || user?.role === 'branch_owner';

  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [departments, setDepartments] = useState<HrDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // View & filters
  const [viewMode, setViewMode] = useState<'tree' | 'focus' | 'department' | 'list'>('tree');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('Tất cả');
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [collapsedTreeIds, setCollapsedTreeIds] = useState<Set<string>>(new Set());
  const [treeZoom, setTreeZoom] = useState<number>(0.85);
  const [treeSize, setTreeSize] = useState<{ width: number; height: number } | null>(null);
  const [collapsedDepts, setCollapsedDepts] = useState<Set<string>>(new Set());

  // Detail & Edit modal
  const [selectedNode, setSelectedNode] = useState<OrgNode | null>(null);
  const [leaveBalance, setLeaveBalance] = useState<HrLeaveBalance | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [savingLeader, setSavingLeader] = useState(false);

  const [editName, setEditName] = useState('');
  const [editJobTitle, setEditJobTitle] = useState('');
  const [editDivision, setEditDivision] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editQualification, setEditQualification] = useState('');
  const [editSalary, setEditSalary] = useState('');
  const [editJdLink, setEditJdLink] = useState('');
  const [editParentId, setEditParentId] = useState('');

  // Add employee modal
  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addRole, setAddRole] = useState<AddRole>('user');
  const [addDepartment, setAddDepartment] = useState('');
  const [addDepartmentOpen, setAddDepartmentOpen] = useState(false);
  const [addParentId, setAddParentId] = useState('');
  const [addQualification, setAddQualification] = useState('');
  const [addSalary, setAddSalary] = useState('');
  const [addJdLink, setAddJdLink] = useState('');

  const loadData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const [empList, deptList] = await Promise.all([
          listHrEmployees(companyCode, branchId),
          companyCode ? listHrDepartments(companyCode).catch(() => []) : Promise.resolve([]),
        ]);
        setEmployees(empList);
        setDepartments(deptList);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không tải được danh sách nhân sự.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [branchId, companyCode],
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Load leave balance when opening detail modal
  useEffect(() => {
    if (!selectedNode) {
      setLeaveBalance(null);
      return;
    }
    let active = true;
    void getEmployeeLeaveBalance(selectedNode.nodeId)
      .then((bal) => {
        if (active) setLeaveBalance(bal);
      })
      .catch(() => {
        if (active) setLeaveBalance(null);
      });
    return () => {
      active = false;
    };
  }, [selectedNode]);

  const orgNodes = useMemo(() => buildOrgNodes(employees), [employees]);

  const departmentOptions = useMemo(() => {
    const names = new Set<string>();
    for (const d of departments) if (d.name?.trim()) names.add(d.name.trim());
    for (const e of employees) if (e.department?.trim()) names.add(e.department.trim());
    return ['Tất cả', ...Array.from(names).sort((a, b) => a.localeCompare(b, 'vi'))];
  }, [departments, employees]);

  const filteredNodes = useMemo(() => {
    const q = normalizeText(searchQuery);
    return orgNodes.filter((n) => {
      const matchDept = filterDepartment === 'Tất cả' || n.department === filterDepartment;
      const matchSearch =
        !q ||
        [n.displayName, n.jobTitle, n.position, n.department, n.division, n.email, n.phone].some(
          (val) => normalizeText(val).includes(q),
        );
      return matchDept && matchSearch;
    });
  }, [filterDepartment, orgNodes, searchQuery]);

  const childrenMap = useMemo(() => {
    const map = new Map<string, OrgNode[]>();
    const visibleIds = new Set(filteredNodes.map((n) => n.nodeId));
    for (const node of filteredNodes) {
      const parentKey =
        node.resolvedParentId && visibleIds.has(node.resolvedParentId)
          ? node.resolvedParentId
          : '__ROOT__';
      const arr = map.get(parentKey) ?? [];
      arr.push(node);
      map.set(parentKey, arr);
    }
    for (const [, arr] of map) {
      arr.sort((a, b) => {
        if (Boolean(b.isLeader) !== Boolean(a.isLeader)) return Number(Boolean(b.isLeader)) - Number(Boolean(a.isLeader));
        return (a.resolvedLevel ?? 4) - (b.resolvedLevel ?? 4) || a.displayName.localeCompare(b.displayName, 'vi');
      });
    }
    return map;
  }, [filteredNodes]);

  const rootNodes = childrenMap.get('__ROOT__') ?? [];
  const nodeById = useMemo(() => new Map(orgNodes.map((n) => [n.nodeId, n])), [orgNodes]);

  // Node đang làm tiêu điểm cho chế độ "Cấp bậc" (Focus Drill-down)
  const focusedNode = useMemo(() => {
    if (focusedNodeId) {
      const found = filteredNodes.find((n) => n.nodeId === focusedNodeId);
      if (found) return found;
    }
    return rootNodes[0] ?? filteredNodes[0] ?? null;
  }, [filteredNodes, focusedNodeId, rootNodes]);

  // Đường dẫn breadcrumb từ gốc đến focusedNode
  const breadcrumbPath = useMemo(() => {
    if (!focusedNode) return [];
    const path: OrgNode[] = [];
    const seen = new Set<string>();
    let curr: OrgNode | undefined = focusedNode;
    while (curr && !seen.has(curr.nodeId)) {
      path.unshift(curr);
      seen.add(curr.nodeId);
      curr = curr.resolvedParentId ? nodeById.get(curr.resolvedParentId) : undefined;
    }
    return path;
  }, [focusedNode, nodeById]);

  const focusedParent = useMemo(
    () => (focusedNode?.resolvedParentId ? nodeById.get(focusedNode.resolvedParentId) ?? null : null),
    [focusedNode, nodeById],
  );

  const focusedChildren = useMemo(
    () => (focusedNode ? (childrenMap.get(focusedNode.nodeId) ?? []) : []),
    [childrenMap, focusedNode],
  );

  // Gom nhóm nhân sự theo phòng ban cho chế độ "Phòng ban"
  const departmentGroups = useMemo(() => {
    const map = new Map<string, OrgNode[]>();
    for (const node of filteredNodes) {
      const dept = node.department?.trim() || 'Chưa phân phòng ban';
      const arr = map.get(dept) ?? [];
      arr.push(node);
      map.set(dept, arr);
    }
    return Array.from(map.entries())
      .map(([name, members]) => ({
        name,
        members: members.sort((a, b) => {
          if (Boolean(b.isLeader) !== Boolean(a.isLeader)) {
            return Number(Boolean(b.isLeader)) - Number(Boolean(a.isLeader));
          }
          return (a.resolvedLevel ?? 4) - (b.resolvedLevel ?? 4) || a.displayName.localeCompare(b.displayName, 'vi');
        }),
      }))
      .sort((a, b) => b.members.length - a.members.length || a.name.localeCompare(b.name, 'vi'));
  }, [filteredNodes]);

  const toggleDeptCollapse = useCallback((deptName: string) => {
    setCollapsedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(deptName)) next.delete(deptName);
      else next.add(deptName);
      return next;
    });
  }, []);

  const toggleTreeCollapse = useCallback((nodeId: string) => {
    setCollapsedTreeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const collapseAllTree = useCallback(() => {
    const parents = new Set<string>();
    for (const [parentKey, kids] of childrenMap.entries()) {
      if (parentKey !== '__ROOT__' && kids.length > 0) parents.add(parentKey);
    }
    setCollapsedTreeIds(parents);
  }, [childrenMap]);

  const expandAllTree = useCallback(() => setCollapsedTreeIds(new Set()), []);

  const canEdit = useCallback(
    (node: OrgNode) => {
      if (!user) return false;
      if (node.nodeId === currentUserId) return isManager;
      if (user.role === 'superadmin') return true;
      if (node.role === 'superadmin') return false;
      const myW = ROLE_WEIGHT[user.role] ?? 1;
      const targetW = ROLE_WEIGHT[node.role || 'user'] ?? 1;
      return myW >= targetW && isManager;
    },
    [currentUserId, isManager, user],
  );

  const canDelete = useCallback(
    (node: OrgNode) => {
      if (!user || node.nodeId === currentUserId) return false;
      const myW = ROLE_WEIGHT[user.role] ?? 1;
      const targetW = ROLE_WEIGHT[node.role || 'user'] ?? 1;
      return myW > targetW;
    },
    [currentUserId, user],
  );

  const openDetail = useCallback((node: OrgNode) => {
    setSelectedNode(node);
    setIsEditing(false);
  }, []);

  const startEdit = useCallback(() => {
    if (!selectedNode) return;
    setEditName(selectedNode.displayName || '');
    setEditJobTitle(selectedNode.jobTitle || selectedNode.position || '');
    setEditDivision(selectedNode.division || 'Khối Vận Hành - Sản Xuất');
    setEditDepartment(selectedNode.department || '');
    setEditPhone(selectedNode.phone || '');
    setEditQualification(selectedNode.qualification || '');
    setEditSalary(selectedNode.monthlySalary != null ? String(selectedNode.monthlySalary) : '');
    setEditJdLink(selectedNode.jobDescriptionLink || '');
    setEditParentId(selectedNode.resolvedParentId || '');
    setIsEditing(true);
  }, [selectedNode]);

  const onSaveEdit = useCallback(async () => {
    if (!selectedNode || savingEdit) return;
    if (!editName.trim()) {
      Alert.alert('Thiếu họ tên', 'Vui lòng nhập họ tên nhân sự.');
      return;
    }
    if (editPhone.trim()) {
      const normalized = editPhone.trim().replace(/\s+/g, '');
      if (!/^(0|\+84|84)(3|5|7|8|9)[0-9]{8}$/.test(normalized)) {
        Alert.alert('Số điện thoại chưa hợp lệ', 'Ví dụ đúng: 0987654321.');
        return;
      }
      const dup = employees.find(
        (e) => (e.uid || e._id || e.id) !== selectedNode.nodeId && e.phone?.replace(/\s+/g, '') === normalized,
      );
      if (dup) {
        Alert.alert('Trùng số điện thoại', `Số điện thoại này đang thuộc về ${dup.displayName}.`);
        return;
      }
    }
    if (editParentId && (editParentId === selectedNode.nodeId || isDescendantOf(orgNodes, selectedNode.nodeId, editParentId))) {
      Alert.alert('Cấp trên không hợp lệ', 'Không thể chọn chính nhân sự này hoặc cấp dưới làm quản lý trực tiếp.');
      return;
    }
    const monthlySalary = parseVndAmount(editSalary);
    if (editSalary.trim() && monthlySalary == null) {
      Alert.alert('Lương không hợp lệ', 'Vui lòng nhập số tiền lương bằng VNĐ.');
      return;
    }

    setSavingEdit(true);
    try {
      const payload = {
        displayName: editName.trim(),
        jobTitle: editJobTitle.trim(),
        division: editDivision.trim(),
        department: editDepartment.trim(),
        phone: editPhone.trim(),
        qualification: editQualification.trim(),
        monthlySalary,
        jobDescriptionLink: editJdLink.trim(),
        parentId: editParentId || null,
      };
      await updateHrEmployee(selectedNode.nodeId, payload, branchId);
      Alert.alert('Đã lưu', 'Cập nhật thông tin nhân sự thành công.');
      setIsEditing(false);
      await loadData(true);
      setSelectedNode((prev) =>
        prev
          ? {
              ...prev,
              ...payload,
              resolvedParentId: editParentId || undefined,
            }
          : null,
      );
    } catch (err) {
      Alert.alert('Lỗi cập nhật', err instanceof Error ? err.message : 'Vui lòng thử lại.');
    } finally {
      setSavingEdit(false);
    }
  }, [
    branchId,
    editDepartment,
    editDivision,
    editJdLink,
    editJobTitle,
    editName,
    editParentId,
    editPhone,
    editQualification,
    editSalary,
    employees,
    loadData,
    orgNodes,
    savingEdit,
    selectedNode,
  ]);

  const onToggleLeader = useCallback(async () => {
    if (!selectedNode || savingLeader) return;
    setSavingLeader(true);
    try {
      const nextLeader = !selectedNode.isLeader;
      await updateHrEmployee(selectedNode.nodeId, { isLeader: nextLeader }, branchId);
      setSelectedNode((prev) => (prev ? { ...prev, isLeader: nextLeader } : null));
      await loadData(true);
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không cập nhật được chức vụ Trưởng nhóm.');
    } finally {
      setSavingLeader(false);
    }
  }, [branchId, loadData, savingLeader, selectedNode]);

  const onDeleteNode = useCallback(
    (node: OrgNode) => {
      showHrConfirm({
        title: 'Xóa nhân sự này?',
        message: `Bạn có chắc chắn muốn xóa "${node.displayName}"? Cấp dưới trực thuộc sẽ tự động chuyển báo cáo lên cấp trên.`,
        confirmLabel: 'Xóa nhân sự',
        onConfirm: async () => {
          try {
            await deleteHrEmployee(node.nodeId);
            setSelectedNode(null);
            await loadData(true);
          } catch (err) {
            Alert.alert('Không thể xóa', err instanceof Error ? err.message : 'Vui lòng thử lại.');
          }
        },
      });
    },
    [loadData],
  );

  const openAddModal = useCallback(() => {
    setAddName('');
    setAddEmail('');
    setAddPassword('');
    setAddPhone('');
    setAddRole('user');
    setAddQualification('');
    setAddSalary('');
    setAddJdLink('');
    setAddDepartmentOpen(false);
    const defaultMgr =
      orgNodes.find((n) => n.role === 'manager') ||
      orgNodes.find((n) => n.role === 'branch_owner') ||
      orgNodes.find((n) => n.role === 'admin');
    setAddParentId(defaultMgr?.nodeId ?? '');
    setAddDepartment(defaultMgr?.department || departmentOptions[1] || '');
    setAddOpen(true);
  }, [departmentOptions, orgNodes]);

  const onAddEmployee = useCallback(async () => {
    if (!addName.trim() || !addEmail.trim() || !addPassword.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập Họ tên, Email và Mật khẩu.');
      return;
    }
    if (addPassword.length < 6) {
      Alert.alert('Mật khẩu quá ngắn', 'Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(addEmail.trim())) {
      Alert.alert('Email không hợp lệ', 'Vui lòng kiểm tra lại định dạng email.');
      return;
    }
    const normalizedPhone = addPhone.trim().replace(/[\s().-]/g, '');
    if (normalizedPhone && !/^(0|\+84|84)(3|5|7|8|9)[0-9]{8}$/.test(normalizedPhone)) {
      Alert.alert('Số điện thoại chưa hợp lệ', 'Ví dụ đúng: 0987654321.');
      return;
    }
    if ((addRole === 'user' || addRole === 'manager') && !addDepartment.trim()) {
      Alert.alert('Thiếu phòng ban', 'Vui lòng nhập hoặc chọn phòng ban.');
      return;
    }
    const monthlySalary = parseVndAmount(addSalary);
    if (addSalary.trim() && monthlySalary == null) {
      Alert.alert('Lương không hợp lệ', 'Vui lòng nhập số tiền lương bằng VNĐ.');
      return;
    }

    setAdding(true);
    try {
      const parentNode = orgNodes.find((n) => n.nodeId === addParentId);
      await registerHrEmployee({
        displayName: addName.trim(),
        email: addEmail.trim(),
        password: addPassword,
        role: addRole,
        companyCode: companyCode || user?.companyCode || 'SYSTEM',
        companyName: user?.companyName,
        parentId: addRole === 'admin' ? undefined : addParentId || undefined,
        level: parentNode ? parentNode.resolvedLevel + 1 : undefined,
        department: addDepartment.trim() || undefined,
        division: addDepartment.trim() || undefined,
        phone: normalizedPhone || undefined,
        qualification: addQualification.trim() || undefined,
        monthlySalary,
        jobDescriptionLink: addJdLink.trim() || undefined,
        branchId,
      });
      setAddOpen(false);
      Alert.alert('Thành công', `Đã thêm nhân sự "${addName.trim()}" vào danh sách nhân sự.`);
      await loadData(true);
    } catch (err) {
      Alert.alert('Không thể thêm nhân sự', err instanceof Error ? err.message : 'Vui lòng thử lại.');
    } finally {
      setAdding(false);
    }
  }, [
    addDepartment,
    addEmail,
    addJdLink,
    addName,
    addParentId,
    addPassword,
    addPhone,
    addQualification,
    addRole,
    addSalary,
    branchId,
    companyCode,
    loadData,
    orgNodes,
    user?.companyCode,
    user?.companyName,
  ]);

  // Đếm tổng số cấp dưới trực tiếp của một node
  const countDirectSubordinates = useCallback(
    (nodeId: string) => (childrenMap.get(nodeId) ?? []).length,
    [childrenMap],
  );

  const directReports = useMemo(
    () => (selectedNode ? orgNodes.filter((n) => n.resolvedParentId === selectedNode.nodeId) : []),
    [orgNodes, selectedNode],
  );
  const directManager = useMemo(
    () =>
      selectedNode?.resolvedParentId
        ? orgNodes.find((n) => n.nodeId === selectedNode.resolvedParentId) ?? null
        : null,
    [orgNodes, selectedNode],
  );

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void loadData(true);
          }}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      {/* Search + Add button */}
      <View style={styles.searchRow}>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Tìm theo tên, chức danh, phòng ban..."
          placeholderTextColor={colors.muted}
          style={[styles.search, { flex: 1, marginBottom: 0 }]}
        />
        {isManager ? (
          <Pressable onPress={openAddModal} style={styles.primaryBtn}>
            <View style={styles.iconButtonContent}><Plus size={14} color={colors.white} /><Text style={styles.primaryBtnText}>Thêm NS</Text></View>
          </Pressable>
        ) : null}
      </View>

      {/* Department filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.deptRow}
        style={styles.deptScroll}
      >
        {departmentOptions.map((dept) => {
          const active = filterDepartment === dept;
          return (
            <Pressable
              key={dept}
              onPress={() => setFilterDepartment(dept)}
              style={[styles.deptChip, active && styles.deptChipActive]}
            >
              <Text style={[styles.deptText, active && styles.deptTextActive]}>{dept}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Content: Danh sách nhân sự (style Danh bạ gọn đẹp) */}
      {loading ? (
        <Card style={styles.stateCard}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.muted}>Đang tải danh sách nhân sự...</Text>
        </Card>
      ) : error ? (
        <Card style={styles.stateCard}>
          <PopupError error={error} />
          <Pressable onPress={() => void loadData()} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Thử lại</Text>
          </Pressable>
        </Card>
      ) : !filteredNodes.length ? (
        <Card style={styles.stateCard}>
          <Text style={styles.muted}>Không có nhân sự nào khớp điều kiện lọc.</Text>
        </Card>
      ) : (
        <View style={styles.directoryListCard}>
          {filteredNodes
            .slice()
            .sort((a, b) => {
              if (Boolean(b.isLeader) !== Boolean(a.isLeader)) {
                return Number(Boolean(b.isLeader)) - Number(Boolean(a.isLeader));
              }
              return (
                (a.resolvedLevel ?? 4) - (b.resolvedLevel ?? 4) ||
                a.displayName.localeCompare(b.displayName, 'vi')
              );
            })
            .map((node, idx) => {
              const roleLabel =
                node.jobTitle || node.position || ROLE_LABELS[node.role || 'user'] || 'Nhân viên';
              const deptLabel = node.department || node.division || 'Chưa phân phòng ban';
              const cleanPhone = node.phone?.replace(/\s+/g, '') || '';
              return (
                <Pressable
                  key={node.nodeId}
                  accessibilityRole="button"
                  onPress={() => openDetail(node)}
                  style={({ pressed }) => [
                    styles.directoryRow,
                    idx > 0 && styles.directoryRowDivider,
                    pressed && styles.directoryRowPressed,
                  ]}
                >
                  <View
                    style={[
                      styles.directoryAvatar,
                      { backgroundColor: getAvatarBg(node.displayName || node.nodeId) },
                    ]}
                  >
                    <Text style={styles.directoryAvatarText}>{getInitials(node.displayName)}</Text>
                  </View>

                  <View style={styles.directoryCopy}>
                    <View style={styles.directoryNameRow}>
                      <Text numberOfLines={1} style={styles.directoryName}>
                        {node.displayName}
                      </Text>
                      {node.isLeader ? <Crown size={13} color="#D97706" /> : null}
                    </View>
                    <Text numberOfLines={1} style={styles.directorySub}>
                      {roleLabel}
                    </Text>
                    <Text numberOfLines={1} style={styles.directoryDept}>
                      {deptLabel}
                    </Text>
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={cleanPhone ? `Gọi ${node.displayName}` : 'Chưa có số điện thoại'}
                    disabled={!cleanPhone}
                    hitSlop={8}
                    onPress={(e) => {
                      e.stopPropagation();
                      if (cleanPhone) {
                        void Linking.openURL(`tel:${cleanPhone}`).catch(() => {});
                      }
                    }}
                    style={({ pressed }) => [
                      styles.directoryCallBtn,
                      !cleanPhone && styles.directoryCallBtnDisabled,
                      pressed && cleanPhone && styles.directoryCallBtnPressed,
                    ]}
                  >
                    <Phone size={16} strokeWidth={1.8} color={colors.primary} />
                  </Pressable>
                </Pressable>
              );
            })}
        </View>
      )}

      {/* Employee Detail & Edit Modal */}
      <Modal
        visible={Boolean(selectedNode)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedNode(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setSelectedNode(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            {selectedNode ? (
              <>
                <View style={styles.modalHeader}>
                  <Text numberOfLines={1} style={styles.sheetTitle}>
                    {isEditing ? 'Chỉnh sửa hồ sơ' : selectedNode.displayName}
                  </Text>
                  <Pressable onPress={() => setSelectedNode(null)} hitSlop={8}>
                    <Text style={styles.closeText}>Đóng</Text>
                  </Pressable>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
                  {isEditing ? (
                    <View style={styles.form}>
                      <Text style={styles.label}>Họ và tên *</Text>
                      <TextInput value={editName} onChangeText={setEditName} style={styles.field} />

                      <Text style={styles.label}>Chức danh</Text>
                      <TextInput value={editJobTitle} onChangeText={setEditJobTitle} placeholder="VD: Trưởng phòng Kinh doanh" placeholderTextColor={colors.muted} style={styles.field} />

                      <Text style={styles.label}>Phòng ban</Text>
                      <TextInput value={editDepartment} onChangeText={setEditDepartment} placeholder="Tên phòng ban" placeholderTextColor={colors.muted} style={styles.field} />

                      <Text style={styles.label}>Khối chức năng</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 6 }}>
                        {DIVISIONS.map((div) => (
                          <Pressable
                            key={div}
                            onPress={() => setEditDivision(div)}
                            style={[styles.deptChip, editDivision === div && styles.deptChipActive]}
                          >
                            <Text style={[styles.deptText, editDivision === div && styles.deptTextActive]}>{div}</Text>
                          </Pressable>
                        ))}
                      </ScrollView>

                      <Text style={styles.label}>Quản lý trực tiếp</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 6 }}>
                        <Pressable
                          onPress={() => setEditParentId('')}
                          style={[styles.deptChip, !editParentId && styles.deptChipActive]}
                        >
                          <Text style={[styles.deptText, !editParentId && styles.deptTextActive]}>Không có</Text>
                        </Pressable>
                        {orgNodes
                          .filter((n) => n.nodeId !== selectedNode.nodeId)
                          .slice(0, 20)
                          .map((cand) => (
                            <Pressable
                              key={cand.nodeId}
                              onPress={() => setEditParentId(cand.nodeId)}
                              style={[styles.deptChip, editParentId === cand.nodeId && styles.deptChipActive]}
                            >
                              <Text style={[styles.deptText, editParentId === cand.nodeId && styles.deptTextActive]}>
                                {cand.displayName}
                              </Text>
                            </Pressable>
                          ))}
                      </ScrollView>

                      <Text style={styles.label}>Số điện thoại</Text>
                      <TextInput value={editPhone} onChangeText={setEditPhone} keyboardType="phone-pad" style={styles.field} />

                      <Text style={styles.label}>Trình độ chuyên môn</Text>
                      <TextInput value={editQualification} onChangeText={setEditQualification} style={styles.field} />

                      <Text style={styles.label}>Lương tháng (VNĐ)</Text>
                      <TextInput value={editSalary} onChangeText={setEditSalary} keyboardType="numeric" style={styles.field} />

                      <Text style={styles.label}>Link mô tả công việc (JD)</Text>
                      <TextInput value={editJdLink} onChangeText={setEditJdLink} autoCapitalize="none" style={styles.field} />

                      <View style={styles.actionRow}>
                        <Pressable onPress={() => setIsEditing(false)} style={styles.secondaryBtn}>
                          <Text style={styles.secondaryBtnText}>Hủy</Text>
                        </Pressable>
                        <Pressable
                          disabled={savingEdit}
                          onPress={() => void onSaveEdit()}
                          style={[styles.submitBtn, { flex: 1 }, savingEdit && styles.disabled]}
                        >
                          <Text style={styles.submitBtnText}>
                            {savingEdit ? 'Đang lưu...' : 'Lưu thay đổi'}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.detailBody}>
                      <View style={styles.detailTop}>
                        <View style={styles.detailRoleRow}>
                          {selectedNode.isLeader ? <Crown size={14} color="#D97706" /> : null}
                          <Text style={styles.detailRole}>
                            {selectedNode.isLeader ? 'Trưởng nhóm · ' : ''}
                            {selectedNode.jobTitle || selectedNode.position || 'Chưa cập nhật chức vụ'}
                          </Text>
                        </View>
                        <Text style={styles.muted}>
                          {selectedNode.department || 'Chưa phân phòng ban'}
                          {selectedNode.division ? ` · ${selectedNode.division}` : ''}
                        </Text>
                      </View>

                      <View style={styles.infoGrid}>
                        <InfoLine label="Email" value={selectedNode.email || '—'} />
                        <InfoLine label="Điện thoại" value={selectedNode.phone || 'Chưa cập nhật'} />
                        <InfoLine label="Chuyên môn" value={selectedNode.qualification || '—'} />
                        {selectedNode.monthlySalary != null ? (
                          <InfoLine label="Lương tháng" value={formatVndAmount(selectedNode.monthlySalary)} />
                        ) : null}
                        {leaveBalance ? (
                          <InfoLine
                            label={`Phép năm ${leaveBalance.year ?? new Date().getFullYear()}`}
                            value={`Còn ${leaveBalance.remaining ?? 0} / ${leaveBalance.entitlement ?? 0} ngày`}
                          />
                        ) : null}
                      </View>

                      {selectedNode.jobDescriptionLink ? (
                        <Pressable
                          onPress={() => void Linking.openURL(selectedNode.jobDescriptionLink!)}
                          style={styles.jdLinkBtn}
                        >
                          <View style={styles.iconButtonContent}>
                            <FileText size={15} color={colors.primary} />
                            <Text style={styles.jdLinkText}>Mở mô tả công việc (JD)</Text>
                            <ChevronRight size={15} color={colors.primary} />
                          </View>
                        </Pressable>
                      ) : null}

                      {directManager ? (
                        <View style={styles.relSection}>
                          <Text style={styles.relTitle}>Báo cáo trực tiếp cho</Text>
                          <Pressable onPress={() => openDetail(directManager)} style={styles.relChip}>
                            <Text style={styles.relChipText}>{directManager.displayName}</Text>
                          </Pressable>
                        </View>
                      ) : null}

                      {directReports.length > 0 ? (
                        <View style={styles.relSection}>
                          <Text style={styles.relTitle}>Cấp dưới trực thuộc ({directReports.length})</Text>
                          <View style={styles.relList}>
                            {directReports.map((sub) => (
                              <Pressable key={sub.nodeId} onPress={() => openDetail(sub)} style={styles.relChip}>
                                <Text style={styles.relChipText}>{sub.displayName}</Text>
                              </Pressable>
                            ))}
                          </View>
                        </View>
                      ) : null}

                      {canEdit(selectedNode) ? (
                        <View style={styles.detailActions}>
                          <Pressable
                            disabled={savingLeader}
                            onPress={() => void onToggleLeader()}
                            style={styles.leaderBtn}
                          >
                            <View style={styles.iconButtonContent}>
                              {!savingLeader && !selectedNode.isLeader ? <Crown size={14} color={colors.primary} /> : null}
                              <Text style={styles.leaderBtnText}>
                                {savingLeader
                                  ? 'Đang cập nhật...'
                                  : selectedNode.isLeader
                                    ? 'Hủy chức Trưởng nhóm'
                                    : 'Đặt làm Trưởng nhóm'}
                              </Text>
                            </View>
                          </Pressable>
                          <Pressable onPress={startEdit} style={styles.submitBtn}>
                            <Text style={styles.submitBtnText}>Chỉnh sửa hồ sơ</Text>
                          </Pressable>
                        </View>
                      ) : null}

                      {canDelete(selectedNode) ? (
                        <Pressable onPress={() => onDeleteNode(selectedNode)} style={styles.deleteBtn}>
                          <Text style={styles.deleteBtnText}>Xóa nhân sự khỏi sơ đồ</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  )}
                </ScrollView>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add Employee Modal */}
      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={() => setAddOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setAddOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.sheetTitle}>Thêm nhân sự mới</Text>
              <Pressable onPress={() => setAddOpen(false)} hitSlop={8}>
                <Text style={styles.closeText}>Đóng</Text>
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
              <View style={styles.form}>
                <Text style={styles.label}>Họ và tên *</Text>
                <TextInput value={addName} onChangeText={setAddName} placeholder="Nguyễn Văn A" placeholderTextColor={colors.muted} style={styles.field} />

                <Text style={styles.label}>Email đăng nhập *</Text>
                <TextInput value={addEmail} onChangeText={setAddEmail} keyboardType="email-address" autoCapitalize="none" placeholder="email@congty.vn" placeholderTextColor={colors.muted} style={styles.field} />

                <Text style={styles.label}>Mật khẩu (tối thiểu 6 ký tự) *</Text>
                <TextInput value={addPassword} onChangeText={setAddPassword} secureTextEntry placeholder="••••••" placeholderTextColor={colors.muted} style={styles.field} />

                <Text style={styles.label}>Vai trò</Text>
                <View style={styles.relList}>
                  {(['user', 'manager', 'branch_owner', 'admin'] as const).map((r) => (
                    <Pressable
                      key={r}
                      onPress={() => setAddRole(r)}
                      style={[styles.deptChip, addRole === r && styles.deptChipActive]}
                    >
                      <Text style={[styles.deptText, addRole === r && styles.deptTextActive]}>
                        {ROLE_LABELS[r]}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.label}>Phòng ban</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: addDepartmentOpen }}
                  onPress={() => setAddDepartmentOpen((open) => !open)}
                  style={styles.departmentSelector}
                >
                  <Text style={[styles.departmentSelectorText, !addDepartment && styles.departmentPlaceholder]}>
                    {addDepartment || 'Chọn phòng ban'}
                  </Text>
                  <ChevronDown size={16} color={colors.muted} />
                </Pressable>
                {addDepartmentOpen ? (
                  <View style={styles.departmentDropdown}>
                    {departmentOptions.length > 1 ? (
                      <ScrollView nestedScrollEnabled style={styles.departmentOptions}>
                        {departmentOptions.slice(1).map((department) => (
                          <Pressable
                            key={department}
                            onPress={() => {
                              setAddDepartment(department);
                              setAddDepartmentOpen(false);
                            }}
                            style={styles.departmentOption}
                          >
                            <Text style={styles.departmentOptionText}>{department}</Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    ) : (
                      <Text style={styles.departmentEmpty}>Chưa có phòng ban để chọn.</Text>
                    )}
                  </View>
                ) : null}

                <Text style={styles.label}>Quản lý trực tiếp</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 6 }}>
                  {orgNodes.slice(0, 20).map((cand) => (
                    <Pressable
                      key={cand.nodeId}
                      onPress={() => setAddParentId(cand.nodeId)}
                      style={[styles.deptChip, addParentId === cand.nodeId && styles.deptChipActive]}
                    >
                      <Text style={[styles.deptText, addParentId === cand.nodeId && styles.deptTextActive]}>
                        {cand.displayName}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <Text style={styles.label}>Số điện thoại</Text>
                <TextInput value={addPhone} onChangeText={setAddPhone} keyboardType="phone-pad" placeholder="0987654321" placeholderTextColor={colors.muted} style={styles.field} />

                <Text style={styles.label}>Trình độ chuyên môn</Text>
                <TextInput value={addQualification} onChangeText={setAddQualification} placeholder="Đại học / Thạc sĩ..." placeholderTextColor={colors.muted} style={styles.field} />

                <Text style={styles.label}>Lương tháng (VNĐ)</Text>
                <TextInput value={addSalary} onChangeText={setAddSalary} keyboardType="numeric" placeholder="15.000.000" placeholderTextColor={colors.muted} style={styles.field} />

                <Text style={styles.label}>Link mô tả công việc (JD)</Text>
                <TextInput value={addJdLink} onChangeText={setAddJdLink} autoCapitalize="none" placeholder="https://..." placeholderTextColor={colors.muted} style={styles.field} />

                <Pressable
                  disabled={adding}
                  onPress={() => void onAddEmployee()}
                  style={[styles.submitBtn, adding && styles.disabled]}
                >
                  <Text style={styles.submitBtnText}>
                    {adding ? 'Đang thêm...' : 'Thêm vào sơ đồ tổ chức'}
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

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoVal}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingBottom: 24 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  title: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 11, marginTop: 2 },
  primaryBtn: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  primaryBtnText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  iconButtonContent: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  search: { backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, fontSize: 12, color: colors.ink, marginBottom: 10 },
  toolbar: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  modeSwitch: { flex: 1, flexDirection: 'row', backgroundColor: '#EAF0F8', borderRadius: 11, padding: 3, gap: 3 },
  modeBtn: { flex: 1, paddingVertical: 7, borderRadius: 9, alignItems: 'center' },
  modeBtnActive: { backgroundColor: colors.white },
  modeText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  modeTextActive: { color: colors.primary },
  deptScroll: { marginHorizontal: -18, marginBottom: 12 },
  deptRow: { paddingHorizontal: 18, gap: 6 },
  deptChip: { backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99 },
  deptChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  deptText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  deptTextActive: { color: colors.white },
  stateCard: { padding: 20, alignItems: 'center', gap: 10 },
  errorText: { color: '#B91C1C', fontSize: 12, textAlign: 'center' },

  // Web-style Top-Down Org Chart Canvas
  canvasWrap: { gap: 8 },
  canvasBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  zoomGroup: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  zoomBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  zoomReadout: { paddingHorizontal: 8, height: 28, borderRadius: 8, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' },
  zoomReadoutText: { color: colors.primary, fontSize: 10, fontWeight: '800' },
  canvasActionBtn: { paddingHorizontal: 9, height: 28, borderRadius: 8, backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  canvasActionText: { color: colors.ink, fontSize: 10, fontWeight: '700' },
  treeCanvasCard: {
    height: 500,
    backgroundColor: '#F8FAFD',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 10,
    overflow: 'hidden',
  },
  treeCanvasScroll: { paddingHorizontal: 10, paddingVertical: 8 },
  treeVerticalScroll: { paddingBottom: 24 },
  treeRootsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 20, alignSelf: 'flex-start' },
  treeNodeCol: { alignItems: 'center' },
  treeCard: { width: 168, padding: 10, borderTopWidth: 4, gap: 8, backgroundColor: colors.white },
  treeCardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  treeCardName: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  treeCardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  treeCardRole: { color: colors.muted, fontSize: 9, marginTop: 2 },
  treeCardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  treeDeptPill: { fontSize: 9, fontWeight: '700', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 99, overflow: 'hidden', flexShrink: 1 },
  treeToggleBtn: { minWidth: 24, height: 22, borderRadius: 7, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  treeToggleContent: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  treeToggleText: { color: colors.primary, fontSize: 10, fontWeight: '800' },
  treeChildrenWrap: { alignItems: 'center' },
  treeStemDown: { width: 2, height: 16, backgroundColor: '#CBD5E1' },
  treeChildrenRow: { flexDirection: 'row', alignItems: 'flex-start' },
  treeChildSlot: { alignItems: 'center' },
  treeStemSingle: { width: 2, height: 14, backgroundColor: '#CBD5E1' },
  treeBranchBar: { flexDirection: 'row', width: '100%', height: 14 },
  treeBranchHalf: { flex: 1, height: 14 },
  treeBranchTopLine: { borderTopWidth: 2, borderTopColor: '#CBD5E1' },
  treeBranchRightLine: { borderRightWidth: 1, borderRightColor: '#CBD5E1' },
  treeBranchLeftLine: { borderLeftWidth: 1, borderLeftColor: '#CBD5E1' },
  treeChildInner: { paddingHorizontal: 6 },
  canvasHint: { color: colors.muted, fontSize: 9, textAlign: 'center', marginTop: 8 },

  // Focus Drill-down Org Chart (Mobile-first)
  focusContainer: { gap: 12 },
  rootSwitchRow: { gap: 6, paddingBottom: 2 },
  breadcrumbRow: { alignItems: 'center', gap: 4, paddingVertical: 2 },
  breadcrumbItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  breadcrumbText: { color: colors.muted, fontSize: 11, fontWeight: '600', maxWidth: 130 },
  breadcrumbTextActive: { color: colors.primary, fontWeight: '800' },
  breadcrumbSep: { color: colors.muted, fontSize: 12 },
  focusSection: { gap: 7 },
  focusSectionLabel: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  parentCard: { flexDirection: 'row', alignItems: 'center', padding: 11, gap: 10, backgroundColor: '#F8FBFF', borderColor: '#DCE8FA' },
  parentName: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  upHint: { color: colors.primary, fontSize: 10, fontWeight: '800' },
  verticalStem: { width: 2, height: 12, backgroundColor: '#CBD5E1', alignSelf: 'center', marginVertical: -3 },
  focusCard: { padding: 15, borderTopWidth: 4, gap: 12 },
  focusCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarLg: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarTextLg: { fontSize: 16, fontWeight: '800' },
  avatarSm: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  avatarTextSm: { fontSize: 11, fontWeight: '800' },
  focusName: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  focusRole: { color: colors.primary, fontSize: 12, fontWeight: '700', marginTop: 2 },
  focusDept: { color: colors.muted, fontSize: 11, marginTop: 2 },
  focusFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  focusCount: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  profileBtn: { backgroundColor: '#EAF2FF', paddingHorizontal: 11, paddingVertical: 6, borderRadius: 9 },
  profileBtnText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  subCard: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 11, borderLeftWidth: 4 },
  drillBadge: { backgroundColor: '#EAF2FF', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 99 },
  drillBadgeText: { color: colors.primary, fontSize: 11, fontWeight: '800' },
  emptySubCard: { padding: 16, alignItems: 'center' },

  // Department Accordion
  deptGroupsWrap: { gap: 10 },
  deptGroupCard: { padding: 12 },
  deptGroupHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  deptDot: { width: 10, height: 10, borderRadius: 5 },
  deptGroupTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  deptMembersList: { marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  deptMemberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 10 },
  deptMemberBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },

  listWrap: { gap: 8 },
  listCard: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 11 },
  avatar: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 12, fontWeight: '800' },
  nodeCopy: { flex: 1 },
  nodeName: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  nodeSub: { color: colors.muted, fontSize: 10, marginTop: 2 },
  subMeta: { color: colors.muted, fontSize: 10, marginTop: 2 },
  collapseText: { color: colors.primary, fontSize: 14, fontWeight: '800', paddingHorizontal: 4 },
  chevron: { color: colors.muted, fontSize: 20 },

  // Modals
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.42)', justifyContent: 'center', padding: 16 },
  sheet: { backgroundColor: colors.white, borderRadius: 24, overflow: 'hidden', padding: 18, maxHeight: '86%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitle: { color: colors.ink, fontSize: 16, fontWeight: '800', flex: 1 },
  closeText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  detailBody: { gap: 12 },
  detailTop: { paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  detailRole: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  detailRoleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  infoGrid: { gap: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  infoLabel: { color: colors.muted, fontSize: 11 },
  infoVal: { color: colors.ink, fontSize: 11, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  jdLinkBtn: { backgroundColor: '#EAF2FF', padding: 10, borderRadius: 10 },
  jdLinkText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  relSection: { gap: 6 },
  relTitle: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  relList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  relChip: { backgroundColor: '#F1F5FB', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9, alignSelf: 'flex-start' },
  relChipText: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  departmentSelector: { minHeight: 40, backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  departmentSelectorText: { color: colors.ink, fontSize: 12 },
  departmentPlaceholder: { color: colors.muted },
  departmentDropdown: { backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, borderRadius: 11, overflow: 'hidden' },
  departmentOptions: { maxHeight: 150 },
  departmentOption: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  departmentOptionText: { color: colors.ink, fontSize: 12 },
  departmentEmpty: { color: colors.muted, fontSize: 11, paddingHorizontal: 12, paddingVertical: 10 },
  detailActions: { gap: 8, marginTop: 4 },
  leaderBtn: { backgroundColor: '#FFF3E5', borderColor: '#F6D1A2', borderWidth: 1, minHeight: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  leaderBtnText: { color: '#B45309', fontSize: 12, fontWeight: '800' },
  deleteBtn: { backgroundColor: '#FCEBEC', minHeight: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  deleteBtnText: { color: '#C74848', fontSize: 12, fontWeight: '700' },
  form: { gap: 8, paddingBottom: 12 },
  label: { color: colors.ink, fontSize: 11, fontWeight: '700', marginTop: 4 },
  field: { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 9, fontSize: 12, color: colors.ink },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  secondaryBtn: { backgroundColor: '#F1F5F9', minHeight: 44, paddingHorizontal: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  submitBtn: { backgroundColor: colors.primary, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  directoryListCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5EAF2',
    overflow: 'hidden',
  },
  directoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 13,
    backgroundColor: colors.white,
  },
  directoryRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EEF2F7',
  },
  directoryRowPressed: {
    backgroundColor: '#F5F8FD',
  },
  directoryAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  directoryAvatarText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  directoryCopy: {
    flex: 1,
    gap: 2,
  },
  directoryNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  directoryName: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '500',
    flexShrink: 1,
  },
  directorySub: {
    color: '#64748B',
    fontSize: 12.5,
    fontWeight: '400',
  },
  directoryDept: {
    color: '#7C8BA1',
    fontSize: 12.5,
    fontWeight: '400',
  },
  directoryCallBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5FD',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  directoryCallBtnDisabled: {
    opacity: 0.3,
  },
  directoryCallBtnPressed: {
    backgroundColor: '#DCE8FC',
  },
});

