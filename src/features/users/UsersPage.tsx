import { useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Eye,
  LogOut,
  MailCheck,
  MailWarning,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserRoundCheck,
} from 'lucide-react';
import { toast } from 'sonner';

import { usersApi, type BulkInviteResult, type BulkInviteUser } from '@/services/users.api';
import { organizationsApi } from '@/services/organizations.api';
import { authApi } from '@/services/auth.api';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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

const ALL_USER_ROLES: UserRole[] = [
  'STUDENT',
  'TEACHER',
  'PARENT',
  'CUSTOMER_ADMIN',
  'PARTNER_ADMIN',
  'ADMIN',
  'SUPER_ADMIN',
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ParsedInviteRow {
  line: number;
  email: string;
  name?: string;
  role?: string;
  organizationId?: string;
  error?: string;
}

function statusVariant(status: UserStatus) {
  return status === 'ACTIVE' ? 'success' : 'warning';
}

function statusLabel(user: AdminUser) {
  if (user.deletedAt) return 'Archived';
  return user.status === 'ACTIVE' ? 'Active' : 'Suspended';
}

// A pending invite is an unverified account that has never signed in and is not
// archived. The list filter narrows to unverified users server-side; this refines
// the in-page "Pending" indicator using lastLoginAt.
function isPendingInvite(user: AdminUser) {
  return !user.isEmailVerified && !user.lastLoginAt && !user.deletedAt;
}

// Lightweight CSV parser for the bulk-invite dialog. Header is
// `email,name,role[,organizationId]`. Splits on commas, trims cells, skips blank
// lines, and flags per-row validation issues (missing/invalid email, bad role).
function parseInviteCsv(text: string): ParsedInviteRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) return [];

  // Drop an optional header row if it looks like column names.
  const first = lines[0].toLowerCase();
  const startIndex =
    first.includes('email') && first.includes('role') ? 1 : 0;

  const rows: ParsedInviteRow[] = [];
  for (let i = startIndex; i < lines.length; i += 1) {
    const cells = lines[i].split(',').map((cell) => cell.trim());
    const [email = '', name = '', role = '', organizationId = ''] = cells;
    const row: ParsedInviteRow = {
      line: i + 1,
      email,
      name: name || undefined,
      role: role || undefined,
      organizationId: organizationId || undefined,
    };
    if (!email) {
      row.error = 'Missing email';
    } else if (!EMAIL_PATTERN.test(email)) {
      row.error = 'Invalid email';
    } else if (!role) {
      row.error = 'Missing role';
    } else if (!ALL_USER_ROLES.includes(role as UserRole)) {
      row.error = `Unknown role "${role}"`;
    }
    rows.push(row);
  }
  return rows;
}

