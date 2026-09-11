"use client";

import * as React from "react";
import MuiButton from "@mui/material/Button";
import { Slot } from "@radix-ui/react-slot";
import { type VariantProps } from "class-variance-authority";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };
export function Button({
  variant = "default",
  size = "default",
  asChild,
  className,
  ref,
  color: _color,
  ...props
}: ButtonProps) {
  void _color;
  if (asChild)
    return (
      <Slot
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
        ref={ref}
      />
    );
  const icon = size?.startsWith("icon");
  return (
    <MuiButton
      ref={ref}
      type={props.type ?? "button"}
      variant={
        variant === "outline"
          ? "outlined"
          : ["ghost", "link"].includes(variant || "")
            ? "text"
            : "contained"
      }
      color={
        variant === "destructive"
          ? "error"
          : variant === "secondary" ||
              variant === "ghost" ||
              variant === "outline"
            ? "inherit"
            : "primary"
      }
      size={
        size === "sm" || size === "icon-sm"
          ? "small"
          : size === "lg" || size === "icon-lg"
            ? "large"
            : "medium"
      }
      className={cn(
        "shrink-0 [&_svg]:size-4 [&_svg]:shrink-0",
        variant === "link" && "underline",
        className,
      )}
      sx={icon ? { minWidth: 36, width: 36, padding: 0 } : undefined}
      {...props}
    />
  );
}
export { buttonVariants };
