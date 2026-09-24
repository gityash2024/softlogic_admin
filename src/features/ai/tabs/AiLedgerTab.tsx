import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ActiveFilterChips, ExportButtons, PaginationFooter } from '@/features/admin/admin-list-ui';
import { extractApiError } from '@/lib/api';
import { aiAdminApi } from '@/services/ai-admin.api';
import type { AdminExportFormat } from '@/services/admin-api';
import type { AiLedgerRow } from '@/types/ai';
import { DebouncedSearchInput, DetailDrawer, EmptyRow, JsonBlock, KeyValueGrid, LoadingBlock, SectionHeader, TierBadge } from '../components/ai-ui';
import { formatCredits, formatDateTime, formatUsdMicros } from '../components/ai-format';
import { useAiListParams } from '../components/useAiListParams';
import { FilterSelect } from './AiOrganizationsTab';

const KEYS = ['search', 'types', 'direction', 'tier', 'model', 'provider', 'feature', 'from', 'to', 'minCredits', 'maxCredits', 'accountId'] as const;

const LEDGER_TYPES: Array<[string, string]> = [
  ['USAGE_COMMIT', 'Usage'],
  ['RESERVATION', 'Reservation'],
  ['RESERVATION_REFUND', 'Reservation refund'],
  ['ALLOCATION', 'Allocation'],
  ['MASTER_TOP_UP', 'Master top-up'],
  ['PURCHASE', 'Purchase'],
  ['EXPIRY', 'Expiry'],
  ['REFUND_REVERSAL', 'Refund reversal'],
  ['TIER_CONVERSION', 'Tier conversion'],
  ['ADJUSTMENT', 'Adjustment'],
  ['MANUAL_EXTENSION', 'Manual extension'],
  ['INCLUDED', 'Included'],
  ['USAGE', 'Usage (legacy)'],
];

const accountLabel = (entry: AiLedgerRow) =>
  entry.account?.organization?.name ??
  entry.account?.user?.name ??
  entry.account?.user?.email ??
  (entry.account?.scope === 'MASTER' ? `Master ${entry.tier === 'FREE' ? 'Free' : 'Pro'} pool` : entry.accountId);

