// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ThemeProvider } from "@mui/material/styles";
import { workflowTheme } from "@/components/workflow-ui/theme";
import { emailDetailFixture, emailJobFixture, emailOverviewFixture, emailPageFixture } from "./fixtures/email-worker";
import type { EmailDeliveryListItem } from "@/lib/domains/email-delivery/dashboard-types";
import type { PaginatedResult, Result } from "@/lib/shared/types";

const mocks = vi.hoisted(() => ({ overview: vi.fn(), list: vi.fn(), detail: vi.fn(), retry: vi.fn(), toast: vi.fn(), auth: vi.fn(), hasRole: vi.fn(), redirect: vi.fn() }));
vi.mock("@/app/actions/email-deliveries", () => ({ getEmailWorkerOverview: mocks.overview, listEmailWorkerJobs: mocks.list, getEmailWorkerJob: mocks.detail, retryEmailDelivery: mocks.retry }));
vi.mock("sonner", () => ({ toast: { success: mocks.toast, error: mocks.toast } }));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/auth/permissions", () => ({ hasRole: mocks.hasRole }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, usePathname: () => "/admin/email-worker" }));
vi.mock("@/lib/hooks/use-permissions", () => ({ usePermissions: () => ({ hasRole: (role: string) => mocks.hasRole(role), can: () => false }) }));
import { EmailWorkerDashboard } from "@/app/admin/email-worker/email-worker-dashboard";
import EmailWorkerPage from "@/app/admin/email-worker/page";
import { AdminNav } from "@/app/admin/admin-nav";

const ok = <T,>(data: T) => ({ success: true as const, data });
type JobsResponse = Result<PaginatedResult<EmailDeliveryListItem>>;
function mount() { return render(<ThemeProvider theme={workflowTheme}><EmailWorkerDashboard initialQuery={window.location.search} /></ThemeProvider>); }
async function ready() {
  await screen.findByRole("region", { name: "ตารางงานอีเมล" });
  await waitFor(() => expect(screen.getByRole<HTMLButtonElement>("button", { name: "รีเฟรชทั้งหมด" }).disabled).toBe(false));
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }

