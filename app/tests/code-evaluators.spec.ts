import { randomUUID } from "crypto";
import {
  expect,
  test,
  type Locator,
  type Page,
  type Response,
} from "@playwright/test";

function isGraphQLMutationResponse(response: Response, operationName: string) {
  if (!response.url().includes("/graphql") || response.status() !== 200) {
    return false;
  }
  const postData = response.request().postData();
  return postData?.includes(operationName) ?? false;
}

/**
 * Locator for the trigger of a labeled `<Select>` (React Aria Components).
 * The trigger is a `<button>` whose accessible name is the concatenation of
 * the SelectValue text followed by the field Label (e.g. "Value Kind",
 * "Select a sandbox... Sandbox"). We anchor on the trailing label so we don't
 * collide with disclosure triggers or other buttons whose labels happen to
 * start with the same word (e.g. "Sandbox Runtime").
 */
function selectTrigger(scope: Page | Locator, label: string): Locator {
  return scope.getByRole("button", {
    name: new RegExp(`\\b${escapeRegex(label)}\\s*$`),
  });
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Pick an option from a `<Select>` by its visible text. Some Phoenix Selects
 * render compound option content (provider icon + name); WebKit then exposes
 * the icon's `<title>` text alongside the visible label in the option's
 * accessible name. Match on a substring regex so we don't have to keep both
 * shapes in sync.
 */
async function selectFromSelect(
  page: Page,
  scope: Page | Locator,
  label: string,
  optionName: string
) {
  const trigger = selectTrigger(scope, label);
  await trigger.click();
  await page
    .getByRole("option", { name: new RegExp(escapeRegex(optionName)) })
    .first()
    .click();
  await expect(trigger).toContainText(optionName);
}

/**
 * Pick an option from a `<ComboBox>` (filterable input) by its visible text.
 * Some Phoenix ComboBoxes render compound option content (icon + label +
 * adjacent metadata badge), so the option's accessible name often contains
 * the option's textValue *plus* the surrounding text. Match on a substring
 * regex anchored on word boundaries instead of `exact: true`.
 */
async function selectFromCombobox(
  page: Page,
  scope: Locator,
  label: string,
  optionName: string
) {
  const combobox = scope.getByRole("combobox", { name: label });
  await combobox.click();
  await combobox.fill(optionName);
  await page
    .getByRole("option", { name: new RegExp(escapeRegex(optionName)) })
    .first()
    .click();
  await expect(combobox).toHaveValue(optionName);
}

async function createDatasetWithExample(page: Page, datasetName: string) {
  await page.goto("/datasets");
  await page.waitForURL("**/datasets");

  await page.getByRole("button", { name: "New Dataset" }).click();
  await expect(
    page.getByRole("heading", { name: "Create Dataset" })
  ).toBeVisible();

  await page.getByRole("tab", { name: "From scratch" }).click();
  await page.getByLabel("Dataset Name").clear();
  await page.getByLabel("Dataset Name").fill(datasetName);
  await page
    .getByLabel("Description")
    .fill("Dataset for custom code evaluator flows");

  await page.getByRole("button", { name: "Create Dataset" }).click();
  await expect(page.getByTestId("dialog")).not.toBeVisible();

  await page.getByRole("link", { name: datasetName }).click();
  await page.waitForURL("**/datasets/**/examples");

  // The "Add Dataset Example" button opens a menu; pick the manual-entry path
  // to land in the example form dialog.
  await page
    .getByRole("button", { name: "Add Dataset Example" })
    .or(page.getByRole("button", { name: "Example" }))
    .click();
  await page.getByRole("menuitem", { name: "Add Example Manually" }).click();

  const dialog = page
    .getByRole("dialog")
    .filter({ has: page.getByRole("button", { name: "Add Example" }) });
  await expect(dialog).toBeVisible();
  const inputEditor = dialog.locator(".cm-content").first();
  await expect(inputEditor).toBeVisible();
  await inputEditor.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(
    '{"output": {"answer": "4"}, "reference": {"answer": "4"}}'
  );

  await dialog.getByText("Create more", { exact: true }).click();
  await dialog.getByRole("button", { name: "Add Example" }).click();
  await expect(dialog).not.toBeVisible();
}

async function gotoDatasetEvaluators(page: Page, datasetName: string) {
  await page.goto("/datasets");
  await page.waitForURL("**/datasets");
  await page.getByRole("link", { name: datasetName }).click();
  await page.waitForURL("**/datasets/**/examples");
  await page.getByRole("tab", { name: /Evaluators/i }).click();
  await page.waitForURL("**/evaluators");
}

/**
 * Find an enabled provider row in the Sandbox Providers table for a given
 * language, returning the displayed provider (backend) name. The table
 * structure is `Provider | Language | Updated | Status | actions`, where the
 * Provider cell renders an icon, a `<span>` with the backend display name,
 * and a contextual-help button. The Status cell exposes a Switch labeled
 * "Enabled" when the provider is available.
 *
 * The display-name span is the only `<span>` in the cell with no descendant
 * elements (the icon wrapper contains an SVG), so we filter to that.
 */
async function getEnabledProviderName(
  page: Page,
  language: "Python" | "TypeScript"
): Promise<string> {
  const providerRow = page
    .locator("table")
    .first()
    .locator("tbody tr")
    .filter({
      has: page.getByRole("cell", { name: language, exact: true }),
    })
    .filter({ has: page.getByRole("switch", { name: "Enabled" }) })
    .first();

  await expect(providerRow).toBeVisible();
  await expect(
    providerRow.getByRole("switch", { name: "Enabled" })
  ).toBeChecked();

  const providerName = (
    await providerRow
      .locator("td")
      .first()
      .locator("span:not(:has(*))")
      .first()
      .textContent()
  )?.trim();
  expect(providerName).toBeTruthy();
  return providerName!;
}

async function ensureSandboxConfig(
  page: Page,
  language: "Python" | "TypeScript",
  configName: string
) {
  await page.goto("/settings/sandboxes");
  await page.waitForURL("**/settings/sandboxes");

  const providerName = await getEnabledProviderName(page, language);

  await page.getByRole("button", { name: "New Sandbox" }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "New Sandbox Config" })
  ).toBeVisible();

  await selectFromCombobox(page, dialog, "Provider", providerName);
  await dialog.getByRole("textbox", { name: "Name" }).fill(configName);

  await Promise.all([
    page.waitForResponse((response) =>
      isGraphQLMutationResponse(
        response,
        "SandboxConfigDialogCreateSandboxConfigMutation"
      )
    ),
    dialog.getByRole("button", { name: "Create Config" }).click(),
  ]);

  await expect(dialog).not.toBeVisible();
  // The same configName text appears in both the Name cell and the actions
  // cell (via the Edit/Delete button aria-labels), so anchor on the first.
  await expect(
    page.getByRole("cell", { name: configName }).first()
  ).toBeVisible();
}

