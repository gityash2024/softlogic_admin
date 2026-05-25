export type UserRole =
  | 'STUDENT'
  | 'TEACHER'
  | 'CUSTOMER_ADMIN'
  | 'PARTNER_ADMIN'
  | 'ADMIN'
  | 'SUPER_ADMIN';

export type UserStatus = 'ACTIVE' | 'DISABLED';

export type OrganizationKind = 'INTERNAL' | 'PARTNER' | 'CUSTOMER';
export type OrganizationStatus = 'ACTIVE' | 'INACTIVE';

export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELED' | 'TRIAL';
export type LiveSessionStatus = 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED';
export type ExportStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type ExportFormat = 'PDF' | 'PNG' | 'JPG' | 'SVG';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
  meta?: ApiMeta | null;
  errors?: Record<string, string[]>;
}

export interface ApiMeta {
  total?: number;
  page?: number;
  perPage?: number;
  totalPages?: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
  filters?: Record<string, unknown>;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: ApiMeta;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  kind: OrganizationKind;
  status: OrganizationStatus;
  logoUrl: string | null;
  parentOrganizationId: string | null;
  aiSettings?: OrganizationAiSettings | null;
}

export interface OrganizationAiSettings {
  geminiApiKey?: string;
  textModel?: string;
  imageModel?: string;
  ttsModel?: string;
  deepgramApiKey?: string;
}

export interface SafeUserContext {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  role: UserRole;
  status: UserStatus;
  isEmailVerified: boolean;
  timezone: string;
  language: string;
  createdAt: string;
  invitedAt: string;
  lastLoginAt: string | null;
  primaryOrganization: OrganizationSummary | null;
  organizations: OrganizationSummary[];
  subscription: SubscriptionRecord | null;
}

export interface AuthResponse {
  tokens: AuthTokens;
  user: SafeUserContext;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  googleId: string | null;
  isEmailVerified: boolean;
  role: UserRole;
  status: UserStatus;
  timezone: string;
  language: string;
  invitedAt: string;
  lastLoginAt: string | null;
  invitedById: string | null;
  primaryOrganizationId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  primaryOrganization: OrganizationSummary | null;
  subscription: SubscriptionRecord | null;
}

export interface AdminOrganization {
  id: string;
  name: string;
  slug: string;
  kind: OrganizationKind;
  status: OrganizationStatus;
  logoUrl: string | null;
  logoPublicId: string | null;
  settings: Record<string, unknown>;
  parentOrganizationId: string | null;
  createdAt: string;
  updatedAt: string;
  parentOrganization: AdminOrganization | null;
  subscriptions: SubscriptionRecord[];
  _count: {
    memberships: number;
    canvases: number;
    subscriptions: number;
  };
}

export interface SubscriptionRecord {
  id: string;
  organizationId: string | null;
  userId: string | null;
  planName: string;
  status: SubscriptionStatus;
  seatLimit: number;
  seatUsage: number;
  startDate: string;
  endDate: string | null;
  createdAt?: string;
  updatedAt?: string;
  organization?: AdminOrganization | null;
  user?: {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
  } | null;
}

export interface AuditLogEntry {
  id: string;
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string | null;
  summary: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actorUser: {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
  };
}

export interface AdminCanvasRecord {
  id: string;
  userId: string;
  organizationId: string | null;
  name: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  thumbnail: string | null;
  isPublic: boolean;
  shareToken: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  user: {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
  };
  organization: OrganizationSummary | null;
  _count: {
    slides: number;
    exports: number;
    liveSessions: number;
  };
}

export interface AdminLiveSessionRecord {
  id: string;
  canvasId: string;
  organizationId: string | null;
  title: string | null;
  createdById: string;
  hostUserId: string | null;
  status: LiveSessionStatus;
  joinCode: string | null;
  joinCodeExpiresAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  canvas: {
    id: string;
    name: string;
    thumbnail?: string | null;
  };
  organization: OrganizationSummary | null;
  createdBy: {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
  };
  host: {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
  } | null;
  _count: {
    participants: number;
    messages: number;
    mediaAssets: number;
    recordings: number;
    events: number;
  };
}

export interface AdminExportRecord {
  id: string;
  canvasId: string;
  userId: string;
  format: ExportFormat;
  status: ExportStatus;
  fileUrl: string | null;
  fileSize: number | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
  canvas: {
    id: string;
    name: string;
    thumbnail?: string | null;
    organization?: OrganizationSummary | null;
  };
  user: {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
  };
}

export interface CountBucket<T extends string = string> {
  key: T;
  label: string;
  value: number;
}

export interface TrendBucket {
  date: string;
  label: string;
  value: number;
}

export interface DashboardOverview {
  generatedAt: string;
  scope: {
    type: 'GLOBAL' | 'MANAGED';
    organizationIds: string[] | null;
  };
  users: {
    total: number;
    active: number;
    disabled: number;
    admins: number;
    newThisPeriod: number;
    byRole: CountBucket<UserRole>[];
    byStatus: CountBucket<UserStatus>[];
  };
  organizations: {
    total: number;
    active: number;
    inactive: number;
    newThisPeriod: number;
    byKind: CountBucket<OrganizationKind>[];
    byStatus: CountBucket<OrganizationStatus>[];
  };
  subscriptions: {
    total: number;
    active: number;
    expiringSoon: number;
    seatLimit: number;
    seatUsage: number;
    utilizationRate: number;
    byStatus: CountBucket<SubscriptionStatus>[];
  };
  content: {
    canvases: {
      total: number;
    };
    liveSessions: {
      total: number;
      byStatus: CountBucket[];
    };
    exports: {
      total: number;
      storageBytes: number;
      byStatus: CountBucket[];
    };
  };
  activity: {
    recent: AuditLogEntry[];
    trend: TrendBucket[];
  };
}

export const ADMIN_ROLES: UserRole[] = [
  'SUPER_ADMIN',
  'PARTNER_ADMIN',
  'CUSTOMER_ADMIN',
  'ADMIN',
];

export const isAdminRole = (role: UserRole | undefined): boolean =>
  !!role && ADMIN_ROLES.includes(role);

export const ROLE_LABEL: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  PARTNER_ADMIN: 'Partner Admin',
  CUSTOMER_ADMIN: 'Customer Admin',
  ADMIN: 'Admin',
  TEACHER: 'Teacher',
  STUDENT: 'Student',
};

export const ORG_KIND_LABEL: Record<OrganizationKind, string> = {
  INTERNAL: 'Internal',
  PARTNER: 'Partner',
  CUSTOMER: 'Customer',
};

export const SUBSCRIPTION_STATUS_LABEL: Record<SubscriptionStatus, string> = {
  ACTIVE: 'Active',
  EXPIRED: 'Expired',
  CANCELED: 'Canceled',
  TRIAL: 'Trial',
};

export const LIVE_SESSION_STATUS_LABEL: Record<LiveSessionStatus, string> = {
  SCHEDULED: 'Scheduled',
  LIVE: 'Live',
  ENDED: 'Ended',
  CANCELLED: 'Cancelled',
};

export const EXPORT_STATUS_LABEL: Record<ExportStatus, string> = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
};
