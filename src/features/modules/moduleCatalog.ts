import type { LucideIcon } from 'lucide-react-native';
import {
  BarChart3,
  BriefcaseBusiness,
  Cable,
  FileText,
  FolderOpen,
  Handshake,
  MessagesSquare,
  Package,
  Sparkles,
  Users,
  BookOpen,
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
  { slug: 'crm', name: 'CRM & Hộp thư đa kênh', category: 'Khách hàng', icon: MessagesSquare, color: '#EAF2FF', shortDescription: 'Hội thoại, Lead và chăm sóc khách hàng', description: 'Tiếp nhận hội thoại từ các kênh, phân công nhân viên và theo dõi Lead trong một luồng làm việc.', capabilities: ['Đọc và trả lời tin nhắn, phân công hội thoại', 'AI trả lời theo tài liệu, quy tắc và kịch bản', 'Nhân viên tiếp quản hội thoại', 'Tạo Lead và nhận diện thông tin bằng OCR'] },
  { slug: 'knowledge', name: 'Kho tri thức', category: 'Dữ liệu AI', icon: BookOpen, color: '#F1EBFF', shortDescription: 'Tài liệu dùng cho AI và tra cứu nội bộ', description: 'Quản lý tài liệu doanh nghiệp làm nguồn tri thức cho trợ lý và các luồng AI.', capabilities: ['Thêm, xem và sửa tài liệu', 'Tìm kiếm nội dung', 'Quản lý tài liệu theo quyền'] },
  { slug: 'integrations', name: 'Tích hợp & Cấu hình kênh', category: 'Kết nối', icon: Cable, color: '#E8F7FA', shortDescription: 'Kết nối kênh và kiểm soát đồng bộ', description: 'Thiết lập các kênh giao tiếp với khách hàng, đồng bộ trạng thái và cấu hình AI.', capabilities: ['Kết nối kênh và xem trạng thái', 'Cấu hình AI theo kênh', 'Theo dõi đồng bộ'] },
  { slug: 'ai-plans', name: 'Gói AI & Lượt sử dụng', category: 'Dịch vụ', icon: Sparkles, color: '#FFF3E5', shortDescription: 'Gói dịch vụ, hạn mức và giao dịch AI', description: 'Theo dõi gói dịch vụ và lượng AI đã sử dụng trong doanh nghiệp.', capabilities: ['Mua, nâng cấp và gia hạn gói', 'Xem hạn mức và lịch sử sử dụng', 'Theo dõi trạng thái giao dịch'] },
  { slug: 'users', name: 'Quản trị tài khoản', category: 'Quản trị', icon: Users, color: '#FDECF0', shortDescription: 'Người dùng, vai trò và quyền truy cập', description: 'Quản lý tài khoản thành viên và quyền thao tác trong doanh nghiệp.', capabilities: ['Quản lý người dùng', 'Thiết lập vai trò', 'Phân quyền theo chức năng'] },
  { slug: 'hr', name: 'Nhân sự', category: 'Nhân sự', icon: BriefcaseBusiness, color: '#E8F7FA', shortDescription: 'Hồ sơ nhân viên và nghiệp vụ nhân sự', description: 'Truy cập nghiệp vụ nhân sự theo vai trò và quyền được cấp.', capabilities: ['Hồ sơ, tuyển dụng, phòng ban và chi nhánh', 'Hợp đồng, giao việc và lịch', 'Đào tạo, quy trình và bảng lương theo quyền'] },
  { slug: 'resources', name: 'Quản lý tài nguyên', category: 'Tài liệu', icon: FolderOpen, color: '#EAF2FF', shortDescription: 'Tài liệu doanh nghiệp và chia sẻ tệp', description: 'Tìm kiếm và chia sẻ tài nguyên doanh nghiệp với quyền truy cập phù hợp.', capabilities: ['Tìm và xem tài liệu', 'Tải tệp lên', 'Chia sẻ theo quyền'] },
  { slug: 'partners', name: 'Đối tác', category: 'Quan hệ đối tác', icon: Handshake, color: '#FFF3E5', shortDescription: 'Hồ sơ và thông tin hợp tác', description: 'Quản lý thông tin đối tác và dữ liệu phục vụ hợp tác kinh doanh.', capabilities: ['Hồ sơ đối tác', 'Thông tin hợp tác', 'Dữ liệu liên quan theo quyền'] },
  { slug: 'quotes', name: 'Báo giá', category: 'Kinh doanh', icon: FileText, color: '#F1EBFF', shortDescription: 'Lập, duyệt và chia sẻ báo giá', description: 'Tạo báo giá, theo dõi phê duyệt và gửi tài liệu cho khách hàng.', capabilities: ['Tạo và sửa báo giá', 'Xem chi tiết và duyệt', 'Chia sẻ báo giá PDF'] },
  { slug: 'analytics', name: 'Phân tích & Báo cáo', category: 'Báo cáo', icon: BarChart3, color: '#E9F8F1', shortDescription: 'Chỉ số tài chính và báo cáo vận hành', description: 'Xem báo cáo theo kỳ và lọc theo quyền truy cập của người dùng.', capabilities: ['Doanh thu, chi phí, lợi nhuận và công nợ', 'Lọc theo kỳ', 'Xuất báo cáo theo quyền'] },
  { slug: 'inventory', name: 'Kho & Sản phẩm', category: 'Hàng hóa', icon: Package, color: '#FFF3E5', shortDescription: 'Sản phẩm và nghiệp vụ kho', description: 'Tra cứu hàng hóa và theo dõi biến động kho theo phạm vi được phân quyền.', capabilities: ['Danh mục sản phẩm và tồn kho', 'Nhập, xuất và điều chuyển', 'Kiểm kê và tra cứu theo quyền'] },
];

export function getModuleBySlug(slug?: string) {
  return moduleCatalog.find((module) => module.slug === slug);
}
