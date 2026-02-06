import { expect, test } from "@playwright/test";
import { randomUUID } from "crypto";

import { login, MEMBER_USER } from "./utils/login";

test.beforeEach(async ({ page }) => {
  await login(page, MEMBER_USER);
});

test("can create user key", async ({ page }) => {
  // Navigate to profile page
  await page.goto("/profile");

  // Generate a unique key name for this test run
  const keyName = `key-${randomUUID()}`;

  // Click the "New Key" button to open the create dialog
  await page.getByRole("button", { name: "New Key" }).click();

  // Fill in the key name and submit
  await page.getByRole("dialog").getByLabel("Name").fill(keyName);
  await page.getByRole("button", { name: "Create Key" }).click();

  // Close the dialog that appears after creating the key
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "dismiss" })
    .click();

  // Verify the named key appears in the table - which means key creation succeeded
  await expect(page.getByRole("cell", { name: keyName })).toBeVisible({
    timeout: 60000,
  });
});

test("should be able to create a new project", async ({ page }) => {
  await page.goto("/projects");
  await page.waitForURL("**/projects");

  // Wait for the page to be loaded
  await expect(
    page.getByRole("searchbox", { name: "Search projects by name" })
  ).toBeVisible();

  await expect(page.getByRole("button", { name: "New Project" })).toBeVisible();
});
