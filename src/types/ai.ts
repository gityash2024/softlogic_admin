/** Phase 2: SoftLogic AI Free / Pro types (admin panel). */
import type { ApiMeta, OrganizationKind, UserRole } from '@/types/api';

export type AiTier = 'FREE' | 'PRO';
export type AiHealth = 'HEALTHY' | 'LOW_20' | 'LOW_10' | 'LOW_5' | 'EXHAUSTED' | 'NO_POOL' | 'UNLIMITED';

export interface AiWalletSummary {
  accountId: string;
  tier: AiTier;
  parentAccountId: string | null;
  allocatedTokens: number;
  usedTokens: number;
  reservedTokens: number;
  childAllocatedTokens: number;
  availableTokens: number;
  percentRemaining: number;
  unlimited: boolean;
  status: string;
  health: AiHealth;
}

export interface AiBrandLabels {
  product: string;
  free: string;
  pro: string;
}

export interface AiMyTier {
  tiersActive: boolean;
  proGloballyEnabled: boolean;
  proAccess: boolean;
  proUsable: boolean;
  freeUsable: boolean;
  canToggle: boolean;
  preferredTier: AiTier | null;
  effectiveTier: AiTier;
  showUpgradeHint: boolean;
  upgradeHintKind: 'BUY' | 'ASK_ADMIN' | null;
  exempt: boolean;
  brand: AiBrandLabels;
}

export interface AiTierConfig {
  id: string;
  tiersActive: boolean;
  proGloballyEnabled: boolean;
  proDefaultScope: 'ALL' | 'SELECTED';
  freeEnabled: boolean;
  proToFreeFallbackEnabled: boolean;
  freeDefaultUserDailyRequests: number | null;
  freeDefaultUserDailyCredits: number | null;
  freeDefaultOrgDailyRequests: number | null;
  freeDefaultOrgDailyCredits: number | null;
  freePlatformDailyRequests: number | null;
  freeProviderChain: Record<string, boolean>;
  updatedAt: string;
}

export interface AiTierPolicy {
  id: string;
  scope: 'ORGANIZATION' | 'USER';
  organizationId: string | null;
  userId: string | null;
  proEnabled: boolean | null;
  freeDailyRequests: number | null;
  freeDailyCredits: number | null;
  note: string | null;
  updatedAt: string;
  organization?: { id: string; name: string; kind: OrganizationKind; parentOrganizationId: string | null } | null;
  user?: { id: string; email: string; name: string | null; role: UserRole; primaryOrganizationId: string | null } | null;
}

export interface AiFreePricingRow {
  id?: string;
  modelId: string;
  billingType: string;
  inputUsdMicrosPerMillion: number;
  outputUsdMicrosPerMillion: number;
  imageUsdMicrosEach: number;
  audioUsdMicrosEach: number;
  searchUsdMicrosPerThousand: number;
  enabled: boolean;
}

export type AiFreeProvider = 'gemini' | 'pollinations' | 'openrouter' | 'serper' | 'youtube';

export interface AiFreeKey {
  id: string;
  provider: AiFreeProvider;
  label: string;
  projectRef: string | null;
  maskedKey: string;
  enabled: boolean;
  dailyRequestCap: number;
  rpmCap: number;
  resetTimezone: string;
  lastTestAt: string | null;
  lastTestStatus: string | null;
  lastTestMessage: string | null;
  updatedAt: string;
}

export interface AiFreeHealthKey {
  id: string;
  provider: string;
  label: string;
  projectRef: string | null;
  source: string;
  enabled: boolean;
  disabledReason: string | null;
  day: string;
  requestsToday: number;
  successesToday: number;
  errorsToday: number;
  tokensToday: number;
  dailyCap: number;
  rpmCap: number;
  rpmUsed: number;
  exhausted: boolean;
  coolingDownFor: number;
  avgLatencyMs: number | null;
  lastError: string | null;
  lastSuccessAt: number | null;
}

export interface AiFreeHealth {
  reachable: boolean;
  message?: string;
  status?: 'ok' | 'degraded';
  textReady?: boolean;
  providers?: Record<
    string,
    {
      keys?: number;
      usableKeys?: number;
      requestsToday?: number;
      dailyCapacity?: number;
      circuitOpenFor?: number;
      enabled?: boolean;
      ready?: boolean;
      queueWaiting?: number;
      installed?: boolean;
    }
  >;
  keys?: AiFreeHealthKey[];
  circuits?: Array<{ provider: string; cooldown_until: number; last_error: string | null; last_error_at: number | null }>;
  recentEvents?: Array<{ id: number; at: number; level: string; provider: string | null; key_id: string | null; message: string }>;
  inflightUsers?: number;
}

