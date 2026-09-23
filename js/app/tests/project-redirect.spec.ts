import { expect, test } from "@playwright/test";

test.describe("Project redirect", () => {
  test("redirects /redirects/projects/:project_name to /projects/:projectId", async ({
    page,
  }) => {
    await page.goto("/redirects/projects/default");
    // The redirect loader resolves the project name to a global ID
    await expect(page).toHaveURL(/\/projects\/[A-Za-z0-9]+=*/);
    // Verify we landed on the project page by checking breadcrumbs
    await expect(
      page
        .getByRole("list", { name: "Breadcrumbs" })
        .getByRole("link", { name: "default" })
    ).toBeVisible();
  });

  test("shows onboarding empty state for nonexistent project name", async ({
    page,
  }) => {
    await page.goto("/redirects/projects/nonexistent-project-name");
    // A missing project is the expected pre-first-trace state, so we surface an
    // onboarding empty state pointing at exporter setup rather than a 404 error.
    await expect(page.getByText("No traces yet")).toBeVisible();
    await expect(
      page.getByText(/couldn't find a project named "nonexistent-project-name"/)
    ).toBeVisible();
  });
});
