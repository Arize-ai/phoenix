import { test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("first time login expects reset password", async ({ page }) => {
  await page.goto("http://localhost:6006/login");

  await page.getByLabel("Email").fill("admin@localhost");
  await page.getByLabel("Password").fill("admin");
  await page.getByRole("button", { name: "Login" }).click();

  // Reset the password
  await page.waitForURL("**/reset-password");
  await page.getByLabel("Old Password").fill("admin");
  await page.getByLabel("New Password").fill("admin123");
  await page.getByLabel("Confirm Password").fill("admin123");
  await page.getByRole("button", { name: "Reset Password" }).click();
});

test("create a member", async ({ page }) => {
  await page.goto("http://localhost:6006/login");

  await page.getByLabel("Email").fill("admin@localhost");
  await page.getByLabel("Password").fill("admin123");
  await page.getByRole("button", { name: "Login" }).click();
  await page.waitForURL("**/projects/**");
  // Reset the password
  await page.goto("/settings");
  await page.waitForURL("**/settings");
  await page.getByRole("button", { name: "Add User" }).click();

  // Add the user
  await page.getByLabel("Email").fill("member@localhost.com");
  await page.getByLabel("Password").fill("member123");
  await page.getByLabel("member", { exact: true }).click();
  await page.getByRole("option", { name: "member" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add User" })
    .click();
});