beforeEach(() => {
  vi.resetAllMocks();
  window.history.replaceState(null, "", "/admin/email-worker");
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  mocks.overview.mockResolvedValue(ok(emailOverviewFixture));
  mocks.list.mockResolvedValue(ok(emailPageFixture([emailJobFixture()])));
  mocks.detail.mockResolvedValue(ok(emailDetailFixture()));
  mocks.retry.mockResolvedValue(ok(undefined));
  mocks.auth.mockResolvedValue({ user: { dbUserId: "admin-fixture" } });
  mocks.hasRole.mockReturnValue(true);
  mocks.redirect.mockImplementation((path: string) => { throw new Error(`redirect:${path}`); });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it("shows global queue counts, worker activity, processing counts and honest SMTP meaning", async () => {
  mocks.overview.mockResolvedValue(ok({ ...emailOverviewFixture, workers: [
    ...emailOverviewFixture.workers, { ...emailOverviewFixture.workers[0], id: "previous-worker", state: "NO_SIGNAL" },
  ] }));
  mount(); await ready();
  expect(screen.getByText(/ข้อมูลทั้งระบบ ไม่เปลี่ยนตามตัวกรอง/)).toBeTruthy();
  expect(screen.getByText(/ยังไม่ยืนยันว่าเข้ากล่องจดหมายหรืออ่านแล้ว/)).toBeTruthy();
  expect(screen.getByRole("region", { name: "รอบการทำงานของ worker" })).toBeTruthy();
  expect(screen.getByText("ครั้งที่ประมวลผล")).toBeTruthy();
  expect(screen.getByText("previous-worker").closest("details")?.open).toBe(false);
  await userEvent.click(screen.getByText("รอบ worker ก่อนหน้า (1)"));
  const previousRuns = screen.getByRole("region", { name: "รอบ worker ก่อนหน้า" });
  await userEvent.click(within(previousRuns).getByText("รายละเอียด instance"));
  expect(screen.getByText("previous-worker").closest("details")?.open).toBe(true);
  expect(screen.queryByRole("button", { name: "ลองประมวลผลใหม่" })).toBeNull();
  expect(mocks.detail).not.toHaveBeenCalled();
});

it("opens all failed jobs by resetting submitted and draft filters through the URL", async () => {
  window.history.replaceState(null, "", "/admin/email-worker?status=ACCEPTED&page=3&search=old&from=2026-09-01&to=2026-09-27");
  mount(); await ready();
  fireEvent.change(screen.getByLabelText("ค้นหางานอีเมล"), { target: { value: "unsent search" } });
  await userEvent.click(screen.getByRole("button", { name: "ดูงานล้มเหลวทั้งหมด" }));
  await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith({ page: 1, status: "FAILED", search: undefined, from: undefined, to: undefined }));
  expect(window.location.search).toBe("?status=FAILED");
  expect(screen.getByLabelText<HTMLInputElement>("ค้นหางานอีเมล").value).toBe("");
  expect(screen.getByLabelText<HTMLInputElement>("จัดคิวตั้งแต่").value).toBe("");
  expect(screen.getByLabelText<HTMLInputElement>("จัดคิวถึง").value).toBe("");
  expect(mocks.overview).toHaveBeenCalledTimes(1);
});

it("clears active filters and also resets drafts when the URL already has no filters", async () => {
  window.history.replaceState(null, "", "/admin/email-worker?status=FAILED&page=2&search=old&from=2026-09-01");
  mount(); await ready();
  await userEvent.click(screen.getByRole("button", { name: "ล้างตัวกรอง" }));
  await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith({ page: 1, status: undefined, search: undefined, from: undefined, to: undefined }));
  expect(window.location.search).toBe("");
  fireEvent.change(screen.getByLabelText("ค้นหางานอีเมล"), { target: { value: "draft" } });
  fireEvent.change(screen.getByLabelText("จัดคิวถึง"), { target: { value: "2026-09-27" } });
  await userEvent.click(screen.getByRole("button", { name: "ล้างตัวกรอง" }));
  expect(screen.getByLabelText<HTMLInputElement>("ค้นหางานอีเมล").value).toBe("");
  expect(screen.getByLabelText<HTMLInputElement>("จัดคิวถึง").value).toBe("");
});

it("preserves unfinished search and dates when refreshing the displayed jobs", async () => {
  mount(); await ready();
  fireEvent.change(screen.getByLabelText("ค้นหางานอีเมล"), { target: { value: "กำลังค้นหาหัวหน้า" } });
  fireEvent.change(screen.getByLabelText("จัดคิวตั้งแต่"), { target: { value: "2026-09-01" } });
  await userEvent.click(screen.getByRole("button", { name: "รีเฟรชทั้งหมด" }));
  await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2));
  expect(screen.getByLabelText<HTMLInputElement>("ค้นหางานอีเมล").value).toBe("กำลังค้นหาหัวหน้า");
  expect(screen.getByLabelText<HTMLInputElement>("จัดคิวตั้งแต่").value).toBe("2026-09-01");
  expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ search: undefined, from: undefined }));
});

