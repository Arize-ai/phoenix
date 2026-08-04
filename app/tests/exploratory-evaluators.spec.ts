import { randomUUID } from "crypto";
import { expect, test, type Page } from "@playwright/test";

/**
 * Exploratory coverage for the standalone Evaluators surface:
 * - the global /evaluators page (search, expandable table, navigation)
 * - the dataset evaluators empty-state suggestion cards (a create entry
 *   point distinct from the "Add evaluator" menu covered elsewhere)
 * - the evaluator detail page Edit flow and the delete round trip
 *
 * Existing specs (server-evaluators.spec.ts, code-evaluators.spec.ts) only
 * exercise dataset-scoped evaluator flows via the "Add evaluator" menu and
 * never visit the global /evaluators page.
 */

/**
 * Create a dataset from scratch via the datasets page dialog. Built-in code
 * evaluators can be attached to a dataset with no examples, so no example is
 * added here.
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
  await page.getByRole("button", { name: "Create Dataset" }).click();
  await expect(page.getByTestId("dialog")).not.toBeVisible();
}

async function gotoDatasetEvaluators(page: Page, datasetName: string) {
  await page.goto("/datasets");
  await page.waitForURL("**/datasets");
  await page.getByRole("link", { name: datasetName }).click();
  await page.waitForURL("**/datasets/**/examples");
  await page.getByRole("tab", { name: /Evaluators/i }).click();
  await page.waitForURL("**/evaluators");
}

/**
 * Attach a built-in exact_match code evaluator to the current dataset by
 * clicking the empty-state suggestion card (not the "Add evaluator" menu).
 * Assumes the page is on the dataset's Evaluators tab with no evaluators yet.
 */
async function createExactMatchEvaluatorFromEmptyState(
  page: Page,
  evaluatorName: string
) {
  await expect(
    page.getByText("No evaluators added to this dataset")
  ).toBeVisible();

  // The empty state renders a grid of suggestion cards; each card's
  // accessible name starts with the built-in evaluator name.
  await page.getByRole("button", { name: /^exact_match/ }).click();

  const dialog = page.getByTestId("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Create Built-in Code Evaluator" })
  ).toBeVisible();

  // The slideover prefills the name with "exact_match"; replace it. A second,
  // disabled "Name" textbox exists in the Evaluator Annotation section.
  const nameInput = dialog.getByRole("textbox", {
    name: "Name",
    disabled: false,
  });
  await nameInput.clear();
  await nameInput.fill(evaluatorName);

  // Both path mappings are required combo boxes that allow custom values.
  await page
    .getByRole("combobox", { name: "Expected path mapping" })
    .fill("input.question");
  await page
    .getByRole("combobox", { name: "Actual path mapping" })
    .fill("output.answer");

  await dialog.getByRole("button", { name: "Create" }).click();
  await expect(page.getByTestId("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("cell", { name: evaluatorName, exact: true })
  ).toBeVisible();
}

