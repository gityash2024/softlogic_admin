export type UserRole =
  | 'STUDENT'
  | 'TEACHER'
  | 'PARENT'
  | 'CUSTOMER_ADMIN'
  | 'PARTNER_ADMIN'
  | 'ADMIN'
  | 'SUPER_ADMIN';

export type UserStatus = 'ACTIVE' | 'DISABLED';

export type OrganizationKind = 'INTERNAL' | 'PARTNER' | 'CUSTOMER';
export type OrganizationStatus = 'ACTIVE' | 'INACTIVE';

export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELED' | 'TRIAL' | 'PENDING_APPROVAL';
export type BrandingMode = 'SOFTLOGIC' | 'SOFTLOGIC_PARTNER' | 'WHITE_LABEL' | 'MULTI_BRAND';
export type OrganizationStorageProvider = 'GOOGLE_DRIVE' | 'DROPBOX' | 'ONEDRIVE';
export type OrganizationStorageStatus = 'NOT_CONFIGURED' | 'PENDING' | 'CONNECTED' | 'INVALID';
export type PaymentProvider = 'MANUAL';
export type PaymentProviderMode = 'TEST' | 'LIVE';
export type LiveSessionStatus = 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED';
export type ExportStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type ExportFormat = 'PDF' | 'PNG' | 'JPG' | 'SVG';
export type ContentImportStatus = 'PENDING' | 'PROCESSING' | 'CONVERTED' | 'FAILED';

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
  brandingMode: BrandingMode;
  brandName: string | null;
  brandPrimaryColor: string | null;
  brandAccentColor: string | null;
  studentLoginEnabled: boolean;
  parentLoginEnabled: boolean;
  sessionOnlyJoinEnabled: boolean;
  teacherOnlyMode: boolean;
  supportEmail: string | null;
  supportPhone: string | null;
  storageProviders: OrganizationStorageProvider[];
  defaultStorageProvider: OrganizationStorageProvider | null;
  storageProvider: OrganizationStorageProvider | null;
  storageStatus: OrganizationStorageStatus;
  logoUrl: string | null;
  parentOrganizationId: string | null;
  aiSettings?: OrganizationAiSettings | null;
}

export interface OrganizationAiSettings {
  geminiApiKey?: string;
  geminiApiKeys?: string[];
  geminiTextModel?: string;
  geminiImageModel?: string;
  geminiTtsModel?: string;
  // Legacy keys can exist on older organization settings payloads.
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
  archivedEmail?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  primaryOrganization: OrganizationSummary | null;
  subscription: SubscriptionRecord | null;
  linkedStudentIds?: string[];
  linkedStudents?: Array<{
    id: string;
    email: string;
    name: string | null;
    status: UserStatus;
    primaryOrganizationId: string | null;
  }>;
}

export interface AdminOrganization {
  id: string;
  name: string;
  slug: string;
  kind: OrganizationKind;
  status: OrganizationStatus;
  brandingMode: BrandingMode;
  brandName: string | null;
  brandPrimaryColor: string | null;
  brandAccentColor: string | null;
  studentLoginEnabled: boolean;
  parentLoginEnabled: boolean;
  sessionOnlyJoinEnabled: boolean;
  teacherOnlyMode: boolean;
  supportEmail: string | null;
  supportPhone: string | null;
  archivedSlug?: string | null;
  archivedSupportEmail?: string | null;
  storageProviders: OrganizationStorageProvider[];
  defaultStorageProvider: OrganizationStorageProvider | null;
  storageProvider: OrganizationStorageProvider | null;
  storageStatus: OrganizationStorageStatus;
  storageConnections?: OrganizationStorageConnection[];
  logoUrl: string | null;
  logoPublicId: string | null;
  settings: Record<string, unknown>;
  parentOrganizationId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  parentOrganization: AdminOrganization | null;
  primaryAdminUser?: {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
  } | null;
  setupEmailSent?: boolean | null;
  subscriptions: SubscriptionRecord[];
  _count: {
    memberships: number;
    canvases: number;
    subscriptions: number;
  };
}

