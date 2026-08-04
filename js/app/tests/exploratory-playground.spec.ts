import { randomUUID } from "crypto";
import { expect, test, type Page } from "@playwright/test";

/**
 * Exploratory coverage for the Playground page.
 *
 * Complements playground.spec.ts (message reorder, promptId URL persistence,
 * dataset examples table) and playground-prompt-configuration.spec.ts
 * (invocation parameter / tool / response format round-trips) with:
 *   - prompt message add / role switch / delete round trip
 *   - template format switching and variable re-detection (Mustache → F-String)
 *   - prompt comparison mode (add / remove a second playground instance)
 *   - saving a prompt with a version tag, then saving a new version to the
 *     same prompt via the "Update Prompt" mode of the save dialog
 *   - selecting a dataset through the "Test over a dataset" picker and
 *     clearing it again
 */

/** Replace the full contents of a CodeMirror editor rendered as a textbox. */
async function replaceCodeMirrorContent(
  page: Page,
  editorIndex: number,
  value: string
) {
  const editor = page
    .getByRole("textbox", { name: "Message content" })
    .nth(editorIndex);
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(value);
}

async function gotoPlayground(page: Page) {
  // The playground is the heaviest page in the app; wait for the document
  // rather than every subresource so a fully parallel run doesn't exceed the
  // navigation timeout. The assertions below still gate on real readiness.
  await page.goto("/playground", { waitUntil: "domcontentloaded" });
  await page.waitForURL("**/playground");
  await expect(page.getByRole("heading", { name: "Playground" })).toBeVisible();
}

