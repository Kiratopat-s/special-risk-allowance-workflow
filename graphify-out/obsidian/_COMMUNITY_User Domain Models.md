---
type: community
cohesion: 0.22
members: 10
---

# User Domain Models

**Cohesion:** 0.22 - loosely connected
**Members:** 10 nodes

## Members
- [[ActionType Enum]] - concept - lib/domains/README.md
- [[ActionType Enum_1]] - concept - prisma/README.md
- [[Keycloak Synchronization]] - concept - lib/domains/README.md
- [[Keycloak Synchronization_1]] - concept - prisma/README.md
- [[Shared Types]] - concept - lib/domains/README.md
- [[User]] - concept - lib/domains/permission/README.md
- [[User Domain]] - concept - lib/domains/README.md
- [[User Model]] - concept - prisma/README.md
- [[UserStatus Enum]] - concept - lib/domains/README.md
- [[UserStatus Enum_1]] - concept - prisma/README.md

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/User_Domain_Models
SORT file.name ASC
```

## Connections to other communities
- 2 edges to [[_COMMUNITY_Permission RBAC Docs]]
- 1 edge to [[_COMMUNITY_Architecture Prisma Docs]]
- 1 edge to [[_COMMUNITY_Service Audit Rationale]]

## Top bridge nodes
- [[ActionType Enum_1]] - degree 3, connects to 2 communities
- [[User Domain]] - degree 3, connects to 1 community
- [[User]] - degree 2, connects to 1 community