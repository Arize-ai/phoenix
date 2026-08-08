import { randomUUID } from "crypto";
import { expect, test, type Page } from "@playwright/test";

/**
 * Creates a prompt through the playground "Save prompt" flow (the only way
 * to create a prompt through the UI) and returns to the prompts listing.
 */
async function createPromptViaPlayground(
  page: Page,
  promptName: string,
  description: string
) {
  // The playground is the heaviest page in the app; wait for the document
  // rather than every subresource so a fully parallel run doesn't exceed the
  // navigation timeout. The assertions below still gate on real readiness.
  await page.goto("/playground", { waitUntil: "domcontentloaded" });
  await page.waitForURL("**/playground");
  await page.getByRole("button", { name: "Save Prompt" }).click();
  await page.getByPlaceholder("Select or enter new prompt").click();
  await page.getByPlaceholder("Select or enter new prompt").fill(promptName);
  await page.getByLabel("Description (optional)").fill(description);
  await page.getByRole("button", { name: "Create Prompt" }).click();
  await expect(page).toHaveURL(/promptId=/);
}

/**
 * Applies the name filter to the prompts listing and waits for the prompt's
 * row. The table hydrates after its route query resolves and can reset the
 * controlled search input, so the filter is re-applied until it sticks.
 */
async function filterPromptsByName(page: Page, promptName: string) {
  const search = page.getByPlaceholder("Search prompts by name");
  // The listing can be slow to render when the suite runs fully parallel
  // against a single server.
  await expect(search).toBeVisible({ timeout: 30_000 });
  await expect(async () => {
    await search.fill(promptName);
    await expect(search).toHaveValue(promptName);
    await expect(
      page.getByRole("link", { name: promptName, exact: true })
    ).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 25000 });
}

/**
 * Opens a prompt's detail page from the listing. The listing is paginated and
 * parallel workers create prompts concurrently, so filter by name first
 * rather than assuming the prompt is on the first page.
 */
async function gotoPromptDetail(page: Page, promptName: string) {
  await page.goto("/prompts");
  await page.waitForURL("**/prompts");
  await filterPromptsByName(page, promptName);
  await page.getByRole("link", { name: promptName, exact: true }).click();
  await page.waitForURL(/\/prompts\/.+/);
  await expect(page.getByRole("heading", { name: promptName })).toBeVisible();
}

function promptRow(page: Page, promptName: string) {
  return page.getByRole("row").filter({
    has: page.getByRole("link", { name: promptName, exact: true }),
  });
}

