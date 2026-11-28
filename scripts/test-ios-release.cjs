const { spawnSync } = require('node:child_process');
const python = process.platform === 'win32' ? 'python' : 'python3';
for (const [command, args] of [
  [process.execPath, ['--test', 'scripts/prepare-app-version.check.cjs', 'scripts/prepare-ios-build.check.cjs', 'scripts/configure-ios-signing.check.cjs', 'scripts/ios-readiness.check.cjs']],
  [python, ['scripts/ios-signing.check.py']],
  [python, ['scripts/verify-ios-bundle.check.py']],
]) {
  const result = spawnSync(command, args, { stdio: 'inherit', windowsHide: true });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status || 1);
}
