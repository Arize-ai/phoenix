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
