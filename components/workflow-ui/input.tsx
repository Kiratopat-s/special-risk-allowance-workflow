"use client";
import * as React from "react";
import OutlinedInput from "@mui/material/OutlinedInput";
import { cn } from "@/lib/utils";

export function Input({
  className,
  ref,
  size: _size,
  onChange,
  onBlur,
  value,
  defaultValue,
  disabled,
  type,
  ...props
}: React.ComponentProps<"input">) {
  void _size;
  return (
    <OutlinedInput
      fullWidth
      inputRef={ref}
      type={type}
      className={cn("min-w-0", className)}
      disabled={disabled}
      value={value}
      defaultValue={defaultValue}
      onChange={onChange}
      onBlur={onBlur}
      inputProps={{
        ...props,
        "aria-label":
          props["aria-label"] ?? (props.id ? undefined : props.placeholder),
      }}
    />
  );
}
