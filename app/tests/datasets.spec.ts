import { randomUUID } from "crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";

function datasetRow(page: Page, datasetName: string) {
  return page.getByTestId("datasets-table").getByRole("row").filter({
    hasText: datasetName,
  });
}

function datasetNameLink(page: Page, datasetName: string) {
  return datasetRow(page, datasetName)
    .locator("a")
    .filter({
      hasText: new RegExp(`^${datasetName}$`),
    });
}

async function createDataset(
  page: Page,
  datasetName: string,
  description: string
) {
  await page.getByRole("button", { name: "New Dataset" }).click();
  await expect(
    page.getByRole("heading", { name: "Create Dataset" })
  ).toBeVisible();
  await page.getByRole("tab", { name: "From scratch" }).click();
  await page.getByLabel("Dataset Name").clear();
  await page.getByLabel("Dataset Name").fill(datasetName);
  await page.getByTestId("dialog").getByLabel("Description").fill(description);
  await page.getByRole("button", { name: "Create Dataset" }).click();
  await expect(page.getByTestId("dialog")).not.toBeVisible();
}

async function clickSortableHeaderAndExpect(
  header: Locator,
  direction: "ascending" | "descending"
) {
  await header.locator(".sort").click();
  await expect(header).toHaveAttribute("aria-sort", direction);
}

test.describe("Datasets", () => {
  test("can create a dataset from scratch", async ({ page }) => {
    const datasetName = `test-dataset-${randomUUID()}`;

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
      .fill("A test dataset created from scratch");

    await page.getByRole("button", { name: "Create Dataset" }).click();
    await expect(page.getByTestId("dialog")).not.toBeVisible();
    await expect(datasetRow(page, datasetName)).toBeVisible();
  });

  test("can create a dataset from scratch and navigate to it", async ({
    page,
  }) => {
    const datasetName = `test-dataset-${randomUUID()}`;

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
      .fill("Navigate to this dataset");

    await page.getByRole("button", { name: "Create Dataset" }).click();
    await expect(page.getByTestId("dialog")).not.toBeVisible();

    await datasetNameLink(page, datasetName).click({ force: true });
    await page.waitForURL("**/datasets/**/examples");
    await expect(
      page.getByRole("heading", { name: datasetName })
    ).toBeVisible();
  });

  test("shows validation error when dataset name is empty", async ({
    page,
  }) => {
    await page.goto("/datasets");
    await page.waitForURL("**/datasets");

    await page.getByRole("button", { name: "New Dataset" }).click();
    await expect(
      page.getByRole("heading", { name: "Create Dataset" })
    ).toBeVisible();

    await page.getByRole("tab", { name: "From scratch" }).click();
    await page.getByLabel("Dataset Name").clear();
    await page.getByRole("button", { name: "Create Dataset" }).click();

    await expect(page.getByTestId("dialog")).toBeVisible();
    await expect(page.getByText("Dataset name is required")).toBeVisible();
  });

  test("supports sorting and filtering in datasets table", async ({ page }) => {
    const id = randomUUID().slice(0, 8);
    const datasetNameA = `compiler-sort-${id}-a`;
    const datasetNameZ = `compiler-sort-${id}-z`;

    await page.goto("/datasets");
    await page.waitForURL("**/datasets");

    await createDataset(
      page,
      datasetNameA,
      "Dataset used for compiler table sort/filter checks (A)"
    );
    await createDataset(
      page,
      datasetNameZ,
      "Dataset used for compiler table sort/filter checks (Z)"
    );

    const search = page.getByRole("searchbox", {
      name: "Search datasets by name",
    });
    await search.fill(`compiler-sort-${id}`);

    await expect(datasetRow(page, datasetNameA)).toBeVisible();
    await expect(datasetRow(page, datasetNameZ)).toBeVisible();

    const table = page.getByTestId("datasets-table");
    await expect(table).toBeVisible();
    const nameHeader = page.getByRole("columnheader", { name: "name" }).first();

    await clickSortableHeaderAndExpect(nameHeader, "ascending");
    await expect(datasetRow(page, datasetNameA)).toBeVisible();

    await clickSortableHeaderAndExpect(nameHeader, "descending");
    await expect(datasetRow(page, datasetNameZ)).toBeVisible();

    await search.fill(`no-match-${id}`);
    await expect(
      page.getByText(
        "Create datasets for testing prompts, experimentation, and fine-tuning."
      )
    ).toBeVisible();

    await search.fill(datasetNameA);
    await expect(datasetRow(page, datasetNameA)).toBeVisible();
    await expect(datasetRow(page, datasetNameZ)).not.toBeVisible();
  });

  test("can expand a dataset row to read its details inline", async ({
    page,
  }) => {
    const datasetName = `test-dataset-${randomUUID()}`;
    const description = "Secondary detail shown in the expanded row";

    await page.goto("/datasets");
    await page.waitForURL("**/datasets");
    await createDataset(page, datasetName, description);

    await page
      .getByRole("searchbox", { name: "Search datasets by name" })
      .fill(datasetName);
    await expect(datasetRow(page, datasetName)).toBeVisible();

    const toggle = page.getByRole("button", {
      name: `Toggle details for ${datasetName}`,
    });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    const details = page
      .getByTestId("datasets-table")
      .locator('tr[data-row="details"]');
    await expect(details).toHaveCount(0);

    // the control is a button, so it opens from the keyboard
    await toggle.focus();
    await page.keyboard.press("Enter");

    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(details).toHaveCount(1);
    await expect(details).toContainText(description);
    await expect(details).toContainText("Dataset ID");
    // expanding must not follow the row into the dataset
    expect(new URL(page.url()).pathname).toBe("/datasets");

    // a refetching sort leaves the row expanded rather than snapping it shut
    await clickSortableHeaderAndExpect(
      page.getByRole("columnheader", { name: "name" }).first(),
      "ascending"
    );
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(details).toHaveCount(1);

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(details).toHaveCount(0);
  });
});
