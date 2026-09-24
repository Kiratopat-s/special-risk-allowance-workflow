import { createRoot } from "react-dom/client";
import { StyledEngineProvider, ThemeProvider } from "@mui/material/styles";
import { Toaster } from "sonner";
import { workflowTheme } from "@/components/workflow-ui/theme";
import { ThemeToggle } from "@/components/theme-toggle";
import { ExpenseClaimDocumentClient } from "@/app/expense-claim-document/expense-claim-document-client";
import { claimEditorItems, claimEditorPagination } from "./claim-editor-mocks";

function Preview() {
  return (
    <div className="app-public min-h-screen">
      <header className="flex flex-wrap items-center gap-3 border-b bg-card p-4">
        <div className="min-w-0 flex-1">
          <strong>แก้ไขเอกสารขอเบิก · ข้อมูลจำลอง</strong>
          <p className="mt-1 text-sm text-muted-foreground">
            ก.ย. 2569 · ร่าง / รอหัวหน้ายืนยัน / รอรวบรวม / รวบรวมแล้ว
          </p>
        </div>
        <ThemeToggle />
      </header>
      <main className="mx-auto max-w-[1440px] p-4 sm:p-6">
        <ExpenseClaimDocumentClient
          initialItems={claimEditorItems}
          initialPagination={claimEditorPagination}
          initialViewId={null}
          currentUserDisplayName="ผู้เบิก ตัวอย่าง"
          currentUserClaimantPositionAtSubmission="พชง. (อส) 5"
        />
      </main>
      <Toaster />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StyledEngineProvider enableCssLayer>
    <ThemeProvider theme={workflowTheme} defaultMode="light" storageManager={null} disableTransitionOnChange>
      <Preview />
    </ThemeProvider>
  </StyledEngineProvider>,
);
