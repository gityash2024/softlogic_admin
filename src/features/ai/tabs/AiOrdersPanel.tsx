import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, RefreshCw, Undo2 } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { ActiveFilterChips, ExportButtons, PaginationFooter } from '@/features/admin/admin-list-ui';
import { extractApiError } from '@/lib/api';
import { aiBillingApi } from '@/services/ai-billing.api';
import type { AdminExportFormat } from '@/services/admin-api';
import type { AiOrder, AiOrderStatus } from '@/types/ai';
import { DebouncedSearchInput, DetailDrawer, EmptyRow, KeyValueGrid, LoadingBlock, SectionHeader } from '../components/ai-ui';
import { formatCredits, formatDate, formatDateTime, formatMinor } from '../components/ai-format';
import { openReceipt, orderStatusVariant } from '../components/ai-billing-utils';
import { useAiListParams } from '../components/useAiListParams';
import { FilterSelect } from './AiOrganizationsTab';

const KEYS = ['search', 'status', 'gateway', 'mode', 'from', 'to'] as const;

const STATUS_OPTIONS: Array<[AiOrderStatus, string]> = [
  ['FULFILLED', 'Fulfilled'],
  ['PENDING', 'Pending'],
  ['CREATED', 'Created'],
  ['PAID', 'Paid (not yet fulfilled)'],
  ['FAILED', 'Failed'],
  ['CANCELLED', 'Cancelled'],
  ['EXPIRED', 'Expired'],
  ['REFUND_PENDING', 'Refund pending'],
  ['PARTIALLY_REFUNDED', 'Partially refunded'],
  ['REFUNDED', 'Refunded'],
];

