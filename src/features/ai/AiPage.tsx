import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { BrainCircuit, CheckCircle2, KeyRound, RefreshCw, Save, Send, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
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
import type { AiCreditAccountSummary, AiOverview, AiWarningLevel } from '@/types/api';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  'https://softlogic-whiteboard-backend-testin.vercel.app/api/v1';

const TEXT_MODEL = 'gemini-3.5-flash';
const IMAGE_MODEL = 'imagen-4.0-generate-001';
const TTS_MODEL = 'gemini-2.5-flash-preview-tts';

const formatTokens = (value: number | null | undefined) =>
  new Intl.NumberFormat('en-IN').format(value ?? 0);

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
  });
  const [topUpTokens, setTopUpTokens] = useState('');
  const [allocation, setAllocation] = useState({
    targetType: 'ORGANIZATION',
    organizationId: '',
    userId: '',
    amountTokens: '',
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
    setConfigForm((current) => ({
      ...current,
      enabled: config.enabled,
    }));
  }, [overviewQuery.data?.config]);

  const configMutation = useMutation({
    mutationFn: () =>
      aiApi.updateConfig({
        geminiApiKey: configForm.geminiApiKey.trim() || undefined,
        geminiTextModel: TEXT_MODEL,
        geminiImageModel: IMAGE_MODEL,
        geminiTtsModel: TTS_MODEL,
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

  const topUpMutation = useMutation({
    mutationFn: () =>
      aiApi.topUp({
        amountTokens: Number(topUpTokens),
        reason: 'Super Admin master AI token top-up',
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
        reason: 'AI token allocation',
      }),
    onSuccess: () => {
      toast.success('AI credits allocated');
      setAllocation((current) => ({ ...current, amountTokens: '' }));
      queryClient.invalidateQueries({ queryKey: ['ai-overview'] });
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const data = overviewQuery.data;
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

  const submitConfig = (event: FormEvent) => {
    event.preventDefault();
    configMutation.mutate();
  };

  const submitTopUp = (event: FormEvent) => {
    event.preventDefault();
    if (!Number(topUpTokens)) {
      toast.error('Enter token credits to add');
      return;
    }
    topUpMutation.mutate();
  };

  const submitAllocation = (event: FormEvent) => {
    event.preventDefault();
    if (!Number(allocation.amountTokens)) {
      toast.error('Enter token credits to allocate');
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

  if (overviewQuery.isLoading) {
    return <div className="flex h-64 items-center justify-center"><Spinner className="h-7 w-7 text-brand-primary" /></div>;
  }

  if (overviewQuery.isError || !data) {
    return (
      <Card className="px-6 py-6">
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
            Central Gemini key, token credits, live usage, and hierarchy allocations.
          </p>
        </div>
        <Button variant="outline" onClick={() => overviewQuery.refetch()}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <MetricCard icon={Wallet} label="Master available" value={formatTokens(data.master.availableTokens)} detail={`${formatTokens(data.master.allocatedTokens)} total`} />
        <MetricCard icon={BrainCircuit} label="Tokens used" value={formatTokens(data.master.usedTokens)} detail={`${formatTokens(data.master.reservedTokens)} reserved`} />
        <MetricCard icon={KeyRound} label="Gemini key" value={data.config.hasGeminiApiKey ? 'Configured' : 'Missing'} detail={data.config.maskedGeminiApiKey ?? 'No master key'} />
        <MetricCard icon={CheckCircle2} label="Status" value={data.config.enabled ? 'Enabled' : 'Disabled'} detail={data.config.lastTestStatus ?? 'Not tested'} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="space-y-4 px-6 py-5">
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
            </div>
            {isSuperAdmin && (
              <div className="flex flex-row gap-2 lg:flex-col lg:justify-end">
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

        <Card className="space-y-4 px-6 py-5">
          <div>
            <h3 className="text-base font-bold text-ink-900">Credits</h3>
            <p className="text-sm text-ink-500">Prepaid token wallet with reserved child allocations.</p>
          </div>
          {isSuperAdmin && (
            <form onSubmit={submitTopUp} className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <Input
                type="number"
                min={1}
                placeholder="Tokens to add to master pool"
                value={topUpTokens}
                onChange={(event) => setTopUpTokens(event.target.value)}
              />
              <Button type="submit" variant="primary" disabled={topUpMutation.isPending}>
                {topUpMutation.isPending ? <Spinner className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
                Add
              </Button>
            </form>
          )}
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
                placeholder="Tokens to allocate"
                value={allocation.amountTokens}
                onChange={(event) => setAllocation((current) => ({ ...current, amountTokens: event.target.value }))}
              />
            </div>
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
        </Card>
      </div>

      <Card className="px-6 py-5">
        <h3 className="text-base font-bold text-ink-900">Organizations</h3>
        <div className="mt-4 overflow-auto">
          <table className="min-w-full text-left text-sm">
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

      <Card className="px-6 py-5">
        <h3 className="text-base font-bold text-ink-900">Users</h3>
        <div className="mt-4 overflow-auto">
          <table className="min-w-full text-left text-sm">
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

      <Card className="px-6 py-5">
        <h3 className="text-base font-bold text-ink-900">Live Ledger</h3>
        <div className="mt-4 grid gap-2">
          {data.recentLedger.map((entry) => (
            <div key={entry.id} className="grid gap-2 rounded-lg border border-line bg-white px-3 py-3 text-sm md:grid-cols-[1fr_auto_auto]">
              <div>
                <p className="font-semibold text-ink-900">{entry.type} - {entry.reason ?? accountName(entry.account as AiCreditAccountSummary)}</p>
                <p className="text-xs text-ink-500">
                  {entry.actorUser?.name ?? entry.actorUser?.email ?? 'System'} - {new Date(entry.createdAt).toLocaleString()}
                </p>
              </div>
              <p className={entry.amountTokens >= 0 ? 'font-bold text-emerald-700' : 'font-bold text-red-700'}>
                {entry.amountTokens >= 0 ? '+' : ''}{formatTokens(entry.amountTokens)}
              </p>
              <p className="text-xs text-ink-500">
                {formatTokens(entry.oldTokenBalance)} {'->'} {formatTokens(entry.newTokenBalance)}
              </p>
            </div>
          ))}
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
