import { createRoot } from "react-dom/client";
import { StyledEngineProvider, ThemeProvider } from "@mui/material/styles";
import { Tab, Tabs } from "@mui/material";
import { Bell, Building2, Key, Mail, Shield, Users } from "lucide-react";
import { Toaster } from "sonner";
import { workflowTheme } from "@/components/workflow-ui/theme";
import { EmailWorkerDashboard } from "@/app/admin/email-worker/email-worker-dashboard";

const dark = new URLSearchParams(window.location.search).get("theme") === "dark";
document.documentElement.classList.toggle("dark", dark);
const tabs = [
  ["บทบาท", Shield], ["ผู้ใช้งาน", Users], ["หน่วยงาน", Building2],
  ["สิทธิ์การใช้งาน", Key], ["การแจ้งเตือน", Bell], ["Email Worker", Mail],
] as const;

// Match the existing admin shell's available width and vertical spacing without
// importing auth, navigation hooks, presence subscriptions or other server code.
createRoot(document.getElementById("root")!).render(
  <StyledEngineProvider enableCssLayer>
    <ThemeProvider theme={workflowTheme} defaultMode={dark ? "dark" : "light"} storageManager={null} disableTransitionOnChange>
      <div className="app-workspace">
        <aside className="desktop-sidebar" aria-label="ตัวอย่างเมนูระบบ">
          <div className="workspace-brand"><span className="brand-mark">s.</span><div>SRAW<small>Special Risk Allowance Workflow</small></div></div>
          <div className="workspace-nav"><span className="px-4 py-3 text-sm">จัดการระบบ</span></div>
          <p className="sidebar-note">ข้อมูลจำลองสำหรับตรวจหน้าจอ<br />ไม่เชื่อมต่อฐานข้อมูลหรือส่งอีเมล</p>
        </aside>
        <div className="workspace-body">
          <header className="workspace-header">
            <div className="flex min-w-0 items-center gap-3"><span className="hidden text-sm text-muted-foreground sm:inline">SRAW /</span><span className="text-sm font-semibold">จัดการระบบ</span></div>
            <span className="text-xs text-muted-foreground">ข้อมูลจำลอง</span>
          </header>
          <main id="main" className="min-w-0 flex-1">
            <div className="container mx-auto max-w-7xl px-4 py-8">
              <div className="space-y-6">
                <div className="page-heading"><div><div className="eyebrow">ADMINISTRATION</div><h1>จัดการระบบ</h1><p className="text-sm text-muted-foreground">จัดการผู้ใช้งาน บทบาท หน่วยงาน และสิทธิ์การเข้าถึง</p></div></div>
                <Tabs value={5} variant="scrollable" scrollButtons="auto" aria-label="ส่วนจัดการระบบ" className="mb-6 border-b">
                  {tabs.map(([label, Icon], index) => <Tab key={label} value={index} label={label} icon={<Icon size={16} />} iconPosition="start" sx={{ minHeight: 52, textTransform: "none" }} />)}
                </Tabs>
                <div><EmailWorkerDashboard initialQuery={window.location.search} /></div>
              </div>
            </div>
          </main>
        </div>
        <Toaster theme={dark ? "dark" : "light"} />
      </div>
    </ThemeProvider>
  </StyledEngineProvider>,
);
