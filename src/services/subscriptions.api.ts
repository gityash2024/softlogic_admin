import { api } from '@/lib/api';
import { downloadAdminExport, getAdminItem, getAdminList, type AdminExportFormat, type AdminListQuery } from './admin-api';
import type { ApiResponse, SubscriptionRecord, SubscriptionStatus } from '@/types/api';

export interface CreateSubscriptionPayload {
  organizationId?: string | null;
  userId?: string | null;
  planName: string;
  status?: SubscriptionStatus;
  seatLimit: number;
  seatUsage: number;
  startDate: string;
  endDate?: string | null;
}

export interface UpdateSubscriptionPayload {
  planName?: string;
  status?: SubscriptionStatus;
  seatLimit?: number;
  seatUsage?: number;
  startDate?: string;
  endDate?: string | null;
}

export const subscriptionsApi = {
  list: (query?: AdminListQuery) =>
    getAdminList<SubscriptionRecord>('/admin/subscriptions', query),
  all: async () =>
    (await getAdminList<SubscriptionRecord>('/admin/subscriptions', { perPage: 100 })).data,
  get: (id: string) => getAdminItem<SubscriptionRecord>(`/admin/subscriptions/${id}`),
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
};
