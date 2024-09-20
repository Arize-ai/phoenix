import { test } from "@playwright/test";

test("user can view getting started guide when no traces", async ({ page }) => {
  await page.goto("http://localhost:6006/");
  await page.getByPlaceholder("your email address").fill("admin@localhost");
  await page.getByPlaceholder("your email address").press("Tab");
  await page.getByPlaceholder("your password").fill("admin123");
  await page.getByPlaceholder("your password").press("Enter");
  await page.getByRole("button", { name: "Get Started" }).click();
  await page.getByLabel("dismiss").click();
});
