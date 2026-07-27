/**
 * The details-panel sizing state machine, expressed as data: a flattened
 * integer/boolean state vector plus a table of guarded transition rules whose
 * guards and updates are expressions in the two-backend language of
 * `expr.ts`.
 *
 * The rule table below is the single source of truth for sizing behavior.
 * `transition.ts` interprets it directly (production), and `verify/prove.ts`
 * emits it to Z3 (proof). Editing a rule changes both simultaneously; there is
 * no parallel model to fall out of sync.
 *
 * Semantics: for a dispatched event, the first rule (in table order) whose
 * `event` matches and whose `guard` holds is applied; its `updates` map is
 * evaluated against the *pre* state (simultaneous assignment) and any listed
 * effects whose `when` guard holds are emitted. If no rule matches, the state
 * is unchanged and no effects are emitted — the machine is total by
 * construction.
 */

import {
  SPAN_DETAILS_FACTORY_WIDTH_PIXELS,
  SPAN_DETAILS_MIN_WIDTH_PIXELS,
  TRACE_DETAILS_MIN_DRAWER_WIDTH_PIXELS,
  TRACE_DETAILS_SEPARATOR_WIDTH_PIXELS,
  TRACE_TREE_DEFAULT_WIDTH_PIXELS,
  TRACE_TREE_MIN_WIDTH_PIXELS,
} from "@phoenix/constants";

import type { BoolExpr, Environment, IntExpr } from "./expr";
import {
  add,
  and,
  bool,
  boolVar,
  clampE,
  divConst,
  eq,
  evaluateBool,
  evaluateInt,
  int,
  intVar,
  iteInt,
  maxE,
  minE,
  mulConst,
  ne,
  not,
  or,
  sub,
} from "./expr";

/* -------------------------------- constants ------------------------------ */

export const TREE_MIN = TRACE_TREE_MIN_WIDTH_PIXELS;
export const TREE_DEFAULT = TRACE_TREE_DEFAULT_WIDTH_PIXELS;
export const MAIN_MIN = SPAN_DETAILS_MIN_WIDTH_PIXELS;
export const MAIN_FACTORY = SPAN_DETAILS_FACTORY_WIDTH_PIXELS;
export const SEPARATOR = TRACE_DETAILS_SEPARATOR_WIDTH_PIXELS;
export const DRAWER_MIN = TRACE_DETAILS_MIN_DRAWER_WIDTH_PIXELS;
/** Mirrors the Drawer's default `maxSize` of "95%" of the viewport. */
export const DRAWER_MAX_VIEWPORT_PERCENT = 95;

/* --------------------------------- state --------------------------------- */

export const INT_FIELDS = [
  "gesture",
  "prefTree",
  "prefMain",
  "intendedDrawer",
  "renderedDrawer",
  "renderedTree",
  "renderedMain",
  "viewport",
  "dragStartDrawer",
  "dragStartTree",
  "dragStartMain",
  "dragMaxDrawer",
] as const;

export const BOOL_FIELDS = ["open", "moved"] as const;

export type IntField = (typeof INT_FIELDS)[number];
export type BoolField = (typeof BOOL_FIELDS)[number];

/** `gesture` field values. */
export const GESTURE_IDLE = 0;
export const GESTURE_OUTER = 1;
export const GESTURE_TREE = 2;

export type SizingState = Readonly<Record<IntField, number>> &
  Readonly<Record<BoolField, boolean>>;

/* --------------------------------- events -------------------------------- */

/**
 * The closed event alphabet. `px`-carrying events take one integer parameter
 * named `px` in guard/update expressions.
 */
export const EVENT_TYPES = [
  "OPEN",
  "CLOSE",
  "OUTER_MOVE",
  "OUTER_END",
  "TREE_START",
  "TREE_MOVE",
  "TREE_END",
  "TREE_CANCEL",
  "TREE_PREF_SET",
  "VIEWPORT",
  "ALLOCATION",
] as const;

export type SizingEventType = (typeof EVENT_TYPES)[number];

const EVENTS_WITH_PARAM: ReadonlySet<SizingEventType> = new Set([
  "OUTER_MOVE",
  "OUTER_END",
  "TREE_MOVE",
  "TREE_PREF_SET",
  "VIEWPORT",
  "ALLOCATION",
]);

