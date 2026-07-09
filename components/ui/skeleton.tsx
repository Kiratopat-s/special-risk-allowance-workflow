import * as React from "react";

import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-md bg-muted motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}

function PageHeaderSkeleton({
  className,
  actions = true,
}: {
  className?: string;
  actions?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      {actions && <Skeleton className="h-9 w-full sm:w-36" />}
    </div>
  );
}

function ToolbarSkeleton({
  className,
  filters = 1,
}: {
  className?: string;
  filters?: number;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center",
        className,
      )}
    >
      <Skeleton className="h-9 flex-1" />
      {Array.from({ length: filters }).map((_, index) => (
        <Skeleton key={index} className="h-9 w-full sm:w-36" />
      ))}
    </div>
  );
}

function CardGridSkeleton({
  className,
  count = 6,
}: {
  className?: string;
  count?: number;
}) {
  return (
    <section
      aria-busy="true"
      className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-3", className)}
    >
      {Array.from({ length: count }).map((_, index) => (
        <article
          key={index}
          className="rounded-2xl border bg-card p-4 shadow-sm"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <div className="mt-4 flex items-center justify-between border-t pt-3">
            <Skeleton className="h-8 w-16" />
            <div className="flex gap-1">
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-8" />
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}

function TableRowsSkeleton({
  rows = 5,
  columns = 4,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className="border-b last:border-0">
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <td key={columnIndex} className="p-3">
              <Skeleton
                className={cn(
                  "h-4",
                  columnIndex === 0 ? "w-32" : "w-full max-w-28",
                  columnIndex === columns - 1 && "ml-auto",
                )}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function TableSkeleton({
  className,
  rows = 5,
  columns = 4,
}: {
  className?: string;
  rows?: number;
  columns?: number;
}) {
  return (
    <div
      aria-busy="true"
      className={cn("overflow-hidden rounded-xl border bg-card", className)}
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            {Array.from({ length: columns }).map((_, index) => (
              <th key={index} className="p-3">
                <Skeleton className="h-3 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <TableRowsSkeleton rows={rows} columns={columns} />
        </tbody>
      </table>
    </div>
  );
}

function FormSkeleton({
  className,
  fields = 6,
}: {
  className?: string;
  fields?: number;
}) {
  return (
    <div aria-busy="true" className={cn("space-y-4", className)}>
      {Array.from({ length: fields }).map((_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}

function DetailPanelSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-busy="true"
      className={cn("rounded-xl border bg-card p-6", className)}
    >
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="space-y-5">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <div className="grid gap-2 sm:grid-cols-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NotificationListSkeleton({
  className,
  rows = 4,
}: {
  className?: string;
  rows?: number;
}) {
  return (
    <div aria-busy="true" className={cn("space-y-1 py-1", className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="space-y-2 px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-2 w-2 rounded-full" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

export {
  Skeleton,
  PageHeaderSkeleton,
  ToolbarSkeleton,
  CardGridSkeleton,
  TableRowsSkeleton,
  TableSkeleton,
  FormSkeleton,
  DetailPanelSkeleton,
  NotificationListSkeleton,
};
