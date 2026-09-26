"use client";

import { useState, type ReactNode } from "react";
import { Tab, Tabs } from "@mui/material";
import { EmailHistoryClient } from "./email-history-client";

export function NotificationsAdminTabs({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState("compose");

  return (
    <div className="space-y-6">
      <Tabs
        value={tab}
        onChange={(_event, value: string) => setTab(value)}
        aria-label="การจัดการแจ้งเตือน"
        variant="scrollable"
        scrollButtons="auto"
      >
        <Tab value="compose" id="notification-tab-compose" aria-controls="notification-panel-compose" label="ส่งการแจ้งเตือน" />
        <Tab value="email" id="notification-tab-email" aria-controls="notification-panel-email" label="ประวัติอีเมล" />
      </Tabs>
      <div role="tabpanel" id="notification-panel-compose" aria-labelledby="notification-tab-compose" hidden={tab !== "compose"}>
        {children}
      </div>
      <div role="tabpanel" id="notification-panel-email" aria-labelledby="notification-tab-email" hidden={tab !== "email"}>
        {tab === "email" && <EmailHistoryClient />}
      </div>
    </div>
  );
}