/**
 * Set the Language Select in a code-evaluator dialog and assert the new value.
 */
async function selectLanguage(
  page: Page,
  scope: Locator,
  language: "Python" | "TypeScript"
) {
  await selectFromSelect(page, scope, "Language", language);
}

/**
 * Set the Sandbox Select in a code-evaluator dialog and assert the new value.
 */
async function selectSandbox(page: Page, scope: Locator, sandboxName: string) {
  await selectFromSelect(page, scope, "Sandbox", sandboxName);
}

/**
 * The Sandbox trigger displays its placeholder when nothing is selected. The
 * placeholder copy depends on whether any compatible sandboxes exist for the
 * current language.
 */
async function expectSandboxCleared(scope: Locator) {
  await expect(selectTrigger(scope, "Sandbox")).toHaveText(
    /Select a sandbox\.\.\.|None available/
  );
}

async function openEvaluatorEditor(page: Page, evaluatorName: string) {
  const evaluatorRow = page.getByRole("row").filter({
    has: page.getByRole("cell", { name: evaluatorName, exact: true }),
  });

  // Last button in the row is the actions menu trigger ("..."). Links (the
  // Name cell) are <a>, not buttons, so they don't get picked up here.
  await evaluatorRow.getByRole("button").last().click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await expect(
    page.getByRole("heading", { name: "Edit Code Evaluator" })
  ).toBeVisible();
}

async function createCustomCodeEvaluator({
  page,
  evaluatorName,
  language,
  sandboxName,
  description,
}: {
  page: Page;
  evaluatorName: string;
  language: "Python" | "TypeScript";
  sandboxName?: string;
  description?: string;
}) {
  await page.getByRole("button", { name: "Add evaluator" }).click();
  await page
    .getByRole("menuitem", { name: "Create new code evaluator" })
    .click();

  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Create Code Evaluator" })
  ).toBeVisible();

  await dialog
    .getByRole("textbox", { name: "Name", exact: true })
    .fill(evaluatorName);

  if (description) {
    await dialog
      .getByRole("textbox", { name: /Description/i })
      .fill(description);
  }

  if (language === "TypeScript") {
    await selectLanguage(page, dialog, "TypeScript");
  }

  if (sandboxName) {
    await selectSandbox(page, dialog, sandboxName);
  }

  await dialog.getByRole("button", { name: "Create" }).click();
  await expect(page.getByTestId("dialog")).not.toBeVisible();
}

