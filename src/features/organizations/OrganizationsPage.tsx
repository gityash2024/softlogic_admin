import { useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArchiveX,
  Building2,
  Image as ImageIcon,
  Pencil,
  Plus,
  Power,
  RotateCcw,
  Search,
  Sliders,
  Trash2,
  Upload,
  UsersRound,
} from 'lucide-react';
import { toast } from 'sonner';

import { organizationsApi } from '@/services/organizations.api';
import type { AdminExportFormat, AdminListQuery } from '@/services/admin-api';
import { extractApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { canCreateOrganizationKind } from '@/lib/role-access';
import {
  ORG_KIND_LABEL,
  type AdminOrganization,
  type OrganizationKind,
  type OrganizationStatus,
} from '@/types/api';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
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
import { AiSettingsDialog } from './AiSettingsDialog';

const PER_PAGE = 20;

function kindVariant(kind: OrganizationKind) {
  if (kind === 'INTERNAL') return 'navy' as const;
  if (kind === 'PARTNER') return 'purple' as const;
  return 'info' as const;
}

function organizationStatusLabel(organization: AdminOrganization) {
  if (organization.deletedAt) return 'Archived';
  return organization.status === 'ACTIVE' ? 'Active' : 'Inactive';
}

function hasAiSettings(org: AdminOrganization) {
  const ai = (org.settings as Record<string, unknown> | undefined)?.ai;
  return Boolean(ai && typeof ai === 'object' && Object.keys(ai).length > 0);
}

export function OrganizationsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { user: actor } = useAuthStore();
  const queryClient = useQueryClient();
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const [exporting, setExporting] = useState<AdminExportFormat | null>(null);
  const [aiTarget, setAiTarget] = useState<AdminOrganization | null>(null);
  const [logoRemoval, setLogoRemoval] = useState<AdminOrganization | null>(null);
  const [archiveAction, setArchiveAction] = useState<AdminOrganization | null>(null);
  const [statusAction, setStatusAction] = useState<{
    organization: AdminOrganization;
    status: OrganizationStatus;
  } | null>(null);

  const page = numberParam(params.get('page'), 1);
  const search = params.get('search') ?? '';
  const kind = params.get('kind') ?? 'ALL';
  const status = params.get('status') ?? 'ALL';
  const parentOrganizationId = params.get('parentOrganizationId') ?? 'ALL';
  const hasLogo = params.get('hasLogo') ?? 'ALL';
  const aiConfigured = params.get('aiConfigured') ?? 'ALL';
  const createdFrom = params.get('createdFrom') ?? '';
  const createdTo = params.get('createdTo') ?? '';
  const updatedFrom = params.get('updatedFrom') ?? '';
  const updatedTo = params.get('updatedTo') ?? '';

  const query = useMemo<AdminListQuery>(
    () => ({
      page,
      perPage: PER_PAGE,
      search,
      kind: cleanFilterValue(kind),
      status: cleanFilterValue(status),
      parentOrganizationId: cleanFilterValue(parentOrganizationId),
      hasLogo: hasLogo === 'ALL' ? undefined : hasLogo === 'true',
      aiConfigured: aiConfigured === 'ALL' ? undefined : aiConfigured === 'true',
      createdFrom,
      createdTo,
      updatedFrom,
      updatedTo,
      sortBy: params.get('sortBy') ?? 'name',
      sortOrder: params.get('sortOrder') ?? 'asc',
    }),
    [
      aiConfigured,
      createdFrom,
      createdTo,
      hasLogo,
      kind,
      page,
      params,
      parentOrganizationId,
      search,
      status,
      updatedFrom,
      updatedTo,
    ],
  );

  const organizationsQuery = useQuery({
    queryKey: ['organizations', query],
    queryFn: () => organizationsApi.list(query),
  });
  const allOrgsQuery = useQuery({
    queryKey: ['organizations', 'all'],
    queryFn: organizationsApi.all,
  });

  const organizations = organizationsQuery.data?.data ?? [];
  const meta = organizationsQuery.data?.meta;
  const activeCount = organizations.filter((org) => org.status === 'ACTIVE').length;
  const logoCount = organizations.filter((org) => Boolean(org.logoUrl)).length;
  const aiCount = organizations.filter(hasAiSettings).length;
  const customerCount = organizations.filter((org) => org.kind === 'CUSTOMER').length;
  const { canCreate } = canCreateOrganizationKind(actor?.role);

  const activeFilters = useMemo<FilterChip[]>(() => {
    const parent = allOrgsQuery.data?.find((org) => org.id === parentOrganizationId);
    return [
      search && { key: 'search', label: 'Search', value: search },
      kind !== 'ALL' && {
        key: 'kind',
        label: 'Kind',
        value: ORG_KIND_LABEL[kind as OrganizationKind] ?? kind,
      },
      status !== 'ALL' && { key: 'status', label: 'Status', value: status },
      parentOrganizationId !== 'ALL' && {
        key: 'parentOrganizationId',
        label: 'Parent',
        value: parent?.name ?? parentOrganizationId,
      },
      hasLogo !== 'ALL' && {
        key: 'hasLogo',
        label: 'Logo',
        value: hasLogo === 'true' ? 'Present' : 'Missing',
      },
      aiConfigured !== 'ALL' && {
        key: 'aiConfigured',
        label: 'AI',
        value: aiConfigured === 'true' ? 'Configured' : 'Missing',
      },
      createdFrom && { key: 'createdFrom', label: 'Created from', value: createdFrom },
      createdTo && { key: 'createdTo', label: 'Created to', value: createdTo },
      updatedFrom && { key: 'updatedFrom', label: 'Updated from', value: updatedFrom },
      updatedTo && { key: 'updatedTo', label: 'Updated to', value: updatedTo },
    ].filter(Boolean) as FilterChip[];
  }, [
    aiConfigured,
    allOrgsQuery.data,
    createdFrom,
    createdTo,
    hasLogo,
    kind,
    parentOrganizationId,
    search,
    status,
    updatedFrom,
    updatedTo,
  ]);

  const uploadLogo = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      organizationsApi.uploadLogo(id, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      toast.success('Logo updated');
    },
    onError: (err) => toast.error(extractApiError(err)),
  });

  const removeLogo = useMutation({
    mutationFn: (id: string) => organizationsApi.removeLogo(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      toast.success('Logo removed');
      setLogoRemoval(null);
    },
    onError: (err) => toast.error(extractApiError(err)),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, nextStatus }: { id: string; nextStatus: OrganizationStatus }) =>
      organizationsApi.update(id, { status: nextStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      toast.success('Organization status updated');
      setStatusAction(null);
    },
    onError: (err) => toast.error(extractApiError(err)),
  });

  const archiveOrganization = useMutation({
    mutationFn: (id: string) => organizationsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      toast.success('Organization archived and license usage released');
      setArchiveAction(null);
    },
    onError: (err) => toast.error(extractApiError(err)),
  });

  const handleExport = async (format: AdminExportFormat) => {
    setExporting(format);
    try {
      await organizationsApi.export(
        { ...query, page: undefined, perPage: undefined },
        format,
      );
      toast.success(`Organizations ${format.toUpperCase()} export started`);
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
          label="Matching orgs"
          value={meta?.total ?? 0}
          detail="All filters applied server-side"
          tone="blue"
        />
        <StatCard
          label="Active on page"
          value={activeCount}
          detail={`${customerCount} customer workspaces`}
          tone="green"
        />
        <StatCard
          label="Branded"
          value={logoCount}
          detail="Logo present on current page"
          tone="orange"
        />
        <StatCard
          label="AI configured"
          value={aiCount}
          detail="Current page organizations"
          tone="purple"
        />
      </div>

      <Card>
        <div className="flex flex-col gap-4 border-b border-line px-6 py-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink-900">Organizations</h2>
            <p className="text-sm text-ink-500">
              Manage partner hierarchy, customers, branding, status, and AI keys.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ExportButtons
              onExport={handleExport}
              disabled={organizationsQuery.isLoading}
              loading={Boolean(exporting)}
            />
            <Button
              variant="primary"
              disabled={!canCreate}
              onClick={() => navigate('/organizations/new')}
            >
              <Plus className="h-4 w-4" />
              Create organization
            </Button>
          </div>
        </div>

        <div className="space-y-3 px-6 py-4">
          <div className="grid gap-3 xl:grid-cols-[1fr_170px_170px_220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <Input
                placeholder="Search name, slug, kind"
                value={search}
                onChange={(e) =>
                  setSearchParam(params, setParams, 'search', e.target.value)
                }
                className="pl-9"
              />
            </div>
            <Select
              value={kind}
              onValueChange={(value) => setSearchParam(params, setParams, 'kind', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All kinds</SelectItem>
                <SelectItem value="INTERNAL">Internal</SelectItem>
                <SelectItem value="PARTNER">Partner</SelectItem>
                <SelectItem value="CUSTOMER">Customer</SelectItem>
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
                <SelectItem value="INACTIVE">Inactive</SelectItem>
                <SelectItem value="ARCHIVED">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={parentOrganizationId}
              onValueChange={(value) =>
                setSearchParam(params, setParams, 'parentOrganizationId', value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All parents</SelectItem>
                {allOrgsQuery.data
                  ?.filter((org) => org.kind === 'PARTNER')
                  .map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 lg:grid-cols-6">
            <Select
              value={hasLogo}
              onValueChange={(value) =>
                setSearchParam(params, setParams, 'hasLogo', value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Any logo</SelectItem>
                <SelectItem value="true">Logo present</SelectItem>
                <SelectItem value="false">No logo</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={aiConfigured}
              onValueChange={(value) =>
                setSearchParam(params, setParams, 'aiConfigured', value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Any AI state</SelectItem>
                <SelectItem value="true">AI configured</SelectItem>
                <SelectItem value="false">AI missing</SelectItem>
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
              value={updatedFrom}
              onChange={(e) =>
                setSearchParam(params, setParams, 'updatedFrom', e.target.value)
              }
              title="Updated from"
            />
            <Input
              type="date"
              value={updatedTo}
              onChange={(e) =>
                setSearchParam(params, setParams, 'updatedTo', e.target.value)
              }
              title="Updated to"
            />
          </div>

          <ActiveFilterChips
            filters={activeFilters}
            onRemove={(key) => setSearchParam(params, setParams, key, null)}
            onClearAll={() => clearSearchParams(params, setParams)}
          />
        </div>

        {organizationsQuery.isLoading ? (
          <div className="flex h-56 items-center justify-center">
            <Spinner className="h-6 w-6 text-brand-primary" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>AI</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations.map((org) => (
                <TableRow key={org.id}>
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-line bg-surface-variant">
                        {org.logoUrl ? (
                          <img
                            src={org.logoUrl}
                            alt={org.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Building2 className="h-5 w-5 text-ink-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink-900">
                          {org.name}
                        </p>
                        <p className="truncate text-xs text-ink-500">{org.slug}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={kindVariant(org.kind)}>
                      {ORG_KIND_LABEL[org.kind]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        org.deletedAt
                          ? 'default'
                          : org.status === 'ACTIVE'
                            ? 'success'
                            : 'warning'
                      }
                    >
                      {organizationStatusLabel(org)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-ink-900">
                      {org.subscriptions?.[0]?.planName ?? (
                        <span className="text-ink-400">-</span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-ink-700">
                      {org._count?.memberships ?? 0}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={hasAiSettings(org) ? 'success' : 'default'}>
                      {hasAiSettings(org) ? 'Configured' : 'Missing'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={Boolean(org.deletedAt)}
                        title={
                          org.status === 'ACTIVE'
                            ? 'Deactivate organization'
                            : 'Reactivate organization'
                        }
                        onClick={() =>
                          setStatusAction({
                            organization: org,
                            status: org.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                          })
                        }
                      >
                        {org.status === 'ACTIVE' ? (
                          <Power className="h-4 w-4 text-warning" />
                        ) : (
                          <RotateCcw className="h-4 w-4 text-success" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={Boolean(org.deletedAt)}
                        title="AI settings"
                        onClick={() => setAiTarget(org)}
                      >
                        <Sliders className="h-4 w-4 text-ink-500" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={Boolean(org.deletedAt)}
                        title="Upload logo"
                        onClick={() => fileInputs.current[org.id]?.click()}
                      >
                        <Upload className="h-4 w-4 text-brand-primary" />
                      </Button>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={(el) => {
                          fileInputs.current[org.id] = el;
                        }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadLogo.mutate({ id: org.id, file });
                          e.target.value = '';
                        }}
                      />
                      {org.logoUrl && (
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={Boolean(org.deletedAt)}
                          title="Remove logo"
                          onClick={() => setLogoRemoval(org)}
                        >
                          <Trash2 className="h-4 w-4 text-danger" />
                        </Button>
                      )}
                      {actor?.role === 'SUPER_ADMIN' && (
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={org.kind === 'INTERNAL' || Boolean(org.deletedAt)}
                          title={
                            org.deletedAt
                              ? 'Organization is already archived'
                              : org.kind === 'INTERNAL'
                              ? 'Internal SoftLogic organizations cannot be deleted'
                              : 'Delete organization'
                          }
                          onClick={() => setArchiveAction(org)}
                        >
                          <ArchiveX className="h-4 w-4 text-danger" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Open organization users"
                        onClick={() =>
                          navigate(
                            `/users?organizationId=${org.id}${
                              org.deletedAt ? '&status=ARCHIVED' : ''
                            }`,
                          )
                        }
                      >
                        <UsersRound className="h-4 w-4 text-brand-primary" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Edit organization"
                        onClick={() => navigate(`/organizations/${org.id}/edit`)}
                      >
                        <Pencil className="h-4 w-4 text-ink-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {organizations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-orange/10 text-brand-orange">
                        <ImageIcon className="h-5 w-5" />
                      </div>
                      <p className="mt-3 text-sm font-semibold text-ink-900">
                        No organizations match these filters
                      </p>
                      <p className="mt-1 text-sm text-ink-500">
                        Clear filters or create a new workspace in your managed scope.
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

      <AiSettingsDialog
        open={!!aiTarget}
        onOpenChange={(open) => !open && setAiTarget(null)}
        organization={aiTarget}
      />
      <ConfirmationDialog
        open={!!logoRemoval}
        onOpenChange={(open) => !open && setLogoRemoval(null)}
        title="Remove organization logo?"
        description={`${logoRemoval?.name ?? 'This organization'} will fall back to the default building icon until a new logo is uploaded.`}
        confirmLabel="Remove logo"
        tone="danger"
        loading={removeLogo.isPending}
        onConfirm={() => {
          if (logoRemoval) removeLogo.mutate(logoRemoval.id);
        }}
      />
      <ConfirmationDialog
        open={!!archiveAction}
        onOpenChange={(open) => !open && setArchiveAction(null)}
        title="Delete this organization?"
        description={`${archiveAction?.name ?? 'This organization'} will be archived. All organization users lose access, active/trial subscriptions are canceled, license usage is released, and hardware/storage/AI access is disabled. Billing, whiteboards, sessions, exports, and audit history stay preserved.`}
        confirmLabel="Delete organization"
        tone="danger"
        loading={archiveOrganization.isPending}
        onConfirm={() => {
          if (!archiveAction) return;
          archiveOrganization.mutate(archiveAction.id);
        }}
      />
      <ConfirmationDialog
        open={!!statusAction}
        onOpenChange={(open) => !open && setStatusAction(null)}
        title={
          statusAction?.status === 'INACTIVE'
            ? 'Deactivate organization?'
            : 'Reactivate organization?'
        }
        description={
          statusAction?.status === 'INACTIVE'
            ? `${statusAction.organization.name} will be marked inactive for admin visibility and reporting.`
            : `${statusAction?.organization.name ?? 'This organization'} will be restored to active status.`
        }
        confirmLabel={statusAction?.status === 'INACTIVE' ? 'Deactivate' : 'Reactivate'}
        tone={statusAction?.status === 'INACTIVE' ? 'warning' : 'success'}
        loading={updateStatus.isPending}
        onConfirm={() => {
          if (!statusAction) return;
          updateStatus.mutate({
            id: statusAction.organization.id,
            nextStatus: statusAction.status,
          });
        }}
      />
    </div>
  );
}
