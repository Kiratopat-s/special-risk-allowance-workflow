import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/domains/off-site-work/employee-service", () => ({ offSiteWorkEmployeeService: { linkForUser: vi.fn(async () => ({ success: true, data: 0 })) } }));
vi.mock("./repository");
vi.mock("@/lib/domains/action-log/service");
vi.mock("@/lib/domains/leader-verification");
vi.mock("@/lib/db", () => ({ prisma: {} }));
import { expenseClaimDocumentRepository as repository } from "./repository";
import { actionLogService } from "@/lib/domains/action-log/service";
import { leaderVerificationService } from "@/lib/domains/leader-verification";
import { expenseClaimDocumentService as service } from "./service";
import type { ClaimMutationOutcome } from "./repository";

const claim = { id: "claim1", userId: "user1", expenseMonth: new Date("2026-09-01"), status: "PENDING_LEADER_VERIFY" };
const outcome = { claim, previous: { ...claim, status: "WAIT_FOR_COLLECTION" }, verificationsReset: true } as ClaimMutationOutcome;
const input = { expenseMonth: "2026-09-01", claimantPositionAtSubmission: "Engineer" };
beforeEach(() => vi.resetAllMocks());

describe("claim mutations and committed notifications", () => {
  it("creates through the validating transaction and notifies only after commit", async () => {
    vi.mocked(repository.createWithSelection).mockResolvedValue({ success: true, data: outcome });
    expect(await service.create(input, "actor1", "user1")).toMatchObject({ success: true, data: claim });
    expect(repository.createWithSelection).toHaveBeenCalledWith(input, "user1", "actor1");
    expect(leaderVerificationService.notifyForClaim).toHaveBeenCalledWith("claim1");
    expect(vi.mocked(repository.createWithSelection).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(leaderVerificationService.notifyForClaim).mock.invocationCallOrder[0]);
    expect(leaderVerificationService.createForClaim).not.toHaveBeenCalled();
  });

  it("returns the committed post-reset status after an edit", async () => {
    vi.mocked(repository.updateEditable).mockResolvedValue({ success: true, data: outcome });
    expect(await service.update("claim1", { selectedDates: ["2026-09-02"] }, "user1")).toMatchObject({ success: true, data: { status: "PENDING_LEADER_VERIFY" } });
    expect(leaderVerificationService.notifyForClaim).toHaveBeenCalledWith("claim1");
  });

  it("does not re-notify for remark-only or draft edits", async () => {
    vi.mocked(repository.updateEditable).mockResolvedValue({ success: true, data: { ...outcome, verificationsReset: false } });
    expect((await service.update("claim1", { remark: "Updated" }, "user1")).success).toBe(true);
    expect(leaderVerificationService.notifyForClaim).not.toHaveBeenCalled();
  });

  it("validates the submitting owner and selection in the locked repository path", async () => {
    vi.mocked(repository.submitDraftWithSelection).mockResolvedValue({ success: true, data: outcome });
    expect((await service.submitDraft("claim1", "user1")).success).toBe(true);
    expect(repository.submitDraftWithSelection).toHaveBeenCalledWith("claim1", "user1");
    expect(leaderVerificationService.notifyForClaim).toHaveBeenCalledWith("claim1");
  });

  it("returns locked/invalid/stale errors without logging or notifying success", async () => {
    const failure = { success: false as const, error: "Locked", code: "CLAIM_LOCKED" };
    vi.mocked(repository.updateEditable).mockResolvedValue(failure);
    vi.mocked(repository.createWithSelection).mockResolvedValue(failure);
    vi.mocked(repository.submitDraftWithSelection).mockResolvedValue(failure);
    vi.mocked(repository.cancelEditable).mockResolvedValue(failure);
    expect(await service.update("claim1", {}, "user1")).toEqual(failure);
    expect(await service.create(input, "actor1", "user1")).toEqual(failure);
    expect(await service.submitDraft("claim1", "user1")).toEqual(failure);
    expect(await service.delete("claim1", "user1")).toEqual(failure);
    expect(leaderVerificationService.notifyForClaim).not.toHaveBeenCalled();
    expect(actionLogService.log).not.toHaveBeenCalled();
  });

  it("cancels through the same claim-locking policy and logs only a committed result", async () => {
    vi.mocked(repository.cancelEditable).mockResolvedValue({ success: true, data: outcome.claim });
    expect((await service.delete("claim1", "user1")).success).toBe(true);
    expect(repository.cancelEditable).toHaveBeenCalledWith("claim1");
    expect(actionLogService.log).toHaveBeenCalledOnce();
  });
});
