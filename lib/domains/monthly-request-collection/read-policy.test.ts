import { it, expect } from "vitest";
import { canSeeCollection, collectionVisibilityWhere, type CollectionReadAccess } from "./read-policy";
const access: CollectionReadAccess = { userId: "me", ownOnly: false, manage: false, superAdmin: false, hpa: false };
const collection = (status: string, collectorId = "other") => ({ status, collectorId });
it.each(["DRAFT", "PENDING", "REJECTED", "CANCELLED", "APPROVED"])("read-only users see only approved collections: %s", (status) => {
  expect(canSeeCollection(collection(status), access)).toBe(status === "APPROVED");
  expect(canSeeCollection(collection(status, "me"), access)).toBe(true);
});
it("keeps READ-only fallback limited to owned collections even for mixed roles", () => {
  const own = { ...access, ownOnly: true, manage: true, hpa: true };
  expect(collectionVisibilityWhere(own)).toEqual({ collectorId: "me" });
  expect(canSeeCollection(collection("APPROVED"), own)).toBe(false);
});
it.each(["hpa", "superAdmin"] as const)("%s can see submitted records but not another collector's draft", (flag) => {
  const reviewer = { ...access, [flag]: true };
  expect(canSeeCollection(collection("DRAFT"), reviewer)).toBe(false);
  for (const status of ["PENDING", "APPROVED", "REJECTED", "CANCELLED"]) expect(canSeeCollection(collection(status), reviewer)).toBe(true);
});
it("management takes precedence for mixed-role users", () => {
  expect(canSeeCollection(collection("DRAFT"), { ...access, manage: true, hpa: true })).toBe(true);
  expect(collectionVisibilityWhere({ ...access, manage: true })).toEqual({});
});
