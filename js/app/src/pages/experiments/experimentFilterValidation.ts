import { fetchQuery, graphql } from "relay-runtime";

import environment from "@phoenix/RelayEnvironment";

import type { experimentFilterValidationQuery } from "./__generated__/experimentFilterValidationQuery.graphql";

/** Async server-side validation of an experiment filter condition expression. */
export async function validateExperimentFilterCondition({
  condition,
  datasetId,
}: {
  condition: string;
  datasetId: string;
}) {
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

/**
 * Returns the condition to fetch a dataset's experiments with: the condition
 * itself when the server accepts it, otherwise no condition. A link can carry a
 * condition the server rejects, and querying with it would fail the whole page.
 */
export async function getSettledExperimentFilterCondition({
  condition,
  datasetId,
}: {
  condition: string;
  datasetId: string;
}): Promise<string> {
  if (!condition) {
    return "";
  }
  try {
    const { isValid } = await validateExperimentFilterCondition({
      condition,
      datasetId,
    });
    return isValid ? condition : "";
  } catch {
    return "";
  }
}
