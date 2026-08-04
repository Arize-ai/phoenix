import { randomUUID } from "crypto";
import { expect, test, type Page } from "@playwright/test";

/**
 * Exploratory coverage for the Dashboards subtree (/dashboards).
 *
 * The Dashboards page is a project-scoped metrics dashboard: a toolbar with a
 * project menu (searchable popover) and a time range selector, and a grid of
 * chart panels for the selected project. With no trace data the panels render
 * in their "No data in this time range" empty state, which is asserted here.
 */

function projectMenuTrigger(page: Page) {
  // Reads "Project" when nothing is selected and "Project: <name>" otherwise.
  return page.getByRole("button", { name: /^Project(: .*)?$/ });
}

async function createProject(page: Page, projectName: string) {
  await page.goto("/projects");
  await page.waitForURL("**/projects");
  await page.getByRole("button", { name: "New Project" }).click();
  await expect(
    page.getByRole("heading", { name: "New project" })
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Name" }).fill(projectName);
  await page.getByRole("button", { name: "Create" }).click();
  // Creating a project navigates to its tracing page.
  await expect(page).toHaveURL(/\/projects\/.+/);
}

test.describe("Dashboards", () => {
  test("shows an empty state when no project has been selected", async ({
    page,
  }) => {
    await page.goto("/dashboards");
    await page.waitForURL("**/dashboards**");

    await expect(page.getByText("No project selected")).toBeVisible();
    await expect(
      page.getByText("Select a project to view its dashboards.")
    ).toBeVisible();
    // The toolbar renders even before a project is selected.
    await expect(projectMenuTrigger(page)).toBeVisible();
  });

  test("selecting a project renders its metrics dashboard and is remembered", async ({
    page,
  }) => {
    await page.goto("/dashboards");
    await page.waitForURL("**/dashboards**");

    await projectMenuTrigger(page).click();
    await page
      .getByRole("menuitemradio", { name: "default", exact: true })
      .click();

    // Selection navigates to the project-scoped dashboard route.
    await expect(page).toHaveURL(/\/dashboards\/projects\/.+/);
    await expect(
      page.getByRole("button", { name: "Project: default" })
    ).toBeVisible();

    // Chart panels render for the selected project.
    await expect(
      page.getByRole("heading", { name: "Traces", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Trace latency" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Token usage", exact: true })
    ).toBeVisible();
    expect(
      await page.getByTestId("chart-panel").count()
    ).toBeGreaterThanOrEqual(10);
    // With no traces in the database the panels show their empty state.
    await expect(
      page.getByText("No data in this time range").first()
    ).toBeVisible();

    // Revisiting /dashboards redirects to the last-selected project.
    await page.goto("/dashboards");
    await expect(page).toHaveURL(/\/dashboards\/projects\/.+/);
    await expect(
      page.getByRole("button", { name: "Project: default" })
    ).toBeVisible();
  });

  test("project menu search filters projects and shows no-results state", async ({
    page,
  }) => {
    const projectName = `exp-dashboards-${randomUUID()}`;
    await createProject(page, projectName);

    await page.goto("/dashboards");
    await page.waitForURL("**/dashboards**");

    await projectMenuTrigger(page).click();
    const search = page.getByRole("searchbox", { name: "Search projects" });
    await expect(search).toBeVisible();

    // A query that matches nothing shows the empty menu state.
    await search.fill(`no-match-${randomUUID()}`);
    await expect(page.getByText("No results")).toBeVisible();
    await expect(
      page.getByRole("menuitemradio", { name: "default", exact: true })
    ).not.toBeVisible();

    // Searching for the created project narrows the menu to it.
    await search.fill(projectName);
    const projectItem = page.getByRole("menuitemradio", {
      name: projectName,
    });
    await expect(projectItem).toBeVisible();
    await expect(
      page.getByRole("menuitemradio", { name: "default", exact: true })
    ).not.toBeVisible();

    // Selecting the filtered project navigates to its dashboard.
    await projectItem.click();
    await expect(page).toHaveURL(/\/dashboards\/projects\/.+/);
    await expect(
      page.getByRole("button", { name: `Project: ${projectName}` })
    ).toBeVisible();
  });

  test("time range presets and pan controls update the dashboard URL", async ({
    page,
  }) => {
    await page.goto("/dashboards");
    await page.waitForURL("**/dashboards**");
    await projectMenuTrigger(page).click();
    await page
      .getByRole("menuitemradio", { name: "default", exact: true })
      .click();
    await expect(page).toHaveURL(/\/dashboards\/projects\/.+/);

    // Default preset is Last 7 Days; switch to Last Day via the popover.
    await page.getByRole("button", { name: "Last 7 Days" }).click();
    const presetList = page.getByRole("listbox", {
      name: "time range preset selection",
    });
    await expect(presetList).toBeVisible();
    await page.getByRole("option", { name: "Last Day" }).click();

    await expect(page).toHaveURL(/timeRangeKey=1d/);
    await expect(page.getByRole("button", { name: "Last Day" })).toBeVisible();
    await expect(presetList).not.toBeVisible();

    // Panning back converts the range to an explicit custom start/end and
    // enables panning forward again.
    const panForward = page.getByRole("button", {
      name: "Pan forward in time",
    });
    await expect(panForward).toBeDisabled();
    await page.getByRole("button", { name: "Pan back in time" }).click();
    await expect(page).toHaveURL(/timeRangeStart=/);
    await expect(page).toHaveURL(/timeRangeEnd=/);
    await expect(panForward).toBeEnabled();
  });
});
