import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  CreditCard,
  Eye,
  EyeOff,
  History,
  Mail,
  Pencil,
  RefreshCw,
  Undo2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { subscriptionsApi } from '@/services/subscriptions.api';
import type { SubscriptionPaymentRecord } from '@/services/subscriptions.api';
import { licensingApi } from '@/services/licensing.api';
import type { AuditLogEntry } from '@/types/api';
import { extractApiError } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { useAuthStore } from '@/lib/auth-store';
import {
  BRANDING_MODE_LABEL,
  SUBSCRIPTION_STATUS_LABEL,
} from '@/types/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

function fingerprintTail(hash: string | null | undefined): string {
  if (!hash) return '—';
  return hash.length > 8 ? `…${hash.slice(-8)}` : hash;
}

function formatMoney(amountMinor: number, currency: string): string {
  const amount = amountMinor / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'INR',
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

type TimelineEntry =
  | { kind: 'activity'; id: string; date: string; title: string; detail: string | null; actor: string | null }
  | { kind: 'payment'; id: string; date: string; title: string; detail: string | null; actor: string | null };

function buildTimeline(
  activity: AuditLogEntry[],
  payments: SubscriptionPaymentRecord[],
): TimelineEntry[] {
  const fromActivity: TimelineEntry[] = activity.map((entry) => ({
    kind: 'activity',
    id: `activity-${entry.id}`,
    date: entry.createdAt,
    title: entry.action,
    detail: entry.summary,
    actor: entry.actorUser?.name ?? entry.actorUser?.email ?? null,
  }));
  const fromPayments: TimelineEntry[] = payments.map((payment) => ({
    kind: 'payment',
    id: `payment-${payment.id}`,
    date: payment.createdAt,
    title: `Payment ${formatMoney(payment.amountMinor, payment.currency)} · ${payment.status}`,
    detail:
      payment.referenceNote ??
      (payment.invoiceNumber ? `Invoice ${payment.invoiceNumber}` : null),
    actor: payment.recordedBy?.name ?? payment.recordedBy?.email ?? null,
  }));
  return [...fromActivity, ...fromPayments].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

function SeatUsageBanner({
  seatLimit,
  seatUsage,
  className,
}: {
  seatLimit: number;
  seatUsage: number;
  className?: string;
}) {
  if (!(seatLimit > 0)) return null;
  const pct = seatUsage / seatLimit;
  if (pct < 0.9) return null;
  const tone =
    pct >= 1
      ? 'border-red-200 bg-red-50 text-red-700'
      : pct >= 0.95
      ? 'border-orange-200 bg-orange-50 text-orange-700'
      : 'border-amber-200 bg-amber-50 text-amber-700';
  const message =
    pct >= 1
      ? 'Seat limit reached'
      : `Seat usage is at ${Math.round(pct * 100)}% of the limit`;
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border px-4 py-3 text-sm leading-6',
        tone,
        className,
      )}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="font-medium">{message}</span>
      <span className="text-xs opacity-80">
        {seatUsage}/{seatLimit} seats
      </span>
    </div>
  );
}

