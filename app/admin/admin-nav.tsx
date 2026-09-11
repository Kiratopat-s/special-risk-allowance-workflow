"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, Users, Key, Building2, Bell } from "lucide-react";
import { Tabs, Tab } from "@mui/material";
import { usePermissions } from "@/lib/hooks/use-permissions";

const navItems = [
  { href: "/admin/roles", label: "บทบาท", icon: Shield },
  { href: "/admin/users", label: "ผู้ใช้งาน", icon: Users },
  { href: "/admin/departments", label: "หน่วยงาน", icon: Building2 },
  { href: "/admin/permissions", label: "สิทธิ์การใช้งาน", icon: Key },
  { href: "/admin/notifications", label: "การแจ้งเตือน", icon: Bell },
];

export function AdminNav() {
  const pathname = usePathname();

  const { can, hasRole } = usePermissions();
  const resources = ["ROLE", "USER", "DEPARTMENT", "PERMISSION"] as const;
  const visible = navItems.filter((_, index) => hasRole("super-admin") || (index < resources.length && (can(resources[index], "LIST") || can(resources[index], "MANAGE"))));
  const active = visible.find(item => pathname.startsWith(item.href))?.href || false;
  return <Tabs value={active} variant="scrollable" scrollButtons="auto" aria-label="ส่วนจัดการระบบ" className="border-b mb-6">{visible.map(item => <Tab component={Link} href={item.href} value={item.href} key={item.href} label={item.label} icon={<item.icon size={16} />} iconPosition="start" sx={{ minHeight: 52, textTransform: "none" }} />)}</Tabs>;
}
