import { useState } from 'react';
import type React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  ArrowLeft,
  ArchiveX,
  Bot,
  Boxes,
  Building2,
  CalendarClock,
  ClipboardList,
  Database,
  ExternalLink,
  FileArchive,
  HardDrive,
  MonitorPlay,
  Palette,
  Pencil,
  Power,
  Presentation,
  RefreshCw,
  RotateCcw,
  Sliders,
  Trash2,
  UserPlus,
  UsersRound,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { activityApi } from '@/services/activity.api';
import { contentApi } from '@/services/content.api';
import { licensingApi } from '@/services/licensing.api';
import {
  organizationsApi,
  type ArchiveOrganizationWithChildrenResult,
  type DeleteOrganizationResult,
} from '@/services/organizations.api';
import { usersApi } from '@/services/users.api';
import { extractApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { canAccessAiModule } from '@/lib/ai-access';
import { formatDate, formatDateTime, initials } from '@/lib/utils';
import { BoardPreviewTile } from '@/features/content/WhiteboardPreview';
import { EmailActivationKeysDialog } from '@/components/license/EmailActivationKeysDialog';
import {
  BRANDING_MODE_LABEL,
  EXPORT_STATUS_LABEL,
  LIVE_SESSION_STATUS_LABEL,
  ORG_KIND_LABEL,
  ROLE_LABEL,
  STORAGE_STATUS_LABEL,
  SUBSCRIPTION_STATUS_LABEL,
  type AdminCanvasRecord,
  type AdminExportRecord,
  type AdminLiveSessionRecord,
  type AdminOrganization,
  type AdminUser,
  type AuditLogEntry,
  type ExportStatus,
  type HardwareActivationKeyRecord,
  type LiveSessionStatus,
  type OrganizationKind,
  type OrganizationStatus,
  type OrganizationStorageStatus,
  type SubscriptionRecord,
  type SubscriptionStatus,
} from '@/types/api';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';

const LINKED_PAGE_SIZE = 10;

type HubTab = 'overview' | 'people' | 'billing' | 'content' | 'activity';

function kindVariant(kind: OrganizationKind) {
  if (kind === 'INTERNAL') return 'navy' as const;
  if (kind === 'PARTNER') return 'purple' as const;
  return 'info' as const;
}

function organizationStatusVariant(org: AdminOrganization) {
  if (org.deletedAt) return 'default' as const;
  return org.status === 'ACTIVE' ? 'success' : 'warning';
}

function organizationStatusLabel(org: AdminOrganization) {
  if (org.deletedAt) return 'Archived';
  return org.status === 'ACTIVE' ? 'Active' : 'Inactive';
}

function storageStatusVariant(status: OrganizationStorageStatus) {
  if (status === 'CONNECTED') return 'success' as const;
  if (status === 'INVALID') return 'danger' as const;
  if (status === 'PENDING') return 'warning' as const;
  return 'default' as const;
}

function subscriptionStatusVariant(status: SubscriptionStatus) {
  if (status === 'ACTIVE') return 'success' as const;
  if (status === 'TRIAL') return 'info' as const;
  if (status === 'EXPIRED') return 'warning' as const;
  if (status === 'CANCELED') return 'danger' as const;
  return 'warning' as const;
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

function keyStatusVariant(status: HardwareActivationKeyRecord['status']) {
  if (status === 'AVAILABLE') return 'info' as const;
  if (status === 'BOUND') return 'success' as const;
  if (status === 'DISABLED') return 'danger' as const;
  return 'warning' as const;
}

function linkedUrl(path: string, params: Record<string, string>) {
  const query = new URLSearchParams(params);
  return `${path}?${query.toString()}`;
}

function actionLabel(action: string) {
  return action
    .split('.')
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' / ');
}

function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function StatTile({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="flex items-start gap-3 px-5 py-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
          {label}
        </p>
        <p className="mt-1 truncate text-xl font-bold text-ink-900">{value}</p>
        <p className="mt-1 truncate text-xs text-ink-500">{detail}</p>
      </div>
    </Card>
  );
}

function SectionHeader({
  title,
  description,
  href,
  actionLabel,
  actions,
}: {
  title: string;
  description: string;
  href?: string;
  actionLabel?: string;
  actions?: React.ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-3 border-b border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div>
        <h3 className="text-base font-semibold text-ink-900">{title}</h3>
        <p className="text-xs leading-5 text-ink-500">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {actions}
        {href && (
          <Button variant="outline" size="sm" onClick={() => navigate(href)}>
            <ExternalLink className="h-4 w-4" />
            {actionLabel ?? 'Open full view'}
          </Button>
        )}
      </div>
    </div>
  );
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-10 text-center text-sm text-ink-500">
        {label}
      </TableCell>
    </TableRow>
  );
}

function LoadingBlock() {
  return (
    <div className="flex h-36 items-center justify-center">
      <Spinner className="h-5 w-5 text-brand-primary" />
    </div>
  );
}

function UserCell({ user }: { user: AdminUser }) {
  const label = user.name ?? user.email;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="h-8 w-8">
        <AvatarFallback>{initials(label)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink-900">{label}</p>
        <p className="truncate text-xs text-ink-500">{user.email}</p>
      </div>
    </div>
  );
}

