import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { Client } from "pg";

vi.mock("@/lib/db", async () => {
  const url = new URL(process.env.MIGRATION_TEST_DATABASE_URL ?? "http://invalid");
  if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" ||
      !["/migration_upgrade", "/migration_fresh"].includes(url.pathname) ||
      !process.env.MIGRATION_TEST_CONTAINER?.startsWith("sraw-migrations-")) {
    throw new Error("Use bun run test:migrations with its isolated PostgreSQL database.");
  }
  const { PrismaClient } = await import("@/lib/generated/prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  return { prisma: new PrismaClient({ adapter: new PrismaPg({ connectionString: url.href }) }) };
});

import { prisma } from "@/lib/db";
import { monthlyRequestCollectionRepository as repo } from "@/lib/domains/monthly-request-collection/repository";
import { leaderVerificationRepository } from "@/lib/domains/leader-verification/repository";
import { seedPermissions, assignDefaultRolePermissions } from "@/lib/domains/permission/seed";
import { canSeeCollection, type CollectionReadAccess } from "@/lib/domains/monthly-request-collection/read-policy";

const phase = process.env.MIGRATION_TEST_PHASE;
if (!["before", "after", "fresh"].includes(phase ?? "")) throw new Error("Missing isolated migration phase");
afterAll(async () => { await prisma.$disconnect(); });

