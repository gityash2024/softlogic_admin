import axios from 'axios';
import { api } from '@/lib/api';
import { activityApi } from '@/services/activity.api';
import { organizationsApi } from '@/services/organizations.api';
import { usersApi } from '@/services/users.api';
import type {
  AdminOrganization,
  AdminUser,
  ApiResponse,
  AuditLogEntry,
  CountBucket,
  DashboardOverview,
  OrganizationKind,
  OrganizationStatus,
  SubscriptionStatus,
  UserRole,
  UserStatus,
} from '@/types/api';

const DAY_MS = 24 * 60 * 60 * 1000;

const roleLabels: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  PARTNER_ADMIN: 'Partner Admin',
  CUSTOMER_ADMIN: 'Customer Admin',
  ADMIN: 'Admin',
  TEACHER: 'Teacher',
  PARENT: 'Parent',
  STUDENT: 'Student',
};

const userStatusLabels: Record<UserStatus, string> = {
  ACTIVE: 'Active',
  DISABLED: 'Disabled',
};

const organizationKindLabels: Record<OrganizationKind, string> = {
  INTERNAL: 'Internal',
  PARTNER: 'Partner',
  CUSTOMER: 'Customer',
};

const organizationStatusLabels: Record<OrganizationStatus, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
};

const licenceStatusLabels: Record<SubscriptionStatus, string> = {
  ACTIVE: 'Active',
  TRIAL: 'Available',
  PENDING_APPROVAL: 'Not started',
  EXPIRED: 'Expired',
  CANCELED: 'Disabled',
};

function shouldUseFallbackOverview(error: unknown) {
  if (!axios.isAxiosError(error)) return false;

  const status = error.response?.status;
  if (status === 401 || status === 403) return false;

  return (
    !status ||
    status >= 404 ||
    error.response?.data?.message === 'Resource not found'
  );
}

function countBuckets<T extends string>(
  values: T[],
  keys: T[],
  labels: Record<T, string>,
): CountBucket<T>[] {
  const counts = new Map<T, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return keys.map((key) => ({
    key,
    label: labels[key],
    value: counts.get(key) ?? 0,
  }));
}

function buildTrend(activity: AuditLogEntry[]) {
  const today = new Date();
  const start = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  return Array.from({ length: 14 }, (_, index) => {
    const day = new Date(start.getTime() - (13 - index) * DAY_MS);
    const key = day.toISOString().slice(0, 10);
    return {
      date: key,
      label: day.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      }),
      value: activity.filter((entry) => entry.createdAt.slice(0, 10) === key)
        .length,
    };
  });
}

