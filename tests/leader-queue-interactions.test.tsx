// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@mui/material/styles";
import { workflowTheme } from "@/components/workflow-ui/theme";
import type { LeaderClaimDetail, LeaderVerificationQueueItem } from "@/lib/domains/leader-verification";
import type { Result } from "@/lib/shared/types";
import {
  leaderQueueClaimDetail,
  leaderQueueItems,
  leaderQueueSignature,
  secondLeaderQueueClaimDetail,
} from "./fixtures/leader-queue";

const mock = vi.hoisted(() => ({ detail: vi.fn(), verify: vi.fn(), toast: vi.fn() }));
vi.mock("@/app/actions/leader-verify", () => ({
  getMyVerificationClaimDetail: mock.detail,
  verifyAsLeader: mock.verify,
}));
vi.mock("sonner", () => ({ toast: { success: mock.toast, error: mock.toast } }));

import { PendingVerificationsClient } from "@/app/leader-verify/pending/pending-client";

const firstClaimName = "ผู้ยื่นทดสอบ คนแรก · กันยายน 2569";
const secondClaimName = "ผู้ยื่นทดสอบ คนที่สอง · กันยายน 2569";
function queueUi(items: LeaderVerificationQueueItem[], signature: string | null = leaderQueueSignature) {
  return (
    <ThemeProvider theme={workflowTheme}>
      <PendingVerificationsClient initialItems={items} existingSignatureDataUrl={signature} />
    </ThemeProvider>
  );
}
function mount(items: LeaderVerificationQueueItem[] = leaderQueueItems, signature: string | null = leaderQueueSignature) {
  return render(queueUi(items, signature));
}
function firstClaim() {
  return screen.getByRole("article", { name: firstClaimName });
}
function detailsButton(name = firstClaimName) {
  return within(screen.getByRole("article", { name })).getByRole("button", { name: "ดูรายละเอียดคำขอ" });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}
