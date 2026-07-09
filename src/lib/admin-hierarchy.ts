import type { AdminOrganization } from '@/types/api';

export const ALL_PARTNERS_VALUE = 'ALL';

export function partnerOrganizations(organizations: AdminOrganization[]) {
  return organizations.filter((organization) => organization.kind === 'PARTNER');
}

// Every organization id in the subtree rooted at `rootId` (the root itself plus
// all descendants, any depth). Used so nested sub-partners and their orgs are
// treated as part of the selected partner's scope.
export function descendantOrganizationIds(
  organizations: AdminOrganization[],
  rootId: string,
): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const organization of organizations) {
    const parentId = organization.parentOrganizationId;
    if (!parentId) continue;
    const bucket = childrenByParent.get(parentId);
    if (bucket) bucket.push(organization.id);
    else childrenByParent.set(parentId, [organization.id]);
  }

  const collected = new Set<string>([rootId]);
  const frontier = [rootId];
  while (frontier.length > 0) {
    const current = frontier.pop() as string;
    for (const childId of childrenByParent.get(current) ?? []) {
      if (!collected.has(childId)) {
        collected.add(childId);
        frontier.push(childId);
      }
    }
  }
  return collected;
}

export function organizationsForPartner(
  organizations: AdminOrganization[],
  partnerOrganizationId: string,
) {
  if (partnerOrganizationId === ALL_PARTNERS_VALUE) return organizations;
  const scope = descendantOrganizationIds(organizations, partnerOrganizationId);
  return organizations.filter((organization) => scope.has(organization.id));
}

export function organizationBelongsToPartner(
  organization: AdminOrganization | undefined,
  partnerOrganizationId: string,
  organizations: AdminOrganization[] = [],
) {
  if (!organization || partnerOrganizationId === ALL_PARTNERS_VALUE) return true;
  if (organization.id === partnerOrganizationId) return true;
  return descendantOrganizationIds(organizations, partnerOrganizationId).has(
    organization.id,
  );
}

// Depth of an organization within its partner chain (0 = top-level). Used to
// indent nested partners in cascading dropdowns so the hierarchy reads clearly.
export function organizationDepth(
  organizations: AdminOrganization[],
  organizationId: string,
): number {
  const byId = new Map(organizations.map((organization) => [organization.id, organization]));
  let depth = 0;
  let current = byId.get(organizationId);
  const guard = new Set<string>();
  while (current?.parentOrganizationId && !guard.has(current.id)) {
    guard.add(current.id);
    current = byId.get(current.parentOrganizationId);
    if (!current) break;
    depth += 1;
  }
  return depth;
}
