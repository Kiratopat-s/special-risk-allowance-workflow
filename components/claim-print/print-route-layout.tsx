"use client";

import { usePathname } from "next/navigation";

/** Keep the existing route guard while removing its screen-only container on form previews. */
export function PrintRouteLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const claimPreview = /^\/expense-claim-document\/[^/]+\/print\/?$/.test(pathname) ||
    /^\/monthly-request-collection\/[^/]+\/claims\/print\/?$/.test(pathname);
  if (claimPreview) return <div className="claim-print-layout">{children}</div>;
  return <div className="container mx-auto max-w-7xl px-4 py-8"><div className="space-y-6">{children}</div></div>;
}
