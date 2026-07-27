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
});
