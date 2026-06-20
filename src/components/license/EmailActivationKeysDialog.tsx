import { useCallback, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Mail } from 'lucide-react';
import { toast } from 'sonner';

import { licensingApi } from '@/services/licensing.api';
import type { HardwareActivationKeyRecord } from '@/types/api';
import { extractApiError } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface EmailActivationKeysDialogProps {
  open: boolean;
  organizationId: string;
  organizationName?: string | null;
  keys: HardwareActivationKeyRecord[];
  newEmailSlotsRemaining?: number | null;
  onOpenChange: (open: boolean) => void;
  onSent?: () => void;
}

export function EmailActivationKeysDialog({
  open,
  organizationId,
  organizationName,
  keys,
  newEmailSlotsRemaining,
  onOpenChange,
  onSent,
}: EmailActivationKeysDialogProps) {
  const canEmailKey = useCallback((key: HardwareActivationKeyRecord) =>
    Boolean(key.activationKey) &&
    !key.emailSentAt &&
    (key.status === 'AVAILABLE' || key.status === 'BOUND'), []);
  const emailableIds = useMemo(
    () => keys.filter(canEmailKey).map((key) => key.id),
    [canEmailKey, keys],
  );
  const unsentEmailableIds = useMemo(
    () => emailableIds,
    [emailableIds],
  );
  const defaultSelectedIds = useMemo(() => {
    if (newEmailSlotsRemaining === null || newEmailSlotsRemaining === undefined) {
      return emailableIds;
    }
    const selected: string[] = [];
    let newCount = 0;
    for (const key of keys) {
      if (!canEmailKey(key)) continue;
      if (newCount >= newEmailSlotsRemaining) continue;
      newCount += 1;
      selected.push(key.id);
    }
    return selected;
  }, [canEmailKey, emailableIds, keys, newEmailSlotsRemaining]);
  const [selectedIds, setSelectedIds] = useState<string[]>(defaultSelectedIds);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedUnsentCount = useMemo(
    () =>
      keys.filter(
        (key) => selectedSet.has(key.id) && Boolean(key.activationKey) && !key.emailSentAt,
      ).length,
    [keys, selectedSet],
  );
  const selectWithLimit = (ids: string[]) => {
    if (newEmailSlotsRemaining === null || newEmailSlotsRemaining === undefined) {
      setSelectedIds(ids);
      return;
    }
    const selected: string[] = [];
    let newCount = 0;
    for (const id of ids) {
      const key = keys.find((item) => item.id === id);
      if (!key || !canEmailKey(key)) continue;
      if (newCount >= newEmailSlotsRemaining) continue;
      newCount += 1;
      selected.push(id);
    }
    setSelectedIds(selected);
  };

  const mutation = useMutation({
    mutationFn: () =>
      licensingApi.emailActivationKeysToOrgAdmin({
        organizationId,
        activationKeyIds: selectedIds,
      }),
    onSuccess: (data) => {
      toast.success(
        data.delivered
          ? `Emailed ${data.keyCount} key(s) to ${data.recipient}`
          : 'Activation key email queued',
      );
      onSent?.();
      onOpenChange(false);
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const toggleOne = (keyId: string, checked: boolean) => {
    const key = keys.find((item) => item.id === keyId);
    if (
      checked &&
      key &&
      canEmailKey(key) &&
      newEmailSlotsRemaining !== null &&
      newEmailSlotsRemaining !== undefined &&
      selectedUnsentCount >= newEmailSlotsRemaining
    ) {
      toast.error(`Only ${newEmailSlotsRemaining} new key(s) can be emailed for this organization`);
      return;
    }
    setSelectedIds((current) =>
      checked
        ? Array.from(new Set([...current, keyId]))
        : current.filter((id) => id !== keyId),
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!w-[calc(100vw-1rem)] !max-w-5xl sm:!w-[calc(100vw-2rem)]">
        <DialogHeader>
          <DialogTitle>Email activation keys</DialogTitle>
          <DialogDescription>
            Select the activation keys to email to the organization admin
            {organizationName ? ` for ${organizationName}` : ''}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-variant px-3 py-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={emailableIds.length === 0}
              onClick={() => selectWithLimit(emailableIds)}
            >
              Select all
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={unsentEmailableIds.length === 0}
              onClick={() => selectWithLimit(unsentEmailableIds)}
            >
              Select all unsent
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={selectedIds.length === 0}
              onClick={() => setSelectedIds([])}
            >
              Clear selection
            </Button>
            <span className="text-xs font-medium text-ink-500">
              {selectedIds.length}/{emailableIds.length} selected, {unsentEmailableIds.length}{' '}
              unsent
              {newEmailSlotsRemaining !== null && newEmailSlotsRemaining !== undefined
                ? `, ${newEmailSlotsRemaining} new send slot(s)`
                : ''}
            </span>
          </div>

          <div className="max-h-[55vh] min-w-0 overflow-auto rounded-lg border border-line">
            <Table className="min-w-[920px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Send</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Email status</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Bound device</TableHead>
                  <TableHead>Expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => {
                  const canEmail = canEmailKey(key);
                  const unsentLimitReached =
                    canEmail &&
                    !selectedSet.has(key.id) &&
                    newEmailSlotsRemaining !== null &&
                    newEmailSlotsRemaining !== undefined &&
                    selectedUnsentCount >= newEmailSlotsRemaining;
                  return (
                    <TableRow key={key.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedSet.has(key.id)}
                          disabled={!canEmail || unsentLimitReached}
                          onChange={(event) => toggleOne(key.id, event.target.checked)}
                          className="h-4 w-4 rounded border-line text-brand-primary disabled:opacity-40"
                          aria-label={`Email ${key.label ?? 'activation key'}`}
                        />
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate font-semibold text-ink-900">
                        {key.label ?? '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {canEmail ? (
                          <code className="rounded border border-line bg-surface-variant px-2 py-1 font-mono text-xs">
                            ••••••••••••
                          </code>
                        ) : (
                          <span className="text-xs text-ink-500">
                            Legacy key - reissue to email
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {!canEmail ? (
                          <Badge variant="default">Not email-able</Badge>
                        ) : key.emailSentAt ? (
                          <div className="flex flex-col gap-1">
                            <Badge variant="success">Sent</Badge>
                            <span className="text-xs text-ink-500">
                              {formatDate(key.emailSentAt)}
                            </span>
                          </div>
                        ) : (
                          <Badge variant="warning">Unsent</Badge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge
                          variant={
                            key.status === 'AVAILABLE'
                              ? 'info'
                              : key.status === 'BOUND'
                                ? 'success'
                                : 'warning'
                          }
                        >
                          {key.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="min-w-0">
                        <p className="text-sm text-ink-700">
                          {key.boundActivation?.deviceModel ?? '—'}
                        </p>
                        <p className="text-xs text-ink-500">
                          {key.boundActivation?.devicePlatform ?? ''}
                        </p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {key.expiresAt ? formatDate(key.expiresAt) : 'No expiry'}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {keys.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-ink-500">
                      No activation keys issued yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter className="min-w-0 flex-wrap">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={
              mutation.isPending ||
              selectedIds.length === 0 ||
              (newEmailSlotsRemaining !== null &&
                newEmailSlotsRemaining !== undefined &&
                selectedUnsentCount > newEmailSlotsRemaining)
            }
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Spinner className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
            Email {selectedIds.length} key{selectedIds.length === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