async function buildFallbackOverview(): Promise<DashboardOverview> {
  const [usersResult, orgsResult, activityResult] =
    await Promise.allSettled([
      usersApi.all(),
      organizationsApi.all(),
      activityApi.list({ perPage: 100 }),
    ]);

  if (usersResult.status === 'rejected') throw usersResult.reason;
  if (orgsResult.status === 'rejected') throw orgsResult.reason;

  const users = usersResult.value as AdminUser[];
  const organizations = orgsResult.value as AdminOrganization[];
  const activity =
    activityResult.status === 'fulfilled' ? activityResult.value.data : [];
  const periodStart = new Date(Date.now() - 13 * DAY_MS);
  const activeUsers = users.filter(
    (item) => item.status === 'ACTIVE' && item.primaryOrganizationId,
  );
  const eligibleLicenseRoles: UserRole[] = [
    'TEACHER',
    'CUSTOMER_ADMIN',
    'PARTNER_ADMIN',
    'ADMIN',
  ];
  const eligibleUsers = activeUsers.filter((item) =>
    eligibleLicenseRoles.includes(item.role),
  );
  const activeTeachersByOrg = new Map<string, number>();
  const activeAdminsByOrg = new Map<string, Set<string>>();
  eligibleUsers.forEach((item) => {
    const organizationId = item.primaryOrganizationId;
    if (!organizationId) return;
    if (item.role === 'TEACHER') {
      activeTeachersByOrg.set(
        organizationId,
        (activeTeachersByOrg.get(organizationId) ?? 0) + 1,
      );
      return;
    }
    const existing = activeAdminsByOrg.get(organizationId) ?? new Set<string>();
    existing.add(item.id);
    activeAdminsByOrg.set(organizationId, existing);
  });
  const seatLimit = organizations.reduce((sum, org) => {
    const teacherUsage = activeTeachersByOrg.get(org.id) ?? 0;
    const teacherCapacity = org.teacherUserLimit ?? teacherUsage;
    const adminUsage = activeAdminsByOrg.get(org.id)?.size ?? 0;
    return sum + teacherCapacity + adminUsage;
  }, 0);
  const seatUsage = eligibleUsers.length;

  return {
    generatedAt: new Date().toISOString(),
    scope: { type: 'MANAGED', organizationIds: null },
    users: {
      total: users.length,
      active: users.filter((item) => item.status === 'ACTIVE').length,
      disabled: users.filter((item) => item.status === 'DISABLED').length,
      admins: users.filter((item) =>
        ['SUPER_ADMIN', 'PARTNER_ADMIN', 'CUSTOMER_ADMIN', 'ADMIN'].includes(
          item.role,
        ),
      ).length,
      newThisPeriod: users.filter((item) => new Date(item.createdAt) >= periodStart)
        .length,
      byRole: countBuckets(
        users.map((item) => item.role),
        [
          'SUPER_ADMIN',
          'ADMIN',
          'PARTNER_ADMIN',
          'CUSTOMER_ADMIN',
          'TEACHER',
          'PARENT',
          'STUDENT',
        ],
        roleLabels,
      ),
      byStatus: countBuckets(
        users.map((item) => item.status),
        ['ACTIVE', 'DISABLED'],
        userStatusLabels,
      ),
    },
    organizations: {
      total: organizations.length,
      active: organizations.filter((item) => item.status === 'ACTIVE').length,
      inactive: organizations.filter((item) => item.status === 'INACTIVE').length,
      newThisPeriod: organizations.filter(
        (item) => new Date(item.createdAt) >= periodStart,
      ).length,
      byKind: countBuckets(
        organizations.map((item) => item.kind),
        ['INTERNAL', 'PARTNER', 'CUSTOMER'],
        organizationKindLabels,
      ),
      byStatus: countBuckets(
        organizations.map((item) => item.status),
        ['ACTIVE', 'INACTIVE'],
        organizationStatusLabels,
      ),
    },
    subscriptions: {
      total: seatLimit,
      active: seatUsage,
      expiringSoon: 0,
      seatLimit,
      seatUsage,
      utilizationRate: seatLimit > 0 ? Math.round((seatUsage / seatLimit) * 100) : 0,
      byStatus: [
        { key: 'ACTIVE', label: licenceStatusLabels.ACTIVE, value: seatUsage },
        {
          key: 'TRIAL',
          label: 'Available',
          value: Math.max(seatLimit - seatUsage, 0),
        },
        { key: 'EXPIRED', label: licenceStatusLabels.EXPIRED, value: 0 },
        { key: 'CANCELED', label: licenceStatusLabels.CANCELED, value: 0 },
      ],
    },
    content: {
      canvases: {
        total: organizations.reduce(
          (sum, item) => sum + (item._count?.canvases ?? 0),
          0,
        ),
      },
      liveSessions: {
        total: 0,
        byStatus: [
          { key: 'SCHEDULED', label: 'Scheduled', value: 0 },
          { key: 'LIVE', label: 'Live', value: 0 },
          { key: 'ENDED', label: 'Ended', value: 0 },
          { key: 'CANCELLED', label: 'Cancelled', value: 0 },
        ],
      },
      exports: {
        total: 0,
        storageBytes: 0,
        byStatus: [
          { key: 'PENDING', label: 'Pending', value: 0 },
          { key: 'PROCESSING', label: 'Processing', value: 0 },
          { key: 'COMPLETED', label: 'Completed', value: 0 },
          { key: 'FAILED', label: 'Failed', value: 0 },
        ],
      },
    },
    activity: {
      recent: activity.slice(0, 8),
      trend: buildTrend(activity),
    },
  };
}

export const dashboardApi = {
  overview: async () => {
    try {
      const res =
        await api.get<ApiResponse<DashboardOverview>>('/admin/dashboard');
      return res.data.data;
    } catch (error) {
      if (!shouldUseFallbackOverview(error)) throw error;
      return buildFallbackOverview();
    }
  },
};
