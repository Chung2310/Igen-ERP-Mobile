import type { LucideIcon } from 'lucide-react-native';
import type { ErpUser } from '@/core/auth/authApi';
import {
  BriefcaseBusiness,
  FileText,
  FolderOpen,
  GraduationCap,
  Package,
  ShoppingCart,
  Sparkles,
  Users,
  Wrench,
} from 'lucide-react-native';

export type ModuleDefinition = {
  slug: string;
  name: string;
  shortName?: string;
  category: string;
  icon: LucideIcon;
  color: string;
  shortDescription: string;
  description: string;
  capabilities: string[];
};

// Registry trung tâm: thêm phân hệ mới bằng một định nghĩa; route và danh sách được sinh tự động.
export const moduleCatalog: ModuleDefinition[] = [
  { slug: 'ai-plans', name: 'Gói AI & Lượt sử dụng', shortName: 'Gói AI', category: 'Dịch vụ', icon: Sparkles, color: '#FFF3E5', shortDescription: 'Gói dịch vụ, hạn mức và giao dịch AI', description: 'Theo dõi gói dịch vụ và lượng AI đã sử dụng trong doanh nghiệp.', capabilities: ['Mua, nâng cấp và gia hạn gói', 'Xem hạn mức và lịch sử sử dụng', 'Theo dõi trạng thái giao dịch'] },
  { slug: 'users', name: 'Quản trị tài khoản', shortName: 'Tài khoản', category: 'Quản trị', icon: Users, color: '#FDECF0', shortDescription: 'Người dùng, vai trò và quyền truy cập', description: 'Quản lý tài khoản thành viên và quyền thao tác trong doanh nghiệp.', capabilities: ['Quản lý người dùng', 'Thiết lập vai trò', 'Phân quyền theo chức năng'] },
  { slug: 'hr', name: 'Nhân sự', shortName: 'Nhân sự', category: 'Nhân sự', icon: BriefcaseBusiness, color: '#E8F7FA', shortDescription: 'Hồ sơ nhân viên và nghiệp vụ nhân sự', description: 'Truy cập nghiệp vụ nhân sự theo vai trò và quyền được cấp.', capabilities: ['Hồ sơ, tuyển dụng, phòng ban và chi nhánh', 'Hợp đồng, giao việc và lịch', 'Đào tạo, quy trình và bảng lương theo quyền'] },
  { slug: 'worker-management', name: 'Lao động', shortName: 'Lao động', category: 'Nhân sự', icon: Users, color: '#E8F7FA', shortDescription: 'Hồ sơ, dự án và nghiệp vụ lao động', description: 'Quản lý hồ sơ lao động, dự án và phân công, chấm công, hợp đồng lao động và thông báo.', capabilities: ['Hồ sơ lao động, phân loại và nhập/xuất danh sách', 'Dự án, phân công, chấm công và điểm danh QR', 'Hợp đồng, gia hạn, cảnh báo và lịch sử', 'Thông báo lao động'] },
  { slug: 'student-management', name: 'Học viên & Đào tạo', shortName: 'Đào tạo', category: 'Đào tạo', icon: GraduationCap, color: '#E7F5FF', shortDescription: 'Hồ sơ học viên và nghiệp vụ đào tạo', description: 'Quản lý hồ sơ học viên, khóa học, lớp học, điểm danh, chất lượng, lịch thi, học phí, bảo lưu, lộ trình, thông báo và tài nguyên đào tạo.', capabilities: ['Hồ sơ học viên, trạng thái, đợt thu học phí và lịch sử đào tạo', 'Khóa học, lớp học, danh sách học viên, điểm danh thường và QR', 'Đánh giá chuyên cần, bài tập, mini test và kết quả thi', 'Lịch thi, xếp thí sinh, thu học phí, công nợ và thông báo email', 'Bảo lưu, học lại, lộ trình đào tạo, hàng chờ xếp lớp và phòng học'] },
  { slug: 'resources', name: 'Quản lý tài nguyên', shortName: 'Tài nguyên', category: 'Tài liệu', icon: FolderOpen, color: '#EAF2FF', shortDescription: 'Tài liệu doanh nghiệp và chia sẻ tệp', description: 'Tìm kiếm và chia sẻ tài nguyên doanh nghiệp với quyền truy cập phù hợp.', capabilities: ['Tìm và xem tài liệu', 'Tải tệp lên', 'Chia sẻ theo quyền'] },
  { slug: 'quotes', name: 'Báo giá', shortName: 'Báo giá', category: 'Kinh doanh', icon: FileText, color: '#F1EBFF', shortDescription: 'Lập, duyệt và chia sẻ báo giá', description: 'Tạo báo giá, theo dõi phê duyệt và gửi tài liệu cho khách hàng.', capabilities: ['Tạo và sửa báo giá', 'Xem chi tiết và duyệt', 'Chia sẻ báo giá PDF'] },
  { slug: 'customer-management', name: 'Quản lý khách hàng', shortName: 'Khách hàng', category: 'Kinh doanh', icon: Users, color: '#EAF2FF', shortDescription: 'Hồ sơ, giao dịch và chăm sóc khách hàng', description: 'Quản lý hồ sơ khách hàng, lịch sử mua hàng, hồ sơ VAT, công nợ, điểm thưởng và phân hạng.', capabilities: ['Tìm kiếm, lọc, tạo và cập nhật hồ sơ khách hàng', 'Theo dõi mua hàng, giao dịch, sửa chữa, công nợ và điểm thưởng', 'Quản lý hồ sơ VAT, phân hạng và chính sách khách hàng thân thiết'] },
  { slug: 'inventory', name: 'Kho & Sản phẩm', shortName: 'Kho hàng', category: 'Hàng hóa', icon: Package, color: '#FFF3E5', shortDescription: 'Sản phẩm và nghiệp vụ kho', description: 'Tra cứu hàng hóa và theo dõi biến động kho theo phạm vi được phân quyền.', capabilities: ['Danh mục sản phẩm và tồn kho', 'Nhập, xuất và điều chuyển', 'Kiểm kê và tra cứu theo quyền'] },
  { slug: 'retail-sales', name: 'Bán lẻ', shortName: 'Bán lẻ', category: 'Kinh doanh', icon: ShoppingCart, color: '#EAF2FF', shortDescription: 'POS, đơn bán và nghiệp vụ hậu mãi', description: 'Vận hành các nghiệp vụ bán lẻ trên mobile theo quyền ERP: POS, đơn hàng, đổi trả, hóa đơn, bảo hành, báo cáo, ca và cấu hình.', capabilities: ['POS, thanh toán và quản lý đơn', 'Đổi trả, hóa đơn và bảo hành', 'Báo cáo, ca POS, tài chính và ưu đãi'] },
  { slug: 'repair-warranty', name: 'Sửa chữa & bảo hành', shortName: 'Sửa chữa', category: 'Dịch vụ', icon: Wrench, color: '#FFF0E4', shortDescription: 'Phiếu sửa chữa và tra cứu bảo hành', description: 'Tra cứu thời hạn bảo hành, theo dõi phiếu sửa chữa và xem báo cáo theo chi nhánh.', capabilities: ['Tra cứu bảo hành theo IMEI, serial hoặc số điện thoại', 'Tìm kiếm, lọc và xem phiếu sửa chữa', 'Xem doanh thu sửa chữa theo ngày, chi nhánh và kỹ thuật viên'] },
  { slug: 'student-partners', name: 'Đối tác học viên', shortName: 'ĐT Học viên', category: 'Đối tác', icon: Users, color: '#E7F5FF', shortDescription: 'Đối tác giới thiệu học viên', description: 'Quản lý đối tác giới thiệu học viên và theo dõi chính sách hợp tác.', capabilities: ['Danh sách và hồ sơ đối tác', 'Chính sách giới thiệu học viên', 'Lịch sử hoạt động'] },
  { slug: 'labor-partners', name: 'Đối tác lao động', shortName: 'ĐT Lao động', category: 'Đối tác', icon: BriefcaseBusiness, color: '#E8F7FA', shortDescription: 'Đối tác giới thiệu lao động', description: 'Quản lý đối tác lao động, chính sách giới thiệu và nghiệp vụ hợp tác.', capabilities: ['Danh sách và hồ sơ đối tác', 'Chính sách và hoa hồng', 'Đối soát và lịch sử hợp tác'] },
  { slug: 'retail-partners', name: 'Đối tác bán lẻ', shortName: 'ĐT Bán lẻ', category: 'Đối tác', icon: Package, color: '#FFF3E5', shortDescription: 'Đối tác trong nghiệp vụ bán lẻ', description: 'Quản lý đối tác bán lẻ và các chính sách, hoạt động liên quan.', capabilities: ['Danh sách và hồ sơ đối tác', 'Chính sách đối tác bán lẻ', 'Lịch sử hoạt động'] },
];

