import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import { organizationsApi } from '@/services/organizations.api';
import { extractApiError } from '@/lib/api';
import type { AdminOrganization } from '@/types/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const HOUR = 60 * 60 * 1000;
const localDateTime = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export function PlayStoreMigrationDialog({
  organization,
  onOpenChange,
}: {
  organization: AdminOrganization | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('Play Store app rollout for existing panels');
  const [duration, setDuration] = useState('168');
  const [startsAt, setStartsAt] = useState(() => localDateTime(new Date()));
  const [endsAt, setEndsAt] = useState(() => localDateTime(new Date(Date.now() + 7 * 24 * HOUR)));
  const status = useQuery({
    queryKey: ['play-store-migration', organization?.id],
    queryFn: () => organizationsApi.getPlayStoreMigration(organization!.id),
    enabled: Boolean(organization),
  });
  const campaign = status.data?.campaign;
  const scheduled = campaign?.effectiveStatus === 'SCHEDULED';
  const active = scheduled && new Date(campaign.startsAt) <= new Date() && new Date(campaign.endsAt) > new Date();
  const updateEnd = (hours: string) => {
    setDuration(hours);
    if (hours !== 'custom') setEndsAt(localDateTime(new Date(new Date(startsAt).getTime() + Number(hours) * HOUR)));
  };
  useEffect(() => {
    if (!organization) return;
    const start = new Date();
    setStartsAt(localDateTime(start));
    setEndsAt(localDateTime(new Date(start.getTime() + 7 * 24 * HOUR)));
    setDuration('168');
  }, [organization]);
  const schedule = useMutation({
    mutationFn: () => organizationsApi.schedulePlayStoreMigration(organization!.id, {
      reason: reason.trim(), startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString(),
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['play-store-migration', organization?.id] }); toast.success('Play Store migration scheduled'); },
    onError: (error) => toast.error(extractApiError(error)),
  });
  const cancel = useMutation({
    mutationFn: () => organizationsApi.cancelPlayStoreMigration(organization!.id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['play-store-migration', organization?.id] }); toast.success('Migration cancelled'); },
    onError: (error) => toast.error(extractApiError(error)),
  });
  const retry = useMutation({
    mutationFn: () => organizationsApi.retryPlayStoreMigrationEmail(organization!.id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['play-store-migration', organization?.id] }); toast.success('Migration email retried'); },
    onError: (error) => toast.error(extractApiError(error)),
  });
  const valid = useMemo(() => reason.trim().length >= 5 && new Date(endsAt) > new Date(startsAt), [reason, startsAt, endsAt]);

  return <Dialog open={Boolean(organization)} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-xl">
      <DialogHeader>
        <DialogTitle>Enable Play Store migration</DialogTitle>
        <DialogDescription>
          A temporary, organisation-only window lets existing panels transfer their own key to the Play Store installation. It never resets keys in bulk.
        </DialogDescription>
      </DialogHeader>
      {status.isLoading ? <p className="py-6 text-sm text-ink-500">Loading migration status…</p> : <div className="space-y-4">
        <div className="rounded-lg border border-line bg-surface-variant p-3 text-sm text-ink-700">
          <div className="flex items-center gap-2 font-semibold text-ink-900"><ShieldCheck className="h-4 w-4 text-brand-primary" /> {status.data?.keyCount ?? 0} usable activation key(s)</div>
          <p className="mt-1">Notification recipient: {status.data?.primaryAdmin?.email ?? 'No primary admin email configured'}</p>
        </div>
        {scheduled ? <div className="space-y-3 rounded-lg border border-success/30 bg-success/5 p-3">
          <div className="flex items-center justify-between"><span className="font-semibold text-ink-900">Migration {active ? 'active' : 'scheduled'}</span><Badge variant="success">{active ? 'Ends' : 'Starts'} {new Date(active ? campaign.endsAt : campaign.startsAt).toLocaleString()}</Badge></div>
          <p className="text-sm text-ink-700">Reason: {campaign.reason}</p>
          <p className="text-sm text-ink-700">Email: {campaign.emailSentAt ? `sent ${new Date(campaign.emailSentAt).toLocaleString()}` : campaign.emailLastError ?? 'pending'}</p>
          <DialogFooter className="gap-2 sm:justify-between"><Button variant="outline" size="sm" disabled={retry.isPending} onClick={() => retry.mutate()}><Mail className="mr-2 h-4 w-4" />Retry email</Button><Button variant="destructive" size="sm" disabled={cancel.isPending} onClick={() => cancel.mutate()}>Cancel migration</Button></DialogFooter>
        </div> : <>
          <div className="grid gap-2"><Label htmlFor="migration-reason">Reason</Label><Input id="migration-reason" value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} /></div>
          <div className="grid gap-2"><Label>Duration</Label><Select value={duration} onValueChange={updateEnd}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="24">24 hours</SelectItem><SelectItem value="72">3 days</SelectItem><SelectItem value="168">7 days (recommended)</SelectItem><SelectItem value="336">14 days</SelectItem><SelectItem value="custom">Custom (up to 30 days)</SelectItem></SelectContent></Select></div>
          <div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="migration-start">Start</Label><Input id="migration-start" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="migration-end">End</Label><Input id="migration-end" type="datetime-local" value={endsAt} onChange={(event) => { setDuration('custom'); setEndsAt(event.target.value); }} /></div></div>
          <p className="text-xs text-ink-500">One active transfer per key. The user must sign in and enter the key already used on that panel before this deadline.</p>
          <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button><Button disabled={!valid || schedule.isPending} onClick={() => schedule.mutate()}>Schedule migration</Button></DialogFooter>
        </>}
      </div>}
    </DialogContent>
  </Dialog>;
}
