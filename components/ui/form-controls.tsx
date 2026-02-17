"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Check, ChevronDown } from "lucide-react";

// =============================================================================
// CHECKBOX
// =============================================================================

interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

function Checkbox({ className, label, id, ...props }: CheckboxProps) {
  const generatedId = React.useId();
  const inputId = id || generatedId;

  return (
    <label
      htmlFor={inputId}
      className={cn(
        "inline-flex items-center gap-2 cursor-pointer select-none",
        props.disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
    >
      <div className="relative flex items-center justify-center">
        <input
          type="checkbox"
          id={inputId}
          className="peer sr-only"
          {...props}
        />
        <div className="h-4 w-4 rounded border border-input bg-background transition-colors peer-checked:bg-primary peer-checked:border-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring/50">
          <Check className="h-3 w-3 text-primary-foreground opacity-0 peer-checked:opacity-100 transition-opacity absolute top-0.5 left-0.5" />
        </div>
      </div>
      {label && <span className="text-sm leading-none">{label}</span>}
    </label>
  );
}

// =============================================================================
// SELECT
// =============================================================================

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

function Select({ className, label, children, ...props }: SelectProps) {
  return (
    <div className="relative">
      {label && (
        <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          className={cn(
            "h-9 w-full appearance-none rounded-md border border-input bg-background px-3 pr-8 py-1 text-sm shadow-xs transition-colors",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none",
            "disabled:pointer-events-none disabled:opacity-50",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
      </div>
    </div>
  );
}

export { Checkbox, Select };
