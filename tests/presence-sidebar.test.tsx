// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const presence = vi.hoisted(() => ({ status: "live", count: 1000 as number | null }));
vi.mock("@/components/presence-provider", () => ({ usePresence: () => presence }));
import { OnlineUserCount } from "@/components/workflow-ui/online-user-count";

afterEach(cleanup);

it.each([
  ["live", 1000, "1,000 คน", "ใช้งานใน 3 นาทีล่าสุด"],
  ["loading", null, "—", "กำลังโหลดจำนวนผู้ใช้"],
  ["stale", 12, "12 คน", "ข้อมูลล่าสุด · กำลังเชื่อมต่อใหม่"],
  ["unavailable", null, "—", "อัปเดตไม่ได้ชั่วคราว"],
] as const)("announces %s with readable counts and a non-color status", (status, count, value, description) => {
  Object.assign(presence, { status, count });
  const { container } = render(<OnlineUserCount />);
  expect(screen.getByRole("status").textContent).toContain(`ออนไลน์${value}`);
  expect(screen.getByRole("status").textContent).toContain(description);
  expect(container.querySelector(".sidebar-presence")?.getAttribute("data-status")).toBe(status);
  expect(container.querySelector(".sidebar-presence-dot")?.getAttribute("aria-hidden")).toBe("true");
});

it("hides the count when there is no valid signed-in user", () => {
  Object.assign(presence, { status: "disabled", count: null });
  const { container } = render(<OnlineUserCount />);
  expect(container.firstChild).toBeNull();
});
