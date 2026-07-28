/**
 * Z3 proof harness for the details-panel sizing machine.
 *
 * Every obligation is emitted from the live rule table in `machine.ts` — the
 * same data structure `transition.ts` interprets in production — via the SMT
 * backend of `expr.ts`. Nothing here restates the machine's semantics by
 * hand; editing a rule changes the proof subject automatically.
 *
 * Obligations (each `(check-sat)` must return `unsat`):
 *
 * 1. `init⇒<invariant>` — every invariant holds in every initial state, for
 *    all integer raw stored values and viewports (PS-5 totality included).
 * 2. `<rule>⊨<invariant>` — inductive step: for every rule, every invariant
 *    is preserved for ALL integer widths, parameters, and states satisfying
 *    the invariant conjunction. First-match semantics are encoded exactly
 *    (a rule fires only when no earlier same-event rule's guard holds).
 * 3. Frame/commit theorems: preference fields change only in their sanctioned
 *    rules and only under the deliberate-release condition, with the value the
 *    assertions document specifies (TC-4, TC-5, DW-3, CP-3, PS-4).
 * 4. `persist…-matches-post` — every persistence effect writes exactly the
 *    post-state value of its own preference field (PS-7).
 * 5. `open-derives-from-preferences` — the reopen width is the clamped sum of
 *    the pre-state preferences (DW-1; the reported defect, generalized).
 * 6. `tree-drag-*-lipschitz` — within a tree gesture the rendered tree is
 *    monotone and both tree and drawer widths are 1-Lipschitz functions of
 *    the requested width (TC-9: neither boundary handoff can jump).
 * 7. `*-idempotent` — measurement events are fixpoints when re-applied (Q-1:
 *    the measure→dispatch→render loop cannot oscillate).
 *
 * A syntactic pass additionally verifies that no unsanctioned rule even
 * mentions a preference field or persistence effect, so the semantic frame
 * theorems can never be vacuously scoped.
 */

import { spawnSync } from "node:child_process";

import { boolToSmt, boolVar, intToSmt, intVar } from "../expr";
import { STATE_INVARIANTS } from "../invariants";
import type { IntField, TransitionRule } from "../machine";
import {
  BOOL_FIELDS,
  clampDrawerExpr,
  derivedDrawerExpr,
  GESTURE_IDLE,
  INIT_BOOL_EXPRS,
  INIT_INPUT_BOOL_VARS,
  INIT_INPUT_INT_VARS,
  INIT_INT_EXPRS,
  INT_FIELDS,
  MAIN_MAX,
  mainFromDrawerExpr,
  preferredTreeExpr,
  SEPARATOR,
  splitTreeExpr,
  TREE_COLLAPSED,
  TREE_MIN,
  treeDragExprs,
  treeExpansionExprs,
} from "../machine";

/* ------------------------- syntactic frame audit -------------------------- */

const PREF_WRITERS: Record<string, readonly string[]> = {
  prefTree: ["outerEnd", "treeEnd", "treePrefSet"],
  prefMain: ["outerEnd", "treeEnd"],
};

const EFFECT_WRITERS: Record<string, readonly string[]> = {
  persistTree: ["outerEnd", "treeEnd", "treePrefSet"],
  persistMain: ["outerEnd", "treeEnd"],
};

const BOOL_WRITERS: Record<string, readonly string[]> = {
  collapsed: ["treeCollapseOpen", "treeExpandOpen"],
};

export function auditFrameSyntactically(
  rules: readonly TransitionRule[]
): void {
  for (const rule of rules) {
    for (const [field, writers] of Object.entries(PREF_WRITERS)) {
      if (field in rule.updates && !writers.includes(rule.name)) {
        throw new Error(
          `Rule ${rule.name} writes ${field} but is not sanctioned`
        );
      }
    }
    for (const effect of rule.effects) {
      if (!EFFECT_WRITERS[effect.kind].includes(rule.name)) {
        throw new Error(
          `Rule ${rule.name} emits ${effect.kind} but is not sanctioned`
        );
      }
    }
    for (const [field, writers] of Object.entries(BOOL_WRITERS)) {
      if (field in rule.boolUpdates && !writers.includes(rule.name)) {
        throw new Error(
          `Rule ${rule.name} writes ${field} but is not sanctioned`
        );
      }
    }
  }
}

/* ------------------------------ SMT plumbing ------------------------------ */

interface Obligation {
  readonly name: string;
  readonly body: string;
}

