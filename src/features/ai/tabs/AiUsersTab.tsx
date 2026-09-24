import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layers } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ActiveFilterChips, ExportButtons, PaginationFooter } from '@/features/admin/admin-list-ui';
import { extractApiError } from '@/lib/api';
import { aiAdminApi } from '@/services/ai-admin.api';
import type { AdminExportFormat } from '@/services/admin-api';
import type { AiAccountSearchResult, AiUserRow } from '@/types/ai';
import { BulkAllocateDialog, type BulkTarget } from '../components/BulkAllocateDialog';
import { AsyncAccountSelect, DebouncedSearchInput, DetailDrawer, EmptyRow, HealthBadge, KeyValueGrid, SectionHeader, TierBadge, WalletCells } from '../components/ai-ui';
import { formatDateTime } from '../components/ai-format';
import { useAiListParams } from '../components/useAiListParams';
import { FilterSelect, WalletDetail } from './AiOrganizationsTab';

const KEYS = ['search', 'role', 'organizationId', 'organizationName', 'status', 'tier', 'health', 'allocation'] as const;

const ROLE_OPTIONS: Array<[string, string]> = [
  ['TEACHER', 'Teacher'],
  ['CUSTOMER_ADMIN', 'Customer admin'],
  ['ADMIN', 'Admin'],
  ['PARTNER_ADMIN', 'Partner admin'],
  ['SUPER_ADMIN', 'Super admin'],
];

const policyLabel = (row: AiUserRow) =>
  !row.tierPolicy || row.tierPolicy.proEnabled === null ? 'Inherit' : row.tierPolicy.proEnabled ? 'Pro ON' : 'Pro OFF';

