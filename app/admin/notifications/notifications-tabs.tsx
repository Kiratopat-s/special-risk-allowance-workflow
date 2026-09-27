"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Tab, Tabs } from "@mui/material";

export function NotificationsAdminTabs({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <Tabs
        value="compose"
        aria-label="การจัดการแจ้งเตือน"
        variant="scrollable"
        scrollButtons="auto"
      >
        <Tab value="compose" id="notification-tab-compose" aria-controls="notification-panel-compose" label="ส่งการแจ้งเตือน" />
        <Tab component={Link} href="/admin/email-worker" value="email" label="ประวัติอีเมล / Email Worker" />
      </Tabs>
      <div role="tabpanel" id="notification-panel-compose" aria-labelledby="notification-tab-compose">
        {children}
      </div>
    </div>
  );
}
