import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "pg";
import { readFile } from "node:fs/promises";
import { backfillDepartmentSnapshots } from "../../scripts/backfill-department-snapshots.mjs";

vi.mock("@/lib/db", async () => {
  const url = new URL(process.env.SNAPSHOT_TEST_DATABASE_URL || "http://invalid");
  if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" || url.pathname !== "/snapshot_test" || !process.env.SNAPSHOT_TEST_CONTAINER?.startsWith("sraw-snapshot-test-")) {
    throw Error("Use bun scripts/test-department-snapshot-db.mjs with its disposable database");
  }
  const { PrismaClient } = await import("@/lib/generated/prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  return { prisma: new PrismaClient({ adapter: new PrismaPg({ connectionString: url.href }) }) };
});

import { prisma } from "@/lib/db";
import { expenseClaimDocumentRepository as claims } from "@/lib/domains/expense-claim-document/repository";
import { monthlyRequestCollectionRepository as collections } from "@/lib/domains/monthly-request-collection/repository";
import { analyticsGroupsSql, analyticsClaimsWhere, type AnalyticsGroup } from "@/lib/domains/analytics/repository";
import { parseAnalyticsQuery } from "@/lib/domains/analytics/query";
import { ANALYTICS_STATUSES, type AnalyticsFilters } from "@/lib/domains/analytics/types";
import { Prisma } from "@/lib/generated/prisma/client";

const claimInput = { expenseMonth: "2026-09-01", claimantPositionAtSubmission: "ตำแหน่งทดสอบ", amount: "300.50", countDates: 2 };
const getClaim = (id: string) => prisma.expenseClaim.findUniqueOrThrow({ where: { id } });
const snapshot = (claim: Awaited<ReturnType<typeof getClaim>>) => ({
  departmentSnapshotId: claim.departmentSnapshotId,
  departmentSnapshotName: claim.departmentSnapshotName,
  departmentSnapshotShortName: claim.departmentSnapshotShortName,
  departmentSnapshotCapturedAt: claim.departmentSnapshotCapturedAt,
  departmentSnapshotSource: claim.departmentSnapshotSource,
});

const reportFilters: AnalyticsFilters = {
  interval: "range", calendar: "calendar", year: 2026, period: 1,
  fromMonth: "2026-09", toMonth: "2026-10", departmentIds: [], statuses: [...ANALYTICS_STATUSES],
};
const groups = (filters = reportFilters) => prisma.$queryRaw<AnalyticsGroup[]>(analyticsGroupsSql(filters, "2026-10"));
const totalGroup = async (filters = reportFilters) => (await groups(filters)).find((group) => group.kind === "total")!;

