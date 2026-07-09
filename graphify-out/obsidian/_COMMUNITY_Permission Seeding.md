---
type: community
cohesion: 0.40
members: 6
---

# Permission Seeding

**Cohesion:** 0.40 - moderately connected
**Members:** 6 nodes

## Members
- [[DEFAULT_PERMISSIONS_1]] - concept - lib/domains/permission/README.md
- [[Database Indexing Principle]] - rationale - prisma/README.md
- [[PermissionResource Enum]] - concept - lib/domains/permission/README.md
- [[ROLE_PERMISSIONS_1]] - concept - lib/domains/permission/README.md
- [[schema.prisma]] - concept - prisma/README.md
- [[seedPermissions]] - concept - lib/domains/permission/README.md

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Permission_Seeding
SORT file.name ASC
```

## Connections to other communities
- 1 edge to [[_COMMUNITY_Permission RBAC Docs]]
- 1 edge to [[_COMMUNITY_Architecture Prisma Docs]]

## Top bridge nodes
- [[ROLE_PERMISSIONS_1]] - degree 3, connects to 1 community
- [[schema.prisma]] - degree 3, connects to 1 community