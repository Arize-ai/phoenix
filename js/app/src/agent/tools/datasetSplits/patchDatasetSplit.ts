import { graphql } from "react-relay";

import {
  runDatasetMutation,
  type DatasetWriteApplyResult,
} from "@phoenix/agent/shared/pendingDatasetWrite";

import type { patchDatasetSplitToolMutation } from "./__generated__/patchDatasetSplitToolMutation.graphql";
import { fetchSplitsByNames } from "./listSplits";
import type { PatchDatasetSplitInput } from "./types";

const mutation = graphql`
  mutation patchDatasetSplitToolMutation($input: PatchDatasetSplitInput!) {
    patchDatasetSplit(input: $input) {
      datasetSplit {
        id
        name
      }
    }
  }
`;

/**
 * Edit a split by its current name. Splits are global, instance-wide entities,
 * so the name resolves against the whole instance. Applies the
 * `patchDatasetSplit` mutation. Runs outside React, so it uses the singleton
 * Relay environment.
 */
export async function commitPatchDatasetSplit({
  splitName,
  name,
  description,
  color,
}: PatchDatasetSplitInput): Promise<DatasetWriteApplyResult> {
  const splitsResult = await fetchSplitsByNames([splitName]);
  if (!splitsResult.ok) {
    return { ok: false, error: splitsResult.error };
  }
  const match = splitsResult.splits.find((split) => split.name === splitName);
  if (!match) {
    return {
      ok: false,
      error: `Unknown split: ${splitName}. Use list_splits to see existing splits.`,
    };
  }

  return runDatasetMutation<patchDatasetSplitToolMutation>({
    mutation,
    variables: {
      input: {
        datasetSplitId: match.id,
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(color !== undefined ? { color } : {}),
      },
    },
    onSuccess: (response) =>
      `Updated split "${response.patchDatasetSplit.datasetSplit.name}".`,
  });
}
