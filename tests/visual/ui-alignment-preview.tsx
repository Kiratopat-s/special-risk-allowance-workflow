import { useState } from "react";
import { createRoot } from "react-dom/client";
import { StyledEngineProvider, ThemeProvider } from "@mui/material/styles";
import { workflowTheme } from "@/components/workflow-ui/theme";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { Button } from "@/components/workflow-ui/button";
import { Dialog, DialogBody, DialogClose, DialogFooter, DialogHeader, DialogTitle } from "@/components/workflow-ui/dialog";
import { RolesClient } from "@/app/admin/roles/roles-client";
import { UsersClient } from "@/app/admin/users/users-client";
import { DepartmentsClient } from "@/app/admin/departments/departments-client";
import { PermissionsClient } from "@/app/admin/permissions/permissions-client";
import { MrcClient } from "@/app/monthly-request-collection/monthly-request-collection-client";
import { OffSiteWorkClient } from "@/app/off-site-work/off-site-work-client";
import { alignmentDepartments, alignmentPermissions, alignmentRoles, alignmentUsers } from "../fixtures/ui-alignment";

function Preview() {
  const [scene, setScene] = useState("Roles");
  const [dialog, setDialog] = useState(false);
  return <div className="app-public">
    <header className="flex flex-wrap items-center gap-3 border-b bg-card p-4">
      <strong>UI alignment fixtures</strong>
      <span className="text-sm text-muted-foreground">Local sample data · all server actions mocked</span>
      <div className="ml-auto flex gap-2"><ThemeToggle /><NotificationBell /></div>
    </header>
    <nav className="flex flex-wrap gap-2 p-4" aria-label="Fixture scenes">
      {["Roles", "Users", "Departments", "Permissions", "Collections", "Off-site work"].map((name) => <Button key={name} variant={scene === name ? "default" : "outline"} onClick={() => setScene(name)}>{name}</Button>)}
      <Button onClick={() => setDialog(true)}>Long dialog</Button>
    </nav>
    <main className="mx-auto max-w-[1600px] p-4" key={scene}>
      {scene === "Roles" && <RolesClient initialRoles={alignmentRoles} allPermissions={alignmentPermissions} />}
      {scene === "Users" && <UsersClient initialUsers={alignmentUsers} allRoles={alignmentRoles} allDepartments={alignmentDepartments} />}
      {scene === "Departments" && <DepartmentsClient initialDepartments={alignmentDepartments} />}
      {scene === "Permissions" && <PermissionsClient permissions={alignmentPermissions} />}
      {scene === "Collections" && <MrcClient initialItems={[]} initialPagination={null} canManage canHpa={false} canRk={false} canDrt={false} />}
      {scene === "Off-site work" && <OffSiteWorkClient initialItems={[]} initialPagination={null} />}
    </main>
    <Dialog open={dialog} onClose={() => setDialog(false)}>
      <DialogClose onClose={() => setDialog(false)} />
      <DialogHeader><DialogTitle>ตรวจสอบการจัดวางหัวข้อที่ยาวและปุ่มปิดสำหรับเอกสารประจำหน่วยงาน</DialogTitle></DialogHeader>
      <DialogBody>{Array.from({ length: 20 }, (_, i) => <p className="mb-4" key={i}>ข้อความตัวอย่าง {i + 1} สำหรับตรวจสอบการเลื่อนเฉพาะเนื้อหาและการคงตำแหน่งของปุ่มดำเนินการ</p>)}</DialogBody>
      <DialogFooter><Button onClick={() => setDialog(false)}>Close fixture</Button></DialogFooter>
    </Dialog>
  </div>;
}
createRoot(document.getElementById("root")!).render(
  <StyledEngineProvider enableCssLayer>
    <ThemeProvider theme={workflowTheme} defaultMode="light" storageManager={null} disableTransitionOnChange>
      <Preview />
    </ThemeProvider>
  </StyledEngineProvider>,
);
