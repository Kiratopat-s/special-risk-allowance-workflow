import { describe, expect, it } from "vitest";
import { paginateMeasuredClaim, type ClaimPrintMeasurements } from "./claim-print-pagination";

function measurements(rows: number[]): ClaimPrintMeasurements {
  return { capacity: 400, rowHeights: rows, blankRowHeight: 40, noteOverhead: 30, lineHeight: 20,
    measureNote: (text) => Math.max(20, Math.ceil([...text].length / 20) * 20) };
}

describe("measured print pagination", () => {
  it.each([0, 1, 5, 6, 11, 25])("preserves every order exactly once with %i rows", (count) => {
    const pages = paginateMeasuredClaim([], measurements(Array(count).fill(40)));
    expect(pages.flatMap((page) => page.rowIndices)).toEqual(Array.from({ length: count }, (_, i) => i));
    expect(pages.every((page) => page.rowIndices.length <= 5)).toBe(true);
    expect(pages.length).toBe(Math.max(1, Math.ceil(count / 5)));
    expect(pages[0].rowIndices.length + pages[0].blankRows).toBe(5);
  });
  it("moves a tall row as a unit including its signature", () => {
    const pages = paginateMeasuredClaim([], measurements([200, 250, 60]));
    expect(pages.map((p) => p.rowIndices)).toEqual([[0], [1, 2]]);
  });
  it("keeps all Thai notes across continuation pages without losing combining characters", () => {
    const notes = ["ข้อความภาษาไทยพร้อมสระและวรรณยุกต์ ".repeat(100), "REF-123"];
    const pages = paginateMeasuredClaim(notes, measurements([40, 40]));
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.map((p) => p.noteText).join("")).toBe(notes.join("\n"));
    expect(pages.slice(1).every((page) => page.blankRows === 0)).toBe(true);
  });
  it("reports an impossible single-row overflow instead of clipping or dropping it", () => {
    expect(() => paginateMeasuredClaim([], measurements([401]))).toThrow("แถวที่ 1");
  });
});
