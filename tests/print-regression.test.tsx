// @vitest-environment jsdom
import { afterEach, beforeEach, it, expect, vi } from "vitest";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
const mock = vi.hoisted(() => ({
  auth: vi.fn(),
  access: vi.fn(),
  find: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: mock.auth }));
vi.mock("@/lib/auth/permissions", () => ({ canAny: mock.access }));
vi.mock("@/lib/domains/monthly-request-collection", () => ({
  monthlyRequestCollectionService: { getSummaryPrintData: async (...args: unknown[]) => mock.access() ? { success: true, data: await mock.find(...args) } : { success: false, code: "PERMISSION_DENIED" } },
}));
vi.mock("@/app/monthly-request-collection/[id]/print-client", () => ({
  PrintPageControls: () => null,
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
  notFound: () => {
    throw new Error("not found");
  },
}));
import PrintPage from "@/app/monthly-request-collection/[id]/print/page";
const signature = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAHgAAAA4CAYAAAA2PDy+AAAAy0lEQVR4nO3RMQ7DIBBEUV+D+x+UVCkjRbJhWO8rXjta+Nec8+K94gcgMAIjcFPxAxAYgRG4qfgBCIzACNxU/AAERmAEbip+AAIjMAI3FT8AgTk58Bhjftnfv7818IrH2D808FOPsR8O/KbPqrh/65DTHtNhf2vg6p9VcT8WuOJnVdzfEvgtn1V9f3ngfx5jf8/+8sC/HmN///7ywJwjfgACIzACNxU/AIERGIGbih+AwAiMwE3FD0BgBEbgpuIHIDACI3BT8QMQmBs++1WRbru9fxMAAAAASUVORK5CYII=", "base64");
function fixture(count: number) {
  return {
    id: "fixture",
    collectForMonth: new Date("2026-09-01"),
    collector: { firstName: "ผู้", lastName: "รวบรวม" },
    expenseClaims: Array.from({ length: count }, (_, index) => ({
      id: `claim-${index}`,
      countDates: "2.00",
      amount: "300.00",
      claimantPositionAtSubmission: "ตำแหน่งที่บันทึก",
      claimant: {
        employeeId: String(count - index).padStart(5, "0"),
        firstName: "ชื่อทดสอบ",
        lastName: String(index),
        department: { shortName: "กองทดสอบ" },
      },
    })),
    approvalSteps: ["HPA_CHECK"].map((stage) => ({
      stage,
      status: "APPROVED",
      signatureData: signature,
      reviewerNameAtApproval: "ผู้ ลงนามเดิม",
      reviewerPositionAtApproval: "หผ. 8",
      reviewedAt: new Date("2026-09-10"),
      reviewer: {
        firstName: "ผู้",
        lastName: "อนุมัติ",
        positionShort: "หผ.",
        signatures: [{ signatureData: signature }],
      },
    })),
  };
}
beforeEach(() => {
  mock.auth.mockResolvedValue({ user: { dbUserId: "me" } });
  mock.access.mockReturnValue(true);
});
afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});
it("prints Buddhist accounting months and Thai-time approval and print dates", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-12-31T18:00:00Z"));
  const data = fixture(1);
  data.collectForMonth = new Date("2026-12-01T00:00:00Z");
  data.approvalSteps[0].reviewedAt = new Date("2026-12-31T18:00:00Z");
  mock.find.mockResolvedValue(data);
  const html = renderToStaticMarkup(await PrintPage({ params: Promise.resolve({ id: "fixture" }) }));
  document.body.innerHTML = html;
  expect(document.body.textContent).toContain("ธันวาคม 2569");
  expect(document.body.textContent).toContain("1 มกราคม 2570");
  expect(document.body.textContent).not.toContain("2026");
  expect(document.querySelectorAll(".sig-image")).toHaveLength(1);
});
it.each([
  [0, [0]],
  [12, [12]],
  [13, [1, 12]],
  [34, [22, 12]],
  [35, [12, 11, 12]],
  [56, [22, 22, 12]],
  [57, [15, 15, 15, 12]],
] as [number, number[]][])(
  "preserves official pagination, totals, and signatures with %i claims",
  async (count, expectedRows) => {
    mock.find.mockResolvedValue(fixture(count));
    const html = renderToStaticMarkup(
      await PrintPage({ params: Promise.resolve({ id: "fixture" }) }),
    );
    if (process.env.MRC_PRINT_PREVIEW_DIR && [12, 35].includes(count)) {
      writeFileSync(join(process.env.MRC_PRINT_PREVIEW_DIR, `${count}.html`), `<!doctype html><html lang="th"><meta charset="utf-8"><body>${html}</body></html>`);
    }
    document.body.innerHTML = html;
    const pages = Array.from(document.querySelectorAll(".print-sheet"));
    expect(
      pages.map(
        (page) => page.querySelectorAll("tbody tr:not(.total-row)").length,
      ),
    ).toEqual(expectedRows);
    expect(document.querySelectorAll(".total-row")).toHaveLength(1);
    expect(document.querySelector(".total-row")?.textContent).toContain(
      String(count * 2),
    );
    expect(document.querySelector(".total-row")?.textContent).toContain(
      (count * 300).toLocaleString("th-TH", { minimumFractionDigits: 2 }),
    );
    expect(document.querySelectorAll(".signatures")).toHaveLength(1);
    expect(pages.at(-1)?.querySelectorAll(".sig-image")).toHaveLength(1);
    expect(document.querySelector(".sig-image")?.getAttribute("src")).toBe(
      `data:image/png;base64,${signature.toString("base64")}`,
    );
    expect(html).toContain("/font/THSarabun.ttf");
    expect(html).toContain("size: A4 portrait");
    expect(html).not.toContain("Mui");
    expect(html).not.toContain("workspace-header");
    if (count) {
      expect(
        document.querySelector("tbody tr td:nth-child(2)")?.textContent,
      ).toBe("00001");
      expect(html).toContain("ตำแหน่งที่บันทึก");
    }
  },
);
it("does not show a signature for an unapproved stage", async () => {
  const data = fixture(1);
  data.approvalSteps[0].status = "PENDING";
  mock.find.mockResolvedValue(data);
  document.body.innerHTML = renderToStaticMarkup(
    await PrintPage({ params: Promise.resolve({ id: "fixture" }) }),
  );
  expect(document.querySelectorAll(".sig-image")).toHaveLength(0);
});
it("retains the print permission guard", async () => {
  mock.access.mockReturnValue(false);
  await expect(
    PrintPage({ params: Promise.resolve({ id: "fixture" }) }),
  ).rejects.toThrow("redirect:/");
});

it("prints the saved signer even if the current profile/signature changes", async () => {
  const data = fixture(1);
  data.approvalSteps[0].reviewer.firstName = "ชื่อใหม่";
  data.approvalSteps[0].reviewer.signatures = [];
  mock.find.mockResolvedValue(data);
  document.body.innerHTML = renderToStaticMarkup(await PrintPage({ params: Promise.resolve({ id: "fixture" }) }));
  expect(document.body.textContent).toContain("ผู้ ลงนามเดิม");
  expect(document.body.textContent).toContain("หผ. 8");
  expect(document.body.textContent).not.toContain("ชื่อใหม่");
  expect(document.body.textContent).not.toContain("รก.");
  expect(document.body.textContent).not.toContain("อก.");
  expect(document.querySelectorAll(".sig-block")).toHaveLength(1);
  expect(document.querySelector(".sig-image")?.getAttribute("src")).toContain(signature.toString("base64"));
});
