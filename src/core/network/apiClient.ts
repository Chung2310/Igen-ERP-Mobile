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
  accessToken?: string;
};

const baseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');

/** Shared API entry point. Feature services should call this instead of fetch directly. */
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  if (!baseUrl) {
    throw new Error('Thiếu EXPO_PUBLIC_API_URL. Hãy cấu hình địa chỉ API trong tệp môi trường.');
  }

  const { accessToken, body, headers: requestHeaders, ...requestOptions } = options;
  const headers = new Headers(requestHeaders);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  let requestBody: BodyInit | undefined;
  if (body !== undefined) {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    if (isFormData || typeof body === 'string') {
      requestBody = body as BodyInit;
    } else {
      headers.set('Content-Type', 'application/json');
      requestBody = JSON.stringify(body);
    }
  }

  const response = await fetch(`${baseUrl}/${path.replace(/^\//, '')}`, {
    ...requestOptions,
    headers,
    body: requestBody,
  });

  const responseText = await response.text();
  let result: unknown = responseText;
  if (responseText) {
    try {
      result = JSON.parse(responseText);
    } catch {
      // Keep non-JSON responses as text so API errors remain inspectable.
    }
  }

  if (!response.ok) {
    const message = typeof result === 'object' && result !== null && 'message' in result
      ? String(result.message)
      : `API request failed (${response.status})`;
    throw new ApiError(message, response.status, result);
  }

  return result as T;
}
