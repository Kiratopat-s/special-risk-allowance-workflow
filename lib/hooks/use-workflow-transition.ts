"use client";
import { useCallback, useTransition } from "react";
import { toast } from "sonner";
/** A transport failure leaves the current form and its entered values mounted. */
export function useWorkflowTransition() {
  const [pending, startTransition] = useTransition();
  const run = useCallback(
    (operation: () => void | Promise<void>) => {
      startTransition(async () => {
        try {
          await operation();
        } catch {
          toast.error("เชื่อมต่อไม่สำเร็จ", {
            description: "ข้อมูลที่กรอกยังอยู่ กรุณาลองอีกครั้ง",
          });
        }
      });
    },
    [startTransition],
  );
  return [pending, run] as const;
}
