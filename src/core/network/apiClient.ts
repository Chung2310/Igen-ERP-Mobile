import { clearAccessToken, getAccessToken, saveAccessToken } from '@/core/auth/authSession';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type ApiRequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  responseType?: 'json' | 'blob';
  accessToken?: string;
  /** Send this request without the current access token. */
  skipAuth?: boolean;
  /** Do not attempt refresh-token renewal after a 401 response. */
  skipRefresh?: boolean;
};

const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');
const apiBaseUrl = configuredUrl
  ? (/\/api\/v1$/i.test(configuredUrl) ? configuredUrl : `${configuredUrl}/api/v1`)
  : undefined;

let refreshInFlight: Promise<string | null> | null = null;

function getApiUrl(path: string) {
  if (!apiBaseUrl) {
    throw new Error('Thiếu EXPO_PUBLIC_API_URL. Hãy cấu hình địa chỉ dự án ERP trong tệp .env.');
  }
  return `${apiBaseUrl}/${path.replace(/^\/+/, '')}`;
}

async function parseResponse(response: Response): Promise<unknown> {
  const responseText = await response.text();
  if (!responseText) return undefined;
  try {
    return JSON.parse(responseText);
  } catch {
    return responseText;
  }
}

function messageFrom(result: unknown, fallback: string) {
  return typeof result === 'object' && result !== null && 'message' in result
    ? String(result.message)
    : fallback;
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  const pending = (async () => {
    try {
      const response = await fetch(getApiUrl('/auth/refresh-token'), {
        method: 'POST',
        credentials: 'include',
        headers: new Headers(),
      });
      const result = await parseResponse(response) as { accessToken?: string } | undefined;
      if (!response.ok || !result?.accessToken) {
        await clearAccessToken();
        return null;
      }
      await saveAccessToken(result.accessToken);
      return result.accessToken;
    } catch {
      return null;
    }
  })();

  refreshInFlight = pending;
  try {
    return await pending;
  } finally {
    if (refreshInFlight === pending) refreshInFlight = null;
  }
}

/** Shared API entry point for the ERP server. EXPO_PUBLIC_API_URL may be an origin or end in /api/v1. */
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { accessToken, skipAuth = false, skipRefresh = false, responseType = 'json', body, headers: requestHeaders, ...requestOptions } = options;

  const send = (token?: string) => {
    const headers = new Headers(requestHeaders);
    if (token && !skipAuth) headers.set('Authorization', `Bearer ${token}`);

    let requestBody: BodyInit | undefined;
    if (body !== undefined) {
      const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
      const isBlob = typeof Blob !== 'undefined' && body instanceof Blob;
      if (isFormData || isBlob || typeof body === 'string') {
        requestBody = body as BodyInit;
      } else {
        headers.set('Content-Type', 'application/json');
        requestBody = JSON.stringify(body);
      }
    }

    return fetch(getApiUrl(path), {
      ...requestOptions,
      credentials: requestOptions.credentials ?? 'include',
      headers,
      body: requestBody,
    });
  };

  const currentToken = skipAuth ? undefined : (accessToken ?? getAccessToken() ?? undefined);
  let response = await send(currentToken);

  if (response.status === 401 && !skipAuth && !skipRefresh && !/\/auth\/(login|refresh-token|logout)\b/i.test(path)) {
    const renewedToken = await refreshAccessToken();
    if (renewedToken) response = await send(renewedToken);
  }

  if (!response.ok) {
    const result = await parseResponse(response);
    throw new ApiError(messageFrom(result, `ERP API trả về lỗi (${response.status})`), response.status, result);
  }

  if (responseType === 'blob') return await response.blob() as T;

  const result = await parseResponse(response);
  return result as T;
}
