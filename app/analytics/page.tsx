import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAnalyticsClaims, getAnalyticsReport } from "@/app/actions/analytics";
import { AnalyticsClient } from "./analytics-client";
import { queryFromParams, readDisplayOptions } from "./url-state";
import "./analytics.css";

export const metadata = { title: "รายงานและสถิติ | SRAW" };

export default async function AnalyticsPage({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = queryFromParams((await searchParams) ?? {});
  const session = await auth();
  if (!session?.user?.dbUserId) {
    redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent(`/analytics?${query}`)}`);
  }
  const display = readDisplayOptions(query);
  const [report, claims] = await Promise.all([
    getAnalyticsReport(query.toString()),
    getAnalyticsClaims(query.toString(), display.page),
  ]);
  if (!report.success) {
    return <div className="workspace-content"><div className="document-panel p-8" role="alert">
      <h1 className="text-xl font-bold">ไม่สามารถแสดงรายงานได้</h1>
      <p className="mt-3 text-sm text-muted-foreground">{report.error}</p>
      <a href="/analytics" className="mt-5 inline-block text-sm font-semibold underline underline-offset-4">ล้างตัวกรองและโหลดรายงานใหม่</a>
    </div></div>;
  }
  return <AnalyticsClient report={report.data} claims={claims.success ? claims.data : null}
    claimsError={claims.success ? null : claims.error} view={display.view} sort={display.sort} />;
}
