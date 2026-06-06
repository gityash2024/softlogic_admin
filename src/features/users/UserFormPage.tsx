import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
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
import {
  ROLE_LABEL,
  type AdminOrganization,
  type AdminUser,
  type UserRole,
} from '@/types/api';
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
import { ConfirmSubmitDialog, type ConfirmRow } from '@/components/ui/confirm-submit-dialog';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  name: z.string().min(1, 'Name is required'),
  role: z.string().min(1, 'Role is required'),
  organizationId: z.string().optional(),
  status: z.string().optional(),
  timezone: z.string().optional(),
  language: z.string().optional(),
  linkedStudentIds: z.array(z.string()).optional(),
});

type FormValues = z.infer<typeof schema>;

export function UserFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const userQuery = useQuery({
    queryKey: ['users', id],
    queryFn: () => usersApi.get(id!),
    enabled: isEdit,
  });
  const orgsQuery = useQuery({
    queryKey: ['organizations', 'all'],
    queryFn: organizationsApi.all,
  });

  // Gate the form mount on the data being ready so useForm captures correct
  // defaults on its first (and only) call. Without this, useForm initializes
  // with empty/loading values and Controller-wrapped Radix Selects do not
  // reliably sync to the later `values` prop update.
  if (isEdit && (userQuery.isLoading || !userQuery.data)) {
    return <div className="flex h-64 items-center justify-center"><Spinner className="h-7 w-7 text-brand-primary" /></div>;
  }
  if (orgsQuery.isLoading || !orgsQuery.data) {
    return <div className="flex h-64 items-center justify-center"><Spinner className="h-7 w-7 text-brand-primary" /></div>;
  }

  return (
    <UserFormEditor
      userId={id ?? null}
      isEdit={isEdit}
      userData={userQuery.data ?? null}
      organizations={orgsQuery.data}
    />
  );
}

interface UserFormEditorProps {
  userId: string | null;
  isEdit: boolean;
  userData: AdminUser | null;
  organizations: AdminOrganization[];
}

