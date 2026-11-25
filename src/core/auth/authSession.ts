import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'igen-erp-mobile.access-token';
const ACTIVE_BRANCH_ID_KEY = 'igen-erp-mobile.active-branch-id';
let accessToken: string | null = null;

export function getAccessToken() {
  return accessToken;
}

export async function restoreAccessToken() {
  if (Platform.OS === 'web') {
    accessToken = typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(ACCESS_TOKEN_KEY);
  } else {
    accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  }
  return accessToken;
}

export async function saveAccessToken(token: string) {
  accessToken = token;
  if (Platform.OS === 'web') {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function clearAccessToken() {
  accessToken = null;
  if (Platform.OS === 'web') {
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
}

export async function restoreActiveBranchId() {
  try {
    if (Platform.OS === 'web') {
      return typeof sessionStorage === 'undefined'
        ? null
        : sessionStorage.getItem(ACTIVE_BRANCH_ID_KEY);
    }
    return await SecureStore.getItemAsync(ACTIVE_BRANCH_ID_KEY);
  } catch {
    return null;
  }
}

export async function saveActiveBranchId(branchId: string) {
  try {
    if (Platform.OS === 'web') {
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(ACTIVE_BRANCH_ID_KEY, branchId);
      return;
    }
    await SecureStore.setItemAsync(ACTIVE_BRANCH_ID_KEY, branchId, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } catch {
    // Branch persistence is auxiliary and should never block app navigation.
  }
}

export async function clearActiveBranchId() {
  try {
    if (Platform.OS === 'web') {
      if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(ACTIVE_BRANCH_ID_KEY);
      return;
    }
    await SecureStore.deleteItemAsync(ACTIVE_BRANCH_ID_KEY);
  } catch {
    // Ignore storage cleanup failures during sign out.
  }
}
