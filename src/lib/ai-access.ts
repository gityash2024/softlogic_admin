import type { SafeUserContext } from '@/types/api';

const AI_MODULE_SUPER_ADMIN_EMAILS = new Set([
  'admin@softlogicwhiteboard.com',
  'anirudha@softlogic.co.in',
]);

export function canAccessAiModule(user: SafeUserContext | null | undefined): boolean {
  return (
    user?.role === 'SUPER_ADMIN' &&
    AI_MODULE_SUPER_ADMIN_EMAILS.has(user.email.trim().toLowerCase())
  );
}