async function expectEvaluatorDetailsPage(page: Page, evaluatorName: string) {
  await page.getByRole("link", { name: evaluatorName, exact: true }).click();
  await page.waitForURL("**/evaluators/**");
  // The detail page renders the heading as `Evaluator: <name>`; use substring
  // match (the default for getByRole when `exact` is omitted) so the assertion
  // is robust to that prefix.
  await expect(
    page.getByRole("heading", { name: evaluatorName })
  ).toBeVisible();
}

async function createE2BSandboxWithLiteralEnvVar(
  page: Page,
  configName: string,
  envVarName: string,
  envVarValue: string
) {
  await page.goto("/settings/sandboxes");
  await page.waitForURL("**/settings/sandboxes");

  await page.getByRole("button", { name: "New Sandbox" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  await selectFromCombobox(page, dialog, "Provider", "E2B");

  await expect(
    dialog.getByText("Environment Variables", { exact: true })
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Add Variable" }).click();
  await dialog.getByLabel("Name").last().fill(envVarName);
  await dialog.getByLabel("Value").last().fill(envVarValue);

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
  await expect(
    page.getByRole("cell", { name: configName }).first()
  ).toBeVisible();
}

async function createSecretKey(page: Page, key: string, value: string) {
  await page.goto("/settings/secrets");
  await page.waitForURL("**/settings/secrets");
  await page.getByRole("button", { name: "New Secret" }).click();
  const dialog = page.getByTestId("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox", { name: "Key" }).fill(key);
  await dialog.getByLabel("Value").fill(value);
  await Promise.all([
    page.waitForResponse(
      (resp) =>
        resp.url().includes("/graphql") &&
        resp.status() === 200 &&
        (resp.request().postData()?.includes("SecretsMutationMutation") ??
          false)
    ),
    dialog.getByRole("button", { name: "Create Secret" }).click(),
  ]);
  await expect(dialog).not.toBeVisible();
}

/**
 * Read the current text content of the editable CodeMirror editor inside the
 * dialog. The editor is the first `.cm-content` in the dialog (the second is
 * the read-only type footer).
 */
async function getEditorContent(scope: Locator): Promise<string> {
  return (await scope.locator(".cm-content").first().textContent()) ?? "";
}

test.describe.serial("Code Evaluators", () => {
  const datasetName = `code-evals-${randomUUID().slice(0, 8)}`;
  const pythonSandboxName = `python-sandbox-${randomUUID().slice(0, 8)}`;
  const typeScriptSandboxName = `ts-sandbox-${randomUUID().slice(0, 8)}`;
  const pythonEvaluatorName = `python-code-eval-${randomUUID().slice(0, 8)}`;
  const updatedPythonEvaluatorName = `updated-python-code-eval-${randomUUID().slice(0, 8)}`;
  const typeScriptEvaluatorName = `typescript-code-eval-${randomUUID().slice(0, 8)}`;

  // The Create/Edit code-evaluator slideovers fire a browser-level
  // window.confirm when closing a dirty form. Auto-accept it so Cancel can
  // close the slideover during tests that intentionally make edits and then
  // discard them.
  test.beforeEach(async ({ page }) => {
    page.on("dialog", (dialog) => {
      void dialog.accept();
    });
  });

  test("can create prerequisites for code evaluator flows", async ({
    page,
  }) => {
    await ensureSandboxConfig(page, "Python", pythonSandboxName);
    await ensureSandboxConfig(page, "TypeScript", typeScriptSandboxName);
    await createDatasetWithExample(page, datasetName);
    await gotoDatasetEvaluators(page, datasetName);

    await expect(
      page.getByRole("tab", { name: /Evaluators/i })
    ).toHaveAttribute("aria-selected", "true");
  });

  test("can create and render a Python code evaluator", async ({ page }) => {
    await gotoDatasetEvaluators(page, datasetName);

    await createCustomCodeEvaluator({
      page,
      evaluatorName: pythonEvaluatorName,
      language: "Python",
      sandboxName: pythonSandboxName,
    });

    await expect(
      page.getByRole("cell", { name: pythonEvaluatorName, exact: true })
    ).toBeVisible();

    await expectEvaluatorDetailsPage(page, pythonEvaluatorName);
  });

  test("can create and render a TypeScript code evaluator", async ({
    page,
  }) => {
    await gotoDatasetEvaluators(page, datasetName);

    await createCustomCodeEvaluator({
      page,
      evaluatorName: typeScriptEvaluatorName,
      language: "TypeScript",
      sandboxName: typeScriptSandboxName,
    });

    await expect(
      page.getByRole("cell", { name: typeScriptEvaluatorName, exact: true })
    ).toBeVisible();

    await expectEvaluatorDetailsPage(page, typeScriptEvaluatorName);
  });

  test("can edit a custom Python code evaluator", async ({ page }) => {
    await gotoDatasetEvaluators(page, datasetName);
    await openEvaluatorEditor(page, pythonEvaluatorName);

    const dialog = page.getByRole("dialog");
    const nameInput = dialog.getByRole("textbox", {
      name: "Name",
      exact: true,
    });
    await expect(nameInput).toHaveValue(pythonEvaluatorName);

    await nameInput.fill(updatedPythonEvaluatorName);
    await dialog.getByRole("button", { name: "Update" }).click();

    await expect(page.getByTestId("dialog")).not.toBeVisible();
    await expect(
      page.getByRole("cell", { name: updatedPythonEvaluatorName, exact: true })
    ).toBeVisible();

    await openEvaluatorEditor(page, updatedPythonEvaluatorName);
    await expect(
      page
        .getByRole("dialog")
        .getByRole("textbox", { name: "Name", exact: true })
    ).toHaveValue(updatedPythonEvaluatorName);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cancel" })
      .click();
    await expect(page.getByTestId("dialog")).not.toBeVisible();

    await expectEvaluatorDetailsPage(page, updatedPythonEvaluatorName);
  });

  test("submits a cleared sandbox when switching back to the original language", async ({
    page,
  }) => {
    await gotoDatasetEvaluators(page, datasetName);
    await openEvaluatorEditor(page, updatedPythonEvaluatorName);

    const dialog = page.getByRole("dialog");

    await expect(selectTrigger(dialog, "Sandbox")).toContainText(
      pythonSandboxName
    );

    await selectLanguage(page, dialog, "TypeScript");
    await selectSandbox(page, dialog, typeScriptSandboxName);
    await selectLanguage(page, dialog, "Python");

    // Switching to TS picked a TS sandbox, then switching back to Python
    // should clear the now-incompatible selection.
    await expectSandboxCleared(dialog);

    const updateCodeEvaluatorResponse = page.waitForResponse((response) =>
      isGraphQLMutationResponse(
        response,
        "EditCodeDatasetEvaluatorSlideover_updateCodeEvaluatorMutation"
      )
    );

    await dialog.getByRole("button", { name: "Update" }).click();

    const response = await updateCodeEvaluatorResponse;
    const requestBody = response.request().postDataJSON() as {
      variables: {
        input: {
          sandboxConfigId?: string | null;
        };
      };
    };

    expect(requestBody.variables.input.sandboxConfigId).toBeNull();

    await expect(page.getByTestId("dialog")).not.toBeVisible();

    await expect(
      page.getByRole("cell", { name: updatedPythonEvaluatorName, exact: true })
    ).toBeVisible();

    await openEvaluatorEditor(page, updatedPythonEvaluatorName);
    await expectSandboxCleared(page.getByRole("dialog"));
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cancel" })
      .click();
    await expect(page.getByTestId("dialog")).not.toBeVisible();
  });

  // Store names for additional test cases
  const evaluatorWithDescriptionName = `eval-with-desc-${randomUUID().slice(0, 8)}`;
  const evaluatorWithDescriptionDesc = "This evaluator checks output quality";
  const updatedDescription = "Updated description for testing";

  test("can create code evaluator with description and verify it persists", async ({
    page,
  }) => {
    await gotoDatasetEvaluators(page, datasetName);

    await createCustomCodeEvaluator({
      page,
      evaluatorName: evaluatorWithDescriptionName,
      language: "Python",
      sandboxName: pythonSandboxName,
      description: evaluatorWithDescriptionDesc,
    });

    await expect(
      page.getByRole("cell", {
        name: evaluatorWithDescriptionName,
        exact: true,
      })
    ).toBeVisible();

    // Reopen editor and verify description persisted
    await openEvaluatorEditor(page, evaluatorWithDescriptionName);
    const dialog = page.getByRole("dialog");
    const descriptionInput = dialog.getByRole("textbox", {
      name: /Description/i,
    });
    await expect(descriptionInput).toHaveValue(evaluatorWithDescriptionDesc);

    // Update the description
    await descriptionInput.fill(updatedDescription);
    await dialog.getByRole("button", { name: "Update" }).click();
    await expect(page.getByTestId("dialog")).not.toBeVisible();

    // Verify updated description persisted
    await openEvaluatorEditor(page, evaluatorWithDescriptionName);
    await expect(
      page.getByRole("dialog").getByRole("textbox", { name: /Description/i })
    ).toHaveValue(updatedDescription);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cancel" })
      .click();
    await expect(page.getByTestId("dialog")).not.toBeVisible();
  });

  test("cannot create code evaluator without selecting a sandbox", async ({
    page,
  }) => {
    await gotoDatasetEvaluators(page, datasetName);

    await page.getByRole("button", { name: "Add evaluator" }).click();
    await page
      .getByRole("menuitem", { name: "Create new code evaluator" })
      .click();

    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Create Code Evaluator" })
    ).toBeVisible();

    await dialog
      .getByRole("textbox", { name: "Name", exact: true })
      .fill("test-no-sandbox-eval");

    // Sandbox is intentionally left empty.
    await expectSandboxCleared(dialog);

    await dialog.getByRole("button", { name: "Create" }).click();

    await expect(
      dialog.getByText("Please select a sandbox configuration.")
    ).toBeVisible();

    // Dialog should still be open (not created)
    await expect(dialog).toBeVisible();

    // Verify the error alert header is also shown
    await expect(
      dialog.getByRole("heading", {
        name: "Invalid code evaluator configuration",
      })
    ).toBeVisible();
  });

  test("can open test evaluator section and verify UI elements", async ({
    page,
  }) => {
    await gotoDatasetEvaluators(page, datasetName);
    await openEvaluatorEditor(page, evaluatorWithDescriptionName);

    const dialog = page.getByRole("dialog");

    // Ensure a sandbox is set so the Test button has a runtime to call.
    const sandboxTrigger = selectTrigger(dialog, "Sandbox");
    if ((await sandboxTrigger.textContent())?.includes("Select a sandbox")) {
      await selectSandbox(page, dialog, pythonSandboxName);
    }

    // The Test Evaluator disclosure is expanded by default in the editor
    // (DisclosureGroup defaultExpandedKeys includes test-section), so the
    // contents should be visible without an explicit click.
    const testButton = dialog.getByRole("button", {
      name: "Test",
      exact: true,
    });
    await expect(testButton).toBeVisible();

    // The disclosure trigger lives inside the dialog as a button labeled
    // "Test Evaluator" with aria-expanded=true on first render.
    await expect(
      dialog.getByRole("button", { name: "Test Evaluator" })
    ).toHaveAttribute("aria-expanded", "true");

    // The descriptive copy under the Test button.
    await expect(
      dialog.getByText(
        "Run your evaluator against the example data to verify it works correctly"
      )
    ).toBeVisible();

    // Note: actually running the test requires a working sandbox runtime,
    // which is not available in this test environment.

    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByTestId("dialog")).not.toBeVisible();
  });

  const categoricalEvaluatorName = `categorical-eval-${randomUUID().slice(0, 8)}`;

  test("can configure categorical choices in code evaluator", async ({
    page,
  }) => {
    await gotoDatasetEvaluators(page, datasetName);

    await page.getByRole("button", { name: "Add evaluator" }).click();
    await page
      .getByRole("menuitem", { name: "Create new code evaluator" })
      .click();

    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Create Code Evaluator" })
    ).toBeVisible();

    await dialog
      .getByRole("textbox", { name: "Name", exact: true })
      .fill(categoricalEvaluatorName);

    await selectSandbox(page, dialog, pythonSandboxName);

    // The output type select switches the editor between numeric (continuous)
    // and label-based (categorical) shapes. The Evaluator Annotation section
    // is rendered inline (no disclosure), so its controls are always present.
    await selectFromSelect(page, dialog, "Output type", "Categorical label");

    // Choices section appears with default two choices.
    await expect(dialog.getByText("Choices", { exact: true })).toBeVisible();

    const choiceInputs = dialog.locator('input[placeholder^="Choice"]');
    await expect(choiceInputs).toHaveCount(2);
    await choiceInputs.first().fill("Good");
    await choiceInputs.nth(1).fill("Bad");

    // Add a third choice.
    await dialog.getByRole("button", { name: "Add choice" }).click();
    await expect(choiceInputs).toHaveCount(3);
    await choiceInputs.nth(2).fill("Neutral");

    // Remove buttons exist for every choice; the last one removes "Neutral".
    const removeButtons = dialog.getByRole("button", { name: "Remove choice" });
    await expect(removeButtons).toHaveCount(3);
    await removeButtons.last().click();
    await expect(choiceInputs).toHaveCount(2);

    // Remove is disabled when only the minimum two choices remain.
    await expect(removeButtons.first()).toBeDisabled();
    await expect(removeButtons.last()).toBeDisabled();

    await dialog.getByRole("button", { name: "Create" }).click();
    await expect(page.getByTestId("dialog")).not.toBeVisible();

    await expect(
      page.getByRole("cell", { name: categoricalEvaluatorName, exact: true })
    ).toBeVisible();

    // Reopen and verify categorical config persisted.
    await openEvaluatorEditor(page, categoricalEvaluatorName);
    const reopenedDialog = page.getByRole("dialog");
    await expect(
      reopenedDialog.getByText("Choices", { exact: true })
    ).toBeVisible();
    const reopenedChoices = reopenedDialog.locator(
      'input[placeholder^="Choice"]'
    );
    await expect(reopenedChoices.first()).toHaveValue("Good");
    await expect(reopenedChoices.last()).toHaveValue("Bad");

    await reopenedDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByTestId("dialog")).not.toBeVisible();
  });

  // Phase 4: Config-aware placeholder assertions

  const placeholderCategoricalName = `placeholder-cat-${randomUUID().slice(0, 8)}`;
  const placeholderContinuousName = `placeholder-cont-${randomUUID().slice(0, 8)}`;

  test("categorical placeholder shows substituted label from config", async ({
    page,
  }) => {
    await gotoDatasetEvaluators(page, datasetName);

    await page.getByRole("button", { name: "Add evaluator" }).click();
    await page
      .getByRole("menuitem", { name: "Create new code evaluator" })
      .click();

    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Create Code Evaluator" })
    ).toBeVisible();

    await dialog
      .getByRole("textbox", { name: "Name", exact: true })
      .fill(placeholderCategoricalName);

    await selectSandbox(page, dialog, pythonSandboxName);

    // Switch to categorical, then customize choice labels and Reset to
    // regenerate the placeholder against the new config (Reset is the
    // user-facing knob for re-applying config to the editor body).
    await selectFromSelect(page, dialog, "Output type", "Categorical label");

    const choiceInputs = dialog.locator('input[placeholder^="Choice"]');
    await choiceInputs.first().fill("excellent");
    await choiceInputs.nth(1).fill("poor");

    await dialog.getByRole("button", { name: "Reset" }).click();

    await expect.poll(() => getEditorContent(dialog)).toContain('"excellent"');
    const content = await getEditorContent(dialog);
    expect(content).not.toMatch(/return "pass"/);
    // Dict-form comment with explanation key must be present.
    expect(content).toContain("explanation");

    await dialog.getByRole("button", { name: "Create" }).click();
    await expect(page.getByTestId("dialog")).not.toBeVisible();
    await expect(
      page.getByRole("cell", { name: placeholderCategoricalName, exact: true })
    ).toBeVisible();
  });

  test("continuous placeholder shows midpoint and bounds-range comment", async ({
    page,
  }) => {
    await gotoDatasetEvaluators(page, datasetName);

    await page.getByRole("button", { name: "Add evaluator" }).click();
    await page
      .getByRole("menuitem", { name: "Create new code evaluator" })
      .click();

    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Create Code Evaluator" })
    ).toBeVisible();

    await dialog
      .getByRole("textbox", { name: "Name", exact: true })
      .fill(placeholderContinuousName);

    await selectSandbox(page, dialog, pythonSandboxName);

    // Set explicit bounds and Reset so the placeholder regenerates with the
    // new midpoint/range.
    await dialog.getByLabel("Lower bound").fill("0");
    await dialog.getByLabel("Upper bound").fill("10");

    await dialog.getByRole("button", { name: "Reset" }).click();

    await expect.poll(() => getEditorContent(dialog)).toContain("5.0");
    const content = await getEditorContent(dialog);
    // Bounds range comment.
    expect(content).toContain("0.0 - 10.0");
    // Dict-form comment with explanation key.
    expect(content).toContain("explanation");

    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByTestId("dialog")).not.toBeVisible();
  });

  test("categorical with empty values regenerates the placeholder around the (blank) first label", async ({
    page,
  }) => {
    // Open the existing categorical evaluator which has "Good"/"Bad" labels.
    await gotoDatasetEvaluators(page, datasetName);
    await openEvaluatorEditor(page, categoricalEvaluatorName);

    const dialog = page.getByRole("dialog");

    // Clear all choice labels.
    const choiceInputs = dialog.locator('input[placeholder^="Choice"]');
    await choiceInputs.first().fill("");
    await choiceInputs.last().fill("");

    // Reset substitutes the first label into the placeholder. With both
    // labels cleared, the substituted return value is an empty string and
    // the previous label ("Good") should no longer appear.
    await dialog.getByRole("button", { name: "Reset" }).click();

    await expect.poll(() => getEditorContent(dialog)).toContain('return ""');
    const content = await getEditorContent(dialog);
    expect(content).not.toContain('"Good"');
    expect(content).toContain("explanation");

    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByTestId("dialog")).not.toBeVisible();
  });

  test("Reset on complete categorical config produces substituted placeholder", async ({
    page,
  }) => {
    await gotoDatasetEvaluators(page, datasetName);
    await openEvaluatorEditor(page, categoricalEvaluatorName);

    const dialog = page.getByRole("dialog");

    // Overwrite the editor with custom code.
    const editor = dialog.locator(".cm-content").first();
    await editor.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.insertText("# custom user code");

    // Reset should restore the substituted placeholder for "Good"/"Bad".
    await dialog.getByRole("button", { name: "Reset" }).click();

    await expect.poll(() => getEditorContent(dialog)).toContain('"Good"');
    const content = await getEditorContent(dialog);
    expect(content).not.toMatch(/return "pass"/);
    expect(content).toContain("explanation");

    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByTestId("dialog")).not.toBeVisible();
  });

  test("language switch on categorical evaluator swaps the editor between Python and TypeScript defaults", async ({
    page,
  }) => {
    await gotoDatasetEvaluators(page, datasetName);
    await openEvaluatorEditor(page, categoricalEvaluatorName);

    const dialog = page.getByRole("dialog");

    // Pin the editor source to a known generated default by Resetting against
    // the current categorical config (saved labels are "Good"/"Bad"), so the
    // language guard will recognize it as a default and auto-swap it.
    await dialog.getByRole("button", { name: "Reset" }).click();
    await expect.poll(() => getEditorContent(dialog)).toContain('"Good"');
    await expect.poll(() => getEditorContent(dialog)).toMatch(/def evaluate/);

    // Switch to TypeScript — guard regenerates the TS variant of the same
    // categorical default.
    await selectLanguage(page, dialog, "TypeScript");
    await expect
      .poll(() => getEditorContent(dialog))
      .toMatch(/function evaluate/);
    let content = await getEditorContent(dialog);
    expect(content).toContain('"Good"');
    expect(content).toContain("explanation");

    // Switch back to Python — guard regenerates the Python variant.
    await selectLanguage(page, dialog, "Python");
    await expect.poll(() => getEditorContent(dialog)).toMatch(/def evaluate/);
    content = await getEditorContent(dialog);
    expect(content).toContain('"Good"');

    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByTestId("dialog")).not.toBeVisible();
  });

  test("shape change from continuous to categorical auto-swaps placeholder", async ({
    page,
  }) => {
    await gotoDatasetEvaluators(page, datasetName);

    // Open a fresh create dialog. Initial source is the substituted
    // continuous template (with the bounds-range comment), which the
    // shape-change guard cannot recognize as a default once the new config
    // is categorical (no bounds → continuous falls back to static).
    await page.getByRole("button", { name: "Add evaluator" }).click();
    await page
      .getByRole("menuitem", { name: "Create new code evaluator" })
      .click();

    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Create Code Evaluator" })
    ).toBeVisible();

    // Pin the editor to the static continuous fallback by clearing the
    // bounds and Resetting — `getDefaultCodeEvaluatorSource` falls back to
    // the static template when bounds are null. The static template is the
    // one form the shape-change guard *can* recognize across configs.
    await dialog.getByLabel("Lower bound").fill("");
    await dialog.getByLabel("Upper bound").fill("");
    await dialog.getByRole("button", { name: "Reset" }).click();
    await expect.poll(() => getEditorContent(dialog)).toContain("return 0.5");
    await expect
      .poll(() => getEditorContent(dialog))
      .not.toMatch(/expected range/);

    // Now switch output type to categorical — the shape-change guard
    // regenerates the placeholder against the new categorical config
    // (default values "pass" / "fail"), so the editor body now reads
    // `return "pass"`.
    await selectFromSelect(page, dialog, "Output type", "Categorical label");

    await expect.poll(() => getEditorContent(dialog)).toContain('"pass"');
    const content = await getEditorContent(dialog);
    expect(content).toContain("explanation");

    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByTestId("dialog")).not.toBeVisible();
  });

  // D6: Tab in the Python editor inserts four spaces, not a tab character.
  test("Tab in Python code editor inserts four spaces", async ({ page }) => {
    await gotoDatasetEvaluators(page, datasetName);

    await page.getByRole("button", { name: "Add evaluator" }).click();
    await page
      .getByRole("menuitem", { name: "Create new code evaluator" })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Create Code Evaluator" })
    ).toBeVisible();
    await selectSandbox(page, dialog, pythonSandboxName);

    const editor = dialog.locator(".cm-content").first();
    await editor.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Tab");

    const lineText = await dialog
      .locator(".cm-content .cm-line")
      .first()
      .textContent();
    expect(lineText).toBe("    ");
    expect(lineText).not.toContain("\t");

    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByTestId("dialog")).not.toBeVisible();
  });

  // D4: literal env_var values are redacted from the evaluator details page.
  // The only Python backend that's available in the bare test environment is
  // WASM, which does not advertise `supports_env_vars`. E2B/Daytona/Modal/
  // Vercel all advertise env vars but require provider credentials before
  // their configs surface in the evaluator's Sandbox picker (see
  // `mapSandboxConfigOptions`'s AVAILABLE-backend filter). Without those
  // credentials this scenario cannot exercise the redaction path end-to-end,
  // so skip until the test harness can stand up an env-var-capable backend.
  test.skip("redacts literal env_var values on evaluator details page", async ({
    page,
  }) => {
    const sandboxName = `dogfood-redact-sandbox-${randomUUID().slice(0, 8)}`;
    const evaluatorName = `dogfood-redact-eval-${randomUUID().slice(0, 8)}`;
    const literalEnvVarName = "DOGFOOD_LITERAL_KEY";
    const literalEnvVarValue = `super-secret-${randomUUID()}`;

    await createE2BSandboxWithLiteralEnvVar(
      page,
      sandboxName,
      literalEnvVarName,
      literalEnvVarValue
    );

    await gotoDatasetEvaluators(page, datasetName);
    await createCustomCodeEvaluator({
      page,
      evaluatorName,
      language: "Python",
      sandboxName,
    });

    await expectEvaluatorDetailsPage(page, evaluatorName);

    const body = page.locator("body");
    await expect(body).toContainText(literalEnvVarName);
    await expect(body).toContainText("<redacted>");
    await expect(body).not.toContainText(literalEnvVarValue);
  });
});

