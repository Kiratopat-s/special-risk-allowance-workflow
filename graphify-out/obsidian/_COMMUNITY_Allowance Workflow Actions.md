---
type: community
cohesion: 0.06
members: 77
---

# Allowance Workflow Actions

**Cohesion:** 0.06 - loosely connected
**Members:** 77 nodes

## Members
- [[AdminNotificationsPage()]] - code - app/admin/notifications/page.tsx
- [[AssignRoleInput]] - code - lib/domains/permission/types.ts
- [[CreatePermissionInput]] - code - lib/domains/permission/types.ts
- [[CreateRoleInput]] - code - lib/domains/permission/types.ts
- [[DEFAULT_PERMISSIONS]] - code - lib/domains/permission/seed.ts
- [[DEFAULT_ROLES]] - code - lib/domains/permission/seed.ts
- [[EMPLOYEE_BASE_PERMISSIONS]] - code - lib/domains/permission/seed.ts
- [[GrantPermissionInput]] - code - lib/domains/permission/types.ts
- [[NotificationsAdminClient()]] - code - app/admin/notifications/notifications-client.tsx
- [[PermissionCheckRequest]] - code - lib/domains/permission/types.ts
- [[PermissionCheckResult]] - code - lib/domains/permission/types.ts
- [[PermissionEntity]] - code - lib/domains/permission/types.ts
- [[PermissionFilterCriteria]] - code - lib/domains/permission/types.ts
- [[PermissionsClient()]] - code - app/admin/permissions/permissions-client.tsx
- [[PermissionsClientProps]] - code - app/admin/permissions/permissions-client.tsx
- [[PermissionsPage()]] - code - app/admin/permissions/page.tsx
- [[ROLE_PERMISSIONS]] - code - lib/domains/permission/seed.ts
- [[RoleEntity]] - code - lib/domains/permission/types.ts
- [[RoleFilterCriteria]] - code - lib/domains/permission/types.ts
- [[RoleWithHierarchy]] - code - lib/domains/permission/types.ts
- [[RoleWithPermissions]] - code - lib/domains/permission/types.ts
- [[RolesClientProps]] - code - app/admin/roles/roles-client.tsx
- [[RolesPage()]] - code - app/admin/roles/page.tsx
- [[UpdatePermissionInput]] - code - lib/domains/permission/types.ts
- [[UpdateRoleInput]] - code - lib/domains/permission/types.ts
- [[UserEffectivePermissions]] - code - lib/domains/permission/types.ts
- [[UserRoleEntity]] - code - lib/domains/permission/types.ts
- [[UserRoleWithDetails]] - code - lib/domains/permission/types.ts
- [[UsersClient()]] - code - app/admin/users/users-client.tsx
- [[UsersPage()]] - code - app/admin/users/page.tsx
- [[actionBadgeVariant()]] - code - app/admin/permissions/permissions-client.tsx
- [[assignDefaultRolePermissions()]] - code - lib/domains/permission/seed.ts
- [[assignRoleToUser()]] - code - app/actions/permissions.ts
- [[authorizationService]] - code - lib/domains/permission/service.ts
- [[can()]] - code - lib/auth/permissions.ts
- [[cancelMonthlyRequestCollection()]] - code - app/actions/monthly-request-collection.ts
- [[checkPermission()]] - code - app/actions/permissions.ts
- [[checkPermissions()]] - code - app/actions/permissions.ts
- [[createExpenseClaimDocument()]] - code - app/actions/expense-claim-document.ts
- [[createRole()]] - code - app/actions/permissions.ts
- [[deleteRole()]] - code - app/actions/permissions.ts
- [[getMyPermissions()]] - code - app/actions/permissions.ts
- [[getPermission()]] - code - app/actions/permissions.ts
- [[getRole()]] - code - app/actions/permissions.ts
- [[getRoleUserCount()]] - code - app/actions/permissions.ts
- [[getUserRoles()]] - code - app/actions/permissions.ts
- [[groupByResource()]] - code - app/admin/permissions/permissions-client.tsx
- [[index.ts_10]] - code - lib/domains/permission/index.ts
- [[listDepartments()]] - code - app/actions/department.ts
- [[listEligibleExpenseClaimsForMonth()]] - code - app/actions/monthly-request-collection.ts
- [[listEligibleOffSiteWorksForClaim()]] - code - app/actions/expense-claim-document.ts
- [[listPermissions()]] - code - app/actions/permissions.ts
- [[listRoles()]] - code - app/actions/permissions.ts
- [[listUsersWithRoles()]] - code - app/actions/permissions.ts
- [[main()]] - code - prisma/seed.ts
- [[page.tsx_1]] - code - app/admin/notifications/page.tsx
- [[page.tsx_3]] - code - app/admin/permissions/page.tsx
- [[page.tsx_4]] - code - app/admin/roles/page.tsx
- [[page.tsx_5]] - code - app/admin/users/page.tsx
- [[permissionRepository]] - code - lib/domains/permission/repository.ts
- [[permissionService]] - code - lib/domains/permission/service.ts
- [[permissions-client.tsx]] - code - app/admin/permissions/permissions-client.tsx
- [[permissions.ts]] - code - app/actions/permissions.ts
- [[repository.ts_7]] - code - lib/domains/permission/repository.ts
- [[revokeRoleFromUser()]] - code - app/actions/permissions.ts
- [[roleRepository]] - code - lib/domains/permission/repository.ts
- [[roleService]] - code - lib/domains/permission/service.ts
- [[scopeBadgeVariant()]] - code - app/admin/permissions/permissions-client.tsx
- [[seed.ts]] - code - lib/domains/permission/seed.ts
- [[seed.ts_1]] - code - prisma/seed.ts
- [[seedPermissions()]] - code - lib/domains/permission/seed.ts
- [[service.ts_7]] - code - lib/domains/permission/service.ts
- [[setRolePermissions()]] - code - app/actions/permissions.ts
- [[types.ts_7]] - code - lib/domains/permission/types.ts
- [[updateExpenseClaimDocument()]] - code - app/actions/expense-claim-document.ts
- [[updateRole()]] - code - app/actions/permissions.ts
- [[userRoleRepository]] - code - lib/domains/permission/repository.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Allowance_Workflow_Actions
SORT file.name ASC
```

## Connections to other communities
- 12 edges to [[_COMMUNITY_Monthly Request Collections]]
- 12 edges to [[_COMMUNITY_Action Log Domain]]
- 10 edges to [[_COMMUNITY_Department Domain]]
- 10 edges to [[_COMMUNITY_Dialog Admin Clients]]
- 10 edges to [[_COMMUNITY_Profile Roles UI]]
- 9 edges to [[_COMMUNITY_Profile Sync Admin]]
- 8 edges to [[_COMMUNITY_Expense Claim Documents]]
- 6 edges to [[_COMMUNITY_Off Site Work]]
- 6 edges to [[_COMMUNITY_User Signatures]]
- 4 edges to [[_COMMUNITY_Shared Form Controls]]
- 3 edges to [[_COMMUNITY_Claim Calendar Client]]
- 3 edges to [[_COMMUNITY_Permission Gates]]
- 2 edges to [[_COMMUNITY_Leader Verification]]
- 2 edges to [[_COMMUNITY_Home Page UI]]
- 1 edge to [[_COMMUNITY_Notifications System]]

## Top bridge nodes
- [[can()]] - degree 54, connects to 6 communities
- [[permissions.ts]] - degree 39, connects to 5 communities
- [[index.ts_10]] - degree 34, connects to 5 communities
- [[RoleEntity]] - degree 11, connects to 3 communities
- [[service.ts_7]] - degree 29, connects to 2 communities