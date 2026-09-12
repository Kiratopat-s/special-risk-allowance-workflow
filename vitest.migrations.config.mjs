import { defineConfig } from "vitest/config";

if (process.versions.bun) {
  throw new Error("Migration integration tests must run on Node.js via bun run test:migrations.");
}

export default defineConfig({
  resolve: { alias: { "@": import.meta.dirname } },
  test: {
    include: ["tests/migrations/**/*.test.ts"],
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