const declareState = (prefix: string): string =>
  [
    ...INT_FIELDS.map((field) => `(declare-const ${prefix}${field} Int)`),
    ...BOOL_FIELDS.map((field) => `(declare-const ${prefix}${field} Bool)`),
  ].join("\n");

/** Rename hook mapping expression variables onto a state-name prefix. */
const stage =
  (prefix: string, paramName = "p_px") =>
  (name: string): string =>
    name === "px" ? paramName : `${prefix}${name}`;

const invariantConjunction = (prefix: string): string =>
  `(and ${STATE_INVARIANTS.map((invariant) => boolToSmt(invariant.expr, stage(prefix))).join(" ")})`;

/**
 * Define the post-state of applying `rule` to the state at `prePrefix`,
 * binding each post field as `<postPrefix><field>`. Unlisted fields carry
 * over unchanged (simultaneous assignment against the pre state).
 */
function definePostState(
  rule: TransitionRule,
  prePrefix: string,
  postPrefix: string,
  paramName = "p_px"
): string {
  const rename = stage(prePrefix, paramName);
  const lines: string[] = [];
  for (const field of INT_FIELDS) {
    const update = rule.updates[field];
    const term = update ? intToSmt(update, rename) : `${prePrefix}${field}`;
    lines.push(`(define-fun ${postPrefix}${field} () Int ${term})`);
  }
  for (const field of BOOL_FIELDS) {
    const update = rule.boolUpdates[field];
    const term = update ? boolToSmt(update, rename) : `${prePrefix}${field}`;
    lines.push(`(define-fun ${postPrefix}${field} () Bool ${term})`);
  }
  return lines.join("\n");
}

/** First-match semantics: this rule's guard holds and no earlier rule for the
 *  same event fired. */
function makeFiringCondition(rules: readonly TransitionRule[]) {
  return function firingCondition(
    rule: TransitionRule,
    prefix: string,
    paramName = "p_px"
  ): string {
    const rename = stage(prefix, paramName);
    const sameEvent = rules.filter(
      (candidate) => candidate.event === rule.event
    );
    const earlier = sameEvent.slice(0, sameEvent.indexOf(rule));
    const negations = earlier.map(
      (candidate) => `(not ${boolToSmt(candidate.guard, rename)})`
    );
    return `(and ${boolToSmt(rule.guard, rename)} ${negations.join(" ")} true)`;
  };
}

const statesDiffer = (aPrefix: string, bPrefix: string): string =>
  `(or ${[
    ...INT_FIELDS.map(
      (field) => `(not (= ${aPrefix}${field} ${bPrefix}${field}))`
    ),
    ...BOOL_FIELDS.map(
      (field) => `(not (= ${aPrefix}${field} ${bPrefix}${field}))`
    ),
  ].join(" ")})`;

/* ------------------------------- obligations ------------------------------ */

function emitInitObligations(obligations: Obligation[]): void {
  const inputDecls = [
    ...INIT_INPUT_INT_VARS.map((name) => `(declare-const ${name} Int)`),
    ...INIT_INPUT_BOOL_VARS.map((name) => `(declare-const ${name} Bool)`),
  ].join("\n");
  const identity = (name: string): string => name;
  const initDefs = [
    ...INT_FIELDS.map(
      (field) =>
        `(define-fun s_${field} () Int ${intToSmt(INIT_INT_EXPRS[field], identity)})`
    ),
    ...BOOL_FIELDS.map(
      (field) =>
        `(define-fun s_${field} () Bool ${boolToSmt(INIT_BOOL_EXPRS[field], identity)})`
    ),
  ].join("\n");

  for (const invariant of STATE_INVARIANTS) {
    obligations.push({
      name: `init=>${invariant.name}`,
      body: [
        inputDecls,
        initDefs,
        `(assert (not ${boolToSmt(invariant.expr, stage("s_"))}))`,
      ].join("\n"),
    });
  }
}

function emitInductiveObligations(
  obligations: Obligation[],
  rules: readonly TransitionRule[],
  firingCondition: ReturnType<typeof makeFiringCondition>
): void {
  for (const rule of rules) {
    const common = [
      declareState("s_"),
      "(declare-const p_px Int)",
      `(assert ${invariantConjunction("s_")})`,
      `(assert ${firingCondition(rule, "s_")})`,
      definePostState(rule, "s_", "n_"),
    ].join("\n");

    for (const invariant of STATE_INVARIANTS) {
      obligations.push({
        name: `${rule.name}|=${invariant.name}`,
        body: `${common}\n(assert (not ${boolToSmt(invariant.expr, stage("n_"))}))`,
      });
    }
  }
}

