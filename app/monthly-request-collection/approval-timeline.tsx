"use client";

/**
 * ApprovalTimeline + MrcStatusBadge
 *
 * Shared sub-components for the Monthly Request Collection feature.
 *
 * @module app/monthly-request-collection/approval-timeline
 */

import { CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { dateTimeDisplay } from "@/lib/shared/format";
import type { ClaimDocumentStatus } from "@/lib/shared/types";
import type {
  MonthlyRequestCollectionWithRelations,
  MrcApprovalStage,
} from "@/lib/domains/monthly-request-collection";

// ---------------------------------------------------------------------------
// Helpers (MRC-specific — not shared globally)
// ---------------------------------------------------------------------------

export function stageLabel(stage: MrcApprovalStage): string {
  const map: Record<MrcApprovalStage, string> = {
    HPA_CHECK: "หผ. ตรวจสอบ",
    RK_CHECK: "รก. ตรวจสอบ",
    OK_APPROVE: "อก. อนุมัติ",
  };
  return map[stage] ?? stage;
}

function stepStatusVariant(
  s: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (s === "APPROVED") return "default";
  if (s === "REJECTED") return "destructive";
  return "outline";
}

function stepStatusLabel(s: string): string {
  if (s === "APPROVED") return "ผ่าน";
  if (s === "REJECTED") return "ปฏิเสธ";
  return "รอดำเนินการ";
}

/** MRC-context Thai labels for ClaimDocumentStatus — differ from ECD context. */
const MRC_STATUS_LABEL: Record<ClaimDocumentStatus, string> = {
  DRAFT: "ร่าง",
  PENDING: "รอตรวจสอบ",
  PENDING_LEADER_VERIFY: "รอหัวหน้ายืนยัน",
  WAIT_FOR_COLLECTION: "พร้อมรวบรวม",
  COLLECTED: "รวบรวมแล้ว",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ถูกปฏิเสธ",
  CANCELLED: "ยกเลิก",
};

export function mrcStatusVariant(
  status: ClaimDocumentStatus,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "APPROVED" || status === "WAIT_FOR_COLLECTION")
    return "default";
  if (status === "REJECTED" || status === "CANCELLED") return "destructive";
  if (status === "PENDING" || status === "PENDING_LEADER_VERIFY")
    return "secondary";
  return "outline";
}

export function mrcStatusLabel(status: ClaimDocumentStatus): string {
  return MRC_STATUS_LABEL[status] ?? status;
}

// ---------------------------------------------------------------------------
// Exported components
// ---------------------------------------------------------------------------

/** Badge showing an expense-claim status using MRC-context labels. */
export function MrcStatusBadge({ status }: { status: ClaimDocumentStatus }) {
  return (
    <Badge variant={mrcStatusVariant(status)}>{MRC_STATUS_LABEL[status]}</Badge>
  );
}

/** Three-stage approval timeline showing HPA → RK → OK steps. */
export function ApprovalTimeline({
  mrc,
}: {
  mrc: MonthlyRequestCollectionWithRelations;
}) {
  const stages: MrcApprovalStage[] = ["HPA_CHECK", "RK_CHECK", "OK_APPROVE"];

  return (
    <div className="space-y-2">
      {stages.map((stage) => {
        const step = mrc.approvalSteps.find((s) => s.stage === stage);
        return (
          <div
            key={stage}
            className="flex items-start gap-3 rounded-lg border p-3"
          >
            <div className="mt-0.5">
              {!step && (
                <div className="h-4 w-4 rounded-full border-2 border-muted-foreground" />
              )}
              {step?.status === "PENDING" && (
                <div className="h-4 w-4 rounded-full border-2 border-yellow-500 bg-yellow-100" />
              )}
              {step?.status === "APPROVED" && (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              )}
              {step?.status === "REJECTED" && (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{stageLabel(stage)}</span>
                {step && (
                  <Badge
                    variant={stepStatusVariant(step.status)}
                    className="text-xs"
                  >
                    {stepStatusLabel(step.status)}
                  </Badge>
                )}
              </div>
              {step?.reviewer && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {step.reviewer.firstName} {step.reviewer.lastName}
                  {step.reviewedAt && ` · ${dateTimeDisplay(step.reviewedAt)}`}
                </p>
              )}
              {step?.remark && (
                <p className="mt-1 text-xs italic text-muted-foreground">
                  &quot;{step.remark}&quot;
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
