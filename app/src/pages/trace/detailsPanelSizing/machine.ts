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
  SPAN_DETAILS_MAX_WIDTH_PIXELS,
  SPAN_DETAILS_MIN_WIDTH_PIXELS,
  TRACE_DETAILS_MIN_DRAWER_WIDTH_PIXELS,
  TRACE_DETAILS_SEPARATOR_WIDTH_PIXELS,
  TRACE_TREE_COLLAPSED_WIDTH_PIXELS,
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
  le,
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
export const TREE_COLLAPSED = TRACE_TREE_COLLAPSED_WIDTH_PIXELS;
export const TREE_DEFAULT = TRACE_TREE_DEFAULT_WIDTH_PIXELS;
export const MAIN_MIN = SPAN_DETAILS_MIN_WIDTH_PIXELS;
export const MAIN_FACTORY = SPAN_DETAILS_FACTORY_WIDTH_PIXELS;
export const MAIN_MAX = SPAN_DETAILS_MAX_WIDTH_PIXELS;
export const SEPARATOR = TRACE_DETAILS_SEPARATOR_WIDTH_PIXELS;
export const DRAWER_MIN = TRACE_DETAILS_MIN_DRAWER_WIDTH_PIXELS;
/** Mirrors the Drawer's default `maxSize` of "95%" of the viewport. */
export const DRAWER_MAX_VIEWPORT_PERCENT = 95;

/* --------------------------------- state --------------------------------- */

export const INT_FIELDS = [
  "gesture",
  "prefTree",
  "prefMain",
  "treeAddon",
  "treeMax",
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

export const BOOL_FIELDS = ["open", "moved", "collapsed"] as const;

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
  "TREE_ADDON_SET",
  "TREE_MAX_SET",
  "TREE_COLLAPSE",
  "TREE_EXPAND",
  "VIEWPORT",
  "ALLOCATION",
] as const;

export type SizingEventType = (typeof EVENT_TYPES)[number];

