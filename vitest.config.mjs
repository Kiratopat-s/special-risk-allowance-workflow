import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": import.meta.dirname },
  },
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    globals: true,
    include: ["lib/**/*.test.ts", "tests/**/*.test.ts", "tests/**/*.test.tsx"],
    clearMocks: true,
  },
});
