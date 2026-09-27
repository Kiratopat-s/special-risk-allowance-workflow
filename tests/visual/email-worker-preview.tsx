import { createRoot } from "react-dom/client";
import { StyledEngineProvider, ThemeProvider } from "@mui/material/styles";
import { Toaster } from "sonner";
import { workflowTheme } from "@/components/workflow-ui/theme";
import { EmailWorkerDashboard } from "@/app/admin/email-worker/email-worker-dashboard";

createRoot(document.getElementById("root")!).render(
  <StyledEngineProvider enableCssLayer>
    <ThemeProvider theme={workflowTheme} defaultMode="light" storageManager={null} disableTransitionOnChange>
      <div className="app-public">
        <header className="flex flex-wrap items-center gap-3 border-b bg-card p-4">
          <strong>ตัวอย่าง Email Worker</strong>
          <span className="text-sm text-muted-foreground">ข้อมูลจำลอง · ไม่เชื่อมต่อฐานข้อมูลและไม่ส่งอีเมลจริง</span>
        </header>
        <main className="container mx-auto max-w-7xl px-4 py-8"><EmailWorkerDashboard initialQuery={window.location.search} /></main>
        <Toaster />
      </div>
    </ThemeProvider>
  </StyledEngineProvider>,
);
