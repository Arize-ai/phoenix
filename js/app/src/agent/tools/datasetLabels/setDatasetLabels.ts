import { graphql } from "react-relay";

import {
  runDatasetMutation,
  type DatasetWriteApplyResult,
} from "@phoenix/agent/shared/pendingDatasetWrite";
import { resolveNamesToIds } from "@phoenix/agent/shared/resolveNamesToIds";

import type { setDatasetLabelsToolMutation } from "./__generated__/setDatasetLabelsToolMutation.graphql";
import { fetchLabelsByNames } from "./listLabels";
import type { SetDatasetLabelsInput } from "./types";

const mutation = graphql`
  mutation setDatasetLabelsToolMutation($input: SetDatasetLabelsInput!) {
    setDatasetLabels(input: $input) {
      dataset {
        id
      }
    }
  }
`;

/**
 * Set the in-context dataset's labels to the named labels. Resolves label names
 * to ids against the labels available in the instance, then applies the
 * `setDatasetLabels` mutation (which replaces the dataset's labels). Runs
 * outside React, so it uses the singleton Relay environment.
 */
export async function commitSetDatasetLabels({
  datasetId,
  labelNames,
}: {
  datasetId: string;
} & SetDatasetLabelsInput): Promise<DatasetWriteApplyResult> {
  const labelsResult = await fetchLabelsByNames(labelNames);
  if (!labelsResult.ok) {
    return { ok: false, error: labelsResult.error };
  }
  const { ids: labelIds, unknown } = resolveNamesToIds(
    labelsResult.labels,
    labelNames
  );
  if (unknown.length > 0) {
    return {
      ok: false,
      error: `Unknown label(s): ${unknown.join(
        ", "
      )}. Use list_labels to see existing labels, or create_dataset_label to create one.`,
    };
  }

  return runDatasetMutation<setDatasetLabelsToolMutation>({
    mutation,
    variables: { input: { datasetId, datasetLabelIds: labelIds } },
    onSuccess: () => `Set this dataset's labels to: ${labelNames.join(", ")}.`,
  });
}
