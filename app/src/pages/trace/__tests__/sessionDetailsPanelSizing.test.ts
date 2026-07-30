import { describe, expect, it } from "vitest";

import {
  TRACE_TREE_TIMING_MIN_WIDTH_PIXELS,
  getTraceTreeMaximumWidth,
} from "@phoenix/components/trace/traceTreeSizing";
import { TRACE_TREE_MIN_WIDTH_PIXELS } from "@phoenix/constants";

import type { SizingEvent, SizingState } from "../detailsPanelSizing/machine";
import { createInitialState } from "../detailsPanelSizing/machine";
import { transition } from "../detailsPanelSizing/transition";
import { getSessionDetailsPanelSizing } from "../sessionDetailsPanelSizing";
import type { SessionView } from "../SessionViewTabs";

describe("session details panel sizing", () => {
  it.each([false, true])(
    "keeps turns and traces on one sizing contract when timing is %s",
    (showMetricsInTraceTree) => {
      const turnsSizing = getSessionDetailsPanelSizing({
        sessionView: "turns",
        showMetricsInTraceTree,
      });
      const tracesSizing = getSessionDetailsPanelSizing({
        sessionView: "traces",
        showMetricsInTraceTree,
      });

      expect(turnsSizing).toEqual(tracesSizing);
    }
  );

  it("preserves a smaller traces layout through turns and enforces the shared minimum", () => {
    const sharedMinimum =
      TRACE_TREE_MIN_WIDTH_PIXELS + TRACE_TREE_TIMING_MIN_WIDTH_PIXELS;
    let state = createInitialState({
      mainRaw: null,
      treeRaw: null,
      viewport: 1600,
    });
    let appliedTreeAddonWidth: number | null = null;
    let appliedTreeMaximumWidth: number | null = null;
    const dispatch = (event: SizingEvent) => {
      state = transition(state, event).state;
    };
    const renderSessionView = (sessionView: SessionView) => {
      const { treeAddonWidth, treeMaximumWidth } = getSessionDetailsPanelSizing(
        {
          sessionView,
          showMetricsInTraceTree: true,
        }
      );
      if (treeMaximumWidth !== appliedTreeMaximumWidth) {
        dispatch({ type: "TREE_MAX_SET", px: treeMaximumWidth });
        appliedTreeMaximumWidth = treeMaximumWidth;
      }
      if (treeAddonWidth !== appliedTreeAddonWidth) {
        dispatch({ type: "TREE_ADDON_SET", px: treeAddonWidth });
        appliedTreeAddonWidth = treeAddonWidth;
      }
    };

    renderSessionView("traces");
    dispatch({ type: "OPEN" });
    dispatch({ type: "OUTER_MOVE", px: 1100 });
    dispatch({ type: "OUTER_END", px: 1100 });
    expect(state.renderedDrawer).toBe(1100);

    const resizedTracesState: SizingState = state;
    renderSessionView("turns");
    expect(state).toEqual(resizedTracesState);
    renderSessionView("traces");
    expect(state).toEqual(resizedTracesState);

    dispatch({ type: "TREE_START" });
    dispatch({ type: "TREE_MOVE", px: sharedMinimum });
    dispatch({ type: "TREE_END" });
    expect(state.renderedTree).toBe(sharedMinimum);

    renderSessionView("turns");
    const turnsMinimumState: SizingState = state;
    dispatch({ type: "TREE_START" });
    dispatch({ type: "TREE_MOVE", px: 0 });
    expect(state.renderedTree).toBe(sharedMinimum);
    dispatch({ type: "TREE_CANCEL" });
    expect(state).toMatchObject({
      prefMain: turnsMinimumState.prefMain,
      prefTree: turnsMinimumState.prefTree,
      renderedDrawer: turnsMinimumState.renderedDrawer,
      renderedMain: turnsMinimumState.renderedMain,
      renderedTree: turnsMinimumState.renderedTree,
    });

    renderSessionView("traces");
    expect(state).toMatchObject({
      prefMain: turnsMinimumState.prefMain,
      prefTree: turnsMinimumState.prefTree,
      renderedDrawer: turnsMinimumState.renderedDrawer,
      renderedMain: turnsMinimumState.renderedMain,
      renderedTree: turnsMinimumState.renderedTree,
    });
    expect(state.treeMax).toBe(getTraceTreeMaximumWidth({ hasTiming: true }));
  });
});
