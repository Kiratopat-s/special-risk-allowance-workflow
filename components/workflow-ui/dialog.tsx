"use client";
import * as React from "react";
import MuiDialog from "@mui/material/Dialog";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DeploymentAlert } from "@/components/deployment-notice";
const TitleContext = React.createContext("");
const BusyContext = React.createContext(false);
interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  presentation?: "dialog" | "drawer";
  busy?: boolean;
}
export function Dialog({
  open,
  onClose,
  children,
  className,
  presentation = "dialog",
  busy = false,
}: DialogProps) {
  const titleId = React.useId();
  const content = (
    <BusyContext.Provider value={busy}>
      <TitleContext.Provider value={titleId}>
        <DeploymentAlert />
        {children}
      </TitleContext.Provider>
    </BusyContext.Provider>
  );
  if (presentation === "drawer")
    return (
      <Drawer
        anchor="right"
        open={open}
        onClose={busy ? undefined : onClose}
        slotProps={{
          paper: {
            role: "dialog",
            "aria-modal": true,
            "aria-labelledby": titleId,
            className: cn(
              "w-full sm:w-[680px] max-w-full flex flex-col overflow-hidden",
              className,
            ),
          },
        }}
      >
        {content}
      </Drawer>
    );
  return (
    <MuiDialog
      open={open}
      onClose={busy ? undefined : onClose}
      maxWidth={false}
      aria-labelledby={titleId}
      slotProps={{
        paper: {
          className: cn(
            "w-full max-w-lg m-4 flex flex-col overflow-hidden max-h-[calc(100dvh-2rem)]",
            className,
          ),
        },
      }}
    >
      {content}
    </MuiDialog>
  );
}
export function DialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col gap-2 p-5 pb-0 pr-14 sm:p-7 sm:pb-0 sm:pr-14",
        className,
      )}
      {...props}
    />
  );
}
export function DialogTitle({
  className,
  ...props
}: React.ComponentProps<"h2">) {
  const id = React.useContext(TitleContext);
  return (
    <h2
      id={id}
      className={cn("min-w-0 break-words text-xl font-bold tracking-tight", className)}
      {...props}
    />
  );
}
export function DialogDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-sm leading-relaxed text-muted-foreground", className)}
      {...props}
    />
  );
}
export function DialogBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("min-h-0 flex-1 overflow-y-auto p-5 sm:p-7", className)}
      {...props}
    />
  );
}
export function DialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-wrap gap-2 border-t bg-card p-4 sm:px-7 sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}
export function DialogClose({
  className,
  onClose,
  color: _color,
  ref,
  ...props
}: React.ComponentProps<"button"> & { onClose: () => void }) {
  const busy = React.useContext(BusyContext);
  void _color;
  return (
    <IconButton
      disabled={busy}
      ref={ref}
      type="button"
      aria-label="ปิด"
      onClick={onClose}
      className={cn("absolute right-3 top-3", className)}
      {...props}
    >
      <X size={20} />
    </IconButton>
  );
}
