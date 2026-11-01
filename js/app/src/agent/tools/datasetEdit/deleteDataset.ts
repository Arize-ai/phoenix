import { fetchQuery, graphql } from "react-relay";

import { emitAgentDataChange } from "@phoenix/agent/shared/agentDataChanges";
import {
  runDatasetMutation,
  type DatasetWriteApplyResult,
} from "@phoenix/agent/shared/pendingDatasetWrite";
import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { deleteDatasetToolMutation } from "./__generated__/deleteDatasetToolMutation.graphql";
import type { deleteDatasetToolNameQuery } from "./__generated__/deleteDatasetToolNameQuery.graphql";

const nameQuery = graphql`
  query deleteDatasetToolNameQuery($datasetId: ID!) {
    dataset: node(id: $datasetId) {
      __typename
      ... on Dataset {
        name
      }
    }
  }
`;

/**
 * The deleted record is deliberately left in the store rather than removed
 * with `@deleteRecord`: the datasets table and pickers hold edges to it, and
 * a deleted node would read back as `null` inside their non-null lists. The
 * UI's own delete dialog refetches the table instead, and the agent
 * data-change bridge does the same here.
 */
const mutation = graphql`
  mutation deleteDatasetToolMutation($input: DeleteDatasetInput!) {
    deleteDataset(input: $input) {
      dataset {
        id
        name
      }
    }
  }
`;

/** Resolve the in-context dataset's name, for the approval card preview. */
export async function resolveDatasetName(
  datasetId: string
): Promise<string | null> {
  try {
    const data = await fetchQuery<deleteDatasetToolNameQuery>(
      RelayEnvironment,
      nameQuery,
      { datasetId }
    ).toPromise();
    const dataset = data?.dataset;
    return dataset && dataset.__typename === "Dataset" ? dataset.name : null;
  } catch {
    return null;
  }
}

/**
 * Permanently delete the in-context dataset via the existing `deleteDataset`
 * mutation. Runs outside React, so it uses the singleton Relay environment.
 */
export function commitDeleteDataset({
  datasetId,
}: {
  datasetId: string;
}): Promise<DatasetWriteApplyResult> {
  return runDatasetMutation<deleteDatasetToolMutation>({
    mutation,
    variables: { input: { datasetId } },
    onSuccess: (response) => {
      emitAgentDataChange({ entity: "datasets" });
      return `Deleted dataset "${response.deleteDataset.dataset.name}".`;
    },
  });
}
