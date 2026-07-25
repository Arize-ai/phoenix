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
