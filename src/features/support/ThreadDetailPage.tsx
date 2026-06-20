import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Send, X } from 'lucide-react';
import { toast } from 'sonner';

import { supportApi, type ApplySupportActionPayload } from '@/services/support.api';
import { extractApiError } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import {
  SUPPORT_CATEGORY_LABEL,
  SUPPORT_PRIORITY_LABEL,
  SUPPORT_STATUS_LABEL,
  type SupportPriority,
  type SupportThreadEventRecord,
  type SupportThreadStatus,
} from '@/types/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { findPreset } from './presets';

interface ThreadDetailPageProps {
  variant: 'org' | 'super';
}

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

function eventSummary(event: SupportThreadEventRecord): string {
  const actor = event.actor.name ?? event.actor.email;
  switch (event.type) {
    case 'REPLIED':
      return `${actor} replied`;
    case 'STATUS_CHANGE': {
      const payload = event.payload as { from?: string; to?: string };
      return `${actor} changed status: ${payload.from ?? '?'} → ${payload.to ?? '?'}`;
    }
    case 'PRIORITY_CHANGE': {
      const payload = event.payload as { from?: string; to?: string };
      return `${actor} changed priority: ${payload.from ?? '?'} → ${payload.to ?? '?'}`;
    }
    case 'ACTION_APPLIED': {
      const payload = event.payload as { kind?: string; result?: Record<string, unknown> };
      return `${actor} applied action “${payload.kind ?? 'action'}”`;
    }
    default:
      return `${actor} updated the thread`;
  }
}

