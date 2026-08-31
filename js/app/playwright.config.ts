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
const basePort = Number(process.env.PHOENIX_PORT ?? "6006");
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${basePort}`;
const isPxiE2E = process.env.PXI_E2E === "true";
const pxiTestIgnore = isPxiE2E ? [] : ["**/pxi/**"];

/**
 * The app-frame overlay contract suites assert behavior that only exists when
 * the PXI assistant is enabled (the rail staying interactive over Tier 1
 * modals, toast placement beside it). The standard suite runs against an
 * assistant-*disabled* server — the floating "Ask PXI" button intercepts
 * clicks in unrelated specs — and server env is process-wide, so these specs
 * get their own project wired to a second, assistant-enabled server.
 */
const appFrameSpecs = [
  "**/app-frame-overlays.spec.ts",
  "**/overlay-audit.spec.ts",
];
const appFramePort = basePort + 1;
const appFrameGrpcPort = Number(process.env.PHOENIX_GRPC_PORT ?? "4317") + 1;
const appFrameBaseURL = `http://localhost:${appFramePort}`;

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
    testIgnore: [
      "**/*.rate-limit.spec.ts",
      "**/*.setup.ts",
      ...appFrameSpecs,
      ...pxiTestIgnore,
    ],
  },
  {
    name: "firefox",
    use: {
      ...devices["Desktop Firefox"],
      storageState: "playwright/.auth/admin.json",
    },
    dependencies: ["setup"],
    // The test below runs last in the 'rate limit' project so that we don't lock ourselves out
    testIgnore: [
      "**/*.rate-limit.spec.ts",
      "**/*.setup.ts",
      ...appFrameSpecs,
      ...pxiTestIgnore,
    ],
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
    testIgnore: [
      "**/*.rate-limit.spec.ts",
      "**/*.setup.ts",
      ...appFrameSpecs,
      ...pxiTestIgnore,
    ],
  });
}

if (!isPxiE2E) {
  // The app-frame server has a fresh database and its own signing secret, so
  // the shared storage states don't authenticate against it — the project
  // runs auth.setup.ts a second time against its own baseURL, persisting to
  // playwright/.auth/app-frame/. Chromium only: the suites assert geometry
  // and stacking contracts that are engine-agnostic, so extra browsers add
  // runtime without signal.
  projects.push(
    {
      name: "app-frame-setup",
      testMatch: "**/auth.setup.ts",
      use: { baseURL: appFrameBaseURL },
    },
    {
      name: "app-frame",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: appFrameBaseURL,
        storageState: "playwright/.auth/app-frame/admin.json",
      },
      dependencies: ["app-frame-setup"],
      testMatch: appFrameSpecs,
    }
  );
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
  // PXI specs share one Phoenix server/database and mutate agent-visible setup.
  workers: isPxiE2E ? 1 : undefined,
  fullyParallel: !isPxiE2E,
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
    baseURL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",

    /* Wait for each page navigation to complete */
    navigationTimeout: isCI ? 30_000 : 15_000,
  },

  /* Configure projects for major browsers */
  projects: projects,

  /* Run your local dev server before starting the tests */
  webServer: [
    {
      command: "pnpm run dev:server:test",
      url: baseURL,
      reuseExistingServer: !isCI,
      timeout: isCI ? 240_000 : 120_000,
    },
    // Second Phoenix server for the app-frame project (see appFrameSpecs
    // above): assistant enabled, ports offset by one, Prometheus off because
    // its exporter binds a fixed :9090 that the main server owns. PXI runs
    // bring their own single server and never select the app-frame project.
    ...(isPxiE2E
      ? []
      : [
          {
            command: "pnpm run dev:server:test",
            url: appFrameBaseURL,
            reuseExistingServer: !isCI,
            timeout: isCI ? 240_000 : 120_000,
            env: {
              PHOENIX_PORT: String(appFramePort),
              PHOENIX_GRPC_PORT: String(appFrameGrpcPort),
              PHOENIX_E2E_ENABLE_AGENT_ASSISTANT: "true",
              PHOENIX_ENABLE_PROMETHEUS: "False",
            },
          },
        ]),
  ],
});
