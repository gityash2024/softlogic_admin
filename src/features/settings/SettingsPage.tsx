import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTour } from '@/components/tour/TourProvider';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Building2,
  Eye,
  EyeOff,
  Laptop,
  LogOut,
  Save,
  ShieldCheck,
  Trash2,
  User,
  KeyRound,
  Smartphone,
  Cloud,
  CheckCircle2,
  Clock,
  Globe,
  SlidersHorizontal,
} from 'lucide-react';

import { useAuthStore } from '@/lib/auth-store';
import { usersApi } from '@/services/users.api';
import { authApi, type AuthLoginSession } from '@/services/auth.api';
import { extractApiError } from '@/lib/api';
import {
  BRANDING_MODE_LABEL,
  ORG_KIND_LABEL,
  ROLE_LABEL,
  STORAGE_STATUS_LABEL,
} from '@/types/api';
import { PasswordRequirements } from '@/components/auth/PasswordRequirements';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { formatDateTime, initials } from '@/lib/utils';
import { StorageIntegrationsCard } from './StorageIntegrationsCard';
import { QrLoginScannerCard } from './QrLoginScannerCard';

const passwordSchema = z
  .object({
    newPassword: z
      .string()
      .min(1, 'Password is required')
      .regex(/[A-Za-z]/, 'Include at least one letter')
      .regex(/[0-9]/, 'Include at least one number'),
    confirmNewPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((values) => values.newPassword === values.confirmNewPassword, {
    path: ['confirmNewPassword'],
    message: 'Passwords do not match',
  });

type PasswordFormValues = z.infer<typeof passwordSchema>;

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-line/70 bg-surface-variant/60 p-2.5">
      <dt className="text-[10px] font-bold uppercase tracking-wider text-ink-400">{label}</dt>
      <dd className="mt-1 break-words text-xs font-semibold text-ink-900">{value}</dd>
    </div>
  );
}

function describeSessionDevice(session: AuthLoginSession) {
  const info = session.deviceInfo ?? {};
  const clientType = typeof info.clientType === 'string' ? info.clientType : '';
  const label =
    typeof info.label === 'string' && info.label.trim()
      ? info.label
      : typeof info.deviceLabel === 'string' && info.deviceLabel.trim()
        ? info.deviceLabel
        : typeof info.device === 'string' && info.device.trim()
          ? info.device
          : clientType === 'flutter_app'
            ? 'SoftLogic Whiteboard app'
            : clientType === 'web_panel'
              ? 'SoftLogic web panel'
              : 'Unknown device';
  const platform =
    typeof info.platform === 'string' && info.platform.trim()
      ? info.platform
      : typeof info.os === 'string' && info.os.trim()
        ? info.os
        : clientType === 'flutter_app'
          ? 'App'
          : clientType === 'web_panel'
            ? 'Browser'
            : 'Unknown platform';
  return { label, platform };
}

function licenceStatusLabel(status?: string | null) {
  switch (status) {
    case 'ACTIVE':
      return 'Active';
    case 'NOT_STARTED':
      return 'Not started';
    case 'EXPIRED':
      return 'Expired';
    case 'NO_KEYS':
      return 'No activation keys';
    default:
      return 'None';
  }
}

