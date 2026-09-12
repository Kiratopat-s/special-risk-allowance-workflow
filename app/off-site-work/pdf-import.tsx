"use client";

import { useEffect, useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/workflow-ui/button";
import { matchOffSiteWorkEmployees } from "@/app/actions/off-site-work";
import { parseOffSiteWorkPdf } from "@/lib/pdf/off-site-work-reader";
import { PDF_FIELDS, type OffSiteWorkPdfDraft, type PdfField } from "@/lib/pdf/off-site-work-parser";
import type { EmployeeListItem } from "@/lib/domains/off-site-work/types";
import { shortDateDisplay } from "@/lib/shared/format";

interface Props {
  protectedFields: PdfField[];
  currentFields: Record<PdfField, string>;
  disabled?: boolean;
  onPendingChange?: (pending: boolean) => void;
  onApply: (fields: Partial<Record<PdfField, string>>, employees: EmployeeListItem[]) => void;
}

export function PdfImport({ protectedFields, currentFields, disabled, onApply, onPendingChange }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const previewUrl = useRef<string | null>(null);
  const [source, setSource] = useState<{ name: string; url: string } | null>(null);
  const [draft, setDraft] = useState<OffSiteWorkPdfDraft | null>(null);
  const [overrides, setOverrides] = useState<Partial<Record<PdfField, boolean>>>({});
  const [includeEmployees, setIncludeEmployees] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [applied, setApplied] = useState(false);

  useEffect(() => () => {
    controller.current?.abort();
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    onPendingChange?.(false);
  }, [onPendingChange]);

  const selected = (field: PdfField) => overrides[field] ?? !protectedFields.includes(field);
  const displayValue = (field: PdfField, value: string) =>
    value && (field === "startDate" || field === "endDate") ? shortDateDisplay(value) : value;

  async function read(file: File) {
    controller.current?.abort();
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = null;
    setSource(null);
    setDraft(null);
    setOverrides({});
    setIncludeEmployees(true);
    setApplied(false);
    setMessage("");
    setBusy(true);
    onPendingChange?.(true);
    const current = new AbortController();
    controller.current = current;
    const timeout = window.setTimeout(() => {
      current.abort();
      if (controller.current === current) {
        setBusy(false);
        onPendingChange?.(false);
        setMessage("อ่านไฟล์นานเกินไป กรุณาลองใหม่หรือกรอกข้อมูลเอง");
      }
    }, 30_000);
    let hasReview = false;
    try {
      const result = await parseOffSiteWorkPdf(file, current.signal);
      if (current.signal.aborted) return;
      if (!result.success) { setMessage(result.error); return; }
      const codes = result.data.employees.flatMap((employee) => employee.employeeId && /^\d{6}$/.test(employee.employeeId) ? [employee.employeeId] : []);
      const matches = await matchOffSiteWorkEmployees(codes);
      if (current.signal.aborted) return;
      const employees = result.data.employees.map((employee) =>
        matches.success ? matches.data.find((user) => user.employeeId === employee.employeeId) || employee : employee);
      if (!matches.success) setMessage(`${matches.error} รายชื่อจะถูกเก็บไว้เพื่อเชื่อมบัญชีเมื่อบันทึก`);
      const url = URL.createObjectURL(file);
      previewUrl.current = url;
      setSource({ name: file.name, url });
      setDraft({ ...result.data, employees });
      hasReview = true;
    } catch {
      if (!current.signal.aborted) setMessage("อ่านข้อมูลไม่สำเร็จ กรุณาลองใหม่หรือกรอกข้อมูลเอง");
    } finally {
      window.clearTimeout(timeout);
      if (controller.current === current && !current.signal.aborted) {
        setBusy(false);
        if (!hasReview) onPendingChange?.(false);
      }
    }
  }

  function cancel() {
    controller.current?.abort();
    setBusy(false);
    onPendingChange?.(false);
    setMessage("ยกเลิกการอ่านแล้ว ข้อมูลในฟอร์มยังอยู่ครบ");
  }

  return (
    <section className="space-y-3 rounded-xl border border-primary/25 bg-primary/5 p-4" aria-label="เติมข้อมูลจาก PDF">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium"><FileUp className="size-4" />เติมข้อมูลจาก PDF</p>
          <p className="mt-1 text-xs text-muted-foreground">PDF จากระบบเดิม ไม่เกิน 10 MB / 20 หน้า · อ่านในเครื่องและไม่เก็บไฟล์</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => input.current?.click()} disabled={disabled}>เลือก PDF</Button>
        <input ref={input} type="file" accept=".pdf,application/pdf" className="sr-only" aria-label="เลือกไฟล์ PDF" disabled={disabled}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void read(file);
          }} />
      </div>
      {busy && <div role="status" className="flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin" />กำลังอ่านไฟล์และจับคู่พนักงาน<Button variant="ghost" size="sm" onClick={cancel}>ยกเลิกการอ่าน</Button></div>}
      {message && <p role="alert" className="text-sm text-amber-800 dark:text-amber-300">{message}</p>}
      {source && <a className="block break-all text-sm underline" href={source.url} target="_blank" rel="noreferrer">ดูต้นฉบับ: {source.name}</a>}
      {draft && !applied && <div className="space-y-3">
        <p className="text-sm font-medium">ตรวจทานข้อมูลก่อนนำลงฟอร์ม</p>
        <p className="text-xs text-muted-foreground">ช่องที่คุณกรอกเองจะไม่ถูกเลือกแทนที่ เลือกช่องที่ต้องการนำเข้าด้านล่าง</p>
        <div className="space-y-2">
          {(Object.entries(PDF_FIELDS) as [PdfField, string][]).map(([field, label]) => <label key={field} className="flex items-start gap-2 rounded-lg border bg-background p-2 text-sm">
            <input type="checkbox" className="mt-1" checked={selected(field)} disabled={disabled || applied}
              onChange={(event) => setOverrides((previous) => ({ ...previous, [field]: event.target.checked }))} />
            <span className="min-w-0"><span className="font-medium">{label}</span><span className="block whitespace-pre-wrap break-words text-muted-foreground">{displayValue(field, draft.fields[field]) || "อ่านไม่พบ — จะเว้นช่องนี้ว่าง"}</span>
              {protectedFields.includes(field) && <span className="block text-xs text-amber-800 dark:text-amber-300">ค่าที่กรอกไว้: {displayValue(field, currentFields[field]) || "เว้นว่าง"}</span>}
            </span>
          </label>)}
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeEmployees} disabled={disabled || applied} onChange={(event) => setIncludeEmployees(event.target.checked)} />
          รวมรายชื่อผู้เดินทาง {draft.employees.length} คน (เชื่อมบัญชีได้ {draft.employees.filter((employee) => employee.userId).length} คน)
        </label>
        {draft.issues.length > 0 && <div className="space-y-1 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="font-medium">จุดที่ต้องตรวจทานกับต้นฉบับ</p>
          <ul className="list-disc space-y-1 pl-5">{draft.issues.map((issue, index) => <li key={index}>{issue.message}</li>)}</ul>
          <p className="text-xs">ชื่อที่จับคู่บัญชีได้ใช้ข้อมูลในระบบแล้ว ส่วนเครื่องหมาย � ที่ยังอยู่ในฟอร์มต้องแก้ไขก่อนบันทึก</p>
        </div>}
        <Button size="sm" disabled={disabled || applied || (!includeEmployees && !(Object.keys(PDF_FIELDS) as PdfField[]).some(selected))}
          onClick={() => {
            const fields: Partial<Record<PdfField, string>> = {};
            for (const field of Object.keys(PDF_FIELDS) as PdfField[]) if (selected(field)) fields[field] = draft.fields[field];
            onApply(fields, includeEmployees ? draft.employees : []);
            onPendingChange?.(false);
            setApplied(true);
          }}>{applied ? "นำข้อมูลลงฟอร์มแล้ว" : "นำข้อมูลลงฟอร์ม"}</Button>
        <Button variant="ghost" size="sm" disabled={disabled} onClick={() => {
          setDraft(null);
          setSource(null);
          setMessage("");
          if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
          previewUrl.current = null;
          onPendingChange?.(false);
        }}>ยกเลิกการนำเข้า</Button>
      </div>}
      {applied && <p role="status" className="text-sm">นำข้อมูลลงฟอร์มแล้ว ตรวจทานและแก้ไขข้อมูลด้านล่างก่อนบันทึก หัวหน้า/ผู้ควบคุมงานให้เลือกเอง</p>}
    </section>
  );
}
