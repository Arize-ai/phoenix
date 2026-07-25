import { describe, expect, it } from "vitest";

import {
  SPAN_DETAILS_FACTORY_WIDTH_PIXELS,
  SPAN_DETAILS_MIN_WIDTH_PIXELS,
  TRACE_DETAILS_SEPARATOR_WIDTH_PIXELS,
  TRACE_TREE_DEFAULT_WIDTH_PIXELS,
} from "@phoenix/constants";

import {
  getDetailsPanelDrawerWidth,
  getMainDetailsWidthFromDrawer,
  getPreferredColumnWidth,
} from "../useDetailsPanelSizing";

describe("details panel sizing", () => {
  it("derives the factory drawer width from its inner columns", () => {
    expect(
      getDetailsPanelDrawerWidth({
        treeWidth: TRACE_TREE_DEFAULT_WIDTH_PIXELS,
        mainDetailsWidth: SPAN_DETAILS_FACTORY_WIDTH_PIXELS,
      })
    ).toBe(
      TRACE_TREE_DEFAULT_WIDTH_PIXELS +
        TRACE_DETAILS_SEPARATOR_WIDTH_PIXELS +
        SPAN_DETAILS_FACTORY_WIDTH_PIXELS
    );
  });

  it("does not turn constraint-driven tree compression into a smaller detail preference", () => {
    expect(
      getMainDetailsWidthFromDrawer({
        drawerWidth: 800,
        treeWidth: TRACE_TREE_DEFAULT_WIDTH_PIXELS,
      })
    ).toBe(SPAN_DETAILS_MIN_WIDTH_PIXELS);
  });

  it("allows a deliberate resize beyond the factory detail width", () => {
    expect(
      getMainDetailsWidthFromDrawer({
        drawerWidth:
          TRACE_TREE_DEFAULT_WIDTH_PIXELS +
          TRACE_DETAILS_SEPARATOR_WIDTH_PIXELS +
          1200,
        treeWidth: TRACE_TREE_DEFAULT_WIDTH_PIXELS,
      })
    ).toBe(1200);
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
});
