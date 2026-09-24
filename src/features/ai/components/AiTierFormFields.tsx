import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { extractApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { aiAdminApi } from '@/services/ai-admin.api';
import { formatCredits } from './ai-format';

/**
 * Phase 2 additions to the Organization / User forms: a Free credits
 * allocation next to the existing (Pro) allocation, and a Super Admin Pro
 * access switch. Renders nothing until tiers are active, so the forms look
 * exactly as before on a Phase 1 deployment. Saves independently of the form.
 */
export function AiTierFormFields({
  scope,
  targetId,
  sourceOrganizationId,
}: {
  scope: 'ORGANIZATION' | 'USER';
  targetId: string;
  /** Wallet the Free credits come from; null = master Free pool (Super Admin). */
  sourceOrganizationId: string | null;
}) {
  const queryClient = useQueryClient();
  const { user: actor } = useAuthStore();
  const isSuperAdmin = actor?.role === 'SUPER_ADMIN';
  const tierQuery = useQuery({ queryKey: ['ai-my-tier'], queryFn: aiAdminApi.myTier, retry: false, staleTime: 60_000 });
  const active = Boolean(tierQuery.data?.tiersActive);
  const overviewQuery = useQuery({
    queryKey: ['ai-allocation-overview', 'FREE'],
    queryFn: () => aiAdminApi.allocationOverview('FREE'),
    enabled: active,
  });
  const policyQuery = useQuery({
    queryKey: ['ai-tier-policies', 'target', scope, targetId],
    queryFn: () =>
      aiAdminApi.policies(scope === 'USER' ? { userId: targetId, perPage: 1 } : { organizationId: targetId, perPage: 1 }),
    enabled: active && isSuperAdmin,
  });

  const accounts = overviewQuery.data?.accounts ?? [];
  const current = accounts.find((account) =>
    scope === 'USER' ? account.scope === 'USER' && account.userId === targetId : account.scope === 'ORGANIZATION' && account.organizationId === targetId,
  );
  const source =
    (sourceOrganizationId ? accounts.find((account) => account.scope === 'ORGANIZATION' && account.organizationId === sourceOrganizationId) : null) ??
    (isSuperAdmin ? overviewQuery.data?.master ?? null : null);
  const sameWallet = Boolean(current && source && current.id === source.id);
  const currentAllocated = current?.allocatedTokens ?? 0;
  const assignable = sameWallet ? 0 : (source?.availableTokens ?? 0) + currentAllocated;

  const [freeCredits, setFreeCredits] = useState('');
  const [proAccess, setProAccess] = useState<'INHERIT' | 'ON' | 'OFF'>('INHERIT');
  const policy = policyQuery.data?.data?.[0] ?? null;

  useEffect(() => {
    if (!overviewQuery.data) return;
    const timer = window.setTimeout(() => setFreeCredits(String(currentAllocated)), 0);
    return () => window.clearTimeout(timer);
  }, [overviewQuery.data, currentAllocated]);
  useEffect(() => {
    if (!policyQuery.data) return;
    const value = policy?.proEnabled === true ? 'ON' : policy?.proEnabled === false ? 'OFF' : 'INHERIT';
    const timer = window.setTimeout(() => setProAccess(value), 0);
    return () => window.clearTimeout(timer);
  }, [policyQuery.data, policy?.proEnabled]);

  const freeMutation = useMutation({
    mutationFn: () => {
      const amount = Math.max(0, Math.round(Number(freeCredits || 0)));
      if (amount > assignable) throw new Error(`Only ${formatCredits(assignable)} Free credits are assignable`);
      return aiAdminApi.setAllocation({
        tier: 'FREE',
        sourceAccountId: source?.id ?? undefined,
        scope,
        organizationId: scope === 'ORGANIZATION' ? targetId : undefined,
        userId: scope === 'USER' ? targetId : undefined,
        allocatedTokens: amount,
        reason: scope === 'USER' ? 'User edit Free allocation' : 'Organization edit Free allocation',
      });
    },
    onSuccess: () => {
      toast.success('Free credits saved');
      queryClient.invalidateQueries({ queryKey: ['ai-allocation-overview'] });
    },
    onError: (error) => toast.error(extractApiError(error)),
  });
  const policyMutation = useMutation({
    mutationFn: () =>
      aiAdminApi.savePolicy({
        scope,
        organizationId: scope === 'ORGANIZATION' ? targetId : null,
        userId: scope === 'USER' ? targetId : null,
        proEnabled: proAccess === 'INHERIT' ? null : proAccess === 'ON',
        freeDailyRequests: policy?.freeDailyRequests ?? null,
        freeDailyCredits: policy?.freeDailyCredits ?? null,
        note: policy?.note ?? null,
      }),
    onSuccess: () => {
      toast.success('Pro access saved');
      queryClient.invalidateQueries({ queryKey: ['ai-tier-policies'] });
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  if (!active) return null;
  const brand = tierQuery.data!.brand;

  return (
    <div className="space-y-3 rounded-xl border border-line bg-gradient-to-r from-sky-50/60 via-white to-sky-50/30 p-4 shadow-2xs">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-bold text-ink-900">{brand.free} credits</h4>
        <span className="text-[11px] font-semibold text-ink-500">{formatCredits(currentAllocated)} assigned</span>
      </div>
      <p className="text-xs text-ink-500">The allocation above is {brand.pro}. Free credits are allocated separately and saved immediately.</p>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Input type="number" min={0} max={assignable} className="h-9 bg-white font-semibold" value={freeCredits} disabled={sameWallet || !overviewQuery.data} onChange={(event) => setFreeCredits(event.target.value)} />
        <Button type="button" variant="outline" size="sm" disabled={freeMutation.isPending || sameWallet || !overviewQuery.data} onClick={() => freeMutation.mutate()}>
          {freeMutation.isPending ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          Save Free credits
        </Button>
      </div>
      <p className="text-xs text-ink-500">
        Assignable: <span className="font-semibold text-ink-700">{formatCredits(assignable)}</span>
        {current ? ` · ${formatCredits(current.usedTokens)} used · ${formatCredits(current.availableTokens)} available` : ''}
      </p>
      {isSuperAdmin ? (
        <div className="grid gap-2 border-t border-line pt-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">{brand.pro} access</label>
            <Select value={proAccess} onValueChange={(value) => setProAccess(value as 'INHERIT' | 'ON' | 'OFF')}>
              <SelectTrigger className="h-9 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INHERIT">Inherit (parent / global default)</SelectItem>
                <SelectItem value="ON">On</SelectItem>
                <SelectItem value="OFF">Off</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="button" variant="outline" size="sm" disabled={policyMutation.isPending || !policyQuery.data} onClick={() => policyMutation.mutate()}>
            {policyMutation.isPending ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            Save access
          </Button>
        </div>
      ) : null}
    </div>
  );
}
