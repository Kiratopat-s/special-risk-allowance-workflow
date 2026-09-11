"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { DatePicker } from "@/components/workflow-ui/date-picker";
export function OverviewMonth({ month }: { month: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  return (
    <div className="w-44">
      <DatePicker
        id="overview-month"
        kind="month"
        label="เดือนที่แสดง"
        hideLabel
        commitOnBlur
        required
        value={month}
        onValueChange={(value) => {
          if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
            const query = new URLSearchParams(searchParams);
            query.set("month", value);
            router.push(`/dashboard?${query}`, { scroll: false });
          }
        }}
      />
    </div>
  );
}
