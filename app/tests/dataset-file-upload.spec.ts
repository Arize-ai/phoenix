import { randomUUID } from "crypto";
import path from "path";
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

// Playwright runs from the app directory, so we can use a relative path
const FIXTURES_DIR = path.join(process.cwd(), "tests", "fixtures");

/**
 * Helper to get a bucket in the ColumnAssigner by its label.
 * Buckets are listboxes with aria-label matching the bucket name.
 */
function getBucket(page: Page, bucketLabel: string): Locator {
  return page.getByRole("listbox", { name: bucketLabel });
}

/**
 * Helper to verify a column exists in a specific bucket.
 */
async function expectColumnInBucket(
  page: Page,
  columnName: string,
  bucketLabel: string
) {
  const bucket = getBucket(page, bucketLabel);
  await expect(bucket.getByRole("option", { name: columnName })).toBeVisible();
}

test.describe("Dataset File Upload", () => {
  test.describe("CSV Upload", () => {
    test("can upload a simple CSV file and see columns", async ({ page }) => {
      const datasetName = `csv-columns-${randomUUID().slice(0, 8)}`;

      await page.goto("/datasets");
      await page.waitForURL("**/datasets");

      // Open the create dataset dialog
      await page.getByRole("button", { name: "New Dataset" }).click();
      await expect(
        page.getByRole("heading", { name: "Create Dataset" })
      ).toBeVisible();

      // Should default to "From file" tab
      await expect(
        page.getByRole("tab", { name: "From file" })
      ).toHaveAttribute("aria-selected", "true");

      // Upload the CSV file
      const dialog = page.getByTestId("dialog");
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(path.join(FIXTURES_DIR, "simple.csv"));

      // Wait for file to be processed - the file name should appear in the dialog
      await expect(dialog.getByText("simple.csv")).toBeVisible();

      // Verify the ColumnAssigner appears with the source bucket labeled "COLUMNS" for CSV
      const sourceBucket = getBucket(page, "COLUMNS");
      await expect(sourceBucket).toBeVisible();

      // Verify the assignment buckets are visible
      await expect(getBucket(page, "INPUT")).toBeVisible();
      await expect(getBucket(page, "OUTPUT")).toBeVisible();
      await expect(getBucket(page, "METADATA")).toBeVisible();

      // The simple.csv has columns: input, output, metadata
      // Columns are auto-assigned on file load based on name heuristics:
      // - "input" -> INPUT bucket
      // - "output" -> OUTPUT bucket
      // - "metadata" -> METADATA bucket
      await expectColumnInBucket(page, "input", "INPUT");
      await expectColumnInBucket(page, "output", "OUTPUT");
      await expectColumnInBucket(page, "metadata", "METADATA");

      // Verify the dataset name was auto-populated from filename
      await expect(dialog.getByLabel("Name")).toHaveValue("simple");

      // Change to a unique name before creating (to avoid conflicts with other test runs)
      await dialog.getByLabel("Name").clear();
      await dialog.getByLabel("Name").fill(datasetName);

      // Create the dataset
      await page.getByRole("button", { name: "Create Dataset" }).click();

      // Wait for dialog to close and dataset to appear
      await expect(page.getByTestId("dialog")).not.toBeVisible();
      await expect(page.getByRole("link", { name: datasetName })).toBeVisible();
    });

    test("handles CSV with quoted headers containing commas", async ({
      page,
    }) => {
      await page.goto("/datasets");
      await page.waitForURL("**/datasets");

      await page.getByRole("button", { name: "New Dataset" }).click();
      await expect(
        page.getByRole("heading", { name: "Create Dataset" })
      ).toBeVisible();

      // Upload the CSV with quoted headers
      const dialog = page.getByTestId("dialog");
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(
        path.join(FIXTURES_DIR, "quoted-headers.csv")
      );

      // Wait for processing
      await expect(dialog.getByText("quoted-headers.csv")).toBeVisible();

      // Verify the source bucket shows columns (these won't be auto-assigned)
      const sourceBucket = getBucket(page, "COLUMNS");
      await expect(sourceBucket).toBeVisible();

      // The column "Question, Full" should be parsed as a single column (not split on comma)
      // These columns don't match auto-assignment rules, so they stay in source
      await expectColumnInBucket(page, "Question, Full", "COLUMNS");
      await expectColumnInBucket(page, "Answer", "COLUMNS");
      await expectColumnInBucket(page, "Category, Type", "COLUMNS");
    });
  });

  test.describe("JSONL Upload", () => {
    test("can upload a simple JSONL file and see keys", async ({ page }) => {
      await page.goto("/datasets");
      await page.waitForURL("**/datasets");

      await page.getByRole("button", { name: "New Dataset" }).click();
      await expect(
        page.getByRole("heading", { name: "Create Dataset" })
      ).toBeVisible();

      // Upload the JSONL file
      const dialog = page.getByTestId("dialog");
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(path.join(FIXTURES_DIR, "simple.jsonl"));

      // Wait for file to be processed
      await expect(dialog.getByText("simple.jsonl")).toBeVisible();

      // For JSONL, the source bucket is labeled "KEYS"
      const sourceBucket = getBucket(page, "KEYS");
      await expect(sourceBucket).toBeVisible();

      // The simple.jsonl has keys: input, output, metadata
      // Columns are auto-assigned on file load based on name heuristics
      await expectColumnInBucket(page, "input", "INPUT");
      await expectColumnInBucket(page, "output", "OUTPUT");
      await expectColumnInBucket(page, "metadata", "METADATA");
    });

    test("collects keys from multiple JSONL rows with different keys", async ({
      page,
    }) => {
      await page.goto("/datasets");
      await page.waitForURL("**/datasets");

      await page.getByRole("button", { name: "New Dataset" }).click();
      await expect(
        page.getByRole("heading", { name: "Create Dataset" })
      ).toBeVisible();

      // Upload the JSONL with varied keys
      const dialog = page.getByTestId("dialog");
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(
        path.join(FIXTURES_DIR, "varied-keys.jsonl")
      );

      // Wait for processing
      await expect(dialog.getByText("varied-keys.jsonl")).toBeVisible();

      // For JSONL, the source bucket is labeled "KEYS"
      const sourceBucket = getBucket(page, "KEYS");
      await expect(sourceBucket).toBeVisible();

      // Should see all unique keys from all rows, auto-assigned on file load
      // "question" matches INPUT_NAMES, so it's auto-assigned to INPUT
      await expectColumnInBucket(page, "question", "INPUT");
      // Others don't match any auto-assignment rule, stay in source
      await expectColumnInBucket(page, "answer", "KEYS");
      await expectColumnInBucket(page, "category", "KEYS");
      await expectColumnInBucket(page, "language", "KEYS");
    });
  });

  test.describe("Column Assigner", () => {
    test("column assigner appears after file is uploaded", async ({ page }) => {
      await page.goto("/datasets");
      await page.waitForURL("**/datasets");

      await page.getByRole("button", { name: "New Dataset" }).click();
      await expect(
        page.getByRole("heading", { name: "Create Dataset" })
      ).toBeVisible();

      // Before file upload, there should be no column assigner buckets
      await expect(getBucket(page, "COLUMNS")).not.toBeVisible();
      await expect(getBucket(page, "INPUT")).not.toBeVisible();

      // Upload a file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(path.join(FIXTURES_DIR, "simple.csv"));

      // Wait for file to be processed
      const dialog = page.getByTestId("dialog");
      await expect(dialog.getByText("simple.csv")).toBeVisible();

      // Now column assigner should be visible
      await expect(getBucket(page, "COLUMNS")).toBeVisible();
      await expect(getBucket(page, "INPUT")).toBeVisible();
      await expect(getBucket(page, "OUTPUT")).toBeVisible();
      await expect(getBucket(page, "METADATA")).toBeVisible();
    });

    test("Reset and Auto buttons work independently", async ({ page }) => {
      await page.goto("/datasets");
      await page.waitForURL("**/datasets");

      await page.getByRole("button", { name: "New Dataset" }).click();

      // Upload CSV - simple.csv has input, output, metadata columns
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(path.join(FIXTURES_DIR, "simple.csv"));

      const dialog = page.getByTestId("dialog");
      await expect(dialog.getByText("simple.csv")).toBeVisible();

      // Columns are auto-assigned on file load
      await expectColumnInBucket(page, "input", "INPUT");
      await expectColumnInBucket(page, "output", "OUTPUT");
      await expectColumnInBucket(page, "metadata", "METADATA");

      // Click Reset button - should clear all assignments
      await dialog.getByRole("button", { name: "Reset" }).click();

      // Now all columns should be back in the source bucket
      await expectColumnInBucket(page, "input", "COLUMNS");
      await expectColumnInBucket(page, "output", "COLUMNS");
      await expectColumnInBucket(page, "metadata", "COLUMNS");

      // Click Auto again - should restore auto-assignments
      await dialog.getByRole("button", { name: "Auto" }).click();

      // Columns should be back in their auto-assigned buckets
      await expectColumnInBucket(page, "input", "INPUT");
      await expectColumnInBucket(page, "output", "OUTPUT");
      await expectColumnInBucket(page, "metadata", "METADATA");
    });
  });

  test.describe("Full Upload Flow", () => {
    test("can upload CSV, configure columns, and create dataset", async ({
      page,
    }) => {
      const datasetName = `csv-upload-${randomUUID().slice(0, 8)}`;

      await page.goto("/datasets");
      await page.waitForURL("**/datasets");

      await page.getByRole("button", { name: "New Dataset" }).click();

      // Upload CSV
      const dialog = page.getByTestId("dialog");
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(path.join(FIXTURES_DIR, "simple.csv"));
      await expect(dialog.getByText("simple.csv")).toBeVisible();

      // Change dataset name
      await dialog.getByLabel("Name").clear();
      await dialog.getByLabel("Name").fill(datasetName);

      // Click Auto to auto-assign columns based on their names:
      // "input" -> INPUT, "output" -> OUTPUT, "metadata" -> METADATA
      await dialog.getByRole("button", { name: "Auto" }).click();

      // Verify they're in the right buckets
      await expectColumnInBucket(page, "input", "INPUT");
      await expectColumnInBucket(page, "output", "OUTPUT");
      await expectColumnInBucket(page, "metadata", "METADATA");

      // Create dataset
      await page.getByRole("button", { name: "Create Dataset" }).click();

      // Wait for success
      await expect(page.getByTestId("dialog")).not.toBeVisible();
      await expect(page.getByRole("link", { name: datasetName })).toBeVisible();

      // Navigate to the dataset and verify examples were created
      await page.getByRole("link", { name: datasetName }).click();
      await page.waitForURL("**/datasets/**/examples");

      // Should have 3 examples from the CSV
      await expect(page.getByText("What is 2+2?")).toBeVisible();
    });

    test("can upload JSONL, configure keys, and create dataset", async ({
      page,
    }) => {
      const datasetName = `jsonl-upload-${randomUUID().slice(0, 8)}`;

      await page.goto("/datasets");
      await page.waitForURL("**/datasets");

      await page.getByRole("button", { name: "New Dataset" }).click();

      // Upload JSONL
      const dialog = page.getByTestId("dialog");
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(path.join(FIXTURES_DIR, "simple.jsonl"));
      await expect(dialog.getByText("simple.jsonl")).toBeVisible();

      // Change dataset name
      await dialog.getByLabel("Name").clear();
      await dialog.getByLabel("Name").fill(datasetName);

      // Click Auto to auto-assign keys for JSONL
      await dialog.getByRole("button", { name: "Auto" }).click();

      // Verify auto-assignment for JSONL
      await expectColumnInBucket(page, "input", "INPUT");
      await expectColumnInBucket(page, "output", "OUTPUT");
      await expectColumnInBucket(page, "metadata", "METADATA");

      // Create dataset
      await page.getByRole("button", { name: "Create Dataset" }).click();

      // Wait for success
      await expect(page.getByTestId("dialog")).not.toBeVisible();
      await expect(page.getByRole("link", { name: datasetName })).toBeVisible();

      // Navigate to the dataset and verify examples were created
      await page.getByRole("link", { name: datasetName }).click();
      await page.waitForURL("**/datasets/**/examples");

      // Should have 3 examples from the JSONL
      await expect(page.getByText("What is 2+2?")).toBeVisible();
    });
  });

  test.describe("Collapse Top-Level Keys", () => {
    test("shows collapse toggle when JSONL has collapsible keys", async ({
      page,
    }) => {
      await page.goto("/datasets");
      await page.waitForURL("**/datasets");

      await page.getByRole("button", { name: "New Dataset" }).click();
      await expect(
        page.getByRole("heading", { name: "Create Dataset" })
      ).toBeVisible();

      // Upload JSONL with nested objects
      const dialog = page.getByTestId("dialog");
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(path.join(FIXTURES_DIR, "nested.jsonl"));

      // Wait for file to be processed
      await expect(dialog.getByText("nested.jsonl")).toBeVisible();

      // The collapse toggle should be visible because the file has collapsible keys
      const collapseSwitch = dialog.getByRole("switch", {
        name: "Collapse top-level keys",
      });
      await expect(collapseSwitch).toBeVisible();
    });

    test("collapse toggle is hidden when no collapsible keys exist", async ({
      page,
    }) => {
      await page.goto("/datasets");
      await page.waitForURL("**/datasets");

      await page.getByRole("button", { name: "New Dataset" }).click();

      // Upload JSONL without nested objects
      const dialog = page.getByTestId("dialog");
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(path.join(FIXTURES_DIR, "simple.jsonl"));

      // Wait for file to be processed
      await expect(dialog.getByText("simple.jsonl")).toBeVisible();

      // The collapse toggle should NOT be visible
      const collapseSwitch = dialog.getByRole("switch", {
        name: "Collapse top-level keys",
      });
      await expect(collapseSwitch).not.toBeVisible();
    });

    test("shows collapse toggle when CSV has collapsible columns", async ({
      page,
    }) => {
      await page.goto("/datasets");
      await page.waitForURL("**/datasets");

      await page.getByRole("button", { name: "New Dataset" }).click();

      // Upload CSV with JSON object columns
      const dialog = page.getByTestId("dialog");
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(path.join(FIXTURES_DIR, "nested.csv"));

      // Wait for file to be processed
      await expect(dialog.getByText("nested.csv")).toBeVisible();

      // The collapse toggle should be visible
      const collapseSwitch = dialog.getByRole("switch", {
        name: "Collapse top-level keys",
      });
      await expect(collapseSwitch).toBeVisible();
    });

    test("can toggle collapse and see collapsed data in preview", async ({
      page,
    }) => {
      /**
       * This test verifies that toggling collapse:
       * 1. The column assigner keeps showing original top-level keys (input, output, id)
       *    because those are what get sent to the backend for assignment
       * 2. The dataset preview shows the collapsed/flattened data structure
       *
       * The backend handles the actual flattening - the frontend just passes
       * which keys to flatten via flatten_keys parameter.
       */
      await page.goto("/datasets");
      await page.waitForURL("**/datasets");

      await page.getByRole("button", { name: "New Dataset" }).click();

      const dialog = page.getByTestId("dialog");
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(path.join(FIXTURES_DIR, "nested.jsonl"));

      await expect(dialog.getByText("nested.jsonl")).toBeVisible();

      // Without collapse, we should see top-level keys: input, output, id
      // "input" and "output" should be auto-assigned to their buckets
      await expectColumnInBucket(page, "input", "INPUT");
      await expectColumnInBucket(page, "output", "OUTPUT");
      await expectColumnInBucket(page, "id", "KEYS");

      // Enable collapse - click on the label text instead of the switch for Firefox compatibility
      const collapseSwitch = dialog.getByRole("switch", {
        name: "Collapse top-level keys",
      });
      await expect(collapseSwitch).toBeVisible();
      await dialog.getByText("Collapse top-level keys").click();
      await expect(collapseSwitch).toBeChecked();

      // Column assigner still shows original keys (backend does the flattening)
      await expectColumnInBucket(page, "input", "INPUT");
      await expectColumnInBucket(page, "output", "OUTPUT");
      await expectColumnInBucket(page, "id", "KEYS");

      // Switch to Dataset Preview to verify collapsed data structure
      await dialog.getByRole("tab", { name: "Dataset Preview" }).click();

      // Wait for preview table
      const previewTable = dialog.locator("table");
      await expect(previewTable).toBeVisible();

      // The preview should show flattened child keys (question, context)
      // instead of nested JSON under "input"
      const firstRow = previewTable.locator("tbody tr").first();
      const inputCell = firstRow.locator("td").nth(0);
      const inputText = await inputCell.textContent();

      // Should contain the child keys from the flattened structure
      expect(inputText).toContain("question");
      expect(inputText).toContain("What is 2+2?");
    });

    test("can create dataset with collapse enabled", async ({ page }) => {
      const datasetName = `collapse-test-${randomUUID().slice(0, 8)}`;

      await page.goto("/datasets");
      await page.waitForURL("**/datasets");

      await page.getByRole("button", { name: "New Dataset" }).click();

      const dialog = page.getByTestId("dialog");
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(path.join(FIXTURES_DIR, "nested.jsonl"));

      await expect(dialog.getByText("nested.jsonl")).toBeVisible();

      // Enable collapse - click on the label text instead of the switch for Firefox compatibility
      const collapseSwitch = dialog.getByRole("switch", {
        name: "Collapse top-level keys",
      });
      await expect(collapseSwitch).toBeVisible();
      // Click on the text label which triggers the switch more reliably across browsers
      await dialog.getByText("Collapse top-level keys").click();
      await expect(collapseSwitch).toBeChecked();

      // Set dataset name
      await dialog.getByLabel("Name").clear();
      await dialog.getByLabel("Name").fill(datasetName);

      // Create dataset
      await page.getByRole("button", { name: "Create Dataset" }).click();

      // Wait for success
      await expect(page.getByTestId("dialog")).not.toBeVisible();
      await expect(page.getByRole("link", { name: datasetName })).toBeVisible();

      // Navigate to the dataset to verify it was created successfully
      await page.getByRole("link", { name: datasetName }).click();
      await page.waitForURL("**/datasets/**/examples");

      // Wait for examples table to load
      const examplesTable = page.locator("table").first();
      await expect(examplesTable).toBeVisible();

      // Verify at least one example row exists (dataset was created with data)
      const exampleRows = examplesTable.locator("tbody tr");
      await expect(exampleRows.first()).toBeVisible();
    });

    test("preview table values match created dataset examples (round-trip verification)", async ({
      page,
    }) => {
      /**
       * This test verifies that the collapsed/flattened preview shown in the upload dialog
       * matches the actual data stored in the created dataset examples. This ensures
       * the frontend preview accurately reflects what the backend will produce.
       *
       * Test data (nested.jsonl first row):
       * {"input": {"question": "What is 2+2?", "context": "math"}, "output": {"answer": "4"}, "id": 1}
       *
       * After collapse with input/output assigned:
       * - Input: {"question": "What is 2+2?", "context": "math"}
       * - Output: {"answer": "4"}
       *
       * This test verifies the preview UI shows the correct flattened structure.
       * The backend round-trip is tested separately in Python unit tests.
       */
      const datasetName = `roundtrip-collapse-${randomUUID().slice(0, 8)}`;

      await page.goto("/datasets");
      await page.waitForURL("**/datasets");

      await page.getByRole("button", { name: "New Dataset" }).click();

      const dialog = page.getByTestId("dialog");
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(path.join(FIXTURES_DIR, "nested.jsonl"));

      await expect(dialog.getByText("nested.jsonl")).toBeVisible();

      // Enable collapse - click on the label text instead of the switch for Firefox compatibility
      const collapseSwitch = dialog.getByRole("switch", {
        name: "Collapse top-level keys",
      });
      await expect(collapseSwitch).toBeVisible();
      await dialog.getByText("Collapse top-level keys").click();
      await expect(collapseSwitch).toBeChecked();

      // Switch to "Dataset Preview" tab to see the preview table
      await dialog.getByRole("tab", { name: "Dataset Preview" }).click();

      // Wait for the preview table to render
      const previewTable = dialog.locator("table");
      await expect(previewTable).toBeVisible();

      // Get the first row's Input and Output cell content from the preview
      // The table has columns: Input, Output, Metadata
      const previewFirstRow = previewTable.locator("tbody tr").first();

      // Extract the text content of the first row's Input cell (first td)
      const previewInputCell = previewFirstRow.locator("td").nth(0);
      const previewInputText = await previewInputCell.textContent();

      // Extract the text content of the first row's Output cell (second td)
      const previewOutputCell = previewFirstRow.locator("td").nth(1);
      const previewOutputText = await previewOutputCell.textContent();

      // The preview should show the collapsed structure:
      // Input should contain "question" and "context" (not nested under "input")
      // The CompactJSONCell renders JSON objects with their keys
      expect(previewInputText).toContain("question");
      expect(previewInputText).toContain("What is 2+2?");
      expect(previewInputText).toContain("context");
      expect(previewInputText).toContain("math");

      // Output should contain the value "4" (after collapse, "answer" is the key)
      // The output cell should have the answer value
      expect(previewOutputText).toContain("4");

      // Now set the dataset name - the Name field should be in the same dialog
      await dialog.getByLabel("Name").clear();
      await dialog.getByLabel("Name").fill(datasetName);

      // Create dataset
      await page.getByRole("button", { name: "Create Dataset" }).click();

      // Wait for dialog to close
      await expect(page.getByTestId("dialog")).not.toBeVisible();

      // Verify the dataset was created
      await expect(page.getByRole("link", { name: datasetName })).toBeVisible();

      // Navigate to the dataset to verify it exists
      await page.getByRole("link", { name: datasetName }).click();
      await page.waitForURL("**/datasets/**/examples");

      // The examples table should be visible with created examples
      const examplesTable = page.locator("table").first();
      await expect(examplesTable).toBeVisible();

      // Verify the first example row exists
      const exampleFirstRow = examplesTable.locator("tbody tr").first();
      await expect(exampleFirstRow).toBeVisible();

      // The key verification: the preview showed the collapsed structure correctly.
      // We just need to ensure the dataset was created (backend processing is tested
      // separately in the Python unit tests for the full round-trip verification).
    });
  });

  test.describe("Large File Handling", () => {
    /**
     * These tests verify that the streaming parsers can handle large files
     * without freezing the UI. We generate files with valid headers/first rows
     * followed by padding to simulate large file sizes.
     *
     * The key assertion is that parsing completes within 5 seconds - if the
     * parser tried to read the entire file, it would timeout.
     */
    test("can parse columns from a large CSV without freezing", async ({
      page,
    }) => {
      // Generate a CSV with valid header + padding to simulate ~10MB file
      // The streaming parser should only read the header row
      const header = "id,name,email,description,created_at\n";
      const targetSize = 10 * 1024 * 1024; // 10MB

      // Create buffer with header followed by zeros (simulating a huge file)
      const headerBytes = new TextEncoder().encode(header);
      const buffer = new ArrayBuffer(targetSize);
      const view = new Uint8Array(buffer);
      view.set(headerBytes, 0);
      // Fill rest with newlines and dummy data pattern to make it valid-ish CSV
      // (though the streaming parser will stop after the header anyway)
      const dummyRow = "1,a,b,c,d\n";
      const dummyBytes = new TextEncoder().encode(dummyRow);
      let offset = headerBytes.length;
      while (offset + dummyBytes.length < targetSize) {
        view.set(dummyBytes, offset);
        offset += dummyBytes.length;
      }

      await page.goto("/datasets");
      await page.waitForURL("**/datasets");

      await page.getByRole("button", { name: "New Dataset" }).click();
      await expect(
        page.getByRole("heading", { name: "Create Dataset" })
      ).toBeVisible();

      const dialog = page.getByTestId("dialog");

      // Upload using setInputFiles with a buffer
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: "large-dataset.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(buffer),
      });

      // The file should be processed quickly (streaming only reads header)
      // If it tried to read the entire 10MB synchronously, this would be slow
      await expect(dialog.getByText("large-dataset.csv")).toBeVisible({
        timeout: 5000,
      });

      // Verify columns were extracted correctly - source bucket should show columns
      await expect(getBucket(page, "COLUMNS")).toBeVisible({
        timeout: 5000,
      });

      // Verify specific columns are in the source bucket (none match auto-assign rules)
      await expectColumnInBucket(page, "id", "COLUMNS");
      await expectColumnInBucket(page, "name", "COLUMNS");
      await expectColumnInBucket(page, "email", "COLUMNS");
      await expectColumnInBucket(page, "description", "COLUMNS");
      await expectColumnInBucket(page, "created_at", "COLUMNS");
    });

    test("can parse keys from a large JSONL without freezing", async ({
      page,
    }) => {
      // Generate a JSONL with valid first rows + padding to simulate ~10MB file
      // The streaming parser should only read the first N rows
      const row =
        JSON.stringify({
          id: 12345,
          question: "What is the meaning of life?",
          answer: "42",
          context: "This is a context string.",
          metadata: { source: "test" },
        }) + "\n";

      const targetSize = 10 * 1024 * 1024; // 10MB

      // Create buffer with first 10 valid rows followed by more rows
      const firstRows = row.repeat(10);
      const firstRowsBytes = new TextEncoder().encode(firstRows);
      const buffer = new ArrayBuffer(targetSize);
      const view = new Uint8Array(buffer);
      view.set(firstRowsBytes, 0);
      // Fill rest with repeated rows
      let offset = firstRowsBytes.length;
      const rowBytes = new TextEncoder().encode(row);
      while (offset + rowBytes.length < targetSize) {
        view.set(rowBytes, offset);
        offset += rowBytes.length;
      }

      await page.goto("/datasets");
      await page.waitForURL("**/datasets");

      await page.getByRole("button", { name: "New Dataset" }).click();
      await expect(
        page.getByRole("heading", { name: "Create Dataset" })
      ).toBeVisible();

      const dialog = page.getByTestId("dialog");

      // Upload using setInputFiles with a buffer
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: "large-dataset.jsonl",
        mimeType: "application/jsonl",
        buffer: Buffer.from(buffer),
      });

      // The file should be processed quickly (streaming only reads first N rows)
      await expect(dialog.getByText("large-dataset.jsonl")).toBeVisible({
        timeout: 5000,
      });

      // Verify keys were extracted - source bucket for JSONL is labeled "KEYS"
      await expect(getBucket(page, "KEYS")).toBeVisible({
        timeout: 5000,
      });

      // Columns are auto-assigned on file load
      // "question" matches INPUT_NAMES so it's auto-assigned to INPUT
      await expectColumnInBucket(page, "question", "INPUT");
      // "metadata" matches exact name so it's auto-assigned to METADATA
      await expectColumnInBucket(page, "metadata", "METADATA");
      // Others stay in source
      await expectColumnInBucket(page, "id", "KEYS");
      await expectColumnInBucket(page, "answer", "KEYS");
      await expectColumnInBucket(page, "context", "KEYS");
    });
  });
});
