import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  QrCode,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

import { authApi } from '@/services/auth.api';
import { useAuthStore } from '@/lib/auth-store';
import { extractApiError } from '@/lib/api';
import { loginAttemptLockout, type LoginAttemptDecision } from '@/lib/login-attempt-lockout';
import { isAdminRole } from '@/types/api';
import { BlueprintBackdrop } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import appIcon from '@/assets/brand/ai-smart-board-app-icon.png';
import signinVisual from '@/assets/brand/signin-panel-main-visual.png';
import { QrLoginPanel } from './QrLoginPanel';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type FormValues = z.infer<typeof schema>;

function lockoutMessage(decision: Exclude<LoginAttemptDecision, { allowed: true }>) {
  const remaining = loginAttemptLockout.formatRemaining(decision.remainingMs);
  return decision.finalBlock
    ? `Login blocked on this device. Try again in ${remaining}.`
    : `Too many failed login attempts. Please wait ${remaining} before trying again.`;
}

export function LoginScreen() {
  const navigate = useNavigate();
  const { user, setSession } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<'password' | 'qr'>('password');

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
    const email = values.email.trim().toLowerCase();
    const decision = loginAttemptLockout.canAttempt(email);
    if (!decision.allowed) {
      toast.error(lockoutMessage(decision));
      return;
    }

    setSubmitting(true);
    try {
      let result;
      try {
        result = await authApi.adminLogin(values.email, values.password);
      } catch {
        result = await authApi.portalLogin(values.email, values.password);
      }
      loginAttemptLockout.recordSuccess(email);
      setSession(result);
      toast.success(`Welcome, ${result.user.name ?? result.user.email}`);
      navigate(isAdminRole(result.user.role) ? '/dashboard' : '/portal', { replace: true });
    } catch (error) {
      const failure = loginAttemptLockout.recordFailure(email);
      toast.error(
        failure.locked
          ? lockoutMessage({
              allowed: false,
              remainingMs: failure.remainingMs,
              finalBlock: failure.finalBlock,
            })
          : extractApiError(error),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleQrCompleted = (result: Awaited<ReturnType<typeof authApi.adminLogin>>) => {
    setSession(result);
    toast.success(`Welcome, ${result.user.name ?? result.user.email}`);
    navigate(isAdminRole(result.user.role) ? '/dashboard' : '/portal', { replace: true });
  };

  return (
    <div className="h-screen overflow-hidden bg-[#F5F7FB] p-3 sm:p-4">
      <div className="grid h-full min-h-0 overflow-hidden rounded-[28px] border border-line bg-white shadow-2xl lg:grid-cols-[1.08fr_0.92fr]">
        <aside className="relative hidden overflow-hidden bg-brand-navy px-8 py-8 text-white lg:flex lg:flex-col">
          <BlueprintBackdrop />
          <div className="relative z-10 h-9" aria-hidden="true" />

          <div className="relative z-10 mt-14 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-4 py-2 text-xs font-semibold uppercase text-white/75">
              <Sparkles className="h-4 w-4 text-brand-orange" />
              Workspace operations
            </div>
            <h1 className="mt-6 max-w-xl text-5xl font-black leading-[1.02] text-white">
              Turn admin work into command-center clarity.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-white/72">
              Manage organizations, seats, licences, AI settings, and audit
              trails through one polished administrative workspace.
            </p>
          </div>

          <div className="relative z-10 mt-5 flex min-h-0 flex-1 items-end justify-start pl-8">
            <img
              src={signinVisual}
              alt="Administrative workspace preview"
              className="pointer-events-none max-h-[28vh] w-[46%] max-w-[430px] object-contain opacity-95"
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
              <div className="mb-6 inline-flex h-9 lg:hidden">
                <img
                  src={appIcon}
                  alt="App icon"
                  className="h-9 w-9 rounded-xl object-contain shadow-md"
                />
              </div>
              <div className="hidden lg:mb-7 lg:flex">
                <img
                  src={appIcon}
                  alt="App icon"
                  className="h-14 w-14 rounded-2xl object-contain shadow-lg"
                />
              </div>
              <h2 className="mt-3 text-3xl font-black text-ink-900">
                Sign in securely
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink-500">
                Use your account email and password or scan a secure QR code.
              </p>
            </div>

            <div className="mb-5 grid grid-cols-2 rounded-lg bg-[#F7F9FC] p-1">
              <button
                type="button"
                onClick={() => setMode('password')}
                className={`flex h-10 items-center justify-center gap-2 rounded-md text-sm font-semibold transition ${
                  mode === 'password'
                    ? 'bg-white text-brand-primary shadow-sm'
                    : 'text-ink-500 hover:text-ink-800'
                }`}
              >
                <ShieldCheck className="h-4 w-4" />
                Password
              </button>
              <button
                type="button"
                onClick={() => setMode('qr')}
                className={`flex h-10 items-center justify-center gap-2 rounded-md text-sm font-semibold transition ${
                  mode === 'qr'
                    ? 'bg-white text-brand-primary shadow-sm'
                    : 'text-ink-500 hover:text-ink-800'
                }`}
              >
                <QrCode className="h-4 w-4" />
                QR Login
              </button>
            </div>

            {mode === 'qr' ? (
              <QrLoginPanel onCompleted={handleQrCompleted} />
            ) : (
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
                    placeholder="you@example.com"
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-400 transition hover:bg-white hover:text-ink-700"
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
                <div className="flex justify-end">
                  <Link
                    to="/forgot-password"
                    className="text-xs font-semibold text-brand-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="xl"
                className="h-12 w-full justify-between rounded-lg px-5"
                disabled={submitting}
              >
                <span className="flex items-center gap-2">
                  {submitting ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                  Sign in
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