function UserFormEditor({ userId, isEdit, userData, organizations }: UserFormEditorProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user: actor } = useAuthStore();
  const queryClient = useQueryClient();
  const allowedRoles = manageableRoles(actor?.role);
  const defaultRole = allowedRoles.includes('TEACHER')
    ? 'TEACHER'
    : (allowedRoles[0] ?? 'TEACHER');
  const isSuperAdmin = actor?.role === 'SUPER_ADMIN';
  const ownOrganizationId = actor?.primaryOrganization?.id ?? null;
  // Org/customer admins manage a single workspace, so their own org is
  // pre-selected and the picker is locked. Partner admins resell to many
  // customers, so they keep a (backend-scoped) picker. Super admins are
  // unchanged: full picker including "Unassigned".
  const lockOrganization =
    actor?.role === 'CUSTOMER_ADMIN' || actor?.role === 'ADMIN';
  const initialOrganizationId =
    searchParams.get('organizationId') ??
    (isSuperAdmin ? 'NONE' : ownOrganizationId ?? 'NONE');

  const defaultValues: FormValues = useMemo(() => {
    if (userData) {
      return {
        email: userData.email,
        name: userData.name ?? '',
        role: userData.role,
        organizationId: userData.primaryOrganizationId ?? 'NONE',
        status: userData.status,
        timezone: userData.timezone,
        language: userData.language,
        linkedStudentIds: userData.linkedStudentIds ?? [],
      };
    }
    return {
      email: '',
      name: '',
      role: defaultRole,
      organizationId: initialOrganizationId,
      status: 'ACTIVE',
      timezone: 'UTC',
      language: 'en',
      linkedStudentIds: [],
    };
    // defaults are captured once at mount; further changes are handled via setValue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const createMutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      toast.success('User created');
      navigate(
        user.primaryOrganizationId
          ? `/users?organizationId=${user.primaryOrganizationId}`
          : '/users',
      );
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ userId: targetId, payload }: { userId: string; payload: UpdateUserPayload }) =>
      usersApi.update(targetId, payload),
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      toast.success('User updated');
      navigate(
        user.primaryOrganizationId
          ? `/users?organizationId=${user.primaryOrganizationId}`
          : '/users',
      );
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const submitting = createMutation.isPending || updateMutation.isPending;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingValues, setPendingValues] = useState<FormValues | null>(null);
  const role = watch('role');
  const organizationId = watch('organizationId');
  const status = watch('status');
  const linkedStudentIds = watch('linkedStudentIds') ?? [];
  const selectedOrganization = useMemo(
    () => organizations.find((org) => org.id === organizationId) ?? null,
    [organizationId, organizations],
  );
  const usersQuery = useQuery({
    queryKey: ['users', 'student-options', organizationId],
    queryFn: () =>
      usersApi.list({
        perPage: 100,
        organizationId: organizationId === 'NONE' ? undefined : organizationId,
        role: 'STUDENT',
      }),
    enabled: organizationId !== 'NONE',
  });
  const activeSubscription = selectedOrganization?.subscriptions?.find(
    (subscription) =>
      subscription.status === 'ACTIVE' || subscription.status === 'TRIAL',
  );
  const studentOptions = useMemo(
    () =>
      (usersQuery.data?.data ?? []).filter(
        (item) =>
          item.role === 'STUDENT' &&
          item.status === 'ACTIVE' &&
          item.primaryOrganizationId === organizationId,
      ),
    [organizationId, usersQuery.data],
  );

  const toggleLinkedStudent = (studentId: string, checked: boolean) => {
    const next = checked
      ? Array.from(new Set([...linkedStudentIds, studentId]))
      : linkedStudentIds.filter((id) => id !== studentId);
    setValue('linkedStudentIds', next);
  };

  const onSubmit = (values: FormValues) => {
    setPendingValues(values);
    setConfirmOpen(true);
  };

  const runSubmit = () => {
    const values = pendingValues;
    if (!values) return;
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
      linkedStudentIds: values.role === 'PARENT' ? values.linkedStudentIds ?? [] : [],
    };
    if (isEdit && userId) {
      updateMutation.mutate({
        userId,
        payload: {
          name: payload.name,
          role: payload.role,
          status: payload.status,
          organizationId: payload.organizationId,
          timezone: payload.timezone,
          language: payload.language,
          linkedStudentIds: payload.linkedStudentIds,
        },
      });
    } else {
      createMutation.mutate(payload);
    }
  };

  const buildRows = (v: FormValues): ConfirmRow[] => {
    const orgName =
      v.organizationId && v.organizationId !== 'NONE'
        ? organizations.find((o) => o.id === v.organizationId)?.name ?? v.organizationId
        : 'Unassigned';
    const rows: ConfirmRow[] = [
      { label: 'Email', value: v.email },
      { label: 'Full name', value: v.name },
      { label: 'Role', value: ROLE_LABEL[v.role as UserRole] },
      { label: 'Status', value: v.status === 'DISABLED' ? 'Disabled' : 'Active' },
      { label: 'Organization', value: orgName },
      { label: 'Timezone', value: v.timezone || 'UTC' },
      { label: 'Language', value: v.language || 'en' },
    ];
    if (v.role === 'PARENT') {
      rows.push({
        label: 'Linked students',
        value: `${(v.linkedStudentIds ?? []).length} selected`,
      });
    }
    return rows;
  };

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
              <Controller
                control={control}
                name="role"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {allowedRoles.map((allowedRole) => (
                        <SelectItem key={allowedRole} value={allowedRole}>
                          {ROLE_LABEL[allowedRole]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Status</label>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="DISABLED">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Organization</label>
              <Controller
                control={control}
                name="organizationId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={lockOrganization}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {isSuperAdmin && <SelectItem value="NONE">Unassigned</SelectItem>}
                      {organizations.map((org) => (
                        <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
          {role === 'PARENT' && (
            <div className="rounded-lg border border-line bg-surface-variant px-4 py-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-bold text-ink-900">Linked students</h3>
                  <p className="text-sm text-ink-500">
                    Parent access is limited to active students in the same organization.
                  </p>
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                  {linkedStudentIds.length} selected
                </span>
              </div>
              <div className="mt-3 grid max-h-56 gap-2 overflow-auto pr-1 sm:grid-cols-2">
                {studentOptions.map((student) => (
                  <label
                    key={student.id}
                    className="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink-700"
                  >
                    <input
                      type="checkbox"
                      checked={linkedStudentIds.includes(student.id)}
                      onChange={(event) =>
                        toggleLinkedStudent(student.id, event.target.checked)
                      }
                      className="h-4 w-4 rounded border-line text-brand-primary"
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-ink-900">
                        {student.name ?? student.email}
                      </span>
                      <span className="block truncate text-xs text-ink-500">
                        {student.email}
                      </span>
                    </span>
                  </label>
                ))}
                {studentOptions.length === 0 && (
                  <p className="rounded-lg border border-dashed border-line bg-white px-3 py-3 text-sm text-ink-500">
                    No active students are available in this organization.
                  </p>
                )}
              </div>
            </div>
          )}
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
          <div className="grid gap-2 rounded-lg border border-line bg-surface-variant px-3 py-3 text-sm text-ink-700">
            <p className="font-semibold text-ink-900">
              {selectedOrganization?.name ?? 'No organization selected'}
            </p>
            <p>
              Seats {activeSubscription?.seatUsage ?? 0}/
              {activeSubscription?.seatLimit ?? 0}
            </p>
            <p className="text-xs text-ink-500">
              Student login {selectedOrganization?.studentLoginEnabled ? 'enabled' : 'disabled'} · Parent login{' '}
              {selectedOrganization?.parentLoginEnabled ? 'enabled' : 'disabled'}
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

      <ConfirmSubmitDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={isEdit ? 'Save user changes?' : 'Create this user?'}
        description="Review the details below before saving."
        rows={pendingValues ? buildRows(pendingValues) : []}
        confirmLabel={isEdit ? 'Save changes' : 'Create user'}
        loading={submitting}
        onConfirm={runSubmit}
      />
    </form>
  );
}
