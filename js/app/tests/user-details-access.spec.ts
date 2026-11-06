import type { Browser } from "@playwright/test";
import { expect, test } from "@playwright/test";

const ADMIN_STORAGE_STATE = "playwright/.auth/admin.json";
const NON_ADMIN_STORAGE_STATES = [
  {
    role: "member",
    storageState: "playwright/.auth/member.json",
  },
  {
    role: "viewer",
    storageState: "playwright/.auth/viewer.json",
  },
] as const;

async function getMemberDetailsPath(browser: Browser) {
  const context = await browser.newContext({
    storageState: ADMIN_STORAGE_STATE,
  });
  const page = await context.newPage();

  try {
    await page.goto("/settings/users");
    const href = await page
      .getByRole("link", { name: "member", exact: true })
      .getAttribute("href");
    expect(href).toMatch(/^\/settings\/users\//);
    return href as string;
  } finally {
    await context.close();
  }
}

test("admin can view user details from settings", async ({ page }) => {
  await page.goto("/settings/users");
  await page.getByRole("link", { name: "member", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "User details for member" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "User details" })
  ).toBeVisible();
  await expect(dialog.getByText("member@localhost.com")).toBeVisible();
  await expect(page).toHaveURL(/\/settings\/users\//);
});

for (const { role, storageState } of NON_ADMIN_STORAGE_STATES) {
  test(`${role} cannot view user details`, async ({ browser }) => {
    const userDetailsPath = await getMemberDetailsPath(browser);
    const context = await browser.newContext({ storageState });
    const page = await context.newPage();

    try {
      await page.goto("/settings/users");
      await expect(
        page.getByRole("heading", { name: "Users" })
      ).not.toBeVisible();
      await expect(
        page.getByRole("link", { name: "member", exact: true })
      ).not.toBeVisible();

      await page.goto(userDetailsPath);

      await expect(page).toHaveURL(/\/settings\/general$/);
      await expect(
        page.getByRole("dialog", { name: /User details for/ })
      ).not.toBeVisible();
    } finally {
      await context.close();
    }
  });
}
