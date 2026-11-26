import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

function stableKey(companyCode: string, branchId: string) {
  const source = `${companyCode.trim().toUpperCase()}:${branchId}`;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `igen_pos_terminal_v1_${(hash >>> 0).toString(16)}`;
}

function createTerminalId() {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  return cryptoApi?.randomUUID?.() || `mobile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function getRetailTerminalId(companyCode: string, branchId: string): Promise<string> {
  const key = stableKey(companyCode, branchId);
  if (Platform.OS === 'web') {
    try {
      const existing = globalThis.localStorage?.getItem(key)?.trim();
      if (existing) return existing;
      const terminalId = createTerminalId();
      globalThis.localStorage?.setItem(key, terminalId);
      return terminalId;
    } catch {
      return 'default';
    }
  }

  try {
    const existing = (await SecureStore.getItemAsync(key))?.trim();
    if (existing) return existing;
    const terminalId = createTerminalId();
    await SecureStore.setItemAsync(key, terminalId, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    return terminalId;
  } catch {
    return 'default';
  }
}
