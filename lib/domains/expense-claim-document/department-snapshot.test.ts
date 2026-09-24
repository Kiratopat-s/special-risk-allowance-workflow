import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@/lib/generated/prisma/client";
import { captureSubmissionDepartment, needsDepartmentSnapshot } from "./department-snapshot";

const draft = { status: "DRAFT", departmentSnapshotCapturedAt: null, departmentSnapshotSource: null } as const;

describe("department attribution at first submission", () => {
  it("captures a first submission but leaves drafts and unsent cancellations provisional", () => {
    expect(needsDepartmentSnapshot(draft, "PENDING")).toBe(true);
    expect(needsDepartmentSnapshot(draft, "PENDING_LEADER_VERIFY")).toBe(true);
    expect(needsDepartmentSnapshot(draft, "DRAFT")).toBe(false);
    expect(needsDepartmentSnapshot(draft, "CANCELLED")).toBe(false);
  });

  it.each(["SUBMISSION", "LEGACY_CURRENT"] as const)("preserves the existing %s snapshot even when a claim is returned to draft", (source) => {
    expect(needsDepartmentSnapshot({ ...draft, departmentSnapshotSource: source, departmentSnapshotCapturedAt: new Date() }, "PENDING")).toBe(false);
  });

  it("does not pretend a legacy already-submitted record is a first submission", () => {
    expect(needsDepartmentSnapshot({ ...draft, status: "WAIT_FOR_COLLECTION" }, "COLLECTED")).toBe(false);
    expect(needsDepartmentSnapshot({ ...draft, status: "APPROVED" }, "PENDING_LEADER_VERIFY")).toBe(false);
  });

  it("reads the claimant department and keeps unassigned submissions permanently captured", async () => {
    const read = vi.fn().mockResolvedValue({ department: null });
    const tx = { user: { findUniqueOrThrow: read } } as unknown as Prisma.TransactionClient;
    const snapshot = await captureSubmissionDepartment(tx, "claimant");
    expect(read.mock.calls[0][0].where).toEqual({ id: "claimant" });
    expect(snapshot).toMatchObject({ departmentSnapshotId: null, departmentSnapshotName: null, departmentSnapshotShortName: null, departmentSnapshotSource: "SUBMISSION" });
    expect(snapshot.departmentSnapshotCapturedAt).toBeInstanceOf(Date);
    expect(needsDepartmentSnapshot({ ...draft, departmentSnapshotCapturedAt: snapshot.departmentSnapshotCapturedAt as Date }, "PENDING")).toBe(false);
  });

  it("stores both department labels independently of future renames", async () => {
    const tx = { user: { findUniqueOrThrow: vi.fn().mockResolvedValue({ department: { id: "a", name: "แผนก ก", shortName: "ก" } }) } } as unknown as Prisma.TransactionClient;
    expect(await captureSubmissionDepartment(tx, "claimant")).toMatchObject({
      departmentSnapshotId: "a", departmentSnapshotName: "แผนก ก", departmentSnapshotShortName: "ก", departmentSnapshotSource: "SUBMISSION",
    });
  });
});
