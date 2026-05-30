import * as React from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

export interface ConfirmRow {
  label: string;
  value: React.ReactNode;
}

interface ConfirmSubmitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  rows: ConfirmRow[];
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
}

const isEmptyValue = (value: React.ReactNode): boolean =>
  value === null || value === undefined || value === '';

/**
 * A reusable "review & confirm" dialog that shows a formatted summary of the
 * details about to be submitted (label/value rows) before running the action.
 * Built on the shared Dialog primitive because ConfirmationDialog is fixed to a
 * text-only description and cannot render a details table.
 */
export function ConfirmSubmitDialog({
  open,
  onOpenChange,
  title,
  description,
  rows,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loading = false,
  onConfirm,
}: ConfirmSubmitDialogProps) {
  const visibleRows = rows.filter((row) => !isEmptyValue(row.value));
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!loading) onOpenChange(next);
      }}
    >
      <DialogContent className="flex max-w-2xl flex-col gap-4">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-thin">
          <dl className="grid gap-2 md:grid-cols-2">
            {visibleRows.map((row) => (
              <div
                key={row.label}
                className="min-w-0 rounded-lg border border-line bg-white px-3 py-2"
              >
                <dt className="truncate text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                  {row.label}
                </dt>
                <dd className="mt-1 min-w-0 break-words text-sm font-medium leading-5 text-ink-900">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <DialogFooter className="shrink-0 border-t border-line bg-white pt-3">
          <Button
            type="button"
            variant="ghost"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button type="button" variant="primary" disabled={loading} onClick={onConfirm}>
            {loading ? <Spinner className="h-4 w-4" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
