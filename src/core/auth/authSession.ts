import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'igen-erp-mobile.access-token';
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
