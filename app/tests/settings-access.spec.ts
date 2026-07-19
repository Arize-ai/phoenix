import { expect, test, type Page } from "@playwright/test";

async function expectAdminSettingsAreInaccessible({ page }: { page: Page }) {
  for (const path of ["/settings/users", "/settings/api-keys"]) {
    await page.goto(path);
    await page.waitForURL("**/settings/general");
  }

  // Anchor on a tab that is visible to everyone so the negative assertions
  // below can't pass vacuously on a blank or crashed page.
  await expect(page.getByRole("tab", { name: "General" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Users" })).not.toBeVisible();
  await expect(page.getByRole("tab", { name: "API Keys" })).not.toBeVisible();
}

for (const role of ["member", "viewer"] as const) {
  test.describe(`${role} settings access`, () => {
    test.use({ storageState: `playwright/.auth/${role}.json` });

    test("redirects away from admin settings", async ({ page }) => {
      await expectAdminSettingsAreInaccessible({ page });
    });
  });
}
