import { randomUUID } from "crypto";
import { expect, test, type Page, type Response } from "@playwright/test";

function isGraphQLMutationResponse(response: Response, operationName: string) {
  if (!response.url().includes("/graphql") || response.status() !== 200) {
    return false;
  }
  const postData = response.request().postData();
  return postData?.includes(operationName) ?? false;
}

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
    .fill("Compiler playground table dataset");
  await page.getByRole("button", { name: "Create Dataset" }).click();
  await expect(page.getByTestId("dialog")).not.toBeVisible();
  await page.getByRole("link", { name: datasetName }).click();
  await page.waitForURL("**/datasets/**/examples");
}

async function setCodeMirrorValue(page: Page, value: string) {
  const dialog = page.getByRole("dialog");
  const inputEditor = dialog.locator(".cm-content").first();
  await expect(inputEditor).toBeVisible();
  await inputEditor.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(value);
}

async function addDatasetExample(
  page: Page,
  inputJson: string,
  closeDialog: boolean
) {
  const addBtn = page.getByRole("button", { name: "Add Example" });
  if (closeDialog) {
    await page.getByText("Create more", { exact: true }).click();
  }
  await setCodeMirrorValue(page, inputJson);
  await Promise.all([
    page.waitForResponse((resp) =>
      isGraphQLMutationResponse(resp, "AddExampleFromScratchFormMutation")
    ),
    addBtn.click(),
  ]);
  if (closeDialog) {
    await expect(page.getByRole("dialog")).not.toBeVisible();
  }
}

