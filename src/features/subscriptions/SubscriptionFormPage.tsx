import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CreditCard, Image as ImageIcon, Info, Palette, Save } from 'lucide-react';
import { toast } from 'sonner';

import { subscriptionsApi, type UpdateSubscriptionPayload } from '@/services/subscriptions.api';
import { organizationsApi } from '@/services/organizations.api';
import { usersApi } from '@/services/users.api';
import { licensingApi } from '@/services/licensing.api';
import { useAuthStore } from '@/lib/auth-store';
import { extractApiError } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import {
  ALL_PARTNERS_VALUE,
  organizationBelongsToPartner,
  organizationsForPartner,
  partnerOrganizations,
} from '@/lib/admin-hierarchy';
import {
  BRANDING_MODE_LABEL,
  SUBSCRIPTION_STATUS_LABEL,
  type AdminOrganization,
  type BrandingMode,
  type SubscriptionStatus,
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
import { Logo } from '@/components/brand/Logo';
import { ConfirmSubmitDialog, type ConfirmRow } from '@/components/ui/confirm-submit-dialog';

const schema = z
  .object({
    scope: z.enum(['organization', 'user']),
    organizationId: z.string().optional(),
    userId: z.string().optional(),
    planName: z.string().optional(),
    status: z.string(),
    brandingMode: z.string(),
    seatLimit: z
      .number()
      .int('Teacher seats must be a whole number')
      .min(1, 'Teacher seats must be at least 1'),
    startDate: z.string().min(1, 'Start date required'),
    endDate: z.string().min(1, 'End date required'),
  })
  .superRefine((values, ctx) => {
    if (values.startDate && values.endDate) {
      const start = new Date(values.startDate);
      const end = new Date(values.endDate);
      if (
        !Number.isNaN(start.getTime()) &&
        !Number.isNaN(end.getTime()) &&
        end <= start
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'End date must be after the start date',
          path: ['endDate'],
        });
      }
    }
  });

type FormValues = z.infer<typeof schema>;
const INTERNAL_PLAN_NAME = 'Enterprises';

const DURATION_OPTIONS: Array<{ value: string; label: string; months: number | null }> = [
  { value: 'custom', label: 'Custom', months: null },
  { value: '1', label: '1 month', months: 1 },
  { value: '3', label: '3 months', months: 3 },
  { value: '6', label: '6 months', months: 6 },
  { value: '12', label: '12 months', months: 12 },
];

function toInputDate(value: string | null | undefined) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

function addMonthsToDate(dateStr: string, months: number): string {
  const base = dateStr ? new Date(dateStr) : new Date();
  if (Number.isNaN(base.getTime())) return '';
  const next = new Date(base);
  next.setMonth(next.getMonth() + months);
  return next.toISOString().slice(0, 10);
}

