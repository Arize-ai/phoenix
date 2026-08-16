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
    name: new RegExp(`\\b${escapeRegex(label)}(?:\\s*\\*)?\\s*$`),
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
    .getByTestId("dialog")
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
  const dialog = page.getByTestId("dialog");
  await expect(
    dialog.getByRole("heading", { name: "New Sandbox Config" })
  ).toBeVisible();

  await selectFromSelect(page, dialog, "Sandbox Provider", providerName);
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

  await expect(page.getByTestId("dialog")).not.toBeVisible();
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

  const dialog = page.getByTestId("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Create Code Evaluator" })
  ).toBeVisible();

  await dialog
    .getByRole("textbox", { name: /^Name(\s*\*)?$/, disabled: false })
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
  const dialog = page.getByTestId("dialog");
  await expect(dialog).toBeVisible();

  await selectFromSelect(page, dialog, "Sandbox Provider", "E2B");

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

  await expect(page.getByTestId("dialog")).not.toBeVisible();
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

    const dialog = page.getByTestId("dialog");
    const nameInput = dialog.getByRole("textbox", {
      name: /^Name(\s*\*)?$/,
      disabled: false,
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
        .getByTestId("dialog")
        .getByRole("textbox", { name: /^Name(\s*\*)?$/, disabled: false })
    ).toHaveValue(updatedPythonEvaluatorName);
    await page
      .getByTestId("dialog")
      .getByRole("button", { name: "Cancel" })
      .click();
    await expect(page.getByTestId("dialog")).not.toBeVisible();

    await expectEvaluatorDetailsPage(page, updatedPythonEvaluatorName);
  });

  // Language is no longer editable in the Edit slideover (gated to create mode
  // since the revision-history feature). The original scenario — switch
  // language to force a sandbox clear and assert patchCodeEvaluator submits
  // sandboxConfigId: null — can no longer be exercised via edit, so skip
  // until the boundary is exposed through a different UI entry point.
  test.skip("submits a cleared sandbox when switching back to the original language", async ({
    page,
  }) => {
    await gotoDatasetEvaluators(page, datasetName);
    await openEvaluatorEditor(page, updatedPythonEvaluatorName);

    const dialog = page.getByTestId("dialog");

    await expect(selectTrigger(dialog, "Sandbox")).toContainText(
      pythonSandboxName
    );

    await selectLanguage(page, dialog, "TypeScript");
    await selectSandbox(page, dialog, typeScriptSandboxName);
    await selectLanguage(page, dialog, "Python");

    // Switching to TS picked a TS sandbox, then switching back to Python
    // should clear the now-incompatible selection.
    await expectSandboxCleared(dialog);

    const patchCodeEvaluatorResponse = page.waitForResponse((response) =>
      isGraphQLMutationResponse(
        response,
        "EditCodeDatasetEvaluatorSlideover_patchCodeEvaluatorMutation"
      )
    );
    const createCodeEvaluatorVersionResponse = page.waitForResponse(
      (response) =>
        isGraphQLMutationResponse(
          response,
          "EditCodeDatasetEvaluatorSlideover_createCodeEvaluatorVersionMutation"
        )
    );

    await dialog.getByRole("button", { name: "Update" }).click();

    const patchResponse = await patchCodeEvaluatorResponse;
    const patchRequestBody = patchResponse.request().postDataJSON() as {
      variables: {
        input: {
          sandboxConfigId?: string | null;
        };
      };
    };
    expect(patchRequestBody.variables.input.sandboxConfigId).toBeNull();

    const createVersionResponse = await createCodeEvaluatorVersionResponse;
    const createVersionRequestBody = createVersionResponse
      .request()
      .postDataJSON() as {
      variables: {
        input: Record<string, unknown>;
      };
    };
    // Sandbox rebinding lives exclusively on patchCodeEvaluator; the version
    // input no longer accepts a sandbox identifier. Lock that boundary in.
    expect(createVersionRequestBody.variables.input).not.toHaveProperty(
      "sandboxConfigId"
    );

    await expect(page.getByTestId("dialog")).not.toBeVisible();

    await expect(
      page.getByRole("cell", { name: updatedPythonEvaluatorName, exact: true })
    ).toBeVisible();

    await openEvaluatorEditor(page, updatedPythonEvaluatorName);
    await expectSandboxCleared(page.getByTestId("dialog"));
    await page
      .getByTestId("dialog")
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
    const dialog = page.getByTestId("dialog");
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
      page.getByTestId("dialog").getByRole("textbox", { name: /Description/i })
    ).toHaveValue(updatedDescription);
    await page
      .getByTestId("dialog")
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

    const dialog = page.getByTestId("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Create Code Evaluator" })
    ).toBeVisible();

    await dialog
      .getByRole("textbox", { name: /^Name(\s*\*)?$/, disabled: false })
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

    const dialog = page.getByTestId("dialog");

    // Ensure a sandbox is set so the Test button has a runtime to call.
    const sandboxTrigger = selectTrigger(dialog, "Sandbox");
    if ((await sandboxTrigger.textContent())?.includes("Select a sandbox")) {
      await selectSandbox(page, dialog, pythonSandboxName);
    }

    // The "Test Evaluator" region is always rendered in the sidebar (no
    // disclosure to expand), labeled by a section heading, so its contents
    // are visible without any interaction.
    await expect(
      dialog.getByRole("heading", { name: "Test Evaluator" })
    ).toBeVisible();

    const testButton = dialog.getByRole("button", {
      name: "Test",
      exact: true,
    });
    await expect(testButton).toBeVisible();

    // The descriptive copy next to the Test button.
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

  // Config-aware placeholder assertions for the categorical default were
  // removed when the code-evaluator authoring form collapsed to optimization
  // direction + optional threshold (descriptive, not prescriptive). New
  // evaluators now default to the freeform/continuous source template, and
  // the legacy "Output type" select that let users author a Categorical
  // config from the form is gone. Restore placeholder coverage if the
  // categorical authoring path is reintroduced.

  // Tab in the Python editor inserts four spaces, not a tab character.
  test("Tab in Python code editor inserts four spaces", async ({ page }) => {
    await gotoDatasetEvaluators(page, datasetName);

    await page.getByRole("button", { name: "Add evaluator" }).click();
    await page
      .getByRole("menuitem", { name: "Create new code evaluator" })
      .click();
    const dialog = page.getByTestId("dialog");
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

  // Literal env_var values are redacted from the evaluator details page.
  // The only Python backend available in the bare test environment is WASM,
  // which does not advertise `supports_env_vars`. E2B/Daytona/Modal/Vercel
  // all advertise env vars but require provider credentials before their
  // configs surface in the evaluator's Sandbox picker (see
  // `mapSandboxConfigOptions`'s AVAILABLE-backend filter). This scenario
  // requires an env-var-capable backend with credentials to exercise the
  // redaction path end-to-end.
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

// env-var Name auto-populate behavior in the SandboxConfigDialog.
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
    const dialog = page.getByTestId("dialog");
    await expect(dialog).toBeVisible();

    await selectFromSelect(page, dialog, "Sandbox Provider", "E2B");

    await expect(
      dialog.getByText("Environment Variables", { exact: true })
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Add Variable" }).click();

    const envVarNameInput = dialog.getByLabel("Variable Name");
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
