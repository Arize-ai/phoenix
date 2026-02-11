import { expect, test } from "@playwright/test";
import { randomUUID } from "crypto";

import { ADMIN_USER, login } from "./utils/login";

test.beforeEach(async ({ page }) => {
  await login(page, ADMIN_USER);
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
