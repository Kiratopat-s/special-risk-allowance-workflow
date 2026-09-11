"use client";
import * as React from "react";
import TextareaAutosize from "@mui/material/TextareaAutosize";
import { cn } from "@/lib/utils";
export function Textarea({
  className,
  rows,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <TextareaAutosize
      minRows={rows ?? 3}
      className={cn(
        "w-full rounded-lg border bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-2 focus:outline-primary disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
