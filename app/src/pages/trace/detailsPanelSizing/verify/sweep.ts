/**
 * The bounded-depth exhaustive sweep, as a library so both the vitest
 * checker (`__tests__/enumeration.test.ts`) and the mutation gate
 * (`verify/mutation.ts`) can run it against arbitrary rule tables.
 *
 * See the vitest file for the claim this checker makes and how it divides
 * labor with the Z3 harness.
 */

import type { Environment } from "../expr";
import { evaluateBool } from "../expr";
import { STATE_INVARIANTS } from "../invariants";
import type { SizingEvent, SizingState, TransitionRule } from "../machine";
import {
  BOOL_FIELDS,
  createInitialState,
  INT_FIELDS,
  MAIN_MAX,
  MAIN_MIN,
  RULES,
  SEPARATOR,
  TREE_COLLAPSED,
  TREE_MIN,
} from "../machine";
import { transition } from "../transition";

// Interleaving coverage is the sweep's job; per-width boundary (±1) coverage
// is the SMT harness's, which quantifies over all integers. Values here are
// chosen to reach every guard polarity and both compression regimes without a
// combinatorial value explosion.
const VIEWPORTS = [1600];
const TREE_RAWS = [null, 0, TREE_MIN, 800];
const MAIN_RAWS = [null, 0, 1151];

const DRAWER_PARAMS = [0, 689, 1320, 1520, 5000];
const TREE_PARAMS = [-5, 48, TREE_MIN, 900];
const TREE_PREF_PARAMS = [47, 900];
const VIEWPORT_PARAMS = [600, 1600];
const ALLOCATION_PARAMS = [689, 1320];

export const SWEEP_EVENTS: readonly SizingEvent[] = [
  { type: "OPEN" },
  { type: "CLOSE" },
  { type: "TREE_START" },
  { type: "TREE_END" },
  { type: "TREE_CANCEL" },
  { type: "TREE_COLLAPSE" },
  { type: "TREE_EXPAND" },
  ...DRAWER_PARAMS.map((px): SizingEvent => ({ type: "OUTER_MOVE", px })),
  ...DRAWER_PARAMS.map((px): SizingEvent => ({ type: "OUTER_END", px })),
  ...TREE_PARAMS.map((px): SizingEvent => ({ type: "TREE_MOVE", px })),
  ...TREE_PREF_PARAMS.map((px): SizingEvent => ({ type: "TREE_PREF_SET", px })),
  { type: "TREE_ADDON_SET", px: 0 },
  { type: "TREE_ADDON_SET", px: 150 },
  ...VIEWPORT_PARAMS.map((px): SizingEvent => ({ type: "VIEWPORT", px })),
  ...ALLOCATION_PARAMS.map((px): SizingEvent => ({ type: "ALLOCATION", px })),
];

/**
 * Exhaustive up to this many events from every initial state (bounded model
 * checking of the shipped function). Width arithmetic composed with
 * preference commits generates genuinely new values at each depth, so the
 * full closure is infinite-in-practice; unbounded-depth coverage over all
 * integer widths is the SMT harness's theorem, not this sweep's. Depth 9 was
 * the diameter of the prior TLA+ persistence model; 10 exceeds every scenario
 * in the assertions document (open → drag → release → close → reopen → drag →
 * release → close → reopen is 9 events).
 */
export const DEPTH_BOUND = 10;
const STATE_CAP = 1_500_000;

export const stateKey = (state: SizingState): string =>
  `${BOOL_FIELDS.map((field) => (state[field] ? 1 : 0)).join("|")}|${INT_FIELDS.map((field) => state[field]).join("|")}`;

const environmentFor = (state: SizingState): Environment => {
  const ints: Record<string, number> = {};
  for (const field of INT_FIELDS) ints[field] = state[field];
  const bools: Record<string, boolean> = {};
  for (const field of BOOL_FIELDS) bools[field] = state[field];
  return { ints, bools };
};

const statesEqual = (a: SizingState, b: SizingState): boolean =>
  stateKey(a) === stateKey(b);

