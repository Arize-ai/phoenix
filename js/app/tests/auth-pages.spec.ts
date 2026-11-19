import { expect, test } from "@playwright/test";

test("login focuses email and hides unavailable email reset", async ({
  page,
}) => {
  await page.goto("/login");

  await expect(page.getByLabel("Email")).toBeFocused();
  await expect(
    page.getByRole("link", { name: "Forgot your password?" })
  ).toHaveCount(0);
});

test("password reset pages focus the first input", async ({ page }) => {
  await page.goto("/reset-password");
  await expect(page.getByLabel("Old Password")).toBeFocused();

  await page.goto("/reset-password-with-token?token=test-token");
  await expect(page.getByLabel("New Password")).toBeFocused();

  await page.goto("/forgot-password");
  await expect(page.getByLabel("Email")).toBeFocused();
});
