import { randomUUID } from "crypto";
import { expect, test, type Page, type Response } from "@playwright/test";

function isGraphQLMutationResponse(response: Response, operationName: string) {
  if (!response.url().includes("/graphql") || response.status() !== 200) {
    return false;
  }
  const postData = response.request().postData();
  return postData?.includes(operationName) ?? false;
}

async function createDatasetLabel(page: Page, labelName: string) {
  await page.goto("/settings/datasets");
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

function datasetRow(page: Page, datasetName: string) {
  return page.getByTestId("datasets-table").getByRole("row").filter({
    hasText: datasetName,
  });
}

test.describe("Dataset form labels", () => {
  test("creates a dataset with an existing label and one created inline, then edits them", async ({
    page,
  }) => {
    const id = randomUUID().slice(0, 8);
    const existingLabel = `existing-${id}`;
    const inlineLabel = `inline-${id}`;
    const datasetName = `form-labels-${id}`;

    await createDatasetLabel(page, existingLabel);

    await page.goto("/datasets");
    await page.getByRole("button", { name: "New Dataset" }).click();
    await page.getByRole("tab", { name: "From scratch" }).click();
    await page.getByLabel("Dataset Name").fill(datasetName);

    const dialog = page.getByRole("dialog", { name: "Create Dataset" });
    const picker = page.getByRole("dialog", { name: "Dataset labels" });
    const formLabels = dialog.getByRole("grid", { name: "Dataset labels" });
    await dialog.getByRole("button", { name: "Add label" }).click();
    await page.getByRole("menuitemcheckbox", { name: existingLabel }).click();

    // Creating a label from the picker must not submit the dataset form
    await page.getByRole("button", { name: "Create new label" }).click();
    await page.getByLabel("Label Name").fill(inlineLabel);
    await Promise.all([
      page.waitForResponse((resp) =>
        isGraphQLMutationResponse(
          resp,
          "useDatasetLabelMutationsAddLabelMutation"
        )
      ),
      page.getByRole("button", { name: "Create Label" }).click(),
    ]);
    await expect(
      page.getByRole("menuitemcheckbox", { name: inlineLabel })
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(picker).not.toBeVisible();
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\/datasets$/);
    await expect(
      formLabels.getByRole("row", { name: existingLabel })
    ).toBeVisible();
    await expect(
      formLabels.getByRole("row", { name: inlineLabel })
    ).toBeVisible();

    await page.getByRole("button", { name: "Create Dataset" }).click();
    await page.waitForURL("**/datasets/**/examples");
    const headerLabels = page.getByRole("grid", { name: "Dataset labels" });
    await expect(
      headerLabels.getByRole("row", { name: existingLabel })
    ).toBeVisible();
    await expect(
      headerLabels.getByRole("row", { name: inlineLabel })
    ).toBeVisible();

    await page.goto("/datasets");
    await datasetRow(page, datasetName)
      .getByRole("button", { name: "Dataset actions" })
      .click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    const editDialog = page.getByRole("dialog", { name: "Edit Dataset" });
    await editDialog
      .getByRole("button", { name: `Remove ${existingLabel}`, exact: true })
      .click();
    await Promise.all([
      page.waitForResponse((resp) =>
        isGraphQLMutationResponse(resp, "DatasetLabelPickerSetLabelsMutation")
      ),
      editDialog.getByRole("button", { name: "Save" }).click(),
    ]);
    await expect(editDialog).not.toBeVisible();

    await page.reload();
    const row = datasetRow(page, datasetName);
    await expect(row.getByRole("row", { name: inlineLabel })).toBeVisible();
    await expect(
      row.getByRole("row", { name: existingLabel })
    ).not.toBeVisible();
  });
});
