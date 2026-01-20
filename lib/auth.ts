import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";
import type { NextAuthConfig } from "next-auth";
import type { JWT } from "@auth/core/jwt";

// Extend the default session and JWT types
declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            name?: string | null;
            email?: string | null;
            image?: string | null;
            keycloakId?: string;
        };
        accessToken?: string;
        error?: string;
    }
}

declare module "@auth/core/jwt" {
    interface JWT {
        accessToken?: string;
        refreshToken?: string;
        expiresAt?: number;
        error?: string;
        keycloakId?: string;
    }
}

const config: NextAuthConfig = {
    providers: [
        Keycloak({
            clientId: process.env.KEYCLOAK_CLIENT_ID!,
            clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
            issuer: process.env.KEYCLOAK_ISSUER,
        }),
    ],
    pages: {
        signIn: "/auth/signin",
    },
    callbacks: {
        async jwt({ token, account, profile }) {
            // Initial sign in
            if (account && profile) {
                token.accessToken = account.access_token;
                token.refreshToken = account.refresh_token;
                token.expiresAt = account.expires_at;
                token.keycloakId = profile.sub ?? undefined;
            }

            // Return previous token if the access token has not expired yet
            const expiresAt = token.expiresAt as number | undefined;
            if (expiresAt && Date.now() < expiresAt * 1000) {
                return token;
            }

            // Access token has expired, try to refresh it
            const refreshToken = token.refreshToken as string | undefined;
            if (refreshToken) {
                try {
                    const response = await fetch(
                        `${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/token`,
                        {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/x-www-form-urlencoded",
                            },
                            body: new URLSearchParams({
                                client_id: process.env.KEYCLOAK_CLIENT_ID!,
                                client_secret: process.env.KEYCLOAK_CLIENT_SECRET!,
                                grant_type: "refresh_token",
                                refresh_token: refreshToken,
                            }),
                        }
                    );

                    const tokens = await response.json();

                    if (!response.ok) throw tokens;

                    token.accessToken = tokens.access_token;
                    token.refreshToken = tokens.refresh_token ?? token.refreshToken;
                    token.expiresAt = Math.floor(Date.now() / 1000 + tokens.expires_in);
                } catch (error) {
                    console.error("Error refreshing access token", error);
                    token.error = "RefreshAccessTokenError";
                }
            }

            return token;
        },
        async session({ session, token }) {
            return {
                ...session,
                user: {
                    ...session.user,
                    id: token.sub!,
                    keycloakId: token.keycloakId,
                },
                accessToken: token.accessToken,
                error: token.error,
            };
        },
        async authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const isOnProfile = nextUrl.pathname.startsWith("/profile");

            if (isOnProfile) {
                if (isLoggedIn) return true;
                return false; // Redirect unauthenticated users to login page
            }

            return true;
        },
    },
    session: {
        strategy: "jwt",
    },
    trustHost: true,
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);
