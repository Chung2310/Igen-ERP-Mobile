function resolveErpWebOrigin() {
  const configured = process.env.EXPO_PUBLIC_ERP_WEB_URL?.trim() || process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!configured) return null;

  try {
    const url = new URL(configured);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function getErpWebUrl(path: string) {
  const origin = resolveErpWebOrigin();
  const route = path.replace(/^\/+/, '');
  return origin && route ? `${origin}/${route}` : null;
}

export const ERP_PRIVACY_POLICY_URL = getErpWebUrl('privacy-policy');
export const ERP_TERMS_OF_SERVICE_URL = getErpWebUrl('terms-of-service');
