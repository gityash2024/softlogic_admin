import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  Search,
  ShieldCheck,
  UserRoundCheck,
} from 'lucide-react';
import { toast } from 'sonner';

import { usersApi } from '@/services/users.api';
import { organizationsApi } from '@/services/organizations.api';
import type { AdminExportFormat, AdminListQuery } from '@/services/admin-api';
import { extractApiError } from '@/lib/api';
import { formatDate, initials } from '@/lib/utils';
import { useAuthStore } from '@/lib/auth-store';
import { manageableRoles, canManageUser } from '@/lib/role-access';
import {
  ROLE_LABEL,
  type AdminUser,
  type UserRole,
  type UserStatus,
} from '@/types/api';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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

function statusVariant(status: UserStatus) {
  return status === 'ACTIVE' ? 'success' : 'warning';
}

export function UsersPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { user: actor } = useAuthStore();
  const queryClient = useQueryClient();
  const [exporting, setExporting] = useState<AdminExportFormat | null>(null);
  const [statusAction, setStatusAction] = useState<{
    user: AdminUser;
    status: UserStatus;
  } | null>(null);

  const allowedRoles = manageableRoles(actor?.role);
  const page = numberParam(params.get('page'), 1);
  const search = params.get('search') ?? '';
  const role = params.get('role') ?? 'ALL';
  const status = params.get('status') ?? 'ALL';
  const organizationId = params.get('organizationId') ?? 'ALL';
  const isEmailVerified = params.get('isEmailVerified') ?? 'ALL';
  const createdFrom = params.get('createdFrom') ?? '';
  const createdTo = params.get('createdTo') ?? '';
  const lastSeenFrom = params.get('lastSeenFrom') ?? '';
  const lastSeenTo = params.get('lastSeenTo') ?? '';

  const query = useMemo<AdminListQuery>(
    () => ({
      page,
      perPage: PER_PAGE,
      search,
      role: cleanFilterValue(role),
      status: cleanFilterValue(status),
      organizationId: cleanFilterValue(organizationId),
      isEmailVerified:
        isEmailVerified === 'ALL' ? undefined : isEmailVerified === 'true',
      createdFrom,
      createdTo,
      lastSeenFrom,
      lastSeenTo,
      sortBy: params.get('sortBy') ?? 'createdAt',
      sortOrder: params.get('sortOrder') ?? 'desc',
    }),
    [
      createdFrom,
      createdTo,
      isEmailVerified,
      lastSeenFrom,
      lastSeenTo,
      organizationId,
      page,
      params,
      role,
      search,
      status,
    ],
  );

  const usersQuery = useQuery({
    queryKey: ['users', query],
    queryFn: () => usersApi.list(query),
  });
  const orgsQuery = useQuery({
    queryKey: ['organizations', 'all'],
    queryFn: organizationsApi.all,
  });

  const users = usersQuery.data?.data ?? [];
  const meta = usersQuery.data?.meta;
  const activeCount = users.filter((u) => u.status === 'ACTIVE').length;
  const disabledCount = users.filter((u) => u.status === 'DISABLED').length;
  const adminCount = users.filter((u) =>
    ['SUPER_ADMIN', 'PARTNER_ADMIN', 'CUSTOMER_ADMIN', 'ADMIN'].includes(u.role),
  ).length;
  const verifiedCount = users.filter((u) => u.isEmailVerified).length;

  const activeFilters = useMemo<FilterChip[]>(() => {
    const organization = orgsQuery.data?.find((org) => org.id === organizationId);
    return [
      search && { key: 'search', label: 'Search', value: search },
      role !== 'ALL' && {
        key: 'role',
        label: 'Role',
        value: ROLE_LABEL[role as UserRole] ?? role,
      },
      status !== 'ALL' && { key: 'status', label: 'Status', value: status },
      organizationId !== 'ALL' && {
        key: 'organizationId',
        label: 'Org',
        value: organization?.name ?? organizationId,
      },
      isEmailVerified !== 'ALL' && {
        key: 'isEmailVerified',
        label: 'Verified',
        value: isEmailVerified === 'true' ? 'Yes' : 'No',
      },
      createdFrom && { key: 'createdFrom', label: 'Created from', value: createdFrom },
      createdTo && { key: 'createdTo', label: 'Created to', value: createdTo },
      lastSeenFrom && {
        key: 'lastSeenFrom',
        label: 'Seen from',
        value: lastSeenFrom,
      },
      lastSeenTo && { key: 'lastSeenTo', label: 'Seen to', value: lastSeenTo },
    ].filter(Boolean) as FilterChip[];
  }, [
    createdFrom,
    createdTo,
    isEmailVerified,
    lastSeenFrom,
    lastSeenTo,
    organizationId,
    orgsQuery.data,
    role,
    search,
    status,
  ]);

  const toggleStatus = useMutation({
    mutationFn: ({ id, nextStatus }: { id: string; nextStatus: UserStatus }) =>
      usersApi.update(id, { status: nextStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      toast.success('Account status updated');
      setStatusAction(null);
    },
    onError: (err) => toast.error(extractApiError(err)),
  });

  const handleExport = async (format: AdminExportFormat) => {
    setExporting(format);
    try {
      await usersApi.export({ ...query, page: undefined, perPage: undefined }, format);
      toast.success(`Users ${format.toUpperCase()} export started`);
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
          label="Matching users"
          value={meta?.total ?? 0}
          detail="All filters applied server-side"
          tone="blue"
        />
        <StatCard
          label="Active on page"
          value={activeCount}
          detail={`${disabledCount} suspended on this page`}
          tone="green"
        />
        <StatCard
          label="Admin roles"
          value={adminCount}
          detail="Current result page"
          tone="orange"
        />
        <StatCard
          label="Verified email"
          value={verifiedCount}
          detail="Current result page"
          tone="purple"
        />
      </div>

      <Card>
        <div className="flex flex-col gap-4 border-b border-line px-6 py-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink-900">User Directory</h2>
            <p className="text-sm text-ink-500">
              Provision accounts, filter access, export clean audit-ready user data.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ExportButtons
              onExport={handleExport}
              disabled={usersQuery.isLoading}
              loading={Boolean(exporting)}
            />
            <Button variant="primary" onClick={() => navigate('/users/new')}>
              <Plus className="h-4 w-4" />
              Create user
            </Button>
          </div>
        </div>

        <div className="space-y-3 px-6 py-4">
          <div className="grid gap-3 xl:grid-cols-[1fr_180px_180px_220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <Input
                placeholder="Search name, email, organization"
                value={search}
                onChange={(e) =>
                  setSearchParam(params, setParams, 'search', e.target.value)
                }
                className="pl-9"
              />
            </div>
            <Select
              value={role}
              onValueChange={(value) => setSearchParam(params, setParams, 'role', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All roles</SelectItem>
                {allowedRoles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                <SelectItem value="DISABLED">Suspended</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={organizationId}
              onValueChange={(value) =>
                setSearchParam(params, setParams, 'organizationId', value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Organization" />
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
          </div>

          <div className="grid gap-3 lg:grid-cols-5">
            <Select
              value={isEmailVerified}
              onValueChange={(value) =>
                setSearchParam(params, setParams, 'isEmailVerified', value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Any email state</SelectItem>
                <SelectItem value="true">Verified</SelectItem>
                <SelectItem value="false">Unverified</SelectItem>
              </SelectContent>
            </Select>
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
            <Input
              type="date"
              value={lastSeenFrom}
              onChange={(e) =>
                setSearchParam(params, setParams, 'lastSeenFrom', e.target.value)
              }
              title="Last seen from"
            />
            <Input
              type="date"
              value={lastSeenTo}
              onChange={(e) =>
                setSearchParam(params, setParams, 'lastSeenTo', e.target.value)
              }
              title="Last seen to"
            />
          </div>

          <ActiveFilterChips
            filters={activeFilters}
            onRemove={(key) => setSearchParam(params, setParams, key, null)}
            onClearAll={() => clearSearchParams(params, setParams)}
          />
        </div>

        {usersQuery.isLoading ? (
          <div className="flex h-56 items-center justify-center">
            <Spinner className="h-6 w-6 text-brand-primary" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const canManage = canManageUser(actor?.role, u.role);
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex min-w-[220px] items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback>
                            {initials(u.name ?? u.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink-900">
                            {u.name ?? 'No name'}
                          </p>
                          <p className="truncate text-xs text-ink-500">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.role === 'SUPER_ADMIN' ? 'navy' : 'default'}>
                        {ROLE_LABEL[u.role]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <p className="min-w-[160px] text-sm text-ink-900">
                        {u.primaryOrganization?.name ?? (
                          <span className="text-ink-400">Unassigned</span>
                        )}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(u.status)}>
                        {u.status === 'ACTIVE' ? 'Active' : 'Suspended'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.isEmailVerified ? 'success' : 'warning'}>
                        {u.isEmailVerified ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <ShieldCheck className="h-3 w-3" />
                        )}
                        {u.isEmailVerified ? 'Verified' : 'Pending'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-ink-500">
                        {formatDate(u.lastLoginAt)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={!canManage}
                          onClick={() =>
                            setStatusAction({
                              user: u,
                              status: u.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
                            })
                          }
                          title={
                            u.status === 'ACTIVE'
                              ? 'Suspend account'
                              : 'Reactivate account'
                          }
                        >
                          {u.status === 'ACTIVE' ? (
                            <PauseCircle className="h-4 w-4 text-warning" />
                          ) : (
                            <PlayCircle className="h-4 w-4 text-success" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={!canManage}
                          onClick={() => navigate(`/users/${u.id}/edit`)}
                          title="Edit user"
                        >
                          <Pencil className="h-4 w-4 text-ink-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
                        <UserRoundCheck className="h-5 w-5" />
                      </div>
                      <p className="mt-3 text-sm font-semibold text-ink-900">
                        No users match these filters
                      </p>
                      <p className="mt-1 text-sm text-ink-500">
                        Clear filters or create a new account for this workspace.
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
          statusAction?.status === 'DISABLED'
            ? 'Suspend this account?'
            : 'Reactivate this account?'
        }
        description={
          statusAction?.status === 'DISABLED'
            ? `${statusAction.user.email} will lose access to SoftLogic until an admin reactivates the account.`
            : `${statusAction?.user.email ?? 'This user'} will regain access according to their assigned role and organization.`
        }
        confirmLabel={
          statusAction?.status === 'DISABLED' ? 'Suspend account' : 'Reactivate'
        }
        tone={statusAction?.status === 'DISABLED' ? 'danger' : 'success'}
        loading={toggleStatus.isPending}
        onConfirm={() => {
          if (!statusAction) return;
          toggleStatus.mutate({
            id: statusAction.user.id,
            nextStatus: statusAction.status,
          });
        }}
      />
    </div>
  );
}
