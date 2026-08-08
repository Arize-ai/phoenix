/**
 * Evaluators for the example suites, written as plain `{ name, kind, evaluate }`
 * objects — the shape `px.evaluate()` accepts. When called without explicit
 * params, `px.evaluate()` auto-supplies `input`, `output`, `expected`,
 * `metadata`, and `traceId` from the current run, so these read those fields.
 *
 * `output` arrives typed as `unknown` (an evaluator may run before
 * `logOutput()`), so we narrow it to the app's `SqlOutput` shape here.
 */
import type { Evaluator } from "@arizeai/phoenix-client/vitest";

import {
  looksLikeSql,
  sqlCorrectness,
  sqlTokenF1,
  type SqlOutput,
} from "./app";

/** Boolean exact-match correctness against the reference SQL. */
export const correctness: Evaluator = {
  name: "correctness",
  kind: "CODE",
  evaluate: ({ output, expected }) =>
    sqlCorrectness(output as SqlOutput, expected as SqlOutput | undefined) ===
    1,
};

/** Graded token-overlap score in `[0, 1]`. */
export const tokenF1: Evaluator = {
  name: "token_f1",
  kind: "CODE",
  evaluate: ({ output, expected }) =>
    sqlTokenF1(output as SqlOutput, expected as SqlOutput | undefined),
};

/** Structural validity as a boolean (looks like a `SELECT ...;` statement). */
export const validSql: Evaluator = {
  name: "valid_sql",
  kind: "CODE",
  evaluate: ({ output }) => {
    const out = output as SqlOutput | undefined;
    return out ? looksLikeSql(out) : false;
  },
};
