import type { AdminOrganization } from '@/types/api';

export const ALL_PARTNERS_VALUE = 'ALL';

export function partnerOrganizations(organizations: AdminOrganization[]) {
  return organizations.filter((organization) => organization.kind === 'PARTNER');
}

export function organizationsForPartner(
  organizations: AdminOrganization[],
  partnerOrganizationId: string,
) {
  if (partnerOrganizationId === ALL_PARTNERS_VALUE) return organizations;
  return organizations.filter(
    (organization) =>
      organization.id === partnerOrganizationId ||
      organization.parentOrganizationId === partnerOrganizationId,
  );
}

export function organizationBelongsToPartner(
  organization: AdminOrganization | undefined,
  partnerOrganizationId: string,
) {
  if (!organization || partnerOrganizationId === ALL_PARTNERS_VALUE) return true;
  return (
    organization.id === partnerOrganizationId ||
    organization.parentOrganizationId === partnerOrganizationId
  );
}
