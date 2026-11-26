import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import type { CheckoutAttempt, RetailScope } from '@/features/retail/retailApi';

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(16);
}

function storageKey(scope: RetailScope, userId: string) {
  return `igen-retail-checkout-v1-${hash(`${scope.companyCode}:${scope.branchId}:${userId}`)}`;
}

function nativeFile(key: string) {
  return new File(Paths.document, `${key}.json`);
}

export async function readRetailCheckoutIntent(scope: RetailScope, userId: string): Promise<CheckoutAttempt | null> {
  const key = storageKey(scope, userId);
  const raw = Platform.OS === 'web'
    ? globalThis.localStorage?.getItem(key)
    : nativeFile(key).exists ? await nativeFile(key).text() : null;
  if (!raw) return null;
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null) return null;
  const attempt = parsed as Partial<CheckoutAttempt>;
  return typeof attempt.idempotencyKey === 'string' && typeof attempt.payload === 'object' && attempt.payload !== null
    ? attempt as CheckoutAttempt
    : null;
}

export async function saveRetailCheckoutIntent(scope: RetailScope, userId: string, attempt: CheckoutAttempt) {
  const key = storageKey(scope, userId);
  const serialized = JSON.stringify(attempt);
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(key, serialized);
    return;
  }
  const file = nativeFile(key);
  if (!file.exists) file.create({ intermediates: true });
  await file.write(serialized);
}

export async function clearRetailCheckoutIntent(scope: RetailScope, userId: string) {
  const key = storageKey(scope, userId);
  if (Platform.OS === 'web') {
    globalThis.localStorage?.removeItem(key);
    return;
  }
  const file = nativeFile(key);
  if (file.exists) file.delete();
}
