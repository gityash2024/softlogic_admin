import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building2, KeyRound } from 'lucide-react';

import { organizationsApi } from '@/services/organizations.api';
import { subscriptionsApi } from '@/services/subscriptions.api';
import { licensingApi } from '@/services/licensing.api';
import { useAuthStore } from '@/lib/auth-store';
import { formatDate } from '@/lib/utils';
import { SUBSCRIPTION_STATUS_LABEL } from '@/types/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function PartnerSubscriptionOverviewPage() {
  const { partnerId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const partnerQuery = useQuery({
    queryKey: ['organizations', partnerId],
    queryFn: () => organizationsApi.get(partnerId!),
    enabled: isSuperAdmin && !!partnerId,
  });
  const subscriptionsQuery = useQuery({
    queryKey: ['subscriptions', 'partner-overview', partnerId],
    queryFn: () =>
      subscriptionsApi.list({ partnerOrganizationId: partnerId, perPage: 100 }),
    enabled: isSuperAdmin && !!partnerId,
  });
  const keysQuery = useQuery({
    queryKey: ['activation-keys', 'partner-overview', partnerId],
    queryFn: () => licensingApi.listKeys({ partnerOrganizationId: partnerId, perPage: 100 }),
    enabled: isSuperAdmin && !!partnerId,
  });

  const subscriptions = subscriptionsQuery.data?.data ?? [];
  const activationKeys = keysQuery.data?.data ?? [];
  const partner = partnerQuery.data;
  const ownSubscriptions = subscriptions.filter(
    (subscription) => subscription.organizationId === partnerId,
  );
  const childSubscriptions = subscriptions.filter(
    (subscription) => subscription.organization?.parentOrganizationId === partnerId,
  );
  const childOrgCount = useMemo(
    () =>
      new Set(
        childSubscriptions
          .map((subscription) => subscription.organizationId)
          .filter(Boolean),
      ).size,
    [childSubscriptions],
  );
  const seatLimit = subscriptions.reduce((sum, subscription) => sum + subscription.seatLimit, 0);
  const seatUsage = subscriptions.reduce((sum, subscription) => sum + subscription.seatUsage, 0);
  const pendingCount = subscriptions.filter(
    (subscription) => subscription.status === 'PENDING_APPROVAL',
  ).length;

  if (!isSuperAdmin) {
    return (
      <Card className="mx-auto max-w-xl px-5 py-6 text-center">
        <h2 className="text-lg font-bold text-ink-900">Super Admin view only</h2>
        <p className="mt-1 text-sm text-ink-500">
          Partner subscription overview is available only to SoftLogic Super Admins.
        </p>
      </Card>
    );
  }

  if (partnerQuery.isLoading || subscriptionsQuery.isLoading || keysQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-7 w-7 text-brand-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button type="button" variant="ghost" size="sm" onClick={() => navigate('/subscriptions')}>
            <ArrowLeft className="h-4 w-4" />
            Subscriptions
          </Button>
          <h2 className="mt-2 text-2xl font-black text-ink-900">
            {partner?.name ?? 'Partner'} overview
          </h2>
          <p className="text-sm text-ink-500">
            Partner subscriptions, child organization allocations, and activation keys.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Partner plans" value={ownSubscriptions.length} />
        <SummaryCard label="Child orgs" value={childOrgCount} />
        <SummaryCard label="Seats" value={`${seatUsage}/${seatLimit}`} />
        <SummaryCard label="Pending approvals" value={pendingCount} />
      </div>

      <SubscriptionSection
        title="Partner subscriptions"
        rows={ownSubscriptions}
        empty="No partner-owned subscriptions found."
      />
      <SubscriptionSection
        title="Child organization subscriptions"
        rows={childSubscriptions}
        empty="No child organization subscriptions found."
      />

      <Card>
        <div className="border-b border-line px-4 py-4 sm:px-6">
          <h3 className="flex items-center gap-2 text-base font-semibold text-ink-900">
            <KeyRound className="h-4 w-4 text-brand-primary" />
            Activation keys
          </h3>
          <p className="text-xs text-ink-500">Keys created by the partner or Super Admin for this hierarchy.</p>
        </div>
        <Table className="min-w-[980px]">
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead>Source subscription</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created by</TableHead>
              <TableHead>Email sent</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activationKeys.map((key) => (
              <TableRow key={key.id}>
                <TableCell className="font-semibold text-ink-900">{key.label ?? '-'}</TableCell>
                <TableCell>{key.organization?.name ?? '-'}</TableCell>
                <TableCell>
                  <p className="text-sm text-ink-900">{key.subscription?.planName ?? '-'}</p>
                  <p className="text-xs text-ink-500">{key.subscription?.organization?.name ?? ''}</p>
                </TableCell>
                <TableCell><Badge variant={key.status === 'BOUND' ? 'success' : 'info'}>{key.status}</Badge></TableCell>
                <TableCell>{key.createdBy?.name ?? key.createdBy?.email ?? '-'}</TableCell>
                <TableCell>{key.emailSentAt ? formatDate(key.emailSentAt) : '-'}</TableCell>
                <TableCell>{formatDate(key.createdAt)}</TableCell>
              </TableRow>
            ))}
            {activationKeys.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-ink-500">
                  No activation keys found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="px-4 py-5 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-ink-900">{value}</p>
    </Card>
  );
}

function SubscriptionSection({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Awaited<ReturnType<typeof subscriptionsApi.all>>;
  empty: string;
}) {
  return (
    <Card>
      <div className="border-b border-line px-4 py-4 sm:px-6">
        <h3 className="flex items-center gap-2 text-base font-semibold text-ink-900">
          <Building2 className="h-4 w-4 text-brand-primary" />
          {title}
        </h3>
      </div>
      <Table className="min-w-[920px]">
        <TableHeader>
          <TableRow>
            <TableHead>Organization</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Seats</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Allocated from</TableHead>
            <TableHead>Created by</TableHead>
            <TableHead>Term</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((subscription) => {
            const pct = Math.min(
              100,
              subscription.seatLimit > 0
                ? (subscription.seatUsage / subscription.seatLimit) * 100
                : 0,
            );
            return (
              <TableRow key={subscription.id}>
                <TableCell>{subscription.organization?.name ?? subscription.user?.email ?? '-'}</TableCell>
                <TableCell className="font-semibold text-ink-900">{subscription.planName}</TableCell>
                <TableCell>
                  <div className="w-40 space-y-1">
                    <Progress value={pct} />
                    <p className="text-xs text-ink-500">
                      {subscription.seatUsage}/{subscription.seatLimit}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={subscription.status === 'ACTIVE' ? 'success' : 'warning'}>
                    {SUBSCRIPTION_STATUS_LABEL[subscription.status]}
                  </Badge>
                </TableCell>
                <TableCell>{subscription.allocatedFromSubscription?.organization?.name ?? '-'}</TableCell>
                <TableCell>{subscription.createdBy?.name ?? subscription.createdBy?.email ?? '-'}</TableCell>
                <TableCell>
                  {formatDate(subscription.startDate)} - {subscription.endDate ? formatDate(subscription.endDate) : 'No end'}
                </TableCell>
              </TableRow>
            );
          })}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="py-10 text-center text-sm text-ink-500">
                {empty}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
