# Prisma Database Schema

This directory contains the Prisma ORM configuration for the Special Risk Allowance Workflow application.

## Overview

We use **Prisma 7** with the PostgreSQL driver adapter (`@prisma/adapter-pg`) for database operations. The schema follows a clean architecture domain model pattern.

## Directory Structure

```
prisma/
├── schema.prisma          # Main schema definition
├── migrations/            # Database migration history
│   └── {timestamp}_{name}/
│       └── migration.sql
└── README.md              # This file
```

## Schema Models

### 1. User

Stores user information synchronized from Keycloak.

| Field           | Type       | Description                          |
| --------------- | ---------- | ------------------------------------ |
| `id`            | UUID       | Primary key                          |
| `keycloakId`    | String     | Unique Keycloak user ID              |
| `email`         | String     | Unique email address                 |
| `peaEmail`      | String?    | PEA organization email               |
| `firstName`     | String     | First name                           |
| `lastName`      | String     | Last name                            |
| `phoneNumber`   | String?    | Contact phone number                 |
| `position`      | String?    | Job position/title                   |
| `positionShort` | String?    | Abbreviated position                 |
| `positionLevel` | String?    | Position level                       |
| `departmentId`  | UUID?      | FK to Department                     |
| `status`        | UserStatus | ACTIVE, INACTIVE, SUSPENDED, PENDING |
| `lastLoginAt`   | DateTime?  | Last login timestamp                 |
| `createdAt`     | DateTime   | Record creation time                 |
| `updatedAt`     | DateTime   | Last update time                     |

### 2. Department

Organizational department structure with hierarchy support.

| Field         | Type     | Description                       |
| ------------- | -------- | --------------------------------- |
| `id`          | UUID     | Primary key                       |
| `name`        | String   | Unique department name            |
| `shortName`   | String?  | Unique abbreviated name           |
| `description` | String?  | Department description            |
| `parentId`    | UUID?    | FK for hierarchy (self-reference) |
| `isActive`    | Boolean  | Active status flag                |
| `createdAt`   | DateTime | Record creation time              |
| `updatedAt`   | DateTime | Last update time                  |

### 3. UserActionLog

Audit trail for all user actions in the system.

| Field                | Type       | Description                       |
| -------------------- | ---------- | --------------------------------- |
| `id`                 | UUID       | Primary key                       |
| `userId`             | UUID       | FK to User (actor)                |
| `actionType`         | ActionType | Type of action performed          |
| `actionDescription`  | String?    | Human-readable description        |
| `targetUserId`       | UUID?      | FK to target User (if applicable) |
| `targetDepartmentId` | UUID?      | FK to target Department           |
| `targetEntityType`   | String?    | Generic entity type               |
| `targetEntityId`     | String?    | Generic entity ID                 |
| `ipAddress`          | String?    | Request IP address                |
| `userAgent`          | String?    | Browser user agent                |
| `requestPath`        | String?    | API endpoint path                 |
| `requestMethod`      | String?    | HTTP method (GET, POST, etc.)     |
| `metadata`           | JSON?      | Additional structured data        |
| `previousData`       | JSON?      | State before change               |
| `newData`            | JSON?      | State after change                |
| `isSuccess`          | Boolean    | Action success flag               |
| `errorMessage`       | String?    | Error details if failed           |
| `createdAt`          | DateTime   | Action timestamp                  |

## Enums

### UserStatus

```prisma
enum UserStatus {
  ACTIVE      // User can access the system
  INACTIVE    // User is deactivated
  SUSPENDED   // User is temporarily suspended
  PENDING     // Awaiting approval/activation
}
```

### ActionType

```prisma
enum ActionType {
  // Authentication
  LOGIN, LOGOUT, LOGIN_FAILED, SESSION_REFRESH

  // User Management
  USER_CREATED, USER_UPDATED, USER_DELETED, USER_STATUS_CHANGED

  // Profile Management
  PROFILE_VIEWED, PROFILE_UPDATED, PASSWORD_CHANGED

  // Department Management
  DEPARTMENT_CREATED, DEPARTMENT_UPDATED, DEPARTMENT_DELETED

  // System Actions
  SYSTEM_ACCESS, PERMISSION_GRANTED, PERMISSION_REVOKED

  // Data Operations
  DATA_EXPORTED, DATA_IMPORTED

  // Other
  OTHER
}
```

## Configuration

### Generator

```prisma
generator client {
  provider = "prisma-client"
  output   = "../lib/generated/prisma"
}
```

The Prisma Client is generated to `lib/generated/prisma/` for use with the domain layer.

### Datasource

```prisma
datasource db {
  provider = "postgresql"
}
```

The connection string is read from the `DATABASE_URL` environment variable.

## Commands

### Generate Prisma Client

After modifying the schema, regenerate the client:

```bash
bunx prisma generate
```

### Create Migration

Create a new migration after schema changes:

```bash
bunx prisma migrate dev --name <migration_name>
```

Example:

```bash
bunx prisma migrate dev --name add_user_role
```

### Apply Migrations (Production)

```bash
bunx prisma migrate deploy
```

### Reset Database (Development Only)

⚠️ **Warning**: This will delete all data!

```bash
bunx prisma migrate reset
```

### View Database

Open Prisma Studio to view/edit data:

```bash
bunx prisma studio
```

### Database Status

Check migration status:

```bash
bunx prisma migrate status
```

## Environment Variables

Required in `.env`:

```env
DATABASE_URL="postgresql://user:password@host:5432/database?schema=public"
```

## Singleton Pattern

The Prisma Client uses a singleton pattern to prevent connection issues during development hot reloads. See `lib/db/prisma.ts`:

```typescript
import { prisma } from "@/lib/db";

// Use prisma for all database operations
const user = await prisma.user.findUnique({ where: { id } });
```

## Best Practices

1. **Always use migrations** - Never modify the database directly
2. **Descriptive migration names** - Use clear names like `add_user_phone_field`
3. **Review generated SQL** - Check migration files before applying
4. **Test migrations locally** - Run `migrate dev` before deploying
5. **Use transactions** - For operations that need to be atomic
6. **Index frequently queried fields** - Already configured in schema

## Related Documentation

- [Prisma Documentation](https://www.prisma.io/docs)
- [PostgreSQL Adapter](https://www.prisma.io/docs/orm/prisma-client/databases/postgresql)
- [Domain Layer README](../lib/domains/README.md)
