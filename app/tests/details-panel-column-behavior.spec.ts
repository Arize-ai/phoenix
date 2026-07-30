import { randomUUID } from "crypto";
import type { APIRequestContext, Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const TREE_PREFERENCE_KEY = "arize-phoenix-trace-tree-width";
const MAIN_PREFERENCE_KEY =
  "arize-phoenix-drawer-details-panel-main-column-size";

const FACTORY_DRAWER_WIDTH = 1329;
const FACTORY_TREE_WIDTH = 368;
const FACTORY_MAIN_WIDTH = 960;
const MINIMUM_DRAWER_WIDTH = 689;
const MINIMUM_TREE_WIDTH = 48;
const MINIMUM_EXPANDED_TREE_WIDTH = 300;
const MINIMUM_MAIN_WIDTH = 640;
const MAXIMUM_MAIN_WIDTH = 1200;
const TRACE_TREE_TIMING_MINIMUM_WIDTH = 150;

type DetailsPanelFixture = {
  childSpanNodeId: string;
  projectId: string;
  sessionId: string;
  traceId: string;
};

type DetailsPanelLayout = {
  drawerWidth: number;
  mainLeft: number;
  mainScrollLeft: number;
  mainWidth: number;
  treeWidth: number;
};

async function createDetailsPanelFixture({
  request,
  projectName,
}: {
  request: APIRequestContext;
  projectName: string;
}): Promise<DetailsPanelFixture> {
  const fixtureId = randomUUID().replaceAll("-", "");
  const traceId = `trace-${fixtureId}`;
  const parentSpanId = `parent-${fixtureId}`;
  const childSpanId = `child-${fixtureId}`;
  const sessionIdentifier = `session-${fixtureId}`;
  const adjacentTraceId = `adjacent-trace-${fixtureId}`;
  const adjacentSpanId = `adjacent-span-${fixtureId}`;
  const adjacentSessionIdentifier = `adjacent-session-${fixtureId}`;
  const startTime = new Date().toISOString();
  const endTime = new Date(Date.now() + 1_000).toISOString();

  const createResponse = await request.post(
    `/v1/projects/${projectName}/spans`,
    {
      data: {
        data: [
          {
            name: "Details panel root",
            context: { trace_id: traceId, span_id: parentSpanId },
            span_kind: "CHAIN",
            start_time: startTime,
            end_time: endTime,
            status_code: "OK",
            attributes: { "session.id": sessionIdentifier },
          },
          {
            name: "Details panel child",
            context: { trace_id: traceId, span_id: childSpanId },
            parent_id: parentSpanId,
            span_kind: "LLM",
            start_time: startTime,
            end_time: endTime,
            status_code: "OK",
            attributes: { "session.id": sessionIdentifier },
          },
          {
            name: "Adjacent session root",
            context: {
              trace_id: adjacentTraceId,
              span_id: adjacentSpanId,
            },
            span_kind: "CHAIN",
            start_time: startTime,
            end_time: endTime,
            status_code: "OK",
            attributes: { "session.id": adjacentSessionIdentifier },
          },
        ],
      },
    }
  );
  expect(createResponse.ok()).toBe(true);

  await expect
    .poll(async () => {
      const response = await request.get(`/v1/projects/${projectName}`);
      return response.ok();
    })
    .toBe(true);

  const projectResponse = await request.get(`/v1/projects/${projectName}`);
  const projectBody = (await projectResponse.json()) as {
    data: { id: string };
  };

  await expect
    .poll(async () => {
      const response = await request.get(
        `/v1/projects/${projectName}/traces?include_spans=true`
      );
      if (!response.ok()) return false;
      const body = (await response.json()) as {
        data: Array<{ trace_id: string }>;
      };
      return body.data.some((trace) => trace.trace_id === traceId);
    })
    .toBe(true);

  const tracesResponse = await request.get(
    `/v1/projects/${projectName}/traces?include_spans=true`
  );
  const tracesBody = (await tracesResponse.json()) as {
    data: Array<{
      spans: Array<{ id: string; span_id: string }>;
      trace_id: string;
    }>;
  };
  const trace = tracesBody.data.find(
    (candidate) => candidate.trace_id === traceId
  );
  const childSpanNodeId = trace?.spans.find(
    (span) => span.span_id === childSpanId
  )?.id;
  expect(childSpanNodeId).toBeTruthy();

  await expect
    .poll(async () => {
      const response = await request.get(
        `/v1/projects/${projectName}/sessions`
      );
      if (!response.ok()) return false;
      const body = (await response.json()) as {
        data: Array<{ session_id: string }>;
      };
      const sessionIdentifiers = new Set(
        body.data.map((session) => session.session_id)
      );
      return (
        sessionIdentifiers.has(sessionIdentifier) &&
        sessionIdentifiers.has(adjacentSessionIdentifier)
      );
    })
    .toBe(true);

  const sessionsResponse = await request.get(
    `/v1/projects/${projectName}/sessions`
  );
  const sessionsBody = (await sessionsResponse.json()) as {
    data: Array<{ id: string; session_id: string }>;
  };
  const sessionId = sessionsBody.data.find(
    (session) => session.session_id === sessionIdentifier
  )?.id;
  expect(sessionId).toBeTruthy();

  return {
    childSpanNodeId: childSpanNodeId as string,
    projectId: projectBody.data.id,
    sessionId: sessionId as string,
    traceId,
  };
}

async function clearDetailsPanelPreferences(page: Page) {
  await page.goto("/");
  await page.evaluate(
    ([treePreferenceKey, mainPreferenceKey]) => {
      localStorage.removeItem(treePreferenceKey);
      localStorage.removeItem(mainPreferenceKey);
    },
    [TREE_PREFERENCE_KEY, MAIN_PREFERENCE_KEY]
  );
}

async function getDetailsPanelLayout(page: Page): Promise<DetailsPanelLayout> {
  const drawer = page.getByRole("complementary", { name: "Detail drawer" });
  const tree = page.getByTestId("details-panel-tree-column");
  const main = page.getByTestId("details-panel-main-column");
  await expect(drawer).toBeVisible();
  await expect(tree).toBeVisible();
  await expect(main).toBeVisible();

  const [drawerBox, treeBox, mainBox, mainScrollLeft] = await Promise.all([
    drawer.boundingBox(),
    tree.boundingBox(),
    main.boundingBox(),
    main.evaluate((element) => element.scrollLeft),
  ]);
  expect(drawerBox).not.toBeNull();
  expect(treeBox).not.toBeNull();
  expect(mainBox).not.toBeNull();

  return {
    drawerWidth: Math.round(drawerBox?.width ?? 0),
    mainLeft: Math.round(mainBox?.x ?? 0),
    mainScrollLeft,
    mainWidth: Math.round(mainBox?.width ?? 0),
    treeWidth: Math.round(treeBox?.width ?? 0),
  };
}

async function expectColumnWidths({
  page,
  drawerWidth,
  treeWidth,
  mainWidth,
}: {
  page: Page;
  drawerWidth: number;
  treeWidth: number;
  mainWidth: number;
}) {
  await expect
    .poll(async () => {
      const layout = await getDetailsPanelLayout(page);
      return `${layout.drawerWidth}/${layout.treeWidth}/${layout.mainWidth}`;
    })
    .toBe(`${drawerWidth}/${treeWidth}/${mainWidth}`);
}

async function getStoredPreferences(page: Page) {
  return page.evaluate(
    ([treePreferenceKey, mainPreferenceKey]) => ({
      main: localStorage.getItem(mainPreferenceKey),
      tree: localStorage.getItem(treePreferenceKey),
    }),
    [TREE_PREFERENCE_KEY, MAIN_PREFERENCE_KEY]
  );
}

async function getCenter(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return {
    x: (box?.x ?? 0) + (box?.width ?? 0) / 2,
    y: (box?.y ?? 0) + (box?.height ?? 0) / 2,
  };
}

async function closeAndReopenTraceDetails({
  page,
  fixture,
}: {
  page: Page;
  fixture: DetailsPanelFixture;
}) {
  const drawer = page.getByRole("complementary", { name: "Detail drawer" });
  await page.getByTestId("dialog-close-button").click();
  await expect(drawer).not.toBeVisible();
  await page.waitForURL(
    (url) => url.pathname === `/projects/${fixture.projectId}/traces`
  );

  const traceRow = page
    .getByRole("row")
    .filter({ hasText: "Details panel root" });
  await expect(traceRow).toBeVisible();
  await traceRow.click();
  await page.waitForURL(
    (url) =>
      url.pathname ===
      `/projects/${fixture.projectId}/traces/${fixture.traceId}`
  );
  await expect(drawer).toBeVisible();
}

test.describe("Details panel column behavior assertions", () => {
  let fixture: DetailsPanelFixture;
  const projectName = `details-panel-columns-${randomUUID().replaceAll("-", "")}`;

  test.beforeAll(async ({ request }) => {
    fixture = await createDetailsPanelFixture({ request, projectName });
  });

  test.afterAll(async ({ request }) => {
    const response = await request.delete(`/v1/projects/${projectName}`);
    expect([204, 404]).toContain(response.status());
  });

  test.beforeEach(async ({ page }) => {
    await clearDetailsPanelPreferences(page);
  });

  test("DW, CC, TC, and CP: derives, compresses, and reclaims columns across viewport sizes", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto(`/projects/${fixture.projectId}/traces/${fixture.traceId}`);

    await expectColumnWidths({
      page,
      drawerWidth: FACTORY_DRAWER_WIDTH,
      treeWidth: FACTORY_TREE_WIDTH,
      mainWidth: FACTORY_MAIN_WIDTH,
    });

    await page.setViewportSize({ width: 1000, height: 900 });
    await expectColumnWidths({
      page,
      drawerWidth: 950,
      treeWidth: 309,
      mainWidth: MINIMUM_MAIN_WIDTH,
    });

    await page.setViewportSize({ width: 680, height: 900 });
    await expectColumnWidths({
      page,
      drawerWidth: MINIMUM_DRAWER_WIDTH,
      treeWidth: MINIMUM_TREE_WIDTH,
      mainWidth: MINIMUM_MAIN_WIDTH,
    });

    await page.setViewportSize({ width: 1600, height: 900 });
    await expectColumnWidths({
      page,
      drawerWidth: FACTORY_DRAWER_WIDTH,
      treeWidth: FACTORY_TREE_WIDTH,
      mainWidth: FACTORY_MAIN_WIDTH,
    });
    await expect
      .poll(() => getStoredPreferences(page))
      .toEqual({
        main: null,
        tree: null,
      });
  });

  test("shows session loading feedback without replacing the column shell after arrow click", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto(
      `/projects/${fixture.projectId}/sessions/${encodeURIComponent(fixture.sessionId)}`
    );
    await expect(
      page.getByTestId("session-details-skeleton")
    ).not.toBeVisible();
    const initialLayout = await getDetailsPanelLayout(page);
    const group = page.locator(".details-panel-columns");
    const tree = page.getByTestId("details-panel-tree-column");
    const main = page.getByTestId("details-panel-main-column");
    await group.evaluate((element) => {
      element.setAttribute("data-stable-shell", "true");
    });
    await tree.evaluate((element) => {
      element.setAttribute("data-stable-tree", "true");
    });
    await main.evaluate((element) => {
      element.setAttribute("data-stable-main", "true");
    });
    let hasBlockedDetailsRequest = false;
    let releaseDetailsRequest: () => void = () => {};
    await page.route("**/graphql", async (route) => {
      const postData = route.request().postData();
      if (
        !hasBlockedDetailsRequest &&
        postData?.includes("SessionDetailsTraceListQuery")
      ) {
        const response = await route.fetch();
        hasBlockedDetailsRequest = true;
        await new Promise<void>((resolve) => {
          releaseDetailsRequest = resolve;
        });
        await route.fulfill({ response });
        return;
      }
      await route.continue();
    });

    const nextButton = page.getByRole("button", { name: "Next session" });
    const previousButton = page.getByRole("button", {
      name: "Previous session",
    });
    const navigationButton = (await nextButton.isEnabled())
      ? nextButton
      : previousButton;
    await expect(navigationButton).toBeEnabled();
    await navigationButton.click();

    await expect.poll(() => hasBlockedDetailsRequest).toBe(true);
    await expect(page.getByTestId("session-details-skeleton")).toBeVisible();
    await expect(group).toHaveAttribute("data-stable-shell", "true");
    await expect(tree).toHaveAttribute("data-stable-tree", "true");
    await expect(main).toHaveAttribute("data-stable-main", "true");
    expect(await getDetailsPanelLayout(page)).toEqual(initialLayout);

    releaseDetailsRequest();
    await expect(
      page.getByTestId("session-details-skeleton")
    ).not.toBeVisible();
    await expect(group).toHaveAttribute("data-stable-shell", "true");
    await expect(tree).toHaveAttribute("data-stable-tree", "true");
    await expect(main).toHaveAttribute("data-stable-main", "true");
    expect(await getDetailsPanelLayout(page)).toEqual(initialLayout);
  });

  test("keeps a span-only deep link unfolded through cold compact and hover states", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 680, height: 900 });
    let hasBlockedTreeQuery = false;
    let releaseTreeQuery: () => void = () => {};
    const pendingTreeQuery = new Promise<void>((resolve) => {
      releaseTreeQuery = resolve;
    });
    await page.route("**/graphql", async (route) => {
      const postData = route.request().postData();
      if (
        !hasBlockedTreeQuery &&
        postData?.includes("SessionDetailsTracesViewTreeQuery")
      ) {
        const response = await route.fetch();
        hasBlockedTreeQuery = true;
        await pendingTreeQuery;
        await route.fulfill({ response });
        return;
      }
      await route.continue();
    });

    try {
      await page.goto(
        `/projects/${fixture.projectId}/sessions/${encodeURIComponent(fixture.sessionId)}?sessionView=traces&selectedSpanNodeId=${encodeURIComponent(fixture.childSpanNodeId)}`
      );
      await expect.poll(() => hasBlockedTreeQuery).toBe(true);
      await expect
        .poll(() => new URL(page.url()).searchParams.get("selectedTraceId"))
        .toBe(fixture.traceId);

      const traceHeader = page.getByTestId("session-trace-row-header").first();
      const sessionNavigation = page.locator(".session-details-navigation");
      const sessionNavigationBody = page.locator(
        ".session-details-navigation__body"
      );
      const compactLoadingList = page.getByRole("list", {
        name: "Loading trace navigation",
      });
      await expect(traceHeader).toHaveAttribute("aria-expanded", "true");
      await page
        .getByRole("button", { name: "Collapse trace navigation" })
        .click();
      await expect(sessionNavigation).toHaveAttribute("data-collapsed", "true");
      await expect(sessionNavigation).toHaveAttribute("data-open", "false");
      await expect(compactLoadingList).toBeVisible();

      await sessionNavigationBody.hover({ position: { x: 24, y: 24 } });
      await expect(sessionNavigation).toHaveAttribute("data-open", "true");
      await expect(compactLoadingList).toHaveCount(0);
      await expect(page.getByTestId("trace-tree-skeleton")).toBeVisible();

      await page
        .getByTestId("details-panel-main-column")
        .hover({ position: { x: 100, y: 100 } });
      await expect(sessionNavigation).toHaveAttribute("data-open", "false");
      await expect(compactLoadingList).toBeVisible();

      await sessionNavigationBody.hover({ position: { x: 24, y: 24 } });
      await expect(sessionNavigation).toHaveAttribute("data-open", "true");
    } finally {
      releaseTreeQuery();
    }

    const sessionNavigation = page.locator(".session-details-navigation");
    const sessionNavigationBody = page.locator(
      ".session-details-navigation__body"
    );
    const fullTree = page.locator(".trace-tree-navigation__full");
    const childSpan = fullTree.locator(
      `[data-trace-tree-span-node-id="${fixture.childSpanNodeId}"]`
    );
    const compactTree = page.getByTestId("trace-tree-icon-rail");
    const mainDetailView = page.getByTestId("details-panel-main-column");
    await expect(childSpan).toBeVisible();

    await mainDetailView.hover({ position: { x: 100, y: 100 } });
    await expect(compactTree).toBeVisible();
    await compactTree.getByRole("button").first().hover();
    await expect(sessionNavigation).toHaveAttribute("data-open", "true");
    await mainDetailView.hover({ position: { x: 100, y: 100 } });
    await expect(sessionNavigation).toHaveAttribute("data-open", "false");
    await expect(compactTree).toBeVisible();

    await sessionNavigationBody.hover({ position: { x: 24, y: 24 } });
    await expect(sessionNavigation).toHaveAttribute("data-open", "true");
    await fullTree.locator(".collapse-toggle-button").first().click();
    await expect(childSpan).not.toBeVisible();

    await mainDetailView.hover({ position: { x: 100, y: 100 } });
    await expect(sessionNavigation).toHaveAttribute("data-open", "false");
    await mainDetailView.click({ position: { x: 300, y: 400 } });
    await expect(sessionNavigation).toHaveAttribute("data-open", "false");
    await expect(compactTree).toBeVisible();
    await expect(
      compactTree.getByRole("button", {
        name: "View span Details panel child",
      })
    ).toHaveCount(0);
    await sessionNavigationBody.hover({ position: { x: 24, y: 24 } });
    await expect(childSpan).not.toBeVisible();
  });

  test("shows trace navigation feedback without replacing the column shell after hotkey", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto(`/projects/${fixture.projectId}/traces/${fixture.traceId}`);
    await expect(page.getByTestId("trace-details-skeleton")).not.toBeVisible();
    const initialLayout = await getDetailsPanelLayout(page);
    const group = page.locator(".details-panel-columns");
    const tree = page.getByTestId("details-panel-tree-column");
    const main = page.getByTestId("details-panel-main-column");
    await group.evaluate((element) => {
      element.setAttribute("data-stable-shell", "true");
    });
    await tree.evaluate((element) => {
      element.setAttribute("data-stable-tree", "true");
    });
    await main.evaluate((element) => {
      element.setAttribute("data-stable-main", "true");
    });
    const initialNavigationText = await page
      .locator(".details-panel-navigation-content")
      .textContent();

    let hasBlockedDetailsRequest = false;
    let releaseDetailsRequest: () => void = () => {};
    await page.route("**/graphql", async (route) => {
      const postData = route.request().postData();
      if (
        !hasBlockedDetailsRequest &&
        postData?.includes("TraceDetailsQuery")
      ) {
        const response = await route.fetch();
        hasBlockedDetailsRequest = true;
        await new Promise<void>((resolve) => {
          releaseDetailsRequest = resolve;
        });
        await route.fulfill({ response });
        return;
      }
      await route.continue();
    });

    const nextButton = page.getByRole("button", { name: "Next trace" });
    const previousButton = page.getByRole("button", {
      name: "Previous trace",
    });
    const hotkey = (await nextButton.isEnabled()) ? "j" : "k";
    expect(
      (await nextButton.isEnabled()) || (await previousButton.isEnabled())
    ).toBe(true);
    await page.keyboard.press(hotkey);

    await expect.poll(() => hasBlockedDetailsRequest).toBe(true);
    await expect
      .poll(async () => {
        const isSkeletonVisible = await page
          .getByTestId("trace-details-skeleton")
          .isVisible();
        const navigationText = await page
          .locator(".details-panel-navigation-content")
          .textContent();
        return isSkeletonVisible || navigationText !== initialNavigationText;
      })
      .toBe(true);
    await expect(group).toHaveAttribute("data-stable-shell", "true");
    await expect(tree).toHaveAttribute("data-stable-tree", "true");
    await expect(main).toHaveAttribute("data-stable-main", "true");
    expect(await getDetailsPanelLayout(page)).toEqual(initialLayout);

    releaseDetailsRequest();
    await expect(page.getByTestId("trace-details-skeleton")).not.toBeVisible();
    await expect(group).toHaveAttribute("data-stable-shell", "true");
    await expect(tree).toHaveAttribute("data-stable-tree", "true");
    await expect(main).toHaveAttribute("data-stable-main", "true");
    expect(await getDetailsPanelLayout(page)).toEqual(initialLayout);
  });

  test("DW-3, CP-2, CP-5, and PS: drawer drag updates only the released main preference", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto(`/projects/${fixture.projectId}/traces/${fixture.traceId}`);
    await expectColumnWidths({
      page,
      drawerWidth: FACTORY_DRAWER_WIDTH,
      treeWidth: FACTORY_TREE_WIDTH,
      mainWidth: FACTORY_MAIN_WIDTH,
    });

    const drawerSeparator = page.getByRole("separator", {
      name: "Resize drawer",
    });
    const start = await getCenter(drawerSeparator);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await expect(drawerSeparator).toHaveAttribute("data-dragging", "true");

    await page.mouse.move(start.x + 500, start.y);
    await expectColumnWidths({
      page,
      drawerWidth: 829,
      treeWidth: 188,
      mainWidth: MINIMUM_MAIN_WIDTH,
    });
    expect(await getStoredPreferences(page)).toEqual({
      main: null,
      tree: null,
    });

    await page.mouse.move(start.x + 320, start.y);
    await expectColumnWidths({
      page,
      drawerWidth: 1009,
      treeWidth: FACTORY_TREE_WIDTH,
      mainWidth: MINIMUM_MAIN_WIDTH,
    });

    await page.mouse.move(start.x + 20, start.y);
    await expectColumnWidths({
      page,
      drawerWidth: 1309,
      treeWidth: FACTORY_TREE_WIDTH,
      mainWidth: 940,
    });
    expect(await getStoredPreferences(page)).toEqual({
      main: null,
      tree: null,
    });
    await page.mouse.up();

    await expect
      .poll(() => getStoredPreferences(page))
      .toEqual({
        main: "940",
        tree: null,
      });
    await closeAndReopenTraceDetails({ page, fixture });
    await expectColumnWidths({
      page,
      drawerWidth: 1309,
      treeWidth: FACTORY_TREE_WIDTH,
      mainWidth: 940,
    });
    await page.reload();
    await expectColumnWidths({
      page,
      drawerWidth: 1309,
      treeWidth: FACTORY_TREE_WIDTH,
      mainWidth: 940,
    });
  });

  test("PS-3: a max-width drawer reopens at its released narrower width", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto(`/projects/${fixture.projectId}/traces/${fixture.traceId}`);
    await expectColumnWidths({
      page,
      drawerWidth: FACTORY_DRAWER_WIDTH,
      treeWidth: FACTORY_TREE_WIDTH,
      mainWidth: FACTORY_MAIN_WIDTH,
    });

    const drawerSeparator = page.getByRole("separator", {
      name: "Resize drawer",
    });
    const factoryStart = await getCenter(drawerSeparator);
    await page.mouse.move(factoryStart.x, factoryStart.y);
    await page.mouse.down();
    await expect(drawerSeparator).toHaveAttribute("data-dragging", "true");
    await page.mouse.move(0, factoryStart.y);
    await page.mouse.up();
    await expectColumnWidths({
      page,
      drawerWidth: 1520,
      treeWidth: FACTORY_TREE_WIDTH,
      mainWidth: 1151,
    });
    expect(await getStoredPreferences(page)).toEqual({
      main: "1151",
      tree: null,
    });

    await closeAndReopenTraceDetails({ page, fixture });
    await expectColumnWidths({
      page,
      drawerWidth: 1520,
      treeWidth: FACTORY_TREE_WIDTH,
      mainWidth: 1151,
    });

    const maximumStart = await getCenter(drawerSeparator);
    await page.mouse.move(maximumStart.x, maximumStart.y);
    await page.mouse.down();
    await expect(drawerSeparator).toHaveAttribute("data-dragging", "true");
    await page.mouse.move(maximumStart.x + 200, maximumStart.y);
    await page.mouse.up();
    await expectColumnWidths({
      page,
      drawerWidth: 1320,
      treeWidth: FACTORY_TREE_WIDTH,
      mainWidth: 951,
    });

    expect(await getStoredPreferences(page)).toEqual({
      main: "951",
      tree: null,
    });
    await closeAndReopenTraceDetails({ page, fixture });
    await expectColumnWidths({
      page,
      drawerWidth: 1320,
      treeWidth: FACTORY_TREE_WIDTH,
      mainWidth: 951,
    });

    await page.reload();
    await expectColumnWidths({
      page,
      drawerWidth: 1320,
      treeWidth: FACTORY_TREE_WIDTH,
      mainWidth: 951,
    });
  });

  test("CC-2, TC-4, TC-5, TC-8, TC-9, and PS-7: one tree drag shrinks the tree before handing leftward overflow to the drawer", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 2000, height: 900 });
    await page.goto(`/projects/${fixture.projectId}/traces/${fixture.traceId}`);
    await expectColumnWidths({
      page,
      drawerWidth: FACTORY_DRAWER_WIDTH + TRACE_TREE_TIMING_MINIMUM_WIDTH,
      treeWidth: FACTORY_TREE_WIDTH + TRACE_TREE_TIMING_MINIMUM_WIDTH,
      mainWidth: FACTORY_MAIN_WIDTH,
    });

    const treeSeparator = page.getByTestId("details-panel-tree-separator");
    const start = await getCenter(treeSeparator);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await expect(treeSeparator).toHaveAttribute("data-dragging", "true");
    await page.mouse.move(start.x - 100, start.y);

    await expectColumnWidths({
      page,
      drawerWidth: FACTORY_DRAWER_WIDTH + TRACE_TREE_TIMING_MINIMUM_WIDTH,
      treeWidth: FACTORY_TREE_WIDTH + TRACE_TREE_TIMING_MINIMUM_WIDTH - 100,
      mainWidth: FACTORY_MAIN_WIDTH + 100,
    });
    const beforeHandoffCenter = await getCenter(treeSeparator);
    expect(Math.round(beforeHandoffCenter.x)).toBe(Math.round(start.x - 100));

    await page.mouse.move(start.x - 200, start.y);

    await expectColumnWidths({
      page,
      drawerWidth: 1551,
      treeWidth: MINIMUM_EXPANDED_TREE_WIDTH + TRACE_TREE_TIMING_MINIMUM_WIDTH,
      mainWidth: 1160,
    });
    const narrowSeparatorCenter = await getCenter(treeSeparator);
    expect(Math.round(narrowSeparatorCenter.x)).toBe(Math.round(start.x - 200));

    await page.mouse.move(start.x + 200, start.y);
    await expectColumnWidths({
      page,
      drawerWidth: FACTORY_DRAWER_WIDTH + TRACE_TREE_TIMING_MINIMUM_WIDTH,
      treeWidth: 718,
      mainWidth: 760,
    });

    await page.mouse.move(start.x + 500, start.y);

    await expectColumnWidths({
      page,
      drawerWidth: 1479,
      treeWidth: 838,
      mainWidth: MINIMUM_MAIN_WIDTH,
    });
    expect(await getStoredPreferences(page)).toEqual({
      main: null,
      tree: null,
    });
    await page.mouse.up();

    await expect
      .poll(() => getStoredPreferences(page))
      .toEqual({
        main: null,
        tree: "688",
      });
    await page.reload();
    await expectColumnWidths({
      page,
      drawerWidth: 1799,
      treeWidth: 838,
      mainWidth: FACTORY_MAIN_WIDTH,
    });
  });

  test("TC-4 and TC-8: a rightward tree drag clamps at the main minimum", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 2000, height: 900 });
    await page.evaluate(
      ([mainPreferenceKey, mainWidth]) => {
        localStorage.setItem(mainPreferenceKey, mainWidth);
      },
      [MAIN_PREFERENCE_KEY, String(MINIMUM_MAIN_WIDTH)]
    );
    await page.goto(
      `/projects/${fixture.projectId}/sessions/${encodeURIComponent(fixture.sessionId)}?sessionView=traces&selectedSpanNodeId=${encodeURIComponent(fixture.childSpanNodeId)}`
    );
    await expectColumnWidths({
      page,
      drawerWidth: 1009,
      treeWidth: FACTORY_TREE_WIDTH,
      mainWidth: MINIMUM_MAIN_WIDTH,
    });

    const treeSeparator = page.getByTestId("details-panel-tree-separator");
    const start = await getCenter(treeSeparator);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 200, start.y);
    await expectColumnWidths({
      page,
      drawerWidth: 1009,
      treeWidth: FACTORY_TREE_WIDTH,
      mainWidth: MINIMUM_MAIN_WIDTH,
    });
    await treeSeparator.dispatchEvent("pointercancel", {
      bubbles: true,
      cancelable: true,
      isPrimary: true,
      pointerId: 1,
      pointerType: "mouse",
    });
    await expect(treeSeparator).not.toHaveAttribute("data-dragging", "true");
    await expectColumnWidths({
      page,
      drawerWidth: 1009,
      treeWidth: FACTORY_TREE_WIDTH,
      mainWidth: MINIMUM_MAIN_WIDTH,
    });
    expect(await getStoredPreferences(page)).toEqual({
      main: String(MINIMUM_MAIN_WIDTH),
      tree: null,
    });
    await page.mouse.up();

    const restarted = await getCenter(treeSeparator);
    await page.mouse.move(restarted.x, restarted.y);
    await page.mouse.down();
    await page.mouse.move(restarted.x + 200, restarted.y);
    await page.mouse.up();
    await expectColumnWidths({
      page,
      drawerWidth: 1009,
      treeWidth: FACTORY_TREE_WIDTH,
      mainWidth: MINIMUM_MAIN_WIDTH,
    });
    await expect
      .poll(() => getStoredPreferences(page))
      .toEqual({
        main: String(MINIMUM_MAIN_WIDTH),
        tree: null,
      });
  });

  test("NR and UN: narrow and ultra-narrow overlays never displace the main column", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto(`/projects/${fixture.projectId}/traces/${fixture.traceId}`);
    await expectColumnWidths({
      page,
      drawerWidth: FACTORY_DRAWER_WIDTH,
      treeWidth: FACTORY_TREE_WIDTH,
      mainWidth: FACTORY_MAIN_WIDTH,
    });

    const drawerSeparator = page.getByRole("separator", {
      name: "Resize drawer",
    });
    const start = await getCenter(drawerSeparator);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await expect(drawerSeparator).toHaveAttribute("data-dragging", "true");

    // Scope toolbar actions to the tree panel: the span-details tab bar has
    // its own "Collapse all" control with the same accessible name.
    const treeContent = page.getByTestId("scrolling-panel-content");
    const search = page.getByRole("searchbox", { name: "Search trace tree" });
    const collapseButton = treeContent.getByRole("button", {
      name: "Collapse all",
    });
    const timingButton = treeContent.getByRole("button", {
      name: /metrics in trace tree/,
    });

    await page.mouse.move(start.x + 448, start.y);
    await expectColumnWidths({
      page,
      drawerWidth: 881,
      treeWidth: 240,
      mainWidth: MINIMUM_MAIN_WIDTH,
    });
    await expect
      .poll(() =>
        search.evaluate((element) => getComputedStyle(element).opacity)
      )
      .toBe("1");

    await page.mouse.move(start.x + 449, start.y);
    await expectColumnWidths({
      page,
      drawerWidth: 880,
      treeWidth: 239,
      mainWidth: MINIMUM_MAIN_WIDTH,
    });
    await expect
      .poll(() =>
        search.evaluate((element) => getComputedStyle(element).opacity)
      )
      .toBe("0");

    await page.mouse.move(start.x + 560, start.y);
    await expectColumnWidths({
      page,
      drawerWidth: 769,
      treeWidth: 128,
      mainWidth: MINIMUM_MAIN_WIDTH,
    });
    const horizontalActionCenters = await Promise.all(
      [search, collapseButton, timingButton].map(getCenter)
    );
    expect(
      new Set(horizontalActionCenters.map(({ y }) => Math.round(y))).size
    ).toBe(1);

    await page.mouse.move(start.x + 561, start.y);
    await expectColumnWidths({
      page,
      drawerWidth: 768,
      treeWidth: 127,
      mainWidth: MINIMUM_MAIN_WIDTH,
    });
    const verticalActionCenters = await Promise.all(
      [search, collapseButton, timingButton].map(getCenter)
    );
    expect(verticalActionCenters[0].y).toBeLessThan(verticalActionCenters[1].y);
    expect(verticalActionCenters[1].y).toBeLessThan(verticalActionCenters[2].y);

    await page.mouse.move(start.x + 640, start.y);
    await expectColumnWidths({
      page,
      drawerWidth: MINIMUM_DRAWER_WIDTH,
      treeWidth: MINIMUM_TREE_WIDTH,
      mainWidth: MINIMUM_MAIN_WIDTH,
    });
    await page.mouse.up();

    const mainBeforeOverlay = await getDetailsPanelLayout(page);
    const content = treeContent;
    await content.hover();
    await expect
      .poll(async () => Math.round((await content.boundingBox())?.width ?? 0))
      .toBe(240);
    const mainDuringOverlay = await getDetailsPanelLayout(page);
    expect(mainDuringOverlay).toEqual(mainBeforeOverlay);
    await expect(
      content.getByText("Collapse all", { exact: true })
    ).toBeVisible();
    await expect(content.getByText(/^(Show|Hide) timing$/)).toBeVisible();
    await expect
      .poll(() =>
        search.evaluate((element) => getComputedStyle(element).opacity)
      )
      .toBe("1");

    const overlaySeparator = page.getByTestId("details-panel-tree-separator");
    const overlaySeparatorCenter = await getCenter(overlaySeparator);
    await page.mouse.move(overlaySeparatorCenter.x, overlaySeparatorCenter.y);
    await page.mouse.down();
    await page.mouse.up();
    await expectColumnWidths({
      page,
      drawerWidth: MINIMUM_DRAWER_WIDTH,
      treeWidth: MINIMUM_TREE_WIDTH,
      mainWidth: MINIMUM_MAIN_WIDTH,
    });
    await expect
      .poll(() => getStoredPreferences(page))
      .toEqual({
        main: String(MINIMUM_MAIN_WIDTH),
        tree: null,
      });

    await collapseButton.click();
    await expect(
      content.getByRole("button", { name: "Expand all", exact: true })
    ).toBeVisible();

    await search.focus();
    await expect
      .poll(async () => Math.round((await content.boundingBox())?.width ?? 0))
      .toBe(240);
    const mainDuringFocusOverlay = await getDetailsPanelLayout(page);
    expect(mainDuringFocusOverlay).toEqual(mainBeforeOverlay);
  });

  test("CC-5: the main panel and drawer stop at the same maximum width", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 2000, height: 900 });
    await page.goto(`/projects/${fixture.projectId}/traces/${fixture.traceId}`);
    await expectColumnWidths({
      page,
      drawerWidth: FACTORY_DRAWER_WIDTH,
      treeWidth: FACTORY_TREE_WIDTH,
      mainWidth: FACTORY_MAIN_WIDTH,
    });

    const drawerSeparator = page.getByRole("separator", {
      name: "Resize drawer",
    });
    const start = await getCenter(drawerSeparator);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await expect(drawerSeparator).toHaveAttribute("data-dragging", "true");
    await page.mouse.move(start.x - 300, start.y);
    await expectColumnWidths({
      page,
      drawerWidth: 1629,
      treeWidth: 428,
      mainWidth: MAXIMUM_MAIN_WIDTH,
    });
    await page.mouse.up();

    await expect
      .poll(() => getStoredPreferences(page))
      .toEqual({
        main: String(MAXIMUM_MAIN_WIDTH),
        tree: "428",
      });
    await page.reload();
    await expectColumnWidths({
      page,
      drawerWidth: 1629,
      treeWidth: 428,
      mainWidth: MAXIMUM_MAIN_WIDTH,
    });
  });

  test("the expanded minimum tree edge grows the main column leftward in span and session details", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 2000, height: 900 });
    const cases = [
      {
        route: `/projects/${fixture.projectId}/spans/${fixture.traceId}?selectedSpanNodeId=${encodeURIComponent(fixture.childSpanNodeId)}`,
        renderedTreeWidth:
          MINIMUM_EXPANDED_TREE_WIDTH + TRACE_TREE_TIMING_MINIMUM_WIDTH,
      },
      {
        route: `/projects/${fixture.projectId}/sessions/${encodeURIComponent(fixture.sessionId)}?sessionView=traces&selectedSpanNodeId=${encodeURIComponent(fixture.childSpanNodeId)}`,
        renderedTreeWidth: MINIMUM_EXPANDED_TREE_WIDTH,
      },
    ];

    for (const { route, renderedTreeWidth } of cases) {
      await page.evaluate(
        ([treePreferenceKey, mainPreferenceKey, treeWidth, mainWidth]) => {
          localStorage.setItem(treePreferenceKey, treeWidth);
          localStorage.setItem(mainPreferenceKey, mainWidth);
        },
        [
          TREE_PREFERENCE_KEY,
          MAIN_PREFERENCE_KEY,
          String(MINIMUM_EXPANDED_TREE_WIDTH),
          String(MINIMUM_MAIN_WIDTH),
        ]
      );
      await page.goto(route);
      await expectColumnWidths({
        page,
        drawerWidth: renderedTreeWidth + 1 + MINIMUM_MAIN_WIDTH,
        treeWidth: renderedTreeWidth,
        mainWidth: MINIMUM_MAIN_WIDTH,
      });

      const treeSeparator = page.getByTestId("details-panel-tree-separator");
      const start = await getCenter(treeSeparator);
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await expect(treeSeparator).toHaveAttribute("data-dragging", "true");
      await page.mouse.move(start.x - 800, start.y);

      await expectColumnWidths({
        page,
        drawerWidth: renderedTreeWidth + 1 + MAXIMUM_MAIN_WIDTH,
        treeWidth: renderedTreeWidth,
        mainWidth: MAXIMUM_MAIN_WIDTH,
      });
      const movedSeparatorCenter = await getCenter(treeSeparator);
      expect(Math.round(movedSeparatorCenter.x)).toBe(
        Math.round(start.x - (MAXIMUM_MAIN_WIDTH - MINIMUM_MAIN_WIDTH))
      );
      await page.mouse.up();

      await expect
        .poll(() => getStoredPreferences(page))
        .toEqual({
          main: String(MAXIMUM_MAIN_WIDTH),
          tree: String(MINIMUM_EXPANDED_TREE_WIDTH),
        });

      const releasedSeparator = page.getByTestId(
        "details-panel-tree-separator"
      );
      const releasedStart = await getCenter(releasedSeparator);
      await page.mouse.move(releasedStart.x, releasedStart.y);
      await page.mouse.down();
      await page.mouse.move(releasedStart.x + 200, releasedStart.y);
      await expectColumnWidths({
        page,
        drawerWidth: renderedTreeWidth + 1 + MAXIMUM_MAIN_WIDTH,
        treeWidth: renderedTreeWidth + 200,
        mainWidth: MAXIMUM_MAIN_WIDTH - 200,
      });
      await releasedSeparator.dispatchEvent("pointercancel", {
        bubbles: true,
        cancelable: true,
        isPrimary: true,
        pointerId: 1,
        pointerType: "mouse",
      });
      await page.mouse.up();
      await expectColumnWidths({
        page,
        drawerWidth: renderedTreeWidth + 1 + MAXIMUM_MAIN_WIDTH,
        treeWidth: renderedTreeWidth,
        mainWidth: MAXIMUM_MAIN_WIDTH,
      });

      await page.reload();
      await expectColumnWidths({
        page,
        drawerWidth: renderedTreeWidth + 1 + MAXIMUM_MAIN_WIDTH,
        treeWidth: renderedTreeWidth,
        mainWidth: MAXIMUM_MAIN_WIDTH,
      });

      const reloadedSeparator = page.getByTestId(
        "details-panel-tree-separator"
      );
      const maximumMainStart = await getCenter(reloadedSeparator);
      await page.mouse.move(maximumMainStart.x, maximumMainStart.y);
      await page.mouse.down();
      await page.mouse.move(maximumMainStart.x + 200, maximumMainStart.y);
      await expectColumnWidths({
        page,
        drawerWidth: renderedTreeWidth + 1 + MAXIMUM_MAIN_WIDTH,
        treeWidth: renderedTreeWidth + 200,
        mainWidth: MAXIMUM_MAIN_WIDTH - 200,
      });
      const rightwardSeparatorCenter = await getCenter(reloadedSeparator);
      expect(Math.round(rightwardSeparatorCenter.x)).toBe(
        Math.round(maximumMainStart.x + 200)
      );
      await page.mouse.up();
    }
  });

  test("rightward travel past the maximum tree width shrinks the main column to its minimum", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 2600, height: 900 });
    const cases = [
      {
        preferredTreeWidth: 970,
        renderedTreeWidth: 1120,
        route: `/projects/${fixture.projectId}/spans/${fixture.traceId}?selectedSpanNodeId=${encodeURIComponent(fixture.childSpanNodeId)}`,
      },
      {
        preferredTreeWidth: 480,
        renderedTreeWidth: 480,
        route: `/projects/${fixture.projectId}/sessions/${encodeURIComponent(fixture.sessionId)}?sessionView=traces&selectedSpanNodeId=${encodeURIComponent(fixture.childSpanNodeId)}`,
      },
    ];

    for (const { preferredTreeWidth, renderedTreeWidth, route } of cases) {
      await page.evaluate(
        ([treePreferenceKey, mainPreferenceKey, treeWidth, mainWidth]) => {
          localStorage.setItem(treePreferenceKey, treeWidth);
          localStorage.setItem(mainPreferenceKey, mainWidth);
        },
        [
          TREE_PREFERENCE_KEY,
          MAIN_PREFERENCE_KEY,
          String(preferredTreeWidth),
          String(MAXIMUM_MAIN_WIDTH),
        ]
      );
      await page.goto(route);
      await expectColumnWidths({
        page,
        drawerWidth: renderedTreeWidth + 1 + MAXIMUM_MAIN_WIDTH,
        treeWidth: renderedTreeWidth,
        mainWidth: MAXIMUM_MAIN_WIDTH,
      });

      const treeSeparator = page.getByTestId("details-panel-tree-separator");
      const start = await getCenter(treeSeparator);
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(start.x + 200, start.y);
      await expectColumnWidths({
        page,
        drawerWidth: renderedTreeWidth + 1 + MAXIMUM_MAIN_WIDTH - 200,
        treeWidth: renderedTreeWidth,
        mainWidth: MAXIMUM_MAIN_WIDTH - 200,
      });
      const movedSeparatorCenter = await getCenter(treeSeparator);
      expect(Math.round(movedSeparatorCenter.x)).toBe(
        Math.round(start.x + 200)
      );

      await page.mouse.move(start.x + 800, start.y);
      await expectColumnWidths({
        page,
        drawerWidth: renderedTreeWidth + 1 + MINIMUM_MAIN_WIDTH,
        treeWidth: renderedTreeWidth,
        mainWidth: MINIMUM_MAIN_WIDTH,
      });
      await page.mouse.up();
      await expect
        .poll(() => getStoredPreferences(page))
        .toEqual({
          main: String(MINIMUM_MAIN_WIDTH),
          tree: String(preferredTreeWidth),
        });
    }
  });

  test("the middle separator remains operable after a repeated clamped outer drag", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto(
      `/projects/${fixture.projectId}/sessions/${encodeURIComponent(fixture.sessionId)}?sessionView=traces&selectedSpanNodeId=${encodeURIComponent(fixture.childSpanNodeId)}`
    );
    await expectColumnWidths({
      page,
      drawerWidth: FACTORY_DRAWER_WIDTH,
      treeWidth: FACTORY_TREE_WIDTH,
      mainWidth: FACTORY_MAIN_WIDTH,
    });

    const drawerSeparator = page.getByRole("separator", {
      name: "Resize drawer",
    });
    const drawerStart = await getCenter(drawerSeparator);
    await page.mouse.move(drawerStart.x, drawerStart.y);
    await page.mouse.down();
    await page.mouse.move(0, drawerStart.y);
    await page.mouse.up();
    await expectColumnWidths({
      page,
      drawerWidth: 1520,
      treeWidth: FACTORY_TREE_WIDTH,
      mainWidth: 1151,
    });

    const treeSeparator = page.getByTestId("details-panel-tree-separator");
    const treeStart = await getCenter(treeSeparator);
    await page.mouse.move(treeStart.x, treeStart.y);
    await page.mouse.down();
    await page.mouse.move(0, treeStart.y);
    await page.mouse.up();
    await expectColumnWidths({
      page,
      drawerWidth: 1520,
      treeWidth: 319,
      mainWidth: MAXIMUM_MAIN_WIDTH,
    });

    const maximumDrawerStart = await getCenter(drawerSeparator);
    await page.mouse.move(maximumDrawerStart.x, maximumDrawerStart.y);
    await page.mouse.down();
    await page.mouse.move(0, maximumDrawerStart.y);
    await page.mouse.up();
    await expectColumnWidths({
      page,
      drawerWidth: 1520,
      treeWidth: 319,
      mainWidth: MAXIMUM_MAIN_WIDTH,
    });

    const reverseStart = await getCenter(treeSeparator);
    await page.mouse.move(reverseStart.x, reverseStart.y);
    await page.mouse.down();
    await page.mouse.move(reverseStart.x + 100, reverseStart.y);
    await expectColumnWidths({
      page,
      drawerWidth: 1520,
      treeWidth: 419,
      mainWidth: 1100,
    });
    const reversedSeparatorCenter = await getCenter(treeSeparator);
    expect(Math.round(reversedSeparatorCenter.x)).toBe(
      Math.round(reverseStart.x + 100)
    );
    await page.mouse.up();
  });

  test("a rightward middle drag stays clamped when both columns are minimum", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto(
      `/projects/${fixture.projectId}/sessions/${encodeURIComponent(fixture.sessionId)}?sessionView=traces&selectedSpanNodeId=${encodeURIComponent(fixture.childSpanNodeId)}`
    );
    await expectColumnWidths({
      page,
      drawerWidth: FACTORY_DRAWER_WIDTH,
      treeWidth: FACTORY_TREE_WIDTH,
      mainWidth: FACTORY_MAIN_WIDTH,
    });

    const drawerSeparator = page.getByRole("separator", {
      name: "Resize drawer",
    });
    const drawerStart = await getCenter(drawerSeparator);
    await page.mouse.move(drawerStart.x, drawerStart.y);
    await page.mouse.down();
    await page.mouse.move(drawerStart.x + 1000, drawerStart.y);
    await page.mouse.up();
    await expectColumnWidths({
      page,
      drawerWidth: 881,
      treeWidth: MINIMUM_EXPANDED_TREE_WIDTH,
      mainWidth: MINIMUM_MAIN_WIDTH,
    });

    const treeSeparator = page.getByTestId("details-panel-tree-separator");
    const treeStart = await getCenter(treeSeparator);
    await page.mouse.move(treeStart.x, treeStart.y);
    await page.mouse.down();
    await page.mouse.move(treeStart.x + 30, treeStart.y);
    await expectColumnWidths({
      page,
      drawerWidth: 881,
      treeWidth: MINIMUM_EXPANDED_TREE_WIDTH,
      mainWidth: MINIMUM_MAIN_WIDTH,
    });
    const clampedCenter = await getCenter(treeSeparator);
    expect(Math.round(clampedCenter.x)).toBe(Math.round(treeStart.x));
    await page.mouse.up();
    await expectColumnWidths({
      page,
      drawerWidth: 881,
      treeWidth: MINIMUM_EXPANDED_TREE_WIDTH,
      mainWidth: MINIMUM_MAIN_WIDTH,
    });
    await expect
      .poll(() => getStoredPreferences(page))
      .toEqual({
        main: String(MINIMUM_MAIN_WIDTH),
        tree: null,
      });
  });

  test("a new outer drag stays continuous after minimum tree overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto(
      `/projects/${fixture.projectId}/sessions/${encodeURIComponent(fixture.sessionId)}?sessionView=traces&selectedSpanNodeId=${encodeURIComponent(fixture.childSpanNodeId)}`
    );
    await expectColumnWidths({
      page,
      drawerWidth: FACTORY_DRAWER_WIDTH,
      treeWidth: FACTORY_TREE_WIDTH,
      mainWidth: FACTORY_MAIN_WIDTH,
    });

    const drawerSeparator = page.getByRole("separator", {
      name: "Resize drawer",
    });
    const factoryDrawerStart = await getCenter(drawerSeparator);
    await page.mouse.move(factoryDrawerStart.x, factoryDrawerStart.y);
    await page.mouse.down();
    await page.mouse.move(factoryDrawerStart.x + 1000, factoryDrawerStart.y);
    await page.mouse.up();
    await expectColumnWidths({
      page,
      drawerWidth: 881,
      treeWidth: MINIMUM_EXPANDED_TREE_WIDTH,
      mainWidth: MINIMUM_MAIN_WIDTH,
    });

    const treeSeparator = page.getByTestId("details-panel-tree-separator");
    const minimumTreeStart = await getCenter(treeSeparator);
    await page.mouse.move(minimumTreeStart.x, minimumTreeStart.y);
    await page.mouse.down();
    await page.mouse.move(0, minimumTreeStart.y);
    await page.mouse.up();
    await expectColumnWidths({
      page,
      drawerWidth: 1441,
      treeWidth: MINIMUM_EXPANDED_TREE_WIDTH,
      mainWidth: MAXIMUM_MAIN_WIDTH,
    });
    await expect
      .poll(() => getStoredPreferences(page))
      .toEqual({
        main: String(MAXIMUM_MAIN_WIDTH),
        tree: String(MINIMUM_EXPANDED_TREE_WIDTH),
      });

    const overflowDrawerStart = await getCenter(drawerSeparator);
    await page.mouse.move(overflowDrawerStart.x, overflowDrawerStart.y);
    await page.mouse.down();
    await page.mouse.move(overflowDrawerStart.x + 20, overflowDrawerStart.y);
    await expectColumnWidths({
      page,
      drawerWidth: 1421,
      treeWidth: MINIMUM_EXPANDED_TREE_WIDTH,
      mainWidth: 1180,
    });
    const movedDrawerCenter = await getCenter(drawerSeparator);
    expect(Math.round(movedDrawerCenter.x)).toBe(
      Math.round(overflowDrawerStart.x + 20)
    );
    await page.mouse.up();
  });

  test("the outer separator reclaims left-column capacity after the middle separator reaches minimum", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 2000, height: 900 });
    await page.goto(
      `/projects/${fixture.projectId}/sessions/${encodeURIComponent(fixture.sessionId)}?sessionView=traces&selectedSpanNodeId=${encodeURIComponent(fixture.childSpanNodeId)}`
    );
    await expectColumnWidths({
      page,
      drawerWidth: FACTORY_DRAWER_WIDTH,
      treeWidth: FACTORY_TREE_WIDTH,
      mainWidth: FACTORY_MAIN_WIDTH,
    });

    const treeSeparator = page.getByTestId("details-panel-tree-separator");
    const treeStart = await getCenter(treeSeparator);
    await page.mouse.move(treeStart.x, treeStart.y);
    await page.mouse.down();
    await page.mouse.move(0, treeStart.y);
    await page.mouse.up();
    await expectColumnWidths({
      page,
      drawerWidth: 1441,
      treeWidth: MINIMUM_EXPANDED_TREE_WIDTH,
      mainWidth: MAXIMUM_MAIN_WIDTH,
    });

    const drawerSeparator = page.getByRole("separator", {
      name: "Resize drawer",
    });
    const drawerStart = await getCenter(drawerSeparator);
    await page.mouse.move(drawerStart.x, drawerStart.y);
    await page.mouse.down();
    await page.mouse.move(0, drawerStart.y);
    await page.mouse.up();
    await expectColumnWidths({
      page,
      drawerWidth: 1681,
      treeWidth: 480,
      mainWidth: MAXIMUM_MAIN_WIDTH,
    });
    await expect
      .poll(() => getStoredPreferences(page))
      .toEqual({
        main: String(MAXIMUM_MAIN_WIDTH),
        tree: "480",
      });
  });

  test("XS-1: trace, selected-span, and session products share the same column sizing", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    const routes = [
      `/projects/${fixture.projectId}/traces/${fixture.traceId}`,
      `/projects/${fixture.projectId}/spans/${fixture.traceId}?selectedSpanNodeId=${encodeURIComponent(fixture.childSpanNodeId)}`,
      `/projects/${fixture.projectId}/sessions/${encodeURIComponent(fixture.sessionId)}?sessionView=traces&selectedSpanNodeId=${encodeURIComponent(fixture.childSpanNodeId)}`,
    ];

    for (const route of routes) {
      await page.goto(route);
      await expectColumnWidths({
        page,
        drawerWidth: FACTORY_DRAWER_WIDTH,
        treeWidth: FACTORY_TREE_WIDTH,
        mainWidth: FACTORY_MAIN_WIDTH,
      });
    }
  });
});
