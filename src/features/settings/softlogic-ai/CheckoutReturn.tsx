import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock, FileText, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { openReceipt } from '@/features/ai/components/ai-billing-utils';
import { formatCredits, formatMinor } from '@/features/ai/components/ai-format';
import { extractApiError } from '@/lib/api';
import { aiBillingApi } from '@/services/ai-billing.api';
import type { AiOrderStatus } from '@/types/ai';

const TERMINAL: AiOrderStatus[] = ['FULFILLED', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'PARTIALLY_REFUNDED'];
const MAX_POLL_MS = 3 * 60_000;

/**
 * Shown when the buyer comes back from a gateway (or finishes an in-page
 * SDK checkout). Confirms once with the gateway, then polls until the order
 * is fulfilled; webhooks may land first, which is fine.
 */
export function CheckoutReturn({ orderId, cancelled, onDone }: { orderId: string; cancelled: boolean; onDone: () => void }) {
  const queryClient = useQueryClient();
  const confirmed = useRef(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setTimedOut(true), MAX_POLL_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (confirmed.current) return;
    confirmed.current = true;
    const run = cancelled ? aiBillingApi.cancel(orderId) : aiBillingApi.confirm(orderId, {});
    run
      .then(() => queryClient.invalidateQueries({ queryKey: ['ai-billing-buyer-order', orderId] }))
      .catch((error) => setConfirmError(extractApiError(error)));
  }, [cancelled, orderId, queryClient]);

  const orderQuery = useQuery({
    queryKey: ['ai-billing-buyer-order', orderId],
    queryFn: () => aiBillingApi.order(orderId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && TERMINAL.includes(status)) return false;
      return timedOut ? false : 3000;
    },
  });

  const order = orderQuery.data;
  useEffect(() => {
    if (order?.status === 'FULFILLED') {
      queryClient.invalidateQueries({ queryKey: ['ai-billing-storefront'] });
      queryClient.invalidateQueries({ queryKey: ['ai-billing-buyer-orders'] });
    }
  }, [order?.status, queryClient]);

  const fulfilled = order?.status === 'FULFILLED';
  const failed = order && ['FAILED', 'CANCELLED', 'EXPIRED'].includes(order.status);
  const waitedTooLong = !fulfilled && !failed && timedOut;

  return (
    <div
      className={`rounded-2xl border px-5 py-5 ${
        fulfilled ? 'border-emerald-200 bg-emerald-50' : failed ? 'border-red-200 bg-red-50' : 'border-brand-primary/20 bg-brand-primary/5'
      }`}
    >
      <div className="flex items-start gap-3">
        {fulfilled ? (
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
        ) : failed ? (
          <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-red-600" />
        ) : waitedTooLong ? (
          <Clock className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" />
        ) : (
          <Spinner className="mt-0.5 h-6 w-6 shrink-0 text-brand-primary" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-base font-black text-ink-900">
            {fulfilled
              ? 'Payment successful. Credits added.'
              : failed
                ? cancelled
                  ? 'Payment cancelled'
                  : 'Payment not completed'
                : waitedTooLong
                  ? 'Still waiting for the payment confirmation'
                  : 'Confirming your payment…'}
          </p>
          {order ? (
            <p className="mt-1 text-sm text-ink-700">
              Order {order.orderNumber} · {formatMinor(order.currency, order.totalMinor)} · {formatCredits(order.creditsToGrant)} Pro credits
              {order.failureReason && failed ? ` · ${order.failureReason}` : ''}
            </p>
          ) : null}
          {waitedTooLong ? (
            <p className="mt-1 text-sm text-ink-600">
              If you were charged, the credits are added automatically as soon as the gateway notifies us. You can safely leave this page.
            </p>
          ) : null}
          {confirmError && !fulfilled ? <p className="mt-1 text-xs text-ink-500">{confirmError}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {fulfilled ? (
              <Button type="button" variant="outline" size="sm" onClick={() => openReceipt(orderId)}>
                <FileText className="h-4 w-4" />
                View receipt
              </Button>
            ) : null}
            <Button type="button" variant="ghost" size="sm" onClick={onDone}>
              {fulfilled || failed ? 'Done' : 'Hide'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
