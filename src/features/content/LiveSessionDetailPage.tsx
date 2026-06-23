import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Bot,
  CalendarClock,
  FileVideo,
  Link2,
  MessageSquareText,
  MonitorPlay,
  Radio,
  Users,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

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
import { api, extractApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { formatDateTime } from '@/lib/utils';
import { contentApi } from '@/services/content.api';
import {
  LIVE_SESSION_STATUS_LABEL,
  type AdminLiveSessionRecord,
  type LiveSessionStatus,
} from '@/types/api';

function statusVariant(status: LiveSessionStatus) {
  if (status === 'LIVE') return 'success' as const;
  if (status === 'SCHEDULED') return 'info' as const;
  if (status === 'CANCELLED') return 'danger' as const;
  return 'default' as const;
}

function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function durationLabel(session: AdminLiveSessionRecord) {
  if (!session.startedAt) return 'Not started';
  const end = session.endedAt ? new Date(session.endedAt) : new Date();
  const elapsed = Math.max(0, end.getTime() - new Date(session.startedAt).getTime());
  const minutes = Math.floor(elapsed / 60000);
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

function personLabel(person?: {
  name: string | null;
  email: string;
  role: string;
} | null) {
  if (!person) return 'Not assigned';
  return `${person.name ?? person.email} (${person.role.replaceAll('_', ' ')})`;
}

function payloadPreview(payload: Record<string, unknown> | null | undefined) {
  if (!payload || Object.keys(payload).length === 0) return 'No additional payload';
  return JSON.stringify(payload, null, 2);
}

function DetailStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
}) {
  return (
    <Card className="flex items-center gap-3 px-4 py-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</p>
        <p className="truncate text-lg font-bold text-ink-900">{value}</p>
      </div>
    </Card>
  );
}

