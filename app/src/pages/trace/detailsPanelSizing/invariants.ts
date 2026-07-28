/**
 * The property catalog: formal statements of the assertions in
 * `DETAILS_PANEL_COLUMN_BEHAVIOR_ASSERTIONS.md`, expressed over the state
 * vector of `machine.ts`. Both checkers consume this table — the enumeration
 * test evaluates each property on every reachable state, and the SMT harness
 * proves each one inductively over all integer widths.
 *
 * Assertion-ID traceability is recorded per property.
 */

import type { BoolExpr } from "./expr";
import {
  add,
  and,
  bool,
  boolVar,
  eq,
  ge,
  implies,
  int,
  intVar,
  le,
  not,
  or,
} from "./expr";
import {
  GESTURE_IDLE,
  GESTURE_OUTER,
  GESTURE_TREE,
  MAIN_MAX,
  MAIN_MIN,
  maximumTreeExpr,
  minimumDrawerExpr,
  SEPARATOR,
  splitMainExpr,
  splitTreeExpr,
  TREE_COLLAPSED,
  TREE_MIN,
} from "./machine";

export interface StateInvariant {
  readonly name: string;
  /** Assertion IDs from DETAILS_PANEL_COLUMN_BEHAVIOR_ASSERTIONS.md. */
  readonly traces: readonly string[];
  readonly expr: BoolExpr;
}

const v = intVar;

const geometryConsistent = (
  drawer: string,
  tree: string,
  main: string
): BoolExpr => eq(v(drawer), add(add(v(tree), int(SEPARATOR)), v(main)));

/**
 * The inductive invariant set. Every property here holds in every reachable
 * state; several exist to make the target properties inductive (standard
 * strengthening) and are worth guaranteeing in their own right.
 */
export const STATE_INVARIANTS: readonly StateInvariant[] = [
  {
    name: "mainAboveMinimum",
    traces: ["CC-1"],
    expr: ge(v("renderedMain"), int(MAIN_MIN)),
  },
  {
    name: "mainAtOrBelowMaximum",
    traces: ["CC-5"],
    expr: le(v("renderedMain"), int(MAIN_MAX)),
  },
  {
    name: "treeAboveCompactMinimum",
    traces: ["TC-6", "CCU-2"],
    expr: ge(v("renderedTree"), int(TREE_COLLAPSED)),
  },
  {
    name: "treeMatchesExplicitMode",
    traces: ["EC-1", "EC-3", "CG-1"],
    expr: and(
      implies(boolVar("collapsed"), eq(v("renderedTree"), int(TREE_COLLAPSED))),
      implies(
        not(boolVar("collapsed")),
        ge(v("renderedTree"), add(int(TREE_MIN), v("treeAddon")))
      ),
      le(v("renderedTree"), maximumTreeExpr(v("treeMax"), boolVar("collapsed")))
    ),
  },
  {
    name: "drawerIsColumnSum",
    traces: ["DW-1", "DW-4"],
    expr: geometryConsistent("renderedDrawer", "renderedTree", "renderedMain"),
  },
  {
    name: "drawerAboveMinimum",
    traces: ["DW-5"],
    expr: ge(
      v("renderedDrawer"),
      minimumDrawerExpr(v("treeAddon"), boolVar("collapsed"))
    ),
  },
  {
    name: "preferencesWellFormed",
    traces: ["PS-5"],
    expr: and(
      ge(v("prefTree"), int(TREE_MIN)),
      ge(v("prefMain"), int(MAIN_MIN)),
      le(v("prefMain"), int(MAIN_MAX)),
      ge(v("treeAddon"), int(0)),
      ge(v("treeMax"), add(int(TREE_MIN), v("treeAddon")))
    ),
  },
  {
    name: "intentAboveMinimum",
    traces: ["DW-5"],
    expr: ge(
      v("intendedDrawer"),
      minimumDrawerExpr(v("treeAddon"), boolVar("collapsed"))
    ),
  },
  {
    name: "gestureInRange",
    traces: [],
    expr: or(
      eq(v("gesture"), int(GESTURE_IDLE)),
      eq(v("gesture"), int(GESTURE_OUTER)),
      eq(v("gesture"), int(GESTURE_TREE))
    ),
  },
  {
    name: "viewportPositive",
    traces: [],
    expr: ge(v("viewport"), int(1)),
  },
  {
    name: "closedStateIsIdle",
    traces: ["EC-1"],
    expr: implies(not(boolVar("open")), eq(v("gesture"), int(GESTURE_IDLE))),
  },
  {
    // Normal form for cross-gesture continuity. Active tree drags may render
    // transient geometry from their fixed origin, but every open idle state
    // must be exactly the split implied by its allocation and preferences.
    name: "openIdleGeometryIsCanonical",
    traces: ["TC-9", "Q-1"],
    expr: implies(
      and(boolVar("open"), eq(v("gesture"), int(GESTURE_IDLE))),
      and(
        eq(
          v("renderedTree"),
          splitTreeExpr(
            v("renderedDrawer"),
            v("prefTree"),
            v("treeAddon"),
            boolVar("collapsed"),
            v("treeMax")
          )
        ),
        eq(
          v("renderedMain"),
          splitMainExpr(
            v("renderedDrawer"),
            v("prefTree"),
            v("treeAddon"),
            boolVar("collapsed"),
            v("treeMax")
          )
        )
      )
    ),
  },
  {
    // Strengthening: a tree gesture's captured origin is itself consistent
    // geometry, which is what makes CC-1/TC-6 inductive through TREE_MOVE,
    // TREE_END, and TREE_CANCEL.
    name: "treeDragOriginConsistent",
    traces: ["TC-8", "TC-9"],
    expr: implies(
      eq(v("gesture"), int(GESTURE_TREE)),
      and(
        not(boolVar("collapsed")),
        geometryConsistent("dragStartDrawer", "dragStartTree", "dragStartMain"),
        eq(
          v("dragStartTree"),
          splitTreeExpr(
            v("dragStartDrawer"),
            v("prefTree"),
            v("treeAddon"),
            bool(false),
            v("treeMax")
          )
        ),
        eq(
          v("dragStartMain"),
          splitMainExpr(
            v("dragStartDrawer"),
            v("prefTree"),
            v("treeAddon"),
            bool(false),
            v("treeMax")
          )
        ),
        implies(
          not(boolVar("moved")),
          and(
            eq(v("renderedDrawer"), v("dragStartDrawer")),
            eq(v("renderedTree"), v("dragStartTree")),
            eq(v("renderedMain"), v("dragStartMain"))
          )
        ),
        ge(v("dragStartTree"), add(int(TREE_MIN), v("treeAddon"))),
        le(v("dragStartTree"), maximumTreeExpr(v("treeMax"), bool(false))),
        ge(v("dragStartMain"), int(MAIN_MIN)),
        le(v("dragStartMain"), int(MAIN_MAX)),
        ge(v("dragMaxDrawer"), v("dragStartDrawer"))
      )
    ),
  },
];

