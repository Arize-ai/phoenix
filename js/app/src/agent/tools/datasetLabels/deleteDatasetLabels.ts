import { graphql } from "react-relay";

import {
  runDatasetMutation,
  type DatasetWriteApplyResult,
} from "@phoenix/agent/shared/pendingDatasetWrite";
import { resolveNamesToIds } from "@phoenix/agent/shared/resolveNamesToIds";

import type { deleteDatasetLabelsToolMutation } from "./__generated__/deleteDatasetLabelsToolMutation.graphql";
import { fetchLabelsByNames } from "./listLabels";
import type { DeleteDatasetLabelsInput } from "./types";

const mutation = graphql`
  mutation deleteDatasetLabelsToolMutation($input: DeleteDatasetLabelsInput!) {
    deleteDatasetLabels(input: $input) {
      datasetLabels {
        id
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
    variables: { input: { datasetLabelIds: ids } },
    onSuccess: () => `Deleted label(s): ${labelNames.join(", ")}.`,
  });
}
