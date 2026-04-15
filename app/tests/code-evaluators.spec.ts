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

  await page
    .getByRole("button", { name: "Add Dataset Example" })
    .or(page.getByRole("button", { name: "Example" }))
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();

  const dialog = page.getByRole("dialog");
  const inputEditor = dialog.locator(".cm-content").first();
  await expect(inputEditor).toBeVisible();
  await inputEditor.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(
    '{"output": {"answer": "4"}, "reference": {"answer": "4"}}'
  );

  await page.getByText("Create more", { exact: true }).click();
  await page.getByRole("button", { name: "Add Example" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
}

async function gotoDatasetEvaluators(page: Page, datasetName: string) {
  await page.goto("/datasets");
  await page.waitForURL("**/datasets");
  await page.getByRole("link", { name: datasetName }).click();
  await page.waitForURL("**/datasets/**/examples");
  await page.getByRole("tab", { name: /Evaluators/i }).click();
  await page.waitForURL("**/evaluators");
}

async function ensureSandboxConfig(
  page: Page,
  language: "Python" | "TypeScript",
  configName: string
) {
  await page.goto("/settings/sandboxes");
  await page.waitForURL("**/settings/sandboxes");

  const providerRow = page
    .locator("table")
    .first()
    .locator("tbody tr")
    .filter({ has: page.getByText(`${language} provider`, { exact: true }) })
    .filter({ has: page.getByRole("switch", { name: "Enabled" }) })
    .first();

  await expect(providerRow).toBeVisible();
  await expect(providerRow.getByText("Enabled", { exact: true })).toBeVisible();

  const providerName = (
    await providerRow
      .locator("td")
      .first()
      .locator("span")
      .first()
      .textContent()
  )?.trim();
  expect(providerName).toBeTruthy();

  await page.getByRole("button", { name: "New Sandbox" }).click();
  await expect(
    page.getByRole("heading", { name: "New Sandbox Config" })
  ).toBeVisible();

  await selectComboboxOption(page, "Provider", providerName!);
  await page.getByRole("textbox", { name: "Name" }).fill(configName);

  await Promise.all([
    page.waitForResponse((response) =>
      isGraphQLMutationResponse(
        response,
        "SandboxConfigDialogCreateSandboxConfigMutation"
      )
    ),
    page.getByRole("button", { name: "Create Config" }).click(),
  ]);

  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByText(configName, { exact: true })).toBeVisible();
}

async function selectComboboxOption(
  page: Page,
  label: string,
  optionName: string,
  container?: Locator
) {
  const scope = container ?? page;
  const combobox = scope.getByRole("combobox", { name: label });
  await combobox.click();
  await combobox.fill(optionName);
  await page.getByRole("option", { name: optionName, exact: true }).click();
  await expect(combobox).toHaveValue(optionName);
}

async function selectLanguage(
  page: Page,
  container: Locator,
  language: "Python" | "TypeScript"
) {
  const languageField = container
    .getByText("Language", { exact: true })
    .locator("..");
  await languageField.getByRole("button").click();
  await page.getByRole("option", { name: language, exact: true }).click();
  await expect(languageField.getByRole("button")).toHaveText(language);
}

async function openEvaluatorEditor(page: Page, evaluatorName: string) {
  const evaluatorRow = page.getByRole("row").filter({
    has: page.getByRole("cell", { name: evaluatorName, exact: true }),
  });

  await evaluatorRow.getByRole("button").last().click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await expect(
    page.getByRole("heading", { name: "Edit Evaluator" })
  ).toBeVisible();
}

async function createCustomCodeEvaluator({
  page,
  evaluatorName,
  language,
  sandboxName,
}: {
  page: Page;
  evaluatorName: string;
  language: "Python" | "TypeScript";
  sandboxName: string;
}) {
  await page.getByRole("button", { name: "Add evaluator" }).click();
  await page
    .getByRole("menuitem", { name: "Create new code evaluator" })
    .click();

  const dialog = page.getByRole("dialog");
  await expect(
    page.getByRole("heading", { name: "Create Evaluator" })
  ).toBeVisible();

  await dialog
    .getByRole("textbox", { name: "Evaluator name" })
    .fill(evaluatorName);

  if (language === "TypeScript") {
    await selectLanguage(page, dialog, "TypeScript");
  }

  await selectComboboxOption(page, "Sandbox", sandboxName, dialog);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByTestId("dialog")).not.toBeVisible();
}

async function expectEvaluatorDetailsPage(page: Page, evaluatorName: string) {
  await page.getByRole("link", { name: evaluatorName, exact: true }).click();
  await page.waitForURL("**/evaluators/**");
  await expect(
    page.getByRole("heading", { name: evaluatorName })
  ).toBeVisible();
}

test.describe.serial("Code Evaluators", () => {
  const datasetName = `code-evals-${randomUUID().slice(0, 8)}`;
  const pythonSandboxName = `python-sandbox-${randomUUID().slice(0, 8)}`;
  const typeScriptSandboxName = `ts-sandbox-${randomUUID().slice(0, 8)}`;
  const pythonEvaluatorName = `python-code-eval-${randomUUID().slice(0, 8)}`;
  const updatedPythonEvaluatorName = `updated-python-code-eval-${randomUUID().slice(0, 8)}`;
  const typeScriptEvaluatorName = `typescript-code-eval-${randomUUID().slice(0, 8)}`;

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
      name: "Evaluator name",
    });
    await expect(nameInput).toHaveValue(pythonEvaluatorName);

    await nameInput.fill(updatedPythonEvaluatorName);
    await page.getByRole("button", { name: "Update" }).click();

    await expect(page.getByTestId("dialog")).not.toBeVisible();
    await expect(
      page.getByRole("cell", { name: updatedPythonEvaluatorName, exact: true })
    ).toBeVisible();

    await openEvaluatorEditor(page, updatedPythonEvaluatorName);
    await expect(
      page.getByRole("dialog").getByRole("textbox", { name: "Evaluator name" })
    ).toHaveValue(updatedPythonEvaluatorName);
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByTestId("dialog")).not.toBeVisible();

    await expectEvaluatorDetailsPage(page, updatedPythonEvaluatorName);
  });

  test("submits a cleared sandbox when switching back to the original language", async ({
    page,
  }) => {
    await gotoDatasetEvaluators(page, datasetName);
    await openEvaluatorEditor(page, updatedPythonEvaluatorName);

    const dialog = page.getByRole("dialog");
    const sandboxCombobox = dialog.getByRole("combobox", { name: "Sandbox" });

    await expect(sandboxCombobox).toHaveValue(pythonSandboxName);

    await selectLanguage(page, dialog, "TypeScript");
    await selectComboboxOption(page, "Sandbox", typeScriptSandboxName, dialog);
    await selectLanguage(page, dialog, "Python");

    await expect(sandboxCombobox).toHaveValue("");

    const updateCodeEvaluatorResponse = page.waitForResponse((response) =>
      isGraphQLMutationResponse(
        response,
        "EditCodeDatasetEvaluatorSlideover_updateCodeEvaluatorMutation"
      )
    );

    await page.getByRole("button", { name: "Update" }).click();

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
    await expect(
      page.getByRole("dialog").getByRole("combobox", { name: "Sandbox" })
    ).toHaveValue("");
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByTestId("dialog")).not.toBeVisible();
  });
});
