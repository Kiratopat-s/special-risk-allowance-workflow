"use client";

import { useId, useRef, useState, type FocusEvent } from "react";
import type { Dayjs } from "dayjs";
import type { FieldRef } from "@mui/x-date-pickers/models";
import { DesktopDatePicker } from "@mui/x-date-pickers/DesktopDatePicker";
import type { DateFieldProps } from "@mui/x-date-pickers/DateField";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import "dayjs/locale/th";
import { CalendarDays, X, type LucideProps } from "lucide-react";
import { useDesktopPicker } from "@/lib/hooks/use-desktop-picker";
import {
  formatPickerDate,
  parsePickerDate,
  MIN_PICKER_DATE,
  MAX_PICKER_DATE,
  type PickerDateKind,
} from "@/lib/ui/picker-date";
import { Input } from "./input";
import { PickerYearView } from "./picker-year-view";
import { cn } from "@/lib/utils";

type PickerIconProps = LucideProps & { ownerState?: unknown };
function CalendarIcon({ ownerState, ...props }: PickerIconProps) {
  void ownerState;
  return <CalendarDays {...props} size={20} />;
}
function ClearIcon({ ownerState, ...props }: PickerIconProps) {
  void ownerState;
  return <X {...props} size={18} />;
}

interface DatePickerProps {
  kind: PickerDateKind;
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  hideLabel?: boolean;
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  title?: string;
  /** URL filters commit keyboard edits on leaving the field, not on each keystroke. */
  commitOnBlur?: boolean;
}

