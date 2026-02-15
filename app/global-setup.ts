import { chromium, expect, type FullConfig } from "@playwright/test";

async function waitForReadyz({
  baseURL,
  timeoutMs = 120_000,
  pollIntervalMs = 500,
}: {
  baseURL: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
}) {
  const readyzUrl = `${baseURL}/readyz`;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(readyzUrl);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until timeout to tolerate startup races.
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`readyz not reachable at ${readyzUrl} within ${timeoutMs}ms`);
}

async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;
  if (!baseURL) {
    throw new Error("playwright baseURL must be configured");
  }
  await waitForReadyz({ baseURL });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${baseURL}/login`);
  await page.getByLabel("Email").fill("admin@localhost");
  await page.getByLabel("Password").fill("admin");
  await page.getByRole("button", { name: "Log In", exact: true }).click();

  // Reset admin password
  await page.waitForURL("**/reset-password");
  await page.getByLabel("Old Password").fill("admin");
  await page.getByLabel("New Password").fill("admin123");
  await page.getByLabel("Confirm Password").fill("admin123");
  await page.getByRole("button", { name: "Reset Password" }).click();
  await page.goto(`${baseURL}/login`);

  await page.getByLabel("Email").fill("admin@localhost");
  await page.getByLabel("Password").fill("admin123");
  await page.getByRole("button", { name: "Log In", exact: true }).click();
  await page.waitForURL("**/projects");
  await page.goto(`${baseURL}/settings/general`);
  await page.waitForURL("**/settings/general");

  // Add member user
  await page.getByRole("button", { name: "Add User" }).click();
  await page.getByLabel("Email").fill("member@localhost.com");
  await page.getByLabel("Username").fill("member");
  await page.getByLabel("Password", { exact: true }).fill("member");
  await page.getByLabel("Confirm Password").fill("member");

  await page.getByRole("dialog").getByLabel("member", { exact: true }).click();
  await page.getByRole("option", { name: "member" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add User" })
    .click();

  // Wait for dialog to close before opening a new one
  await expect(page.getByTestId("dialog")).not.toBeVisible();

  // Add viewer user
  await page.getByRole("button", { name: "Add User" }).click();
  await page.getByLabel("Email").fill("viewer@localhost.com");
  await page.getByLabel("Username").fill("viewer");
  await page.getByLabel("Password", { exact: true }).fill("viewer");
  await page.getByLabel("Confirm Password").fill("viewer");

  await page.getByRole("dialog").getByLabel("member", { exact: true }).click();
  await page.getByRole("option", { name: "viewer" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add User" })
    .click();

  // Wait for dialog to close before proceeding
  await expect(page.getByTestId("dialog")).not.toBeVisible();

  // Log out of admin account
  await page.getByRole("button", { name: "Log Out" }).click();

  // Log in as member
  await page.goto(`${baseURL}/login`);
  await page.getByLabel("Email").fill("member@localhost.com");
  await page.getByLabel("Password").fill("member");
  await page.getByRole("button", { name: "Log In", exact: true }).click();

  // Reset member password
  await page.waitForURL("**/reset-password");
  await page.getByLabel("Old Password").fill("member");
  await page.getByLabel("New Password").fill("member123");
  await page.getByLabel("Confirm Password").fill("member123");
  await page.getByRole("button", { name: "Reset Password" }).click();

  // Log in as viewer
  await page.goto(`${baseURL}/login`);
  await page.getByLabel("Email").fill("viewer@localhost.com");
  await page.getByLabel("Password").fill("viewer");
  await page.getByRole("button", { name: "Log In", exact: true }).click();

  // Reset viewer password
  await page.waitForURL("**/reset-password");
  await page.getByLabel("Old Password").fill("viewer");
  await page.getByLabel("New Password").fill("viewer123");
  await page.getByLabel("Confirm Password").fill("viewer123");
  await page.getByRole("button", { name: "Reset Password" }).click();

  await browser.close();
}

export default globalSetup;
