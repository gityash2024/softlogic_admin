import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  Pencil,
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
import { formatActivationKeyForDisplay } from '@/lib/activation-key';
import {
  partnerOrganizations,
} from '@/lib/admin-hierarchy';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amountMinor / 100);
  } catch {
    return `${currency} ${(amountMinor / 100).toFixed(2)}`;
  }
}

function paymentOrganizationName(payment: {
  id: string;
  organization?: { name?: string | null } | null;
}): string {
  return payment.organization?.name ?? '-';
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

type BulkCreateMode = 'choice' | 'manual' | 'auto';

const GLOBAL_LICENSE_VALUE = 'GLOBAL';
const DIRECT_ORGANIZATIONS_VALUE = 'DIRECT_OR_INTERNAL';
const PARTNER_AGGREGATE_VALUE = 'PARTNER_AGGREGATE';
const PARTNER_SELF_VALUE = 'PARTNER_SELF';
const NO_ORGANIZATION_VALUE = 'NO_ORGANIZATION';

export function LicensePage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isPartnerAdmin = user?.role === 'PARTNER_ADMIN';
  const canManageActivationKeys = isSuperAdmin || isPartnerAdmin;
  const requestedOrganizationId = searchParams.get('organizationId');
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>(
    GLOBAL_LICENSE_VALUE,
  );
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(
    requestedOrganizationId ?? (isSuperAdmin ? null : (user?.primaryOrganization?.id ?? null)),
  );
  const [manualReference, setManualReference] = useState('');
  const [amountMinor, setAmountMinor] = useState(100000);
  const [currency, setCurrency] = useState('INR');
  const [revealedKeyIds, setRevealedKeyIds] = useState<Record<string, boolean>>({});
  const [keyLabel, setKeyLabel] = useState('');
  const [keyLabelTouched, setKeyLabelTouched] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkRows, setBulkRows] = useState<Array<{ label: string; maxDevices: number }>>([
    { label: '', maxDevices: 1 },
  ]);
  const [bulkMode, setBulkMode] = useState<BulkCreateMode>('choice');
  const [autoBulkCount, setAutoBulkCount] = useState(1);
  const [bulkResult, setBulkResult] = useState<BulkHardwareActivationKeyResponse | null>(null);
  const [exportFormat, setExportFormat] = useState<AdminExportFormat>('xlsx');
  const [isExporting, setIsExporting] = useState(false);
  const [revokeKeyId, setRevokeKeyId] = useState<string | null>(null);
  const [replaceKeyId, setReplaceKeyId] = useState<string | null>(null);
  const [labelEdit, setLabelEdit] = useState<{ id: string; label: string } | null>(null);
  const [emailKeysOpen, setEmailKeysOpen] = useState(false);

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
  const superAdminPartnerScope =
    isSuperAdmin &&
    selectedPartnerId !== GLOBAL_LICENSE_VALUE &&
    selectedPartnerId !== DIRECT_ORGANIZATIONS_VALUE;
  const partnerDetailsQuery = useQuery({
    queryKey: ['partner-license-details', selectedPartnerId],
    queryFn: () => licensingApi.getPartnerLicenseDetails(selectedPartnerId),
    enabled: superAdminPartnerScope,
  });

  useEffect(() => {
    if (!isSuperAdmin && !selectedOrgId && user?.primaryOrganization?.id) {
      const timer = window.setTimeout(() => {
        setSelectedOrgId(user.primaryOrganization?.id ?? null);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [isSuperAdmin, selectedOrgId, user?.primaryOrganization?.id]);

  const partnerChildOrganizations = useMemo(
    () => {
      if (!isPartnerAdmin || !user?.primaryOrganization?.id) return [];
      const organizations = organizationsQuery.data ?? [];
      const ownOrganization =
        organizations.find((org) => org.id === user.primaryOrganization?.id) ??
        user.primaryOrganization;
      const children = organizations.filter(
        (org) => org.parentOrganizationId === user.primaryOrganization?.id,
      );
      return [ownOrganization, ...children].filter(
        (org, index, list) => list.findIndex((item) => item.id === org.id) === index,
      );
    },
    [isPartnerAdmin, organizationsQuery.data, user?.primaryOrganization?.id],
  );

  useEffect(() => {
    if (!isPartnerAdmin || partnerChildOrganizations.length === 0) return;
    const selectedChild = partnerChildOrganizations.some((org) => org.id === selectedOrgId);
    if (!selectedChild) {
      setSelectedOrgId(partnerChildOrganizations[0].id);
    }
  }, [isPartnerAdmin, partnerChildOrganizations, selectedOrgId]);

  const allOrganizations = organizationsQuery.data ?? [];
  const partners = useMemo(
    () => partnerOrganizations(allOrganizations),
    [allOrganizations],
  );
  const directOrganizations = useMemo(
    () =>
      allOrganizations.filter(
        (organization) =>
          organization.kind !== 'PARTNER' && !organization.parentOrganizationId,
      ),
    [allOrganizations],
  );
  const selectedPartner = useMemo(
    () => partners.find((organization) => organization.id === selectedPartnerId) ?? null,
    [partners, selectedPartnerId],
  );
  const selectedPartnerChildOrganizations = useMemo(
    () =>
      superAdminPartnerScope
        ? allOrganizations.filter(
            (organization) => organization.parentOrganizationId === selectedPartnerId,
          )
        : [],
    [allOrganizations, selectedPartnerId, superAdminPartnerScope],
  );
  const aggregatePartnerMode = superAdminPartnerScope && !selectedOrgId;

  useEffect(() => {
    if (!isSuperAdmin || !requestedOrganizationId || allOrganizations.length === 0) return;
    const requestedOrganization = allOrganizations.find(
      (organization) => organization.id === requestedOrganizationId,
    );
    if (!requestedOrganization) return;
    if (requestedOrganization.kind === 'PARTNER') {
      setSelectedPartnerId(requestedOrganization.id);
      setSelectedOrgId(requestedOrganization.id);
      return;
    }
    if (requestedOrganization.parentOrganizationId) {
      setSelectedPartnerId(requestedOrganization.parentOrganizationId);
      setSelectedOrgId(requestedOrganization.id);
      return;
    }
    setSelectedPartnerId(DIRECT_ORGANIZATIONS_VALUE);
    setSelectedOrgId(requestedOrganization.id);
  }, [allOrganizations, isSuperAdmin, requestedOrganizationId]);

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
  const paymentsQuery = useQuery({
    queryKey: ['subscription-payments', primarySub?.id],
    queryFn: () => subscriptionsApi.listPayments(primarySub!.id),
    enabled: Boolean(primarySub?.id),
  });
  const paymentRows = paymentsQuery.data ?? [];
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
    queryClient.invalidateQueries({ queryKey: ['partner-license-details'] });
    queryClient.invalidateQueries({ queryKey: ['subscription-payments'] });
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

  const resetActivationMutation = useMutation({
    mutationFn: licensingApi.resetActivation,
    onSuccess: () => {
      invalidateCommercialQueries();
      toast.success('Device reset — the key is now available to rebind');
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const revokeKeyMutation = useMutation({
    mutationFn: licensingApi.revokeActivationKey,
    onSuccess: () => {
      invalidateCommercialQueries();
      toast.success('Activation key revoked');
      setRevokeKeyId(null);
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const replaceKeyMutation = useMutation({
    mutationFn: licensingApi.replaceActivationKey,
    onSuccess: (key) => {
      invalidateCommercialQueries();
      toast.success(
        `Replacement key created${
          key.activationKey ? `: ${formatActivationKeyForDisplay(key.activationKey)}` : ''
        }`,
      );
      setReplaceKeyId(null);
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
  const globalMode = isSuperAdmin && selectedPartnerId === GLOBAL_LICENSE_VALUE;
  const globalKeysQuery = useQuery({
    queryKey: ['activation-keys', 'global'],
    queryFn: () => licensingApi.listKeys({ perPage: 100 }),
    enabled: globalMode,
  });
  const globalActiveSubscriptions = (subscriptionsQuery.data ?? []).filter(
    (subscription) => subscription.status === 'ACTIVE' || subscription.status === 'TRIAL',
  );
  const globalActivationKeys = globalKeysQuery.data?.data ?? [];
  const usage = primarySub
    ? Math.min(100, (primarySub.seatUsage / Math.max(primarySub.seatLimit, 1)) * 100)
    : 0;

  const aggregateDetails = aggregatePartnerMode ? partnerDetailsQuery.data : null;
  const aggregateSubscriptions = aggregateDetails?.subscriptions ?? [];
  const aggregateSummary = aggregateDetails?.summary ?? null;
  const aggregateActivationKeys = aggregateDetails?.hardwareActivationKeys ?? [];
  const aggregatePaymentRows = aggregateDetails?.payments ?? [];
  const displayedPaymentRows = aggregatePartnerMode ? aggregatePaymentRows : paymentRows;
  const displayedBillingSubscriptions = aggregatePartnerMode ? aggregateSubscriptions : orgSubs;
  const billingScopeLabel = aggregatePartnerMode
    ? `${selectedPartner?.name ?? 'this partner'} and child organizations`
    : selectedOrganization?.name ?? 'this workspace';
  const billingIsLoading = aggregatePartnerMode
    ? partnerDetailsQuery.isLoading
    : paymentsQuery.isLoading;
  const selectedChildUnderPartner =
    isSuperAdmin &&
    superAdminPartnerScope &&
    !!selectedOrganization?.parentOrganizationId &&
    selectedOrganization.parentOrganizationId === selectedPartnerId;
  const activationKeys = orgDetailsQuery.data?.hardwareActivationKeys ?? [];
  const displayedActivationKeys = aggregatePartnerMode
    ? aggregateActivationKeys
    : activationKeys;
  const partnerPool = isPartnerAdmin
    ? orgDetailsQuery.data?.partnerPool ?? null
    : selectedChildUnderPartner || aggregatePartnerMode
      ? partnerDetailsQuery.data?.partnerPool ?? null
      : null;
  const usableKeyCount = activationKeys.filter((key) =>
    key.status === 'AVAILABLE' || key.status === 'BOUND',
  ).length;
  const emailedUsableKeyCount = activationKeys.filter(
    (key) =>
      (key.status === 'AVAILABLE' || key.status === 'BOUND') &&
      Boolean(key.emailSentAt),
  ).length;
  const activePrimarySub =
    primarySub && ['ACTIVE', 'TRIAL'].includes(primarySub.status) ? primarySub : null;
  const activeOrgSeatLimit = orgSubs
    .filter((subscription) => subscription.status === 'ACTIVE' || subscription.status === 'TRIAL')
    .reduce((sum, subscription) => sum + subscription.seatLimit, 0);
  const selectedOwnPartnerOrg =
    isPartnerAdmin &&
    !!user?.primaryOrganization?.id &&
    selectedOrganization?.id === user.primaryOrganization.id;
  const selectedSuperAdminPartnerOrg =
    isSuperAdmin &&
    superAdminPartnerScope &&
    selectedOrganization?.id === selectedPartnerId;
  const partnerKeySourceSubscription =
    partnerPool?.subscriptions.find((subscription) => subscription.remainingActivationKeys > 0) ??
    partnerPool?.subscriptions[0] ??
    null;
  const usesPartnerActivationPool = isPartnerAdmin || selectedChildUnderPartner;
  const activationPoolSubscriptionId = usesPartnerActivationPool
    ? partnerKeySourceSubscription?.id ?? null
    : activePrimarySub?.id ?? null;
  const activationPoolSeatLimit = usesPartnerActivationPool
    ? selectedOwnPartnerOrg || selectedSuperAdminPartnerOrg
      ? partnerPool?.seatLimit ?? 0
      : activeOrgSeatLimit
    : activePrimarySub?.seatLimit ?? 0;
  const activationPoolUsableKeyCount = usesPartnerActivationPool
    ? selectedOwnPartnerOrg || selectedSuperAdminPartnerOrg
      ? partnerPool?.usableKeyCount ?? usableKeyCount
      : usableKeyCount
    : usableKeyCount;
  const organizationRemainingActivationKeys = Math.max(
    activationPoolSeatLimit - activationPoolUsableKeyCount,
    0,
  );
  const partnerRemainingActivationKeys = usesPartnerActivationPool
    ? partnerPool?.remainingActivationKeys ?? 0
    : organizationRemainingActivationKeys;
  const remainingActivationKeys = usesPartnerActivationPool
    ? Math.min(organizationRemainingActivationKeys, partnerRemainingActivationKeys)
    : organizationRemainingActivationKeys;
  const newEmailSlotsRemaining = Math.max(
    activationPoolSeatLimit - emailedUsableKeyCount,
    0,
  );
  const canCreateActivationKey =
    !!selectedOrganization &&
    canManageActivationKeys &&
    !!activationPoolSubscriptionId &&
    remainingActivationKeys > 0 &&
    !orgDetailsQuery.isLoading &&
    !(usesPartnerActivationPool && partnerDetailsQuery.isLoading);
  const capacityText = activationPoolSeatLimit > 0
    ? `${activationPoolUsableKeyCount}/${activationPoolSeatLimit} usable keys`
    : usesPartnerActivationPool
      ? 'No active partner subscription'
      : 'No active subscription';
  const allDevices = displayedActivationKeys.flatMap((key) =>
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
    setBulkMode('choice');
    setAutoBulkCount(1);
    setBulkRows([{ label: '', maxDevices: 1 }]);
    setBulkOpen(true);
  };

  const closeBulkDialog = () => {
    setBulkOpen(false);
    setBulkResult(null);
    setBulkMode('choice');
    setAutoBulkCount(1);
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
  const maxAutoBulkCount = Math.min(remainingActivationKeys, 100);

  const submitBulk = () => {
    if (!selectedOrganization) return;
    if (validBulkRows.length === 0) {
      toast.error('Add at least one key with a label');
      return;
    }
    if (validBulkRows.length > remainingActivationKeys) {
      toast.error(`Only ${remainingActivationKeys} activation key seat(s) remaining`);
      return;
    }
    bulkMutation.mutate({
      organizationId: selectedOrganization.id,
      subscriptionId: activationPoolSubscriptionId,
      sourcePartnerOrganizationId: selectedChildUnderPartner ? selectedPartnerId : null,
      keys: validBulkRows.map((row) => ({
        label: row.label.trim(),
        maxDevices: 1,
      })),
    });
  };

  const submitAutoBulk = () => {
    if (!selectedOrganization) return;
    const count = Math.trunc(autoBulkCount);
    if (count < 1 || count > maxAutoBulkCount) {
      toast.error(`Enter a number from 1 to ${maxAutoBulkCount}`);
      return;
    }
    bulkMutation.mutate({
      organizationId: selectedOrganization.id,
      subscriptionId: activationPoolSubscriptionId,
      sourcePartnerOrganizationId: selectedChildUnderPartner ? selectedPartnerId : null,
      keys: Array.from({ length: count }, (_, index) => ({
        label: `Auto activation key ${index + 1}`,
        maxDevices: 1,
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

  const exportGlobalKeys = async () => {
    setIsExporting(true);
    try {
      await licensingApi.exportKeyList({}, exportFormat);
      toast.success(`Activation keys exported (${exportFormat.toUpperCase()})`);
    } catch (error) {
      toast.error(extractApiError(error));
    } finally {
      setIsExporting(false);
    }
  };

  const exportPartnerKeys = async () => {
    if (!superAdminPartnerScope) return;
    setIsExporting(true);
    try {
      await licensingApi.exportKeyList({ partnerOrganizationId: selectedPartnerId }, exportFormat);
      toast.success(`Activation keys exported (${exportFormat.toUpperCase()})`);
    } catch (error) {
      toast.error(extractApiError(error));
    } finally {
      setIsExporting(false);
    }
  };

  const handleSuperAdminPartnerChange = (value: string) => {
    setSelectedPartnerId(value);
    if (value === GLOBAL_LICENSE_VALUE) {
      setSelectedOrgId(null);
      return;
    }
    if (value === DIRECT_ORGANIZATIONS_VALUE) {
      setSelectedOrgId(directOrganizations[0]?.id ?? null);
      return;
    }
    setSelectedOrgId(null);
  };

  const superAdminOrganizationValue =
    selectedPartnerId === DIRECT_ORGANIZATIONS_VALUE
      ? selectedOrgId ?? NO_ORGANIZATION_VALUE
      : aggregatePartnerMode
        ? PARTNER_AGGREGATE_VALUE
        : selectedOrgId === selectedPartnerId
          ? PARTNER_SELF_VALUE
          : selectedOrgId ?? PARTNER_AGGREGATE_VALUE;

  const handleSuperAdminOrganizationChange = (value: string) => {
    if (selectedPartnerId === DIRECT_ORGANIZATIONS_VALUE) {
      setSelectedOrgId(value === NO_ORGANIZATION_VALUE ? null : value);
      return;
    }
    if (!superAdminPartnerScope) return;
    if (value === PARTNER_AGGREGATE_VALUE) {
      setSelectedOrgId(null);
      return;
    }
    if (value === PARTNER_SELF_VALUE) {
      setSelectedOrgId(selectedPartnerId);
      return;
    }
    setSelectedOrgId(value);
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
            <>
              <Select
                value={selectedPartnerId}
                onValueChange={handleSuperAdminPartnerChange}
              >
                <SelectTrigger className="w-72">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent searchPlaceholder="Search partner...">
                  <SelectItem value={GLOBAL_LICENSE_VALUE}>General licensing overview</SelectItem>
                  {partners.map((organization) => (
                    <SelectItem key={organization.id} value={organization.id}>
                      {organization.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={DIRECT_ORGANIZATIONS_VALUE}>
                    Direct / internal
                  </SelectItem>
                </SelectContent>
              </Select>
              {selectedPartnerId !== GLOBAL_LICENSE_VALUE && (
                <Select
                  value={superAdminOrganizationValue}
                  onValueChange={handleSuperAdminOrganizationChange}
                >
                  <SelectTrigger className="w-72">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent searchPlaceholder="Search organization...">
                    {selectedPartnerId === DIRECT_ORGANIZATIONS_VALUE ? (
                      directOrganizations.length > 0 ? (
                        directOrganizations.map((organization) => (
                          <SelectItem key={organization.id} value={organization.id}>
                            {organization.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value={NO_ORGANIZATION_VALUE}>
                          No direct organizations
                        </SelectItem>
                      )
                    ) : (
                      <>
                        <SelectItem value={PARTNER_AGGREGATE_VALUE}>
                          {selectedPartner?.name ?? 'Partner'} + all organizations
                        </SelectItem>
                        <SelectItem value={PARTNER_SELF_VALUE}>
                          Partner organization only
                        </SelectItem>
                        {selectedPartnerChildOrganizations.map((organization) => (
                          <SelectItem key={organization.id} value={organization.id}>
                            {organization.name}
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              )}
            </>
          )}
          {isPartnerAdmin && partnerChildOrganizations.length > 0 && (
            <Select
              value={selectedOrganization?.id ?? partnerChildOrganizations[0].id}
              onValueChange={(value) => setSelectedOrgId(value)}
            >
              <SelectTrigger className="w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {partnerChildOrganizations.map((organization) => (
                  <SelectItem key={organization.id} value={organization.id}>
                    {organization.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <Card className="px-4 py-5 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              Organizations
            </p>
            <p className="mt-2 text-3xl font-black text-ink-900">
              {organizationsQuery.data?.length ?? 0}
            </p>
            <p className="mt-1 text-sm text-ink-500">Managed launch workspaces</p>
          </Card>
          <Card className="px-4 py-5 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              Active plans
            </p>
            <p className="mt-2 text-3xl font-black text-success">
              {globalActiveSubscriptions.length}
            </p>
            <p className="mt-1 text-sm text-ink-500">Active or trial subscriptions</p>
          </Card>
          <Card className="px-4 py-5 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              Seats
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
          <Card className="relative px-4 py-5 sm:px-6">
            <Badge variant="info" className="absolute right-4 top-4">Coming Soon</Badge>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              AI Credits
            </p>
            <p className="mt-2 text-3xl font-black text-ink-300">--</p>
            <p className="mt-1 text-sm text-ink-500">Available in a future release</p>
          </Card>
        </div>
      )}

      {globalMode && (
        <Card>
          <div className="flex flex-col gap-3 border-b border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h3 className="text-base font-semibold text-ink-900">Activation Keys</h3>
              <p className="text-xs text-ink-500">
                Partner-created and direct keys across all organizations.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={exportFormat}
                onValueChange={(value) => setExportFormat(value as AdminExportFormat)}
              >
                <SelectTrigger className="h-10 w-28" aria-label="Export format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="xlsx">XLSX</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                disabled={isExporting || globalActivationKeys.length === 0}
                onClick={exportGlobalKeys}
              >
                {isExporting ? <Spinner className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                Export
              </Button>
            </div>
          </div>
          {globalKeysQuery.isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Spinner className="h-6 w-6 text-brand-primary" />
            </div>
          ) : (
            <Table className="min-w-[1100px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Source subscription</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created by</TableHead>
                  <TableHead>Emailed</TableHead>
                  <TableHead>Bound device</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {globalActivationKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-semibold text-ink-900">
                      {key.label ?? '-'}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-ink-900">{key.organization?.name ?? '-'}</p>
                      <p className="text-xs text-ink-500">{key.organization?.kind ?? ''}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-ink-900">{key.subscription?.planName ?? '-'}</p>
                      <p className="text-xs text-ink-500">
                        {key.subscription?.organization?.name ?? ''}
                      </p>
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
                      <p className="text-sm text-ink-900">
                        {key.createdBy?.name ?? key.createdBy?.email ?? '-'}
                      </p>
                      <p className="text-xs text-ink-500">{key.createdBy?.role ?? ''}</p>
                    </TableCell>
                    <TableCell>{key.emailSentAt ? formatDate(key.emailSentAt) : '-'}</TableCell>
                    <TableCell>
                      <p className="text-sm text-ink-900">
                        {key.boundActivation?.deviceModel ?? '-'}
                      </p>
                      <p className="text-xs text-ink-500">
                        {key.boundActivation?.devicePlatform ?? ''}
                      </p>
                    </TableCell>
                    <TableCell>{formatDate(key.createdAt)}</TableCell>
                  </TableRow>
                ))}
                {globalActivationKeys.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-sm text-ink-500">
                      No activation keys issued yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      {aggregatePartnerMode ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <div className="flex flex-col gap-3 border-b border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <h3 className="flex items-center gap-2 text-base font-semibold text-ink-900">
                  <KeyRound className="h-4 w-4 text-brand-primary" />
                  Partner Scope
                </h3>
                <p className="text-xs text-ink-500">
                  {selectedPartner?.name ?? 'Partner'} + child organizations
                </p>
              </div>
              <Badge variant="info">Combined</Badge>
            </div>
            <div className="space-y-3 px-4 py-5 sm:px-6">
              {partnerDetailsQuery.isLoading ? (
                <div className="flex h-24 items-center justify-center">
                  <Spinner className="h-5 w-5 text-brand-primary" />
                </div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-ink-500">
                        Organizations
                      </p>
                      <p className="text-sm font-semibold text-ink-900">
                        {aggregateSummary?.organizationCount ?? 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-ink-500">
                        Child organizations
                      </p>
                      <p className="text-sm font-semibold text-ink-900">
                        {aggregateSummary?.childOrganizationCount ?? 0}
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3 pt-1 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-ink-500">
                        Active plans
                      </p>
                      <p className="text-sm font-semibold text-ink-900">
                        {aggregateSummary?.activeSubscriptionCount ?? 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-ink-500">
                        Activation keys
                      </p>
                      <p className="text-sm font-semibold text-ink-900">
                        {aggregateSummary
                          ? `${aggregateSummary.usableKeyCount}/${aggregateSummary.seatLimit} usable keys`
                          : '0/0 usable keys'}
                      </p>
                    </div>
                  </div>
                  <p className="pt-2 text-xs text-ink-500">
                    Partner pool remaining:{' '}
                    {partnerPool?.remainingActivationKeys ?? aggregateSummary?.remainingActivationKeys ?? 0}
                  </p>
                </>
              )}
            </div>
          </Card>

          <Card>
            <div className="border-b border-line px-4 py-4 sm:px-6">
              <h3 className="flex items-center gap-2 text-base font-semibold text-ink-900">
                <Sofa className="h-4 w-4 text-brand-primary" />
                Seats
              </h3>
              <p className="text-xs text-ink-500">
                Active users across the selected partner scope
              </p>
            </div>
            <div className="space-y-4 px-4 py-5 sm:px-6">
              {aggregateSummary && (
                <SeatsBanner
                  seatLimit={aggregateSummary.seatLimit}
                  seatUsage={aggregateSummary.seatUsage}
                />
              )}
              <p className="text-2xl font-bold text-ink-900">
                {aggregateSummary?.seatUsage ?? 0}
                <span className="text-sm font-medium text-ink-500">
                  {' '}/ {aggregateSummary?.seatLimit ?? 0}
                </span>
              </p>
              <Progress
                value={
                  aggregateSummary
                    ? Math.min(
                        100,
                        (aggregateSummary.seatUsage / Math.max(aggregateSummary.seatLimit, 1)) * 100,
                      )
                    : 0
                }
              />
              <p className="text-xs text-ink-500">
                Seats include teachers, students, and parents combined.
              </p>
            </div>
          </Card>
        </div>
      ) : !globalMode && selectedOrganization ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <div className="flex flex-col gap-3 border-b border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
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
            <div className="space-y-3 px-4 py-5 sm:px-6">
              <p className="text-xs uppercase tracking-wide text-ink-500">Branding</p>
              <p className="text-sm text-ink-700">
                {primarySub ? BRANDING_MODE_LABEL[primarySub.brandingMode] : '—'}
              </p>
              <div className="grid gap-3 pt-2 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-ink-500">Term</p>
                  <p className="text-sm font-semibold text-ink-900">
                    {primarySub
                      ? `${formatDate(primarySub.startDate)} - ${
                          primarySub.endDate ? formatDate(primarySub.endDate) : 'No end date'
                        }`
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-ink-500">Number of seats</p>
                  <p className="text-sm font-semibold text-ink-900">
                    {primarySub?.seatLimit ?? 0}
                  </p>
                </div>
              </div>
              <div className="grid gap-3 pt-1 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-ink-500">Activation keys</p>
                  <p className="text-sm font-semibold text-ink-900">{capacityText}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-ink-500">Remaining</p>
                  <p className="text-sm font-semibold text-ink-900">
                    {remainingActivationKeys}
                  </p>
                </div>
              </div>
              <p className="pt-2 text-xs text-ink-500">
                Storage:{' '}
                {selectedOrganization
                  ? STORAGE_STATUS_LABEL[selectedOrganization.storageStatus]
                  : '—'}
              </p>
            </div>
          </Card>

          <Card>
            <div className="border-b border-line px-4 py-4 sm:px-6">
              <h3 className="flex items-center gap-2 text-base font-semibold text-ink-900">
                <Sofa className="h-4 w-4 text-brand-primary" />
                Seats
              </h3>
              <p className="text-xs text-ink-500">Active organization users</p>
            </div>
            <div className="space-y-4 px-4 py-5 sm:px-6">
              {primarySub && (
                <SeatsBanner
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
      ) : null}

      {isSuperAdmin && !aggregatePartnerMode && (
        <div className="space-y-5">
          <Card className="space-y-4 px-4 py-5 sm:px-6">
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
            <Card className="space-y-4 px-4 py-5 sm:px-6">
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

            <Card className="relative space-y-5 px-4 py-5 sm:px-6">
              <div>
                <h3 className="flex items-center gap-2 text-base font-semibold text-ink-900">
                  <Cpu className="h-4 w-4 text-brand-primary" />
                  Hardware Activation Keys
                </h3>
                <p className="text-xs text-ink-500">
                  Each key activates one board/device. Any active user in that organization can use the app on that activated device.
                </p>
                <p className="mt-1 text-xs font-medium text-ink-600">
                  {capacityText} · {remainingActivationKeys} remaining
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
                      value={1}
                      disabled
                      placeholder="Max devices"
                    />
                    <p className="text-xs text-ink-500">1 = single device lock</p>
                  </div>
                </div>
                <Button
                  variant="primary"
                  className="w-full"
                  disabled={
                    !canCreateActivationKey ||
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
                      subscriptionId: activationPoolSubscriptionId,
                      sourcePartnerOrganizationId: selectedChildUnderPartner ? selectedPartnerId : null,
                      label: keyLabel.trim(),
                      maxDevices: 1,
                    });
                  }}
                >
                  {hardwareMutation.isPending && <Spinner className="h-4 w-4" />}
                  Create activation key
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={!canCreateActivationKey}
                  onClick={openBulkDialog}
                >
                  <Layers className="h-4 w-4" />
                  Bulk create keys
                </Button>
              </div>

              <Button
                variant="outline"
                className="w-full"
                disabled={!selectedOrganization || activationKeys.length === 0}
                onClick={() => setEmailKeysOpen(true)}
              >
                <Mail className="h-4 w-4" />
                Choose keys to email org admin
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

      {isPartnerAdmin && !globalMode && selectedOrganization && (
        <Card className="space-y-5 px-4 py-5 sm:px-6">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold text-ink-900">
              <Cpu className="h-4 w-4 text-brand-primary" />
              Hardware Activation Keys
            </h3>
            <p className="text-xs text-ink-500">
              Each key activates one board/device. Keys are allocated from the partner pool.
            </p>
            <p className="mt-1 text-xs font-medium text-ink-600">
              {partnerPool
                ? `${partnerPool.organizationName} pool: ${capacityText} · ${remainingActivationKeys} remaining`
                : capacityText}
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
                  value={1}
                  disabled
                  placeholder="Max devices"
                />
                <p className="text-xs text-ink-500">1 = single device lock</p>
              </div>
            </div>
            <Button
              variant="primary"
              className="w-full"
              disabled={
                !canCreateActivationKey ||
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
                  subscriptionId: activationPoolSubscriptionId,
                  sourcePartnerOrganizationId: selectedChildUnderPartner ? selectedPartnerId : null,
                  label: keyLabel.trim(),
                  maxDevices: 1,
                });
              }}
            >
              {hardwareMutation.isPending && <Spinner className="h-4 w-4" />}
              Create activation key
            </Button>
            <Button
              variant="outline"
              className="w-full"
              disabled={!canCreateActivationKey}
              onClick={openBulkDialog}
            >
              <Layers className="h-4 w-4" />
              Bulk create keys
            </Button>
          </div>

          <Button
            variant="outline"
            className="w-full"
            disabled={!selectedOrganization || activationKeys.length === 0}
            onClick={() => setEmailKeysOpen(true)}
          >
            <Mail className="h-4 w-4" />
            Choose keys to email org admin
          </Button>
        </Card>
      )}

      {!globalMode && (selectedOrganization || aggregatePartnerMode) && (
        <>
          <Card>
            <div className="flex flex-col gap-3 border-b border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <h3 className="text-base font-semibold text-ink-900">Activation Keys</h3>
                <p className="text-xs text-ink-500">
                  {aggregatePartnerMode
                    ? 'Reveal, copy, or manage keys across the selected partner scope.'
                    : 'Reveal, copy, or email the full key to the organization admin.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={exportFormat}
                  onValueChange={(value) => setExportFormat(value as AdminExportFormat)}
                >
                  <SelectTrigger className="h-10 w-28" aria-label="Export format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="xlsx">XLSX</SelectItem>
                    <SelectItem value="csv">CSV</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  disabled={isExporting || displayedActivationKeys.length === 0}
                  onClick={aggregatePartnerMode ? exportPartnerKeys : exportKeys}
                >
                  {isExporting ? <Spinner className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                  Export
                </Button>
                {canManageActivationKeys && !aggregatePartnerMode && (
                  <Button
                    variant="outline"
                    disabled={activationKeys.length === 0}
                    onClick={() => setEmailKeysOpen(true)}
                  >
                    <Mail className="h-4 w-4" />
                    Email org admin
                  </Button>
                )}
              </div>
            </div>
            <Table className="min-w-[980px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  {aggregatePartnerMode && <TableHead>Organization</TableHead>}
                  <TableHead>Key</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Bound device</TableHead>
                  <TableHead>Expires</TableHead>
                  {isSuperAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedActivationKeys.map((key) => {
                  const revealed = revealedKeyIds[key.id];
                  const plain = key.activationKey ?? '';
                  const displayKey = formatActivationKeyForDisplay(plain);
                  return (
                    <TableRow key={key.id}>
                      <TableCell>
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
                      {aggregatePartnerMode && (
                        <TableCell>
                          <p className="text-sm font-medium text-ink-900">
                            {key.organization?.name ?? '-'}
                          </p>
                          <p className="text-xs text-ink-500">
                            {key.organization?.kind ?? ''}
                          </p>
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="rounded border border-line bg-surface-variant px-2 py-1 font-mono text-xs">
                            {revealed && plain ? displayKey : plain ? '••••••••••••' : '<legacy — reissue to reveal>'}
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
                                onClick={() => copyValue(displayKey, 'Activation key copied')}
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
                      {isSuperAdmin && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={key.status === 'DISABLED'}
                              onClick={() => setRevokeKeyId(key.id)}
                            >
                              Revoke
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setReplaceKeyId(key.id)}
                            >
                              Replace
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
                {displayedActivationKeys.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={
                        (isSuperAdmin ? 6 : 5) + (aggregatePartnerMode ? 1 : 0)
                      }
                      className="py-12 text-center"
                    >
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
                        {canManageActivationKeys && !aggregatePartnerMode && (
                          <Button
                            variant="primary"
                            size="sm"
                            className="mt-1"
                            disabled={!canCreateActivationKey}
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
            <div className="border-b border-line px-4 py-4 sm:px-6">
              <h3 className="text-base font-semibold text-ink-900">Active Devices</h3>
              <p className="text-xs text-ink-500">
                One activation per device. Reset a row to allow re-binding on a new device.
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

      {!globalMode && (selectedOrganization || aggregatePartnerMode) && (
        <Card>
          <div className="flex flex-col gap-3 border-b border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h3 className="text-base font-semibold text-ink-900">Billing History</h3>
              <p className="text-xs text-ink-500">
                Subscription cycles for {billingScopeLabel}
              </p>
            </div>
          </div>
          <Table className="min-w-[920px]">
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                {aggregatePartnerMode && <TableHead>Organization</TableHead>}
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Recorded by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedPaymentRows.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>
                    <p className="font-mono text-sm font-medium text-ink-900">
                      {payment.invoiceNumber ?? `#PAY-${payment.id.slice(0, 6).toUpperCase()}`}
                    </p>
                  </TableCell>
                  {aggregatePartnerMode && (
                    <TableCell>
                      <p className="text-sm text-ink-700">
                        {paymentOrganizationName(payment)}
                      </p>
                    </TableCell>
                  )}
                  <TableCell>
                    <p className="text-sm text-ink-700">{formatDate(payment.createdAt)}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm font-medium text-ink-900">
                      {formatMoney(payment.amountMinor, payment.currency)}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        payment.status === 'MANUAL_APPROVED' ||
                        payment.status === 'PAID' ||
                        payment.status === 'SUCCEEDED'
                          ? 'success'
                          : payment.status === 'FAILED'
                            ? 'danger'
                            : 'warning'
                      }
                    >
                      {payment.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <p className="max-w-xs whitespace-normal text-sm text-ink-700">
                      {payment.referenceNote ?? '—'}
                    </p>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm text-ink-700">
                      {payment.recordedBy?.name ?? payment.recordedBy?.email ?? '—'}
                    </p>
                  </TableCell>
                </TableRow>
              ))}
              {displayedPaymentRows.length === 0 &&
                displayedBillingSubscriptions.map((subscription) => (
                  <TableRow key={subscription.id}>
                    <TableCell>
                      <p className="font-mono text-sm font-medium text-ink-900">
                        #SUB-{subscription.id.slice(0, 6).toUpperCase()}
                      </p>
                    </TableCell>
                    {aggregatePartnerMode && (
                      <TableCell>
                        <p className="text-sm text-ink-700">
                          {subscription.organization?.name ?? '-'}
                        </p>
                      </TableCell>
                    )}
                    <TableCell>
                      <p className="text-sm text-ink-700">
                        {formatDate(subscription.startDate)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-ink-700">—</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={subscription.status === 'ACTIVE' ? 'success' : 'warning'}>
                        {subscription.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-ink-700">{subscription.planName}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-ink-700">—</p>
                    </TableCell>
                  </TableRow>
                ))}
              {displayedPaymentRows.length === 0 && displayedBillingSubscriptions.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6 + (aggregatePartnerMode ? 1 : 0)}
                    className="py-10 text-center text-sm text-ink-500"
                  >
                    {billingIsLoading ? 'Loading billing history...' : 'No invoices yet.'}
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

          {!bulkResult && bulkMode === 'choice' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                className="h-auto justify-start px-4 py-4 text-left"
                onClick={() => setBulkMode('manual')}
              >
                <Layers className="h-4 w-4" />
                <span>
                  <span className="block font-semibold">Manual</span>
                  <span className="block text-xs font-normal text-ink-500">Add labels one by one</span>
                </span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-auto justify-start px-4 py-4 text-left"
                onClick={() => setBulkMode('auto')}
              >
                <Plus className="h-4 w-4" />
                <span>
                  <span className="block font-semibold">Auto</span>
                  <span className="block text-xs font-normal text-ink-500">Generate labels automatically</span>
                </span>
              </Button>
            </div>
          ) : !bulkResult && bulkMode === 'manual' ? (
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
                      value={1}
                      disabled
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
              <p className="text-xs text-ink-500">
                {remainingActivationKeys} activation key seat(s) remaining.
              </p>
            </div>
          ) : !bulkResult && bulkMode === 'auto' ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Number of keys
                </label>
                <Input
                  type="number"
                  min={1}
                  max={maxAutoBulkCount}
                  value={autoBulkCount}
                  onChange={(event) =>
                    setAutoBulkCount(Math.max(1, Number(event.target.value) || 1))
                  }
                />
              </div>
              <p className="text-xs text-ink-500">
                {remainingActivationKeys} activation key seat(s) remaining.
              </p>
            </div>
          ) : bulkResult ? (
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
                      {formatActivationKeyForDisplay(key.activationKey)}
                    </code>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      copyValue(
                        formatActivationKeyForDisplay(key.activationKey),
                        'Activation key copied',
                      )
                    }
                    title="Copy"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : null}

          <DialogFooter>
            {!bulkResult && bulkMode === 'choice' ? (
              <Button type="button" variant="outline" onClick={closeBulkDialog}>
                Cancel
              </Button>
            ) : !bulkResult && bulkMode === 'manual' ? (
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
                    validBulkRows.length > remainingActivationKeys ||
                    bulkMutation.isPending
                  }
                  onClick={submitBulk}
                >
                  {bulkMutation.isPending && <Spinner className="h-4 w-4" />}
                  Create {validBulkRows.length || ''} key
                  {validBulkRows.length === 1 ? '' : 's'}
                </Button>
              </>
            ) : !bulkResult && bulkMode === 'auto' ? (
              <>
                <Button type="button" variant="outline" onClick={closeBulkDialog}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  disabled={
                    !selectedOrganization ||
                    autoBulkCount < 1 ||
                    autoBulkCount > maxAutoBulkCount ||
                    bulkMutation.isPending
                  }
                  onClick={submitAutoBulk}
                >
                  {bulkMutation.isPending && <Spinner className="h-4 w-4" />}
                  Create {autoBulkCount} key{autoBulkCount === 1 ? '' : 's'}
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

      {labelEdit && (
        <ActivationKeyLabelDialog
          keyId={labelEdit.id}
          currentLabel={labelEdit.label}
          open
          onOpenChange={(open) => !open && setLabelEdit(null)}
          onSaved={invalidateCommercialQueries}
        />
      )}

      {selectedOrganization && emailKeysOpen && (
        <EmailActivationKeysDialog
          key={selectedOrganization.id}
          open
          organizationId={selectedOrganization.id}
          organizationName={selectedOrganization.name}
          keys={activationKeys}
          newEmailSlotsRemaining={newEmailSlotsRemaining}
          onOpenChange={(open) => setEmailKeysOpen(open)}
          onSent={invalidateCommercialQueries}
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
