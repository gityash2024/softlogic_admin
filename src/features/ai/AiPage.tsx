import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { BrainCircuit, CheckCircle2, CloudCog, Database, KeyRound, RefreshCw, Save, Send, Undo2, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { AiCreditInfoButton } from '@/components/ai/AiCreditInfoButton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { aiApi } from '@/services/ai.api';
import { extractApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import type { AiCreditAccountSummary, AiModelPricingSummary, AiOverview, AiWarningLevel } from '@/types/api';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  'https://softlogic-api.mymultimeds.com/api/v1';

const TEXT_MODEL = 'gemini-3.5-flash';
const IMAGE_MODEL = 'imagen-4.0-generate-001';
const TTS_MODEL = 'gemini-2.5-flash-preview-tts';

const formatTokens = (value: number | null | undefined) =>
  new Intl.NumberFormat('en-IN').format(value ?? 0);

const formatUsd = (micros: number | null | undefined) =>
  `$${((micros ?? 0) / 1_000_000).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  })}`;

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

const warningLabel: Record<AiWarningLevel, string> = {
  NONE: 'Healthy',
  LOW_20: '20% warning',
  LOW_10: '10% warning',
  LOW_5: '5% warning',
  EXHAUSTED: 'Exhausted',
};

const warningClass = (level: AiWarningLevel) => {
  if (level === 'EXHAUSTED') return 'border-red-200 bg-red-50 text-red-700';
  if (level === 'LOW_5' || level === 'LOW_10') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (level === 'LOW_20') return 'border-yellow-200 bg-yellow-50 text-yellow-700';
  return 'border-emerald-200 bg-emerald-50 text-emerald-700';
};

function accountName(account: AiCreditAccountSummary) {
  return (
    account.organization?.name ??
    account.user?.name ??
    account.user?.email ??
    (account.scope === 'MASTER' ? 'Master AI pool' : account.id)
  );
}

function accountForOrg(data: AiOverview | undefined, organizationId: string) {
  return data?.accounts.find((account) => account.scope === 'ORGANIZATION' && account.organizationId === organizationId);
}

function accountForUser(data: AiOverview | undefined, userId: string) {
  return data?.accounts.find((account) => account.scope === 'USER' && account.userId === userId);
}

export function AiPage() {
  const queryClient = useQueryClient();
  const { tokens, user } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [configForm, setConfigForm] = useState({
    geminiApiKey: '',
    enabled: true,
    googleSearchGroundingEnabled: false,
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
  const [pricingForm, setPricingForm] = useState<PricingFormRow[]>([]);
  const [billingForm, setBillingForm] = useState({
    enabled: false,
    projectId: 'softlogic-496310',
    billingTableProjectId: '',
    billingDatasetId: '',
    billingTableName: '',
    monthlyCapUsd: '50',
  });
  const [ledgerFilters, setLedgerFilters] = useState({
    search: '',
    type: 'ALL',
    direction: 'ALL',
    model: '',
    fromDate: '',
    toDate: '',
    minCredits: '',
    maxCredits: '',
  });

  const overviewQuery = useQuery({
    queryKey: ['ai-overview'],
    queryFn: aiApi.overview,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!tokens?.accessToken) return;
    const socketOrigin = new URL(API_BASE_URL).origin;
    const socket = io(socketOrigin, {
      auth: { token: tokens.accessToken },
      transports: ['websocket', 'polling'],
    });
    socket.on('connect', () => socket.emit('ai:join'));
    socket.on('ai:credits-updated', () => {
      queryClient.invalidateQueries({ queryKey: ['ai-overview'] });
    });
    return () => {
      socket.disconnect();
    };
  }, [queryClient, tokens?.accessToken]);

  useEffect(() => {
    const config = overviewQuery.data?.config;
    if (!config) return;
    const timer = window.setTimeout(() => {
      setConfigForm((current) => ({
        ...current,
        enabled: config.enabled,
        googleSearchGroundingEnabled: config.googleSearchGroundingEnabled,
      }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [overviewQuery.data?.config]);

  useEffect(() => {
    if (!overviewQuery.data?.pricing) return;
    const timer = window.setTimeout(() => {
      setPricingForm(overviewQuery.data.pricing.map(pricingRowFromSummary));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [overviewQuery.data?.pricing]);

  useEffect(() => {
    const billing = overviewQuery.data?.googleBilling?.config;
    if (!billing) return;
    const timer = window.setTimeout(() => {
      setBillingForm({
        enabled: billing.enabled,
        projectId: billing.projectId,
        billingTableProjectId: billing.billingTableProjectId ?? '',
        billingDatasetId: billing.billingDatasetId ?? '',
        billingTableName: billing.billingTableName ?? '',
        monthlyCapUsd: String((billing.monthlyCapMicros ?? 50_000_000) / 1_000_000),
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [overviewQuery.data?.googleBilling?.config]);

  const configMutation = useMutation({
    mutationFn: () =>
      aiApi.updateConfig({
        geminiApiKey: configForm.geminiApiKey.trim() || undefined,
        geminiTextModel: TEXT_MODEL,
        geminiImageModel: IMAGE_MODEL,
        geminiTtsModel: TTS_MODEL,
        googleSearchGroundingEnabled: configForm.googleSearchGroundingEnabled,
        enabled: configForm.enabled,
      }),
    onSuccess: () => {
      toast.success('AI configuration saved');
      setConfigForm((current) => ({ ...current, geminiApiKey: '' }));
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
    mutationFn: () =>
      aiApi.updatePricing({
        pricing: pricingForm.map((row) => ({
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
    onSuccess: () => {
      toast.success('AI pricing saved');
      queryClient.invalidateQueries({ queryKey: ['ai-overview'] });
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const billingMutation = useMutation({
    mutationFn: () =>
      aiApi.updateGoogleBilling({
        enabled: billingForm.enabled,
        projectId: billingForm.projectId.trim(),
        billingTableProjectId: billingForm.billingTableProjectId.trim() || null,
        billingDatasetId: billingForm.billingDatasetId.trim() || null,
        billingTableName: billingForm.billingTableName.trim() || null,
        monthlyCapMicros: inputValueToMicros(billingForm.monthlyCapUsd),
      }),
    onSuccess: () => {
      toast.success('Google billing verification saved');
      queryClient.invalidateQueries({ queryKey: ['ai-overview'] });
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const billingSyncMutation = useMutation({
    mutationFn: aiApi.syncGoogleBilling,
    onSuccess: () => {
      toast.success('Google billing verification synced');
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
  const visibleOrgRows = useMemo(
    () =>
      (data?.organizations ?? []).map((organization) => ({
        organization,
        account: accountForOrg(data, organization.id),
      })),
    [data],
  );
  const visibleUserRows = useMemo(
    () =>
      (data?.users ?? [])
        .filter((row) => row.role !== 'STUDENT' && row.role !== 'PARENT')
        .map((row) => ({ user: row, account: accountForUser(data, row.id) })),
    [data],
  );
  const filteredLedger = useMemo(() => {
    const search = ledgerFilters.search.trim().toLowerCase();
    const minCredits = Number(ledgerFilters.minCredits || Number.NaN);
    const maxCredits = Number(ledgerFilters.maxCredits || Number.NaN);
    const fromTime = ledgerFilters.fromDate ? new Date(`${ledgerFilters.fromDate}T00:00:00`).getTime() : null;
    const toTime = ledgerFilters.toDate ? new Date(`${ledgerFilters.toDate}T23:59:59`).getTime() : null;
    return (data?.recentLedger ?? []).filter((entry) => {
      const createdTime = new Date(entry.createdAt).getTime();
      if (fromTime && createdTime < fromTime) return false;
      if (toTime && createdTime > toTime) return false;
      if (ledgerFilters.type !== 'ALL' && entry.type !== ledgerFilters.type) return false;
      if (ledgerFilters.direction === 'DEBIT' && entry.amountTokens >= 0) return false;
      if (ledgerFilters.direction === 'CREDIT' && entry.amountTokens < 0) return false;
      if (ledgerFilters.model.trim() && !(entry.modelId ?? '').toLowerCase().includes(ledgerFilters.model.trim().toLowerCase())) return false;
      const absCredits = Math.abs(entry.amountTokens);
      if (Number.isFinite(minCredits) && absCredits < minCredits) return false;
      if (Number.isFinite(maxCredits) && absCredits > maxCredits) return false;
      if (search) {
        const haystack = [
          entry.type,
          entry.reason,
          entry.modelId,
          entry.actorUser?.name,
          entry.actorUser?.email,
          entry.account?.organization?.name,
          entry.account?.user?.name,
          entry.account?.user?.email,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }, [data?.recentLedger, ledgerFilters]);
  const ledgerTypes = useMemo(
    () => Array.from(new Set((data?.recentLedger ?? []).map((entry) => entry.type))).sort(),
    [data?.recentLedger],
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
    configMutation.mutate();
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
        <p className="mt-1 text-sm text-ink-500">{extractApiError(overviewQuery.error)}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-black text-ink-900">AI</h2>
          <p className="text-sm text-ink-500">
            Central Gemini key, AI credits, live usage, and hierarchy allocations.
          </p>
        </div>
        <Button variant="outline" onClick={() => overviewQuery.refetch()}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <MetricCard icon={Wallet} label="Master available" value={formatTokens(data.master.availableTokens)} detail={`${formatTokens(data.master.allocatedTokens)} total`} />
        <MetricCard icon={BrainCircuit} label="AI credits used" value={formatTokens(data.master.usedTokens)} detail={`${formatTokens(data.master.reservedTokens)} reserved`} />
        <MetricCard icon={KeyRound} label="Gemini key" value={data.config.hasGeminiApiKey ? 'Configured' : 'Missing'} detail={data.config.maskedGeminiApiKey ?? 'No master key'} />
        <MetricCard icon={CheckCircle2} label="Status" value={data.config.enabled ? 'Enabled' : 'Disabled'} detail={data.config.lastTestStatus ?? 'Not tested'} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="space-y-4 px-4 py-5 sm:px-6">
          <div>
            <h3 className="text-base font-bold text-ink-900">Master AI Configuration</h3>
            <p className="text-sm text-ink-500">Stored centrally and encrypted in the backend.</p>
          </div>
          <form onSubmit={submitConfig} className="grid gap-4 lg:grid-cols-[1fr_auto]">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Gemini API key</label>
                <Input
                  type="password"
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
          <div className="space-y-3 border-t border-line pt-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-sm font-bold text-ink-900">Model Pricing</h4>
                <p className="text-xs text-ink-500">USD rates converted to SoftLogic AI credits at $0.000001 per credit.</p>
              </div>
              {isSuperAdmin && (
                <Button type="button" variant="outline" size="sm" disabled={pricingMutation.isPending} onClick={() => pricingMutation.mutate()}>
                  {pricingMutation.isPending ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                  Save pricing
                </Button>
              )}
            </div>
            <div className="overflow-x-auto scrollbar-thin">
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
                          <SelectTrigger className="h-9 min-w-[96px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="token">Token</SelectItem>
                            <SelectItem value="image">Image</SelectItem>
                            <SelectItem value="audio">Audio</SelectItem>
                            <SelectItem value="tool">Tool</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 pr-3">
                        <Input className="h-9 min-w-[96px]" type="number" min={0} step="0.000001" disabled={!isSuperAdmin} value={row.inputUsdPerMillion} onChange={(event) => updatePricingRow(row.modelId, 'inputUsdPerMillion', event.target.value)} />
                      </td>
                      <td className="py-2 pr-3">
                        <Input className="h-9 min-w-[96px]" type="number" min={0} step="0.000001" disabled={!isSuperAdmin} value={row.outputUsdPerMillion} onChange={(event) => updatePricingRow(row.modelId, 'outputUsdPerMillion', event.target.value)} />
                      </td>
                      <td className="py-2 pr-3">
                        <Input className="h-9 min-w-[96px]" type="number" min={0} step="0.000001" disabled={!isSuperAdmin} value={row.imageUsdEach} onChange={(event) => updatePricingRow(row.modelId, 'imageUsdEach', event.target.value)} />
                      </td>
                      <td className="py-2 pr-3">
                        <Input className="h-9 min-w-[96px]" type="number" min={0} step="0.000001" disabled={!isSuperAdmin} value={row.searchUsdPerThousand} onChange={(event) => updatePricingRow(row.modelId, 'searchUsdPerThousand', event.target.value)} />
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="checkbox"
                          checked={row.enabled}
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

        <Card className="space-y-4 px-4 py-5 sm:px-6">
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
                <Input
                  type="number"
                  min={1}
                  placeholder="AI credits to add to master pool"
                  value={topUpTokens}
                  onChange={(event) => setTopUpTokens(event.target.value)}
                />
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
            <form onSubmit={submitAllocation} className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                value={allocation.targetType}
                onValueChange={(value) => setAllocation((current) => ({ ...current, targetType: value }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ORGANIZATION">Organization</SelectItem>
                  <SelectItem value="USER">User</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={1}
                placeholder="AI credits to allocate"
                value={allocation.amountTokens}
                onChange={(event) => setAllocation((current) => ({ ...current, amountTokens: event.target.value }))}
              />
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
            <Button type="submit" variant="outline" disabled={allocationMutation.isPending}>
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
                  <Input
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
                  />
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
        </Card>
      </div>

      {isSuperAdmin && data.googleBilling ? (
        <Card className="space-y-4 px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h3 className="text-base font-bold text-ink-900">Google Billing Verification</h3>
              <p className="text-sm text-ink-500">BigQuery billing export compared with SoftLogic AI credit charges.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusPill status={data.googleBilling.status} />
              <Button type="button" variant="outline" disabled={billingSyncMutation.isPending} onClick={() => billingSyncMutation.mutate()}>
                {billingSyncMutation.isPending ? <Spinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
                Sync now
              </Button>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-4">
            <MetricCard icon={CloudCog} label="Google spend" value={formatUsd(data.googleBilling.googleCurrentMonthCostMicros)} detail={`gross ${formatUsd(data.googleBilling.googleGrossCostMicros)}`} />
            <MetricCard icon={Wallet} label="Google remaining" value={formatUsd(data.googleBilling.remainingBudgetMicros)} detail={`cap ${formatUsd(data.googleBilling.monthlyCapMicros)}`} />
            <MetricCard icon={BrainCircuit} label="SoftLogic charged" value={formatUsd(data.googleBilling.softlogicCurrentMonthCostMicros)} detail="AI credits equivalent" />
            <MetricCard icon={Database} label="Variance" value={formatUsd(data.googleBilling.varianceMicros)} detail={data.googleBilling.message ?? 'Awaiting sync'} />
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              billingMutation.mutate();
            }}
            className="grid gap-3 lg:grid-cols-[0.8fr_0.8fr_0.8fr_0.8fr_0.6fr_auto]"
          >
            <Input
              placeholder="Project ID"
              value={billingForm.projectId}
              onChange={(event) => setBillingForm((current) => ({ ...current, projectId: event.target.value }))}
            />
            <Input
              placeholder="Table project"
              value={billingForm.billingTableProjectId}
              onChange={(event) => setBillingForm((current) => ({ ...current, billingTableProjectId: event.target.value }))}
            />
            <Input
              placeholder="Dataset ID"
              value={billingForm.billingDatasetId}
              onChange={(event) => setBillingForm((current) => ({ ...current, billingDatasetId: event.target.value }))}
            />
            <Input
              placeholder="Table name"
              value={billingForm.billingTableName}
              onChange={(event) => setBillingForm((current) => ({ ...current, billingTableName: event.target.value }))}
            />
            <Input
              type="number"
              min={1}
              step="0.01"
              placeholder="Monthly cap"
              value={billingForm.monthlyCapUsd}
              onChange={(event) => setBillingForm((current) => ({ ...current, monthlyCapUsd: event.target.value }))}
            />
            <div className="flex gap-2">
              <label className="flex h-11 items-center gap-2 rounded-lg border border-line px-3 text-sm text-ink-700">
                <input
                  type="checkbox"
                  checked={billingForm.enabled}
                  onChange={(event) => setBillingForm((current) => ({ ...current, enabled: event.target.checked }))}
                />
                On
              </label>
              <Button type="submit" variant="outline" disabled={billingMutation.isPending}>
                {billingMutation.isPending ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                Save
              </Button>
            </div>
          </form>

          <div className="overflow-x-auto scrollbar-thin">
            <table className="min-w-[860px] text-left text-xs">
              <thead className="uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Service</th>
                  <th className="py-2 pr-4">SKU</th>
                  <th className="py-2 pr-4">Cost</th>
                  <th className="py-2 pr-4">Credits</th>
                  <th className="py-2 pr-4">Net</th>
                </tr>
              </thead>
              <tbody>
                {data.googleBilling.recentRows.length ? (
                  data.googleBilling.recentRows.map((row) => (
                    <tr key={row.id} className="border-t border-line">
                      <td className="py-2 pr-4">{new Date(row.usageDate).toLocaleDateString()}</td>
                      <td className="py-2 pr-4">{row.serviceDescription}</td>
                      <td className="py-2 pr-4">{row.skuDescription}</td>
                      <td className="py-2 pr-4">{formatUsd(row.costMicros)}</td>
                      <td className="py-2 pr-4">{formatUsd(row.creditsMicros)}</td>
                      <td className="py-2 pr-4 font-semibold text-ink-900">{formatUsd(row.netCostMicros)}</td>
                    </tr>
                  ))
                ) : (
                  <tr className="border-t border-line">
                    <td className="py-3 pr-4 text-ink-500" colSpan={6}>
                      {data.googleBilling.lastSyncAt
                        ? `No Google AI billing rows exported yet. Last sync: ${new Date(data.googleBilling.lastSyncAt).toLocaleString()}. ${data.googleBilling.message ?? ''}`
                        : 'No Google billing sync has run yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <Card className="px-4 py-5 sm:px-6">
        <h3 className="text-base font-bold text-ink-900">Organizations</h3>
        <div className="mt-4 overflow-x-auto scrollbar-thin">
          <table className="min-w-[920px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="py-2 pr-4">Organization</th>
                <th className="py-2 pr-4">Allocated</th>
                <th className="py-2 pr-4">Used</th>
                <th className="py-2 pr-4">Reserved</th>
                <th className="py-2 pr-4">Child allocated</th>
                <th className="py-2 pr-4">Available</th>
                <th className="py-2 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleOrgRows.map(({ organization, account }) => (
                <CreditRow key={organization.id} name={organization.name} account={account} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="px-4 py-5 sm:px-6">
        <h3 className="text-base font-bold text-ink-900">Users</h3>
        <div className="mt-4 overflow-x-auto scrollbar-thin">
          <table className="min-w-[860px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="py-2 pr-4">User</th>
                <th className="py-2 pr-4">Role</th>
                <th className="py-2 pr-4">Allocated</th>
                <th className="py-2 pr-4">Used</th>
                <th className="py-2 pr-4">Available</th>
                <th className="py-2 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleUserRows.map(({ user: row, account }) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="py-3 pr-4">
                    <p className="font-semibold text-ink-900">{row.name ?? row.email}</p>
                    <p className="text-xs text-ink-500">{row.email}</p>
                  </td>
                  <td className="py-3 pr-4">{row.role}</td>
                  <td className="py-3 pr-4">{formatTokens(account?.allocatedTokens)}</td>
                  <td className="py-3 pr-4">{formatTokens(account?.usedTokens)}</td>
                  <td className="py-3 pr-4">{account ? formatTokens(account.availableTokens) : 'Uses org pool'}</td>
                  <td className="py-3 pr-4">
                    {account ? <StatusBadge account={account} /> : <span className="text-xs text-ink-500">No personal limit</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="px-4 py-5 sm:px-6">
        <h3 className="text-base font-bold text-ink-900">Live Ledger</h3>
        <div className="mt-4 grid gap-3 rounded-lg border border-line bg-surface-variant p-3 lg:grid-cols-4">
          <Input
            placeholder="Search actor, user, org, reason"
            value={ledgerFilters.search}
            onChange={(event) => setLedgerFilters((current) => ({ ...current, search: event.target.value }))}
          />
          <Select value={ledgerFilters.type} onValueChange={(value) => setLedgerFilters((current) => ({ ...current, type: value }))}>
            <SelectTrigger><SelectValue placeholder="Ledger type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All types</SelectItem>
              {ledgerTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={ledgerFilters.direction} onValueChange={(value) => setLedgerFilters((current) => ({ ...current, direction: value }))}>
            <SelectTrigger><SelectValue placeholder="Direction" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Debit and credit</SelectItem>
              <SelectItem value="DEBIT">Debits only</SelectItem>
              <SelectItem value="CREDIT">Credits only</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Model or tool"
            value={ledgerFilters.model}
            onChange={(event) => setLedgerFilters((current) => ({ ...current, model: event.target.value }))}
          />
          <Input
            type="date"
            value={ledgerFilters.fromDate}
            onChange={(event) => setLedgerFilters((current) => ({ ...current, fromDate: event.target.value }))}
          />
          <Input
            type="date"
            value={ledgerFilters.toDate}
            onChange={(event) => setLedgerFilters((current) => ({ ...current, toDate: event.target.value }))}
          />
          <Input
            type="number"
            min={0}
            placeholder="Min credits"
            value={ledgerFilters.minCredits}
            onChange={(event) => setLedgerFilters((current) => ({ ...current, minCredits: event.target.value }))}
          />
          <Input
            type="number"
            min={0}
            placeholder="Max credits"
            value={ledgerFilters.maxCredits}
            onChange={(event) => setLedgerFilters((current) => ({ ...current, maxCredits: event.target.value }))}
          />
        </div>
        <div className="mt-4 grid gap-2">
          {filteredLedger.map((entry) => (
            <div key={entry.id} className="grid gap-2 rounded-lg border border-line bg-white px-3 py-3 text-sm md:grid-cols-[1fr_auto_auto]">
              <div>
                <p className="font-semibold text-ink-900">{entry.type} - {entry.reason ?? accountName(entry.account as AiCreditAccountSummary)}</p>
                <p className="text-xs text-ink-500">
                  {entry.actorUser?.name ?? entry.actorUser?.email ?? 'System'} - {new Date(entry.createdAt).toLocaleString()}
                </p>
                {(entry.modelId || entry.totalTokens || entry.estimatedCostMicros) ? (
                  <p className="mt-1 text-xs text-ink-500">
                    {entry.modelId ?? 'AI model'} - input {formatTokens(entry.inputTokens)}, output {formatTokens(entry.outputTokens)}, thinking {formatTokens(entry.thinkingTokens)}, total {formatTokens(entry.totalTokens)}, cost {formatUsd(entry.estimatedCostMicros)}
                  </p>
                ) : null}
              </div>
              <p className={entry.amountTokens >= 0 ? 'font-bold text-emerald-700' : 'font-bold text-red-700'}>
                {entry.amountTokens >= 0 ? '+' : ''}{formatTokens(entry.amountTokens)}
              </p>
              <p className="text-xs text-ink-500">
                {formatTokens(entry.oldTokenBalance)} {'->'} {formatTokens(entry.newTokenBalance)}
              </p>
            </div>
          ))}
          {!filteredLedger.length ? (
            <p className="rounded-lg border border-dashed border-line px-3 py-4 text-sm text-ink-500">
              No ledger entries match the selected filters.
            </p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: string; detail: string }) {
  return (
    <Card className="px-5 py-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
          <p className="truncate text-lg font-black text-ink-900">{value}</p>
          <p className="truncate text-xs text-ink-500">{detail}</p>
        </div>
      </div>
    </Card>
  );
}

function StatusPill({ status }: { status: NonNullable<AiOverview['googleBilling']>['status'] }) {
  const className =
    status === 'SUCCESS'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : status === 'ERROR'
        ? 'border-red-200 bg-red-50 text-red-700'
        : status === 'NEEDS_CONFIGURATION'
          ? 'border-amber-200 bg-amber-50 text-amber-700'
          : 'border-line bg-surface-variant text-ink-600';
  return (
    <span className={`inline-flex h-10 items-center rounded-lg border px-3 text-sm font-semibold ${className}`}>
      {status.replaceAll('_', ' ')}
    </span>
  );
}

function ModelField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</label>
      <Input value={value} disabled readOnly />
    </div>
  );
}

function CreditRow({ name, account }: { name: string; account?: AiCreditAccountSummary }) {
  return (
    <tr className="border-t border-line">
      <td className="py-3 pr-4 font-semibold text-ink-900">{name}</td>
      <td className="py-3 pr-4">{formatTokens(account?.allocatedTokens)}</td>
      <td className="py-3 pr-4">{formatTokens(account?.usedTokens)}</td>
      <td className="py-3 pr-4">{formatTokens(account?.reservedTokens)}</td>
      <td className="py-3 pr-4">{formatTokens(account?.childAllocatedTokens)}</td>
      <td className="py-3 pr-4 font-semibold">{formatTokens(account?.availableTokens)}</td>
      <td className="py-3 pr-4">{account ? <StatusBadge account={account} /> : <span className="text-xs text-ink-500">No pool yet</span>}</td>
    </tr>
  );
}

function StatusBadge({ account }: { account: AiCreditAccountSummary }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${warningClass(account.warningLevel)}`}>
      {warningLabel[account.warningLevel]} - {account.percentRemaining}%
    </span>
  );
}
