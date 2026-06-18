import { api } from '@/lib/api';
import type {
  ApiResponse,
  SupportCategory,
  SupportPriority,
  SupportThreadRecord,
  SupportThreadStatus,
} from '@/types/api';

export interface ListSupportThreadsQuery {
  status?: SupportThreadStatus;
  category?: SupportCategory;
  priority?: SupportPriority;
  partnerOrganizationId?: string;
  organizationId?: string;
  search?: string;
  page?: number;
  perPage?: number;
}

export interface CreateSupportThreadPayload {
  organizationId?: string;
  category: SupportCategory;
  subject: string;
  body: string;
  priority?: SupportPriority;
  requestedAction?: {
    kind: string;
    params: Record<string, unknown>;
  } | null;
}

export interface ApplySupportActionPayload {
  kind:
    | 'seats_increase'
    | 'seats_decrease'
    | 'subscription_extend'
    | 'reset_device'
    | 'disable_org'
    | 'enable_org'
    | 'extend_key_expiry';
  params: Record<string, unknown>;
  autoResolve?: boolean;
}

export interface PaginatedSupport<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    filters: Record<string, unknown>;
  };
}

export const supportApi = {
  unreadCount: async () => {
    const res = await api.get<ApiResponse<{ count: number }>>(
      '/support/threads/unread-count',
    );
    return res.data.data.count;
  },
  list: async (query: ListSupportThreadsQuery = {}) => {
    const res = await api.get<ApiResponse<SupportThreadRecord[]>>('/support/threads', {
      params: query,
    });
    return {
      data: res.data.data,
      meta: (res.data.meta ?? {}) as PaginatedSupport<SupportThreadRecord>['meta'],
    };
  },
  get: async (id: string) => {
    const res = await api.get<ApiResponse<SupportThreadRecord>>(`/support/threads/${id}`);
    return res.data.data;
  },
  create: async (payload: CreateSupportThreadPayload) => {
    const res = await api.post<ApiResponse<SupportThreadRecord>>('/support/threads', payload);
    return res.data.data;
  },
  reply: async (id: string, body: string) => {
    const res = await api.post<ApiResponse<SupportThreadRecord>>(
      `/support/threads/${id}/messages`,
      { body },
    );
    return res.data.data;
  },
  updateStatus: async (id: string, status: SupportThreadStatus) => {
    const res = await api.patch<ApiResponse<SupportThreadRecord>>(
      `/support/threads/${id}/status`,
      { status },
    );
    return res.data.data;
  },
  setPriority: async (id: string, priority: SupportPriority) => {
    const res = await api.patch<ApiResponse<SupportThreadRecord>>(
      `/support/threads/${id}/priority`,
      { priority },
    );
    return res.data.data;
  },
  applyAction: async (id: string, payload: ApplySupportActionPayload) => {
    const res = await api.post<ApiResponse<SupportThreadRecord>>(
      `/support/threads/${id}/actions`,
      payload,
    );
    return res.data.data;
  },
};
