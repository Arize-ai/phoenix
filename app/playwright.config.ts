import { defineConfig, devices, Project } from "@playwright/test";

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

// Skip WebKit for CI because of recurring issues with caching binaries.
const skipWebKit = process.env.CI_PLAYWRIGHT_SKIP_WEBKIT === "true";

const projects: Project[] = [
  {
    name: "chromium",
    use: { ...devices["Desktop Chrome"] },
    // The test below runs last in the 'rate limit' project so that we don't lock ourselves out
    testIgnore: "**/*.rate-limit.spec.ts",
  },
  {
    name: "firefox",
    use: { ...devices["Desktop Firefox"] },
    // The test below runs last in the 'rate limit' project so that we don't lock ourselves out
    testIgnore: "**/*.rate-limit.spec.ts",
  },
];

if (!skipWebKit) {
  projects.push({
    name: "webkit",
    use: { ...devices["Desktop Safari"] },
    // The test below runs last in the 'rate limit' project so that we don't lock ourselves out
    testIgnore: "**/*.rate-limit.spec.ts",
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
  globalSetup: require.resolve("./global-setup"),
  timeout: process.env.CI ? 60000 : 30000,
  // Parallel workers expose flakiness, so we'll run tests serially.
  workers: 1,
  fullyParallel: false,
  testDir: "./tests",
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: "html",
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: "http://localhost:6006",

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",

    /* Wait for 15 seconds for each page navigation to complete */
    navigationTimeout: 15000,
  },

  /* Configure projects for major browsers */
  projects: projects,

  /* Run your local dev server before starting the tests */
  webServer: {
    command: "pnpm run dev:server:test",
    url: "http://localhost:6006",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