export interface AiLedgerRow {
  id: string;
  accountId: string;
  actorUserId: string | null;
  type: string;
  tier: AiTier;
  organizationId: string | null;
  feature: string | null;
  provider: string | null;
  requestId: string | null;
  fallbackFromTier: AiTier | null;
  orderId: string | null;
  lotId: string | null;
  amountTokens: number;
  oldTokenBalance: number | null;
  newTokenBalance: number | null;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  totalTokens: number;
  imageCount: number;
  searchGroundingCount: number;
  estimatedCostMicros: number;
  modelId: string | null;
  pricingSnapshot?: Record<string, unknown>;
  reason: string | null;
  referenceNote: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  actorUser?: { id: string; email: string; name: string | null; role: UserRole } | null;
  account?: {
    id: string;
    scope: string;
    tier: AiTier;
    organizationId: string | null;
    userId: string | null;
    organization?: { id: string; name: string } | null;
    user?: { id: string; email: string; name: string | null } | null;
  };
}

export interface AiOrganizationRow {
  id: string;
  name: string;
  slug: string;
  kind: OrganizationKind;
  status: string;
  brandingMode: string;
  parentOrganizationId: string | null;
  createdAt: string;
  parentOrganization: { id: string; name: string } | null;
  childCount: number;
  wallets: { PRO: AiWalletSummary | null; FREE: AiWalletSummary | null };
  tierPolicy: { id: string; proEnabled: boolean | null; freeDailyRequests: number | null; freeDailyCredits: number | null } | null;
}

export interface AiUserRow {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  status: string;
  primaryOrganizationId: string | null;
  createdAt: string;
  primaryOrganization: { id: string; name: string; kind: OrganizationKind } | null;
  wallets: { PRO: AiWalletSummary | null; FREE: AiWalletSummary | null };
  usesOrgPool: { PRO: boolean; FREE: boolean };
  preferredTier: AiTier | null;
  tierPolicy: { id: string; proEnabled: boolean | null } | null;
}

export interface AiAccountSearchResult {
  type: 'ORGANIZATION' | 'USER';
  id: string;
  organizationId?: string | null;
  userId?: string;
  label: string;
  sublabel: string;
  wallet: AiWalletSummary | null;
}

export interface AiTierSummaryBlock {
  master: AiWalletSummary | null;
  usedTokens: number;
  reservedTokens: number;
  today: { requests: number; fallbackRequests: number; failedRequests: number; offlineRequests: number; credits: number };
  wallets: Record<string, number>;
}

export interface AiOverviewSummary {
  tiersActive: boolean;
  proGloballyEnabled: boolean;
  PRO: AiTierSummaryBlock;
  FREE: AiTierSummaryBlock;
}

export interface AiTimeseries {
  from: string;
  to: string;
  granularity: 'day' | 'week' | 'month';
  groupBy: 'tier' | 'feature' | 'model' | 'provider';
  points: Array<{ bucket: string; series: string; credits: number; requests: number }>;
  offline: Array<{ day: string; requests: number }>;
}

export interface AiBalanceAlert {
  id: string;
  accountId: string;
  tier: AiTier;
  organizationId: string | null;
  userId: string | null;
  level: 'LOW_20' | 'LOW_10' | 'LOW_5' | 'EXHAUSTED';
  percentRemaining: number;
  availableCredits: number;
  readAt: string | null;
  createdAt: string;
  account?: { scope: string; organization?: { id: string; name: string } | null; user?: { id: string; email: string; name: string | null } | null };
}

export interface AiBulkAllocationResult {
  succeeded: number;
  failed: number;
  results: Array<{ scope: string; organizationId?: string | null; userId?: string | null; amountTokens: number; ok: boolean; message?: string }>;
}

// ------------------------------------------------------------------ billing
export type AiPaymentGateway = 'RAZORPAY' | 'STRIPE' | 'PAYPAL' | 'CASHFREE' | 'PHONEPE';
export type AiGatewayMode = 'TEST' | 'LIVE';
export type BillingCurrency = 'INR' | 'USD';
export type AiOrderStatus =
  | 'CREATED'
  | 'PENDING'
  | 'PAID'
  | 'FULFILLED'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'REFUND_PENDING'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED';

export interface AiPlanPrice {
  amountMinor: number;
  taxMinor: number;
  totalMinor: number;
  credits: number;
}

