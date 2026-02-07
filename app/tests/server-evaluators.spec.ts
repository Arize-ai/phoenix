import { expect, test } from "@playwright/test";
import { randomUUID } from "crypto";

import { ADMIN_USER, login } from "./utils/login";

test.describe.serial("Server Evaluators", () => {
  const datasetName = `test-dataset-${randomUUID()}`;

  // Store the custom evaluator name for use across multiple tests
  const customEvaluatorName = `custom-eval-${randomUUID().slice(0, 8)}`;
  const updatedDescription = "Updated description for testing";

  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN_USER);
  });

  test("can create a dataset with an example", async ({ page }) => {
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

    // Add an example to the dataset (required for playground to work)
    await page
      .getByRole("button", { name: "Add Dataset Example" })
      .or(page.getByRole("button", { name: "Example" }))
      .click();

    // Wait for the Add Example dialog to open
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10000 });

    // Fill in the input field with valid JSON
    // JSONEditor renders a CodeMirror editor with .cm-content
    const inputTextArea = page.locator(".cm-content").first();
    await inputTextArea.waitFor({ state: "visible", timeout: 5000 });
    await inputTextArea.click();
    // Clear existing content and type new JSON
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type('{"question": "What is 2+2?", "context": "Math"}');

    // Click Add Example button to save
    await page.getByRole("button", { name: "Add Example" }).click();

    // Wait for dialog to close
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 10000 });

    // Verify the example appears in the table (or at least the table is no longer empty)
    await expect(page.getByRole("row")).toHaveCount(2, { timeout: 10000 }); // header + 1 example
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

  // Store names for prebuilt evaluators
  const prebuiltLLMEvaluatorName = `correctness-${randomUUID().slice(0, 8)}`;
  const prebuiltCodeEvaluatorName = `exact-match-${randomUUID().slice(0, 8)}`;

  test("can add a prebuilt LLM evaluator (correctness)", async ({ page }) => {
    // Navigate to the dataset's evaluators tab
    await page.goto("/datasets");
    await page.getByRole("link", { name: datasetName }).click();
    await page.waitForURL("**/datasets/**/examples");
    await page.getByRole("tab", { name: /Evaluators/i }).click();
    await page.waitForURL("**/evaluators");

    // Click Add evaluator button
    await page.getByRole("button", { name: "Add evaluator" }).click();

    // Hover over "Use LLM evaluator template" to open submenu
    await page
      .getByRole("menuitem", { name: "Use LLM evaluator template" })
      .hover();

    // Wait for submenu to appear and click "Correctness"
    await page
      .getByRole("menuitem", { name: /Correctness/i })
      .first()
      .click();

    // Verify the Create Evaluator dialog opens with prefilled template
    await expect(
      page.getByRole("heading", { name: "Create Evaluator" })
    ).toBeVisible();

    // Update the name to our unique test name
    const nameInput = page.getByRole("textbox", { name: "Name" }).first();
    await nameInput.clear();
    await nameInput.fill(prebuiltLLMEvaluatorName);

    // Click Create button
    await page.getByRole("button", { name: "Create" }).click();

    // Wait for dialog to close
    await expect(page.getByTestId("dialog")).not.toBeVisible({
      timeout: 10000,
    });

    // Verify the evaluator appears in the table
    await expect(
      page.getByRole("cell", { name: prebuiltLLMEvaluatorName, exact: true })
    ).toBeVisible();
  });

  test("can add a prebuilt code evaluator (exact_match)", async ({ page }) => {
    // Navigate to the dataset's evaluators tab
    await page.goto("/datasets");
    await page.getByRole("link", { name: datasetName }).click();
    await page.waitForURL("**/datasets/**/examples");
    await page.getByRole("tab", { name: /Evaluators/i }).click();
    await page.waitForURL("**/evaluators");

    // Click Add evaluator button
    await page.getByRole("button", { name: "Add evaluator" }).click();

    // Hover over "Use built-in code evaluator" to open submenu
    await page
      .getByRole("menuitem", { name: "Use built-in code evaluator" })
      .hover();

    // Wait for submenu to appear and click "exact_match"
    await page.getByRole("menuitem", { name: /exact_match/i }).click();

    // Verify the Create Evaluator dialog opens
    await expect(
      page.getByRole("heading", { name: "Create Evaluator" })
    ).toBeVisible();

    // Update the name to our unique test name
    const nameInput = page.getByRole("textbox", { name: "Name" }).first();
    await nameInput.clear();
    await nameInput.fill(prebuiltCodeEvaluatorName);

    // Click Create button
    await page.getByRole("button", { name: "Create" }).click();

    // Wait for dialog to close
    await expect(page.getByTestId("dialog")).not.toBeVisible({
      timeout: 10000,
    });

    // Verify the evaluator appears in the table
    await expect(
      page.getByRole("cell", { name: prebuiltCodeEvaluatorName, exact: true })
    ).toBeVisible();
  });

  test("can configure input mapping for code evaluator", async ({ page }) => {
    // Navigate to the dataset's evaluators tab
    await page.goto("/datasets");
    await page.getByRole("link", { name: datasetName }).click();
    await page.waitForURL("**/datasets/**/examples");
    await page.getByRole("tab", { name: /Evaluators/i }).click();
    await page.waitForURL("**/evaluators");

    // Find the row containing our code evaluator and click its action menu
    const evaluatorRow = page.getByRole("row").filter({
      has: page.getByRole("cell", {
        name: prebuiltCodeEvaluatorName,
        exact: true,
      }),
    });

    // Click the action menu button (three dots) in the row
    await evaluatorRow.getByRole("button").last().click();

    // Click "Edit" from the menu
    await page.getByRole("menuitem", { name: "Edit" }).click();

    // Verify the Edit Evaluator dialog opens
    await expect(
      page.getByRole("heading", { name: "Edit Evaluator" })
    ).toBeVisible();

    // Find the Expected field's input mode selector and verify it exists
    // The SwitchableEvaluatorInput has a mode toggle (path vs literal)
    const expectedLabel = page.getByText("Expected", { exact: true });
    await expect(expectedLabel).toBeVisible();

    // Find the Actual field and verify it exists
    const actualLabel = page.getByText("Actual", { exact: true });
    await expect(actualLabel).toBeVisible();

    // Find and verify the case sensitive switch exists
    const caseSensitiveSwitch = page.getByRole("switch", {
      name: /Case sensitive/i,
    });
    await expect(caseSensitiveSwitch).toBeVisible();

    // Toggle the case sensitive switch off
    // Note: React Aria's Switch creates a hidden input with role="switch".
    // Clicking via getByRole targets this hidden input which can cause issues.
    // Click the label text instead which properly toggles the switch.
    await page.getByText("Case sensitive", { exact: true }).click();

    // Click Update button
    await page.getByRole("button", { name: "Update" }).click();

    // Wait for dialog to close
    await expect(page.getByTestId("dialog")).not.toBeVisible({
      timeout: 10000,
    });

    // Verify the evaluator still appears in the table
    await expect(
      page.getByRole("cell", { name: prebuiltCodeEvaluatorName, exact: true })
    ).toBeVisible();
  });

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

  test("evaluators are visible in playground when dataset is selected", async ({
    page,
  }) => {
    // First, navigate to the dataset to get its ID from the URL
    await page.goto("/datasets");
    await page.getByRole("link", { name: datasetName }).click();
    await page.waitForURL("**/datasets/**/examples");

    // Extract the dataset ID from the URL
    const url = page.url();
    const match = url.match(/datasets\/([^/]+)/);
    const datasetId = match ? match[1] : "";
    expect(datasetId).toBeTruthy();

    // Navigate to the playground with the dataset selected
    await page.goto(`/playground?datasetId=${datasetId}`);

    // Wait for the playground to load with dataset mode
    await page.waitForURL(`**/playground?datasetId=${datasetId}`);

    // Wait for network to settle and page to load
    await page.waitForLoadState("networkidle");

    // Check if the playground is showing the "No provider" message
    // If so, we error and fail the test
    const noProviderMessage = page.getByText(
      "The playground is not available until an LLM provider client is installed"
    );
    if (
      await noProviderMessage.isVisible({ timeout: 5000 }).catch(() => false)
    ) {
      throw new Error(
        "Playground requires an LLM provider to be installed. Playwright test environment is not configured correctly."
      );
    }

    // Wait for the playground title to appear first
    await expect(page.getByRole("heading", { name: "Playground" })).toBeVisible(
      { timeout: 10000 }
    );

    // Wait for the "Experiment" text to appear, which indicates
    // the dataset section has loaded (this appears in PlaygroundExperimentToolbar)
    await expect(page.getByText("Experiment", { exact: true })).toBeVisible({
      timeout: 30000,
    });

    // Find and click the Evaluators button to open the evaluators menu
    // Use the button inside the content area (not the tab)
    const evaluatorsButton = page
      .getByTestId("content")
      .getByRole("button", { name: /Evaluators/i });
    await expect(evaluatorsButton).toBeVisible({ timeout: 10000 });
    await evaluatorsButton.click();

    // Wait for the evaluators menu to appear - the GridList has aria-label="Select evaluators"
    // React Aria GridList renders with role="grid"
    const evaluatorsList = page.locator('[aria-label="Select evaluators"]');
    await expect(evaluatorsList).toBeVisible({ timeout: 10000 });

    // Verify that the prebuilt LLM evaluator (correctness) appears in the list
    // GridList items render as role="row"
    await expect(
      evaluatorsList.getByRole("row", {
        name: new RegExp(prebuiltLLMEvaluatorName),
      })
    ).toBeVisible();

    // Verify that the prebuilt code evaluator (exact match) appears in the list
    await expect(
      evaluatorsList.getByRole("row", {
        name: new RegExp(prebuiltCodeEvaluatorName),
      })
    ).toBeVisible();

    // Verify that the custom LLM evaluator appears in the list
    await expect(
      evaluatorsList.getByRole("row", { name: new RegExp(customEvaluatorName) })
    ).toBeVisible();
  });

  test("can navigate to evaluator details pages", async ({ page }) => {
    // Navigate to the dataset's evaluators tab
    await page.goto("/datasets");
    await page.getByRole("link", { name: datasetName }).click();
    await page.waitForURL("**/datasets/**/examples");
    await page.getByRole("tab", { name: /Evaluators/i }).click();
    await page.waitForURL("**/evaluators");

    // Navigate to the LLM evaluator details page
    await page
      .getByRole("link", { name: prebuiltLLMEvaluatorName, exact: true })
      .click();
    await page.waitForURL("**/evaluators/**");

    // Verify the LLM evaluator details page loaded
    await expect(
      page.getByRole("heading", { name: prebuiltLLMEvaluatorName })
    ).toBeVisible();

    // Navigate back to the evaluators tab
    await page.goto("/datasets");
    await page.getByRole("link", { name: datasetName }).click();
    await page.waitForURL("**/datasets/**/examples");
    await page.getByRole("tab", { name: /Evaluators/i }).click();
    await page.waitForURL("**/evaluators");

    // Navigate to the built-in code evaluator details page
    await page
      .getByRole("link", { name: prebuiltCodeEvaluatorName, exact: true })
      .click();
    await page.waitForURL("**/evaluators/**");

    // Verify the built-in evaluator details page loaded
    await expect(
      page.getByRole("heading", { name: prebuiltCodeEvaluatorName })
    ).toBeVisible();
  });
});
