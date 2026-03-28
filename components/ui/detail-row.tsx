/**
 * DetailRow
 *
 * Label + value pair used inside view dialogs and detail panels.
 *
 * Usage:
 * ```tsx
 * <DetailRow label="เดือน" value={monthDisplay(item.expenseMonth)} />
 * ```
 *
 * @module components/ui/detail-row
 */

import type { ReactNode } from "react";

interface DetailRowProps {
  label: string;
  value: ReactNode;
}

export function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value ?? "-"}</p>
    </div>
  );
}
