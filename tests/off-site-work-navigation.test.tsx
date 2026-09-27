// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { workflowTheme } from "@/components/workflow-ui/theme";
import { installPickerMedia } from "./helpers/picker-media";
import type { OffSiteWorkWithRelations } from "@/lib/domains/off-site-work/types";

const mock = vi.hoisted(() => ({
  get: vi.fn(),
  toast: vi.fn(),
  router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: mock.toast } }));
vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react");
  const subscribe = (listener: () => void) => {
    window.addEventListener("popstate", listener);
    return () => window.removeEventListener("popstate", listener);
  };
  return {
    useRouter: () => mock.router,
    useSearchParams: () => new URLSearchParams(useSyncExternalStore(
      subscribe,
      () => window.location.search,
    )),
  };
});
vi.mock("@/lib/hooks/use-scoped-permission", () => ({
  useScopedPermission: () => ({ userId: "me", allows: () => true }),
}));
vi.mock("@/app/actions/off-site-work", () => ({
  getOffSiteWork: mock.get,
  createOffSiteWork: vi.fn(),
  updateOffSiteWork: vi.fn(),
  listOffSiteWorks: vi.fn(),
  deleteOffSiteWork: vi.fn(),
  matchOffSiteWorkEmployees: vi.fn(),
}));
vi.mock("@/app/actions/user", () => ({ searchUsersForLeader: vi.fn() }));
vi.mock("@/app/off-site-work/pdf-import", () => ({ PdfImport: () => null }));
import { OffSiteWorkClient } from "@/app/off-site-work/off-site-work-client";

