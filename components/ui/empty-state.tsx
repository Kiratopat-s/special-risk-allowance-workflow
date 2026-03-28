/**
 * EmptyState
 *
 * Dashed-border placeholder shown when a list has no items.
 *
 * @module components/ui/empty-state
 */

import type { ComponentType } from "react";

interface EmptyStateProps {
  /** Lucide icon component to display above the message. */
  icon?: ComponentType<{ className?: string }>;
  message: string;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  message,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={`rounded-xl border border-dashed p-10 text-center text-muted-foreground ${
        className ?? ""
      }`}
    >
      {Icon && <Icon className="mx-auto mb-3 h-8 w-8 opacity-60" />}
      {message}
    </div>
  );
}
