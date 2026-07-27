/**
 * A tiny expression language over linear integer arithmetic with exactly two
 * interpretations:
 *
 * - {@link evaluateInt} / {@link evaluateBool} — direct evaluation. This is
 *   the interpretation the application executes in production.
 * - {@link intToSmt} / {@link boolToSmt} — SMT-LIB 2 emission for Z3. This is
 *   the interpretation the proof harness reasons about.
 *
 * Because both interpretations consume the same AST value, a property proven
 * by Z3 is a property of the expression the browser evaluates — there is no
 * separately maintained model to drift from the implementation.
 *
 * The language is deliberately restricted to operations that keep every
 * formula inside decidable linear integer arithmetic: integer constants,
 * variables, addition, subtraction, multiplication and floor-division by
 * constants, min/max, comparisons, boolean connectives, and if-then-else.
 */

export type IntExpr =
  | { readonly kind: "int"; readonly value: number }
  | { readonly kind: "intVar"; readonly name: string }
  | { readonly kind: "add"; readonly a: IntExpr; readonly b: IntExpr }
  | { readonly kind: "sub"; readonly a: IntExpr; readonly b: IntExpr }
  | { readonly kind: "min"; readonly a: IntExpr; readonly b: IntExpr }
  | { readonly kind: "max"; readonly a: IntExpr; readonly b: IntExpr }
  | { readonly kind: "mulConst"; readonly a: IntExpr; readonly by: number }
  | { readonly kind: "divConst"; readonly a: IntExpr; readonly by: number }
  | {
      readonly kind: "iteInt";
      readonly cond: BoolExpr;
      readonly then: IntExpr;
      readonly els: IntExpr;
    };

export type ComparisonOp = "le" | "lt" | "ge" | "gt" | "eq" | "ne";

export type BoolExpr =
  | { readonly kind: "bool"; readonly value: boolean }
  | { readonly kind: "boolVar"; readonly name: string }
  | {
      readonly kind: "cmp";
      readonly op: ComparisonOp;
      readonly a: IntExpr;
      readonly b: IntExpr;
    }
  | { readonly kind: "and"; readonly a: BoolExpr; readonly b: BoolExpr }
  | { readonly kind: "or"; readonly a: BoolExpr; readonly b: BoolExpr }
  | { readonly kind: "not"; readonly a: BoolExpr }
  | { readonly kind: "boolEq"; readonly a: BoolExpr; readonly b: BoolExpr }
  | {
      readonly kind: "iteBool";
      readonly cond: BoolExpr;
      readonly then: BoolExpr;
      readonly els: BoolExpr;
    };

/* -------------------------------- builders ------------------------------- */

export const int = (value: number): IntExpr => {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`Integer literal required, got ${value}`);
  }
  return { kind: "int", value };
};
export const intVar = (name: string): IntExpr => ({ kind: "intVar", name });
export const boolVar = (name: string): BoolExpr => ({ kind: "boolVar", name });
export const bool = (value: boolean): BoolExpr => ({ kind: "bool", value });

