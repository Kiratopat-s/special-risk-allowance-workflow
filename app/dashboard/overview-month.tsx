"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/workflow-ui/input";
export function OverviewMonth({ month }: { month: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  return (
    <div className="w-44">
      <label className="sr-only" htmlFor="overview-month">
        เดือนที่แสดง
      </label>
      <Input
        id="overview-month"
        type="month"
        value={month}
        onChange={(event) => {
          if (/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value)) {
            const query = new URLSearchParams(searchParams);
            query.set("month", event.target.value);
            router.push(`/dashboard?${query}`, { scroll: false });
          }
        }}
      />
    </div>
  );
}
