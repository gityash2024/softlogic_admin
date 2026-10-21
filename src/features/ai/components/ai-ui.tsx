import { Children, cloneElement, isValidElement, ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { aiAdminApi } from '@/services/ai-admin.api';
import type { AiAccountSearchResult, AiHealth, AiTier, AiWalletSummary } from '@/types/ai';
import { formatCredits, useDebouncedValue } from './ai-format';

export function AiField({ label, children, className = '' }: { label: ReactNode; children: ReactNode; className?: string }) {
  const id = useId();
  const control = isValidElement<{ id?: string }>(children) ? cloneElement(children, { id: children.props.id ?? id }) : children;
  return <label className={`ai-field ${className}`} htmlFor={isValidElement<{ id?: string }>(control) ? control.props.id : undefined}><span>{label}</span>{control}</label>;
}

export function AiMetricCard({ label, value, detail, tone = 'blue' }: {
  label: string; value: ReactNode; detail?: ReactNode; tone?: 'blue' | 'orange' | 'green' | 'purple' | 'gray';
}) {
  const exact = typeof value === 'string' || typeof value === 'number' ? String(value) : null;
  const numeric = exact && /^[\d,.]+$/.test(exact) ? Number(exact.replaceAll(',', '')) : null;
  const compact = numeric !== null && Number.isFinite(numeric) && numeric >= 1_000_000
    ? new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(numeric) : null;
  const colors = { blue: '#1149b5', purple: '#6d40c5', orange: '#b45309', green: '#047857', gray: '#172b4d' };
  return <div className="ai-metric-card">
    <p className="ai-metric-label">{label}</p>
    <p className="ai-metric-value" style={{ color: colors[tone] }} title={exact ?? undefined}>{compact ?? value}</p>
    {compact && <span className="ai-exact-number">{exact}</span>}
    {detail && <div className="ai-metric-detail">{detail}</div>}
  </div>;
}

export function AiFilters({ labels, children }: { labels: string[]; children: ReactNode }) {
  const controls = Children.toArray(children);
  const field = (control: ReactNode, index: number) => isValidElement<{ children?: ReactNode }>(control) && control.type === 'div'
    ? <div className="ai-field" role="group" aria-label={labels[index]} key={index}><span>{labels[index]}</span>{control}</div>
    : <AiField label={labels[index]} key={index}>{control}</AiField>;
  return <div className="ai-filter-bar">
    <div className="ai-filter-primary">{controls.slice(0, 2).map(field)}</div>
    {controls.length > 2 && <details className="ai-filter-more"><summary>More filters <span className="text-ink-400">{controls.length - 2}</span></summary>
      <div className="ai-filter-advanced">{controls.slice(2).map((control, i) => field(control, i + 2))}</div>
    </details>}
  </div>;
}

export function TierBadge({ tier, className }: { tier: AiTier | null | undefined; className?: string }) {
  if (!tier) return null;
  return (
    <Badge variant={tier === 'PRO' ? 'purple' : 'info'} className={cn('font-semibold', className)}>
      {tier === 'PRO' ? 'Pro' : 'Free'}
    </Badge>
  );
}

export function TierToggle({
  value,
  onChange,
  includeAll = false,
  className,
}: {
  value: AiTier | 'ALL';
  onChange: (tier: AiTier | 'ALL') => void;
  includeAll?: boolean;
  className?: string;
}) {
  const options: Array<AiTier | 'ALL'> = includeAll ? ['ALL', 'PRO', 'FREE'] : ['PRO', 'FREE'];
  return (
    <div className={cn('inline-flex rounded-lg border border-line bg-white p-1', className)} role="radiogroup">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          onClick={() => onChange(option)}
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-bold transition',
            value === option ? 'bg-brand-navy text-white shadow-sm' : 'text-ink-500 hover:bg-surface-variant',
          )}
        >
          {option === 'ALL' ? 'All tiers' : option === 'PRO' ? 'Pro' : 'Free'}
        </button>
      ))}
    </div>
  );
}

