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
 * 6. `tree-drag-*-lipschitz` — within a tree gesture the rendered tree and
 *    drawer widths are monotone 1-Lipschitz functions of the requested width
 *    (TC-9: the 640px handoff cannot jump).
 * 7. `*-idempotent` — measurement events are fixpoints when re-applied (Q-1:
 *    the measure→dispatch→render loop cannot oscillate).
 *
 * A syntactic pass additionally verifies that no unsanctioned rule even
 * mentions a preference field or persistence effect, so the semantic frame
 * theorems can never be vacuously scoped.
 */

import { spawnSync } from "node:child_process";

import { boolToSmt, intToSmt, intVar } from "../expr";
import { STATE_INVARIANTS } from "../invariants";
import type { IntField, TransitionRule } from "../machine";
import {
  BOOL_FIELDS,
  clampDrawerExpr,
  derivedDrawerExpr,
  INIT_BOOL_EXPRS,
  INIT_INPUT_BOOL_VARS,
  INIT_INPUT_INT_VARS,
  INIT_INT_EXPRS,
  INT_FIELDS,
  treeDragExprs,
} from "../machine";

/* ------------------------- syntactic frame audit -------------------------- */

const PREF_WRITERS: Record<string, readonly string[]> = {
  prefTree: ["treeEnd", "treePrefSet"],
  prefMain: ["outerEnd"],
};

const EFFECT_WRITERS: Record<string, readonly string[]> = {
  persistTree: ["treeEnd", "treePrefSet"],
  persistMain: ["outerEnd"],
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

  const setup = (rule: TransitionRule): string =>
    [
      declareState("s_"),
      "(declare-const p_px Int)",
      `(assert ${invariantConjunction("s_")})`,
      `(assert ${firingCondition(rule, "s_")})`,
      definePostState(rule, "s_", "n_"),
    ].join("\n");

  // TC-4/TC-5: a tree-preference change requires a moved gesture released at
  // a width different from its origin, and stores exactly the released width.
  obligations.push({
    name: "tree-commit-deliberate",
    body: `${setup(treeEnd)}
(assert (not (=> (not (= n_prefTree s_prefTree))
                 (and s_moved
                      (not (= s_renderedTree s_dragStartTree))
                      (= n_prefTree s_renderedTree)))))`,
  });

  // DW-3: a main-preference change stores max(640, released − prefTree − 1),
  // and that value equals the released rendered main width (CC-5 corollary).
  obligations.push({
    name: "main-commit-deliberate-dw3",
    body: `${setup(outerEnd)}
(assert (not (=> (not (= n_prefMain s_prefMain))
                 (and (= n_prefMain n_renderedMain)
                      (= n_prefMain
                         (ite (>= (- (- n_renderedDrawer s_prefTree) 1) 640)
                              (- (- n_renderedDrawer s_prefTree) 1)
                              640))))))`,
  });

  // DW-1/PS-1/PS-3 (the reported defect, generalized): reopen requests the
  // clamped derivation of the pre-state preferences and touches neither one.
  // The expected width is emitted from the same kernel expressions the
  // machine uses — never hand-written SMT.
  const expectedReopenWidth = intToSmt(
    clampDrawerExpr(
      derivedDrawerExpr(intVar("prefTree"), intVar("prefMain")),
      intVar("viewport")
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
  // the rendered tree and drawer by at most 1px, monotonically.
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
    body: `${body}\n(assert (not (and (<= a_drawer b_drawer) (<= (- b_drawer a_drawer) 1))))`,
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
