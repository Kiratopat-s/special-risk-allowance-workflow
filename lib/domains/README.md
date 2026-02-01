# Domain Layer Architecture

This directory implements a **Clean Architecture** domain layer pattern for the Special Risk Allowance Workflow application.

## Overview

The domain layer follows the **Repository-Service** pattern, providing a clean separation between data access and business logic. Each domain is self-contained with its own types, repository, and service.

## Directory Structure

```
lib/domains/
├── index.ts                 # Public exports for all domains
├── README.md                # This file
│
├── user/                    # User Domain
│   ├── index.ts             # Public exports
│   ├── types.ts             # Entity types & interfaces
│   ├── repository.ts        # Data access layer
│   └── service.ts           # Business logic layer
│
├── department/              # Department Domain
│   ├── index.ts
│   ├── types.ts
│   ├── repository.ts
│   └── service.ts
│
└── action-log/              # Audit Log Domain
    ├── index.ts
    ├── types.ts
    ├── repository.ts
    └── service.ts
```

## Architecture Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                      Presentation Layer                      │
│              (React Components, Server Actions)              │
└─────────────────────────┬───────────────────────────────────┘
                          │ calls
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                       Service Layer                          │
│            (Business Logic, Orchestration)                   │
│                                                              │
│  • Validates business rules                                  │
│  • Orchestrates multiple repositories                        │
│  • Handles cross-cutting concerns (logging)                  │
│  • Returns Result<T> for error handling                      │
└─────────────────────────┬───────────────────────────────────┘
                          │ calls
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     Repository Layer                         │
│              (Data Access, Database Queries)                 │
│                                                              │
│  • CRUD operations                                           │
│  • Complex queries                                           │
│  • No business logic                                         │
│  • Returns raw entities or null                              │
└─────────────────────────┬───────────────────────────────────┘
                          │ uses
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      Prisma Client                           │
│                   (Database Connection)                      │
└─────────────────────────────────────────────────────────────┘
```

## Domain: User

Manages user entities synchronized from Keycloak.

### Types (`user/types.ts`)

```typescript
// Core entity
interface UserEntity {
    id: string;
    keycloakId: string;
    email: string;
    firstName: string;
    lastName: string;
    // ... other fields
}

// With relations
interface UserWithDepartment extends UserEntity {
    department: { id: string; name: string; shortName: string | null } | null;
}

// Keycloak profile (external data)
interface KeycloakUserProfile {
    keycloakId: string;
    email: string;
    firstName: string;
    lastName: string;
    // ... other fields
}

// Input types
interface CreateUserInput { ... }
interface UpdateUserInput { ... }
interface UserFilterCriteria { ... }
```

### Repository (`user/repository.ts`)

```typescript
import { userRepository } from "@/lib/domains/user";

// Find operations
const user = await userRepository.findById(id);
const user = await userRepository.findByKeycloakId(keycloakId);
const user = await userRepository.findByEmail(email);
const user = await userRepository.findWithDepartment(id);
const user = await userRepository.findByKeycloakIdWithDepartment(keycloakId);

// Create/Update
const newUser = await userRepository.create(data);
const updatedUser = await userRepository.update(id, data);
const user = await userRepository.updateLastLogin(id);

// Query
const users = await userRepository.findMany(criteria);
const count = await userRepository.count(criteria);
```

### Service (`user/service.ts`)

```typescript
import { userService } from "@/lib/domains/user";

// Get operations (returns Result<T>)
const result = await userService.getById(id);
const result = await userService.getByKeycloakId(keycloakId);
const result = await userService.getWithDepartment(id);

// Sync from Keycloak
const result = await userService.syncFromKeycloak(profile, context);

// Profile management
const result = await userService.updateProfile(userId, data, actorId, context);

// Authentication handlers
const result = await userService.handleLogin(keycloakId, context);
const result = await userService.handleLogout(userId, context);

// Status management
const result = await userService.changeStatus(userId, status, actorId, context);
```

## Domain: Department

Manages organizational departments with hierarchy support.

### Repository (`department/repository.ts`)

```typescript
import { departmentRepository } from "@/lib/domains/department";

const dept = await departmentRepository.findById(id);
const dept = await departmentRepository.findByName(name);
const dept = await departmentRepository.findOrCreateByName(name, shortName);
const depts = await departmentRepository.findAll();
const depts = await departmentRepository.findChildren(parentId);
```

### Service (`department/service.ts`)

```typescript
import { departmentService } from "@/lib/domains/department";

const result = await departmentService.getById(id);
const result = await departmentService.getOrCreateByName(name, shortName);
const result = await departmentService.getHierarchy(id);
```

## Domain: Action Log

Audit trail for all system actions.

### Repository (`action-log/repository.ts`)

```typescript
import { actionLogRepository } from "@/lib/domains/action-log";

