import type { CrmConversation, CrmLead } from '@/features/crm/types';

export const mockConversations: CrmConversation[] = [
  {
    id: 'conv-001', contactName: 'Minh Long Trading', initials: 'ML', channel: 'Zalo', channelColor: '#E9F8F1',
    lastMessage: 'Bên mình cần báo giá cho đơn hàng tháng này.', updatedAt: '09:42', unreadCount: 2, assignedTo: 'Anh Nguyễn', mode: 'human',
    messages: [
      { id: 'm-001', sender: 'customer', text: 'Chào bạn, bên mình cần báo giá cho đơn hàng tháng này.', time: '09:36' },
      { id: 'm-002', sender: 'staff', text: 'Chào anh, em sẽ kiểm tra danh mục và gửi báo giá sớm ạ.', time: '09:39' },
      { id: 'm-003', sender: 'customer', text: 'Bên mình cần báo giá cho đơn hàng tháng này.', time: '09:42' },
    ],
  },
  {
    id: 'conv-002', contactName: 'Thu Hà Nguyễn', initials: 'TH', channel: 'Facebook', channelColor: '#EAF2FF',
    lastMessage: 'Cửa hàng có giao hàng tại Đà Nẵng không?', updatedAt: '09:18', unreadCount: 1, assignedTo: null, mode: 'ai',
    messages: [
      { id: 'm-004', sender: 'customer', text: 'Cửa hàng có giao hàng tại Đà Nẵng không?', time: '09:18' },
      { id: 'm-005', sender: 'ai', text: 'Dạ có hỗ trợ giao hàng toàn quốc. Bạn cho mình xin sản phẩm quan tâm để kiểm tra thời gian giao dự kiến nhé.', time: '09:18' },
    ],
  },
  {
    id: 'conv-003', contactName: 'Nội thất Phú An', initials: 'PA', channel: 'Instagram', channelColor: '#FDECF0',
    lastMessage: 'Mình đã nhận được tài liệu, cảm ơn bạn.', updatedAt: 'Hôm qua', unreadCount: 0, assignedTo: 'Lê Minh', mode: 'human',
    messages: [{ id: 'm-006', sender: 'customer', text: 'Mình đã nhận được tài liệu, cảm ơn bạn.', time: 'Hôm qua' }],
  },
  {
    id: 'conv-004', contactName: 'Hoàng Gia Decor', initials: 'HG', channel: 'Web chat', channelColor: '#FFF3E5',
    lastMessage: 'Cho tôi xin thông tin sản phẩm mới.', updatedAt: 'Thứ 2', unreadCount: 0, assignedTo: null, mode: 'ai',
    messages: [{ id: 'm-007', sender: 'customer', text: 'Cho tôi xin thông tin sản phẩm mới.', time: 'Thứ 2' }],
  },
];

export const mockLeads: CrmLead[] = [
  { id: 'lead-001', name: 'Nguyễn Thu Hà', company: 'Hà Thành Office', phone: '090 123 4567', email: 'ha@example.vn', source: 'Facebook', status: 'Mới', createdAt: 'Hôm nay' },
  { id: 'lead-002', name: 'Trần Minh Long', company: 'Minh Long Trading', phone: '091 234 5678', email: 'long@example.vn', source: 'Zalo', status: 'Đang chăm sóc', createdAt: 'Hôm nay' },
  { id: 'lead-003', name: 'Lê Thanh Phương', company: 'Phương Nam Co.', phone: '098 456 7890', email: 'phuong@example.vn', source: 'OCR', status: 'Đủ điều kiện', createdAt: 'Hôm qua' },
];

export const mockKnowledgeSources = ['Chính sách bán hàng.pdf', 'Bảng giá sản phẩm 2026.xlsx'];
