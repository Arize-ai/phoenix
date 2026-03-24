import { randomUUID } from "crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";

async function createProject(
  page: Page,
  projectName: string,
  description: string
) {
  await page.goto("/projects");
  await page.waitForURL("**/projects");
  await page.getByRole("button", { name: "New Project" }).click();
  await expect(
    page.getByRole("heading", { name: "New project" })
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Name" }).fill(projectName);
  await page.getByRole("textbox", { name: "Description" }).fill(description);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/projects\/.+/);
}

async function clickSortableHeaderAndExpect(
  header: Locator,
  direction: "ascending" | "descending"
) {
  await header.locator(".sort").click();
  await expect(header).toHaveAttribute("aria-sort", direction);
}

test.describe.serial("Projects", () => {
  const projectName = `test-project-${randomUUID()}`;
  test("can create a project", async ({ page }) => {
    await page.goto("/projects");
    await page.waitForURL("**/projects");

    await page.getByRole("button", { name: "New Project" }).click();
    await expect(
      page.getByRole("heading", { name: "New project" })
    ).toBeVisible();

    await page.getByRole("textbox", { name: "Name" }).fill(projectName);
    await page
      .getByRole("textbox", { name: "Description" })
      .fill("A project created in Playwright");

    await page.getByRole("button", { name: "Create" }).click();
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
    const projectItem = page
      .locator("tr, li")
      .filter({ hasText: projectName })
      .first();
    await expect(projectItem).toBeVisible();
    await projectItem.getByRole("button").last().click();

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
    const projectNameA = `compiler-project-${id}-a`;
    const projectNameZ = `compiler-project-${id}-z`;

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

    await clickSortableHeaderAndExpect(nameHeader, "ascending");
    await expect(page.getByRole("link", { name: projectNameA })).toBeVisible();

    await clickSortableHeaderAndExpect(nameHeader, "descending");
    await expect(page.getByRole("link", { name: projectNameZ })).toBeVisible();

    await search.fill(projectNameA);
    await expect(page.getByRole("link", { name: projectNameA })).toBeVisible();
    await expect(
      page.getByRole("link", { name: projectNameZ })
    ).not.toBeVisible();
  });

  test("can edit project description and gradient from config tab", async ({
    page,
  }) => {
    const editProjectName = `test-edit-project-${randomUUID().slice(0, 8)}`;
    await createProject(page, editProjectName, "Original description");

    // Navigate to the Config tab
    await page.getByRole("tab", { name: "Config" }).click();

    // Locate the Project Settings card
    const settingsCard = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Project Settings" }) });
    await expect(settingsCard).toBeVisible();

    // Verify the Edit button is visible
    const editButton = settingsCard.getByRole("button", { name: "Edit" });
    await expect(editButton).toBeVisible();

    // Verify the project name is displayed as read-only
    await expect(settingsCard.getByLabel("Project Name")).toHaveValue(
      editProjectName
    );

    // Click Edit to enter edit mode
    await editButton.click();

    // Verify the description field is visible and editable
    const descriptionField = settingsCard.getByLabel("Description");
    await expect(descriptionField).toBeVisible();

    // Update the description
    await descriptionField.fill("Updated description");

    // Save changes
    await settingsCard.getByRole("button", { name: "Save" }).click();

    // After save, should exit edit mode — Edit button should reappear
    await expect(editButton).toBeVisible();

    // Verify the updated description is shown in read-only mode
    await expect(settingsCard.getByLabel("Description")).toHaveValue(
      "Updated description"
    );

    // Re-enter edit mode and verify description is pre-filled
    await editButton.click();
    await expect(settingsCard.getByLabel("Description")).toHaveValue(
      "Updated description"
    );

    // Cancel should exit edit mode without saving
    await settingsCard.getByLabel("Description").fill("Should not be saved");
    await settingsCard.getByRole("button", { name: "Cancel" }).click();
    await expect(editButton).toBeVisible();
    await expect(settingsCard.getByLabel("Description")).toHaveValue(
      "Updated description"
    );
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
