import { Skeleton } from "@/components/ui/skeleton";

export default function LeaderVerifyLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-50 to-white p-4 dark:from-sky-950 dark:to-background">
      <div className="w-full max-w-lg space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
    </main>
  );
}
