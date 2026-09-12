"use client";

import { createContext, useContext, useRef } from "react";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import DialogActions from "@mui/material/DialogActions";
import type { PickersActionBarProps } from "@mui/x-date-pickers/PickersActionBar";
import { usePickerContext } from "@mui/x-date-pickers/hooks";
import { CalendarDays, X } from "lucide-react";
import {
  parseBuddhistDateParts,
  parseBuddhistDateText,
  stepBuddhistDatePart,
  type BuddhistDateParts,
  type BuddhistDatePart,
} from "@/lib/ui/buddhist-date";
import type { PickerDateKind } from "@/lib/ui/picker-date";
import { cn } from "@/lib/utils";

export interface BuddhistFieldState {
  id: string;
  label: string;
  kind: PickerDateKind;
  parts: BuddhistDateParts;
  error: boolean;
  required?: boolean;
  title?: string;
  change: (parts: BuddhistDateParts) => void;
  blur: () => void;
  clear: () => void;
  cancel: () => void;
  accept: () => void;
  canAccept: boolean;
}

export const BuddhistFieldContext = createContext<BuddhistFieldState | null>(
  null,
);

function useBuddhistField() {
  const field = useContext(BuddhistFieldContext);
  if (!field) throw new Error("BuddhistDateField must be inside DatePicker");
  return field;
}

/** MUI's public custom-field slot, with no dependency on its Gregorian sections parser. */
export function BuddhistDateField() {
  const field = useBuddhistField();
  const { rootRef, triggerRef, disabled, open, name, setOpen } =
    usePickerContext();
  const inputs = useRef<
    Partial<Record<BuddhistDatePart, HTMLInputElement | null>>
  >({});
  const segments: BuddhistDatePart[] =
    field.kind === "date" ? ["day", "month", "year"] : ["month", "year"];
  const labels = { day: "วัน", month: "เดือน", year: "ปี พ.ศ." };
  const parsed = parseBuddhistDateParts(field.parts, field.kind);
  return (
    <div ref={rootRef}>
      <div
        role="group"
        aria-labelledby={`${field.id}-label`}
        aria-describedby={`${field.id}-era${field.error ? ` ${field.id}-error` : ""}`}
        className={cn(
          "flex min-h-11 min-w-0 items-center rounded-md border bg-transparent px-3 transition-colors focus-within:ring-2 focus-within:ring-ring/40",
          field.error ? "border-destructive" : "border-input",
          disabled && "opacity-50",
        )}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
            field.blur();
        }}
        onPaste={(event) => {
          const next = parseBuddhistDateText(
            event.clipboardData.getData("text"),
            field.kind,
          );
          if (next && !disabled) {
            event.preventDefault();
            field.change(next);
          }
        }}
      >
        {segments.map((part, index) => (
          <span key={part} className="inline-flex min-w-0 items-center">
            {index > 0 && (
              <span aria-hidden="true" className="px-0.5 text-muted-foreground">
                /
              </span>
            )}
            <input
              ref={(element) => {
                inputs.current[part] = element;
                element?.setCustomValidity(
                  parsed.status === "invalid" || parsed.status === "incomplete"
                    ? "กรุณากรอกวันที่ให้ครบและถูกต้อง"
                    : "",
                );
              }}
              id={index === 0 ? field.id : `${field.id}-${part}`}
              type="text"
              role="spinbutton"
              inputMode="numeric"
              autoComplete="off"
              aria-label={labels[part]}
              aria-valuemin={part === "year" ? 544 : 1}
              aria-valuemax={
                part === "year" ? 10542 : part === "month" ? 12 : 31
              }
              aria-valuenow={
                field.parts[part] ? Number(field.parts[part]) : undefined
              }
              aria-invalid={field.error || undefined}
              aria-describedby={
                field.error ? `${field.id}-error` : `${field.id}-era`
              }
              placeholder={
                part === "year" ? "ปปปป" : part === "month" ? "ดด" : "วว"
              }
              value={field.parts[part]}
              disabled={disabled}
              required={field.required}
              title={field.title}
              maxLength={part === "year" ? 5 : 2}
              className={cn(
                "min-w-0 rounded-sm bg-transparent py-2 text-center text-sm tabular-nums outline-none focus:bg-primary/10",
                part === "year" ? "w-[5ch]" : "w-[2.5ch]",
              )}
              onFocus={(event) => event.target.select()}
              onChange={(event) => {
                if (/^\d*$/.test(event.target.value))
                  field.change({ ...field.parts, [part]: event.target.value });
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                  event.preventDefault();
                  field.change(
                    stepBuddhistDatePart(
                      field.parts,
                      field.kind,
                      part,
                      event.key === "ArrowUp" ? 1 : -1,
                    ),
                  );
                } else if (
                  event.key === "/" ||
                  event.key === "ArrowRight" ||
                  event.key === "ArrowLeft"
                ) {
                  const direction = event.key === "ArrowLeft" ? -1 : 1;
                  const next = inputs.current[segments[index + direction]];
                  if (next) {
                    event.preventDefault();
                    next.focus();
                    next.select();
                  }
                }
              }}
            />
          </span>
        ))}
        <span className="flex-1" />
        {!field.required && (
          <IconButton
            type="button"
            aria-label={`ล้าง${field.label}`}
            size="small"
            disabled={disabled}
            onClick={field.clear}
          >
            <X size={18} />
          </IconButton>
        )}
        <IconButton
          ref={triggerRef}
          type="button"
          aria-label={`เปิด${field.label}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          size="small"
          disabled={disabled}
          onClick={() => setOpen(true)}
        >
          <CalendarDays size={20} />
        </IconButton>
        {name && (
          <input
            type="hidden"
            name={name}
            value={parsed.value}
            disabled={disabled}
          />
        )}
      </div>
      {field.error && (
        <p id={`${field.id}-error`} className="mt-1 text-xs text-destructive">
          กรุณากรอกวันที่ให้ครบและถูกต้อง
        </p>
      )}
    </div>
  );
}

/** Explicit actions avoid MUI's default acceptance when dismissing a mobile dialog. */
export function BuddhistPickerActions({ className }: PickersActionBarProps) {
  const field = useBuddhistField();
  const picker = usePickerContext();
  if (picker.variant === "desktop") return null;
  return (
    <DialogActions className={className}>
      <Button onClick={field.cancel}>ยกเลิก</Button>
      <Button onClick={field.accept} disabled={!field.canAccept}>
        ตกลง
      </Button>
    </DialogActions>
  );
}
