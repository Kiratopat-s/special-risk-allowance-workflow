// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@mui/material/styles";
import { workflowTheme } from "@/components/workflow-ui/theme";
import type { TokenVerificationView } from "@/lib/domains/leader-verification";
import type { Result } from "@/lib/shared/types";
import { leaderQueueSignature } from "./fixtures/leader-queue";
import { secondTokenVerificationReady, tokenVerificationReady, tokenVerificationReceipt } from "./fixtures/token-verification";

const mock = vi.hoisted(() => ({ load: vi.fn(), verify: vi.fn(), toast: vi.fn() }));
vi.mock("@/app/actions/leader-verify", () => ({
  getVerificationByToken: mock.load,
  verifyByToken: mock.verify,
}));
vi.mock("sonner", () => ({ toast: { error: mock.toast, success: mock.toast } }));

import { LeaderVerifyClient } from "@/app/leader-verify/leader-verify-client";

function verificationUi(token: string | null = "token-one", signature: string | null = leaderQueueSignature) {
  return <ThemeProvider theme={workflowTheme}><LeaderVerifyClient token={token} existingSignatureDataUrl={signature} /></ThemeProvider>;
}
function mount(token: string | null = "token-one", signature: string | null = leaderQueueSignature) {
  return render(verificationUi(token, signature));
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}
async function ready() {
  return screen.findByRole("region", { name: "คำสั่งที่กำลังยืนยัน" });
}
function submit() {
  return screen.getByRole("button", { name: "ยืนยันการออกปฏิบัติงาน" });
}
const drawnSignature = "data:image/png;base64,ZHJhd24tc2lnbmF0dXJl";
function mockDrawing() {
  const context = { beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), fillRect: vi.fn() };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => context as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(drawnSignature);
}
async function captureDrawing(container: HTMLElement) {
  const canvas = container.querySelector("canvas")!;
  fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 });
  fireEvent.mouseMove(canvas, { clientX: 20, clientY: 20 });
  fireEvent.mouseUp(canvas);
  await userEvent.click(screen.getByRole("button", { name: "ใช้ลายเซ็นนี้" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mock.load.mockResolvedValue({ success: true, data: tokenVerificationReady });
  mock.verify.mockResolvedValue({ success: true, data: { allVerified: false } });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("external leader review before signing", () => {
  it("shows all claim details inline and highlights only saved dates within the target order", async () => {
    const { container } = mount();
    const target = within(await ready());
    expect(mock.load).toHaveBeenCalledExactlyOnceWith("token-one");
    expect(screen.getByText("เลขเอกสาร claim-fixture-1")).toBeTruthy();
    expect(screen.getByText("ผู้ยื่นทดสอบ คนแรก")).toBeTruthy();
    expect(screen.getByText(/EMP-FIXTURE-1/)).toBeTruthy();
    expect(screen.getByText("ตำแหน่งขณะยื่นคำขอ")).toBeTruthy();
    expect(screen.getByText("รอหัวหน้ายืนยัน")).toBeTruthy();
    expect(screen.getByText(tokenVerificationReady.expenseClaim.remark!)).toBeTruthy();
    expect(screen.getByText("5 วัน")).toBeTruthy();
    expect(screen.getByText("750 บาท")).toBeTruthy();
    const orders = within(screen.getByRole("region", { name: "คำสั่งที่ใช้ประกอบการเบิก" }));
    expect(orders.getAllByRole("listitem")).toHaveLength(2);
    expect(orders.getByText("ทดสอบ 001/2569")).toBeTruthy();
    expect(orders.getByText("ทดสอบ 002/2569")).toBeTruthy();
    expect(orders.getByText("พื้นที่ทดสอบสอง")).toBeTruthy();
    expect(orders.getAllByText("ตรวจสอบระบบในพื้นที่ทดสอบ")).toHaveLength(2);
    expect(orders.getByText("คำสั่งที่คุณกำลังยืนยัน").closest("li")?.textContent).toContain("ทดสอบ 001/2569");
    expect(target.getByRole("heading", { name: "คุณกำลังยืนยันคำสั่ง ทดสอบ 001/2569" })).toBeTruthy();
    expect(target.getByText(/3–5 ก\.ย\. 2569/)).toBeTruthy();
    expect(target.getByText(/3 วัน/)).toBeTruthy();
    expect(screen.getByText("หัวหน้าทดสอบ คนเดียว")).toBeTruthy();
    expect(screen.getByText(/ยอดเงิน.*ยอดรวม.*คำขอ/)).toBeTruthy();
    expect(screen.getByText(/ลงนาม.*เฉพาะคำสั่ง/)).toBeTruthy();
    const calendar = within(screen.getByRole("table", { name: "ปฏิทินวันที่ที่ยื่นเบิก กันยายน 2569" }));
    expect(calendar.getAllByRole("cell", { name: /: ยื่นเบิก/ })).toHaveLength(5);
    expect(calendar.getByRole("cell", { name: "5 ก.ย. 2569: ยื่นเบิก อยู่ในคำสั่งที่คุณรับผิดชอบ" })).toBeTruthy();
    expect(calendar.getByRole("cell", { name: "10 ก.ย. 2569: ยื่นเบิก" })).toBeTruthy();
    expect(calendar.getByRole("cell", { name: "6 ก.ย. 2569: ไม่ได้ยื่นเบิก" })).toBeTruthy();
    expect(container.querySelectorAll('[data-highlighted="true"]')).toHaveLength(3);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: "ดูรายละเอียดคำขอ" })).toBeNull();
  });

  it("preserves warnings for missing dates without filling dates from the order period", async () => {
    mock.load.mockResolvedValue({ success: true, data: { ...tokenVerificationReady, expenseClaim: { ...tokenVerificationReady.expenseClaim, selectedDates: null } } });
    const { container } = mount();
    await ready();
    expect(screen.getByText("ยังไม่มีข้อมูลวันที่เบิกที่บันทึกไว้")).toBeTruthy();
    expect(screen.getByText("วันที่ที่บันทึกไว้ 0 วัน ไม่ตรงกับจำนวนที่ขอเบิก 5 วัน")).toBeTruthy();
    expect(screen.getByText("750 บาท")).toBeTruthy();
    expect(container.querySelectorAll('[data-selected="true"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-highlighted="true"]')).toHaveLength(0);
  });

  it("keeps duplicate, invalid and wrong-month warnings while showing the saved claim amount", async () => {
    mock.load.mockResolvedValue({ success: true, data: { ...tokenVerificationReady, expenseClaim: { ...tokenVerificationReady.expenseClaim, selectedDates: ["2026-09-03", "2026-09-03", "2026-10-01", "bad-date"] } } });
    const { container } = mount();
    await ready();
    expect(screen.getByText("พบวันที่เบิกซ้ำ จึงแสดงแต่ละวันเพียงครั้งเดียว")).toBeTruthy();
    expect(screen.getByText("มีวันที่ไม่ถูกต้องหรืออยู่นอกเดือนที่เบิก จึงไม่แสดงวันที่เหล่านั้นในปฏิทิน")).toBeTruthy();
    expect(screen.getByText("วันที่ที่บันทึกไว้ 1 วัน ไม่ตรงกับจำนวนที่ขอเบิก 5 วัน")).toBeTruthy();
    expect(screen.getByText("750 บาท")).toBeTruthy();
    expect(container.querySelectorAll('[data-selected="true"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-highlighted="true"]')).toHaveLength(1);
  });

  it.each([{ amount: 0, countDates: 0, money: "0 บาท", days: "0 วัน" }, { amount: null, countDates: null, money: "- บาท", days: "- วัน" }])("distinguishes missing values from zero ($money)", async ({ amount, countDates, money, days }) => {
    mock.load.mockResolvedValue({ success: true, data: { ...tokenVerificationReady, expenseClaim: { ...tokenVerificationReady.expenseClaim, amount, countDates, selectedDates: [] } } });
    mount();
    await ready();
    expect(screen.getByText(money)).toBeTruthy();
    expect(screen.getAllByText(days).length).toBeGreaterThan(0);
  });

  it("does not expose details or signing while loading", async () => {
    const request = deferred<Result<TokenVerificationView>>();
    mock.load.mockReturnValue(request.promise);
    const { container } = mount();
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(screen.queryByText("ผู้ยื่นทดสอบ คนแรก")).toBeNull();
    expect(screen.queryByRole("button", { name: /ยืนยันการออกปฏิบัติงาน|ใช้ลายเซ็น/ })).toBeNull();
    await act(async () => request.resolve({ success: true, data: tokenVerificationReady }));
    await ready();
  });

  it.each(["INVALID_TOKEN", "TOKEN_NOT_FOUND", "TOKEN_EXPIRED", "VERIFICATION_NOT_FOUND", "CLAIM_NOT_FOUND"])("hides details and signing for unavailable links (%s)", async (code) => {
    mock.load.mockResolvedValue({ success: false, code, error: "ลิงก์ไม่สามารถใช้งานได้" });
    mount();
    expect(await screen.findByText("ลิงก์ไม่ถูกต้องหรือหมดอายุ")).toBeTruthy();
    expect(screen.queryByText("ผู้ยื่นทดสอบ คนแรก")).toBeNull();
    expect(screen.queryByRole("button", { name: /ยืนยันการออกปฏิบัติงาน|ใช้ลายเซ็น/ })).toBeNull();
  });

  it("does not request data without a token", () => {
    mount(null);
    expect(screen.getByText("ลิงก์ไม่ถูกต้องหรือหมดอายุ")).toBeTruthy();
    expect(mock.load).not.toHaveBeenCalled();
  });

  it.each(["result", "transport"])("allows retry after a transient %s load failure without enabling signing", async (failure) => {
    if (failure === "result") mock.load.mockResolvedValueOnce({ success: false, code: "INTERNAL_ERROR", error: "โหลดข้อมูลทดสอบไม่สำเร็จ" });
    else mock.load.mockRejectedValueOnce(new Error("Disconnected"));
    mount();
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "ยืนยันการออกปฏิบัติงาน" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "ลองใหม่" }));
    await ready();
    expect(mock.load).toHaveBeenNthCalledWith(2, "token-one");
    expect(screen.getByText("ผู้ยื่นทดสอบ คนแรก")).toBeTruthy();
  });

  it("ignores a late load response after switching to a different token", async () => {
    const first = deferred<Result<TokenVerificationView>>();
    const second = deferred<Result<TokenVerificationView>>();
    mock.load.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { rerender } = mount();
    rerender(verificationUi("token-two"));
    expect(mock.load).toHaveBeenLastCalledWith("token-two");
    await act(async () => second.resolve({ success: true, data: secondTokenVerificationReady }));
    await ready();
    expect(screen.getByText("ผู้ยื่นทดสอบ คนที่สอง")).toBeTruthy();
    await act(async () => first.resolve({ success: true, data: tokenVerificationReady }));
    expect(screen.getByText("ผู้ยื่นทดสอบ คนที่สอง")).toBeTruthy();
    expect(screen.queryByText("ผู้ยื่นทดสอบ คนแรก")).toBeNull();
    await userEvent.click(submit());
    await waitFor(() => expect(mock.verify).toHaveBeenCalledExactlyOnceWith("token-two", leaderQueueSignature));
  });

  it("shows only the receipt when the server reports an already verified link", async () => {
    mock.load.mockResolvedValue({ success: true, data: tokenVerificationReceipt });
    mount();
    expect(await screen.findByText("ยืนยันการออกปฏิบัติงานเรียบร้อยแล้ว")).toBeTruthy();
    expect(screen.getByText("work-fixture-1")).toBeTruthy();
    expect(screen.getByText("ยืนยันเมื่อ: 18/09/2569")).toBeTruthy();
    expect(screen.queryByText("ผู้ยื่นทดสอบ คนแรก")).toBeNull();
    expect(screen.queryByText("750 บาท")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps details and the selected signature after rejection, blocks duplicate sends, and hides details on success", async () => {
    const request = deferred<Result<{ allVerified: boolean }>>();
    mock.verify.mockReturnValueOnce(request.promise);
    mount();
    await ready();
    const confirm = submit();
    await userEvent.click(confirm);
    await waitFor(() => expect((confirm as HTMLButtonElement).disabled).toBe(true));
    fireEvent.click(confirm);
    expect(mock.verify).toHaveBeenCalledExactlyOnceWith("token-one", leaderQueueSignature);
    await act(async () => request.resolve({ success: false, code: "VERIFICATION_NOT_FOUND", error: "เอกสารมีการแก้ไข กรุณาเปิดรายการยืนยันใหม่" }));
    expect(await screen.findByText("เอกสารมีการแก้ไข กรุณาเปิดรายการยืนยันใหม่")).toBeTruthy();
    expect(screen.getByText("750 บาท")).toBeTruthy();
    expect((submit() as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(submit());
    expect(await screen.findByText("ยืนยันสำเร็จ")).toBeTruthy();
    expect(mock.verify).toHaveBeenNthCalledWith(2, "token-one", leaderQueueSignature);
    expect(screen.queryByText("750 บาท")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("recovers from a signing transport failure without losing the details or signature", async () => {
    mockDrawing();
    mock.verify.mockRejectedValueOnce(new Error("Disconnected"));
    const { container } = mount("token-one", null);
    await ready();
    await captureDrawing(container);
    await userEvent.click(submit());
    await waitFor(() => expect((submit() as HTMLButtonElement).disabled).toBe(false));
    expect(screen.getByText("750 บาท")).toBeTruthy();
    expect(screen.getByRole("img", { name: "ลายเซ็น" }).getAttribute("src")).toBe(drawnSignature);
    await userEvent.click(submit());
    expect(await screen.findByText("ยืนยันสำเร็จ")).toBeTruthy();
    expect(mock.verify).toHaveBeenNthCalledWith(2, "token-one", drawnSignature);
  });

  it("requires a captured replacement after choosing to draw, and submits only the captured image", async () => {
    mockDrawing();
    const { container } = mount();
    await ready();
    await userEvent.click(screen.getByRole("button", { name: "ใช้ลายเซ็นที่บันทึกไว้" }));
    await userEvent.click(screen.getByRole("button", { name: "เซ็นใหม่" }));
    const disabled = screen.getByRole("button", { name: "กรุณาลงลายเซ็นก่อน" });
    expect((disabled as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "ใช้ลายเซ็นนี้" }));
    expect((disabled as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(disabled);
    expect(mock.verify).not.toHaveBeenCalled();
    await captureDrawing(container);
    await userEvent.click(submit());
    await waitFor(() => expect(mock.verify).toHaveBeenCalledExactlyOnceWith("token-one", drawnSignature));
  });

  it("restores use of the saved signature when cancelling a replacement", async () => {
    mount();
    await ready();
    await userEvent.click(screen.getByRole("button", { name: "เซ็นใหม่" }));
    expect((screen.getByRole("button", { name: "กรุณาลงลายเซ็นก่อน" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "ยกเลิก" }));
    await userEvent.click(submit());
    await waitFor(() => expect(mock.verify).toHaveBeenCalledExactlyOnceWith("token-one", leaderQueueSignature));
  });

  it("clears details and ignores an old submission result when the token changes", async () => {
    mockDrawing();
    const submission = deferred<Result<{ allVerified: boolean }>>();
    const secondLoad = deferred<Result<TokenVerificationView>>();
    mock.verify.mockReturnValueOnce(submission.promise);
    mock.load.mockResolvedValueOnce({ success: true, data: tokenVerificationReady }).mockReturnValueOnce(secondLoad.promise);
    const { container, rerender } = mount("token-one", null);
    await ready();
    await captureDrawing(container);
    await userEvent.click(submit());
    rerender(verificationUi("token-two", null));
    expect(screen.queryByText("ผู้ยื่นทดสอบ คนแรก")).toBeNull();
    expect(screen.queryByRole("button", { name: /ยืนยันการออกปฏิบัติงาน|ใช้ลายเซ็น/ })).toBeNull();
    await act(async () => secondLoad.resolve({ success: true, data: secondTokenVerificationReady }));
    await ready();
    expect((screen.getByRole("button", { name: "กรุณาลงลายเซ็นก่อน" }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => submission.resolve({ success: true, data: { allVerified: false } }));
    expect(screen.getByText("ผู้ยื่นทดสอบ คนที่สอง")).toBeTruthy();
    expect(screen.queryByText("ยืนยันสำเร็จ")).toBeNull();
    expect(screen.queryByRole("img", { name: "ลายเซ็น" })).toBeNull();
    expect(mock.verify).toHaveBeenCalledExactlyOnceWith("token-one", drawnSignature);
  });

  it("disables signing when the ready link expires while keeping the reviewed data readable", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-25T00:00:00Z"));
    mock.load.mockResolvedValue({ success: true, data: { ...tokenVerificationReady, expiresAt: new Date("2026-09-25T00:00:01Z") } });
    mount();
    await act(async () => { await Promise.resolve(); });
    expect((submit() as HTMLButtonElement).disabled).toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(1_001); });
    const expired = screen.getByRole("button", { name: "หมดอายุ — ติดต่อผู้ยื่น" });
    expect((expired as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("750 บาท")).toBeTruthy();
    expect(screen.getByRole("table", { name: "ปฏิทินวันที่ที่ยื่นเบิก กันยายน 2569" })).toBeTruthy();
    fireEvent.click(expired);
    expect(mock.verify).not.toHaveBeenCalled();
  });
});