export interface AiPlan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  features: string[];
  isPopular: boolean;
  sortOrder: number;
  active: boolean;
  archivedAt: string | null;
  validityMonths: number;
  creditsOverride: number | null;
  divisorOverride: number | null;
  prices: { INR: AiPlanPrice | null; USD: AiPlanPrice | null };
}

export interface AiBillingConfig {
  id: string;
  enabled: boolean;
  fxInrPerUsd: number;
  priceToCreditDivisor: number;
  creditValidityMonths: number;
  gstPercent: number;
  gstin: string | null;
  sacCode: string | null;
  sellerDetails: Record<string, string>;
  invoicePrefix: string;
  customPurchaseEnabled: boolean;
  customMinInrMinor: number;
  customMaxInrMinor: number;
  customMinUsdMinor: number;
  customMaxUsdMinor: number;
  updatedAt: string;
}

export interface AiGatewayConfig {
  id: string;
  gateway: AiPaymentGateway;
  displayName: string;
  enabled: boolean;
  mode: AiGatewayMode;
  supportedCurrencies: string[];
  publicConfig: Record<string, unknown>;
  sortOrder: number;
  credentialFields: Array<{ key: string; label: string; secret: boolean }>;
  credentials: Record<AiGatewayMode, Record<string, string | null>>;
  webhookSecretSet: Record<AiGatewayMode, boolean>;
  webhookUrls: Record<AiGatewayMode, string> | null;
  lastTestAt: string | null;
  lastTestStatus: string | null;
  lastTestMessage: string | null;
  updatedAt: string;
}

export interface AiStorefront {
  available: boolean;
  closedReason: string | null;
  brand: AiBrandLabels;
  organization: { id: string; name: string } | null;
  currencies: BillingCurrency[];
  plans: AiPlan[];
  gateways: Array<{ gateway: AiPaymentGateway; displayName: string; mode: AiGatewayMode; currencies: string[] }>;
  custom: { enabled: boolean; INR: { minMinor: number; maxMinor: number }; USD: { minMinor: number; maxMinor: number } };
  tax: { gstPercent: number; appliesTo: string[] };
  validityMonths: number;
  priceToCreditDivisor: number;
  balances: { PRO: AiCreditStatus | null; FREE: AiCreditStatus | null };
  expiringLots: Array<{ id: string; remainingCredits: number; expiresAt: string }>;
}

export interface AiCreditStatus {
  accountId: string;
  scope: string;
  availableTokens: number;
  allocatedTokens: number;
  usedTokens: number;
  reservedTokens: number;
  percentRemaining: number;
  warningLevel: string;
}

export interface AiQuote {
  currency: BillingCurrency;
  amountMinor: number;
  taxPercent: number;
  taxMinor: number;
  totalMinor: number;
  credits: number;
  validityMonths: number;
  expiresAt: string;
  amountLabel: string;
  taxLabel: string;
  totalLabel: string;
  plan: Record<string, unknown>;
}

export interface AiCheckout {
  kind: 'sdk' | 'redirect';
  clientPayload: Record<string, unknown> | null;
  redirectUrl: string | null;
}

export interface AiOrder {
  id: string;
  orderNumber: string;
  organizationId: string;
  buyerUserId: string;
  purchaseType: 'PLAN' | 'CUSTOM';
  planId: string | null;
  planSnapshot: Record<string, unknown>;
  currency: BillingCurrency;
  amountMinor: number;
  taxMinor: number;
  totalMinor: number;
  taxPercent: number;
  creditsToGrant: number;
  validityMonths: number;
  gateway: AiPaymentGateway;
  gatewayMode: AiGatewayMode;
  gatewayOrderId: string | null;
  gatewayPaymentId: string | null;
  status: AiOrderStatus;
  failureReason: string | null;
  paidAt: string | null;
  fulfilledAt: string | null;
  refundedMinor: number;
  creditsReversed: number;
  totalLabel: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
  organization?: { id: string; name: string };
  buyer?: { id: string; email: string; name: string | null };
  invoice?: { id: string; invoiceNumber: string; taxBreakdown?: Record<string, unknown> } | null;
  refunds?: Array<{ id: string; amountMinor: number; status: string; reason: string | null; creditsReversed: number; creditShortfall: number; createdAt: string }>;
  events?: Array<{ id: string; eventType: string; signatureValid: boolean; processedAt: string | null; processingError: string | null; receivedAt: string }>;
  lots?: Array<{ id: string; accountId: string; status: string; originalCredits: number; remainingCredits: number; expiresAt: string; parentLotId: string | null }>;
}

export interface AiPage<T> {
  data: T[];
  meta: ApiMeta;
}
