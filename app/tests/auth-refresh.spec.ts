import { expect, test, type Page } from "@playwright/test";

// These tests exercise the client-side auth refresh paths by forcing GraphQL
// requests to encounter an expired-session response through the UI.

// reset browser state so that these tests do not poison the auth of other tests
// without this, all tests take exponentially longer as they hit expiring auth sessions
test.use({ storageState: { cookies: [], origins: [] } });

async function loginAsMember(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("member@localhost.com");
  await page.getByLabel("Password").fill("member123");
  await page.getByRole("button", { name: "Log In", exact: true }).click();
  await page.waitForURL("**/projects");
}

async function openProjectsPage(page: Page) {
  await loginAsMember(page);
  await page.goto("/projects");
  await page.waitForURL("**/projects");
  await expect(page.getByRole("button", { name: "New Project" })).toBeVisible();
}

test("recovers from an expired session by refreshing auth", async ({
  page,
}) => {
  let graphqlFailures = 0;
  let refreshRequests = 0;

  await openProjectsPage(page);

  await page.route("**/graphql", async (route) => {
    if (graphqlFailures === 0) {
      graphqlFailures += 1;
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ errors: [{ message: "Unauthorized" }] }),
      });
      return;
    }
    await route.continue();
  });

  await page.route("**/auth/refresh", async (route) => {
    refreshRequests += 1;
    await route.continue();
  });

  await page.reload();
  await page.waitForURL("**/projects");

  await expect(page.getByRole("button", { name: "New Project" })).toBeVisible();
  await expect.poll(() => refreshRequests).toBeGreaterThan(0);
  expect(graphqlFailures).toBe(1);
});

test("redirects to login when session refresh fails", async ({ page }) => {
  let graphqlFailures = 0;

  await openProjectsPage(page);

  await page.route("**/graphql", async (route) => {
    if (graphqlFailures === 0) {
      graphqlFailures += 1;
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ errors: [{ message: "Unauthorized" }] }),
      });
      return;
    }
    await route.continue();
  });

  await page.route("**/auth/refresh", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Unauthorized" }),
    });
  });

  await page.reload();
  await page.waitForURL("**/login?returnUrl=%2Fprojects");
});

test("redirects to login when session refresh times out", async ({ page }) => {
  let graphqlFailures = 0;
  const refreshTimeoutMs = 200;

  await page.addInitScript((timeoutMs) => {
    window.__PHOENIX_AUTH_REFRESH_TIMEOUT_MS__ = timeoutMs;
  }, refreshTimeoutMs);

  await openProjectsPage(page);

  await page.route("**/graphql", async (route) => {
    if (graphqlFailures === 0) {
      graphqlFailures += 1;
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ errors: [{ message: "Unauthorized" }] }),
      });
      return;
    }
    await route.continue();
  });

  await page.route("**/auth/refresh", async (route) => {
    // Stall refresh past the authFetch timeout so the UI must fall back to login.
    await new Promise((resolve) => setTimeout(resolve, refreshTimeoutMs + 50));
    await route.abort();
  });

  await page.reload();
  await page.waitForURL("**/login?returnUrl=%2Fprojects");
});
