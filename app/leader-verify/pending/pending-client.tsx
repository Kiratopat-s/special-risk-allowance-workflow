"use client";

/**
 * PendingVerificationsClient
 *
 * Shows the authenticated leader's pending verification queue.
 * Each card can be verified inline via `verifyAsLeader()`.
 */

import { useState, useTransition } from "react";
import {
  CheckCircle2,
  ClipboardList,
  Loader2,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { verifyAsLeader } from "@/app/actions/leader-verify";
import type { LeaderVerificationWithRelations } from "@/lib/domains/leader-verification";
import { monthDisplay, dateDisplay } from "@/lib/shared/format";

// ─── Single verification card ──────────────────────────────────────────────

function VerificationCard({
  item,
  onVerified,
}: {
  item: LeaderVerificationWithRelations;
  onVerified: (id: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  const isExpired = !item.verifiedAt && new Date(item.expiresAt) < new Date();

  const handleVerify = () => {
    startTransition(async () => {
      const res = await verifyAsLeader(item.expenseClaimId, item.offSiteWorkId);
      if (!res.success) {
        toast.error("ยืนยันไม่สำเร็จ", { description: res.error });
        return;
      }
      setDone(true);
      toast.success("ยืนยันการออกปฏิบัติงานสำเร็จ");
      onVerified(item.id);
    });
  };

  const osw = item.offSiteWork;
  const claim = item.expenseClaim;

  return (
    <div
      className={`rounded-xl border bg-card p-5 shadow-sm space-y-4 transition-opacity ${
        done ? "opacity-60" : ""
      }`}
    >
      {/* Status badge row */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold">
            {claim.claimant.firstName} {claim.claimant.lastName}
          </p>
          <p className="text-xs text-muted-foreground">
            เดือน {monthDisplay(claim.expenseMonth)}
          </p>
        </div>
        {done ? (
          <Badge variant="default" className="shrink-0 bg-green-600">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            ยืนยันแล้ว
          </Badge>
        ) : isExpired ? (
          <Badge variant="destructive" className="shrink-0">
            หมดอายุ
          </Badge>
        ) : (
          <Badge variant="secondary" className="shrink-0">
            รอยืนยัน
          </Badge>
        )}
      </div>

      {/* OSW details */}
      <div className="rounded-lg border bg-sky-50/60 dark:bg-sky-950/20 px-4 py-3 text-sm space-y-1.5">
        {osw.innerRefDocumentId && (
          <div className="flex gap-2 text-muted-foreground">
            <span className="w-24 shrink-0">เลขที่คำสั่ง</span>
            <span className="font-medium text-foreground font-mono text-xs">
              {osw.innerRefDocumentId}
            </span>
          </div>
        )}
        <div className="flex gap-2 text-muted-foreground">
          <span className="w-24 shrink-0">ช่วงวันที่</span>
          <span className="font-medium text-foreground">
            {dateDisplay(osw.startDate)} – {dateDisplay(osw.endDate)}
          </span>
        </div>
        {osw.location && (
          <div className="flex gap-2 text-muted-foreground">
            <span className="w-24 shrink-0">
              <MapPin className="inline mr-0.5 h-3 w-3" />
              สถานที่
            </span>
            <span className="font-medium text-foreground">{osw.location}</span>
          </div>
        )}
        {osw.objective && (
          <div className="flex gap-2 text-muted-foreground">
            <span className="w-24 shrink-0">วัตถุประสงค์</span>
            <span className="font-medium text-foreground">{osw.objective}</span>
          </div>
        )}
      </div>

      {/* Action */}
      {!done && (
        <Button
          className="w-full"
          disabled={isPending || isExpired}
          onClick={handleVerify}
        >
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ShieldCheck className="mr-2 h-4 w-4" />
          )}
          {isExpired
            ? "ลิงก์หมดอายุ — ติดต่อผู้ยื่น"
            : "ยืนยันการออกปฏิบัติงาน"}
        </Button>
      )}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export function PendingVerificationsClient({
  initialItems,
}: {
  initialItems: LeaderVerificationWithRelations[];
}) {
  const items = initialItems;
  const [verifiedIds, setVerifiedIds] = useState<Set<string>>(new Set());

  const handleVerified = (id: string) => {
    setVerifiedIds((prev) => new Set([...prev, id]));
  };

  const pending = items.filter((i) => !verifiedIds.has(i.id) && !i.verifiedAt);
  const done = items.filter((i) => verifiedIds.has(i.id) || !!i.verifiedAt);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 dark:bg-sky-900/40">
          <ClipboardList className="h-5 w-5 text-sky-600 dark:text-sky-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">คิวยืนยันการออกปฏิบัติงาน</h1>
          <p className="text-sm text-muted-foreground">
            รายการที่รอการยืนยันจากคุณในฐานะหัวหน้า
          </p>
        </div>
        {pending.length > 0 && (
          <Badge
            variant="destructive"
            className="ml-auto text-sm px-2.5 py-0.5"
          >
            {pending.length} รายการ
          </Badge>
        )}
      </div>

      {/* Pending list */}
      {pending.length === 0 && done.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center space-y-3 shadow-sm">
          <ShieldCheck className="mx-auto h-12 w-12 text-green-400" />
          <p className="font-medium text-muted-foreground">
            ไม่มีรายการรอยืนยันในขณะนี้
          </p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="space-y-3">
              {pending.map((item) => (
                <VerificationCard
                  key={item.id}
                  item={item}
                  onVerified={handleVerified}
                />
              ))}
            </div>
          )}

          {done.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground select-none list-none flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                ยืนยันแล้ว ({done.length} รายการ)
              </summary>
              <div className="mt-3 space-y-3 opacity-70">
                {done.map((item) => (
                  <VerificationCard
                    key={item.id}
                    item={{
                      ...item,
                      verifiedAt: item.verifiedAt ?? new Date(),
                    }}
                    onVerified={() => undefined}
                  />
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}
