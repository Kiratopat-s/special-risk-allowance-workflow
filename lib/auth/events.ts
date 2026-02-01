/**
 * Authentication Events Handler
 * 
 * Handles authentication-related events and integrates with domain services
 * for user synchronization and activity logging.
 * 
 * @module lib/auth/events
 */

import { userService } from "@/lib/domains/user/service";
import { actionLogService } from "@/lib/domains/action-log/service";
import { userRepository } from "@/lib/domains/user/repository";
import { ActionType } from "@/lib/shared/types";
import type { KeycloakUserProfile } from "@/lib/domains/user/types";

/**
 * Decoded Keycloak JWT token claims
 */
interface KeycloakJwtClaims {
    sub?: string;
    email?: string;
    given_name?: string;
    family_name?: string;
    pea_email?: string;
    position?: string;
    position_short?: string;
    position_level?: string;
    department?: string;
    department_short?: string;
    phone?: string;
    exp?: number;
    iat?: number;
}

/**
 * Decode a JWT token (without verification - just for reading claims)
 * @param token JWT token string
 * @returns Decoded payload or null if invalid
 */
const decodeJwt = <T = Record<string, unknown>>(token: string): T | null => {
    try {
        const parts = token.split(".");
        if (parts.length !== 3) return null;

        const payload = parts[1];
        const decoded = Buffer.from(payload, "base64url").toString("utf-8");
        return JSON.parse(decoded) as T;
    } catch {
        return null;
    }
};

/**
 * Request context extracted from headers
 */
export interface AuthRequestContext {
    ipAddress?: string;
    userAgent?: string;
}

/**
 * Keycloak profile from NextAuth
 */
interface KeycloakProfile {
    sub?: string;
    email?: string;
    given_name?: string;
    family_name?: string;
    pea_email?: string;
    position?: string;
    position_short?: string;
    position_level?: string;
    department?: string;
    department_short?: string;
    phone?: string;
}

/**
 * Convert NextAuth profile to KeycloakUserProfile
 */
const toKeycloakUserProfile = (profile: KeycloakProfile): KeycloakUserProfile | null => {
    if (!profile.sub || !profile.email || !profile.given_name || !profile.family_name) {
        return null;
    }

    return {
        id: profile.sub,
        keycloakId: profile.sub,
        email: profile.email,
        firstName: profile.given_name,
        lastName: profile.family_name,
        peaEmail: profile.pea_email,
        position: profile.position,
        positionShort: profile.position_short,
        positionLevel: profile.position_level,
        department: profile.department,
        departmentShort: profile.department_short,
        phoneNumber: profile.phone,
    };
};

/**
 * Authentication Events - Business logic for auth events
 */
