import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Layers } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ActiveFilterChips, ExportButtons, PaginationFooter } from '@/features/admin/admin-list-ui';
import { extractApiError } from '@/lib/api';
import { aiAdminApi } from '@/services/ai-admin.api';
import type { AdminExportFormat } from '@/services/admin-api';
import type { AiOrganizationRow } from '@/types/ai';
import { BulkAllocateDialog, type BulkTarget } from '../components/BulkAllocateDialog';
import { DebouncedSearchInput, DetailDrawer, EmptyRow, HealthBadge, KeyValueGrid, SectionHeader, WalletCells } from '../components/ai-ui';
import { formatDateTime } from '../components/ai-format';
import { useAiListParams } from '../components/useAiListParams';

const KEYS = ['search', 'kind', 'status', 'tier', 'health', 'proPolicy'] as const;

const policyLabel = (row: AiOrganizationRow) =>
  !row.tierPolicy || row.tierPolicy.proEnabled === null ? 'Inherit' : row.tierPolicy.proEnabled ? 'Pro ON' : 'Pro OFF';

export function AiOrganizationsTab() {
  const { values, page, set, clear, chips } = useAiListParams('org', KEYS);
  const filtered = KEYS.some((key) => values[key]);
  const query = {
    page,
    perPage: 25,
    search: values.search || undefined,
    kind: values.kind || undefined,
    status: values.status || undefined,
    tier: values.tier || undefined,
    health: values.health || undefined,
    proPolicy: values.proPolicy || undefined,
    // Without filters the list is a lazy tree starting at top-level organizations.
    parentId: filtered ? undefined : 'root',
  };
  const listQuery = useQuery({ queryKey: ['ai-organizations', query], queryFn: () => aiAdminApi.organizations(query) });
  const [selected, setSelected] = useState<Map<string, AiOrganizationRow>>(() => new Map());
  const [detail, setDetail] = useState<AiOrganizationRow | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const toggle = (row: AiOrganizationRow) =>
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(row.id)) next.delete(row.id);
      else next.set(row.id, row);
      return next;
    });

  const onExport = async (format: AdminExportFormat) => {
    setExporting(true);
    try {
      await aiAdminApi.exportOrganizations({ ...query, page: undefined, perPage: undefined, parentId: undefined }, format);
    } catch (error) {
      toast.error(extractApiError(error));
    } finally {
      setExporting(false);
    }
  };

  const bulkTargets: BulkTarget[] = [...selected.values()].map((row) => ({
    scope: 'ORGANIZATION',
    organizationId: row.id,
    label: row.name,
    sublabel: row.kind,
  }));

  const rows = listQuery.data?.data ?? [];

  return (
    <Card className="space-y-4 px-4 py-5 sm:px-6">
      <SectionHeader
        title="Organizations"
        description={filtered ? 'Filtered results across the whole hierarchy.' : 'Top-level organizations; expand a row to load its children.'}
        actions={
          <>
            <Button type="button" variant="outline" size="sm" disabled={!selected.size} onClick={() => setBulkOpen(true)}>
              <Layers className="h-4 w-4" />
              Bulk allocate ({selected.size})
            </Button>
            <ExportButtons onExport={onExport} loading={exporting} />
          </>
        }
      />
      <div className="grid gap-3 rounded-lg border border-line bg-surface-variant p-3 md:grid-cols-3 xl:grid-cols-6">
        <DebouncedSearchInput className="xl:col-span-2" value={values.search} onChange={(value) => set('search', value)} placeholder="Search name or slug" />
        <FilterSelect value={values.kind} onChange={(value) => set('kind', value)} placeholder="All kinds" options={[['PARTNER', 'Partner'], ['CUSTOMER', 'Customer'], ['INTERNAL', 'Internal']]} />
        <FilterSelect value={values.status} onChange={(value) => set('status', value)} placeholder="All statuses" options={[['ACTIVE', 'Active'], ['INACTIVE', 'Inactive']]} />
        <FilterSelect value={values.tier} onChange={(value) => set('tier', value)} placeholder="Health of any tier" options={[['PRO', 'Pro wallet'], ['FREE', 'Free wallet']]} />
        <FilterSelect
          value={values.health}
          onChange={(value) => set('health', value)}
          placeholder="Any health"
          options={[['HEALTHY', 'Healthy'], ['LOW_20', '≤ 20%'], ['LOW_10', '≤ 10%'], ['LOW_5', '≤ 5%'], ['EXHAUSTED', 'Exhausted'], ['NO_POOL', 'No pool'], ['UNLIMITED', 'Unlimited']]}
        />
        <FilterSelect value={values.proPolicy} onChange={(value) => set('proPolicy', value)} placeholder="Any Pro policy" options={[['ON', 'Pro ON'], ['OFF', 'Pro OFF'], ['INHERIT', 'Inherit']]} />
      </div>
      <ActiveFilterChips
        filters={chips({ search: 'Search', kind: 'Kind', status: 'Status', tier: 'Tier', health: 'Health', proPolicy: 'Pro' })}
        onRemove={(key) => set(key as (typeof KEYS)[number], null)}
        onClearAll={clear}
      />
      {listQuery.isError ? <p className="text-sm text-red-700">{extractApiError(listQuery.error)}</p> : null}
      <div className="overflow-hidden rounded-lg border border-line">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="bg-surface-variant text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="w-10 px-3 py-2" />
                <th className="px-3 py-2">Organization</th>
                <th className="px-3 py-2">Pro wallet</th>
                <th className="px-3 py-2">Free wallet</th>
                <th className="px-3 py-2">Pro health</th>
                <th className="px-3 py-2">Free health</th>
                <th className="px-3 py-2">Pro policy</th>
              </tr>
            </thead>
            <tbody>
              {listQuery.isLoading ? (
                <EmptyRow colSpan={7} message="Loading…" />
              ) : rows.length ? (
                rows.map((row) => (
                  <OrganizationRow key={row.id} row={row} depth={0} tree={!filtered} selected={selected} onToggle={toggle} onOpen={setDetail} />
                ))
              ) : (
                <EmptyRow colSpan={7} message="No organizations match the selected filters." />
              )}
            </tbody>
          </table>
        </div>
        <PaginationFooter meta={listQuery.data?.meta} onPageChange={(next) => set('page', next)} />
      </div>

      <DetailDrawer open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)} title={detail?.name ?? ''} description="AI wallets and Pro access for this organization">
        {detail ? (
          <>
            <KeyValueGrid
              rows={[
                ['Kind', detail.kind],
                ['Status', detail.status],
                ['Branding', detail.brandingMode],
                ['Parent', detail.parentOrganization?.name ?? '—'],
                ['Children', String(detail.childCount)],
                ['Pro policy', policyLabel(detail)],
                ['Created', formatDateTime(detail.createdAt)],
              ]}
            />
            <WalletDetail title="Pro wallet" wallet={detail.wallets.PRO} />
            <WalletDetail title="Free wallet" wallet={detail.wallets.FREE} />
          </>
        ) : null}
      </DetailDrawer>

      <BulkAllocateDialog open={bulkOpen} onOpenChange={setBulkOpen} initialTargets={bulkTargets} />
    </Card>
  );
}

