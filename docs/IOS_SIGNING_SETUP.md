# Thông tin còn thiếu để ký iOS ERP

Repository: `Chung2310/Igen-ERP-Mobile`. Bundle ID đang cấu hình: **`vn.igen.erp.mobile`**. Cách build giống LuxCare: GitHub macOS + Expo prebuild + CocoaPods + Xcode archive/export; không cần EAS token hay quota EAS Build.

## Phần đã cấu hình trong source/local

- `.env` local: API và web staging `https://staging-erp.igentechnology.net`; app version `1.0.0`; build local `1`; Bundle ID ERP như trên. File được Git bỏ qua.
- Workflow mặc định backend staging, version `1.0.0`, build CI = `1000 + github.run_number`; production backend phải có URL riêng.
- Runner `macos-26`, pin Xcode `26.4.1` theo cấu hình LuxCare đã đọc. Chưa xác minh bằng một run macOS thực tế cho ERP.
- App Store signing và Ad Hoc là hai profile riêng. Upload TestFlight mặc định tắt. Không có native push hoặc extension cần profile bổ sung trong bản hiện tại.

## Cần chủ tài khoản Apple cung cấp

| Thông tin | Nơi cấu hình | Khi nào cần |
| --- | --- | --- |
| **Apple Team ID** gồm 10 ký tự | GitHub Variable `APPLE_TEAM_ID` | Mọi build có ký, kể cả signing check |
| **Apple Distribution P12** chứa certificate và private key | GitHub Secret `IOS_DISTRIBUTION_P12_BASE64` | Mọi build có ký |
| **Mật khẩu P12** | GitHub Secret `IOS_DISTRIBUTION_P12_PASSWORD` | Đi cùng đúng file P12; có thể rỗng nếu P12 không đặt mật khẩu |
| **Provisioning profile App Store Connect** cho đúng team và `vn.igen.erp.mobile`, chọn certificate tương ứng P12 | GitHub Secret `IOS_APP_STORE_PROFILE_BASE64` | Ký App Store/TestFlight (`profile=production`) |
| **Provisioning profile Ad Hoc**, kèm UDID iPhone/iPad thử và certificate tương ứng P12 | GitHub Secret `IOS_ADHOC_PROFILE_BASE64` | Chỉ khi muốn IPA cài trực tiếp lên thiết bị đã đăng ký (`profile=preview`) |
| **App Store Connect API private key `.p8`** | GitHub Secret `APP_STORE_CONNECT_API_KEY_BASE64` | Chỉ khi bật upload TestFlight |
| **Key ID** của API key | GitHub Secret `APP_STORE_CONNECT_API_KEY_ID` | Đi cùng đúng `.p8` |
| **Issuer ID** của team API key | GitHub Secret `APP_STORE_CONNECT_ISSUER_ID` | Đi cùng đúng `.p8` |

Team ID và Bundle ID có thể gửi dạng text. Với P12, P8, profile và password, hãy nhập trực tiếp vào **GitHub → repository mobile → Settings → Secrets and variables → Actions** hoặc cung cấp đường dẫn file local riêng để cấu hình; không dán nội dung private key/password vào chat. Base64 là biểu diễn file, không phải mã hóa bảo vệ secret.

Ví dụ PowerShell chuyển file vào clipboard để dán vào Secret, không in ra terminal:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\signing\ERP_Distribution.p12')) | Set-Clipboard
[Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\signing\ERP_AppStore.mobileprovision')) | Set-Clipboard
[Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\signing\AuthKey_KEYID.p8')) | Set-Clipboard
```

Mỗi lệnh thay nội dung clipboard; dán vào Secret tương ứng trước khi chạy lệnh tiếp. Giữ file gốc ngoài repository. Không cần tài khoản/mật khẩu Apple ID cho luồng API key này. Distribution certificate có thể được chủ team sử dụng cho nhiều ứng dụng cùng team nếu hợp lệ; provisioning profile phải là profile ERP khớp Bundle ID, không dùng profile LuxCare.

## Cần xác nhận thêm, không phải signing secret

1. Bundle ID `vn.igen.erp.mobile` đã đăng ký trên team nào? Nếu đã có app record dùng Bundle ID khác, báo ID thật trước khi tạo profile.
2. Nếu ERP đã từng upload lên App Store Connect: version và số build cao nhất hiện tại để đặt `APP_VERSION`/`IOS_BUILD_NUMBER_BASE` phù hợp. Nếu app mới, source đang chuẩn bị `1.0.0` và base `1000`.
3. Nếu muốn build backend production: URL API production và origin web chứa chính sách/điều khoản. Hiện chỉ staging được cấu hình; không tự coi staging là production.
4. Nếu muốn cài Ad Hoc: UDID từng iPhone/iPad phải nằm trong profile. Nếu chỉ thử qua TestFlight, không cần danh sách UDID hoặc Ad Hoc profile.

## Khi đã đủ dữ liệu

Thiết lập Team ID + P12/password + profile thích hợp, đưa workflow/source mobile lên GitHub, chạy signing check trước. Tiếp đó build IPA staging để thử thiết bị. Chỉ bật upload TestFlight khi có bộ API key đầy đủ và app record ERP đã được tạo trong App Store Connect. Chưa có thông tin xác nhận Variables/Secrets trên GitHub đã được điền trong phiên setup local này.
