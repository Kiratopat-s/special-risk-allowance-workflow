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
        async jwt({ token, account, profile, trigger, session }) {
            // Handle session update (when user updates their profile)
            if (trigger === "update" && session?.user) {
                // Update token with new user data from the session update
                token.firstName = session.user.firstName ?? token.firstName;
                token.lastName = session.user.lastName ?? token.lastName;
                token.email = session.user.email ?? token.email;
                token.peaEmail = session.user.peaEmail ?? token.peaEmail;
                token.phoneNumber = session.user.phoneNumber ?? token.phoneNumber;
                token.position = session.user.position ?? token.position;
                token.positionShort = session.user.positionShort ?? token.positionShort;
                token.positionLevel = session.user.positionLevel ?? token.positionLevel;
                token.department = session.user.department ?? token.department;
                token.departmentShort = session.user.departmentShort ?? token.departmentShort;
                return token;
            }

            // Initial sign in
            if (account && profile) {
                token.accessToken = account.access_token;
                token.refreshToken = account.refresh_token;
                token.expiresAt = account.expires_at;
                token.keycloakId = profile.sub ?? undefined;
                // Standard Keycloak claims
                token.email = profile.email as string | undefined;
                token.firstName = profile.given_name as string | undefined;
                token.lastName = profile.family_name as string | undefined;
                // Custom Keycloak claims
                token.peaEmail = profile.pea_email as string | undefined;
                token.position = profile.position as string | undefined;
                token.positionShort = profile.position_short as string | undefined;
                token.positionLevel = profile.position_level as string | undefined;
                token.department = profile.department as string | undefined;
                token.departmentShort = profile.department_short as string | undefined;
                token.phoneNumber = profile.phone as string | undefined;
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
                    email: token.email,
                    firstName: token.firstName,
                    lastName: token.lastName,
                    peaEmail: token.peaEmail,
                    position: token.position,
                    positionShort: token.positionShort,
                    positionLevel: token.positionLevel,
                    department: token.department,
                    departmentShort: token.departmentShort,
                    phoneNumber: token.phoneNumber,
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
