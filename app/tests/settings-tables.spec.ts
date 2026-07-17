import { expect, test, type Locator } from "@playwright/test";

async function clickSortableHeaderAndExpect(
  header: Locator,
  direction: "ascending" | "descending"
) {
  await header.locator(".sort").click();
  await expect(header).toHaveAttribute("aria-sort", direction);
}

test.describe("Settings Tables", () => {
  test("users table supports core interactions", async ({ page }) => {
    await page.goto("/settings/users");
    await page.waitForURL("**/settings/users");

    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();

    const userHeader = page.getByRole("columnheader", { name: "user" }).first();
    await clickSortableHeaderAndExpect(userHeader, "ascending");
  });

  test("api key tables support core interactions", async ({ page }) => {
    await page.goto("/settings/api-keys");
    await page.waitForURL("**/settings/api-keys");

    await page.getByRole("tab", { name: "User Keys" }).click();
    await expect(
      page.getByRole("columnheader", { name: "Name" }).first()
    ).toBeVisible();

    await page.getByRole("tab", { name: "System Keys" }).click();
    await expect(
      page.getByRole("columnheader", { name: "Name" }).first()
    ).toBeVisible();
  });
});
