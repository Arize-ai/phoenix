import { randomUUID } from "crypto";
import { expect, test } from "@playwright/test";

test.describe("Datasets", () => {
  test("can create a dataset from scratch", async ({ page }) => {
    const datasetName = `test-dataset-${randomUUID()}`;

    await page.goto("/datasets");
    await page.waitForURL("**/datasets");

    // Open the create dataset dialog
    await page.getByRole("button", { name: "New Dataset" }).click();

    // Verify dialog opens with the correct heading
    await expect(
      page.getByRole("heading", { name: "Create Dataset" })
    ).toBeVisible();

    // Switch to the "From scratch" tab
    await page.getByRole("tab", { name: "From scratch" }).click();

    // Fill in the dataset name
    await page.getByLabel("Dataset Name").clear();
    await page.getByLabel("Dataset Name").fill(datasetName);

    // Fill in the description
    await page
      .getByLabel("Description")
      .fill("A test dataset created from scratch");

    // Submit the form
    await page.getByRole("button", { name: "Create Dataset" }).click();

    // Wait for the dialog to close
    await expect(page.getByTestId("dialog")).not.toBeVisible();

    // Verify the new dataset appears in the table
    await expect(page.getByRole("link", { name: datasetName })).toBeVisible();
  });

  test("can create a dataset from scratch and navigate to it", async ({
    page,
  }) => {
    const datasetName = `test-dataset-${randomUUID()}`;

    await page.goto("/datasets");
    await page.waitForURL("**/datasets");

    // Open the create dataset dialog
    await page.getByRole("button", { name: "New Dataset" }).click();
    await expect(
      page.getByRole("heading", { name: "Create Dataset" })
    ).toBeVisible();

    // Switch to the "From scratch" tab
    await page.getByRole("tab", { name: "From scratch" }).click();

    // Fill in the dataset name
    await page.getByLabel("Dataset Name").clear();
    await page.getByLabel("Dataset Name").fill(datasetName);
    await page.getByLabel("Description").fill("Navigate to this dataset");

    // Submit the form
    await page.getByRole("button", { name: "Create Dataset" }).click();

    // Wait for the dialog to close
    await expect(page.getByTestId("dialog")).not.toBeVisible();

    // Click on the dataset link to navigate to it
    await page.getByRole("link", { name: datasetName }).click();
    await page.waitForURL("**/datasets/**/examples");

    // Verify the dataset page loaded with the correct heading
    await expect(
      page.getByRole("heading", { name: datasetName })
    ).toBeVisible();
  });

  test("shows validation error when dataset name is empty", async ({
    page,
  }) => {
    await page.goto("/datasets");
    await page.waitForURL("**/datasets");

    // Open the create dataset dialog
    await page.getByRole("button", { name: "New Dataset" }).click();
    await expect(
      page.getByRole("heading", { name: "Create Dataset" })
    ).toBeVisible();

    // Switch to the "From scratch" tab
    await page.getByRole("tab", { name: "From scratch" }).click();

    // Clear the pre-filled dataset name
    await page.getByLabel("Dataset Name").clear();

    // Attempt to submit the form
    await page.getByRole("button", { name: "Create Dataset" }).click();

    // The dialog should remain open
    await expect(page.getByTestId("dialog")).toBeVisible();

    // Verify the validation error message is shown
    await expect(page.getByText("Dataset name is required")).toBeVisible();
  });
});
