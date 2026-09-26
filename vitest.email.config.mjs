import { defineConfig } from "vitest/config";

if (process.versions.bun) {
  throw new Error("Email integration tests must run on Node.js via bun run test:email-db.");
}

export default defineConfig({
  resolve: { alias: { "@": import.meta.dirname } },
  test: {
    include: ["tests/integration/email-delivery.test.ts", "tests/integration/internal-leader-smtp.test.ts"],
    testTimeout: 30000,
    hookTimeout: 15000,
  },
});
