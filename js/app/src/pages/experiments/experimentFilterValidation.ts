import { fetchQuery, graphql } from "relay-runtime";

import environment from "@phoenix/RelayEnvironment";

import type { experimentFilterValidationQuery } from "./__generated__/experimentFilterValidationQuery.graphql";

/** Async server-side validation of an experiment filter condition expression. */
export async function validateExperimentFilterCondition(
  condition: string,
  datasetId: string
) {
  if (!condition.trim()) {
    return {
      isValid: true,
      errorMessage: null,
      warnings: [],
    };
  }
  const validationResult = await fetchQuery<experimentFilterValidationQuery>(
    environment,
    graphql`
      query experimentFilterValidationQuery($condition: String!, $id: ID!) {
        dataset: node(id: $id) {
          ... on Dataset {
            validateExperimentFilterCondition(condition: $condition) {
              isValid
              errorMessage
              warnings
            }
          }
        }
      }
    `,
    { condition, id: datasetId }
  ).toPromise();
  if (!validationResult?.dataset.validateExperimentFilterCondition) {
    throw new Error("Experiment filter condition validation is null");
  }
  return validationResult.dataset.validateExperimentFilterCondition;
}
