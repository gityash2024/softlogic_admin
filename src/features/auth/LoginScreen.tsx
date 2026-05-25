import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

import { authApi } from '@/services/auth.api';
import { useAuthStore } from '@/lib/auth-store';
import { extractApiError } from '@/lib/api';
import { isAdminRole } from '@/types/api';
import { BlueprintBackdrop, Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import appIcon from '@/assets/brand/app-icon.png';
import signinVisual from '@/assets/brand/signin-panel-main-visual.png';

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

  if (user && isAdminRole(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const result = await authApi.adminLogin(values.email, values.password);
      if (!isAdminRole(result.user.role)) {
        toast.error('Your account does not have admin access.');
        return;
      }
      setSession(result);
      toast.success(`Welcome, ${result.user.name ?? result.user.email}`);
      navigate('/dashboard', { replace: true });
    } catch (error) {
      toast.error(extractApiError(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FB] p-3 sm:p-4">
      <div className="grid min-h-[calc(100vh-24px)] overflow-hidden rounded-[28px] border border-line bg-white shadow-2xl lg:grid-cols-[1.08fr_0.92fr]">
        <aside className="relative hidden overflow-hidden bg-brand-navy px-8 py-8 text-white lg:flex lg:flex-col">
          <BlueprintBackdrop />
          <div className="relative z-10 flex items-center">
            <Logo variant="light" />
          </div>

          <div className="relative z-10 mt-14 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-4 py-2 text-xs font-semibold uppercase text-white/75">
              <Sparkles className="h-4 w-4 text-brand-orange" />
              SoftLogic operations
            </div>
            <h1 className="mt-6 max-w-xl text-5xl font-black leading-[1.02] text-white">
              Turn admin work into command-center clarity.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-white/72">
              Manage organizations, seats, licenses, AI settings, and audit
              trails with the same polished SoftLogic experience as the app.
            </p>
          </div>

          <div className="relative z-10 mt-8 flex min-h-0 flex-1 items-end justify-end">
            <img
              src={signinVisual}
              alt="SoftLogic whiteboard preview"
              className="pointer-events-none max-h-[38vh] w-[58%] max-w-[560px] object-contain opacity-95"
            />
          </div>

          <div className="relative z-10 mt-5 grid grid-cols-3 gap-3">
            {[
              ['Role secured', 'JWT + RBAC'],
              ['Live data', 'Scoped metrics'],
              ['Production ready', 'Audit aware'],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-lg border border-white/10 bg-white/10 px-4 py-3"
              >
                <p className="text-xs text-white/55">{label}</p>
                <p className="mt-1 text-sm font-semibold text-white">{value}</p>
              </div>
            ))}
          </div>
        </aside>

        <main className="flex items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
          <div className="w-full max-w-[430px]">
            <div className="mb-9 text-center lg:text-left">
              <div className="mb-6 inline-flex items-center gap-3 lg:hidden">
                <Logo />
              </div>
              <div className="hidden lg:mb-7 lg:flex">
                <img
                  src={appIcon}
                  alt="SoftLogic app icon"
                  className="h-14 w-14 rounded-2xl shadow-lg"
                />
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-primary">
                Admin Console
              </p>
              <h2 className="mt-3 text-3xl font-black text-ink-900">
                Sign in securely
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink-500">
                Administrator credentials are required to open this workspace.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="text-xs font-bold uppercase tracking-wide text-ink-500"
                >
                  Email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="username"
                    placeholder="admin@softlogicwhiteboard.com"
                    className="h-12 rounded-lg bg-[#F7F9FC] pl-10"
                    {...register('email')}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-danger">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="text-xs font-bold uppercase tracking-wide text-ink-500"
                >
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
                    className="absolute right-3 top-1/2 rounded-md p-1 -translate-y-1/2 text-ink-400 transition hover:bg-white hover:text-ink-700"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-danger">{errors.password.message}</p>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                size="xl"
                className="h-12 w-full justify-between rounded-lg px-5"
                disabled={submitting}
              >
                <span className="flex items-center gap-2">
                  {submitting ? <Spinner className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                  Sign in
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>

            <div className="mt-7 rounded-lg border border-line bg-surface-variant px-4 py-3 text-xs leading-5 text-ink-500">
              Access is restricted to SoftLogic administrator roles. Contact a
              workspace owner if your account needs elevated permissions.
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
