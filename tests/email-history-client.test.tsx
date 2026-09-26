// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@mui/material/styles";
import { workflowTheme } from "@/components/workflow-ui/theme";
import type { EmailDeliveryView } from "@/lib/domains/email-delivery/types";

const mocks = vi.hoisted(() => ({ list: vi.fn(), retry: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("@/app/actions/email-deliveries", () => ({ listEmailDeliveries: mocks.list, retryEmailDelivery: mocks.retry }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));
import { EmailHistoryClient } from "@/app/admin/notifications/email-history-client";
import { NotificationsAdminTabs } from "@/app/admin/notifications/notifications-tabs";

function delivery(overrides: Partial<EmailDeliveryView> = {}): EmailDeliveryView {
  return {
    id: "delivery-failed", expenseClaimId: "claim-1", leaderUserId: "leader-1", recipientEmail: "leader@example.test",
    status: "FAILED", attemptCount: 6, createdAt: new Date("2026-12-31T18:00:00Z"), acceptedAt: null,
    nextAttemptAt: null, lastErrorCode: "SMTP_TEMPORARY_REJECTION", canRetry: true,
    attempts: [{ id: "attempt-1", attemptNumber: 6, recipientEmail: "leader@example.test", startedAt: new Date("2026-12-31T18:00:00Z"), finishedAt: new Date("2026-12-31T18:00:01Z"), outcome: "RETRY_WAIT", errorCode: "SMTP_TEMPORARY_REJECTION", requestedById: "admin-1" }],
    ...overrides,
  };
}

function response(data: EmailDeliveryView[] = [delivery()], page = 1) {
  return { success: true, data: { data, pagination: { page, pageSize: 20, total: 21, totalPages: 2, hasPrevious: page > 1, hasNext: page < 2 } } };
}

function mount() {
  return render(<ThemeProvider theme={workflowTheme}><EmailHistoryClient /></ThemeProvider>);
}

async function waitForReady() {
  await screen.findByRole("region", { name: "ประวัติการส่งอีเมล" });
  await waitFor(() => expect((screen.getByRole("button", { name: "รีเฟรช" }) as HTMLButtonElement).disabled).toBe(false));
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.list.mockResolvedValue(response());
  mocks.retry.mockResolvedValue({ success: true, data: undefined });
});
afterEach(cleanup);

it("labels SMTP acceptance honestly, uses Thai local dates, and limits retry to eligible failed jobs", async () => {
  mocks.list.mockResolvedValue(response([
    delivery(),
    delivery({ id: "accepted", expenseClaimId: "claim-2", status: "ACCEPTED", canRetry: false, acceptedAt: new Date("2026-12-31T18:00:00Z"), lastErrorCode: null, attempts: [] }),
    delivery({ id: "obsolete", expenseClaimId: "claim-3", canRetry: false, attempts: [] }),
  ]));
  mount();
  const region = await screen.findByRole("region", { name: "ประวัติการส่งอีเมล" });
  expect(region.tabIndex).toBe(0);
  expect(within(region).getByText("SMTP รับแล้ว")).toBeTruthy();
  expect(screen.getByText(/ยังไม่ยืนยันว่าเข้ากล่องจดหมายหรืออ่านแล้ว/)).toBeTruthy();
  expect(within(region).getAllByText(/1 มกราคม 2570/).length).toBeGreaterThan(0);
  expect(screen.getAllByRole("button", { name: /^ลองส่งใหม่/ })).toHaveLength(1);
  expect(screen.getByText("ลองใหม่ได้เมื่อคำขอยังรอยืนยันและข้อมูลผู้รับพร้อมใช้งาน")).toBeTruthy();
});

it("submits server search filters and resets pagination when a status changes", async () => {
  mount();
  await waitForReady();
  mocks.list.mockResolvedValue(response([delivery()], 2));
  await userEvent.click(screen.getByRole("button", { name: "Next page" }));
  await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith({ page: 2, search: "" }));
  await waitForReady();
  mocks.list.mockResolvedValue(response());
  await userEvent.click(screen.getByRole("combobox", { name: "สถานะการส่ง" }));
  await userEvent.click(screen.getByRole("option", { name: "ส่งไม่สำเร็จ" }));
  await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith({ page: 1, search: "", status: "FAILED" }));
  await waitForReady();
  fireEvent.change(screen.getByRole("textbox", { name: "ค้นหาอีเมลหรือรหัสเอกสาร" }), { target: { value: " leader@example.test " } });
  await userEvent.click(screen.getByRole("button", { name: "ค้นหา" }));
  await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith({ page: 1, search: "leader@example.test", status: "FAILED" }));
});

