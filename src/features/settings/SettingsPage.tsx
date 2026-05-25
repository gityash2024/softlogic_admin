import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { LogOut, Save } from 'lucide-react';

import { useAuthStore } from '@/lib/auth-store';
import { usersApi } from '@/services/users.api';
import { authApi } from '@/services/auth.api';
import { extractApiError } from '@/lib/api';
import { ROLE_LABEL } from '@/types/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { initials } from '@/lib/utils';

export function SettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, tokens, clear, updateUser } = useAuthStore();
  const [name, setName] = useState(user?.name ?? '');
  const [timezone, setTimezone] = useState(user?.timezone ?? 'UTC');
  const [language, setLanguage] = useState(user?.language ?? 'en');
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

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
