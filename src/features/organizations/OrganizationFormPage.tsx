import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Building2, Image as ImageIcon, Save } from 'lucide-react';
import { toast } from 'sonner';

import { organizationsApi, type UpdateOrganizationPayload } from '@/services/organizations.api';
import { aiApi } from '@/services/ai.api';
import { useAuthStore } from '@/lib/auth-store';
import { canCreateOrganizationKind } from '@/lib/role-access';
import { extractApiError } from '@/lib/api';
import {
  BRANDING_MODE_LABEL,
  ORG_KIND_LABEL,
  STORAGE_STATUS_LABEL,
  type AdminOrganization,
  type BrandingMode,
  type OrganizationKind,
  type OrganizationStatus,
  type OrganizationStorageProvider,
  type OrganizationStorageStatus,
} from '@/types/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { AiCreditInfoButton } from '@/components/ai/AiCreditInfoButton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmSubmitDialog, type ConfirmRow } from '@/components/ui/confirm-submit-dialog';

const schema = z.object({
    name: z.string().min(1, 'Name is required'),
    slug: z.string().optional(),
    kind: z.string().min(1),
    parentOrganizationId: z.string().optional(),
    status: z.string().optional(),
    brandingMode: z.string().optional(),
    brandName: z.string().optional(),
    brandPrimaryColor: z.string().optional(),
    brandAccentColor: z.string().optional(),
    studentLoginEnabled: z.boolean().optional(),
    parentLoginEnabled: z.boolean().optional(),
    sessionOnlyJoinEnabled: z.boolean().optional(),
    teacherOnlyMode: z.boolean().optional(),
    teacherUserLimit: z.number().int().min(0).optional().nullable(),
    studentUserLimit: z.number().int().min(0).optional().nullable(),
    parentUserLimit: z.number().int().min(0).optional().nullable(),
    supportEmail: z.string().trim().email('Enter a valid support email').or(z.literal('')).optional(),
    supportPhone: z.string().optional(),
    storageProviders: z.array(z.string()).optional(),
    defaultStorageProvider: z.string().optional(),
    storageStatus: z.string().optional(),
    aiCreditTokens: z.number().int().min(0).optional().nullable(),
});

type FormValues = z.infer<typeof schema>;

const STORAGE_PROVIDER_OPTIONS: Array<{
  value: OrganizationStorageProvider;
  label: string;
}> = [
  { value: 'GOOGLE_DRIVE', label: 'Google Drive' },
  { value: 'DROPBOX', label: 'Dropbox' },
  { value: 'ONEDRIVE', label: 'OneDrive' },
];

export function OrganizationFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { user: actor } = useAuthStore();

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

  // Gate the form mount on the org being loaded so useForm captures correct
  // defaults on its first (and only) call. Without this, Radix Selects do not
  // reliably sync to a later reset() — which previously left the branding mode
  // blank on the edit screen even though it was saved.
  if (isEdit && (organizationQuery.isLoading || !organizationQuery.data)) {
    return <div className="flex h-64 items-center justify-center"><Spinner className="h-7 w-7 text-brand-primary" /></div>;
  }

  return (
    <OrganizationFormEditor
      isEdit={isEdit}
      organizationId={id ?? null}
      organization={organizationQuery.data ?? null}
      partnerOrganizations={orgsQuery.data ?? []}
    />
  );
}

interface OrganizationFormEditorProps {
  isEdit: boolean;
  organizationId: string | null;
  organization: AdminOrganization | null;
  partnerOrganizations: AdminOrganization[];
}

