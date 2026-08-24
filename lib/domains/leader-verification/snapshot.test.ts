import { describe, expect, test } from "bun:test";
import { claimantFromVerificationSnapshot } from "./snapshot";
import type { LeaderVerificationPayload } from "./types";

describe("leader verification immutable history", () => {
  test("projects claimant from signed payload, independent of a changed live profile", () => {
    const payload = {
      claim: {
        claimant: {
          employeeId: "000123",
          firstName: "ชื่อ ณ วันยื่น",
          lastName: "นามสกุลเดิม",
        },
      },
    } as unknown as LeaderVerificationPayload;
    const changedLiveProfile = {
      id: "user-1",
      employeeId: "999999",
      firstName: "ชื่อใหม่",
      lastName: "นามสกุลใหม่",
    };

    expect(
      claimantFromVerificationSnapshot(payload, changedLiveProfile.id),
    ).toEqual({
      id: "user-1",
      employeeId: "000123",
      firstName: "ชื่อ ณ วันยื่น",
      lastName: "นามสกุลเดิม",
    });
  });
});
