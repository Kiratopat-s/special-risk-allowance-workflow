"use client";

import { useState } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { refreshVerificationToken } from "@/app/actions/leader-verify";
import { Button } from "@/components/ui/button";

export interface LeaderVerificationItem {
  id: string;
  revisionNo: number;
  offSiteWorkId: string;
  leaderUserId: string | null;
  leaderEmail: string | null;
  expiresAt: Date;
  confirmedAt: Date | null;
  status: "PENDING" | "CONFIRMED" | "SUPERSEDED";
}

export function LeaderVerificationSection({
  verifications,
}: {
  verifications: LeaderVerificationItem[];
  claimId: string;
}) {
  const [refreshing, setRefreshing] = useState<string | null>(null);

  if (verifications.length === 0) return null;

  const refresh = async (id: string) => {
    setRefreshing(id);
    const result = await refreshVerificationToken(id);
    setRefreshing(null);
    if (result.success) {
      toast.success("ส่งลิงก์ใหม่ให้หัวหน้าชุดแล้ว");
    } else {
      toast.error(result.error);
    }
  };

  return (
    <section className="space-y-2">
      <h4 className="flex items-center gap-2 text-sm font-semibold">
        <ShieldCheck className="h-4 w-4" />
        การยืนยันจากหัวหน้าชุด
      </h4>
      <div className="space-y-2">
        {verifications.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm">
            <div>
              <p className="font-medium">{item.offSiteWorkId}</p>
              <p className="text-xs text-muted-foreground">
                Revision {item.revisionNo}
                {item.leaderEmail ? ` · ${item.leaderEmail}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={
                  item.status === "CONFIRMED"
                    ? "text-emerald-700"
                    : item.status === "SUPERSEDED"
                      ? "text-muted-foreground"
                      : "text-amber-700"
                }
              >
                {item.status === "CONFIRMED"
                  ? `ยืนยันแล้ว ${item.confirmedAt ? new Date(item.confirmedAt).toLocaleDateString("th-TH") : ""}`
                  : item.status === "SUPERSEDED"
                    ? "ยกเลิกจาก revision ใหม่"
                    : "รอยืนยัน"}
              </span>
              {item.status === "PENDING" && !item.leaderUserId && item.leaderEmail ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={refreshing === item.id}
                  onClick={() => void refresh(item.id)}
                >
                  <RefreshCw className={refreshing === item.id ? "mr-1 h-3.5 w-3.5 animate-spin" : "mr-1 h-3.5 w-3.5"} />
                  ส่งลิงก์ใหม่
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
