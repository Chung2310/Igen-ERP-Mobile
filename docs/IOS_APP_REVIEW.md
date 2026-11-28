# Hồ sơ và kiểm thử trước App Review

## Ghi chú review có thể dùng sau khi điền thông tin thật

ERP Mobile phục vụ người dùng thuộc các doanh nghiệp đã có tài khoản ERP. Quản trị viên doanh nghiệp cấp tài khoản và quyền; ứng dụng không có đăng ký cá nhân công khai. Không có social login. Bản hiện tại không bán/nâng cấp gói AI trong ứng dụng; chức năng phụ thuộc tenant và quyền được cấp.

Tài khoản review và mật khẩu: nhập trong vùng App Review Information bảo mật của App Store Connect, không commit vào repo. Chuẩn bị tài khoản user và moderator/admin trên **tenant thử riêng** có dữ liệu mẫu hợp lệ; nếu cần OTP hoặc hướng dẫn đăng nhập đặc biệt, cung cấp đầy đủ cho reviewer. Backend phải hoạt động suốt thời gian review. Không giả lập quyền truy cập chỉ dành riêng cho Apple.

Các đường dẫn để reviewer kiểm tra:

1. Đăng nhập → Hộp thư → mở cuộc trò chuyện → menu tin nhắn → Báo cáo/Chặn. Tài khoản thử thứ hai dùng để xác minh tin bị chặn không xuất hiện và không gửi/tương tác được qua chat riêng. Tài khoản có `chat-moderation:manage` xem hàng đợi báo cáo và ẩn nội dung.
2. Tài khoản → Quyền riêng tư → xem thông tin chia sẻ AI. Thử từ chối, dùng nghiệp vụ không có AI, đồng ý rồi sử dụng AI, sau đó rút lại. Không có dữ liệu được gửi tới AI trước đồng ý. Thử lại tác vụ sau khi rút phải yêu cầu consent mới.
3. Tài khoản → Quyền riêng tư → Xóa tài khoản. Dùng **tài khoản thử dùng một lần**, xác nhận mật khẩu; quản trị viên cuối cùng phải chọn người tiếp nhận nếu còn đồng nghiệp. Sau yêu cầu, tài khoản mất quyền truy cập và dữ liệu riêng được xử lý; nhân sự hoàn tất rà soát dữ liệu cần giữ/ngoài hệ thống trước khi xác nhận xóa xong.
4. Tài khoản → Trợ giúp và hỗ trợ có email/số liên hệ. Login có link chính sách/điều khoản; xác minh thông tin công khai là chính xác và nhóm hỗ trợ thực sự nhận được yêu cầu.

## Phải hoàn thành bằng dữ liệu và thiết bị thực tế

| Việc | Bằng chứng cần giữ |
| --- | --- |
| Native CI và signing check | Link run thành công; profile ERP/team đúng; Xcode ≥26, iOS SDK ≥26 |
| iPhone và iPad | Cài Ad Hoc/TestFlight; mở app mới, restore session, mất mạng, lỗi API, logout; không crash hoặc màn bị che |
| Quyền hệ thống | Fresh install: camera/micro/photos/location/Face ID chỉ xuất hiện đúng lúc; từ chối, Photos Limited, location Approximate; nghiệp vụ khác vẫn hoạt động |
| Background/recording | Thử vào nền/khóa máy khi ghi âm và quay video; không tiếp tục thu không mong muốn; audio mode và chỉ báo trở về đúng trạng thái |
| Accessibility | VoiceOver tên nút/trường, focus dialog, Dynamic Type, bàn phím ngoài; iPad split view và portrait/landscape |
| Chat safety | Report/Block qua API/socket, người bị chặn, moderator queue và SLA thực tế; hiện chat file mới bị tạm ngừng, không quảng bá là đã hỗ trợ |
| AI consent | Từ chối/đồng ý/rút, user khác/tenant khác, job đang chờ; kiểm tra provider/model production khớp disclosure |
| Xóa tài khoản | Tài khoản thử thường + admin cuối; worker retry, external storage, backup/restore; lưu mã yêu cầu và bằng chứng xử lý |
| IPv6 | Đăng nhập, API, media, socket trên DNS64/NAT64; không dùng IP literal cho backend |
| Privacy | Xcode Privacy Report, cảnh báo processing App Store Connect, manifest từng SDK, App Privacy labels và chính sách thực tế khớp nhau |
| Metadata | Tên/description/screenshot iPhone và iPad lấy từ bản thật; Support URL, Privacy Policy URL, contact review, age-rating questionnaire hiện hành, export compliance và thông tin quyền nội dung |
| Hoàn thiện nghiệp vụ | Đi hết từng module hiển thị với tài khoản review; bỏ dữ liệu mẫu/màn khung/nút chưa thực hiện; không chỉ dựa vào README hoặc việc module có component |

Các ô trên chưa được coi là hoàn thành chỉ vì script chạy qua. Windows không xác minh được permission prompt của iOS, VoiceOver, signing hoặc thiết bị thật. Không tự đặt age rating, retention deadline hay đánh dấu App Store Connect thay người chịu trách nhiệm.

## Phần vận hành còn cần chủ sản phẩm hoàn thiện

- Phân công người xử lý báo cáo và theo dõi hạn. Bộ lọc text hiện là denylist tối thiểu; cần kiểm duyệt phù hợp mức rủi ro thực tế. Muốn bật lại tệp chat phải có scanner và quy trình xử lý nội dung trước.
- Công bố thời hạn retention/backup có căn cứ, quy trình xóa ở nhà cung cấp và áp dụng lại yêu cầu khi restore. Không tick review checkbox khi chưa thực hiện.
- Xác định hình thức phân phối phù hợp đối tượng B2B thực tế (public/unlisted/custom); không suy ra chỉ từ việc app có đăng nhập. Xác minh ngoại lệ enterprise services theo 3.1.3(c) trước khi mô tả mô hình thương mại.
- Cấu hình team/variables/secrets ERP trên GitHub theo [IOS_BUILD.md](../IOS_BUILD.md); tạo app record `vn.igen.erp.mobile`; không dùng credentials của ứng dụng khác.

Nguồn chính: [App Review Guidelines 1.2, 1.5, 2.1, 3.1 và 5.1](https://developer.apple.com/app-store/review/guidelines/), [yêu cầu SDK và age rating](https://developer.apple.com/news/upcoming-requirements/), [hỗ trợ IPv6](https://developer.apple.com/support/ipv6/).
