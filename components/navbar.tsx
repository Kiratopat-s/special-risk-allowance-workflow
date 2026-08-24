"use client";

import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CircleHelp,
  User,
  LogOut,
  Settings,
  ShieldCheck,
  LayoutDashboard,
  SearchCheck,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { Skeleton } from "@/components/ui/skeleton";

export function Navbar() {
  const { data: session, status } = useSession();
  const isLoading = status === "loading";
  const { canAny, hasRole, isLoading: permissionsLoading } = usePermissions();

  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Check if user has admin access
  const hasAdminAccess =
    hasRole("super-admin") ||
    canAny([
      { resource: "ROLE", action: "LIST" },
      { resource: "ROLE", action: "MANAGE" },
      { resource: "USER", action: "MANAGE" },
      { resource: "PERMISSION", action: "LIST" },
    ]);
  const hasCollectorAccess =
    hasRole("collector") ||
    hasRole("super-admin") ||
    canAny([
      { resource: "EXPENSE_CLAIM", action: "RECHECK" },
      { resource: "MONTHLY_REQUEST", action: "MANAGE" },
    ]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="container flex h-16 max-w-7xl items-center justify-between px-4 mx-auto">
        <Link
          href={session?.user ? "/dashboard" : "/"}
          className="flex items-center space-x-2"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-primary-foreground">
              SR
            </span>
          </div>
          <span className="hidden font-semibold sm:inline-block">
            Special Risk Allowance
          </span>
        </Link>

        <nav className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="gap-2">
            <Link href="/how-to-use">
              <CircleHelp className="h-4 w-4" />
              <span>วิธีใช้</span>
            </Link>
          </Button>
          <ThemeToggle />
          {session?.user && <NotificationBell />}
          {isLoading ? (
            <Skeleton className="h-8 w-8 rounded-full" />
          ) : session?.user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-9 w-9 rounded-full"
                  aria-label="Open user menu"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage
                      src={session.user.image ?? undefined}
                      alt={session.user.name ?? "User"}
                    />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {getInitials(session.user.name)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {session.user.name}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {session.user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard" className="flex items-center">
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    <span>Dashboard</span>
                  </Link>
                </DropdownMenuItem>
                {!permissionsLoading && hasCollectorAccess ? (
                  <DropdownMenuItem asChild>
                    <Link href="/monthly-request-recheck" className="flex items-center">
                      <SearchCheck className="mr-2 h-4 w-4" />
                      <span>Collector Recheck</span>
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="flex items-center">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/profile/edit" className="flex items-center">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                {permissionsLoading ? (
                  <DropdownMenuItem disabled>
                    <Skeleton className="h-4 w-24" />
                  </DropdownMenuItem>
                ) : hasAdminAccess ? (
                  <DropdownMenuItem asChild>
                    <Link href="/admin" className="flex items-center">
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      <span>Admin</span>
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => signOut({ callbackUrl: "/" })}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              onClick={() => signIn("keycloak", { callbackUrl: "/dashboard" })}
              size="sm"
            >
              Sign In
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
