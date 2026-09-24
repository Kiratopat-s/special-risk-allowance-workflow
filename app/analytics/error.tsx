"use client";

import { Button } from "@mui/material";

export default function AnalyticsError({ reset }: { reset: () => void }) {
  return <div className="workspace-content"><div className="document-panel p-8" role="alert">
    <h1 className="text-xl font-bold">โหลดรายงานไม่สำเร็จ</h1>
    <p className="my-4 text-sm text-muted-foreground">ไม่สามารถเชื่อมต่อข้อมูลได้ในขณะนี้ กรุณาลองโหลดอีกครั้ง</p>
    <Button variant="outlined" onClick={reset}>ลองอีกครั้ง</Button>
  </div></div>;
}
