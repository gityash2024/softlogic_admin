import { api } from '@/lib/api';
import type { ApiResponse, AuthResponse } from '@/types/api';

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
};