const MODULE_KEYS_BY_SLUG: Record<string, string[]> = {
  hr: ['hr'],
  inventory: ['inventory'],
  'retail-sales': ['retail'],
  resources: ['resource'],
  quotes: ['quotation'],
  'worker-management': ['worker'],
  'student-management': ['student'],
  chat: ['chat'],
  'student-partners': ['student', 'student-partner'],
  'labor-partners': ['worker', 'labor-partner'],
  'retail-partners': ['retail', 'retail-partner'],
  'repair-warranty': ['repair'],
};

const MODULES_REQUIRING_EXPLICIT_ENABLE = new Set([
  'retail',
  'finance',
  'social-marketing',
  'omni-inbox',
  'company-knowledge',
  'legal-reference',
  'quotation',
  'healthcare',
  'architect-assistant',
]);

const MODULE_READ_PERMISSIONS_BY_SLUG: Record<string, string[]> = {
  chat: ['chat:read'],
  hr: ['hr:read', 'access:read', 'work:read', 'timekeeping:read'],
  inventory: ['inventory:read'],
  'retail-sales': ['pos:manage', 'retail:read', 'retail:manage'],
  resources: ['resource:read'],
  quotes: ['quotation:read', 'quotation:manage'],
  'customer-management': ['customer:read', 'customer:manage'],
  'worker-management': ['people:read', 'people:manage', 'labor-partner:read'],
  'student-management': ['people:read', 'people:manage'],
  'student-partners': ['relationship:read', 'relationship:manage'],
  'labor-partners': ['labor-partner:read', 'labor-partner:manage'],
  'retail-partners': [
    'retail-partner:read',
    'retail-partner:manage',
    'retail-partner-policy:manage',
    'retail-partner-self:read',
  ],
  'repair-warranty': ['repair:read', 'repair:manage'],
};