describe("analytics SQL on PostgreSQL", () => {
  it("aggregates exact decimals and distinct claimants once despite multiple related work/verification rows", async () => {
    await claims.create({ ...claimInput, amount: "0.10" }, "claimant", "actor");
    const pending = await claims.create({ ...claimInput, status: "PENDING", amount: "0.20" }, "claimant", "actor");
    await claims.create({ ...claimInput, expenseMonth: "2026-10-01", status: "APPROVED", amount: "0.30" }, "claimant", "actor");
    await claims.create({ ...claimInput, expenseMonth: "2026-10-01", status: "APPROVED", amount: undefined }, "actor", "actor");
    await claims.create({ ...claimInput, status: "CANCELLED", amount: "999" }, "actor", "actor");
    await claims.create({ ...claimInput, status: "PENDING", amount: "0.40" }, "unassigned", "actor");
    for (const id of ["work1", "work2"]) {
      await prisma.offSiteWork.create({ data: { id, startDate: new Date("2026-09-01"), endDate: new Date("2026-09-02"), postedByUserId: "actor" } });
      await prisma.expenseClaimOffSiteWork.create({ data: { expenseClaimId: pending.id, offSiteWorkId: id } });
      await prisma.leaderVerification.create({ data: { expenseClaimId: pending.id, offSiteWorkId: id, expiresAt: new Date("2026-10-01") } });
    }
    const result = await groups();
    const summary = result.find((group) => group.kind === "total")!;
    expect(summary.total.count).toBe(6);
    expect(summary.requested).toMatchObject({ count: 5, missingAmountCount: 1 });
    expect(new Prisma.Decimal(summary.requested.amount!)).toEqual(new Prisma.Decimal("1.00"));
    expect(new Prisma.Decimal(summary.approved.amount!)).toEqual(new Prisma.Decimal("0.30"));
    expect(summary.approved).toMatchObject({ count: 2, missingAmountCount: 1 });
    expect(summary.claimantCount).toBe(3);
    expect(summary.averagePerClaimant).toBeNull();
    expect(summary.provisionalDepartmentCount).toBe(2);
    expect(summary.backlog.count).toBe(2);
    const monthly = result.filter((group) => group.kind === "month");
    expect(monthly.reduce((sum, month) => sum + month.requested.count, 0)).toBe(summary.requested.count);
    expect(monthly.reduce((sum, month) => sum + month.claimantCount, 0)).toBe(4);
    for (const filter of [reportFilters, { ...reportFilters, departmentIds: ["a"] }, { ...reportFilters, departmentIds: ["unassigned"] }, { ...reportFilters, statuses: ["APPROVED" as const] }]) {
      expect((await totalGroup(filter)).total.count).toBe(await prisma.expenseClaim.count({ where: analyticsClaimsWhere(filter) }));
    }
  });

  it("keeps saved and unassigned departments while only unsubmitted drafts follow a transfer", async () => {
    await claims.create({ ...claimInput, status: "APPROVED", amount: "10.10" }, "claimant", "actor");
    await claims.create({ ...claimInput, amount: "20.20" }, "claimant", "actor");
    await claims.create({ ...claimInput, status: "PENDING", amount: "30.30" }, "unassigned", "actor");
    await prisma.user.update({ where: { id: "claimant" }, data: { departmentId: "b" } });
    await prisma.user.update({ where: { id: "unassigned" }, data: { departmentId: "b" } });
    await prisma.department.delete({ where: { id: "a" } });
    const result = await groups();
    const department = (id: string) => result.find((row) => row.kind === "department" && row.key === id)!;
    expect(department("a").label).toBe("แผนก ก");
    expect(new Prisma.Decimal(department("a").requested.amount!)).toEqual(new Prisma.Decimal("10.10"));
    expect(new Prisma.Decimal(department("b").requested.amount!)).toEqual(new Prisma.Decimal("20.20"));
    expect(new Prisma.Decimal(department("unassigned").requested.amount!)).toEqual(new Prisma.Decimal("30.30"));
    for (const departmentIds of [["a"], ["b"], ["unassigned"], ["a", "unassigned"]]) {
      const filter = { ...reportFilters, departmentIds };
      expect((await totalGroup(filter)).total.count).toBe(await prisma.expenseClaim.count({ where: analyticsClaimsWhere(filter) }));
    }
  });

  it("distinguishes missing money from empty result and consistently treats cancelledAt as cancellation", async () => {
    await claims.create({ ...claimInput, status: "PENDING", amount: undefined }, "claimant", "actor");
    const cancelled = await claims.create({ ...claimInput, status: "APPROVED", amount: "1000" }, "actor", "actor");
    await prisma.expenseClaim.update({ where: { id: cancelled.id }, data: { cancelledAt: new Date() } });
    const summary = await totalGroup();
    expect(summary.requested).toEqual({ count: 1, amount: null, missingAmountCount: 1 });
    expect(summary.approved).toEqual({ count: 0, amount: "0", missingAmountCount: 0 });
    const cancelledFilter = { ...reportFilters, statuses: ["CANCELLED" as const] };
    expect((await totalGroup(cancelledFilter)).total.count).toBe(1);
    expect(await prisma.expenseClaim.count({ where: analyticsClaimsWhere(cancelledFilter) })).toBe(1);
    const empty = await totalGroup({ ...reportFilters, statuses: ["REJECTED"] });
    expect(empty.total).toEqual({ count: 0, amount: "0", missingAmountCount: 0 });
  });

  it("executes fiscal year, quarter and half-year ranges with exact October/September boundaries", async () => {
    for (const expenseMonth of ["2026-09-01", "2026-10-01", "2027-03-01", "2027-04-01", "2027-09-01", "2027-10-01"]) {
      await claims.create({ ...claimInput, expenseMonth, status: "APPROVED", amount: "1" }, "claimant", "actor");
    }
    for (const [interval, period, expected] of [["year", 1, 4], ["quarter", 1, 1], ["quarter", 4, 1], ["half", 1, 2], ["half", 2, 2]] as const) {
      const parsed = parseAnalyticsQuery(new URLSearchParams({ interval, period: String(period), calendar: "fiscal", year: "2027" }));
      expect(parsed.success).toBe(true);
      if (!parsed.success) throw new Error(parsed.error);
      expect((await totalGroup(parsed.data)).requested.count).toBe(expected);
    }
  });
});

