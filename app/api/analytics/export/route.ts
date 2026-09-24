import { getAnalyticsReport } from "@/app/actions/analytics";
import { reportCsv } from "@/lib/domains/analytics/export";
import { analyticsSort, analyticsView } from "@/lib/domains/analytics/query";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const report = await getAnalyticsReport(query.toString());
  if (!report.success) return Response.json({ error: report.error }, {
    status: report.code === "UNAUTHORIZED" ? 401 : report.code === "INVALID_ANALYTICS_FILTERS" ? 400 : 500,
    headers: { "Cache-Control": "private, no-store" },
  });
  const { fromMonth, toMonth } = report.data.filters;
  return new Response(reportCsv(report.data, analyticsView(query.get("view")), analyticsSort(query.get("sort"))), {
    headers: { "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="analytics-${fromMonth}-${toMonth}.csv"`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
