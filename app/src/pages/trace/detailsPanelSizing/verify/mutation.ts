/**
 * Mutation gate: proves the checkers can fail.
 *
 * Each mutant below reintroduces a real bug class — several are the exact
 * shapes that motivated this machine (stale persistence on reopen, transient
 * drag widths persisted, constraint compression overwriting preferences).
 * The gate requires every mutant to be caught by at least one checker
 * (syntactic frame audit, Z3 proof, or bounded exhaustive sweep). A mutant
 * that survives all three means a property is vacuous or a checker is
 * broken, and the gate fails.
 *
 * Run with: `pnpm tsx .../verify/mutation.ts` (part of
 * `pnpm verify:details-panel`).
 */

import {
  add,
  and,
  bool,
  boolVar,
  int,
  intVar,
  iteInt,
  le,
  maxE,
  minE,
  ne,
  not,
  sub,
} from "../expr";
import type { TransitionRule } from "../machine";
import {
  clampDrawerExpr,
  MAIN_MIN,
  mainFromDrawerExpr,
  RULES,
  SEPARATOR,
  splitTreeExpr,
  treeDragExprs,
} from "../machine";
import { runProofs } from "./prove-lib";
import { runSweep } from "./sweep";

const v = intVar;

function replaceRule(
  rules: readonly TransitionRule[],
  name: string,
  transform: (rule: TransitionRule) => TransitionRule
): readonly TransitionRule[] {
  const index = rules.findIndex((rule) => rule.name === name);
  if (index < 0) throw new Error(`No rule named ${name}`);
  const next = [...rules];
  next[index] = transform(rules[index]);
  return next;
}

interface Mutant {
  readonly name: string;
  /** The bug class this mutant reintroduces. */
  readonly models: string;
  readonly mutate: () => readonly TransitionRule[];
}

