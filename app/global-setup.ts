import { chromium, type FullConfig } from "@playwright/test";

async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;
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
}

export default globalSetup;
