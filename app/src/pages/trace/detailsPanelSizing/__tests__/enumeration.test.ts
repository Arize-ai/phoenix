/**
 * Bounded-depth exhaustive enumeration of the shipped transition function.
 *
 * This is one of the two mechanical checkers (the other is the Z3 harness in
 * `verify/prove.ts`). It breadth-first-explores every state reachable within
 * `DEPTH_BOUND` events from a boundary-relevant set of initial states under
 * the full event alphabet, and asserts:
 *
 * - every state invariant in `invariants.ts`, on every reachable state;
 * - the transition (edge) properties — preference-frame, deliberate-commit,
 *   reopen-derivation, persistence-effect consistency, and measurement
 *   idempotence — on every explored edge.
 *
 * Division of labor: this sweep executes the literal production `transition`
 * function, so there is no translation of any kind between checked and
 * shipped artifact, and it covers deep event *interleavings*. The Z3 harness
 * covers ALL integer widths and parameters at unbounded depth by induction.
 * Together: the sweep certifies the interpreter and protocol, the proofs
 * certify the algebra.
 */

import { describe, expect, it } from "vitest";

import { getTraceTreeMaximumWidth } from "@phoenix/components/trace/traceTreeSizing";
import {
  SPAN_DETAILS_MAX_WIDTH_PIXELS,
  TRACE_TREE_MIN_WIDTH_PIXELS,
} from "@phoenix/constants";

import type { SizingEvent } from "../machine";
import { createInitialState } from "../machine";
import { transition } from "../transition";
import { runSweep } from "../verify/sweep";