// D5: env-var Name auto-populate behavior in the SandboxConfigDialog.
// Independent from the eval/dataset fixtures above.
test.describe
  .serial("Code Evaluators — sandbox env-var Name auto-populate", () => {
  const suffix = randomUUID().slice(0, 8).toUpperCase();
  const secretKeyA = `DOGFOOD_AUTOPOP_A_${suffix}`;
  const secretKeyB = `DOGFOOD_AUTOPOP_B_${suffix}`;

  test("auto-populates Name on first selection and follows the previously selected key", async ({
    page,
  }) => {
    await createSecretKey(page, secretKeyA, `value-a-${suffix}`);
    await createSecretKey(page, secretKeyB, `value-b-${suffix}`);

    await page.goto("/settings/sandboxes");
    await page.waitForURL("**/settings/sandboxes");

    await page.getByRole("button", { name: "New Sandbox" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await selectFromCombobox(page, dialog, "Provider", "E2B");

    await expect(
      dialog.getByText("Environment Variables", { exact: true })
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Add Variable" }).click();

    // Switch the env-var row to the Secret-ref kind.
    await selectFromSelect(page, dialog, "Kind", "Secret");

    // The env-var Name input is the last "Name" input in the dialog;
    // the first one is the sandbox config name.
    const envVarNameInput = dialog.getByLabel("Name").last();
    await expect(envVarNameInput).toHaveValue("");

    // Blank Name → selecting a secret auto-populates Name with the key.
    await selectFromCombobox(page, dialog, "Secret", secretKeyA);
    await expect(envVarNameInput).toHaveValue(secretKeyA);

    // Name still equals the previously selected key → switching secrets
    // follows the new key.
    await selectFromCombobox(page, dialog, "Secret", secretKeyB);
    await expect(envVarNameInput).toHaveValue(secretKeyB);

    // User-edited Name is preserved on subsequent secret changes.
    await envVarNameInput.fill("CUSTOM_NAME");
    await selectFromCombobox(page, dialog, "Secret", secretKeyA);
    await expect(envVarNameInput).toHaveValue("CUSTOM_NAME");

    await dialog.getByRole("button", { name: /cancel/i }).click();
    await expect(dialog).not.toBeVisible();
  });
});
