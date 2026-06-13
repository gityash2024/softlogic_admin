import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Cloud, ExternalLink, RefreshCw, Unplug } from 'lucide-react';
import { toast } from 'sonner';

import { useAuthStore } from '@/lib/auth-store';
import { extractApiError } from '@/lib/api';
import { integrationsApi } from '@/services/integrations.api';
import { organizationsApi } from '@/services/organizations.api';
import type {
  AdminOrganization,
  OrganizationStorageProvider,
  OrganizationSummary,
} from '@/types/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
    environment: string[];
    callback: string;
    consoleLabel: string;
    consoleUrl: string;
    scopes: string;
  }
> = {
  GOOGLE_DRIVE: {
    label: 'Google Drive',
    environment: ['GOOGLE_DRIVE_CLIENT_ID', 'GOOGLE_DRIVE_CLIENT_SECRET'],
    callback: '/oauth/google-drive/callback',
    consoleLabel: 'Google Cloud Console',
    consoleUrl: 'https://console.cloud.google.com/apis/credentials',
    scopes: 'Google Drive API: drive.file',
  },
  DROPBOX: {
    label: 'Dropbox',
    environment: ['DROPBOX_CLIENT_ID', 'DROPBOX_CLIENT_SECRET'],
    callback: '/oauth/dropbox/callback',
    consoleLabel: 'Dropbox App Console',
    consoleUrl: 'https://www.dropbox.com/developers/apps',
    scopes: 'files.metadata.read, files.content.read, files.content.write',
  },
  ONEDRIVE: {
    label: 'OneDrive',
    environment: ['ONEDRIVE_CLIENT_ID', 'ONEDRIVE_CLIENT_SECRET', 'ONEDRIVE_REDIRECT_URI'],
    callback: '/oauth/onedrive/callback',
    consoleLabel: 'Microsoft Entra admin center',
    consoleUrl: 'https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade',
    scopes: 'Microsoft Graph: User.Read, Files.ReadWrite, offline_access',
  },
};

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? 'https://softlogic-api.mymultimeds.com/api/v1';
const backendOrigin = apiBaseUrl.replace(/\/api\/v1\/?$/, '');

function ProviderConnection({
  organizationId,
  provider,
  showDeploymentHelp,
}: {
  organizationId: string;
  provider: OrganizationStorageProvider;
  showDeploymentHelp: boolean;
}) {
  const queryClient = useQueryClient();
  const details = PROVIDER_DETAILS[provider];
  const callbackUrl = `${backendOrigin}${details.callback}`;
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

  return (
    <div className="rounded-lg border border-line bg-white px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-ink-900">{details.label}</p>
            <Badge
              variant={status?.connected ? 'success' : status?.configured ? 'warning' : 'default'}
            >
              {statusQuery.isLoading
                ? 'Checking'
                : status?.connected
                  ? 'Connected'
                  : status?.configured
                    ? 'Ready to connect'
                    : 'Credentials required'}
            </Badge>
          </div>
          <p className="mt-1 text-xs leading-5 text-ink-500">
            {status?.message || `Connect ${details.label} for organization-wide import and export.`}
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
              disabled={connectMutation.isPending}
            >
              <ExternalLink className="h-4 w-4" />
              Connect
            </Button>
          )}
        </div>
      </div>
      {showDeploymentHelp && (
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
            <li>4. Copy the client ID and client secret into the backend deployment.</li>
            <li className="break-words">
              Required server variables: <code>{details.environment.join(', ')}</code>
            </li>
            <li>
              5. Redeploy the backend, select Connect above, approve access in the provider window,
              then refresh the connection status.
            </li>
          </ol>
        </details>
      )}
    </div>
  );
}

function allowedProviders(organization: AdminOrganization | OrganizationSummary) {
  return organization.kind === 'INTERNAL'
    ? ALL_PROVIDERS
    : ALL_PROVIDERS.filter((provider) => organization.storageProviders.includes(provider));
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

  if (!canManage) return null;

  const selected = organizations.find((organization) => organization.id === organizationId);
  const providers = selected ? allowedProviders(selected) : [];

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
              Organization-wide connections used by the whiteboard import and export menus.
            </p>
          </div>
        </div>
      </div>
      <div className="space-y-4 px-4 py-5 sm:px-6">
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
          providers.map((provider) => (
            <ProviderConnection
              key={`${selected.id}-${provider}`}
              organizationId={selected.id}
              provider={provider}
              showDeploymentHelp={isSuperAdmin}
            />
          ))
        ) : (
          <p className="rounded-lg border border-dashed border-warning/40 bg-warning/5 px-3 py-3 text-sm text-warning">
            No remote storage provider was enabled when this organization was created. Ask the
            SoftLogic Super Admin to enable one in the organization form.
          </p>
        )}
      </div>
    </Card>
  );
}
