import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Ban,
  Clock3,
  CreditCard,
  Pencil,
  Plus,
  RotateCcw,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';

import { subscriptionsApi } from '@/services/subscriptions.api';
import { organizationsApi } from '@/services/organizations.api';
import { usersApi } from '@/services/users.api';
import type { AdminExportFormat, AdminListQuery } from '@/services/admin-api';
import { extractApiError } from '@/lib/api';
import { formatDate } from '@/lib/utils';
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
  }
}

export function SubscriptionsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [exporting, setExporting] = useState<AdminExportFormat | null>(null);
  const [statusAction, setStatusAction] = useState<{
    subscription: SubscriptionRecord;
    status: SubscriptionStatus;
  } | null>(null);

  const page = numberParam(params.get('page'), 1);
  const search = params.get('search') ?? '';
  const status = params.get('status') ?? 'ALL';
  const planName = params.get('planName') ?? '';
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
  const activeCount = subscriptions.filter((s) => s.status === 'ACTIVE').length;
  const trialCount = subscriptions.filter((s) => s.status === 'TRIAL').length;
  const totalSeats = subscriptions.reduce((sum, s) => sum + s.seatLimit, 0);
  const usedSeats = subscriptions.reduce((sum, s) => sum + s.seatUsage, 0);

  const activeFilters = useMemo<FilterChip[]>(() => {
    const org = orgsQuery.data?.find((item) => item.id === organizationId);
    const selectedUser = usersQuery.data?.find((item) => item.id === userId);
    return [
      search && { key: 'search', label: 'Search', value: search },
      status !== 'ALL' && {
        key: 'status',
        label: 'Status',
        value: SUBSCRIPTION_STATUS_LABEL[status as SubscriptionStatus] ?? status,
      },
      planName && { key: 'planName', label: 'Plan', value: planName },
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
    organizationId,
    orgsQuery.data,
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
          label="Seats used"
          value={`${usedSeats}/${totalSeats}`}
          detail="Current result page"
          tone="orange"
        />
        <StatCard
          label="Utilization"
          value={`${totalSeats ? Math.round((usedSeats / totalSeats) * 100) : 0}%`}
          detail="Seat usage ratio"
          tone="purple"
        />
      </div>

      <Card>
        <div className="flex flex-col gap-4 border-b border-line px-6 py-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink-900">Subscriptions</h2>
            <p className="text-sm text-ink-500">
              Track plan state, scopes, terms, expiring plans, and seat utilization.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ExportButtons
              onExport={handleExport}
              disabled={subscriptionsQuery.isLoading}
              loading={Boolean(exporting)}
            />
            <Button variant="primary" onClick={() => navigate('/subscriptions/new')}>
              <Plus className="h-4 w-4" />
              Create subscription
            </Button>
          </div>
        </div>

        <div className="space-y-3 px-6 py-4">
          <div className="grid gap-3 xl:grid-cols-[1fr_170px_200px_200px]">
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
                <SelectItem value="EXPIRED">Expired</SelectItem>
                <SelectItem value="CANCELED">Canceled</SelectItem>
              </SelectContent>
            </Select>
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
                <SelectItem value="ALL">All organizations</SelectItem>
                {orgsQuery.data?.map((org) => (
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scope</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Seat Usage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Term</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.map((s) => {
                const scopeName =
                  s.organization?.name ?? s.user?.name ?? s.user?.email ?? '-';
                const scopeKind = s.organizationId ? 'Organization' : 'User';
                const pct = Math.min(
                  100,
                  s.seatLimit > 0 ? (s.seatUsage / s.seatLimit) * 100 : 0,
                );
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink-900">
                          {scopeName}
                        </p>
                        <p className="text-xs text-ink-500">{scopeKind}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-semibold text-ink-900">
                        {s.planName}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="w-full max-w-48 space-y-1">
                        <Progress value={pct} />
                        <p className="text-xs text-ink-500">
                          {s.seatUsage}/{s.seatLimit} seats
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(s.status)}>
                        {SUBSCRIPTION_STATUS_LABEL[s.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm leading-5 text-ink-700">
                        {formatDate(s.startDate)} - {formatDate(s.endDate)}
                      </p>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {s.status === 'CANCELED' || s.status === 'EXPIRED' ? (
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
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Edit subscription"
                          onClick={() => navigate(`/subscriptions/${s.id}/edit`)}
                        >
                          <Pencil className="h-4 w-4 text-ink-500" />
                        </Button>
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
    </div>
  );
}