const healthLabel: Record<AiHealth, string> = {
  HEALTHY: 'Healthy',
  LOW_20: '20% warning',
  LOW_10: '10% warning',
  LOW_5: '5% warning',
  EXHAUSTED: 'Exhausted',
  NO_POOL: 'No pool',
  UNLIMITED: 'Unlimited',
};

const healthClass = (health: AiHealth) => {
  if (health === 'EXHAUSTED') return 'border-red-200 bg-red-50 text-red-700';
  if (health === 'LOW_5' || health === 'LOW_10') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (health === 'LOW_20') return 'border-yellow-200 bg-yellow-50 text-yellow-700';
  if (health === 'UNLIMITED') return 'border-indigo-200 bg-indigo-50 text-indigo-700';
  if (health === 'NO_POOL') return 'border-line bg-surface-variant text-ink-500';
  return 'border-emerald-200 bg-emerald-50 text-emerald-700';
};

export function HealthBadge({ wallet, fallback = 'No pool', unlimited = false }: { wallet: AiWalletSummary | null | undefined; fallback?: string; unlimited?: boolean }) {
  const health = unlimited ? 'UNLIMITED' : wallet?.health;
  if (!health) return <span className="text-xs text-ink-500">{fallback}</span>;
  return (
    <span className={cn('inline-flex rounded-full border px-2 py-1 text-xs font-semibold', healthClass(health))}>
      {healthLabel[health] ?? health}
      {wallet && health !== 'UNLIMITED' && health !== 'NO_POOL' ? ` - ${wallet.percentRemaining}%` : ''}
    </span>
  );
}

export function WalletCells({ wallet, unlimited = false }: { wallet: AiWalletSummary | null | undefined; unlimited?: boolean }) {
  if (unlimited || wallet?.unlimited) return <span className="text-xs font-semibold text-indigo-700">Unlimited</span>;
  if (!wallet) return <span className="text-xs text-ink-500">—</span>;
  return (
    <span className="block text-xs leading-5 text-ink-600">
      <strong className="ai-wallet-number text-sm text-ink-900">{formatCredits(wallet.availableTokens)}</strong> available
      <span className="block text-ink-400">
        {formatCredits(wallet.allocatedTokens)} assigned · {formatCredits(wallet.usedTokens)} used
      </span>
    </span>
  );
}

export function SectionHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h3 className="text-base font-bold text-ink-900">{title}</h3>
        {description ? <p className="text-sm text-ink-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr className="border-t border-line">
      <td colSpan={colSpan} className="px-3 py-6 text-center text-sm text-ink-500">
        {message}
      </td>
    </tr>
  );
}

export function LoadingBlock() {
  return (
    <div role="status" aria-label="Loading AI data" className="flex h-40 items-center justify-center">
      <Spinner className="h-6 w-6 text-brand-primary" />
    </div>
  );
}

/** Right-side detail drawer built on the shared dialog primitive. */
export function DetailDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="ai-workspace ai-dialog ai-drawer left-auto right-0 top-0 h-dvh max-h-dvh w-full max-w-xl translate-x-0 translate-y-0 content-start rounded-none rounded-l-xl sm:w-full">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="space-y-4">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

