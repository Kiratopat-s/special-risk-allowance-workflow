import { expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ collection: vi.fn(), claim: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { monthlyRequestCollection: { findFirst: mock.collection }, expenseClaim: { findFirst: mock.claim } } }));
import { monthlyRequestCollectionRepository } from "@/lib/domains/monthly-request-collection/repository";
import { expenseClaimDocumentRepository } from "@/lib/domains/expense-claim-document/repository";
it("reads the full authorized packet without UI pagination, cancelled claims or sensitive fields", async () => {
  await monthlyRequestCollectionRepository.findClaimsForPrint("packet", { userId: "me", ownOnly: true, manage: false, superAdmin: false, hpa: false, rk: false, ok: false });
  const query = mock.collection.mock.calls[0][0];
  expect(query.where).toEqual({ AND: [{ id: "packet" }, { collectorId: "me" }] });
  const claims = query.select.expenseClaims;
  expect(claims.where).toEqual({ cancelledAt: null, status: { not: "CANCELLED" } });
  expect(claims.take).toBeUndefined(); expect(claims.skip).toBeUndefined();
  expect(claims.orderBy).toHaveLength(4);
  expect(JSON.stringify(query)).not.toContain('"token"');
  expect(JSON.stringify(query)).not.toContain('"signatures"');
});
it("rechecks the authorized owner and cancellation on the data query", async () => {
  await expenseClaimDocumentRepository.findForPrint("claim", "owner");
  expect(mock.claim.mock.calls[0][0].where).toEqual({ id: "claim", userId: "owner", cancelledAt: null, status: { not: "CANCELLED" } });
});
