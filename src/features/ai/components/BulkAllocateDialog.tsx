import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { extractApiError } from '@/lib/api';
import { aiAdminApi } from '@/services/ai-admin.api';
import type { AiAccountSearchResult, AiBulkAllocationResult, AiTier } from '@/types/ai';
import { AsyncAccountSelect, TierToggle } from './ai-ui';
import { formatCredits } from './ai-format';

export type BulkTarget = {
  scope: 'ORGANIZATION' | 'USER';
  organizationId?: string | null;
  userId?: string | null;
  label: string;
  sublabel?: string;
};

type Row = BulkTarget & { amount: string };

export function BulkAllocateDialog({
  open,
  onOpenChange,
  initialTargets = [],
  initialTier = 'PRO',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTargets?: BulkTarget[];
  initialTier?: AiTier;
}) {
  const queryClient = useQueryClient();
  const [tier, setTier] = useState<AiTier>(initialTier);
  const [mode, setMode] = useState<'ADD' | 'SET'>('ADD');
  const [defaultAmount, setDefaultAmount] = useState('');
  const [reason, setReason] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [addScope, setAddScope] = useState<'ORGANIZATION' | 'USER'>('ORGANIZATION');
  const [result, setResult] = useState<AiBulkAllocationResult | null>(null);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      setTier(initialTier);
      setRows(initialTargets.map((target) => ({ ...target, amount: '' })));
      setResult(null);
    }, 0);
    return () => window.clearTimeout(timer);
    // Reset only when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const addTarget = (target: AiAccountSearchResult | null) => {
    if (!target) return;
    const next: Row = {
      scope: target.type,
      organizationId: target.type === 'ORGANIZATION' ? target.id : null,
      userId: target.type === 'USER' ? target.id : null,
      label: target.label,
      sublabel: target.sublabel,
      amount: '',
    };
    setRows((current) =>
      current.some((row) => row.scope === next.scope && (row.organizationId ?? row.userId) === (next.organizationId ?? next.userId))
        ? current
        : [...current, next],
    );
  };

  const mutation = useMutation({
    mutationFn: () => {
      const items = rows.map((row) => ({
        scope: row.scope,
        organizationId: row.scope === 'ORGANIZATION' ? row.organizationId : null,
        userId: row.scope === 'USER' ? row.userId : null,
        amountTokens: Math.max(0, Math.round(Number(row.amount || defaultAmount || 0))),
      }));
      if (!items.length) throw new Error('Add at least one organization or user');
      if (mode === 'ADD' && items.some((item) => item.amountTokens < 1)) throw new Error('Enter credits for every row');
      return aiAdminApi.bulkAllocate({ tier, mode, reason: reason.trim() || undefined, items });
    },
    onSuccess: (data) => {
      setResult(data);
      toast[data.failed ? 'warning' : 'success'](`${data.succeeded} succeeded, ${data.failed} failed`);
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0] ?? '').startsWith('ai-') });
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Bulk allocate credits</DialogTitle>
          <DialogDescription>
            Up to 200 organizations or users at once. Each row is processed on its own; failures do not stop the rest.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-3">
          <TierToggle value={tier} onChange={(value) => setTier(value as AiTier)} />
          <Select value={mode} onValueChange={(value) => setMode(value as 'ADD' | 'SET')}>
            <SelectTrigger className="h-9 w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ADD">Add credits to each</SelectItem>
              <SelectItem value="SET">Set each assignment to</SelectItem>
            </SelectContent>
          </Select>
          <Input className="h-9 w-[180px]" type="number" min={0} placeholder="Default credits" value={defaultAmount} onChange={(event) => setDefaultAmount(event.target.value)} />
        </div>

        <div className="grid gap-2 sm:grid-cols-[150px_1fr]">
          <Select value={addScope} onValueChange={(value) => setAddScope(value as 'ORGANIZATION' | 'USER')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ORGANIZATION">Organization</SelectItem>
              <SelectItem value="USER">User</SelectItem>
            </SelectContent>
          </Select>
          <AsyncAccountSelect scope={addScope} tier={tier} value={null} onChange={addTarget} placeholder="Search to add a row" />
        </div>

        <div className="max-h-[40vh] overflow-y-auto rounded-lg border border-line scrollbar-thin">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-surface-variant text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-3 py-2">Target</th>
                <th className="px-3 py-2">Credits</th>
                <th className="px-3 py-2">Result</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((row, index) => {
                  const outcome = result?.results[index];
                  return (
                    <tr key={`${row.scope}:${row.organizationId ?? row.userId}`} className="border-t border-line">
                      <td className="px-3 py-2">
                        <p className="font-semibold text-ink-900">{row.label}</p>
                        <p className="text-xs text-ink-500">{row.sublabel ?? row.scope}</p>
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          className="h-9 w-[150px]"
                          type="number"
                          min={0}
                          placeholder={defaultAmount ? formatCredits(Number(defaultAmount)) : 'Credits'}
                          value={row.amount}
                          onChange={(event) =>
                            setRows((current) => current.map((item, i) => (i === index ? { ...item, amount: event.target.value } : item)))
                          }
                        />
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {outcome ? (
                          outcome.ok ? (
                            <span className="font-semibold text-emerald-700">Done</span>
                          ) : (
                            <span className="text-red-700">{outcome.message ?? 'Failed'}</span>
                          )
                        ) : (
                          <span className="text-ink-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button type="button" variant="ghost" size="icon" aria-label="Remove row" onClick={() => setRows((current) => current.filter((_, i) => i !== index))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-sm text-ink-500">
                    Search above to add organizations or users, or select rows in the Organizations / Users tabs.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Input placeholder="Reason (shown in the ledger)" value={reason} onChange={(event) => setReason(event.target.value)} />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" variant="primary" disabled={mutation.isPending || !rows.length} onClick={() => mutation.mutate()}>
            {mutation.isPending ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            Apply to {rows.length} {rows.length === 1 ? 'row' : 'rows'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
