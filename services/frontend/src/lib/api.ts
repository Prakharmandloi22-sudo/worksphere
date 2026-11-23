export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
export const ANALYTICS_BASE_URL = process.env.NEXT_PUBLIC_ANALYTICS_API_URL || 'http://localhost:8000';

export interface ApiFetchOptions extends RequestInit {
  orgId?: string;
  token?: string;
}

export async function apiFetch<T = any>(endpoint: string, options: ApiFetchOptions = {}): Promise<T> {
  const { orgId, token, headers = {}, ...rest } = options;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };

  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }
  if (orgId) {
    requestHeaders['X-Organization-Id'] = orgId;
  }

  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const res = await fetch(url, {
    ...rest,
    headers: requestHeaders,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error: any = new Error(data?.error?.message || `HTTP ${res.status} Request Failed`);
    error.status = res.status;
    error.code = data?.error?.code;
    error.currentVersion = data?.error?.currentVersion;
    error.currentState = data?.error?.currentState;
    throw error;
  }

  return data;
}
