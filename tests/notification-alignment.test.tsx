// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@mui/material/styles";
import { workflowTheme } from "@/components/workflow-ui/theme";
import { alignmentNotifications } from "./fixtures/ui-alignment";

const mock = vi.hoisted(() => ({ markRead: vi.fn(), clear: vi.fn(), markAll: vi.fn(), date: undefined as Date | undefined }));
vi.mock("@/lib/hooks/use-notifications", () => ({ useNotifications: () => ({
  notifications: mock.date ? alignmentNotifications.map((item) => ({ ...item, createdAt: mock.date! })) : alignmentNotifications,
  unreadCount: 1,
  isLoading: false,
  markRead: mock.markRead,
  markAllRead: mock.markAll,
  clearOne: mock.clear,
  clearAllRead: vi.fn(),
}) }));
vi.mock("@/lib/hooks/use-push-subscription", () => ({ usePushSubscription: () => ({ permission: "denied", isLoading: false, subscribe: vi.fn() }) }));
import { NotificationBell } from "@/components/notification-bell";
beforeEach(() => vi.stubGlobal("ResizeObserver", class {
  observe() {}
  unobserve() {}
  disconnect() {}
}));
afterEach(() => { cleanup(); mock.date = undefined; vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

it("shows older notification timestamps as Buddhist dates in Thailand time", async () => {
  mock.date = new Date("2026-12-31T18:00:00Z");
  vi.spyOn(Date, "now").mockReturnValue(new Date("2027-01-20T00:00:00Z").getTime());
  render(<ThemeProvider theme={workflowTheme}><NotificationBell /></ThemeProvider>);
  await userEvent.click(screen.getByRole("button", { name: /การแจ้งเตือน/ }));
  expect(screen.getAllByText("01/01/2570").length).toBeGreaterThan(0);
});

it("retains long notification content and keeps removal separate from opening the notification", async () => {
  render(<ThemeProvider theme={workflowTheme}><NotificationBell /></ThemeProvider>);
  await userEvent.click(screen.getByRole("button", { name: /การแจ้งเตือน/ }));
  const title = screen.getByText(alignmentNotifications[0].title);
  const item = title.closest('[role="menuitem"]') as HTMLElement;
  expect(screen.getByText(alignmentNotifications[0].body.trim())).toBeTruthy();
  expect(screen.getByRole("button", { name: "ล้างที่อ่านแล้ว" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "อ่านทั้งหมด" })).toBeTruthy();
  await userEvent.click(within(item).getByRole("button", { name: "ลบการแจ้งเตือน" }));
  expect(mock.clear).toHaveBeenCalledExactlyOnceWith("notification-fixture");
  expect(mock.markRead).not.toHaveBeenCalled();
  expect(mock.markAll).not.toHaveBeenCalled();
});
