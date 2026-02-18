"use server";

import { z } from "zod";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { userService } from "@/lib/domains/user/service";
import { actionLogService } from "@/lib/domains/action-log/service";
import { userRepository } from "@/lib/domains/user/repository";
import { ActionType } from "@/lib/shared/types";
import type { Prisma } from "@/lib/generated/prisma/client";

// Profile update schema
const profileSchema = z.object({
    firstName: z
        .string()
        .min(1, "First name is required")
        .max(50, "First name must be less than 50 characters"),
    lastName: z
        .string()
        .min(1, "Last name is required")
        .max(50, "Last name must be less than 50 characters"),
    email: z
        .string()
        .email("Invalid email address")
        .max(100, "Email must be less than 100 characters"),
    peaEmail: z
        .string()
        .email("Invalid PEA email address")
        .max(100, "PEA Email must be less than 100 characters")
        .optional()
        .or(z.literal("")),
    employeeId: z
        .string()
        .max(50, "Employee ID must be less than 50 characters")
        .optional()
        .default(""),
    phoneNumber: z
        .string()
        .max(20, "Phone number must be less than 20 characters")
        .optional()
        .default(""),
    position: z
        .string()
        .max(100, "Position must be less than 100 characters")
        .optional()
        .default(""),
    positionShort: z
        .string()
        .max(20, "Position short must be less than 20 characters")
        .optional()
        .default(""),
    positionLevel: z
        .string()
        .max(50, "Position level must be less than 50 characters")
        .optional()
        .default(""),
    department: z
        .string()
        .max(100, "Department must be less than 100 characters")
        .optional()
        .default(""),
    departmentShort: z
        .string()
        .max(20, "Department short must be less than 20 characters")
        .optional()
        .default(""),
});

export type ProfileFormData = z.infer<typeof profileSchema>;

export type UpdatedUserData = {
    firstName: string;
    lastName: string;
    email: string;
    peaEmail?: string;
    employeeId?: string;
    phoneNumber?: string;
    position?: string;
    positionShort?: string;
    positionLevel?: string;
    department?: string;
    departmentShort?: string;
};

export type ProfileActionResult = {
    success: boolean;
    message: string;
    updatedUser?: UpdatedUserData;
    errors?: {
        firstName?: string[];
        lastName?: string[];
        email?: string[];
        peaEmail?: string[];
        employeeId?: string[];
        phoneNumber?: string[];
        position?: string[];
        positionShort?: string[];
        positionLevel?: string[];
        department?: string[];
        departmentShort?: string[];
    };
};

// Keycloak configuration - ensure these are set
const KEYCLOAK_ISSUER = process.env.AUTH_KEYCLOAK_ISSUER;
const KEYCLOAK_CLIENT_ID = process.env.AUTH_KEYCLOAK_ID;
const KEYCLOAK_CLIENT_SECRET = process.env.AUTH_KEYCLOAK_SECRET;

/**
 * Get Keycloak Admin API access token using client credentials
 */
async function getKeycloakAdminToken(): Promise<string | null> {
    try {
        if (!KEYCLOAK_ISSUER || !KEYCLOAK_CLIENT_ID || !KEYCLOAK_CLIENT_SECRET) {
            console.error("Missing Keycloak environment variables:", {
                hasIssuer: !!KEYCLOAK_ISSUER,
                hasClientId: !!KEYCLOAK_CLIENT_ID,
                hasClientSecret: !!KEYCLOAK_CLIENT_SECRET,
            });
            return null;
        }

        const tokenUrl = `${KEYCLOAK_ISSUER}/protocol/openid-connect/token`;

        const response = await fetch(tokenUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                client_id: KEYCLOAK_CLIENT_ID,
                client_secret: KEYCLOAK_CLIENT_SECRET,
                grant_type: "client_credentials",
            }),
        });

        if (!response.ok) {
            console.error("Failed to get admin token:", await response.text());
            return null;
        }

        const data = await response.json();
        return data.access_token;
    } catch (error) {
        console.error("Error getting Keycloak admin token:", error);
        return null;
    }
}

/**
 * Server Action to update user profile in Keycloak
 * 
 * This action updates the user's profile directly in Keycloak using the Admin API.
 * Required Keycloak client configuration:
 * - Client must have "Service Accounts Enabled" = ON
 * - Service account must have "manage-users" role from realm-management
 */