export function SettingsPage() {
  const { startTour } = useTour();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, tokens, clear, updateUser } = useAuthStore();
  const org = user?.primaryOrganization ?? null;
  const orgLicense = user?.license ?? null;
  const showOrgCard = !!org && user?.role !== 'SUPER_ADMIN';
  const appVersion = __APP_VERSION__ ? `v${__APP_VERSION__}` : '';
  const [name, setName] = useState(user?.name ?? '');
  const [timezone, setTimezone] = useState(user?.timezone ?? 'UTC');
  const [language, setLanguage] = useState(user?.language ?? 'en');
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'profile' | 'security' | 'sessions' | 'storage'>('all');

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    watch: watchPassword,
    reset: resetPassword,
    formState: { errors: passwordErrors },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { newPassword: '', confirmNewPassword: '' },
  });

  const passwordMutation = useMutation({
    mutationFn: (values: PasswordFormValues) =>
      authApi.changePassword(values.newPassword),
    onSuccess: () => {
      toast.success('Password updated. Please sign in again.');
      resetPassword();
      clear();
      queryClient.clear();
      navigate('/login', { replace: true });
    },
    onError: (err) => toast.error(extractApiError(err)),
  });

  const sessionsQuery = useQuery({
    queryKey: ['auth', 'sessions'],
    queryFn: authApi.sessions,
  });

  const revokeSessionMutation = useMutation({
    mutationFn: authApi.revokeSession,
    onSuccess: () => {
      toast.success('Login session revoked');
      queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });
    },
    onError: (err) => toast.error(extractApiError(err)),
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not signed in');
      return usersApi.update(user.id, { name, timezone, language });
    },
    onSuccess: (data) => {
      if (user)
        updateUser({
          ...user,
          name: data.name,
          timezone: data.timezone,
          language: data.language,
        });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Profile updated');
    },
    onError: (err) => toast.error(extractApiError(err)),
  });

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      if (tokens?.refreshToken) {
        try {
          await authApi.logout(tokens.refreshToken);
        } catch {
          // Local session cleanup still happens if the server call fails.
        }
      }
      clear();
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
      setConfirmLogout(false);
    }
  };

  const activeSessionsCount = sessionsQuery.data?.length ?? 0;

  const personalProfileSection = (
    <Card className="overflow-hidden rounded-2xl border border-line/80 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/80 bg-gradient-to-r from-brand-primary/10 via-brand-primary/5 to-white px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-primary text-white shadow-sm">
            <User className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-ink-900">Personal profile</h2>
            <p className="text-xs text-ink-500">
              How your name and locale appear across the SoftLogic web panel
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-brand-primary/20 bg-brand-primary/5 px-2.5 py-0.5 text-[11px] font-bold text-brand-primary">
          <CheckCircle2 className="h-3 w-3" /> Profile Active
        </span>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="space-y-4 p-5"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-bold uppercase tracking-wider text-ink-500">
              Email Address
            </label>
            <Input
              value={user?.email ?? ''}
              readOnly
              disabled
              className="bg-slate-50 font-mono text-xs text-ink-700"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-bold uppercase tracking-wider text-ink-500">
              Display name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-sm font-semibold"
            />
          </div>
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-500">
              <Clock className="h-3.5 w-3.5 text-ink-400" />
              Timezone
            </label>
            <Input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="UTC"
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-500">
              <Globe className="h-3.5 w-3.5 text-ink-400" />
              Language
            </label>
            <Input
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="en"
              className="font-mono text-xs"
            />
          </div>
        </div>
        <div className="flex justify-end border-t border-line/60 pt-3">
          <Button
            type="submit"
            variant="primary"
            size="sm"
            className="h-9 px-4 font-bold shadow-sm"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save profile changes
              </>
            )}
          </Button>
        </div>
      </form>
    </Card>
  );

  const securitySection = (
    <Card className="overflow-hidden rounded-2xl border border-line/80 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/80 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-white px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 text-white shadow-sm">
            <KeyRound className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-ink-900">Security</h2>
            <p className="text-xs text-ink-500">
              Change the password you use to sign in to the SoftLogic web panel
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
          Encrypted Authentication
        </span>
      </div>
      <form
        onSubmit={handlePasswordSubmit((values) => passwordMutation.mutate(values))}
        className="space-y-4 p-5"
        noValidate
      >
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-ink-500">
            New password
          </label>
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              className="pr-10 text-sm"
              {...registerPassword('newPassword')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-400 transition hover:bg-surface-variant hover:text-ink-700"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {passwordErrors.newPassword && (
            <p className="text-xs text-danger">
              {passwordErrors.newPassword.message}
            </p>
          )}
          <PasswordRequirements password={watchPassword('newPassword')} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-ink-500">
            Confirm new password
          </label>
          <Input
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            className="text-sm"
            {...registerPassword('confirmNewPassword')}
          />
          {passwordErrors.confirmNewPassword && (
            <p className="text-xs text-danger">
              {passwordErrors.confirmNewPassword.message}
            </p>
          )}
        </div>
        <div className="flex justify-end border-t border-line/60 pt-3">
          <Button
            type="submit"
            variant="primary"
            size="sm"
            className="h-9 px-4 font-bold shadow-sm"
            disabled={passwordMutation.isPending}
          >
            {passwordMutation.isPending ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                Update password
              </>
            )}
          </Button>
        </div>
      </form>
    </Card>
  );

  const sessionsSection = (
    <Card className="overflow-hidden rounded-2xl border border-line/80 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/80 bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-white px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-sm">
            <Laptop className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-ink-900">
              Login sessions / Devices
            </h2>
            <p className="text-xs text-ink-500">
              Review where your account is signed in across the web panel and app
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-0.5 text-[11px] font-bold text-blue-800">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-600" />
          {activeSessionsCount} active {activeSessionsCount === 1 ? 'session' : 'sessions'}
        </span>
      </div>
      <div className="space-y-3 p-5">
        {sessionsQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-ink-500">
            <Spinner className="h-4 w-4 text-brand-primary" />
            Loading login sessions...
          </div>
        ) : sessionsQuery.isError ? (
          <p className="rounded-lg border border-dashed border-danger/40 bg-danger/5 px-3 py-3 text-sm text-danger">
            Unable to load login sessions. Refresh this page or sign in again
            to repair the current browser session.
          </p>
        ) : sessionsQuery.data?.length ? (
          sessionsQuery.data.map((session) => {
            const device = describeSessionDevice(session);
            return (
              <div
                key={session.id}
                className="flex flex-col gap-3 rounded-xl border border-line/80 bg-slate-50/70 p-3.5 transition-all hover:border-slate-300 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white border border-line text-brand-primary shadow-2xs">
                    {device.platform === 'App' ? (
                      <Smartphone className="h-4.5 w-4.5" />
                    ) : (
                      <Laptop className="h-4.5 w-4.5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-bold text-ink-900">
                        {device.label}
                      </p>
                      {session.isCurrent && (
                        <span className="rounded-full bg-emerald-500/10 border border-emerald-300 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          Current Device
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs font-medium text-ink-600">
                      {device.platform} · IP <span className="font-mono">{session.ipAddress ?? 'Unknown'}</span>
                    </p>
                    <p className="mt-1 text-[11px] leading-4 text-ink-400">
                      Signed in {formatDateTime(session.createdAt)}
                      {session.lastSeenAt
                        ? ` · Last seen ${formatDateTime(session.lastSeenAt)}`
                        : ''}
                    </p>
                  </div>
                </div>
                {session.isCurrent ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0 gap-1.5 rounded-lg border-slate-300 text-xs font-bold"
                    onClick={() => setConfirmLogout(true)}
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign out
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0 gap-1.5 rounded-lg border-danger/30 text-xs font-bold text-danger hover:bg-danger/10"
                    disabled={revokeSessionMutation.isPending}
                    onClick={() => revokeSessionMutation.mutate(session.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Revoke
                  </Button>
                )}
              </div>
            );
          })
        ) : (
          <p className="rounded-lg border border-dashed border-line px-3 py-3 text-sm text-ink-500">
            No active login sessions were found.
          </p>
        )}
      </div>
    </Card>
  );

  const organizationSection = showOrgCard && org ? (
    <Card className="overflow-hidden rounded-2xl border border-line/80 bg-white shadow-sm">
      <div className="border-b border-line/80 bg-gradient-to-r from-slate-100/80 to-white px-5 py-3.5">
        <h2 className="text-base font-bold text-ink-900">Organization details</h2>
        <p className="text-xs text-ink-500">
          Your workspace configuration. Managed by SoftLogic.
        </p>
      </div>
      <div className="space-y-4 p-5">
        <div className="flex items-center gap-3">
          {org.logoUrl ? (
            <img
              src={org.logoUrl}
              alt={org.name}
              className="h-10 w-10 rounded-lg object-contain"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
              <Building2 className="h-5 w-5" />
            </div>
          )}
          <div>
            <p className="text-sm font-bold text-ink-900">
              {org.brandName?.trim() || org.name}
            </p>
            <p className="text-xs text-ink-500">
              {ORG_KIND_LABEL[org.kind]} · {org.status === 'ACTIVE' ? 'Active' : 'Inactive'}
            </p>
          </div>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2">
          <ReadOnlyField label="Branding" value={BRANDING_MODE_LABEL[org.brandingMode]} />
          <ReadOnlyField label="Licence" value={licenceStatusLabel(orgLicense?.status)} />
          <ReadOnlyField label="Support email" value={org.supportEmail || '—'} />
          <ReadOnlyField label="Support phone" value={org.supportPhone || '—'} />
          <ReadOnlyField label="Storage" value={STORAGE_STATUS_LABEL[org.storageStatus]} />
          <ReadOnlyField
            label="Student / Parent login"
            value={`${org.studentLoginEnabled ? 'On' : 'Off'} / ${
              org.parentLoginEnabled ? 'On' : 'Off'
            }`}
          />
        </dl>
      </div>
    </Card>
  ) : null;

  return (
    <div className="space-y-6">
      {/* Top Executive Settings Hub Hero Banner */}
      <div data-tour="tour-settings" className="relative overflow-hidden rounded-2xl border border-line/80 bg-gradient-to-r from-[#08357C] via-[#0E4BA8] to-[#1A63D4] p-5 text-white shadow-md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14 rounded-2xl border-2 border-white/30 shadow-md">
              <AvatarImage src={user?.avatar ?? undefined} />
              <AvatarFallback className="bg-white/10 text-lg font-bold text-white">
                {initials(user?.name ?? user?.email)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-white sm:text-xl">
                  {user?.name || 'SoftLogic Administrator'}
                </h1>
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold text-white backdrop-blur-xs">
                  {user?.role ? ROLE_LABEL[user.role] : 'Administrator'}
                </span>
              </div>
              <p className="mt-0.5 font-mono text-xs text-blue-100">
                {user?.email}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-blue-100/90">
                <span className="inline-flex items-center gap-1">
                  <Globe className="h-3.5 w-3.5 opacity-80" /> {user?.timezone ?? 'UTC'} · {user?.language ?? 'en'}
                </span>
                {appVersion && (
                  <span className="rounded bg-black/20 px-2 py-0.5 font-mono text-[10px] font-bold text-blue-100">
                    {appVersion}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 rounded-xl border-white/30 bg-white/10 font-bold text-white backdrop-blur-xs hover:bg-white/20 hover:text-white"
              onClick={() => startTour()}
            >
              <Eye className="h-4 w-4" />
              Replay Tour
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 rounded-xl border-white/30 bg-white/10 font-bold text-white backdrop-blur-xs hover:bg-white/20 hover:text-white"
              onClick={() => setConfirmLogout(true)}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </div>

      {/* Settings Hub Category Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line/80 bg-white p-2 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
              activeTab === 'all'
                ? 'bg-brand-primary text-white shadow-sm'
                : 'text-ink-600 hover:bg-surface-variant hover:text-ink-900'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            All Hub Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
              activeTab === 'profile'
                ? 'bg-brand-primary text-white shadow-sm'
                : 'text-ink-600 hover:bg-surface-variant hover:text-ink-900'
            }`}
          >
            <User className="h-3.5 w-3.5" />
            Profile & Locale
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
              activeTab === 'security'
                ? 'bg-brand-primary text-white shadow-sm'
                : 'text-ink-600 hover:bg-surface-variant hover:text-ink-900'
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" />
            Security & Access
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sessions')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
              activeTab === 'sessions'
                ? 'bg-brand-primary text-white shadow-sm'
                : 'text-ink-600 hover:bg-surface-variant hover:text-ink-900'
            }`}
          >
            <Laptop className="h-3.5 w-3.5" />
            Sessions & QR Login
            <span className="rounded-full bg-blue-100 px-1.5 py-0.2 font-mono text-[10px] font-black text-blue-800">
              {activeSessionsCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('storage')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
              activeTab === 'storage'
                ? 'bg-brand-primary text-white shadow-sm'
                : 'text-ink-600 hover:bg-surface-variant hover:text-ink-900'
            }`}
          >
            <Cloud className="h-3.5 w-3.5" />
            Storage & Workspace
          </button>
        </div>
      </div>

      {/* Main Settings Content Area - High Density Balanced Grid */}
      {activeTab === 'all' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          {/* Left Column: Profile & Sessions */}
          <div className="space-y-6 xl:col-span-7">
            {personalProfileSection}
            {sessionsSection}
            {organizationSection}
          </div>
          {/* Right Column: Security, QR Login Scanner & Storage Integrations */}
          <div className="space-y-6 xl:col-span-5">
            {securitySection}
            <QrLoginScannerCard />
            <StorageIntegrationsCard />
          </div>
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">{personalProfileSection}</div>
          <div className="lg:col-span-5">{organizationSection}</div>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">{securitySection}</div>
          <div className="lg:col-span-5"><QrLoginScannerCard /></div>
        </div>
      )}

      {activeTab === 'sessions' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">{sessionsSection}</div>
          <div className="lg:col-span-5"><QrLoginScannerCard /></div>
        </div>
      )}

      {activeTab === 'storage' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8"><StorageIntegrationsCard /></div>
          <div className="lg:col-span-4">{organizationSection}</div>
        </div>
      )}

      <ConfirmationDialog
        open={confirmLogout}
        onOpenChange={setConfirmLogout}
        title="Sign out of SoftLogic web panel?"
        description="Your local session will be cleared on this device. You can sign back in with your account credentials."
        confirmLabel="Sign out"
        tone="warning"
        loading={loggingOut}
        onConfirm={handleLogout}
      />
    </div>
  );
}
