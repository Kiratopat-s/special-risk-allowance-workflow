---
type: community
cohesion: 0.22
members: 11
---

# Service Audit Rationale

**Cohesion:** 0.22 - loosely connected
**Members:** 11 nodes

## Members
- [[Action Log Domain]] - concept - lib/domains/README.md
- [[Audit Trail]] - concept - lib/domains/README.md
- [[Audit Trail_1]] - concept - prisma/README.md
- [[Boundary Permission Checking]] - rationale - lib/domains/permission/README.md
- [[Presentation Layer]] - concept - lib/domains/README.md
- [[Request Context Logging]] - rationale - lib/domains/README.md
- [[Result Type Pattern]] - concept - lib/domains/README.md
- [[Service Layer]] - concept - lib/domains/README.md
- [[Use Services in Application Code]] - rationale - lib/domains/README.md
- [[UserActionLog Model]] - concept - prisma/README.md
- [[withPermission]] - concept - lib/domains/permission/README.md

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Service_Audit_Rationale
SORT file.name ASC
```

## Connections to other communities
- 1 edge to [[_COMMUNITY_Architecture Prisma Docs]]
- 1 edge to [[_COMMUNITY_Prisma Repository Client]]
- 1 edge to [[_COMMUNITY_Permission RBAC Docs]]
- 1 edge to [[_COMMUNITY_User Domain Models]]

## Top bridge nodes
- [[Service Layer]] - degree 6, connects to 1 community
- [[Action Log Domain]] - degree 4, connects to 1 community
- [[UserActionLog Model]] - degree 3, connects to 1 community
- [[withPermission]] - degree 2, connects to 1 community