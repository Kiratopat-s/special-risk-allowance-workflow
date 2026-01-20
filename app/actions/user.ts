"use server";

import { z } from "zod";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// Profile update schema
const profileSchema = z.object({
    displayName: z
        .string()
        .min(2, "Display name must be at least 2 characters")
        .max(50, "Display name must be less than 50 characters"),
    bio: z
        .string()
        .max(500, "Bio must be less than 500 characters")
        .optional()
        .default(""),
});

export type ProfileFormData = z.infer<typeof profileSchema>;

export type ProfileActionResult = {
    success: boolean;
    message: string;
    errors?: {
        displayName?: string[];
        bio?: string[];
    };
};

/**
 * Server Action to update user profile
 * 
 * Note: Since we are using Keycloak for authentication, this action
 * simulates updating a local database mapping. In a real application,
 * you would:
 * 1. Store additional user data in your database linked by Keycloak ID
 * 2. Optionally sync some fields back to Keycloak using their Admin API
 */
export async function updateProfile(
    formData: ProfileFormData
): Promise<ProfileActionResult> {
    try {
        // Verify the user is authenticated
        const session = await auth();

        if (!session?.user) {
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

        const { displayName, bio } = validationResult.data;

        // Simulate database update delay
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // In a real application, you would save to your database here:
        // await db.userProfile.upsert({
        //   where: { keycloakId: session.user.keycloakId },
        //   update: { displayName, bio },
        //   create: { keycloakId: session.user.keycloakId, displayName, bio },
        // });

        console.log("Profile updated for user:", session.user.keycloakId ?? session.user.id);
        console.log("New display name:", displayName);
        console.log("New bio:", bio);

        // Revalidate the profile page to show updated data
        revalidatePath("/profile");

        return {
            success: true,
            message: "Profile updated successfully!",
        };
    } catch (error) {
        console.error("Error updating profile:", error);
        return {
            success: false,
            message: "An unexpected error occurred. Please try again.",
        };
    }
}