it("shows actionable mobile rows and copies the full job ID rather than its abbreviation", async () => {
  vi.stubGlobal("matchMedia", vi.fn((query: string) => ({ matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })));
  const user = userEvent.setup();
  const copy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
  const id = "delivery-with-a-long-identifier-0123456789abcdef";
  mocks.list.mockResolvedValue(ok(emailPageFixture([emailJobFixture({ id })])));
  mocks.detail.mockResolvedValue(ok(emailDetailFixture({ id })));
  mount();
  const mobile = await screen.findByRole("region", { name: "รายการงานอีเมลบนมือถือ" });
  expect(screen.queryByRole("table")).toBeNull();
  expect(within(mobile).getByText("historical@example.test")).toBeTruthy();
  await user.click(within(mobile).getByRole("button", { name: "คัดลอกรหัสงาน" }));
  expect(copy).toHaveBeenCalledExactlyOnceWith(id);
  await user.click(within(mobile).getByRole("button", { name: `รายละเอียดงาน ${id}` }));
  await screen.findByRole("dialog", { name: "รายละเอียดงานอีเมล" });
  await waitFor(() => expect(mocks.detail).toHaveBeenCalledWith(id, 1));
});

it("persists search, dates and pagination and restores filters with browser history", async () => {
  window.history.replaceState(null, "", "/admin/email-worker?status=FAILED&page=2&search=old&from=2026-09-01&to=2026-09-27");
  mount(); await ready();
  expect(mocks.list).toHaveBeenCalledWith({ status: "FAILED", page: 2, search: "old", from: "2026-09-01", to: "2026-09-27" });
  fireEvent.change(screen.getByLabelText("ค้นหางานอีเมล"), { target: { value: "new@example.test" } });
  await userEvent.click(screen.getByRole("button", { name: "ค้นหา" }));
  await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ search: "new@example.test", page: 1 })));
  expect(new URLSearchParams(window.location.search).get("status")).toBe("FAILED");
  expect(new URLSearchParams(window.location.search).get("from")).toBe("2026-09-01");
  await act(async () => { window.history.replaceState(null, "", "/admin/email-worker?status=ACCEPTED&search=restored&page=3"); window.dispatchEvent(new PopStateEvent("popstate")); });
  await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ status: "ACCEPTED", search: "restored", page: 3 })));
  expect(screen.getByDisplayValue("restored")).toBeTruthy();
});

it("serializes query changes, discards stale results and leaves inputs enabled while reading", async () => {
  const first = deferred<JobsResponse>();
  mocks.list.mockReturnValueOnce(first.promise).mockResolvedValueOnce(ok(emailPageFixture([emailJobFixture({ id: "new-job", recipientEmail: "new@example.test" })])));
  mount();
  const search = screen.getByLabelText<HTMLInputElement>("ค้นหางานอีเมล");
  expect(search.disabled).toBe(false);
  fireEvent.change(search, { target: { value: "new@example.test" } });
  await userEvent.click(screen.getByRole("button", { name: "ค้นหา" }));
  expect(mocks.list).toHaveBeenCalledTimes(1);
  await act(async () => first.resolve(ok(emailPageFixture([emailJobFixture({ recipientEmail: "stale@example.test" })]))));
  await screen.findByText("new@example.test");
  expect(screen.queryByText("stale@example.test")).toBeNull();
  expect(mocks.list).toHaveBeenCalledTimes(2);
});

it("keeps successful data on a fetch failure and recovers using the enabled refresh control", async () => {
  mount(); await ready();
  mocks.list.mockRejectedValueOnce(new Error("transport"));
  await userEvent.click(screen.getByRole("button", { name: "รีเฟรชทั้งหมด" }));
  await screen.findByRole("alert");
  await ready();
  expect(screen.getByText("historical@example.test")).toBeTruthy();
  mocks.list.mockResolvedValue(ok(emailPageFixture([emailJobFixture({ recipientEmail: "recovered@example.test" })])));
  await userEvent.click(screen.getByRole("button", { name: "รีเฟรชทั้งหมด" }));
  await screen.findByText("recovered@example.test");
  expect(screen.queryByRole("alert")).toBeNull();
});