export function KeyValueGrid({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-lg border border-line bg-surface-variant/50 px-3 py-3 text-sm sm:grid-cols-[160px_1fr]">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</dt>
          <dd className="break-words text-ink-900">{value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function JsonBlock({ value }: { value: unknown }) {
  const text = useMemo(() => {
    try {
      return JSON.stringify(value ?? {}, null, 2);
    } catch {
      return String(value);
    }
  }, [value]);
  return (
    <pre className="max-h-72 overflow-auto rounded-lg border border-line bg-surface-variant px-3 py-2 text-[11px] leading-5 text-ink-700 scrollbar-thin">
      {text}
    </pre>
  );
}

/**
 * Searchable organization / user picker backed by `/admin/ai/accounts/search`.
 * Replaces the old capped dropdowns so every account is reachable.
 */
export function AsyncAccountSelect({
  scope,
  tier,
  value,
  onChange,
  placeholder,
}: {
  scope: 'ORGANIZATION' | 'USER';
  tier: AiTier;
  value: AiAccountSearchResult | null;
  onChange: (value: AiAccountSearchResult | null) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const query = useDebouncedValue(text, 250);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchQuery = useQuery({
    queryKey: ['ai-account-search', scope, tier, query],
    queryFn: () => aiAdminApi.searchAccounts({ q: query || undefined, scope, tier, limit: 20 }),
    enabled: open,
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  if (value) {
    return (
      <div className="ai-field"><span>{scope === 'USER' ? 'Selected user' : 'Selected organization'}</span><div className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm">
        <span className="min-w-0">
          <span className="block break-words font-semibold text-ink-900">{value.label}</span>
          <span className="block break-words text-[11px] text-ink-500">{value.sublabel}</span>
        </span>
        <button
          type="button"
          aria-label="Clear selection"
          className="rounded p-1 text-ink-500 hover:bg-surface-variant"
          onClick={() => onChange(null)}
        >
          <X className="h-4 w-4" />
        </button>
      </div></div>
    );
  }

  return (
    <div className="ai-field"><span>{scope === 'USER' ? 'User' : 'Organization'}</span><div ref={containerRef} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
      <Input
        aria-label={scope === 'USER' ? 'Select user' : 'Select organization'}
        className="pl-9"
        value={text}
        placeholder={placeholder ?? (scope === 'USER' ? 'Search teacher/admin user' : 'Search organization')}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setText(event.target.value);
          setOpen(true);
        }}
      />
      {open ? (
        <div className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-line bg-white py-1 shadow-elevated scrollbar-thin">
          {searchQuery.isLoading ? (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-ink-500">
              <Spinner className="h-4 w-4" /> Searching…
            </div>
          ) : searchQuery.isError ? (
            <div role="alert" className="p-3 text-sm text-red-700">Accounts could not be loaded. <button type="button" className="underline" onClick={() => searchQuery.refetch()}>Retry</button></div>
          ) : (searchQuery.data ?? []).length ? (
            (searchQuery.data ?? []).map((result) => (
              <button
                key={`${result.type}:${result.id}`}
                type="button"
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-surface-variant"
                onClick={() => {
                  onChange(result);
                  setText('');
                  setOpen(false);
                }}
              >
                <span className="min-w-0">
                  <span className="block break-words font-semibold text-ink-900">{result.label}</span>
                  <span className="block break-words text-[11px] text-ink-500">{result.sublabel}</span>
                </span>
                <span className="shrink-0 text-right text-[11px] text-ink-500">
                  {result.wallet ? (
                    result.wallet.unlimited ? (
                      'Unlimited'
                    ) : (
                      <>
                        {formatCredits(result.wallet.availableTokens)}
                        <span className="block">available</span>
                      </>
                    )
                  ) : (
                    'No pool yet'
                  )}
                </span>
              </button>
            ))
          ) : (
            <p className="px-3 py-3 text-sm text-ink-500">No matches</p>
          )}
        </div>
      ) : null}
    </div></div>
  );
}

/** Search box that keeps local text and pushes a debounced value upward. */
export function DebouncedSearchInput({
  id,
  value,
  onChange,
  placeholder,
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [text, setText] = useState(value);
  const debounced = useDebouncedValue(text, 350);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    if (debounced !== value) onChangeRef.current(debounced);
    // Only push when the debounced text changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);
  useEffect(() => {
    // External resets (e.g. "Clear filters").
    const timer = window.setTimeout(() => setText((current) => (value === '' && current !== '' && debounced === current ? '' : current)), 0);
    return () => window.clearTimeout(timer);
  }, [value, debounced]);
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
      <Input id={id} aria-label={placeholder} className="pl-9" value={text} placeholder={placeholder} onChange={(event) => setText(event.target.value)} />
    </div>
  );
}
