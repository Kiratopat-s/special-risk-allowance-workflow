// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { workflowTheme } from "@/components/workflow-ui/theme";
import { installPickerMedia } from "./helpers/picker-media";
import type { EmployeeListItem, OffSiteWorkWithRelations } from "@/lib/domains/off-site-work/types";

const mock = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), search: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams("tab=off-site-work"),
}));
vi.mock("@/lib/hooks/use-scoped-permission", () => ({
  useScopedPermission: () => ({ userId: "me", allows: () => true }),
}));
vi.mock("@/app/actions/off-site-work", () => ({
  createOffSiteWork: mock.create,
  updateOffSiteWork: mock.update,
  listOffSiteWorks: vi.fn(),
  deleteOffSiteWork: vi.fn(),
}));
vi.mock("@/app/actions/user", () => ({ searchUsersForLeader: mock.search }));
vi.mock("@/app/off-site-work/pdf-import", () => ({ PdfImport: () => null }));
import { OffSiteWorkClient } from "@/app/off-site-work/off-site-work-client";

const idOnly: EmployeeListItem = {
  userId: null, employeeId: "000001", firstName: "", lastName: "",
  position: null, departmentId: null, departmentName: null,
};
function mount(items: OffSiteWorkWithRelations[] = []) {
  render(<ThemeProvider theme={workflowTheme}>
    <OffSiteWorkClient initialItems={items} initialPagination={null} />
  </ThemeProvider>);
}
beforeEach(() => {
  vi.clearAllMocks();
  installPickerMedia(false);
  mock.create.mockResolvedValue({ success: false, error: "fixture failure" });
  mock.update.mockResolvedValue({ success: false, error: "fixture failure" });
});
afterEach(cleanup);

it("adds and submits an employee number without names or a registered account, preventing duplicates", async () => {
  mount();
  fireEvent.click(screen.getByRole("button", { name: "เพิ่มคำสั่ง" }));
  const search = screen.getByPlaceholderText("ค้นหาชื่อ / รหัสพนักงาน");
  const add = screen.getByRole("button", { name: "เพิ่มด้วยรหัสพนักงาน" }) as HTMLButtonElement;
  expect(add.disabled).toBe(true);
  fireEvent.change(search, { target: { value: "00001" } });
  expect(add.disabled).toBe(true);
  fireEvent.change(search, { target: { value: " 000001 " } });
  expect(add.disabled).toBe(false);
  fireEvent.click(add);
  expect((screen.getByLabelText("รหัสพนักงาน ผู้เดินทาง 1") as HTMLInputElement).value).toBe("000001");
  expect((screen.getByLabelText("ชื่อ ผู้เดินทาง 1") as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText("นามสกุล ผู้เดินทาง 1") as HTMLInputElement).value).toBe("");
  fireEvent.change(search, { target: { value: "000001" } });
  expect(add.disabled).toBe(true);
  expect(screen.getByText("มีรหัสพนักงานนี้ในรายการแล้ว")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("เลขที่เอกสาร"), { target: { value: "TZ26010001" } });
  fireEvent.click(screen.getByRole("button", { name: "บันทึก" }));
  await waitFor(() => expect(mock.create).toHaveBeenCalledWith(expect.objectContaining({
    id: "TZ26010001", employeeList: [idOnly],
  })));
  expect(mock.search).not.toHaveBeenCalled();
});

it("shows an unnamed traveler in details and allows adding another number while editing", async () => {
  const item = {
    id: "work-1", startDate: new Date("2026-09-01"), endDate: new Date("2026-09-02"),
    employeeList: [idOnly], postedByUserId: "me", postedByUser: { firstName: "ผู้บันทึก", lastName: "ทดสอบ" },
  } as OffSiteWorkWithRelations;
  mount([item]);
  fireEvent.click(screen.getByRole("button", { name: "ดูรายละเอียดคำสั่ง work-1" }));
  expect(screen.getByText("ยังไม่มีข้อมูลชื่อ")).toBeTruthy();
  expect(screen.getByText("ยังไม่เชื่อมบัญชี")).toBeTruthy();
  fireEvent.click(screen.getByText("ปิด", { selector: "button" }));
  fireEvent.click(await screen.findByRole("button", { name: "แก้ไขคำสั่ง work-1" }));
  fireEvent.change(screen.getByPlaceholderText("ค้นหาชื่อ / รหัสพนักงาน"), { target: { value: "000002" } });
  fireEvent.click(screen.getByRole("button", { name: "เพิ่มด้วยรหัสพนักงาน" }));
  fireEvent.click(screen.getByRole("button", { name: "อัปเดต" }));
  await waitFor(() => expect(mock.update).toHaveBeenCalledWith("work-1", expect.objectContaining({
    employeeList: [idOnly, { ...idOnly, employeeId: "000002" }],
  })));
});
