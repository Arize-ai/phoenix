import { randomUUID } from "crypto";
import { expect, test, type Page } from "@playwright/test";

/**
 * Exploratory coverage for thin/uncovered settings pages:
 * - /settings/models: full create-with-costs round trip, search filtering,
 *   and deletion (overlay-audit.spec.ts only opens/closes the create dialog)
 * - /settings/annotations: annotation config create/edit/delete via the
 *   selection toolbar (no existing coverage)
 * - /settings/data: retention policy create + delete round trip
 *   (overlay-audit.spec.ts only opens the dialog)
 * - /settings/providers: custom AI provider create + delete round trip
 *   (no existing coverage; creating a provider stores credentials but never
 *   makes an LLM call, so no API key is required to succeed)
 */

function rowWithText(page: Page, text: string) {
  return page.getByRole("row").filter({ hasText: text });
}

test.describe("Settings models", () => {
  test("can create a model with token costs and delete it", async ({
    page,
  }) => {
    const modelName = `exploratory-model-${randomUUID()}`;

    await page.goto("/settings/models");
    await page.waitForURL("**/settings/models");
    await page.getByRole("button", { name: "Create a new model" }).click();

    const dialog = page.getByRole("dialog", { name: "Create New Model" });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel(/Model name/).fill(modelName);
    await dialog.getByLabel(/Name pattern/).fill(modelName);
    // The `name`d input of a NumberField is hidden (it only carries the form
    // value); type into the visible textbox in the "Cost / 1M" column of the
    // prompt- and completion-token tables. These fields have no accessible
    // label, so they can only be reached positionally.
    const costInput = (tableIndex: number) =>
      dialog
        .locator("table")
        .nth(tableIndex)
        .locator("tbody tr")
        .first()
        .locator("td")
        .nth(1)
        .getByRole("textbox");
    await costInput(0).fill("1.50");
    await costInput(1).fill("2.50");
    await dialog.getByRole("button", { name: "Create Model" }).click();

    await expect(dialog).not.toBeVisible();
    const modelRow = rowWithText(page, modelName);
    await expect(modelRow).toBeVisible();
    await expect(modelRow).toContainText("$1.50");
    await expect(modelRow).toContainText("$2.50");

    // Only custom models expose a delete action; built-ins are clone-only.
    await modelRow.getByRole("button", { name: "Delete model" }).click();
    const deleteDialog = page.getByRole("dialog", { name: "Delete Model" });
    await expect(deleteDialog).toBeVisible();
    await deleteDialog.getByRole("button", { name: "Delete Model" }).click();

    await expect(rowWithText(page, modelName)).not.toBeVisible();
  });

  test("search filters the model list and shows an empty state", async ({
    page,
  }) => {
    await page.goto("/settings/models");
    await page.waitForURL("**/settings/models");

    // Built-in models ship with every Phoenix instance.
    const builtInRow = rowWithText(page, "chatgpt-4o-latest");
    await expect(builtInRow.first()).toBeVisible();

    const search = page.getByRole("searchbox", { name: "Search models" });
    await search.fill("chatgpt-4o-latest");
    await expect(builtInRow.first()).toBeVisible();
    await expect(rowWithText(page, "claude-3-haiku")).not.toBeVisible();

    await search.fill(`no-match-${randomUUID()}`);
    await expect(page.getByText("No models found")).toBeVisible();
  });
});

