import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Pencil,
  Plus,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { extractApiError } from '@/lib/api';
import {
  maintenanceApi,
  type MaintenanceWindowPayload,
  type MaintenanceWindowRecord,
} from '@/services/maintenance.api';
import {
  formatDuration,
  formatMaintenanceDateTime,
  isoFromIstDateTimeLocal,
  istDateTimeLocalValue,
  MAINTENANCE_TIMEZONE,
} from './maintenance-utils';

interface MaintenanceDraft {
  title: string;
  message: string;
  startsAt: string;
  endsAt: string;
  internalNote: string;
}

const defaultDraft = (): MaintenanceDraft => {
  const start = new Date(Date.now() + 30 * 60_000);
  const end = new Date(Date.now() + 90 * 60_000);
  return {
    title: 'Scheduled platform maintenance',
    message:
      'SoftLogic will be temporarily unavailable while we complete planned maintenance.',
    startsAt: istDateTimeLocalValue(start),
    endsAt: istDateTimeLocalValue(end),
    internalNote: '',
  };
};

const openWindowFrom = (windows: MaintenanceWindowRecord[] | undefined) =>
  windows?.find((window) => window.status === 'active' || window.status === 'upcoming') ??
  null;

const statusVariant = (status: MaintenanceWindowRecord['status']) => {
  switch (status) {
    case 'active':
      return 'danger';
    case 'upcoming':
      return 'warning';
    case 'completed':
      return 'success';
    case 'cancelled':
      return 'default';
  }
};