/** Matches the web ERP's tenant module switches, including legacy partner flags. */
export function isTenantModuleEnabled(user: ErpUser | null, key: string): boolean {
  if (!user) return false;
  const enabledModules = user.enabledModules;

  if (key === 'retail-partner') {
    return Boolean(enabledModules?.includes('retail') && enabledModules.includes(key));
  }
  if ((key === 'student-partner' || key === 'labor-partner') && enabledModules?.includes('partner')) {
    return true;
  }
  if (MODULES_REQUIRING_EXPLICIT_ENABLE.has(key)) {
    return Boolean(enabledModules?.includes(key));
  }
  if (!enabledModules) return true;
  if (enabledModules.length === 0) return false;
  return enabledModules.includes(key);
}

export function isModuleVisibleForTenant(user: ErpUser | null, slug: string): boolean {
  if (!user) return false;
  const isAdmin = user.role === 'admin' || user.role === 'superadmin';
  if (slug === 'users') return isAdmin;
  if (slug === 'ai-plans') return true;
  const requiredModules = MODULE_KEYS_BY_SLUG[slug];
  return !requiredModules || requiredModules.every((key) => isTenantModuleEnabled(user, key));
}

const AI_PLAN_PERMISSIONS = [
  'marketing:read',
  'omni-inbox:read',
  'company-knowledge:read',
  'social-integration:read',
  'quotation-ai:read',
  'quotation-ai:manage',
  'architect-ai:read',
  'architect-ai:manage',
];

export function canAccessModule(user: ErpUser | null, slug: string): boolean {
  if (!user || !isModuleVisibleForTenant(user, slug)) return false;
  const isAdmin = user.role === 'admin' || user.role === 'superadmin';
  const perms = user.permissions ?? [];
  if (slug === 'users') {
    return isAdmin;
  }
  if (slug === 'ai-plans') {
    return Boolean(user.companyCode) && (isAdmin || perms.includes('*') || perms.some((code) => AI_PLAN_PERMISSIONS.includes(code)));
  }
  const requiredPermissions = MODULE_READ_PERMISSIONS_BY_SLUG[slug] ?? [];
  if (slug === 'worker-management') {
    return (user.role === 'superadmin' || Boolean(user.companyCode)) && (isAdmin || perms.includes('*') || perms.some((code) => requiredPermissions.includes(code)));
  }
  if (slug === 'student-management') {
    return (user.role === 'superadmin' || Boolean(user.companyCode)) && (isAdmin || perms.includes('*') || perms.some((code) => requiredPermissions.includes(code)));
  }
  if (requiredPermissions.length > 0) return isAdmin || perms.includes('*') || perms.some((code) => requiredPermissions.includes(code));
  return true;
}

export function getModuleBySlug(slug?: string) {
  return moduleCatalog.find((module) => module.slug === slug);
}