function ruleByName(
  rules: readonly TransitionRule[],
  name: string
): TransitionRule {
  const rule = rules.find((candidate) => candidate.name === name);
  if (!rule) throw new Error(`No rule named ${name}`);
  return rule;
}

function emitCommitTheorems(
  obligations: Obligation[],
  rules: readonly TransitionRule[],
  firingCondition: ReturnType<typeof makeFiringCondition>
): void {
  const treeEnd = ruleByName(rules, "treeEnd");
  const outerEnd = ruleByName(rules, "outerEnd");
  const open = ruleByName(rules, "open");
  const close = ruleByName(rules, "close");
  const collapse = ruleByName(rules, "treeCollapseOpen");
  const expand = ruleByName(rules, "treeExpandOpen");

  const setup = (rule: TransitionRule): string =>
    [
      declareState("s_"),
      "(declare-const p_px Int)",
      `(assert ${invariantConjunction("s_")})`,
      `(assert ${firingCondition(rule, "s_")})`,
      definePostState(rule, "s_", "n_"),
    ].join("\n");

  const releasedTreeFromOldPreference = intToSmt(
    splitTreeExpr(
      intVar("renderedDrawer"),
      intVar("prefTree"),
      intVar("treeAddon"),
      boolVar("collapsed"),
      intVar("treeMax")
    ),
    stage("s_")
  );

  // TC-4/TC-5: a tree-preference change requires a moved gesture whose
  // released geometry is not the old preference's canonical split, and stores
  // exactly the released width.
  obligations.push({
    name: "tree-commit-deliberate",
    body: `${setup(treeEnd)}
(assert (not (=> (not (= n_prefTree s_prefTree))
                 (and s_moved
                      (not (= s_renderedTree ${releasedTreeFromOldPreference}))
                      (= n_prefTree (- s_renderedTree s_treeAddon))))))`,
  });

  obligations.push({
    name: "outer-tree-commit-deliberate",
    body: `${setup(outerEnd)}
(assert (not (=> (not (= n_prefTree s_prefTree))
                 (and (> n_renderedTree
                         ${intToSmt(preferredTreeExpr(intVar("prefTree"), intVar("treeAddon"), boolVar("collapsed")), stage("s_"))})
                      (= n_prefTree (- n_renderedTree s_treeAddon))))))`,
  });

  // Boundary overflow may change the main preference: either the tree stayed
  // at its captured boundary, or leftward overflow grew the drawer after the
  // tree reached its expanded minimum.
  obligations.push({
    name: "tree-main-commit-deliberate",
    body: `${setup(treeEnd)}
(assert (not (=> (not (= n_prefMain s_prefMain))
                 (and s_moved
                      (or (= s_renderedTree s_dragStartTree)
                          (and (= s_renderedTree (+ ${TREE_MIN} s_treeAddon))
                               (> s_renderedDrawer s_dragStartDrawer)))
                      (not (= s_renderedMain s_dragStartMain))
                      (= n_prefMain s_renderedMain)))))`,
  });

  // DW-3: a main-preference change stores the bounded width implied by the
  // released drawer and preferred tree,
  // and that value equals the released rendered main width (CC-5 corollary).
  const expectedCommittedMain = intToSmt(
    mainFromDrawerExpr(
      intVar("renderedDrawer"),
      preferredTreeExpr(
        intVar("prefTree"),
        intVar("treeAddon"),
        boolVar("collapsed")
      )
    ),
    (name) => (name === "renderedDrawer" ? `n_${name}` : `s_${name}`)
  );
  obligations.push({
    name: "main-commit-deliberate-dw3",
    body: `${setup(outerEnd)}
(assert (not (=> (not (= n_prefMain s_prefMain))
                 (and (= n_prefMain n_renderedMain)
                      (= n_prefMain ${expectedCommittedMain})))))`,
  });

  // DW-1/PS-1/PS-3 (the reported defect, generalized): reopen requests the
  // clamped derivation of the pre-state preferences and touches neither one.
  // The expected width is emitted from the same kernel expressions the
  // machine uses — never hand-written SMT.
  const expectedReopenWidth = intToSmt(
    clampDrawerExpr(
      derivedDrawerExpr(
        preferredTreeExpr(
          intVar("prefTree"),
          intVar("treeAddon"),
          boolVar("collapsed")
        ),
        intVar("prefMain")
      ),
      intVar("viewport"),
      intVar("treeAddon"),
      boolVar("collapsed")
    ),
    stage("s_")
  );
  obligations.push({
    name: "open-derives-from-preferences",
    body: `${setup(open)}
(assert (not (and
  (= n_renderedDrawer ${expectedReopenWidth})
  (= n_prefTree s_prefTree)
  (= n_prefMain s_prefMain))))`,
  });

  // Close changes neither preference nor geometry-relevant intent.
  obligations.push({
    name: "close-pure-visibility",
    body: `${setup(close)}
(assert (not (and (= n_prefTree s_prefTree)
                  (= n_prefMain s_prefMain)
                  (= n_intendedDrawer s_intendedDrawer)
                  (not n_open))))`,
  });

  obligations.push({
    name: "collapse-preserves-main",
    body: `${setup(collapse)}
(assert (not (and n_collapsed
                  (= n_renderedTree ${TREE_COLLAPSED})
                  (= n_renderedMain s_renderedMain)
                  (= n_renderedDrawer (+ (+ ${TREE_COLLAPSED} ${SEPARATOR}) s_renderedMain))
                  (= n_prefTree s_prefTree)
                  (= n_prefMain s_prefMain))))`,
  });

  const expectedExpansion = treeExpansionExprs();
  obligations.push({
    name: "expand-prioritizes-tree-with-main-slack",
    body: `${setup(expand)}
(assert (not (and (not n_collapsed)
                  (= n_intendedDrawer ${intToSmt(expectedExpansion.intendedDrawer, stage("s_"))})
                  (= n_renderedDrawer ${intToSmt(expectedExpansion.drawer, stage("s_"))})
                  (= n_renderedTree ${intToSmt(expectedExpansion.tree, stage("s_"))})
                  (= n_renderedMain ${intToSmt(expectedExpansion.main, stage("s_"))})
                  (<= n_renderedMain s_renderedMain)
                  (>= n_renderedTree (+ ${TREE_MIN} s_treeAddon))
                  (= n_prefTree s_prefTree)
                  (= n_prefMain s_prefMain))))`,
  });
}

