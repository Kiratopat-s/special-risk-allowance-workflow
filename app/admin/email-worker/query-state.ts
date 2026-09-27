import type { EmailDashboardFilter } from "@/lib/domains/email-delivery/dashboard-types";
import type { EmailDeliveryStatus } from "@/lib/domains/email-delivery/types";
import { deliveryLabels } from "./presentation";

export interface EmailWorkerQuery {
  filters: EmailDashboardFilter;
  deliveryId: string | null;
  attemptPage: number;
}

function pageNumber(value: string | null) {
  const page = Number(value || "1");
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export function parseEmailWorkerQuery(query: string): EmailWorkerQuery {
  const params = new URLSearchParams(query);
  const status = params.get("status");
  return {
    filters: {
      page: pageNumber(params.get("page")),
      status: status && Object.hasOwn(deliveryLabels, status) ? status as EmailDeliveryStatus : undefined,
      search: params.get("search")?.slice(0, 200) || undefined,
      from: params.get("from") || undefined,
      to: params.get("to") || undefined,
    },
    deliveryId: params.get("deliveryId")?.slice(0, 100) || null,
    attemptPage: pageNumber(params.get("attemptPage")),
  };
}

export function patchEmailWorkerQuery(query: string, patch: Record<string, string | number | null | undefined>) {
  const params = new URLSearchParams(query);
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === null || value === "" || ((key === "page" || key === "attemptPage") && value === 1)) params.delete(key);
    else params.set(key, String(value));
  }
  return params.toString();
}
