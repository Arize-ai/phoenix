import { fetchQuery, graphql } from "relay-runtime";

import environment from "@phoenix/RelayEnvironment";

import type { spanFilterValidationQuery } from "./__generated__/spanFilterValidationQuery.graphql";

/**
 * Async server-side validation of a span filter condition expression.
 *
 * Lives in its own file (rather than co-located with `SpanFilterConditionField`)
 * so both the field's deferred-validation effect and the
 * `SpanFiltersProvider`'s agent client-action handler can call it without
 * creating a circular import between the field and the provider.
 */
export async function validateSpanFilterCondition(
  condition: string,
  projectId: string
) {
  if (!condition) {
    return {
      isValid: true,
      errorMessage: null,
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
          }
        }
      }
    `,
    { condition, id: projectId }
  ).toPromise();
  if (!validationResult) {
    throw new Error("Filter condition validation is null");
  }
  return validationResult.project.validateSpanFilterCondition;
}
