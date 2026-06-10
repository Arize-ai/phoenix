import { commitMutation, graphql } from "react-relay";

import type { DatasetWriteApplyResult } from "@phoenix/agent/shared/pendingDatasetWrite";
import { resolveNamesToIds } from "@phoenix/agent/shared/resolveNamesToIds";
import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { setDatasetExampleSplitsToolMutation } from "./__generated__/setDatasetExampleSplitsToolMutation.graphql";
import { fetchAllSplits } from "./listSplits";
import type { SetDatasetExampleSplitsInput } from "./types";

const mutation = graphql`
  mutation setDatasetExampleSplitsToolMutation(
    $input: SetDatasetExampleSplitsInput!
  ) {
    setDatasetExampleSplits(input: $input) {
      example {
        id
      }
    }
  }
`;

function commitOne(
  exampleId: string,
  datasetSplitIds: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    commitMutation<setDatasetExampleSplitsToolMutation>(RelayEnvironment, {
      mutation,
      variables: { input: { exampleId, datasetSplitIds } },
      onCompleted: (_response, errors) => {
        const message = errors?.find((error) => error.message)?.message;
        resolve(message ? { ok: false, error: message } : { ok: true });
      },
      onError: (error) => resolve({ ok: false, error: error.message }),
    });
  });
}

/**
 * Assign rows to existing splits by name. Resolves split names to ids against
 * the instance-wide split vocabulary (splits are global entities, so an example
 * can be assigned to any existing split, not only ones already on its dataset),
 * then applies the per-example `setDatasetExampleSplits` mutation for each row
 * (it replaces each row's split membership). Runs outside React, so it uses the
 * singleton Relay environment. Example ids are prevalidated against the dataset
 * in view before the write is staged (see the agent tool), and split names are
 * resolved before the first mutation — so a partial assignment can only result
 * from a transient failure mid-loop; the error then reports how many rows were
 * applied.
 */
export async function commitSetDatasetExampleSplits({
  exampleIds,
  splitNames,
}: SetDatasetExampleSplitsInput): Promise<DatasetWriteApplyResult> {
  const splitsResult = await fetchAllSplits();
  if (!splitsResult.ok) {
    return { ok: false, error: splitsResult.error };
  }
  const { ids: splitIds, unknown } = resolveNamesToIds(
    splitsResult.splits,
    splitNames
  );
  if (unknown.length > 0) {
    const available =
      splitsResult.splits.map((split) => split.name).join(", ") || "(none)";
    return {
      ok: false,
      error: `Unknown split(s): ${unknown.join(
        ", "
      )}. Existing splits: ${available}. Create a new split with create_dataset_split first.`,
    };
  }

  let applied = 0;
  for (const exampleId of exampleIds) {
    const result = await commitOne(exampleId, splitIds);
    if (!result.ok) {
      return {
        ok: false,
        error: `Assigned ${applied} of ${exampleIds.length} example(s) before failing: ${result.error}`,
      };
    }
    applied += 1;
  }
  return {
    ok: true,
    output: `Assigned ${applied} example(s) to split(s): ${splitNames.join(
      ", "
    )}.`,
  };
}