export function DatePicker({
  kind,
  value,
  onValueChange,
  label,
  hideLabel = false,
  id: suppliedId,
  name,
  disabled,
  required,
  className,
  title,
  commitOnBlur = false,
}: DatePickerProps) {
  const generatedId = useId();
  const id = suppliedId || generatedId;
  const desktop = useDesktopPicker();
  const [open, setOpen] = useState(false);
  const fieldRef = useRef<FieldRef<Dayjs | null>>(null);
  const [incomplete, setIncomplete] = useState(false);
  const [state, setState] = useState(() => ({
    propValue: value,
    emitted: value,
    draft: parsePickerDate(value, kind),
  }));
  const [inputMode, setInputMode] = useState(desktop);
  if (inputMode !== desktop) {
    setInputMode(desktop);
    setOpen(false);
    setIncomplete(false);
    setState({
      propValue: value,
      emitted: value,
      draft: parsePickerDate(value, kind),
    });
  }
  // A parent acknowledgement must not erase an incomplete edit. Real external changes
  // (URL navigation, reset, selecting another record) replace the local draft.
  if (state.propValue !== value) {
    setState({
      propValue: value,
      emitted: value,
      draft:
        value === state.emitted ? state.draft : parsePickerDate(value, kind),
    });
  }
  const invalid =
    state.draft !== null &&
    (!state.draft.isValid() ||
      state.draft.isBefore(MIN_PICKER_DATE) ||
      state.draft.isAfter(MAX_PICKER_DATE));
  const fieldSlotProps: Pick<
    DateFieldProps,
    "clearable" | "unstableFieldRef" | "onClear"
  > = {
    clearable: !required,
    unstableFieldRef: fieldRef,
    onClear: () => {
      setIncomplete(false);
      if (commitOnBlur) {
        setState((previous) => ({ ...previous, draft: null, emitted: "" }));
        if (value !== "") onValueChange("");
      }
    },
  };
  return (
    <div className={cn("min-w-0", className)}>
      <label
        id={`${id}-label`}
        htmlFor={id}
        className={
          hideLabel ? "sr-only" : "block text-sm text-muted-foreground mb-2"
        }
      >
        {label}
      </label>
      {desktop ? (
        <LocalizationProvider
          dateAdapter={AdapterDayjs}
          adapterLocale="th"
          localeText={{
            previousMonth: "เดือนก่อนหน้า",
            nextMonth: "เดือนถัดไป",
            cancelButtonLabel: "ยกเลิก",
            clearButtonLabel: "ล้าง",
            okButtonLabel: "ตกลง",
            todayButtonLabel: "วันนี้",
            fieldClearLabel: "ล้างค่า",
            dateTableLabel: "เลือกวันที่",
            datePickerToolbarTitle: "เลือกวันที่",
            year: "ปี",
            month: "เดือน",
            day: "วัน",
            weekDay: "วันในสัปดาห์",
            empty: "ว่าง",
            fieldYearPlaceholder: () => "YYYY",
            fieldMonthPlaceholder: () => "MM",
            fieldDayPlaceholder: () => "DD",
            calendarViewSwitchingButtonAriaLabel: (view) =>
              view === "year" ? "เลือกเดือน" : "เลือกปี",
          }}
        >
          <DesktopDatePicker
            open={open}
            onOpen={() => setOpen(true)}
            onClose={() => setOpen(false)}
            value={state.draft}
            onChange={(draft, context) => {
              const next = context.validationError
                ? ""
                : formatPickerDate(draft, kind);
              setIncomplete(false);
              setState((previous) => ({
                ...previous,
                emitted: open || commitOnBlur ? previous.emitted : next,
                draft,
              }));
              if (!open && !commitOnBlur) onValueChange(next);
            }}
            onAccept={(draft, context) => {
              if (!open) return;
              const next = context.validationError
                ? ""
                : formatPickerDate(draft, kind);
              setState((previous) => ({ ...previous, emitted: next, draft }));
              if (next !== value) onValueChange(next);
            }}
            timezone="UTC"
            format={kind === "month" ? "MM/YYYY" : "DD/MM/YYYY"}
            views={
              kind === "month" ? ["year", "month"] : ["year", "month", "day"]
            }
            openTo={kind === "month" ? "month" : "day"}
            viewRenderers={{ year: (props) => <PickerYearView {...props} /> }}
            minDate={MIN_PICKER_DATE}
            maxDate={MAX_PICKER_DATE}
            disabled={disabled}
            name={name}
            reduceAnimations
            slots={{ openPickerIcon: CalendarIcon, clearIcon: ClearIcon }}
            slotProps={{
              textField: {
                id,
                fullWidth: true,
                size: "small",
                required,
                error: invalid || incomplete,
                helperText:
                  invalid || incomplete
                    ? "กรุณากรอกวันที่ให้ครบและถูกต้อง"
                    : undefined,
                inputProps: { "aria-labelledby": `${id}-label`, title },
                InputProps: { "aria-labelledby": `${id}-label` },
                onBlur: (event: FocusEvent<HTMLDivElement>) => {
                  if (
                    event.currentTarget.contains(
                      event.relatedTarget as Node | null,
                    )
                  )
                    return;
                  const sections = fieldRef.current?.getSections() || [];
                  const partial =
                    sections.some((section) => section.value !== "") &&
                    sections.some((section) => section.value === "");
                  setIncomplete(partial);
                  if (commitOnBlur && !open && !partial && !invalid) {
                    const next = formatPickerDate(state.draft, kind);
                    setState((previous) => ({ ...previous, emitted: next }));
                    if (next !== value) onValueChange(next);
                  }
                },
              },
              field: fieldSlotProps,
              openPickerButton: { "aria-label": `เปิด${label}`, size: "small" },
              clearButton: { "aria-label": `ล้าง${label}`, size: "small" },
              popper: {
                "aria-label": `เลือก${label}`,
                sx: { zIndex: (theme) => theme.zIndex.modal + 1 },
                modifiers: [
                  {
                    name: "preventOverflow",
                    options: { padding: 12, altAxis: true, tether: false },
                  },
                ],
              },
              desktopPaper: {
                onKeyDown: (event) => {
                  if (event.key !== "Escape") return;
                  event.stopPropagation();
                  setState({
                    propValue: value,
                    emitted: value,
                    draft: parsePickerDate(value, kind),
                  });
                  setIncomplete(false);
                  setOpen(false);
                },
                sx: {
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  backgroundImage: "none",
                  maxWidth: "calc(100vw - 24px)",
                  maxHeight: "calc(100dvh - 24px)",
                  overflowY: "auto",
                },
              },
            }}
          />
        </LocalizationProvider>
      ) : (
        <Input
          id={id}
          name={name}
          type={kind}
          value={value}
          disabled={disabled}
          required={required}
          title={title}
          onChange={(event) => {
            const next = event.target.value;
            setState({
              propValue: value,
              emitted: next,
              draft: parsePickerDate(next, kind),
            });
            onValueChange(next);
          }}
        />
      )}
    </div>
  );
}