function item(id: string): OffSiteWorkWithRelations {
  return {
    id,
    innerRefDocumentId: null,
    startDate: new Date("2026-09-01"),
    endDate: new Date("2026-09-02"),
    objective: `วัตถุประสงค์ ${id}`,
    location: `สถานที่ ${id}`,
    employeeList: [],
    postedAt: new Date("2026-09-01"),
    postedByUserId: "me",
    postedByUser: { id: "me", firstName: "ผู้บันทึก", lastName: "ทดสอบ", email: "test@example.com", employeeId: null },
    updatedAt: null,
    deletedAt: null,
    originalFileId: null,
    originalFile: null,
    leaderUserId: null,
    leaderUser: null,
    leaderEmpId: null,
    leaderFirstName: null,
    leaderLastName: null,
    leaderPosition: null,
    leaderEmail: null,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function mount(items: OffSiteWorkWithRelations[] = []) {
  return render(<ThemeProvider theme={workflowTheme}>
    <OffSiteWorkClient initialItems={items} initialPagination={null} />
  </ThemeProvider>);
}

function navigate(search: string) {
  act(() => window.history.pushState(null, "", `/dashboard?${search}`));
}

async function traverse(direction: "back" | "forward") {
  await act(async () => {
    const changed = new Promise<void>((resolve) => {
      window.addEventListener("popstate", () => resolve(), { once: true });
    });
    window.history[direction]();
    await changed;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  installPickerMedia(false);
  window.history.replaceState(null, "", "/dashboard?tab=off-site-work");
  // Next patches native history so useSearchParams follows pushState/replaceState.
  // Mirror that integration while retaining jsdom's real Back/Forward history.
  for (const method of ["pushState", "replaceState"] as const) {
    const original = window.history[method].bind(window.history);
    vi.spyOn(window.history, method).mockImplementation((...args) => {
      original(...args);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
  }
  mock.router.push.mockImplementation((url: string) => window.history.pushState(null, "", url));
  mock.router.replace.mockImplementation((url: string) => window.history.replaceState(null, "", url));
  mock.get.mockImplementation(async (id: string) => ({ success: true, data: item(id) }));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("loads an authorized deep link outside the table, shows loading immediately, and survives remount", async () => {
  const pending = deferred<{ success: true; data: OffSiteWorkWithRelations }>();
  const id = "คำสั่ง / 1&2";
  mock.get.mockReturnValueOnce(pending.promise);
  navigate(`tab=off-site-work&search=other&page=3&offSiteWorkId=${encodeURIComponent(id)}`);
  const first = mount();
  const dialog = screen.getByRole("dialog", { name: "รายละเอียดคำสั่ง" });
  expect(mock.get).toHaveBeenCalledWith(id);
  expect(within(dialog).queryByText(`สถานที่ ${id}`)).toBeNull();
  await act(async () => pending.resolve({ success: true, data: item(id) }));
  expect(within(dialog).getByText(`สถานที่ ${id}`)).toBeTruthy();

  first.unmount();
  mount();
  await screen.findByText(`สถานที่ ${id}`);
  expect(mock.get).toHaveBeenCalledTimes(2);
  expect(new URLSearchParams(window.location.search).get("offSiteWorkId")).toBe(id);
});

it("authorizes an Eye click through the server even when the record is in the table", async () => {
  const pending = deferred<{ success: false; error: string }>();
  mock.get.mockReturnValue(pending.promise);
  mount([item("work-1")]);
  fireEvent.click(screen.getByRole("button", { name: "ดูรายละเอียดคำสั่ง work-1" }));
  expect(new URLSearchParams(window.location.search).get("offSiteWorkId")).toBe("work-1");
  expect(mock.get).toHaveBeenCalledWith("work-1");
  expect(within(screen.getByRole("dialog")).queryByText("สถานที่ work-1")).toBeNull();
  await act(async () => pending.resolve({ success: false, error: "ไม่มีสิทธิ์เข้าถึงคำสั่ง" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(mock.toast).toHaveBeenCalled();
});

it("also authorizes a deep-linked record already present in initialItems", async () => {
  navigate("tab=off-site-work&offSiteWorkId=work-1");
  mount([item("work-1")]);
  await waitFor(() => expect(mock.get).toHaveBeenCalledWith("work-1"));
  await waitFor(() => expect(within(screen.getByRole("dialog")).getByText("สถานที่ work-1")).toBeTruthy());
});

it("closes a pending detail without losing list parameters and ignores its late result", async () => {
  const pending = deferred<{ success: true; data: OffSiteWorkWithRelations }>();
  mock.get.mockReturnValue(pending.promise);
  navigate("tab=off-site-work&search=โรงไฟฟ้า&page=3&pageSize=12&offSiteWorkId=slow");
  mount();
  fireEvent.click(screen.getByText("ปิด", { selector: "button" }));
  expect(new URLSearchParams(window.location.search)).toEqual(new URLSearchParams({
    tab: "off-site-work", search: "โรงไฟฟ้า", page: "3", pageSize: "12",
  }));
  await act(async () => pending.resolve({ success: true, data: item("slow") }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(screen.queryByText("สถานที่ slow")).toBeNull();
  expect(mock.toast).not.toHaveBeenCalled();
});

it("uses browser Back/Forward to close and reopen the linked record", async () => {
  mount([item("work-1")]);
  fireEvent.click(screen.getByRole("button", { name: "ดูรายละเอียดคำสั่ง work-1" }));
  await waitFor(() => expect(within(screen.getByRole("dialog")).getByText("สถานที่ work-1")).toBeTruthy());
  await traverse("back");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(new URLSearchParams(window.location.search).has("offSiteWorkId")).toBe(false);
  const pending = deferred<{ success: true; data: OffSiteWorkWithRelations }>();
  mock.get.mockReturnValueOnce(pending.promise);
  await traverse("forward");
  expect(within(screen.getByRole("dialog")).queryByText("สถานที่ work-1")).toBeNull();
  expect(within(screen.getByRole("dialog")).getByRole("status")).toBeTruthy();
  await act(async () => pending.resolve({ success: true, data: item("work-1") }));
  await waitFor(() => expect(within(screen.getByRole("dialog")).getByText("สถานที่ work-1")).toBeTruthy());
  expect(mock.get).toHaveBeenCalledTimes(2);
});

it("replaces the selected record when the URL changes and ignores an older response", async () => {
  const pending = deferred<{ success: true; data: OffSiteWorkWithRelations }>();
  mock.get.mockReturnValueOnce(pending.promise);
  navigate("tab=off-site-work&offSiteWorkId=old");
  mount();
  navigate("tab=off-site-work&offSiteWorkId=new");
  await screen.findByText("สถานที่ new");
  await act(async () => pending.resolve({ success: true, data: item("old") }));
  expect(screen.getByText("สถานที่ new")).toBeTruthy();
  expect(screen.queryByText("สถานที่ old")).toBeNull();
  await traverse("back");
  await screen.findByText("สถานที่ old");
  expect(screen.queryByText("สถานที่ new")).toBeNull();
});

it.each(["unauthorized", "not found", "transport"])("clears previous details and reports a %s failure", async (failure) => {
  navigate("tab=off-site-work&offSiteWorkId=first");
  mount();
  await screen.findByText("สถานที่ first");
  if (failure === "transport") mock.get.mockRejectedValueOnce(new Error("offline"));
  else mock.get.mockResolvedValueOnce({ success: false, error: failure });
  navigate("tab=off-site-work&offSiteWorkId=unavailable");
  await waitFor(() => expect(mock.toast).toHaveBeenCalled());
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(screen.queryByText("สถานที่ first")).toBeNull();
  expect(new URLSearchParams(window.location.search).has("offSiteWorkId")).toBe(false);
});
