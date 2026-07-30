import { describe, expect, it } from "vitest";

import {
  getTraceTreeMaximumWidth,
  getTraceTreePanelSizing,
  TRACE_TREE_NAME_MAX_WIDTH_PIXELS,
  TRACE_TREE_TIMING_MAX_WIDTH_PIXELS,
  TRACE_TREE_TIMING_MIN_WIDTH_PIXELS,
} from "@phoenix/components/trace/traceTreeSizing";
import {
  SPAN_DETAILS_FACTORY_WIDTH_PIXELS,
  SPAN_DETAILS_MAX_WIDTH_PIXELS,
  SPAN_DETAILS_MIN_WIDTH_PIXELS,
  TRACE_DETAILS_SEPARATOR_WIDTH_PIXELS,
  TRACE_TREE_DEFAULT_WIDTH_PIXELS,
  TRACE_TREE_MIN_WIDTH_PIXELS,
} from "@phoenix/constants";

import {
  createInitialState,
  previewMaximumDrawerWidth,
} from "../detailsPanelSizing/machine";
import { transition } from "../detailsPanelSizing/transition";
import {
  getCompactTreeDividerDrawerWidth,
  getDetailsPanelDrawerWidth,
  getMainDetailsWidthFromDrawer,
  getMinimumDetailsPanelDrawerWidth,
  getPreferredColumnWidth,
  getTreeDividerDragLayout,
} from "../useDetailsPanelSizing";

