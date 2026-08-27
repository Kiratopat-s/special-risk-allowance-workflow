import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": import.meta.dirname },
  },
  test: {
    globals: true,
    include: ["lib/**/*.test.ts"],
    clearMocks: true,
  },
});
