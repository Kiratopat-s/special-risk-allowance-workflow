// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { workflowTheme } from "@/components/workflow-ui/theme";
import { installPickerMedia } from "./helpers/picker-media";
import type { EmployeeListItem, OffSiteWorkWithRelations } from "@/lib/domains/off-site-work/types";

const mock = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), search: vi.fn(), match: vi.fn(), toast: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: mock.toast, error: mock.toast } }));
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
  matchOffSiteWorkEmployees: mock.match,
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
  mock.match.mockResolvedValue({ success: true, data: [] });
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
  await screen.findByText("รหัสพนักงาน 000001");
  expect(mock.match).toHaveBeenCalledWith(["000001"]);
  for (const label of ["รหัสพนักงาน", "ชื่อ", "นามสกุล", "ตำแหน่ง", "สังกัด"]) {
    expect(screen.queryByLabelText(`${label} ผู้เดินทาง 1`)).toBeNull();
  }
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
  expect(screen.getByText("รอข้อมูลจากบัญชีผู้ใช้")).toBeTruthy();
  expect(screen.getByText("ยังไม่เชื่อมบัญชี")).toBeTruthy();
  fireEvent.click(screen.getByText("ปิด", { selector: "button" }));
  fireEvent.click(await screen.findByRole("button", { name: "แก้ไขคำสั่ง work-1" }));
  fireEvent.change(screen.getByPlaceholderText("ค้นหาชื่อ / รหัสพนักงาน"), { target: { value: "000002" } });
  fireEvent.click(screen.getByRole("button", { name: "เพิ่มด้วยรหัสพนักงาน" }));
  await screen.findByText("รหัสพนักงาน 000002");
  const update = screen.getByRole("button", { name: "อัปเดต" }) as HTMLButtonElement;
  await waitFor(() => expect(update.disabled).toBe(false));
  fireEvent.click(update);
  await waitFor(() => expect(mock.update).toHaveBeenCalledWith("work-1", expect.objectContaining({
    employeeList: [idOnly, { ...idOnly, employeeId: "000002" }],
  })));
});

it("immediately displays a registered account and submits its full profile", async () => {
  const account = { ...idOnly, userId: "user-1", firstName: "ชื่อจากบัญชี", lastName: "นามสกุล", position: "ช่างจากบัญชี", departmentId: "dept-1", departmentName: "สังกัดจากบัญชี" };
  mock.match.mockResolvedValue({ success: true, data: [account] });
  mount();
  fireEvent.click(screen.getByRole("button", { name: "เพิ่มคำสั่ง" }));
  fireEvent.change(screen.getByPlaceholderText("ค้นหาชื่อ / รหัสพนักงาน"), { target: { value: "000001" } });
  fireEvent.click(screen.getByRole("button", { name: "เพิ่มด้วยรหัสพนักงาน" }));
  await screen.findByText("ชื่อจากบัญชี นามสกุล");
  expect(screen.getByText("ช่างจากบัญชี")).toBeTruthy();
  expect(screen.queryByText("รอเชื่อมบัญชี · เก็บเฉพาะรหัสพนักงาน")).toBeNull();
  const save = screen.getByRole("button", { name: "บันทึก" }) as HTMLButtonElement;
  await waitFor(() => expect(save.disabled).toBe(false));
  fireEvent.click(save);
  await waitFor(() => expect(mock.create).toHaveBeenCalledWith(expect.objectContaining({ employeeList: [account] })));
});

it.each(["service", "transport"])("does not treat a %s lookup failure as an unregistered employee", async (failure) => {
  if (failure === "service") mock.match.mockResolvedValue({ success: false, error: "ตรวจสอบไม่ได้" });
  else mock.match.mockRejectedValue(Error("offline"));
  mount();
  fireEvent.click(screen.getByRole("button", { name: "เพิ่มคำสั่ง" }));
  const search = screen.getByPlaceholderText("ค้นหาชื่อ / รหัสพนักงาน") as HTMLInputElement;
  fireEvent.change(search, { target: { value: "000001" } });
  fireEvent.click(screen.getByRole("button", { name: "เพิ่มด้วยรหัสพนักงาน" }));
  await waitFor(() => expect(mock.toast).toHaveBeenCalled());
  expect(search.value).toBe("000001");
  expect(screen.queryByText("รหัสพนักงาน 000001")).toBeNull();
  expect(screen.getByText("ยังไม่มีพนักงานในรายการ")).toBeTruthy();
});

it("waits for the lookup before saving or closing and does not add twice", async () => {
  let finish!: (result: unknown) => void;
  mock.match.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  mount();
  fireEvent.click(screen.getByRole("button", { name: "เพิ่มคำสั่ง" }));
  const search = screen.getByPlaceholderText("ค้นหาชื่อ / รหัสพนักงาน") as HTMLInputElement;
  fireEvent.change(search, { target: { value: "000001" } });
  const add = screen.getByRole("button", { name: "เพิ่มด้วยรหัสพนักงาน" }) as HTMLButtonElement;
  fireEvent.click(add);
  expect(add.disabled).toBe(true);
  expect(search.disabled).toBe(true);
  expect((screen.getByRole("button", { name: "บันทึก" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "ยกเลิก" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(add);
  expect(mock.match).toHaveBeenCalledTimes(1);
  await act(async () => finish({ success: true, data: [] }));
  expect(screen.getAllByText("รหัสพนักงาน 000001")).toHaveLength(1);
});
