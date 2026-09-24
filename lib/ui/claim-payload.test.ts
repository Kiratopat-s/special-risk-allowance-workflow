import { describe, it, expect } from "vitest";
import { claimCreatePayload, claimUpdatePayload, type ClaimFormState } from "./claim-payload";
import type { ExpenseClaimDocumentWithRelations } from "@/lib/domains/expense-claim-document/types";
const form: ClaimFormState = {
  expenseMonth: "2026-09",
  claimantPositionAtSubmission: " พชง. 5 ",
  remark: " note ",
};
const selected = {
  expenseMonth: new Date("2026-09-01"),
  claimantPositionAtSubmission: "พชง. 5",
  remark: "note",
  status: "DRAFT",
  countDates: 2,
  amount: 300,
  monthlyRequestCollectionId: null,
} as ExpenseClaimDocumentWithRelations;

describe("date-based claim mutation payloads", () => {
  it("sends dates and work links without accepting editable totals", () => {
    expect(claimCreatePayload(form, ["work"], ["2026-09-01", "2026-09-02"], "PENDING_LEADER_VERIFY"))
      .toEqual({
        expenseMonth: "2026-09-01", claimantPositionAtSubmission: "พชง. 5",
        offSiteWorkIds: ["work"], selectedDates: ["2026-09-01", "2026-09-02"],
        remark: "note", status: "PENDING_LEADER_VERIFY",
      });
  });
  it.each(["DRAFT", "PENDING", "PENDING_LEADER_VERIFY", "WAIT_FOR_COLLECTION", "REJECTED"] as const)(
    "%s edits send actual dates without client totals or a status override", (status) => {
      const result = claimUpdatePayload({ ...selected, status }, { ...form, remark: "" }, ["another-work"], ["2026-09-03"]);
      expect(result).toMatchObject({ offSiteWorkIds: ["another-work"], selectedDates: ["2026-09-03"], remark: null });
      expect(result).not.toHaveProperty("countDates");
      expect(result).not.toHaveProperty("amount");
      expect(result).not.toHaveProperty("status");
      expect(result).not.toHaveProperty("monthlyRequestCollectionId");
    },
  );
  it("explicitly clears draft selection instead of leaving stale dates behind", () => {
    expect(claimUpdatePayload(selected, form, [], [])).toMatchObject({ offSiteWorkIds: [], selectedDates: [] });
    expect(claimCreatePayload(form, [], [], "DRAFT")).toMatchObject({ offSiteWorkIds: [], selectedDates: [] });
  });
  it.each(["COLLECTED", "APPROVED", "CANCELLED"] as const)("does not build edits for %s", (status) => {
    expect(claimUpdatePayload({ ...selected, status }, form, [], [])).toEqual({});
  });
  it("blocks collection membership even when the displayed status is stale", () => {
    expect(claimUpdatePayload({ ...selected, monthlyRequestCollectionId: "collection-1" }, form, [], [])).toEqual({});
  });
});
