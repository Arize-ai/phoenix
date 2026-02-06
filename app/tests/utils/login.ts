import { expect, Page } from "@playwright/test";

type UserCredentials = {
  email: string;
  password: string;
};

export const ADMIN_USER: UserCredentials = {
  email: "admin@localhost",
  password: "admin123",
};

export const MEMBER_USER: UserCredentials = {
  email: "member@localhost.com",
  password: "member123",
};

export const VIEWER_USER: UserCredentials = {
  email: "viewer@localhost.com",
  password: "viewer123",
};

/**
 * Performs login and waits for successful navigation to the projects page.
 *
 * This helper handles the full login flow including:
 * 1. Navigation to login page
 * 2. Filling credentials
 * 3. Submitting the form
 * 4. Waiting for the projects page to fully load
 *
 * Note: Rate limiting is disabled for the test server (PHOENIX_DISABLE_RATE_LIMIT=True)
 * so we don't need to handle rate limit errors here.
 *
 * @param page - Playwright Page object
 * @param credentials - User credentials (defaults to ADMIN_USER)
 */
export async function login(
  page: Page,
  credentials: UserCredentials = ADMIN_USER
): Promise<void> {
  // Navigate to login page and wait for it to be ready
  await page.goto("/login");

  // Wait for the login form to be fully loaded and interactive
  const emailInput = page.getByLabel("Email");
  await expect(emailInput).toBeVisible({ timeout: 10000 });

  // Fill in credentials
  await emailInput.fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);

  // Click the login button
  await page.getByRole("button", { name: "Log In", exact: true }).click();

  // Wait for the projects page URL and content
  // The login flow goes: /login -> / -> /projects (via redirects)
  await page.waitForURL("**/projects", { timeout: 30000 });
  await expect(
    page.getByRole("searchbox", { name: "Search projects by name" })
  ).toBeVisible({ timeout: 30000 });
}