const getMinimumDrawer = ({
  collapsed,
  treeAddon,
}: Pick<SizingState, "collapsed" | "treeAddon">): number =>
  MAIN_MIN + SEPARATOR + (collapsed ? TREE_COLLAPSED : TREE_MIN + treeAddon);

const getMaximumTree = ({
  collapsed,
  treeMax,
}: Pick<SizingState, "collapsed" | "treeMax">): number =>
  collapsed ? TREE_COLLAPSED : treeMax;

const getPreferredTree = ({
  collapsed,
  prefTree,
  treeAddon,
  treeMax,
}: Pick<
  SizingState,
  "collapsed" | "prefTree" | "treeAddon" | "treeMax"
>): number =>
  collapsed
    ? TREE_COLLAPSED
    : Math.min(prefTree + treeAddon, getMaximumTree({ collapsed, treeMax }));

const getCanonicalTree = (state: SizingState): number => {
  if (state.collapsed) return TREE_COLLAPSED;
  const minimumTree = TREE_MIN + state.treeAddon;
  const maximumTree = getMaximumTree(state);
  const availableAtMainMinimum = state.renderedDrawer - SEPARATOR - MAIN_MIN;
  const treeBeyondMainMaximum = state.renderedDrawer - SEPARATOR - MAIN_MAX;
  return Math.min(
    maximumTree,
    Math.max(
      minimumTree,
      Math.max(
        Math.min(getPreferredTree(state), availableAtMainMinimum),
        treeBeyondMainMaximum
      )
    )
  );
};

const clampDrawer = ({
  collapsed,
  treeAddon,
  treeMax,
  viewport,
  width,
}: Pick<
  SizingState,
  "collapsed" | "prefTree" | "treeAddon" | "treeMax" | "viewport"
> & {
  width: number;
}): number => {
  const minimumDrawer = getMinimumDrawer({ collapsed, treeAddon });
  const maximumDrawer = Math.max(
    minimumDrawer,
    Math.min(
      Math.floor((viewport * 95) / 100),
      getMaximumTree({ collapsed, treeMax }) + SEPARATOR + MAIN_MAX
    )
  );
  return Math.max(minimumDrawer, Math.min(width, maximumDrawer));
};

interface Edge {
  readonly pre: SizingState;
  readonly event: SizingEvent;
  readonly post: SizingState;
  readonly effects: readonly { kind: string; value: number }[];
}

const describeEdge = (edge: Edge): string =>
  `${JSON.stringify(edge.event)}\npre:  ${stateKey(edge.pre)}\npost: ${stateKey(edge.post)}`;

/** Transition (edge) properties — the universally quantified versions are
 *  proven by Z3; here each is checked concretely on every explored edge. */
