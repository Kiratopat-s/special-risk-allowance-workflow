import Link from "next/link";
import { ArrowRight, CalendarRange, CircleAlert, RefreshCcw } from "lucide-react";
import { getMonthlyRequestRecheckOverview } from "@/app/actions/monthly-request-recheck";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Select } from "@/components/ui/form-controls";
import { Input } from "@/components/ui/input";
import type { RecheckMetrics } from "@/lib/domains/monthly-request-recheck";

interface PageProps {
  searchParams: Promise<{ month?: string; departmentId?: string }>;
}

function currentBangkokMonth(): string {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00.000Z`));
}

function thaiDate(value: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

const METRIC_LABELS: Array<{
  key: keyof RecheckMetrics;
  label: string;
  tone: string;
}> = [
  { key: "participantCount", label: "ผู้เดินทาง", tone: "text-slate-700" },
  { key: "submittedPeopleCount", label: "ส่งคำขอแล้ว", tone: "text-blue-700" },
  { key: "notSubmittedPeopleCount", label: "ยังไม่ส่ง", tone: "text-amber-700" },
  { key: "pendingLeaderClaimCount", label: "รอหัวหน้าชุด", tone: "text-orange-700" },
  { key: "readyForCollectionClaimCount", label: "พร้อมรวบรวม", tone: "text-emerald-700" },
  { key: "collectedClaimCount", label: "รวบรวมแล้ว", tone: "text-violet-700" },
  { key: "rejectedClaimCount", label: "ตีกลับ", tone: "text-red-700" },
  { key: "suspiciousClaimCount", label: "น่าสงสัย", tone: "text-rose-700" },
];

export default async function MonthlyRequestRecheckPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(params.month ?? "")
    ? params.month!
    : currentBangkokMonth();
  const departmentId = params.departmentId || undefined;
  const result = await getMonthlyRequestRecheckOverview(month, departmentId);

  if (!result.success) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>ไม่สามารถเปิดหน้าตรวจทานได้</CardTitle>
          <CardDescription>{result.error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/monthly-request-recheck">ลองใหม่</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const overview = result.data;
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCcw className="size-4" />
            Collector recheck
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            ตรวจเทียบคำขอเบิกรายเดือน
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ใบนำตัวทุกใบที่คาบเกี่ยว {monthLabel(month)} รวมถึงใบที่ยังไม่มีคำขอเบิก
          </p>
        </div>

        <form className="grid gap-3 rounded-lg border bg-card p-3 sm:grid-cols-[180px_280px_auto]" method="get">
          <label className="space-y-1 text-sm font-medium">
            <span>เดือน</span>
            <Input type="month" name="month" defaultValue={month} required />
          </label>
          <Select label="หน่วยงาน" name="departmentId" defaultValue={departmentId ?? ""}>
            <option value="">ทุกหน่วยงาน</option>
            {overview.departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.shortName || department.name}
              </option>
            ))}
          </Select>
          <Button type="submit" className="self-end">
            แสดงข้อมูล
          </Button>
        </form>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {METRIC_LABELS.map((metric) => (
          <Card key={metric.key} className="gap-2 py-4">
            <CardContent className="px-4">
              <p className="text-xs text-muted-foreground">{metric.label}</p>
              <p className={`mt-1 text-2xl font-semibold tabular-nums ${metric.tone}`}>
                {overview.totals[metric.key].toLocaleString("th-TH")}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="border-b py-5">
          <CardTitle className="flex items-center gap-2">
            <CalendarRange className="size-5" />
            ใบนำตัวที่คาบเกี่ยวเดือนนี้
          </CardTitle>
          <CardDescription>
            {overview.offSiteWorks.length.toLocaleString("th-TH")} ใบ — จำนวนคำขอในผลรวมถูกนับแบบไม่ซ้ำข้ามใบนำตัว
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {overview.offSiteWorks.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              ไม่พบใบนำตัวตามเดือนและหน่วยงานที่เลือก
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">ใบนำตัว / ช่วงวันที่</th>
                    {METRIC_LABELS.map((metric) => (
                      <th key={metric.key} className="px-2 py-3 text-center font-medium">
                        {metric.label}
                      </th>
                    ))}
                    <th className="px-2 py-3 text-center font-medium">
                      ควรเทียบวันที่
                    </th>
                    <th className="px-4 py-3 text-right font-medium">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {overview.offSiteWorks.map((offSiteWork) => {
                    const query = new URLSearchParams({ month });
                    if (departmentId) query.set("departmentId", departmentId);
                    return (
                      <tr key={offSiteWork.id} className="hover:bg-muted/30">
                        <td className="max-w-sm px-4 py-4 align-top">
                          <div className="font-medium">{offSiteWork.referenceNo}</div>
                          {offSiteWork.archived && (
                            <Badge variant="secondary" className="mt-1">
                              เก็บถาวร
                            </Badge>
                          )}
                          <div className="mt-1 text-xs text-muted-foreground">
                            {thaiDate(offSiteWork.startDate)} – {thaiDate(offSiteWork.endDate)}
                          </div>
                          {offSiteWork.objective && (
                            <div className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                              {offSiteWork.objective}
                            </div>
                          )}
                        </td>
                        {METRIC_LABELS.map((metric) => {
                          const value = offSiteWork.metrics[metric.key];
                          return (
                            <td key={metric.key} className="px-2 py-4 text-center tabular-nums">
                              <Badge variant={value > 0 ? "outline" : "secondary"}>
                                {value.toLocaleString("th-TH")}
                              </Badge>
                            </td>
                          );
                        })}
                        <td className="px-2 py-4 text-center tabular-nums">
                          <Badge
                            variant={
                              offSiteWork.comparisonCueCount > 0
                                ? "warning"
                                : "secondary"
                            }
                            className="gap-1"
                            title="จำนวนคำขอที่รูปแบบวันที่ต่างจากคนส่วนใหญ่ หรือมีรหัส WeSafe ซ้ำในวันเดียวกัน"
                          >
                            {offSiteWork.comparisonCueCount > 0 && (
                              <CircleAlert className="size-3" />
                            )}
                            {offSiteWork.comparisonCueCount.toLocaleString("th-TH")}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/monthly-request-recheck/${offSiteWork.id}?${query}`}>
                              ตรวจรายการ
                              <ArrowRight className="size-4" />
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
