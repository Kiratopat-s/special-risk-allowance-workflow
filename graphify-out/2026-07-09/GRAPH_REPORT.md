# Graph Report - special-risk-allowance-workflow  (2026-07-09)

## Corpus Check
- 185 files · ~81,544 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 886 nodes · 2158 edges · 55 communities (47 shown, 8 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 27 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ce8c8937`
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
- [[_COMMUNITY_Avatar Components|Avatar Components]]
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

## God Nodes (most connected - your core abstractions)
1. `cn()` - 59 edges
2. `can()` - 55 edges
3. `Button()` - 24 edges
4. `Result` - 19 edges
5. `PaginatedResult` - 19 edges
6. `compilerOptions` - 16 edges
7. `canAny()` - 15 edges
8. `Badge()` - 14 edges
9. `success()` - 12 edges
10. `error()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `Clean Architecture` --semantically_similar_to--> `Clean Architecture Domain Model Pattern`  [INFERRED] [semantically similar]
  lib/domains/README.md → prisma/README.md
- `Prisma Client` --semantically_similar_to--> `Generated Prisma Client`  [INFERRED] [semantically similar]
  lib/domains/README.md → prisma/README.md
- `Keycloak Synchronization` --semantically_similar_to--> `Keycloak Synchronization`  [INFERRED] [semantically similar]
  lib/domains/README.md → prisma/README.md
- `Department Hierarchy` --semantically_similar_to--> `Department Hierarchy`  [INFERRED] [semantically similar]
  lib/domains/README.md → prisma/README.md
- `Audit Trail` --semantically_similar_to--> `Audit Trail`  [INFERRED] [semantically similar]
  lib/domains/README.md → prisma/README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Domain Layer Call Chain** — domains_readme_presentation_layer, domains_readme_service_layer, domains_readme_repository_layer, domains_readme_prisma_client [EXTRACTED 1.00]
- **RBAC Assignment Chain** — permission_readme_user, permission_readme_userrole, permission_readme_department, permission_readme_role, permission_readme_rolepermission, permission_readme_permission [EXTRACTED 1.00]
- **Domain and Prisma Model Alignment** — domains_readme_user_domain, domains_readme_department_domain, domains_readme_action_log_domain, prisma_readme_user_model, prisma_readme_department_model, prisma_readme_useractionlog_model [INFERRED 0.85]
- **Document Icon Visual Structure** — public_file_document_page_shape, public_file_folded_corner, public_file_text_line_marks, public_file_generic_file_icon [EXTRACTED 1.00]
- **PEA Logo Visual Identity Elements** — logo_pea_logo_big_provincial_electricity_authority_logo, logo_pea_logo_big_thai_text, logo_pea_logo_big_thailand_map, logo_pea_logo_big_lightning_bolts, logo_pea_logo_big_power_lines, logo_pea_logo_big_laurel_wreath, logo_pea_logo_big_purple_gold_seal [EXTRACTED 1.00]
- **Browser Icon Visual System** — public_window_window_icon, public_window_browser_window_interface, public_window_title_bar_controls, public_window_gray_vector_style [INFERRED 0.85]

## Communities (55 total, 8 thin omitted)

### Community 0 - "Allowance Workflow Actions"
Cohesion: 0.13
Nodes (34): permissionRepository, roleRepository, userRoleRepository, assignDefaultRolePermissions(), DEFAULT_PERMISSIONS, DEFAULT_ROLES, EMPLOYEE_BASE_PERMISSIONS, ROLE_PERMISSIONS (+26 more)

### Community 1 - "Leader Verification"
Cohesion: 0.25
Nodes (11): expenseClaimSelect, leaderUserSelect, leaderVerificationRepository, offSiteWorkSelect, getNotificationService(), leaderVerificationService, notifyClaimant(), VerifyResult (+3 more)

### Community 2 - "Profile Sync Admin"
Cohesion: 0.06
Nodes (40): syncProfileFromKeycloak(), SyncProfileResult, AdminNav(), navItems, AdminLayout(), AdminLayoutProps, authEvents, AuthRequestContext (+32 more)

### Community 3 - "Action Log Domain"
Cohesion: 0.07
Nodes (49): actionLogRepository, actionLogService, JsonValue, ActionLogEntity, ActionLogFilterCriteria, ActionLogSummary, ActionLogWithDetails, CreateActionLogInput (+41 more)

### Community 4 - "Monthly Request Collections"
Cohesion: 0.09
Nodes (40): cancelMonthlyRequestCollection(), createMonthlyRequestCollection(), getMonthlyRequestCollection(), listEligibleExpenseClaimsForMonth(), listMonthlyRequestCollections(), reviewMonthlyRequestCollectionStep(), serializeDecimal(), serializeEligibleClaim() (+32 more)

### Community 5 - "Notifications System"
Cohesion: 0.11
Nodes (17): getMyNotificationPageState(), markAllNotificationsRead(), markNotificationRead(), globalForBroker, notificationBroker, SseWriter, globalForWebPush, notificationRepository (+9 more)

### Community 6 - "Expense Claim Documents"
Cohesion: 0.07
Nodes (43): createExpenseClaimDocument(), deleteExpenseClaimDocument(), getExpenseClaimDocument(), listEligibleOffSiteWorksForClaim(), listExpenseClaimDocuments(), submitDraftExpenseClaimDocument(), updateExpenseClaimDocument(), ExpenseClaimDocumentClient() (+35 more)

### Community 7 - "Off Site Work"
Cohesion: 0.14
Nodes (19): listOffSiteWorks(), AuthSession, currentDashboardPath(), DASHBOARD_TABS, dashboardHref(), DashboardPage(), DashboardTabId, DashboardTabMeta (+11 more)

### Community 8 - "App Dependencies"
Cohesion: 0.08
Nodes (26): dependencies, class-variance-authority, clsx, @hookform/resolvers, lucide-react, next, next-auth, next-themes (+18 more)

### Community 9 - "Department Domain"
Cohesion: 0.07
Nodes (46): createDepartment(), deleteDepartment(), getDepartment(), listAllDepartments(), listDepartments(), toggleDepartmentStatus(), updateDepartment(), createOffSiteWork() (+38 more)

### Community 10 - "User Signatures"
Cohesion: 0.17
Nodes (18): activateMySignature(), assertAuth(), createMySignature(), deleteMySignature(), getMySignatureState(), updateMySignature(), SignaturePage(), signatureRepository (+10 more)

### Community 11 - "Profile Roles UI"
Cohesion: 0.22
Nodes (10): Card(), CardAction(), CardContent(), CardDescription(), CardFooter(), CardHeader(), CardTitle(), ScrollArea() (+2 more)

### Community 12 - "Navigation Notifications UI"
Cohesion: 0.12
Nodes (25): NotificationBell(), sizeClasses, UserAvatar(), UserAvatarProps, useNotifications(), usePushSubscription(), cn(), Avatar() (+17 more)

### Community 13 - "Dialog Admin Clients"
Cohesion: 0.15
Nodes (30): DialogMode, FormData, Mode, LeaderType, LeaderUser, Mode, groupPermissionsByResource(), roleLevelBadge() (+22 more)

### Community 14 - "Work Client Forms"
Cohesion: 0.50
Nodes (4): blankLeader(), leaderFromItem(), OffSiteWorkClient(), shortDateDisplay()

### Community 15 - "TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 16 - "Component Aliases"
Cohesion: 0.11
Nodes (18): aliases, components, hooks, lib, ui, utils, iconLibrary, registries (+10 more)

### Community 17 - "Shared Form Controls"
Cohesion: 0.38
Nodes (4): Props, UserRow, Label(), Textarea()

### Community 18 - "Permission RBAC Docs"
Cohesion: 0.17
Nodes (19): can, Default Roles, Department-Scoped Roles, Effective Permissions Cache, expiresAt, Fine-Grained Permissions, hasRole, MANAGE Action Principle (+11 more)

### Community 19 - "Profile Form UI"
Cohesion: 0.20
Nodes (13): profileFormSchema, ProfileFormValues, FormControl(), FormDescription(), FormField(), FormFieldContext, FormFieldContextValue, FormItem() (+5 more)

### Community 20 - "Permission Gates"
Cohesion: 0.08
Nodes (26): geistMono, geistSans, metadata, Footer(), Navbar(), Providers(), ProvidersProps, SessionGuard() (+18 more)

### Community 21 - "Claim Calendar Client"
Cohesion: 0.16
Nodes (13): getVerificationByToken(), LeaderVerifyClient(), LoadState, SigStep, SubmitState, VerificationInfo, CardSigStep, VerificationCard() (+5 more)

### Community 22 - "Root Layout PWA"
Cohesion: 0.27
Nodes (8): dataUrlToBuffer(), refreshVerificationToken(), verifyAsLeader(), verifyByToken(), LeaderVerificationItem, LeaderVerificationSection(), LeaderVerificationSectionProps, Result

### Community 23 - "Architecture Prisma Docs"
Cohesion: 0.17
Nodes (13): Clean Architecture, Domain Layer Architecture, Repository-Service Pattern, Self-Contained Domains, Special Risk Allowance Workflow Application, Clean Architecture Domain Model Pattern, Migration Workflow, Migrations (+5 more)

### Community 24 - "Home Page UI"
Cohesion: 0.23
Nodes (7): MODULES, STEPS, TECH, CursorSpotlight(), ThemeToggle(), Button(), buttonVariants

### Community 25 - "Dev Tooling"
Cohesion: 0.17
Nodes (12): devDependencies, eslint, eslint-config-next, prisma, tailwindcss, @tailwindcss/postcss, tw-animate-css, @types/node (+4 more)

### Community 26 - "Service Audit Rationale"
Cohesion: 0.22
Nodes (11): Action Log Domain, Audit Trail, Presentation Layer, Request Context Logging, Result Type Pattern, Use Services in Application Code, Service Layer, Boundary Permission Checking (+3 more)

### Community 27 - "User Domain Models"
Cohesion: 0.22
Nodes (10): ActionType Enum, Keycloak Synchronization, Shared Types, User Domain, UserStatus Enum, User, ActionType Enum, Keycloak Synchronization (+2 more)

### Community 28 - "PEA Branding"
Cohesion: 0.27
Nodes (10): Electricity Service, Laurel Wreath, Lightning Bolts, Power Line Pattern, Provincial Electricity Authority, Provincial Electricity Authority Logo, Purple and Gold Circular Seal, Regional Thailand Service (+2 more)

### Community 29 - "Next.js README"
Cohesion: 0.50
Nodes (3): Deploy on Vercel, Getting Started, Learn More

### Community 30 - "Providers Session"
Cohesion: 0.33
Nodes (7): getMyActiveSignatureDataUrl(), listMyPendingVerifications(), renderLeaderQueueTab(), LeaderVerifyPage(), metadata, PendingVerificationsPage(), PendingVerificationsClient()

### Community 31 - "PWA Manifest"
Cohesion: 0.25
Nodes (7): background_color, display, icons, name, short_name, start_url, theme_color

### Community 32 - "Avatar Components"
Cohesion: 0.50
Nodes (3): createPool(), createPrismaClient(), globalForPrisma

### Community 33 - "File Icon Asset"
Cohesion: 0.33
Nodes (7): Document Page Shape, File Document Concept, file.svg Asset, Folded Corner, Generic File Icon, Gray Monochrome Style, Text Line Marks

### Community 34 - "Prisma Repository Client"
Cohesion: 0.33
Nodes (6): Prisma Client, Repository Layer, Keep Repository Methods Simple, Generated Prisma Client, Prisma Client Generator, Singleton Pattern

### Community 35 - "Package Metadata"
Cohesion: 0.29
Nodes (6): ignoreScripts, name, packageManager, private, trustedDependencies, version

### Community 36 - "Package Scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, devh, lint, start

### Community 37 - "Permission Seeding"
Cohesion: 0.40
Nodes (6): DEFAULT_PERMISSIONS, PermissionResource Enum, ROLE_PERMISSIONS, seedPermissions, Database Indexing Principle, schema.prisma

### Community 38 - "Department Data Model"
Cohesion: 0.50
Nodes (5): Department Domain, Department Hierarchy, Department, Department Hierarchy, Department Model

### Community 39 - "Window Icon Asset"
Cohesion: 0.50
Nodes (5): Browser Window Interface, Gray Vector Style, 16 by 16 ViewBox, Title Bar Controls, Window Icon

### Community 40 - "Globe Icon Asset"
Cohesion: 0.50
Nodes (4): Globe Icon, Gray Monochrome Style, Latitude and Longitude Grid, SVG Clip Path

### Community 41 - "Next.js Logo Asset"
Cohesion: 1.00
Nodes (3): Next.js Brand, Next.js Logo, SVG Vector Wordmark

### Community 54 - "Community 54"
Cohesion: 0.83
Nodes (3): buildLeaderVerifyUrl(), createTransport(), sendLeaderVerifyEmail()

## Knowledge Gaps
- **233 isolated node(s):** `UserRow`, `Props`, `SearchParams`, `AuthSession`, `DASHBOARD_TABS` (+228 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Navigation Notifications UI` to `Profile Sync Admin`, `Off Site Work`, `Profile Roles UI`, `Dialog Admin Clients`, `Shared Form Controls`, `Profile Form UI`, `Home Page UI`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Why does `can()` connect `Department Domain` to `Profile Sync Admin`, `Action Log Domain`, `Monthly Request Collections`, `Expense Claim Documents`, `Off Site Work`, `User Signatures`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `Button()` connect `Home Page UI` to `Expense Claim Documents`, `Profile Roles UI`, `Navigation Notifications UI`, `Dialog Admin Clients`, `Shared Form Controls`, `Profile Form UI`, `Claim Calendar Client`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **What connects `UserRow`, `Props`, `SearchParams` to the rest of the system?**
  _241 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Allowance Workflow Actions` be split into smaller, more focused modules?**
  _Cohesion score 0.1273532668881506 - nodes in this community are weakly interconnected._
- **Should `Profile Sync Admin` be split into smaller, more focused modules?**
  _Cohesion score 0.05747126436781609 - nodes in this community are weakly interconnected._
- **Should `Action Log Domain` be split into smaller, more focused modules?**
  _Cohesion score 0.07484909456740442 - nodes in this community are weakly interconnected._