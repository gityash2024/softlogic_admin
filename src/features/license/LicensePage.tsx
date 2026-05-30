import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Copy,
  Cpu,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  Layers,
  Mail,
  Plus,
  RefreshCw,
  Sofa,
  Trash2,
  Undo2,
  WalletCards,
} from 'lucide-react';
import { toast } from 'sonner';

import { subscriptionsApi } from '@/services/subscriptions.api';
import { organizationsApi } from '@/services/organizations.api';
import { licensingApi } from '@/services/licensing.api';
import type { BulkHardwareActivationKeyResponse } from '@/services/licensing.api';
import type { AdminExportFormat } from '@/services/admin-api';
import { useAuthStore } from '@/lib/auth-store';
import { extractApiError } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import {
  BRANDING_MODE_LABEL,
  STORAGE_STATUS_LABEL,
  SUBSCRIPTION_STATUS_LABEL,
} from '@/types/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
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

export function LicensePage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(
    isSuperAdmin ? null : (user?.primaryOrganization?.id ?? null),
  );
  const [manualReference, setManualReference] = useState('');
  const [amountMinor, setAmountMinor] = useState(100000);
  const [currency, setCurrency] = useState('INR');
  const [revealedKeyIds, setRevealedKeyIds] = useState<Record<string, boolean>>({});
  const [keyLabel, setKeyLabel] = useState('');
  const [keyLabelTouched, setKeyLabelTouched] = useState(false);
  const [maxDevices, setMaxDevices] = useState(1);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkRows, setBulkRows] = useState<Array<{ label: string; maxDevices: number }>>([
    { label: '', maxDevices: 1 },
  ]);
  const [bulkResult, setBulkResult] = useState<BulkHardwareActivationKeyResponse | null>(null);
  const [exportFormat, setExportFormat] = useState<AdminExportFormat>('xlsx');
  const [isExporting, setIsExporting] = useState(false);

  const subscriptionsQuery = useQuery({
    queryKey: ['subscriptions', 'all'],
    queryFn: subscriptionsApi.all,
  });
  const organizationsQuery = useQuery({
    queryKey: ['organizations', 'all'],
    queryFn: organizationsApi.all,
  });
  const orgDetailsQuery = useQuery({
    queryKey: ['license-details', selectedOrgId],
    queryFn: () => licensingApi.getOrganizationLicenseDetails(selectedOrgId!),
    enabled: !!selectedOrgId,
  });

  useEffect(() => {
    if (!isSuperAdmin && !selectedOrgId && user?.primaryOrganization?.id) {
      setSelectedOrgId(user.primaryOrganization.id);
    }
  }, [isSuperAdmin, selectedOrgId, user?.primaryOrganization?.id]);

  const selectedOrganization = useMemo(
    () =>
      organizationsQuery.data?.find((org) => org.id === selectedOrgId) ?? null,
    [organizationsQuery.data, selectedOrgId],
  );
  const orgSubs = useMemo(
    () =>
      (subscriptionsQuery.data ?? []).filter(
        (subscription) => subscription.organizationId === selectedOrganization?.id,
      ),
    [selectedOrganization?.id, subscriptionsQuery.data],
  );
  const primarySub =
    orgSubs.find((subscription) =>
      ['ACTIVE', 'TRIAL'].includes(subscription.status),
    ) ?? orgSubs[0] ?? null;
  const hasActiveSub = orgSubs.some((subscription) =>
    ['ACTIVE', 'TRIAL'].includes(subscription.status),
  );
  const pendingSub =
    orgSubs.find((subscription) => subscription.status === 'PENDING_APPROVAL') ?? null;
  // Org/partner admins need a clear nudge when no active subscription backs the
  // workspace. Super admins manage globally and never see this banner.
  const showLicenseBanner =
    !isSuperAdmin &&
    !!selectedOrganization &&
    !subscriptionsQuery.isLoading &&
    !hasActiveSub;

  const invalidateCommercialQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    queryClient.invalidateQueries({ queryKey: ['organizations'] });
    queryClient.invalidateQueries({ queryKey: ['license-details'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
  };

  const offlineMutation = useMutation({
    mutationFn: licensingApi.recordOfflinePayment,
    onSuccess: () => {
      invalidateCommercialQueries();
      toast.success('Offline payment activated');
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const hardwareMutation = useMutation({
    mutationFn: licensingApi.createHardwareActivationKey,
    onSuccess: () => {
      invalidateCommercialQueries();
      setKeyLabel('');
      setKeyLabelTouched(false);
      setMaxDevices(1);
      toast.success('Hardware activation key created');
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const bulkMutation = useMutation({
    mutationFn: licensingApi.bulkCreate,
    onSuccess: (data) => {
      invalidateCommercialQueries();
      queryClient.invalidateQueries({ queryKey: ['license-details'] });
      setBulkResult(data);
      toast.success(`Created ${data.createdCount} activation key(s)`);
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const emailKeysMutation = useMutation({
    mutationFn: licensingApi.emailActivationKeysToOrgAdmin,
    onSuccess: (data) => {
      toast.success(
        data.delivered
          ? `Emailed ${data.keyCount} key(s) to ${data.recipient}`
          : 'Activation key email queued',
      );
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const resetActivationMutation = useMutation({
    mutationFn: licensingApi.resetActivation,
    onSuccess: () => {
      invalidateCommercialQueries();
      toast.success('Device reset — the key is now available to rebind');
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const recalcMutation = useMutation({
    mutationFn: licensingApi.recalculateLicenseUsage,
    onSuccess: () => {
      invalidateCommercialQueries();
      toast.success('License usage recalculated');
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const isLoading = subscriptionsQuery.isLoading || organizationsQuery.isLoading;
  const globalMode = isSuperAdmin && !selectedOrganization;
  const globalActiveSubscriptions = (subscriptionsQuery.data ?? []).filter(
    (subscription) => subscription.status === 'ACTIVE' || subscription.status === 'TRIAL',
  );
  const usage = primarySub
    ? Math.min(100, (primarySub.seatUsage / Math.max(primarySub.seatLimit, 1)) * 100)
    : 0;

  const activationKeys = orgDetailsQuery.data?.hardwareActivationKeys ?? [];
  const allDevices = activationKeys.flatMap((key) =>
    key.activations.map((activation) => ({ activation, key })),
  );

  const toggleReveal = (id: string) =>
    setRevealedKeyIds((current) => ({ ...current, [id]: !current[id] }));

  const copyValue = async (value: string, success: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(success);
  };

  const openBulkDialog = () => {
    setBulkResult(null);
    setBulkRows([{ label: '', maxDevices: 1 }]);
    setBulkOpen(true);
  };

  const closeBulkDialog = () => {
    setBulkOpen(false);
    setBulkResult(null);
    setBulkRows([{ label: '', maxDevices: 1 }]);
  };

  const updateBulkRow = (
    index: number,
    patch: Partial<{ label: string; maxDevices: number }>,
  ) =>
    setBulkRows((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );

  const addBulkRow = () =>
    setBulkRows((rows) => [...rows, { label: '', maxDevices: 1 }]);

  const removeBulkRow = (index: number) =>
    setBulkRows((rows) =>
      rows.length > 1 ? rows.filter((_, i) => i !== index) : rows,
    );

  const validBulkRows = bulkRows.filter((row) => row.label.trim().length > 0);

  const submitBulk = () => {
    if (!selectedOrganization) return;
    if (validBulkRows.length === 0) {
      toast.error('Add at least one key with a label');
      return;
    }
    bulkMutation.mutate({
      organizationId: selectedOrganization.id,
      subscriptionId: primarySub?.id ?? null,
      keys: validBulkRows.map((row) => ({
        label: row.label.trim(),
        maxDevices: Math.max(1, row.maxDevices || 1),
      })),
    });
  };

  const exportKeys = async () => {
    if (!selectedOrganization) return;
    setIsExporting(true);
    try {
      await licensingApi.exportKeys(selectedOrganization.id, exportFormat);
      toast.success(`Activation keys exported (${exportFormat.toUpperCase()})`);
    } catch (error) {
      toast.error(extractApiError(error));
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner className="h-6 w-6 text-brand-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-2xl font-black text-ink-900">Licensing</h2>
          <p className="text-sm text-ink-500">
            Offline-only billing, activation keys, and device state for each workspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isSuperAdmin && (
            <select
              className="h-11 w-72 rounded-lg border border-line bg-white px-3 text-sm"
              value={selectedOrganization?.id ?? 'GLOBAL'}
              onChange={(event) =>
                setSelectedOrgId(event.target.value === 'GLOBAL' ? null : event.target.value)
              }
            >
              <option value="GLOBAL">General licensing overview</option>
              {organizationsQuery.data?.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          )}
          <Button
            variant="outline"
            disabled={!selectedOrganization || recalcMutation.isPending}
            onClick={() => {
              if (selectedOrganization) {
                recalcMutation.mutate(selectedOrganization.id);
              }
            }}
          >
            {recalcMutation.isPending ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Recalculate
          </Button>
        </div>
      </div>

      {showLicenseBanner && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-bold">
              {pendingSub ? 'Subscription pending approval' : 'No active subscription'}
            </p>
            <p className="text-sm leading-6">
              {pendingSub
                ? 'Your subscription request is awaiting SoftLogic Super Admin approval. Licensed users (teachers, students, parents) can be added once it is approved — you’ll receive an email.'
                : 'This workspace needs an active subscription before you can add licensed users (teachers, students, parents). Create a subscription request and a SoftLogic Super Admin will review it.'}
            </p>
            {!pendingSub && (
              <Button
                variant="primary"
                size="sm"
                className="mt-1"
                onClick={() => navigate('/subscriptions/new')}
              >
                <Plus className="h-4 w-4" />
                Request subscription
              </Button>
            )}
          </div>
        </div>
      )}

      {globalMode && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              Organizations
            </p>
            <p className="mt-2 text-3xl font-black text-ink-900">
              {organizationsQuery.data?.length ?? 0}
            </p>
            <p className="mt-1 text-sm text-ink-500">Managed launch workspaces</p>
          </Card>
          <Card className="px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              Active plans
            </p>
            <p className="mt-2 text-3xl font-black text-success">
              {globalActiveSubscriptions.length}
            </p>
            <p className="mt-1 text-sm text-ink-500">Active or trial subscriptions</p>
          </Card>
          <Card className="px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              Total seats
            </p>
            <p className="mt-2 text-3xl font-black text-ink-900">
              {globalActiveSubscriptions.reduce(
                (total, subscription) => total + subscription.seatUsage,
                0,
              )}
              <span className="text-base font-semibold text-ink-500">
                {' '}/{' '}
                {globalActiveSubscriptions.reduce(
                  (total, subscription) => total + subscription.seatLimit,
                  0,
                )}
              </span>
            </p>
            <p className="mt-1 text-sm text-ink-500">Across all organizations</p>
          </Card>
          <Card className="px-6 py-5 relative">
            <Badge variant="info" className="absolute right-4 top-4">Coming Soon</Badge>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              AI Credits
            </p>
            <p className="mt-2 text-3xl font-black text-ink-300">--</p>
            <p className="mt-1 text-sm text-ink-500">Available in a future release</p>
          </Card>
        </div>
      )}

      {!globalMode && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <div>
                <h3 className="flex items-center gap-2 text-base font-semibold text-ink-900">
                  <KeyRound className="h-4 w-4 text-brand-primary" />
                  Subscription
                </h3>
                <p className="text-xs text-ink-500">
                  {selectedOrganization?.name ?? '—'} · {primarySub?.planName ?? 'No plan'}
                </p>
              </div>
              <Badge variant={primarySub?.status === 'ACTIVE' ? 'success' : 'warning'}>
                {primarySub ? SUBSCRIPTION_STATUS_LABEL[primarySub.status] : 'No plan'}
              </Badge>
            </div>
            <div className="space-y-3 px-6 py-5">
              <p className="text-xs uppercase tracking-wide text-ink-500">Branding</p>
              <p className="text-sm text-ink-700">
                {primarySub ? BRANDING_MODE_LABEL[primarySub.brandingMode] : '—'}
              </p>
              <p className="pt-2 text-xs text-ink-500">
                Storage:{' '}
                {selectedOrganization
                  ? STORAGE_STATUS_LABEL[selectedOrganization.storageStatus]
                  : '—'}
              </p>
            </div>
          </Card>

          <Card>
            <div className="border-b border-line px-6 py-4">
              <h3 className="flex items-center gap-2 text-base font-semibold text-ink-900">
                <Sofa className="h-4 w-4 text-brand-primary" />
                Seat Usage
              </h3>
              <p className="text-xs text-ink-500">Active organization users</p>
            </div>
            <div className="space-y-4 px-6 py-5">
              {primarySub && (
                <SeatUsageBanner
                  seatLimit={primarySub.seatLimit}
                  seatUsage={primarySub.seatUsage}
                />
              )}
              <p className="text-2xl font-bold text-ink-900">
                {primarySub?.seatUsage ?? 0}
                <span className="text-sm font-medium text-ink-500">
                  {' '}/ {primarySub?.seatLimit ?? 0}
                </span>
              </p>
              <Progress value={usage} />
              <p className="text-xs text-ink-500">
                Seats include teachers, students, and parents combined.
              </p>
            </div>
          </Card>
        </div>
      )}

      {isSuperAdmin && (
        <div className="space-y-5">
          <Card className="space-y-4 px-6 py-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-base font-semibold text-ink-900">
                  <CreditCard className="h-4 w-4 text-brand-primary" />
                  Payment Channel
                </h3>
                <p className="text-xs text-ink-500">
                  Manual / offline only.
                </p>
              </div>
              <Badge variant="success">Offline only</Badge>
            </div>
          </Card>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card className="space-y-4 px-6 py-5">
              <div>
                <h3 className="flex items-center gap-2 text-base font-semibold text-ink-900">
                  <WalletCards className="h-4 w-4 text-brand-primary" />
                  Record Offline Payment
                </h3>
                <p className="text-xs text-ink-500">
                  Capture a manual invoice or wire transfer for the selected organization.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-[1fr_120px]">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                    Amount
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={amountMinor}
                    onChange={(event) => setAmountMinor(Number(event.target.value))}
                    placeholder="Amount in minor units"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                    Currency
                  </label>
                  <Input value={currency} onChange={(event) => setCurrency(event.target.value)} />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <Input
                  value={manualReference}
                  onChange={(event) => setManualReference(event.target.value)}
                  placeholder="Offline invoice/reference note"
                />
                <Button
                  variant="primary"
                  disabled={!selectedOrganization || !primarySub || offlineMutation.isPending}
                  onClick={() => {
                    if (!selectedOrganization || !primarySub) return;
                    offlineMutation.mutate({
                      organizationId: selectedOrganization.id,
                      subscriptionId: primarySub.id,
                      amountMinor,
                      currency,
                      referenceNote: manualReference || null,
                    });
                  }}
                >
                  {offlineMutation.isPending && <Spinner className="h-4 w-4" />}
                  Activate offline payment
                </Button>
              </div>
            </Card>

            <Card className="space-y-5 px-6 py-5 relative">
              <div>
                <h3 className="flex items-center gap-2 text-base font-semibold text-ink-900">
                  <Cpu className="h-4 w-4 text-brand-primary" />
                  Hardware Activation Keys
                </h3>
                <p className="text-xs text-ink-500">
                  Each key locks to the first device that activates it.
                </p>
              </div>

              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-[1fr_140px]">
                  <div className="space-y-1.5">
                    <Input
                      value={keyLabel}
                      onChange={(event) => setKeyLabel(event.target.value)}
                      onBlur={() => setKeyLabelTouched(true)}
                      maxLength={120}
                      placeholder="Label (e.g. Lab whiteboard 1)"
                      aria-invalid={keyLabelTouched && keyLabel.trim().length === 0}
                    />
                    {keyLabelTouched && keyLabel.trim().length === 0 && (
                      <p className="text-xs font-medium text-danger">Label is required</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Input
                      type="number"
                      min={1}
                      value={maxDevices}
                      onChange={(event) =>
                        setMaxDevices(Math.max(1, Number(event.target.value) || 1))
                      }
                      placeholder="Max devices"
                    />
                    <p className="text-xs text-ink-500">1 = single device lock</p>
                  </div>
                </div>
                <Button
                  variant="primary"
                  className="w-full"
                  disabled={
                    !selectedOrganization ||
                    keyLabel.trim().length === 0 ||
                    hardwareMutation.isPending
                  }
                  onClick={() => {
                    if (!selectedOrganization) return;
                    if (keyLabel.trim().length === 0) {
                      setKeyLabelTouched(true);
                      return;
                    }
                    hardwareMutation.mutate({
                      organizationId: selectedOrganization.id,
                      subscriptionId: primarySub?.id ?? null,
                      label: keyLabel.trim(),
                      maxDevices,
                    });
                  }}
                >
                  {hardwareMutation.isPending && <Spinner className="h-4 w-4" />}
                  Create activation key
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={!selectedOrganization}
                  onClick={openBulkDialog}
                >
                  <Layers className="h-4 w-4" />
                  Bulk create keys
                </Button>
              </div>

              <Button
                variant="outline"
                className="w-full"
                disabled={!selectedOrganization || emailKeysMutation.isPending}
                onClick={() => {
                  if (!selectedOrganization) return;
                  emailKeysMutation.mutate(selectedOrganization.id);
                }}
              >
                {emailKeysMutation.isPending ? <Spinner className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                Email all keys to organization admin
              </Button>

              <div className="pointer-events-none absolute inset-x-6 bottom-3 rounded-lg border border-line bg-surface-variant px-3 py-2 text-xs text-ink-500">
                <span className="mr-2 inline-flex items-center rounded bg-warning/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
                  Coming Soon
                </span>
                AI Credits will return in a future release.
              </div>
            </Card>
          </div>
        </div>
      )}

      {!globalMode && selectedOrganization && (
        <>
          <Card>
            <div className="flex flex-col gap-3 border-b border-line px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-ink-900">Activation Keys</h3>
                <p className="text-xs text-ink-500">
                  Reveal, copy, or email the full key to the organization admin.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="h-10 rounded-lg border border-line bg-white px-3 text-sm"
                  value={exportFormat}
                  onChange={(event) =>
                    setExportFormat(event.target.value as AdminExportFormat)
                  }
                  aria-label="Export format"
                >
                  <option value="xlsx">XLSX</option>
                  <option value="csv">CSV</option>
                </select>
                <Button
                  variant="outline"
                  disabled={isExporting || activationKeys.length === 0}
                  onClick={exportKeys}
                >
                  {isExporting ? <Spinner className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                  Export
                </Button>
                {isSuperAdmin && (
                  <Button
                    variant="outline"
                    disabled={emailKeysMutation.isPending}
                    onClick={() => emailKeysMutation.mutate(selectedOrganization.id)}
                  >
                    {emailKeysMutation.isPending ? <Spinner className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                    Email org admin
                  </Button>
                )}
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Bound device</TableHead>
                  <TableHead>Expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activationKeys.map((key) => {
                  const revealed = revealedKeyIds[key.id];
                  const plain = key.activationKey ?? '';
                  return (
                    <TableRow key={key.id}>
                      <TableCell>{key.label ?? '—'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="rounded border border-line bg-surface-variant px-2 py-1 font-mono text-xs">
                            {revealed && plain ? plain : plain ? '••••••••••••' : '<legacy — reissue to reveal>'}
                          </code>
                          {plain && (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => toggleReveal(key.id)}
                                title={revealed ? 'Hide' : 'Reveal'}
                              >
                                {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                        <p className="text-sm text-ink-700">
                          {key.boundActivation?.deviceModel ?? '—'}
                        </p>
                        <p className="text-xs text-ink-500">
                          {key.boundActivation?.devicePlatform ?? ''}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-ink-700">
                          {key.expiresAt ? formatDate(key.expiresAt) : 'No expiry'}
                        </p>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {activationKeys.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-variant text-ink-500">
                          <KeyRound className="h-5 w-5" />
                        </span>
                        <p className="text-sm font-semibold text-ink-900">
                          No activation keys issued yet
                        </p>
                        <p className="text-xs text-ink-500">
                          Create activation keys to lock the app to your devices.
                        </p>
                        {isSuperAdmin && (
                          <Button
                            variant="primary"
                            size="sm"
                            className="mt-1"
                            onClick={openBulkDialog}
                          >
                            <Layers className="h-4 w-4" />
                            Bulk create keys
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>

          <Card>
            <div className="border-b border-line px-6 py-4">
              <h3 className="text-base font-semibold text-ink-900">Active Devices</h3>
              <p className="text-xs text-ink-500">
                One activation per device. Reset a row to allow re-binding on a new device.
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
                      {isSuperAdmin && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={resetActivationMutation.isPending}
                          onClick={() => resetActivationMutation.mutate(activation.id)}
                        >
                          <Undo2 className="h-3.5 w-3.5" />
                          Reset
                        </Button>
                      )}
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
        </>
      )}

      {!globalMode && (
        <Card>
          <div className="flex items-center justify-between border-b border-line px-6 py-4">
            <div>
              <h3 className="text-base font-semibold text-ink-900">Billing History</h3>
              <p className="text-xs text-ink-500">
                Subscription cycles for {selectedOrganization?.name ?? 'this workspace'}
              </p>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice ID</TableHead>
                <TableHead>Billing Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Plan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgSubs.map((subscription) => (
                <TableRow key={subscription.id}>
                  <TableCell>
                    <p className="font-mono text-sm font-medium text-ink-900">
                      #SUB-{subscription.id.slice(0, 6).toUpperCase()}
                    </p>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm text-ink-700">
                      {formatDate(subscription.startDate)}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={subscription.status === 'ACTIVE' ? 'success' : 'warning'}>
                      {subscription.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm text-ink-700">{subscription.planName}</p>
                  </TableCell>
                </TableRow>
              ))}
              {orgSubs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-sm text-ink-500">
                    No invoices yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog
        open={bulkOpen}
        onOpenChange={(open) => (open ? setBulkOpen(true) : closeBulkDialog())}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bulk create activation keys</DialogTitle>
            <DialogDescription>
              {bulkResult
                ? `Created ${bulkResult.createdCount} key(s) for ${selectedOrganization?.name ?? 'this workspace'}. Copy them now — full keys are shown only once.`
                : `Add one row per key for ${selectedOrganization?.name ?? 'this workspace'}. Each label is required.`}
            </DialogDescription>
          </DialogHeader>

          {!bulkResult ? (
            <div className="space-y-3">
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {bulkRows.map((row, index) => (
                  <div
                    key={index}
                    className="grid gap-2 sm:grid-cols-[1fr_120px_auto]"
                  >
                    <Input
                      value={row.label}
                      onChange={(event) =>
                        updateBulkRow(index, { label: event.target.value })
                      }
                      maxLength={120}
                      placeholder={`Label (e.g. Lab device ${index + 1})`}
                    />
                    <Input
                      type="number"
                      min={1}
                      value={row.maxDevices}
                      onChange={(event) =>
                        updateBulkRow(index, {
                          maxDevices: Math.max(1, Number(event.target.value) || 1),
                        })
                      }
                      placeholder="Max devices"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={bulkRows.length === 1}
                      onClick={() => removeBulkRow(index)}
                      title="Remove row"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addBulkRow}>
                <Plus className="h-4 w-4" />
                Add another key
              </Button>
            </div>
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {bulkResult.keys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-variant px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-900">
                      {key.label ?? '—'}
                    </p>
                    <code className="font-mono text-xs text-ink-700">
                      {key.activationKey}
                    </code>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      copyValue(key.activationKey, 'Activation key copied')
                    }
                    title="Copy"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            {!bulkResult ? (
              <>
                <Button type="button" variant="outline" onClick={closeBulkDialog}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  disabled={
                    !selectedOrganization ||
                    validBulkRows.length === 0 ||
                    bulkMutation.isPending
                  }
                  onClick={submitBulk}
                >
                  {bulkMutation.isPending && <Spinner className="h-4 w-4" />}
                  Create {validBulkRows.length || ''} key
                  {validBulkRows.length === 1 ? '' : 's'}
                </Button>
              </>
            ) : (
              <Button type="button" variant="primary" onClick={closeBulkDialog}>
                Done
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
