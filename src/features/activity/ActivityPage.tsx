import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Activity, Search } from 'lucide-react';
import { toast } from 'sonner';

import { activityApi } from '@/services/activity.api';
import { usersApi } from '@/services/users.api';
import { organizationsApi } from '@/services/organizations.api';
import type { AdminExportFormat, AdminListQuery } from '@/services/admin-api';
import { extractApiError } from '@/lib/api';
import { formatDateTime, initials } from '@/lib/utils';
import { useAuthStore } from '@/lib/auth-store';
import {
  ALL_PARTNERS_VALUE,
  organizationBelongsToPartner,
  organizationsForPartner,
  partnerOrganizations,
  organizationDepth,
} from '@/lib/admin-hierarchy';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
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

const COMMON_ACTIONS = [
  'auth.login',
  'admin.user.create',
  'admin.user.update',
  'admin.organization.create',
  'admin.organization.update',
  'admin.organization.logo.upload',
  'admin.organization.logo.remove',
  'admin.subscription.create',
  'admin.subscription.update',
];

const TARGET_TYPES = ['USER', 'ORGANIZATION', 'SUBSCRIPTION', 'CANVAS', 'EXPORT'];

function actionLabel(action: string) {
  return action
    .split('.')
    .map((s) => s[0]?.toUpperCase() + s.slice(1))
    .join(' / ');
}