function UserTable({
  rows,
  loading,
  onEdit,
  onToggleStatus,
  onForceLogout,
  onArchive,
}: {
  rows: AdminUser[];
  loading: boolean;
  onEdit: (user: AdminUser) => void;
  onToggleStatus: (user: AdminUser) => void;
  onForceLogout: (user: AdminUser) => void;
  onArchive: (user: AdminUser) => void;
}) {
  if (loading) return <LoadingBlock />;
  return (
    <Table className="min-w-[900px]">
      <TableHeader>
        <TableRow>
          <TableHead>User</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Last Seen</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((user) => (
          <TableRow key={user.id}>
            <TableCell className="min-w-0">
              <UserCell user={user} />
            </TableCell>
            <TableCell className="whitespace-nowrap">
              <Badge variant={user.role === 'SUPER_ADMIN' ? 'navy' : 'default'}>
                {ROLE_LABEL[user.role]}
              </Badge>
            </TableCell>
            <TableCell className="whitespace-nowrap">
              <Badge variant={user.deletedAt ? 'default' : user.status === 'ACTIVE' ? 'success' : 'warning'}>
                {user.deletedAt ? 'Archived' : user.status === 'ACTIVE' ? 'Active' : 'Suspended'}
              </Badge>
            </TableCell>
            <TableCell className="whitespace-nowrap">
              <Badge variant={user.isEmailVerified ? 'success' : 'warning'}>
                {user.isEmailVerified ? 'Verified' : 'Pending'}
              </Badge>
            </TableCell>
            <TableCell className="whitespace-nowrap text-xs text-ink-500">
              {formatDateTime(user.lastLoginAt)}
            </TableCell>
            <TableCell className="text-right whitespace-nowrap">
              <div className="flex justify-end gap-1 whitespace-nowrap">
                <Button size="icon" variant="ghost" title="Edit user" onClick={() => onEdit(user)}>
                  <Pencil className="h-4 w-4 text-ink-500" />
                </Button>
                {!user.deletedAt && (
                  <Button
                    size="icon"
                    variant="ghost"
                    title={user.status === 'ACTIVE' ? 'Suspend user' : 'Reactivate user'}
                    onClick={() => onToggleStatus(user)}
                  >
                    {user.status === 'ACTIVE' ? (
                      <Power className="h-4 w-4 text-warning" />
                    ) : (
                      <RotateCcw className="h-4 w-4 text-success" />
                    )}
                  </Button>
                )}
                {!user.deletedAt && (
                  <Button size="icon" variant="ghost" title="Force logout" onClick={() => onForceLogout(user)}>
                    <XCircle className="h-4 w-4 text-ink-500" />
                  </Button>
                )}
                {!user.deletedAt && (
                  <Button size="icon" variant="ghost" title="Archive user" onClick={() => onArchive(user)}>
                    <Trash2 className="h-4 w-4 text-danger" />
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
        {rows.length === 0 && <EmptyRow colSpan={6} label="No users linked to this organization." />}
      </TableBody>
    </Table>
  );
}

function LegacySubscriptionTable({
  rows,
  loading,
}: {
  rows: SubscriptionRecord[];
  loading: boolean;
}) {
  if (loading) return <LoadingBlock />;
  return (
    <Table className="min-w-[640px]">
      <TableHeader>
        <TableRow>
          <TableHead>Plan</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Seats</TableHead>
          <TableHead>Term</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((subscription) => (
          <TableRow key={subscription.id}>
            <TableCell className="min-w-0">
              <p className="text-sm font-semibold text-ink-900">{subscription.planName}</p>
              <p className="text-xs text-ink-500">{subscription.id}</p>
            </TableCell>
            <TableCell className="whitespace-nowrap">
              <Badge variant={subscriptionStatusVariant(subscription.status)}>
                {SUBSCRIPTION_STATUS_LABEL[subscription.status]}
              </Badge>
            </TableCell>
            <TableCell className="whitespace-nowrap text-sm text-ink-700">
              {subscription.seatUsage}/{subscription.seatLimit}
            </TableCell>
            <TableCell className="whitespace-nowrap text-xs text-ink-500">
              {formatDate(subscription.startDate)} - {formatDate(subscription.endDate)}
            </TableCell>
          </TableRow>
        ))}
        {rows.length === 0 && <EmptyRow colSpan={4} label="No legacy subscription records linked to this organization." />}
      </TableBody>
    </Table>
  );
}

function ActivationKeysTable({
  rows,
  loading,
  canManage,
  onRevoke,
  onReplace,
}: {
  rows: HardwareActivationKeyRecord[];
  loading: boolean;
  canManage: boolean;
  onRevoke: (key: HardwareActivationKeyRecord) => void;
  onReplace: (key: HardwareActivationKeyRecord) => void;
}) {
  if (loading) return <LoadingBlock />;
  return (
    <Table className="min-w-[940px]">
      <TableHeader>
        <TableRow>
          <TableHead>Key Label</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Optional User Note</TableHead>
          <TableHead>Devices</TableHead>
          <TableHead>Expires</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((key) => (
          <TableRow key={key.id}>
            <TableCell className="min-w-0">
              <p className="text-sm font-semibold text-ink-900">{key.label ?? 'Activation key'}</p>
              <p className="text-xs text-ink-500">{key.id}</p>
            </TableCell>
            <TableCell className="whitespace-nowrap">
              <Badge variant={keyStatusVariant(key.status)}>{key.status}</Badge>
            </TableCell>
            <TableCell className="max-w-[220px] truncate text-sm text-ink-700">
              {key.assignedUser?.name ?? key.assignedUser?.email ?? '-'}
            </TableCell>
            <TableCell className="whitespace-nowrap text-sm text-ink-700">
              {key.activations?.length ?? 0}
            </TableCell>
            <TableCell className="whitespace-nowrap text-xs text-ink-500">
              {key.expiresAt ? formatDate(key.expiresAt) : 'No expiry'}
            </TableCell>
            <TableCell className="text-right whitespace-nowrap">
              {canManage && key.status !== 'DISABLED' ? (
                <div className="flex justify-end gap-1 whitespace-nowrap">
                  <Button size="icon" variant="ghost" title="Replace activation key" onClick={() => onReplace(key)}>
                    <RotateCcw className="h-4 w-4 text-brand-primary" />
                  </Button>
                  <Button size="icon" variant="ghost" title="Revoke activation key" onClick={() => onRevoke(key)}>
                    <ArchiveX className="h-4 w-4 text-danger" />
                  </Button>
                </div>
              ) : (
                <span className="text-xs text-ink-400">-</span>
              )}
            </TableCell>
          </TableRow>
        ))}
        {rows.length === 0 && <EmptyRow colSpan={6} label="No activation keys issued yet." />}
      </TableBody>
    </Table>
  );
}

function CanvasTable({
  rows,
  loading,
}: {
  rows: AdminCanvasRecord[];
  loading: boolean;
}) {
  if (loading) return <LoadingBlock />;
  return (
    <Table className="min-w-[860px]">
      <TableHeader>
        <TableRow>
          <TableHead>Canvas</TableHead>
          <TableHead>Owner</TableHead>
          <TableHead>Visibility</TableHead>
          <TableHead>Content</TableHead>
          <TableHead>Updated</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((canvas) => (
          <TableRow key={canvas.id}>
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
                  <p className="truncate text-sm font-semibold text-ink-900">{canvas.name}</p>
                  <p className="max-w-[320px] truncate text-xs text-ink-500">
                    {canvas.description ?? canvas.id}
                  </p>
                </div>
              </div>
            </TableCell>
            <TableCell className="text-sm text-ink-700">
              {canvas.user?.name ?? canvas.user?.email ?? '-'}
            </TableCell>
            <TableCell className="whitespace-nowrap">
              <Badge variant={canvas.isPublic ? 'info' : 'default'}>
                {canvas.isPublic ? 'Public' : 'Private'}
              </Badge>
            </TableCell>
            <TableCell className="whitespace-nowrap text-xs text-ink-500">
              {canvas._count.slides} slides, {canvas._count.liveSessions} sessions, {canvas._count.exports} exports
            </TableCell>
            <TableCell className="whitespace-nowrap text-xs text-ink-500">
              {formatDateTime(canvas.updatedAt)}
            </TableCell>
          </TableRow>
        ))}
        {rows.length === 0 && <EmptyRow colSpan={5} label="No canvases linked to this organization." />}
      </TableBody>
    </Table>
  );
}

function LiveSessionsTable({
  rows,
  loading,
}: {
  rows: AdminLiveSessionRecord[];
  loading: boolean;
}) {
  if (loading) return <LoadingBlock />;
  return (
    <Table className="min-w-[860px]">
      <TableHeader>
        <TableRow>
          <TableHead>Session</TableHead>
          <TableHead>Host</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Engagement</TableHead>
          <TableHead>Started</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((session) => (
          <TableRow key={session.id}>
            <TableCell className="min-w-0">
              <p className="text-sm font-semibold text-ink-900">
                {session.title ?? session.canvas?.name ?? 'Live session'}
              </p>
              <p className="truncate text-xs text-ink-500">{session.canvas?.name ?? session.id}</p>
            </TableCell>
            <TableCell className="text-sm text-ink-700">
              {session.host?.name ?? session.host?.email ?? session.createdBy?.name ?? session.createdBy?.email ?? '-'}
            </TableCell>
            <TableCell className="whitespace-nowrap">
              <Badge variant={liveStatusVariant(session.status)}>
                {LIVE_SESSION_STATUS_LABEL[session.status]}
              </Badge>
            </TableCell>
            <TableCell className="whitespace-nowrap text-xs text-ink-500">
              {session._count.participants} participants, {session._count.messages} messages
            </TableCell>
            <TableCell className="whitespace-nowrap text-xs text-ink-500">
              {formatDateTime(session.startedAt)}
            </TableCell>
          </TableRow>
        ))}
        {rows.length === 0 && <EmptyRow colSpan={5} label="No live sessions linked to this organization." />}
      </TableBody>
    </Table>
  );
}