const log = await actionLogRepository.create(data);
const logs = await actionLogRepository.findByUserId(userId, options);
const logs = await actionLogRepository.findByActionType(actionType, options);
const logs = await actionLogRepository.findRecent(limit);
```

### Service (`action-log/service.ts`)

```typescript
import { actionLogService } from "@/lib/domains/action-log";

// Log an action (fire-and-forget, won't throw)
await actionLogService.log({
  userId: "user-id",
  actionType: ActionType.LOGIN,
  actionDescription: "User logged in",
  ipAddress: "192.168.1.1",
  userAgent: "Mozilla/5.0...",
});

// Convenience methods
await actionLogService.logAuth(userId, ActionType.LOGIN, context);
await actionLogService.logCrud(userId, actionType, entity, entityId, context);

// Query logs
const result = await actionLogService.getUserLogs(userId, options);
const summary = await actionLogService.getSummary(userId);
```

## Result Type Pattern

All service methods return a `Result<T>` for consistent error handling:

```typescript
// Type definition
type Result<T> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string; code?: string };

// Usage in service
async function getById(id: string): Promise<Result<UserEntity>> {
  const user = await userRepository.findById(id);

  if (!user) {
    return error("User not found", "USER_NOT_FOUND");
  }

  return success(user);
}

// Usage in caller
const result = await userService.getById(id);

if (result.success) {
  console.log(result.data.email);
} else {
  console.error(result.error, result.code);
}
```

## Usage Examples

### Server Action Example

```typescript
// app/actions/user.ts
"use server";

import { userService } from "@/lib/domains/user";
import { actionLogService } from "@/lib/domains/action-log";
import { ActionType } from "@/lib/shared/types";

export async function updateUserProfile(userId: string, data: UpdateUserInput) {
  const result = await userService.updateProfile(
    userId,
    data,
    userId, // actor is the user themselves
    { requestPath: "/profile/edit" },
  );

  if (!result.success) {
    return { error: result.error };
  }

  return { user: result.data };
}
```

### API Route Example

```typescript
// app/api/users/[id]/route.ts
import { userService } from "@/lib/domains/user";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const result = await userService.getWithDepartment(params.id);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: result.code === "USER_NOT_FOUND" ? 404 : 500 },
    );
  }

  return NextResponse.json(result.data);
}
```

### Auth Event Handler Example

```typescript
// lib/auth/events.ts
import { userService } from "@/lib/domains/user";

export const authEvents = {
  async onSignIn(profile: KeycloakProfile) {
    const syncResult = await userService.syncFromKeycloak(profile, {
      requestPath: "/api/auth/callback/keycloak",
    });

    if (!syncResult.success) {
      console.error("Failed to sync user:", syncResult.error);
      return null;
    }

    await userService.handleLogin(profile.keycloakId);

    return { userId: syncResult.data.id };
  },
};
```

## Shared Types

Located in `lib/shared/types/`:

```typescript
// Enums (synced with Prisma)
export { UserStatus, ActionType } from "./enums";

// Result pattern
export { success, error, type Result } from "./result";

// Pagination
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
```

## Best Practices

### 1. Always Use Services in Application Code

```typescript
// ✅ Good - Use service layer
const result = await userService.getById(id);

// ❌ Bad - Don't use repository directly in app code
const user = await userRepository.findById(id);
```

### 2. Handle Results Properly

```typescript
// ✅ Good - Check success before accessing data
const result = await userService.getById(id);
if (result.success) {
  return result.data;
}
return null;

// ❌ Bad - Assuming success
const result = await userService.getById(id);
return result.data; // May not exist if !success
```

### 3. Pass Context for Logging

```typescript
// ✅ Good - Include request context
await userService.updateProfile(userId, data, actorId, {
  ipAddress: request.ip,
  userAgent: request.headers["user-agent"],
  requestPath: "/api/users",
});

// ❌ Bad - No context for audit trail
await userService.updateProfile(userId, data, actorId);
```

### 4. Keep Repository Methods Simple

```typescript
// ✅ Good - Repository does one thing
async findById(id: string): Promise<UserEntity | null> {
    return prisma.user.findUnique({ where: { id } });
}

// ❌ Bad - Business logic in repository
async findById(id: string): Promise<UserEntity | null> {
    const user = await prisma.user.findUnique({ where: { id } });
    if (user?.status === 'SUSPENDED') {
        throw new Error('User is suspended'); // This belongs in service
    }
    return user;
}
```

### 5. Use Type Imports

```typescript
// ✅ Good - Import types separately
import type { UserEntity, UpdateUserInput } from "./types";

// ❌ Bad - Import types as values
import { UserEntity, UpdateUserInput } from "./types";
```

## Related Documentation

- [Prisma Schema README](../../prisma/README.md)
- [Authentication Events](../auth/events.ts)
- [Shared Types](../shared/types/index.ts)
