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

import { useState } from "react";
import { Bell, BellRing, Check, CheckCheck, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NotificationListSkeleton } from "@/components/ui/skeleton";
import { useNotifications } from "@/lib/hooks/use-notifications";
import { usePushSubscription } from "@/lib/hooks/use-push-subscription";
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
  const {
    notifications,
    unreadCount,
    isLoading,
    markRead,
    markAllRead,
    clearOne,
    clearAllRead,
  } = useNotifications();
  const {
    permission,
    isLoading: isPushLoading,
    subscribe,
  } = usePushSubscription();

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const badgeCount = Math.min(unreadCount, 99);
  const readCount = notifications.filter((n) => n.isRead).length;

  return (
    <>
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
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
          {/* Push permission prompt — shown only when permission is "default" */}
          {permission === "default" && (
            <>
              <div className="flex items-center gap-2.5 px-3 py-2.5">
                <BellRing className="h-4 w-4 shrink-0 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">เปิดการแจ้งเตือน Push</p>
                  <p className="text-[11px] text-muted-foreground">
                    รับการแจ้งเตือนแม้ไม่ได้เปิดเว็บ
                  </p>
                </div>
                <LoadingButton
                  size="sm"
                  className="h-7 px-2.5 text-xs shrink-0"
                  isLoading={isPushLoading}
                  loadingText="เปิด"
                  onClick={async () => {
                    const result = await subscribe();
                    if (result.ok) {
                      toast.success("เปิดการแจ้งเตือน Push สำเร็จ");
                    } else if (result.reason === "push_blocked") {
                      toast.error("เบราว์เซอร์บล็อก Push Notification", {
                        description:
                          "ถ้าใช้ Brave ให้เปิด Settings → Privacy → Use Google services for push messaging",
                      });
                    } else if (result.reason === "denied") {
                      toast.error("คุณปิดสิทธิ์การแจ้งเตือนแล้ว", {
                        description:
                          "เปลี่ยนได้ที่การตั้งค่าเบราว์เซอร์ → Site Settings → Notifications",
                      });
                    }
                  }}
                >
                  เปิด
                </LoadingButton>
              </div>
              <DropdownMenuSeparator />
            </>
          )}
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
            <div className="flex items-center gap-1">
              {readCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    setDropdownOpen(false);
                    requestAnimationFrame(() => setShowClearConfirm(true));
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                  ล้างที่อ่านแล้ว
                </Button>
              )}
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
          </div>

          <DropdownMenuSeparator />

          {/* Notification list */}
          <ScrollArea className="max-h-80">
            {isLoading ? (
              <NotificationListSkeleton />
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
                      "group relative flex flex-col items-start gap-0.5 px-3 py-2.5 cursor-pointer pr-8",
                      !n.isRead && "bg-accent/40",
                    )}
                    onClick={() => {
                      if (!n.isRead) void markRead(n.id);
                      if (n.link) window.location.href = n.link;
                    }}
                  >
                    <button
                      className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-sm opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        void clearOne(n.id);
                      }}
                      aria-label="ลบการแจ้งเตือน"
                    >
                      <X className="h-3 w-3" />
                    </button>
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
      <ConfirmDialog
        open={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        title="ล้างการแจ้งเตือนที่อ่านแล้ว"
        description={`จะลบ ${readCount} รายการที่อ่านแล้วออก`}
        confirmLabel="ล้างทั้งหมด"
        cancelLabel="ยกเลิก"
        onConfirm={() => {
          void clearAllRead().then((result) => {
            setShowClearConfirm(false);
            if (result?.success)
              toast.success(`ล้าง ${result.data} รายการแล้ว`);
          });
        }}
      />
    </>
  );
}
