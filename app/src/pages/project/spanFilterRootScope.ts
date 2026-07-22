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
 * The filter the spans table starts with. Root spans are the useful default
 * view, and expressing that default as a condition (rather than as a separate
 * boolean) keeps root-ness inside the filter DSL where it can be edited,
 * shared, and persisted along with everything else.
 *
 * The strict form is the default because it is what the table showed before
 * root-ness moved into the DSL; users who want orphans counted as roots swap in
 * `parent_span is None`, which the filter field suggests.
 */
export const DEFAULT_SPAN_FILTER_CONDITION = STRICT_ROOT_SPANS_CONDITION;