const EVENTS_WITH_PARAM: ReadonlySet<SizingEventType> = new Set([
  "OUTER_MOVE",
  "OUTER_END",
  "TREE_MOVE",
  "TREE_PREF_SET",
  "TREE_ADDON_SET",
  "TREE_MAX_SET",
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
  | { readonly type: "TREE_ADDON_SET"; readonly px: number }
  | { readonly type: "TREE_MAX_SET"; readonly px: number }
  | { readonly type: "TREE_COLLAPSE" }
  | { readonly type: "TREE_EXPAND" }
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
const collapsedF = boolVar("collapsed");

/** Maximum rendered tree width supplied by the navigation child. */
export const maximumTreeExpr = (
  treeMax: IntExpr,
  collapsed: BoolExpr
): IntExpr => iteInt(collapsed, int(TREE_COLLAPSED), treeMax);

/** The current mode's hard layout minimum. */
export const minimumDrawerExpr = (
  treeAddon: IntExpr,
  collapsed: BoolExpr
): IntExpr =>
  derivedDrawerExpr(
    iteInt(collapsed, int(TREE_COLLAPSED), add(int(TREE_MIN), treeAddon)),
    int(MAIN_MIN)
  );

/**
 * Largest drawer width: both columns at their hard maxima, further
 * constrained by the viewport. The outer handle may therefore reclaim tree
 * capacity after the main column reaches its maximum.
 */
export const maxDrawerExpr = (
  viewport: IntExpr,
  treeAddon: IntExpr = v("treeAddon"),
  collapsed: BoolExpr = collapsedF,
  treeMax: IntExpr = v("treeMax")
): IntExpr =>
  maxE(
    minimumDrawerExpr(treeAddon, collapsed),
    minE(
      divConst(mulConst(viewport, DRAWER_MAX_VIEWPORT_PERCENT), 100),
      derivedDrawerExpr(maximumTreeExpr(treeMax, collapsed), int(MAIN_MAX))
    )
  );

/**
 * Tree-divider gestures may increase the tree preference, so their captured
 * drawer capacity uses the tree's own maximum rather than its old preference.
 */
export const maximumTreeDragDrawerExpr = (
  viewport: IntExpr,
  treeAddon: IntExpr = v("treeAddon"),
  treeMax: IntExpr = v("treeMax")
): IntExpr =>
  maxE(
    minimumDrawerExpr(treeAddon, bool(false)),
    minE(
      divConst(mulConst(viewport, DRAWER_MAX_VIEWPORT_PERCENT), 100),
      derivedDrawerExpr(maximumTreeExpr(treeMax, bool(false)), int(MAIN_MAX))
    )
  );

/** DW-1/DW-4: the derived drawer width is the sum of preferences + separator. */
export const derivedDrawerExpr = (
  treeWidth: IntExpr,
  prefMain: IntExpr
): IntExpr => add(add(treeWidth, int(SEPARATOR)), prefMain);

/** Preferred rendered width: navigation preference plus additive UI width. */
export const preferredTreeExpr = (
  prefTree: IntExpr,
  treeAddon: IntExpr,
  collapsed: BoolExpr,
  treeMax: IntExpr = v("treeMax")
): IntExpr =>
  iteInt(
    collapsed,
    int(TREE_COLLAPSED),
    minE(add(prefTree, treeAddon), maximumTreeExpr(treeMax, collapsed))
  );

/** Clamp a requested drawer width to the current mode's dynamic bounds. */
export const clampDrawerExpr = (
  width: IntExpr,
  viewport: IntExpr,
  treeAddon: IntExpr = v("treeAddon"),
  collapsed: BoolExpr = collapsedF,
  treeMax: IntExpr = v("treeMax")
): IntExpr =>
  clampE(
    width,
    minimumDrawerExpr(treeAddon, collapsed),
    maxDrawerExpr(viewport, treeAddon, collapsed, treeMax)
  );

/**
 * CP-1/CP-2/TC-2: split an allocated drawer width between the columns. The
 * tree renders at its preference while the main column has room. After the
 * main reaches its maximum, additional allocation grows the tree up to its
 * own maximum. Expanded allocation is floored at navigation minimum plus
 * additive timing width; compact mode is exactly the existing 48px rail.
 */
export const splitTreeExpr = (
  alloc: IntExpr,
  prefTree: IntExpr,
  treeAddon: IntExpr,
  collapsed: BoolExpr,
  treeMax: IntExpr = v("treeMax")
): IntExpr => {
  const availableTreeWidthAtMainMinimum = sub(alloc, int(SEPARATOR + MAIN_MIN));
  const treeWidthBeyondMainMaximum = sub(alloc, int(SEPARATOR + MAIN_MAX));
  const minimumOpenWidth = add(int(TREE_MIN), treeAddon);
  const maximumOpenWidth = maximumTreeExpr(treeMax, bool(false));
  const preferredOpenWidth = minE(add(prefTree, treeAddon), maximumOpenWidth);
  return iteInt(
    collapsed,
    int(TREE_COLLAPSED),
    minE(
      maximumOpenWidth,
      maxE(
        minimumOpenWidth,
        maxE(
          minE(preferredOpenWidth, availableTreeWidthAtMainMinimum),
          treeWidthBeyondMainMaximum
        )
      )
    )
  );
};

export const splitMainExpr = (
  alloc: IntExpr,
  prefTree: IntExpr,
  treeAddon: IntExpr,
  collapsed: BoolExpr,
  treeMax: IntExpr = v("treeMax")
): IntExpr =>
  sub(
    sub(alloc, int(SEPARATOR)),
    splitTreeExpr(alloc, prefTree, treeAddon, collapsed, treeMax)
  );

/** DW-3: the main preference implied by a released drawer width. */
export const mainFromDrawerExpr = (
  drawer: IntExpr,
  prefTree: IntExpr
): IntExpr =>
  clampE(
    sub(sub(drawer, prefTree), int(SEPARATOR)),
    int(MAIN_MIN),
    int(MAIN_MAX)
  );

/**
 * TC-8/TC-9: fixed-origin tree-divider drag mapping. Rightward travel first
 * grows the tree by shrinking the main column. If the tree reaches its maximum
 * before the main reaches 640px, continued travel keeps the tree pinned and
 * shrinks the main and drawer together; it never grows the drawer to the left.
 * If the main reaches its minimum first, travel clamps. Leftward travel shrinks
 * the tree until its expanded minimum; only overflow beyond that hard limit
 * grows the drawer to the left and transfers new width to the main column.
 * Reversing retraces the same mapping in either direction.
 */
export const treeDragExprs = (
  requested: IntExpr
): { drawer: IntExpr; tree: IntExpr; main: IntExpr } => {
  const minimumOpenWidth = add(int(TREE_MIN), v("treeAddon"));
  const maximumOpenWidth = maximumTreeExpr(v("treeMax"), bool(false));
  const mainGrowthCapacity = maxE(
    int(0),
    sub(int(MAIN_MAX), v("dragStartMain"))
  );
  const smallestWithoutExceedingMainMaximum = sub(
    v("dragStartTree"),
    mainGrowthCapacity
  );
  const requestWithinMainMaximum = maxE(
    smallestWithoutExceedingMainMaximum,
    requested
  );
  const shrinkCapacity = maxE(int(0), sub(v("dragStartMain"), int(MAIN_MIN)));
  const largestWithoutGrowth = add(v("dragStartTree"), shrinkCapacity);
  const availableGrowth = maxE(
    int(0),
    sub(v("dragMaxDrawer"), v("dragStartDrawer"))
  );
  const leftwardTree = minE(
    maximumOpenWidth,
    maxE(minimumOpenWidth, requestWithinMainMaximum)
  );
  const leftDrawerGrowth = minE(
    availableGrowth,
    maxE(int(0), sub(minimumOpenWidth, requestWithinMainMaximum))
  );
  const leftwardDrawer = add(v("dragStartDrawer"), leftDrawerGrowth);
  const rightwardTree = minE(
    maximumOpenWidth,
    minE(maxE(v("dragStartTree"), requested), largestWithoutGrowth)
  );
  const canReachMaximumTree = le(maximumOpenWidth, largestWithoutGrowth);
  const maximumTreeOverflow = iteInt(
    canReachMaximumTree,
    maxE(int(0), sub(requested, maximumOpenWidth)),
    int(0)
  );
  const rightwardMainBeforeOverflow = sub(
    sub(v("dragStartDrawer"), int(SEPARATOR)),
    rightwardTree
  );
  const availableRightwardMainShrink = maxE(
    int(0),
    sub(rightwardMainBeforeOverflow, int(MAIN_MIN))
  );
  const rightwardDrawerShrink = minE(
    maximumTreeOverflow,
    availableRightwardMainShrink
  );
  const rightwardDrawer = sub(v("dragStartDrawer"), rightwardDrawerShrink);
  const isLeftward = le(requested, v("dragStartTree"));
  const tree = iteInt(isLeftward, leftwardTree, rightwardTree);
  const drawer = iteInt(isLeftward, leftwardDrawer, rightwardDrawer);
  const main = sub(sub(drawer, int(SEPARATOR)), tree);
  return { drawer, tree, main };
};

/* ------------------------------- rule table ------------------------------- */

const isIdle = eq(v("gesture"), int(GESTURE_IDLE));
const isOuter = eq(v("gesture"), int(GESTURE_OUTER));
const isTree = eq(v("gesture"), int(GESTURE_TREE));

/** Rendered geometry recomputed from an allocated width and tree preference. */
const renderFromAllocation = (
  alloc: IntExpr,
  prefTree: IntExpr = v("prefTree"),
  treeAddon: IntExpr = v("treeAddon"),
  collapsed: BoolExpr = collapsedF,
  treeMax: IntExpr = v("treeMax")
): Partial<Record<IntField, IntExpr>> => ({
  renderedDrawer: alloc,
  renderedTree: splitTreeExpr(alloc, prefTree, treeAddon, collapsed, treeMax),
  renderedMain: splitMainExpr(alloc, prefTree, treeAddon, collapsed, treeMax),
});

const getOpenedDrawerExpr = ({
  treeAddon = v("treeAddon"),
  treeMax = v("treeMax"),
  collapsed = collapsedF,
}: {
  treeAddon?: IntExpr;
  treeMax?: IntExpr;
  collapsed?: BoolExpr;
} = {}): IntExpr =>
  clampDrawerExpr(
    derivedDrawerExpr(
      preferredTreeExpr(v("prefTree"), treeAddon, collapsed, treeMax),
      v("prefMain")
    ),
    v("viewport"),
    treeAddon,
    collapsed,
    treeMax
  );

const openedDrawer = getOpenedDrawerExpr();

/**
 * The drawer width an OPEN dispatch will produce from this state — the same
 * expression the `open` rule evaluates, exposed so the adapter can render a
 * consistent first frame before its mount effect dispatches OPEN.
 */
export function previewOpenDrawerWidth(
  state: SizingState,
  treeAddon = state.treeAddon,
  treeMax = state.treeMax
): number {
  const ints: Record<string, number> = { px: 0 };
  for (const field of INT_FIELDS) ints[field] = state[field];
  ints.treeMax = Math.max(TREE_MIN, Math.round(treeMax));
  ints.treeAddon = Math.min(
    Math.max(0, ints.treeMax - TREE_MIN),
    Math.max(0, Math.round(treeAddon))
  );
  return evaluateInt(openedDrawer, {
    ints,
    bools: {
      open: state.open,
      moved: state.moved,
      collapsed: state.collapsed,
    },
  });
}

const maximumDrawerForState = iteInt(
  eq(v("gesture"), int(GESTURE_TREE)),
  maximumTreeDragDrawerExpr(v("viewport")),
  maxDrawerExpr(v("viewport"))
);

/**
 * The exact maximum the outer Drawer must enforce for the current mode: the
 * mode's tree maximum plus the main maximum, capped by the viewport.
 */
export function previewMaximumDrawerWidth(
  state: SizingState,
  treeAddon = state.treeAddon,
  treeMax = state.treeMax
): number {
  const ints: Record<string, number> = { px: 0 };
  for (const field of INT_FIELDS) ints[field] = state[field];
  ints.treeMax = Math.max(TREE_MIN, Math.round(treeMax));
  ints.treeAddon = Math.min(
    Math.max(0, ints.treeMax - TREE_MIN),
    Math.max(0, Math.round(treeAddon))
  );
  return evaluateInt(maximumDrawerForState, {
    ints,
    bools: {
      open: state.open,
      moved: state.moved,
      collapsed: state.collapsed,
    },
  });
}

/**
 * OUTER_MOVE/OUTER_END share this. The gesture start width is the rendered
 * width latched when the gesture began (or the current rendered width when
 * the event arrives from idle, e.g. a keyboard resize).
 */
const outerStart = iteInt(isOuter, v("dragStartDrawer"), v("renderedDrawer"));
const outerWidth = clampDrawerExpr(
  px,
  v("viewport"),
  v("treeAddon"),
  collapsedF
);
const outerMoved = or(and(isOuter, movedF), ne(outerWidth, outerStart));
/** TC-4/PS-4: deliberate = a moved gesture released at a different width. */
const outerCommitted = and(outerMoved, ne(outerWidth, outerStart));
const outerRenderedTree = splitTreeExpr(
  outerWidth,
  v("prefTree"),
  v("treeAddon"),
  collapsedF
);
const outerPreferredTree = preferredTreeExpr(
  v("prefTree"),
  v("treeAddon"),
  collapsedF
);
const outerTreeCommitted = and(
  outerCommitted,
  not(le(outerRenderedTree, outerPreferredTree))
);

const releasedTreeFromCurrentPreference = splitTreeExpr(
  v("renderedDrawer"),
  v("prefTree"),
  v("treeAddon"),
  collapsedF
);
const treePreferenceCommitted = and(
  movedF,
  ne(v("renderedTree"), releasedTreeFromCurrentPreference)
);
const mainPreferenceCommittedFromTree = and(
  movedF,
  or(
    eq(v("renderedTree"), v("dragStartTree")),
    and(
      eq(v("renderedTree"), add(int(TREE_MIN), v("treeAddon"))),
      not(le(v("renderedDrawer"), v("dragStartDrawer")))
    )
  ),
  ne(v("renderedMain"), v("dragStartMain"))
);
const treeGestureCommitted = or(
  treePreferenceCommitted,
  mainPreferenceCommittedFromTree
);

const treeDrag = treeDragExprs(px);
const nextTreeAddon = clampE(px, int(0), sub(v("treeMax"), int(TREE_MIN)));
const nextTreePreference = maxE(int(TREE_MIN), px);
const treePreferenceDrawer = clampDrawerExpr(
  v("renderedDrawer"),
  v("viewport"),
  v("treeAddon"),
  collapsedF,
  v("treeMax")
);
const timingPreferredTree = preferredTreeExpr(
  v("prefTree"),
  nextTreeAddon,
  bool(false)
);
const timingExactDrawer = derivedDrawerExpr(
  timingPreferredTree,
  v("renderedMain")
);
const timingConstrainedDrawer = clampDrawerExpr(
  timingExactDrawer,
  v("viewport"),
  nextTreeAddon,
  bool(false)
);
const timingRenderedTree = splitTreeExpr(
  timingConstrainedDrawer,
  v("prefTree"),
  nextTreeAddon,
  bool(false)
);
const timingRenderedMain = sub(
  sub(timingConstrainedDrawer, int(SEPARATOR)),
  timingRenderedTree
);

const collapsedDrawer = derivedDrawerExpr(
  int(TREE_COLLAPSED),
  v("renderedMain")
);
/**
 * Button expansion restores the preferred tree width when possible. The
 * drawer grows first so the main column stays stable; at the drawer maximum,
 * remaining tree width comes from main-column slack down to MAIN_MIN.
 */
export const treeExpansionExprs = (): {
  intendedDrawer: IntExpr;
  drawer: IntExpr;
  tree: IntExpr;
  main: IntExpr;
} => {
  const preferredTree = preferredTreeExpr(
    v("prefTree"),
    v("treeAddon"),
    bool(false)
  );
  const maximumDrawer = maxDrawerExpr(
    v("viewport"),
    v("treeAddon"),
    bool(false)
  );
  const intendedDrawer = derivedDrawerExpr(preferredTree, v("renderedMain"));
  const drawer = minE(intendedDrawer, maximumDrawer);
  const treeCapacity = sub(sub(maximumDrawer, int(SEPARATOR)), int(MAIN_MIN));
  const tree = minE(
    maximumTreeExpr(v("treeMax"), bool(false)),
    minE(preferredTree, treeCapacity)
  );
  const main = sub(sub(drawer, int(SEPARATOR)), tree);
  return { intendedDrawer, drawer, tree, main };
};

const treeExpansion = treeExpansionExprs();

const nextTreeMax = maxE(add(int(TREE_MIN), v("treeAddon")), px);
const constraintPreferredTree = preferredTreeExpr(
  v("prefTree"),
  v("treeAddon"),
  bool(false),
  nextTreeMax
);
const constraintExactDrawer = derivedDrawerExpr(
  constraintPreferredTree,
  v("renderedMain")
);
const constraintConstrainedDrawer = clampDrawerExpr(
  constraintExactDrawer,
  v("viewport"),
  v("treeAddon"),
  bool(false),
  nextTreeMax
);
const constraintMaximumDrawer = maxDrawerExpr(
  v("viewport"),
  v("treeAddon"),
  bool(false),
  nextTreeMax
);
const canKeepConstraintPeersFixed = le(
  constraintExactDrawer,
  constraintMaximumDrawer
);
const constraintRenderedTree = iteInt(
  canKeepConstraintPeersFixed,
  constraintPreferredTree,
  splitTreeExpr(
    constraintConstrainedDrawer,
    v("prefTree"),
    v("treeAddon"),
    bool(false),
    nextTreeMax
  )
);
const constraintRenderedMain = iteInt(
  canKeepConstraintPeersFixed,
  v("renderedMain"),
  sub(sub(constraintConstrainedDrawer, int(SEPARATOR)), constraintRenderedTree)
);

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
      // released drawer width. Once main is maxed, overflow tree allocation
      // also becomes the new tree preference.
      prefTree: iteInt(
        outerTreeCommitted,
        sub(outerRenderedTree, v("treeAddon")),
        v("prefTree")
      ),
      prefMain: iteInt(
        outerCommitted,
        mainFromDrawerExpr(
          outerWidth,
          preferredTreeExpr(v("prefTree"), v("treeAddon"), collapsedF)
        ),
        v("prefMain")
      ),
    },
    boolUpdates: { moved: bool(false) },
    effects: [
      {
        kind: "persistMain",
        when: outerCommitted,
        value: mainFromDrawerExpr(
          outerWidth,
          preferredTreeExpr(v("prefTree"), v("treeAddon"), collapsedF)
        ),
      },
      {
        kind: "persistTree",
        when: outerTreeCommitted,
        value: sub(outerRenderedTree, v("treeAddon")),
      },
    ],
  },
  {
    // Latch the fixed drag origin from the machine's own rendered geometry.
    // Single-owner rule: a tree gesture cannot begin while another gesture
    // owns the pointer.
    name: "treeStart",
    event: "TREE_START",
    guard: and(openF, isIdle, not(collapsedF)),
    updates: {
      gesture: int(GESTURE_TREE),
      dragStartDrawer: v("renderedDrawer"),
      dragStartTree: v("renderedTree"),
      dragStartMain: v("renderedMain"),
      dragMaxDrawer: maxE(
        maximumTreeDragDrawerExpr(v("viewport")),
        v("renderedDrawer")
      ),
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
      moved: or(
        movedF,
        ne(treeDrag.tree, v("dragStartTree")),
        ne(treeDrag.drawer, v("dragStartDrawer"))
      ),
    },
    effects: [],
  },
  {
    // TC-4/TC-5: a moved release persists the column owned by the final
    // geometry. Persist the tree whenever the released allocation would
    // otherwise re-split to a different width from the current preference;
    // this makes every idle release a canonical layout and prevents the next
    // outer gesture from snapping to a stale preference. When leftward
    // overflow at the expanded tree minimum grows the drawer, persist the
    // expanded main width as well. Otherwise restore the drag origin.
    name: "treeEnd",
    event: "TREE_END",
    guard: and(openF, isTree),
    updates: {
      gesture: int(GESTURE_IDLE),
      prefTree: iteInt(
        treePreferenceCommitted,
        sub(v("renderedTree"), v("treeAddon")),
        v("prefTree")
      ),
      prefMain: iteInt(
        mainPreferenceCommittedFromTree,
        v("renderedMain"),
        v("prefMain")
      ),
      renderedDrawer: iteInt(
        treeGestureCommitted,
        v("renderedDrawer"),
        v("dragStartDrawer")
      ),
      renderedTree: iteInt(
        treeGestureCommitted,
        v("renderedTree"),
        v("dragStartTree")
      ),
      renderedMain: iteInt(
        treeGestureCommitted,
        v("renderedMain"),
        v("dragStartMain")
      ),
      intendedDrawer: iteInt(
        treeGestureCommitted,
        v("renderedDrawer"),
        v("dragStartDrawer")
      ),
    },
    boolUpdates: { moved: bool(false) },
    effects: [
      {
        kind: "persistTree",
        when: treePreferenceCommitted,
        value: sub(v("renderedTree"), v("treeAddon")),
      },
      {
        kind: "persistMain",
        when: mainPreferenceCommittedFromTree,
        value: v("renderedMain"),
      },
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
      prefTree: nextTreePreference,
      intendedDrawer: treePreferenceDrawer,
      ...renderFromAllocation(treePreferenceDrawer, nextTreePreference),
    },
    boolUpdates: {},
    effects: [
      { kind: "persistTree", when: bool(true), value: nextTreePreference },
    ],
  },
  {
    name: "treeMaxSetCompact",
    event: "TREE_MAX_SET",
    guard: and(isIdle, collapsedF),
    updates: { treeMax: nextTreeMax },
    boolUpdates: {},
    effects: [],
  },
  {
    name: "treeMaxSetExpanded",
    event: "TREE_MAX_SET",
    guard: and(openF, isIdle, not(collapsedF)),
    updates: {
      treeMax: nextTreeMax,
      intendedDrawer: constraintExactDrawer,
      renderedDrawer: constraintConstrainedDrawer,
      renderedTree: constraintRenderedTree,
      renderedMain: constraintRenderedMain,
    },
    boolUpdates: {},
    effects: [],
  },
  {
    name: "treeMaxSetClosedExpanded",
    event: "TREE_MAX_SET",
    guard: and(not(openF), isIdle, not(collapsedF)),
    updates: {
      treeMax: nextTreeMax,
      intendedDrawer: getOpenedDrawerExpr({ treeMax: nextTreeMax }),
      ...renderFromAllocation(
        getOpenedDrawerExpr({ treeMax: nextTreeMax }),
        v("prefTree"),
        v("treeAddon"),
        bool(false),
        nextTreeMax
      ),
    },
    boolUpdates: {},
    effects: [],
  },
  {
    name: "treeAddonSetCompact",
    event: "TREE_ADDON_SET",
    guard: and(openF, isIdle, collapsedF),
    updates: { treeAddon: nextTreeAddon },
    boolUpdates: {},
    effects: [],
  },
  {
    name: "treeAddonSetExpanded",
    event: "TREE_ADDON_SET",
    guard: and(openF, isIdle, not(collapsedF)),
    updates: {
      treeAddon: nextTreeAddon,
      intendedDrawer: timingConstrainedDrawer,
      renderedDrawer: timingConstrainedDrawer,
      renderedTree: timingRenderedTree,
      renderedMain: timingRenderedMain,
    },
    boolUpdates: {},
    effects: [],
  },
  {
    name: "treeAddonSetClosedCompact",
    event: "TREE_ADDON_SET",
    guard: and(not(openF), collapsedF),
    updates: { treeAddon: nextTreeAddon },
    boolUpdates: {},
    effects: [],
  },
  {
    name: "treeAddonSetClosedExpanded",
    event: "TREE_ADDON_SET",
    guard: and(not(openF), not(collapsedF)),
    updates: {
      treeAddon: nextTreeAddon,
      intendedDrawer: getOpenedDrawerExpr({ treeAddon: nextTreeAddon }),
      ...renderFromAllocation(
        getOpenedDrawerExpr({ treeAddon: nextTreeAddon }),
        v("prefTree"),
        nextTreeAddon
      ),
    },
    boolUpdates: {},
    effects: [],
  },
  {
    name: "treeCollapseOpen",
    event: "TREE_COLLAPSE",
    guard: and(openF, isIdle, not(collapsedF)),
    updates: {
      intendedDrawer: collapsedDrawer,
      renderedDrawer: collapsedDrawer,
      renderedTree: int(TREE_COLLAPSED),
    },
    boolUpdates: { collapsed: bool(true) },
    effects: [],
  },
  {
    name: "treeExpandOpen",
    event: "TREE_EXPAND",
    guard: and(openF, isIdle, collapsedF),
    updates: {
      intendedDrawer: treeExpansion.intendedDrawer,
      renderedDrawer: treeExpansion.drawer,
      renderedTree: treeExpansion.tree,
      renderedMain: treeExpansion.main,
    },
    boolUpdates: { collapsed: bool(false) },
    effects: [],
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
        clampDrawerExpr(
          v("intendedDrawer"),
          maxE(int(1), px),
          v("treeAddon"),
          collapsedF
        )
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
    updates: renderFromAllocation(
      clampDrawerExpr(px, v("viewport"), v("treeAddon"), collapsedF)
    ),
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
  clampE(v("mainRaw"), int(MAIN_MIN), int(MAIN_MAX)),
  int(MAIN_FACTORY)
);
const initViewport = maxE(int(1), v("viewportRaw"));
const initTreeAddon = int(0);
const initTreeMax = int(TREE_DEFAULT);
const initCollapsed = bool(false);
const initDrawer = clampDrawerExpr(
  derivedDrawerExpr(
    preferredTreeExpr(initPrefTree, initTreeAddon, initCollapsed, initTreeMax),
    initPrefMain
  ),
  initViewport,
  initTreeAddon,
  initCollapsed,
  initTreeMax
);
const initTree = splitTreeExpr(
  initDrawer,
  initPrefTree,
  initTreeAddon,
  initCollapsed,
  initTreeMax
);
const initMain = splitMainExpr(
  initDrawer,
  initPrefTree,
  initTreeAddon,
  initCollapsed,
  initTreeMax
);

export const INIT_INT_EXPRS: Readonly<Record<IntField, IntExpr>> = {
  gesture: int(GESTURE_IDLE),
  prefTree: initPrefTree,
  prefMain: initPrefMain,
  treeAddon: initTreeAddon,
  treeMax: initTreeMax,
  intendedDrawer: initDrawer,
  renderedDrawer: initDrawer,
  renderedTree: initTree,
  renderedMain: initMain,
  viewport: initViewport,
  dragStartDrawer: initDrawer,
  dragStartTree: initTree,
  dragStartMain: initMain,
  dragMaxDrawer: maximumTreeDragDrawerExpr(
    initViewport,
    initTreeAddon,
    initTreeMax
  ),
};

export const INIT_BOOL_EXPRS: Readonly<Record<BoolField, BoolExpr>> = {
  open: bool(false),
  moved: bool(false),
  collapsed: initCollapsed,
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
 * values arrive as null and fall back to defaults; finite values are clamped
 * to the column's bounds. The raw stored value is never rewritten.
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
