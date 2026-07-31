/**
 * The strict root-span predicate: spans with no parent pointer at all.
 */
export const STRICT_ROOT_SPANS_CONDITION = "parent_id is None";

/**
 * The orphan-aware root-span predicate. Matches strict roots *and* spans whose
 * parent was never ingested, which the strict form misses.
 */
export const ORPHAN_AWARE_ROOT_SPANS_CONDITION = "parent_span is None";

/**
 * The filter the spans table starts with. The strict form, so orphans are not
 * counted as roots; the filter field suggests `parent_span is None` for those.
 */
export const DEFAULT_SPAN_FILTER_CONDITION = STRICT_ROOT_SPANS_CONDITION;

/**
 * Whether a condition is one of the root-span predicates this app writes
 * verbatim, making its validity and root scope known without asking the server.
 *
 * Literal string equality, deliberately: `parent_id is None and status_code ==
 * 'ERROR'` is root-scoped too, but recognizing that would mean a second copy of
 * the DSL grammar in TypeScript -- the duplication `SpanFilterConditionAnalysis`
 * exists to prevent. Defined here, once, because both the seed and the filter
 * field's validator act on the answer and must not drift apart.
 */
export function isKnownRootSpanCondition(condition: string) {
  return (
    condition === STRICT_ROOT_SPANS_CONDITION ||
    condition === ORPHAN_AWARE_ROOT_SPANS_CONDITION
  );
}
