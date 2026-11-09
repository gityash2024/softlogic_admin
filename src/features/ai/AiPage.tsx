import { AiField } from '@/features/ai/components/ai-ui';
import { FormEvent, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { BrainCircuit, CheckCircle2, KeyRound, RefreshCw, Save, Send, Undo2, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AiCreditInfoButton } from '@/components/ai/AiCreditInfoButton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import './ai-workspace.css';
import { aiTab, aiGroup, type AiTab } from './components/ai-navigation';
import { AiUnsavedBoundary, useAiDraft } from './components/ai-drafts';
import { aiAdminApi } from '@/services/ai-admin.api';
import { aiBillingApi } from '@/services/ai-billing.api';
import { FreePricingCard } from './tabs/AiTiersTab';
import { aiApi } from '@/services/ai.api';
import { extractApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import type { AiModelPricingSummary, AiOverview } from '@/types/api';
import { AiCreditsTab } from './tabs/AiCreditsTab';
import { AiFreeHealthTab } from './tabs/AiFreeHealthTab';
import { AiLedgerTab } from './tabs/AiLedgerTab';
import { AiOrganizationsTab } from './tabs/AiOrganizationsTab';
import { AiPlansTab } from './tabs/AiPlansTab';
import { AiTiersTab } from './tabs/AiTiersTab';
import { AiUsageOverview } from './tabs/AiUsageOverview';
import { AiUsersTab } from './tabs/AiUsersTab';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  'https://softlogic-api.mymultimeds.com/api/v1';

const TEXT_MODEL = 'gemini-3.5-flash';
const IMAGE_MODEL = 'imagen-4.0-generate-001';
const TTS_MODEL = 'gemini-2.5-flash-preview-tts';
const formatTokens = (value: number | null | undefined) =>
  new Intl.NumberFormat('en-IN').format(value ?? 0);

const microsToInputValue = (micros: number | null | undefined) =>
  String((micros ?? 0) / 1_000_000);

const inputValueToMicros = (value: string) =>
  Math.max(0, Math.round(Number(value || 0) * 1_000_000));

type PricingFormRow = {
  modelId: string;
  provider: string;
  billingType: string;
  inputUsdPerMillion: string;
  outputUsdPerMillion: string;
  imageUsdEach: string;
  searchUsdPerThousand: string;
  enabled: boolean;
};

const pricingRowFromSummary = (row: AiModelPricingSummary): PricingFormRow => ({
  modelId: row.modelId,
  provider: row.provider,
  billingType: row.billingType,
  inputUsdPerMillion: microsToInputValue(row.inputUsdMicrosPerMillion),
  outputUsdPerMillion: microsToInputValue(row.outputUsdMicrosPerMillion),
  imageUsdEach: microsToInputValue(row.imageUsdMicrosEach),
  searchUsdPerThousand: microsToInputValue(row.searchUsdMicrosPerThousand),
  enabled: row.enabled,
});

function accountForOrg(data: AiOverview | undefined, organizationId: string) {
  return data?.accounts.find((account) => account.scope === 'ORGANIZATION' && account.organizationId === organizationId);
}

function accountForUser(data: AiOverview | undefined, userId: string) {
  return data?.accounts.find((account) => account.scope === 'USER' && account.userId === userId);
}

export function AiPage() { return <AiUnsavedBoundary><AiPageContent /></AiUnsavedBoundary>; }

function AiPageContent() {
  const queryClient = useQueryClient();
  const { tokens, user } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const overviewQuery = useQuery({
    queryKey: ['ai-overview'],
    queryFn: aiApi.overview,
    refetchInterval: 30000,
  });
  const tierSummaryQuery = useQuery({ queryKey: ['ai-summary'], queryFn: aiAdminApi.summary });
  const billingModeQuery = useQuery({ queryKey: ['ai-billing-gateways'], queryFn: aiBillingApi.gateways, enabled: isSuperAdmin });
  const [configForm, setConfigForm, configSaved] = useAiDraft({
    geminiApiKey: '',
    enabled: overviewQuery.data?.config.enabled ?? true,
    googleSearchGroundingEnabled: overviewQuery.data?.config.googleSearchGroundingEnabled ?? false,
  });
  const [topUpTokens, setTopUpTokens] = useState('');
  const [allocation, setAllocation] = useState({
    targetType: 'ORGANIZATION',
    organizationId: '',
    userId: '',
    amountTokens: '',
  });
  const [reclaim, setReclaim] = useState({
    targetType: 'ORGANIZATION',
    organizationId: '',
    userId: '',
    amountTokens: '',
  });
  const [pricingForm, setPricingForm, pricingSaved] = useAiDraft<PricingFormRow[]>((overviewQuery.data?.pricing ?? []).map(pricingRowFromSummary));
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = aiTab(searchParams.get('tab'));
  const activeGroup = aiGroup(activeTab);
  const changeTab = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'overview') next.delete('tab');
    else next.set('tab', value);
    setSearchParams(next, { replace: true });
  };



  useEffect(() => {
    if (!tokens?.accessToken) return;
    const socketOrigin = new URL(API_BASE_URL).origin;
    const socket = io(socketOrigin, {
      auth: { token: tokens.accessToken },
      transports: ['websocket', 'polling'],
    });
    socket.on('connect', () => socket.emit('ai:join'));
    socket.on('ai:tier-config-updated', () => {
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0] ?? '').startsWith('ai-') });
    });
    socket.on('ai:credits-updated', () => {
      queryClient.invalidateQueries({ queryKey: ['ai-overview'] });
      // Phase 2 tabs (summary, lists, ledger, orders) share the `ai-` key prefix.
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = String(query.queryKey[0] ?? '');
          return key !== 'ai-overview' && key.startsWith('ai-');
        },
      });
    });
    return () => {
      socket.disconnect();
    };
  }, [queryClient, tokens?.accessToken]);

  const configMutation = useMutation({
    mutationFn: (submitted: typeof configForm) =>
      aiApi.updateConfig({
        geminiApiKey: submitted.geminiApiKey.trim() || undefined,
        geminiTextModel: TEXT_MODEL,
        geminiImageModel: IMAGE_MODEL,
        geminiTtsModel: TTS_MODEL,
        googleSearchGroundingEnabled: submitted.googleSearchGroundingEnabled,
        enabled: submitted.enabled,
      }),
    onSuccess: (_data, submitted) => {
      toast.success('AI configuration saved');
      configSaved(submitted);
      queryClient.invalidateQueries({ queryKey: ['ai-overview'] });
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const testMutation = useMutation({
    mutationFn: () => aiApi.testConfig(),
    onSuccess: (config) => {
      toast[config.lastTestStatus === 'SUCCESS' ? 'success' : 'error'](
        config.lastTestMessage ?? 'AI configuration tested',
      );
      queryClient.invalidateQueries({ queryKey: ['ai-overview'] });
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const pricingMutation = useMutation({
    mutationFn: (submitted: PricingFormRow[]) =>
      aiApi.updatePricing({
        pricing: submitted.map((row) => ({
          modelId: row.modelId,
          provider: row.provider || 'gemini',
          billingType: row.billingType,
          inputUsdMicrosPerMillion: inputValueToMicros(row.inputUsdPerMillion),
          outputUsdMicrosPerMillion: inputValueToMicros(row.outputUsdPerMillion),
          imageUsdMicrosEach: inputValueToMicros(row.imageUsdEach),
          searchUsdMicrosPerThousand: inputValueToMicros(row.searchUsdPerThousand),
          enabled: row.enabled,
        })),
      }),
    onSuccess: (_data, submitted) => {
      toast.success('AI pricing saved');
      pricingSaved(submitted);
      queryClient.invalidateQueries({ queryKey: ['ai-overview'] });
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const topUpMutation = useMutation({
    mutationFn: () =>
      aiApi.topUp({
        amountTokens: Number(topUpTokens),
        reason: 'Super Admin master AI credit top-up',
      }),
    onSuccess: () => {
      toast.success('AI credits added');
      setTopUpTokens('');
      queryClient.invalidateQueries({ queryKey: ['ai-overview'] });
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const allocationMutation = useMutation({
    mutationFn: () =>
      aiApi.allocate({
        scope: allocation.targetType === 'USER' ? 'USER' : 'ORGANIZATION',
        organizationId:
          allocation.targetType === 'ORGANIZATION' ? allocation.organizationId : undefined,
        userId: allocation.targetType === 'USER' ? allocation.userId : undefined,
        amountTokens: Number(allocation.amountTokens),
        reason: 'AI credit allocation',
      }),
    onSuccess: () => {
      toast.success('AI credits allocated');
      setAllocation((current) => ({ ...current, amountTokens: '' }));
      queryClient.invalidateQueries({ queryKey: ['ai-overview'] });
      queryClient.invalidateQueries({ queryKey: ['ai-allocation-overview'] });
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const data = overviewQuery.data;
  const selectedAllocationAccount =
    data && allocation.targetType === 'ORGANIZATION' && allocation.organizationId
      ? accountForOrg(data, allocation.organizationId)
      : data && allocation.targetType === 'USER' && allocation.userId
        ? accountForUser(data, allocation.userId)
        : null;
  const selectedReclaimAccount =
    data && reclaim.targetType === 'ORGANIZATION' && reclaim.organizationId
      ? accountForOrg(data, reclaim.organizationId)
      : data && reclaim.targetType === 'USER' && reclaim.userId
        ? accountForUser(data, reclaim.userId)
        : null;
  const minimumReclaimAllocation = selectedReclaimAccount
    ? selectedReclaimAccount.usedTokens +
      selectedReclaimAccount.reservedTokens +
      selectedReclaimAccount.childAllocatedTokens
    : 0;
  const reclaimableTokens = selectedReclaimAccount
    ? Math.max(selectedReclaimAccount.allocatedTokens - minimumReclaimAllocation, 0)
    : 0;
  const reclaimMutation = useMutation({
    mutationFn: () => {
      if (!selectedReclaimAccount) {
        throw new Error('Select an account with assigned AI credits');
      }
      const amount = Number(reclaim.amountTokens);
      return aiApi.setAllocation({
        sourceAccountId: selectedReclaimAccount.parentAccountId ?? undefined,
        scope: reclaim.targetType === 'USER' ? 'USER' : 'ORGANIZATION',
        organizationId:
          reclaim.targetType === 'ORGANIZATION' ? reclaim.organizationId : undefined,
        userId: reclaim.targetType === 'USER' ? reclaim.userId : undefined,
        allocatedTokens: selectedReclaimAccount.allocatedTokens - amount,
        reason: 'Super Admin AI credit reclaim',
      });
    },
    onSuccess: () => {
      toast.success('AI credits reclaimed');
      setReclaim((current) => ({ ...current, amountTokens: '' }));
      queryClient.invalidateQueries({ queryKey: ['ai-overview'] });
      queryClient.invalidateQueries({ queryKey: ['ai-allocation-overview'] });
    },
    onError: (error) => toast.error(extractApiError(error)),
  });
  const visibleUserRows = useMemo(
    () =>
      (data?.users ?? [])
        .filter((row) => row.role !== 'STUDENT' && row.role !== 'PARENT')
        .map((row) => ({ user: row, account: accountForUser(data, row.id) })),
    [data],
  );
  const updatePricingRow = (
    modelId: string,
    field: keyof PricingFormRow,
    value: string | boolean,
  ) => {
    setPricingForm((rows) =>
      rows.map((row) => (row.modelId === modelId ? { ...row, [field]: value } : row)),
    );
  };

  const submitConfig = (event: FormEvent) => {
    event.preventDefault();
    configMutation.mutate(configForm);
  };

  const submitTopUp = (event: FormEvent) => {
    event.preventDefault();
    if (!Number(topUpTokens)) {
      toast.error('Enter AI credits to add');
      return;
    }
    topUpMutation.mutate();
  };

  const submitAllocation = (event: FormEvent) => {
    event.preventDefault();
    if (!Number(allocation.amountTokens)) {
      toast.error('Enter AI credits to allocate');
      return;
    }
    if (allocation.targetType === 'ORGANIZATION' && !allocation.organizationId) {
      toast.error('Select an organization');
      return;
    }
    if (allocation.targetType === 'USER' && !allocation.userId) {
      toast.error('Select a user');
      return;
    }
    allocationMutation.mutate();
  };

  const submitReclaim = (event: FormEvent) => {
    event.preventDefault();
    const amount = Number(reclaim.amountTokens);
    if (!selectedReclaimAccount) {
      toast.error('Select an account with assigned AI credits');
      return;
    }
    if (!amount || amount < 1) {
      toast.error('Enter AI credits to reclaim');
      return;
    }
    if (amount > reclaimableTokens) {
      toast.error(`Only ${formatTokens(reclaimableTokens)} unused credits can be reclaimed`);
      return;
    }
    reclaimMutation.mutate();
  };

  if (overviewQuery.isLoading) {
    return <div className="flex h-64 items-center justify-center"><Spinner className="h-7 w-7 text-brand-primary" /></div>;
  }

  if (overviewQuery.isError || !data) {
    return (
      <Card className="px-4 py-6 sm:px-6">
        <p className="font-semibold text-ink-900">AI module unavailable</p>
        <p className="mt-1 text-sm text-ink-500">{extractApiError(overviewQuery.error)}</p><Button className="mt-4" variant="outline" onClick={() => overviewQuery.refetch()}>Retry</Button>
      </Card>
    );
  }

  return (
    <Tabs data-ai-page className="ai-workspace ai-console" value={activeTab} onValueChange={changeTab} activationMode="manual">
      <header className="ai-console-hero">
        <div className="ai-console-hero-copy">
          <span className="ai-console-emblem"><BrainCircuit size={23} aria-hidden="true" /></span>
          <div>
            <p className="ai-eyebrow">AI workspace <span aria-hidden="true">/</span> {activeGroup.label}</p>
            <h2 id="ai-view-heading">{activeGroup.tabs.find(tab => tab.id === activeTab)?.label}</h2>
            <p className="ai-console-description">{activeGroup.description}</p>
          </div>
        </div>
        <div className="ai-console-actions">
          <span className="ai-service-pill" data-enabled={data.config.enabled}>{data.config.enabled ? 'Service enabled' : 'Service disabled'}</span>
          {billingModeQuery.data?.[0]?.effectiveMode && <span className="ai-mode-pill">{billingModeQuery.data[0].effectiveMode === 'TEST' ? 'Test payments' : 'Live payments'}</span>}
          <Button variant="outline" onClick={() => overviewQuery.refetch()}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </header>

      <TabsList className="ai-console-tabs" aria-label={`${activeGroup.label} pages`}>
        {activeGroup.tabs.map(tab => (
          <TabsTrigger key={tab.id} value={tab.id}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <AiView activeTab={activeTab} value="overview"><AiUsageOverview /></AiView>
      <AiView activeTab={activeTab} value="configuration" className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <MetricCard icon={KeyRound} label="Pro provider key" value={data.config.hasGeminiApiKey ? 'Configured' : 'Missing'} detail={data.config.maskedGeminiApiKey ?? 'No master key'} />
          <MetricCard icon={CheckCircle2} label="AI service" value={data.config.enabled ? 'Enabled' : 'Disabled'} detail={data.config.lastTestStatus ?? 'Not tested'} />
        </div>
        <Card data-tour="tour-ai-credits" className="space-y-4 px-4 py-5 sm:px-6">
          <div>
            <h3 className="text-base font-bold text-ink-900">Master AI Configuration</h3>
            <p className="text-sm text-ink-500">Stored centrally and encrypted in the backend.</p>
          </div>
          <form onSubmit={submitConfig} className="grid gap-4 lg:grid-cols-[1fr_auto]">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Gemini API key</label>
                <Input aria-label="Gemini API key"
                  type="password" autoComplete="new-password" data-lpignore="true" name="ai_provider_secret"
                  placeholder={data.config.maskedGeminiApiKey ?? 'AIzaSy...'}
                  value={configForm.geminiApiKey}
                  disabled={!isSuperAdmin}
                  onChange={(event) => setConfigForm((current) => ({ ...current, geminiApiKey: event.target.value }))}
                />
              </div>
              <ModelField label="Text model" value={TEXT_MODEL} />
              <ModelField label="Image model" value={IMAGE_MODEL} />
              <ModelField label="TTS model" value={TTS_MODEL} />
              <label className="flex items-center gap-2 rounded-lg border border-line bg-surface-variant px-3 py-2 text-sm text-ink-700">
                <input
                  type="checkbox"
                  checked={configForm.enabled}
                  disabled={!isSuperAdmin}
                  onChange={(event) => setConfigForm((current) => ({ ...current, enabled: event.target.checked }))}
                />
                Enabled
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-line bg-surface-variant px-3 py-2 text-sm text-ink-700">
                <input
                  type="checkbox"
                  checked={configForm.googleSearchGroundingEnabled}
                  disabled={!isSuperAdmin}
                  onChange={(event) =>
                    setConfigForm((current) => ({
                      ...current,
                      googleSearchGroundingEnabled: event.target.checked,
                    }))
                  }
                />
                Google Search grounding
                <AiCreditInfoButton />
              </label>
            </div>
            {isSuperAdmin && (
              <div className="flex flex-wrap gap-2 lg:flex-col lg:justify-end">
                <Button type="submit" variant="primary" disabled={configMutation.isPending}>
                  {configMutation.isPending ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                  Save
                </Button>
                <Button type="button" variant="outline" disabled={testMutation.isPending || !data.config.hasGeminiApiKey} onClick={() => testMutation.mutate()}>
                  {testMutation.isPending ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                  Test
                </Button>
              </div>
            )}
          </form>
        </Card>
      </AiView>
      <AiView activeTab={activeTab} value="pricing" className="space-y-5">
        <Card className="space-y-4 px-4 py-5 sm:px-6">          <div className="space-y-3 border-t border-line pt-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-sm font-bold text-ink-900">Model Pricing</h4>
                <p className="text-xs text-ink-500">USD rates converted to SoftLogic AI credits at $0.000001 per credit.</p>
              </div>
              {isSuperAdmin && (
                <Button type="button" variant="outline" size="sm" disabled={pricingMutation.isPending} onClick={() => pricingMutation.mutate(pricingForm)}>
                  {pricingMutation.isPending ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                  Save pricing
                </Button>
              )}
            </div>
            <div className="overflow-x-auto scrollbar-thin" role="region" aria-label="Pro model pricing" tabIndex={0}>
              <table className="min-w-[860px] text-left text-xs">
                <thead className="uppercase tracking-wide text-ink-500">
                  <tr>
                    <th className="py-2 pr-3">Model</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Input / 1M</th>
                    <th className="py-2 pr-3">Output / 1M</th>
                    <th className="py-2 pr-3">Image each</th>
                    <th className="py-2 pr-3">Search / 1000</th>
                    <th className="py-2 pr-3">On</th>
                  </tr>
                </thead>
                <tbody>
                  {pricingForm.map((row) => (
                    <tr key={row.modelId} className="border-t border-line">
                      <td className="py-2 pr-3">
                        <p className="min-w-[150px] font-semibold text-ink-900">{row.modelId}</p>
                      </td>
                      <td className="py-2 pr-3">
                        <Select
                          value={row.billingType}
                          disabled={!isSuperAdmin}
                          onValueChange={(value) => updatePricingRow(row.modelId, 'billingType', value)}
                        >
                          <SelectTrigger aria-label={`Billing type · ${row.modelId}`} className="h-9 min-w-[96px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="token">Token</SelectItem>
                            <SelectItem value="image">Image</SelectItem>
                            <SelectItem value="audio">Audio</SelectItem>
                            <SelectItem value="tool">Tool</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 pr-3">
                        <Input className="h-9 min-w-[96px]" type="number" min={0} step="0.000001" disabled={!isSuperAdmin} aria-label={`Input USD per million · ${row.modelId}`} value={row.inputUsdPerMillion} onChange={(event) => updatePricingRow(row.modelId, 'inputUsdPerMillion', event.target.value)} />
                      </td>
                      <td className="py-2 pr-3">
                        <Input className="h-9 min-w-[96px]" type="number" min={0} step="0.000001" disabled={!isSuperAdmin} aria-label={`Output USD per million · ${row.modelId}`} value={row.outputUsdPerMillion} onChange={(event) => updatePricingRow(row.modelId, 'outputUsdPerMillion', event.target.value)} />
                      </td>
                      <td className="py-2 pr-3">
                        <Input className="h-9 min-w-[96px]" type="number" min={0} step="0.000001" disabled={!isSuperAdmin} aria-label={`USD per image · ${row.modelId}`} value={row.imageUsdEach} onChange={(event) => updatePricingRow(row.modelId, 'imageUsdEach', event.target.value)} />
                      </td>
                      <td className="py-2 pr-3">
                        <Input className="h-9 min-w-[96px]" type="number" min={0} step="0.000001" disabled={!isSuperAdmin} aria-label={`Search USD per thousand · ${row.modelId}`} value={row.searchUsdPerThousand} onChange={(event) => updatePricingRow(row.modelId, 'searchUsdPerThousand', event.target.value)} />
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="checkbox"
                          aria-label={`Enable pricing · ${row.modelId}`} checked={row.enabled}
                          disabled={!isSuperAdmin}
                          onChange={(event) => updatePricingRow(row.modelId, 'enabled', event.target.checked)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
</Card>
        <FreePricingCard />
      </AiView>
      <AiView activeTab={activeTab} value="tiers">
        <AiTiersTab />
      </AiView>
      <AiView activeTab={activeTab} value="credits">
        {tierSummaryQuery.data?.tiersActive === false ? (<>        <Card className="space-y-4 px-4 py-5 sm:px-6">
          <div>
            <div className="flex items-center gap-1">
              <h3 className="text-base font-bold text-ink-900">Credits</h3>
              <AiCreditInfoButton />
            </div>
            <p className="text-sm text-ink-500">Prepaid AI credit wallet with reserved child allocations.</p>
          </div>
          {isSuperAdmin && (
            <section className="rounded-lg border border-line bg-white px-4 py-4">
              <div className="mb-3">
                <h4 className="text-sm font-bold text-ink-900">Master pool top-up</h4>
                <p className="text-xs text-ink-500">
                  Add credits to the central SoftLogic AI wallet.
                </p>
              </div>
              <form onSubmit={submitTopUp} className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <AiField label="AI credits to add to master pool"><Input
                  type="number"
                  min={1}
                  placeholder="AI credits to add to master pool"
                  value={topUpTokens}
                  onChange={(event) => setTopUpTokens(event.target.value)}
                /></AiField>
                <Button type="submit" variant="primary" disabled={topUpMutation.isPending}>
                  {topUpMutation.isPending ? <Spinner className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
                  Add
                </Button>
              </form>
            </section>
          )}
          <section className="rounded-lg border border-line bg-white px-4 py-4">
            <div className="mb-3">
              <h4 className="text-sm font-bold text-ink-900">Allocate to organization or user</h4>
              <p className="text-xs text-ink-500">
                Add credits from your available pool to a child account.
              </p>
            </div>
            <form data-tour="tour-ai-allocate-form" onSubmit={submitAllocation} className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                value={allocation.targetType}
                onValueChange={(value) => setAllocation((current) => ({ ...current, targetType: value }))}
              >
                <SelectTrigger data-tour="tour-ai-allocate-target"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ORGANIZATION">Organization</SelectItem>
                  <SelectItem value="USER">User</SelectItem>
                </SelectContent>
              </Select>
              <AiField label="AI credits to allocate"><Input
                data-tour="tour-ai-allocate-amount"
                type="number"
                min={1}
                placeholder="AI credits to allocate"
                value={allocation.amountTokens}
                onChange={(event) => setAllocation((current) => ({ ...current, amountTokens: event.target.value }))}
              /></AiField>
            </div>
            {selectedAllocationAccount && (
              <div className="grid gap-2 rounded-lg bg-surface-variant px-3 py-3 text-xs text-ink-600 sm:grid-cols-3">
                <span>Assigned: <strong className="text-ink-900">{formatTokens(selectedAllocationAccount.allocatedTokens)}</strong></span>
                <span>Used: <strong className="text-ink-900">{formatTokens(selectedAllocationAccount.usedTokens)}</strong></span>
                <span>Available: <strong className="text-ink-900">{formatTokens(selectedAllocationAccount.availableTokens)}</strong></span>
              </div>
            )}
            {allocation.targetType === 'ORGANIZATION' ? (
              <Select
                value={allocation.organizationId}
                onValueChange={(value) => setAllocation((current) => ({ ...current, organizationId: value }))}
              >
                <SelectTrigger><SelectValue placeholder="Select organization" /></SelectTrigger>
                <SelectContent>
                  {data.organizations.map((organization) => (
                    <SelectItem key={organization.id} value={organization.id}>{organization.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select
                value={allocation.userId}
                onValueChange={(value) => setAllocation((current) => ({ ...current, userId: value }))}
              >
                <SelectTrigger><SelectValue placeholder="Select teacher/admin user" /></SelectTrigger>
                <SelectContent>
                  {visibleUserRows.map(({ user: row }) => (
                    <SelectItem key={row.id} value={row.id}>{row.name ?? row.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button data-tour="tour-ai-allocate-submit" type="submit" variant="outline" disabled={allocationMutation.isPending}>
              {allocationMutation.isPending ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              Allocate credits
            </Button>
            </form>
          </section>
          {isSuperAdmin && (
            <section className="rounded-lg border border-line bg-white px-4 py-4">
              <div className="mb-3">
                <h4 className="text-sm font-bold text-ink-900">Reclaim granted credits</h4>
                <p className="text-xs text-ink-500">
                  Return unused assigned credits to the account they came from.
                </p>
              </div>
              <form onSubmit={submitReclaim} className="grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select
                    value={reclaim.targetType}
                    onValueChange={(value) =>
                      setReclaim({
                        targetType: value,
                        organizationId: '',
                        userId: '',
                        amountTokens: '',
                      })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ORGANIZATION">Organization</SelectItem>
                      <SelectItem value="USER">User</SelectItem>
                    </SelectContent>
                  </Select>
                  {reclaim.targetType === 'ORGANIZATION' ? (
                    <Select
                      value={reclaim.organizationId}
                      onValueChange={(value) =>
                        setReclaim((current) => ({
                          ...current,
                          organizationId: value,
                          amountTokens: '',
                        }))
                      }
                    >
                      <SelectTrigger><SelectValue placeholder="Select organization" /></SelectTrigger>
                      <SelectContent>
                        {data.organizations.map((organization) => (
                          <SelectItem key={organization.id} value={organization.id}>
                            {organization.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select
                      value={reclaim.userId}
                      onValueChange={(value) =>
                        setReclaim((current) => ({
                          ...current,
                          userId: value,
                          amountTokens: '',
                        }))
                      }
                    >
                      <SelectTrigger><SelectValue placeholder="Select teacher/admin user" /></SelectTrigger>
                      <SelectContent>
                        {visibleUserRows
                          .filter(({ user: row }) => row.role !== 'SUPER_ADMIN')
                          .map(({ user: row }) => (
                            <SelectItem key={row.id} value={row.id}>
                              {row.name ?? row.email}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                {selectedReclaimAccount && (
                  <div className="grid gap-2 rounded-lg bg-surface-variant px-3 py-3 text-xs text-ink-600 sm:grid-cols-3">
                    <span>
                      Assigned: <strong className="text-ink-900">
                        {formatTokens(selectedReclaimAccount.allocatedTokens)}
                      </strong>
                    </span>
                    <span>
                      Must retain: <strong className="text-ink-900">
                        {formatTokens(minimumReclaimAllocation)}
                      </strong>
                    </span>
                    <span>
                      Reclaimable: <strong className="text-ink-900">
                        {formatTokens(reclaimableTokens)}
                      </strong>
                    </span>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                  <AiField label="AI credits to reclaim"><Input
                    type="number"
                    min={1}
                    max={reclaimableTokens || undefined}
                    placeholder="AI credits to reclaim"
                    value={reclaim.amountTokens}
                    onChange={(event) =>
                      setReclaim((current) => ({
                        ...current,
                        amountTokens: event.target.value,
                      }))
                    }
                  /></AiField>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!reclaimableTokens}
                    onClick={() =>
                      setReclaim((current) => ({
                        ...current,
                        amountTokens: String(reclaimableTokens),
                      }))
                    }
                  >
                    Reclaim all available
                  </Button>
                  <Button
                    type="submit"
                    variant="destructive"
                    disabled={reclaimMutation.isPending || !reclaimableTokens}
                  >
                    {reclaimMutation.isPending ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      <Undo2 className="h-4 w-4" />
                    )}
                    Reclaim
                  </Button>
                </div>
              </form>
            </section>
          )}
        </Card></>) : <AiCreditsTab isSuperAdmin={isSuperAdmin} />}
      </AiView>
      <AiView activeTab={activeTab} value="plans">
        <AiPlansTab view="plans" />
      </AiView>
      <AiView activeTab={activeTab} value="billing-settings"><AiPlansTab view="billing-settings" /></AiView>
      <AiView activeTab={activeTab} value="gateways"><AiPlansTab view="gateways" /></AiView>
      <AiView activeTab={activeTab} value="orders"><AiPlansTab view="orders" /></AiView>
      <AiView activeTab={activeTab} value="organizations">
        <AiOrganizationsTab />
      </AiView>
      <AiView activeTab={activeTab} value="users">
        <AiUsersTab />
      </AiView>
      <AiView activeTab={activeTab} value="ledger">
        <AiLedgerTab />
      </AiView>
      <AiView activeTab={activeTab} value="free-health">
        <AiFreeHealthTab />
      </AiView>

    </Tabs>
  );
}

function AiView({ activeTab, value, className, children }: {
  activeTab: AiTab;
  value: AiTab;
  className?: string;
  children: ReactNode;
}) {
  if (activeTab !== value) return null;
  return <TabsContent value={value} className={className ? `ai-console-view ${className}` : 'ai-console-view'}>{children}</TabsContent>;
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: string; detail: string }) {
  return (
    <Card className="ai-provider-metric px-5 py-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
          <p className="ai-metric-value" title={value}>{value}</p>
          <p className="break-words text-xs text-ink-500">{detail}</p>
        </div>
      </div>
    </Card>
  );
}

function ModelField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</label>
      <Input aria-label={label} value={value} disabled readOnly />
    </div>
  );
}
