import { expect, test } from "@playwright/test";

test.describe("Settings General Tables", () => {
  test("users and api key tables support core interactions", async ({
    page,
  }) => {
    await page.goto("/settings/general");
    await page.waitForURL("**/settings/general");

    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();

    const userHeader = page.getByRole("columnheader", { name: "user" }).first();
    await userHeader.click();
    await expect(userHeader).toHaveAttribute("aria-sort", "ascending");

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
