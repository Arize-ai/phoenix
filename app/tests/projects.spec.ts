import { expect, test } from "@playwright/test";
import { randomUUID } from "crypto";

import { ADMIN_STORAGE_STATE } from "./utils/authPaths";

test.describe.serial("Projects", () => {
  const projectName = `test-project-${randomUUID()}`;

  test.use({ storageState: ADMIN_STORAGE_STATE });

  test("can create a project from scratch", async ({ page }) => {
    await page.goto("/projects");
    await page.waitForURL("**/projects");

    await page.getByRole("button", { name: "New Project" }).click();
    await expect(
      page.getByRole("heading", { name: "Create a New Project" })
    ).toBeVisible();

    await page.getByRole("tab", { name: /Manual|From scratch/i }).click();
    await page.getByLabel("Project Name").fill(projectName);
    await page
      .getByLabel("Description")
      .fill("A project created manually from scratch in Playwright");

    await page.getByRole("button", { name: "Create Project" }).click();

    // Wait for SPA navigation to the project detail page.
    // Use toHaveURL instead of waitForURL because React Router's client-side
    // navigation doesn't trigger a full page "load" event.
    await expect(page).toHaveURL(/\/projects\/.+/);

    // Verify the project detail page loaded by checking the breadcrumb link
    // (the project name appears in the breadcrumbs, not as a heading)
    await expect(
      page.getByRole("list", { name: "Breadcrumbs" }).getByRole("link", {
        name: projectName,
      })
    ).toBeVisible();
  });

  test("can delete a project and it disappears from the listing", async ({
    page,
  }) => {
    await page.goto("/projects");
    await page.waitForURL("**/projects");

    const search = page.getByRole("searchbox", {
      name: "Search projects by name",
    });
    await search.fill(projectName);

    const projectCard = page
      .locator("li")
      .filter({ has: page.getByRole("heading", { name: projectName }) });
    const projectRow = page
      .getByRole("row")
      .filter({ has: page.getByRole("link", { name: projectName }) });

    if ((await projectCard.count()) > 0) {
      await expect(projectCard.first()).toBeVisible();
      await projectCard.first().getByRole("button").last().click();
    } else {
      await expect(projectRow.first()).toBeVisible();
      await projectRow.first().getByRole("button").last().click();
    }

    await page.getByRole("menuitem", { name: "Delete" }).click();
    await expect(
      page.getByRole("heading", { name: "Delete Project", exact: true })
    ).toBeVisible();

    await page.getByRole("button", { name: "Delete Project" }).click();

    // Wait for the confirmation dialog to close (indicates delete mutation + refetch completed)
    await expect(
      page.getByRole("heading", { name: "Delete Project", exact: true })
    ).not.toBeVisible();

    await expect(
      page.getByRole("link", { name: projectName })
    ).not.toBeVisible();
    await expect(
      page.getByRole("heading", { name: projectName, exact: true })
    ).not.toBeVisible();
  });
});
