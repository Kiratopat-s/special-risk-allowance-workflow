"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Key, ChevronDown, ChevronRight } from "lucide-react";
import type { PermissionEntity } from "@/lib/domains/permission";

// =============================================================================
// TYPES
// =============================================================================

interface PermissionsClientProps {
  permissions: PermissionEntity[];
}

// =============================================================================
// HELPERS
// =============================================================================

function scopeBadgeVariant(scope: string) {
  switch (scope) {
    case "ALL":
      return "destructive" as const;
    case "DEPARTMENT":
      return "warning" as const;
    case "OWN":
      return "default" as const;
    default:
      return "secondary" as const;
  }
}

function actionBadgeVariant(action: string) {
  switch (action) {
    case "DELETE":
      return "destructive" as const;
    case "CREATE":
    case "UPDATE":
      return "warning" as const;
    case "MANAGE":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

function groupByResource(
  permissions: PermissionEntity[],
): Record<string, PermissionEntity[]> {
  return permissions.reduce((acc, perm) => {
    const key = perm.resource;
    if (!acc[key]) acc[key] = [];
    acc[key].push(perm);
    return acc;
  }, {} as Record<string, PermissionEntity[]>);
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function PermissionsClient({ permissions }: PermissionsClientProps) {
  const [search, setSearch] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const filtered = permissions.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase()) ||
      p.resource.toLowerCase().includes(search.toLowerCase()),
  );

  const grouped = groupByResource(filtered);
  const resourceKeys = Object.keys(grouped).sort();

  const toggleGroup = (resource: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(resource)) next.delete(resource);
      else next.add(resource);
      return next;
    });
  };

  const toggleAll = () => {
    if (expandedGroups.size === resourceKeys.length) {
      setExpandedGroups(new Set());
    } else {
      setExpandedGroups(new Set(resourceKeys));
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search permissions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <button
          onClick={toggleAll}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {expandedGroups.size === resourceKeys.length
            ? "Collapse all"
            : "Expand all"}
        </button>
        <Badge variant="outline">{filtered.length} permissions</Badge>
      </div>

      {/* Permission Groups */}
      <div className="space-y-2">
        {resourceKeys.map((resource) => {
          const perms = grouped[resource];
          const isExpanded = expandedGroups.has(resource);

          return (
            <div
              key={resource}
              className="rounded-lg border border-border overflow-hidden"
            >
              {/* Group header */}
              <button
                onClick={() => toggleGroup(resource)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <Key className="h-4 w-4 text-muted-foreground" />
                  <span className="uppercase tracking-wider text-xs">
                    {resource.replace(/_/g, " ")}
                  </span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {perms.length}
                </Badge>
              </button>

              {/* Group items */}
              {isExpanded && (
                <div className="border-t border-border">
                  {perms.map((perm, i) => (
                    <div
                      key={perm.id}
                      className={`flex items-center justify-between px-4 py-2.5 text-sm ${
                        i < perms.length - 1 ? "border-b border-border/50" : ""
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{perm.name}</div>
                        <div className="text-xs text-muted-foreground font-mono truncate">
                          {perm.code}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 ml-3 shrink-0">
                        <Badge
                          variant={actionBadgeVariant(perm.action)}
                          className="text-[10px]"
                        >
                          {perm.action}
                        </Badge>
                        <Badge
                          variant={scopeBadgeVariant(perm.scope)}
                          className="text-[10px]"
                        >
                          {perm.scope}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {resourceKeys.length === 0 && (
          <div className="text-center py-12 text-sm text-muted-foreground">
            No permissions found
          </div>
        )}
      </div>
    </div>
  );
}
