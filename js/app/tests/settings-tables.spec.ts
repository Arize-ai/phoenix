import { randomUUID } from "crypto";
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

    // System API keys render directly on the page. Create a key so the table
    // is populated regardless of which other tests have run.
    await expect(
      page.getByRole("heading", { name: "System API Keys" })
    ).toBeVisible();
    const keyName = `System-${randomUUID()}`;
    await page.getByRole("button", { name: "System Key", exact: true }).click();
    const createDialog = page.getByRole("dialog", {
      name: "Create an API Key",
    });
    await createDialog.getByLabel("Name").fill(keyName);
    await createDialog.getByRole("button", { name: "Create Key" }).click();
    await expect(
      page.getByRole("heading", { name: "New API Key Created" })
    ).toBeVisible();
    await page.getByRole("button", { name: "dismiss", exact: true }).click();

    await expect(
      page.getByRole("columnheader", { name: "Name" }).first()
    ).toBeVisible();
    await expect(page.getByRole("cell", { name: keyName })).toBeVisible();

    // User API keys now live in the user details drawer on the Users tab
    await page.goto("/settings/users");
    await page.waitForURL("**/settings/users");
    await page.getByRole("link", { name: "member", exact: true }).click();
    const dialog = page.getByRole("dialog", {
      name: "User details for member",
    });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: "API Keys", exact: true })
    ).toBeVisible();
  });
});
