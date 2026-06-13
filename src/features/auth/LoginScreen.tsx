import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import { authApi } from '@/services/auth.api';
import { useAuthStore } from '@/lib/auth-store';
import { extractApiError } from '@/lib/api';
import { isAdminRole } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type FormValues = z.infer<typeof schema>;

export function LoginScreen() {
  const navigate = useNavigate();
  const { user, setSession } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  if (user) {
    return <Navigate to={isAdminRole(user.role) ? '/dashboard' : '/portal'} replace />;
  }

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      let result;
      try {
        result = await authApi.adminLogin(values.email, values.password);
      } catch {
        result = await authApi.portalLogin(values.email, values.password);
      }
      setSession(result);
      toast.success(`Welcome, ${result.user.name ?? result.user.email}`);
      navigate(isAdminRole(result.user.role) ? '/dashboard' : '/portal', { replace: true });
    } catch (error) {
      toast.error(extractApiError(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB] px-4 py-8">
      <main className="w-full max-w-[430px] rounded-lg border border-line bg-white px-5 py-7 shadow-xl sm:px-8">
        <div className="mb-7">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-primary">
            Secure portal
          </p>
          <h1 className="mt-3 text-3xl font-black text-ink-900">Sign in</h1>
          <p className="mt-2 text-sm leading-6 text-ink-500">
            Use your account email and password to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <div className="space-y-2">
            <label htmlFor="email" className="text-xs font-bold uppercase tracking-wide text-ink-500">
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <Input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="you@example.com"
                className="h-12 rounded-lg bg-[#F7F9FC] pl-10"
                {...register('email')}
              />
            </div>
            {errors.email && <p className="text-xs text-danger">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-xs font-bold uppercase tracking-wide text-ink-500">
              Password
            </label>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter password"
                className="h-12 rounded-lg bg-[#F7F9FC] pl-10 pr-10"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-400 transition hover:bg-white hover:text-ink-700"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-danger">{errors.password.message}</p>}
            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-xs font-semibold text-brand-primary hover:underline">
                Forgot password?
              </Link>
            </div>
          </div>

          <Button type="submit" variant="primary" size="xl" className="h-12 w-full justify-between rounded-lg px-5" disabled={submitting}>
            <span className="flex items-center gap-2">
              {submitting ? <Spinner className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
              Sign in
            </span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      </main>
    </div>
  );
}