function emitEffectTheorems(
  obligations: Obligation[],
  rules: readonly TransitionRule[],
  firingCondition: ReturnType<typeof makeFiringCondition>
): void {
  for (const rule of rules) {
    rule.effects.forEach((effect, index) => {
      const postField: IntField =
        effect.kind === "persistTree" ? "prefTree" : "prefMain";
      obligations.push({
        name: `${rule.name}-effect${index}-matches-post`,
        body: [
          declareState("s_"),
          "(declare-const p_px Int)",
          `(assert ${invariantConjunction("s_")})`,
          `(assert ${firingCondition(rule, "s_")})`,
          definePostState(rule, "s_", "n_"),
          `(assert ${boolToSmt(effect.when, stage("s_"))})`,
          `(assert (not (= ${intToSmt(effect.value, stage("s_"))} n_${postField})))`,
        ].join("\n"),
      });
    });
  }
}

function emitLipschitzTheorems(obligations: Obligation[]): void {
  // TC-9: within one gesture (fixed origin), requested widths r and r+1 move
  // the rendered tree monotonically and move both rendered widths by at most
  // 1px. The drawer may grow only on leftward overflow after the tree reaches
  // its expanded minimum. Rightward travel never grows the drawer and may
  // shrink it only while the tree is pinned at its maximum.
  const dragA = treeDragExprs({ kind: "intVar", name: "px" });
  const declares = [
    declareState("s_"),
    "(declare-const r1 Int)",
    `(assert ${invariantConjunction("s_")})`,
    "(assert (= s_gesture 2))",
  ].join("\n");
  const bind = (paramName: string, prefix: string): string =>
    [
      `(define-fun ${prefix}tree () Int ${intToSmt(dragA.tree, stage("s_", paramName))})`,
      `(define-fun ${prefix}drawer () Int ${intToSmt(dragA.drawer, stage("s_", paramName))})`,
    ].join("\n");
  const body = [
    declares,
    "(define-fun r2 () Int (+ r1 1))",
    bind("r1", "a_"),
    bind("r2", "b_"),
  ].join("\n");

  obligations.push({
    name: "tree-drag-tree-lipschitz",
    body: `${body}\n(assert (not (and (<= a_tree b_tree) (<= (- b_tree a_tree) 1))))`,
  });
  obligations.push({
    name: "tree-drag-drawer-lipschitz",
    body: `${body}\n(assert (not (and (<= (- b_drawer a_drawer) 1) (<= (- a_drawer b_drawer) 1))))`,
  });
  obligations.push({
    name: "tree-drag-right-never-grows-drawer",
    body: `${declares}
(assert (>= r1 s_dragStartTree))
${bind("r1", "a_")}
(assert (not (<= a_drawer s_dragStartDrawer)))`,
  });
  obligations.push({
    name: "tree-drag-right-shrinks-drawer-only-at-tree-maximum",
    body: `${declares}
(assert (>= r1 s_dragStartTree))
${bind("r1", "a_")}
(assert (not (=> (< a_drawer s_dragStartDrawer)
                 (= a_tree s_treeMax))))`,
  });
  obligations.push({
    name: "tree-drag-left-before-floor-resizes-tree-only",
    body: `${declares}
(assert (<= r1 s_dragStartTree))
(assert (>= r1 (+ ${TREE_MIN} s_treeAddon)))
(assert (>= r1 (- s_dragStartTree (- ${MAIN_MAX} s_dragStartMain))))
${bind("r1", "a_")}
(assert (not (and (= a_tree r1) (= a_drawer s_dragStartDrawer))))`,
  });
  obligations.push({
    name: "tree-drag-left-overflow-pins-tree-at-floor",
    body: `${declares}
(assert (<= r1 (+ ${TREE_MIN} s_treeAddon)))
(assert (<= (+ s_dragStartMain (- s_dragStartTree (+ ${TREE_MIN} s_treeAddon))) ${MAIN_MAX}))
${bind("r1", "a_")}
(assert (not (= a_tree (+ ${TREE_MIN} s_treeAddon))))`,
  });
  obligations.push({
    name: "tree-drag-left-overflow-grows-drawer",
    body: `${declares}
(assert (< r1 (+ ${TREE_MIN} s_treeAddon)))
(assert (< s_dragStartDrawer s_dragMaxDrawer))
(assert (< (+ s_dragStartMain (- s_dragStartTree (+ ${TREE_MIN} s_treeAddon))) ${MAIN_MAX}))
${bind("r1", "a_")}
(assert (not (> a_drawer s_dragStartDrawer)))`,
  });
}

