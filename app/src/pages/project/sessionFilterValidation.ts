import { fetchQuery, graphql } from "relay-runtime";

import environment from "@phoenix/RelayEnvironment";

import type { sessionFilterValidationQuery } from "./__generated__/sessionFilterValidationQuery.graphql";

export async function validateSessionFilterCondition(
  condition: string,
  projectId: string
) {
  if (!condition.trim()) {
    return {
      isValid: true,
      errorMessage: null,
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
