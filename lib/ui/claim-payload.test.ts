import { describe, it, expect } from "vitest";
import {
  claimCreatePayload,
  claimUpdatePayload,
  type ClaimFormState,
} from "./claim-payload";
import type { ExpenseClaimDocumentWithRelations } from "@/lib/domains/expense-claim-document/types";
const form: ClaimFormState = {
  expenseMonth: "2026-09",
  claimantPositionAtSubmission: " พชง. 5 ",
  remark: " note ",
  status: "DRAFT",
  countDates: "2",
  amount: "300",
};
const selected = {
  expenseMonth: new Date("2026-09-01"),
  claimantPositionAtSubmission: "พชง. 5",
  remark: "note",
  status: "DRAFT",
  countDates: 2,
  amount: 300,
} as ExpenseClaimDocumentWithRelations;
describe("existing claim mutation payloads", () => {
  it("preserves selected dates, rate-derived values, trimming, and submit status", () =>
    expect(
      claimCreatePayload(
        form,
        ["work"],
        ["2026-09-01", "2026-09-02"],
        2,
        300,
        "PENDING_LEADER_VERIFY",
      ),
    ).toEqual({
      expenseMonth: "2026-09-01",
      claimantPositionAtSubmission: "พชง. 5",
      offSiteWorkIds: ["work"],
      selectedDates: ["2026-09-01", "2026-09-02"],
      countDates: "2",
      amount: "300",
      remark: "note",
      status: "PENDING_LEADER_VERIFY",
    }));
  it("preserves undefined for empty create amounts and selections", () =>
    expect(
      claimCreatePayload({ ...form, remark: "" }, [], [], 0, 0, "DRAFT"),
    ).toMatchObject({
      offSiteWorkIds: undefined,
      selectedDates: undefined,
      countDates: undefined,
      amount: undefined,
      remark: undefined,
    }));
  it("draft edits include work links and dates", () =>
    expect(claimUpdatePayload(selected, form, [], [], 0, 0)).toMatchObject({
      offSiteWorkIds: [],
      selectedDates: undefined,
      countDates: undefined,
      amount: undefined,
    }));
  it.each([
    "PENDING",
    "PENDING_LEADER_VERIFY",
    "REJECTED",
    "APPROVED",
  ] as const)(
    "never changes status or work links for a non-draft %s edit",
    (status) => {
      const result = claimUpdatePayload(
        { ...selected, status },
        { ...form, amount: "450", countDates: "3", remark: "" },
        ["another-work"],
        ["2026-09-03"],
        1,
        150,
      );
      expect(result).toMatchObject({
        amount: "450",
        countDates: "3",
        remark: null,
      });
      expect(result).not.toHaveProperty("status");
      expect(result).not.toHaveProperty("offSiteWorkIds");
      expect(result).not.toHaveProperty("selectedDates");
    },
  );
  it("retains null semantics when clearing non-draft decimal fields", () =>
    expect(
      claimUpdatePayload(
        { ...selected, status: "PENDING" },
        { ...form, amount: "", countDates: "" },
        [],
        [],
        0,
        0,
      ),
    ).toMatchObject({ amount: null, countDates: null }));
});