test.describe("Exploratory: Evaluators", () => {
  test("can create a built-in code evaluator from the empty-state suggestion card", async ({
    page,
  }) => {
    const datasetName = `exp-evaluators-ds-${randomUUID()}`;
    const evaluatorName = `exp-evaluators-em-${randomUUID()}`;

    await createDataset(page, datasetName);
    await gotoDatasetEvaluators(page, datasetName);
    await createExactMatchEvaluatorFromEmptyState(page, evaluatorName);

    // The new evaluator row shows the CODE kind badge.
    const evaluatorRow = page.getByRole("row").filter({
      has: page.getByRole("cell", { name: evaluatorName, exact: true }),
    });
    await expect(evaluatorRow.getByText("CODE")).toBeVisible();
  });

  test("global evaluators page filters by search and shows no-results state", async ({
    page,
  }) => {
    const datasetName = `exp-evaluators-ds-${randomUUID()}`;
    const evaluatorName = `exp-evaluators-search-${randomUUID()}`;

    await createDataset(page, datasetName);
    await gotoDatasetEvaluators(page, datasetName);
    await createExactMatchEvaluatorFromEmptyState(page, evaluatorName);

    await page.goto("/evaluators");
    await page.waitForURL("**/evaluators");

    const search = page.getByRole("searchbox", {
      name: "Search evaluators by name",
    });
    await expect(search).toBeVisible();

    // Searching by the dataset-evaluator name keeps its parent evaluator row
    // visible; expanding reveals the nested dataset evaluator link.
    await search.fill(evaluatorName);
    await page.getByRole("button", { name: "Expand all rows" }).click();
    await expect(
      page.getByRole("link", { name: evaluatorName, exact: true })
    ).toBeVisible();

    // A query that matches nothing shows the filtered empty state.
    await search.fill(`no-match-${randomUUID()}`);
    await expect(page.getByText("No results")).toBeVisible();
  });

  test("can navigate from the global evaluators table to the evaluator detail page", async ({
    page,
  }) => {
    const datasetName = `exp-evaluators-ds-${randomUUID()}`;
    const evaluatorName = `exp-evaluators-nav-${randomUUID()}`;

    await createDataset(page, datasetName);
    await gotoDatasetEvaluators(page, datasetName);
    await createExactMatchEvaluatorFromEmptyState(page, evaluatorName);

    await page.goto("/evaluators");
    await page.waitForURL("**/evaluators");

    await page
      .getByRole("searchbox", { name: "Search evaluators by name" })
      .fill(evaluatorName);
    await page.getByRole("button", { name: "Expand all rows" }).click();
    await page.getByRole("link", { name: evaluatorName, exact: true }).click();

    await page.waitForURL("**/datasets/**/evaluators/**");
    await expect(
      page.getByRole("heading", { name: `Evaluator: ${evaluatorName}` })
    ).toBeVisible();
    await expect(
      page.getByRole("tab", { name: "Configuration" })
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: "Spans" })).toBeVisible();
  });

  test("can edit a built-in code evaluator from the detail page", async ({
    page,
  }) => {
    const datasetName = `exp-evaluators-ds-${randomUUID()}`;
    const evaluatorName = `exp-evaluators-edit-${randomUUID()}`;
    const updatedDescription = `updated description ${randomUUID()}`;

    await createDataset(page, datasetName);
    await gotoDatasetEvaluators(page, datasetName);
    await createExactMatchEvaluatorFromEmptyState(page, evaluatorName);

    // Navigate to the evaluator detail page via the name link in the table.
    await page.getByRole("link", { name: evaluatorName, exact: true }).click();
    await page.waitForURL("**/datasets/**/evaluators/**");
    await expect(
      page.getByRole("heading", { name: `Evaluator: ${evaluatorName}` })
    ).toBeVisible();

    await page.getByRole("button", { name: "Edit", exact: true }).click();
    const dialog = page.getByTestId("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Edit Built-in Code Evaluator" })
    ).toBeVisible();

    const descriptionInput = dialog.getByRole("textbox", {
      name: /Description/i,
    });
    await descriptionInput.clear();
    await descriptionInput.fill(updatedDescription);
    await dialog.getByRole("button", { name: "Update" }).click();
    await expect(page.getByTestId("dialog")).not.toBeVisible();

    // The updated description is rendered on the detail page.
    await expect(page.getByText(updatedDescription)).toBeVisible();
  });

  test("can delete a dataset evaluator with confirmation", async ({ page }) => {
    const datasetName = `exp-evaluators-ds-${randomUUID()}`;
    const evaluatorName = `exp-evaluators-del-${randomUUID()}`;

    await createDataset(page, datasetName);
    await gotoDatasetEvaluators(page, datasetName);
    await createExactMatchEvaluatorFromEmptyState(page, evaluatorName);

    // Open the row actions menu (last column; the table scrolls horizontally
    // but Playwright scrolls the trigger into view automatically).
    const evaluatorRow = page.getByRole("row").filter({
      has: page.getByRole("cell", { name: evaluatorName, exact: true }),
    });
    await evaluatorRow
      .getByRole("button", { name: "Evaluator actions" })
      .click();
    await page.getByRole("menuitem", { name: "Delete" }).click();

    // Confirm in the destructive-action dialog.
    const confirmDialog = page.getByRole("dialog").filter({
      has: page.getByRole("heading", { name: "Delete Evaluator" }),
    });
    await expect(confirmDialog).toBeVisible();
    await expect(
      confirmDialog.getByText(
        `Are you sure you want to delete evaluator "${evaluatorName}"?`
      )
    ).toBeVisible();
    await confirmDialog
      .getByRole("button", { name: "Delete Evaluator" })
      .click();

    // The dataset returns to its evaluator empty state.
    await expect(
      page.getByRole("cell", { name: evaluatorName, exact: true })
    ).not.toBeVisible();
    await expect(
      page.getByText("No evaluators added to this dataset")
    ).toBeVisible();
  });
});
