import { useEffect, useState } from 'react';

import type { BillingCurrency } from '@/types/ai';

export const formatCredits = (value: number | null | undefined) => new Intl.NumberFormat('en-IN').format(value ?? 0);

export const formatDateTime = (value: string | number | null | undefined) =>
  value ? new Date(value).toLocaleString() : '—';

export const formatDate = (value: string | null | undefined) => (value ? new Date(value).toLocaleDateString() : '—');

export const formatMinor = (currency: BillingCurrency | string, minor: number | null | undefined) =>
  new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency: currency || 'INR',
    minimumFractionDigits: 2,
  }).format((minor ?? 0) / 100);

export const formatUsdMicros = (micros: number | null | undefined) =>
  `$${((micros ?? 0) / 1_000_000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`;

export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Mirrors backend `creditsForAmount`: 1 credit = 1 USD micro, buyers pay `divisor` x. */
export const previewCredits = (currency: BillingCurrency, amountMinor: number | null, fxInrPerUsd: number, divisor: number) => {
  if (!amountMinor || amountMinor <= 0 || !divisor) return 0;
  const usdMicros = currency === 'USD' ? amountMinor * 10_000 : (amountMinor * 10_000) / fxInrPerUsd;
  return Math.floor(usdMicros / divisor);
};
