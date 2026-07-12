import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ClipboardPaste,
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
  Search,
  Sofa,
  Trash2,
  Undo2,
  WalletCards,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';

import { organizationsApi } from '@/services/organizations.api';
import { licensingApi } from '@/services/licensing.api';
import { dashboardApi } from '@/services/dashboard.api';
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
  STORAGE_STATUS_LABEL,
  type HardwareActivationKeyRecord,
  type PartnerLicensePaymentRecord,
  type PaymentTransactionStatus,
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
import { AssignActivationKeysDialog } from '@/components/license/AssignActivationKeysDialog';
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

const PAYMENT_STATUS_OPTIONS: PaymentTransactionStatus[] = [
  'PENDING',
  'PAID',
  'FAILED',
  'REFUNDED',
  'MANUAL_APPROVED',
];

function dateInputValue(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function dateInputToIso(value: string): string | null {
  return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : null;
}

function dateTimeLocalValue(value: Date): string {
  const offsetMs = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
}

function dateTimeInputToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function addMonths(value: Date, months: number): Date {
  const next = new Date(value);
  next.setMonth(next.getMonth() + months);
  return next;
}

function durationMonthsFor(value: DurationOptionValue): number | null {
  return DURATION_OPTIONS.find((option) => option.value === value)?.months ?? null;
}

function keySourceLabel(key: HardwareActivationKeyRecord) {
  if (key.subscription?.organization?.name) return key.subscription.organization.name;
  if (key.subscription?.planName) return key.subscription.planName;
  if (key.organization?.kind === 'PARTNER') return 'Partner pool';
  return 'Direct licence';
}

function keySourceDetail(key: HardwareActivationKeyRecord) {
  if (key.subscription?.planName && key.subscription.organization?.name) {
    return key.subscription.planName;
  }
  return '';
}

const DURATION_OPTIONS = [
  { value: '1', label: '1 month', months: 1 },
  { value: '3', label: '3 months', months: 3 },
  { value: '6', label: '6 months', months: 6 },
  { value: '12', label: '12 months', months: 12 },
  { value: 'custom', label: 'Custom dates', months: null },
] as const;

type DurationOptionValue = (typeof DURATION_OPTIONS)[number]['value'];

interface PaymentEditState {
  id: string;
  amount: string;
  currency: string;
  status: PaymentTransactionStatus;
  referenceNote: string;
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
}

interface ActivationKeyTermEditState {
  id: string;
  label: string;
  startsAt: string;
  expiresAt: string;
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
      ? 'All teacher licences are in use'
      : `Teacher licences are at ${Math.round(pct * 100)}% capacity`;
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
        {seatUsage}/{seatLimit} licences
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
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isPartnerAdmin = user?.role === 'PARTNER_ADMIN';
  const requestedOrganizationId = searchParams.get('organizationId');
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>(
    GLOBAL_LICENSE_VALUE,
  );
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(
    requestedOrganizationId ??
      (isSuperAdmin || isPartnerAdmin ? null : (user?.primaryOrganization?.id ?? null)),
  );
  const [manualReference, setManualReference] = useState('');
  // Amount is entered in major units (e.g. rupees) and converted to minor units
  // (paise) on submit — matching the edit-payment flow.
  const [amountMajor, setAmountMajor] = useState(1000);
  const [currency, setCurrency] = useState('INR');
  const [revealedKeyIds, setRevealedKeyIds] = useState<Record<string, boolean>>({});
  const [keyLabel, setKeyLabel] = useState('');
  const [keyLabelTouched, setKeyLabelTouched] = useState(false);
  const [licenseStartInput, setLicenseStartInput] = useState(() =>
    dateTimeLocalValue(new Date()),
  );
  const [licenseDuration, setLicenseDuration] =
    useState<DurationOptionValue>('12');
  const [licenseEndInput, setLicenseEndInput] = useState(() =>
    dateTimeLocalValue(addMonths(new Date(), 12)),
  );
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
  const [archiveKeyId, setArchiveKeyId] = useState<string | null>(null);
  const [keyView, setKeyView] = useState<'live' | 'archived'>('live');
  const [labelEdit, setLabelEdit] = useState<{ id: string; label: string } | null>(null);
  const [termEdit, setTermEdit] = useState<ActivationKeyTermEditState | null>(null);
  const [emailKeysOpen, setEmailKeysOpen] = useState(false);
  const [assignKeysOpen, setAssignKeysOpen] = useState(false);
  const [paymentEdit, setPaymentEdit] = useState<PaymentEditState | null>(null);

  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [debouncedGlobalSearch, setDebouncedGlobalSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedGlobalSearch(globalSearchQuery.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [globalSearchQuery]);

  const handlePasteSearch = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setGlobalSearchQuery(text.trim());
      }
    } catch {
      toast.error('Failed to paste from clipboard');
    }
  };

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
  const partnerScopeId = superAdminPartnerScope
    ? selectedPartnerId
    : isPartnerAdmin
      ? user?.primaryOrganization?.id ?? null
      : null;
  const partnerDetailsQuery = useQuery({
    queryKey: ['partner-license-details', partnerScopeId],
    queryFn: () => licensingApi.getPartnerLicenseDetails(partnerScopeId!),
    enabled: Boolean(partnerScopeId && (superAdminPartnerScope || isPartnerAdmin)),
  });

  useEffect(() => {
    const option = DURATION_OPTIONS.find((item) => item.value === licenseDuration);
    if (!option?.months) return;
    const start = new Date(licenseStartInput);
    if (Number.isNaN(start.getTime())) return;
    setLicenseEndInput(dateTimeLocalValue(addMonths(start, option.months)));
  }, [licenseDuration, licenseStartInput]);

  useEffect(() => {
    if (!isSuperAdmin && !isPartnerAdmin && !selectedOrgId && user?.primaryOrganization?.id) {
      const timer = window.setTimeout(() => {
        setSelectedOrgId(user.primaryOrganization?.id ?? null);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [isPartnerAdmin, isSuperAdmin, selectedOrgId, user?.primaryOrganization?.id]);

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
    [isPartnerAdmin, organizationsQuery.data, user],
  );

  useEffect(() => {
    if (!isPartnerAdmin || partnerChildOrganizations.length === 0) return;
    if (selectedOrgId === null) return;
    const selectedChild = partnerChildOrganizations.some((org) => org.id === selectedOrgId);
    if (!selectedChild) {
      const timer = window.setTimeout(() => setSelectedOrgId(null), 0);
      return () => window.clearTimeout(timer);
    }
  }, [isPartnerAdmin, partnerChildOrganizations, selectedOrgId]);

  const allOrganizations = useMemo(
    () => organizationsQuery.data ?? [],
    [organizationsQuery.data],
  );
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
  const aggregatePartnerMode = Boolean(
    partnerScopeId && !selectedOrgId && (superAdminPartnerScope || isPartnerAdmin),
  );
  const partnerScopeName =
    partnerDetailsQuery.data?.partner.name ??
    selectedPartner?.name ??
    user?.primaryOrganization?.name ??
    'Partner';
  const partnerAssignableOrganizations = useMemo(() => {
    if (!partnerScopeId) return [];
    const detailedOrganizations = partnerDetailsQuery.data?.organizations ?? [];
    if (detailedOrganizations.length > 0) {
      return detailedOrganizations.filter(
        (organization) =>
          organization.id !== partnerScopeId &&
          organization.parentOrganizationId === partnerScopeId,
      );
    }
    if (superAdminPartnerScope) {
      return selectedPartnerChildOrganizations;
    }
    if (isPartnerAdmin) {
      return partnerChildOrganizations.filter(
        (organization) =>
          organization.id !== partnerScopeId &&
          organization.parentOrganizationId === partnerScopeId,
      );
    }
    return [];
  }, [
    isPartnerAdmin,
    partnerChildOrganizations,
    partnerDetailsQuery.data?.organizations,
    partnerScopeId,
    selectedPartnerChildOrganizations,
    superAdminPartnerScope,
  ]);

  useEffect(() => {
    if (!isSuperAdmin || !requestedOrganizationId || allOrganizations.length === 0) return;
    const requestedOrganization = allOrganizations.find(
      (organization) => organization.id === requestedOrganizationId,
    );
    if (!requestedOrganization) return;
    const timer = window.setTimeout(() => {
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
    }, 0);
    return () => window.clearTimeout(timer);
  }, [allOrganizations, isSuperAdmin, requestedOrganizationId]);

  const selectedOrganization = useMemo(
    () =>
      organizationsQuery.data?.find((org) => org.id === selectedOrgId) ?? null,
    [organizationsQuery.data, selectedOrgId],
  );
  const paymentRows: PartnerLicensePaymentRecord[] = orgDetailsQuery.data?.payments ?? [];

  const invalidateCommercialQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['organizations'] });
    queryClient.invalidateQueries({ queryKey: ['license-details'] });
    queryClient.invalidateQueries({ queryKey: ['partner-license-details'] });
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

  const updatePaymentMutation = useMutation({
    mutationFn: ({
      paymentId,
      payload,
    }: {
      paymentId: string;
      payload: Parameters<typeof licensingApi.updatePaymentTransaction>[1];
    }) => licensingApi.updatePaymentTransaction(paymentId, payload),
    onSuccess: () => {
      invalidateCommercialQueries();
      setPaymentEdit(null);
      toast.success('Billing history updated');
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

  const archiveKeyMutation = useMutation({
    mutationFn: licensingApi.archiveActivationKey,
    onSuccess: () => {
      invalidateCommercialQueries();
      queryClient.invalidateQueries({ queryKey: ['activation-keys'] });
      toast.success('Activation key archived');
      setArchiveKeyId(null);
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const updateKeyTermMutation = useMutation({
    mutationFn: ({
      keyId,
      payload,
    }: {
      keyId: string;
      payload: Parameters<typeof licensingApi.updateActivationKeyTerm>[1];
    }) => licensingApi.updateActivationKeyTerm(keyId, payload),
    onSuccess: () => {
      invalidateCommercialQueries();
      setTermEdit(null);
      toast.success('Activation key dates updated');
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

  const isLoading = organizationsQuery.isLoading;
  const globalMode = isSuperAdmin && selectedPartnerId === GLOBAL_LICENSE_VALUE;
  const PER_PAGE = 50;
  const [globalPage, setGlobalPage] = useState(1);
  const [orgKeysPage, setOrgKeysPage] = useState(1);
  const [devicesPage, setDevicesPage] = useState(1);

  useEffect(() => {
    setGlobalPage(1);
  }, [debouncedGlobalSearch]);

  useEffect(() => {
    setOrgKeysPage(1);
    setDevicesPage(1);
  }, [selectedOrgId, selectedPartnerId, keyView]);

  const globalKeysQuery = useQuery({
    queryKey: ['activation-keys', 'global', debouncedGlobalSearch, globalPage],
    queryFn: () =>
      licensingApi.listKeys({
        page: globalPage,
        perPage: PER_PAGE,
        search: debouncedGlobalSearch || undefined,
      }),
    enabled: globalMode,
  });

  const globalTotalKeysCountQuery = useQuery({
    queryKey: ['activation-keys', 'count-all', debouncedGlobalSearch],
    queryFn: () =>
      licensingApi.listKeys({
        page: 1,
        perPage: 1,
        search: debouncedGlobalSearch || undefined,
      }),
    enabled: globalMode,
  });

  const globalUsableKeysCountQuery = useQuery({
    queryKey: ['activation-keys', 'count-usable', debouncedGlobalSearch],
    queryFn: () =>
      licensingApi.listKeys({
        page: 1,
        perPage: 1,
        status: 'AVAILABLE,BOUND',
        search: debouncedGlobalSearch || undefined,
      }),
    enabled: globalMode,
  });

  const globalBoundKeysCountQuery = useQuery({
    queryKey: ['activation-keys', 'count-bound', debouncedGlobalSearch],
    queryFn: () =>
      licensingApi.listKeys({
        page: 1,
        perPage: 1,
        status: 'BOUND',
        search: debouncedGlobalSearch || undefined,
      }),
    enabled: globalMode,
  });

  const dashboardOverviewQuery = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: dashboardApi.overview,
    enabled: globalMode,
  });

  const globalActivationKeys = globalKeysQuery.data?.data ?? [];
  const filteredGlobalActivationKeys = globalActivationKeys;
  const globalTotalKeysCount =
    globalTotalKeysCountQuery.data?.meta?.total ??
    globalKeysQuery.data?.meta?.total ??
    globalActivationKeys.length;
  const globalUsableKeysCount =
    globalUsableKeysCountQuery.data?.meta?.total ??
    globalActivationKeys.filter(
      (key) => key.status === 'AVAILABLE' || key.status === 'BOUND',
    ).length;
  const globalBoundKeysCount =
    globalBoundKeysCountQuery.data?.meta?.total ??
    globalActivationKeys.filter((key) => key.status === 'BOUND').length;
  const globalExpiringSoonCount =
    dashboardOverviewQuery.data?.subscriptions?.expiringSoon ?? 0;

  const aggregateDetails = aggregatePartnerMode ? partnerDetailsQuery.data : null;
  const aggregateSummary = aggregateDetails?.summary ?? null;
  const aggregateActivationKeys = aggregateDetails?.hardwareActivationKeys ?? [];
  const aggregatePaymentRows = aggregateDetails?.payments ?? [];
  const displayedPaymentRows = aggregatePartnerMode ? aggregatePaymentRows : paymentRows;
  const billingScopeLabel = aggregatePartnerMode
    ? `${partnerScopeName} and child organizations`
    : selectedOrganization?.name ?? 'this workspace';
  const billingIsLoading = aggregatePartnerMode
    ? partnerDetailsQuery.isLoading
    : orgDetailsQuery.isLoading;
  const selectedChildUnderPartner =
    isSuperAdmin &&
    superAdminPartnerScope &&
    !!selectedOrganization?.parentOrganizationId &&
    selectedOrganization.parentOrganizationId === selectedPartnerId;
  const activationKeys = orgDetailsQuery.data?.hardwareActivationKeys ?? [];
  const liveActivationKeys = aggregatePartnerMode
    ? aggregateActivationKeys
    : activationKeys;
  const canViewArchived = isSuperAdmin && (!!selectedOrgId || !!partnerScopeId);
  const archivedKeysQuery = useQuery({
    queryKey: ['activation-keys', 'archived', selectedOrgId, partnerScopeId, orgKeysPage],
    queryFn: () =>
      licensingApi.listKeys({
        page: orgKeysPage,
        perPage: PER_PAGE,
        view: 'archived',
        ...(selectedOrgId
          ? { organizationId: selectedOrgId }
          : partnerScopeId
            ? { partnerOrganizationId: partnerScopeId }
            : {}),
      }),
    enabled: keyView === 'archived' && canViewArchived,
  });
  const archivedActivationKeys = archivedKeysQuery.data?.data ?? [];
  const rawDisplayedActivationKeys =
    keyView === 'archived' ? archivedActivationKeys : liveActivationKeys;
  const totalOrgKeysCount =
    keyView === 'archived'
      ? archivedKeysQuery.data?.meta?.total ?? rawDisplayedActivationKeys.length
      : rawDisplayedActivationKeys.length;
  const totalOrgKeysPages = Math.max(1, Math.ceil(totalOrgKeysCount / PER_PAGE));

  const displayedActivationKeys = useMemo(() => {
    if (keyView === 'archived') {
      return archivedActivationKeys;
    }
    const start = (orgKeysPage - 1) * PER_PAGE;
    return liveActivationKeys.slice(start, start + PER_PAGE);
  }, [keyView, archivedActivationKeys, liveActivationKeys, orgKeysPage]);

  useEffect(() => {
    setKeyView('live');
  }, [selectedOrgId, selectedPartnerId]);
  const orgLicenseSummary = orgDetailsQuery.data?.summary ?? null;
  const licenseSummary = aggregatePartnerMode ? aggregateSummary : orgLicenseSummary;
  const partnerPool =
    partnerScopeId &&
    (aggregatePartnerMode ||
      isPartnerAdmin ||
      selectedChildUnderPartner ||
      selectedOrganization?.id === partnerScopeId)
      ? partnerDetailsQuery.data?.partnerPool ?? orgDetailsQuery.data?.partnerPool ?? null
      : null;
  const usableKeyCount = activationKeys.filter((key) =>
    key.status === 'AVAILABLE' || key.status === 'BOUND',
  ).length;
  const emailedUsableKeyCount = activationKeys.filter(
    (key) =>
      (key.status === 'AVAILABLE' || key.status === 'BOUND') &&
      Boolean(key.emailSentAt),
  ).length;
  const selectedSuperAdminPartnerOrg =
    isSuperAdmin &&
    superAdminPartnerScope &&
    selectedOrganization?.id === selectedPartnerId;
  const activationPoolSeatLimit = orgLicenseSummary?.seatLimit ?? 0;
  const activationPoolUsableKeyCount = usableKeyCount;
  const organizationRemainingActivationKeys = Math.max(
    activationPoolSeatLimit - activationPoolUsableKeyCount,
    0,
  );
  const remainingActivationKeys = organizationRemainingActivationKeys;
  const newEmailSlotsRemaining = Math.max(
    (orgLicenseSummary?.seatLimit ?? activationPoolSeatLimit) - emailedUsableKeyCount,
    0,
  );
  const canCreateActivationKey =
    !!selectedOrganization &&
    isSuperAdmin &&
    !selectedChildUnderPartner &&
    remainingActivationKeys > 0 &&
    !orgDetailsQuery.isLoading;
  const capacityText = activationPoolSeatLimit > 0
    ? `${activationPoolUsableKeyCount}/${activationPoolSeatLimit} usable keys`
    : 'No licence capacity';
  const partnerPoolKeys = partnerDetailsQuery.data?.hardwareActivationKeys ?? [];
  const availablePartnerPoolKeys = partnerScopeId
    ? partnerPoolKeys.filter(
        (key) =>
          key.organizationId === partnerScopeId &&
          key.status === 'AVAILABLE' &&
          Boolean(key.activationKey),
      )
    : [];
  const teacherCapacityLimit =
    licenseSummary?.seatLimit ?? aggregateSummary?.seatLimit ?? 0;
  const teacherUsage =
    licenseSummary?.teacherUsage ?? aggregateSummary?.seatUsage ?? 0;
  const teacherCapacityUsed = Math.max(
    teacherUsage,
    licenseSummary?.usableKeyCount ?? usableKeyCount,
  );
  const licenseProgress = Math.min(
    100,
    (teacherCapacityUsed / Math.max(teacherCapacityLimit, 1)) * 100,
  );
  const activationKeysColSpan = 8 + (aggregatePartnerMode ? 1 : 0) + (isSuperAdmin ? 1 : 0);
  const allDevices = rawDisplayedActivationKeys.flatMap((key) =>
    key.activations.map((activation) => ({ activation, key })),
  );
  const totalDevicesCount = allDevices.length;
  const totalDevicesPages = Math.max(1, Math.ceil(totalDevicesCount / PER_PAGE));
  const paginatedDevices = useMemo(() => {
    const start = (devicesPage - 1) * PER_PAGE;
    return allDevices.slice(start, start + PER_PAGE);
  }, [allDevices, devicesPage]);
  const licenseStartDate = new Date(licenseStartInput);
  const licenseEndDate = new Date(licenseEndInput);
  const licenseStartIso = Number.isNaN(licenseStartDate.getTime())
    ? null
    : licenseStartDate.toISOString();
  const licenseEndIso = Number.isNaN(licenseEndDate.getTime())
    ? null
    : licenseEndDate.toISOString();
  const isLicenseTermValid =
    Boolean(licenseStartIso && licenseEndIso) && licenseEndDate > licenseStartDate;
  const refreshLicenseTerm = () => {
    const now = new Date();
    const months = durationMonthsFor(licenseDuration);
    const nextEnd =
      months !== null
        ? addMonths(now, months)
        : isLicenseTermValid
          ? new Date(now.getTime() + (licenseEndDate.getTime() - licenseStartDate.getTime()))
          : addMonths(now, 12);
    setLicenseStartInput(dateTimeLocalValue(now));
    setLicenseEndInput(dateTimeLocalValue(nextEnd));
    toast.success('Licence term refreshed to current time');
  };

  const toggleReveal = (id: string) =>
    setRevealedKeyIds((current) => ({ ...current, [id]: !current[id] }));

  const copyValue = async (value: string, success: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(success);
  };

  const openTermEdit = (key: HardwareActivationKeyRecord) => {
    const startDate = new Date(key.startsAt);
    setTermEdit({
      id: key.id,
      label: key.label ?? 'Activation key',
      startsAt: Number.isNaN(startDate.getTime())
        ? dateTimeLocalValue(new Date())
        : dateTimeLocalValue(startDate),
      expiresAt: '',
    });
  };

  const submitTermEdit = () => {
    if (!termEdit) return;
    const startsAt = dateTimeInputToIso(termEdit.startsAt);
    const expiresAt = dateTimeInputToIso(termEdit.expiresAt);
    if (!startsAt || !expiresAt) {
      toast.error('Select both start and expiry date/time');
      return;
    }
    if (new Date(expiresAt).getTime() <= new Date(startsAt).getTime()) {
      toast.error('Expiry must be after start date');
      return;
    }
    updateKeyTermMutation.mutate({
      keyId: termEdit.id,
      payload: { startsAt, expiresAt },
    });
  };

  const openPaymentEdit = (payment: PartnerLicensePaymentRecord) => {
    setPaymentEdit({
      id: payment.id,
      amount: String(payment.amountMinor / 100),
      currency: payment.currency,
      status: PAYMENT_STATUS_OPTIONS.includes(payment.status as PaymentTransactionStatus)
        ? (payment.status as PaymentTransactionStatus)
        : 'MANUAL_APPROVED',
      referenceNote: payment.referenceNote ?? '',
      invoiceNumber: payment.invoiceNumber ?? '',
      periodStart: dateInputValue(payment.periodStart),
      periodEnd: dateInputValue(payment.periodEnd),
    });
  };

  const submitPaymentEdit = () => {
    if (!paymentEdit) return;
    const amount = Number(paymentEdit.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    const currencyCode = paymentEdit.currency.trim().toUpperCase();
    if (currencyCode.length !== 3) {
      toast.error('Currency must be a 3-letter code');
      return;
    }
    updatePaymentMutation.mutate({
      paymentId: paymentEdit.id,
      payload: {
        amountMinor: Math.round(amount * 100),
        currency: currencyCode,
        status: paymentEdit.status,
        referenceNote: paymentEdit.referenceNote.trim()
          ? paymentEdit.referenceNote.trim()
          : null,
        invoiceNumber: paymentEdit.invoiceNumber.trim()
          ? paymentEdit.invoiceNumber.trim()
          : null,
        periodStart: dateInputToIso(paymentEdit.periodStart),
        periodEnd: dateInputToIso(paymentEdit.periodEnd),
      },
    });
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
    if (!licenseStartIso || !licenseEndIso || !isLicenseTermValid) {
      toast.error('Choose a valid licence start and expiry');
      return;
    }
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
      sourcePartnerOrganizationId: null,
      startsAt: licenseStartIso,
      expiresAt: licenseEndIso,
      keys: validBulkRows.map((row) => ({
        label: row.label.trim(),
        maxDevices: 1,
      })),
    });
  };

  const submitAutoBulk = () => {
    if (!selectedOrganization) return;
    if (!licenseStartIso || !licenseEndIso || !isLicenseTermValid) {
      toast.error('Choose a valid licence start and expiry');
      return;
    }
    const count = Math.trunc(autoBulkCount);
    if (count < 1 || count > maxAutoBulkCount) {
      toast.error(`Enter a number from 1 to ${maxAutoBulkCount}`);
      return;
    }
    bulkMutation.mutate({
      organizationId: selectedOrganization.id,
      sourcePartnerOrganizationId: null,
      startsAt: licenseStartIso,
      expiresAt: licenseEndIso,
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
      await licensingApi.exportKeyList(
        globalSearchQuery.trim() ? { search: globalSearchQuery.trim() } : {},
        exportFormat,
      );
      toast.success(`Activation keys exported (${exportFormat.toUpperCase()})`);
    } catch (error) {
      toast.error(extractApiError(error));
    } finally {
      setIsExporting(false);
    }
  };

  const exportPartnerKeys = async () => {
    if (!partnerScopeId) return;
    setIsExporting(true);
    try {
      await licensingApi.exportKeyList({ partnerOrganizationId: partnerScopeId }, exportFormat);
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
        <div className="grid w-full min-w-0 gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] xl:w-auto xl:min-w-[620px] 2xl:min-w-[760px]">
          {isSuperAdmin && (
            <>
              <Select
                value={selectedPartnerId}
                onValueChange={handleSuperAdminPartnerChange}
              >
                <SelectTrigger>
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
                  <SelectTrigger>
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
              value={selectedOrgId ?? PARTNER_AGGREGATE_VALUE}
              onValueChange={(value) =>
                setSelectedOrgId(value === PARTNER_AGGREGATE_VALUE ? null : value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent searchPlaceholder="Search organization...">
                <SelectItem value={PARTNER_AGGREGATE_VALUE}>
                  {partnerScopeName} + all organizations
                </SelectItem>
                {partnerChildOrganizations.map((organization) => (
                  <SelectItem key={organization.id} value={organization.id}>
                    {organization.id === partnerScopeId ? 'Partner organization only' : organization.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant="outline"
            className="w-full justify-center whitespace-nowrap lg:w-auto"
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

      {globalMode && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <Card className="px-4 py-5 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              Workspaces
            </p>
            <p className="mt-2 text-3xl font-black text-ink-900">
              {organizationsQuery.data?.length ?? 0}
            </p>
            <p className="mt-1 text-sm text-ink-500">Managed launch workspaces</p>
          </Card>
          <Card className="px-4 py-5 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              Activation keys
            </p>
            <p className="mt-2 text-3xl font-black text-success">
              {globalTotalKeysCount}
            </p>
            <p className="mt-1 text-sm text-ink-500">Issued across all organizations</p>
          </Card>
          <Card className="px-4 py-5 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              Licence seats
            </p>
            <p className="mt-2 text-3xl font-black text-ink-900">
              {globalUsableKeysCount}
              <span className="text-base font-semibold text-ink-500">
                {' '}usable
              </span>
            </p>
            <p className="mt-1 text-sm text-ink-500">Available or bound keys</p>
          </Card>
          <Card className="px-4 py-5 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              Bound devices
            </p>
            <p className="mt-2 text-3xl font-black text-ink-900">
              {globalBoundKeysCount}
            </p>
            <p className="mt-1 text-sm text-ink-500">Keys locked to a device</p>
          </Card>
          <Card className="px-4 py-5 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              Expiring soon
            </p>
            <p className="mt-2 text-3xl font-black text-ink-900">
              {globalExpiringSoonCount}
            </p>
            <p className="mt-1 text-sm text-ink-500">Usable keys expiring in 30 days</p>
          </Card>
          {/* AI Credits moved to the dedicated AI module — hidden here.
          <Card className="relative px-4 py-5 sm:px-6">
            <Badge variant="info" className="absolute right-4 top-4">Coming Soon</Badge>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              AI Credits
            </p>
            <p className="mt-2 text-3xl font-black text-ink-300">--</p>
            <p className="mt-1 text-sm text-ink-500">Available in a future release</p>
          </Card>
          */}
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
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <Input
                  type="text"
                  placeholder="Search activation keys..."
                  value={globalSearchQuery}
                  onChange={(e) => setGlobalSearchQuery(e.target.value)}
                  className="h-10 pl-9 pr-16 text-sm"
                />
                <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
                  {globalSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setGlobalSearchQuery('')}
                      className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                      title="Clear search"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handlePasteSearch}
                    className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                    title="Paste activation key"
                  >
                    <ClipboardPaste className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
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
                disabled={isExporting || filteredGlobalActivationKeys.length === 0}
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
            <>
            <Table className="min-w-[1100px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Source / pool</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Starts</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Created by</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Bound device</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGlobalActivationKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="max-w-[220px]">
                      <p className="truncate font-semibold text-ink-900">{key.label ?? '-'}</p>
                      {key.activationKey && (
                        <p className="font-mono text-xs text-ink-500 truncate" title={key.activationKey}>
                          {key.activationKey}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="min-w-0">
                      <p className="truncate text-sm text-ink-900">{key.organization?.name ?? '-'}</p>
                      <p className="text-xs text-ink-500">{key.organization?.kind ?? ''}</p>
                    </TableCell>
                    <TableCell className="min-w-0">
                      <p className="truncate text-sm text-ink-900">{keySourceLabel(key)}</p>
                      <p className="text-xs text-ink-500">
                        {keySourceDetail(key)}
                      </p>
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
                    <TableCell className="min-w-0">
                      <p className="truncate text-sm text-ink-900">
                        {key.createdBy?.name ?? key.createdBy?.email ?? '-'}
                      </p>
                      <p className="text-xs text-ink-500">{key.createdBy?.role ?? ''}</p>
                    </TableCell>
                    <TableCell className="min-w-0">
                      <p className="truncate text-sm text-ink-900">
                        {key.emailRecipientEmail ?? (key.emailSentAt ? 'Sent' : 'Not sent')}
                      </p>
                      <p className="text-xs text-ink-500">
                        {key.emailSentAt ? formatDate(key.emailSentAt) : ''}
                        {key.emailSentBy
                          ? ` by ${key.emailSentBy.name ?? key.emailSentBy.email}`
                          : ''}
                      </p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(key.startsAt)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {key.expiresAt ? formatDate(key.expiresAt) : '-'}
                    </TableCell>
                    <TableCell className="min-w-0">
                      <p className="truncate text-sm text-ink-900">
                        {key.boundActivation?.deviceModel ?? '-'}
                      </p>
                      <p className="text-xs text-ink-500">
                        {key.boundActivation?.devicePlatform ?? ''}
                      </p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(key.createdAt)}</TableCell>
                  </TableRow>
                ))}
                {filteredGlobalActivationKeys.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="py-10 text-center text-sm text-ink-500">
                      {globalSearchQuery
                        ? `No activation keys match "${globalSearchQuery}".`
                        : 'No activation keys issued yet.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {globalTotalKeysCount > 0 && (
              <div className="flex flex-col items-center justify-between gap-3 border-t border-line px-4 py-3 sm:flex-row sm:px-6">
                <p className="text-xs font-medium text-ink-500">
                  Showing <span className="font-semibold text-ink-900">{(globalPage - 1) * PER_PAGE + 1}</span>–
                  <span className="font-semibold text-ink-900">
                    {Math.min(globalPage * PER_PAGE, globalTotalKeysCount)}
                  </span>{' '}
                  of <span className="font-semibold text-ink-900">{globalTotalKeysCount}</span> keys
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={globalPage <= 1}
                    onClick={() => setGlobalPage((p) => Math.max(1, p - 1))}
                    className="h-8 gap-1 px-2.5 text-xs font-medium"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Prev
                  </Button>
                  <span className="text-xs font-semibold text-ink-700">
                    Page {globalPage} of {Math.max(1, Math.ceil(globalTotalKeysCount / PER_PAGE))}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={globalPage >= Math.ceil(globalTotalKeysCount / PER_PAGE)}
                    onClick={() => setGlobalPage((p) => p + 1)}
                    className="h-8 gap-1 px-2.5 text-xs font-medium"
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
            </>
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
                  {partnerScopeName} + child organizations
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
                        Usable keys
                      </p>
                      <p className="text-sm font-semibold text-ink-900">
                        {aggregateSummary?.usableKeyCount ?? 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-ink-500">
                        Uncreated slots
                      </p>
                      <p className="text-sm font-semibold text-ink-900">
                        {aggregateSummary?.uncreatedKeySlots ?? 0}
                      </p>
                    </div>
                  </div>
                  <p className="pt-2 text-xs text-ink-500">
                    Partner pool available to assign:{' '}
                    {availablePartnerPoolKeys.length}
                  </p>
                </>
              )}
            </div>
          </Card>

          <Card>
            <div className="border-b border-line px-4 py-4 sm:px-6">
              <h3 className="flex items-center gap-2 text-base font-semibold text-ink-900">
                <Sofa className="h-4 w-4 text-brand-primary" />
                Teacher Licences
              </h3>
              <p className="text-xs text-ink-500">
                Used capacity is the higher of active teachers or usable activation keys.
              </p>
            </div>
            <div className="space-y-4 px-4 py-5 sm:px-6">
              {teacherCapacityLimit > 0 && (
                <SeatsBanner
                  seatLimit={teacherCapacityLimit}
                  seatUsage={teacherCapacityUsed}
                />
              )}
              <p className="text-2xl font-bold text-ink-900">
                {teacherCapacityUsed}
                <span className="text-sm font-medium text-ink-500">
                  {' '}/ {teacherCapacityLimit}
                </span>
              </p>
              <Progress value={licenseProgress} />
              <p className="text-xs text-ink-500">
                Active teachers: {teacherUsage}. Usable keys: {licenseSummary?.usableKeyCount ?? 0}.
              </p>
            </div>
          </Card>

          <Card className="lg:col-span-2">
            <div className="border-b border-line px-4 py-4 sm:px-6">
              <h3 className="flex items-center gap-2 text-base font-semibold text-ink-900">
                <Cpu className="h-4 w-4 text-brand-primary" />
                Activation Key Pool
              </h3>
              <p className="text-xs text-ink-500">
                Pool keys stay on the partner until they are assigned and emailed to a child organization.
              </p>
            </div>
            <div className="grid gap-3 px-4 py-5 sm:grid-cols-2 xl:grid-cols-4 sm:px-6">
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-500">Total keys</p>
                <p className="text-sm font-semibold text-ink-900">
                  {licenseSummary?.totalKeyCount ?? 0}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-500">Available pool</p>
                <p className="text-sm font-semibold text-ink-900">
                  {availablePartnerPoolKeys.length}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-500">Emailed / never emailed</p>
                <p className="text-sm font-semibold text-ink-900">
                  {licenseSummary?.sentKeyCount ?? 0} / {licenseSummary?.unsentKeyCount ?? 0}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-500">Bound / available</p>
                <p className="text-sm font-semibold text-ink-900">
                  {licenseSummary?.boundKeyCount ?? 0} / {licenseSummary?.availableKeyCount ?? 0}
                </p>
              </div>
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
                  Licence Capacity
                </h3>
                <p className="text-xs text-ink-500">
                  {selectedOrganization?.name ?? '-'} direct activation-key capacity
                </p>
              </div>
              <Badge variant={teacherCapacityLimit > 0 ? 'success' : 'warning'}>
                {teacherCapacityLimit > 0 ? 'Ready' : 'No capacity'}
              </Badge>
            </div>
            <div className="space-y-3 px-4 py-5 sm:px-6">
              <p className="text-xs uppercase tracking-wide text-ink-500">Eligible licence users</p>
              <p className="text-sm text-ink-700">
                Teachers and active admin users. Students and parents do not consume activation keys.
              </p>
              <div className="grid gap-3 pt-2 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-ink-500">Licence term</p>
                  <p className="text-sm font-semibold text-ink-900">
                    {licenseSummary?.startsAt || licenseSummary?.expiresAt
                      ? `${licenseSummary.startsAt ? formatDate(licenseSummary.startsAt) : '-'} - ${
                          licenseSummary.expiresAt ? formatDate(licenseSummary.expiresAt) : 'No end date'
                        }`
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-ink-500">Licence capacity</p>
                  <p className="text-sm font-semibold text-ink-900">
                    {teacherCapacityLimit}
                  </p>
                </div>
              </div>
              <div className="grid gap-3 pt-1 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-ink-500">Activation keys</p>
                  <p className="text-sm font-semibold text-ink-900">
                    {licenseSummary
                      ? `${licenseSummary.usableKeyCount}/${licenseSummary.seatLimit} usable keys`
                      : capacityText}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-ink-500">Remaining capacity</p>
                  <p className="text-sm font-semibold text-ink-900">
                    {Math.max((licenseSummary?.seatLimit ?? teacherCapacityLimit) - teacherCapacityUsed, 0)}
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
                Teacher Licences
              </h3>
              <p className="text-xs text-ink-500">
                Used capacity is active teachers or usable activation keys, whichever is higher.
              </p>
            </div>
            <div className="space-y-4 px-4 py-5 sm:px-6">
              {teacherCapacityLimit > 0 && (
                <SeatsBanner
                  seatLimit={teacherCapacityLimit}
                  seatUsage={teacherCapacityUsed}
                />
              )}
              <p className="text-2xl font-bold text-ink-900">
                {teacherCapacityUsed}
                <span className="text-sm font-medium text-ink-500">
                  {' '}/ {teacherCapacityLimit}
                </span>
              </p>
              <Progress value={licenseProgress} />
              <p className="text-xs text-ink-500">
                Active teachers: {teacherUsage}. Usable keys: {licenseSummary?.usableKeyCount ?? 0}.
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
                    step="0.01"
                    value={amountMajor}
                    onChange={(event) => setAmountMajor(Number(event.target.value))}
                    placeholder="Amount (e.g. 10000)"
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
                  disabled={!selectedOrganization || offlineMutation.isPending}
                  onClick={() => {
                    if (!selectedOrganization) return;
                    if (!Number.isFinite(amountMajor) || amountMajor <= 0) {
                      toast.error('Enter a valid amount');
                      return;
                    }
                    offlineMutation.mutate({
                      organizationId: selectedOrganization.id,
                      amountMinor: Math.round(amountMajor * 100),
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
                  {selectedChildUnderPartner
                    ? 'Child organizations receive keys from the partner pool. Select the partner scope to assign and email pool keys.'
                    : 'Each key activates one board/device. Any active user in that organization can use the app on that activated device.'}
                </p>
                <p className="mt-1 text-xs font-medium text-ink-600">
                  {capacityText} · {remainingActivationKeys} remaining
                </p>
              </div>

              {selectedChildUnderPartner ? (
                <div className="rounded-lg border border-line bg-surface-variant px-3 py-3 text-sm text-ink-600">
                  Pool keys are created on {partnerScopeName} and then assigned to this organization.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid min-w-0 gap-3 lg:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_150px_minmax(0,1fr)]">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                          Starts
                        </label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-ink-500 hover:text-brand-primary"
                          title="Refresh start and expiry to current IST time"
                          aria-label="Refresh licence start and expiry to current IST time"
                          onClick={refreshLicenseTerm}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <Input
                        type="datetime-local"
                        value={licenseStartInput}
                        onChange={(event) => setLicenseStartInput(event.target.value)}
                      />
                    </div>
                    <div className="min-w-0 space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                        Duration
                      </label>
                      <Select
                        value={licenseDuration}
                        onValueChange={(value) =>
                          setLicenseDuration(value as DurationOptionValue)
                        }
                      >
                        <SelectTrigger className="min-w-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DURATION_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="min-w-0 space-y-1.5 lg:col-span-2 2xl:col-span-1">
                      <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                        Expires
                      </label>
                      <Input
                        type="datetime-local"
                        value={licenseEndInput}
                        onChange={(event) => {
                          setLicenseDuration('custom');
                          setLicenseEndInput(event.target.value);
                        }}
                        aria-invalid={!isLicenseTermValid}
                      />
                      {!isLicenseTermValid && (
                        <p className="text-xs font-medium text-danger">
                          Expiry must be after start.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_140px]">
                    <div className="min-w-0 space-y-1.5">
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
                    <div className="min-w-0 space-y-1.5">
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
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                    <Button
                      variant="primary"
                      className="w-full sm:w-auto"
                      disabled={
                        !canCreateActivationKey ||
                        keyLabel.trim().length === 0 ||
                        !isLicenseTermValid ||
                        hardwareMutation.isPending
                      }
                      onClick={() => {
                        if (!selectedOrganization) return;
                        if (keyLabel.trim().length === 0) {
                          setKeyLabelTouched(true);
                          return;
                        }
                        if (!licenseStartIso || !licenseEndIso || !isLicenseTermValid) {
                          toast.error('Choose a valid licence start and expiry');
                          return;
                        }
                        hardwareMutation.mutate({
                          organizationId: selectedOrganization.id,
                          sourcePartnerOrganizationId: null,
                          label: keyLabel.trim(),
                          maxDevices: 1,
                          startsAt: licenseStartIso,
                          expiresAt: licenseEndIso,
                        });
                      }}
                    >
                      {hardwareMutation.isPending && <Spinner className="h-4 w-4" />}
                      Create activation key
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto"
                      disabled={!canCreateActivationKey || !isLicenseTermValid}
                      onClick={openBulkDialog}
                    >
                      <Layers className="h-4 w-4" />
                      Bulk create keys
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex justify-stretch sm:justify-end">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={!selectedOrganization || activationKeys.length === 0}
                  onClick={() => setEmailKeysOpen(true)}
                >
                  <Mail className="h-4 w-4" />
                  Choose keys to email org admin
                </Button>
              </div>

              {/* AI Credits moved to the dedicated AI module — hidden here.
              <div className="pointer-events-none absolute inset-x-6 bottom-3 rounded-lg border border-line bg-surface-variant px-3 py-2 text-xs text-ink-500">
                <span className="mr-2 inline-flex items-center rounded bg-warning/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
                  Coming Soon
                </span>
                AI Credits will return in a future release.
              </div>
              */}
            </Card>
          </div>
        </div>
      )}

      {partnerScopeId &&
        (aggregatePartnerMode ||
          selectedSuperAdminPartnerOrg ||
          selectedChildUnderPartner ||
          isPartnerAdmin) && (
        <Card className="space-y-5 px-4 py-5 sm:px-6">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold text-ink-900">
              <Mail className="h-4 w-4 text-brand-primary" />
              Assign/email pool keys
            </h3>
            <p className="text-xs text-ink-500">
              Select available keys from the partner pool and email them to a child organization admin.
            </p>
            <p className="mt-1 text-xs font-medium text-ink-600">
              {partnerPool
                ? `${partnerPool.organizationName} pool: ${availablePartnerPoolKeys.length} available to assign`
                : 'No active partner pool'}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-500">Pool capacity</p>
              <p className="text-sm font-semibold text-ink-900">
                {partnerPool?.usableKeyCount ?? 0}/{partnerPool?.seatLimit ?? 0}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-500">Available to assign</p>
              <p className="text-sm font-semibold text-ink-900">
                {availablePartnerPoolKeys.length}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-500">Child organizations</p>
              <p className="text-sm font-semibold text-ink-900">
                {partnerAssignableOrganizations.length}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-500">Emailed keys</p>
              <p className="text-sm font-semibold text-ink-900">
                {partnerDetailsQuery.data?.summary.sentKeyCount ?? 0}
              </p>
            </div>
          </div>

          <div className="flex justify-stretch sm:justify-end">
            <Button
              variant="primary"
              className="w-full sm:w-auto"
              disabled={
                partnerDetailsQuery.isLoading ||
                partnerAssignableOrganizations.length === 0 ||
                availablePartnerPoolKeys.length === 0
              }
              onClick={() => setAssignKeysOpen(true)}
            >
              <Mail className="h-4 w-4" />
              Assign/email pool keys
            </Button>
          </div>
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
                {canViewArchived && (
                  <div className="inline-flex rounded-md border border-line p-0.5">
                    <Button
                      size="sm"
                      variant={keyView === 'live' ? 'primary' : 'ghost'}
                      onClick={() => setKeyView('live')}
                    >
                      Live
                    </Button>
                    <Button
                      size="sm"
                      variant={keyView === 'archived' ? 'primary' : 'ghost'}
                      onClick={() => setKeyView('archived')}
                    >
                      Archived
                    </Button>
                  </div>
                )}
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
                {isSuperAdmin && !aggregatePartnerMode && (
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
            <Table className="min-w-[1320px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  {aggregatePartnerMode && <TableHead>Organization</TableHead>}
                  <TableHead>Key</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Source / pool</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Bound device</TableHead>
                  <TableHead>Starts</TableHead>
                  <TableHead>Expires</TableHead>
                  {isSuperAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedActivationKeys.map((key) => {
                  const revealed = revealedKeyIds[key.id];
                  const plain = key.activationKey ?? '';
                  const displayKey = formatActivationKeyForDisplay(plain);
                  const canRepairLegacyTerm =
                    !key.expiresAt &&
                    key.status !== 'DISABLED' &&
                    key.status !== 'EXPIRED';
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
                      {aggregatePartnerMode && (
                        <TableCell className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink-900">
                            {key.organization?.name ?? '-'}
                          </p>
                          <p className="text-xs text-ink-500">
                            {key.organization?.kind ?? ''}
                          </p>
                        </TableCell>
                      )}
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-2 whitespace-nowrap">
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
                      <TableCell className="min-w-0">
                        <p className="truncate text-sm text-ink-700">
                          {keySourceLabel(key)}
                        </p>
                        <p className="text-xs text-ink-500">
                          {keySourceDetail(key)}
                        </p>
                      </TableCell>
                      <TableCell className="min-w-0">
                        <p className="truncate text-sm text-ink-700">
                          {key.emailRecipientEmail ?? (key.emailSentAt ? 'Sent' : 'Not sent')}
                        </p>
                        <p className="text-xs text-ink-500">
                          {key.emailSentAt ? formatDate(key.emailSentAt) : ''}
                        </p>
                        <p className="text-xs text-ink-500">
                          {key.emailSentBy
                            ? `By ${key.emailSentBy.name ?? key.emailSentBy.email}`
                            : ''}
                        </p>
                      </TableCell>
                      <TableCell className="min-w-0">
                        <p className="truncate text-sm text-ink-700">
                          {key.boundActivation?.deviceModel ?? '—'}
                        </p>
                        <p className="text-xs text-ink-500">
                          {key.boundActivation?.devicePlatform ?? ''}
                        </p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <p className="text-sm text-ink-700">
                          {formatDate(key.startsAt)}
                        </p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <p className="text-sm text-ink-700">
                          {key.expiresAt ? formatDate(key.expiresAt) : '-'}
                        </p>
                      </TableCell>
                      {isSuperAdmin && (
                        <TableCell className="text-right whitespace-nowrap">
                          {keyView === 'archived' ? (
                            <span className="text-xs text-ink-400">Archived</span>
                          ) : (
                            <div className="flex justify-end gap-1 whitespace-nowrap">
                              {canRepairLegacyTerm && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openTermEdit(key)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Edit dates
                                </Button>
                              )}
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
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-danger"
                                onClick={() => setArchiveKeyId(key.id)}
                              >
                                Archive
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
                {displayedActivationKeys.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={activationKeysColSpan}
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
                          {aggregatePartnerMode || isPartnerAdmin
                            ? 'No pool or assigned keys are visible for this scope yet.'
                            : 'Create activation keys to lock the app to your devices.'}
                        </p>
                        {canCreateActivationKey && (
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
            {totalOrgKeysCount > 0 && (
              <div className="flex flex-col items-center justify-between gap-3 border-t border-line px-4 py-3 sm:flex-row sm:px-6">
                <p className="text-xs font-medium text-ink-500">
                  Showing <span className="font-semibold text-ink-900">{(orgKeysPage - 1) * PER_PAGE + 1}</span>–
                  <span className="font-semibold text-ink-900">
                    {Math.min(orgKeysPage * PER_PAGE, totalOrgKeysCount)}
                  </span>{' '}
                  of <span className="font-semibold text-ink-900">{totalOrgKeysCount}</span> keys
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={orgKeysPage <= 1}
                    onClick={() => setOrgKeysPage((p) => Math.max(1, p - 1))}
                    className="h-8 gap-1 px-2.5 text-xs font-medium"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Prev
                  </Button>
                  <span className="text-xs font-semibold text-ink-700">
                    Page {orgKeysPage} of {totalOrgKeysPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={orgKeysPage >= totalOrgKeysPages}
                    onClick={() => setOrgKeysPage((p) => p + 1)}
                    className="h-8 gap-1 px-2.5 text-xs font-medium"
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
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
                {paginatedDevices.map(({ activation, key }) => (
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
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-ink-500">
                      No devices bound yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {totalDevicesCount > 0 && (
              <div className="flex flex-col items-center justify-between gap-3 border-t border-line px-4 py-3 sm:flex-row sm:px-6">
                <p className="text-xs font-medium text-ink-500">
                  Showing <span className="font-semibold text-ink-900">{(devicesPage - 1) * PER_PAGE + 1}</span>–
                  <span className="font-semibold text-ink-900">
                    {Math.min(devicesPage * PER_PAGE, totalDevicesCount)}
                  </span>{' '}
                  of <span className="font-semibold text-ink-900">{totalDevicesCount}</span> devices
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={devicesPage <= 1}
                    onClick={() => setDevicesPage((p) => Math.max(1, p - 1))}
                    className="h-8 gap-1 px-2.5 text-xs font-medium"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Prev
                  </Button>
                  <span className="text-xs font-semibold text-ink-700">
                    Page {devicesPage} of {totalDevicesPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={devicesPage >= totalDevicesPages}
                    onClick={() => setDevicesPage((p) => p + 1)}
                    className="h-8 gap-1 px-2.5 text-xs font-medium"
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      {!globalMode && (selectedOrganization || aggregatePartnerMode) && (
        <Card>
          <div className="flex flex-col gap-3 border-b border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h3 className="text-base font-semibold text-ink-900">Billing History</h3>
              <p className="text-xs text-ink-500">
                Manual payment history for {billingScopeLabel}
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
                {isSuperAdmin && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedPaymentRows.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="whitespace-nowrap">
                    <p className="font-mono text-sm font-medium text-ink-900">
                      {payment.invoiceNumber ?? `#PAY-${payment.id.slice(0, 6).toUpperCase()}`}
                    </p>
                  </TableCell>
                  {aggregatePartnerMode && (
                    <TableCell className="min-w-0">
                      <p className="max-w-[180px] truncate text-sm text-ink-700">
                        {paymentOrganizationName(payment)}
                      </p>
                    </TableCell>
                  )}
                  <TableCell className="whitespace-nowrap">
                    <p className="text-sm text-ink-700">{formatDate(payment.createdAt)}</p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <p className="text-sm font-medium text-ink-900">
                      {formatMoney(payment.amountMinor, payment.currency)}
                    </p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
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
                  <TableCell className="min-w-0">
                    <p className="max-w-xs truncate text-sm text-ink-700">
                      {payment.referenceNote ?? '—'}
                    </p>
                  </TableCell>
                  <TableCell className="min-w-0">
                    <p className="max-w-[200px] truncate text-sm text-ink-700">
                      {payment.recordedBy?.name ?? payment.recordedBy?.email ?? '—'}
                    </p>
                  </TableCell>
                  {isSuperAdmin && (
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openPaymentEdit(payment)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {displayedPaymentRows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6 + (aggregatePartnerMode ? 1 : 0) + (isSuperAdmin ? 1 : 0)}
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

      <Dialog open={Boolean(paymentEdit)} onOpenChange={(open) => !open && setPaymentEdit(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit billing history</DialogTitle>
            <DialogDescription>
              Update the manual payment details shown in the licensing history.
            </DialogDescription>
          </DialogHeader>
          {paymentEdit && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Amount
                </label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={paymentEdit.amount}
                  onChange={(event) =>
                    setPaymentEdit((current) =>
                      current ? { ...current, amount: event.target.value } : current,
                    )
                  }
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Currency
                </label>
                <Input
                  maxLength={3}
                  value={paymentEdit.currency}
                  onChange={(event) =>
                    setPaymentEdit((current) =>
                      current ? { ...current, currency: event.target.value.toUpperCase() } : current,
                    )
                  }
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Status
                </label>
                <Select
                  value={paymentEdit.status}
                  onValueChange={(value) =>
                    setPaymentEdit((current) =>
                      current
                        ? { ...current, status: value as PaymentTransactionStatus }
                        : current,
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Invoice number
                </label>
                <Input
                  value={paymentEdit.invoiceNumber}
                  onChange={(event) =>
                    setPaymentEdit((current) =>
                      current ? { ...current, invoiceNumber: event.target.value } : current,
                    )
                  }
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Period start
                </label>
                <Input
                  type="date"
                  value={paymentEdit.periodStart}
                  onChange={(event) =>
                    setPaymentEdit((current) =>
                      current ? { ...current, periodStart: event.target.value } : current,
                    )
                  }
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Period end
                </label>
                <Input
                  type="date"
                  value={paymentEdit.periodEnd}
                  onChange={(event) =>
                    setPaymentEdit((current) =>
                      current ? { ...current, periodEnd: event.target.value } : current,
                    )
                  }
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Reference or invoice note
                </label>
                <Input
                  value={paymentEdit.referenceNote}
                  onChange={(event) =>
                    setPaymentEdit((current) =>
                      current ? { ...current, referenceNote: event.target.value } : current,
                    )
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPaymentEdit(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={updatePaymentMutation.isPending}
              onClick={submitPaymentEdit}
            >
              {updatePaymentMutation.isPending && <Spinner className="h-4 w-4" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {partnerScopeId && (
        <AssignActivationKeysDialog
          open={assignKeysOpen}
          sourcePartnerOrganizationId={partnerScopeId}
          organizations={partnerAssignableOrganizations}
          keys={partnerPoolKeys}
          onOpenChange={setAssignKeysOpen}
          onSent={invalidateCommercialQueries}
        />
      )}

      <Dialog open={Boolean(termEdit)} onOpenChange={(open) => !open && setTermEdit(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Repair legacy key dates</DialogTitle>
            <DialogDescription>
              Set the V2 start and expiry date for {termEdit?.label ?? 'this activation key'}.
            </DialogDescription>
          </DialogHeader>
          {termEdit && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Starts
                </label>
                <Input
                  type="datetime-local"
                  value={termEdit.startsAt}
                  onChange={(event) =>
                    setTermEdit((current) =>
                      current ? { ...current, startsAt: event.target.value } : current,
                    )
                  }
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Expires
                </label>
                <Input
                  type="datetime-local"
                  value={termEdit.expiresAt}
                  onChange={(event) =>
                    setTermEdit((current) =>
                      current ? { ...current, expiresAt: event.target.value } : current,
                    )
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTermEdit(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={updateKeyTermMutation.isPending}
              onClick={submitTermEdit}
            >
              {updateKeyTermMutation.isPending && <Spinner className="h-4 w-4" />}
              Save dates
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

      <ConfirmationDialog
        open={!!archiveKeyId}
        onOpenChange={(open) => !open && setArchiveKeyId(null)}
        title="Archive activation key?"
        description="This permanently archives the key and frees its seat back into the pool so a new key can be created and emailed. This cannot be undone."
        confirmLabel="Archive"
        tone="danger"
        loading={archiveKeyMutation.isPending}
        onConfirm={() => {
          if (archiveKeyId) archiveKeyMutation.mutate(archiveKeyId);
        }}
      />
    </div>
  );
}