export const add = (a: IntExpr, b: IntExpr): IntExpr => ({ kind: "add", a, b });
export const sub = (a: IntExpr, b: IntExpr): IntExpr => ({ kind: "sub", a, b });
export const minE = (a: IntExpr, b: IntExpr): IntExpr => ({
  kind: "min",
  a,
  b,
});
export const maxE = (a: IntExpr, b: IntExpr): IntExpr => ({
  kind: "max",
  a,
  b,
});
export const mulConst = (a: IntExpr, by: number): IntExpr => {
  if (!Number.isSafeInteger(by)) throw new Error("Constant multiplier only");
  return { kind: "mulConst", a, by };
};
export const divConst = (a: IntExpr, by: number): IntExpr => {
  if (!Number.isSafeInteger(by) || by <= 0) {
    throw new Error("Positive constant divisor only");
  }
  return { kind: "divConst", a, by };
};
export const iteInt = (
  cond: BoolExpr,
  then: IntExpr,
  els: IntExpr
): IntExpr => ({
  kind: "iteInt",
  cond,
  then,
  els,
});
export const cmp = (op: ComparisonOp, a: IntExpr, b: IntExpr): BoolExpr => ({
  kind: "cmp",
  op,
  a,
  b,
});
export const eq = (a: IntExpr, b: IntExpr): BoolExpr => cmp("eq", a, b);
export const ne = (a: IntExpr, b: IntExpr): BoolExpr => cmp("ne", a, b);
export const ge = (a: IntExpr, b: IntExpr): BoolExpr => cmp("ge", a, b);
export const le = (a: IntExpr, b: IntExpr): BoolExpr => cmp("le", a, b);
export const and = (...terms: readonly BoolExpr[]): BoolExpr =>
  terms.reduce((acc, term) => ({ kind: "and", a: acc, b: term }), bool(true));
export const or = (...terms: readonly BoolExpr[]): BoolExpr =>
  terms.reduce((acc, term) => ({ kind: "or", a: acc, b: term }), bool(false));
export const not = (a: BoolExpr): BoolExpr => ({ kind: "not", a });
export const boolEq = (a: BoolExpr, b: BoolExpr): BoolExpr => ({
  kind: "boolEq",
  a,
  b,
});
export const implies = (a: BoolExpr, b: BoolExpr): BoolExpr => or(not(a), b);
export const iteBool = (
  cond: BoolExpr,
  then: BoolExpr,
  els: BoolExpr
): BoolExpr => ({ kind: "iteBool", cond, then, els });

export const clampE = (value: IntExpr, low: IntExpr, high: IntExpr): IntExpr =>
  maxE(low, minE(value, high));

/* ------------------------------- evaluation ------------------------------ */

export interface Environment {
  readonly ints: Readonly<Record<string, number>>;
  readonly bools: Readonly<Record<string, boolean>>;
}

const lookupInt = (env: Environment, name: string): number => {
  const value = env.ints[name];
  if (value === undefined) throw new Error(`Unbound int variable ${name}`);
  return value;
};

const lookupBool = (env: Environment, name: string): boolean => {
  const value = env.bools[name];
  if (value === undefined) throw new Error(`Unbound bool variable ${name}`);
  return value;
};

/**
 * Floor division matching SMT-LIB `div` for positive divisors: rounds toward
 * negative infinity, so both interpretations agree on negative operands.
 */
const floorDiv = (a: number, by: number): number => Math.floor(a / by);

export function evaluateInt(expr: IntExpr, env: Environment): number {
  switch (expr.kind) {
    case "int":
      return expr.value;
    case "intVar":
      return lookupInt(env, expr.name);
    case "add":
      return evaluateInt(expr.a, env) + evaluateInt(expr.b, env);
    case "sub":
      return evaluateInt(expr.a, env) - evaluateInt(expr.b, env);
    case "min":
      return Math.min(evaluateInt(expr.a, env), evaluateInt(expr.b, env));
    case "max":
      return Math.max(evaluateInt(expr.a, env), evaluateInt(expr.b, env));
    case "mulConst":
      return evaluateInt(expr.a, env) * expr.by;
    case "divConst":
      return floorDiv(evaluateInt(expr.a, env), expr.by);
    case "iteInt":
      return evaluateBool(expr.cond, env)
        ? evaluateInt(expr.then, env)
        : evaluateInt(expr.els, env);
  }
}

