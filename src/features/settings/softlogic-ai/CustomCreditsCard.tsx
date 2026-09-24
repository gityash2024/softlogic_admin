import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SlidersHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { formatCredits, formatDate, formatMinor, useDebouncedValue } from '@/features/ai/components/ai-format';
import { extractApiError } from '@/lib/api';
import { aiBillingApi } from '@/services/ai-billing.api';
import type { AiStorefront, BillingCurrency } from '@/types/ai';

export type CustomSelection = { currency: BillingCurrency; credits?: number | null; amountMinor?: number | null };

/**
 * "Custom credits": the buyer types either credits or an amount. A debounced
 * server quote shows the price, GST, total and credits live, using the same
 * price ÷ credit rule as the plans.
 */
export function CustomCreditsCard({
  storefront,
  currency,
  onContinue,
}: {
  storefront: AiStorefront;
  currency: BillingCurrency;
  onContinue: (selection: CustomSelection) => void;
}) {
  const [mode, setMode] = useState<'amount' | 'credits'>('amount');
  const [value, setValue] = useState('');
  const debounced = useDebouncedValue(value.trim(), 400);
  const limits = storefront.custom[currency];
  const numeric = Number(debounced);
  const selection: CustomSelection | null =
    debounced && Number.isFinite(numeric) && numeric > 0
      ? mode === 'amount'
        ? { currency, amountMinor: Math.round(numeric * 100) }
        : { currency, credits: Math.floor(numeric) }
      : null;
  const outOfRange = selection?.amountMinor !== undefined && selection?.amountMinor !== null && (selection.amountMinor < limits.minMinor || selection.amountMinor > limits.maxMinor);

  const quoteQuery = useQuery({
    queryKey: ['ai-billing-quote', 'custom', selection],
    queryFn: () => aiBillingApi.quote({ custom: selection!, currency }),
    enabled: Boolean(selection) && !outOfRange,
    retry: false,
    staleTime: 30_000,
  });
  const quote = quoteQuery.data;
  const typing = value.trim() !== debounced;

  return (
    <div className="rounded-2xl border border-line bg-white px-5 py-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
            <SlidersHorizontal className="h-5 w-5" />
          </span>
          <div>
            <p className="text-lg font-black text-ink-900">Custom credits</p>
            <p className="text-xs text-ink-500">
              Enter an amount to pay or the credits you need. {formatMinor(currency, limits.minMinor)} – {formatMinor(currency, limits.maxMinor)} per purchase.
            </p>
          </div>
        </div>
        <div className="inline-flex rounded-lg border border-line bg-white p-1">
          {(['amount', 'credits'] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={`rounded-md px-3 py-1.5 text-xs font-bold ${mode === option ? 'bg-brand-navy text-white' : 'text-ink-500'}`}
              onClick={() => {
                setMode(option);
                setValue(option === 'credits' && quote ? String(quote.credits) : option === 'amount' && quote ? String(quote.amountMinor / 100) : '');
              }}
            >
              {option === 'amount' ? `Amount (${currency === 'INR' ? '₹' : '$'})` : 'Credits'}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-2">
          <Input
            type="number"
            min={0}
            step={mode === 'amount' ? '0.01' : '1'}
            inputMode="decimal"
            placeholder={mode === 'amount' ? `e.g. ${limits.minMinor / 100}` : 'e.g. 500000'}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          {outOfRange ? (
            <p className="text-xs font-semibold text-red-700">
              Enter between {formatMinor(currency, limits.minMinor)} and {formatMinor(currency, limits.maxMinor)}.
            </p>
          ) : quoteQuery.isError ? (
            <p className="text-xs font-semibold text-red-700">{extractApiError(quoteQuery.error)}</p>
          ) : (
            <p className="text-xs text-ink-500">Prices are calculated by SoftLogic; the total below is what you pay.</p>
          )}
        </div>
        <div className="rounded-xl bg-surface-variant px-4 py-3 text-sm">
          {quoteQuery.isFetching || typing ? (
            <div className="flex h-full min-h-[88px] items-center justify-center text-ink-500">
              {selection || typing ? <Spinner className="h-5 w-5" /> : null}
            </div>
          ) : quote && !outOfRange ? (
            <div className="space-y-1">
              <Row label="Price" value={quote.amountLabel ?? formatMinor(currency, quote.amountMinor)} />
              <Row label={`GST (${quote.taxPercent}%)`} value={quote.taxLabel ?? formatMinor(currency, quote.taxMinor)} />
              <Row label="Total" value={quote.totalLabel ?? formatMinor(currency, quote.totalMinor)} strong />
              <Row label="Pro credits" value={formatCredits(quote.credits)} strong />
              <p className="pt-1 text-xs text-ink-500">Valid until {formatDate(quote.expiresAt)}</p>
            </div>
          ) : (
            <p className="flex min-h-[88px] items-center text-ink-500">Your price, GST and credits appear here.</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button type="button" variant="primary" disabled={!quote || !selection || outOfRange || typing || quoteQuery.isFetching} onClick={() => selection && onContinue(selection)}>
          Continue
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <p className="flex justify-between gap-3">
      <span className="text-ink-600">{label}</span>
      <span className={strong ? 'font-black text-ink-900' : 'font-semibold text-ink-900'}>{value}</span>
    </p>
  );
}
