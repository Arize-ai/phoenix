import { randomUUID } from "crypto";
import { expect, test } from "@playwright/test";

/**
 * Test for issue #15685: the dashboards page remembers the last selected
 * project and returns to it, so once that project was deleted every visit to
 * the dashboards page failed with an error.
 */
test.describe("Dashboards", () => {
  test("forgets a remembered project that has since been deleted", async ({
    page,
    request,
  }) => {
    const projectName = `dashboards-deleted-${randomUUID().slice(0, 8)}`;
    const createProjectResponse = await request.post("/v1/projects", {
      data: { name: projectName },
    });
    expect(createProjectResponse.ok()).toBeTruthy();
    const projectId: string = (await createProjectResponse.json()).data.id;

    // Select the project so the dashboards page remembers it
    await page.goto("/dashboards");
    await page.getByRole("button", { name: "Project", exact: true }).click();
    await page
      .getByRole("searchbox", { name: "Search projects" })
      .fill(projectName);
    await page.getByRole("menuitemradio", { name: projectName }).click();
    await expect(page).toHaveURL(
      new RegExp(`/dashboards/projects/${projectId}`)
    );

    const deleteProjectResponse = await request.delete(
      `/v1/projects/${projectId}`
    );
    expect(deleteProjectResponse.ok()).toBeTruthy();

    // Returning to the dashboards page no longer redirects to the deleted project
    await page.goto("/dashboards");
    await expect(page.getByText("No project selected")).toBeVisible();
    await expect(page).not.toHaveURL(/\/dashboards\/projects\//);
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
  });
});
