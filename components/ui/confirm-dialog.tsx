"use client";

/**
 * ConfirmDialog
 *
 * Generic confirmation dialog with an AlertTriangle header, optional body text,
 * and cancel / confirm button pair.
 *
 * @module components/ui/confirm-dialog
 */

import type { ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { Button } from "./button";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  /** Dialog title (shown next to the warning icon). */
  title: ReactNode;
  /** Optional subtitle shown below the title. */
  description?: ReactNode;
  /** Optional body paragraph. */
  bodyText?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Button variant for the confirm action. Defaults to "destructive". */
  variant?: "default" | "destructive";
  isPending?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  bodyText,
  confirmLabel = "ยืนยัน",
  cancelLabel = "ยกเลิก",
  variant = "destructive",
  isPending = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} className="max-w-md">
      <DialogClose onClose={onClose} />
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          {title}
        </DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      {bodyText && (
        <DialogBody>
          <p className="text-sm text-muted-foreground">{bodyText}</p>
        </DialogBody>
      )}
      <DialogFooter>
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          onClick={onClose}
          disabled={isPending}
        >
          {cancelLabel}
        </Button>
        <Button
          variant={variant}
          className="w-full sm:w-auto"
          onClick={onConfirm}
          disabled={isPending}
        >
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {confirmLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
