import { randomUUID } from "crypto";
import { expect, test, type Page } from "@playwright/test";

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
  await page.getByLabel("Description").fill(description);
  await page.getByRole("button", { name: "Create Dataset" }).click();
  await expect(page.getByTestId("dialog")).not.toBeVisible();
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
      .getByLabel("Description")
      .fill("A test dataset created from scratch");

    await page.getByRole("button", { name: "Create Dataset" }).click();
    await expect(page.getByTestId("dialog")).not.toBeVisible();
    await expect(page.getByRole("link", { name: datasetName })).toBeVisible();
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
    await page.getByLabel("Description").fill("Navigate to this dataset");

    await page.getByRole("button", { name: "Create Dataset" }).click();
    await expect(page.getByTestId("dialog")).not.toBeVisible();

    await page.getByRole("link", { name: datasetName }).click();
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

    await expect(page.getByRole("link", { name: datasetNameA })).toBeVisible();
    await expect(page.getByRole("link", { name: datasetNameZ })).toBeVisible();

    const table = page.getByTestId("datasets-table");
    const nameHeader = table.locator("th").filter({ hasText: /^name$/ });

    await nameHeader.locator(".sort").click();
    await expect(nameHeader).toHaveAttribute("aria-sort", "ascending");
    await expect(page.getByRole("link", { name: datasetNameA })).toBeVisible();

    await nameHeader.locator(".sort").click();
    await expect(nameHeader).toHaveAttribute("aria-sort", "descending");
    await expect(page.getByRole("link", { name: datasetNameZ })).toBeVisible();

    await search.fill(`no-match-${id}`);
    await expect(
      page.getByText(
        "Create datasets for testing prompts, experimentation, and fine-tuning."
      )
    ).toBeVisible();

    await search.fill(datasetNameA);
    await expect(page.getByRole("link", { name: datasetNameA })).toBeVisible();
    await expect(
      page.getByRole("link", { name: datasetNameZ })
    ).not.toBeVisible();
  });
});
