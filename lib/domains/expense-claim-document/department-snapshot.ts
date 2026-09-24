import type { ClaimDocumentStatus, DepartmentSnapshotSource, Prisma } from "@/lib/generated/prisma/client";

type SnapshotState = {
  status: ClaimDocumentStatus;
  departmentSnapshotCapturedAt: Date | null;
  departmentSnapshotSource: DepartmentSnapshotSource | null;
};

/** Cancellation of an unsent draft does not constitute submission. */
export function isSubmittedClaimStatus(status: ClaimDocumentStatus): boolean {
  return status !== "DRAFT" && status !== "CANCELLED";
}

/** Never use the department ID as the marker: a captured null is immutable too. */
export function needsDepartmentSnapshot(
  existing: SnapshotState,
  nextStatus: ClaimDocumentStatus,
): boolean {
  return existing.departmentSnapshotSource === null &&
    existing.departmentSnapshotCapturedAt === null &&
    existing.status === "DRAFT" && isSubmittedClaimStatus(nextStatus);
}

export async function captureSubmissionDepartment(
  tx: Prisma.TransactionClient,
  claimantId: string,
): Promise<Pick<Prisma.ExpenseClaimUncheckedCreateInput,
  "departmentSnapshotId" | "departmentSnapshotName" | "departmentSnapshotShortName" |
  "departmentSnapshotCapturedAt" | "departmentSnapshotSource">> {
  const claimant = await tx.user.findUniqueOrThrow({
    where: { id: claimantId },
    select: { department: { select: { id: true, name: true, shortName: true } } },
  });
  return {
    departmentSnapshotId: claimant.department?.id ?? null,
    departmentSnapshotName: claimant.department?.name ?? null,
    departmentSnapshotShortName: claimant.department?.shortName ?? null,
    departmentSnapshotCapturedAt: new Date(),
    departmentSnapshotSource: "SUBMISSION",
  };
}

/** All first-submission entry points serialize on the claim before inspecting it. */
export async function lockClaim(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT id FROM expense_claims WHERE id = ${id} FOR UPDATE`;
  return tx.expenseClaim.findUnique({ where: { id } });
}