export function UsersPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { user: actor, startImpersonation } = useAuthStore();
  const queryClient = useQueryClient();
  const [exporting, setExporting] = useState<AdminExportFormat | null>(null);
  const [statusAction, setStatusAction] = useState<{
    user: AdminUser;
    status: UserStatus;
  } | null>(null);
  const [deleteAction, setDeleteAction] = useState<AdminUser | null>(null);
  const [logoutAction, setLogoutAction] = useState<AdminUser | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [bulkResult, setBulkResult] = useState<BulkInviteResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allowedRoles = manageableRoles(actor?.role);
  const page = numberParam(params.get('page'), 1);
  const search = params.get('search') ?? '';
  const role = params.get('role') ?? 'ALL';
  const status = params.get('status') ?? 'ALL';
  const organizationId = params.get('organizationId') ?? 'ALL';
  const isEmailVerified = params.get('isEmailVerified') ?? 'ALL';
  const pendingOnly = params.get('pending') === 'true';
  const createdFrom = params.get('createdFrom') ?? '';
  const createdTo = params.get('createdTo') ?? '';
  const lastSeenFrom = params.get('lastSeenFrom') ?? '';
  const lastSeenTo = params.get('lastSeenTo') ?? '';
  const superAdminNeedsOrganization =
    actor?.role === 'SUPER_ADMIN' &&
    organizationId === 'ALL' &&
    status !== 'ARCHIVED';

  const query = useMemo<AdminListQuery>(
    () => ({
      page,
      perPage: PER_PAGE,
      search,
      role: cleanFilterValue(role),
      status: cleanFilterValue(status),
      organizationId: cleanFilterValue(organizationId),
      // Pending invitations are unverified accounts; the toggle forces the
      // server-side isEmailVerified=false filter.
      isEmailVerified: pendingOnly
        ? false
        : isEmailVerified === 'ALL'
          ? undefined
          : isEmailVerified === 'true',
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
      pendingOnly,
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
      pendingOnly && {
        key: 'pending',
        label: 'Pending',
        value: 'Awaiting setup',
      },
      !pendingOnly &&
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
    pendingOnly,
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

  const deleteUser = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      toast.success('User deleted and license usage updated');
      setDeleteAction(null);
    },
    onError: (err) => toast.error(extractApiError(err)),
  });

  const resendInvite = useMutation({
    mutationFn: (id: string) => usersApi.resendInvite(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(`Invitation re-sent to ${result.email}`);
    },
    onError: (err) => toast.error(extractApiError(err)),
  });

  const forceLogout = useMutation({
    mutationFn: (id: string) => usersApi.forceLogout(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('All active sessions revoked');
      setLogoutAction(null);
    },
    onError: (err) => toast.error(extractApiError(err)),
  });

  const impersonate = useMutation({
    mutationFn: (id: string) => authApi.impersonate(id),
    onSuccess: (result) => {
      startImpersonation({ accessToken: result.accessToken, user: result.user });
      // Drop all cached data so every query refetches as the impersonated user.
      queryClient.clear();
      toast.success(`Now viewing as ${result.user.email}`);
      navigate('/');
    },
    onError: (err) => toast.error(extractApiError(err)),
  });

  const parsedInviteRows = useMemo(() => parseInviteCsv(csvText), [csvText]);
  const validInviteRows = parsedInviteRows.filter((row) => !row.error);
  const invalidInviteCount = parsedInviteRows.length - validInviteRows.length;

  const bulkInvite = useMutation({
    mutationFn: (rows: BulkInviteUser[]) => usersApi.bulkInvite(rows),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      setBulkResult(result);
      toast.success(
        `${result.createdCount} invited${
          result.failedCount ? `, ${result.failedCount} failed` : ''
        }`,
      );
    },
    onError: (err) => toast.error(extractApiError(err)),
  });

  const resetBulkDialog = () => {
    setBulkOpen(false);
    setCsvText('');
    setBulkResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCsvFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    setBulkResult(null);
  };

  const submitBulkInvite = () => {
    if (validInviteRows.length === 0) return;
    bulkInvite.mutate(
      validInviteRows.map((row) => ({
        email: row.email,
        name: row.name,
        role: row.role as UserRole,
        organizationId: row.organizationId,
      })),
    );
  };

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
              disabled={usersQuery.isLoading || superAdminNeedsOrganization}
              loading={Boolean(exporting)}
            />
            <Button variant="outline" onClick={() => setBulkOpen(true)}>
              <Upload className="h-4 w-4" />
              Bulk invite
            </Button>
            <Button
              variant="primary"
              onClick={() =>
                navigate(
                  organizationId !== 'ALL'
                    ? `/users/new?organizationId=${organizationId}`
                    : '/users/new',
                )
              }
            >
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
                <SelectItem value="ARCHIVED">Archived</SelectItem>
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
                <SelectItem value="ALL">
                  {actor?.role === 'SUPER_ADMIN'
                    ? 'Choose organization'
                    : 'All organizations'}
                </SelectItem>
                {orgsQuery.data?.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              Quick view
            </span>
            <Button
              type="button"
              size="sm"
              variant={pendingOnly ? 'primary' : 'outline'}
              onClick={() =>
                setSearchParam(
                  params,
                  setParams,
                  'pending',
                  pendingOnly ? null : 'true',
                )
              }
              title="Show accounts awaiting setup (unverified email)"
            >
              <MailWarning className="h-4 w-4" />
              Pending invitations
            </Button>
          </div>

          <div className="grid gap-3 lg:grid-cols-5">
            <Select
              value={pendingOnly ? 'false' : isEmailVerified}
              disabled={pendingOnly}
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
        ) : superAdminNeedsOrganization ? (
          <div className="flex h-64 items-center justify-center px-6 text-center">
            <div className="mx-auto flex max-w-sm flex-col items-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
                <UserRoundCheck className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm font-semibold text-ink-900">
                Select an organization first
              </p>
              <p className="mt-1 text-sm leading-6 text-ink-500">
                Super Admin user management starts from an organization so
                school users, licenses, and policies stay scoped correctly.
              </p>
            </div>
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
                const isArchived = Boolean(u.deletedAt);
                const displayEmail = u.archivedEmail ?? u.email;
                const canManage = !isArchived && canManageUser(actor?.role, u.role);
                const canDelete = canManage && u.id !== actor?.id;
                const pending = isPendingInvite(u);
                const isResending =
                  resendInvite.isPending && resendInvite.variables === u.id;
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback>
                            {initials(u.name ?? displayEmail)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink-900">
                            {u.name ?? 'No name'}
                          </p>
                          <p className="truncate text-xs text-ink-500">{displayEmail}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.role === 'SUPER_ADMIN' ? 'navy' : 'default'}>
                        {ROLE_LABEL[u.role]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <p className="truncate text-sm text-ink-900">
                        {u.primaryOrganization?.name ?? (
                          <span className="text-ink-400">Unassigned</span>
                        )}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={isArchived ? 'default' : statusVariant(u.status)}>
                        {statusLabel(u)}
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
                        {pending && (
                          <Button
                            size="icon"
                            variant="ghost"
                            disabled={!canManage || isResending}
                            onClick={() => resendInvite.mutate(u.id)}
                            title="Resend invitation email"
                          >
                            {isResending ? (
                              <Spinner className="h-4 w-4 text-brand-primary" />
                            ) : (
                              <MailCheck className="h-4 w-4 text-brand-primary" />
                            )}
                          </Button>
                        )}
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
                        {actor?.role === 'SUPER_ADMIN' &&
                          u.id !== actor?.id &&
                          !isArchived && (
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={impersonate.isPending}
                              onClick={() => impersonate.mutate(u.id)}
                              title={`View as ${displayEmail}`}
                            >
                              <Eye className="h-4 w-4 text-ink-500" />
                            </Button>
                          )}
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={!canManage}
                          onClick={() => setLogoutAction(u)}
                          title="Force logout (revoke all sessions)"
                        >
                          <LogOut className="h-4 w-4 text-ink-500" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={!canDelete}
                          onClick={() => setDeleteAction(u)}
                          title={
                            u.id === actor?.id
                              ? 'You cannot delete your own account'
                              : 'Delete user'
                          }
                        >
                          <Trash2 className="h-4 w-4 text-danger" />
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
                        {pendingOnly ? (
                          <MailWarning className="h-5 w-5" />
                        ) : (
                          <UserRoundCheck className="h-5 w-5" />
                        )}
                      </div>
                      <p className="mt-3 text-sm font-semibold text-ink-900">
                        {pendingOnly
                          ? 'No pending invitations'
                          : 'No users match these filters'}
                      </p>
                      <p className="mt-1 text-sm text-ink-500">
                        {pendingOnly
                          ? 'Everyone has completed setup. Invite more people to get started.'
                          : 'Clear filters or create a new account for this workspace.'}
                      </p>
                      <div className="mt-4 flex flex-wrap justify-center gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => setBulkOpen(true)}
                        >
                          <Upload className="h-4 w-4" />
                          Invite users
                        </Button>
                      </div>
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
      <ConfirmationDialog
        open={!!deleteAction}
        onOpenChange={(open) => !open && setDeleteAction(null)}
        title="Delete this user?"
        description={`${deleteAction?.email ?? 'This user'} will lose access immediately. Their active license usage will be freed, while whiteboards, sessions, exports, billing, and audit history remain available for reporting.`}
        confirmLabel="Delete user"
        tone="danger"
        loading={deleteUser.isPending}
        onConfirm={() => {
          if (!deleteAction) return;
          deleteUser.mutate(deleteAction.id);
        }}
      />
      <ConfirmationDialog
        open={!!logoutAction}
        onOpenChange={(open) => !open && setLogoutAction(null)}
        title="Force logout this user?"
        description={`${logoutAction?.email ?? 'This user'} will be signed out of all devices immediately and must log in again. Their account and data are not affected.`}
        confirmLabel="Force logout"
        tone="warning"
        loading={forceLogout.isPending}
        onConfirm={() => {
          if (!logoutAction) return;
          forceLogout.mutate(logoutAction.id);
        }}
      />

      <Dialog
        open={bulkOpen}
        onOpenChange={(open) => {
          if (bulkInvite.isPending) return;
          if (!open) resetBulkDialog();
          else setBulkOpen(true);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bulk invite users</DialogTitle>
            <DialogDescription>
              Paste CSV rows or upload a .csv file with the header{' '}
              <code className="rounded bg-surface-variant px-1 py-0.5 text-xs text-ink-700">
                email,name,role[,organizationId]
              </code>
              . Roles must be one of: {ALL_USER_ROLES.join(', ')}.
            </DialogDescription>
          </DialogHeader>

          {bulkResult ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="success">
                  <CheckCircle2 className="h-3 w-3" />
                  {bulkResult.createdCount} created
                </Badge>
                {bulkResult.failedCount > 0 && (
                  <Badge variant="danger">
                    {bulkResult.failedCount} failed
                  </Badge>
                )}
              </div>
              <div className="max-h-72 overflow-auto rounded-lg border border-line">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bulkResult.results.map((row, index) => (
                      <TableRow key={`${row.email}-${index}`}>
                        <TableCell className="text-sm text-ink-900">
                          {row.email}
                        </TableCell>
                        <TableCell>
                          {row.status === 'created' ? (
                            <Badge variant="success">
                              <CheckCircle2 className="h-3 w-3" />
                              Created
                            </Badge>
                          ) : (
                            <Badge variant="danger" title={row.error}>
                              {row.error ?? 'Failed'}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBulkResult(null)}>
                  Invite more
                </Button>
                <Button variant="primary" onClick={resetBulkDialog}>
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                  CSV content
                </label>
                <textarea
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  rows={6}
                  placeholder={
                    'email,name,role,organizationId\njane@school.org,Jane Doe,TEACHER\njohn@school.org,John Roe,STUDENT'
                  }
                  className="flex w-full rounded-lg border border-line bg-white px-3.5 py-2.5 font-mono text-xs text-ink-900 shadow-sm placeholder:text-ink-400 transition focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => handleCsvFile(e.target.files?.[0])}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  Upload .csv
                </Button>
                {parsedInviteRows.length > 0 && (
                  <span className="text-xs text-ink-500">
                    {validInviteRows.length} valid
                    {invalidInviteCount > 0
                      ? `, ${invalidInviteCount} with issues`
                      : ''}
                  </span>
                )}
              </div>

              {parsedInviteRows.length > 0 && (
                <div className="max-h-64 overflow-auto rounded-lg border border-line">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedInviteRows.map((row) => (
                        <TableRow key={row.line}>
                          <TableCell className="text-sm text-ink-900">
                            {row.email || (
                              <span className="text-ink-400">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-ink-500">
                            {row.name ?? <span className="text-ink-400">—</span>}
                          </TableCell>
                          <TableCell className="text-sm text-ink-500">
                            {row.role ?? <span className="text-ink-400">—</span>}
                          </TableCell>
                          <TableCell>
                            {row.error ? (
                              <Badge variant="danger" title={row.error}>
                                {row.error}
                              </Badge>
                            ) : (
                              <Badge variant="success">
                                <CheckCircle2 className="h-3 w-3" />
                                Ready
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetBulkDialog}
                  disabled={bulkInvite.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={submitBulkInvite}
                  disabled={validInviteRows.length === 0 || bulkInvite.isPending}
                >
                  {bulkInvite.isPending ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Invite {validInviteRows.length || ''}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
