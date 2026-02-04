import { expect, test } from "@playwright/test";
import { randomUUID } from "crypto";

test.describe.serial("Server Evaluators", () => {
  const datasetName = `test-dataset-${randomUUID()}`;

  // Store the custom evaluator name for use across multiple tests
  const customEvaluatorName = `custom-eval-${randomUUID().slice(0, 8)}`;
  const updatedDescription = "Updated description for testing";

  test.beforeEach(async ({ page }) => {
    await page.goto(`/login`);
    await page.getByLabel("Email").fill("admin@localhost");
    await page.getByLabel("Password").fill("admin123");
    await page.getByRole("button", { name: "Log In", exact: true }).click();
    await page.waitForURL("**/projects");
  });

  test("can create a dataset", async ({ page }) => {
    await page.goto("/datasets");
    await page.waitForURL("**/datasets");

    // Click New Dataset dropdown button
    await page.getByRole("button", { name: "New Dataset" }).click();

    // Select "New Dataset" from the dropdown menu
    await page.getByRole("menuitem", { name: "New Dataset" }).click();

    // Fill in dataset details in the dialog
    await page.getByLabel("Dataset Name").clear();
    await page.getByLabel("Dataset Name").fill(datasetName);
    await page.getByLabel("Description").fill("Test dataset for evaluators");

    // Create the dataset
    await page.getByRole("button", { name: "Create Dataset" }).click();

    // Wait for dialog to close and verify we're on the new dataset page
    await expect(page.getByTestId("dialog")).not.toBeVisible({
      timeout: 10000,
    });

    // Wait for the dataset to appear in the table
    await expect(page.getByRole("link", { name: datasetName })).toBeVisible({
      timeout: 10000,
    });

    // Navigate to the dataset to verify it was created
    await page.getByRole("link", { name: datasetName }).click();
    await page.waitForURL("**/datasets/**/examples");

    // Verify dataset was created
    await expect(
      page.getByRole("heading", { name: datasetName })
    ).toBeVisible();
  });

  test("can navigate to evaluators tab", async ({ page }) => {
    // Navigate to the dataset's evaluators tab
    await page.goto("/datasets");
    await page.waitForURL("**/datasets");

    // Click on the dataset name
    await page.getByRole("link", { name: datasetName }).click();
    await page.waitForURL("**/datasets/**/examples");

    // Click on Evaluators tab
    await page.getByRole("tab", { name: /Evaluators/i }).click();
    await page.waitForURL("**/evaluators");

    // Verify we're on the evaluators tab
    await expect(
      page.getByRole("tab", { name: /Evaluators/i })
    ).toHaveAttribute("aria-selected", "true");

    // Verify the empty state shows prebuilt evaluator suggestions
    await expect(
      page.getByText("No evaluators added to this dataset")
    ).toBeVisible();
  });

  // TODO: Re-enable these tests once prebuilt evaluator features are complete
  // test("can add a prebuilt LLM evaluator (correctness)")
  // test("can add a prebuilt code evaluator (exact_match)")
  // test("can configure input mapping for evaluator")

  test("can create a custom LLM evaluator from scratch", async ({ page }) => {
    // Navigate to the dataset's evaluators tab
    await page.goto("/datasets");
    await page.getByRole("link", { name: datasetName }).click();
    await page.waitForURL("**/datasets/**/examples");
    await page.getByRole("tab", { name: /Evaluators/i }).click();
    await page.waitForURL("**/evaluators");

    // Click Add evaluator button
    await page.getByRole("button", { name: "Add evaluator" }).click();

    // Select "Create new LLM evaluator" from the dropdown
    await page
      .getByRole("menuitem", { name: "Create new LLM evaluator" })
      .click();

    // Verify the Create Evaluator dialog opens
    await expect(
      page.getByRole("heading", { name: "Create Evaluator" })
    ).toBeVisible();

    // Fill in the evaluator name
    await page
      .getByRole("textbox", { name: "Name" })
      .first()
      .fill(customEvaluatorName);

    // Fill in the description
    await page
      .getByRole("textbox", { name: /Description/i })
      .fill("Initial description for custom evaluator");

    // Fill in the System message - find the textbox within the System section
    const systemSection = page.locator(
      'button:has-text("System"):not([role="menuitem"])'
    );
    const systemTextbox = systemSection
      .locator("..")
      .locator("..")
      .getByRole("textbox");
    await systemTextbox.fill("You are an evaluator. Evaluate the output.");

    // Fill in the User message - find the textbox within the User section
    const userSection = page.locator(
      'button:has-text("User"):not([role="menuitem"])'
    );
    const userTextbox = userSection
      .locator("..")
      .locator("..")
      .getByRole("textbox");
    await userTextbox.fill(
      "Please evaluate this output: {{output}}\n\nReference: {{reference}}"
    );

    // Click Create button
    await page.getByRole("button", { name: "Create" }).click();

    // Wait for dialog to close
    await expect(page.getByTestId("dialog")).not.toBeVisible({
      timeout: 10000,
    });

    // Verify the evaluator appears in the table
    await expect(
      page.getByRole("cell", { name: customEvaluatorName, exact: true })
    ).toBeVisible();
  });

  test("can edit an LLM evaluator", async ({ page }) => {
    // Navigate to the dataset's evaluators tab
    await page.goto("/datasets");
    await page.getByRole("link", { name: datasetName }).click();
    await page.waitForURL("**/datasets/**/examples");
    await page.getByRole("tab", { name: /Evaluators/i }).click();
    await page.waitForURL("**/evaluators");

    // Find the row containing our custom evaluator and click its action menu
    const evaluatorRow = page.getByRole("row").filter({
      has: page.getByRole("cell", { name: customEvaluatorName, exact: true }),
    });

    // Click the action menu button (three dots) in the row
    await evaluatorRow.getByRole("button").last().click();

    // Click "Edit" from the menu
    await page.getByRole("menuitem", { name: "Edit" }).click();

    // Verify the Edit Evaluator dialog opens
    await expect(
      page.getByRole("heading", { name: "Edit Evaluator" })
    ).toBeVisible();

    // Update the description
    const descriptionInput = page.getByRole("textbox", {
      name: /Description/i,
    });
    await descriptionInput.clear();
    await descriptionInput.fill(updatedDescription);

    // Click Update button
    await page.getByRole("button", { name: "Update" }).click();

    // Wait for dialog to close
    await expect(page.getByTestId("dialog")).not.toBeVisible({
      timeout: 10000,
    });

    // Verify the evaluator still appears in the table
    await expect(
      page.getByRole("cell", { name: customEvaluatorName, exact: true })
    ).toBeVisible();
  });

  test("can verify evaluator edits were saved", async ({ page }) => {
    // Navigate to the dataset's evaluators tab
    await page.goto("/datasets");
    await page.getByRole("link", { name: datasetName }).click();
    await page.waitForURL("**/datasets/**/examples");
    await page.getByRole("tab", { name: /Evaluators/i }).click();
    await page.waitForURL("**/evaluators");

    // Find the row containing our custom evaluator and click its action menu
    const evaluatorRow = page.getByRole("row").filter({
      has: page.getByRole("cell", { name: customEvaluatorName, exact: true }),
    });

    // Click the action menu button (three dots) in the row
    await evaluatorRow.getByRole("button").last().click();

    // Click "Edit" from the menu
    await page.getByRole("menuitem", { name: "Edit" }).click();

    // Verify the Edit Evaluator dialog opens
    await expect(
      page.getByRole("heading", { name: "Edit Evaluator" })
    ).toBeVisible();

    // Verify the updated description is present
    const descriptionInput = page.getByRole("textbox", {
      name: /Description/i,
    });
    await expect(descriptionInput).toHaveValue(updatedDescription);

    // Close the dialog
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByTestId("dialog")).not.toBeVisible({
      timeout: 10000,
    });
  });

  // TODO: Re-enable once playground dataset integration is more stable
  // This test hangs in CI - needs investigation
  // test("evaluators are visible in playground when dataset is selected")
});
