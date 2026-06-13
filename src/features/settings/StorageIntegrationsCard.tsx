import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Cloud, ExternalLink, RefreshCw, Save, Trash2, Unplug } from 'lucide-react';
import { toast } from 'sonner';

import { useAuthStore } from '@/lib/auth-store';
import { extractApiError } from '@/lib/api';
import { integrationsApi } from '@/services/integrations.api';
import { organizationsApi } from '@/services/organizations.api';
import type {
  AdminOrganization,
  OrganizationStorageProvider,
  OrganizationSummary,
  StorageCredentialConfig,
  StorageCredentialScope,
} from '@/types/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ALL_PROVIDERS: OrganizationStorageProvider[] = [
  'GOOGLE_DRIVE',
  'DROPBOX',
  'ONEDRIVE',
];

const PROVIDER_DETAILS: Record<
  OrganizationStorageProvider,
  {
    label: string;
    callback: string;
    consoleLabel: string;
    consoleUrl: string;
    scopes: string;
  }
> = {
  GOOGLE_DRIVE: {
    label: 'Google Drive',
    callback: '/oauth/google-drive/callback',
    consoleLabel: 'Google Cloud Console',
    consoleUrl: 'https://console.cloud.google.com/apis/credentials',
    scopes: 'Google Drive API: drive.file',
  },
  DROPBOX: {
    label: 'Dropbox',
    callback: '/oauth/dropbox/callback',
    consoleLabel: 'Dropbox App Console',
    consoleUrl: 'https://www.dropbox.com/developers/apps',
    scopes: 'files.metadata.read, files.content.read, files.content.write',
  },
  ONEDRIVE: {
    label: 'OneDrive',
    callback: '/oauth/onedrive/callback',
    consoleLabel: 'Microsoft Entra admin center',
    consoleUrl: 'https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade',
    scopes: 'Microsoft Graph: User.Read, Files.ReadWrite, offline_access',
  },
};

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? 'https://softlogic-api.mymultimeds.com/api/v1';
const backendOrigin = apiBaseUrl.replace(/\/api\/v1\/?$/, '');

function credentialSourceLabel(source?: string) {
  if (source === 'GLOBAL') return 'Using SoftLogic global credentials';
  if (source === 'ORGANIZATION') return 'Using organization credentials';
  if (source === 'ENV_LEGACY') return 'Using legacy backend credentials';
  return 'Credentials not saved';
}

function allowedProviders(organization: AdminOrganization | OrganizationSummary) {
  return organization.kind === 'INTERNAL'
    ? ALL_PROVIDERS
    : ALL_PROVIDERS.filter((provider) => organization.storageProviders.includes(provider));
}

