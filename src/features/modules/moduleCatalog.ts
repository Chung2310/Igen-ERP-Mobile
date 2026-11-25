import type { LucideIcon } from 'lucide-react-native';
import type { ErpUser } from '@/core/auth/authApi';
import {
  BriefcaseBusiness,
  FileText,
  FolderOpen,
  GraduationCap,
  Package,
  Sparkles,
  Users,
} from 'lucide-react-native';

export type ModuleDefinition = {
  slug: string;
  name: string;
  category: string;
  icon: LucideIcon;
  color: string;
  shortDescription: string;
  description: string;
  capabilities: string[];
};

// Registry trung tâm: thêm phân hệ mới bằng một định nghĩa; route và danh sách được sinh tự động.
export const moduleCatalog: ModuleDefinition[] = [
  { slug: 'ai-plans', name: 'Gói AI & Lượt sử dụng', category: 'Dịch vụ', icon: Sparkles, color: '#FFF3E5', shortDescription: 'Gói dịch vụ, hạn mức và giao dịch AI', description: 'Theo dõi gói dịch vụ và lượng AI đã sử dụng trong doanh nghiệp.', capabilities: ['Mua, nâng cấp và gia hạn gói', 'Xem hạn mức và lịch sử sử dụng', 'Theo dõi trạng thái giao dịch'] },
  { slug: 'users', name: 'Quản trị tài khoản', category: 'Quản trị', icon: Users, color: '#FDECF0', shortDescription: 'Người dùng, vai trò và quyền truy cập', description: 'Quản lý tài khoản thành viên và quyền thao tác trong doanh nghiệp.', capabilities: ['Quản lý người dùng', 'Thiết lập vai trò', 'Phân quyền theo chức năng'] },
  { slug: 'hr', name: 'Nhân sự', category: 'Nhân sự', icon: BriefcaseBusiness, color: '#E8F7FA', shortDescription: 'Hồ sơ nhân viên và nghiệp vụ nhân sự', description: 'Truy cập nghiệp vụ nhân sự theo vai trò và quyền được cấp.', capabilities: ['Hồ sơ, tuyển dụng, phòng ban và chi nhánh', 'Hợp đồng, giao việc và lịch', 'Đào tạo, quy trình và bảng lương theo quyền'] },
  { slug: 'worker-management', name: 'Lao động', category: 'Nhân sự', icon: Users, color: '#E8F7FA', shortDescription: 'Hồ sơ, dự án và nghiệp vụ lao động', description: 'Quản lý hồ sơ lao động, dự án và phân công, chấm công, hợp đồng lao động và thông báo.', capabilities: ['Hồ sơ lao động, phân loại và nhập/xuất danh sách', 'Dự án, phân công, chấm công và điểm danh QR', 'Hợp đồng, gia hạn, cảnh báo và lịch sử', 'Thông báo lao động'] },
  { slug: 'student-management', name: 'Học viên & Đào tạo', category: 'Đào tạo', icon: GraduationCap, color: '#E7F5FF', shortDescription: 'Hồ sơ học viên và nghiệp vụ đào tạo', description: 'Quản lý hồ sơ học viên, khóa học, lớp học, điểm danh, chất lượng, lịch thi, học phí, bảo lưu, lộ trình, thông báo và tài nguyên đào tạo.', capabilities: ['Hồ sơ học viên, trạng thái, đợt thu học phí và lịch sử đào tạo', 'Khóa học, lớp học, danh sách học viên, điểm danh thường và QR', 'Đánh giá chuyên cần, bài tập, mini test và kết quả thi', 'Lịch thi, xếp thí sinh, thu học phí, công nợ và thông báo email', 'Bảo lưu, học lại, lộ trình đào tạo, hàng chờ xếp lớp và phòng học'] },
  { slug: 'resources', name: 'Quản lý tài nguyên', category: 'Tài liệu', icon: FolderOpen, color: '#EAF2FF', shortDescription: 'Tài liệu doanh nghiệp và chia sẻ tệp', description: 'Tìm kiếm và chia sẻ tài nguyên doanh nghiệp với quyền truy cập phù hợp.', capabilities: ['Tìm và xem tài liệu', 'Tải tệp lên', 'Chia sẻ theo quyền'] },
  { slug: 'quotes', name: 'Báo giá', category: 'Kinh doanh', icon: FileText, color: '#F1EBFF', shortDescription: 'Lập, duyệt và chia sẻ báo giá', description: 'Tạo báo giá, theo dõi phê duyệt và gửi tài liệu cho khách hàng.', capabilities: ['Tạo và sửa báo giá', 'Xem chi tiết và duyệt', 'Chia sẻ báo giá PDF'] },
  { slug: 'inventory', name: 'Kho & Sản phẩm', category: 'Hàng hóa', icon: Package, color: '#FFF3E5', shortDescription: 'Sản phẩm và nghiệp vụ kho', description: 'Tra cứu hàng hóa và theo dõi biến động kho theo phạm vi được phân quyền.', capabilities: ['Danh mục sản phẩm và tồn kho', 'Nhập, xuất và điều chuyển', 'Kiểm kê và tra cứu theo quyền'] },
];

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
  if (!user) return false;
  const isAdmin = user.role === 'admin' || user.role === 'superadmin';
  const perms = user.permissions ?? [];
  if (slug === 'users') {
    return isAdmin;
  }
  if (slug === 'ai-plans') {
    return Boolean(user.companyCode) && (isAdmin || perms.includes('*') || perms.some((code) => AI_PLAN_PERMISSIONS.includes(code)));
  }
  if (slug === 'worker-management') {
    return (user.role === 'superadmin' || Boolean(user.companyCode)) && (isAdmin || perms.includes('*') || perms.some((code) => ['people:read', 'people:manage'].includes(code)));
  }
  if (slug === 'student-management') {
    return (user.role === 'superadmin' || Boolean(user.companyCode)) && (isAdmin || perms.includes('*') || perms.some((code) => ['people:read', 'people:manage'].includes(code)));
  }
  return true;
}

export function getModuleBySlug(slug?: string) {
  return moduleCatalog.find((module) => module.slug === slug);
}
