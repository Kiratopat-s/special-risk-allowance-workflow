# Graph Report - special-risk-allowance-workflow  (2026-08-24)

## Corpus Check
- 223 files · ~111,183 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1354 nodes · 3234 edges · 80 communities (71 shown, 9 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fabe42a8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Allowance Workflow Actions|Allowance Workflow Actions]]
- [[_COMMUNITY_Leader Verification|Leader Verification]]
- [[_COMMUNITY_Profile Sync Admin|Profile Sync Admin]]
- [[_COMMUNITY_Action Log Domain|Action Log Domain]]
- [[_COMMUNITY_Monthly Request Collections|Monthly Request Collections]]
- [[_COMMUNITY_Notifications System|Notifications System]]
- [[_COMMUNITY_Expense Claim Documents|Expense Claim Documents]]
- [[_COMMUNITY_Off Site Work|Off Site Work]]
- [[_COMMUNITY_App Dependencies|App Dependencies]]
- [[_COMMUNITY_Department Domain|Department Domain]]
- [[_COMMUNITY_User Signatures|User Signatures]]
- [[_COMMUNITY_Profile Roles UI|Profile Roles UI]]
- [[_COMMUNITY_Navigation Notifications UI|Navigation Notifications UI]]
- [[_COMMUNITY_Dialog Admin Clients|Dialog Admin Clients]]
- [[_COMMUNITY_Work Client Forms|Work Client Forms]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Component Aliases|Component Aliases]]
- [[_COMMUNITY_Shared Form Controls|Shared Form Controls]]
- [[_COMMUNITY_Permission RBAC Docs|Permission RBAC Docs]]
- [[_COMMUNITY_Profile Form UI|Profile Form UI]]
- [[_COMMUNITY_Permission Gates|Permission Gates]]
- [[_COMMUNITY_Claim Calendar Client|Claim Calendar Client]]
- [[_COMMUNITY_Root Layout PWA|Root Layout PWA]]
- [[_COMMUNITY_Architecture Prisma Docs|Architecture Prisma Docs]]
- [[_COMMUNITY_Home Page UI|Home Page UI]]
- [[_COMMUNITY_Dev Tooling|Dev Tooling]]
- [[_COMMUNITY_Service Audit Rationale|Service Audit Rationale]]
- [[_COMMUNITY_User Domain Models|User Domain Models]]
- [[_COMMUNITY_PEA Branding|PEA Branding]]
- [[_COMMUNITY_Next.js README|Next.js README]]
- [[_COMMUNITY_Providers Session|Providers Session]]
- [[_COMMUNITY_PWA Manifest|PWA Manifest]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_File Icon Asset|File Icon Asset]]
- [[_COMMUNITY_Prisma Repository Client|Prisma Repository Client]]
- [[_COMMUNITY_Package Metadata|Package Metadata]]
- [[_COMMUNITY_Package Scripts|Package Scripts]]
- [[_COMMUNITY_Permission Seeding|Permission Seeding]]
- [[_COMMUNITY_Department Data Model|Department Data Model]]
- [[_COMMUNITY_Window Icon Asset|Window Icon Asset]]
- [[_COMMUNITY_Globe Icon Asset|Globe Icon Asset]]
- [[_COMMUNITY_Next.js Logo Asset|Next.js Logo Asset]]
- [[_COMMUNITY_Detail Row Component|Detail Row Component]]
- [[_COMMUNITY_ESLint Config|ESLint Config]]
- [[_COMMUNITY_Next Config|Next Config]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]
- [[_COMMUNITY_Database Datasource|Database Datasource]]
- [[_COMMUNITY_Vercel Logo Asset|Vercel Logo Asset]]
- [[_COMMUNITY_Editor Settings|Editor Settings]]
- [[_COMMUNITY_Route Exports|Route Exports]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 73 edges
2. `can()` - 67 edges
3. `Button()` - 31 edges
4. `Result` - 21 edges
5. `error()` - 20 edges
6. `PaginatedResult` - 19 edges
7. `success()` - 19 edges
8. `Domain Layer Architecture` - 19 edges
9. `Special Risk Allowance Workflow` - 17 edges
10. `Badge()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `Navbar()` --calls--> `canAny()`  [INFERRED]
  components/navbar.tsx → lib/auth/permissions.ts
- `Navbar()` --calls--> `hasRole()`  [INFERRED]
  components/navbar.tsx → lib/auth/permissions.ts
- `CardAction()` --calls--> `cn()`  [EXTRACTED]
  components/ui/card.tsx → lib/utils.ts
- `CardFooter()` --calls--> `cn()`  [EXTRACTED]
  components/ui/card.tsx → lib/utils.ts
- `DropdownMenuCheckboxItem()` --calls--> `cn()`  [EXTRACTED]
  components/ui/dropdown-menu.tsx → lib/utils.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Domain Layer Call Chain** — domains_readme_presentation_layer, domains_readme_service_layer, domains_readme_repository_layer, domains_readme_prisma_client [EXTRACTED 1.00]
- **RBAC Assignment Chain** — permission_readme_user, permission_readme_userrole, permission_readme_department, permission_readme_role, permission_readme_rolepermission, permission_readme_permission [EXTRACTED 1.00]
- **Domain and Prisma Model Alignment** — domains_readme_user_domain, domains_readme_department_domain, domains_readme_action_log_domain, prisma_readme_user_model, prisma_readme_department_model, prisma_readme_useractionlog_model [INFERRED 0.85]
- **Document Icon Visual Structure** — public_file_document_page_shape, public_file_folded_corner, public_file_text_line_marks, public_file_generic_file_icon [EXTRACTED 1.00]
- **PEA Logo Visual Identity Elements** — logo_pea_logo_big_provincial_electricity_authority_logo, logo_pea_logo_big_thai_text, logo_pea_logo_big_thailand_map, logo_pea_logo_big_lightning_bolts, logo_pea_logo_big_power_lines, logo_pea_logo_big_laurel_wreath, logo_pea_logo_big_purple_gold_seal [EXTRACTED 1.00]
- **Browser Icon Visual System** — public_window_window_icon, public_window_browser_window_interface, public_window_title_bar_controls, public_window_gray_vector_style [INFERRED 0.85]

## Communities (80 total, 9 thin omitted)

### Community 0 - "Allowance Workflow Actions"
Cohesion: 0.07
Nodes (60): createDepartment(), getDepartment(), listDepartments(), createExpenseClaimDocument(), deleteExpenseClaimDocument(), getExpenseClaimDocument(), listEligibleOffSiteWorksForClaim(), submitDraftExpenseClaimDocument() (+52 more)

### Community 1 - "Leader Verification"
Cohesion: 0.24
Nodes (12): asPayload(), leaderVerificationRepository, mapRecord(), RawVerification, TransactionClient, leaderVerificationService, claimantFromVerificationSnapshot(), CreatedLeaderVerification (+4 more)

### Community 2 - "Profile Sync Admin"
Cohesion: 0.15
Nodes (12): canAny(), ExpenseClaimDocumentLayout(), ExpenseClaimDocumentLayoutProps, config, { handlers, auth, signIn, signOut }, Session, MrcLayout(), MrcLayoutProps (+4 more)

### Community 3 - "Action Log Domain"
Cohesion: 0.07
Nodes (51): actionLogRepository, actionLogService, JsonValue, ActionLogEntity, ActionLogFilterCriteria, ActionLogSummary, ActionLogWithDetails, CreateActionLogInput (+43 more)

### Community 4 - "Monthly Request Collections"
Cohesion: 0.07
Nodes (66): cancelMonthlyRequestCollection(), canCreateForDepartment(), canForTarget(), completeMonthlyRequestCollection(), createMonthlyRequestCollection(), createMonthlyRequestReplacement(), currentUserId(), denied() (+58 more)

### Community 5 - "Notifications System"
Cohesion: 0.22
Nodes (9): globalForWebPush, notificationRepository, getWebPush(), CreateNotificationInput, NotificationEntity, NotificationPageState, NotificationPayload, NotificationViewModel (+1 more)

### Community 6 - "Expense Claim Documents"
Cohesion: 0.06
Nodes (57): authorizedActor(), getMonthlyRequestRecheckOffSiteWorkDetail(), getMonthlyRequestRecheckOverview(), markClaimSuspicious(), passClaimIntoMonthlyRequest(), refreshRecheck(), rejectClaimFromRecheck(), removeClaimFromDraftMonthlyRequest() (+49 more)

### Community 7 - "Off Site Work"
Cohesion: 0.06
Nodes (33): listExpenseClaimDocuments(), DashboardTabId, DashboardTabLink, DashboardTabNav(), DashboardTabNavProps, AuthSession, currentDashboardPath(), DASHBOARD_TABS (+25 more)

### Community 8 - "App Dependencies"
Cohesion: 0.07
Nodes (27): dependencies, class-variance-authority, clsx, exceljs, @hookform/resolvers, lucide-react, next, next-auth (+19 more)

### Community 9 - "Department Domain"
Cohesion: 0.05
Nodes (45): createMonthlyRequestItemDates(), MonthlyRequestItemDateScalars, MonthlyRequestItemDateWrite, assignDefaultRolePermissions(), seedPermissions(), main(), asDate(), buildClaimWorkDates() (+37 more)

### Community 10 - "User Signatures"
Cohesion: 0.15
Nodes (20): activateMySignature(), assertAuth(), createMySignature(), deleteMySignature(), getMySignatureState(), updateMySignature(), SignaturePage(), signatureHistorySelect (+12 more)

### Community 11 - "Profile Roles UI"
Cohesion: 0.16
Nodes (12): markup, mrc, officialMrc, PrintPageControls(), metadata, MrcPrintDocument(), MrcPrintPage(), paginate() (+4 more)

### Community 12 - "Navigation Notifications UI"
Cohesion: 0.14
Nodes (15): NotificationBell(), ThemeToggle(), useNotifications(), usePushSubscription(), DropdownMenu(), DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem() (+7 more)

### Community 13 - "Dialog Admin Clients"
Cohesion: 0.09
Nodes (20): ExpenseClaimDocumentClientProps, STATUS_LABEL, WorkDateDraft, LeaderVerificationItem, LeaderVerificationSection(), DialogMode, itemDateSummary(), MrcClientProps (+12 more)

### Community 14 - "Work Client Forms"
Cohesion: 0.08
Nodes (39): canListAll(), createOffSiteWork(), deleteOffSiteWork(), denied(), getOffSiteWork(), listOffSiteWorks(), updateOffSiteWork(), profileSnapshot() (+31 more)

### Community 15 - "TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 16 - "Component Aliases"
Cohesion: 0.11
Nodes (18): aliases, components, hooks, lib, ui, utils, iconLibrary, registries (+10 more)

### Community 17 - "Shared Form Controls"
Cohesion: 0.14
Nodes (17): currentMonth(), ExpenseClaimDocumentClient(), formatMonth(), LeaderVerifyClient(), bangkokDateTimeInputNow(), MrcClient(), CardSigStep, PendingVerificationsClient() (+9 more)

### Community 18 - "Permission RBAC Docs"
Cohesion: 0.26
Nodes (13): dataUrlToBuffer(), getMyActiveSignatureDataUrl(), listMyPendingVerifications(), listMyVerifications(), refreshVerificationToken(), revalidateVerificationViews(), signatureBuffer(), verifyAsLeader() (+5 more)

### Community 19 - "Profile Form UI"
Cohesion: 0.18
Nodes (22): blankLeader(), leaderFromItem(), LeaderType, LeaderUser, Mode, OffSiteWorkClient(), groupPermissionsByResource(), roleLevelBadge() (+14 more)

### Community 20 - "Permission Gates"
Cohesion: 0.20
Nodes (13): Navbar(), PermissionAnyGate(), PermissionAnyGateProps, PermissionCheck, PermissionGate(), PermissionGateProps, RoleGate(), RoleGateProps (+5 more)

### Community 21 - "Claim Calendar Client"
Cohesion: 0.13
Nodes (19): createGoogleCalendarHolidayProvider(), GoogleCalendarEvent, GoogleCalendarEventsPage, googleCalendarHolidayProvider, GoogleHolidayProviderOptions, HolidayProvider, normalizeCalendarId(), holidayCalendarRepository (+11 more)

### Community 22 - "Root Layout PWA"
Cohesion: 0.24
Nodes (21): GET(), addDataSheet(), addDatesSheet(), addSummarySheet(), BORDER, buildMrcExportFilename(), buildMrcWorkbook(), configureTabularSheet() (+13 more)

### Community 23 - "Architecture Prisma Docs"
Cohesion: 0.14
Nodes (5): ExpectedPgFailure, Fixture, PgFailure, TEST_DATABASE_URL, VALID_MATERIAL_HASH

### Community 24 - "Home Page UI"
Cohesion: 0.29
Nodes (6): Build, Test, and Development Commands, Coding Style & Naming Conventions, Commit & Pull Request Guidelines, Project Structure & Module Organization, Repository Guidelines, Testing Guidelines

### Community 25 - "Dev Tooling"
Cohesion: 0.14
Nodes (14): devDependencies, eslint, eslint-config-next, @playwright/test, prisma, tailwindcss, @tailwindcss/postcss, tw-animate-css (+6 more)

### Community 26 - "Service Audit Rationale"
Cohesion: 0.22
Nodes (10): Action Log Domain, Audit Trail, Presentation Layer, Prisma Client, Repository Layer, Keep Repository Methods Simple, Request Context Logging, Result Type Pattern (+2 more)

### Community 27 - "User Domain Models"
Cohesion: 0.67
Nodes (3): ActionType Enum, Shared Types, UserStatus Enum

### Community 28 - "PEA Branding"
Cohesion: 0.27
Nodes (10): Electricity Service, Laurel Wreath, Lightning Bolts, Power Line Pattern, Provincial Electricity Authority, Provincial Electricity Authority Logo, Purple and Gold Circular Seal, Regional Thailand Service (+2 more)

### Community 29 - "Next.js README"
Cohesion: 0.10
Nodes (20): Authentication And Authorization, Common Commands, Core Domains, Database Notes, Default Roles, Deploy and update, Deployment, Environment Variables (+12 more)

### Community 30 - "Providers Session"
Cohesion: 0.21
Nodes (8): geistMono, geistSans, metadata, Footer(), ServiceWorkerRegistration(), PushPermissionState, subscribeToPush(), urlBase64ToUint8Array()

### Community 31 - "PWA Manifest"
Cohesion: 0.39
Nodes (7): background_color, display, icons, name, short_name, start_url, theme_color

### Community 32 - "Community 32"
Cohesion: 0.16
Nodes (17): currentBangkokMonth(), MonthlyRequestRecheckDetailPage(), PageProps, getParam(), metadata, normalizeCallbackUrl(), SearchParams, SignInPage() (+9 more)

### Community 33 - "File Icon Asset"
Cohesion: 0.33
Nodes (7): Document Page Shape, File Document Concept, file.svg Asset, Folded Corner, Generic File Icon, Gray Monochrome Style, Text Line Marks

### Community 34 - "Prisma Repository Client"
Cohesion: 0.27
Nodes (11): AuthRequestContext, ActionResult, canAll(), createAllPermissionGuard(), createAnyPermissionGuard(), createPermissionGuard(), parsePermissionCode(), permissionCode() (+3 more)

### Community 35 - "Package Metadata"
Cohesion: 0.29
Nodes (6): ignoreScripts, name, packageManager, private, trustedDependencies, version

### Community 36 - "Package Scripts"
Cohesion: 0.20
Nodes (10): scripts, build, db:seed:uat, dev, devh, lint, start, test (+2 more)

### Community 37 - "Permission Seeding"
Cohesion: 0.08
Nodes (40): resolveHolidayDatesForClaim(), ActiveClaimExistsError, claimantSelect, claimInclude, ClaimStateConflictError, creatorSelect, expenseClaimDocumentRepository, findRawClaim() (+32 more)

### Community 38 - "Department Data Model"
Cohesion: 0.22
Nodes (10): amount(), claimName(), DetailDialog(), DialogState, GROUP_LABELS, METRICS, RecheckDetailClient(), STATUS_LABELS (+2 more)

### Community 39 - "Window Icon Asset"
Cohesion: 0.50
Nodes (5): Browser Window Interface, Gray Vector Style, 16 by 16 ViewBox, Title Bar Controls, Window Icon

### Community 40 - "Globe Icon Asset"
Cohesion: 0.50
Nodes (4): Globe Icon, Gray Monochrome Style, Latitude and Longitude Grid, SVG Clip Path

### Community 41 - "Next.js Logo Asset"
Cohesion: 1.00
Nodes (3): Next.js Brand, Next.js Logo, SVG Vector Wordmark

### Community 47 - "Database Datasource"
Cohesion: 0.36
Nodes (4): getMyNotificationPageState(), markAllNotificationsRead(), markNotificationRead(), sendSystemNotification()

### Community 54 - "Community 54"
Cohesion: 0.20
Nodes (13): profileFormSchema, ProfileFormValues, FormControl(), FormDescription(), FormField(), FormFieldContext, FormFieldContextValue, FormItem() (+5 more)

### Community 55 - "Community 55"
Cohesion: 0.11
Nodes (15): CLAIM_STATES, HowToUsePage(), metadata, MRC_STATES, RULES, signInHref(), StateItem, Step (+7 more)

### Community 56 - "Community 56"
Cohesion: 0.36
Nodes (4): syncProfileFromKeycloak(), SyncProfileResult, authEvents, UseProfileSyncOptions

### Community 57 - "Community 57"
Cohesion: 0.21
Nodes (8): MODULES, STEPS, TECH, CursorSpotlight(), SignInClientProps, Button(), buttonVariants, LoadingButtonProps

### Community 58 - "Community 58"
Cohesion: 0.24
Nodes (13): DialogMode, FormData, cn(), Props, UserRow, Input(), Label(), ScrollArea() (+5 more)

### Community 59 - "Community 59"
Cohesion: 0.36
Nodes (5): Providers(), ProvidersProps, SessionGuard(), useSessionGuard(), Toaster()

### Community 60 - "Community 60"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 61 - "Community 61"
Cohesion: 0.12
Nodes (16): Architecture Pattern, Clean Architecture, Department Domain, Department Hierarchy, Directory Structure, Domain: Department, Domain Layer Architecture, Keycloak Synchronization (+8 more)

### Community 62 - "Community 62"
Cohesion: 0.11
Nodes (18): aliases, components, hooks, lib, ui, utils, iconLibrary, registries (+10 more)

### Community 63 - "Community 63"
Cohesion: 0.22
Nodes (10): Architecture, Best Practices, Core Concepts, Database Tables, Default Roles, Overview, Permission, Permission Domain (+2 more)

### Community 64 - "Community 64"
Cohesion: 0.19
Nodes (10): currentBangkokMonth(), METRIC_LABELS, monthLabel(), MonthlyRequestRecheckPage(), PageProps, RecheckMetrics, Checkbox(), CheckboxProps (+2 more)

### Community 65 - "Community 65"
Cohesion: 0.29
Nodes (5): getVerificationByToken(), LoadState, SigStep, SubmitState, VerificationInfo

### Community 66 - "Community 66"
Cohesion: 0.36
Nodes (6): sizeClasses, UserAvatar(), UserAvatarProps, Avatar(), AvatarFallback(), AvatarImage()

### Community 67 - "Community 67"
Cohesion: 0.33
Nodes (6): 1. Always Use Services in Application Code, 2. Handle Results Properly, 3. Pass Context for Logging, 4. Keep Repository Methods Simple, 5. Use Type Imports, Best Practices

### Community 68 - "Community 68"
Cohesion: 0.33
Nodes (5): Aggregate boundaries, Commands, Database-only invariants, PostgreSQL integration tests, Prisma data model

### Community 69 - "Community 69"
Cohesion: 0.50
Nodes (4): Domain: User, Repository (`user/repository.ts`), Service (`user/service.ts`), Types (`user/types.ts`)

### Community 70 - "Community 70"
Cohesion: 0.38
Nodes (5): AdminNav(), navItems, AdminLayout(), AdminLayoutProps, hasAnyRole()

### Community 71 - "Community 71"
Cohesion: 0.33
Nodes (4): globalForBroker, notificationBroker, SseWriter, getBroker()

### Community 72 - "Community 72"
Cohesion: 0.50
Nodes (3): mountPrintDocument(), renderDocument(), rendererPath

### Community 74 - "Community 74"
Cohesion: 0.40
Nodes (5): 1. Update Prisma Schema (if new resource), 2. Add Default Permissions, 3. Assign to Roles, 4. Run Seed, Adding New Permissions

### Community 75 - "Community 75"
Cohesion: 0.50
Nodes (4): API Route Example, Auth Event Handler Example, Server Action Example, Usage Examples

### Community 76 - "Community 76"
Cohesion: 0.83
Nodes (3): buildLeaderVerifyUrl(), createTransport(), sendLeaderVerifyEmail()

### Community 77 - "Community 77"
Cohesion: 0.50
Nodes (4): Client-Side Permission Checking, Protected Server Actions, Server-Side Permission Checking, Usage

### Community 78 - "Community 78"
Cohesion: 0.67
Nodes (3): Domain: Action Log, Repository (`action-log/repository.ts`), Service (`action-log/service.ts`)

## Knowledge Gaps
- **405 isolated node(s):** `What It Does`, `Tech Stack`, `Project Structure`, `Core Domains`, `Default Roles` (+400 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Community 58` to `Community 32`, `Community 64`, `Community 66`, `Department Data Model`, `Community 70`, `Off Site Work`, `Navigation Notifications UI`, `Dialog Admin Clients`, `Profile Form UI`, `Community 54`, `Community 55`, `Community 57`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `can()` connect `Allowance Workflow Actions` to `Prisma Repository Client`, `Action Log Domain`, `Monthly Request Collections`, `Permission Seeding`, `Expense Claim Documents`, `Off Site Work`, `Community 70`, `User Signatures`, `Profile Roles UI`, `Work Client Forms`, `Permission RBAC Docs`, `Root Layout PWA`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Why does `Button()` connect `Community 57` to `Community 64`, `Community 65`, `Community 32`, `Department Data Model`, `Navigation Notifications UI`, `Dialog Admin Clients`, `Shared Form Controls`, `Profile Form UI`, `Community 54`, `Community 55`, `Community 58`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `What It Does`, `Tech Stack`, `Project Structure` to the rest of the system?**
  _408 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Allowance Workflow Actions` be split into smaller, more focused modules?**
  _Cohesion score 0.06659056316590563 - nodes in this community are weakly interconnected._
- **Should `Profile Sync Admin` be split into smaller, more focused modules?**
  _Cohesion score 0.14619883040935672 - nodes in this community are weakly interconnected._
- **Should `Action Log Domain` be split into smaller, more focused modules?**
  _Cohesion score 0.0656140350877193 - nodes in this community are weakly interconnected._