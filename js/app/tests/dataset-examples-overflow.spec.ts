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
});
