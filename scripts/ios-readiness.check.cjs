const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { publicOrigin, inspect, checkUrls } = require('./ios-readiness.cjs');

const effective = JSON.parse(execFileSync(process.execPath, [require.resolve('expo/bin/cli'), 'config', '--type', 'introspect', '--json'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, windowsHide: true }));
test('installed Expo plugins preserve all five localized permissions without background or HTTP access', () => {
  assert.equal(inspect(effective).permissions, 5);
  assert.ok(inspect(effective).collectedDataTypes >= 9);
});
test('catches plugin regressions that remove microphone permission or widen access', () => {
  for (const change of [
    plist => { delete plist.NSMicrophoneUsageDescription; },
    plist => { plist.NSAppTransportSecurity.NSAllowsArbitraryLoads = true; },
    plist => { plist.NSAppTransportSecurity.NSExceptionDomains.localhost = {}; },
    plist => { plist.UIBackgroundModes = ['audio']; },
    plist => { plist.NSLocationAlwaysUsageDescription = 'unused'; },
  ]) {
    const config = structuredClone(effective);
    change(config._internal.modResults.ios.infoPlist);
    assert.throws(() => inspect(config));
  }
});
test('release endpoints reject IP, local, credential-bearing and malformed origins', () => {
  assert.equal(publicOrigin('https://erp.example.com/'), 'https://erp.example.com');
  for (const value of ['http://erp.example.com', 'https://127.0.0.1', 'https://8.8.8.8', 'https://[::1]', 'https://erp.local', 'https://user:pass@erp.example.com', 'https://erp.example.com/api/v1', 'https://erp.example.com?token=private']) assert.throws(() => publicOrigin(value));
});
test('online readiness rejects offline databases, failed policy URLs and downgrade redirects', async () => {
  const original = global.fetch;
  const good = url => ({ ok: true, url, headers: new Headers({ 'content-type': url.endsWith('/health') ? 'application/json' : 'text/html' }), json: async () => ({ status: 'ok', services: { database: 'online (connected via MongoDB)' } }) });
  try {
    global.fetch = async url => good(url);
    await checkUrls({ EXPO_PUBLIC_API_URL: 'https://erp.example.com' });
    for (const result of [
      { ...good('https://erp.example.com/api/v1/health'), json: async () => ({ status: 'ok', services: { database: 'offline' } }) },
      { ...good('https://erp.example.com'), ok: false },
      { ...good('http://erp.example.com/api/v1/health') },
    ]) {
      global.fetch = async () => result;
      await assert.rejects(checkUrls({ EXPO_PUBLIC_API_URL: 'https://erp.example.com' }));
    }
  } finally { global.fetch = original; }
});
