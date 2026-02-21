import type { Project } from "@playwright/test";
import { defineConfig, devices } from "@playwright/test";

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

// Skip WebKit for CI because of recurring issues with caching binaries.
const isCI = !!process.env.CI;
const skipWebKit = process.env.CI_PLAYWRIGHT_SKIP_WEBKIT === "true";

const projects: Project[] = [
  {
    name: "setup",
    testMatch: "**/auth.setup.ts",
  },
  {
    name: "chromium",
    use: {
      ...devices["Desktop Chrome"],
      storageState: "playwright/.auth/admin.json",
    },
    dependencies: ["setup"],
    // The test below runs last in the 'rate limit' project so that we don't lock ourselves out
    testIgnore: ["**/*.rate-limit.spec.ts", "**/*.setup.ts"],
  },
  {
    name: "firefox",
    use: {
      ...devices["Desktop Firefox"],
      storageState: "playwright/.auth/admin.json",
    },
    dependencies: ["setup"],
    // The test below runs last in the 'rate limit' project so that we don't lock ourselves out
    testIgnore: ["**/*.rate-limit.spec.ts", "**/*.setup.ts"],
  },
];

if (!skipWebKit) {
  projects.push({
    name: "webkit",
    use: {
      ...devices["Desktop Safari"],
      storageState: "playwright/.auth/admin.json",
    },
    dependencies: ["setup"],
    // The test below runs last in the 'rate limit' project so that we don't lock ourselves out
    testIgnore: ["**/*.rate-limit.spec.ts", "**/*.setup.ts"],
  });
}

projects.push({
  name: "rate limit",
  use: { ...devices["Desktop Chrome"] },
  dependencies: skipWebKit
    ? ["chromium", "firefox"]
    : ["chromium", "firefox", "webkit"],
  testMatch: "**/*.rate-limit.spec.ts",
});

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  timeout: isCI ? 90_000 : 45_000,
  expect: {
    /* CI runners are slower; use one centralized expect timeout policy */
    timeout: isCI ? 30_000 : 10_000,
  },
  // Use default workers (cpu count)
  workers: undefined,
  fullyParallel: true,
  testDir: "./tests",
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: isCI ? 2 : 0,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: "html",
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: "http://localhost:6006",

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",

    /* Wait for each page navigation to complete */
    navigationTimeout: isCI ? 30_000 : 15_000,
  },

  /* Configure projects for major browsers */
  projects: projects,

  /* Run your local dev server before starting the tests */
  webServer: {
    command: "pnpm run dev:server:test",
    url: "http://localhost:6006",
    reuseExistingServer: !isCI,
    timeout: isCI ? 240_000 : 120_000,
  },
});
