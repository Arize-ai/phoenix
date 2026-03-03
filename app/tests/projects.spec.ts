import { randomUUID } from "crypto";
import { expect, test, type Page } from "@playwright/test";

async function createProject(
  page: Page,
  projectName: string,
  description: string
) {
  await page.goto("/projects");
  await page.waitForURL("**/projects");
  await page.getByRole("button", { name: "New Project" }).click();
  await expect(
    page.getByRole("heading", { name: "Create a New Project" })
  ).toBeVisible();
  await page.getByRole("tab", { name: /Manual|From scratch/i }).click();
  await page.getByLabel("Project Name").fill(projectName);
  await page.getByLabel("Description").fill(description);
  await page.getByRole("button", { name: "Create Project" }).click();
  await expect(page).toHaveURL(/\/projects\/.+/);
}

test.describe.serial("Projects", () => {
  const projectName = `test-project-${randomUUID()}`;
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
    // toHaveURL because React Router client-side nav doesn't trigger a full "load" event
    await expect(page).toHaveURL(/\/projects\/.+/);

    // Project name appears in breadcrumbs, not as a heading
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

  test("supports table filtering and sorting on projects page", async ({
    page,
  }) => {
    const id = randomUUID().slice(0, 8);
    const projectNameA = `compiler-project-a-${id}`;
    const projectNameZ = `compiler-project-z-${id}`;

    await createProject(page, projectNameA, "Compiler sort test project A");
    await createProject(page, projectNameZ, "Compiler sort test project Z");

    await page.goto("/projects");
    await page.waitForURL("**/projects");

    await page.getByRole("radio", { name: "Table view" }).click();

    const search = page.getByRole("searchbox", {
      name: "Search projects by name",
    });
    await search.fill(`compiler-project-${id}`);
    await expect(page.getByRole("link", { name: projectNameA })).toBeVisible();
    await expect(page.getByRole("link", { name: projectNameZ })).toBeVisible();

    const table = page.getByTestId("projects-table");
    await expect(table).toBeVisible();
    const nameHeader = page.getByRole("columnheader", { name: "name" });

    await nameHeader.click();
    await expect(nameHeader).toHaveAttribute("aria-sort", "ascending");
    await expect(page.getByRole("link", { name: projectNameA })).toBeVisible();

    await nameHeader.click();
    await expect(nameHeader).toHaveAttribute("aria-sort", "descending");
    await expect(page.getByRole("link", { name: projectNameZ })).toBeVisible();

    await search.fill(projectNameA);
    await expect(page.getByRole("link", { name: projectNameA })).toBeVisible();
    await expect(
      page.getByRole("link", { name: projectNameZ })
    ).not.toBeVisible();
  });

  test("project table remains usable after mutation workflows", async ({
    page,
  }) => {
    const postMutationProject = `compiler-post-mutation-${randomUUID().slice(0, 8)}`;
    await createProject(
      page,
      postMutationProject,
      "Created after previous mutations to verify table stability"
    );

    await page.goto("/projects");
    await page.waitForURL("**/projects");

    const search = page.getByRole("searchbox", {
      name: "Search projects by name",
    });
    await search.fill(postMutationProject);

    await expect(
      page.getByRole("link", { name: postMutationProject })
    ).toBeVisible();
  });
});