export function AiOrdersPanel() {
  const { values, page, set, clear, chips } = useAiListParams('ord', KEYS);
  const query = {
    page,
    perPage: 20,
    search: values.search || undefined,
    status: values.status || undefined,
    gateway: values.gateway || undefined,
    mode: values.mode || undefined,
    from: values.from || undefined,
    to: values.to || undefined,
  };
  const ordersQuery = useQuery({ queryKey: ['ai-billing-orders', query], queryFn: () => aiBillingApi.adminOrders(query), refetchInterval: 30_000 });
  const [detailId, setDetailId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const onExport = async (format: AdminExportFormat) => {
    setExporting(true);
    try {
      await aiBillingApi.exportOrders({ ...query, page: undefined, perPage: undefined }, format);
    } catch (error) {
      toast.error(extractApiError(error));
    } finally {
      setExporting(false);
    }
  };

  const rows = ordersQuery.data?.data ?? [];

  return (
    <Card className="space-y-4 px-4 py-5 sm:px-6">
      <SectionHeader title="Orders" description="All Pro credit purchases. Open an order to reconcile it with the gateway or refund unused credits." actions={<ExportButtons onExport={onExport} loading={exporting} />} />
      <div className="grid gap-3 rounded-lg border border-line bg-surface-variant p-3 md:grid-cols-3 xl:grid-cols-6">
        <DebouncedSearchInput className="xl:col-span-2" value={values.search} onChange={(value) => set('search', value)} placeholder="Order number, organization, buyer" />
        <FilterSelect value={values.status} onChange={(value) => set('status', value)} placeholder="All statuses" options={STATUS_OPTIONS} />
        <FilterSelect
          value={values.gateway}
          onChange={(value) => set('gateway', value)}
          placeholder="All gateways"
          options={[['RAZORPAY', 'Razorpay'], ['STRIPE', 'Stripe'], ['PAYPAL', 'PayPal'], ['CASHFREE', 'Cashfree'], ['PHONEPE', 'PhonePe']]}
        />
        <FilterSelect value={values.mode} onChange={(value) => set('mode', value)} placeholder="Test and live" options={[['TEST', 'Test'], ['LIVE', 'Live']]} />
        <div className="grid grid-cols-2 gap-2">
          <Input type="date" aria-label="From date" value={values.from} onChange={(event) => set('from', event.target.value)} />
          <Input type="date" aria-label="To date" value={values.to} onChange={(event) => set('to', event.target.value)} />
        </div>
      </div>
      <ActiveFilterChips
        filters={chips({ search: 'Search', status: 'Status', gateway: 'Gateway', mode: 'Mode', from: 'From', to: 'To' })}
        onRemove={(key) => set(key as (typeof KEYS)[number], null)}
        onClearAll={clear}
      />
      {ordersQuery.isError ? <p className="text-sm text-red-700">{extractApiError(ordersQuery.error)}</p> : null}
      <div className="overflow-hidden rounded-lg border border-line">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="bg-surface-variant text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-3 py-2">Order</th>
                <th className="px-3 py-2">Organization</th>
                <th className="px-3 py-2">Purchase</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-right">Credits</th>
                <th className="px-3 py-2">Gateway</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {ordersQuery.isLoading ? (
                <EmptyRow colSpan={7} message="Loading…" />
              ) : rows.length ? (
                rows.map((order) => (
                  <tr key={order.id} className="cursor-pointer border-t border-line hover:bg-surface-variant/50" onClick={() => setDetailId(order.id)}>
                    <td className="px-3 py-2">
                      <p className="font-mono text-xs font-semibold text-ink-900">{order.orderNumber}</p>
                      <p className="text-xs text-ink-500">{formatDateTime(order.createdAt)}</p>
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-semibold text-ink-900">{order.organization?.name ?? '—'}</p>
                      <p className="text-xs text-ink-500">{order.buyer?.email}</p>
                    </td>
                    <td className="px-3 py-2 text-xs">{order.purchaseType === 'CUSTOM' ? 'Custom credits' : String(order.planSnapshot?.name ?? 'Plan')}</td>
                    <td className="px-3 py-2 text-right font-semibold">{formatMinor(order.currency, order.totalMinor)}</td>
                    <td className="px-3 py-2 text-right">{formatCredits(order.creditsToGrant)}</td>
                    <td className="px-3 py-2 text-xs">
                      {order.gateway}
                      {order.gatewayMode === 'TEST' ? <Badge className="ml-1" variant="info">TEST</Badge> : null}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={orderStatusVariant(order.status)}>{order.status.replaceAll('_', ' ')}</Badge>
                    </td>
                  </tr>
                ))
              ) : (
                <EmptyRow colSpan={7} message="No orders match the selected filters." />
              )}
            </tbody>
          </table>
        </div>
        <PaginationFooter meta={ordersQuery.data?.meta} onPageChange={(next) => set('page', next)} />
      </div>
      <OrderDetailDrawer id={detailId} onClose={() => setDetailId(null)} />
    </Card>
  );
}

function OrderDetailDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const detailQuery = useQuery({ queryKey: ['ai-billing-order', id], queryFn: () => aiBillingApi.adminOrder(id as string), enabled: Boolean(id) });
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [recordOnly, setRecordOnly] = useState(false);
  const order = detailQuery.data;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['ai-billing-order', id] });
    queryClient.invalidateQueries({ queryKey: ['ai-billing-orders'] });
    queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0] ?? '').startsWith('ai-summary') });
  };

  const reconcileMutation = useMutation({
    mutationFn: () => aiBillingApi.reconcile(id as string),
    onSuccess: (result) => {
      toast.success(`Order is ${result.status.replaceAll('_', ' ').toLowerCase()}`);
      refresh();
    },
    onError: (error) => toast.error(extractApiError(error)),
  });
  const refundMutation = useMutation({
    mutationFn: () =>
      aiBillingApi.refund(id as string, {
        amountMinor: refundAmount.trim() ? Math.round(Number(refundAmount) * 100) : null,
        reason: refundReason.trim() || null,
        recordOnly,
      }),
    onSuccess: () => {
      toast.success('Refund recorded. Only unused credits were reversed.');
      setRefundAmount('');
      setRefundReason('');
      refresh();
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const refundable = order ? Math.max(order.totalMinor - order.refundedMinor, 0) : 0;
  const canRefund = order && ['FULFILLED', 'PARTIALLY_REFUNDED', 'PAID'].includes(order.status) && refundable > 0;
  const canReconcile = order && ['CREATED', 'PENDING', 'PAID', 'FAILED', 'REFUND_PENDING'].includes(order.status);

  return (
    <DetailDrawer open={Boolean(id)} onOpenChange={(open) => !open && onClose()} title={order?.orderNumber ?? 'Order'} description={order ? `${order.organization?.name ?? ''} · ${formatDateTime(order.createdAt)}` : undefined}>
      {detailQuery.isLoading ? (
        <LoadingBlock />
      ) : detailQuery.isError ? (
        <p className="text-sm text-red-700">{extractApiError(detailQuery.error)}</p>
      ) : order ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Badge variant={orderStatusVariant(order.status)}>{order.status.replaceAll('_', ' ')}</Badge>
            {order.gatewayMode === 'TEST' ? <Badge variant="info">TEST MODE</Badge> : null}
          </div>
          <OrderSummaryGrid order={order} />
          <div className="flex flex-wrap gap-2">
            {order.invoice ? (
              <Button type="button" variant="outline" size="sm" onClick={() => openReceipt(order.id)}>
                <FileText className="h-4 w-4" />
                Invoice {order.invoice.invoiceNumber}
              </Button>
            ) : null}
            {canReconcile ? (
              <Button type="button" variant="outline" size="sm" disabled={reconcileMutation.isPending} onClick={() => reconcileMutation.mutate()}>
                {reconcileMutation.isPending ? <Spinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
                Reconcile with gateway
              </Button>
            ) : null}
          </div>

          {canRefund ? (
            <div className="space-y-2 rounded-lg border border-line px-3 py-3">
              <p className="text-sm font-bold text-ink-900">Refund</p>
              <p className="text-xs text-ink-500">
                Up to {formatMinor(order.currency, refundable)}. Credits are reversed in proportion, only from unused balances; any shortfall is flagged and never makes a balance negative.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input type="number" min={0} step="0.01" placeholder={`Amount (full: ${refundable / 100})`} value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} />
                <Input placeholder="Reason" value={refundReason} onChange={(event) => setRefundReason(event.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-xs text-ink-600">
                <input type="checkbox" checked={recordOnly} onChange={(event) => setRecordOnly(event.target.checked)} />
                Already refunded in the gateway dashboard (record only)
              </label>
              <Button type="button" variant="destructive" size="sm" disabled={refundMutation.isPending} onClick={() => refundMutation.mutate()}>
                {refundMutation.isPending ? <Spinner className="h-4 w-4" /> : <Undo2 className="h-4 w-4" />}
                Refund
              </Button>
            </div>
          ) : null}

          {order.refunds?.length ? (
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Refunds</p>
              {order.refunds.map((refund) => (
                <div key={refund.id} className="rounded-lg border border-line px-3 py-2 text-xs">
                  <strong>{formatMinor(order.currency, refund.amountMinor)}</strong> · {refund.status} · {formatDateTime(refund.createdAt)}
                  <span className="block text-ink-500">
                    {formatCredits(refund.creditsReversed)} credits reversed
                    {refund.creditShortfall ? ` · ${formatCredits(refund.creditShortfall)} already used (shortfall)` : ''}
                    {refund.reason ? ` · ${refund.reason}` : ''}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {order.lots?.length ? (
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Credit lots</p>
              {order.lots.map((lot) => (
                <div key={lot.id} className="flex justify-between rounded-lg border border-line px-3 py-2 text-xs">
                  <span>
                    {lot.parentLotId ? 'Moved lot' : 'Purchased lot'} · {lot.status}
                  </span>
                  <span>
                    {formatCredits(lot.remainingCredits)} / {formatCredits(lot.originalCredits)} · expires {formatDate(lot.expiresAt)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {order.events?.length ? (
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Gateway events</p>
              {order.events.map((event) => (
                <div key={event.id} className="rounded-lg border border-line px-3 py-2 text-xs">
                  <strong>{event.eventType}</strong> · {formatDateTime(event.receivedAt)}
                  <span className={`block ${event.signatureValid ? 'text-emerald-700' : 'text-red-700'}`}>
                    {event.signatureValid ? 'Signature valid' : 'Invalid signature'}
                    {event.processingError ? ` · ${event.processingError}` : event.processedAt ? ' · processed' : ''}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </DetailDrawer>
  );
}

export function OrderSummaryGrid({ order }: { order: AiOrder }) {
  return (
    <KeyValueGrid
      rows={[
        ['Purchase', order.purchaseType === 'CUSTOM' ? 'Custom credits' : String(order.planSnapshot?.name ?? 'Plan')],
        ['Buyer', order.buyer ? `${order.buyer.name ?? ''} ${order.buyer.email}` : '—'],
        ['Amount', formatMinor(order.currency, order.amountMinor)],
        [`GST (${order.taxPercent}%)`, formatMinor(order.currency, order.taxMinor)],
        ['Total', formatMinor(order.currency, order.totalMinor)],
        ['Credits', formatCredits(order.creditsToGrant)],
        ['Validity', `${order.validityMonths} months`],
        ['Gateway', `${order.gateway} (${order.gatewayMode})`],
        ['Gateway order', order.gatewayOrderId ?? '—'],
        ['Gateway payment', order.gatewayPaymentId ?? '—'],
        ['Paid', formatDateTime(order.paidAt)],
        ['Fulfilled', formatDateTime(order.fulfilledAt)],
        ['Refunded', order.refundedMinor ? `${formatMinor(order.currency, order.refundedMinor)} · ${formatCredits(order.creditsReversed)} credits reversed` : '—'],
        ['Failure', order.failureReason ?? '—'],
      ]}
    />
  );
}
