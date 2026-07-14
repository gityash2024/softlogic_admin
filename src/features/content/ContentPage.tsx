import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileArchive,
  FileUp,
  MonitorPlay,
  Presentation,
  Search,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

import { contentApi } from '@/services/content.api';
import { organizationsApi } from '@/services/organizations.api';
import { usersApi } from '@/services/users.api';
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
import {
  CONTENT_IMPORT_STATUS_LABEL,
  EXPORT_STATUS_LABEL,
  LIVE_SESSION_STATUS_LABEL,
  type AdminCanvasRecord,
  type AdminContentImportRecord,
  type AdminExportRecord,
  type AdminLiveSessionRecord,
  type ContentImportStatus,
  type ExportFormat,
  type ExportStatus,
  type LiveSessionStatus,
  type UserRole,
} from '@/types/api';
import { BoardPreviewTile } from './WhiteboardPreview';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

type ContentTab = 'canvases' | 'live-sessions' | 'exports' | 'imports';

const PER_PAGE = 20;
const EXPORT_FORMATS: ExportFormat[] = ['PDF', 'PNG', 'JPG', 'SVG'];
const USER_ROLES: UserRole[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'PARTNER_ADMIN',
  'CUSTOMER_ADMIN',
  'TEACHER',
  'STUDENT',
  'PARENT',
];
const ROLE_LABEL: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  PARTNER_ADMIN: 'Partner Admin',
  CUSTOMER_ADMIN: 'Customer Admin',
  TEACHER: 'Teacher',
  STUDENT: 'Student',
  PARENT: 'Parent',
};

function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function compactPath(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.replace(/^https?:\/\//, '').replace(/^\/+/, '');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length <= 3) {
    return normalized.length > 48
      ? `${normalized.slice(0, 18)}...${normalized.slice(-24)}`
      : normalized;
  }
  return `${parts[0]}/.../${parts.slice(-2).join('/')}`;
}

function liveStatusVariant(status: LiveSessionStatus) {
  if (status === 'LIVE') return 'success' as const;
  if (status === 'SCHEDULED') return 'info' as const;
  if (status === 'CANCELLED') return 'danger' as const;
  return 'default' as const;
}

function exportStatusVariant(status: ExportStatus) {
  if (status === 'COMPLETED') return 'success' as const;
  if (status === 'FAILED') return 'danger' as const;
  if (status === 'PROCESSING') return 'info' as const;
  return 'warning' as const;
}

function importStatusVariant(status: ContentImportStatus) {
  if (status === 'CONVERTED') return 'success' as const;
  if (status === 'FAILED') return 'danger' as const;
  if (status === 'PROCESSING') return 'info' as const;
  return 'warning' as const;
}

function PreviewTile({
  thumbnail,
  icon,
}: {
  thumbnail?: string | null;
  icon: 'canvas' | 'session' | 'export';
}) {
  const Icon =
    icon === 'canvas' ? Presentation : icon === 'session' ? MonitorPlay : FileArchive;
  return (
    <div className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-surface-variant">
      {thumbnail ? (
        <img src={thumbnail} alt="" className="h-full w-full object-cover" />
      ) : (
        <Icon className="h-5 w-5 text-ink-400" />
      )}
    </div>
  );
}

