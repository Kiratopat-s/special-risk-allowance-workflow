import type { Metadata } from "next";
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import { Providers } from "@/components/providers";
import { AppShell } from "@/components/workflow-ui/app-shell";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import "./globals.css";

export const metadata: Metadata = {
  title: "Special Risk Allowance Workflow",
  description: "Special Risk Allowance Workflow for PEA employees",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className="antialiased min-h-screen flex flex-col">
        <InitColorSchemeScript
          attribute="class"
          defaultMode="light"
          modeStorageKey="theme"
        />
        <Providers>
          <ServiceWorkerRegistration />
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
