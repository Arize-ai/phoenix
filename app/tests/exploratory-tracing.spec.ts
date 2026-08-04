import { randomUUID } from "crypto";
import { expect, test, type Page } from "@playwright/test";

/**
 * Exploratory coverage for the Tracing subtree (/projects and project detail).
 *
 * These tests focus on flows that work against an empty project (no trace
 * data): the new-project dialog validation, the empty-spans onboarding
 * panel, the sessions tab empty state + column selector popover, the
 * config tab default-tab setting, and the metrics tab chart layout.
 */

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
  // Creating a project navigates to its spans tab
  await expect(page).toHaveURL(/\/projects\/.+/);
}

test.describe("Exploratory: Tracing", () => {
  test("new project dialog validates a required name and can be cancelled", async ({
    page,
  }) => {
    await page.goto("/projects");
    await page.waitForURL("**/projects");

    await page.getByRole("button", { name: "New Project" }).click();
    await expect(
      page.getByRole("heading", { name: "New project" })
    ).toBeVisible();

    // Submitting with an empty name shows an inline validation error and
    // does not close the dialog or navigate.
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText("Project name is required")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "New project" })
    ).toBeVisible();
    await expect(page).toHaveURL(/\/projects(\?.*)?$/);

    // Cancel dismisses the dialog
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(
      page.getByRole("heading", { name: "New project" })
    ).not.toBeVisible();
  });

  test("empty project spans tab shows onboarding and integration search filters snippets", async ({
    page,
  }) => {
    const projectName = `exp-tracing-onboarding-${randomUUID()}`;
    await createProject(page, projectName, "Onboarding empty state test");

    // An empty project renders the tracing onboarding panel on the spans tab
    await expect(
      page.getByRole("heading", { name: "Install dependencies" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Implementation" })
    ).toBeVisible();

    // The integration list can be filtered by search
    const search = page.getByRole("searchbox", {
      name: "Search integrations",
    });
    await expect(
      page.getByRole("radio", { name: "OpenAI Agents" })
    ).toBeVisible();
    await search.fill("langchain");
    const langChainRadio = page.getByRole("radio", { name: "LangChain" });
    await expect(langChainRadio).toBeVisible();
    await expect(
      page.getByRole("radio", { name: "OpenAI Agents" })
    ).not.toBeVisible();

    // Selecting an integration updates the install snippet
    await langChainRadio.click();
    await expect(langChainRadio).toBeChecked();
    await expect(page.locator(".cm-content").first()).toContainText(
      "openinference-instrumentation-langchain"
    );

    // A TypeScript variant of the snippets is offered
    await page.getByRole("tab", { name: "TypeScript" }).click();
    await expect(page.locator(".cm-content").first()).toContainText(
      "@arizeai/phoenix-otel"
    );
  });

  test("sessions tab shows empty state and column visibility can be toggled", async ({
    page,
  }) => {
    const projectName = `exp-tracing-sessions-${randomUUID()}`;
    await createProject(page, projectName, "Sessions empty state test");

    await page.getByRole("tab", { name: "Sessions" }).click();
    await expect(page).toHaveURL(/\/sessions/);

    // Empty state row with a set-up call to action
    await expect(
      page.getByText("No sessions found for this project")
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Set up Sessions" })
    ).toBeVisible();

    // The "user" column is visible by default
    const userColumn = page.getByRole("columnheader", {
      name: /user column/,
    });
    await expect(userColumn).toBeVisible();

    // Toggle it off via the Columns popover (keyboard toggle — the checkbox
    // is a React Aria visually-hidden input)
    await page.getByRole("button", { name: "Columns" }).click();
    const userCheckbox = page.getByRole("checkbox", { name: "user" });
    await expect(userCheckbox).toBeChecked();
    await userCheckbox.focus();
    await page.keyboard.press("Space");
    await expect(userCheckbox).not.toBeChecked();
    await expect(userColumn).not.toBeVisible();

    // Escape dismisses the popover without touching the tab
    await page.keyboard.press("Escape");
    await expect(userCheckbox).not.toBeVisible();
    await expect(page.getByRole("tab", { name: "Sessions" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  test("default project tab set in config controls where the project root redirects", async ({
    page,
  }) => {
    const projectName = `exp-tracing-default-tab-${randomUUID()}`;
    await createProject(page, projectName, "Default tab config test");

    // Capture the project root URL (strip the /spans suffix and query)
    const projectRootURL = page.url().replace(/\/spans.*$/, "");

    await page.getByRole("tab", { name: "Config" }).click();
    await expect(
      page.getByRole("heading", { name: "Project Settings" })
    ).toBeVisible();

    // Change the default tab from Spans to Sessions
    const defaultTabSelect = page.getByRole("button", {
      name: /Default Project Tab/,
    });
    await expect(defaultTabSelect).toContainText("Spans");
    await defaultTabSelect.click();
    await page.getByRole("option", { name: "Sessions" }).click();
    await expect(defaultTabSelect).toContainText("Sessions");

    // The setting persists across a reload
    await page.reload();
    await expect(
      page.getByRole("button", { name: /Default Project Tab/ })
    ).toContainText("Sessions");

    // Visiting the project root now redirects to the sessions tab
    await page.goto(projectRootURL);
    await expect(page).toHaveURL(/\/sessions/);
    await expect(page.getByRole("tab", { name: "Sessions" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  test("metrics tab renders chart cards for an empty project", async ({
    page,
  }) => {
    const projectName = `exp-tracing-metrics-${randomUUID()}`;
    await createProject(page, projectName, "Metrics tab layout test");

    await page.getByRole("tab", { name: "Metrics" }).click();
    await expect(page).toHaveURL(/\/metrics/);

    await expect(
      page.getByRole("heading", { name: "Trace latency" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Token usage" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "LLM spans", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Tool spans", exact: true })
    ).toBeVisible();
  });

  test("projects table search shows a no-results state and can be cleared", async ({
    page,
  }) => {
    await page.goto("/projects");
    await page.waitForURL("**/projects");
    await page.getByRole("radio", { name: "Table view" }).click();

    const search = page.getByRole("searchbox", {
      name: "Search projects by name",
    });
    await search.fill(`no-such-project-${randomUUID()}`);
    await expect(page.getByText("No projects found")).toBeVisible();

    // Clearing the search restores the listing (default project always exists)
    await page.getByRole("button", { name: "Clear search" }).click();
    await expect(search).toHaveValue("");
    await expect(
      page
        .getByTestId("projects-table")
        .getByRole("link", { name: "default", exact: true })
    ).toBeVisible();
  });
});