export async function updateKeycloakProfile(
    formData: ProfileFormData
): Promise<ProfileActionResult> {
    try {
        // Verify the user is authenticated
        const session = await auth();

        if (!session?.user || !session.user.keycloakId) {
            return {
                success: false,
                message: "You must be logged in to update your profile",
            };
        }

        // Validate the form data
        const validationResult = profileSchema.safeParse(formData);

        if (!validationResult.success) {
            return {
                success: false,
                message: "Validation failed",
                errors: validationResult.error.flatten().fieldErrors,
            };
        }

        const {
            firstName,
            lastName,
            email,
            peaEmail,
            employeeId,
            phoneNumber,
            position,
            positionShort,
            positionLevel,
            department,
            departmentShort,
        } = validationResult.data;

        // Get admin token for Keycloak API
        const adminToken = await getKeycloakAdminToken();

        if (!adminToken) {
            return {
                success: false,
                message: "Failed to authenticate with Keycloak. Please check server configuration.",
            };
        }

        if (!KEYCLOAK_ISSUER) {
            return {
                success: false,
                message: "Keycloak is not configured properly.",
            };
        }

        // Extract realm from issuer URL (e.g., "http://localhost:8080/realms/myrealm" -> "myrealm")
        const realmMatch = KEYCLOAK_ISSUER.match(/\/realms\/([^/]+)/);
        const realm = realmMatch ? realmMatch[1] : "master";

        // Extract base URL (e.g., "http://localhost:8080/realms/myrealm" -> "http://localhost:8080")
        const baseUrl = KEYCLOAK_ISSUER.replace(/\/realms\/.*$/, "");

        // Build the Keycloak Admin API URL for updating user
        const userUpdateUrl = `${baseUrl}/admin/realms/${realm}/users/${session.user.keycloakId}`;

        // First, fetch the current user to preserve existing attributes (especially required ones like pea_email)
        const getCurrentUserResponse = await fetch(userUpdateUrl, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${adminToken}`,
            },
        });

        if (!getCurrentUserResponse.ok) {
            console.error("Failed to fetch current user:", await getCurrentUserResponse.text());
            return {
                success: false,
                message: "Failed to fetch current user data from Keycloak.",
            };
        }

        const currentUser = await getCurrentUserResponse.json();

        // Prepare the user update payload
        // Merge existing attributes with new ones to preserve required fields (e.g., pea_email)
        const updatePayload = {
            firstName,
            lastName,
            email, // Update standard email field
            attributes: {
                ...currentUser.attributes, // Preserve all existing attributes
                pea_email: peaEmail ? [peaEmail] : currentUser.attributes?.pea_email ?? [],
                employee_id: employeeId ? [employeeId] : currentUser.attributes?.employee_id ?? [],
                phone: phoneNumber ? [phoneNumber] : [],
                position: position ? [position] : [],
                position_short: positionShort ? [positionShort] : [],
                position_level: positionLevel ? [positionLevel] : [],
                department: department ? [department] : [],
                department_short: departmentShort ? [departmentShort] : [],
            },
        };

        // Update user in Keycloak
        const updateResponse = await fetch(userUpdateUrl, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify(updatePayload),
        });

        if (!updateResponse.ok) {
            const errorText = await updateResponse.text();
            console.error("Keycloak update failed:", updateResponse.status, errorText);

            if (updateResponse.status === 403) {
                return {
                    success: false,
                    message: "Permission denied. The application does not have permission to update user profiles.",
                };
            }

            return {
                success: false,
                message: "Failed to update profile in Keycloak. Please try again.",
            };
        }

        console.log("Profile updated for user:", session.user.keycloakId);

        // Get request context for logging
        const headersList = await headers();
        const requestContext = {
            ipAddress:
                headersList.get("x-forwarded-for")?.split(",")[0] ||
                headersList.get("x-real-ip") ||
                undefined,
            userAgent: headersList.get("user-agent") || undefined,
            requestPath: "/profile/edit",
            requestMethod: "POST",
        };

        // Get existing user data for comparison logging
        const existingUser = await userRepository.findByKeycloakIdWithDepartment(
            session.user.keycloakId
        );
        const previousData = existingUser
            ? {
                email: existingUser.email,
                firstName: existingUser.firstName,
                lastName: existingUser.lastName,
                peaEmail: existingUser.peaEmail,
                employeeId: existingUser.employeeId,
                phoneNumber: existingUser.phoneNumber,
                position: existingUser.position,
                positionShort: existingUser.positionShort,
                positionLevel: existingUser.positionLevel,
                department: existingUser.department?.name,
            }
            : null;

        // Immediately sync to database
        const syncResult = await userService.syncFromKeycloak(
            {
                id: session.user.keycloakId,
                keycloakId: session.user.keycloakId,
                email,
                firstName,
                lastName,
                peaEmail: peaEmail || undefined,
                employeeId: employeeId || undefined,
                phoneNumber: phoneNumber || undefined,
                position: position || undefined,
                positionShort: positionShort || undefined,
                positionLevel: positionLevel || undefined,
                department: department || undefined,
                departmentShort: departmentShort || undefined,
            },
            requestContext
        );

        if (!syncResult.success) {
            console.error("Failed to sync profile to database:", syncResult.error);
            // Still return success since Keycloak was updated
            // But log the sync failure
        } else {
            // Log the profile edit action
            await actionLogService.log({
                userId: syncResult.data.id,
                actionType: ActionType.PROFILE_UPDATED,
                actionDescription: "User updated their profile",
                previousData: previousData as unknown as Prisma.JsonValue,
                newData: {
                    email,
                    firstName,
                    lastName,
                    peaEmail: peaEmail || null,
                    employeeId: employeeId || null,
                    phoneNumber: phoneNumber || null,
                    position: position || null,
                    positionShort: positionShort || null,
                    positionLevel: positionLevel || null,
                    department: department || null,
                } as unknown as Prisma.JsonValue,
                ipAddress: requestContext.ipAddress,
                userAgent: requestContext.userAgent,
            });

            console.log("Profile synced to database for user:", session.user.keycloakId);
        }

        // Revalidate the profile page to show updated data
        revalidatePath("/profile");

        return {
            success: true,
            message: "Profile updated successfully!",
            updatedUser: {
                firstName,
                lastName,
                email,
                peaEmail: peaEmail || undefined,
                employeeId: employeeId || undefined,
                phoneNumber: phoneNumber || undefined,
                position: position || undefined,
                positionShort: positionShort || undefined,
                positionLevel: positionLevel || undefined,
                department: department || undefined,
                departmentShort: departmentShort || undefined,
            },
        };
    } catch (error) {
        console.error("Error updating profile:", error);
        return {
            success: false,
            message: "An unexpected error occurred. Please try again.",
        };
    }
}

