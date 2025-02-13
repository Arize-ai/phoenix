import { expect, test } from "@playwright/test";
import { randomUUID } from "crypto";

test.beforeEach(async ({ page }) => {
  page.goto(`/login`);

  await page.getByLabel("Email").fill("admin@localhost");
  await page.getByLabel("Password").fill("admin123");
  await page.getByRole("button", { name: "Log In", exact: true }).click();
  await page.waitForURL("**/projects");
});

test("can create a prompt", async ({ page }) => {
  await page.goto("/prompts");
  await page.waitForURL("**/prompts");
  await page.getByRole("link", { name: "Create Prompt" }).click();
  await page.waitForURL("**/playground");
  await page.getByText("You are a chatbot").fill("You are a helpful assistant");
  await await page.getByRole("button", { name: "Save" }).click();
  await page.getByPlaceholder("Select or enter new prompt").click();
  const promptName = `chatbot-${randomUUID()}`;
  await page.getByPlaceholder("Select or enter new prompt").fill(promptName);
  await page.getByLabel("Prompt Description").click();
  await page.getByLabel("Prompt Description").fill("very kind chatbot");
  await page.getByRole("button", { name: "Create Prompt" }).click();
  await page.getByRole("button", { name: "View Prompt" }).click();

  // Check if the prompt
  await expect(page.getByRole("heading", { name: promptName })).toBeVisible();
  await expect(
    page.getByText("You are a helpful assistant").first()
  ).toBeVisible();
});

test("can edit a prompt", async ({ page }) => {
  await page.goto("/playground");
  await page.waitForURL("**/playground");
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByPlaceholder("Select or enter new prompt").click();
  const promptName = `chatbot-${randomUUID()}`;
  await page.getByPlaceholder("Select or enter new prompt").fill(promptName);
  await page.getByLabel("Prompt Description").click();
  await page.getByLabel("Prompt Description").fill("very kind chatbot");
  await page.getByRole("button", { name: "Create Prompt" }).click();
  await page.getByRole("button", { name: "View Prompt" }).click();

  // Go to the prompt listing
  await page.getByRole("link", { name: "Prompts" }).click();
  await page.waitForURL("**/prompts");
  await page.getByRole("link", { name: promptName }).click();

  await page.getByRole("button", { name: "Edit in Playground" }).click();

  // Ensure that the prompt is loaded into the playground page
  await page.waitForURL("**/playground");

  // Edit the prompt
  // Editing is a bit hard to do due to codemirror. TODO: figure out a way to type
  await page.getByRole("button", { name: "Save" }).click();

  // Save the prompt
  await page.getByLabel("Change Description").fill("very angry chatbot");
  await page.getByRole("button", { name: "Update Prompt" }).click();

  await page.getByRole("button", { name: "View Prompt" }).click();

  // Check if the prompt was updated
  await expect(page.getByRole("heading", { name: promptName })).toBeVisible();
  // Simply check the description is visible
  await expect(
    page.getByRole("tabpanel").getByText("very angry chatbot")
  ).toBeVisible();
});
