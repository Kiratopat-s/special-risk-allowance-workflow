---
type: community
cohesion: 0.08
members: 57
---

# Action Log Domain

**Cohesion:** 0.08 - loosely connected
**Members:** 57 nodes

## Members
- [[ActionLogEntity]] - code - lib/domains/action-log/types.ts
- [[ActionLogFilterCriteria]] - code - lib/domains/action-log/types.ts
- [[ActionLogSummary]] - code - lib/domains/action-log/types.ts
- [[ActionLogWithDetails]] - code - lib/domains/action-log/types.ts
- [[CreateActionLogInput]] - code - lib/domains/action-log/types.ts
- [[CreateUserInput]] - code - lib/domains/user/types.ts
- [[ErrorResult]] - code - lib/shared/types/result.ts
- [[JsonValue]] - code - lib/domains/action-log/service.ts
- [[JsonValue_1]] - code - lib/domains/action-log/types.ts
- [[JsonValue_6]] - code - lib/domains/user/service.ts
- [[KeycloakJwtClaims]] - code - lib/auth/events.ts
- [[KeycloakProfile]] - code - lib/auth/events.ts
- [[KeycloakUserProfile]] - code - lib/domains/user/types.ts
- [[ProfileActionResult]] - code - app/actions/user.ts
- [[ProfileFormData]] - code - app/actions/user.ts
- [[RequestContext_3]] - code - lib/domains/user/service.ts
- [[SuccessResult]] - code - lib/shared/types/result.ts
- [[UpdateUserInput]] - code - lib/domains/user/types.ts
- [[UpdatedUserData]] - code - app/actions/user.ts
- [[UserEntity]] - code - lib/domains/user/types.ts
- [[UserFilterCriteria]] - code - lib/domains/user/types.ts
- [[UserWithDepartment]] - code - lib/domains/user/types.ts
- [[actionLogRepository]] - code - lib/domains/action-log/repository.ts
- [[actionLogService]] - code - lib/domains/action-log/service.ts
- [[claim-status.ts]] - code - lib/shared/claim-status.ts
- [[createPool()]] - code - lib/db/prisma.ts
- [[createPrismaClient()]] - code - lib/db/prisma.ts
- [[decodeJwt()]] - code - lib/auth/events.ts
- [[enums.ts]] - code - lib/shared/types/enums.ts
- [[error()]] - code - lib/shared/types/result.ts
- [[events.ts]] - code - lib/auth/events.ts
- [[getKeycloakAdminToken()]] - code - app/actions/user.ts
- [[globalForPrisma]] - code - lib/db/prisma.ts
- [[handleShutdown()]] - code - lib/db/prisma.ts
- [[index.ts_2]] - code - lib/domains/action-log/index.ts
- [[index.ts_1]] - code - lib/db/index.ts
- [[index.ts_14]] - code - lib/shared/index.ts
- [[index.ts_15]] - code - lib/shared/types/index.ts
- [[index.ts_12]] - code - lib/domains/user/index.ts
- [[listActiveUsers()]] - code - app/actions/user.ts
- [[prisma.ts]] - code - lib/db/prisma.ts
- [[profileSchema]] - code - app/actions/user.ts
- [[repository.ts]] - code - lib/domains/action-log/repository.ts
- [[repository.ts_9]] - code - lib/domains/user/repository.ts
- [[result.ts]] - code - lib/shared/types/result.ts
- [[searchUsersForLeader()]] - code - app/actions/user.ts
- [[service.ts]] - code - lib/domains/action-log/service.ts
- [[service.ts_9]] - code - lib/domains/user/service.ts
- [[success()]] - code - lib/shared/types/result.ts
- [[toKeycloakUserProfile()]] - code - lib/auth/events.ts
- [[types.ts]] - code - lib/domains/action-log/types.ts
- [[types.ts_9]] - code - lib/domains/user/types.ts
- [[updateKeycloakProfile()]] - code - app/actions/user.ts
- [[user.ts]] - code - app/actions/user.ts
- [[userRepository]] - code - lib/domains/user/repository.ts
- [[userService]] - code - lib/domains/user/service.ts
- [[validateBuffer()]] - code - lib/domains/signature/service.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Action_Log_Domain
SORT file.name ASC
```

## Connections to other communities
- 14 edges to [[_COMMUNITY_Off Site Work]]
- 12 edges to [[_COMMUNITY_Allowance Workflow Actions]]
- 11 edges to [[_COMMUNITY_Department Domain]]
- 11 edges to [[_COMMUNITY_Leader Verification]]
- 10 edges to [[_COMMUNITY_Expense Claim Documents]]
- 9 edges to [[_COMMUNITY_Monthly Request Collections]]
- 8 edges to [[_COMMUNITY_Notifications System]]
- 8 edges to [[_COMMUNITY_User Signatures]]
- 7 edges to [[_COMMUNITY_Profile Sync Admin]]
- 5 edges to [[_COMMUNITY_Work Client Forms]]
- 3 edges to [[_COMMUNITY_Profile Form UI]]
- 3 edges to [[_COMMUNITY_Claim Calendar Client]]
- 1 edge to [[_COMMUNITY_Dialog Admin Clients]]
- 1 edge to [[_COMMUNITY_Permission Gates]]

## Top bridge nodes
- [[index.ts_15]] - degree 44, connects to 13 communities
- [[index.ts_1]] - degree 18, connects to 8 communities
- [[error()]] - degree 12, connects to 8 communities
- [[success()]] - degree 12, connects to 8 communities
- [[service.ts]] - degree 24, connects to 6 communities