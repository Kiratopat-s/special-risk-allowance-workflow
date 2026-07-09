import {
  FormSkeleton,
  PageHeaderSkeleton,
  Skeleton,
} from "@/components/ui/skeleton";

export default function EditProfileLoading() {
  return (
    <div className="container mx-auto max-w-7xl px-4 py-12">
      <div className="mx-auto max-w-2xl space-y-8">
        <Skeleton className="h-9 w-36" />
        <PageHeaderSkeleton actions={false} />
        <div className="rounded-xl border bg-card p-6">
          <div className="mb-6 flex items-center gap-4">
            <Skeleton className="h-14 w-14 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
            </div>
          </div>
          <FormSkeleton fields={10} />
        </div>
      </div>
    </div>
  );
}
