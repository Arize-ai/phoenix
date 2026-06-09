import { graphql } from "react-relay";

import {
  runDatasetMutation,
  type DatasetWriteApplyResult,
} from "@phoenix/agent/shared/pendingDatasetWrite";
import { resolveNamesToIds } from "@phoenix/agent/shared/resolveNamesToIds";

import type { deleteDatasetLabelsToolMutation } from "./__generated__/deleteDatasetLabelsToolMutation.graphql";
import { fetchAllAvailableLabels } from "./listLabels";
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
  const labelsResult = await fetchAllAvailableLabels();
  if (!labelsResult.ok) {
    return { ok: false, error: labelsResult.error };
  }
  const { ids, unknown } = resolveNamesToIds(labelsResult.labels, labelNames);
  if (unknown.length > 0) {
    const available =
      labelsResult.labels.map((label) => label.name).join(", ") || "(none)";
    return {
      ok: false,
      error: `Unknown label(s): ${unknown.join(", ")}. Existing labels: ${available}.`,
    };
  }

  return runDatasetMutation<deleteDatasetLabelsToolMutation>({
    mutation,
    variables: { input: { datasetLabelIds: ids } },
    onSuccess: () => `Deleted label(s): ${labelNames.join(", ")}.`,
  });
}
