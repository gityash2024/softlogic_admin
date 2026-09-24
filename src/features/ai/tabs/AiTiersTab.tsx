import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Plus, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { PaginationFooter } from '@/features/admin/admin-list-ui';
import { api, extractApiError } from '@/lib/api';
import { aiAdminApi } from '@/services/ai-admin.api';
import type { AiAccountSearchResult, AiFreePricingRow, AiTierConfig, AiTierPolicy } from '@/types/ai';
import { AsyncAccountSelect, EmptyRow, LoadingBlock, SectionHeader } from '../components/ai-ui';
import { formatCredits, formatDateTime } from '../components/ai-format';

const CHAIN: Array<{ key: string; label: string; detail: string }> = [
  { key: 'gemini', label: 'Gemini free tier', detail: 'Text, vision, audio input and speech (free Google projects)' },
  { key: 'pollinations', label: 'Pollinations', detail: 'Text and image generation' },
  { key: 'openrouter', label: 'OpenRouter free models', detail: 'Text overflow' },
  { key: 'qwen', label: 'Qwen (self-hosted)', detail: 'Last-resort text on the server CPU' },
  { key: 'aihorde', label: 'AI Horde', detail: 'Image overflow (slow)' },
];

const numberOrNull = (value: string) => (value.trim() === '' ? null : Math.max(0, Math.round(Number(value))));
const toInput = (value: number | null | undefined) => (value === null || value === undefined ? '' : String(value));

const microsToInput = (micros: number) => String((micros ?? 0) / 1_000_000);
const inputToMicros = (value: string) => Math.max(0, Math.round(Number(value || 0) * 1_000_000));

export function AiTiersTab() {
  return (
    <div className="space-y-5">
      <TierSwitchCard />
      <TierPolicyCard />
      <FreePricingCard />
      <ConversionPreviewCard />
    </div>
  );
}

