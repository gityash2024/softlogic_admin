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
export type StorageCredentialScope = 'GLOBAL' | 'ORGANIZATION';
export type StorageCredentialSource = StorageCredentialScope | 'ENV_LEGACY' | 'NONE';
export type PaymentProvider = 'MANUAL';
export type PaymentProviderMode = 'TEST' | 'LIVE';
export type PaymentTransactionStatus =
  | 'PENDING'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED'
  | 'MANUAL_APPROVED';
export type LiveSessionStatus = 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED';
export type ExportStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type ExportFormat = 'PDF' | 'PNG' | 'JPG' | 'SVG';
export type ContentImportStatus = 'PENDING' | 'PROCESSING' | 'CONVERTED' | 'FAILED';
export type AiCreditScope = 'MASTER' | 'ORGANIZATION' | 'USER' | 'HARDWARE';
export type AiCreditAccountStatus = 'ACTIVE' | 'EXHAUSTED' | 'DISABLED';
export type AiWarningLevel = 'NONE' | 'LOW_20' | 'LOW_10' | 'LOW_5' | 'EXHAUSTED';

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
  teacherUserLimit: number | null;
  studentUserLimit: number | null;
  parentUserLimit: number | null;
  maxChildOrganizations?: number | null;
  maxChildUsers?: number | null;
  createdById?: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  storageProviders: OrganizationStorageProvider[];
  connectedStorageProviders?: OrganizationStorageProvider[];
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

export type LicenseSummaryStatus = 'ACTIVE' | 'NOT_STARTED' | 'NO_KEYS' | 'EXPIRED';

export interface LicenseSummaryRecord {
  organizationId: string;
  status: LicenseSummaryStatus;
  seatLimit: number;
  teacherUsage: number;
  adminUsage: number;
  activationUserUsage: number;
  remainingCapacity: number;
  totalKeyCount: number;
  usableKeyCount: number;
  availableKeyCount: number;
  boundKeyCount: number;
  disabledKeyCount: number;
  expiredKeyCount: number;
  startsAt: string | null;
  expiresAt: string | null;
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
  license: LicenseSummaryRecord | null;
  /** @deprecated Legacy audit compatibility. Use license for V2 access data. */
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
  appVersion?: string | null;
  appVersionCode?: number | null;
  appVersionUpdatedAt?: string | null;
  forcedAppReleaseId?: string | null;
  forcedAppUpdateForced?: boolean;
  forcedAppRelease?: {
    id: string;
    versionName: string;
    buildNumber: number;
    platform: 'android' | 'windows';
    isForced: boolean;
  } | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  primaryOrganization: OrganizationSummary | null;
  license?: LicenseSummaryRecord | null;
  /** @deprecated Legacy audit compatibility. Use license for V2 access data. */
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
  teacherUserLimit: number | null;
  studentUserLimit: number | null;
  parentUserLimit: number | null;
  maxChildOrganizations: number | null;
  maxChildUsers: number | null;
  createdById?: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  archivedSlug?: string | null;
  archivedSupportEmail?: string | null;
  storageProviders: OrganizationStorageProvider[];
  connectedStorageProviders?: OrganizationStorageProvider[];
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
  createdBy?: {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
  } | null;
  primaryAdminUser?: {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
  } | null;
  setupEmailSent?: boolean | null;
  subscriptions: SubscriptionRecord[];
  capacitySummary?: OrganizationCapacitySummaryRecord;
  _count: {
    memberships: number;
    canvases: number;
    subscriptions: number;
  };
}

export interface AiConfigSummary {
  id: string;
  provider: string;
  enabled: boolean;
  hasGeminiApiKey: boolean;
  maskedGeminiApiKey: string | null;
  geminiTextModel: string;
  geminiImageModel: string;
  geminiTtsModel: string;
  googleSearchGroundingEnabled: boolean;
  lastTestedAt: string | null;
  lastTestStatus: string | null;
  lastTestMessage: string | null;
  updatedAt: string;
}

