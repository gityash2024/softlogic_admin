import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PaginationFooter } from '@/features/admin/admin-list-ui';
import { openReceipt, orderStatusVariant } from '@/features/ai/components/ai-billing-utils';
import { formatCredits, formatDateTime, formatMinor } from '@/features/ai/components/ai-format';
import { extractApiError } from '@/lib/api';
import { aiBillingApi } from '@/services/ai-billing.api';

export function OrderHistoryTable() {
  const [page, setPage] = useState(1);
  const ordersQuery = useQuery({
    queryKey: ['ai-billing-buyer-orders', page],
    queryFn: () => aiBillingApi.orders({ page, perPage: 10 }),
  });
  const rows = ordersQuery.data?.data ?? [];

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="px-5 py-4">
        <p className="text-base font-bold text-ink-900">Purchase history</p>
        <p className="text-xs text-ink-500">Receipts are available once a payment is confirmed.</p>
      </div>
      {ordersQuery.isError ? <p className="px-5 pb-4 text-sm text-red-700">{extractApiError(ordersQuery.error)}</p> : null}
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-surface-variant text-xs uppercase tracking-wide text-ink-500">
            <tr>
              <th className="px-5 py-2">Order</th>
              <th className="px-3 py-2">Purchase</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">Credits</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {ordersQuery.isLoading ? (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-sm text-ink-500">
                  Loading…
                </td>
              </tr>
            ) : rows.length ? (
              rows.map((order) => (
                <tr key={order.id} className="border-t border-line">
                  <td className="px-5 py-2">
                    <p className="font-mono text-xs font-semibold text-ink-900">{order.orderNumber}</p>
                    <p className="text-xs text-ink-500">{formatDateTime(order.createdAt)}</p>
                  </td>
                  <td className="px-3 py-2 text-xs">{order.purchaseType === 'CUSTOM' ? 'Custom credits' : String(order.planSnapshot?.name ?? 'Plan')}</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatMinor(order.currency, order.totalMinor)}</td>
                  <td className="px-3 py-2 text-right">{formatCredits(order.creditsToGrant)}</td>
                  <td className="px-3 py-2">
                    <Badge variant={orderStatusVariant(order.status)}>{order.status.replaceAll('_', ' ')}</Badge>
                    {order.gatewayMode === 'TEST' ? <Badge className="ml-1" variant="info">Test</Badge> : null}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {['FULFILLED', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(order.status) ? (
                      <Button type="button" variant="ghost" size="sm" onClick={() => openReceipt(order.id)}>
                        <FileText className="h-4 w-4" />
                        Receipt
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-sm text-ink-500">
                  No purchases yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <PaginationFooter meta={ordersQuery.data?.meta} onPageChange={setPage} />
    </div>
  );
}
