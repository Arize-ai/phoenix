import { graphql } from "react-relay";

import {
  runDatasetMutation,
  type DatasetWriteApplyResult,
} from "@phoenix/agent/shared/pendingDatasetWrite";
import { commitListDatasets } from "@phoenix/agent/tools/listDatasets";

import type { addSpansToDatasetToolMutation } from "./__generated__/addSpansToDatasetToolMutation.graphql";

const mutation = graphql`
  mutation addSpansToDatasetToolMutation($input: AddSpansToDatasetInput!) {
    addSpansToDataset(input: $input) {
      dataset {
        id
        name
      }
    }
  }
`;

/**
 * Resolve a dataset name to exactly one dataset, or return an explanatory error.
 *
 * Matching here is deliberately more lenient than the exact name resolution used
 * for splits and labels: the model supplies a dataset name the user phrased
 * loosely, so we query by substring (`nameContains`) and then (1) prefer an
 * exact, case-sensitive name match, else (2) accept the result only if the
 * substring search returned a single dataset. Anything ambiguous is rejected
 * with the candidates listed. Splits/labels resolve against an enumerated,
 * canonical set the agent has already listed, so they match exactly.
 */
async function resolveDatasetByName(
  datasetName: string
): Promise<
  { ok: true; id: string; name: string } | { ok: false; error: string }
> {
  const result = await commitListDatasets({
    nameContains: datasetName,
    limit: 50,
  });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  const { datasets } = result.output;
  if (datasets.length === 0) {
    return {
      ok: false,
      error: `No dataset named "${datasetName}" was found. Create it first with create_dataset.`,
    };
  }
  const exact = datasets.filter((dataset) => dataset.name === datasetName);
  const chosen =
    exact.length === 1
      ? exact[0]
      : exact.length === 0 && datasets.length === 1
        ? datasets[0]
        : null;
  if (!chosen) {
    const candidates = datasets.map((dataset) => dataset.name).join(", ");
    return {
      ok: false,
      error: `"${datasetName}" matches more than one dataset (${candidates}). Use list_datasets to pick the exact name.`,
    };
  }
  return { ok: true, id: chosen.id, name: chosen.name };
}

/**
 * Add span(s) to a dataset (addressed by name) via the existing
 * `addSpansToDataset` mutation; each span becomes a new row. Resolves the
 * dataset name to exactly one id first. Runs outside React, so it uses the
 * singleton Relay environment.
 */
export async function commitAddSpansToDataset({
  datasetName,
  spanIds,
}: {
  datasetName: string;
  spanIds: string[];
}): Promise<DatasetWriteApplyResult> {
  const resolved = await resolveDatasetByName(datasetName);
  if (!resolved.ok) {
    return { ok: false, error: resolved.error };
  }
  return runDatasetMutation<addSpansToDatasetToolMutation>({
    mutation,
    variables: { input: { datasetId: resolved.id, spanIds } },
    onSuccess: () =>
      `Added ${spanIds.length} span(s) to dataset "${resolved.name}".`,
  });
}
