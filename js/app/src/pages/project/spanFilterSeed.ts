import { isKnownRootSpanCondition } from "./spanFilterRootScopeConstants";

/**
 * A filter condition a view starts from, together with what is known about it
 * without asking the server.
 *
 * An empty condition and the exact root-span predicates produced by this app
 * do not require server validation: their validity and root scope are already
 * known, so a query can be issued for them immediately. Anything else is
 * arbitrary text whose validity and root scope require a server answer.
 *
 * `isKnownRootSpanCondition` decides which predicates qualify.
 */
export type SpanFilterSeed =
  | {
      condition: string;
      requiresServerValidation: false;
      rootSpansOnly: boolean;
    }
  | { condition: string; requiresServerValidation: true };

/**
 * A seed whose validity and root scope are both known, whether this app
 * classified it or the server answered for it. The only kind a view can load
 * from.
 */
export type SettledSpanFilterSeed = Extract<
  SpanFilterSeed,
  { requiresServerValidation: false }
>;

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
  if (isKnownRootSpanCondition(condition)) {
    return {
      condition,
      requiresServerValidation: false,
      rootSpansOnly: true,
    };
  }
  return { condition, requiresServerValidation: true };
}