export function ContentPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { user: actor } = useAuthStore();
  const [exporting, setExporting] = useState<AdminExportFormat | null>(null);
  const [selectedCanvasId, setSelectedCanvasId] = useState<string | null>(null);
  const [fileActionId, setFileActionId] = useState<string | null>(null);
  const isSuperAdmin = actor?.role === 'SUPER_ADMIN';
  const requestedTab = params.get('tab') as ContentTab | null;
  const tab: ContentTab =
    requestedTab === 'live-sessions' || requestedTab === 'exports' || requestedTab === 'imports'
      ? requestedTab
      : 'canvases';

  const page = numberParam(params.get('page'), 1);
  const search = params.get('search') ?? '';
  const partnerOrganizationId = params.get('partnerOrganizationId') ?? ALL_PARTNERS_VALUE;
  const organizationId = params.get('organizationId') ?? 'ALL';
  const userId = params.get('userId') ?? 'ALL';
  const role = params.get('role') ?? 'ALL';
  const status = params.get('status') ?? 'ALL';
  const format = params.get('format') ?? 'ALL';
  const createdFrom = params.get('createdFrom') ?? '';
  const createdTo = params.get('createdTo') ?? '';
  const updatedFrom = params.get('updatedFrom') ?? '';
  const updatedTo = params.get('updatedTo') ?? '';
  const completedFrom = params.get('completedFrom') ?? '';
  const completedTo = params.get('completedTo') ?? '';
  const convertedFrom = params.get('convertedFrom') ?? '';
  const convertedTo = params.get('convertedTo') ?? '';
  const startedFrom = params.get('startedFrom') ?? '';
  const startedTo = params.get('startedTo') ?? '';

  useEffect(() => {
    if (!params.has('isPublic') && !params.has('hasThumbnail')) return;
    const next = new URLSearchParams(params);
    next.delete('isPublic');
    next.delete('hasThumbnail');
    setParams(next, { replace: true });
  }, [params, setParams]);

  const commonQuery = useMemo<AdminListQuery>(
    () => ({
      page,
      perPage: PER_PAGE,
      search,
      partnerOrganizationId: cleanFilterValue(partnerOrganizationId),
      organizationId: cleanFilterValue(organizationId),
      userId: cleanFilterValue(userId),
      role: cleanFilterValue(role),
      createdFrom,
      createdTo,
    }),
    [createdFrom, createdTo, organizationId, page, partnerOrganizationId, role, search, userId],
  );

  const canvasQuery = useMemo<AdminListQuery>(
    () => ({
      ...commonQuery,
      updatedFrom,
      updatedTo,
      sortBy: params.get('sortBy') ?? 'updatedAt',
      sortOrder: params.get('sortOrder') ?? 'desc',
    }),
    [commonQuery, params, updatedFrom, updatedTo],
  );
  const liveQuery = useMemo<AdminListQuery>(
    () => ({
      ...commonQuery,
      status: cleanFilterValue(status),
      startedFrom,
      startedTo,
      sortBy: params.get('sortBy') ?? 'createdAt',
      sortOrder: params.get('sortOrder') ?? 'desc',
    }),
    [commonQuery, params, startedFrom, startedTo, status],
  );
  const exportsQueryObject = useMemo<AdminListQuery>(
    () => ({
      ...commonQuery,
      status: cleanFilterValue(status),
      format: cleanFilterValue(format),
      completedFrom,
      completedTo,
      sortBy: params.get('sortBy') ?? 'createdAt',
      sortOrder: params.get('sortOrder') ?? 'desc',
    }),
    [commonQuery, completedFrom, completedTo, format, params, status],
  );
  const importsQueryObject = useMemo<AdminListQuery>(
    () => ({
      ...commonQuery,
      status: cleanFilterValue(status),
      convertedFrom,
      convertedTo,
      sortBy: params.get('sortBy') ?? 'createdAt',
      sortOrder: params.get('sortOrder') ?? 'desc',
    }),
    [commonQuery, convertedFrom, convertedTo, params, status],
  );

  const canvasesQuery = useQuery({
    queryKey: ['content', 'canvases', canvasQuery],
    queryFn: () => contentApi.canvases.list(canvasQuery),
    enabled: tab === 'canvases',
  });
  const liveSessionsQuery = useQuery({
    queryKey: ['content', 'live-sessions', liveQuery],
    queryFn: () => contentApi.liveSessions.list(liveQuery),
    enabled: tab === 'live-sessions',
  });
  const exportRecordsQuery = useQuery({
    queryKey: ['content', 'exports', exportsQueryObject],
    queryFn: () => contentApi.exports.list(exportsQueryObject),
    enabled: tab === 'exports',
  });
  const importRecordsQuery = useQuery({
    queryKey: ['content', 'imports', importsQueryObject],
    queryFn: () => contentApi.imports.list(importsQueryObject),
    enabled: tab === 'imports',
  });
  const canvasesCountQuery = useQuery({
    queryKey: ['content', 'canvases-count', commonQuery],
    queryFn: () => contentApi.canvases.list({ ...commonQuery, page: 1, perPage: 1 }),
  });
  const liveSessionsCountQuery = useQuery({
    queryKey: ['content', 'live-sessions-count', commonQuery],
    queryFn: () => contentApi.liveSessions.list({ ...commonQuery, page: 1, perPage: 1 }),
  });
  const exportsCountQuery = useQuery({
    queryKey: ['content', 'exports-count', commonQuery],
    queryFn: () => contentApi.exports.list({ ...commonQuery, page: 1, perPage: 1 }),
  });
  const importsCountQuery = useQuery({
    queryKey: ['content', 'imports-count', commonQuery],
    queryFn: () => contentApi.imports.list({ ...commonQuery, page: 1, perPage: 1 }),
  });
  const orgsQuery = useQuery({
    queryKey: ['organizations', 'all'],
    queryFn: organizationsApi.all,
  });
  const usersQuery = useQuery({
    queryKey: ['users', 'all'],
    queryFn: usersApi.all,
  });
  const canvasPreviewQuery = useQuery({
    queryKey: ['content', 'canvas-preview', selectedCanvasId],
    queryFn: () => contentApi.canvases.get(selectedCanvasId as string),
    enabled: Boolean(selectedCanvasId),
  });

  const currentQuery =
    tab === 'canvases'
      ? canvasQuery
      : tab === 'live-sessions'
        ? liveQuery
        : tab === 'exports'
          ? exportsQueryObject
          : importsQueryObject;
  const currentMeta =
    tab === 'canvases'
      ? canvasesQuery.data?.meta
      : tab === 'live-sessions'
        ? liveSessionsQuery.data?.meta
        : tab === 'exports'
          ? exportRecordsQuery.data?.meta
          : importRecordsQuery.data?.meta;
  const currentLoading =
    tab === 'canvases'
      ? canvasesQuery.isLoading
      : tab === 'live-sessions'
        ? liveSessionsQuery.isLoading
        : tab === 'exports'
          ? exportRecordsQuery.isLoading
          : importRecordsQuery.isLoading;

  const canvasRows = canvasesQuery.data?.data ?? [];
  const liveRows = liveSessionsQuery.data?.data ?? [];
  const exportRows = exportRecordsQuery.data?.data ?? [];
  const importRows = importRecordsQuery.data?.data ?? [];
  const allOrganizations = orgsQuery.data ?? [];
  const partners = partnerOrganizations(allOrganizations);
  const organizationOptions = organizationsForPartner(allOrganizations, partnerOrganizationId);
  const selectedCanvas =
    canvasPreviewQuery.data ??
    canvasRows.find((canvas) => canvas.id === selectedCanvasId) ??
    null;

  const activeFilters = useMemo<FilterChip[]>(() => {
    const partner = partners.find((item) => item.id === partnerOrganizationId);
    const org = orgsQuery.data?.find((item) => item.id === organizationId);
    const selectedUser = usersQuery.data?.find((item) => item.id === userId);
    return [
      search && { key: 'search', label: 'Search', value: search },
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
      role !== 'ALL' && {
        key: 'role',
        label: 'Role',
        value: ROLE_LABEL[role as UserRole] ?? role,
      },
      tab !== 'canvases' &&
        status !== 'ALL' && { key: 'status', label: 'Status', value: status },
      tab === 'exports' &&
        format !== 'ALL' && { key: 'format', label: 'Format', value: format },
      createdFrom && { key: 'createdFrom', label: 'Created from', value: createdFrom },
      createdTo && { key: 'createdTo', label: 'Created to', value: createdTo },
      updatedFrom && { key: 'updatedFrom', label: 'Updated from', value: updatedFrom },
      updatedTo && { key: 'updatedTo', label: 'Updated to', value: updatedTo },
      startedFrom && { key: 'startedFrom', label: 'Started from', value: startedFrom },
      startedTo && { key: 'startedTo', label: 'Started to', value: startedTo },
      completedFrom && {
        key: 'completedFrom',
        label: 'Completed from',
        value: completedFrom,
      },
      completedTo && {
        key: 'completedTo',
        label: 'Completed to',
        value: completedTo,
      },
      convertedFrom && {
        key: 'convertedFrom',
        label: 'Converted from',
        value: convertedFrom,
      },
      convertedTo && {
        key: 'convertedTo',
        label: 'Converted to',
        value: convertedTo,
      },
    ].filter(Boolean) as FilterChip[];
  }, [
    completedFrom,
    completedTo,
    convertedFrom,
    convertedTo,
    createdFrom,
    createdTo,
    format,
    isSuperAdmin,
    organizationId,
    orgsQuery.data,
    partnerOrganizationId,
    partners,
    role,
    search,
    startedFrom,
    startedTo,
    status,
    tab,
    updatedFrom,
    updatedTo,
    userId,
    usersQuery.data,
  ]);

  const setTab = (nextTab: ContentTab) => {
    const next = new URLSearchParams(params);
    next.set('tab', nextTab);
    next.delete('page');
    next.delete('status');
    next.delete('format');
    next.delete('isPublic');
    next.delete('hasThumbnail');
    next.delete('updatedFrom');
    next.delete('updatedTo');
    next.delete('startedFrom');
    next.delete('startedTo');
    next.delete('completedFrom');
    next.delete('completedTo');
    next.delete('convertedFrom');
    next.delete('convertedTo');
    setParams(next, { replace: true });
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

  const handleExport = async (exportFormat: AdminExportFormat) => {
    setExporting(exportFormat);
    try {
      const payload = { ...currentQuery, page: undefined, perPage: undefined };
      if (tab === 'canvases') await contentApi.canvases.export(payload, exportFormat);
      if (tab === 'live-sessions') {
        await contentApi.liveSessions.export(payload, exportFormat);
      }
      if (tab === 'exports') await contentApi.exports.export(payload, exportFormat);
      if (tab === 'imports') await contentApi.imports.export(payload, exportFormat);
      toast.success(`Content ${exportFormat.toUpperCase()} export started`);
    } catch (error) {
      toast.error(extractApiError(error));
    } finally {
      setExporting(null);
    }
  };

  const handleOpenExportFile = async (record: AdminExportRecord) => {
    setFileActionId(`export-open-${record.id}`);
    try {
      await contentApi.exports.openFile(record.id);
    } catch (error) {
      toast.error(extractApiError(error));
    } finally {
      setFileActionId(null);
    }
  };

  const handleDownloadExportFile = async (record: AdminExportRecord) => {
    setFileActionId(`export-download-${record.id}`);
    try {
      await contentApi.exports.downloadFile(record.id);
    } catch (error) {
      toast.error(extractApiError(error));
    } finally {
      setFileActionId(null);
    }
  };

  const handleOpenImportFile = async (record: AdminContentImportRecord) => {
    setFileActionId(`import-open-${record.id}`);
    try {
      await contentApi.imports.openFile(record.id);
    } catch (error) {
      toast.error(extractApiError(error));
    } finally {
      setFileActionId(null);
    }
  };

  const handleDownloadImportFile = async (record: AdminContentImportRecord) => {
    setFileActionId(`import-download-${record.id}`);
    try {
      await contentApi.imports.downloadFile(record.id);
    } catch (error) {
      toast.error(extractApiError(error));
    } finally {
      setFileActionId(null);
    }
  };

  return (
    <div data-tour="tour-content-section" className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard
          label="Canvases"
          value={canvasesCountQuery.data?.meta?.total ?? (tab === 'canvases' ? currentMeta?.total ?? 0 : 0)}
          detail="Whiteboard files and slide counts"
          tone="blue"
        />
        <StatCard
          label="Live sessions"
          value={liveSessionsCountQuery.data?.meta?.total ?? (tab === 'live-sessions' ? currentMeta?.total ?? 0 : 0)}
          detail="Hosts, participants, messages"
          tone="green"
        />
        <StatCard
          label="Export records"
          value={exportsCountQuery.data?.meta?.total ?? (tab === 'exports' ? currentMeta?.total ?? 0 : 0)}
          detail="Files, formats, completion states"
          tone="orange"
        />
        <StatCard
          label="Import records"
          value={importsCountQuery.data?.meta?.total ?? (tab === 'imports' ? currentMeta?.total ?? 0 : 0)}
          detail="Uploaded PDFs and PowerPoints"
          tone="blue"
        />
      </div>

      <Card>
        <div className="flex flex-col gap-4 border-b border-line px-4 py-5 sm:px-6 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink-900">Content Operations</h2>
            <p className="text-sm text-ink-500">
              Read-only visibility into canvases, live sessions, and generated exports.
            </p>
          </div>
          <ExportButtons
            onExport={handleExport}
            disabled={currentLoading}
            loading={Boolean(exporting)}
          />
        </div>

        <Tabs value={tab} onValueChange={(value) => setTab(value as ContentTab)}>
          <div className="flex flex-col gap-4 px-4 py-4 sm:px-6">
            <TabsList className="w-fit">
              <TabsTrigger value="canvases">
                <Presentation className="h-4 w-4" />
                Canvases
              </TabsTrigger>
              <TabsTrigger value="live-sessions">
                <MonitorPlay className="h-4 w-4" />
                Live Sessions
              </TabsTrigger>
              <TabsTrigger value="exports">
                <FileArchive className="h-4 w-4" />
                Exports
              </TabsTrigger>
              <TabsTrigger value="imports">
                <FileUp className="h-4 w-4" />
                Imports
              </TabsTrigger>
            </TabsList>

            <div
              className={`grid gap-3 ${
                isSuperAdmin
                  ? 'xl:grid-cols-[1fr_220px_220px_220px_220px]'
                  : 'xl:grid-cols-[1fr_220px_220px_220px]'
              }`}
            >
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <Input
                  placeholder="Search content, owner, organization"
                  value={search}
                  onChange={(e) =>
                    setSearchParam(params, setParams, 'search', e.target.value)
                  }
                  className="pl-9"
                />
              </div>
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
              <Select
                value={userId}
                onValueChange={(value) =>
                  setSearchParam(params, setParams, 'userId', value)
                }
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
              <Select
                value={role}
                onValueChange={(value) =>
                  setSearchParam(params, setParams, 'role', value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All roles</SelectItem>
                  {USER_ROLES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {ROLE_LABEL[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {tab === 'canvases' && (
              <div className="grid gap-3 lg:grid-cols-4">
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
            )}

            {tab === 'live-sessions' && (
              <div className="grid gap-3 lg:grid-cols-5">
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
                    {Object.entries(LIVE_SESSION_STATUS_LABEL).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
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
                  value={startedFrom}
                  onChange={(e) =>
                    setSearchParam(params, setParams, 'startedFrom', e.target.value)
                  }
                  title="Started from"
                />
                <Input
                  type="date"
                  value={startedTo}
                  onChange={(e) =>
                    setSearchParam(params, setParams, 'startedTo', e.target.value)
                  }
                  title="Started to"
                />
              </div>
            )}

            {tab === 'exports' && (
              <div className="grid gap-3 lg:grid-cols-6">
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
                    {Object.entries(EXPORT_STATUS_LABEL).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={format}
                  onValueChange={(value) =>
                    setSearchParam(params, setParams, 'format', value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All formats</SelectItem>
                    {EXPORT_FORMATS.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
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
                  value={completedFrom}
                  onChange={(e) =>
                    setSearchParam(params, setParams, 'completedFrom', e.target.value)
                  }
                  title="Completed from"
                />
                <Input
                  type="date"
                  value={completedTo}
                  onChange={(e) =>
                    setSearchParam(params, setParams, 'completedTo', e.target.value)
                  }
                  title="Completed to"
                />
              </div>
            )}

            {tab === 'imports' && (
              <div className="grid gap-3 lg:grid-cols-5">
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
                    {Object.entries(CONTENT_IMPORT_STATUS_LABEL).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
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
                  value={convertedFrom}
                  onChange={(e) =>
                    setSearchParam(params, setParams, 'convertedFrom', e.target.value)
                  }
                  title="Converted from"
                />
                <Input
                  type="date"
                  value={convertedTo}
                  onChange={(e) =>
                    setSearchParam(params, setParams, 'convertedTo', e.target.value)
                  }
                  title="Converted to"
                />
              </div>
            )}

            <ActiveFilterChips
              filters={activeFilters}
              onRemove={(key) => setSearchParam(params, setParams, key, null)}
              onClearAll={() => clearSearchParams(params, setParams, ['tab'])}
            />
          </div>

          <TabsContent value="canvases" className="mt-0">
            <CanvasTable
              rows={canvasRows}
              loading={canvasesQuery.isLoading}
              onOpenPreview={setSelectedCanvasId}
            />
          </TabsContent>
          <TabsContent value="live-sessions" className="mt-0">
            <LiveSessionsTable
              rows={liveRows}
              loading={liveSessionsQuery.isLoading}
              onOpenSession={(sessionId) =>
                navigate(`/content/live-sessions/${sessionId}`)
              }
            />
          </TabsContent>
          <TabsContent value="exports" className="mt-0">
            <ExportsTable
              rows={exportRows}
              loading={exportRecordsQuery.isLoading}
              fileActionId={fileActionId}
              onOpenFile={handleOpenExportFile}
              onDownloadFile={handleDownloadExportFile}
            />
          </TabsContent>
          <TabsContent value="imports" className="mt-0">
            <ImportsTable
              rows={importRows}
              loading={importRecordsQuery.isLoading}
              fileActionId={fileActionId}
              onOpenFile={handleOpenImportFile}
              onDownloadFile={handleDownloadImportFile}
            />
          </TabsContent>
        </Tabs>

        <PaginationFooter
          meta={currentMeta}
          onPageChange={(nextPage) =>
            setSearchParam(params, setParams, 'page', nextPage)
          }
        />
      </Card>
      <CanvasPreviewDialog
        open={Boolean(selectedCanvasId)}
        canvas={selectedCanvas}
        loading={canvasPreviewQuery.isLoading || canvasPreviewQuery.isFetching}
        error={canvasPreviewQuery.error}
        onOpenChange={(open) => {
          if (!open) setSelectedCanvasId(null);
        }}
      />
    </div>
  );
}

function CanvasTable({
  rows,
  loading,
  onOpenPreview,
}: {
  rows: AdminCanvasRecord[];
  loading: boolean;
  onOpenPreview: (canvasId: string) => void;
}) {
  if (loading) return <TableLoading />;
  return (
    <Table className="w-full">
      <TableHeader>
        <TableRow>
          <TableHead>Canvas</TableHead>
          <TableHead>Owner</TableHead>
          <TableHead>Organization</TableHead>
          <TableHead>Visibility</TableHead>
          <TableHead>Content</TableHead>
          <TableHead>Updated</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((canvas) => (
          <TableRow
            key={canvas.id}
            role="button"
            tabIndex={0}
            className="cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            onClick={() => onOpenPreview(canvas.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onOpenPreview(canvas.id);
              }
            }}
          >
            <TableCell className="min-w-0">
              <div className="flex min-w-0 items-center gap-3">
                <div className="w-24 shrink-0">
                  <BoardPreviewTile
                    title={canvas.name}
                    thumbnail={canvas.thumbnail}
                    slide={canvas.slides?.[0] ?? null}
                    pageCount={canvas._count.slides}
                    compact
                  />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-900">
                    {canvas.name}
                  </p>
                  <p className="truncate text-xs text-ink-500">
                    {canvas.description ?? canvas.id}
                  </p>
                </div>
              </div>
            </TableCell>
            <TableCell className="min-w-0">
              <UserCell
                name={canvas.user?.name}
                email={canvas.user?.email}
                role={canvas.user?.role}
              />
            </TableCell>
            <TableCell>
              <p className="truncate text-sm text-ink-700">
                {canvas.organization?.name ?? '-'}
              </p>
            </TableCell>
            <TableCell className="whitespace-nowrap">
              <Badge variant={canvas.isPublic ? 'info' : 'default'}>
                {canvas.isPublic ? 'Public' : 'Private'}
              </Badge>
            </TableCell>
            <TableCell>
              <div className="text-xs leading-5 text-ink-500">
                {canvas._count.slides} slides, {canvas._count.liveSessions} sessions,{' '}
                {canvas._count.exports} exports
              </div>
            </TableCell>
            <TableCell className="whitespace-nowrap">
              <p className="text-xs leading-5 text-ink-500">
                {formatDateTime(canvas.updatedAt)}
              </p>
            </TableCell>
          </TableRow>
        ))}
        {rows.length === 0 && <EmptyContentRow colSpan={6} />}
      </TableBody>
    </Table>
  );
}

function CanvasPreviewDialog({
  open,
  canvas,
  loading,
  error,
  onOpenChange,
}: {
  open: boolean;
  canvas: AdminCanvasRecord | null;
  loading: boolean;
  error: unknown;
  onOpenChange: (open: boolean) => void;
}) {
  const slides = useMemo(
    () => [...(canvas?.slides ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [canvas?.slides],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const totalPages = canvas?._count.slides ?? slides.length;
  const activeSlide = slides[activeIndex] ?? null;
  const activeTitle =
    activeSlide?.title ?? activeSlide?.name ?? `Page ${Math.min(activeIndex + 1, Math.max(totalPages, 1))}`;

  useEffect(() => {
    setActiveIndex(0);
  }, [canvas?.id]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        setActiveIndex((index) => Math.max(0, index - 1));
      }
      if (event.key === 'ArrowRight') {
        setActiveIndex((index) => Math.min(Math.max(slides.length - 1, 0), index + 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, slides.length]);

  const canNavigate = slides.length > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-[1180px] gap-0 overflow-hidden p-0 sm:w-[calc(100vw-2rem)]">
        <DialogHeader className="border-b border-line px-5 py-4 pr-12">
          <DialogTitle>{canvas?.name ?? 'Canvas preview'}</DialogTitle>
          <DialogDescription>
            {totalPages} page{totalPages === 1 ? '' : 's'}
            {canvas?.organization?.name ? ` - ${canvas.organization.name}` : ''}
            {loading ? ' - Loading full board...' : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[calc(100dvh-9rem)] min-h-[420px] gap-4 overflow-y-auto p-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="min-w-0">
            <div className="relative flex min-h-[300px] items-center justify-center overflow-hidden rounded-xl border border-line bg-surface-variant p-3">
              {loading && !canvas ? (
                <Spinner className="h-8 w-8 text-brand-primary" />
              ) : error ? (
                <div className="px-6 text-center text-sm text-danger">
                  {extractApiError(error)}
                </div>
              ) : activeSlide ? (
                <div className="w-full max-w-[900px]">
                  <BoardPreviewTile
                    title={activeTitle}
                    thumbnail={activeSlide.thumbnail ?? null}
                    slide={activeSlide}
                  />
                </div>
              ) : (
                <div className="px-6 text-center text-sm text-ink-500">
                  No preview pages are available for this canvas.
                </div>
              )}

              {canNavigate && (
                <>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white shadow-sm"
                    disabled={activeIndex === 0}
                    title="Previous page"
                    onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white shadow-sm"
                    disabled={activeIndex >= slides.length - 1}
                    title="Next page"
                    onClick={() =>
                      setActiveIndex((index) => Math.min(slides.length - 1, index + 1))
                    }
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 text-sm text-ink-500">
              <span className="truncate font-medium text-ink-800">{activeTitle}</span>
              <span className="shrink-0">
                Page {slides.length ? activeIndex + 1 : 0} of {slides.length}
              </span>
            </div>
          </div>

          <div className="min-w-0">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
              Pages
            </p>
            <div className="flex gap-2 overflow-x-auto pb-2 lg:max-h-[60vh] lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:pr-1">
              {slides.map((slide, index) => {
                const title = slide.title ?? slide.name ?? `Page ${index + 1}`;
                return (
                  <button
                    key={slide.id}
                    type="button"
                    className={`w-32 shrink-0 rounded-lg border bg-white p-1 text-left transition lg:w-full ${
                      index === activeIndex
                        ? 'border-brand-primary ring-2 ring-brand-primary/20'
                        : 'border-line hover:border-brand-primary/50'
                    }`}
                    onClick={() => setActiveIndex(index)}
                    title={title}
                  >
                    <BoardPreviewTile
                      title={title}
                      thumbnail={slide.thumbnail ?? null}
                      slide={slide}
                      compact
                    />
                    <p className="mt-1 truncate px-1 text-[11px] font-medium text-ink-600">
                      Page {index + 1}
                    </p>
                  </button>
                );
              })}
              {!loading && slides.length === 0 && (
                <div className="rounded-lg border border-dashed border-line p-4 text-sm text-ink-500">
                  No pages found.
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LiveSessionsTable({
  rows,
  loading,
  onOpenSession,
}: {
  rows: AdminLiveSessionRecord[];
  loading: boolean;
  onOpenSession: (sessionId: string) => void;
}) {
  if (loading) return <TableLoading />;
  return (
    <Table className="w-full">
      <TableHeader>
        <TableRow>
          <TableHead>Session</TableHead>
          <TableHead>Host</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Engagement</TableHead>
          <TableHead>AI output</TableHead>
          <TableHead>Started</TableHead>
          <TableHead>Ended</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((session) => (
          <TableRow
            key={session.id}
            role="button"
            tabIndex={0}
            className="cursor-pointer transition-colors hover:bg-brand-primary/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary"
            onClick={() => onOpenSession(session.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onOpenSession(session.id);
              }
            }}
          >
            <TableCell className="min-w-0">
              <div className="flex min-w-0 items-center gap-3">
                <PreviewTile thumbnail={session.canvas?.thumbnail} icon="session" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-900">
                    {session.title ?? session.canvas?.name ?? 'Live session'}
                  </p>
                  <p className="truncate text-xs text-ink-500">
                    {session.organization?.name ?? session.canvas?.name ?? session.id}
                  </p>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <UserCell
                name={session.host?.name ?? session.createdBy?.name}
                email={session.host?.email ?? session.createdBy?.email}
                role={session.host?.role ?? session.createdBy?.role}
              />
            </TableCell>
            <TableCell className="whitespace-nowrap">
              <Badge variant={liveStatusVariant(session.status)}>
                {LIVE_SESSION_STATUS_LABEL[session.status]}
              </Badge>
            </TableCell>
            <TableCell>
              <div className="text-xs leading-5 text-ink-500">
                {session._count.participants} participants,{' '}
                {session._count.messages} messages, {session._count.mediaAssets} media
              </div>
            </TableCell>
            <TableCell className="whitespace-nowrap">
              {session.events?.[0] ? (
                <div className="space-y-1">
                  <Badge variant="info">
                    <Sparkles className="h-3 w-3" />
                    Notes ready
                  </Badge>
                  <p className="text-[11px] text-ink-500">
                    {formatDateTime(session.events[0].createdAt)}
                  </p>
                </div>
              ) : (
                <span className="text-xs text-ink-400">Not generated</span>
              )}
            </TableCell>
            <TableCell className="whitespace-nowrap">
              <p className="text-xs leading-5 text-ink-500">
                {formatDateTime(session.startedAt)}
              </p>
            </TableCell>
            <TableCell className="whitespace-nowrap">
              <p className="text-xs leading-5 text-ink-500">
                {formatDateTime(session.endedAt)}
              </p>
            </TableCell>
          </TableRow>
        ))}
        {rows.length === 0 && <EmptyContentRow colSpan={7} />}
      </TableBody>
    </Table>
  );
}

function ExportsTable({
  rows,
  loading,
  fileActionId,
  onOpenFile,
  onDownloadFile,
}: {
  rows: AdminExportRecord[];
  loading: boolean;
  fileActionId: string | null;
  onOpenFile: (record: AdminExportRecord) => void;
  onDownloadFile: (record: AdminExportRecord) => void;
}) {
  if (loading) return <TableLoading />;
  return (
    <Table className="w-full min-w-0 table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[34%]">Export</TableHead>
          <TableHead className="w-[20%]">User</TableHead>
          <TableHead className="w-[8%]">Format</TableHead>
          <TableHead className="w-[10%]">Status</TableHead>
          <TableHead className="w-[8%]">Size</TableHead>
          <TableHead className="w-[12%]">Completed</TableHead>
          <TableHead className="w-[8%] text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((record) => {
          const pathLabel = compactPath(record.storageKey ?? record.fileUrl);
          const hasFile = Boolean(record.storageKey);
          const openActionId = `export-open-${record.id}`;
          const downloadActionId = `export-download-${record.id}`;
          return (
            <TableRow key={record.id}>
              <TableCell className="min-w-0">
                <div className="flex min-w-0 items-center gap-3">
                  <PreviewTile thumbnail={record.canvas?.thumbnail} icon="export" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-900">
                      {record.canvas?.name ?? 'Canvas export'}
                    </p>
                    <p
                      className="truncate text-xs text-ink-500"
                      title={record.fileName ?? undefined}
                    >
                      {record.fileName ?? record.canvas?.organization?.name ?? record.id}
                    </p>
                    {pathLabel && (
                      <p
                        className="truncate text-[11px] text-ink-400"
                        title={record.storageKey ?? record.fileUrl ?? undefined}
                      >
                        {pathLabel}
                      </p>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell className="min-w-0">
                <UserCell
                  name={record.user?.name}
                  email={record.user?.email}
                  role={record.user?.role}
                />
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <Badge variant="default">{record.format}</Badge>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <Badge variant={exportStatusVariant(record.status)}>
                  {EXPORT_STATUS_LABEL[record.status]}
                </Badge>
              </TableCell>
              <TableCell>
                <p className="text-sm text-ink-700">{formatBytes(record.fileSize)}</p>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <p className="text-xs leading-5 text-ink-500">
                  {formatDateTime(record.completedAt)}
                </p>
              </TableCell>
              <TableCell className="text-right whitespace-nowrap">
                <div className="flex justify-end gap-1 whitespace-nowrap">
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={!hasFile || Boolean(fileActionId)}
                    title="Open export"
                    onClick={() => onOpenFile(record)}
                  >
                    {fileActionId === openActionId ? (
                      <Spinner className="h-4 w-4 text-brand-primary" />
                    ) : (
                      <Eye className={`h-4 w-4 ${hasFile ? 'text-brand-primary' : 'text-ink-300'}`} />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={!hasFile || Boolean(fileActionId)}
                    title="Download export"
                    onClick={() => onDownloadFile(record)}
                  >
                    {fileActionId === downloadActionId ? (
                      <Spinner className="h-4 w-4 text-brand-orange" />
                    ) : (
                      <Download className={`h-4 w-4 ${hasFile ? 'text-brand-orange' : 'text-ink-300'}`} />
                    )}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
        {rows.length === 0 && <EmptyContentRow colSpan={7} />}
      </TableBody>
    </Table>
  );
}

function ImportsTable({
  rows,
  loading,
  fileActionId,
  onOpenFile,
  onDownloadFile,
}: {
  rows: AdminContentImportRecord[];
  loading: boolean;
  fileActionId: string | null;
  onOpenFile: (record: AdminContentImportRecord) => void;
  onDownloadFile: (record: AdminContentImportRecord) => void;
}) {
  if (loading) return <TableLoading />;
  return (
    <Table className="w-full min-w-0 table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[34%]">Import</TableHead>
          <TableHead className="w-[19%]">User</TableHead>
          <TableHead className="w-[11%]">Status</TableHead>
          <TableHead className="w-[8%]">Size</TableHead>
          <TableHead className="w-[10%]">Created</TableHead>
          <TableHead className="w-[10%]">Converted</TableHead>
          <TableHead className="w-[8%] text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((record) => {
          const pathLabel = compactPath(record.storageKey ?? record.publicUrl);
          const hasFile = Boolean(record.storageKey);
          const openActionId = `import-open-${record.id}`;
          const downloadActionId = `import-download-${record.id}`;
          return (
            <TableRow key={record.id}>
              <TableCell className="min-w-0">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-variant">
                    <FileUp className="h-5 w-5 text-brand-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-900" title={record.sourceName}>
                      {record.sourceName}
                    </p>
                    <p className="truncate text-xs text-ink-500">
                      {record.organization?.name ?? record.mimeType ?? record.id}
                    </p>
                    {pathLabel && (
                      <p
                        className="truncate text-[11px] text-ink-400"
                        title={record.storageKey ?? record.publicUrl ?? undefined}
                      >
                        {pathLabel}
                      </p>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell className="min-w-0">
                <UserCell
                  name={record.user?.name}
                  email={record.user?.email}
                  role={record.userRole ?? record.user?.role}
                />
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <Badge variant={importStatusVariant(record.status)}>
                  {CONTENT_IMPORT_STATUS_LABEL[record.status]}
                </Badge>
                {record.error && (
                  <p className="mt-1 max-w-52 truncate text-xs text-danger">{record.error}</p>
                )}
              </TableCell>
              <TableCell>
                <p className="text-sm text-ink-700">{formatBytes(record.sizeBytes)}</p>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <p className="text-xs leading-5 text-ink-500">
                  {formatDateTime(record.createdAt)}
                </p>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <p className="text-xs leading-5 text-ink-500">
                  {formatDateTime(record.convertedAt)}
                </p>
              </TableCell>
              <TableCell className="text-right whitespace-nowrap">
                <div className="flex justify-end gap-1 whitespace-nowrap">
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={!hasFile || Boolean(fileActionId)}
                    title="Open import"
                    onClick={() => onOpenFile(record)}
                  >
                    {fileActionId === openActionId ? (
                      <Spinner className="h-4 w-4 text-brand-primary" />
                    ) : (
                      <Eye className={`h-4 w-4 ${hasFile ? 'text-brand-primary' : 'text-ink-300'}`} />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={!hasFile || Boolean(fileActionId)}
                    title="Download import"
                    onClick={() => onDownloadFile(record)}
                  >
                    {fileActionId === downloadActionId ? (
                      <Spinner className="h-4 w-4 text-brand-orange" />
                    ) : (
                      <Download className={`h-4 w-4 ${hasFile ? 'text-brand-orange' : 'text-ink-300'}`} />
                    )}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
        {rows.length === 0 && <EmptyContentRow colSpan={7} />}
      </TableBody>
    </Table>
  );
}

function UserCell({
  name,
  email,
  role,
}: {
  name?: string | null;
  email?: string | null;
  role?: string | null;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="h-8 w-8">
        <AvatarFallback>{initials(name ?? email ?? 'User')}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink-900">
          {name ?? email ?? '-'}
        </p>
        <p className="truncate text-xs text-ink-500">{role ?? email ?? '-'}</p>
      </div>
    </div>
  );
}

function TableLoading() {
  return (
    <div className="flex h-56 items-center justify-center">
      <Spinner className="h-6 w-6 text-brand-primary" />
    </div>
  );
}

function EmptyContentRow({ colSpan }: { colSpan: number }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-12 text-center">
        <div className="mx-auto flex max-w-sm flex-col items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
            <Presentation className="h-5 w-5" />
          </div>
          <p className="mt-3 text-sm font-semibold text-ink-900">
            No content matches these filters
          </p>
          <p className="mt-1 text-sm text-ink-500">
            Adjust the tab filters or clear the current query to inspect more records.
          </p>
        </div>
      </TableCell>
    </TableRow>
  );
}
