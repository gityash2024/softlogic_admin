/** Existing tab identities remain bookmark-compatible. */
export const AI_NAVIGATION = [
  { label: 'Overview', tabs: [{ id: 'overview', label: 'Usage dashboard' }] },
  { label: 'Access & credits', tabs: [{ id: 'tiers', label: 'Access & limits' }, { id: 'credits', label: 'Credit wallets' }, { id: 'ledger', label: 'Credit ledger' }] },
  { label: 'Plans & payments', tabs: [{ id: 'plans', label: 'Plan catalog' }, { id: 'billing-settings', label: 'Billing settings' }, { id: 'gateways', label: 'Payment gateways' }, { id: 'orders', label: 'Orders & refunds' }] },
  { label: 'Accounts', tabs: [{ id: 'organizations', label: 'Organizations' }, { id: 'users', label: 'Users' }] },
  { label: 'Providers', tabs: [{ id: 'configuration', label: 'Pro configuration' }, { id: 'pricing', label: 'Model pricing' }, { id: 'free-health', label: 'Free AI health' }, { id: 'google-billing', label: 'Google billing' }] },
] as const;

export type AiTab = (typeof AI_NAVIGATION)[number]['tabs'][number]['id'];
export const aiTab = (value: string | null): AiTab =>
  AI_NAVIGATION.flatMap(group => [...group.tabs]).some(tab => tab.id === value) ? value as AiTab : 'overview';
export const aiGroup = (value: AiTab) => AI_NAVIGATION.find(group => group.tabs.some(tab => tab.id === value))!;
