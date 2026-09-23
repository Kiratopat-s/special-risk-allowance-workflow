"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";
import {
  Avatar,
  Drawer,
  IconButton,
  Menu,
  MenuItem,
  Divider,
} from "@mui/material";
import {
  ArrowUpRight,
  CircleHelp,
  FileText,
  FolderOpen,
  LayoutGrid,
  LogOut,
  MapPin,
  Menu as MenuIcon,
  PenLine,
  ShieldCheck,
  UserRound,
  ClipboardCheck,
  X,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { Footer } from "@/components/footer";
import { OnlineUserCount } from "@/components/workflow-ui/online-user-count";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { Button } from "./button";

function Navigation({ close }: { close: () => void }) {
  const pathname = usePathname();
  const query = useSearchParams();
  const { canAny, can, hasRole, permissions } = usePermissions();
  const exactMonthly = permissions?.permissions.some(
    (p) =>
      p.resource === "MONTHLY_REQUEST" &&
      p.action === "REVIEW_HPA",
  );
  const resourceAccess = (
    resource: "OFF_SITE_WORK" | "EXPENSE_CLAIM" | "SIGNATURE",
  ) =>
    canAny(
      ["READ", "LIST", "CREATE", "UPDATE"].map((action) => ({
        resource,
        action: action as "READ" | "LIST" | "CREATE" | "UPDATE",
      })),
    );
  const links = [
    { tab: "overview", label: "ภาพรวม", icon: LayoutGrid, show: true },
    {
      tab: "expense-claims",
      label: "เอกสารเบิกค่าใช้จ่าย",
      icon: FileText,
      show: resourceAccess("EXPENSE_CLAIM"),
    },
    {
      tab: "off-site-work",
      label: "คำสั่งออกนอกสถานที่",
      icon: MapPin,
      show: resourceAccess("OFF_SITE_WORK"),
    },
    {
      tab: "monthly-requests",
      label: "รวบรวมรายเดือน",
      icon: FolderOpen,
      show:
        can("MONTHLY_REQUEST", "MANAGE") ||
        can("MONTHLY_REQUEST", "READ") ||
        can("MONTHLY_REQUEST", "LIST") ||
        exactMonthly ||
        hasRole("super-admin"),
    },
    {
      tab: "leader-queue",
      label: "ยืนยันการปฏิบัติงาน",
      icon: ClipboardCheck,
      show: true,
    },
    {
      tab: "signature",
      label: "ลายมือชื่อของฉัน",
      icon: PenLine,
      show: resourceAccess("SIGNATURE"),
    },
  ];
  const admin =
    hasRole("admin") ||
    hasRole("super-admin") ||
    canAny([
      { resource: "ROLE", action: "LIST" },
      { resource: "USER", action: "MANAGE" },
      { resource: "PERMISSION", action: "LIST" },
    ]);
  const active =
    query.get("claimId") || query.get("view")
      ? "expense-claims"
      : query.get("tab") || "overview";
  return (
    <>
      <Link href="/dashboard" className="workspace-brand" onClick={close}>
        <span className="brand-mark">s.</span>
        <span>
          SRAW<small>Special Risk Allowance</small>
        </span>
      </Link>
      <p className="nav-caption">WORKSPACE</p>
      <nav aria-label="เมนูพื้นที่ทำงาน" className="workspace-nav">
        {links
          .filter((link) => link.show)
          .map(({ tab, label, icon: Icon }) => (
            <Link
              key={tab}
              href={`/dashboard?tab=${tab}`}
              onClick={close}
              aria-current={
                pathname === "/dashboard" && active === tab ? "page" : undefined
              }
            >
              <Icon size={18} />
              <span>{label}</span>
            </Link>
          ))}
      </nav>
      <div className="workspace-nav-bottom">
        <p className="nav-caption">ACCOUNT & SUPPORT</p>
        <nav aria-label="บัญชีและความช่วยเหลือ" className="workspace-nav">
          <Link
            href="/profile"
            onClick={close}
            aria-current={pathname.startsWith("/profile") ? "page" : undefined}
          >
            <UserRound size={18} />
            ข้อมูลส่วนตัว
          </Link>
          {admin && (
            <Link
              href="/admin"
              onClick={close}
              aria-current={pathname.startsWith("/admin") ? "page" : undefined}
            >
              <ShieldCheck size={18} />
              จัดการระบบ
            </Link>
          )}
          <Link href="/how-to-use" onClick={close}>
            <CircleHelp size={18} />
            คู่มือการใช้งาน
            <ArrowUpRight size={14} className="ml-auto" />
          </Link>
        </nav>
        <OnlineUserCount />
        <div className="sidebar-note">
          <span className="inline-block size-1.5 rounded-full bg-emerald-400 mr-2" />
          Special Risk Allowance Workflow
          <br />
          <span className="text-white/40">การไฟฟ้าส่วนภูมิภาค</span>
        </div>
      </div>
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const isPrint = /\/print\/?$/.test(pathname);
  const workspace = ["/dashboard", "/admin", "/profile", "/notifications"].some(
    (path) => pathname.startsWith(path),
  );
  if (isPrint) return <>{children}</>;
  const title = pathname.startsWith("/admin")
    ? "จัดการระบบ"
    : pathname.startsWith("/profile")
      ? "บัญชีของฉัน"
      : "พื้นที่ทำงาน";
  return (
    <div className={workspace ? "app-workspace" : "app-public"}>
      <a href="#main" className="skip-link">
        ข้ามไปยังเนื้อหา
      </a>
      {workspace && (
        <aside className="desktop-sidebar">
          <Suspense>
            <Navigation close={() => setMobileOpen(false)} />
          </Suspense>
        </aside>
      )}
      <Drawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        slotProps={{ paper: { className: "mobile-sidebar" } }}
      >
        <IconButton
          aria-label="ปิดเมนู"
          onClick={() => setMobileOpen(false)}
          sx={{ color: "white", position: "absolute", top: 8, right: 8 }}
        >
          <X size={20} />
        </IconButton>
        <Suspense>
          <Navigation close={() => setMobileOpen(false)} />
        </Suspense>
      </Drawer>
      <div className="workspace-body">
        <header className="workspace-header">
          <div className="flex min-w-0 items-center gap-3">
            {workspace ? (
              <>
                <IconButton
                  className="mobile-menu-button"
                  aria-label="เปิดเมนู"
                  onClick={() => setMobileOpen(true)}
                >
                  <MenuIcon size={20} />
                </IconButton>
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  SRAW <span className="mx-3 opacity-40">/</span>
                </span>
                <span className="text-sm font-semibold whitespace-nowrap">
                  {title}
                </span>
              </>
            ) : (
              <Link
                href="/"
                className="flex items-center gap-3 font-bold tracking-tight"
              >
                <span className="brand-mark">s.</span>SRAW
              </Link>
            )}
            {process.env.NEXT_PUBLIC_APP_ENV &&
              process.env.NEXT_PUBLIC_APP_ENV !== "production" && (
                <span className="hidden sm:inline rounded border px-1.5 text-[10px] uppercase text-muted-foreground">
                  {process.env.NEXT_PUBLIC_APP_ENV}
                </span>
              )}
          </div>
          <div className="flex items-center gap-2">
            {!workspace && (
              <Link
                className="hidden sm:inline text-sm mr-3"
                href="/how-to-use"
              >
                วิธีใช้งาน
              </Link>
            )}
            <ThemeToggle />
            {session?.user && <NotificationBell />}
            {session?.user ? (
              <>
                <span className="h-6 border-l mx-1" />
                <IconButton
                  aria-label="เมนูบัญชี"
                  aria-controls={anchor ? "account-menu" : undefined}
                  aria-expanded={!!anchor}
                  onClick={(event) => setAnchor(event.currentTarget)}
                >
                  <Avatar
                    src={session.user.image || undefined}
                    sx={{
                      width: 34,
                      height: 34,
                      bgcolor: "#f5e7df",
                      color: "#934631",
                      fontSize: 13,
                    }}
                  >
                    {(session.user.name || "U").slice(0, 2)}
                  </Avatar>
                </IconButton>
              </>
            ) : (
              status !== "loading" && (
                <Button
                  size="sm"
                  onClick={() =>
                    signIn("keycloak", { callbackUrl: "/dashboard" })
                  }
                >
                  เข้าสู่ระบบ
                </Button>
              )
            )}
          </div>
        </header>
        <Menu
          id="account-menu"
          anchorEl={anchor}
          open={!!anchor}
          onClose={() => setAnchor(null)}
        >
          <div className="px-4 py-3 max-w-72 break-words">
            <p className="font-semibold text-sm">{session?.user?.name}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {session?.user?.email}
            </p>
          </div>
          <Divider />
          <MenuItem
            component={Link}
            href="/dashboard"
            onClick={() => setAnchor(null)}
          >
            ภาพรวม
          </MenuItem>
          <MenuItem
            component={Link}
            href="/profile"
            onClick={() => setAnchor(null)}
          >
            ข้อมูลส่วนตัว
          </MenuItem>
          <MenuItem
            component={Link}
            href="/profile/edit"
            onClick={() => setAnchor(null)}
          >
            แก้ไขข้อมูล
          </MenuItem>
          <Divider />
          <MenuItem
            onClick={() => {
              setAnchor(null);
              void signOut({ callbackUrl: "/" });
            }}
          >
            <LogOut size={16} className="mr-3" />
            ออกจากระบบ
          </MenuItem>
        </Menu>
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 outline-none">
          {children}
        </main>
        <Footer />
      </div>
    </div>
  );
}
