"use server";

/**
 * Server Action: Sync Profile from Keycloak
 *
 * Instantly syncs the user's profile from Keycloak to the app database.
 * Call this after the user updates their account info in Keycloak.
 *
 * @module app/actions/sync-profile
 */

import { auth } from "@/lib/auth";
import { authEvents } from "@/lib/auth/events";
import { headers } from "next/headers";

export interface SyncProfileResult {
    success: boolean;
    message: string;
    profile?: {
        email?: string;
        firstName?: string;
        lastName?: string;
        peaEmail?: string;
        employeeId?: string;
        position?: string;
        positionShort?: string;
        positionLevel?: string;
        department?: string;
        departmentShort?: string;
        phoneNumber?: string;
    };
}

/**
 * Sync user profile from Keycloak to database
 * This fetches the latest user info from Keycloak and updates the database
 */
export async function syncProfileFromKeycloak(): Promise<SyncProfileResult> {
    try {
        const session = await auth();

        if (!session?.user?.keycloakId || !session.accessToken) {
            return {
                success: false,
                message: "Not authenticated",
            };
        }

        // Get request context
        const headersList = await headers();
        const context = {
            ipAddress:
                headersList.get("x-forwarded-for")?.split(",")[0] ||
                headersList.get("x-real-ip") ||
                undefined,
            userAgent: headersList.get("user-agent") || undefined,
        };

        // Force sync from Keycloak userinfo endpoint
        const result = await authEvents.onForceSync(
            session.accessToken,
            session.user.keycloakId,
            context
        );

        if (!result.success) {
            return {
                success: false,
                message: result.error || "Failed to sync profile",
            };
        }

        return {
            success: true,
            message: "Profile synced successfully",
            profile: result.profile,
        };
    } catch (error) {
        console.error("Error in syncProfileFromKeycloak:", error);
        return {
            success: false,
            message: "An error occurred while syncing profile",
        };
    }
}

/**
 * Check if profile needs sync by comparing session with Keycloak
 * Returns the latest profile data from Keycloak
 */
export async function checkProfileSync(): Promise<{
    needsSync: boolean;
    keycloakProfile?: SyncProfileResult["profile"];
}> {
    try {
        const session = await auth();

        if (!session?.user?.keycloakId || !session.accessToken) {
            return { needsSync: false };
        }

        // Fetch latest from Keycloak userinfo
        const userinfoUrl = `${process.env.AUTH_KEYCLOAK_ISSUER}/protocol/openid-connect/userinfo`;

        const response = await fetch(userinfoUrl, {
            headers: {
                Authorization: `Bearer ${session.accessToken}`,
            },
        });

        if (!response.ok) {
            return { needsSync: false };
        }

        const userinfo = (await response.json()) as {
            sub?: string;
            email?: string;
            given_name?: string;
            family_name?: string;
            pea_email?: string;
            employee_id?: string;
            position?: string;
            position_short?: string;
            position_level?: string;
            department?: string;
            department_short?: string;
            phone?: string;
        };

        const keycloakProfile = {
            email: userinfo.email,
            firstName: userinfo.given_name,
            lastName: userinfo.family_name,
            peaEmail: userinfo.pea_email,
            employeeId: userinfo.employee_id,
            position: userinfo.position,
            positionShort: userinfo.position_short,
            positionLevel: userinfo.position_level,
            department: userinfo.department,
            departmentShort: userinfo.department_short,
            phoneNumber: userinfo.phone,
        };

        // Compare with session
        const needsSync =
            keycloakProfile.email !== session.user.email ||
            keycloakProfile.firstName !== session.user.firstName ||
            keycloakProfile.lastName !== session.user.lastName ||
            keycloakProfile.peaEmail !== session.user.peaEmail ||
            keycloakProfile.employeeId !== session.user.employeeId ||
            keycloakProfile.position !== session.user.position ||
            keycloakProfile.department !== session.user.department ||
            keycloakProfile.phoneNumber !== session.user.phoneNumber;

        return {
            needsSync,
            keycloakProfile,
        };
    } catch (error) {
        console.error("Error checking profile sync:", error);
        return { needsSync: false };
    }
}
