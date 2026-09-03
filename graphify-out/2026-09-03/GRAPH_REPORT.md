# Graph Report - .  (2026-07-07)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 899 nodes · 1093 edges · 82 communities (61 shown, 21 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 10 edges (avg confidence: 0.53)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f6cac08c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_api.ts|api.ts]]
- [[_COMMUNITY_licensing.api.ts|licensing.api.ts]]
- [[_COMMUNITY_dependencies|dependencies]]
- [[_COMMUNITY_RolePortalPage.tsx|RolePortalPage.tsx]]
- [[_COMMUNITY_ContentPage.tsx|ContentPage.tsx]]
- [[_COMMUNITY_devDependencies|devDependencies]]
- [[_COMMUNITY_QrLoginScannerCard.tsx|QrLoginScannerCard.tsx]]
- [[_COMMUNITY_LiveSessionDetailPage.tsx|LiveSessionDetailPage.tsx]]
- [[_COMMUNITY_DownloadsPage.tsx|DownloadsPage.tsx]]
- [[_COMMUNITY_OrganizationDetailPage.tsx|OrganizationDetailPage.tsx]]
- [[_COMMUNITY_CommandPalette.tsx|CommandPalette.tsx]]
- [[_COMMUNITY_compilerOptions|compilerOptions]]
- [[_COMMUNITY_StudyMaterialUploadPage.tsx|StudyMaterialUploadPage.tsx]]
- [[_COMMUNITY_AiPage.tsx|AiPage.tsx]]
- [[_COMMUNITY_LicensePage.tsx|LicensePage.tsx]]
- [[_COMMUNITY_SubscriptionFormPage.tsx|SubscriptionFormPage.tsx]]
- [[_COMMUNITY_MaintenancePage.tsx|MaintenancePage.tsx]]
- [[_COMMUNITY_compilerOptions|compilerOptions]]
- [[_COMMUNITY_login-attempt-lockout.ts|login-attempt-lockout.ts]]
- [[_COMMUNITY_ThreadDetailPage.tsx|ThreadDetailPage.tsx]]
- [[_COMMUNITY_UserFormPage.tsx|UserFormPage.tsx]]
- [[_COMMUNITY_classroom.api.ts|classroom.api.ts]]
- [[_COMMUNITY_admin-list-ui.tsx|admin-list-ui.tsx]]
- [[_COMMUNITY_dashboard.api.ts|dashboard.api.ts]]
- [[_COMMUNITY_downloads.api.ts|downloads.api.ts]]
- [[_COMMUNITY_api.ts|api.ts]]
- [[_COMMUNITY_maintenance.api.ts|maintenance.api.ts]]
- [[_COMMUNITY_OrganizationFormPage.tsx|OrganizationFormPage.tsx]]
- [[_COMMUNITY_ai.api.ts|ai.api.ts]]
- [[_COMMUNITY_card.tsx|card.tsx]]
- [[_COMMUNITY_dialog.tsx|dialog.tsx]]
- [[_COMMUNITY_table.tsx|table.tsx]]
- [[_COMMUNITY_DashboardPage.tsx|DashboardPage.tsx]]
- [[_COMMUNITY_SubscriptionDetailPage.tsx|SubscriptionDetailPage.tsx]]
- [[_COMMUNITY_integrations.api.ts|integrations.api.ts]]
- [[_COMMUNITY_branding.ts|branding.ts]]
- [[_COMMUNITY_auth.api.ts|auth.api.ts]]
- [[_COMMUNITY_support.api.ts|support.api.ts]]
- [[_COMMUNITY_confirm-submit-dialog.tsx|confirm-submit-dialog.tsx]]
- [[_COMMUNITY_confirmation-dialog.tsx|confirmation-dialog.tsx]]
- [[_COMMUNITY_dropdown-menu.tsx|dropdown-menu.tsx]]
- [[_COMMUNITY_OrganizationsPage|OrganizationsPage]]
- [[_COMMUNITY_role-access.ts|role-access.ts]]
- [[_COMMUNITY_PasswordRequirements.tsx|PasswordRequirements.tsx]]
- [[_COMMUNITY_Logo.tsx|Logo.tsx]]
- [[_COMMUNITY_AssignActivationKeysDialog.tsx|AssignActivationKeysDialog.tsx]]
- [[_COMMUNITY_avatar.tsx|avatar.tsx]]
- [[_COMMUNITY_badge.tsx|badge.tsx]]
- [[_COMMUNITY_button.tsx|button.tsx]]
- [[_COMMUNITY_tabs.tsx|tabs.tsx]]
- [[_COMMUNITY_ForgotPasswordScreen.tsx|ForgotPasswordScreen.tsx]]
- [[_COMMUNITY_SetupPasswordScreen.tsx|SetupPasswordScreen.tsx]]
- [[_COMMUNITY_HelpThreadsPage.tsx|HelpThreadsPage.tsx]]
- [[_COMMUNITY_activation-key.ts|activation-key.ts]]
- [[_COMMUNITY_App.tsx|App.tsx]]
- [[_COMMUNITY_ActivationKeyLabelDialog.tsx|ActivationKeyLabelDialog.tsx]]
- [[_COMMUNITY_EmailActivationKeysDialog.tsx|EmailActivationKeysDialog.tsx]]
- [[_COMMUNITY_input.tsx|input.tsx]]
- [[_COMMUNITY_SupportInboxPage.tsx|SupportInboxPage.tsx]]
- [[_COMMUNITY_tsconfig.json|tsconfig.json]]
- [[_COMMUNITY_label.tsx|label.tsx]]
- [[_COMMUNITY_progress.tsx|progress.tsx]]
- [[_COMMUNITY_query-client.ts|query-client.ts]]
- [[_COMMUNITY_routes.tsx|routes.tsx]]
- [[_COMMUNITY_ADMIN_ROLES|ADMIN_ROLES]]
- [[_COMMUNITY_SubscriptionDetailRecord|SubscriptionDetailRecord]]
- [[_COMMUNITY_vercel.json|vercel.json]]
- [[_COMMUNITY_vite.config.ts|vite.config.ts]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 23 edges
2. `compilerOptions` - 16 edges
3. `LicensePage()` - 13 edges
4. `AdminExportFormat` - 12 edges
5. `SuperAdminDownloadsPage()` - 11 edges
6. `AiPage()` - 8 edges
7. `LiveSessionDetailPage()` - 8 edges
8. `WhiteboardSlidePreview()` - 8 edges
9. `MaintenancePage()` - 8 edges
10. `WhiteboardSlidePreview()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `QrLoginScannerCard()` --references--> `html5-qrcode`  [EXTRACTED]
  src/features/settings/QrLoginScannerCard.tsx → package.json
- `QrLoginPanel()` --references--> `qrcode`  [EXTRACTED]
  src/features/auth/QrLoginPanel.tsx → package.json
- `textFromChildren()` --references--> `react`  [EXTRACTED]
  src/components/ui/select.tsx → package.json
- `ContentPage()` --references--> `AdminExportFormat`  [EXTRACTED]
  src/features/content/ContentPage.tsx → src/services/admin-api.ts
- `OrganizationsPage()` --references--> `AdminExportFormat`  [EXTRACTED]
  src/features/organizations/OrganizationsPage.tsx → src/services/admin-api.ts

## Import Cycles
- None detected.

## Communities (82 total, 21 thin omitted)

### Community 0 - "api.ts"
Cohesion: 0.03
Nodes (75): AdminCanvasRecord, AdminContentImportRecord, AdminExportRecord, AdminLiveSessionRecord, AdminOrganization, AdminUser, AiAllocationOverview, AiConfigSummary (+67 more)

### Community 1 - "licensing.api.ts"
Cohesion: 0.05
Nodes (53): actionLabel(), ActivityPage(), COMMON_ACTIONS, TARGET_TYPES, statusVariant(), subscriptionScopeLabel(), SubscriptionsPage(), activityApi (+45 more)

### Community 2 - "dependencies"
Cohesion: 0.04
Nodes (45): dependencies, axios, class-variance-authority, clsx, date-fns, @fontsource/inter, @hookform/resolvers, lucide-react (+37 more)

### Community 3 - "RolePortalPage.tsx"
Cohesion: 0.08
Nodes (28): asNumber(), asRecord(), BoardPreviewTile(), colorFrom(), combinedBounds(), DashboardModule(), defaultPathForRole(), extractPreviewImage() (+20 more)

### Community 4 - "ContentPage.tsx"
Cohesion: 0.10
Nodes (28): compactPath(), ContentPage(), ContentTab, EXPORT_FORMATS, ExportsTable(), exportStatusVariant(), formatBytes(), ImportsTable() (+20 more)

### Community 5 - "devDependencies"
Cohesion: 0.07
Nodes (28): devDependencies, autoprefixer, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, postcss (+20 more)

### Community 6 - "QrLoginScannerCard.tsx"
Cohesion: 0.10
Nodes (24): html5-qrcode, buildCameraTargets(), CameraDevice, cameraErrorMessage(), cameraLabel(), CameraStartTarget, isRearCamera(), ParsedQrLoginPayload (+16 more)

### Community 7 - "LiveSessionDetailPage.tsx"
Cohesion: 0.12
Nodes (22): assetExtension(), backPathForRole(), downloadMediaAsset(), durationLabel(), formatBytes(), isOfficeAsset(), isPdfAsset(), isStudyMaterial() (+14 more)

### Community 8 - "DownloadsPage.tsx"
Cohesion: 0.11
Nodes (20): allChannelSelectionFor(), BrandFilter, channelKey(), CHANNELS, channelSelectionFor(), channelsForEnvironment(), ConfirmationAction, currentReleaseByChannel() (+12 more)

### Community 9 - "OrganizationDetailPage.tsx"
Cohesion: 0.11
Nodes (18): actionLabel(), ActivationKeysTable(), ActivityTable(), ExportsTable(), exportStatusVariant(), formatBytes(), HubTab, keyStatusVariant() (+10 more)

### Community 10 - "CommandPalette.tsx"
Cohesion: 0.10
Nodes (18): BASE_NAV_ITEMS, Command, CommandPalette(), getNavCommands(), HELP_ITEM, matches(), NavCommand, RecordCommand (+10 more)

### Community 11 - "compilerOptions"
Cohesion: 0.08
Nodes (25): compilerOptions, allowImportingTsExtensions, allowSyntheticDefaultImports, baseUrl, erasableSyntaxOnly, esModuleInterop, ignoreDeprecations, jsx (+17 more)

### Community 12 - "StudyMaterialUploadPage.tsx"
Cohesion: 0.13
Nodes (18): acceptedStudyMaterialTypes, fileExtension(), fileExtensionWithDot(), formatBytes(), isOfficeDocument(), isPdf(), isTextDocument(), LiveSessionMediaAsset (+10 more)

### Community 13 - "AiPage.tsx"
Cohesion: 0.13
Nodes (16): accountForOrg(), accountForUser(), accountName(), AiOverviewOrganization, AiPage(), CreditRow(), formatTokens(), formatUsd() (+8 more)

### Community 14 - "LicensePage.tsx"
Cohesion: 0.17
Nodes (18): ActivationKeyTermEditState, addMonths(), BulkCreateMode, dateInputToIso(), dateInputValue(), dateTimeInputToIso(), dateTimeLocalValue(), DURATION_OPTIONS (+10 more)

### Community 15 - "SubscriptionFormPage.tsx"
Cohesion: 0.14
Nodes (16): addDaysToDate(), addMonthsToDate(), allocatedSeatTotal(), DURATION_OPTIONS, FormValues, schema, SubscriptionFormPage(), SubscriptionPreviewCardProps (+8 more)

### Community 16 - "MaintenancePage.tsx"
Cohesion: 0.22
Nodes (13): formatDuration(), formatMaintenanceDateTime(), isoFromIstDateTimeLocal(), istDateTimeLocalValue(), dismissKey(), MaintenanceActiveScreen(), MaintenanceFutureBanner(), MaintenanceGate() (+5 more)

### Community 17 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+9 more)

### Community 18 - "login-attempt-lockout.ts"
Cohesion: 0.18
Nodes (12): ATTEMPT_LIMITS, defaultRecord(), LockoutRecord, LoginAttemptDecision, LoginAttemptFailureResult, loginAttemptLockout, readRecord(), readStore() (+4 more)

### Community 19 - "ThreadDetailPage.tsx"
Cohesion: 0.26
Nodes (9): NewSupportThreadPage(), findPreset(), SUPPORT_CATEGORY_PRESETS, SupportCategoryPreset, ActionPanelProps, eventSummary(), statusVariant(), ThreadDetailPage() (+1 more)

### Community 20 - "UserFormPage.tsx"
Cohesion: 0.20
Nodes (9): FormValues, schema, USER_MODULE_ROLES, UserFormEditor(), UserFormEditorProps, LICENSED_USER_ROLES, roleLimitForOrganization(), rolePolicyBlockReason() (+1 more)

### Community 21 - "classroom.api.ts"
Cohesion: 0.18
Nodes (11): classroomApi, ClassroomCanvas, ClassroomContentAsset, ClassroomContentCanvas, ClassroomContentCanvasDetail, ClassroomContentSlide, ClassroomMaterial, ClassroomNotification (+3 more)

### Community 23 - "dashboard.api.ts"
Cohesion: 0.22
Nodes (9): buildFallbackOverview(), buildTrend(), countBuckets(), dashboardApi, licenceStatusLabels, organizationKindLabels, organizationStatusLabels, roleLabels (+1 more)

### Community 24 - "downloads.api.ts"
Cohesion: 0.18
Nodes (9): AppRelease, AppReleaseBrand, AppReleaseEnvironment, AppReleasePlatform, CurrentAppDownload, downloadsApi, PublishFullReleasePayload, PublishReleaseArtifact (+1 more)

### Community 25 - "api.ts"
Cohesion: 0.22
Nodes (5): api, clientSessionId, AuthState, ImpersonationSession, useAuthStore

### Community 26 - "maintenance.api.ts"
Cohesion: 0.25
Nodes (8): MaintenanceActorSummary, maintenanceApi, MaintenanceState, MaintenanceStatus, MaintenanceWindowPayload, MaintenanceWindowRecord, MaintenanceWindowStatus, PublicMaintenanceWindow

### Community 27 - "OrganizationFormPage.tsx"
Cohesion: 0.29
Nodes (6): FormValues, optionalNonNegativeInt, OrganizationFormEditor(), OrganizationFormEditorProps, schema, STORAGE_PROVIDER_OPTIONS

### Community 28 - "ai.api.ts"
Cohesion: 0.25
Nodes (7): AiAllocationPayload, aiApi, AiSetAllocationPayload, AiTopUpPayload, UpdateAiConfigPayload, UpdateAiGoogleBillingPayload, UpdateAiPricingPayload

### Community 30 - "card.tsx"
Cohesion: 0.29
Nodes (6): Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle

### Community 31 - "dialog.tsx"
Cohesion: 0.29
Nodes (4): DialogContent, DialogDescription, DialogOverlay, DialogTitle

### Community 32 - "table.tsx"
Cohesion: 0.29
Nodes (6): Table, TableBody, TableCell, TableHead, TableHeader, TableRow

### Community 33 - "DashboardPage.tsx"
Cohesion: 0.33
Nodes (3): chartColors, DashboardPage(), formatBytes()

### Community 34 - "SubscriptionDetailPage.tsx"
Cohesion: 0.48
Nodes (5): buildTimeline(), fingerprintTail(), formatMoney(), SubscriptionDetailPage(), TimelineEntry

### Community 35 - "integrations.api.ts"
Cohesion: 0.33
Nodes (5): integrationsApi, IntegrationStatus, OAuthUrlResult, StorageCredentialsQuery, UpsertStorageCredentialPayload

### Community 36 - "branding.ts"
Cohesion: 0.47
Nodes (4): isHexColor(), normalizeHex(), RuntimeBrand, runtimeBrandForOrganization()

### Community 37 - "auth.api.ts"
Cohesion: 0.33
Nodes (5): authApi, AuthLoginSession, QrLoginApprovalResponse, QrLoginStartResponse, QrLoginStatusResponse

### Community 38 - "support.api.ts"
Cohesion: 0.33
Nodes (5): ApplySupportActionPayload, CreateSupportThreadPayload, ListSupportThreadsQuery, PaginatedSupport, supportApi

### Community 39 - "confirm-submit-dialog.tsx"
Cohesion: 0.50
Nodes (4): ConfirmRow, ConfirmSubmitDialog(), ConfirmSubmitDialogProps, isEmptyValue()

### Community 40 - "confirmation-dialog.tsx"
Cohesion: 0.40
Nodes (3): ConfirmationDialogProps, ConfirmationTone, toneMeta

### Community 41 - "dropdown-menu.tsx"
Cohesion: 0.40
Nodes (4): DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator

### Community 42 - "OrganizationsPage"
Cohesion: 0.70
Nodes (4): kindVariant(), organizationKindLabel(), OrganizationsPage(), organizationStatusLabel()

### Community 48 - "avatar.tsx"
Cohesion: 0.50
Nodes (3): Avatar, AvatarFallback, AvatarImage

### Community 49 - "badge.tsx"
Cohesion: 0.67
Nodes (3): Badge(), BadgeProps, badgeVariants

### Community 50 - "button.tsx"
Cohesion: 0.50
Nodes (3): Button, ButtonProps, buttonVariants

### Community 51 - "tabs.tsx"
Cohesion: 0.50
Nodes (3): TabsContent, TabsList, TabsTrigger

### Community 55 - "HelpThreadsPage.tsx"
Cohesion: 0.67
Nodes (3): HelpThreadsPage(), STATUS_FILTERS, statusVariant()

### Community 56 - "activation-key.ts"
Cohesion: 0.83
Nodes (3): chunk(), formatActivationKeyForDisplay(), normalizeActivationKey()

## Knowledge Gaps
- **407 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+402 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AdminExportFormat` connect `licensing.api.ts` to `OrganizationsPage`, `ContentPage.tsx`, `SubscriptionFormPage.tsx`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `ContentPage()` connect `ContentPage.tsx` to `licensing.api.ts`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `devDependencies`, `QrLoginScannerCard.tsx`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _407 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `api.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.02631578947368421 - nodes in this community are weakly interconnected._
- **Should `licensing.api.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.051715309779825906 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.04343971631205674 - nodes in this community are weakly interconnected._