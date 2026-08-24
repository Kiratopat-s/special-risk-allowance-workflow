import { describe, expect, test } from "bun:test";
import {
  generateLeaderVerificationToken,
  hashLeaderVerificationToken,
} from "./token";

describe("leader verification token helpers", () => {
  test("generates independent 32-byte base64url tokens", () => {
    const first = generateLeaderVerificationToken();
    const second = generateLeaderVerificationToken();
    expect(first).not.toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  test("stores a deterministic SHA-256 hex digest, never the raw token", () => {
    const raw = "example-private-token";
    const digest = hashLeaderVerificationToken(raw);
    expect(digest).toHaveLength(64);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).not.toContain(raw);
    expect(hashLeaderVerificationToken(raw)).toBe(digest);
    expect(hashLeaderVerificationToken(`${raw}!`)).not.toBe(digest);
  });
});