function checkEdge(edge: Edge, rules: readonly TransitionRule[]): void {
  const { pre, event, post, effects } = edge;

  // preferenceFrame (TC-4, CP-3, PS-4, NR-7)
  if (post.prefTree !== pre.prefTree) {
    if (
      event.type !== "OUTER_END" &&
      event.type !== "TREE_END" &&
      event.type !== "TREE_PREF_SET"
    ) {
      throw new Error(`prefTree changed by ${describeEdge(edge)}`);
    }
  }

  if (event.type === "OUTER_END" && post.prefTree !== pre.prefTree) {
    if (
      post.renderedTree <= getPreferredTree(pre) ||
      post.prefTree !== post.renderedTree - pre.treeAddon
    ) {
      throw new Error(
        `outer tree commit width mismatch: ${describeEdge(edge)}`
      );
    }
  }
  if (
    post.prefMain !== pre.prefMain &&
    event.type !== "OUTER_END" &&
    event.type !== "TREE_END"
  ) {
    throw new Error(`prefMain changed by ${describeEdge(edge)}`);
  }

  // deliberateTreeCommit (TC-4, TC-5)
  if (event.type === "TREE_END" && post.prefTree !== pre.prefTree) {
    if (!pre.moved || pre.renderedTree === getCanonicalTree(pre)) {
      throw new Error(`non-deliberate tree commit: ${describeEdge(edge)}`);
    }
    if (post.prefTree !== post.renderedTree - pre.treeAddon) {
      throw new Error(`tree commit width mismatch: ${describeEdge(edge)}`);
    }
  }

  if (event.type === "TREE_END" && post.prefMain !== pre.prefMain) {
    if (
      !pre.moved ||
      (pre.renderedTree !== pre.dragStartTree &&
        (pre.renderedTree !== TREE_MIN + pre.treeAddon ||
          pre.renderedDrawer <= pre.dragStartDrawer)) ||
      pre.renderedMain === pre.dragStartMain
    ) {
      throw new Error(`non-deliberate tree main commit: ${describeEdge(edge)}`);
    }
    if (post.prefMain !== post.renderedMain) {
      throw new Error(`tree main commit width mismatch: ${describeEdge(edge)}`);
    }
  }

  // deliberateMainCommit + releasedMainMatchesSplit (DW-3, CC-5)
  if (event.type === "OUTER_END" && post.prefMain !== pre.prefMain) {
    if (post.prefMain !== post.renderedMain) {
      throw new Error(`main commit != rendered main: ${describeEdge(edge)}`);
    }
    const expected = Math.max(
      MAIN_MIN,
      Math.min(
        MAIN_MAX,
        post.renderedDrawer - getPreferredTree(pre) - SEPARATOR
      )
    );
    if (post.prefMain !== expected) {
      throw new Error(`DW-3 formula violated: ${describeEdge(edge)}`);
    }
  }

  // reopenDerivesFromPreferences (DW-1, PS-1, PS-3 — the reported defect)
  if (event.type === "OPEN" && !pre.open) {
    const preferredTree = getPreferredTree(pre);
    const derived = clampDrawer({
      collapsed: pre.collapsed,
      prefTree: pre.prefTree,
      treeAddon: pre.treeAddon,
      treeMax: pre.treeMax,
      viewport: pre.viewport,
      width: preferredTree + SEPARATOR + pre.prefMain,
    });
    if (post.renderedDrawer !== derived) {
      throw new Error(`reopen width not derived: ${describeEdge(edge)}`);
    }
  }

  // EC-1: only explicit button events may change compact mode.
  if (
    post.collapsed !== pre.collapsed &&
    event.type !== "TREE_COLLAPSE" &&
    event.type !== "TREE_EXPAND"
  ) {
    throw new Error(`compact mode changed by ${describeEdge(edge)}`);
  }

  // CG-1/CG-2: collapse changes only tree/drawer effective geometry.
  if (event.type === "TREE_COLLAPSE" && post.collapsed !== pre.collapsed) {
    if (
      post.renderedTree !== TREE_COLLAPSED ||
      post.renderedMain !== pre.renderedMain ||
      post.renderedDrawer !== TREE_COLLAPSED + SEPARATOR + pre.renderedMain ||
      post.prefTree !== pre.prefTree ||
      post.prefMain !== pre.prefMain
    ) {
      throw new Error(`collapse geometry violated: ${describeEdge(edge)}`);
    }
  }

  // Expansion clears compact mode and may consume main slack down to its floor.
  if (event.type === "TREE_EXPAND" && post.collapsed !== pre.collapsed) {
    if (
      post.renderedMain > pre.renderedMain ||
      post.renderedTree < TREE_MIN + pre.treeAddon ||
      post.renderedTree > getMaximumTree(post) ||
      post.renderedDrawer !==
        post.renderedTree + SEPARATOR + post.renderedMain ||
      post.prefTree !== pre.prefTree ||
      post.prefMain !== pre.prefMain
    ) {
      throw new Error(`expand geometry violated: ${describeEdge(edge)}`);
    }
  }

  // AT-3/AT-7: timing never mutates navigation preference or compact geometry.
  if (event.type === "TREE_ADDON_SET") {
    const expectedTreeAddon = Math.min(
      pre.treeMax - TREE_MIN,
      Math.max(0, event.px)
    );
    if (pre.gesture === 0 && post.treeAddon !== expectedTreeAddon) {
      throw new Error(`timing add-on did not update: ${describeEdge(edge)}`);
    }
    if (post.prefTree !== pre.prefTree) {
      throw new Error(
        `timing changed navigation preference: ${describeEdge(edge)}`
      );
    }
    if (
      pre.collapsed &&
      (post.renderedTree !== pre.renderedTree ||
        post.renderedMain !== pre.renderedMain ||
        post.renderedDrawer !== pre.renderedDrawer)
    ) {
      throw new Error(`timing changed compact geometry: ${describeEdge(edge)}`);
    }
  }

  if (post.treeMax !== pre.treeMax && event.type !== "TREE_MAX_SET") {
    throw new Error(`treeMax changed by ${describeEdge(edge)}`);
  }

  // persistMatchesState (PS-7, DW-2) + effect sanctioning
  for (const effect of effects) {
    if (effect.kind === "persistTree" && effect.value !== post.prefTree) {
      throw new Error(`persistTree stale value: ${describeEdge(edge)}`);
    }
    if (effect.kind === "persistMain" && effect.value !== post.prefMain) {
      throw new Error(`persistMain stale value: ${describeEdge(edge)}`);
    }
    if (effect.kind === "persistTree") {
      const deliberateTreeRelease =
        (event.type === "TREE_END" &&
          pre.moved &&
          pre.renderedTree !== getCanonicalTree(pre)) ||
        (event.type === "OUTER_END" &&
          post.renderedTree > getPreferredTree(pre));
      if (!deliberateTreeRelease && event.type !== "TREE_PREF_SET") {
        throw new Error(`non-deliberate persistTree: ${describeEdge(edge)}`);
      }
    }
    if (
      effect.kind === "persistMain" &&
      event.type !== "OUTER_END" &&
      event.type !== "TREE_END"
    ) {
      throw new Error(`non-deliberate persistMain: ${describeEdge(edge)}`);
    }
  }

  // allocationIdempotent / viewportIdempotent (Q-1)
  if (event.type === "ALLOCATION" || event.type === "VIEWPORT") {
    const again = transition(post, event, rules);
    if (!statesEqual(again.state, post) || again.effects.length > 0) {
      throw new Error(`measurement not idempotent: ${describeEdge(edge)}`);
    }
  }
}

