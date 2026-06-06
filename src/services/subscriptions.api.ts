import { api } from '@/lib/api';
import { downloadAdminExport, getAdminItem, getAdminList, type AdminExportFormat, type AdminListQuery } from './admin-api';
import type {
  ApiResponse,
  AuditLogEntry,
  BrandingMode,
  SubscriptionDetailRecord,
  SubscriptionRecord,
  SubscriptionStatus,
} from '@/types/api';

export interface SubscriptionPaymentRecord {
  id: string;
  amountMinor: number;
  currency: string;
  status: string;
  referenceNote: string | null;
  invoiceNumber: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
  recordedBy?: { id: string; email: string; name: string | null } | null;
}

export interface SubscriptionPaymentsResponse {
  payments: SubscriptionPaymentRecord[];
}

export interface CreateSubscriptionPayload {
  organizationId?: string | null;
  userId?: string | null;
  planName: string;
  status?: SubscriptionStatus;
  brandingMode?: BrandingMode;
  seatLimit: number;
  startDate: string;
  endDate?: string | null;
}

export interface UpdateSubscriptionPayload {
  planName?: string;
  status?: SubscriptionStatus;
  brandingMode?: BrandingMode;
  seatLimit?: number;
  startDate?: string;
  endDate?: string | null;
}

export interface RenewSubscriptionPayload {
  newEndDate: string;
  extendKeys?: boolean;
  payment?: {
    amountMinor: number;
    currency?: string;
    referenceNote?: string;
  };
}

export const subscriptionsApi = {
  list: (query?: AdminListQuery) =>
    getAdminList<SubscriptionRecord>('/admin/subscriptions', query),
  all: async () =>
    (await getAdminList<SubscriptionRecord>('/admin/subscriptions', { perPage: 100 })).data,
  get: (id: string) => getAdminItem<SubscriptionRecord>(`/admin/subscriptions/${id}`),
  getDetails: (id: string) =>
    getAdminItem<SubscriptionDetailRecord>(`/admin/subscriptions/${id}/details`),
  listPayments: async (id: string) => {
    const res = await api.get<ApiResponse<SubscriptionPaymentsResponse>>(
      `/admin/subscriptions/${id}/payments`,
    );
    return res.data.data.payments;
  },
  timeline: async (id: string) =>
    (
      await getAdminList<AuditLogEntry>('/admin/activity', {
        targetType: 'subscription',
        targetId: id,
        perPage: 100,
      })
    ).data,
  export: (query: AdminListQuery, format: AdminExportFormat) =>
    downloadAdminExport('/admin/subscriptions/export', query, format),
  create: async (payload: CreateSubscriptionPayload) => {
    const res = await api.post<ApiResponse<SubscriptionRecord>>(
      '/admin/subscriptions',
      payload,
    );
    return res.data.data;
  },
  update: async (id: string, payload: UpdateSubscriptionPayload) => {
    const res = await api.put<ApiResponse<SubscriptionRecord>>(
      `/admin/subscriptions/${id}`,
      payload,
    );
    return res.data.data;
  },
  renew: async (id: string, payload: RenewSubscriptionPayload) => {
    const res = await api.post<ApiResponse<SubscriptionRecord>>(
      `/admin/subscriptions/${id}/renew`,
      payload,
    );
    return res.data.data;
  },
  approve: async (id: string) => {
    const res = await api.post<ApiResponse<SubscriptionRecord>>(
      `/admin/subscriptions/${id}/approve`,
    );
    return res.data.data;
  },
  reject: async (id: string, reason?: string | null) => {
    const res = await api.post<ApiResponse<SubscriptionRecord>>(
      `/admin/subscriptions/${id}/reject`,
      { reason: reason ?? null },
    );
    return res.data.data;
  },
  archive: async (id: string) => {
    const res = await api.delete<ApiResponse<SubscriptionRecord>>(
      `/admin/subscriptions/${id}`,
    );
    return res.data.data;
  },
  restore: async (id: string) => {
    const res = await api.post<ApiResponse<SubscriptionRecord>>(
      `/admin/subscriptions/${id}/restore`,
    );
    return res.data.data;
  },
};
