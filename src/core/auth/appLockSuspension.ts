let appLockSuspensionCount = 0;

/** Keep temporary system activities such as the document picker from locking the app. */
export async function withAppLockSuspended<T>(operation: () => Promise<T>): Promise<T> {
  appLockSuspensionCount += 1;
  try {
    return await operation();
  } finally {
    appLockSuspensionCount = Math.max(0, appLockSuspensionCount - 1);
  }
}

export function isAppLockSuspended() {
  return appLockSuspensionCount > 0;
}
