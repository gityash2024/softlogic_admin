import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Copy, Eye, EyeOff, RefreshCw, Sofa, KeyRound } from 'lucide-react';
import { toast } from 'sonner';

import { subscriptionsApi } from '@/services/subscriptions.api';
import { useAuthStore } from '@/lib/auth-store';
import { formatDate } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

function maskedKey(orgSlug: string | undefined, subscriptionId: string | undefined) {
  if (!orgSlug || !subscriptionId) return '-';
  const slug = orgSlug.slice(0, 3).toUpperCase();
  const tail = subscriptionId.slice(-2);
  return `SL-${slug.padEnd(3, 'X')}-****-${tail}`;
}

function fullKey(orgSlug: string | undefined, subscriptionId: string | undefined) {
  if (!orgSlug || !subscriptionId) return '-';
  const slug = orgSlug.slice(0, 3).toUpperCase();
  return `SL-${slug.padEnd(3, 'X')}-${subscriptionId.toUpperCase()}`;
}

export function LicensePage() {
  const { user } = useAuthStore();
  const { data, isLoading } = useQuery({
    queryKey: ['subscriptions', 'all'],
    queryFn: subscriptionsApi.all,
  });
  const [revealed, setRevealed] = useState(false);

  const orgId = user?.primaryOrganization?.id ?? null;
  const orgSubs = useMemo(
    () => data?.filter((s) => s.organizationId === orgId) ?? [],
    [data, orgId],
  );
  const primarySub = orgSubs[0] ?? null;
  const usage = primarySub
    ? Math.min(100, (primarySub.seatUsage / Math.max(primarySub.seatLimit, 1)) * 100)
    : 0;

  const copyKey = async () => {
    const text = fullKey(user?.primaryOrganization?.slug, primarySub?.id);
    await navigator.clipboard.writeText(text);
    toast.success('License key copied to clipboard');
  };

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner className="h-6 w-6 text-brand-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between border-b border-line px-6 py-4">
            <div>
              <h3 className="flex items-center gap-2 text-base font-semibold text-ink-900">
                <KeyRound className="h-4 w-4 text-brand-primary" />
                License Key
              </h3>
              <p className="text-xs text-ink-500">
                Workspace subscription reference
              </p>
            </div>
            <Badge variant="navy">
              {user?.primaryOrganization?.kind === 'INTERNAL'
                ? 'Enterprise Key'
                : 'Workspace Key'}
            </Badge>
          </div>
          <div className="space-y-3 px-6 py-5">
            <p className="text-xs uppercase tracking-wide text-ink-500">
              Workspace Subscription Reference
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg border border-line bg-surface-variant px-3 py-2 font-mono text-sm text-ink-900">
                {revealed
                  ? fullKey(user?.primaryOrganization?.slug, primarySub?.id)
                  : maskedKey(user?.primaryOrganization?.slug, primarySub?.id)}
              </code>
              <Button
                size="icon"
                variant="outline"
                onClick={() => setRevealed((v) => !v)}
                title={revealed ? 'Hide' : 'Reveal'}
              >
                {revealed ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
              <Button size="icon" variant="outline" onClick={copyKey} title="Copy">
                <Copy className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="primary" title="Regenerate" disabled>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <p className="pt-2 text-xs text-ink-500">
              Subscription scope: {user?.primaryOrganization?.name ?? '-'}
            </p>
          </div>
        </Card>

        <Card>
          <div className="border-b border-line px-6 py-4">
            <h3 className="flex items-center gap-2 text-base font-semibold text-ink-900">
              <Sofa className="h-4 w-4 text-brand-primary" />
              Usage Statistics
            </h3>
            <p className="text-xs text-ink-500">
              Current seat allocation and plan status
            </p>
          </div>
          <div className="space-y-5 px-6 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-500">
                  Active Seats
                </p>
                <p className="mt-1 text-2xl font-bold text-ink-900">
                  {primarySub?.seatUsage ?? 0}{' '}
                  <span className="text-sm font-medium text-ink-500">
                    / {primarySub?.seatLimit ?? 0}
                  </span>
                </p>
                <div className="mt-2">
                  <Progress value={usage} />
                </div>
                <p className="mt-2 text-xs text-ink-500">
                  {Math.max(
                    (primarySub?.seatLimit ?? 0) - (primarySub?.seatUsage ?? 0),
                    0,
                  )}{' '}
                  seats remaining in current plan
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-500">
                  Plan Status
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge
                    variant={
                      primarySub?.status === 'ACTIVE' ? 'success' : 'warning'
                    }
                  >
                    {primarySub?.status ?? '-'}
                  </Badge>
                </div>
                <p className="mt-3 text-sm text-ink-700">
                  {primarySub?.planName ?? '-'}
                </p>
                <p className="text-xs text-ink-500">
                  {user?.primaryOrganization?.name ?? ''}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-ink-900">
              Billing History
            </h3>
            <p className="text-xs text-ink-500">
              Subscription cycles for {user?.primaryOrganization?.name ?? 'this workspace'}
            </p>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice ID</TableHead>
              <TableHead>Billing Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Plan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orgSubs.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <p className="font-mono text-sm font-medium text-ink-900">
                    #SUB-{s.id.slice(0, 6).toUpperCase()}
                  </p>
                </TableCell>
                <TableCell>
                  <p className="text-sm text-ink-700">
                    {formatDate(s.startDate)}
                  </p>
                </TableCell>
                <TableCell>
                  <p className="text-sm font-semibold text-ink-900">Managed</p>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={s.status === 'ACTIVE' ? 'success' : 'warning'}
                  >
                    {s.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <p className="text-sm text-ink-700">{s.planName}</p>
                </TableCell>
              </TableRow>
            ))}
            {orgSubs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-ink-500">
                  No invoices yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
