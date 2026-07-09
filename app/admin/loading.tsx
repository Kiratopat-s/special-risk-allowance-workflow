import { TableSkeleton, ToolbarSkeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <div className="space-y-4">
      <ToolbarSkeleton filters={2} />
      <TableSkeleton columns={5} rows={6} />
    </div>
  );
}
