import { expect, test } from "@playwright/test";
import { randomUUID } from "crypto";

test.beforeEach(async ({ page }) => {
  page.goto(`/login`);

  await page.getByLabel("Email").fill("admin@localhost");
  await page.getByLabel("Password").fill("admin123");
  await page.getByRole("button", { name: "Log In", exact: true }).click();
  await page.waitForURL("**/projects");
});

test("admin can create system api key", async ({ page }) => {
  const testKeyName = `System-${randomUUID()}`;
  await page.getByRole("link", { name: "Settings" }).click();
  await page.waitForURL("**/settings/general");
  await page.getByRole("button", { name: "System Key", exact: true }).click();
  await page.getByTestId("modal").getByLabel("Name").fill(testKeyName);
  await page.getByRole("button", { name: "Create Key" }).click();

  await expect(
    page.getByRole("heading", { name: "New API Key Created" })
  ).toBeVisible();
});