function ProviderCredentialForm({
  provider,
  scope,
  organizationId,
  record,
  canDelete,
}: {
  provider: OrganizationStorageProvider;
  scope: StorageCredentialScope;
  organizationId?: string | null;
  record?: StorageCredentialConfig;
  canDelete: boolean;
}) {
  const queryClient = useQueryClient();
  const details = PROVIDER_DETAILS[provider];
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [redirectUri, setRedirectUri] = useState(record?.redirectUri ?? '');
  const callbackUrl = `${backendOrigin}${details.callback}`;
  const queryKey = ['storage-credentials', scope, organizationId ?? 'global'];

  const saveMutation = useMutation({
    mutationFn: () =>
      integrationsApi.saveStorageCredential(provider, {
        scope,
        organizationId: scope === 'ORGANIZATION' ? organizationId : null,
        clientId: clientId || null,
        clientSecret: clientSecret || null,
        redirectUri: redirectUri || null,
      }),
    onSuccess: () => {
      toast.success(`${details.label} credentials saved`);
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['integration-status'] });
      setClientId('');
      setClientSecret('');
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      integrationsApi.deleteStorageCredential(provider, {
        scope,
        organizationId: scope === 'ORGANIZATION' ? organizationId : null,
      }),
    onSuccess: () => {
      toast.success(`${details.label} credentials removed`);
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['integration-status'] });
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const hasExisting = Boolean(record?.configured);
  const canSave = hasExisting || (clientId.trim().length > 0 && clientSecret.trim().length > 0);

  return (
    <div className="rounded-lg border border-line bg-white px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-ink-900">{details.label}</p>
            <Badge variant={hasExisting ? 'success' : 'default'}>
              {hasExisting ? 'Credentials saved' : 'Not saved'}
            </Badge>
          </div>
          <p className="mt-1 text-xs leading-5 text-ink-500">
            {scope === 'GLOBAL'
              ? 'SoftLogic-wide default credentials for organizations without their own override.'
              : 'Optional organization override. Leave empty to use SoftLogic global credentials.'}
          </p>
          {record?.clientIdPreview && (
            <p className="mt-1 text-xs text-ink-500">
              Client ID: <span className="font-medium text-ink-700">{record.clientIdPreview}</span>
            </p>
          )}
        </div>
        {canDelete && hasExisting && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="h-4 w-4" />
            Remove
          </Button>
        )}
      </div>

      <details className="mt-3 border-t border-line pt-3">
        <summary className="cursor-pointer text-xs font-semibold text-brand-primary">
          Credential setup steps
        </summary>
        <ol className="mt-2 space-y-1.5 text-xs leading-5 text-ink-500">
          <li>
            1. Open the{' '}
            <a
              className="font-semibold text-brand-primary underline"
              href={details.consoleUrl}
              target="_blank"
              rel="noreferrer"
            >
              {details.consoleLabel}
            </a>{' '}
            and create an OAuth web application.
          </li>
          <li>2. Enable permissions: <code>{details.scopes}</code></li>
          <li className="break-all">3. Register redirect URI: <code>{callbackUrl}</code></li>
          <li>4. Paste the client ID and secret below, save, then connect the provider.</li>
        </ol>
      </details>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
            Client ID
          </label>
          <Input
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            placeholder={record?.clientIdPreview ?? 'OAuth client ID'}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
            Client secret
          </label>
          <Input
            type="password"
            value={clientSecret}
            onChange={(event) => setClientSecret(event.target.value)}
            placeholder={hasExisting ? 'Leave blank to keep existing' : 'OAuth client secret'}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
            Redirect URI
          </label>
          <Input
            value={redirectUri}
            onChange={(event) => setRedirectUri(event.target.value)}
            placeholder={callbackUrl}
          />
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <Button
          type="button"
          size="sm"
          variant="primary"
          onClick={() => saveMutation.mutate()}
          disabled={!canSave || saveMutation.isPending}
        >
          <Save className="h-4 w-4" />
          Save credentials
        </Button>
      </div>
    </div>
  );
}

