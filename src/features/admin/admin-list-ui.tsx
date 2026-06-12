import type { ReactNode } from 'react';
import { Download, FileSpreadsheet, X } from 'lucide-react';

import type { ApiMeta } from '@/types/api';
import type { AdminExportFormat } from '@/services/admin-api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { FilterChip } from './admin-list-utils';

export function ActiveFilterChips({
  filters,
  onRemove,
  onClearAll,
}: {
  filters: FilterChip[];
  onRemove: (key: string) => void;
  onClearAll: () => void;
}) {
  if (filters.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((filter) => (
        <button
          key={`${filter.key}:${filter.value}`}
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full border border-brand-primary/15 bg-brand-primary/5 px-2.5 py-1 text-xs font-semibold text-brand-primary transition hover:bg-brand-primary/10"
          onClick={() => onRemove(filter.key)}
        >
          <span className="text-brand-primary/65">{filter.label}</span>
          {filter.value}
          <X className="h-3 w-3" />
        </button>
      ))}
      <Button type="button" variant="ghost" size="sm" onClick={onClearAll}>
        Clear filters
      </Button>
    </div>
  );
}

export function ExportButtons({
  onExport,
  disabled,
  loading,
}: {
  onExport: (format: AdminExportFormat) => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || loading}
        onClick={() => onExport('xlsx')}
      >
        <FileSpreadsheet className="h-4 w-4" />
        Export XLSX
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || loading}
        onClick={() => onExport('csv')}
      >
        <Download className="h-4 w-4" />
        Export CSV
      </Button>
    </div>
  );
}

export function PaginationFooter({
  meta,
  onPageChange,
}: {
  meta: ApiMeta | undefined;
  onPageChange: (page: number) => void;
}) {
  const page = meta?.page ?? 1;
  const totalPages = meta?.totalPages ?? 1;
  const total = meta?.total ?? 0;
  const perPage = meta?.perPage ?? 20;
  const start = total === 0 ? 0 : (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);

  return (
    <div className="flex flex-col gap-3 border-t border-line px-4 py-4 text-sm text-ink-500 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <span>
        Showing {start}-{end} of {total}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <Badge variant="default">
          Page {page} of {Math.max(totalPages, 1)}
        </Badge>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  detail,
  tone = 'blue',
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: 'blue' | 'orange' | 'green' | 'purple' | 'gray';
}) {
  const toneClasses = {
    blue: 'text-brand-primary',
    orange: 'text-brand-orange',
    green: 'text-success',
    purple: 'text-brand-purple',
    gray: 'text-ink-900',
  };
  return (
    <Card className="px-5 py-4">
      <p className="text-xs font-bold uppercase tracking-wide text-ink-400">
        {label}
      </p>
      <p className={cn('mt-2 text-2xl font-black', toneClasses[tone])}>{value}</p>
      {detail && <p className="mt-1 text-xs text-ink-500">{detail}</p>}
    </Card>
  );
}