export interface OrganizationStorageConnection {
  id: string;
  organizationId: string;
  provider: OrganizationStorageProvider;
  status: OrganizationStorageStatus;
  externalAccountEmail: string | null;
  rootFolderId: string | null;
  connectedById: string | null;
  validatedAt: string | null;
  disconnectedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionRecord {
  id: string;
  organizationId: string | null;
  userId: string | null;
  createdById?: string | null;
  planName: string;
  status: SubscriptionStatus;
  brandingMode: BrandingMode;
  seatLimit: number;
  seatUsage: number;
  startDate: string;
  endDate: string | null;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  organization?: AdminOrganization | null;
  user?: {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
  } | null;
  createdBy?: {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
  } | null;
}

export interface HardwareActivationRecord {
  id: string;
  activationKeyId: string;
  userId: string | null;
  organizationId: string;
  deviceFingerprintHash: string;
  deviceLabel: string | null;
  devicePlatform: string | null;
  deviceModel: string | null;
  deviceOsVersion: string | null;
  deviceMeta: Record<string, unknown>;
  firstBoundAt: string | null;
  lastVerifiedAt: string | null;
  status: 'ACTIVE' | 'RESET_REQUESTED' | 'RESET' | 'DISABLED';
  createdAt: string;
  updatedAt: string;
}

export interface HardwareActivationKeyRecord {
  id: string;
  organizationId: string;
  subscriptionId: string | null;
  activationKey: string | null;
  label: string | null;
  status: 'AVAILABLE' | 'BOUND' | 'DISABLED' | 'EXPIRED';
  maxDevices?: number;
  assignedUserId: string | null;
  assignedUser?: {
    id: string;
    email: string;
    name: string | null;
  } | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  activations: HardwareActivationRecord[];
  boundActivation?: HardwareActivationRecord | null;
}

export interface SubscriptionDetailRecord extends SubscriptionRecord {
  hardwareActivationKeys: HardwareActivationKeyRecord[];
}

export interface OrganizationLicenseDetailRecord {
  organization: {
    id: string;
    name: string;
    status: OrganizationStatus;
    primaryAdminUserId: string | null;
    primaryAdminUser: {
      id: string;
      email: string;
      name: string | null;
    } | null;
  };
  subscriptions: SubscriptionRecord[];
  hardwareActivationKeys: HardwareActivationKeyRecord[];
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
  slides?: Array<{
    id: string;
    name?: string | null;
    title?: string | null;
    order: number;
    thumbnail?: string | null;
    elements?: unknown;
    updatedAt?: string;
  }>;
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
  storageKey?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
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

export interface AdminContentImportRecord {
  id: string;
  userId: string;
  userRole: UserRole;
  organizationId: string | null;
  sourceName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  storageKey: string | null;
  publicUrl: string | null;
  status: ContentImportStatus;
  error: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  convertedAt: string | null;
  user: {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
  };
  organization: OrganizationSummary | null;
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
  PARENT: 'Parent',
  STUDENT: 'Student',
};

export const BRANDING_MODE_LABEL: Record<BrandingMode, string> = {
  SOFTLOGIC: 'SoftLogic',
  SOFTLOGIC_PARTNER: 'SoftLogic Partner',
  WHITE_LABEL: 'White-label',
  MULTI_BRAND: 'Multi-brand',
};

export const STORAGE_STATUS_LABEL: Record<OrganizationStorageStatus, string> = {
  NOT_CONFIGURED: 'Not configured',
  PENDING: 'Pending',
  CONNECTED: 'Connected',
  INVALID: 'Invalid',
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
  PENDING_APPROVAL: 'Pending Approval',
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

export const CONTENT_IMPORT_STATUS_LABEL: Record<ContentImportStatus, string> = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  CONVERTED: 'Converted',
  FAILED: 'Failed',
};

export type SupportCategory =
  | 'REQUEST_SEATS'
  | 'EXTEND_SUBSCRIPTION'
  | 'RESET_DEVICE'
  | 'BILLING'
  | 'ACTIVATION_ISSUE'
  | 'TECHNICAL'
  | 'USER_MANAGEMENT'
  | 'GENERAL';

export type SupportThreadStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type SupportPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type SupportEventType =
  | 'STATUS_CHANGE'
  | 'ACTION_APPLIED'
  | 'PRIORITY_CHANGE'
  | 'REPLIED';

export interface SupportThreadAuthor {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
}

export interface SupportMessageRecord {
  id: string;
  threadId: string;
  authorUserId: string;
  body: string;
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author: SupportThreadAuthor;
}

export interface SupportThreadEventRecord {
  id: string;
  threadId: string;
  actorUserId: string;
  type: SupportEventType;
  payload: Record<string, unknown>;
  createdAt: string;
  actor: SupportThreadAuthor;
}

export interface SupportThreadOrganization {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
}

export interface SupportThreadRecord {
  id: string;
  organizationId: string;
  openedByUserId: string;
  category: SupportCategory;
  subject: string;
  status: SupportThreadStatus;
  priority: SupportPriority;
  requestedAction: Record<string, unknown> | null;
  resolvedByUserId: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
  organization: SupportThreadOrganization;
  openedBy: SupportThreadAuthor;
  resolvedBy: SupportThreadAuthor | null;
  messages?: SupportMessageRecord[];
  events?: SupportThreadEventRecord[];
}

export const SUPPORT_CATEGORY_LABEL: Record<SupportCategory, string> = {
  REQUEST_SEATS: 'Request more seats',
  EXTEND_SUBSCRIPTION: 'Extend subscription',
  RESET_DEVICE: 'Reset activation device',
  BILLING: 'Billing question',
  ACTIVATION_ISSUE: 'Activation issue',
  TECHNICAL: 'Technical issue',
  USER_MANAGEMENT: 'User management',
  GENERAL: 'General question',
};

export const SUPPORT_STATUS_LABEL: Record<SupportThreadStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export const SUPPORT_PRIORITY_LABEL: Record<SupportPriority, string> = {
  LOW: 'Low',
  NORMAL: 'Normal',
  HIGH: 'High',
  URGENT: 'Urgent',
};