beforeEach(() => {
  vi.clearAllMocks();
  mock.detail.mockResolvedValue({ success: true, data: leaderQueueClaimDetail });
  mock.verify.mockResolvedValue({ success: true, data: { allVerified: false } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("leader queue document review", () => {
  it("groups orders into one claim card and shows claimed dates before fetching details", () => {
    mount();
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.getByText("2 เอกสาร · 3 รายการรอยืนยัน")).toBeTruthy();
    const claim = within(firstClaim());
    expect(claim.getByRole("region", { name: "คำสั่ง ทดสอบ 001/2569" })).toBeTruthy();
    expect(claim.getByRole("region", { name: "คำสั่ง ทดสอบ 002/2569" })).toBeTruthy();
    expect(claim.getByText(/3–5, 10, 17 ก\.ย\./)).toBeTruthy();
    const calendar = within(claim.getByRole("table", { name: "ปฏิทินวันที่ที่ยื่นเบิก กันยายน 2569" }));
    expect(calendar.getAllByRole("cell", { name: /: ยื่นเบิก/ })).toHaveLength(5);
    expect(calendar.getByRole("cell", { name: "5 ก.ย. 2569: ยื่นเบิก อยู่ในคำสั่งที่คุณรับผิดชอบ" })).toBeTruthy();
    expect(calendar.getByRole("cell", { name: "6 ก.ย. 2569: ไม่ได้ยื่นเบิก" })).toBeTruthy();
    expect(claim.getByText(/750/)).toBeTruthy();
    expect(mock.detail).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps a partly verified claim together and moves it only after its final order", async () => {
    mount(leaderQueueItems.slice(0, 2));
    const firstOrder = within(firstClaim()).getByRole("region", { name: "คำสั่ง ทดสอบ 001/2569" });
    await userEvent.click(within(firstOrder).getByRole("button", { name: "ใช้ลายเซ็นที่บันทึกไว้" }));
    await userEvent.click(within(firstOrder).getByRole("button", { name: "ยืนยันการออกปฏิบัติงาน" }));
    await waitFor(() => expect(mock.verify).toHaveBeenCalledWith("claim-fixture-1", "work-fixture-1", leaderQueueSignature, "verification-fixture-1"));
    await waitFor(() => expect(screen.getByText("1 เอกสาร · 1 รายการรอยืนยัน")).toBeTruthy());
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(firstClaim().closest("details")).toBeNull();
    expect(within(firstOrder).getByText("ยืนยันแล้ว")).toBeTruthy();
    expect(within(firstOrder).queryByRole("button", { name: "ยืนยันการออกปฏิบัติงาน" })).toBeNull();
    expect(screen.queryByText(/ยืนยันแล้วในรอบนี้/)).toBeNull();

    const secondOrder = within(firstClaim()).getByRole("region", { name: "คำสั่ง ทดสอบ 002/2569" });
    await userEvent.click(within(secondOrder).getByRole("button", { name: "ยืนยันการออกปฏิบัติงาน" }));
    await waitFor(() => expect(mock.verify).toHaveBeenCalledTimes(2));
    expect(mock.verify).toHaveBeenLastCalledWith("claim-fixture-1", "work-fixture-2", leaderQueueSignature, "verification-fixture-2");
    const completed = await screen.findByText("ยืนยันแล้วในรอบนี้ (1 เอกสาร)");
    expect(screen.getByText("0 เอกสาร · 0 รายการรอยืนยัน")).toBeTruthy();
    expect(firstClaim().closest("details")).toBe(completed.closest("details"));
    await userEvent.click(completed);
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(within(firstClaim()).getAllByText("ยืนยันแล้ว")).toHaveLength(2);
    expect(within(firstClaim()).queryByRole("button", { name: "ยืนยันการออกปฏิบัติงาน" })).toBeNull();
  });

  it("retains a pending order after verification failure and blocks duplicate submission", async () => {
    const pending = deferred<Result<{ allVerified: boolean }>>();
    mock.verify.mockReturnValue(pending.promise);
    mount(leaderQueueItems.slice(0, 1));
    const submit = within(firstClaim()).getByRole("button", { name: "ยืนยันการออกปฏิบัติงาน" });
    await userEvent.click(submit);
    await waitFor(() => expect((submit as HTMLButtonElement).disabled).toBe(true));
    fireEvent.click(submit);
    expect(mock.verify).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve({ success: false, error: "ยืนยันรายการทดสอบไม่สำเร็จ" }));
    await waitFor(() => expect((submit as HTMLButtonElement).disabled).toBe(false));
    expect(screen.getByText("1 เอกสาร · 1 รายการรอยืนยัน")).toBeTruthy();
    expect(mock.toast).toHaveBeenCalledWith("ยืนยันไม่สำเร็จ", expect.objectContaining({ description: "ยืนยันรายการทดสอบไม่สำเร็จ" }));
  });

  it("keeps this session's confirmations when revalidation removes completed rows from server props", async () => {
    const { rerender } = mount(leaderQueueItems.slice(0, 2));
    const firstOrder = within(firstClaim()).getByRole("region", { name: "คำสั่ง ทดสอบ 001/2569" });
    await userEvent.click(within(firstOrder).getByRole("button", { name: "ยืนยันการออกปฏิบัติงาน" }));
    await waitFor(() => expect(within(firstOrder).getByText("ยืนยันแล้ว")).toBeTruthy());
    rerender(queueUi([leaderQueueItems[1]]));
    const claim = within(firstClaim());
    expect(claim.getByRole("region", { name: "คำสั่ง ทดสอบ 001/2569" })).toBeTruthy();
    expect(claim.getByText("รอคุณยืนยัน 1 จาก 2 คำสั่ง")).toBeTruthy();
    expect(firstClaim().closest("details")).toBeNull();
    const secondOrder = claim.getByRole("region", { name: "คำสั่ง ทดสอบ 002/2569" });
    await userEvent.click(within(secondOrder).getByRole("button", { name: "ยืนยันการออกปฏิบัติงาน" }));
    await screen.findByText("ยืนยันแล้วในรอบนี้ (1 เอกสาร)");
    rerender(queueUi([]));
    expect(screen.getByText("0 เอกสาร · 0 รายการรอยืนยัน")).toBeTruthy();
    expect(screen.getByText("ยืนยันแล้วในรอบนี้ (1 เอกสาร)")).toBeTruthy();
    expect(within(firstClaim()).getAllByText("ยืนยันแล้ว")).toHaveLength(2);
  });

  it("keeps the displayed verification and selected signature when an edited claim makes it stale", async () => {
    mock.verify.mockResolvedValue({ success: false, code: "VERIFICATION_NOT_FOUND", error: "เอกสารมีการแก้ไข กรุณาเปิดรายการยืนยันใหม่" });
    mount(leaderQueueItems.slice(0, 1));
    const order = within(firstClaim()).getByRole("region", { name: "คำสั่ง ทดสอบ 001/2569" });
    await userEvent.click(within(order).getByRole("button", { name: "ใช้ลายเซ็นที่บันทึกไว้" }));
    const submit = within(order).getByRole("button", { name: "ยืนยันการออกปฏิบัติงาน" });
    await userEvent.click(submit);
    await waitFor(() => expect(mock.toast).toHaveBeenCalledWith("ยืนยันไม่สำเร็จ", {
      description: "เอกสารมีการแก้ไข กรุณาเปิดรายการยืนยันใหม่",
    }));
    expect(mock.verify).toHaveBeenCalledExactlyOnceWith("claim-fixture-1", "work-fixture-1", leaderQueueSignature, "verification-fixture-1");
    expect(screen.getByText("1 เอกสาร · 1 รายการรอยืนยัน")).toBeTruthy();
    expect(within(order).queryByText("ยืนยันแล้ว")).toBeNull();
    expect((submit as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(submit);
    await waitFor(() => expect(mock.verify).toHaveBeenCalledTimes(2));
    expect(mock.verify).toHaveBeenLastCalledWith("claim-fixture-1", "work-fixture-1", leaderQueueSignature, "verification-fixture-1");
  });

  it("requires strokes before using a new signature and submits the captured image", async () => {
    const context = { beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), fillRect: vi.fn() };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => context as unknown as CanvasRenderingContext2D);
    const drawnSignature = "data:image/png;base64,ZHJhd24tc2lnbmF0dXJl";
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(drawnSignature);
    const { container } = mount(leaderQueueItems.slice(0, 1), null);
    const claim = within(firstClaim());
    await userEvent.click(claim.getByRole("button", { name: "ใช้ลายเซ็นนี้" }));
    expect((claim.getByRole("button", { name: "กรุณาลงลายเซ็นก่อน" }) as HTMLButtonElement).disabled).toBe(true);
    expect(mock.verify).not.toHaveBeenCalled();
    const canvas = container.querySelector("canvas")!;
    fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 });
    fireEvent.mouseMove(canvas, { clientX: 20, clientY: 20 });
    fireEvent.mouseUp(canvas);
    await userEvent.click(claim.getByRole("button", { name: "ใช้ลายเซ็นนี้" }));
    await userEvent.click(claim.getByRole("button", { name: "ยืนยันการออกปฏิบัติงาน" }));
    await waitFor(() => expect(mock.verify).toHaveBeenCalledWith("claim-fixture-1", "work-fixture-1", drawnSignature, "verification-fixture-1"));
  });

  it("does not silently submit the saved signature after choosing to draw a replacement", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    mount(leaderQueueItems.slice(0, 1));
    const claim = within(firstClaim());
    await userEvent.click(claim.getByRole("button", { name: "เซ็นใหม่" }));
    const disabledSubmit = claim.getByRole("button", { name: "กรุณาลงลายเซ็นก่อน" });
    expect((disabledSubmit as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(disabledSubmit);
    expect(mock.verify).not.toHaveBeenCalled();
    await userEvent.click(claim.getByRole("button", { name: "ยกเลิก" }));
    await userEvent.click(claim.getByRole("button", { name: "ยืนยันการออกปฏิบัติงาน" }));
    await waitFor(() => expect(mock.verify).toHaveBeenCalledWith("claim-fixture-1", "work-fixture-1", leaderQueueSignature, "verification-fixture-1"));
  });

  it("leaves expired orders readable while disabling verification", async () => {
    mount([{ ...leaderQueueItems[0], expiresAt: new Date("2000-01-01T00:00:00Z") }]);
    expect(within(firstClaim()).getByText("หมดอายุ")).toBeTruthy();
    const submit = within(firstClaim()).getByRole("button", { name: /หมดอายุ.*ติดต่อผู้ยื่น/ });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(detailsButton());
    await screen.findByText(leaderQueueClaimDetail.remark!);
    expect(mock.detail).toHaveBeenCalledWith("claim-fixture-1");
    expect(mock.verify).not.toHaveBeenCalled();
  });

  it("reenables a renewed verification when server props keep the same row ID", async () => {
    const expiredItem = { ...leaderQueueItems[0], expiresAt: new Date("2000-01-01T00:00:00Z") };
    const { rerender } = mount([expiredItem]);
    const claim = within(firstClaim());
    expect(claim.getByText("หมดอายุ")).toBeTruthy();
    expect((claim.getByRole("button", { name: /หมดอายุ.*ติดต่อผู้ยื่น/ }) as HTMLButtonElement).disabled).toBe(true);

    rerender(queueUi([{ ...expiredItem, expiresAt: new Date("2099-12-31T23:59:59Z") }]));
    const submit = await claim.findByRole("button", { name: "ยืนยันการออกปฏิบัติงาน" });
    expect((submit as HTMLButtonElement).disabled).toBe(false);
    expect(claim.queryByText("หมดอายุ")).toBeNull();
    await userEvent.click(submit);
    await waitFor(() => expect(mock.verify).toHaveBeenCalledWith("claim-fixture-1", "work-fixture-1", leaderQueueSignature, "verification-fixture-1"));
  });

  it("loads the read-only drawer lazily and restores focus after keyboard dismissal", async () => {
    const pending = deferred<Result<LeaderClaimDetail>>();
    mock.detail.mockReturnValue(pending.promise);
    mount();
    const open = detailsButton();
    await userEvent.click(open);
    const dialog = screen.getByRole("dialog", { name: "รายละเอียดคำขอ" });
    expect(within(dialog).getByRole("status").textContent).toContain("กำลังโหลดรายละเอียดคำขอ");
    expect(mock.detail).toHaveBeenCalledTimes(1);
    expect(mock.detail).toHaveBeenCalledWith("claim-fixture-1");
    await act(async () => pending.resolve({ success: true, data: leaderQueueClaimDetail }));
    expect(await within(dialog).findByText(leaderQueueClaimDetail.remark!)).toBeTruthy();
    expect(within(dialog).getByText(/EMP-FIXTURE-1/)).toBeTruthy();
    expect(within(dialog).getByText("ตำแหน่งขณะยื่นคำขอ")).toBeTruthy();
    expect(within(dialog).queryByRole("button", { name: /คัดลอก|แชร์|ลิงก์|token|รีเฟรช/i })).toBeNull();
    expect(within(dialog).queryByRole("link", { name: /พิมพ์|ดูตัวอย่างใบคำขอ/ })).toBeNull();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(open));
  });

  it("shows a detail error and retries without leaving the queue", async () => {
    mock.detail.mockResolvedValueOnce({ success: false, error: "ไม่มีสิทธิ์อ่านคำขอนี้" });
    mount();
    await userEvent.click(detailsButton());
    const dialog = screen.getByRole("dialog", { name: "รายละเอียดคำขอ" });
    expect(await within(dialog).findByText("ไม่มีสิทธิ์อ่านคำขอนี้")).toBeTruthy();
    await userEvent.click(within(dialog).getByRole("button", { name: "ลองใหม่" }));
    expect(await within(dialog).findByText(leaderQueueClaimDetail.remark!)).toBeTruthy();
    expect(mock.detail).toHaveBeenNthCalledWith(2, "claim-fixture-1");
  });

  it("does not replace a newly opened claim with a late response for the previous claim", async () => {
    const first = deferred<Result<LeaderClaimDetail>>();
    const second = deferred<Result<LeaderClaimDetail>>();
    mock.detail.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    mount();
    await userEvent.click(detailsButton());
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await userEvent.click(detailsButton(secondClaimName));
    expect(mock.detail).toHaveBeenLastCalledWith("claim-fixture-2");
    await act(async () => second.resolve({ success: true, data: secondLeaderQueueClaimDetail }));
    const dialog = screen.getByRole("dialog", { name: "รายละเอียดคำขอ" });
    expect(await within(dialog).findByText(secondLeaderQueueClaimDetail.remark!)).toBeTruthy();
    await act(async () => first.resolve({ success: true, data: leaderQueueClaimDetail }));
    expect(within(dialog).getByText(secondLeaderQueueClaimDetail.remark!)).toBeTruthy();
    expect(within(dialog).queryByText(leaderQueueClaimDetail.remark!)).toBeNull();
  });
});