export function LiveSessionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const actor = useAuthStore((state) => state.user);
  const isTeacher = actor?.role === 'TEACHER';
  const query = useQuery({
    queryKey: ['live-session-detail', id, actor?.role],
    queryFn: async () => {
      if (isTeacher) {
        const response = await api.get<{ data: AdminLiveSessionRecord }>(
          `/live-sessions/${id}/details`,
        );
        return response.data.data;
      }
      return contentApi.liveSessions.get(id!);
    },
    enabled: Boolean(id),
  });

  if (query.isLoading) {
    return (
      <div className="flex min-h-[480px] items-center justify-center">
        <Spinner className="h-7 w-7 text-brand-primary" />
      </div>
    );
  }

  if (!query.data || query.isError) {
    return (
      <Card className="space-y-3 px-5 py-6">
        <p className="font-semibold text-ink-900">Live session details are unavailable.</p>
        <p className="text-sm text-ink-500">
          {query.error ? extractApiError(query.error) : 'The session may be outside your account scope.'}
        </p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </Card>
    );
  }

  const session = query.data;
  const aiEvents = session.events.filter((event) => event.type === 'AI_SUMMARY_GENERATED');
  const backPath = isTeacher ? '/teacher/sessions' : '/content?tab=live-sessions';

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Button type="button" size="icon" variant="outline" onClick={() => navigate(backPath)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-xl font-bold text-ink-900">
                {session.title ?? session.canvas?.name ?? 'Live Session'}
              </h2>
              <Badge variant={statusVariant(session.status)}>
                {LIVE_SESSION_STATUS_LABEL[session.status]}
              </Badge>
            </div>
            <p className="mt-1 break-all text-sm text-ink-500">Session ID: {session.id}</p>
          </div>
        </div>
        <div className="rounded-lg border border-line bg-white px-4 py-3 text-sm shadow-sm">
          <p className="font-semibold text-ink-900">{session.organization?.name ?? 'No organization'}</p>
          <p className="text-xs text-ink-500">{session.canvas?.name ?? session.canvasId}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <DetailStat icon={Users} label="Participants" value={session._count.participants} />
        <DetailStat icon={MessageSquareText} label="Messages" value={session._count.messages} />
        <DetailStat icon={FileVideo} label="Media" value={session._count.mediaAssets} />
        <DetailStat icon={Radio} label="Events" value={session._count.events} />
        <DetailStat icon={CalendarClock} label="Duration" value={durationLabel(session)} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="px-5 py-5">
          <h3 className="text-base font-bold text-ink-900">Session overview</h3>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div><dt className="text-xs font-semibold text-ink-400">Host</dt><dd className="mt-1 text-sm text-ink-800">{personLabel(session.host)}</dd></div>
            <div><dt className="text-xs font-semibold text-ink-400">Created by</dt><dd className="mt-1 text-sm text-ink-800">{personLabel(session.createdBy)}</dd></div>
            <div><dt className="text-xs font-semibold text-ink-400">Organization</dt><dd className="mt-1 text-sm text-ink-800">{session.organization?.name ?? 'None'}</dd></div>
            <div><dt className="text-xs font-semibold text-ink-400">Canvas</dt><dd className="mt-1 text-sm text-ink-800">{session.canvas?.name ?? session.canvasId}</dd></div>
            <div><dt className="text-xs font-semibold text-ink-400">Created</dt><dd className="mt-1 text-sm text-ink-800">{formatDateTime(session.createdAt)}</dd></div>
            <div><dt className="text-xs font-semibold text-ink-400">Updated</dt><dd className="mt-1 text-sm text-ink-800">{formatDateTime(session.updatedAt)}</dd></div>
            <div><dt className="text-xs font-semibold text-ink-400">Started</dt><dd className="mt-1 text-sm text-ink-800">{formatDateTime(session.startedAt)}</dd></div>
            <div><dt className="text-xs font-semibold text-ink-400">Ended</dt><dd className="mt-1 text-sm text-ink-800">{formatDateTime(session.endedAt)}</dd></div>
          </dl>
        </Card>

        <Card className="px-5 py-5">
          <h3 className="text-base font-bold text-ink-900">Join and access</h3>
          <div className="mt-4 space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-line bg-surface-variant px-4 py-3">
              <Link2 className="mt-0.5 h-4 w-4 text-brand-primary" />
              <div>
                <p className="text-xs font-semibold text-ink-400">Join code</p>
                <p className="mt-1 font-mono text-sm font-bold text-ink-900">{session.joinCode ?? 'Not generated'}</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-ink-400">Join code expiry</p>
              <p className="mt-1 text-sm text-ink-800">{formatDateTime(session.joinCodeExpiresAt)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-ink-400">Organization ID</p>
              <p className="mt-1 break-all font-mono text-xs text-ink-600">{session.organizationId ?? 'None'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-ink-400">Canvas ID</p>
              <p className="mt-1 break-all font-mono text-xs text-ink-600">{session.canvasId}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="border-b border-line px-5 py-4">
          <h3 className="text-base font-bold text-ink-900">Participants</h3>
          <p className="text-sm text-ink-500">Join history, role, and disconnect timing.</p>
        </div>
        <Table className="min-w-[760px]">
          <TableHeader><TableRow><TableHead>Participant</TableHead><TableHead>Role</TableHead><TableHead>Joined</TableHead><TableHead>Left</TableHead><TableHead>User ID</TableHead></TableRow></TableHeader>
          <TableBody>
            {(session.participants ?? []).map((participant) => (
              <TableRow key={participant.id}>
                <TableCell><p className="font-semibold text-ink-900">{participant.user.name ?? participant.user.email}</p><p className="text-xs text-ink-500">{participant.user.email}</p></TableCell>
                <TableCell><Badge variant="default">{participant.role}</Badge></TableCell>
                <TableCell>{formatDateTime(participant.joinedAt)}</TableCell>
                <TableCell>{formatDateTime(participant.leftAt)}</TableCell>
                <TableCell className="font-mono text-xs text-ink-500">{participant.userId}</TableCell>
              </TableRow>
            ))}
            {(session.participants ?? []).length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-ink-500">No participant records.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="px-5 py-5">
          <div className="flex items-center gap-2"><MessageSquareText className="h-5 w-5 text-brand-primary" /><h3 className="text-base font-bold text-ink-900">Messages</h3></div>
          <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto">
            {(session.messages ?? []).map((message) => (
              <div key={message.id} className="rounded-lg border border-line px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ink-900">{message.sender?.name ?? message.sender?.email ?? message.guestParticipant?.displayName ?? 'System'}</p>
                  <Badge variant="default">{message.type}</Badge>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-ink-600">{message.body || message.attachmentName || 'No text body'}</p>
                <p className="mt-2 text-xs text-ink-400">{formatDateTime(message.createdAt)}</p>
              </div>
            ))}
            {(session.messages ?? []).length === 0 && <p className="text-sm text-ink-500">No messages recorded.</p>}
          </div>
        </Card>

        <Card className="px-5 py-5">
          <div className="flex items-center gap-2"><Bot className="h-5 w-5 text-brand-primary" /><h3 className="text-base font-bold text-ink-900">AI output</h3></div>
          <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto">
            {aiEvents.map((event) => (
              <div key={event.id} className="rounded-lg border border-brand-primary/15 bg-brand-primary/[0.035] px-4 py-3">
                <p className="text-sm font-semibold text-ink-900">AI summary generated</p>
                <p className="mt-1 text-xs text-ink-500">{formatDateTime(event.createdAt)}</p>
                <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs text-ink-600">{payloadPreview(event.payload)}</pre>
              </div>
            ))}
            {aiEvents.length === 0 && <p className="text-sm text-ink-500">No AI summary has been generated.</p>}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="px-5 py-5">
          <div className="flex items-center gap-2"><MonitorPlay className="h-5 w-5 text-brand-primary" /><h3 className="text-base font-bold text-ink-900">Media</h3></div>
          <div className="mt-4 space-y-3">
            {(session.mediaAssets ?? []).map((asset) => (
              <div key={asset.id} className="rounded-lg border border-line px-3 py-3">
                <p className="truncate text-sm font-semibold text-ink-900">{asset.fileName}</p>
                <p className="mt-1 text-xs text-ink-500">{asset.kind} · {asset.mimeType} · {formatBytes(asset.sizeBytes)}</p>
                <p className="mt-1 text-xs text-ink-400">{formatDateTime(asset.createdAt)}</p>
              </div>
            ))}
            {(session.mediaAssets ?? []).length === 0 && <p className="text-sm text-ink-500">No media assets.</p>}
          </div>
        </Card>

        <Card className="px-5 py-5">
          <div className="flex items-center gap-2"><FileVideo className="h-5 w-5 text-brand-primary" /><h3 className="text-base font-bold text-ink-900">Recordings</h3></div>
          <div className="mt-4 space-y-3">
            {(session.recordings ?? []).map((recording) => (
              <div key={recording.id} className="rounded-lg border border-line px-3 py-3">
                <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-ink-900">{recording.createdBy?.name ?? recording.createdBy?.email ?? 'Recording'}</p><Badge variant={recording.status === 'READY' ? 'success' : recording.status === 'FAILED' ? 'danger' : 'warning'}>{recording.status}</Badge></div>
                <p className="mt-1 text-xs text-ink-500">{recording.durationSeconds ? `${recording.durationSeconds}s` : 'Duration pending'}</p>
                <p className="mt-1 text-xs text-ink-400">{formatDateTime(recording.createdAt)}</p>
              </div>
            ))}
            {(session.recordings ?? []).length === 0 && <p className="text-sm text-ink-500">No recordings.</p>}
          </div>
        </Card>

        <Card className="px-5 py-5">
          <div className="flex items-center gap-2"><Radio className="h-5 w-5 text-brand-primary" /><h3 className="text-base font-bold text-ink-900">Event timeline</h3></div>
          <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto">
            {session.events.map((event) => (
              <div key={event.id} className="border-l-2 border-brand-primary/30 pl-3">
                <p className="text-sm font-semibold text-ink-900">{event.type.replaceAll('_', ' ')}</p>
                <p className="text-xs text-ink-500">{event.actor?.name ?? event.actor?.email ?? 'System'} · {formatDateTime(event.createdAt)}</p>
              </div>
            ))}
            {session.events.length === 0 && <p className="text-sm text-ink-500">No events recorded.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