describe("details panel sizing: exhaustive enumeration", () => {
  it("holds every invariant and edge property over the bounded reachable state space", () => {
    const { states, edges } = runSweep();
    expect(states).toBeGreaterThan(0);
    // Scale is logged so drift in the modeled domain is visible in review.
    // eslint-disable-next-line no-console
    console.info(`[details-panel enumeration] states=${states} edges=${edges}`);
  }, 120_000);

  it("excludes the reported reopen defect on its exact scenario", () => {
    // Mirrors app/tests/details-panel-column-behavior.spec.ts at a 1600px
    // viewport: maximize via the outer handle, close/reopen, drag inward
    // 200px, close/reopen — the released width must survive both reopens.
    let state = createInitialState({
      treeRaw: null,
      mainRaw: null,
      viewport: 1600,
    });
    const step = (event: SizingEvent) => {
      state = transition(state, event).state;
    };

    step({ type: "OPEN" });
    expect(state.renderedDrawer).toBe(368 + 1 + 960); // factory derivation

    step({ type: "OUTER_MOVE", px: 1520 });
    step({ type: "OUTER_END", px: 1520 });
    expect(state.renderedTree).toBe(368);
    expect(state.renderedMain).toBe(1151);

    step({ type: "CLOSE" });
    step({ type: "OPEN" });
    expect(state.renderedDrawer).toBe(1520);

    step({ type: "OUTER_MOVE", px: 1320 });
    step({ type: "OUTER_END", px: 1320 });
    expect(state.renderedDrawer).toBe(1320);
    expect(state.renderedTree).toBe(368);
    expect(state.renderedMain).toBe(951);
    expect(state.prefMain).toBe(951);

    step({ type: "CLOSE" });
    step({ type: "OPEN" });
    expect(state.renderedDrawer).toBe(1320);
  });

  it("keeps compact content geometry separate from divider resizing", () => {
    let state = createInitialState({
      treeRaw: null,
      mainRaw: null,
      viewport: 1600,
    });
    const step = (event: SizingEvent) => {
      state = transition(state, event).state;
    };

    step({
      type: "TREE_MAX_SET",
      px: getTraceTreeMaximumWidth({ hasTiming: true }),
    });
    step({ type: "TREE_ADDON_SET", px: 150 });
    step({ type: "OPEN" });
    expect(state.renderedTree).toBe(368 + 150);
    expect(state.renderedMain).toBe(960);

    step({ type: "TREE_COLLAPSE" });
    expect(state.collapsed).toBe(true);
    expect(state.renderedTree).toBe(48);
    expect(state.renderedMain).toBe(960);
    expect(state.renderedDrawer).toBe(48 + 1 + 960);

    const compactState = state;
    step({ type: "TREE_START" });
    step({ type: "TREE_MOVE", px: 800 });
    step({ type: "TREE_END" });
    expect(state).toEqual(compactState);

    step({ type: "TREE_EXPAND" });
    expect(state.collapsed).toBe(false);
    expect(state.renderedTree).toBe(368 + 150);
    expect(state.renderedMain).toBe(960);

    step({ type: "TREE_START" });
    step({ type: "TREE_MOVE", px: 1 });
    expect(state.renderedTree).toBe(TRACE_TREE_MIN_WIDTH_PIXELS + 150);
    expect(state.renderedMain).toBe(1069);
    expect(state.renderedDrawer).toBe(1520);
    expect(state.collapsed).toBe(false);
    step({ type: "TREE_END" });
    expect(state.prefTree).toBe(TRACE_TREE_MIN_WIDTH_PIXELS);
    expect(state.prefMain).toBe(1069);
  });

  it("caps the compact drawer at the main detail column maximum", () => {
    let state = createInitialState({
      treeRaw: null,
      mainRaw: null,
      viewport: 1600,
    });
    const step = (event: SizingEvent) => {
      state = transition(state, event).state;
    };

    step({ type: "OPEN" });
    step({ type: "TREE_COLLAPSE" });
    step({ type: "OUTER_MOVE", px: 1520 });
    step({ type: "OUTER_END", px: 1520 });
    expect(state.collapsed).toBe(true);
    expect(state.renderedDrawer).toBe(48 + 1 + SPAN_DETAILS_MAX_WIDTH_PIXELS);
    expect(state.renderedTree).toBe(48);
    expect(state.renderedMain).toBe(SPAN_DETAILS_MAX_WIDTH_PIXELS);

    step({ type: "TREE_EXPAND" });
    expect(state.collapsed).toBe(false);
    expect(state.renderedDrawer).toBe(1520);
    expect(state.renderedTree).toBe(368);
    expect(state.renderedMain).toBe(1151);
    expect(state.prefTree).toBe(368);
    expect(state.prefMain).toBe(SPAN_DETAILS_MAX_WIDTH_PIXELS);
  });

  it("keeps timing additive and uses main slack to prioritize expansion", () => {
    let state = createInitialState({
      treeRaw: 300,
      mainRaw: 900,
      viewport: 1600,
    });
    const step = (event: SizingEvent) => {
      state = transition(state, event).state;
    };

    step({ type: "OPEN" });
    step({
      type: "TREE_MAX_SET",
      px: getTraceTreeMaximumWidth({ hasTiming: true }),
    });
    const mainWidth = state.renderedMain;
    const drawerWithoutTiming = state.renderedDrawer;
    step({ type: "TREE_ADDON_SET", px: 150 });
    expect(state.renderedTree).toBe(450);
    expect(state.renderedMain).toBe(mainWidth);
    expect(state.renderedDrawer).toBe(drawerWithoutTiming + 150);
    expect(state.prefTree).toBe(300);

    step({ type: "TREE_COLLAPSE" });
    step({ type: "VIEWPORT", px: 1000 });
    step({ type: "TREE_EXPAND" });
    expect(state.collapsed).toBe(false);
    expect(state.renderedTree).toBe(TRACE_TREE_MIN_WIDTH_PIXELS + 150);
    expect(state.renderedMain).toBe(640);
    expect(state.renderedDrawer).toBe(
      TRACE_TREE_MIN_WIDTH_PIXELS + 150 + 1 + 640
    );
    expect(state.prefTree).toBe(300);
    expect(state.prefMain).toBe(900);

    step({ type: "VIEWPORT", px: 1600 });
    expect(state.renderedTree).toBe(300 + 150);
    expect(state.renderedMain).toBe(900);
    expect(state.renderedDrawer).toBe(300 + 150 + 1 + 900);
  });

  it("enforces the navigation maximum and available main-column slack", () => {
    let state = createInitialState({
      treeRaw: null,
      mainRaw: null,
      viewport: 2400,
    });
    const step = (event: SizingEvent) => {
      state = transition(state, event).state;
    };

    step({ type: "OPEN" });
    step({
      type: "TREE_MAX_SET",
      px: getTraceTreeMaximumWidth({ hasTiming: false }),
    });
    step({ type: "TREE_START" });
    step({ type: "TREE_MOVE", px: 900 });
    expect(state.renderedTree).toBe(
      getTraceTreeMaximumWidth({ hasTiming: false })
    );
    step({ type: "TREE_END" });

    step({
      type: "TREE_MAX_SET",
      px: getTraceTreeMaximumWidth({ hasTiming: true }),
    });
    step({ type: "TREE_ADDON_SET", px: 150 });
    step({ type: "TREE_START" });
    step({ type: "TREE_MOVE", px: 2000 });
    expect(state.renderedDrawer).toBe(1271);
    expect(state.renderedTree).toBe(630);
    expect(state.renderedMain).toBe(640);
  });
});
