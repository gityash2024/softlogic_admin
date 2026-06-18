import { useMemo, useState } from 'react';
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
    missingSetupMessage: string;
  }
> = {
  GOOGLE_DRIVE: {
    label: 'Google Drive',
    missingSetupMessage:
      'SoftLogic cloud app is not configured for Google Drive. Ask the deployment admin to add Google OAuth credentials.',
  },
  DROPBOX: {
    label: 'Dropbox',
    missingSetupMessage:
      'SoftLogic cloud app is not configured for Dropbox. Ask the deployment admin to add Dropbox OAuth credentials.',
  },
  ONEDRIVE: {
    label: 'OneDrive',
    missingSetupMessage:
      'SoftLogic cloud app is not configured for OneDrive. Ask the deployment admin to add Microsoft OAuth credentials.',
  },
};

type StorageOrganization = Pick<
  AdminOrganization | OrganizationSummary,
  'id' | 'kind' | 'name' | 'storageProviders'
>;

function allowedProviders(organization: StorageOrganization) {
  return organization.kind === 'INTERNAL'
    ? ALL_PROVIDERS
    : ALL_PROVIDERS.filter((provider) => organization.storageProviders.includes(provider));
}

function providerStatusLabel({
  connected,
  credentialReady,
  isLoading,
}: {
  connected?: boolean;
  credentialReady?: boolean;
  isLoading: boolean;
}) {
  if (isLoading) return 'Checking';
  if (connected) return 'Connected';
  if (credentialReady) return 'Ready to connect';
  return 'App setup needed';
}

function providerStatusVariant({
  connected,
  credentialReady,
}: {
  connected?: boolean;
  credentialReady?: boolean;
}) {
  if (connected) return 'success' as const;
  if (credentialReady) return 'warning' as const;
  return 'default' as const;
}

function ProviderConnection({
  organization,
  provider,
}: {
  organization: StorageOrganization;
  provider: OrganizationStorageProvider;
}) {
  const queryClient = useQueryClient();
  const details = PROVIDER_DETAILS[provider];
  const queryKey = ['integration-status', organization.id, provider];
  const statusQuery = useQuery({
    queryKey,
    queryFn: () => integrationsApi.status(provider, organization.id),
  });
  const connectMutation = useMutation({
    mutationFn: () => integrationsApi.oauthUrl(provider, organization.id),
    onSuccess: (result) => {
      if (!result.configured || !result.authUrl) {
        toast.error(result.message || details.missingSetupMessage);
        return;
      }
      const opened = window.open(result.authUrl, '_blank', 'noopener,noreferrer');
      if (!opened) {
        toast.error(`Allow pop-ups to connect ${details.label}.`);
        return;
      }
      toast.info(`Complete ${details.label} authorization in the browser tab.`);
      [4000, 10000, 20000, 35000].forEach((delay) => {
        window.setTimeout(() => {
          queryClient.invalidateQueries({ queryKey });
        }, delay);
      });
    },
    onError: (error) => toast.error(extractApiError(error)),
  });
  const disconnectMutation = useMutation({
    mutationFn: () => integrationsApi.disconnect(provider, organization.id),
    onSuccess: () => {
      toast.success(`${details.label} disconnected`);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => toast.error(extractApiError(error)),
  });
  const status = statusQuery.data;
  const credentialReady = status?.credentialConfigured ?? status?.configured;
  const message = !credentialReady
    ? details.missingSetupMessage
    : status?.connected
      ? status.message || `${details.label} is connected for ${organization.name}.`
      : `Connect the ${details.label} account this organization will use in Flutter.`;

  return (
    <div className="min-w-0 max-w-full rounded-lg border border-line bg-white px-4 py-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-ink-900">{details.label}</p>
            <Badge
              variant={providerStatusVariant({
                connected: status?.connected,
                credentialReady,
              })}
            >
              {providerStatusLabel({
                connected: status?.connected,
                credentialReady,
                isLoading: statusQuery.isLoading,
              })}
            </Badge>
          </div>
          <p className="mt-1 break-words text-xs leading-5 text-ink-500">{message}</p>
          {status?.externalAccountEmail && (
            <p className="mt-1 break-all text-xs font-medium text-ink-600">
              Account: {status.externalAccountEmail}
            </p>
          )}
        </div>
        <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto sm:self-start">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label={`Refresh ${details.label} status`}
            title={`Refresh ${details.label} status`}
            onClick={() => statusQuery.refetch()}
            disabled={statusQuery.isFetching}
          >
            {statusQuery.isFetching ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
          {status?.connected ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="flex-1 sm:flex-none"
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
              className="flex-1 sm:flex-none"
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
    queryKey: ['organizations', 'storage-settings', 'internal-only'],
    queryFn: organizationsApi.all,
    enabled: isSuperAdmin,
  });
  const superAdminOrganizations = useMemo(
    () => (organizationsQuery.data ?? []).filter((organization) => organization.kind === 'INTERNAL'),
    [organizationsQuery.data],
  );
  const organizations: StorageOrganization[] = isSuperAdmin
    ? superAdminOrganizations
    : user?.primaryOrganization
      ? [user.primaryOrganization]
      : [];
  const [requestedOrganizationId, setRequestedOrganizationId] = useState('');
  const organizationId = organizations.some(
    (organization) => organization.id === requestedOrganizationId,
  )
    ? requestedOrganizationId
    : organizations[0]?.id ?? '';
  const selected = organizations.find((organization) => organization.id === organizationId);
  const providers = selected ? allowedProviders(selected) : [];

  if (!canManage) return null;

  return (
    <Card className="max-w-full">
      <div className="border-b border-line px-4 py-5 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
            <Cloud className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-ink-900">Storage integrations</h2>
            <p className="break-words text-sm text-ink-500">
              Connect the cloud accounts teachers will use in Flutter for import, open, and export.
            </p>
          </div>
        </div>
      </div>
      <div className="min-w-0 space-y-4 px-4 py-5 sm:px-6">
        {organizationsQuery.isLoading && isSuperAdmin ? (
          <div className="flex items-center gap-2 text-sm text-ink-500">
            <Spinner className="h-4 w-4" />
            Loading internal workspace...
          </div>
        ) : !selected ? (
          <p className="rounded-lg border border-dashed border-line px-3 py-3 text-sm text-ink-500">
            No internal organization is available for storage configuration.
          </p>
        ) : (
          <>
            <div className="min-w-0 space-y-2">
              <h3 className="text-sm font-semibold text-ink-900">Organization storage</h3>
              {isSuperAdmin && organizations.length > 1 ? (
                <div className="min-w-0 space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                    Internal organization
                  </label>
                  <Select value={organizationId} onValueChange={setRequestedOrganizationId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select internal organization" />
                    </SelectTrigger>
                    <SelectContent>
                      {organizations.map((organization) => (
                        <SelectItem key={organization.id} value={organization.id}>
                          {organization.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <p className="break-words text-xs leading-5 text-ink-500">
                  {selected.name} ({selected.kind.toLowerCase()})
                </p>
              )}
            </div>

            {providers.length ? (
              <div className="min-w-0 space-y-3">
                {providers.map((provider) => (
                  <ProviderConnection
                    key={`${selected.id}-${provider}`}
                    organization={selected}
                    provider={provider}
                  />
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-warning/40 bg-warning/5 px-3 py-3 text-sm text-warning">
                No remote storage provider was enabled when this organization was created.
              </p>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
