import { randomUUID } from "crypto";
import { expect, test } from "@playwright/test";

/**
 * Test for issue #11923: Output column allows visual overflow if contents are very wide
 * This test verifies that long text without spaces wraps properly in the dataset Examples tab
 */
test.describe("Dataset Examples Table Overflow", () => {
  // Long string without spaces that would overflow without proper CSS handling
  const LONG_OUTPUT_NO_SPACES =
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

  test("long text without spaces wraps in dataset examples output column", async ({
    page,
    request,
  }) => {
    const datasetName = `overflow-test-${randomUUID().slice(0, 8)}`;

    // 1. Create a dataset with examples that have long output text (no spaces)
    const createDatasetResponse = await request.post(
      "/v1/datasets/upload?sync=true",
      {
        headers: {
          "Content-Type": "application/json",
        },
        data: {
          action: "create",
          name: datasetName,
          inputs: [
            { question: "What is 2+2?" },
            { question: "What is the capital of France?" },
          ],
          outputs: [
            { answer: LONG_OUTPUT_NO_SPACES },
            { answer: "Paris is the capital" },
          ],
        },
      }
    );
    expect(createDatasetResponse.ok()).toBeTruthy();

    const datasetData = await createDatasetResponse.json();
    const datasetId = datasetData.data.dataset_id;
    expect(datasetId).toBeTruthy();

    // 2. Navigate to the dataset Examples tab
    await page.goto(`/datasets/${datasetId}/examples`);
    await page.waitForURL(`**/datasets/**/examples`);

    // 3. Wait for the table to load and verify content is visible
    await expect(page.getByText("What is 2+2?").first()).toBeVisible();

    // 4. Check that the long output text is visible (it gets truncated in the cell)
    // The text should be present in the output column
    const outputCell = page.locator("td").filter({
      hasText: LONG_OUTPUT_NO_SPACES.substring(0, 50),
    });
    await expect(outputCell.first()).toBeVisible();

    // 5. Verify overflow handling by checking the cell's computed style
    // Get the bounding box of the output cell and its parent table
    const table = page.locator("table").first();
    const tableBox = await table.boundingBox();
    const cellBox = await outputCell.first().boundingBox();

    // The cell should not extend beyond the table boundaries
    // (this would happen if overflow wasn't properly handled)
    expect(tableBox).toBeTruthy();
    expect(cellBox).toBeTruthy();
    if (tableBox && cellBox) {
      // Cell's right edge should not exceed table's right edge
      const tableRightEdge = tableBox.x + tableBox.width;
      const cellRightEdge = cellBox.x + cellBox.width;
      expect(cellRightEdge).toBeLessThanOrEqual(tableRightEdge + 1); // +1 for rounding
    }
  });

  /**
   * Test for issue #16021: dataset splits overflow the splits column
   */
  test("splits that do not fit the splits column are listed behind a badge", async ({
    page,
    request,
  }) => {
    const datasetName = `split-overflow-test-${randomUUID().slice(0, 8)}`;
    const splits = [
      "criticism_of_ideas_not_people",
      "hate_generalization",
      "personal_insult",
    ];

    const createDatasetResponse = await request.post(
      "/v1/datasets/upload?sync=true",
      {
        headers: {
          "Content-Type": "application/json",
        },
        data: {
          action: "create",
          name: datasetName,
          inputs: [{ question: "Which splits?" }],
          outputs: [{ answer: "All of them" }],
          splits: [splits],
        },
      }
    );
    expect(createDatasetResponse.ok()).toBeTruthy();
    const datasetId = (await createDatasetResponse.json()).data.dataset_id;

    await page.goto(`/datasets/${datasetId}/examples`);
    await expect(page.getByText("Which splits?").first()).toBeVisible();

    // One split shows in the row; the other two sit behind the badge
    const badge = page.getByRole("button", { name: "Show 2 more" });
    await expect(badge).toBeVisible();

    // The visible split stays within its cell instead of spilling over
    const splitsCell = page.locator("td").filter({ has: badge });
    const cellBox = await splitsCell.boundingBox();
    const splitBox = await splitsCell
      .getByTitle(new RegExp(`^(${splits.join("|")})$`))
      .first()
      .boundingBox();
    expect(cellBox).toBeTruthy();
    expect(splitBox).toBeTruthy();
    if (cellBox && splitBox) {
      expect(splitBox.x + splitBox.width).toBeLessThanOrEqual(
        cellBox.x + cellBox.width + 1 // +1 for rounding
      );
    }

    // The badge lists the splits that did not fit
    await badge.click();
    const popover = page.getByRole("dialog");
    await expect(popover).toBeVisible();
    await expect(
      popover
        .getByTitle(new RegExp(`^(${splits.join("|")})$`))
        .filter({ visible: true })
    ).toHaveCount(2);
  });
});
