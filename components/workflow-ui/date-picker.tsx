"use client";

import { useId, useState } from "react";
import type { Dayjs } from "dayjs";
import { DesktopDatePicker } from "@mui/x-date-pickers/DesktopDatePicker";
import { MobileDatePicker } from "@mui/x-date-pickers/MobileDatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import {
  renderDateViewCalendar,
  type DateViewRendererProps,
} from "@mui/x-date-pickers/dateViewRenderers";
import type { DateView } from "@mui/x-date-pickers/models";
import { useDesktopPicker } from "@/lib/hooks/use-desktop-picker";
import {
  formatPickerDate,
  parsePickerDate,
  MIN_PICKER_DATE,
  MAX_PICKER_DATE,
  type PickerDateKind,
} from "@/lib/ui/picker-date";
import {
  buddhistDateParts,
  parseBuddhistDateParts,
  type BuddhistDateParts,
} from "@/lib/ui/buddhist-date";
import { ThaiCalendarAdapter } from "@/lib/ui/thai-calendar-adapter";
import { bangkokToday } from "@/lib/shared/format";
import {
  BuddhistDateField,
  BuddhistFieldContext,
  BuddhistPickerActions,
} from "./buddhist-date-field";
import { PickerYearView } from "./picker-year-view";
import { cn } from "@/lib/utils";

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
  const [calendar, setCalendar] = useState<Dayjs | null>(null);
  const [touched, setTouched] = useState(false);
  const [state, setState] = useState(() => ({
    propValue: value,
    emitted: value,
    kind,
    parts: buddhistDateParts(value, kind),
  }));
  const [inputMode, setInputMode] = useState(desktop);
  if (inputMode !== desktop) {
    setInputMode(desktop);
    setOpen(false);
  }
  // A parent acknowledgement must not erase an incomplete edit. Navigation or
  // selecting another record replaces the local draft, including an open calendar.
  if (state.propValue !== value || state.kind !== kind) {
    const external = value !== state.emitted || state.kind !== kind;
    setState({
      ...state,
      propValue: value,
      emitted: value,
      kind,
      parts: external ? buddhistDateParts(value, kind) : state.parts,
    });
    if (external) {
      setTouched(false);
      setOpen(false);
    }
  }
  const parsed = parseBuddhistDateParts(state.parts, kind);
  const error =
    touched &&
    (parsed.status === "incomplete" ||
      parsed.status === "invalid" ||
      (required && parsed.status === "empty"));

  function publish(next: string) {
    setState((previous) => ({ ...previous, emitted: next }));
    if (next !== state.emitted) onValueChange(next);
  }
  function change(parts: BuddhistDateParts) {
    setState((previous) => ({ ...previous, parts }));
    if (!commitOnBlur) publish(parseBuddhistDateParts(parts, kind).value);
  }
  function blur() {
    setTouched(true);
    if (parsed.status === "valid") {
      setState((previous) => ({
        ...previous,
        parts: buddhistDateParts(parsed.value, kind),
      }));
    }
    if (
      commitOnBlur &&
      !open &&
      (parsed.status === "valid" || parsed.status === "empty")
    )
      publish(parsed.value);
  }
  function clear() {
    setState((previous) => ({
      ...previous,
      parts: buddhistDateParts("", kind),
    }));
    setTouched(false);
    setOpen(false);
    publish("");
  }
  function accept(date: Dayjs | null) {
    const next = formatPickerDate(date, kind);
    if (!parsePickerDate(next, kind)) return;
    setState((previous) => ({
      ...previous,
      parts: buddhistDateParts(next, kind),
    }));
    setTouched(false);
    setOpen(false);
    publish(next);
  }
  function renderView(props: DateViewRendererProps<DateView>) {
    const onChange: typeof props.onChange = (
      date,
      selectionState,
      selectedView,
    ) => {
      props.onChange?.(date, selectionState, selectedView);
      // Only a final explicit selection accepts a desktop calendar. MUI also
      // fires onAccept on click-away; ignoring that callback makes dismissal safe.
      if (
        desktop &&
        selectionState === "finish" &&
        (selectedView ?? props.view) === (kind === "month" ? "month" : "day")
      )
        accept(date);
    };
    return props.view === "year" ? (
      <PickerYearView {...props} onChange={onChange} />
    ) : (
      renderDateViewCalendar({ ...props, onChange })
    );
  }
  const Picker = desktop ? DesktopDatePicker : MobileDatePicker;
  return (
    <div className={cn("min-w-0", className)}>
      <label
        id={`${id}-label`}
        htmlFor={id}
        className={
          hideLabel ? "sr-only" : "mb-2 block text-sm text-muted-foreground"
        }
      >
        {label}
        <span aria-hidden="true"> (พ.ศ.)</span>
      </label>
      <span id={`${id}-era`} className="sr-only">
        กรอกปี พ.ศ. เช่น 2569
      </span>
      <BuddhistFieldContext.Provider
        value={{
          id,
          label,
          kind,
          parts: state.parts,
          error: Boolean(error),
          required,
          title,
          change,
          blur,
          clear,
          cancel: () => setOpen(false),
          accept: () => accept(calendar),
          canAccept: Boolean(
            parsePickerDate(formatPickerDate(calendar, kind), kind),
          ),
        }}
      >
        <LocalizationProvider
          dateAdapter={ThaiCalendarAdapter}
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
            datePickerToolbarTitle: "เลือกวันที่ (พ.ศ.)",
            year: "ปี พ.ศ.",
            month: "เดือน",
            day: "วัน",
            weekDay: "วันในสัปดาห์",
            empty: "ว่าง",
            calendarViewSwitchingButtonAriaLabel: (view) =>
              view === "year" ? "เลือกเดือน" : "เลือกปี",
            openDatePickerDialogue: (date) =>
              date ? `เลือกวันที่ ${date}` : "เลือกวันที่",
          }}
        >
          <Picker
            open={open}
            onOpen={() => {
              setCalendar(parsePickerDate(parsed.value, kind));
              setOpen(true);
            }}
            onClose={() => setOpen(false)}
            value={open ? calendar : parsePickerDate(parsed.value, kind)}
            onChange={(date) => setCalendar(date)}
            timezone="UTC"
            referenceDate={parsePickerDate(bangkokToday(), "date")!}
            format={kind === "month" ? "MM/BBBB" : "DD/MM/BBBB"}
            views={
              kind === "month" ? ["year", "month"] : ["year", "month", "day"]
            }
            openTo={kind === "month" ? "month" : "day"}
            viewRenderers={{
              year: renderView,
              month: renderView,
              day: renderView,
            }}
            minDate={MIN_PICKER_DATE}
            maxDate={MAX_PICKER_DATE}
            closeOnSelect={desktop}
            disabled={disabled}
            name={name}
            reduceAnimations
            slots={{
              field: BuddhistDateField,
              actionBar: BuddhistPickerActions,
            }}
            slotProps={{
              calendarHeader: { format: "MMMM [พ.ศ.] BBBB" },
              toolbar: {
                hidden: desktop,
                toolbarFormat:
                  kind === "month" ? "MMMM [พ.ศ.] BBBB" : "D MMMM [พ.ศ.] BBBB",
                sx: { "& .MuiTypography-h4": { fontSize: "1.25rem" } },
              },
              dialog: { onClose: () => setOpen(false) },
              mobilePaper: {
                "aria-label": `เลือก${label}`,
                sx: { minWidth: 0, maxWidth: "calc(100vw - 24px)", m: 1.5 },
              },
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
                  if (event.key === "Escape") {
                    event.stopPropagation();
                    setOpen(false);
                  }
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
      </BuddhistFieldContext.Provider>
    </div>
  );
}
