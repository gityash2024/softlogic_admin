import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import { usersApi, type UpdateUserPayload } from '@/services/users.api';
import { organizationsApi } from '@/services/organizations.api';
import { useAuthStore } from '@/lib/auth-store';
import { manageableRoles } from '@/lib/role-access';
import { extractApiError } from '@/lib/api';
import { ROLE_LABEL, type UserRole } from '@/types/api';
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
  email: z.string().email('Enter a valid email'),
  name: z.string().min(1, 'Name is required'),
  role: z.string().min(1, 'Role is required'),
  organizationId: z.string().optional(),
  status: z.string().optional(),
  timezone: z.string().optional(),
  language: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function UserFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { user: actor } = useAuthStore();
  const queryClient = useQueryClient();
  const allowedRoles = manageableRoles(actor?.role);

  const userQuery = useQuery({
    queryKey: ['users', id],
    queryFn: () => usersApi.get(id!),
    enabled: isEdit,
  });
  const orgsQuery = useQuery({
    queryKey: ['organizations', 'all'],
    queryFn: organizationsApi.all,
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
      email: '',
      name: '',
      role: 'STUDENT',
      organizationId: 'NONE',
      status: 'ACTIVE',
      timezone: 'UTC',
      language: 'en',
    },
  });

  useEffect(() => {
    if (!userQuery.data) return;
    reset({
      email: userQuery.data.email,
      name: userQuery.data.name ?? '',
      role: userQuery.data.role,
      organizationId: userQuery.data.primaryOrganizationId ?? 'NONE',
      status: userQuery.data.status,
      timezone: userQuery.data.timezone,
      language: userQuery.data.language,
    });
  }, [reset, userQuery.data]);

  const createMutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      toast.success('User created');
      navigate('/users');
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: UpdateUserPayload }) =>
      usersApi.update(userId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      toast.success('User updated');
      navigate('/users');
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const submitting = createMutation.isPending || updateMutation.isPending;
  const role = watch('role');
  const organizationId = watch('organizationId');
  const status = watch('status');

  const onSubmit = (values: FormValues) => {
    const payload = {
      email: values.email,
      name: values.name,
      role: values.role as UserRole,
      status: values.status as 'ACTIVE' | 'DISABLED',
      organizationId:
        values.organizationId && values.organizationId !== 'NONE'
          ? values.organizationId
          : null,
      timezone: values.timezone || 'UTC',
      language: values.language || 'en',
    };
    if (isEdit && id) {
      updateMutation.mutate({
        userId: id,
        payload: {
          name: payload.name,
          role: payload.role,
          status: payload.status,
          organizationId: payload.organizationId,
          timezone: payload.timezone,
          language: payload.language,
        },
      });
    } else {
      createMutation.mutate(payload);
    }
  };

  if (isEdit && userQuery.isLoading) {
    return <div className="flex h-64 items-center justify-center"><Spinner className="h-7 w-7 text-brand-primary" /></div>;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button type="button" variant="ghost" size="sm" onClick={() => navigate('/users')}>
            <ArrowLeft className="h-4 w-4" />
            Users
          </Button>
          <h2 className="mt-2 text-2xl font-black text-ink-900">
            {isEdit ? 'Edit user' : 'Create user'}
          </h2>
          <p className="text-sm text-ink-500">
            Manage identity, access level, workspace assignment, and locale.
          </p>
        </div>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {isEdit ? 'Save changes' : 'Create user'}
        </Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <Card className="space-y-5 px-6 py-5">
          <div>
            <h3 className="text-base font-bold text-ink-900">Profile</h3>
            <p className="text-sm text-ink-500">Core account details used for admin access.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Email</label>
              <Input type="email" disabled={isEdit} placeholder="jane@example.com" {...register('email')} />
              {errors.email && <p className="text-xs text-danger">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Full name</label>
              <Input placeholder="Jane Doe" {...register('name')} />
              {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Role</label>
              <Select value={role} onValueChange={(value) => setValue('role', value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allowedRoles.map((allowedRole) => (
                    <SelectItem key={allowedRole} value={allowedRole}>{ROLE_LABEL[allowedRole]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Status</label>
              <Select value={status} onValueChange={(value) => setValue('status', value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="DISABLED">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Organization</label>
              <Select value={organizationId} onValueChange={(value) => setValue('organizationId', value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Unassigned</SelectItem>
                  {orgsQuery.data?.map((org) => (
                    <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <Card className="space-y-4 px-6 py-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-ink-900">Access Context</h3>
            <p className="mt-1 text-sm leading-6 text-ink-500">
              Role controls admin capabilities. Organization assignment scopes dashboards, exports, and operational access.
            </p>
          </div>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Timezone</label>
              <Input placeholder="UTC" {...register('timezone')} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Language</label>
              <Input placeholder="en" {...register('language')} />
            </div>
          </div>
        </Card>
      </div>
    </form>
  );
}
