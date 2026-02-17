/**
 * User Domain - Service Layer
 * 
 * Business logic layer for User operations
 * Orchestrates between repository and external services
 * 
 * @module lib/domains/user/service
 */

import { userRepository } from "./repository";
import { actionLogService } from "@/lib/domains/action-log/service";
import { departmentRepository } from "@/lib/domains/department/repository";
import { userRoleRepository, roleRepository } from "@/lib/domains/permission/repository";
import { ActionType, UserStatus } from "@/lib/shared/types";
import { success, error, type Result } from "@/lib/shared/types";
import type { Prisma } from "@/lib/generated/prisma/client";
import type {
    UserEntity,
    UserWithDepartment,
    KeycloakUserProfile,
    CreateUserInput,
    UpdateUserInput,
    UserFilterCriteria,
} from "./types";
import type { PaginatedResult } from "@/lib/shared/types";

type JsonValue = Prisma.JsonValue;

/**
 * Request context for logging
 */
interface RequestContext {
    ipAddress?: string;
    userAgent?: string;
    requestPath?: string;
    requestMethod?: string;
}

/**
 * User Service - Business logic functions
 */
export const userService = {
    /**
     * Get user by ID
     */
    async getById(id: string): Promise<Result<UserEntity>> {
        const user = await userRepository.findById(id);

        if (!user) {
            return error("User not found", "USER_NOT_FOUND");
        }

        return success(user);
    },

    /**
     * Get user by Keycloak ID
     */
    async getByKeycloakId(keycloakId: string): Promise<Result<UserEntity>> {
        const user = await userRepository.findByKeycloakId(keycloakId);

        if (!user) {
            return error("User not found", "USER_NOT_FOUND");
        }

        return success(user);
    },

    /**
     * Get user with department details
     */
    async getWithDepartment(id: string): Promise<Result<UserWithDepartment>> {
        const user = await userRepository.findWithDepartment(id);

        if (!user) {
            return error("User not found", "USER_NOT_FOUND");
        }

        return success(user);
    },

    /**
     * Sync user from Keycloak profile
     * Creates new user or updates existing one based on Keycloak ID
     */
    async syncFromKeycloak(
        profile: KeycloakUserProfile,
        context?: RequestContext
    ): Promise<Result<UserEntity>> {
        const existingUser = await userRepository.findByKeycloakId(profile.keycloakId);

        // Find or create department if provided
        let departmentId: string | undefined;
        if (profile.department) {
            const dept = await departmentRepository.findOrCreateByName(
                profile.department,
                profile.departmentShort
            );
            departmentId = dept.id;
        }

        if (existingUser) {
            // Update existing user
            const updatedUser = await userRepository.update(existingUser.id, {
                email: profile.email,
                firstName: profile.firstName,
                lastName: profile.lastName,
                peaEmail: profile.peaEmail,
                phoneNumber: profile.phoneNumber,
                position: profile.position,
                positionShort: profile.positionShort,
                positionLevel: profile.positionLevel,
                departmentId,
            });

            return success(updatedUser, "User profile synced successfully");
        }

        // Create new user
        const newUser = await userRepository.create({
            keycloakId: profile.keycloakId,
            email: profile.email,
            firstName: profile.firstName,
            lastName: profile.lastName,
            peaEmail: profile.peaEmail,
            phoneNumber: profile.phoneNumber,
            position: profile.position,
            positionShort: profile.positionShort,
            positionLevel: profile.positionLevel,
            departmentId,
        });

        // Log user creation
        await actionLogService.log({
            userId: newUser.id,
            actionType: ActionType.USER_CREATED,
            actionDescription: "New user created from Keycloak sync",
            newData: { email: newUser.email, keycloakId: newUser.keycloakId } as unknown as JsonValue,
            ...context,
        });

        // Auto-assign default "employee" role
        try {
            const employeeRole = await roleRepository.findByCode("employee");
            if (employeeRole) {
                await userRoleRepository.assign({
                    userId: newUser.id,
                    roleId: employeeRole.id,
                });
            }
        } catch {
            // Non-critical: log but don't fail user creation
            console.warn(`Failed to assign default employee role to user ${newUser.id}`);
        }

        return success(newUser, "User created successfully");
    },

    /**
     * Update user profile
     */
    async updateProfile(
        userId: string,
        data: UpdateUserInput,
        actorId: string,
        context?: RequestContext
    ): Promise<Result<UserEntity>> {
        const existingUser = await userRepository.findById(userId);

        if (!existingUser) {
            return error("User not found", "USER_NOT_FOUND");
        }

        const previousData = {
            email: existingUser.email,
            firstName: existingUser.firstName,
            lastName: existingUser.lastName,
            phoneNumber: existingUser.phoneNumber,
        };

        const updatedUser = await userRepository.update(userId, data);

        // Log profile update
        await actionLogService.log({
            userId: actorId,
            actionType: ActionType.PROFILE_UPDATED,
            actionDescription: `Profile updated for user ${existingUser.email}`,
            targetUserId: userId !== actorId ? userId : undefined,
            previousData: previousData as unknown as JsonValue,
            newData: data as unknown as JsonValue,
            ...context,
        });

        return success(updatedUser, "Profile updated successfully");
    },

    /**
     * Handle user login
     */
    async handleLogin(
        keycloakId: string,
        context?: RequestContext
    ): Promise<Result<UserEntity>> {
        const user = await userRepository.findByKeycloakId(keycloakId);

        if (!user) {
            return error("User not found", "USER_NOT_FOUND");
        }

        if (user.status !== UserStatus.ACTIVE) {
            await actionLogService.log({
                userId: user.id,
                actionType: ActionType.LOGIN_FAILED,
                actionDescription: `Login attempt blocked - user status: ${user.status}`,
                isSuccess: false,
                errorMessage: `User account is ${user.status.toLowerCase()}`,
                ...context,
            });

            return error(
                `Your account is ${user.status.toLowerCase()}. Please contact support.`,
                "USER_INACTIVE"
            );
        }

        // Update last login
        const updatedUser = await userRepository.updateLastLogin(user.id);

        // Log successful login
        await actionLogService.log({
            userId: user.id,
            actionType: ActionType.LOGIN,
            actionDescription: "User logged in successfully",
            ...context,
        });

        return success(updatedUser);
    },

    /**
     * Handle user logout
     */
    async handleLogout(
        userId: string,
        context?: RequestContext
    ): Promise<Result<void>> {
        await actionLogService.log({
            userId,
            actionType: ActionType.LOGOUT,
            actionDescription: "User logged out",
            ...context,
        });

        return success(undefined, "Logged out successfully");
    },

    /**
     * Change user status
     */
    async changeStatus(
        userId: string,
        newStatus: UserStatus,
        actorId: string,
        context?: RequestContext
    ): Promise<Result<UserEntity>> {
        const user = await userRepository.findById(userId);

        if (!user) {
            return error("User not found", "USER_NOT_FOUND");
        }

        const previousStatus = user.status;
        const updatedUser = await userRepository.update(userId, { status: newStatus });

        // Log status change
        await actionLogService.log({
            userId: actorId,
            actionType: ActionType.USER_STATUS_CHANGED,
            actionDescription: `User status changed from ${previousStatus} to ${newStatus}`,
            targetUserId: userId,
            previousData: { status: previousStatus } as unknown as JsonValue,
            newData: { status: newStatus } as unknown as JsonValue,
            ...context,
        });

        return success(updatedUser, `User status changed to ${newStatus}`);
    },

    /**
     * List users with filters
     */
    async list(
        criteria: UserFilterCriteria
    ): Promise<Result<PaginatedResult<UserEntity>>> {
        const result = await userRepository.findMany(criteria);
        return success(result);
    },

    /**
     * Delete user (soft delete by changing status)
     */
    async softDelete(
        userId: string,
        actorId: string,
        context?: RequestContext
    ): Promise<Result<UserEntity>> {
        return this.changeStatus(userId, UserStatus.INACTIVE, actorId, context);
    },

    /**
     * Hard delete user (use with caution)
     */
    async hardDelete(
        userId: string,
        actorId: string,
        context?: RequestContext
    ): Promise<Result<void>> {
        const user = await userRepository.findById(userId);

        if (!user) {
            return error("User not found", "USER_NOT_FOUND");
        }

        await userRepository.delete(userId);

        // Log deletion
        await actionLogService.log({
            userId: actorId,
            actionType: ActionType.USER_DELETED,
            actionDescription: `User ${user.email} permanently deleted`,
            previousData: { email: user.email, keycloakId: user.keycloakId } as unknown as JsonValue,
            ...context,
        });

        return success(undefined, "User deleted successfully");
    },
};
