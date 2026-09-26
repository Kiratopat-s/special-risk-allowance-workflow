"use client";

import { useState, type FormEvent } from "react";
import { Alert, Autocomplete, Button, Checkbox, MenuItem, TextField } from "@mui/material";
import { Filter, RotateCcw } from "lucide-react";
import { parseAnalyticsQuery } from "@/lib/domains/analytics/query";
import { ANALYTICS_STATUSES, STATUS_LABELS, type AnalyticsDepartmentOption, type AnalyticsFilters } from "@/lib/domains/analytics/types";

const MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const INTERVALS = [
  ["month", "รายเดือน"], ["range", "ช่วงเดือน"], ["quarter", "ไตรมาส"],
  ["half", "ครึ่งปี"], ["year", "รายปี"],
] as const;

function MonthField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [year, month] = value.split("-");
  return <div className="analytics-month-fields" role="group" aria-label={label}>
    <TextField size="small" select label={`${label} · เดือน`} value={Number(month)}
      onChange={(event) => onChange(`${year}-${String(event.target.value).padStart(2, "0")}`)}>
      {MONTHS.map((name, index) => <MenuItem key={name} value={index + 1}>{name}</MenuItem>)}
    </TextField>
    <TextField size="small" label={`${label} · ปี พ.ศ.`} type="number" value={Number(year) + 543}
      onChange={(event) => onChange(`${Number(event.target.value) - 543}-${month}`)}
      slotProps={{ htmlInput: { min: 2444, max: 2742 } }} />
  </div>;
}

