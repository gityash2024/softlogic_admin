import { api } from '@/lib/api';
import {
  downloadAdminExport,
  getAdminList,
  type AdminExportFormat,
  type AdminListQuery,
} from './admin-api';
import type {
  ApiResponse,
  HardwareActivationKeyRecord,
  OrganizationLicenseDetailRecord,
  PartnerLicenseDetailRecord,
  PaymentProvider,
  PaymentProviderMode,
  PaymentTransactionStatus,
  PartnerLicensePaymentRecord,
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
  sourcePartnerOrganizationId?: string | null;
  assignedUserId?: string | null;
  label: string;
  maxDevices?: number;
  startsAt: string;
  expiresAt?: string | null;
}

export interface CreateHardwareActivationKeyResponse extends HardwareActivationKeyRecord {
  activationKey: string;
}

export interface BulkHardwareActivationKeyItem {
  label: string;
  maxDevices?: number;
  assignedUserId?: string | null;
}

export interface BulkHardwareActivationKeyPayload {
  organizationId: string;
  subscriptionId?: string | null;
  sourcePartnerOrganizationId?: string | null;
  startsAt: string;
  expiresAt: string;
  keys: BulkHardwareActivationKeyItem[];
}

export interface UpdatePaymentTransactionPayload {
  amountMinor?: number;
  currency?: string;
  status?: PaymentTransactionStatus;
  referenceNote?: string | null;
  invoiceNumber?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
}

export interface UpdateHardwareActivationKeyTermPayload {
  startsAt: string;
  expiresAt: string;
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

export interface AssignEmailActivationKeysPayload {
  organizationId: string;
  sourcePartnerOrganizationId?: string | null;
  activationKeyIds: string[];
}

export interface AssignEmailActivationKeysResponse extends EmailActivationKeysResponse {
  assignedOrganizationId: string;
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
  updatePaymentTransaction: async (
    paymentId: string,
    payload: UpdatePaymentTransactionPayload,
  ) => {
    const res = await api.patch<ApiResponse<PartnerLicensePaymentRecord>>(
      `/admin/payments/${paymentId}`,
      payload,
    );
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
  listKeys: (query?: AdminListQuery) =>
    getAdminList<HardwareActivationKeyRecord>('/admin/hardware/activation-keys', query),
  exportKeyList: (query: AdminListQuery, format: AdminExportFormat) =>
    downloadAdminExport('/admin/hardware/activation-keys/export', query, format),
  emailActivationKeysToOrgAdmin: async (
    input: string | { organizationId: string; activationKeyIds?: string[] },
  ) => {
    const payload =
      typeof input === 'string'
        ? { organizationId: input }
        : input;
    const res = await api.post<ApiResponse<EmailActivationKeysResponse>>(
      '/admin/hardware/activation-keys/email-org-admin',
      payload,
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
  updateActivationKeyLabel: async (keyId: string, label: string) => {
    const res = await api.patch<ApiResponse<HardwareActivationKeyRecord>>(
      `/admin/hardware/activation-keys/${keyId}/label`,
      { label },
    );
    return res.data.data;
  },
  updateActivationKeyTerm: async (
    keyId: string,
    payload: UpdateHardwareActivationKeyTermPayload,
  ) => {
    const res = await api.patch<ApiResponse<HardwareActivationKeyRecord>>(
      `/admin/hardware/activation-keys/${keyId}/term`,
      payload,
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
  assignEmailActivationKeysToOrgAdmin: async (payload: AssignEmailActivationKeysPayload) => {
    const res = await api.post<ApiResponse<AssignEmailActivationKeysResponse>>(
      '/admin/hardware/activation-keys/assign-email-org-admin',
      payload,
    );
    return res.data.data;
  },
  getPartnerLicenseDetails: async (partnerOrganizationId: string) => {
    const res = await api.get<ApiResponse<PartnerLicenseDetailRecord>>(
      `/admin/organizations/${partnerOrganizationId}/partner-license-details`,
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
