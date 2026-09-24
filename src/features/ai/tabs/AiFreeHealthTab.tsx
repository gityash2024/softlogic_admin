import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, KeyRound, Pencil, Plus, RefreshCw, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { extractApiError } from '@/lib/api';
import { aiAdminApi } from '@/services/ai-admin.api';
import type { AiFreeKey, AiFreeProvider } from '@/types/ai';
import { EmptyRow, LoadingBlock, SectionHeader } from '../components/ai-ui';
import { formatCredits, formatDateTime } from '../components/ai-format';

const PROVIDERS: Array<{ value: AiFreeProvider; label: string; hint: string; cap: number; rpm: number }> = [
  { value: 'gemini', label: 'Gemini free tier', hint: 'One key per Google Cloud project (quota is per project).', cap: 900, rpm: 12 },
  { value: 'pollinations', label: 'Pollinations', hint: 'Token from enter.pollinations.ai.', cap: 300, rpm: 10 },
  { value: 'openrouter', label: 'OpenRouter', hint: 'Free models; ~50 requests/day per account without credits.', cap: 45, rpm: 18 },
  { value: 'serper', label: 'Serper (web search)', hint: 'Used for grounded answers on Free.', cap: 400, rpm: 30 },
  { value: 'youtube', label: 'YouTube Data API', hint: 'Video suggestions.', cap: 90, rpm: 30 },
];

const secondsLabel = (seconds: number) => (seconds >= 3600 ? `${Math.round(seconds / 3600)}h` : seconds >= 60 ? `${Math.round(seconds / 60)}m` : `${Math.round(seconds)}s`);

type KeyForm = {
  id?: string;
  provider: AiFreeProvider;
  label: string;
  projectRef: string;
  apiKey: string;
  dailyRequestCap: string;
  rpmCap: string;
  enabled: boolean;
};

const emptyForm = (provider: AiFreeProvider = 'gemini'): KeyForm => {
  const defaults = PROVIDERS.find((item) => item.value === provider)!;
  return { provider, label: '', projectRef: '', apiKey: '', dailyRequestCap: String(defaults.cap), rpmCap: String(defaults.rpm), enabled: true };
};

