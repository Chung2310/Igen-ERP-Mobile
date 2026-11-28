# Khai báo quyền riêng tư cho iOS

Ngày đối chiếu source: 28/11/2026. Đây là bản khai báo theo source hiện tại, cần đối chiếu hạ tầng, SDK và dịch vụ thực tế trước khi nhập App Store Connect. Không coi file manifest là thay thế cho App Privacy labels hoặc chính sách công khai.

## Dữ liệu đã khai báo ở app manifest

`expo.ios.privacyManifests` trong `app.json` khai báo các nhóm bên dưới là **liên kết với người dùng**, dùng cho **App Functionality**, **không dùng tracking**. Các luồng tùy chọn vẫn cần khai báo nếu có thể thu thập trong app phát hành.

| Nhóm Apple | Căn cứ trong sản phẩm |
| --- | --- |
| Name, Email Address, Phone Number, Physical Address | Hồ sơ tài khoản, thông tin liên hệ và dữ liệu ERP người dùng nhập/được phân quyền |
| User ID | Đăng nhập, phân quyền theo doanh nghiệp, chat và gán tác vụ |
| Precise Location | Chấm công và lấy tọa độ chi nhánh theo thao tác người dùng |
| Photos or Videos | Ảnh đại diện, tài liệu OCR, ảnh/video người dùng chọn đính kèm công việc |
| Audio Data | Ghi chú thoại/âm thanh video đính kèm công việc; chép lời khi người dùng chọn và đồng ý AI |
| Other User Content | Tin nhắn, prompt/tệp AI, ghi chú, tài liệu và nội dung ERP được tải lên |

Face ID được xử lý qua LocalAuthentication của hệ điều hành; app không nhận ảnh mặt hoặc mẫu sinh trắc từ Face ID. Việc người dùng tự tải ảnh không phải dữ liệu Face ID. Source hiện không tích hợp SDK quảng cáo/attribution và không xin ATT. Nếu hạ tầng hoặc SDK mới dùng dữ liệu để tracking theo định nghĩa Apple, phải đánh giá lại cả manifest, ATT và App Privacy trước khi phát hành; không chỉ đổi một cờ.

Không tự khai báo “Data Not Collected”. Hãy xác minh thêm dữ liệu diagnostic/server logging, metadata file, nghiệp vụ tài chính/nhạy cảm, các module bật ở tenant phát hành và nhà cung cấp thực tế. Nếu có thêm category/purpose, cập nhật source manifest và câu trả lời App Store Connect cùng nhau. Không đánh dấu các lựa chọn phân tích/quảng cáo khi chưa có căn cứ.

## Required-reason APIs và SDK

App không có native code tự viết gọi required-reason APIs, nên không chép reason mẫu tùy ý vào manifest app. Các dependency hiện có manifest riêng: React Native khai báo UserDefaults/FileTimestamp; expo-file-system khai báo FileTimestamp/DiskSpace. CocoaPods/React Native tổng hợp reason vào native project. Các file này phải đi vào bundle thực tế; helper kiểm tra app đã build và từ chối khi category đã biết bị mất. Xcode Privacy Report vẫn phải được rà lại cho toàn bộ dependency và binary SDK/signature.

## Quyền hệ thống

- Camera: quét mã kho, OCR tài liệu và ảnh/video công việc.
- Photo Library: chỉ nội dung người dùng chọn cho ảnh đại diện, OCR hoặc công việc.
- Microphone: ghi chú thoại/video công việc; chỉ xin quyền khi người dùng bắt đầu thao tác.
- Location When In Use và lời giải thích full accuracy: chấm công, tọa độ chi nhánh. Không xin Always hoặc motion; không bật location nền.
- Face ID: đăng nhập, mở khóa và xác nhận chấm công. Không ép người dùng bật Face ID để dùng tài khoản.

Các plugin camera/image-picker/audio cùng khai báo lời giải thích micro để tránh plugin này xóa quyền của plugin khác. `ios:readiness` kiểm tra **kết quả introspection**, không chỉ đọc chuỗi trong `app.json`. Audio background recording/playback đều tắt. Bản phát hành bật ATS yêu cầu HTTPS, không mở HTTP toàn cục hoặc exception localhost.

## Mã hóa và AI

`ITSAppUsesNonExemptEncryption=false` dựa trên luồng hiện tại sử dụng HTTPS và cơ chế bảo mật do hệ điều hành cung cấp. Người phát hành vẫn phải đánh giá nghĩa vụ export compliance thực tế; thay đổi thuật toán/mã hóa riêng phải được rà lại trước upload.

AI dùng consent phiên bản theo tài khoản/doanh nghiệp, có quyền từ chối/rút lại. Kiểm tra danh sách người nhận trong backend so với model, route và subprocessors production. Acceptance không thay thế quyền chia sẻ dữ liệu người khác. Chưa gửi yêu cầu tới Apple hoặc xác nhận hợp đồng với nhà cung cấp trong lượt triển khai này.

Xóa tài khoản kết thúc tự động ở `review_required`. Nhân sự vận hành phải thực sự xử lý dữ liệu external/shared/backup và nghĩa vụ lưu trữ trước khi đánh dấu hoàn tất. Không ghi thời hạn backup hoặc khẳng định xóa toàn bộ ngay lập tức khi chưa có quy trình thực tế.

Nguồn: [App Privacy details](https://developer.apple.com/app-store/app-privacy-details/), [required-reason APIs](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api), [App Review 5.1](https://developer.apple.com/app-store/review/guidelines/#privacy).
