import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const rendererPath = resolve(process.cwd(), "tests/e2e/render-mrc-print.tsx");

function renderDocument(status: "DRAFT" | "FINALIZED"): string {
  const rendererEnvironment = { ...process.env };
  delete rendererEnvironment.DATABASE_URL;
  delete rendererEnvironment.TEST_DATABASE_URL;

  return execFileSync("bun", [rendererPath, status], {
    encoding: "utf8",
    env: rendererEnvironment,
  });
}

async function mountPrintDocument(
  page: Page,
  status: "DRAFT" | "FINALIZED",
): Promise<void> {
  await page.setViewportSize({ width: 794, height: 1123 });
  await page.emulateMedia({ media: "print" });
  await page.setContent(renderDocument(status), { waitUntil: "domcontentloaded" });
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const layout = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const documentWidth = Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
    );
    const sections = Array.from(document.querySelectorAll<HTMLElement>(".sheet"))
      .map((sheet) => {
        const bounds = sheet.getBoundingClientRect();
        return { left: bounds.left, right: bounds.right };
      });

    return { viewportWidth, documentWidth, sections };
  });

  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
  for (const section of layout.sections) {
    expect(section.left).toBeGreaterThanOrEqual(-0.5);
    expect(section.right).toBeLessThanOrEqual(layout.viewportWidth + 0.5);
  }
}

test.describe("pure MRC print document smoke", () => {
  test("renders an official summary, one paper signature, and the date appendix", async ({
    page,
  }) => {
    await mountPrintDocument(page, "FINALIZED");

    await expect(page.locator(".sheet")).toHaveCount(2);
    await expect(page.locator(".watermark")).toHaveCount(0);
    await expect(page.locator(".signature")).toHaveCount(1);
    await expect(page.locator(".signature")).toContainText("ลงชื่อ");
    await expect(page.locator(".signature")).toContainText("หผ.");
    await expect(page.locator(".signature")).toContainText("ประทับชื่อ");
    await expect(page.locator(".signature")).toContainText("วันที่");

    await expect(page.locator(".subtitle")).toContainText(
      "ฝ่าย snapshot สำหรับเอกสาร",
    );
    await expect(page.locator(".appendix-title")).toContainText(
      "ภาคผนวกวันปฏิบัติงานและเลขรหัส WeSafe",
    );
    await expect(page.locator(".sheet").nth(1)).toContainText("กฟก.1/2569");
    await expect(page.locator(".sheet").nth(1)).toContainText(
      "WSZ2026HZ0000017489",
    );
    await expect(page.locator(".sheet").nth(1)).toContainText("วันแม่แห่งชาติ");
    await expectNoHorizontalOverflow(page);
  });

  test("renders the Draft watermark on every summary and appendix sheet", async ({
    page,
  }) => {
    await mountPrintDocument(page, "DRAFT");

    const sheets = page.locator(".sheet");
    await expect(sheets).toHaveCount(2);
    await expect(page.locator(".watermark")).toHaveCount(2);
    for (let index = 0; index < 2; index += 1) {
      await expect(sheets.nth(index).locator(".watermark")).toHaveText(
        "ฉบับร่าง · ใช้ตรวจสอบเท่านั้น",
      );
    }
    await expect(page.locator(".status")).toHaveText("DRAFT");
    await expect(page.locator(".signature")).toHaveCount(1);
    await expect(page.locator(".appendix-title")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
