import { expect, test } from "@playwright/test";
import { randomUUID } from "crypto";

import { ADMIN_USER, login } from "./utils/login";

test.describe("Playground", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN_USER);
  });

  test("preserves prompt selection in the URL across page reloads", async ({
    page,
  }) => {
    // Navigate to the playground
    await page.goto("/playground");
    await page.waitForURL("**/playground");
    await expect(
      page.getByRole("heading", { name: "Playground" })
    ).toBeVisible();

    // Save a new prompt so we have a prompt ID in the URL
    await page.getByRole("button", { name: "Save Prompt" }).click();
    const promptName = `playground-url-test-${randomUUID().slice(0, 8)}`;
    await page.getByPlaceholder("Select or enter new prompt").click();
    await page.getByPlaceholder("Select or enter new prompt").fill(promptName);
    await page
      .getByLabel("Prompt Description")
      .fill("test prompt for URL persistence");
    await page.getByRole("button", { name: "Create Prompt" }).click();

    // Wait for the save to complete — the URL should now contain promptId
    await expect(page).toHaveURL(/promptId=/);

    // Capture the current URL with prompt params
    const urlAfterSave = page.url();
    const savedSearchParams = new URL(urlAfterSave).searchParams;
    const promptId = savedSearchParams.get("promptId");
    expect(promptId).toBeTruthy();

    // Reload the page and wait for the playground to render
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Playground" })
    ).toBeVisible();

    // Verify the URL still contains the prompt params after reload
    await expect(page).toHaveURL(/promptId=/);
    const urlAfterReload = page.url();
    const reloadedSearchParams = new URL(urlAfterReload).searchParams;
    expect(reloadedSearchParams.get("promptId")).toBe(promptId);
  });
});
