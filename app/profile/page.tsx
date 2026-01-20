import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { UserAvatar } from "@/components/user-avatar";
import { Mail, User, Key, Edit, Shield } from "lucide-react";

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  const { user } = session;

  return (
    <div className="container max-w-7xl mx-auto px-4 py-12">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
          <p className="text-muted-foreground">
            View and manage your account information
          </p>
        </div>

        {/* Profile Card */}
        <Card className="overflow-hidden">
          {/* Card Header with Avatar */}
          <div className="relative">
            {/* Background Pattern */}
            <div className="h-32 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />

            {/* Avatar - Positioned to overlap */}
            <div className="absolute -bottom-12 left-8">
              <div className="rounded-full border-4 border-background bg-background">
                <UserAvatar name={user.name} image={user.image} size="xl" />
              </div>
            </div>

            {/* Edit Button */}
            <div className="absolute top-4 right-4">
              <Button asChild variant="secondary" size="sm">
                <Link href="/profile/edit">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Profile
                </Link>
              </Button>
            </div>
          </div>

          <CardHeader className="pt-16">
            <CardTitle className="text-2xl">{user.name ?? "User"}</CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Authenticated via Keycloak SSO
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <Separator />

            {/* User Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Account Information
              </h3>

              {/* Email */}
              <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background border border-border">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    Email Address
                  </p>
                  <p className="font-medium">{user.email ?? "Not provided"}</p>
                </div>
              </div>

              {/* Full Name */}
              <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background border border-border">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    Full Name
                  </p>
                  <p className="font-medium">{user.name ?? "Not provided"}</p>
                </div>
              </div>

              {/* Keycloak ID */}
              <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background border border-border">
                  <Key className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    Keycloak User ID
                  </p>
                  <p className="font-mono text-sm break-all">
                    {user.keycloakId ?? user.id ?? "Not available"}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild className="flex-1">
                <Link href="/profile/edit">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Profile
                </Link>
              </Button>
              <Button variant="outline" asChild className="flex-1">
                <Link href="/">Back to Home</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Session Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Session Information</CardTitle>
            <CardDescription>
              Details about your current authentication session
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">Session Status</span>
                <span className="font-medium text-green-600 dark:text-green-400">
                  Active
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">Provider</span>
                <span className="font-medium">Keycloak</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Token Status</span>
                <span className="font-medium">
                  {session.error ? (
                    <span className="text-destructive">{session.error}</span>
                  ) : (
                    <span className="text-green-600 dark:text-green-400">
                      Valid
                    </span>
                  )}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