function emitIdempotenceTheorems(
  obligations: Obligation[],
  rules: readonly TransitionRule[],
  firingCondition: ReturnType<typeof makeFiringCondition>
): void {
  // Q-1: re-applying the same measurement to the post state is the identity.
  for (const name of ["allocation", "viewportIdle", "viewportOther"]) {
    const rule = ruleByName(rules, name);
    obligations.push({
      name: `${name}-idempotent`,
      body: [
        declareState("s_"),
        "(declare-const p_px Int)",
        `(assert ${invariantConjunction("s_")})`,
        `(assert ${firingCondition(rule, "s_")})`,
        definePostState(rule, "s_", "n_"),
        // The same rule must fire again from the post state…
        `(assert ${firingCondition(rule, "n_")})`,
        definePostState(rule, "n_", "m_"),
        // …and produce an identical state.
        `(assert ${statesDiffer("n_", "m_")})`,
      ].join("\n"),
    });
  }
}

function emitGestureEntryContinuityTheorems(
  obligations: Obligation[],
  rules: readonly TransitionRule[],
  firingCondition: ReturnType<typeof makeFiringCondition>
): void {
  const outerMove = ruleByName(rules, "outerMove");
  const treeMove = ruleByName(rules, "treeMove");
  const setup = (pointerWidth: string): string =>
    [
      declareState("s_"),
      "(declare-const p_px Int)",
      `(assert ${invariantConjunction("s_")})`,
      `(assert (= s_gesture ${GESTURE_IDLE}))`,
      `(assert (= s_renderedDrawer ${intToSmt(
        clampDrawerExpr(
          intVar("renderedDrawer"),
          intVar("viewport"),
          intVar("treeAddon"),
          boolVar("collapsed"),
          intVar("treeMax")
        ),
        stage("s_")
      )}))`,
      `(assert (= p_px ${pointerWidth}))`,
      `(assert ${firingCondition(outerMove, "s_")})`,
      definePostState(outerMove, "s_", "n_"),
    ].join("\n");

  obligations.push({
    name: "outer-gesture-zero-delta-preserves-geometry",
    body: `${setup("s_renderedDrawer")}
(assert (not (and (= n_renderedDrawer s_renderedDrawer)
                  (= n_renderedTree s_renderedTree)
                  (= n_renderedMain s_renderedMain)
                  (not n_moved))))`,
  });

  const renderedDimensions = [
    "renderedDrawer",
    "renderedTree",
    "renderedMain",
  ] as const;
  const changesByAtMostOne = renderedDimensions
    .map(
      (field) =>
        `(and (<= (- n_${field} s_${field}) 1) (<= (- s_${field} n_${field}) 1))`
    )
    .join(" ");
  for (const [name, pointerWidth] of [
    ["left", "(- s_renderedDrawer 1)"],
    ["right", "(+ s_renderedDrawer 1)"],
  ] as const) {
    obligations.push({
      name: `outer-gesture-first-pixel-${name}-is-continuous`,
      body: `${setup(pointerWidth)}
(assert (not (and ${changesByAtMostOne})))`,
    });
  }

  obligations.push({
    name: "tree-move-right-never-grows-drawer",
    body: [
      declareState("s_"),
      "(declare-const p_px Int)",
      `(assert ${invariantConjunction("s_")})`,
      `(assert ${firingCondition(treeMove, "s_")})`,
      "(assert (>= p_px s_dragStartTree))",
      definePostState(treeMove, "s_", "n_"),
      "(assert (not (<= n_renderedDrawer s_dragStartDrawer)))",
    ].join("\n"),
  });
  obligations.push({
    name: "tree-move-right-shrinks-drawer-only-at-tree-maximum",
    body: [
      declareState("s_"),
      "(declare-const p_px Int)",
      `(assert ${invariantConjunction("s_")})`,
      `(assert ${firingCondition(treeMove, "s_")})`,
      "(assert (>= p_px s_dragStartTree))",
      definePostState(treeMove, "s_", "n_"),
      "(assert (not (=> (< n_renderedDrawer s_dragStartDrawer) (= n_renderedTree s_treeMax))))",
    ].join("\n"),
  });
}

