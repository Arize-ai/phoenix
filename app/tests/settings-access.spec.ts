import { expect, test, type Page } from "@playwright/test";

async function expectAdminSettingsAreInaccessible({ page }: { page: Page }) {
  for (const path of ["/settings/users", "/settings/api-keys"]) {
    await page.goto(path);
    await page.waitForURL("**/settings/general");
  }

  await expect(page.getByRole("tab", { name: "Users" })).not.toBeVisible();
  await expect(page.getByRole("tab", { name: "API Keys" })).not.toBeVisible();
}

test.describe("member settings access", () => {
  test.use({ storageState: "playwright/.auth/member.json" });

  test("redirects away from admin settings", async ({ page }) => {
    await expectAdminSettingsAreInaccessible({ page });
  });
});

test.describe("viewer settings access", () => {
  test.use({ storageState: "playwright/.auth/viewer.json" });

  test("redirects away from admin settings", async ({ page }) => {
    await expectAdminSettingsAreInaccessible({ page });
  });
});
