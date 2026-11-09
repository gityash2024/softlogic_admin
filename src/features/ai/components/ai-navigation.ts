/** Existing tab identities remain bookmark-compatible. */
export const AI_NAVIGATION = [
  {
    label: 'Overview',
    description: 'Monitor Free, Pro and on-device usage alongside platform credit balances.',
    tabs: [{ id: 'overview', label: 'Usage dashboard' }],
  },
  {
    label: 'Access & credits',
    description: 'Manage AI access, credit balances and account activity.',
    tabs: [{ id: 'tiers', label: 'Access & limits' }, { id: 'credits', label: 'Credit wallets' }, { id: 'ledger', label: 'Credit ledger' }],
  },
  {
    label: 'Plans & payments',
    description: 'Manage plans, configure checkout and review payment activity.',
    tabs: [{ id: 'plans', label: 'Plan catalog' }, { id: 'billing-settings', label: 'Billing settings' }, { id: 'gateways', label: 'Payment gateways' }, { id: 'orders', label: 'Orders & refunds' }],
  },
  {
    label: 'Accounts',
    description: 'Review AI access and credit balances for organizations and users.',
    tabs: [{ id: 'organizations', label: 'Organizations' }, { id: 'users', label: 'Users' }],
  },
  {
    label: 'Providers',
    description: 'Manage provider settings and review model pricing, health and billing.',
    tabs: [{ id: 'configuration', label: 'Pro configuration' }, { id: 'pricing', label: 'Model pricing' }, { id: 'free-health', label: 'Free AI health' }, { id: 'google-billing', label: 'Google billing' }],
  },
] as const;

export type AiTab = (typeof AI_NAVIGATION)[number]['tabs'][number]['id'];
export const aiTab = (value: string | null): AiTab =>
  AI_NAVIGATION.flatMap(group => [...group.tabs]).some(tab => tab.id === value) ? value as AiTab : 'overview';
export const aiGroup = (value: AiTab) => AI_NAVIGATION.find(group => group.tabs.some(tab => tab.id === value))!;
