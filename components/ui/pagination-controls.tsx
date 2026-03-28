"use client";

/**
 * PaginationControls
 *
 * Reusable prev/next pagination bar. Renders nothing when there is only one page.
 *
 * @module components/ui/pagination-controls
 */

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import type { Pagination } from "@/lib/shared";
import { Button } from "./button";

interface PaginationControlsProps {
  pagination: Pagination;
  isPending?: boolean;
  onPrevious: () => void;
  onNext: () => void;
  /** Optional custom label. Defaults to "หน้า X/Y ทั้งหมด Z รายการ". */
  label?: ReactNode;
}

export function PaginationControls({
  pagination,
  isPending = false,
  onPrevious,
  onNext,
  label,
}: PaginationControlsProps) {
  if (pagination.totalPages <= 1) return null;

  return (
    <section className="flex items-center justify-between rounded-xl border bg-card px-4 py-3">
      {label ?? (
        <p className="text-xs text-muted-foreground">
          หน้า {pagination.page}/{pagination.totalPages} ทั้งหมด{" "}
          {pagination.total} รายการ
        </p>
      )}
      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant="outline"
          disabled={!pagination.hasPrevious || isPending}
          onClick={onPrevious}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          disabled={!pagination.hasNext || isPending}
          onClick={onNext}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}
