import { api } from '@/lib/api';
import type {
  AiAllocationOverview,
  AiConfigSummary,
  AiCreditAccountSummary,
  AiCreditScope,
  AiGoogleBillingSummary,
  AiModelPricingSummary,
  AiOverview,
  ApiResponse,
} from '@/types/api';

export interface UpdateAiConfigPayload {
  geminiApiKey?: string | null;
  geminiTextModel?: string;
  geminiImageModel?: string;
  geminiTtsModel?: string;
  googleSearchGroundingEnabled?: boolean;
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

export interface AiSetAllocationPayload {
  sourceAccountId?: string | null;
  scope: AiCreditScope;
  organizationId?: string | null;
  userId?: string | null;
  allocatedTokens: number;
  reason?: string | null;
  referenceNote?: string | null;
}

export interface UpdateAiPricingPayload {
  pricing: Array<{
    modelId: string;
    provider?: string;
    billingType: 'token' | 'image' | 'audio' | 'tool' | string;
    inputUsdMicrosPerMillion: number;
    outputUsdMicrosPerMillion: number;
    imageUsdMicrosEach: number;
    searchUsdMicrosPerThousand: number;
    enabled?: boolean;
  }>;
}

export interface UpdateAiGoogleBillingPayload {
  enabled?: boolean;
  projectId?: string;
  billingTableProjectId?: string | null;
  billingDatasetId?: string | null;
  billingTableName?: string | null;
  monthlyCapMicros?: number;
}

export const aiApi = {
  allocationOverview: async () => {
    const res = await api.get<ApiResponse<AiAllocationOverview>>(
      '/admin/ai/allocation-overview',
    );
    return res.data.data;
  },
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
  updatePricing: async (payload: UpdateAiPricingPayload) => {
    const res = await api.put<ApiResponse<AiModelPricingSummary[]>>('/admin/ai/pricing', payload);
    return res.data.data;
  },
  updateGoogleBilling: async (payload: UpdateAiGoogleBillingPayload) => {
    const res = await api.put<ApiResponse<AiGoogleBillingSummary>>('/admin/ai/google-billing', payload);
    return res.data.data;
  },
  syncGoogleBilling: async () => {
    const res = await api.post<ApiResponse<AiGoogleBillingSummary>>('/admin/ai/google-billing/sync');
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
  setAllocation: async (payload: AiSetAllocationPayload) => {
    const res = await api.put<ApiResponse<AiCreditAccountSummary>>('/admin/ai/allocations', payload);
    return res.data.data;
  },
};
