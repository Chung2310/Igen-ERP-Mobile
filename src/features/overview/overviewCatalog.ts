import type { ErpUser } from '@/core/auth/authApi';
import { isTenantModuleEnabled } from '@/features/modules/moduleCatalog';
import type { OverviewPageDefinition } from '@/features/overview/types';
import {
  BriefcaseBusiness,
  CircleDollarSign,
  FileText,
  GraduationCap,
  HeartPulse,
  MessageSquare,
  Package,
  Users,
} from 'lucide-react-native';

export const ALL_OVERVIEW_PAGES: OverviewPageDefinition[] = [
  {
    id: 'hr',
    label: 'Nhân sự',
    shortLabel: 'Nhân sự',
    subtitle: 'Chấm công, hợp đồng, công việc & đào tạo',
    icon: Users,
    accent: '#0E7490',
    tone: '#E8F7FA',
    moduleSlug: 'hr',
  },
  {
    id: 'finance',
    label: 'Tài chính',
    shortLabel: 'Tài chính',
    subtitle: 'Thu chi, lãi lỗ, dòng tiền & công nợ',
    icon: CircleDollarSign,
    accent: '#16885A',
    tone: '#E9F8F1',
    moduleSlug: 'analytics',
  },
  {
    id: 'quotation',
    label: 'Báo giá',
    shortLabel: 'Báo giá',
    subtitle: 'Báo giá, hợp đồng & nghiệm thu',
    icon: FileText,
    accent: '#7754C8',
    tone: '#F1EBFF',
    moduleSlug: 'quotes',
  },
  {
    id: 'retail',
    label: 'Bán lẻ & POS',
    shortLabel: 'Bán lẻ',
    subtitle: 'Doanh số, đơn hàng, thu ngân & sản phẩm',
    icon: Package,
    accent: '#C27617',
    tone: '#FFF3E5',
    moduleSlug: 'inventory',
  },
  {
    id: 'marketing',
    label: 'Marketing & CRM',
    shortLabel: 'CRM',
    subtitle: 'Phễu cơ hội, hội thoại & kho tri thức',
    icon: MessageSquare,
    accent: '#2463EB',
    tone: '#EAF2FF',
    moduleSlug: 'crm',
  },
  {
    id: 'student',
    label: 'Học viên & Đào tạo',
    shortLabel: 'Học viên',
    subtitle: 'Tuyển sinh, học phí & lớp học',
    icon: GraduationCap,
    accent: '#6D28D9',
    tone: '#F3EEFF',
  },
  {
    id: 'worker',
    label: 'Lao động',
    shortLabel: 'Lao động',
    subtitle: 'Hồ sơ lao động, bố trí & dự án',
    icon: BriefcaseBusiness,
    accent: '#B45309',
    tone: '#FEF3C7',
    moduleSlug: 'partners',
  },
  {
    id: 'healthcare',
    label: 'Y tế',
    shortLabel: 'Y tế',
    subtitle: 'Bệnh nhân, lượt khám, lịch hẹn & chăm sóc',
    icon: HeartPulse,
    accent: '#BE123C',
    tone: '#FFE4E6',
  },
];

function hasPerm(user: ErpUser | null, code: string): boolean {
  if (!user) return false;
  if (user.role === 'superadmin' || user.role === 'admin') return true;
  const perms = user.permissions ?? [];
  return perms.includes('*') || perms.includes(code);
}

export function canAccessOverview(user: ErpUser | null): boolean {
  return hasPerm(user, 'dashboard:read') && resolveAllowedOverviewPages(user).length > 0;
}

/**
 * Lọc danh sách trang tổng quan theo gói module và quyền ERP của tài khoản
 * (đồng bộ với DashboardTab.tsx trên web ERP).
 */
export function resolveAllowedOverviewPages(user: ErpUser | null): OverviewPageDefinition[] {
  if (!user) return ALL_OVERVIEW_PAGES;

  const isAdmin = user.role === 'superadmin' || user.role === 'admin';
  const isManager = isAdmin || user.role === 'manager';
  const isTeacher = user.role === 'teacher';
  const hasModule = (key: string) => isTenantModuleEnabled(user, key);

  return ALL_OVERVIEW_PAGES.filter((page) => {
    switch (page.id) {
      case 'finance':
        return (
          hasModule('finance') &&
          (isAdmin ||
            hasPerm(user, 'finance:read') ||
            hasPerm(user, 'finance:manage') ||
            hasPerm(user, 'accounting:read') ||
            hasPerm(user, 'accounting:manage'))
        );
      case 'hr':
        return (
          hasModule('hr') &&
          (isManager ||
            hasPerm(user, 'hr:read') ||
            hasPerm(user, 'access:read') ||
            hasPerm(user, 'timekeeping:read'))
        );
      case 'quotation':
        return (
          hasModule('quotation') &&
          (hasPerm(user, 'quotation:read') || hasPerm(user, 'quotation:manage'))
        );
      case 'retail':
        return (
          hasModule('retail') &&
          (isAdmin || hasPerm(user, 'retail:read') || hasPerm(user, 'retail:manage'))
        );
      case 'marketing':
        return (
          (hasModule('marketing') || hasModule('social-marketing') || hasModule('crm')) &&
          (isAdmin ||
            hasPerm(user, 'marketing:read') ||
            hasPerm(user, 'marketing:manage') ||
            hasPerm(user, 'omni-inbox:read') ||
            hasPerm(user, 'omni-inbox:manage'))
        );
      case 'student':
        return (
          hasModule('student') &&
          (isAdmin || isTeacher || hasPerm(user, 'people:read') || hasPerm(user, 'people:manage'))
        );
      case 'worker':
        return (
          hasModule('worker') &&
          (hasPerm(user, 'people:read') ||
            hasPerm(user, 'people:manage') ||
            hasPerm(user, 'labor-partner:read'))
        );
      case 'healthcare':
        return (
          hasModule('healthcare') &&
          (hasPerm(user, 'healthcare:read') || hasPerm(user, 'healthcare:manage'))
        );
      default:
        return false;
    }
  });
}