export const eventHasParam = (type: SizingEventType): boolean =>
  EVENTS_WITH_PARAM.has(type);

export type SizingEvent =
  | { readonly type: "OPEN" }
  | { readonly type: "CLOSE" }
  | { readonly type: "OUTER_MOVE"; readonly px: number }
  | { readonly type: "OUTER_END"; readonly px: number }
  | { readonly type: "TREE_START" }
  | { readonly type: "TREE_MOVE"; readonly px: number }
  | { readonly type: "TREE_END" }
  | { readonly type: "TREE_CANCEL" }
  | { readonly type: "TREE_PREF_SET"; readonly px: number }
  | { readonly type: "VIEWPORT"; readonly px: number }
  | { readonly type: "ALLOCATION"; readonly px: number };

/* --------------------------------- effects ------------------------------- */

export type EffectKind = "persistTree" | "persistMain";

export interface EffectSpec {
  readonly kind: EffectKind;
  /** Emit the effect only when this guard holds (evaluated on the pre state). */
  readonly when: BoolExpr;
  /** Persisted value (evaluated on the pre state). */
  readonly value: IntExpr;
}

export interface SizingEffect {
  readonly kind: EffectKind;
  readonly value: number;
}

/* ---------------------------------- rules -------------------------------- */

export interface TransitionRule {
  readonly name: string;
  readonly event: SizingEventType;
  readonly guard: BoolExpr;
  readonly updates: Partial<Record<IntField, IntExpr>>;
  readonly boolUpdates: Partial<Record<BoolField, BoolExpr>>;
  readonly effects: readonly EffectSpec[];
}

/* ------------------------- kernel (shared algebra) ------------------------ */

const v = intVar;
const px = intVar("px");
const openF = boolVar("open");
const movedF = boolVar("moved");

/** Largest drawer width the viewport permits: max(DRAWER_MIN, 95% of vw). */
export const maxDrawerExpr = (viewport: IntExpr): IntExpr =>
  maxE(
    int(DRAWER_MIN),
    divConst(mulConst(viewport, DRAWER_MAX_VIEWPORT_PERCENT), 100)
  );

/** DW-1/DW-4: the derived drawer width is the sum of preferences + separator. */
export const derivedDrawerExpr = (
  prefTree: IntExpr,
  prefMain: IntExpr
): IntExpr => add(add(prefTree, int(SEPARATOR)), prefMain);

/** Clamp a requested drawer width to [DRAWER_MIN, maxDrawer(viewport)]. */
export const clampDrawerExpr = (width: IntExpr, viewport: IntExpr): IntExpr =>
  clampE(width, int(DRAWER_MIN), maxDrawerExpr(viewport));

/**
 * CP-1/CP-2/TC-2: split an allocated drawer width between the columns. The
 * tree renders at its preference when space allows, compresses toward its
 * 48px floor only after the main column has bottomed out at 640px, and never
 * exceeds its preference on constraint-driven growth.
 */
export const splitTreeExpr = (alloc: IntExpr, prefTree: IntExpr): IntExpr =>
  maxE(int(TREE_MIN), minE(prefTree, sub(alloc, int(SEPARATOR + MAIN_MIN))));

export const splitMainExpr = (alloc: IntExpr, prefTree: IntExpr): IntExpr =>
  sub(sub(alloc, int(SEPARATOR)), splitTreeExpr(alloc, prefTree));

/** DW-3: the main preference implied by a released drawer width. */
export const mainFromDrawerExpr = (
  drawer: IntExpr,
  prefTree: IntExpr
): IntExpr => maxE(int(MAIN_MIN), sub(sub(drawer, prefTree), int(SEPARATOR)));

/**
 * TC-8/TC-9: fixed-origin tree-divider drag mapping. Rightward travel first
 * transfers width from the main column down to its 640px minimum, then grows
 * the drawer up to its captured maximum; reversing retraces the same mapping,
 * relinquishing induced drawer growth before the main column grows again.
 */
