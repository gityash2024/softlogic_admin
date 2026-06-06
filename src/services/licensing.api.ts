import { api } from '@/lib/api';
import { downloadAdminExport, type AdminExportFormat } from './admin-api';
import type {
  ApiResponse,
  HardwareActivationKeyRecord,
  OrganizationLicenseDetailRecord,
  PaymentProvider,
  PaymentProviderMode,
} from '@/types/api';

export interface PaymentProviderConfig {
  id: string;
  provider: PaymentProvider;
  enabled: boolean;
  mode: PaymentProviderMode;
  publicKey: string | null;
  secretRef: string | null;
  webhookSecretRef: string | null;
}

export interface OfflinePaymentPayload {
  organizationId?: string | null;
  subscriptionId?: string | null;
  amountMinor: number;
  currency?: string;
  referenceNote?: string | null;
  metadata?: Record<string, unknown>;
}

export interface HardwareActivationKeyPayload {
  organizationId: string;
  subscriptionId?: string | null;
  assignedUserId?: string | null;
  label: string;
  maxDevices?: number;
  expiresAt?: string | null;
}

export interface CreateHardwareActivationKeyResponse extends HardwareActivationKeyRecord {
  activationKey: string;
}

export interface BulkHardwareActivationKeyItem {
  label: string;
  maxDevices?: number;
  assignedUserId?: string | null;
  expiresAt?: string | null;
}

export interface BulkHardwareActivationKeyPayload {
  organizationId: string;
  subscriptionId?: string | null;
  keys: BulkHardwareActivationKeyItem[];
}

export interface BulkHardwareActivationKeyResponse {
  createdCount: number;
  keys: CreateHardwareActivationKeyResponse[];
}

export interface EmailActivationKeysResponse {
  delivered: boolean;
  recipient?: string;
  keyCount: number;
}

export const licensingApi = {
  paymentProviders: async () => {
    const res = await api.get<ApiResponse<PaymentProviderConfig[]>>(
      '/admin/payment/providers',
    );
    return res.data.data;
  },
  updatePaymentProvider: async (payload: {
    provider: PaymentProvider;
    enabled: boolean;
    mode?: PaymentProviderMode;
  }) => {
    const res = await api.put<ApiResponse<PaymentProviderConfig>>(
      '/admin/payment/providers',
      payload,
    );
    return res.data.data;
  },
  recordOfflinePayment: async (payload: OfflinePaymentPayload) => {
    const res = await api.post<ApiResponse<unknown>>('/admin/payments/offline', payload);
    return res.data.data;
  },
  createHardwareActivationKey: async (payload: HardwareActivationKeyPayload) => {
    const res = await api.post<ApiResponse<CreateHardwareActivationKeyResponse>>(
      '/admin/hardware/activation-keys',
      payload,
    );
    return res.data.data;
  },
  bulkCreate: async (payload: BulkHardwareActivationKeyPayload) => {
    const res = await api.post<ApiResponse<BulkHardwareActivationKeyResponse>>(
      '/admin/hardware/activation-keys/bulk',
      payload,
    );
    return res.data.data;
  },
  exportKeys: (organizationId: string, format: AdminExportFormat) =>
    downloadAdminExport(
      '/admin/hardware/activation-keys/export',
      { organizationId },
      format,
    ),
  emailActivationKeysToOrgAdmin: async (organizationId: string) => {
    const res = await api.post<ApiResponse<EmailActivationKeysResponse>>(
      '/admin/hardware/activation-keys/email-org-admin',
      { organizationId },
    );
    return res.data.data;
  },
  resetActivation: async (activationId: string) => {
    const res = await api.post<ApiResponse<unknown>>(
      `/admin/hardware/activations/${activationId}/reset`,
    );
    return res.data.data;
  },
  revokeActivationKey: async (keyId: string) => {
    const res = await api.post<ApiResponse<unknown>>(
      `/admin/hardware/activation-keys/${keyId}/revoke`,
    );
    return res.data.data;
  },
  replaceActivationKey: async (keyId: string) => {
    const res = await api.post<ApiResponse<CreateHardwareActivationKeyResponse>>(
      `/admin/hardware/activation-keys/${keyId}/replace`,
    );
    return res.data.data;
  },
  getOrganizationLicenseDetails: async (organizationId: string) => {
    const res = await api.get<ApiResponse<OrganizationLicenseDetailRecord>>(
      `/admin/organizations/${organizationId}/license-details`,
    );
    return res.data.data;
  },
  recalculateLicenseUsage: async (organizationId: string) => {
    const res = await api.post<ApiResponse<unknown>>(
      `/admin/organizations/${organizationId}/license-usage/recalculate`,
    );
    return res.data.data;
  },
};
