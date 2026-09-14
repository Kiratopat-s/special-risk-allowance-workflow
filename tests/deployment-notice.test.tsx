// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ThemeProvider } from "@mui/material/styles";
import { workflowTheme } from "@/components/workflow-ui/theme";
import { alignmentDepartments } from "./fixtures/ui-alignment";

const mocks = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("@/lib/deployment/version", () => ({ DEPLOYMENT_VERSION: "build-a" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(), usePathname: () => "/admin/departments" }));
vi.mock("@/app/actions/department", () => ({
  updateDepartment: mocks.update,
  createDepartment: vi.fn(), deleteDepartment: vi.fn(), toggleDepartmentStatus: vi.fn(), listAllDepartments: vi.fn(),
}));
import { DeploymentNotice } from "@/components/deployment-notice";
import { DepartmentsClient } from "@/app/admin/departments/departments-client";
import { checkDeploymentVersion, runServerAction } from "@/lib/deployment/client";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

it("checks visible tabs periodically and removes listeners and timers on unmount", async () => {
  vi.useFakeTimers();
  const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  const fetcher = vi.fn().mockResolvedValue(Response.json({ version: "build-a" }));
  vi.stubGlobal("fetch", fetcher);
  const view = render(<DeploymentNotice />);
  await act(async () => { await Promise.resolve(); });
  expect(fetcher).toHaveBeenCalledTimes(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
  expect(fetcher).toHaveBeenCalledTimes(2);
  visibility.mockReturnValue("hidden");
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
  expect(fetcher).toHaveBeenCalledTimes(2);
  visibility.mockReturnValue("visible");
  await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
  expect(fetcher).toHaveBeenCalledTimes(3);
  await act(async () => { window.dispatchEvent(new Event("focus")); });
  expect(fetcher).toHaveBeenCalledTimes(4);
  view.unmount();
  await vi.advanceTimersByTimeAsync(60_000);
  window.dispatchEvent(new Event("focus"));
  expect(fetcher).toHaveBeenCalledTimes(4);
});

it("preserves a real edit dialog after a missing action and blocks repeated submissions", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ version: "build-a" })));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  const error = new Error("Server Action is unavailable");
  error.name = "UnrecognizedActionError";
  mocks.update.mockRejectedValue(error);
  render(<ThemeProvider theme={workflowTheme}>
    <DeploymentNotice />
    <DepartmentsClient initialDepartments={alignmentDepartments} />
  </ThemeProvider>);
  fireEvent.click(screen.getByRole("button", { name: `Edit ${alignmentDepartments[0].name}` }));
  const name = screen.getByDisplayValue(alignmentDepartments[0].name);
  fireEvent.change(name, { target: { value: "Unsaved department name" } });
  const dialog = screen.getByRole("dialog");
  fireEvent.click(await within(dialog).findByRole("button", { name: /save|update/i }));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("มีระบบเวอร์ชันใหม่"));
  expect(screen.getByDisplayValue("Unsaved department name")).toBeTruthy();
  expect(screen.getByRole("button", { name: "รีเฟรชหน้า" })).toBeTruthy();
  fireEvent.click(await within(dialog).findByRole("button", { name: /save|update/i }));
  await act(async () => { await checkDeploymentVersion(); });
  expect(mocks.update).toHaveBeenCalledTimes(1);
  expect(screen.getByDisplayValue("Unsaved department name")).toBeTruthy();
  const backgroundAction = vi.fn();
  expect(await runServerAction(backgroundAction)).toBeUndefined();
  expect(backgroundAction).not.toHaveBeenCalled();
});