export const treeDragExprs = (
  requested: IntExpr
): { drawer: IntExpr; tree: IntExpr; main: IntExpr } => {
  const clampedRequest = maxE(int(TREE_MIN), requested);
  const shrinkCapacity = maxE(int(0), sub(v("dragStartMain"), int(MAIN_MIN)));
  const largestWithoutGrowth = add(v("dragStartTree"), shrinkCapacity);
  const availableGrowth = maxE(
    int(0),
    sub(v("dragMaxDrawer"), v("dragStartDrawer"))
  );
  const tree = minE(clampedRequest, add(largestWithoutGrowth, availableGrowth));
  const drawerGrowth = maxE(int(0), sub(tree, largestWithoutGrowth));
  const drawer = add(v("dragStartDrawer"), drawerGrowth);
  const main = sub(sub(drawer, int(SEPARATOR)), tree);
  return { drawer, tree, main };
};

/* ------------------------------- rule table ------------------------------- */

const isIdle = eq(v("gesture"), int(GESTURE_IDLE));
const isOuter = eq(v("gesture"), int(GESTURE_OUTER));
const isTree = eq(v("gesture"), int(GESTURE_TREE));

/** Rendered geometry recomputed from an allocated width and tree preference. */
const renderFromAllocation = (
  alloc: IntExpr
): Partial<Record<IntField, IntExpr>> => ({
  renderedDrawer: alloc,
  renderedTree: splitTreeExpr(alloc, v("prefTree")),
  renderedMain: splitMainExpr(alloc, v("prefTree")),
});

const openedDrawer = clampDrawerExpr(
  derivedDrawerExpr(v("prefTree"), v("prefMain")),
  v("viewport")
);

/**
 * The drawer width an OPEN dispatch will produce from this state — the same
 * expression the `open` rule evaluates, exposed so the adapter can render a
 * consistent first frame before its mount effect dispatches OPEN.
 */
export function previewOpenDrawerWidth(state: SizingState): number {
  const ints: Record<string, number> = { px: 0 };
  for (const field of INT_FIELDS) ints[field] = state[field];
  return evaluateInt(openedDrawer, {
    ints,
    bools: { open: state.open, moved: state.moved },
  });
}

/**
 * OUTER_MOVE/OUTER_END share this. The gesture start width is the rendered
 * width latched when the gesture began (or the current rendered width when
 * the event arrives from idle, e.g. a keyboard resize).
 */
const outerStart = iteInt(isOuter, v("dragStartDrawer"), v("renderedDrawer"));
const outerWidth = clampDrawerExpr(px, v("viewport"));
const outerMoved = or(and(isOuter, movedF), ne(outerWidth, outerStart));
/** TC-4/PS-4: deliberate = a moved gesture released at a different width. */
const outerCommitted = and(outerMoved, ne(outerWidth, outerStart));

const treeCommitted = and(movedF, ne(v("renderedTree"), v("dragStartTree")));

const treeDrag = treeDragExprs(px);