export function AiUsersTab() {
  const { values, page, set, setMany, clear, chips } = useAiListParams('usr', KEYS);
  const query = {
    page,
    perPage: 25,
    search: values.search || undefined,
    role: values.role || undefined,
    organizationId: values.organizationId || undefined,
    status: values.status || undefined,
    tier: values.tier || undefined,
    health: values.health || undefined,
    allocation: values.allocation || undefined,
  };
  const listQuery = useQuery({ queryKey: ['ai-users', query], queryFn: () => aiAdminApi.users(query) });
  const [selected, setSelected] = useState<Map<string, AiUserRow>>(() => new Map());
  const [detail, setDetail] = useState<AiUserRow | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const organizationFilter: AiAccountSearchResult | null = values.organizationId
    ? { type: 'ORGANIZATION', id: values.organizationId, label: values.organizationName || 'Selected organization', sublabel: '', wallet: null }
    : null;

  const toggle = (row: AiUserRow) =>
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(row.id)) next.delete(row.id);
      else next.set(row.id, row);
      return next;
    });

  const onExport = async (format: AdminExportFormat) => {
    setExporting(true);
    try {
      await aiAdminApi.exportUsers({ ...query, page: undefined, perPage: undefined }, format);
    } catch (error) {
      toast.error(extractApiError(error));
    } finally {
      setExporting(false);
    }
  };

  const rows = listQuery.data?.data ?? [];
  const bulkTargets: BulkTarget[] = [...selected.values()].map((row) => ({
    scope: 'USER',
    userId: row.id,
    label: row.name ? `${row.name} (${row.email})` : row.email,
    sublabel: row.role,
  }));

  return (
    <Card className="space-y-4 px-4 py-5 sm:px-6">
      <SectionHeader
        title="Users"
        description="Teachers and admins with their personal Free / Pro wallets. Users without a personal wallet use their organization's pool."
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
      <div className="grid gap-3 rounded-lg border border-line bg-surface-variant p-3 md:grid-cols-3 xl:grid-cols-4">
        <DebouncedSearchInput value={values.search} onChange={(value) => set('search', value)} placeholder="Search name or email" />
        <AsyncAccountSelect
          scope="ORGANIZATION"
          tier="PRO"
          value={organizationFilter}
          placeholder="Filter by organization"
          onChange={(org) => setMany({ organizationName: org?.label ?? null, organizationId: org?.id ?? null })}
        />
        <FilterSelect value={values.role} onChange={(value) => set('role', value)} placeholder="All roles" options={ROLE_OPTIONS} />
        <FilterSelect value={values.status} onChange={(value) => set('status', value)} placeholder="All statuses" options={[['ACTIVE', 'Active'], ['INACTIVE', 'Inactive'], ['PENDING', 'Pending'], ['SUSPENDED', 'Suspended']]} />
        <FilterSelect value={values.tier} onChange={(value) => set('tier', value)} placeholder="Health of any tier" options={[['PRO', 'Pro wallet'], ['FREE', 'Free wallet']]} />
        <FilterSelect
          value={values.health}
          onChange={(value) => set('health', value)}
          placeholder="Any health"
          options={[['HEALTHY', 'Healthy'], ['LOW_20', '≤ 20%'], ['LOW_10', '≤ 10%'], ['LOW_5', '≤ 5%'], ['EXHAUSTED', 'Exhausted'], ['NO_POOL', 'No personal wallet'], ['UNLIMITED', 'Unlimited']]}
        />
        <FilterSelect value={values.allocation} onChange={(value) => set('allocation', value)} placeholder="Personal or org pool" options={[['PERSONAL', 'Personal wallet'], ['ORG_POOL', 'Uses org pool']]} />
      </div>
      <ActiveFilterChips
        filters={chips({ search: 'Search', role: 'Role', organizationName: 'Organization', status: 'Status', tier: 'Tier', health: 'Health', allocation: 'Allocation' })}
        onRemove={(key) => {
          if (key === 'organizationName') {
            setMany({ organizationName: null, organizationId: null });
            return;
          }
          set(key as (typeof KEYS)[number], null);
        }}
        onClearAll={clear}
      />
      {listQuery.isError ? <p className="text-sm text-red-700">{extractApiError(listQuery.error)}</p> : null}
      <div className="overflow-hidden rounded-lg border border-line">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-surface-variant text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="w-10 px-3 py-2" />
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Pro wallet</th>
                <th className="px-3 py-2">Free wallet</th>
                <th className="px-3 py-2">Health</th>
                <th className="px-3 py-2">Pro access</th>
                <th className="px-3 py-2">App choice</th>
              </tr>
            </thead>
            <tbody>
              {listQuery.isLoading ? (
                <EmptyRow colSpan={8} message="Loading…" />
              ) : rows.length ? (
                rows.map((row) => (
                  <tr key={row.id} className="border-t border-line hover:bg-surface-variant/50">
                    <td className="px-3 py-2">
                      <input type="checkbox" aria-label={`Select ${row.email}`} checked={selected.has(row.id)} onChange={() => toggle(row)} />
                    </td>
                    <td className="px-3 py-2">
                      <button type="button" className="text-left" onClick={() => setDetail(row)}>
                        <span className="block font-semibold text-ink-900 hover:underline">{row.name ?? row.email}</span>
                        <span className="block text-xs text-ink-500">
                          {row.email}
                          {row.primaryOrganization ? ` · ${row.primaryOrganization.name}` : ''}
                        </span>
                      </button>
                    </td>
                    <td className="px-3 py-2 text-xs">{row.role}</td>
                    <td className="px-3 py-2">{row.usesOrgPool.PRO ? <span className="text-xs text-ink-500">Uses org pool</span> : <WalletCells wallet={row.wallets.PRO} />}</td>
                    <td className="px-3 py-2">{row.usesOrgPool.FREE ? <span className="text-xs text-ink-500">Uses org pool</span> : <WalletCells wallet={row.wallets.FREE} />}</td>
                    <td className="space-y-1 px-3 py-2">
                      <div><HealthBadge wallet={row.wallets.PRO} fallback="Pro: org pool" /></div>
                      <div><HealthBadge wallet={row.wallets.FREE} fallback="Free: org pool" /></div>
                    </td>
                    <td className="px-3 py-2 text-xs font-semibold text-ink-700">{policyLabel(row)}</td>
                    <td className="px-3 py-2">{row.preferredTier ? <TierBadge tier={row.preferredTier} /> : <span className="text-xs text-ink-500">Auto</span>}</td>
                  </tr>
                ))
              ) : (
                <EmptyRow colSpan={8} message="No users match the selected filters." />
              )}
            </tbody>
          </table>
        </div>
        <PaginationFooter meta={listQuery.data?.meta} onPageChange={(next) => set('page', next)} />
      </div>

      <DetailDrawer open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)} title={detail?.name ?? detail?.email ?? ''} description={detail?.email}>
        {detail ? (
          <>
            <KeyValueGrid
              rows={[
                ['Role', detail.role],
                ['Status', detail.status],
                ['Organization', detail.primaryOrganization?.name ?? '—'],
                ['Pro access', policyLabel(detail)],
                ['App tier choice', detail.preferredTier ?? 'Auto'],
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
