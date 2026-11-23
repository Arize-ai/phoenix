import { graphql } from "react-relay";

import { emitAgentDataChange } from "@phoenix/agent/shared/agentDataChanges";
import {
  runDatasetMutation,
  type DatasetWriteApplyResult,
} from "@phoenix/agent/shared/pendingDatasetWrite";

import type { deleteDatasetExamplesToolMutation } from "./__generated__/deleteDatasetExamplesToolMutation.graphql";
import type { DeleteDatasetExamplesInput } from "./types";

const mutation = graphql`
  mutation deleteDatasetExamplesToolMutation(
    $input: DeleteDatasetExamplesInput!
  ) {
    deleteDatasetExamples(input: $input) {
      dataset {
        id
        name
        exampleCount
        updatedAt
      }
    }
  }
`;

/**
 * Remove rows via the existing `deleteDatasetExamples` mutation (creates a new
 * dataset version). The write is scoped to the dataset in view via `datasetId`,
 * so the server rejects it outright if any example belongs to another dataset.
 * Runs outside React, so it uses the singleton Relay environment.
 */
export function commitDeleteDatasetExamples({
  datasetId,
  exampleIds,
  versionDescription,
}: {
  datasetId: string;
} & DeleteDatasetExamplesInput): Promise<DatasetWriteApplyResult> {
  return runDatasetMutation<deleteDatasetExamplesToolMutation>({
    mutation,
    variables: {
      input: {
        datasetId,
        exampleIds,
        ...(versionDescription != null
          ? { datasetVersionDescription: versionDescription }
          : {}),
      },
    },
    onSuccess: (response) => {
      emitAgentDataChange({
        entity: "datasetExamples",
        datasetId: response.deleteDatasetExamples.dataset.id,
      });
      return `Removed ${exampleIds.length} row(s).`;
    },
  });
}
