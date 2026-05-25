import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Building2, Save } from 'lucide-react';
import { toast } from 'sonner';

import { organizationsApi, type UpdateOrganizationPayload } from '@/services/organizations.api';
import { useAuthStore } from '@/lib/auth-store';
import { canCreateOrganizationKind } from '@/lib/role-access';
import { extractApiError } from '@/lib/api';
import type { OrganizationKind, OrganizationStatus } from '@/types/api';
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
  name: z.string().min(1, 'Name is required'),
  slug: z.string().optional(),
  kind: z.string().min(1),
  parentOrganizationId: z.string().optional(),
  status: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function OrganizationFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { user: actor } = useAuthStore();
  const queryClient = useQueryClient();
  const { allowedKinds } = canCreateOrganizationKind(actor?.role);

  const organizationQuery = useQuery({
    queryKey: ['organizations', id],
    queryFn: () => organizationsApi.get(id!),
    enabled: isEdit,
  });
  const orgsQuery = useQuery({
    queryKey: ['organizations', 'all'],
    queryFn: organizationsApi.all,
    enabled: actor?.role === 'SUPER_ADMIN',
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
      name: '',
      slug: '',
      kind: allowedKinds[0] ?? 'CUSTOMER',
      parentOrganizationId: 'NONE',
      status: 'ACTIVE',
    },
  });

  useEffect(() => {
    if (!organizationQuery.data) return;
    reset({
      name: organizationQuery.data.name,
      slug: organizationQuery.data.slug,
      kind: organizationQuery.data.kind,
      parentOrganizationId: organizationQuery.data.parentOrganizationId ?? 'NONE',
      status: organizationQuery.data.status,
    });
  }, [organizationQuery.data, reset]);

  const createMutation = useMutation({
    mutationFn: organizationsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      toast.success('Organization created');
      navigate('/organizations');
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ organizationId, payload }: { organizationId: string; payload: UpdateOrganizationPayload }) =>
      organizationsApi.update(organizationId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      toast.success('Organization updated');
      navigate('/organizations');
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const kind = watch('kind');
  const parentOrganizationId = watch('parentOrganizationId');
  const status = watch('status');
  const submitting = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (values: FormValues) => {
    if (isEdit && id) {
      updateMutation.mutate({
        organizationId: id,
        payload: {
          name: values.name,
          slug: values.slug,
          status: values.status as OrganizationStatus,
        },
      });
    } else {
      createMutation.mutate({
        name: values.name,
        slug: values.slug || undefined,
        kind: values.kind as OrganizationKind,
        parentOrganizationId:
          values.parentOrganizationId && values.parentOrganizationId !== 'NONE'
            ? values.parentOrganizationId
            : null,
      });
    }
  };

  if (isEdit && organizationQuery.isLoading) {
    return <div className="flex h-64 items-center justify-center"><Spinner className="h-7 w-7 text-brand-primary" /></div>;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button type="button" variant="ghost" size="sm" onClick={() => navigate('/organizations')}>
            <ArrowLeft className="h-4 w-4" />
            Organizations
          </Button>
          <h2 className="mt-2 text-2xl font-black text-ink-900">
            {isEdit ? 'Edit organization' : 'Create organization'}
          </h2>
          <p className="text-sm text-ink-500">
            Configure workspace identity, hierarchy, status, and operating context.
          </p>
        </div>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {isEdit ? 'Save changes' : 'Create organization'}
        </Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <Card className="space-y-5 px-6 py-5">
          <div>
            <h3 className="text-base font-bold text-ink-900">Organization Profile</h3>
            <p className="text-sm text-ink-500">Public admin identity and routing details.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Name</label>
              <Input placeholder="Acme Corp" {...register('name')} />
              {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Slug</label>
              <Input placeholder="acme-corp" {...register('slug')} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Kind</label>
              <Select disabled={isEdit} value={kind} onValueChange={(value) => setValue('kind', value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allowedKinds.map((allowedKind) => (
                    <SelectItem key={allowedKind} value={allowedKind}>{allowedKind}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Parent</label>
              <Select
                disabled={isEdit || actor?.role !== 'SUPER_ADMIN'}
                value={parentOrganizationId}
                onValueChange={(value) => setValue('parentOrganizationId', value)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">No parent</SelectItem>
                  {orgsQuery.data?.filter((org) => org.kind === 'PARTNER').map((org) => (
                    <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
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
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <Card className="space-y-4 px-6 py-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-orange/10 text-brand-orange">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-ink-900">Hierarchy Rules</h3>
            <p className="mt-1 text-sm leading-6 text-ink-500">
              Super admins can create internal, partner, and customer organizations. Partner admins create customer organizations under their own partner scope.
            </p>
          </div>
        </Card>
      </div>
    </form>
  );
}
