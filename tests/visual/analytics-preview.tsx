import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { StyledEngineProvider, ThemeProvider } from "@mui/material/styles";
import { Button } from "@mui/material";
import { workflowTheme } from "@/components/workflow-ui/theme";
import { ThemeToggle } from "@/components/theme-toggle";
import { AnalyticsClient } from "@/app/analytics/analytics-client";
import { AnalyticsPrint } from "@/app/analytics/print/print-client";
import { parseAnalyticsQuery } from "@/lib/domains/analytics/query";
import { readDisplayOptions } from "@/app/analytics/url-state";
import { analyticsFixture, analyticsClaimsFixture } from "../fixtures/analytics";

function Preview() {
  const [print, setPrint] = useState(window.location.pathname.endsWith("/print"));
  const [query, setQuery] = useState(new URLSearchParams(window.location.search));
  useEffect(() => {
    const update = () => setQuery(new URLSearchParams(window.location.search));
    window.addEventListener("analytics:navigate", update);
    window.addEventListener("popstate", update);
    return () => { window.removeEventListener("analytics:navigate", update); window.removeEventListener("popstate", update); };
  }, []);
  const display = readDisplayOptions(query);
  const filters = parseAnalyticsQuery(query, new Date("2026-09-24"));
  const report = { ...analyticsFixture, filters: filters.success ? filters.data : analyticsFixture.filters };
  return <div className="app-public">
    <header className="analytics-print-controls flex flex-wrap items-center gap-3 border-b bg-card p-4">
      <strong>Analytics fixtures</strong><span className="text-sm text-muted-foreground">ข้อมูลตัวอย่าง · ไม่เชื่อมต่อฐานข้อมูลหรือ server actions</span>
      <Button onClick={() => setPrint(!print)}>{print ? "รายงาน" : "หน้าพิมพ์"}</Button><ThemeToggle />
    </header>
    {print ? <AnalyticsPrint report={report} view={display.view} sort={display.sort} /> : <AnalyticsClient report={report}
      claims={{ ...analyticsClaimsFixture, page: display.page }} claimsError={null} view={display.view} sort={display.sort} />}
  </div>;
}
createRoot(document.getElementById("root")!).render(<StyledEngineProvider enableCssLayer>
  <ThemeProvider theme={workflowTheme} defaultMode="light" storageManager={null} disableTransitionOnChange><Preview /></ThemeProvider>
</StyledEngineProvider>);
