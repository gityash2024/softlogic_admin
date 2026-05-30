import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, Eye, EyeOff, LogOut, Save, ShieldCheck } from 'lucide-react';

import { useAuthStore } from '@/lib/auth-store';
import { usersApi } from '@/services/users.api';
import { authApi } from '@/services/auth.api';
import { extractApiError } from '@/lib/api';
import {
  BRANDING_MODE_LABEL,
  ORG_KIND_LABEL,
  ROLE_LABEL,
  STORAGE_STATUS_LABEL,
  SUBSCRIPTION_STATUS_LABEL,
} from '@/types/api';
import { PasswordRequirements } from '@/components/auth/PasswordRequirements';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { initials } from '@/lib/utils';

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z
      .string()
      .min(12, 'Password must be at least 12 characters')
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
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-ink-900">{value}</dd>
    </div>
  );
}

export function SettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, tokens, clear, updateUser } = useAuthStore();
  const org = user?.primaryOrganization ?? null;
  const orgSubscription = user?.subscription ?? null;
  const showOrgCard = !!org && user?.role !== 'SUPER_ADMIN';
  const [name, setName] = useState(user?.name ?? '');
  const [timezone, setTimezone] = useState(user?.timezone ?? 'UTC');
  const [language, setLanguage] = useState(user?.language ?? 'en');
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    watch: watchPassword,
    reset: resetPassword,
    formState: { errors: passwordErrors },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmNewPassword: '' },
  });

  const passwordMutation = useMutation({
    mutationFn: (values: PasswordFormValues) =>
      authApi.changePassword(values.currentPassword, values.newPassword),
    onSuccess: () => {
      toast.success('Password updated');
      resetPassword();
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

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr,320px]">
      <div className="space-y-5">
        <Card>
        <div className="border-b border-line px-6 py-5">
          <h2 className="text-lg font-semibold text-ink-900">Personal profile</h2>
          <p className="text-sm text-ink-500">
            How your name and locale appear across the admin panel
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="space-y-5 px-6 py-5"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              Email
            </label>
            <Input value={user?.email ?? ''} readOnly disabled />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              Display name
            </label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                Timezone
              </label>
              <Input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="UTC"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                Language
              </label>
              <Input
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="en"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save changes
                </>
              )}
            </Button>
          </div>
        </form>
      </Card>

        <Card>
          <div className="border-b border-line px-6 py-5">
            <h2 className="text-lg font-semibold text-ink-900">Security</h2>
            <p className="text-sm text-ink-500">
              Change the password you use to sign in to the admin panel
            </p>
          </div>
          <form
            onSubmit={handlePasswordSubmit((values) => passwordMutation.mutate(values))}
            className="space-y-5 px-6 py-5"
            noValidate
          >
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                Current password
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="pr-10"
                  {...registerPassword('currentPassword')}
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
              {passwordErrors.currentPassword && (
                <p className="text-xs text-danger">
                  {passwordErrors.currentPassword.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                New password
              </label>
              <Input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                {...registerPassword('newPassword')}
              />
              {passwordErrors.newPassword && (
                <p className="text-xs text-danger">
                  {passwordErrors.newPassword.message}
                </p>
              )}
              <PasswordRequirements password={watchPassword('newPassword')} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                Confirm new password
              </label>
              <Input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                {...registerPassword('confirmNewPassword')}
              />
              {passwordErrors.confirmNewPassword && (
                <p className="text-xs text-danger">
                  {passwordErrors.confirmNewPassword.message}
                </p>
              )}
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                variant="primary"
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

        {showOrgCard && org && (
          <Card>
            <div className="border-b border-line px-6 py-5">
              <h2 className="text-lg font-semibold text-ink-900">Organization</h2>
              <p className="text-sm text-ink-500">
                Your workspace details. These are managed by SoftLogic.
              </p>
            </div>
            <div className="space-y-5 px-6 py-5">
              <div className="flex items-center gap-3">
                {org.logoUrl ? (
                  <img
                    src={org.logoUrl}
                    alt={org.name}
                    className="h-12 w-12 rounded-lg object-contain"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
                    <Building2 className="h-6 w-6" />
                  </div>
                )}
                <div>
                  <p className="text-base font-bold text-ink-900">
                    {org.brandName?.trim() || org.name}
                  </p>
                  <p className="text-xs text-ink-500">
                    {ORG_KIND_LABEL[org.kind]} · {org.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                  </p>
                </div>
              </div>
              <dl className="grid gap-4 sm:grid-cols-2">
                <ReadOnlyField label="Branding" value={BRANDING_MODE_LABEL[org.brandingMode]} />
                <ReadOnlyField
                  label="Subscription"
                  value={
                    orgSubscription
                      ? SUBSCRIPTION_STATUS_LABEL[orgSubscription.status]
                      : 'None'
                  }
                />
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
              {org.brandingMode !== 'SOFTLOGIC' &&
                (org.brandPrimaryColor || org.brandAccentColor) && (
                  <div className="flex flex-wrap items-center gap-4">
                    {org.brandPrimaryColor && (
                      <div className="flex items-center gap-2">
                        <span
                          className="h-6 w-6 rounded border border-line"
                          style={{ backgroundColor: org.brandPrimaryColor }}
                        />
                        <span className="text-xs text-ink-600">Primary {org.brandPrimaryColor}</span>
                      </div>
                    )}
                    {org.brandAccentColor && (
                      <div className="flex items-center gap-2">
                        <span
                          className="h-6 w-6 rounded border border-line"
                          style={{ backgroundColor: org.brandAccentColor }}
                        />
                        <span className="text-xs text-ink-600">Accent {org.brandAccentColor}</span>
                      </div>
                    )}
                  </div>
                )}
              <p className="text-xs text-ink-500">
                Need a change? Contact your SoftLogic Super Admin or open a request from Help.
              </p>
            </div>
          </Card>
        )}
      </div>

      <Card>
        <div className="px-6 py-6">
          <div className="flex flex-col items-center text-center">
            <Avatar className="h-20 w-20">
              <AvatarImage src={user?.avatar ?? undefined} />
              <AvatarFallback className="text-xl">
                {initials(user?.name ?? user?.email)}
              </AvatarFallback>
            </Avatar>
            <p className="mt-3 text-base font-semibold text-ink-900">
              {user?.name}
            </p>
            <p className="text-xs text-ink-500">{user?.email}</p>
            <p className="mt-2 rounded-full bg-brand-primary/10 px-3 py-0.5 text-xs font-semibold text-brand-primary">
              {user?.role ? ROLE_LABEL[user.role] : '-'}
            </p>
          </div>
          <div className="mt-6 border-t border-line pt-5">
            <Button
              variant="outline"
              className="w-full text-danger"
              onClick={() => setConfirmLogout(true)}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </Card>
      <ConfirmationDialog
        open={confirmLogout}
        onOpenChange={setConfirmLogout}
        title="Sign out of admin console?"
        description="Your local session will be cleared on this device. You can sign back in with your administrator credentials."
        confirmLabel="Sign out"
        tone="warning"
        loading={loggingOut}
        onConfirm={handleLogout}
      />
    </div>
  );
}
