import { api } from '@/lib/api';
import type { AiAllocationOverview, ApiResponse } from '@/types/api';
import type {
  AiAccountSearchResult,
  AiBalanceAlert,
  AiBulkAllocationResult,
  AiFreeHealth,
  AiFreeKey,
  AiFreePricingRow,
  AiLedgerRow,
  AiOrganizationRow,
  AiOverviewSummary,
  AiTier,
  AiTierConfig,
  AiTierPolicy,
  AiTimeseries,
  AiMyTier,
  AiUserRow,
} from '@/types/ai';
import { AdminExportFormat, AdminListQuery, downloadAdminExport, getAdminList } from './admin-api';

/** Phase 2 admin endpoints (SoftLogic AI Free / Pro). */
export const aiAdminApi = {
  summary: async () => (await api.get<ApiResponse<AiOverviewSummary>>('/admin/ai/overview/summary')).data.data,
  timeseries: async (query: AdminListQuery) =>
    (await api.get<ApiResponse<AiTimeseries>>('/admin/ai/usage/timeseries', { params: query })).data.data,

  ledger: (query: AdminListQuery) => getAdminList<AiLedgerRow>('/admin/ai/ledger', query),
  ledgerEntry: async (id: string) =>
    (await api.get<ApiResponse<{ entry: AiLedgerRow; related: AiLedgerRow[] }>>(`/admin/ai/ledger/${id}`)).data.data,
  exportLedger: (query: AdminListQuery, format: AdminExportFormat) => downloadAdminExport('/admin/ai/ledger/export', query, format),

  organizations: (query: AdminListQuery) => getAdminList<AiOrganizationRow>('/admin/ai/organizations', query),
  exportOrganizations: (query: AdminListQuery, format: AdminExportFormat) =>
    downloadAdminExport('/admin/ai/organizations/export', query, format),
  users: (query: AdminListQuery) => getAdminList<AiUserRow>('/admin/ai/users', query),
  exportUsers: (query: AdminListQuery, format: AdminExportFormat) => downloadAdminExport('/admin/ai/users/export', query, format),
  searchAccounts: async (query: { q?: string; scope?: 'ORGANIZATION' | 'USER'; tier?: AiTier; limit?: number }) =>
    (await api.get<ApiResponse<AiAccountSearchResult[]>>('/admin/ai/accounts/search', { params: query })).data.data,

  bulkAllocate: async (payload: {
    tier: AiTier;
    mode: 'ADD' | 'SET';
    reason?: string;
    items: Array<{ scope: 'ORGANIZATION' | 'USER'; organizationId?: string | null; userId?: string | null; amountTokens: number }>;
  }) => (await api.post<ApiResponse<AiBulkAllocationResult>>('/admin/ai/allocations/bulk', payload)).data.data,
  reclaim: async (payload: {
    tier: AiTier;
    scope: 'ORGANIZATION' | 'USER';
    organizationId?: string | null;
    userId?: string | null;
    amountTokens?: number;
    all?: boolean;
  }) => (await api.post<ApiResponse<unknown>>('/admin/ai/allocations/reclaim', payload)).data.data,
  topUp: async (payload: { tier: AiTier; amountTokens: number; reason?: string }) =>
    (await api.post<ApiResponse<unknown>>('/admin/ai/pools/top-up', payload)).data.data,
  allocate: async (payload: {
    tier: AiTier;
    scope: 'ORGANIZATION' | 'USER';
    organizationId?: string | null;
    userId?: string | null;
    amountTokens: number;
    reason?: string;
  }) => (await api.post<ApiResponse<unknown>>('/admin/ai/allocations', payload)).data.data,

  tierConfig: async () => (await api.get<ApiResponse<AiTierConfig>>('/admin/ai/tier-config')).data.data,
  updateTierConfig: async (payload: Partial<AiTierConfig>) =>
    (await api.put<ApiResponse<AiTierConfig>>('/admin/ai/tier-config', payload)).data.data,
  policies: (query: AdminListQuery) => getAdminList<AiTierPolicy>('/admin/ai/tier-policies', query),
  savePolicy: async (payload: {
    scope: 'ORGANIZATION' | 'USER';
    organizationId?: string | null;
    userId?: string | null;
    proEnabled?: boolean | null;
    freeDailyRequests?: number | null;
    freeDailyCredits?: number | null;
    note?: string | null;
  }) => (await api.put<ApiResponse<AiTierPolicy>>('/admin/ai/tier-policies', payload)).data.data,
  deletePolicy: async (id: string) => (await api.delete<ApiResponse<{ id: string }>>(`/admin/ai/tier-policies/${id}`)).data.data,

  freePricing: async () => (await api.get<ApiResponse<AiFreePricingRow[]>>('/admin/ai/free-pricing')).data.data,
  updateFreePricing: async (pricing: AiFreePricingRow[]) =>
    (await api.put<ApiResponse<AiFreePricingRow[]>>('/admin/ai/free-pricing', { pricing })).data.data,

  freeKeys: async () => (await api.get<ApiResponse<AiFreeKey[]>>('/admin/ai/free-keys')).data.data,
  createFreeKey: async (payload: Partial<AiFreeKey> & { apiKey: string }) =>
    (await api.post<ApiResponse<AiFreeKey>>('/admin/ai/free-keys', payload)).data.data,
  updateFreeKey: async (id: string, payload: Partial<AiFreeKey> & { apiKey?: string | null }) =>
    (await api.put<ApiResponse<AiFreeKey>>(`/admin/ai/free-keys/${id}`, payload)).data.data,
  deleteFreeKey: async (id: string) => (await api.delete<ApiResponse<{ id: string }>>(`/admin/ai/free-keys/${id}`)).data.data,
  testFreeKey: async (id: string) => (await api.post<ApiResponse<AiFreeKey>>(`/admin/ai/free-keys/${id}/test`)).data.data,
  syncFreeKeys: async () =>
    (await api.post<ApiResponse<{ synced: boolean; count: number; message?: string }>>('/admin/ai/free-keys/sync')).data.data,
  freeHealth: async () => (await api.get<ApiResponse<AiFreeHealth>>('/admin/ai/free-health')).data.data,

  /** 404 on a Phase 1 backend: treat as "tiers inactive". */
  myTier: async (): Promise<AiMyTier | null> => {
    try {
      return (await api.get<ApiResponse<AiMyTier>>('/ai/me/tier')).data.data;
    } catch (error) {
      if ((error as { response?: { status?: number } }).response?.status === 404) return null;
      throw error;
    }
  },
  allocationOverview: async (tier: AiTier) =>
    (await api.get<ApiResponse<AiAllocationOverview>>('/admin/ai/allocation-overview', { params: { tier } })).data.data,
  setAllocation: async (payload: {
    tier: AiTier;
    sourceAccountId?: string | null;
    scope: 'ORGANIZATION' | 'USER';
    organizationId?: string | null;
    userId?: string | null;
    allocatedTokens: number;
    reason?: string;
  }) => (await api.put<ApiResponse<unknown>>('/admin/ai/allocations', payload)).data.data,

  alerts: (query: AdminListQuery) => getAdminList<AiBalanceAlert>('/ai/alerts', query),
  markAlertRead: async (id: string) => (await api.post<ApiResponse<{ updated: number }>>(`/ai/alerts/${id}/read`)).data.data,
};
