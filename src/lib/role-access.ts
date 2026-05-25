import type { UserRole } from '@/types/api';

const RANK: Record<UserRole, number> = {
  STUDENT: 1,
  TEACHER: 2,
  CUSTOMER_ADMIN: 3,
  PARTNER_ADMIN: 4,
  ADMIN: 5,
  SUPER_ADMIN: 6,
};

export function manageableRoles(actorRole: UserRole | undefined): UserRole[] {
  if (!actorRole) return [];
  switch (actorRole) {
    case 'SUPER_ADMIN':
      return ['SUPER_ADMIN', 'PARTNER_ADMIN', 'CUSTOMER_ADMIN', 'ADMIN', 'TEACHER', 'STUDENT'];
    case 'PARTNER_ADMIN':
      return ['CUSTOMER_ADMIN', 'TEACHER', 'STUDENT'];
    case 'CUSTOMER_ADMIN':
    case 'ADMIN':
      return ['TEACHER', 'STUDENT'];
    default:
      return [];
  }
}

export function canManageUser(actor: UserRole | undefined, target: UserRole): boolean {
  if (!actor) return false;
  if (actor === 'SUPER_ADMIN') return true;
  return RANK[actor] > RANK[target];
}

export function canCreateOrganizationKind(actor: UserRole | undefined): {
  canCreate: boolean;
  allowedKinds: ('CUSTOMER' | 'PARTNER' | 'INTERNAL')[];
} {
  if (actor === 'SUPER_ADMIN')
    return { canCreate: true, allowedKinds: ['CUSTOMER', 'PARTNER', 'INTERNAL'] };
  if (actor === 'PARTNER_ADMIN')
    return { canCreate: true, allowedKinds: ['CUSTOMER'] };
  return { canCreate: false, allowedKinds: [] };
}
