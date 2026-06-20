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
import { formatActivationKeyForDisplay } from '@/lib/activation-key';
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
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { ActivationKeyLabelDialog } from '@/components/license/ActivationKeyLabelDialog';
import { EmailActivationKeysDialog } from '@/components/license/EmailActivationKeysDialog';
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

function SeatsBanner({
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
      ? 'All seats are in use'
      : `Seats are at ${Math.round(pct * 100)}% capacity`;
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
  const canManageActivationKeys = isSuperAdmin || actor?.role === 'PARTNER_ADMIN';
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
  const [revokeKeyId, setRevokeKeyId] = useState<string | null>(null);
  const [replaceKeyId, setReplaceKeyId] = useState<string | null>(null);
  const [labelEdit, setLabelEdit] = useState<{ id: string; label: string } | null>(null);
  const [emailKeysOpen, setEmailKeysOpen] = useState(false);

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

  const resetActivationMutation = useMutation({
    mutationFn: licensingApi.resetActivation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-details', id] });
      toast.success('Device reset — key is available to rebind');
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const revokeKeyMutation = useMutation({
    mutationFn: licensingApi.revokeActivationKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-details', id] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      toast.success('Activation key revoked');
      setRevokeKeyId(null);
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const replaceKeyMutation = useMutation({
    mutationFn: licensingApi.replaceActivationKey,
    onSuccess: (key) => {
      queryClient.invalidateQueries({ queryKey: ['subscription-details', id] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      toast.success(
        `Replacement key created${
          key.activationKey ? `: ${formatActivationKeyForDisplay(key.activationKey)}` : ''
        }`,
      );
      setReplaceKeyId(null);
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

  if (detailQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-7 w-7 text-brand-primary" />
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <Card className="mx-auto max-w-xl px-5 py-6 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-warning" />
        <h2 className="mt-3 text-lg font-bold text-ink-900">Subscription details unavailable</h2>
        <p className="mt-1 text-sm leading-6 text-ink-500">
          {extractApiError(detailQuery.error) || 'The subscription could not be loaded.'}
        </p>
        <Button className="mt-4" variant="outline" onClick={() => navigate('/subscriptions')}>
          <ArrowLeft className="h-4 w-4" />
          Back to subscriptions
        </Button>
      </Card>
    );
  }

  const subscription = detailQuery.data;
  const canApproveSubscription =
    isSuperAdmin ||
    (actor?.role === 'PARTNER_ADMIN' &&
      !!actor.primaryOrganization?.id &&
      subscription.organization?.parentOrganizationId === actor.primaryOrganization.id);
  const usage = Math.min(
    100,
    (subscription.seatUsage / Math.max(subscription.seatLimit, 1)) * 100,
  );
  const allDevices = subscription.hardwareActivationKeys.flatMap((key) =>
    key.activations.map((activation) => ({ activation, key })),
  );
  const emailedUsableKeyCount = subscription.hardwareActivationKeys.filter(
    (key) =>
      (key.status === 'AVAILABLE' || key.status === 'BOUND') &&
      Boolean(key.emailSentAt),
  ).length;
  const newEmailSlotsRemaining = Math.max(
    subscription.seatLimit - emailedUsableKeyCount,
    0,
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
          {canApproveSubscription && subscription.status === 'PENDING_APPROVAL' && (
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
          {canManageActivationKeys && subscription.organizationId && (
            <Button
              variant="outline"
              disabled={subscription.hardwareActivationKeys.length === 0}
              onClick={() => setEmailKeysOpen(true)}
            >
              <Mail className="h-4 w-4" />
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

      <Card className="space-y-4 px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base font-semibold text-ink-900">Plan summary</h3>
          <Badge variant={subscription.status === 'ACTIVE' ? 'success' : 'warning'}>
            {SUBSCRIPTION_STATUS_LABEL[subscription.status]}
          </Badge>
        </div>
        <SeatsBanner
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
          <p className="text-xs uppercase tracking-wide text-ink-500">Seats</p>
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
        <div className="border-b border-line px-4 py-4 sm:px-6">
          <h3 className="text-base font-semibold text-ink-900">Activation keys</h3>
          <p className="text-xs text-ink-500">
            Reveal each key to copy it, or email all keys to the organization admin.
          </p>
        </div>
        <Table className="min-w-[980px]">
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned</TableHead>
              <TableHead>Expires</TableHead>
              {isSuperAdmin && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {subscription.hardwareActivationKeys.map((key) => {
              const showKey = revealed[key.id];
              const plain = key.activationKey ?? '';
              const displayKey = formatActivationKeyForDisplay(plain);
              return (
                <TableRow key={key.id}>
                  <TableCell className="min-w-0">
                    <div className="flex items-center gap-1">
                      <span>{key.label ?? '—'}</span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        title="Edit label"
                        onClick={() => setLabelEdit({ id: key.id, label: key.label ?? '' })}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <code className="rounded border border-line bg-surface-variant px-2 py-1 font-mono text-xs">
                        {showKey && plain
                          ? displayKey
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
                            onClick={() => copyValue(displayKey, 'Activation key copied')}
                            title="Copy"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
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
                  <TableCell className="max-w-[220px] truncate">
                    {key.assignedUser?.name ?? key.assignedUser?.email ?? '—'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{key.expiresAt ? formatDate(key.expiresAt) : 'No expiry'}</TableCell>
                  {isSuperAdmin && (
                    <TableCell className="text-right whitespace-nowrap">
                      <div className="flex justify-end gap-1 whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={key.status === 'DISABLED'}
                          onClick={() => setRevokeKeyId(key.id)}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Revoke
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setReplaceKeyId(key.id)}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Replace
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
            {subscription.hardwareActivationKeys.length === 0 && (
              <TableRow>
                <TableCell colSpan={isSuperAdmin ? 6 : 5} className="py-10 text-center text-sm text-ink-500">
                  No activation keys issued yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Card>
        <div className="border-b border-line px-4 py-4 sm:px-6">
          <h3 className="text-base font-semibold text-ink-900">Active devices</h3>
          <p className="text-xs text-ink-500">
            Each activation key activates one board/device for users in the same organization.
          </p>
        </div>
        <Table className="min-w-[980px]">
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
                <TableCell className="min-w-0">
                  <p className="text-sm font-semibold text-ink-900">
                    {activation.deviceModel ?? activation.deviceLabel ?? key.label ?? 'Unnamed device'}
                  </p>
                  <p className="text-xs text-ink-500">{key.label ?? '—'}</p>
                </TableCell>
                <TableCell className="max-w-[180px] truncate">
                  <p className="text-sm text-ink-700">{activation.devicePlatform ?? '—'}</p>
                  <p className="text-xs text-ink-500">{activation.deviceOsVersion ?? ''}</p>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <code className="font-mono text-xs text-ink-500">
                    {fingerprintTail(activation.deviceFingerprintHash)}
                  </code>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {activation.firstBoundAt ? formatDate(activation.firstBoundAt) : '—'}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {activation.lastVerifiedAt ? formatDate(activation.lastVerifiedAt) : '—'}
                </TableCell>
                <TableCell className="whitespace-nowrap">
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
                <TableCell className="text-right whitespace-nowrap">
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
        <div className="flex items-center gap-2 border-b border-line px-4 py-4 sm:px-6">
          <CreditCard className="h-4 w-4 text-brand-primary" />
          <div>
            <h3 className="text-base font-semibold text-ink-900">Payment history</h3>
            <p className="text-xs text-ink-500">
              Offline payments recorded against this subscription.
            </p>
          </div>
        </div>
        <Table className="min-w-[980px]">
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
                <TableCell className="whitespace-nowrap">{formatDate(payment.createdAt)}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <p className="text-sm font-semibold text-ink-900">
                    {formatMoney(payment.amountMinor, payment.currency)}
                  </p>
                </TableCell>
                <TableCell className="whitespace-nowrap">
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
                <TableCell className="whitespace-nowrap">
                  <span className="font-mono text-xs text-ink-700">
                    {payment.invoiceNumber ?? '—'}
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <p className="text-xs text-ink-700">
                    {payment.periodStart ? formatDate(payment.periodStart) : '—'}
                    {payment.periodEnd ? ` – ${formatDate(payment.periodEnd)}` : ''}
                  </p>
                </TableCell>
                <TableCell className="min-w-0">
                  <p className="max-w-[240px] truncate text-sm text-ink-700">{payment.referenceNote ?? '—'}</p>
                </TableCell>
                <TableCell className="min-w-0">
                  <p className="max-w-[200px] truncate text-sm text-ink-700">
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
        <div className="flex items-center gap-2 border-b border-line px-4 py-4 sm:px-6">
          <History className="h-4 w-4 text-brand-primary" />
          <div>
            <h3 className="text-base font-semibold text-ink-900">Timeline</h3>
            <p className="text-xs text-ink-500">
              Activity and payments for this subscription, newest first.
            </p>
          </div>
        </div>
        <div className="px-4 py-5 sm:px-6">
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

      <Card className="relative px-4 py-5 sm:px-6">
        <Badge variant="info" className="absolute right-4 top-4">
          Coming Soon
        </Badge>
        <h3 className="text-base font-semibold text-ink-900">AI Credits</h3>
        <p className="mt-1 text-xs text-ink-500">
          AI credit extension flow is temporarily disabled while we redesign the metering model.
        </p>
      </Card>

      <Dialog open={renewOpen} onOpenChange={(open) => (open ? setRenewOpen(true) : closeRenew())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renew subscription</DialogTitle>
            <DialogDescription>
              Extend {subscription.planName} and optionally record the offline payment reference.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                New end date
              </label>
              <Input
                type="date"
                value={renewEndDate}
                onChange={(event) => setRenewEndDate(event.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                checked={renewExtendKeys}
                onChange={(event) => setRenewExtendKeys(event.target.checked)}
                className="h-4 w-4 rounded border-line text-brand-primary"
              />
              Extend existing activation keys
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                checked={renewRecordPayment}
                onChange={(event) => setRenewRecordPayment(event.target.checked)}
                className="h-4 w-4 rounded border-line text-brand-primary"
              />
              Record offline payment
            </label>
            {renewRecordPayment && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                    Amount
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={renewAmount}
                    onChange={(event) => setRenewAmount(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                    Currency
                  </label>
                  <Input
                    value={renewCurrency}
                    onChange={(event) => setRenewCurrency(event.target.value.toUpperCase())}
                    maxLength={3}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                    Reference note
                  </label>
                  <Input
                    value={renewReference}
                    onChange={(event) => setRenewReference(event.target.value)}
                    placeholder="Invoice or receipt reference"
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={closeRenew}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={!renewEndDate || renewMutation.isPending}
              onClick={submitRenew}
            >
              {renewMutation.isPending ? <Spinner className="h-4 w-4" /> : null}
              Renew subscription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {labelEdit && (
        <ActivationKeyLabelDialog
          keyId={labelEdit.id}
          currentLabel={labelEdit.label}
          open
          onOpenChange={(open) => !open && setLabelEdit(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['subscription-details', id] });
            queryClient.invalidateQueries({ queryKey: ['license-details'] });
          }}
        />
      )}

      {subscription.organizationId && emailKeysOpen && (
        <EmailActivationKeysDialog
          key={subscription.organizationId}
          open
          organizationId={subscription.organizationId}
          organizationName={subscription.organization?.name}
          keys={subscription.hardwareActivationKeys}
          newEmailSlotsRemaining={newEmailSlotsRemaining}
          onOpenChange={(open) => setEmailKeysOpen(open)}
          onSent={() => {
            queryClient.invalidateQueries({ queryKey: ['subscription-details', id] });
            queryClient.invalidateQueries({ queryKey: ['license-details'] });
          }}
        />
      )}

      <ConfirmationDialog
        open={!!revokeKeyId}
        onOpenChange={(open) => !open && setRevokeKeyId(null)}
        title="Revoke activation key?"
        description="This disables the key and any active device activation for it."
        confirmLabel="Revoke"
        tone="danger"
        loading={revokeKeyMutation.isPending}
        onConfirm={() => {
          if (revokeKeyId) revokeKeyMutation.mutate(revokeKeyId);
        }}
      />

      <ConfirmationDialog
        open={!!replaceKeyId}
        onOpenChange={(open) => !open && setReplaceKeyId(null)}
        title="Replace activation key?"
        description="The old key will be revoked and a new key will be created if seats are available."
        confirmLabel="Replace"
        tone="warning"
        loading={replaceKeyMutation.isPending}
        onConfirm={() => {
          if (replaceKeyId) replaceKeyMutation.mutate(replaceKeyId);
        }}
      />
    </div>
  );
}
