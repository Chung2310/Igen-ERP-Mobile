#!/usr/bin/env bash
set -euo pipefail
: "${RUNNER_TEMP:?}"
: "${IOS_PROFILE_UUID:?}"
: "${IOS_BUILD_NUMBER:?}"
shopt -s nullglob
workspaces=(ios/*.xcworkspace)
[[ ${#workspaces[@]} -eq 1 ]] || { echo "Expected one iOS workspace" >&2; exit 1; }
workspace="${workspaces[0]}"
scheme="$(basename "$workspace" .xcworkspace)"
archive="$RUNNER_TEMP/erp-ios.xcarchive"
export_dir="$RUNNER_TEMP/erp-ios-export"
artifacts="$RUNNER_TEMP/erp-ios-artifacts"

# Signing is set on the application target, leaving CocoaPods targets untouched.
xcodebuild -workspace "$workspace" -scheme "$scheme" -configuration Release \
  -sdk iphoneos -destination 'generic/platform=iOS' \
  -derivedDataPath "$RUNNER_TEMP/erp-ios-derived" -archivePath "$archive" \
  archive 2>&1 | tee "$RUNNER_TEMP/erp-ios-archive.log"
xcodebuild -exportArchive -archivePath "$archive" -exportPath "$export_dir" \
  -exportOptionsPlist "$RUNNER_TEMP/erp-ios-signing/ExportOptions.plist" \
  2>&1 | tee "$RUNNER_TEMP/erp-ios-export.log"

ipas=("$export_dir"/*.ipa)
[[ ${#ipas[@]} -eq 1 ]] || { echo "Expected one exported IPA" >&2; exit 1; }
mkdir -p "$artifacts"
cp "${ipas[0]}" "$artifacts/ERP.ipa"
unzip -tq "$artifacts/ERP.ipa"
validation="$(mktemp -d "$RUNNER_TEMP/erp-ios-validate.XXXXXX")"
ditto -x -k "$artifacts/ERP.ipa" "$validation"
apps=("$validation"/Payload/*.app)
[[ ${#apps[@]} -eq 1 ]]
app="${apps[0]}"
plist="$app/Info.plist"
[[ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$plist")" == "$ERP_IOS_BUNDLE_IDENTIFIER" ]]
[[ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$plist")" == "$IOS_BUILD_NUMBER" ]]
[[ "$(/usr/libexec/PlistBuddy -c 'Print :DTPlatformName' "$plist")" == iphoneos ]]
executable="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$plist")"
xcrun lipo "$app/$executable" -verify_arch arm64
test -s "$app/main.jsbundle"
test -s "$app/embedded.mobileprovision"
codesign --verify --deep --strict "$app"
codesign -d --entitlements :- "$app" > "$RUNNER_TEMP/erp-ios-signing/signed-entitlements.plist" 2>/dev/null
python3 scripts/ios-signing.py verify-app
python3 scripts/verify-ios-bundle.py "$app" | tee "$artifacts/privacy-audit.json"
if [[ -d "$archive/dSYMs" ]]; then
  ditto -c -k --keepParent "$archive/dSYMs" "$artifacts/ERP-dSYMs.zip"
fi
