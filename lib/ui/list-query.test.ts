import { describe, it, expect } from "vitest";
import { parseClaimListQuery, updateListQuery } from "./list-query";
import {
  claimWhere,
  claimOrderBy,
} from "@/lib/domains/expense-claim-document/read-query";
describe("read filters and URL state", () => {
  it("retains legacy scope and ordering when filters are omitted", () => {
    expect(claimWhere({})).toEqual({ cancelledAt: null });
    expect(claimOrderBy()).toEqual([
      { expenseMonth: "desc" },
      { createdAt: "desc" },
    ]);
  });
  it("individual status takes precedence over a group", () =>
    expect(
      claimWhere({ status: "PENDING", statusGroup: "approved" }).status,
    ).toBe("PENDING"));
  it("includes every real in-progress status", () =>
    expect(claimWhere({ statusGroup: "progress" }).status).toEqual({
      in: [
        "PENDING",
        "PENDING_LEADER_VERIFY",
        "WAIT_FOR_COLLECTION",
        "COLLECTED",
      ],
    }));
  it("sorts amounts before legacy tie-breaking fields", () =>
    expect(claimOrderBy("amount-desc")).toEqual([
      { amount: "desc" },
      { expenseMonth: "desc" },
      { createdAt: "desc" },
    ]));
  it("only includes cancelled records when explicitly requested", () =>
    expect(
      claimWhere(parseClaimListQuery(new URLSearchParams("status=CANCELLED"))),
    ).toEqual({ status: "CANCELLED" }));
  it("clips a month filter to UTC boundaries", () => {
    const result = parseClaimListQuery(
      new URLSearchParams("month=2024-02&page=3&search=test"),
    );
    expect(result).toMatchObject({
      page: 3,
      search: "test",
      expenseMonthFrom: "2024-02-01T00:00:00.000Z",
      expenseMonthTo: "2024-02-29T23:59:59.999Z",
    });
  });
  it.each(["-1", "0", "NaN", "1.5", "Infinity"])(
    "rejects invalid page %s",
    (page) =>
      expect(parseClaimListQuery(new URLSearchParams({ page })).page).toBe(1),
  );
  it("resets pagination and transient detail parameters when a filter changes", () =>
    expect(
      updateListQuery("tab=expense-claims&page=5&claimId=a&search=x", {
        status: "DRAFT",
      }),
    ).toBe("tab=expense-claims&search=x&status=DRAFT"));
  it("preserves filters while changing pages", () =>
    expect(
      updateListQuery(
        "tab=expense-claims&status=DRAFT&month=2026-09",
        { page: 2 },
        false,
      ),
    ).toBe("tab=expense-claims&status=DRAFT&month=2026-09&page=2"));
});
