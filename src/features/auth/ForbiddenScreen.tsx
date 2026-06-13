import { useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';

export function ForbiddenScreen() {
  const navigate = useNavigate();
  const { clear, user } = useAuthStore();

  const handleLogout = () => {
    clear();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 h-9" aria-hidden="true" />
        <div className="rounded-xl border border-line bg-white p-8 shadow-card">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-danger/10">
            <ShieldAlert className="h-7 w-7 text-danger" />
          </div>
          <h1 className="text-2xl font-bold text-ink-900">Access Denied</h1>
          <p className="mt-2 text-sm text-ink-500">
            {user?.email
              ? `${user.email} is signed in, but this account does not have permission to use the admin panel.`
              : 'This account does not have permission to use the admin panel.'}
          </p>
          <div className="mt-6">
            <Button variant="primary" onClick={handleLogout} className="w-full">
              Sign in with a different account
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
