import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Ban,
  CheckCircle2,
  Archive,
  ArchiveRestore,
  Building2,
  Clock3,
  CreditCard,
  Eye,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { subscriptionsApi } from '@/services/subscriptions.api';
import { organizationsApi } from '@/services/organizations.api';
import { usersApi } from '@/services/users.api';
import type { AdminExportFormat, AdminListQuery } from '@/services/admin-api';
import { extractApiError } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { useAuthStore } from '@/lib/auth-store';
import {
  ALL_PARTNERS_VALUE,
  organizationBelongsToPartner,
  organizationsForPartner,
  partnerOrganizations,
} from '@/lib/admin-hierarchy';
import {
  SUBSCRIPTION_STATUS_LABEL,
  type SubscriptionRecord,
  type SubscriptionStatus,
} from '@/types/api';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Progress } from '@/components/ui/progress';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  ActiveFilterChips,
  ExportButtons,
  PaginationFooter,
  StatCard,
} from '@/features/admin/admin-list-ui';
import {
  cleanFilterValue,
  clearSearchParams,
  numberParam,
  setSearchParam,
  type FilterChip,
} from '@/features/admin/admin-list-utils';

const PER_PAGE = 20;

function statusVariant(s: SubscriptionRecord['status']) {
  switch (s) {
    case 'ACTIVE':
      return 'success' as const;
    case 'TRIAL':
      return 'info' as const;
    case 'EXPIRED':
      return 'warning' as const;
    case 'CANCELED':
      return 'danger' as const;
    case 'PENDING_APPROVAL':
      return 'warning' as const;
  }
}

function subscriptionScopeLabel(subscription: SubscriptionRecord) {
  if (subscription.organization?.kind === 'PARTNER') return 'Partner';
  if (subscription.organization?.parentOrganizationId) return 'Child org';
  return subscription.organizationId ? 'Organization' : 'User';
}