it("loads drawer details lazily, distinguishes historical/current recipients and audits a manual retry", async () => {
  mount(); await ready();
  await userEvent.click(screen.getByRole("button", { name: "รายละเอียดงาน delivery-fixture" }));
  const dialog = await screen.findByRole("dialog", { name: "รายละเอียดงานอีเมล" });
  await within(dialog).findByText("เปิดข้อมูลผู้รับและใบสั่งปัจจุบัน");
  await userEvent.click(within(dialog).getByText("เปิดข้อมูลผู้รับและใบสั่งปัจจุบัน"));
  expect(within(dialog).getByText("current@example.test").closest("details")?.open).toBe(true);
  expect(within(dialog).getByText("ข้อมูลที่บันทึกเมื่อเข้าคิว")).toBeTruthy();
  expect(within(dialog).getByRole("heading", { name: /ประวัติการประมวลผลและจัดคิว/ }).compareDocumentPosition(within(dialog).getByText("ข้อมูลที่บันทึกเมื่อเข้าคิว")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(within(dialog).getByText("ผู้รับที่ใช้ในครั้งนี้: historical@example.test")).toBeTruthy();
  expect(new URLSearchParams(window.location.search).get("deliveryId")).toBe("delivery-fixture");
  const retryRequest = deferred<Result<void>>();
  mocks.retry.mockReturnValueOnce(retryRequest.promise);
  mocks.detail.mockResolvedValue(ok(emailDetailFixture({ status: "PENDING", canRetry: false })));
  await userEvent.click(within(dialog).getByRole("button", { name: "ลองประมวลผลใหม่" }));
  await waitFor(() => expect(mocks.retry).toHaveBeenCalledExactlyOnceWith("delivery-fixture"));
  const reads = [mocks.overview.mock.calls.length, mocks.list.mock.calls.length, mocks.detail.mock.calls.length];
  await act(async () => document.dispatchEvent(new Event("visibilitychange")));
  expect([mocks.overview.mock.calls.length, mocks.list.mock.calls.length, mocks.detail.mock.calls.length]).toEqual(reads);
  await act(async () => retryRequest.resolve(ok(undefined)));
  await within(dialog).findByText("รอส่ง");
  await userEvent.click(within(dialog).getByRole("button", { name: "ปิด" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(new URLSearchParams(window.location.search).has("deliveryId")).toBe(false);
});

it("does not turn a recovered worker's historical error into a current problem", async () => {
  mocks.overview.mockResolvedValue(ok({ ...emailOverviewFixture, failedCount: 0, workers: [{
    ...emailOverviewFixture.workers[0], state: "IDLE", currentDeliveryId: null, lastErrorCode: "DATABASE_CONNECTION_FAILED",
  }] }));
  mount(); await ready();
  expect(screen.queryByText(/worker ที่มีปัญหา/)).toBeNull();
  expect(screen.getByText("พร้อมรับงาน")).toBeTruthy();
  const oldError = screen.getByText(/worker เชื่อมต่อฐานข้อมูลไม่สำเร็จ/);
  expect(oldError.closest("details")?.open).toBe(false);
});

it("labels manual requeue events separately from processing attempts", async () => {
  const job = emailDetailFixture();
  mocks.detail.mockResolvedValue(ok(emailDetailFixture({ status: "PENDING", cycleAttemptCount: 0, canRetry: false, attempts: emailPageFixture([
    { ...job.attempts.data[0], id: "manual-event", attemptNumber: 0, outcome: "MANUAL_RETRY", requestedById: "admin", requestedByName: "ผู้ดูแลระบบ", errorCode: null },
    ...job.attempts.data,
  ]) })));
  window.history.replaceState(null, "", "/admin/email-worker?deliveryId=delivery-fixture");
  mount();
  const dialog = await screen.findByRole("dialog", { name: "รายละเอียดงานอีเมล" });
  await within(dialog).findByText("ผู้ดูแลจัดคิวใหม่");
  expect(within(dialog).getByText("อีเมลที่บันทึกขณะจัดคิวใหม่: historical@example.test")).toBeTruthy();
  expect(within(dialog).queryByText("ประมวลผลครั้งที่ 0")).toBeNull();
  expect(within(dialog).getByText("ประมวลผลครั้งที่ 6")).toBeTruthy();
});

it("restores deep-linked attempt pages and labels missing legacy snapshots", async () => {
  window.history.replaceState(null, "", "/admin/email-worker?deliveryId=delivery-fixture&attemptPage=2");
  mocks.detail.mockResolvedValue(ok(emailDetailFixture({ contextSnapshot: null, attempts: emailPageFixture([], 2, 26) })));
  mount();
  const dialog = await screen.findByRole("dialog", { name: "รายละเอียดงานอีเมล" });
  await within(dialog).findByText(/งานเดิมนี้ไม่มีข้อมูลย้อนหลัง/);
  expect(mocks.detail).toHaveBeenCalledWith("delivery-fixture", 2);
  await userEvent.click(within(dialog).getByRole("button", { name: "Previous page" }));
  expect(document.activeElement).toBe(within(dialog).getByRole("heading", { name: /ประวัติการประมวลผลและจัดคิว/ }));
  await waitFor(() => expect(mocks.detail).toHaveBeenLastCalledWith("delivery-fixture", 1));
  expect(new URLSearchParams(window.location.search).has("attemptPage")).toBe(false);
});

it("clears protected data when a refresh loses authorization", async () => {
  mount(); await ready();
  mocks.overview.mockResolvedValue({ success: false, code: "PERMISSION_DENIED", error: "denied" });
  await userEvent.click(screen.getByRole("button", { name: "รีเฟรชทั้งหมด" }));
  await screen.findByText(/เซสชันหมดอายุหรือไม่มีสิทธิ์/);
  expect(screen.queryByText("historical@example.test")).toBeNull();
  expect(screen.queryByRole("region", { name: "รอบการทำงานของ worker" })).toBeNull();
});

it("polls only while visible and never overlaps a pending poll", async () => {
  vi.useFakeTimers();
  const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  const view = mount();
  await act(async () => { await Promise.resolve(); });
  expect(mocks.list).toHaveBeenCalledTimes(1);
  const pending = deferred<JobsResponse>();
  mocks.list.mockReturnValueOnce(pending.promise);
  await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
  expect(mocks.list).toHaveBeenCalledTimes(2);
  await act(async () => { await vi.advanceTimersByTimeAsync(45_000); });
  expect(mocks.list).toHaveBeenCalledTimes(2);
  await act(async () => pending.resolve(ok(emailPageFixture([emailJobFixture()]))));
  visibility.mockReturnValue("hidden");
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
  expect(mocks.list).toHaveBeenCalledTimes(2);
  visibility.mockReturnValue("visible");
  await act(async () => document.dispatchEvent(new Event("visibilitychange")));
  expect(mocks.list).toHaveBeenCalledTimes(3);
  view.unmount();
  await vi.advanceTimersByTimeAsync(30_000);
  expect(mocks.list).toHaveBeenCalledTimes(3);
});

it("guards the page and navigation for super-admin only", async () => {
  mocks.auth.mockResolvedValue(null);
  await expect(EmailWorkerPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("redirect:/api/auth/signin");
  mocks.auth.mockResolvedValue({ user: { dbUserId: "ordinary-admin" } });
  mocks.hasRole.mockReturnValue(false);
  await expect(EmailWorkerPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("redirect:/dashboard");
  const view = render(<ThemeProvider theme={workflowTheme}><AdminNav /></ThemeProvider>);
  expect(screen.queryByRole("tab", { name: "Email Worker" })).toBeNull();
  mocks.hasRole.mockReturnValue(true);
  view.rerender(<ThemeProvider theme={workflowTheme}><AdminNav /></ThemeProvider>);
  expect(screen.getByRole("tab", { name: "Email Worker" }).getAttribute("href")).toBe("/admin/email-worker");
});
