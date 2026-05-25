import { api } from '@/lib/api';
import { downloadAdminExport, getAdminItem, getAdminList, type AdminExportFormat, type AdminListQuery } from './admin-api';
import type { AdminUser, ApiResponse, UserRole, UserStatus } from '@/types/api';

export interface CreateUserPayload {
  email: string;
  name?: string;
  role: UserRole;
  status?: UserStatus;
  organizationId?: string | null;
  timezone?: string;
  language?: string;
}

export interface UpdateUserPayload {
  name?: string;
  role?: UserRole;
  status?: UserStatus;
  organizationId?: string | null;
  timezone?: string;
  language?: string;
}

export const usersApi = {
  list: (query?: AdminListQuery) => getAdminList<AdminUser>('/admin/users', query),
  all: async () => (await getAdminList<AdminUser>('/admin/users', { perPage: 100 })).data,
  get: (id: string) => getAdminItem<AdminUser>(`/admin/users/${id}`),
  export: (query: AdminListQuery, format: AdminExportFormat) =>
    downloadAdminExport('/admin/users/export', query, format),
  create: async (payload: CreateUserPayload) => {
    const res = await api.post<ApiResponse<AdminUser>>('/admin/users', payload);
    return res.data.data;
  },
  update: async (id: string, payload: UpdateUserPayload) => {
    const res = await api.put<ApiResponse<AdminUser>>(`/admin/users/${id}`, payload);
    return res.data.data;
  },
};
