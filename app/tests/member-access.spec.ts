import { expect, test } from "@playwright/test";
import { randomUUID } from "crypto";

test.beforeEach(async ({ page }) => {
  page.goto(`/login`);
  await page.getByLabel("Email").fill("member@localhost.com");
  await page.getByLabel("Password").fill("member123");
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await page.waitForURL("**/projects/**");
});

test("can create user key", async ({ page }) => {
  await page.goto("/profile");
  await page.getByRole("button", { name: "New Key" }).click();
  const keyName = `key-${randomUUID()}`;
  await page.getByRole("dialog").getByLabel("Name").fill(keyName);
  await page.getByRole("button", { name: "Create Key" }).click();
  await page.getByLabel("dismiss").click();
  await expect(page.getByRole("cell", { name: keyName })).toBeVisible();
});
