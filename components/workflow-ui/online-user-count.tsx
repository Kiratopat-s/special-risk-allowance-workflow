"use client";

import { usePresence } from "@/components/presence-provider";

const countFormatter = new Intl.NumberFormat("th-TH");

export function OnlineUserCount() {
  const { count, status } = usePresence();
  if (status === "disabled") return null;

  const description = status === "loading"
    ? "กำลังโหลดจำนวนผู้ใช้"
    : status === "unavailable"
      ? "อัปเดตไม่ได้ชั่วคราว"
      : status === "stale"
        ? "ข้อมูลล่าสุด · กำลังเชื่อมต่อใหม่"
        : "ใช้งานใน 3 นาทีล่าสุด";

  return (
    <div className="sidebar-presence" data-status={status}>
      <div className="sidebar-presence-value" role="status" aria-atomic="true">
        <span className="sidebar-presence-dot" aria-hidden="true" />
        <span>ออนไลน์</span>
        <span className="sidebar-presence-count">
          {count === null ? "—" : `${countFormatter.format(count)} คน`}
        </span>
        <span className="sr-only">{description}</span>
      </div>
      <p className="sidebar-presence-description" aria-hidden="true">{description}</p>
    </div>
  );
}