test.describe("Playground", () => {
  test("reorders prompt messages by dragging the handle", async ({ page }) => {
    await page.goto("/playground");
    await expect(
      page.getByRole("heading", { name: "Playground" })
    ).toBeVisible();

    const reorderButtons = page.getByRole("button", {
      name: "Reorder message",
    });
    const messageItems = page.locator("li").filter({ has: reorderButtons });

    await expect(reorderButtons).toHaveCount(2);
    await expect(messageItems).toHaveCount(2);
    await expect(messageItems.nth(0).locator(".cm-content")).toContainText(
      "You are a chatbot"
    );
    await expect(messageItems.nth(1).locator(".cm-content")).toContainText(
      "{{question}}"
    );

    // Drag with explicit stepped mouse moves — dnd-kit tracks the pointer on
    // animation frames, so a single-step dragTo can release before the drop
    // target is registered
    const targetBox = await messageItems.nth(1).boundingBox();
    if (!targetBox) {
      throw new Error("target message item is not visible");
    }
    await reorderButtons.first().hover();
    await page.mouse.down();
    await page.mouse.move(
      targetBox.x + targetBox.width / 2,
      targetBox.y + targetBox.height / 2,
      { steps: 20 }
    );
    // The dragged item gets an inline z-index while dragging — wait for it so
    // the drag is registered before releasing. During the live swap
    // animation, dnd-kit can briefly apply the style to the item being
    // swapped as well, so assert at least one rather than exactly one.
    await expect
      .poll(async () => page.locator("li[style*='z-index']").count())
      .toBeGreaterThanOrEqual(1);
    await page.mouse.up();

    await expect(messageItems.nth(0).locator(".cm-content")).toContainText(
      "{{question}}"
    );
    await expect(messageItems.nth(1).locator(".cm-content")).toContainText(
      "You are a chatbot"
    );
  });

  test("moves keyboard focus through message editors until editing is intentional", async ({
    page,
  }) => {
    await page.goto("/playground");
    await expect(
      page.getByRole("heading", { name: "Playground" })
    ).toBeVisible();

    const messageItems = page.locator("li").filter({
      has: page.getByRole("button", { name: "Reorder message" }),
    });
    const systemMessageItem = messageItems.first();
    const userMessageItem = messageItems.nth(1);
    const reorderButton = systemMessageItem.getByRole("button", {
      name: "Reorder message",
    });
    const messageStop = systemMessageItem.getByRole("button", {
      name: "Edit message content",
    });
    const messageTextbox = systemMessageItem.getByRole("textbox", {
      name: "Message content",
    });
    const messageContent = systemMessageItem.locator(".cm-content");

    await expect(
      page.getByRole("button", { name: "Edit message content" })
    ).toHaveCount(2);

    await reorderButton.focus();
    await page.keyboard.press("Tab");
    await expect(messageStop).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(
      userMessageItem.getByRole("button", { name: "user message" })
    ).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(messageStop).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(messageTextbox).toBeFocused();
    await page.keyboard.press("End");
    await page.keyboard.insertText("x");
    await expect(messageTextbox).toContainText("You are a chatbotx");

    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(messageTextbox).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(messageStop).toBeFocused();

    await messageContent.click();
    await expect(messageTextbox).toBeFocused();
    const modelParametersButton = page.getByRole("button", {
      name: "Configure model parameters",
    });
    await modelParametersButton.focus();
    await expect(modelParametersButton).toBeFocused();
    await expect(messageStop).toBeVisible();

    await messageContent.click();
    await expect(messageTextbox).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(messageStop).toBeFocused();
  });

  test("types printable characters directly into inactive message editors", async ({
    page,
  }) => {
    await page.goto("/playground");
    await expect(
      page.getByRole("heading", { name: "Playground" })
    ).toBeVisible();

    const messageItems = page.locator("li").filter({
      has: page.getByRole("button", { name: "Reorder message" }),
    });
    const systemMessage = messageItems.first();
    const systemMessageStop = systemMessage.getByRole("button", {
      name: "Edit message content",
    });
    const systemMessageContent = systemMessage.locator(".cm-content");

    await systemMessageStop.focus();
    await page.keyboard.press("Control+x");
    await expect(systemMessageStop).toBeFocused();
    await expect(systemMessageContent).toHaveText("You are a chatbot");

    await page.keyboard.press("x");
    await expect(
      systemMessage.getByRole("textbox", { name: "Message content" })
    ).toBeFocused();
    await expect(systemMessageContent).toHaveText("xYou are a chatbot");

    await page.keyboard.press("Escape");
    await page.keyboard.press(" ");
    await expect(systemMessageContent).toHaveText("x You are a chatbot");

    await page.keyboard.press("Escape");
    await page.keyboard.press("?");
    await expect(systemMessageContent).toHaveText("x ?You are a chatbot");

    await page.keyboard.press("Escape");
    const userMessage = messageItems.nth(1);
    await userMessage
      .getByRole("button", { name: "Edit message content" })
      .focus();
    await page.keyboard.press("z");
    await expect(userMessage.locator(".cm-content")).toHaveText(
      "z{{question}}"
    );
  });

  test("preserves prompt selection in the URL across page reloads", async ({
    page,
  }) => {
    await page.goto("/playground");
    await page.waitForURL("**/playground");
    await expect(
      page.getByRole("heading", { name: "Playground" })
    ).toBeVisible();

    await page.getByRole("button", { name: "Save Prompt" }).click();
    const promptName = `playground-url-test-${randomUUID().slice(0, 8)}`;
    await page.getByPlaceholder("Select or enter new prompt").click();
    await page.getByPlaceholder("Select or enter new prompt").fill(promptName);
    await page
      .getByLabel("Description (optional)")
      .fill("test prompt for URL persistence");
    await page.getByRole("button", { name: "Create Prompt" }).click();
    await expect(page).toHaveURL(/promptId=/);

    const urlAfterSave = page.url();
    const savedSearchParams = new URL(urlAfterSave).searchParams;
    const promptId = savedSearchParams.get("promptId");
    expect(promptId).toBeTruthy();

    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Playground" })
    ).toBeVisible();

    await expect(page).toHaveURL(/promptId=/);
    const urlAfterReload = page.url();
    const reloadedSearchParams = new URL(urlAfterReload).searchParams;
    expect(reloadedSearchParams.get("promptId")).toBe(promptId);
  });

  test("keeps dataset examples table interactive with expansion", async ({
    page,
  }) => {
    const datasetName = `playground-table-${randomUUID().slice(0, 8)}`;
    await createDataset(page, datasetName);

    const datasetMatch = page.url().match(/datasets\/([^/]+)/);
    const datasetId = datasetMatch ? datasetMatch[1] : "";
    expect(datasetId).toBeTruthy();

    // The Examples button opens a menu with options to add an example manually
    // or upload from a file. Choose the manual option to open the dialog.
    await page.getByRole("button", { name: "Add Dataset Example" }).click();
    await page.getByRole("menuitem", { name: "Add Example Manually" }).click();
    await expect(page.getByTestId("dialog")).toBeVisible();

    const longContent = `${"lorem-ipsum-".repeat(45)}`;

    await addDatasetExample(
      page,
      JSON.stringify({ prompt: `playground-row-0 ${longContent}` }),
      false
    );
    await addDatasetExample(
      page,
      JSON.stringify({ prompt: `playground-row-1 ${longContent}` }),
      false
    );
    await addDatasetExample(
      page,
      JSON.stringify({ prompt: "playground-row-2" }),
      true
    );

    await page.goto(`/playground?datasetId=${datasetId}`);
    await page.waitForURL("**/playground?datasetId=*");

    await expect(
      page.getByText("playground-row-0", { exact: false }).first()
    ).toBeVisible();

    const showMoreButtons = page.getByRole("button", { name: "Show more" });
    const countBefore = await showMoreButtons.count();
    expect(countBefore).toBeGreaterThan(0);
    await showMoreButtons.first().click();
    await expect(showMoreButtons).toHaveCount(countBefore - 1);
  });
});
