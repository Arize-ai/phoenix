import { expect, test } from "@playwright/test";

/**
 * Issue #17635: the Project evaluators tab's loading skeletons did not match
 * the loaded content, so the page jumped when its data arrived.
 */
test.describe("Project evaluators tab loading", () => {
  test("keeps its layout when the queue stats and charts load", async ({
    page,
  }) => {
    await page.goto("/projects");
    const evaluatorsLink = page.getByRole("link", { name: "Evaluators" });
    await expect(evaluatorsLink).toBeVisible();

    let releaseResponses = () => {};
    const responsesReleased = new Promise<void>((resolve) => {
      releaseResponses = resolve;
    });
    await page.route("**/graphql", async (route) => {
      const response = await route.fetch();
      await responsesReleased;
      await route.fulfill({ response });
    });

    await evaluatorsLink.click();
    const search = page.getByRole("searchbox", {
      name: "Search evaluators or projects",
    });
    const inQueue = page.getByRole("heading", { name: "In queue" });
    const queuedPerHour = page.getByRole("heading", { name: "Queued / hr" });
    const chartTitle = page.getByText("Queue size by project");
    const queueMeter = page.getByRole("img", { name: /^[\d,]+ of [\d,]+:/ });
    await expect(search).toBeVisible();
    await expect(queuedPerHour).toBeVisible();
    await expect(chartTitle).toBeHidden();
    await expect(queueMeter).toBeHidden();

    const loadingSearch = await search.boundingBox();
    const loadingInQueue = await inQueue.boundingBox();
    const loadingQueuedPerHour = await queuedPerHour.boundingBox();

    releaseResponses();
    await expect(chartTitle).toBeVisible();
    await expect(queueMeter).toBeVisible();

    expect(await search.boundingBox()).toEqual(loadingSearch);
    const loadedInQueue = await inQueue.boundingBox();
    const loadedQueuedPerHour = await queuedPerHour.boundingBox();
    expect(loadedQueuedPerHour!.x - loadedInQueue!.x).toEqual(
      loadingQueuedPerHour!.x - loadingInQueue!.x
    );
  });
});
