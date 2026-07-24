import { fetchQuery, graphql } from "relay-runtime";

import environment from "@phoenix/RelayEnvironment";

import type { spanFilterValidationQuery } from "./__generated__/spanFilterValidationQuery.graphql";

export type SpanFilterConditionValidation = {
  isValid: boolean;
  errorMessage?: string | null;
  /**
   * Whether the condition restricts the result set to root spans, which
   * decides between cumulative and per-span metric columns. `null` when the
   * server did not answer; `false` means the condition is not *known* to be
   * root-scoped, which is not the same as knowing it admits non-root spans.
   */
  selectsRootSpansOnly: boolean | null;
};

/**
 * Async server-side validation of a span filter condition expression, together
 * with the structural facts a caller needs about that same condition. Both are
 * questions about the parsed expression, so neither can be answered here
 * without a second parser for the DSL.
 *
 * Lives in its own file (rather than co-located with `SpanFilterConditionField`)
 * so both the field's deferred-validation effect and the
 * `SpanFiltersProvider`'s agent client-action handler can call it without
 * creating a circular import between the field and the provider.
 */
export async function validateSpanFilterCondition(
  condition: string,
  projectId: string
): Promise<SpanFilterConditionValidation> {
  if (!condition) {
    // An empty condition restricts nothing, so it is knowably not root-scoped
    // without asking.
    return {
      isValid: true,
      errorMessage: null,
      selectsRootSpansOnly: false,
    };
  }
  const validationResult = await fetchQuery<spanFilterValidationQuery>(
    environment,
    graphql`
      query spanFilterValidationQuery($condition: String!, $id: ID!) {
        project: node(id: $id) {
          ... on Project {
            validateSpanFilterCondition(condition: $condition) {
              isValid
              errorMessage
            }
            analyzeSpanFilterCondition(condition: $condition) {
              selectsRootSpansOnly
            }
          }
        }
      }
    `,
    { condition, id: projectId }
  ).toPromise();
  if (!validationResult) {
    throw new Error("Filter condition validation is null");
  }
  // Both fields are optional on the inline fragment, since `node` need not be a
  // Project. A missing validation reads as invalid.
  const { project } = validationResult;
  return {
    isValid: project.validateSpanFilterCondition?.isValid ?? false,
    errorMessage: project.validateSpanFilterCondition?.errorMessage ?? null,
    selectsRootSpansOnly:
      project.analyzeSpanFilterCondition?.selectsRootSpansOnly ?? null,
  };
}
