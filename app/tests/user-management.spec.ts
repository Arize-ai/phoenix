import { expect, test } from "@playwright/test";
import { randomUUID } from "crypto";

test.beforeEach(async ({ page }) => {
  page.goto(`/login`);

  await page.getByLabel("Email").fill("admin@localhost");
  await page.getByLabel("Password").fill("admin123");
  await page.getByRole("button", { name: "Log In", exact: true }).click();
  await page.waitForURL("**/projects");
});

test("can create a user", async ({ page }) => {
  await page.goto("/settings/general");
  await page.waitForURL("**/settings/general");
  await page.getByRole("button", { name: "Add User" }).click();

  const email = `member-${randomUUID()}@localhost.com`;
  // Add the user
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Username").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("member123");
  await page.getByLabel("Confirm Password").fill("member123");
  await page.getByRole("dialog").getByLabel("member", { exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("option", { name: "member" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add User" })
    .click();

  // Check if the user is created
  await expect(page.getByRole("cell", { name: email })).toBeVisible();
});

test("can create a user with viewer role", async ({ page }) => {
  await page.goto("/settings/general");
  await page.waitForURL("**/settings/general");
  await page.getByRole("button", { name: "Add User" }).click();

  const email = `viewer-${randomUUID()}@localhost.com`;
  // Add the user
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Username").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("viewer123");
  await page.getByLabel("Confirm Password").fill("viewer123");
  await page.getByRole("dialog").getByLabel("member", { exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("option", { name: "viewer" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add User" })
    .click();

  // Check if the user is created
  await expect(page.getByRole("cell", { name: email })).toBeVisible();
});
