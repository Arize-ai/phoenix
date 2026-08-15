/**
 * A natural-language request paired with the filter expressions accepted as
 * correct translations. The first accepted expression is the canonical
 * answer; the rest are alternative phrasings that filter the same records
 * (clause order, equivalent fields). Anything else falls through to the
 * LLM equivalence judge.
 */
export type FilterEvalCase = {
  /** Stable example id — keeps experiment runs upserting onto the same dataset example. */
  id: string;
  /** The natural-language request a user would type. */
  query: string;
  /** Expressions accepted as (normalized) exact matches. */
  accepted: string[];
  /**
   * The specific wrong answer this case exists to catch — the reason it
   * has a slot in the suite, e.g. "puts the timeout in status_code".
   */
  failureMode: string;
};

/**
 * A case whose request the DSL cannot express exactly. `missingCapability`
 * names the syntax the language lacks, and `accepted` holds the closest
 * expression the language can write today. When the capability ships,
 * point `accepted` at the exact form and delete `missingCapability` — the
 * case then becomes the regression test for the new syntax.
 */
export type FrontierFilterEvalCase = FilterEvalCase & {
  missingCapability?: string;
};
