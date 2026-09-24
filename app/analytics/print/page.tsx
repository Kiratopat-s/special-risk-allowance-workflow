import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAnalyticsReport } from "@/app/actions/analytics";
import { queryFromParams, readDisplayOptions } from "../url-state";
import { AnalyticsPrint } from "./print-client";
import "../analytics.css";

export const metadata = { title: "พิมพ์รายงานและสถิติ | SRAW" };

export default async function AnalyticsPrintPage({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = queryFromParams((await searchParams) ?? {});
  const session = await auth();
  if (!session?.user?.dbUserId) redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent(`/analytics/print?${query}`)}`);
  const report = await getAnalyticsReport(query.toString());
  if (!report.success) return <div className="analytics-print-page" role="alert"><h1>ไม่สามารถแสดงรายงานสำหรับพิมพ์ได้</h1><p>{report.error}</p><a href="/analytics">กลับไปเลือกตัวกรองรายงาน</a></div>;
  const display = readDisplayOptions(query);
  return <AnalyticsPrint report={report.data} view={display.view} sort={display.sort} />;
}
