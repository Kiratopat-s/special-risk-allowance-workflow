"use client";

import { useEffect } from "react";
import { useSession, signOut } from "next-auth/react";

/**
 * Forces sign-out when the session carries a RefreshAccessTokenError.
 * This covers client-side navigations that skip the middleware `authorized` check.
 */
export function useSessionGuard() {
    const { data: session } = useSession();

    useEffect(() => {
        if (session?.error === "RefreshAccessTokenError") {
            signOut({ callbackUrl: "/" });
        }
    }, [session?.error]);
}
