import { Skeleton } from "@/components/ui/skeleton";

export default function PrintLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-8">
      <div className="flex justify-end">
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="space-y-6 rounded-xl border bg-card p-8">
        <div className="flex items-center gap-4">
          <Skeleton className="h-20 w-20" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 12 }).map((_, index) => (
            <Skeleton key={index} className="h-5 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
