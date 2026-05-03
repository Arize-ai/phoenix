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
  await page.getByLabel("Description").fill("Dataset for dogfooding fixes");

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

  await dialog.getByLabel("Provider").fill("E2B");
  await page.getByRole("option", { name: /E2B/i }).first().click();

  await expect(dialog.getByText("Environment Variables")).toBeVisible();
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
  await expect(page.getByRole("cell", { name: configName })).toBeVisible();
}

test.describe.serial("Dogfooding fixes — secret redaction (D4)", () => {
  const datasetName = `dogfood-redact-${randomUUID().slice(0, 8)}`;
  const sandboxName = `dogfood-sandbox-${randomUUID().slice(0, 8)}`;
  const evaluatorName = `dogfood-eval-${randomUUID().slice(0, 8)}`;
  const literalEnvVarName = "DOGFOOD_LITERAL_KEY";
  const literalEnvVarValue = `super-secret-${randomUUID()}`;

  test("redacts literal env_var values from the evaluator details page", async ({
    page,
  }) => {
    // Step 1: Create a sandbox config with a literal env var holding a recognizable secret value.
    await createE2BSandboxWithLiteralEnvVar(
      page,
      sandboxName,
      literalEnvVarName,
      literalEnvVarValue
    );

    // Step 2: Create a dataset and a code evaluator that uses the sandbox.
    await createDatasetWithExample(page, datasetName);
    await gotoDatasetEvaluators(page, datasetName);

    await page.getByRole("button", { name: "Add evaluator" }).click();
    await page
      .getByRole("menuitem", { name: "Create new code evaluator" })
      .click();

    const dialog = page.getByRole("dialog");
    await expect(
      page.getByRole("heading", { name: "Create Evaluator" })
    ).toBeVisible();

    await dialog
      .getByRole("textbox", { name: "Name", exact: true })
      .fill(evaluatorName);
    await selectComboboxOption(page, "Sandbox", sandboxName, dialog);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByTestId("dialog")).not.toBeVisible();

    // Step 3: Open the evaluator details page.
    await page.getByRole("link", { name: evaluatorName, exact: true }).click();
    await page.waitForURL("**/evaluators/**");
    await expect(
      page.getByRole("heading", { name: evaluatorName })
    ).toBeVisible();

    // Step 4: Assert the literal value is masked, the env var name is shown,
    // and the redaction marker is present.
    const body = page.locator("body");
    await expect(body).toContainText(literalEnvVarName);
    await expect(body).toContainText("<redacted>");
    await expect(body).not.toContainText(literalEnvVarValue);
  });
});
