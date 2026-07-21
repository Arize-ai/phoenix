import { fetchQuery, graphql } from "relay-runtime";

import environment from "@phoenix/RelayEnvironment";

import type { spanFilterRootScopeQuery } from "./__generated__/spanFilterRootScopeQuery.graphql";

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

/**
 * Asks the server whether a filter condition confines the result set to root
 * spans, which decides whether the table shows cumulative or per-span metrics
 * (a cumulative rollup on a nested span double-counts against its ancestors).
 *
 * The question is answered server-side on purpose: it is a question about the
 * structure of the expression — is the root predicate binding on every row? —
 * and answering it here would mean maintaining a second parser in TypeScript,
 * free to drift from the real one. A root predicate nested under `or` scopes
 * the result only if every other branch is scoped too, which no amount of
 * substring matching can tell you.
 *
 * Returns `null` when the answer cannot be obtained, so callers can keep
 * whatever they last resolved rather than flipping the columns on a hiccup.
 */
export async function fetchSelectsRootSpansOnly(
  condition: string,
  projectId: string
): Promise<boolean | null> {
  const response = await fetchQuery<spanFilterRootScopeQuery>(
    environment,
    graphql`
      query spanFilterRootScopeQuery($condition: String!, $id: ID!) {
        project: node(id: $id) {
          ... on Project {
            analyzeSpanFilterCondition(condition: $condition) {
              selectsRootSpansOnly
            }
          }
        }
      }
    `,
    { condition, id: projectId }
  ).toPromise();
  return (
    response?.project?.analyzeSpanFilterCondition?.selectsRootSpansOnly ?? null
  );
}
