import { defineConfig, devices } from "@playwright/test";

/**
 * Config for the multi-instance PXI smoke test. Unlike the main config it
 * starts no web server and performs no auth setup: the two Phoenix instances
 * are provided externally (see scripts/pxi-multi-instance/run.sh), share one
 * Postgres database, and run with auth disabled.
 */
export default defineConfig({
  testDir: "./tests/pxi",
  testMatch: "**/multi-instance.spec.ts",
  // One long-running scenario with a real LLM turn in the middle.
  timeout: 420_000,
  expect: {
    timeout: 30_000,
  },
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.PXI_MI_BASE_URL_A ?? "http://localhost:16006",
    trace: "retain-on-failure",
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
