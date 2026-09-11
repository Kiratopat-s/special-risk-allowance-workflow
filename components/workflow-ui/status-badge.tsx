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
        status === "APPROVED"
          ? "success"
          : status === "REJECTED"
            ? "error"
            : status === "DRAFT" || status === "CANCELLED"
              ? "default"
              : "warning"
      }
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
