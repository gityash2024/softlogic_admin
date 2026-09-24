import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatCredits, formatDateTime } from '@/features/ai/components/ai-format';
import { aiBrandLabelsForUser, canBuyAiCredits } from '@/lib/ai-branding';
import { useAuthStore } from '@/lib/auth-store';
import { aiAdminApi } from '@/services/ai-admin.api';
import { aiBillingApi } from '@/services/ai-billing.api';

const ALERT_ROLES = new Set(['SUPER_ADMIN', 'PARTNER_ADMIN', 'CUSTOMER_ADMIN', 'ADMIN']);

const LEVEL_LABEL: Record<string, string> = {
  LOW_20: 'below 20%',
  LOW_10: 'below 10%',
  LOW_5: 'below 5%',
  EXHAUSTED: 'used up',
};

/**
 * Low-balance alerts for admins. Renders nothing until an alert exists (and
 * on a Phase 1 backend), so the top bar is unchanged for everyone else.
 */
export function AiAlertsBell() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const enabled = Boolean(user && ALERT_ROLES.has(user.role));
  const alertsQuery = useQuery({
    queryKey: ['ai-alerts'],
    queryFn: () => aiAdminApi.alerts({ page: 1, perPage: 10 }),
    enabled,
    retry: false,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  // "Buy" only while purchases are open (Pro ON + billing enabled); no upgrade UI otherwise.
  const storefrontQuery = useQuery({
    queryKey: ['ai-billing-storefront'],
    queryFn: aiBillingApi.storefront,
    enabled: enabled && canBuyAiCredits(user) && Boolean(alertsQuery.data?.data?.length),
    retry: false,
    staleTime: 60_000,
  });
  const markAll = useMutation({
    mutationFn: () => aiAdminApi.markAlertRead('all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-alerts'] }),
  });

  const alerts = alertsQuery.data?.data ?? [];
  if (!enabled || !alerts.length) return null;
  const unread = Number((alertsQuery.data?.meta as { unread?: number } | undefined)?.unread ?? 0);
  const brand = aiBrandLabelsForUser(user);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="icon" className="relative shrink-0" aria-label={`${brand.product} credit alerts`}>
          <Bell className="h-4 w-4" />
          {unread ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[340px] p-0">
        <div className="flex items-center justify-between border-b border-line px-3 py-2">
          <p className="text-sm font-bold text-ink-900">{brand.product} credit alerts</p>
          {unread ? (
            <button type="button" className="text-xs font-semibold text-brand-primary hover:underline" onClick={() => markAll.mutate()}>
              Mark all read
            </button>
          ) : null}
        </div>
        <div className="max-h-80 overflow-y-auto scrollbar-thin">
          {alerts.map((alert) => {
            const owner = alert.account?.organization?.name ?? alert.account?.user?.name ?? alert.account?.user?.email ?? 'Wallet';
            return (
              <div key={alert.id} className={`border-b border-line px-3 py-2 text-xs ${alert.readAt ? '' : 'bg-brand-primary/5'}`}>
                <p className="font-semibold text-ink-900">
                  {owner}: {alert.tier === 'PRO' ? brand.pro : brand.free} credits {LEVEL_LABEL[alert.level] ?? alert.level}
                </p>
                <p className="text-ink-500">
                  {formatCredits(alert.availableCredits)} left · {formatDateTime(alert.createdAt)}
                </p>
              </div>
            );
          })}
        </div>
        <div className="flex justify-end gap-2 px-3 py-2">
          {isSuperAdmin ? (
            <Button type="button" size="sm" variant="outline" onClick={() => navigate('/ai?tab=organizations')}>
              Review wallets
            </Button>
          ) : storefrontQuery.data?.available ? (
            <Button type="button" size="sm" variant="primary" onClick={() => navigate('/settings?tab=softlogic-ai')}>
              Buy {brand.pro} credits
            </Button>
          ) : null}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
