import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Lock, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { formatCredits, formatDate } from '@/features/ai/components/ai-format';
import { extractApiError } from '@/lib/api';
import { aiBillingApi } from '@/services/ai-billing.api';
import type { AiOrder, AiPaymentGateway, AiPlan, AiStorefront, BillingCurrency } from '@/types/ai';
import { clearIdempotencyKey, idempotencyKeyFor, launchCheckout } from './checkout';
import type { CustomSelection } from './CustomCreditsCard';

export type PurchaseSelection = { kind: 'plan'; plan: AiPlan } | { kind: 'custom'; custom: CustomSelection };

const BILLING_STORAGE_KEY = 'softlogic-ai-billing-details';

type BillingDetails = { legalName: string; gstin: string; state: string; address: string };

const loadBillingDetails = (fallbackName: string): BillingDetails => {
  try {
    const raw = window.localStorage.getItem(BILLING_STORAGE_KEY);
    if (raw) return { legalName: fallbackName, gstin: '', state: '', address: '', ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return { legalName: fallbackName, gstin: '', state: '', address: '' };
};

/**
 * Step between choosing a plan / custom credits and paying: shows the
 * server-calculated price, GST, total, credits and expiry, the enabled
 * gateways for the currency, and optional GST billing details.
 */
export function OrderSummaryDialog({
  storefront,
  currency,
  selection,
  onClose,
  onCompleted,
}: {
  storefront: AiStorefront;
  currency: BillingCurrency;
  selection: PurchaseSelection | null;
  onClose: () => void;
  onCompleted: (order: AiOrder) => void;
}) {
  const open = Boolean(selection);
  const quotePayload = useMemo(
    () => (selection ? (selection.kind === 'plan' ? { planId: selection.plan.id, currency } : { custom: selection.custom, currency }) : null),
    [selection, currency],
  );
  const quoteQuery = useQuery({
    queryKey: ['ai-billing-quote', 'summary', quotePayload],
    queryFn: () => aiBillingApi.quote(quotePayload!),
    enabled: Boolean(quotePayload),
    retry: false,
  });
  const gateways = storefront.gateways.filter((gateway) => gateway.currencies.includes(currency));
  const [gateway, setGateway] = useState<AiPaymentGateway | null>(null);
  const [details, setDetails] = useState<BillingDetails>(() => loadBillingDetails(storefront.organization?.name ?? ''));
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => setGateway((current) => (current && gateways.some((item) => item.gateway === current) ? current : gateways[0]?.gateway ?? null)), 0);
    return () => window.clearTimeout(timer);
    // Pick a default gateway when the dialog opens or the currency changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currency]);

  const selectionKey = quotePayload && gateway ? JSON.stringify({ ...quotePayload, gateway }) : '';

  const payMutation = useMutation({
    mutationFn: async () => {
      if (!quotePayload || !gateway) throw new Error('Choose a payment method');
      try {
        window.localStorage.setItem(BILLING_STORAGE_KEY, JSON.stringify(details));
      } catch {
        // ignore
      }
      const gstin = details.gstin.trim().toUpperCase();
      const { order, checkout } = await aiBillingApi.createOrder(
        {
          ...quotePayload,
          currency,
          gateway,
          billingDetails:
            currency === 'INR'
              ? {
                  legalName: details.legalName.trim() || null,
                  gstin: gstin || null,
                  state: details.state.trim() || null,
                  address: details.address.trim() || null,
                }
              : { legalName: details.legalName.trim() || null },
        },
        idempotencyKeyFor(selectionKey),
      );
      if (!checkout) {
        // Existing order for the same key that is already settled.
        return { order, outcome: { kind: 'completed' as const, order } };
      }
      const outcome = await launchCheckout(order, checkout, storefront.brand.pro);
      return { order, outcome };
    },
    onSuccess: ({ outcome }) => {
      if (outcome.kind === 'redirected') return;
      clearIdempotencyKey(selectionKey);
      if (outcome.kind === 'completed') onCompleted(outcome.order);
      else toast.message('Payment window closed. You can try again any time.');
    },
    onError: (error) => {
      clearIdempotencyKey(selectionKey);
      toast.error(extractApiError(error));
    },
  });

  const quote = quoteQuery.data;
  const title = selection?.kind === 'plan' ? `${selection.plan.name} plan` : 'Custom credits';

  return (
    <Dialog open={open} onOpenChange={(value) => !value && !payMutation.isPending && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Order summary</DialogTitle>
          <DialogDescription>
            {title} · {storefront.brand.pro} for {storefront.organization?.name ?? 'your organization'}
          </DialogDescription>
        </DialogHeader>

        {quoteQuery.isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Spinner className="h-6 w-6 text-brand-primary" />
          </div>
        ) : quoteQuery.isError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">{extractApiError(quoteQuery.error)}</p>
        ) : quote ? (
          <div className="space-y-4">
            <div className="space-y-1.5 rounded-xl border border-line bg-surface-variant/60 px-4 py-3 text-sm">
              <SummaryRow label="Price" value={quote.amountLabel} />
              <SummaryRow label={currency === 'INR' ? `GST (${quote.taxPercent}%)` : 'Tax'} value={quote.taxLabel} />
              <div className="border-t border-line pt-1.5">
                <SummaryRow label="Total to pay" value={quote.totalLabel} strong />
              </div>
              <SummaryRow label="Pro credits added to your organization" value={formatCredits(quote.credits)} strong />
              <SummaryRow label="Credits valid until" value={formatDate(quote.expiresAt)} />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Pay with</p>
              {gateways.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {gateways.map((item) => (
                    <button
                      key={item.gateway}
                      type="button"
                      onClick={() => setGateway(item.gateway)}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition ${
                        gateway === item.gateway ? 'border-brand-primary bg-brand-primary/5 text-brand-primary' : 'border-line text-ink-800 hover:bg-surface-variant'
                      }`}
                    >
                      {item.displayName}
                      {item.mode === 'TEST' ? <Badge variant="info">Test</Badge> : null}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-red-700">No payment method accepts {currency} right now.</p>
              )}
            </div>

            <div className="rounded-lg border border-line px-3 py-2">
              <button type="button" className="text-sm font-semibold text-brand-primary hover:underline" onClick={() => setShowDetails((value) => !value)}>
                {showDetails ? 'Hide billing details' : currency === 'INR' ? 'Add GST billing details (optional)' : 'Add billing name (optional)'}
              </button>
              {showDetails ? (
                <div className="mt-2 grid gap-2">
                  <Input placeholder="Legal name on invoice" value={details.legalName} onChange={(event) => setDetails({ ...details, legalName: event.target.value })} />
                  {currency === 'INR' ? (
                    <>
                      <Input placeholder="GSTIN (15 characters)" maxLength={15} value={details.gstin} onChange={(event) => setDetails({ ...details, gstin: event.target.value })} />
                      <Input placeholder="State (for CGST/SGST vs IGST)" value={details.state} onChange={(event) => setDetails({ ...details, state: event.target.value })} />
                      <Input placeholder="Billing address" value={details.address} onChange={(event) => setDetails({ ...details, address: event.target.value })} />
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>

            <p className="flex items-start gap-2 text-xs text-ink-500">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              Credits are added automatically once the payment is confirmed by the gateway. Unused credits expire after {quote.validityMonths} months.
            </p>
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" disabled={payMutation.isPending} onClick={onClose}>
            Back
          </Button>
          <Button type="button" variant="primary" disabled={!quote || !gateway || payMutation.isPending} onClick={() => payMutation.mutate()}>
            {payMutation.isPending ? <Spinner className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            {quote ? `Pay ${quote.totalLabel}` : 'Pay'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <p className="flex justify-between gap-3">
      <span className="text-ink-600">{label}</span>
      <span className={strong ? 'text-right font-black text-ink-900' : 'text-right font-semibold text-ink-900'}>{value}</span>
    </p>
  );
}

