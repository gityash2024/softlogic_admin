import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Layers, Send, Undo2, Wallet } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { StatCard } from '@/features/admin/admin-list-ui';
import { extractApiError } from '@/lib/api';
import { aiAdminApi } from '@/services/ai-admin.api';
import type { AiAccountSearchResult, AiTier } from '@/types/ai';
import { BulkAllocateDialog } from '../components/BulkAllocateDialog';
import { AsyncAccountSelect, SectionHeader, TierBadge, TierToggle } from '../components/ai-ui';
import { formatCredits } from '../components/ai-format';

const invalidateAi = (queryClient: ReturnType<typeof useQueryClient>) =>
  queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0] ?? '').startsWith('ai-') });

/** Free / Pro credit operations with searchable account pickers (no list caps). */
export function AiCreditsTab({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const queryClient = useQueryClient();
  const [tier, setTier] = useState<AiTier>('FREE');
  const [bulkOpen, setBulkOpen] = useState(false);
  const summaryQuery = useQuery({ queryKey: ['ai-summary'], queryFn: aiAdminApi.summary, refetchInterval: 30_000 });
  const master = summaryQuery.data?.[tier].master ?? null;

  const [topUp, setTopUp] = useState('');
  const [allocation, setAllocation] = useState<{ scope: 'ORGANIZATION' | 'USER'; target: AiAccountSearchResult | null; amount: string }>({
    scope: 'ORGANIZATION',
    target: null,
    amount: '',
  });
  const [reclaim, setReclaim] = useState<{ scope: 'ORGANIZATION' | 'USER'; target: AiAccountSearchResult | null; amount: string }>({
    scope: 'ORGANIZATION',
    target: null,
    amount: '',
  });

  const topUpMutation = useMutation({
    mutationFn: () => aiAdminApi.topUp({ tier, amountTokens: Number(topUp), reason: `Super Admin master ${tier === 'FREE' ? 'Free' : 'Pro'} AI credit top-up` }),
    onSuccess: () => {
      toast.success('AI credits added');
      setTopUp('');
      invalidateAi(queryClient);
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const allocateMutation = useMutation({
    mutationFn: () => {
      const target = allocation.target;
      if (!target) throw new Error(allocation.scope === 'USER' ? 'Select a user' : 'Select an organization');
      return aiAdminApi.allocate({
        tier,
        scope: allocation.scope,
        organizationId: allocation.scope === 'ORGANIZATION' ? target.id : undefined,
        userId: allocation.scope === 'USER' ? target.id : undefined,
        amountTokens: Number(allocation.amount),
        reason: 'AI credit allocation',
      });
    },
    onSuccess: () => {
      toast.success('AI credits allocated');
      setAllocation((current) => ({ ...current, target: null, amount: '' }));
      invalidateAi(queryClient);
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const reclaimWallet = reclaim.target?.wallet ?? null;
  const reclaimable = reclaimWallet && !reclaimWallet.unlimited ? Math.max(reclaimWallet.availableTokens, 0) : 0;

  const reclaimMutation = useMutation({
    mutationFn: (all: boolean) => {
      const target = reclaim.target;
      if (!target) throw new Error('Select an account with assigned AI credits');
      return aiAdminApi.reclaim({
        tier,
        scope: reclaim.scope,
        organizationId: reclaim.scope === 'ORGANIZATION' ? target.id : undefined,
        userId: reclaim.scope === 'USER' ? target.id : undefined,
        amountTokens: all ? undefined : Number(reclaim.amount),
        all,
      });
    },
    onSuccess: () => {
      toast.success('AI credits reclaimed');
      setReclaim((current) => ({ ...current, target: null, amount: '' }));
      invalidateAi(queryClient);
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const submitTopUp = (event: FormEvent) => {
    event.preventDefault();
    if (!Number(topUp)) return toast.error('Enter AI credits to add');
    topUpMutation.mutate();
  };
  const submitAllocation = (event: FormEvent) => {
    event.preventDefault();
    if (!Number(allocation.amount)) return toast.error('Enter AI credits to allocate');
    allocateMutation.mutate();
  };
  const submitReclaim = (event: FormEvent) => {
    event.preventDefault();
    const amount = Number(reclaim.amount);
    if (!amount || amount < 1) return toast.error('Enter AI credits to reclaim');
    if (amount > reclaimable) return toast.error(`Only ${formatCredits(reclaimable)} unused credits can be reclaimed`);
    reclaimMutation.mutate(false);
  };

  return (
    <div className="space-y-5">
      <Card className="space-y-4 px-4 py-5 sm:px-6">
        <SectionHeader
          title="Free & Pro credits"
          description="Every organization and user has separate Free and Pro wallets. Allocations always come from the parent wallet of the same tier."
          actions={
            <>
              <TierToggle value={tier} onChange={(value) => setTier(value as AiTier)} />
              <Button type="button" variant="outline" onClick={() => setBulkOpen(true)}>
                <Layers className="h-4 w-4" />
                Bulk allocate
              </Button>
            </>
          }
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label={`${tier === 'PRO' ? 'Pro' : 'Free'} master available`} value={formatCredits(master?.availableTokens)} detail={`${formatCredits(master?.allocatedTokens)} total`} tone={tier === 'PRO' ? 'purple' : 'blue'} />
          <StatCard label="Assigned to children" value={formatCredits(master?.childAllocatedTokens)} tone="gray" />
          <StatCard label="Used" value={formatCredits(summaryQuery.data?.[tier].usedTokens)} detail={`${formatCredits(summaryQuery.data?.[tier].reservedTokens)} reserved`} tone="orange" />
          <StatCard label="Credits today" value={formatCredits(summaryQuery.data?.[tier].today.credits)} detail={`${formatCredits(summaryQuery.data?.[tier].today.requests)} requests`} tone="green" />
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-3">
        {isSuperAdmin ? (
          <Card className="space-y-3 px-4 py-5 sm:px-6">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-ink-900">Master pool top-up</h4>
              <TierBadge tier={tier} />
            </div>
            <p className="text-xs text-ink-500">Add credits to the central {tier === 'PRO' ? 'Pro' : 'Free'} wallet.</p>
            <form onSubmit={submitTopUp} className="grid gap-3">
              <Input type="number" min={1} placeholder="AI credits to add" value={topUp} onChange={(event) => setTopUp(event.target.value)} />
              <Button type="submit" variant="primary" disabled={topUpMutation.isPending}>
                {topUpMutation.isPending ? <Spinner className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
                Add
              </Button>
            </form>
          </Card>
        ) : null}

        <Card className="space-y-3 px-4 py-5 sm:px-6">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-ink-900">Allocate to organization or user</h4>
            <TierBadge tier={tier} />
          </div>
          <form onSubmit={submitAllocation} className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Select value={allocation.scope} onValueChange={(value) => setAllocation({ scope: value as 'ORGANIZATION' | 'USER', target: null, amount: allocation.amount })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ORGANIZATION">Organization</SelectItem>
                  <SelectItem value="USER">User</SelectItem>
                </SelectContent>
              </Select>
              <Input type="number" min={1} placeholder="AI credits to allocate" value={allocation.amount} onChange={(event) => setAllocation((current) => ({ ...current, amount: event.target.value }))} />
            </div>
            <AsyncAccountSelect scope={allocation.scope} tier={tier} value={allocation.target} onChange={(target) => setAllocation((current) => ({ ...current, target }))} />
            {allocation.target?.wallet ? <WalletStrip wallet={allocation.target.wallet} /> : null}
            <Button type="submit" variant="outline" disabled={allocateMutation.isPending}>
              {allocateMutation.isPending ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              Allocate credits
            </Button>
          </form>
        </Card>

        <Card className="space-y-3 px-4 py-5 sm:px-6">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-ink-900">Reclaim granted credits</h4>
            <TierBadge tier={tier} />
          </div>
          <p className="text-xs text-ink-500">Return unused assigned credits to the wallet they came from.</p>
          <form onSubmit={submitReclaim} className="grid gap-3">
            <Select value={reclaim.scope} onValueChange={(value) => setReclaim({ scope: value as 'ORGANIZATION' | 'USER', target: null, amount: '' })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ORGANIZATION">Organization</SelectItem>
                <SelectItem value="USER">User</SelectItem>
              </SelectContent>
            </Select>
            <AsyncAccountSelect scope={reclaim.scope} tier={tier} value={reclaim.target} onChange={(target) => setReclaim((current) => ({ ...current, target, amount: '' }))} />
            {reclaimWallet ? (
              <div className="grid gap-2 rounded-lg bg-surface-variant px-3 py-3 text-xs text-ink-600 sm:grid-cols-2">
                <span>Assigned: <strong className="text-ink-900">{formatCredits(reclaimWallet.allocatedTokens)}</strong></span>
                <span>Reclaimable: <strong className="text-ink-900">{formatCredits(reclaimable)}</strong></span>
              </div>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Input type="number" min={1} max={reclaimable || undefined} placeholder="AI credits to reclaim" value={reclaim.amount} onChange={(event) => setReclaim((current) => ({ ...current, amount: event.target.value }))} />
              <Button type="submit" variant="destructive" disabled={reclaimMutation.isPending || !reclaimable}>
                {reclaimMutation.isPending ? <Spinner className="h-4 w-4" /> : <Undo2 className="h-4 w-4" />}
                Reclaim
              </Button>
            </div>
            <Button type="button" variant="outline" disabled={!reclaimable || reclaimMutation.isPending} onClick={() => reclaimMutation.mutate(true)}>
              Reclaim all available
            </Button>
          </form>
        </Card>
      </div>

      <BulkAllocateDialog open={bulkOpen} onOpenChange={setBulkOpen} initialTier={tier} />
    </div>
  );
}

function WalletStrip({ wallet }: { wallet: NonNullable<AiAccountSearchResult['wallet']> }) {
  if (wallet.unlimited) {
    return <div className="rounded-lg bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700">Unlimited wallet</div>;
  }
  return (
    <div className="grid gap-2 rounded-lg bg-surface-variant px-3 py-3 text-xs text-ink-600 sm:grid-cols-3">
      <span>Assigned: <strong className="text-ink-900">{formatCredits(wallet.allocatedTokens)}</strong></span>
      <span>Used: <strong className="text-ink-900">{formatCredits(wallet.usedTokens)}</strong></span>
      <span>Available: <strong className="text-ink-900">{formatCredits(wallet.availableTokens)}</strong></span>
    </div>
  );
}
