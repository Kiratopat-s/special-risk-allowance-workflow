import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "@playwright/test";

const systemChromePath =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const configuredChromePath = process.env.SRAW_PLAYWRIGHT_CHROME_PATH?.trim();
const chromeExecutablePath = configuredChromePath
  || (existsSync(systemChromePath) ? systemChromePath : undefined);

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.e2e.tsx",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: "line",
  outputDir: join(tmpdir(), "sraw-playwright-results"),
  use: {
    browserName: "chromium",
    headless: true,
    viewport: { width: 794, height: 1123 },
    launchOptions: chromeExecutablePath
      ? { executablePath: chromeExecutablePath }
      : undefined,
  },
});
