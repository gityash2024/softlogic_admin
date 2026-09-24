import type { OrganizationSummary, SafeUserContext } from '@/types/api';
import type { AiBrandLabels } from '@/types/ai';

/**
 * User-facing AI product names. Mirrors the backend `aiBrandLabels`:
 * white-label (SmartBoard) organizations see "SmartBoard AI", everyone else
 * "SoftLogic AI". Provider names (Gemini) stay only in Super Admin config.
 */
export function aiBrandLabelsForOrganization(organization?: Pick<OrganizationSummary, 'brandingMode'> | null): AiBrandLabels {
  const product = organization?.brandingMode === 'WHITE_LABEL' ? 'SmartBoard AI' : 'SoftLogic AI';
  return { product, free: `${product} Free`, pro: `${product} Pro` };
}

export function aiBrandLabelsForUser(user?: SafeUserContext | null): AiBrandLabels {
  return aiBrandLabelsForOrganization(user?.primaryOrganization ?? null);
}

export const AI_BUYER_ROLES = new Set(['CUSTOMER_ADMIN', 'ADMIN', 'PARTNER_ADMIN']);

export function canBuyAiCredits(user?: SafeUserContext | null): boolean {
  return Boolean(user && AI_BUYER_ROLES.has(user.role));
}
