const fs = require("node:fs");
const { resolveAppVersion } = require("./prepare-app-version.cjs");
const { publicOrigin } = require("./ios-readiness.cjs");

function prepare(env) {
  if (!["preview", "production"].includes(env.BUILD_PROFILE)) throw new Error("Invalid BUILD_PROFILE");
  if (env.IOS_API_ENVIRONMENT && !["staging", "production"].includes(env.IOS_API_ENVIRONMENT)) throw new Error("Invalid IOS_API_ENVIRONMENT");
  const api = new URL(publicOrigin((env.EXPO_PUBLIC_API_URL || "").trim()));
  if (env.IOS_API_ENVIRONMENT === "production" && api.hostname === "staging-erp.igentechnology.net") throw new Error("Production backend cannot use the staging ERP URL.");
  const webOrigin = publicOrigin((env.EXPO_PUBLIC_ERP_WEB_URL || "").trim() || api.origin);
  if (
    api.protocol !== "https:" ||
    api.username ||
    api.password ||
    api.pathname !== "/" ||
    api.search ||
    api.hash ||
    /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\]$)/i.test(api.hostname)
  ) {
    throw new Error("EXPO_PUBLIC_API_URL must be a public HTTPS origin without credentials, path or query");
  }
  if (!/^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(env.ERP_IOS_BUNDLE_IDENTIFIER || ""))
    throw new Error("Invalid ERP_IOS_BUNDLE_IDENTIFIER");
  if (!/^[A-Z0-9]{10}$/.test(env.APPLE_TEAM_ID || "")) throw new Error("Invalid APPLE_TEAM_ID");
  const integer = (value) => /^\d+$/.test(String(value || "")) && Number.isSafeInteger(Number(value));
  let build = (env.BUILD_NUMBER_INPUT || "").trim();
  if (!build) {
    if (!integer(env.IOS_BUILD_NUMBER_BASE) || !integer(env.GITHUB_RUN_NUMBER) || Number(env.GITHUB_RUN_NUMBER) < 1)
      throw new Error("Set integer IOS_BUILD_NUMBER_BASE and GITHUB_RUN_NUMBER");
    build = String(Number(env.IOS_BUILD_NUMBER_BASE) + Number(env.GITHUB_RUN_NUMBER));
  }
  if (!/^[1-9]\d*$/.test(build) || Number(build) > 2100000000) throw new Error("Invalid iOS build number");
  const version = resolveAppVersion(env);
  if (!["true", "false"].includes(env.UPLOAD_TESTFLIGHT)) throw new Error("Invalid UPLOAD_TESTFLIGHT");
  if (env.BUILD_PROFILE !== "production" && env.UPLOAD_TESTFLIGHT === "true")
    throw new Error("Only production builds can be uploaded to TestFlight");
  return { EXPO_PUBLIC_API_URL: api.origin, EXPO_PUBLIC_ERP_WEB_URL: webOrigin, IOS_BUILD_NUMBER: build, APP_VERSION: version };
}
if (require.main === module) {
  const output = prepare(process.env);
  if (!process.env.GITHUB_ENV) throw new Error("Run this helper in GitHub Actions");
  fs.appendFileSync(
    process.env.GITHUB_ENV,
    Object.entries(output)
      .map(([k, v]) => `${k}=${v}\n`)
      .join(""),
  );
  console.log(`Native iOS ${process.env.BUILD_PROFILE} build number: ${output.IOS_BUILD_NUMBER}`);
  console.log(`App version (APP_VERSION variable): ${output.APP_VERSION}`);
}
module.exports = { prepare };