export function AiLedgerTab() {
  const { values, page, set, clear, chips } = useAiListParams('led', KEYS);
  const query = {
    page,
    perPage: 50,
    search: values.search || undefined,
    types: values.types || undefined,
    direction: values.direction || undefined,
    tier: values.tier || undefined,
    model: values.model || undefined,
    provider: values.provider || undefined,
    feature: values.feature || undefined,
    from: values.from || undefined,
    to: values.to || undefined,
    minCredits: values.minCredits || undefined,
    maxCredits: values.maxCredits || undefined,
    accountId: values.accountId || undefined,
  };
  const listQuery = useQuery({ queryKey: ['ai-ledger', query], queryFn: () => aiAdminApi.ledger(query), refetchInterval: 30_000 });
  const [detailId, setDetailId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const onExport = async (format: AdminExportFormat) => {
    setExporting(true);
    try {
      await aiAdminApi.exportLedger({ ...query, page: undefined, perPage: undefined }, format);
    } catch (error) {
      toast.error(extractApiError(error));
    } finally {
      setExporting(false);
    }
  };

  const rows = listQuery.data?.data ?? [];

  return (
    <Card className="space-y-4 px-4 py-5 sm:px-6">
      <SectionHeader title="Live Ledger" description="Every credit movement, paginated on the server with no row cap. Click an entry for full details." actions={<ExportButtons onExport={onExport} loading={exporting} />} />
      <div className="grid gap-3 rounded-lg border border-line bg-surface-variant p-3 md:grid-cols-2 lg:grid-cols-4">
        <DebouncedSearchInput value={values.search} onChange={(value) => set('search', value)} placeholder="Search actor, user, org, reason" />
        <FilterSelect value={values.types} onChange={(value) => set('types', value)} placeholder="All types" options={LEDGER_TYPES} />
        <FilterSelect value={values.direction} onChange={(value) => set('direction', value)} placeholder="Debit and credit" options={[['DEBIT', 'Debits only'], ['CREDIT', 'Credits only']]} />
        <FilterSelect value={values.tier} onChange={(value) => set('tier', value)} placeholder="Free and Pro" options={[['PRO', 'Pro'], ['FREE', 'Free']]} />
        <DebouncedSearchInput value={values.model} onChange={(value) => set('model', value)} placeholder="Model" />
        <DebouncedSearchInput value={values.feature} onChange={(value) => set('feature', value)} placeholder="Feature / tool" />
        <DebouncedSearchInput value={values.provider} onChange={(value) => set('provider', value)} placeholder="Provider" />
        <div className="grid grid-cols-2 gap-2">
          <Input key={`min-${values.minCredits}`} type="number" min={0} placeholder="Min credits" defaultValue={values.minCredits} onBlur={(event) => set('minCredits', event.target.value)} />
          <Input key={`max-${values.maxCredits}`} type="number" min={0} placeholder="Max credits" defaultValue={values.maxCredits} onBlur={(event) => set('maxCredits', event.target.value)} />
        </div>
        <Input type="date" value={values.from} onChange={(event) => set('from', event.target.value)} aria-label="From date" />
        <Input type="date" value={values.to} onChange={(event) => set('to', event.target.value)} aria-label="To date" />
      </div>
      <ActiveFilterChips
        filters={chips({
          search: 'Search',
          types: 'Type',
          direction: 'Direction',
          tier: 'Tier',
          model: 'Model',
          provider: 'Provider',
          feature: 'Feature',
          from: 'From',
          to: 'To',
          minCredits: 'Min',
          maxCredits: 'Max',
          accountId: 'Account',
        })}
        onRemove={(key) => set(key as (typeof KEYS)[number], null)}
        onClearAll={clear}
      />
      {listQuery.isError ? <p className="text-sm text-red-700">{extractApiError(listQuery.error)}</p> : null}
      <div className="overflow-hidden rounded-lg border border-line">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-surface-variant text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Wallet</th>
                <th className="px-3 py-2">Actor</th>
                <th className="px-3 py-2">Model / feature</th>
                <th className="px-3 py-2 text-right">Credits</th>
                <th className="px-3 py-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {listQuery.isLoading ? (
                <EmptyRow colSpan={7} message="Loading…" />
              ) : rows.length ? (
                rows.map((entry) => (
                  <tr key={entry.id} className="cursor-pointer border-t border-line hover:bg-surface-variant/50" onClick={() => setDetailId(entry.id)}>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-ink-500">{formatDateTime(entry.createdAt)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-ink-900">{entry.type}</span>
                        <TierBadge tier={entry.tier} />
                      </div>
                      {entry.fallbackFromTier ? <span className="text-[11px] text-amber-700">Fallback from {entry.fallbackFromTier}</span> : null}
                    </td>
                    <td className="px-3 py-2">
                      <p className="max-w-[220px] truncate font-semibold text-ink-900">{accountLabel(entry)}</p>
                      <p className="max-w-[220px] truncate text-xs text-ink-500">{entry.reason ?? entry.account?.scope}</p>
                    </td>
                    <td className="px-3 py-2 text-xs text-ink-600">{entry.actorUser?.name ?? entry.actorUser?.email ?? 'System'}</td>
                    <td className="px-3 py-2 text-xs text-ink-600">
                      {entry.modelId ?? '—'}
                      {entry.feature ? <span className="block text-ink-400">{entry.feature}{entry.provider ? ` · ${entry.provider}` : ''}</span> : null}
                    </td>
                    <td className={`px-3 py-2 text-right font-bold ${entry.amountTokens >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {entry.amountTokens >= 0 ? '+' : ''}
                      {formatCredits(entry.amountTokens)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-xs text-ink-500">
                      {formatCredits(entry.oldTokenBalance)} {'->'} {formatCredits(entry.newTokenBalance)}
                    </td>
                  </tr>
                ))
              ) : (
                <EmptyRow colSpan={7} message="No ledger entries match the selected filters." />
              )}
            </tbody>
          </table>
        </div>
        <PaginationFooter meta={listQuery.data?.meta} onPageChange={(next) => set('page', next)} />
      </div>
      <LedgerDetailDrawer id={detailId} onClose={() => setDetailId(null)} onFilterAccount={(accountId) => { set('accountId', accountId); setDetailId(null); }} />
    </Card>
  );
}

function LedgerDetailDrawer({ id, onClose, onFilterAccount }: { id: string | null; onClose: () => void; onFilterAccount: (accountId: string) => void }) {
  const detailQuery = useQuery({ queryKey: ['ai-ledger-entry', id], queryFn: () => aiAdminApi.ledgerEntry(id as string), enabled: Boolean(id) });
  const entry = detailQuery.data?.entry;
  return (
    <DetailDrawer open={Boolean(id)} onOpenChange={(open) => !open && onClose()} title="Ledger entry" description={entry ? `${entry.type} · ${formatDateTime(entry.createdAt)}` : undefined}>
      {detailQuery.isLoading ? (
        <LoadingBlock />
      ) : detailQuery.isError ? (
        <p className="text-sm text-red-700">{extractApiError(detailQuery.error)}</p>
      ) : entry ? (
        <>
          <KeyValueGrid
            rows={[
              ['Tier', <TierBadge tier={entry.tier} />],
              ['Wallet', accountLabel(entry)],
              ['Scope', entry.account?.scope ?? '—'],
              ['Actor', entry.actorUser ? `${entry.actorUser.name ?? ''} ${entry.actorUser.email}` : 'System'],
              ['Credits', `${entry.amountTokens >= 0 ? '+' : ''}${formatCredits(entry.amountTokens)}`],
              ['Balance', `${formatCredits(entry.oldTokenBalance)} -> ${formatCredits(entry.newTokenBalance)}`],
              ['Reason', entry.reason ?? '—'],
              ['Model', entry.modelId ?? '—'],
              ['Feature', entry.feature ?? '—'],
              ['Provider', entry.provider ?? '—'],
              ['Fallback from', entry.fallbackFromTier ?? '—'],
              ['Tokens', `in ${formatCredits(entry.inputTokens)} · out ${formatCredits(entry.outputTokens)} · thinking ${formatCredits(entry.thinkingTokens)} · total ${formatCredits(entry.totalTokens)}`],
              ['Images / searches', `${entry.imageCount} / ${entry.searchGroundingCount}`],
              ['Estimated cost', formatUsdMicros(entry.estimatedCostMicros)],
              ['Request id', entry.requestId ?? '—'],
              ['Order', entry.orderId ?? '—'],
              ['Lot', entry.lotId ?? '—'],
            ]}
          />
          <button type="button" className="text-sm font-semibold text-brand-primary hover:underline" onClick={() => onFilterAccount(entry.accountId)}>
            Show all entries for this wallet
          </button>
          {detailQuery.data?.related?.length ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Same request</p>
              {detailQuery.data.related.map((row) => (
                <div key={row.id} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-xs">
                  <span>
                    <strong>{row.type}</strong> · {accountLabel(row)} · {formatDateTime(row.createdAt)}
                  </span>
                  <span className={row.amountTokens >= 0 ? 'font-bold text-emerald-700' : 'font-bold text-red-700'}>{formatCredits(row.amountTokens)}</span>
                </div>
              ))}
            </div>
          ) : null}
          {entry.pricingSnapshot ? (
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Pricing snapshot</p>
              <JsonBlock value={entry.pricingSnapshot} />
            </div>
          ) : null}
          {entry.metadata ? (
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Metadata</p>
              <JsonBlock value={entry.metadata} />
            </div>
          ) : null}
        </>
      ) : null}
    </DetailDrawer>
  );
}
