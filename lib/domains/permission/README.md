# Permission Domain

A comprehensive, extensible permission system for role-based access control (RBAC).

## Overview

This permission system provides:

- **Role-based access control (RBAC)** with fine-grained permissions
- **Department-scoped roles** for organizational hierarchy
- **Permission scopes** (OWN, DEPARTMENT, ALL) for flexible access control
- **Easy extensibility** for new features

## Architecture

```
┌─────────────┐     ┌─────────────┐
│    User     │────►│  UserRole   │
└─────────────┘     └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
        ┌──────────┐  ┌─────────┐  ┌──────────────┐
        │Department│  │  Role   │  │  (optional)  │
        │ (scope)  │  │         │  │  expiresAt   │
        └──────────┘  └────┬────┘  └──────────────┘
                           │
                           ▼
                    ┌────────────────┐
                    │ RolePermission │
                    └───────┬────────┘
                            │
                            ▼
                    ┌────────────────┐
                    │  Permission    │
                    │ (resource +    │
                    │  action +      │
                    │  scope)        │
                    └────────────────┘
```

## Core Concepts

### Permission

A permission defines what action can be performed on a resource.

```typescript
{
  code: "expense-claim:approve",
  resource: "EXPENSE_CLAIM",
  action: "APPROVE",
  scope: "DEPARTMENT"  // OWN | DEPARTMENT | ALL
}
```

### Role

A role groups multiple permissions together.

```typescript
{
  code: "manager",
  name: "Manager",
  level: 50,  // Higher = more authority
  permissions: [...]
}
```

### UserRole

Assigns a role to a user, optionally scoped to a department.

```typescript
{
  userId: "...",
  roleId: "...",
  departmentId: "...",  // null = global
  expiresAt: null       // Optional expiration
}
```

## Usage

### Server-Side Permission Checking

```typescript
import { can, hasRole } from "@/lib/auth";

// Check single permission
const canApprove = await can(userId, "EXPENSE_CLAIM", "APPROVE");

// Check with department scope
const canApproveInDept = await can(userId, "EXPENSE_CLAIM", "APPROVE", {
  departmentId: "dept-123",
});

// Check ownership-based permission
const canEdit = await can(userId, "EXPENSE_CLAIM", "UPDATE", {
  targetOwnerId: expenseClaim.userId,
});

// Check role
const isManager = await hasRole(userId, "manager");
```

### Protected Server Actions

```typescript
import { withPermission } from "@/lib/auth";

const updateExpenseClaim = withPermission(
  "EXPENSE_CLAIM",
  "UPDATE",
  async (claimId, data) => session.user.dbUserId,
  async (claimId, data) => {
    // Your implementation
  },
);
```

### Client-Side Permission Checking

```tsx
import {
  usePermissions,
  PermissionGate,
  RoleGate,
} from "@/lib/hooks/use-permissions";

// Hook usage
function MyComponent() {
  const { can, hasRole, isLoading } = usePermissions();

  if (isLoading) return <Loading />;

  return (
    <div>
      {can("EXPENSE_CLAIM", "CREATE") && <button>Create Expense Claim</button>}
    </div>
  );
}

// Component gate usage
function MyPage() {
  return (
    <PermissionGate
      resource="EXPENSE_CLAIM"
      action="APPROVE"
      fallback={<p>Access denied</p>}
    >
      <ApprovalPanel />
    </PermissionGate>
  );
}

// Role gate usage
function AdminPanel() {
  return (
    <RoleGate role="admin">
      <AdminControls />
    </RoleGate>
  );
}
```

## Adding New Permissions

### 1. Update Prisma Schema (if new resource)

```prisma
enum PermissionResource {
  // ... existing resources
  NEW_FEATURE
}
```

### 2. Add Default Permissions

Edit `lib/domains/permission/seed.ts`:

```typescript
export const DEFAULT_PERMISSIONS: CreatePermissionInput[] = [
  // ... existing permissions

  // NEW FEATURE PERMISSIONS
  {
    code: "new-feature:create",
    name: "Create New Feature",
    resource: "NEW_FEATURE",
    action: "CREATE",
    scope: "OWN",
    isSystem: true,
  },
  {
    code: "new-feature:read",
    name: "Read New Feature",
    resource: "NEW_FEATURE",
    action: "READ",
    scope: "OWN",
    isSystem: true,
  },
  // Add more as needed...
];
```

### 3. Assign to Roles

Edit `ROLE_PERMISSIONS` in `seed.ts`:

```typescript
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  "super-admin": [
    // ...
    "new-feature:manage",
  ],
  employee: [
    // ...
    "new-feature:create",
    "new-feature:read",
  ],
};
```

### 4. Run Seed

```bash
npx prisma db seed
# Or call seedPermissions() programmatically
```

## Default Roles

| Role        | Level | Description                      |
| ----------- | ----- | -------------------------------- |
| super-admin | 100   | Full system access               |
| admin       | 90    | User & system management         |
| manager     | 50    | Department management, approvals |
| supervisor  | 40    | Team oversight                   |
| employee    | 10    | Basic self-service access        |
| viewer      | 5     | Read-only access                 |

## Database Tables

- `permissions` - Permission definitions
- `roles` - Role definitions
- `role_permissions` - Role-to-permission mapping
- `user_roles` - User-to-role assignments

## Best Practices

1. **Use MANAGE for admin roles** - The `MANAGE` action implies all other actions for a resource
2. **Scope appropriately** - Use `OWN` for personal data, `DEPARTMENT` for team data, `ALL` for admin
3. **Check at the boundary** - Verify permissions in server actions, not just UI
4. **Cache when possible** - Use `getEffectivePermissions()` to get all permissions at once
5. **Don't hardcode roles** - Check permissions, not role names (except for admin gates)
