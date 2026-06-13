import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Mail, RefreshCw, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

const RESEND_COOLDOWN_SECONDS = 60;

import { authApi } from '@/services/auth.api';
import { extractApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

const schema = z.object({
  email: z.string().trim().email('Enter a valid email'),
});

type FormValues = z.infer<typeof schema>;

export function ForgotPasswordScreen() {
  const [sentEmail, setSentEmail] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  const requestMutation = useMutation({
    mutationFn: (values: FormValues) => authApi.requestPasswordReset(values.email),
    onSuccess: (_, values) => {
      setSentEmail(values.email);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      toast.success('Reset link sent if the email is registered.');
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  // Tick the resend cooldown down to zero once the success card is shown.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((value) => (value <= 1 ? 0 : value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const handleResend = () => {
    if (cooldown > 0 || !sentEmail || requestMutation.isPending) return;
    requestMutation.mutate({ email: sentEmail });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB] px-4 py-8">
      <main className="w-full max-w-[520px] rounded-lg border border-line bg-white px-5 py-7 shadow-xl sm:px-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-primary">
              Forgot password
            </p>
            <h1 className="mt-3 text-3xl font-black text-ink-900">
              Reset your password
            </h1>
            <p className="mt-2 text-sm leading-6 text-ink-500">
              {sentEmail
                ? `If an admin account exists for ${sentEmail}, a reset link has been sent. Check your inbox.`
                : 'Enter your admin email and we will send you a secure link to set a new password.'}
            </p>

            {sentEmail ? (
              <div className="mt-7 space-y-4">
                <div className="rounded-lg border border-success/20 bg-success/5 px-4 py-3 text-sm leading-6 text-success-foreground">
                  Reset email sent. The link expires in 24 hours.
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full rounded-lg"
                  onClick={handleResend}
                  disabled={cooldown > 0 || requestMutation.isPending}
                >
                  {requestMutation.isPending ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend link'}
                </Button>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-brand-primary hover:underline"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to sign in
                </Link>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit((values) => requestMutation.mutate(values))}
                className="mt-7 space-y-5"
                noValidate
              >
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wide text-ink-500">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      className="h-12 rounded-lg bg-[#F7F9FC] pl-10"
                      {...register('email')}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-xs text-danger">{errors.email.message}</p>
                  )}
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  size="xl"
                  className="h-12 w-full justify-between rounded-lg px-5"
                  disabled={requestMutation.isPending}
                >
                  <span className="flex items-center gap-2">
                    {requestMutation.isPending ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      <ShieldCheck className="h-4 w-4" />
                    )}
                    Send reset link
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-brand-primary hover:underline"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to sign in
                </Link>
              </form>
            )}
      </main>
    </div>
  );
}