function TierSwitchCard() {
  const queryClient = useQueryClient();
  const configQuery = useQuery({ queryKey: ['ai-tier-config'], queryFn: aiAdminApi.tierConfig });
  const [form, setForm] = useState<AiTierConfig | null>(null);
  const [confirmOff, setConfirmOff] = useState(false);

  useEffect(() => {
    if (!configQuery.data) return;
    const timer = window.setTimeout(() => setForm(configQuery.data), 0);
    return () => window.clearTimeout(timer);
  }, [configQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (payload: AiTierConfig) =>
      aiAdminApi.updateTierConfig({
        proGloballyEnabled: payload.proGloballyEnabled,
        proDefaultScope: payload.proDefaultScope,
        freeEnabled: payload.freeEnabled,
        proToFreeFallbackEnabled: payload.proToFreeFallbackEnabled,
        freeDefaultUserDailyRequests: payload.freeDefaultUserDailyRequests,
        freeDefaultUserDailyCredits: payload.freeDefaultUserDailyCredits,
        freeDefaultOrgDailyRequests: payload.freeDefaultOrgDailyRequests,
        freeDefaultOrgDailyCredits: payload.freeDefaultOrgDailyCredits,
        freePlatformDailyRequests: payload.freePlatformDailyRequests,
        freeProviderChain: payload.freeProviderChain,
      }),
    onSuccess: () => {
      toast.success('Tier settings saved');
      queryClient.invalidateQueries({ queryKey: ['ai-tier-config'] });
      queryClient.invalidateQueries({ queryKey: ['ai-summary'] });
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  if (configQuery.isLoading || !form) {
    return (
      <Card className="px-4 py-5 sm:px-6">
        {configQuery.isError ? <p className="text-sm text-red-700">{extractApiError(configQuery.error)}</p> : <LoadingBlock />}
      </Card>
    );
  }

  const update = <K extends keyof AiTierConfig>(key: K, value: AiTierConfig[K]) => setForm((current) => (current ? { ...current, [key]: value } : current));
  const submit = () => {
    if (configQuery.data?.proGloballyEnabled && !form.proGloballyEnabled) {
      setConfirmOff(true);
      return;
    }
    saveMutation.mutate(form);
  };

  return (
    <Card className="space-y-5 px-4 py-5 sm:px-6">
      <SectionHeader
        title="Pro switch & Free tier"
        description={
          form.tiersActive
            ? 'Tiers are active. Pro OFF stops every paid Gemini call platform-wide; everyone runs on Free and no upgrade prompts are shown.'
            : 'Tiers are not active yet. The release conversion script activates them; until then every request uses the existing paid path.'
        }
        actions={
          <Button type="button" variant="primary" disabled={saveMutation.isPending} onClick={submit}>
            {saveMutation.isPending ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
        }
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <ToggleRow
          label="Pro (paid Gemini) ON"
          detail="Global kill switch. OFF charges nothing to Pro and hides upgrade prompts everywhere."
          checked={form.proGloballyEnabled}
          onChange={(value) => update('proGloballyEnabled', value)}
        />
        <div className="rounded-lg border border-line bg-white px-3 py-3">
          <p className="text-sm font-semibold text-ink-900">Pro available to</p>
          <p className="text-xs text-ink-500">Policies below override this for selected partners, organizations or users.</p>
          <Select value={form.proDefaultScope} onValueChange={(value) => update('proDefaultScope', value as AiTierConfig['proDefaultScope'])}>
            <SelectTrigger className="mt-2 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All users (unless a policy turns it off)</SelectItem>
              <SelectItem value="SELECTED">Only selected partners / organizations / users</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <ToggleRow
          label="Free tier enabled"
          detail="Free AI chain (free providers, self-hosted Qwen, templates)."
          checked={form.freeEnabled}
          onChange={(value) => update('freeEnabled', value)}
        />
        <ToggleRow
          label="Fall back from Pro to Free"
          detail="When a Pro request fails for any reason and the user has Free credits, answer on Free."
          checked={form.proToFreeFallbackEnabled}
          onChange={(value) => update('proToFreeFallbackEnabled', value)}
        />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Free daily caps (empty = no cap)</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <CapInput label="Per user · requests" value={form.freeDefaultUserDailyRequests} onChange={(value) => update('freeDefaultUserDailyRequests', value)} />
          <CapInput label="Per user · credits" value={form.freeDefaultUserDailyCredits} onChange={(value) => update('freeDefaultUserDailyCredits', value)} />
          <CapInput label="Per org · requests" value={form.freeDefaultOrgDailyRequests} onChange={(value) => update('freeDefaultOrgDailyRequests', value)} />
          <CapInput label="Per org · credits" value={form.freeDefaultOrgDailyCredits} onChange={(value) => update('freeDefaultOrgDailyCredits', value)} />
          <CapInput label="Platform · requests" value={form.freePlatformDailyRequests} onChange={(value) => update('freePlatformDailyRequests', value)} />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Free provider chain (in order)</p>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {CHAIN.map((provider, index) => (
            <ToggleRow
              key={provider.key}
              label={`${index + 1}. ${provider.label}`}
              detail={provider.detail}
              checked={form.freeProviderChain?.[provider.key] !== false}
              onChange={(value) => update('freeProviderChain', { ...(form.freeProviderChain ?? {}), [provider.key]: value })}
            />
          ))}
        </div>
        <p className="text-xs text-ink-500">Heavy tools (PPT, PDF, lesson pages) fall back to a structured template at the end of the chain; templates are not charged.</p>
      </div>

      <p className="text-xs text-ink-400">Last updated {formatDateTime(form.updatedAt)}</p>

      <ConfirmationDialog
        open={confirmOff}
        onOpenChange={setConfirmOff}
        title="Switch Pro OFF for everyone?"
        description="No paid Gemini calls will be made anywhere. Every user runs on Free, and upgrade prompts disappear in the app and admin panel."
        confirmLabel="Switch Pro OFF"
        tone="warning"
        loading={saveMutation.isPending}
        onConfirm={() => {
          saveMutation.mutate(form, { onSettled: () => setConfirmOff(false) });
        }}
      />
    </Card>
  );
}

function ToggleRow({ label, detail, checked, onChange }: { label: string; detail?: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-white px-3 py-3">
      <input type="checkbox" className="mt-1" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>
        <span className="block text-sm font-semibold text-ink-900">{label}</span>
        {detail ? <span className="block text-xs text-ink-500">{detail}</span> : null}
      </span>
    </label>
  );
}

function CapInput({ label, value, onChange }: { label: string; value: number | null; onChange: (value: number | null) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">{label}</label>
      <Input type="number" min={0} placeholder="No cap" value={toInput(value)} onChange={(event) => onChange(numberOrNull(event.target.value))} />
    </div>
  );
}

const PRO_LABEL = (value: boolean | null) => (value === null ? 'Inherit' : value ? 'Pro ON' : 'Pro OFF');

function TierPolicyCard() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [scopeFilter, setScopeFilter] = useState<'ALL' | 'ORGANIZATION' | 'USER'>('ALL');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<{
    scope: 'ORGANIZATION' | 'USER';
    target: AiAccountSearchResult | null;
    proEnabled: 'INHERIT' | 'ON' | 'OFF';
    freeDailyRequests: string;
    freeDailyCredits: string;
    note: string;
  }>({ scope: 'ORGANIZATION', target: null, proEnabled: 'ON', freeDailyRequests: '', freeDailyCredits: '', note: '' });

  const policiesQuery = useQuery({
    queryKey: ['ai-tier-policies', page, scopeFilter, search],
    queryFn: () => aiAdminApi.policies({ page, perPage: 20, scope: scopeFilter === 'ALL' ? undefined : scopeFilter, search: search || undefined }),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['ai-tier-policies'] });
    queryClient.invalidateQueries({ queryKey: ['ai-organizations'] });
    queryClient.invalidateQueries({ queryKey: ['ai-users'] });
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!draft.target) throw new Error(draft.scope === 'USER' ? 'Select a user' : 'Select an organization');
      return aiAdminApi.savePolicy({
        scope: draft.scope,
        organizationId: draft.scope === 'ORGANIZATION' ? draft.target.organizationId ?? draft.target.id : null,
        userId: draft.scope === 'USER' ? draft.target.userId ?? draft.target.id : null,
        proEnabled: draft.proEnabled === 'INHERIT' ? null : draft.proEnabled === 'ON',
        freeDailyRequests: numberOrNull(draft.freeDailyRequests),
        freeDailyCredits: numberOrNull(draft.freeDailyCredits),
        note: draft.note.trim() || null,
      });
    },
    onSuccess: () => {
      toast.success('Policy saved');
      setDraft((current) => ({ ...current, target: null, freeDailyRequests: '', freeDailyCredits: '', note: '' }));
      invalidate();
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => aiAdminApi.deletePolicy(id),
    onSuccess: () => {
      toast.success('Policy removed');
      invalidate();
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const rows = policiesQuery.data?.data ?? [];

  return (
    <Card className="space-y-4 px-4 py-5 sm:px-6">
      <SectionHeader
        title="Pro access policies"
        description="Turn Pro on or off for selected partners, organizations or users, and set Free daily caps. Precedence: user → organization → parent partner chain → global default."
      />
      <div className="grid gap-3 rounded-lg border border-line bg-surface-variant p-3 lg:grid-cols-[140px_1.4fr_140px_1fr_1fr_auto]">
        <Select value={draft.scope} onValueChange={(value) => setDraft((current) => ({ ...current, scope: value as 'ORGANIZATION' | 'USER', target: null }))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ORGANIZATION">Organization</SelectItem>
            <SelectItem value="USER">User</SelectItem>
          </SelectContent>
        </Select>
        <AsyncAccountSelect scope={draft.scope} tier="PRO" value={draft.target} onChange={(target) => setDraft((current) => ({ ...current, target }))} />
        <Select value={draft.proEnabled} onValueChange={(value) => setDraft((current) => ({ ...current, proEnabled: value as 'INHERIT' | 'ON' | 'OFF' }))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ON">Pro ON</SelectItem>
            <SelectItem value="OFF">Pro OFF</SelectItem>
            <SelectItem value="INHERIT">Inherit</SelectItem>
          </SelectContent>
        </Select>
        <Input type="number" min={0} placeholder="Free requests / day" value={draft.freeDailyRequests} onChange={(event) => setDraft((current) => ({ ...current, freeDailyRequests: event.target.value }))} />
        <Input type="number" min={0} placeholder="Free credits / day" value={draft.freeDailyCredits} onChange={(event) => setDraft((current) => ({ ...current, freeDailyCredits: event.target.value }))} />
        <Button type="button" variant="primary" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          {saveMutation.isPending ? <Spinner className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          Save policy
        </Button>
        <Input
          className="lg:col-span-6"
          placeholder="Note (optional, e.g. contract reference)"
          value={draft.note}
          onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input placeholder="Search policies by organization or user" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        <Select value={scopeFilter} onValueChange={(value) => { setScopeFilter(value as typeof scopeFilter); setPage(1); }}>
          <SelectTrigger className="sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All policies</SelectItem>
            <SelectItem value="ORGANIZATION">Organizations</SelectItem>
            <SelectItem value="USER">Users</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-lg border border-line">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="min-w-[860px] w-full text-left text-sm">
            <thead className="bg-surface-variant text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-3 py-2">Target</th>
                <th className="px-3 py-2">Pro</th>
                <th className="px-3 py-2">Free caps / day</th>
                <th className="px-3 py-2">Note</th>
                <th className="px-3 py-2">Updated</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {policiesQuery.isLoading ? (
                <EmptyRow colSpan={6} message="Loading…" />
              ) : rows.length ? (
                rows.map((policy: AiTierPolicy) => (
                  <tr key={policy.id} className="border-t border-line">
                    <td className="px-3 py-2">
                      <p className="font-semibold text-ink-900">
                        {policy.scope === 'USER' ? policy.user?.name ?? policy.user?.email ?? policy.userId : policy.organization?.name ?? policy.organizationId}
                      </p>
                      <p className="text-xs text-ink-500">
                        {policy.scope === 'USER' ? `${policy.user?.role ?? 'User'} · ${policy.user?.email ?? ''}` : policy.organization?.kind ?? 'Organization'}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          policy.proEnabled === null
                            ? 'text-ink-500'
                            : policy.proEnabled
                              ? 'font-semibold text-emerald-700'
                              : 'font-semibold text-red-700'
                        }
                      >
                        {PRO_LABEL(policy.proEnabled)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-ink-600">
                      {policy.freeDailyRequests === null ? 'Default' : `${formatCredits(policy.freeDailyRequests)} req`}
                      {' · '}
                      {policy.freeDailyCredits === null ? 'Default' : `${formatCredits(policy.freeDailyCredits)} credits`}
                    </td>
                    <td className="px-3 py-2 text-xs text-ink-600">{policy.note ?? '—'}</td>
                    <td className="px-3 py-2 text-xs text-ink-500">{formatDateTime(policy.updatedAt)}</td>
                    <td className="px-3 py-2 text-right">
                      <Button type="button" variant="ghost" size="sm" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(policy.id)}>
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <EmptyRow colSpan={6} message="No policies yet. Everyone follows the global default." />
              )}
            </tbody>
          </table>
        </div>
        <PaginationFooter meta={policiesQuery.data?.meta} onPageChange={setPage} />
      </div>
    </Card>
  );
}

type FreePricingForm = Omit<AiFreePricingRow, 'inputUsdMicrosPerMillion' | 'outputUsdMicrosPerMillion' | 'imageUsdMicrosEach' | 'audioUsdMicrosEach' | 'searchUsdMicrosPerThousand'> & {
  input: string;
  output: string;
  image: string;
  audio: string;
  search: string;
};

function FreePricingCard() {
  const queryClient = useQueryClient();
  const pricingQuery = useQuery({ queryKey: ['ai-free-pricing'], queryFn: aiAdminApi.freePricing });
  const [rows, setRows] = useState<FreePricingForm[]>([]);

  useEffect(() => {
    if (!pricingQuery.data) return;
    const timer = window.setTimeout(
      () =>
        setRows(
          pricingQuery.data.map((row) => ({
            id: row.id,
            modelId: row.modelId,
            billingType: row.billingType,
            enabled: row.enabled,
            input: microsToInput(row.inputUsdMicrosPerMillion),
            output: microsToInput(row.outputUsdMicrosPerMillion),
            image: microsToInput(row.imageUsdMicrosEach),
            audio: microsToInput(row.audioUsdMicrosEach),
            search: microsToInput(row.searchUsdMicrosPerThousand),
          })),
        ),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [pricingQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      aiAdminApi.updateFreePricing(
        rows.map((row) => ({
          modelId: row.modelId,
          billingType: row.billingType,
          enabled: row.enabled,
          inputUsdMicrosPerMillion: inputToMicros(row.input),
          outputUsdMicrosPerMillion: inputToMicros(row.output),
          imageUsdMicrosEach: inputToMicros(row.image),
          audioUsdMicrosEach: inputToMicros(row.audio),
          searchUsdMicrosPerThousand: inputToMicros(row.search),
        })),
      ),
    onSuccess: () => {
      toast.success('Free AI pricing saved');
      queryClient.invalidateQueries({ queryKey: ['ai-free-pricing'] });
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const setField = (modelId: string, field: keyof FreePricingForm, value: string | boolean) =>
    setRows((current) => current.map((row) => (row.modelId === modelId ? { ...row, [field]: value } : row)));

  return (
    <Card className="space-y-4 px-4 py-5 sm:px-6">
      <SectionHeader
        title="Free AI pricing"
        description="Free credits charged per request (USD rates at $0.000001 per credit). Separate from the Pro model pricing on the Overview tab."
        actions={
          <Button type="button" variant="outline" size="sm" disabled={saveMutation.isPending || !rows.length} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            Save pricing
          </Button>
        }
      />
      {pricingQuery.isLoading ? (
        <LoadingBlock />
      ) : (
        <div className="overflow-x-auto scrollbar-thin">
          <table className="min-w-[960px] text-left text-xs">
            <thead className="uppercase tracking-wide text-ink-500">
              <tr>
                <th className="py-2 pr-3">Model</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Input / 1M</th>
                <th className="py-2 pr-3">Output / 1M</th>
                <th className="py-2 pr-3">Image each</th>
                <th className="py-2 pr-3">Audio each</th>
                <th className="py-2 pr-3">Search / 1000</th>
                <th className="py-2 pr-3">On</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.modelId} className="border-t border-line">
                  <td className="py-2 pr-3">
                    <p className="min-w-[150px] font-semibold text-ink-900">{row.modelId}</p>
                  </td>
                  <td className="py-2 pr-3">
                    <Select value={row.billingType} onValueChange={(value) => setField(row.modelId, 'billingType', value)}>
                      <SelectTrigger className="h-9 min-w-[96px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="token">Token</SelectItem>
                        <SelectItem value="image">Image</SelectItem>
                        <SelectItem value="audio">Audio</SelectItem>
                        <SelectItem value="tool">Tool</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  {(['input', 'output', 'image', 'audio', 'search'] as const).map((field) => (
                    <td key={field} className="py-2 pr-3">
                      <Input className="h-9 min-w-[90px]" type="number" min={0} step="0.000001" value={row[field]} onChange={(event) => setField(row.modelId, field, event.target.value)} />
                    </td>
                  ))}
                  <td className="py-2 pr-3">
                    <input type="checkbox" checked={row.enabled} onChange={(event) => setField(row.modelId, 'enabled', event.target.checked)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

type ConversionPreview = {
  totals?: { accounts: number; converted: number; exempt: number; skipped: number; convertedCredits: string; warnings: number };
  checksum?: string;
};

function ConversionPreviewCard() {
  const [enabled, setEnabled] = useState(false);
  const previewQuery = useQuery({
    queryKey: ['ai-tier-conversion-preview'],
    queryFn: async () => (await api.get<{ data: ConversionPreview }>('/admin/ai/tier-conversion/dry-run')).data.data,
    enabled,
  });
  const downloadCsv = async () => {
    try {
      const res = await api.get<Blob>('/admin/ai/tier-conversion/dry-run', { params: { format: 'csv' }, responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'ai-tier-conversion-dry-run.csv';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };
  const totals = previewQuery.data?.totals;
  return (
    <Card className="space-y-3 px-4 py-5 sm:px-6">
      <SectionHeader
        title="Release conversion preview"
        description="Read-only dry run of the Phase 2 release conversion (remaining balances move to Free; Super Admin and internal accounts become unlimited). Applying it is done by the server script."
        actions={
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => (enabled ? previewQuery.refetch() : setEnabled(true))}>
              {previewQuery.isFetching ? <Spinner className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
              Run dry run
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={downloadCsv}>
              <Download className="h-4 w-4" />
              CSV
            </Button>
          </>
        }
      />
      {previewQuery.isError ? <p className="text-sm text-red-700">{extractApiError(previewQuery.error)}</p> : null}
      {totals ? (
        <div className="grid gap-2 text-sm sm:grid-cols-3 xl:grid-cols-6">
          <span>Accounts: <strong>{formatCredits(totals.accounts)}</strong></span>
          <span>Converted: <strong>{formatCredits(totals.converted)}</strong></span>
          <span>Unlimited (exempt): <strong>{formatCredits(totals.exempt)}</strong></span>
          <span>Skipped: <strong>{formatCredits(totals.skipped)}</strong></span>
          <span>Credits moved: <strong>{formatCredits(Number(totals.convertedCredits))}</strong></span>
          <span>Warnings: <strong>{formatCredits(totals.warnings)}</strong></span>
          <span className="break-all text-xs text-ink-500 sm:col-span-3 xl:col-span-6">Checksum: {previewQuery.data?.checksum}</span>
        </div>
      ) : null}
    </Card>
  );
}
