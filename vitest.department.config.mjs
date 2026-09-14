import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": import.meta.dirname } },
  test: { include: ["tests/integration/department.test.ts"], testTimeout: 15000, hookTimeout: 15000 },
});
