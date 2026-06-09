import type { AdminOrganization, UserRole } from '@/types/api';

export const LICENSED_USER_ROLES: UserRole[] = ['TEACHER', 'STUDENT', 'PARENT'];

export function roleLimitForOrganization(
  organization: AdminOrganization,
  role: UserRole,
): number | null {
  if (role === 'TEACHER') return organization.teacherUserLimit;
  if (role === 'STUDENT') return organization.studentUserLimit;
  if (role === 'PARENT') return organization.parentUserLimit;
  return null;
}

export function rolePolicyBlockReason(
  organization: AdminOrganization | null,
  role: UserRole,
): string | null {
  if (!LICENSED_USER_ROLES.includes(role)) return null;
  if (!organization) return 'Select an organization first';
  if (organization.teacherOnlyMode && (role === 'STUDENT' || role === 'PARENT')) {
    return 'Teacher-only organization';
  }
  if (role === 'STUDENT' && !organization.studentLoginEnabled) {
    return 'Student users disabled';
  }
  if (role === 'PARENT' && !organization.parentLoginEnabled) {
    return 'Parent users disabled';
  }
  const limit = roleLimitForOrganization(organization, role);
  if (limit === 0) return `${role.toLowerCase()} cap is 0`;
  return null;
}