test.describe("Settings annotation configs", () => {
  test("can create, edit, and delete a categorical annotation config", async ({
    page,
  }) => {
    const configName = `exploratory-annot-${randomUUID()}`;

    await page.goto("/settings/annotations");
    await page.waitForURL("**/settings/annotations");
    await page.getByRole("button", { name: "New Configuration" }).click();

    const createDialog = page.getByTestId("dialog");
    await expect(
      createDialog.getByRole("heading", { name: "New Annotation Config" })
    ).toBeVisible();
    await createDialog.getByLabel("Annotation Name").fill(configName);
    await createDialog.getByLabel("Description").fill("categorical config");
    await createDialog.getByLabel("Value 1").fill("good");
    await createDialog.getByLabel("Score 1").fill("1");
    await createDialog.getByLabel("Value 2").fill("bad");
    await createDialog.getByLabel("Score 2").fill("0");
    await createDialog
      .getByRole("button", { name: "Create Annotation Config" })
      .click();

    const configRow = rowWithText(page, configName);
    await expect(configRow).toBeVisible();
    await expect(configRow).toContainText("Categorical");
    await expect(configRow).toContainText("good");

    // Selecting the row reveals the selection toolbar with Edit / Delete.
    await configRow.locator(".checkbox").click();
    await expect(configRow.getByRole("checkbox")).toBeChecked();
    const toolbar = page.getByRole("toolbar", {
      name: "Annotation config selection",
    });
    await expect(toolbar).toBeVisible();

    await toolbar.getByRole("button", { name: "Edit" }).click();
    const editDialog = page.getByTestId("dialog");
    await expect(
      editDialog.getByRole("heading", { name: "Edit Annotation Config" })
    ).toBeVisible();
    await editDialog.getByLabel("Description").fill("updated description");
    await editDialog
      .getByRole("button", { name: "Update Annotation Config" })
      .click();
    await expect(configRow).toContainText("updated description");

    // The selection is cleared after an update; re-select to delete.
    await configRow.locator(".checkbox").click();
    await expect(configRow.getByRole("checkbox")).toBeChecked();
    await toolbar
      .getByRole("button", { name: "Delete annotation configs" })
      .click();
    const deleteDialog = page.getByRole("dialog", {
      name: "Delete Annotation Config",
    });
    await expect(deleteDialog).toBeVisible();
    await deleteDialog.getByRole("button", { name: "Delete" }).click();

    await expect(rowWithText(page, configName)).not.toBeVisible();
  });

  test("can create a continuous annotation config with min and max", async ({
    page,
  }) => {
    const configName = `exploratory-annot-cont-${randomUUID()}`;

    await page.goto("/settings/annotations");
    await page.waitForURL("**/settings/annotations");
    await page.getByRole("button", { name: "New Configuration" }).click();

    const dialog = page.getByTestId("dialog");
    await expect(
      dialog.getByRole("heading", { name: "New Annotation Config" })
    ).toBeVisible();
    await dialog.getByLabel("Annotation Name").fill(configName);
    // The styled radio label covers the input; force the click through it.
    await dialog
      .getByRole("radio", { name: "Continuous" })
      .check({ force: true });
    // "Min"/"Max" also match the Optimization Direction radios; target the
    // number fields by role.
    await dialog.getByRole("textbox", { name: "Min" }).fill("0");
    await dialog.getByRole("textbox", { name: "Max" }).fill("10");
    await dialog
      .getByRole("button", { name: "Create Annotation Config" })
      .click();

    const configRow = rowWithText(page, configName);
    await expect(configRow).toBeVisible();
    await expect(configRow).toContainText("Continuous");
  });
});

test.describe("Settings data retention", () => {
  test("can create and delete a retention policy", async ({ page }) => {
    const policyName = `exploratory-policy-${randomUUID()}`;

    await page.goto("/settings/data");
    await page.waitForURL("**/settings/data");
    await page.getByRole("button", { name: "New Policy" }).click();

    const dialog = page.getByRole("dialog", { name: "New Retention Policy" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("textbox", { name: "Name" }).fill(policyName);
    await dialog.getByRole("textbox", { name: "Number of Days" }).fill("30");
    await dialog.getByRole("button", { name: "Create" }).click();

    await expect(dialog).not.toBeVisible();
    const policyRow = rowWithText(page, policyName);
    await expect(policyRow).toBeVisible();
    await expect(policyRow).toContainText("30 days");
    await expect(policyRow).toContainText("No projects");

    // The row action menu button has no accessible name; a fresh policy has
    // no project buttons in its row, so the only button is the action menu.
    await policyRow.getByRole("button").click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    const deleteDialog = page.getByRole("dialog", {
      name: "Delete Retention Policy",
    });
    await expect(deleteDialog).toBeVisible();
    await deleteDialog.getByRole("button", { name: "Delete Policy" }).click();

    await expect(rowWithText(page, policyName)).not.toBeVisible();
  });
});

test.describe("Settings AI providers", () => {
  test("can create and delete a custom AI provider", async ({ page }) => {
    const providerName = `exploratory-provider-${randomUUID()}`;

    await page.goto("/settings/providers");
    await page.waitForURL("**/settings/providers");

    // The built-in provider credentials table always renders.
    await expect(
      page.getByRole("heading", { name: "Custom AI Providers" })
    ).toBeVisible();

    await page.getByRole("button", { name: "Create a new provider" }).click();
    const dialog = page.getByRole("dialog", {
      name: "Create Custom Provider",
    });
    await expect(dialog).toBeVisible();
    await dialog
      .getByRole("textbox", { name: /Provider Name/ })
      .fill(providerName);
    // Saving a provider stores the key without validating it against an LLM.
    await dialog.getByRole("textbox", { name: /API Key/ }).fill("sk-dummy");
    await dialog.getByRole("button", { name: "Create Provider" }).click();

    await expect(dialog).not.toBeVisible();
    const providerRow = rowWithText(page, providerName);
    await expect(providerRow).toBeVisible();

    await providerRow.getByRole("button", { name: "Delete provider" }).click();
    const deleteDialog = page.getByRole("dialog", { name: "Delete Provider" });
    await expect(deleteDialog).toBeVisible();
    await deleteDialog.getByRole("button", { name: "Delete Provider" }).click();

    await expect(rowWithText(page, providerName)).not.toBeVisible();
  });
});