/* --------------------------------- runner --------------------------------- */

export function buildObligations(
  rules: readonly TransitionRule[]
): Obligation[] {
  const obligations: Obligation[] = [];
  const firingCondition = makeFiringCondition(rules);
  emitInitObligations(obligations);
  emitInductiveObligations(obligations, rules, firingCondition);
  emitCommitTheorems(obligations, rules, firingCondition);
  emitEffectTheorems(obligations, rules, firingCondition);
  emitIdempotenceTheorems(obligations, rules, firingCondition);
  emitLipschitzTheorems(obligations);
  emitGestureEntryContinuityTheorems(obligations, rules, firingCondition);
  return obligations;
}

export interface ProofRunResult {
  readonly obligationCount: number;
  readonly failures: readonly string[];
}

/**
 * Build every obligation from the given rule table and discharge them in one
 * incremental Z3 session. Throws if the syntactic frame audit fails or z3 is
 * unavailable; returns per-obligation failures otherwise.
 */
export function runProofs(rules: readonly TransitionRule[]): ProofRunResult {
  auditFrameSyntactically(rules);
  const obligations = buildObligations(rules);

  const script = obligations
    .map(
      (obligation) =>
        `(push 1)\n(echo "OBLIGATION ${obligation.name}")\n${obligation.body}\n(check-sat)\n(pop 1)`
    )
    .join("\n");

  const z3 = spawnSync("z3", ["-in"], {
    input: script,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (z3.error) {
    throw new Error(
      `Failed to run z3 (${z3.error.message}). Install it (e.g. \`brew install z3\`) — the proof gate is a hard requirement, not optional.`
    );
  }

  const lines = z3.stdout.split("\n").filter((line) => line.trim().length > 0);
  const failures: string[] = [];
  let current = "<preamble>";
  let verdicts = 0;
  for (const line of lines) {
    const match = line.match(/^OBLIGATION (.+)$/);
    if (match) {
      current = match[1];
      continue;
    }
    if (line === "unsat") {
      verdicts++;
      continue;
    }
    if (line === "sat" || line === "unknown") {
      verdicts++;
      failures.push(`${current}: ${line}`);
      continue;
    }
    failures.push(`${current}: unexpected z3 output: ${line}`);
  }
  if (verdicts !== obligations.length) {
    failures.push(
      `expected ${obligations.length} verdicts, saw ${verdicts} — z3 stderr: ${z3.stderr}`
    );
  }
  return { obligationCount: obligations.length, failures };
}
