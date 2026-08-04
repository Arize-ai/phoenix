import { randomUUID } from "crypto";
import { expect, test, type Page } from "@playwright/test";

/**
 * Exploratory coverage for the Datasets & Experiments subtree:
 * - example detail drawer (open via row click, content panes, experiment runs)
 * - example editing + dataset versions
 * - splits creation/assignment/filtering
 * - dataset label creation/assignment from the dataset detail page
 * - dataset deletion from the table row actions menu
 * - experiments tab empty state + "Run via SDK" dialog
 *
 * These flows are not covered by datasets.spec.ts, dataset-file-upload.spec.ts,
 * dataset-examples-overflow.spec.ts, or label-list-management.spec.ts.
 */

// At narrower widths the example drawer header actions ("Assign to splits",
// "Edit Example") can overflow off screen, so use a wide viewport.
test.use({ viewport: { width: 1600, height: 900 } });

/**
 * Create a dataset from scratch via the datasets page dialog.
 */
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
    .fill("Exploratory datasets & experiments coverage");

  await page.getByRole("button", { name: "Create Dataset" }).click();
  await expect(page.getByTestId("dialog")).not.toBeVisible();
}

/**
 * Navigate from the datasets table to the dataset's examples tab.
 */
async function gotoDatasetExamples(page: Page, datasetName: string) {
  await page.goto("/datasets");
  await page.waitForURL("**/datasets");
  await page.getByRole("link", { name: datasetName }).click();
  await page.waitForURL("**/datasets/**/examples");
  await expect(page.getByRole("heading", { name: datasetName })).toBeVisible();
}

/**
 * Add a single example through the "Add Example Manually" dialog. The
 * input/output editors are CodeMirror instances, so we select-all and
 * insert text instead of using fill().
 */
async function addExampleManually(page: Page, input: string, output: string) {
  await page.getByRole("button", { name: "Add Dataset Example" }).click();
  await page.getByRole("menuitem", { name: "Add Example Manually" }).click();

  const dialog = page
    .getByRole("dialog")
    .filter({ has: page.getByRole("button", { name: "Add Example" }) });
  await expect(dialog).toBeVisible();

  const inputEditor = dialog.locator(".cm-content").nth(0);
  await inputEditor.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(input);

  const outputEditor = dialog.locator(".cm-content").nth(1);
  await outputEditor.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(output);

  // Turn off "Create more" so the dialog closes on submit.
  await dialog.getByText("Create more", { exact: true }).click();
  await dialog.getByRole("button", { name: "Add Example" }).click();
  // Wait on the dialog's heading rather than the filtered locator above:
  // the submit button's label changes while the mutation is in flight, so
  // the filter stops matching before the dialog has actually unmounted.
  await expect(
    page.getByRole("heading", { name: "Add Example Manually" })
  ).toBeHidden();
}

test.describe("Dataset examples", () => {
  test("can add an example manually and inspect it in the detail drawer", async ({
    page,
  }) => {
    const id = randomUUID().slice(0, 8);
    const datasetName = `exploratory-drawer-${id}`;
    const question = `drawer-question-${id}`;

    await createDataset(page, datasetName);
    await gotoDatasetExamples(page, datasetName);
    await addExampleManually(
      page,
      `{"question": "${question}"}`,
      '{"answer": "42"}'
    );

    // The new example shows up in the examples table.
    const inputCell = page.getByRole("cell", { name: question });
    await expect(inputCell).toBeVisible();

    // Clicking the row opens the example detail drawer with its own URL.
    await inputCell.click();
    await page.waitForURL("**/datasets/**/examples/**");

    const drawer = page.getByTestId("application-drawer-plane");
    await expect(
      drawer.getByRole("heading", { name: "Example" })
    ).toBeVisible();
    await expect(drawer.getByText(question)).toBeVisible();
    await expect(
      drawer.getByRole("heading", { name: "Experiment Runs" })
    ).toBeVisible();
    await expect(
      drawer.getByText("No experiments have been run for this example")
    ).toBeVisible();
  });

  test("can edit an example and see the revision in the versions tab", async ({
    page,
  }) => {
    const id = randomUUID().slice(0, 8);
    const datasetName = `exploratory-edit-${id}`;
    const question = `edit-question-${id}`;
    const revisionDescription = `exploratory-revision-${id}`;

    await createDataset(page, datasetName);
    await gotoDatasetExamples(page, datasetName);
    await addExampleManually(
      page,
      `{"question": "${question}"}`,
      '{"answer": "4"}'
    );

    // Open the example drawer and launch the edit dialog.
    await page.getByRole("cell", { name: question }).click();
    await page.waitForURL("**/datasets/**/examples/**");
    await page.getByRole("button", { name: "Edit Example" }).click();

    const editDialog = page
      .getByRole("dialog")
      .filter({ has: page.getByRole("button", { name: "Save Changes" }) });
    await expect(editDialog).toBeVisible();

    // Rewrite the output JSON and describe the revision.
    const outputEditor = editDialog.locator(".cm-content").nth(1);
    await outputEditor.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.insertText(`{"answer": "edited-${id}"}`);
    await editDialog
      .getByLabel("Revision Description")
      .fill(revisionDescription);
    await editDialog.getByRole("button", { name: "Save Changes" }).click();
    await expect(editDialog).not.toBeVisible();

    // The examples table reflects the edited output.
    await expect(
      page.getByRole("cell", { name: `edited-${id}` })
    ).toBeVisible();

    // The versions tab records the revision with its description.
    await page.getByRole("tab", { name: "Versions" }).click();
    await page.waitForURL("**/datasets/**/versions");
    await expect(
      page.getByRole("cell", { name: revisionDescription })
    ).toBeVisible();
  });

  test("can create a split for selected examples and filter by it", async ({
    page,
  }) => {
    const id = randomUUID().slice(0, 8);
    const datasetName = `exploratory-splits-${id}`;
    const inSplitQuestion = `split-member-${id}`;
    const outOfSplitQuestion = `split-outsider-${id}`;
    const splitName = `exploratory-split-${id}`;

    await createDataset(page, datasetName);
    await gotoDatasetExamples(page, datasetName);
    await addExampleManually(
      page,
      `{"question": "${inSplitQuestion}"}`,
      '{"answer": "in"}'
    );
    await addExampleManually(
      page,
      `{"question": "${outOfSplitQuestion}"}`,
      '{"answer": "out"}'
    );

    // Select the first example to reveal the bulk actions toolbar.
    const targetRow = page.getByRole("row").filter({
      hasText: inSplitQuestion,
    });
    // The selection cell wraps the checkbox in a full-cell click target and
    // sets pointer-events:none on the checkbox itself (see
    // IndeterminateCheckboxCell), so the cell must be clicked, not the box.
    await targetRow.locator("td").first().click();
    await expect(targetRow.getByRole("checkbox")).toBeChecked();
    await page.getByRole("button", { name: "Assign to splits" }).click();

    // Switch the split menu into create mode via the "+" icon button in the
    // menu header, then create a split assigned to the selected example.
    await page.getByTestId("menu-header-title").getByRole("button").click();
    await page.getByLabel("Split Name").fill(splitName);
    await page.getByRole("button", { name: "Create Split" }).click();

    // Back in apply mode the new split shows as applied.
    const appliedSplit = page.getByRole("menuitem", { name: splitName });
    await expect(appliedSplit.getByRole("checkbox")).toBeChecked();
    await page.keyboard.press("Escape");

    // The split token renders on the assigned example's row.
    await expect(targetRow.getByText(splitName)).toBeVisible();

    // Filtering by the split hides the unassigned example.
    await page.getByRole("button", { name: "Splits", exact: true }).click();
    await page.getByRole("menuitemcheckbox", { name: splitName }).click();
    await expect(
      page.getByRole("cell", { name: inSplitQuestion })
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: outOfSplitQuestion })
    ).not.toBeVisible();
  });
});

