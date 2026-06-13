import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import { isAdminRole } from '@/types/api';
import { Spinner } from '@/components/ui/spinner';

export function SplashScreen() {
  const navigate = useNavigate();
  const { user, hydrated } = useAuthStore();

  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      if (user) {
        navigate(isAdminRole(user.role) ? '/dashboard' : '/portal', { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [hydrated, user, navigate]);

  return (
    <div className="relative flex min-h-screen w-screen items-center justify-center overflow-hidden bg-slate-950 text-white">
      <div className="relative z-10 flex w-full max-w-xl flex-col items-center px-6 text-center">
        <div className="mb-7 flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-white/10 shadow-2xl">
          <ShieldCheck className="h-10 w-10 text-white" />
        </div>
        <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-4 py-2 text-xs font-semibold uppercase text-white/75">
          <ShieldCheck className="h-4 w-4 text-white/80" />
          Secure workspace
        </div>
        <h1 className="mt-5 text-3xl font-bold text-white sm:text-4xl">
          Role Portal
        </h1>
        <p className="mt-3 max-w-md text-sm leading-6 text-white/70">
          Preparing role-scoped boards, sessions, downloads, and controls.
        </p>
        <Spinner className="mt-8 h-6 w-6 text-white/80" />
      </div>
    </div>
  );
}