function ExportsTable({
  rows,
  loading,
}: {
  rows: AdminExportRecord[];
  loading: boolean;
}) {
  if (loading) return <LoadingBlock />;
  return (
    <Table className="min-w-[980px]">
      <TableHeader>
        <TableRow>
          <TableHead>Export</TableHead>
          <TableHead>User</TableHead>
          <TableHead>Format</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Size</TableHead>
          <TableHead>Completed</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((record) => (
          <TableRow key={record.id}>
            <TableCell className="min-w-0">
              <p className="text-sm font-semibold text-ink-900">
                {record.canvas?.name ?? 'Canvas export'}
              </p>
              <p className="truncate text-xs text-ink-500">{record.id}</p>
            </TableCell>
            <TableCell className="text-sm text-ink-700">
              {record.user?.name ?? record.user?.email ?? '-'}
            </TableCell>
            <TableCell className="whitespace-nowrap">
              <Badge>{record.format}</Badge>
            </TableCell>
            <TableCell className="whitespace-nowrap">
              <Badge variant={exportStatusVariant(record.status)}>
                {EXPORT_STATUS_LABEL[record.status]}
              </Badge>
            </TableCell>
            <TableCell className="whitespace-nowrap text-sm text-ink-700">
              {formatBytes(record.fileSize)}
            </TableCell>
            <TableCell className="whitespace-nowrap text-xs text-ink-500">
              {formatDateTime(record.completedAt)}
            </TableCell>
          </TableRow>
        ))}
        {rows.length === 0 && <EmptyRow colSpan={6} label="No exports linked to this organization." />}
      </TableBody>
    </Table>
  );
}

function ActivityTable({
  rows,
  loading,
}: {
  rows: AuditLogEntry[];
  loading: boolean;
}) {
  if (loading) return <LoadingBlock />;
  return (
    <Table className="min-w-[820px]">
      <TableHeader>
        <TableRow>
          <TableHead>Actor</TableHead>
          <TableHead>Action</TableHead>
          <TableHead>Summary</TableHead>
          <TableHead>When</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell className="min-w-0">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    {initials(entry.actorUser?.name ?? entry.actorUser?.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-900">
                    {entry.actorUser?.name ?? entry.actorUser?.email}
                  </p>
                  <p className="truncate text-xs text-ink-500">{entry.actorUser?.role}</p>
                </div>
              </div>
            </TableCell>
            <TableCell className="whitespace-nowrap">
              <Badge variant="info">{actionLabel(entry.action)}</Badge>
            </TableCell>
            <TableCell className="text-sm text-ink-700">
              {entry.summary ?? '-'}
            </TableCell>
            <TableCell className="whitespace-nowrap text-xs text-ink-500">
              {formatDateTime(entry.createdAt)}
            </TableCell>
          </TableRow>
        ))}
        {rows.length === 0 && <EmptyRow colSpan={4} label="No direct organization activity found." />}
      </TableBody>
    </Table>
  );
}

