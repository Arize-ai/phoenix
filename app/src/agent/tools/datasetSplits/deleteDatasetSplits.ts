import { graphql } from "react-relay";

import {
  runDatasetMutation,
  type DatasetWriteApplyResult,
} from "@phoenix/agent/shared/pendingDatasetWrite";
import { resolveNamesToIds } from "@phoenix/agent/shared/resolveNamesToIds";

import type { deleteDatasetSplitsToolMutation } from "./__generated__/deleteDatasetSplitsToolMutation.graphql";
import { fetchAllSplits } from "./listSplits";
import type { DeleteDatasetSplitsInput } from "./types";

const mutation = graphql`
  mutation deleteDatasetSplitsToolMutation($input: DeleteDatasetSplitInput!) {
    deleteDatasetSplits(input: $input) {
      datasetSplits {
        id
        name
      }
    }
  }
`;

/**
 * Delete splits by name. Splits are global, instance-wide entities, so names
 * resolve against the whole instance (and the delete removes them everywhere).
 * Applies the `deleteDatasetSplits` mutation. Runs outside React, so it uses the
 * singleton Relay environment.
 */
export async function commitDeleteDatasetSplits({
  splitNames,
}: DeleteDatasetSplitsInput): Promise<DatasetWriteApplyResult> {
  const splitsResult = await fetchAllSplits();
  if (!splitsResult.ok) {
    return { ok: false, error: splitsResult.error };
  }
  const { ids, unknown } = resolveNamesToIds(splitsResult.splits, splitNames);
  if (unknown.length > 0) {
    const available =
      splitsResult.splits.map((split) => split.name).join(", ") || "(none)";
    return {
      ok: false,
      error: `Unknown split(s): ${unknown.join(", ")}. Existing splits: ${available}.`,
    };
  }

  return runDatasetMutation<deleteDatasetSplitsToolMutation>({
    mutation,
    variables: { input: { datasetSplitIds: ids } },
    onSuccess: () => `Deleted split(s): ${splitNames.join(", ")}.`,
  });
}
