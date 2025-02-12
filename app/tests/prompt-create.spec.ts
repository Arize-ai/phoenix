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
  await page.getByRole("link", { name: "Create Prompt" }).click();
  await page.getByText("You are a chatbot").click();
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByPlaceholder("Select or enter new prompt").click();
  const chatbotName = `chatbot-${randomUUID()}`;
  await page.getByPlaceholder("Select or enter new prompt").fill(chatbotName);
  await page.getByLabel("Prompt Description").click();
  await page.getByLabel("Prompt Description").fill("very kind chatbot");
  await page.getByRole("button", { name: "Create Prompt" }).click();
  await page.getByRole("button", { name: "View Prompt" }).click();

  // Check if the prompt
  await expect(page.getByRole("heading", { name: chatbotName })).toBeVisible();
});
