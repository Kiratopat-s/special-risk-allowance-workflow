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
import {
  Mail,
  User,
  Key,
  Edit,
  Shield,
  Building2,
  Briefcase,
  Phone,
  IdCard,
} from "lucide-react";

// Helper component for info rows
function InfoRow({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background border border-border">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p
          className={`font-medium ${mono ? "font-mono text-sm break-all" : ""}`}
        >
          {value ?? "Not provided"}
        </p>
      </div>
    </div>
  );
}

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
              {user.positionShort && (
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
                  {user.positionShort}
                </span>
              )}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <Separator />

            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Personal Information
              </h3>

              <InfoRow icon={User} label="Full Name" value={user.name} />
              <InfoRow icon={Mail} label="Email Address" value={user.email} />
              <InfoRow icon={Mail} label="PEA Email" value={user.peaEmail} />
              <InfoRow
                icon={IdCard}
                label="Employee ID"
                value={user.employeeId}
              />
              <InfoRow
                icon={Phone}
                label="Phone Number"
                value={user.phoneNumber}
              />
            </div>

            <Separator />

            {/* Work Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Work Information
              </h3>

              <InfoRow
                icon={Briefcase}
                label="Position"
                value={
                  user.position
                    ? `${user.position}${
                        user.positionShort ? ` (${user.positionShort})` : ""
                      }`
                    : null
                }
              />
              <InfoRow
                icon={Briefcase}
                label="Position Level"
                value={user.positionLevel}
              />
              <InfoRow
                icon={Building2}
                label="Department"
                value={
                  user.department
                    ? `${user.department}${
                        user.departmentShort ? ` (${user.departmentShort})` : ""
                      }`
                    : null
                }
              />
            </div>

            <Separator />

            {/* System Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                System Information
              </h3>

              <InfoRow
                icon={Key}
                label="Keycloak User ID"
                value={user.keycloakId ?? user.id}
                mono
              />
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