/**
 * The invariant conjunction, used as the induction hypothesis by the SMT
 * harness.
 */
export const INVARIANT_NAMES: readonly string[] = STATE_INVARIANTS.map(
  (invariant) => invariant.name
);

/**
 * Per-rule transition properties proven by the SMT harness in addition to
 * invariant preservation. Documented here; encoded in `verify/prove.ts`
 * directly from the rule table:
 *
 * - `preferenceFrame` (TC-4, CP-3, PS-4, NR-7): `prefTree` may change only in
 *   rules `outerEnd`, `treeEnd`, and `treePrefSet`; `prefMain` in `outerEnd`
 *   and in the boundary-overflow branches of `treeEnd`. All
 *   other rules — including open, close, viewport, and allocation — provably
 *   leave both untouched and emit no persistence effect.
 * - `deliberateTreeCommit` (TC-4, TC-5): when `treeEnd` changes `prefTree`,
 *   the gesture had moved and its released geometry was not the canonical
 *   split of the old preference; the new preference equals the released
 *   rendered width.
 * - `deliberateMainCommit` (DW-3, CC-5): when `outerEnd` changes `prefMain`,
 *   the release was deliberate and the new preference equals
 *   `clamp(releasedDrawer − prefTree − separator, 640, 1200)`;
 *   equivalently (proven as `releasedMainMatchesSplit`) it equals the released
 *   rendered main width.
 * - `reopenDerivesFromPreferences` (DW-1, PS-1, PS-3 — the reported defect):
 *   the `open` rule's requested drawer width equals
 *   `clamp(prefTree + separator + prefMain)` of the pre-state preferences, and
 *   `open`/`close` change neither preference. There is no pending-write or
 *   storage-read state anywhere in the machine, so the stale-reopen ordering
 *   is not merely avoided — it is unrepresentable.
 * - `persistMatchesState` (PS-7, DW-2): every emitted persistence effect
 *   carries exactly the post-state value of its own preference field, and no
 *   effect kind exists that persists a whole-drawer width.
 * - `treeDragLipschitz` (TC-9): within a tree gesture, the rendered tree is a
 *   monotone 1-Lipschitz function and the drawer is a 1-Lipschitz function of
 *   the requested width — neither boundary handoff can jump. Leftward travel
 *   shrinks the tree before overflow at its expanded minimum grows the drawer;
 *   rightward travel never grows the drawer and may shrink it only after the
 *   tree reaches its maximum.
 * - `openIdleGeometryIsCanonical` / `outerGestureEntryContinuity` (TC-9,
 *   Q-1): every open idle state is a normal-form split of its allocation and
 *   preferences; a zero-delta outer gesture preserves geometry, and its first
 *   one-pixel movement changes no rendered dimension by more than one pixel.
 * - `allocationIdempotent` / `viewportIdempotent` (Q-1): re-applying the same
 *   measurement is a fixpoint, so the measure→dispatch→render loop cannot
 *   oscillate.
 */
export const TRANSITION_PROPERTY_DOC = null;
