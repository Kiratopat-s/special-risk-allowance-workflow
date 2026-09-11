import { it, expect, describe } from "vitest";
import {
  canSeeCollection,
  collectionVisibilityWhere,
  type CollectionReadAccess,
} from "./read-policy";
const access: CollectionReadAccess = {
  userId: "me",
  ownOnly: false,
  manage: false,
  superAdmin: false,
  hpa: false,
  rk: false,
  ok: false,
};
const collection = (
  status: string,
  stages: string[] = [],
  collectorId = "other",
) => ({
  status,
  collectorId,
  approvalSteps: stages.map((stage) => ({ stage, status: "APPROVED" })),
});
describe("collection visibility remains stage aware", () => {
  it("keeps drafts private except for MANAGE", () => {
    expect(canSeeCollection(collection("DRAFT"), access)).toBe(false);
    expect(canSeeCollection(collection("DRAFT", [], "me"), access)).toBe(true);
    expect(
      canSeeCollection(collection("DRAFT"), { ...access, manage: true }),
    ).toBe(true);
  });
  it("does not expand the own-only READ fallback", () => {
    expect(
      collectionVisibilityWhere({ ...access, ownOnly: true, manage: true }),
    ).toEqual({ collectorId: "me" });
  });
  it("allows non-reviewer LIST holders to see pending collections", () =>
    expect(canSeeCollection(collection("PENDING"), access)).toBe(true));
  it("requires HPA completion for RK-only users", () => {
    expect(
      canSeeCollection(collection("PENDING"), { ...access, rk: true }),
    ).toBe(false);
    expect(
      canSeeCollection(collection("PENDING", ["HPA_CHECK"]), {
        ...access,
        rk: true,
      }),
    ).toBe(true);
  });
  it("requires both prior steps for OK-only users", () => {
    expect(
      canSeeCollection(collection("PENDING", ["HPA_CHECK"]), {
        ...access,
        ok: true,
      }),
    ).toBe(false);
    expect(
      canSeeCollection(collection("PENDING", ["HPA_CHECK", "RK_CHECK"]), {
        ...access,
        ok: true,
      }),
    ).toBe(true);
  });
  it("uses the earliest applicable permission for mixed roles", () => {
    expect(
      canSeeCollection(collection("PENDING"), {
        ...access,
        hpa: true,
        ok: true,
      }),
    ).toBe(true);
    expect(
      canSeeCollection(collection("PENDING", ["HPA_CHECK"]), {
        ...access,
        rk: true,
        ok: true,
      }),
    ).toBe(true);
  });
  it("preserves super-admin pending exception without exposing other drafts", () => {
    expect(
      canSeeCollection(collection("PENDING"), { ...access, superAdmin: true }),
    ).toBe(true);
    expect(
      canSeeCollection(collection("DRAFT"), { ...access, superAdmin: true }),
    ).toBe(false);
  });
});
