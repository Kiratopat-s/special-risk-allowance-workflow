import { defineConfig } from "vitest/config";

// Without Node on PATH, `bun run` can silently launch Vitest using Bun.
// Its forked jsdom workers can stall instead of reporting a test failure.
if (process.versions.bun) {
  throw new Error(
    "Vitest must run on Node.js. Install Node 24 LTS (24.15.0 or newer), ensure node is on PATH, and run `bun run test` without --bun.",
  );
}

export default defineConfig({
  resolve: {
    alias: { "@": import.meta.dirname },
  },
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    globals: true,
    // MUI/jsdom suites are CPU- and memory-heavy. Vitest's CPU-count default
    // runs too many at once on shared laptops/runners, starving UI timers.
    // Keep the normal 5-second timeout; limit contention instead.
    maxWorkers: 2,
    include: ["lib/**/*.test.ts", "tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["tests/migrations/**", "tests/integration/**"],
    clearMocks: true,
  },
});