test.describe("Dataset labels and lifecycle", () => {
  test("can create and assign a label from the dataset detail page", async ({
    page,
  }) => {
    const id = randomUUID().slice(0, 8);
    const datasetName = `exploratory-label-${id}`;
    const labelName = `exploratory-label-${id}`;

    await createDataset(page, datasetName);
    await gotoDatasetExamples(page, datasetName);

    await page
      .getByRole("button", { name: "Configure dataset labels" })
      .click();
    await page.getByRole("button", { name: "Create new label" }).click();
    await page.getByLabel("Label Name").fill(labelName);
    await page.getByRole("button", { name: "Create Label" }).click();

    // Creating a label from this popover assigns it to the dataset.
    await expect(
      page.getByRole("menuitemcheckbox", { name: labelName })
    ).toHaveAttribute("aria-checked", "true");

    // The assignment persists: the label token renders in the page header.
    await page.reload();
    await expect(page.getByText(labelName).first()).toBeVisible();
  });

  test("can delete a dataset from the row actions menu", async ({ page }) => {
    const datasetName = `exploratory-delete-${randomUUID()}`;

    await createDataset(page, datasetName);

    const row = page
      .getByTestId("datasets-table")
      .getByRole("row")
      .filter({ hasText: datasetName });
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: "Dataset actions" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();

    // A confirmation dialog names the dataset before deleting.
    await expect(
      page.getByRole("heading", { name: "Delete Dataset" })
    ).toBeVisible();
    await expect(
      page.getByText(`Are you sure you want to delete dataset ${datasetName}?`)
    ).toBeVisible();
    await page.getByRole("button", { name: "Delete Dataset" }).click();

    await expect(row).not.toBeVisible();
  });

  test("experiments tab shows an empty state and the run-experiment dialog", async ({
    page,
  }) => {
    const datasetName = `exploratory-experiments-${randomUUID()}`;

    await createDataset(page, datasetName);
    await gotoDatasetExamples(page, datasetName);

    await page.getByRole("tab", { name: "Experiments" }).click();
    await page.waitForURL("**/datasets/**/experiments");
    await expect(
      page.getByText(
        "Run experiments to evaluate and improve your AI applications."
      )
    ).toBeVisible();

    // The Experiment button offers SDK instructions (no LLM keys required).
    // Both the page header and the empty state render the button; use the
    // empty-state one.
    await page
      .getByRole("tabpanel", { name: "Experiments" })
      .getByTestId("run-dataset-experiment-button")
      .click();
    await page.getByRole("menuitem", { name: "Run via SDK" }).click();

    const dialog = page
      .getByRole("dialog")
      .filter({ hasText: "Run Experiment" });
    await expect(
      dialog.getByRole("heading", { name: "Run Experiment" })
    ).toBeVisible();
    await expect(
      dialog.getByText("pip install arize-phoenix-client")
    ).toBeVisible();
  });
});
