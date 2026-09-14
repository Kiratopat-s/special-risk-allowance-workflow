import { beforeEach, expect, it, vi } from "vitest";
import { printDocument } from "./fixtures/claim-print";
const mock = vi.hoisted(() => ({ auth: vi.fn(), claim: vi.fn(), collection: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: mock.auth }));
vi.mock("@/lib/domains/expense-claim-document", () => ({ expenseClaimDocumentService: { getPrintData: mock.claim } }));
vi.mock("@/lib/domains/monthly-request-collection", () => ({ monthlyRequestCollectionService: { getClaimsPrintData: mock.collection } }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); }, notFound: () => { throw new Error("not found"); } }));
import ClaimPage from "@/app/expense-claim-document/[id]/print/page";
import CollectionPage from "@/app/monthly-request-collection/[id]/claims/print/page";
const params = { params: Promise.resolve({ id: "id" }) };
beforeEach(() => { vi.clearAllMocks(); mock.auth.mockResolvedValue({ user: { dbUserId: "actor" } }); });
it.each([ClaimPage, CollectionPage])("requires a login even on direct navigation", async (page) => {
  mock.auth.mockResolvedValue(null);
  await expect(page(params)).rejects.toThrow("redirect:/api/auth/signin");
  expect(mock.claim).not.toHaveBeenCalled(); expect(mock.collection).not.toHaveBeenCalled();
});
it.each([[ClaimPage, mock.claim, "CLAIM_NOT_FOUND"], [CollectionPage, mock.collection, "MRC_NOT_FOUND"]] as const)("handles not-found and denied requests", async (page, method, code) => {
  method.mockResolvedValue({ success: false, code, error: "missing" });
  await expect(page(params)).rejects.toThrow("not found");
  method.mockResolvedValue({ success: false, code: "PERMISSION_DENIED", error: "denied" });
  await expect(page(params)).rejects.toThrow("redirect:/");
});
it("passes actor identity to services and feeds the same preview contract", async () => {
  const doc = printDocument();
  mock.claim.mockResolvedValue({ success: true, data: doc }); mock.collection.mockResolvedValue({ success: true, data: [doc] });
  expect((await ClaimPage(params)).props.documents).toEqual([doc]);
  expect((await CollectionPage(params)).props.documents).toEqual([doc]);
  expect(mock.claim).toHaveBeenCalledWith("id", "actor"); expect(mock.collection).toHaveBeenCalledWith("id", "actor");
});
