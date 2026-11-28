const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const { isIP } = require('node:net');

function publicOrigin(value) {
  const url = new URL(value || '');
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash
    || isIP(url.hostname.replace(/^\[|\]$/g, '')) || !url.hostname.includes('.')
    || /(^|\.)(localhost|local|internal|test|invalid|example)$/.test(url.hostname)) {
    throw new Error('Release URLs must be public HTTPS origins without credentials, IP addresses, paths or queries.');
  }
  return url.origin;
}

function inspect(config, root = process.cwd()) {
  const plist = config._internal?.modResults?.ios?.infoPlist;
  if (!plist) throw new Error('Expected Expo introspection, not only app.json.');
  const required = ['NSCameraUsageDescription', 'NSMicrophoneUsageDescription', 'NSPhotoLibraryUsageDescription', 'NSFaceIDUsageDescription', 'NSLocationWhenInUseUsageDescription'];
  for (const key of required) {
    if (typeof plist[key] !== 'string' || !plist[key].includes('ERP Mobile') || plist[key].length < 40) throw new Error(`Missing or vague Vietnamese permission: ${key}`);
  }
  for (const key of ['NSLocationAlwaysUsageDescription', 'NSLocationAlwaysAndWhenInUseUsageDescription', 'NSMotionUsageDescription', 'NSUserTrackingUsageDescription']) {
    if (plist[key]) throw new Error(`Unexpected permission for this release: ${key}`);
  }
  if (plist.UIBackgroundModes?.length) throw new Error('This release has no approved background execution feature.');
  const ats = plist.NSAppTransportSecurity;
  if (!ats || ats.NSAllowsArbitraryLoads !== false || ats.NSAllowsArbitraryLoadsInWebContent || Object.keys(ats.NSExceptionDomains || {}).length) throw new Error('Release ATS must require HTTPS without domain exceptions.');
  const manifest = config.ios?.privacyManifests;
  if (manifest?.NSPrivacyTracking !== false || manifest.NSPrivacyTrackingDomains?.length) throw new Error('Unexpected tracking declaration.');
  const types = manifest.NSPrivacyCollectedDataTypes || [];
  for (const suffix of ['UserID', 'PreciseLocation', 'PhotosorVideos', 'AudioData', 'OtherUserContent']) {
    if (!types.some(row => row.NSPrivacyCollectedDataType === `NSPrivacyCollectedDataType${suffix}` && row.NSPrivacyCollectedDataTypeLinked === true && row.NSPrivacyCollectedDataTypeTracking === false)) throw new Error(`Missing collected-data declaration: ${suffix}`);
  }
  const icon = fs.readFileSync(require('node:path').resolve(root, config.icon));
  if (icon.subarray(1, 4).toString() !== 'PNG' || icon.readUInt32BE(16) !== 1024 || icon.readUInt32BE(20) !== 1024 || icon[25] !== 2) throw new Error('App Store icon must be an opaque RGB 1024×1024 PNG.');
  return { permissions: required.length, collectedDataTypes: types.length };
}

async function checkUrls(env) {
  const api = publicOrigin(env.EXPO_PUBLIC_API_URL);
  const web = publicOrigin(env.EXPO_PUBLIC_ERP_WEB_URL || api);
  const urls = [[`${api}/api/v1/health`, 'application/json'], [`${web}/privacy-policy`, 'text/html'], [`${web}/terms-of-service`, 'text/html']];
  for (const [url, type] of urls) {
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok || new URL(response.url).protocol !== 'https:' || !response.headers.get('content-type')?.includes(type)) throw new Error(`Release endpoint unavailable or invalid: ${url}`);
    if (type === 'application/json') {
      const health = await response.json();
      if (health.status !== 'ok' || !health.services?.database?.startsWith('online')) throw new Error('Release backend database is unavailable.');
    }
    else await response.body?.cancel();
  }
}

if (require.main === module) {
  (async () => {
    // Load local Expo environment in this process as well as the introspection child.
    // GitHub builds keep EXPO_NO_DOTENV=1 and use explicit workflow variables.
    require('@expo/env').loadProjectEnv(process.cwd(), { mode: process.env.NODE_ENV || 'development', silent: true });
    const output = execFileSync(process.execPath, [require.resolve('expo/bin/cli'), 'config', '--type', 'introspect', '--json'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, windowsHide: true });
    const result = inspect(JSON.parse(output));
    if (process.argv.includes('--online')) await checkUrls(process.env);
    console.log(`iOS config passed: ${result.permissions} purpose strings; ${result.collectedDataTypes} collected data types; opaque icon; HTTPS; no unused background permissions.`);
    console.log('SDK manifests, signing and device behavior still require the macOS archive and physical-device checks.');
  })().catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { publicOrigin, inspect, checkUrls };