const MUTANTS: readonly Mutant[] = [
  {
    name: "open-restores-session-width",
    models:
      "reopen restores the last session width instead of deriving from preferences (the reported defect's observable shape)",
    mutate: () =>
      replaceRule(RULES, "open", (rule) => {
        const stale = clampDrawerExpr(v("intendedDrawer"), v("viewport"));
        return {
          ...rule,
          updates: {
            ...rule.updates,
            intendedDrawer: stale,
            renderedDrawer: stale,
            renderedTree: splitTreeExpr(
              stale,
              v("prefTree"),
              v("treeAddon"),
              boolVar("collapsed")
            ),
            renderedMain: sub(
              sub(stale, int(SEPARATOR)),
              splitTreeExpr(
                stale,
                v("prefTree"),
                v("treeAddon"),
                boolVar("collapsed")
              )
            ),
          },
        };
      }),
  },
  {
    name: "constraint-writes-preference",
    models:
      "constraint compression persists the compressed width as the tree preference (CP-3/TC-4 violation)",
    mutate: () =>
      replaceRule(RULES, "allocation", (rule) => ({
        ...rule,
        updates: {
          ...rule.updates,
          prefTree: splitTreeExpr(
            maxE(int(689), v("px")),
            v("prefTree"),
            v("treeAddon"),
            boolVar("collapsed")
          ),
        },
      })),
  },
  {
    name: "transient-drag-width-persisted",
    models:
      "every drag tick persists the main preference (the debounced-persistence bug class, PS-4 violation)",
    mutate: () =>
      replaceRule(RULES, "outerMove", (rule) => ({
        ...rule,
        updates: {
          ...rule.updates,
          prefMain: mainFromDrawerExpr(
            clampDrawerExpr(v("px"), v("viewport")),
            v("prefTree")
          ),
        },
      })),
  },
  {
    name: "tree-commit-ignores-moved",
    models:
      "a zero-movement release can commit the tree preference (deliberateness dropped from TC-4)",
    mutate: () =>
      replaceRule(RULES, "treeEnd", (rule) => ({
        ...rule,
        updates: {
          ...rule.updates,
          prefTree: iteInt(
            ne(v("renderedTree"), v("dragStartTree")),
            v("renderedTree"),
            v("prefTree")
          ),
        },
      })),
  },
  {
    name: "tree-release-keeps-stale-compressed-preference",
    models:
      "a compound tree release stays visually compressed but leaves a larger stale tree preference, so the next outer gesture snaps",
    mutate: () => {
      const staleTreeCommit = and(
        boolVar("moved"),
        ne(v("renderedTree"), v("dragStartTree"))
      );
      return replaceRule(RULES, "treeEnd", (rule) => ({
        ...rule,
        updates: {
          ...rule.updates,
          prefTree: iteInt(
            staleTreeCommit,
            sub(v("renderedTree"), v("treeAddon")),
            v("prefTree")
          ),
        },
        effects: rule.effects.map((effect) =>
          effect.kind === "persistTree"
            ? { ...effect, when: staleTreeCommit }
            : effect
        ),
      }));
    },
  },
  {
    name: "rightward-tree-drag-grows-drawer",
    models:
      "a rightward inner-separator drag moves the outer drawer boundary instead of clamping when adjacent main-column slack is exhausted",
    mutate: () => {
      const drag = treeDragExprs(v("px"));
      const rightwardDrawerGrowth = maxE(
        int(0),
        sub(drag.tree, v("dragStartTree"))
      );
      const brokenDrawer = iteInt(
        le(v("dragStartTree"), v("px")),
        add(drag.drawer, rightwardDrawerGrowth),
        drag.drawer
      );
      return replaceRule(RULES, "treeMove", (rule) => ({
        ...rule,
        updates: {
          ...rule.updates,
          renderedDrawer: brokenDrawer,
          renderedMain: sub(sub(brokenDrawer, int(SEPARATOR)), drag.tree),
          intendedDrawer: brokenDrawer,
        },
      }));
    },
  },
  {
    name: "rightward-tree-drag-shrinks-drawer-before-tree-maximum",
    models:
      "a rightward inner-separator drag moves the outer boundary before the tree has exhausted its own growth capacity",
    mutate: () => {
      const drag = treeDragExprs(v("px"));
      const shrinkPrematurely = and(
        le(v("dragStartTree"), v("px")),
        not(le(v("treeMax"), drag.tree)),
        le(add(int(MAIN_MIN), int(1)), drag.main)
      );
      const brokenDrawer = sub(
        drag.drawer,
        iteInt(shrinkPrematurely, int(1), int(0))
      );
      return replaceRule(RULES, "treeMove", (rule) => ({
        ...rule,
        updates: {
          ...rule.updates,
          renderedDrawer: brokenDrawer,
          renderedMain: sub(sub(brokenDrawer, int(SEPARATOR)), drag.tree),
          intendedDrawer: brokenDrawer,
        },
      }));
    },
  },
  {
    name: "main-min-clamp-dropped",
    models:
      "allocation split loses the 640px main-column reservation (CC-1 violation)",
    mutate: () =>
      replaceRule(RULES, "allocation", (rule) => {
        const alloc = maxE(int(689), v("px"));
        const brokenTree = minE(v("prefTree"), sub(alloc, int(SEPARATOR)));
        return {
          ...rule,
          updates: {
            renderedDrawer: alloc,
            renderedTree: brokenTree,
            renderedMain: sub(sub(alloc, int(SEPARATOR)), brokenTree),
          },
        };
      }),
  },
  {
    name: "stale-persist-value",
    models:
      "release persists the previous preference instead of the released one (the stale-write race's essence)",
    mutate: () =>
      replaceRule(RULES, "outerEnd", (rule) => ({
        ...rule,
        effects: rule.effects.map((effect) => ({
          ...effect,
          value: v("prefMain"),
        })),
      })),
  },
  {
    name: "tree-release-collapses-mode",
    models:
      "a divider release changes explicit compact mode even though only the button may own that transition (EC-1/FV-5 violation)",
    mutate: () =>
      replaceRule(RULES, "treeEnd", (rule) => ({
        ...rule,
        boolUpdates: { ...rule.boolUpdates, collapsed: bool(true) },
      })),
  },
  {
    name: "collapse-changes-main",
    models:
      "button collapse donates a pixel to another column instead of preserving main geometry exactly (CG-1/CG-2 violation)",
    mutate: () =>
      replaceRule(RULES, "treeCollapseOpen", (rule) => ({
        ...rule,
        updates: {
          ...rule.updates,
          renderedMain: sub(v("renderedMain"), int(1)),
        },
      })),
  },
  {
    name: "timing-writes-navigation-preference",
    models:
      "the additive timing width is folded into the persisted navigation preference (AT-1/AT-3 violation)",
    mutate: () =>
      replaceRule(RULES, "treeAddonSetExpanded", (rule) => ({
        ...rule,
        updates: {
          ...rule.updates,
          prefTree: add(v("prefTree"), int(150)),
        },
      })),
  },
  {
    name: "expand-does-not-consume-main-slack",
    models:
      "a constrained expand leaves main unchanged instead of prioritizing the navigation column",
    mutate: () =>
      replaceRule(RULES, "treeExpandOpen", (rule) => ({
        ...rule,
        updates: {
          ...rule.updates,
          renderedMain: v("renderedMain"),
        },
      })),
  },
];

interface CatchReport {
  readonly checker: string;
  readonly detail: string;
}

function runCheckers(rules: readonly TransitionRule[]): CatchReport[] {
  const catches: CatchReport[] = [];

  try {
    const { failures } = runProofs(rules);
    if (failures.length > 0) {
      catches.push({
        checker: "z3",
        detail: failures.slice(0, 3).join("; "),
      });
    }
  } catch (error) {
    catches.push({ checker: "frame-audit", detail: String(error) });
  }

  try {
    runSweep(rules);
  } catch (error) {
    catches.push({
      checker: "sweep",
      detail: String(error).split("\n")[0],
    });
  }

  return catches;
}

let survived = 0;
for (const mutant of MUTANTS) {
  const catches = runCheckers(mutant.mutate());
  if (catches.length === 0) {
    survived++;
    // eslint-disable-next-line no-console
    console.error(`✗ SURVIVED ${mutant.name} — models: ${mutant.models}`);
  } else {
    // eslint-disable-next-line no-console
    console.info(
      `✓ killed ${mutant.name} by ${catches.map((entry) => entry.checker).join(", ")} (${catches[0].detail.slice(0, 120)})`
    );
  }
}

if (survived > 0) {
  // eslint-disable-next-line no-console
  console.error(
    `✗ ${survived}/${MUTANTS.length} mutants survived — a property is vacuous or a checker is broken.`
  );
  process.exit(1);
}
// eslint-disable-next-line no-console
console.info(`✓ all ${MUTANTS.length} mutants killed.`);