it("queues one manual retry while pending and refreshes history after success", async () => {
  let finish!: (value: { success: true; data: undefined }) => void;
  mocks.retry.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  mount();
  await waitForReady();
  const button = await screen.findByRole("button", { name: /^ลองส่งใหม่/ });
  await userEvent.click(button);
  expect((button as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(button);
  expect(mocks.retry).toHaveBeenCalledExactlyOnceWith("delivery-failed");
  mocks.list.mockResolvedValue(response([delivery({ status: "PENDING", canRetry: false })]));
  await act(async () => finish({ success: true, data: undefined }));
  await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2));
  expect(mocks.success).toHaveBeenCalledWith("จัดคิวอีเมลเพื่อลองส่งใหม่แล้ว");
  await screen.findByText("รอส่ง");
});

it("keeps the row on retry rejection and makes safe history details available", async () => {
  mocks.retry.mockResolvedValue({ success: false, error: "คำขอหมดอายุ" });
  mount();
  await waitForReady();
  await userEvent.click(await screen.findByRole("button", { name: /^ลองส่งใหม่/ }));
  expect(mocks.error).toHaveBeenCalledWith("ยังไม่สามารถลองส่งใหม่ได้", { description: "คำขอหมดอายุ" });
  expect(screen.getByText("เอกสาร: claim-1")).toBeTruthy();
  fireEvent.click(screen.getByText("ประวัติการส่งและการจัดคิว (1)"));
  expect(screen.getByText("ผู้สั่งลองใหม่: admin-1")).toBeTruthy();
  expect(screen.getAllByText("เซิร์ฟเวอร์อีเมลขัดข้องชั่วคราว")).toHaveLength(2);
});

it("shows fetch errors with a refresh path and does not render raw SMTP errors", async () => {
  mocks.list.mockRejectedValueOnce(new Error("transport"));
  mount();
  expect(await screen.findByRole("alert")).toBeTruthy();
  mocks.list.mockResolvedValue(response([delivery({ lastErrorCode: "smtp://secret:password@host", attempts: [] })]));
  await userEvent.click(screen.getByRole("button", { name: "รีเฟรช" }));
  await screen.findByRole("region", { name: "ประวัติการส่งอีเมล" });
  expect(screen.queryByText(/secret:password/)).toBeNull();
  expect(screen.getByText("ไม่สามารถดำเนินการได้ กรุณาตรวจสอบการตั้งค่าและผู้รับ")).toBeTruthy();
});

it("loads email history only when selected and preserves the compose form when switching tabs", async () => {
  render(<ThemeProvider theme={workflowTheme}><NotificationsAdminTabs><input aria-label="ข้อความเดิม" defaultValue="ร่างเดิม" /></NotificationsAdminTabs></ThemeProvider>);
  const compose = screen.getByRole("textbox", { name: "ข้อความเดิม" });
  fireEvent.change(compose, { target: { value: "ข้อความที่ยังไม่ส่ง" } });
  expect(mocks.list).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("tab", { name: "ประวัติอีเมล" }));
  await screen.findByRole("region", { name: "ประวัติการส่งอีเมล" });
  await userEvent.click(screen.getByRole("tab", { name: "ส่งการแจ้งเตือน" }));
  expect((screen.getByRole("textbox", { name: "ข้อความเดิม" }) as HTMLInputElement).value).toBe("ข้อความที่ยังไม่ส่ง");
});
