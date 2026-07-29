import {
  ORPHAN_AWARE_ROOT_SPANS_CONDITION,
  STRICT_ROOT_SPANS_CONDITION,
} from "./spanFilterRootScopeConstants";

/**
 * A filter condition a view starts from, together with what is known about it
 * without asking the server.
 *
 * An empty condition and the exact root-span predicates produced by this app
 * do not require server validation: their validity and root scope are already
 * known, so a query can be issued for them immediately. Anything else is
 * arbitrary text whose validity and root scope require a server answer.
 *
 * This exemption is deliberately based on literal string equality.
 * `parent_id is None and status_code == 'ERROR'` is root-scoped, and the server
 * reports it as such, but recognizing that here would mean a second copy of the
 * DSL grammar in TypeScript -- the duplication `SpanFilterConditionAnalysis`
 * exists to prevent.
 */
export type SpanFilterSeed =
  | {
      condition: string;
      requiresServerValidation: false;
      rootSpansOnly: boolean;
    }
  | { condition: string; requiresServerValidation: true };

/**
 * Classify a starting condition. Callers that need the same seed -- the query
 * that preloads rows and the table that renders them -- classify the same
 * string, so they cannot disagree about what was fetched.
 */
export function spanFilterSeed(condition: string): SpanFilterSeed {
  // An empty condition restricts nothing, so it is knowably not root-scoped.
  if (condition.trim() === "") {
    return {
      condition: "",
      requiresServerValidation: false,
      rootSpansOnly: false,
    };
  }
  if (
    condition === STRICT_ROOT_SPANS_CONDITION ||
    condition === ORPHAN_AWARE_ROOT_SPANS_CONDITION
  ) {
    return {
      condition,
      requiresServerValidation: false,
      rootSpansOnly: true,
    };
  }
  return { condition, requiresServerValidation: true };
}
