import {
  PageHeaderSkeleton,
  Skeleton,
  TableSkeleton,
} from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div
      className="container mx-auto max-w-7xl px-4 py-8"
      role="status"
      aria-label="กำลังโหลดพื้นที่ทำงาน"
      aria-busy="true"
    >
      <div className="space-y-6">
        <PageHeaderSkeleton actions={false} />

        <div className="grid gap-4 sm:grid-cols-3" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-40 rounded-2xl border" />
          ))}
        </div>
        <TableSkeleton columns={4} rows={4} />
      </div>
    </div>
  );
}