export function evaluateBool(expr: BoolExpr, env: Environment): boolean {
  switch (expr.kind) {
    case "bool":
      return expr.value;
    case "boolVar":
      return lookupBool(env, expr.name);
    case "cmp": {
      const a = evaluateInt(expr.a, env);
      const b = evaluateInt(expr.b, env);
      switch (expr.op) {
        case "le":
          return a <= b;
        case "lt":
          return a < b;
        case "ge":
          return a >= b;
        case "gt":
          return a > b;
        case "eq":
          return a === b;
        case "ne":
          return a !== b;
      }
      break;
    }
    case "and":
      return evaluateBool(expr.a, env) && evaluateBool(expr.b, env);
    case "or":
      return evaluateBool(expr.a, env) || evaluateBool(expr.b, env);
    case "not":
      return !evaluateBool(expr.a, env);
    case "boolEq":
      return evaluateBool(expr.a, env) === evaluateBool(expr.b, env);
    case "iteBool":
      return evaluateBool(expr.cond, env)
        ? evaluateBool(expr.then, env)
        : evaluateBool(expr.els, env);
  }
}

/* ------------------------------ SMT emission ----------------------------- */

const smtInt = (value: number): string =>
  value < 0 ? `(- ${Math.abs(value)})` : String(value);

/**
 * Emit an SMT-LIB 2 term for an integer expression. Variables are emitted by
 * name via `rename`, letting the proof harness address pre- and post-states
 * of the same field (e.g. `prefTree` vs `prefTree_next`).
 */
export function intToSmt(
  expr: IntExpr,
  rename: (name: string) => string = (name) => name
): string {
  switch (expr.kind) {
    case "int":
      return smtInt(expr.value);
    case "intVar":
      return rename(expr.name);
    case "add":
      return `(+ ${intToSmt(expr.a, rename)} ${intToSmt(expr.b, rename)})`;
    case "sub":
      return `(- ${intToSmt(expr.a, rename)} ${intToSmt(expr.b, rename)})`;
    case "min": {
      const a = intToSmt(expr.a, rename);
      const b = intToSmt(expr.b, rename);
      return `(ite (<= ${a} ${b}) ${a} ${b})`;
    }
    case "max": {
      const a = intToSmt(expr.a, rename);
      const b = intToSmt(expr.b, rename);
      return `(ite (>= ${a} ${b}) ${a} ${b})`;
    }
    case "mulConst":
      return `(* ${smtInt(expr.by)} ${intToSmt(expr.a, rename)})`;
    case "divConst":
      return `(div ${intToSmt(expr.a, rename)} ${expr.by})`;
    case "iteInt":
      return `(ite ${boolToSmt(expr.cond, rename)} ${intToSmt(expr.then, rename)} ${intToSmt(expr.els, rename)})`;
  }
}

const smtComparison: Record<ComparisonOp, (a: string, b: string) => string> = {
  le: (a, b) => `(<= ${a} ${b})`,
  lt: (a, b) => `(< ${a} ${b})`,
  ge: (a, b) => `(>= ${a} ${b})`,
  gt: (a, b) => `(> ${a} ${b})`,
  eq: (a, b) => `(= ${a} ${b})`,
  ne: (a, b) => `(not (= ${a} ${b}))`,
};

export function boolToSmt(
  expr: BoolExpr,
  rename: (name: string) => string = (name) => name
): string {
  switch (expr.kind) {
    case "bool":
      return expr.value ? "true" : "false";
    case "boolVar":
      return rename(expr.name);
    case "cmp":
      return smtComparison[expr.op](
        intToSmt(expr.a, rename),
        intToSmt(expr.b, rename)
      );
    case "and":
      return `(and ${boolToSmt(expr.a, rename)} ${boolToSmt(expr.b, rename)})`;
    case "or":
      return `(or ${boolToSmt(expr.a, rename)} ${boolToSmt(expr.b, rename)})`;
    case "not":
      return `(not ${boolToSmt(expr.a, rename)})`;
    case "boolEq":
      return `(= ${boolToSmt(expr.a, rename)} ${boolToSmt(expr.b, rename)})`;
    case "iteBool":
      return `(ite ${boolToSmt(expr.cond, rename)} ${boolToSmt(expr.then, rename)} ${boolToSmt(expr.els, rename)})`;
  }
}
