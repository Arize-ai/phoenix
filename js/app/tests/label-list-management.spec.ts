import { randomUUID } from "crypto";
import { expect, test, type Page, type Response } from "@playwright/test";

function isGraphQLMutationResponse(response: Response, operationName: string) {
  if (!response.url().includes("/graphql") || response.status() !== 200) {
    return false;
  }
  const postData = response.request().postData();
  return postData?.includes(operationName) ?? false;
}

/**
 * Create a prompt label via the settings table. Returns once the create
 * mutation has resolved and the dialog has closed.
 */
async function createPromptLabel(page: Page, labelName: string) {
  await page.goto("/settings/prompts");
  await page.waitForURL("**/settings/prompts");
  await page.getByRole("button", { name: "New Label" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Label Name").fill(labelName);
  await Promise.all([
    page.waitForResponse((resp) =>
      isGraphQLMutationResponse(
        resp,
        "usePromptLabelMutationsCreateLabelMutation"
      )
    ),
    page.getByRole("button", { name: "Create Label" }).click(),
  ]);
  await expect(page.getByRole("dialog")).not.toBeVisible();
}

/**
 * Create a dataset label via the settings table.
 */
async function createDatasetLabel(page: Page, labelName: string) {
  await page.goto("/settings/datasets");
  await page.waitForURL("**/settings/datasets");
  await page.getByRole("button", { name: "New Label" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Label Name").fill(labelName);
  await Promise.all([
    page.waitForResponse((resp) =>
      isGraphQLMutationResponse(
        resp,
        "useDatasetLabelMutationsAddLabelMutation"
      )
    ),
    page.getByRole("button", { name: "Create Label" }).click(),
  ]);
  await expect(page.getByRole("dialog")).not.toBeVisible();
}

/**
 * Create a prompt by saving the default playground configuration.
 */
async function createPrompt(page: Page, promptName: string) {
  await page.goto("/playground");
  await page.waitForURL("**/playground");
  await page.getByRole("button", { name: "Save Prompt" }).click();
  await page.getByPlaceholder("Select or enter new prompt").click();
  await page.getByPlaceholder("Select or enter new prompt").fill(promptName);
  await page.getByLabel("Description (optional)").fill("label e2e coverage");
  await page.getByRole("button", { name: "Create Prompt" }).click();
  await expect(page).toHaveURL(/promptId=/);
}

async function createDataset(page: Page, datasetName: string) {
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
    .fill("label e2e coverage");
  await page.getByRole("button", { name: "Create Dataset" }).click();
  await expect(page.getByTestId("dialog")).not.toBeVisible();
}

function promptRow(page: Page, promptName: string) {
  return page.getByTestId("prompts-table").getByRole("row").filter({
    hasText: promptName,
  });
}

function datasetRow(page: Page, datasetName: string) {
  return page.getByTestId("datasets-table").getByRole("row").filter({
    hasText: datasetName,
  });
}

test.describe("Prompt label management from the list", () => {
  test("can add a label to a prompt and filter by it", async ({ page }) => {
    const id = randomUUID().slice(0, 8);
    const labelName = `prompt-label-${id}`;
    const labeledPrompt = `labeled-prompt-${id}`;
    const otherPrompt = `other-prompt-${id}`;

    await createPromptLabel(page, labelName);
    await createPrompt(page, labeledPrompt);
    await createPrompt(page, otherPrompt);

    await page.goto("/prompts");
    await page.waitForURL("**/prompts");

    const labeledRow = promptRow(page, labeledPrompt);
    await expect(labeledRow).toBeVisible();

    // Add the label from the row action menu's Label submenu.
    await labeledRow.getByRole("button", { name: "Prompt actions" }).click();
    await page.getByRole("menuitem", { name: "Label" }).hover();
    const labelOption = page.getByRole("menuitemcheckbox", { name: labelName });
    await labelOption.waitFor({ state: "visible" });
    await Promise.all([
      page.waitForResponse((resp) =>
        isGraphQLMutationResponse(
          resp,
          "PromptLabelConfigButtonSetLabelsMutation"
        )
      ),
      labelOption.click(),
    ]);
    // The label chip appears in the row live, without a manual refresh.
    await expect(
      labeledRow.getByRole("button", { name: labelName, exact: true })
    ).toBeVisible();

    // Reload the list to reset menu state; the chip persists across navigation.
    await page.goto("/prompts");
    await page.waitForURL("**/prompts");
    await expect(
      promptRow(page, labeledPrompt).getByRole("button", {
        name: labelName,
        exact: true,
      })
    ).toBeVisible();

    // Filter by the label using the dedicated toolbar control.
    await page.getByRole("button", { name: /^Labels/ }).click();
    const filterOption = page.getByRole("menuitemcheckbox", {
      name: labelName,
    });
    await filterOption.waitFor({ state: "visible" });
    await filterOption.click();
    await page.waitForURL(/labelId=/);

    await expect(promptRow(page, labeledPrompt)).toBeVisible();
    await expect(promptRow(page, otherPrompt)).not.toBeVisible();
  });

  test("can create a new label inline and apply it from the list", async ({
    page,
  }) => {
    const id = randomUUID().slice(0, 8);
    const labelName = `inline-label-${id}`;
    const promptName = `inline-prompt-${id}`;

    await createPrompt(page, promptName);

    await page.goto("/prompts");
    await page.waitForURL("**/prompts");

    const row = promptRow(page, promptName);
    await expect(row).toBeVisible();

    // Open the Label submenu and switch into the inline "create" mode.
    await row.getByRole("button", { name: "Prompt actions" }).click();
    await page.getByRole("menuitem", { name: "Label" }).hover();
    await page.getByRole("button", { name: "Create new label" }).click();

    // Fill out the inline create form (no modal) and submit.
    await page.getByLabel("Label Name").fill(labelName);
    await Promise.all([
      page.waitForResponse((resp) =>
        isGraphQLMutationResponse(
          resp,
          "usePromptLabelMutationsCreateLabelMutation"
        )
      ),
      page.getByRole("button", { name: "Create Label" }).click(),
    ]);

    // Back in apply mode, the new label is selectable and applies to the prompt.
    const labelOption = page.getByRole("menuitemcheckbox", { name: labelName });
    await labelOption.waitFor({ state: "visible" });
    await Promise.all([
      page.waitForResponse((resp) =>
        isGraphQLMutationResponse(
          resp,
          "PromptLabelConfigButtonSetLabelsMutation"
        )
      ),
      labelOption.click(),
    ]);

    await expect(
      row.getByRole("button", { name: labelName, exact: true })
    ).toBeVisible();
  });
});

test.describe("Dataset label management from the list", () => {
  test("can add a label to a dataset and filter by it", async ({ page }) => {
    const id = randomUUID().slice(0, 8);
    const labelName = `dataset-label-${id}`;
    const labeledDataset = `labeled-dataset-${id}`;
    const otherDataset = `other-dataset-${id}`;

    await createDatasetLabel(page, labelName);
    await createDataset(page, labeledDataset);
    await createDataset(page, otherDataset);

    await page.goto("/datasets");
    await page.waitForURL("**/datasets");

    const labeledRow = datasetRow(page, labeledDataset);
    await expect(labeledRow).toBeVisible();

    // Add the label from the row action menu's Label submenu.
    await labeledRow.getByRole("button", { name: "Dataset actions" }).click();
    await page.getByRole("menuitem", { name: "Label" }).hover();
    const labelOption = page.getByRole("menuitemcheckbox", { name: labelName });
    await labelOption.waitFor({ state: "visible" });
    await Promise.all([
      page.waitForResponse((resp) =>
        isGraphQLMutationResponse(
          resp,
          "DatasetLabelConfigButtonSetLabelsMutation"
        )
      ),
      labelOption.click(),
    ]);
    // The label chip appears in the row live, without a manual refresh.
    await expect(
      labeledRow.getByRole("button", { name: labelName, exact: true })
    ).toBeVisible();

    // Reload the list to reset menu state; the chip persists across navigation.
    await page.goto("/datasets");
    await page.waitForURL("**/datasets");
    await expect(
      datasetRow(page, labeledDataset).getByRole("button", {
        name: labelName,
        exact: true,
      })
    ).toBeVisible();

    // Filter by the label using the dedicated toolbar control.
    await page.getByRole("button", { name: /^Labels/ }).click();
    const filterOption = page.getByRole("menuitemcheckbox", {
      name: labelName,
    });
    await filterOption.waitFor({ state: "visible" });
    await filterOption.click();
    await page.waitForURL(/labelId=/);

    await expect(datasetRow(page, labeledDataset)).toBeVisible();
    await expect(datasetRow(page, otherDataset)).not.toBeVisible();
  });
});
