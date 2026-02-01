"use client";

/**
 * Hook: useProfileSync
 *
 * Automatically syncs user profile from Keycloak when:
 * 1. User returns from Keycloak account management page
 * 2. Manually triggered via syncProfile()
 *
 * @module lib/hooks/use-profile-sync
 */

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import {
    syncProfileFromKeycloak,
    type SyncProfileResult,
} from "@/app/actions/sync-profile";

interface UseProfileSyncOptions {
    /**
     * Auto-sync when the window regains focus (user returns from Keycloak)
     * @default true
     */
    syncOnFocus?: boolean;

    /**
     * Auto-sync when the component mounts
     * @default false
     */
    syncOnMount?: boolean;

    /**
     * Callback when profile is successfully synced
     */
    onSyncSuccess?: (profile: SyncProfileResult["profile"]) => void;

    /**
     * Callback when sync fails
     */
    onSyncError?: (error: string) => void;
}

export function useProfileSync(options: UseProfileSyncOptions = {}) {
    const {
        syncOnFocus = true,
        syncOnMount = false,
        onSyncSuccess,
        onSyncError,
    } = options;

    const { update: updateSession } = useSession();
    const [isPending, startTransition] = useTransition();
    const [lastSyncResult, setLastSyncResult] = useState<SyncProfileResult | null>(
        null
    );
    const lastSyncTime = useRef<number>(0);

    /**
     * Sync profile from Keycloak and update the session
     */
    const syncProfile = useCallback(async () => {
        // Debounce: prevent multiple syncs within 5 seconds
        const now = Date.now();
        if (now - lastSyncTime.current < 5000) {
            return lastSyncResult;
        }
        lastSyncTime.current = now;

        return new Promise<SyncProfileResult>((resolve) => {
            startTransition(async () => {
                try {
                    const result = await syncProfileFromKeycloak();
                    setLastSyncResult(result);

                    if (result.success && result.profile) {
                        // Update NextAuth session with new profile data
                        await updateSession({
                            user: {
                                email: result.profile.email,
                                firstName: result.profile.firstName,
                                lastName: result.profile.lastName,
                                peaEmail: result.profile.peaEmail,
                                position: result.profile.position,
                                positionShort: result.profile.positionShort,
                                positionLevel: result.profile.positionLevel,
                                department: result.profile.department,
                                departmentShort: result.profile.departmentShort,
                                phoneNumber: result.profile.phoneNumber,
                            },
                        });

                        onSyncSuccess?.(result.profile);
                    } else if (!result.success) {
                        onSyncError?.(result.message);
                    }

                    resolve(result);
                } catch (error) {
                    const errorResult: SyncProfileResult = {
                        success: false,
                        message:
                            error instanceof Error ? error.message : "Unknown error",
                    };
                    setLastSyncResult(errorResult);
                    onSyncError?.(errorResult.message);
                    resolve(errorResult);
                }
            });
        });
    }, [updateSession, onSyncSuccess, onSyncError, lastSyncResult]);

    // Auto-sync on mount
    useEffect(() => {
        if (syncOnMount) {
            syncProfile();
        }
    }, [syncOnMount, syncProfile]);

    // Auto-sync when window regains focus (user returns from Keycloak)
    useEffect(() => {
        if (!syncOnFocus) return;

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                // User returned to the tab - sync profile
                syncProfile();
            }
        };

        const handleFocus = () => {
            // User focused the window - sync profile
            syncProfile();
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        window.addEventListener("focus", handleFocus);

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            window.removeEventListener("focus", handleFocus);
        };
    }, [syncOnFocus, syncProfile]);

    return {
        /**
         * Manually trigger profile sync
         */
        syncProfile,

        /**
         * Whether a sync is in progress
         */
        isSyncing: isPending,

        /**
         * The result of the last sync operation
         */
        lastSyncResult,
    };
}
