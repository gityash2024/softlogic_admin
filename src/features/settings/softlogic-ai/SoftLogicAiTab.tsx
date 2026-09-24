import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { CalendarClock, Sparkles, Zap } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { formatCredits, formatDate } from '@/features/ai/components/ai-format';
import type { AiCreditStatus, AiOrder, AiStorefront, BillingCurrency } from '@/types/ai';
import { CheckoutReturn } from './CheckoutReturn';
import { CustomCreditsCard } from './CustomCreditsCard';
import { OrderHistoryTable } from './OrderHistoryTable';
import { OrderSummaryDialog, type PurchaseSelection } from './OrderSummaryDialog';
import { PlanCards } from './PlanCards';

/** Settings › <Brand> AI: balances, plan cards, custom credits, checkout and history. */
export function SoftLogicAiTab({ storefront }: { storefront: AiStorefront }) {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const returnOrderId = searchParams.get('order');
  const cancelled = searchParams.get('cancelled') === '1';
  const [currency, setCurrency] = useState<BillingCurrency>(storefront.currencies.includes('INR') ? 'INR' : storefront.currencies[0] ?? 'INR');
  const [selection, setSelection] = useState<PurchaseSelection | null>(null);
  const [completedOrder, setCompletedOrder] = useState<string | null>(null);

  const clearReturn = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('order');
    next.delete('cancelled');
    setSearchParams(next, { replace: true });
    setCompletedOrder(null);
  };

  const onCompleted = (order: AiOrder) => {
    setSelection(null);
    setCompletedOrder(order.id);
    queryClient.invalidateQueries({ queryKey: ['ai-billing-storefront'] });
    queryClient.invalidateQueries({ queryKey: ['ai-billing-buyer-orders'] });
  };

  const trackedOrder = completedOrder ?? returnOrderId;
  const pro = storefront.balances.PRO;
  const free = storefront.balances.FREE;

  return (
    <div className="space-y-6">
      {trackedOrder ? <CheckoutReturn key={trackedOrder} orderId={trackedOrder} cancelled={!completedOrder && cancelled} onDone={clearReturn} /> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <BalanceCard title={storefront.brand.pro} icon={<Zap className="h-5 w-5" />} status={pro} tone="pro" />
        <BalanceCard title={storefront.brand.free} icon={<Sparkles className="h-5 w-5" />} status={free} tone="free" />
        <Card className="px-5 py-4">
          <div className="flex items-center gap-2 text-ink-900">
            <CalendarClock className="h-5 w-5 text-brand-orange" />
            <p className="text-sm font-bold">Expiring Pro credits</p>
          </div>
          {storefront.expiringLots.length ? (
            <ul className="mt-2 space-y-1 text-sm">
              {storefront.expiringLots.slice(0, 4).map((lot) => (
                <li key={lot.id} className="flex justify-between gap-2">
                  <span className="font-semibold text-ink-900">{formatCredits(lot.remainingCredits)}</span>
                  <span className="text-xs text-ink-500">expire {formatDate(lot.expiresAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-ink-500">Purchased credits stay valid for {storefront.validityMonths} months from the purchase date.</p>
          )}
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-xl font-black text-ink-900">Buy {storefront.brand.pro} credits</h3>
          <p className="text-sm text-ink-500">
            Credits are added to {storefront.organization?.name ?? 'your organization'} and can then be allocated to your users or child organizations.
          </p>
        </div>
        {storefront.currencies.length > 1 ? (
          <div className="inline-flex rounded-lg border border-line bg-white p-1">
            {storefront.currencies.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setCurrency(option)}
                className={`rounded-md px-3 py-1.5 text-xs font-bold ${currency === option ? 'bg-brand-navy text-white' : 'text-ink-500'}`}
              >
                {option === 'INR' ? '₹ INR' : '$ USD'}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <PlanCards plans={storefront.plans} currency={currency} gstPercent={storefront.tax.gstPercent} onSelect={(plan) => setSelection({ kind: 'plan', plan })} />

      {storefront.custom.enabled ? (
        <CustomCreditsCard key={currency} storefront={storefront} currency={currency} onContinue={(custom) => setSelection({ kind: 'custom', custom })} />
      ) : null}

      <OrderHistoryTable />

      <OrderSummaryDialog storefront={storefront} currency={currency} selection={selection} onClose={() => setSelection(null)} onCompleted={onCompleted} />
    </div>
  );
}

function BalanceCard({ title, icon, status, tone }: { title: string; icon: React.ReactNode; status: AiCreditStatus | null; tone: 'pro' | 'free' }) {
  const percent = status ? Math.max(0, Math.min(100, status.percentRemaining)) : 0;
  return (
    <Card className="px-5 py-4">
      <div className={`flex items-center gap-2 ${tone === 'pro' ? 'text-brand-purple' : 'text-brand-primary'}`}>
        {icon}
        <p className="text-sm font-bold text-ink-900">{title}</p>
      </div>
      <p className="mt-2 text-2xl font-black text-ink-900">{formatCredits(status?.availableTokens)}</p>
      <p className="text-xs text-ink-500">
        available of {formatCredits(status?.allocatedTokens)} · {formatCredits(status?.usedTokens)} used
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-variant">
        <div className={`h-full ${percent <= 10 ? 'bg-red-500' : percent <= 20 ? 'bg-amber-500' : tone === 'pro' ? 'bg-brand-purple' : 'bg-brand-primary'}`} style={{ width: `${percent}%` }} />
      </div>
    </Card>
  );
}