function OrganizationFormEditor({
  isEdit,
  organizationId,
  organization,
  partnerOrganizations,
}: OrganizationFormEditorProps) {
  const navigate = useNavigate();
  const { user: actor } = useAuthStore();
  const queryClient = useQueryClient();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const pendingAiCreditTokensRef = useRef<number | null>(0);
  const initializedAiCreditsRef = useRef(false);
  const { allowedKinds } = canCreateOrganizationKind(actor?.role);
  const isSuperAdmin = actor?.role === 'SUPER_ADMIN';
  const canConfigureStorage =
    actor?.role === 'SUPER_ADMIN' || actor?.role === 'PARTNER_ADMIN';
  const aiOverviewQuery = useQuery({
    queryKey: ['ai-overview'],
    queryFn: aiApi.overview,
  });

  const defaultValues: FormValues = useMemo(() => {
    if (organization) {
      return {
        name: organization.name,
        slug: organization.slug,
        kind: organization.kind,
        parentOrganizationId: organization.parentOrganizationId ?? 'NONE',
        status: organization.status,
        brandingMode: organization.brandingMode,
        brandName: organization.brandName ?? '',
        brandPrimaryColor: organization.brandPrimaryColor ?? '',
        brandAccentColor: organization.brandAccentColor ?? '',
        studentLoginEnabled: organization.studentLoginEnabled,
        parentLoginEnabled: organization.parentLoginEnabled,
        sessionOnlyJoinEnabled: organization.sessionOnlyJoinEnabled,
        teacherOnlyMode: organization.teacherOnlyMode,
        teacherUserLimit: organization.teacherUserLimit ?? 0,
        studentUserLimit: organization.studentUserLimit ?? 0,
        parentUserLimit: organization.parentUserLimit ?? 0,
        supportEmail: organization.supportEmail ?? '',
        supportPhone: organization.supportPhone ?? '',
        storageProviders:
          organization.storageProviders?.length
            ? organization.storageProviders
            : organization.storageProvider
              ? [organization.storageProvider]
              : [],
        defaultStorageProvider:
          organization.defaultStorageProvider ??
          organization.storageProvider ??
          'NONE',
        storageStatus: organization.storageStatus,
        aiCreditTokens: 0,
      };
    }
    return {
      name: '',
      slug: '',
      kind: allowedKinds[0] ?? 'CUSTOMER',
      parentOrganizationId: 'NONE',
      status: 'ACTIVE',
      brandingMode: 'SOFTLOGIC',
      brandName: '',
      brandPrimaryColor: '',
      brandAccentColor: '',
      studentLoginEnabled: false,
      parentLoginEnabled: false,
      sessionOnlyJoinEnabled: true,
      teacherOnlyMode: false,
      teacherUserLimit: 0,
      studentUserLimit: 0,
      parentUserLimit: 0,
      supportEmail: '',
      supportPhone: '',
      storageProviders: [],
      defaultStorageProvider: 'NONE',
      storageStatus: 'NOT_CONFIGURED',
      aiCreditTokens: 0,
    };
    // Captured once at mount; the wrapper guarantees `organization` is loaded
    // before this editor mounts, so reset()-after-mount is not needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const createMutation = useMutation({
    mutationFn: organizationsApi.create,
    onSuccess: async (created) => {
      const tokensToAllocate = pendingAiCreditTokensRef.current;
      pendingAiCreditTokensRef.current = 0;
      if (tokensToAllocate !== null && tokensToAllocate > 0) {
        await aiApi.setAllocation({
          scope: 'ORGANIZATION',
          organizationId: created.id,
          allocatedTokens: tokensToAllocate,
          reason: 'Organization create allocation',
        });
      }
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['ai-overview'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      if (created.setupEmailSent === false) {
        toast.warning('Organization created, but setup email could not be delivered');
      } else if (created.setupEmailSent) {
        toast.success('Organization created and setup email sent');
      } else {
        toast.success('Organization created');
      }
      navigate('/organizations');
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ organizationId: orgId, payload }: { organizationId: string; payload: UpdateOrganizationPayload }) =>
      organizationsApi.update(orgId, payload),
    onSuccess: async (updated) => {
      const tokensToAllocate = pendingAiCreditTokensRef.current;
      pendingAiCreditTokensRef.current = 0;
      if (tokensToAllocate !== null) {
        await aiApi.setAllocation({
          scope: 'ORGANIZATION',
          organizationId: updated.id,
          allocatedTokens: tokensToAllocate,
          reason: 'Organization edit allocation',
        });
      }
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['ai-overview'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      if (updated.setupEmailSent === false) {
        toast.warning('Organization updated, but setup email could not be delivered');
      } else if (updated.setupEmailSent) {
        toast.success('Organization updated and setup email sent');
      } else {
        toast.success('Organization updated');
      }
      navigate('/organizations');
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const uploadLogoMutation = useMutation({
    mutationFn: (file: File) => organizationsApi.uploadLogo(organizationId!, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      toast.success('Logo updated');
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const removeLogoMutation = useMutation({
    mutationFn: () => organizationsApi.removeLogo(organizationId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      toast.success('Logo removed');
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const kind = watch('kind');
  const parentOrganizationId = watch('parentOrganizationId');
  const status = watch('status');
  const brandingMode = watch('brandingMode');
  const brandPrimaryColor = watch('brandPrimaryColor');
  const brandAccentColor = watch('brandAccentColor');
  const storageProviders = watch('storageProviders') ?? [];
  const defaultStorageProvider = watch('defaultStorageProvider');
  const storageStatus = watch('storageStatus');
  const aiCreditTokens = Number(watch('aiCreditTokens') ?? 0);
  const studentLoginEnabled = watch('studentLoginEnabled');
  const parentLoginEnabled = watch('parentLoginEnabled');
  const teacherOnlyMode = watch('teacherOnlyMode');
  const teacherUserLimit = Number(watch('teacherUserLimit') ?? 0);
  const studentUserLimit = Number(watch('studentUserLimit') ?? 0);
  const parentUserLimit = Number(watch('parentUserLimit') ?? 0);
  const totalUserLimit = teacherUserLimit + studentUserLimit + parentUserLimit;
  const submitting = createMutation.isPending || updateMutation.isPending;
  const isWhiteLabel = brandingMode !== 'SOFTLOGIC';
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingValues, setPendingValues] = useState<FormValues | null>(null);
  const sourceAiAccount =
    actor?.role === 'SUPER_ADMIN'
      ? aiOverviewQuery.data?.master
      : aiOverviewQuery.data?.accounts.find(
          (account) =>
            account.scope === 'ORGANIZATION' &&
            account.organizationId === actor?.primaryOrganization?.id,
        );
  const currentOrgAiAccount = organizationId
    ? aiOverviewQuery.data?.accounts.find(
        (account) => account.scope === 'ORGANIZATION' && account.organizationId === organizationId,
      )
    : null;
  const canAssignOrgAiCredits = !currentOrgAiAccount || currentOrgAiAccount.id !== sourceAiAccount?.id;
  const sourceAvailableAiTokens = canAssignOrgAiCredits ? sourceAiAccount?.availableTokens ?? 0 : 0;
  const currentAssignedAiTokens = currentOrgAiAccount?.allocatedTokens ?? 0;
  const assignableAiTokens = sourceAvailableAiTokens + currentAssignedAiTokens;
  const aiAllocationDelta = aiCreditTokens - currentAssignedAiTokens;
  const afterAiAllocation = Math.max(assignableAiTokens - aiCreditTokens, 0);

  useEffect(() => {
    if (!isEdit || initializedAiCreditsRef.current || !aiOverviewQuery.data) return;
    setValue('aiCreditTokens', currentAssignedAiTokens, { shouldDirty: false });
    initializedAiCreditsRef.current = true;
  }, [aiOverviewQuery.data, currentAssignedAiTokens, isEdit, setValue]);

  useEffect(() => {
    if (!teacherOnlyMode) return;
    if (studentLoginEnabled) setValue('studentLoginEnabled', false, { shouldDirty: true });
    if (parentLoginEnabled) setValue('parentLoginEnabled', false, { shouldDirty: true });
    if (studentUserLimit !== 0) setValue('studentUserLimit', 0, { shouldDirty: true });
    if (parentUserLimit !== 0) setValue('parentUserLimit', 0, { shouldDirty: true });
  }, [
    parentLoginEnabled,
    parentUserLimit,
    setValue,
    studentLoginEnabled,
    studentUserLimit,
    teacherOnlyMode,
  ]);

  useEffect(() => {
    if (!parentLoginEnabled || teacherOnlyMode || studentLoginEnabled) return;
    setValue('studentLoginEnabled', true, { shouldDirty: true });
  }, [parentLoginEnabled, setValue, studentLoginEnabled, teacherOnlyMode]);

  useEffect(() => {
    if (studentLoginEnabled || teacherOnlyMode) return;
    if (parentLoginEnabled) setValue('parentLoginEnabled', false, { shouldDirty: true });
    if (studentUserLimit !== 0) setValue('studentUserLimit', 0, { shouldDirty: true });
    if (parentUserLimit !== 0) setValue('parentUserLimit', 0, { shouldDirty: true });
  }, [
    parentLoginEnabled,
    parentUserLimit,
    setValue,
    studentLoginEnabled,
    studentUserLimit,
    teacherOnlyMode,
  ]);

  useEffect(() => {
    if (parentLoginEnabled || teacherOnlyMode) return;
    if (parentUserLimit !== 0) setValue('parentUserLimit', 0, { shouldDirty: true });
  }, [parentLoginEnabled, parentUserLimit, setValue, teacherOnlyMode]);

  useEffect(() => {
    if (
      defaultStorageProvider &&
      defaultStorageProvider !== 'NONE' &&
      !storageProviders.includes(defaultStorageProvider)
    ) {
      setValue('defaultStorageProvider', storageProviders[0] ?? 'NONE');
    }
  }, [defaultStorageProvider, setValue, storageProviders]);

  const toggleStorageProvider = (provider: OrganizationStorageProvider) => {
    const selected = new Set(storageProviders);
    if (selected.has(provider)) {
      selected.delete(provider);
    } else {
      selected.add(provider);
    }
    const next = Array.from(selected);
    setValue('storageProviders', next, { shouldDirty: true });
    if (!next.length) {
      setValue('defaultStorageProvider', 'NONE', { shouldDirty: true });
      setValue('storageStatus', 'NOT_CONFIGURED', { shouldDirty: true });
    } else if (
      !defaultStorageProvider ||
      defaultStorageProvider === 'NONE' ||
      !next.includes(defaultStorageProvider)
    ) {
      setValue('defaultStorageProvider', next[0], { shouldDirty: true });
    }
  };

  const onSubmit = (values: FormValues) => {
    if (isSuperAdmin) {
      const hasMode =
        Boolean(values.studentLoginEnabled) ||
        Boolean(values.parentLoginEnabled) ||
        Boolean(values.teacherOnlyMode);
      if (!hasMode) {
        toast.error('Select a customer mode');
        return;
      }
      if ((values.teacherUserLimit ?? 0) < 1) {
        toast.error('Teacher users must be at least 1');
        return;
      }
      if (
        !values.teacherOnlyMode &&
        values.studentLoginEnabled &&
        (values.studentUserLimit ?? 0) < 1
      ) {
        toast.error('Student users must be at least 1');
        return;
      }
      if (
        !values.teacherOnlyMode &&
        values.parentLoginEnabled &&
        (values.parentUserLimit ?? 0) < 1
      ) {
        toast.error('Parent users must be at least 1');
        return;
      }
    }
    if (canAssignOrgAiCredits && (values.aiCreditTokens ?? 0) > assignableAiTokens) {
      toast.error(`Only ${assignableAiTokens.toLocaleString('en-IN')} AI credits are assignable`);
      return;
    }
    setPendingValues(values);
    setConfirmOpen(true);
  };

  const runSubmit = () => {
    const values = pendingValues;
    if (!values) return;
    pendingAiCreditTokensRef.current = canAssignOrgAiCredits
      ? Number(values.aiCreditTokens ?? 0)
      : null;
    const normalizedTeacherOnly = Boolean(values.teacherOnlyMode);
    const normalizedParentLogin =
      !normalizedTeacherOnly && Boolean(values.parentLoginEnabled);
    const normalizedStudentLogin =
      !normalizedTeacherOnly &&
      (Boolean(values.studentLoginEnabled) || normalizedParentLogin);
    const commercialPayload = isSuperAdmin
      ? {
          brandingMode: values.brandingMode as BrandingMode,
          brandName: values.brandName?.trim() ? values.brandName.trim() : null,
          brandPrimaryColor: values.brandPrimaryColor?.trim()
            ? values.brandPrimaryColor.trim()
            : null,
          brandAccentColor: values.brandAccentColor?.trim()
            ? values.brandAccentColor.trim()
            : null,
          studentLoginEnabled: normalizedStudentLogin,
          parentLoginEnabled: normalizedParentLogin,
          sessionOnlyJoinEnabled: Boolean(values.sessionOnlyJoinEnabled),
          teacherOnlyMode: normalizedTeacherOnly,
          teacherUserLimit: Number(values.teacherUserLimit ?? 0),
          studentUserLimit: normalizedTeacherOnly
            ? 0
            : normalizedStudentLogin
              ? Number(values.studentUserLimit ?? 0)
              : 0,
          parentUserLimit: normalizedTeacherOnly
            ? 0
            : normalizedParentLogin
              ? Number(values.parentUserLimit ?? 0)
              : 0,
        }
      : {};
    const storagePayload = canConfigureStorage
      ? {
          storageProviders: (values.storageProviders ?? []) as OrganizationStorageProvider[],
          defaultStorageProvider:
            values.defaultStorageProvider && values.defaultStorageProvider !== 'NONE'
              ? (values.defaultStorageProvider as OrganizationStorageProvider)
              : null,
          storageStatus: values.storageStatus as OrganizationStorageStatus,
        }
      : {};

    if (isEdit && organizationId) {
      updateMutation.mutate({
        organizationId,
        payload: {
          name: values.name,
          slug: values.slug,
          status: values.status as OrganizationStatus,
          supportEmail: values.supportEmail || null,
          supportPhone: values.supportPhone || null,
          ...commercialPayload,
          ...storagePayload,
        },
      });
    } else {
      createMutation.mutate({
        name: values.name,
        slug: values.slug || undefined,
        kind: values.kind as OrganizationKind,
        parentOrganizationId:
          values.kind === 'CUSTOMER' &&
          values.parentOrganizationId &&
          values.parentOrganizationId !== 'NONE'
            ? values.parentOrganizationId
            : null,
        supportEmail: values.supportEmail || null,
        supportPhone: values.supportPhone || null,
        ...commercialPayload,
        ...storagePayload,
      });
    }
  };

  const providerLabel = (val: string) =>
    STORAGE_PROVIDER_OPTIONS.find((option) => option.value === val)?.label ?? val;

  const buildRows = (v: FormValues): ConfirmRow[] => {
    const rows: ConfirmRow[] = [
      { label: 'Name', value: v.name },
      { label: 'Slug', value: v.slug || '—' },
      { label: 'Kind', value: ORG_KIND_LABEL[v.kind as OrganizationKind] ?? v.kind },
    ];
    if (!isEdit && v.kind === 'CUSTOMER') {
      const parentName =
        v.parentOrganizationId && v.parentOrganizationId !== 'NONE'
          ? partnerOrganizations.find((o) => o.id === v.parentOrganizationId)?.name ??
            v.parentOrganizationId
          : 'No parent (direct customer)';
      rows.push({ label: 'Parent partner', value: parentName });
    }
    rows.push({ label: 'Status', value: v.status === 'INACTIVE' ? 'Inactive' : 'Active' });
    rows.push({ label: 'Support email', value: v.supportEmail || '—' });
    rows.push({ label: 'Support phone', value: v.supportPhone || '—' });
    if (isSuperAdmin) {
      rows.push({
        label: 'Branding mode',
        value: BRANDING_MODE_LABEL[v.brandingMode as BrandingMode],
      });
      if (v.brandingMode !== 'SOFTLOGIC') {
        if (v.brandName?.trim()) rows.push({ label: 'Brand name', value: v.brandName.trim() });
        if (v.brandPrimaryColor?.trim())
          rows.push({ label: 'Primary color', value: v.brandPrimaryColor.trim() });
        if (v.brandAccentColor?.trim())
          rows.push({ label: 'Accent color', value: v.brandAccentColor.trim() });
      }
      rows.push({ label: 'Student login', value: v.studentLoginEnabled ? 'Enabled' : 'Disabled' });
      rows.push({ label: 'Parent login', value: v.parentLoginEnabled ? 'Enabled' : 'Disabled' });
      rows.push({
        label: 'Teacher-only mode',
        value: v.teacherOnlyMode ? 'Enabled' : 'Disabled',
      });
      rows.push({ label: 'Teacher users', value: Number(v.teacherUserLimit ?? 0) });
      rows.push({ label: 'Student users', value: Number(v.studentUserLimit ?? 0) });
      rows.push({ label: 'Parent users', value: Number(v.parentUserLimit ?? 0) });
      rows.push({
        label: 'Total users',
        value:
          Number(v.teacherUserLimit ?? 0) +
          Number(v.studentUserLimit ?? 0) +
          Number(v.parentUserLimit ?? 0),
      });
    }
    if ((v.aiCreditTokens ?? 0) > 0) {
      rows.push({ label: 'Assigned AI credits', value: Number(v.aiCreditTokens ?? 0) });
      rows.push({
        label: 'AI credits after allocation',
        value: Math.max(assignableAiTokens - Number(v.aiCreditTokens ?? 0), 0),
      });
    }
    rows.push({
      label: 'AI allocation change',
      value:
        Number(v.aiCreditTokens ?? 0) - currentAssignedAiTokens === 0
          ? 'No change'
          : Number(v.aiCreditTokens ?? 0) - currentAssignedAiTokens,
    });
    if (canConfigureStorage) {
      const providers = (v.storageProviders ?? []) as string[];
      rows.push({
        label: 'Storage providers',
        value: providers.length ? providers.map(providerLabel).join(', ') : 'None',
      });
      if (providers.length) {
        rows.push({
          label: 'Default provider',
          value:
            v.defaultStorageProvider && v.defaultStorageProvider !== 'NONE'
              ? providerLabel(v.defaultStorageProvider)
              : 'Not configured',
        });
        rows.push({
          label: 'Storage status',
          value: STORAGE_STATUS_LABEL[v.storageStatus as OrganizationStorageStatus],
        });
      }
    }
    return rows;
  };

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
            {kind === 'CUSTOMER' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Parent partner</label>
                <Select
                  disabled={isEdit || actor?.role !== 'SUPER_ADMIN'}
                  value={parentOrganizationId}
                  onValueChange={(value) => setValue('parentOrganizationId', value)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">No parent (direct customer)</SelectItem>
                    {partnerOrganizations.filter((org) => org.kind === 'PARTNER').map((org) => (
                      <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-ink-500">
                  Optional — pick a partner if this customer is being resold through them.
                </p>
              </div>
            )}
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Support email</label>
              <Input type="email" placeholder="support@school.edu" {...register('supportEmail')} />
              {errors.supportEmail && (
                <p className="text-xs text-danger">{errors.supportEmail.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Support phone</label>
              <Input placeholder="+91 98765 43210" {...register('supportPhone')} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Teacher users</label>
              <Input
                type="number"
                min={0}
                disabled={!isSuperAdmin}
                {...register('teacherUserLimit', { valueAsNumber: true })}
              />
              {errors.teacherUserLimit && (
                <p className="text-xs text-danger">{errors.teacherUserLimit.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Student users</label>
              <Input
                type="number"
                min={0}
                disabled={!isSuperAdmin || teacherOnlyMode || !studentLoginEnabled}
                {...register('studentUserLimit', { valueAsNumber: true })}
              />
              {errors.studentUserLimit && (
                <p className="text-xs text-danger">{errors.studentUserLimit.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Parent users</label>
              <Input
                type="number"
                min={0}
                disabled={!isSuperAdmin || teacherOnlyMode || !parentLoginEnabled}
                {...register('parentUserLimit', { valueAsNumber: true })}
              />
              {errors.parentUserLimit && (
                <p className="text-xs text-danger">{errors.parentUserLimit.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Total users</label>
              <Input type="number" value={totalUserLimit} disabled readOnly />
              {errors.studentLoginEnabled && (
                <p className="text-xs text-danger">{errors.studentLoginEnabled.message}</p>
              )}
            </div>
          </div>
          <div className="grid gap-4 rounded-lg border border-line bg-surface-variant px-4 py-4 sm:grid-cols-[1fr_1fr_1fr_1fr]">
            <div>
              <div className="flex items-center gap-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Assigned AI credits</p>
                <AiCreditInfoButton />
              </div>
              <p className="mt-1 text-lg font-black text-ink-900">
                {currentAssignedAiTokens.toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-ink-500">
                {sourceAvailableAiTokens.toLocaleString('en-IN')} source available
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Set AI credits</label>
              <Input
                type="number"
                min={0}
                max={assignableAiTokens}
                disabled={!canAssignOrgAiCredits}
                {...register('aiCreditTokens', { valueAsNumber: true })}
              />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Change</p>
              <p className="mt-1 text-lg font-black text-ink-900">
                {aiAllocationDelta === 0 ? 'No change' : aiAllocationDelta.toLocaleString('en-IN')}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Source after allocation</p>
              <p className="mt-1 text-lg font-black text-ink-900">
                {afterAiAllocation.toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-ink-500">Central AI wallet preview</p>
            </div>
          </div>
        </Card>

        <Card className="space-y-5 px-6 py-5">
          <div>
            <h3 className="text-base font-bold text-ink-900">Launch Policies</h3>
            <p className="text-sm text-ink-500">Commercial login, branding, and storage controls for production.</p>
          </div>
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Branding mode</label>
              <Select
                disabled={!isSuperAdmin}
                value={brandingMode}
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

            {/* White-label identity: only meaningful when branding != SoftLogic.
                Editable by Super Admin, shown read-only to other admins. */}
            {isWhiteLabel && (
              <div className="space-y-4 rounded-lg border border-line bg-surface-variant p-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Brand name</label>
                  <Input
                    placeholder="Acme Learning"
                    disabled={!isSuperAdmin}
                    {...register('brandName')}
                  />
                  <p className="text-xs text-ink-500">Shown in place of “SoftLogic” for white-label workspaces.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Primary color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        disabled={!isSuperAdmin}
                        value={brandPrimaryColor || '#08357c'}
                        onChange={(event) =>
                          setValue('brandPrimaryColor', event.target.value, { shouldDirty: true })
                        }
                        className="h-9 w-10 shrink-0 cursor-pointer rounded border border-line bg-white p-0.5 disabled:cursor-not-allowed"
                        aria-label="Primary brand color"
                      />
                      <Input placeholder="#08357C" disabled={!isSuperAdmin} {...register('brandPrimaryColor')} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Accent color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        disabled={!isSuperAdmin}
                        value={brandAccentColor || '#f97316'}
                        onChange={(event) =>
                          setValue('brandAccentColor', event.target.value, { shouldDirty: true })
                        }
                        className="h-9 w-10 shrink-0 cursor-pointer rounded border border-line bg-white p-0.5 disabled:cursor-not-allowed"
                        aria-label="Accent brand color"
                      />
                      <Input placeholder="#F97316" disabled={!isSuperAdmin} {...register('brandAccentColor')} />
                    </div>
                  </div>
                </div>
                {isEdit && isSuperAdmin && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Brand logo</label>
                    <div className="flex items-center gap-3 rounded-lg border border-line bg-white px-3 py-2">
                      {organization?.logoUrl ? (
                        <img
                          src={organization.logoUrl}
                          alt="Organization logo"
                          className="h-10 w-10 rounded object-contain"
                        />
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
                          if (file) uploadLogoMutation.mutate(file);
                          event.target.value = '';
                        }}
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => logoInputRef.current?.click()}
                          disabled={uploadLogoMutation.isPending}
                        >
                          {uploadLogoMutation.isPending ? 'Uploading…' : 'Upload'}
                        </Button>
                        {organization?.logoUrl && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLogoMutation.mutate()}
                            disabled={removeLogoMutation.isPending}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Storage providers</label>
              <div className="grid gap-2">
                {STORAGE_PROVIDER_OPTIONS.map((provider) => (
                  <label
                    key={provider.value}
                    className="flex items-center justify-between rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink-700"
                  >
                    <span>{provider.label}</span>
                    <input
                      type="checkbox"
                      disabled={!canConfigureStorage}
                      checked={storageProviders.includes(provider.value)}
                      onChange={() => toggleStorageProvider(provider.value)}
                      className="h-4 w-4 rounded border-line text-brand-primary"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Default provider</label>
              <Select
                disabled={!canConfigureStorage || storageProviders.length === 0}
                value={defaultStorageProvider}
                onValueChange={(value) => setValue('defaultStorageProvider', value)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Not configured</SelectItem>
                  {STORAGE_PROVIDER_OPTIONS.filter((provider) =>
                    storageProviders.includes(provider.value),
                  ).map((provider) => (
                    <SelectItem key={provider.value} value={provider.value}>
                      {provider.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Storage status</label>
              <Select
                disabled={!canConfigureStorage || storageProviders.length === 0}
                value={storageStatus}
                onValueChange={(value) => setValue('storageStatus', value)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STORAGE_STATUS_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 rounded-lg border border-line bg-surface-variant p-2 sm:col-span-2">
              {[
                ['studentLoginEnabled', 'Student dashboard login', studentLoginEnabled],
                ['parentLoginEnabled', 'Parent dashboard login', parentLoginEnabled],
                ['teacherOnlyMode', 'Teacher-only customer mode', teacherOnlyMode],
              ].map(([name, label, checked]) => (
                <label
                  key={name as string}
                  className="flex min-h-10 items-center gap-2 rounded-md bg-white px-3 text-sm font-medium text-ink-700 shadow-sm ring-1 ring-line/80"
                >
                  <input
                    type="checkbox"
                    disabled={
                      !isSuperAdmin ||
                      (teacherOnlyMode &&
                        (name === 'studentLoginEnabled' ||
                          name === 'parentLoginEnabled'))
                    }
                    checked={Boolean(checked)}
                    onChange={(event) =>
                      setValue(name as keyof FormValues, event.target.checked, {
                        shouldDirty: true,
                      })
                    }
                    className="h-4 w-4 shrink-0 rounded border-line text-brand-primary"
                  />
                  <span className="whitespace-nowrap">{label}</span>
                </label>
              ))}
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

      <ConfirmSubmitDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={isEdit ? 'Save organization changes?' : 'Create this organization?'}
        description="Review the details below before saving."
        rows={pendingValues ? buildRows(pendingValues) : []}
        confirmLabel={isEdit ? 'Save changes' : 'Create organization'}
        loading={submitting}
        onConfirm={runSubmit}
      />
    </form>
  );
}