export function ActivityPage() {
  const [params, setParams] = useSearchParams();
  const { user: actor } = useAuthStore();
  const [exporting, setExporting] = useState<AdminExportFormat | null>(null);
  const isSuperAdmin = actor?.role === 'SUPER_ADMIN';

  const page = numberParam(params.get('page'), 1);
  const search = params.get('search') ?? '';
  const actorUserId = params.get('actorUserId') ?? 'ALL';
  const action = params.get('action') ?? 'ALL';
  const targetType = params.get('targetType') ?? 'ALL';
  const partnerOrganizationId = params.get('partnerOrganizationId') ?? ALL_PARTNERS_VALUE;
  const organizationId = params.get('organizationId') ?? 'ALL';
  const targetId = params.get('targetId') ?? '';
  const createdFrom = params.get('createdFrom') ?? '';
  const createdTo = params.get('createdTo') ?? '';

  const query = useMemo<AdminListQuery>(
    () => ({
      page,
      perPage: PER_PAGE,
      search,
      actorUserId: cleanFilterValue(actorUserId),
      action: cleanFilterValue(action),
      targetType: cleanFilterValue(targetType),
      partnerOrganizationId: cleanFilterValue(partnerOrganizationId),
      organizationId: cleanFilterValue(organizationId),
      targetId,
      createdFrom,
      createdTo,
      sortBy: params.get('sortBy') ?? 'createdAt',
      sortOrder: params.get('sortOrder') ?? 'desc',
    }),
    [
      action,
      actorUserId,
      createdFrom,
      createdTo,
      organizationId,
      page,
      partnerOrganizationId,
      params,
      search,
      targetId,
      targetType,
    ],
  );

  const activityQuery = useQuery({
    queryKey: ['activity', query],
    queryFn: () => activityApi.list(query),
  });
  const usersQuery = useQuery({
    queryKey: ['users', 'all'],
    queryFn: usersApi.all,
  });
  const orgsQuery = useQuery({
    queryKey: ['organizations', 'all'],
    queryFn: organizationsApi.all,
  });

  const entries = activityQuery.data?.data ?? [];
  const meta = activityQuery.data?.meta;
  const allOrganizations = orgsQuery.data ?? [];
  const partners = partnerOrganizations(allOrganizations);
  const organizationOptions = organizationsForPartner(allOrganizations, partnerOrganizationId);
  const uniqueActors = new Set(entries.map((entry) => entry.actorUserId)).size;
  const targetCount = new Set(entries.map((entry) => entry.targetType)).size;

  const activeFilters = useMemo<FilterChip[]>(() => {
    const actor = usersQuery.data?.find((user) => user.id === actorUserId);
    const partner = partners.find((org) => org.id === partnerOrganizationId);
    const organization = orgsQuery.data?.find((org) => org.id === organizationId);
    return [
      search && { key: 'search', label: 'Search', value: search },
      actorUserId !== 'ALL' && {
        key: 'actorUserId',
        label: 'Actor',
        value: actor?.name ?? actor?.email ?? actorUserId,
      },
      action !== 'ALL' && { key: 'action', label: 'Action', value: actionLabel(action) },
      targetType !== 'ALL' && { key: 'targetType', label: 'Target', value: targetType },
      isSuperAdmin &&
        partnerOrganizationId !== ALL_PARTNERS_VALUE && {
          key: 'partnerOrganizationId',
          label: 'Partner',
          value: partner?.name ?? partnerOrganizationId,
        },
      organizationId !== 'ALL' && {
        key: 'organizationId',
        label: 'Org',
        value: organization?.name ?? organizationId,
      },
      targetId && { key: 'targetId', label: 'Target ID', value: targetId },
      createdFrom && { key: 'createdFrom', label: 'From', value: createdFrom },
      createdTo && { key: 'createdTo', label: 'To', value: createdTo },
    ].filter(Boolean) as FilterChip[];
  }, [
    action,
    actorUserId,
    createdFrom,
    createdTo,
    isSuperAdmin,
    organizationId,
    orgsQuery.data,
    partnerOrganizationId,
    partners,
    search,
    targetId,
    targetType,
    usersQuery.data,
  ]);

  const handleExport = async (format: AdminExportFormat) => {
    setExporting(format);
    try {
      await activityApi.export({ ...query, page: undefined, perPage: undefined }, format);
      toast.success(`Activity ${format.toUpperCase()} export started`);
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
      !organizationBelongsToPartner(selectedOrganization, value, allOrganizations)
    ) {
      next.delete('organizationId');
    }
    setParams(next, { replace: true });
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Matching actions"
          value={meta?.total ?? 0}
          detail="Server-side filtered audit logs"
          tone="blue"
        />
        <StatCard
          label="Actors on page"
          value={uniqueActors}
          detail="Distinct administrators"
          tone="orange"
        />
        <StatCard
          label="Target types"
          value={targetCount}
          detail="Current result page"
          tone="purple"
        />
      </div>

      <Card>
        <div className="flex flex-col gap-4 border-b border-line px-4 py-5 sm:px-6 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink-900">Audit Log</h2>
            <p className="text-sm text-ink-500">
              Filter, inspect, and export administrative activity.
            </p>
          </div>
          <ExportButtons
            onExport={handleExport}
            disabled={activityQuery.isLoading}
            loading={Boolean(exporting)}
          />
        </div>

        <div className="space-y-3 px-4 py-4 sm:px-6">
          <div className="grid gap-3 xl:grid-cols-[1fr_220px_220px_160px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <Input
                placeholder="Search action, summary, target"
                value={search}
                onChange={(e) =>
                  setSearchParam(params, setParams, 'search', e.target.value)
                }
                className="pl-9"
              />
            </div>
            <Select
              value={actorUserId}
              onValueChange={(value) =>
                setSearchParam(params, setParams, 'actorUserId', value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All actors</SelectItem>
                {usersQuery.data?.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name ?? user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={action}
              onValueChange={(value) =>
                setSearchParam(params, setParams, 'action', value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All actions</SelectItem>
                {COMMON_ACTIONS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {actionLabel(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={targetType}
              onValueChange={(value) =>
                setSearchParam(params, setParams, 'targetType', value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All targets</SelectItem>
                {TARGET_TYPES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div
            className={`grid gap-3 ${
              isSuperAdmin ? 'sm:grid-cols-5' : 'sm:grid-cols-4'
            }`}
          >
            {isSuperAdmin && (
              <Select value={partnerOrganizationId} onValueChange={setPartnerFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_PARTNERS_VALUE}>All partners</SelectItem>
                  {partners.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {'  '.repeat(organizationDepth(allOrganizations, org.id))}
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
            <Input
              value={targetId}
              onChange={(e) =>
                setSearchParam(params, setParams, 'targetId', e.target.value)
              }
              placeholder="Target ID"
            />
            <Input
              type="date"
              value={createdFrom}
              onChange={(e) =>
                setSearchParam(params, setParams, 'createdFrom', e.target.value)
              }
              title="Created from"
            />
            <Input
              type="date"
              value={createdTo}
              onChange={(e) =>
                setSearchParam(params, setParams, 'createdTo', e.target.value)
              }
              title="Created to"
            />
          </div>
          <ActiveFilterChips
            filters={activeFilters}
            onRemove={(key) => setSearchParam(params, setParams, key, null)}
            onClearAll={() => clearSearchParams(params, setParams)}
          />
        </div>

        {activityQuery.isLoading ? (
          <div className="flex h-56 items-center justify-center">
            <Spinner className="h-6 w-6 text-brand-primary" />
          </div>
        ) : (
          <Table className="min-w-[820px]">
            <TableHeader>
              <TableRow>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Summary</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="min-w-0">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback>
                          {initials(entry.actorUser?.name ?? entry.actorUser?.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink-900">
                          {entry.actorUser?.name ?? entry.actorUser?.email}
                        </p>
                        <p className="truncate text-xs text-ink-500">
                          {entry.actorUser?.role}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge variant="info">{actionLabel(entry.action)}</Badge>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                      {entry.targetType}
                    </p>
                    <p className="max-w-[180px] truncate text-xs text-ink-400">
                      {entry.targetId ?? '-'}
                    </p>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm leading-5 text-ink-700">
                      {entry.summary ?? '-'}
                    </p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <p className="text-xs leading-5 text-ink-500">
                      {formatDateTime(entry.createdAt)}
                    </p>
                  </TableCell>
                </TableRow>
              ))}
              {entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
                        <Activity className="h-5 w-5" />
                      </div>
                      <p className="mt-3 text-sm font-semibold text-ink-900">
                        No activity matches these filters
                      </p>
                      <p className="mt-1 text-sm text-ink-500">
                        Adjust the actor, target, or date range to inspect a broader trail.
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
    </div>
  );
}
