import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/lib/generated/prisma/client";

const mock = vi.hoisted(() => ({ pending: vi.fn(), detail: vi.fn(), token: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: {
  leaderVerification: { findMany: mock.pending, findUnique: mock.token },
  expenseClaim: { findFirst: mock.detail },
} }));

import { leaderVerificationRepository } from "./repository";

const work = {
  id: "order/1", innerRefDocumentId: "REF-1",
  startDate: new Date("2026-09-01"), endDate: new Date("2026-09-05"),
  location: "สถานที่", objective: "ปฏิบัติงาน",
};
const claim = {
  id: "claim1", expenseMonth: new Date("2026-09-01"),
  claimantPositionAtSubmission: "พนักงาน", status: "PENDING_LEADER_VERIFY",
  selectedDates: ["2026-09-01", "2026-09-03"],
  countDates: new Prisma.Decimal(2), amount: new Prisma.Decimal("300.50"),
  claimant: { id: "employee", firstName: "ชื่อ", lastName: "สกุล", employeeId: "000001" },
  expenseClaimOffSiteWorks: [{ offSiteWorkId: "order/1", offSiteWork: work }],
};
const record = {
  id: "verification1", expenseClaimId: "claim1", offSiteWorkId: "order/1",
  expiresAt: new Date("2026-09-30"), verifiedAt: null, createdAt: new Date("2026-09-01"),
  expenseClaim: claim,
  offSiteWork: { ...work, leaderFirstName: "หัวหน้า", leaderLastName: "ชุด", leaderPosition: null, leaderEmpId: null },
};

beforeEach(() => vi.resetAllMocks());

describe("assigned leader queue reads", () => {
  it("serializes claim dates and decimals without exposing tokens or membership data", async () => {
    mock.pending.mockResolvedValue([{ ...record, token: "private-token", leaderEmail: "private@example.com", signatureData: new Uint8Array([1]) }]);
    const result = await leaderVerificationRepository.findPendingByLeaderUserId("leader1");
    expect(result).toEqual([{ ...record, expenseClaim: {
      id: claim.id, expenseMonth: claim.expenseMonth,
      claimantPositionAtSubmission: claim.claimantPositionAtSubmission, status: claim.status,
      selectedDates: claim.selectedDates, countDates: 2, amount: 300.5, claimant: claim.claimant,
    } }]);
    expect(JSON.stringify(result)).not.toContain("private");
    const query = mock.pending.mock.calls[0][0];
    expect(query.where).toEqual({
      leaderUserId: "leader1", verifiedAt: null, expiresAt: { gt: expect.any(Date) },
      expenseClaim: { cancelledAt: null, status: { not: "CANCELLED" } }, offSiteWork: { deletedAt: null },
    });
    for (const field of ["token", "leaderEmail", "signatureData", "leaderUser", "userId"]) {
      expect(JSON.stringify(query.select)).not.toContain(`"${field}"`);
    }
  });

  it("drops stale verifications when that order is no longer linked to the claim", async () => {
    mock.pending.mockResolvedValue([
      record,
      { ...record, id: "stale", offSiteWorkId: "unlinked-order" },
    ]);
    expect((await leaderVerificationRepository.findPendingByLeaderUserId("leader1")).map((item) => item.id))
      .toEqual(["verification1"]);
  });

  it("preserves missing values, zero amounts, and invalid date strings for read-only date warnings", async () => {
    mock.pending.mockResolvedValue([{ ...record, expenseClaim: {
      ...claim, selectedDates: ["2026-09-01", 3, "bad-date"], countDates: null, amount: new Prisma.Decimal(0),
    } }]);
    const [item] = await leaderVerificationRepository.findPendingByLeaderUserId("leader1");
    expect(item.expenseClaim).toMatchObject({ selectedDates: ["2026-09-01", "bad-date"], countDates: null, amount: 0 });
    mock.pending.mockResolvedValue([{ ...record, expenseClaim: { ...claim, selectedDates: null, countDates: null, amount: null } }]);
    expect((await leaderVerificationRepository.findPendingByLeaderUserId("leader1"))[0].expenseClaim)
      .toMatchObject({ selectedDates: null, countDates: null, amount: null });
  });
});

describe("assigned leader claim detail reads", () => {
  it("authorizes on the same claim and an active linked order without imposing verification expiry", async () => {
    mock.detail.mockResolvedValue({ ...claim, remark: "ตรวจทาน" });
    const result = await leaderVerificationRepository.findClaimDetailForLeader("claim1", "leader1");
    expect(result).toEqual({ ...claim, countDates: 2, amount: 300.5, remark: "ตรวจทาน" });
    const query = mock.detail.mock.calls[0][0];
    expect(query.where).toEqual({
      id: "claim1", cancelledAt: null, status: { not: "CANCELLED" },
      expenseClaimOffSiteWorks: { some: { offSiteWork: {
        deletedAt: null,
        leaderVerifications: { some: { expenseClaimId: "claim1", leaderUserId: "leader1" } },
      } } },
    });
    expect(query.select.expenseClaimOffSiteWorks.where).toEqual({ offSiteWork: { deletedAt: null } });
    for (const field of ["token", "leaderEmail", "signatureData", "userId", "verifiedAt", "expiresAt"]) {
      expect(JSON.stringify(query)).not.toContain(`"${field}"`);
    }
  });

  it("returns no detail when the relationship-scoped query finds no eligible claim", async () => {
    mock.detail.mockResolvedValue(null);
    expect(await leaderVerificationRepository.findClaimDetailForLeader("claim1", "other-leader")).toBeNull();
  });

  it("does not expand the existing public token projection", async () => {
    mock.token.mockResolvedValue(null);
    await leaderVerificationRepository.findByToken("public-token");
    const query = mock.token.mock.calls[0][0];
    expect(query.where).toEqual({ token: "public-token" });
    for (const field of ["selectedDates", "countDates", "amount", "remark"]) {
      expect(query.include.expenseClaim.select).not.toHaveProperty(field);
    }
  });
});
