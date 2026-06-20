import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Eye } from 'lucide-react';

import { supportApi } from '@/services/support.api';
import { organizationsApi } from '@/services/organizations.api';
import { formatDate } from '@/lib/utils';
import { useAuthStore } from '@/lib/auth-store';
import {
  ALL_PARTNERS_VALUE,
  organizationBelongsToPartner,
  organizationsForPartner,
  partnerOrganizations,
} from '@/lib/admin-hierarchy';
import {
  SUPPORT_CATEGORY_LABEL,
  SUPPORT_PRIORITY_LABEL,
  SUPPORT_STATUS_LABEL,
  type SupportCategory,
  type SupportPriority,
  type SupportThreadStatus,
} from '@/types/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
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

function statusVariant(status: SupportThreadStatus) {
  switch (status) {
    case 'OPEN':
      return 'info' as const;
    case 'IN_PROGRESS':
      return 'warning' as const;
    case 'RESOLVED':
      return 'success' as const;
    case 'CLOSED':
    default:
      return 'default' as const;
  }
}

export function SupportInboxPage() {
  const navigate = useNavigate();
  const { user: actor } = useAuthStore();
  const isSuperAdmin = actor?.role === 'SUPER_ADMIN';
  const [status, setStatus] = useState<SupportThreadStatus | 'ALL'>('OPEN');
  const [category, setCategory] = useState<SupportCategory | 'ALL'>('ALL');
  const [priority, setPriority] = useState<SupportPriority | 'ALL'>('ALL');
  const [partnerOrganizationId, setPartnerOrganizationId] = useState<string | 'ALL'>('ALL');
  const [organizationId, setOrganizationId] = useState<string | 'ALL'>('ALL');

  const organizationsQuery = useQuery({
    queryKey: ['organizations', 'all'],
    queryFn: organizationsApi.all,
  });
  const partners = useMemo(
    () => partnerOrganizations(organizationsQuery.data ?? []),
    [organizationsQuery.data],
  );
  const organizationOptions = useMemo(
    () => organizationsForPartner(organizationsQuery.data ?? [], partnerOrganizationId),
    [organizationsQuery.data, partnerOrganizationId],
  );

  const handlePartnerChange = (value: string) => {
    setPartnerOrganizationId(value);
    const selectedOrganization = organizationsQuery.data?.find(
      (organization) => organization.id === organizationId,
    );
    if (
      organizationId !== 'ALL' &&
      !organizationBelongsToPartner(selectedOrganization, value)
    ) {
      setOrganizationId('ALL');
    }
  };

  const threadsQuery = useQuery({
    queryKey: [
      'support',
      'threads',
      'all',
      status,
      category,
      priority,
      partnerOrganizationId,
      organizationId,
    ],
    queryFn: () =>
      supportApi.list({
        status: status === 'ALL' ? undefined : status,
        category: category === 'ALL' ? undefined : category,
        priority: priority === 'ALL' ? undefined : priority,
        partnerOrganizationId:
          partnerOrganizationId === 'ALL' ? undefined : partnerOrganizationId,
        organizationId: organizationId === 'ALL' ? undefined : organizationId,
        perPage: 100,
      }),
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-black text-ink-900">Support Inbox</h2>
        <p className="text-sm text-ink-500">
          Requests opened by organization admins. Apply inline changes (seats, expiry, device
          resets) without leaving the thread.
        </p>
      </div>

      <Card className="space-y-4 px-4 py-5 sm:px-6">
        <div
          className={`grid gap-3 sm:grid-cols-2 ${
            isSuperAdmin ? 'lg:grid-cols-5' : 'lg:grid-cols-4'
          }`}
        >
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              Status
            </label>
            <Select value={status} onValueChange={(value) => setStatus(value as SupportThreadStatus | 'ALL')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="IN_PROGRESS">In progress</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              Category
            </label>
            <Select value={category} onValueChange={(value) => setCategory(value as SupportCategory | 'ALL')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                {Object.entries(SUPPORT_CATEGORY_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              Priority
            </label>
            <Select value={priority} onValueChange={(value) => setPriority(value as SupportPriority | 'ALL')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                {Object.entries(SUPPORT_PRIORITY_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isSuperAdmin && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                Partner
              </label>
              <Select value={partnerOrganizationId} onValueChange={handlePartnerChange}>
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
            </div>
          )}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              Organization
            </label>
            <Select value={organizationId} onValueChange={(value) => setOrganizationId(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">
                  {isSuperAdmin && partnerOrganizationId !== 'ALL'
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
          </div>
        </div>

        {threadsQuery.isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Spinner className="h-6 w-6 text-brand-primary" />
          </div>
        ) : (
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Last activity</TableHead>
                <TableHead className="text-right">Open</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {threadsQuery.data?.data.map((thread) => (
                <TableRow key={thread.id}>
                  <TableCell className="min-w-0">
                    <Link
                      to={`/support/${thread.id}`}
                      className="block max-w-[280px] truncate text-sm font-semibold text-ink-900 hover:underline"
                    >
                      {thread.subject}
                    </Link>
                    <p className="max-w-[320px] truncate text-xs text-ink-500">
                      Opened {formatDate(thread.createdAt)} by{' '}
                      {thread.openedBy.name ?? thread.openedBy.email}
                    </p>
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate">{thread.organization.name}</TableCell>
                  <TableCell className="whitespace-nowrap">{SUPPORT_CATEGORY_LABEL[thread.category]}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge variant={statusVariant(thread.status)}>
                      {SUPPORT_STATUS_LABEL[thread.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge variant="default">{SUPPORT_PRIORITY_LABEL[thread.priority]}</Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(thread.lastActivityAt)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => navigate(`/support/${thread.id}`)}
                      title="Open"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(threadsQuery.data?.data.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-ink-500">
                    No threads match these filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