export interface SweepResult {
  readonly states: number;
  readonly edges: number;
}

/**
 * Run the bounded-depth exhaustive sweep. Throws on the first invariant or
 * edge-property violation with a replayable description.
 */
export function runSweep(
  rules: readonly TransitionRule[] = RULES
): SweepResult {
  const frontier: SizingState[] = [];
  const depths: number[] = [];
  const seen = new Set<string>();

  for (const viewport of VIEWPORTS) {
    for (const treeRaw of TREE_RAWS) {
      for (const mainRaw of MAIN_RAWS) {
        const initial = createInitialState({ treeRaw, mainRaw, viewport });
        const key = stateKey(initial);
        if (!seen.has(key)) {
          seen.add(key);
          frontier.push(initial);
          depths.push(0);
        }
      }
    }
  }

  let edges = 0;

  for (let index = 0; index < frontier.length; index++) {
    const state = frontier[index];
    const depth = depths[index];

    const env = environmentFor(state);
    for (const invariant of STATE_INVARIANTS) {
      if (!evaluateBool(invariant.expr, env)) {
        throw new Error(
          `Invariant ${invariant.name} (${invariant.traces.join(", ")}) violated at ${stateKey(state)}`
        );
      }
    }

    if (depth >= DEPTH_BOUND) continue;

    for (const event of SWEEP_EVENTS) {
      const { state: post, effects } = transition(state, event, rules);
      edges++;
      checkEdge({ pre: state, event, post, effects }, rules);
      const key = stateKey(post);
      if (!seen.has(key)) {
        if (seen.size >= STATE_CAP) {
          throw new Error(
            `State cap ${STATE_CAP} exceeded — domain needs re-tuning, not a correctness failure`
          );
        }
        seen.add(key);
        frontier.push(post);
        depths.push(depth + 1);
      }
    }
  }

  return { states: frontier.length, edges };
}
