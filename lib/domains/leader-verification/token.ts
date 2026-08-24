import { createHash, randomBytes } from "node:crypto";

export function generateLeaderVerificationToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashLeaderVerificationToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function hashLeaderVerificationPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex");
}
