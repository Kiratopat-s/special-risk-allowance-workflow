import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": import.meta.dirname } },
  test: { include: ["tests/integration/presence.test.ts"], testTimeout: 30000, hookTimeout: 15000 },
});