test.describe("Prompts exploratory", () => {
  test("can filter the prompts table by name search", async ({ page }) => {
    const promptName = `exp-prompts-search-${randomUUID()}`;
    await createPromptViaPlayground(page, promptName, "search test prompt");

    await page.goto("/prompts");
    await page.waitForURL("**/prompts");

    const search = page.getByPlaceholder("Search prompts by name");
    await search.fill(promptName);

    // Only the matching prompt row should remain
    await expect(promptRow(page, promptName)).toBeVisible();
    await expect(
      page.getByRole("row").filter({ has: page.locator("td") })
    ).toHaveCount(1);

    // A non-matching search should hide the row
    await search.fill(`${promptName}-no-match`);
    await expect(promptRow(page, promptName)).not.toBeVisible();
  });

  test("can create a version tag from the versions tab and delete it from the config tab", async ({
    page,
  }) => {
    const promptName = `exp-prompts-tag-${randomUUID()}`;
    const tagName = `exp-tag-${randomUUID().slice(0, 8)}`;
    await createPromptViaPlayground(page, promptName, "version tag prompt");

    await gotoPromptDetail(page, promptName);

    // Open the versions tab and the tag popover
    await page.getByRole("tab", { name: "versions" }).click();
    await expect(page.getByRole("heading", { name: "Version" })).toBeVisible();
    await page.getByRole("button", { name: "Tag Version" }).click();
    await page.getByRole("button", { name: "New Tag" }).click();

    // Fill out the new tag dialog. The "Tag Version" popover is also a
    // role=dialog, so scope to the modal that owns the New Prompt Tag form.
    const dialog = page
      .getByTestId("dialog")
      .filter({ has: page.getByRole("heading", { name: "New Prompt Tag" }) });
    await expect(
      dialog.getByRole("heading", { name: "New Prompt Tag" })
    ).toBeVisible();
    await dialog.getByRole("textbox", { name: "Tag Name" }).fill(tagName);
    await dialog
      .getByRole("textbox", { name: "Description" })
      .fill("an exploratory tag");
    await dialog.getByRole("button", { name: "Create Tag" }).click();
    await expect(dialog).not.toBeVisible();

    // The new tag should appear on the version in the version list
    await expect(page.getByText(tagName).first()).toBeVisible();

    // The config tab lists the tag with its description and allows deletion.
    // NOTE: the Tags table renders from a cached query and shows "No Tags"
    // until reloaded — see findings-prompts.md. The reload keeps this test
    // honest about the create/delete round trip rather than asserting the
    // stale state.
    await page.getByRole("tab", { name: "Config" }).click();
    await page.waitForURL("**/config");
    await page.reload();
    const tagRow = page.getByRole("row").filter({ hasText: tagName });
    await expect(tagRow).toBeVisible();
    await expect(tagRow.getByText("an exploratory tag")).toBeVisible();

    await tagRow.getByRole("button", { name: "Delete tag" }).click();
    await page.getByRole("button", { name: "Delete Tag", exact: true }).click();
    await expect(tagRow).not.toBeVisible();
  });

  test("can clone a prompt from the prompt detail page", async ({ page }) => {
    const promptName = `exp-prompts-clone-${randomUUID()}`;
    await createPromptViaPlayground(page, promptName, "clone source prompt");

    await gotoPromptDetail(page, promptName);

    await page.getByRole("button", { name: "Clone" }).click();
    const dialog = page.getByTestId("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Clone Prompt" })
    ).toBeVisible();

    // The clone name is pre-filled with `-clone` appended
    const nameInput = dialog.getByRole("textbox", { name: "Name" });
    await expect(nameInput).toHaveValue(`${promptName}-clone`);
    await dialog.getByRole("button", { name: "Clone", exact: true }).click();
    await expect(dialog).not.toBeVisible();

    // The cloned prompt shows up in the prompts listing. Navigate via the
    // side nav rather than a fresh document load: under parallel load a
    // full reload's route query can be aborted, which renders the app's
    // error boundary instead of the listing.
    await page
      .getByTestId("application-side-navigation")
      .getByRole("link", { name: "Prompts" })
      .click();
    await page.waitForURL(/\/prompts$/);
    await filterPromptsByName(page, `${promptName}-clone`);
  });

  test("can delete a prompt from the prompts table row actions", async ({
    page,
  }) => {
    const promptName = `exp-prompts-delete-${randomUUID()}`;
    await createPromptViaPlayground(page, promptName, "prompt to delete");

    await page.goto("/prompts");
    await page.waitForURL("**/prompts");
    // Filter first: the listing is paginated and parallel workers create
    // prompts concurrently.
    await filterPromptsByName(page, promptName);
    const row = promptRow(page, promptName);
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: "Prompt actions" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await expect(
      page.getByRole("heading", { name: "Delete Prompt" })
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Delete Prompt", exact: true })
      .click();

    await expect(row).not.toBeVisible();
  });

  test("can open a prompt in the playground from the table row", async ({
    page,
  }) => {
    const promptName = `exp-prompts-open-${randomUUID()}`;
    await createPromptViaPlayground(page, promptName, "open in playground");

    await page.goto("/prompts");
    await page.waitForURL("**/prompts");
    // Filter first: the listing is paginated and parallel workers create
    // prompts concurrently.
    await filterPromptsByName(page, promptName);
    const row = promptRow(page, promptName);
    await expect(row).toBeVisible();

    await row.getByRole("link", { name: "Open in playground" }).click();
    await page.waitForURL("**/playground?*");
    // The row link carries the prompt identity; the playground resolves the
    // latest version itself.
    expect(new URL(page.url()).searchParams.get("promptId")).toBeTruthy();
    await expect(
      page.getByRole("button", { name: "Save Prompt" })
    ).toBeVisible();
  });
});
