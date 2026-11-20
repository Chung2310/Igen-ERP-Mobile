# ERP Mobile

Khung ứng dụng mobile cho 15 phân hệ thuộc phạm vi đợt 1. Ứng dụng dùng Expo, React Native, TypeScript và Expo Router để chạy trên Android/iOS.

## Chạy ứng dụng

```bash
npm install
npm start
```

Mở ứng dụng bằng Expo Go hoặc development build, hoặc chạy `npm run android` / `npm run ios` với môi trường native tương ứng đã được thiết lập. `npm run typecheck` kiểm tra kiểu TypeScript.

## Cấu trúc

```text
src/
  app/                  # Route và điều hướng Expo Router
    (tabs)/             # Tổng quan, phân hệ, hộp thư, tài khoản
    modules/[slug].tsx  # Trang khung dùng chung cho phân hệ
  components/           # Thành phần giao diện dùng lại
  core/
    auth/               # Đăng nhập ERP, phiên người dùng và access token an toàn
    network/            # Kết nối API và chuẩn hóa lỗi
  features/             # Nghiệp vụ tách theo domain
    modules/            # Danh mục phân hệ và metadata
  theme/                # Màu sắc và token giao diện
```

### Thêm phân hệ

Thêm một định nghĩa vào `src/features/modules/moduleCatalog.ts` để phân hệ xuất hiện trong danh sách, tìm kiếm, trang tổng quan và route chi tiết. Khi bắt đầu làm nghiệp vụ, tạo thư mục `src/features/<ten-phan-he>/` để chứa màn hình, thành phần, kiểu dữ liệu và API riêng, rồi đăng ký màn hình trong `src/features/modules/featureScreenRegistry.ts`. Route chỉ giữ vai trò điều hướng; phân hệ chưa có màn hình riêng sẽ dùng màn hình khung chung.

Các service gọi API ERP qua `src/core/network/apiClient.ts`. `EXPO_PUBLIC_API_URL` nhận origin của máy chủ; client tự nối `/api/v1`. Sao chép `.env.example` thành `.env` rồi chọn máy chủ phù hợp với thiết bị. Khi chạy Android emulator với backend cục bộ, thường dùng `http://10.0.2.2:3000`; trên iOS simulator dùng `http://localhost:3000`; điện thoại thật cần dùng địa chỉ LAN hoặc staging có thể truy cập.

Đăng nhập gọi `POST /api/v1/auth/login`, khôi phục hồ sơ qua `GET /api/v1/auth/me` và làm mới access token qua `POST /api/v1/auth/refresh-token`. Access token được lưu bằng SecureStore trên thiết bị. Tài khoản superadmin cần bước xác thực bổ sung chưa được hỗ trợ trong mobile.

## Phạm vi hiện tại

Đăng nhập và kiểm tra kết nối máy chủ ERP đã được nối. Các màn hình nghiệp vụ CRM, Kho tri thức, Tổng quan và những phân hệ còn lại vẫn đang được tích hợp lần lượt; các màn hình chưa hoàn tất API tiếp tục hiển thị dữ liệu mẫu. Tài liệu phạm vi gốc nằm tại `docs/Pham-vi-trien-khai-app-mobile-ERP.docx`.