export function MaintenancePage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<MaintenanceDraft>(() => defaultDraft());
  const [cancelTarget, setCancelTarget] = useState<MaintenanceWindowRecord | null>(
    null,
  );

  const windowsQuery = useQuery({
    queryKey: ['maintenance', 'windows'],
    queryFn: maintenanceApi.listWindows,
  });
  const statusQuery = useQuery({
    queryKey: ['maintenance', 'status'],
    queryFn: maintenanceApi.status,
    refetchInterval: 15_000,
  });

  const openWindow = useMemo(
    () => openWindowFrom(windowsQuery.data),
    [windowsQuery.data],
  );

  useEffect(() => {
    if (!openWindow) return;
    setDraft({
      title: openWindow.title,
      message: openWindow.message,
      startsAt: istDateTimeLocalValue(openWindow.startsAt),
      endsAt: istDateTimeLocalValue(openWindow.endsAt),
      internalNote: openWindow.internalNote ?? '',
    });
  }, [openWindow]);

  const invalidateMaintenance = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['maintenance', 'windows'] }),
      queryClient.invalidateQueries({ queryKey: ['maintenance', 'status'] }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: (payload: MaintenanceWindowPayload) =>
      maintenanceApi.createWindow(payload),
    onSuccess: async () => {
      toast.success('Maintenance window scheduled');
      await invalidateMaintenance();
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<MaintenanceWindowPayload>;
    }) => maintenanceApi.updateWindow(id, payload),
    onSuccess: async () => {
      toast.success('Maintenance window updated');
      await invalidateMaintenance();
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => maintenanceApi.cancelWindow(id),
    onSuccess: async () => {
      toast.success('Maintenance window cancelled');
      setCancelTarget(null);
      setDraft(defaultDraft());
      await invalidateMaintenance();
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const payloadFromDraft = (): MaintenanceWindowPayload | null => {
    const startsAt = isoFromIstDateTimeLocal(draft.startsAt);
    const endsAt = isoFromIstDateTimeLocal(draft.endsAt);
    if (!draft.title.trim() || !draft.message.trim() || !startsAt || !endsAt) {
      toast.error('Enter a title, message, start time, and end time.');
      return null;
    }
    if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      toast.error('End time must be after start time.');
      return null;
    }
    return {
      title: draft.title.trim(),
      message: draft.message.trim(),
      startsAt,
      endsAt,
      timezone: MAINTENANCE_TIMEZONE,
      internalNote: draft.internalNote.trim() || null,
    };
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const payload = payloadFromDraft();
    if (!payload) return;
    if (openWindow) {
      updateMutation.mutate({ id: openWindow.id, payload });
      return;
    }
    createMutation.mutate(payload);
  };

  const busy =
    createMutation.isPending || updateMutation.isPending || cancelMutation.isPending;
  const current = statusQuery.data;
  const activeOrUpcoming = current?.window;
  const history = windowsQuery.data ?? [];

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <Card className="p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-brand-primary">
                Maintenance control
              </p>
              <h2 className="mt-1 text-xl font-bold text-ink-900">
                {openWindow ? 'Update scheduled window' : 'Schedule a window'}
              </h2>
              <p className="mt-1 text-sm text-ink-500">
                Times are entered and displayed in IST. The backend stores UTC.
              </p>
            </div>
            {openWindow && (
              <Badge variant={statusVariant(openWindow.status)}>
                {openWindow.status}
              </Badge>
            )}
          </div>

          <form onSubmit={submit} className="mt-5 grid gap-4">
            <Field label="Title">
              <Input
                value={draft.title}
                onChange={(event) =>
                  setDraft((value) => ({ ...value, title: event.target.value }))
                }
                maxLength={120}
              />
            </Field>
            <Field label="User-facing message">
              <textarea
                value={draft.message}
                onChange={(event) =>
                  setDraft((value) => ({ ...value, message: event.target.value }))
                }
                rows={4}
                className="min-h-[112px] w-full resize-y rounded-lg border border-line bg-white px-3.5 py-3 text-sm text-ink-900 shadow-sm outline-none transition placeholder:text-ink-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                maxLength={1200}
              />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Starts at (IST)">
                <Input
                  type="datetime-local"
                  value={draft.startsAt}
                  onChange={(event) =>
                    setDraft((value) => ({
                      ...value,
                      startsAt: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Ends at (IST)">
                <Input
                  type="datetime-local"
                  value={draft.endsAt}
                  onChange={(event) =>
                    setDraft((value) => ({ ...value, endsAt: event.target.value }))
                  }
                />
              </Field>
            </div>
            <Field label="Internal note">
              <textarea
                value={draft.internalNote}
                onChange={(event) =>
                  setDraft((value) => ({
                    ...value,
                    internalNote: event.target.value,
                  }))
                }
                rows={3}
                className="min-h-[88px] w-full resize-y rounded-lg border border-line bg-white px-3.5 py-3 text-sm text-ink-900 shadow-sm outline-none transition placeholder:text-ink-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                placeholder="Optional operational note"
                maxLength={1200}
              />
            </Field>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                {openWindow && (
                  <Button
                    type="button"
                    variant="outline"
                    className="text-danger hover:text-danger"
                    onClick={() => setCancelTarget(openWindow)}
                    disabled={busy}
                  >
                    <XCircle className="h-4 w-4" />
                    Cancel window
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                {!openWindow && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setDraft(defaultDraft())}
                    disabled={busy}
                  >
                    Reset
                  </Button>
                )}
                <Button type="submit" disabled={busy}>
                  {busy ? (
                    <Spinner className="h-4 w-4" />
                  ) : openWindow ? (
                    <Pencil className="h-4 w-4" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {openWindow ? 'Update window' : 'Schedule window'}
                </Button>
              </div>
            </div>
          </form>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-brand-primary">
                Live status
              </p>
              <h2 className="mt-1 text-xl font-bold text-ink-900">
                {current?.state === 'active'
                  ? 'Maintenance is active'
                  : current?.state === 'upcoming'
                    ? 'Window is scheduled'
                    : 'No active window'}
              </h2>
            </div>
            {statusQuery.isFetching ? (
              <Spinner className="h-5 w-5 text-brand-primary" />
            ) : current?.state === 'none' ? (
              <CheckCircle2 className="h-5 w-5 text-success" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-warning" />
            )}
          </div>

          {activeOrUpcoming ? (
            <div className="mt-5 space-y-3">
              <StatusLine
                icon={<ShieldCheck className="h-4 w-4" />}
                label="Window"
                value={activeOrUpcoming.title}
              />
              <StatusLine
                icon={<CalendarClock className="h-4 w-4" />}
                label="Starts"
                value={`${formatMaintenanceDateTime(activeOrUpcoming.startsAt)} IST`}
              />
              <StatusLine
                icon={<Clock3 className="h-4 w-4" />}
                label="Ends"
                value={`${formatMaintenanceDateTime(activeOrUpcoming.endsAt)} IST`}
              />
              <div className="rounded-lg border border-brand-primary/15 bg-brand-primary/10 p-4">
                <p className="text-xs font-semibold uppercase text-brand-primary">
                  {current?.state === 'active' ? 'Remaining' : 'Starts in'}
                </p>
                <p className="mt-1 text-2xl font-bold text-ink-900">
                  {formatDuration(
                    current?.state === 'active'
                      ? activeOrUpcoming.secondsUntilEnd
                      : activeOrUpcoming.secondsUntilStart,
                  )}
                </p>
              </div>
              <p className="rounded-lg bg-surface-variant p-4 text-sm leading-6 text-ink-600">
                {activeOrUpcoming.message}
              </p>
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-line bg-surface-variant/70 p-5 text-sm text-ink-500">
              All normal web and app flows remain available.
            </div>
          )}
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-ink-900">Maintenance history</h2>
            <p className="text-sm text-ink-500">
              Recent scheduled, completed, and cancelled windows.
            </p>
          </div>
          {windowsQuery.isLoading && <Spinner className="h-5 w-5 text-brand-primary" />}
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Window</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Starts</TableHead>
                <TableHead>Ends</TableHead>
                <TableHead>Updated by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((window) => (
                <TableRow key={window.id}>
                  <TableCell>
                    <p className="font-semibold text-ink-900">{window.title}</p>
                    <p className="max-w-md truncate text-xs text-ink-500">
                      {window.message}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(window.status)}>
                      {window.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatMaintenanceDateTime(window.startsAt)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatMaintenanceDateTime(window.endsAt)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {window.updatedBy?.name ?? window.updatedBy?.email ?? '-'}
                  </TableCell>
                </TableRow>
              ))}
              {!windowsQuery.isLoading && history.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-ink-400">
                    No maintenance windows yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <ConfirmationDialog
        open={!!cancelTarget}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="Cancel maintenance window?"
        description="Users will no longer see this scheduled maintenance notice, and an active maintenance lock will be lifted."
        confirmLabel="Cancel window"
        tone="danger"
        loading={cancelMutation.isPending}
        onConfirm={() => cancelTarget && cancelMutation.mutate(cancelTarget.id)}
      />
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-semibold text-ink-700">{label}</span>
      {children}
    </label>
  );
}

function StatusLine({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-white p-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase text-ink-400">{label}</p>
        <p className="truncate text-sm font-semibold text-ink-900">{value}</p>
      </div>
    </div>
  );
}