export const RULES: readonly TransitionRule[] = [
  {
    // Reopen derives the requested width from in-memory preferences alone:
    // no storage read exists on this path, by construction.
    name: "open",
    event: "OPEN",
    guard: not(openF),
    updates: {
      gesture: int(GESTURE_IDLE),
      intendedDrawer: openedDrawer,
      ...renderFromAllocation(openedDrawer),
    },
    boolUpdates: { open: bool(true), moved: bool(false) },
    effects: [],
  },
  {
    // Close is a pure visibility toggle: it is syntactically incapable of
    // touching preferences or persistence.
    name: "close",
    event: "CLOSE",
    guard: openF,
    updates: { gesture: int(GESTURE_IDLE) },
    boolUpdates: { open: bool(false), moved: bool(false) },
    effects: [],
  },
  {
    name: "outerMove",
    event: "OUTER_MOVE",
    guard: and(openF, or(isIdle, isOuter)),
    updates: {
      gesture: int(GESTURE_OUTER),
      dragStartDrawer: outerStart,
      intendedDrawer: outerWidth,
      ...renderFromAllocation(outerWidth),
    },
    boolUpdates: { moved: outerMoved },
    effects: [],
  },
  {
    name: "outerEnd",
    event: "OUTER_END",
    guard: and(openF, or(isIdle, isOuter)),
    updates: {
      gesture: int(GESTURE_IDLE),
      intendedDrawer: outerWidth,
      ...renderFromAllocation(outerWidth),
      // DW-3: a deliberate release stores the main preference implied by the
      // released drawer width; the tree preference is untouched.
      prefMain: iteInt(
        outerCommitted,
        mainFromDrawerExpr(outerWidth, v("prefTree")),
        v("prefMain")
      ),
    },
    boolUpdates: { moved: bool(false) },
    effects: [
      {
        kind: "persistMain",
        when: outerCommitted,
        value: mainFromDrawerExpr(outerWidth, v("prefTree")),
      },
    ],
  },
  {
    // Latch the fixed drag origin from the machine's own rendered geometry.
    // Single-owner rule: a tree gesture cannot begin while another gesture
    // owns the pointer.
    name: "treeStart",
    event: "TREE_START",
    guard: and(openF, isIdle),
    updates: {
      gesture: int(GESTURE_TREE),
      dragStartDrawer: v("renderedDrawer"),
      dragStartTree: v("renderedTree"),
      dragStartMain: v("renderedMain"),
      dragMaxDrawer: maxE(maxDrawerExpr(v("viewport")), v("renderedDrawer")),
    },
    boolUpdates: { moved: bool(false) },
    effects: [],
  },
  {
    name: "treeMove",
    event: "TREE_MOVE",
    guard: and(openF, isTree),
    updates: {
      renderedDrawer: treeDrag.drawer,
      renderedTree: treeDrag.tree,
      renderedMain: treeDrag.main,
      intendedDrawer: treeDrag.drawer,
    },
    boolUpdates: {
      moved: or(movedF, ne(treeDrag.tree, v("dragStartTree"))),
    },
    effects: [],
  },
  {
    // TC-4/TC-5: only a moved release at a different width persists the tree
    // preference; otherwise the pre-gesture geometry is restored.
    name: "treeEnd",
    event: "TREE_END",
    guard: and(openF, isTree),
    updates: {
      gesture: int(GESTURE_IDLE),
      prefTree: iteInt(treeCommitted, v("renderedTree"), v("prefTree")),
      renderedDrawer: iteInt(
        treeCommitted,
        v("renderedDrawer"),
        v("dragStartDrawer")
      ),
      renderedTree: iteInt(
        treeCommitted,
        v("renderedTree"),
        v("dragStartTree")
      ),
      renderedMain: iteInt(
        treeCommitted,
        v("renderedMain"),
        v("dragStartMain")
      ),
      intendedDrawer: iteInt(
        treeCommitted,
        v("renderedDrawer"),
        v("dragStartDrawer")
      ),
    },
    boolUpdates: { moved: bool(false) },
    effects: [
      { kind: "persistTree", when: treeCommitted, value: v("renderedTree") },
    ],
  },
  {
    name: "treeCancel",
    event: "TREE_CANCEL",
    guard: and(openF, isTree),
    updates: {
      gesture: int(GESTURE_IDLE),
      renderedDrawer: v("dragStartDrawer"),
      renderedTree: v("dragStartTree"),
      renderedMain: v("dragStartMain"),
      intendedDrawer: v("dragStartDrawer"),
    },
    boolUpdates: { moved: bool(false) },
    effects: [],
  },
  {
    // XS-3: embedded trace surfaces (dialogs without the outer drawer) and
    // the panel library's keyboard separator share the tree preference. Their
    // local drag geometry stays local; only the deliberate release enters the
    // machine, through this single sanctioned mutator. Rendered geometry is
    // re-split against the unchanged drawer width so the new preference takes
    // effect without waiting for a measurement that will never come.
    name: "treePrefSet",
    event: "TREE_PREF_SET",
    guard: isIdle,
    updates: {
      prefTree: maxE(int(TREE_MIN), px),
      renderedTree: splitTreeExpr(v("renderedDrawer"), maxE(int(TREE_MIN), px)),
      renderedMain: splitMainExpr(v("renderedDrawer"), maxE(int(TREE_MIN), px)),
    },
    boolUpdates: {},
    effects: [
      { kind: "persistTree", when: bool(true), value: maxE(int(TREE_MIN), px) },
    ],
  },
  {
    // While a gesture is active the drag owns geometry (captured origin stays
    // fixed); only the viewport record updates. When idle, the drawer re-derives
    // from the session-intended width, which temporary constraint never
    // overwrote — so reclamation toward preferences is automatic (CP-4).
    name: "viewportIdle",
    event: "VIEWPORT",
    guard: and(openF, isIdle),
    updates: {
      viewport: maxE(int(1), px),
      ...renderFromAllocation(
        clampDrawerExpr(v("intendedDrawer"), maxE(int(1), px))
      ),
    },
    boolUpdates: {},
    effects: [],
  },
  {
    name: "viewportOther",
    event: "VIEWPORT",
    guard: bool(true),
    updates: { viewport: maxE(int(1), px) },
    boolUpdates: {},
    effects: [],
  },
  {
    // Measured reality wins for rendered geometry, floored at the layout's
    // hard minimum; the session intent is preserved so constraint compression
    // is never mistaken for intent (CP-3). Idempotent (Q-1): re-measuring the
    // same width is a fixpoint.
    name: "allocation",
    event: "ALLOCATION",
    guard: and(openF, isIdle),
    updates: renderFromAllocation(maxE(int(DRAWER_MIN), px)),
    boolUpdates: {},
    effects: [],
  },
];

