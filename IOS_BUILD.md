# Build iOS trên GitHub macOS

Repo này là repository Git riêng **Igen-ERP-Mobile**. Hai workflow nằm trong `.github/workflows/` của repo mobile; không chạy từ repo ERP backend. Luồng dùng Expo prebuild → CocoaPods → Xcode archive/export, không dùng EAS Build hoặc EAS Submit.

## Kiểm tra không cần credentials

`iOS native checks` chỉ chạy khi push nhánh `production` hoặc chạy thủ công trên nhánh `production`; không build từ pull request hay `develop`. Cả hai workflow đều có điều kiện ở cấp job `github.ref == 'refs/heads/production'`, nên chọn nhánh khác trong Run workflow sẽ bị bỏ qua trước khi cấp runner hoặc đọc signing secrets. Runner `macos-26` cài Node 22, kiểm tra TypeScript, test helper, cấu hình Expo đã áp dụng plugin, sau đó build Release cho simulator và kiểm tra privacy manifest **trong app đã build**. Không cài simulator build lên iPhone; không dùng kết quả này thay cho kiểm thử thiết bị thật.

Trên Windows/macOS, chạy:

```sh
npm ci
npm run typecheck
npm run test:ios-release
npm run ios:readiness
```

Test signing dùng dữ liệu tạm/mocks; ca OpenSSL thật tự bỏ qua khi không có executable. Các lệnh `security`, `codesign`, CocoaPods và Xcode chỉ được xác minh đầy đủ khi chạy trên macOS. `expo export --platform ios --no-bytecode` chỉ kiểm tra JavaScript/assets.

## Cấu hình repository một lần

GitHub repository mobile → Settings → Secrets and variables → Actions.

| Repository variable | Giá trị |
| --- | --- |
| `APP_VERSION` | Mặc định `1.0.0`; phải trùng phiên bản dự kiến trên App Store Connect |
| `APPLE_TEAM_ID` | Bắt buộc, team sở hữu Bundle ID `com.igen.erp` |
| `STAGING_API_URL` | Mặc định `https://staging-erp.igentechnology.net`, dùng khi chọn backend `staging` |
| `STAGING_WEB_URL` | Tùy chọn cho staging; bỏ trống để dùng API origin |
| `EXPO_PUBLIC_API_URL` | Bắt buộc khi chọn backend `production`, HTTPS origin có backend đã deploy và DB hoạt động; không có `/api/v1`, query, IP hoặc credentials |
| `EXPO_PUBLIC_ERP_WEB_URL` | Web production có `/privacy-policy` và `/terms-of-service`; bỏ trống để dùng API origin |
| `IOS_BUILD_NUMBER_BASE` | Mặc định `1000`; base + số workflow run phải lớn hơn build cao nhất đã upload |

Đã tạo `.env` local từ cấu hình staging, web cùng origin, version `1.0.0`, Bundle ID `com.igen.erp`, build local `1`; `.env` được Git bỏ qua. Không có URL production hoặc team mặc định lấy từ LuxCare. Workflow tắt dotenv và chọn backend từ input `api_environment`, mặc định staging; khi chọn production phải có URL production riêng và helper từ chối URL staging ERP đã biết. Các giá trị `EXPO_PUBLIC_*` được nhúng trong app và không phải nơi lưu secret. Bản native yêu cầu HTTPS; dùng staging/tunnel HTTPS khi thử API local.

| GitHub Secret | Nội dung |
| --- | --- |
| `IOS_DISTRIBUTION_P12_BASE64` | Base64 Apple Distribution `.p12`, gồm certificate **và private key** |
| `IOS_DISTRIBUTION_P12_PASSWORD` | Mật khẩu P12; có thể rỗng nếu file không đặt mật khẩu |
| `IOS_APP_STORE_PROFILE_BASE64` | Base64 profile App Store Connect cho đúng team và Bundle ID ERP |
| `IOS_ADHOC_PROFILE_BASE64` | Chỉ cần cho preview: profile Ad Hoc có UDID thiết bị thử |
| `APP_STORE_CONNECT_API_KEY_BASE64` | Base64 key `.p8`; chỉ cần khi chọn upload TestFlight |
| `APP_STORE_CONNECT_API_KEY_ID` | Key ID của key App Store Connect |
| `APP_STORE_CONNECT_ISSUER_ID` | Issuer ID tương ứng |

