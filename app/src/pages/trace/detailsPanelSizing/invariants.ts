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
import { add, and, boolVar, eq, ge, implies, int, intVar, or } from "./expr";
import {
  DRAWER_MIN,
  GESTURE_IDLE,
  GESTURE_OUTER,
  GESTURE_TREE,
  MAIN_MIN,
  SEPARATOR,
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
    name: "treeAboveMinimum",
    traces: ["TC-6"],
    expr: ge(v("renderedTree"), int(TREE_MIN)),
  },
  {
    name: "drawerIsColumnSum",
    traces: ["DW-1", "DW-4"],
    expr: geometryConsistent("renderedDrawer", "renderedTree", "renderedMain"),
  },
  {
    name: "drawerAboveMinimum",
    traces: ["DW-5"],
    expr: ge(v("renderedDrawer"), int(DRAWER_MIN)),
  },
  {
    name: "preferencesWellFormed",
    traces: ["PS-5"],
    expr: and(
      ge(v("prefTree"), int(TREE_MIN)),
      ge(v("prefMain"), int(MAIN_MIN))
    ),
  },
  {
    name: "intentAboveMinimum",
    traces: ["DW-5"],
    expr: ge(v("intendedDrawer"), int(DRAWER_MIN)),
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
    // Strengthening: a tree gesture's captured origin is itself consistent
    // geometry, which is what makes CC-1/TC-6 inductive through TREE_MOVE,
    // TREE_END, and TREE_CANCEL.
    name: "treeDragOriginConsistent",
    traces: ["TC-8", "TC-9"],
    expr: implies(
      eq(v("gesture"), int(GESTURE_TREE)),
      and(
        geometryConsistent("dragStartDrawer", "dragStartTree", "dragStartMain"),
        ge(v("dragStartTree"), int(TREE_MIN)),
        ge(v("dragStartMain"), int(MAIN_MIN)),
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
 *   rules `treeEnd` and `treePrefSet`; `prefMain` only in `outerEnd`. All
 *   other rules — including open, close, viewport, and allocation — provably
 *   leave both untouched and emit no persistence effect.
 * - `deliberateTreeCommit` (TC-4, TC-5): when `treeEnd` changes `prefTree`,
 *   the gesture had moved and released at a width different from its origin,
 *   and the new preference equals the released rendered width.
 * - `deliberateMainCommit` (DW-3, CC-5): when `outerEnd` changes `prefMain`,
 *   the release was deliberate and the new preference equals
 *   `max(640, releasedDrawer − prefTree − separator)`; equivalently (proven as
 *   `releasedMainMatchesSplit`) it equals the released rendered main width.
 * - `reopenDerivesFromPreferences` (DW-1, PS-1, PS-3 — the reported defect):
 *   the `open` rule's requested drawer width equals
 *   `clamp(prefTree + separator + prefMain)` of the pre-state preferences, and
 *   `open`/`close` change neither preference. There is no pending-write or
 *   storage-read state anywhere in the machine, so the stale-reopen ordering
 *   is not merely avoided — it is unrepresentable.
 * - `persistMatchesState` (PS-7, DW-2): every emitted persistence effect
 *   carries exactly the post-state value of its own preference field, and no
 *   effect kind exists that persists a whole-drawer width.
 * - `treeDragLipschitz` (TC-9): within a tree gesture, the rendered tree and
 *   drawer widths are monotone, 1-Lipschitz functions of the requested width —
 *   the 640px handoff between column transfer and drawer growth cannot jump.
 * - `allocationIdempotent` / `viewportIdempotent` (Q-1): re-applying the same
 *   measurement is a fixpoint, so the measure→dispatch→render loop cannot
 *   oscillate.
 */
export const TRANSITION_PROPERTY_DOC = null;
