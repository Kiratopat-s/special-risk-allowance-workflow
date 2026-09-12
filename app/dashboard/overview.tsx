import Link from "next/link";
import { monthDisplay } from "@/lib/shared/format";
import {
  ArrowRight,
  ArrowUpRight,
  CircleCheck,
  Clock3,
  FileText,
  LockKeyhole,
  Wallet,
  CalendarDays,
} from "lucide-react";
import { getDashboardOverview } from "@/app/actions/dashboard";
import { Button } from "@/components/workflow-ui/button";
import { StatusBadge } from "@/components/workflow-ui/status-badge";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from "@/components/workflow-ui/table";
import { CountUp } from "@/components/react-bits/count-up";
import { SpotlightCard } from "@/components/react-bits/spotlight-card";
import { OverviewMonth } from "./overview-month";
const money = (amount: number | null) =>
  amount === null
    ? "—"
    : new Intl.NumberFormat("th-TH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
export async function Overview({
  month,
  name,
}: {
  month?: string;
  name: string;
}) {
  const result = await getDashboardOverview(month);
  if (!result.success)
    return (
      <div className="document-panel p-8" role="alert">
        <h1 className="text-xl font-bold mb-3">โหลดภาพรวมไม่สำเร็จ</h1>
        <p className="text-muted-foreground mb-5">{result.error}</p>
        <Button asChild variant="outline">
          <Link href="/dashboard?tab=overview">ลองอีกครั้ง</Link>
        </Button>
      </div>
    );
  const data = result.data;
  const claims = data.claims;
  const monthLabel = monthDisplay(`${data.month}-01T00:00:00Z`);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR WORKSPACE, AT A GLANCE</div>
          <h1>ภาพรวมการเบิกค่าใช้จ่าย</h1>
          <p>สวัสดี {name} · ติดตามเอกสารและงานที่ต้องดำเนินการในที่เดียว</p>
        </div>
        <OverviewMonth month={data.month} />
      </div>
      <p className="text-xs text-muted-foreground mb-4 flex items-center gap-2">
        <LockKeyhole size={13} />
        {data.scope === "ALL"
          ? "ทุกเอกสารที่คุณมีสิทธิ์เห็น"
          : data.scope === "OWN"
            ? "เฉพาะเอกสารของคุณ"
            : "บัญชีนี้ไม่มีสิทธิ์อ่านเอกสารเบิก"}{" "}
        · {monthLabel}
      </p>
      {claims && (
        <>
          <div className="overview-stats">
            <SpotlightCard className="overview-stat overview-stat-ink">
              <div className="flex items-center justify-between text-white/65 text-xs">
                <span>ยอดที่ขอเบิก</span>
                <Wallet size={18} />
              </div>
              <div className="stat-number">
                <span className="text-lg font-medium mr-2 text-white/60">
                  ฿
                </span>
                <CountUp to={claims.requestedAmount} decimals={2} />
              </div>
              <div className="text-[11px] text-white/55">
                รวมฉบับร่างและรายการไม่อนุมัติ · ไม่รวมรายการที่ยกเลิก
              </div>
            </SpotlightCard>
            <div className="overview-stat">
              <div className="flex items-center justify-between text-muted-foreground text-xs">
                <span>เอกสารทั้งหมด</span>
                <FileText size={18} />
              </div>
              <div className="stat-number">
                <CountUp to={claims.total} />
                <span className="text-sm font-normal text-muted-foreground ml-3">
                  รายการ
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="size-1.5 rounded-full bg-amber-500" />
                อยู่ระหว่างดำเนินการ {claims.inProgress} รายการ
              </div>
            </div>
            <div className="overview-stat">
              <div className="flex items-center justify-between text-muted-foreground text-xs">
                <span>ยอดที่อนุมัติแล้ว</span>
                <CircleCheck size={18} className="text-emerald-600" />
              </div>
              <div className="stat-number">
                <span className="text-lg font-medium mr-2 text-muted-foreground">
                  ฿
                </span>
                <CountUp to={claims.approvedAmount} decimals={2} />
              </div>
              <div className="text-xs text-muted-foreground">
                {claims.statuses.APPROVED || 0} เอกสารผ่านการอนุมัติ
              </div>
            </div>
          </div>
          {claims.requiresAction > 0 && (
            <div className="overview-attention">
              <div className="flex items-center gap-3">
                <Clock3 size={19} />
                <div>
                  <strong className="text-sm">
                    มี {claims.requiresAction} เอกสารที่คุณดำเนินการได้
                  </strong>
                  <p className="text-xs mt-1 opacity-80">
                    ตรวจสอบฉบับร่างหรือแก้ไขข้อมูลรายการไม่อนุมัติตามสิทธิ์ของคุณ
                  </p>
                </div>
              </div>
              <Link
                href={`/dashboard?tab=expense-claims&statusGroup=attention&month=${data.month}`}
                className="flex items-center gap-2 text-xs font-bold"
              >
                ตรวจสอบเอกสาร <ArrowRight size={15} />
              </Link>
            </div>
          )}
        </>
      )}
      <div className="overview-columns">
        <section className="document-panel min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 p-5 border-b">
            <div>
              <h2 className="text-base font-bold">เอกสารล่าสุด</h2>
              <p className="text-xs text-muted-foreground mt-1">
                {monthLabel} · เรียงตามเดือนและวันที่สร้าง
              </p>
            </div>
            {claims && (
              <Link
                href={`/dashboard?tab=expense-claims&month=${data.month}`}
                className="text-xs font-semibold flex items-center gap-1 text-primary"
              >
                ดูทั้งหมด
                <ArrowUpRight size={14} />
              </Link>
            )}
          </div>
          {!claims ? (
            <div className="p-10 text-center text-muted-foreground">
              <LockKeyhole className="mx-auto mb-3" />
              <p>ไม่มีสิทธิ์อ่านเอกสารเบิกค่าใช้จ่าย</p>
            </div>
          ) : claims.recent.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="mx-auto mb-3 text-muted-foreground" />
              <p className="font-semibold">ยังไม่มีเอกสารในเดือนนี้</p>
              <p className="text-sm text-muted-foreground mt-2">
                เลือกเดือนอื่น หรือเริ่มสร้างเอกสารจากเมนูด้านข้าง
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table aria-label="เอกสารเบิกล่าสุด">
                <TableHead>
                  <TableRow>
                    <TableHeader>เอกสาร / ผู้เบิก</TableHeader>
                    <TableHeader>สถานะ</TableHeader>
                    <TableHeader className="text-right">
                      ยอดเบิก (บาท)
                    </TableHeader>
                    <TableHeader>
                      <span className="sr-only">เปิดเอกสาร</span>
                    </TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {claims.recent.map((claim) => (
                    <TableRow key={claim.id}>
                      <TableCell>
                        <div className="flex items-center gap-3 min-w-56">
                          <div className="document-icon">
                            <FileText size={18} />
                          </div>
                          <div>
                            <p className="font-semibold line-clamp-1 max-w-72">
                              {claim.title}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {claim.claimant} · {claim.id.slice(0, 8)}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={claim.status} />
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums whitespace-nowrap">
                        {money(claim.amount)}
                      </TableCell>
                      <TableCell>
                        {claim.canView && (
                          <Link
                            href={`/dashboard?tab=expense-claims&claimId=${claim.id}`}
                            aria-label={`เปิดเอกสาร ${claim.title}`}
                            className="inline-flex rounded p-2 hover:bg-muted"
                          >
                            <ArrowUpRight size={16} />
                          </Link>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
        <aside className="space-y-5 min-w-0">
          {data.collections && (
            <section className="document-panel p-5">
              <div className="flex items-center gap-2 mb-1">
                <CalendarDays size={17} className="text-primary" />
                <h2 className="text-sm font-bold">การรวบรวมรายเดือน</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-5">
                {monthLabel} · {data.collections.total} ชุดเอกสาร
              </p>
              {data.collections.recent.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  ยังไม่มีชุดเอกสารที่คุณมีสิทธิ์เห็นในเดือนนี้
                </p>
              ) : (
                data.collections.recent.map((collection) => (
                  <div key={collection.id} className="border-t pt-4 mt-4">
                    <div className="flex justify-between items-center gap-2 mb-4">
                      <span className="text-xs font-semibold">
                        {collection.claimCount} เอกสาร
                      </span>
                      <StatusBadge status={collection.status} />
                    </div>
                    <ol className="approval-timeline">
                      {["HPA_CHECK", "RK_CHECK", "OK_APPROVE"].map(
                        (stage, index) => {
                          const step = collection.steps.find(
                            (item) => item.stage === stage,
                          );
                          return (
                            <li
                              key={stage}
                              className={
                                step?.status === "APPROVED" ? "complete" : ""
                              }
                            >
                              <span className="timeline-dot">
                                {step?.status === "APPROVED" ? (
                                  <CircleCheck size={15} />
                                ) : (
                                  index + 1
                                )}
                              </span>
                              <div>
                                <p className="text-xs font-semibold">
                                  {
                                    [
                                      "ตรวจสอบ หผ.",
                                      "ตรวจสอบ รก.",
                                      "อนุมัติ อก.",
                                    ][index]
                                  }
                                </p>
                                <p className="text-[11px] text-muted-foreground mt-1">
                                  {step?.status === "APPROVED"
                                    ? "ผ่านแล้ว"
                                    : step?.status === "REJECTED"
                                      ? "ไม่อนุมัติ"
                                      : step
                                        ? "รอดำเนินการ"
                                        : "ยังไม่เริ่ม"}
                                  {step?.reviewer ? ` · ${step.reviewer}` : ""}
                                </p>
                              </div>
                            </li>
                          );
                        },
                      )}
                    </ol>
                  </div>
                ))
              )}
              <Link
                href="/dashboard?tab=monthly-requests"
                className="mt-5 flex gap-2 items-center text-xs font-semibold text-primary"
              >
                ไปที่รายการรวบรวม
                <ArrowRight size={14} />
              </Link>
            </section>
          )}
          <section className="document-panel p-5">
            <h2 className="text-sm font-bold mb-4">เริ่มทำงาน</h2>
            <div className="flex flex-col gap-1">
              {data.nextActions.map((action) => (
                <Link
                  href={action.href}
                  key={action.href}
                  className="flex items-center justify-between gap-2 rounded-lg py-3 px-2 text-xs hover:bg-muted"
                >
                  {action.label}
                  <ArrowUpRight
                    size={15}
                    className="text-muted-foreground shrink-0"
                  />
                </Link>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