export const authEvents = {
    /**
     * Handle user sign in event
     * Syncs user from Keycloak and logs the login
     */
    async onSignIn(
        profile: KeycloakProfile,
        context?: AuthRequestContext
    ): Promise<{ userId: string } | null> {
        try {
            const userProfile = toKeycloakUserProfile(profile);

            if (!userProfile) {
                console.error("Invalid Keycloak profile - missing required fields");
                return null;
            }

            // Sync user from Keycloak (creates or updates)
            const syncResult = await userService.syncFromKeycloak(userProfile, {
                ipAddress: context?.ipAddress,
                userAgent: context?.userAgent,
                requestPath: "/api/auth/callback/keycloak",
                requestMethod: "POST",
            });

            if (!syncResult.success) {
                console.error("Failed to sync user:", syncResult.error);
                return null;
            }

            const user = syncResult.data;

            // Handle login (updates lastLoginAt and logs)
            const loginResult = await userService.handleLogin(userProfile.keycloakId, {
                ipAddress: context?.ipAddress,
                userAgent: context?.userAgent,
                requestPath: "/api/auth/callback/keycloak",
                requestMethod: "POST",
            });

            if (!loginResult.success) {
                console.error("Login handling failed:", loginResult.error);
                // Still return user ID even if login handling failed
                // The user was synced successfully
            }

            return { userId: user.id };
        } catch (err) {
            console.error("Error in onSignIn:", err);
            return null;
        }
    },

    /**
     * Handle user sign out event
     * Logs the logout activity
     */
    async onSignOut(
        keycloakId: string,
        context?: AuthRequestContext
    ): Promise<void> {
        try {
            const user = await userRepository.findByKeycloakId(keycloakId);

            if (!user) {
                console.warn("User not found for logout logging:", keycloakId);
                return;
            }

            await userService.handleLogout(user.id, {
                ipAddress: context?.ipAddress,
                userAgent: context?.userAgent,
                requestPath: "/api/auth/signout",
                requestMethod: "POST",
            });
        } catch (err) {
            console.error("Error in onSignOut:", err);
        }
    },

    /**
     * Handle session refresh event
     * Logs token refresh activity
     */
    async onSessionRefresh(
        keycloakId: string,
        context?: AuthRequestContext
    ): Promise<void> {
        try {
            const user = await userRepository.findByKeycloakId(keycloakId);

            if (!user) {
                return;
            }

            await actionLogService.log({
                userId: user.id,
                actionType: ActionType.SESSION_REFRESH,
                actionDescription: "Session token refreshed",
                ipAddress: context?.ipAddress,
                userAgent: context?.userAgent,
            });
        } catch (err) {
            console.error("Error logging session refresh:", err);
        }
    },

    /**
     * Handle failed login attempt
     */
    async onLoginFailed(
        email: string,
        reason: string,
        context?: AuthRequestContext
    ): Promise<void> {
        try {
            // Try to find user by email to log the failed attempt
            const user = await userRepository.findByEmail(email);

            if (user) {
                await actionLogService.log({
                    userId: user.id,
                    actionType: ActionType.LOGIN_FAILED,
                    actionDescription: `Login failed: ${reason}`,
                    isSuccess: false,
                    errorMessage: reason,
                    ipAddress: context?.ipAddress,
                    userAgent: context?.userAgent,
                });
            }
        } catch (err) {
            console.error("Error logging failed login:", err);
        }
    },

    /**
     * Sync user profile from refreshed Keycloak access token
     * This handles the case when user updates their profile in Keycloak
     * and the changes should be reflected in the app database
     * 
     * @param accessToken The new access token from Keycloak
     * @param currentToken Current token data for comparison
     * @returns Updated token data with any profile changes
     */
    async onProfileSync(
        accessToken: string,
        currentToken: {
            keycloakId?: string;
            dbUserId?: string;
            email?: string;
            firstName?: string;
            lastName?: string;
            peaEmail?: string;
            position?: string;
            positionShort?: string;
            positionLevel?: string;
            department?: string;
            departmentShort?: string;
            phoneNumber?: string;
        },
        context?: AuthRequestContext
    ): Promise<{
        updated: boolean;
        tokenUpdates?: Partial<typeof currentToken>;
    }> {
        try {
            // Decode the new access token to get updated claims
            const claims = decodeJwt<KeycloakJwtClaims>(accessToken);

            if (!claims || !claims.sub) {
                return { updated: false };
            }

            // Check if profile has changed
            const profileFromToken = {
                email: claims.email,
                firstName: claims.given_name,
                lastName: claims.family_name,
                peaEmail: claims.pea_email,
                position: claims.position,
                positionShort: claims.position_short,
                positionLevel: claims.position_level,
                department: claims.department,
                departmentShort: claims.department_short,
                phoneNumber: claims.phone,
            };

            // Detect changes
            const hasChanges =
                profileFromToken.email !== currentToken.email ||
                profileFromToken.firstName !== currentToken.firstName ||
                profileFromToken.lastName !== currentToken.lastName ||
                profileFromToken.peaEmail !== currentToken.peaEmail ||
                profileFromToken.position !== currentToken.position ||
                profileFromToken.positionShort !== currentToken.positionShort ||
                profileFromToken.positionLevel !== currentToken.positionLevel ||
                profileFromToken.department !== currentToken.department ||
                profileFromToken.departmentShort !== currentToken.departmentShort ||
                profileFromToken.phoneNumber !== currentToken.phoneNumber;

            if (!hasChanges) {
                return { updated: false };
            }

            // Profile changed in Keycloak - sync to database
            const userProfile: KeycloakUserProfile = {
                id: claims.sub,
                keycloakId: claims.sub,
                email: claims.email || currentToken.email || "",
                firstName: claims.given_name || currentToken.firstName || "",
                lastName: claims.family_name || currentToken.lastName || "",
                peaEmail: claims.pea_email,
                position: claims.position,
                positionShort: claims.position_short,
                positionLevel: claims.position_level,
                department: claims.department,
                departmentShort: claims.department_short,
                phoneNumber: claims.phone,
            };

            const syncResult = await userService.syncFromKeycloak(userProfile, {
                ipAddress: context?.ipAddress,
                userAgent: context?.userAgent,
                requestPath: "/api/auth/token-refresh",
                requestMethod: "POST",
            });

            if (!syncResult.success) {
                console.error("Failed to sync profile changes:", syncResult.error);
                return { updated: false };
            }

            // Log profile sync event
            await actionLogService.log({
                userId: syncResult.data.id,
                actionType: ActionType.PROFILE_UPDATED,
                actionDescription: "User profile synced from Keycloak update",
                previousData: {
                    email: currentToken.email,
                    firstName: currentToken.firstName,
                    lastName: currentToken.lastName,
                    peaEmail: currentToken.peaEmail,
                    position: currentToken.position,
                    department: currentToken.department,
                } as unknown as import("@/lib/generated/prisma/client").Prisma.JsonValue,
                newData: {
                    email: profileFromToken.email,
                    firstName: profileFromToken.firstName,
                    lastName: profileFromToken.lastName,
                    peaEmail: profileFromToken.peaEmail,
                    position: profileFromToken.position,
                    department: profileFromToken.department,
                } as unknown as import("@/lib/generated/prisma/client").Prisma.JsonValue,
                ipAddress: context?.ipAddress,
                userAgent: context?.userAgent,
            });

            console.log(`Profile synced for user ${claims.email} from Keycloak update`);

            return {
                updated: true,
                tokenUpdates: profileFromToken,
            };
        } catch (err) {
            console.error("Error syncing profile from token:", err);
            return { updated: false };
        }
    },

    /**
     * Force sync user profile from Keycloak userinfo endpoint
     * This provides instant update without waiting for token refresh
     * 
     * @param accessToken Valid access token to fetch userinfo
     * @param keycloakId User's Keycloak ID for verification
     * @returns Updated profile data or null if failed
     */
    async onForceSync(
        accessToken: string,
        keycloakId: string,
        context?: AuthRequestContext
    ): Promise<{
        success: boolean;
        profile?: {
            email?: string;
            firstName?: string;
            lastName?: string;
            peaEmail?: string;
            position?: string;
            positionShort?: string;
            positionLevel?: string;
            department?: string;
            departmentShort?: string;
            phoneNumber?: string;
        };
        error?: string;
    }> {
        try {
            // Fetch latest user info from Keycloak userinfo endpoint
            const userinfoUrl = `${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/userinfo`;

            const response = await fetch(userinfoUrl, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Failed to fetch userinfo from Keycloak:", errorText);
                return {
                    success: false,
                    error: "Failed to fetch user info from Keycloak",
                };
            }

            const userinfo = await response.json() as KeycloakJwtClaims;

            // Verify the user matches
            if (userinfo.sub !== keycloakId) {
                return {
                    success: false,
                    error: "User ID mismatch",
                };
            }

            // Build profile from userinfo
            const userProfile: KeycloakUserProfile = {
                id: userinfo.sub,
                keycloakId: userinfo.sub,
                email: userinfo.email || "",
                firstName: userinfo.given_name || "",
                lastName: userinfo.family_name || "",
                peaEmail: userinfo.pea_email,
                position: userinfo.position,
                positionShort: userinfo.position_short,
                positionLevel: userinfo.position_level,
                department: userinfo.department,
                departmentShort: userinfo.department_short,
                phoneNumber: userinfo.phone,
            };

            // Get current user for comparison (with department relation)
            const existingUser = await userRepository.findByKeycloakIdWithDepartment(keycloakId);
            const previousData = existingUser ? {
                email: existingUser.email,
                firstName: existingUser.firstName,
                lastName: existingUser.lastName,
                peaEmail: existingUser.peaEmail,
                position: existingUser.position,
                department: existingUser.department?.name,
            } : null;

            // Sync to database
            const syncResult = await userService.syncFromKeycloak(userProfile, {
                ipAddress: context?.ipAddress,
                userAgent: context?.userAgent,
                requestPath: "/api/user/sync",
                requestMethod: "POST",
            });

            if (!syncResult.success) {
                return {
                    success: false,
                    error: syncResult.error || "Failed to sync user profile",
                };
            }

            // Log the instant sync
            await actionLogService.log({
                userId: syncResult.data.id,
                actionType: ActionType.PROFILE_UPDATED,
                actionDescription: "User profile instantly synced from Keycloak",
                previousData: previousData as unknown as import("@/lib/generated/prisma/client").Prisma.JsonValue,
                newData: {
                    email: userProfile.email,
                    firstName: userProfile.firstName,
                    lastName: userProfile.lastName,
                    peaEmail: userProfile.peaEmail,
                    position: userProfile.position,
                    department: userProfile.department,
                } as unknown as import("@/lib/generated/prisma/client").Prisma.JsonValue,
                ipAddress: context?.ipAddress,
                userAgent: context?.userAgent,
            });

            console.log(`Profile instantly synced for user ${userProfile.email}`);

            return {
                success: true,
                profile: {
                    email: userProfile.email,
                    firstName: userProfile.firstName,
                    lastName: userProfile.lastName,
                    peaEmail: userProfile.peaEmail,
                    position: userProfile.position,
                    positionShort: userProfile.positionShort,
                    positionLevel: userProfile.positionLevel,
                    department: userProfile.department,
                    departmentShort: userProfile.departmentShort,
                    phoneNumber: userProfile.phoneNumber,
                },
            };
        } catch (err) {
            console.error("Error in onForceSync:", err);
            return {
                success: false,
                error: "Internal error during profile sync",
            };
        }
    },
};
