"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  FileText,
  FolderOpen,
  Loader2,
  MapPin,
  PenLine,
} from "lucide-react";

import { cn } from "@/lib/utils";

type DashboardTabId =
  | "off-site-work"
  | "expense-claims"
  | "monthly-requests"
  | "leader-queue"
  | "signature";

interface DashboardTabLink {
  id: DashboardTabId;
  label: string;
  description: string;
  href: string;
}

interface DashboardTabNavProps {
  tabs: DashboardTabLink[];
  activeTab: DashboardTabId;
}

const TAB_ICONS = {
  "off-site-work": MapPin,
  "expense-claims": FileText,
  "monthly-requests": FolderOpen,
  "leader-queue": ClipboardList,
  signature: PenLine,
} satisfies Record<DashboardTabId, typeof MapPin>;

export function DashboardTabNav({ tabs, activeTab }: DashboardTabNavProps) {
  const [pendingTab, setPendingTab] = useState<DashboardTabId | null>(null);
  const displayedPendingTab = pendingTab === activeTab ? null : pendingTab;

  return (
    <nav
      aria-label="Dashboard tabs"
      aria-busy={displayedPendingTab ? "true" : undefined}
      className="overflow-x-auto border-b border-border"
    >
      <div className="flex min-w-max gap-1">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          const isPending = tab.id === displayedPendingTab;
          const Icon = TAB_ICONS[tab.id];

          return (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              onClick={() => {
                if (!isActive) setPendingTab(tab.id);
              }}
              className={cn(
                "-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                isPending && "text-foreground",
              )}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Icon className="h-4 w-4" />
              )}
              <span>{tab.label}</span>
              <span className="sr-only">{tab.description}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
