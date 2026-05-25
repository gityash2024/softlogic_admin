import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CreditCard, Save } from 'lucide-react';
import { toast } from 'sonner';

import { subscriptionsApi, type UpdateSubscriptionPayload } from '@/services/subscriptions.api';
import { organizationsApi } from '@/services/organizations.api';
import { usersApi } from '@/services/users.api';
import { extractApiError } from '@/lib/api';
import type { SubscriptionStatus } from '@/types/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const schema = z.object({
  scope: z.enum(['organization', 'user']),
  organizationId: z.string().optional(),
  userId: z.string().optional(),
  planName: z.string().min(1, 'Plan is required'),
  status: z.string(),
  seatLimit: z.number().int().min(1),
  seatUsage: z.number().int().min(0),
  startDate: z.string().min(1, 'Start date required'),
  endDate: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function toInputDate(value: string | null | undefined) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

export function SubscriptionFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const queryClient = useQueryClient();

  const subscriptionQuery = useQuery({
    queryKey: ['subscriptions', id],
    queryFn: () => subscriptionsApi.get(id!),
    enabled: isEdit,
  });
  const orgsQuery = useQuery({
    queryKey: ['organizations', 'all'],
    queryFn: organizationsApi.all,
  });
  const usersQuery = useQuery({
    queryKey: ['users', 'all'],
    queryFn: usersApi.all,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      scope: 'organization',
      organizationId: 'NONE',
      userId: 'NONE',
      planName: '',
      status: 'ACTIVE',
      seatLimit: 1,
      seatUsage: 0,
      startDate: toInputDate(new Date().toISOString()),
      endDate: '',
    },
  });

  useEffect(() => {
    if (!subscriptionQuery.data) return;
    reset({
      scope: subscriptionQuery.data.organizationId ? 'organization' : 'user',
      organizationId: subscriptionQuery.data.organizationId ?? 'NONE',
      userId: subscriptionQuery.data.userId ?? 'NONE',
      planName: subscriptionQuery.data.planName,
      status: subscriptionQuery.data.status,
      seatLimit: subscriptionQuery.data.seatLimit,
      seatUsage: subscriptionQuery.data.seatUsage,
      startDate: toInputDate(subscriptionQuery.data.startDate),
      endDate: toInputDate(subscriptionQuery.data.endDate),
    });
  }, [reset, subscriptionQuery.data]);

  const createMutation = useMutation({
    mutationFn: subscriptionsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      toast.success('Subscription created');
      navigate('/subscriptions');
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ subscriptionId, payload }: { subscriptionId: string; payload: UpdateSubscriptionPayload }) =>
      subscriptionsApi.update(subscriptionId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      toast.success('Subscription updated');
      navigate('/subscriptions');
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const scope = watch('scope');
  const organizationId = watch('organizationId');
  const userId = watch('userId');
  const status = watch('status');
  const submitting = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (values: FormValues) => {
    const startISO = new Date(values.startDate).toISOString();
    const endISO = values.endDate ? new Date(values.endDate).toISOString() : null;
    if (isEdit && id) {
      updateMutation.mutate({
        subscriptionId: id,
        payload: {
          planName: values.planName,
          status: values.status as SubscriptionStatus,
          seatLimit: values.seatLimit,
          seatUsage: values.seatUsage,
          startDate: startISO,
          endDate: endISO,
        },
      });
    } else {
      createMutation.mutate({
        organizationId:
          values.scope === 'organization' && values.organizationId !== 'NONE'
            ? values.organizationId
            : null,
        userId:
          values.scope === 'user' && values.userId !== 'NONE' ? values.userId : null,
        planName: values.planName,
        status: values.status as SubscriptionStatus,
        seatLimit: values.seatLimit,
        seatUsage: values.seatUsage,
        startDate: startISO,
        endDate: endISO,
      });
    }
  };

  if (isEdit && subscriptionQuery.isLoading) {
    return <div className="flex h-64 items-center justify-center"><Spinner className="h-7 w-7 text-brand-primary" /></div>;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button type="button" variant="ghost" size="sm" onClick={() => navigate('/subscriptions')}>
            <ArrowLeft className="h-4 w-4" />
            Subscriptions
          </Button>
          <h2 className="mt-2 text-2xl font-black text-ink-900">
            {isEdit ? 'Edit subscription' : 'Create subscription'}
          </h2>
          <p className="text-sm text-ink-500">
            Manage plan state, owner scope, seats, and subscription term.
          </p>
        </div>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {isEdit ? 'Save changes' : 'Create subscription'}
        </Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <Card className="space-y-5 px-6 py-5">
          <div>
            <h3 className="text-base font-bold text-ink-900">Subscription Details</h3>
            <p className="text-sm text-ink-500">Billing and access allocation metadata.</p>
          </div>
          {!isEdit && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Scope</label>
                <Select value={scope} onValueChange={(value) => setValue('scope', value as 'organization' | 'user')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="organization">Organization</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                  {scope === 'organization' ? 'Organization' : 'User'}
                </label>
                {scope === 'organization' ? (
                  <Select value={organizationId} onValueChange={(value) => setValue('organizationId', value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Select organization</SelectItem>
                      {orgsQuery.data?.map((org) => (
                        <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select value={userId} onValueChange={(value) => setValue('userId', value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Select user</SelectItem>
                      {usersQuery.data?.map((user) => (
                        <SelectItem key={user.id} value={user.id}>{user.name ?? user.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Plan name</label>
              <Input placeholder="Enterprise" {...register('planName')} />
              {errors.planName && <p className="text-xs text-danger">{errors.planName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Status</label>
              <Select value={status} onValueChange={(value) => setValue('status', value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="TRIAL">Trial</SelectItem>
                  <SelectItem value="EXPIRED">Expired</SelectItem>
                  <SelectItem value="CANCELED">Canceled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Seat limit</label>
              <Input type="number" min={1} {...register('seatLimit', { valueAsNumber: true })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Seat usage</label>
              <Input type="number" min={0} {...register('seatUsage', { valueAsNumber: true })} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Start date</label>
              <Input type="date" {...register('startDate')} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">End date</label>
              <Input type="date" {...register('endDate')} />
            </div>
          </div>
        </Card>

        <Card className="space-y-4 px-6 py-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-ink-900">Seat Allocation</h3>
            <p className="mt-1 text-sm leading-6 text-ink-500">
              Seat usage should never exceed the limit. Status changes affect reporting and admin visibility.
            </p>
          </div>
        </Card>
      </div>
    </form>
  );
}
