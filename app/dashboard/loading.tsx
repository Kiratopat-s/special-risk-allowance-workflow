import {
  CardGridSkeleton,
  PageHeaderSkeleton,
  Skeleton,
  ToolbarSkeleton,
} from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="space-y-6">
        <PageHeaderSkeleton actions={false} />

        <nav
          aria-label="Dashboard tabs loading"
          aria-busy="true"
          className="overflow-x-auto border-b border-border"
        >
          <div className="flex min-w-max gap-1 py-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-36" />
            ))}
          </div>
        </nav>

        <ToolbarSkeleton />
        <CardGridSkeleton />
      </div>
    </div>
  );
}
