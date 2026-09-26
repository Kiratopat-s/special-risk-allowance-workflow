import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), hasRole: vi.fn(), list: vi.fn(), retry: vi.fn(), users: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/auth/permissions", () => ({ hasRole: mocks.hasRole }));
vi.mock("@/lib/domains/email-delivery", () => ({ emailDeliveryService: { list: mocks.list, retry: mocks.retry } }));
vi.mock("@/app/actions/permissions", () => ({ listUsersWithRoles: mocks.users }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/app/admin/notifications/notifications-client", () => ({ NotificationsAdminClient: () => null }));
vi.mock("@/app/admin/notifications/notifications-tabs", () => ({ NotificationsAdminTabs: () => null }));

import { listEmailDeliveries, retryEmailDelivery } from "@/app/actions/email-deliveries";
import AdminNotificationsPage from "@/app/admin/notifications/page";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { dbUserId: "session-admin" } });
  mocks.hasRole.mockResolvedValue(true);
  mocks.list.mockResolvedValue({ success: true, data: { data: [], pagination: {} } });
  mocks.retry.mockResolvedValue({ success: true, data: undefined });
  mocks.users.mockResolvedValue({ success: true, data: [] });
  mocks.redirect.mockImplementation((path: string) => { throw new Error(`redirect:${path}`); });
});

it("rejects unauthenticated history reads and retries before reaching the service", async () => {
  mocks.auth.mockResolvedValue(null);
  expect(await listEmailDeliveries()).toMatchObject({ success: false, code: "UNAUTHORIZED" });
  expect(await retryEmailDelivery("delivery-id")).toMatchObject({ success: false, code: "UNAUTHORIZED" });
  expect(mocks.hasRole).not.toHaveBeenCalled();
  expect(mocks.list).not.toHaveBeenCalled();
  expect(mocks.retry).not.toHaveBeenCalled();
});

it("requires super-admin independently for both actions even with an authenticated account", async () => {
  mocks.hasRole.mockResolvedValue(false);
  expect(await listEmailDeliveries()).toMatchObject({ success: false, code: "PERMISSION_DENIED" });
  expect(await retryEmailDelivery("delivery-id")).toMatchObject({ success: false, code: "PERMISSION_DENIED" });
  expect(mocks.hasRole).toHaveBeenCalledWith("session-admin", "super-admin");
  expect(mocks.list).not.toHaveBeenCalled();
  expect(mocks.retry).not.toHaveBeenCalled();
});

it("normalizes allowed filters and attributes manual retries to the session identity", async () => {
  await listEmailDeliveries({ page: 2, status: "FAILED", search: " leader@example.test " });
  expect(mocks.list).toHaveBeenCalledExactlyOnceWith({ page: 2, status: "FAILED", search: "leader@example.test" });
  await retryEmailDelivery(" delivery-id ");
  expect(mocks.retry).toHaveBeenCalledExactlyOnceWith("delivery-id", "session-admin");
});

it("validates untrusted pagination, status, search, and delivery ids without querying", async () => {
  for (const page of [0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
    expect(await listEmailDeliveries({ page })).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
  }
  expect(await listEmailDeliveries({ status: "INBOX" as never })).toMatchObject({ success: false });
  expect(await listEmailDeliveries({ search: "x".repeat(201) })).toMatchObject({ success: false });
  expect(await retryEmailDelivery(" ")).toMatchObject({ success: false });
  expect(await retryEmailDelivery(null as never)).toMatchObject({ success: false });
  expect(mocks.list).not.toHaveBeenCalled();
  expect(mocks.retry).not.toHaveBeenCalled();
});

it("preserves service rejection when a failed job no longer qualifies for retry", async () => {
  mocks.retry.mockResolvedValue({ success: false, error: "คำขอหมดอายุ", code: "NOT_RETRYABLE" });
  expect(await retryEmailDelivery("delivery-id")).toEqual({ success: false, error: "คำขอหมดอายุ", code: "NOT_RETRYABLE" });
});

it("guards the page before fetching users or rendering the email history tab", async () => {
  mocks.auth.mockResolvedValue(null);
  await expect(AdminNotificationsPage()).rejects.toThrow("redirect:/api/auth/signin");
  expect(mocks.users).not.toHaveBeenCalled();
  mocks.auth.mockResolvedValue({ user: { dbUserId: "ordinary-admin" } });
  mocks.hasRole.mockResolvedValue(false);
  await expect(AdminNotificationsPage()).rejects.toThrow("redirect:/dashboard");
  expect(mocks.users).not.toHaveBeenCalled();
});

it("renders the notification tabs for a super-admin", async () => {
  expect(await AdminNotificationsPage()).toBeTruthy();
  expect(mocks.users).toHaveBeenCalledOnce();
});