// Offsets a YYYY-MM-DD date string by `days`, used to bound the date pickers so
// unselectable dates (end ≤ start) are disabled directly in the calendar UI.
function addDaysToDate(dateStr: string, days: number): string {
  if (!dateStr) return '';
  const base = new Date(dateStr);
  if (Number.isNaN(base.getTime())) return '';
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

function allocatedSeatTotal(org: AdminOrganization | null | undefined): number {
  if (!org) return 0;
  return org.teacherUserLimit ?? 0;
}

export function SubscriptionFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);
  const queryClient = useQueryClient();
  const { user: actor } = useAuthStore();
  const isSuperAdmin = actor?.role === 'SUPER_ADMIN';
  // Customer/Org admins manage a single workspace: lock scope to Organization
  // and the org to their own. Partner admins keep the picker (multi-org), super
  // admins are unchanged.
  const lockToOwnOrg = actor?.role === 'CUSTOMER_ADMIN' || actor?.role === 'ADMIN';
  const ownOrganizationId = actor?.primaryOrganization?.id ?? null;
  const requestedOrganizationId = searchParams.get('organizationId');
  const initialStartDate = toInputDate(new Date().toISOString());
  const [durationMonths, setDurationMonths] = useState<number | null>(isEdit ? null : 12);
  const [selectedPartnerOrganizationId, setSelectedPartnerOrganizationId] = useState(
    searchParams.get('partnerOrganizationId') ?? ALL_PARTNERS_VALUE,
  );

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
      organizationId:
        lockToOwnOrg && ownOrganizationId
          ? ownOrganizationId
          : requestedOrganizationId ?? 'NONE',
      userId: 'NONE',
      planName: INTERNAL_PLAN_NAME,
      status: 'ACTIVE',
      brandingMode: 'SOFTLOGIC',
      seatLimit: 1,
      startDate: initialStartDate,
      endDate: isEdit ? '' : addMonthsToDate(initialStartDate, 12),
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
      brandingMode: subscriptionQuery.data.brandingMode,
      seatLimit: subscriptionQuery.data.seatLimit,
      startDate: toInputDate(subscriptionQuery.data.startDate),
      endDate: toInputDate(subscriptionQuery.data.endDate),
    });
    setDurationMonths(null);
  }, [reset, subscriptionQuery.data]);

  // Pin customer/org admins to org scope + their own organization on the
  // create form (the fields are also disabled below).
  useEffect(() => {
    if (isEdit || !lockToOwnOrg) return;
    setValue('scope', 'organization');
    if (ownOrganizationId) setValue('organizationId', ownOrganizationId);
  }, [isEdit, lockToOwnOrg, ownOrganizationId, setValue]);

  useEffect(() => {
    if (isEdit || lockToOwnOrg || !requestedOrganizationId || !orgsQuery.data) return;
    const requestedOrganization = orgsQuery.data.find(
      (organization) => organization.id === requestedOrganizationId,
    );
    if (!requestedOrganization) return;
    setValue('scope', 'organization');
    setValue('organizationId', requestedOrganization.id);
    if (isSuperAdmin) {
      setSelectedPartnerOrganizationId(
        requestedOrganization.parentOrganizationId ??
          (requestedOrganization.kind === 'PARTNER'
            ? requestedOrganization.id
            : ALL_PARTNERS_VALUE),
      );
    }
  }, [
    isEdit,
    isSuperAdmin,
    lockToOwnOrg,
    orgsQuery.data,
    requestedOrganizationId,
    setValue,
  ]);

  const createMutation = useMutation({
    mutationFn: subscriptionsApi.create,
    onSuccess: (subscription) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      toast.success(
        subscription.status === 'ACTIVE'
          ? 'Subscription created'
          : `Subscription submitted - pending ${approvalTargetLabel} approval`,
      );
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
  const brandingMode = watch('brandingMode');
  const startDate = watch('startDate');
  const submitting = createMutation.isPending || updateMutation.isPending;
  const partners = partnerOrganizations(orgsQuery.data ?? []);
  const organizationOptions = organizationsForPartner(
    orgsQuery.data ?? [],
    selectedPartnerOrganizationId,
  );

  const selectedOrg =
    scope === 'organization' && organizationId && organizationId !== 'NONE'
      ? orgsQuery.data?.find((org) => org.id === organizationId) ?? null
      : null;
  const inheritedBrandingMode = selectedOrg?.brandingMode ?? (brandingMode as BrandingMode);
  const selectedOrgSeatTotal = allocatedSeatTotal(selectedOrg);
  const partnerChildOrg =
    actor?.role === 'PARTNER_ADMIN' &&
    !!actor.primaryOrganization?.id &&
    selectedOrg?.parentOrganizationId === actor.primaryOrganization.id;
  const partnerLicenseQuery = useQuery({
    queryKey: ['license-details', selectedOrg?.id, 'subscription-form'],
    queryFn: () => licensingApi.getOrganizationLicenseDetails(selectedOrg!.id),
    enabled: partnerChildOrg && !!selectedOrg?.id && !isEdit,
  });
  const partnerPool = partnerLicenseQuery.data?.partnerPool ?? null;
  const showWhiteLabel =
    isSuperAdmin && !!selectedOrg && selectedOrg.brandingMode !== 'SOFTLOGIC';
  const approvalTargetLabel = selectedOrg?.parentOrganizationId ? 'Partner Admin' : 'Super Admin';
  const showPendingNotice = !isEdit && !isSuperAdmin && !partnerChildOrg;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingValues, setPendingValues] = useState<FormValues | null>(null);

  // Live values for the preview card + confirm summary.
  const planName = watch('planName');
  const seatLimit = watch('seatLimit');
  const endDate = watch('endDate');
  const selectedUser =
    scope === 'user' && userId && userId !== 'NONE'
      ? usersQuery.data?.find((u) => u.id === userId) ?? null
      : null;
  const holderName =
    scope === 'organization'
      ? selectedOrg?.name ?? '—'
      : selectedUser?.name ?? selectedUser?.email ?? '—';
  const previewStatusLabel =
    !isEdit && !isSuperAdmin && !partnerChildOrg
      ? 'Pending Approval'
      : SUBSCRIPTION_STATUS_LABEL[status as SubscriptionStatus];
  // When a duration preset is selected, keep the end date in sync with the start
  // date. A manual edit to the end date switches back to "Custom".
  useEffect(() => {
    if (durationMonths === null || !startDate) return;
    setValue('endDate', addMonthsToDate(startDate, durationMonths), { shouldDirty: true });
  }, [durationMonths, startDate, setValue]);

  useEffect(() => {
    setValue('planName', INTERNAL_PLAN_NAME, { shouldDirty: false });
  }, [setValue]);

  useEffect(() => {
    if (scope !== 'organization' || !selectedOrg) return;
    setValue('brandingMode', selectedOrg.brandingMode, { shouldDirty: true });
    if (!isEdit && selectedOrgSeatTotal > 0) {
      setValue('seatLimit', selectedOrgSeatTotal, { shouldDirty: true });
    }
  }, [isEdit, scope, selectedOrg, selectedOrgSeatTotal, setValue]);

  const onSubmit = (values: FormValues) => {
    if (values.scope === 'organization') {
      if (!values.organizationId || values.organizationId === 'NONE') {
        toast.error('Select an organization');
        return;
      }
      if (selectedOrgSeatTotal > 0 && values.seatLimit > selectedOrgSeatTotal) {
        toast.error(`Teacher seats cannot exceed teacher user capacity (${selectedOrgSeatTotal})`);
        return;
      }
    }
    if (partnerChildOrg) {
      if (!partnerPool || partnerPool.seatLimit <= 0) {
        toast.error('Active partner subscription is required before allocating child seats');
        return;
      }
      if (values.seatLimit > partnerPool.remainingAllocationSeats) {
        toast.error(
          `Only ${partnerPool.remainingAllocationSeats} partner seat(s) are available for allocation`,
        );
        return;
      }
    }
    setPendingValues(values);
    setConfirmOpen(true);
  };

  const handlePartnerChange = (value: string) => {
    setSelectedPartnerOrganizationId(value);
    const currentOrganization = orgsQuery.data?.find((org) => org.id === organizationId);
    if (
      organizationId !== 'NONE' &&
      !organizationBelongsToPartner(currentOrganization, value, orgsQuery.data ?? [])
    ) {
      setValue('organizationId', 'NONE', { shouldDirty: true });
    }
  };

  const runSubmit = () => {
    const values = pendingValues;
    if (!values) return;
    const startISO = new Date(values.startDate).toISOString();
    const endISO = new Date(values.endDate).toISOString();
    const commercialPayload =
      values.scope === 'organization' && selectedOrg
        ? { brandingMode: selectedOrg.brandingMode }
        : { brandingMode: values.brandingMode as BrandingMode };
    if (isEdit && id) {
      updateMutation.mutate({
        subscriptionId: id,
        payload: {
          planName: INTERNAL_PLAN_NAME,
          status: values.status as SubscriptionStatus,
          seatLimit: values.seatLimit,
          ...commercialPayload,
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
        planName: INTERNAL_PLAN_NAME,
        status: values.status as SubscriptionStatus,
        seatLimit: values.seatLimit,
        ...commercialPayload,
        startDate: startISO,
        endDate: endISO,
      });
    }
  };

  const buildRows = (v: FormValues): ConfirmRow[] => {
    const isOrg = v.scope === 'organization';
    const holder = isOrg
      ? orgsQuery.data?.find((o) => o.id === v.organizationId)?.name ?? '—'
      : usersQuery.data?.find((u) => u.id === v.userId)?.name ??
        usersQuery.data?.find((u) => u.id === v.userId)?.email ??
        '—';
    const statusLabel =
      !isEdit && !isSuperAdmin && !partnerChildOrg
        ? 'Pending Approval'
        : SUBSCRIPTION_STATUS_LABEL[v.status as SubscriptionStatus];
    const durLabel =
      DURATION_OPTIONS.find((option) => (option.months ?? null) === durationMonths)?.label ??
      'Custom';
    return [
      { label: 'Scope', value: isOrg ? 'Organization' : 'User' },
      { label: isOrg ? 'Organization' : 'User', value: holder },
      { label: 'Plan name', value: INTERNAL_PLAN_NAME },
      { label: 'Status', value: statusLabel },
      { label: 'Branding mode', value: BRANDING_MODE_LABEL[inheritedBrandingMode] },
      { label: 'Teacher seats', value: v.seatLimit },
      { label: 'Duration', value: durLabel },
      { label: 'Start date', value: v.startDate ? formatDate(v.startDate) : '—' },
      { label: 'End date', value: v.endDate ? formatDate(v.endDate) : '—' },
    ];
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
          {isEdit
            ? 'Save changes'
            : isSuperAdmin || partnerChildOrg
              ? 'Create subscription'
              : 'Submit for approval'}
        </Button>
      </div>

      {showPendingNotice && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-800">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Submitting sends this subscription to a {approvalTargetLabel} for approval. It stays
            inactive until approved — you&apos;ll receive an email once it&apos;s reviewed.
          </span>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <Card className="space-y-5 px-4 py-5 sm:px-6">
          <div>
            <h3 className="text-base font-bold text-ink-900">Subscription Details</h3>
            <p className="text-sm text-ink-500">Billing and access allocation metadata.</p>
          </div>
          {!isEdit && (
            <div
              className={`grid gap-4 ${
                isSuperAdmin && scope === 'organization'
                  ? 'sm:grid-cols-3'
                  : 'sm:grid-cols-2'
              }`}
            >
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Scope</label>
                <Select
                  value={scope}
                  onValueChange={(value) => setValue('scope', value as 'organization' | 'user')}
                  disabled={lockToOwnOrg}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="organization">Organization</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isSuperAdmin && scope === 'organization' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Partner organization</label>
                  <Select value={selectedPartnerOrganizationId} onValueChange={handlePartnerChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_PARTNERS_VALUE}>All partners</SelectItem>
                      {partners.map((org) => (
                        <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                  {scope === 'organization' ? 'Organization' : 'User'}
                </label>
                {scope === 'organization' ? (
                  <Select
                    value={organizationId}
                    onValueChange={(value) => setValue('organizationId', value)}
                    disabled={lockToOwnOrg}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {!lockToOwnOrg && <SelectItem value="NONE">Select organization</SelectItem>}
                      {organizationOptions.map((org) => (
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
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Branding mode</label>
              <Select
                disabled={!isSuperAdmin || scope === 'organization'}
                value={inheritedBrandingMode}
                onValueChange={(value) => setValue('brandingMode', value)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(BRANDING_MODE_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Plan name</label>
              <Input readOnly {...register('planName')} />
              {errors.planName && <p className="text-xs text-danger">{errors.planName.message}</p>}
            </div>
            {isSuperAdmin ? (
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
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Status</label>
                <div className="flex h-10 items-center rounded-lg border border-line bg-surface-variant px-3 text-sm font-medium text-ink-600">
                  {partnerChildOrg ? 'Active' : 'Pending Approval'}
                </div>
              </div>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Teacher seats</label>
              <Input
                type="number"
                min={1}
                max={
                  partnerChildOrg
                    ? partnerPool?.remainingAllocationSeats
                    : selectedOrgSeatTotal > 0
                      ? selectedOrgSeatTotal
                      : undefined
                }
                {...register('seatLimit', { valueAsNumber: true })}
              />
              {scope === 'organization' && selectedOrgSeatTotal > 0 && (
                <p className="text-xs text-ink-500">
                  Seats can be at most the teacher user capacity ({selectedOrgSeatTotal}).
                </p>
              )}
              {errors.seatLimit && <p className="text-xs text-danger">{errors.seatLimit.message}</p>}
            </div>
          </div>
          {partnerChildOrg && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              <p className="font-semibold">
                Partner allocation: {partnerPool?.remainingAllocationSeats ?? 0} of{' '}
                {partnerPool?.seatLimit ?? 0} seat(s) available.
              </p>
              {partnerPool?.subscriptions?.length ? (
                <div className="mt-2 grid gap-1 text-xs">
                  {partnerPool.subscriptions.map((subscription) => (
                    <div key={subscription.id} className="flex justify-between gap-3">
                      <span className="truncate">{subscription.planName}</span>
                      <span className="shrink-0">
                        {subscription.remainingAllocationSeats}/{subscription.seatLimit} available
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-xs">
                  Active partner subscription is required before child subscriptions can be activated.
                </p>
              )}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Duration</label>
              <Select
                value={durationMonths === null ? 'custom' : String(durationMonths)}
                onValueChange={(value) => {
                  const option = DURATION_OPTIONS.find((opt) => opt.value === value);
                  setDurationMonths(option?.months ?? null);
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Start date</label>
              <Input
                type="date"
                max={endDate ? addDaysToDate(endDate, -1) : undefined}
                {...register('startDate')}
              />
              {errors.startDate && <p className="text-xs text-danger">{errors.startDate.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">End date</label>
              <Input
                type="date"
                min={startDate ? addDaysToDate(startDate, 1) : undefined}
                {...register('endDate', { onChange: () => setDurationMonths(null) })}
              />
              {errors.endDate && <p className="text-xs text-danger">{errors.endDate.message}</p>}
            </div>
          </div>
        </Card>

        <div className="flex flex-col gap-5">
          <Card className="space-y-4 px-4 py-5 sm:px-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-ink-900">Seats</h3>
              <p className="mt-1 text-sm leading-6 text-ink-500">
                Set teacher license capacity and activation key capacity for this subscription.
              </p>
            </div>
          </Card>
          <SubscriptionPreviewCard
            planName={planName ?? INTERNAL_PLAN_NAME}
            scopeLabel={scope === 'organization' ? 'Organization' : 'User'}
            holderName={holderName}
            statusLabel={previewStatusLabel}
            brandingLabel={BRANDING_MODE_LABEL[inheritedBrandingMode]}
            seatLimit={Number(seatLimit) || 0}
            startDate={startDate}
            endDate={endDate ?? ''}
          />
        </div>
      </div>

      {showWhiteLabel && selectedOrg && (
        <WhiteLabelOrgBranding key={selectedOrg.id} org={selectedOrg} />
      )}

      <ConfirmSubmitDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={
          isEdit
            ? 'Save subscription changes?'
            : isSuperAdmin || partnerChildOrg
              ? 'Create this subscription?'
              : 'Submit this subscription?'
        }
        description={
          !isEdit && !isSuperAdmin
            ? `This will be sent to a ${approvalTargetLabel} for approval.`
            : 'Review the details below before saving.'
        }
        rows={pendingValues ? buildRows(pendingValues) : []}
        confirmLabel={
          isEdit
            ? 'Save changes'
            : isSuperAdmin || partnerChildOrg
              ? 'Create subscription'
              : 'Submit for approval'
        }
        loading={submitting}
        onConfirm={runSubmit}
      />
    </form>
  );
}

interface SubscriptionPreviewCardProps {
  planName: string;
  scopeLabel: string;
  holderName: string;
  statusLabel: string;
  brandingLabel: string;
  seatLimit: number;
  startDate: string;
  endDate: string;
}

function SubscriptionPreviewCard({
  planName,
  scopeLabel,
  holderName,
  statusLabel,
  brandingLabel,
  seatLimit,
  startDate,
  endDate,
}: SubscriptionPreviewCardProps) {
  const validThru = `${startDate ? formatDate(startDate) : '—'} – ${
    endDate ? formatDate(endDate) : '—'
  }`;
  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-brand-navy via-brand-primary to-brand-blue p-5 text-white shadow-elevated">
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-brand-orange/20 blur-2xl" />
      <div className="relative z-10 flex items-start justify-between gap-3">
        <Logo variant="light" />
        <span className="shrink-0 rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/90">
          {statusLabel}
        </span>
      </div>
      <div className="relative z-10 mt-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">
          {scopeLabel} plan
        </p>
        <p className="mt-0.5 text-xl font-black leading-tight">
          {planName?.trim() || INTERNAL_PLAN_NAME}
        </p>
      </div>
      <div className="relative z-10 mt-3 flex items-center gap-2 font-mono text-sm tracking-widest text-white/90">
        <span>••••</span>
        <span className="min-w-0 truncate">{holderName || '—'}</span>
      </div>
      <div className="relative z-10 mt-4 grid grid-cols-3 gap-2">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wide text-white/55">Seats</p>
          <p className="mt-0.5 text-sm font-bold">
            {seatLimit}
          </p>
        </div>
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wide text-white/55">
            Valid thru
          </p>
          <p className="mt-0.5 text-xs font-semibold">{validThru}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-white/55">Branding</p>
          <p className="mt-0.5 truncate text-xs font-semibold">{brandingLabel}</p>
        </div>
      </div>
    </div>
  );
}

function WhiteLabelOrgBranding({ org }: { org: AdminOrganization }) {
  const queryClient = useQueryClient();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [brandName, setBrandName] = useState(org.brandName ?? '');
  const [primaryColor, setPrimaryColor] = useState(org.brandPrimaryColor ?? '');
  const [accentColor, setAccentColor] = useState(org.brandAccentColor ?? '');

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['organizations'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
  };

  const saveBranding = useMutation({
    mutationFn: () =>
      organizationsApi.update(org.id, {
        brandName: brandName.trim() ? brandName.trim() : null,
        brandPrimaryColor: primaryColor.trim() ? primaryColor.trim() : null,
        brandAccentColor: accentColor.trim() ? accentColor.trim() : null,
      }),
    onSuccess: () => {
      invalidate();
      toast.success('Branding saved');
    },
    onError: (error) => toast.error(extractApiError(error)),
  });
  const uploadLogo = useMutation({
    mutationFn: (file: File) => organizationsApi.uploadLogo(org.id, file),
    onSuccess: () => {
      invalidate();
      toast.success('Logo updated');
    },
    onError: (error) => toast.error(extractApiError(error)),
  });
  const removeLogo = useMutation({
    mutationFn: () => organizationsApi.removeLogo(org.id),
    onSuccess: () => {
      invalidate();
      toast.success('Logo removed');
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  return (
    <Card className="space-y-5 px-4 py-5 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-orange/10 text-brand-orange">
            <Palette className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-ink-900">White-label branding</h3>
            <p className="text-sm text-ink-500">
              {org.name} uses {BRANDING_MODE_LABEL[org.brandingMode]} branding. Set its identity for the apps.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="primary"
          onClick={() => saveBranding.mutate()}
          disabled={saveBranding.isPending}
        >
          {saveBranding.isPending ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          Save branding
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Brand name</label>
          <Input
            placeholder="Acme Learning"
            value={brandName}
            onChange={(event) => setBrandName(event.target.value)}
          />
          <p className="text-xs text-ink-500">Shown in place of “SoftLogic” for this workspace.</p>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Brand logo</label>
          <div className="flex items-center gap-3 rounded-lg border border-line bg-white px-3 py-2">
            {org.logoUrl ? (
              <img src={org.logoUrl} alt="Organization logo" className="h-10 w-10 rounded object-contain" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded bg-surface-variant text-ink-400">
                <ImageIcon className="h-5 w-5" />
              </div>
            )}
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) uploadLogo.mutate(file);
                event.target.value = '';
              }}
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadLogo.isPending}
              >
                {uploadLogo.isPending ? 'Uploading…' : 'Upload'}
              </Button>
              {org.logoUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeLogo.mutate()}
                  disabled={removeLogo.isPending}
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Primary color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={primaryColor || '#08357c'}
              onChange={(event) => setPrimaryColor(event.target.value)}
              className="h-9 w-10 shrink-0 cursor-pointer rounded border border-line bg-white p-0.5"
              aria-label="Primary brand color"
            />
            <Input placeholder="#08357C" value={primaryColor} onChange={(event) => setPrimaryColor(event.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Accent color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={accentColor || '#f97316'}
              onChange={(event) => setAccentColor(event.target.value)}
              className="h-9 w-10 shrink-0 cursor-pointer rounded border border-line bg-white p-0.5"
              aria-label="Accent brand color"
            />
            <Input placeholder="#F97316" value={accentColor} onChange={(event) => setAccentColor(event.target.value)} />
          </div>
        </div>
      </div>
    </Card>
  );
}
