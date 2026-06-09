import { api } from '@/lib/api';
import { downloadAdminExport, getAdminItem, getAdminList, type AdminExportFormat, type AdminListQuery } from './admin-api';
import type {
  AdminOrganization,
  ApiResponse,
  BrandingMode,
  OrganizationKind,
  OrganizationStatus,
  OrganizationStorageProvider,
  OrganizationStorageStatus,
} from '@/types/api';

export interface CreateOrganizationPayload {
  name: string;
  slug?: string;
  kind?: OrganizationKind;
  parentOrganizationId?: string | null;
  brandingMode?: BrandingMode;
  studentLoginEnabled?: boolean;
  parentLoginEnabled?: boolean;
  sessionOnlyJoinEnabled?: boolean;
  teacherOnlyMode?: boolean;
  teacherUserLimit?: number | null;
  studentUserLimit?: number | null;
  parentUserLimit?: number | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
  storageProviders?: OrganizationStorageProvider[];
  defaultStorageProvider?: OrganizationStorageProvider | null;
  storageProvider?: OrganizationStorageProvider | null;
  storageStatus?: OrganizationStorageStatus;
  brandName?: string | null;
  brandPrimaryColor?: string | null;
  brandAccentColor?: string | null;
}

export interface UpdateOrganizationPayload {
  name?: string;
  slug?: string;
  status?: OrganizationStatus;
  settings?: Record<string, unknown>;
  brandingMode?: BrandingMode;
  studentLoginEnabled?: boolean;
  parentLoginEnabled?: boolean;
  sessionOnlyJoinEnabled?: boolean;
  teacherOnlyMode?: boolean;
  teacherUserLimit?: number | null;
  studentUserLimit?: number | null;
  parentUserLimit?: number | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
  storageProviders?: OrganizationStorageProvider[];
  defaultStorageProvider?: OrganizationStorageProvider | null;
  storageProvider?: OrganizationStorageProvider | null;
  storageStatus?: OrganizationStorageStatus;
  brandName?: string | null;
  brandPrimaryColor?: string | null;
  brandAccentColor?: string | null;
}

export interface UpsertOrganizationStoragePayload {
  provider: OrganizationStorageProvider;
  status: OrganizationStorageStatus;
  externalAccountEmail?: string | null;
  rootFolderId?: string | null;
  encryptedTokens?: string | null;
  lastError?: string | null;
}

export const organizationsApi = {
  list: (query?: AdminListQuery) =>
    getAdminList<AdminOrganization>('/admin/organizations', query),
  all: async () =>
    (await getAdminList<AdminOrganization>('/admin/organizations', { perPage: 100 })).data,
  get: (id: string) => getAdminItem<AdminOrganization>(`/admin/organizations/${id}`),
  export: (query: AdminListQuery, format: AdminExportFormat) =>
    downloadAdminExport('/admin/organizations/export', query, format),
  create: async (payload: CreateOrganizationPayload) => {
    const res = await api.post<ApiResponse<AdminOrganization>>(
      '/admin/organizations',
      payload,
    );
    return res.data.data;
  },
  update: async (id: string, payload: UpdateOrganizationPayload) => {
    const res = await api.patch<ApiResponse<AdminOrganization>>(
      `/admin/organizations/${id}`,
      payload,
    );
    return res.data.data;
  },
  delete: async (id: string) => {
    const res = await api.delete<ApiResponse<unknown>>(`/admin/organizations/${id}`);
    return res.data.data;
  },
  uploadLogo: async (id: string, file: File) => {
    const formData = new FormData();
    formData.append('logo', file);
    const res = await api.post<ApiResponse<AdminOrganization>>(
      `/admin/organizations/${id}/logo`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return res.data.data;
  },
  removeLogo: async (id: string) => {
    const res = await api.delete<ApiResponse<AdminOrganization>>(
      `/admin/organizations/${id}/logo`,
    );
    return res.data.data;
  },
  upsertStorage: async (id: string, payload: UpsertOrganizationStoragePayload) => {
    const res = await api.put<ApiResponse<unknown>>(
      `/admin/organizations/${id}/storage`,
      payload,
    );
    return res.data.data;
  },
};
