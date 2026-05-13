import { randomUUID } from "crypto";
import { expect, test, type Locator, type Response } from "@playwright/test";

function isGraphQLMutationResponse(response: Response, operationName: string) {
  if (!response.url().includes("/graphql") || response.status() !== 200) {
    return false;
  }
  const postData = response.request().postData();
  return postData?.includes(operationName) ?? false;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Pick the provider from the `<Select>` in the New/Edit Sandbox dialog. The
 * trigger is a `<button>` whose accessible name ends with the field label
 * "Sandbox Provider"; the option content is a provider icon plus its display
 * name, so match the option on a substring regex.
 */
async function selectProvider(dialog: Locator, providerName: string | RegExp) {
  await dialog.getByRole("button", { name: /\bSandbox Provider\s*$/ }).click();
  await dialog
    .page()
    .getByRole("option", {
      name:
        typeof providerName === "string"
          ? new RegExp(escapeRegex(providerName))
          : providerName,
    })
    .first()
    .click();
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
      const dialog = page.getByTestId("dialog");
      await expect(dialog).toBeVisible();

      // Select WASM provider.
      await selectProvider(dialog, /WebAssembly/i);

      // For unsupported capabilities, the dialog renders the section
      // heading plus a "Not supported by the selected backend." copy
      // instead of the editor. Assert the interactive controls are gone
      // and the not-supported copy appears once per disabled section.

      // Env vars: Add Variable button is the only interactive control;
      // it must not be present for WASM (supportsEnvVars=false).
      await expect(
        dialog.getByRole("button", { name: "Add Variable" })
      ).not.toBeVisible();

      // Internet access: WASM internet_access is NONE — toggle must not
      // be visible.
      await expect(
        dialog.getByLabel("Allow Internet Access")
      ).not.toBeVisible();

      // Dependencies: WASM has no dependenciesLanguage — neither package
      // editor label should be visible.
      await expect(dialog.getByLabel("Python Packages")).not.toBeVisible();
      await expect(dialog.getByLabel("npm Packages")).not.toBeVisible();

      // The three disabled-capability sections each render the same
      // "Not supported by the selected backend." copy.
      await expect(
        dialog.getByText("Not supported by the selected backend.")
      ).toHaveCount(3);

      // Close dialog
      await dialog.getByRole("button", { name: /cancel/i }).click();
      await expect(page.getByTestId("dialog")).not.toBeVisible();
    });

    test("E2B provider shows env vars editor", async ({ page }) => {
      await page.goto("/settings/sandboxes");
      await page.waitForURL("**/settings/sandboxes");

      await page.getByRole("button", { name: "New Sandbox" }).click();
      const dialog = page.getByTestId("dialog");
      await expect(dialog).toBeVisible();

      // Select E2B provider
      await selectProvider(dialog, /E2B/i);

      // E2B supports env vars — section heading must be visible. Use
      // exact match so the empty-state copy "No environment variables
      // configured." (case-insensitive substring of the heading) does
      // not also resolve.
      await expect(
        dialog.getByText("Environment Variables", { exact: true })
      ).toBeVisible();

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

      await expect(page.getByTestId("dialog")).not.toBeVisible();

      // Verify the config appears in the table. The configName text is
      // exposed in two cells of the same row — the Name cell ("<name>
      // No") and the Actions cell (whose accessible name aggregates
      // the "Edit <name>" / "Delete <name>" button labels) — so anchor
      // on the first match.
      await expect(
        page.getByRole("cell", { name: configName }).first()
      ).toBeVisible();
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
      const dialog = page.getByTestId("dialog");
      await expect(dialog).toBeVisible();

      // Env vars editor should appear (E2B supports env vars). Use exact
      // match so the empty-state copy doesn't also resolve.
      await expect(
        dialog.getByText("Environment Variables", { exact: true })
      ).toBeVisible();

      // The literal env var we saved should be shown by name. The literal
      // value is redacted on read (see `redact_env_var_literals`) so the
      // value input round-trips as "<redacted>", not the cleartext we typed.
      // Re-saving requires the user to retype the value.
      await expect(dialog.locator('input[value="MY_TEST_VAR"]')).toBeVisible();
      await expect(dialog.locator('input[value="<redacted>"]')).toBeVisible();

      // Close without changes
      await dialog.getByRole("button", { name: /cancel/i }).click();
      await expect(page.getByTestId("dialog")).not.toBeVisible();
    });
  });
});
