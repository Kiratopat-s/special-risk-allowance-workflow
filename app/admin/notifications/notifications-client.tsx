"use client";

/**
 * NotificationsAdminClient
 *
 * Admin page for broadcasting system announcements to selected users (or all users).
 *
 * @module app/admin/notifications
 */

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Bell, Loader2, Send, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { sendSystemNotification } from "@/app/actions/notifications";

interface UserRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  position?: string | null;
  departmentName?: string | null;
}

interface Props {
  users: UserRow[];
}

export function NotificationsAdminClient({ users }: Props) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const isAllSelected = selectedIds.size === users.length;

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.firstName.toLowerCase().includes(q) ||
      u.lastName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  const toggleUser = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(users.map((u) => u.id)));
    }
  };

  const handleSend = () => {
    if (!title.trim()) {
      toast.error("กรุณากรอกหัวข้อการแจ้งเตือน");
      return;
    }
    if (!body.trim()) {
      toast.error("กรุณากรอกเนื้อหาการแจ้งเตือน");
      return;
    }
    if (selectedIds.size === 0) {
      toast.error("กรุณาเลือกผู้รับอย่างน้อย 1 คน");
      return;
    }

    startTransition(async () => {
      const result = await sendSystemNotification(
        Array.from(selectedIds),
        title.trim(),
        body.trim(),
        link.trim() || undefined,
      );

      if (!result.success) {
        toast.error("ไม่สามารถส่งการแจ้งเตือนได้", {
          description: result.error,
        });
        return;
      }

      toast.success(`ส่งการแจ้งเตือนให้ ${selectedIds.size} คนสำเร็จแล้ว`);
      setTitle("");
      setBody("");
      setLink("");
      setSelectedIds(new Set());
    });
  };

  return (
    <div className="container max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Page title */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Bell className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">ส่งการแจ้งเตือนระบบ</h1>
          <p className="text-sm text-muted-foreground">
            Broadcast a system announcement to selected users
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Left: Compose */}
        <div className="space-y-4 rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-medium text-foreground">เขียนข้อความ</h2>

          <div className="space-y-1.5">
            <Label htmlFor="notif-title">หัวข้อ *</Label>
            <Input
              id="notif-title"
              placeholder="เช่น ประกาศระบบหยุดให้บริการชั่วคราว"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
            <p className="text-xs text-muted-foreground text-right">
              {title.length}/100
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notif-body">เนื้อหา *</Label>
            <Textarea
              id="notif-body"
              placeholder="รายละเอียดของการแจ้งเตือน..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              maxLength={300}
            />
            <p className="text-xs text-muted-foreground text-right">
              {body.length}/300
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notif-link">ลิงก์ (ไม่บังคับ)</Label>
            <Input
              id="notif-link"
              placeholder="/monthly-request-collection"
              value={link}
              onChange={(e) => setLink(e.target.value)}
            />
          </div>

          <Button
            className="w-full gap-2"
            onClick={handleSend}
            disabled={
              isPending ||
              !title.trim() ||
              !body.trim() ||
              selectedIds.size === 0
            }
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            ส่งการแจ้งเตือน {selectedIds.size > 0 && `(${selectedIds.size} คน)`}
          </Button>
        </div>

        {/* Right: User picker */}
        <div className="space-y-3 rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">เลือกผู้รับ</h2>
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <Badge variant="secondary">{selectedIds.size} คน</Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={toggleAll}
              >
                <Users className="mr-1 h-3 w-3" />
                {isAllSelected ? "ยกเลิกทั้งหมด" : "เลือกทั้งหมด"}
              </Button>
            </div>
          </div>

          <Input
            placeholder="ค้นหาชื่อ หรืออีเมล..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <ScrollArea className="h-72">
            <div className="space-y-1 pr-1">
              {filtered.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  ไม่พบผู้ใช้
                </p>
              ) : (
                filtered.map((u) => {
                  const isSelected = selectedIds.has(u.id);
                  return (
                    <button
                      key={u.id}
                      onClick={() => toggleUser(u.id)}
                      className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                        isSelected
                          ? "bg-primary/10 text-foreground"
                          : "hover:bg-accent"
                      }`}
                    >
                      {/* Checkbox indicator */}
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border"
                        }`}
                      >
                        {isSelected && <X className="h-2.5 w-2.5 stroke-[3]" />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="font-medium">
                          {u.firstName} {u.lastName}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {u.email}
                          {u.departmentName ? ` · ${u.departmentName}` : ""}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
