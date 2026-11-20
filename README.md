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
  core/                 # Hạ tầng dùng chung như kết nối API và lỗi
  features/             # Nghiệp vụ tách theo domain
    modules/            # Danh mục phân hệ và metadata
  theme/                # Màu sắc và token giao diện
```

### Thêm phân hệ

Thêm một định nghĩa vào `src/features/modules/moduleCatalog.ts` để phân hệ xuất hiện trong danh sách, tìm kiếm, trang tổng quan và route chi tiết. Khi bắt đầu làm nghiệp vụ, tạo thư mục `src/features/<ten-phan-he>/` để chứa màn hình, thành phần, kiểu dữ liệu và API riêng, rồi đăng ký màn hình trong `src/features/modules/featureScreenRegistry.ts`. Route chỉ giữ vai trò điều hướng; phân hệ chưa có màn hình riêng sẽ dùng màn hình khung chung.

Các service của phân hệ gọi API qua `src/core/network/apiClient.ts`, để chuẩn hóa cấu hình địa chỉ máy chủ, token truy cập và lỗi phản hồi. Sao chép `.env.example` thành `.env` rồi thay địa chỉ khi môi trường backend sẵn sàng.

## Phạm vi hiện tại

Đây là khung giao diện với dữ liệu mẫu. Đăng nhập thật, phân quyền từ máy chủ, API nghiệp vụ, kết nối kênh, giao dịch và thông báo đẩy chưa được nối. Tài liệu phạm vi gốc nằm tại `docs/Pham-vi-trien-khai-app-mobile-ERP.docx`.
