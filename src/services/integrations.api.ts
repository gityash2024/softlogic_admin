import { api } from "@/lib/api";
import type {
  ApiResponse,
  OrganizationStorageProvider,
  StorageCredentialConfig,
  StorageCredentialScope,
  StorageCredentialSource,
} from "@/types/api";

export interface IntegrationStatus {
  configured: boolean;
  credentialConfigured?: boolean;
  credentialSource?: StorageCredentialSource;
  connected: boolean;
  action: "connect" | "configure" | "refresh";
  message: string;
  updatedAt?: string | null;
  externalAccountEmail?: string | null;
}

interface StorageCredentialsQuery {
  scope: StorageCredentialScope;
  organizationId?: string | null;
}

interface UpsertStorageCredentialPayload extends StorageCredentialsQuery {
  clientId?: string | null;
  clientSecret?: string | null;
  redirectUri?: string | null;
}

interface OAuthUrlResult {
  configured: boolean;
  authUrl: string | null;
  message?: string;
}

const pathFor = (provider: OrganizationStorageProvider) => {
  if (provider === "GOOGLE_DRIVE") return "google-drive";
  if (provider === "ONEDRIVE") return "onedrive";
  return "dropbox";
};

export const integrationsApi = {
  storageCredentials: async (query: StorageCredentialsQuery) => {
    const res = await api.get<ApiResponse<StorageCredentialConfig[]>>(
      "/admin/storage-credentials",
      { params: query },
    );
    return res.data.data;
  },
  saveStorageCredential: async (
    provider: OrganizationStorageProvider,
    payload: UpsertStorageCredentialPayload,
  ) => {
    const res = await api.put<ApiResponse<StorageCredentialConfig>>(
      `/admin/storage-credentials/${provider}`,
      payload,
    );
    return res.data.data;
  },
  deleteStorageCredential: async (
    provider: OrganizationStorageProvider,
    query: StorageCredentialsQuery,
  ) => {
    const res = await api.delete<ApiResponse<{ deleted: true }>>(
      `/admin/storage-credentials/${provider}`,
      { params: query },
    );
    return res.data.data;
  },
  status: async (
    provider: OrganizationStorageProvider,
    organizationId: string,
  ) => {
    const res = await api.get<ApiResponse<IntegrationStatus>>(
      `/integrations/${pathFor(provider)}/status`,
      { params: { organizationId } },
    );
    return res.data.data;
  },
  oauthUrl: async (
    provider: OrganizationStorageProvider,
    organizationId: string,
  ) => {
    const res = await api.get<ApiResponse<OAuthUrlResult>>(
      `/integrations/${pathFor(provider)}/oauth-url`,
      { params: { organizationId, _: Date.now() } },
    );
    return res.data.data;
  },
  disconnect: async (
    provider: OrganizationStorageProvider,
    organizationId: string,
  ) => {
    const res = await api.post<ApiResponse<{ connected: false }>>(
      `/integrations/${pathFor(provider)}/disconnect`,
      { organizationId },
    );
    return res.data.data;
  },
};
