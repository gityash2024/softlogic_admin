import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import type { ApiResponse, AuthResponse, UserRole } from '@/types/api';

export const authApi = {
  adminLogin: async (email: string, password: string) => {
    const res = await api.post<ApiResponse<AuthResponse>>('/auth/admin/login', {
      email,
      password,
    });
    return res.data.data;
  },
  logout: async (refreshToken: string) => {
    await api.post('/auth/logout', { refreshToken });
  },
  validatePasswordSetup: async (token: string) => {
    const res = await api.post<ApiResponse<{
      email: string;
      name: string | null;
      role: string;
      hasPassword: boolean;
    }>>('/auth/admin/password-setup/validate', { token });
    return res.data.data;
  },
  completePasswordSetup: async (token: string, password: string) => {
    const res = await api.post<ApiResponse<{
      email: string;
      message: string;
    }>>('/auth/admin/password-setup/complete', { token, password });
    return res.data.data;
  },
  requestPasswordReset: async (email: string) => {
    const res = await api.post<ApiResponse<{ message: string }>>(
      '/auth/admin/password-reset/request',
      { email },
    );
    return res.data.data;
  },
  changePassword: async (currentPassword: string, newPassword: string) => {
    // Send the current refresh token so the backend preserves THIS session and
    // only invalidates other devices' sessions after the password changes.
    const refreshToken = useAuthStore.getState().tokens?.refreshToken;
    await api.post('/auth/admin/password/change', {
      currentPassword,
      newPassword,
      refreshToken,
    });
  },
  impersonate: async (userId: string) => {
    const res = await api.post<ApiResponse<{
      accessToken: string;
      user: {
        id: string;
        email: string;
        name: string | null;
        role: UserRole;
        primaryOrganizationId: string | null;
      };
    }>>(`/admin/users/${userId}/impersonate`, {});
    return res.data.data;
  },
};
