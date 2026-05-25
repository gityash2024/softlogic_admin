import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from './auth-store';
import type { ApiResponse, AuthResponse } from '@/types/api';

const baseURL =
  import.meta.env.VITE_API_BASE_URL ??
  'https://softlogic-whiteboard-backend-testin.vercel.app/api/v1';

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const tokens = useAuthStore.getState().tokens;
  if (tokens?.accessToken) {
    config.headers.Authorization = `Bearer ${tokens.accessToken}`;
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
      { headers: { 'Content-Type': 'application/json' } },
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

    const isAuthEndpoint = original.url?.includes('/auth/');
    if (error.response.status === 401 && !original._retry && !isAuthEndpoint) {
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