/* ------------------------------ initial state ----------------------------- */

export interface HydrationInput {
  /** Raw persisted tree width, or null when missing/invalid. */
  readonly treeRaw: number | null;
  /** Raw persisted main width, or null when missing/invalid. */
  readonly mainRaw: number | null;
  readonly viewport: number;
}

/**
 * PS-5 (hydration totality), expressed in the two-backend language so the
 * Init⇒Invariant obligation in `verify/prove.ts` reasons about the same
 * expressions `createInitialState` evaluates. Input variables:
 * `treeRawPresent`/`treeRaw`, `mainRawPresent`/`mainRaw`, `viewportRaw`.
 */
const initPrefTree = iteInt(
  boolVar("treeRawPresent"),
  maxE(int(TREE_MIN), v("treeRaw")),
  int(TREE_DEFAULT)
);
const initPrefMain = iteInt(
  boolVar("mainRawPresent"),
  maxE(int(MAIN_MIN), v("mainRaw")),
  int(MAIN_FACTORY)
);
const initViewport = maxE(int(1), v("viewportRaw"));
const initDrawer = clampDrawerExpr(
  derivedDrawerExpr(initPrefTree, initPrefMain),
  initViewport
);
const initTree = splitTreeExpr(initDrawer, initPrefTree);
const initMain = splitMainExpr(initDrawer, initPrefTree);

export const INIT_INT_EXPRS: Readonly<Record<IntField, IntExpr>> = {
  gesture: int(GESTURE_IDLE),
  prefTree: initPrefTree,
  prefMain: initPrefMain,
  intendedDrawer: initDrawer,
  renderedDrawer: initDrawer,
  renderedTree: initTree,
  renderedMain: initMain,
  viewport: initViewport,
  dragStartDrawer: initDrawer,
  dragStartTree: initTree,
  dragStartMain: initMain,
  dragMaxDrawer: maxDrawerExpr(initViewport),
};

export const INIT_BOOL_EXPRS: Readonly<Record<BoolField, BoolExpr>> = {
  open: bool(false),
  moved: bool(false),
};

export const INIT_INPUT_INT_VARS = [
  "treeRaw",
  "mainRaw",
  "viewportRaw",
] as const;
export const INIT_INPUT_BOOL_VARS = [
  "treeRawPresent",
  "mainRawPresent",
] as const;

/**
 * Evaluate the Init expressions. Missing, non-numeric, or non-finite stored
 * values arrive as null and fall back to defaults; finite values are floored
 * at the column minimum. The raw stored value is never rewritten.
 */
export function createInitialState({
  treeRaw,
  mainRaw,
  viewport,
}: HydrationInput): SizingState {
  const env: Environment = {
    ints: {
      treeRaw: treeRaw == null ? 0 : Math.round(treeRaw),
      mainRaw: mainRaw == null ? 0 : Math.round(mainRaw),
      viewportRaw: Math.round(viewport),
    },
    bools: {
      treeRawPresent: treeRaw != null,
      mainRawPresent: mainRaw != null,
    },
  };
  const state: Record<string, number | boolean> = {};
  for (const field of INT_FIELDS) {
    state[field] = evaluateInt(INIT_INT_EXPRS[field], env);
  }
  for (const field of BOOL_FIELDS) {
    state[field] = evaluateBool(INIT_BOOL_EXPRS[field], env);
  }
  return state as unknown as SizingState;
}
