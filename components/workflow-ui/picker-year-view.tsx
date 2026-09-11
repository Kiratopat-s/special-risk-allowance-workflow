"use client";

import { useId, useState } from "react";
import IconButton from "@mui/material/IconButton";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { YearCalendar } from "@mui/x-date-pickers/YearCalendar";
import type { DateViewRendererProps } from "@mui/x-date-pickers/dateViewRenderers";
import type { DateView } from "@mui/x-date-pickers/models";
import { parsePickerDate } from "@/lib/ui/picker-date";

/** Page the full ISO year range instead of mounting 9,999 radio buttons at once. */
export function PickerYearView(props: DateViewRendererProps<DateView>) {
  const id = useId();
  const current = props.value?.isValid()
    ? props.value
    : parsePickerDate(new Date().toISOString().slice(0, 10), "date")!;
  const [start, setStart] = useState(
    () => Math.floor((current.year() - 1) / 80) * 80 + 1,
  );
  const end = Math.min(start + 79, 9999);
  const inPage = current.year() >= start && current.year() <= end;
  return (
    <div className="w-80 max-w-[calc(100vw-24px)] p-2">
      <div className="flex items-center justify-between gap-2 px-2 py-2">
        <IconButton
          aria-label="ช่วงปีก่อนหน้า"
          size="small"
          disabled={start === 1}
          onClick={() => setStart(Math.max(1, start - 80))}
        >
          <ChevronLeft size={20} />
        </IconButton>
        <span id={id} className="text-sm font-semibold">
          ปี {start}–{end}
        </span>
        <IconButton
          aria-label="ช่วงปีถัดไป"
          size="small"
          disabled={end === 9999}
          onClick={() => setStart(start + 80)}
        >
          <ChevronRight size={20} />
        </IconButton>
      </div>
      <YearCalendar
        key={start}
        value={inPage ? props.value : null}
        referenceDate={inPage ? current : current.year(start)}
        onChange={(date) => props.onChange?.(date, "finish", "year")}
        minDate={
          parsePickerDate(`${String(start).padStart(4, "0")}-01-01`, "date")!
        }
        maxDate={
          parsePickerDate(`${String(end).padStart(4, "0")}-12-31`, "date")!
        }
        timezone="UTC"
        yearsPerRow={4}
        autoFocus
        gridLabelId={id}
        disabled={props.disabled}
        readOnly={props.readOnly}
        shouldDisableYear={props.shouldDisableYear}
        sx={{ width: "100%", maxHeight: 280 }}
      />
    </div>
  );
}