function ProviderConnection({
  organizationId,
  provider,
}: {
  organizationId: string;
  provider: OrganizationStorageProvider;
}) {
  const queryClient = useQueryClient();
  const details = PROVIDER_DETAILS[provider];
  const queryKey = ['integration-status', organizationId, provider];
  const statusQuery = useQuery({
    queryKey,
    queryFn: () => integrationsApi.status(provider, organizationId),
  });
  const connectMutation = useMutation({
    mutationFn: () => integrationsApi.oauthUrl(provider, organizationId),
    onSuccess: (result) => {
      if (!result.configured || !result.authUrl) {
        toast.error(result.message || `${details.label} credentials are not configured.`);
        return;
      }
      window.open(result.authUrl, '_blank', 'noopener,noreferrer');
      toast.info(`Complete ${details.label} authorization, then refresh its status.`);
    },
    onError: (error) => toast.error(extractApiError(error)),
  });
  const disconnectMutation = useMutation({
    mutationFn: () => integrationsApi.disconnect(provider, organizationId),
    onSuccess: () => {
      toast.success(`${details.label} disconnected`);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => toast.error(extractApiError(error)),
  });
  const status = statusQuery.data;
  const credentialReady = status?.credentialConfigured ?? status?.configured;

  return (
    <div className="rounded-lg border border-line bg-white px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-ink-900">{details.label}</p>
            <Badge
              variant={status?.connected ? 'success' : credentialReady ? 'warning' : 'default'}
            >
              {statusQuery.isLoading
                ? 'Checking'
                : status?.connected
                  ? 'Connected'
                  : credentialReady
                    ? 'Ready to connect'
                    : 'Credentials required'}
            </Badge>
          </div>
          <p className="mt-1 text-xs leading-5 text-ink-500">
            {status?.message || `Connect ${details.label} for organization-wide import and export.`}
          </p>
          <p className="mt-1 text-xs font-medium text-ink-600">
            {credentialSourceLabel(status?.credentialSource)}
          </p>
          {status?.externalAccountEmail && (
            <p className="mt-1 text-xs font-medium text-ink-600">
              Account: {status.externalAccountEmail}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label={`Refresh ${details.label} status`}
            title={`Refresh ${details.label} status`}
            onClick={() => statusQuery.refetch()}
            disabled={statusQuery.isFetching}
          >
            {statusQuery.isFetching ? <Spinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          {status?.connected ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
            >
              <Unplug className="h-4 w-4" />
              Disconnect
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="primary"
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending || !credentialReady}
            >
              <ExternalLink className="h-4 w-4" />
              Connect
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function StorageIntegrationsCard() {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const canManage =
    isSuperAdmin ||
    user?.role === 'ADMIN' ||
    user?.role === 'PARTNER_ADMIN' ||
    user?.role === 'CUSTOMER_ADMIN';
  const organizationsQuery = useQuery({
    queryKey: ['organizations', 'storage-settings'],
    queryFn: organizationsApi.all,
    enabled: isSuperAdmin,
  });
  const organizations = isSuperAdmin
    ? organizationsQuery.data ?? []
    : user?.primaryOrganization
      ? [user.primaryOrganization]
      : [];
  const [requestedOrganizationId, setRequestedOrganizationId] = useState('');
  const preferredOrganization =
    organizations.find((organization) => organization.kind === 'INTERNAL') ??
    organizations[0];
  const organizationId = organizations.some(
    (organization) => organization.id === requestedOrganizationId,
  )
    ? requestedOrganizationId
    : preferredOrganization?.id ?? '';
  const selected = organizations.find((organization) => organization.id === organizationId);
  const providers = selected ? allowedProviders(selected) : [];
  const globalCredentialsQuery = useQuery({
    queryKey: ['storage-credentials', 'GLOBAL', 'global'],
    queryFn: () => integrationsApi.storageCredentials({ scope: 'GLOBAL' }),
    enabled: canManage && isSuperAdmin,
  });
  const organizationCredentialsQuery = useQuery({
    queryKey: ['storage-credentials', 'ORGANIZATION', organizationId],
    queryFn: () =>
      integrationsApi.storageCredentials({
        scope: 'ORGANIZATION',
        organizationId,
      }),
    enabled: canManage && Boolean(organizationId),
  });

  if (!canManage) return null;

  const globalCredentials = globalCredentialsQuery.data ?? [];
  const organizationCredentials = organizationCredentialsQuery.data ?? [];

  return (
    <Card>
      <div className="border-b border-line px-4 py-5 sm:px-6">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
            <Cloud className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-ink-900">Storage integrations</h2>
            <p className="text-sm text-ink-500">
              Save provider credentials in the web panel and connect organization storage accounts.
            </p>
          </div>
        </div>
      </div>
      <div className="space-y-5 px-4 py-5 sm:px-6">
        {isSuperAdmin && (
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-ink-900">Global storage credentials</h3>
              <p className="text-xs leading-5 text-ink-500">
                SoftLogic defaults used by internal workspaces and organizations without an override.
              </p>
            </div>
            {ALL_PROVIDERS.map((provider) => (
              <ProviderCredentialForm
                key={`global-${provider}-${globalCredentials.find((item) => item.provider === provider)?.updatedAt ?? 'new'}`}
                provider={provider}
                scope="GLOBAL"
                record={globalCredentials.find((item) => item.provider === provider)}
                canDelete
              />
            ))}
          </section>
        )}

        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-ink-900">Organization storage</h3>
            <p className="text-xs leading-5 text-ink-500">
              Connect the account Flutter will use for import, open, and export.
            </p>
          </div>
          {isSuperAdmin && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                Organization
              </label>
              <Select value={organizationId} onValueChange={setRequestedOrganizationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((organization) => (
                    <SelectItem key={organization.id} value={organization.id}>
                      {organization.name} ({organization.kind.toLowerCase()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {organizationsQuery.isLoading && isSuperAdmin ? (
            <div className="flex items-center gap-2 text-sm text-ink-500">
              <Spinner className="h-4 w-4" />
              Loading organizations...
            </div>
          ) : !selected ? (
            <p className="rounded-lg border border-dashed border-line px-3 py-3 text-sm text-ink-500">
              No organization is available for storage configuration.
            </p>
          ) : providers.length ? (
            <div className="space-y-3">
              {providers.map((provider) => (
                <div key={`${selected.id}-${provider}`} className="space-y-3">
                  <ProviderCredentialForm
                    key={`${selected.id}-${provider}-${organizationCredentials.find((item) => item.provider === provider)?.updatedAt ?? 'new'}`}
                    provider={provider}
                    scope="ORGANIZATION"
                    organizationId={selected.id}
                    record={organizationCredentials.find((item) => item.provider === provider)}
                    canDelete
                  />
                  <ProviderConnection organizationId={selected.id} provider={provider} />
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-warning/40 bg-warning/5 px-3 py-3 text-sm text-warning">
              No remote storage provider was enabled when this organization was created. Ask the
              SoftLogic Super Admin to enable one in the organization form.
            </p>
          )}
        </section>
      </div>
    </Card>
  );
}
