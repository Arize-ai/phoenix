import { chromium, type FullConfig } from "@playwright/test";

async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.goto(`${baseURL}/login`);
  await page.getByLabel("Email").fill("admin@localhost");
  await page.getByLabel("Password").fill("admin");
  await page.getByRole("button", { name: "Login" }).click();

  // Reset the password
  await page.waitForURL("**/reset-password");
  await page.getByLabel("Old Password").fill("admin");
  await page.getByLabel("New Password").fill("admin123");
  await page.getByLabel("Confirm Password").fill("admin123");
  await page.getByRole("button", { name: "Reset Password" }).click();

  await page.goto(`${baseURL}/login`);

  await page.getByLabel("Email").fill("admin@localhost");
  await page.getByLabel("Password").fill("admin123");
  await page.getByRole("button", { name: "Login" }).click();
  await page.waitForURL("**/projects/**");
  // Reset the password
  await page.goto(`${baseURL}/settings`);
  await page.waitForURL("**/settings");
  await page.getByRole("button", { name: "Add User" }).click();

  // Add the user
  await page.getByLabel("Email").fill("member@localhost.com");
  await page.getByLabel("Username *").fill("member");
  await page.getByLabel("Password *", { exact: true }).fill("member123");
  await page.getByLabel("Confirm Password").fill("member123");

  await page.getByRole("dialog").getByLabel("member", { exact: true }).click();
  await page.getByRole("option", { name: "member" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add User" })
    .click();
}

export default globalSetup;