Giữ credentials ngoài repository; không gửi qua chat hoặc ghi vào log. Không dùng profile/team của ứng dụng LuxCare. Chuyển cơ chế build không yêu cầu revoke certificate hiện có. ERP chưa tích hợp native push, nên không bắt buộc profile có APNs entitlement. Nếu bổ sung push/extension, cập nhật capability, profile và kiểm tra target trước khi phát hành.

## Chạy build có ký

1. Run **Build iOS IPA (GitHub macOS)**, chọn **Use workflow from: production**, chọn `signing_check_only=true`. Nhánh Git `production` là điều kiện bắt buộc, độc lập với lựa chọn backend và signing profile. Helper kiểm tra hạn profile, team, explicit Bundle ID, certificate trong P12 có nằm trong profile và private key có sử dụng được không. Credentials chỉ vào keychain tạm trên runner và được dọn trong bước `always()`.
2. Run mới với `api_environment=staging` cho backend thử hoặc `production` cho backend thật. Đây là lựa chọn riêng với `profile=preview` (Ad Hoc) hoặc `profile=production` (ký App Store/TestFlight). Có thể ký App Store/TestFlight nhưng dùng backend staging để thử. `upload_testflight` mặc định **false**. Không chọn signing-only nếu muốn có IPA.
3. Workflow kiểm tra backend health + DB, URL chính sách, quyền native, icon và manifest; sinh native project mới; chỉ cấu hình ký app target, không ép signing lên Pods; archive/export; xác minh arm64, JS bundle, signature, entitlements, version, SDK và manifest trong IPA.
4. Tải artifact `ERP-ios-...`: `ERP.ipa`, dSYMs và `privacy-audit.json`. Artifact log nằm riêng; thư mục keychain/profile/API key không được upload. Artifact hết hạn sau 7 ngày.
5. Sau khi hoàn thành checklist thiết bị và hồ sơ review trong [docs/IOS_APP_REVIEW.md](docs/IOS_APP_REVIEW.md), tạo Run mới và bật `upload_testflight=true` nếu muốn upload. Theo dõi processing trong App Store Connect; upload không tự gửi App Review hoặc phát hành công khai.

Số build mặc định = base + `github.run_number`. Rerun cùng workflow giữ nguyên số; tạo Run mới hoặc nhập `build_number` lớn hơn để tránh duplicate. Nếu dùng override cao, tăng base cho các lần sau. Như cấu hình LuxCare hiện có, cả hai workflow chọn `macos-26` và pin `/Applications/Xcode_26.4.1.app/Contents/Developer`; build dừng nếu toolchain không tồn tại, đồng thời kiểm tra Xcode ≥26 và SDK ≥26 trong app build. Khi image runner đổi hoặc dependency cần bản Xcode cao hơn, cập nhật cả hai workflow và chạy lại native checks.

Danh sách thông tin cần cung cấp và cách lưu từng loại nằm trong [docs/IOS_SIGNING_SETUP.md](docs/IOS_SIGNING_SETUP.md). Cấu hình local không tự tạo GitHub Variables/Secrets; chúng cần được thiết lập riêng trên repository mobile trước khi chạy build có ký.

## Phạm vi kiểm tra

`ios:readiness -- --online` kiểm tra GET health và URL chính sách không cần tài khoản; không chứng minh nội dung trang đã đúng hoặc privacy backend đã deploy. QA phải đăng nhập tài khoản thử để xác minh Report/Block, consent và xóa tài khoản. Không dùng tài khoản thật để thử xóa.

Các kiểm tra manifest phát hiện thiếu file, mất loại dữ liệu, mất các category API đã biết, tracking ngoài dự kiến hoặc reason rỗng/sai định dạng. Chúng không chứng minh mọi required-reason API đã được phát hiện hay reason là đúng cho mọi SDK; tiếp tục kiểm tra Xcode Privacy Report và cảnh báo từ App Store Connect. Xem [docs/IOS_PRIVACY.md](docs/IOS_PRIVACY.md).

Tham chiếu: [yêu cầu SDK Apple](https://developer.apple.com/news/upcoming-requirements/), [privacy manifest Apple](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files), [Expo privacy manifest](https://docs.expo.dev/guides/apple-privacy/).
