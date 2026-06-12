import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Eye, Plus } from 'lucide-react';

import { supportApi } from '@/services/support.api';
import { formatDate } from '@/lib/utils';
import {
  SUPPORT_CATEGORY_LABEL,
  SUPPORT_PRIORITY_LABEL,
  SUPPORT_STATUS_LABEL,
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

const STATUS_FILTERS: { value: SupportThreadStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
];

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

export function HelpThreadsPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<SupportThreadStatus | 'ALL'>('ALL');
  const threadsQuery = useQuery({
    queryKey: ['support', 'threads', 'own', status],
    queryFn: () =>
      supportApi.list({ status: status === 'ALL' ? undefined : status, perPage: 50 }),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-black text-ink-900">Help &amp; Support</h2>
          <p className="text-sm text-ink-500">
            Ask the SoftLogic team for more seats, extensions, device resets, or any other
            question. Replies and status updates arrive by email and show up here.
          </p>
        </div>
        <Button variant="primary" onClick={() => navigate('/help/new')}>
          <Plus className="h-4 w-4" />
          Start new request
        </Button>
      </div>

      <Card className="space-y-4 px-4 py-5 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">
            Status
          </span>
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as SupportThreadStatus | 'ALL')}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {threadsQuery.isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Spinner className="h-6 w-6 text-brand-primary" />
          </div>
        ) : (
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
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
                  <TableCell>
                    <Link
                      to={`/help/${thread.id}`}
                      className="text-sm font-semibold text-ink-900 hover:underline"
                    >
                      {thread.subject}
                    </Link>
                    <p className="text-xs text-ink-500">
                      Opened {formatDate(thread.createdAt)} by{' '}
                      {thread.openedBy.name ?? thread.openedBy.email}
                    </p>
                  </TableCell>
                  <TableCell>{SUPPORT_CATEGORY_LABEL[thread.category]}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(thread.status)}>
                      {SUPPORT_STATUS_LABEL[thread.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="default">{SUPPORT_PRIORITY_LABEL[thread.priority]}</Badge>
                  </TableCell>
                  <TableCell>{formatDate(thread.lastActivityAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => navigate(`/help/${thread.id}`)}
                      title="Open"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(threadsQuery.data?.data.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-ink-500">
                    No requests yet. Start a new one to get help from the SoftLogic team.
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
