import { defineConfig, devices } from "@playwright/test";

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  globalSetup: require.resolve("./global-setup"),
  testDir: "./tests",
  /* Run tests in files in parallel */
  fullyParallel: true,
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
  },

  /* Configure projects for major browsers */
  projects: [
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
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
      // The test below runs last in the 'rate limit' project so that we don't lock ourselves out
      testIgnore: "**/*.rate-limit.spec.ts",
    },
    {
      name: "rate limit",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["chromium", "firefox", "webkit"],
      testMatch: "**/*.rate-limit.spec.ts",
    },
    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: "pnpm run dev:server:test -- --in-memory-sqlite",
    url: "http://localhost:6006",
    reuseExistingServer: !process.env.CI,
  },
});
