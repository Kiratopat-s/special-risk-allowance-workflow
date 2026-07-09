import {
  DetailPanelSkeleton,
  PageHeaderSkeleton,
  Skeleton,
} from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <div className="container mx-auto max-w-7xl px-4 py-12">
      <div className="mx-auto max-w-2xl space-y-8">
        <PageHeaderSkeleton actions={false} />
        <div className="overflow-hidden rounded-xl border bg-card">
          <Skeleton className="h-32 w-full rounded-none" />
          <div className="space-y-6 p-6 pt-16">
            <div className="space-y-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
            <DetailPanelSkeleton className="border-0 p-0 shadow-none" />
          </div>
        </div>
      </div>
    </div>
  );
}
