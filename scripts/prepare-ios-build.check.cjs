const { test } = require("node:test");
const assert = require("node:assert/strict");
const { prepare } = require("./prepare-ios-build.cjs");
const env = {
  BUILD_PROFILE: "production",
  UPLOAD_TESTFLIGHT: "true",
  EXPO_PUBLIC_API_URL: "https://api.example.com/",
  ERP_IOS_BUNDLE_IDENTIFIER: "com.example.erp",
  APPLE_TEAM_ID: "A1B2C3D4E5",
  IOS_BUILD_NUMBER_BASE: "1000",
  GITHUB_RUN_NUMBER: "42",
  APP_VERSION: "1.0.0",
};
test("builds native config without Expo token or modifying EAS configuration", () => {
  assert.deepEqual(prepare(env), {
    EXPO_PUBLIC_API_URL: "https://api.example.com",
    EXPO_PUBLIC_ERP_WEB_URL: "https://api.example.com",
    IOS_BUILD_NUMBER: "1042",
    APP_VERSION: "1.0.0",
  });
});
test("accepts explicit build number when migrating from remote version counter", () => {
  assert.equal(prepare({ ...env, BUILD_NUMBER_INPUT: "5001", APP_VERSION: "1.0.1" }).IOS_BUILD_NUMBER, "5001");
});
test("allows Ad Hoc without TestFlight", () => {
  assert.equal(prepare({ ...env, BUILD_PROFILE: "preview", UPLOAD_TESTFLIGHT: "false" }).IOS_BUILD_NUMBER, "1042");
  assert.throws(() => prepare({ ...env, BUILD_PROFILE: "preview" }), /Only production/);
});
test("separates signing profile from backend environment and rejects accidental production staging", () => {
  assert.equal(prepare({ ...env, IOS_API_ENVIRONMENT: "staging", EXPO_PUBLIC_API_URL: "https://staging-erp.igentechnology.net" }).EXPO_PUBLIC_API_URL, "https://staging-erp.igentechnology.net");
  assert.throws(() => prepare({ ...env, IOS_API_ENVIRONMENT: "production", EXPO_PUBLIC_API_URL: "https://staging-erp.igentechnology.net" }), /cannot use the staging/);
  assert.equal(prepare({ ...env, IOS_API_ENVIRONMENT: "production" }).EXPO_PUBLIC_API_URL, "https://api.example.com");
  assert.throws(() => prepare({ ...env, IOS_API_ENVIRONMENT: "unknown" }), /IOS_API_ENVIRONMENT/);
});
test("normalizes a separate web origin and rejects unsafe policy URLs before signing", () => {
  assert.equal(prepare({ ...env, EXPO_PUBLIC_ERP_WEB_URL: "https://web.example.com/" }).EXPO_PUBLIC_ERP_WEB_URL, "https://web.example.com");
  for (const value of ["http://web.example.com", "https://web.example.com/private", "https://user:password@web.example.com"]) assert.throws(() => prepare({ ...env, EXPO_PUBLIC_ERP_WEB_URL: value }));
});
for (const field of [
  "BUILD_PROFILE",
  "EXPO_PUBLIC_API_URL",
  "ERP_IOS_BUNDLE_IDENTIFIER",
  "APPLE_TEAM_ID",
  "GITHUB_RUN_NUMBER",
  "IOS_BUILD_NUMBER_BASE",
  "UPLOAD_TESTFLIGHT",
  "APP_VERSION",
]) {
  test(`rejects missing ${field}`, () => assert.throws(() => prepare({ ...env, [field]: "" })));
}
for (const url of [
  "http://api.example.com",
  "https://localhost",
  "https://127.0.0.1",
  "https://10.1.2.3",
  "https://192.168.1.1",
  "https://[::1]",
  "https://a:b@example.com",
  "https://api.example.com/api",
  "https://api.example.com/?q=x",
  "https://api.example.com/#hash",
]) {
  test(`rejects non-public API origin ${url}`, () =>
    assert.throws(() => prepare({ ...env, EXPO_PUBLIC_API_URL: url })));
}
test("rejects injected config, invalid versions and overflowing build numbers", () => {
  for (const input of [
    { BUILD_NUMBER_INPUT: "1\nBAD=value" },
    { BUILD_NUMBER_INPUT: "0" },
    { BUILD_NUMBER_INPUT: "2100000001" },
    { IOS_BUILD_NUMBER_BASE: "2100000000" },
    { ERP_IOS_BUNDLE_IDENTIFIER: "a\nb" },
    { APP_VERSION: "1.0-beta" },
  ]) {
    assert.throws(() => prepare({ ...env, ...input }));
  }
});