if (phase === "before") {
  it("refuses a legacy approval without changing the schema or document", async () => {
    const client = new Client({ connectionString: process.env.MIGRATION_TEST_DATABASE_URL });
    await client.connect();
    try {
      await client.query("INSERT INTO monthly_request_collections(id, collector_id, collect_for_month) VALUES ('legacy-preflight', 'migration-user-a', '2026-09-01')");
      await client.query("INSERT INTO mrc_approval_steps(id, monthly_request_collection_id, stage) VALUES ('legacy-step', 'legacy-preflight', 'RK_CHECK')");
      const sql = await readFile(new URL("../../prisma/migrations/20260914140000_single_hpa_approval/migration.sql", import.meta.url), "utf8");
      await expect(client.query(sql)).rejects.toThrow("MRC cutover blocked");
      await client.query("ROLLBACK");
      expect((await client.query("SELECT status FROM monthly_request_collections WHERE id = 'legacy-preflight'")).rows[0].status).toBe("DRAFT");
      expect((await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'mrc_approval_steps' AND column_name = 'signature_data'")).rows).toHaveLength(0);
    } finally {
      await client.query("DELETE FROM monthly_request_collections WHERE id = 'legacy-preflight'");
      await client.end();
    }
  });
  it("prepares old role grants for the actual migration upgrade", async () => {
    for (const code of ["rk", "drt", "hpa", "super-admin"]) {
      await prisma.role.create({ data: { id: `legacy-${code}`, code, name: code } });
    }
    const specs = [
      ["monthly-request:review:rk", "REVIEW_RK"], ["monthly-request:review:ok", "REVIEW_OK"],
      ["monthly-request:submit", "SUBMIT"], ["monthly-request:approve", "APPROVE"],
    ] as const;
    for (const [code, action] of specs) {
      const p = await prisma.permission.create({ data: { code, name: code, resource: "MONTHLY_REQUEST", action, scope: "ALL", isSystem: true } });
      for (const role of ["rk", "drt"]) await prisma.rolePermission.create({ data: { roleId: `legacy-${role}`, permissionId: p.id } });
    }
  });
} else {
  const actor = "mrc-test-signer";
  const collector = "mrc-test-collector";
  const originalSignature = new Uint8Array([137, 80, 78, 71, 42]);
  const readAccess: CollectionReadAccess = { userId: "mrc-test-reader", ownOnly: false, manage: false, superAdmin: false, hpa: false };
  const approve = { stage: "HPA_CHECK", approved: true } as const;
  let serial = 0;
  async function fixture(status: "DRAFT" | "PENDING" = "PENDING") {
    const id = `mrc-fixture-${++serial}`;
    await prisma.monthlyRequestCollection.create({ data: {
      id, collectorId: collector, collectForMonth: new Date("2026-09-01"), status,
      ...(status === "PENDING" ? { approvalSteps: { create: { stage: "HPA_CHECK" } } } : {}),
    } });
    await prisma.expenseClaim.create({ data: {
      id: `${id}-claim`, userId: collector, createdById: collector,
      expenseMonth: new Date("2026-09-01"), claimantPositionAtSubmission: "ตำแหน่งเดิม",
      status: "COLLECTED", monthlyRequestCollectionId: id, amount: 300, countDates: 2,
    } });
    return id;
  }
  async function state(id: string) {
    const mrc = await prisma.monthlyRequestCollection.findUniqueOrThrow({ where: { id }, include: { approvalSteps: true } });
    const claim = await prisma.expenseClaim.findUniqueOrThrow({ where: { id: `${id}-claim` } });
    return { mrc, claim, step: mrc.approvalSteps[0] };
  }
  beforeAll(async () => {
    for (const id of [actor, collector]) await prisma.user.create({ data: {
      id, keycloakId: id, email: `${id}@example.test`, firstName: "ชื่อเดิม", lastName: "สกุลเดิม", positionShort: "หผ.", positionLevel: "8",
    } });
    await prisma.signature.create({ data: { userId: actor, signatureData: originalSignature, isActive: true } });
  });
  describe.sequential("single-HPA approval on PostgreSQL", () => {
    it("withdraws old grants and does not restore them when seeding repeatedly", async () => {
      for (let i = 0; i < 2; i++) { await seedPermissions(); await assignDefaultRolePermissions(); }
      expect(await prisma.permission.count({ where: { resource: "MONTHLY_REQUEST", action: { in: ["REVIEW_RK", "REVIEW_OK"] }, isActive: true } })).toBe(0);
      expect(await prisma.rolePermission.count({ where: { role: { code: { in: ["rk", "drt"] } }, permission: { resource: "MONTHLY_REQUEST", action: { in: ["REVIEW_RK", "REVIEW_OK", "SUBMIT", "APPROVE"] } } } })).toBe(0);
      for (const code of ["rk", "drt"]) expect(await prisma.rolePermission.count({ where: { role: { code }, permission: { code: "monthly-request:list" } } })).toBe(1);
    });
    it("submits once and creates only HPA_CHECK, even with simultaneous requests", async () => {
      const id = await fixture("DRAFT");
      const results = await Promise.all([repo.submitForReview(id), repo.submitForReview(id)]);
      expect(results.filter((r) => r.success)).toHaveLength(1);
      const data = await state(id);
      expect(data.mrc.status).toBe("PENDING");
      expect(data.mrc.approvalSteps.map((s) => s.stage)).toEqual(["HPA_CHECK"]);
    });
    it("approves once and saves both document statuses and the immutable signer", async () => {
      const id = await fixture();
      const results = await Promise.all([repo.reviewCollection(id, approve, actor), repo.reviewCollection(id, approve, actor)]);
      expect(results.filter((r) => r.success)).toHaveLength(1);
      const { mrc, claim, step } = await state(id);
      expect(mrc.status).toBe("APPROVED"); expect(claim.status).toBe("APPROVED");
      expect(step).toMatchObject({ reviewerId: actor, reviewerNameAtApproval: "ชื่อเดิม สกุลเดิม", reviewerPositionAtApproval: "หผ. 8", signatureData: originalSignature });
      expect(step.reviewedAt).toBeInstanceOf(Date);
      const detail = await repo.findWithRelations(id);
      expect(detail?.approvalSteps[0]).not.toHaveProperty("signatureData");
      expect(detail?.approvalSteps[0].reviewer).not.toHaveProperty("signatures");
      await prisma.user.update({ where: { id: actor }, data: { firstName: "ชื่อใหม่", positionShort: "ตำแหน่งใหม่" } });
      await prisma.signature.updateMany({ where: { userId: actor }, data: { signatureData: new Uint8Array([1, 2]), isActive: false, deletedAt: new Date() } });
      const printed = await repo.findSummaryForPrint(id, readAccess);
      expect(printed?.approvalSteps[0]).toMatchObject({ signatureData: originalSignature, reviewerNameAtApproval: "ชื่อเดิม สกุลเดิม", reviewerPositionAtApproval: "หผ. 8" });
      await prisma.signature.create({ data: { userId: actor, signatureData: originalSignature, isActive: true } });
    });
    it("rejects and releases the claims without a printed signature", async () => {
      const id = await fixture();
      expect((await repo.reviewCollection(id, { stage: "HPA_CHECK", approved: false, remark: "แก้ไขข้อมูล" }, actor)).success).toBe(true);
      const { mrc, claim, step } = await state(id);
      expect(mrc.status).toBe("REJECTED");
      expect(claim).toMatchObject({ status: "WAIT_FOR_COLLECTION", monthlyRequestCollectionId: null, collectedAt: null });
      expect(step).toMatchObject({ signatureData: null, remark: "แก้ไขข้อมูล" });
    });
    it("serializes cancellation against approval without a partial or contradictory result", async () => {
      const id = await fixture();
      const results = await Promise.all([repo.reviewCollection(id, approve, actor), repo.cancelCollection(id)]);
      expect(results.filter((r) => r.success)).toHaveLength(1);
      const { mrc, claim, step } = await state(id);
      if (mrc.status === "APPROVED") {
        expect(claim.status).toBe("APPROVED"); expect(step.status).toBe("APPROVED");
        expect(step.signatureData).not.toBeNull();
      } else {
        expect(mrc.status).toBe("CANCELLED"); expect(claim.status).toBe("WAIT_FOR_COLLECTION");
        expect(claim.monthlyRequestCollectionId).toBeNull(); expect(step.signatureData).toBeNull();
      }
    });
    it.each(["DRAFT", "PENDING"] as const)("cancels %s once and releases its claims", async (status) => {
      const id = await fixture(status);
      expect((await repo.cancelCollection(id)).success).toBe(true);
      const { mrc, claim } = await state(id);
      expect(mrc.status).toBe("CANCELLED"); expect(mrc.cancelledAt).toBeInstanceOf(Date);
      expect(claim).toMatchObject({ status: "WAIT_FOR_COLLECTION", monthlyRequestCollectionId: null });
      expect(await repo.cancelCollection(id)).toMatchObject({ code: "MRC_ALREADY_CANCELLED" });
      expect(await repo.submitForReview(id)).toMatchObject({ code: "MRC_NOT_DRAFT" });
    });
    it("rolls back the signature and step when updating linked claims fails", async () => {
      const id = await fixture();
      await prisma.$executeRawUnsafe(`CREATE FUNCTION fail_mrc_claim_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id = '${id}-claim' THEN RAISE EXCEPTION 'injected claim failure'; END IF; RETURN NEW; END $$`);
      await prisma.$executeRawUnsafe("CREATE TRIGGER mrc_claim_failure BEFORE UPDATE ON expense_claims FOR EACH ROW EXECUTE FUNCTION fail_mrc_claim_update()");
      try {
        await expect(repo.reviewCollection(id, approve, actor)).rejects.toThrow();
        const { mrc, claim, step } = await state(id);
        expect(mrc.status).toBe("PENDING"); expect(claim.status).toBe("COLLECTED");
        expect(step).toMatchObject({ status: "PENDING", reviewerId: null, signatureData: null, reviewedAt: null });
      } finally {
        await prisma.$executeRawUnsafe("DROP TRIGGER mrc_claim_failure ON expense_claims");
        await prisma.$executeRawUnsafe("DROP FUNCTION fail_mrc_claim_update()");
      }
    });
    it("requires an active signature for both decisions", async () => {
      for (const approved of [true, false]) {
        const id = await fixture();
        expect(await repo.reviewCollection(id, { stage: "HPA_CHECK", approved }, collector)).toMatchObject({ code: "SIGNATURE_REQUIRED" });
        expect((await state(id)).mrc.status).toBe("PENDING");
      }
    });
    it("does not allow a stale editor to change a submitted or approved collection", async () => {
      const id = await fixture();
      expect(await repo.setExpenseClaims(id, [])).toMatchObject({ code: "MRC_NOT_DRAFT" });
      await repo.reviewCollection(id, approve, actor);
      expect(await repo.setExpenseClaims(id, [])).toMatchObject({ code: "MRC_NOT_DRAFT" });
      expect((await state(id)).claim.status).toBe("APPROVED");
    });
    it("matches access policies in SQL and counts before pagination", async () => {
      const draft = await fixture("DRAFT"), pending = await fixture(), approved = await fixture();
      await repo.reviewCollection(approved, approve, actor);
      for (const access of [readAccess, { ...readAccess, hpa: true }, { ...readAccess, manage: true }, { ...readAccess, superAdmin: true }, { ...readAccess, ownOnly: true }, { ...readAccess, userId: collector, ownOnly: true }]) {
        for (const id of [draft, pending, approved]) {
          const mrc = await repo.findById(id);
          expect(!!(await repo.findSummaryForPrint(id, access))).toBe(canSeeCollection(mrc!, access));
          expect(!!(await repo.findClaimsForPrint(id, access))).toBe(canSeeCollection(mrc!, access));
        }
      }
      const expected = await prisma.monthlyRequestCollection.count({ where: { status: "APPROVED" } });
      const page = await repo.findMany({ page: 1, pageSize: 1 }, readAccess);
      expect(page.pagination.total).toBe(expected); expect(page.data).toHaveLength(1);
      expect(page.data[0].status).toBe("APPROVED"); expect(page.data[0].approvalSteps[0]).not.toHaveProperty("signatureData");
    });
    it("late leader verification cannot reopen collected or approved claims", async () => {
      const id = await fixture();
      expect(await leaderVerificationRepository.markReadyForCollection(`${id}-claim`)).toBe(false);
      await repo.reviewCollection(id, approve, actor);
      expect(await leaderVerificationRepository.markReadyForCollection(`${id}-claim`)).toBe(false);
      expect((await state(id)).claim.status).toBe("APPROVED");
      await prisma.expenseClaim.update({ where: { id: `${id}-claim` }, data: { monthlyRequestCollectionId: null, status: "PENDING_LEADER_VERIFY" } });
      expect(await leaderVerificationRepository.markReadyForCollection(`${id}-claim`)).toBe(true);
    });
  });
}
