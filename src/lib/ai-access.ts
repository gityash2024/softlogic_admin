import type { SafeUserContext } from '@/types/api';

const AI_MODULE_SUPER_ADMIN_EMAIL = 'anirudha@softlogic.co.in';

export function canAccessAiModule(user: SafeUserContext | null | undefined): boolean {
  return (
    user?.role === 'SUPER_ADMIN' &&
    user.email.trim().toLowerCase() === AI_MODULE_SUPER_ADMIN_EMAIL
  );
}