export function SubscriptionDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { user: actor } = useAuthStore();
  const isSuperAdmin = actor?.role === 'SUPER_ADMIN';
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [renewOpen, setRenewOpen] = useState(false);
  const [renewEndDate, setRenewEndDate] = useState('');
  const [renewExtendKeys, setRenewExtendKeys] = useState(true);
  const [renewRecordPayment, setRenewRecordPayment] = useState(false);
  const [renewAmount, setRenewAmount] = useState('');
  const [renewCurrency, setRenewCurrency] = useState('INR');
  const [renewReference, setRenewReference] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const detailQuery = useQuery({
    queryKey: ['subscription-details', id],
    queryFn: () => subscriptionsApi.getDetails(id!),
    enabled: !!id,
  });

  const paymentsQuery = useQuery({
    queryKey: ['subscription-payments', id],
    queryFn: () => subscriptionsApi.listPayments(id!),
    enabled: !!id,
  });

  const timelineQuery = useQuery({
    queryKey: ['subscription-timeline', id],
    queryFn: () => subscriptionsApi.timeline(id!),
    enabled: !!id,
  });

  const emailKeysMutation = useMutation({
    mutationFn: licensingApi.emailActivationKeysToOrgAdmin,
    onSuccess: (data) =>
      toast.success(
        data.delivered
          ? `Emailed ${data.keyCount} key(s) to ${data.recipient}`
          : 'Activation key email queued',
      ),
    onError: (error) => toast.error(extractApiError(error)),
  });

  const resetActivationMutation = useMutation({
    mutationFn: licensingApi.resetActivation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-details', id] });
      toast.success('Device reset — key is available to rebind');
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const renewMutation = useMutation({
    mutationFn: (payload: Parameters<typeof subscriptionsApi.renew>[1]) =>
      subscriptionsApi.renew(id!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-details', id] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      toast.success('Subscription renewed');
      closeRenew();
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const approveMutation = useMutation({
    mutationFn: () => subscriptionsApi.approve(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-details', id] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      toast.success('Subscription approved');
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => subscriptionsApi.reject(id!, reason || null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-details', id] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      toast.success('Subscription rejected');
      setRejectOpen(false);
      setRejectReason('');
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const closeRenew = () => {
    setRenewOpen(false);
    setRenewEndDate('');
    setRenewExtendKeys(true);
    setRenewRecordPayment(false);
    setRenewAmount('');
    setRenewCurrency('INR');
    setRenewReference('');
  };

  const submitRenew = () => {
    if (!id || !renewEndDate) return;
    const amountMajor = Number(renewAmount);
    const payload: Parameters<typeof subscriptionsApi.renew>[1] = {
      newEndDate: renewEndDate,
      extendKeys: renewExtendKeys,
    };
    if (renewRecordPayment && amountMajor > 0) {
      payload.payment = {
        amountMinor: Math.round(amountMajor * 100),
        currency: renewCurrency.trim() || 'INR',
        referenceNote: renewReference.trim() || undefined,
      };
    }
    renewMutation.mutate(payload);
  };

  if (detailQuery.isLoading || !detailQuery.data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-7 w-7 text-brand-primary" />
      </div>
    );
  }

  const subscription = detailQuery.data;
  const usage = Math.min(
    100,
    (subscription.seatUsage / Math.max(subscription.seatLimit, 1)) * 100,
  );
  const allDevices = subscription.hardwareActivationKeys.flatMap((key) =>
    key.activations.map((activation) => ({ activation, key })),
  );

  const payments = paymentsQuery.data ?? [];
  const timeline = buildTimeline(timelineQuery.data ?? [], payments);
  const timelineLoading = timelineQuery.isLoading || paymentsQuery.isLoading;

  const copyValue = async (value: string, message: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(message);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate('/subscriptions')}
          >
            <ArrowLeft className="h-4 w-4" />
            Subscriptions
          </Button>
          <h2 className="mt-2 text-2xl font-black text-ink-900">
            {subscription.planName}
          </h2>
          <p className="text-sm text-ink-500">
            {subscription.organization?.name ?? subscription.user?.email ?? '—'}
          </p>
        </div>
        <div className="flex gap-2">
          {isSuperAdmin && subscription.status === 'PENDING_APPROVAL' && (
            <>
              <Button
                variant="primary"
                disabled={approveMutation.isPending}
                onClick={() => approveMutation.mutate()}
              >
                {approveMutation.isPending ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Approve
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setRejectOpen(true);
                  setRejectReason('');
                }}
              >
                <XCircle className="h-4 w-4" />
                Reject
              </Button>
            </>
          )}
          {isSuperAdmin && subscription.organizationId && (
            <Button
              variant="outline"
              disabled={emailKeysMutation.isPending}
              onClick={() => emailKeysMutation.mutate(subscription.organizationId!)}
            >
              {emailKeysMutation.isPending ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              Email org admin
            </Button>
          )}
          {isSuperAdmin && (
            <Button variant="outline" onClick={() => setRenewOpen(true)}>
              <RefreshCw className="h-4 w-4" />
              Renew
            </Button>
          )}
          {isSuperAdmin && (
            <Button
              variant="primary"
              onClick={() => navigate(`/subscriptions/${subscription.id}/edit`)}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          )}
        </div>
      </div>

      <Card className="space-y-4 px-6 py-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-ink-900">Plan summary</h3>
          <Badge variant={subscription.status === 'ACTIVE' ? 'success' : 'warning'}>
            {SUBSCRIPTION_STATUS_LABEL[subscription.status]}
          </Badge>
        </div>
        <SeatUsageBanner
          seatLimit={subscription.seatLimit}
          seatUsage={subscription.seatUsage}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-500">Branding</p>
            <p className="mt-1 text-sm font-semibold text-ink-900">
              {BRANDING_MODE_LABEL[subscription.brandingMode]}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-500">Start</p>
            <p className="mt-1 text-sm font-semibold text-ink-900">
              {formatDate(subscription.startDate)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-500">End</p>
            <p className="mt-1 text-sm font-semibold text-ink-900">
              {subscription.endDate ? formatDate(subscription.endDate) : 'No end date'}
            </p>
          </div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-500">Seat usage</p>
          <p className="mt-1 text-2xl font-bold text-ink-900">
            {subscription.seatUsage}
            <span className="text-sm font-medium text-ink-500">
              {' '}
              / {subscription.seatLimit}
            </span>
          </p>
          <div className="mt-2">
            <Progress value={usage} />
          </div>
        </div>
      </Card>

      <Card>
        <div className="border-b border-line px-6 py-4">
          <h3 className="text-base font-semibold text-ink-900">Activation keys</h3>
          <p className="text-xs text-ink-500">
            Reveal each key to copy it, or email all keys to the organization admin.
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned</TableHead>
              <TableHead>Expires</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subscription.hardwareActivationKeys.map((key) => {
              const showKey = revealed[key.id];
              const plain = key.activationKey ?? '';
              return (
                <TableRow key={key.id}>
                  <TableCell>{key.label ?? '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="rounded border border-line bg-surface-variant px-2 py-1 font-mono text-xs">
                        {showKey && plain
                          ? plain
                          : plain
                          ? '••••••••••••'
                          : '<legacy — reissue to reveal>'}
                      </code>
                      {plain && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() =>
                              setRevealed((current) => ({
                                ...current,
                                [key.id]: !current[key.id],
                              }))
                            }
                            title={showKey ? 'Hide' : 'Reveal'}
                          >
                            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => copyValue(plain, 'Activation key copied')}
                            title="Copy"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        key.status === 'AVAILABLE'
                          ? 'info'
                          : key.status === 'BOUND'
                          ? 'success'
                          : 'warning'
                      }
                    >
                      {key.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {key.assignedUser?.name ?? key.assignedUser?.email ?? '—'}
                  </TableCell>
                  <TableCell>{key.expiresAt ? formatDate(key.expiresAt) : 'No expiry'}</TableCell>
                </TableRow>
              );
            })}
            {subscription.hardwareActivationKeys.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-ink-500">
                  No activation keys issued yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Card>
        <div className="border-b border-line px-6 py-4">
          <h3 className="text-base font-semibold text-ink-900">Active devices</h3>
          <p className="text-xs text-ink-500">
            Each activation key activates one board/device for users in the same organization.
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Device</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead>Fingerprint</TableHead>
              <TableHead>First bound</TableHead>
              <TableHead>Last verified</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allDevices.map(({ activation, key }) => (
              <TableRow key={activation.id}>
                <TableCell>
                  <p className="text-sm font-semibold text-ink-900">
                    {activation.deviceModel ?? activation.deviceLabel ?? key.label ?? 'Unnamed device'}
                  </p>
                  <p className="text-xs text-ink-500">{key.label ?? '—'}</p>
                </TableCell>
                <TableCell>
                  <p className="text-sm text-ink-700">{activation.devicePlatform ?? '—'}</p>
                  <p className="text-xs text-ink-500">{activation.deviceOsVersion ?? ''}</p>
                </TableCell>
                <TableCell>
                  <code className="font-mono text-xs text-ink-500">
                    {fingerprintTail(activation.deviceFingerprintHash)}
                  </code>
                </TableCell>
                <TableCell>
                  {activation.firstBoundAt ? formatDate(activation.firstBoundAt) : '—'}
                </TableCell>
                <TableCell>
                  {activation.lastVerifiedAt ? formatDate(activation.lastVerifiedAt) : '—'}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      activation.status === 'ACTIVE'
                        ? 'success'
                        : activation.status === 'RESET'
                        ? 'info'
                        : 'warning'
                    }
                  >
                    {activation.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={resetActivationMutation.isPending}
                    onClick={() => resetActivationMutation.mutate(activation.id)}
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                    Reset
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {allDevices.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-ink-500">
                  No devices bound yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Card>
        <div className="flex items-center gap-2 border-b border-line px-6 py-4">
          <CreditCard className="h-4 w-4 text-brand-primary" />
          <div>
            <h3 className="text-base font-semibold text-ink-900">Payment history</h3>
            <p className="text-xs text-ink-500">
              Offline payments recorded against this subscription.
            </p>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Note</TableHead>
              <TableHead>Recorded by</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell>{formatDate(payment.createdAt)}</TableCell>
                <TableCell>
                  <p className="text-sm font-semibold text-ink-900">
                    {formatMoney(payment.amountMinor, payment.currency)}
                  </p>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      payment.status === 'SUCCEEDED' || payment.status === 'PAID'
                        ? 'success'
                        : payment.status === 'FAILED' || payment.status === 'REFUNDED'
                        ? 'warning'
                        : 'info'
                    }
                  >
                    {payment.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-xs text-ink-700">
                    {payment.invoiceNumber ?? '—'}
                  </span>
                </TableCell>
                <TableCell>
                  <p className="text-xs text-ink-700">
                    {payment.periodStart ? formatDate(payment.periodStart) : '—'}
                    {payment.periodEnd ? ` – ${formatDate(payment.periodEnd)}` : ''}
                  </p>
                </TableCell>
                <TableCell>
                  <p className="text-sm text-ink-700">{payment.referenceNote ?? '—'}</p>
                </TableCell>
                <TableCell>
                  <p className="text-sm text-ink-700">
                    {payment.recordedBy?.name ?? payment.recordedBy?.email ?? '—'}
                  </p>
                </TableCell>
              </TableRow>
            ))}
            {payments.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center">
                  {paymentsQuery.isLoading ? (
                    <Spinner className="mx-auto h-5 w-5 text-brand-primary" />
                  ) : (
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-variant text-ink-500">
                        <CreditCard className="h-5 w-5" />
                      </span>
                      <p className="text-sm font-semibold text-ink-900">
                        No payments recorded yet
                      </p>
                      <p className="text-xs text-ink-500">
                        Offline payments will appear here once captured.
                      </p>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Card>
        <div className="flex items-center gap-2 border-b border-line px-6 py-4">
          <History className="h-4 w-4 text-brand-primary" />
          <div>
            <h3 className="text-base font-semibold text-ink-900">Timeline</h3>
            <p className="text-xs text-ink-500">
              Activity and payments for this subscription, newest first.
            </p>
          </div>
        </div>
        <div className="px-6 py-5">
          {timelineLoading ? (
            <div className="flex justify-center py-6">
              <Spinner className="h-5 w-5 text-brand-primary" />
            </div>
          ) : timeline.length === 0 ? (
            <div className="mx-auto flex max-w-sm flex-col items-center gap-2 py-6 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-variant text-ink-500">
                <History className="h-5 w-5" />
              </span>
              <p className="text-sm font-semibold text-ink-900">No activity yet</p>
              <p className="text-xs text-ink-500">
                Changes and payments for this subscription will show up here.
              </p>
            </div>
          ) : (
            <ol className="space-y-4">
              {timeline.map((entry) => (
                <li key={entry.id} className="flex gap-3">
                  <span
                    className={cn(
                      'mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                      entry.kind === 'payment'
                        ? 'bg-success/10 text-success'
                        : 'bg-brand-primary/10 text-brand-primary',
                    )}
                  >
                    {entry.kind === 'payment' ? (
                      <CreditCard className="h-3.5 w-3.5" />
                    ) : (
                      <History className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-ink-900">{entry.title}</p>
                      <p className="text-xs text-ink-500">{formatDate(entry.date)}</p>
                    </div>
                    {entry.detail && (
                      <p className="mt-0.5 text-sm text-ink-700">{entry.detail}</p>
                    )}
                    {entry.actor && (
                      <p className="mt-0.5 text-xs text-ink-500">by {entry.actor}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </Card>

      <Card className="relative px-6 py-5">
        <Badge variant="info" className="absolute right-4 top-4">
          Coming Soon
        </Badge>
        <h3 className="text-base font-semibold text-ink-900">AI Credits</h3>
        <p className="mt-1 text-xs text-ink-500">
          AI credit extension flow is temporarily disabled while we redesign the metering model.
        </p>
      </Card>

      <Dialog
        open={rejectOpen}
        onOpenChange={(open) => {
          setRejectOpen(open);
          if (!open) setRejectReason('');
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject subscription?</DialogTitle>
            <DialogDescription>
              {subscription.planName} will be canceled. The admin who requested it will be emailed
              with your reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              Reason (optional)
            </label>
            <textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Shared with the requester in the rejection email"
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink-900 outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setRejectOpen(false);
                setRejectReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={rejectMutation.isPending}
              onClick={() => rejectMutation.mutate(rejectReason)}
            >
              {rejectMutation.isPending ? <Spinner className="h-4 w-4" /> : null}
              Reject subscription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