export interface AiModelPricingSummary {
  id: string;
  provider: string;
  modelId: string;
  billingType: 'token' | 'image' | 'audio' | 'tool' | string;
  inputUsdMicrosPerMillion: number;
  outputUsdMicrosPerMillion: number;
  imageUsdMicrosEach: number;
  searchUsdMicrosPerThousand: number;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AiCreditAccountSummary {
  id: string;
  scope: AiCreditScope;
  parentAccountId: string | null;
  organizationId: string | null;
  userId: string | null;
  allocatedTokens: number;
  usedTokens: number;
  reservedTokens: number;
  childAllocatedTokens: number;
  availableTokens: number;
  percentRemaining: number;
  warningLevel: AiWarningLevel;
  unlimited: boolean;
  status: AiCreditAccountStatus;
  organization?: {
    id: string;
    name: string;
    slug?: string;
    kind?: OrganizationKind;
    parentOrganizationId?: string | null;
  } | null;
  user?: {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
    primaryOrganizationId?: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiLedgerEntry {
  id: string;
  accountId: string;
  actorUserId: string | null;
  type: string;
  amountTokens: number;
  oldTokenBalance: number;
  newTokenBalance: number;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  totalTokens: number;
  imageCount: number;
  searchGroundingCount: number;
  estimatedCostMicros: number;
  modelId: string | null;
  pricingSnapshot?: Record<string, unknown>;
  reason: string | null;
  referenceNote: string | null;
  createdAt: string;
  actorUser?: {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
  } | null;
  account?: {
    id: string;
    scope: AiCreditScope;
    organizationId: string | null;
    userId: string | null;
    organization?: { id: string; name: string } | null;
    user?: { id: string; email: string; name: string | null } | null;
  };
}

export interface AiOverview {
  generatedAt: string;
  scope: { type: 'GLOBAL' | 'MANAGED'; organizationIds: string[] | null };
  config: AiConfigSummary;
  pricing: AiModelPricingSummary[];
  googleBilling: AiGoogleBillingSummary | null;
  master: AiCreditAccountSummary;
  accounts: AiCreditAccountSummary[];
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    kind: OrganizationKind;
    parentOrganizationId: string | null;
    status: OrganizationStatus;
  }>;
  users: Array<{
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
    primaryOrganizationId: string | null;
    status: UserStatus;
  }>;
  recentLedger: AiLedgerEntry[];
}

export interface AiAllocationOverview {
  generatedAt: string;
  scope: { type: 'GLOBAL' | 'MANAGED'; organizationIds: string[] | null };
  master: AiCreditAccountSummary | null;
  accounts: AiCreditAccountSummary[];
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    kind: OrganizationKind;
    parentOrganizationId: string | null;
    status: OrganizationStatus;
  }>;
  users: Array<{
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
    primaryOrganizationId: string | null;
    status: UserStatus;
  }>;
}

export interface AiGoogleBillingSummary {
  config: {
    enabled: boolean;
    projectId: string;
    billingTableProjectId: string | null;
    billingDatasetId: string | null;
    billingTableName: string | null;
    monthlyCapMicros: number;
    currency: string;
    lastSyncAt: string | null;
    lastSyncStatus: string | null;
    lastSyncMessage: string | null;
    updatedAt: string;
  };
  connected: boolean;
  status: 'DISABLED' | 'NEEDS_CONFIGURATION' | 'READY' | 'SUCCESS' | 'ERROR';
  message: string | null;
  lastSyncAt: string | null;
  googleCurrentMonthCostMicros: number;
  googleGrossCostMicros: number;
  googleCreditsMicros: number;
  softlogicCurrentMonthCostMicros: number;
  varianceMicros: number;
  monthlyCapMicros: number;
  remainingBudgetMicros: number;
  recentRows: Array<{
    id: string;
    usageDate: string;
    serviceDescription: string;
    skuDescription: string;
    costMicros: number;
    creditsMicros: number;
    netCostMicros: number;
    currency: string;
    usageAmount: number | null;
    usageUnit: string | null;
  }>;
  recentRuns: Array<{
    id: string;
    status: string;
    month: string;
    googleSpendMicros: number;
    softlogicSpendMicros: number;
    varianceMicros: number;
    errorMessage: string | null;
    startedAt: string;
    completedAt: string | null;
  }>;
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

export interface StorageCredentialConfig {
  id: string;
  provider: OrganizationStorageProvider;
  scope: StorageCredentialScope;
  organizationId: string | null;
  configured: boolean;
  clientIdPreview: string | null;
  redirectUri: string | null;
  configuredById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionRecord {
  id: string;
  organizationId: string | null;
  userId: string | null;
  createdById?: string | null;
  allocatedFromSubscriptionId?: string | null;
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
  allocatedFromSubscription?: {
    id: string;
    planName: string;
    organizationId: string | null;
    organization?: {
      id: string;
      name: string;
    } | null;
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
  createdById?: string | null;
  createdBy?: {
    id: string;
    email: string;
    name: string | null;
    role?: UserRole;
  } | null;
  organization?: {
    id: string;
    name: string;
    kind?: OrganizationKind;
    parentOrganizationId?: string | null;
  } | null;
  subscription?: {
    id: string;
    planName: string;
    organizationId: string | null;
    organization?: {
      id: string;
      name: string;
      kind?: OrganizationKind;
    } | null;
  } | null;
  assignedUser?: {
    id: string;
    email: string;
    name: string | null;
    role?: UserRole;
  } | null;
  emailRecipientEmail?: string | null;
  emailRecipientName?: string | null;
  emailSentById?: string | null;
  emailSentBy?: {
    id: string;
    email: string;
    name: string | null;
    role?: UserRole;
  } | null;
  startsAt: string;
  expiresAt: string | null;
  emailSentAt?: string | null;
  createdAt: string;
  updatedAt: string;
  activations: HardwareActivationRecord[];
  boundActivation?: HardwareActivationRecord | null;
}

export interface SubscriptionDetailRecord extends SubscriptionRecord {
  hardwareActivationKeys: HardwareActivationKeyRecord[];
}

export interface OrganizationCapacitySummaryRecord {
  roleUsage: {
    teacher: number;
    student: number;
    parent: number;
  };
  roleLimits: {
    teacher: number | null;
    student: number | null;
    parent: number | null;
  };
  roleRemaining: {
    teacher: number | null;
    student: number | null;
    parent: number | null;
  };
  childOrganizationLimit: number | null;
  childOrganizationUsed: number;
  childOrganizationRemaining: number | null;
  childUserLimit: number | null;
  childUserAllocated: number;
  childUserRemaining: number | null;
  activationKeyCapacity: number;
  activationKeysUsable: number;
  activationKeyRemaining: number;
  teacherSeats: number;
  activeTeachers: number;
}

export interface LicenseKeySummaryRecord {
  seatLimit: number;
  teacherUsage: number;
  adminUsage: number;
  activationUserUsage: number;
  capacityUsed: number;
  remainingCapacity: number;
  totalKeyCount: number;
  usableKeyCount: number;
  availableKeyCount: number;
  boundKeyCount: number;
  disabledKeyCount: number;
  expiredKeyCount: number;
  sentKeyCount: number;
  unsentKeyCount: number;
  assignedKeyCount: number;
  poolAvailableKeyCount: number;
  uncreatedKeySlots: number;
  startsAt?: string | null;
  expiresAt?: string | null;
}

export interface OrganizationLicenseDetailRecord {
  organization: {
    id: string;
    name: string;
    status: OrganizationStatus;
    kind?: OrganizationKind;
    parentOrganizationId?: string | null;
    teacherUserLimit?: number | null;
    studentUserLimit?: number | null;
    parentUserLimit?: number | null;
    maxChildOrganizations?: number | null;
    maxChildUsers?: number | null;
    primaryAdminUserId: string | null;
    primaryAdminUser: {
      id: string;
      email: string;
      name: string | null;
    } | null;
    capacitySummary?: OrganizationCapacitySummaryRecord;
  };
  partnerPool?: {
    organizationId: string;
    organizationName: string;
    seatLimit: number;
    allocatedSeats: number;
    usableKeyCount: number;
    remainingAllocationSeats: number;
    remainingActivationKeys: number;
    subscriptions: Array<{
      id: string;
      planName: string;
      seatLimit: number;
      allocatedSeats: number;
      usableKeyCount: number;
      remainingAllocationSeats: number;
      remainingActivationKeys: number;
      startDate: string;
      endDate: string | null;
    }>;
  } | null;
  capacitySummary?: OrganizationCapacitySummaryRecord;
  summary: LicenseKeySummaryRecord;
  subscriptions: SubscriptionRecord[];
  payments: PartnerLicensePaymentRecord[];
  hardwareActivationKeys: HardwareActivationKeyRecord[];
}

export interface PartnerLicensePaymentRecord {
  id: string;
  amountMinor: number;
  currency: string;
  status: string;
  referenceNote: string | null;
  invoiceNumber: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
  recordedBy?: { id: string; email: string; name: string | null } | null;
  organization?: {
    id: string;
    name: string;
    kind?: OrganizationKind;
    parentOrganizationId?: string | null;
  } | null;
  subscription?: {
    id: string;
    planName: string;
    organizationId: string | null;
  } | null;
}

export interface PartnerLicenseDetailRecord {
  partner: OrganizationLicenseDetailRecord['organization'];
  organizations: OrganizationLicenseDetailRecord['organization'][];
  partnerPool?: OrganizationLicenseDetailRecord['partnerPool'];
  summary: {
    organizationCount: number;
    childOrganizationCount: number;
    activeSubscriptionCount: number;
    seatLimit: number;
    seatUsage: number;
    usableKeyCount: number;
    remainingActivationKeys: number;
  } & LicenseKeySummaryRecord;
  subscriptions: SubscriptionRecord[];
  payments: PartnerLicensePaymentRecord[];
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
    description?: string | null;
    userId?: string;
    organizationId?: string | null;
    isPublic?: boolean;
    createdAt?: string;
    updatedAt?: string;
    slides?: Array<{
      id: string;
      name?: string | null;
      title?: string | null;
      order: number;
      thumbnail?: string | null;
      elements?: unknown;
      updatedAt?: string;
    }>;
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
  participants?: Array<{
    id: string;
    liveSessionId: string;
    userId: string;
    role: 'HOST' | 'TEACHER' | 'STUDENT' | 'OBSERVER';
    joinedAt: string;
    leftAt: string | null;
    user: {
      id: string;
      email: string;
      name: string | null;
      role: UserRole;
    };
  }>;
  messages?: Array<{
    id: string;
    liveSessionId: string;
    senderUserId: string | null;
    guestParticipantId: string | null;
    type: 'TEXT' | 'VOICE_NOTE' | 'MEDIA' | 'SYSTEM';
    body: string | null;
    attachmentUrl: string | null;
    attachmentName: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
    sender?: {
      id: string;
      email: string;
      name: string | null;
      role: UserRole;
    } | null;
    guestParticipant?: {
      id: string;
      displayName: string | null;
      role: 'HOST' | 'TEACHER' | 'STUDENT' | 'OBSERVER';
    } | null;
  }>;
  mediaAssets?: Array<{
    id: string;
    liveSessionId: string;
    uploadedById: string;
    kind: 'FILE' | 'IMAGE' | 'VIDEO' | 'VOICE_NOTE' | 'IMPORT';
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    storageKey: string;
    publicUrl: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
  }>;
  studyMaterials?: Array<{
    id: string;
    liveSessionId: string;
    uploadedById: string;
    kind: 'FILE' | 'IMAGE' | 'VIDEO' | 'VOICE_NOTE' | 'IMPORT';
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    storageKey: string;
    publicUrl: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
  }>;
  recordings?: Array<{
    id: string;
    liveSessionId: string;
    createdById: string;
    status: 'PROCESSING' | 'READY' | 'FAILED';
    storageKey: string | null;
    publicUrl: string | null;
    durationSeconds: number | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
    updatedAt: string;
    createdBy?: {
      id: string;
      email: string;
      name: string | null;
      role: UserRole;
    };
  }>;
  events: Array<{
    id: string;
    liveSessionId?: string;
    actorUserId?: string | null;
    type: string;
    payload?: Record<string, unknown> | null;
    createdAt: string;
    actor?: {
      id: string;
      email: string;
      name: string | null;
      role: UserRole;
    } | null;
  }>;
  aiSummary?: {
    id: string;
    liveSessionId?: string;
    actorUserId?: string | null;
    type: string;
    payload?: Record<string, unknown> | null;
    createdAt: string;
    actor?: {
      id: string;
      email: string;
      name: string | null;
      role: UserRole;
    } | null;
  } | null;
  boardPreview?: {
    id: string;
    title: string;
    thumbnail?: string | null;
    slides: Array<{
      id: string;
      name?: string | null;
      title?: string | null;
      order: number;
      thumbnail?: string | null;
      elements?: unknown;
      updatedAt?: string;
    }>;
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
  EXTEND_SUBSCRIPTION: 'Extend licence/key term',
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
