import { randomUUID } from "crypto";
import { expect, test, type Page, type Response } from "@playwright/test";

function isGraphQLMutationResponse(response: Response, operationName: string) {
  if (!response.url().includes("/graphql") || response.status() !== 200) {
    return false;
  }
  const postData = response.request().postData();
  return postData?.includes(operationName) ?? false;
}

async function createLabel({
  page,
  settingsPath,
  labelName,
  mutationName,
}: {
  page: Page;
  settingsPath: string;
  labelName: string;
  mutationName: string;
}) {
  await page.goto(settingsPath);
  await page.getByRole("button", { name: "New Label" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Label Name").fill(labelName);
  await Promise.all([
    page.waitForResponse((resp) =>
      isGraphQLMutationResponse(resp, mutationName)
    ),
    page.getByRole("button", { name: "Create Label" }).click(),
  ]);
  await expect(page.getByRole("dialog")).not.toBeVisible();
}

/**
 * Check a label in the header's picker and wait for the save.
 */
async function addLabelFromHeader({
  page,
  labelName,
  mutationName,
}: {
  page: Page;
  labelName: string;
  mutationName: string;
}) {
  await page.getByRole("button", { name: "Add label" }).click();
  const option = page.getByRole("menuitemcheckbox", { name: labelName });
  await option.waitFor({ state: "visible" });
  await Promise.all([
    page.waitForResponse((resp) =>
      isGraphQLMutationResponse(resp, mutationName)
    ),
    option.click(),
  ]);
  await page.keyboard.press("Escape");
}

async function removeLabelFromHeader({
  page,
  labelName,
  mutationName,
}: {
  page: Page;
  labelName: string;
  mutationName: string;
}) {
  await Promise.all([
    page.waitForResponse((resp) =>
      isGraphQLMutationResponse(resp, mutationName)
    ),
    page
      .getByRole("button", { name: `Remove ${labelName}`, exact: true })
      .click(),
  ]);
}

test.describe("Editing labels in a page header", () => {
  test("adds and removes a dataset's labels, and they persist", async ({
    page,
  }) => {
    const id = randomUUID().slice(0, 8);
    const keptLabel = `kept-${id}`;
    const removedLabel = `removed-${id}`;
    const datasetName = `header-labels-${id}`;
    const mutationName = "DatasetLabelPickerSetLabelsMutation";

    for (const labelName of [keptLabel, removedLabel]) {
      await createLabel({
        page,
        settingsPath: "/settings/datasets",
        labelName,
        mutationName: "useDatasetLabelMutationsAddLabelMutation",
      });
    }

    await page.goto("/datasets");
    await page.getByRole("button", { name: "New Dataset" }).click();
    await page.getByRole("tab", { name: "From scratch" }).click();
    await page.getByLabel("Dataset Name").fill(datasetName);
    await page.getByRole("button", { name: "Create Dataset" }).click();
    await page.waitForURL("**/datasets/**/examples");

    const labels = page.getByRole("grid", { name: "Dataset labels" });
    await expect(page.getByText("No labels")).toBeVisible();

    await addLabelFromHeader({ page, labelName: keptLabel, mutationName });
    await addLabelFromHeader({ page, labelName: removedLabel, mutationName });
    await expect(labels.getByRole("row", { name: keptLabel })).toBeVisible();
    await expect(labels.getByRole("row", { name: removedLabel })).toBeVisible();

    await removeLabelFromHeader({
      page,
      labelName: removedLabel,
      mutationName,
    });
    await expect(
      labels.getByRole("row", { name: removedLabel })
    ).not.toBeVisible();

    await page.reload();
    await expect(labels.getByRole("row", { name: keptLabel })).toBeVisible();
    await expect(
      labels.getByRole("row", { name: removedLabel })
    ).not.toBeVisible();
  });

  test("adds and removes a prompt's labels, and they persist", async ({
    page,
  }) => {
    const id = randomUUID().slice(0, 8);
    const keptLabel = `kept-${id}`;
    const removedLabel = `removed-${id}`;
    const promptName = `header-labels-${id}`;

    for (const labelName of [keptLabel, removedLabel]) {
      await createLabel({
        page,
        settingsPath: "/settings/prompts",
        labelName,
        mutationName: "usePromptLabelMutationsCreateLabelMutation",
      });
    }

    await page.goto("/playground");
    await page.getByRole("button", { name: "Save Prompt" }).click();
    await page.getByPlaceholder("Select or enter new prompt").click();
    await page.getByPlaceholder("Select or enter new prompt").fill(promptName);
    await page.getByRole("button", { name: "Create Prompt" }).click();
    await expect(page).toHaveURL(/promptId=/);
    const promptId = new URL(page.url()).searchParams.get("promptId");
    await page.goto(`/prompts/${promptId}`);

    const labels = page.getByRole("grid", { name: "Prompt labels" });
    await expect(page.getByText("No labels")).toBeVisible();

    await addLabelFromHeader({
      page,
      labelName: keptLabel,
      mutationName: "PromptLabelPickerSetLabelsMutation",
    });
    await addLabelFromHeader({
      page,
      labelName: removedLabel,
      mutationName: "PromptLabelPickerSetLabelsMutation",
    });
    await expect(labels.getByRole("row", { name: keptLabel })).toBeVisible();
    await expect(labels.getByRole("row", { name: removedLabel })).toBeVisible();

    await removeLabelFromHeader({
      page,
      labelName: removedLabel,
      mutationName: "PromptLabelPickerUnsetLabelsMutation",
    });
    await expect(
      labels.getByRole("row", { name: removedLabel })
    ).not.toBeVisible();

    await page.reload();
    await expect(labels.getByRole("row", { name: keptLabel })).toBeVisible();
    await expect(
      labels.getByRole("row", { name: removedLabel })
    ).not.toBeVisible();
  });
});