export function SubscriptionsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user: actor } = useAuthStore();
  const isSuperAdmin = actor?.role === 'SUPER_ADMIN';
  const [exporting, setExporting] = useState<AdminExportFormat | null>(null);
  const [statusAction, setStatusAction] = useState<{
    subscription: SubscriptionRecord;
    status: SubscriptionStatus;
  } | null>(null);
  const [approveTarget, setApproveTarget] = useState<SubscriptionRecord | null>(null);
  const [rejectTarget, setRejectTarget] = useState<SubscriptionRecord | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<SubscriptionRecord | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<SubscriptionRecord | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const page = numberParam(params.get('page'), 1);
  const search = params.get('search') ?? '';
  const status = params.get('status') ?? 'ALL';
  const planName = params.get('planName') ?? '';
  const partnerOrganizationId = params.get('partnerOrganizationId') ?? ALL_PARTNERS_VALUE;
  const organizationId = params.get('organizationId') ?? 'ALL';
  const userId = params.get('userId') ?? 'ALL';
  const expiringFrom = params.get('expiringFrom') ?? '';
  const expiringTo = params.get('expiringTo') ?? '';
  const seatUsageMin = params.get('seatUsageMin') ?? '';
  const seatUsageMax = params.get('seatUsageMax') ?? '';
  const startFrom = params.get('startFrom') ?? '';
  const startTo = params.get('startTo') ?? '';
  const endFrom = params.get('endFrom') ?? '';
  const endTo = params.get('endTo') ?? '';

  const query = useMemo<AdminListQuery>(
    () => ({
      page,
      perPage: PER_PAGE,
      search,
      status: cleanFilterValue(status),
      planName,
      partnerOrganizationId: cleanFilterValue(partnerOrganizationId),
      organizationId: cleanFilterValue(organizationId),
      userId: cleanFilterValue(userId),
      expiringFrom,
      expiringTo,
      seatUsageMin,
      seatUsageMax,
      startFrom,
      startTo,
      endFrom,
      endTo,
      sortBy: params.get('sortBy') ?? 'updatedAt',
      sortOrder: params.get('sortOrder') ?? 'desc',
    }),
    [
      endFrom,
      endTo,
      expiringFrom,
      expiringTo,
      organizationId,
      page,
      partnerOrganizationId,
      params,
      planName,
      search,
      seatUsageMax,
      seatUsageMin,
      startFrom,
      startTo,
      status,
      userId,
    ],
  );

  const subscriptionsQuery = useQuery({
    queryKey: ['subscriptions', query],
    queryFn: () => subscriptionsApi.list(query),
  });
  const orgsQuery = useQuery({
    queryKey: ['organizations', 'all'],
    queryFn: organizationsApi.all,
  });
  const usersQuery = useQuery({
    queryKey: ['users', 'all'],
    queryFn: usersApi.all,
  });

  const subscriptions = subscriptionsQuery.data?.data ?? [];
  const meta = subscriptionsQuery.data?.meta;
  const allOrganizations = orgsQuery.data ?? [];
  const partners = partnerOrganizations(allOrganizations);
  const organizationOptions = organizationsForPartner(allOrganizations, partnerOrganizationId);
  const activeCount = subscriptions.filter((s) => s.status === 'ACTIVE').length;
  const trialCount = subscriptions.filter((s) => s.status === 'TRIAL').length;
  const partnerCapacityOrganizationId =
    organizationId === 'ALL' && userId === 'ALL'
      ? isSuperAdmin && partnerOrganizationId !== ALL_PARTNERS_VALUE
        ? partnerOrganizationId
        : actor?.role === 'PARTNER_ADMIN'
          ? actor.primaryOrganization?.id ?? null
          : null
      : null;
  const partnerCapacityRows = partnerCapacityOrganizationId
    ? subscriptions.filter(
        (subscription) =>
          subscription.organizationId === partnerCapacityOrganizationId ||
          subscription.organization?.kind === 'PARTNER',
      )
    : [];
  const topLevelCapacityRows =
    organizationId === 'ALL' && userId === 'ALL'
      ? subscriptions.filter(
          (subscription) => !subscription.organization?.parentOrganizationId,
        )
      : subscriptions;
  const seatCapacityRows =
    partnerCapacityOrganizationId && partnerCapacityRows.length > 0
      ? partnerCapacityRows
      : topLevelCapacityRows.length > 0
        ? topLevelCapacityRows
        : subscriptions;
  const totalSeats = seatCapacityRows.reduce((sum, s) => sum + s.seatLimit, 0);
  const usedSeats = subscriptions.reduce((sum, s) => sum + s.seatUsage, 0);

  const activeFilters = useMemo<FilterChip[]>(() => {
    const partner = partners.find((item) => item.id === partnerOrganizationId);
    const org = orgsQuery.data?.find((item) => item.id === organizationId);
    const selectedUser = usersQuery.data?.find((item) => item.id === userId);
    return [
      search && { key: 'search', label: 'Search', value: search },
      status !== 'ALL' && {
        key: 'status',
        label: 'Status',
        value:
          status === 'ARCHIVED'
            ? 'Archived'
            : SUBSCRIPTION_STATUS_LABEL[status as SubscriptionStatus] ?? status,
      },
      planName && { key: 'planName', label: 'Plan', value: planName },
      isSuperAdmin &&
        partnerOrganizationId !== ALL_PARTNERS_VALUE && {
          key: 'partnerOrganizationId',
          label: 'Partner',
          value: partner?.name ?? partnerOrganizationId,
        },
      organizationId !== 'ALL' && {
        key: 'organizationId',
        label: 'Org',
        value: org?.name ?? organizationId,
      },
      userId !== 'ALL' && {
        key: 'userId',
        label: 'User',
        value: selectedUser?.name ?? selectedUser?.email ?? userId,
      },
      expiringFrom && {
        key: 'expiringFrom',
        label: 'Expiring from',
        value: expiringFrom,
      },
      expiringTo && { key: 'expiringTo', label: 'Expiring to', value: expiringTo },
      seatUsageMin && { key: 'seatUsageMin', label: 'Min seats', value: seatUsageMin },
      seatUsageMax && { key: 'seatUsageMax', label: 'Max seats', value: seatUsageMax },
      startFrom && { key: 'startFrom', label: 'Start from', value: startFrom },
      startTo && { key: 'startTo', label: 'Start to', value: startTo },
      endFrom && { key: 'endFrom', label: 'End from', value: endFrom },
      endTo && { key: 'endTo', label: 'End to', value: endTo },
    ].filter(Boolean) as FilterChip[];
  }, [
    endFrom,
    endTo,
    expiringFrom,
    expiringTo,
    isSuperAdmin,
    organizationId,
    orgsQuery.data,
    partnerOrganizationId,
    partners,
    planName,
    search,
    seatUsageMax,
    seatUsageMin,
    startFrom,
    startTo,
    status,
    userId,
    usersQuery.data,
  ]);

  const updateStatus = useMutation({
    mutationFn: ({ id, nextStatus }: { id: string; nextStatus: SubscriptionStatus }) =>
      subscriptionsApi.update(id, { status: nextStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      toast.success('Subscription status updated');
      setStatusAction(null);
    },
    onError: (err) => toast.error(extractApiError(err)),
  });

  const approveMutation = useMutation({
    mutationFn: (subId: string) => subscriptionsApi.approve(subId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      toast.success('Subscription approved');
      setApproveTarget(null);
    },
    onError: (err) => toast.error(extractApiError(err)),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ subId, reason }: { subId: string; reason: string }) =>
      subscriptionsApi.reject(subId, reason || null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      toast.success('Subscription rejected');
      setRejectTarget(null);
      setRejectReason('');
    },
    onError: (err) => toast.error(extractApiError(err)),
  });

  const archiveMutation = useMutation({
    mutationFn: (subId: string) => subscriptionsApi.archive(subId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      toast.success('Subscription archived');
      setArchiveTarget(null);
    },
    onError: (err) => toast.error(extractApiError(err)),
  });

  const restoreMutation = useMutation({
    mutationFn: (subId: string) => subscriptionsApi.restore(subId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      toast.success('Subscription restored');
      setRestoreTarget(null);
    },
    onError: (err) => toast.error(extractApiError(err)),
  });

  const handleExport = async (format: AdminExportFormat) => {
    setExporting(format);
    try {
      await subscriptionsApi.export(
        { ...query, page: undefined, perPage: undefined },
        format,
      );
      toast.success(`Subscriptions ${format.toUpperCase()} export started`);
    } catch (error) {
      toast.error(extractApiError(error));
    } finally {
      setExporting(null);
    }
  };

  const setPartnerFilter = (value: string) => {
    const next = new URLSearchParams(params);
    if (value === ALL_PARTNERS_VALUE) {
      next.delete('partnerOrganizationId');
    } else {
      next.set('partnerOrganizationId', value);
    }
    next.delete('page');
    const selectedOrganization = orgsQuery.data?.find((org) => org.id === organizationId);
    if (
      organizationId !== 'ALL' &&
      !organizationBelongsToPartner(selectedOrganization, value)
    ) {
      next.delete('organizationId');
    }
    setParams(next, { replace: true });
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Matching plans"
          value={meta?.total ?? 0}
          detail="All filters applied server-side"
          tone="blue"
        />
        <StatCard
          label="Active on page"
          value={activeCount}
          detail={`${trialCount} trials on current page`}
          tone="green"
        />
        <StatCard
          label="Seats"
          value={`${usedSeats}/${totalSeats}`}
          detail="Current result page"
          tone="orange"
        />
        <StatCard
          label="Utilization"
          value={`${totalSeats ? Math.round((usedSeats / totalSeats) * 100) : 0}%`}
          detail="Current result page"
          tone="purple"
        />
      </div>

      <Card>
        <div className="flex flex-col gap-4 border-b border-line px-4 py-5 sm:px-6 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink-900">Subscriptions</h2>
            <p className="text-sm text-ink-500">
              Track plan state, scopes, terms, expiring plans, and seat capacity.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ExportButtons
              onExport={handleExport}
              disabled={subscriptionsQuery.isLoading}
              loading={Boolean(exporting)}
            />
            <Button
              variant="primary"
              onClick={() =>
                navigate(
                  isSuperAdmin && partnerOrganizationId !== ALL_PARTNERS_VALUE
                    ? `/subscriptions/new?partnerOrganizationId=${partnerOrganizationId}`
                    : '/subscriptions/new',
                )
              }
            >
              <Plus className="h-4 w-4" />
              Create subscription
            </Button>
          </div>
        </div>

        <div className="space-y-3 px-4 py-4 sm:px-6">
          <div
            className={`grid gap-3 ${
              isSuperAdmin
                ? 'xl:grid-cols-[1fr_170px_200px_200px_200px]'
                : 'xl:grid-cols-[1fr_170px_200px_200px]'
            }`}
          >
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <Input
                placeholder="Search scope, plan, owner"
                value={search}
                onChange={(e) =>
                  setSearchParam(params, setParams, 'search', e.target.value)
                }
                className="pl-9"
              />
            </div>
            <Select
              value={status}
              onValueChange={(value) =>
                setSearchParam(params, setParams, 'status', value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="TRIAL">Trial</SelectItem>
                <SelectItem value="PENDING_APPROVAL">Pending Approval</SelectItem>
                <SelectItem value="EXPIRED">Expired</SelectItem>
                <SelectItem value="CANCELED">Canceled</SelectItem>
                <SelectItem value="ARCHIVED">Archived</SelectItem>
              </SelectContent>
            </Select>
            {isSuperAdmin && (
              <Select value={partnerOrganizationId} onValueChange={setPartnerFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_PARTNERS_VALUE}>All partners</SelectItem>
                  {partners.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select
              value={organizationId}
              onValueChange={(value) =>
                setSearchParam(params, setParams, 'organizationId', value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">
                  {isSuperAdmin && partnerOrganizationId !== ALL_PARTNERS_VALUE
                    ? 'All under partner'
                    : 'All organizations'}
                </SelectItem>
                {organizationOptions.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={userId}
              onValueChange={(value) => setSearchParam(params, setParams, 'userId', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All users</SelectItem>
                {usersQuery.data?.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name ?? user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 lg:grid-cols-7">
            <Input
              value={planName}
              onChange={(e) =>
                setSearchParam(params, setParams, 'planName', e.target.value)
              }
              placeholder="Plan"
            />
            <Input
              type="date"
              value={expiringFrom}
              onChange={(e) =>
                setSearchParam(params, setParams, 'expiringFrom', e.target.value)
              }
              title="Expiring from"
            />
            <Input
              type="date"
              value={expiringTo}
              onChange={(e) =>
                setSearchParam(params, setParams, 'expiringTo', e.target.value)
              }
              title="Expiring to"
            />
            <Input
              type="number"
              min={0}
              value={seatUsageMin}
              onChange={(e) =>
                setSearchParam(params, setParams, 'seatUsageMin', e.target.value)
              }
              placeholder="Min seats"
            />
            <Input
              type="number"
              min={0}
              value={seatUsageMax}
              onChange={(e) =>
                setSearchParam(params, setParams, 'seatUsageMax', e.target.value)
              }
              placeholder="Max seats"
            />
            <Input
              type="date"
              value={startFrom}
              onChange={(e) =>
                setSearchParam(params, setParams, 'startFrom', e.target.value)
              }
              title="Start from"
            />
            <Input
              type="date"
              value={endTo}
              onChange={(e) =>
                setSearchParam(params, setParams, 'endTo', e.target.value)
              }
              title="End to"
            />
          </div>

          <ActiveFilterChips
            filters={activeFilters}
            onRemove={(key) => setSearchParam(params, setParams, key, null)}
            onClearAll={() => clearSearchParams(params, setParams)}
          />
        </div>

        {subscriptionsQuery.isLoading ? (
          <div className="flex h-56 items-center justify-center">
            <Spinner className="h-6 w-6 text-brand-primary" />
          </div>
        ) : (
          <Table className="min-w-[960px]">
            <colgroup>
              <col />
              <col className="w-[170px]" />
              <col className="w-[190px]" />
              <col className="w-[150px]" />
              <col className="w-[190px]" />
              <col className="w-[210px]" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead>Scope</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Seats</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Term</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.map((s) => {
                const scopeName =
                  s.organization?.name ?? s.user?.name ?? s.user?.email ?? '-';
                const scopeKind = subscriptionScopeLabel(s);
                const pct = Math.min(
                  100,
                  s.seatLimit > 0 ? (s.seatUsage / s.seatLimit) * 100 : 0,
                );
                return (
                  <TableRow key={s.id}>
                    <TableCell className="min-w-0">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink-900">
                          {scopeName}
                        </p>
                        <p className="truncate text-xs text-ink-500">{scopeKind}</p>
                      </div>
                    </TableCell>
                    <TableCell className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink-900">
                        {s.planName}
                      </p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="w-full max-w-48 space-y-1">
                        <Progress value={pct} />
                        <p className="text-xs text-ink-500">
                          {s.seatUsage}/{s.seatLimit} seats
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant={statusVariant(s.status)}>
                        {SUBSCRIPTION_STATUS_LABEL[s.status]}
                      </Badge>
                      {s.deletedAt && (
                        <Badge variant="default" className="ml-2">
                          Archived
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <p className="text-sm leading-5 text-ink-700">
                        {formatDate(s.startDate)} - {formatDate(s.endDate)}
                      </p>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <div className="flex justify-end gap-1 whitespace-nowrap">
                        {isSuperAdmin && s.status === 'PENDING_APPROVAL' && (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Approve subscription"
                              onClick={() => setApproveTarget(s)}
                            >
                              <CheckCircle2 className="h-4 w-4 text-success" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Reject subscription"
                              onClick={() => {
                                setRejectTarget(s);
                                setRejectReason('');
                              }}
                            >
                              <XCircle className="h-4 w-4 text-danger" />
                            </Button>
                          </>
                        )}
                        {isSuperAdmin &&
                          s.status !== 'PENDING_APPROVAL' &&
                          (s.status === 'CANCELED' || s.status === 'EXPIRED' ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Reactivate subscription"
                              onClick={() =>
                                setStatusAction({ subscription: s, status: 'ACTIVE' })
                              }
                            >
                              <RotateCcw className="h-4 w-4 text-success" />
                            </Button>
                          ) : (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Mark expired"
                                onClick={() =>
                                  setStatusAction({ subscription: s, status: 'EXPIRED' })
                                }
                              >
                                <Clock3 className="h-4 w-4 text-warning" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Cancel subscription"
                                onClick={() =>
                                  setStatusAction({ subscription: s, status: 'CANCELED' })
                                }
                              >
                                <Ban className="h-4 w-4 text-danger" />
                              </Button>
                            </>
                          ))}
                        <Button
                          size="icon"
                          variant="ghost"
                          title="View details"
                          onClick={() => navigate(`/subscriptions/${s.id}/details`)}
                        >
                          <Eye className="h-4 w-4 text-ink-500" />
                        </Button>
                        {isSuperAdmin && s.organizationId && s.organization?.kind === 'PARTNER' && (
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Partner subscription overview"
                            onClick={() => navigate(`/subscriptions/partners/${s.organizationId}`)}
                          >
                            <Building2 className="h-4 w-4 text-ink-500" />
                          </Button>
                        )}
                        {isSuperAdmin && (
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Edit subscription"
                            onClick={() => navigate(`/subscriptions/${s.id}/edit`)}
                          >
                            <Pencil className="h-4 w-4 text-ink-500" />
                          </Button>
                        )}
                        {isSuperAdmin &&
                          (s.deletedAt ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Restore subscription"
                              onClick={() => setRestoreTarget(s)}
                            >
                              <ArchiveRestore className="h-4 w-4 text-success" />
                            </Button>
                          ) : (
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Archive subscription"
                              onClick={() => setArchiveTarget(s)}
                            >
                              <Archive className="h-4 w-4 text-warning" />
                            </Button>
                          ))}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {subscriptions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
                        <CreditCard className="h-5 w-5" />
                      </div>
                      <p className="mt-3 text-sm font-semibold text-ink-900">
                        No subscriptions match these filters
                      </p>
                      <p className="mt-1 text-sm text-ink-500">
                        Clear filters or create a new subscription allocation.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
        <PaginationFooter
          meta={meta}
          onPageChange={(nextPage) =>
            setSearchParam(params, setParams, 'page', nextPage)
          }
        />
      </Card>

      <ConfirmationDialog
        open={!!statusAction}
        onOpenChange={(open) => !open && setStatusAction(null)}
        title={
          statusAction?.status === 'ACTIVE'
            ? 'Reactivate subscription?'
            : statusAction?.status === 'EXPIRED'
              ? 'Mark subscription expired?'
              : 'Cancel subscription?'
        }
        description={
          statusAction?.status === 'ACTIVE'
            ? `${statusAction.subscription.planName} will be restored to active billing status.`
            : statusAction?.status === 'EXPIRED'
              ? `${statusAction?.subscription.planName ?? 'This subscription'} will be marked expired for reporting and access review.`
              : `${statusAction?.subscription.planName ?? 'This subscription'} will be marked canceled.`
        }
        confirmLabel={
          statusAction?.status === 'ACTIVE'
            ? 'Reactivate'
            : statusAction?.status === 'EXPIRED'
              ? 'Mark expired'
              : 'Cancel subscription'
        }
        tone={
          statusAction?.status === 'ACTIVE'
            ? 'success'
            : statusAction?.status === 'EXPIRED'
              ? 'warning'
              : 'danger'
        }
        loading={updateStatus.isPending}
        onConfirm={() => {
          if (!statusAction) return;
          updateStatus.mutate({
            id: statusAction.subscription.id,
            nextStatus: statusAction.status,
          });
        }}
      />

      <ConfirmationDialog
        open={!!approveTarget}
        onOpenChange={(open) => !open && setApproveTarget(null)}
        title="Approve subscription?"
        description={`${approveTarget?.planName ?? 'This subscription'} will become active and its seats will be made available. The admin who requested it will be emailed.`}
        confirmLabel="Approve"
        tone="success"
        loading={approveMutation.isPending}
        onConfirm={() => {
          if (approveTarget) approveMutation.mutate(approveTarget.id);
        }}
      />

      <Dialog
        open={!!rejectTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null);
            setRejectReason('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject subscription?</DialogTitle>
            <DialogDescription>
              {rejectTarget?.planName ?? 'This subscription'} will be canceled. The admin who
              requested it will be emailed with your reason.
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
                setRejectTarget(null);
                setRejectReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={rejectMutation.isPending}
              onClick={() => {
                if (rejectTarget)
                  rejectMutation.mutate({ subId: rejectTarget.id, reason: rejectReason });
              }}
            >
              {rejectMutation.isPending ? <Spinner className="h-4 w-4" /> : null}
              Reject subscription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={!!archiveTarget}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
        title="Archive subscription?"
        description={`${archiveTarget?.planName ?? 'This subscription'} will move to the Archived filter. Existing history stays preserved.`}
        confirmLabel="Archive"
        tone="warning"
        loading={archiveMutation.isPending}
        onConfirm={() => {
          if (archiveTarget) archiveMutation.mutate(archiveTarget.id);
        }}
      />

      <ConfirmationDialog
        open={!!restoreTarget}
        onOpenChange={(open) => !open && setRestoreTarget(null)}
        title="Restore subscription?"
        description={`${restoreTarget?.planName ?? 'This subscription'} will return to the normal subscription list.`}
        confirmLabel="Restore"
        tone="success"
        loading={restoreMutation.isPending}
        onConfirm={() => {
          if (restoreTarget) restoreMutation.mutate(restoreTarget.id);
        }}
      />
    </div>
  );
}