beforeEach(async () => {
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();
  await prisma.department.createMany({ data: [
    { id: "a", name: "แผนก ก", shortName: "ก" },
    { id: "b", name: "แผนก ข", shortName: "ข" },
  ] });
  await prisma.user.createMany({ data: [
    { id: "claimant", keycloakId: "claimant", email: "claimant@example.test", firstName: "ผู้ขอ", lastName: "ทดสอบ", departmentId: "a" },
    { id: "actor", keycloakId: "actor", email: "actor@example.test", firstName: "ผู้สร้าง", lastName: "ทดสอบ", departmentId: "b" },
    { id: "unassigned", keycloakId: "unassigned", email: "unassigned@example.test", firstName: "ไม่สังกัด", lastName: "ทดสอบ" },
  ] });
});
afterAll(async () => { await prisma.$disconnect(); });

describe("immutable department snapshots on PostgreSQL", () => {
  it("upgrades existing claim data additively without pretending a historical snapshot is known", async () => {
    const claim = await claims.create({ ...claimInput, status: "APPROVED" }, "claimant", "actor");
    const client = new Client({ connectionString: process.env.SNAPSHOT_TEST_DATABASE_URL });
    await client.connect();
    try {
      await client.query("BEGIN");
      // Reconstruct the immediately preceding schema inside this transaction only.
      // ROLLBACK restores it, including its original index and enum identities.
      await client.query(`ALTER TABLE expense_claims
        DROP COLUMN department_snapshot_id, DROP COLUMN department_snapshot_name,
        DROP COLUMN department_snapshot_short_name, DROP COLUMN department_snapshot_captured_at,
        DROP COLUMN department_snapshot_source`);
      await client.query('DROP TYPE "DepartmentSnapshotSource"');
      const before = (await client.query("SELECT to_jsonb(c) AS data FROM expense_claims c WHERE id = $1", [claim.id])).rows[0].data;
      const migration = await readFile(new URL("../../prisma/migrations/20260924010000_claim_department_snapshots/migration.sql", import.meta.url), "utf8");
      await client.query(migration);
      const after = (await client.query("SELECT to_jsonb(c) AS data FROM expense_claims c WHERE id = $1", [claim.id])).rows[0].data;
      for (const field of ["department_snapshot_id", "department_snapshot_name", "department_snapshot_short_name", "department_snapshot_captured_at", "department_snapshot_source"]) {
        expect(after[field]).toBeNull();
        delete after[field];
      }
      expect(after).toEqual(before);
    } finally {
      await client.query("ROLLBACK");
      await client.end();
    }
  });

  it("captures the claimant, not the creator, on direct submission", async () => {
    const claim = await claims.create({ ...claimInput, status: "PENDING" }, "claimant", "actor");
    expect(await getClaim(claim.id)).toMatchObject({ departmentSnapshotId: "a", departmentSnapshotName: "แผนก ก", departmentSnapshotShortName: "ก", departmentSnapshotSource: "SUBMISSION" });
  });

  it("uses membership at first submission after transfer and accepts only one concurrent submission", async () => {
    const draft = await claims.create({ ...claimInput, status: "DRAFT" }, "claimant", "actor");
    expect((await getClaim(draft.id)).departmentSnapshotSource).toBeNull();
    await prisma.user.update({ where: { id: "claimant" }, data: { departmentId: "b" } });
    const results = await Promise.all([claims.submitDraft(draft.id, "PENDING"), claims.submitDraft(draft.id, "PENDING")]);
    expect(results.filter((result) => result.success)).toHaveLength(1);
    const submitted = await getClaim(draft.id);
    expect(submitted).toMatchObject({ departmentSnapshotId: "b", departmentSnapshotSource: "SUBMISSION" });
    expect(submitted.departmentSnapshotCapturedAt).toBeInstanceOf(Date);
  });

  it("preserves captured values through transfer, generic updates, rename and department deletion", async () => {
    const claim = await claims.create({ ...claimInput, status: "PENDING" }, "claimant", "actor");
    const first = snapshot(await getClaim(claim.id));
    await prisma.user.update({ where: { id: "claimant" }, data: { departmentId: "b" } });
    await claims.update(claim.id, { status: "DRAFT", amount: "450.50" });
    expect((await claims.submitDraft(claim.id, "PENDING")).success).toBe(true);
    await claims.updateStatus(claim.id, "WAIT_FOR_COLLECTION");
    await prisma.department.update({ where: { id: "a" }, data: { name: "ชื่อใหม่", shortName: "ใหม่" } });
    await prisma.department.delete({ where: { id: "a" } });
    expect(snapshot(await getClaim(claim.id))).toEqual(first);
  });

  it("captures an unassigned department once and never replaces it with a later assignment", async () => {
    const claim = await claims.create({ ...claimInput, status: "PENDING" }, "unassigned", "actor");
    const first = snapshot(await getClaim(claim.id));
    expect(first).toMatchObject({ departmentSnapshotId: null, departmentSnapshotName: null, departmentSnapshotSource: "SUBMISSION" });
    await prisma.user.update({ where: { id: "unassigned" }, data: { departmentId: "a" } });
    await claims.update(claim.id, { status: "DRAFT" });
    await claims.submitDraft(claim.id, "PENDING");
    expect(snapshot(await getClaim(claim.id))).toEqual(first);
  });

  it("captures first submission through the generic update and updateStatus paths", async () => {
    for (const path of ["update", "status"] as const) {
      const draft = await claims.create(claimInput, "claimant", "actor");
      if (path === "update") await claims.update(draft.id, { status: "PENDING" });
      else await claims.updateStatus(draft.id, "PENDING_LEADER_VERIFY");
      expect(await getClaim(draft.id)).toMatchObject({ departmentSnapshotId: "a", departmentSnapshotSource: "SUBMISSION" });
    }
  });

  it("leaves cancelled unsent drafts uncaptured and rejects a draft collection before changing other links", async () => {
    const draft = await claims.create(claimInput, "claimant", "actor");
    const submitted = await claims.create({ ...claimInput, status: "WAIT_FOR_COLLECTION" }, "claimant", "actor");
    const mrc = await collections.create({ collectForMonth: "2026-09-01", expenseClaimIds: [submitted.id] }, "actor");
    expect((await collections.setExpenseClaims(mrc.id, [submitted.id])).success).toBe(true);
    const before = snapshot(await getClaim(submitted.id));
    expect(await collections.setExpenseClaims(mrc.id, [draft.id])).toMatchObject({ code: "CLAIM_NOT_SUBMITTED" });
    expect((await getClaim(submitted.id)).monthlyRequestCollectionId).toBe(mrc.id);
    expect(snapshot(await getClaim(submitted.id))).toEqual(before);
    await collections.cancelCollection(mrc.id);
    expect(snapshot(await getClaim(submitted.id))).toEqual(before);
    await claims.softDelete(draft.id);
    expect((await getClaim(draft.id)).departmentSnapshotSource).toBeNull();
  });

  it("backfills only legacy non-drafts, preserves real snapshots, and is idempotent after transfers", async () => {
    const real = await claims.create({ ...claimInput, status: "PENDING" }, "claimant", "actor");
    const realSnapshot = snapshot(await getClaim(real.id));
    const draft = await claims.create(claimInput, "claimant", "actor");
    for (const [id, userId, status] of [["legacy", "claimant", "APPROVED"], ["legacy-unassigned", "unassigned", "CANCELLED"]] as const) {
      await prisma.expenseClaim.create({ data: { ...claimInput, expenseMonth: new Date(claimInput.expenseMonth), id, userId, createdById: "actor", status } });
    }
    const client = new Client({ connectionString: process.env.SNAPSHOT_TEST_DATABASE_URL });
    await client.connect();
    try {
      expect(await backfillDepartmentSnapshots(client)).toBe(2);
      const legacy = snapshot(await getClaim("legacy"));
      expect(legacy).toMatchObject({ departmentSnapshotId: "a", departmentSnapshotSource: "LEGACY_CURRENT" });
      expect(await getClaim("legacy-unassigned")).toMatchObject({ departmentSnapshotId: null, departmentSnapshotSource: "LEGACY_CURRENT" });
      await prisma.user.update({ where: { id: "claimant" }, data: { departmentId: "b" } });
      expect(await backfillDepartmentSnapshots(client)).toBe(0);
      expect(snapshot(await getClaim("legacy"))).toEqual(legacy);
      expect(snapshot(await getClaim(real.id))).toEqual(realSnapshot);
      expect((await getClaim(draft.id)).departmentSnapshotSource).toBeNull();
    } finally {
      await client.end();
    }
  });
});
