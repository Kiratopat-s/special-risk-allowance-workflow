"use client";
import Chip from "@mui/material/Chip";
import type { ClaimDocumentStatus } from "@/lib/shared/types";
export const STATUS_LABELS: Record<ClaimDocumentStatus, string> = {
  DRAFT: "ฉบับร่าง",
  PENDING: "รอดำเนินการ",
  PENDING_LEADER_VERIFY: "รอหัวหน้างานยืนยัน",
  WAIT_FOR_COLLECTION: "รอรวบรวม",
  COLLECTED: "รวบรวมแล้ว",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ไม่อนุมัติ",
  CANCELLED: "ยกเลิก",
};
export function StatusBadge({ status }: { status: ClaimDocumentStatus }) {
  return (
    <Chip
      size="small"
      label={STATUS_LABELS[status] || status}
      color={
        status === "WAIT_FOR_COLLECTION"
          ? "info"
          : status === "APPROVED"
            ? "success"
            : status === "REJECTED"
              ? "error"
              : status === "DRAFT" || status === "CANCELLED"
                ? "default"
                : "warning"
      }
      className={status === "WAIT_FOR_COLLECTION"
        ? "bg-sky-500/10 text-sky-700 border-sky-500/20 dark:text-sky-300"
        : undefined}
      variant="outlined"
      sx={{
        height: "auto",
        minHeight: 26,
        fontSize: 11,
        borderRadius: 1.5,
        "& .MuiChip-label": { py: 0.5, whiteSpace: "normal" },
      }}
    />
  );
}
