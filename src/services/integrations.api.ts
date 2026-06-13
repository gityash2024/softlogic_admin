import { api } from '@/lib/api';
import type { ApiResponse, OrganizationStorageProvider } from '@/types/api';

export interface IntegrationStatus {
  configured: boolean;
  connected: boolean;
  action: 'connect' | 'configure' | 'refresh';
  message: string;
  updatedAt?: string | null;
  externalAccountEmail?: string | null;
}

interface OAuthUrlResult {
  configured: boolean;
  authUrl: string | null;
  message?: string;
}

const pathFor = (provider: OrganizationStorageProvider) => {
  if (provider === 'GOOGLE_DRIVE') return 'google-drive';
  if (provider === 'ONEDRIVE') return 'onedrive';
  return 'dropbox';
};

export const integrationsApi = {
  status: async (provider: OrganizationStorageProvider, organizationId: string) => {
    const res = await api.get<ApiResponse<IntegrationStatus>>(
      `/integrations/${pathFor(provider)}/status`,
      { params: { organizationId } },
    );
    return res.data.data;
  },
  oauthUrl: async (provider: OrganizationStorageProvider, organizationId: string) => {
    const res = await api.get<ApiResponse<OAuthUrlResult>>(
      `/integrations/${pathFor(provider)}/oauth-url`,
      { params: { organizationId } },
    );
    return res.data.data;
  },
  disconnect: async (provider: OrganizationStorageProvider, organizationId: string) => {
    const res = await api.post<ApiResponse<{ connected: false }>>(
      `/integrations/${pathFor(provider)}/disconnect`,
      { organizationId },
    );
    return res.data.data;
  },
};
