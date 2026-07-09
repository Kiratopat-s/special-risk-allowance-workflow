---
type: community
cohesion: 0.50
members: 5
---

# Department Data Model

**Cohesion:** 0.50 - moderately connected
**Members:** 5 nodes

## Members
- [[Department]] - concept - lib/domains/permission/README.md
- [[Department Domain]] - concept - lib/domains/README.md
- [[Department Hierarchy]] - concept - lib/domains/README.md
- [[Department Hierarchy_1]] - concept - prisma/README.md
- [[Department Model]] - concept - prisma/README.md

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Department_Data_Model
SORT file.name ASC
```

## Connections to other communities
- 1 edge to [[_COMMUNITY_Architecture Prisma Docs]]
- 1 edge to [[_COMMUNITY_Permission RBAC Docs]]

## Top bridge nodes
- [[Department Domain]] - degree 3, connects to 1 community
- [[Department]] - degree 2, connects to 1 community