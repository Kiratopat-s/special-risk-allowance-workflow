"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  checkDeploymentVersion,
  getServerDeploymentSnapshot,
  isDeploymentOutdated,
  subscribeToDeployment,
} from "@/lib/deployment/client";

export function DeploymentNotice() {
  useEffect(() => {
    const check = () => {
      if (document.visibilityState === "visible") void checkDeploymentVersion();
    };
    check();
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    const interval = window.setInterval(check, 60_000);
    return () => {
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
      window.clearInterval(interval);
    };
  }, []);

  return <DeploymentAlert />;
}

/** Also rendered inside dialogs so their focus traps do not hide the refresh control. */
export function DeploymentAlert() {
  const outdated = useSyncExternalStore(
    subscribeToDeployment, isDeploymentOutdated, getServerDeploymentSnapshot
  );

  if (!outdated) return null;

  return (
    <aside role="alert" className="sticky top-0 z-40 flex shrink-0 flex-wrap items-center justify-center gap-3 border-b border-amber-300 bg-amber-50 px-5 py-3 pr-14 text-sm text-amber-950">
      <div>
        <p className="font-semibold">มีระบบเวอร์ชันใหม่ กรุณารีเฟรชก่อนทำรายการต่อ</p>
        <p>ข้อมูลที่ยังไม่ได้บันทึกยังอยู่ในหน้านี้ กรุณาคัดลอกเก็บไว้ก่อนรีเฟรช ระบบจะไม่ส่งรายการซ้ำอัตโนมัติ</p>
      </div>
      <Button type="button" onClick={() => window.location.reload()}>รีเฟรชหน้า</Button>
    </aside>
  );
}
