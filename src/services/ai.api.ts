import { api } from '@/lib/api';
import type { AiConfigSummary, AiCreditAccountSummary, AiCreditScope, AiOverview, ApiResponse } from '@/types/api';

export interface UpdateAiConfigPayload {
  geminiApiKey?: string | null;
  geminiTextModel?: string;
  geminiImageModel?: string;
  geminiTtsModel?: string;
  enabled?: boolean;
}

export interface AiTopUpPayload {
  accountId?: string | null;
  amountTokens: number;
  reason?: string | null;
  referenceNote?: string | null;
}

export interface AiAllocationPayload {
  sourceAccountId?: string | null;
  scope: AiCreditScope;
  organizationId?: string | null;
  userId?: string | null;
  amountTokens: number;
  reason?: string | null;
  referenceNote?: string | null;
}

export const aiApi = {
  overview: async () => {
    const res = await api.get<ApiResponse<AiOverview>>('/admin/ai/overview');
    return res.data.data;
  },
  updateConfig: async (payload: UpdateAiConfigPayload) => {
    const res = await api.put<ApiResponse<AiConfigSummary>>('/admin/ai/config', payload);
    return res.data.data;
  },
  testConfig: async (payload: UpdateAiConfigPayload = {}) => {
    const res = await api.post<ApiResponse<AiConfigSummary>>('/admin/ai/config/test', payload);
    return res.data.data;
  },
  topUp: async (payload: AiTopUpPayload) => {
    const res = await api.post<ApiResponse<AiCreditAccountSummary>>('/admin/ai/pools/top-up', payload);
    return res.data.data;
  },
  allocate: async (payload: AiAllocationPayload) => {
    const res = await api.post<ApiResponse<AiCreditAccountSummary>>('/admin/ai/allocations', payload);
    return res.data.data;
  },
};
