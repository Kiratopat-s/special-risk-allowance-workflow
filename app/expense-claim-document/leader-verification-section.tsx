"use client";

/**
 * LeaderVerificationSection
 *
 * Shows all leader-verification records attached to an expense claim document.
 * Allows copy-to-clipboard and token refresh for external-leader links.
 *
 * @module app/expense-claim-document/leader-verification-section
 */

import { useState } from "react";
import { toast } from "sonner";
import { Copy, RefreshCw, ShieldCheck } from "lucide-react";
import { refreshVerificationToken } from "@/app/actions/leader-verify";

export interface LeaderVerificationItem {
  id: string;
  offSiteWorkId: string;
  leaderUserId: string | null;
  leaderEmail: string | null;
  token: string;
  expiresAt: Date;
  verifiedAt: Date | null;
}

interface LeaderVerificationSectionProps {
  verifications: LeaderVerificationItem[];
  claimId: string;
}

export function LeaderVerificationSection({
  verifications,
  claimId,
}: LeaderVerificationSectionProps) {
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [localVerifications, setLocalVerifications] = useState(verifications);

  if (!claimId) return null;

  const copyLink = async (token: string) => {
    const url = `${window.location.origin}/leader-verify?token=${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("คัดลอกลิงก์แล้ว");
    } catch (error) {
      console.error("Failed to copy verification link to clipboard:", error);
      toast.error("คัดลอกลิงก์ไม่สำเร็จ", {
        description: "โปรดตรวจสอบสิทธิ์การเข้าถึงคลิปบอร์ดของเบราว์เซอร์",
      });
    }
  };

  const handleRefresh = async (verificationId: string) => {
    setRefreshing(verificationId);
    const res = await refreshVerificationToken(verificationId);
    setRefreshing(null);
    if (!res.success) {
      toast.error("ต่ออายุลิงก์ไม่สำเร็จ", { description: res.error });
      return;
    }
    toast.success("ต่ออายุลิงก์สำเร็จ");
    setLocalVerifications((prev) =>
      prev.map((v) =>
        v.id === verificationId
          ? {
              ...v,
              token: res.data.token,
              expiresAt: res.data.expiresAt,
              verifiedAt: res.data.verifiedAt ?? null,
            }
          : v,
      ),
    );
  };

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" />
        การยืนยันจากหัวหน้า
      </p>
      <div className="space-y-2">
        {localVerifications.map((v) => (
          <div
            key={v.id}
            className={`rounded-lg border p-3 text-xs ${
              v.verifiedAt
                ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30"
                : "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="space-y-0.5">
                <p className="font-medium text-foreground">{v.offSiteWorkId}</p>
                {v.leaderEmail ? (
                  <p className="text-muted-foreground">{v.leaderEmail}</p>
                ) : null}
                <p className="text-muted-foreground">
                  หมดอายุ: {new Date(v.expiresAt).toLocaleDateString("th-TH")}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {v.verifiedAt ? (
                  <span className="flex items-center gap-1 font-medium text-green-700 dark:text-green-400">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    ยืนยันแล้ว
                  </span>
                ) : (
                  <>
                    <span className="text-amber-700 dark:text-amber-400">
                      รอยืนยัน
                    </span>
                    {!v.leaderUserId ? (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => void copyLink(v.token)}
                          title="คัดลอกลิงก์"
                          className="rounded p-1 transition-colors hover:bg-amber-100 dark:hover:bg-amber-900/30"
                        >
                          <Copy className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleRefresh(v.id)}
                          disabled={refreshing === v.id}
                          title="ต่ออายุลิงก์"
                          className="rounded p-1 transition-colors hover:bg-amber-100 dark:hover:bg-amber-900/30 disabled:opacity-50"
                        >
                          <RefreshCw
                            className={`h-3.5 w-3.5 text-amber-700 dark:text-amber-400 ${
                              refreshing === v.id ? "animate-spin" : ""
                            }`}
                          />
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
