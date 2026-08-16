import { graphql } from "react-relay";

import {
  runDatasetMutation,
  type DatasetWriteApplyResult,
} from "@phoenix/agent/shared/pendingDatasetWrite";
import { resolveNamesToIds } from "@phoenix/agent/shared/resolveNamesToIds";

import type { setDatasetExampleSplitsToolBatchMutation } from "./__generated__/setDatasetExampleSplitsToolBatchMutation.graphql";
import { fetchSplitsByNames } from "./listSplits";
import type { SetDatasetExampleSplitsInput } from "./types";

const mutation = graphql`
  mutation setDatasetExampleSplitsToolBatchMutation(
    $input: SetDatasetExamplesSplitsInput!
  ) {
    setDatasetExamplesSplits(input: $input) {
      examples {
        id
      }
    }
  }
`;

/**
 * Assign rows to existing splits by name. Resolves split names to ids against
 * the instance-wide split vocabulary (splits are global entities, so an example
 * can be assigned to any existing split, not only ones already on its dataset),
 * then applies the batch `setDatasetExamplesSplits` mutation, which replaces
 * every row's split membership in a single transaction — a failure on any row
 * leaves no partial assignment. The write is additionally scoped to the dataset
 * in view via `datasetId`, so the server rejects the whole batch if any example
 * belongs to another dataset. Runs outside React, so it uses the singleton
 * Relay environment.
 */
export async function commitSetDatasetExampleSplits({
  datasetId,
  exampleIds,
  splitNames,
}: {
  datasetId: string;
} & SetDatasetExampleSplitsInput): Promise<DatasetWriteApplyResult> {
  const splitsResult = await fetchSplitsByNames(splitNames);
  if (!splitsResult.ok) {
    return { ok: false, error: splitsResult.error };
  }
  const { ids: splitIds, unknown } = resolveNamesToIds(
    splitsResult.splits,
    splitNames
  );
  if (unknown.length > 0) {
    return {
      ok: false,
      error: `Unknown split(s): ${unknown.join(
        ", "
      )}. Use list_splits to see existing splits, or create_dataset_split to create one.`,
    };
  }

  return runDatasetMutation<setDatasetExampleSplitsToolBatchMutation>({
    mutation,
    variables: {
      input: { exampleIds, datasetSplitIds: splitIds, datasetId },
    },
    onSuccess: () =>
      `Assigned ${exampleIds.length} example(s) to split(s): ${splitNames.join(
        ", "
      )}.`,
  });
}
