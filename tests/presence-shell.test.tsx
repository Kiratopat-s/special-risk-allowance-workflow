// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { workflowTheme } from "@/components/workflow-ui/theme";

const mock = vi.hoisted(() => ({
  session: { user: { id: "keycloak-a", dbUserId: "user-a", name: "Test User" } },
  update: vi.fn(),
  query: new URLSearchParams(),
}));
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: mock.session, status: "authenticated", update: mock.update }),
  signIn: vi.fn(), signOut: vi.fn(),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard", useSearchParams: () => mock.query }));
vi.mock("@/lib/hooks/use-permissions", () => ({
  usePermissions: () => ({ permissions: { permissions: [] }, canAny: () => false, can: () => false, hasRole: () => false }),
}));
vi.mock("@/components/notification-bell", () => ({ NotificationBell: () => null }));
vi.mock("@/components/footer", () => ({ Footer: () => null }));
vi.mock("@/components/theme-toggle", () => ({ ThemeToggle: () => null }));

import { PresenceProvider } from "@/components/presence-provider";
import { AppShell } from "@/components/workflow-ui/app-shell";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("shares one heartbeat across desktop navigation, mobile drawer, and page changes", async () => {
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  const fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify({
    success: true, data: { count: 1000, measuredAt: new Date().toISOString() },
  }), { status: 200, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetch);
  const shell = (content: string) => (
    <ThemeProvider theme={workflowTheme}>
      <PresenceProvider><AppShell><p>{content}</p></AppShell></PresenceProvider>
    </ThemeProvider>
  );
  const { rerender } = render(shell("First page"));
  await waitFor(() => expect(screen.getAllByText("1,000 คน")).toHaveLength(1));
  expect(fetch).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "เปิดเมนู" }));
  await waitFor(() => expect(screen.getAllByText("1,000 คน")).toHaveLength(2));
  expect(fetch).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "ปิดเมนู" }));
  await act(async () => { rerender(shell("Second page")); });
  expect(fetch).toHaveBeenCalledTimes(1);
});
