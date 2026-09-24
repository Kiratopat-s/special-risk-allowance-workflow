import { prisma } from "@/lib/db";

export const claimReadRepository = {
  findUserDepartment(id: string) {
    return prisma.user.findUnique({ where: { id }, select: { departmentId: true } });
  },
  findClaimTarget(id: string) {
    return prisma.expenseClaim.findUnique({
      where: { id },
      select: {
        id: true, userId: true, status: true,
        claimant: { select: { departmentId: true } },
      },
    });
  },
};

export type ClaimReadTarget = NonNullable<Awaited<ReturnType<typeof claimReadRepository.findClaimTarget>>>;