export function AiFreeHealthTab() {
  const queryClient = useQueryClient();
  const healthQuery = useQuery({ queryKey: ['ai-free-health'], queryFn: aiAdminApi.freeHealth, refetchInterval: 15_000 });
  const keysQuery = useQuery({ queryKey: ['ai-free-keys'], queryFn: aiAdminApi.freeKeys });
  const [form, setForm] = useState<KeyForm | null>(null);
  const [deleting, setDeleting] = useState<AiFreeKey | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['ai-free-keys'] });
    queryClient.invalidateQueries({ queryKey: ['ai-free-health'] });
  };

  const saveMutation = useMutation({
    mutationFn: (value: KeyForm) => {
      const payload = {
        label: value.label.trim(),
        projectRef: value.projectRef.trim() || null,
        dailyRequestCap: Number(value.dailyRequestCap || 0),
        rpmCap: Number(value.rpmCap || 0),
        enabled: value.enabled,
      };
      if (value.id) return aiAdminApi.updateFreeKey(value.id, { ...payload, apiKey: value.apiKey.trim() || undefined });
      return aiAdminApi.createFreeKey({ ...payload, provider: value.provider, apiKey: value.apiKey.trim() });
    },
    onSuccess: () => {
      toast.success('Key saved and synced to the Free AI gateway');
      setForm(null);
      refresh();
    },
    onError: (error) => toast.error(extractApiError(error)),
  });
  const toggleMutation = useMutation({
    mutationFn: (key: AiFreeKey) => aiAdminApi.updateFreeKey(key.id, { enabled: !key.enabled }),
    onSuccess: refresh,
    onError: (error) => toast.error(extractApiError(error)),
  });
  const testMutation = useMutation({
    mutationFn: (id: string) => aiAdminApi.testFreeKey(id),
    onSuccess: (key) => {
      toast[key.lastTestStatus === 'SUCCESS' ? 'success' : 'error'](key.lastTestMessage ?? 'Key tested');
      refresh();
    },
    onError: (error) => toast.error(extractApiError(error)),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => aiAdminApi.deleteFreeKey(id),
    onSuccess: () => {
      toast.success('Key removed');
      setDeleting(null);
      refresh();
    },
    onError: (error) => toast.error(extractApiError(error)),
  });
  const syncMutation = useMutation({
    mutationFn: aiAdminApi.syncFreeKeys,
    onSuccess: (result) => {
      toast[result.synced ? 'success' : 'error'](result.synced ? `${result.count} keys synced to the gateway` : result.message ?? 'Sync failed');
      refresh();
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const health = healthQuery.data;
  const liveKeys = new Map((health?.keys ?? []).map((key) => [key.id, key]));

  return (
    <div className="space-y-5">
      <Card className="space-y-4 px-4 py-5 sm:px-6">
        <SectionHeader
          title="Free AI gateway"
          description="Private sidecar serving the Free tier. Refreshes every 15 seconds."
          actions={
            <>
              <Button type="button" variant="outline" size="sm" onClick={() => healthQuery.refetch()}>
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={syncMutation.isPending} onClick={() => syncMutation.mutate()}>
                {syncMutation.isPending ? <Spinner className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
                Sync keys
              </Button>
            </>
          }
        />
        {healthQuery.isLoading ? (
          <LoadingBlock />
        ) : !health?.reachable ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Gateway unreachable{health?.message ? `: ${health.message}` : ''}. Free requests fail with a "busy" message until it is back.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant={health.status === 'ok' ? 'success' : 'warning'}>{health.status === 'ok' ? 'Healthy' : 'Degraded'}</Badge>
              <Badge variant={health.textReady ? 'success' : 'danger'}>{health.textReady ? 'Text ready' : 'No text provider ready'}</Badge>
              <span className="text-ink-500">{formatCredits(health.inflightUsers)} users in flight</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Object.entries(health.providers ?? {}).map(([name, provider]) => {
                const used = provider.requestsToday ?? 0;
                const capacity = provider.dailyCapacity ?? 0;
                const percent = capacity ? Math.min(100, Math.round((used / capacity) * 100)) : 0;
                const ready = provider.ready ?? ((provider.usableKeys ?? 0) > 0 && !provider.circuitOpenFor);
                return (
                  <div key={name} className="rounded-lg border border-line bg-white px-3 py-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold capitalize text-ink-900">{name}</p>
                      <Badge variant={provider.enabled === false ? 'default' : ready ? 'success' : 'danger'}>
                        {provider.enabled === false ? 'Off' : ready ? 'Ready' : provider.circuitOpenFor ? `Cooling ${secondsLabel(provider.circuitOpenFor)}` : 'Not ready'}
                      </Badge>
                    </div>
                    {provider.keys !== undefined ? (
                      <>
                        <p className="mt-1 text-xs text-ink-500">
                          {provider.usableKeys ?? 0} of {provider.keys} keys usable · {formatCredits(used)} / {formatCredits(capacity)} today
                        </p>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-variant">
                          <div className={`h-full ${percent > 85 ? 'bg-red-500' : percent > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${percent}%` }} />
                        </div>
                      </>
                    ) : (
                      <p className="mt-1 text-xs text-ink-500">
                        {provider.installed === false ? 'Not installed' : provider.queueWaiting !== undefined ? `${provider.queueWaiting} waiting in queue` : 'Local provider'}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      <Card className="space-y-4 px-4 py-5 sm:px-6">
        <SectionHeader
          title="Provider keys"
          description="Keys are encrypted in the backend and pushed to the gateway. Add 4–5 accounts per provider for about 200 users."
          actions={
            <Button type="button" variant="primary" size="sm" onClick={() => setForm(emptyForm())}>
              <Plus className="h-4 w-4" />
              Add key
            </Button>
          }
        />
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="py-2 pr-3">Key</th>
                <th className="py-2 pr-3">Provider</th>
                <th className="py-2 pr-3">Today</th>
                <th className="py-2 pr-3">Limits</th>
                <th className="py-2 pr-3">State</th>
                <th className="py-2 pr-3">Last test</th>
                <th className="py-2 pr-3" />
              </tr>
            </thead>
            <tbody>
              {keysQuery.isLoading ? (
                <EmptyRow colSpan={7} message="Loading…" />
              ) : (keysQuery.data ?? []).length ? (
                (keysQuery.data ?? []).map((key) => {
                  const live = liveKeys.get(key.id);
                  return (
                    <tr key={key.id} className="border-t border-line align-top">
                      <td className="py-2 pr-3">
                        <p className="font-semibold text-ink-900">{key.label}</p>
                        <p className="font-mono text-xs text-ink-500">{key.maskedKey}</p>
                        {key.projectRef ? <p className="text-xs text-ink-400">{key.projectRef}</p> : null}
                      </td>
                      <td className="py-2 pr-3 text-xs capitalize">{key.provider}</td>
                      <td className="py-2 pr-3 text-xs text-ink-600">
                        {live ? (
                          <>
                            {formatCredits(live.requestsToday)} / {formatCredits(live.dailyCap)} requests
                            <span className="block text-ink-400">
                              {live.errorsToday} errors · {live.avgLatencyMs ? `${live.avgLatencyMs} ms avg` : 'no latency yet'}
                            </span>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2 pr-3 text-xs text-ink-600">
                        {formatCredits(key.dailyRequestCap)}/day · {key.rpmCap} rpm
                        <span className="block text-ink-400">resets {key.resetTimezone}</span>
                      </td>
                      <td className="py-2 pr-3 text-xs">
                        {!key.enabled ? (
                          <Badge>Disabled</Badge>
                        ) : live?.disabledReason ? (
                          <Badge variant="danger">{live.disabledReason}</Badge>
                        ) : live?.exhausted ? (
                          <Badge variant="warning">Daily cap reached</Badge>
                        ) : live?.coolingDownFor ? (
                          <Badge variant="warning">Cooling {secondsLabel(live.coolingDownFor)}</Badge>
                        ) : (
                          <Badge variant="success">Active</Badge>
                        )}
                        {live?.lastError ? <p className="mt-1 max-w-[220px] truncate text-red-700" title={live.lastError}>{live.lastError}</p> : null}
                      </td>
                      <td className="py-2 pr-3 text-xs text-ink-600">
                        {key.lastTestAt ? (
                          <>
                            <span className={key.lastTestStatus === 'SUCCESS' ? 'font-semibold text-emerald-700' : 'font-semibold text-red-700'}>{key.lastTestStatus}</span>
                            <span className="block text-ink-400">{formatDateTime(key.lastTestAt)}</span>
                          </>
                        ) : (
                          'Never'
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button type="button" variant="ghost" size="sm" disabled={testMutation.isPending} onClick={() => testMutation.mutate(key.id)}>
                            <Send className="h-4 w-4" />
                            Test
                          </Button>
                          <Button type="button" variant="ghost" size="sm" disabled={toggleMutation.isPending} onClick={() => toggleMutation.mutate(key)}>
                            {key.enabled ? 'Disable' : 'Enable'}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Edit key"
                            onClick={() =>
                              setForm({
                                id: key.id,
                                provider: key.provider,
                                label: key.label,
                                projectRef: key.projectRef ?? '',
                                apiKey: '',
                                dailyRequestCap: String(key.dailyRequestCap),
                                rpmCap: String(key.rpmCap),
                                enabled: key.enabled,
                              })
                            }
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" aria-label="Delete key" onClick={() => setDeleting(key)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <EmptyRow colSpan={7} message="No keys yet. The gateway falls back to its environment keys, then Qwen and templates." />
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {health?.reachable && (health.recentEvents ?? []).length ? (
        <Card className="space-y-3 px-4 py-5 sm:px-6">
          <SectionHeader title="Recent gateway events" description="Errors and warnings from the last requests (no prompt content is stored)." />
          <div className="max-h-80 space-y-1 overflow-y-auto scrollbar-thin">
            {(health.recentEvents ?? []).map((event) => (
              <div key={event.id} className="grid gap-2 rounded-lg border border-line px-3 py-2 text-xs sm:grid-cols-[150px_70px_110px_1fr]">
                <span className="text-ink-500">{formatDateTime(event.at * 1000)}</span>
                <span className={event.level === 'error' ? 'font-semibold text-red-700' : 'font-semibold text-amber-700'}>{event.level}</span>
                <span className="text-ink-600">{event.provider ?? '—'}</span>
                <span className="break-words text-ink-700">{event.message}</span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Dialog open={Boolean(form)} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.id ? 'Edit provider key' : 'Add provider key'}</DialogTitle>
            <DialogDescription>{PROVIDERS.find((item) => item.value === form?.provider)?.hint}</DialogDescription>
          </DialogHeader>
          {form ? (
            <div className="grid gap-3">
              <Select value={form.provider} disabled={Boolean(form.id)} onValueChange={(value) => setForm({ ...emptyForm(value as AiFreeProvider), label: form.label, apiKey: form.apiKey })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((provider) => (
                    <SelectItem key={provider.value} value={provider.value}>
                      {provider.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input placeholder="Label (e.g. Gemini project 3)" value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} />
              <Input placeholder="Project / account reference (optional)" value={form.projectRef} onChange={(event) => setForm({ ...form, projectRef: event.target.value })} />
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <Input
                  className="pl-9"
                  type="password"
                  autoComplete="off"
                  placeholder={form.id ? 'Leave empty to keep the current key' : 'API key'}
                  value={form.apiKey}
                  onChange={(event) => setForm({ ...form, apiKey: event.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Requests / day</label>
                  <Input type="number" min={0} value={form.dailyRequestCap} onChange={(event) => setForm({ ...form, dailyRequestCap: event.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Requests / minute</label>
                  <Input type="number" min={0} value={form.rpmCap} onChange={(event) => setForm({ ...form, rpmCap: event.target.value })} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-ink-700">
                <input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} />
                Enabled
              </label>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setForm(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={saveMutation.isPending || !form?.label.trim() || (!form?.id && (form?.apiKey.trim().length ?? 0) < 8)}
              onClick={() => form && saveMutation.mutate(form)}
            >
              {saveMutation.isPending ? <Spinner className="h-4 w-4" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Remove ${deleting?.label ?? 'key'}?`}
        description="The key is removed from the gateway on the next sync. Usage history stays."
        confirmLabel="Remove"
        tone="danger"
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}
