"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@mui/material/styles";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { workflowTheme } from "@/components/workflow-ui/theme";
import { Toaster } from "@/components/ui/sonner";
import { PermissionsProvider } from "@/lib/hooks/use-permissions";
import { useSessionGuard } from "@/lib/hooks/use-session-guard";

function SessionGuard({ children }: { children: React.ReactNode }) {
  useSessionGuard();
  return <>{children}</>;
}

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <AppRouterCacheProvider options={{ enableCssLayer: true }}>
      <ThemeProvider
        theme={workflowTheme}
        defaultMode="light"
        modeStorageKey="theme"
        disableTransitionOnChange
      >
        <SessionProvider>
          <PermissionsProvider>
            <SessionGuard>
              {children}
              <Toaster position="top-right" richColors />
            </SessionGuard>
          </PermissionsProvider>
        </SessionProvider>
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
