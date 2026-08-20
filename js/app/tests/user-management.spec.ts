import { randomUUID } from "crypto";
import { expect, test } from "@playwright/test";
test("can create a user", async ({ page }) => {
  await page.goto("/settings/users");
  await page.waitForURL("**/settings/users");
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
  await page.goto("/settings/users");
  await page.waitForURL("**/settings/users");
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

test("a new user only needs to reset their password once", async ({
  baseURL,
  browser,
  page,
}) => {
  if (!baseURL) {
    throw new Error("Playwright baseURL must be configured.");
  }

  await page.goto("/settings/users");
  await page.waitForURL("**/settings/users");
  await page.getByRole("button", { name: "Add User" }).click();

  const email = `password-reset-${randomUUID()}@localhost.com`;
  const initialPassword = "initial123";
  const newPassword = "updated123";
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Username").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(initialPassword);
  await page.getByLabel("Confirm Password").fill(initialPassword);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add User" })
    .click();
  await expect(page.getByRole("cell", { name: email })).toBeVisible();

  const userContext = await browser.newContext();
  const userPage = await userContext.newPage();
  try {
    await userPage.goto(`${baseURL}/login`);
    await userPage.getByLabel("Email").fill(email);
    await userPage.getByLabel("Password").fill(initialPassword);
    await userPage.getByRole("button", { name: "Log In" }).click();
    await userPage.waitForURL("**/reset-password");

    await userPage.getByLabel("Old Password").fill(initialPassword);
    await userPage.getByLabel("New Password").fill(newPassword);
    await userPage.getByLabel("Confirm Password").fill(newPassword);
    await userPage.getByRole("button", { name: "Reset Password" }).click();
    await userPage.waitForURL("**/login?message=password_reset");

    await userPage.getByLabel("Email").fill(email);
    await userPage.getByLabel("Password").fill(newPassword);
    await userPage.getByRole("button", { name: "Log In" }).click();

    await expect(userPage).toHaveURL(/\/projects(?:\?|$)/);
    await expect(userPage.getByLabel("Old Password")).toHaveCount(0);
  } finally {
    await userContext.close();
  }
});
