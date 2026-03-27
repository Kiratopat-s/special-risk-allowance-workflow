"use client";

/**
 * NotificationBell
 *
 * Renders a bell icon button in the navbar.
 * - Unread badge shows count (capped at 99+)
 * - Opens a dropdown panel with recent notifications
 * - SSE-backed real-time updates via useNotifications hook
 *
 * @module components/notification-bell
 */

import { Bell, Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications } from "@/lib/hooks/use-notifications";
import { cn } from "@/lib/utils";

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "เมื่อกี้";
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} วันที่แล้ว`;
  return new Date(date).toLocaleDateString("th-TH");
}

export function NotificationBell() {
  const { notifications, unreadCount, isLoading, markRead, markAllRead } =
    useNotifications();

  const badgeCount = Math.min(unreadCount, 99);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
          aria-label={`การแจ้งเตือน${
            unreadCount > 0 ? ` (${unreadCount} ยังไม่ได้อ่าน)` : ""
          }`}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground leading-none">
              {badgeCount === 99 ? "99+" : badgeCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-80"
        align="end"
        sideOffset={8}
        forceMount
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2">
          <DropdownMenuLabel className="p-0 text-sm font-semibold">
            การแจ้งเตือน
            {unreadCount > 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                ({unreadCount} ยังไม่อ่าน)
              </span>
            )}
          </DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => markAllRead()}
            >
              <CheckCheck className="h-3 w-3" />
              อ่านทั้งหมด
            </Button>
          )}
        </div>

        <DropdownMenuSeparator />

        {/* Notification list */}
        <ScrollArea className="max-h-80">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              กำลังโหลด...
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Bell className="h-8 w-8 opacity-30" />
              <span>ไม่มีการแจ้งเตือน</span>
            </div>
          ) : (
            <div className="py-1">
              {notifications.map((n) => (
                <DropdownMenuItem
                  key={n.id}
                  className={cn(
                    "flex flex-col items-start gap-0.5 px-3 py-2.5 cursor-pointer",
                    !n.isRead && "bg-accent/40",
                  )}
                  onClick={() => {
                    if (!n.isRead) void markRead(n.id);
                    if (n.link) window.location.href = n.link;
                  }}
                >
                  <div className="flex w-full items-start justify-between gap-2">
                    <span
                      className={cn(
                        "text-sm leading-snug",
                        !n.isRead && "font-medium",
                      )}
                    >
                      {n.title}
                    </span>
                    {!n.isRead && (
                      <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                  {n.body && (
                    <span className="text-xs text-muted-foreground line-clamp-2">
                      {n.body}
                    </span>
                  )}
                  <div className="flex w-full items-center justify-between mt-0.5">
                    <span className="text-[11px] text-muted-foreground">
                      {formatRelativeTime(n.createdAt)}
                    </span>
                    {n.isRead && (
                      <Check className="h-3 w-3 text-muted-foreground/50" />
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