function DetailItem({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
        {label}
      </p>
      <div className="mt-1 text-sm font-medium text-ink-900">{value}</div>
    </div>
  );
}

export function OrganizationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [tab, setTab] = useState<HubTab>('overview');
  const [statusAction, setStatusAction] = useState<{
    organization: AdminOrganization;
    status: OrganizationStatus;
  } | null>(null);
  const [archiveOrgAction, setArchiveOrgAction] = useState<AdminOrganization | null>(null);
  const [userStatusAction, setUserStatusAction] = useState<AdminUser | null>(null);
  const [userLogoutAction, setUserLogoutAction] = useState<AdminUser | null>(null);
  const [userArchiveAction, setUserArchiveAction] = useState<AdminUser | null>(null);
  const [keyRevokeAction, setKeyRevokeAction] =
    useState<HardwareActivationKeyRecord | null>(null);
  const [keyReplaceAction, setKeyReplaceAction] =
    useState<HardwareActivationKeyRecord | null>(null);
  const [emailKeysOpen, setEmailKeysOpen] = useState(false);

  const organizationQuery = useQuery({
    queryKey: ['organizations', id],
    queryFn: () => organizationsApi.get(id!),
    enabled: !!id,
  });

  const childrenQuery = useQuery({
    queryKey: ['organizations', 'children', id],
    queryFn: () =>
      organizationsApi.list({
        parentOrganizationId: id,
        perPage: 100,
        sortBy: 'name',
        sortOrder: 'asc',
      }),
    enabled: !!id,
  });

  const usersQuery = useQuery({
    queryKey: ['organization-detail', id, 'users'],
    queryFn: () =>
      usersApi.list({
        organizationId: id,
        perPage: LINKED_PAGE_SIZE,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }),
    enabled: !!id,
  });

  const licenseQuery = useQuery({
    queryKey: ['organization-detail', id, 'license'],
    queryFn: () => licensingApi.getOrganizationLicenseDetails(id!),
    enabled: !!id,
  });

  const canvasesQuery = useQuery({
    queryKey: ['organization-detail', id, 'canvases'],
    queryFn: () =>
      contentApi.canvases.list({
        organizationId: id,
        perPage: LINKED_PAGE_SIZE,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      }),
    enabled: !!id,
  });

  const liveSessionsQuery = useQuery({
    queryKey: ['organization-detail', id, 'live-sessions'],
    queryFn: () =>
      contentApi.liveSessions.list({
        organizationId: id,
        perPage: LINKED_PAGE_SIZE,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }),
    enabled: !!id,
  });

  const exportsQuery = useQuery({
    queryKey: ['organization-detail', id, 'exports'],
    queryFn: () =>
      contentApi.exports.list({
        organizationId: id,
        perPage: LINKED_PAGE_SIZE,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }),
    enabled: !!id,
  });

  const activityQuery = useQuery({
    queryKey: ['organization-detail', id, 'activity'],
    queryFn: () =>
      activityApi.list({
        targetType: 'ORGANIZATION',
        targetId: id,
        perPage: LINKED_PAGE_SIZE,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }),
    enabled: !!id,
  });

  const invalidateOrganizationDetail = () => {
    queryClient.invalidateQueries({ queryKey: ['organizations'] });
    queryClient.invalidateQueries({ queryKey: ['organization-detail', id] });
    queryClient.invalidateQueries({ queryKey: ['users'] });
    queryClient.invalidateQueries({ queryKey: ['license-details'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
  };

  const updateStatusMutation = useMutation({
    mutationFn: ({
      organizationId,
      status,
    }: {
      organizationId: string;
      status: OrganizationStatus;
    }) => organizationsApi.update(organizationId, { status }),
    onSuccess: () => {
      invalidateOrganizationDetail();
      toast.success('Organization status updated');
      setStatusAction(null);
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const archiveOrgMutation = useMutation<
    DeleteOrganizationResult | ArchiveOrganizationWithChildrenResult,
    Error,
    { organizationId: string; childOrganizationIds?: string[] }
  >({
    mutationFn: ({
      organizationId,
      childOrganizationIds,
    }: {
      organizationId: string;
      childOrganizationIds?: string[];
    }) =>
      childOrganizationIds?.length
        ? organizationsApi.archiveWithChildren(organizationId, childOrganizationIds)
        : organizationsApi.delete(organizationId),
    onSuccess: () => {
      invalidateOrganizationDetail();
      toast.success('Organization archived');
      setArchiveOrgAction(null);
      navigate('/organizations');
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const recalculateLicenseMutation = useMutation({
    mutationFn: licensingApi.recalculateLicenseUsage,
    onSuccess: () => {
      invalidateOrganizationDetail();
      toast.success('License usage recalculated');
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const updateUserStatusMutation = useMutation({
    mutationFn: (targetUser: AdminUser) =>
      usersApi.update(targetUser.id, {
        status: targetUser.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
      }),
    onSuccess: () => {
      invalidateOrganizationDetail();
      toast.success('User status updated');
      setUserStatusAction(null);
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const forceLogoutMutation = useMutation({
    mutationFn: (targetUser: AdminUser) => usersApi.forceLogout(targetUser.id),
    onSuccess: () => {
      invalidateOrganizationDetail();
      toast.success('User sessions revoked');
      setUserLogoutAction(null);
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const archiveUserMutation = useMutation({
    mutationFn: (targetUser: AdminUser) => usersApi.delete(targetUser.id),
    onSuccess: () => {
      invalidateOrganizationDetail();
      toast.success('User archived');
      setUserArchiveAction(null);
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const revokeKeyMutation = useMutation({
    mutationFn: (key: HardwareActivationKeyRecord) => licensingApi.revokeActivationKey(key.id),
    onSuccess: () => {
      invalidateOrganizationDetail();
      toast.success('Activation key revoked');
      setKeyRevokeAction(null);
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const replaceKeyMutation = useMutation({
    mutationFn: (key: HardwareActivationKeyRecord) => licensingApi.replaceActivationKey(key.id),
    onSuccess: () => {
      invalidateOrganizationDetail();
      toast.success('Replacement activation key created');
      setKeyReplaceAction(null);
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const org = organizationQuery.data;
  const users = usersQuery.data?.data ?? [];
  const subscriptions = licenseQuery.data?.subscriptions ?? org?.subscriptions ?? [];
  const activationKeys = licenseQuery.data?.hardwareActivationKeys ?? [];
  const licenseSummary = licenseQuery.data?.summary ?? null;
  const canvases = canvasesQuery.data?.data ?? [];
  const liveSessions = liveSessionsQuery.data?.data ?? [];
  const exports = exportsQuery.data?.data ?? [];
  const activity = activityQuery.data?.data ?? [];
  const children = childrenQuery.data?.data ?? [];
  const activeChildren = children.filter((child) => child.status === 'ACTIVE' && !child.deletedAt);
  const capacity = licenseQuery.data?.capacitySummary;
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isPartnerAdmin = user?.role === 'PARTNER_ADMIN';
  const canManageOrganization = Boolean(org && !org.deletedAt);
  const canArchiveOrganization =
    Boolean(org) && isSuperAdmin && org!.kind !== 'INTERNAL' && !org!.deletedAt;
  const canManageActivationKeys = isSuperAdmin || isPartnerAdmin;

  const linkedUsersUrl = id ? linkedUrl('/users', { organizationId: id }) : '';
  const linkedContentUrl = id ? linkedUrl('/content', { organizationId: id }) : '';
  const linkedActivityUrl = id
    ? linkedUrl('/activity', { targetType: 'ORGANIZATION', targetId: id })
    : '';

  if (organizationQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-7 w-7 text-brand-primary" />
      </div>
    );
  }

  if (organizationQuery.isError || !org) {
    return (
      <Card className="mx-auto max-w-2xl px-4 py-8 text-center sm:px-6">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-danger/10 text-danger">
          <Building2 className="h-5 w-5" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-ink-900">
          Organization unavailable
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink-500">
          {extractApiError(organizationQuery.error) ||
            'This organization could not be loaded.'}
        </p>
        <Button className="mt-5" variant="primary" onClick={() => navigate('/organizations')}>
          <ArrowLeft className="h-4 w-4" />
          Organizations
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-xl border border-line bg-white px-4 py-5 shadow-card sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-surface-variant">
            {org.logoUrl ? (
              <img src={org.logoUrl} alt={org.name} className="h-full w-full object-cover" />
            ) : (
              <Building2 className="h-8 w-8 text-ink-400" />
            )}
          </div>
          <div className="min-w-0">
            <Button variant="ghost" size="sm" onClick={() => navigate('/organizations')}>
              <ArrowLeft className="h-4 w-4" />
              Organizations
            </Button>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h2 className="truncate text-2xl font-black text-ink-900">
                {org.name}
              </h2>
              <Badge variant={kindVariant(org.kind)}>{ORG_KIND_LABEL[org.kind]}</Badge>
              <Badge variant={organizationStatusVariant(org)}>
                {organizationStatusLabel(org)}
              </Badge>
            </div>
            <p className="mt-1 truncate text-sm text-ink-500">{org.slug}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManageOrganization && (
            <Button
              variant="outline"
              onClick={() =>
                setStatusAction({
                  organization: org,
                  status: org.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                })
              }
            >
              {org.status === 'ACTIVE' ? (
                <Power className="h-4 w-4" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              {org.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}
            </Button>
          )}
          <Button variant="outline" onClick={() => navigate(`/users/new?organizationId=${org.id}`)}>
            <UserPlus className="h-4 w-4" />
            Add user
          </Button>
          <Button variant="outline" onClick={() => navigate(`/license?organizationId=${org.id}`)}>
            <Database className="h-4 w-4" />
            License
          </Button>
          {isSuperAdmin && (
            <Button
              variant="outline"
              disabled={recalculateLicenseMutation.isPending}
              onClick={() => recalculateLicenseMutation.mutate(org.id)}
            >
              {recalculateLicenseMutation.isPending ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Recalculate
            </Button>
          )}
          {canAccessAiModule(user) && (
            <Button variant="outline" onClick={() => navigate('/ai')}>
              <Sliders className="h-4 w-4" />
              AI credits
            </Button>
          )}
          {canArchiveOrganization && (
            <Button variant="destructive" onClick={() => setArchiveOrgAction(org)}>
              <ArchiveX className="h-4 w-4" />
              Archive
            </Button>
          )}
          <Button variant="primary" onClick={() => navigate(`/organizations/${org.id}/edit`)}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Members"
          value={org._count?.memberships ?? usersQuery.data?.meta?.total ?? 0}
          detail="Organization memberships"
          icon={UsersRound}
        />
        <StatTile
          label="Licence capacity"
          value={
            licenseSummary
              ? `${licenseSummary.usableKeyCount}/${licenseSummary.seatLimit}`
              : `${capacity?.activationKeysUsable ?? 0}/${capacity?.activationKeyCapacity ?? 0}`
          }
          detail="Usable keys / capacity"
          icon={Database}
        />
        <StatTile
          label="Canvases"
          value={org._count?.canvases ?? canvasesQuery.data?.meta?.total ?? 0}
          detail="Whiteboard files"
          icon={Presentation}
        />
        <StatTile
          label="Storage"
          value={STORAGE_STATUS_LABEL[org.storageStatus]}
          detail={org.storageProvider ?? org.defaultStorageProvider ?? 'No default provider'}
          icon={HardDrive}
        />
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as HubTab)}>
        <TabsList className="flex w-full flex-wrap justify-start sm:w-fit">
          <TabsTrigger value="overview">
            <Boxes className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="people">
            <UsersRound className="h-4 w-4" />
            People
          </TabsTrigger>
          <TabsTrigger value="billing">
            <Database className="h-4 w-4" />
            Licence
          </TabsTrigger>
          <TabsTrigger value="content">
            <Presentation className="h-4 w-4" />
            Content
          </TabsTrigger>
          <TabsTrigger value="activity">
            <Activity className="h-4 w-4" />
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="px-4 py-5 sm:px-6">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-brand-primary" />
                <h3 className="text-base font-semibold text-ink-900">Organization details</h3>
              </div>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <DetailItem label="Branding" value={BRANDING_MODE_LABEL[org.brandingMode]} />
                <DetailItem label="Brand name" value={org.brandName ?? '-'} />
                <DetailItem label="Support email" value={org.supportEmail ?? '-'} />
                <DetailItem label="Support phone" value={org.supportPhone ?? '-'} />
                <DetailItem label="Created" value={formatDateTime(org.createdAt)} />
                <DetailItem label="Updated" value={formatDateTime(org.updatedAt)} />
                <DetailItem
                  label="Login settings"
                  value={[
                    org.studentLoginEnabled && 'Student login',
                    org.parentLoginEnabled && 'Parent login',
                    org.sessionOnlyJoinEnabled && 'Session-only join',
                    org.teacherOnlyMode && 'Teacher-only mode',
                  ]
                    .filter(Boolean)
                    .join(', ') || '-'}
                  className="sm:col-span-2"
                />
                <div className="grid gap-3 border-t border-line pt-4 sm:col-span-2 sm:grid-cols-3">
                  <DetailItem
                    label="Teachers"
                    value={`${capacity?.roleUsage.teacher ?? 0}/${capacity?.roleLimits.teacher ?? 'No limit'}`}
                  />
                  <DetailItem
                    label="Students"
                    value={`${capacity?.roleUsage.student ?? 0}/${capacity?.roleLimits.student ?? 'No limit'}`}
                  />
                  <DetailItem
                    label="Parents"
                    value={`${capacity?.roleUsage.parent ?? 0}/${capacity?.roleLimits.parent ?? 'No limit'}`}
                  />
                  <DetailItem
                    label="Teacher seats"
                    value={`${capacity?.activeTeachers ?? 0}/${capacity?.teacherSeats ?? 0}`}
                  />
                  <DetailItem
                    label="Activation keys"
                    value={`${capacity?.activationKeysUsable ?? 0}/${capacity?.activationKeyCapacity ?? 0}`}
                  />
                  <DetailItem
                    label="Child organizations"
                    value={`${capacity?.childOrganizationUsed ?? activeChildren.length}/${capacity?.childOrganizationLimit ?? 'No limit'}`}
                  />
                  {org.kind === 'PARTNER' && (
                    <DetailItem
                      label="Child user allocation"
                      value={`${capacity?.childUserAllocated ?? 0}/${capacity?.childUserLimit ?? 'No limit'}`}
                      className="sm:col-span-3"
                    />
                  )}
                </div>
              </div>
            </Card>

            <Card className="px-4 py-5 sm:px-6">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-brand-orange" />
                <h3 className="text-base font-semibold text-ink-900">Brand & AI</h3>
              </div>
              <div className="mt-5 space-y-4">
                <DetailItem
                  label="Primary color"
                  value={
                    org.brandPrimaryColor ? (
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="h-5 w-5 shrink-0 rounded border border-line"
                          style={{ backgroundColor: org.brandPrimaryColor }}
                        />
                        <code className="font-mono text-xs uppercase">
                          {org.brandPrimaryColor}
                        </code>
                      </span>
                    ) : (
                      <span className="text-ink-500">Not configured</span>
                    )
                  }
                />
                <DetailItem
                  label="Accent color"
                  value={
                    org.brandAccentColor ? (
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="h-5 w-5 shrink-0 rounded border border-line"
                          style={{ backgroundColor: org.brandAccentColor }}
                        />
                        <code className="font-mono text-xs uppercase">
                          {org.brandAccentColor}
                        </code>
                      </span>
                    ) : (
                      <span className="text-ink-500">Not configured</span>
                    )
                  }
                />
                <DetailItem
                  label="AI"
                  value={
                    <Badge variant="info">
                      <Bot className="h-3 w-3" />
                      Centralized
                    </Badge>
                  }
                />
              </div>
            </Card>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card>
              <SectionHeader
                title="Hierarchy"
                description="Partner workspace and managed customer organizations."
              />
              <div className="space-y-4 px-4 py-5 sm:px-6">
                <div className="rounded-lg border border-line p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                    Partner workspace
                  </p>
                  {org.parentOrganization ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/organizations/${org.parentOrganization?.id}`)}
                      className="mt-2 text-left text-sm font-semibold text-brand-primary hover:underline"
                    >
                      {org.parentOrganization.name}
                    </button>
                  ) : (
                    <p className="mt-2 text-sm text-ink-500">Top-level organization.</p>
                  )}
                </div>
                <div className="rounded-lg border border-line">
                  <div className="border-b border-line px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                      Managed customer organizations
                    </p>
                  </div>
                  {childrenQuery.isLoading ? (
                    <LoadingBlock />
                  ) : children.length ? (
                    <div className="divide-y divide-line">
                      {children.map((child) => (
                        <div
                          key={child.id}
                          className="flex w-full items-center justify-between gap-3 px-4 py-3"
                        >
                          <span className="min-w-0">
                            <button
                              type="button"
                              onClick={() => navigate(`/organizations/${child.id}`)}
                              className="block max-w-full truncate text-left text-sm font-semibold text-brand-primary hover:underline"
                            >
                              {child.name}
                            </button>
                            <span className="block truncate text-xs text-ink-500">
                              {child.slug}
                            </span>
                          </span>
                          <div className="flex shrink-0 items-center gap-1">
                            <Badge variant={kindVariant(child.kind)}>
                              {ORG_KIND_LABEL[child.kind]}
                            </Badge>
                            <Button size="icon" variant="ghost" title="View organization" onClick={() => navigate(`/organizations/${child.id}`)}>
                              <ExternalLink className="h-4 w-4 text-ink-500" />
                            </Button>
                            <Button size="icon" variant="ghost" title="Open users" onClick={() => navigate(`/users?organizationId=${child.id}`)}>
                              <UsersRound className="h-4 w-4 text-brand-primary" />
                            </Button>
                            <Button size="icon" variant="ghost" title="Open licence" onClick={() => navigate(`/license?organizationId=${child.id}`)}>
                              <Database className="h-4 w-4 text-brand-primary" />
                            </Button>
                            {isSuperAdmin && !child.deletedAt && child.kind !== 'INTERNAL' && (
                              <Button size="icon" variant="ghost" title="Archive organization" onClick={() => setArchiveOrgAction(child)}>
                                <ArchiveX className="h-4 w-4 text-danger" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="px-4 py-5 text-sm text-ink-500">
                      No managed customer organizations.
                    </p>
                  )}
                </div>
              </div>
            </Card>

            <Card>
              <SectionHeader
                title="Storage connections"
                description="Connected organization storage providers and validation state."
              />
              <div className="px-4 py-5 sm:px-6">
                {org.storageConnections?.length ? (
                  <div className="space-y-3">
                    {org.storageConnections.map((connection) => (
                      <div key={connection.id} className="rounded-lg border border-line p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-ink-900">
                            {connection.provider}
                          </p>
                          <Badge variant={storageStatusVariant(connection.status)}>
                            {STORAGE_STATUS_LABEL[connection.status]}
                          </Badge>
                        </div>
                        <p className="mt-2 text-xs text-ink-500">
                          {connection.externalAccountEmail ?? 'No account email'}
                        </p>
                        <p className="mt-1 truncate text-xs text-ink-400">
                          Folder: {connection.rootFolderId ?? '-'}
                        </p>
                        {connection.lastError && (
                          <p className="mt-2 text-xs text-danger">{connection.lastError}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-ink-500">No storage connections configured.</p>
                )}
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="people" className="space-y-5">
          <Card>
            <SectionHeader
              title="Linked people"
              description="Recent users in this organization."
              href={linkedUsersUrl}
              actionLabel="Open users"
            />
            <UserTable
              rows={users}
              loading={usersQuery.isLoading}
              onEdit={(targetUser) => navigate(`/users/${targetUser.id}/edit`)}
              onToggleStatus={setUserStatusAction}
              onForceLogout={setUserLogoutAction}
              onArchive={setUserArchiveAction}
            />
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile
              label="Activation keys"
              value={activationKeys.length}
              detail="Issued hardware keys"
              icon={ClipboardList}
            />
            <StatTile
              label="Bound devices"
              value={activationKeys.reduce(
                (sum, key) => sum + (key.activations?.length ?? 0),
                0,
              )}
              detail="Linked activations"
              icon={Database}
            />
            <StatTile
              label="Eligible users"
              value={`${licenseSummary?.activationUserUsage ?? 0}/${licenseSummary?.seatLimit ?? capacity?.activationKeyCapacity ?? 0}`}
              detail="Activation-required roles / capacity"
              icon={CalendarClock}
            />
          </div>
          <Card>
            <SectionHeader
              title="Legacy subscription records"
              description="Read-only historical terms kept for migration and audit compatibility."
            />
            <LegacySubscriptionTable
              rows={subscriptions}
              loading={licenseQuery.isLoading}
            />
          </Card>
          <Card>
            <SectionHeader
              title="Activation keys"
              description="License keys are board/device based; users from the same organization can share an activated device."
              actions={
                canManageActivationKeys ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={activationKeys.length === 0}
                    onClick={() => setEmailKeysOpen(true)}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Email keys
                  </Button>
                ) : null
              }
            />
            <ActivationKeysTable
              rows={activationKeys}
              loading={licenseQuery.isLoading}
              canManage={canManageActivationKeys}
              onRevoke={setKeyRevokeAction}
              onReplace={setKeyReplaceAction}
            />
          </Card>
        </TabsContent>

        <TabsContent value="content" className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile
              label="Canvases"
              value={canvasesQuery.data?.meta?.total ?? canvases.length}
              detail="Whiteboard files"
              icon={Presentation}
            />
            <StatTile
              label="Live sessions"
              value={liveSessionsQuery.data?.meta?.total ?? liveSessions.length}
              detail="Hosted sessions"
              icon={MonitorPlay}
            />
            <StatTile
              label="Exports"
              value={exportsQuery.data?.meta?.total ?? exports.length}
              detail="Generated files"
              icon={FileArchive}
            />
          </div>
          <Card>
            <SectionHeader
              title="Canvases"
              description="Recent canvases owned by this organization."
              href={linkedContentUrl}
              actionLabel="Open content"
            />
            <CanvasTable rows={canvases} loading={canvasesQuery.isLoading} />
          </Card>
          <Card>
            <SectionHeader
              title="Live sessions"
              description="Recent sessions for organization canvases."
              href={linkedUrl('/content', { organizationId: org.id, tab: 'live-sessions' })}
              actionLabel="Open sessions"
            />
            <LiveSessionsTable
              rows={liveSessions}
              loading={liveSessionsQuery.isLoading}
            />
          </Card>
          <Card>
            <SectionHeader
              title="Exports"
              description="Recent generated export files."
              href={linkedUrl('/content', { organizationId: org.id, tab: 'exports' })}
              actionLabel="Open exports"
            />
            <ExportsTable rows={exports} loading={exportsQuery.isLoading} />
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-5">
          <Card>
            <SectionHeader
              title="Organization activity"
              description="Direct audit activity targeting this organization."
              href={linkedActivityUrl}
              actionLabel="Open audit log"
            />
            <ActivityTable rows={activity} loading={activityQuery.isLoading} />
          </Card>
          {activityQuery.isError && (
            <p className="text-sm text-danger">
              {extractApiError(activityQuery.error)}
            </p>
          )}
        </TabsContent>
      </Tabs>

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
            ? `${statusAction.organization.name} will be marked inactive for admin reporting.`
            : `${statusAction?.organization.name ?? 'This organization'} will be restored to active status.`
        }
        confirmLabel={statusAction?.status === 'INACTIVE' ? 'Deactivate' : 'Reactivate'}
        tone={statusAction?.status === 'INACTIVE' ? 'warning' : 'success'}
        loading={updateStatusMutation.isPending}
        onConfirm={() => {
          if (!statusAction) return;
          updateStatusMutation.mutate({
            organizationId: statusAction.organization.id,
            status: statusAction.status,
          });
        }}
      />
      <ConfirmationDialog
        open={!!archiveOrgAction}
        onOpenChange={(open) => !open && setArchiveOrgAction(null)}
        title="Archive organization?"
        description={
          <div className="space-y-3 leading-6">
            <p>
              {archiveOrgAction?.name ?? 'This organization'} will lose admin access, and licence,
              hardware, storage, and AI access are disabled.
            </p>
            {archiveOrgAction?.id === org.id && activeChildren.length > 0 && (
              <div className="rounded-lg border border-line bg-surface-variant p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Managed customer organizations archived first
                </p>
                <div className="mt-2 max-h-40 divide-y divide-line overflow-y-auto rounded-md border border-line bg-white">
                  {activeChildren.map((child) => (
                    <div key={child.id} className="px-3 py-2">
                      <p className="truncate text-sm font-semibold text-ink-900">{child.name}</p>
                      <p className="truncate text-xs text-ink-500">{child.slug}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        }
        confirmLabel={
          archiveOrgAction?.id === org.id && activeChildren.length > 0
            ? 'Archive customers and organization'
            : 'Archive organization'
        }
        tone="danger"
        loading={archiveOrgMutation.isPending}
        onConfirm={() => {
          if (!archiveOrgAction) return;
          archiveOrgMutation.mutate({
            organizationId: archiveOrgAction.id,
            childOrganizationIds:
              archiveOrgAction.id === org.id && activeChildren.length > 0
                ? activeChildren.map((child) => child.id)
                : undefined,
          });
        }}
      />
      <ConfirmationDialog
        open={!!userStatusAction}
        onOpenChange={(open) => !open && setUserStatusAction(null)}
        title={userStatusAction?.status === 'ACTIVE' ? 'Suspend user?' : 'Reactivate user?'}
        description={`${userStatusAction?.email ?? 'This user'} will ${
          userStatusAction?.status === 'ACTIVE' ? 'lose access' : 'regain access'
        } for this organization according to their role.`}
        confirmLabel={userStatusAction?.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
        tone={userStatusAction?.status === 'ACTIVE' ? 'warning' : 'success'}
        loading={updateUserStatusMutation.isPending}
        onConfirm={() => {
          if (userStatusAction) updateUserStatusMutation.mutate(userStatusAction);
        }}
      />
      <ConfirmationDialog
        open={!!userLogoutAction}
        onOpenChange={(open) => !open && setUserLogoutAction(null)}
        title="Force logout user?"
        description={`${userLogoutAction?.email ?? 'This user'} will need to sign in again on active sessions.`}
        confirmLabel="Force logout"
        tone="warning"
        loading={forceLogoutMutation.isPending}
        onConfirm={() => {
          if (userLogoutAction) forceLogoutMutation.mutate(userLogoutAction);
        }}
      />
      <ConfirmationDialog
        open={!!userArchiveAction}
        onOpenChange={(open) => !open && setUserArchiveAction(null)}
        title="Archive user?"
        description={`${userArchiveAction?.email ?? 'This user'} will lose access and active sessions will be revoked.`}
        confirmLabel="Archive user"
        tone="danger"
        loading={archiveUserMutation.isPending}
        onConfirm={() => {
          if (userArchiveAction) archiveUserMutation.mutate(userArchiveAction);
        }}
      />
      <ConfirmationDialog
        open={!!keyRevokeAction}
        onOpenChange={(open) => !open && setKeyRevokeAction(null)}
        title="Revoke activation key?"
        description={`${keyRevokeAction?.label ?? 'This activation key'} and active device bindings for it will be disabled.`}
        confirmLabel="Revoke key"
        tone="danger"
        loading={revokeKeyMutation.isPending}
        onConfirm={() => {
          if (keyRevokeAction) revokeKeyMutation.mutate(keyRevokeAction);
        }}
      />
      <ConfirmationDialog
        open={!!keyReplaceAction}
        onOpenChange={(open) => !open && setKeyReplaceAction(null)}
        title="Replace activation key?"
        description={`${keyReplaceAction?.label ?? 'This activation key'} will be disabled and a replacement key will be created.`}
        confirmLabel="Replace key"
        tone="warning"
        loading={replaceKeyMutation.isPending}
        onConfirm={() => {
          if (keyReplaceAction) replaceKeyMutation.mutate(keyReplaceAction);
        }}
      />
      {emailKeysOpen && (
        <EmailActivationKeysDialog
          open={emailKeysOpen}
          organizationId={org.id}
          organizationName={org.name}
          keys={activationKeys}
          onOpenChange={setEmailKeysOpen}
          onSent={invalidateOrganizationDetail}
        />
      )}
    </div>
  );
}
