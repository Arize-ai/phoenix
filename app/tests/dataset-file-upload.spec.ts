import { Buffer } from "buffer";
import { randomUUID } from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.join(__dirname, "fixtures");

/**
 * Helper to click a select dropdown by its label text and return the open popover.
 * The Select component renders a Label followed by a Button trigger.
 * We find the label and then navigate to its sibling button.
 */
async function openSelectByLabel(page: Page, labelText: string) {
  // Find the label and click the adjacent button in the same field container
  const label = page.getByText(labelText, { exact: true });
  // The button is a sibling following the label in the DOM
  const fieldContainer = label.locator("xpath=..");
  const button = fieldContainer.getByRole("button");
  await button.click();

  // React Aria Select opens a popover with role="listbox"
  // Return the visible listbox so callers can select options within it
  // Wait for the listbox associated with this button (aria-controls)
  const listboxId = await button.getAttribute("aria-controls");
  if (listboxId) {
    return page.locator(`#${listboxId}`);
  }
  // Fallback: return the first visible listbox
  return page.getByRole("listbox").first();
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

      // Verify the CSV columns are detected and shown in the input keys selector
      // The column selectors should now be visible
      await expect(dialog.getByText("Input keys")).toBeVisible();

      // Open the input keys dropdown and verify columns are available
      const inputKeysListbox = await openSelectByLabel(page, "Input keys");
      await expect(
        inputKeysListbox.getByRole("option", { name: "input" })
      ).toBeVisible();
      await expect(
        inputKeysListbox.getByRole("option", { name: "output" })
      ).toBeVisible();
      await expect(
        inputKeysListbox.getByRole("option", { name: "metadata" })
      ).toBeVisible();

      // Select input column
      await inputKeysListbox.getByRole("option", { name: "input" }).click();
      // Close dropdown by pressing Escape
      await page.keyboard.press("Escape");

      // Verify the dataset name was auto-populated from filename
      await expect(page.getByLabel("Dataset Name")).toHaveValue("simple");

      // Change to a unique name before creating (to avoid conflicts with other test runs)
      await page.getByLabel("Dataset Name").clear();
      await page.getByLabel("Dataset Name").fill(datasetName);

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

      // Open input keys dropdown and verify quoted column names are parsed correctly
      const inputKeysListbox = await openSelectByLabel(page, "Input keys");

      // The column "Question, Full" should be parsed as a single column (not split on comma)
      await expect(
        inputKeysListbox.getByRole("option", { name: "Question, Full" })
      ).toBeVisible();
      await expect(
        inputKeysListbox.getByRole("option", { name: "Answer" })
      ).toBeVisible();
      await expect(
        inputKeysListbox.getByRole("option", { name: "Category, Type" })
      ).toBeVisible();
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

      // Verify the keys are detected
      await expect(dialog.getByText("Input keys")).toBeVisible();

      // Open the input keys dropdown and verify keys are available
      const inputKeysListbox = await openSelectByLabel(page, "Input keys");
      await expect(
        inputKeysListbox.getByRole("option", { name: "input" })
      ).toBeVisible();
      await expect(
        inputKeysListbox.getByRole("option", { name: "output" })
      ).toBeVisible();
      await expect(
        inputKeysListbox.getByRole("option", { name: "metadata" })
      ).toBeVisible();
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

      // Open input keys dropdown
      const inputKeysListbox = await openSelectByLabel(page, "Input keys");

      // Should see all unique keys from all rows
      await expect(
        inputKeysListbox.getByRole("option", { name: "question" })
      ).toBeVisible();
      await expect(
        inputKeysListbox.getByRole("option", { name: "answer" })
      ).toBeVisible();
      await expect(
        inputKeysListbox.getByRole("option", { name: "category" })
      ).toBeVisible();
      await expect(
        inputKeysListbox.getByRole("option", { name: "language" })
      ).toBeVisible();
    });
  });

  test.describe("Column Selectors", () => {
    test("column selectors are disabled until file is uploaded", async ({
      page,
    }) => {
      await page.goto("/datasets");
      await page.waitForURL("**/datasets");

      await page.getByRole("button", { name: "New Dataset" }).click();
      await expect(
        page.getByRole("heading", { name: "Create Dataset" })
      ).toBeVisible();

      // Column selectors should be visible but disabled before file upload
      await expect(page.getByText("Input keys")).toBeVisible();
      await expect(page.getByText("Output keys")).toBeVisible();

      // The select buttons should be disabled
      const dialog = page.getByTestId("dialog");
      const inputKeysButton = dialog
        .locator("label", { hasText: "Input keys" })
        .locator("xpath=..")
        .getByRole("button");
      await expect(inputKeysButton).toBeDisabled();

      // Upload a file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(path.join(FIXTURES_DIR, "simple.csv"));

      // Wait for file to be processed
      await expect(dialog.getByText("simple.csv")).toBeVisible();

      // Now column selectors should be enabled
      await expect(inputKeysButton).toBeEnabled();
    });
  });

  test.describe("Full Upload Flow", () => {
    test("can upload CSV, configure keys, and create dataset", async ({
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
      await page.getByLabel("Dataset Name").clear();
      await page.getByLabel("Dataset Name").fill(datasetName);

      // Select input key
      const inputKeysListbox = await openSelectByLabel(page, "Input keys");
      await inputKeysListbox.getByRole("option", { name: "input" }).click();
      await page.keyboard.press("Escape");

      // Select output key
      const outputKeysListbox = await openSelectByLabel(page, "Output keys");
      await outputKeysListbox.getByRole("option", { name: "output" }).click();
      await page.keyboard.press("Escape");

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
      await page.getByLabel("Dataset Name").clear();
      await page.getByLabel("Dataset Name").fill(datasetName);

      // Select input key
      const inputKeysListbox2 = await openSelectByLabel(page, "Input keys");
      await inputKeysListbox2.getByRole("option", { name: "input" }).click();
      await page.keyboard.press("Escape");

      // Select output key
      const outputKeysListbox2 = await openSelectByLabel(page, "Output keys");
      await outputKeysListbox2.getByRole("option", { name: "output" }).click();
      await page.keyboard.press("Escape");

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

      // Verify columns were extracted correctly
      await expect(dialog.getByText("Input keys")).toBeVisible({
        timeout: 5000,
      });

      const inputKeysListbox = await openSelectByLabel(page, "Input keys");
      await expect(
        inputKeysListbox.getByRole("option", { name: "id" })
      ).toBeVisible();
      await expect(
        inputKeysListbox.getByRole("option", { name: "name" })
      ).toBeVisible();
      await expect(
        inputKeysListbox.getByRole("option", { name: "email" })
      ).toBeVisible();
      await expect(
        inputKeysListbox.getByRole("option", { name: "description" })
      ).toBeVisible();
      await expect(
        inputKeysListbox.getByRole("option", { name: "created_at" })
      ).toBeVisible();
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

      // Verify keys were extracted correctly
      await expect(dialog.getByText("Input keys")).toBeVisible({
        timeout: 5000,
      });

      const inputKeysListbox = await openSelectByLabel(page, "Input keys");
      await expect(
        inputKeysListbox.getByRole("option", { name: "id" })
      ).toBeVisible();
      await expect(
        inputKeysListbox.getByRole("option", { name: "question" })
      ).toBeVisible();
      await expect(
        inputKeysListbox.getByRole("option", { name: "answer" })
      ).toBeVisible();
      await expect(
        inputKeysListbox.getByRole("option", { name: "context" })
      ).toBeVisible();
      await expect(
        inputKeysListbox.getByRole("option", { name: "metadata" })
      ).toBeVisible();
    });
  });
});
