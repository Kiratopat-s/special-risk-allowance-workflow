import { describe, expect, it } from "vitest";
import { claimSelectionChanged, normalizeClaimSelection } from "./claim-selection";
import type { EligibleOffSiteWorkOption } from "./types";

const work: EligibleOffSiteWorkOption = {
  id: "work1", innerRefDocumentId: "001", startDate: new Date("2026-09-02"), endDate: new Date("2026-09-05"),
  hasLeader: true, location: null, objective: null, leaderFirstName: null, leaderLastName: null, leaderEmail: null,
};
const input = { expenseMonth: "2026-09-01", offSiteWorkIds: ["work1"], selectedDates: ["2026-09-02"] };

describe("claim selection validation", () => {
  it("deduplicates and sorts dates/work IDs and derives the payable totals", () => {
    expect(normalizeClaimSelection({ ...input, selectedDates: ["2026-09-05", "2026-09-02", "2026-09-02"], offSiteWorkIds: ["work1", "work1"] }, [work], true))
      .toMatchObject({ success: true, data: { selectedDates: ["2026-09-02", "2026-09-05"], offSiteWorkIds: ["work1"], countDates: 2, amount: 300 } });
  });

  it.each(["not-a-date", "2026-09-31", "2026-02-29", "2026-9-02", "2026-09-02T00:00:00Z"])("rejects invalid calendar value %s", (date) => {
    expect(normalizeClaimSelection({ ...input, selectedDates: [date] }, [work], true)).toMatchObject({ code: "INVALID_SELECTED_DATES" });
  });

  it("rejects dates outside the month even when covered by a cross-month order", () => {
    expect(normalizeClaimSelection({ ...input, selectedDates: ["2026-10-01"] }, [{ ...work, endDate: new Date("2026-10-05") }], true))
      .toMatchObject({ code: "SELECTED_DATE_OUTSIDE_MONTH" });
  });

  it("rejects dates outside the selected works and unknown/ineligible work IDs", () => {
    expect(normalizeClaimSelection({ ...input, selectedDates: ["2026-09-06"] }, [work], true)).toMatchObject({ code: "SELECTED_DATE_OUTSIDE_WORK" });
    expect(normalizeClaimSelection({ ...input, offSiteWorkIds: ["someone-elses-work"] }, [work], true)).toMatchObject({ code: "INELIGIBLE_OFF_SITE_WORK" });
  });

  it("clears a draft to zero but requires dates and leaders before submission", () => {
    expect(normalizeClaimSelection({ expenseMonth: "2026-09-01", selectedDates: [], offSiteWorkIds: [] }, [work], false))
      .toMatchObject({ success: true, data: { selectedDates: [], offSiteWorkIds: [], countDates: 0, amount: 0 } });
    expect(normalizeClaimSelection({ ...input, selectedDates: [] }, [work], true)).toMatchObject({ code: "CLAIM_SELECTION_REQUIRED" });
    expect(normalizeClaimSelection(input, [{ ...work, hasLeader: false }], true)).toMatchObject({ code: "OSW_MISSING_LEADER" });
    expect(normalizeClaimSelection(input, [{ ...work, hasLeader: false }], false).success).toBe(true);
  });

  it("treats reordered equivalent selections as unchanged but invalid totals as a material correction", () => {
    const selection = normalizeClaimSelection({ ...input, selectedDates: ["2026-09-03", "2026-09-02"] }, [work], true);
    if (!selection.success) throw new Error(selection.error);
    const existing = { ...selection.data, selectedDates: ["2026-09-03", "2026-09-02", "2026-09-02"] };
    expect(claimSelectionChanged(existing, selection.data)).toBe(false);
    expect(claimSelectionChanged({ ...existing, amount: 999 }, selection.data)).toBe(true);
    expect(claimSelectionChanged({ ...existing, selectedDates: ["2026-09-04", "2026-09-02"] }, selection.data)).toBe(true);
  });
});
