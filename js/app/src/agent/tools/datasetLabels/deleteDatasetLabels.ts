import { graphql } from "react-relay";

import { emitAgentDataChange } from "@phoenix/agent/shared/agentDataChanges";
import {
  runDatasetMutation,
  type DatasetWriteApplyResult,
} from "@phoenix/agent/shared/pendingDatasetWrite";
import {
  DATASET_LABEL_CONNECTION_KEYS,
  getRootConnectionIds,
} from "@phoenix/agent/shared/relayConnections";
import { resolveNamesToIds } from "@phoenix/agent/shared/resolveNamesToIds";

import type { deleteDatasetLabelsToolMutation } from "./__generated__/deleteDatasetLabelsToolMutation.graphql";
import { fetchLabelsByNames } from "./listLabels";
import type { DeleteDatasetLabelsInput } from "./types";

/**
 * Mirrors `DeleteDatasetLabelButton`: the deleted labels' edges are removed
 * from every mounted label list. The payload carries no datasets, so the
 * label chips on datasets that wore the label are refreshed through the
 * agent data-change bridge instead.
 */
const mutation = graphql`
  mutation deleteDatasetLabelsToolMutation(
    $input: DeleteDatasetLabelsInput!
    $connections: [ID!]!
  ) {
    deleteDatasetLabels(input: $input) {
      datasetLabels {
        id @deleteEdge(connections: $connections)
        name
      }
    }
  }
`;

/**
 * Delete labels by name. Resolves names to ids against the instance's labels,
 * then applies the `deleteDatasetLabels` mutation. Runs outside React, so it
 * uses the singleton Relay environment.
 */
export async function commitDeleteDatasetLabels({
  labelNames,
}: DeleteDatasetLabelsInput): Promise<DatasetWriteApplyResult> {
  const labelsResult = await fetchLabelsByNames(labelNames);
  if (!labelsResult.ok) {
    return { ok: false, error: labelsResult.error };
  }
  const { ids, unknown } = resolveNamesToIds(labelsResult.labels, labelNames);
  if (unknown.length > 0) {
    return {
      ok: false,
      error: `Unknown label(s): ${unknown.join(
        ", "
      )}. Use list_labels to see existing labels.`,
    };
  }

  return runDatasetMutation<deleteDatasetLabelsToolMutation>({
    mutation,
    variables: {
      input: { datasetLabelIds: ids },
      connections: getRootConnectionIds(DATASET_LABEL_CONNECTION_KEYS),
    },
    onSuccess: () => {
      emitAgentDataChange({ entity: "datasetLabels" });
      return `Deleted label(s): ${labelNames.join(", ")}.`;
    },
  });
}
