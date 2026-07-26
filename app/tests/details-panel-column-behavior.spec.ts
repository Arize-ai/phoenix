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
const MINIMUM_MAIN_WIDTH = 640;

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
      return body.data.some(
        (session) => session.session_id === sessionIdentifier
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

  test("PS-3: a constrained drawer width survives close/reopen and reload", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1000, height: 900 });
    await page.goto(`/projects/${fixture.projectId}/traces/${fixture.traceId}`);
    await expectColumnWidths({
      page,
      drawerWidth: 950,
      treeWidth: 309,
      mainWidth: MINIMUM_MAIN_WIDTH,
    });

    const drawerSeparator = page.getByRole("separator", {
      name: "Resize drawer",
    });
    const start = await getCenter(drawerSeparator);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await expect(drawerSeparator).toHaveAttribute("data-dragging", "true");
    await page.mouse.move(start.x + 150, start.y);
    await expectColumnWidths({
      page,
      drawerWidth: 800,
      treeWidth: 159,
      mainWidth: MINIMUM_MAIN_WIDTH,
    });
    await page.mouse.up();

    await expect
      .poll(async () => (await getStoredPreferences(page)).main)
      .not.toBeNull();
    await closeAndReopenTraceDetails({ page, fixture });
    await expectColumnWidths({
      page,
      drawerWidth: 800,
      treeWidth: 159,
      mainWidth: MINIMUM_MAIN_WIDTH,
    });

    await page.reload();
    await expectColumnWidths({
      page,
      drawerWidth: 800,
      treeWidth: 159,
      mainWidth: MINIMUM_MAIN_WIDTH,
    });
  });

  test("CC-2, TC-4, TC-5, TC-8, TC-9, and PS-7: one tree drag transitions from main shrinkage to drawer growth", async ({
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

    const treeSeparator = page.getByTestId("details-panel-tree-separator");
    const start = await getCenter(treeSeparator);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await expect(treeSeparator).toHaveAttribute("data-dragging", "true");
    await page.mouse.move(start.x - 200, start.y);

    await expectColumnWidths({
      page,
      drawerWidth: FACTORY_DRAWER_WIDTH,
      treeWidth: 168,
      mainWidth: 1160,
    });
    const narrowSeparatorCenter = await getCenter(treeSeparator);
    expect(Math.round(narrowSeparatorCenter.x)).toBe(Math.round(start.x - 200));

    await page.mouse.move(start.x + 200, start.y);
    await expectColumnWidths({
      page,
      drawerWidth: FACTORY_DRAWER_WIDTH,
      treeWidth: 568,
      mainWidth: 760,
    });

    await page.mouse.move(start.x + 500, start.y);

    await expectColumnWidths({
      page,
      drawerWidth: 1509,
      treeWidth: 868,
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
        tree: "868",
      });
    await page.reload();
    await expectColumnWidths({
      page,
      drawerWidth: 1829,
      treeWidth: 868,
      mainWidth: FACTORY_MAIN_WIDTH,
    });
  });

  test("TC-4 and TC-8: a tree drag grows the drawer immediately from the main minimum and cancellation restores it", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 2000, height: 900 });
    await page.evaluate(
      ([mainPreferenceKey, mainWidth]) => {
        localStorage.setItem(mainPreferenceKey, mainWidth);
      },
      [MAIN_PREFERENCE_KEY, String(MINIMUM_MAIN_WIDTH)]
    );
    await page.goto(`/projects/${fixture.projectId}/traces/${fixture.traceId}`);
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
      drawerWidth: 1209,
      treeWidth: 568,
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
      drawerWidth: 1209,
      treeWidth: 568,
      mainWidth: MINIMUM_MAIN_WIDTH,
    });
    await expect
      .poll(() => getStoredPreferences(page))
      .toEqual({
        main: String(MINIMUM_MAIN_WIDTH),
        tree: "568",
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

    const search = page.getByRole("searchbox", { name: "Search trace tree" });
    const collapseButton = page.getByRole("button", { name: "Collapse all" });
    const timingButton = page.getByRole("button", {
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
    const content = page.getByTestId("scrolling-panel-content");
    await content.hover();
    await expect
      .poll(async () => Math.round((await content.boundingBox())?.width ?? 0))
      .toBe(240);
    const mainDuringOverlay = await getDetailsPanelLayout(page);
    expect(mainDuringOverlay).toEqual(mainBeforeOverlay);
    await expect(page.getByText("Collapse all", { exact: true })).toBeVisible();
    await expect(page.getByText(/^(Show|Hide) timing$/)).toBeVisible();
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

  test("CC-5 and CC-6: a user-set main width above the factory maximum is restored", async ({
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
      treeWidth: FACTORY_TREE_WIDTH,
      mainWidth: 1260,
    });
    await page.mouse.up();

    await expect
      .poll(() => getStoredPreferences(page))
      .toEqual({
        main: "1260",
        tree: null,
      });
    await page.reload();
    await expectColumnWidths({
      page,
      drawerWidth: 1629,
      treeWidth: FACTORY_TREE_WIDTH,
      mainWidth: 1260,
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
