import { fetchQuery, graphql } from "relay-runtime";

import environment from "@phoenix/RelayEnvironment";

import type { traceFilterValidationQuery } from "./__generated__/traceFilterValidationQuery.graphql";

/** Async server-side validation of a trace filter condition expression. */
export async function validateTraceFilterCondition(
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
  const validationResult = await fetchQuery<traceFilterValidationQuery>(
    environment,
    graphql`
      query traceFilterValidationQuery($condition: String!, $id: ID!) {
        project: node(id: $id) {
          ... on Project {
            validateTraceFilterCondition(condition: $condition) {
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
    throw new Error("Trace filter condition validation is null");
  }
  return validationResult.project.validateTraceFilterCondition;
}
