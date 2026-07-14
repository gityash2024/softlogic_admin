import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Mail } from 'lucide-react';
import { toast } from 'sonner';

import { licensingApi } from '@/services/licensing.api';
import type { HardwareActivationKeyRecord, OrganizationCapacitySummaryRecord } from '@/types/api';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface AssignableOrganization {
  id: string;
  name: string;
  capacitySummary?: OrganizationCapacitySummaryRecord;
  primaryAdminUser?: {
    email: string;
    name: string | null;
  } | null;
}

interface AssignActivationKeysDialogProps {
  open: boolean;
  sourcePartnerOrganizationId: string;
  organizations: AssignableOrganization[];
  keys: HardwareActivationKeyRecord[];
  onOpenChange: (open: boolean) => void;
  onSent?: () => void;
}

export function AssignActivationKeysDialog({
  open,
  sourcePartnerOrganizationId,
  organizations,
  keys,
  onOpenChange,
  onSent,
}: AssignActivationKeysDialogProps) {
  const poolKeys = useMemo(
    () =>
      keys.filter(
        (key) =>
          key.organizationId === sourcePartnerOrganizationId &&
          key.status === 'AVAILABLE' &&
          Boolean(key.activationKey),
      ),
    [keys, sourcePartnerOrganizationId],
  );
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? '');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const currentOrganizationId = organizationId || organizations[0]?.id || '';
  const selectedOrganization =
    organizations.find((org) => org.id === currentOrganizationId) ?? null;
  const childCapacity = selectedOrganization?.capacitySummary ?? null;
  const remainingAssignableSlots = childCapacity?.activationKeyRemaining ?? poolKeys.length;
  const maxAssignableSlots = Math.max(remainingAssignableSlots, 0);
  const selectablePoolKeyCount = Math.min(poolKeys.length, maxAssignableSlots);
  const poolKeyIds = useMemo(() => new Set(poolKeys.map((key) => key.id)), [poolKeys]);
  const cappedSelectedIds = useMemo(
    () => selectedIds.filter((id) => poolKeyIds.has(id)).slice(0, maxAssignableSlots),
    [maxAssignableSlots, poolKeyIds, selectedIds],
  );
  const selectedSet = useMemo(() => new Set(cappedSelectedIds), [cappedSelectedIds]);

  const handleOrganizationChange = (nextOrganizationId: string) => {
    setOrganizationId(nextOrganizationId);
    setSelectedIds([]);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setOrganizationId('');
      setSelectedIds([]);
    }
    onOpenChange(nextOpen);
  };

  const mutation = useMutation({
    mutationFn: () =>
      licensingApi.assignEmailActivationKeysToOrgAdmin({
        organizationId: currentOrganizationId,
        sourcePartnerOrganizationId,
        activationKeyIds: cappedSelectedIds,
      }),
    onSuccess: (data) => {
      toast.success(
        data.delivered
          ? `Assigned and emailed ${data.keyCount} key(s) to ${data.recipient}`
          : 'Activation key email queued',
      );
      onSent?.();
      handleOpenChange(false);
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const toggleOne = (keyId: string, checked: boolean) => {
    if (checked && cappedSelectedIds.length >= maxAssignableSlots) {
      toast.error(`Only ${maxAssignableSlots} key slot(s) remain for this organization`);
      return;
    }
    setSelectedIds((current) => {
      const normalized = current
        .filter((id) => poolKeyIds.has(id))
        .slice(0, maxAssignableSlots);
      return checked
        ? Array.from(new Set([...normalized, keyId])).slice(0, maxAssignableSlots)
        : normalized.filter((id) => id !== keyId);
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="!w-[calc(100vw-1rem)] !max-w-5xl sm:!w-[calc(100vw-2rem)]">
        <DialogHeader>
          <DialogTitle>Assign pool keys</DialogTitle>
          <DialogDescription>
            Select available partner-pool keys and email them to the child organization admin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                Organization
              </label>
              <Select value={currentOrganizationId} onValueChange={handleOrganizationChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select child organization" />
                </SelectTrigger>
                <SelectContent searchPlaceholder="Search organization...">
                  {organizations.map((organization) => (
                    <SelectItem key={organization.id} value={organization.id}>
                      {organization.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg border border-line bg-surface-variant px-3 py-2 text-xs text-ink-600">
              <p className="font-semibold text-ink-900">
                {selectedOrganization?.primaryAdminUser?.email ?? 'No primary admin email'}
              </p>
              <p>{cappedSelectedIds.length}/{poolKeys.length} key(s) selected</p>
            </div>
          </div>

          <div className="grid gap-2 rounded-lg border border-line bg-surface-variant px-3 py-3 text-sm text-ink-700 sm:grid-cols-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                Child seats
              </p>
              <p className="font-bold text-ink-900">
                {childCapacity?.activationKeyCapacity ?? 0}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                Existing keys
              </p>
              <p className="font-bold text-ink-900">
                {childCapacity?.activationKeysUsable ?? 0}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                Selected now
              </p>
              <p className="font-bold text-ink-900">{cappedSelectedIds.length}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                Remaining slots
              </p>
              <p className="font-bold text-ink-900">
                {Math.max(remainingAssignableSlots - cappedSelectedIds.length, 0)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-variant px-3 py-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={selectablePoolKeyCount === 0}
              onClick={() =>
                setSelectedIds(poolKeys.slice(0, selectablePoolKeyCount).map((key) => key.id))
              }
            >
              Select all
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={cappedSelectedIds.length === 0}
              onClick={() => setSelectedIds([])}
            >
              Clear selection
            </Button>
            <span className="text-xs font-medium text-ink-500">
              Bound or already assigned keys are hidden; selection is capped by the child seats.
            </span>
          </div>

          <div className="max-h-[52vh] overflow-auto rounded-lg border border-line">
            <Table className="min-w-[820px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Send</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Source / pool</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {poolKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedSet.has(key.id)}
                        disabled={
                          !selectedSet.has(key.id) &&
                          cappedSelectedIds.length >= maxAssignableSlots
                        }
                        onChange={(event) => toggleOne(key.id, event.target.checked)}
                        className="h-4 w-4 rounded border-line text-brand-primary"
                        aria-label={`Assign ${key.label ?? 'activation key'}`}
                      />
                    </TableCell>
                    <TableCell className="font-semibold text-ink-900">
                      {key.label ?? '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="info">{key.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-ink-900">
                        {key.organizationId === sourcePartnerOrganizationId ? 'Partner pool' : 'Direct licence'}
                      </p>
                      <p className="text-xs text-ink-500">
                        {key.subscription?.organization?.name ?? ''}
                      </p>
                    </TableCell>
                    <TableCell>
                      {key.expiresAt ? formatDate(key.expiresAt) : 'No expiry'}
                    </TableCell>
                    <TableCell>{formatDate(key.createdAt)}</TableCell>
                  </TableRow>
                ))}
                {poolKeys.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-ink-500">
                      No available pool keys.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter className="min-w-0 flex-wrap">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={
              mutation.isPending ||
              !currentOrganizationId ||
              !selectedOrganization?.primaryAdminUser?.email ||
              cappedSelectedIds.length === 0
            }
            onClick={() => mutation.mutate()}
            data-tour="tour-license-assign-keys-submit"
          >
            {mutation.isPending ? <Spinner className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
            Assign and email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
