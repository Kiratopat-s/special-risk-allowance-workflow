import { Skeleton } from "@mui/material";

export default function AnalyticsLoading() {
  return <div className="workspace-content space-y-7" role="status" aria-label="กำลังโหลดรายงานและสถิติ">
    <span className="sr-only">กำลังโหลดรายงานและสถิติ</span>
    <Skeleton variant="text" width="45%" height={48} />
    <Skeleton variant="rounded" height={180} />
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {[0, 1, 2, 3].map((key) => <Skeleton key={key} variant="rounded" height={125} />)}
    </div>
    <Skeleton variant="rounded" height={350} />
  </div>;
}