test.describe("Playground exploratory", () => {
  test("adds a message, switches its role, and deletes it", async ({
    page,
  }) => {
    await gotoPlayground(page);

    const deleteButtons = page.getByRole("button", { name: "Delete message" });
    // The default template ships with a System and a User message
    await expect(deleteButtons).toHaveCount(2);

    await page.getByRole("button", { name: "add message" }).click();
    await expect(deleteButtons).toHaveCount(3);

    // The new message defaults to the User role — switch it to AI via the
    // role listbox on the newly added (last) message
    await page
      .getByRole("button", { name: "User Role for the chat message" })
      .last()
      .click();
    const roleListbox = page.getByRole("listbox", {
      name: "Role for the chat message",
    });
    await expect(roleListbox).toBeVisible();
    await expect(
      roleListbox.getByRole("option", { name: "Tool", exact: true })
    ).toBeVisible();
    await roleListbox.getByRole("option", { name: "AI", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "AI Role for the chat message" })
    ).toBeVisible();

    // Delete the message we just added
    await deleteButtons.last().click();
    await expect(deleteButtons).toHaveCount(2);
    await expect(
      page.getByRole("button", { name: "AI Role for the chat message" })
    ).toHaveCount(0);
  });

  test("re-detects template variables when switching to F-String", async ({
    page,
  }) => {
    await gotoPlayground(page);

    // The default mustache template contains {{question}}, surfaced as an
    // input in the Inputs panel
    await expect(page.getByRole("textbox", { name: "question" })).toBeVisible();

    // In F-String syntax "{{question}}" is an escaped literal, so the
    // variable disappears from the Inputs panel
    await page.getByRole("radio", { name: "F-String" }).click();
    await expect(page.getByRole("textbox", { name: "question" })).toHaveCount(
      0
    );

    // Typing an f-string variable into the user message surfaces it as a new
    // input
    await replaceCodeMirrorContent(page, 1, "Tell me about {topic}");
    await expect(page.getByRole("textbox", { name: "topic" })).toBeVisible();

    // Switching back to Mustache stops treating {topic} as a variable
    await page.getByRole("radio", { name: "Mustache" }).click();
    await expect(page.getByRole("textbox", { name: "topic" })).toHaveCount(0);
  });

  test("adds and removes a comparison prompt instance", async ({ page }) => {
    await gotoPlayground(page);

    await expect(page.getByRole("heading", { name: "A Output" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "B Output" })).toHaveCount(
      0
    );

    await page.getByRole("button", { name: "add prompt" }).click();

    const deleteInstanceButtons = page.getByRole("button", {
      name: "Delete this instance of the playground",
    });
    await expect(page.getByRole("heading", { name: "B Output" })).toBeVisible();
    await expect(deleteInstanceButtons).toHaveCount(2);

    // Remove the second instance and confirm we return to single-prompt mode
    await deleteInstanceButtons.last().click();
    await expect(page.getByRole("heading", { name: "B Output" })).toHaveCount(
      0
    );
    await expect(page.getByRole("heading", { name: "A Output" })).toBeVisible();
    // Delete-instance affordance is only rendered in comparison mode
    await expect(deleteInstanceButtons).toHaveCount(0);
  });

  test("saves a prompt with a tag and then saves a new version to it", async ({
    page,
  }) => {
    const promptName = `exp-playground-save-${randomUUID().slice(0, 8)}`;

    await gotoPlayground(page);

    // Create the prompt with the "production" tag checked
    await page.getByRole("button", { name: "Save Prompt" }).click();
    await expect(
      page.getByRole("heading", { name: "Create Prompt from Template" })
    ).toBeVisible();
    await page.getByPlaceholder("Select or enter new prompt").fill(promptName);
    // React Aria hides the native input behind a styled overlay; click the
    // label text instead (repo convention).
    await page.getByText("production", { exact: true }).click();
    await page.getByRole("button", { name: "Create Prompt" }).click();

    await expect(page.getByText("Prompt successfully created")).toBeVisible();
    await expect(page).toHaveURL(/promptId=/);
    const createdVersionId = new URL(page.url()).searchParams.get(
      "promptVersionId"
    );
    expect(createdVersionId).toBeTruthy();

    // Reopen the save dialog — the instance is now linked to the prompt, so
    // the dialog is in update mode
    await page.getByRole("button", { name: "Save Prompt" }).click();
    const updateButton = page.getByRole("button", { name: "Update Prompt" });
    await expect(updateButton).toBeVisible();
    await page
      .getByLabel("Description (optional)")
      .fill("second version from exploratory test");
    await page.getByText("staging", { exact: true }).click();
    await updateButton.click();

    await expect(page.getByText("Prompt successfully updated")).toBeVisible();
    // The URL should now point at the new version with the staging tag
    await expect(page).toHaveURL(/promptTagName=staging/);
    await expect
      .poll(() => new URL(page.url()).searchParams.get("promptVersionId"))
      .not.toBe(createdVersionId);
  });

  test("selects a dataset via the Test over a dataset picker and clears it", async ({
    page,
  }) => {
    const datasetName = `exp-playground-ds-${randomUUID().slice(0, 8)}`;

    // Create a dataset with one example through the UI — datasets without
    // examples are disabled in the playground dataset picker
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
    await page.getByRole("link", { name: datasetName }).click();
    await page.waitForURL("**/datasets/**/examples");

    await page.getByRole("button", { name: "Add Dataset Example" }).click();
    await page.getByRole("menuitem", { name: "Add Example Manually" }).click();
    // The menu popover is also a role=dialog; target the example dialog by
    // the submit button it owns.
    const dialog = page
      .getByRole("dialog")
      .filter({ has: page.getByRole("button", { name: "Add Example" }) });
    await expect(dialog).toBeVisible();
    const inputEditor = dialog.locator(".cm-content").first();
    await inputEditor.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.insertText(JSON.stringify({ question: "hello" }));
    // "Create more" keeps the dialog open on submit; turn it off first.
    await dialog.getByText("Create more", { exact: true }).click();
    await dialog.getByRole("button", { name: "Add Example" }).click();
    // The submit button's label changes mid-mutation, so the filtered
    // locator above stops matching before the dialog unmounts; wait on the
    // heading instead.
    await expect(
      page.getByRole("heading", { name: "Add Example Manually" })
    ).toBeHidden();

    // Pick the dataset in the playground via the picker popover
    await gotoPlayground(page);
    await page.getByRole("button", { name: "Test over a dataset" }).click();
    await page.getByRole("searchbox", { name: "Search" }).fill(datasetName);
    await page.getByRole("menuitemradio", { name: datasetName }).click();

    await expect(page).toHaveURL(/datasetId=/);
    const clearButton = page.getByRole("button", { name: "Clear dataset" });
    await expect(clearButton).toBeVisible();
    // The dataset example rows replace the manual inputs panel
    await expect(page.getByText('"question"').first()).toBeVisible();

    // Clearing the dataset returns to manual inputs
    await clearButton.click();
    await expect(page).not.toHaveURL(/datasetId=/);
    await expect(clearButton).toHaveCount(0);
  });
});
