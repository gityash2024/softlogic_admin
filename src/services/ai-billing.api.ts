import { api } from '@/lib/api';
import type { ApiResponse } from '@/types/api';
import type {
  AiBillingConfig,
  AiCheckout,
  AiGatewayConfig,
  AiGatewayMode,
  AiOrder,
  AiPaymentGateway,
  AiPlan,
  AiQuote,
  AiStorefront,
  BillingCurrency,
} from '@/types/ai';
import { AdminExportFormat, AdminListQuery, downloadAdminExport, getAdminList } from './admin-api';

export interface QuotePayload {
  planId?: string | null;
  custom?: { currency: BillingCurrency; credits?: number | null; amountMinor?: number | null } | null;
  currency?: BillingCurrency;
}

export interface CreateOrderPayload extends QuotePayload {
  currency: BillingCurrency;
  gateway: AiPaymentGateway;
  billingDetails?: {
    legalName?: string | null;
    gstin?: string | null;
    address?: string | null;
    state?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
}

/** SoftLogic AI Pro purchases (buyers: org / partner admins) and Super Admin billing. */
export const aiBillingApi = {
  storefront: async () => (await api.get<ApiResponse<AiStorefront>>('/ai/billing/storefront')).data.data,
  quote: async (payload: QuotePayload) => (await api.post<ApiResponse<AiQuote>>('/ai/billing/quote', payload)).data.data,
  createOrder: async (payload: CreateOrderPayload, idempotencyKey: string) =>
    (
      await api.post<ApiResponse<{ order: AiOrder; checkout: AiCheckout | null }>>('/ai/billing/orders', payload, {
        headers: { 'Idempotency-Key': idempotencyKey },
      })
    ).data.data,
  confirm: async (orderId: string, payload: Record<string, unknown> = {}) =>
    (await api.post<ApiResponse<AiOrder>>(`/ai/billing/orders/${orderId}/confirm`, { payload })).data.data,
  cancel: async (orderId: string) => (await api.post<ApiResponse<AiOrder>>(`/ai/billing/orders/${orderId}/cancel`)).data.data,
  order: async (orderId: string) => (await api.get<ApiResponse<AiOrder>>(`/ai/billing/orders/${orderId}`)).data.data,
  orders: (query: AdminListQuery) => getAdminList<AiOrder>('/ai/billing/orders', query),
  receipt: async (orderId: string) =>
    (await api.get<string>(`/ai/billing/orders/${orderId}/receipt`, { responseType: 'text' })).data,

  // Super Admin
  config: async () => (await api.get<ApiResponse<AiBillingConfig>>('/admin/ai/billing/config')).data.data,
  updateConfig: async (payload: Partial<AiBillingConfig>) =>
    (await api.put<ApiResponse<AiBillingConfig>>('/admin/ai/billing/config', payload)).data.data,
  plans: async (includeArchived = false) =>
    (await api.get<ApiResponse<AiPlan[]>>('/admin/ai/billing/plans', { params: { includeArchived } })).data.data,
  createPlan: async (payload: Record<string, unknown>) =>
    (await api.post<ApiResponse<AiPlan>>('/admin/ai/billing/plans', payload)).data.data,
  updatePlan: async (id: string, payload: Record<string, unknown>) =>
    (await api.put<ApiResponse<AiPlan>>(`/admin/ai/billing/plans/${id}`, payload)).data.data,
  archivePlan: async (id: string) => (await api.delete<ApiResponse<{ id: string }>>(`/admin/ai/billing/plans/${id}`)).data.data,
  gateways: async () => (await api.get<ApiResponse<AiGatewayConfig[]>>('/admin/ai/billing/gateways')).data.data,
  updateGateway: async (
    gateway: AiPaymentGateway,
    payload: {
      enabled?: boolean;
      mode?: AiGatewayMode;
      credentialsMode?: AiGatewayMode;
      supportedCurrencies?: string[];
      publicConfig?: Record<string, unknown>;
      credentials?: Record<string, string>;
      webhookSecret?: string | null;
    },
  ) => (await api.put<ApiResponse<AiGatewayConfig>>(`/admin/ai/billing/gateways/${gateway}`, payload)).data.data,
  testGateway: async (gateway: AiPaymentGateway, mode?: AiGatewayMode) =>
    (await api.post<ApiResponse<AiGatewayConfig>>(`/admin/ai/billing/gateways/${gateway}/test`, { mode })).data,
  adminOrders: (query: AdminListQuery) => getAdminList<AiOrder>('/admin/ai/billing/orders', query),
  adminOrder: async (id: string) => (await api.get<ApiResponse<AiOrder>>(`/admin/ai/billing/orders/${id}`)).data.data,
  exportOrders: (query: AdminListQuery, format: AdminExportFormat) =>
    downloadAdminExport('/admin/ai/billing/orders/export', query, format),
  refund: async (id: string, payload: { amountMinor?: number | null; reason?: string | null; recordOnly?: boolean }) =>
    (await api.post<ApiResponse<AiOrder>>(`/admin/ai/billing/orders/${id}/refund`, payload)).data.data,
  reconcile: async (id: string) => (await api.post<ApiResponse<AiOrder>>(`/admin/ai/billing/orders/${id}/reconcile`)).data.data,
};
