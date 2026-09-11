// @vitest-environment jsdom
import { afterEach, beforeEach, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mock = vi.hoisted(() => ({
  auth: vi.fn(),
  access: vi.fn(),
  find: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: mock.auth }));
vi.mock("@/lib/auth/permissions", () => ({ canAny: mock.access }));
vi.mock("@/lib/domains/monthly-request-collection", () => ({
  monthlyRequestCollectionRepository: { findWithRelations: mock.find },
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
const signature = Buffer.from("isolated-signature-fixture");
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
    approvalSteps: ["HPA_CHECK", "RK_CHECK", "OK_APPROVE"].map((stage) => ({
      stage,
      status: "APPROVED",
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
  mock.access.mockResolvedValue(true);
});
afterEach(() => {
  document.body.innerHTML = "";
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
    expect(pages.at(-1)?.querySelectorAll(".sig-image")).toHaveLength(3);
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
  data.approvalSteps[1].status = "PENDING";
  mock.find.mockResolvedValue(data);
  document.body.innerHTML = renderToStaticMarkup(
    await PrintPage({ params: Promise.resolve({ id: "fixture" }) }),
  );
  expect(document.querySelectorAll(".sig-image")).toHaveLength(2);
});
it("retains the print permission guard", async () => {
  mock.access.mockResolvedValue(false);
  await expect(
    PrintPage({ params: Promise.resolve({ id: "fixture" }) }),
  ).rejects.toThrow("redirect:/");
});
