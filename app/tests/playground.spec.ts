import { randomUUID } from "crypto";
import { expect, test, type Page, type Response } from "@playwright/test";

function isGraphQLMutationResponse(response: Response, operationName: string) {
  if (!response.url().includes("/graphql") || response.status() !== 200) {
    return false;
  }
  const postData = response.request().postData();
  return postData?.includes(operationName) ?? false;
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
    .getByLabel("Description")
    .fill("Compiler playground table dataset");
  await page.getByRole("button", { name: "Create Dataset" }).click();
  await expect(page.getByTestId("dialog")).not.toBeVisible();
  await page.getByRole("link", { name: datasetName }).click();
  await page.waitForURL("**/datasets/**/examples");
}

async function setCodeMirrorValue(page: Page, value: string) {
  const dialog = page.getByRole("dialog");
  const inputEditor = dialog.locator(".cm-content").first();
  await expect(inputEditor).toBeVisible();
  await inputEditor.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(value);
}

async function addDatasetExample(
  page: Page,
  inputJson: string,
  closeDialog: boolean
) {
  const addBtn = page.getByRole("button", { name: "Add Example" });
  if (closeDialog) {
    await page.getByText("Create more", { exact: true }).click();
  }
  await setCodeMirrorValue(page, inputJson);
  await Promise.all([
    page.waitForResponse((resp) =>
      isGraphQLMutationResponse(resp, "AddDatasetExampleDialogMutation")
    ),
    addBtn.click(),
  ]);
  if (closeDialog) {
    await expect(page.getByRole("dialog")).not.toBeVisible();
  }
}

test.describe("Playground", () => {
  test("preserves prompt selection in the URL across page reloads", async ({
    page,
  }) => {
    await page.goto("/playground");
    await page.waitForURL("**/playground");
    await expect(
      page.getByRole("heading", { name: "Playground" })
    ).toBeVisible();

    await page.getByRole("button", { name: "Save Prompt" }).click();
    const promptName = `playground-url-test-${randomUUID().slice(0, 8)}`;
    await page.getByPlaceholder("Select or enter new prompt").click();
    await page.getByPlaceholder("Select or enter new prompt").fill(promptName);
    await page
      .getByLabel("Prompt Description")
      .fill("test prompt for URL persistence");
    await page.getByRole("button", { name: "Create Prompt" }).click();
    await expect(page).toHaveURL(/promptId=/);

    const urlAfterSave = page.url();
    const savedSearchParams = new URL(urlAfterSave).searchParams;
    const promptId = savedSearchParams.get("promptId");
    expect(promptId).toBeTruthy();

    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Playground" })
    ).toBeVisible();

    await expect(page).toHaveURL(/promptId=/);
    const urlAfterReload = page.url();
    const reloadedSearchParams = new URL(urlAfterReload).searchParams;
    expect(reloadedSearchParams.get("promptId")).toBe(promptId);
  });

  test("keeps dataset examples table interactive with expansion", async ({
    page,
  }) => {
    const datasetName = `playground-table-${randomUUID().slice(0, 8)}`;
    await createDataset(page, datasetName);

    const datasetMatch = page.url().match(/datasets\/([^/]+)/);
    const datasetId = datasetMatch ? datasetMatch[1] : "";
    expect(datasetId).toBeTruthy();

    await page
      .getByRole("button", { name: "Add Dataset Example" })
      .or(page.getByRole("button", { name: "Example" }))
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();

    const longContent = `${"lorem-ipsum-".repeat(45)}`;

    await addDatasetExample(
      page,
      JSON.stringify({ prompt: `playground-row-0 ${longContent}` }),
      false
    );
    await addDatasetExample(
      page,
      JSON.stringify({ prompt: `playground-row-1 ${longContent}` }),
      false
    );
    await addDatasetExample(
      page,
      JSON.stringify({ prompt: "playground-row-2" }),
      true
    );

    await page.goto(`/playground?datasetId=${datasetId}`);
    await page.waitForURL("**/playground?datasetId=*");

    await expect(
      page.getByText("playground-row-0", { exact: false }).first()
    ).toBeVisible();

    const showMoreButtons = page.getByRole("button", { name: "Show more" });
    const countBefore = await showMoreButtons.count();
    expect(countBefore).toBeGreaterThan(0);
    await showMoreButtons.first().click();
    await expect(showMoreButtons).toHaveCount(countBefore - 1);
  });
});