function OrganizationRow({
  row,
  depth,
  tree,
  selected,
  onToggle,
  onOpen,
}: {
  row: AiOrganizationRow;
  depth: number;
  tree: boolean;
  selected: Map<string, AiOrganizationRow>;
  onToggle: (row: AiOrganizationRow) => void;
  onOpen: (row: AiOrganizationRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const canExpand = tree && row.childCount > 0;
  return (
    <>
      <tr className="border-t border-line hover:bg-surface-variant/50">
        <td className="px-3 py-2">
          <input type="checkbox" aria-label={`Select ${row.name}`} checked={selected.has(row.id)} onChange={() => onToggle(row)} />
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-2" style={{ paddingLeft: depth * 20 }}>
            {canExpand ? (
              <button type="button" aria-expanded={open} className="rounded p-0.5 text-ink-500 hover:bg-surface-variant" onClick={() => setOpen((value) => !value)}>
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            ) : (
              <span className="inline-block w-5" />
            )}
            <button type="button" className="min-w-0 text-left" onClick={() => onOpen(row)}>
              <span className="block truncate font-semibold text-ink-900 hover:underline">{row.name}</span>
              <span className="block text-xs text-ink-500">
                {row.kind}
                {row.childCount ? ` · ${row.childCount} child${row.childCount === 1 ? '' : 'ren'}` : ''}
                {!tree && row.parentOrganization ? ` · under ${row.parentOrganization.name}` : ''}
              </span>
            </button>
          </div>
        </td>
        <td className="px-3 py-2"><WalletCells wallet={row.wallets.PRO} /></td>
        <td className="px-3 py-2"><WalletCells wallet={row.wallets.FREE} /></td>
        <td className="px-3 py-2"><HealthBadge wallet={row.wallets.PRO} fallback="No pool yet" /></td>
        <td className="px-3 py-2"><HealthBadge wallet={row.wallets.FREE} fallback="No pool yet" /></td>
        <td className="px-3 py-2 text-xs font-semibold text-ink-700">{policyLabel(row)}</td>
      </tr>
      {open ? <ChildRows parentId={row.id} depth={depth + 1} selected={selected} onToggle={onToggle} onOpen={onOpen} /> : null}
    </>
  );
}

function ChildRows({
  parentId,
  depth,
  selected,
  onToggle,
  onOpen,
}: {
  parentId: string;
  depth: number;
  selected: Map<string, AiOrganizationRow>;
  onToggle: (row: AiOrganizationRow) => void;
  onOpen: (row: AiOrganizationRow) => void;
}) {
  const [page, setPage] = useState(1);
  const childQuery = useQuery({
    queryKey: ['ai-organizations', 'children', parentId, page],
    queryFn: () => aiAdminApi.organizations({ parentId, page, perPage: 50 }),
  });
  if (childQuery.isLoading) return <EmptyRow colSpan={7} message="Loading child organizations…" />;
  const rows = childQuery.data?.data ?? [];
  const meta = childQuery.data?.meta;
  return (
    <>
      {rows.map((row) => (
        <OrganizationRow key={row.id} row={row} depth={depth} tree selected={selected} onToggle={onToggle} onOpen={onOpen} />
      ))}
      {meta && (meta.totalPages ?? 1) > 1 ? (
        <tr className="border-t border-line">
          <td colSpan={7} className="px-3 py-2 text-xs text-ink-500" style={{ paddingLeft: depth * 20 + 48 }}>
            Page {meta.page} of {meta.totalPages}
            <Button type="button" variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={page >= (meta.totalPages ?? 1)} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: Array<[string, string]>;
}) {
  return (
    <Select value={value || 'ALL'} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ALL">{placeholder}</SelectItem>
        {options.map(([optionValue, label]) => (
          <SelectItem key={optionValue} value={optionValue}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function WalletDetail({ title, wallet }: { title: string; wallet: AiOrganizationRow['wallets']['PRO'] }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{title}</p>
        <HealthBadge wallet={wallet} fallback="No pool yet" />
      </div>
      {wallet ? (
        <KeyValueGrid
          rows={[
            ['Assigned', wallet.unlimited ? 'Unlimited' : wallet.allocatedTokens.toLocaleString('en-IN')],
            ['Used', wallet.usedTokens.toLocaleString('en-IN')],
            ['Reserved', wallet.reservedTokens.toLocaleString('en-IN')],
            ['Given to children', wallet.childAllocatedTokens.toLocaleString('en-IN')],
            ['Available', wallet.unlimited ? 'Unlimited' : wallet.availableTokens.toLocaleString('en-IN')],
            ['Account id', <span className="font-mono text-xs">{wallet.accountId}</span>],
          ]}
        />
      ) : (
        <p className="rounded-lg border border-dashed border-line px-3 py-3 text-sm text-ink-500">No wallet yet. It is created on the first allocation or usage.</p>
      )}
    </div>
  );
}
