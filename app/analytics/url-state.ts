import type { AnalyticsSort, AnalyticsView } from "@/lib/domains/analytics/types";

export function queryFromParams(params: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
    else if (value !== undefined) query.set(key, value);
  }
  return query;
}

export function readDisplayOptions(query: URLSearchParams) {
  const requestedView = query.get("view");
  const requestedSort = query.get("sort");
  const view: AnalyticsView = requestedView === "department" || requestedView === "status" ? requestedView : "month";
  const sort: AnalyticsSort = requestedSort === "requested-desc" || requestedSort === "requested-asc" || requestedSort === "count-desc" ? requestedSort : "label";
  const rawPage = Number(query.get("page") || "1");
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  return { view, sort, page };
}
