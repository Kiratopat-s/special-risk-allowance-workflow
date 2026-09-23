import { Check, ShieldCheck } from "lucide-react";
import { monthDisplay, shortDateDisplay, toMonthInput } from "@/lib/shared/format";
import { formatClaimDateRanges, getCalendarGridDates, normalizeClaimDates } from "@/lib/ui/claim-dates";
import { cn } from "@/lib/utils";

export interface ClaimDatesCalendarProps {
  expenseMonth: Date | string;
  selectedDates: string[] | null;
  countDates?: number | null;
  highlightedDates?: string[];
  compact?: boolean;
}

/** Read-only saved dates shared by claim details and the leader's queue. */
export function ClaimDatesCalendar({ expenseMonth, selectedDates, countDates, highlightedDates = [], compact = false }: ClaimDatesCalendarProps) {
  const { dates, warnings } = normalizeClaimDates(expenseMonth, selectedDates, countDates);
  const selected = new Set(dates);
  const highlighted = new Set(highlightedDates);
  const cells = getCalendarGridDates(toMonthInput(expenseMonth));
  const weeks = Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7));
  const hasHighlights = dates.some((date) => highlighted.has(date));
  return (
    <section className="min-w-0 space-y-2" aria-label="วันที่ที่ยื่นเบิก">
      <div className="flex flex-wrap items-baseline justify-between gap-1 text-sm">
        <h3 className="font-medium">{monthDisplay(expenseMonth)}</h3>
        <span className="text-xs text-muted-foreground">วันที่ที่บันทึกไว้ {dates.length} วัน</span>
      </div>
      {cells.length > 0 && (
        <table className="w-full table-fixed border-separate border-spacing-1 text-center text-xs">
          <caption className="sr-only">ปฏิทินวันที่ที่ยื่นเบิก {monthDisplay(expenseMonth)}</caption>
          <thead><tr>{["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."].map((day) => <th key={day} scope="col" className="pb-1 font-normal text-muted-foreground">{day}</th>)}</tr></thead>
          <tbody>{weeks.map((week, index) => <tr key={index}>{week.map((date, dayIndex) => {
            if (!date) return <td key={`empty-${dayIndex}`} aria-hidden="true" />;
            const claimed = selected.has(date);
            const inLeaderWork = claimed && highlighted.has(date);
            return (
              <td key={date} aria-label={`${shortDateDisplay(date)}: ${claimed ? "ยื่นเบิก" : "ไม่ได้ยื่นเบิก"}${inLeaderWork ? " อยู่ในคำสั่งที่คุณรับผิดชอบ" : ""}`}>
                <div data-date={date} data-selected={claimed} data-highlighted={inLeaderWork} className={cn("relative flex items-center justify-center rounded-md border tabular-nums", compact ? "h-8" : "h-10", claimed ? "border-primary bg-primary font-semibold text-primary-foreground" : "border-border text-muted-foreground", inLeaderWork && "border-2 border-foreground")}>
                  {Number(date.slice(8))}
                  {claimed && (inLeaderWork ? <ShieldCheck aria-hidden="true" className="absolute right-0.5 top-0.5 size-2.5" /> : <Check aria-hidden="true" className="absolute right-0.5 top-0.5 size-2.5" />)}
                </div>
              </td>
            );
          })}</tr>)}</tbody>
        </table>
      )}
      {dates.length > 0 && <p className="text-sm leading-relaxed"><span className="text-muted-foreground">วันที่เบิก: </span>{formatClaimDateRanges(dates)}</p>}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Check aria-hidden="true" className="size-3" />วันที่ยื่นเบิก</span>
        {hasHighlights && <span className="inline-flex items-center gap-1"><ShieldCheck aria-hidden="true" className="size-3" />อยู่ในคำสั่งที่คุณรับผิดชอบ (กรอบเข้ม)</span>}
      </div>
      {warnings.length > 0 && <div role="note" className="space-y-1 rounded-md bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">{warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>}
    </section>
  );
}
