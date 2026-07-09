---
type: community
cohesion: 0.17
members: 19
---

# Permission RBAC Docs

**Cohesion:** 0.17 - loosely connected
**Members:** 19 nodes

## Members
- [[Default Roles]] - concept - lib/domains/permission/README.md
- [[Department-Scoped Roles]] - concept - lib/domains/permission/README.md
- [[Effective Permissions Cache]] - rationale - lib/domains/permission/README.md
- [[Fine-Grained Permissions]] - concept - lib/domains/permission/README.md
- [[MANAGE Action Principle]] - rationale - lib/domains/permission/README.md
- [[Permission]] - concept - lib/domains/permission/README.md
- [[Permission Database Tables]] - concept - lib/domains/permission/README.md
- [[Permission Domain]] - document - lib/domains/permission/README.md
- [[Permission Scopes]] - concept - lib/domains/permission/README.md
- [[PermissionGate]] - concept - lib/domains/permission/README.md
- [[Role]] - concept - lib/domains/permission/README.md
- [[Role-Based Access Control]] - concept - lib/domains/permission/README.md
- [[RoleGate]] - concept - lib/domains/permission/README.md
- [[RolePermission]] - concept - lib/domains/permission/README.md
- [[UserRole_1]] - concept - lib/domains/permission/README.md
- [[can]] - concept - lib/domains/permission/README.md
- [[expiresAt]] - concept - lib/domains/permission/README.md
- [[hasRole]] - concept - lib/domains/permission/README.md
- [[usePermissions]] - concept - lib/domains/permission/README.md

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Permission_RBAC_Docs
SORT file.name ASC
```

## Connections to other communities
- 2 edges to [[_COMMUNITY_User Domain Models]]
- 1 edge to [[_COMMUNITY_Architecture Prisma Docs]]
- 1 edge to [[_COMMUNITY_Service Audit Rationale]]
- 1 edge to [[_COMMUNITY_Permission Seeding]]
- 1 edge to [[_COMMUNITY_Department Data Model]]

## Top bridge nodes
- [[UserRole_1]] - degree 6, connects to 2 communities
- [[Role]] - degree 8, connects to 1 community
- [[Permission]] - degree 7, connects to 1 community
- [[Role-Based Access Control]] - degree 7, connects to 1 community
- [[Permission Domain]] - degree 5, connects to 1 community