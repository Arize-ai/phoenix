import { randomUUID } from "crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";

const modelDialog = (page: Page) => page.getByRole("dialog");

const costTable = (dialog: Locator, kind: "prompt" | "completion") =>
  dialog.getByRole("table").nth(kind === "prompt" ? 0 : 1);

const tokenTypeInput = (table: Locator, index: number) =>
  table.getByRole("combobox", { name: "Token type" }).nth(index);

/**
 * Tabbing out closes the suggestions popover, which would otherwise swallow
 * the next click outside the combobox.
 */
async function fillComboBox(comboBox: Locator, value: string) {
  await comboBox.fill(value);
  await comboBox.press("Tab");
}

function uniqueModelName() {
  return `pw-model-${randomUUID().slice(0, 8)}`;
}

async function openCreateModelDialog(page: Page) {
  await page.goto("/settings/models");
  await page.waitForURL("**/settings/models");
  await page.getByRole("button", { name: "Create a new model" }).click();
  const dialog = modelDialog(page);
  await expect(
    dialog.getByRole("heading", { name: "Create New Model" })
  ).toBeVisible();
  return dialog;
}

async function fillModelBasics(
  dialog: Locator,
  { name, provider }: { name: string; provider?: string }
) {
  await dialog.getByRole("textbox", { name: /Model name/ }).fill(name);
  await dialog.getByRole("textbox", { name: /Name pattern/ }).fill(`^${name}$`);
  if (provider !== undefined) {
    await fillComboBox(
      dialog.getByRole("combobox", { name: "Provider" }),
      provider
    );
  }
}

async function addTokenTypeRow(table: Locator, tokenType: string) {
  const tokenTypeInputs = table.getByRole("combobox", { name: "Token type" });
  const rowCount = await tokenTypeInputs.count();
  await table.getByRole("button", { name: "Add row" }).click();
  await expect(tokenTypeInputs).toHaveCount(rowCount + 1);
  if (tokenType) {
    await fillComboBox(tokenTypeInputs.nth(rowCount), tokenType);
  }
}

async function submitCreate(page: Page) {
  await modelDialog(page).getByRole("button", { name: "Create Model" }).click();
}

async function openEditModelDialog(page: Page, name: string) {
  await page.getByRole("searchbox", { name: "Search models" }).fill(name);
  const row = page.getByRole("row").filter({ hasText: `^${name}$` });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Edit model" }).click();
  const dialog = modelDialog(page);
  await expect(
    dialog.getByRole("heading", { name: "Edit Model" })
  ).toBeVisible();
  return { dialog, row };
}

test.describe("Settings Models", () => {
  test("keeps custom provider and token type casing as typed", async ({
    page,
  }) => {
    const name = uniqueModelName();
    const dialog = await openCreateModelDialog(page);
    await fillModelBasics(dialog, { name, provider: "  AcmeAI " });
    const promptTable = costTable(dialog, "prompt");
    await fillComboBox(tokenTypeInput(promptTable, 0), "Input");
    await addTokenTypeRow(promptTable, "CachedAudio");
    await submitCreate(page);

    await expect(dialog).not.toBeVisible();

    const { dialog: editDialog, row } = await openEditModelDialog(page, name);
    await expect(row).toContainText("AcmeAI");
    await expect(
      editDialog.getByRole("combobox", { name: "Provider" })
    ).toHaveValue("AcmeAI");
    const editTokenTypeInputs = costTable(editDialog, "prompt").getByRole(
      "combobox",
      { name: "Token type" }
    );
    await expect
      .poll(() =>
        editTokenTypeInputs.evaluateAll((inputs) =>
          inputs.map((input) => (input as HTMLInputElement).value).sort()
        )
      )
      .toEqual(["CachedAudio", "input"]);
  });

  test("stores a typed provider label as its provider value", async ({
    page,
  }) => {
    const name = uniqueModelName();
    const dialog = await openCreateModelDialog(page);
    await fillModelBasics(dialog, { name, provider: "azure openai" });
    await submitCreate(page);

    await expect(dialog).not.toBeVisible();

    const { dialog: editDialog } = await openEditModelDialog(page, name);
    await expect(
      editDialog.getByRole("combobox", { name: "Provider" })
    ).toHaveValue("azure");
  });

  test("clears a duplicate token type error once the duplicate is resolved", async ({
    page,
  }) => {
    const dialog = await openCreateModelDialog(page);
    await fillModelBasics(dialog, { name: uniqueModelName() });
    const promptTable = costTable(dialog, "prompt");
    const duplicateError = dialog.getByText("Duplicate token type");

    await addTokenTypeRow(promptTable, "audio");
    await addTokenTypeRow(promptTable, " Audio");
    await submitCreate(page);

    await expect(duplicateError).toHaveCount(1);
    await expect(dialog).toBeVisible();

    await fillComboBox(tokenTypeInput(promptTable, 1), "cache_read");
    await expect(duplicateError).toHaveCount(0);

    await addTokenTypeRow(promptTable, "INPUT");
    await submitCreate(page);
    await expect(duplicateError).toHaveCount(1);
    // Submitting focuses the invalid combobox, which opens its suggestions.
    await page.keyboard.press("Tab");

    await addTokenTypeRow(promptTable, "");
    await promptTable
      .getByRole("button", { name: "Remove token type" })
      .nth(3)
      .click();
    await expect(duplicateError).toHaveCount(0);
    await expect(dialog.getByText("Token type is required")).toHaveCount(0);
  });

  test("keeps the dialog open with its values when the server rejects the model", async ({
    page,
  }) => {
    const name = uniqueModelName();
    let dialog = await openCreateModelDialog(page);
    await fillModelBasics(dialog, { name });
    await submitCreate(page);
    await expect(dialog).not.toBeVisible();

    await page.getByRole("button", { name: "Create a new model" }).click();
    dialog = modelDialog(page);
    await fillModelBasics(dialog, { name, provider: "AcmeAI" });
    await submitCreate(page);

    await expect(
      dialog.getByText(`Model with name '${name}' already exists`)
    ).toBeVisible();
    await expect(
      dialog.getByRole("textbox", { name: /Model name/ })
    ).toHaveValue(name);
    await expect(
      dialog.getByRole("combobox", { name: "Provider" })
    ).toHaveValue("AcmeAI");

    await dialog.getByRole("textbox", { name: /Model name/ }).fill(`${name}-2`);
    await submitCreate(page);
    await expect(dialog).not.toBeVisible();
  });
});