export function ThreadDetailPage({ variant }: ThreadDetailPageProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const threadQuery = useQuery({
    queryKey: ['support', 'thread', id],
    queryFn: () => supportApi.get(id!),
    enabled: !!id,
  });
  const [reply, setReply] = useState('');

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['support', 'thread', id] });
    queryClient.invalidateQueries({ queryKey: ['support', 'threads'] });
  };

  const replyMutation = useMutation({
    mutationFn: (body: string) => supportApi.reply(id!, body),
    onSuccess: () => {
      setReply('');
      invalidate();
      toast.success('Reply sent');
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const statusMutation = useMutation({
    mutationFn: (status: SupportThreadStatus) => supportApi.updateStatus(id!, status),
    onSuccess: () => {
      invalidate();
      toast.success('Status updated');
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const priorityMutation = useMutation({
    mutationFn: (priority: SupportPriority) => supportApi.setPriority(id!, priority),
    onSuccess: () => {
      invalidate();
      toast.success('Priority updated');
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const actionMutation = useMutation({
    mutationFn: (payload: ApplySupportActionPayload) => supportApi.applyAction(id!, payload),
    onSuccess: () => {
      invalidate();
      toast.success('Action applied');
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  if (threadQuery.isLoading || !threadQuery.data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-7 w-7 text-brand-primary" />
      </div>
    );
  }

  const thread = threadQuery.data;
  const preset = findPreset(thread.category);
  const messages = thread.messages ?? [];
  const events = thread.events ?? [];

  const timeline = [
    ...messages.map((message) => ({
      kind: 'message' as const,
      id: message.id,
      createdAt: message.createdAt,
      message,
    })),
    ...events
      .filter((event) => event.type !== 'REPLIED')
      .map((event) => ({
        kind: 'event' as const,
        id: event.id,
        createdAt: event.createdAt,
        event,
      })),
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate(variant === 'super' ? '/support' : '/help')}
          >
            <ArrowLeft className="h-4 w-4" />
            {variant === 'super' ? 'Support Inbox' : 'Help'}
          </Button>
          <h2 className="mt-2 text-2xl font-black text-ink-900">{thread.subject}</h2>
          <p className="text-sm text-ink-500">
            {thread.organization.name} · {SUPPORT_CATEGORY_LABEL[thread.category]} · opened{' '}
            {formatDate(thread.createdAt)} by {thread.openedBy.name ?? thread.openedBy.email}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusVariant(thread.status)}>{SUPPORT_STATUS_LABEL[thread.status]}</Badge>
          <Badge variant="default">{SUPPORT_PRIORITY_LABEL[thread.priority]}</Badge>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <Card className="space-y-4 px-4 py-5 sm:px-6">
          {timeline.length === 0 ? (
            <p className="text-sm text-ink-500">No messages yet.</p>
          ) : (
            timeline.map((entry) =>
              entry.kind === 'message' ? (
                <div key={entry.id} className="rounded-lg border border-line bg-surface-variant px-4 py-3">
                  <p className="text-xs font-semibold text-ink-700">
                    {entry.message.author.name ?? entry.message.author.email}
                    <span className="ml-2 font-normal text-ink-500">
                      {formatDate(entry.message.createdAt)}
                    </span>
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-ink-900">
                    {entry.message.body}
                  </p>
                </div>
              ) : (
                <div
                  key={entry.id}
                  className="rounded-lg border border-dashed border-line bg-white px-4 py-2 text-xs text-ink-500"
                >
                  {eventSummary(entry.event)} · {formatDate(entry.event.createdAt)}
                </div>
              ),
            )
          )}

          {thread.status !== 'CLOSED' && (
            <div className="space-y-2 border-t border-line pt-4">
              <textarea
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                placeholder="Write a reply…"
                rows={4}
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-primary focus:outline-none"
              />
              <div className="flex justify-end">
                <Button
                  variant="primary"
                  disabled={!reply.trim() || replyMutation.isPending}
                  onClick={() => replyMutation.mutate(reply.trim())}
                >
                  {replyMutation.isPending ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                  Send reply
                </Button>
              </div>
            </div>
          )}
        </Card>

        <div className="space-y-5">
          {variant === 'super' && (
            <Card className="space-y-3 px-4 py-5 sm:px-6">
              <h3 className="text-sm font-bold text-ink-900">Triage</h3>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Priority
                </label>
                <Select
                  value={thread.priority}
                  onValueChange={(value) => priorityMutation.mutate(value as SupportPriority)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Status
                </label>
                <Select
                  value={thread.status}
                  onValueChange={(value) => statusMutation.mutate(value as SupportThreadStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPEN">Open</SelectItem>
                    <SelectItem value="IN_PROGRESS">In progress</SelectItem>
                    <SelectItem value="RESOLVED">Resolved</SelectItem>
                    <SelectItem value="CLOSED">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Card>
          )}

          {variant === 'super' && preset?.actionable && (
            <Card className="space-y-3 px-4 py-5 sm:px-6">
              <h3 className="text-sm font-bold text-ink-900">Inline action</h3>
              <ActionPanel
                category={thread.category}
                organizationId={thread.organizationId}
                onApply={(payload) => actionMutation.mutate(payload)}
                disabled={actionMutation.isPending}
                suggestedSeats={
                  (thread.requestedAction as { params?: { to?: number } } | null)?.params?.to
                }
                suggestedEndDate={
                  (thread.requestedAction as { params?: { newEndDate?: string } } | null)?.params
                    ?.newEndDate
                }
              />
            </Card>
          )}

          {variant === 'org' && thread.status !== 'CLOSED' && (
            <Card className="space-y-3 px-4 py-5 sm:px-6">
              <h3 className="text-sm font-bold text-ink-900">Actions</h3>
              <div className="flex justify-stretch sm:justify-start">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => statusMutation.mutate('CLOSED')}
                  disabled={statusMutation.isPending}
                >
                  <X className="h-4 w-4" />
                  Close this request
                </Button>
              </div>
            </Card>
          )}

          {thread.status === 'RESOLVED' && (
            <Card className="px-4 py-5 text-sm text-ink-700 sm:px-6">
              <p className="flex items-center gap-2 font-semibold text-success">
                <CheckCircle2 className="h-4 w-4" />
                Resolved
              </p>
              <p className="mt-1 text-xs text-ink-500">
                Marked resolved {thread.resolvedAt ? formatDate(thread.resolvedAt) : ''} by{' '}
                {thread.resolvedBy?.name ?? thread.resolvedBy?.email ?? '—'}.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

interface ActionPanelProps {
  category: import('@/types/api').SupportCategory;
  organizationId: string;
  suggestedSeats?: number;
  suggestedEndDate?: string;
  disabled: boolean;
  onApply: (payload: ApplySupportActionPayload) => void;
}

function ActionPanel({
  category,
  suggestedSeats,
  suggestedEndDate,
  disabled,
  onApply,
}: ActionPanelProps) {
  const [seats, setSeats] = useState<number>(suggestedSeats ?? 0);
  const [endDate, setEndDate] = useState<string>(
    suggestedEndDate ? suggestedEndDate.slice(0, 10) : '',
  );

  if (category === 'REQUEST_SEATS') {
    return (
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
          New seat limit
        </label>
        <Input
          type="number"
          min={1}
          value={seats || ''}
          onChange={(event) => setSeats(Number(event.target.value))}
        />
        <Button
          variant="primary"
          className="w-full sm:w-auto"
          disabled={disabled || seats < 1}
          onClick={() =>
            onApply({
              kind: 'seats_increase',
              params: { to: seats },
              autoResolve: true,
            })
          }
        >
          Apply seats = {seats || '—'} &amp; resolve
        </Button>
      </div>
    );
  }
  if (category === 'EXTEND_SUBSCRIPTION') {
    return (
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
          New end date
        </label>
        <Input
          type="date"
          value={endDate}
          onChange={(event) => setEndDate(event.target.value)}
        />
        <Button
          variant="primary"
          className="w-full sm:w-auto"
          disabled={disabled || !endDate}
          onClick={() =>
            onApply({
              kind: 'subscription_extend',
              params: { newEndDate: endDate ? new Date(endDate).toISOString() : '' },
              autoResolve: true,
            })
          }
        >
          Extend &amp; resolve
        </Button>
      </div>
    );
  }
  if (category === 'RESET_DEVICE') {
    return (
      <p className="text-xs text-ink-500">
        Reset is performed from the License / Subscription detail page where you can pick the exact
        bound device. Once reset, mark this thread resolved.
      </p>
    );
  }
  return null;
}
