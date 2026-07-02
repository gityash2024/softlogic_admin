import type { SafeUserContext } from '@/types/api';

export const MAINTENANCE_SUPER_ADMIN_EMAIL = 'anirudha@softlogic.co.in';

export function canManageMaintenance(
  user: SafeUserContext | null | undefined,
): boolean {
  return (
    user?.role === 'SUPER_ADMIN' &&
    user.email.trim().toLowerCase() === MAINTENANCE_SUPER_ADMIN_EMAIL
  );
}
