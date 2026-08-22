import type { SafeUserContext } from '@/types/api';

export const MAINTENANCE_SUPER_ADMIN_EMAILS = new Set([
  'admin@softlogicwhiteboard.com',
  'anirudha@softlogic.co.in',
]);

export function canManageMaintenance(
  user: SafeUserContext | null | undefined,
): boolean {
  return (
    user?.role === 'SUPER_ADMIN' &&
    MAINTENANCE_SUPER_ADMIN_EMAILS.has(user.email.trim().toLowerCase())
  );
}
