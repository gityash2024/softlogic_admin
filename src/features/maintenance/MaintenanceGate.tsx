import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Clock3,
  LockKeyhole,
  LogIn,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { extractApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { canManageMaintenance } from '@/lib/maintenance-access';
import { authApi } from '@/services/auth.api';
import { maintenanceApi, type MaintenanceStatus } from '@/services/maintenance.api';
import {
  formatDuration,
  formatMaintenanceDateTime,
} from './maintenance-utils';

const dismissKey = (windowId: string) =>
  `softlogic.maintenance.dismissed.${windowId}`;

export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const exactSuperAdmin = canManageMaintenance(user);
  const [dismissedWindowId, setDismissedWindowId] = useState<string | null>(null);
  const statusQuery = useQuery({
    queryKey: ['maintenance', 'status'],
    queryFn: maintenanceApi.status,
    refetchInterval: (query) =>
      query.state.data?.state === 'active' ? 10_000 : 30_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const status = statusQuery.data;
  const windowId = status?.window?.id ?? null;

  useEffect(() => {
    if (!windowId || typeof window === 'undefined') {
      setDismissedWindowId(null);
      return;
    }
    setDismissedWindowId(
      window.localStorage.getItem(dismissKey(windowId)) === '1'
        ? windowId
        : null,
    );
  }, [windowId]);

  if (status?.state === 'active' && !exactSuperAdmin) {
    return (
      <MaintenanceActiveScreen
        status={status}
        checking={statusQuery.isFetching}
        onRetry={() => void statusQuery.refetch()}
      />
    );
  }

  const showUpcomingBanner =
    status?.state === 'upcoming' &&
    status.window &&
    dismissedWindowId !== status.window.id;

  return (
    <>
      {showUpcomingBanner && (
        <MaintenanceFutureBanner
          status={status}
          onDismiss={() => {
            if (!status.window || typeof window === 'undefined') return;
            window.localStorage.setItem(dismissKey(status.window.id), '1');
            setDismissedWindowId(status.window.id);
          }}
        />
      )}
      {children}
    </>
  );
}

function MaintenanceFutureBanner({
  status,
  onDismiss,
}: {
  status: MaintenanceStatus;
  onDismiss: () => void;
}) {
  const window = status.window;
  if (!window) return null;
  return (
    <div className="sticky top-0 z-[80] border-b border-amber-300/70 bg-amber-50 px-3 py-2 text-amber-950 shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
          <Clock3 className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{window.title}</p>
          <p className="truncate text-xs text-amber-800">
            Starts {formatMaintenanceDateTime(window.startsAt)} IST, ends{' '}
            {formatMaintenanceDateTime(window.endsAt)} IST. Begins in{' '}
            {formatDuration(window.secondsUntilStart)}.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-amber-900 hover:bg-amber-100"
          onClick={onDismiss}
          aria-label="Dismiss maintenance notice"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function MaintenanceActiveScreen({
  status,
  checking,
  onRetry,
}: {
  status: MaintenanceStatus;
  checking: boolean;
  onRetry: () => void;
}) {
  const window = status.window;
  const setSession = useAuthStore((state) => state.setSession);
  const clear = useAuthStore((state) => state.clear);
  const currentUser = useAuthStore((state) => state.user);
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState('anirudha@softlogic.co.in');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loginMutation = useMutation({
    mutationFn: () => authApi.adminLogin(email, password),
    onSuccess: (session) => {
      if (!canManageMaintenance(session.user)) {
        setError('This bypass is limited to the designated SoftLogic superadmin.');
        return;
      }
      setSession(session);
      setError(null);
    },
    onError: (err) => setError(extractApiError(err)),
  });

  const remaining = window?.secondsUntilEnd ?? 0;
  const loginDisabled = loginMutation.isPending || !email.trim() || !password;

  const schedule = useMemo(() => {
    if (!window) return null;
    return {
      starts: formatMaintenanceDateTime(window.startsAt),
      ends: formatMaintenanceDateTime(window.endsAt),
    };
  }, [window]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    loginMutation.mutate();
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#F5F7FB] px-4 py-8">
      <div className="w-full max-w-3xl overflow-hidden rounded-lg border border-line bg-white shadow-elevated">
        <div className="bg-brand-navy px-6 py-6 text-white sm:px-8">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white/10 text-brand-orange">
              <LockKeyhole className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
                Scheduled Maintenance
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-normal sm:text-3xl">
                {window?.title ?? 'SoftLogic is under maintenance'}
              </h1>
              <p className="mt-2 text-sm leading-6 text-white/75">
                {window?.message ??
                  'We are performing a planned maintenance window.'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 px-6 py-6 sm:grid-cols-3 sm:px-8">
          <StatusTile label="Started" value={schedule?.starts ?? '-'} />
          <StatusTile label="Ends" value={schedule?.ends ?? '-'} />
          <StatusTile
            label="Remaining"
            value={formatDuration(remaining)}
            highlighted
          />
        </div>

        <div className="border-t border-line px-6 py-5 sm:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2 text-sm text-ink-500">
              <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
              <span className="min-w-0">
                Access will resume automatically after the maintenance window.
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={onRetry}
              disabled={checking}
            >
              {checking ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Retry
            </Button>
          </div>

          <div className="mt-5 rounded-lg border border-line bg-surface-variant/70 p-4">
            <button
              type="button"
              className="inline-flex items-center gap-2 text-sm font-semibold text-brand-primary"
              onClick={() => setShowLogin((value) => !value)}
            >
              <ShieldCheck className="h-4 w-4" />
              Superadmin sign in
            </button>
            {currentUser && !canManageMaintenance(currentUser) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-2"
                onClick={clear}
              >
                Sign out current user
              </Button>
            )}
            {showLogin && (
              <form
                onSubmit={submit}
                className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
              >
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Superadmin email"
                  autoComplete="username"
                />
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password"
                  autoComplete="current-password"
                />
                <Button type="submit" disabled={loginDisabled}>
                  {loginMutation.isPending ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <LogIn className="h-4 w-4" />
                  )}
                  Sign in
                </Button>
                {error && (
                  <p className="sm:col-span-3 text-sm font-medium text-danger">
                    {error}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusTile({
  label,
  value,
  highlighted = false,
}: {
  label: string;
  value: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className={
        highlighted
          ? 'rounded-lg border border-brand-primary/20 bg-brand-primary/10 p-4'
          : 'rounded-lg border border-line bg-surface-variant/70 p-4'
      }
    >
      <p className="text-xs font-semibold uppercase text-ink-400">{label}</p>
      <p className="mt-1 text-sm font-bold text-ink-900">{value}</p>
    </div>
  );
}