export function AnalyticsFiltersForm({ filters, departments, pending, onApply, onReset }: {
  filters: AnalyticsFilters;
  departments: AnalyticsDepartmentOption[];
  pending: boolean;
  onApply: (filters: AnalyticsFilters) => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = useState({ ...filters, statuses: filters.statuses.length === ANALYTICS_STATUSES.length ? [] : filters.statuses });
  const [error, setError] = useState<string | null>(null);
  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = new URLSearchParams({ interval: draft.interval, calendar: draft.calendar,
      year: String(draft.year), period: String(draft.period), from: draft.fromMonth, to: draft.toMonth,
      departments: draft.departmentIds.join(","), statuses: draft.statuses.join(",") });
    const result = parseAnalyticsQuery(query);
    if (!result.success) { setError(result.error); return; }
    setError(null);
    onApply(result.data);
  }
  const quarterLabels = draft.calendar === "fiscal"
    ? ["ไตรมาส 1 · ต.ค.–ธ.ค.", "ไตรมาส 2 · ม.ค.–มี.ค.", "ไตรมาส 3 · เม.ย.–มิ.ย.", "ไตรมาส 4 · ก.ค.–ก.ย."]
    : ["ไตรมาส 1 · ม.ค.–มี.ค.", "ไตรมาส 2 · เม.ย.–มิ.ย.", "ไตรมาส 3 · ก.ค.–ก.ย.", "ไตรมาส 4 · ต.ค.–ธ.ค."];
  const halfLabels = draft.calendar === "fiscal"
    ? ["ครึ่งปีแรก · ต.ค.–มี.ค.", "ครึ่งปีหลัง · เม.ย.–ก.ย."]
    : ["ครึ่งปีแรก · ม.ค.–มิ.ย.", "ครึ่งปีหลัง · ก.ค.–ธ.ค."];
  return <form className="document-panel analytics-filters" onSubmit={apply} aria-label="ตัวกรองรายงาน">
    <div className="analytics-filter-heading"><h2><Filter size={17} aria-hidden="true" /> ตัวกรองรายงาน</h2>
      <Button type="button" onClick={onReset} disabled={pending} size="small" startIcon={<RotateCcw size={15} />}>ล้างตัวกรอง</Button>
    </div>
    <fieldset disabled={pending} className="analytics-filter-fields">
      <TextField size="small" select label="ช่วงเวลา" value={draft.interval} onChange={(event) => setDraft({ ...draft, interval: event.target.value as AnalyticsFilters["interval"], period: 1 })}>
        {INTERVALS.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
      </TextField>
      <TextField size="small" select label="ปฏิทิน" value={draft.calendar} onChange={(event) => setDraft({ ...draft, calendar: event.target.value as AnalyticsFilters["calendar"] })}>
        <MenuItem value="calendar">ปีปฏิทิน · ม.ค.–ธ.ค.</MenuItem><MenuItem value="fiscal">ปีงบประมาณ · ต.ค.–ก.ย.</MenuItem>
      </TextField>
      {draft.interval === "range" ? <div className="analytics-range-fields">
        <MonthField label="เริ่มต้น" value={draft.fromMonth} onChange={(value) => setDraft({ ...draft, fromMonth: value })} />
        <MonthField label="สิ้นสุด" value={draft.toMonth} onChange={(value) => setDraft({ ...draft, toMonth: value })} />
      </div> : draft.interval === "month" ? <MonthField label="เดือนรายงาน" value={draft.fromMonth}
        onChange={(value) => setDraft({ ...draft, fromMonth: value })} /> : <>
        <TextField size="small" label={draft.calendar === "fiscal" ? "ปีงบประมาณ พ.ศ." : "ปี พ.ศ."}
          type="number" value={draft.year + 543} onChange={(event) => setDraft({ ...draft, year: Number(event.target.value) - 543 })}
          slotProps={{ htmlInput: { min: 2444, max: 2742 } }} />
        {draft.interval !== "year" && <TextField size="small" select label="รอบรายงาน" value={draft.period}
          onChange={(event) => setDraft({ ...draft, period: Number(event.target.value) })}>
          {(draft.interval === "quarter" ? quarterLabels : halfLabels).map((label, index) => <MenuItem key={label} value={index + 1}>{label}</MenuItem>)}
        </TextField>}
      </>}
      <Autocomplete size="small" multiple disableCloseOnSelect options={departments} className="analytics-department-picker"
        value={departments.filter((option) => draft.departmentIds.includes(option.id))}
        getOptionLabel={(option) => option.name} isOptionEqualToValue={(a, b) => a.id === b.id}
        onChange={(_event, values) => setDraft({ ...draft, departmentIds: values.map((option) => option.id) })}
        renderOption={(props, option, { selected }) => {
          const { key, ...rest } = props;
          return <li key={key} {...rest}><Checkbox size="small" checked={selected} />{option.name}</li>;
        }}
        renderInput={(params) => <TextField {...params} label="แผนก" placeholder={draft.departmentIds.length ? "เพิ่มแผนก" : "ทุกแผนก"} />}
        noOptionsText="ไม่พบแผนก" clearText="ล้างแผนก" openText="เลือกแผนก" closeText="ปิดตัวเลือก" />
      <Autocomplete size="small" multiple disableCloseOnSelect options={ANALYTICS_STATUSES} className="analytics-status-picker"
        value={draft.statuses} getOptionLabel={(option) => STATUS_LABELS[option]}
        onChange={(_event, values) => setDraft({ ...draft, statuses: values })}
        renderOption={(props, option, { selected }) => {
          const { key, ...rest } = props;
          return <li key={key} {...rest}><Checkbox size="small" checked={selected} />{STATUS_LABELS[option]}</li>;
        }}
        renderInput={(params) => <TextField {...params} label="สถานะเอกสาร" placeholder={draft.statuses.length ? "เพิ่มสถานะ" : "ทุกสถานะ"} />}
        noOptionsText="ไม่พบสถานะ" clearText="ล้างสถานะ" openText="เลือกสถานะ" closeText="ปิดตัวเลือก" />
      <Button variant="contained" type="submit" className="analytics-apply" disabled={pending}>{pending ? "กำลังโหลด…" : "แสดงรายงาน"}</Button>
    </fieldset>
    {draft.calendar === "fiscal" && <p className="analytics-help">ปีงบประมาณใช้ปีที่สิ้นสุดรอบ เช่น 2570 = ต.ค. 2569–ก.ย. 2570</p>}
    <p className="analytics-help">เลือกแผนกได้หลายแผนก โดยไม่รวมแผนกย่อยอัตโนมัติ · ไม่เลือกสถานะหรือแผนกเพื่อดูทั้งหมด</p>
    {error && <Alert severity="error" className="mt-4">{error}</Alert>}
  </form>;
}
