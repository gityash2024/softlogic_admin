import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from './auth-store';
import type { ApiResponse, AuthResponse } from '@/types/api';

const sameOriginApiBaseUrl =
  typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')
    ? `${window.location.origin}/api/v1`
    : undefined;

const baseURL =
  import.meta.env.VITE_API_BASE_URL ??
  sameOriginApiBaseUrl ??
  'https://softlogic-api.mymultimeds.com/api/v1';

const clientSessionId = (() => {
  if (typeof window === 'undefined') return 'web-panel-server-session';
  const key = 'softlogic.web.clientSessionId';
  const existing = window.localStorage.getItem(key);
  if (existing && existing.length >= 8) return existing;
  const generated =
    globalThis.crypto?.randomUUID?.() ??
    `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(key, generated);
  return generated;
})();

export const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
    'X-SoftLogic-Client': 'web_panel',
    'X-SoftLogic-Client-Session-Id': clientSessionId,
    'X-SoftLogic-Platform': 'Browser',
  },
});

export function apiObjectUrl(storageKey?: string | null, fallbackUrl?: string | null): string | null {
  const normalizedKey = storageKey?.replace(/^\/+/, '');
  if (normalizedKey) {
    return `${baseURL.replace(/\/+$/, '')}/media/object/${encodeURIComponent(normalizedKey)}`;
  }
  return fallbackUrl ?? null;
}

api.interceptors.request.use((config) => {
  const state = useAuthStore.getState();
  // While impersonating, send the short-lived "view as" token; otherwise the
  // admin's own access token. Normal (non-impersonating) behavior is unchanged.
  const accessToken = state.impersonation?.accessToken ?? state.tokens?.accessToken;
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  if (state.impersonation) {
    delete config.headers['X-SoftLogic-Client-Session-Id'];
  } else {
    config.headers['X-SoftLogic-Client-Session-Id'] = clientSessionId;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function performRefresh(): Promise<string | null> {
  const state = useAuthStore.getState();
  const refreshToken = state.tokens?.refreshToken;
  if (!refreshToken) return null;

  try {
    const res = await axios.post<ApiResponse<AuthResponse>>(
      `${baseURL}/auth/refresh`,
      { refreshToken },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-SoftLogic-Client': 'web_panel',
          'X-SoftLogic-Client-Session-Id': clientSessionId,
          'X-SoftLogic-Platform': 'Browser',
        },
      },
    );
    const payload = res.data?.data;
    if (!payload?.tokens) {
      state.clear();
      return null;
    }
    state.updateTokens(payload.tokens);
    state.updateUser(payload.user);
    return payload.tokens.accessToken;
  } catch {
    state.clear();
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;
    if (!original || !error.response) throw error;

    const url = original.url ?? '';
    const isAuthEndpoint = url.includes('/auth/');
    const isSessionAuthEndpoint =
      url.includes('/auth/sessions') || url.includes('/auth/admin/password/change');
    if (error.response.status === 401 && isSessionAuthEndpoint) {
      useAuthStore.getState().clear();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw error;
    }
    if (error.response.status === 401 && !original._retry && !isAuthEndpoint) {
      const state = useAuthStore.getState();
      // An impersonation token cannot be refreshed (no refresh token is issued
      // for "view as"). On 401, exit impersonation — the admin's own session is
      // still intact in the store — and surface the error instead of refreshing.
      if (state.impersonation) {
        state.stopImpersonation();
        throw error;
      }
      original._retry = true;
      if (!refreshPromise) refreshPromise = performRefresh();
      const newToken = await refreshPromise;
      refreshPromise = null;
      if (newToken) {
        original.headers = original.headers ?? {};
        (original.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
        return api(original);
      }
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    throw error;
  },
);

export function extractApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiResponse<unknown> | undefined;
    if (data?.message) return data.message;
    if (error.message) return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}
