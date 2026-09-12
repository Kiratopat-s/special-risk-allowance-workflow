"use client";
import * as React from "react";
import OutlinedInput from "@mui/material/OutlinedInput";
import InputAdornment from "@mui/material/InputAdornment";
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
  startAdornment,
  ...props
}: React.ComponentProps<"input"> & { startAdornment?: React.ReactNode }) {
  void _size;
  return (
    <OutlinedInput
      fullWidth
      inputRef={ref}
      type={type}
      startAdornment={startAdornment ? (
        <InputAdornment position="start" className="pointer-events-none" aria-hidden="true">
          {startAdornment}
        </InputAdornment>
      ) : undefined}
      sx={startAdornment ? { "& .MuiOutlinedInput-input": { paddingLeft: 0 } } : undefined}
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
