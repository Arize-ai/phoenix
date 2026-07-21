import { fetchQuery, graphql } from "relay-runtime";

import environment from "@phoenix/RelayEnvironment";

import type { sessionFilterValidationQuery } from "./__generated__/sessionFilterValidationQuery.graphql";

/**
 * Async server-side validation of a session filter condition expression.
 *
 * Lives in its own file (rather than co-located with
 * `SessionFilterConditionField`) so both the field's deferred-validation
 * effect and the `SessionFiltersProvider`'s agent client-action handler can
 * call it without creating a circular import between the field and provider.
 */
export async function validateSessionFilterCondition(
  condition: string,
  projectId: string
) {
  if (!condition.trim()) {
    return {
      isValid: true,
      errorMessage: null,
      warnings: [],
    };
  }
  const validationResult = await fetchQuery<sessionFilterValidationQuery>(
    environment,
    graphql`
      query sessionFilterValidationQuery($condition: String!, $id: ID!) {
        project: node(id: $id) {
          ... on Project {
            validateSessionFilterCondition(condition: $condition) {
              isValid
              errorMessage
              warnings
            }
          }
        }
      }
    `,
    { condition, id: projectId }
  ).toPromise();
  if (!validationResult) {
    throw new Error("Session filter condition validation is null");
  }
  return validationResult.project.validateSessionFilterCondition;
}
