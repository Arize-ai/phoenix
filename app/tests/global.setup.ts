import { test } from "@playwright/test";

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
