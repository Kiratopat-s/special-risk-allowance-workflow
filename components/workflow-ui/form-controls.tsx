"use client";
import * as React from "react";
import MuiCheckbox from "@mui/material/Checkbox";
import NativeSelect from "@mui/material/NativeSelect";
import OutlinedInput from "@mui/material/OutlinedInput";
import { cn } from "@/lib/utils";

export function Checkbox({
  label,
  className,
  id,
  checked,
  defaultChecked,
  disabled,
  onChange,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label?: string;
}) {
  const generated = React.useId();
  return (
    <label
      className={cn(
        "inline-flex items-center gap-1 cursor-pointer text-sm",
        className,
      )}
      htmlFor={id || generated}
    >
      <MuiCheckbox
        size="small"
        id={id || generated}
        checked={checked}
        defaultChecked={defaultChecked}
        disabled={disabled}
        onChange={onChange}
        inputProps={props}
      />
      {label}
    </label>
  );
}
export function Select({
  label,
  className,
  children,
  value,
  defaultValue,
  disabled,
  onChange,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  const generated = React.useId();
  const id = props.id || generated;
  return (
    <div className={cn("min-w-0", className)}>
      {label && (
        <label
          htmlFor={id}
          className="block text-sm text-muted-foreground mb-2"
        >
          {label}
        </label>
      )}
      <NativeSelect
        fullWidth
        input={<OutlinedInput />}
        value={value}
        defaultValue={defaultValue}
        disabled={disabled}
        onChange={onChange}
        inputProps={{ ...props, id }}
      >
        {children}
      </NativeSelect>
    </div>
  );
}
