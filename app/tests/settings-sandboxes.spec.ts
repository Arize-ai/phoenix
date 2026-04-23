import { randomUUID } from "crypto";
import { expect, test, type Response } from "@playwright/test";

function isGraphQLMutationResponse(response: Response, operationName: string) {
  if (!response.url().includes("/graphql") || response.status() !== 200) {
    return false;
  }
  const postData = response.request().postData();
  return postData?.includes(operationName) ?? false;
}

test.describe("Settings Sandboxes", () => {
  test.describe.serial("capability-gated editors", () => {
    const configName = `e2e-sandbox-${randomUUID().slice(0, 8)}`;

    test("WASM provider hides env vars, internet access, and dependencies editors", async ({
      page,
    }) => {
      await page.goto("/settings/sandboxes");
      await page.waitForURL("**/settings/sandboxes");

      await page.getByRole("button", { name: "New Sandbox" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      // Select WASM provider
      await dialog.getByLabel("Provider").fill("WebAssembly");
      await page
        .getByRole("option", { name: /WebAssembly/i })
        .first()
        .click();

      // WASM does not support env vars — section must not be visible
      await expect(dialog.getByText("Environment Variables")).not.toBeVisible();

      // WASM internet_access is NONE — toggle must not be visible
      await expect(
        dialog.getByLabel("Allow Internet Access")
      ).not.toBeVisible();

      // WASM has no dependenciesLanguage — packages editor must not be visible
      await expect(dialog.getByText("Python Packages")).not.toBeVisible();
      await expect(dialog.getByText("npm Packages")).not.toBeVisible();

      // Close dialog
      await dialog.getByRole("button", { name: /cancel/i }).click();
      await expect(dialog).not.toBeVisible();
    });

    test("E2B provider shows env vars editor", async ({ page }) => {
      await page.goto("/settings/sandboxes");
      await page.waitForURL("**/settings/sandboxes");

      await page.getByRole("button", { name: "New Sandbox" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      // Select E2B provider
      await dialog.getByLabel("Provider").fill("E2B");
      await page.getByRole("option", { name: /E2B/i }).first().click();

      // E2B supports env vars — section must be visible
      await expect(dialog.getByText("Environment Variables")).toBeVisible();

      // Add a literal env var
      await dialog.getByRole("button", { name: "Add Variable" }).click();
      // Fill the env var name (last "Name" input since the first is the config name)
      await dialog.getByLabel("Name").last().fill("MY_TEST_VAR");
      // The default kind is "literal" — fill the value
      await dialog.getByLabel("Value").last().fill("hello-world");

      // Fill in the sandbox config name (first "Name" input)
      await dialog.getByLabel("Name").first().fill(configName);

      await Promise.all([
        page.waitForResponse((resp) =>
          isGraphQLMutationResponse(
            resp,
            "SandboxConfigDialogCreateSandboxConfigMutation"
          )
        ),
        dialog.getByRole("button", { name: "Create Config" }).click(),
      ]);

      await expect(dialog).not.toBeVisible();

      // Verify the config appears in the table
      await expect(page.getByRole("cell", { name: configName })).toBeVisible();
    });

    test("saved E2B config with env vars round-trips through page reload", async ({
      page,
    }) => {
      await page.goto("/settings/sandboxes");
      await page.waitForURL("**/settings/sandboxes");

      // Find the row for our config
      const configRow = page
        .getByRole("row")
        .filter({ has: page.getByRole("cell", { name: configName }) });
      await expect(configRow).toBeVisible();

      // Open the edit dialog
      await configRow
        .getByRole("button", { name: new RegExp(`Edit ${configName}`) })
        .click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      // Env vars editor should appear (E2B supports env vars)
      await expect(dialog.getByText("Environment Variables")).toBeVisible();

      // The literal env var we saved should be shown
      await expect(dialog.locator('input[value="MY_TEST_VAR"]')).toBeVisible();
      await expect(dialog.locator('input[value="hello-world"]')).toBeVisible();

      // Close without changes
      await dialog.getByRole("button", { name: /cancel/i }).click();
      await expect(dialog).not.toBeVisible();
    });
  });
});
