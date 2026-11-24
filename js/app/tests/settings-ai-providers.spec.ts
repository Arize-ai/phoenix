import { expect, test, type Page } from "@playwright/test";

const PROVIDER_NAME = "DeepSeek";
const ENV_VAR_NAME = "DEEPSEEK_API_KEY";

function providerRow(page: Page) {
  return page.getByRole("row").filter({
    has: page.getByRole("cell", { name: ENV_VAR_NAME, exact: true }),
  });
}

async function openServerTab(page: Page) {
  await providerRow(page)
    .getByRole("button", { name: `Edit ${PROVIDER_NAME} credentials` })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("tab", { name: "Server" }).click();
  return dialog.getByRole("tabpanel");
}

test.describe("Settings AI Providers", () => {
  test("updates the provider status after saving and clearing a server credential", async ({
    page,
  }) => {
    await page.goto("/settings/providers");
    const row = providerRow(page);
    await expect(row).toContainText("Needs credentials");

    let serverTab = await openServerTab(page);
    await serverTab
      .locator(`input[name="${ENV_VAR_NAME}"]`)
      .fill("playwright-deepseek-key");
    await serverTab.getByRole("button", { name: "Save" }).click();

    // Saving closes the dialog; the table must refetch to show the new status
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(row).toContainText("On the server");

    serverTab = await openServerTab(page);
    await serverTab.getByRole("button", { name: "Clear" }).click();
    await expect(
      serverTab.locator(`input[name="${ENV_VAR_NAME}"]`)
    ).toHaveValue("");
    await page.getByTestId("dialog-close-button").click();
    await expect(page.getByRole("dialog")).not.toBeVisible();

    await expect(row).toContainText("Needs credentials");
  });
});
