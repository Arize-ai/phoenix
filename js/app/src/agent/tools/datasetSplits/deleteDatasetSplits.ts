import { graphql } from "react-relay";

import { emitAgentDataChange } from "@phoenix/agent/shared/agentDataChanges";
import {
  runDatasetMutation,
  type DatasetWriteApplyResult,
} from "@phoenix/agent/shared/pendingDatasetWrite";
import { resolveNamesToIds } from "@phoenix/agent/shared/resolveNamesToIds";

import type { deleteDatasetSplitsToolMutation } from "./__generated__/deleteDatasetSplitsToolMutation.graphql";
import { fetchSplitsByNames } from "./listSplits";
import type { DeleteDatasetSplitsInput } from "./types";

/**
 * Mounted split lists and example rows refetch through the agent data-change
 * bridge after deletion. Deleted records are not
 * `@deleteRecord`-ed because `DatasetExample.datasetSplits` is a non-null
 * list and a deleted node would read back as `null` inside it.
 */
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
  const splitsResult = await fetchSplitsByNames(splitNames);
  if (!splitsResult.ok) {
    return { ok: false, error: splitsResult.error };
  }
  const { ids, unknown } = resolveNamesToIds(splitsResult.splits, splitNames);
  if (unknown.length > 0) {
    return {
      ok: false,
      error: `Unknown split(s): ${unknown.join(
        ", "
      )}. Use list_splits to see existing splits.`,
    };
  }

  return runDatasetMutation<deleteDatasetSplitsToolMutation>({
    mutation,
    variables: {
      input: { datasetSplitIds: ids },
    },
    onSuccess: () => {
      emitAgentDataChange({ entity: "datasetSplits" });
      return `Deleted split(s): ${splitNames.join(", ")}.`;
    },
  });
}
