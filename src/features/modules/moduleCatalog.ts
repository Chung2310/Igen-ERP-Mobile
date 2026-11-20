export type ModuleDefinition = {
  slug: string;
  name: string;
  category: string;
  icon: string;
  color: string;
  shortDescription: string;
  description: string;
  capabilities: string[];
};

// Registry trung tâm: thêm phân hệ mới bằng một định nghĩa; route và danh sách được sinh tự động.
export const moduleCatalog: ModuleDefinition[] = [
  { slug: 'crm', name: 'CRM & Hộp thư đa kênh', category: 'Khách hàng', icon: '▣', color: '#EAF2FF', shortDescription: 'Hội thoại, Lead và chăm sóc khách hàng', description: 'Tiếp nhận hội thoại từ các kênh, phân công nhân viên và theo dõi Lead trong một luồng làm việc.', capabilities: ['Đọc và trả lời tin nhắn, phân công hội thoại', 'AI trả lời theo tài liệu, quy tắc và kịch bản', 'Nhân viên tiếp quản hội thoại', 'Tạo Lead và nhận diện thông tin bằng OCR'] },
  { slug: 'knowledge', name: 'Kho tri thức', category: 'Dữ liệu AI', icon: '▤', color: '#F1EBFF', shortDescription: 'Tài liệu dùng cho AI và tra cứu nội bộ', description: 'Quản lý tài liệu doanh nghiệp làm nguồn tri thức cho trợ lý và các luồng AI.', capabilities: ['Thêm, xem và sửa tài liệu', 'Tìm kiếm nội dung', 'Quản lý tài liệu theo quyền'] },
  { slug: 'overview', name: 'Tổng quan', category: 'Điều hành', icon: '◫', color: '#E9F8F1', shortDescription: 'Chỉ số và thông tin cần chú ý trong ngày', description: 'Tổng hợp chỉ số vận hành và các việc cần quan tâm theo vai trò người dùng.', capabilities: ['Số liệu chính và tin chưa đọc', 'Lead mới, công việc và cảnh báo', 'Hạn mức sử dụng AI'] },
  { slug: 'integrations', name: 'Tích hợp & Cấu hình kênh', category: 'Kết nối', icon: '⌘', color: '#E8F7FA', shortDescription: 'Kết nối kênh và kiểm soát đồng bộ', description: 'Thiết lập các kênh giao tiếp với khách hàng, đồng bộ trạng thái và cấu hình AI.', capabilities: ['Kết nối kênh và xem trạng thái', 'Cấu hình AI theo kênh', 'Theo dõi đồng bộ'] },
  { slug: 'ai-plans', name: 'Gói AI & Lượt sử dụng', category: 'Dịch vụ', icon: '✦', color: '#FFF3E5', shortDescription: 'Gói dịch vụ, hạn mức và giao dịch AI', description: 'Theo dõi gói dịch vụ và lượng AI đã sử dụng trong doanh nghiệp.', capabilities: ['Mua, nâng cấp và gia hạn gói', 'Xem hạn mức và lịch sử sử dụng', 'Theo dõi trạng thái giao dịch'] },
  { slug: 'users', name: 'Quản trị tài khoản', category: 'Quản trị', icon: '♙', color: '#FDECF0', shortDescription: 'Người dùng, vai trò và quyền truy cập', description: 'Quản lý tài khoản thành viên và quyền thao tác trong doanh nghiệp.', capabilities: ['Quản lý người dùng', 'Thiết lập vai trò', 'Phân quyền theo chức năng'] },
  { slug: 'settings', name: 'Cài đặt hệ thống', category: 'Cá nhân & hệ thống', icon: '⚙', color: '#F0F3F8', shortDescription: 'Hồ sơ, bảo mật và cấu hình ứng dụng', description: 'Các thiết lập cá nhân và hệ thống doanh nghiệp, gồm quyền riêng tư và hỗ trợ.', capabilities: ['Hồ sơ và bảo mật', 'Cấu hình ERP, thông báo và hỗ trợ', 'Quyền riêng tư và yêu cầu xóa dữ liệu'] },
  { slug: 'hr', name: 'Nhân sự', category: 'Nhân sự', icon: '♧', color: '#E8F7FA', shortDescription: 'Hồ sơ nhân viên và nghiệp vụ nhân sự', description: 'Truy cập nghiệp vụ nhân sự theo vai trò và quyền được cấp.', capabilities: ['Hồ sơ, tuyển dụng, phòng ban và chi nhánh', 'Hợp đồng, giao việc và lịch', 'Đào tạo, quy trình và bảng lương theo quyền'] },
  { slug: 'resources', name: 'Quản lý tài nguyên', category: 'Tài liệu', icon: '▧', color: '#EAF2FF', shortDescription: 'Tài liệu doanh nghiệp và chia sẻ tệp', description: 'Tìm kiếm và chia sẻ tài nguyên doanh nghiệp với quyền truy cập phù hợp.', capabilities: ['Tìm và xem tài liệu', 'Tải tệp lên', 'Chia sẻ theo quyền'] },
  { slug: 'chat', name: 'Trò chuyện nội bộ', category: 'Cộng tác', icon: '☏', color: '#E9F8F1', shortDescription: 'Trao đổi cá nhân và theo nhóm', description: 'Trao đổi công việc với đồng nghiệp và nhận thông báo tin mới.', capabilities: ['Hội thoại cá nhân và nhóm', 'Gửi tin nhắn, ảnh và tài liệu', 'Thông báo tin mới'] },
  { slug: 'partners', name: 'Đối tác', category: 'Quan hệ đối tác', icon: '♧', color: '#FFF3E5', shortDescription: 'Hồ sơ và thông tin hợp tác', description: 'Quản lý thông tin đối tác và dữ liệu phục vụ hợp tác kinh doanh.', capabilities: ['Hồ sơ đối tác', 'Thông tin hợp tác', 'Dữ liệu liên quan theo quyền'] },
  { slug: 'quotes', name: 'Báo giá', category: 'Kinh doanh', icon: '▱', color: '#F1EBFF', shortDescription: 'Lập, duyệt và chia sẻ báo giá', description: 'Tạo báo giá, theo dõi phê duyệt và gửi tài liệu cho khách hàng.', capabilities: ['Tạo và sửa báo giá', 'Xem chi tiết và duyệt', 'Chia sẻ báo giá PDF'] },
  { slug: 'assistant', name: 'Trợ lý ERP', category: 'Trợ lý', icon: '✧', color: '#EAF2FF', shortDescription: 'Hỏi đáp và hỗ trợ nghiệp vụ ERP', description: 'Tra cứu dữ liệu và thực hiện các nghiệp vụ mà người dùng được cấp quyền.', capabilities: ['Hỏi đáp và tra cứu', 'Đề xuất thao tác phù hợp', 'Yêu cầu xác nhận khi thực hiện thao tác cần duyệt'] },
  { slug: 'analytics', name: 'Phân tích & Báo cáo', category: 'Báo cáo', icon: '▥', color: '#E9F8F1', shortDescription: 'Chỉ số tài chính và báo cáo vận hành', description: 'Xem báo cáo theo kỳ và lọc theo quyền truy cập của người dùng.', capabilities: ['Doanh thu, chi phí, lợi nhuận và công nợ', 'Lọc theo kỳ', 'Xuất báo cáo theo quyền'] },
  { slug: 'inventory', name: 'Kho & Sản phẩm', category: 'Hàng hóa', icon: '▦', color: '#FFF3E5', shortDescription: 'Sản phẩm và nghiệp vụ kho', description: 'Tra cứu hàng hóa và theo dõi biến động kho theo phạm vi được phân quyền.', capabilities: ['Danh mục sản phẩm và tồn kho', 'Nhập, xuất và điều chuyển', 'Kiểm kê và tra cứu theo quyền'] },
];

export function getModuleBySlug(slug?: string) {
  return moduleCatalog.find((module) => module.slug === slug);
}
