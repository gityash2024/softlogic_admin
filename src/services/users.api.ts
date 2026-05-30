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
  linkedStudentIds?: string[];
}

export interface UpdateUserPayload {
  name?: string;
  role?: UserRole;
  status?: UserStatus;
  organizationId?: string | null;
  timezone?: string;
  language?: string;
  linkedStudentIds?: string[];
}

export interface ResendInviteResult {
  sent: boolean;
  email: string;
}

export interface ForceLogoutResult {
  revoked: boolean;
}

export interface BulkInviteUser {
  email: string;
  name?: string;
  role: UserRole;
  organizationId?: string;
}

export interface BulkInviteRowResult {
  email: string;
  status: 'created' | 'failed';
  error?: string;
}

export interface BulkInviteResult {
  createdCount: number;
  failedCount: number;
  results: BulkInviteRowResult[];
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
  delete: async (id: string) => {
    const res = await api.delete<ApiResponse<unknown>>(`/admin/users/${id}`);
    return res.data.data;
  },
  resendInvite: async (id: string) => {
    const res = await api.post<ApiResponse<ResendInviteResult>>(
      `/admin/users/${id}/resend-invite`,
    );
    return res.data.data;
  },
  forceLogout: async (id: string) => {
    const res = await api.post<ApiResponse<ForceLogoutResult>>(
      `/admin/users/${id}/force-logout`,
    );
    return res.data.data;
  },
  bulkInvite: async (users: BulkInviteUser[]) => {
    const res = await api.post<ApiResponse<BulkInviteResult>>(
      '/admin/users/bulk-invite',
      { users },
    );
    return res.data.data;
  },
};
