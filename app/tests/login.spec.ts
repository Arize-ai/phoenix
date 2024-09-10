import { expect, test } from "@playwright/test";

test("can log in", async ({ page }) => {
  await page.goto("http://localhost:6006/login");

  await page.getByLabel("Email").fill("admin@localhost");
  await page.getByLabel("Password").fill("admin");
  // Submit the form
  await page.getByRole("button", { name: "Login" }).click();
});
