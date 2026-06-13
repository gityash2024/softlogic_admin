import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import { authApi } from '@/services/auth.api';
import { extractApiError } from '@/lib/api';
import { PasswordRequirements } from '@/components/auth/PasswordRequirements';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

const schema = z
  .object({
    password: z
      .string()
      .min(1, 'Password is required')
      .regex(/[A-Za-z]/, 'Include at least one letter')
      .regex(/[0-9]/, 'Include at least one number'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

type FormValues = z.infer<typeof schema>;

export function SetupPasswordScreen() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // Capture the token (and mode) on first render so the in-flight query and the
  // submit mutation keep working even after we strip them from the address bar.
  const tokenRef = useRef(searchParams.get('token')?.trim() ?? '');
  const token = tokenRef.current;
  const modeFromUrlRef = useRef(searchParams.get('mode') === 'reset');
  const [showPassword, setShowPassword] = useState(false);
  const strippedRef = useRef(false);

  const tokenQuery = useQuery({
    queryKey: ['password-setup', token],
    queryFn: () => authApi.validatePasswordSetup(token),
    enabled: Boolean(token),
    retry: false,
  });

  // Prefer the backend signal; fall back to the original ?mode= query param.
  const isReset = tokenQuery.data?.hasPassword ?? modeFromUrlRef.current;

  // Once the token is validated, remove token/mode from the URL exactly once.
  // The query already holds the token in its closure + queryKey, so clearing the
  // address bar neither re-triggers nor breaks it, and the mutation uses tokenRef.
  useEffect(() => {
    if (tokenQuery.isSuccess && !strippedRef.current) {
      strippedRef.current = true;
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [tokenQuery.isSuccess]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const setupMutation = useMutation({
    mutationFn: (values: FormValues) =>
      authApi.completePasswordSetup(token, values.password),
    onSuccess: () => {
      toast.success(
        isReset
          ? 'Password reset. Sign in with your new password.'
          : 'Password set. You can sign in now.',
      );
      navigate('/login', { replace: true });
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const copy = isReset
    ? {
        eyebrow: 'Reset Password',
        heading: 'Reset your password',
        loadingHint: 'Checking your reset link...',
        readyHint: (email: string) => `Choose a new password for ${email}.`,
        errorHint: 'This reset link could not be verified.',
        submit: 'Reset password',
      }
    : {
        eyebrow: 'Account Setup',
        heading: 'Set your password',
        loadingHint: 'Checking your setup link...',
        readyHint: (email: string) => `Complete setup for ${email}.`,
        errorHint: 'This setup link could not be verified.',
        submit: 'Save password',
      };

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB] px-4 py-8">
      <main className="w-full max-w-[520px] rounded-lg border border-line bg-white px-5 py-7 shadow-xl sm:px-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-primary">
              {copy.eyebrow}
            </p>
            <h1 className="mt-3 text-3xl font-black text-ink-900">
              {copy.heading}
            </h1>
            <p className="mt-2 text-sm leading-6 text-ink-500">
              {tokenQuery.isLoading
                ? copy.loadingHint
                : tokenQuery.data
                  ? copy.readyHint(tokenQuery.data.email)
                  : copy.errorHint}
            </p>

            {tokenQuery.isLoading ? (
              <div className="mt-8 flex items-center gap-3 rounded-lg border border-line bg-surface-variant px-4 py-3 text-sm text-ink-600">
                <Spinner className="h-4 w-4 text-brand-primary" />
                {isReset ? 'Validating reset link' : 'Validating setup link'}
              </div>
            ) : tokenQuery.isError ? (
              <div className="mt-8 rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm leading-6 text-danger">
                {extractApiError(tokenQuery.error)}
                <div className="mt-3">
                  <Link className="font-semibold underline" to="/login">
                    Return to sign in
                  </Link>
                </div>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit((values) => setupMutation.mutate(values))}
                className="mt-7 space-y-5"
                noValidate
              >
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wide text-ink-500">
                    Password
                  </label>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      className="h-12 rounded-lg bg-[#F7F9FC] pl-10 pr-10"
                      {...register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-400 transition hover:bg-white hover:text-ink-700"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-xs text-danger">{errors.password.message}</p>
                  )}
                  <PasswordRequirements password={watch('password')} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wide text-ink-500">
                    Confirm password
                  </label>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    className="h-12 rounded-lg bg-[#F7F9FC]"
                    {...register('confirmPassword')}
                  />
                  {errors.confirmPassword && (
                    <p className="text-xs text-danger">{errors.confirmPassword.message}</p>
                  )}
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  size="xl"
                  className="h-12 w-full justify-between rounded-lg px-5"
                  disabled={setupMutation.isPending}
                >
                  <span className="flex items-center gap-2">
                    {setupMutation.isPending ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      <ShieldCheck className="h-4 w-4" />
                    )}
                    {copy.submit}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
            )}
      </main>
    </div>
  );
}
