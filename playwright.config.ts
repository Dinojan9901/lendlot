import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;
const databaseUrl = process.env.TEST_DATABASE_URL ?? "postgresql://lendlot:lendlot@localhost:5433/lendlot_test";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Always test a production build (dev mode compiles each page on first
    // visit, which is slow and not what users get). CI builds in an earlier step.
    command: process.env.CI
      ? `npm run start -- --port ${PORT}`
      : `npm run build && npm run start -- --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      DATABASE_URL: databaseUrl,
      AUTH_SECRET: process.env.AUTH_SECRET ?? "e2e-secret-not-for-production-use-only",
      AUTH_TRUST_HOST: "true",
      NEXT_PUBLIC_SITE_URL: baseURL,
    },
  },
});
