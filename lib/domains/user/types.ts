/**
 * User Domain - Entity Types
 * 
 * Pure domain types for User entity
 * These types are framework-agnostic and represent the business domain
 * 
 * @module lib/domains/user/types
 */

import type { UserStatus } from "@/lib/shared/types";

/**
 * Core User entity interface
 */
export interface UserEntity {
    id: string;
    keycloakId: string;
    email: string;
    peaEmail: string | null;
    firstName: string;
    lastName: string;
    phoneNumber: string | null;
    position: string | null;
    positionShort: string | null;
    positionLevel: string | null;
    departmentId: string | null;
    status: UserStatus;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * User with department details
 */
export interface UserWithDepartment extends UserEntity {
    department: {
        id: string;
        name: string;
        shortName: string | null;
    } | null;
}

/**
 * Keycloak user profile data
 */
export interface KeycloakUserProfile {
    id: string;
    keycloakId: string;
    name?: string;
    email: string;
    firstName: string;
    lastName: string;
    peaEmail?: string;
    position?: string;
    positionShort?: string;
    positionLevel?: string;
    department?: string;
    departmentShort?: string;
    phoneNumber?: string;
}

/**
 * Data required to create a new user
 */
export interface CreateUserInput {
    keycloakId: string;
    email: string;
    firstName: string;
    lastName: string;
    peaEmail?: string;
    phoneNumber?: string;
    position?: string;
    positionShort?: string;
    positionLevel?: string;
    departmentId?: string;
}

/**
 * Data required to update a user
 */
export interface UpdateUserInput {
    email?: string;
    peaEmail?: string;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    position?: string;
    positionShort?: string;
    positionLevel?: string;
    departmentId?: string | null;
    status?: UserStatus;
}

/**
 * User search/filter criteria
 */
export interface UserFilterCriteria {
    search?: string;
    status?: UserStatus;
    departmentId?: string;
    page?: number;
    pageSize?: number;
}