describe("details panel sizing", () => {
  it("derives the drawer maximum from the tree allocation and main maximum", () => {
    let state = createInitialState({
      mainRaw: null,
      treeRaw: null,
      viewport: 2000,
    });
    const treeMaximumWidth = getTraceTreeMaximumWidth({ hasTiming: false });

    expect(previewMaximumDrawerWidth(state, 0, treeMaximumWidth)).toBe(
      treeMaximumWidth +
        TRACE_DETAILS_SEPARATOR_WIDTH_PIXELS +
        SPAN_DETAILS_MAX_WIDTH_PIXELS
    );

    state = transition(state, { type: "OPEN" }).state;
    state = transition(state, { type: "TREE_START" }).state;
    expect(previewMaximumDrawerWidth(state, 0, treeMaximumWidth)).toBe(
      treeMaximumWidth +
        TRACE_DETAILS_SEPARATOR_WIDTH_PIXELS +
        SPAN_DETAILS_MAX_WIDTH_PIXELS
    );
  });

  it("grows the main detail view leftward from the compact tree divider", () => {
    let state = createInitialState({
      mainRaw: null,
      treeRaw: null,
      viewport: 1600,
    });
    state = transition(state, { type: "OPEN" }).state;
    state = transition(state, { type: "TREE_COLLAPSE" }).state;
    const startDrawerWidth = state.renderedDrawer;
    const requestedDrawerWidth = getCompactTreeDividerDrawerWidth({
      requestedTreeWidth: 8,
      startDrawerWidth,
    });

    state = transition(state, {
      type: "OUTER_MOVE",
      px: requestedDrawerWidth,
    }).state;
    expect(state.renderedTree).toBe(48);
    expect(state.renderedMain).toBe(1000);
    expect(state.renderedDrawer).toBe(startDrawerWidth + 40);

    state = transition(state, {
      type: "OUTER_END",
      px: requestedDrawerWidth,
    }).state;
    expect(state.prefMain).toBe(1000);

    expect(
      getCompactTreeDividerDrawerWidth({
        requestedTreeWidth: 88,
        startDrawerWidth,
      })
    ).toBe(startDrawerWidth - 40);
  });

  it("grows the main detail view leftward from the expanded tree minimum", () => {
    let state = createInitialState({
      mainRaw: SPAN_DETAILS_MIN_WIDTH_PIXELS,
      treeRaw: TRACE_TREE_MIN_WIDTH_PIXELS,
      viewport: 2000,
    });
    state = transition(state, { type: "OPEN" }).state;
    expect(state.renderedDrawer).toBe(881);
    expect(state.renderedTree).toBe(TRACE_TREE_MIN_WIDTH_PIXELS);
    expect(state.renderedMain).toBe(SPAN_DETAILS_MIN_WIDTH_PIXELS);

    state = transition(state, { type: "TREE_START" }).state;
    state = transition(state, { type: "TREE_MOVE", px: 40 }).state;
    expect(state.renderedDrawer).toBe(1081);
    expect(state.renderedTree).toBe(TRACE_TREE_MIN_WIDTH_PIXELS);
    expect(state.renderedMain).toBe(840);

    const release = transition(state, { type: "TREE_END" });
    expect(release.state.prefTree).toBe(TRACE_TREE_MIN_WIDTH_PIXELS);
    expect(release.state.prefMain).toBe(840);
    expect(release.effects).toEqual([{ kind: "persistMain", value: 840 }]);
  });

  it("shrinks the tree before handing leftward overflow to the drawer", () => {
    let state = createInitialState({
      mainRaw: 960,
      treeRaw: 368,
      viewport: 2000,
    });
    state = transition(state, { type: "OPEN" }).state;
    expect(state.renderedDrawer).toBe(1329);
    expect(state.renderedTree).toBe(368);
    expect(state.renderedMain).toBe(960);

    state = transition(state, { type: "TREE_START" }).state;
    state = transition(state, { type: "TREE_MOVE", px: 268 }).state;
    expect(state.renderedDrawer).toBe(1329);
    expect(state.renderedTree).toBe(268);
    expect(state.renderedMain).toBe(1060);

    state = transition(state, { type: "TREE_MOVE", px: 168 }).state;
    expect(state.renderedDrawer).toBe(1401);
    expect(state.renderedTree).toBe(TRACE_TREE_MIN_WIDTH_PIXELS);
    expect(state.renderedMain).toBe(1160);

    state = transition(state, { type: "TREE_MOVE", px: 268 }).state;
    expect(state.renderedDrawer).toBe(1329);
    expect(state.renderedTree).toBe(268);
    expect(state.renderedMain).toBe(1060);

    state = transition(state, { type: "TREE_MOVE", px: 168 }).state;

    const release = transition(state, { type: "TREE_END" });
    expect(release.state.prefTree).toBe(TRACE_TREE_MIN_WIDTH_PIXELS);
    expect(release.state.prefMain).toBe(1160);
    expect(release.effects).toEqual([
      { kind: "persistTree", value: TRACE_TREE_MIN_WIDTH_PIXELS },
      { kind: "persistMain", value: 1160 },
    ]);
  });

  it("keeps outer gesture entry continuous after compressed tree overflow", () => {
    let state = createInitialState({
      mainRaw: null,
      treeRaw: null,
      viewport: 1600,
    });
    state = transition(state, { type: "TREE_MAX_SET", px: 480 }).state;
    state = transition(state, { type: "OPEN" }).state;

    state = transition(state, { type: "OUTER_MOVE", px: 0 }).state;
    state = transition(state, { type: "OUTER_END", px: 0 }).state;
    expect(state).toMatchObject({
      prefTree: 368,
      prefMain: 640,
      renderedDrawer: 881,
      renderedTree: 240,
      renderedMain: 640,
    });

    state = transition(state, { type: "TREE_START" }).state;
    state = transition(state, { type: "TREE_MOVE", px: -1000 }).state;
    const release = transition(state, { type: "TREE_END" });
    state = release.state;
    expect(state).toMatchObject({
      prefTree: 240,
      prefMain: 1200,
      renderedDrawer: 1441,
      renderedTree: 240,
      renderedMain: 1200,
    });
    expect(release.effects).toEqual([
      { kind: "persistTree", value: 240 },
      { kind: "persistMain", value: 1200 },
    ]);

    state = transition(state, { type: "OUTER_MOVE", px: 1440 }).state;
    expect(state).toMatchObject({
      renderedDrawer: 1440,
      renderedTree: 240,
      renderedMain: 1199,
    });
  });

  it("clamps a rightward tree drag when both columns are at minimum", () => {
    let state = createInitialState({
      mainRaw: null,
      treeRaw: null,
      viewport: 1600,
    });
    state = transition(state, { type: "TREE_MAX_SET", px: 480 }).state;
    state = transition(state, { type: "OPEN" }).state;
    state = transition(state, { type: "OUTER_MOVE", px: 0 }).state;
    state = transition(state, { type: "OUTER_END", px: 0 }).state;
    expect(state).toMatchObject({
      renderedDrawer: 881,
      renderedTree: 240,
      renderedMain: 640,
    });

    state = transition(state, { type: "TREE_START" }).state;
    state = transition(state, { type: "TREE_MOVE", px: 270 }).state;
    expect(state).toMatchObject({
      renderedDrawer: 881,
      renderedTree: 240,
      renderedMain: 640,
    });

    const release = transition(state, { type: "TREE_END" });
    expect(release.state).toMatchObject({
      prefTree: 368,
      prefMain: 640,
      renderedDrawer: 881,
      renderedTree: 240,
      renderedMain: 640,
    });
    expect(release.effects).toEqual([]);
  });

  it("shrinks main and drawer after rightward travel reaches the tree maximum", () => {
    const maximumTreeWidth = getTraceTreeMaximumWidth({ hasTiming: false });
    let state = createInitialState({
      mainRaw: SPAN_DETAILS_MAX_WIDTH_PIXELS,
      treeRaw: maximumTreeWidth,
      viewport: 2000,
    });
    state = transition(state, {
      type: "TREE_MAX_SET",
      px: maximumTreeWidth,
    }).state;
    state = transition(state, { type: "OPEN" }).state;
    expect(state.renderedDrawer).toBe(1681);
    expect(state.renderedTree).toBe(maximumTreeWidth);
    expect(state.renderedMain).toBe(SPAN_DETAILS_MAX_WIDTH_PIXELS);

    state = transition(state, { type: "TREE_START" }).state;
    state = transition(state, {
      type: "TREE_MOVE",
      px: maximumTreeWidth + 200,
    }).state;
    expect(state.renderedDrawer).toBe(1481);
    expect(state.renderedTree).toBe(maximumTreeWidth);
    expect(state.renderedMain).toBe(SPAN_DETAILS_MAX_WIDTH_PIXELS - 200);

    const release = transition(state, { type: "TREE_END" });
    expect(release.state.prefTree).toBe(maximumTreeWidth);
    expect(release.state.prefMain).toBe(SPAN_DETAILS_MAX_WIDTH_PIXELS - 200);
    expect(release.effects).toEqual([
      {
        kind: "persistMain",
        value: SPAN_DETAILS_MAX_WIDTH_PIXELS - 200,
      },
    ]);
  });

  it("lets the outer handle reclaim tree capacity after the main reaches maximum", () => {
    const maximumTreeWidth = getTraceTreeMaximumWidth({ hasTiming: false });
    let state = createInitialState({
      mainRaw: null,
      treeRaw: null,
      viewport: 2000,
    });
    state = transition(state, {
      type: "TREE_MAX_SET",
      px: maximumTreeWidth,
    }).state;
    state = transition(state, { type: "OPEN" }).state;

    state = transition(state, { type: "TREE_START" }).state;
    state = transition(state, { type: "TREE_MOVE", px: 0 }).state;
    state = transition(state, { type: "TREE_END" }).state;
    expect(state.renderedDrawer).toBe(1441);
    expect(state.renderedTree).toBe(TRACE_TREE_MIN_WIDTH_PIXELS);
    expect(state.renderedMain).toBe(SPAN_DETAILS_MAX_WIDTH_PIXELS);

    state = transition(state, { type: "OUTER_MOVE", px: 1681 }).state;
    expect(state.renderedDrawer).toBe(1681);
    expect(state.renderedTree).toBe(maximumTreeWidth);
    expect(state.renderedMain).toBe(SPAN_DETAILS_MAX_WIDTH_PIXELS);

    const release = transition(state, { type: "OUTER_END", px: 1681 });
    expect(release.state.prefTree).toBe(maximumTreeWidth);
    expect(release.state.prefMain).toBe(SPAN_DETAILS_MAX_WIDTH_PIXELS);
    expect(release.effects).toEqual([
      { kind: "persistMain", value: SPAN_DETAILS_MAX_WIDTH_PIXELS },
      { kind: "persistTree", value: maximumTreeWidth },
    ]);
  });

  it("derives mode- and timing-aware drawer minimums", () => {
    expect(
      getMinimumDetailsPanelDrawerWidth({
        isCollapsed: true,
        treeAddonWidth: 150,
      })
    ).toBe(48 + 1 + 640);
    expect(
      getMinimumDetailsPanelDrawerWidth({
        isCollapsed: false,
        treeAddonWidth: 0,
      })
    ).toBe(240 + 1 + 640);
    expect(
      getMinimumDetailsPanelDrawerWidth({
        isCollapsed: false,
        treeAddonWidth: 150,
      })
    ).toBe(240 + 150 + 1 + 640);
  });

  it("derives the tree maximum from the name and timing region maxima", () => {
    expect(getTraceTreeMaximumWidth({ hasTiming: false })).toBe(
      TRACE_TREE_NAME_MAX_WIDTH_PIXELS
    );
    expect(getTraceTreeMaximumWidth({ hasTiming: true })).toBe(
      TRACE_TREE_NAME_MAX_WIDTH_PIXELS + TRACE_TREE_TIMING_MAX_WIDTH_PIXELS
    );
    expect(getTraceTreePanelSizing({ hasTiming: false })).toEqual({
      treeAddonWidth: 0,
      treeMaximumWidth: TRACE_TREE_NAME_MAX_WIDTH_PIXELS,
    });
    expect(getTraceTreePanelSizing({ hasTiming: true })).toEqual({
      treeAddonWidth: TRACE_TREE_TIMING_MIN_WIDTH_PIXELS,
      treeMaximumWidth:
        TRACE_TREE_NAME_MAX_WIDTH_PIXELS + TRACE_TREE_TIMING_MAX_WIDTH_PIXELS,
    });
  });

  it("derives the factory drawer width from its inner columns", () => {
    expect(
      getDetailsPanelDrawerWidth({
        columnWidths: [
          TRACE_TREE_DEFAULT_WIDTH_PIXELS,
          SPAN_DETAILS_FACTORY_WIDTH_PIXELS,
        ],
        separatorWidths: [TRACE_DETAILS_SEPARATOR_WIDTH_PIXELS],
      })
    ).toBe(
      TRACE_TREE_DEFAULT_WIDTH_PIXELS +
        TRACE_DETAILS_SEPARATOR_WIDTH_PIXELS +
        SPAN_DETAILS_FACTORY_WIDTH_PIXELS
    );
  });

  it("derives drawer width from any ordered set of columns and separators", () => {
    expect(
      getDetailsPanelDrawerWidth({
        columnWidths: [100, 200, 300],
        separatorWidths: [1, 2],
      })
    ).toBe(603);
  });

  it("does not turn constraint-driven tree compression into a smaller detail preference", () => {
    expect(
      getMainDetailsWidthFromDrawer({
        drawerWidth: 800,
        treeWidth: TRACE_TREE_DEFAULT_WIDTH_PIXELS,
      })
    ).toBe(SPAN_DETAILS_MIN_WIDTH_PIXELS);
  });

  it("caps the main panel at the detail content maximum", () => {
    expect(
      getMainDetailsWidthFromDrawer({
        drawerWidth:
          TRACE_TREE_DEFAULT_WIDTH_PIXELS +
          TRACE_DETAILS_SEPARATOR_WIDTH_PIXELS +
          SPAN_DETAILS_MAX_WIDTH_PIXELS,
        treeWidth: TRACE_TREE_DEFAULT_WIDTH_PIXELS,
      })
    ).toBe(SPAN_DETAILS_MAX_WIDTH_PIXELS);

    expect(
      getMainDetailsWidthFromDrawer({
        drawerWidth:
          TRACE_TREE_DEFAULT_WIDTH_PIXELS +
          TRACE_DETAILS_SEPARATOR_WIDTH_PIXELS +
          SPAN_DETAILS_MAX_WIDTH_PIXELS +
          100,
        treeWidth: TRACE_TREE_DEFAULT_WIDTH_PIXELS,
      })
    ).toBe(SPAN_DETAILS_MAX_WIDTH_PIXELS);
  });

  it("rejects invalid stored widths and clamps valid widths to their minimum", () => {
    expect(
      getPreferredColumnWidth({
        value: "not-a-number",
        defaultWidth: 368,
        minimumWidth: 48,
      })
    ).toBe(368);
    expect(
      getPreferredColumnWidth({
        value: 12,
        defaultWidth: 368,
        minimumWidth: 48,
      })
    ).toBe(48);
  });

  it("uses main-column slack then clamps without growing the drawer", () => {
    expect(
      getTreeDividerDragLayout({
        maximumDrawerWidth: 1900,
        maximumTreeWidth: getTraceTreeMaximumWidth({ hasTiming: true }),
        requestedTreeWidth: 718,
        startDrawerWidth: 1479,
        startMainWidth: 960,
        startTreeWidth: 518,
        treeAddonWidth: 150,
      })
    ).toEqual({ drawerWidth: 1479, treeWidth: 718 });

    expect(
      getTreeDividerDragLayout({
        maximumDrawerWidth: 1900,
        maximumTreeWidth: getTraceTreeMaximumWidth({ hasTiming: true }),
        requestedTreeWidth: 1018,
        startDrawerWidth: 1479,
        startMainWidth: 960,
        startTreeWidth: 518,
        treeAddonWidth: 150,
      })
    ).toEqual({ drawerWidth: 1479, treeWidth: 838 });
  });

  it("clamps tree growth when the main column starts at minimum", () => {
    expect(
      getTreeDividerDragLayout({
        maximumDrawerWidth: 1400,
        maximumTreeWidth: getTraceTreeMaximumWidth({ hasTiming: false }),
        requestedTreeWidth: 468,
        startDrawerWidth: 1009,
        startMainWidth: SPAN_DETAILS_MIN_WIDTH_PIXELS,
        startTreeWidth: 368,
      })
    ).toEqual({ drawerWidth: 1009, treeWidth: 368 });
  });

  it("hands leftward overflow to the drawer at the expanded tree minimum", () => {
    const commonOptions = {
      maximumDrawerWidth: 1400,
      maximumTreeWidth: getTraceTreeMaximumWidth({ hasTiming: true }),
      startDrawerWidth: 1329,
      startMainWidth: SPAN_DETAILS_MIN_WIDTH_PIXELS,
      startTreeWidth: 688,
      treeAddonWidth: 150,
    };

    expect(
      getTreeDividerDragLayout({
        ...commonOptions,
        requestedTreeWidth: 12,
      })
    ).toEqual({ drawerWidth: 1400, treeWidth: 390 });
    expect(
      getTreeDividerDragLayout({
        ...commonOptions,
        requestedTreeWidth: 900,
      })
    ).toEqual({ drawerWidth: 1329, treeWidth: 688 });
  });

  it("adds timing width to the expanded divider floor", () => {
    expect(
      getTreeDividerDragLayout({
        maximumDrawerWidth: 1500,
        maximumTreeWidth: getTraceTreeMaximumWidth({ hasTiming: true }),
        requestedTreeWidth: 1,
        startDrawerWidth: 1479,
        startMainWidth: 960,
        startTreeWidth: 518,
        treeAddonWidth: 150,
      })
    ).toEqual({ drawerWidth: 1500, treeWidth: 390 });
  });
});
