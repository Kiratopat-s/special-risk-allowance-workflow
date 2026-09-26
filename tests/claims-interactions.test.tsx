// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import userEvent from "@testing-library/user-event";
import { installPickerMedia } from "./helpers/picker-media";
import { workflowTheme } from "@/components/workflow-ui/theme";
import type { ExpenseClaimDocumentWithRelations } from "@/lib/domains/expense-claim-document/types";
const mock = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  submit: vi.fn(),
  remove: vi.fn(),
  eligible: vi.fn(),
  list: vi.fn(),
  detail: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  toast: vi.fn(),
  query: new URLSearchParams("tab=expense-claims"),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mock.push,
    replace: vi.fn(),
    refresh: mock.refresh,
  }),
  useSearchParams: () => mock.query,
}));
vi.mock("@/lib/hooks/use-scoped-permission", () => ({
  useScopedPermission: () => ({ userId: "me", allows: () => true }),
}));
vi.mock("sonner", () => ({
  toast: { success: mock.toast, error: mock.toast },
}));
vi.mock("@/app/actions/expense-claim-document", () => ({
  createExpenseClaimDocument: mock.create,
  updateExpenseClaimDocument: mock.update,
  submitDraftExpenseClaimDocument: mock.submit,
  deleteExpenseClaimDocument: mock.remove,
  listEligibleOffSiteWorksForClaim: mock.eligible,
  listExpenseClaimDocuments: mock.list,
  getExpenseClaimDocument: mock.detail,
}));
vi.mock("@/app/expense-claim-document/leader-verification-section", () => ({
  LeaderVerificationSection: () => null,
}));
import { ExpenseClaimDocumentClient } from "@/app/expense-claim-document/expense-claim-document-client";
const work = {
  id: "work-1",
  innerRefDocumentId: "คำสั่งทดสอบ",
  startDate: new Date("2026-09-04"),
  endDate: new Date("2026-09-07"),
  hasLeader: true,
  objective: "ตรวจสอบระบบ",
  location: "พื้นที่ทดสอบ",
  leaderFirstName: "หัวหน้า",
  leaderLastName: "ทดสอบ",
  leaderEmail: null,
};
const claim = {
  id: "claim-1",
  userId: "me",
  expenseMonth: new Date("2026-09-01"),
  claimantPositionAtSubmission: "ตำแหน่งที่บันทึก",
  selectedDates: ["2026-09-05"],
  status: "DRAFT",
  countDates: 1,
  amount: 150,
  remark: "หมายเหตุเดิม",
  claimant: { firstName: "ผู้", lastName: "ทดสอบ" },
  expenseClaimOffSiteWorks: [{ offSiteWorkId: work.id, offSiteWork: work }],
  leaderVerifications: [],
} as unknown as ExpenseClaimDocumentWithRelations;
function mount(
  items: ExpenseClaimDocumentWithRelations[] = [],
  initialViewId: string | null = null,
) {
  return render(
    <ThemeProvider theme={workflowTheme}>
      <ExpenseClaimDocumentClient
        initialItems={items}
        initialPagination={null}
        initialViewId={initialViewId}
        currentUserDisplayName="ผู้ทดสอบ"
        currentUserClaimantPositionAtSubmission="พชง. 5"
      />
    </ThemeProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mock.query = new URLSearchParams("tab=expense-claims");
  mock.eligible.mockResolvedValue({ success: true, data: [work] });
  mock.create.mockResolvedValue({
    success: false,
    error: "fixture server error",
  });
  mock.update.mockResolvedValue({
    success: false,
    error: "fixture server error",
  });
  mock.list.mockResolvedValue({
    success: true,
    data: {
      data: [],
      pagination: { page: 1, total: 0, totalPages: 0, pageSize: 20 },
    },
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
async function startNew() {
  fireEvent.click(screen.getByRole("button", { name: "สร้างเอกสาร" }));
  await waitFor(() => expect(mock.eligible).toHaveBeenCalled());
  fireEvent.paste(
    within(screen.getByRole("dialog")).getByRole("spinbutton", { name: "เดือน" }),
    { clipboardData: { getData: () => "09/2569" } },
  );
  fireEvent.click(await screen.findByRole("button", { name: /คำสั่งทดสอบ/ }));
}
describe("claim presentation preserves behavior", () => {
  it("submits the adorned search input with Enter and retains other URL filters", () => {
    mock.query = new URLSearchParams("tab=expense-claims&page=4&month=2026-09&status=PENDING");
    mount();
    const input = screen.getByRole("textbox", { name: "ค้นหารหัสพนักงาน, ชื่อผู้เบิก, เลขที่เอกสาร หรือหมายเหตุ" });
    fireEvent.change(input, { target: { value: "คำสั่งทดสอบ" } });
    fireEvent.keyDown(input, { key: "Enter" });
    const url = new URL(mock.push.mock.calls[0][0], "https://fixture.test");
    expect(url.searchParams.get("search")).toBe("คำสั่งทดสอบ");
    expect(url.searchParams.get("month")).toBe("2026-09");
    expect(url.searchParams.get("status")).toBe("PENDING");
    expect(url.searchParams.has("page")).toBe(false);
  });
  it("applies a desktop menu filter with the existing URL and pagination contract", async () => {
    installPickerMedia(true);
    mock.query = new URLSearchParams("tab=expense-claims&page=4&month=2026-09");
    mount();
    await userEvent.click(screen.getByRole("combobox", { name: /^สถานะ/ }));
    await userEvent.click(screen.getByRole("option", { name: "รอดำเนินการ" }));
    expect(mock.push).toHaveBeenCalledWith(
      "/dashboard?tab=expense-claims&month=2026-09&status=PENDING",
      { scroll: false },
    );
  });
  it("retains values after a transport failure and blocks duplicate submission while pending", async () => {
    let rejectRequest!: (reason: Error) => void;
    mock.create.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectRequest = reject;
        }),
    );
    mount();
    await startNew();
    fireEvent.click(screen.getByRole("button", { name: "ถัดไป" }));
    fireEvent.change(screen.getByLabelText("หมายเหตุ (ถ้ามี)"), {
      target: { value: "กู้คืนหลังเครือข่ายขัดข้อง" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ถัดไป" }));
    const submitButton = screen.getByRole("button", { name: "ส่งเอกสาร" });
    fireEvent.click(submitButton);
    await waitFor(() => expect(mock.create).toHaveBeenCalledTimes(1));
    expect(submitButton.hasAttribute("disabled")).toBe(true);
    fireEvent.click(submitButton);
    expect(
      within(screen.getByRole("dialog"))
        .getAllByRole("button", { name: "ปิด" })
        .every((button) => button.hasAttribute("disabled")),
    ).toBe(true);
    await act(async () => {
      rejectRequest(new Error("fixture network failure"));
    });
    await waitFor(() =>
      expect(mock.toast).toHaveBeenCalledWith(
        "เชื่อมต่อไม่สำเร็จ",
        expect.any(Object),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "ย้อนกลับ" }));
    expect(
      (screen.getByLabelText("หมายเหตุ (ถ้ามี)") as HTMLTextAreaElement).value,
    ).toBe("กู้คืนหลังเครือข่ายขัดข้อง");
    expect(mock.create).toHaveBeenCalledTimes(1);
  });
  it("keeps individual weekend selection, review, and the original submission payload", async () => {
    mount();
    await startNew();
    fireEvent.click(screen.getByTitle(/05\/09/));
    fireEvent.click(screen.getByRole("button", { name: "ถัดไป" }));
    fireEvent.change(screen.getByLabelText("หมายเหตุ (ถ้ามี)"), {
      target: { value: "ค่าที่ต้องไม่หาย" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ถัดไป" }));
    fireEvent.click(screen.getByRole("button", { name: "ส่งเอกสาร" }));
    await waitFor(() => expect(mock.create).toHaveBeenCalledTimes(1));
    expect(mock.create.mock.calls[0][0]).toMatchObject({
      status: "PENDING_LEADER_VERIFY",
      selectedDates: ["2026-09-04", "2026-09-05", "2026-09-07"],
      remark: "ค่าที่ต้องไม่หาย",
    });
    await waitFor(() =>
      expect(mock.toast).toHaveBeenCalledWith(
        "สร้างเอกสารไม่สำเร็จ",
        expect.anything(),
      ),
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "ย้อนกลับ" }));
    expect(
      (screen.getByLabelText("หมายเหตุ (ถ้ามี)") as HTMLTextAreaElement).value,
    ).toBe("ค่าที่ต้องไม่หาย");
  });
  it("restores a draft's saved individual dates instead of weekday defaults", async () => {
    mount([claim]);
    fireEvent.click(
      screen.getByRole("button", { name: "แก้ไขเอกสาร claim-1" }),
    );
    await waitFor(() =>
      expect(screen.getByTitle(/05\/09/).getAttribute("aria-pressed")).toBe(
        "true",
      ),
    );
    expect(screen.getByTitle(/04\/09/).getAttribute("aria-pressed")).toBe(
      "false",
    );
    fireEvent.click(screen.getByRole("button", { name: "บันทึกร่าง" }));
    await waitFor(() =>
      expect(mock.update).toHaveBeenCalledWith(
        "claim-1",
        expect.objectContaining({
          selectedDates: ["2026-09-05"],
        }),
      ),
    );
  });
  it.each(["PENDING_LEADER_VERIFY", "WAIT_FOR_COLLECTION", "REJECTED"] as const)(
    "edits %s through work/date selection with read-only derived totals", async (status) => {
      mount([{ ...claim, status }]);
      fireEvent.click(screen.getByRole("button", { name: "แก้ไขเอกสาร claim-1" }));
      await screen.findByRole("button", { name: /คำสั่งทดสอบ/ });
      expect(mock.eligible).toHaveBeenCalledWith("2026-09", "claim-1");
      const days = screen.getByLabelText("จำนวนวันที่เลือก") as HTMLInputElement;
      const amount = screen.getByLabelText("ยอดเบิก (บาท)") as HTMLInputElement;
      expect(days.readOnly).toBe(true);
      expect(amount.readOnly).toBe(true);
      expect(days.value).toBe("1");
      expect(amount.value).toBe("150");
      const calendarDay = screen.getByRole("button", { name: "ศุกร์ 04/09" });
      fireEvent.click(calendarDay);
      expect(days.value).toBe("2");
      expect(amount.value).toBe("300");
      fireEvent.click(screen.getByRole("button", { name: "ถัดไป" }));
      fireEvent.click(screen.getByRole("button", { name: "ถัดไป" }));
      expect(screen.queryByRole("button", { name: "ส่งเอกสาร" })).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "บันทึกการแก้ไข" }));
      await waitFor(() => expect(mock.update).toHaveBeenCalled());
      const payload = mock.update.mock.calls[0][1];
      expect(payload.selectedDates).toEqual(["2026-09-04", "2026-09-05"]);
      expect(payload.offSiteWorkIds).toEqual(["work-1"]);
      expect(payload).not.toHaveProperty("amount");
      expect(payload).not.toHaveProperty("countDates");
      expect(payload).not.toHaveProperty("status");
      expect(mock.submit).not.toHaveBeenCalled();
    },
  );
  it.each([
    { status: "COLLECTED" }, { status: "APPROVED" }, { status: "CANCELLED" },
    { status: "WAIT_FOR_COLLECTION", monthlyRequestCollectionId: "mrc-1" },
  ] as const)("hides mutations for locked claim %j even when permissions allow all", (fields) => {
    mount([{ ...claim, ...fields }]);
    expect(screen.queryByRole("button", { name: "แก้ไขเอกสาร claim-1" })).toBeNull();
    expect(screen.queryByRole("button", { name: "ยกเลิกเอกสาร claim-1" })).toBeNull();
  });
  it("blocks saving on failed eligibility load and restores saved dates after retry", async () => {
    mock.eligible.mockResolvedValueOnce({ success: false, error: "โหลดไม่สำเร็จ" });
    mount([claim]);
    fireEvent.click(screen.getByRole("button", { name: "แก้ไขเอกสาร claim-1" }));
    await screen.findByText("โหลดไม่สำเร็จ");
    expect((screen.getByRole("button", { name: "บันทึกร่าง" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "ลองโหลดอีกครั้ง" }));
    await screen.findByRole("button", { name: /คำสั่งทดสอบ/ });
    expect(screen.getByRole("button", { name: /05\/09/ }).getAttribute("aria-pressed")).toBe("true");
    expect((screen.getByRole("button", { name: "บันทึกร่าง" }) as HTMLButtonElement).disabled).toBe(false);
  });
  it("does not invent selected days for a legacy document with no saved dates", async () => {
    mount([{ ...claim, status: "PENDING_LEADER_VERIFY", selectedDates: null }]);
    fireEvent.click(screen.getByRole("button", { name: "แก้ไขเอกสาร claim-1" }));
    await screen.findByRole("button", { name: /คำสั่งทดสอบ/ });
    expect((screen.getByLabelText("จำนวนวันที่เลือก") as HTMLInputElement).value).toBe("0");
    expect(screen.getByText(/เอกสารเดิมไม่มีวันที่เบิก/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /05\/09/ }).getAttribute("aria-pressed")).toBe("false");
  });
  it("recovers from a transport failure while loading edit options", async () => {
    mock.eligible.mockRejectedValueOnce(new Error("offline"));
    mount([claim]);
    fireEvent.click(screen.getByRole("button", { name: "แก้ไขเอกสาร claim-1" }));
    await screen.findByText("เชื่อมต่อไม่สำเร็จ กรุณาลองโหลดคำสั่งปฏิบัติงานอีกครั้ง");
    fireEvent.click(screen.getByRole("button", { name: "ลองโหลดอีกครั้ง" }));
    await screen.findByRole("button", { name: /คำสั่งทดสอบ/ });
    expect((screen.getByRole("button", { name: "บันทึกร่าง" }) as HTMLButtonElement).disabled).toBe(false);
  });
  it("ignores an older options response after another document is opened", async () => {
    let finishFirst!: (value: unknown) => void;
    mock.eligible.mockImplementationOnce(() => new Promise((resolve) => { finishFirst = resolve; }));
    mount([claim, { ...claim, id: "claim-2", selectedDates: ["2026-09-07"] }]);
    fireEvent.click(screen.getByRole("button", { name: "แก้ไขเอกสาร claim-1" }));
    expect((screen.getByRole("button", { name: "บันทึกร่าง" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getAllByRole("button", { name: "ปิด" })[0]);
    fireEvent.click(await screen.findByRole("button", { name: "แก้ไขเอกสาร claim-2" }));
    await screen.findByRole("button", { name: /คำสั่งทดสอบ/ });
    await act(async () => { finishFirst({ success: true, data: [] }); });
    expect(screen.getByRole("button", { name: "จันทร์ 07/09" }).getAttribute("aria-pressed")).toBe("true");
    expect((screen.getByLabelText("จำนวนวันที่เลือก") as HTMLInputElement).value).toBe("1");
  });
  it("never shows owner-only submit for another user's draft", async () => {
    mount([{ ...claim, userId: "other" }]);
    expect(
      screen.queryByRole("button", { name: "ส่งเอกสาร claim-1" }),
    ).toBeNull();
  });
  it("blocks submission with missing leaders while retaining draft save", async () => {
    mock.eligible.mockResolvedValue({
      success: true,
      data: [{ ...work, hasLeader: false }],
    });
    mount();
    await startNew();
    fireEvent.click(screen.getByRole("button", { name: "ถัดไป" }));
    fireEvent.click(screen.getByRole("button", { name: "ถัดไป" }));
    expect(
      (screen.getByRole("button", { name: "ส่งเอกสาร" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "บันทึกร่าง" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });
  it("checks server READ authorization for deep links even when an item is in the list", async () => {
    mock.detail.mockResolvedValue({
      success: false,
      error: "Permission denied",
      code: "PERMISSION_DENIED",
    });
    mount([claim], claim.id);
    await waitFor(() => expect(mock.detail).toHaveBeenCalledWith(claim.id));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("offers the individual preview in a new tab after loading a readable claim", async () => {
    mock.detail.mockResolvedValue({ success: true, data: claim });
    mount([claim], claim.id);
    const link = await screen.findByRole("link", { name: "ดูตัวอย่างใบคำขอ" });
    expect(link.getAttribute("href")).toBe("/expense-claim-document/claim-1/print");
    expect(link.getAttribute("target")).toBe("_blank");
  });
  it("keeps the working filters in the navigation URL", () => {
    mock.query = new URLSearchParams("tab=expense-claims&page=4&month=2026-09");
    mount();
    fireEvent.change(screen.getByLabelText("สถานะ", { exact: true }), {
      target: { value: "PENDING" },
    });
    expect(mock.push).toHaveBeenCalledWith(
      "/dashboard?tab=expense-claims&month=2026-09&status=PENDING",
      { scroll: false },
    );
  });
});
