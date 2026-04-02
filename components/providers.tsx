"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
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
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <SessionProvider>
        <SessionGuard>
          {children}
          <Toaster position="top-right" richColors />
        </SessionGuard>
      </SessionProvider>
    </ThemeProvider>
  );
}
