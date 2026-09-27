"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/workflow-ui/button";

export function CopyIdentifier({ value, label, short = false }: {
  value: string; label: string; short?: boolean;
}) {
  const displayed = short && value.length > 20 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`คัดลอก${label}แล้ว`);
    } catch {
      toast.error(`คัดลอก${label}ไม่สำเร็จ`, { description: "เปิดรายละเอียดเพื่อเลือกรหัสและคัดลอกด้วยตนเอง" });
    }
  }
  return <div className="flex min-w-0 items-center gap-1">
    <span className="min-w-0 break-all font-mono text-xs text-muted-foreground" title={value}>{displayed}</span>
    <Button variant="ghost" className="h-11 min-h-11 min-w-11 px-2" aria-label={`คัดลอก${label}`} title={`คัดลอก${label}`} onClick={() => void copy()}>
      <Copy aria-hidden="true" />
    </Button>
  </div>;
}
